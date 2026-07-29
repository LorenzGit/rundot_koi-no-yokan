#!/usr/bin/env node
/**
 * Headless balance sweep for the date sim.
 *
 * The sim is renderer-free on purpose, so it can be driven here without Pixi.
 * This plays several bot strategies against every archetype and reports the
 * affection each earns per date, which catches the failure modes playtesting
 * hides: a single dominant card, an archetype nobody can crack, or an economy
 * where a full date is worth less than a rounding error.
 *
 *   npx tsx scripts/simulate-dates.mjs
 */
import { DateSim } from "../src/game/sim/dateSim.ts";
import { ACTIONS, ACTIONS_BY_ID } from "../src/game/data/actions.ts";
import { ARCHETYPES, GIFTS_BY_ID, LOCATIONS } from "../src/game/data/world.ts";

const STEP = 1 / 30;

/** Bots. Each is `(sim, playable) => actionId | null`. */
const STRATEGIES = {
    /** Presses whatever is off cooldown, at random. Floor for the design. */
    random(sim, playable, rng) {
        return playable[Math.floor(rng() * playable.length)] ?? null;
    },

    /** Only ever plays it safe — should earn little, and must not be optimal. */
    timid(sim, playable) {
        return playable.find((id) => ACTIONS_BY_ID[id].family === "safe") ?? null;
    },

    /** Spams the boldest thing available — should overheat and stall out. */
    reckless(sim, playable) {
        const bold = playable.filter((id) => ["bold", "intimate", "risky"].includes(ACTIONS_BY_ID[id].family));
        return bold.sort((a, b) => ACTIONS_BY_ID[b].spark - ACTIONS_BY_ID[a].spark)[0] ?? playable[0] ?? null;
    },

    /** Reads the band: pushes when there is room, cools off when there is not. */
    reader(sim, playable) {
        const [lo, hi] = sim.archetype.band;
        const headroom = hi - sim.tension;
        const wants = (a) => {
            const action = ACTIONS_BY_ID[a];
            // Never take a move that would blow past the top of the band.
            if (sim.tension + action.tension > hi + 2) return -1;
            if (sim.tension < lo && action.tension <= 0) return -1;
            let score = action.spark * sim.archetype.affinity[action.family];
            if (action.topicSensitive && sim.archetype.likes.includes(sim.topic)) score *= 1.7;
            if (sim.archetype.dislikes.includes(a)) score = -1;
            return score;
        };
        const ranked = playable.map((id) => [id, wants(id)]).sort((a, b) => b[1] - a[1]);
        if (ranked.length && ranked[0][1] > 0) return ranked[0][0];
        // Nothing safe to push with: bleed tension instead of stalling.
        return headroom < 0 ? (playable.find((id) => ACTIONS_BY_ID[id].tension < 0) ?? null) : null;
    },
};

function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function runDate(archetypeId, strategy, affection, seed) {
    const sim = new DateSim({
        archetype: ARCHETYPES[archetypeId],
        location: LOCATIONS[0],
        affection,
        seed,
    });
    const rng = makeRng(seed ^ 0x9e37);
    const used = new Map();

    // Turn based: the date is a fixed number of moves, so the harness plays one
    // action per turn rather than simulating taps against a clock.
    let guard = 0;
    while (!sim.finished && guard++ < 200) {
        const playable = ACTIONS.filter(
            (a) => affection >= a.unlockAt && sim.cooldownLeft(a.id) <= 0 && !a.decisive && !a.needsGift,
        ).map((a) => a.id);
        const choice = STRATEGIES[strategy](sim, playable, rng);
        if (!choice) break;
        sim.play(choice, GIFTS_BY_ID.bubbletea);
        used.set(choice, (used.get(choice) ?? 0) + 1);
    }
    return { gain: sim.affectionGain(), spark: sim.spark, used };
}

const SEEDS = 40;
const rows = [];
const globalUsage = new Map();

for (const archetypeId of Object.keys(ARCHETYPES)) {
    for (const strategy of Object.keys(STRATEGIES)) {
        for (const affection of [0, 50, 85]) {
            const gains = [];
            for (let s = 0; s < SEEDS; s++) {
                const { gain, used } = runDate(archetypeId, strategy, affection, s + 1);
                gains.push(gain);
                if (strategy === "reader") {
                    for (const [id, n] of used) globalUsage.set(id, (globalUsage.get(id) ?? 0) + n);
                }
            }
            gains.sort((a, b) => a - b);
            rows.push({
                archetype: archetypeId,
                strategy,
                affection,
                min: gains[0],
                median: gains[Math.floor(gains.length / 2)],
                max: gains[gains.length - 1],
            });
        }
    }
}

console.table(rows);

// A card nobody ever wants is dead weight; one used far more than the rest is
// the dominant strategy the design is supposed to avoid.
const usage = [...globalUsage].sort((a, b) => b[1] - a[1]);
const total = usage.reduce((sum, [, n]) => sum + n, 0);
console.log("\nReader-bot card usage (share of all moves):");
for (const [id, n] of usage.slice(0, 8)) {
    console.log(`  ${id.padEnd(16)} ${((n / total) * 100).toFixed(1)}%`);
}
const unusedCards = ACTIONS.filter((a) => !globalUsage.has(a.id) && !a.decisive && !a.needsGift).map((a) => a.id);
console.log(`\nNever chosen by the reader bot: ${unusedCards.length ? unusedCards.join(", ") : "none"}`);
