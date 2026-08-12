import packageJson from "../../package.json";
import { PLATFORM_IDS, isConfiguredPlatformId } from "../config/platform.ts";
import { getProfile } from "../state/profile.ts";
import {
    fetchLiveOps,
    getRunCapabilities,
    purchaseVerifiedShopItem,
    cancelLocalNotification,
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
import { returnReminders } from "./retention/retentionConfig.ts";

export interface RuntimeConfig {
    dailyRewardsEnabled: boolean;
    dailyQuestsEnabled: boolean;
    adsEnabled: boolean;
    shopEnabled: boolean;
}

// The return-reminder cadence is deliberately NOT remoteable: it is fixed at
// 24/48/72h in returnReminders.ts. A notificationDelaySeconds knob sat here
// and fed a second generic reminder on top of that cadence — two tracks, so
// players could be pinged twice.
const DEFAULTS: Readonly<RuntimeConfig> = Object.freeze({
    dailyRewardsEnabled: true,
    dailyQuestsEnabled: true,
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
    return {
        dailyRewardsEnabled: typeof root.dailyRewardsEnabled === "boolean" ? root.dailyRewardsEnabled : true,
        dailyQuestsEnabled: typeof root.dailyQuestsEnabled === "boolean" ? root.dailyQuestsEnabled : true,
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
        // KEEP the live config on a failed fetch: resetting to DEFAULTS here
        // yanked an enabled shop/ads surface for the rest of the session on a
        // single resume-time network blip. Retry only where a host could
        // actually answer — without the capability this null is permanent.
        store.patch({ runtimeReady: true });
        if (getRunCapabilities().liveops) {
            nextRefreshTimer = window.setTimeout(() => startRefreshCycle(), 60_000);
        }
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

/**
 * Re-anchor the whole 24/48/72h return cadence to now.
 *
 * This replaced a single 24h reminder. One ping gives a player exactly one
 * chance to come back; a short cadence gives three without becoming spam, and
 * stopping at 72h is deliberate — a fourth converts nobody and costs the
 * notification permission the first three depend on.
 */
async function rearmNotifications(): Promise<void> {
    const state = store.get();
    if (!state.notificationsEnabled || state.notificationsConsent !== "granted") return;
    // The pre-cadence reminder used its own id; leave it scheduled and the
    // player gets the old generic ping alongside the new specific ones.
    for (const legacy of [RETURN_REMINDER_ID, LEGACY_RETURN_REMINDER_ID]) {
        await cancelLocalNotification(legacy);
    }
    await returnReminders.refreshAll();
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
