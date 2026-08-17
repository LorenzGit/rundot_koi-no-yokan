# Koi no Yokan: Three Evenings

## Series pitch

Mizuki has three evenings to answer an artist residency offer, and three chances to tell the person she might love before silence makes the choice for her.

This is a cozy, choice-driven romance about the difference between leaving and disappearing. The player is Mizuki. They choose one of three romantic routes, decide how quickly to reveal the residency, and choose what kind of future Mizuki asks for.

## Format

- Three episodes, about 8 to 12 minutes each.
- Fixed protagonist: Mizuki.
- Romance routes: Rin, Haruto, or Reina.
- Supporting ensemble: Sora, Kaede, Ren, and Kaito.
- Rating: 13+.
- Tone: quiet, hopeful, funny in small bursts, emotionally direct by the finale.
- Visual language: dusk pinks, seaside blues, warm restaurant gold.

## Central promise

Every episode takes place on one evening and turns one of Koi no Yokan's existing date locations into a chapter of the same mystery.

1. Sakura Plaza asks: Who do you trust with unfinished truth?
2. Beach Terrace asks: What would you take into a shared future?
3. La Dolce Vita asks: Can you say what you want before the clock chooses for you?

## Cast

### Mizuki, protagonist

An artist who communicates most easily through unfinished pictures. She has received a three-month residency in another city, but must answer by five o'clock on the third evening. Her flaw is not ambition. It is deciding that silence protects everyone.

### Rin, romance route

Blunt, defensive, and much warmer than she wants anyone to notice. Rin challenges Mizuki to stop treating other people's feelings as fragile objects. Her route is about brave honesty.

### Haruto, romance route

Calm and hard to rattle. Haruto notices what people omit. His route is about allowing uncertainty without becoming passive.

### Reina, romance route

A midnight singer who uses confidence as both art and armor. Reina knows that performance can reveal the truth or hide it. Her route is about being seen without rehearsing the moment.

### Kaito

Host of the final evening and architect of the three-note plan. He never knew the residency details. He only noticed Mizuki quietly arranging her life as if she would vanish.

### Sora and Kaede

The kinetic comic pair of episode two. Their beach race gives Mizuki no time to overthink and turns a private worry into a playful physical objective.

### Ren

The quiet witness. He returns Mizuki's lost sketchbook without opening it and gives the story its moral center: privacy is not the same thing as isolation.

## Season arc

Mizuki receives an unsigned letter asking for three honest evenings. She assumes someone discovered her residency offer. In fact, her friends only noticed her withdrawal. Kaito created the trail to give her a place to speak, not to force a particular decision.

The romantic route begins in episode one. Episode two tests whether Mizuki trusts that person with the real problem. Episode three resolves both the relationship and the residency without treating love and creative ambition as enemies.

## Branch model

The story uses five persistent series variables:

- `route`: `undecided`, `rin`, `haruto`, or `reina`.
- `honesty`: integer starting at `0`.
- `courage`: integer starting at `0`.
- `keepsake`: `none`, `sketchbook`, `mixtape`, or `tickets`.
- `future`: `undecided`, `residency`, `opening`, or `home`.

Branches reconverge at major location changes, keeping production manageable while preserving route-specific dialogue and a meaningful ending.

## Episode one: The Page Left Blank

At Sakura Plaza, Mizuki carries an acceptance letter she cannot answer. A second, unsigned note is tucked inside her sketchbook: "Three evenings. Three places. One honest answer. Start where petals touch water."

The player chooses who to trust first: Rin, Haruto, or Reina. The chosen character meets Mizuki under the blossoms. Each reads her silence differently, but none knows what the real decision is. The first evening ends with a clue pointing to the beach and a promise not to disappear.

Episode turn: Mizuki learns that asking for company is not the same as surrendering control.

## Episode two: What the Tide Kept

At Beach Terrace, Sora and Kaede turn the second clue into a race. Ren returns the sketchbook Mizuki dropped, unopened. The route character arrives, and the player chooses a keepsake that represents what Mizuki wants to share: her art, their memories, or a future trip.

The main trust choice follows. Mizuki can reveal the residency, admit only that a deadline exists, or deflect. The route character does not demand an answer. They ask only not to be erased from the question.

Episode turn: Mizuki learns that a future can be negotiated, not guessed alone.

## Episode three: Say It Before Five

Kaito gathers everyone at La Dolce Vita. Reina performs over "Cherry Promenade." Kaito reveals that he wrote the three notes after the group noticed Mizuki withdrawing. Nobody knew the secret.

Mizuki finally says it aloud: she was accepted to a residency, and the deadline is five o'clock. The selected keepsake frames her request. The player chooses a future:

- `residency`: accept and refuse to disappear from the relationship.
- `opening`: accept and invite the route character to opening weekend.
- `home`: decline because Mizuki genuinely chooses to build her next body of work here, not because she is afraid to leave.

Episode turn: the victory is not a city. It is making an honest choice in company.

## Ending logic

### Open Sky

Triggered by `future = residency`. Mizuki accepts the residency and asks for a real attempt at staying connected. High honesty produces an immediate yes. Lower honesty produces a cautious, still hopeful beginning.

### Two Tickets

Triggered by `future = opening`. Mizuki accepts and asks her route character to come to opening weekend. If the keepsake is `tickets`, the invitation becomes a visual callback.

### Here, On Purpose

Triggered by `future = home`. Mizuki declines the offer because she has a concrete local project she wants to make. The route character checks that this is desire, not fear. Mizuki answers clearly.

### Romantic payoff

Each route ends with a distinct expression of affection:

- Rin: an irritated, unmistakable hand-hold and a warning never to vanish politely again.
- Haruto: a shared plan written into Mizuki's sketchbook, with dates instead of promises.
- Reina: one unrehearsed kiss after the music stops.

## Continuation hooks

- A second season can follow the residency, the local gallery project, or opening weekend.
- Sora and Kaede can carry a comedy-focused side episode.
- Ren can anchor a slower, contemplative route.
- Kaito's role as social orchestrator naturally supports an anthology of connected dates.
