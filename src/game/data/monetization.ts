/**
 * What Koi no Yokan sells, and where it asks.
 *
 * The money flow RUN expects is: real money → RB (RUN Bits, the platform hard
 * currency) → this game's own currency → in-game value. This game's currency is
 * already the ♡ hearts the gift shop spends, so RB packs top those up rather
 * than introducing a third currency nobody asked for.
 *
 * Everything here fails closed. Ad placement ids are self-authored strings and
 * are always live; shop item ids must match `rundot/shop.config.json` and are
 * `REPLACE_WITH_` until that catalog is deployed, at which point the surfaces
 * light up on their own. See src/config/platform.ts.
 */
import { PLATFORM_IDS } from "../../config/platform.ts";

export interface HeartPack {
    id: string;
    /** Shop item id, registered in rundot/shop.config.json. */
    itemId: string;
    hearts: number;
    priceRb: number;
    /** Extra over the base rate, shown so the bigger tiers read as better value. */
    bonusPct: number;
    featured?: boolean;
}

/**
 * Six tiers with a growing bonus, per RUN's pricing template. The base rate is
 * ~100 RB ≈ $1, so the ladder runs about $4 to $80.
 *
 * Scaled to this game's economy rather than copied blind: a gift costs 12–150♡
 * and a good date earns about 20♡, so the smallest pack is a handful of gifts
 * and the largest is a long run of them.
 */
export const HEART_PACKS: HeartPack[] = [
    { id: "hearts_400", itemId: PLATFORM_IDS.heartsSmall, hearts: 250, priceRb: 400, bonusPct: 0 },
    { id: "hearts_800", itemId: PLATFORM_IDS.heartsMedium, hearts: 600, priceRb: 800, bonusPct: 20 },
    { id: "hearts_1600", itemId: PLATFORM_IDS.heartsLarge, hearts: 1500, priceRb: 1600, bonusPct: 50, featured: true },
    { id: "hearts_2400", itemId: PLATFORM_IDS.heartsHuge, hearts: 2500, priceRb: 2400, bonusPct: 67 },
    { id: "hearts_4000", itemId: PLATFORM_IDS.heartsMega, hearts: 5000, priceRb: 4000, bonusPct: 100 },
    { id: "hearts_8000", itemId: PLATFORM_IDS.heartsUltra, hearts: 12500, priceRb: 8000, bonusPct: 150 },
];

export interface OfferDef {
    id: string;
    itemId: string;
    name: string;
    blurb: string;
    priceRb: number;
    hearts: number;
    /** Gift ids granted outright. */
    gifts: string[];
    /** Permanent unlock granted, if any. */
    entitlement?: string;
    /** Buyable once ever. */
    oneTime?: boolean;
    /** Hidden until this offer has been bought — depth of spend. */
    requires?: string;
}

/**
 * The ice-breaker first, then two bundles, the second gated behind the first.
 *
 * The ice-breaker is deliberately cheap and visually distinct: a player who
 * spends once spends again, and the first purchase is the hard one.
 */
export const OFFERS: OfferDef[] = [
    {
        id: "first_date_kit",
        itemId: PLATFORM_IDS.firstDateKit,
        name: "First Date Kit",
        blurb: "Three gifts and a pocket of hearts, so your first evening is not empty-handed.",
        priceRb: 100,
        hearts: 150,
        gifts: ["bouquet", "bubbletea", "mixtape"],
        oneTime: true,
    },
    {
        id: "hopeless_romantic",
        itemId: PLATFORM_IDS.romanticBundle,
        name: "Hopeless Romantic",
        blurb: "Every gift in the shop, once, plus hearts to keep going.",
        priceRb: 1200,
        hearts: 900,
        gifts: [
            "bouquet",
            "plushie",
            "bubbletea",
            "cake",
            "letter",
            "mixtape",
            "tickets",
            "filmreel",
            "coffee",
            "umbrella",
            "telescope",
            "sportsbottle",
            "sketchbook",
        ],
    },
    {
        id: "confidant",
        itemId: PLATFORM_IDS.confidantPass,
        name: "Confidant",
        blurb: "Two extra moves on every date, for good. The longer the evening, the further it goes.",
        priceRb: 2400,
        hearts: 500,
        gifts: ["ringbox"],
        entitlement: PLATFORM_IDS.confidantEntitlement,
        oneTime: true,
        // Depth of spend: offered to players who have already bought in once.
        requires: "first_date_kit",
    },
];

/** How many extra moves the Confidant unlock is worth. */
export const CONFIDANT_BONUS_MOVES = 2;

/**
 * The postcard: the cheapest thing in the shop, priced to be an impulse.
 *
 * Bought AND sent in one tap — there is no postcard drawer to stockpile, so
 * nothing consumable has to be tracked locally and every send is one verified
 * purchase. What it buys is a small, immediate affection bump: a postcard
 * says you were thinking of them, but it never out-earns an actual date
 * (which banks several times this on a good night).
 */
export const POSTCARD = {
    itemId: PLATFORM_IDS.postcard,
    priceRb: 50,
    affection: 3,
} as const;

/**
 * Rewarded ads are opt-in and pay something real. There is no interstitial that
 * interrupts a date: the only forced break is between dates, and even that is
 * spaced out (see AD_INTERSTITIAL_EVERY) because this is a quiet game and an
 * ad every evening would wreck its pace.
 */
export const AD_PLACEMENTS = {
    /** Doubles the affection banked at the end of a date. */
    doubleHearts: PLATFORM_IDS.rewardedResultsBonus,
    /** One free gift, once a day. */
    freeGift: PLATFORM_IDS.rewardedFreeGift,
    /** Between dates only, never inside one. */
    betweenDates: PLATFORM_IDS.dateBreakInterstitial,
} as const;

/** Dates completed between interstitials. */
export const AD_INTERSTITIAL_EVERY = 3;
