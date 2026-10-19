// Native App Preview: try the app the way the native exports build it (Flutter, Kotlin / Compose, SwiftUI, React Native) and browse their
// code, right in the editor. The preview runs the same model and the same rules as the native runtimes (lib/pocket.dart,
// Pocket.kt, Pocket.swift): pages, tabs, back, Data Lists, Forms, stats, {variables}. Material look for Flutter and Kotlin,
// iOS look for SwiftUI. Nothing is compiled here: Download gives the real project.
import { appModel, PALETTES, LATER_KINDS } from './appmodel.js';
import { names, labelW } from './nativecode.js';
import { SPRITE_ART } from '../engine/pocket.js';

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && !k.startsWith('data-')) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const keyOf = (n) => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
const show = (v) => (v == null ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v));
const num = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? +v : v == null || v === '' || isNaN(+v) ? null : +v);
const isOn = (v) => v === true || v === 1 || v === 'yes' || v === 'true';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ICON_SVG = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17l-5-5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  chat: 'M4 5h16v11H8l-4 4z', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 4h4', heart: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z', star: 'M12 3l2.7 6 6.3.6-4.8 4.2 1.5 6.2L12 17l-5.7 3 1.5-6.2L3 9.6 9.3 9z',
  comment: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z', repost: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4', views: 'M5 20V10M10 20V4M15 20v-7M20 20v-4',
  bookmark: 'M6 3h12v18l-6-4-6 4z', share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6', more: 'M5 12h.01M12 12h.01M19 12h.01', moon: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z', sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21a8 8 0 0 1 16 0M17 3.5a4 4 0 0 1 0 7.5M23 21a7 7 0 0 0-4-6.3', info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01', back: 'M15 18l-6-6 6-6', check2: 'M5 12l5 5L20 7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z', plus: 'M12 5v14M5 12h14', video: 'M4 6h12v12H4zm12 4l5-3v10l-5-3', list: 'M4 6h16M4 12h16M4 18h16', circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
};
/** The App Bar's and Bottom Nav's icons: the editor's own (its line icons, or a picture / emoji), the way the editor draws them. */
const UI_FIRST = new Set(['key', 'shield', 'fire', 'drop', 'flag', 'potion', 'sword', 'crown', 'rocket', 'cloud', 'leaf', 'skull']);
const navIcon = (name) => {
  const n = String(name || 'circle');
  if (!/^ui-|^[a-z][a-zA-Z-]+$/.test(n)) return h('span', { class: 'npv-ic npv-emo' }, n);
  const k = n.startsWith('ui-') || (SPRITE_ART[n] && !UI_FIRST.has(n)) ? n : 'ui-' + n, art = SPRITE_ART[k];
  if (!art) return svgIcon(n);
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('class', 'npv-ic art');
  s.innerHTML = art.replace(/#fff(fff)?\b/gi, 'currentColor'); return s;
};
const ICON_ALIAS = { explore: 'search', profile: 'user', friends: 'users', gear: 'settings', add: 'plus', play: 'video', menu: 'list' };
const svgIcon = (name) => { const d = ICON_SVG[ICON_ALIAS[name] || name] || ICON_SVG.circle; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'npv-ic'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };

/** Fits the phone to the space it has (or a size you pick with − / +): sets --npv-zoom on the preview. */
function zoomer(root, box, phone) {
  let mode = 'fit', shown = 1;
  const label = h('button', { class: 'npv-btn npv-zl', title: 'Fit the phone to the space' }, 'Fit');
  const apply = () => {
    let z = mode;
    if (mode === 'fit') {
      const others = [...box.children].filter((c) => c !== phone && !c.hidden).reduce((a, c) => a + c.offsetHeight + 10, 0);
      z = Math.max(0.4, Math.min(1.8, (box.clientWidth - 24) / 380, (box.clientHeight - 32 - others) / 740));
    }
    shown = Math.round(z * 100) / 100;
    root.style.setProperty('--npv-zoom', String(shown));
    label.textContent = `${Math.round(shown * 100)}%`; label.classList.toggle('on', mode === 'fit'); label.title = mode === 'fit' ? 'Sized to fit (tap − or + to pick a size)' : 'Tap to fit the phone to the space';
  };
  label.onclick = () => { mode = 'fit'; apply(); };
  const step = (d) => { mode = Math.max(0.4, Math.min(2, Math.round((shown + d) * 10) / 10)); apply(); };
  const controls = h('div', { class: 'npv-zoom' }, h('button', { class: 'npv-btn', 'aria-label': 'Smaller', onclick: () => step(-0.1) }, '−'), label, h('button', { class: 'npv-btn', 'aria-label': 'Bigger', onclick: () => step(0.1) }, '+'));
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => apply()) : null;
  ro?.observe(box);
  return { controls, apply, stop: () => ro?.disconnect() };
}
/** Docked in the scene view (host) or full screen; the button switches. */
function placer(root, host, redraw) {
  const place = (docked) => { root.classList.toggle('docked', docked); (docked ? host : document.body).append(root); redraw(); };
  const button = () => host && h('button', { class: 'npv-btn', title: root.classList.contains('docked') ? 'Full screen' : 'Back into the scene view', 'aria-label': 'Full screen', onclick: () => place(!root.classList.contains('docked')) }, root.classList.contains('docked') ? '⤢' : '⊡');
  return { place, button };
}

/** The app's state, with the same rules as the native runtimes. */
function makeApp(model) {
  const A = { vars: { ...model.vars }, data: {}, tab: 0, stacks: model.tabs.length ? model.tabs.map(() => []) : [[]], openCollection: null, openId: null, roots: {} };
  A.def = (name) => model.collections.find((c) => c.name === name);
  A.rows = (name) => A.data[name] || [];
  // starting rows: missing fields get their defaults; later rows count as newer (the same as the engine)
  const fieldDef = (f) => (f.def !== '' && f.def != null ? (f.type === 'yes/no' ? isOn(f.def) : ['number', 'money', 'rating'].includes(f.type) ? +f.def || 0 : f.def === 'today' && f.type === 'date' ? today() : f.def)
    : f.type === 'yes/no' ? false : f.type === 'date' ? today() : f.type === 'choice' ? f.options[0] || '' : ['number', 'money', 'rating'].includes(f.type) ? 0 : '');
  A.blank = (name) => Object.fromEntries((A.def(name)?.fields || []).map((f) => [f.key, fieldDef(f)]));
  for (const c of model.collections) A.data[c.name] = c.rows.map((r, i) => ({ ...A.blank(c.name), ...r, _id: 's' + i, _at: r._at ?? i }));
  A.opened = () => (A.openCollection && A.openId ? A.rows(A.openCollection).find((r) => r._id === A.openId) || null : null);
  /** How a value reads: dates as Today / Tomorrow / 3 Mar, money with $ (the engine's fieldText). */
  A.text = (coll, k, v) => {
    const f = A.def(coll)?.fields.find((x) => x.key === k); if (v == null || v === '') return '';
    if (f?.type === 'money') { const n = +v || 0; return (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(2).replace(/\.00$/, ''); }
    if (f?.type === 'date') { const k0 = String(v).slice(0, 10), d = new Date(k0 + 'T00:00'); if (isNaN(d)) return show(v); const day = (n) => { const x = new Date(Date.now() + n * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
      return k0 === day(0) ? 'Today' : k0 === day(-1) ? 'Yesterday' : k0 === day(1) ? 'Tomorrow' : d.toLocaleDateString('en', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) }); }
    if (f?.type === 'yes/no') return isOn(v) ? '✓' : '';
    return show(v);
  };
  A.fill = (t, row, coll) => String(t).replace(/\{(\w+)\}/g, (m, k) => (row && k in row ? (coll ? A.text(coll, k, row[k]) : show(row[k])) : k.startsWith('record_') ? (A.openCollection ? A.text(A.openCollection, k.slice(7), A.opened()?.[k.slice(7)]) : '') : show(A.vars[k])));
  const passes = (r, filter) => {
    if (!String(filter).trim()) return true;
    for (const part of String(filter).split(/\s+and\s+/i)) {
      const m = /^\s*(\w[\w ]*?)\s*(!=|≠|>=|≥|<=|≤|=|>|<)\s*(.*?)\s*$/.exec(part); if (!m) continue;
      const v = r[m[1].toLowerCase().replace(/ /g, '_')], op = m[2], raw = m[3];
      if (/^(yes|no)$/i.test(raw)) { if ((op === '=') !== (isOn(v) === /^yes$/i.test(raw))) return false; continue; }
      const want = num(raw), a = num(v);
      if (want != null && a != null) { const ok = { '=': a === want, '!=': a !== want, '≠': a !== want, '>': a > want, '<': a < want, '>=': a >= want, '≥': a >= want }[op] ?? a <= want; if (!ok) return false; continue; }
      const same = show(v).toLowerCase() === raw.toLowerCase();
      if ((op === '=' && !same) || ((op === '!=' || op === '≠') && same)) return false;
    }
    return true;
  };
  A.query = (name, filter = '', search = '', sort = 'newest first') => {
    const fields = A.def(name)?.fields || [], q = String(search).trim().toLowerCase();
    let L = A.rows(name).filter((r) => passes(r, A.fill(filter)));
    if (q) L = L.filter((r) => fields.some((f) => ['text', 'long text', 'choice', 'icon'].includes(f.type) && show(r[f.key]).toLowerCase().includes(q)));
    const s = String(sort).toLowerCase();
    if (s === 'newest first') return L.sort((a, b) => (b._at || 0) - (a._at || 0));
    if (s === 'oldest first') return L.sort((a, b) => (a._at || 0) - (b._at || 0));
    const m = /^(.+?)(?:\s+\((a-z|z-a|low-high|high-low)\))?$/.exec(s), key = m?.[1].trim().replace(/[^a-z0-9]+/g, '_'), dir = /z-a|high-low/.test(m?.[2] || '') ? -1 : 1;
    return key ? L.sort((a, b) => { const x = num(a[key]), y = num(b[key]); return dir * (x != null && y != null ? x - y : show(a[key]).localeCompare(show(b[key]))); }) : L;
  };
  A.stat = (name, how, field, filter) => {
    const L = A.query(name, filter, '', 'oldest first'); if (how === 'count') return L.length;
    const ns = L.map((r) => num(r[field]) ?? 0); if (!ns.length) return 0;
    const sum = ns.reduce((a, b) => a + b, 0);
    return how === 'sum' ? Math.round(sum * 100) / 100 : how === 'average' ? Math.round(sum / ns.length * 100) / 100 : how === 'min' ? Math.min(...ns) : Math.max(...ns);
  };
  /** Stats, {posts_count}-style counts, and the social counts the engine keeps ({unread}, {notifications_unread}, {friend_requests}). */
  A.work = () => {
    const me = show(A.vars.playerHandle) || (show(A.vars.playerName) || 'You').toLowerCase().replace(/\s+/g, ''), mine = new Set(model.stats.map((s) => s.var));
    for (const c of model.collections) A.vars[c.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_count'] = A.rows(c.name).length;
    if (A.def('Notifications')) A.vars.notifications_unread = A.rows('Notifications').filter((r) => show(r.to) === me && !isOn(r.read)).length;
    if (A.def('Friends')) A.vars.friend_requests = A.rows('Friends').filter((r) => show(r.status) !== 'accepted' && show(r.to) === me).length;
    if (A.def('Messages') && !mine.has('unread')) { const read = {}; for (const r of A.rows('Reads')) if (show(r.handle) === me) read[r.chat] = +r.at || 0;
      A.vars.unread = A.rows('Messages').filter((r) => show(r.handle) !== me && (r._at || 0) > (read[r.chat] || 0)).length; }
    for (const s of model.stats) A.vars[s.var] = A.stat(s.collection, s.how, s.field, s.filter);
  };
  A.set = (k, v) => { A.vars[k] = v; A.work(); };
  A.add = (k, by) => A.set(k, (num(A.vars[k]) ?? 0) + by);
  A.addRecord = (name, values) => { (A.data[name] ||= []).push({ _id: 'r' + Math.random().toString(36).slice(2), _at: Date.now(), ...values }); A.work(); };
  A.updateRecord = (name, id, values) => { const r = A.rows(name).find((x) => x._id === id); if (r) Object.assign(r, values); A.work(); };
  A.deleteRecord = (name, id) => { A.data[name] = A.rows(name).filter((x) => x._id !== id); A.work(); };
  A.stack = () => A.stacks[Math.min(A.tab, A.stacks.length - 1)];
  A.go = (page) => {
    const i = model.tabs.findIndex((t) => t.page === page);
    if (i >= 0) { A.tab = i; A.stacks[i] = []; return; }
    if (page === model.home && !model.tabs.length) { A.stacks[0] = []; return; }
    if (model.pages.some((p) => p.value === page)) A.stack().push({ page, key: Math.random(), form: null });
  };
  A.back = () => { A.stack().pop(); };
  A.run = (action, value, amount = 1) => {
    const v = show(value);
    switch (action) {
      case 'go to page': A.go(v); break;
      case 'go back': A.back(); break;
      case 'set variable': A.set(v, amount); break;
      case 'add to variable': A.add(v, +amount || 0); break;
      case 'new record': A.openId = null; A.go(v); break;
      case 'edit opened record': A.go(v); break;
      case 'delete opened record': if (A.openCollection && A.openId) { A.deleteRecord(A.openCollection, A.openId); A.openId = null; } A.back(); break;
      case 'message': A.send(v); break;
      default: return `“${action}” has no native version yet (a TODO in the code)`;
    }
    return '';
  };
  /** Messages (a button's "message" action): what's listening hears them, the same as app.send in the native code. */
  A.listeners = [];
  A.send = (m) => { const t = A.fill(m).trim(); if (t) for (const f of [...A.listeners]) f(t); };
  A.work();
  return A;
}

/** opts: { game, files(kind) → Promise<[{name, data}]>, download(kind), toast(msg) } */
export function openNativePreview({ game, files, download, toast = () => {}, host = null }) {
  const read = () => (typeof game === 'function' ? game() : game);
  /** The model, with the records saved on this device (what the editor's scene shows after you've tried the app). */
  const build = () => { const g = read(), m = appModel(g);
    for (const c of m.collections) { const d = (g.collections || []).find((q) => q.name === c.name); if (!d || d.keep === false) continue;
      try { const v = JSON.parse(localStorage.getItem('pocket.data.' + (g.name || 'game') + '.' + keyOf(c.name)) || 'null'); if (Array.isArray(v)) c.rows = v; } catch { /* nothing saved */ } }
    return m; };
  let model = build(), N = names(model);
  let kind = 'flutter', view = 'app', A = makeApp(model), codeFiles = null, codeSel = '', note = '';
  const dark = () => { const d = A.vars.darkMode; return d !== undefined && d !== '' && d !== null ? [true, 1, '1', 'on', 'yes', 'dark'].includes(d) : model.theme === 'dark' ? true : model.theme === 'light' ? false : matchMedia('(prefers-color-scheme: dark)').matches; };
  const pal = () => { const P = dark() ? { ...PALETTES.dark } : { ...PALETTES.light }; if (model.accent) P.accent = model.accent; return P; }; // (the app's accent in dark mode too, like the editor)
  const col = (c, P) => { if (!c) return null; const t = /^@(\w+)$/.exec(c); return t ? P[t[1]] || null : /^#[0-9a-f]{6}$/i.test(c) ? c : null; };

  const phone = h('div', { class: 'npv-phone' }), codeBox = h('div', { class: 'npv-code' });
  const seg = (items, cur, pick) => h('div', { class: 'npv-seg', role: 'tablist' }, items.map(([k, label]) => h('button', { class: k === cur ? 'on' : '', role: 'tab', 'aria-selected': String(k === cur), 'data-k': k, onclick: () => pick(k) }, label)));
  const head = h('div', { class: 'npv-head' });
  const body = h('div', { class: 'npv-body' }, h('div', { class: 'npv-app' }, phone, h('div', { class: 'npv-note' })), codeBox);
  const root = h('div', { class: 'npv', role: 'dialog', 'aria-label': 'Native app preview' }, head, body);
  const zoom = zoomer(root, body.firstChild, phone), where = placer(root, host, () => drawAll());

  function drawHead() {
    head.replaceChildren(
      h('div', { class: 'npv-title' }, h('b', {}, 'Native app'), h('small', {}, `${model.pages.length} pages · ${model.collections.length} data collection${model.collections.length === 1 ? '' : 's'}`)),
      seg([['flutter', 'Flutter'], ['kotlin', 'Kotlin'], ['swift', 'SwiftUI'], ['rn', 'React Native']], kind, (k) => { kind = k; codeFiles = null; drawAll(); }),
      seg([['app', 'App'], ['code', 'Code']], view, (k) => { view = k; drawAll(); }),
      h('div', { class: 'npv-acts' },
        zoom.controls,
        h('button', { class: 'npv-btn', title: 'Read the project again and start with the sample data', onclick: () => refresh(true) }, '↺ Reset'),
        h('button', { class: 'npv-btn primary', onclick: () => download(kind) }, '⬇ Download'),
        where.button(),
        h('button', { class: 'npv-btn', 'aria-label': 'Close', onclick: close }, '✕')),
    );
  }

  // ---------- the app ----------
  function element(x, P, entry) {
    switch (x.kind) {
      case 'text': return h('div', { class: 'npv-text', style: `font-size:${Math.round(x.size)}px;font-weight:${parseInt(x.weight, 10) || 600};color:${col(x.color, P) || P.text};text-align:${x.align || 'left'}` }, A.fill(x.value));
      case 'button': { // filled, outlined or plain (a link), in the project's colours
        const look = x.plain ? 'plain' : x.outlined ? 'outlined' : 'filled', fg = col(x.color, P) || (look === 'filled' ? P.onAccent : P.accent);
        const bg = look === 'filled' ? col(x.fill, P) || P.accent : look === 'outlined' && x.fill ? col(x.fill, P) || 'transparent' : 'transparent';
        return h('button', { class: 'npv-pbtn ' + look, style: `min-height:${x.h || 52}px;border-radius:${x.radius ?? 16}px;font-size:${x.size || 17}px;background:${bg};color:${fg};${look === 'outlined' ? `border-color:${col(x.stroke, P) || fg}` : ''}`, onclick: () => act(x.action, x.value, x.amount) }, A.fill(x.label)); }
      case 'box': return boxEl(x, P, entry);
      case 'space': return h('div', { class: 'npv-space', style: `height:${Math.max(0, x.h - 12)}px` });
      case 'bar': { const v = Math.max(0, Math.min(1, (num(A.vars[x.var]) || 0) / (x.max || 100))); return h('div', { class: 'npv-bar2', style: `height:${x.h}px;border-radius:${x.radius}px;background:${col(x.bg, P) || P.line}` }, h('i', { style: `width:${v * 100}%;background:${col(x.fill, P) || P.accent};border-radius:${x.radius}px` })); }
      case 'slider': { const v = num(A.vars[x.var]) ?? x.min; return h('input', { class: 'npv-slider', type: 'range', min: x.min, max: x.max, step: x.step, value: v, 'data-k': 's:' + x.var, oninput: (e) => { A.set(x.var, +e.target.value); drawPhone(); } }); }
      case 'segmented': { const cur = show(A.vars[x.var]); return h('div', { class: 'npv-segc' }, x.options.map((o, i) => h('button', { class: (x.index ? cur === String(i + 1) : cur === o) ? 'on' : '', onclick: () => { A.set(x.var, x.index ? i + 1 : o); drawPhone(); } }, o))); }
      case 'chips': { const cur = show(A.vars[x.var]); return h('div', { class: 'npv-chips' }, x.options.map((o) => h('button', { class: 'npv-chip' + (cur === o ? ' on' : ''), onclick: () => { A.set(x.var, o); drawPhone(); } }, o))); }
      case 'dropdown': return h('select', { class: 'npv-input npv-select', value: show(A.vars[x.var]), onchange: (e) => { A.set(x.var, e.target.value); drawPhone(); } }, h('option', { value: '', disabled: true }, x.placeholder), x.options.map((o) => h('option', { value: o.value, selected: show(A.vars[x.var]) === String(o.value) }, o.label)));
      case 'stepper': { const v = num(A.vars[x.var]) ?? x.min, set = (d) => { A.set(x.var, Math.max(x.min, Math.min(x.max, v + d))); drawPhone(); };
        return h('div', { class: 'npv-stepper' }, h('button', { 'aria-label': 'Less', onclick: () => set(-x.step) }, '−'), h('b', {}, show(v)), h('button', { 'aria-label': 'More', onclick: () => set(x.step) }, '+')); }
      case 'rating': { const v = num(A.vars[x.var]) || 0; return h('div', { class: 'npv-rating' }, Array.from({ length: x.max }, (_, i) => h('button', { class: i < v ? 'on' : '', 'aria-label': `${i + 1} stars`, onclick: () => { A.set(x.var, i + 1); drawPhone(); } }, '★'))); }
      case 'divider': return h('div', { class: 'npv-divider' }, x.label && h('span', {}, A.fill(x.label)));
      case 'avatar': return h('div', { class: 'npv-avw' }, avatar(meName(), me(), x.size, x.emoji || undefined));
      case 'banner': return h('div', { class: 'npv-banner2 ' + x.tone }, x.icon && h('span', {}, x.icon), h('div', {}, x.title && h('b', {}, A.fill(x.title)), x.text && h('div', {}, A.fill(x.text))));
      case 'xpbar': { const lv = Math.max(1, num(A.vars[x.levelVar]) || 1), need = Math.round(x.base * Math.pow(x.growth, lv - 1)), xp = num(A.vars[x.xpVar]) || 0;
        return h('div', { class: 'npv-xp' }, h('span', { class: 'npv-xplv' }, show(lv)), h('div', { class: 'npv-bar2', style: 'height:12px;border-radius:6px;flex:1' }, h('i', { style: `width:${Math.min(100, xp / need * 100)}%` })), h('small', {}, `${show(xp)} / ${need}`)); }
      case 'steps': { const cur = Math.max(1, num(A.vars[x.var]) || 1); return h('div', { class: 'npv-steps' }, x.steps.map((t, i) => h('div', { class: i + 1 < cur ? 'done' : i + 1 === cur ? 'on' : '' }, h('i', {}, i + 1 < cur ? '✓' : i + 1), h('small', {}, t)))); }
      case 'spinner': return h('div', { class: 'npv-spin' });
      case 'input': return h('div', { class: 'npv-field' + (x.keyboard === 'search' ? ' search' : '') + (x.outlined ? ' outlined' : '') }, x.keyboard === 'search' && svgIcon('search'),
        h('input', { 'data-k': 'v:' + x.var, type: x.keyboard === 'password' ? 'password' : x.keyboard === 'number' ? 'number' : 'text', placeholder: x.placeholder, value: show(A.vars[x.var]), oninput: (e) => { A.set(x.var, x.keyboard === 'number' ? +e.target.value || 0 : e.target.value); drawPhone(); } }));
      case 'toggle': { const on = A.vars[x.var] != null ? isOn(A.vars[x.var]) : x.var === 'darkMode' && dark(); return h('label', { class: 'npv-toggle' }, x.label ? h('span', {}, A.fill(x.label)) : h('span'), h('input', { type: 'checkbox', role: 'switch', checked: on, onchange: (e) => { A.set(x.var, e.target.checked); drawPhone(); } })); }
      case 'row': return h('div', { class: 'npv-card row' }, x.children.map((c) => element(c, P, entry)));
      case 'items': return h('div', { class: 'npv-card' }, x.items.map((t) => h('div', { class: 'npv-li' }, A.fill(t))));
      case 'image': return h('img', { class: 'npv-img', src: x.src, alt: '', style: `height:${x.h}px` });
      case 'list': return list(x, P);
      case 'form': return form(x, P, entry);
      case 'feed': return feed(x, P, entry);
      case 'composer': return composer(x, entry);
      case 'stories': return stories(x);
      case 'inbox': return inbox(x);
      case 'chat': return chat(x, entry);
      case 'profile': return profile(x, P);
      case 'market': return market(x);
      case 'activity': return activity(x);
      case 'people': return people(x);
      case 'achievements': return achievements();
      case 'trending': return trending(x);
      case 'chart': case 'carousel': case 'pager': case 'photogrid': case 'like': case 'ticker': case 'timer': case 'skeleton': case 'colors': case 'keypad': case 'selector': case 'overlay':
        if (kind === 'flutter' || kind === 'kotlin') return more(x, P, entry);
      // falls through: SwiftUI and React Native have a placeholder for these for now
      default: return h('div', { class: 'npv-todo' }, h('b', {}, x.name), h('small', {}, `${x.type}: a TODO placeholder in the native code`));
    }
  }
  // ---------- cards with things inside, laid out where the design puts them (as a share of the card's width, so it fits any phone) ----------
  function boxEl(x, P, entry) {
    const DW = x.w || 368, t = x.text;
    return h('div', { class: 'npv-box' + (x.action ? ' tap' : ''), style: `height:${x.h}px;border-radius:${x.radius}px;background:${col(x.fill, P) || 'transparent'};${x.stroke ? `border:${x.strokeW || 1}px solid ${col(x.stroke, P) || P.line};` : ''}${x.shadow ? 'box-shadow:0 3px 12px rgba(0,0,0,.10);' : ''}`,
      onclick: x.action ? () => act(x.action.action, x.action.value, x.action.amount) : null },
      t && h('div', { class: 'npv-boxt', style: `font-size:${t.size}px;font-weight:${parseInt(t.weight, 10) || 600};color:${col(t.color, P) || P.text}` }, A.fill(t.value)),
      x.children.map((c) => pinned(c, DW, P, entry, x.row)));
  }
  function pinned(c, DW, P, entry, gap) {
    const q = c.pin || { fx: 0.5, fy: 0.5, x: 0, y: 0, w: 0, h: 0, align: 'center', m: -1, wrap: 0 }, pc = (v) => `${(v * 100).toFixed(3)}%`;
    let st = `top:calc(${q.fy * 100}% + ${q.y}px);`, tr = 'translateY(-50%)';
    if (q.cells && gap != null) { const cw = (DW - gap * (q.cells - 1)) / q.cells; st += `left:${pc((q.cell * (cw + gap) + q.m) / DW)};width:${pc((cw - 2 * q.m) / DW)};`; } // a cell of a row
    else if (q.m >= 0) st += `left:${pc(q.m / DW)};right:${pc(q.m / DW)};`;
    else if (q.w) st += `left:${pc(q.fx + (q.x - q.w / 2) / DW)};width:${pc(q.w / DW)};`;
    else if (q.align === 'left') st += `left:${pc(q.fx + q.x / DW)};${q.wrap ? `max-width:${pc(q.wrap / DW)}` : 'right:3%'};text-align:left;`;
    else if (q.align === 'right') st += `right:${pc(1 - q.fx - q.x / DW)};${q.wrap ? `max-width:${pc(q.wrap / DW)}` : 'left:3%'};text-align:right;`;
    else { st += `left:${pc(q.fx + q.x / DW)};max-width:${q.wrap ? pc(q.wrap / DW) : '94%'};width:max-content;text-align:center;`; tr = 'translate(-50%,-50%)'; }
    if (c.kind === 'slider') st += `height:${Math.max(q.h, 24)}px;`; else if (q.h) st += `height:${q.h}px;`;
    return h('div', { class: 'npv-pin', style: st + `transform:${tr}` }, element(c, P, entry));
  }
  /** A thing narrower than the page, on its own line: left, centred or right, as in the design. */
  function placed(x, P, entry) {
    const el = element(x, P, entry), q = x.pin;
    if (!q || q.m >= 0 || !q.w || !['box', 'button', 'image', 'avatar'].includes(x.kind)) return el;
    return h('div', { class: 'npv-place', style: `justify-content:${q.fx === 0 ? 'flex-start' : q.fx === 1 ? 'flex-end' : 'center'}` }, h('div', { style: `width:${x.kind === 'button' ? Math.max(q.w, labelW(x)) : q.w}px;max-width:100%` }, el));
  }

  function list(x, P) {
    const rows = A.query(x.collection, x.filter, x.search ? show(A.vars[x.search]) : '', x.sort);
    if (!rows.length) return h('div', { class: 'npv-empty' + (x.fill ? ' fill' : '') }, x.empty);
    return h('div', { class: 'npv-list' + (x.fill ? ' fill' : ''), style: `gap:${x.gap}px` }, rows.map((r) => {
      const done = x.check && isOn(r[x.check]);
      const row = h('div', { class: 'npv-row' + (done && x.doneLook ? ' done' : ''), 'data-id': r._id, style: `min-height:${x.rowH - 20}px;border-radius:${x.radius}px`, onclick: () => { if (row.dataset.moved || !x.openPage) return; A.openCollection = x.collection; A.openId = r._id; A.go(x.openPage); drawPhone(); } },
        x.check ? h('button', { class: 'npv-check' + (done ? ' on' : ''), role: 'checkbox', 'aria-checked': String(!!done), 'aria-label': 'Done', onclick: (e) => { e.stopPropagation(); A.updateRecord(x.collection, r._id, { [x.check]: !done }); drawPhone(); } }, done && svgIcon('check2'))
          : x.icon ? h('span', { class: 'npv-rowic' }, A.fill(x.icon, r, x.collection)) : null,
        h('div', { class: 'npv-rowt' }, h('b', {}, A.fill(x.title, r, x.collection)), x.subtitle && h('small', {}, A.fill(x.subtitle, r, x.collection))),
        x.right && h('span', { class: 'npv-right' }, A.fill(x.right, r, x.collection)));
      if (!x.swipeDelete) return row;
      // swipe left to delete (the same as the app; the native lists do it too)
      let x0 = null, dx = 0;
      row.addEventListener('pointerdown', (e) => { x0 = e.clientX; dx = 0; delete row.dataset.moved; });
      row.addEventListener('pointermove', (e) => { if (x0 == null) return; dx = Math.min(0, e.clientX - x0); if (dx < -8) { row.dataset.moved = '1'; row.parentElement.classList.add('sw'); row.style.transform = `translateX(${dx}px)`; } });
      const end = () => { if (x0 == null) return; x0 = null; if (dx < -90) { A.deleteRecord(x.collection, r._id); drawPhone(); } else { row.style.transform = ''; setTimeout(() => { delete row.dataset.moved; row.parentElement?.classList.remove('sw'); }, 160); } };
      row.addEventListener('pointerup', end); row.addEventListener('pointerleave', end); row.addEventListener('pointercancel', end);
      return h('div', { class: 'npv-swipe', style: `border-radius:${x.radius}px` }, h('span', { class: 'npv-swdel' }, 'Delete'), row);
    }));
  }
  function form(x, P, entry) {
    const all = A.def(x.collection)?.fields || [], shown = x.fields.length ? x.fields.map((k) => all.find((f) => f.key === k)).filter(Boolean) : all;
    if (!entry.form) {
      const editing = x.mode === 'edit' || (x.mode === 'auto' && A.opened() && A.openCollection === x.collection), o = editing ? A.opened() : null;
      entry.form = { editing, values: Object.fromEntries(shown.map((f) => [f.key, o ? o[f.key] : f.def === 'today' ? today() : f.type === 'yes/no' ? isOn(f.def) : f.def ?? ''])) };
    }
    const F = entry.form, set = (k, v) => { F.values[k] = v; };
    const save = () => {
      const out = Object.fromEntries(shown.map((f) => [f.key, ['number', 'money'].includes(f.type) ? num(F.values[f.key]) ?? 0 : F.values[f.key]]));
      if (F.editing && A.openId) A.updateRecord(x.collection, A.openId, out); else A.addRecord(x.collection, out);
      if (x.after === 'clear the form') entry.form = null; else if (x.after === 'go to page') A.go(x.page); else if (x.after !== 'stay') A.back();
      drawPhone();
    };
    return h('div', { class: 'npv-form' + (x.fill ? ' fill' : '') }, shown.map((f) => [
      h('label', { class: 'npv-flabel' }, f.name),
      f.type === 'yes/no' ? h('label', { class: 'npv-toggle npv-card' }, h('span', {}, f.name), h('input', { type: 'checkbox', role: 'switch', checked: isOn(F.values[f.key]), onchange: (e) => set(f.key, e.target.checked) }))
        : f.type === 'choice' ? h('div', { class: 'npv-chips' }, f.options.map((o) => h('button', { class: 'npv-chip' + (F.values[f.key] === o ? ' on' : ''), onclick: () => { set(f.key, o); drawPhone(); } }, o)))
        : f.type === 'date' ? h('input', { class: 'npv-input', type: 'date', value: show(F.values[f.key]), onchange: (e) => set(f.key, e.target.value) })
        : f.type === 'long text' ? h('textarea', { class: 'npv-input', 'data-k': 'f:' + f.key, rows: 4, placeholder: f.name, value: show(F.values[f.key]), oninput: (e) => set(f.key, e.target.value) })
        : h('input', { class: 'npv-input', 'data-k': 'f:' + f.key, type: ['number', 'money'].includes(f.type) ? 'number' : 'text', placeholder: f.name, value: show(F.values[f.key]), oninput: (e) => set(f.key, e.target.value) }),
    ]), h('button', { class: 'npv-pbtn filled', 'data-save': '', onclick: save }, A.fill(x.saveLabel)));
  }
  // ---------- social: the same rules as the native SocialFeed, Chat, Profile… building blocks ----------
  const meName = () => show(A.vars.playerName) || 'You', me = () => show(A.vars.playerHandle) || meName().toLowerCase().replace(/\s+/g, ''); // (no name yet: “You”, @you, like the editor)
  const barName = () => ('playerName' in A.vars ? show(A.vars.playerName) : 'Me'); // (the App Bar's avatar: “?” when the name is blank, like the editor)
  // the engine's avatar colours and initials (Maya Chen → MC)
  const AV = ['#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0', '#42a5f5', '#26a69a', '#66bb6a', '#ffa726', '#8d6e63'];
  const avColor = (s) => { let n = 0; for (const ch of String(s || '?')) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return AV[n % AV.length]; };
  const initials = (s) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0].toUpperCase()).join('') || '?';
  const avatar = (name, handle, size = 40, label) => h('span', { class: 'npv-av', style: `width:${size}px;height:${size}px;font-size:${Math.round(size * (label ? 0.5 : 0.38))}px;background:${avColor(name || handle)}` }, label || initials(name || handle));
  const mediaList = (m) => show(m).split('|').map((x) => x.trim()).filter(Boolean);
  const firstMedia = (m) => mediaList(m)[0] || '';
  const isUrl = (m) => /^(https?:|data:)/.test(m);
  const hexOf = (c) => (/^#[0-9a-f]{6}$/i.test(show(c)) ? show(c) : null);
  const tile = (m, bg, height, size) => (isUrl(m) ? h('img', { class: 'npv-media', src: m, alt: '', style: `height:${height}px` }) : h('div', { class: 'npv-media', style: `height:${height}px;background:${bg};font-size:${size || Math.round(height * 0.4)}px` }, m));
  const media = (r, height) => { const m = firstMedia(r.media); return m ? tile(m, hexOf(r.color) || avColor(r.handle || r.title || m), height) : null; };
  /** 1 to 4 pictures, laid out like the engine's feed (one big, two side by side, one big and two stacked, two by two). */
  const mediaGrid = (r, height) => {
    const L = mediaList(r.media).slice(0, 4), bg = hexOf(r.color) || avColor(r.handle || L[0]); if (!L.length) return null;
    const cell = (m, hh) => tile(m, bg, hh, Math.round(Math.min(hh, 150) * 0.42));
    if (L.length === 1) return h('div', { class: 'npv-mgrid' }, cell(L[0], height));
    if (L.length === 2) return h('div', { class: 'npv-mgrid two' }, L.map((m) => cell(m, height)));
    if (L.length === 3) return h('div', { class: 'npv-mgrid two' }, cell(L[0], height), h('div', { class: 'npv-mcol' }, cell(L[1], height / 2 - 1), cell(L[2], height / 2 - 1)));
    return h('div', { class: 'npv-mgrid two' }, h('div', { class: 'npv-mcol' }, cell(L[0], height / 2 - 1), cell(L[2], height / 2 - 1)), h('div', { class: 'npv-mcol' }, cell(L[1], height / 2 - 1), cell(L[3], height / 2 - 1)));
  };
  /** 1284 → 1.3K, 48200 → 48K (the engine's short counts). */
  const compact = (v) => { const n = num(v) || 0; return n < 1000 ? String(Math.round(n)) : n < 1e4 ? (Math.round(n / 100) / 10 + 'K').replace('.0K', 'K') : n < 1e6 ? Math.round(n / 1000) + 'K' : (Math.round(n / 1e5) / 10 + 'M').replace('.0M', 'M'); };
  /** 9m, 2h, 3d, then the date. */
  const ago = (at) => { const s0 = (Date.now() - (+at || 0)) / 1000; if (!(+at > 1e11)) return ''; return s0 < 60 ? 'now' : s0 < 3600 ? Math.floor(s0 / 60) + 'm' : s0 < 86400 ? Math.floor(s0 / 3600) + 'h' : s0 < 604800 ? Math.floor(s0 / 86400) + 'd' : new Date(+at).toLocaleDateString('en', { day: 'numeric', month: 'short' }); };
  /** Text with #hashtags and @mentions in the accent colour. */
  const rich = (t) => show(t).split(/([#@]\w+)/).map((w) => (/^[#@]\w+/.test(w) ? h('span', { class: 'npv-tag' }, w) : w));
  const gradient = (bg) => { const c = show(bg).match(/#[0-9a-f]{6}/gi) || []; return c.length ? `linear-gradient(135deg,${c.join(',')})` : null; };
  const openProfile = (page, handle, name) => { if (!page) return; A.vars.profile = handle; A.vars.profile_name = name; A.go(page); drawPhone(); };
  const toggle = (coll, r, flag, count) => { const on = !isOn(r[flag]); A.updateRecord(coll, r._id, count ? { [flag]: on, [count]: Math.max(0, (num(r[count]) || 0) + (on ? 1 : -1)) } : { [flag]: on }); drawPhone(); };
  /** A feed tab's "only where…": following, saved, media, replies, posts, likes, or a filter. */
  const tabPasses = (only) => {
    const o = String(only || '').trim().toLowerCase(), meH = me();
    if (!o) return () => true;
    if (o === 'following') { const f = new Set(A.rows('Follows').filter((r) => show(r.follower) === meH).map((r) => show(r.followee))); return (r) => f.has(show(r.handle)) || isOn(r.following); }
    if (o === 'saved') return (r) => isOn(r.saved);
    if (o === 'media') return (r) => !!firstMedia(r.media);
    if (o === 'replies') return (r) => !!show(r.reply_to);
    if (o === 'posts') return (r) => !show(r.reply_to);
    if (o === 'likes') return (r) => isOn(r.liked);
    return null; // a filter: handled by the query
  };
  function feed(x, P, entry) {
    const t = x.tabs.length ? x.tabs[Math.min(entry.tab || 0, x.tabs.length - 1)] : null, test = t ? tabPasses(t.only) : null;
    const rows = A.query(x.collection, [x.filter, t && !test ? t.only : ''].filter(Boolean).join(' and '), x.search ? show(A.vars[x.search]) : '', 'newest first').filter(test || (() => true));
    const look = t?.look || x.look;
    const tabs = x.tabs.length > 1 && h('div', { class: 'npv-ftabs' }, x.tabs.map((tb, i) => h('button', { class: (entry.tab || 0) === i ? 'on' : '', onclick: () => { entry.tab = i; drawPhone(); } }, h('span', {}, tb.label))));
    const body = !rows.length ? h('div', { class: 'npv-empty' }, x.empty)
      : look === 'grid' ? h('div', { class: 'npv-grid', style: `grid-template-columns:repeat(${x.columns},1fr)` }, rows.map((r) => h('div', { class: 'npv-tile', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, media(r, 120) || h('div', { class: 'npv-media txt', style: `height:120px;background:${gradient(r.background) || avColor(r.author)}` }, show(r.text).slice(0, 60)))))
      : look === 'reels' ? h('div', { class: 'npv-feed' }, rows.map((r) => reel(x, r)))
      : h('div', { class: 'npv-xfeed' }, rows.map((r) => xpost(x, r)));
    return tabs ? h('div', { class: 'npv-feedw' }, tabs, body) : body;
  }
  const ACT = { comment: ['comment', 'comments'], repost: ['repost', 'reposts', 'reposted', 'good'], like: ['heart', 'likes', 'liked', 'bad'], views: ['views', 'views'], save: ['bookmark', '', 'saved', 'acc'], share: ['share', ''] };
  function actions(x, r) {
    return h('div', { class: 'npv-xacts' }, x.actions.filter((a) => ACT[a]).map((a) => { const [ic, count, flag, tone] = ACT[a], on = flag && isOn(r[flag]);
      return h('button', { 'data-act': a === 'save' ? 'save' : a, class: (on ? 'on ' + tone : '') + (a === 'save' || a === 'share' ? ' end' : ''), onclick: flag ? () => toggle(x.collection, r, flag, count || undefined) : null },
        svgIcon(ic), count && h('span', {}, compact(r[count]))); }));
  }
  function xpost(x, r) {
    const bgText = !firstMedia(r.media) && gradient(r.background);
    return h('div', { class: 'npv-xpost', 'data-id': r._id },
      h('div', { class: 'npv-xav', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, avatar(r.author, r.handle, 46)),
      h('div', { class: 'npv-xbody' },
        h('div', { class: 'npv-xhead', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, h('b', {}, show(r.author)), isOn(r.verified) && h('span', { class: 'npv-ver' }, svgIcon('check2')),
          h('span', { class: 'npv-xsub' }, ['@' + show(r.handle), ago(r._at), r.location && '📍 ' + show(r.location)].filter(Boolean).join(' · ')), h('span', { class: 'npv-xmore' }, svgIcon('more'))),
        bgText ? h('div', { class: 'npv-xbg', style: `background:${bgText}` }, show(r.text)) : r.text && h('div', { class: 'npv-ptext' }, rich(r.text)),
        r.poll && h('div', { class: 'npv-poll' }, show(r.poll).split('|').map((o) => h('div', {}, o.trim()))),
        r.link && h('div', { class: 'npv-link' }, h('b', {}, show(r.link_title || r.link)), h('small', {}, show(r.link).replace(/^https?:\/\//, '').split('/')[0])),
        mediaGrid(r, 220),
        actions(x, r)));
  }
  function reel(x, r) {
    return h('div', { class: 'npv-post', 'data-id': r._id },
      h('div', { class: 'npv-phead', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, avatar(r.author, r.handle),
        h('div', { class: 'npv-rowt' }, h('b', {}, show(r.author)), h('small', {}, '@' + show(r.handle)))),
      media(r, 380) || (r.text && h('div', { class: 'npv-ptext' }, rich(r.text))), actions(x, r));
  }
  function composer(x, entry) {
    const post = () => { const t = show(entry.draft).trim(); if (!t) return; A.addRecord(x.collection, { ...A.blank(x.collection), author: meName(), handle: me(), text: t }); entry.draft = ''; drawPhone(); };
    return h('div', { class: 'npv-compose' }, avatar(meName(), me(), 40),
      h('input', { class: 'npv-input', 'data-k': 'compose', placeholder: x.placeholder, value: show(entry.draft), oninput: (e) => { entry.draft = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') post(); } }),
      h('button', { class: 'npv-pbtn filled small', 'data-post': '', onclick: post }, 'Post'));
  }
  let story = null, menuOpen = false;
  // ---------- the Side Menu: opened from the App Bar's avatar or ☰ ----------
  const menuOn = () => !!model.menu && model.bar?.left !== 'none' && model.bar?.left !== 'back';
  function sideMenu(P) {
    const M = model.menu, page = (() => { const st = A.stack(); return st.length ? st[st.length - 1].page : model.tabs.length ? model.tabs[A.tab].page : model.home; })();
    const close = () => { menuOpen = false; drawPhone(); };
    const lit = (v) => (A.vars[v] != null ? isOn(A.vars[v]) : v === 'darkMode' && dark()); // (Dark mode follows the app's look until it's set)
    const row = (it) => {
      if (it.kind === 'line') return h('hr', { class: 'npv-mline' });
      if (it.kind === 'section') return h('div', { class: 'npv-msec' }, it.label);
      const n = it.badge ? num(A.vars[it.badge]) || 0 : 0, on = it.kind === 'page' && it.page === page;
      return h('button', { class: 'npv-mrow' + (on ? ' on' : ''), 'data-menu': it.page || it.var || it.msg, onclick: () => {
        if (it.kind === 'toggle') { A.set(it.var, !lit(it.var)); drawPhone(); return; }
        if (it.kind === 'page') { menuOpen = false; A.go(it.page); drawPhone(); return; }
        menuOpen = false; note = `“${it.msg}” is a message: the native code has a TODO there`; drawPhone(); } },
        it.icon && navIcon(it.icon), h('span', {}, A.fill(it.label)),
        it.kind === 'toggle' ? h('i', { class: 'npv-msw' + (lit(it.var) ? ' on' : '') }) : n > 0 ? h('b', { class: 'npv-mbadge' }, n > 99 ? '99+' : n) : null);
    };
    const head = M.header === 'none' ? null : M.social
      ? h('button', { class: 'npv-mhead', onclick: () => { menuOpen = false; A.go(M.profilePage); drawPhone(); } }, avatar(meName(), me(), 52), h('b', {}, meName()), h('small', {}, '@' + me()))
      : h('div', { class: 'npv-mhead' + (M.header === 'banner' ? ' banner' : '') }, M.avatar && h('span', { class: 'npv-memo' }, /^[a-z][a-z-]+$/.test(M.avatar) ? navIcon(M.avatar) : M.avatar), h('b', {}, A.fill(M.title)), M.subtitle && h('small', {}, A.fill(M.subtitle)));
    return h('div', { class: 'npv-mwrap ' + M.side, onclick: (e) => { if (e.target === e.currentTarget) close(); } },
      h('nav', { class: 'npv-menu', style: `background:${col(M.bg, P) || P.card};color:${col(M.text, P) || P.text};--macc:${col(M.accent, P) || P.accent};--mbadge:${col(M.badge, P) || '#ff3b5c'};width:min(${M.width}px, 82%)` },
        h('button', { class: 'npv-mclose', 'aria-label': 'Close menu', onclick: close }, '✕'), head,
        h('div', { class: 'npv-mitems' }, M.items.map(row)),
        M.footer.length ? h('div', { class: 'npv-mfoot' }, M.footer.map(row)) : null,
        M.footerText && h('small', { class: 'npv-mfine' }, A.fill(M.footerText))));
  }
  /** One bubble per person (newest first), "Your story" first. */
  function stories(x) {
    const by = new Map(); for (const r of A.query(x.collection)) if (!by.has(show(r.handle) || show(r.author))) by.set(show(r.handle) || show(r.author), r);
    const bubble = (r) => { const m = firstMedia(r.media); return h('button', { class: 'npv-story', onclick: () => { story = r; drawPhone(); } },
      h('span', { class: 'npv-ring' }, m && !isUrl(m) ? h('span', { class: 'npv-av', style: `width:60px;height:60px;font-size:28px;background:${hexOf(r.color) || avColor(r.author)}` }, m) : avatar(r.author, r.handle, 60)),
      h('small', {}, show(r.author).split(' ')[0])); };
    return h('div', { class: 'npv-stories' }, x.yours && h('button', { class: 'npv-story you' }, h('span', { class: 'npv-you' }, avatar(meName(), me(), 60), h('i', {}, '+')), h('small', {}, 'Your story')),
      [...by.values()].filter((r) => show(r.handle) !== me()).map(bubble));
  }
  const chats = (coll) => { const by = new Map(); for (const r of A.query(coll, '', '', 'newest first')) if (r.chat && !by.has(r.chat)) by.set(r.chat, r); return [...by.values()]; };
  const chatName = (coll, id) => { const o = A.rows(coll).find((r) => r.chat === id && show(r.handle) !== me()); return o ? show(o.author) : show(id).replace(/^dm-/, '').split('-').filter((s) => s !== me()).join(', ') || show(id); };
  function inbox(x) {
    const L = chats(x.collection);
    if (!L.length) return h('div', { class: 'npv-empty' }, 'No messages yet');
    return h('div', { class: 'npv-feed' }, L.map((r) => { const name = chatName(x.collection, r.chat);
      return h('div', { class: 'npv-row', 'data-chat': r.chat, onclick: () => { A.vars.chat = r.chat; A.vars.chatTitle = name; A.go(x.openPage); drawPhone(); } }, avatar(name, name, 46),
        h('div', { class: 'npv-rowt' }, h('b', {}, name), h('small', {}, (show(r.handle) === me() ? 'You: ' : '') + show(r.text)))); }));
  }
  function chat(x, entry) {
    const id = show(A.vars.chat), L = A.query(x.collection, '', '', 'oldest first').filter((r) => show(r.chat) === id);
    const send = () => { const t = show(entry.draft).trim(); if (!t || !id) return; A.addRecord(x.collection, { chat: id, author: meName(), handle: me(), text: t }); entry.draft = ''; drawPhone(); };
    return h('div', { class: 'npv-chat' }, L.length ? L.map((r) => h('div', { class: 'npv-bub' + (show(r.handle) === me() ? ' mine' : '') }, show(r.text))) : h('div', { class: 'npv-empty' }, 'Say hello 👋'),
      h('div', { class: 'npv-compose' }, h('input', { class: 'npv-input', 'data-k': 'chat', placeholder: 'Message', value: show(entry.draft), oninput: (e) => { entry.draft = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') send(); } }),
        h('button', { class: 'npv-pbtn filled small', 'data-send': '', onclick: send }, 'Send')));
  }
  function profile(x, P) {
    const name = A.fill(x.name), handle = A.fill(x.handle), own = { points: num(A.vars.points) || 0 };
    return h('div', { class: 'npv-prof' }, h('div', { class: 'npv-cover', style: `background:${col(x.cover, P) || P.accent}` }), avatar(name, handle, 76),
      h('b', { class: 'npv-pname' }, name), h('small', { class: 'npv-sub' }, '@' + handle), x.bio && h('div', {}, A.fill(x.bio)),
      x.stats.length && h('div', { class: 'npv-stats' }, x.stats.map((s) => h('div', {}, h('b', {}, A.fill(s.value, own)), h('small', {}, s.label)))));
  }
  let listing = null;
  function market(x) {
    const L = A.query(x.collection);
    if (!L.length) return h('div', { class: 'npv-empty' }, 'Nothing for sale yet');
    return h('div', { class: 'npv-grid', style: 'grid-template-columns:1fr 1fr' }, L.map((r) => h('div', { class: 'npv-listing', onclick: () => { listing = { x, r }; drawPhone(); } }, media(r, 120),
      h('b', {}, (num(r.price) != null ? '$' + show(r.price) : show(r.price)) + (isOn(r.sold) ? ' · Sold' : '')), h('small', {}, show(r.title)), h('small', { class: 'npv-sub' }, show(r.location)))));
  }
  const ACT_IC = { like: '❤️', comment: '💬', follow: '👤', repost: '🔁', mention: '@' };
  function activity(x) {
    const L = A.query(x.collection, '', '', 'newest first').filter((r) => !r.to || show(r.to) === me());
    if (!L.length) return h('div', { class: 'npv-empty' }, 'No notifications yet');
    return h('div', { class: 'npv-feed' }, L.map((r) => h('div', { class: 'npv-row' + (isOn(r.read) ? '' : ' unread'), onclick: () => { A.updateRecord(x.collection, r._id, { read: true }); if (x.profilePage) openProfile(x.profilePage, r.from, r.from_name); else drawPhone(); } },
      h('span', { class: 'npv-rowic' }, ACT_IC[r.type] || '🔔'), h('div', { class: 'npv-rowt' }, h('span', {}, h('b', {}, show(r.from_name || r.from)), ' ' + show(r.text))))));
  }
  function people(x) {
    const L = A.query(x.collection, '', '', 'name (a-z)').filter((r) => show(r.handle) !== me());
    if (!L.length) return h('div', { class: 'npv-empty' }, 'No one here yet');
    return h('div', { class: 'npv-feed' }, L.map((r) => h('div', { class: 'npv-row', onclick: () => openProfile(x.profilePage, r.handle, r.name) }, avatar(r.name, r.handle, 46),
      h('div', { class: 'npv-rowt' }, h('b', {}, show(r.name), isOn(r.verified) && h('span', { class: 'npv-ver' }, ' ✓')), h('small', {}, '@' + show(r.handle) + (r.bio ? ' · ' + show(r.bio) : ''))))));
  }
  const milestones = () => { const mine = A.rows('Posts').filter((r) => show(r.handle) === me()), likes = mine.reduce((a, r) => a + (num(r.likes) || 0), 0), fol = num(A.vars.followers) || 0;
    return [['✍️', 'First post', mine.length, 1], ['📚', '10 posts', mine.length, 10], ['❤️', 'First like', likes, 1], ['🔥', '100 likes', likes, 100], ['⭐', '1,000 followers', fol, 1000]]; };
  function achievements() {
    return h('div', { class: 'npv-feed' }, milestones().map(([ic, label, have, need]) => h('div', { class: 'npv-row' + (have >= need ? '' : ' locked') },
      h('span', { class: 'npv-rowic' }, have >= need ? ic : '🔒'), h('div', { class: 'npv-rowt' }, h('b', {}, label), h('small', {}, have >= need ? 'Unlocked' : `${Math.min(have, need)} / ${need}`)))));
  }
  const hashtags = (coll) => { const n = new Map(); for (const r of A.rows(coll)) for (const t of show(r.text).match(/#\w+/g) || []) n.set(t, (n.get(t) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1]).slice(0, 8); };
  function trending(x) {
    const T = hashtags(x.collection);
    return h('div', { class: 'npv-chips' }, T.length ? T.map(([t, n]) => h('button', { class: 'npv-chip', onclick: () => { if (x.searchVar) { A.set(x.searchVar, t); drawPhone(); } } }, `${t} · ${n}`)) : h('small', { class: 'npv-sub' }, 'No hashtags yet'));
  }
  function overlay() {
    if (story) { const r = story; return h('div', { class: 'npv-over', onclick: () => { story = null; drawPhone(); } }, h('div', { class: 'npv-storyv', style: `background:${/^#/.test(show(r.color)) ? r.color : avColor(r.handle)}` },
      h('b', {}, show(r.author)), h('div', { class: 'npv-big' }, firstMedia(r.media)), h('div', {}, show(r.text)))); }
    if (listing) { const { x, r } = listing; return h('div', { class: 'npv-over', onclick: (e) => { if (e.target === e.currentTarget) { listing = null; drawPhone(); } } }, h('div', { class: 'npv-sheet2' }, media(r, 150),
      h('b', {}, show(r.title)), h('div', { class: 'npv-price' }, num(r.price) != null ? '$' + show(r.price) : show(r.price)), h('small', { class: 'npv-sub' }, [r.condition, r.location, r.seller && 'Seller: ' + show(r.seller)].filter(Boolean).map(show).join(' · ')),
      r.description && h('div', {}, show(r.description)),
      x.chatPage && show(r.handle) !== me() && h('button', { class: 'npv-pbtn filled', 'data-msg-seller': '', onclick: () => { A.vars.chat = 'dm-' + [me(), show(r.handle)].sort().join('-'); A.vars.chatTitle = show(r.seller || r.handle); listing = null; A.go(x.chatPage); drawPhone(); } }, 'Message seller'),
      h('button', { class: 'npv-pbtn outlined', onclick: () => { listing = null; drawPhone(); } }, 'Close'))); }
    return null;
  }
  function act(action, value, amount) { const msg = A.run(action, value, amount); note = msg; drawPhone(); }

  // ---------- more components (Flutter and Kotlin): charts, carousels, swipe pages, timers, keypads, popups, notifications ----------
  let live = new Map(), popups = new Set(), toasts = [];
  /** Each component's own state (a timer's time, a carousel's card), kept while the page redraws. */
  const stateOf = (x, init) => { if (!live.has(x)) live.set(x, init()); return live.get(x); };
  const overlaysOf = () => { const out = []; const walk = (x) => { if (x.kind === 'overlay') out.push(x); (x.children || []).forEach(walk); (x.box?.children || []).forEach(walk); }; for (const p of model.pages) p.items.forEach(walk); return out; };
  function hear(m) {
    let redraw = false;
    for (const x of overlaysOf()) { if (m === x.openOn && !popups.has(x)) { popups.add(x); redraw = true; if (x.autoClose > 0) setTimeout(() => { popups.delete(x); drawPhone(); }, x.autoClose * 1000); } else if (m === x.closeOn && popups.has(x)) { popups.delete(x); redraw = true; } }
    for (const [x, st] of live) st.hear?.(m);
    const n = model.notify;
    if (n && (m === n.listen || m.startsWith(n.listen + ' '))) {
      const [title = '', text = '', icon = ''] = m.slice(n.listen.length).trim().split('|').map((t) => t.trim()), t = { title, text, icon: icon || (n.look === 'achievement' ? '🏆' : '') };
      toasts = [...toasts, t].slice(-n.max); setTimeout(() => { toasts = toasts.filter((q) => q !== t); drawPhone(); }, n.seconds * 1000); redraw = true;
    }
    if (redraw) drawPhone();
  }
  const clock = setInterval(() => { for (const [, st] of live) st.tick?.(0.1); }, 100);
  function popupLayer(P, entry) {
    const open = overlaysOf().filter((x) => popups.has(x)); if (!open.length) return null;
    const x = open[open.length - 1], close = () => { popups.delete(x); drawPhone(); };
    return h('div', { class: 'npv-poplayer' + (x.mode === 'sheet' ? ' sheet' : '') + (x.dim ? ' dim' : ''), onclick: (e) => { if (e.target === e.currentTarget && x.tapCloses) close(); } },
      h('div', { class: 'npv-pop' }, x.mode === 'sheet' && x.handle && h('i', { class: 'npv-grab' }), element(x.box, P, entry)));
  }
  function toastLayer(P) {
    const n = model.notify; if (!n || !toasts.length) return null;
    return h('div', { class: `npv-toasts ${n.position.replace(' ', '-')} ${n.look}`, style: `--tbg:${col(n.bg, P) || P.card};--tfg:${col(n.text, P) || P.text};--tac:${col(n.accent, P) || P.accent}` },
      toasts.map((t) => h('div', { class: 'npv-toast', onclick: () => { toasts = toasts.filter((q) => q !== t); drawPhone(); } }, t.icon && h('span', { class: 'npv-tic' }, t.icon), h('div', {}, t.title && h('b', {}, t.title), t.text && n.look !== 'pill' && h('small', {}, t.text)))));
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, a = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(a)) if (v != null) el.setAttribute(k, v); for (const c of kids.flat()) if (c) el.append(c.nodeType ? c : document.createTextNode(c)); return el; };
  const n1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const MORE = ['#ff6b8b', '#ffc94d', '#3ccf7a', '#8e6bf2', '#22b8c9', '#ff9f43', '#e0559b'];
  /** A chart drawn the way PChart draws it (columns, bars, line, area, pie, donut or radar). */
  function chartSvg(x, P, items) {
    const W = 320, H = Math.max(60, x.h - (x.title ? 52 : 24)), fg = col(x.text, P) || P.text, c = col(x.color, P) || P.accent, sub = fg, line = P.line;
    const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, class: 'npv-chartsvg' });
    if (!items.length) return root;
    const kindC = x.track && !['line', 'area', 'columns', 'bars'].includes(x.chart) ? 'line' : x.chart, n = items.length;
    const top = Math.max(0, ...items.map((i) => i[1])), hi = x.max > 0 ? x.max : top <= 0 ? 1 : top * 1.12;
    const txt = (s, X, Y, o = {}) => s !== '' && root.append(svg('text', { x: X, y: Y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'middle', 'font-size': o.size || 11, 'font-weight': o.bold ? 800 : 600, fill: o.fill || sub, opacity: o.fill ? 1 : 0.75 }, s));
    const slice = (i) => (i === 0 ? c : MORE[(i - 1) % MORE.length]);
    if (kindC === 'pie' || kindC === 'donut') {
      const total = items.reduce((a, i) => a + Math.max(0, i[1]), 0); if (total <= 0) return root;
      const r = Math.min(W, H) / 2 - 4, cx = W / 2, cy = H / 2; let a = -Math.PI / 2;
      items.forEach(([name, v], i) => {
        const sw = Math.max(0, v) / total * Math.PI * 2, rr = kindC === 'donut' ? r * 0.78 : r, a2 = a + sw, big = sw > Math.PI ? 1 : 0;
        const p0 = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], p1 = [cx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr];
        if (kindC === 'donut') root.append(svg('path', { d: `M${p0} A${rr},${rr} 0 ${big} 1 ${p1}`, fill: 'none', stroke: slice(i), 'stroke-width': r * 0.42 }));
        else root.append(svg('path', { d: `M${cx},${cy} L${p0} A${rr},${rr} 0 ${big} 1 ${p1} Z`, fill: slice(i) }));
        if (x.labels && sw > 0.4) { const m = a + sw / 2, k = kindC === 'donut' ? 0.78 : 0.62; txt(name, cx + Math.cos(m) * r * k, cy + Math.sin(m) * r * k, { fill: '#fff', bold: true }); }
        a = a2;
      });
      if (kindC === 'donut' && x.values) txt(n1(total), cx, cy, { size: 20, bold: true, fill: fg });
      return root;
    }
    if (kindC === 'radar') {
      const r = Math.min(W, H) / 2 - (x.labels ? 18 : 4), cx = W / 2, cy = H / 2, at = (i, k) => { const a = -Math.PI / 2 + i * Math.PI * 2 / n; return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]; };
      for (const k of [0.33, 0.66, 1]) if (x.grid || k === 1) root.append(svg('polygon', { points: items.map((_, i) => at(i, k)).join(' '), fill: 'none', stroke: line }));
      items.forEach(([name], i) => { root.append(svg('line', { x1: cx, y1: cy, x2: at(i, 1)[0], y2: at(i, 1)[1], stroke: line })); if (x.labels) txt(name, ...at(i, 1.18)); });
      root.append(svg('polygon', { points: items.map(([, v], i) => at(i, Math.min(1, Math.max(0, v / hi)))).join(' '), fill: c, 'fill-opacity': 0.3, stroke: c, 'stroke-width': 2.5 }));
      return root;
    }
    if (kindC === 'bars') {
      const lw = x.labels && items.some((i) => i[0]) ? 52 : 0, vw = x.values ? 34 : 0, row = H / n;
      items.forEach(([name, v], i) => { const y = row * i + row * 0.2, bh = row * 0.6, bw = (W - lw - vw) * Math.min(1, Math.max(0, v / hi));
        root.append(svg('rect', { x: lw, y, width: bw, height: bh, rx: bh / 3, fill: c })); if (lw) txt(name, lw - 6, y + bh / 2, { anchor: 'end' }); if (x.values) txt(n1(v), lw + bw + 6, y + bh / 2, { anchor: 'start', bold: true, fill: fg }); });
      return root;
    }
    const lb = x.labels && items.some((i) => i[0]) ? 18 : 2, tp = x.values ? 16 : 4, h0 = H - lb - tp, slot = W / n, yOf = (v) => tp + h0 * (1 - Math.min(1, Math.max(0, v / hi)));
    if (x.grid) for (let i = 0; i <= 3; i++) root.append(svg('line', { x1: 0, x2: W, y1: tp + h0 * i / 3, y2: tp + h0 * i / 3, stroke: line }));
    if (kindC === 'line' || kindC === 'area') {
      const pts = items.map(([, v], i) => [n === 1 ? W / 2 : i * W / (n - 1), yOf(v)]);
      if (kindC === 'area') root.append(svg('polygon', { points: [...pts, [pts[n - 1][0], tp + h0], [pts[0][0], tp + h0]].join(' '), fill: c, 'fill-opacity': 0.25 }));
      root.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      pts.forEach((p, i) => { if (n <= 14) { root.append(svg('circle', { cx: p[0], cy: p[1], r: 3.5, fill: c })); if (x.values) txt(n1(items[i][1]), p[0], p[1] - 11, { bold: true, fill: fg }); } if (lb > 2) txt(items[i][0], Math.min(W - 14, Math.max(14, p[0])), H - 8); });
      return root;
    }
    items.forEach(([name, v], i) => { const X = slot * i + slot * 0.2, bw = slot * 0.6, y = yOf(v);
      root.append(svg('path', { d: `M${X},${tp + h0} V${y + 6} Q${X},${y} ${X + 6},${y} H${X + bw - 6} Q${X + bw},${y} ${X + bw},${y + 6} V${tp + h0} Z`, fill: c }));
      if (x.values) txt(n1(v), X + bw / 2, y - 8, { bold: true, fill: fg }); if (lb > 2) txt(name, X + bw / 2, H - 8); });
    return root;
  }
  function more(x, P, entry) {
    const fg = (c) => col(c, P) || P.text;
    switch (x.kind) {
      case 'chart': {
        const st = stateOf(x, () => ({ hist: [], due: 0 }));
        if (x.track && !st.tick) { st.hist.push(num(A.vars[x.track]) || 0); st.tick = (dt) => { st.due += dt; if (st.due < x.every) return; st.due = 0; st.hist.push(num(A.vars[x.track]) || 0); if (st.hist.length > x.points) st.hist.shift(); st.node?.isConnected && st.node.replaceWith(st.node = more(x, pal(), entry)); }; }
        const items = x.track ? st.hist.map((v) => ['', v]) : x.data.map((d) => [A.fill(d.label), num(A.fill(d.value).trim()) ?? 0]);
        return (st.node = h('div', { class: 'npv-chart', style: x.bg ? `background:${col(x.bg, P)}` : '' }, x.title && h('b', { style: `color:${fg(x.text)}` }, A.fill(x.title)), chartSvg(x, P, items)));
      }
      case 'carousel': {
        const st = stateOf(x, () => ({ i: Math.max(0, x.items.findIndex((it) => it.value === show(A.vars[x.var]))) })), ac = col(x.accent, P) || P.accent;
        const locked = (it) => it.lock && !isOn(A.vars[it.lock]);
        const pick = (i) => { st.i = (i + x.items.length) % x.items.length; if (!x.loop) st.i = Math.max(0, Math.min(x.items.length - 1, i)); const it = x.items[st.i]; if (!locked(it)) { A.set(x.var, it.value); if (x.message) A.send(x.message); } drawPhone(); };
        return h('div', { class: 'npv-carousel', style: `--cw:${x.cardWidth * 100}%;--ac:${ac};height:${x.h}px` },
          h('div', { class: 'npv-cards', style: `transform:translateX(calc(${(1 - x.cardWidth) * 50}% - ${st.i} * var(--cw)))` }, x.items.map((it, i) => h('div', { class: 'npv-ccard' + (i === st.i ? ' on' : '') + (locked(it) ? ' locked' : ''), style: `background:${col(x.card, P) || P.card};color:${fg(x.text)}`, onclick: () => pick(i) },
            h('span', { class: 'npv-cic' }, locked(it) ? '🔒' : it.icon), h('b', {}, it.name), it.desc && h('small', {}, A.fill(it.desc))))),
          x.arrows && h('button', { class: 'npv-carr l', 'aria-label': 'Previous', onclick: () => pick(st.i - 1) }, '‹'), x.arrows && h('button', { class: 'npv-carr r', 'aria-label': 'Next', onclick: () => pick(st.i + 1) }, '›'),
          x.dots && h('div', { class: 'npv-dots' }, x.items.map((_, i) => h('i', { class: i === st.i ? 'on' : '' }))));
      }
      case 'pager': {
        const n = x.children.length, cur = Math.max(0, Math.min(n - 1, (num(A.vars[x.var]) || 1) - 1)), dot = col(x.dotColor, P) || P.accent;
        const go = (i) => { const j = x.loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i)); A.set(x.var, j + 1); drawPhone(); };
        const st = stateOf(x, () => ({ t: 0 }));
        st.hear = (m) => { const pre = x.message, c = (num(A.vars[x.var]) || 1) - 1; if (m === pre + ' next') go(c + 1); else if (m === pre + ' prev' || m === pre + ' back') go(c - 1); else if (m.startsWith(pre + ' ') && Number.isFinite(+m.slice(pre.length + 1))) go(+m.slice(pre.length + 1) - 1); };
        st.tick = x.auto > 0 ? (dt) => { st.t += dt; if (st.t >= x.auto) { st.t = 0; go((num(A.vars[x.var]) || 1)); } } : null;
        let sx = null;
        return h('div', { class: 'npv-pager', style: `height:${x.h}px`, onpointerdown: (e) => { sx = e.clientX; }, onpointerup: (e) => { if (sx != null && Math.abs(e.clientX - sx) > 40) go(cur + (e.clientX < sx ? 1 : -1)); sx = null; } },
          h('div', { class: 'npv-pages', style: `transform:translateX(${-cur * 100}%)` }, x.children.map((c) => h('div', { class: 'npv-pg' }, element(c, P, entry)))),
          x.dots && h('div', { class: 'npv-dots', style: `--ac:${dot}` }, x.children.map((_, i) => h('i', { class: i === cur ? 'on' : '', onclick: () => go(i) }))));
      }
      case 'photogrid': {
        const rows = A.query(x.collection, x.filter).filter((r) => show(r[x.field]).split('|').some((m) => m.trim()));
        if (!rows.length) return h('div', { class: 'npv-empty' }, 'No pictures yet');
        return h('div', { class: 'npv-photos', style: `grid-template-columns:repeat(${Math.max(1, x.columns)},1fr);gap:${x.gap}px` }, rows.map((r) => { const m = show(r[x.field]).split('|')[0].trim(), url = /^https?:/.test(m);
          return h('button', { class: 'npv-ph', style: `border-radius:${x.radius}px;background:${/^#[0-9a-f]{6}$/i.test(show(r.color)) ? r.color : P.field}`, onclick: () => { A.openCollection = x.collection; A.openId = r._id; if (x.openPage) A.go(x.openPage); if (x.message) A.send(x.message); drawPhone(); } }, url ? h('img', { src: m, alt: '' }) : m); }));
      }
      case 'like': {
        const on = isOn(A.vars[x.var]), c = on ? col(x.on, P) || P.accent : col(x.off, P) || P.sub;
        const shape = x.icon === 'thumbs up' ? 'M7 10v10H4V10zm3 10h7.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 19 9h-5l.7-3.6a1.6 1.6 0 0 0-3-1L8 10v10' : x.icon === 'star' ? ICON_SVG.star : ICON_SVG.heart;
        return h('button', { class: 'npv-like' + (on ? ' on' : ''), 'aria-label': 'Like', onclick: () => { A.set(x.var, !on); if (x.countVar) A.add(x.countVar, on ? -1 : 1); if (x.message) A.send(x.message); drawPhone(); } },
          (() => { const s0 = svg('svg', { viewBox: '0 0 24 24', width: 26, height: 26 }); s0.append(svg('path', { d: shape, fill: on ? c : 'none', stroke: c, 'stroke-width': 2, 'stroke-linejoin': 'round' })); return s0; })(),
          x.countVar && h('b', { style: `color:${on ? c : col(x.text, P) || P.sub}` }, show(A.vars[x.countVar] ?? 0)));
      }
      case 'ticker': {
        const parts = x.text.split('|').map((t) => A.fill(t.trim())).filter(Boolean), ac = col(x.accent, P) || P.accent;
        const line = () => h('span', { class: 'npv-tline', style: `padding-right:${x.gap}px` }, parts.flatMap((t, i) => [i ? h('i', { style: `color:${ac}` }, '   ●   ') : null, t]));
        const secs = Math.max(2, parts.join('   ●   ').length * x.size * 0.55 / Math.max(10, x.speed));
        return h('div', { class: 'npv-ticker', style: `height:${x.h}px;background:${col(x.bg, P) || 'transparent'};color:${fg(x.color)};font-size:${x.size}px` },
          h('div', { class: 'npv-trun' + (x.direction === 'right' ? ' rev' : ''), style: `animation-duration:${secs}s` }, line(), line()));
      }
      case 'timer': {
        const st = stateOf(x, () => ({ t: 0, running: x.autoStart, done: false, shown: -1 }));
        const paint = () => {
          const s = x.seconds <= 0 ? 1 : x.seconds, left = x.countUp ? st.t : s - st.t, whole = x.countUp ? Math.floor(left) : Math.ceil(left - 1e-9);
          const label = x.format === 'm:ss' ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : x.format === 'seconds.tenths' ? left.toFixed(1) : String(whole);
          const warn = !x.countUp && left <= x.warnAt && !st.done && st.running, c = warn ? col(x.warn, P) || P.danger : col(x.color, P) || P.accent, frac = Math.min(1, Math.max(0, left / s));
          const d = h('b', { style: `color:${warn ? c : fg(x.text)};font-size:${x.size * (x.look === 'digits' ? 0.45 : 0.26)}px` }, label);
          if (x.look === 'bar') return h('div', { class: 'npv-timer bar' }, d, h('div', { class: 'npv-bar2', style: `height:12px;border-radius:6px;background:${col(x.track, P) || P.line}` }, h('i', { style: `width:${frac * 100}%;background:${c}` })));
          if (x.look === 'digits') return h('div', { class: 'npv-timer' + (warn ? ' warn' : '') }, d);
          if (x.look === 'pill') return h('div', { class: 'npv-timer pill' + (warn ? ' warn' : ''), style: `background:${c}29` }, '⏱ ', d);
          const R = 50 - x.size * 0.04, ring = svg('svg', { viewBox: '0 0 100 100', width: x.size, height: x.size });
          ring.append(svg('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: col(x.track, P) || P.line, 'stroke-width': 8 }), svg('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: c, 'stroke-width': 8, 'stroke-linecap': 'round', 'stroke-dasharray': `${2 * Math.PI * R * frac} 999`, transform: 'rotate(-90 50 50)' }));
          return h('div', { class: 'npv-timer ring' + (warn ? ' warn' : ''), style: `width:${x.size}px;height:${x.size}px` }, ring, d);
        };
        st.hear = (m) => { if (!m.startsWith(x.message)) return; const rest = m.slice(x.message.length).trim();
          if (['start', 'resume', ''].includes(rest)) st.running = true; else if (rest === 'pause' || rest === 'stop') st.running = false; else if (rest === 'reset') { st.t = 0; st.done = false; } else if (rest === 'restart') { st.t = 0; st.done = false; st.running = true; } else if (/^add\s+-?\d/.test(rest)) st.t = Math.max(0, st.t - +rest.split(/\s+/)[1] * (x.countUp ? -1 : 1));
          st.node?.isConnected && st.node.replaceChildren(paint()); };
        st.tick = (dt) => { if (!st.running || st.done || !st.node?.isConnected) return; st.t = Math.min(x.seconds, st.t + dt);
          if (st.t >= x.seconds) { st.done = true; if (x.endMessage) A.send(x.endMessage); if (x.endAction === 'restart timer') { st.t = 0; st.done = false; } }
          const left = x.countUp ? Math.floor(st.t) : Math.ceil(x.seconds - st.t - 1e-9); if (x.var && left !== st.shown) { st.shown = left; A.vars[x.var] = left; }
          st.node.replaceChildren(paint()); };
        return (st.node = h('div', { class: 'npv-timerw' }, paint()));
      }
      case 'skeleton': {
        if (x.doneVar && isOn(A.vars[x.doneVar])) return h('div');
        const bar = (w) => h('i', { class: 'npv-sk', style: `width:${w}%;border-radius:${x.radius}px` }), lines = (n) => h('div', { class: 'npv-sklines' }, Array.from({ length: n }, (_, i) => bar(i === n - 1 && n > 1 ? 60 : 100)));
        const dot = (d) => h('i', { class: 'npv-sk', style: `width:${d}px;height:${d}px;border-radius:50%;flex:none` }), block = (hh) => h('i', { class: 'npv-sk', style: `height:${hh}px;border-radius:${x.radius * 1.5}px` });
        return h('div', { class: 'npv-skel' }, x.layout === 'text lines' ? lines(x.lines) : x.layout === 'card' ? [block(140), lines(Math.max(1, x.lines - 1))] : x.layout === 'list rows' ? Array.from({ length: x.lines }, () => h('div', { class: 'npv-skrow' }, dot(40), lines(2))) : x.layout === 'picture' ? block(180) : h('div', { class: 'npv-skrow' }, dot(48), lines(x.lines)));
      }
      case 'colors': {
        const cur = show(A.vars[x.var]).toLowerCase();
        return h('div', { class: 'npv-swatches', style: `grid-template-columns:repeat(${Math.max(1, x.columns)},1fr);gap:${x.gap}px` }, x.colors.map((c) => h('button', { class: 'npv-sw' + (c.toLowerCase() === cur ? ' on' : ''), 'aria-label': c,
          style: `background:${col(c, P) || c};border-radius:${x.shape === 'circle' ? '50%' : x.shape === 'rounded' ? '12px' : '3px'};${c.toLowerCase() === cur ? `box-shadow:0 0 0 3.5px ${col(x.ring, P) || P.text} inset` : ''}`, onclick: () => { A.set(x.var, c); if (x.message) A.send(x.message); drawPhone(); } }, c.toLowerCase() === cur ? '✓' : '')));
      }
      case 'keypad': {
        const cur = show(A.vars[x.var]), ac = col(x.accent, P) || P.accent;
        const enter = (v) => { if (x.enterMessage) A.send(x.enterMessage); if (!x.answer) return; if (v === x.answer) { if (x.rightMessage) A.send(x.rightMessage); } else { if (x.wrongMessage) A.send(x.wrongMessage); A.set(x.var, ''); } };
        const press = (k) => { if (k === '⌫') A.set(x.var, cur.slice(0, -1)); else if (k === '✓') enter(cur); else if (cur.length < x.maxLength) { const nx = cur + k; A.set(x.var, nx); if (x.autoEnter && nx.length === x.maxLength) enter(nx); } drawPhone(); };
        return h('div', { class: 'npv-keypad ' + x.keyStyle },
          x.display && h('div', { class: 'npv-kdisp', style: `background:${col(x.displayBg, P) || P.field};color:${fg(x.text)}` }, Array.from({ length: x.maxLength }, (_, i) => (i < cur.length ? (x.mask ? '•' : cur[i]) : '–')).join('  ')),
          h('div', { class: 'npv-keys' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => h('button', { 'aria-label': k === '⌫' ? 'Delete' : k === '✓' ? 'Enter' : k, style: k === '✓' ? `background:${ac};color:#fff` : `background:${x.keyStyle === 'flat' ? 'transparent' : col(x.keyColor, P) || P.field};color:${fg(x.text)}`, onclick: () => press(k) }, k))));
      }
      case 'selector': {
        const n = x.options.length, i = Math.max(0, x.options.indexOf(show(A.vars[x.var]))), pick = (d) => { A.set(x.var, x.options[x.wrap ? (i + d + n) % n : Math.max(0, Math.min(n - 1, i + d))]); drawPhone(); };
        return h('div', { class: 'npv-selector' }, h('button', { 'aria-label': 'Previous', disabled: !x.wrap && i === 0, onclick: () => pick(-1) }, '‹'), h('b', {}, x.options[i] ?? ''), h('button', { 'aria-label': 'Next', disabled: !x.wrap && i === n - 1, onclick: () => pick(1) }, '›'));
      }
      case 'overlay': return null; // (drawn over the page while it's open: popupLayer)
    }
    return null;
  }

  // ---------- the app's own bars: the App Bar's look and buttons, the Bottom Nav's style and colours ----------
  function appBar(page, stack, P) {
    const B = model.bar, ios = kind === 'swift';
    const brand = B.look !== 'standard' && !stack.length && (!B.brandPages.length || B.brandPages.includes(page.value));
    const icon = (a) => (a.icon === 'theme' ? (dark() ? 'sun' : 'moon') : a.icon);
    const tap = (a) => { if (/dark mode/.test(a.does)) A.set('darkMode', !dark()); else if (a.does.startsWith('page:')) A.go(a.does.slice(5)); else note = `“${a.does}” is a message: the native code has a TODO there`; drawPhone(); };
    const acts = B.actions.filter((a) => !a.only.length || a.only.includes(page.value)).reverse(); // (the first sits at the right edge)
    return h('div', { class: 'npv-bar ' + (ios || B.align === 'center' ? 'center' : 'left') + (B.border ? ' line' : '') + (B.circles === 'circles' ? ' circ' : B.circles === 'outlined circles' ? ' ocirc' : ''), style: `background:${col(B.bg, P) || P.card};color:${col(B.text, P) || P.text};--ic:${col(B.icon, P) || P.text}` },
      h('div', { class: 'npv-bl' }, stack.length ? h('button', { class: 'npv-back', 'aria-label': 'Back', onclick: () => { A.back(); drawPhone(); } }, svgIcon('back'), ios ? 'Back' : '')
        : B.avatar ? h('button', { class: 'npv-mbtn', 'aria-label': 'Menu', onclick: () => { if (menuOn()) { menuOpen = true; drawPhone(); } } }, avatar(barName() || '?', '', 32))
        : menuOn() ? h('button', { class: 'npv-back npv-mbtn', 'aria-label': 'Menu', onclick: () => { menuOpen = true; drawPhone(); } }, navIcon('menu')) : null),
      h('b', { class: 'npv-btitle' + (brand ? ' brand' : ''), style: `font-size:${B.size}px` }, brand ? model.name : A.fill(page.title)),
      h('div', { class: 'npv-br' }, acts.map((a) => { const n = a.badge ? num(A.vars[a.badge]) || 0 : 0;
        return h('button', { class: 'npv-bact', 'aria-label': a.icon, 'data-act': a.does, onclick: () => tap(a) }, navIcon(icon(a)), n > 0 && h('i', {}, n > 99 ? '99+' : n)); })));
  }
  function navBar(P) {
    const N = model.nav || { style: 'pill', labels: 'always', margin: 14, bar: '@bar', active: '@accent', idle: '@sub', on: '#ffffff' }, fl = ['floating', 'glass', 'segmented', 'dock'].includes(N.style);
    const label = (on) => N.labels === 'always' || (N.labels === 'selected only' && on);
    return h('div', { class: 'npv-tabs ' + N.style + (fl ? ' fl' : ''), style: `background:${col(N.bar, P) || P.card};--on:${col(N.active, P) || P.accent};--off:${col(N.idle, P) || P.sub};--onc:${col(N.on, P) || '#fff'}${fl ? `;margin:0 ${N.margin}px ${Math.max(8, N.margin)}px` : ''}` }, model.tabs.map((t, i) => {
      const n = t.badge ? num(A.vars[t.badge]) || 0 : 0;
      return h('button', { class: 'npv-tab' + (i === A.tab ? ' on' : ''), 'data-tab': t.page, 'aria-label': t.label, onclick: () => { A.go(t.page); drawPhone(); } }, h('span', { class: 'npv-tabic' }, navIcon(t.icon), n > 0 && h('i', {}, n > 99 ? '99+' : n)), label(i === A.tab) && h('small', {}, t.label));
    }));
  }

  function drawPhone() {
    const focus = document.activeElement?.dataset?.k, sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const was = phone.querySelector('.npv-page'), keep = was && { page: was.dataset.page, top: was.scrollTop };
    const P = pal(), stack = A.stack(), entry = stack[stack.length - 1] || (A.roots[A.tab] ||= { form: null });
    const pageName = stack.length ? entry.page : model.tabs.length ? model.tabs[A.tab].page : model.home, page = model.pages.find((p) => p.value === pageName) || model.pages[0];
    const fills = page.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
    const vars = Object.entries(P).map(([k, v]) => `--${k}:${v}`).join(';');
    phone.className = 'npv-phone ' + (kind === 'swift' ? 'ios' : 'material') + (dark() ? ' dark' : '');
    phone.style.cssText = vars;
    phone.replaceChildren(...[
      h('div', { class: 'npv-status' }, h('span', {}, '9:41'), h('span', {}, '▂▄▆ ◉')),
      model.appBar && appBar(page, stack, P),
      h('div', { class: 'npv-page' + (fills ? ' fills' : ''), 'data-page': page.value }, page.items.map((x) => placed(x, P, entry))),
      page.fab && h('button', { class: 'npv-fab', 'aria-label': 'Add', onclick: () => act(page.fab.action, page.fab.value, page.fab.amount) }, '+'),
      overlay(),
      model.tabs.length && !stack.length && navBar(P),
      menuOpen && model.menu && sideMenu(P),
      (kind === 'flutter' || kind === 'kotlin') && popupLayer(P, entry),
      (kind === 'flutter' || kind === 'kotlin') && toastLayer(P),
    ].filter((c) => c && c.nodeType));
    const pg = phone.querySelector('.npv-page'); if (pg && keep && keep.page === page.value) pg.scrollTop = keep.top; // (redrawing keeps the page where it was scrolled)
    root.querySelector('.npv-note').textContent = note || `Running the ${kind === 'swift' ? 'SwiftUI' : kind === 'kotlin' ? 'Kotlin (Compose)' : kind === 'rn' ? 'React Native (Expo)' : 'Flutter'} app's rules: tap around, add and edit records. ${kind === 'swift' ? 'iOS look' : 'Material look (Android and iOS)'}.`;
    if (focus) { const el = phone.querySelector(`[data-k="${CSS.escape(focus)}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch { /* number inputs */ } } }
    if (view === 'code' && codeFiles) markPage();
  }

  // ---------- the code ----------
  const pageFile = (value) => { const n = N[value]; if (!n) return ''; const snake = n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); return kind === 'flutter' ? `/pages/${snake}.dart` : kind === 'swift' ? `/Pages/${n}.swift` : kind === 'rn' ? `/pages/${n}.js` : `/pages/${n}.kt`; };
  function markPage() {
    const st = A.stack(), cur = st.length ? st[st.length - 1].page : model.tabs.length ? model.tabs[A.tab].page : model.home;
    const btn = codeBox.querySelector('.npv-thispage'); if (btn) btn.dataset.page = cur;
  }
  async function drawCode() {
    if (!codeFiles) {
      codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Writing the code…'));
      try { codeFiles = (await files(kind)).filter((f) => typeof f.data === 'string'); } catch (err) { codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Could not write the code: ' + err.message)); return; }
      const pref = codeFiles.find((f) => f.name.endsWith(pageFile(model.home))) || codeFiles.find((f) => /main\.dart$|App\.kt$|App\.swift$|App\.js$/.test(f.name)) || codeFiles[0];
      codeSel = pref?.name || '';
    }
    const f = codeFiles.find((x) => x.name === codeSel) || codeFiles[0], short = (n) => n.split('/').slice(1).join('/');
    const pick = h('select', { class: 'npv-files', 'aria-label': 'File', onchange: (e) => { codeSel = e.target.value; drawCode(); } }, codeFiles.map((x) => h('option', { value: x.name, selected: x.name === f.name }, short(x.name))));
    const pre = h('pre', { class: 'npv-pre' }, f.data.split('\n').map((l) => h('div', {}, highlight(l))));
    codeBox.replaceChildren(
      h('div', { class: 'npv-ctools' }, pick,
        h('button', { class: 'npv-btn npv-thispage', title: 'The code for the page the app shows', onclick: (e) => { const p = e.currentTarget.dataset.page || model.home, m = codeFiles.find((x) => x.name.endsWith(pageFile(p))); if (m) { codeSel = m.name; drawCode(); } } }, 'This page'),
        h('button', { class: 'npv-btn', onclick: async () => { try { await navigator.clipboard.writeText(f.data); toast('Copied ' + short(f.name)); } catch { toast('Select the text to copy it'); } } }, 'Copy')),
      pre);
    markPage();
  }
  function highlight(line) {
    const parts = [], re = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b|(@?\b(?:import|package|class|struct|enum|fun|func|val|var|let|final|const|return|if|else|for|while|when|switch|case|default|in|override|extends|some|async|await|suspend|static|private|true|false|null|nil|void)\b)/g;
    let at = 0, m;
    while ((m = re.exec(line))) { if (m.index > at) parts.push(line.slice(at, m.index)); parts.push(h('span', { class: m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-num' : 'c-kw' }, m[0])); at = m.index + m[0].length; }
    if (at < line.length) parts.push(line.slice(at));
    return parts.length ? parts : ' ';
  }

  const wide = () => root.isConnected && root.clientWidth >= 900;
  function drawAll() { drawHead(); root.dataset.view = view; drawPhone(); if (view === 'code' || wide()) drawCode(); zoom.apply(); }
  /** Read the project again (after an edit): keeps the tab you're on; reset also starts the data again. */
  function refresh(reset = false) {
    const tab = A.tab, vars = A.vars, data = A.data, before = Object.fromEntries(model.collections.map((c) => [c.name, JSON.stringify(c.rows)]));
    model = build(); N = names(model); A = makeApp(model); A.listeners.push((m) => hear(m)); live = new Map(); popups = new Set(overlaysOf().filter((x) => x.startOpen)); toasts = []; codeFiles = null; story = null; listing = null;
    if (!reset) { A.tab = Math.min(tab, Math.max(0, model.tabs.length - 1)); Object.assign(A.vars, vars); for (const c of model.collections) if (data[c.name] && before[c.name] === JSON.stringify(c.rows)) A.data[c.name] = data[c.name]; A.work(); }
    note = ''; drawAll();
  }
  let soon = 0;
  const refreshSoon = () => { clearTimeout(soon); soon = setTimeout(() => { if (root.isConnected) refresh(); }, 700); };
  const onKey = (e) => { if (e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) close(); };
  let onClose = null;
  function close() { clearTimeout(soon); clearInterval(clock); zoom.stop(); root.remove(); removeEventListener('keydown', onKey); onClose?.(); }
  addEventListener('keydown', onKey);
  A.listeners.push((m) => hear(m)); for (const x of overlaysOf()) if (x.startOpen) popups.add(x);
  where.place(!!host);
  return { root, close, get app() { return A; }, refresh, refreshSoon, go: (pg) => { A.go(pg); drawPhone(); }, set onClose(f) { onClose = f; } };
}

// =============================================================================================================
// Games: the real game in the phone, inside a web view the way the Flutter / Kotlin / Xcode projects host it,
// with their native bridge simulated (notifications, permission prompts, purchases, haptics, Back, closing).
// =============================================================================================================

/** opts: { game, html() → Promise<string> (the native build), bridge (the window.Capacitor bridge script), products, files(kind), download(kind), toast } */
export function openGamePreview({ game, html, bridge, products = [], files, download, toast = () => {}, host = null }) {
  let fresh = false, kind = 'flutter', view = 'app', codeFiles = null, codeSel = '', page = null, url = '', perm = 'prompt', owned = new Set(), sheet = null, closed = false;
  const log = [];
  const phone = h('div', { class: 'npv-phone game' }), codeBox = h('div', { class: 'npv-code' }), logBox = h('div', { class: 'npv-log', 'aria-live': 'polite' });
  const head = h('div', { class: 'npv-head' }), keys = h('div', { class: 'npv-keys' });
  const root = h('div', { class: 'npv', role: 'dialog', 'aria-label': 'Native game preview' }, head, h('div', { class: 'npv-body' }, h('div', { class: 'npv-app' }, phone, keys, logBox), codeBox));
  const zoom = zoomer(root, root.querySelector('.npv-app'), phone), where = placer(root, host, () => drawAll());
  const platform = () => (kind === 'swift' ? 'ios' : 'android');
  const label = () => ({ flutter: 'Flutter', kotlin: 'Kotlin', swift: 'Xcode (Swift)' }[kind]);
  const seg = (items, cur, pick) => h('div', { class: 'npv-seg', role: 'tablist' }, items.map(([k, l]) => h('button', { class: k === cur ? 'on' : '', role: 'tab', 'aria-selected': String(k === cur), 'data-k': k, onclick: () => pick(k) }, l)));
  const note = (t) => { log.unshift({ t, at: new Date().toLocaleTimeString() }); log.length = Math.min(log.length, 40); drawLog(); };
  const win = () => page?.contentWindow;
  const reply = (id, ok, v) => { try { win()?.__pkReply?.(id, ok, v); } catch { /* reloading */ } };
  const event = (name, data) => { try { win()?.__pkEvent?.(name, data); } catch { /* reloading */ } };
  const hasNotifs = () => kind !== 'kotlin', hasStore = () => kind !== 'kotlin';

  function drawHead() {
    head.replaceChildren(
      h('div', { class: 'npv-title' }, h('b', {}, 'Native game'), h('small', {}, `${game.name || 'Game'} in a ${platform() === 'ios' ? 'WKWebView' : 'WebView'}`)),
      seg([['flutter', 'Flutter'], ['kotlin', 'Kotlin'], ['swift', 'Xcode']], kind, (k) => { kind = k; codeFiles = null; perm = 'prompt'; start(); }),
      seg([['app', 'Game'], ['code', 'Code']], view, (k) => { view = k; drawAll(); }),
      h('div', { class: 'npv-acts' },
        zoom.controls,
        h('button', { class: 'npv-btn', title: 'Build the game again from the project and restart it', onclick: () => refresh() }, '↺ Restart'),
        h('button', { class: 'npv-btn primary', onclick: () => download(kind) }, '⬇ Download'),
        where.button(),
        h('button', { class: 'npv-btn', 'aria-label': 'Close', onclick: close }, '✕')));
  }
  function drawLog() {
    logBox.replaceChildren(h('b', {}, 'Native calls'), ...(log.length ? log.map((l) => h('div', { class: 'npv-logl' }, h('small', {}, l.at), ' ', l.t)) : [h('div', { class: 'npv-logl muted' }, `Haptics, notifications${hasStore() ? ', purchases' : ''} and Back show up here, the way the ${label()} project answers them.`)]));
  }
  function overlay(el) { phone.querySelector('.npv-over')?.remove(); if (el) phone.append(h('div', { class: 'npv-over' }, el)); }
  function banner(title, body, key) {
    const b = h('button', { class: 'npv-banner', onclick: () => { b.remove(); note(`Notification tapped: “${title}” → the game gets “notification opened ${key || ''}”`); event('localNotificationActionPerformed', { notification: { extra: { key } } }); } }, h('b', {}, title || game.name), h('span', {}, body || ''));
    phone.append(b); setTimeout(() => b.remove(), 6000);
  }

  /** The bridge, answered the way each project answers it. */
  function onMessage(text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.exit) { note('The game asked to close the app (Back on its first page)'); closed = true; overlay(h('div', { class: 'npv-closed' }, h('b', {}, 'App closed'), h('button', { class: 'npv-pbtn filled', onclick: () => start() }, 'Open it again'))); return; }
    const { id, plugin, method, args = {} } = m, ok = (v = {}) => reply(id, true, v), no = (why) => { note(`${plugin}.${method}: ${why}`); reply(id, false, why); };
    if (plugin === 'Haptics') {
      const what = method === 'impact' ? args.style || 'MEDIUM' : method === 'notification' ? args.type || 'SUCCESS' : `vibrate ${args.duration || 300} ms`;
      note(`Haptic: ${String(what).toLowerCase()}`); phone.classList.remove('buzz'); void phone.offsetWidth; phone.classList.add('buzz'); try { navigator.vibrate?.(30); } catch { /* not here */ }
      return ok();
    }
    if (plugin === 'LocalNotifications') {
      if (!hasNotifs()) {
        if (method === 'checkPermissions' || method === 'requestPermissions') { note('Notifications: not in the Kotlin project yet (the game hears “denied”)'); return ok({ display: 'denied' }); }
        if (['getPending'].includes(method)) return ok({ notifications: [] });
        if (['createChannel', 'cancel'].includes(method)) return ok();
        return no('not in the Kotlin project yet');
      }
      switch (method) {
        case 'checkPermissions': return ok({ display: perm });
        case 'requestPermissions':
          if (perm !== 'prompt') return ok({ display: perm });
          overlay(h('div', { class: 'npv-alert' + (platform() === 'ios' ? '' : ' android') }, platform() === 'ios' ? [h('b', {}, `“${game.name || 'Game'}” would like to send you notifications`), h('p', {}, 'Notifications may include alerts, sounds and badges.')] : [h('b', {}, `Allow ${game.name || 'Game'} to send you notifications?`)],
            h('div', {}, h('button', { onclick: () => { perm = 'denied'; overlay(null); note('Notifications: not allowed'); ok({ display: perm }); } }, "Don't Allow"), h('button', { class: 'on', onclick: () => { perm = 'granted'; overlay(null); note('Notifications: allowed'); ok({ display: perm }); } }, 'Allow'))));
          return;
        case 'createChannel': return ok();
        case 'getPending': return ok({ notifications: [] });
        case 'cancel': note(`Notification cancelled (${(args.notifications || []).map((n) => n.id).join(', ')})`); return ok();
        case 'schedule':
          for (const n of args.notifications || []) {
            const s = n.schedule || {}, key = n.extra?.key || '';
            if (s.at) { const ms = new Date(s.at).getTime() - Date.now(); note(`Notification scheduled: “${n.title}” in ${Math.max(1, Math.round(ms / 1000))} s`); if (ms < 120000) setTimeout(() => !closed && banner(n.title, n.body, key), Math.max(300, ms)); }
            else if (s.on) note(`Notification every day at ${String(s.on.hour).padStart(2, '0')}:${String(s.on.minute || 0).padStart(2, '0')}: “${n.title}”`);
            else if (s.every) note(`Notification every ${s.every}: “${n.title}”`);
            else { note(`Notification: “${n.title}”`); banner(n.title, n.body, key); }
          }
          return ok();
      }
    }
    if (plugin === 'Purchases') {
      if (!hasStore()) return no('in-app purchases aren’t in the Kotlin project yet');
      const P = (pid) => products.find((p) => p.id === pid) || { id: pid, name: pid, price: '' };
      if (method === 'products') { note(`Store: ${(args.items || []).length} product prices asked for`); return ok({ products: (args.items || []).map((i) => { const p = P(i.id); return { id: p.id, title: p.name, description: '', price: p.price || '$0.99' }; }) }); }
      if (method === 'buy') {
        const p = P(args.id);
        overlay(h('div', { class: 'npv-sheet' }, h('small', {}, platform() === 'ios' ? 'App Store' : 'Google Play'), h('b', {}, p.name), h('span', { class: 'price' }, p.price || '$0.99'), h('p', {}, 'Test purchase: nothing is charged.'),
          h('button', { class: 'npv-pbtn filled', onclick: () => { overlay(null); if (args.type !== 'consumable') owned.add(p.id); note(`Bought “${p.name}”`); ok({ status: 'bought', id: p.id }); } }, platform() === 'ios' ? 'Purchase' : 'Buy'),
          h('button', { class: 'npv-pbtn outlined', onclick: () => { overlay(null); note(`Purchase cancelled: “${p.name}”`); ok({ status: 'cancelled' }); } }, 'Cancel')));
        return;
      }
      note(`Store: ${method === 'restore' ? 'purchases restored' : 'owned products checked'}`); return ok({ ids: [...owned] });
    }
    return no('not available');
  }

  async function start() {
    closed = false; overlay(null); drawHead(); drawLog();
    const ios = platform() === 'ios';
    phone.className = 'npv-phone game ' + (ios ? 'ios' : 'material');
    if (!url) {
      phone.replaceChildren(h('div', { class: 'npv-empty' }, 'Building the game…'));
      let src = await html(fresh); fresh = false;
      window.__pkPreviewBridge = onMessage;
      const inject = (p) => `<script>window.__pkPlatform=${JSON.stringify(p)};window.ReactNativeWebView={postMessage:function(s){try{parent.__pkPreviewBridge(s)}catch(e){}}};${bridge.replace(/ true;$/, '')}</script>`;
      url = { android: URL.createObjectURL(new Blob([src.replace(/<head[^>]*>/i, (m) => m + inject('android'))], { type: 'text/html' })), ios: URL.createObjectURL(new Blob([src.replace(/<head[^>]*>/i, (m) => m + inject('ios'))], { type: 'text/html' })) };
      src = null;
    }
    page = h('iframe', { class: 'npv-frame', src: url[platform()], title: 'The game', allow: 'autoplay; fullscreen; vibrate' });
    phone.replaceChildren(...[h('div', { class: 'npv-status' }, h('span', {}, '9:41'), h('span', {}, '▂▄▆ ◉')), page, ios && h('div', { class: 'npv-home' })].filter(Boolean));
    keys.replaceChildren(...(ios ? [h('small', {}, 'iOS has no Back button: the game\'s own buttons go back.')] : [
      h('button', { class: 'npv-key', 'aria-label': 'Back', title: 'Android Back: goes back a page in the game, or closes the app', onclick: () => { note('Back button'); try { win()?.__pkBack?.(); } catch { /* reloading */ } } }, '◁'),
      h('button', { class: 'npv-key', 'aria-label': 'Home', title: 'Restart', onclick: () => start() }, '○')]));
    if (view === 'code' || wide()) drawCode();
    zoom.apply();
  }

  async function drawCode() {
    if (!codeFiles) {
      codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Writing the project…'));
      try { codeFiles = (await files(kind)).filter((f) => typeof f.data === 'string'); } catch (err) { codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Could not write the project: ' + err.message)); return; }
      codeSel = (codeFiles.find((f) => /main\.dart$|GameBridge\.kt$|GameApp\.swift$/.test(f.name)) || codeFiles[0])?.name || '';
    }
    const f = codeFiles.find((x) => x.name === codeSel) || codeFiles[0], short = (n) => n.split('/').slice(1).join('/');
    const big = f.data.length > 60000, text = big ? f.data.slice(0, 4000) + `\n\n… (${Math.round(f.data.length / 1024)} KB: your whole game in one file)` : f.data;
    codeBox.replaceChildren(
      h('div', { class: 'npv-ctools' }, h('select', { class: 'npv-files', 'aria-label': 'File', onchange: (e) => { codeSel = e.target.value; drawCode(); } }, codeFiles.map((x) => h('option', { value: x.name, selected: x.name === f.name }, short(x.name)))),
        h('button', { class: 'npv-btn', onclick: async () => { try { await navigator.clipboard.writeText(f.data); toast('Copied ' + short(f.name)); } catch { toast('Select the text to copy it'); } } }, 'Copy')),
      h('pre', { class: 'npv-pre' }, text.split('\n').map((l) => h('div', {}, l || ' '))));
  }
  const wide = () => root.isConnected && root.clientWidth >= 900;
  function drawAll() { drawHead(); root.dataset.view = view; if (view === 'code' || wide()) drawCode(); zoom.apply(); }
  /** Build the game again from the project (after an edit) and restart it. */
  function refresh() { if (url) { URL.revokeObjectURL(url.android); URL.revokeObjectURL(url.ios); } url = ''; fresh = true; codeFiles = null; start(); }
  let soon = 0, onClose = null;
  const refreshSoon = () => { clearTimeout(soon); soon = setTimeout(() => { if (root.isConnected) refresh(); }, 1500); };
  const onKey = (e) => { if (e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) close(); };
  function close() { clearTimeout(soon); zoom.stop(); root.remove(); removeEventListener('keydown', onKey); if (window.__pkPreviewBridge === onMessage) delete window.__pkPreviewBridge; if (url) { URL.revokeObjectURL(url.android); URL.revokeObjectURL(url.ios); } onClose?.(); }
  addEventListener('keydown', onKey);
  root.dataset.view = view;
  root.classList.toggle('docked', !!host); (host || document.body).append(root);
  start();
  return { root, close, onMessage, refresh, refreshSoon, set onClose(f) { onClose = f; } };
}
