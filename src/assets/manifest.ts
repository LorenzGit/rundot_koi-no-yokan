/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * The game's art lives under public/images and is referenced by stable URL
 * (the cast cutouts are shared between <img> tags and the Pixi scene).
 *
 * Two tiers (pattern from a shipped RUN game):
 *   - 'critical'  — awaited during the loading screen. Everything the first
 *                   interactive screen needs: the menu painting.
 * Date backdrops are loaded on demand by warmDateAssets(). Preloading all
 * three kept roughly 42 MB of decoded pixels alive before the first date and
 * made memory-constrained webviews much more likely to be killed.
 *
 * Keep 'critical' small: every asset here delays first interaction.
 */
import type { AssetsManifest, UnresolvedAsset } from "pixi.js";
import menuSakuraUrl from "./art/menu_sakura.png";
import rinHarutoFirstDateUrl from "./art/rin-haruto-first-date.jpg";

/** The sakura menu painting, bundled and fingerprinted by Vite. */
export const MENU_BACKDROP_URL = menuSakuraUrl;

/** Player-supplied key art for the Rin and Haruto first-date video. */
export const RIN_HARUTO_FIRST_DATE_IMAGE_URL = rinHarutoFirstDateUrl;

/**
 * A narrowing of Pixi's AssetsManifest: Pixi also allows `assets` to be a
 * record, but this game keeps it an array so the tier filters below can
 * check `assets.length`. Still assignable to AssetsManifest (Assets.init).
 */
export interface Manifest extends AssetsManifest {
    bundles: { name: string; assets: UnresolvedAsset[] }[];
}

export const MANIFEST: Manifest = {
    bundles: [
        {
            name: "critical",
            // The sakura menu painting: the first screen after the loader.
            assets: [{ alias: "menu-backdrop", src: menuSakuraUrl }],
        },
    ],
};

// Empty bundles are skipped so an unused tier never errors.
export const CRITICAL_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name !== "deferred" && b.assets.length > 0)
    .map((b) => b.name);

export const DEFERRED_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name === "deferred" && b.assets.length > 0)
    .map((b) => b.name);
