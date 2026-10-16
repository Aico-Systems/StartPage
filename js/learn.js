// What the page learns about how each person works, so the team's defaults turn into everyone's own page.
//
// Sources, both kept only in this browser:
//  - what is opened and searched from this page, always;
//  - the browser's own history, when the Mandy Start extension is installed (extension/).
//
// From them come:
//  - frequent: sites and pages someone uses a lot that aren't on the page yet;
//  - quiet: links on the page they haven't opened in a long while (needs the browser history to judge);
//  - gone: links whose address no longer exists in DNS, checked now and then over DNS-over-HTTPS;
//  - searches: how often each search box is used, which orders the engines and teaches new bangs.

import { ask, noteAnswer } from './bridge.js';
import { hostOf, storage } from './store.js';

const VISITS = 'learn.visits';
const SEARCHES = 'learn.searches';
const BROWSING = 'learn.browsing';
const HIDDEN = 'learn.hidden';
const HEALTH = 'learn.health';

const DAY = 86_400_000;
const BROWSING_TTL = 60 * 60 * 1000;
const QUIET_AFTER = 45 * DAY;
const FREQUENT_SITES = 5;
const FREQUENT_COUNT = 8;

const read = (key, fallback) => {
    try { return JSON.parse(storage.get(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => storage.set(key, JSON.stringify(value));

/** One entry per site: the host, plus the port for local servers (localhost:5173 and :5174 are different apps). */
export function siteKey(url) {
    try {
        const { hostname, port, protocol } = new URL(url);
        if (!/^https?:$/.test(protocol)) return '';
        const host = hostname.replace(/^www\./, '');
        return port ? `${host}:${port}` : host;
    } catch {
        return '';
    }
}

/** A search box, independent of what was searched: "https://www.google.com/search?q". */
export function searchKey(origin, path, param) {
    return `${origin.replace('://www.', '://')}${path}?${param}`;
}

// Firefox's frecency buckets: a visit counts for less the older it is.
export const weight = (time) => {
    const age = Date.now() - time;
    if (age < 4 * DAY) return 100;
    if (age < 14 * DAY) return 70;
    if (age < 31 * DAY) return 50;
    if (age < 90 * DAY) return 30;
    return 10;
};

// Not destinations: sign-in hops, mail link scanners, CDNs, search engines' result pages, this page.
const NOT_A_DESTINATION = [
    /^(auth|login|signin|sso|accounts?)\./, /\.signin\.aws$/, /^login\.microsoftonline\.com$/,
    /safelinks|securelinks|atpscan|urldefense|linkprotect/, /(^|\.)static\.|onecdn|cdn\./,
    /^(google\.[a-z.]+|bing\.com|duckduckgo\.com|yandex\.[a-z]+|search\.brave\.com)$/,
    /(^|\.)github\.io$/,
];
const isDestination = (key) => !NOT_A_DESTINATION.some((pattern) => pattern.test(key.split(':')[0]));

// ---- names ----

// Sites whose page titles don't name them.
const SITE_NAMES = [
    [/console\.aws\.amazon\.com$/, 'AWS Console'],
    [/(^|\.)aws\.amazon\.com$|awsapps\.com$/, 'AWS'],
    [/sapbydesign\.com$/, 'SAP ByDesign'],
    [/(^|\.)sharepoint\.com$/, 'SharePoint'],
    [/^mail\.google\.com$/, 'Gmail'],
];

/** The name a site goes by when its titles don't say it, if we know one. */
export const knownSiteName = (host) => SITE_NAMES.find(([pattern]) => pattern.test(host))?.[1];

const titleParts = (title) => (title ?? '').split(/\s+[-|·—–]\s+/).map((s) => s.trim()).filter(Boolean);
const readsLikeAName = (part) => part.length <= 22 && !/\d/.test(part);

/** A short name for a site: the site part of its page title ("Mail - Nikita - Outlook" → "Outlook"), else its host. */
export function siteName(title, key) {
    const host = key.split(':')[0];
    const known = knownSiteName(host);
    if (known) return known;
    const part = titleParts(title).filter(readsLikeAName).at(-1);
    if (part) return part;
    if (/^(localhost|[\d.]+)$/.test(host)) return key;
    const label = host.split('.').at(-2) ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/** A page's own name and the site it belongs to: "LOG board - Kanban Board - Jira" → ["LOG board", "Jira"]. */
function pageName(title, url) {
    const parts = titleParts(title);
    const site = siteName(title, siteKey(url));
    const own = parts.find((part) => part !== site) ?? parts[0] ?? siteKey(url);
    return [own.length > 32 ? `${own.slice(0, 30)}…` : own, site];
}

// ---- recording ----

/** Note a visit made from this page. */
export function recordVisit(url, title = '') {
    const key = siteKey(url);
    if (!key) return;
    const visits = read(VISITS, {});
    const entry = (visits[key] ??= { url, title, times: [] });
    entry.url = url;
    entry.title = title || entry.title;
    entry.times = [...entry.times, Date.now()].slice(-30);

    // Keep the 300 most recently used sites.
    const keys = Object.keys(visits);
    if (keys.length > 300) {
        keys.sort((a, b) => visits[b].times.at(-1) - visits[a].times.at(-1))
            .slice(300).forEach((k) => delete visits[k]);
    }
    write(VISITS, visits);
}

/** Note a search made from this page, by its search box (see searchKey). */
export function recordSearch(key) {
    const searches = read(SEARCHES, {});
    searches[key] = [...(searches[key] ?? []), Date.now()].slice(-50);
    write(SEARCHES, searches);
}

export function hideSuggestion(key) {
    write(HIDDEN, [...new Set([...read(HIDDEN, []), key])]);
}

export function forget({ hiddenOnly = false } = {}) {
    for (const key of hiddenOnly ? [HIDDEN] : [VISITS, SEARCHES, BROWSING, HIDDEN, HEALTH]) storage.set(key, 'null');
}

// ---- the model the page renders from ----

const browsing = () => read(BROWSING, null);

/** Per-site { url, title, score, last }: from the browser history when there is one, else from this page. */
function sites() {
    const data = browsing();
    if (data?.sites) return data.sites;

    const result = {};
    for (const [key, entry] of Object.entries(read(VISITS, {}))) {
        result[key] = {
            url: entry.url,
            title: entry.title,
            score: entry.times.reduce((sum, time) => sum + weight(time), 0),
            last: entry.times.at(-1),
        };
    }
    return result;
}

/** Every known site as a search candidate: { key, name, url, score }. */
export function knownSites() {
    return Object.entries(sites())
        .filter(([key]) => isDestination(key))
        .map(([key, site]) => ({ key, name: siteName(site.title, key), url: site.url, score: site.score }));
}

/** The pages kept from the last history summary, to search while the extension is busy or absent. */
export const knownPages = () => browsing()?.pages ?? [];

/**
 * Use of each search box, { [searchKey]: { origin, path, param, score } }: the browser history's when
 * there is one (it already contains the searches made here), else the page's own.
 */
export function searchScores() {
    const result = {};
    const data = browsing();
    if (data?.searches) {
        for (const entry of data.searches) {
            const key = searchKey(entry.origin, entry.path, entry.param);
            const score = entry.count * weight(entry.last);
            if (!result[key] || result[key].score < score) result[key] = { ...entry, score };
        }
        return result;
    }
    for (const [key, times] of Object.entries(read(SEARCHES, {}))) {
        const [, origin, path, param] = key.match(/^(https?:\/\/[^/]+)(\/[^?]*)\?(.+)$/) ?? [];
        if (origin) result[key] = { origin, path, param, score: times.reduce((sum, time) => sum + weight(time), 0) };
    }
    return result;
}

/**
 * @param {Set<string>} known  site keys already on the page
 * @param {Set<string>} knownUrls  addresses already on the page
 */
export function model(known, knownUrls = new Set()) {
    const all = sites();
    const hidden = new Set(read(HIDDEN, []));
    const data = browsing();
    const here = siteKey(location.href);
    const fresh = (key) => key !== here && !known.has(key) && !hidden.has(key) && isDestination(key);

    // The sites used most that aren't listed, then the pages people keep returning to on listed ones.
    const frequentSites = Object.entries(all)
        .filter(([key, site]) => fresh(key) && site.score >= 150)
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, FREQUENT_SITES)
        .map(([key, site]) => ({ key, name: siteName(site.title, key), url: site.url }));

    const frequentPages = (data?.pages ?? [])
        .filter((page) => {
            const key = siteKey(page.url);
            return !hidden.has(page.url) && !knownUrls.has(page.url) && key !== here && isDestination(key)
                && page.visits >= 8 && Date.now() - page.last < 30 * DAY;
        })
        .sort((a, b) => b.visits * weight(b.last) - a.visits * weight(a.last))
        .slice(0, FREQUENT_COUNT - frequentSites.length)
        .map((page) => {
            const [name, site] = pageName(page.title, page.url);
            return { key: page.url, name, note: site, url: page.url };
        });

    // Only the browser history can say a link went unused; this page sees just its own clicks.
    const quiet = new Set();
    if (data?.sites && data.total >= 500) {
        for (const key of known) {
            const site = all[key];
            if (!site || Date.now() - site.last > QUIET_AFTER) quiet.add(key);
        }
    }

    const health = read(HEALTH, {});
    const gone = new Set(Object.keys(health).filter((host) => health[host].misses >= 2));

    return {
        frequent: [...frequentSites, ...frequentPages],
        quiet,
        gone,
        source: data?.sites ? 'browser' : 'page',
        at: data?.at ?? 0,
        total: data?.total ?? 0,
        hidden: hidden.size,
    };
}

// ---- the browser history, through the extension ----

async function refreshBrowsing() {
    const cached = browsing();
    if (cached && Date.now() - cached.at < BROWSING_TTL && cached.pages) {
        noteAnswer(cached);
        return false;
    }
    const data = await ask('browsing');
    noteAnswer(data ?? cached);
    if (!data?.sites) return false;

    // Score each site the way the page scores its own visits, and keep the 400 strongest.
    const scored = Object.entries(data.sites)
        .map(([key, site]) => [key, { url: site.url, title: site.title, score: site.visits * weight(site.last), last: site.last }])
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 400);
    write(BROWSING, {
        at: Date.now(),
        total: data.total,
        sites: Object.fromEntries(scored),
        pages: data.pages ?? null,
        searches: data.searches ?? null,
    });
    return true;
}

// ---- links whose address no longer exists ----

const PRIVATE_HOST = /^(localhost|[\d.]+|\[.*\])$|\.(local|lan|internal|home|arpa|test|ts\.net)$/;

async function checkHealth(urls) {
    const health = read(HEALTH, {});
    const hosts = [...new Set(urls.map(hostOf))].filter((host) => host && !PRIVATE_HOST.test(host));
    // A week between checks; a day when the last one missed, to confirm quickly. Misses go first.
    const due = hosts.filter((host) => {
        const last = health[host];
        return !last || Date.now() - last.checked > (last.misses ? DAY : 7 * DAY);
    }).sort((a, b) => (health[b]?.misses ?? 0) - (health[a]?.misses ?? 0)).slice(0, 10);
    if (!due.length) return false;

    let changed = false;
    await Promise.all(due.map(async (host) => {
        try {
            const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
                { headers: { accept: 'application/dns-json' } });
            const { Status } = await response.json();
            const misses = Status === 3 ? (health[host]?.misses ?? 0) + 1 : 0; // 3: NXDOMAIN, the name doesn't exist
            changed ||= (health[host]?.misses ?? 0) >= 2 !== misses >= 2;
            health[host] = { checked: Date.now(), misses };
        } catch {
            // offline or blocked: say nothing about the link
        }
    }));
    write(HEALTH, health);
    return changed;
}

/** Refresh what can change in the background; calls `onChange` when the page should re-render. */
export function startLearning(urls, onChange) {
    const run = async () => {
        const [browsingChanged, healthChanged] = await Promise.all([refreshBrowsing(), checkHealth(urls())]);
        if (browsingChanged || healthChanged) onChange();
    };
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
    idle(run);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) idle(run);
    });
}
