# Copy this into Story Studio

Create a three-episode interactive romance series titled **Koi no Yokan: Three Evenings**.

Use the uploaded assets exactly as supplied. Do not generate replacement character art, locations, music, props, or covers. The visual style is polished anime romance with transparent full-body sprites, dusk pinks, seaside blues, and warm restaurant gold.

Series logline: Mizuki has three evenings to answer an artist residency offer, and three chances to tell the person she might love before silence makes the choice for her.

The fixed main character is Mizuki. The three romance routes are Rin, Haruto, and Reina. Supporting characters are Sora, Kaede, Ren, and Kaito. Keep every character's personality and role from `STORY.md`.

Create these persistent series variables before adding chapters:

- `route`, string, default `undecided`
- `honesty`, integer, default `0`
- `courage`, integer, default `0`
- `keepsake`, string, default `none`
- `future`, string, default `undecided`

Create three locations named exactly:

- Sakura Plaza
- Beach Terrace
- La Dolce Vita

Add one music cue named exactly `Cherry Promenade`.

For every character, use the files in `assets/characters/<name>/`. Set `portrait.png` as the base portrait. Map `normal.png`, `happy.png`, `sad.png`, `angry.png`, and `shocked.png` to the five native emotions. Keep `in-love.png` as an optional replacement for the happy slot during romance-heavy final QA, but do not reference an `in-love` emotion in Ink.

Create these chapters in order and paste the matching Ink file without rewriting it:

1. The Page Left Blank: `episodes/01-the-page-left-blank.ink`
2. What the Tide Kept: `episodes/02-what-the-tide-kept.ink`
3. Say It Before Five: `episodes/03-say-it-before-five.ink`

Use `assets/covers/series-cover.jpg` as the series cover. Keep the point of view close third-person through Mizuki. Preserve all choices, variable writes, route-specific conditionals, scene transitions, and endings.

Do not add a purchase gate, ad break, or cliffhanger after episode three. The season must end with emotional closure and may leave only the practical future open.
