#!/usr/bin/env node
/**
 * Authoring-time scene preview for KOI NO YOKAN.
 *
 * Composites cut-out cast members over a painted background so the art
 * pipeline (codex-image-gen -> chroma-key.mjs) can be eyeballed as it will
 * actually appear in game. Not part of the build.
 *
 *   node scripts/preview-scene.mjs [background.png] [out.png]
 *
 * Two things this gets right that naive compositing does not:
 *
 *  - Sprites are measured by their **alpha bounding box**, not by their canvas.
 *    Every generation carries a different amount of empty margin, so scaling
 *    "to 55% of the frame" sizes the whitespace, not the person, and anchoring
 *    to the canvas bottom leaves whoever has bottom margin floating in the air.
 *  - Each cast member has a real-world height in cm. A single scene-wide
 *    pixels-per-cm converts those into sprite heights, so the man is taller
 *    than the woman by exactly as much as he should be.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { CAST } from "./cast.mjs";
import { buildShadowMask, applyShadow } from "./shadow.mjs";
import { crop, scaleToHeight, draw } from "./sprite.mjs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";

const root = path.resolve(import.meta.dirname, "..");
const load = (rel) => decodePng(readFileSync(path.join(root, rel)));

/** Where the cast's feet land, as a fraction of frame height. */
const FOOT_LINE = 0.93;
/** A person of this height occupies this fraction of the frame at our camera. */
const REFERENCE_CM = 175;
const REFERENCE_FRACTION = 0.52;

const bgRel = process.argv[2] ?? "public/images/bg_beach_terrace.png";
const outRel = process.argv[3] ?? "art/preview_date_scene.png";

const bg = load(bgRel);
const scene = { w: bg.w, h: bg.h, data: Uint8ClampedArray.from(bg.data) };
const pxPerCm = (scene.h * REFERENCE_FRACTION) / REFERENCE_CM;
const feet = Math.round(scene.h * FOOT_LINE);

const STAGED = [
    { id: "char_f_tsundere", anchorX: 0.34 },
    { id: "char_m_senpai", anchorX: 0.67 },
];

const report = [];
for (const slot of STAGED) {
    const member = CAST[slot.id];
    const raw = load(`art/cutout/${slot.id}.png`);
    cleanMatte(raw);
    const measured = measureStandingHeight(raw);
    const box = tightBounds(raw);
    const figure = crop(raw, box);
    // Crown-to-sole drives the scale; the sprite is then drawn at whatever
    // height that implies, including any overhead the pose carries.
    const bodyPx = figure.h - (measured.crownY - box.y0);
    const sprite = scaleToHeight(figure, Math.round((figure.h * member.heightCm * pxPerCm) / bodyPx));
    const dx = Math.round(scene.w * slot.anchorX - sprite.w / 2);
    const shadow = buildShadowMask(sprite);
    applyShadow(scene, shadow, dx + shadow.offsetX, feet - sprite.h + shadow.offsetY);
    draw(scene, sprite, dx, feet - sprite.h);
    report.push({ id: slot.id, cm: member.heightCm, spriteH: sprite.h, bodyPx });
}

const out = path.join(root, outRel);
writeFileSync(out, encodePng(scene));
process.stdout.write(
    `${JSON.stringify({ out, w: scene.w, h: scene.h, pxPerCm: +pxPerCm.toFixed(2), cast: report })}\n`,
);
