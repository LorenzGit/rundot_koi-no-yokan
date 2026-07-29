#!/usr/bin/env node
/**
 * The background guidelines sheet: art/background_guides.png
 *
 * A brief an artist — or an image prompt — can work from directly.
 *
 * The first version of this sheet described the crop windows but never said
 * where the HORIZON goes, and that omission is what made the existing art fail:
 * the beach painting puts its sea at 48% of the image, above the landscape
 * band, so landscape only ever crops sand. Zones alone are not a brief. This
 * sheet states the horizon rule, and shows what each orientation actually ends
 * up seeing, HUD included.
 *
 * Geometry comes from src/game/data/backdrop.ts so the sheet cannot drift.
 *
 *   node scripts/background-guides.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { encodePng } from "../../rundot_template/.agents/skills/bg-removal-softshadows/cutout.mjs";
import { drawText, textWidth } from "./minifont.mjs";

const root = path.resolve(import.meta.dirname, "..");

// Mirrors src/game/data/backdrop.ts.
const SOURCE_GROUND = 0.765;
const SCREEN_GROUND_PORTRAIT = 0.765;
const SCREEN_GROUND_LANDSCAPE = 0.86;
/** A REFERENCE_CM person as a fraction of the PAINTING's height. */
const SOURCE_PERSON_HEIGHT = 0.345;
/** HUD footprints, measured from the live DOM. */
const HUD = {
    portrait: { headerH: 0.135, deckTop: 0.795 },
    landscape: { headerH: 0.17, headerW: 0.636, deckLeft: 0.657 },
};

/** Master is 3:2. A squarer master forces a 2.4x cover zoom in landscape,
 *  which blows the world-scaled cast up to 84% of the screen. */
const MASTER_W = 2304;
const MASTER_H = 1536;
const PORTRAIT = { w: 1080, h: 1920 };
const LANDSCAPE = { w: 2340, h: 1080 };

/** Master shown at a third size; the preview panes sit beside it. */
const SHOW_W = 768;
const SHOW_H = Math.round((SHOW_W * MASTER_H) / MASTER_W);
const PAD = 60;
const PANE_H = 470;
const PORT_PANE_W = Math.round((PANE_H * PORTRAIT.w) / PORTRAIT.h);
const LAND_PANE_W = Math.round((360 * LANDSCAPE.w) / LANDSCAPE.h);

const W = PAD * 2 + SHOW_W + 40 + Math.max(PORT_PANE_W + 20 + LAND_PANE_W, 760);
const H = PAD * 2 + Math.max(SHOW_H, PANE_H + 300) + 840;

const img = { w: W, h: H, data: new Uint8ClampedArray(W * H * 4) };
const set = (x, y, c, a = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    img.data[i] = Math.round(img.data[i] * (1 - a) + c[0] * a);
    img.data[i + 1] = Math.round(img.data[i + 1] * (1 - a) + c[1] * a);
    img.data[i + 2] = Math.round(img.data[i + 2] * (1 - a) + c[2] * a);
    img.data[i + 3] = 255;
};
const fill = (x0, y0, w, h, c, a = 1) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c, a);
};
const rect = (x0, y0, w, h, c, t = 2, dash = 0) => {
    for (let k = 0; k < t; k++) {
        for (let x = x0; x < x0 + w; x++) {
            if (dash && Math.floor(x / dash) % 2) continue;
            set(x, y0 + k, c);
            set(x, y0 + h - 1 - k, c);
        }
        for (let y = y0; y < y0 + h; y++) {
            if (dash && Math.floor(y / dash) % 2) continue;
            set(x0 + k, y, c);
            set(x0 + w - 1 - k, y, c);
        }
    }
};
const hLine = (y, x0, x1, c, t = 2, dash = 0) => {
    for (let k = 0; k < t; k++)
        for (let x = x0; x < x1; x++) {
            if (dash && Math.floor(x / dash) % 2) continue;
            set(x, y + k, c);
        }
};
const T = (s, x, y, c, sc = 2) => drawText(img, s, x, y, c, sc);

const INK = [24, 20, 30];
const MUTE = [104, 100, 112];
const PAPER = [250, 247, 240];
const SKY = [176, 212, 240];
const FAR = [156, 200, 176];
const CORE = [250, 224, 172];
const FLOOR = [214, 200, 176];
const PORTRAIT_C = [214, 62, 110];
const LANDSCAPE_C = [40, 110, 210];
const GROUND_C = [190, 40, 40];
const HUD_C = [58, 46, 62];

fill(0, 0, W, H, PAPER);

const X0 = PAD;
const Y0 = PAD + 66;

// --- master geometry, all in SHOW-space ------------------------------------
const groundY = Y0 + Math.round(SOURCE_GROUND * SHOW_H);

// What each viewport sees of the master, in SHOW-space.
const landScale = Math.max(LANDSCAPE.w / MASTER_W, LANDSCAPE.h / MASTER_H);
const landBand = Math.round((LANDSCAPE.h / landScale / MASTER_H) * SHOW_H);
const portScale = Math.max(PORTRAIT.w / MASTER_W, PORTRAIT.h / MASTER_H);
const portBand = Math.round((PORTRAIT.w / portScale / MASTER_W) * SHOW_W);

let landTop = groundY - Math.round(SCREEN_GROUND_LANDSCAPE * landBand);
landTop = Math.min(Y0 + SHOW_H - landBand, Math.max(Y0, landTop));
const portLeft = X0 + Math.round((SHOW_W - portBand) / 2);

// The cast is a fixed fraction of the PAINTING, so one envelope serves both.
const person = Math.round(SOURCE_PERSON_HEIGHT * SHOW_H);

// THE HORIZON RULE: between the top of the landscape window and the top of the
// cast's heads. Above it is cropped in landscape; below it cuts through them.
const horizonHi = landTop;
const horizonLo = groundY - person;

fill(X0, Y0, SHOW_W, landTop - Y0, SKY, 0.5);
fill(X0, landTop, SHOW_W, groundY - landTop, CORE, 0.45);
fill(X0, horizonHi, SHOW_W, horizonLo - horizonHi, FAR, 0.55);
fill(X0, groundY, SHOW_W, Y0 + SHOW_H - groundY, FLOOR, 0.6);
rect(X0, Y0, SHOW_W, SHOW_H, INK, 2);

rect(portLeft, Y0, portBand, SHOW_H, PORTRAIT_C, 3);
rect(X0, landTop, SHOW_W, landBand, LANDSCAPE_C, 3);
hLine(groundY, X0, X0 + SHOW_W, GROUND_C, 3);
hLine(horizonLo, X0, X0 + SHOW_W, [70, 130, 100], 2, 10);

const envW = Math.round(SHOW_W * 0.055);
rect(X0 + Math.round(SHOW_W * 0.42), groundY - person, envW, person, GROUND_C, 2, 10);
rect(X0 + Math.round(SHOW_W * 0.52), groundY - person, envW, person, GROUND_C, 2, 10);

// --- master labels ----------------------------------------------------------
T("KOI NO YOKAN - BACKGROUND BRIEF", X0, PAD - 10, INK, 4);
T(`PAINT A 3:2 MASTER, ${MASTER_W}x${MASTER_H}`, X0, PAD + 34, MUTE, 2);

T("SKY - CROPPED IN LANDSCAPE", X0 + 10, Y0 + 10, INK, 2);
T("NOTHING ESSENTIAL UP HERE", X0 + 10, Y0 + 34, MUTE, 2);

T("HORIZON MUST LAND IN THIS BAND", X0 + 10, horizonHi + 10, [30, 90, 60], 2);
T("SEA, SKYLINE, TREELINE, BUILDINGS", X0 + 10, horizonHi + 34, [30, 90, 60], 2);

T(
    `CHARACTER BAND - A STANDING ADULT IS ${Math.round(SOURCE_PERSON_HEIGHT * 100)}% OF THE IMAGE HEIGHT`,
    X0 + 10,
    horizonLo + 12,
    INK,
    2,
);
T("GROUND LINE - FEET STAND HERE (76% DOWN)", X0 + 10, groundY - 28, GROUND_C, 2);
T("FLOOR - FLAT, LEVEL, EMPTY MIDDLE", X0 + 10, groundY + 12, INK, 2);

T("PORTRAIT WINDOW", portLeft + 8, groundY - 118, PORTRAIT_C, 2);
T(`${Math.round((portBand / SHOW_W) * 100)}% OF WIDTH, FULL HEIGHT`, portLeft + 8, groundY - 94, PORTRAIT_C, 2);
T("LANDSCAPE WINDOW", X0 + SHOW_W - 230, landTop + 10, LANDSCAPE_C, 2);
T(`${Math.round((landBand / SHOW_H) * 100)}% HEIGHT`, X0 + SHOW_W - 230, landTop + 34, LANDSCAPE_C, 2);

// --- preview panes: what the player actually sees ---------------------------
const PX = X0 + SHOW_W + 40;
let py = Y0;

/** A pane showing one orientation's crop of the master, with the HUD on top. */
function pane(x, y, w, h, label, opts) {
    // Which slice of the master this viewport shows.
    const scale = Math.max(w / SHOW_W, h / SHOW_H);
    const drawn = SHOW_H * scale;
    let oy = y + h * opts.screenGround - SOURCE_GROUND * drawn;
    oy = Math.min(y, Math.max(y + h - drawn, oy));
    const ox = x + (w - drawn) / 2;

    // Re-draw the master's bands through the crop.
    const band = (fromF, toF, colour, alpha) => {
        const y0 = Math.max(y, Math.round(oy + fromF * drawn));
        const y1 = Math.min(y + h, Math.round(oy + toF * drawn));
        if (y1 > y0) fill(x, y0, w, y1 - y0, colour, alpha);
    };
    const skyF = (landTop - Y0) / SHOW_H;
    const horizLoF = (horizonLo - Y0) / SHOW_H;
    band(0, skyF, SKY, 0.5);
    band(skyF, horizLoF, FAR, 0.55);
    band(horizLoF, SOURCE_GROUND, CORE, 0.45);
    band(SOURCE_GROUND, 1, FLOOR, 0.6);

    const gy = Math.round(oy + SOURCE_GROUND * drawn);
    hLine(gy, x, x + w, GROUND_C, 2);
    const hz = Math.round(oy + horizLoF * drawn);
    hLine(hz, x, x + w, [70, 130, 100], 2, 8);

    // Character silhouettes at the same scale the game uses.
    const personH = Math.round(SOURCE_PERSON_HEIGHT * drawn);
    const personW = Math.round(personH * 0.26);
    for (const cx of opts.figures) {
        const fx = Math.round(x + w * cx - personW / 2);
        fill(fx, gy - personH, personW, personH, [70, 60, 80], 0.72);
    }

    // HUD footprint.
    if (opts.landscape) {
        fill(
            x + Math.round(w * HUD.landscape.deckLeft),
            y,
            Math.round(w * (1 - HUD.landscape.deckLeft)),
            h,
            HUD_C,
            0.72,
        );
        fill(x + 4, y + 4, Math.round(w * HUD.landscape.headerW), Math.round(h * HUD.landscape.headerH), HUD_C, 0.72);
    } else {
        fill(x, y + Math.round(h * HUD.portrait.deckTop), w, h - Math.round(h * HUD.portrait.deckTop), HUD_C, 0.72);
        fill(x, y, w, Math.round(h * HUD.portrait.headerH), HUD_C, 0.72);
    }

    rect(x, y, w, h, INK, 2);
    T(label, x, y - 26, INK, 2);
}

T("WHAT THE PLAYER SEES", PX, PAD - 4, INK, 3);
pane(PX, py, PORT_PANE_W, PANE_H, "PORTRAIT 1080x1920", {
    screenGround: SCREEN_GROUND_PORTRAIT,
    figures: [0.29, 0.71],
    landscape: false,
});
pane(PX + PORT_PANE_W + 20, py, LAND_PANE_W, 360, "LANDSCAPE 2340x1080", {
    screenGround: SCREEN_GROUND_LANDSCAPE,
    figures: [0.18, 0.48],
    landscape: true,
});

py += PANE_H + 46;
T("RULES", PX, py, INK, 3);
py += 34;
const rules = [
    "1. 3:2 MASTER. GROUND LINE 76% DOWN, FEET STAND ON IT.",
    "   A STANDING ADULT IS 34% OF THE IMAGE HEIGHT - PAINT BENCHES, RAILINGS",
    "   AND DOORWAYS TO THAT SCALE. THE CAST IS SIZED FROM THE PAINTING, NOT",
    "   FROM THE SCREEN, SO THEY MATCH YOUR SCENERY IN BOTH ORIENTATIONS.",
    "2. HORIZON INSIDE THE GREEN BAND. THIS IS THE ONE THAT GETS MISSED -",
    "   A HORIZON PAINTED HIGH IS CROPPED AWAY AND LANDSCAPE BECOMES BARE FLOOR.",
    "3. FLOOR FLAT AND EMPTY THROUGH THE MIDDLE, PAINTED TO THE BOTTOM EDGE.",
    "4. SCENERY AND PROPS AT THE LEFT AND RIGHT EDGES, FRAMING THE CENTRE.",
    "5. KEEP THE CENTRE-RIGHT READABLE: LANDSCAPE PUTS THE ACTION DECK THERE.",
    "6. NO PEOPLE, NO ANIMALS, NO TEXT OR LETTERING ANYWHERE.",
    "7. EVERY PROP TO THE SCALE LADDER BELOW. THIS IS THE OTHER ONE THAT GETS",
    "   MISSED: WITH NO HUMAN IN FRAME NOTHING FORCES THE FURNITURE TO AGREE,",
    "   AND A PAINTING CAN EVEN DISAGREE WITH ITSELF - THE FIRST BEACH PUT ITS",
    "   NEAR BENCH AT 2.9x LIFE SIZE AND ITS FAR RAILING AT 0.4x.",
    "",
    "THE GROUND LINE IS NOT A FREE CHOICE. PORTRAIT SHOWS THE WHOLE MASTER,",
    "SO THE PAINTED GROUND LANDS AT ITS OWN FRACTION OF THE SCREEN - IT MUST",
    "MATCH THE LAYOUT OR THE CAST STANDS ON AIR OR BEHIND THE ACTION DECK.",
];
for (const line of rules) {
    T(line, PX, py, line.startsWith("2.") || line.startsWith("   ") ? [30, 90, 60] : INK, 2);
    py += 26;
}

// --- legend -----------------------------------------------------------------
let ly = Y0 + SHOW_H + 30;
const swatch = (c, label, note) => {
    fill(X0, ly, 26, 18, c);
    rect(X0, ly, 26, 18, INK, 1);
    T(label, X0 + 38, ly + 1, INK, 2);
    T(note, X0 + 38 + textWidth(label, 2) + 18, ly + 1, MUTE, 2);
    ly += 30;
};
swatch(SKY, "SKY", "CROPPED IN LANDSCAPE");
swatch(FAR, "HORIZON", "SEA / SKYLINE / TREELINE GOES HERE");
swatch(CORE, "CHARACTERS", "THE CAST STANDS IN THIS BAND");
swatch(FLOOR, "FLOOR", "FLAT, LEVEL, EMPTY MIDDLE");
swatch(HUD_C, "HUD", "COVERED BY UI - KEEP DETAIL OUT");

// --- scale ladder -----------------------------------------------------------
// The rule the first three paintings all broke. Generated with no human
// reference, the beach put its near bench at 2.9x life size and its far hut
// railing at 0.4x — no single "how big is a person" constant can reconcile a
// painting that disagrees with itself.
const LADDER = [
    { cm: 45, label: "BENCH / CHAIR SEAT" },
    { cm: 85, label: "BENCH BACK, TABLE TOP, KERB POST" },
    { cm: 110, label: "RAILING, BALUSTRADE, COUNTER" },
    { cm: 175, label: "A STANDING ADULT" },
    { cm: 210, label: "DOORWAY TOP" },
    { cm: 300, label: "AWNING, SHOP SIGN, LOW BRANCH" },
];

let ladderY = ly + 30;
T("STYLE - STATE THIS FIRST AND LAST IN ANY PROMPT", X0, ladderY, INK, 3);
ladderY += 30;
for (const line of [
    "FLAT 2D CEL ANIME BACKGROUND ART. FLAT BLOCKS OF COLOUR, CRISP HARD EDGES.",
    "CLOUDS, WATER AND FOLIAGE AS SIMPLE STYLISED SHAPES. LIMITED PALETTE.",
    "HARD-EDGED SHADOW SHAPES, NO SOFT AIRBRUSH BLENDING.",
    "NOT: PHOTOGRAPH, PHOTOREALISM, 3D RENDER, WATER CAUSTICS, LENS BLUR,",
    "DEPTH OF FIELD, SOFT GRADIENTS, REALISTIC TEXTURES.",
    "A PROMPT HEAVY WITH MEASUREMENTS WILL DRIFT PHOTOREAL IF THE STYLE IS",
    "MENTIONED ONLY ONCE - LEAD WITH IT AND REPEAT IT AT THE END.",
]) {
    T(line, X0, ladderY, MUTE, 2);
    ladderY += 22;
}
ladderY += 18;

T("SCALE LADDER - PAINT EVERY PROP TO THIS", X0, ladderY, INK, 3);
ladderY += 34;
T("HEIGHTS ARE % OF IMAGE HEIGHT, UP FROM THE GROUND LINE.", X0, ladderY, MUTE, 2);
ladderY += 22;
T("A PROP FURTHER BACK IS SMALLER IN PROPORTION - BUT NEVER AT A", X0, ladderY, MUTE, 2);
ladderY += 22;
T("SIZE THAT MAKES A PERSON BESIDE IT THE WRONG HEIGHT.", X0, ladderY, MUTE, 2);
ladderY += 34;

// A miniature elevation: ground line, a figure, and a bar per reference height.
const ladderH = 240;
const ladderGround = ladderY + ladderH;
const cmToPx = ladderH / 340; // top of the chart is ~340cm
const ladderX = X0;
const ladderW = SHOW_W;
hLine(ladderGround, ladderX, ladderX + ladderW, GROUND_C, 3);
for (const step of LADDER) {
    const y = Math.round(ladderGround - step.cm * cmToPx);
    const isPerson = step.cm === 175;
    hLine(y, ladderX, ladderX + ladderW, isPerson ? GROUND_C : [120, 116, 128], 2, isPerson ? 0 : 8);
    T(
        `${step.cm}CM  ${((step.cm / 175) * SOURCE_PERSON_HEIGHT * 100).toFixed(1)}%  ${step.label}`,
        ladderX + 210,
        y - 20,
        isPerson ? GROUND_C : INK,
        2,
    );
}
// The figure: head, body, legs, drawn to the 175cm bar.
const figX = ladderX + 60;
const figH = Math.round(175 * cmToPx);
const headR = Math.round(figH * 0.07);
fill(figX - headR, ladderGround - figH, headR * 2, headR * 2, INK);
fill(
    figX - Math.round(figH * 0.09),
    ladderGround - figH + headR * 2,
    Math.round(figH * 0.18),
    Math.round(figH * 0.42),
    INK,
);
fill(
    figX - Math.round(figH * 0.07),
    ladderGround - Math.round(figH * 0.44),
    Math.round(figH * 0.05),
    Math.round(figH * 0.44),
    INK,
);
fill(
    figX + Math.round(figH * 0.02),
    ladderGround - Math.round(figH * 0.44),
    Math.round(figH * 0.05),
    Math.round(figH * 0.44),
    INK,
);
// A bench drawn correctly beside them, for comparison.
const benchX = figX + Math.round(figH * 0.22);
fill(benchX, ladderGround - Math.round(45 * cmToPx), Math.round(figH * 0.34), 5, [140, 100, 70]);
fill(benchX, ladderGround - Math.round(45 * cmToPx), 5, Math.round(45 * cmToPx), [140, 100, 70]);
fill(
    benchX + Math.round(figH * 0.34) - 5,
    ladderGround - Math.round(85 * cmToPx),
    5,
    Math.round(85 * cmToPx),
    [140, 100, 70],
);
fill(benchX, ladderGround - Math.round(85 * cmToPx), Math.round(figH * 0.34), 5, [140, 100, 70]);

T("VERIFY WITH: NPX TSX SCRIPTS/SCALE-RULER.MJS", X0, ladderGround + 24, MUTE, 2);

writeFileSync(path.join(root, "art/background_guides.png"), encodePng(img));
process.stdout.write(
    `${JSON.stringify({
        master: `${MASTER_W}x${MASTER_H}`,
        groundAt: SOURCE_GROUND,
        horizonBandOfMaster: `${(((horizonHi - Y0) / SHOW_H) * 100).toFixed(0)}%..${(((horizonLo - Y0) / SHOW_H) * 100).toFixed(0)}%`,
        portraitWindow: `${Math.round((portBand / SHOW_W) * 100)}% width`,
        landscapeWindow: `${Math.round((landBand / SHOW_H) * 100)}% height`,
        personIsPctOfImageHeight: SOURCE_PERSON_HEIGHT,
        out: "art/background_guides.png",
    })}\n`,
);
