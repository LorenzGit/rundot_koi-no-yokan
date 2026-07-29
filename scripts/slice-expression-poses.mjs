#!/usr/bin/env node
/**
 * Remove the normalized sheets' green screen and publish six trimmed poses.
 *
 * Background removal follows bg-removal-softshadows Engine B through the
 * project's green-dominance adapter (`chroma-key.mjs`). The stock luma-scaled
 * chroma selector is unsafe for this cast's near-black ink; the adapter keeps
 * the skill's offline PNG pipeline while avoiding holes in hair and linework.
 *
 * Existing `<id>_figure.png` files are inputs to the manifest only and are
 * never rewritten. Each character therefore has seven character-art entries:
 * the original figure plus neutral, happy, sad, surprised, angry, and in-love.
 *
 * Usage:
 *   node scripts/slice-expression-poses.mjs
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
const castDir = path.join(root, "public/images/cast");
const sourceManifest = JSON.parse(readFileSync(path.join(root, "art/normalized/manifest.json"), "utf8"));
const originalAtlas = JSON.parse(readFileSync(path.join(root, "src/game/data/cast-atlas.json"), "utf8"));

const EXPRESSIONS = ["neutral", "happy", "sad", "surprised", "angry", "in_love"];
const SHEET_W = 1800;
const SHEET_H = 900;
const CELL_W = SHEET_W / EXPRESSIONS.length;

const REVIEW_CELL_W = 260;
const REVIEW_CELL_H = 320;
const REVIEW_W = REVIEW_CELL_W * EXPRESSIONS.length;
const REVIEW_H = REVIEW_CELL_H * Object.keys(CAST).length;

function assertTight(id, expression, image) {
    const alphaAt = (x, y) => image.data[(y * image.w + x) * 4 + 3];
    const rowUsed = (y) => {
        for (let x = 0; x < image.w; x++) if (alphaAt(x, y) > 0) return true;
        return false;
    };
    const columnUsed = (x) => {
        for (let y = 0; y < image.h; y++) if (alphaAt(x, y) > 0) return true;
        return false;
    };

    const edges = {
        top: rowUsed(0),
        bottom: rowUsed(image.h - 1),
        left: columnUsed(0),
        right: columnUsed(image.w - 1),
    };
    for (const [edge, used] of Object.entries(edges)) {
        if (!used) throw new Error(`${id} ${expression}: ${edge} edge is not tightly trimmed`);
    }
}

function alphaStats(image) {
    let transparent = 0;
    let opaque = 0;
    let partial = 0;
    for (let i = 3; i < image.data.length; i += 4) {
        if (image.data[i] === 0) transparent++;
        else if (image.data[i] === 255) opaque++;
        else partial++;
    }
    return {
        transparentPct: Number(((transparent / (image.w * image.h)) * 100).toFixed(2)),
        opaquePct: Number(((opaque / (image.w * image.h)) * 100).toFixed(2)),
        partialAlphaPixels: partial,
    };
}

function scaleToBodyHeight(figure, crownY, targetBodyPx) {
    const sourceBodyPx = figure.h - crownY;
    let bestHeight = Math.round((figure.h * targetBodyPx) / sourceBodyPx);
    let bestError = Number.POSITIVE_INFINITY;

    for (let candidateHeight = Math.max(1, bestHeight - 3); candidateHeight <= bestHeight + 3; candidateHeight++) {
        const scale = candidateHeight / figure.h;
        const candidateBodyPx = candidateHeight - Math.round(crownY * scale);
        const error = Math.abs(candidateBodyPx - targetBodyPx);
        if (error < bestError) {
            bestHeight = candidateHeight;
            bestError = error;
        }
    }

    const image = scaleToHeight(figure, bestHeight);
    const scale = image.h / figure.h;
    const scaledCrownY = Math.round(crownY * scale);
    return { image, crownY: scaledCrownY, bodyPx: image.h - scaledCrownY, sourceBodyPx };
}

function processPose(sheet, id, expression, index, targetBodyPx) {
    const cell = crop(sheet, { x0: index * CELL_W, y0: 0, w: CELL_W, h: sheet.h });
    const keyed = chromaKey(cell, { key: [0, 255, 0] });
    const sourceAlpha = alphaStats(keyed);
    const cleaned = cleanMatte(keyed);
    const measured = measureStandingHeight(keyed);
    const box = tightBounds(keyed);
    const trimmed = crop(keyed, box);
    const detectedCrownY = measured.crownY - box.y0 + (CAST[id].crownAdjustPx ?? 0);
    const normalized = scaleToBodyHeight(trimmed, detectedCrownY, targetBodyPx);
    const figure = normalized.image;
    const crownY = normalized.crownY;
    const bodyPx = normalized.bodyPx;

    if (Math.abs(normalized.sourceBodyPx - targetBodyPx) > 8) {
        throw new Error(
            `${id} ${expression}: extracted body is ${normalized.sourceBodyPx}px, expected near ${targetBodyPx}px`,
        );
    }
    if (bodyPx !== targetBodyPx) {
        throw new Error(`${id} ${expression}: body is ${bodyPx}px, expected ${targetBodyPx}px`);
    }
    assertTight(id, expression, figure);

    const filename = `${id}_${expression}.png`;
    const output = path.join(castDir, filename);
    writeFileSync(output, encodePng(figure));

    return {
        expression,
        src: `/images/cast/${filename}`,
        file: path.relative(root, output),
        w: figure.w,
        h: figure.h,
        crownY,
        bodyPx,
        extractedBodyPx: normalized.sourceBodyPx,
        strippedPixels: cleaned.removedPixels,
        sourceAlpha,
        image: figure,
    };
}

function fillReviewCell(review, cellX, cellY) {
    const square = 20;
    for (let y = 0; y < REVIEW_CELL_H; y++) {
        for (let x = 0; x < REVIEW_CELL_W; x++) {
            const bright = (Math.floor(x / square) + Math.floor(y / square)) % 2 === 0;
            const i = ((cellY + y) * review.w + cellX + x) * 4;
            review.data[i] = bright ? 255 : 76;
            review.data[i + 1] = 0;
            review.data[i + 2] = bright ? 255 : 90;
            review.data[i + 3] = 255;
        }
    }
}

function renderReview(results) {
    const review = { w: REVIEW_W, h: REVIEW_H, data: new Uint8ClampedArray(REVIEW_W * REVIEW_H * 4) };

    for (const [row, result] of results.entries()) {
        for (const [column, pose] of result.poses.entries()) {
            const cellX = column * REVIEW_CELL_W;
            const cellY = row * REVIEW_CELL_H;
            fillReviewCell(review, cellX, cellY);

            const label = `${result.name.toUpperCase()} ${pose.expression.replace("_", " ").toUpperCase()}`;
            drawText(review, label, cellX + 8, cellY + 8, [255, 255, 255], 1);

            const availableW = REVIEW_CELL_W - 24;
            const availableH = REVIEW_CELL_H - 42;
            const scale = Math.min(availableW / pose.image.w, availableH / pose.image.h);
            const sprite = scaleToHeight(pose.image, Math.max(1, Math.round(pose.image.h * scale)));
            const dx = Math.round(cellX + (REVIEW_CELL_W - sprite.w) / 2);
            const dy = cellY + REVIEW_CELL_H - sprite.h - 8;
            draw(review, sprite, dx, dy);
        }
    }

    const output = path.join(root, "art/expression_cutout_check.png");
    writeFileSync(output, encodePng(review));
    return path.relative(root, output);
}

mkdirSync(castDir, { recursive: true });
const results = [];

for (const id of Object.keys(CAST)) {
    const input = path.join(root, `art/normalized/${id}_expressions_left.png`);
    const sheet = decodePng(readFileSync(input));
    if (sheet.w !== SHEET_W || sheet.h !== SHEET_H) {
        throw new Error(`${id}: normalized sheet is ${sheet.w}x${sheet.h}, expected ${SHEET_W}x${SHEET_H}`);
    }

    const targetBodyPx = sourceManifest.cast[id].targetBodyPx;
    const poses = EXPRESSIONS.map((expression, index) => processPose(sheet, id, expression, index, targetBodyPx));
    const original = originalAtlas[id];

    results.push({
        id,
        name: CAST[id].name,
        heightCm: CAST[id].heightCm,
        totalCharacterImages: 1 + poses.length,
        original: {
            src: `/images/cast/${id}_figure.png`,
            file: `public/images/cast/${id}_figure.png`,
            w: original.figure.w,
            h: original.figure.h,
            crownY: original.crownY,
            bodyPx: original.bodyPx,
        },
        poses,
    });
}

const review = renderReview(results);
const manifest = {
    generatedBy: "scripts/slice-expression-poses.mjs",
    backgroundRemoval: {
        skill: "rundot_template/.agents/skills/bg-removal-softshadows",
        engine: "Engine B",
        adapter: "scripts/chroma-key.mjs",
        reason: "green-dominance matte preserves near-black cel ink",
    },
    expressions: EXPRESSIONS,
    review,
    cast: Object.fromEntries(
        results.map((result) => [
            result.id,
            {
                name: result.name,
                heightCm: result.heightCm,
                totalCharacterImages: result.totalCharacterImages,
                original: result.original,
                poses: Object.fromEntries(
                    result.poses.map(({ image: _image, expression, ...pose }) => [expression, pose]),
                ),
            },
        ]),
    ),
};

const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(path.join(castDir, "cast-poses.json"), manifestText);
writeFileSync(path.join(root, "src/game/data/cast-poses.json"), manifestText);

console.table(
    results.map((result) => ({
        id: result.id,
        original: 1,
        newPoses: result.poses.length,
        totalCharacterImages: result.totalCharacterImages,
        minBodyPx: Math.min(...result.poses.map((pose) => pose.bodyPx)),
        maxBodyPx: Math.max(...result.poses.map((pose) => pose.bodyPx)),
    })),
);
process.stdout.write(
    `${JSON.stringify({
        characters: results.length,
        newPoseImages: results.reduce((sum, result) => sum + result.poses.length, 0),
        totalCharacterImages: results.reduce((sum, result) => sum + result.totalCharacterImages, 0),
        review,
    })}\n`,
);
