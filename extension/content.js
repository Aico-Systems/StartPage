// Bridges the start page and the extension: the page asks over postMessage, the background answers.
const api = globalThis.browser ?? globalThis.chrome;

window.addEventListener('message', async (event) => {
    if (event.origin !== location.origin || event.data?.source !== 'mandy-start-page' || event.data.type !== 'browsing') return;
    const data = await api.runtime.sendMessage({ type: 'browsing' });
    window.postMessage({ source: 'mandy-start-extension', type: 'browsing', data }, location.origin);
});
