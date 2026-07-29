#!/usr/bin/env node
/**
 * Check a background's human scale against the props painted in it.
 *
 * Writes art/scale_<location>.png: the painting with a real cast member stood
 * on its ground line, plus labelled bars at real-world heights. Read it by
 * comparing the bars to the painted furniture — a bench seat should meet the
 * 45cm bar, its back the 85cm bar, a railing the 110cm bar, a doorway the 210cm
 * bar. If the painted bench is well under its bar, that painting's world is
 * smaller than the cast and they will tower over the furniture.
 *
 * This exists because the paintings are generated with no human-scale
 * reference, so nothing forces their props to match the layout's idea of how
 * big a person is. The number has to be measured per painting, not assumed.
 *
 *   npx tsx scripts/scale-ruler.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { LOCATIONS } from "../src/game/data/world.ts";
import { personFractionFor, REFERENCE_CM, SOURCE_GROUND } from "../src/game/data/backdrop.ts";
import { crop, scaleToHeight, draw } from "./sprite.mjs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";
import { CAST } from "./cast.mjs";
import { drawText } from "./minifont.mjs";

const root = path.resolve(import.meta.dirname, "..");
const load = (rel) => decodePng(readFileSync(path.join(root, rel)));

/** Everyday objects whose real height everyone knows by eye. */
const REFERENCES = [
    { cm: 45, label: "45 BENCH SEAT / CHAIR SEAT" },
    { cm: 85, label: "85 BENCH BACK / TABLE TOP" },
    { cm: 110, label: "110 RAILING / BALUSTRADE" },
    { cm: 210, label: "210 DOORWAY TOP" },
];

const REF_ID = "char_f_tsundere";
const raw = load(`art/cutout/${REF_ID}.png`);
cleanMatte(raw);
const measured = measureStandingHeight(raw);
const box = tightBounds(raw);
const figure = crop(raw, box);
const bodyPx = figure.h - (measured.crownY - box.y0);
const refCm = CAST[REF_ID].heightCm;

for (const location of LOCATIONS) {
    const bg = load(`public${location.image}`);
    const scene = { w: bg.w, h: bg.h, data: Uint8ClampedArray.from(bg.data) };
    const groundY = Math.round(SOURCE_GROUND * bg.h);
    // Centimetres per pixel implied by the current setting for this painting.
    const personPx = personFractionFor(location.id) * bg.h;
    const pxPerCm = personPx / REFERENCE_CM;

    // The cast member, stood on the ground line at the left of the open centre.
    const sprite = scaleToHeight(figure, Math.round((figure.h * refCm * pxPerCm) / bodyPx));
    const dx = Math.round(bg.w * 0.42 - sprite.w / 2);
    draw(scene, sprite, dx, groundY - sprite.h);

    for (const ref of REFERENCES) {
        const y = groundY - Math.round(ref.cm * pxPerCm);
        if (y < 0) continue;
        for (let x = 0; x < bg.w; x += 14) {
            for (let t = 0; t < 3; t++) {
                const i = ((y + t) * bg.w + x) * 4;
                scene.data[i] = 255;
                scene.data[i + 1] = 40;
                scene.data[i + 2] = 90;
            }
        }
        // Label plate so the bars stay readable over busy art.
        const label = ref.label;
        for (let ly = y - 26; ly < y - 2; ly++) {
            for (let lx = 8; lx < 8 + label.length * 18 + 12; lx++) {
                const i = (ly * bg.w + lx) * 4;
                scene.data[i] = 20;
                scene.data[i + 1] = 16;
                scene.data[i + 2] = 24;
            }
        }
        drawText(scene, label, 14, y - 22, [255, 220, 230], 3);
    }

    drawText(
        scene,
        `${location.id.toUpperCase()}  PERSON = ${(personFractionFor(location.id) * 100).toFixed(1)}% OF IMAGE HEIGHT`,
        14,
        14,
        [255, 255, 255],
        3,
    );
    writeFileSync(path.join(root, `art/scale_${location.id}.png`), encodePng(scene));
}

process.stdout.write("wrote art/scale_*.png\n");
