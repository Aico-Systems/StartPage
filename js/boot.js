// Runs synchronously in <head> so the saved theme is in place before first paint.
// Kept as a classic script (not a module) because modules are deferred.
(() => {
    const root = document.documentElement;
    const get = (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
    };

    root.dataset.scheme = get('colorScheme') || 'catppuccin';
    root.dataset.theme = get('theme') || 'dark';
    root.dataset.colorMode = get('colorMode') || 'multi';
    root.dataset.bgSize = get('backgroundSize') || 'cover';
    root.classList.toggle('bg-blur', get('backgroundBlur') === 'true');
    root.classList.toggle('no-animations', get('animateBackground') === 'false');

    if (root.dataset.scheme === 'custom') {
        try {
            const colors = JSON.parse(get('customColors')) || {};
            for (const [name, value] of Object.entries(colors)) {
                root.style.setProperty(`--custom-${name}`, value);
            }
        } catch { /* fall back to the CSS defaults */ }
    }
})();
