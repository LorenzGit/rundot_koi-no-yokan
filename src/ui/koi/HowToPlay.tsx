/**
 * How a date works, in one page. Shown automatically the first time a date
 * starts (the veil underneath means it never blocks gameplay), and re-opened
 * any time from Settings. The legend exists because the game speaks in
 * pictograms: charming once you know them, opaque until then.
 */
import { store } from "../../state/store.ts";
import { markTutorialSeen } from "../../state/profile.ts";
import { TOPIC_GLYPH, TOPIC_LABEL, TOPIC_SHORT } from "../../game/data/world.ts";
import type { TopicId } from "../../game/data/types.ts";

const TOPIC_ORDER: TopicId[] = [
    "food",
    "cat",
    "music",
    "art",
    "travel",
    "sport",
    "movie",
    "work",
    "rain",
    "stars",
    "heart",
    "awkward",
];

function close(): void {
    markTutorialSeen();
    store.patch({ howToOpen: false });
}

export default function HowToPlay() {
    return (
        <div className="koi-modal-backdrop koi-howto-backdrop">
            <main className="koi-screen koi-howto" role="dialog" aria-modal="true" aria-labelledby="koi-howto-title">
                <h1 className="koi-title-sm" id="koi-howto-title">
                    How a date works
                </h1>

                <section className="koi-howto-block">
                    <h2 className="koi-section">Read their bubble</h2>
                    <p>
                        Nobody talks here. The bubble over their head is what is on their mind right now: play moves and
                        gifts on that subject for the biggest payoff, up to 4x the sparks.
                    </p>
                </section>

                <section className="koi-howto-block">
                    <h2 className="koi-section">Watch the tension</h2>
                    <p>
                        Keep the marker in the green band. Too cold is boring, too hot is pushy. The mood bar says how
                        the evening feels overall: warm it up, but stay in the band.
                    </p>
                </section>

                <section className="koi-howto-block">
                    <h2 className="koi-section">Trust the read on each card</h2>
                    <p>
                        ▲ means they will like it, ▼ means they will not, = is a shrug. 🎯 means the move lands the
                        tension right in the sweet spot. You see the read before you commit, every time.
                    </p>
                </section>

                <section className="koi-howto-block">
                    <h2 className="koi-section">Grant their wish, once</h2>
                    <p>
                        The gold pill names a gift they would love tonight. Give it once for a guaranteed strong hit.
                        After that the wish is spent, so make it count.
                    </p>
                </section>

                <section className="koi-howto-block">
                    <h2 className="koi-section">Every bubble, translated</h2>
                    <ul className="koi-howto-legend">
                        {TOPIC_ORDER.map((topic) => (
                            <li key={topic}>
                                <span className="koi-howto-glyph" aria-hidden="true">
                                    {TOPIC_GLYPH[topic]}
                                </span>
                                <span>
                                    <strong>{TOPIC_SHORT[topic]}</strong>
                                    <em>{TOPIC_LABEL[topic]}</em>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                <button type="button" className="koi-cta" onClick={close}>
                    Got it
                </button>
                <p className="koi-howto-foot">Re-open this any time from Settings, under How to play.</p>
            </main>
        </div>
    );
}
