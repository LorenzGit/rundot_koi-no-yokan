/**
 * Real-browser first-play gate.
 *
 * Starts on the zero-save route, proves the date is one tap away, plays a
 * move, completes the just-in-time coach, and retains evidence screenshots.
 * Run against an active dev server:
 *   npm run visual-qa -- /tmp/koi-visual-qa
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUTPUT = process.argv[2] ?? "/tmp/koi-visual-qa";
const BASE = process.env.VISUAL_QA_URL ?? "http://127.0.0.1:5183";

mkdirSync(OUTPUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
// The local SDK mock persists profile data in origin localStorage. This is a
// fresh isolated browser context, so clear that origin before boot to make the
// promised zero-save first-play path deterministic across repeated QA runs.
await context.addInitScript(() => window.localStorage.clear());
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
});

try {
    await page.goto(BASE);
    await page.waitForSelector(".koi-first-date-callout", { timeout: 25_000 });
    if (await page.locator(".koi-howto-backdrop").isVisible()) throw new Error("first play is blocked by the legend");
    await page.screenshot({ path: `${OUTPUT}/01-first-plan.png` });

    const start = page.locator(".koi-cta-sticky");
    if (!(await start.isEnabled())) throw new Error("first date CTA is disabled");
    await start.click();
    try {
        await page.waitForSelector(".koi-live-tutorial", { timeout: 10_000 });
    } catch (error) {
        await page.screenshot({ path: `${OUTPUT}/failure-after-start.png` });
        const appDiagnostic = await page.evaluate(async () => {
            const state = await import("/src/state/store.ts");
            const profile = await import("/src/state/profile.ts");
            return {
                phase: state.store.get().phase,
                koiScreen: state.store.get().koiScreen,
                tutorialStep: profile.getProfile().tutorialStep,
                tutorialSeen: profile.getProfile().tutorialSeen,
                hasCard: Boolean(document.querySelector(".koi-card")),
            };
        });
        const diagnostic = { ...appDiagnostic, consoleErrors, pageErrors };
        throw new Error(`first-date coach missing: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    await page.waitForSelector(".koi-card:not([disabled])", { timeout: 25_000 });
    await page.screenshot({ path: `${OUTPUT}/02-first-date-coach.png` });

    await page.locator(".koi-card:not([disabled])").first().click();
    await page.waitForSelector(".koi-perform");
    await page.waitForFunction(() => {
        const button = document.querySelector(".koi-perform");
        return button instanceof HTMLButtonElement && !button.disabled;
    });
    await page.locator(".koi-perform").click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Got it" }).click();
    if (await page.locator(".koi-live-tutorial").count()) throw new Error("coach did not complete");
    await page.screenshot({ path: `${OUTPUT}/03-coach-complete.png` });

    if (pageErrors.length > 0) throw new Error(`page errors: ${pageErrors.join(" | ")}`);
    console.log(`visual QA clean · ${OUTPUT}`);
} finally {
    await context.close();
    await browser.close();
}
