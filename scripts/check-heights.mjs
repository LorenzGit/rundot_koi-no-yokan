#!/usr/bin/env node
/**
 * Visual proof that standing heights are measured correctly.
 *
 * Writes art/height_check.png: every cast member scaled by their real-world
 * height onto a shared ground line, with their detected crown marked. If the
 * detector is fooled by a raised hand or a hat, the crown line will sit above
 * the head and the figure will look wrong next to the others — which is the
 * whole point of rendering it rather than trusting the numbers.
 *
 *   node scripts/check-heights.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";
import { crop, scaleToHeight, draw } from "./sprite.mjs";
import { CAST } from "./cast.mjs";

const root = path.resolve(import.meta.dirname, "..");
const PX_PER_CM = 3.4;
const W = 1200;
const H = 760;
const GROUND = H - 60;

const scene = { w: W, h: H, data: new Uint8ClampedArray(W * H * 4) };
for (let i = 0; i < W * H; i++) {
    scene.data[i * 4] = 246;
    scene.data[i * 4 + 1] = 241;
    scene.data[i * 4 + 2] = 232;
    scene.data[i * 4 + 3] = 255;
}
const hLine = (y, r, g, b) => {
    if (y < 0 || y >= H) return;
    for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        scene.data[i] = r;
        scene.data[i + 1] = g;
        scene.data[i + 2] = b;
    }
};
const mark = (x0, x1, y, r, g, b) => {
    for (let yy = y - 1; yy <= y + 1; yy++) {
        if (yy < 0 || yy >= H) continue;
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
            const i = (yy * W + x) * 4;
            scene.data[i] = r;
            scene.data[i + 1] = g;
            scene.data[i + 2] = b;
        }
    }
};

hLine(GROUND, 40, 40, 40);

const ids = Object.keys(CAST);
const slot = W / ids.length;
const report = [];

ids.forEach((id, index) => {
    const img = decodePng(readFileSync(path.join(root, `art/cutout/${id}.png`)));
    const cleaned = cleanMatte(img);
    const measured = measureStandingHeight(img);
    const box = tightBounds(img);
    const figure = crop(img, box);

    // Crown-to-sole is the person; the box may extend above it (raised hand).
    const bodyPx = measured.soleY - measured.crownY + 1;
    const targetBodyPx = CAST[id].heightCm * PX_PER_CM;
    const scale = targetBodyPx / bodyPx;
    const sprite = scaleToHeight(figure, Math.round(figure.h * scale));

    const x = Math.round(slot * index + slot / 2 - sprite.w / 2);
    const y = GROUND - sprite.h;
    draw(scene, sprite, x, y);

    // Where the crown landed after scaling, and where it should be.
    const crownOnScreen = Math.round(y + (measured.crownY - box.y0) * scale);
    mark(x, x + sprite.w, crownOnScreen, 220, 40, 90);
    mark(Math.round(slot * index) + 6, Math.round(slot * index) + 40, Math.round(GROUND - targetBodyPx), 30, 120, 220);

    report.push({
        id,
        cm: CAST[id].heightCm,
        strippedPx: cleaned.removedPixels,
        box: `${box.w}x${box.h}`,
        crownToSolePx: bodyPx,
        boxTallerBy: box.h - bodyPx,
        renderedBodyPx: Math.round(bodyPx * scale),
    });
});

writeFileSync(path.join(root, "art/height_check.png"), encodePng(scene));
console.table(report);
process.stdout.write("wrote art/height_check.png (pink = detected crown, blue tick = target height)\n");
