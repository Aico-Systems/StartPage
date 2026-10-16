# Mandy Start (browser extension)

Lets the [team start page](https://aico-systems.github.io/StartPage) learn from your whole browser history instead of only the links you open from it, and search your open tabs. With it the page:

- lists the sites and pages you use most that aren't on it yet (Frequent) and folds away links you never open (Rarely opened);
- orders the search engines by how much you use each, and turns sites you search often into bangs;
- finds open tabs (and switches to them) and pages from your history as you type.

The extension only answers the page: a summary of the last 90 days per site, the most revisited pages and the search boxes you use, and, while you type, matching history pages and open tabs. It runs only on the start page, and nothing is sent anywhere. What the page makes of the answers lives in the page, so improvements arrive without reinstalling.

## Install

**Zen** (or Firefox Developer Edition / Nightly):

1. In `about:config`, set `xpinstall.signatures.required` to `false`.
2. Download [`mandy-start.xpi`](https://aico-systems.github.io/StartPage/extension/mandy-start.xpi) (also in the start page's Settings → Learning).
3. In `about:addons`, open the gear menu, choose *Install Add-on From File…*, pick the file and confirm.

Updating works the same way: install the new file over the old one.

Regular Firefox only installs signed extensions; it would need signing through addons.mozilla.org first.

**Chrome, Brave, Edge, Arc**: download this folder (or clone the repo), open `chrome://extensions`, turn on *Developer mode*, choose *Load unpacked* and pick the `extension` folder.

## Changing it

Edit the files here, bump `version` in `manifest.json`, and rebuild the Firefox package from the repo root:

```sh
tools/pack-extension.sh
```
