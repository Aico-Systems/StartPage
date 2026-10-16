# Mandy start page

The team's new tab page, live at <https://aico-systems.github.io/StartPage> (point New Tab Override, or your browser's home page, at it). It shares its look with the Mandy landing page: blueprint's greys and orange, Archivo, light or dark following the system.

Everyone starts from the same team links, and then each person's page adapts to them (see *Learning*).

Static files, no build step. Pushing to `main` deploys.

## Links

- **Team links** live in [`js/team.js`](js/team.js). Edit, push, and everyone has them on their next tab.
- **Personal links** are added in Settings and stay in that browser. Export/Import in Settings moves them.

Logos come from the link's address: brands from Simple Icons, site icons for the brands it lacks (`assets/marks/`), the Mandy mark for our own domains, otherwise the initial. To add one, put a [Simple Icons](https://simpleicons.org) slug or a site icon with its hosts in `tools/marks.mjs` and run:

```sh
node tools/marks.mjs path/to/node_modules/simple-icons   # e.g. ../Aicoyo/landing/node_modules/simple-icons
```

## Learning

Each person's page reshapes itself around what they use:

- **Frequent** lists the sites they use most that aren't on the page.
- **Rarely opened** folds away links they haven't opened in 45 days.
- Links whose address no longer exists in DNS disappear (checked weekly over DNS-over-HTTPS).

It learns from what's opened through the page, and with the [Mandy Start extension](extension/) from the whole browser history (needed for *Rarely opened*). It all stays in the browser; Settings → Learning shows what it's using and can forget it. The logic is in `js/learn.js`.

## Using it

- Just start typing. Matching links stay lit; <kbd>Tab</kbd> picks one, <kbd>Enter</kbd> opens it.
- `!gh query`, `!yt query`, `!c question` search one engine; the bangs are listed in Settings.
- `localhost:5173`, `10.42.0.1:8080`, `docs.aicoflow.com/api` open directly.
- <kbd>1</kbd>–<kbd>9</kbd> switch engine, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> opens in a new tab, <kbd>/</kbd> focuses the box.
- Click the time to switch between 24- and 12-hour.

Weather comes from [Open-Meteo](https://open-meteo.com) (no key) and is cached for 30 minutes.

## Files

```
index.html         page and settings sheet
css/main.css       all styles
js/boot.js         light/dark and motion, before first paint
js/main.js         entry
js/team.js         the shared links
js/store.js        per-browser settings and personal links, backup
js/directory.js    the link directory, filtering, logos
js/learn.js        frequent sites, rarely opened links, dead addresses
js/now.js          greeting, clock, date, weather
js/search.js       engines, bangs, addresses, keyboard
js/settings.js     settings sheet
js/marks.js        generated brand logos
js/util.js         small DOM helpers
tools/marks.mjs    builds js/marks.js and assets/marks/
tools/pack-extension.sh  builds extension/mandy-start.xpi
extension/         the Mandy Start browser extension
fonts/archivo.woff2
```

Run locally with `python3 -m http.server` (modules need http://).

Started as a fork of Sip by Bryan Gibson.
