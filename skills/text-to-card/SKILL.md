---
name: text-to-card
description: Generate local 16:9 PNG cards with auto-fitted titles, body text, title-and-description layouts, or bullet lists. Use when asked to turn text into a social card, slide-like image, report summary image, announcement image, or other simple text-based PNG without a browser or backend.
---

# Text To Card

Run `text-to-card` with one template and an output path. Keep each bullet as a separate quoted argument.

```sh
text-to-card title "This is a test" -o title.png
text-to-card text "Longer body text" -o text.png
text-to-card description "Title" "Supporting description" -o description.png
text-to-card bullets "First point" "Second point" -o bullets.png
```

Default output is `card.png`. Output is always a 1920x1080 PNG. Text size adapts automatically.

If command is unavailable, run `npm install && npm link` from repository root. Return generated PNG path and preview image when client supports local images.
