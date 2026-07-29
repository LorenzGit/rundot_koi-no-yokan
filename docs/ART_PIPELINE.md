# Art pipeline: generation → cutout → shadow → game

Every character, prop and background in KOI NO YOKAN goes through this path.
It is written down because two of the steps have non-obvious failure modes that
cost real time to rediscover.

```
codex-image-gen  ──▶  art/raw/*.png      opaque RGB, subject on a green screen
scripts/normalize-expression-sheets.mjs
                 ──▶  art/normalized/*_expressions_left.png
                       fixed 1800×900 sheets at one cast-wide physical scale
scripts/slice-expression-poses.mjs
                 ──▶  public/images/cast/<id>_<expression>.png
                       six tightly trimmed transparent pose PNGs per character
scripts/chroma-key.mjs ──▶ art/cutout/*.png   RGBA with a real anti-aliased matte
scripts/preview-scene.mjs ──▶ art/preview_*.png   authoring-time check
```

## 1. Generation

Characters and prop sheets are generated on a **flat pure-green field**:

> Background: completely flat solid pure chroma green (hex 00FF00), perfectly
> uniform, no floor, no shadow, no gradient, no props.

For six-expression character sheets, use the reusable prompt and rejection
checklist in [`CHARACTER_EXPRESSION_SHEET_PROMPT.md`](CHARACTER_EXPRESSION_SHEET_PROMPT.md).
Supply only the clean character reference; annotated review images are feedback
for the prompt author, not generator inputs.

Separate image-generation calls do not share a reliable subject scale. After
all cast sheets are generated, run `npm run normalize:expressions`. The script
splits each sheet into six cells, keys the background, measures every figure
crown-to-sole, and uniformly scales it from `scripts/cast.mjs`'s `heightCm`.
It writes fixed 1800×900 pure-green sheets to `art/normalized/`, preserving the
raw generations unchanged.

The scale is shared across the whole cast: the tallest roster member (186 cm)
is 760 pixels crown-to-sole, and everyone else is proportional. The women
average 171.5 cm and the men 182.5 cm, so women render about 6% shorter on
average—not as a separate arbitrary gender multiplier. Every expression lands
on the same row baseline. `art/expression_height_check.png` groups the four
women followed by the four men and is the visual proof to inspect.

Run `npm run slice:expressions` after normalization. It follows the local
`bg-removal-softshadows` Engine B workflow through this project's
green-dominance adapter, then cuts and tightly trims these six transparent
PNGs:

- `<id>_neutral.png`
- `<id>_happy.png`
- `<id>_sad.png`
- `<id>_surprised.png`
- `<id>_angry.png`
- `<id>_in_love.png`

The existing `<id>_figure.png` is never rewritten or removed. Therefore each
cast member has exactly seven character-art entries: the original figure plus
six expression poses. Technical masks are not character-art
entries and remain unchanged. `public/images/cast/cast-poses.json` records all
seven entries, their tight dimensions, crown offset, and crown-to-sole
measurement. `art/expression_cutout_check.png` composites every new pose over a
contrasting magenta checkerboard for alpha-edge review.

The generator does not hit `00FF00` exactly — measured output is around
`rgb(18, 249, 12)` — but it is uniform, which is all the keyer needs.

Backgrounds are generated as complete painted scenes and are never keyed. They
have their own composition contract; see the floor rule in `DESIGN.md`.

## 2. Background removal

**Use `scripts/chroma-key.mjs`. Do not use `bg-removal-softshadows`'
`chromaCutout` for this art.**

### Why the skill's keyer is wrong here

That keyer scores a pixel by its residual off the key axis **divided by the
pixel's own brightness**:

```js
return res / Math.max(CHROMA_DARK_FLOOR, Math.min(1, s));
```

Dividing by brightness is correct for soft photographic mattes — it makes the
key scale-invariant under exposure. But it means a *near-black* pixel scores as
close to **any** key colour, because the divisor bottoms out at a small floor
while the numerator is tiny. Cel art is full of near-black: ink lines, pupils,
and hair painted at `rgb(2, 9, 12)`.

The result is a tolerance trap with no working setting:

| tolerance | outcome |
| --- | --- |
| 20 (default) | anti-aliased edge band survives → pale halo around every silhouette |
| 34 | edge band keyed, **and 2,609 holes punched through the character's hair** |

There is no value that removes the edge band without eating the linework,
because the two are equally "close to green" under that metric.

### What this keyer does instead

Three stages, in `chromaKey()`:

**1. Key on green dominance.** `dominance = g - max(r, b)`. This is ~231 on the
screen and **≤ 0 on black ink no matter how dark it is**, because black has no
green *excess*. Skin (`242,181,117`) scores −61. Hair (`2,9,12`) scores −3.
Neither can ever be keyed, at any threshold.

Alpha ramps linearly across `[low, high]` = `[20, 225]`:

```js
const keyness = clamp01((dominance(r, g, b) - low) / (high - low));
let a = clamp01((1 - keyness - shrink) / (1 - shrink));
```

**The ramp must span nearly the whole dominance range.** A pixel that is
fraction `a` subject over the screen reads as `a·subject + (1-a)·key`, so its
dominance falls roughly linearly from ~231 down to the subject's negative
value. An earlier version used `high = 90`, which meant anything more than
about a third green went fully transparent — that collapses the source art's
one-pixel anti-aliased border into a hard on/off edge, and **every diagonal
turns into staircase jaggies**. `shrink` does the same damage deliberately and
is therefore 0 by default.

**2. Un-premultiply the edge.** A half-covered edge pixel genuinely *is* half
green. Deleting the green without un-compositing leaves the washed-out
remainder — that is what the pale outline actually was, and no amount of
tolerance tuning removes it. The fix is arithmetic:

```js
R = (r - (1 - a) * key[0]) / a;   // and G, B
```

Pixels below 2% coverage are dropped rather than un-premultiplied, since
dividing by that little coverage amplifies noise into bright specks.

**3. Despill.** Any surviving green cast is pulled down: `if (G > max(R,B)) G =
max(R,B)`. Harmless for this cast — none of them wear green.

### Verifying a cutout

Two checks, both cheap:

- **Holes.** Count transparent pixels inside a region that should be solid
  (a head crop). Non-zero means the key is eating the subject. Cross-check what
  raw colours sit under the holes — if they are all `~18,249,12` they are
  genuine background and the crop simply straddles an edge.
- **Anti-aliasing.** Print the alpha ramp across a silhouette edge. Healthy
  output looks like `0 88 253 255 255`, `0 169 255 255`, `0 51 255 255` —
  varying intermediate values meaning real sub-pixel coverage. If every edge
  reads only `0` or `255`, the AA is gone and the sprite will look jagged.

Composite over **magenta** when eyeballing; a pale fringe is invisible over
sand and obvious over magenta.

## 3. Shadows — drawn at runtime, not baked

**There are no shadow files.** There used to be one baked `<id>_shadow.png` per
character: a per-column contact stamp measured from that exact cutout, plus an
ambient pool, composited into a single alpha mask.

That approach died the moment each character gained six expression poses. A
baked stamp is measured against one silhouette, and the poses differ in stance,
width and where the feet actually land — so a single baked shadow is wrong five
times out of six, and keeping six per character would mean forty-eight more
files to regenerate whenever any pose is redrawn.

The scene now draws the shadow itself, in `drawSoftShadow()` in
`src/game/dateScene.ts`: a handful of concentric ellipses with a rising alpha
toward the centre, sized from the pose currently on screen and redrawn whenever
the pose changes. A wider stance casts a wider shadow, which is the entire point
of doing it at runtime.

Graphics rather than a generated gradient texture: the falloff only needs about
five rings to read as soft, and this avoids a canvas upload and the
`Texture.from(canvas)` resolution pitfalls entirely.

The one thing lost is per-foot contact depth — a figure with one foot further
back had its rear foot's shadow stamped higher up the frame. At the size the
cast renders on a phone that difference was already sub-pixel, and it is not
worth six files per character to keep.

## 4. Trimming, and measuring a person

`scripts/figure.mjs`, applied by `scripts/slice-expression-poses.mjs`.

### cleanMatte — strip everything that is not the figure

Connected components over **any** non-zero alpha; a blob is kept only if it is
both big enough (≥ 64px) and actually solid somewhere (peak alpha ≥ 48). That
double condition is doing two jobs at once:

- **isolated specks of real matte** — the senpai cutout has two opaque pixels on
  its very last row, 90px below his soles;
- **a faint haze of alpha 4–40** scattered right out to the canvas corners,
  left by the generator's green vignette. Only ~1,900 pixels, but it touches
  every edge, so any bounding box that respects it is *the entire canvas*.

Thresholding alone cannot separate that haze from genuine anti-aliased edge
pixels — they occupy the same alpha range. Requiring a *connection* to
something solid does: a real edge pixel touches the body, stray haze does not.

Only then is the box taken, tight at `alpha > 0`. The bake **asserts** that all
four edges of the shipped sprite carry a pixel, so a silently loose trim cannot
reach the game — a loose trim shifts the ground line and drags the shadow with
it.

### measureStandingHeight — crown to sole, not top to bottom

**The bounding box is not the person.** Sora waves; someone in a hat measures
the hat. Scaling a box like that to a real-world height shrinks the actual body,
which is exactly how a 184cm man ends up rendering shorter than a 171cm woman.

The detector anchors on the torso — the horizontal centre of the lower 55% of
the figure, which is stable no matter what the arms are doing — then scans down
from the top for the first row carrying a run that is:

- **wide enough to be a head**: ≥ 30% of the widest part of the body. A raised
  hand, a ponytail or a hair spike is far narrower than a skull.
- **near the torso centre**: within 22% of the figure width.

Everything downstream scales by `bodyPx = spriteHeight − crownY`, never by the
sprite height. The sprite is then drawn at whatever height that implies, so the
overhead (raised arm, hair) extends above the head naturally.

**Hats are the known limit.** A wide brim passes both tests and will be measured
as skull. Set `crownAdjustPx` on the character in `scripts/cast.mjs` to push the
crown down by hand; nobody in the current cast needs it.

### Verifying

- `node scripts/test-figure.mjs` — synthetic figures the real cast cannot
  exercise: an arm raised well above the head (crown must be the head, not the
  hand), a plain figure (crown must equal the box top), and a cleanup case
  asserting the faint *connected* edge survives while the faint *detached* haze
  does not. Wired into `npm test`.
- `node scripts/check-heights.mjs` — renders `art/height_check.png`: the whole
  cast scaled by real height onto one ground line, with each detected crown
  drawn as a pink line and the target height as a blue tick. **Look at it.** If
  the detector were fooled, the pink line would sit above the head and the
  figure would be visibly wrong beside the others; no number tells you that.

## 5. Orientation: one painting, two viewports

`src/game/data/backdrop.ts` is the contract; `art/background_guides.png` is the
same contract as a sheet an artist or an image prompt can work from.

### Anchor on the ground, never on the centre

A cover-fit that centres the painting is wrong in landscape. Measured on the
current 1024x1536 art at 1920x1080: the visible slice is source rows 480-1056,
while the ground line sits at row 1428. **The floor is not on screen at all** —
the cast would stand below the bottom edge.

`placeBackdrop()` instead positions the painting so its own ground line
(`SOURCE_GROUND`, 86% down) lands on the screen's (73.5% down in portrait, 86%
in landscape), clamped so the frame can never be uncovered. The sky is what
gets sacrificed, which is the right thing to lose.

### The ground line is not a free choice

A square master in a **portrait** viewport is cover-fitted by *height*, so the
whole master is visible and the painted ground line lands at exactly its own
fraction of the screen. `SOURCE_GROUND` must therefore equal
`SCREEN_GROUND_PORTRAIT` (0.765). Get this wrong and there is no placement that
saves it: too high and the cast stands on empty air above the painted floor
(on the water, for the beach); too low and their feet are behind the action
deck. The first batch was briefed at 0.86 and hit exactly that.

`scripts/reframe-backgrounds.mjs` fixes a painting whose ground line is in the wrong
place without repainting it: the floor band below the ground line is resampled
taller until the ground line sits at the required fraction. The floor is flat,
level and empty by contract and is already foreshortened, so stretching it
~1.9x is invisible. Everything above the ground line is copied untouched.

`placeBackdrop()` re-reads the ground line from where the painting **actually**
landed after clamping, not from where it was asked to go — otherwise a clamped
placement silently stands the cast off the floor.

### Size the cast against the painting, not the screen

The cast's on-screen height is `SOURCE_PERSON_HEIGHT` (0.345) x the **drawn
backdrop height**, never a fraction of the viewport.

Sizing against the viewport is what produces "giants in portrait, tiny people in
landscape". Cover-fit is driven by height in portrait and by width in landscape,
so the scenery is magnified in one and not the other; a cast pinned to the
screen then measures 54% of the painting in portrait and 22.6% of it in
landscape — a **2.39x** mismatch against the benches and railings around them.
Tying them to the painting makes that impossible by construction.

The value comes from the paintings' own perspective: an eye-level camera puts a
standing adult's eyes on the horizon, so with the ground line at 0.765 and the
horizon band centred near 0.44, a person spans about `(0.765 - 0.44) / 0.94`.

### Author 3:2, not square

Once the cast is world-scaled, the master's aspect decides whether either
orientation overflows, because cover-fit magnifies the painting by
`viewportAspect / imageAspect`:

| master | landscape zoom | cast in portrait | cast in landscape |
| --- | --- | --- | --- |
| square (0.89 after floor extension) | 2.44x | 35% of screen | **84% — heads cut off** |
| **3:2** | **1.44x** | **35%** | **50%** |

3:2 is the aspect at which one painting and one world scale serve both
viewports. Portrait then sees the central **38%** of the width and landscape
**69%** of the height, so portrait-critical content belongs in that central
strip and the outer thirds are landscape-only enrichment.

`scripts/reframe-backgrounds.mjs` turns a square master into the shipped 3:2
image: crop from the top (sky, which the brief marks croppable) and extend the
floor band if the crop needs more floor than was painted.

### Style drifts when the prompt is heavy with numbers

The scale and geometry rules make for a long, technical prompt, and a prompt
dominated by measurements will come back **photoreal** — rendered water
caustics, soft airbrush gradients, photographic clouds — even with a style
sentence in it. State the style **first and last**, and give explicit negatives:
not a photograph, no photorealism, no 3D render, no water caustics, no lens
blur, no depth of field, no soft gradient blending, no realistic textures.

Describe the *drawing* of each element, not just the subject: "clouds are flat
rounded shapes", "water is a few flat bands with simple stylised ripple lines",
"foliage is clumped flat leaf shapes". That is what keeps it 2D.

### Human scale: the brief must pin it, and you must verify it

A background generated with **no human in frame** has nothing forcing its
furniture to agree with how big the game thinks a person is. Measured on the
first beach painting, with a 171cm cast member stood on its ground line:

| painted prop | reads as | should be |
| --- | --- | --- |
| near bench seat | 130cm | 45cm |
| near bench back | 175cm | 85cm |
| far hut railing | 45cm | 110cm |

The near bench is **2.9x** life size and the far railing **0.4x** — the painting
does not even agree with *itself*, so no single `personHeightFraction` can
rescue it. That is why the brief now carries a **scale ladder** giving every
common prop as a percentage of image height, and why rule 7 tells the generator
that props must be painted to it.

`personHeightFraction` on a location overrides the global for one painting, for
the case where the art is internally consistent but at its own scale. It cannot
fix art that is inconsistent internally; that needs repainting.

**Verify before shipping:** `npx tsx scripts/scale-ruler.mjs` writes
`art/scale_<location>.png` — the painting with a real cast member on its ground
line and labelled bars at 45 / 85 / 110 / 210cm. Compare the bars to the painted
furniture. It takes ten seconds and it is the only way to catch this, because
the art looks perfectly plausible until a person stands next to it.

### Where the floor starts is per-painting, not a constant

`groundAsPainted` on each location says where the walkable floor is in that
*original* painting. It is not the same anywhere: the beach deck's near edge
measures at **87%**, the trattoria pavement starts at **60%**. Standing the cast
on one shared fraction put them on the beach deck's far lip with sea at their
soles — they read as standing *in the water*, because no floor was visible
behind them.

Set it far enough onto the floor that some floor shows behind the cast, then let
the reframe shift that painting so its floor lands on the layout's ground line.
Cost is paid in sky: the beach needs 42% cropped off the top and its floor
stretched 2.2x.

### Author square

A square master, cover-fitted, crops predictably at both extremes:

| viewport | sees |
| --- | --- |
| portrait 1080x1920 | full height, central **56%** of the width |
| landscape 2340x1080 | full width, a **46%** band of the height |

So the master divides into three bands:

- **SKY** — above the landscape window. Cropped away in landscape; nothing that
  must be seen goes here. Portrait shows the full height, so a character may
  reach up into it.
- **CORE** — the landscape window. The floor, the landscape character envelope,
  and any prop that must always be on screen.
- **FLOOR** — flat, level, empty through the middle, painted to the bottom edge
  (portrait sees more floor than landscape).

Side scenery outside the central 56% is only ever seen in landscape: use it,
but do not rely on it.

### Verifying

`npx tsx scripts/check-orientation.mjs

# human scale: does the painted furniture agree with the cast?
npx tsx scripts/scale-ruler.mjs` renders every location at both
orientations with the cast standing in it, through the *same* `placeBackdrop()`
the game uses, and marks the ground line. Two different failures to look for:

1. **Mis-anchored** — the cast is not standing on the painted floor.
2. **Empty** — anchored correctly but nothing worth looking at survives the
   landscape crop. The current portrait-authored backgrounds fail this one:
   the sakura canopy, sunset and skyline are all above the landscape band, so
   landscape is bare paving. Correct, and dull.

The in-game HUD also reflows in landscape — the 37-card deck becomes a
right-hand column — so the cast is centred on the **visible stage** (33% of the
width) rather than the viewport, or the partner renders behind the deck.

## 6. Sizing and placement

`scripts/cast.mjs` gives every character a real-world `heightCm`. Scenes derive
sprite pixel heights from one scene-wide pixels-per-cm. Two rules:

- **Measure the figure, not the canvas.** Generations carry wildly different
  margins; scaling to a fraction of the frame sizes the whitespace.
- **Scale by crown-to-sole, not by the sprite box** (see above). The shipped
  sprites are pre-trimmed and pre-measured by the bake, so the game just reads
  `bodyPx` from `cast-atlas.json`.

## Commands

```bash
# key one generation
node scripts/chroma-key.mjs art/raw/char_m_senpai.png -o art/cutout/char_m_senpai.png

# slice a 3x2 prop sheet into individual sprites
BG_REMOVAL_DIR=../rundot_template/.agents/skills/bg-removal-softshadows \
  node ../gyrocore/scripts/slice-sheet.mjs art/cutout/props_gifts.png \
  --grid 3x2 --out public/images/gifts --names bouquet,plushie,bubbletea,ringbox,cake,letter --max 256

# trim, measure and bake shadow masks for the whole cast

# prove the measurement, by eye and by test
node scripts/check-heights.mjs
node scripts/test-figure.mjs

# normalize all six-expression sheets to the roster's shared physical scale
npm run normalize:expressions

# remove green, cut, and tightly trim six named poses per character
npm run slice:expressions

# background framing: the brief, the reframe, and both orientations rendered
node scripts/background-guides.mjs
node scripts/reframe-backgrounds.mjs
npx tsx scripts/check-orientation.mjs

# eyeball a location with two cast members standing in it
node scripts/preview-scene.mjs public/images/bg_sakura_plaza.png art/preview_sakura.png
```
