---
name: text-to-card
description: Generate local 16:9 PNG cards with auto-fitted titles, body text, title-and-description layouts, or bullet lists. Use when asked to turn text into a social card, slide-like image, report summary image, announcement image, or other simple text-based PNG without a browser or backend.
---

# Text To Card

Prefer the short CLI `txt2card`. The full name `text-to-card` is an alias for the same binary. Keep each bullet as a separate quoted argument.

```sh
txt2card title "This is a test"
txt2card text "Longer body text"
txt2card description "Title" "Supporting description"
txt2card bullets "First point" "Second point"

# also valid
text-to-card title "This is a test"
```

## Output defaults

- Directory: `cards/` (created automatically)
- Filename: `card_YYYY_MM_DD_HH_mm_ss_<Text_Slug>.png`
- Example: `cards/card_2026_07_10_14_30_45_This_Is_A_Test.png`
- Override: `-o path/to/file.png`
- Always 1920x1080 PNG; text size adapts automatically
- Fonts are bundled (Inter) so output matches across machines

Prefer the default path unless the user asks for a specific file. Return the printed absolute path and preview the image when the client supports local images.

If the command is unavailable, install with `npm i -g txt2card` (public package), or from a clone run `npm install && npm link` at the repository root (installs both `txt2card` and `text-to-card`).
