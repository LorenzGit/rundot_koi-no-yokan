/**
 * Typed RUN boundary. SDK 5.24 initializes on import; this facade waits only
 * for a bounded host handshake and keeps platform calls out of game/UI code.
 *
 * Posture (applies to ALL SDK usage): every RundotGameAPI call can reject,
 * and an unhandled rejection crashes the game — so everything here is
 * try/catch'd, and outside the RUN host (plain `vite dev` in a browser) the
 * app must boot and run anyway.
 */
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";
import { audioManager } from "../audio/audioManager.ts";
// Type-only import from the package root (the /api entry doesn't re-export it);
// erased at build time, so no extra runtime code is pulled in.
import { HapticFeedbackStyle } from "@series-inc/rundot-game-sdk";
import type { IdentityChangedEvent, Subscription } from "@series-inc/rundot-game-sdk";

let _ready = false;

export interface RunCapabilities {
    host: boolean;
    mock: boolean;
    storage: boolean;
    analytics: boolean;
    liveops: boolean;
    notifications: boolean;
    haptics: boolean;
    ads: boolean;
    purchases: boolean;
    subscriptions: boolean;
    leaderboard: boolean;
    engagement: boolean;
    social: boolean;
}

const OFFLINE_CAPABILITIES: RunCapabilities = {
    host: false,
    mock: false,
    storage: false,
    analytics: false,
    liveops: false,
    notifications: false,
    haptics: false,
    ads: false,
    purchases: false,
    subscriptions: false,
    leaderboard: false,
    engagement: false,
    social: false,
};

let capabilities: RunCapabilities = OFFLINE_CAPABILITIES;

function sdkNamespace(name: string): boolean {
    return typeof (RundotGameAPI as unknown as Record<string, unknown>)[name] === "object";
}

/**
 * PITFALL: there is NO runtime RundotGameAPI.haptics namespace (the
 * HapticsApi interface in the .d.ts is types-only). Support comes from
 * DeviceInfo, and the trigger lives on the API root. Read LIVE at every call
 * site that acts on it: `enabled` reflects the player's system setting, which
 * can change mid-session, and a cached false at boot must never gate a later
 * action.
 */
function hapticsAvailableNow(): boolean {
    if (!_ready) return false;
    try {
        const device = RundotGameAPI.system.getDevice();
        return device?.haptics?.supported === true && device?.haptics?.enabled === true;
    } catch {
        return false;
    }
}

function snapshotCapabilities(): RunCapabilities {
    if (!_ready) return OFFLINE_CAPABILITIES;
    const environment = RundotGameAPI._environmentData?.capabilities;
    return {
        host: true,
        mock: RundotGameAPI.isMock(),
        storage: sdkNamespace("appStorage"),
        analytics: sdkNamespace("analytics"),
        liveops: sdkNamespace("liveops"),
        notifications: sdkNamespace("notifications"),
        haptics: hapticsAvailableNow(),
        ads: environment?.ads === true,
        purchases: environment?.purchases === true,
        subscriptions: environment?.subscriptions === true,
        leaderboard: sdkNamespace("leaderboard"),
        engagement: sdkNamespace("popups"),
        social: sdkNamespace("social"),
    };
}

export function getRunCapabilities(): Readonly<RunCapabilities> {
    return capabilities;
}

/**
 * Re-read host capabilities. Wired to onAwake (the SDK's "refresh stale data"
 * hook) so a session that started before a grant or attach does not stay
 * frozen on its boot snapshot.
 */
export function refreshRunCapabilities(): Readonly<RunCapabilities> {
    capabilities = snapshotCapabilities();
    return capabilities;
}

export interface RunSafeArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const ZERO_SAFE_AREA: Readonly<RunSafeArea> = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function normalizeSafeArea(area: Partial<RunSafeArea>): RunSafeArea {
    return {
        top: Math.max(0, Number(area.top) || 0),
        right: Math.max(0, Number(area.right) || 0),
        bottom: Math.max(0, Number(area.bottom) || 0),
        left: Math.max(0, Number(area.left) || 0),
    };
}

function readViewDeckSafeArea(): RunSafeArea | null {
    const serialized = document.documentElement.dataset.viewdeckSafeArea;
    if (!serialized) return null;
    try {
        return normalizeSafeArea(JSON.parse(serialized) as Partial<RunSafeArea>);
    } catch {
        return null;
    }
}

export function getRunSafeArea(): Readonly<RunSafeArea> {
    // ViewDeck's oriented values are authoritative during device simulation.
    // The SDK's local mock can retain portrait env() values after rotation.
    const viewDeckArea = readViewDeckSafeArea();
    if (viewDeckArea) return viewDeckArea;
    if (!_ready) return ZERO_SAFE_AREA;
    try {
        return normalizeSafeArea(RundotGameAPI.system.getSafeArea());
    } catch {
        return ZERO_SAFE_AREA;
    }
}

/** Publish the resolved device insets without coupling UI code to the source. */
export function applyRunSafeArea(): Readonly<RunSafeArea> {
    const viewDeckArea = readViewDeckSafeArea();
    const root = document.documentElement;
    if (import.meta.env.DEV) {
        const count = Number(root.dataset.safeAreaRefreshCount ?? 0);
        root.dataset.safeAreaRefreshCount = String(count + 1);
    }
    if (viewDeckArea) {
        // Keep ViewDeck's properties live so rotation never copies a stale
        // portrait snapshot into the higher-priority inline --safe-* values.
        for (const edge of ["top", "right", "bottom", "left"]) {
            root.style.removeProperty(`--safe-${edge}`);
        }
        return viewDeckArea;
    }
    const area = getRunSafeArea();
    // Outside RUN, preserve the ViewDeck/browser stylesheet fallback chain.
    if (!_ready) return area;
    root.style.setProperty("--safe-top", `${area.top}px`);
    root.style.setProperty("--safe-right", `${area.right}px`);
    root.style.setProperty("--safe-bottom", `${area.bottom}px`);
    root.style.setProperty("--safe-left", `${area.left}px`);
    return area;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs = 2_000, label = "RUN operation"): Promise<T> {
    let timeoutId = 0;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        window.clearTimeout(timeoutId);
    }
}

/** True once the import-initialized SDK reports an attached host/mock. */
export function sdkReady(): boolean {
    return _ready;
}

/**
 * SDK 5.24 initializes on import. In a RUN iframe, allow a short bounded
 * handshake; in ordinary local development return immediately.
 */
export async function initSdk(): Promise<boolean> {
    const embedded = window.parent !== window;
    const deadline = performance.now() + (embedded ? 1_500 : 0);
    do {
        try {
            if (RundotGameAPI.isAvailable() || RundotGameAPI.isMock()) {
                _ready = true;
                break;
            }
        } catch {
            break;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    } while (performance.now() < deadline);

    capabilities = snapshotCapabilities();
    if (!_ready) {
        console.info("[runSdk] RUN host unavailable; using local non-authoritative fallbacks");
        // Inside an iframe the host is expected — a cold WebView can simply be
        // slower than the bounded handshake. Keep watching so a late attach
        // upgrades this session instead of stranding it offline until relaunch.
        if (embedded) watchForLateHostAttach();
    }
    return _ready;
}

function watchForLateHostAttach(): void {
    const deadline = performance.now() + 30_000;
    const watcher = window.setInterval(() => {
        try {
            if (RundotGameAPI.isAvailable() || RundotGameAPI.isMock()) {
                window.clearInterval(watcher);
                _ready = true;
                capabilities = snapshotCapabilities();
                applyRunSafeArea();
                console.info("[runSdk] RUN host attached after the boot handshake; capabilities refreshed");
                return;
            }
        } catch {
            window.clearInterval(watcher);
            return;
        }
        if (performance.now() >= deadline) window.clearInterval(watcher);
    }, 500);
}

export async function readAppStorage(key: string): Promise<{ ok: boolean; value: string | null }> {
    if (!capabilities.storage) return { ok: false, value: null };
    try {
        const value = await withTimeout(RundotGameAPI.appStorage.getItem(key), 2_000, "appStorage.getItem");
        return { ok: true, value };
    } catch (error) {
        console.warn("[runSdk] appStorage read failed", error);
        return { ok: false, value: null };
    }
}

export async function writeAppStorage(key: string, value: string): Promise<boolean> {
    if (!capabilities.storage) return false;
    try {
        await withTimeout(RundotGameAPI.appStorage.setItem(key, value), 2_000, "appStorage.setItem");
        return true;
    } catch (error) {
        console.warn("[runSdk] appStorage write failed", error);
        return false;
    }
}

export async function requestServerEpochMs(): Promise<number | null> {
    if (!_ready) return null;
    try {
        const result = await withTimeout(RundotGameAPI.requestTimeAsync(), 2_000, "requestTimeAsync");
        return typeof result.serverTime === "number" ? result.serverTime : null;
    } catch (error) {
        console.warn("[runSdk] trusted time unavailable", error);
        return null;
    }
}

export type NotificationPreferenceResult = "enabled" | "disabled" | "unavailable" | "failed";

export async function setNotificationPreference(enabled: boolean): Promise<NotificationPreferenceResult> {
    if (!capabilities.notifications) return "unavailable";
    try {
        await withTimeout(
            RundotGameAPI.notifications.setLocalNotificationsEnabled(enabled),
            4_000,
            "notifications.setLocalNotificationsEnabled",
        );
        const actual = await withTimeout(
            RundotGameAPI.notifications.isLocalNotificationsEnabled(),
            2_000,
            "notifications.isLocalNotificationsEnabled",
        );
        if (actual !== enabled) return "failed";
        return enabled ? "enabled" : "disabled";
    } catch (error) {
        console.warn("[runSdk] notification preference failed", error);
        return "failed";
    }
}

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export async function triggerHaptic(style: HapticStyle): Promise<boolean> {
    // Live read, not the boot snapshot: the player can flip the system haptics
    // setting mid-session and the next trigger must honor it.
    if (hapticsAvailableNow()) {
        try {
            const map: Record<HapticStyle, HapticFeedbackStyle> = {
                light: HapticFeedbackStyle.Light,
                medium: HapticFeedbackStyle.Medium,
                heavy: HapticFeedbackStyle.Heavy,
                success: HapticFeedbackStyle.Success,
                warning: HapticFeedbackStyle.Warning,
                error: HapticFeedbackStyle.Error,
            };
            await withTimeout(RundotGameAPI.triggerHapticAsync(map[style]), 1_000, "triggerHapticAsync");
            return true;
        } catch {
            // fall through to the web-vibration fallback
        }
    }
    // Outside a haptics-capable host: navigator.vibrate covers Android web;
    // iOS Safari has no vibration API, so this is a silent no-op there.
    try {
        const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
        if (typeof nav.vibrate === "function") {
            const patterns: Record<HapticStyle, number | number[]> = {
                light: 10,
                medium: 20,
                heavy: 40,
                success: [15, 40, 15],
                warning: [25, 40, 25],
                error: [35, 50, 35],
            };
            return nav.vibrate(patterns[style]);
        }
    } catch {
        // no vibration surface — fine
    }
    return false;
}

export interface RunLiveOpsSnapshot {
    values: Record<string, unknown>;
    configVersion: string;
    nextChangeAt: number | null;
    activeOverrideIds: string[];
}

export async function fetchLiveOps(): Promise<RunLiveOpsSnapshot | null> {
    if (!capabilities.liveops) return null;
    try {
        const result = await withTimeout(RundotGameAPI.liveops.getConfigAsync(), 3_000, "liveops.getConfigAsync");
        return {
            values: result.values,
            configVersion: result.configVersion,
            nextChangeAt: result.nextChangeAt,
            activeOverrideIds: result.activeOverrideIds,
        };
    } catch (error) {
        console.warn("[runSdk] LiveOps unavailable; defaults retained", error);
        return null;
    }
}

export async function recordAnalytics(eventName: string, payload: Record<string, unknown> = {}): Promise<boolean> {
    if (!capabilities.analytics) return false;
    try {
        await withTimeout(
            RundotGameAPI.analytics.recordCustomEvent(eventName, payload),
            1_500,
            "analytics.recordCustomEvent",
        );
        return true;
    } catch {
        return false;
    }
}

export async function recordFunnelStep(step: number, name: string, funnel: string, funnelOrder = 0): Promise<boolean> {
    if (!capabilities.analytics) return false;
    try {
        await withTimeout(
            RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, funnelOrder),
            1_500,
            "analytics.trackFunnelStep",
        );
        return true;
    } catch {
        return false;
    }
}

export async function rearmLocalNotification(input: {
    id: string;
    legacyIds?: readonly string[];
    title: string;
    body: string;
    delaySeconds: number;
}): Promise<boolean> {
    if (!capabilities.notifications) return false;
    try {
        for (const id of new Set([input.id, ...(input.legacyIds ?? [])])) {
            await withTimeout(RundotGameAPI.notifications.cancelNotification(id), 1_500, "notifications.cancel");
        }
        const result = await withTimeout(
            RundotGameAPI.notifications.submitMessageAsync({
                channels: ["local"],
                title: input.title,
                body: input.body,
                delaySeconds: Math.max(60, input.delaySeconds),
                notificationId: input.id,
                collapseKey: input.id,
            }),
            3_000,
            "notifications.submitMessage",
        );
        return result.results.some((channel) => channel.channel === "local" && channel.status === "scheduled");
    } catch (error) {
        console.warn("[runSdk] notification re-arm failed", error);
        return false;
    }
}

export type VerifiedActionResult = "verified" | "unavailable" | "cancelled" | "failed";

let hostOverlayCount = 0;

export function hostOverlayInFlight(): boolean {
    return hostOverlayCount > 0;
}

export async function withHostOverlay<T>(operation: () => Promise<T>): Promise<T> {
    hostOverlayCount += 1;
    audioManager.setHostOverlayVisible(true);
    try {
        return await operation();
    } finally {
        hostOverlayCount = Math.max(0, hostOverlayCount - 1);
        audioManager.setHostOverlayVisible(hostOverlayCount > 0);
    }
}

/**
 * Budget for an ad-readiness probe.
 *
 * On web the host answers this from the ad SDK, which on a cold first call
 * waits out its consent manager (~5s) and then loads the ad script (~5s). The
 * old 2s budget expired during that first probe and reported "no ad available"
 * on a host that was merely still warming up — while every later probe, served
 * from the host's cache, returned instantly. That is what made rewarded ads
 * work only sometimes.
 */
const AD_READY_TIMEOUT_MS = 12_000;

export async function showVerifiedRewardedAd(id: string, name: string): Promise<VerifiedActionResult> {
    if (!capabilities.ads) return "unavailable";
    try {
        const ready = await withTimeout(RundotGameAPI.ads.isRewardedAdReadyAsync(), AD_READY_TIMEOUT_MS, "ads.ready");
        if (!ready) return "unavailable";
        // Do not timeout a user-mediated overlay: the audio interruption
        // must last until the host tells us it has actually closed.
        const completed = await withHostOverlay(() =>
            RundotGameAPI.ads.showRewardedAdAsync({ adDisplayId: id, adDisplayName: name }),
        );
        return completed === true ? "verified" : "cancelled";
    } catch {
        return "failed";
    }
}

export async function showVerifiedInterstitialAd(id: string, name: string): Promise<VerifiedActionResult> {
    if (!capabilities.ads) return "unavailable";
    try {
        const ready = await withTimeout(
            RundotGameAPI.ads.isInterstitialAdReadyAsync(),
            AD_READY_TIMEOUT_MS,
            "ads.interstitial.ready",
        );
        if (!ready) return "unavailable";
        const displayed = await withHostOverlay(() =>
            RundotGameAPI.ads.showInterstitialAd({ adDisplayId: id, adDisplayName: name }),
        );
        return displayed === true ? "verified" : "unavailable";
    } catch {
        return "failed";
    }
}

export async function purchaseVerifiedShopItem(itemId: string, idempotencyKey: string): Promise<VerifiedActionResult> {
    if (!capabilities.purchases || !sdkNamespace("shop")) return "unavailable";
    try {
        const result = await withHostOverlay(() => RundotGameAPI.shop.purchase(itemId, idempotencyKey));
        // `success` only reports that the host accepted the request. Replaying
        // an idempotency key returns the ORIGINAL order verbatim, so an order
        // still in "pending_payment" also arrives as "success: true" — granting
        // on that would hand over an unpaid purchase.
        return result.success === true && result.order?.status === "fulfilled" ? "verified" : "failed";
    } catch {
        return "failed";
    }
}

export interface LeaderboardSubmission {
    accepted: boolean;
    rank: number | null;
    reason: string | null;
}

/** Submit only at completed-date milestones; rejected keep-best scores are not retried. */
export async function submitLeaderboardScore(
    score: number,
    durationSeconds: number,
    metadata: Record<string, string | number | boolean>,
): Promise<LeaderboardSubmission | null> {
    if (!capabilities.leaderboard) return null;
    try {
        const result = await withTimeout(
            RundotGameAPI.leaderboard.submitScore({
                score: Math.max(0, Math.floor(score)),
                duration: Math.max(1, Math.floor(durationSeconds)),
                metadata,
            }),
            4_000,
            "leaderboard.submitScore",
        );
        return {
            accepted: result.accepted === true,
            rank: result.accepted && typeof result.rank === "number" ? result.rank : null,
            reason: result.accepted ? null : (result.reason ?? null),
        };
    } catch (error) {
        console.warn("[runSdk] leaderboard submit failed", error);
        return null;
    }
}

export type LikePromptResult = "liked" | "dismissed" | "already_liked" | "unavailable" | "failed";

/** Contextual prompt only; callers invoke this from a deliberate result-screen tap. */
export async function showLikePrompt(): Promise<LikePromptResult> {
    if (!capabilities.engagement) return "unavailable";
    try {
        const state = await withTimeout(RundotGameAPI.popups.getLikeState(), 2_000, "popups.getLikeState");
        if (state.isLiked) return "already_liked";
        const available = await withTimeout(
            RundotGameAPI.popups.canShowLikeDialog(),
            2_000,
            "popups.canShowLikeDialog",
        );
        if (!available.available) return "unavailable";
        const result = await withHostOverlay(() => RundotGameAPI.popups.showLikeDialog());
        if (!result.shown) return "unavailable";
        return result.liked ? "liked" : "dismissed";
    } catch (error) {
        console.warn("[runSdk] Like prompt failed", error);
        return "failed";
    }
}

export type ShareResult = "shared" | "dismissed" | "unavailable" | "failed";
export type DateCardExportResult = "native_opened" | "browser_download" | "cancelled" | "failed";

/**
 * Opens the platform file sheet when available. Callers own the direct browser
 * download fallback so the UI can describe where the file is actually going.
 */
export async function exportDateCard(input: {
    card: Blob;
    filename: string;
    title: string;
    text: string;
}): Promise<DateCardExportResult> {
    if (!capabilities.social) return "browser_download";
    try {
        const support = await withTimeout(RundotGameAPI.social.canShareFileAsync(), 2_000, "social.canShareFileAsync");
        if (!support.supported) return "browser_download";
        const result = await withHostOverlay(() =>
            RundotGameAPI.social.shareFileAsync({
                data: input.card,
                filename: input.filename,
                mimeType: "image/png",
                title: input.title,
                text: input.text,
            }),
        );
        return result.cancelled ? "cancelled" : "native_opened";
    } catch (error) {
        console.warn("[runSdk] date-card export failed", error);
        return "failed";
    }
}

/**
 * Opens RUN's social composer with both the generated result card and a
 * tracked deep link. This is deliberately one host operation: players choose
 * the destination and review the post before anything leaves the game.
 */
export async function shareDateResult(input: {
    personId: string;
    personName: string;
    affection: number;
    spark: number;
    romanceScore: number;
    card: Blob;
    filename: string;
    caption: string;
}): Promise<ShareResult> {
    if (!capabilities.social) return "unavailable";
    try {
        const result = await withHostOverlay(() =>
            RundotGameAPI.social.composeSocialPostAsync({
                text: input.caption,
                shareParams: {
                    kind: "koi_date_result",
                    person: input.personId,
                    affection: String(Math.max(0, Math.floor(input.affection))),
                    spark: String(Math.max(0, Math.floor(input.spark))),
                    romance_score: String(Math.max(0, Math.floor(input.romanceScore))),
                },
                media: {
                    data: input.card,
                    filename: input.filename,
                    mimeType: "image/png",
                },
                metadata: {
                    title: `A date with ${input.personName} in Koi no Yokan`,
                    description: input.caption,
                },
                title: `My date with ${input.personName} in Koi no Yokan`,
            }),
        );
        return result.completed ? "shared" : "dismissed";
    } catch (error) {
        console.warn("[runSdk] result share failed", error);
        return "failed";
    }
}

/** Continue Android back navigation once the template's own stack is empty. */
export async function requestHostExit(reason = "template-root-back"): Promise<boolean> {
    if (!_ready) return false;
    try {
        return await withTimeout(RundotGameAPI.requestPopOrQuit({ reason }), 4_000, "requestPopOrQuit");
    } catch (error) {
        console.warn("[runSdk] host exit request failed", error);
        return false;
    }
}

/**
 * Lifecycle callbacks are `() => void` per the SDK types. Async handlers are
 * fine to pass: a Promise-returning function is assignable where a void
 * return is expected (the SDK just won't await it).
 */
export type LifecycleCallback = () => void;

/** All seven hooks are optional. See registerLifecycles for what each means. */
export interface LifecycleConfig {
    onPause?: LifecycleCallback;
    onResume?: LifecycleCallback;
    onSleep?: LifecycleCallback;
    onAwake?: LifecycleCallback;
    onQuit?: LifecycleCallback;
    onBackButton?: LifecycleCallback;
    onIdentityChanged?: (event: IdentityChangedEvent) => void;
}

/**
 * Register host lifecycle callbacks. All seven hooks are optional; each SDK
 * hook returns an { unsubscribe() } handle, collected so hot-reload / scene
 * swaps can detach cleanly.
 *
 * Hook meanings (SDK docs):
 *   onPause/onResume — host overlay or brief focus loss: pause/resume loops + audio
 *   onSleep/onAwake  — long background suspend: persist progress / refresh stale data
 *   onQuit           — host teardown: last-chance flush (may NOT fire on hard close)
 *   onBackButton     — Android back button (no-op elsewhere); without a handler the
 *                      host quits by default — call RundotGameAPI.requestPopOrQuit()
 *                      yourself when your in-game back navigation is exhausted
 */
export function registerLifecycles({
    onPause,
    onResume,
    onSleep,
    onAwake,
    onQuit,
    onBackButton,
    onIdentityChanged,
}: LifecycleConfig = {}): { unsubscribeAll(): void } {
    const subs: Subscription[] = [];
    const hook = (name: keyof LifecycleConfig, cb: LifecycleCallback | undefined) => {
        if (!cb) return;
        try {
            subs.push(RundotGameAPI.lifecycles[name](cb));
        } catch (err) {
            console.warn(`[runSdk] lifecycles.${name} registration failed`, err);
        }
    };
    hook("onPause", onPause);
    hook("onResume", onResume);
    hook("onSleep", onSleep);
    hook("onAwake", onAwake);
    hook("onQuit", onQuit);
    hook("onBackButton", onBackButton);
    if (onIdentityChanged) {
        try {
            subs.push(RundotGameAPI.lifecycles.onIdentityChanged(onIdentityChanged));
        } catch (error) {
            console.warn("[runSdk] lifecycles.onIdentityChanged registration failed", error);
        }
    }
    return {
        unsubscribeAll() {
            for (const s of subs) {
                try {
                    s?.unsubscribe?.();
                } catch {
                    /* already gone */
                }
            }
            subs.length = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Return-reminder support. Kept beside the other notification calls so the
// retention module never talks to RundotGameAPI directly.
// ---------------------------------------------------------------------------

/** True once the player has granted local-notification permission. */
export async function notificationsEnabled(): Promise<boolean> {
    try {
        return (await RundotGameAPI.notifications.isLocalNotificationsEnabled()) === true;
    } catch {
        return false;
    }
}

/** Cancel a scheduled reminder once the thing it promised has been done. */
export async function cancelLocalNotification(id: string): Promise<void> {
    try {
        await RundotGameAPI.notifications.cancelNotification(id);
    } catch {
        // a reminder that will not cancel must not break the beat that
        // completed the task it was promising
    }
}

/**
 * How this session was launched. `timed_out` is treated as unknown rather than
 * organic, so notification attribution never over-counts cold starts.
 */
export async function resolveLaunchIntent(): Promise<{ kind: string; params: Record<string, string> } | null> {
    try {
        const intent = await RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 });
        if (!intent || intent.kind === "timed_out") return null;
        return { kind: intent.kind, params: intent.params ?? {} };
    } catch {
        return null;
    }
}
