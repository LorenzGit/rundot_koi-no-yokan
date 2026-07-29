import { store } from "../state/store.ts";

export type SfxCue = "tap" | "start" | "bounce" | "reward" | "error" | "charm" | "fumble" | "chime";

export interface AudioDebugSnapshot {
    contextState: AudioContextState | "locked";
    musicRunning: boolean;
    musicStep: number;
    scheduledMusicNotes: number;
    activeMusicVoices: number;
    activeSfxVoices: number;
    suppressedSfx: number;
}

/**
 * Koi no Yokan ships with sound effects only. The template's music sequencer
 * has been removed rather than merely muted: a silent bus still scheduled
 * oscillators, and leaving dead code that can be re-enabled by a stale saved
 * setting is how "I do not want music" turns back into music.
 */
class AudioManager {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicBus: GainNode | null = null;
    private sfxBus: GainNode | null = null;
    private musicTimer = 0;
    private musicStep = 0;
    private musicVoices = new Set<OscillatorNode>();
    private sfxVoices = new Set<OscillatorNode>();
    private lastCueAt = new Map<SfxCue, number>();
    private scheduledMusicNotes = 0;
    private suppressedSfx = 0;
    private paused = false;
    private hostPaused = false;
    private adVisible = false;
    private pageHidden = document.visibilityState !== "visible";
    private bound = false;

    bind(): void {
        if (this.bound) return;
        this.bound = true;
        store.subscribe(() => this.sync());
        document.addEventListener("visibilitychange", () => {
            this.pageHidden = document.visibilityState !== "visible";
            this.applyPauseState();
        });
    }

    async unlock(): Promise<boolean> {
        try {
            this.ensureGraph();
            if (!this.context) return false;
            if (this.paused) return false;
            if (this.context.state === "suspended") await this.context.resume();
            this.sync();
            return this.context.state === "running";
        } catch (error) {
            console.warn("[audio] WebAudio unavailable", error);
            return false;
        }
    }

    setPaused(paused: boolean): void {
        this.hostPaused = paused;
        this.applyPauseState();
    }

    /** Ads are not guaranteed to emit host lifecycle events. Keep this
     * interruption separate from persisted player volume/mute settings. */
    setAdVisible(visible: boolean): void {
        this.adVisible = visible;
        this.applyPauseState();
    }

    private applyPauseState(): void {
        this.paused = this.hostPaused || this.pageHidden || this.adVisible;
        if (!this.context) return;
        if (this.paused) {
            this.stopMusic();
            void this.context.suspend().catch(() => undefined);
        } else {
            void this.context
                .resume()
                .then(() => this.sync())
                .catch(() => undefined);
        }
    }

    play(cue: SfxCue): void {
        const state = store.get();
        if (!this.context || !this.sfxBus || this.paused || !state.sfxEnabled || state.sfxVolume <= 0) return;

        const cooldowns: Record<SfxCue, number> = {
            tap: 55,
            start: 180,
            bounce: 90,
            reward: 260,
            error: 220,
            charm: 140,
            fumble: 200,
            chime: 120,
        };
        const realNow = performance.now();
        if (realNow - (this.lastCueAt.get(cue) ?? -Infinity) < cooldowns[cue]) {
            this.suppressedSfx += 1;
            return;
        }
        this.lastCueAt.set(cue, realNow);

        const cues: Record<
            SfxCue,
            {
                frequency: number;
                endFrequency: number;
                duration: number;
                peak: number;
                type: OscillatorType;
            }
        > = {
            tap: { frequency: 440, endFrequency: 493.88, duration: 0.045, peak: 0.2, type: "sine" },
            start: { frequency: 293.66, endFrequency: 440, duration: 0.18, peak: 0.3, type: "triangle" },
            bounce: { frequency: 196, endFrequency: 220, duration: 0.035, peak: 0.16, type: "sine" },
            reward: { frequency: 523.25, endFrequency: 783.99, duration: 0.24, peak: 0.34, type: "triangle" },
            error: { frequency: 146.83, endFrequency: 110, duration: 0.16, peak: 0.26, type: "triangle" },
            // A move that landed: a small rising third, warmer than `tap`.
            // A move landing rises to a high, bright fifth...
            charm: { frequency: 587.33, endFrequency: 880, duration: 0.12, peak: 0.26, type: "sine" },
            // A move that did not: a short fall, softer than `error` so a bad
            // read during a date does not sound like a system failure.
            // ...and a move misfiring falls to a low one, well below it. They
            // were only a third apart before, which reads as "a sound" rather
            // than as good or bad news.
            fumble: { frequency: 174.61, endFrequency: 110, duration: 0.16, peak: 0.24, type: "triangle" },
            // Punctuation for a new bubble or an unlock.
            chime: { frequency: 659.25, endFrequency: 987.77, duration: 0.1, peak: 0.22, type: "sine" },
        };
        const definition = cues[cue];
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        oscillator.type = definition.type;
        oscillator.frequency.setValueAtTime(definition.frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(definition.endFrequency, now + definition.duration);
        envelope.gain.setValueAtTime(0.0001, now);
        envelope.gain.exponentialRampToValueAtTime(definition.peak, now + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + definition.duration);
        oscillator.connect(envelope).connect(this.sfxBus);
        this.trackVoice(oscillator, envelope, this.sfxVoices);
        oscillator.start(now);
        oscillator.stop(now + definition.duration + 0.02);
    }

    debugSnapshot(): AudioDebugSnapshot {
        return {
            contextState: this.context?.state ?? "locked",
            musicRunning: this.musicTimer !== 0,
            musicStep: this.musicStep,
            scheduledMusicNotes: this.scheduledMusicNotes,
            activeMusicVoices: this.musicVoices.size,
            activeSfxVoices: this.sfxVoices.size,
            suppressedSfx: this.suppressedSfx,
        };
    }

    private ensureGraph(): void {
        if (this.context) return;
        const AudioContextCtor = window.AudioContext;
        if (!AudioContextCtor) return;
        this.context = new AudioContextCtor();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -20;
        limiter.knee.value = 18;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.004;
        limiter.release.value = 0.24;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(limiter).connect(this.context.destination);
    }

    private sync(): void {
        if (!this.context || !this.master || !this.musicBus || !this.sfxBus) return;
        const state = store.get();
        const now = this.context.currentTime;
        // This game ships without music, so the music bus stays shut and the
        // sequencer never starts. The engine is left intact rather than ripped
        // out so the template's audio contract still holds.
        this.musicBus.gain.setTargetAtTime(0, now, 0.12);
        this.sfxBus.gain.setTargetAtTime(state.sfxEnabled ? state.sfxVolume : 0, now, 0.03);
        // 0.58 was headroom for a music bed that no longer exists. With cues
        // alone at the template's peaks the loudest sound in the game measured
        // about -35 dB, which is what "I can't hear any of them" sounds like.
        this.master.gain.setTargetAtTime(this.paused ? 0 : 0.9, now, 0.08);
        this.stopMusic();
    }

    private trackVoice(
        oscillator: OscillatorNode,
        envelope: GainNode,
        collection: Set<OscillatorNode>,
        filter?: BiquadFilterNode,
    ): void {
        collection.add(oscillator);
        oscillator.addEventListener(
            "ended",
            () => {
                collection.delete(oscillator);
                oscillator.disconnect();
                filter?.disconnect();
                envelope.disconnect();
            },
            { once: true },
        );
    }

    private stopMusic(): void {
        if (this.musicTimer) window.clearInterval(this.musicTimer);
        this.musicTimer = 0;
        if (!this.context) return;
        const stopAt = this.context.currentTime + 0.08;
        for (const oscillator of this.musicVoices) {
            try {
                oscillator.stop(stopAt);
            } catch {
                /* already stopped */
            }
        }
        this.musicVoices.clear();
    }
}

export const audioManager = new AudioManager();
