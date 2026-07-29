# KOI NO YOKAN thumbnail visual asset brief

## Art direction

- Palette, lighting, camera/composition, shape language, materials/texture:
  romantic violet-blue dusk, warm moonlight, saturated pink sakura, bold
  inward-facing half-body silhouettes, and a tight square composition that
  remains legible at store-tile size.
- Typography/UI treatment and explicitly forbidden traits: large
  ivory-to-pale-gold high-contrast serif title with a thin dark-plum outline;
  smaller Japanese Mincho-style subtitle aligned beneath it at the lower right.
  No extra text, logo, watermark, UI, border, camera-facing gaze, mismatched
  face/body direction, photorealism, painterly grain, or glossy 3D rendering.
- Permitted reference sources and rights/attribution record: project-owned Rin
  and Haruto cutouts plus the project-owned sakura menu background.

## Deliverables

| Asset | Purpose | Dimensions/aspect | Alpha? | Format | In-game scale | Delivery path |
| --- | --- | --- | --- | --- | --- | --- |
| Untitled thumbnail source | Preserved original generation | 1254×1254, 1:1 | No | RGB PNG | Source only | `art/raw/thumbnail_key_art.png` |
| Titled thumbnail source | Highest-quality edited source | 1254×1254, 1:1 | No | RGB PNG | Source only | `art/raw/thumbnail_key_art_titled.png` |
| RUN thumbnail | Explore/search/shared-link tile | 512×512, 1:1 | No | RGB JPG | 128–512 px | `public/thumbnail.jpg` |

## Production

- Local/imported/generative method, model and estimated credits: Codex built-in
  image generation using ChatGPT quota; the tool exposes no estimate or token
  total. No RUN credits were used.
- Explicit approval for any paid generation: the user's request approved this
  single-image generation.
- Prompt, references, seed/generation ID, selected candidate, edit history:
  original generation prompt in `PROMPT.md`; references were
  `art/cutout/char_f_tsundere.png`,
  `art/cutout/char_m_senpai.png`, and `art/raw/menu_sakura.png`; selected
  generation `call_IyRv13zTyZM8k9NYLwvNNQls`; no seed was exposed. The
  title-edit prompt is in `TITLE_EDIT_PROMPT.md`; it used the untitled source
  as its edit target and selected generation
  `call_P96NWxANUVik7FBEo0EqTSkd`. No seed was exposed. The selected titled
  1254×1254 RGB PNG was uniformly resized to 512×512 and encoded as an
  88-quality JPG with macOS `sips`.

## Acceptance

- Exact 512×512 JPG requirement verified.
- Rin faces right and Haruto faces left; their heads, shoulders, torsos, pupils,
  and gaze all align inward toward one another.
- Both identities and wardrobes remain recognizable, with no extra people,
  watermark, malformed visible anatomy, stretching, or crop damage.
- The English title reads exactly `KOI NO YOKAN`; the smaller Japanese subtitle
  reads exactly `恋 の 予感` and is aligned under it at the lower right.
- The focal pair and English title remain clear at a 128×128 store-tile
  preview; the Japanese line is deliberately secondary.
- Final delivery is 142,794 bytes; both the untitled and titled full-resolution
  PNG sources remain in the art pipeline.
