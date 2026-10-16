// Answers the start page's questions about the browser. It only collects and summarizes; how the page
// ranks and uses the answers lives in the page itself, so improving that never needs a reinstall.
const api = globalThis.browser ?? globalThis.chrome;
const DAY = 86_400_000;

const SEARCH_PARAMS = ['q', 'query', 'search', 'search_query', 'text', 'k', 'keyword', 'term', 's'];
const SEARCHY_PATH = /search|results|find|suche|query|^\/s\/?$/i;

function siteKey(url) {
    const host = url.hostname.replace(/^www\./, '');
    return url.port ? `${host}:${url.port}` : host;
}

const parse = (raw) => {
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
    } catch {
        return null;
    }
};

/** The search a URL ran, if it looks like one: a query parameter holding words, on a search-like path. */
function searchOf(url) {
    for (const param of SEARCH_PARAMS) {
        const value = url.searchParams.get(param);
        if (!value || value.length > 200 || /^(https?:|[\w-]{24,}$)/.test(value)) continue;
        if (!SEARCHY_PATH.test(url.pathname) && param !== 'q' && param !== 'search') continue;
        return { key: `${url.origin}${url.pathname}?${param}`, origin: url.origin, path: url.pathname, param, value };
    }
    return null;
}

/** The last 90 days per site, the most revisited pages, and the searches made on each site. */
async function summarize() {
    const items = await api.history.search({ text: '', startTime: Date.now() - 90 * DAY, maxResults: 50000 });
    const sites = {};
    const searches = {};
    const pages = [];
    let total = 0;

    for (const item of items) {
        const url = parse(item.url);
        if (!url) continue;
        const visits = item.visitCount ?? 1;
        const last = item.lastVisitTime ?? 0;
        total += visits;

        const site = (sites[siteKey(url)] ??= { url: `${url.origin}/`, title: '', visits: 0, last: 0, best: 0 });
        site.visits += visits;
        site.last = Math.max(site.last, last);
        if (item.title && visits > site.best) {
            site.best = visits;
            site.title = item.title;
        }

        const search = searchOf(url);
        if (search) {
            const entry = (searches[search.key] ??= { origin: search.origin, path: search.path, param: search.param, count: 0, last: 0, values: new Set() });
            entry.count += visits;
            entry.last = Math.max(entry.last, last);
            if (entry.values.size < 20) entry.values.add(search.value.toLowerCase());
        } else if (url.pathname.length > 1 && item.title) {
            pages.push({ url: item.url, title: item.title, visits, last });
        }
    }

    for (const site of Object.values(sites)) delete site.best;
    pages.sort((a, b) => b.visits - a.visits);
    return {
        total,
        sites,
        pages: pages.slice(0, 120),
        // A real search box gets different queries; a link that happens to carry ?q= repeats one.
        searches: Object.values(searches)
            .filter((entry) => entry.values.size >= 3)
            .map(({ values, ...entry }) => entry)
            .sort((a, b) => b.count - a.count)
            .slice(0, 40),
    };
}

/** History pages and open tabs matching what's being typed. */
async function query(text, callerTabId) {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (s) => words.every((word) => s.toLowerCase().includes(word));
    const [items, tabs] = await Promise.all([
        api.history.search({ text, startTime: Date.now() - 365 * DAY, maxResults: 400 }),
        api.tabs.query({}),
    ]);
    return {
        pages: items
            .filter((item) => parse(item.url))
            .map((item) => ({ url: item.url, title: item.title ?? '', visits: item.visitCount ?? 1, last: item.lastVisitTime ?? 0 }))
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 30),
        tabs: tabs
            .filter((tab) => tab.id !== callerTabId && parse(tab.url ?? '') && matches(`${tab.title ?? ''} ${tab.url}`))
            .slice(0, 8)
            .map((tab) => ({ id: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title ?? '' })),
    };
}

/** Bring an open tab to the front; close the start page's tab if it was only a fresh new tab. */
async function switchTo({ tabId, windowId, closeCaller }, callerTabId) {
    await api.tabs.update(tabId, { active: true });
    await api.windows.update(windowId, { focused: true });
    if (closeCaller && callerTabId != null) await api.tabs.remove(callerTabId);
    return true;
}

const HANDLERS = {
    browsing: () => summarize(),
    query: (message, sender) => query(String(message.text ?? '').slice(0, 200), sender.tab?.id),
    switch: (message, sender) => switchTo(message, sender.tab?.id),
};

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = HANDLERS[message?.type];
    if (!handler) return undefined;
    handler(message, sender).then(sendResponse, () => sendResponse(null));
    return true; // the answer comes asynchronously
});
