// The greeting, the clock, the date and the weather.

import { on, set, settings, storage } from './store.js';
import { $, esc, setText } from './util.js';

// ---- greeting & clock ----

const GREETINGS = [[0, 'Good night'], [5, 'Good morning'], [12, 'Good afternoon'], [17, 'Good evening'], [22, 'Good night']];
const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
const pad = (n) => String(n).padStart(2, '0');

let timer;
let timeHtml = '';
let landed = false;

function timeParts(now) {
    const h = now.getHours();
    const m = pad(now.getMinutes());
    if (settings.timeFormat === '12') return [`${h % 12 || 12}:${m}`, h < 12 ? 'am' : 'pm'];
    return [`${pad(h)}:${m}`, ''];
}

function renderTime(now) {
    const [digits, period] = timeParts(now);
    // The first time, each character drops in on its own (the landing page's headline does the same).
    const body = landed || document.documentElement.classList.contains('still')
        ? digits
        : [...digits].map((ch, i) => `<span class="ch" style="--c: ${i}">${ch}</span>`).join('');
    landed = true;
    const html = body + (period ? `<span class="period">${period}</span>` : '');
    if (html !== timeHtml) $('#time').innerHTML = timeHtml = html;
}

function renderGreeting(now) {
    const [, greeting] = GREETINGS.findLast(([from]) => now.getHours() >= from);
    setText($('#greeting'), settings.userName ? `${greeting}, ${settings.userName}.` : `${greeting}.`);
}

function tick() {
    const now = new Date();
    renderTime(now);
    renderGreeting(now);
    setText($('#date'), dateFormat.format(now));
    clearTimeout(timer);
    timer = setTimeout(tick, 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 20);
}

// ---- weather, from Open-Meteo (free, no key), cached for half an hour ----

const CACHE_KEY = 'weatherCache';
const TTL = 30 * 60 * 1000;

function describe(code) {
    if (code === 0) return 'clear';
    if (code <= 2) return 'partly cloudy';
    if (code === 3) return 'overcast';
    if (code <= 48) return 'foggy';
    if (code <= 57) return 'drizzling';
    if (code <= 67) return 'raining';
    if (code <= 77) return 'snowing';
    if (code <= 82) return 'showers';
    if (code <= 86) return 'snow showers';
    return 'thunderstorms';
}

function renderWeather(report, message) {
    const el = $('#weather');
    if (!report) {
        el.innerHTML = message ?? 'Add your city in <button type="button" class="inline-link" data-action="settings">settings</button> for the weather.';
        return;
    }
    const temp = settings.tempUnit === 'F' ? report.temp * 9 / 5 + 32 : report.temp;
    el.textContent = `${Math.round(temp)}°, ${describe(report.code)} in ${report.place}`;
}

async function geocode(location) {
    const [name, ...rest] = location.split(',').map((part) => part.trim());
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
    const country = rest.at(-1);
    if (country && /^[a-z]{2}$/i.test(country)) url.searchParams.set('countryCode', country.toUpperCase());
    const place = (await (await fetch(url)).json()).results?.[0];
    if (!place) throw new Error(`No city called “${name}”. Check the spelling in settings.`);
    return { lat: place.latitude, lon: place.longitude, place: place.name };
}

async function refreshWeather({ force = false } = {}) {
    const location = settings.weatherLocation.trim();
    if (!location) return renderWeather(null);

    let cache;
    try { cache = JSON.parse(storage.get(CACHE_KEY)); } catch { cache = null; }
    if (cache?.location !== location) cache = null;
    if (cache) renderWeather(cache);
    if (cache && !force && Date.now() - cache.at < TTL) return;

    try {
        const where = cache ?? await geocode(location);
        const { current } = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${where.lat}`
            + `&longitude=${where.lon}&current=temperature_2m,weather_code&timezone=auto`)).json();
        const report = { location, ...where, temp: current.temperature_2m, code: current.weather_code, at: Date.now() };
        storage.set(CACHE_KEY, JSON.stringify(report));
        renderWeather(report);
    } catch (err) {
        console.warn('Weather update failed', err);
        if (!cache) renderWeather(null, esc(err.message.startsWith('No city') ? err.message : 'The weather is unavailable right now.'));
    }
}

export function initNow() {
    tick();
    refreshWeather();
    setInterval(refreshWeather, TTL);

    $('#time').addEventListener('click', () => set('timeFormat', settings.timeFormat === '12' ? '24' : '12'));
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) tick();
    });

    on(['timeFormat', 'userName'], tick);
    on('tempUnit', () => refreshWeather());
    on('weatherLocation', () => refreshWeather({ force: true }));
}
