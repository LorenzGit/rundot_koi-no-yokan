# Koi no Yokan

A quiet dating game for [RUN.world](https://run.world). Nobody speaks on
screen: two thought bubbles, a mood gauge, a tension band, and a hand of moves
decide how the evening goes. Portrait-first, PixiJS 8 (WebGPU with WebGL
fallback) for the date scene, React DOM for everything around it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server (SDK mock, fail-closed monetization) |
| `npm run dev:playground` | Dev against the real RUN host (sign-in; purchases are REAL) |
| `npm run check` | The full gate: format, lint, unit tests, public audit, both builds |
| `npm run build` / `build:bundled` | Production builds (RUN-embedded libraries / standalone) |
| `npm run simulate` | Headless proof of the date simulation (deterministic, seeded) |
| `npm run sweep` | Screenshot sweep across screens and orientations (Playwright) |
| `npm run audit:public` | Hygiene audit required before publishing or distributing |

## Map

- `src/game/` — the date: `dateScene.ts` (Pixi scene), `sim/dateSim.ts`
  (renderer-free, seeded simulation), `data/` (cast, actions, locations,
  monetization), `stage.ts` + `pixiApp.ts` (design-resolution stage and the
  Pixi factory). All renderer creation goes through
  `src/rendering/rendererLifecycle.ts`.
- `src/ui/` — screens. `ui/koi/` is the dating loop (home, plan, book, shop,
  postcard, date HUD, result); `ui/App.tsx` routes phases.
- `src/state/` — the UI-state store and the persistent dating profile.
- `src/systems/` — save, LiveOps runtime services, server time, localization.
- `src/sdk/runSdk.ts` — the RUN SDK facade. Nothing else talks to the SDK.
- `public/images/` — shipped art: cast cutouts, date backdrops, gifts, and
  the painted postcards. `art/` holds the pipeline's working files.
- `rundot/` — deploy-time configs (shop catalog, LiveOps values).
- `docs/` — art pipeline, simulation, monetization, and RUN platform notes.
- `scripts/` — checks, art pipeline tools, and the screenshot sweep.

## Notes

- Player-facing copy never uses em dashes. Keep it that way.
- Monetization surfaces fail closed until the catalog and LiveOps flags are
  live. Do not open them by hand, and never perform a purchase or upload a
  shop/server config without explicit owner approval.
- See `DESIGN.md` for the dating design and `AGENTS.md` for the working rules.
