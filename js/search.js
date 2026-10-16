// The search box, as a launcher: as you type it lists your links, the sites you use, your open tabs and
// pages from your history (the last two through the extension), next to a search in your engine.
// Engines are ordered by how much each is used, and sites you search often become !bangs of their own.

import { ask, can } from './bridge.js';
import { filterLinks, highlight, linkEntries, linkScore, markFor, markHtml, openUrl } from './directory.js';
import { knownPages, knownSiteName, knownSites, recordSearch, searchKey, searchScores, siteKey, siteName, weight } from './learn.js';
import { isStrong, score } from './match.js';
import { hostOf, on, set, settings } from './store.js';
import { TEAM } from './team.js';
import { $, esc } from './util.js';

export const ENGINES = {
    google: { name: 'Google', bang: 'g', url: 'https://www.google.com/search?q=' },
    duckduckgo: { name: 'DuckDuckGo', bang: 'ddg', url: 'https://duckduckgo.com/?q=' },
    github: { name: 'GitHub', bang: 'gh', url: 'https://github.com/search?q=' },
    youtube: { name: 'YouTube', bang: 'yt', url: 'https://www.youtube.com/results?search_query=' },
    wikipedia: { name: 'Wikipedia', bang: 'w', url: 'https://en.wikipedia.org/wiki/Special:Search?search=' },
    perplexity: { name: 'Perplexity', bang: 'p', url: 'https://www.perplexity.ai/search?q=' },
    claude: { name: 'Claude', bang: 'c', url: 'https://claude.ai/new?q=' },
    yandex: { name: 'Yandex', bang: 'ya', url: 'https://yandex.com/search/?text=' },
    bing: { name: 'Bing', bang: 'b', url: 'https://www.bing.com/search?q=' },
    amazon: { name: 'Amazon', bang: 'a', url: 'https://www.amazon.de/s?k=' },
    archive: { name: 'Internet Archive', bang: 'ia', url: 'https://archive.org/search?query=' },
};

// "github.com/x", "localhost:5173", "10.0.0.2:8080", "box.tail1234.ts.net" go straight to the address.
const TLDS = 'com|org|net|io|dev|app|ai|co|de|eu|me|sh|so|gg|tv|xyz|info|uk|us|ru|fr|ch|at|nl|cloud|page|site|tech|local|lan|internal|home|arpa';
const ADDRESS = new RegExp(
    `^(?:localhost|\\d{1,3}(?:\\.\\d{1,3}){3}|(?:[\\w-]+\\.)+(?:${TLDS}))(?::\\d+)?(?:[/?#]\\S*)?$`, 'i');
const HAS_SCHEME = /^[a-z][\w+.-]*:\/\/\S+$/i;

const COMMANDS = {
    settings: () => $('#settings-open').click(),
    dark: () => set('appearance', 'dark'),
    light: () => set('appearance', 'light'),
};

const LEARNED_MIN = 300; // about three searches in the last few days, or more spread out
const MAX_ENGINES = 6;
const MAX_RESULTS = 7;
const MATCH = 55;

let input;
let list;
let current;
let chosenThisVisit = false;
let engineRow = [];
let engineScore = {};
let learned = []; // site searches learned from use: { key, name, bang, url, host }
let rows = [];
let selected = 0;
let extra = { tabs: [], pages: [] };
let queryToken = 0;
let queryTimer;

// ---- engines, and searches learned from use ----

function boxOf(url) {
    const parsed = new URL(url);
    return { origin: parsed.origin.replace('://www.', '://'), path: parsed.pathname, param: [...parsed.searchParams.keys()].at(-1) };
}

/** Recompute engine order and learned searches from how this person searches. */
function learnEngines() {
    const usage = Object.values(searchScores());
    const claimed = new Set();
    engineScore = {};
    for (const [id, engine] of Object.entries(ENGINES)) {
        const box = boxOf(engine.url);
        engineScore[id] = usage
            .filter((entry) => entry.origin.replace('://www.', '://') === box.origin && entry.param === box.param && entry.path.startsWith(box.path))
            .reduce((sum, entry) => {
                claimed.add(entry);
                return sum + entry.score;
            }, 0);
    }

    const teamLinks = TEAM.flatMap((section) => section.links);
    const taken = new Set(Object.values(ENGINES).flatMap((engine) => [engine.bang, engine.name.toLowerCase()]));
    const byName = new Map();
    for (const entry of usage) {
        const host = new URL(entry.origin).hostname.replace(/^www\./, '');
        if (claimed.has(entry) || entry.score < LEARNED_MIN || /^(localhost|[\d.]+)$/.test(host)) continue;
        // Named after the team's link to that part of the site, else after the site itself.
        const team = teamLinks
            .filter((link) => hostOf(link.url) === host && entry.path.startsWith(new URL(link.url).pathname.replace(/\/$/, '')))
            .sort((a, b) => b.url.length - a.url.length)[0];
        const name = team?.name ?? knownSiteName(host) ?? markFor(host)?.title ?? siteName('', host);
        const bang = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!bang || taken.has(bang) || (byName.get(name)?.score ?? 0) >= entry.score) continue;
        byName.set(name, {
            key: searchKey(entry.origin, entry.path, entry.param),
            name, bang, host, score: entry.score,
            url: `${entry.origin}${entry.path}?${entry.param}=`,
        });
    }
    learned = [...byName.values()].sort((a, b) => b.score - a.score).slice(0, 8);

    const optOut = new Set(settings.engineOptOut);
    const enabled = settings.enabledEngines.filter((id) => ENGINES[id]);
    const extraEngines = Object.keys(ENGINES).filter((id) => !enabled.includes(id) && !optOut.has(id) && engineScore[id] >= LEARNED_MIN);
    const order = [...enabled, ...extraEngines];
    engineRow = order
        .sort((a, b) => engineScore[b] - engineScore[a] || order.indexOf(a) - order.indexOf(b))
        .filter((id, i) => enabled.includes(id) || i < MAX_ENGINES);
}

/** For settings: which engines show, how much each is used, and the learned searches. */
export const engineState = () => ({ row: engineRow, scores: engineScore, learned });

export function setEngine(id, { chosen = false } = {}) {
    if (!engineRow.includes(id)) return;
    current = id;
    if (chosen) {
        chosenThisVisit = true;
        if (settings.preferredEngine !== id) set('preferredEngine', id);
    }
    input.placeholder = `Search ${ENGINES[id].name}, or find a link, tab or page`;
    for (const button of $('#engines').children) button.setAttribute('aria-pressed', button.dataset.engine === id);
    if (input.value) update();
}

function renderEngines() {
    learnEngines();
    $('#engines').innerHTML = engineRow.map((id, i) => `
        <button type="button" data-engine="${id}" title="${esc(ENGINES[id].name)}, key ${i + 1}">${esc(ENGINES[id].name)}</button>`).join('');
    // The engine used most leads, unless one was picked during this visit.
    const used = engineRow.some((id) => engineScore[id] > 0);
    const start = chosenThisVisit && engineRow.includes(current) ? current
        : used ? engineRow[0]
        : engineRow.includes(settings.preferredEngine) ? settings.preferredEngine : engineRow[0];
    setEngine(start);
}

// ---- turning what's typed into rows ----

const engineTarget = (id) => ({ ...ENGINES[id], key: searchKey(...Object.values(boxOf(ENGINES[id].url))), host: hostOf(ENGINES[id].url) });
const allTargets = () => [...Object.keys(ENGINES).map(engineTarget), ...learned];

function searchRow(target, query) {
    return {
        kind: 'search',
        label: `Search ${target.name}`,
        detail: query,
        url: target.url + encodeURIComponent(query),
        key: target.key,
        mark: markHtml(`https://${target.host}/`, target.name),
    };
}

/** "!gh x", "!conf x" (a bang or the start of an engine's name): the engine and the rest. */
function bangOf(text) {
    const match = text.match(/^!(\S+)\s*(.*)$/);
    if (!match) return null;
    const word = match[1].toLowerCase();
    const targets = allTargets();
    const target = targets.find((t) => t.bang === word)
        ?? targets.find((t) => t.bang.startsWith(word) || t.name.toLowerCase().startsWith(word));
    return target ? { target, rest: match[2] } : null;
}

/** "youtube lofi", "confluence pool car": the first word names an engine; offered, never assumed. */
function keywordOf(text) {
    const [first, ...rest] = text.split(/\s+/);
    if (!rest.length || first.length < 2) return null;
    const word = first.toLowerCase();
    const target = allTargets().find((t) => t.bang === word || t.name.toLowerCase().replace(/\s+/g, '').startsWith(word));
    return target ? { target, rest: rest.join(' ') } : null;
}

function addressOf(text) {
    if (HAS_SCHEME.test(text)) return text;
    if (ADDRESS.test(text)) return (/^(localhost|\d)/.test(text) ? 'http://' : 'https://') + text;
    return null;
}

function buildRows(text) {
    const query = text.trim();
    if (!query || query.startsWith(':')) return [];

    const bang = bangOf(query);
    if (bang) {
        return bang.rest
            ? [searchRow(bang.target, bang.rest)]
            : [{ kind: 'address', label: bang.target.name, detail: 'Open', url: new URL(bang.target.url).origin, mark: markHtml(bang.target.url, bang.target.name) }];
    }

    // One row per destination: the same address, or the same title on the same site (an open tab wins).
    const candidates = [];
    const seen = new Set();
    const add = (row) => {
        const keys = [row.url, row.kind === 'link' ? null : `${hostOf(row.url)}|${row.label.toLowerCase()}`].filter(Boolean);
        if (keys.some((key) => seen.has(key))) return;
        keys.forEach((key) => seen.add(key));
        candidates.push(row);
    };

    for (const tab of extra.tabs) {
        const s = score(query, [[tab.title, 0.9], [hostOf(tab.url), 0.8]]);
        if (s >= MATCH) add({ kind: 'tab', label: tab.title || hostOf(tab.url), detail: 'Switch to tab', url: tab.url, tab, score: s + 10, mark: markHtml(tab.url, tab.title) });
    }
    for (const link of linkEntries()) {
        const s = linkScore(query, link);
        if (s >= MATCH) add({ kind: 'link', label: link.name, detail: link.note ?? hostOf(link.url), url: link.url, score: s + 8, mark: markHtml(link.url, link.name, link.mark) });
    }
    const listed = new Set(linkEntries().map((link) => siteKey(link.url)));
    for (const site of knownSites()) {
        if (listed.has(site.key)) continue;
        const s = score(query, [[site.name, 1], [site.key, 0.8]]);
        if (s >= MATCH) add({ kind: 'site', label: site.name, detail: site.key, url: site.url, score: s + 2 + Math.log10(1 + site.score), mark: markHtml(site.url, site.name) });
    }
    for (const page of extra.pages.length ? extra.pages : knownPages()) {
        let path = '';
        try { path = decodeURIComponent(new URL(page.url).pathname); } catch { /* keep empty */ }
        const s = score(query, [[page.title, 0.9], [hostOf(page.url), 0.7], [path, 0.5]]);
        if (s >= MATCH) add({ kind: 'page', label: page.title || page.url, detail: hostOf(page.url), url: page.url, score: s + Math.log10(1 + page.visits * weight(page.last)), mark: markHtml(page.url, page.title) });
    }
    candidates.sort((a, b) => b.score - a.score);

    const search = searchRow(engineTarget(current), query);
    const keyword = keywordOf(query);
    const keywordRow = keyword && keyword.target.key !== search.key ? [searchRow(keyword.target, keyword.rest)] : [];
    const address = addressOf(query);

    if (address) return [{ kind: 'address', label: query, detail: 'Open address', url: address, mark: markHtml(address, query) }, search, ...candidates];
    // A clear hit on something you open ("git" → GitHub, "tci" → Travis CI) goes first, like the address bar's autofill.
    const [top, ...rest] = candidates;
    if (top && top.kind !== 'page' && isStrong(query, top.label)) return [top, search, ...keywordRow, ...rest];
    return [search, ...keywordRow, ...candidates];
}

// ---- the list ----

function renderRows() {
    list.hidden = !rows.length;
    list.innerHTML = rows.slice(0, MAX_RESULTS).map((row, i) => `
        <li class="result${i === selected ? ' selected' : ''}" role="option" aria-selected="${i === selected}" data-index="${i}">
            ${row.mark}
            <span class="result-label">${esc(row.label)}</span>
            <span class="result-detail">${esc(row.detail)}</span>
        </li>`).join('');
    input.setAttribute('aria-activedescendant', '');
    highlight(rows[selected]?.kind === 'link' ? rows[selected].url : null);
}

function update() {
    const text = input.value;
    filterLinks(text.trim());
    const previous = rows[selected]?.url;
    rows = buildRows(text);
    const kept = rows.findIndex((row) => row.url === previous);
    selected = kept > 0 && rows[0].kind === 'search' ? kept : 0;
    renderRows();
}

/** Ask the extension for open tabs and history pages matching the text, a moment after typing stops. */
function queryBrowser() {
    clearTimeout(queryTimer);
    const text = input.value.trim();
    if (!can('query') || text.length < 2 || text.startsWith('!') || text.startsWith(':')) {
        extra = { tabs: [], pages: [] };
        return;
    }
    const token = ++queryToken;
    queryTimer = setTimeout(async () => {
        const answer = await ask('query', { text }, 1500);
        if (token !== queryToken || !answer) return;
        extra = { tabs: answer.tabs ?? [], pages: answer.pages ?? [] };
        update();
    }, 80);
}

function clear() {
    input.value = '';
    extra = { tabs: [], pages: [] };
    queryToken++;
    update();
}

async function run(row, { newTab = false } = {}) {
    if (!row) return;
    if (row.kind === 'search') recordSearch(row.key);
    if (row.kind === 'tab') {
        const switched = await ask('switch', { tabId: row.tab.id, windowId: row.tab.windowId, closeCaller: history.length <= 1 }, 1500);
        if (switched) {
            clear();
            return;
        }
    }
    openUrl(row.url, { newTab, title: row.kind === 'search' ? '' : row.label });
}

function submit(e) {
    const command = input.value.trim().toLowerCase().match(/^:(.+)$/)?.[1];
    if (command && COMMANDS[command]) {
        COMMANDS[command]();
        clear();
        return;
    }
    run(rows[selected], { newTab: e.ctrlKey || e.metaKey });
}

function moveSelection(step) {
    if (rows.length < 2) return false;
    const count = Math.min(rows.length, MAX_RESULTS);
    selected = (selected + step + count) % count;
    renderRows();
    return true;
}

// ---- keys ----

function onPageKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#settings').open || e.target.closest('input, textarea, select, [contenteditable]')) return;

    if (e.key === '/') {
        e.preventDefault();
        input.focus();
    } else if (/^[1-9]$/.test(e.key)) {
        const id = engineRow[Number(e.key) - 1];
        if (id) setEngine(id, { chosen: true });
    } else if (e.key === 'Escape') {
        clear();
    } else if (e.key.length === 1 && e.key !== ' ') {
        // Type anywhere: moving focus during keydown makes the character land in the box.
        input.focus();
    }
}

export function initSearch() {
    input = $('#search');
    list = $('#results');
    renderEngines();

    input.addEventListener('input', () => {
        update();
        queryBrowser();
    });
    input.addEventListener('keydown', (e) => {
        let step = 0;
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) step = 1;
        if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) step = -1;

        if (e.key === 'Enter') {
            e.preventDefault();
            submit(e);
        } else if (step && input.value && moveSelection(step)) {
            e.preventDefault();
        } else if (e.key === 'Escape') {
            clear();
            input.blur();
        }
    });
    input.addEventListener('focus', () => {
        if (input.value) list.hidden = !rows.length;
    });
    input.addEventListener('blur', () => {
        list.hidden = true;
    });

    // Rows act on mousedown so the box keeps focus; a middle or Ctrl click opens in a new tab.
    list.addEventListener('mousedown', (e) => {
        const row = e.target.closest('.result');
        if (!row) return;
        e.preventDefault();
        run(rows[row.dataset.index], { newTab: e.button === 1 || e.ctrlKey || e.metaKey });
    });
    list.addEventListener('mousemove', (e) => {
        const row = e.target.closest('.result');
        if (row && Number(row.dataset.index) !== selected) {
            selected = Number(row.dataset.index);
            renderRows();
        }
    });

    $('#engines').addEventListener('click', (e) => {
        const button = e.target.closest('[data-engine]');
        if (!button) return;
        setEngine(button.dataset.engine, { chosen: true });
        input.focus();
    });

    document.addEventListener('keydown', onPageKey);
    on(['enabledEngines', 'engineOptOut', 'learned', 'learning'], renderEngines);

    if (settings.autoFocusSearch) input.focus();
}
