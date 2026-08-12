/** How the evening went, and what it bought you. */
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics, FIRST_PLAY_FUNNEL } from "../../systems/analytics/analyticsConfig.ts";
import { store, useStore } from "../../state/store.ts";
import { CAST_BY_ID, affectionTier } from "../../game/data/world.ts";
import { bankExtraAffection, markLikePromptSeen, personFor, setPartner } from "../../state/profile.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { AD_PLACEMENTS } from "../../game/data/monetization.ts";
import { isConfiguredPlatformId } from "../../config/platform.ts";
import { exportDateCard, getRunCapabilities, shareDateResult, showLikePrompt } from "../../sdk/runSdk.ts";
import { createDateShareCard, downloadDateShareCard, type DateShareCard } from "../../systems/shareDateCard.ts";
import Icon from "./icons.tsx";
import ShareDateCardDialog, { type DateCardExportState, type DateCardShareState } from "./ShareDateCardDialog.tsx";
import { useProfile } from "./useProfile.ts";

type LikeActionState = "idle" | "opening" | "liked" | "dismissed" | "already_liked" | "unavailable" | "failed";
type PreviewCard = DateShareCard & { previewUrl: string };

function likeActionCopy(state: LikeActionState): { title: string; detail: string } {
    if (state === "opening") return { title: "Opening RUN…", detail: "The platform handles your like." };
    if (state === "liked") return { title: "Liked on RUN", detail: "Thank you for supporting the game." };
    if (state === "already_liked") return { title: "Already liked on RUN", detail: "Your support is already counted." };
    if (state === "dismissed") return { title: "Like prompt closed", detail: "Nothing was changed." };
    if (state === "unavailable") return { title: "Like unavailable", detail: "RUN could not offer it this time." };
    if (state === "failed") return { title: "Could not open like", detail: "Please try after another evening." };
    return { title: "Like Koi no Yokan", detail: "Opens RUN's like dialog once." };
}

export default function ResultScreen() {
    const result = useStore((s) => s.lastResult);
    const profile = useProfile();
    const [doubling, setDoubling] = useState(false);
    const [doubled, setDoubled] = useState(false);
    const [likeState, setLikeState] = useState<LikeActionState>("idle");
    const [shareCard, setShareCard] = useState<PreviewCard | null>(null);
    const [shareCardOpen, setShareCardOpen] = useState(false);
    const [renderingShareCard, setRenderingShareCard] = useState(false);
    const [shareCardFailed, setShareCardFailed] = useState(false);
    const [shareState, setShareState] = useState<DateCardShareState>("idle");
    const [exportState, setExportState] = useState<DateCardExportState>("idle");
    const likeOfferTracked = useRef(false);
    const closeShareCard = useCallback(() => setShareCardOpen(false), []);
    const [offerLikeThisResult] = useState(!profile.likePromptSeen);
    const viewedPersonId = result?.personId;
    const viewedGained = result?.gained;
    const capabilities = getRunCapabilities();
    const showLikeAction = Boolean(result && result.gained > 0 && offerLikeThisResult && capabilities.engagement);
    // In an effect, not the render body: a funnel step must mean "the player
    // reached this screen", not "React re-rendered it".
    useEffect(() => {
        if (!viewedPersonId) return;
        analytics.funnelStep(FIRST_PLAY_FUNNEL, 6, { person_id: viewedPersonId, gained: viewedGained ?? 0 });
    }, [viewedGained, viewedPersonId]);
    useEffect(() => {
        if (!showLikeAction || likeOfferTracked.current) return;
        likeOfferTracked.current = true;
        // Persist when the contextual ask is displayed, not only when it is
        // tapped, so ignoring it does not make it follow the player forever.
        markLikePromptSeen();
        analytics.event("like_prompt_offered", { person_id: viewedPersonId ?? "unknown" });
    }, [showLikeAction, viewedPersonId]);
    useEffect(() => {
        return () => {
            if (shareCard) URL.revokeObjectURL(shareCard.previewUrl);
        };
    }, [shareCard]);
    if (!result) return null;
    const def = CAST_BY_ID[result.personId];
    const person = personFor(result.personId);
    const likeCopy = likeActionCopy(likeState);

    /**
     * Opt-in, and it pays in the currency the screen is already about. Offered
     * only when the evening actually earned something: an ad to double nothing
     * is a con.
     */
    const canDouble = !doubled && result.gained > 0 && isConfiguredPlatformId(AD_PLACEMENTS.doubleHearts);

    const doubleUp = async () => {
        setDoubling(true);
        const outcome = await runtimeServices.watchResultsAd();
        setDoubling(false);
        if (outcome !== "verified") {
            store.patch({ toast: outcome === "cancelled" ? "No reward for a skipped ad." : "No ad available." });
            return;
        }
        bankExtraAffection(result.personId, result.gained);
        analytics.event("reward_granted", {
            reward_type: "double_date_affection",
            amount: result.gained,
            placement_id: AD_PLACEMENTS.doubleHearts,
        });
        setDoubled(true);
        store.patch({ toast: `+${result.gained}♥ more with ${def?.name ?? "them"}.` });
    };

    const askForLike = async () => {
        if (likeState !== "idle") return;
        setLikeState("opening");
        const outcome = await showLikePrompt();
        setLikeState(outcome);
        analytics.event("like_prompt_result", { outcome, person_id: result.personId });
        if (outcome === "liked" || outcome === "dismissed" || outcome === "already_liked") {
            markLikePromptSeen();
        }
    };

    const openShareCard = async () => {
        setShareCardOpen(true);
        setShareState("idle");
        setExportState("idle");
        if (shareCard || renderingShareCard) return;
        setRenderingShareCard(true);
        setShareCardFailed(false);
        try {
            const card = await createDateShareCard({
                personId: result.personId,
                personName: def?.name ?? result.personId,
                personColor: def?.color ?? "#a687ff",
                spark: result.spark,
                affectionGained: result.gained,
                totalAffection: person.affection,
                affectionTier: affectionTier(person.affection),
                romanceScore: result.romanceScore,
                confessed: result.confessed,
                accepted: result.accepted,
            });
            setShareCard({ ...card, previewUrl: URL.createObjectURL(card.blob) });
            analytics.event("result_share_card_created", {
                person_id: result.personId,
                spark: result.spark,
                romance_score: result.romanceScore,
            });
        } catch (error) {
            console.warn("[result] share card failed", error);
            setShareCardFailed(true);
        } finally {
            setRenderingShareCard(false);
        }
    };

    const shareResult = async () => {
        if (!shareCard || shareState === "sharing") return;
        setExportState("idle");
        setShareState("sharing");
        const outcome = await shareDateResult({
            personId: result.personId,
            personName: def?.name ?? result.personId,
            affection: person.affection,
            spark: result.spark,
            romanceScore: result.romanceScore,
            card: shareCard.blob,
            filename: shareCard.filename,
            caption: shareCard.caption,
        });
        setShareState(outcome);
        analytics.event("result_shared", { outcome, person_id: result.personId, spark: result.spark });
    };

    const exportShareCard = async () => {
        if (!shareCard || exportState === "opening") return;
        setShareState("idle");
        setExportState("opening");
        const outcome = await exportDateCard({
            card: shareCard.blob,
            filename: shareCard.filename,
            title: `My date with ${def?.name ?? result.personId} in Koi no Yokan`,
            text: shareCard.caption,
        });
        if (outcome === "browser_download") downloadDateShareCard(shareCard);
        setExportState(outcome);
        analytics.event("result_share_card_exported", {
            outcome,
            person_id: result.personId,
            spark: result.spark,
        });
    };

    return (
        <main className="koi-screen koi-result" style={{ "--koi-char": def?.color } as React.CSSProperties}>
            <img className="koi-result-portrait" src={`images/cast/${result.personId}_figure.png`} alt="" />
            <h1 className="koi-title-sm">{def?.name}</h1>

            {result.confessed && (
                <p className={`koi-verdict ${result.accepted ? "is-good" : "is-bad"}`}>
                    {result.accepted ? "They said yes." : "They weren't ready."}
                </p>
            )}

            <dl className="koi-result-stats">
                <div>
                    <dt>Spark</dt>
                    <dd>{Math.round(result.spark)}</dd>
                </div>
                <div>
                    <dt>Affection</dt>
                    <dd>+{result.gained}</dd>
                </div>
                <div>
                    <dt>Now</dt>
                    <dd>
                        {person.affection}♥ {affectionTier(person.affection)}
                    </dd>
                </div>
            </dl>

            <div className="koi-result-score" aria-live="polite">
                <span>Romance score</span>
                <strong>{result.romanceScore.toLocaleString()}</strong>
                <em>
                    {result.leaderboardPending
                        ? "Saving rank…"
                        : result.leaderboardAccepted && result.leaderboardRank
                          ? `Rank #${result.leaderboardRank}`
                          : result.leaderboardAccepted
                            ? "Score submitted"
                            : "Personal score"}
                </em>
            </div>

            {canDouble && (
                <button type="button" className="koi-store-ad" disabled={doubling} onClick={() => void doubleUp()}>
                    <span aria-hidden="true">🎬</span>
                    <span className="koi-store-ad-body">
                        <strong>Double tonight to +{result.gained * 2}♥</strong>
                        <span>Watch a short ad.</span>
                    </span>
                </button>
            )}

            <meter
                className="koi-meter koi-meter-lg"
                min={0}
                max={100}
                value={person.affection}
                aria-label={`Affection with ${def?.name ?? result.personId}`}
            />

            <div className="koi-result-actions">
                <button
                    type="button"
                    className="koi-btn koi-result-action"
                    data-testid="result-share-card"
                    disabled={renderingShareCard}
                    onClick={() => void openShareCard()}
                >
                    <Icon name="share" className="koi-result-action-icon" />
                    <strong className="koi-result-action-title">
                        {renderingShareCard ? "Creating card…" : shareCard ? "View share card" : "Create share card"}
                    </strong>
                    <span className="koi-result-action-detail">Preview, share, or export a social PNG.</span>
                </button>
                {showLikeAction && (
                    <button
                        type="button"
                        className={`koi-btn koi-result-action ${likeState !== "idle" && likeState !== "opening" ? "is-complete" : ""}`}
                        data-testid="result-like"
                        disabled={likeState !== "idle"}
                        onClick={() => void askForLike()}
                    >
                        <Icon name="heart" className="koi-result-action-icon" />
                        <strong className="koi-result-action-title">{likeCopy.title}</strong>
                        <span className="koi-result-action-detail">{likeCopy.detail}</span>
                    </button>
                )}
            </div>

            {result.accepted && !person.partner && (
                <button
                    type="button"
                    className="koi-cta"
                    onClick={() => {
                        // This game's headline progression beat — worth its own row rather than
                        // being inferred from an affection threshold after the fact. Emitted here
                        // rather than inside setPartner(): state/profile.ts must not import the
                        // analytics config, which imports profile back.
                        analytics.event("milestone_reached", {
                            milestone: "partner_chosen",
                            value: 1,
                            person_id: result.personId,
                        });
                        const { jealous } = setPartner(result.personId);
                        store.patch({
                            koiScreen: "home",
                            toast: jealous.length ? "Word travels fast." : `${def?.name} is yours.`,
                        });
                    }}
                >
                    Make it official
                </button>
            )}

            <div className="koi-result-nav">
                <button type="button" className="koi-btn" onClick={() => store.patch({ koiScreen: "home" })}>
                    Home
                </button>
                <button
                    type="button"
                    className="koi-btn koi-btn-quiet"
                    onClick={() => store.patch({ koiScreen: "plan" })}
                >
                    Another date
                </button>
            </div>

            {shareCardOpen && (
                <ShareDateCardDialog
                    card={shareCard}
                    previewUrl={shareCard?.previewUrl ?? null}
                    rendering={renderingShareCard}
                    renderFailed={shareCardFailed}
                    shareState={shareState}
                    exportState={exportState}
                    onShare={() => void shareResult()}
                    onExport={() => void exportShareCard()}
                    onClose={closeShareCard}
                />
            )}
        </main>
    );
}
