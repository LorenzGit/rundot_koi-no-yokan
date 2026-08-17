import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import { store, type AppState } from "../state/store.ts";

const SAVE_KEY = "koi-no-yokan-save";
const LEGACY_SAVE_KEYS = ["rundot_template-save", "template-pixi-webgpu-save", "template-pixi-webgpu.save"] as const;
export const SAVE_VERSION = 2;

export interface GameSaveV2 {
    version: 2;
    settings: Pick<
        AppState,
        | "musicEnabled"
        | "musicVolume"
        | "sfxEnabled"
        | "sfxVolume"
        | "notificationsEnabled"
        | "notificationsOptOut"
        | "notificationsConsent"
        | "hapticsEnabled"
        | "reducedMotion"
        | "locale"
        | "quality"
    >;
}

export type SaveSource = "run" | "local" | "defaults";

function readLocalSave(): { key: string; value: string } | null {
    try {
        for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
            const value = window.localStorage.getItem(key);
            if (value !== null) return { key, value };
        }
        return null;
    } catch (error) {
        console.warn("[save] local fallback read failed", error);
        return null;
    }
}

function clamp01(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function snapshot(): GameSaveV2 {
    const state = store.get();
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: state.musicEnabled,
            musicVolume: state.musicVolume,
            sfxEnabled: state.sfxEnabled,
            sfxVolume: state.sfxVolume,
            notificationsEnabled: state.notificationsEnabled,
            notificationsOptOut: state.notificationsOptOut,
            notificationsConsent: state.notificationsConsent,
            hapticsEnabled: state.hapticsEnabled,
            reducedMotion: state.reducedMotion,
            locale: state.locale,
            quality: state.quality,
        },
    };
}

function migrate(raw: unknown): GameSaveV2 | null {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Omit<Partial<GameSaveV2>, "version"> & { version?: number };
    // Old saves carry progress/retention blocks from the template era; only
    // settings survive the move, and they were always optional.
    if ((candidate.version !== 1 && candidate.version !== SAVE_VERSION) || !candidate.settings) return null;
    const defaults = snapshot();
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: booleanOr(candidate.settings.musicEnabled, defaults.settings.musicEnabled),
            musicVolume: clamp01(candidate.settings.musicVolume, defaults.settings.musicVolume),
            sfxEnabled: booleanOr(candidate.settings.sfxEnabled, defaults.settings.sfxEnabled),
            sfxVolume: clamp01(candidate.settings.sfxVolume, defaults.settings.sfxVolume),
            hapticsEnabled: booleanOr(candidate.settings.hapticsEnabled, defaults.settings.hapticsEnabled),
            reducedMotion: booleanOr(candidate.settings.reducedMotion, defaults.settings.reducedMotion),
            locale: enumOr(
                candidate.settings.locale,
                ["English", "PortugueseBR", "SpanishLA"] as const,
                defaults.settings.locale,
            ),
            quality: enumOr(candidate.settings.quality, ["high", "low"] as const, defaults.settings.quality),
            notificationsConsent: enumOr(
                candidate.settings.notificationsConsent,
                ["unknown", "granted", "denied"] as const,
                defaults.settings.notificationsConsent,
            ),
            // Additive back-fill: saves written before the opt-out existed have
            // no field, and "absent" must mean "has not opted out" — defaulting
            // the other way would re-silence every existing player.
            notificationsOptOut: booleanOr(candidate.settings.notificationsOptOut, false),
            // Restored only so Settings paints something sane before the boot
            // probe lands; runtimeServices re-derives it from the live host
            // permission on the first refresh.
            notificationsEnabled: booleanOr(candidate.settings.notificationsEnabled, false),
        },
    };
}

function parse(raw: string | null): GameSaveV2 | null {
    if (!raw) return null;
    try {
        return migrate(JSON.parse(raw));
    } catch {
        return null;
    }
}

function apply(save: GameSaveV2): void {
    store.patch({ ...save.settings });
}

let lastSaved = "";
let pendingSave: string | null = null;
let flushInFlight: Promise<boolean> | null = null;

function usesRunStorage(): boolean {
    const capabilities = getRunCapabilities();
    return capabilities.host && !capabilities.mock;
}

async function persist(serialized: string): Promise<boolean> {
    if (usesRunStorage()) return writeAppStorage(SAVE_KEY, serialized);
    try {
        window.localStorage.setItem(SAVE_KEY, serialized);
        return true;
    } catch (error) {
        console.warn("[save] local fallback write failed", error);
        return false;
    }
}

export const saveSystem = {
    async load(): Promise<SaveSource> {
        if (!usesRunStorage()) {
            const stored = readLocalSave();
            const save = parse(stored?.value ?? null);
            if (save) apply(save);
            lastSaved = JSON.stringify(snapshot());
            if (save && stored?.key !== SAVE_KEY) {
                try {
                    window.localStorage.setItem(SAVE_KEY, lastSaved);
                } catch (error) {
                    console.warn("[save] local key migration failed", error);
                }
            }
            return save ? "local" : "defaults";
        }

        for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
            const remote = await readAppStorage(key);
            if (!remote.ok) return "defaults";
            const save = parse(remote.value);
            if (!save) continue;

            apply(save);
            lastSaved = JSON.stringify(snapshot());
            if (key !== SAVE_KEY) await writeAppStorage(SAVE_KEY, lastSaved);
            return "run";
        }

        lastSaved = JSON.stringify(snapshot());
        return "defaults";
    },

    async flush(): Promise<boolean> {
        const serialized = JSON.stringify(snapshot());
        if (serialized === lastSaved && pendingSave === null) return true;
        pendingSave = serialized;
        if (flushInFlight) return flushInFlight;

        // Serialize remote writes and coalesce rapid settings/gameplay changes.
        // An older, slower RPC can never complete after and overwrite a newer one.
        flushInFlight = (async () => {
            let allSucceeded = true;
            while (pendingSave !== null) {
                const next = pendingSave;
                pendingSave = null;
                if (next === lastSaved) continue;
                const saved = await persist(next);
                if (saved) lastSaved = next;
                else allSucceeded = false;
            }
            return allSucceeded;
        })().finally(() => {
            flushInFlight = null;
        });
        return flushInFlight;
    },
};
