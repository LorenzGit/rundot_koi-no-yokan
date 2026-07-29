/**
 * The background contract — one source of truth for how a painted location is
 * framed, shared by the game, the preview tools and the guidelines sheet.
 *
 * A background is a **stage**, and the stage has to survive two very different
 * viewports. Cover-fitting a portrait painting into landscape and centring it
 * puts the visible slice through the middle of the sky and drops the floor off
 * the bottom entirely — the cast ends up standing below the screen.
 *
 * Two rules fix that:
 *
 *  1. **Author square.** A square master, cover-fitted, shows the full height
 *     and the central ~56% of the width in portrait, and the full width and a
 *     ~56% band of the height in landscape. Both crops are then predictable, and
 *     each one is generous in the axis the other one eats.
 *  2. **Anchor on the ground, never on the centre.** Position the painting so
 *     its own ground line lands on the on-screen foot line. The sky is what
 *     gets cropped in landscape, which is exactly what should be sacrificed.
 */

import { LOCATIONS } from "./world.ts";

/**
 * Where in the SOURCE image the cast's feet stand, as a fraction of height.
 *
 * This is NOT a free choice. A square master in a portrait viewport is
 * cover-fitted by height, so the entire master is visible and the painted
 * ground line lands at exactly its own fraction of the screen. It must
 * therefore equal SCREEN_GROUND_PORTRAIT, or the cast stands on empty air above
 * the painted floor, or behind the action deck. scripts/reframe-backgrounds.mjs grows
 * a painting's floor band to satisfy this without repainting.
 */
export const SOURCE_GROUND = 0.765;

/** Where on SCREEN the cast's feet stand, as a fraction of viewport height. */
// Just above the action deck, whose top edge measures at 0.795 of the viewport.
// Higher than this and the cast floats in the vertical middle of the frame with
// dead floor beneath them; lower and their feet disappear behind the deck.
export const SCREEN_GROUND_PORTRAIT = 0.765;
// Not lower: landscape has little vertical room, and pushing the ground line
// further down leaves no floor in front of the cast, so they read as standing
// against the bottom edge rather than in the scene.
export const SCREEN_GROUND_LANDSCAPE = 0.86;

/**
 * How tall a REFERENCE_CM person is, as a fraction of the PAINTING's height.
 *
 * This is the fix for "giants in portrait, tiny people in landscape". Sizing
 * the cast against the viewport instead makes them 54% of the painting in
 * portrait and 22.6% of it in landscape — a 2.39x mismatch — because cover-fit
 * is driven by height in portrait and by width in landscape, so the scenery is
 * magnified in one and not the other while the cast stays put.
 *
 * Tying the cast to the painting instead means they are always the same size
 * relative to the benches, lanterns and buildings around them. The value comes
 * from the paintings' own perspective: an eye-level camera puts a standing
 * adult's eyes on the horizon, so with the ground line at 0.765 and the horizon
 * band centred near 0.44, a person spans about (0.765 - 0.44) / 0.94.
 */
export const REFERENCE_CM = 175;
export const SOURCE_PERSON_HEIGHT = 0.345;

/** Aspect ratio at or above which we treat the viewport as landscape. */
export const LANDSCAPE_ASPECT = 1;

export interface BackdropPlacement {
    scale: number;
    x: number;
    y: number;
    /** On-screen y of the ground line, in the same units as the viewport. */
    groundY: number;
    /** On-screen height of a REFERENCE_CM person, in viewport units. */
    personHeight: number;
}

/**
 * Cover-fit a backdrop into a viewport, anchored on the ground line.
 *
 * Clamped so the painting never pulls away from an edge and reveals nothing:
 * anchoring is a preference, staying covered is a hard requirement.
 */
/**
 * The human scale of a specific painting, falling back to the global default.
 *
 * Kept as a lookup rather than a parameter everywhere so that callers which
 * only know a location id — the scale ruler, the orientation harness — cannot
 * silently disagree with the game about how big a person is.
 */
export function personFractionFor(locationId?: string): number {
    const location = LOCATIONS.find((l) => l.id === locationId);
    return location?.personHeightFraction ?? SOURCE_PERSON_HEIGHT;
}

export function placeBackdrop(
    imageWidth: number,
    imageHeight: number,
    viewWidth: number,
    viewHeight: number,
    locationId?: string,
): BackdropPlacement {
    const landscape = viewWidth / viewHeight >= LANDSCAPE_ASPECT;
    const screenGround = landscape ? SCREEN_GROUND_LANDSCAPE : SCREEN_GROUND_PORTRAIT;

    const scale = Math.max(viewWidth / imageWidth, viewHeight / imageHeight);
    const drawnWidth = imageWidth * scale;
    const drawnHeight = imageHeight * scale;

    // Put the painting's ground line on the screen's ground line...
    let y = viewHeight * screenGround - SOURCE_GROUND * drawnHeight;
    // ...but never uncover the frame.
    y = Math.min(0, Math.max(viewHeight - drawnHeight, y));

    // Re-read the ground line from where the painting ACTUALLY landed. When the
    // clamp bites, the requested position was not achievable, and reporting the
    // requested one instead stands the cast on empty air above the painted
    // floor — on the water, in the case of the beach.
    const groundY = y + SOURCE_GROUND * drawnHeight;

    // Derived from the backdrop, so the cast and the scenery are always at the
    // same scale as each other whatever the viewport is doing.
    const personHeight = personFractionFor(locationId) * drawnHeight;

    const x = (viewWidth - drawnWidth) / 2;
    return { scale, x, y, groundY, personHeight };
}
