// Native App Preview: try the app the way the native exports build it (Flutter, Kotlin / Compose, SwiftUI) and browse their
// code, right in the editor. The preview runs the same model and the same rules as the native runtimes (lib/pocket.dart,
// Pocket.kt, Pocket.swift): pages, tabs, back, Data Lists, Forms, stats, {variables}. Material look for Flutter and Kotlin,
// iOS look for SwiftUI. Nothing is compiled here: Download gives the real project.
import { appModel, PALETTES } from './appmodel.js';
import { names } from './nativecode.js';

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
const show = (v) => (v == null ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v));
const num = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? +v : v == null || v === '' || isNaN(+v) ? null : +v);
const isOn = (v) => v === true || v === 1 || v === 'yes' || v === 'true';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ICON_SVG = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17l-5-5', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  chat: 'M4 5h16v11H8l-4 4z', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 4h4', heart: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z', star: 'M12 3l2.7 6 6.3.6-4.8 4.2 1.5 6.2L12 17l-5.7 3 1.5-6.2L3 9.6 9.3 9z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8-3l2-1-2-4-2 1-2-1V5h-4v2l-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1v2h4v-2l2-1 2 1 2-4-2-1z', plus: 'M12 5v14M5 12h14', video: 'M4 6h12v12H4zm12 4l5-3v10l-5-3', list: 'M4 6h16M4 12h16M4 18h16', circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
};
const ICON_ALIAS = { explore: 'search', profile: 'user', users: 'user', gear: 'settings', add: 'plus', play: 'video', menu: 'list' };
const svgIcon = (name) => { const d = ICON_SVG[ICON_ALIAS[name] || name] || ICON_SVG.circle; const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'npv-ic'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); s.append(p); return s; };

/** The app's state, with the same rules as the native runtimes. */
function makeApp(model) {
  const A = { vars: { ...model.vars }, data: {}, tab: 0, stacks: model.tabs.length ? model.tabs.map(() => []) : [[]], openCollection: null, openId: null, roots: {} };
  const now = Date.now();
  for (const c of model.collections) A.data[c.name] = c.rows.map((r, i) => ({ _id: 's' + i, _at: now - i * 1000, ...r }));
  A.def = (name) => model.collections.find((c) => c.name === name);
  A.rows = (name) => A.data[name] || [];
  A.opened = () => (A.openCollection && A.openId ? A.rows(A.openCollection).find((r) => r._id === A.openId) || null : null);
  A.fill = (t, row) => String(t).replace(/\{(\w+)\}/g, (m, k) => (row && k in row ? show(row[k]) : k.startsWith('record_') ? show(A.opened()?.[k.slice(7)]) : show(A.vars[k])));
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
  A.work = () => { for (const s of model.stats) A.vars[s.var] = A.stat(s.collection, s.how, s.field, s.filter); };
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
      default: return `“${action}” has no native version yet (a TODO in the code)`;
    }
    return '';
  };
  A.work();
  return A;
}

/** opts: { game, files(kind) → Promise<[{name, data}]>, download(kind), toast(msg) } */
export function openNativePreview({ game, files, download, toast = () => {} }) {
  const model = appModel(game), N = names(model);
  let kind = 'flutter', view = 'app', A = makeApp(model), codeFiles = null, codeSel = '', note = '';
  const dark = () => { const d = A.vars.darkMode; return typeof d === 'boolean' ? d : model.theme === 'dark' ? true : model.theme === 'light' ? false : matchMedia('(prefers-color-scheme: dark)').matches; };
  const pal = () => (dark() ? { ...PALETTES.dark } : { ...PALETTES.light, accent: model.accent });
  const col = (c, P) => { if (!c) return null; const t = /^@(\w+)$/.exec(c); return t ? P[t[1]] || null : /^#[0-9a-f]{6}$/i.test(c) ? c : null; };

  const phone = h('div', { class: 'npv-phone' }), codeBox = h('div', { class: 'npv-code' });
  const seg = (items, cur, pick) => h('div', { class: 'npv-seg', role: 'tablist' }, items.map(([k, label]) => h('button', { class: k === cur ? 'on' : '', role: 'tab', 'aria-selected': String(k === cur), 'data-k': k, onclick: () => pick(k) }, label)));
  const head = h('div', { class: 'npv-head' });
  const body = h('div', { class: 'npv-body' }, h('div', { class: 'npv-app' }, phone, h('div', { class: 'npv-note' })), codeBox);
  const root = h('div', { class: 'npv', role: 'dialog', 'aria-label': 'Native app preview' }, head, body);

  function drawHead() {
    head.replaceChildren(
      h('div', { class: 'npv-title' }, h('b', {}, 'Native app'), h('small', {}, `${model.pages.length} pages · ${model.collections.length} data collection${model.collections.length === 1 ? '' : 's'}`)),
      seg([['flutter', 'Flutter'], ['kotlin', 'Kotlin'], ['swift', 'SwiftUI']], kind, (k) => { kind = k; codeFiles = null; drawAll(); }),
      seg([['app', 'App'], ['code', 'Code']], view, (k) => { view = k; drawAll(); }),
      h('div', { class: 'npv-acts' },
        h('button', { class: 'npv-btn', title: 'Start again with the sample data', onclick: () => { A = makeApp(model); note = ''; drawPhone(); } }, '↺ Reset'),
        h('button', { class: 'npv-btn primary', onclick: () => download(kind) }, '⬇ Download'),
        h('button', { class: 'npv-btn', 'aria-label': 'Close', onclick: close }, '✕')),
    );
  }

  // ---------- the app ----------
  function element(x, P, entry) {
    switch (x.kind) {
      case 'text': return h('div', { class: 'npv-text', style: `font-size:${Math.round(x.size)}px;font-weight:${parseInt(x.weight, 10) || 600};color:${col(x.color, P) || P.text}` }, A.fill(x.value));
      case 'button': return h('button', { class: 'npv-pbtn ' + (x.outlined ? (/danger/.test(x.color) ? 'danger' : 'outlined') : 'filled'), onclick: () => act(x.action, x.value, x.amount) }, A.fill(x.label));
      case 'input': return h('div', { class: 'npv-field' + (x.keyboard === 'search' ? ' search' : '') }, x.keyboard === 'search' && svgIcon('search'),
        h('input', { 'data-k': 'v:' + x.var, type: x.keyboard === 'password' ? 'password' : x.keyboard === 'number' ? 'number' : 'text', placeholder: x.placeholder, value: show(A.vars[x.var]), oninput: (e) => { A.set(x.var, x.keyboard === 'number' ? +e.target.value || 0 : e.target.value); drawPhone(); } }));
      case 'toggle': { const on = A.vars[x.var] != null ? isOn(A.vars[x.var]) : x.var === 'darkMode' && dark(); return h('label', { class: 'npv-toggle' }, x.label ? h('span', {}, A.fill(x.label)) : h('span'), h('input', { type: 'checkbox', role: 'switch', checked: on, onchange: (e) => { A.set(x.var, e.target.checked); drawPhone(); } })); }
      case 'row': return h('div', { class: 'npv-card row' }, x.children.map((c) => element(c, P, entry)));
      case 'items': return h('div', { class: 'npv-card' }, x.items.map((t) => h('div', { class: 'npv-li' }, A.fill(t))));
      case 'image': return h('img', { class: 'npv-img', src: x.src, alt: '', style: `height:${x.h}px` });
      case 'list': return list(x, P);
      case 'form': return form(x, P, entry);
      case 'feed': return feed(x, P);
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
      default: return h('div', { class: 'npv-todo' }, h('b', {}, x.name), h('small', {}, `${x.type}: a TODO placeholder in the native code`));
    }
  }
  function list(x, P) {
    const rows = A.query(x.collection, x.filter, x.search ? show(A.vars[x.search]) : '', x.sort);
    if (!rows.length) return h('div', { class: 'npv-empty' + (x.fill ? ' fill' : '') }, x.empty);
    return h('div', { class: 'npv-list' + (x.fill ? ' fill' : '') }, rows.map((r) => {
      const done = x.check && isOn(r[x.check]);
      return h('div', { class: 'npv-row' + (done ? ' done' : ''), 'data-id': r._id, onclick: () => { if (!x.openPage) return; A.openCollection = x.collection; A.openId = r._id; A.go(x.openPage); drawPhone(); } },
        x.check ? h('input', { type: 'checkbox', class: 'npv-check', checked: done, 'aria-label': 'Done', onclick: (e) => e.stopPropagation(), onchange: (e) => { A.updateRecord(x.collection, r._id, { [x.check]: e.target.checked }); drawPhone(); } })
          : x.icon ? h('span', { class: 'npv-rowic' }, A.fill(x.icon, r)) : null,
        h('div', { class: 'npv-rowt' }, h('b', {}, A.fill(x.title, r)), x.subtitle && h('small', {}, A.fill(x.subtitle, r))),
        h('button', { class: 'npv-del', 'aria-label': 'Delete', title: kind === 'swift' ? 'Swipe to delete' : 'Delete', onclick: (e) => { e.stopPropagation(); A.deleteRecord(x.collection, r._id); drawPhone(); } }, '🗑'),
        x.openPage && h('span', { class: 'npv-chev' }, '›'));
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
  const me = () => show(A.vars.playerHandle) || 'me', meName = () => show(A.vars.playerName) || 'Me';
  const AV = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const avColor = (s) => AV[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
  const avatar = (name, handle, size = 40) => h('span', { class: 'npv-av', style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${avColor(handle || name)}` }, (show(name).trim()[0] || '?').toUpperCase());
  const firstMedia = (m) => show(m).split('|')[0].trim();
  const media = (r, height) => { const m = firstMedia(r.media); if (!m) return null; const bg = /^#[0-9a-f]{6}$/i.test(show(r.color)) ? r.color : avColor(r.handle || r.title || m);
    return /^(https?:|data:)/.test(m) ? h('img', { class: 'npv-media', src: m, alt: '', style: `height:${height}px` }) : h('div', { class: 'npv-media', style: `height:${height}px;background:${bg};font-size:${Math.round(height * 0.4)}px` }, m); };
  const openProfile = (page, handle, name) => { if (!page) return; A.vars.profile = handle; A.vars.profile_name = name; A.go(page); drawPhone(); };
  const toggle = (coll, r, flag, count) => { const on = !isOn(r[flag]); A.updateRecord(coll, r._id, count ? { [flag]: on, [count]: Math.max(0, (num(r[count]) || 0) + (on ? 1 : -1)) } : { [flag]: on }); drawPhone(); };
  function feed(x) {
    const rows = A.query(x.collection, x.filter, x.search ? show(A.vars[x.search]) : '', 'newest first');
    if (!rows.length) return h('div', { class: 'npv-empty' }, x.empty);
    if (x.look === 'grid') return h('div', { class: 'npv-grid', style: `grid-template-columns:repeat(${x.columns},1fr)` }, rows.map((r) => h('div', { class: 'npv-tile', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, media(r, 110) || h('div', { class: 'npv-media', style: 'height:110px' }, show(r.text).slice(0, 40)))));
    return h('div', { class: 'npv-feed' }, rows.map((r) => h('div', { class: 'npv-post', 'data-id': r._id },
      h('div', { class: 'npv-phead', onclick: () => openProfile(x.profilePage, r.handle, r.author) }, avatar(r.author, r.handle),
        h('div', { class: 'npv-rowt' }, h('b', {}, show(r.author), isOn(r.verified) && h('span', { class: 'npv-ver' }, ' ✓')), h('small', {}, '@' + show(r.handle) + (r.location ? ' · ' + show(r.location) : '')))),
      r.text && h('div', { class: 'npv-ptext' }, show(r.text)),
      media(r, x.look === 'reels' ? 380 : 200),
      h('div', { class: 'npv-acts2' },
        h('button', { 'data-act': 'comments' }, '💬 ' + show(num(r.comments) || 0)),
        h('button', { 'data-act': 'repost', class: isOn(r.reposted) ? 'on good' : '', onclick: () => toggle(x.collection, r, 'reposted', 'reposts') }, '🔁 ' + show(num(r.reposts) || 0)),
        h('button', { 'data-act': 'like', class: isOn(r.liked) ? 'on bad' : '', onclick: () => toggle(x.collection, r, 'liked', 'likes') }, (isOn(r.liked) ? '❤️ ' : '🤍 ') + show(num(r.likes) || 0)),
        h('button', { 'data-act': 'save', class: isOn(r.saved) ? 'on' : '', onclick: () => toggle(x.collection, r, 'saved') }, isOn(r.saved) ? '🔖 Saved' : '🔖')))));
  }
  function composer(x, entry) {
    const post = () => { const t = show(entry.draft).trim(); if (!t) return; A.addRecord(x.collection, { author: meName(), handle: me(), text: t, likes: 0, comments: 0, reposts: 0, liked: false, reposted: false, saved: false }); entry.draft = ''; drawPhone(); };
    return h('div', { class: 'npv-compose' }, avatar(meName(), me()),
      h('input', { class: 'npv-input', 'data-k': 'compose', placeholder: x.placeholder, value: show(entry.draft), oninput: (e) => { entry.draft = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') post(); } }),
      h('button', { class: 'npv-pbtn filled small', 'data-post': '', onclick: post }, 'Post'));
  }
  let story = null;
  function stories(x) {
    const rows = A.query(x.collection);
    return h('div', { class: 'npv-stories' }, rows.map((r) => h('button', { class: 'npv-story', onclick: () => { story = r; drawPhone(); } },
      h('span', { class: 'npv-ring' }, h('span', { class: 'npv-av', style: `width:56px;height:56px;font-size:26px;background:${/^#/.test(show(r.color)) ? r.color : avColor(r.handle)}` }, firstMedia(r.media) && !/^(https?:|data:)/.test(firstMedia(r.media)) ? firstMedia(r.media) : (show(r.author)[0] || '?'))),
      h('small', {}, show(r.author).split(' ')[0]))));
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
    const name = A.fill(x.name), handle = A.fill(x.handle), own = { posts_count: A.rows('Posts').filter((r) => show(r.handle) === handle).length, points: num(A.vars.points) || 0 };
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

  function drawPhone() {
    const focus = document.activeElement?.dataset?.k, sel = focus ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const P = pal(), stack = A.stack(), entry = stack[stack.length - 1] || (A.roots[A.tab] ||= { form: null });
    const pageName = stack.length ? entry.page : model.tabs.length ? model.tabs[A.tab].page : model.home, page = model.pages.find((p) => p.value === pageName) || model.pages[0];
    const fills = page.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
    const vars = Object.entries(P).map(([k, v]) => `--${k}:${v}`).join(';');
    phone.className = 'npv-phone ' + (kind === 'swift' ? 'ios' : 'material') + (dark() ? ' dark' : '');
    phone.style.cssText = vars;
    phone.replaceChildren(...[
      h('div', { class: 'npv-status' }, h('span', {}, '9:41'), h('span', {}, '▂▄▆ ◉')),
      model.appBar && h('div', { class: 'npv-bar' },
        stack.length ? h('button', { class: 'npv-back', 'aria-label': 'Back', onclick: () => { A.back(); drawPhone(); } }, kind === 'swift' ? '‹ Back' : '←') : h('span', { class: 'npv-back-sp' }),
        h('b', { class: 'npv-btitle' }, A.fill(page.title)), h('span', { class: 'npv-back-sp' })),
      h('div', { class: 'npv-page' + (fills ? ' fills' : ''), 'data-page': page.value }, page.items.map((x) => element(x, P, entry))),
      page.fab && h('button', { class: 'npv-fab', 'aria-label': 'Add', onclick: () => act(page.fab.action, page.fab.value, page.fab.amount) }, '+'),
      overlay(),
      model.tabs.length && !stack.length && h('div', { class: 'npv-tabs' }, model.tabs.map((t, i) => {
        const n = t.badge ? num(A.vars[t.badge]) || 0 : 0;
        return h('button', { class: 'npv-tab' + (i === A.tab ? ' on' : ''), 'data-tab': t.page, onclick: () => { A.go(t.page); drawPhone(); } }, h('span', { class: 'npv-tabic' }, svgIcon(t.icon), n > 0 && h('i', {}, n > 99 ? '99+' : n)), h('small', {}, t.label));
      })),
    ].filter((c) => c && c.nodeType));
    root.querySelector('.npv-note').textContent = note || `Running the ${kind === 'swift' ? 'SwiftUI' : kind === 'kotlin' ? 'Kotlin (Compose)' : 'Flutter'} app's rules: tap around, add and edit records. ${kind === 'swift' ? 'iOS look' : 'Material look (Android and iOS)'}.`;
    if (focus) { const el = phone.querySelector(`[data-k="${CSS.escape(focus)}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel[0], sel[1]); } catch { /* number inputs */ } } }
    if (view === 'code' && codeFiles) markPage();
  }

  // ---------- the code ----------
  const pageFile = (value) => { const n = N[value]; if (!n) return ''; const snake = n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); return kind === 'flutter' ? `/pages/${snake}.dart` : kind === 'swift' ? `/Pages/${n}.swift` : `/pages/${n}.kt`; };
  function markPage() {
    const st = A.stack(), cur = st.length ? st[st.length - 1].page : model.tabs.length ? model.tabs[A.tab].page : model.home;
    const btn = codeBox.querySelector('.npv-thispage'); if (btn) btn.dataset.page = cur;
  }
  async function drawCode() {
    if (!codeFiles) {
      codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Writing the code…'));
      try { codeFiles = (await files(kind)).filter((f) => typeof f.data === 'string'); } catch (err) { codeBox.replaceChildren(h('div', { class: 'npv-empty' }, 'Could not write the code: ' + err.message)); return; }
      const pref = codeFiles.find((f) => f.name.endsWith(pageFile(model.home))) || codeFiles.find((f) => /main\.dart$|App\.kt$|App\.swift$/.test(f.name)) || codeFiles[0];
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

  function drawAll() { drawHead(); root.dataset.view = view; drawPhone(); if (view === 'code' || matchMedia('(min-width: 900px)').matches) drawCode(); }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { root.remove(); removeEventListener('keydown', onKey); }
  addEventListener('keydown', onKey);
  document.body.append(root);
  drawAll();
  return { root, close, app: A };
}

// =============================================================================================================
// Games: the real game in the phone, inside a web view the way the Flutter / Kotlin / Xcode projects host it,
// with their native bridge simulated (notifications, permission prompts, purchases, haptics, Back, closing).
// =============================================================================================================

/** opts: { game, html() → Promise<string> (the native build), bridge (the window.Capacitor bridge script), products, files(kind), download(kind), toast } */
export function openGamePreview({ game, html, bridge, products = [], files, download, toast = () => {} }) {
  let kind = 'flutter', view = 'app', codeFiles = null, codeSel = '', page = null, url = '', perm = 'prompt', owned = new Set(), sheet = null, closed = false;
  const log = [];
  const phone = h('div', { class: 'npv-phone game' }), codeBox = h('div', { class: 'npv-code' }), logBox = h('div', { class: 'npv-log', 'aria-live': 'polite' });
  const head = h('div', { class: 'npv-head' }), keys = h('div', { class: 'npv-keys' });
  const root = h('div', { class: 'npv', role: 'dialog', 'aria-label': 'Native game preview' }, head, h('div', { class: 'npv-body' }, h('div', { class: 'npv-app' }, phone, keys, logBox), codeBox));
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
        h('button', { class: 'npv-btn', title: 'Start the game again', onclick: () => start() }, '↺ Restart'),
        h('button', { class: 'npv-btn primary', onclick: () => download(kind) }, '⬇ Download'),
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
      let src = await html();
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
    if (view === 'code' || matchMedia('(min-width: 900px)').matches) drawCode();
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
  function drawAll() { drawHead(); root.dataset.view = view; if (view === 'code' || matchMedia('(min-width: 900px)').matches) drawCode(); }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { root.remove(); removeEventListener('keydown', onKey); if (window.__pkPreviewBridge === onMessage) delete window.__pkPreviewBridge; if (url) { URL.revokeObjectURL(url.android); URL.revokeObjectURL(url.ios); } }
  addEventListener('keydown', onKey);
  document.body.append(root);
  root.dataset.view = view;
  start();
  return { root, close, onMessage };
}
