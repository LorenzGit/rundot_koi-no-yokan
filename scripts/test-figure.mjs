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
import { cleanMatte, measureStandingHeight, tightBounds } from "./figure.mjs";

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

if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log("\nAll figure checks passed.");
