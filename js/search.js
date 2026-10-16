// Search box: engines, !bangs, direct URLs, link jumping and the global keyboard shortcuts.

import { filterLinks, moveSelection, openUrl, selectedLink } from './grid.js';
import { on, set, settings } from './store.js';
import { $, esc } from './util.js';

export const ENGINES = {
    google: { name: 'Google', bang: 'g', url: 'https://www.google.com/search?q=', icon: 'fa-brands fa-google' },
    duckduckgo: { name: 'DuckDuckGo', bang: 'ddg', url: 'https://duckduckgo.com/?q=', glyph: '\u{F01E5}' },
    github: { name: 'GitHub', bang: 'gh', url: 'https://github.com/search?q=', icon: 'fa-brands fa-github' },
    git: { name: 'Git', bang: 'git', url: 'https://git-scm.com/search/results?search=', icon: 'fa-brands fa-git-alt' },
    youtube: { name: 'YouTube', bang: 'yt', url: 'https://www.youtube.com/results?search_query=', icon: 'fa-brands fa-youtube' },
    bing: { name: 'Bing', bang: 'b', url: 'https://www.bing.com/search?q=', icon: 'fa-brands fa-microsoft' },
    amazon: { name: 'Amazon', bang: 'a', url: 'https://www.amazon.com/s?k=', icon: 'fa-brands fa-amazon' },
    wikipedia: { name: 'Wikipedia', bang: 'w', url: 'https://en.wikipedia.org/wiki/Special:Search?search=', icon: 'fa-brands fa-wikipedia-w' },
    archive: { name: 'Internet Archive', bang: 'ia', url: 'https://archive.org/search?query=', icon: 'fa-solid fa-box-archive' },
    yandex: { name: 'Yandex', bang: 'ya', url: 'https://yandex.com/search/?text=', icon: 'fa-brands fa-yandex' },
};

export const engineIcon = (engine) =>
    engine.glyph ? `<span class="nf-icon">${engine.glyph}</span>` : `<i class="${engine.icon}"></i>`;

// "github.com/x", "localhost:5173", "10.0.0.2:8080", "box.tail1234.ts.net" go straight to the address.
const TLDS = 'com|org|net|io|dev|app|ai|co|de|eu|me|sh|so|gg|tv|xyz|info|uk|us|ru|fr|ch|at|nl|cloud|page|site|tech|local|lan|internal|home|arpa';
const ADDRESS = new RegExp(
    `^(?:localhost|\\d{1,3}(?:\\.\\d{1,3}){3}|(?:[\\w-]+\\.)+(?:${TLDS}))(?::\\d+)?(?:[/?#]\\S*)?$`, 'i');
const HAS_SCHEME = /^[a-z][\w+.-]*:\/\/\S+$/i;

const COMMANDS = {
    settings: () => $('#settings-btn').click(),
    'theme dark': () => set('theme', 'dark'),
    'theme light': () => set('theme', 'light'),
};

let input;
let current;

/** Turn what was typed into a URL, or null when there is nothing to do. */
function resolve(text) {
    const query = text.trim();
    if (!query) return null;

    const bang = query.match(/^!(\S+)\s*(.*)$/);
    const engine = bang && Object.values(ENGINES).find((e) => e.bang === bang[1].toLowerCase());
    if (engine) return bang[2] ? engine.url + encodeURIComponent(bang[2]) : new URL(engine.url).origin;

    if (HAS_SCHEME.test(query)) return query;
    if (ADDRESS.test(query)) return (/^(localhost|\d)/.test(query) ? 'http://' : 'https://') + query;

    return (ENGINES[current] ?? ENGINES.google).url + encodeURIComponent(query);
}

function clear() {
    input.value = '';
    filterLinks('');
}

function submit(e) {
    const text = input.value;
    const command = text.trim().toLowerCase().match(/^:(.+)$/)?.[1];
    if (command && COMMANDS[command]) {
        COMMANDS[command]();
        clear();
        return;
    }
    const link = selectedLink();
    const url = link ? link.href : resolve(text);
    if (url) openUrl(url, { newTab: e.ctrlKey || e.metaKey });
}

export function setEngine(id) {
    if (!ENGINES[id] || !settings.enabledEngines.includes(id)) return;
    current = id;
    if (settings.preferredEngine !== id) set('preferredEngine', id);
    input.placeholder = `Search ${ENGINES[id].name}`;
    for (const button of $('#search-engines').children) {
        const active = button.dataset.engine === id;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active);
    }
}

function renderEngines() {
    const enabled = settings.enabledEngines.filter((id) => ENGINES[id]);
    $('#search-engines').innerHTML = enabled
        .map((id, i) => `
            <button type="button" class="engine" data-engine="${id}" title="${esc(ENGINES[id].name)} (${i + 1})">
                ${engineIcon(ENGINES[id])}
            </button>`)
        .join('');
    setEngine(enabled.includes(settings.preferredEngine) ? settings.preferredEngine : enabled[0]);
    renderHints();
}

function renderHints() {
    const hints = $('#keyboard-hints');
    const count = settings.enabledEngines.length;
    hints.hidden = !settings.showKeyboardHints;
    hints.innerHTML = [
        '<span><kbd>/</kbd> Search</span>',
        count > 1 ? `<span><kbd>1</kbd>–<kbd>${count}</kbd> Engine</span>` : '',
        '<span><kbd>Tab</kbd> Jump to link</span>',
        '<span><kbd>Esc</kbd> Clear</span>',
    ].join('');
}

function onGlobalKey(e) {
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
        // Type anywhere: moving focus during keydown makes the character land in the search box.
        input.focus();
    }
}

export function initSearch() {
    input = $('#search');
    renderEngines();

    input.addEventListener('input', () => filterLinks(input.value));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submit(e);
        } else if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
            if (moveSelection(1)) e.preventDefault();
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
            if (moveSelection(-1)) e.preventDefault();
        } else if (e.key === 'Escape') {
            clear();
            input.blur();
        }
    });

    $('#search-engines').addEventListener('click', (e) => {
        const button = e.target.closest('.engine');
        if (!button) return;
        setEngine(button.dataset.engine);
        input.focus();
    });

    document.addEventListener('keydown', onGlobalKey);
    on('enabledEngines', renderEngines);
    on('showKeyboardHints', renderHints);

    if (settings.autoFocusSearch) input.focus();
}
