import { addAnalyticsMark, getProfile, hasAnalyticsMark, removeAnalyticsMark } from "../../state/profile.ts";
import { recordAnalytics, recordFunnelStep } from "../../sdk/runSdk.ts";
import packageJson from "../../../package.json";
import { countedSteps, createAnalytics } from "./analytics.ts";

/**
 * Koi no Yokan funnel registry.
 *
 * This game was previously firing only `game_boot` and `game_heartbeat`, so
 * everything past load was invisible: a player who bounced at the avatar
 * picker and one who finished three dates produced the same data. The steps
 * below are the actual beats of a first evening.
 *
 * The funnel name and step 1 are UNCHANGED from what shipped (`game_loaded`
 * in `koi_first_play`) — renaming a live funnel discards its trend line.
 *
 * Step names and numbers are frozen: add new beats at the end, never renumber.
 */
export const analytics = createAnalytics({
    emitEvent: (name, payload) => {
        void recordAnalytics(name, { ...payload, build_version: packageJson.version });
    },
    // Return the promise so once-ever marks persist only on confirmed
    // delivery — recordFunnelStep resolves false on timeout or RPC failure.
    emitFunnelStep: (step, name, funnel, order) => recordFunnelStep(step, name, funnel, order),
    funnels: {
        /**
         * The loading phase itself, ahead of the first-run funnel (order 0).
         *
         * The first-run funnel starts at "the game finished loading", so a player
         * who closed the tab during boot never appeared in it at all — a load
         * regression and a retention problem looked identical. Step 1 fires on the
         * first executable line, before any await, and is buffered until the SDK
         * transport is up.
         *
         * A separate funnel rather than steps prepended to the existing one,
         * because shipped step numbers must never be renumbered.
         */
        load: {
            order: 0,
            steps: [
                "load_started", // first line of script execution
                "load_sdk_ready", // host handshake resolved
                "load_save_ready", // progress restored
                "load_assets_ready", // playable frame reachable
            ],
        },
        koi_first_play: {
            order: 1,
            onceEver: true,
            steps: [
                "game_loaded", // shipped step 1 — name and number preserved
                "avatar_chosen", // first real choice, before any date
                "first_date_planned", // picked a partner and a place
                "first_date_started", // the scene actually opened
                "first_date_finished", // saw an evening through — the "I get it" beat
                "first_result_viewed", // read the outcome
                "second_date_planned", // came back for another evening
            ],
        },
        /** Just-in-time first-date coaching, separate from the frozen shipped funnel. */
        date_tutorial: {
            order: 2,
            onceEver: true,
            steps: ["first_move_played", "tension_tip_completed", "topic_tip_completed"],
        },
        // Repeatable: how deep players get across their first 12 dates.
        engagement: { order: 3, steps: countedSteps("date_finished_", 12) },
        /**
         * Store conversion. Repeatable (not onceEver): a player can buy more
         * than once, and each pass through the shop should count.
         */
        purchase: {
            order: 4,
            steps: [
                "shop_item_viewed", // the offer list was actually seen
                "shop_item_click_purchase", // a specific offer was chosen
                "checkout_started", // the host purchase sheet was requested
                "purchase_complete", // the host confirmed and the grant landed
            ],
        },
    },
    onceMarks: {
        has: hasAnalyticsMark,
        add: addAnalyticsMark,
        remove: removeAnalyticsMark,
    },
    enrich: () => {
        const profile = getProfile();
        return {
            total_dates: profile.totalDates,
            coins: profile.coins,
        };
    },
    marksKey: "koi_no_yokan_funnel_marks",
    debug: import.meta.env.DEV,
});

/** The funnel whose steps this game's first session is measured by. */
export const FIRST_PLAY_FUNNEL = "koi_first_play";
