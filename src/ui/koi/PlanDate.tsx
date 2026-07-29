/** Pick who you're seeing and where. Locations unlock on total affection. */
import { useState } from "react";
import { store } from "../../state/store.ts";
import { CAST, CAST_BY_ID, LOCATIONS, TOPIC_GLYPH, affectionTier, traitsFor } from "../../game/data/world.ts";
import type { TopicId } from "../../game/data/types.ts";
import { personFor, totalAffection } from "../../state/profile.ts";
import { useProfile } from "./useProfile.ts";

export default function PlanDate() {
    const profile = useProfile();
    const unlockedBy = totalAffection();
    const [who, setWho] = useState<string | null>(null);
    // The first location is always unlocked and is the obvious default, so
    // preselect it: nobody comes here to pick Sakura Plaza on purpose, they
    // come to pick a person, and an unselected Where left "Meet up" disabled
    // for no reason anyone could see.
    const [where, setWhere] = useState<string | null>(LOCATIONS.find((loc) => unlockedBy >= loc.unlockAt)?.id ?? null);
    const playerId = profile.avatar;
    const chosen = who ? CAST_BY_ID[who] : undefined;
    const chosenPerson = personFor(who ?? "");
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
                <h2 className="koi-section">Who</h2>
                <div className="koi-pick-row">
                    {candidates.map((c) => {
                        const person = personFor(c.id);
                        return (
                            <button
                                type="button"
                                key={c.id}
                                className={`koi-pick ${who === c.id ? "is-selected" : ""}`}
                                style={{ "--koi-char": c.color } as React.CSSProperties}
                                onClick={() => setWho(c.id)}
                            >
                                <img src={`/images/cast/${c.id}_figure.png`} alt="" />
                                <span className="koi-pick-name">{c.name}</span>
                                <span className="koi-pick-meta">
                                    {person.dates > 0
                                        ? `${affectionTier(person.affection)} · ${person.affection}♥`
                                        : "New"}
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
                        <p className="koi-brief-topics">
                            {chosenPerson.learned.length > 0 ? (
                                <>
                                    <span className="koi-brief-label">You have seen them think about</span>
                                    {chosenPerson.learned.map((topic) => (
                                        <span key={topic} className="koi-brief-glyph">
                                            {TOPIC_GLYPH[topic as TopicId] ?? "?"}
                                        </span>
                                    ))}
                                </>
                            ) : (
                                <span className="koi-brief-label">You have not met them yet.</span>
                            )}
                        </p>
                    </section>
                )}

                <h2 className="koi-section">Where</h2>
                <div className="koi-loc-list">
                    {LOCATIONS.map((loc) => {
                        const locked = unlockedBy < loc.unlockAt;
                        return (
                            <button
                                type="button"
                                key={loc.id}
                                className={`koi-loc ${where === loc.id ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
                                disabled={locked}
                                onClick={() => setWhere(loc.id)}
                            >
                                <img src={loc.image} alt="" />
                                <span className="koi-loc-body">
                                    <strong>{loc.name}</strong>
                                    <em>{locked ? `Unlocks at ${loc.unlockAt} total ♥` : loc.mood}</em>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <button
                type="button"
                className="koi-cta koi-cta-sticky"
                disabled={!who || !where}
                onClick={() => store.patch({ phase: "playing", dateWith: who, dateAt: where, selectedGift: null })}
            >
                Meet up
            </button>
        </main>
    );
}
