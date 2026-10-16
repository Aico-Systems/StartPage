// The settings sheet. Controls declare `data-setting="<key>"` and are handled together;
// the personal link editor and the backup buttons have their own handlers.

import { markHtml } from './directory.js';
import { forget, model } from './learn.js';
import { ENGINES } from './search.js';
import { emit, exportBackup, importBackup, on, parse, set, settings } from './store.js';
import { $, $$, download, esc, move, sortable, toast } from './util.js';

let sheet;

function renderEngineList() {
    $('#engine-list').innerHTML = Object.entries(ENGINES).map(([id, engine]) => `
        <label class="engine-option">
            <input type="checkbox" value="${id}">
            <span>${esc(engine.name)}</span>
            <code>!${engine.bang}</code>
        </label>`).join('');
}

/** Show current values in every control, except the field being typed in. */
function syncControls() {
    const focused = document.activeElement;
    for (const el of $$('[data-setting]', sheet)) {
        const value = String(settings[el.dataset.setting]);
        if (el.classList.contains('segmented')) {
            for (const button of el.children) button.setAttribute('aria-pressed', button.dataset.value === value);
        } else if (el !== focused) {
            el.value = value;
        }
    }
    for (const box of $$('#engine-list input')) box.checked = settings.enabledEngines.includes(box.value);
}

// ---- personal links ----

const savePersonal = () => set('personal', settings.personal);

function renderPersonal() {
    $('#personal-editor').innerHTML = settings.personal.map((section, s) => `
        <div class="group-editor" data-section="${s}">
            <div class="group-head">
                <input class="field group-name" data-field="name" value="${esc(section.name)}" aria-label="Group name" maxlength="24">
                <button type="button" class="text-button danger" data-action="remove-section">Remove group</button>
            </div>
            <ul class="link-rows">${section.links.map((link, i) => `
                <li class="link-row" data-index="${i}">
                    <span class="drag" draggable="true" title="Drag to reorder" aria-hidden="true"></span>
                    ${markHtml(link.url, link.name)}
                    <input class="field" data-field="name" value="${esc(link.name)}" placeholder="Name" aria-label="Link name" maxlength="28">
                    <input class="field url" data-field="url" value="${esc(link.url)}" placeholder="https://" aria-label="Address" spellcheck="false">
                    <button type="button" class="remove" data-action="remove-link" aria-label="Remove ${esc(link.name)}">×</button>
                </li>`).join('')}
            </ul>
            <button type="button" class="text-button" data-action="add-link">Add a link</button>
        </div>`).join('');

    for (const list of $$('.link-rows', sheet)) {
        const section = settings.personal[list.closest('[data-section]').dataset.section];
        sortable(list, '.link-row', (from, to) => {
            move(section.links, from, to);
            savePersonal();
            renderPersonal();
        });
    }
}

function initPersonalEditor() {
    const editor = $('#personal-editor');
    const sectionOf = (el) => settings.personal[el.closest('[data-section]').dataset.section];

    editor.addEventListener('input', (e) => {
        const { field } = e.target.dataset;
        if (!field) return;
        const row = e.target.closest('.link-row');
        const item = row ? sectionOf(row).links[row.dataset.index] : sectionOf(e.target);
        item[field] = e.target.value;
        if (row) row.querySelector('.mark').outerHTML = markHtml(item.url, item.name);
        savePersonal();
    });

    editor.addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        const section = sectionOf(e.target);
        if (action === 'add-link') {
            section.links.push({ name: '', url: 'https://' });
        } else if (action === 'remove-link') {
            section.links.splice(e.target.closest('.link-row').dataset.index, 1);
        } else if (action === 'remove-section') {
            if (section.links.length && !confirm(`Remove “${section.name}” and its ${section.links.length} links?`)) return;
            settings.personal.splice(settings.personal.indexOf(section), 1);
        }
        savePersonal();
        renderPersonal();
        if (action === 'add-link') $(`[data-section="${settings.personal.indexOf(section)}"] .link-row:last-child [data-field="name"]`).focus();
    });

    $('#add-section').addEventListener('click', () => {
        settings.personal.push({ id: `g${Date.now()}`, name: 'New group', links: [{ name: '', url: 'https://' }] });
        savePersonal();
        renderPersonal();
        $('.group-editor:last-child .group-name').select();
    });
}

// ---- learning ----

function ago(time) {
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function renderLearning() {
    const { source, at, total, gone, hidden } = model(new Set());
    const lines = [source === 'browser'
        ? `Learning from your browser history: ${total.toLocaleString('en')} visits from the last 90 days, read ${ago(at)}.`
        : 'Learning from what you open here. Install the extension and it learns from everything you browse.'];
    if (gone.size) lines.push(`Hidden because the address no longer exists: ${[...gone].join(', ')}.`);
    $('#learn-status').textContent = lines.join(' ');
    $('#learn-unhide').hidden = hidden === 0;
}

function initLearning() {
    $('#learn-unhide').addEventListener('click', () => {
        forget({ hiddenOnly: true });
        emit('learning');
    });
    $('#learn-forget').addEventListener('click', () => {
        if (!confirm('Forget the sites this page has learned you use? Your links and settings stay.')) return;
        forget();
        emit('learning');
    });
    on('learning', renderLearning);
}

// ---- backup ----

function initBackup() {
    $('#backup-export').addEventListener('click', () => {
        download(`aico-startpage-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportBackup(), null, 2));
        toast('Exported your settings and links.');
    });

    const fileInput = $('#backup-file');
    $('#backup-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        const [file] = fileInput.files;
        fileInput.value = '';
        if (!file) return;
        try {
            const backup = JSON.parse(await file.text());
            if (typeof backup?.settings !== 'object') throw new Error('this file is not a start page backup');
            if (!confirm('Replace your settings and links with the ones in this file?')) return;
            importBackup(backup);
            location.reload();
        } catch (err) {
            toast(`Import failed: ${err.message}.`);
        }
    });
}

// ---- the sheet ----

export function openSettings() {
    syncControls();
    renderPersonal();
    renderLearning();
    sheet.showModal();
}

export function initSettings() {
    sheet = $('#settings');
    renderEngineList();
    initPersonalEditor();
    initLearning();
    initBackup();

    $('#settings-close').addEventListener('click', () => sheet.close());
    document.addEventListener('click', (e) => {
        if (e.target.closest('#settings-open, [data-action="settings"]')) openSettings();
    });

    sheet.addEventListener('click', (e) => {
        if (e.target === sheet) {
            sheet.close(); // a click on the veil beside the sheet
            return;
        }
        const button = e.target.closest('.segmented button');
        if (button) {
            const key = button.parentElement.dataset.setting;
            set(key, parse(key, button.dataset.value));
        }
    });

    // Text fields commit when left (or on Enter); the name updates as it is typed.
    sheet.addEventListener('change', (e) => {
        const key = e.target.dataset.setting;
        if (key) set(key, e.target.value.trim());
    });
    $('[data-setting="userName"]', sheet).addEventListener('input', (e) => set('userName', e.target.value.trim()));

    $('#engine-list').addEventListener('change', () => {
        const enabled = $$('#engine-list input:checked').map((box) => box.value);
        if (enabled.length) set('enabledEngines', enabled);
        else syncControls(); // keep at least one
    });

    on('*', () => {
        if (sheet.open) syncControls();
    });
}
