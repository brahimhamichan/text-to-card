# txt2card

Local CLI that turns text into auto-fitted 1920×1080 PNG cards.

## Install

```sh
npm i -g txt2card
```

From source:

```sh
git clone https://github.com/brahimhamichan/text-to-card.git
cd text-to-card
npm install && npm link
```

## Commands

Both invoke the same binary:

- `txt2card` (preferred)
- `text-to-card`

## Usage

```sh
txt2card title "This is a test"
txt2card text "A longer block of body text"
txt2card description "Title" "Supporting description"
txt2card bullets "First point" "Second point" "Third point"

# alias
text-to-card title "This is a test"

# custom output path (parent dirs are created)
txt2card title "Hello" -o out/hello.png
```

| Command | Layout |
| --- | --- |
| `title` | Large centered title |
| `text` | Centered body text |
| `description` | Title + description |
| `bullets` | Left-aligned bullet list |

## Output

Default directory: `cards/`

Default filename:

```text
cards/card_YYYY_MM_DD_HH_mm_ss_Slug.png
```

Example:

```text
cards/card_2026_07_10_14_30_45_This_Is_A_Test.png
```

## Features

- Fully local — no browser, backend, or idle process
- Bundled Inter fonts (same look on macOS, Linux, Windows)
- Fixed 1920×1080 PNG
- Text auto-fits inside safe margins

## Requirements

- Node.js >= 20

## Agent skill

Codex and other agents can use [`skills/text-to-card`](skills/text-to-card).

## Development

```sh
npm test          # unit + render checks
npm run test:e2e  # real CLI e2e
npm run test:all  # both
```

## License

MIT. Inter fonts are under the SIL Open Font License — see [`fonts/LICENSE.txt`](fonts/LICENSE.txt).
