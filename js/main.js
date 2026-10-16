import { initDirectory } from './directory.js';
import { initNow } from './now.js';
import { initSearch } from './search.js';
import { initSettings } from './settings.js';
import { on, settings } from './store.js';

// boot.js set these before first paint; keep them in step with settings and the system.
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const applyAppearance = () => root.classList.toggle('dark',
    settings.appearance === 'dark' || (settings.appearance === 'system' && systemDark.matches));
systemDark.addEventListener('change', applyAppearance);
on('appearance', applyAppearance);
on('motion', (value) => root.classList.toggle('still', !value));

initDirectory();
initNow();
initSearch();
initSettings();
