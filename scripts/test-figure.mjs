#!/usr/bin/env node
/**
 * Tests for the figure measurement that the real cast cannot exercise.
 *
 * Sora's waving hand happens to sit below his head, so the shipped art never
 * proves the raised-arm case actually works. These synthetic figures do.
 *
 *   node scripts/test-figure.mjs
 */
import process from "node:process";
import { readFileSync } from "node:fs";
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";

/**
 * The narrowest interior a picker card ever offers, as a fraction of its own
 * interior height. `.koi-pick` is `aspect-ratio: 0.43` with `min-width: 104px`
 * and 14px of chrome on both axes, so the interior aspect is
 * `(0.43H - 14) / (H - 14)` while the ratio governs and `90 / (H - 14)` while
 * min-width does. Both are worst exactly where they meet, at H = 104 / 0.43.
 */
const PICK_CARD_CHROME = 14;
const PICK_CARD_RATIO = 0.43;
const PICK_CARD_MIN_WIDTH = 104;
const PICK_CARD_ASPECT_LIMIT =
    (PICK_CARD_MIN_WIDTH - PICK_CARD_CHROME) / (PICK_CARD_MIN_WIDTH / PICK_CARD_RATIO - PICK_CARD_CHROME);

let failures = 0;
function check(name, actual, expected, tolerance = 0) {
    const ok = Math.abs(actual - expected) <= tolerance;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got ${actual}, expected ${expected}±${tolerance}`);
}

/** Blank RGBA canvas plus a filled-rectangle helper. */
function canvas(w, h) {
    const img = { w, h, data: new Uint8ClampedArray(w * h * 4) };
    img.rect = (x, y, rw, rh, alpha = 255) => {
        for (let yy = y; yy < y + rh; yy++) {
            for (let xx = x; xx < x + rw; xx++) {
                if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                const i = (yy * w + xx) * 4;
                img.data[i] = 200;
                img.data[i + 1] = 120;
                img.data[i + 2] = 120;
                img.data[i + 3] = alpha;
            }
        }
    };
    return img;
}

// --- a figure with an arm raised well above the head ------------------------
{
    const img = canvas(200, 400);
    img.rect(80, 100, 40, 40); // head, crown at y=100
    img.rect(70, 140, 60, 180); // torso
    img.rect(80, 320, 15, 60); // legs
    img.rect(105, 320, 15, 60);
    img.rect(135, 40, 12, 110); // raised arm, reaching to y=40

    const box = tightBounds(img);
    const m = measureStandingHeight(img);
    check("raised arm: box top is the hand", box.y0, 40);
    check("raised arm: crown is the head, not the hand", m.crownY, 100);
    check("raised arm: sole is the feet", m.soleY, 379);
    check("raised arm: standing height ignores the arm", m.soleY - m.crownY + 1, 280);
}

// --- a plain standing figure: crown must equal the box top ------------------
{
    const img = canvas(200, 400);
    img.rect(80, 100, 40, 40);
    img.rect(70, 140, 60, 180);
    img.rect(80, 320, 40, 60);

    const box = tightBounds(img);
    const m = measureStandingHeight(img);
    check("plain figure: crown equals box top", m.crownY, box.y0);
}

// --- matte cleanup ----------------------------------------------------------
{
    const img = canvas(200, 400);
    img.rect(80, 100, 40, 40);
    img.rect(70, 140, 60, 180);
    img.rect(80, 320, 40, 60);
    img.rect(2, 2, 2, 2); // opaque speck in the corner
    img.rect(190, 390, 6, 6, 20); // faint haze, far from the figure
    // A genuine anti-aliased edge: faint, but touching the body.
    img.rect(69, 140, 1, 180, 30);

    const before = tightBounds(img);
    check("before cleanup: box is dragged to the speck", before.x0, 2);

    const { removedPixels } = cleanMatte(img);
    const after = tightBounds(img);
    check("cleanup removed speck and haze", removedPixels, 4 + 36);
    check("cleanup kept the faint anti-aliased edge", after.x0, 69);
    check("cleanup tightened the box", after.y0, 100);
    check("cleanup tightened the bottom", after.y0 + after.h - 1, 379);
}

// --- the widest figure must still be limited by its FRAME, not its card -----
//
// The picker draws every figure at `--koi-fig` of the card's inner height and
// lets `object-fit: contain` do the rest. That only holds while the card is
// wide enough for the widest character at full frame height; past that, contain
// starts limiting THAT ONE character by width, and he silently drops out of
// scale with the rest of the cast — which is exactly what a desktop landscape
// column, where the strip's height cap is lifted, used to do to Sora.
{
    const atlas = JSON.parse(readFileSync(new URL("../src/game/data/cast-atlas.json", import.meta.url), "utf8"));
    const span = (e) => (e.heightCm * e.figure.h) / e.bodyPx;
    const tallest = Math.max(...Object.values(atlas).map(span));
    let widest = { id: "none", aspect: 0 };
    for (const [id, entry] of Object.entries(atlas)) {
        const aspect = ((entry.figure.w / entry.figure.h) * span(entry)) / tallest;
        if (aspect > widest.aspect) widest = { id, aspect };
    }
    const ok = widest.aspect <= PICK_CARD_ASPECT_LIMIT;
    if (!ok) failures++;
    console.log(
        `${ok ? "PASS" : "FAIL"}  widest figure (${widest.id}) fits the picker card  ` +
            `got ${widest.aspect.toFixed(3)}, limit ${PICK_CARD_ASPECT_LIMIT.toFixed(3)}` +
            (ok ? "" : " — raise `aspect-ratio` on .koi-pick in src/styles/app.css"),
    );
}

if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log("\nAll figure checks passed.");
