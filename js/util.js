export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for use inside HTML text or a quoted attribute. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

// Imported backups could carry javascript: links; never render those as clickable.
export const safeUrl = (url) => (/^\s*javascript:/i.test(url ?? '') ? '#' : url);

export function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
}

/** Run `fn` at most once per animation frame, no matter how often it is called. */
export function perFrame(fn) {
    let queued = false;
    return () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            fn();
        });
    };
}

export function move(list, from, to) {
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
}

/**
 * Drag-to-reorder for a list whose rows carry a `[draggable]` handle.
 * Calls `onMove(fromIndex, toIndex)` after a drop.
 */
export function sortable(list, rowSelector, onMove) {
    let dragged = null;
    const rows = () => $$(rowSelector, list);
    const clearMarks = () => rows().forEach((row) => row.classList.remove('drag-over', 'dragging'));

    list.addEventListener('dragstart', (e) => {
        dragged = e.target.closest(rowSelector);
        if (!dragged) return;
        dragged.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
    });
    list.addEventListener('dragover', (e) => {
        const row = e.target.closest(rowSelector);
        if (!dragged || !row) return;
        e.preventDefault();
        rows().forEach((r) => r.classList.toggle('drag-over', r === row && r !== dragged));
    });
    list.addEventListener('drop', (e) => {
        const row = e.target.closest(rowSelector);
        if (!dragged || !row || row === dragged) return;
        e.preventDefault();
        const all = rows();
        onMove(all.indexOf(dragged), all.indexOf(row));
    });
    list.addEventListener('dragend', () => {
        dragged = null;
        clearMarks();
    });
}

export function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.append(el);
    setTimeout(() => {
        el.classList.add('leaving');
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 500);
    }, 3000);
}

export function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
