# Mandy Start (browser extension)

Lets the [team start page](https://aico-systems.github.io/StartPage) learn from your whole browser history instead of only the links you open from it. With it, the page lists the sites you use most that aren't on it yet (Frequent) and folds away the links you never open (Rarely opened).

The page asks, the extension reads the last 90 days of history and answers with a per-site summary (address, title, visit count, last visit). The summary stays in your browser's storage for the page. Nothing is sent anywhere.

## Install

**Zen** (or Firefox Developer Edition / Nightly): open `about:config`, set `xpinstall.signatures.required` to `false`, then open the start page's Settings → Learning → *Install for Zen or Firefox* (or open `https://aico-systems.github.io/StartPage/extension/mandy-start.xpi`). Regular Firefox only installs signed extensions; it would need signing through addons.mozilla.org first.

**Chrome, Brave, Edge, Arc**: download this folder (or clone the repo), open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked* and pick the `extension` folder.

## Changing it

Edit the files here, bump `version` in `manifest.json`, and rebuild the Firefox package from the repo root:

```sh
tools/pack-extension.sh
```
