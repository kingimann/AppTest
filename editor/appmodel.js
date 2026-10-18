// App model: an app project read as pages, components, tabs and data, the shape the native code exports
// (Flutter widgets, SwiftUI views) are written from. What has no native version yet is kept as a "todo" with its name.

const fieldKey = (n) => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
const PAGE_W = 400;

/** What a page has in it that turns into a native element; null for things the native app doesn't need (the page itself, App Logic). */
function elementOf(e, kids, todo) {
  const B = (t) => (e.behaviors || []).find((b) => b.type === t), P = (b) => b.params || b; // (saved games keep params flat on the behavior)
  const color = (c) => (c == null || c === '' ? '' : String(c));
  const text = e.text && String(e.text.value ?? '') !== '' ? { value: String(e.text.value), size: +e.text.size || 16, weight: String(e.text.weight || '600'), color: color(e.text.color), align: e.text.align || 'center' } : null;
  const sh = e.shape || {}, W = +sh.w || (+sh.r || 0) * 2 || 0, H = +sh.h || (+sh.r || 0) * 2 || 0;
  /** A card, badge, picture box or button with things inside: its size, colours and corners, its own centred text, and its children where the design puts them. */
  const box = (action = null) => ({ kind: 'box', w: W, h: H || 48, radius: sh.type === 'circle' ? (H || 48) / 2 : +sh.radius || 0, fill: color(sh.fill), stroke: sh.stroke ? color(sh.stroke) : '', strokeW: +sh.lineWidth || (sh.stroke ? 1 : 0),
    shadow: !!sh.shadow, text, action, row: e.row != null && e.row !== '' ? +e.row || 0 : null, children: kids }); // row: its stretched children share its width, side by side
  const opts = (v) => String(v ?? '').split(/\n|,/).map((x) => x.trim()).filter(Boolean);
  let b;
  if ((b = B('uiDataList'))) { const p = P(b); return { kind: 'list', collection: p.collection || '', title: p.title || '{title}', subtitle: p.subtitle || '', icon: p.icon || '', check: p.check || '', search: p.search || '', filter: p.filter || '', sort: p.sort || 'newest first', openPage: p.openPage || '', empty: p.empty || 'Nothing here yet', right: p.right || '', swipeDelete: p.swipeDelete !== false, rowH: +p.rowH || 64, gap: p.gap ?? 8, radius: p.radius ?? 14, doneLook: p.doneLook !== false, fill: e.stretch === 'both' }; }
  if ((b = B('uiForm'))) { const p = P(b); return { kind: 'form', collection: p.collection || '', fields: String(p.fields || '').split(',').map((s) => s.trim()).filter(Boolean).map(fieldKey), mode: /always adds/.test(p.mode || '') ? 'new' : /always changes/.test(p.mode || '') ? 'edit' : 'auto', saveLabel: p.saveLabel || 'Save', after: p.after || 'go back', page: p.page || '', fill: e.stretch === 'both' }; }
  if ((b = B('uiInput')) || (b = B('uiSearchBar'))) { const p = P(b); return { kind: 'input', var: p.var || 'text', placeholder: p.placeholder || '', keyboard: p.kind || (b.type === 'uiSearchBar' ? 'search' : 'text'), outlined: !!e.shape?.stroke }; }
  if ((b = B('uiToggle'))) { const p = P(b); return { kind: 'toggle', var: p.var || 'on', label: text?.value || '', start: p.start !== false }; }
  if ((b = B('button'))) {
    const p = P(b), act = { action: p.action || 'message', value: p.value ?? '', amount: p.amount ?? 1 };
    if (kids.length) return box(act); // a menu row, a shop item, a "Continue with Google" button: a box you can tap
    return { kind: 'button', label: text?.value || e.name || 'Button', ...act,
      fab: sh.type === 'circle' && /bottom/.test(e.anchor || ''), outlined: !!sh.stroke && (!sh.fill || /card|bg/.test(String(sh.fill))), plain: !sh.fill && !sh.stroke, fill: color(sh.fill), color: color(text?.color), stroke: color(sh.stroke),
      h: H || 52, radius: sh.type === 'circle' ? (H || 52) / 2 : sh.radius ?? 16, size: text?.size || 17 };
  }
  // social components: native versions that read the same data collections
  if ((b = B('uiFeed'))) { const p = P(b); return { kind: 'feed', collection: p.collection || 'Posts', look: p.look || 'timeline', filter: p.filter || '', search: p.searchVar || '', columns: +p.gridColumns || 3, profilePage: p.profilePage || '', empty: p.empty || 'No posts yet', fill: e.stretch === 'both' || !!e.stretch,
    tabs: String(p.tabs || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((t) => t[0]).map(([label, only = '', look = '']) => ({ label, only, look })),
    actions: String(p.actions || 'comment, repost, like, share').split(',').map((x) => x.trim()).filter(Boolean) }; }
  if ((b = B('uiComposer'))) { const p = P(b); return { kind: 'composer', collection: p.collection || 'Posts', placeholder: p.placeholder || 'What’s happening?' }; }
  if ((b = B('uiStories'))) { const p = P(b); return { kind: 'stories', collection: p.collection || 'Stories', yours: p.yours !== false }; }
  if ((b = B('uiInbox'))) { const p = P(b); return { kind: 'inbox', collection: p.collection || 'Messages', openPage: p.openPage || 'chat', fill: true }; }
  if ((b = B('uiChat'))) { const p = P(b); return { kind: 'chat', collection: p.collection || 'Messages', fill: true }; }
  if ((b = B('uiProfile'))) { const p = P(b); return { kind: 'profile', name: p.name || '{playerName}', handle: p.handle || '{playerHandle}', bio: p.bio || '', stats: String(p.stats || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([label, value]) => ({ label, value: value || '' })).concat(p.stats ? [] : [{ label: 'Posts', value: '{posts_count}' }]), cover: String(p.cover || '@accent').match(/#[0-9a-f]{6}/i)?.[0] || p.cover || '@accent', own: !!p.own }; }
  if ((b = B('uiMarketplace'))) { const p = P(b); return { kind: 'market', collection: p.collection || 'Listings', chatPage: p.chatPage || '', fill: true }; }
  if ((b = B('uiActivity'))) { const p = P(b); return { kind: 'activity', collection: p.collection || 'Notifications', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiBookmarks'))) return { kind: 'feed', collection: 'Posts', look: 'timeline', filter: 'saved = yes', search: '', columns: 3, profilePage: '', empty: 'Nothing saved yet: tap 🔖 on a post', fill: true };
  if ((b = B('uiFriends')) || (b = B('uiWhoToFollow'))) { const p = P(b); return { kind: 'people', collection: 'Profiles', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiAchievements'))) return { kind: 'achievements' };
  if ((b = B('uiTrending'))) { const p = P(b); return { kind: 'trending', collection: p.collection || 'Posts', searchVar: p.searchVar || p.var || '' }; }
  // controls and small parts
  if ((b = B('uiSlider'))) { const p = P(b); return { kind: 'slider', var: p.var || 'volume', min: +p.min || 0, max: p.max == null ? 100 : +p.max, step: +p.step || 1, start: p.start ?? 80 }; }
  if ((b = B('uiSegmented'))) { const p = P(b), o = opts(p.options || 'Easy, Normal, Hard'); return { kind: 'segmented', var: p.var || 'mode', options: o, index: /position/.test(p.store || ''), start: +p.start || 1 }; }
  if ((b = B('uiChips'))) { const p = P(b), o = opts(p.options || 'All, New, Popular'); return { kind: 'chips', var: p.var || 'filter', options: o, start: +p.start || 1, look: p.look || 'filled' }; }
  if ((b = B('uiDropdown'))) { const p = P(b), o = String(p.options || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([label, value]) => ({ label, value: value ?? label })); return { kind: 'dropdown', var: p.var || 'choice', options: o, placeholder: p.placeholder || 'Choose…', label: p.label || '', start: +p.start || 0 }; }
  if ((b = B('uiStepper'))) { const p = P(b); return { kind: 'stepper', var: p.var || 'amount', min: +p.min || 0, max: p.max == null ? 10 : +p.max, step: +p.step || 1, start: p.start ?? 1 }; }
  if ((b = B('uiRating'))) { const p = P(b); return { kind: 'rating', var: p.var || 'rating', max: +p.max || 5, start: p.start ?? 3 }; }
  if ((b = B('uiDivider'))) { const p = P(b); return { kind: 'divider', label: p.label ?? '' }; }
  if ((b = B('uiAvatar'))) { const p = P(b); return { kind: 'avatar', emoji: p.emoji || '', size: H || 64 }; }
  if ((b = B('uiBanner'))) { const p = P(b); return { kind: 'banner', tone: p.kind || 'info', title: p.title || '', text: p.text || text?.value || '', icon: p.icon || '' }; }
  if ((b = B('uiXPBar'))) { const p = P(b); return { kind: 'xpbar', xpVar: p.xpVar || 'xp', levelVar: p.levelVar || 'playerLevel', base: +p.base || 100, growth: +p.growth || 1.4 }; }
  if ((b = B('uiSteps'))) { const p = P(b); return { kind: 'steps', var: p.var || 'step', steps: opts(p.steps || 'Cart, Address, Pay') }; }
  if ((b = B('uiSpinner'))) return { kind: 'spinner' };
  if ((b = B('uiBack'))) { const p = P(b); return { kind: 'button', label: text?.value || '‹ Back', action: 'go back', value: '', amount: 1, plain: true, fill: '', color: color(text?.color) || '@accent', stroke: '', h: H || 40, radius: 12, size: text?.size || 16 }; }
  if ((b = B('uiCounter'))) { const p = P(b); return { kind: 'text', value: `${p.prefix || ''}{${p.var || 'score'}}${p.suffix || ''}`, size: text?.size || 32, weight: String(text?.weight || '800'), color: text?.color || '', align: text?.align || 'center' }; }
  if (e.bar) return { kind: 'bar', var: e.bar.var || 'xp', max: +e.bar.max || 100, h: +e.bar.h || 12, fill: color(e.bar.fill) || '@accent', bg: color(e.bar.bg) || '@line', radius: e.bar.radius ?? 6 };
  if ((b = B('uiList'))) { const p = P(b); if ((p.source || 'these items') === 'these items') return { kind: 'items', items: String(p.items || '').split('\n').map((s) => s.trim()).filter(Boolean) }; }
  const UI = (e.behaviors || []).filter((x) => /^ui|^data/.test(x.type) && !['uiShowIf', 'dataStat'].includes(x.type));
  if (UI.length) { todo.push({ name: e.name || UI[0].type, type: UI[0].type }); return { kind: 'todo', name: e.name || UI[0].type, type: UI[0].type }; }
  if (e.sprite?.src && /^(https?:|data:image)/.test(e.sprite.src)) return { kind: 'image', src: e.sprite.src, h: Math.round((e.sprite.h || e.shape?.h || 160)) };
  if (kids.length || (e.shape && (sh.fill || sh.stroke) && sh.type !== 'line')) return box(); // a card, a badge, a divider line, a picture box
  if (text) return { kind: 'text', ...text };
  if (e.shape && H) return { kind: 'space', h: H }; // an empty shape: room between things
  return null;
}

/** Where an element sits on its page, top to bottom (anchors at the bottom come last). */
const orderOf = (e) => { const a = e.anchor || 'center', g = a.startsWith('top') ? 0 : a.startsWith('bottom') ? 2 : 1, hx = a.endsWith('left') ? 0 : a.endsWith('right') ? 2 : 1; return g * 100000 + (+e.y || 0) + hx * 0.01 + (+e.x || 0) / PAGE_W * 0.001; }; // (top to bottom; in a row, left to right)

/** game: the project JSON (as saved). */
export function appModel(game) {
  const ents = game.entities || [], byParent = new Map(), todo = [];
  for (const e of ents) { const k = e.parent || ''; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(e); }
  const kidsOf = (e) => (byParent.get(e.id) || []).slice().sort((a, b) => orderOf(a) - orderOf(b));
  const beh = (e, t) => (e.behaviors || []).find((b) => b.type === t);
  const P = (b) => (b ? b.params || b : {});
  /** Where a thing sits in its card: the anchor (0, ½ or 1 of the width / height), the offset from it, its size, and how its text lines up. */
  const pinOf = (e) => { const a = e.anchor || 'center', sh = e.shape || {};
    return { fx: /left$/.test(a) ? 0 : /right$/.test(a) ? 1 : 0.5, fy: /^top/.test(a) ? 0 : /^bottom/.test(a) ? 1 : 0.5, x: +e.x || 0, y: +e.y || 0,
      w: e.stretch === 'width' || e.stretch === 'both' ? 0 : +sh.w || (+sh.r || 0) * 2 || +e.sprite?.w || (e.bar ? +e.bar.w : 0) || 0, h: +sh.h || (+sh.r || 0) * 2 || (e.bar ? +e.bar.h : 0) || 0,
      align: e.text?.align || 'center', m: e.stretch === 'width' || e.stretch === 'both' ? +e.margin || 0 : -1, wrap: +e.text?.wrap || 0 }; };
  const build = (e) => {
    const kids = kidsOf(e).map(build).filter(Boolean);
    if (e.row != null && e.row !== '') { const cells = kids.filter((k) => k.pin.m >= 0); cells.forEach((k, i) => { k.pin.cell = i; k.pin.cells = cells.length; }); } // the cells of a row
    const x = elementOf(e, kids, todo); if (x) x.pin = pinOf(e); return x;
  };

  const bar = ents.map((e) => beh(e, 'uiAppBar')).find(Boolean), barP = P(bar);
  const titles = {}; for (const line of String(barP.titles || '').split('\n')) { const m = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/); if (m) titles[m[1]] = m[2]; }
  const nav = ents.map((e) => beh(e, 'uiBottomNav')).find(Boolean), navP = P(nav);
  const rows = (v) => String(v || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((a) => a[0]);
  const bars = bar ? {
    look: barP.look || 'standard', brandPages: String(barP.brandPages ?? 'home').split(',').map((x) => x.trim()).filter(Boolean),
    align: barP.titleAlign && barP.titleAlign !== 'auto' ? barP.titleAlign : barP.style === 'centered' || (barP.look && !['standard', 'facebook', 'instagram'].includes(barP.look)) ? 'center' : 'left',
    avatar: barP.leftAvatar === 'yes' || ((barP.leftAvatar || 'for the look') === 'for the look' && barP.look === 'x'),
    circles: barP.iconStyle && barP.iconStyle !== 'for the look' ? barP.iconStyle : barP.look === 'facebook' ? 'circles' : 'plain', // icon buttons: plain, circles or outlined circles
    actions: rows(barP.actions ?? 'bell | notifications | unread\nsearch | search').map(([icon, does = '', badge = '', only = '']) => ({ icon, does, badge, only: only.split(',').map((x) => x.trim()).filter(Boolean) })).slice(0, 5),
    bg: barP.bg || '#12141f', text: barP.text || '#ffffff', icon: barP.iconColor || barP.text || '#ffffff', border: barP.border !== false, size: +barP.titleSize || 19, // (the App Bar's own default colours)
  } : null;
  const navStyle = navP.style || 'pill', navLabels = navP.labels && navP.labels !== 'auto' ? navP.labels : { minimal: 'never', bubble: 'selected only', 'raised center': 'always', curved: 'selected only', dock: 'never', outline: 'never' }[navStyle] || 'always';
  const navs = nav ? { style: navStyle, labels: navLabels, margin: +(navP.margin ?? 14), bar: navP.barColor || '#12141f', active: navP.activeColor || '#4fa3ff', idle: navP.idleColor || '#8b90a5', on: navP.onColor || '#ffffff' } : null; // (the Bottom Nav's own defaults)
  const tabs = String(navP.tabs || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((t) => t[0] && t[2] && !/^(msg|button|url):/.test(t[2])).map(([label, icon, page, badge]) => ({ label, icon: icon || 'circle', page, badge: badge || '' }));

  const pages = [];
  for (const e of ents) {
    const s = beh(e, 'uiShowIf'); if (!s) continue;
    const p = P(s); if ((p.var || 'page') !== 'page' || p.value == null || p.value === '') continue;
    const items = kidsOf(e).map(build).filter(Boolean);
    const fab = items.find((x) => x.kind === 'button' && x.fab) || null;
    const value = String(p.value);
    pages.push({ value, name: e.name || value, home: !!p.whenUnset, title: titles[value] || (e.name || value).replace(/\s*Page$/i, ''), items: items.filter((x) => x !== fab), fab });
  }
  if (!pages.length) pages.push({ value: 'home', name: 'Home', home: true, title: game.settings?.appName || game.name || 'Home', items: [], fab: null });
  const home = (pages.find((p) => p.home) || pages.find((p) => p.value === (game.vars?.page ?? '')) || pages[0]).value;

  const stats = [];
  for (const e of ents) for (const b of e.behaviors || []) if (b.type === 'dataStat') { const p = P(b); if (p.var) stats.push({ var: p.var, collection: p.collection || '', how: p.how || 'count', field: fieldKey(p.field || ''), filter: p.filter || '', format: p.format || 'number' }); }

  const collections = (game.collections || []).map((c) => ({
    name: c.name, fields: (c.fields || []).map((f) => ({ name: f.name, key: fieldKey(f.name), type: f.type || 'text', options: String(f.options || '').split(',').map((s) => s.trim()).filter(Boolean), def: f.default ?? '' })),
    rows: (c.rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k === '_at' ? k : fieldKey(k), v]))), // (_at: when it was added; it keeps its name)
  }));
  // a feed whose collection isn't there shows sample posts in the editor: the native app gets them as its Posts
  const feedColls = new Set(); const look = (x) => { if (['feed', 'trending', 'composer'].includes(x.kind) && x.collection) feedColls.add(x.collection); (x.children || []).forEach(look); };
  for (const p of pages) { p.items.forEach(look); if (p.fab) look(p.fab); }
  for (const name of feedColls) if (!collections.some((c) => fieldKey(c.name) === fieldKey(name))) collections.push({ name, sample: true, fields: POST_FIELDS.map(([n, type]) => ({ name: n, key: fieldKey(n), type, options: [], def: type === 'number' ? 0 : type === 'yes/no' ? false : '' })), rows: samplePosts() });
  const vars = {}; for (const [k, v] of Object.entries(game.vars || {})) if (k !== 'page' && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) vars[k] = v;
  // controls start with their own value when the project hasn't set the variable (a slider at 80, the 2nd tab picked…)
  const startOf = (x) => { switch (x.kind) {
    case 'slider': case 'stepper': case 'rating': return +x.start;
    case 'segmented': return x.index ? x.start : x.options[x.start - 1] ?? x.options[0];
    case 'chips': return x.options[x.start - 1] ?? x.options[0];
    case 'dropdown': return x.start ? x.options[x.start - 1]?.value : undefined;
    case 'toggle': return x.var === 'darkMode' ? undefined : !!x.start;
    default: return undefined; } };
  const walk = (x) => { const v = x.var && startOf(x); if (v !== undefined && !(x.var in vars) && !(x.var in (game.vars || {}))) vars[x.var] = v; (x.children || []).forEach(walk); };
  for (const p of pages) p.items.forEach(walk);
  return {
    name: game.settings?.appName || game.name || 'My App', accent: game.settings?.appAccent || '', theme: themeOf(game),
    appBar: !!bar, bar: bars, nav: navs, tabs: tabs.filter((t) => pages.some((p) => p.value === t.page)), pages, home, titles, collections, stats, vars, todo,
  };
}

/** Light or dark, the way the editor decides: the darkMode variable, else the theme picked, else (none picked) the background's brightness. */
function themeOf(game) {
  const v = game.vars?.darkMode;
  if (v !== undefined && v !== '' && v !== null) return [true, 1, '1', 'on', 'yes', 'dark'].includes(v) ? 'dark' : 'light';
  const bg = String(game.background || ''), t = game.settings?.appTheme;
  if (!t && /^#[0-9a-f]{3,8}$/i.test(bg)) { let h = bg.slice(1); if (h.length < 6) h = [...h.slice(0, 3)].map((c) => c + c).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5 ? 'dark' : 'light'; }
  return t || 'light';
}
const POST_FIELDS = [['Author', 'text'], ['Handle', 'text'], ['Text', 'long text'], ['Media', 'text'], ['Color', 'text'], ['Likes', 'number'], ['Liked', 'yes/no'], ['Comments', 'number'], ['Reposts', 'number'], ['Reposted', 'yes/no'], ['Saved', 'yes/no'], ['Verified', 'yes/no'], ['Location', 'text']];
/** The editor's sample posts (what a feed shows before the app has a Posts collection). */
const samplePosts = () => { const t = Date.now(); return [
  { id: 'p1', author: 'Maya Chen', handle: 'maya', text: 'First light over the mountains this morning. Worth the 5am alarm.', media: '🏔️ | 🌄 | 🌲', color: '#4f7cff', likes: 1284, liked: false, comments: 48, reposts: 120, verified: true, location: 'Banff', _at: t - 7 * 60e3 },
  { id: 'p2', author: 'Leo Park', handle: 'leop', text: 'Shipped the new update! Dark mode, faster sync and a lot fewer bugs. Tell me what you think 👇', media: '', color: '', likes: 312, liked: true, comments: 27, reposts: 41, verified: false, _at: t - 2.5 * 3600e3 },
  { id: 'p6', author: 'Jon Doe', handle: 'jondoe', text: 'This is the kind of morning I need 🙌', media: '', color: '', likes: 41, liked: false, comments: 3, reposts: 1, verified: false, _at: t - 3 * 60e3 },
  { id: 'p5', author: 'Ava Brooks', handle: 'avab', text: 'Going live with a sketching session — come say hi!', media: '🎨', color: '#c2185b', likes: 77, liked: false, comments: 9, reposts: 3, verified: false, _at: t - 40 * 60e3 },
  { id: 'p3', author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Homemade pasta night 🍝', media: '🍝', color: '#ff7a45', likes: 958, liked: false, comments: 63, reposts: 12, verified: false, _at: t - 26 * 3600e3 },
  { id: 'p4', author: 'Pocket News', handle: 'pocketnews', text: 'Scientists spot a new comet that will be visible without a telescope next month.', media: '', color: '', likes: 5420, liked: false, comments: 410, reposts: 1900, verified: true, _at: t - 3 * 86400e3 },
]; };

/** The app's colour tokens (@bg, @accent…) for light and dark; the accent is the app's own. */
export const PALETTES = {
  light: { bg: '#f4f6fb', card: '#ffffff', text: '#1c1f26', sub: '#6b7280', line: '#e5e7eb', field: '#f2f4f7', bar: '#ffffff', accent: '#3a7bfd', onAccent: '#ffffff', danger: '#ef4444', good: '#10b981' },
  dark: { bg: '#0f1115', card: '#1b1e25', text: '#f3f4f6', sub: '#9ca3af', line: '#2a2f38', field: '#252a33', bar: '#16191f', accent: '#6ea0ff', onAccent: '#0b1020', danger: '#f87171', good: '#34d399' },
};
/** "@accent" → the token name; "#ff0000" → null (a fixed colour). */
export const tokenOf = (c) => { const m = /^@(\w+)$/.exec(String(c || '')); return m && PALETTES.light[m[1]] ? m[1] : null; };
/** Pocket icon names → Material icon / SF Symbol names. */
export const ICONS = {
  home: ['home', 'house'], search: ['search', 'magnifyingglass'], explore: ['explore', 'safari'], user: ['person', 'person'], profile: ['person', 'person'], users: ['group', 'person.2'], chat: ['chat_bubble_outline', 'bubble.left'],
  bell: ['notifications_none', 'bell'], heart: ['favorite_border', 'heart'], star: ['star_border', 'star'], settings: ['settings', 'gearshape'], gear: ['settings', 'gearshape'], plus: ['add', 'plus'], add: ['add', 'plus'],
  list: ['list', 'list.bullet'], check: ['check', 'checkmark'], calendar: ['calendar_today', 'calendar'], clock: ['schedule', 'clock'], video: ['play_circle_outline', 'play.rectangle'], play: ['play_arrow', 'play'],
  shop: ['storefront', 'bag'], cart: ['shopping_cart', 'cart'], trophy: ['emoji_events', 'trophy'], map: ['map', 'map'], camera: ['photo_camera', 'camera'], image: ['image', 'photo'], edit: ['edit', 'pencil'],
  trash: ['delete_outline', 'trash'], info: ['info_outline', 'info.circle'], menu: ['menu', 'line.3.horizontal'], bookmark: ['bookmark_border', 'bookmark'], wallet: ['account_balance_wallet', 'creditcard'], money: ['attach_money', 'dollarsign.circle'],
  chart: ['bar_chart', 'chart.bar'], note: ['sticky_note_2', 'note.text'], book: ['menu_book', 'book'], music: ['music_note', 'music.note'], globe: ['public', 'globe'], gamepad: ['sports_esports', 'gamecontroller'], circle: ['circle', 'circle'],
  // the rest of the editor's icons
  pause: ['pause', 'pause'], close: ['close', 'xmark'], back: ['arrow_back', 'chevron.left'], next: ['arrow_forward', 'chevron.right'], sound: ['volume_up', 'speaker.wave.2'], lock: ['lock_outline', 'lock'],
  moon: ['dark_mode', 'moon'], sun: ['light_mode', 'sun.max'], filter: ['filter_list', 'line.3.horizontal.decrease'], sort: ['sort', 'arrow.up.arrow.down'], share: ['ios_share', 'square.and.arrow.up'],
  mail: ['mail_outline', 'envelope'], phone: ['phone', 'phone'], pin: ['place', 'mappin'], grid: ['grid_view', 'square.grid.2x2'], download: ['download', 'arrow.down.circle'], refresh: ['refresh', 'arrow.clockwise'],
  more: ['more_horiz', 'ellipsis'], coin: ['monetization_on', 'dollarsign.circle'], gem: ['diamond', 'diamond'], flag: ['flag', 'flag'], gift: ['card_giftcard', 'gift'], tag: ['sell', 'tag'], key: ['key', 'key'],
  shield: ['shield', 'shield'], bolt: ['bolt', 'bolt'], fire: ['local_fire_department', 'flame'], link: ['link', 'link'], eye: ['visibility', 'eye'], 'eye-off': ['visibility_off', 'eye.slash'], unlock: ['lock_open', 'lock.open'],
  sliders: ['tune', 'slider.horizontal.3'], cloud: ['cloud_queue', 'cloud'], upload: ['upload', 'arrow.up.circle'], wifi: ['wifi', 'wifi'], battery: ['battery_full', 'battery.100'], compass: ['explore', 'safari'],
  navigate: ['navigation', 'location.north'], send: ['send', 'paperplane'], attach: ['attach_file', 'paperclip'], mic: ['mic_none', 'mic'], headphones: ['headphones', 'headphones'], dice: ['casino', 'dice'],
  crown: ['workspace_premium', 'crown'], rocket: ['rocket_launch', 'paperplane'], target: ['gps_fixed', 'scope'], medal: ['military_tech', 'rosette'], 'thumbs-up': ['thumb_up_off_alt', 'hand.thumbsup'],
  smile: ['sentiment_satisfied', 'face.smiling'], 'user-plus': ['person_add', 'person.badge.plus'], logout: ['logout', 'rectangle.portrait.and.arrow.right'], login: ['login', 'person.crop.circle'], copy: ['content_copy', 'doc.on.doc'],
  file: ['description', 'doc'], folder: ['folder_open', 'folder'], inbox: ['inbox', 'tray'], card: ['credit_card', 'creditcard'], bag: ['shopping_bag', 'bag'], percent: ['percent', 'percent'], truck: ['local_shipping', 'shippingbox'],
  undo: ['undo', 'arrow.uturn.backward'], 'zoom-in': ['zoom_in', 'plus.magnifyingglass'], expand: ['open_in_full', 'arrow.up.left.and.arrow.down.right'], minus: ['remove', 'minus'], 'x-circle': ['cancel', 'xmark.circle'],
  'check-circle': ['check_circle_outline', 'checkmark.circle'], alert: ['warning_amber', 'exclamationmark.triangle'], help: ['help_outline', 'questionmark.circle'], sparkles: ['auto_awesome', 'sparkles'], bulb: ['lightbulb_outline', 'lightbulb'],
  palette: ['palette', 'paintpalette'], code: ['code', 'chevron.left.forwardslash.chevron.right'], layers: ['layers', 'square.3.layers.3d'], 'skip-next': ['skip_next', 'forward.end'], 'skip-back': ['skip_previous', 'backward.end'],
  mute: ['volume_off', 'speaker.slash'], repeat: ['repeat', 'repeat'], shuffle: ['shuffle', 'shuffle'], hourglass: ['hourglass_empty', 'hourglass'], podium: ['leaderboard', 'chart.bar'], news: ['newspaper', 'newspaper'],
  paw: ['pets', 'pawprint'], leaf: ['eco', 'leaf'], drop: ['water_drop', 'drop'], coffee: ['local_cafe', 'cup.and.saucer'], media: ['perm_media', 'photo.on.rectangle'],
};
/** The icons the App Bar and Bottom Nav show (they're drawn with the editor's own line icons). */
export const barIcons = (model) => [...new Set([...model.tabs.map((t) => t.icon), ...(model.bar?.actions || []).flatMap((a) => (a.icon === 'theme' || /dark mode/.test(a.does) ? ['sun', 'moon', a.icon] : [a.icon]))])].filter(Boolean);
export const iconFor = (name, i) => (ICONS[String(name || '').toLowerCase()] || ICONS.circle)[i];
