# txt2card

<p align="center">
  <img src="assets/icon-256.png" width="128" height="128" alt="txt2card icon" />
</p>

Local CLI that turns text into auto-fitted 1920×1080 PNG cards.

**Site:** [txt2card.pages.dev](https://txt2card.pages.dev)

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
txt2card title-bullets "Title" "First point" "Second point"

# alias
text-to-card title "This is a test"

# custom output path (parent dirs are created)
txt2card title "Hello" -o out/hello.png

# read a value from stdin with "-"
echo "Piped title" | txt2card title -
```

| Command | Layout |
| --- | --- |
| `title` | Large centered title |
| `text` | Centered body text |
| `description` | Title + description (alias `title-description`) |
| `bullets` | Left-aligned bullet list |
| `title-bullets` | Clean title over bullets (alias `list`) |

## Options

| Flag | Description |
| --- | --- |
| `-o, --output <path>` | Output file (parent dirs created) |
| `--theme <name>` | `light` (default), `dark`, `midnight`, `paper` |
| `--bg <color>` | Background color — hex (`#0f172a`) or a named color |
| `--fg <color>` | Text color — hex or named color |
| `--size <preset\|WxH>` | `16:9` (default), `wide`, `square`, `og`, `story`, `portrait`, or e.g. `1600x900` |
| `--logo <path>` | Watermark image placed in the bottom-right corner |
| `-v, --version` | Print version and exit |
| `-h, --help` | Show help |

```sh
# dark square card for Instagram
txt2card title "Ship it" --theme dark --size square

# custom colors + Open Graph size
txt2card description "Launch" "Now available" --bg "#123456" --fg white --size og

# brand a card with a corner logo
txt2card title "Ship it" --logo assets/icon-256.png
```

Auto-named cards never overwrite each other — a `_2`, `_3`, … suffix is added
when a same-second render would collide.

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
- Sub-second renders on a typical laptop (no browser, no server)
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

## Website

Landing page lives in [`site/`](site/). Redeploy:

```sh
npx wrangler pages deploy site --project-name=txt2card
```

## License

MIT. Inter fonts are under the SIL Open Font License — see [`fonts/LICENSE.txt`](fonts/LICENSE.txt).
