/** Shared vocabulary for the date simulation. */

/** Which family an action belongs to. Archetypes react per family. */
export type ActionFamily = "safe" | "warm" | "bold" | "intimate" | "risky";

/**
 * Pictogram vocabulary for thought bubbles. Nobody in this game speaks words —
 * a bubble shows one of these and the player infers the conversation from it,
 * the same way you read a Sims conversation.
 */
export type TopicId =
    | "food"
    | "cat"
    | "music"
    | "travel"
    | "movie"
    | "work"
    | "rain"
    | "stars"
    | "sport"
    | "art"
    | "heart"
    | "awkward";

export type ArchetypeId = "artist" | "tsundere" | "senpai" | "athlete" | "siren" | "charmer" | "competitor" | "zen";

/**
 * What a venue physically offers. "Order Food" at a plaza with no restaurant is
 * the clearest case of a move that reads as nonsense, so moves that need a
 * thing declare it and the deck only offers them where that thing exists.
 */
export type VenueFeature = "table" | "drinks" | "music" | "water" | "walk" | "seats";

/**
 * The six drawn poses each character has. The date scene swaps between them so
 * the cast visibly reacts instead of standing in one attitude all evening.
 */
export type Expression = "neutral" | "happy" | "sad" | "surprised" | "angry" | "in_love";

export const EXPRESSIONS: Expression[] = ["neutral", "happy", "sad", "surprised", "angry", "in_love"];

/** One drawn pose: its own silhouette, so its own metrics. */
export interface PoseEntry {
    src: string;
    w: number;
    h: number;
    /** Rows above the crown (raised arms, hair). */
    crownY: number;
    /** Crown-to-sole height in sprite pixels. What scaling derives from. */
    bodyPx: number;
}

/** One second of an action playing out: it gained, did nothing, or cost. */
export type SparkTick = 1 | 0 | -1;

export interface ActionDef {
    id: string;
    label: string;
    family: ActionFamily;
    /** Pictogram for the card and for the takeover panel while it plays out. */
    icon: string;
    /** Shown on the card so the player can plan without memorising numbers. */
    hint: string;
    /** Base spark before every multiplier. */
    spark: number;
    /** Immediate mood change, before archetype affinity. */
    mood: number;
    /** Immediate tension change. Bold actions cost tension; safe ones bleed it. */
    tension: number;
    /** Seconds before the card is playable again. */
    cooldown: number;
    /** Affection needed to unlock, 0..100. */
    unlockAt: number;
    /** Pays far more when it matches the partner's current bubble. */
    topicSensitive?: boolean;
    /** Consumes a gift from the inventory and matches against the bubble. */
    needsGift?: boolean;
    /** Ends the date immediately when played (confession). */
    decisive?: boolean;
    /** Only dealt at venues that have this. */
    needsFeature?: VenueFeature;
}

export interface ArchetypeDef {
    id: ArchetypeId;
    /** Never shown to the player — they infer it from reactions. */
    label: string;
    /** Tension must sit inside this band for spark to flow. */
    band: [number, number];
    /** Mood lost per second with no input. Fast-mood characters warm up quicker. */
    moodDrift: number;
    /** Tension bled per second. */
    tensionDecay: number;
    /** Per-family payoff multipliers. */
    affinity: Record<ActionFamily, number>;
    /** Topics they light up about. */
    likes: TopicId[];
    /** Actions that land flat or backfire for this personality. */
    dislikes: string[];
    /** Which topics they tend to raise. */
    talksAbout: TopicId[];
}

export interface CastMemberDef {
    id: string;
    name: string;
    archetype: ArchetypeId;
    heightCm: number;
    gender: "f" | "m";
    /** One-line description shown in the Little Black Book. */
    blurb: string;
    /**
     * The character's signature colour, used wherever they are represented —
     * their ring on the picker, their button, their affection meter. Pulled
     * from their own art so the UI feels like it belongs to them.
     */
    color: string;
}

export interface LocationDef {
    id: string;
    name: string;
    image: string;
    /** What is physically here. Gates moves that need props. */
    features: VenueFeature[];
    /**
     * Where the walkable floor is in the ORIGINAL painting, as a fraction of
     * its height — far enough onto it that floor is visible behind the cast.
     * Every painting puts its floor somewhere different: the beach deck starts
     * at 87%, the trattoria pavement at 60%. Standing the cast on a shared
     * constant puts them on the deck's far lip with sea at their soles, which
     * reads as standing in the water. reframe-backgrounds.mjs uses this to
     * shift each painting so its floor lands on the layout's ground line.
     */
    groundAsPainted: number;
    /**
     * How tall a REFERENCE_CM adult is in THIS painting, as a fraction of its
     * height. Optional; falls back to SOURCE_PERSON_HEIGHT.
     *
     * Each painting is generated with no human-scale reference, so its benches,
     * railings and doorways are drawn at whatever scale the generator felt
     * like. One global constant therefore cannot be right everywhere — get it
     * wrong and the cast towers over the furniture. Measure it per painting
     * against a known object (`npx tsx scripts/scale-ruler.mjs`).
     */
    personHeightFraction?: number;
    /** Affection across the whole book needed before it appears. */
    unlockAt: number;
    /** Location-wide nudges to the sim. */
    moodBonus: number;
    tensionRelief: number;
    /** Topics this place makes people think about. */
    topics: TopicId[];
    mood: string;
}

export interface GiftDef {
    id: string;
    name: string;
    image: string;
    price: number;
    /** A gift matching the partner's live bubble pays several times over. */
    topic: TopicId;
}
