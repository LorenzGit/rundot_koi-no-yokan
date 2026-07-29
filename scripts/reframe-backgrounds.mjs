#!/usr/bin/env node
/**
 * Reframe a square master into the shipped background.
 *
 * Two things have to be true at once, and a square master cannot do both:
 *
 *  - **The cast must be the same size relative to the scenery in every
 *    orientation.** That means their on-screen height is a fixed fraction of
 *    the *painting*, not of the viewport (see SOURCE_PERSON_HEIGHT).
 *  - **Neither orientation may overflow.** Cover-fit magnifies the painting by
 *    `viewportAspect / imageAspect` in landscape. A 0.89-aspect master in a
 *    2.17 viewport is a 2.4x zoom, so a cast sized correctly for portrait ends
 *    up 84% of the screen in landscape, heads cut off.
 *
 * Widening the master to 3:2 drops that zoom to 1.44x, which lands the same
 * world-scale cast at ~35% of the screen in portrait and ~50% in landscape.
 * Both readable, one consistent world.
 *
 * The width is already there in the painting; the height is not, so this crops
 * from the TOP (sky, which the brief marks as croppable) and extends the FLOOR
 * band if the crop needs more floor than was painted.
 *
 *   npx tsx scripts/reframe-backgrounds.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { LOCATIONS } from "../src/game/data/world.ts";

const root = path.resolve(import.meta.dirname, "..");

/** Where the layout needs it. Must equal SCREEN_GROUND_PORTRAIT. */
const TARGET_GROUND = 0.765;
/** Shipped aspect. Chosen so landscape's cover zoom is ~1.44x, not 2.4x. */
const TARGET_ASPECT = 1.5;

/** Resample rows [from, to) of an image to `outRows` rows, linearly. */
function stretchBand(src, from, to, outRows) {
    const bandIn = to - from;
    const out = new Uint8ClampedArray(src.w * outRows * 4);
    for (let y = 0; y < outRows; y++) {
        const t = (y / Math.max(1, outRows - 1)) * (bandIn - 1);
        const y0 = Math.floor(t);
        const y1 = Math.min(bandIn - 1, y0 + 1);
        const f = t - y0;
        const rowA = (from + y0) * src.w * 4;
        const rowB = (from + y1) * src.w * 4;
        for (let x = 0; x < src.w * 4; x++) {
            out[y * src.w * 4 + x] = Math.round(src.data[rowA + x] * (1 - f) + src.data[rowB + x] * f);
        }
    }
    return out;
}

const report = [];
for (const location of LOCATIONS) {
    const name = location.image.replace("/images/", "").replace(".png", "");
    const src = decodePng(readFileSync(path.join(root, `art/raw/${name}.png`)));
    const groundRow = Math.round(location.groundAsPainted * src.h);

    const outH = Math.round(src.w / TARGET_ASPECT);
    const groundOut = Math.round(TARGET_GROUND * outH);
    // A master painted to spec needs little or no reframing. Allow a small
    // shortfall by padding with the top row rather than failing outright; a
    // large one means the painting's ground line is badly wrong.
    const topCrop = groundRow - groundOut;
    if (topCrop < -Math.round(src.h * 0.05)) {
        throw new Error(`${name}: ground line too high to reframe (needs ${-topCrop}px more sky)`);
    }

    const floorNeeded = outH - groundOut;
    const floorHave = src.h - groundRow;

    const out = { w: src.w, h: outH, data: new Uint8ClampedArray(src.w * outH * 4) };
    // Above the ground line: a straight crop, no resampling. If the master is
    // slightly short of sky, repeat its top row to make up the difference.
    if (topCrop >= 0) {
        out.data.set(src.data.subarray(topCrop * src.w * 4, groundRow * src.w * 4), 0);
    } else {
        for (let y = 0; y < -topCrop; y++) {
            out.data.set(src.data.subarray(0, src.w * 4), y * src.w * 4);
        }
        out.data.set(src.data.subarray(0, groundRow * src.w * 4), -topCrop * src.w * 4);
    }
    // The floor: stretched only if the target needs more than was painted. The
    // floor is flat, level and empty by contract and already foreshortened, so
    // stretching it is invisible in a way stretching scenery would not be.
    const floor =
        floorNeeded <= floorHave
            ? src.data.subarray(groundRow * src.w * 4, (groundRow + floorNeeded) * src.w * 4)
            : stretchBand(src, groundRow, src.h, floorNeeded);
    out.data.set(floor, groundOut * src.w * 4);

    writeFileSync(path.join(root, `public/images/${name}.png`), encodePng(out));
    report.push({
        name,
        master: `${src.w}x${src.h}`,
        shipped: `${out.w}x${out.h}`,
        aspect: (out.w / out.h).toFixed(2),
        groundWas: `${(location.groundAsPainted * 100).toFixed(0)}%`,
        skyCropped: `${((topCrop / src.h) * 100).toFixed(0)}%`,
        floorStretch: floorNeeded <= floorHave ? "none" : `${(floorNeeded / floorHave).toFixed(2)}x`,
        groundNow: `${((groundOut / outH) * 100).toFixed(1)}%`,
    });
}

console.table(report);
process.stdout.write(
    `${JSON.stringify({
        landscapeZoom: (2340 / 1080 / TARGET_ASPECT).toFixed(2),
        note: "was 2.44x on the square master",
    })}\n`,
);
