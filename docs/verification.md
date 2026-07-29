# Verification workflow

Use the smallest check that can reliably detect the failure introduced by a
change, then retain the broader release gates. Report what changed, what was
run, which viewports or host conditions were exercised, and what remains
unverified.

| Change | Minimum reliable check |
| --- | --- |
| Copy, spacing, color, or one-screen layout | Real browser inspection at each affected viewport |
| Pure rules, math, parsing, validation, or deterministic state | Focused unit or simulation test |
| Persistence, timers, queues, lifecycle, or shared state | State integration test with failure and reload paths |
| Navigation, scrolling, onboarding, rotation, or cross-screen behavior | Browser-driven run (`npm run sweep` captures every screen) |
| RUN SDK, ads, purchases, storage, notifications, or profiles | Browser-driven run plus RUN Playground or production-host verification |
| Renderer, build, or dependency change | Full checks and both production builds |
| Release or public repository preparation | Full checks, public audit, readiness review, and final visual evidence |

## Local visual review

Development-only screen deep links avoid repetitive navigation:

```text
?screen=avatar
?screen=home
?screen=plan
?screen=book
?screen=shop
?screen=postcard
?screen=result
?screen=settings
?screen=game
```

Add `debug=1` to display FPS, renderer, viewport, DPR, orientation, current
route, safe-area values, and session-only quality, reduced-motion, and simulated
safe-area controls. These tools exist only in development builds.

## Screen sweep

```bash
npm run sweep
```

Drives the game through its screens at representative portrait and landscape
viewports and saves a screenshot set for review. Install the local Chromium
binary once with `npx playwright install chromium`.

Browser runs never prove a real ad, purchase, entitlement, notification,
profile, or host capability. Verify those separately through the opt-in RUN
Playground and the final RUN host, without fabricating successful outcomes.

## Public repository audit

```bash
npm run audit:public
```

The zero-dependency audit checks required community/license files, accidental
secrets, credentials, player snapshots, campaign state, and OS metadata before
the repository is published or redistributed. It reads tracked files through
git, so run it after the changes meant to ship are committed.

## Full gate

```bash
npm run check
```

Format, lint, the unit tests (noise vectors, figure pipeline, the seeded date
simulation), the public audit, and both production builds. This is the release
gate: all of it passes, or the release does not happen.
