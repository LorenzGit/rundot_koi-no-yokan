/**
 * Archetypes, cast, locations, gifts and the topic vocabulary.
 *
 * Archetypes are never named on screen. The player infers them from which
 * actions land and what the bubbles show, and the Little Black Book records
 * what they have worked out so far.
 */
import type { ArchetypeDef, ArchetypeId, CastMemberDef, GiftDef, LocationDef, TopicId } from "./types.ts";

export const TOPIC_GLYPH: Record<TopicId, string> = {
    food: "🍜",
    cat: "🐈",
    music: "🎵",
    travel: "✈️",
    movie: "🎬",
    work: "💼",
    rain: "🌧️",
    stars: "🌙",
    sport: "⚽",
    art: "🎨",
    heart: "💗",
    awkward: "💦",
};

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
    artist: {
        id: "artist",
        label: "Night-owl artist",
        band: [12, 46],
        moodDrift: 1.4,
        tensionDecay: 2.6,
        affinity: { safe: 1.1, warm: 1.45, bold: 0.95, intimate: 1.1, risky: 0.8 },
        likes: ["art", "music", "stars", "rain"],
        dislikes: ["brag", "check-phone"],
        talksAbout: ["art", "music", "stars", "rain", "movie", "cat"],
    },
    tsundere: {
        id: "tsundere",
        label: "Cheerful tsundere",
        // Narrow band: she is easy to overheat and easy to bore.
        band: [18, 44],
        moodDrift: 2.2,
        tensionDecay: 3.4,
        affinity: { safe: 0.85, warm: 1.4, bold: 1.15, intimate: 1.0, risky: 1.1 },
        likes: ["food", "cat", "movie", "heart"],
        // Complimented too early she reads it as insincere.
        dislikes: ["compliment", "check-phone"],
        talksAbout: ["food", "cat", "movie", "work", "heart", "awkward"],
    },
    senpai: {
        id: "senpai",
        label: "Cool senpai",
        // Wide band, slow to warm: safe play bores him, bold play is fine.
        band: [24, 74],
        moodDrift: 1.1,
        tensionDecay: 2.0,
        affinity: { safe: 0.7, warm: 1.0, bold: 1.5, intimate: 1.2, risky: 1.25 },
        likes: ["music", "travel", "work", "stars"],
        dislikes: ["play-straw", "check-phone"],
        talksAbout: ["travel", "work", "music", "stars", "movie"],
    },
    competitor: {
        id: "competitor",
        // Treats the whole evening as a friendly contest. Tension burns off
        // fastest of anyone, so the pressure has to be kept up rather than
        // built once and coasted on.
        label: "Competitive runner",
        band: [26, 74],
        moodDrift: 2.2,
        tensionDecay: 4.2,
        affinity: { safe: 0.7, warm: 1.05, bold: 1.45, intimate: 1.15, risky: 1.35 },
        likes: ["sport", "travel", "food", "heart"],
        // Hesitation reads as backing down to her.
        dislikes: ["look-away", "check-phone"],
        talksAbout: ["sport", "travel", "food", "heart", "work"],
    },
    zen: {
        id: "zen",
        // The one person you can genuinely take slowly. A low, narrow band:
        // he is easy to reach and easy to overshoot, and pushing hard at him
        // is the fastest way to lose him.
        label: "Grounded climber",
        band: [8, 46],
        moodDrift: 1.2,
        tensionDecay: 2.8,
        affinity: { safe: 1.3, warm: 1.35, bold: 0.9, intimate: 1.1, risky: 0.6 },
        likes: ["stars", "sport", "rain", "art"],
        dislikes: ["brag", "push"],
        talksAbout: ["sport", "stars", "rain", "art", "food"],
    },
    siren: {
        id: "siren",
        label: "Sultry siren",
        // She can take more heat than anyone, and cools slowly. Playing it safe
        // is the way to lose her: her floor is high, so a timid date never even
        // reaches the band.
        band: [30, 82],
        moodDrift: 1.6,
        tensionDecay: 1.6,
        affinity: { safe: 0.55, warm: 1.0, bold: 1.5, intimate: 1.4, risky: 1.25 },
        likes: ["music", "stars", "heart", "movie"],
        // Fidgeting and nerves read as callow to her.
        dislikes: ["play-straw", "check-phone"],
        talksAbout: ["music", "stars", "heart", "movie", "travel"],
    },
    charmer: {
        id: "charmer",
        label: "Smouldering charmer",
        // Warms fast and flirts back, but he is the charming one in the room —
        // bragging at him is competing on his own ground, and he wins.
        band: [24, 70],
        moodDrift: 2.0,
        tensionDecay: 2.2,
        affinity: { safe: 0.8, warm: 1.3, bold: 1.4, intimate: 1.25, risky: 1.0 },
        likes: ["food", "music", "heart", "travel"],
        dislikes: ["brag", "check-phone"],
        talksAbout: ["heart", "music", "food", "travel", "movie"],
    },
    athlete: {
        id: "athlete",
        label: "Sunny athlete",
        band: [10, 58],
        moodDrift: 2.6,
        tensionDecay: 4.0,
        affinity: { safe: 1.2, warm: 1.15, bold: 1.2, intimate: 1.0, risky: 0.95 },
        likes: ["sport", "food", "travel", "heart"],
        // Heart-to-hearts land flat on him.
        dislikes: ["confide", "check-phone"],
        talksAbout: ["sport", "food", "travel", "cat", "heart"],
    },
};

export const CAST: CastMemberDef[] = [
    {
        id: "char_f_artist",
        name: "Mizuki",
        archetype: "artist",
        heightCm: 169,
        gender: "f",
        blurb: "Paints until sunrise. Says more with a look than a sentence.",
        // Art first, then the sky and the rain she paints.
        wishlist: [
            { gift: "sketchbook", weight: 5 },
            { gift: "telescope", weight: 2 },
            { gift: "umbrella", weight: 2 },
            { gift: "mixtape", weight: 1 },
        ],
        color: "#3fa3a0", // her teal hair
    },
    {
        id: "char_f_tsundere",
        name: "Rin",
        archetype: "tsundere",
        heightCm: 171,
        gender: "f",
        blurb: "Arms crossed on principle. Warmer than she is willing to admit.",
        // The cat plushie melts her; dessert and a film are a close second.
        wishlist: [
            { gift: "plushie", weight: 5 },
            { gift: "cake", weight: 3 },
            { gift: "filmreel", weight: 2 },
            { gift: "bubbletea", weight: 1 },
        ],
        color: "#e8607d", // her red top and ribbon
    },
    {
        id: "char_m_senpai",
        name: "Haruto",
        archetype: "senpai",
        heightCm: 184,
        gender: "m",
        blurb: "Unhurried, unbothered. Takes a lot to impress, worth the trouble.",
        // Unhurried about everything except music and getting away.
        wishlist: [
            { gift: "mixtape", weight: 5 },
            { gift: "tickets", weight: 3 },
            { gift: "coffee", weight: 2 },
            { gift: "telescope", weight: 1 },
        ],
        color: "#5b8ac9", // his denim jacket
    },
    {
        id: "char_m_athlete",
        name: "Sora",
        archetype: "athlete",
        heightCm: 179,
        gender: "m",
        blurb: "Runs everywhere. Laughs at everything. Genuinely means it.",
        // Sport kit first; he runs everywhere and forgets his bottle.
        wishlist: [
            { gift: "sportsbottle", weight: 5 },
            { gift: "tickets", weight: 3 },
            { gift: "bubbletea", weight: 2 },
            { gift: "bouquet", weight: 1 },
        ],
        color: "#f0a03c", // his sunny warmth
    },
    {
        id: "char_f_siren",
        name: "Reina",
        archetype: "siren",
        heightCm: 174,
        gender: "f",
        blurb: "Sings last set at midnight. Entirely aware of what she is doing.",
        // Midnight cinema, music, and being adored, in that order.
        wishlist: [
            { gift: "filmreel", weight: 4 },
            { gift: "mixtape", weight: 3 },
            { gift: "bouquet", weight: 2 },
            { gift: "telescope", weight: 2 },
        ],
        color: "#c02a52", // her satin dress
    },
    {
        id: "char_m_charmer",
        name: "Kaito",
        archetype: "charmer",
        heightCm: 186,
        gender: "m",
        blurb: "Pours the drinks, remembers your order, and your name, and your birthday.",
        // He remembers your order; shortcake is his.
        wishlist: [
            { gift: "cake", weight: 4 },
            { gift: "bouquet", weight: 3 },
            { gift: "tickets", weight: 2 },
            { gift: "mixtape", weight: 1 },
        ],
        color: "#8a6bc4", // his after-dark violet
    },
    {
        id: "char_f_runner",
        name: "Kaede",
        archetype: "competitor",
        heightCm: 172,
        gender: "f",
        blurb: "Ran here. Will race you home. Keeps a personal best for everything.",
        // A race to somewhere beats gear, barely.
        wishlist: [
            { gift: "tickets", weight: 4 },
            { gift: "sportsbottle", weight: 4 },
            { gift: "bubbletea", weight: 2 },
            { gift: "letter", weight: 1 },
        ],
        color: "#26b391", // her teal athletic top
    },
    {
        id: "char_m_climber",
        name: "Ren",
        archetype: "zen",
        heightCm: 181,
        gender: "m",
        blurb: "Climbs on weekends, stretches on weekdays, never once seems in a hurry.",
        // He climbs for the view; the telescope is for what is past it.
        wishlist: [
            { gift: "telescope", weight: 4 },
            { gift: "umbrella", weight: 3 },
            { gift: "sketchbook", weight: 2 },
            { gift: "sportsbottle", weight: 1 },
        ],
        color: "#7a9a4e", // his olive joggers
    },
];

export const CAST_BY_ID: Record<string, CastMemberDef> = Object.fromEntries(CAST.map((c) => [c.id, c]));

export const LOCATIONS: LocationDef[] = [
    {
        id: "sakura",
        name: "Sakura Plaza",
        image: "images/bg_sakura_plaza.png",
        // An open waterfront square: benches and a railing, no service.
        features: ["walk", "seats", "water"],
        // Briefed at 80%; verify with scripts/scale-ruler.mjs after any regen.
        groundAsPainted: 0.8,
        unlockAt: 0,
        moodBonus: 4,
        tensionRelief: 0.4,
        topics: ["stars", "art", "heart", "rain"],
        mood: "Petals, dusk, and the whole city going quiet.",
    },
    {
        id: "beach",
        name: "Beach Terrace",
        image: "images/bg_beach_terrace.png",
        features: ["walk", "seats", "water", "drinks"],
        groundAsPainted: 0.8,
        unlockAt: 40,
        moodBonus: 7,
        tensionRelief: 0.7,
        topics: ["travel", "sport", "food", "music"],
        mood: "Too bright to be nervous. Everything feels easy here.",
    },
    {
        id: "trattoria",
        name: "La Dolce Vita",
        image: "images/bg_trattoria.png",
        features: ["table", "drinks", "music", "seats", "walk"],
        groundAsPainted: 0.8,
        unlockAt: 110,
        moodBonus: 5,
        tensionRelief: 0.2,
        topics: ["food", "work", "movie", "heart"],
        mood: "Warm light, small tables, nowhere to hide.",
    },
];

export const GIFTS: GiftDef[] = [
    { id: "bouquet", name: "Roses", image: "images/gifts/bouquet.png", price: 40, topic: "heart" },
    { id: "plushie", name: "Cat Plushie", image: "images/gifts/plushie.png", price: 30, topic: "cat" },
    { id: "bubbletea", name: "Bubble Tea", image: "images/gifts/bubbletea.png", price: 15, topic: "food" },
    { id: "cake", name: "Shortcake", image: "images/gifts/cake.png", price: 25, topic: "food" },
    { id: "letter", name: "Letter", image: "images/gifts/letter.png", price: 20, topic: "heart" },
    { id: "ringbox", name: "Ring", image: "images/gifts/ringbox.png", price: 150, topic: "heart" },

    // One gift per conversation topic, so the bag is a way to MEET whatever is
    // live rather than three ways to say "I like you". A gift whose topic is on
    // the table is the biggest modifier in the game.
    { id: "mixtape", name: "Mixtape", image: "images/gifts/mixtape.png", price: 35, topic: "music" },
    { id: "tickets", name: "Two Tickets", image: "images/gifts/tickets.png", price: 60, topic: "travel" },
    { id: "filmreel", name: "Film Reel", image: "images/gifts/filmreel.png", price: 45, topic: "movie" },
    { id: "coffee", name: "Coffee", image: "images/gifts/coffee.png", price: 12, topic: "work" },
    { id: "umbrella", name: "Umbrella", image: "images/gifts/umbrella.png", price: 28, topic: "rain" },
    { id: "telescope", name: "Telescope", image: "images/gifts/telescope.png", price: 70, topic: "stars" },
    { id: "sportsbottle", name: "Bottle", image: "images/gifts/sportsbottle.png", price: 22, topic: "sport" },
    { id: "sketchbook", name: "Sketchbook", image: "images/gifts/sketchbook.png", price: 40, topic: "art" },
];

export const GIFTS_BY_ID: Record<string, GiftDef> = Object.fromEntries(GIFTS.map((g) => [g.id, g]));

/** Affection tiers, used for the Book and for flavour text. */
export function affectionTier(value: number): string {
    if (value >= 90) return "In love";
    if (value >= 75) return "Smitten";
    if (value >= 55) return "Close";
    if (value >= 35) return "Warming up";
    if (value >= 15) return "Curious";
    return "Strangers";
}

/** A behaviour badge shown on the character picker. */
export interface Trait {
    icon: string;
    label: string;
}

/** Topic ids read badly raw ("Loves cat", "Loves heart"). */
export const TOPIC_LABEL: Record<TopicId, string> = {
    food: "good food",
    cat: "cats",
    music: "music",
    travel: "travel",
    movie: "films",
    work: "their work",
    rain: "rainy days",
    stars: "the night sky",
    sport: "sport",
    art: "art",
    heart: "romance",
    awkward: "awkward silences",
};

/** One word per topic, for the HUD chips where "good food" will not fit. */
export const TOPIC_SHORT: Record<TopicId, string> = {
    food: "food",
    cat: "cats",
    music: "music",
    travel: "travel",
    movie: "films",
    work: "work",
    rain: "rain",
    stars: "sky",
    sport: "sports",
    art: "art",
    heart: "love",
    awkward: "awkward",
};

/**
 * Every badge describes the person, never instructs the player — "Wants you
 * bold" reads as a tooltip, "Falls for confidence" reads as a character.
 */
const FAMILY_TRAIT: Record<string, Trait> = {
    safe: { icon: "☕", label: "Takes it slow" },
    warm: { icon: "💬", label: "Opens up easily" },
    bold: { icon: "🔥", label: "Falls for confidence" },
    intimate: { icon: "💗", label: "Falls hard, fast" },
    risky: { icon: "🎲", label: "Likes a gamble" },
};

/**
 * Behaviour badges for a character, derived from the archetype the simulation
 * actually uses — so the picker can never promise something the date does not
 * deliver.
 */
/** Every character shows the same number of badges, so every card is one size. */
export const TRAIT_COUNT = 3;

/**
 * Exactly three badges, one from each category: how to approach them, how they
 * react, and what they like talking about.
 *
 * The count is fixed on purpose. Deriving every applicable trait gave some
 * characters three badges and others six, so the card was a different height
 * for each one, and the ones with the most traits were the least readable —
 * Reina listed six, three of which were "Loves X" and told you nothing you
 * could act on differently. One per category keeps every card the same size
 * and guarantees the three facts are about three different things.
 */
export function traitsFor(archetypeId: ArchetypeId): Trait[] {
    const archetype = ARCHETYPES[archetypeId];

    // 1. Approach: whichever action family pays best with them.
    const approach: Trait[] = [];
    const best = (Object.entries(archetype.affinity) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    if (best) approach.push(FAMILY_TRAIT[best[0]] as Trait);

    // 2. Reaction: how much room there is between boredom and shutting down,
    //    and how fast the air goes back to normal.
    const reaction: Trait[] = [];
    const [lo, hi] = archetype.band;
    if (hi - lo >= 50) reaction.push({ icon: "🌊", label: "Hard to fluster" });
    else if (hi - lo <= 30) reaction.push({ icon: "⚡", label: "Easily overwhelmed" });
    if (lo >= 26) reaction.push({ icon: "🥂", label: "Bored by small talk" });
    if (archetype.tensionDecay >= 3.4) reaction.push({ icon: "🏃", label: "Cools off fast" });
    if (archetype.moodDrift >= 2.2) reaction.push({ icon: "☀️", label: "Warms up quickly" });
    // Catch-all so this category is never empty: an archetype with a middling
    // band, slow decay and slow drift matched none of the above, and topping up
    // from elsewhere gave those characters two "Loves X" badges — three facts
    // that were really only two.
    const mid = (lo + hi) / 2;
    if (mid >= 50) reaction.push({ icon: "🌶️", label: "Wants the air charged" });
    else if (mid <= 32) reaction.push({ icon: "🍵", label: "Likes it unhurried" });
    else reaction.push({ icon: "⚖️", label: "Keeps an even keel" });

    // 3. Interest: what they daydream about, straight from the bubble pool.
    const likes: Trait[] = archetype.likes.map((topic) => ({
        icon: TOPIC_GLYPH[topic],
        label: `Loves ${TOPIC_LABEL[topic]}`,
    }));

    const picked = [approach[0], reaction[0], likes[0]].filter(Boolean) as Trait[];
    // A category can come up empty — an archetype with a middling band, slow
    // decay and slow drift has no reaction badge — so top up from the runners
    // up rather than showing two badges for that one character.
    const spare = [...approach.slice(1), ...reaction.slice(1), ...likes.slice(1)];
    while (picked.length < TRAIT_COUNT && spare.length > 0) picked.push(spare.shift() as Trait);
    return picked.slice(0, TRAIT_COUNT);
}
