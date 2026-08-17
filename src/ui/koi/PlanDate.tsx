/** Pick who you're seeing and where. Locations unlock on total affection. */
import { useState } from "react";
import { analytics, FIRST_PLAY_FUNNEL } from "../../systems/analytics/analyticsConfig.ts";
import { store } from "../../state/store.ts";
import {
    CAST,
    CAST_BY_ID,
    LOCATIONS,
    TOPIC_GLYPH,
    affectionTier,
    figureHeightRatio,
    traitsFor,
} from "../../game/data/world.ts";
import type { TopicId } from "../../game/data/types.ts";
import { getProfile, personFor, totalAffection } from "../../state/profile.ts";
import { warmDateAssets } from "../../game/dateScene.ts";
import { useProfile } from "./useProfile.ts";

export default function PlanDate() {
    const profile = useProfile();
    const unlockedBy = totalAffection();
    // First play opens here. Preselect the first eligible person so the player
    // reaches the date with one tap; every later visit stays an open choice.
    const firstCandidate = CAST.find((candidate) => candidate.id !== profile.avatar)?.id ?? null;
    const [who, setWho] = useState<string | null>(profile.totalDates === 0 ? firstCandidate : null);
    // The first location is always unlocked and is the obvious default, so
    // preselect it: nobody comes here to pick Sakura Plaza on purpose, they
    // come to pick a person, and an unselected Where left "Meet up" disabled
    // for no reason anyone could see.
    const [where, setWhere] = useState<string | null>(LOCATIONS.find((loc) => unlockedBy >= loc.unlockAt)?.id ?? null);
    const playerId = profile.avatar;
    const chosen = who ? CAST_BY_ID[who] : undefined;
    const chosenPerson = personFor(who ?? "");
    const chosenLocation = LOCATIONS.find((loc) => loc.id === where);
    // You do not date yourself.
    const candidates = CAST.filter((c) => c.id !== playerId);

    return (
        <main className="koi-screen koi-plan">
            <header className="koi-header">
                <button type="button" className="koi-back" onClick={() => store.patch({ koiScreen: "home" })}>
                    ‹ Back
                </button>
                <h1 className="koi-title-sm">Tonight</h1>
            </header>

            <div className="koi-plan-scroll">
                {profile.totalDates === 0 && (
                    <p className="koi-first-date-callout">Everything's picked. Change anything, or meet now.</p>
                )}
                <h2 className="koi-section">Who</h2>
                <div className="koi-pick-row">
                    {candidates.map((c) => {
                        const person = personFor(c.id);
                        return (
                            <button
                                type="button"
                                key={c.id}
                                className={`koi-pick ${who === c.id ? "is-selected" : ""}`}
                                // Everyone is drawn at one px-per-cm, so the
                                // 169cm painter really is shorter than the
                                // 186cm charmer standing beside her.
                                style={
                                    {
                                        "--koi-char": c.color,
                                        "--koi-fig": figureHeightRatio(c.id),
                                    } as React.CSSProperties
                                }
                                onClick={() => setWho(c.id)}
                            >
                                <img src={`images/cast/${c.id}_figure.png`} alt="" />
                                {/* Over the figure, not stacked under it: a
                                name and a tier below the art cost 32px of every
                                card, which on a short phone came straight out
                                of the only thing worth looking at. */}
                                <span className="koi-pick-plate">
                                    <span className="koi-pick-name">{c.name}</span>
                                    <span className="koi-pick-meta">
                                        {person.dates > 0
                                            ? `${affectionTier(person.affection)} · ${person.affection}♥`
                                            : "New"}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* What you actually need to know before the date starts. The
                traits are derived from the same archetype the sim runs on, and
                the topics are the ones you have personally watched them think
                about, so this can never promise something the date will not
                deliver. Without it you walk in blind and pick moves at random. */}
                {chosen && (
                    <section className="koi-brief" style={{ "--koi-char": chosen.color } as React.CSSProperties}>
                        <p className="koi-brief-blurb">{chosen.blurb}</p>
                        <ul className="koi-brief-traits">
                            {traitsFor(chosen.archetype).map((trait) => (
                                <li key={trait.label}>
                                    <span aria-hidden="true">{trait.icon}</span> {trait.label}
                                </li>
                            ))}
                        </ul>
                        {/* Only once there is something to show. The "not met
                        yet" version of this line repeated the New badge on the
                        card two inches above it, and it cost a whole line of
                        the screen on exactly the first-run layout where space
                        is tightest. */}
                        {chosenPerson.learned.length > 0 && (
                            <p className="koi-brief-topics">
                                <span className="koi-brief-label">You have seen them think about</span>
                                {chosenPerson.learned.map((topic) => (
                                    <span key={topic} className="koi-brief-glyph">
                                        {TOPIC_GLYPH[topic as TopicId] ?? "?"}
                                    </span>
                                ))}
                            </p>
                        )}
                    </section>
                )}

                {/* Three tiles, not three full-width rows. The rows read fine
                on their own but cost ~250px of a 667px phone, which is what
                pushed Where off the bottom and put a scrollbar down the middle
                of the screen. The mood line every tile used to carry is shown
                once, below, for whichever place is actually selected. */}
                <h2 className="koi-section">Where</h2>
                {/* Tiles and their caption travel together — rotated, they are
                one grid item, or the caption ends up stranded at the bottom of
                a column the tiles only fill the top of. */}
                <div className="koi-where">
                    <div className="koi-loc-grid">
                        {LOCATIONS.map((loc) => {
                            const locked = unlockedBy < loc.unlockAt;
                            return (
                                <button
                                    type="button"
                                    key={loc.id}
                                    className={`koi-loc ${where === loc.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
                                    disabled={locked}
                                    aria-label={
                                        locked ? `${loc.name}, unlocks at ${loc.unlockAt} total hearts` : loc.name
                                    }
                                    onClick={() => setWhere(loc.id)}
                                >
                                    <span className="koi-loc-thumb">
                                        <img src={loc.thumbnail} alt="" />
                                        {locked && (
                                            <span className="koi-loc-lock" aria-hidden="true">
                                                {loc.unlockAt}♥
                                            </span>
                                        )}
                                    </span>
                                    <span className="koi-loc-name">{loc.name}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="koi-loc-caption">
                        {chosenLocation ? chosenLocation.mood : "Choose where the evening happens."}
                    </p>
                </div>
            </div>

            <button
                type="button"
                className="koi-cta koi-cta-sticky"
                disabled={!who || !where}
                onClick={() => {
                    // Textures start fetching NOW, ahead of the canvas, so the
                    // veil over the first frames lifts as fast as the network
                    // allows rather than only once the scene asks for them.
                    const location = LOCATIONS.find((loc) => loc.id === where);
                    if (location && who) warmDateAssets(who, getProfile().avatar ?? "char_f_artist", location);
                    // Steps 3 and 7 share this call site; the once-ever marks
                    // make a later plan register as "came back for another
                    // evening" without extra bookkeeping. Step 7 is gated on
                    // step 6 having fired — a finished-but-unviewed result
                    // otherwise put more players at "second date" than at
                    // "first result viewed", the exact non-monotonic shape
                    // that reads as broken instrumentation.
                    if (getProfile().totalDates === 0) {
                        analytics.funnelStep(FIRST_PLAY_FUNNEL, 3, {
                            person_id: who ?? "",
                            location_id: where ?? "",
                        });
                    } else if (!analytics.isFirstTime(FIRST_PLAY_FUNNEL, 6)) {
                        analytics.funnelStep(FIRST_PLAY_FUNNEL, 7, {
                            person_id: who ?? "",
                            location_id: where ?? "",
                        });
                    }
                    store.patch({ phase: "playing", dateWith: who, dateAt: where, selectedGift: null });
                }}
            >
                {profile.totalDates === 0 && chosen ? `Meet ${chosen.name}` : "Meet up"}
            </button>
        </main>
    );
}
