/**
 * Global UI state for the dating shell: phase routing, the settings overlay,
 * settings mirrored from the save, and the in-date gauges shared between the
 * Pixi scene and the React HUD.
 */
import { useSyncExternalStore } from "react";

export type MenuScreen = "main" | "settings";

/** Screens inside the dating meta-loop. */
export type KoiScreen = "avatar" | "home" | "book" | "shop" | "plan" | "result" | "postcard";

/** Live gauges mirrored out of the Pixi date scene for the HUD. */
export interface DateGauges {
    mood: number;
    tension: number;
    spark: number;
    movesLeft: number;
    /** Subjects on the table right now, for the HUD's topic row. */
    activeTopics: string[];
    inBand: boolean;
    topic: string;
}

export interface DateResult {
    personId: string;
    gained: number;
    spark: number;
    confessed: boolean;
    accepted: boolean;
    romanceScore: number;
    leaderboardRank: number | null;
    leaderboardAccepted: boolean | null;
    leaderboardPending: boolean;
}

export interface AppState {
    /** Boot and navigation state */
    phase: "loading" | "menu" | "playing";
    /** Progress bar state while critical assets warm */
    loadProgress: number;
    /** Game is paused by host lifecycle */
    paused: boolean;
    /** Settings overlay (the only screen above the dating loop) */
    menuScreen: MenuScreen;

    /** Player settings mirrored from save */
    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
    notificationsEnabled: boolean;
    notificationsConsent: "unknown" | "granted" | "denied";
    hapticsEnabled: boolean;
    reducedMotion: boolean;
    locale: string;
    quality: "high" | "low";

    /** One-time toasts surfaced from systems/purchases/tutorials */
    toast: string | null;
    /**
     * Bumped on every toast set so a REPEATED identical message still restarts
     * the auto-dismiss timer. Keying the Toast component's effect off the text
     * alone breaks when the same message fires twice: the snapshot compares
     * equal, React skips the re-render, and the first timer kills the second.
     */
    toastSeq: number;
    /** The How to play legend, re-openable from Settings. */
    howToOpen: boolean;

    /** --- KOI NO YOKAN ---------------------------------------------------- */
    /** Which meta screen is showing while phase === 'menu'. */
    koiScreen: KoiScreen;
    /** Who tonight's date is with, and where. Set before phase flips to 'playing'. */
    dateWith: string | null;
    dateAt: string | null;
    /** Mirrored from the sim each frame; never drives Pixi. */
    gauges: DateGauges;
    /** Gift selected on the action bar, consumed by the next Gift action. */
    selectedGift: string | null;
    /** Populated when a date ends, read by the result screen. */
    lastResult: DateResult | null;

    /** Runtime/LiveOps state */
    runtimeReady: boolean;
    runtimeConfigVersion: string | null;
    trustedTimeReady: boolean;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: "loading",
    loadProgress: 0,
    paused: false,
    menuScreen: "main",

    // One looping bed ("Cherry Promenade") plus SFX, on by default.
    musicEnabled: true,
    musicVolume: 0.42,
    sfxEnabled: true,
    sfxVolume: 0.7,
    notificationsEnabled: false,
    notificationsConsent: "unknown",
    hapticsEnabled: true,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    locale: "English",
    quality: "high",

    toast: null,
    toastSeq: 0,
    howToOpen: false,

    koiScreen: "avatar",
    dateWith: null,
    dateAt: null,
    gauges: { mood: 45, tension: 20, spark: 0, movesLeft: 12, inBand: false, topic: "food", activeTopics: [] },
    selectedGift: null,
    lastResult: null,

    runtimeReady: false,
    runtimeConfigVersion: null,
    trustedTimeReady: false,
};

export const store = {
    get(): AppState {
        return state;
    },

    patch(partial: Partial<AppState>): void {
        // Stamp toastSeq whenever a toast is set so every producer gets the
        // repeat-safe behavior without changing its call site.
        state =
            typeof partial.toast === "string"
                ? { ...state, ...partial, toastSeq: state.toastSeq + 1 }
                : { ...state, ...partial };
        for (const l of listeners) l();
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

export function useStore<T = AppState>(selector: (s: AppState) => T = (s) => s as unknown as T): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
