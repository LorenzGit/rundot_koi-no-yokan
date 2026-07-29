#!/usr/bin/env node
/**
 * Render every location at both orientations, with the cast standing in it.
 *
 * Writes art/orientation_<location>.png — portrait and landscape side by side,
 * using the *same* placeBackdrop() the game uses. This is the check that a
 * painting actually survives both crops: whether the floor is still under the
 * cast's feet, and whether anything worth seeing is left above them.
 *
 *   npx tsx scripts/check-orientation.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { placeBackdrop, REFERENCE_CM } from "../src/game/data/backdrop.ts";
import { LOCATIONS } from "../src/game/data/world.ts";
import { buildShadowMask, applyShadow } from "./shadow.mjs";
import { crop, scaleToHeight, draw } from "./sprite.mjs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";
import { CAST } from "./cast.mjs";
import { drawText } from "./minifont.mjs";

const root = path.resolve(import.meta.dirname, "..");
const load = (rel) => decodePng(readFileSync(path.join(root, rel)));

/** Rendered at a third of device pixels — enough to judge composition. */
const VIEWS = [
    { label: "PORTRAIT 360x640", w: 360, h: 640 },
    { label: "LANDSCAPE 780x360", w: 780, h: 360 },
];
const STAGED = ["char_f_tsundere", "char_m_senpai"];

/** Nearest-neighbour blit of a scaled backdrop into a viewport. */
function drawBackdrop(view, bg, placement) {
    for (let y = 0; y < view.h; y++) {
        for (let x = 0; x < view.w; x++) {
            const sx = Math.min(bg.w - 1, Math.max(0, Math.floor((x - placement.x) / placement.scale)));
            const sy = Math.min(bg.h - 1, Math.max(0, Math.floor((y - placement.y) / placement.scale)));
            const s = (sy * bg.w + sx) * 4;
            const d = (y * view.w + x) * 4;
            view.data[d] = bg.data[s];
            view.data[d + 1] = bg.data[s + 1];
            view.data[d + 2] = bg.data[s + 2];
            view.data[d + 3] = 255;
        }
    }
}

const figures = new Map();
for (const id of STAGED) {
    const raw = load(`art/cutout/${id}.png`);
    cleanMatte(raw);
    const measured = measureStandingHeight(raw);
    const box = tightBounds(raw);
    const figure = crop(raw, box);
    figures.set(id, { figure, bodyPx: figure.h - (measured.crownY - box.y0), cm: CAST[id].heightCm });
}

/**
 * How much visual interest survives above the cast's heads in landscape.
 *
 * An earlier version of this tried to locate the horizon by finding the
 * strongest horizontal edge, and reported the beach sea at 87% — it was
 * locking onto the ground line, which is a far harder edge than a distant sea.
 * The question that actually matters is simpler and needs no landmark: within
 * the slice landscape shows above head height, does anything vary? A band of
 * nothing but sand or paving scores near zero.
 *
 * Returns mean absolute row-to-row colour delta, 0..255-ish.
 */
function interestAboveHeads(bg, fromFrac, toFrac) {
    const y0 = Math.max(1, Math.round(fromFrac * bg.h));
    const y1 = Math.min(bg.h - 4, Math.round(toFrac * bg.h));
    if (y1 <= y0) return 0;
    let total = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = 0; x < bg.w; x += 4) {
            const a = (y * bg.w + x) * 4;
            const b = ((y + 3) * bg.w + x) * 4;
            total +=
                (Math.abs(bg.data[a] - bg.data[b]) +
                    Math.abs(bg.data[a + 1] - bg.data[b + 1]) +
                    Math.abs(bg.data[a + 2] - bg.data[b + 2])) /
                3;
            n++;
        }
    }
    return n ? total / n : 0;
}

/** Below this the landscape band is effectively a flat expanse of floor. */
const INTEREST_FLOOR = 1.2;

const report = [];
for (const location of LOCATIONS) {
    const bg = load(`public${location.image}`);
    // Shipped art is a square master whose floor has been extended by
    // extend-floor.mjs, so it is taller than wide by design. What matters is
    // that it is not a portrait painting: anything narrower than ~0.8 cannot
    // fill a landscape viewport without a brutal crop.
    const aspect = bg.w / bg.h;

    // The horizon has to be inside what LANDSCAPE actually sees, and above the
    // cast's heads. Derived from the real placement rather than a fixed band,
    // so it is meaningful whatever aspect the painting happens to be.
    const lv = VIEWS.find((v) => v.w / v.h >= 1);
    const lp = placeBackdrop(bg.w, bg.h, lv.w, lv.h, location.id);
    const bandTop = -lp.y / lp.scale / bg.h;
    const headTop = (lp.groundY - lp.personHeight - lp.y) / lp.scale / bg.h;
    const interest = interestAboveHeads(bg, bandTop, headTop);
    const tiles = VIEWS.map((v) => {
        const view = { w: v.w, h: v.h, data: new Uint8ClampedArray(v.w * v.h * 4) };
        const placement = placeBackdrop(bg.w, bg.h, v.w, v.h, location.id);
        drawBackdrop(view, bg, placement);

        const pxPerCm = placement.personHeight / REFERENCE_CM;
        const landscape = v.w / v.h >= 1;
        // Matches dateScene: landscape centres the pair on the visible stage,
        // left of the action deck column.
        const stageCentre = landscape ? 0.33 : 0.5;
        const spread = landscape ? 0.15 : 0.21;
        STAGED.forEach((id, i) => {
            const { figure, bodyPx, cm } = figures.get(id);
            const sprite = scaleToHeight(figure, Math.round((figure.h * cm * pxPerCm) / bodyPx));
            const dx = Math.round(v.w * (stageCentre + (i === 0 ? -spread : spread)) - sprite.w / 2);
            const dy = Math.round(placement.groundY) - sprite.h;
            const shadow = buildShadowMask(sprite);
            applyShadow(view, shadow, dx + shadow.offsetX, dy + shadow.offsetY);
            draw(view, sprite, dx, dy);
        });

        // Draw where the HUD actually sits, so composition is judged against
        // the screen the player really sees rather than a bare canvas.
        const shade = (x0, y0, ww, hh) => {
            for (let y = y0; y < y0 + hh; y++) {
                for (let x = x0; x < x0 + ww; x++) {
                    if (x < 0 || y < 0 || x >= v.w || y >= v.h) continue;
                    const i = (y * v.w + x) * 4;
                    view.data[i] = Math.round(view.data[i] * 0.32 + 43 * 0.68);
                    view.data[i + 1] = Math.round(view.data[i + 1] * 0.32 + 31 * 0.68);
                    view.data[i + 2] = Math.round(view.data[i + 2] * 0.32 + 46 * 0.68);
                }
            }
        };
        // Fractions measured from the live DOM, not guessed.
        if (landscape) {
            shade(Math.round(v.w * 0.657), 0, Math.round(v.w * 0.343), v.h); // deck column
            shade(6, 6, Math.round(v.w * 0.636), Math.round(v.h * 0.17)); // gauges + reading
        } else {
            shade(0, Math.round(v.h * 0.795), v.w, Math.round(v.h * 0.205)); // deck
            shade(0, 0, v.w, Math.round(v.h * 0.135)); // gauges + reading
        }

        // Mark the ground line so a mis-anchored painting is obvious.
        for (let x = 0; x < v.w; x += 12) {
            const y = Math.round(placement.groundY);
            for (let t = 0; t < 2; t++) {
                const i = ((y + t) * v.w + x) * 4;
                view.data[i] = 220;
                view.data[i + 1] = 40;
                view.data[i + 2] = 90;
            }
        }
        drawText(view, v.label, 6, 6, [255, 255, 255], 1);
        report.push({
            location: location.id,
            view: v.label,
            aspect: `${aspect.toFixed(2)} ${aspect >= 0.8 ? "ok" : "TOO NARROW"}`,

            landscapeSeesAboveHeads: `${(bandTop * 100).toFixed(0)}%..${(headTop * 100).toFixed(0)}%`,
            interest: interest.toFixed(2),
            verdict: interest >= INTEREST_FLOOR ? "has scenery" : "BARE FLOOR",
            visibleSourceRows: `${Math.round(-placement.y / placement.scale)}..${Math.round((v.h - placement.y) / placement.scale)}`,
            of: bg.h,
            groundOnScreen: Math.round(placement.groundY),
        });
        return view;
    });

    const gap = 12;
    const W = tiles.reduce((sum, t) => sum + t.w, 0) + gap;
    const H = Math.max(...tiles.map((t) => t.h));
    const sheet = { w: W, h: H, data: new Uint8ClampedArray(W * H * 4) };
    let ox = 0;
    for (const tile of tiles) {
        for (let y = 0; y < tile.h; y++) {
            for (let x = 0; x < tile.w; x++) {
                const s = (y * tile.w + x) * 4;
                const d = (y * W + ox + x) * 4;
                sheet.data[d] = tile.data[s];
                sheet.data[d + 1] = tile.data[s + 1];
                sheet.data[d + 2] = tile.data[s + 2];
                sheet.data[d + 3] = 255;
            }
        }
        ox += tile.w + gap;
    }
    writeFileSync(path.join(root, `art/orientation_${location.id}.png`), encodePng(sheet));
}

console.table(report);
process.stdout.write("wrote art/orientation_*.png\n");
