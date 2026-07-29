/**
 * Cherry blossom petals drifting down the menu.
 *
 * Deliberately DOM + CSS rather than a canvas: the menu screens have no Pixi
 * app, and a dozen absolutely-positioned elements animating transform/opacity
 * stay on the compositor without a render loop. Each petal gets its own
 * randomised delay, duration, drift and size so the fall never reads as a loop.
 *
 * The wind is two layers: a steady fall plus an independent sideways flutter,
 * with a slow gust rocking the whole field. Separate periods keep any single
 * petal from tracing the same path twice.
 *
 * Honours the reduced-motion setting — the petals simply do not mount.
 */
import { useMemo } from "react";
import { useStore } from "../../state/store.ts";
import { NoiseRandom } from "../../game/noiseRandom.ts";

const PETAL_COUNT = 14;

export default function PetalFall() {
    const reducedMotion = useStore((s) => s.reducedMotion);

    // Randomised once per mount; regenerating per render would make every
    // petal jump to a new position on any unrelated state change.
    const petals = useMemo(() => {
        // Seeded from the clock so each visit differs, but drawn through
        // NoiseRandom like all randomness in this project.
        const noise = new NoiseRandom(Date.now() >>> 0);
        return Array.from({ length: PETAL_COUNT }, (_, i) => ({
            key: i,
            left: noise.float(0, 100),
            // The fall.
            delay: noise.float(-16, 0),
            duration: noise.float(12, 22),
            drift: `${noise.float(-70, 70)}px`,
            // The flutter. Deliberately unrelated periods to the fall, so a
            // petal never repeats the same path down the screen.
            swayDelay: noise.float(-6, 0),
            swayDuration: noise.float(2.4, 5.2),
            sway: `${noise.float(10, 26)}px`,
            tilt: `${noise.float(35, 70)}deg`,
            size: noise.float(7, 14),
            spin: noise.float(0, 1) > 0.5 ? "1" : "-1",
            opacity: noise.float(0.35, 0.8),
        }));
    }, []);

    if (reducedMotion) return null;

    return (
        // The outer element clips at exactly the viewport; the inner one
        // carries the gust. Animating the clip box itself pushes its own rect
        // off-screen, which ViewDeck flags as elements-outside-viewport.
        <div className="koi-petals" aria-hidden="true">
            <div className="koi-petals-field">
                {petals.map((p) => (
                    /* Two nested elements on purpose: the outer one carries the
                   fall and the overall drift, the inner one the sideways
                   flutter and tilt. Combining them on a single element would
                   lock the flutter to the fall's period and read as a loop. */
                    <i
                        key={p.key}
                        className="koi-petal-fall"
                        style={
                            {
                                left: `${p.left}%`,
                                animationDelay: `${p.delay}s`,
                                animationDuration: `${p.duration}s`,
                                "--drift": p.drift,
                            } as React.CSSProperties
                        }
                    >
                        <i
                            className="koi-petal"
                            style={
                                {
                                    width: `${p.size}px`,
                                    height: `${p.size * 0.8}px`,
                                    opacity: p.opacity,
                                    animationDelay: `${p.swayDelay}s`,
                                    animationDuration: `${p.swayDuration}s`,
                                    "--sway": p.sway,
                                    "--tilt": p.tilt,
                                    "--spin": p.spin,
                                } as React.CSSProperties
                            }
                        />
                    </i>
                ))}
            </div>
        </div>
    );
}
