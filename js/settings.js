// Settings dialog. Controls declare `data-setting="<key>"`; toggles and selects are handled generically,
// list editors (categories, links, socials) and file pickers get their own handlers.

import { getBackgroundUrl, setBackground } from './appearance.js';
import { ENGINES, engineIcon } from './search.js';
import { data, exportBackup, importBackup, on, parse, saveData, set, settings } from './store.js';
import { $, $$, download, esc, iconHtml, move, sortable, toast } from './util.js';
import { assignSlot, SLOT_GROUPS } from './widgets.js';

const MAX_CATEGORIES = 8;
const MAX_LINKS = 12;
const MAX_IMAGE_MB = 20;

const SCHEMES = {
    catppuccin: 'Catppuccin', nord: 'Nord', gruvbox: 'Gruvbox', 'tokyo-night': 'Tokyo Night', dracula: 'Dracula',
    solarized: 'Solarized', kanagawa: 'Kanagawa', ayu: 'Ayu', monochrome: 'Monochrome', custom: 'Custom',
};
const CUSTOM_COLORS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text'];
const SLOTS = Object.values(SLOT_GROUPS).flat();

const DRAG_HANDLE = '<span class="drag-handle" draggable="true" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>';
const DELETE_BUTTON = (label, disabled = false) =>
    `<button type="button" class="delete-btn" title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}><i class="fa-solid fa-trash"></i></button>`;

let dialog;
let activeTab = 'general';

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

function buildOptions() {
    $('#scheme-select').innerHTML = Object.entries(SCHEMES)
        .map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

    $('#engine-options').innerHTML = Object.entries(ENGINES).map(([id, engine]) => `
        <label class="engine-option">
            <input type="checkbox" value="${id}">
            <span class="engine-option-icon">${engineIcon(engine)}</span>
            <span>${engine.name}</span>
            <code>!${engine.bang}</code>
        </label>`).join('');

    $('#custom-colors').innerHTML = CUSTOM_COLORS.map((name) => `
        <label class="color-field">
            <span>${capitalize(name)}</span>
            <span class="color-inputs">
                <input type="color" data-color="${name}">
                <input type="text" class="hex-input" data-color="${name}" maxlength="7" spellcheck="false">
            </span>
        </label>`).join('');
}

/** Reflect current settings in every control except the one being typed in. */
function syncControls() {
    const focused = document.activeElement;
    for (const el of $$('[data-setting]', dialog)) {
        const value = String(settings[el.dataset.setting]);
        if (el.classList.contains('setting-toggle')) {
            for (const button of el.children) {
                const active = button.dataset.value === value;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', active);
            }
        } else if (el !== focused) {
            el.value = value;
        }
    }
    for (const box of $$('#engine-options input')) box.checked = settings.enabledEngines.includes(box.value);
    for (const input of $$('#custom-colors input')) {
        if (input !== focused) input.value = settings.customColors[input.dataset.color];
    }
}

// ---- categories ----

function renderCategoryEditor() {
    $('#category-list').innerHTML = data.categories.map((category) => `
        <li class="edit-row" data-id="${esc(category.id)}">
            ${DRAG_HANDLE}
            <span class="icon-preview">${iconHtml(category.icon, 'fa-solid fa-folder')}</span>
            <input class="icon-input" data-field="icon" value="${esc(category.icon)}" placeholder="fa-solid fa-folder" spellcheck="false" aria-label="Icon">
            <input data-field="name" value="${esc(category.name)}" placeholder="Category name" maxlength="24" aria-label="Name">
            ${DELETE_BUTTON('Delete category', data.categories.length <= 1)}
        </li>`).join('');
    $('#add-category').disabled = data.categories.length >= MAX_CATEGORIES;
}

function initCategoryEditor() {
    const list = $('#category-list');
    const categoryOf = (el) => data.categories.find((c) => c.id === el.closest('.edit-row').dataset.id);

    list.addEventListener('input', (e) => {
        const { field } = e.target.dataset;
        if (!field) return;
        categoryOf(e.target)[field] = e.target.value;
        if (field === 'icon') e.target.previousElementSibling.innerHTML = iconHtml(e.target.value, 'fa-solid fa-folder');
        saveData();
    });

    list.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-btn')) return;
        const category = categoryOf(e.target);
        const count = data.links[category.id]?.length ?? 0;
        if (count && !confirm(`Delete "${category.name}" and its ${count} links?`)) return;
        data.categories = data.categories.filter((c) => c !== category);
        delete data.links[category.id];
        saveData();
        renderCategoryEditor();
    });

    sortable(list, '.edit-row', (from, to) => {
        move(data.categories, from, to);
        saveData();
        renderCategoryEditor();
    });

    $('#add-category').addEventListener('click', () => {
        const id = `cat_${Date.now()}`;
        data.categories.push({ id, name: 'New category', icon: 'fa-solid fa-folder' });
        data.links[id] = [];
        saveData();
        renderCategoryEditor();
        $('#category-list li:last-child [data-field="name"]').select();
    });
}

// ---- links ----

const selectedCategory = () => $('#link-category').value;

function renderLinkEditor() {
    const select = $('#link-category');
    const previous = select.value;
    select.innerHTML = data.categories
        .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if (data.categories.some((c) => c.id === previous)) select.value = previous;
    renderLinkRows();
}

function renderLinkRows() {
    const links = data.links[selectedCategory()] ?? [];
    $('#link-list').innerHTML = links.map((link, i) => `
        <li class="edit-row" data-index="${i}">
            ${DRAG_HANDLE}
            <span class="icon-preview">${iconHtml(link.icon)}</span>
            <input class="icon-input" data-field="icon" value="${esc(link.icon)}" placeholder="fa-solid fa-link" spellcheck="false" aria-label="Icon">
            <input data-field="name" value="${esc(link.name)}" placeholder="Name" maxlength="24" aria-label="Name">
            <input class="url-input" type="url" data-field="url" value="${esc(link.url)}" placeholder="https://…" spellcheck="false" aria-label="URL">
            ${DELETE_BUTTON('Delete link')}
        </li>`).join('');
    $('#add-link').disabled = links.length >= MAX_LINKS;
}

function initLinkEditor() {
    const list = $('#link-list');
    const linksOf = () => (data.links[selectedCategory()] ??= []);
    const indexOf = (el) => Number(el.closest('.edit-row').dataset.index);

    $('#link-category').addEventListener('change', renderLinkRows);

    list.addEventListener('input', (e) => {
        const { field } = e.target.dataset;
        if (!field) return;
        linksOf()[indexOf(e.target)][field] = e.target.value;
        if (field === 'icon') e.target.previousElementSibling.innerHTML = iconHtml(e.target.value);
        saveData();
    });

    list.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-btn')) return;
        linksOf().splice(indexOf(e.target), 1);
        saveData();
        renderLinkRows();
    });

    sortable(list, '.edit-row', (from, to) => {
        move(linksOf(), from, to);
        saveData();
        renderLinkRows();
    });

    $('#add-link').addEventListener('click', () => {
        linksOf().push({ name: 'New link', url: 'https://', icon: 'fa-solid fa-link' });
        saveData();
        renderLinkRows();
        $('#link-list li:last-child [data-field="name"]').select();
    });
}

// ---- socials ----

function renderSocialEditor() {
    $('#social-list').innerHTML = settings.socialLinks.map((social, i) => `
        <li class="edit-row" data-index="${i}">
            <input type="checkbox" class="checkbox" data-field="visible"${social.visible ? ' checked' : ''} aria-label="Show ${esc(social.name)}">
            <span class="icon-preview">${iconHtml(social.icon)}</span>
            <span class="social-name">${esc(social.name)}</span>
            <input class="url-input" type="url" data-field="url" value="${esc(social.url)}" placeholder="https://…" spellcheck="false" aria-label="${esc(social.name)} URL">
        </li>`).join('');
}

function initSocialEditor() {
    $('#social-list').addEventListener('input', (e) => {
        const { field } = e.target.dataset;
        if (!field) return;
        const social = settings.socialLinks[Number(e.target.closest('.edit-row').dataset.index)];
        social[field] = field === 'visible' ? e.target.checked : e.target.value;
        set('socialLinks', settings.socialLinks);
    });
}

// ---- background image & backup ----

function renderBackgroundPreview() {
    const url = getBackgroundUrl();
    const img = $('#bg-preview');
    if (url) img.src = url;
    else img.removeAttribute('src');
}

function initFiles() {
    const pick = (input, handler) => {
        input.addEventListener('change', async () => {
            const [file] = input.files;
            input.value = '';
            if (file) await handler(file);
        });
        return () => input.click();
    };

    $('#bg-pick').addEventListener('click', pick($('#bg-file'), async (file) => {
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
            toast(`Pick an image under ${MAX_IMAGE_MB} MB.`, 'error');
            return;
        }
        await setBackground(file);
        renderBackgroundPreview();
    }));

    $('#bg-remove').addEventListener('click', async () => {
        await setBackground(null);
        renderBackgroundPreview();
    });

    $('#backup-export').addEventListener('click', () => {
        const date = new Date().toISOString().slice(0, 10);
        download(`startpage-backup-${date}.json`, JSON.stringify(exportBackup(), null, 2));
        toast('Settings exported.', 'success');
    });

    $('#backup-import').addEventListener('click', pick($('#backup-file'), async (file) => {
        try {
            const backup = JSON.parse(await file.text());
            if (typeof backup?.settings !== 'object') throw new Error('this file is not a startpage backup');
            if (!confirm('Replace all current settings, categories and links with this backup?')) return;
            importBackup(backup);
            toast('Settings imported. Reloading…', 'success');
            setTimeout(() => location.reload(), 800);
        } catch (err) {
            toast(`Import failed: ${err.message}`, 'error');
        }
    }));
}

// ---- dialog ----

const PANEL_RENDERERS = {
    appearance: renderBackgroundPreview,
    categories: renderCategoryEditor,
    links: renderLinkEditor,
    social: renderSocialEditor,
};

function showTab(name) {
    activeTab = name;
    for (const tab of $$('.settings-tab', dialog)) {
        const active = tab.dataset.tab === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active);
    }
    for (const panel of $$('.settings-panel', dialog)) panel.hidden = panel.dataset.panel !== name;
    PANEL_RENDERERS[name]?.();
}

export function openSettings() {
    syncControls();
    showTab(activeTab);
    dialog.showModal();
}

export function initSettings() {
    dialog = $('#settings');
    buildOptions();
    initCategoryEditor();
    initLinkEditor();
    initSocialEditor();
    initFiles();

    $('#settings-btn').addEventListener('click', openSettings);
    $('#settings-close').addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            dialog.close(); // click on the backdrop
            return;
        }
        const tab = e.target.closest('.settings-tab');
        if (tab) showTab(tab.dataset.tab);

        const toggle = e.target.closest('.toggle-btn');
        if (toggle) {
            const key = toggle.parentElement.dataset.setting;
            set(key, parse(key, toggle.dataset.value));
        }
    });

    // Selects and text fields commit on change; the name updates live.
    dialog.addEventListener('change', (e) => {
        const key = e.target.dataset.setting;
        if (!key) return;
        if (SLOTS.includes(key)) assignSlot(key, e.target.value);
        else set(key, parse(key, e.target.value.trim()));
    });
    $('#setting-name').addEventListener('input', (e) => set('userName', e.target.value));

    $('#engine-options').addEventListener('change', () => {
        const enabled = $$('#engine-options input:checked').map((box) => box.value);
        if (enabled.length) set('enabledEngines', enabled);
        else syncControls(); // keep at least one engine
    });

    $('#custom-colors').addEventListener('input', (e) => {
        const value = e.target.value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(value)) set('customColors', { ...settings.customColors, [e.target.dataset.color]: value });
    });

    on('*', () => {
        if (dialog.open) syncControls();
    });
}
