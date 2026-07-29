/**
 * The date simulation.
 *
 * Renderer-free and deterministic given a seed, so it can be driven by the
 * headless balance harness (scripts/simulate-dates.mjs) as well as by the Pixi
 * scene. Nothing in here knows about sprites or the DOM.
 *
 * Three gauges drive everything:
 *
 *   mood     how well it is going. Multiplies every payoff.
 *   tension  how charged the air is. Spark only flows while tension sits
 *            inside the partner's archetype band — too cold and nothing is at
 *            stake, too hot and they shut down.
 *   spark    what you are actually earning. Banked into affection at the end.
 *
 * The band is the whole game: safe actions bleed tension, bold actions spike
 * it, and the bold actions are the only ones that pay well.
 */
import { ACTIONS_BY_ID } from "../data/actions.ts";
import { ARCHETYPES } from "../data/world.ts";
import type { ActionDef, ArchetypeDef, Expression, GiftDef, LocationDef, SparkTick, TopicId } from "../data/types.ts";

export type Verdict = "great" | "good" | "flat" | "bad";

export interface DateOutcome {
    actionId: string;
    verdict: Verdict;
    /**
     * Second-by-second, how the move went while it was happening. The scene
     * reveals one per second, so the player watches it play out instead of
     * being handed a number after a fixed countdown.
     */
    ticks: SparkTick[];
    spark: number;
    moodDelta: number;
    tensionDelta: number;
    /** Why it went the way it did — surfaced as a floating note. */
    note: string;
    /**
     * How they visibly take it. Computed here, from the same state that
     * produced the verdict and the note, so the face on screen can never
     * contradict the number beside it.
     */
    reaction: string[];
    /** Which drawn pose the partner should be standing in once this lands. */
    expression: Expression;
    topicMatched: boolean;
    endsDate: boolean;
}

export interface DateSimOptions {
    archetype: ArchetypeDef;
    location: LocationDef;
    /** Affection already banked with this person, 0..100. */
    affection: number;
    /** How many actions the evening is worth. */
    moves?: number;
    seed?: number;
    /**
     * The gift id tonight's company secretly hopes for. Gifting it is always a
     * strong match (DESIRED_GIFT_MULTIPLIER floor, on top of the usual topic
     * logic); anything else scores by the normal rules.
     */
    desiredGiftId?: string;
}

/**
 * What granting their wish is worth, at minimum: better than a like (1.8x),
 * short of meeting tonight's live topic (4x), so the live subject still wins
 * when the two coincide.
 */
export const DESIRED_GIFT_MULTIPLIER = 2.5;

/**
 * How long an evening runs, in decisions.
 *
 * A first date is short because you have no reason to linger with a stranger;
 * as the affection grows so does the evening. This also paces the whole game:
 * early dates are quick and cheap to retry, later ones are the long ones worth
 * planning.
 */
export const MIN_MOVES = 5;
export const MAX_MOVES = 15;

export function movesForAffection(affection: number): number {
    const span = MAX_MOVES - MIN_MOVES;
    return Math.round(MIN_MOVES + (clamp(affection, 0, 100) / 100) * span);
}

/** Mulberry32 — small, fast, and reproducible from a seed. */
function makeRng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Dead centre of the mood scale: not going well, not going badly. */
export const NEUTRAL_MOOD = 50;

/**
 * A move is not a fixed payout on a timer. Once started it runs second by
 * second, and each second rolls 1..100:
 *
 *   above PLUS      it lands, +1 spark
 *   NEUTRAL..PLUS   nothing happens this second
 *   END..NEUTRAL    the moment passes, the move ends
 *   below END       it misfires, -1 spark
 *
 * The thresholds below are the neutral case. Everything the sim used to fold
 * into one multiplied payoff — their taste in this family, whether it matches
 * what they are thinking about, whether the tension is in the band, how often
 * you have already done it — now bends these odds instead. A well-judged move
 * lands more often, misfires less, and lasts longer.
 */
const ROLL_PLUS = 60;
const ROLL_NEUTRAL = 40;
const ROLL_END = 20;
/**
 * Hard stop. At 12 about one move in sixteen ran the full length, and a single
 * action that takes eleven seconds is not a beat, it is a wait.
 */
const MAX_TICKS = 8;

/** A move ends as soon as its running total reaches this, either way. */
const SPARK_DECIDES = 3;

/**
 * Action cooldowns are authored in seconds (2..20). Reinterpreted as moves,
 * a 20 would lock a card for a whole date, so they are compressed to 1..4.
 */
function movesCooldown(seconds: number): number {
    return clamp(Math.round(seconds / 5), 1, 4);
}

/**
 * How much this person likes what you are about to do, as a visible term.
 *
 * The sim already folded taste into a multiplier, but the player could not see
 * it, so a move that was doomed by their personality looked identical to one
 * that was perfect for them until the dice had already spoken. This is the same
 * judgement, surfaced before the roll and applied on top of it.
 */
export interface ActionModifier {
    /** -3..+3. Positive shifts the roll toward landing. */
    value: number;
    tone: "up" | "flat" | "down";
    /** Short reason, shown beside the indicator. */
    reason: string;
}

/** A move in progress: its context, and the ticks rolled so far. */
interface ActionRun {
    action: ActionDef;
    gift: GiftDef | undefined;
    quality: number;
    modifier: ActionModifier;
    thresholds: { plus: number; neutral: number; end: number };
    ticks: SparkTick[];
    disliked: boolean;
    topicMatched: boolean;
    tensionBefore: number;
}

export class DateSim {
    readonly archetype: ArchetypeDef;
    readonly location: LocationDef;
    readonly affection: number;
    readonly moves: number;

    /**
     * 0..100 where 50 is neutral. Read as a deviation from the middle rather
     * than a bar that fills: starting a first date at "45% full" told the
     * player they were already failing before they had done anything.
     */
    mood = NEUTRAL_MOOD;
    tension = 20;
    spark = 0;
    /** Moves you have left tonight. A date is a hand of decisions, not a clock. */
    movesLeft: number;
    finished = false;

    /** What the partner is thinking about right now. */
    topic: TopicId;
    /**
     * What is on the table right now: two or three subjects they are open to,
     * at least one of which they actually love when the pool allows it.
     *
     * This is the skill layer. Before it, the one live topic was invisible and
     * a topic-sensitive move was a coin flip; now the player can read what is
     * live and choose a move that meets it, which is a decision rather than a
     * guess.
     */
    activeTopics: TopicId[] = [];
    /** Seconds until the bubble rotates on its own. */
    private topicTimer = 0;
    /** Last thing the player played, for the player-side bubble. */
    lastPlayerTopic: TopicId | null = null;

    private readonly rng: () => number;
    /** Seconds of presentation time the clock is paused for. */
    private heldFor = 0;
    /** The move currently playing out, rolled one second at a time. */
    private run: ActionRun | null = null;
    private readonly cooldowns = new Map<string, number>();
    /** Recent action ids, newest last — drives repetition decay. */
    private readonly recent: string[] = [];
    private readonly desiredGiftId: string | undefined;

    constructor(opts: DateSimOptions) {
        this.archetype = opts.archetype;
        this.location = opts.location;
        this.affection = opts.affection;
        this.desiredGiftId = opts.desiredGiftId;
        this.moves = opts.moves ?? movesForAffection(opts.affection);
        this.movesLeft = this.moves;
        this.rng = makeRng(opts.seed ?? 1);
        // Small tilts off neutral: a lovely venue and an established relationship
        // start you slightly warm, never at an arbitrary two-thirds.
        this.mood = clamp(NEUTRAL_MOOD + opts.location.moodBonus * 0.6 + opts.affection * 0.12, 0, 100);
        this.topic = this.pickTopic();
        this.activeTopics = this.pickActiveTopics();
        this.topicTimer = this.topicInterval();
    }

    // --- topics -------------------------------------------------------------

    /** In moves, not seconds. */
    private topicInterval(): number {
        return 2 + Math.floor(this.rng() * 2);
    }

    /** Bubbles come from what this person cares about, tinted by the venue. */
    private pickTopic(): TopicId {
        const pool = [...this.archetype.talksAbout, ...this.location.topics];
        // As affection climbs they start thinking about you instead.
        if (this.affection > 55) pool.push("heart", "heart");
        if (this.tension > this.archetype.band[1]) pool.push("awkward", "awkward");
        return pool[Math.floor(this.rng() * pool.length)] ?? "food";
    }

    rerollTopic(): void {
        const before = this.topic;
        for (let i = 0; i < 6 && this.topic === before; i++) this.topic = this.pickTopic();
        this.activeTopics = this.pickActiveTopics();
        this.topicTimer = this.topicInterval();
    }

    /**
     * The live subjects. Always includes whatever they are visibly thinking
     * about, and tries to include one they love, so there is usually a right
     * answer available rather than only a wrong one.
     */
    private pickActiveTopics(): TopicId[] {
        const chosen: TopicId[] = [this.topic];
        const loved = this.archetype.likes.filter((t) => t !== this.topic);
        if (loved.length > 0) {
            const pick = loved[Math.floor(this.rng() * loved.length)];
            if (pick) chosen.push(pick);
        }
        const rest = [...this.archetype.talksAbout, ...this.location.topics].filter((t) => !chosen.includes(t));
        if (rest.length > 0 && this.rng() < 0.6) {
            const pick = rest[Math.floor(this.rng() * rest.length)];
            if (pick) chosen.push(pick);
        }
        return chosen;
    }

    /** True when a topic is one of tonight's live subjects. */
    isActiveTopic(topic: TopicId): boolean {
        return this.activeTopics.includes(topic);
    }

    // --- the band -----------------------------------------------------------

    /**
     * How well the current tension serves you, 0..1.
     *
     * Full value inside the archetype's band, falling off outside it. Above the
     * band it collapses fast — that is the "they shut down" cliff.
     */
    tensionFactor(tension = this.tension): number {
        const [lo, hi] = this.archetype.band;
        if (tension < lo) return clamp(0.35 + (tension / Math.max(1, lo)) * 0.65, 0.2, 1);
        if (tension <= hi) return 1;
        const over = (tension - hi) / 30;
        return clamp(1 - over * 1.35, 0, 1);
    }

    inBand(): boolean {
        const [lo, hi] = this.archetype.band;
        return this.tension >= lo && this.tension <= hi;
    }

    // --- availability -------------------------------------------------------

    cooldownLeft(actionId: string): number {
        return Math.max(0, this.cooldowns.get(actionId) ?? 0);
    }

    isLocked(action: ActionDef): boolean {
        return this.affection < action.unlockAt;
    }

    /**
     * The date's own random stream, exposed so the deck can deal a hand from
     * it. Sharing the seeded stream rather than reaching for Math.random keeps
     * a replayed date identical, which is what the balance sweep depends on.
     */
    random(): number {
        return this.rng();
    }

    /**
     * How much this move suits the moment, as a weight for the deal.
     *
     * A uniformly random hand is why the deck felt arbitrary: it offered
     * intimate moves to strangers and small talk to someone already leaning in,
     * so no hand ever looked like a response to the situation. This scores each
     * move against the four things that actually decide its payoff, so the
     * cards in front of you are usually the ones worth considering.
     *
     * Never returns 0 for a legal move: the wrong move has to stay available,
     * or there is no decision to make.
     */
    /**
     * Play the move out second by second. `quality` is -1..1: at +1 the move
     * lands most seconds and rarely misfires, at -1 the reverse.
     */
    private thresholdsFor(quality: number, modifier: number): { plus: number; neutral: number; end: number } {
        // The modifier is the part the player was shown before they committed,
        // so it moves the odds by a visible, predictable amount; quality is the
        // finer context on top of it.
        const shift = quality * 12 + modifier * 5;
        const plus = clamp(ROLL_PLUS - shift, 28, 84);
        const neutral = clamp(ROLL_NEUTRAL - shift * 0.5, 22, plus - 4);
        const end = clamp(ROLL_END - shift * 0.35, 8, neutral - 4);
        return { plus, neutral, end };
    }

    /**
     * Whether they like this move, right now. Known before the dice are rolled,
     * because it comes from who they are and what they are thinking about.
     */
    modifierFor(action: ActionDef, gift?: GiftDef): ActionModifier {
        if (this.archetype.dislikes.includes(action.id)) {
            return { value: -3, tone: "down", reason: "They hate this" };
        }

        // Reasons carry their own weight, because the total can be flipped by a
        // later one: a move they are lukewarm about, on a topic they love, is a
        // net positive, and reporting the first reason found labelled that "not
        // their kind of move" under an upward arrow.
        const reasons: { delta: number; text: string }[] = [];

        const affinity = this.archetype.affinity[action.family];
        if (affinity >= 1.3) reasons.push({ delta: 1, text: "Their kind of move" });
        else if (affinity <= 0.8) reasons.push({ delta: -1, text: "Not their kind of move" });

        // What is live right now. Meeting a subject they LOVE while it is on
        // the table is the biggest single thing a player can do on purpose, so
        // it is worth the most — that is the skill the topic row is teaching.
        const giftTopic = action.needsGift && gift ? gift.topic : null;
        const topic = giftTopic ?? (action.topicSensitive ? this.topic : null);
        // Their wish reads as a wish, whatever the topic math says.
        if (action.needsGift && gift && gift.id === this.desiredGiftId) {
            reasons.push({ delta: 2, text: "Exactly what they wished for" });
        }
        if (topic) {
            const live = this.isActiveTopic(topic);
            const loved = this.archetype.likes.includes(topic);
            if (loved && live) reasons.push({ delta: 3, text: "Exactly what they want to talk about" });
            else if (loved) reasons.push({ delta: 1, text: "Something they like" });
            else if (live) reasons.push({ delta: 1, text: "On the table right now" });
            else if (topic === "awkward") reasons.push({ delta: -1, text: "Bad moment for it" });
            else reasons.push({ delta: -1, text: "Not what they want" });
        }

        const value = clamp(
            reasons.reduce((sum, r) => sum + r.delta, 0),
            -3,
            3,
        );
        const tone = value > 0 ? "up" : value < 0 ? "down" : "flat";
        // The loudest reason that actually points the way the total does.
        const dominant = reasons
            .filter((r) => (value > 0 ? r.delta > 0 : value < 0 ? r.delta < 0 : false))
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
        return { value, tone, reason: dominant?.text ?? "Nothing either way" };
    }

    /**
     * Where this move would leave the tension, relative to the band.
     *
     * The band is the whole economy of a date, but the player could only find
     * out where a move pushed them by playing it. Previewing it turns "pick a
     * card and see" into planning: bleed off before you overheat, build up
     * before you waste a good moment on a cold room.
     */
    bandAfter(action: ActionDef): "into" | "toward" | "stays" | "out" {
        const [lo, hi] = this.archetype.band;
        const distance = (t: number) => (t < lo ? lo - t : t > hi ? t - hi : 0);
        const before = this.tension;
        const after = clamp(before + action.tension, 0, 100);
        const wasInside = distance(before) === 0;
        const isInside = distance(after) === 0;

        if (isInside) return wasInside ? "stays" : "into";
        if (wasInside) return "out";
        // Already outside. "Which of these gets me back?" is the question the
        // player actually has here, and returning "stays" for everything left
        // it unanswered at exactly the moment it mattered most.
        return distance(after) < distance(before) - 1 ? "toward" : "stays";
    }

    /** False when the venue simply has not got what the move needs. */
    availableHere(action: ActionDef): boolean {
        return !action.needsFeature || this.location.features.includes(action.needsFeature);
    }

    affinityWeight(action: ActionDef): number {
        const [lo, hi] = this.archetype.band;
        let weight = 1;

        // 1. Who they are: the family they respond to, and what they hate.
        weight *= 0.4 + this.archetype.affinity[action.family];
        if (this.archetype.dislikes.includes(action.id)) weight *= 0.25;

        // 2. Where the tension sits. Below the band you need to raise it; above
        //    it you need to bleed it off.
        const raises = action.tension > 0;
        if (this.tension < lo) weight *= raises ? 2.2 : 0.5;
        else if (this.tension > hi) weight *= raises ? 0.3 : 2.4;

        // 3. What they are thinking about right now.
        if (action.topicSensitive && this.archetype.likes.includes(this.topic)) weight *= 2.2;

        // 4. Where the venue points. A beach terrace should not keep offering
        //    the same moves as a trattoria.
        if (action.topicSensitive && this.location.topics.includes(this.topic)) weight *= 1.5;
        if (this.location.tensionRelief > 0.2 && raises) weight *= 1.2;

        // Repetition pushes a card down the deal as well as down the payoff.
        weight *= this.repetitionFactor(action.id);

        return Math.max(0.05, weight);
    }

    // --- time ---------------------------------------------------------------

    /**
     * Freeze the evening while a move plays out on screen.
     *
     * The beat after an action is presentation, not game time. Without this,
     * making moves readable would quietly halve how much you can do in a date
     * and change the balance of every archetype along with it.
     */
    hold(seconds: number): void {
        this.heldFor = Math.max(this.heldFor, seconds);
    }

    /**
     * Presentation only. Nothing about the date advances with wall-clock time
     * any more, so this exists purely to let the scene run its beat.
     */
    update(dt: number): void {
        if (this.heldFor > 0) this.heldFor = Math.max(0, this.heldFor - dt);
    }

    /**
     * The world moves on by one beat. Called once per action, never on a timer.
     *
     * Drift is deliberately gentle: at twelve moves a date, the old per-second
     * sag wiped out a good mood between two taps and made the mood bar feel
     * like a leak rather than a reading of how it is going.
     */
    private advanceTurn(): void {
        this.mood = clamp(this.mood - this.archetype.moodDrift * 0.8, 0, 100);
        const decay = this.archetype.tensionDecay * (1 + this.location.tensionRelief) * 0.7;
        this.tension = clamp(this.tension - decay, 0, 100);

        for (const [id, left] of this.cooldowns) {
            const next = left - 1;
            if (next <= 0) this.cooldowns.delete(id);
            else this.cooldowns.set(id, next);
        }

        this.topicTimer -= 1;
        if (this.topicTimer <= 0) this.rerollTopic();

        this.movesLeft = Math.max(0, this.movesLeft - 1);
        if (this.movesLeft <= 0) this.finished = true;
    }

    // --- playing an action --------------------------------------------------

    /**
     * How many of the last six moves were this same action. Repetition decays
     * payoff hard, so spamming the one card that works stops working.
     */
    repetitionFactor(actionId: string): number {
        const uses = this.recent.slice(-6).filter((id) => id === actionId).length;
        return 0.55 ** uses;
    }

    /**
     * Roll the whole move at once. Used by the headless balance harness and by
     * anything that does not need to watch it happen.
     */
    play(actionId: string, gift?: GiftDef): DateOutcome {
        this.beginAction(actionId, gift);
        let step = this.stepAction();
        while (!("outcome" in step)) step = this.stepAction();
        return step.outcome;
    }

    /**
     * Start a move without resolving it.
     *
     * Split from play() because pre-rolling the whole sequence let the UI draw
     * one pip per upcoming second, which told the player exactly how long the
     * moment would last before a single second of it had happened. The point of
     * a roll is not knowing.
     */
    beginAction(actionId: string, gift?: GiftDef): void {
        const action = ACTIONS_BY_ID[actionId];
        if (!action) throw new Error(`unknown action ${actionId}`);

        const archetype = this.archetype;
        const tensionAtStart = this.tension;

        const repetition = this.repetitionFactor(actionId);
        const affinity = archetype.affinity[action.family];
        const disliked = archetype.dislikes.includes(actionId);

        // Topic match. A gift chosen for what they are actually thinking about
        // is worth several times a random one; a topic-sensitive action on a
        // topic they like is worth a lot more than on one they do not.
        let topicMultiplier = 1;
        let topicMatched = false;
        if (action.needsGift && gift) {
            if (gift.topic === this.topic) {
                topicMultiplier = 4;
                topicMatched = true;
            } else if (archetype.likes.includes(gift.topic)) {
                topicMultiplier = 1.8;
                topicMatched = true;
            } else {
                topicMultiplier = 0.7;
            }
            // Their wish, granted: always a strong gift even when tonight's
            // subject is something else entirely. It lifts, never overrides.
            if (gift.id === this.desiredGiftId) {
                topicMultiplier = Math.max(topicMultiplier, DESIRED_GIFT_MULTIPLIER);
                topicMatched = true;
            }
        } else if (action.topicSensitive) {
            if (archetype.likes.includes(this.topic)) {
                topicMultiplier = 1.7;
                topicMatched = true;
            } else if (this.topic === "awkward") {
                topicMultiplier = 0.5;
            }
        }

        // `Stare` is the clearest case of one row behaving like several moves:
        // unreadable early, devastating once she is already thinking about you.
        if (actionId === "stare") {
            if (this.affection < 25) topicMultiplier *= 0.35;
            else if (this.topic === "heart") topicMultiplier *= 2.6;
        }

        const moodFactor = 0.25 + (this.mood / 100) * 0.95;
        const bandFactor = this.tensionFactor();
        const familiarity = 1 + this.affection / 220;
        const dislikePenalty = disliked ? 0.35 : 1;

        let spark =
            action.spark *
            repetition *
            affinity *
            topicMultiplier *
            moodFactor *
            bandFactor *
            familiarity *
            dislikePenalty;

        // "Push Too Far" is a genuine coin flip weighted by how well it is going.
        if (actionId === "push") {
            const lands = this.rng() < clamp(0.25 + this.mood / 260 + this.affection / 340, 0.1, 0.75);
            spark *= lands ? 1.6 : 0;
            if (!lands) this.mood -= 10;
        }

        // The multiplied payoff becomes a QUALITY, -1..1, which bends the roll
        // rather than being handed over as a number.
        const quality = clamp((spark / Math.max(1, action.spark) - 1) * 1.15, -1, 1);
        const modifier = this.modifierFor(action, gift);
        this.run = {
            action,
            gift,
            quality,
            modifier,
            thresholds: this.thresholdsFor(quality, modifier.value),
            ticks: [],
            disliked,
            topicMatched,
            tensionBefore: tensionAtStart,
        };
    }

    /**
     * Advance the current move by one second. Returns the tick that just
     * happened, or the finished outcome when the roll ends it.
     */
    stepAction(): { tick: SparkTick } | { outcome: DateOutcome } {
        const run = this.run;
        if (!run) throw new Error("stepAction with no action in progress");

        const { plus, neutral, end } = run.thresholds;
        const roll = 1 + Math.floor(this.rng() * 100);
        const running = run.ticks.reduce<number>((sum, tick) => sum + tick, 0);
        // A moment resolves once it has clearly gone one way: three good
        // seconds is a moment that landed, three bad ones is a moment that
        // died. Without this a run could dribble on for eight seconds and end
        // on the same +1 it reached in two.
        const decided = Math.abs(running) >= SPARK_DECIDES;
        const overrun = decided || run.ticks.length >= MAX_TICKS;

        if (!overrun) {
            if (roll > plus) {
                run.ticks.push(1);
                return { tick: 1 };
            }
            if (roll >= neutral) {
                run.ticks.push(0);
                return { tick: 0 };
            }
            if (roll < end) {
                run.ticks.push(-1);
                return { tick: -1 };
            }
        }
        // A move always takes at least a beat, or it resolves to nothing on
        // screen and reads as a dead button.
        if (run.ticks.length === 0) {
            run.ticks.push(0);
            return { tick: 0 };
        }
        return { outcome: this.finishAction() };
    }

    private finishAction(): DateOutcome {
        const run = this.run;
        if (!run) throw new Error("finishAction with no action in progress");
        this.run = null;

        const { action, ticks, disliked, topicMatched, tensionBefore } = run;
        const actionId = action.id;
        const beforeMood = this.mood;
        const beforeTension = this.tension;
        const spark = ticks.reduce<number>((sum, tick) => sum + tick, 0);

        let moodDelta = action.mood * (disliked ? -0.6 : 1);
        if (moodDelta > 0) moodDelta *= 0.6 + this.tensionFactor() * 0.6;
        const prematureBold =
            (action.family === "bold" || action.family === "intimate") && this.affection < action.unlockAt + 15;
        let tensionDelta = action.tension * (prematureBold ? 1.5 : 1);
        if (disliked && tensionDelta > 0) tensionDelta *= 1.4;

        this.mood = clamp(this.mood + moodDelta, 0, 100);
        this.tension = clamp(this.tension + tensionDelta, 0, 100);
        this.spark = Math.max(0, this.spark + spark);

        // Cooldowns are in MOVES now, so a 12s cooldown would outlast the date.
        this.cooldowns.set(actionId, movesCooldown(action.cooldown));
        this.recent.push(actionId);
        if (this.recent.length > 12) this.recent.shift();
        this.lastPlayerTopic = action.needsGift && run.gift ? run.gift.topic : topicHintFor(action);

        if (actionId === "change-topic") this.rerollTopic();

        const verdictAction = action;
        this.advanceTurn();
        if (verdictAction.decisive) this.finished = true;

        const verdict = this.verdictFor(spark, ticks, disliked, topicMatched);
        return {
            actionId,
            verdict,
            ticks,
            spark,
            moodDelta: this.mood - beforeMood,
            tensionDelta: this.tension - beforeTension,
            note: this.noteFor(action, verdict, spark, topicMatched, disliked, tensionBefore),
            reaction: this.reactionFor(verdict, disliked, tensionBefore),
            expression: this.expressionFor(verdict, disliked, tensionBefore),
            topicMatched,
            endsDate: action.decisive === true,
        };
    }

    /**
     * Judged on the ROLL, not on the action's authored spark value.
     *
     * These thresholds were written when spark was a multiplied payoff in the
     * tens; spark is now a count of seconds that landed, so comparing it to
     * `action.spark` made a +2 on a 6-spark action read as "flat" and put a
     * blank face on a move the panel was calling a good read. The verdict must
     * be derived from the same number the player is shown.
     */
    private verdictFor(spark: number, ticks: SparkTick[], disliked: boolean, matched: boolean): Verdict {
        if (disliked || spark < 0) return "bad";
        if (spark === 0) return "flat";
        const landed = ticks.filter((tick) => tick > 0).length;
        const clean = landed === ticks.length && ticks.length >= 2;
        if (spark >= 4 || clean || (matched && spark >= 3)) return "great";
        // Any spark at all means it went somewhere. "Flat" is reserved for a
        // move that genuinely achieved nothing, or the player learns to ignore
        // the word.
        return "good";
    }

    /**
     * Which of the six drawn poses this moment calls for.
     *
     * Same precedence as the emoji it sits under, so the body language and the
     * face can never tell different stories: what they hate reads as anger,
     * being pushed past their limit reads as surprise, a great moment inside
     * the band reads as love.
     */
    expressionFor(verdict: Verdict, disliked: boolean, tensionBefore: number): Expression {
        const [lo, hi] = this.archetype.band;
        if (disliked) return "angry";
        if (tensionBefore > hi) return "surprised";
        if (this.mood < 28) return "sad";
        switch (verdict) {
            case "great":
                return this.tension >= lo ? "in_love" : "happy";
            case "good":
                return "happy";
            case "bad":
                return this.mood < 45 ? "sad" : "angry";
            default:
                return "neutral";
        }
    }

    /** The pose to stand in between moves, from the gauges alone. */
    idleExpression(): Expression {
        const [lo, hi] = this.archetype.band;
        if (this.tension > hi) return "surprised";
        if (this.mood < 30) return "sad";
        if (this.mood > 72 && this.tension >= lo) return "in_love";
        if (this.mood > 58) return "happy";
        return "neutral";
    }

    /** One second of a move, as a pose. */
    tickExpression(tick: SparkTick): Expression {
        if (tick > 0) return this.mood > 66 ? "in_love" : "happy";
        if (tick < 0) return this.tension > this.archetype.band[1] ? "surprised" : "sad";
        return "neutral";
    }

    /**
     * The face they pull, from the same facts as the verdict and the note.
     *
     * Context outranks the raw result: a move that technically landed while
     * they are overheating or sinking should not show delight, because the
     * thing the player most needs to see is the state they are in.
     */
    private reactionFor(verdict: Verdict, disliked: boolean, tensionBefore: number): string[] {
        const [lo, hi] = this.archetype.band;
        if (disliked) return ["😒"];
        if (tensionBefore > hi) return ["😳", "💦"];
        if (this.mood < 28) return ["😔"];
        switch (verdict) {
            case "great":
                return this.tension >= lo ? ["😍", "💖"] : ["😄", "💗"];
            case "good":
                return ["😊", "💗"];
            case "bad":
                return ["😖", "💦"];
            default:
                // Nothing happened. A smile here reads as approval the player
                // did not earn, which is exactly the wrong signal on a 0.
                return this.tension < lo ? ["😶"] : ["😐"];
        }
    }

    /**
     * Why it went the way it did, in the player's terms.
     *
     * Rewritten because the old version could say "They're not feeling it"
     * over a +1: the verdict and the sentence were derived from different
     * things, so they contradicted each other. Now the sentence names the ONE
     * factor that mattered most, checked in the order the sim actually applied
     * them, and it always agrees with the number on screen.
     */
    private noteFor(
        action: ActionDef,
        verdict: Verdict,
        spark: number,
        matched: boolean,
        disliked: boolean,
        tensionBefore: number,
    ): string {
        const [lo, hi] = this.archetype.band;
        const repeated = this.recent.slice(-6).filter((id) => id === action.id).length;

        // Hard blocks first: these override everything else about the move.
        if (disliked) return "They hate that. Never with them.";
        if (tensionBefore > hi) return "Too charged. Back off and let it cool.";

        // Then the VERDICT, before any observation about the move. A negative
        // roll used to fall through to "Good read." purely because the topic
        // matched, so the sentence flatly contradicted the number beside it.
        if (verdict === "bad") {
            if (matched) return "Right subject, wrong moment.";
            if (repeated >= 2) return "You have done that once too often.";
            return "That misfired. They did not take it well.";
        }

        if (repeated >= 2 && spark <= 1) return "You keep doing that. It is wearing thin.";
        if (matched && verdict === "great") return "Straight to what they were thinking about.";
        if (matched) return "That is on their mind. Good read.";
        if (tensionBefore < lo) {
            // Describes the AIR, not the move: this branch fires for a gift or
            // a kiss just as readily as for small talk.
            return verdict === "flat"
                ? "Nothing at stake yet. Be bolder."
                : "The air is still too cool for that to land hard.";
        }
        if (this.mood < 30) return "Their mood is low. Lift it before pushing.";
        if (verdict === "great") return "Perfectly judged.";
        if (verdict === "good") return "That landed.";
        if (action.family === "safe") return "Pleasant, but it is only small talk.";
        return "Barely registered.";
    }

    /**
     * Affection earned, banked when the date ends.
     *
     * The divisor grows with the affection you already have. Without that, a
     * flat rate makes late dates trivially huge — high affection unlocks the
     * biggest cards, so even a bot pressing at random out-earns a careful
     * player's first evening, and a hard cap instead of a curve flattens every
     * strategy onto the same number. Tuned against scripts/simulate-dates.mjs:
     * a careless date is worth ~3, a well-read one ~18, and moving the last
     * stretch from 85 to 100 takes real reading.
     */
    /**
     * Diminishing returns, recalibrated for a twelve-move date.
     *
     * Rescaled again for the per-second roll: spark is now a count of seconds
     * that landed minus seconds that misfired, so a whole evening is a small
     * integer (about 3 on a first date, about 22 on a long one) rather than
     * hundreds. Same diminishing-returns shape, a much coarser scale.
     */
    affectionGain(): number {
        return Math.round(this.spark / (0.35 + this.affection * 0.013));
    }
}

/** What the player's own bubble shows after an action. */
function topicHintFor(action: ActionDef): TopicId {
    switch (action.family) {
        case "intimate":
            return "heart";
        case "bold":
            return "heart";
        case "risky":
            return "awkward";
        default:
            return "music";
    }
}

export function archetypeFor(id: keyof typeof ARCHETYPES): ArchetypeDef {
    return ARCHETYPES[id];
}
