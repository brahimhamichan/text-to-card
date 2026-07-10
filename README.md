# text-to-card

Local CLI that turns text into auto-fitted 1920x1080 PNG cards. Uses Sharp + bundled Inter fonts. No browser, backend, or idle process. Same look on macOS, Linux, and Windows.

```sh
npm install
npm link

text-to-card title "This is a test"
text-to-card text "A longer block of text"
text-to-card description "Title" "Supporting description"
text-to-card bullets "First point" "Second point" "Third point"
```

## Output

Default directory: `cards/`

Default filename:

```text
cards/card_YYYY_MM_DD_HH_mm_ss_<Text_Slug>.png
```

Example:

```text
cards/card_2026_07_10_14_30_45_This_Is_A_Test.png
```

Override with `-o path.png` (parent dirs are created).

## Templates

| Command | Layout |
| --- | --- |
| `title` | Large centered title |
| `text` | Centered body text |
| `description` | Title + description |
| `bullets` | Left-aligned bullet list |

Every template auto-fits text inside safe margins.

## Tests

```sh
npm test          # unit + render checks
npm run test:e2e  # real CLI e2e (writes cards/e2e-gallery/)
npm run test:all  # both
```
