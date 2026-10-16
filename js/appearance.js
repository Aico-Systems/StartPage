// Theme attributes on <html> and the optional background image.
// boot.js applies the saved theme before first paint; this module keeps it in sync afterwards.

import { on, settings, storage } from './store.js';

const root = document.documentElement;

export function applyCustomColors() {
    for (const [name, value] of Object.entries(settings.customColors)) {
        root.style.setProperty(`--custom-${name}`, value);
    }
}

// ---- background image (stored as a Blob in IndexedDB; localStorage is too small and synchronous) ----

const DB_NAME = 'startpage';
const STORE = 'files';
const BG_KEY = 'background';
let backgroundUrl = null;

function withStore(mode, action) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(DB_NAME, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(STORE);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(STORE, mode);
            const request = action(tx.objectStore(STORE));
            tx.oncomplete = () => {
                db.close();
                resolve(request.result);
            };
            tx.onerror = () => reject(tx.error);
        };
    });
}

function showBackground(blob) {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    backgroundUrl = blob ? URL.createObjectURL(blob) : null;
    root.style.setProperty('--bg-image', backgroundUrl ? `url("${backgroundUrl}")` : 'none');
    root.classList.toggle('has-bg-image', Boolean(blob));
}

export const getBackgroundUrl = () => backgroundUrl;

export async function setBackground(blob) {
    await withStore('readwrite', (store) => (blob ? store.put(blob, BG_KEY) : store.delete(BG_KEY)));
    showBackground(blob);
}

async function loadBackground() {
    // Older versions kept the image as a data URL in localStorage; move it over once.
    const legacy = storage.get('backgroundImage');
    if (legacy) {
        const blob = await (await fetch(legacy)).blob();
        await setBackground(blob);
        storage.remove('backgroundImage');
        return;
    }
    showBackground(await withStore('readonly', (store) => store.get(BG_KEY)));
}

export function initAppearance() {
    on('theme', (value) => { root.dataset.theme = value; });
    on('colorMode', (value) => { root.dataset.colorMode = value; });
    on('colorScheme', (value) => {
        root.dataset.scheme = value;
        if (value === 'custom') applyCustomColors();
    });
    on('customColors', applyCustomColors);
    on('animateBackground', (value) => root.classList.toggle('no-animations', !value));

    on('backgroundSize', (value) => { root.dataset.bgSize = value; });
    on('backgroundBlur', (value) => root.classList.toggle('bg-blur', value));

    loadBackground().catch((err) => console.warn('Background image unavailable', err));
}
