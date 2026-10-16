// Summarizes the last 90 days of history per site for the start page. Runs only when the page asks.
const api = globalThis.browser ?? globalThis.chrome;
const DAY = 86_400_000;

function siteKey(url) {
    const { hostname, port } = url;
    const host = hostname.replace(/^www\./, '');
    return port ? `${host}:${port}` : host;
}

async function summarize() {
    const items = await api.history.search({ text: '', startTime: Date.now() - 90 * DAY, maxResults: 50000 });
    const sites = {};
    let total = 0;
    for (const item of items) {
        let url;
        try { url = new URL(item.url); } catch { continue; }
        if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;

        const visits = item.visitCount ?? 1;
        const site = (sites[siteKey(url)] ??= { url: `${url.origin}/`, title: '', visits: 0, last: 0, best: 0 });
        site.visits += visits;
        site.last = Math.max(site.last, item.lastVisitTime ?? 0);
        // The site's name comes from the title of its most visited page.
        if (item.title && visits > site.best) {
            site.best = visits;
            site.title = item.title;
        }
        total += visits;
    }
    for (const site of Object.values(sites)) delete site.best;
    return { total, sites };
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'browsing') return undefined;
    summarize().then(sendResponse, () => sendResponse(null));
    return true; // the answer comes asynchronously
});
