/**
 * Where real money enters the game: heart packs, offers, and one rewarded ad.
 *
 * Every row here is conditional on the host actually supporting it. Shop item
 * `runtimeServices` reports "unavailable" for any undeployed catalog or ad
 * placement, so the screen never presents a button that cannot complete.
 */
import { useState, useEffect } from "react";
import { store } from "../../state/store.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { HEART_PACKS, OFFERS } from "../../game/data/monetization.ts";
import { AD_PLACEMENTS } from "../../game/data/monetization.ts";
import { GIFTS } from "../../game/data/world.ts";
import { claimFreeGiftDay, grantGift, grantHearts, grantOffer, hasPurchased, today } from "../../state/profile.ts";
import { isConfiguredPlatformId } from "../../config/platform.ts";
import { useProfile } from "./useProfile.ts";

import { analytics } from "../../systems/analytics/analyticsConfig.ts";
import { returnReminders } from "../../systems/retention/retentionConfig.ts";
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

    // The store surface was seen at all. Step 1 of the purchase funnel: without
    // it the later steps have no denominator and conversion is unreadable.
    useEffect(() => {
        analytics.funnelStep("purchase", 1, { offers: offers.length });
    }, [offers.length]);

    const buy = async (id: string, itemId: string, rewardHearts: number, grant: () => void) => {
        setBusy(id);
        analytics.funnelStep("purchase", 2, { item_id: itemId, offer_id: id });
        analytics.funnelStep("purchase", 3, { item_id: itemId });
        // One logical tap, one order. Reusing a date/day-derived key caused
        // repeatable packs to replay an old fulfilled order and grant again.
        const result = await runtimeServices.purchaseShopItem(itemId, crypto.randomUUID());
        setBusy(null);
        if (result === "verified") {
            grant();
            analytics.funnelStep("purchase", 4, { item_id: itemId, offer_id: id });
            analytics.event("reward_granted", {
                reward_type: "iap_hearts",
                amount: rewardHearts,
                offer_id: id,
                item_id: itemId,
            });
            store.patch({ toast: "Thank you." });
            return;
        }
        // A cancel and a failure are different problems — one is a pricing or
        // copy question, the other is a broken pipeline — so they must not
        // collapse into a single "did not convert" row.
        analytics.event(result === "cancelled" ? "purchase_cancelled" : "purchase_failed", {
            item_id: itemId,
            offer_id: id,
            reason: result,
        });
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
        analytics.event("reward_granted", { amount: 1, currency: "gift", source: "rewarded_free_gift" });
        // Kill switch: the 24h reminder promises this gift. Leaving it scheduled
        // pings the player about something they just took, which is precisely
        // how a useful notification becomes a muted one.
        void returnReminders.cancel("d1");
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
                                    void buy(offer.id, offer.itemId, offer.hearts, () =>
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
                                onClick={() =>
                                    void buy(pack.id, pack.itemId, pack.hearts, () => grantHearts(pack.hearts))
                                }
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
