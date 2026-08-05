/** How the evening went, and what it bought you. */
import { useEffect, useState } from "react";
import { analytics, FIRST_PLAY_FUNNEL } from "../../systems/analytics/analyticsConfig.ts";
import { store, useStore } from "../../state/store.ts";
import { CAST_BY_ID, affectionTier } from "../../game/data/world.ts";
import { bankExtraAffection, personFor, setPartner } from "../../state/profile.ts";
import { runtimeServices } from "../../systems/runtimeServices.ts";
import { AD_PLACEMENTS } from "../../game/data/monetization.ts";
import { isConfiguredPlatformId } from "../../config/platform.ts";

export default function ResultScreen() {
    const result = useStore((s) => s.lastResult);
    const [doubling, setDoubling] = useState(false);
    const [doubled, setDoubled] = useState(false);
    // In an effect, not the render body: a funnel step must mean "the player
    // reached this screen", not "React re-rendered it".
    useEffect(() => {
        if (!result) return;
        analytics.funnelStep(FIRST_PLAY_FUNNEL, 6, { person_id: result.personId, gained: result.gained });
    }, [result]);
    if (!result) return null;
    const def = CAST_BY_ID[result.personId];
    const person = personFor(result.personId);

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
        setDoubled(true);
        store.patch({ toast: `+${result.gained}♥ more with ${def?.name ?? "them"}.` });
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

            <button type="button" className="koi-btn" onClick={() => store.patch({ koiScreen: "home" })}>
                Home
            </button>
            <button type="button" className="koi-btn koi-btn-quiet" onClick={() => store.patch({ koiScreen: "plan" })}>
                Another date
            </button>
        </main>
    );
}
