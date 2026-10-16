// The search box: engines, !bangs, direct addresses, jumping to links, and the page's keyboard shortcuts.

import { filterLinks, moveSelection, openUrl, selectedLink } from './directory.js';
import { on, set, settings } from './store.js';
import { $, esc, setText } from './util.js';

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

let input;
let current;

/** What Enter would do with `text`: [url, what to call it in the hint]. */
function resolve(text) {
    const query = text.trim();
    if (!query) return [null, ''];

    const bang = query.match(/^!(\S+)\s*(.*)$/);
    const engine = bang && Object.values(ENGINES).find((e) => e.bang === bang[1].toLowerCase());
    if (engine) return [bang[2] ? engine.url + encodeURIComponent(bang[2]) : new URL(engine.url).origin, `searches ${engine.name}`];

    if (HAS_SCHEME.test(query)) return [query, 'opens the address'];
    if (ADDRESS.test(query)) return [(/^(localhost|\d)/.test(query) ? 'http://' : 'https://') + query, 'opens the address'];

    const fallback = ENGINES[current] ?? ENGINES.google;
    return [fallback.url + encodeURIComponent(query), ''];
}

function updateHint(matches) {
    const link = selectedLink();
    const [, action] = resolve(input.value);
    let hint = '';
    if (link) hint = `Enter opens ${link.querySelector('.name').textContent}`;
    else if (action) hint = `Enter ${action}`;
    else if (matches) hint = matches === 1 ? 'Tab picks the link' : `Tab picks one of ${matches} links`;
    setText($('#search-hint'), hint);
}

function clear() {
    input.value = '';
    updateHint(filterLinks(''));
}

function submit(e) {
    const command = input.value.trim().toLowerCase().match(/^:(.+)$/)?.[1];
    if (command && COMMANDS[command]) {
        COMMANDS[command]();
        clear();
        return;
    }
    const link = selectedLink();
    const url = link ? link.href : resolve(input.value)[0];
    const title = link ? link.querySelector('.name').textContent : '';
    if (url) openUrl(url, { newTab: e.ctrlKey || e.metaKey, title });
}

export function setEngine(id) {
    if (!ENGINES[id] || !settings.enabledEngines.includes(id)) return;
    current = id;
    if (settings.preferredEngine !== id) set('preferredEngine', id);
    input.placeholder = `Search ${ENGINES[id].name}, or type a link’s name`;
    for (const button of $('#engines').children) button.setAttribute('aria-pressed', button.dataset.engine === id);
}

function renderEngines() {
    const enabled = settings.enabledEngines.filter((id) => ENGINES[id]);
    $('#engines').innerHTML = enabled.map((id, i) => `
        <button type="button" data-engine="${id}" title="${esc(ENGINES[id].name)}, key ${i + 1}">${esc(ENGINES[id].name)}</button>`).join('');
    setEngine(enabled.includes(settings.preferredEngine) ? settings.preferredEngine : enabled[0]);
}

function onPageKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if ($('#settings').open || e.target.closest('input, textarea, select, [contenteditable]')) return;

    if (e.key === '/') {
        e.preventDefault();
        input.focus();
    } else if (/^[1-9]$/.test(e.key)) {
        const id = settings.enabledEngines[Number(e.key) - 1];
        if (id) setEngine(id);
    } else if (e.key === 'Escape') {
        clear();
    } else if (e.key.length === 1 && e.key !== ' ') {
        // Type anywhere: moving focus during keydown makes the character land in the box.
        input.focus();
    }
}

export function initSearch() {
    input = $('#search');
    renderEngines();

    input.addEventListener('input', () => updateHint(filterLinks(input.value)));
    input.addEventListener('keydown', (e) => {
        let step = 0;
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) step = 1;
        if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) step = -1;

        if (e.key === 'Enter') {
            e.preventDefault();
            submit(e);
        } else if (step && moveSelection(step)) {
            e.preventDefault();
            updateHint(1);
        } else if (e.key === 'Escape') {
            clear();
            input.blur();
        }
    });

    $('#engines').addEventListener('click', (e) => {
        const button = e.target.closest('[data-engine]');
        if (!button) return;
        setEngine(button.dataset.engine);
        input.focus();
    });

    document.addEventListener('keydown', onPageKey);
    on('enabledEngines', renderEngines);

    if (settings.autoFocusSearch) input.focus();
}
