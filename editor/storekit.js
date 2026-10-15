// Store kits: what the App Store, Google Play and itch.io ask for besides the app itself —
// listing text with the stores' limits, privacy answers worked out from what the game uses,
// a starter privacy policy, itch.io page settings, and PNGs without transparency (the App Store icon).

/** App Store / Google Play categories for games and apps. */
export const STORE_CATEGORIES = [
  ['game-action', 'Game: Action'], ['game-adventure', 'Game: Adventure'], ['game-arcade', 'Game: Arcade'], ['game-board', 'Game: Board'], ['game-card', 'Game: Card'],
  ['game-casual', 'Game: Casual'], ['game-educational', 'Game: Educational'], ['game-puzzle', 'Game: Puzzle'], ['game-racing', 'Game: Racing'], ['game-rpg', 'Game: Role Playing'],
  ['game-simulation', 'Game: Simulation'], ['game-sports', 'Game: Sports'], ['game-strategy', 'Game: Strategy'], ['game-word', 'Game: Word'],
  ['app-productivity', 'App: Productivity'], ['app-lifestyle', 'App: Lifestyle'], ['app-education', 'App: Education'], ['app-finance', 'App: Finance'], ['app-health', 'App: Health & Fitness'],
  ['app-social', 'App: Social Networking'], ['app-utilities', 'App: Utilities'], ['app-entertainment', 'App: Entertainment'], ['app-music', 'App: Music'], ['app-food', 'App: Food & Drink'],
];
const catLabel = (k) => (STORE_CATEGORIES.find((c) => c[0] === k) || [k, k])[1];
const APPLE_CAT = { 'game-action': 'Games › Action', 'game-adventure': 'Games › Adventure', 'game-arcade': 'Games › Arcade', 'game-board': 'Games › Board', 'game-card': 'Games › Card', 'game-casual': 'Games › Casual', 'game-educational': 'Games › Educational', 'game-puzzle': 'Games › Puzzle', 'game-racing': 'Games › Racing', 'game-rpg': 'Games › Role Playing', 'game-simulation': 'Games › Simulation', 'game-sports': 'Games › Sports', 'game-strategy': 'Games › Strategy', 'game-word': 'Games › Word', 'app-productivity': 'Productivity', 'app-lifestyle': 'Lifestyle', 'app-education': 'Education', 'app-finance': 'Finance', 'app-health': 'Health & Fitness', 'app-social': 'Social Networking', 'app-utilities': 'Utilities', 'app-entertainment': 'Entertainment', 'app-music': 'Music', 'app-food': 'Food & Drink' };
const PLAY_CAT = { 'game-action': 'Action', 'game-adventure': 'Adventure', 'game-arcade': 'Arcade', 'game-board': 'Board', 'game-card': 'Card', 'game-casual': 'Casual', 'game-educational': 'Educational', 'game-puzzle': 'Puzzle', 'game-racing': 'Racing', 'game-rpg': 'Role Playing', 'game-simulation': 'Simulation', 'game-sports': 'Sports', 'game-strategy': 'Strategy', 'game-word': 'Word', 'app-productivity': 'Productivity', 'app-lifestyle': 'Lifestyle', 'app-education': 'Education', 'app-finance': 'Finance', 'app-health': 'Health & Fitness', 'app-social': 'Social', 'app-utilities': 'Tools', 'app-entertainment': 'Entertainment', 'app-music': 'Music & Audio', 'app-food': 'Food & Drink' };

/** The stores' length limits, for the checklist and the listing sheet. */
export const LIMITS = { name: 30, subtitle: 30, shortDesc: 80, description: 4000, keywords: 100, promo: 170 };

/**
 * What the game uses that the stores' privacy questions care about.
 * f = { playfab, photon, supabase, supabaseAccounts, onlineData, notifications, camera, microphone, location, cloudSaves, leaderboards, chat }
 */
export function privacyFacts(f) {
  const collects = [], shared = [];
  if (f.supabaseAccounts || f.playfabEmail) collects.push(['Email address', 'Account sign-in', f.supabase ? 'Supabase' : 'PlayFab']);
  if (f.supabaseAccounts || f.playfab) collects.push(['Name / user ID', 'Accounts, leaderboards', [f.supabase && 'Supabase', f.playfab && 'PlayFab'].filter(Boolean).join(', ')]);
  if (f.onlineData) collects.push(['Content people write (records, posts, messages)', 'App functionality', 'Supabase']);
  if (f.playfab) collects.push(['Game progress and scores', 'Cloud saves, leaderboards', 'PlayFab']);
  if (f.photon) collects.push(['Gameplay data during multiplayer (positions, chat)', 'Multiplayer', 'Photon']);
  if (f.location) collects.push(['Approximate / precise location', 'Game features (only while playing)', 'Stays on the device unless your game sends it']);
  if (f.camera) collects.push(['Photos / camera', 'Game features', 'Stays on the device']);
  if (f.microphone) collects.push(['Audio (microphone level)', 'Game features', 'Stays on the device']);
  for (const c of collects) if (/PlayFab|Supabase|Photon/.test(c[2])) shared.push(c[2]);
  return { collects, processors: [...new Set(shared.join(', ').split(', ').filter(Boolean))], none: !collects.length };
}

const md = (rows) => rows.filter((r) => r !== null && r !== false && r !== undefined).join('\n');
const lim = (s, n) => { const t = String(s || ''); return `${t || '(empty)'}  _(${t.length}/${n})_${t.length > n ? ' **too long**' : ''}`; };

/** LISTING.md: everything to paste into App Store Connect and the Google Play Console. */
export function listingSheet(o, f) {
  const P = privacyFacts(f), cat = o.category || 'game-casual', game = cat.startsWith('game');
  return md([
    `# ${o.name}: store listing`, '',
    'Copy these into **App Store Connect** (appstoreconnect.apple.com) and the **Google Play Console** (play.google.com/console). The pictures are in this folder.', '',
    '## Text', '',
    `- **App name** (both stores, up to ${LIMITS.name}): ${lim(o.name, LIMITS.name)}`,
    `- **Subtitle** (App Store, up to ${LIMITS.subtitle}): ${lim(o.subtitle, LIMITS.subtitle)}`,
    `- **Short description** (Google Play, up to ${LIMITS.shortDesc}): ${lim(o.shortDesc, LIMITS.shortDesc)}`,
    `- **Keywords** (App Store, comma-separated, up to ${LIMITS.keywords}): ${lim(o.keywords, LIMITS.keywords)}`,
    `- **Category:** ${catLabel(cat)} → App Store: *${APPLE_CAT[cat] || 'Games'}*, Google Play: *${game ? 'Game › ' : 'App › '}${PLAY_CAT[cat] || 'Casual'}*`,
    `- **Made by / developer name:** ${o.author || '(add one in Build Settings › App)'}`,
    `- **Version:** ${o.version}`, '',
    `### Full description (both stores, up to ${LIMITS.description})`, '', o.description || '(Write it in Build Settings › App › Description.)', '',
    `### What's new in ${o.version} (App Store "What's New", Google Play "Release notes", up to 4000 / 500)`, '', o.whatsNew || '(Optional: Build Settings › App › What’s new in this version.)', '',
    '## Links', '',
    `- **Privacy policy URL** (required by both stores): ${o.privacyUrl || '**missing**: host privacy-policy.md (from this folder) on your website or GitHub Pages and paste its address in Build Settings › Store listing'}`,
    `- **Support URL / email:** ${o.supportUrl || '(missing: a web page or mailto: link where players can reach you)'}`,
    o.marketingUrl ? `- **Marketing URL:** ${o.marketingUrl}` : null, '',
    '## Pictures in this folder', '',
    '| File | Where it goes |', '|---|---|',
    '| `app-store-icon-1024.png` | App Store Connect › App Information (1024×1024, no transparency; EAS/Xcode also use it) |',
    '| `play-icon-512.png` | Google Play › Main store listing › App icon (512×512) |',
    '| `play-feature-graphic-1024x500.png` | Google Play › Main store listing › Feature graphic (required) |', '',
    o.shots ? `### Screenshots\n\nThe **screenshots/** folder has your ${o.shots} screenshot${o.shots > 1 ? 's' : ''} at the stores' sizes: \`app-store-iphone-6.9-*\` (App Store › iPhone 6.9" Display${o.iosDevices === 'universal' ? '; `app-store-ipad-13-*` for iPad 13"' : ''}) and \`google-play-phone-*\` (Google Play › Phone screenshots). Google Play wants at least 2.\n` : null,
    o.shots ? '### More screenshots' : '### Screenshots (take them in Pocket Engine: ▶ Play, then the camera on the Play bar)', '',
    '- **App Store:** at least 1 for a 6.9" iPhone (1320×2868 or 1290×2796) — the store scales them for smaller iPhones. iPad apps also need 13" iPad (2064×2752).',
    '- **Google Play:** 2–8 phone screenshots (16:9 or 9:16, 1080×1920 is a good size). Tablets: 7" and 10" sets if you support them.',
    `- Tip: in Pocket Engine press Play, then use your phone's screenshot buttons. ${o.orientation === 'landscape' ? 'Hold the phone sideways (the game is landscape).' : 'Hold the phone upright.'}`, '',
    '## Age rating', '',
    '- **App Store:** answer the questionnaire in App Store Connect › App Information › Age Rating (violence, scary content, gambling, user-generated content…).',
    `- **Google Play:** Policy › App content › Content rating (IARC questionnaire).${f.chat || f.onlineData ? ' Your app lets people share content with others: say yes to user interaction / user-generated content.' : ''}`,
    `- **Target audience** (Google Play › App content): ${game ? 'if children are part of your audience, the Families policy applies.' : 'pick the age groups you made it for.'}`, '',
    '## Privacy answers', '',
    '### App Store › App Privacy ("nutrition label")', '',
    P.none ? '- **Data Not Collected.** The game keeps everything on the phone and sends nothing to you or anyone else.'
      : md(['Data your app collects (all **linked to the user** if they have an account, **not used for tracking**):', '', ...P.collects.map(([what, why, who]) => `- **${what}** — used for: ${why}. (${who})`)]),
    '',
    '### Google Play › Data safety', '',
    P.none ? '- **No data collected, no data shared.** Data is processed only on the device.'
      : md([
        '- Does your app collect or share any of the required user data types? **Yes**',
        '- Is all of the user data encrypted in transit? **Yes** (all online services use https)',
        `- Do you provide a way for users to request that their data is deleted? ${f.supabaseAccounts || f.playfab ? '**Yes** — say how (an email address, or a delete button you add)' : '**No** (nothing is kept on a server)'}`,
        '', 'Collected (not shared with third parties for their own use; the services below process it for you):', '',
        ...P.collects.map(([what, why]) => `- ${what} — ${why}`)]),
    '',
    '### Export compliance (App Store)', '', '- Uses encryption? Only standard https: **exempt**. (The app already says so: `ITSAppUsesNonExemptEncryption = NO`.)', '',
    P.processors.length ? `Services that handle data for you: ${P.processors.join(', ')}. Mention them in your privacy policy (the starter one in this folder already does).` : '',
  ]);
}

/** privacy-policy.md: a plain starter policy matching what the game does. Host it and link it in both stores. */
export function privacyPolicy(o, f) {
  const P = privacyFacts(f), who = o.author || 'the developer', today = new Date().toISOString().slice(0, 10);
  return md([
    `# Privacy Policy for ${o.name}`, '', `_Last updated: ${today}_`, '',
    `${o.name} is made by ${who}. This page explains what information the ${(o.category || '').startsWith('app') ? 'app' : 'game'} uses.`, '',
    '## Information kept on your device', '',
    'Your progress, settings and anything you create are saved on your device. Deleting the app removes them.', '',
    P.none ? '## Information we collect\n\nWe do not collect, store or share any personal information.' : md([
      '## Information we collect', '',
      ...P.collects.map(([what, why]) => `- **${what}**, used for ${why.toLowerCase()}.`), '',
      '## Services we use', '',
      f.supabase ? '- **Supabase** (supabase.com) stores accounts and online data. See supabase.com/privacy.' : null,
      f.playfab ? '- **PlayFab** by Microsoft (playfab.com) stores player accounts, saves and leaderboards. See privacy.microsoft.com.' : null,
      f.photon ? '- **Photon** by Exit Games (photonengine.com) connects players in multiplayer games. See photonengine.com/privacy.' : null, '',
      'We do not sell your information or use it for advertising.', '',
      f.supabaseAccounts || f.playfab ? `## Deleting your data\n\nTo delete your account and its data, contact ${o.supportUrl || 'us'}.` : null]),
    '',
    f.notifications ? '## Notifications\n\nIf you allow it, the app shows reminders on your device. You can turn them off in your phone settings at any time.\n' : null,
    f.camera || f.microphone || f.location ? `## Permissions\n\nThe app may ask for ${[f.camera && 'the camera', f.microphone && 'the microphone', f.location && 'your location'].filter(Boolean).join(', ')} for game features. This stays on your device unless stated above.\n` : null,
    "## Children\n\nWe do not knowingly collect personal information from children.", '',
    `## Contact\n\n${o.supportUrl ? 'Questions: ' + o.supportUrl : 'Questions: contact ' + who + '.'}`,
  ]);
}

/** ITCH-PAGE.md: the settings for an HTML5 game page on itch.io. */
export function itchPage(o, v) {
  const port = o.orientation === 'portrait', w = v.w, hgt = v.h;
  return md([
    `# ${o.name} on itch.io`, '',
    '1. On itch.io: **Upload new project** (itch.io/game/new).',
    '2. **Kind of project:** HTML.',
    '3. **Uploads:** upload `upload-this-to-itch.zip` and tick **This file will be played in the browser**.',
    `4. **Embed options:** viewport **${w} × ${hgt}** px${port ? ' (portrait)' : ''}, tick **Mobile friendly**${port ? ' with orientation **Portrait**' : ' with orientation **Landscape**'}, tick **Fullscreen button**, and **Automatically start on page load** if you like. Leave SharedArrayBuffer off.`,
    '5. **Cover image:** `cover-630x500.png` from this folder.',
    `6. **Short description or tagline:** ${o.shortDesc || o.subtitle || '(add a short description in Build Settings › Store listing)'}`,
    `7. **Genre:** ${catLabel(o.category || 'game-casual').replace(/^(Game|App): /, '')} · **Tags:** ${o.keywords || 'mobile, html5'}`,
    o.shots ? `8. **Screenshots:** the ${o.shots} \`itch-screenshot-*.jpg\` files in this folder.` : '8. **Screenshots:** take 3–5 while playing (▶ Play, then the camera on the Play bar), and build again.', '',
    o.whatsNew ? `## What's new in ${o.version} (for a devlog post)\n\n${o.whatsNew}\n` : null,
    '## Description', '', o.description || '(Write it in Build Settings › App › Description.)', '',
    '## Updating it from a computer (optional)', '',
    'Install itch.io\'s **butler** tool (itch.io/docs/butler), log in once with `butler login`, then:', '',
    '```', `butler push upload-this-to-itch.zip ${o.itchUser || 'your-username'}/${o.itchGame || slugOf(o.name)}:html5 --userversion ${o.version}`, '```', '',
    'Every push replaces the game on the page; players just reload.',
  ]);
}
const slugOf = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';

// ---- PNG without an alpha channel (the App Store rejects icons that have one, even if every pixel is opaque) ----
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type, data) {
  const t = new TextEncoder().encode(type), body = new Uint8Array(t.length + data.length); body.set(t); body.set(data, t.length);
  const out = new Uint8Array(12 + data.length); out.set(u32(data.length)); out.set(body, 4); out.set(u32(crc32(body)), 8 + data.length); return out;
}
/** A canvas as a 24-bit RGB PNG (transparent pixels become the given background). */
export async function opaquePNG(canvas, bg = '#000000') {
  const w = canvas.width, h = canvas.height, px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const br = parseInt(bg.slice(1, 3), 16) || 0, bgG = parseInt(bg.slice(3, 5), 16) || 0, bb = parseInt(bg.slice(5, 7), 16) || 0;
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0, o = 0; y < h; y++) {
    raw[o++] = 0; // no filter
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, a = px[i + 3] / 255; raw[o++] = Math.round(px[i] * a + br * (1 - a)); raw[o++] = Math.round(px[i + 1] * a + bgG * (1 - a)); raw[o++] = Math.round(px[i + 2] * a + bb * (1 - a)); }
  }
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); // zlib, as PNG wants
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0]); // 8-bit RGB
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
