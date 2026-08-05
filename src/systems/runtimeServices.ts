import packageJson from "../../package.json";
import { PLATFORM_IDS, isConfiguredPlatformId } from "../config/platform.ts";
import { getProfile } from "../state/profile.ts";
import {
    fetchLiveOps,
    getRunCapabilities,
    purchaseVerifiedShopItem,
    rearmLocalNotification,
    recordAnalytics,
    recordFunnelStep,
    showVerifiedRewardedAd,
    showVerifiedInterstitialAd,
    triggerHaptic,
    type HapticStyle,
    type VerifiedActionResult,
} from "../sdk/runSdk.ts";
import { refreshServerTime } from "./serverTime.ts";
import { store } from "../state/store.ts";
import { t } from "./localization.ts";

export interface RuntimeConfig {
    dailyRewardsEnabled: boolean;
    dailyQuestsEnabled: boolean;
    notificationDelaySeconds: number;
    adsEnabled: boolean;
    shopEnabled: boolean;
}

const DEFAULTS: Readonly<RuntimeConfig> = Object.freeze({
    dailyRewardsEnabled: true,
    dailyQuestsEnabled: true,
    notificationDelaySeconds: 86_400,
    adsEnabled: false,
    shopEnabled: false,
});

const RETURN_REMINDER_ID = "rundot-template-return-reminder";
const LEGACY_RETURN_REMINDER_ID = "template-pixi-return-reminder";

let config: RuntimeConfig = { ...DEFAULTS };
let nextRefreshTimer = 0;

function clearScheduledRefresh(): void {
    if (!nextRefreshTimer) return;
    window.clearTimeout(nextRefreshTimer);
    nextRefreshTimer = 0;
}

function normalize(values: Record<string, unknown>): RuntimeConfig {
    const root =
        values.runtime && typeof values.runtime === "object" ? (values.runtime as Record<string, unknown>) : values;
    const monetization =
        root.monetization && typeof root.monetization === "object"
            ? (root.monetization as Record<string, unknown>)
            : {};
    const delay = Number(root.notificationDelaySeconds);
    return {
        dailyRewardsEnabled: typeof root.dailyRewardsEnabled === "boolean" ? root.dailyRewardsEnabled : true,
        dailyQuestsEnabled: typeof root.dailyQuestsEnabled === "boolean" ? root.dailyQuestsEnabled : true,
        notificationDelaySeconds: Number.isFinite(delay) ? Math.max(3_600, Math.min(delay, 604_800)) : 86_400,
        adsEnabled: monetization.adsEnabled === true && isConfiguredPlatformId(PLATFORM_IDS.rewardedResultsBonus),
        // Gated on THIS game's catalog, not the template's starter bundle: the
        // shop rows read koi ids, so keying the flag to an unrelated id would
        // either hide a working shop or show a broken one.
        shopEnabled: monetization.shopEnabled === true && isConfiguredPlatformId(PLATFORM_IDS.heartsSmall),
    };
}

async function refreshLiveOps(): Promise<void> {
    clearScheduledRefresh();
    const snapshot = await fetchLiveOps();
    if (!snapshot) {
        config = { ...DEFAULTS };
        store.patch({ runtimeReady: true, runtimeConfigVersion: null });
        return;
    }
    config = normalize(snapshot.values);
    store.patch({ runtimeReady: true, runtimeConfigVersion: snapshot.configVersion });
    if (snapshot.nextChangeAt) {
        const delay = Math.max(1_000, Math.min(snapshot.nextChangeAt - Date.now() + 500, 2_147_000_000));
        nextRefreshTimer = window.setTimeout(() => startRefreshCycle(), delay);
    }
}

async function refreshTime(): Promise<void> {
    store.patch({ trustedTimeReady: await refreshServerTime() });
}

async function rearmNotifications(): Promise<void> {
    const state = store.get();
    if (!state.notificationsEnabled || state.notificationsConsent !== "granted") return;
    await rearmLocalNotification({
        id: RETURN_REMINDER_ID,
        legacyIds: [LEGACY_RETURN_REMINDER_ID],
        title: t("NotificationTitle"),
        body: t("NotificationReEngagementBody"),
        delaySeconds: config.notificationDelaySeconds,
    });
}

async function refreshRuntime(): Promise<void> {
    await Promise.allSettled([refreshTime(), refreshLiveOps()]);
    await rearmNotifications();
}

function startRefreshCycle(): void {
    void refreshRuntime().catch((error) => {
        console.warn("[runtime] background refresh failed", error);
    });
}

export const runtimeServices = {
    get config(): Readonly<RuntimeConfig> {
        return config;
    },
    bootstrap(): void {
        startRefreshCycle();
        this.track("game_boot", { version: packageJson.version, host: getRunCapabilities().host });
    },
    resume(): void {
        startRefreshCycle();
    },
    rearmNotifications(): void {
        void rearmNotifications().catch((error) => {
            console.warn("[runtime] notification refresh failed", error);
        });
    },
    track(eventName: string, payload: Record<string, unknown> = {}): void {
        void recordAnalytics(eventName, { ...payload, build_version: packageJson.version });
    },
    funnel(step: number, name: string, funnel: string, funnelOrder = 0): void {
        void recordFunnelStep(step, name, funnel, funnelOrder);
    },
    async haptic(style: HapticStyle): Promise<boolean> {
        return store.get().hapticsEnabled ? triggerHaptic(style) : false;
    },
    /** One free gift a day, paid for by a rewarded ad the player chose to watch. */
    async watchFreeGiftAd(): Promise<VerifiedActionResult> {
        if (!config.adsEnabled || !isConfiguredPlatformId(PLATFORM_IDS.rewardedFreeGift)) return "unavailable";
        return trackRewarded(PLATFORM_IDS.rewardedFreeGift, "Free Gift", "free_gift");
    },
    /**
     * The only non-opt-in ad, and it runs strictly between dates. Nothing
     * interrupts an evening in progress.
     */
    async showBetweenDatesAd(): Promise<VerifiedActionResult> {
        if (!config.adsEnabled || !isConfiguredPlatformId(PLATFORM_IDS.dateBreakInterstitial)) return "unavailable";
        // No forced ad in the first session, whatever the every-N-dates cadence
        // says. A new player who has not yet decided they like the game is the
        // worst possible audience for an interruption.
        if (getProfile().totalDates < FIRST_SESSION_DATE_GRACE) return "unavailable";
        const result = await showVerifiedInterstitialAd(PLATFORM_IDS.dateBreakInterstitial, "Between Dates");
        if (result === "verified") {
            this.track("interstitial_shown", { ad_display_id: PLATFORM_IDS.dateBreakInterstitial });
        }
        return result;
    },
    /** Buy anything in the shop catalog. */
    async purchaseShopItem(itemId: string, idempotencyKey: string): Promise<VerifiedActionResult> {
        if (!config.shopEnabled || !isConfiguredPlatformId(itemId)) return "unavailable";
        return purchaseVerifiedShopItem(itemId, idempotencyKey);
    },
    async watchResultsAd(): Promise<VerifiedActionResult> {
        // No ad before the first evening: the offer only makes sense with a
        // result on screen to double.
        if (getProfile().totalDates < 1) return "unavailable";
        if (!config.adsEnabled || !isConfiguredPlatformId(PLATFORM_IDS.rewardedResultsBonus)) return "unavailable";
        return trackRewarded(PLATFORM_IDS.rewardedResultsBonus, "Results Bonus", "results_bonus");
    },
};

/**
 * Interstitials stay off until the player has finished this many evenings.
 * Independent of AD_INTERSTITIAL_EVERY, which only spaces them out afterwards.
 */
const FIRST_SESSION_DATE_GRACE = 2;

/**
 * Show a rewarded ad and record the offer→complete pair.
 *
 * Both halves matter: `rewarded_ad_offered` without `rewarded_ad_complete` is a
 * placement players see and decline, which is a copy/reward problem, not an
 * inventory one. Only a resolved `granied` counts as complete — the wrapper
 * reports `cancelled` for a closed-early ad and `unavailable` for no inventory,
 * and neither earned the reward.
 */
async function trackRewarded(
    placementId: string,
    displayName: string,
    placement: string,
): Promise<VerifiedActionResult> {
    runtimeServices.track("rewarded_ad_offered", { ad_display_id: placementId, placement });
    const result = await showVerifiedRewardedAd(placementId, displayName);
    if (result === "verified") {
        runtimeServices.track("rewarded_ad_complete", { ad_display_id: placementId, placement });
    }
    return result;
}
