# KOI NO YOKAN vacation postcard visual asset brief

## Art direction

- Palette, lighting, camera/composition, shape language, materials/texture:
  saturated tropical palettes with destination-specific lighting; strong
  diagonal full-body action poses; classic 1990s Japanese television-anime
  linework and two-tone cel shading; painted animation-background environments;
  clean cream printed-postcard border with softly rounded corners.
- Typography/UI treatment and explicitly forbidden traits: no text, captions,
  logos, stamps, postal marks, watermarks, photorealism, glossy 3D rendering,
  static portrait poses, camera-facing gaze, costume carryover, sexualized
  framing, cropped limbs, or malformed anatomy.
- Permitted reference sources and rights/attribution record: project-owned
  character figures under `public/images/cast/`; approved Kaede postcard
  `art/postcards/char_f_runner_tropical_dive_v2.png` may be used only as a
  finish, border, and motion-intensity reference.

## Deliverables

| Asset | Purpose | Destination and action | Dimensions/aspect | Alpha? | Format | Delivery path |
| --- | --- | --- | --- | --- | --- | --- |
| Kaede | Approved style anchor | Waterfall lagoon; twisting rope-release dive | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_f_runner_tropical_dive_v2.png` |
| Mizuki | Collectible postcard | Granite tropical cove; lunging beach-mural paint stroke | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_f_artist_granite_cove_mural.png` |
| Rin | Collectible postcard | Vine-draped jungle cenote; careful toe-dip | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_f_tsundere_cenote_toe_dip_v2.png` |
| Reina | Collectible postcard | Moonlit bioluminescent cove; carving a luminous surf wave | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_f_siren_bioluminescent_surf.png` |
| Haruto | Collectible postcard | Volcanic black-sand waterfall island; relaxed shoreline walk | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_m_senpai_volcanic_walk_v2.png` |
| Sora | Collectible postcard | Sunny coral cay; explosive beach-volleyball save | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_m_athlete_coral_cay_volleyball.png` |
| Kaito | Collectible postcard | Sunset tropical resort bay; airborne wakeboard grab | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_m_charmer_sunset_wakeboard.png` |
| Ren | Collectible postcard | Emerald limestone-karst lagoon; sea-cliff dyno leap | 1536×1024, 3:2 | No | RGB PNG | `art/postcards/char_m_climber_karst_dyno.png` |

## Production

- Local/imported/generative method, model and estimated credits: Codex built-in
  image generation, one call per postcard. This uses ChatGPT quota; no estimate
  is available.
- Explicit approval for any paid generation: the user approved the seven-image
  remaining batch in this task. No RUN credits are used.
- Prompt, references, seed/generation ID, selected candidate, edit history:
  indexed in `README.md` and recorded in `POSTCARD_PROMPTS.md`. Each character
  figure is the identity reference; Kaede is the style anchor only.

## Acceptance

- Wide postcard crop with the full moving figure visible and safe inside the
  cream border; action and destination must remain legible at reduced size.
- Inspect hands, feet, joints, gaze direction, swimsuit construction, repeated
  elements, unwanted text, border continuity, lighting, and style consistency
  at full resolution.
- Keep each RGB PNG near the built-in 1536×1024 output and persist it under
  `art/postcards/`. Keep those source files untouched. Game-ready derivatives
  are 720×480 RGB PNGs under `public/images/postcards/`, preserving the 3:2
  aspect ratio without stretching, and are indexed by the public manifest.
