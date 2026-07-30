/**
 * The in-date HUD: three gauges and the action deck.
 *
 * The deck deals a HAND rather than listing everything. With ~75 moves in the
 * pool a full list would be a wall of text you scroll instead of read, and the
 * same wall every date. Six cards per family are face up; playing one puts it
 * on cooldown and deals a replacement, so the deck keeps changing under you.
 *
 * Playing a move takes over the whole deck for its duration. That is not just
 * decoration: it stops the deck being a button-mashing surface, and it is the
 * only moment the game can show you WHY something landed the way it did.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { store, useStore } from "../../state/store.ts";
import { dateControls } from "../../game/GameCanvas.tsx";
import {
    ACTIONS,
    ACTIONS_BY_ID,
    FAMILY_ICON,
    FAMILY_LABEL,
    FAMILY_ORDER,
    HAND_SIZE,
    TICK_SECONDS,
} from "../../game/data/actions.ts";
import { GIFTS_BY_ID, TOPIC_GLYPH, TOPIC_LABEL, TOPIC_SHORT } from "../../game/data/world.ts";
import { consumeGift } from "../../state/profile.ts";
import { audioManager } from "../../audio/audioManager.ts";
import { useProfile } from "./useProfile.ts";
import type { ActionDef, ActionFamily, SparkTick, TopicId } from "../../game/data/types.ts";
import { NEUTRAL_MOOD, type ActionModifier, type Verdict } from "../../game/sim/dateSim.ts";

const NEUTRAL_MODIFIER: ActionModifier = { value: 0, tone: "flat", reason: "Nothing either way" };

/** A move mid-performance: owns the deck until the player continues. */
interface Performing {
    action: ActionDef;
    verdict: Verdict;
    note: string;
    spark: number;
    /** Ticks rolled SO FAR. The length is unknown until the roll ends it. */
    ticks: SparkTick[];
    /** Set once the roll finishes; until then the move is still happening. */
    settled: boolean;
    /** How they feel about this move, known before the first tick. */
    modifier: ActionModifier;
    /** Shown as deltas beside the gauges, so a moving bar says what moved it. */
    moodDelta: number;
    tensionDelta: number;
    startedAt: number;
}

const VERDICT_CUE: Record<Verdict, "reward" | "charm" | "tap" | "fumble"> = {
    great: "reward",
    good: "charm",
    flat: "tap",
    bad: "fumble",
};

/** What a move does to the tension, relative to the band. */
const BAND_ICON: Record<string, string> = { into: "🎯", toward: "↗", out: "⚠️", stays: "" };
const BAND_HINT: Record<string, string> = {
    into: "Lands the tension in the sweet spot",
    toward: "Moves the tension toward the sweet spot",
    out: "Pushes the tension out of the sweet spot",
    stays: "",
};

/** How strongly they feel about a move, at a glance. */
function modArrows(value: number): string {
    if (value >= 3) return "▲▲";
    if (value > 0) return "▲";
    if (value <= -3) return "▼▼";
    if (value < 0) return "▼";
    return "=";
}

const TICK_MS = TICK_SECONDS * 1000;

function tickClass(tick: SparkTick): string {
    if (tick > 0) return "is-plus";
    if (tick < 0) return "is-minus";
    return "is-zero";
}

/** Where the mood fill sits, growing out of the centre in either direction. */
function moodFillStyle(mood: number): React.CSSProperties {
    const offset = (mood - NEUTRAL_MOOD) / 2; // percent of the full bar
    return offset >= 0 ? { left: "50%", width: `${offset}%` } : { left: `${50 + offset}%`, width: `${-offset}%` };
}

function moodWord(mood: number): string {
    if (mood >= 78) return "Delighted";
    if (mood >= 62) return "Warm";
    if (mood >= 42) return "Neutral";
    if (mood >= 26) return "Cooling";
    return "Losing them";
}

function tensionWord(tension: number, band: readonly [number, number] | number[]): string {
    if (tension < (band[0] ?? 0)) return "Too cool";
    if (tension > (band[1] ?? 100)) return "Too hot";
    return "In the zone";
}

/**
 * One line telling the player what to do next.
 *
 * "Nothing at stake." described a state without naming a cause or an action,
 * which is the definition of cryptic. Every line here ends in a verb.
 */
function coachFor(
    tension: number,
    band: readonly [number, number] | number[],
    mood: number,
): { icon: string; text: string; tone: string } {
    const lo = band[0] ?? 0;
    const hi = band[1] ?? 100;
    if (tension > hi) return { icon: "🥵", text: "Too intense. Play safe.", tone: "hot" };
    if (tension < lo) return { icon: "🧊", text: "Too polite to count. Be bolder.", tone: "cold" };
    if (mood < 34) return { icon: "🌧️", text: "Mood is sinking. Lift it.", tone: "cold" };
    return { icon: "✨", text: "They are with you. Moves pay now.", tone: "good" };
}

/** A signed change beside a gauge label. Nothing at all when there is none. */
function Delta({ value }: { value: number | undefined }) {
    if (!value || Math.round(value) === 0) return null;
    const up = value > 0;
    return (
        <span className={`koi-gauge-delta ${up ? "is-up" : "is-down"}`}>
            {up ? "+" : ""}
            {Math.round(value)}
        </span>
    );
}

export default function DateHud() {
    const gauges = useStore((s) => s.gauges);
    const selectedGift = useStore((s) => s.selectedGift);
    const profile = useProfile();
    const [, forceTick] = useState(0);
    // "gift" is a pseudo-family: it lists what is in your bag rather than a
    // slice of ACTIONS, because a bag can hold any number of things and the old
    // single row beside the move counter had room for about three.
    const [openFamily, setOpenFamily] = useState<ActionFamily | "gift">("safe");
    const [performing, setPerforming] = useState<Performing | null>(null);
    /** The move before this one, kept on screen so you can see what it did. */
    const [lastMove, setLastMove] = useState<{ icon: string; label: string; spark: number; mood: number } | null>(null);
    // One hand per family, so switching tabs does not reshuffle what you were
    // already looking at.
    const [hands, setHands] = useState<Record<string, string[]>>({});

    // Cooldown rings and the takeover countdown need to move, but nothing else
    // here does. One local timer is far cheaper than pushing the sim's clock
    // through the store.
    useEffect(() => {
        const id = window.setInterval(() => forceTick((n) => n + 1), 100);
        return () => window.clearInterval(id);
    }, []);

    const sim = dateControls.sim;
    const affection = sim?.affection ?? 0;
    const ownedGifts = Object.entries(profile.inventory).filter(([, n]) => n > 0);
    // Tonight's wish, drawn by the sim at date start. Once granted, the pill
    // hides and the card locks: one wish per evening.
    const wishGift = GIFTS_BY_ID[sim?.wishGiftId ?? ""];
    const wishGranted = sim?.wishGranted ?? false;
    const sortedGifts = [...ownedGifts].sort(([a], [b]) => Number(b === wishGift?.id) - Number(a === wishGift?.id));

    /**
     * Deal `count` playable moves from a family, preferring ones not already in
     * hand. Locked moves are still dealt so the deck advertises what is coming;
     * they render disabled with their unlock threshold.
     */
    // Reads dateControls.sim itself rather than closing over it: that handle is
    // a mutable module binding, not React state, so capturing it in a dep array
    // would be a promise React cannot keep.
    const deal = useCallback((family: ActionFamily, keep: string[], count: number): string[] => {
        const sim = dateControls.sim;
        // The venue gates the pool before anything else: no ordering food in a
        // public square.
        const pool = ACTIONS.filter(
            (a) => a.family === family && !keep.includes(a.id) && (!sim || sim.availableHere(a)),
        );
        const rand = () => sim?.random() ?? 0.5;
        const picked: string[] = [];
        const bag = pool.map((a) => ({ action: a, weight: sim ? sim.affinityWeight(a) : 1 }));

        // Weighted draw, so the hand reflects who you are with, where you are
        // and how charged the air is — not a shuffle of everything that exists.
        while (picked.length < count && bag.length > 0) {
            let total = 0;
            for (const entry of bag) total += entry.weight;
            let roll = rand() * total;
            let index = bag.length - 1;
            for (let i = 0; i < bag.length; i++) {
                roll -= bag[i]?.weight ?? 0;
                if (roll <= 0) {
                    index = i;
                    break;
                }
            }
            const [taken] = bag.splice(index, 1);
            if (taken) picked.push(taken.action.id);
        }
        return [...keep, ...picked];
    }, []);

    // Deal the opening hands as soon as the sim exists. No dep array: the sim
    // arrives asynchronously and is not reactive, so this rides the tick above
    // and guards itself.
    const dealt = useRef(false);
    useEffect(() => {
        if (dealt.current || !dateControls.sim) return;
        dealt.current = true;
        const opening: Record<string, string[]> = {};
        for (const family of FAMILY_ORDER) opening[family] = deal(family, [], HAND_SIZE);
        setHands(opening);
    });

    // Drive the roll: one second per tick while it is still happening, then a
    // beat on the result before the deck returns.
    useEffect(() => {
        if (!performing || performing.settled || !dateControls.step) return;
        const id = window.setTimeout(() => {
            const step = dateControls.step?.();
            if (!step) return;
            if ("tick" in step) {
                audioManager.play(step.tick > 0 ? "charm" : step.tick < 0 ? "fumble" : "tap");
                setPerforming((current) => (current ? { ...current, ticks: [...current.ticks, step.tick] } : current));
                return;
            }
            const { outcome } = step;
            audioManager.play(VERDICT_CUE[outcome.verdict]);
            setPerforming((current) =>
                current
                    ? {
                          ...current,
                          settled: true,
                          verdict: outcome.verdict,
                          note: outcome.note,
                          spark: outcome.spark,
                          moodDelta: outcome.moodDelta,
                          tensionDelta: outcome.tensionDelta,
                      }
                    : current,
            );
        }, TICK_MS);
        return () => window.clearTimeout(id);
    }, [performing]);

    /**
     * Hand the deck back. Driven by the player, not a timer: the result is the
     * one moment the game explains itself, and snatching it away after a fixed
     * beat meant reading it was a race.
     */
    const dismissPerforming = useCallback(() => {
        if (!performing?.settled) return;
        const family = performing.action.family;
        setHands((current) => {
            const without = (current[family] ?? []).filter((id) => id !== performing.action.id);
            return { ...current, [family]: deal(family, without, HAND_SIZE - without.length) };
        });
        setLastMove({
            icon: performing.action.icon,
            label: performing.action.label,
            spark: performing.spark,
            mood: Math.round(performing.moodDelta),
        });
        setPerforming(null);
        dateControls.rest?.();
        // The evening ends here, not when the sim ran out of moves: the last
        // move's result has to be readable before the results screen replaces
        // the whole scene.
        if (dateControls.sim?.finished) dateControls.finish?.();
    }, [performing, deal]);

    /**
     * Give a specific gift. Tapping the thing itself is the whole interaction —
     * the old flow was "select a chip, then find the Gift card in the intimate
     * family", which is two steps and a hunt.
     */
    const playGift = (giftId: string) => {
        const action = ACTIONS_BY_ID.gift;
        if (!action || !dateControls.begin || performing) return;
        if (!consumeGift(giftId)) {
            audioManager.play("error");
            store.patch({ toast: "That is not in your bag." });
            return;
        }
        const modifier = dateControls.sim?.modifierFor(action, GIFTS_BY_ID[giftId]) ?? NEUTRAL_MODIFIER;
        if (!dateControls.begin(action.id, GIFTS_BY_ID[giftId])) return;
        setPerforming({
            action,
            verdict: "flat",
            note: "",
            spark: 0,
            moodDelta: 0,
            tensionDelta: 0,
            ticks: [],
            settled: false,
            modifier,
            startedAt: performance.now(),
        });
    };

    const playAction = (action: ActionDef) => {
        if (!dateControls.begin || performing) return;

        let gift: (typeof GIFTS_BY_ID)[string] | undefined;
        if (action.needsGift) {
            const giftId = selectedGift ?? ownedGifts[0]?.[0];
            if (!giftId || !consumeGift(giftId)) {
                audioManager.play("error");
                store.patch({ toast: "No gift in the bag." });
                return;
            }
            gift = GIFTS_BY_ID[giftId];
            if (store.get().selectedGift) store.patch({ selectedGift: null });
        }

        const modifier = dateControls.sim?.modifierFor(action, gift) ?? NEUTRAL_MODIFIER;
        if (!dateControls.begin(action.id, gift)) return;
        setPerforming({
            action,
            verdict: "flat",
            note: "",
            spark: 0,
            moodDelta: 0,
            tensionDelta: 0,
            ticks: [],
            settled: false,
            modifier,
            startedAt: performance.now(),
        });
    };

    const band = sim?.archetype.band ?? [20, 60];
    const movesLeft = gauges.movesLeft;
    const projectedHearts = sim ? Math.round(gauges.spark / (3.9 + sim.affection * 0.2)) : 0;
    const coach = coachFor(gauges.tension, band, gauges.mood);
    const activeTopics = gauges.activeTopics ?? [];
    // Recomputed per render rather than memoised: both depend on live tension
    // and the current topics, so a stale value would be worse than useless.
    const cardMod = (action: ActionDef) => sim?.modifierFor(action) ?? NEUTRAL_MODIFIER;
    const cardBand = (action: ActionDef) => sim?.bandAfter(action) ?? "stays";

    const running = performing ? performing.ticks.reduce<number>((a, b) => a + b, 0) : 0;

    return (
        <div className="koi-hud">
            {/* Gauges and the reading chip are wrapped so landscape can lay
                them out as a single row without reordering the DOM. */}
            <div className="koi-hud-header">
                <div className="koi-gauges">
                    {/* Every gauge names itself, then reads itself out. The bars
                        alone said "NEUTRAL" and "IN THE MOMENT" with no clue
                        what was being measured or which way was good. */}
                    <div className="koi-gauge">
                        <span className="koi-gauge-head">
                            {/* No decorative icon here. A static 💗 beside a
                                reading of "Neutral" claims warmth the gauge is
                                not reporting; the end caps below carry the
                                direction and the word carries the value. */}
                            <span className="koi-gauge-name">Mood</span>
                            <span className="koi-gauge-state">
                                {moodWord(gauges.mood)}
                                <Delta value={performing?.moodDelta} />
                            </span>
                        </span>
                        {/* Ends are marked, so which direction is good needs no
                            explaining. */}
                        <div className="koi-scale">
                            <span className="koi-scale-end">☹</span>
                            <div className={`koi-bipolar ${performing ? "is-moving" : ""}`}>
                                <i className="koi-bipolar-centre" />
                                <span
                                    className={gauges.mood >= NEUTRAL_MOOD ? "is-warm" : "is-cool"}
                                    style={moodFillStyle(gauges.mood)}
                                />
                            </div>
                            <span className="koi-scale-end">☺</span>
                        </div>
                    </div>

                    <div className="koi-gauge">
                        <span className="koi-gauge-head">
                            {/* Likewise: a fixed 🔥 next to a marker sitting in
                                the cold zone contradicts the bar underneath it. */}
                            <span className="koi-gauge-name">Tension</span>
                            <span className="koi-gauge-state">
                                {tensionWord(gauges.tension, band)}
                                <Delta value={performing?.tensionDelta} />
                            </span>
                        </span>
                        {/* Three named zones rather than a fill with a stripe
                            over it: too cool, the sweet spot, too intense. The
                            marker is where they are, so the instruction is
                            simply "keep it in the green". */}
                        <div className="koi-scale">
                            <span className="koi-scale-end">🧊</span>
                            <div className={`koi-zones ${gauges.inBand ? "is-in-band" : ""}`}>
                                <i className="koi-zone is-cold" style={{ width: `${band[0]}%` }} />
                                <i className="koi-zone is-good" style={{ width: `${band[1] - band[0]}%` }} />
                                <i className="koi-zone is-hot" style={{ width: `${100 - band[1]}%` }} />
                                <i className="koi-tension-marker" style={{ left: `${gauges.tension}%` }} />
                            </div>
                            <span className="koi-scale-end">🥵</span>
                        </div>
                    </div>

                    {/* Spark alone answers nothing. What the player wants to know
                        is what tonight is worth, so show the hearts it converts
                        to at the current total. */}
                    <div className="koi-gauge koi-gauge-spark">
                        <span className="koi-gauge-name">Tonight</span>
                        <strong>+{projectedHearts}♥</strong>
                    </div>
                </div>

                {/* What is on the table. Without this the topic bonus was
                    invisible and picking a topic-sensitive move was a guess. */}
                {activeTopics.length > 0 && (
                    <div className="koi-topics">
                        <span className="koi-topics-label">Wants to talk about</span>
                        {activeTopics.map((topic) => (
                            <span key={topic} className="koi-topic-chip" title={TOPIC_LABEL[topic as TopicId] ?? topic}>
                                {TOPIC_GLYPH[topic as TopicId] ?? "?"} <em>{TOPIC_SHORT[topic as TopicId]}</em>
                            </span>
                        ))}
                    </div>
                )}

                {/* Their wish, out in the open from the first second, gone the
                    moment it is granted. */}
                {wishGift && !wishGranted && (
                    <div className="koi-wish" title={`${wishGift.name} is always a strong gift tonight`}>
                        <span className="koi-wish-label">Wishes for</span>
                        <img className="koi-wish-art" src={wishGift.image} alt="" />
                        <span className="koi-wish-name">{wishGift.name}</span>
                    </div>
                )}
                <div className={`koi-coach koi-coach-${coach.tone}`}>
                    <span className="koi-coach-icon" aria-hidden="true">
                        {coach.icon}
                    </span>
                    <span>{coach.text}</span>
                </div>
            </div>

            <div className="koi-hud-foot">
                {/* Bottom left, next to the deck it limits, rather than tucked
                    in the top corner next to numbers it has nothing to do with. */}
                <div className="koi-moves">
                    <strong>{movesLeft}</strong>
                    <span>{movesLeft === 1 ? "move left" : "moves left"}</span>
                </div>

                {/* What the previous move actually did, kept on screen. Without
                    it the only record of a move vanished with its panel. */}
                {lastMove && !performing && (
                    <div className="koi-lastmove">
                        <span className="koi-lastmove-icon" aria-hidden="true">
                            {lastMove.icon}
                        </span>
                        <span className="koi-lastmove-body">
                            <span className="koi-lastmove-label">{lastMove.label}</span>
                            <span className="koi-lastmove-stats">
                                <b className={lastMove.spark >= 0 ? "is-up" : "is-down"}>
                                    {lastMove.spark >= 0 ? "+" : ""}
                                    {lastMove.spark} spark
                                </b>
                                <b className={lastMove.mood >= 0 ? "is-up" : "is-down"}>
                                    {lastMove.mood >= 0 ? "+" : ""}
                                    {lastMove.mood} mood
                                </b>
                            </span>
                        </span>
                    </div>
                )}
            </div>

            <div className="koi-deck">
                {/* Landscape gets the wish here instead: the header row there is
                    at capacity beside the balloons, and this column has room.
                    Portrait keeps the header pill; CSS shows exactly one. */}
                {wishGift && !wishGranted && (
                    <div className="koi-wish koi-wish-deck" title={`${wishGift.name} is always a strong gift tonight`}>
                        <span className="koi-wish-label">Wishes for</span>
                        <img className="koi-wish-art" src={wishGift.image} alt="" />
                        <span className="koi-wish-name">{wishGift.name}</span>
                    </div>
                )}
                {/* Topics ride the same strip in landscape: tonight's subjects
                    stay readable beside the wish instead of vanishing with the
                    header pill. */}
                {activeTopics.length > 0 && (
                    <div className="koi-topics koi-topics-deck">
                        <span className="koi-topics-label">Talks about</span>
                        {activeTopics.map((topic) => (
                            <span key={topic} className="koi-topic-chip" title={TOPIC_LABEL[topic as TopicId] ?? topic}>
                                {TOPIC_GLYPH[topic as TopicId] ?? "?"} <em>{TOPIC_SHORT[topic as TopicId]}</em>
                            </span>
                        ))}
                    </div>
                )}
                {performing ? (
                    <button
                        type="button"
                        className={`koi-perform koi-verdict-${performing.verdict}`}
                        aria-live="polite"
                        disabled={!performing.settled}
                        onClick={dismissPerforming}
                    >
                        {/* Symmetric: everything on the centre line. The spark
                            total sits with the pips it is the sum of, rather
                            than floating off in the title row. */}
                        <span className="koi-perform-top">
                            <span className="koi-perform-icon" aria-hidden="true">
                                {performing.action.icon}
                            </span>
                            <span className="koi-perform-titles">
                                <strong className="koi-perform-label">{performing.action.label}</strong>
                                <span className={`koi-mod koi-mod-${performing.modifier.tone}`}>
                                    {performing.modifier.tone === "up"
                                        ? "▲"
                                        : performing.modifier.tone === "down"
                                          ? "▼"
                                          : "="}{" "}
                                    {performing.modifier.reason}
                                </span>
                            </span>
                        </span>

                        {/* Only seconds that have actually happened. */}
                        <div className="koi-ticks">
                            {performing.ticks.map((tick, index) => (
                                <span
                                    // Position in the sequence IS the identity here.
                                    // biome-ignore lint/suspicious/noArrayIndexKey: sequence position is the key
                                    key={index}
                                    className={`koi-tick ${tickClass(tick)}`}
                                >
                                    {tick > 0 ? "+" : tick < 0 ? "−" : "·"}
                                </span>
                            ))}
                            {!performing.settled && <span className="koi-tick is-rolling">?</span>}
                            <span className="koi-perform-spark">
                                {running > 0 ? "+" : ""}
                                {running}
                            </span>
                        </div>

                        <span className="koi-perform-note">{performing.settled ? performing.note : "…"}</span>

                        <span className={`koi-perform-continue ${performing.settled ? "" : "is-reserved"}`}>
                            Continue ›
                        </span>
                    </button>
                ) : (
                    <>
                        {/* One family at a time. All five stacked took 44% of a
                            portrait screen, which pushed the cast up into the
                            middle of the composition. */}
                        <div className="koi-tabs" role="tablist">
                            {FAMILY_ORDER.map((family) => (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={family === openFamily}
                                    key={family}
                                    className={`koi-tab koi-family-${family} ${family === openFamily ? "is-open" : ""}`}
                                    onClick={() => setOpenFamily(family)}
                                >
                                    <span aria-hidden="true">{FAMILY_ICON[family]}</span> {FAMILY_LABEL[family]}
                                </button>
                            ))}
                            {ownedGifts.length > 0 && (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={openFamily === "gift"}
                                    className={`koi-tab koi-family-gift ${openFamily === "gift" ? "is-open" : ""}`}
                                    onClick={() => setOpenFamily("gift")}
                                >
                                    <span aria-hidden="true">🎁</span> Bag
                                </button>
                            )}
                        </div>

                        <div className={`koi-cards koi-family-${openFamily}`}>
                            {openFamily === "gift" &&
                                sortedGifts.map(([id, count]) => {
                                    const gift = GIFTS_BY_ID[id];
                                    if (!gift) return null;
                                    const isWish = !wishGranted && id === wishGift?.id;
                                    const isGrantedWish = wishGranted && id === wishGift?.id;
                                    return (
                                        <button
                                            type="button"
                                            key={id}
                                            className={`koi-card koi-card-gift ${isWish ? "is-wish" : ""}`}
                                            disabled={isGrantedWish}
                                            onClick={() => playGift(id)}
                                        >
                                            <img className="koi-card-giftart" src={gift.image} alt="" />
                                            <span className="koi-card-body">
                                                <span className="koi-card-label">
                                                    {gift.name}
                                                    {isWish && <span className="koi-wish-badge">their wish</span>}
                                                    {isGrantedWish && (
                                                        <span className="koi-wish-badge is-granted">wish granted</span>
                                                    )}
                                                </span>
                                                <span className="koi-card-hint">
                                                    ×{count} · {isWish ? "always lands" : "4x on their topic"}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            {openFamily !== "gift" &&
                                (hands[openFamily] ?? []).map((id) => {
                                    const action = ACTIONS_BY_ID[id];
                                    if (!action) return null;
                                    const locked = affection < action.unlockAt;
                                    const cooling = sim?.cooldownLeft(action.id) ?? 0;
                                    const noGift = action.needsGift && ownedGifts.length === 0;
                                    const disabled = locked || cooling > 0 || noGift;
                                    return (
                                        <button
                                            type="button"
                                            key={action.id}
                                            className={`koi-card ${locked ? "is-locked" : ""} ${cooling > 0 ? "is-cooling" : ""}`}
                                            disabled={disabled}
                                            onClick={() => playAction(action)}
                                        >
                                            <span className="koi-card-icon" aria-hidden="true">
                                                {action.icon}
                                            </span>
                                            <span className="koi-card-body">
                                                <span className="koi-card-label">{action.label}</span>
                                                {/* Read BEFORE committing. The game already knew all
                                                of this; showing it only in the result panel meant
                                                every choice was blind and every explanation
                                                arrived too late to act on. */}
                                                {locked ? (
                                                    <span className="koi-card-hint">{action.unlockAt}♥ to unlock</span>
                                                ) : (
                                                    <span className="koi-card-read">
                                                        <span className={`koi-card-mod is-${cardMod(action).tone}`}>
                                                            {modArrows(cardMod(action).value)}
                                                        </span>
                                                        {cardBand(action) !== "stays" && (
                                                            <span
                                                                className={`koi-card-band is-${cardBand(action)}`}
                                                                title={BAND_HINT[cardBand(action)]}
                                                            >
                                                                {BAND_ICON[cardBand(action)]}
                                                            </span>
                                                        )}
                                                        <span className="koi-card-hint">{action.hint}</span>
                                                    </span>
                                                )}
                                            </span>
                                            {cooling > 0 && <span className="koi-card-cool">{cooling.toFixed(1)}</span>}
                                        </button>
                                    );
                                })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
