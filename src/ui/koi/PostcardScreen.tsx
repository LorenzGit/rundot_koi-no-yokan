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
import { CAST_BY_ID, affectionTier } from "../../game/data/world.ts";
import { POSTCARD } from "../../game/data/monetization.ts";
import { bankExtraAffection, type MetPerson } from "../../state/profile.ts";
import { isConfiguredPlatformId } from "../../config/platform.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { useProfile } from "./useProfile.ts";
import Icon from "./icons.tsx";
import ModalLayer from "./ModalLayer.tsx";

/** Makes a retry after a dropped connection the same order, never a new one. */
let sendSequence = 0;

export default function PostcardScreen() {
    const profile = useProfile();
    const entries = Object.values(profile.people)
        .filter((person) => person.id !== profile.avatar)
        .sort((a, b) => b.affection - a.affection);
    const [sendingTo, setSendingTo] = useState<MetPerson | null>(null);
    const [busy, setBusy] = useState(false);
    const confirmRef = useRef<HTMLButtonElement>(null);

    // Production fails closed, same as the gift shop's purchase rows: until
    // the shop catalog is real the send button is disabled, never a charge
    // that cannot complete. Plain dev has no LiveOps and no real catalog, so
    // there the button stays tappable and the purchase attempt runs the real
    // path to its honest end (the SDK mock only stocks its own fixtures).
    const purchasable =
        (runtimeServices.config.shopEnabled && isConfiguredPlatformId(POSTCARD.itemId)) || import.meta.env.DEV;

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
        const result = await runtimeServices.purchaseShopItem(
            POSTCARD.itemId,
            `postcard-${person.id}-${profile.totalDates}-${sendSequence++}`,
        );
        setBusy(false);
        if (result !== "verified") {
            store.patch({
                toast:
                    result === "cancelled"
                        ? "No charge made."
                        : result === "unavailable"
                          ? "The shop is not reachable from here. Nothing was charged."
                          : "That did not go through. Nothing was charged.",
            });
            return;
        }
        bankExtraAffection(person.id, POSTCARD.affection);
        runtimeServices.track("postcard_sent", { to: person.id });
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
                        +{POSTCARD.affection}♥ with whoever gets it · {POSTCARD.priceRb} RB each
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
                            style={{ "--koi-char": def?.color } as React.CSSProperties}
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
                                    disabled={!purchasable || busy}
                                    onClick={() => setSendingTo(person)}
                                >
                                    <Icon name="postcard" className="koi-menu-icon" />
                                    {purchasable ? `Send · ${POSTCARD.priceRb} RB` : "Shop not connected"}
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
                            <span className="koi-modal-price">{POSTCARD.priceRb} RB</span>
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
