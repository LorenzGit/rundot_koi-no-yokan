# KOI NO YOKAN — design canon

*Koi no yokan (恋の予感): the feeling on meeting someone that falling in love with
them is inevitable.*

Portrait romance/simulation game for RUN.world. Forked from `rundot_template`
(PixiJS 8, WebGPU-first, SDK 5.24, Vite 6). This document is canon for content
and numbers; code follows it, not the other way around.

## Pitch

You play a twenty-something in a warm, hand-painted 90s anime city. You choose
your avatar (female- or male-presenting), pick a location for the evening, and
meet someone. The date itself is a **real-time conversation simulation**: no
written dialogue, only Sims-style pantomime thought bubbles and body language.
You read the room and play actions — flirt, gift, soft touch, stare, kiss — and
every action's outcome depends on the moment, not on a script.

Everyone you meet is logged in the **Little Black Book** with a persistent
affection meter. Higher affection unlocks bolder actions. Max it out and you can
ask them to be your girlfriend or boyfriend — one slot only.

## Avatar select

First launch: choose a female-presenting or male-presenting avatar. This sets the
player sprite and the pool of candidates skews accordingly, but the pool is not
exclusive — every candidate can be dated.

## The conversation simulation

A date is a single continuous scene, roughly 90–150 seconds, on one painted
background. Player avatar on the left, candidate on the right, both cel-shaded
cutouts with swappable expression heads and pose bodies.

### The three gauges

| Gauge | Visible as | Role |
| --- | --- | --- |
| **Mood** | their face + posture (lean-in vs. phone-check) | multiplier on Spark gain |
| **Tension** | shoulders, blush, fidget animations | must sit inside a per-archetype sweet band; over-tension zeroes Spark and drains Mood |
| **Spark** | the heart meter on the HUD | the run's score; banked into affection at date end |

Spark only flows while Mood is high **and** Tension is inside the band. The band
is the whole game: safe actions bleed tension, bold actions spike it, and the
bold actions are the only ones that pay well.

### Thought bubbles

Both characters float a bubble showing a **topic pictogram** — ramen, a cat, a
motorbike, a broken heart, a music note, the moon, a camera, rain. The bubble is
the only information channel about what they care about right now. Topics rotate
on a timer and in response to actions. Matching an action to the live topic
(`Gift` a plushie while the cat bubble is up, `Ask About Bubble` on any topic)
multiplies its payoff — a topic-matched Gift is worth **4×** a random one.

### Actions

Cards along the bottom edge. Each has a cooldown, a tension delta, and an
affection floor that gates it. Every action is *dynamic*: its result is a
function of current Mood, current Tension, the live bubble topic, the candidate's
archetype, the location, and how recently you used the same action (repetition
decays payoff hard).

**Safe** — Small Talk · Ask About Bubble · Listen · Laugh · Compliment Outfit ·
Order Food · Share Dessert · Toast · Take a Photo

**Warm** — Tease · Joke · Confide · Mirror Their Pose · Fix Their Hair · Offer
Jacket · Walk Closer · Play With Straw

**Bold** — Flirt · Wink · Soft Touch: Hand · Soft Touch: Arm · Soft Touch:
Shoulder · Hold Hand · Stare · Look Away Blushing · Whisper · Dance

**High-stakes** (affection-gated) — Gift · Confession · Forehead Touch · Kiss On
Cheek · Kiss

**Risky / recovery** — Change Topic · Apologize · Brag · Push Too Far ·
Check Phone

Same action, different meaning: **Stare** at low affection reads as creepy and
spikes Tension; at high affection with a heart bubble on screen it is the single
largest Spark event in the game.

## Archetypes

Each candidate has a hidden archetype that shifts which action families land, and
sets their Tension sweet band. Starting set:

- **Night-owl artist** — rewards Confide, Listen, Stare; punishes Brag.
- **Cheerful tsundere** — rewards Tease and Joke; Compliment early reads as
  insincere; narrow Tension band.
- **Cool senpai** — wide Tension band, slow Mood; rewards Bold early, Safe bores.
- **Sunny athlete** — fast Mood, rewards Laugh/Dance/Share Dessert; Confide
  lands flat.
- **Sultry siren** — the widest Tension band in the game and the slowest decay,
  but a high band *floor*: play it safe and you never reach it at all. Bold and
  Intimate pay heavily, Safe is worth barely half.
- **Smouldering charmer** — warms fast and flirts back; Warm and Bold both land.
  Brag is his one dislike — bragging at the charming one competes on his ground.
- **Competitive runner** — the fastest Tension decay in the game, so pressure
  cannot be built once and coasted on. Bold and Risky both pay. Look Away
  Blushing is a dislike: hesitation reads as backing down.
- **Grounded climber** — the inverse of everyone else. A low, narrow band that
  is easy to reach and easy to overshoot; Safe and Warm are his best families
  and Risky is worth barely half. The one person you can genuinely take slowly.

The archetype is never named on screen. You infer it from bubbles and reactions,
and the Little Black Book fills in what you have learned about each person.

## Meta layer

- **Little Black Book** — every person met, their affection meter, discovered
  likes/dislikes, dates logged.
- **Eight candidates:** Mizuki (169, artist), Rin (171, tsundere), Kaede (172,
  competitor), Reina (174, siren), Sora (179, athlete), Ren (181, zen),
  Haruto (184, senpai), Kaito (186, charmer).
- **Locations** unlock with progress: sakura riverside plaza at dusk, a beach
  shack terrace at midday, a small-town trattoria corner in the late
  afternoon, shrine festival at night, rooftop city view, rainy convenience
  store.
- **Gift inventory** bought between dates.
- **Partner slot** — one at a time. Dating around while partnered has jealousy
  consequences (affection decay across the book).

## Art direction

**Characters** are classic 1990s Japanese TV anime cel: crisp thin black ink
linework, flat cel shading with exactly two tones per color, warm nostalgic
palette, no modern digital gradients. Cut out and composited over the
background with a soft contact shadow drawn in-engine.

**Backgrounds** are modern clean anime illustration — contemporary Japanese
mobile-game / visual-novel background art. Crisp flat color blocking, minimal
or no visible outlines on scenery, bright saturated palette, clean hard-edged
shadows, simple stylised foliage shapes. No painterly brush texture, no gouache
grain, no photorealism.

### The floor rule (non-negotiable)

Every background is a **stage**, not a landscape. Each one must have:

- an **eye-level camera** looking straight ahead at standing-human height;
- the **bottom 40%** given over to one large, flat, level, unobstructed ground
  plane, wide open and empty through the centre, that characters stand on;
- all scenery, furniture, plants and props pushed to the left/right edges and
  the top, framing the empty centre;
- no people and no animals; no text or lettering anywhere.

A background where the ground recedes into the distance as a path is unusable —
there is nowhere to place the cast.

**Paint a 3:2 master, ground line 76% down, horizon between 17% and 42%, and a
standing adult 34% of the image height.** That last number is what keeps the
cast the same size as the benches and railings in every orientation — and every
prop must be painted to the **scale ladder** on the guidelines sheet (45cm seat,
85cm bench back, 110cm railing, 210cm doorway). A background generated with no
human in frame has nothing forcing its furniture to agree; verify every new
painting with `npx tsx scripts/scale-ruler.mjs` before shipping it.
The game runs in both orientations, and a square canvas crops predictably in
each: portrait shows the full height and the central 38% of the width; landscape
shows the full width and a 69% band of the height, anchored on the ground line.
The horizon rule is the one that gets missed — a horizon painted high is cropped
away and landscape becomes bare floor. `art/background_guides.png` is the sheet; the
geometry lives in `src/game/data/backdrop.ts` and is verified by
`npx tsx scripts/check-orientation.mjs`. See `docs/ART_PIPELINE.md` §5.

### Asset pipeline

1. Generate with the `codex-image-gen` skill
   (`/Applications/ChatGPT.app/Contents/Resources/codex exec`). Characters and
   props are generated on a flat pure-green (`#00FF00`) field; backgrounds are
   generated as full painted scenes with no characters.
2. Key with `scripts/chroma-key.mjs` — green dominance, edge un-compositing,
   despill. **Not** `bg-removal-softshadows`' `chromaCutout`: its residual is
   normalised by pixel brightness, so any tolerance wide enough to catch the
   anti-aliased edge band also keys out near-black ink lines and hair.
3. Raw generations live in `art/raw/`, cutouts in `art/cutout/`, shipped
   textures in `public/`.

### Sizing and placement

Cast members are sized from their real-world `heightCm` in `scripts/cast.mjs`
via a single scene-wide pixels-per-cm. Two rules, both non-obvious:

- **Scale by crown-to-sole, never by the sprite height.** The sprite box can
  include a raised arm or a hat; dividing by it shrinks the actual body, and a
  184cm man renders shorter than a 171cm woman. The bake measures the crown and
  stores `bodyPx` in `cast-atlas.json`.
- **Sprites are trimmed edge-to-edge at bake time**, after the keying debris is
  stripped, so there is no transparent margin to throw off the ground line.

Both are enforced and verifiable: `npm test` runs `scripts/test-figure.mjs`,
and `node scripts/check-heights.mjs` renders the whole cast on one ground line
with the detected crowns drawn on. See `docs/ART_PIPELINE.md` §4.

## Where things live

| Concern | File |
| --- | --- |
| Art pipeline, and why the stock keyer is wrong here | `docs/ART_PIPELINE.md` |
| Every action and its base values | `src/game/data/actions.ts` |
| Archetypes, cast, locations, gifts, topics | `src/game/data/world.ts` |
| The simulation (renderer-free, seeded) | `src/game/sim/dateSim.ts` |
| Date rendering, bubbles, posture | `src/game/dateScene.ts` |
| Persistent record: book, partner, gifts | `src/state/profile.ts` |
| Balance sweep | `scripts/simulate-dates.mjs` |
| Trim + standing-height measurement | `scripts/figure.mjs` |
| Visual height proof | `scripts/check-heights.mjs` → `art/height_check.png` |
| Orientation contract | `src/game/data/backdrop.ts` |
| Background guidelines sheet | `scripts/background-guides.mjs` → `art/background_guides.png` |
| Both-orientation proof | `scripts/check-orientation.mjs` → `art/orientation_*.png` |
