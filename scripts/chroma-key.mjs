#!/usr/bin/env node
/**
 * Green-screen keyer for KOI NO YOKAN character and prop sheets.
 *
 * Why not bg-removal-softshadows' chromaCutout: that keyer scores a pixel by
 * its residual off the key axis *divided by its brightness*, which is right for
 * soft photographic mattes but makes near-black pixels look close to any key.
 * Cel art is full of near-black ink lines and hair (rgb(2,9,12)), so raising
 * tolerance far enough to catch the anti-aliased edge band also punches holes
 * straight through the linework.
 *
 * This keys on **green dominance** instead — g - max(r, b) — which is large on
 * the screen and <= 0 on black ink no matter how dark it is. Three stages:
 *
 *   1. Key       alpha ramps from opaque to clear across [low, high] dominance.
 *   2. Un-premultiply  partial-alpha pixels have the key colour removed
 *      arithmetically (c - (1-a)*key) / a. This is what kills the pale fringe:
 *      a half-covered edge pixel is genuinely half green, and simply deleting
 *      the green without un-compositing leaves the washed-out remainder.
 *   3. Despill   any surviving green cast is pulled down to max(r, b).
 *
 * Usage:
 *   node scripts/chroma-key.mjs in.png -o out.png [--low 24] [--high 90]
 *        [--shrink 0.15] [--key 00ff00]
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { decodePng, encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Green dominance: how much greener a pixel is than its strongest other channel. */
const dominance = (r, g, b) => g - Math.max(r, b);

export function chromaKey(img, opts = {}) {
    const {
        // A pixel that is fraction `a` subject over the screen reads as
        // a*subject + (1-a)*key, so its dominance falls roughly linearly from the
        // screen's own dominance (~231 for the generator's 18,249,12) down to the
        // subject's (negative for skin, hair, denim). The ramp must therefore span
        // nearly the whole range: a narrow band collapses the one-to-two pixel
        // anti-aliased border into a hard on/off edge, which is exactly what
        // produces staircase jaggies on every diagonal.
        low = 20, // dominance at or below which a pixel is fully subject
        high = 225, // dominance at or above which a pixel is fully background
        shrink = 0, // matte contraction in alpha units; > 0 also eats the AA ramp
        key = [0, 255, 0],
    } = opts;
    const { w, h } = img;
    const src = img.data;
    const out = new Uint8ClampedArray(w * h * 4);
    const span = Math.max(1, high - low);
    let cleared = 0;

    for (let i = 0; i < w * h * 4; i += 4) {
        const r = src[i],
            g = src[i + 1],
            b = src[i + 2];
        const keyness = clamp01((dominance(r, g, b) - low) / span);
        // Contract the matte: partial pixels lose `shrink` of their coverage, so
        // the residual half-key ring around the silhouette goes fully transparent.
        let a = clamp01((1 - keyness - shrink) / (1 - shrink));

        // Below this the un-premultiply divides by so little coverage that it
        // amplifies noise into bright specks; such pixels are background anyway.
        if (a <= 0.02) {
            cleared++;
            continue;
        } // leave RGBA at 0

        // Un-composite the key out of partially covered pixels.
        let R = r,
            G = g,
            B = b;
        if (a < 1) {
            const k = 1 - a;
            R = (r - k * key[0]) / a;
            G = (g - k * key[1]) / a;
            B = (b - k * key[2]) / a;
        }
        // Despill whatever green cast survives.
        const other = Math.max(R, B);
        if (G > other) G = other;

        out[i] = R;
        out[i + 1] = G;
        out[i + 2] = B;
        out[i + 3] = Math.round(a * 255);
    }
    return { w, h, data: out, transparentPct: Math.round((cleared / (w * h)) * 100) };
}

if (import.meta.filename === process.argv[1]) {
    const argv = process.argv.slice(2);
    const input = argv[0];
    const opts = {};
    let out = null;
    for (let i = 1; i < argv.length; i += 2) {
        const flag = argv[i],
            value = argv[i + 1];
        if (flag === "-o" || flag === "--out") out = value;
        else if (flag === "--low") opts.low = Number(value);
        else if (flag === "--high") opts.high = Number(value);
        else if (flag === "--shrink") opts.shrink = Number(value);
        else if (flag === "--key") {
            opts.key = [1, 3, 5].map((p) => Number.parseInt(value.slice(p - 1, p + 1), 16));
        } else throw new Error(`unknown flag ${flag}`);
    }
    if (!input || !out) throw new Error("usage: chroma-key.mjs in.png -o out.png");
    const result = chromaKey(decodePng(readFileSync(input)), opts);
    writeFileSync(out, encodePng(result));
    process.stdout.write(
        `${JSON.stringify({ out, w: result.w, h: result.h, transparentPct: result.transparentPct })}\n`,
    );
}
