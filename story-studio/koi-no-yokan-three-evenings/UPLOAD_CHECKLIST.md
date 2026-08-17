# Story Studio upload checklist

## 1. Series

- Title: `Koi no Yokan: Three Evenings`
- Logline: `Mizuki has three evenings to answer an artist residency offer, and three chances to tell the person she might love before silence makes the choice for her.`
- Genre: romance, cozy drama, interactive fiction
- Rating: 13+
- Cover: `assets/covers/series-cover.jpg`
- Main character: fixed character, Mizuki

## 2. Variables

Add these as series variables before pasting any Ink:

| Name | Type | Default |
| --- | --- | --- |
| `route` | string | `undecided` |
| `honesty` | integer | `0` |
| `courage` | integer | `0` |
| `keepsake` | string | `none` |
| `future` | string | `undecided` |

## 3. Locations

| Story Studio name | File |
| --- | --- |
| Sakura Plaza | `assets/backgrounds/sakura-plaza.png` |
| Beach Terrace | `assets/backgrounds/beach-terrace.png` |
| La Dolce Vita | `assets/backgrounds/la-dolce-vita.png` |

Names must match exactly because the Ink scripts resolve backgrounds by location name.

## 4. Music

| Story Studio name | File | Use |
| --- | --- | --- |
| Cherry Promenade | `assets/audio/cherry-promenade.mp3` | Loop under all three evenings |

## 5. Characters

Create characters named exactly: `Mizuki`, `Rin`, `Haruto`, `Sora`, `Reina`, `Kaito`, `Kaede`, and `Ren`.

For each character folder:

| Story Studio field | File |
| --- | --- |
| Base portrait | `portrait.png` |
| Normal | `normal.png` |
| Happy | `happy.png` |
| Sad | `sad.png` |
| Angry | `angry.png` |
| Shocked | `shocked.png` |
| Optional romance alternate | `in-love.png` |

Do not create an `in-love` emotion in the scripts. Story Studio's native playable set is the five emotions above.

## 6. Chapters

Create and paste in this order:

1. `episodes/01-the-page-left-blank.ink`
2. `episodes/02-what-the-tide-kept.ink`
3. `episodes/03-say-it-before-five.ink`

## 7. Optional visual inserts

- Props are in `assets/props/`.
- Route postcards are in `assets/postcards/`.
- Location thumbnails are in `assets/location-thumbnails/`.
- `assets/covers/menu-sakura-reference.png` is a style reference, not an episode background.

The scripts do not require prop inserts to compile. Add them only where Story Studio supports a graphic backdrop or insert shot.

## 8. QA before publishing

- Play all three route choices from episode one.
- Verify each route persists into episodes two and three.
- Test all three keepsakes.
- Test all three final futures.
- Confirm no scene shows more than two character sprites at once.
- Confirm every spoken emotion renders a sprite.
- Confirm all background changes fade.
- Confirm Cherry Promenade loops and stops at the final line.
- Confirm episode three reaches `END` on every branch.
