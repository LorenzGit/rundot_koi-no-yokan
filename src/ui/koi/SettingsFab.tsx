/**
 * The settings button, on every screen.
 *
 * Rendered once at the app frame rather than added to each screen's header:
 * there are nine screens plus the in-date HUD, three of them have no header at
 * all, and "on any screen" has to include the ones added later.
 *
 * Screens reserve room for it with `--koi-fab-space` so it never lands on a
 * balance or a gauge.
 */
import { store, useStore } from "../../state/store.ts";
import Icon from "./icons.tsx";

export default function SettingsFab() {
    const menuScreen = useStore((s) => s.menuScreen);
    const phase = useStore((s) => s.phase);

    // Not on the settings screen itself, and not over the boot loader.
    if (menuScreen === "settings" || phase === "loading") return null;

    return (
        <button
            type="button"
            className="koi-fab"
            aria-label="Settings"
            title="Settings"
            onClick={() => store.patch({ menuScreen: "settings" })}
        >
            <Icon name="gear" className="koi-fab-icon" />
        </button>
    );
}
