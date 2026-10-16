// The category/link grid, plus "type to find a link" highlighting driven by the search box.

import { data, on, settings } from './store.js';
import { $, $$, esc, iconHtml, perFrame, safeUrl } from './util.js';

const COLORS = ['mauve', 'blue', 'red', 'green', 'peach', 'teal', 'pink', 'yellow'];

let grid;
let cards = [];
let matches = [];
let selected = -1;
let query = '';

function layoutFor(count) {
    if (count === 1) return 'single';
    if (count === 3) return 'three';
    return count % 2 === 0 ? 'even' : 'odd';
}

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function render() {
    const { categories, links } = data;
    const target = settings.linkBehavior === 'same' ? '' : ' target="_blank" rel="noopener noreferrer"';

    // With three categories the biggest one spans two rows next to the other two.
    const sizes = categories.map((c) => links[c.id]?.length ?? 0);
    const tallest = categories.length === 3 ? sizes.indexOf(Math.max(...sizes)) : -1;

    grid.dataset.layout = layoutFor(categories.length);
    grid.innerHTML = categories.map((category, i) => `
        <section class="link-group${i === tallest ? ' is-tallest' : ''}" style="--palette-color: var(--${COLORS[i % COLORS.length]})">
            <h2 class="group-title">${iconHtml(category.icon, 'fa-solid fa-folder')}<span>${esc(category.name)}</span></h2>
            <div class="links">${(links[category.id] ?? []).map((link) => `
                <a class="link-card" href="${esc(safeUrl(link.url))}"${target} data-key="${esc(`${link.name} ${hostOf(link.url)}`.toLowerCase())}">
                    <span class="link-icon">${iconHtml(link.icon)}</span>
                    <span class="link-text">${esc(link.name)}</span>
                </a>`).join('')}
            </div>
        </section>`).join('');

    cards = $$('.link-card', grid);
    filterLinks(query);
}

/** Highlight links whose name or domain contains `text`. Returns the number of matches. */
export function filterLinks(text) {
    query = text.trim().toLowerCase();
    grid.classList.toggle('filtering', query !== '');
    matches = cards.filter((card) => {
        const hit = query !== '' && card.dataset.key.includes(query);
        card.classList.toggle('match', hit);
        return hit;
    });
    select(-1);
    return matches.length;
}

function select(index) {
    cards.forEach((card) => card.classList.remove('selected'));
    selected = index;
    matches[index]?.classList.add('selected');
}

/** Move the highlighted match by `step` (wraps around). Returns false when nothing matches. */
export function moveSelection(step) {
    if (!matches.length) return false;
    const start = selected === -1 && step < 0 ? 0 : selected;
    select((start + step + matches.length) % matches.length);
    return true;
}

export const selectedLink = () => matches[selected] ?? null;

/** Open a URL following the "Open links in" setting; `newTab` forces a new tab for "same tab" users. */
export function openUrl(url, { newTab = false } = {}) {
    const behavior = newTab && settings.linkBehavior === 'same' ? 'new-tab' : settings.linkBehavior;
    if (behavior === 'same') {
        window.location.href = url;
    } else if (behavior === 'new-window') {
        window.open(url, '_blank', 'noopener,noreferrer');
    } else {
        Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' }).click();
    }
}

export function initGrid() {
    grid = $('#links-grid');
    render();

    // Play the entrance once on load, never on re-renders.
    if (!document.documentElement.classList.contains('no-animations')) {
        grid.classList.add('intro');
        setTimeout(() => grid.classList.remove('intro'), 800);
    }

    on(['data', 'linkBehavior'], perFrame(render));

    grid.addEventListener('click', (e) => {
        const card = e.target.closest('.link-card');
        if (!card || settings.linkBehavior !== 'new-window' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        openUrl(card.href);
    });
}
