// Starting content for a fresh browser profile. Saved edits in settings take precedence.

export const DEFAULT_CATEGORIES = [
    { id: 'dev', name: 'Development', icon: 'fa-solid fa-code' },
    { id: 'productivity', name: 'Productivity', icon: 'fa-solid fa-briefcase' },
    { id: 'media', name: 'Media', icon: 'fa-solid fa-play' },
];

export const DEFAULT_LINKS = {
    dev: [
        { name: 'GitHub', url: 'https://github.com', icon: 'fa-brands fa-github' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: 'fa-brands fa-stack-overflow' },
        { name: 'CodePen', url: 'https://codepen.io', icon: 'fa-brands fa-codepen' },
        { name: 'Vercel', url: 'https://vercel.com', icon: 'fa-solid fa-v' },
        { name: 'Docker', url: 'https://docker.com', icon: 'fa-brands fa-docker' },
        { name: 'Gemini', url: 'https://gemini.google.com', icon: 'fa-solid fa-wand-magic-sparkles' },
        { name: 'DeepSeek', url: 'https://chat.deepseek.com/', icon: 'fa-solid fa-robot' },
        { name: 'Hetzner', url: 'https://console.hetzner.cloud', icon: 'fa-solid fa-server' },
        { name: 'Claude', url: 'https://claude.ai/', icon: 'fa-solid fa-sun' },
    ],
    productivity: [
        { name: 'AFFiNE', url: 'https://affine.aicoflow.com', icon: 'fa-solid fa-file-pen' },
        { name: 'Gmail', url: 'https://mail.google.com', icon: 'fa-solid fa-envelope' },
        { name: 'Calendar', url: 'https://calendar.google.com', icon: 'fa-solid fa-calendar-days' },
        { name: 'Drive', url: 'https://drive.google.com', icon: 'fa-brands fa-google-drive' },
        { name: 'Linear', url: 'https://linear.app', icon: 'fa-solid fa-layer-group' },
        { name: 'Spacemail', url: 'https://spacemail.com', icon: 'fa-solid fa-envelope-open-text' },
        { name: 'Snapdrop', url: 'https://snapdrop.aicoflow.com', icon: 'fa-solid fa-share-nodes' },
        { name: 'Sign', url: 'https://sign.aicoflow.com', icon: 'fa-solid fa-signature' },
        { name: 'Status', url: 'https://status.aicoflow.com', icon: 'fa-solid fa-gauge-high' },
        { name: 'Elster', url: 'https://www.elster.de', icon: 'fa-solid fa-file-invoice-dollar' },
        { name: 'Accountable', url: 'https://www.accountable.de', icon: 'fa-solid fa-receipt' },
    ],
    media: [
        { name: 'YouTube', url: 'https://youtube.com', icon: 'fa-brands fa-youtube' },
        { name: 'YouTube Music', url: 'https://music.youtube.com', icon: 'fa-solid fa-music' },
        { name: 'Netflix', url: 'https://netflix.com', icon: 'fa-solid fa-film' },
        { name: 'YummyAnime', url: 'https://yummyanime.tv', icon: 'fa-solid fa-tv' },
    ],
};

export const DEFAULT_SOCIALS = [
    { name: 'GitHub', icon: 'fa-brands fa-github' },
    { name: 'LinkedIn', icon: 'fa-brands fa-linkedin' },
    { name: 'Twitter/X', icon: 'fa-brands fa-x-twitter' },
    { name: 'Discord', icon: 'fa-brands fa-discord' },
    { name: 'YouTube', icon: 'fa-brands fa-youtube' },
    { name: 'Reddit', icon: 'fa-brands fa-reddit-alien' },
    { name: 'Mastodon', icon: 'fa-brands fa-mastodon' },
    { name: 'Instagram', icon: 'fa-brands fa-instagram' },
    { name: 'Facebook', icon: 'fa-brands fa-facebook' },
    { name: 'TikTok', icon: 'fa-brands fa-tiktok' },
].map((s) => ({ ...s, visible: false, url: '' }));

export const DEFAULT_CUSTOM_COLORS = {
    primary: '#cba6f7',
    secondary: '#89b4fa',
    accent: '#94e2d5',
    background: '#1e1e2e',
    surface: '#313244',
    text: '#cdd6f4',
};

export const QUOTES = [
    ['The only way to do great work is to love what you do.', 'Steve Jobs'],
    ['First, solve the problem. Then, write the code.', 'John Johnson'],
    ['Simplicity is the soul of efficiency.', 'Austin Freeman'],
    ['Make it work, make it right, make it fast.', 'Kent Beck'],
    ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
    ['Creativity is intelligence having fun.', 'Albert Einstein'],
    ['Done is better than perfect.', 'Sheryl Sandberg'],
    ['Stay hungry, stay foolish.', 'Steve Jobs'],
    ["Code is like humor. When you have to explain it, it's bad.", 'Cory House'],
];
