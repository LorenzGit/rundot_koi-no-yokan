/**
 * Sound and haptics for every button in the game, from one place.
 *
 * Delegated rather than wired per component: there are ~40 buttons across nine
 * screens and the Pixi HUD, and any new one would silently ship without
 * feedback. A single capture-phase listener cannot be forgotten.
 *
 * Fires on pointerdown, not click: feedback that arrives on release feels
 * late, and a drag that starts on a card should still acknowledge the press.
 */
import { useEffect } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import type { HapticStyle } from "../sdk/runSdk.ts";

/** Weightier feedback for the choices that actually commit to something. */
function feedbackFor(element: HTMLElement): { cue: "tap" | "charm" | "chime"; haptic: HapticStyle } {
    if (element.closest(".koi-cta")) return { cue: "charm", haptic: "medium" };
    if (element.closest(".koi-switch") || element.closest(".koi-segmented")) {
        return { cue: "chime", haptic: "light" };
    }
    return { cue: "tap", haptic: "light" };
}

export function useButtonFeedback(): void {
    useEffect(() => {
        const onPointerDown = (event: Event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const control = target.closest("button, input[type='checkbox'], select, [role='tab']");
            if (!(control instanceof HTMLElement)) return;
            // A disabled control gives no feedback: pretending a dead button
            // responded is worse than silence.
            if (control.matches(":disabled")) return;

            const { cue, haptic } = feedbackFor(control);
            audioManager.play(cue);
            // Fire and forget. runtimeServices.haptic already respects the
            // player's haptics setting and resolves false off-device.
            void runtimeServices.haptic(haptic);
        };

        window.addEventListener("pointerdown", onPointerDown, { capture: true });
        return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
    }, []);
}
