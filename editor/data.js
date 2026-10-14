// App Data (Game Settings): collections of records (Tasks, Notes, Expenses…), their fields and starting rows.
// Data Lists, Record Forms, Data Summaries, Triggers and nodes use them; apps save what users add on the device.
import { FIELD_TYPES, fieldKey, fieldsOf } from '../engine/pocket.js';
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
    h('label', { class: 'it-f bool' }, h('span', {}, 'Save what people add on their phone'), h('input', { type: 'checkbox', checked: c.keep !== false, onchange: (e) => { if (e.target.checked) delete c.keep; else c.keep = false; X.save(); } })),
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
