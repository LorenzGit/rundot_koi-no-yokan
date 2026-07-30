/**
 * Capture every screen in BOTH orientations, and report anything that overflows
 * its viewport.
 *
 * Written because reviewing portrait and fixing only portrait is how landscape
 * kept breaking: each layout fix to one orientation is a change to a shared
 * stylesheet, and the grid placements differ. Run this after any UI change.
 *
 *   node scripts/screen-sweep.mjs [outDir]
 *
 * Uses Playwright rather than ViewDeck because the date screen renders through
 * the Pixi ticker, which ViewDeck's capture surface does not run.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "/tmp/koi-sweep";
const BASE = process.env.SWEEP_URL ?? "http://127.0.0.1:5183";

const PORTRAIT = { width: 393, height: 852 };
const LANDSCAPE = { width: 852, height: 393 };
/** A small phone. Layout bugs that need tight space hide on a 16 Pro. */
const PORTRAIT_SHORT = { width: 375, height: 667 };
const LANDSCAPE_SHORT = { width: 667, height: 375 };

async function openPostcard(page) {
    await page.click(".koi-hero-cta");
    await page.evaluate(async () => {
        const profile = await import("/src/state/profile.ts");
        profile.recordDate("char_f_tsundere", 60, 180, ["art"]);
        const state = await import("/src/state/store.ts");
        state.store.patch({ koiScreen: "postcard" });
    });
}

/** Each screen, and how to get there from a booted game. */
const SCREENS = [
    { name: "avatar-first", setup: async () => {}, wait: ".koi-hero-card" },
    {
        name: "avatar-return",
        wait: ".koi-hero-card",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.waitForSelector(".koi-home");
            await page.click(".koi-plate-you");
        },
    },
    {
        name: "home-empty",
        wait: ".koi-home",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
        },
    },
    {
        name: "home-partner",
        wait: ".koi-plate-them",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/profile.ts");
                m.recordDate("char_f_siren", 94, 210, ["night"]);
                m.setPartner("char_f_siren");
            });
        },
    },
    {
        name: "plan",
        wait: ".koi-brief",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ koiScreen: "plan" });
            });
            await page.waitForSelector(".koi-pick");
            await page.click(".koi-pick");
        },
    },
    {
        name: "book-empty",
        wait: ".koi-empty-state",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ koiScreen: "book" });
            });
        },
    },
    {
        name: "book-full",
        wait: ".koi-book-row",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const p = await import("/src/state/profile.ts");
                p.recordDate("char_f_siren", 60, 180, ["night", "music"]);
                p.recordDate("char_m_senpai", 30, 90, ["art"]);
                const m = await import("/src/state/store.ts");
                m.store.patch({ koiScreen: "book" });
            });
        },
    },
    {
        name: "shop",
        wait: ".koi-gift",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ koiScreen: "shop" });
            });
        },
    },
    {
        name: "shop-confirm",
        wait: ".koi-modal",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ koiScreen: "shop" });
            });
            await page.waitForSelector(".koi-gift .koi-btn-sm");
            await page.click(".koi-gift .koi-btn-sm:not([disabled])");
        },
    },
    {
        name: "postcard",
        wait: ".koi-postcard-send",
        setup: openPostcard,
    },
    {
        name: "postcard-confirm-scrolled",
        wait: ".koi-modal",
        setup: async (page) => {
            await openPostcard(page);
            await page.waitForSelector(".koi-postcard-send:not([disabled])");
            await page.evaluate(() => {
                const screen = document.querySelector(".koi-postcard");
                if (screen) screen.scrollTop = screen.scrollHeight;
            });
            await page.click(".koi-postcard-send:not([disabled])");
        },
    },
    {
        name: "settings",
        wait: ".koi-set-group",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ menuScreen: "settings" });
            });
        },
    },
    {
        name: "result",
        wait: ".koi-result",
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const p = await import("/src/state/profile.ts");
                p.recordDate("char_f_siren", 22, 140, ["night"]);
                const m = await import("/src/state/store.ts");
                m.store.patch({
                    koiScreen: "result",
                    lastResult: { personId: "char_f_siren", gained: 22, spark: 140, confessed: false, accepted: false },
                });
            });
        },
    },
    {
        name: "date",
        wait: ".koi-card",
        delay: 2500,
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ phase: "playing", dateWith: "char_f_siren", dateAt: "sakura", selectedGift: null });
            });
        },
    },
    {
        name: "date-perform",
        wait: ".koi-perform",
        delay: 300,
        setup: async (page) => {
            await page.click(".koi-hero-cta");
            await page.evaluate(async () => {
                const m = await import("/src/state/store.ts");
                m.store.patch({ phase: "playing", dateWith: "char_f_siren", dateAt: "sakura", selectedGift: null });
            });
            await page.waitForSelector(".koi-card", { timeout: 20_000 });
            await page.waitForTimeout(2200);
            await page.click(".koi-card:not([disabled])");
        },
    },
];

/** Anything sticking out of the frame, or a control that cannot be reached. */
async function audit(page) {
    return page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const problems = [];
        for (const el of document.querySelectorAll("#app-frame *")) {
            if (el.getAttribute("aria-hidden") === "true") continue;
            if (el.closest("[aria-hidden='true']")) continue;
            const style = getComputedStyle(el);
            if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) continue;
            const tag = `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`;
            const interactive = ["BUTTON", "INPUT", "SELECT", "A"].includes(el.tagName);

            // Content inside a scroller is reachable, so it is not a defect.
            // Without this the sweep flags every card in a horizontal strip and
            // the real problems drown in false positives.
            let scrollable = false;
            for (let p = el.parentElement; p && p.id !== "app-frame"; p = p.parentElement) {
                const ps = getComputedStyle(p);
                if (/(auto|scroll)/.test(ps.overflowX + ps.overflowY)) {
                    scrollable = true;
                    break;
                }
            }
            // NOTE: `scrollable` gates the offscreen check only. A control
            // whose own content is clipped is a defect wherever it lives — the
            // squashed pick cards sat inside a horizontal strip, which
            // `overflow-x: auto` also makes a vertical scroller, so skipping
            // scrollers entirely made this check blind to the exact bug it was
            // written for.
            if (!scrollable && (r.bottom > vh + 1 || r.right > vw + 1 || r.top < -1 || r.left < -1)) {
                problems.push({
                    tag,
                    interactive,
                    kind: "offscreen",
                    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
                });
            }

            // Squashed: the box is rendered far shorter than its own content
            // and cannot scroll, so the content is simply lost. This is what a
            // strip does when it is allowed to flex-shrink inside a column, and
            // an offscreen-only audit never sees it.
            //
            // Compared against clientHeight, NOT the bounding rect: the rect is
            // post-transform and scrollHeight is not, so anything carrying a
            // scale() reads as squashed by exactly its scale factor. Replaced
            // elements are skipped outright because scrollHeight is meaningless
            // for them.
            const canScroll = /(auto|scroll)/.test(style.overflowY);
            const replaced = ["IMG", "CANVAS", "VIDEO", "SVG", "SELECT", "INPUT"].includes(el.tagName);
            const clipped = el.scrollHeight > el.clientHeight + 4;
            if (!replaced && clipped && (interactive || !canScroll)) {
                problems.push({
                    tag,
                    interactive,
                    kind: "squashed",
                    rect: [el.clientHeight, el.scrollHeight],
                });
            }
        }
        return { vw, vh, problems: problems.slice(0, 12) };
    });
}

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
let failures = 0;

for (const orientation of [
    { label: "portrait", viewport: PORTRAIT },
    { label: "landscape", viewport: LANDSCAPE },
    { label: "portrait-sm", viewport: PORTRAIT_SHORT },
    { label: "landscape-sm", viewport: LANDSCAPE_SHORT },
]) {
    for (const screen of SCREENS) {
        const context = await browser.newContext({ viewport: orientation.viewport });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e)));
        try {
            await page.goto(BASE);
            await page.waitForSelector(".koi-hero-cta", { timeout: 25_000 });
            await screen.setup(page);
            await page.waitForSelector(screen.wait, { timeout: 20_000 });
            await page.waitForTimeout(screen.delay ?? 500);
            const report = await audit(page);
            await page.screenshot({ path: `${OUT}/${screen.name}-${orientation.label}.png` });
            const offscreen = report.problems.filter((p) => p.interactive && p.kind === "offscreen");
            const squashed = report.problems.filter((p) => p.kind === "squashed");
            const status = errors.length || offscreen.length || squashed.length ? "FAIL" : "ok";
            if (status === "FAIL") failures += 1;
            const detail = [...offscreen, ...squashed].map((p) => `${p.kind}:${p.tag}`).join(" ");
            console.log(
                `${status.padEnd(4)} ${screen.name.padEnd(15)} ${orientation.label.padEnd(13)} ` +
                    `errors=${errors.length} offscreen=${offscreen.length} squashed=${squashed.length}` +
                    (detail ? ` ${detail}` : ""),
            );
        } catch (error) {
            failures += 1;
            console.log(`FAIL ${screen.name.padEnd(15)} ${orientation.label.padEnd(9)} ${String(error).slice(0, 90)}`);
        }
        await context.close();
    }
}

await browser.close();
console.log(failures === 0 ? "\nsweep clean" : `\n${failures} screen/orientation combinations need attention`);
process.exit(failures === 0 ? 0 : 1);
