/**
 * The hub. It used to be a header, a one-line "no partner" strip and a menu
 * pinned to the bottom, which left the whole middle of the screen empty on a
 * fresh save — it read as a loading failure rather than a design.
 *
 * Now the middle is a stage: the character you chose to be stands on it, and
 * beside them is the partner slot — either the person you are going steady
 * with, or an empty outline you can tap to go and fill. The void becomes an
 * invitation, and the cast art gets used somewhere other than the date itself.
 *
 * The two figures are scaled against each other by their real heightCm (the
 * same numbers the sprite pipeline measures against), so standing side by side
 * they keep the height difference the art was built for.
 */
import { useEffect } from "react";
import { store, useStore } from "../../state/store.ts";
import { CAST_BY_ID, LOCATIONS, affectionTier } from "../../game/data/world.ts";
import {
    armReturnReward,
    breakUp,
    claimReturnReward,
    currentPartner,
    returnRewardStatus,
    totalAffection,
} from "../../state/profile.ts";
import { useProfile } from "./useProfile.ts";
import Icon from "./icons.tsx";
import PetalFall from "./PetalFall.tsx";
import { canUseTimeGates, localDayKey, serverNow } from "../../systems/serverTime.ts";
import { analytics } from "../../systems/analytics/analyticsConfig.ts";

/**
 * Both cutouts are trimmed crown-to-sole, so letting each fill the art box
 * would render everyone the same height. The tallest person keeps the box; the
 * other is scaled about their soles by the real height ratio.
 *
 * A transform rather than a percentage height on purpose — percentage heights
 * inside a flex column depend on the parent resolving a definite height, and
 * when it does not the image falls back to its intrinsic size and blows the
 * layout apart. A scale factor cannot fail that way.
 */
function relativeScale(cm: number | undefined, tallest: number): React.CSSProperties {
    if (!cm || !tallest || cm >= tallest) return {};
    return { transform: `scale(${(cm / tallest).toFixed(3)})` };
}

export default function HomeScreen() {
    const profile = useProfile();
    const trustedTimeReady = useStore((state) => state.trustedTimeReady);
    const partner = currentPartner();
    const met = Object.values(profile.people).length;
    const affection = totalAffection();
    const nextLocation = LOCATIONS.find((location) => location.unlockAt > affection);
    const dayKey = trustedTimeReady || canUseTimeGates() ? localDayKey(serverNow()) : null;
    const returnReward = dayKey ? returnRewardStatus(dayKey) : null;

    // Normally armed at date completion. This second path covers a very fast
    // first date that finished before host server time became available.
    useEffect(() => {
        if (!dayKey || profile.totalDates < 1 || profile.lastReturnRewardDay) return;
        armReturnReward(dayKey);
    }, [dayKey, profile.lastReturnRewardDay, profile.totalDates]);

    const you = profile.avatar ? CAST_BY_ID[profile.avatar] : undefined;
    const them = partner ? CAST_BY_ID[partner.id] : undefined;
    const tallest = Math.max(you?.heightCm ?? 0, them?.heightCm ?? 0);

    return (
        <main className="koi-screen koi-home">
            <div className="koi-menu-bg" aria-hidden="true" />
            <PetalFall />

            {/* No title. The game names itself on the screen where you choose
                who to be; repeating it on the hub only ate a row of the short
                axis. Your balance is the one thing this bar has to carry. */}
            <header className="koi-header koi-header-bare">
                <span className="koi-coins">♡ {profile.coins}</span>
            </header>

            {/* Art and name plates are siblings, not figure/figcaption pairs.
                Grid rows then give the two figures one shared floor line and
                the two plates one shared baseline for free — and, unlike the
                display:contents trick that would let a caption cross into
                another column, every box here is a real box. WebKit computes a
                display:contents subtree as fully visible and then declines to
                paint the block-level children inside it. */}
            <section className="koi-stage">
                {you && (
                    <>
                        <span className="koi-stage-art koi-art-you">
                            <img
                                src={`images/cast/${you.id}_figure.png`}
                                alt={you.name}
                                style={relativeScale(you.heightCm, tallest)}
                            />
                        </span>
                        {/* The only way back to the character picker. Choosing
                            who to be happens in the first ten seconds, before
                            you know anything about the game, and their colour
                            themes the whole app from then on — so it cannot be
                            a one-time decision with no way out. */}
                        <button
                            type="button"
                            className="koi-stage-plate koi-plate-you"
                            style={{ "--koi-char": you.color } as React.CSSProperties}
                            onClick={() => store.patch({ koiScreen: "avatar" })}
                            aria-label={`You are ${you.name}. Change character.`}
                        >
                            <span className="koi-stage-label">You</span>
                            <strong>{you.name}</strong>
                            <span className="koi-plate-hint">tap to change</span>
                        </button>
                    </>
                )}

                {/* Keyed off `partner` alone, never off the cast lookup: a saved
                    profile can name someone the current cast no longer defines
                    (ids have been renamed before — see LEGACY_AVATAR). Requiring
                    the lookup made the partner vanish into the empty slot while
                    the Little Black Book still listed them. */}
                {partner ? (
                    <>
                        <span className="koi-stage-art koi-art-them">
                            {them && (
                                <img
                                    src={`images/cast/${them.id}_figure.png`}
                                    alt={them.name}
                                    style={relativeScale(them.heightCm, tallest)}
                                />
                            )}
                        </span>
                        <div
                            className="koi-stage-plate koi-plate-them"
                            style={{ "--koi-char": them?.color } as React.CSSProperties}
                        >
                            <span className="koi-stage-label">Going steady with</span>
                            <strong>{them?.name ?? partner.id}</strong>
                            <span className="koi-stage-tier">
                                {affectionTier(partner.affection)} · {partner.affection}♥
                            </span>
                            <button type="button" className="koi-link" onClick={() => breakUp(partner.id)}>
                                End it
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        className="koi-stage-empty"
                        onClick={() => store.patch({ koiScreen: "plan" })}
                    >
                        <span className="koi-stage-silhouette" aria-hidden="true">
                            ♡
                        </span>
                        <span className="koi-stage-label">Nobody here yet</span>
                        <strong>Go and meet someone</strong>
                    </button>
                )}

                {/* Inside the stage, not beside it: rotated, this belongs in the
                    middle column under your name, and a sibling of the stage
                    could only ever be placed against the page grid. */}
                <div className="koi-stats-row">
                    <span>{met} met</span>
                    <span>{profile.totalDates} dates</span>
                    <span>{affection} total ♥</span>
                </div>
            </section>

            <nav className="koi-menu">
                {returnReward?.claimable && dayKey && (
                    <button
                        type="button"
                        className="koi-return-reward"
                        onClick={() => {
                            const claimed = claimReturnReward(dayKey);
                            analytics.event("reward_granted", {
                                reward_type: "daily_return",
                                amount: claimed.amount,
                                streak: claimed.nextStreak,
                            });
                            store.patch({ toast: `Welcome back · +${claimed.amount}♡` });
                        }}
                    >
                        <span>Welcome back · day {returnReward.nextStreak}</span>
                        <strong>Claim +{returnReward.amount}♡</strong>
                    </button>
                )}

                {/* One compact prompt at a time. Showing the return claim and
                    the location goal together crushed the character stage on
                    667px phones; after claiming, the goal takes its place. */}
                {nextLocation && !returnReward?.claimable && (
                    <section className="koi-next-goal" aria-label={`Progress toward ${nextLocation.name}`}>
                        <span>Next place · {nextLocation.name}</span>
                        <strong>{Math.max(0, nextLocation.unlockAt - affection)}♥ to go</strong>
                        <meter min={0} max={nextLocation.unlockAt} value={affection} />
                    </section>
                )}
                <button type="button" className="koi-cta" onClick={() => store.patch({ koiScreen: "plan" })}>
                    <Icon name="heart" className="koi-menu-icon" />
                    Go on a date
                </button>
                <button type="button" className="koi-btn" onClick={() => store.patch({ koiScreen: "book" })}>
                    <Icon name="book" className="koi-menu-icon" />
                    Little Black Book
                </button>
                <button type="button" className="koi-btn" onClick={() => store.patch({ koiScreen: "shop" })}>
                    <Icon name="gift" className="koi-menu-icon" />
                    Gift shop
                </button>
                {/* Settings lives on the gear at the top right; the fourth slot
                    is better spent on something the game alone can do. */}
                <button type="button" className="koi-btn" onClick={() => store.patch({ koiScreen: "postcard" })}>
                    <Icon name="postcard" className="koi-menu-icon" />
                    Send Postcard
                </button>
            </nav>
        </main>
    );
}
