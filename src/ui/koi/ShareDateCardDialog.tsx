import { useEffect, useRef } from "react";
import type { DateCardExportResult } from "../../sdk/runSdk.ts";
import type { DateShareCard } from "../../systems/shareDateCard.ts";
import ModalLayer from "./ModalLayer.tsx";

export type DateCardShareState = "idle" | "sharing" | "shared" | "dismissed" | "unavailable" | "failed";
export type DateCardExportState = "idle" | "opening" | DateCardExportResult;

interface ShareDateCardDialogProps {
    card: DateShareCard | null;
    previewUrl: string | null;
    rendering: boolean;
    renderFailed: boolean;
    shareState: DateCardShareState;
    exportState: DateCardExportState;
    onShare(): void;
    onExport(): void;
    onClose(): void;
}

function cardStatus(shareState: DateCardShareState, exportState: DateCardExportState): string {
    if (exportState === "opening") return "Opening your device's file options…";
    if (exportState === "native_opened") return "System sheet opened. Choose Save Image or Save to Files.";
    if (exportState === "browser_download") return "Download started. Check your browser's Downloads.";
    if (exportState === "cancelled") return "Nothing was saved. Your card is still here.";
    if (exportState === "failed") return "Export could not open. Try Share to social instead.";
    if (shareState === "shared") return "Share sheet opened with your card and a tracked game link.";
    if (shareState === "dismissed") return "Nothing was posted. Your card is still here.";
    if (shareState === "unavailable") return "Social sharing is unavailable here. You can still export the PNG.";
    if (shareState === "failed") return "Sharing could not open. You can still export the PNG.";
    return "Choose where to post it, or export the PNG.";
}

function exportButtonCopy(state: DateCardExportState): string {
    if (state === "opening") return "Opening…";
    if (state === "native_opened") return "Export again";
    if (state === "browser_download") return "Download again";
    return "Export PNG";
}

export default function ShareDateCardDialog({
    card,
    previewUrl,
    rendering,
    renderFailed,
    shareState,
    exportState,
    onShare,
    onExport,
    onClose,
}: ShareDateCardDialogProps) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && shareState !== "sharing" && exportState !== "opening") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [exportState, onClose, shareState]);

    return (
        <ModalLayer>
            <div
                className="koi-share-modal"
                data-testid="share-card-dialog"
                data-share-state={shareState}
                data-export-state={exportState}
                role="dialog"
                aria-modal="true"
                aria-labelledby="koi-share-card-title"
                aria-busy={rendering || shareState === "sharing" || exportState === "opening"}
            >
                <div className="koi-share-preview">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Your Koi no Yokan date result card" />
                    ) : (
                        <div className="koi-share-preview-loading" role="status">
                            {renderFailed ? "Card unavailable" : "Painting your card…"}
                        </div>
                    )}
                </div>

                <div className="koi-share-copy">
                    <p className="koi-share-kicker">Social card</p>
                    <h2 id="koi-share-card-title">Your date, ready to share</h2>
                    <p>Share adds this PNG and a game link. Export lets you choose where the image goes.</p>

                    {!renderFailed && (
                        <p className="koi-share-status" aria-live="polite">
                            {rendering ? "Creating a 1080 × 1350 PNG…" : cardStatus(shareState, exportState)}
                        </p>
                    )}
                    {renderFailed && <p className="koi-share-status is-error">The card could not be created.</p>}

                    <div className="koi-share-actions">
                        <button
                            type="button"
                            className="koi-cta"
                            disabled={!card || shareState === "sharing" || exportState === "opening"}
                            onClick={onShare}
                        >
                            {shareState === "sharing"
                                ? "Opening…"
                                : shareState === "shared"
                                  ? "Share again"
                                  : "Share to social"}
                        </button>
                        <button
                            type="button"
                            className="koi-btn"
                            data-testid="export-date-card"
                            disabled={!card || shareState === "sharing" || exportState === "opening"}
                            onClick={onExport}
                        >
                            {exportButtonCopy(exportState)}
                        </button>
                    </div>

                    <button
                        type="button"
                        className="koi-btn koi-share-close"
                        ref={closeRef}
                        disabled={shareState === "sharing" || exportState === "opening"}
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            </div>
        </ModalLayer>
    );
}
