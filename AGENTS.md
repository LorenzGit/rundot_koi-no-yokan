# Koi no Yokan — working rules

A quiet dating game for RUN.world: portrait-first, PixiJS 8 WebGPU-first for
the date scene, React DOM for every screen around it. The feeling that you are
about to fall in love, measured in gauges and thought bubbles.

## Renderer

All renderer creation and destruction goes through the realm-wide manager in
`src/rendering/rendererLifecycle.ts`. It serializes initialization, fallback,
cancellation cleanup, and teardown so React StrictMode, route changes, HMR, and
ViewDeck lifecycle events cannot overlap runtimes. The game owns exactly one
Pixi application; never create another renderer owner or call
`Application.destroy()` outside that manager. Forced `?renderer=webgpu` QA is
strict, and unexpected rendering errors or device loss are failures.

Scene code works in design units on the orientation-adaptive stage in
`src/game/stage.ts`: portrait fixes the design width, landscape the design
height. Re-read `designWidth()/designHeight()` inside resize handlers; never
hardcode the current long edge.

## Randomness

Use the `NoiseRandom` class in `src/game/noiseRandom.ts` for ordinary random
numbers in game logic and procedural generation; never add `Math.random()` to
game source. Inject and persist its unsigned seed and position when a sequence
must replay or resume, and use stable salts for independent decisions. The
exception is cryptographic/security identifiers, which use Web Crypto. Read
`docs/randomness.md` before adding game randomness.

## Monetization

The game sells through RUN Shop + Entitlements, priced in **RB (Run Bits)**,
with player-facing ad placements alongside. The catalog lives in
`rundot/shop.config.json`; player copy says "Run Bits" or "RB". Every surface
fetches the catalog, displays the resolved RB price, opens `shop.purchase()`
only after direct player action, and reconciles orders and entitlements.

Everything fails closed: while ids or LiveOps flags are not live, surfaces hide
or disable rather than offering a charge that cannot complete. Never open them
by hand, and never perform a purchase or upload a shop/server config without
explicit owner approval. The RUN Playground (`npm run dev:playground`,
opt-in only) is the sanctioned host test path, and purchases made there are
REAL and persistent.

## Lifecycle and services

Keep lifecycle, safe-area, accessibility, persistence, capability-gated RUN
integration, authoritative outcomes, and cleanup generic; do not duplicate
those services per screen. `src/sdk/runSdk.ts` is the only SDK touch point.

## Player-facing text

Never use em dashes in player-facing copy. Icons are drawn SVG
(`src/ui/koi/icons.tsx`), never emoji, so they inherit button state and colour.

## Verification

Run `npm run check` before any deploy or completion claim: format, lint, the
unit tests (noise vectors, figure pipeline, the seeded date simulation),
`scripts/audit-public.mjs`, and both production builds. `npm run simulate` is
the deterministic gameplay proof; `npm run sweep` captures the screen sweep.
Install the local Chromium binary once with `npx playwright install chromium`.
`?screen=<id>` deep-links a screen in dev for visual review and `?debug=1`
opens the development diagnostics; both must never fabricate a successful RUN
ad, purchase, entitlement, notification, profile, or privileged outcome.

## One version

`package.json` is the single version number: the menu renders it and every analytics
event is tagged with it as `build_version`. Once published it must equal the version
RUN serves on the Public tag — never pin it to a separate development track.
`rundot deploy --bump <Major|Minor|Patch>` decides the number; set `package.json` and
`package-lock.json` to it in the same commit as the ship, then verify with
`npm run version:check` (unpublished games pass; needs network, so it sits outside
`npm run check`).
