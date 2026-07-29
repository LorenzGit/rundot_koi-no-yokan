/**
 * "Are you sure?" for anything that costs hearts.
 *
 * Deliberately generic rather than gift-shop specific — the shop is the only
 * place that spends currency today, but a mis-tap costing 150♡ (a Ring, most
 * of a starting balance) is exactly the kind of thing a player cannot undo,
 * and any future sink should go through the same gate.
 *
 * It renders `position: fixed`, which inside a `.koi-screen` resolves against
 * the screen itself rather than the viewport — a transformed element is the
 * containing block for its fixed descendants — so the dialog inherits the
 * design-resolution scale and does not scroll with the list behind it.
 */
import { useEffect, useRef } from "react";

interface ConfirmSpendProps {
    /** What you are buying, e.g. "Roses". */
    itemName: string;
    /** Optional art for the thing being bought. */
    image?: string;
    price: number;
    balance: number;
    confirmLabel?: string;
    onConfirm(): void;
    onCancel(): void;
}

export default function ConfirmSpend({
    itemName,
    image,
    price,
    balance,
    confirmLabel = "Buy it",
    onConfirm,
    onCancel,
}: ConfirmSpendProps) {
    const confirmRef = useRef<HTMLButtonElement>(null);
    const affordable = balance >= price;

    // Escape cancels, and the confirm button takes focus so the dialog is
    // operable without hunting for it.
    useEffect(() => {
        confirmRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onCancel]);

    return (
        // No click-to-dismiss on the backdrop: it would be a click handler on a
        // static element, which is unreachable by keyboard and is the sort of
        // thing that dismisses a dialog on a mis-tap. Escape and "Not now" are
        // the two ways out, and both work with or without a pointer.
        <div className="koi-modal-backdrop">
            <div className="koi-modal" role="dialog" aria-modal="true" aria-labelledby="koi-modal-title">
                {image && <img className="koi-modal-art" src={image} alt="" />}

                <h2 className="koi-modal-title" id="koi-modal-title">
                    Buy {itemName}?
                </h2>

                <p className="koi-modal-cost">
                    <span className="koi-modal-price">♡ {price}</span>
                    <span className="koi-modal-after">
                        {balance} → {Math.max(0, balance - price)} left
                    </span>
                </p>

                <div className="koi-modal-actions">
                    <button type="button" className="koi-btn" onClick={onCancel}>
                        Not now
                    </button>
                    <button
                        type="button"
                        className="koi-cta"
                        ref={confirmRef}
                        disabled={!affordable}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
