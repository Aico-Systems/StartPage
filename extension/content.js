// Relays between the start page and the extension: the page posts a request with an id, the answer
// comes back under the same id.
const api = globalThis.browser ?? globalThis.chrome;
const ALLOWED = new Set(['browsing', 'query', 'switch']);

window.addEventListener('message', async (event) => {
    const request = event.data;
    if (event.origin !== location.origin || request?.source !== 'mandy-start-page' || !ALLOWED.has(request.type)) return;
    const data = await api.runtime.sendMessage({ ...request.payload, type: request.type });
    window.postMessage({ source: 'mandy-start-extension', id: request.id, type: request.type, data }, location.origin);
});
