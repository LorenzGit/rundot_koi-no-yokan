/**
 * React ↔ Pixi boundary. React owns WHEN the game exists (mount/unmount with
 * the 'playing' phase); Pixi owns everything inside the canvas. No React
 * state flows in per-frame — game → UI communication goes through the store.
 *
 * StrictMode-safe: the realm-wide renderer lifecycle queue serializes the
 * mount/cleanup/mount sequence, including initialization itself.
 */
import { useEffect, useRef, useState } from "react";
import type { Application } from "pixi.js";
import { createPixiApp } from "./pixiApp.ts";
import { createStage, type Stage } from "./stage.ts";
import { createDateScene } from "./dateScene.ts";
import { DateSim, movesForAffection, type DateOutcome } from "./sim/dateSim.ts";
import { CONFIDANT_BONUS_MOVES, AD_INTERSTITIAL_EVERY } from "./data/monetization.ts";
import { PLATFORM_IDS } from "../config/platform.ts";
import { ARCHETYPES, CAST_BY_ID, LOCATIONS } from "./data/world.ts";
import { ACTIONS_BY_ID } from "./data/actions.ts";
import type { GiftDef, SparkTick } from "./data/types.ts";
import { store, useStore } from "../state/store.ts";
import { audioManager } from "../audio/audioManager.ts";
import { getProfile, hasEntitlement, noteDateFinished, personFor, recordDate } from "../state/profile.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import {
    acquireRendererRuntime,
    type RendererLease,
    type RendererLifecycleScope,
} from "../rendering/rendererLifecycle.ts";

/**
 * Imperative bridge for the HUD. The action bar is DOM, the date is Pixi, and
 * this handle is the one seam between them — deliberately mutable rather than
 * React state, so tapping a card never re-renders the canvas.
 */
export const dateControls: {
    /** Start a move. False when the date is already over. */
    begin: ((actionId: string, gift?: GiftDef) => boolean) | null;
    /** Advance the move by one second: a tick, or the finished outcome. */
    step: (() => { tick: SparkTick } | { outcome: DateOutcome }) | null;
    /** End the evening, once the player has read the final result. */
    finish: (() => void) | null;
    /** Return the pair to idle: your bubble clears, theirs picks a new topic. */
    rest: (() => void) | null;
    sim: DateSim | null;
} = { begin: null, step: null, finish: null, rest: null, sim: null };

interface GameRenderer {
    app: Application;
}

async function initializeGameRenderer(scope: RendererLifecycleScope, host: HTMLElement): Promise<GameRenderer> {
    const app = await createPixiApp(scope, host);
    scope.throwIfCancelled();

    // Design-resolution stage: scenes position in design units, not pixels.
    const stage: Stage = createStage(app);
    scope.manage(() => stage.destroy());

    const state = store.get();
    const partner = CAST_BY_ID[state.dateWith ?? ""];
    const location = LOCATIONS.find((l) => l.id === state.dateAt) ?? LOCATIONS[0];
    if (!location) throw new Error("no locations defined");
    const playerId = getProfile().avatar ?? "char_f_artist";
    if (!partner) throw new Error("no date target selected");

    const affection = personFor(partner.id).affection;
    const sim = new DateSim({
        archetype: ARCHETYPES[partner.archetype],
        location,
        affection,
        // The Confidant unlock buys two more moves on every date, for good.
        moves:
            movesForAffection(affection) +
            (hasEntitlement(PLATFORM_IDS.confidantEntitlement) ? CONFIDANT_BONUS_MOVES : 0),
        seed: Date.now() & 0xffff,
    });

    // Topics the player actually saw them thinking about become Book entries.
    const seenTopics = new Set<string>();
    let confessed = false;

    const scene = await createDateScene(app, stage, {
        sim,
        partner,
        playerId,
        location,
        onTick(live) {
            seenTopics.add(live.topic);
            store.patch({
                gauges: {
                    mood: live.mood,
                    tension: live.tension,
                    spark: live.spark,
                    movesLeft: live.movesLeft,
                    inBand: live.inBand(),
                    topic: live.topic,
                    activeTopics: [...live.activeTopics],
                },
            });
        },
        onFinished(live) {
            finishDate(live);
        },
    });
    scope.manage(() => scene.destroy());
    scope.throwIfCancelled();

    function finishDate(live: DateSim): void {
        if (!partner) return;
        const gained = live.affectionGain();
        // The evening is over: a warm chime if it went anywhere, a soft fall
        // if it did not.
        audioManager.play(gained > 0 ? "reward" : "fumble");
        recordDate(partner.id, gained, live.spark, [...seenTopics]);
        // A confession only lands if the evening actually earned it.
        const accepted = confessed && personFor(partner.id).affection >= 90;
        store.patch({
            phase: "menu",
            koiScreen: "result",
            selectedGift: null,
            lastResult: { personId: partner.id, gained, spark: live.spark, confessed, accepted },
        });

        // The only ad the player did not ask for, and it runs strictly between
        // dates, every few evenings. Fire-and-forget: whether it shows must
        // never gate the results screen.
        if (noteDateFinished(AD_INTERSTITIAL_EVERY)) void runtimeServices.showBetweenDatesAd();
    }

    // The date is on.
    audioManager.play("start");

    dateControls.sim = sim;
    // Live, one second at a time. The HUD starts a move, then steps it; the
    // scene reacts to each tick as it happens rather than being handed a
    // finished result.
    dateControls.begin = (actionId, gift) => {
        if (sim.finished) return false;
        sim.beginAction(actionId, gift);
        scene.beginAction(ACTIONS_BY_ID[actionId]?.icon);
        return true;
    };
    /**
     * End the evening. Driven by the player dismissing the last result rather
     * than by the sim hitting zero moves, or the final move's outcome would be
     * swept off screen the instant it resolved.
     */
    dateControls.rest = () => {
        scene.rest();
    };
    dateControls.finish = () => {
        finishDate(sim);
    };
    dateControls.step = () => {
        const step = sim.stepAction();
        if ("tick" in step) {
            scene.reactTick(step.tick);
            return step;
        }
        if (step.outcome.endsDate) confessed = true;
        scene.settle(step.outcome);
        return step;
    };
    scope.manage(() => {
        dateControls.begin = null;
        dateControls.step = null;
        dateControls.finish = null;
        dateControls.rest = null;
        dateControls.sim = null;
    });

    // Respect a pause that landed while the canvas was initializing.
    if (store.get().paused || document.hidden) app.ticker.stop();
    return { app };
}

export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);
    const paused = useStore((s) => s.paused);
    // Opaque until the scene has real pixels: while Pixi initializes and the
    // textures stream in, the canvas is transparent and the menu backdrop
    // ghosted through it for a few frames.
    const [sceneReady, setSceneReady] = useState(false);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const abortController = new AbortController();
        let lease: RendererLease<GameRenderer> | null = null;

        void acquireRendererRuntime("pixi-game", abortController.signal, (scope) => initializeGameRenderer(scope, host))
            .then((nextLease) => {
                lease = nextLease;
                appRef.current = nextLease.value.app;
                setSceneReady(true);
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
                    return;
                }
                console.error("[renderer] Pixi initialization failed", error);
                store.patch({
                    phase: "menu",
                    koiScreen: "home",
                    toast: "RENDERER UNAVAILABLE. TRY A DIFFERENT DEVICE",
                });
            });

        return () => {
            abortController.abort();
            appRef.current = null;
            setSceneReady(false);
            void lease?.release();
        };
    }, []);

    // Host lifecycle pause/resume → freeze/unfreeze the whole ticker.
    useEffect(() => {
        const app = appRef.current;
        if (!app) return;
        if (paused || document.hidden) app.ticker.stop();
        else app.ticker.start();
    }, [paused]);

    // Browser visibility is a second lifecycle source outside the RUN host.
    // Keep it independent from `paused` so a visibility event cannot clear a
    // host-owned pause overlay.
    useEffect(() => {
        const syncVisibility = () => {
            const app = appRef.current;
            if (!app) return;
            if (document.hidden || store.get().paused) app.ticker.stop();
            else app.ticker.start();
        };
        document.addEventListener("visibilitychange", syncVisibility);
        return () => document.removeEventListener("visibilitychange", syncVisibility);
    }, []);

    return (
        <div className="absolute inset-0">
            <div ref={hostRef} className="absolute inset-0" />
            <div className={`koi-date-veil ${sceneReady ? "is-lifted" : ""}`} aria-hidden="true" />
        </div>
    );
}
