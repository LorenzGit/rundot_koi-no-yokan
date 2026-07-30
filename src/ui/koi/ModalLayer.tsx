import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalLayerProps {
    children: ReactNode;
}

/**
 * Keeps dialogs outside transform-scaled, scrollable screens so they remain
 * centred on the visible playable frame.
 */
export default function ModalLayer({ children }: ModalLayerProps) {
    const host = document.getElementById("app-frame") ?? document.body;
    return createPortal(<div className="koi-modal-backdrop">{children}</div>, host);
}
