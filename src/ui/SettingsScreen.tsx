/**
 * Settings, dressed as part of the game rather than as the template.
 *
 * The behaviour is untouched — same store patches, same RUN notification
 * handshake, same locale and quality wiring. Only the presentation moved: it
 * now sits on the sakura backdrop with the rest of the meta screens, and the
 * controls are drawn in the player's own accent colour.
 */
import { useState } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { setNotificationPreference } from "../sdk/runSdk.ts";
import { LOCALES, selectLocale, t } from "../systems/localization.ts";
import { saveSystem } from "../systems/save.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore, type AppState } from "../state/store.ts";
import PetalFall from "./koi/PetalFall.tsx";

/** Cue handling lives in useButtonFeedback now, so this only persists. */
function persist(patch: Partial<AppState>): void {
    store.patch(patch);
    void saveSystem.flush();
}

/** A row with a label on the left and whatever control on the right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="koi-set-row">
            <span className="koi-set-label">{label}</span>
            <div className="koi-set-control">{children}</div>
        </div>
    );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
    return (
        <input
            className="koi-switch"
            type="checkbox"
            aria-label={label}
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
        />
    );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange(value: number): void }) {
    return (
        <input
            className="koi-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label={label}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
        />
    );
}

export default function SettingsScreen() {
    const state = useStore((value) => value);
    const [notificationBusy, setNotificationBusy] = useState(false);

    const notificationToggle = async (enabled: boolean) => {
        await audioManager.unlock();
        setNotificationBusy(true);
        const result = await setNotificationPreference(enabled);
        setNotificationBusy(false);
        if (result === "enabled") {
            persist({ notificationsEnabled: true, notificationsConsent: "granted" });
            runtimeServices.rearmNotifications();
        } else if (result === "disabled") persist({ notificationsEnabled: false, notificationsConsent: "denied" });
        else {
            audioManager.play("error");
            store.patch({ toast: result === "unavailable" ? t("SettingsUnavailable") : "Notification request failed" });
        }
    };

    const setLocale = (locale: string) => {
        selectLocale(locale);
    };

    const testHaptic = async () => {
        await audioManager.unlock();
        audioManager.play("reward");
        const sent = await runtimeServices.haptic("success");
        store.patch({ toast: sent ? "Felt that?" : "Haptics need a supported device" });
    };

    return (
        <main className="koi-screen koi-settings">
            <div className="koi-menu-bg" aria-hidden="true" />
            <PetalFall />

            <header className="koi-header">
                <button type="button" className="koi-back" onClick={() => store.patch({ menuScreen: "main" })}>
                    ‹ Back
                </button>
                <h1 className="koi-title-sm">{t("MenuSettings")}</h1>
            </header>

            <div className="koi-set-scroll">
                <section className="koi-set-group">
                    {/* One bed, one set of cues: a toggle and a level each. */}
                    <h2 className="koi-section">Sound</h2>
                    <Row label={t("SettingsMusic")}>
                        <Switch
                            label={t("SettingsMusic")}
                            checked={state.musicEnabled}
                            onChange={(value) => persist({ musicEnabled: value })}
                        />
                    </Row>
                    <Row label={t("SettingsMusicVolume")}>
                        <Slider
                            label={t("SettingsMusicVolume")}
                            value={state.musicVolume}
                            onChange={(value) => persist({ musicVolume: value })}
                        />
                    </Row>
                    <Row label={t("SettingsSfx")}>
                        <Switch
                            label={t("SettingsSfx")}
                            checked={state.sfxEnabled}
                            onChange={(value) => persist({ sfxEnabled: value })}
                        />
                    </Row>
                    <Row label={t("SettingsSfxVolume")}>
                        <Slider
                            label={t("SettingsSfxVolume")}
                            value={state.sfxVolume}
                            onChange={(value) => persist({ sfxVolume: value })}
                        />
                    </Row>
                </section>

                <section className="koi-set-group">
                    <h2 className="koi-section">Comfort</h2>
                    <Row label={t("SettingsHaptics")}>
                        <Switch
                            label={t("SettingsHaptics")}
                            checked={state.hapticsEnabled}
                            onChange={(value) => persist({ hapticsEnabled: value })}
                        />
                        <button
                            type="button"
                            className="koi-btn koi-btn-sm"
                            disabled={!state.hapticsEnabled}
                            onClick={() => void testHaptic()}
                        >
                            Test
                        </button>
                    </Row>
                    <Row label={t("SettingsReducedMotion")}>
                        <Switch
                            label={t("SettingsReducedMotion")}
                            checked={state.reducedMotion}
                            onChange={(value) => {
                                document.documentElement.dataset.reducedMotion = String(value);
                                persist({ reducedMotion: value });
                            }}
                        />
                    </Row>
                    <Row label={t("SettingsNotifications")}>
                        <button
                            type="button"
                            className="koi-btn koi-btn-sm"
                            disabled={notificationBusy}
                            onClick={() => void notificationToggle(!state.notificationsEnabled)}
                        >
                            {notificationBusy
                                ? "…"
                                : state.notificationsEnabled
                                  ? "On"
                                  : state.notificationsConsent === "denied"
                                    ? "Off"
                                    : "Ask"}
                        </button>
                    </Row>
                </section>

                <section className="koi-set-group">
                    <h2 className="koi-section">Game</h2>
                    <Row label={t("SettingsLanguage")}>
                        <select
                            className="koi-select"
                            aria-label={t("SettingsLanguage")}
                            value={state.locale}
                            onChange={(event) => setLocale(event.target.value)}
                        >
                            {LOCALES.map((locale) => (
                                <option key={locale.id} value={locale.id}>
                                    {locale.label}
                                </option>
                            ))}
                        </select>
                    </Row>
                    <Row label={t("SettingsQuality")}>
                        <div className="koi-segmented">
                            <button
                                type="button"
                                className={state.quality === "low" ? "is-active" : ""}
                                onClick={() => persist({ quality: "low" })}
                            >
                                {t("SettingsLow")}
                            </button>
                            <button
                                type="button"
                                className={state.quality === "high" ? "is-active" : ""}
                                onClick={() => persist({ quality: "high" })}
                            >
                                {t("SettingsHigh")}
                            </button>
                        </div>
                    </Row>
                </section>

                <p className="koi-set-note">
                    Notifications only change once the RUN host confirms. If nothing happens here, it said no.
                </p>
            </div>
        </main>
    );
}
