/**
 * First launch: choose which of the cast you are.
 *
 * A paged hero card rather than a grid of thumbnails. Every character is
 * pickable, and the card carries the things that actually matter when you are
 * choosing someone to *be*: their name, who they are, and a row of behaviour
 * badges. Those badges are derived from the same archetype the date simulation
 * runs on, so the picker cannot promise something the game will not deliver.
 */
import { useState } from "react";
import { store } from "../../state/store.ts";
import { setAvatar } from "../../state/profile.ts";
import { CAST, traitsFor } from "../../game/data/world.ts";
import PetalFall from "./PetalFall.tsx";
import { useProfile } from "./useProfile.ts";

export default function AvatarSelect() {
    // Reachable twice: once at first launch, and again from the hub to change
    // your mind. On the second visit it opens on whoever you already are, and
    // offers a way out that changes nothing.
    const current = useProfile((p) => p.avatar);
    const currentIndex = Math.max(
        0,
        CAST.findIndex((c) => c.id === current),
    );
    const [index, setIndex] = useState(currentIndex);
    const chosen = CAST[index] ?? CAST[0];
    if (!chosen) return null;

    const traits = traitsFor(chosen.archetype);
    const step = (delta: number) => setIndex((i) => (i + delta + CAST.length) % CAST.length);
    const isCurrent = chosen.id === current;

    return (
        <main className="koi-screen koi-avatar" style={{ "--koi-char": chosen.color } as React.CSSProperties}>
            <div className="koi-menu-bg" aria-hidden="true" />
            <PetalFall />

            {current && (
                <button
                    type="button"
                    className="koi-back koi-avatar-back"
                    onClick={() => store.patch({ koiScreen: "home" })}
                >
                    ‹ Back
                </button>
            )}

            {/* The wordmark is a first-launch flourish. Coming back to swap
                characters, it is just a header you have already read taking a
                third of a phone screen away from the card. */}
            {!current && (
                <header className="koi-avatar-head">
                    <h1 className="koi-title">KOI NO YOKAN</h1>
                    <p className="koi-subtitle">the feeling that you are about to fall in love</p>
                </header>
            )}

            <p className="koi-lead">{current ? "Be someone else?" : "Who are you tonight?"}</p>

            <section className="koi-hero">
                <button
                    type="button"
                    className="koi-hero-arrow koi-hero-prev"
                    onClick={() => step(-1)}
                    aria-label="Previous character"
                >
                    ‹
                </button>

                <div className="koi-hero-card" key={chosen.id}>
                    <img className="koi-hero-portrait" src={`images/cast/${chosen.id}_figure.png`} alt="" />
                    {/* `display: contents` in portrait, so this wrapper changes
                        nothing there; in landscape it becomes the second column
                        beside the portrait. */}
                    <div className="koi-hero-info">
                        <h2 className="koi-hero-name">{chosen.name}</h2>
                        <p className="koi-hero-blurb">{chosen.blurb}</p>
                        <ul className="koi-traits">
                            {traits.map((trait) => (
                                <li key={trait.label} className="koi-trait" title={trait.label}>
                                    <span className="koi-trait-icon" aria-hidden="true">
                                        {trait.icon}
                                    </span>
                                    <span className="koi-trait-label">{trait.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <button
                    type="button"
                    className="koi-hero-arrow koi-hero-next"
                    onClick={() => step(1)}
                    aria-label="Next character"
                >
                    ›
                </button>
            </section>

            {/* Faces rather than initials: five of the eight names collide on
                their first letter (Rin/Reina/Ren, Kaito/Kaede), and that only
                gets worse as the cast grows. */}
            <div className="koi-hero-pager" role="tablist" aria-label="Choose a character">
                {CAST.map((member, i) => (
                    <button
                        type="button"
                        role="tab"
                        aria-selected={i === index}
                        aria-label={member.name}
                        key={member.id}
                        className={`koi-pager-dot ${i === index ? "is-active" : ""}`}
                        style={{ "--koi-char": member.color } as React.CSSProperties}
                        onClick={() => setIndex(i)}
                    >
                        <img src={`images/cast/${member.id}_figure.png`} alt="" />
                    </button>
                ))}
            </div>

            <button
                type="button"
                className="koi-cta koi-hero-cta"
                onClick={() => {
                    setAvatar(chosen.id);
                    store.patch({ koiScreen: "home" });
                }}
            >
                {isCurrent ? `Stay ${chosen.name}` : `Be ${chosen.name}`}
            </button>
        </main>
    );
}
