// Header and footer widgets (greeting, clock, weather, quote, socials) and their placement in the slots.

import { QUOTES } from './defaults.js';
import { on, set, settings, storage } from './store.js';
import { $, $$, esc, safeUrl, setText } from './util.js';

export const SLOT_GROUPS = {
    header: ['headerLeft', 'headerRight'],
    footer: ['footerLeft', 'footerCenter', 'footerRight'],
};

const widgets = {};

// ---- greeting & clock ----

const GREETINGS = [
    // [from hour, text, icon]
    [0, 'Good night', '<i class="fa-solid fa-moon"></i>'],
    [5, 'Good morning', '<span class="nf-icon">\u{F059C}</span>'],
    [12, 'Good afternoon', '<i class="fa-solid fa-sun"></i>'],
    [17, 'Good evening', '<span class="nf-icon">\u{F059B}</span>'],
    [21, 'Good night', '<i class="fa-solid fa-moon"></i>'],
];

const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const pad = (n) => String(n).padStart(2, '0');
let clockTimer;
let greetingIndex = -1;

function formatTime(now) {
    const seconds = settings.showSeconds ? `:${pad(now.getSeconds())}` : '';
    const minutes = pad(now.getMinutes());
    const hours = now.getHours();
    if (settings.timeFormat === '24') return `${pad(hours)}:${minutes}${seconds}`;
    return `${hours % 12 || 12}:${minutes}${seconds} ${hours < 12 ? 'AM' : 'PM'}`;
}

function renderGreeting(hour, force = false) {
    const index = GREETINGS.findLastIndex(([from]) => hour >= from);
    if (index === greetingIndex && !force) return;
    greetingIndex = index;
    const [, text, icon] = GREETINGS[index];
    $('.greeting-icon', widgets.greeting).innerHTML = icon;
    setText($('.greeting-text', widgets.greeting), settings.userName ? `${text}, ${settings.userName}` : text);
}

function tick() {
    const now = new Date();
    setText($('.time', widgets['time-date']), formatTime(now));
    setText($('.date', widgets['time-date']), dateFormat.format(now));
    renderGreeting(now.getHours());

    // Wake up exactly when the display changes: next second, or next minute when seconds are hidden.
    const ms = settings.showSeconds
        ? 1000 - now.getMilliseconds()
        : 60000 - now.getSeconds() * 1000 - now.getMilliseconds();
    clearTimeout(clockTimer);
    clockTimer = setTimeout(tick, ms + 10);
}

// ---- weather (Open-Meteo: free, no API key) ----

const WEATHER_CACHE = 'weatherCache';
const WEATHER_TTL = 30 * 60 * 1000;

function describeWeather(code, isDay) {
    if (code === 0) return ['Clear', isDay ? 'fa-sun' : 'fa-moon'];
    if (code <= 2) return [code === 1 ? 'Mostly clear' : 'Partly cloudy', isDay ? 'fa-cloud-sun' : 'fa-cloud-moon'];
    if (code === 3) return ['Overcast', 'fa-cloud'];
    if (code <= 48) return ['Fog', 'fa-smog'];
    if (code <= 57) return ['Drizzle', 'fa-cloud-rain'];
    if (code <= 67) return ['Rain', 'fa-cloud-showers-heavy'];
    if (code <= 77) return ['Snow', 'fa-snowflake'];
    if (code <= 82) return ['Showers', 'fa-cloud-sun-rain'];
    if (code <= 86) return ['Snow showers', 'fa-snowflake'];
    return ['Thunderstorm', 'fa-cloud-bolt'];
}

function readWeatherCache() {
    try { return JSON.parse(storage.get(WEATHER_CACHE)); } catch { return null; }
}

function renderWeather(report, message) {
    const el = widgets.weather;
    if (!report) {
        $('.widget-icon', el).innerHTML = '<i class="fa-solid fa-cloud-sun"></i>';
        setText($('.widget-text', el), message);
        el.title = '';
        return;
    }
    const [label, icon] = describeWeather(report.code, report.isDay);
    const temp = settings.tempUnit === 'C' ? report.temp : report.temp * 9 / 5 + 32;
    $('.widget-icon', el).innerHTML = `<i class="fa-solid ${icon}"></i>`;
    setText($('.widget-text', el), `${Math.round(temp)}°${settings.tempUnit} ${label}`);
    el.title = `${report.place} · updated ${new Date(report.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

async function geocode(location) {
    const [name, ...rest] = location.split(',').map((part) => part.trim());
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
    const country = rest.at(-1);
    if (country && /^[a-z]{2}$/i.test(country)) url.searchParams.set('countryCode', country.toUpperCase());

    const place = (await (await fetch(url)).json()).results?.[0];
    if (!place) throw new Error(`No city called "${name}"`);
    return { lat: place.latitude, lon: place.longitude, place: place.name };
}

async function refreshWeather({ force = false } = {}) {
    if (!isPlaced('weather')) return;
    const location = settings.weatherLocation.trim();
    if (!location) return renderWeather(null, 'Set a city in settings');

    let cache = readWeatherCache();
    if (cache?.location !== location) cache = null;
    if (cache) renderWeather(cache);
    if (cache && !force && Date.now() - cache.at < WEATHER_TTL) return;

    try {
        const where = cache ?? await geocode(location);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${where.lat}&longitude=${where.lon}`
            + '&current=temperature_2m,weather_code,is_day&timezone=auto';
        const { current } = await (await fetch(url)).json();
        const report = {
            location, lat: where.lat, lon: where.lon, place: where.place,
            temp: current.temperature_2m, code: current.weather_code, isDay: current.is_day === 1, at: Date.now(),
        };
        storage.set(WEATHER_CACHE, JSON.stringify(report));
        renderWeather(report);
    } catch (err) {
        console.warn('Weather update failed', err);
        if (!cache) renderWeather(null, err.message.startsWith('No city') ? err.message : 'Weather unavailable');
    }
}

// ---- quote & socials ----

function renderQuote() {
    const [text, author] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    setText($('.widget-text', widgets.quotes), `“${text}” — ${author}`);
}

function renderSocials() {
    const target = settings.linkBehavior === 'same' ? '' : ' target="_blank" rel="noopener noreferrer"';
    widgets.socials.innerHTML = settings.socialLinks
        .filter((link) => link.visible && link.url)
        .map((link) => `<a class="social-icon" href="${esc(safeUrl(link.url))}"${target} title="${esc(link.name)}"><i class="${esc(link.icon)}"></i></a>`)
        .join('');
}

// ---- placement ----

const isPlaced = (type) => Object.values(SLOT_GROUPS).flat().some((slot) => settings[slot] === type);

function placeWidgets() {
    const pool = $('#widget-pool');
    pool.append(...Object.values(widgets));
    for (const slot of Object.values(SLOT_GROUPS).flat()) {
        const widget = widgets[settings[slot]];
        if (widget) $(`[data-slot="${slot}"]`).append(widget);
    }
    for (const [region, slots] of Object.entries(SLOT_GROUPS)) {
        $(`.${region}`).hidden = slots.every((slot) => settings[slot] === 'blank');
    }
}

/** Put `type` into `slot`; if it already sits in a sibling slot, the two swap. */
export function assignSlot(slot, type) {
    const group = Object.values(SLOT_GROUPS).find((slots) => slots.includes(slot));
    const previous = settings[slot];
    const other = type !== 'blank' && group.find((s) => s !== slot && settings[s] === type);
    if (other) set(other, previous);
    set(slot, type);
}

export function initWidgets() {
    for (const el of $$('[data-widget]')) widgets[el.dataset.widget] = el;

    placeWidgets();
    tick();
    renderQuote();
    renderSocials();
    refreshWeather();
    setInterval(refreshWeather, WEATHER_TTL);

    $('.time', widgets['time-date']).addEventListener('click', () => {
        set('timeFormat', settings.timeFormat === '12' ? '24' : '12');
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tick();
    });

    on(Object.values(SLOT_GROUPS).flat(), () => {
        placeWidgets();
        refreshWeather();
    });
    on(['timeFormat', 'showSeconds'], tick);
    on('userName', () => renderGreeting(new Date().getHours(), true));
    on('tempUnit', () => refreshWeather());
    on('weatherLocation', () => refreshWeather({ force: true }));
    on(['socialLinks', 'linkBehavior'], renderSocials);
}
