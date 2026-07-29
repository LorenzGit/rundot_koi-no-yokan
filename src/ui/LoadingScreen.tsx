/**
 * Loading screen shown while warmAssets() runs. Rendered by React, revealed
 * when the boot cover lifts, driven by store.loadProgress.
 */
import { useStore } from "../state/store.ts";

export default function LoadingScreen() {
    const progress = useStore((s) => s.loadProgress);
    const pct = Math.round(progress * 100);
    return (
        <main className="loading-screen pt-safe-top pb-safe-bottom">
            <div className="loading-mark loading-mark-heart" aria-hidden="true">
                ♡
            </div>
            <div className="loading-title">
                <span>KOI NO</span>
                <strong>YOKAN</strong>
            </div>
            <div className="loading-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="loading-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="loading-copy">THE FEELING THAT YOU ARE ABOUT TO FALL IN LOVE… {pct}%</p>
        </main>
    );
}
