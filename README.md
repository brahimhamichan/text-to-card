# text-to-card

Local CLI that turns text into auto-fitted 1920x1080 PNG cards. Uses Sharp only. No browser, backend, or idle process.

```sh
npm install
npm link

text-to-card title "This is a test"
text-to-card text "A longer block of text" -o text.png
text-to-card description "Title" "Supporting description" -o description.png
text-to-card bullets "First point" "Second point" "Third point" -o bullets.png
```

Output defaults to `card.png`. Every template fits its text inside safe margins.
