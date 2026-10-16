// The link directory: what each person uses most and isn't listed yet, the team's sections, their own,
// and at the end what they rarely open. Typing in the search box filters it.

import { hideSuggestion, model, recordVisit, siteKey, startLearning } from './learn.js';
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
let quietOpen = false;

function markFor(host) {
    const hit = MARK_HOSTS.find(([pattern]) =>
        pattern.endsWith('.') ? host.startsWith(pattern) : host === pattern || host.endsWith(`.${pattern}`));
    return hit && MARKS[hit[1]];
}

/** The tile before a link's name: the brand's logo, Mandy's for our own hosts, or the initial. */
export function markHtml(url, name, slug) {
    const host = hostOf(url);
    const mark = (slug && MARKS[slug]) || markFor(host);
    if (mark?.img) return `<span class="mark"><img src="${mark.img}" alt=""></span>`;
    if (mark) {
        const tone = mark.dark ? ' inky' : mark.light ? ' pale' : '';
        return `<span class="mark${tone}" style="--brand:#${mark.hex}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${mark.path}"/></svg></span>`;
    }
    if (OWN_HOSTS.test(host)) return '<span class="mark"><img src="assets/mandy.svg" alt=""></span>';
    const initial = (name || host || '?').trim().charAt(0).toUpperCase();
    return `<span class="mark initial">${esc(initial)}</span>`;
}

function linkHtml(link, { dismissable = false } = {}) {
    const target = settings.linkBehavior === 'same' ? '' : ' target="_blank" rel="noopener noreferrer"';
    const key = `${link.name} ${link.note ?? ''} ${hostOf(link.url)}`.toLowerCase();
    const dismiss = dismissable
        ? `<button type="button" class="dismiss" data-site="${esc(siteKey(link.url))}" aria-label="Don’t suggest ${esc(link.name)}" title="Don’t suggest this">×</button>`
        : '';
    return `
        <li><a class="link" href="${esc(safeUrl(link.url))}"${target} data-key="${esc(key)}">
            ${markHtml(link.url, link.name, link.mark)}
            <span class="name">${esc(link.name)}</span>
            ${link.note ? `<span class="note">${esc(link.note)}</span>` : ''}
        </a>${dismiss}</li>`;
}

const groupHtml = (heading, items, i, { className = '', dismissable = false } = {}) => `
    <section class="group ${className}" style="--i: ${i}">
        <h2>${heading}</h2>
        <ul>${items.map((link) => linkHtml(link, { dismissable })).join('')}</ul>
    </section>`;

// The same name on the same site is the same link, whichever subdomain it uses.
const baseDomain = (url) => hostOf(url).split('.').slice(-2).join('.');
const sameLink = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && baseDomain(a.url) === baseDomain(b.url);

function render() {
    // Links still being filled in (no name or no address yet) wait in settings until they are complete.
    const complete = (link) => link.name.trim() && hostOf(link.url);
    const teamLinks = TEAM.flatMap((section) => section.links);
    const sections = [
        ...TEAM,
        ...settings.personal.map((section) => ({
            ...section,
            links: section.links.filter((link) => !teamLinks.some((team) => sameLink(team, link))),
        })),
    ].map((section) => ({ ...section, links: section.links.filter(complete) }));

    const known = new Set(sections.flatMap((section) => section.links.map((link) => siteKey(link.url))));
    const { frequent, quiet, gone } = model(known);

    // Links whose address is gone leave the page; links this person never opens fold away at the end.
    const quietLinks = [];
    const shown = sections.map((section) => ({
        ...section,
        links: section.links.filter((link) => {
            if (gone.has(hostOf(link.url))) return false;
            if (!quiet.has(siteKey(link.url))) return true;
            quietLinks.push(link);
            return false;
        }),
    })).filter((section) => section.links.length);

    let i = 0;
    root.innerHTML = [
        frequent.length ? groupHtml('Frequent', frequent, i++, { className: 'frequent', dismissable: true }) : '',
        ...shown.map((section) => groupHtml(esc(section.name), section.links, i++)),
        quietLinks.length
            ? groupHtml(`<button type="button" class="fold" aria-expanded="${quietOpen}">Rarely opened <span>${quietLinks.length}</span></button>`,
                quietLinks, i++, { className: `quiet${quietOpen ? ' open' : ''}` })
            : '',
    ].join('');

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

/** Open a URL the way links open; `newTab` forces a new tab. The visit is remembered either way. */
export function openUrl(url, { newTab = false, title = '' } = {}) {
    recordVisit(url, title);
    if (settings.linkBehavior === 'same' && !newTab) {
        window.location.href = url;
    } else {
        Object.assign(document.createElement('a'), { href: url, target: '_blank', rel: 'noopener' }).click();
    }
}

export function initDirectory() {
    root = $('#directory');
    render();

    // The groups arrive once, on load; later re-renders don't replay it.
    root.classList.add('intro');
    setTimeout(() => root.classList.remove('intro'), 1500);

    // Every link opened from here, in this tab or another, teaches the page what this person uses.
    const remember = (e) => {
        const link = e.target.closest('.link');
        if (link && (e.type === 'click' || e.button === 1)) recordVisit(link.href, link.querySelector('.name').textContent);
    };
    root.addEventListener('click', remember);
    root.addEventListener('auxclick', remember);

    root.addEventListener('click', (e) => {
        if (e.target.closest('.dismiss')) {
            hideSuggestion(e.target.closest('.dismiss').dataset.site);
            render();
        } else if (e.target.closest('.fold')) {
            quietOpen = !quietOpen;
            render();
        }
    });

    const rerender = perFrame(render);
    on(['personal', 'linkBehavior', 'learning'], rerender);
    const allUrls = () => [...TEAM, ...settings.personal].flatMap((section) => section.links.map((link) => link.url));
    startLearning(allUrls, rerender);
}
