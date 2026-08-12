/** Buy gifts between dates. A gift matching their live bubble is worth 4x. */
import { useState } from "react";
import { store } from "../../state/store.ts";
import { GIFTS, TOPIC_GLYPH } from "../../game/data/world.ts";
import { buyGift } from "../../state/profile.ts";
import { useProfile } from "./useProfile.ts";
import ConfirmSpend from "./ConfirmSpend.tsx";
import ShopOffers from "./ShopOffers.tsx";
import type { GiftDef } from "../../game/data/types.ts";
import { analytics } from "../../systems/analytics/analyticsConfig.ts";

export default function GiftShop() {
    const profile = useProfile();
    // Nothing is spent until this is confirmed. A Ring is 150♡ against a
    // starting balance of 120, so a mis-tap here is not a small mistake.
    const [pending, setPending] = useState<GiftDef | null>(null);
    // What you are carrying. Previously this was only a "×2" badge in the
    // corner of a card, and the bottom half of the screen was dead space.
    const carried = GIFTS.map((gift) => ({ gift, owned: profile.inventory[gift.id] ?? 0 })).filter((e) => e.owned > 0);

    return (
        <main className="koi-screen koi-shop">
            <header className="koi-header">
                <button type="button" className="koi-back" onClick={() => store.patch({ koiScreen: "home" })}>
                    ‹ Back
                </button>
                <h1 className="koi-title-sm">Gift shop</h1>
                <span className="koi-coins">♡ {profile.coins}</span>
            </header>

            <p className="koi-hint">Give a gift while they are thinking about it and it counts four times over.</p>

            <div className="koi-gift-grid">
                {GIFTS.map((gift) => {
                    const owned = profile.inventory[gift.id] ?? 0;
                    const affordable = profile.coins >= gift.price;
                    return (
                        <div key={gift.id} className="koi-gift">
                            <img src={gift.image} alt="" />
                            <strong>{gift.name}</strong>
                            <span className="koi-gift-topic">{TOPIC_GLYPH[gift.topic]}</span>
                            <button
                                type="button"
                                className="koi-btn koi-btn-sm"
                                disabled={!affordable}
                                onClick={() => setPending(gift)}
                            >
                                ♡ {gift.price}
                            </button>
                            {owned > 0 && <span className="koi-gift-owned">×{owned}</span>}
                        </div>
                    );
                })}
            </div>

            {/* Hearts and offers, only once the catalog is actually deployed:
                every id is REPLACE_WITH_ until then and the service reports
                "unavailable", so these rows stay hidden rather than throwing. */}
            <ShopOffers />

            <section className="koi-bag">
                <h2 className="koi-section">In your bag</h2>
                {carried.length > 0 ? (
                    <ul className="koi-bag-row">
                        {carried.map(({ gift, owned }) => (
                            <li key={gift.id}>
                                <img src={gift.image} alt="" />
                                <span>{gift.name}</span>
                                <strong>×{owned}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="koi-bag-empty">
                        Nothing yet. Anything you buy comes with you on your next date, ready for the right moment.
                    </p>
                )}
            </section>

            {pending && (
                <ConfirmSpend
                    itemName={pending.name}
                    image={pending.image}
                    price={pending.price}
                    balance={profile.coins}
                    onCancel={() => setPending(null)}
                    onConfirm={() => {
                        const bought = buyGift(pending.id, pending.price);
                        if (bought) {
                            analytics.event("currency_spend", {
                                currency: "hearts",
                                amount: pending.price,
                                sink: "gift",
                                item_id: pending.id,
                                balance_after: profile.coins - pending.price,
                            });
                        }
                        setPending(null);
                        store.patch({ toast: bought ? `${pending.name} is in your bag.` : "Not enough ♡" });
                    }}
                />
            )}
        </main>
    );
}
