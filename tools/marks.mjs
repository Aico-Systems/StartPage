// Builds js/marks.js: the logos links can show. Brands from Simple Icons (CC0) as SVG paths; brands
// Simple Icons lacks get their own site icon, fetched once into assets/marks/ (as the landing page does).
// Usage: node tools/marks.mjs <path to node_modules/simple-icons>
// Add a brand to BRANDS (Simple Icons slug: hosts) or SITE_ICONS (name: domain to take the icon from,
// hosts), then rerun.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// slug: hosts. A host matches itself and its subdomains; one ending in "." matches as a prefix ("argocd.").
const BRANDS = {
    github: ['github.com'], gitlab: ['gitlab.com'], codeberg: ['codeberg.org'],
    linear: ['linear.app'], atlassian: ['atlassian.net', 'atlassian.com'], confluence: [], jira: [], trello: ['trello.com'],
    travisci: ['travis-ci.com'], personio: ['personio.com'], kimi: ['kimi.com', 'kimi.ai'], mintlify: ['mintlify.com'],
    penpot: ['penpot.app'], modal: ['modal.com'], sap: ['sapbydesign.com'],
    gmail: ['mail.google.com', 'gmail.com'], googlecalendar: ['calendar.google.com'],
    googledrive: ['drive.google.com'], googledocs: ['docs.google.com'], googlemeet: ['meet.google.com'],
    googlemaps: ['maps.google.com'], googlecloud: ['console.cloud.google.com', 'cloud.google.com'],
    googlegemini: ['gemini.google.com'], googletranslate: ['translate.google.com'],
    google: ['google.com', 'google.de'],
    hetzner: ['hetzner.cloud', 'hetzner.com'], cloudflare: ['cloudflare.com'], digitalocean: ['digitalocean.com'],
    vercel: ['vercel.com'], netlify: ['netlify.com', 'netlify.app'], railway: ['railway.app', 'railway.com'],
    flydotio: ['fly.io'], render: ['render.com'], tailscale: ['tailscale.com'], docker: ['docker.com'],
    argo: ['argocd.'], grafana: ['grafana.com', 'grafana.'], sentry: ['sentry.io'], posthog: ['posthog.com'],
    supabase: ['supabase.com'], proxmox: ['proxmox.'], portainer: ['portainer.'],
    claude: ['claude.ai', 'claude.com'], anthropic: ['anthropic.com'], deepseek: ['deepseek.com'], perplexity: ['perplexity.ai'],
    mistralai: ['mistral.ai'], huggingface: ['huggingface.co'], ollama: ['ollama.com'], openrouter: ['openrouter.ai'],
    elevenlabs: ['elevenlabs.io'], deepgram: ['deepgram.com'], livekit: ['livekit.io'], n8n: ['n8n.io', 'n8n.cloud', 'n8n.'],
    cursor: ['cursor.com'], v0: ['v0.dev', 'v0.app'], replit: ['replit.com'],
    stackoverflow: ['stackoverflow.com'], npm: ['npmjs.com'], bun: ['bun.sh', 'bun.com'], svelte: ['svelte.dev'],
    codesandbox: ['codesandbox.io'], stackblitz: ['stackblitz.com'],
    notion: ['notion.so', 'notion.site'], figma: ['figma.com'], miro: ['miro.com'], excalidraw: ['excalidraw.com'],
    affine: ['affine.pro', 'affine.'], obsidian: ['obsidian.md'], todoist: ['todoist.com'],
    zoom: ['zoom.us'], calendly: ['calendly.com'], hubspot: ['hubspot.com'],
    discord: ['discord.com'], whatsapp: ['whatsapp.com'], telegram: ['telegram.org'], signal: ['signal.org'],
    protonmail: ['proton.me'], spaceship: ['spaceship.com', 'spacemail.com'],
    stripe: ['stripe.com'], paypal: ['paypal.com'], revolut: ['revolut.com'], n26: ['n26.com'], datev: ['datev.de'],
    youtubemusic: ['music.youtube.com'], youtube: ['youtube.com', 'youtu.be'], netflix: ['netflix.com'],
    spotify: ['spotify.com'], twitch: ['twitch.tv'], crunchyroll: ['crunchyroll.com'],
    reddit: ['reddit.com'], x: ['x.com', 'twitter.com'], mastodon: ['mastodon.social'], instagram: ['instagram.com'],
    wikipedia: ['wikipedia.org'], deepl: ['deepl.com'], bitwarden: ['bitwarden.com'], '1password': ['1password.com'],
    nextcloud: ['nextcloud.'], homeassistant: ['homeassistant.'], immich: ['immich.'], jellyfin: ['jellyfin.'],
};

// name: [title, domain whose icon to use, ...hosts it stands for]
const SITE_ICONS = {
    outlook: ['Outlook', 'outlook.live.com', 'outlook.cloud.microsoft', 'outlook.office.com', 'outlook.live.com'],
    teams: ['Teams', 'teams.microsoft.com', 'teams.cloud.microsoft', 'teams.microsoft.com'],
    microsoft: ['Microsoft 365', 'onedrive.live.com', 'sharepoint.com', 'onedrive.live.com', 'office.com', 'microsoft365.com', 'cloud.microsoft'],
    chatgpt: ['ChatGPT', 'chatgpt.com', 'chatgpt.com', 'openai.com'],
    aistudio: ['AI Studio', 'aistudio.google.com', 'aistudio.google.com'],
    twilio: ['Twilio', 'twilio.com', 'twilio.com'],
    telnyx: ['Telnyx', 'telnyx.com', 'telnyx.com'],
    doppler: ['Doppler', 'doppler.com', 'doppler.com'],
    logto: ['Logto', 'logto.io', 'logto.io'],
    heydata: ['heyData', 'heydata.eu', 'heydata.eu'],
    fyrst: ['FYRST', 'fyrst.de', 'fyrst.de'],
    accountable: ['Accountable', 'accountable.de', 'accountable.de'],
    elster: ['Elster', 'elster.de', 'elster.de'],
    proglove: ['ProGlove', 'docs.proglove.com', 'proglove.com', 'proglove.de'],
    insight: ['Insight', 'insight.proglove.com', 'insight.proglove.com'],
    aws: ['AWS', 'aws.amazon.com', 'aws.amazon.com', 'awsapps.com', 'signin.aws'],
    linkedin: ['LinkedIn', 'linkedin.com', 'linkedin.com'],
};

const dir = process.argv[2] ?? 'node_modules/simple-icons';
const catalog = JSON.parse(readFileSync(join(dir, 'data', 'simple-icons.json'), 'utf8'));
const marks = {};
const hosts = [];

// Relative luminance, to flag marks that vanish on a dark tile (near black) or a light one (near white).
const luminance = (hex) => {
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

for (const [slug, slugHosts] of Object.entries(BRANDS)) {
    const svg = readFileSync(join(dir, 'icons', `${slug}.svg`), 'utf8');
    const path = svg.match(/<path d="([^"]+)"/)[1];
    const title = svg.match(/<title>([^<]+)<\/title>/)[1];
    const hex = catalog.find((icon) => icon.slug === slug || icon.title === title)?.hex;
    if (!hex) throw new Error(`no colour for ${slug}`);
    const l = luminance(hex);
    marks[slug] = { title, hex, path, ...(l < 0.06 && { dark: true }), ...(l > 0.75 && { light: true }) };
    for (const host of slugHosts) hosts.push([host, slug]);
}
mkdirSync('assets/marks', { recursive: true });
for (const [name, [title, from, ...siteHosts]] of Object.entries(SITE_ICONS)) {
    const response = await fetch(`https://www.google.com/s2/favicons?domain=${from}&sz=128`);
    if (!response.ok) throw new Error(`no icon for ${from}`);
    const ext = response.headers.get('content-type')?.includes('jpeg') ? 'jpg' : 'png';
    writeFileSync(`assets/marks/${name}.${ext}`, Buffer.from(await response.arrayBuffer()));
    marks[name] = { title, img: `assets/marks/${name}.${ext}` };
    for (const host of new Set(siteHosts)) hosts.push([host, name]);
}

hosts.sort((a, b) => b[0].length - a[0].length);

writeFileSync('js/marks.js', `// Generated by tools/marks.mjs from Simple Icons (CC0). Do not edit by hand.
// A mark is an SVG path in the brand colour (\`dark\`/\`light\`: too close to black/white for a tile of
// that tone) or a site icon image (\`img\`).

export const MARKS = ${JSON.stringify(marks)};

/** [host, slug] pairs, longest first. */
export const MARK_HOSTS = ${JSON.stringify(hosts)};
`);
console.log(`${Object.keys(marks).length} marks, ${hosts.length} hosts`);
