/**
 * Send a Postcard: a 50 RB gesture aimed at someone you already know.
 *
 * The list is the Little Black Book's — strangers are not offered, because a
 * postcard from someone you have never met is not romance, it is spam. Each
 * send is one verified purchase: nothing is stockpiled, so nothing consumable
 * has to be tracked locally, and the effect (a small affection bump) lands
 * only after the host confirms the charge.
 */
import { useEffect, useRef, useState } from "react";
import { store } from "../../state/store.ts";
import { CAST_BY_ID, affectionTier, figureHeightRatio } from "../../game/data/world.ts";
import { POSTCARD } from "../../game/data/monetization.ts";
import { bankExtraAffection, getProfile, spendHearts, type MetPerson } from "../../state/profile.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { useProfile } from "./useProfile.ts";
import Icon from "./icons.tsx";
import ModalLayer from "./ModalLayer.tsx";
import { analytics } from "../../systems/analytics/analyticsConfig.ts";

export default function PostcardScreen() {
    const profile = useProfile();
    const entries = Object.values(profile.people)
        .filter((person) => person.id !== profile.avatar)
        .sort((a, b) => b.affection - a.affection);
    const [sendingTo, setSendingTo] = useState<MetPerson | null>(null);
    const [busy, setBusy] = useState(false);
    const confirmRef = useRef<HTMLButtonElement>(null);

    // Hearts are earned in-game, so the only gate is whether the player has
    // enough — no shop catalog, no fail-closed path, nothing that can be
    // "not connected". Read live so the button re-enables the moment a date
    // pays out.
    const affordable = profile.coins >= POSTCARD.priceHearts;

    // Escape backs out of the confirm dialog; confirm takes focus on open.
    useEffect(() => {
        if (!sendingTo) return;
        confirmRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busy) setSendingTo(null);
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [sendingTo, busy]);

    const send = async () => {
        const person = sendingTo;
        if (!person || busy) return;
        setBusy(true);
        // spendHearts is the single check-and-charge, so a double tap cannot
        // spend twice off a stale balance read.
        const paid = spendHearts(POSTCARD.priceHearts);
        setBusy(false);
        if (!paid) {
            store.patch({ toast: `You need ${POSTCARD.priceHearts}♡ to send a postcard.` });
            return;
        }
        bankExtraAffection(person.id, POSTCARD.affection);
        // A soft-currency sink, not a purchase: one schema across every spend
        // so the economy reads off a single event.
        analytics.event("currency_spent", {
            currency: "hearts",
            amount: POSTCARD.priceHearts,
            sink: "postcard",
            // getProfile(), not the `profile` snapshot this render closed over:
            // that one predates the spend and would report the old balance.
            balance_after: getProfile().coins,
        });
        runtimeServices.track("postcard_sent", { to: person.id, hearts: POSTCARD.priceHearts });
        const name = CAST_BY_ID[person.id]?.name ?? person.id;
        store.patch({ toast: `Postcard on its way to ${name}. +${POSTCARD.affection}♥.` });
        setSendingTo(null);
    };

    const sendName = sendingTo ? (CAST_BY_ID[sendingTo.id]?.name ?? sendingTo.id) : "";
    // The card at the top is always YOURS: whoever you play signs every
    // postcard, so it carries your face, your name and your colour.
    const you = profile.avatar ? CAST_BY_ID[profile.avatar] : undefined;

    return (
        <main className="koi-screen koi-book koi-postcard">
            <header className="koi-header">
                <button type="button" className="koi-back" onClick={() => store.patch({ koiScreen: "home" })}>
                    ‹ Back
                </button>
                <h1 className="koi-title-sm">Send a Postcard</h1>
            </header>

            <section
                className="koi-postcard-card"
                style={you ? ({ "--koi-char": you.color } as React.CSSProperties) : undefined}
            >
                {you && (
                    <>
                        <img
                            className="koi-postcard-art"
                            src={`images/postcards/${you.id}.png`}
                            alt={`Your postcard: ${you.name}`}
                        />
                        <span className="koi-postcard-stamp" aria-hidden="true">
                            <Icon name="heart" className="koi-postcard-stamp-icon" />
                        </span>
                    </>
                )}
                <span className="koi-postcard-writing">
                    <strong className="koi-postcard-from">From {you?.name ?? "you"}, with love</strong>
                    <span className="koi-postcard-note">
                        +{POSTCARD.affection}♥ with whoever gets it · {POSTCARD.priceHearts}♡ each
                    </span>
                </span>
            </section>

            <p className="koi-postcard-lead">Only people you have met. Nobody writes to strangers.</p>

            {entries.length === 0 && (
                <section className="koi-empty-state">
                    <span className="koi-empty-mark" aria-hidden="true">
                        ♡
                    </span>
                    <h2>Nobody to write to yet</h2>
                    <p>Meet someone first. Once you have been on a date, they can get a postcard.</p>
                    <button type="button" className="koi-cta" onClick={() => store.patch({ koiScreen: "plan" })}>
                        Go on a date
                    </button>
                </section>
            )}

            <ul className="koi-book-list">
                {entries.map((person) => {
                    const def = CAST_BY_ID[person.id];
                    return (
                        <li
                            key={person.id}
                            className="koi-book-row"
                            style={
                                {
                                    "--koi-char": def?.color,
                                    "--koi-fig": figureHeightRatio(person.id),
                                } as React.CSSProperties
                            }
                        >
                            <img src={`images/cast/${person.id}_figure.png`} alt="" />
                            <div className="koi-book-body">
                                <div className="koi-book-head">
                                    <strong>{def?.name ?? person.id}</strong>
                                    {person.partner && <span className="koi-badge">Partner</span>}
                                </div>
                                <p className="koi-book-meta">
                                    {affectionTier(person.affection)} · {person.affection}♥
                                </p>
                                <button
                                    type="button"
                                    className="koi-cta koi-cta-sm koi-postcard-send"
                                    disabled={!affordable || busy}
                                    onClick={() => setSendingTo(person)}
                                >
                                    <Icon name="postcard" className="koi-menu-icon" />
                                    {affordable ? `Send · ${POSTCARD.priceHearts}♡` : `Need ${POSTCARD.priceHearts}♡`}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {sendingTo && (
                // Same contract as the gift shop's confirm: a price and two
                // clear ways out. Escape and "Not now" both cancel.
                <ModalLayer>
                    <div className="koi-modal" role="dialog" aria-modal="true" aria-labelledby="koi-postcard-title">
                        {/* What is being sent is YOUR postcard, so that is the
                            art on the confirm, not their cutout. */}
                        {you && (
                            <img className="koi-modal-postcard-art" src={`images/postcards/${you.id}.png`} alt="" />
                        )}
                        <h2 className="koi-modal-title" id="koi-postcard-title">
                            Send a postcard to {sendName}?
                        </h2>
                        <p className="koi-modal-cost">
                            <span className="koi-modal-price">{POSTCARD.priceHearts}♡</span>
                            <span className="koi-modal-after">
                                +{POSTCARD.affection}♥ with {sendName}
                            </span>
                        </p>
                        <div className="koi-modal-actions">
                            <button
                                type="button"
                                className="koi-btn"
                                disabled={busy}
                                onClick={() => setSendingTo(null)}
                            >
                                Not now
                            </button>
                            <button
                                type="button"
                                className="koi-cta"
                                ref={confirmRef}
                                disabled={busy}
                                onClick={() => void send()}
                            >
                                {busy ? "Sending…" : "Send it"}
                            </button>
                        </div>
                    </div>
                </ModalLayer>
            )}
        </main>
    );
}
