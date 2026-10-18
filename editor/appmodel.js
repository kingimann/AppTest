// App model: an app project read as pages, components, tabs and data, the shape the native code exports
// (Flutter widgets, SwiftUI views) are written from. What has no native version yet is kept as a "todo" with its name.

const fieldKey = (n) => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
const PAGE_W = 400;

/** What a page has in it that turns into a native element; null for things the native app doesn't need (the page itself, App Logic). */
function elementOf(e, kids, todo) {
  const B = (t) => (e.behaviors || []).find((b) => b.type === t), P = (b) => b.params || b; // (saved games keep params flat on the behavior)
  const color = (c) => (c == null || c === '' ? '' : String(c));
  const text = e.text && String(e.text.value ?? '') !== '' ? { value: String(e.text.value), size: +e.text.size || 16, weight: String(e.text.weight || '600'), color: color(e.text.color) } : null;
  let b;
  if ((b = B('uiDataList'))) { const p = P(b); return { kind: 'list', collection: p.collection || '', title: p.title || '{title}', subtitle: p.subtitle || '', icon: p.icon || '', check: p.check || '', search: p.search || '', filter: p.filter || '', sort: p.sort || 'newest first', openPage: p.openPage || '', empty: p.empty || 'Nothing here yet', fill: e.stretch === 'both' }; }
  if ((b = B('uiForm'))) { const p = P(b); return { kind: 'form', collection: p.collection || '', fields: String(p.fields || '').split(',').map((s) => s.trim()).filter(Boolean).map(fieldKey), mode: /always adds/.test(p.mode || '') ? 'new' : /always changes/.test(p.mode || '') ? 'edit' : 'auto', saveLabel: p.saveLabel || 'Save', after: p.after || 'go back', page: p.page || '', fill: e.stretch === 'both' }; }
  if ((b = B('uiInput')) || (b = B('uiSearchBar'))) { const p = P(b); return { kind: 'input', var: p.var || 'text', placeholder: p.placeholder || '', keyboard: p.kind || (b.type === 'uiSearchBar' ? 'search' : 'text') }; }
  if ((b = B('uiToggle'))) { const p = P(b); return { kind: 'toggle', var: p.var || 'on', label: text?.value || p.onText || '', start: !!p.start }; }
  if ((b = B('button'))) {
    const p = P(b), sh = e.shape || {};
    return { kind: 'button', label: text?.value || e.name || 'Button', action: p.action || 'message', value: p.value ?? '', amount: p.amount ?? 1,
      fab: sh.type === 'circle' && /bottom/.test(e.anchor || ''), outlined: !!sh.stroke && (!sh.fill || /card|bg/.test(String(sh.fill))), fill: color(sh.fill), color: color(text?.color) };
  }
  // social components: native versions that read the same data collections
  if ((b = B('uiFeed'))) { const p = P(b); return { kind: 'feed', collection: p.collection || 'Posts', look: p.look || 'timeline', filter: p.filter || '', search: p.searchVar || '', columns: +p.gridColumns || 3, profilePage: p.profilePage || '', empty: p.empty || 'No posts yet', fill: e.stretch === 'both' || !!e.stretch }; }
  if ((b = B('uiComposer'))) { const p = P(b); return { kind: 'composer', collection: p.collection || 'Posts', placeholder: p.placeholder || 'What’s happening?' }; }
  if ((b = B('uiStories'))) { const p = P(b); return { kind: 'stories', collection: p.collection || 'Stories' }; }
  if ((b = B('uiInbox'))) { const p = P(b); return { kind: 'inbox', collection: p.collection || 'Messages', openPage: p.openPage || 'chat', fill: true }; }
  if ((b = B('uiChat'))) { const p = P(b); return { kind: 'chat', collection: p.collection || 'Messages', fill: true }; }
  if ((b = B('uiProfile'))) { const p = P(b); return { kind: 'profile', name: p.name || '{playerName}', handle: p.handle || '{playerHandle}', bio: p.bio || '', stats: String(p.stats || '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x[0]).map(([label, value]) => ({ label, value: value || '' })).concat(p.stats ? [] : [{ label: 'Posts', value: '{posts_count}' }]), cover: String(p.cover || '@accent').match(/#[0-9a-f]{6}/i)?.[0] || p.cover || '@accent', own: !!p.own }; }
  if ((b = B('uiMarketplace'))) { const p = P(b); return { kind: 'market', collection: p.collection || 'Listings', chatPage: p.chatPage || '', fill: true }; }
  if ((b = B('uiActivity'))) { const p = P(b); return { kind: 'activity', collection: p.collection || 'Notifications', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiBookmarks'))) return { kind: 'feed', collection: 'Posts', look: 'timeline', filter: 'saved = yes', search: '', columns: 3, profilePage: '', empty: 'Nothing saved yet: tap 🔖 on a post', fill: true };
  if ((b = B('uiFriends')) || (b = B('uiWhoToFollow'))) { const p = P(b); return { kind: 'people', collection: 'Profiles', profilePage: p.profilePage || '', fill: true }; }
  if ((b = B('uiAchievements'))) return { kind: 'achievements' };
  if ((b = B('uiTrending'))) { const p = P(b); return { kind: 'trending', collection: p.collection || 'Posts', searchVar: p.searchVar || p.var || '' }; }
  if ((b = B('uiList'))) { const p = P(b); if ((p.source || 'these items') === 'these items') return { kind: 'items', items: String(p.items || '').split('\n').map((s) => s.trim()).filter(Boolean) }; }
  const UI = (e.behaviors || []).filter((x) => /^ui|^data/.test(x.type) && !['uiShowIf', 'dataStat'].includes(x.type));
  if (UI.length) { todo.push({ name: e.name || UI[0].type, type: UI[0].type }); return { kind: 'todo', name: e.name || UI[0].type, type: UI[0].type }; }
  if (kids.length) return { kind: 'row', fill: color(e.shape?.fill), children: kids }; // a card with things in it (a settings row)
  if (e.sprite?.src && /^(https?:|data:image)/.test(e.sprite.src)) return { kind: 'image', src: e.sprite.src, h: Math.round((e.sprite.h || e.shape?.h || 160)) };
  if (text) return { kind: 'text', ...text };
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
  const build = (e) => { const kids = kidsOf(e).map(build).filter(Boolean); return elementOf(e, kids, todo); };

  const bar = ents.map((e) => beh(e, 'uiAppBar')).find(Boolean), barP = P(bar);
  const titles = {}; for (const line of String(barP.titles || '').split('\n')) { const m = line.match(/^\s*([^=]+?)\s*=\s*(.+?)\s*$/); if (m) titles[m[1]] = m[2]; }
  const nav = ents.map((e) => beh(e, 'uiBottomNav')).find(Boolean), navP = P(nav);
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
    rows: (c.rows || []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [fieldKey(k), v]))),
  }));
  const vars = {}; for (const [k, v] of Object.entries(game.vars || {})) if (k !== 'page' && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')) vars[k] = v;
  return {
    name: game.settings?.appName || game.name || 'My App', accent: game.settings?.appAccent || '#3a7bfd', theme: game.settings?.appTheme || 'follow the phone',
    appBar: !!bar, tabs: tabs.filter((t) => pages.some((p) => p.value === t.page)), pages, home, titles, collections, stats, vars, todo,
  };
}

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
  shop: ['shopping_bag', 'bag'], cart: ['shopping_cart', 'cart'], trophy: ['emoji_events', 'trophy'], map: ['map', 'map'], camera: ['photo_camera', 'camera'], image: ['image', 'photo'], edit: ['edit', 'pencil'],
  trash: ['delete_outline', 'trash'], info: ['info_outline', 'info.circle'], menu: ['menu', 'line.3.horizontal'], bookmark: ['bookmark_border', 'bookmark'], wallet: ['account_balance_wallet', 'creditcard'], money: ['attach_money', 'dollarsign.circle'],
  chart: ['bar_chart', 'chart.bar'], note: ['sticky_note_2', 'note.text'], book: ['menu_book', 'book'], music: ['music_note', 'music.note'], globe: ['public', 'globe'], gamepad: ['sports_esports', 'gamecontroller'], circle: ['circle', 'circle'],
};
export const iconFor = (name, i) => (ICONS[String(name || '').toLowerCase()] || ICONS.circle)[i];
