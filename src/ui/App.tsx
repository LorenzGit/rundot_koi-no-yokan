/**
 * Screen router. One phase visible at a time; the 'playing' phase stacks the
 * React HUD above the Pixi canvas.
 *
 * #app-frame (styled in styles/app.css) is the playable frame: portrait-first
 * with a dedicated landscape layout, centered over a full-bleed backdrop.
 * Everything interactive — canvas and DOM UI — lives inside the frame, so
 * safe areas and input never leak into decorative side art.
 */
import { store, useStore } from "../state/store.ts";
import { lazy, Suspense, useEffect } from "react";
import LoadingScreen from "./LoadingScreen.tsx";
import AvatarSelect from "./koi/AvatarSelect.tsx";
import HomeScreen from "./koi/HomeScreen.tsx";
import PlanDate from "./koi/PlanDate.tsx";
import BookScreen from "./koi/BookScreen.tsx";
import PostcardScreen from "./koi/PostcardScreen.tsx";
import GiftShop from "./koi/GiftShop.tsx";
import ResultScreen from "./koi/ResultScreen.tsx";
import DateHud from "./koi/DateHud.tsx";
import HowToPlay from "./koi/HowToPlay.tsx";
import GameCanvas from "../game/GameCanvas.tsx";
import SettingsScreen from "./SettingsScreen.tsx";
import { applyRunSafeArea } from "../sdk/runSdk.ts";
import { audioManager } from "../audio/audioManager.ts";
import { CAST_BY_ID } from "../game/data/world.ts";
import { MENU_BACKDROP_URL } from "../assets/manifest.ts";
import { useProfile } from "./koi/useProfile.ts";
import SettingsFab from "./koi/SettingsFab.tsx";
import { useButtonFeedback } from "./useButtonFeedback.ts";
import packageJson from "../../package.json";

const DevelopmentTools = import.meta.env.DEV ? lazy(() => import("../dev/DevelopmentTools.tsx")) : null;

// The sakura backdrop URL is bundled, so only JS knows it: publish it for the
// stylesheet's var(--scene-backdrop) consumers (page backdrop and menu art).
document.documentElement.style.setProperty("--scene-backdrop", `url("${MENU_BACKDROP_URL}")`);

/**
 * The DOM UI was authored around the iPhone 16 Pro in both orientations.
 * Larger viewports scale that proven layout up, but only while enough width
 * and height remain for the complete design. Basing the factor on the short
 * edge alone made desktop landscape 2.4x tall while leaving less than 720
 * design pixels across, collapsing every horizontal layout into a clipped
 * strip.
 *
 * The CSS layout box is published alongside the scale so percentage-based
 * centring uses design pixels, not the unscaled physical viewport.
 */
const PORTRAIT_DESIGN_WIDTH = 393;
const PORTRAIT_MIN_HEIGHT = 667;
const LANDSCAPE_DESIGN_WIDTH = 840;
const LANDSCAPE_DESIGN_HEIGHT = 393;
const MAX_UI_SCALE = 2.4;

function uiScaleFor(width: number, height: number): number {
    const portrait = width <= height;
    const designWidth = portrait ? PORTRAIT_DESIGN_WIDTH : LANDSCAPE_DESIGN_WIDTH;
    const designHeight = portrait ? PORTRAIT_MIN_HEIGHT : LANDSCAPE_DESIGN_HEIGHT;
    return Math.min(MAX_UI_SCALE, Math.max(1, Math.min(width / designWidth, height / designHeight)));
}

function useUiScale(): void {
    useEffect(() => {
        const applyScale = () => {
            const frame = document.getElementById("app-frame");
            const width = frame?.clientWidth || window.innerWidth;
            const height = frame?.clientHeight || window.innerHeight;
            const scale = uiScaleFor(width, height);
            document.documentElement.style.setProperty("--ui-scale", scale.toFixed(4));
            document.documentElement.style.setProperty("--ui-layout-width", `${width / scale}px`);
            document.documentElement.style.setProperty("--ui-layout-height", `${height / scale}px`);
        };
        const frame = document.getElementById("app-frame");
        const observer = frame && typeof ResizeObserver !== "undefined" ? new ResizeObserver(applyScale) : null;
        applyScale();
        window.addEventListener("resize", applyScale);
        window.addEventListener("orientationchange", applyScale);
        if (frame && observer) observer.observe(frame);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", applyScale);
            window.removeEventListener("orientationchange", applyScale);
        };
    }, []);
}

/**
 * Web Audio starts suspended until a real user gesture resumes it, so every
 * cue the game fired was going into a dead context and the game was silent.
 * The template only ever unlocked from its own settings and debug screens,
 * which the dating loop never visits. One capture-phase listener on the first
 * interaction covers every entry point.
 */
function useAudioUnlock(): void {
    useEffect(() => {
        const unlock = () => {
            void audioManager.unlock();
        };
        const options = { once: true, capture: true } as const;
        window.addEventListener("pointerdown", unlock, options);
        window.addEventListener("keydown", unlock, options);
        return () => {
            window.removeEventListener("pointerdown", unlock, options);
            window.removeEventListener("keydown", unlock, options);
        };
    }, []);
}

function useOrientationSafeArea(): void {
    useEffect(() => {
        const refreshSafeArea = () => {
            applyRunSafeArea();
        };
        window.addEventListener("orientationchange", refreshSafeArea);
        return () => window.removeEventListener("orientationchange", refreshSafeArea);
    }, []);
}

/**
 * The dating meta-loop owns the 'menu' phase; `koiScreen` is the default
 * route. The only screen layered above it is settings.
 */
function KoiRoute() {
    const screen = useStore((state) => state.koiScreen);
    if (screen === "avatar") return <AvatarSelect />;
    if (screen === "plan") return <PlanDate />;
    if (screen === "book") return <BookScreen />;
    if (screen === "postcard") return <PostcardScreen />;
    if (screen === "shop") return <GiftShop />;
    if (screen === "result") return <ResultScreen />;
    return <HomeScreen />;
}

export default function App() {
    useOrientationSafeArea();
    useUiScale();
    useAudioUnlock();
    useButtonFeedback();
    const phase = useStore((s) => s.phase);
    const menuScreen = useStore((s) => s.menuScreen);
    const howToOpen = useStore((s) => s.howToOpen);
    const tutorialSeen = useProfile((p) => p.tutorialSeen);
    // The character you chose to be owns the accent colour for the whole app.
    // Anything showing a *different* person overrides --koi-char locally; the
    // rest of the chrome inherits yours from here. See :root in app.css.
    const avatar = useProfile((p) => p.avatar);
    const accent = avatar ? CAST_BY_ID[avatar]?.color : undefined;
    // The legend opens itself exactly once: at the first date, over the veil
    // that hides the scene loading. After that it is Settings-only.
    const showHowTo = howToOpen || (phase === "playing" && !tutorialSeen);
    return (
        <div
            id="app-frame"
            className="bg-surface text-white"
            style={accent ? ({ "--koi-accent": accent } as React.CSSProperties) : undefined}
        >
            {phase === "loading" && <LoadingScreen />}
            {phase === "menu" && menuScreen === "main" && <KoiRoute />}
            {phase === "playing" && (
                <div className="absolute inset-0">
                    <GameCanvas />
                    <DateHud />
                </div>
            )}
            {/* Settings renders OVER whatever is running, including a date.
                Routing to it only under the 'menu' phase meant tapping settings
                mid-date swapped the button out for nothing at all: the screen
                never mounted and the player was left staring at the same scene
                with no way back. Overlaying also keeps the canvas mounted, so
                the date survives the trip. */}
            {menuScreen === "settings" && <SettingsScreen />}
            {showHowTo && <HowToPlay />}
            <SettingsFab />
            <span className="koi-build-version">v{packageJson.version}</span>
            <Toast />
            <DevelopmentToolsSlot />
        </div>
    );
}

function DevelopmentToolsSlot() {
    if (!DevelopmentTools || new URLSearchParams(window.location.search).get("debug") !== "1") return null;
    return (
        <Suspense fallback={null}>
            <DevelopmentTools />
        </Suspense>
    );
}

function Toast() {
    const toast = useStore((state) => state.toast);
    // A toast you never tap still leaves: it is a note, not a roadblock.
    // The timer re-arms per message, so a queue of toasts each gets read.
    useEffect(() => {
        if (!toast) return;
        const id = window.setTimeout(() => store.patch({ toast: null }), 4000);
        return () => window.clearTimeout(id);
    }, [toast]);
    if (!toast) return null;
    return (
        <button type="button" className="toast" onClick={() => store.patch({ toast: null })}>
            {toast}
        </button>
    );
}
