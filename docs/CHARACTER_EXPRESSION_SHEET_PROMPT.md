# Character expression sheet prompt

Use this prompt to produce a six-expression, full-body source sheet for any
KOI NO YOKAN cast member. It is designed for characters who must look toward a
date rather than at the camera.

## Inputs

Supply exactly one image:

- `Image 1`: the clean, project-owned character identity and art-style
  reference.

Do not supply annotated review screenshots. Resolve every parameter below
before sending the prompt:

| Parameter | Left-facing value | Right-facing value |
| --- | --- | --- |
| `{{FACING_DIRECTION}}` | `screen-left` | `screen-right` |
| `{{OFF_CANVAS_POSITION}}` | `9-o'clock` | `3-o'clock` |
| `{{PUPIL_EDGE}}` | `left` | `right` |

## Reusable prompt

```text
Use Image 1 only as the identity and art-style reference.

Create one extra-wide landscape expression sheet showing the exact same
character from Image 1 six times. Preserve the character's face, hairstyle,
clothing, colors, body proportions, age, height, and illustration style.

LAYOUT — STRICT

Place exactly six complete full-body figures in one single horizontal row.
Never use multiple rows or a grid.

Order from left to right:
1. neutral
2. happy
3. sad
4. surprised
5. angry
6. in love

All six figures must:
- stand on one identical invisible ground baseline;
- touch one identical invisible crown-height guide;
- have exactly the same crown-to-sole height;
- have exactly the same head size and body proportions;
- use the same camera distance and perspective;
- remain fully visible from hair to shoe soles;
- have clean separation and never overlap.

Do not compress, stretch, shrink, enlarge, crouch, crop, or vertically
reposition any figure. Emotion must never change the character's height,
anatomy, or scale.

DIRECTION — MOST IMPORTANT

All six figures face {{FACING_DIRECTION}} toward one imaginary dating partner
located off-canvas at the {{OFF_CANVAS_POSITION}} position.

The entire body must share this direction:
- shoe toes point {{FACING_DIRECTION}};
- knees and hips rotate {{FACING_DIRECTION}};
- chest and shoulders rotate {{FACING_DIRECTION}};
- neck and head follow the torso;
- nose and chin point clearly toward the same edge.

Use a strong three-quarter side profile, approximately 60 degrees away from the
camera. It must not resemble a frontal portrait.

Both eyes look toward the same off-canvas partner:
- pupils shift toward the {{PUPIL_EDGE}} side of the visible eye openings;
- the near eye is clearly visible;
- the far eye is smaller and partially hidden by the nose bridge;
- neither eye looks at the viewer;
- there is no camera eye contact or frontal gaze;
- body, face, and eye direction never disagree.

IDENTITY — STRICT

Treat this as one character model using one fixed animation rig, not six
reinterpretations.

Keep identical across all six figures:
- skull and facial structure;
- hairstyle silhouette;
- shoulder, waist, and hip widths;
- torso, arm, and leg lengths;
- clothing construction and fit;
- shoe size;
- line weight, palette, shading, and lighting.

Only facial expression, arm position, hand gesture, and restrained posture may
change.

DISTINCT EXPRESSIONS AND BODY SILHOUETTES

Each pose must remain recognizable if the character were displayed as a solid
black silhouette.

1. Neutral:
Relaxed brows, calm closed mouth, and upright posture. Use existing garment
pockets only when they are clearly visible in Image 1; otherwise keep both arms
relaxed naturally at the sides. Never invent pockets or change the outfit.

2. Happy:
Broad genuine smile, happy crescent eyes, open chest, one open hand raised in a
friendly greeting, and the other arm relaxed.

3. Sad:
Raised inner brows, heavy eyelids, clearly downturned mouth, shoulders drawn
slightly inward, and one hand loosely holding the opposite forearm low across
the torso. Remain full height.

4. Surprised:
High brows, very wide eyes, open mouth, both hands raised near shoulder level
with spread fingers, and feet planted.

5. Angry:
Strongly furrowed brows, narrowed eyes looking {{FACING_DIRECTION}}, tight
mouth, tense shoulders, one clenched fist raised near the ribs, and the other
clenched at the side.

6. In love:
Warm cheek blush, softened half-lidded eyes looking {{FACING_DIRECTION}},
tender lovestruck smile, both hands clasped gently over the heart, and a shy
but upright posture. No floating hearts.

STYLE

Match Image 1 exactly. Use classic 1990s Japanese television-anime cel
illustration: crisp thin black ink, flat two-tone cel shading, a consistent
warm nostalgic palette, and no modern digital gradients.

BACKGROUND

Use a perfectly flat, uniform pure chroma-green background, #00FF00.
No floor, shadows, gradients, scenery, texture, reflections, guide lines,
panels, captions, labels, arrows, handwriting, symbols, or watermark.

AVOID

Multiple rows, inconsistent heights, squashed figures, scale drift, frontal
faces, camera eye contact, centered pupils, mixed facing directions, nearly
identical poses, costume drift, hairstyle drift, changed anatomy, bent-knee
height loss, cropped shoes, duplicated limbs, malformed hands, props, text, or
additional characters.
```

## Acceptance checklist

Reject a result if any answer is no:

- Are there exactly six figures in one horizontal row?
- Do all crowns and soles align without visible scale or proportion drift?
- Do toes, hips, chest, nose, and pupils point toward the same screen edge?
- Is the far eye foreshortened, with no figure making camera eye contact?
- Are all six poses distinguishable by silhouette alone?
- Are identity, hairstyle, costume construction, and cel style consistent?
- Are every head, hand, and shoe fully visible?
- Is the green background flat and free of text, guides, props, and shadows?

## Accepted example

- Output: [`../art/raw/char_m_senpai_expressions_left.png`](../art/raw/char_m_senpai_expressions_left.png)
- Direction: screen-left
- Dimensions: 1774×887 RGB PNG
- Input rights: project-owned `art/raw/char_m_senpai.png`
- Generator: Codex CLI 0.146.0-alpha.3.1 with the built-in image tool
- Generation ID: `call_58A6OwaZW5x3I4bpgAM3Hh1c`
- Codex tokens: 75,119; the image tool did not report separate usage
- Accepted by the project owner on 2026-07-28

## Remaining cast batch

Generated from each character's clean, project-owned source image on
2026-07-28. Every sheet has exactly six full-body figures in one horizontal
row, consistent crown-to-sole scale, distinct expression poses, and aligned
screen-left body, face, and eye direction.

| Character | Output | Dimensions | Generation ID |
| --- | --- | --- | --- |
| Artist | [`char_f_artist_expressions_left.png`](../art/raw/char_f_artist_expressions_left.png) | 1827×861 | `call_U5iIf7cLpZ0PRJCTQcsmr19B` |
| Runner | [`char_f_runner_expressions_left.png`](../art/raw/char_f_runner_expressions_left.png) | 1807×870 | `call_W0PiG9mGDFzcHngB9s3AKEPc` |
| Siren | [`char_f_siren_expressions_left.png`](../art/raw/char_f_siren_expressions_left.png) | 1900×828 | `call_t5hm1IXoAsBjanVunRlRv1KO` |
| Tsundere | [`char_f_tsundere_expressions_left.png`](../art/raw/char_f_tsundere_expressions_left.png) | 1774×887 | `call_1EGokPHmw13kFIocLuT0WOKO` |
| Athlete | [`char_m_athlete_expressions_left.png`](../art/raw/char_m_athlete_expressions_left.png) | 1808×870 | `call_I857RLUswlAhgPXjXpJ3ETvg` |
| Charmer | [`char_m_charmer_expressions_left.png`](../art/raw/char_m_charmer_expressions_left.png) | 1774×887 | `call_2tvhQm0cnz1YWlPhJMJT7t1Z` |
| Climber | [`char_m_climber_expressions_left.png`](../art/raw/char_m_climber_expressions_left.png) | 1774×887 | `call_P0bM5V7Doaa8E5MYwkLi0SBk` |

The generator produced visually uniform chroma-green backgrounds, but their
pixels vary slightly instead of being exact `#00FF00`; normalize or remove the
background during asset preparation. The Tsundere sheet preserves the handbag
from its identity reference, so remove it during preparation if the runtime
sprite should not include props.

The files above are immutable generation sources, not cast-scale-ready sheets.
Run `npm run normalize:expressions` to produce fixed 1800×900 derivatives in
`art/normalized/`. That step detects the six figure gaps, keys each sheet's
actual green, and scales every expression crown-to-sole using the roster
heights in `scripts/cast.mjs`. See
[`ART_PIPELINE.md`](ART_PIPELINE.md#6-sizing-and-placement) for the shared
physical-scale contract.

Generator: Codex CLI 0.146.0-alpha.3.1 with the built-in image tool. Exactly
seven calls were made with no retries or variants. The Codex session used
2,351,191 tokens; the image tool did not report separate per-image usage.
