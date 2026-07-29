/**
 * PLACEHOLDERS — but know where each id actually comes from:
 *
 * - gameId: written by `rundot init` (also in game.config.prod.json).
 * - Ad placement ids: SELF-AUTHORED plain strings passed as `adDisplayId` to
 *   showRewardedAdAsync/showInterstitialAd. There is NO platform-side
 *   "create a placement" step — invent a stable name and ship it.
 * - Shop item / entitlement ids: SELF-AUTHORED in rundot/shop.config.json,
 *   which registers the catalog at deploy. Use those exact strings here.
 *
 * Nothing here waits on a dashboard. Untouched REPLACE_WITH_ values fail
 * closed (surfaces hide), so fill them when the surfaces should go live —
 * and ship rundot/liveops.config.json with the enable flags, or default-off
 * LiveOps gating will keep everything dark even with real ids. Working
 * Keep this registry as the single source of truth so configured surfaces do
 * not drift away from their deployed server configuration.
 */
export const PLATFORM_IDS = Object.freeze({
    gameId: "REPLACE_WITH_RUN_GAME_ID",

    // Ad placements are self-authored plain strings — no dashboard step — so
    // these are live as written.
    rewardedResultsBonus: "koi_double_hearts_rewarded",
    rewardedFreeGift: "koi_free_gift_rewarded",
    dateBreakInterstitial: "koi_between_dates_interstitial",

    // Shop items and entitlements must match rundot/shop.config.json, which
    // registers the catalog at deploy. They stay REPLACE_WITH_ until that
    // deploy has happened: every surface that reads them fails closed, so the
    // shop simply does not show purchase rows until the catalog is real.
    // Shop items and entitlements must match rundot/shop.config.json, which
    // registers the catalog at deploy.
    heartsSmall: "koi_hearts_400",
    heartsMedium: "koi_hearts_800",
    heartsLarge: "koi_hearts_1600",
    heartsHuge: "koi_hearts_2400",
    heartsMega: "koi_hearts_4000",
    heartsUltra: "koi_hearts_8000",
    firstDateKit: "koi_first_date_kit",
    romanticBundle: "koi_romantic_bundle",
    confidantPass: "koi_confidant",
    confidantEntitlement: "koi_entitlement_confidant",
    // Matches rundot/shop.config.json. Live as written — the surface still
    // gates on runtimeServices.shopEnabled (LiveOps + catalog), so it only
    // lights up once the shop is genuinely reachable.
    postcard: "koi_postcard",
});

export function isConfiguredPlatformId(value: string): boolean {
    return value.length > 0 && !value.startsWith("REPLACE_WITH_");
}
