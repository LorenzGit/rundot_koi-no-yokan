# Video Studio import

Import this file into RUN Video Studio:

`koi-no-yokan-three-evenings-lorebot.zip`

Do not compress the parent Story Studio folder. That folder is a human-readable
handoff; this ZIP is the native Lorebot world archive expected by Video Studio.

## Included

- One `manifest.json` using Lorebot world schema v1.
- Eight existing character portraits.
- Three existing location references.
- Fourteen existing prop references.
- Existing cover and visual-style references.
- Three linear, vertical episodes targeting about 90 seconds each.
- `VIDEO_STORY.md`, the readable story treatment represented by the manifest.

Video Studio does not import Ink branches. This video adaptation uses Rin and
Haruto as its sole romance. Rin initially dislikes Haruto and gets angry after
he ruins her festival schedule; respect and vulnerability gradually turn that
conflict into love. Kaede and Kaito are active supporting characters in every
episode. The parent Story Studio package is separate and is not included here.

Every scene contains spoken dialogue. Dialogue deliberately uses strong pauses
such as `...` and `—`; preserve that punctuation when editing because it slows
the Video Studio voice generator.

## Rebuild

From this directory, run:

```sh
node build-lorebot-world.mjs
```

The builder copies the source assets, computes asset sizes and SHA-256 hashes,
validates IDs, paths, references, and durations, then creates the ZIP.
