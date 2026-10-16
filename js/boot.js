// Runs in <head> before first paint: light or dark (the system's choice unless overridden), and motion.
// A classic script, not a module, because modules are deferred.
(() => {
    const root = document.documentElement;
    const get = (key) => {
        try { return localStorage.getItem(key); } catch { return null; }
    };
    const appearance = get('appearance') || 'system';
    const dark = appearance === 'dark' || (appearance === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', dark);
    root.classList.toggle('still', get('motion') === 'false');
})();
