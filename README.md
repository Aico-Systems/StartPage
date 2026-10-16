# A.I.C.O StartPage

Browser start page for AICO Systems, served from GitHub Pages at <https://aico-systems.github.io/StartPage> and loaded as the new tab page via the New Tab Override extension. Forked from Sip by Bryan Gibson.

Static files, no build step. Settings live in the browser's `localStorage`; the background image lives in IndexedDB.

## Using it

- Start typing anywhere to search. <kbd>/</kbd> focuses the box, <kbd>1</kbd>–<kbd>9</kbd> switch engines.
- Typing also highlights matching links. <kbd>Tab</kbd> / <kbd>↓</kbd> step through them, <kbd>Enter</kbd> opens one.
- `!gh query`, `!yt query`, `!w query` … search a single engine (bangs are listed in Settings → Search).
- `localhost:5173`, `10.42.0.1:8080`, `github.com/Aico-Systems` open directly.
- <kbd>Ctrl</kbd>+<kbd>Enter</kbd> opens the search or link in a new tab.
- `:settings`, `:theme dark`, `:theme light` run commands.

Weather comes from [Open-Meteo](https://open-meteo.com) (no API key) and is cached for 30 minutes.

## Layout

```
index.html        page shell, settings dialog markup
css/themes.css    color schemes (palette only)
css/main.css      layout and components
js/boot.js        applies the saved theme before first paint
js/main.js        module entry
js/store.js       settings schema, persistence, backup import/export
js/defaults.js    default categories, links, socials, quotes
js/appearance.js  theme attributes, background image
js/widgets.js     greeting, clock, weather, quote, socials, slot placement
js/grid.js        link grid and link filtering
js/search.js      engines, bangs, URL detection, keyboard shortcuts
js/settings.js    settings dialog
js/util.js        DOM helpers
fonts/            JetBrains Mono subsets (Latin + three Nerd Font glyphs)
```

## Development

```sh
python3 -m http.server 8000   # ES modules need http://, not file://
```

Pushing to `main` deploys to GitHub Pages.
