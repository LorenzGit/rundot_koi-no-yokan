import { store, type KoiScreen } from "../state/store.ts";

const KOI_SCREENS = new Set<KoiScreen>(["avatar", "home", "plan", "book", "shop", "postcard", "result"]);

/**
 * Development-only deep link for visual review and automated browser checks.
 *
 * The query changes local in-memory navigation only; it never bypasses a RUN
 * permission, purchase, ad, entitlement, or other authoritative outcome.
 */
export function applyDevelopmentScreenPreview(): void {
    if (!import.meta.env.DEV) return;
    const requested = new URLSearchParams(window.location.search).get("screen");
    if (!requested) return;
    if (requested === "game") {
        store.patch({ phase: "playing", menuScreen: "main", paused: false });
        return;
    }
    if (requested === "settings") {
        store.patch({ phase: "menu", menuScreen: "settings", paused: false });
        return;
    }
    if (KOI_SCREENS.has(requested as KoiScreen)) {
        store.patch({ phase: "menu", menuScreen: "main", koiScreen: requested as KoiScreen, paused: false });
        return;
    }
    console.warn(`[dev] Unknown screen preview "${requested}".`);
}
