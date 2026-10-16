// Talks to the Mandy Start extension (extension/) through window.postMessage. Without the extension
// installed every request simply resolves to null.

let nextId = 1;
let capabilities = { history: false, query: false };

/** Send `type` with `payload`; resolves to the extension's answer, or null after `timeout` ms. */
export function ask(type, payload = {}, timeout = 2000) {
    const id = nextId++;
    return new Promise((resolve) => {
        const done = (value) => {
            window.removeEventListener('message', onMessage);
            clearTimeout(timer);
            resolve(value ?? null);
        };
        const onMessage = (event) => {
            const reply = event.data;
            if (event.origin !== location.origin || reply?.source !== 'mandy-start-extension' || reply.type !== type) return;
            // Version 1.0 of the extension answers without echoing the id.
            if (reply.id === id || reply.id === undefined) done(reply.data);
        };
        const timer = setTimeout(() => done(null), timeout);
        window.addEventListener('message', onMessage);
        window.postMessage({ source: 'mandy-start-page', id, type, payload }, location.origin);
    });
}

/** What the installed extension can do, learned from its last answer. */
export const can = (feature) => capabilities[feature];

export function noteAnswer(summary) {
    capabilities = { history: Boolean(summary?.sites), query: Boolean(summary?.pages) };
}
