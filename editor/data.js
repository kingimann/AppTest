// App Data (Game Settings): collections of records (Tasks, Notes, Expenses…), their fields and starting rows.
// Data Lists, Record Forms, Data Summaries, Triggers and nodes use them; apps save what users add on the device.
import { FIELD_TYPES, fieldKey, fieldsOf, supabaseSQL, profilesSQL } from '../engine/pocket.js';
import { icon } from './icons.js';

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k in el && !k.startsWith('data-') && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

const TYPE_LABEL = { text: 'Text', 'long text': 'Long text', number: 'Number', money: 'Money', 'yes/no': 'Yes / no', date: 'Date', choice: 'Choice', rating: 'Stars (1–5)', icon: 'Icon / emoji' };
/** Collections that a new app (or an app widget in an empty game) starts with. */
export const STARTER_COLLECTIONS = {
  Tasks: { name: 'Tasks', fields: [{ name: 'Title', type: 'text' }, { name: 'Notes', type: 'long text' }, { name: 'Due', type: 'date', default: 'today' }, { name: 'Done', type: 'yes/no' }], rows: [{ title: 'My first task' }] },
  Notes: { name: 'Notes', fields: [{ name: 'Title', type: 'text' }, { name: 'Body', type: 'long text' }], rows: [] },
  Contacts: { name: 'Contacts', fields: [{ name: 'Name', type: 'text' }, { name: 'Phone', type: 'text' }, { name: 'Email', type: 'text' }, { name: 'Favourite', type: 'yes/no' }], rows: [] },
  Expenses: { name: 'Expenses', currency: '$', fields: [{ name: 'Title', type: 'text' }, { name: 'Amount', type: 'money' }, { name: 'Category', type: 'choice', options: 'Food, Transport, Shopping, Bills, Fun, Other' }, { name: 'Date', type: 'date', default: 'today' }], rows: [] },
  Products: { name: 'Products', currency: '$', fields: [{ name: 'Name', type: 'text' }, { name: 'Price', type: 'money' }, { name: 'Icon', type: 'icon', default: '📦' }, { name: 'Rating', type: 'rating' }, { name: 'In stock', type: 'yes/no', default: 'yes' }], rows: [] },
};

let X = null; // { root(), save(), openDialog, closeLayer, toast, redraw }
export function initData(ctx) { X = ctx; }
const cols = () => (X.root().collections ||= []);
const byName = (n) => cols().find((c) => fieldKey(c.name) === fieldKey(n));
/** Make sure the game has at least one collection (app widgets call this). Returns its name. */
export function ensureCollection(name = 'Tasks') {
  if (cols().length) return cols()[0].name;
  cols().push(JSON.parse(JSON.stringify(STARTER_COLLECTIONS[name] || STARTER_COLLECTIONS.Tasks))); X.save();
  setTimeout(() => X.toast(`Also added a “${name}” data collection (Game Settings › Data)`), 1600);
  return name;
}
const storageKey = (c) => 'pocket.data.' + (X.root().name || 'game') + '.' + fieldKey(c.name);
const savedCount = (c) => { try { const v = JSON.parse(localStorage.getItem(storageKey(c)) || 'null'); return Array.isArray(v) ? v.length : null; } catch { return null; } };

// ---- Supabase: read a project's tables (PostgREST describes them) ----
const supaCfg = () => { const st = X.root().settings || {}; return { url: String(st.supabaseUrl || '').trim().replace(/\/+$/, ''), key: String(st.supabaseKey || '').trim() }; };
/** { table: [{ col, type, fmt, pk }] } for every table the anon key can see. */
export async function supabaseTables(url = supaCfg().url, key = supaCfg().key) {
  if (!url || !key) throw new Error('add the Project URL and anon key first');
  const r = await fetch(url + '/rest/v1/', { headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/openapi+json' } });
  if (!r.ok) throw new Error(r.status === 401 ? 'the key was not accepted' : 'error ' + r.status);
  const j = await r.json(), out = {};
  for (const [tb, d] of Object.entries(j.definitions || {})) out[tb] = Object.entries(d.properties || {}).map(([col, p]) => ({ col, type: p.type, fmt: String(p.format || ''), pk: /<pk\/>/.test(p.description || '') }));
  return out;
}
const SKIP_COLS = /^(created_at|inserted_at|updated_at|user_id)$/;
/** A column's type → a field type. */
const fieldTypeOf = (c) => (c.type === 'boolean' ? 'yes/no' : ['integer', 'number'].includes(c.type) ? 'number' : /^date$/.test(c.fmt) ? 'date' : /json/.test(c.fmt) ? 'long text' : 'text');
const prettyName = (col) => col.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (m) => m.toUpperCase());
/** Fields for a collection from a table's columns (the key column and timestamps are left out). */
function fieldsFromColumns(cols0, idCol) {
  return cols0.filter((c) => c.col !== idCol && !SKIP_COLS.test(c.col)).map((c) => { const f = { name: prettyName(c.col), type: fieldTypeOf(c) }; if (fieldKey(f.name) !== c.col) f.column = c.col; return f; });
}
/** A new collection that reads and writes one of the project's own tables. */
export function addTableCollection(table, cols0) {
  const pk = cols0.find((c) => c.pk)?.col || (cols0.some((c) => c.col === 'id') ? 'id' : cols0[0]?.col || 'id');
  let n = prettyName(table), k = 2; while (byName(n)) n = prettyName(table) + ' ' + k++;
  const c = { name: n, online: 'my own table', table, idColumn: pk, fields: fieldsFromColumns(cols0, pk), rows: [] };
  if (cols0.some((q) => q.col === 'created_at')) c.orderBy = 'created_at desc';
  cols().push(c); X.save(); X.redraw?.(); return c;
}

export function openCollectionEditor(i) {
  const c = cols()[i]; if (!c) return;
  const re = () => openCollectionEditor(cols().indexOf(c));
  const F = (c.fields ||= []), R = (c.rows ||= []);
  const setF = (f, k, v) => { if (v === '' || v == null) delete f[k]; else f[k] = v; X.save(); };
  const fieldRow = (f, j) => h('div', { class: 'dt-field' },
    h('input', { type: 'text', value: f.name, placeholder: 'Field name', onchange: (e) => { const old = fieldKey(f.name); f.name = e.target.value.trim() || f.name; const nk = fieldKey(f.name); if (old !== nk) for (const r of R) if (old in r) { r[nk] = r[old]; delete r[old]; } X.save(); re(); } }),
    h('select', { onchange: (e) => { f.type = e.target.value; X.save(); re(); } }, FIELD_TYPES.map((t) => h('option', { value: t, selected: (f.type || 'text') === t }, TYPE_LABEL[t]))),
    f.type === 'choice' && h('input', { type: 'text', class: 'wide', value: Array.isArray(f.options) ? f.options.join(', ') : f.options || '', placeholder: 'Choices: Low, Medium, High', onchange: (e) => { setF(f, 'options', e.target.value); re(); } }),
    h('input', { type: 'text', class: 'def', value: f.default ?? '', placeholder: f.type === 'date' ? 'Starts as (today)' : f.type === 'yes/no' ? 'Starts as (no)' : 'Starts as', onchange: (e) => setF(f, 'default', e.target.value) }),
    h('div', { class: 'dt-acts' },
      j > 0 && h('button', { class: 'ib', title: 'Move up', onclick: () => { F.splice(j - 1, 0, F.splice(j, 1)[0]); X.save(); re(); } }, '↑'),
      h('button', { class: 'ib', title: 'Delete field', onclick: () => { if (!confirm(`Delete the field “${f.name}”?`)) return; F.splice(j, 1); X.save(); re(); } }, icon('trash'))));
  const keys = fieldsOf(c);
  const cell = (r, f) => f.type === 'yes/no'
    ? h('input', { type: 'checkbox', checked: r[f.key] === true || r[f.key] === 'yes', onchange: (e) => { r[f.key] = e.target.checked; X.save(); } })
    : f.type === 'choice' ? h('select', { onchange: (e) => { r[f.key] = e.target.value; X.save(); } }, h('option', { value: '' }, '—'), f.options.map((o) => h('option', { value: o, selected: r[f.key] === o }, o)))
      : h('input', { type: f.type === 'date' ? 'date' : ['number', 'money', 'rating'].includes(f.type) ? 'number' : 'text', value: r[f.key] ?? '', onchange: (e) => { const v = e.target.value; r[f.key] = ['number', 'money', 'rating'].includes(f.type) ? (v === '' ? '' : +v) : v; X.save(); } });
  const saved = savedCount(c);
  X.openDialog('Data Collection', [
    h('div', { class: 'it-grid' },
      h('label', { class: 'it-f' }, h('span', {}, 'Name (Data Lists and Forms use it)'), h('input', { type: 'text', value: c.name, onchange: (e) => { const n = e.target.value.trim(); if (!n || (byName(n) && byName(n) !== c)) { X.toast('Pick a different name'); re(); return; } c.name = n; X.save(); X.redraw?.(); re(); } })),
      keys.some((f) => f.type === 'money') && h('label', { class: 'it-f' }, h('span', {}, 'Money symbol'), h('input', { type: 'text', value: c.currency ?? '$', onchange: (e) => { c.currency = e.target.value; X.save(); } }))),
    h('label', { class: 'it-f' }, h('span', {}, 'Store online (Supabase)'), h('select', { onchange: (e) => { const v = e.target.value; if (v === 'off') delete c.online; else c.online = v; X.save(); re(); } },
      [['off', 'No: on the phone only'], ['private to each person', 'Yes, private to each person'], ['shared with everyone', 'Yes, shared with everyone'], ['my own table', 'Yes, from a table I already have']].map(([v, l]) => h('option', { value: v, selected: (c.online || 'off') === v }, l)))),
    c.online && h('div', { class: 'it-grid' },
      h('label', { class: 'it-f' }, h('span', {}, 'Table name in Supabase'), h('input', { type: 'text', value: c.table || fieldKey(c.name), onchange: (e) => { const v = e.target.value.trim(); c.table = (c.online === 'my own table' ? v.replace(/[^\w]/g, '_') : v.replace(/[^a-z0-9_]/gi, '_').toLowerCase()) || fieldKey(c.name); X.save(); re(); } })),
      c.online === 'my own table' && h('label', { class: 'it-f' }, h('span', {}, 'Key column (each row\'s id)'), h('input', { type: 'text', value: c.idColumn || 'id', onchange: (e) => { c.idColumn = e.target.value.trim() || 'id'; X.save(); } })),
      c.online === 'my own table' && h('label', { class: 'it-f' }, h('span', {}, 'Sort by (e.g. created_at desc)'), h('input', { type: 'text', value: c.orderBy || '', placeholder: 'created_at desc', onchange: (e) => { setF(c, 'orderBy', e.target.value.trim()); } })),
      c.online === 'my own table' && h('label', { class: 'it-f' }, h('span', {}, 'Only rows where (e.g. status=eq.open)'), h('input', { type: 'text', value: c.where || '', placeholder: 'status=eq.open', onchange: (e) => { setF(c, 'where', e.target.value.trim()); } })),
      h('label', { class: 'it-f' }, h('span', {}, 'Check for new records every … seconds (0 = only when it opens)'), h('input', { type: 'number', min: 0, step: 1, value: c.refresh || 0, onchange: (e) => { c.refresh = Math.max(0, +e.target.value || 0); if (!c.refresh) delete c.refresh; X.save(); } }))),
    c.online && h('label', { class: 'it-f bool' }, h('span', {}, 'Update live when the table changes (Supabase Realtime)'), h('input', { type: 'checkbox', checked: !!c.live, onchange: (e) => { if (e.target.checked) c.live = true; else delete c.live; X.save(); re(); } })),
    c.online === 'my own table' ? h('p', { class: 'desc' }, 'Reads and writes your table\'s columns: a column called “due_date” fills the field Due date. New rows get their id from the table (give the key column a default, like an identity or gen_random_uuid()). Your table\'s row level security rules decide who can read and write it.', c.live ? ' For live updates, run the setup SQL once.' : '')
    : c.online && h('p', { class: 'desc' }, c.online === 'shared with everyone'
      ? 'Everyone sees every record; signed-in people add records, and only change or delete their own. A field called “author” is filled in with the writer\'s name. Good for feeds, chats, reviews and leaderboards.'
      : 'Each signed-in person sees only their own records, on every phone they sign in on. Signing out hides them.'),
    c.online === 'my own table' && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: async () => {
      try { const T = await supabaseTables(), cs = T[c.table || fieldKey(c.name)]; if (!cs) { X.toast(`No table “${c.table || fieldKey(c.name)}” (tables: ${Object.keys(T).join(', ') || 'none the key can see'})`); return; }
        const pk = c.idColumn || cs.find((q) => q.pk)?.col || 'id'; let added = 0; for (const f of fieldsFromColumns(cs, pk)) if (!F.some((q) => fieldKey(q.name) === fieldKey(f.name) || (q.column && q.column === f.column))) { F.push(f); added++; }
        X.save(); X.toast(added ? `Added ${added} field${added === 1 ? '' : 's'} from the table` : 'The fields already match the table'); re(); } catch (e) { X.toast('Supabase: ' + e.message); } } }, icon('download'), 'Make fields from the table')),
    c.online && (c.online !== 'my own table' || c.live) && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { const sql = supabaseSQL(c); navigator.clipboard?.writeText(sql).then(() => X.toast('Setup SQL copied: paste it in Supabase › SQL Editor and Run'), () => X.toast('Copy failed: see Game Settings › Supabase')); } }, icon('copy'), 'Copy setup SQL')),
    h('label', { class: 'it-f bool' }, h('span', {}, c.online ? 'Keep a copy on the phone (works offline)' : 'Save what people add on their phone'), h('input', { type: 'checkbox', checked: c.keep !== false, onchange: (e) => { if (e.target.checked) delete c.keep; else c.keep = false; X.save(); } })),
    h('h4', { class: 'tl-h' }, icon('list'), 'Fields'),
    h('p', { class: 'desc' }, `In text, a field is {${keys[0]?.key || 'title'}} in a Data List row, and {record_${keys[0]?.key || 'title'}} on the page of an opened record.`),
    h('div', { class: 'dt-fields' }, F.map(fieldRow)),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { let n = 'Field', k = 2; while (F.some((f) => fieldKey(f.name) === fieldKey(n))) n = 'Field ' + k++; F.push({ name: n, type: 'text' }); X.save(); re(); } }, icon('plus'), 'Add field')),
    h('h4', { class: 'tl-h' }, icon('grid'), `Starting records (${R.length})`),
    h('p', { class: 'desc' }, 'What the app shows the first time it opens. After that, what people add, change and delete is kept on their phone.'),
    keys.length ? h('div', { class: 'dt-table' }, h('table', {},
      h('thead', {}, h('tr', {}, keys.map((f) => h('th', {}, f.name)), h('th'))),
      h('tbody', {}, R.map((r, ri) => h('tr', {}, keys.map((f) => h('td', {}, cell(r, f))), h('td', {}, h('button', { class: 'ib', title: 'Delete record', onclick: () => { R.splice(ri, 1); X.save(); re(); } }, icon('trash')))))))) : h('p', { class: 'desc' }, 'Add a field first.'),
    keys.length && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { R.push({}); X.save(); re(); } }, icon('plus'), 'Add record')),
    saved != null && h('div', { class: 'obox info' }, `This phone has ${saved} saved record${saved === 1 ? '' : 's'} from playing the app. `,
      h('button', { class: 'btn', style: 'margin-top:8px;width:100%', onclick: () => { try { localStorage.removeItem(storageKey(c)); } catch { /* storage unavailable */ } X.toast('Cleared: the app starts from the starting records again'); re(); } }, icon('trash'), 'Clear saved records on this phone')),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { if (!confirm(`Delete the collection “${c.name}”?`)) return; cols().splice(cols().indexOf(c), 1); X.save(); X.closeLayer(); X.redraw?.(); } }, icon('trash'), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { X.closeLayer(); X.redraw?.(); } }, icon('check'), 'Done')),
  ]);
}

export function dataEditor() {
  const box = h('div', { class: 'it-ed' });
  const draw = () => box.replaceChildren(
    h('p', { class: 'desc' }, 'Data for apps: collections of records like tasks, notes, contacts or expenses. Show them with a Data List, add and edit them with a Record Form, and count or total them with a Data Summary.'),
    cols().length ? h('div', { class: 'it-list' }, cols().map((c, i) => h('button', { class: 'it-row', onclick: () => openCollectionEditor(i) },
      h('span', { class: 'it-ic', style: '--r:#6366f1' }, '🗂️'), h('span', { class: 'it-t' }, h('b', {}, c.name), h('small', {}, `${fieldsOf(c).map((f) => f.name).join(', ') || 'no fields'} · ${(c.rows || []).length} starting`)), icon('chevron'))))
      : h('p', { class: 'desc' }, 'No collections yet.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { let n = 'Items', k = 2; while (byName(n)) n = 'Items ' + k++; cols().push({ name: n, fields: [{ name: 'Title', type: 'text' }], rows: [] }); X.save(); draw(); openCollectionEditor(cols().length - 1); } }, icon('plus'), 'New collection'),
      h('select', { class: 'btn', onchange: (e) => { const k = e.target.value; e.target.value = ''; if (!k) return; if (byName(k)) { X.toast(`You already have “${k}”`); return; } cols().push(JSON.parse(JSON.stringify(STARTER_COLLECTIONS[k]))); X.save(); draw(); } },
        h('option', { value: '' }, 'Add a ready-made one…'), Object.keys(STARTER_COLLECTIONS).map((k) => h('option', { value: k }, k)))));
  X.redraw = draw; draw();
  return box;
}

/** Game Settings › Supabase › Connect: check the project, see its tables, use them in the app, and set up Pocket's own online tables. */
export function connectSupabase() {
  const st = (X.root().settings ||= {}), box = h('div', { class: 'sb-wiz' });
  let check = null, tables = null, busy = '';
  const set = (k, v) => { v = String(v || '').trim(); if (v) st[k] = k === 'supabaseUrl' ? v.replace(/\/+$/, '') : v; else delete st[k]; X.save(); check = null; tables = null; setTimeout(draw); };
  const test = async () => {
    const { url, key } = supaCfg(); busy = 'check'; draw();
    try { const r = await fetch(url + '/auth/v1/settings', { headers: { apikey: key } }); if (!r.ok) throw new Error(r.status === 401 ? 'the key was not accepted' : 'error ' + r.status); const j = await r.json(); const pv = Object.entries(j.external || {}).filter(([k, on]) => on && !['email', 'phone', 'anonymous_users'].includes(k)).map(([k]) => k); check = { ok: true, text: `Connected. People can sign in with email${pv.length ? ', ' + pv.join(', ') : ''}.` }; }
    catch (e) { check = { ok: false, text: /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Could not reach that URL. Check the Project URL.' : 'Not connected: ' + e.message }; }
    busy = ''; draw(); if (check.ok) loadTables();
  };
  const loadTables = async () => { busy = 'tables'; draw(); try { tables = await supabaseTables(); } catch (e) { tables = { _error: e.message }; } busy = ''; draw(); };
  const step = (n, title, ...kids) => h('div', { class: 'sb-step' }, h('h4', { class: 'tl-h' }, h('span', { class: 'sb-n' }, String(n)), title), ...kids);
  const ok = (good, text) => h('div', { class: 'obox ' + (good ? 'ok' : 'error') }, (good ? '✓ ' : '✗ ') + text);
  let drawing = false;
  const draw = () => { if (drawing) return; drawing = true; try { paint(); } finally { drawing = false; } };
  const paint = () => {
    const { url, key } = supaCfg(), cs = cols(), pocketCols = cs.filter((c) => ['private to each person', 'shared with everyone'].includes(c.online)), ownCols = cs.filter((c) => c.online === 'my own table');
    const T = tables && !tables._error ? tables : null, tName = (c) => c.table || fieldKey(c.name);
    box.replaceChildren(
      h('p', { class: 'desc' }, 'Connect your app to a Supabase project: accounts (email, Google, Apple…) and data kept online. A free project works.'),
      step(1, 'Your project',
        h('p', { class: 'desc' }, 'Make a project at supabase.com, then open Project Settings › API and copy the Project URL and the anon public key.'),
        h('label', { class: 'it-f' }, h('span', {}, 'Project URL'), h('input', { type: 'url', value: st.supabaseUrl || '', placeholder: 'https://xxxx.supabase.co', autocapitalize: 'off', onchange: (e) => set('supabaseUrl', e.target.value) })),
        h('label', { class: 'it-f' }, h('span', {}, 'Anon public key'), h('input', { type: 'text', value: st.supabaseKey || '', placeholder: 'eyJhbGciOi…', autocapitalize: 'off', onchange: (e) => set('supabaseKey', e.target.value) })),
        /service_role/.test(atobSafe(String(st.supabaseKey || '').split('.')[1])) && ok(false, 'That is the service_role key: never put it in an app. Use the anon public key.'),
        url && key && h('div', { class: 'btns' }, h('button', { class: 'btn primary', disabled: busy === 'check', onclick: test }, icon('check'), busy === 'check' ? 'Checking…' : 'Check connection')),
        check && ok(check.ok, check.text)),
      url && key && step(2, 'Your tables',
        h('p', { class: 'desc' }, 'Use a table you already have: its columns become the collection\'s fields, and Data Lists, Forms, Feeds and the rest read and write it.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn', disabled: busy === 'tables', onclick: loadTables }, icon('download'), busy === 'tables' ? 'Loading…' : T ? 'Reload tables' : 'Show my tables')),
        tables?._error && ok(false, 'Could not read the tables: ' + tables._error),
        T && (Object.keys(T).length ? h('div', { class: 'it-list' }, Object.entries(T).map(([tb, cl]) => { const used = cs.find((c) => c.online && tName(c) === tb);
          return h('div', { class: 'it-row sb-table' }, h('span', { class: 'it-ic', style: '--r:#3ecf8e' }, '🗄️'), h('span', { class: 'it-t' }, h('b', {}, tb), h('small', {}, cl.map((q) => q.col).join(', '))),
            used ? h('span', { class: 'sb-used' }, '✓ ' + used.name) : h('button', { class: 'btn', onclick: () => { const c = addTableCollection(tb, cl); X.toast(`Added the collection “${c.name}” (Game Settings › Data)`); draw(); } }, icon('plus'), 'Use in app')); }))
          : h('p', { class: 'desc' }, 'No tables the anon key can read yet. Make one in Supabase › Table Editor (and add a row level security rule that lets people read it).'))),
      url && key && step(3, 'Online collections',
        !pocketCols.length && !ownCols.length && !(st.profiles && st.profiles !== 'off') && h('p', { class: 'desc' }, 'None yet. Use a table above, or open a collection in Game Settings › Data and pick “Store online”.'),
        st.profiles && st.profiles !== 'off' && h('div', { class: 'sb-col' }, h('b', {}, 'Profiles'), ` · ${st.profiles} · table “${st.profilesTable || 'profiles'}” `, !T ? '' : T[st.profilesTable || 'profiles'] ? h('span', { class: 'sb-ok' }, '✓ found') : h('span', { class: 'sb-bad' }, '✗ not made yet')),
        ...[...pocketCols, ...ownCols].map((c) => { const has = T ? !!T[tName(c)] : null; return h('div', { class: 'sb-col' }, h('b', {}, c.name), ` · ${c.online === 'my own table' ? 'your table' : c.online}${c.live ? ' · live' : ''} · table “${tName(c)}” `, has == null ? '' : has ? h('span', { class: 'sb-ok' }, '✓ found') : h('span', { class: 'sb-bad' }, '✗ not made yet')); }),
        (pocketCols.length || ownCols.some((c) => c.live) || (st.profiles && st.profiles !== 'off')) && h('p', { class: 'desc' }, 'Pocket\'s own online tables need setting up once: copy the SQL, paste it in Supabase › SQL Editor and press Run.'),
        (pocketCols.length || ownCols.some((c) => c.live) || (st.profiles && st.profiles !== 'off')) && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { const sql = [...pocketCols, ...ownCols.filter((c) => c.live)].map(supabaseSQL).join('\n') + (st.profiles && st.profiles !== 'off' ? '\n' + profilesSQL(st) : ''); navigator.clipboard?.writeText(sql).then(() => X.toast('Setup SQL copied: paste it in Supabase › SQL Editor and Run'), () => X.openDialog('Setup SQL', [h('textarea', { class: 'code', rows: 16, readonly: true, style: 'width:100%' }, sql)])); } }, icon('copy'), 'Copy setup SQL'))),
      url && key && step(4, 'Sign-in',
        h('p', { class: 'desc' }, pocketCols.length ? 'Private and shared collections need people to sign in. Add a Sign-in Page (Add › UI & Menus › App) and set Game Settings › Supabase › Sign-in page, or use the sign-in buttons and nodes.' : 'Optional: add a Sign-in Page (Add › UI & Menus › App) so people get their own accounts. Show {userName} and {signedIn} in text.')),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: () => { X.closeLayer(); X.redraw?.(); X.refresh?.(); } }, icon('check'), 'Done')));
  };
  draw(); X.openDialog('Connect Supabase', [box]);
  if (st.supabaseUrl && st.supabaseKey) test();
}
const atobSafe = (s) => { try { return atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; } };
