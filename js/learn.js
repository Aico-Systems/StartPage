// What the page learns about how each person works, so the team's defaults turn into everyone's own page.
//
// Sources, both kept only in this browser:
//  - visits made from this page (links clicked, addresses typed), always;
//  - the browser's own history, when the Mandy Start extension is installed (extension/).
//
// From them come three things the directory uses:
//  - frequent: sites someone uses a lot that aren't on the page yet;
//  - quiet: links on the page they haven't opened in a long while (needs the browser history to judge);
//  - gone: links whose address no longer exists in DNS, checked now and then over DNS-over-HTTPS.

import { hostOf, storage } from './store.js';

const VISITS = 'learn.visits';
const BROWSING = 'learn.browsing';
const HIDDEN = 'learn.hidden';
const HEALTH = 'learn.health';

const DAY = 86_400_000;
const BROWSING_TTL = 60 * 60 * 1000;
const QUIET_AFTER = 45 * DAY;
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

// Firefox's frecency buckets: a visit counts for less the older it is.
const weight = (time) => {
    const age = Date.now() - time;
    if (age < 4 * DAY) return 100;
    if (age < 14 * DAY) return 70;
    if (age < 31 * DAY) return 50;
    if (age < 90 * DAY) return 30;
    return 10;
};

// Not destinations: sign-in hops, mail link scanners, CDNs, search result pages, this page.
const NOT_A_DESTINATION = [
    /^(auth|login|signin|sso|accounts?)\./, /\.signin\.aws$/, /^login\.microsoftonline\.com$/,
    /safelinks|securelinks|atpscan|urldefense|linkprotect/, /(^|\.)static\.|onecdn|cdn\./,
    /^(google\.[a-z.]+|bing\.com|duckduckgo\.com|yandex\.[a-z]+|search\.brave\.com)$/,
    /(^|\.)github\.io$/,
];

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

export function hideSuggestion(key) {
    write(HIDDEN, [...new Set([...read(HIDDEN, []), key])]);
}

export function forget({ hiddenOnly = false } = {}) {
    for (const key of hiddenOnly ? [HIDDEN] : [VISITS, BROWSING, HIDDEN, HEALTH]) storage.set(key, 'null');
}

// ---- the model the directory renders from ----

/** Per-site { url, title, score, last } from the browser history when we have it, else from this page. */
function sites() {
    const browsing = read(BROWSING, null);
    if (browsing?.sites) return browsing.sites;

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

// Sites whose page titles don't name them.
const SITE_NAMES = [
    [/console\.aws\.amazon\.com$/, 'AWS Console'],
    [/(^|\.)aws\.amazon\.com$|awsapps\.com$/, 'AWS'],
    [/sapbydesign\.com$/, 'SAP ByDesign'],
    [/(^|\.)sharepoint\.com$/, 'SharePoint'],
];

/** A short name for a site: the site part of its page title ("Mail - Nikita - Outlook" → "Outlook"), else its host. */
function siteName(title, key) {
    const host = key.split(':')[0];
    const known = SITE_NAMES.find(([pattern]) => pattern.test(host));
    if (known) return known[1];
    // The last part of a title that reads like a name, not an ID ("eu-central-1", "#4521").
    const part = (title ?? '').split(/\s+[-|·—–]\s+/).map((s) => s.trim())
        .filter((s) => s && s.length <= 22 && !/\d/.test(s)).at(-1);
    if (part) return part;
    if (/^(localhost|[\d.]+)$/.test(host)) return key;
    const label = host.split('.').at(-2) ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * @param {Set<string>} known  site keys already on the page
 * @returns {{ frequent: {key, name, url}[], quiet: Set<string>, gone: Set<string>,
 *             source: 'browser' | 'page', at: number, total: number, hidden: number }}
 */
export function model(known) {
    const all = sites();
    const hidden = new Set(read(HIDDEN, []));
    const browsing = read(BROWSING, null);

    const here = siteKey(location.href);
    const frequent = Object.entries(all)
        .filter(([key, site]) => key !== here && !known.has(key) && !hidden.has(key) && site.score >= 150
            && !NOT_A_DESTINATION.some((pattern) => pattern.test(key.split(':')[0])))
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, FREQUENT_COUNT)
        .map(([key, site]) => ({ key, name: siteName(site.title, key), url: site.url }));

    // Only the browser history can say a link went unused; this page sees just its own clicks.
    const quiet = new Set();
    if (browsing?.sites && browsing.total >= 500) {
        for (const key of known) {
            const site = all[key];
            if (!site || Date.now() - site.last > QUIET_AFTER) quiet.add(key);
        }
    }

    const health = read(HEALTH, {});
    const gone = new Set(Object.keys(health).filter((host) => health[host].misses >= 2));

    return {
        frequent, quiet, gone,
        source: browsing?.sites ? 'browser' : 'page', at: browsing?.at ?? 0, total: browsing?.total ?? 0, hidden: hidden.size,
    };
}

// ---- the browser history, through the extension ----

/** Ask the Mandy Start extension for a summary of the browser history; null when it isn't installed. */
function askExtension() {
    return new Promise((resolve) => {
        const done = (value) => {
            window.removeEventListener('message', onMessage);
            clearTimeout(timer);
            resolve(value);
        };
        const onMessage = (event) => {
            if (event.origin === location.origin && event.data?.source === 'mandy-start-extension' && event.data.type === 'browsing') {
                done(event.data.data);
            }
        };
        const timer = setTimeout(() => done(null), 2000);
        window.addEventListener('message', onMessage);
        window.postMessage({ source: 'mandy-start-page', type: 'browsing' }, location.origin);
    });
}

async function refreshBrowsing() {
    const cached = read(BROWSING, null);
    if (cached && Date.now() - cached.at < BROWSING_TTL) return false;
    const data = await askExtension();
    if (!data?.sites) return false;

    // Score each site the way the page scores its own visits, and keep the 400 strongest.
    const scored = Object.entries(data.sites)
        .map(([key, site]) => [key, { url: site.url, title: site.title, score: site.visits * weight(site.last), last: site.last }])
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, 400);
    write(BROWSING, { at: Date.now(), total: data.total, sites: Object.fromEntries(scored) });
    return true;
}

// ---- links whose address no longer exists ----

const PRIVATE_HOST = /^(localhost|[\d.]+|\[.*\])$|\.(local|lan|internal|home|arpa|test|ts\.net)$/;

async function checkHealth(urls) {
    const health = read(HEALTH, {});
    const hosts = [...new Set(urls.map(hostOf))].filter((host) => host && !PRIVATE_HOST.test(host));
    // A week between checks; a day when the last one missed, to confirm quickly.
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
