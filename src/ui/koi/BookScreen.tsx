/**
 * The Little Black Book: everyone you have ever met, their affection meter, and
 * what you have worked out about them. Archetypes are never named — the book
 * only lists topics you personally watched them think about.
 */
import { store } from "../../state/store.ts";
import { CAST_BY_ID, TOPIC_GLYPH, affectionTier } from "../../game/data/world.ts";
import { setPartner } from "../../state/profile.ts";
import { useProfile } from "./useProfile.ts";
import type { TopicId } from "../../game/data/types.ts";

export default function BookScreen() {
    const profile = useProfile();
    const entries = Object.values(profile.people).sort((a, b) => b.affection - a.affection);

    return (
        <main className="koi-screen koi-book">
            <header className="koi-header">
                <button type="button" className="koi-back" onClick={() => store.patch({ koiScreen: "home" })}>
                    ‹ Back
                </button>
                <h1 className="koi-title-sm">Little Black Book</h1>
            </header>

            {entries.length === 0 && (
                <section className="koi-empty-state">
                    <span className="koi-empty-mark" aria-hidden="true">
                        ♡
                    </span>
                    <h2>Nobody in here yet</h2>
                    <p>
                        Everyone you meet gets a page here: how they feel about you, how many nights you have spent
                        together, and what you have worked out they like talking about.
                    </p>
                    <button type="button" className="koi-cta" onClick={() => store.patch({ koiScreen: "plan" })}>
                        Go on a date
                    </button>
                </section>
            )}

            <ul className="koi-book-list">
                {entries.map((person) => {
                    const def = CAST_BY_ID[person.id];
                    const canAsk = person.affection >= 90 && !person.partner;
                    return (
                        <li
                            key={person.id}
                            className="koi-book-row"
                            style={{ "--koi-char": def?.color } as React.CSSProperties}
                        >
                            <img src={`images/cast/${person.id}_figure.png`} alt="" />
                            <div className="koi-book-body">
                                <div className="koi-book-head">
                                    <strong>{def?.name ?? person.id}</strong>
                                    {person.partner && <span className="koi-badge">Partner</span>}
                                </div>
                                <p className="koi-book-blurb">{def?.blurb}</p>

                                <meter
                                    className="koi-meter"
                                    min={0}
                                    max={100}
                                    value={person.affection}
                                    aria-label={`Affection with ${def?.name ?? person.id}`}
                                />
                                <p className="koi-book-meta">
                                    {affectionTier(person.affection)} · {person.affection}♥ · {person.dates} dates ·
                                    best {person.bestSpark} spark
                                </p>

                                {person.learned.length > 0 && (
                                    <p className="koi-book-topics">
                                        Talks about:{" "}
                                        {person.learned.map((t) => (
                                            <span key={t}>{TOPIC_GLYPH[t as TopicId] ?? "?"}</span>
                                        ))}
                                    </p>
                                )}

                                {canAsk && (
                                    <button
                                        type="button"
                                        className="koi-cta koi-cta-sm"
                                        onClick={() => {
                                            const { jealous } = setPartner(person.id);
                                            store.patch({
                                                toast: jealous.length
                                                    ? `${def?.name} said yes. ${jealous.length} other${jealous.length > 1 ? "s" : ""} heard about it.`
                                                    : `${def?.name} said yes.`,
                                            });
                                        }}
                                    >
                                        Ask them out
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </main>
    );
}
