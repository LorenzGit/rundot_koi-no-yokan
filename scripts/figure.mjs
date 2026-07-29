/**
 * Turning a keyed cutout into a game-ready figure.
 *
 * Two jobs that both look trivial and are not:
 *
 *  - **Trim to the figure.** Keying leaves isolated specks scattered around the
 *    canvas. A bounding box that respects them is far too large, and one that
 *    ignores thin rows clips real detail (a hair strand, a fingertip). So the
 *    specks are *erased* first, then the box is genuinely tight at alpha > 0.
 *
 *  - **Measure standing height.** The bounding box is NOT the person. Sora
 *    waves, so his box starts at his raised hand; someone in a hat would
 *    measure the hat. Scaling a box like that to a real-world height makes the
 *    body too short, which is exactly how a 179cm man ends up looking shorter
 *    than a 171cm woman. Height must be measured crown-to-sole.
 */

const ALPHA_ON = 48;

/**
 * Strip everything that is not the figure, in place; returns what went.
 *
 * Connectivity over *any* non-zero alpha, keeping a blob only if it is both
 * big enough and actually solid somewhere. Two failure modes this has to cover
 * at once:
 *
 *  - isolated specks of real matte (the two opaque pixels 90px below the
 *    senpai's soles);
 *  - a faint haze of alpha 4-40 scattered right out to the canvas corners,
 *    left by the generator's green vignette. It is only ~1,900 pixels but it
 *    touches every edge, so any bounding box that respects it is the whole
 *    canvas. Thresholding alone would take genuine anti-aliased edge pixels
 *    with it; requiring a *connection* to something solid does not.
 */
export function cleanMatte(img, minArea = 64) {
    const { w, h, data } = img;
    const seen = new Uint8Array(w * h);
    const stack = new Int32Array(w * h);
    let removedBlobs = 0;
    let removedPixels = 0;

    for (let start = 0; start < w * h; start++) {
        if (seen[start] || data[start * 4 + 3] === 0) continue;
        let top = 0;
        stack[top++] = start;
        seen[start] = 1;
        const blob = [];
        let peak = 0;
        while (top > 0) {
            const p = stack[--top];
            blob.push(p);
            if (data[p * 4 + 3] > peak) peak = data[p * 4 + 3];
            const x = p % w;
            const y = (p / w) | 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    const q = ny * w + nx;
                    if (seen[q] || data[q * 4 + 3] === 0) continue;
                    seen[q] = 1;
                    stack[top++] = q;
                }
            }
        }
        if (blob.length >= minArea && peak >= ALPHA_ON) continue;
        for (const p of blob) {
            data[p * 4] = 0;
            data[p * 4 + 1] = 0;
            data[p * 4 + 2] = 0;
            data[p * 4 + 3] = 0;
        }
        removedBlobs++;
        removedPixels += blob.length;
    }
    return { removedBlobs, removedPixels };
}

/** Genuinely tight box: every edge touches a non-transparent pixel. */
export function tightBounds(img) {
    const { w, h, data } = img;
    let x0 = w,
        y0 = h,
        x1 = -1,
        y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] === 0) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) throw new Error("figure is fully transparent");
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Horizontal runs of solid pixels on one row. */
function runsOnRow(img, y) {
    const runs = [];
    let start = -1;
    for (let x = 0; x < img.w; x++) {
        const on = img.data[(y * img.w + x) * 4 + 3] >= ALPHA_ON;
        if (on && start < 0) start = x;
        else if (!on && start >= 0) {
            runs.push({ x0: start, x1: x - 1, width: x - start });
            start = -1;
        }
    }
    if (start >= 0) runs.push({ x0: start, x1: img.w - 1, width: img.w - start });
    return runs;
}

/**
 * Find the crown of the head — the top of the person, ignoring raised arms.
 *
 * Anchors on the torso: the horizontal centre of the lower body is stable no
 * matter what the arms are doing. Then scans down from the top for the first
 * row carrying a run that is both wide enough to be a head (a raised hand or a
 * ponytail is far narrower than a skull) and close enough to that centre.
 *
 * Returns `{ crownY, soleY, centreX, headWidth }`, all in image pixels.
 */
export function measureStandingHeight(img, opts = {}) {
    const bounds = tightBounds(img);
    const soleY = bounds.y0 + bounds.h - 1;

    // Torso anchor from the lower half, where arms cannot reach.
    let sumX = 0;
    let count = 0;
    let maxRun = 0;
    for (let y = bounds.y0 + Math.floor(bounds.h * 0.45); y <= soleY; y++) {
        for (const run of runsOnRow(img, y)) {
            if (run.width > maxRun) maxRun = run.width;
            sumX += ((run.x0 + run.x1) / 2) * run.width;
            count += run.width;
        }
    }
    const centreX = count ? sumX / count : bounds.x0 + bounds.w / 2;

    // A head is a substantial fraction of the widest part of the body; a hand,
    // a waving arm or a hair spike is not.
    const minHeadWidth = (opts.minHeadWidthRatio ?? 0.3) * maxRun;
    const maxOffset = (opts.maxCentreOffsetRatio ?? 0.22) * bounds.w;

    for (let y = bounds.y0; y <= soleY; y++) {
        for (const run of runsOnRow(img, y)) {
            if (run.width < minHeadWidth) continue;
            if (Math.abs((run.x0 + run.x1) / 2 - centreX) > maxOffset) continue;
            return { crownY: y, soleY, centreX, headWidth: run.width, bounds };
        }
    }
    // Nothing qualified — fall back to the box so a bad asset degrades quietly.
    return { crownY: bounds.y0, soleY, centreX, headWidth: maxRun, bounds };
}
