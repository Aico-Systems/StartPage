// Settings and link data, persisted in localStorage.
// Key names and value formats are unchanged from the original Sip startpage,
// so configs saved by older versions keep working.

import { DEFAULT_CATEGORIES, DEFAULT_CUSTOM_COLORS, DEFAULT_LINKS, DEFAULT_SOCIALS } from './defaults.js';

const SCHEMA = {
    userName: ['string', ''],
    colorScheme: ['string', 'catppuccin'],
    theme: ['string', 'dark'],
    colorMode: ['string', 'multi'],
    customColors: ['json', DEFAULT_CUSTOM_COLORS],
    animateBackground: ['bool', true],
    timeFormat: ['string', '12'],
    showSeconds: ['bool', false],
    tempUnit: ['string', 'F'],
    weatherLocation: ['string', ''],
    enabledEngines: ['json', ['google', 'duckduckgo', 'github', 'youtube']],
    preferredEngine: ['string', 'google'],
    autoFocusSearch: ['bool', true],
    linkBehavior: ['string', 'same'],
    showKeyboardHints: ['bool', true],
    headerLeft: ['string', 'greeting'],
    headerRight: ['string', 'time-date'],
    footerLeft: ['string', 'weather'],
    footerCenter: ['string', 'blank'],
    footerRight: ['string', 'quotes'],
    socialLinks: ['json', DEFAULT_SOCIALS],
    backgroundSize: ['string', 'cover'],
    backgroundBlur: ['bool', false],
};

export const storage = {
    get(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, value); } catch (err) { console.warn(`Could not save ${key}`, err); }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
    },
};

const clone = (value) => structuredClone(value);

function readJson(key, fallback) {
    try {
        const parsed = JSON.parse(storage.get(key));
        return parsed ?? clone(fallback);
    } catch {
        return clone(fallback);
    }
}

function read(key) {
    const [type, fallback] = SCHEMA[key];
    const raw = storage.get(key);
    if (raw === null) return clone(fallback);
    if (type === 'bool') return raw === 'true';
    if (type === 'json') return readJson(key, fallback);
    return raw;
}

/** Convert a string from a form control into the setting's type. */
export function parse(key, raw) {
    const [type] = SCHEMA[key] ?? ['string'];
    if (type === 'bool') return raw === true || raw === 'true';
    return raw;
}

export const settings = Object.fromEntries(Object.keys(SCHEMA).map((key) => [key, read(key)]));

if (!settings.socialLinks.length) settings.socialLinks = clone(DEFAULT_SOCIALS);

// Old versions stored icons as full `<i class="...">` markup.
const iconClass = (icon) => icon?.match(/class="([^"]+)"/)?.[1] ?? icon;

export const data = {
    categories: readJson('categories', DEFAULT_CATEGORIES).map((c) => ({ ...c, icon: iconClass(c.icon) })),
    links: readJson('links', DEFAULT_LINKS),
};

// ---- change notifications ----

const listeners = new Map();

/** Subscribe to one or more keys. `'data'` fires for category/link edits, `'*'` for everything. */
export function on(keys, fn) {
    for (const key of [].concat(keys)) {
        if (!listeners.has(key)) listeners.set(key, []);
        listeners.get(key).push(fn);
    }
}

function emit(key) {
    listeners.get(key)?.forEach((fn) => fn(settings[key], key));
    listeners.get('*')?.forEach((fn) => fn(settings[key], key));
}

export function set(key, value) {
    settings[key] = value;
    storage.set(key, SCHEMA[key][0] === 'json' ? JSON.stringify(value) : String(value));
    emit(key);
}

export function saveData() {
    storage.set('categories', JSON.stringify(data.categories));
    storage.set('links', JSON.stringify(data.links));
    emit('data');
}

// ---- backup ----

export function exportBackup() {
    return {
        app: 'aico-startpage',
        version: 2,
        exportDate: new Date().toISOString(),
        settings,
        categories: data.categories,
        links: data.links,
    };
}

/** Accepts both this format and the original Sip v1 format (all values as JSON strings). */
export function importBackup(backup) {
    const toRaw = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

    for (const [key, value] of Object.entries(backup.settings)) {
        if (key in SCHEMA && value != null) storage.set(key, toRaw(value));
    }
    if (backup.categories) storage.set('categories', toRaw(backup.categories));
    if (backup.links) storage.set('links', toRaw(backup.links));
}
