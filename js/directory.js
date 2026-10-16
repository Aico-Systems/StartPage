// The link directory: team sections, then personal ones. Typing in the search box filters it.

import { MARK_HOSTS, MARKS } from './marks.js';
import { hostOf, on, settings } from './store.js';
import { TEAM } from './team.js';
import { $, $$, esc, perFrame, safeUrl } from './util.js';

const OWN_HOSTS = /(^|\.)(aicoflow\.com|insight-proglove\.com)$/;

let root;
let links = [];
let matches = [];
let selected = -1;
let query = '';

function markFor(host) {
    const hit = MARK_HOSTS.find(([pattern]) =>
        pattern.endsWith('.') ? host.startsWith(pattern) : host === pattern || host.endsWith(`.${pattern}`));
    return hit && MARKS[hit[1]];
}

/** The tile before a link's name: the brand's mark, our own logo for our own hosts, or the initial. */
export function markHtml(url, name) {
    const host = hostOf(url);
    const mark = markFor(host);
    if (mark) {
        const tone = mark.dark ? ' inky' : mark.light ? ' pale' : '';
        return `<span class="mark${tone}" style="--brand:#${mark.hex}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${mark.path}"/></svg></span>`;
    }
    if (OWN_HOSTS.test(host)) return '<span class="mark"><img src="assets/logo-64.png" alt=""></span>';
    const initial = (name || host || '?').trim().charAt(0).toUpperCase();
    return `<span class="mark initial">${esc(initial)}</span>`;
}

function linkHtml(link) {
    const target = settings.linkBehavior === 'same' ? '' : ' target="_blank" rel="noopener noreferrer"';
    const key = `${link.name} ${link.note ?? ''} ${hostOf(link.url)}`.toLowerCase();
    return `
        <li><a class="link" href="${esc(safeUrl(link.url))}"${target} data-key="${esc(key)}">
            ${markHtml(link.url, link.name)}
            <span class="name">${esc(link.name)}</span>
            ${link.note ? `<span class="note">${esc(link.note)}</span>` : ''}
        </a></li>`;
}

function render() {
    // Links still being filled in (no name or no address yet) wait in settings until they are complete.
    const complete = (link) => link.name.trim() && hostOf(link.url);
    const sections = [...TEAM, ...settings.personal]
        .map((section) => ({ ...section, links: section.links.filter(complete) }))
        .filter((section) => section.links.length);
    root.innerHTML = sections.map((section, i) => `
        <section class="group" style="--i: ${i}">
            <h2>${esc(section.name)}</h2>
            <ul>${section.links.map(linkHtml).join('')}</ul>
        </section>`).join('');
    links = $$('.link', root);
    filterLinks(query);
}

/** Dim links whose name, note or domain doesn't contain `text`. Returns the number of matches. */
export function filterLinks(text) {
    select(-1);
    query = text.trim().toLowerCase();
    root.classList.toggle('filtering', query !== '');
    matches = links.filter((link) => {
        const hit = query !== '' && link.dataset.key.includes(query);
        link.classList.toggle('match', hit);
        return hit;
    });
    return matches.length;
}

function select(index) {
    matches[selected]?.classList.remove('selected');
    selected = index;
    matches[selected]?.classList.add('selected');
}

/** Step through the matches (wrapping). Returns false when nothing matches. */
export function moveSelection(step) {
    if (!matches.length) return false;
    const from = selected === -1 && step < 0 ? 0 : selected;
    select((from + step + matches.length) % matches.length);
    return true;
}

export const selectedLink = () => matches[selected] ?? null;
export const matchCount = () => matches.length;

/** Open a URL the way links open; `newTab` forces a new tab. */
export function openUrl(url, { newTab = false } = {}) {
    if (settings.linkBehavior === 'same' && !newTab) {
        window.location.href = url;
    } else {
        Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' }).click();
    }
}

export function initDirectory() {
    root = $('#directory');
    render();

    // The groups arrive once, on load; edits made later re-render without replaying it.
    root.classList.add('intro');
    setTimeout(() => root.classList.remove('intro'), 1500);

    on(['personal', 'linkBehavior'], perFrame(render));
}
