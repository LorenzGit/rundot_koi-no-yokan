#!/usr/bin/env node
/**
 * Normalize the six-expression cast sheets to one shared physical scale.
 *
 * Image generation controls consistency inside one sheet, but not between
 * separate calls: each result has its own canvas dimensions, margins, and
 * character scale. Comparing or slicing those raw sheets directly can make a
 * 179 cm character look shorter than a 169 cm character.
 *
 * This authoring step:
 *
 *  1. finds the empty vertical valleys between the six figures;
 *  2. removes the generated green screen;
 *  3. measures each figure crown-to-sole, ignoring raised hands;
 *  4. uniformly scales it from the roster's real-world `heightCm`;
 *  5. places it on a shared baseline in a fixed 1800×900 sheet.
 *
 * Raw generations remain untouched in art/raw. Derived, normalized sheets are
 * written to art/normalized with a pure #00FF00 background.
 *
 * Usage:
 *   node scripts/normalize-expression-sheets.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { CAST } from "./cast.mjs";
import { chromaKey } from "./chroma-key.mjs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";
import { drawText } from "./minifont.mjs";
import { crop, draw, scaleToHeight } from "./sprite.mjs";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "art/normalized");

const FRAME_COUNT = 6;
const SHEET_W = 1800;
const SHEET_H = 900;
const CELL_W = SHEET_W / FRAME_COUNT;
const BASELINE_Y = 840;
const MAX_BODY_PX = 760;
const MAX_HEIGHT_CM = Math.max(...Object.values(CAST).map((member) => member.heightCm));

const REVIEW_W = 1920;
const REVIEW_H = 900;
const REVIEW_GROUND_Y = 820;
const REVIEW_ORDER = [
    "char_f_artist",
    "char_f_tsundere",
    "char_f_siren",
    "char_f_runner",
    "char_m_senpai",
    "char_m_athlete",
    "char_m_charmer",
    "char_m_climber",
];

function opaqueCanvas(w, h, [r, g, b]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 255;
    }
    return { w, h, data };
}

function estimateChromaScreen(raw) {
    const border = 12;
    const dominanceValues = [];
    const colorCounts = new Map();

    for (let y = 0; y < raw.h; y++) {
        for (let x = 0; x < raw.w; x++) {
            if (x >= border && x < raw.w - border && y >= border && y < raw.h - border) continue;
            const i = (y * raw.w + x) * 4;
            const r = raw.data[i];
            const g = raw.data[i + 1];
            const b = raw.data[i + 2];
            const greenDominance = g - Math.max(r, b);
            if (greenDominance < 80) continue;
            dominanceValues.push(greenDominance);
            const packed = (r << 16) | (g << 8) | b;
            colorCounts.set(packed, (colorCounts.get(packed) ?? 0) + 1);
        }
    }

    if (dominanceValues.length === 0) throw new Error("could not estimate chroma screen from border");
    dominanceValues.sort((a, b) => a - b);
    const high = dominanceValues[Math.floor(dominanceValues.length * 0.01)];
    const [packed] = [...colorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
        key: [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255],
        high,
    };
}

function findFrameBoundaries(keyed) {
    const occupied = new Uint32Array(keyed.w);
    for (let y = 0; y < keyed.h; y++) {
        for (let x = 0; x < keyed.w; x++) {
            if (keyed.data[(y * keyed.w + x) * 4 + 3] >= 48) occupied[x]++;
        }
    }

    const nominalCellWidth = keyed.w / FRAME_COUNT;
    const boundaries = [0];
    for (let index = 1; index < FRAME_COUNT; index++) {
        const nominal = index * nominalCellWidth;
        const radius = nominalCellWidth * 0.3;
        const start = Math.max(boundaries.at(-1) + 1, Math.floor(nominal - radius));
        const end = Math.min(keyed.w - 2, Math.ceil(nominal + radius));
        let bestStart = -1;
        let bestEnd = -1;
        let runStart = -1;

        for (let x = start; x <= end + 1; x++) {
            if (x <= end && occupied[x] === 0) {
                if (runStart < 0) runStart = x;
                continue;
            }
            if (runStart >= 0) {
                const runEnd = x - 1;
                if (bestStart < 0 || runEnd - runStart > bestEnd - bestStart) {
                    bestStart = runStart;
                    bestEnd = runEnd;
                }
                runStart = -1;
            }
        }

        if (bestStart < 0) {
            let bestX = start;
            for (let x = start + 1; x <= end; x++) {
                if (occupied[x] < occupied[bestX]) bestX = x;
            }
            boundaries.push(bestX);
        } else {
            boundaries.push(Math.round((bestStart + bestEnd) / 2));
        }
    }
    boundaries.push(keyed.w);
    return boundaries;
}

function normalizeFrame(keyedSheet, id, frameIndex, targetBodyPx, boundaries) {
    const x0 = boundaries[frameIndex];
    const x1 = boundaries[frameIndex + 1];
    const keyed = crop(keyedSheet, { x0, y0: 0, w: x1 - x0, h: keyedSheet.h });
    cleanMatte(keyed);

    const measured = measureStandingHeight(keyed);
    const box = tightBounds(keyed);
    const figure = crop(keyed, box);
    const crownAdjustPx = CAST[id].crownAdjustPx ?? 0;
    const crownY = measured.crownY - box.y0 + crownAdjustPx;
    const bodyPx = figure.h - crownY;
    const scale = targetBodyPx / bodyPx;
    const sprite = scaleToHeight(figure, Math.round(figure.h * scale));
    const actualScale = sprite.h / figure.h;
    const renderedBodyPx = Math.round(bodyPx * actualScale);

    if (sprite.w > CELL_W) {
        throw new Error(`${id} frame ${frameIndex + 1}: ${sprite.w}px sprite exceeds ${CELL_W}px cell`);
    }
    if (sprite.h > BASELINE_Y) {
        throw new Error(`${id} frame ${frameIndex + 1}: ${sprite.h}px sprite clips above the sheet`);
    }

    return {
        sprite,
        metrics: {
            frame: frameIndex + 1,
            sourceBodyPx: bodyPx,
            targetBodyPx,
            renderedBodyPx,
            scale: Number(actualScale.toFixed(6)),
            sprite: { w: sprite.w, h: sprite.h },
            crownOffsetPx: Math.round(crownY * actualScale),
            sourceX: { x0, x1 },
        },
    };
}

function normalizeSheet(id) {
    const input = path.join(root, `art/raw/${id}_expressions_left.png`);
    const raw = decodePng(readFileSync(input));
    const chroma = estimateChromaScreen(raw);
    const keyedSheet = chromaKey(raw, chroma);
    cleanMatte(keyedSheet);
    const boundaries = findFrameBoundaries(keyedSheet);
    const targetBodyPx = Math.round((CAST[id].heightCm / MAX_HEIGHT_CM) * MAX_BODY_PX);
    const sheet = opaqueCanvas(SHEET_W, SHEET_H, [0, 255, 0]);
    const frames = [];

    for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex++) {
        const normalized = normalizeFrame(keyedSheet, id, frameIndex, targetBodyPx, boundaries);
        const dx = Math.round(frameIndex * CELL_W + (CELL_W - normalized.sprite.w) / 2);
        const dy = BASELINE_Y - normalized.sprite.h;
        draw(sheet, normalized.sprite, dx, dy);
        frames.push({ ...normalized, dx, dy });
    }

    const output = path.join(outDir, `${id}_expressions_left.png`);
    writeFileSync(output, encodePng(sheet));
    return {
        id,
        name: CAST[id].name,
        heightCm: CAST[id].heightCm,
        input: path.relative(root, input),
        output: path.relative(root, output),
        targetBodyPx,
        chroma,
        boundaries,
        frames,
    };
}

function renderHeightReview(results) {
    const review = opaqueCanvas(REVIEW_W, REVIEW_H, [246, 241, 232]);
    const slotW = REVIEW_W / REVIEW_ORDER.length;

    for (let x = 0; x < REVIEW_W; x++) {
        const i = (REVIEW_GROUND_Y * REVIEW_W + x) * 4;
        review.data[i] = 45;
        review.data[i + 1] = 40;
        review.data[i + 2] = 45;
    }

    for (const [index, id] of REVIEW_ORDER.entries()) {
        const result = results.find((candidate) => candidate.id === id);
        const neutral = result.frames[0];
        const sprite = neutral.sprite;
        const dx = Math.round(index * slotW + (slotW - sprite.w) / 2);
        const dy = REVIEW_GROUND_Y - sprite.h;
        draw(review, sprite, dx, dy);

        const crownY = REVIEW_GROUND_Y - result.targetBodyPx;
        for (let y = crownY - 1; y <= crownY + 1; y++) {
            for (let x = Math.round(index * slotW + 12); x < Math.round((index + 1) * slotW - 12); x++) {
                const i = (y * REVIEW_W + x) * 4;
                review.data[i] = 220;
                review.data[i + 1] = 40;
                review.data[i + 2] = 90;
            }
        }

        const label = `${result.name.toUpperCase()} ${result.heightCm}CM`;
        drawText(review, label, Math.round(index * slotW + 12), REVIEW_GROUND_Y + 18, [35, 30, 38], 2);
    }

    const output = path.join(root, "art/expression_height_check.png");
    writeFileSync(output, encodePng(review));
    return path.relative(root, output);
}

mkdirSync(outDir, { recursive: true });
const results = Object.keys(CAST).map(normalizeSheet);
const review = renderHeightReview(results);

const manifest = {
    generatedBy: "scripts/normalize-expression-sheets.mjs",
    canvas: {
        width: SHEET_W,
        height: SHEET_H,
        frames: FRAME_COUNT,
        cellWidth: CELL_W,
        baselineY: BASELINE_Y,
        background: "#00FF00",
    },
    scale: {
        maxHeightCm: MAX_HEIGHT_CM,
        maxBodyPx: MAX_BODY_PX,
        pixelsPerCm: Number((MAX_BODY_PX / MAX_HEIGHT_CM).toFixed(6)),
        policy: "uniform crown-to-sole scaling from scripts/cast.mjs heightCm",
    },
    cast: Object.fromEntries(
        results.map((result) => [
            result.id,
            {
                name: result.name,
                heightCm: result.heightCm,
                targetBodyPx: result.targetBodyPx,
                sourceChroma: result.chroma,
                sourceFrameBoundaries: result.boundaries,
                input: result.input,
                output: result.output,
                frames: result.frames.map(({ metrics }) => metrics),
            },
        ]),
    ),
    review,
};

writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.table(
    results.map((result) => ({
        id: result.id,
        cm: result.heightCm,
        targetBodyPx: result.targetBodyPx,
        minRenderedPx: Math.min(...result.frames.map(({ metrics }) => metrics.renderedBodyPx)),
        maxRenderedPx: Math.max(...result.frames.map(({ metrics }) => metrics.renderedBodyPx)),
    })),
);
process.stdout.write(
    `${JSON.stringify({
        normalized: results.length,
        canvas: `${SHEET_W}x${SHEET_H}`,
        review,
        manifest: path.relative(root, path.join(outDir, "manifest.json")),
    })}\n`,
);
