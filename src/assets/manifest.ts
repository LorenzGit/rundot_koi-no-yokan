/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * The game's art lives under public/images and is referenced by stable URL
 * (the cast cutouts are shared between <img> tags and the Pixi scene).
 *
 * Two tiers (pattern from a shipped RUN game):
 *   - 'critical'  — awaited during the loading screen. Everything the first
 *                   interactive screen needs: the menu painting.
 *   - 'deferred'  — fire-and-forget background load after boot: the date
 *                   backdrops, so the first evening starts without a fetch.
 *
 * Keep 'critical' small: every asset here delays first interaction.
 */
import type { AssetsManifest, UnresolvedAsset } from "pixi.js";
import menuSakuraUrl from "./art/menu_sakura.png";

/** The sakura menu painting, bundled and fingerprinted by Vite. */
export const MENU_BACKDROP_URL = menuSakuraUrl;

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
        {
            name: "deferred",
            assets: [
                { alias: "bg-sakura-plaza", src: "images/bg_sakura_plaza.png" },
                { alias: "bg-beach-terrace", src: "images/bg_beach_terrace.png" },
                { alias: "bg-trattoria", src: "images/bg_trattoria.png" },
            ],
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
