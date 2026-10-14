// Items & Recipes (Game Settings): the game's item list (types, icons, stacks, rarity, effects, equipment stats)
// and its crafting recipes. Pick-ups, loot, resources, the inventory UI and crafting all read these.
import { ITEM_TYPES, RARITY, EQUIP_SLOTS, parseIngredients } from '../engine/pocket.js';
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

/** A ready-made set of items for survival, crafting and RPG games. */
export const STARTER_ITEMS = [
  { name: 'Wood', icon: '🪵', type: 'material', stack: 99, rarity: 'common', desc: 'From trees' },
  { name: 'Stone', icon: '🪨', type: 'material', stack: 99, rarity: 'common', desc: 'From rocks' },
  { name: 'Stick', icon: '🥢', type: 'material', stack: 99, rarity: 'common' },
  { name: 'Iron Ore', icon: '🟤', type: 'material', stack: 50, rarity: 'uncommon', desc: 'Smelt it in a Furnace' },
  { name: 'Coal', icon: '⚫', type: 'material', stack: 50, rarity: 'common' },
  { name: 'Iron Bar', icon: '🔩', type: 'material', stack: 50, rarity: 'uncommon' },
  { name: 'Leather', icon: '🟫', type: 'material', stack: 50, rarity: 'common' },
  { name: 'Rope', icon: '🧵', type: 'material', stack: 50, rarity: 'common' },
  { name: 'Gem', icon: '💎', type: 'material', stack: 20, rarity: 'epic', value: 50 },
  { name: 'Apple', icon: '🍎', type: 'food', stack: 20, rarity: 'common', food: 20 },
  { name: 'Berries', icon: '🫐', type: 'food', stack: 30, rarity: 'common', food: 10 },
  { name: 'Meat', icon: '🥩', type: 'food', stack: 20, rarity: 'common', food: 15, desc: 'Better cooked' },
  { name: 'Cooked Meat', icon: '🍖', type: 'food', stack: 20, rarity: 'uncommon', food: 45, heal: 5 },
  { name: 'Water', icon: '💧', type: 'drink', stack: 10, rarity: 'common', drink: 30 },
  { name: 'Health Potion', icon: '🧪', type: 'potion', stack: 10, rarity: 'uncommon', heal: 25 },
  { name: 'Antidote', icon: '💊', type: 'potion', stack: 10, rarity: 'uncommon', cure: 'poison' },
  { name: 'Wooden Sword', icon: '🗡️', type: 'weapon', stack: 1, rarity: 'common', damage: 2 },
  { name: 'Iron Sword', icon: '⚔️', type: 'weapon', stack: 1, rarity: 'rare', damage: 5 },
  { name: 'Axe', icon: '🪓', type: 'tool', stack: 1, rarity: 'common', damage: 1, desc: 'Chops trees' },
  { name: 'Pickaxe', icon: '⛏️', type: 'tool', stack: 1, rarity: 'common', damage: 1, desc: 'Mines iron' },
  { name: 'Leather Armour', icon: '🦺', type: 'armor', stack: 1, rarity: 'common', slot: 'body', armor: 1 },
  { name: 'Iron Helmet', icon: '⛑️', type: 'armor', stack: 1, rarity: 'rare', slot: 'head', armor: 2 },
  { name: 'Swift Boots', icon: '👢', type: 'armor', stack: 1, rarity: 'epic', slot: 'feet', speed: 1.25 },
  { name: 'Torch', icon: '🔥', type: 'misc', stack: 20, rarity: 'common', consume: false },
  { name: 'Key', icon: '🔑', type: 'key', stack: 10, rarity: 'uncommon' },
];
export const STARTER_RECIPES = [
  { result: 'Stick', amount: 4, ingredients: 'Wood 1', category: 'Basics' },
  { result: 'Wooden Sword', amount: 1, ingredients: 'Wood 3, Stick 1', category: 'Weapons' },
  { result: 'Rope', amount: 2, ingredients: 'Leather 1', category: 'Basics' },
  { result: 'Torch', amount: 2, ingredients: 'Stick 1, Coal 1', category: 'Basics' },
  { result: 'Axe', amount: 1, ingredients: 'Wood 2, Stone 3, Stick 2', station: 'Workbench', category: 'Tools' },
  { result: 'Pickaxe', amount: 1, ingredients: 'Wood 2, Stone 3, Stick 2', station: 'Workbench', category: 'Tools' },
  { result: 'Leather Armour', amount: 1, ingredients: 'Leather 4, Rope 1', station: 'Workbench', category: 'Armour' },
  { result: 'Iron Bar', amount: 1, ingredients: 'Iron Ore 2, Coal 1', station: 'Furnace', time: 2, category: 'Smelting' },
  { result: 'Cooked Meat', amount: 1, ingredients: 'Meat 1, Coal 1', station: 'Furnace', time: 1, category: 'Food' },
  { result: 'Iron Sword', amount: 1, ingredients: 'Iron Bar 3, Stick 1', station: 'Workbench', category: 'Weapons' },
  { result: 'Iron Helmet', amount: 1, ingredients: 'Iron Bar 4', station: 'Workbench', category: 'Armour', locked: true },
  { result: 'Health Potion', amount: 1, ingredients: 'Berries 3, Water 1', category: 'Potions' },
];

let X = null; // { root(), save(), openDialog, closeLayer, toast, redraw() }
export function initItems(ctx) { X = ctx; }

const rootOf = () => X.root();
const items = () => (rootOf().items ||= []);
const recipes = () => (rootOf().recipes ||= []);
const findItem = (name) => items().find((d) => d.name.toLowerCase() === String(name || '').trim().toLowerCase());
/** Add the starter items and recipes that aren't there yet. Returns how many were added. */
export function addStarterItems(withRecipes = true) {
  let n = 0;
  for (const d of STARTER_ITEMS) if (!findItem(d.name)) { items().push({ ...d }); n++; }
  if (withRecipes) for (const r of STARTER_RECIPES) if (!recipes().some((q) => q.result.toLowerCase() === r.result.toLowerCase())) { recipes().push({ ...r }); n++; }
  return n;
}
/** Crafting presets call this: an empty game gets the starter set so the Tree, Workbench… work right away. */
export function ensureStarterItems() { if (items().length || recipes().length) return 0; const n = addStarterItems(true); if (n) setTimeout(() => X.toast('Also added starter items and recipes (Game Settings › Items)'), 1800); return n; }

const typeLabel = (t) => ITEM_TYPES[t]?.label || 'Other';
const summary = (d) => [typeLabel(d.type), +d.food ? `+${d.food} food` : '', +d.drink ? `+${d.drink} drink` : '', +d.heal ? `+${d.heal} health` : '', +d.damage ? `⚔ ${d.damage}` : '', +d.armor ? `🛡 ${d.armor}` : '', +d.speed && +d.speed !== 1 ? `👟 ×${d.speed}` : '', d.cure ? `cures ${d.cure}` : ''].filter(Boolean).join(' · ');

function field(obj, key, label, kind = 'text', opts = {}) {
  const v = obj[key];
  const set = (val) => { if (kind === 'number') { if (val === '' || !Number.isFinite(+val)) delete obj[key]; else obj[key] = +val; } else if (kind === 'bool') { if (val) obj[key] = true; else delete obj[key]; } else if (val === '' || val == null) delete obj[key]; else obj[key] = val === 'true' ? true : val === 'false' ? false : val; X.save(); opts.after?.(); };
  let input;
  if (kind === 'select') input = h('select', { onchange: (e) => set(e.target.value) }, opts.options.map(([val, txt]) => h('option', { value: val, selected: String(v ?? opts.def ?? '') === String(val) }, txt)));
  else if (kind === 'bool') input = h('input', { type: 'checkbox', checked: !!v, onchange: (e) => set(e.target.checked) });
  else {
    input = h('input', { type: kind === 'number' ? 'number' : 'text', value: v ?? '', placeholder: opts.ph || '', step: opts.step || 'any', autocapitalize: 'off', onchange: (e) => set(e.target.value) });
    if (opts.list) { const id = 'it-dl-' + Math.random().toString(36).slice(2, 7); input.setAttribute('list', id); return h('label', { class: 'it-f' }, h('span', {}, label), input, h('datalist', { id }, opts.list.map((q) => h('option', { value: q })))); }
  }
  return h('label', { class: 'it-f' + (kind === 'bool' ? ' bool' : '') }, h('span', {}, label), input);
}

const QUICK_ICONS = ['🪵', '🪨', '🥢', '💎', '🪙', '🍎', '🍖', '🫐', '💧', '🧪', '🗡️', '⚔️', '🏹', '🪓', '⛏️', '🛡️', '⛑️', '🦺', '👢', '💍', '🔑', '📜', '🔥', '📦'];

export function openItemEditor(i) {
  const d = items()[i]; if (!d) return;
  const re = () => openItemEditor(items().indexOf(d));
  const usable = ['food', 'drink', 'potion', 'misc'].includes(d.type || 'misc');
  const wearable = ['weapon', 'armor', 'tool'].includes(d.type) || (d.slot && d.slot !== 'none');
  X.openDialog('Item', [
    h('div', { class: 'it-head' }, h('span', { class: 'it-big', style: `--r:${RARITY[d.rarity] || RARITY.common}` }, d.icon || '📦'), h('b', {}, d.name)),
    h('div', { class: 'it-grid' },
      field(d, 'name', 'Name', 'text', { after: () => { X.redraw(); re(); } }),
      field(d, 'icon', 'Icon (emoji or art:name)', 'text', { after: re }),
      field(d, 'type', 'Type', 'select', { options: Object.entries(ITEM_TYPES).map(([k, t]) => [k, `${t.icon} ${t.label}`]), def: 'misc', after: re }),
      field(d, 'rarity', 'Rarity', 'select', { options: Object.keys(RARITY).map((k) => [k, k[0].toUpperCase() + k.slice(1)]), def: 'common', after: re }),
      field(d, 'stack', 'Stacks up to (per slot)', 'number', { ph: '99' }),
      field(d, 'value', 'Value (price)', 'number', { ph: '0' })),
    h('div', { class: 'it-icons' }, QUICK_ICONS.map((q) => h('button', { class: 'it-qi', onclick: () => { d.icon = q; X.save(); re(); } }, q))),
    field(d, 'desc', 'Description', 'text', { ph: 'Shown in the inventory' }),
    usable && h('h4', { class: 'tl-h' }, icon('heart'), 'When used'),
    usable && h('div', { class: 'it-grid' },
      field(d, 'food', 'Fills hunger', 'number'), field(d, 'drink', 'Fills thirst', 'number'),
      field(d, 'heal', 'Heals health', 'number'), field(d, 'shield', 'Adds shield', 'number'),
      field(d, 'cure', 'Cures', 'select', { options: [['', 'nothing'], ['poison', 'poison'], ['burn', 'burn'], ['bleed', 'bleed'], ['slow', 'slow'], ['freeze', 'freeze'], ['everything', 'everything']] }),
      field(d, 'effect', 'Gives effect', 'select', { options: [['', 'nothing'], ['regen', 'heal over time'], ['poison', 'poison'], ['burn', 'burn'], ['slow', 'slow'], ['freeze', 'freeze']], after: re }),
      d.effect && field(d, 'effectPower', 'Effect per second', 'number', { ph: '1' }), d.effect && field(d, 'effectTime', 'Effect seconds', 'number', { ph: '5' }),
      field(d, 'consume', 'Used up', 'select', { options: [['', 'by type (food, drinks, potions)'], ['true', 'yes'], ['false', 'no (stays)']] }),
      field(d, 'message', 'Sends message', 'text', { ph: 'e.g. read map' })),
    wearable && h('h4', { class: 'tl-h' }, icon('player'), 'When equipped'),
    wearable && h('div', { class: 'it-grid' },
      field(d, 'slot', 'Slot', 'select', { options: [['', `auto (${d.type === 'armor' ? 'body' : 'hand'})`], ...EQUIP_SLOTS.map((q) => [q, q]), ['none', 'not equipped']] }),
      field(d, 'damage', 'Adds damage', 'number'), field(d, 'armor', 'Adds armour', 'number'), field(d, 'speed', 'Speed × (1 = normal)', 'number', { ph: '1', step: 0.05 })),
    h('p', { class: 'desc' }, 'Weapons add damage to the player’s Damage Dealer, armour adds to their Health armour, speed changes how fast they move.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { const c = { ...d, name: d.name + ' 2' }; items().splice(items().indexOf(d) + 1, 0, c); X.save(); X.redraw(); openItemEditor(items().indexOf(c)); } }, icon('copy'), 'Duplicate'),
      h('button', { class: 'btn', onclick: () => { if (!confirm(`Delete “${d.name}”?`)) return; items().splice(items().indexOf(d), 1); X.save(); X.closeLayer(); X.redraw(); } }, icon('trash'), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { X.closeLayer(); X.redraw(); } }, icon('check'), 'Done')),
  ]);
}

export function itemsEditor() {
  const box = h('div', { class: 'it-ed' });
  const draw = () => box.replaceChildren(
    h('p', { class: 'desc' }, 'Every item in your game: icon, type, rarity, how many fit in one slot, what using it does, and stats when equipped. Pick-ups, loot, resources, recipes and the inventory screens use these.'),
    items().length ? h('div', { class: 'it-list' }, items().map((d, i) => h('button', { class: 'it-row', onclick: () => openItemEditor(i) },
      h('span', { class: 'it-ic', style: `--r:${RARITY[d.rarity] || RARITY.common}` }, d.icon || '📦'), h('span', { class: 'it-t' }, h('b', {}, d.name), h('small', {}, summary(d))), icon('chevron'))))
      : h('p', { class: 'desc' }, 'No items yet.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { let n = 'New Item', k = 2; while (findItem(n)) n = 'New Item ' + k++; items().push({ name: n, icon: '📦', type: 'material', rarity: 'common', stack: 99 }); X.save(); draw(); openItemEditor(items().length - 1); } }, icon('plus'), 'Add item'),
      h('button', { class: 'btn', onclick: () => { const n = addStarterItems(false); X.save(); draw(); X.toast(n ? `Added ${n} starter items` : 'You have them all already'); } }, icon('download'), 'Starter items')));
  X.redraw = draw; draw();
  return box;
}

export function openRecipeEditor(i) {
  const r = recipes()[i]; if (!r) return;
  const re = () => openRecipeEditor(recipes().indexOf(r));
  const names = items().map((d) => d.name), stations = [...new Set(['Workbench', 'Furnace', 'Anvil', 'Cooking Pot', ...X.stations()])];
  const ings = parseIngredients(r.ingredients);
  const addIng = (name) => { const L = parseIngredients(r.ingredients), g = L.find((q) => q.name.toLowerCase() === name.toLowerCase()); if (g) g.n++; else L.push({ name, n: 1 }); r.ingredients = L.map((q) => `${q.name} ${q.n}${q.keep ? ' (keep)' : ''}`).join(', '); X.save(); re(); };
  X.openDialog('Recipe', [
    h('div', { class: 'it-head' }, h('span', { class: 'it-big', style: `--r:${RARITY[findItem(r.result)?.rarity] || RARITY.common}` }, findItem(r.result)?.icon || '🛠️'), h('b', {}, `${r.result}${+r.amount > 1 ? ' ×' + r.amount : ''}`)),
    h('div', { class: 'it-grid' },
      field(r, 'result', 'Makes', 'text', { list: names, after: re }), field(r, 'amount', 'How many', 'number', { ph: '1' })),
    field(r, 'ingredients', 'Needs (item amount, comma separated; “(keep)” for tools that aren’t used up)', 'text', { ph: 'Wood 3, Stick 1', after: re }),
    h('div', { class: 'it-chips' }, ings.map((g) => h('span', { class: 'it-chip' + (findItem(g.name) ? '' : ' warn'), title: findItem(g.name) ? '' : 'Not in your Items list' }, `${findItem(g.name)?.icon || '❔'} ${g.name} ×${g.n}${g.keep ? ' (keep)' : ''}`))),
    names.length && h('div', { class: 'it-icons' }, h('small', {}, 'Tap to add:'), items().map((d) => h('button', { class: 'it-qi', title: d.name, onclick: () => addIng(d.name) }, d.icon || d.name.slice(0, 2)))),
    h('div', { class: 'it-grid' },
      field(r, 'station', 'Needs station (empty = anywhere)', 'text', { list: stations, ph: 'Workbench' }),
      field(r, 'time', 'Takes (seconds)', 'number', { ph: '0' }),
      field(r, 'category', 'Category', 'text', { ph: 'Weapons' }),
      field(r, 'locked', 'Must be learned first', 'bool')),
    h('p', { class: 'desc' }, 'Stations are objects with a Crafting Station component. Learn locked recipes with the “Learn recipe” instruction (a scroll, a quest reward).'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { if (!confirm('Delete this recipe?')) return; recipes().splice(recipes().indexOf(r), 1); X.save(); X.closeLayer(); X.redrawR?.(); } }, icon('trash'), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { X.closeLayer(); X.redrawR?.(); } }, icon('check'), 'Done')),
  ]);
}

export function recipesEditor() {
  const box = h('div', { class: 'it-ed' });
  const draw = () => box.replaceChildren(
    h('p', { class: 'desc' }, 'What can be crafted, from what, and where (Workbench, Furnace). Show them in game with the Crafting UI component.'),
    recipes().length ? h('div', { class: 'it-list' }, recipes().map((r, i) => h('button', { class: 'it-row', onclick: () => openRecipeEditor(i) },
      h('span', { class: 'it-ic', style: `--r:${RARITY[findItem(r.result)?.rarity] || RARITY.common}` }, findItem(r.result)?.icon || '🛠️'),
      h('span', { class: 'it-t' }, h('b', {}, `${r.result}${+r.amount > 1 ? ' ×' + r.amount : ''}${r.locked ? ' 🔒' : ''}`),
        h('small', {}, parseIngredients(r.ingredients).map((g) => `${findItem(g.name)?.icon || ''}${g.name} ${g.n}`).join(' + ') + (r.station ? ` · @${r.station}` : '') + (+r.time ? ` · ${r.time}s` : ''))), icon('chevron'))))
      : h('p', { class: 'desc' }, 'No recipes yet.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { recipes().push({ result: items()[0]?.name || 'Item', amount: 1, ingredients: '' }); X.save(); draw(); openRecipeEditor(recipes().length - 1); } }, icon('plus'), 'Add recipe'),
      h('button', { class: 'btn', onclick: () => { const n = addStarterItems(true); X.save(); draw(); X.redraw?.(); X.toast(n ? `Added ${n} starter items and recipes` : 'You have them all already'); } }, icon('download'), 'Starter recipes')));
  X.redrawR = draw; draw();
  return box;
}

/** Inventory size and rules (stored on the first level's settings). */
export function inventorySettings() {
  const st = (rootOf().settings ||= {});
  return h('div', { class: 'it-ed' },
    h('div', { class: 'it-grid' },
      field(st, 'invSlots', 'Inventory slots (0 = unlimited)', 'number', { ph: '0', step: 1 }),
      field(st, 'invStack', 'Default stack size', 'number', { ph: '99', step: 1 })),
    h('label', { class: 'it-f bool' }, h('span', {}, 'Keep the inventory between levels'), h('input', { type: 'checkbox', checked: st.keepInventory !== false, onchange: (e) => { if (e.target.checked) delete st.keepInventory; else st.keepInventory = false; X.save(); } })),
    h('p', { class: 'desc' }, 'With slots, each stack of an item takes one slot; picking up more than fits shows “Inventory full”. Saves and auto-save keep the inventory, equipment and learned recipes.'));
}
