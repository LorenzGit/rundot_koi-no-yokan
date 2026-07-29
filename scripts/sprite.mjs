/** Shared raster helpers for the authoring scripts. */

/**
 * Tightest rectangle containing the figure.
 *
 * A row or column only counts if it carries at least `minRun` solid pixels.
 * Keying leaves isolated specks — the senpai sprite has two surviving pixels on
 * its very last row, 90px below his soles — and a naive any-pixel bounding box
 * takes those as the bottom of the character, so every attempt to stand him on
 * the ground leaves him hovering by exactly that margin.
 */
export function alphaBounds(img, threshold = 64, minRun = 3) {
    const rows = new Uint32Array(img.h);
    const cols = new Uint32Array(img.w);
    for (let y = 0; y < img.h; y++) {
        for (let x = 0; x < img.w; x++) {
            if (img.data[(y * img.w + x) * 4 + 3] < threshold) continue;
            rows[y]++;
            cols[x]++;
        }
    }
    const span = (counts) => {
        let lo = -1,
            hi = -1;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] < minRun) continue;
            if (lo < 0) lo = i;
            hi = i;
        }
        return [lo, hi];
    };
    const [y0, y1] = span(rows);
    const [x0, x1] = span(cols);
    if (y1 < 0 || x1 < 0) throw new Error("sprite has no solid pixels");
    return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Crop to a rectangle, returning a new image. */
export function crop(img, box) {
    const out = new Uint8ClampedArray(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) {
        const src = ((box.y0 + y) * img.w + box.x0) * 4;
        out.set(img.data.subarray(src, src + box.w * 4), y * box.w * 4);
    }
    return { w: box.w, h: box.h, data: out };
}

/** Box-filtered resize to a target height, keeping aspect. */
export function scaleToHeight(img, targetH) {
    const targetW = Math.max(1, Math.round((img.w * targetH) / img.h));
    const out = new Uint8ClampedArray(targetW * targetH * 4);
    const sx = img.w / targetW;
    const sy = img.h / targetH;
    for (let y = 0; y < targetH; y++) {
        const y0 = Math.floor(y * sy);
        const y1 = Math.min(img.h, Math.max(y0 + 1, Math.floor((y + 1) * sy)));
        for (let x = 0; x < targetW; x++) {
            const x0 = Math.floor(x * sx);
            const x1 = Math.min(img.w, Math.max(x0 + 1, Math.floor((x + 1) * sx)));
            let r = 0,
                g = 0,
                b = 0,
                a = 0,
                n = 0;
            for (let yy = y0; yy < y1; yy++) {
                for (let xx = x0; xx < x1; xx++) {
                    const i = (yy * img.w + xx) * 4;
                    const al = img.data[i + 3];
                    // Premultiply so transparent pixels never bleed their colour in.
                    r += img.data[i] * al;
                    g += img.data[i + 1] * al;
                    b += img.data[i + 2] * al;
                    a += al;
                    n++;
                }
            }
            const o = (y * targetW + x) * 4;
            if (a > 0) {
                out[o] = Math.round(r / a);
                out[o + 1] = Math.round(g / a);
                out[o + 2] = Math.round(b / a);
            }
            out[o + 3] = Math.round(a / n);
        }
    }
    return { w: targetW, h: targetH, data: out };
}

/** Source-over composite of `src` onto opaque `dst` at (dx, dy). */
export function draw(dst, src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
        const ty = dy + y;
        if (ty < 0 || ty >= dst.h) continue;
        for (let x = 0; x < src.w; x++) {
            const tx = dx + x;
            if (tx < 0 || tx >= dst.w) continue;
            const s = (y * src.w + x) * 4;
            const a = src.data[s + 3] / 255;
            if (a === 0) continue;
            const d = (ty * dst.w + tx) * 4;
            for (let c = 0; c < 3; c++) {
                dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
            }
            dst.data[d + 3] = 255;
        }
    }
}
