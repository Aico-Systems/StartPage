// Per-browser settings and personal links, kept in localStorage.
// Older versions' keys are read once and migrated (see readPersonal).

import { TEAM } from './team.js';

const SCHEMA = {
    userName: ['string', ''],
    appearance: ['string', 'system'],
    motion: ['bool', true],
    timeFormat: ['string', '24'],
    tempUnit: ['string', 'C'],
    weatherLocation: ['string', ''],
    enabledEngines: ['json', ['google', 'duckduckgo', 'github', 'youtube']],
    preferredEngine: ['string', 'google'],
    autoFocusSearch: ['bool', true],
    linkBehavior: ['string', 'same'],
    personal: ['json', []],
    engineOptOut: ['json', []],
};

export const storage = {
    get(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch (err) { console.warn(`Could not save ${key}`, err); }
    },
};

const readJson = (key) => {
    try { return JSON.parse(storage.get(key)); } catch { return null; }
};

function read(key) {
    const [type, fallback] = SCHEMA[key];
    const raw = storage.get(key);
    if (raw === null) return structuredClone(fallback);
    if (type === 'bool') return raw === 'true';
    if (type === 'json') return readJson(key) ?? structuredClone(fallback);
    return raw;
}

export const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
};

/**
 * Personal links: [{ id, name, links: [{ name, url }] }].
 * The first run after the team redesign builds them from the old per-browser categories, minus
 * whatever the team list already has and anything on the company's own domain.
 */
function readPersonal() {
    if (storage.get('personal') !== null) return read('personal');

    const categories = readJson('categories');
    const links = readJson('links');
    if (!Array.isArray(categories) || !links) return [];

    const teamLinks = TEAM.flatMap((section) => section.links);
    const teamHosts = new Set(teamLinks.map((link) => hostOf(link.url)));
    const teamNames = new Set(teamLinks.map((link) => link.name.toLowerCase()));
    const keep = ({ name = '', url = '' }) => {
        const host = hostOf(url);
        return host && !teamHosts.has(host) && !teamNames.has(name.toLowerCase()) && !host.endsWith('aicoflow.com');
    };

    const personal = categories
        .map((c) => ({ id: c.id, name: c.name, links: (links[c.id] ?? []).filter(keep).map(({ name, url }) => ({ name, url })) }))
        .filter((section) => section.links.length);
    storage.set('personal', JSON.stringify(personal));
    return personal;
}

export const settings = Object.fromEntries(Object.keys(SCHEMA).map((key) => [key, read(key)]));
settings.personal = readPersonal();
if (settings.linkBehavior !== 'same') settings.linkBehavior = 'new-tab'; // "new-window" is gone

// ---- change notifications ----

const listeners = new Map();

/** Subscribe to one or more keys; `'*'` hears every change. */
export function on(keys, fn) {
    for (const key of [].concat(keys)) {
        if (!listeners.has(key)) listeners.set(key, []);
        listeners.get(key).push(fn);
    }
}

/** Tell subscribers `key` changed; `set` does this, and so can state kept outside the settings. */
export function emit(key, value = settings[key]) {
    for (const fn of [...(listeners.get(key) ?? []), ...(listeners.get('*') ?? [])]) fn(value, key);
}

export function set(key, value) {
    settings[key] = value;
    storage.set(key, SCHEMA[key][0] === 'json' ? JSON.stringify(value) : String(value));
    emit(key, value);
}

/** Convert a form control's string into the setting's type. */
export const parse = (key, raw) => (SCHEMA[key]?.[0] === 'bool' ? raw === 'true' : raw);

// ---- backup ----

export const exportBackup = () => ({
    app: 'aico-startpage',
    version: 3,
    exportDate: new Date().toISOString(),
    settings: Object.fromEntries(Object.keys(SCHEMA).map((key) => [key, settings[key]])),
});

/** Accepts this format and the older Sip ones (whose categories/links get migrated on reload). */
export function importBackup(backup) {
    const toRaw = (value) => (typeof value === 'string' ? value : JSON.stringify(value));
    for (const [key, value] of Object.entries(backup.settings)) {
        if (key in SCHEMA && value != null) storage.set(key, toRaw(value));
    }
    if (!backup.settings.personal && backup.categories && backup.links) {
        storage.set('categories', toRaw(backup.categories));
        storage.set('links', toRaw(backup.links));
        try { localStorage.removeItem('personal'); } catch { /* ignore */ }
    }
}
