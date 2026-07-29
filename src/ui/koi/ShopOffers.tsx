/**
 * Where real money enters the game: heart packs, offers, and one rewarded ad.
 *
 * Every row here is conditional on the host actually supporting it. Shop item
 * ids are `REPLACE_WITH_` until `rundot/shop.config.json` is deployed, and
 * `runtimeServices` reports "unavailable" for anything unconfigured — so on a
 * fresh checkout this component renders the ad row at most, and never a buy
 * button that cannot complete.
 */
import { useState } from "react";
import { store } from "../../state/store.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { HEART_PACKS, OFFERS } from "../../game/data/monetization.ts";
import { AD_PLACEMENTS } from "../../game/data/monetization.ts";
import { GIFTS } from "../../game/data/world.ts";
import { claimFreeGiftDay, grantGift, grantHearts, grantOffer, hasPurchased, today } from "../../state/profile.ts";
import { isConfiguredPlatformId } from "../../config/platform.ts";
import { useProfile } from "./useProfile.ts";

export default function ShopOffers() {
    const profile = useProfile();
    const [busy, setBusy] = useState<string | null>(null);

    const packs = HEART_PACKS.filter((pack) => isConfiguredPlatformId(pack.itemId));
    const offers = OFFERS.filter(
        (offer) =>
            isConfiguredPlatformId(offer.itemId) &&
            !(offer.oneTime && hasPurchased(offer.id)) &&
            (!offer.requires || hasPurchased(offer.requires)),
    );
    const freeGiftReady = profile.freeGiftClaimedOn !== today() && isConfiguredPlatformId(AD_PLACEMENTS.freeGift);

    const buy = async (id: string, itemId: string, grant: () => void) => {
        setBusy(id);
        // The key makes a retry after a dropped connection safe: the host
        // treats the second attempt as the same order rather than a new one.
        const result = await runtimeServices.purchaseShopItem(itemId, `${id}-${profile.totalDates}-${today()}`);
        setBusy(null);
        if (result === "verified") {
            grant();
            store.patch({ toast: "Thank you." });
            return;
        }
        store.patch({
            toast: result === "cancelled" ? "No charge made." : "That did not go through. Nothing was charged.",
        });
    };

    const watchForGift = async () => {
        setBusy("freegift");
        const result = await runtimeServices.watchFreeGiftAd();
        setBusy(null);
        if (result !== "verified") {
            store.patch({ toast: result === "cancelled" ? "No reward for a skipped ad." : "No ad available." });
            return;
        }
        // Something cheap and useful, never the Ring.
        const pool = GIFTS.filter((gift) => gift.price <= 45);
        const pick = pool[Math.floor(profile.totalDates % Math.max(1, pool.length))] ?? pool[0];
        if (!pick) return;
        grantGift(pick.id);
        claimFreeGiftDay();
        store.patch({ toast: `${pick.name} added to your bag.` });
    };

    if (packs.length === 0 && offers.length === 0 && !freeGiftReady) return null;

    return (
        <section className="koi-store">
            {freeGiftReady && (
                <button
                    type="button"
                    className="koi-store-ad"
                    disabled={busy !== null}
                    onClick={() => void watchForGift()}
                >
                    <span aria-hidden="true">🎬</span>
                    <span className="koi-store-ad-body">
                        <strong>Free gift</strong>
                        <span>Watch a short ad, once a day.</span>
                    </span>
                </button>
            )}

            {offers.length > 0 && (
                <>
                    <h2 className="koi-section">Offers</h2>
                    <div className="koi-offer-list">
                        {offers.map((offer) => (
                            <button
                                type="button"
                                key={offer.id}
                                className="koi-offer"
                                disabled={busy !== null}
                                onClick={() =>
                                    void buy(offer.id, offer.itemId, () =>
                                        grantOffer(offer.id, offer.hearts, offer.gifts, offer.entitlement),
                                    )
                                }
                            >
                                <span className="koi-offer-body">
                                    <strong>{offer.name}</strong>
                                    <span className="koi-offer-blurb">{offer.blurb}</span>
                                </span>
                                <span className="koi-offer-price">{offer.priceRb} RB</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {packs.length > 0 && (
                <>
                    <h2 className="koi-section">Hearts</h2>
                    <div className="koi-pack-grid">
                        {packs.map((pack) => (
                            <button
                                type="button"
                                key={pack.id}
                                className={`koi-pack ${pack.featured ? "is-featured" : ""}`}
                                disabled={busy !== null}
                                onClick={() => void buy(pack.id, pack.itemId, () => grantHearts(pack.hearts))}
                            >
                                <strong>♡ {pack.hearts.toLocaleString()}</strong>
                                {pack.bonusPct > 0 && <span className="koi-pack-bonus">+{pack.bonusPct}%</span>}
                                <span className="koi-pack-price">{pack.priceRb} RB</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
