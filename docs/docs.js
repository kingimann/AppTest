// Pocket Engine documentation: hand-written guides (Markdown in docs/guide/) and a reference that is read
// straight from the engine, so it always lists every component, node, Trigger piece and API method that exists.
import * as P from '../engine/pocket.js';
import { NODE_HELP } from '../editor/nodes.js';
import { BEH_META, CAT_ORDER } from '../editor/library.js';

// ---------------------------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------------------------
export const GUIDES = [
  { sec: 'Start here', items: [
    ['getting-started', 'Getting started', 'Make and play your first game in ten minutes'],
    ['editor', 'The editor', 'Scene, Hierarchy, Inspector, Project, Scripts and Console'],
    ['concepts', 'Core concepts', 'Objects, components, tags, variables, messages, levels'],
  ] },
  { sec: 'Building games', items: [
    ['objects', 'Objects and the game file', 'Everything an object can have, and the JSON a game is saved as'],
    ['physics', 'Physics and collisions', 'Rigidbodies, colliders, layers, triggers and raycasts'],
    ['triggers', 'Triggers and state machines', 'ON → IF → DO logic without code'],
    ['visual-scripting', 'Visual scripting', 'The Node Editor: events, flow, values, functions'],
    ['ui', 'UI, screens and navigation', 'HUD, menus, pages, anchors, the safe area and themes'],
    ['gameplay', 'Gameplay systems', 'Movement, health, survival, inventory, crafting, AI, turn-based'],
    ['quests-dialogue', 'Quests and dialogue', 'NPCs, dialogue scripts with choices, quests, objectives and rewards'],
    ['apps', 'Making apps', 'App mode, pages, data collections, Data Lists and Record Forms'],
    ['camera-lighting', 'Cameras, lighting and effects', 'Virtual cameras, lights, presets, post-processing'],
    ['animation-audio', 'Animation and audio', 'Tweens, the Animator, sprite sheets, sounds and music'],
    ['saving-online', 'Saving, online and the phone', 'Save files, PlayFab, Photon, notifications, permissions'],
  ] },
  { sec: 'Code', items: [
    ['scripting', 'Scripting with JavaScript', 'Custom Script components and the Pocket helpers'],
    ['engine-api', 'Using the engine from code', 'Engine, Scene, Entity, input, audio, events, tweens'],
    ['custom-components', 'Writing your own components', 'registerBehavior: params, hooks, drawing UI'],
  ] },
  { sec: 'Ship it', items: [
    ['publishing', 'Publishing your game', 'Share a link, a web app, or the App Store and Google Play'],
    ['troubleshooting', 'Troubleshooting and FAQ', 'When something does not work the way you expect'],
  ] },
];
const REFS = [
  ['components', 'Components', 'Every component and all of its settings'],
  ['nodes', 'Visual script nodes', 'Every node: inputs, outputs and settings'],
  ['triggers', 'Trigger events, conditions, instructions', 'Every piece you can use in Triggers'],
  ['api', 'JavaScript API', 'Classes, methods and functions in engine/pocket.js'],
  ['events', 'Scene events', 'What scene.on(…) can listen for'],
  ['data', 'Built-in lists', 'Item types, eases, shapes, sounds, fonts, defaults…'],
];
const GUIDE_FLAT = GUIDES.flatMap((g) => g.items.map(([id, title, sub]) => ({ id, title, sub, sec: g.sec })));

// ---------------------------------------------------------------------------------------------
// Tiny Markdown renderer (headings, lists, code, tables, quotes, links)
// ---------------------------------------------------------------------------------------------
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const slug = (s) => String(s).toLowerCase().replace(/`/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export function inline(s) {
  const codes = [];
  s = String(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0001${codes.length - 1}\u0001`; });
  s = esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![\w*])/g, '$1<i>$2</i>');
  return s.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}
const LIST = /^(\s*)([-*]|\d+\.)\s+/;
function cells(row) {
  const out = []; let cur = '', code = false;
  for (let k = 0; k < row.length; k++) {
    const c = row[k];
    if (c === '\\' && row[k + 1] === '|') { cur += '|'; k++; continue; }
    if (c === '`') code = !code;
    if (c === '|' && !code) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.slice(1, -1).map((q) => q.trim());
}
/** Markdown → { html, heads }. `anchor(id)` builds the link for a heading. */
export function md(src, anchor = (id) => '#' + id) {
  const L = String(src).replace(/\r/g, '').split('\n'), out = [], heads = [];
  let i = 0;
  const list = (start) => {
    const first = LIST.exec(L[start]), base = first[1].length, ordered = /\d/.test(first[2]), items = [];
    let k = start;
    while (k < L.length) {
      const m = LIST.exec(L[k]);
      if (m && m[1].length === base && /\d/.test(m[2]) === ordered) { items.push({ text: L[k].slice(m[0].length), sub: [] }); k++; continue; }
      let j = k; while (j < L.length && !L[j].trim()) j++;
      if (j >= L.length) { k = j; break; }
      const ind = L[j].search(/\S/);
      if (ind > base && items.length) {
        const blk = []; while (k < L.length && (!L[k].trim() || L[k].search(/\S/) > base)) blk.push(L[k++]);
        while (blk.length && !blk[blk.length - 1].trim()) blk.pop();
        const min = Math.min(...blk.filter((x) => x.trim()).map((x) => x.search(/\S/)));
        items[items.length - 1].sub.push(blk.map((x) => x.slice(Math.min(min, x.search(/\S/) < 0 ? x.length : min))).join('\n'));
        continue;
      }
      const n = LIST.exec(L[j]);
      if (j > k && n && n[1].length === base && /\d/.test(n[2]) === ordered) { k = j; continue; }
      break;
    }
    const tag = ordered ? 'ol' : 'ul';
    return [`<${tag}>${items.map((it) => `<li>${inline(it.text)}${it.sub.map((s) => md(s, anchor).html).join('')}</li>`).join('')}</${tag}>`, k];
  };
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (/^\s*```/.test(l)) {
      const lang = l.trim().slice(3).trim(), buf = []; i++;
      while (i < L.length && !/^\s*```/.test(L[i])) buf.push(L[i++]);
      i++;
      out.push(`<pre><code class="lang-${esc(lang)}">${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) {
      const n = h[1].length, id = slug(h[2]);
      if (n === 2 || n === 3) heads.push({ n, text: h[2], id });
      out.push(`<h${n} id="${id}">${inline(h[2])}${n === 2 || n === 3 ? ` <a class="hl" href="${anchor(id)}" aria-label="Link to this section">#</a>` : ''}</h${n}>`); i++; continue;
    }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^>/.test(l)) {
      const buf = []; while (i < L.length && /^>/.test(L[i])) buf.push(L[i++].replace(/^>\s?/, ''));
      const kind = /^\*\*(tip|good to know)/i.test(buf[0]) ? 'tip' : /^\*\*(warning|careful|watch out|important)/i.test(buf[0]) ? 'warn' : '';
      out.push(`<blockquote class="${kind}">${md(buf.join('\n'), anchor).html}</blockquote>`); continue;
    }
    if (/^\|/.test(l)) {
      const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]);
      const head = cells(rows[0]), body = rows.slice(/^\|[\s|:-]+\|?\s*$/.test(rows[1] || '') ? 2 : 1).map(cells);
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (LIST.test(l)) { const [html, ni] = list(i); out.push(html); i = ni; continue; }
    const buf = [l.trim()]; i++;
    while (i < L.length && L[i].trim() && !/^(#{1,4}\s|\s*```|>|\||---)/.test(L[i]) && !LIST.test(L[i])) buf.push(L[i++].trim());
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), heads };
}

// ---------------------------------------------------------------------------------------------
// Reference data, read from the engine
// ---------------------------------------------------------------------------------------------
const show = (v) => (v === undefined ? '' : typeof v === 'string' ? (v === '' ? '""' : JSON.stringify(v)) : JSON.stringify(v));
const compCat = (t) => BEH_META[t]?.[0] || 'Other';
const catSort = (a, b) => ((CAT_ORDER.indexOf(a) + 99) % 99) - ((CAT_ORDER.indexOf(b) + 99) % 99) || a.localeCompare(b);
export const components = () => Object.entries(P.Behaviors).filter(([, d]) => d && d.label && !d.hidden).map(([type, d]) => ({ type, ...d, cat: compCat(type) }));
export const nodes = () => Object.entries(P.NODE_TYPES).filter(([, d]) => d && !d.hidden && d.cat && !d.cat.startsWith('(')).map(([type, d]) => ({ type, ...d }));
const nodeKind = (d) => (d.value ? `value (${d.value === 'bool' ? 'true / false' : d.value})` : d.exec ? 'step' : (d.outs || []).length ? 'event' : 'note');

function paramRows(params, three = true) {
  if (!params?.length) return '<p><i>No settings.</i></p>';
  let group = null, rows = '';
  for (const q of params) {
    if ((q.group || '') !== group) { group = q.group || ''; if (group) rows += `<tr><th colspan="4">${esc(group)}</th></tr>`; }
    const d2 = P.paramDefault ? P.paramDefault(q, false) : q.default, d3 = three && P.paramDefault ? P.paramDefault(q, true) : d2;
    const opts = Array.isArray(q.options) ? q.options.map((o) => (Array.isArray(o) ? `${o[0]}${o[1] && o[1] !== o[0] ? ` (${o[1]})` : ''}` : o)) : null;
    const notes = [opts && `Choices: ${opts.map((o) => `<code>${esc(o)}</code>`).join(' ')}`, q.range && `Range ${q.range[0]} – ${q.range[1]}`, q.step && `Step ${q.step}`,
      q.info && typeof q.info === 'string' && esc(q.info), q.showIf && `Shown when ${Object.entries(q.showIf).map(([k, v]) => `<code>${esc(k)}</code> is ${[].concat(v).map((x) => `<code>${esc(x)}</code>`).join(' or ')}`).join(' and ')}`,
      q.suggest && `Suggests your ${esc(q.suggest)}`].filter(Boolean);
    rows += `<tr><td><b>${esc(q.label || q.key)}</b><small><code>${esc(q.key)}</code></small></td><td>${esc(q.type || 'text')}</td><td><code>${esc(show(d2))}</code>${show(d3) !== show(d2) ? `<small>3D: <code>${esc(show(d3))}</code></small>` : ''}</td><td>${notes.join('<br>')}</td></tr>`;
  }
  return `<div class="tbl"><table class="params"><thead><tr><th>Setting</th><th>Type</th><th>Default</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Methods and functions with their doc comments, parsed from the engine's own source. */
let SRC = null;
async function source() { return (SRC ||= fetch(new URL('../engine/pocket.js', import.meta.url)).then((r) => r.text())); }
function commentAbove(lines, i) {
  const out = []; let k = i - 1;
  while (k >= 0 && /^\s*\/\//.test(lines[k])) out.unshift(lines[k--].replace(/^\s*\/\/\s?/, ''));
  if (!out.length && k >= 0 && /\*\/\s*$/.test(lines[k])) { const buf = []; while (k >= 0) { buf.unshift(lines[k]); if (/\/\*\*?/.test(lines[k])) break; k--; } out.push(buf.join(' ').replace(/\/\*\*?|\*\//g, '').replace(/\s\*\s/g, ' ').replace(/\s+/g, ' ').trim()); }
  return out.join(' ').trim();
}
export async function apiIndex() {
  const text = await source(), lines = text.split('\n'), classes = [], funcs = [], consts = [];
  for (let i = 0; i < lines.length; i++) {
    const c = /^export class (\w+)(?: extends (\w+))?/.exec(lines[i]);
    if (c) {
      const cls = { name: c[1], ext: c[2] || '', doc: commentAbove(lines, i), methods: [] };
      for (let j = i + 1; j < lines.length && !/^}/.test(lines[j]); j++) {
        const m = /^ {2}(static |get |set |async )?([A-Za-z$][\w$]*)\s*\(([^)]*)\)\s*\{/.exec(lines[j]);
        if (!m || ['if', 'for', 'while', 'switch'].includes(m[2])) continue;
        cls.methods.push({ kind: (m[1] || '').trim(), name: m[2], args: m[3].trim(), doc: commentAbove(lines, j), line: j + 1 });
      }
      classes.push(cls); continue;
    }
    const f = /^export (async )?function (\w+)\s*\(([^)]*)\)/.exec(lines[i]);
    if (f) { funcs.push({ name: f[2], args: f[3].trim(), doc: commentAbove(lines, i), line: i + 1 }); continue; }
    const k = /^export const (\w+)\s*=/.exec(lines[i]);
    if (k) consts.push({ name: k[1], doc: commentAbove(lines, i) || (lines[i].match(/\/\/\s*(.*)$/) || [])[1] || '', line: i + 1 });
  }
  return { classes, funcs, consts };
}

/** Scene events: scene.on(name, fn) — what each one passes. */
export const SCENE_EVENTS = [
  ['collide', 'a, b, contact', 'Two objects start touching (once per contact). Components also get collide(e, other, scene).'],
  ['separate', 'a, b', 'Two objects stop touching. Components also get separate(e, other, scene).'],
  ['var', 'name, value', 'A game variable changed (setVar / addVar, nodes, Triggers, UI).'],
  ['myvar', 'entity, name, value', 'An object\'s own variable (e.data) changed through nodes or Triggers.'],
  ['message', 'name, value', 'scene.send(name, value), the Send Message node or instruction, buttons…'],
  ['win', '', 'The level was won (scene.win()).'],
  ['gameover', '', 'The game ended (scene.gameOver()).'],
  ['newBest', 'best', 'A new best score was saved (settings.saveBest).'],
  ['spawned', 'entity', 'An object was spawned from a template.'],
  ['objectGone', 'entity', 'An object was removed (destroyed) — its components\' destroy() hooks have run.'],
  ['animationEnd', 'entity, clip', 'An Animator / Sprite Sheet clip played once and finished.'],
  ['state', 'entity, stateName', 'A State Machine entered a state.'],
  ['turn', '', 'Turn-based games: the player\'s turn begins again.'],
  ['page', 'variable, page, direction', 'UI navigation moved to a page (navTo, Bottom Nav, Side Menu…).'],
  ['back', 'variable, page', 'UI navigation went back.'],
  ['menu', 'message, open', 'A Side Menu opened or closed.'],
  ['uiScroll', 'delta, entity, fraction', 'A Scroll View scrolled.'],
  ['cameraLive', 'name, camera', 'A different camera became the live camera.'],
  ['pauseChanged', 'paused', 'The game was paused or resumed.'],
  ['appVisible', 'visible', 'The player left the app or came back.'],
  ['resize', 'width, height', 'The screen size changed.'],
  ['orientation', '"portrait" | "landscape"', 'The phone was turned.'],
  ['online', 'kind, info', 'Online services: "login", "error"…'],
  ['netMessage', 'name, value, actor', 'A Photon network message arrived.'],
  ['netEvent', 'code, data, actor', 'A raw Photon event arrived.'],
  ['permission', 'kind, granted', 'The player answered a permission request.'],
  ['location', 'location', 'A new GPS location (after the location permission).'],
  ['saved', 'file', 'A save file was written.'],
  ['loaded', 'entity', 'A Loading Screen finished.'],
  ['saveAll', 'file', '"Save everything now" ran (Auto Save components save).'],
  ['sceneEnd', '', 'The scene is being left (level change, restart).'],
  ['timerDone', 'timerName', 'A Start Timer node\'s countdown reached zero.'],
  ['achievement', 'name', 'An achievement was unlocked.'],
  ['runTrigger', 'name', 'Run another trigger / Run Trigger node.'],
  ['graphCall', 'name, who, from, value', 'A Custom Event was called on objects.'],
  ['damage', 'target, amount, from, type', 'Health lost health (Health, Turn Enemy).'],
  ['heal', 'target, amount', 'Health got health back.'],
  ['death', 'target', 'Health reached 0.'],
  ['shieldBreak', 'target', 'A Health shield ran out.'],
  ['status', 'target, effect', 'A status effect started (poison, burn, slow…).'],
  ['dealtDamage', 'dealer, target, amount', 'A Damage Dealer hurt something.'],
  ['attack', 'enemy, target', 'An Enemy AI attacked something without Health.'],
  ['needLow', 'entity, "hunger" | "thirst"', 'Hunger or thirst became low.'],
  ['needEmpty', 'entity, "hunger" | "thirst"', 'Hunger or thirst ran out.'],
  ['eat', 'entity, item', 'Hunger was refilled by touching food.'],
  ['drink', 'entity, item', 'Thirst was refilled by touching a drink.'],
  ['inventory', 'item, count', 'An item count changed (count is the new total).'],
  ['inventoryFull', 'item', 'An item didn\'t fit in the inventory.'],
  ['itemUsed', 'user, item', 'An item was used (eaten, drunk…).'],
  ['equip', 'user, item, slot', 'An item was equipped.'],
  ['unequip', 'user, item, slot', 'An item was taken off.'],
  ['craft', 'item, amount', 'Something was crafted.'],
  ['craftStart', 'item, amount', 'A timed recipe started.'],
  ['craftFailed', 'item', 'Crafting was refused (missing ingredients, station…).'],
  ['questStart', 'name', 'A quest was started.'],
  ['questUpdate', 'name, objectives', 'A quest objective moved on.'],
  ['questReady', 'name', 'Every objective is done and the quest waits to be handed in to its giver.'],
  ['questComplete', 'name', 'A quest was completed (rewards given).'],
  ['questFail', 'name', 'A quest failed.'],
  ['talk', 'npc, dialogue', 'The player started talking to an NPC.'],
  ['dialogueStart', 'npc, dialogue', 'A conversation opened.'],
  ['dialogueChoice', 'npc, text', 'The player picked a dialogue choice.'],
  ['dialogueEnd', 'npc, dialogue', 'A conversation closed.'],
  ['npcSays', 'npc, text', 'An NPC said something in a speech bubble.'],
  ['data', 'collection, kind, record', 'App data changed (kind: added, changed, deleted, cleared, reset).'],
  ['recordOpened', 'collection, record', 'A record was opened (a Data List row tapped, Open a record…).'],
  ['formSaved', 'collection, record', 'A Record Form saved a record.'],
  ['formDeleted', 'collection', 'A Record Form deleted the record it was editing.'],
  ['turn', '', 'Turn-based: the player\'s turn starts again.'],
  ['unitsSelected', 'units', 'The selected Squad Units changed.'],
  ['unitsOrdered', 'units, command', 'Units were sent somewhere ({ x, y }) or to attack ({ attack }).'],
  ['unitStep', 'unit, dx, dy', 'A Squad Unit stepped one tile.'],
  ['unitArrived', 'unit', 'A Squad Unit reached where it was sent.'],
  ['unitAttack', 'unit, target', 'A Squad Unit attacked.'],
  ['unitDefeated', 'unit, team', 'A Squad Unit was defeated (team: "player" or "enemy").'],
  ['recipeLearned', 'item', 'A locked recipe was learned.'],
  ['gathered', 'resource, item, amount', 'A Resource (tree, rock…) gave items.'],
  ['lootOpened', 'source, list', 'A Loot / Chest gave its loot.'],
  ['stationNear', 'station, name', 'The player came next to a Crafting Station.'],
  ['stationLeft', 'station, name', 'The player walked away from a Crafting Station.'],
  ['gridStep', 'entity, dx, dy', 'Grid Move took a step.'],
  ['gridAttack', 'attacker, target', 'A grid bump attack or Turn Enemy attack.'],
  ['dash', 'entity', 'Move dashed.'],
];

// ---------------------------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------------------------
const $ = (s) => document.querySelector(s);
const page = () => $('#page');
const cache = new Map();
async function guideText(id) { if (!cache.has(id)) cache.set(id, fetch(`guide/${id}.md`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))); return cache.get(id); }

function setNav(route) {
  const nav = $('#nav');
  if (!nav.dataset.built) {
    nav.dataset.built = '1';
    nav.innerHTML = `<a class="nav-a" href="#/">Home</a>${GUIDES.map((g) => `<div class="nav-sec">${esc(g.sec)}</div>${g.items.map(([id, t]) => `<a class="nav-a" data-r="guide/${id}" href="#/guide/${id}">${esc(t)}</a>`).join('')}`).join('')}
      <div class="nav-sec">Reference</div>${REFS.map(([id, t]) => `<a class="nav-a" data-r="ref/${id}" href="#/ref/${id}">${esc(t)}</a>`).join('')}`;
  }
  for (const a of nav.querySelectorAll('.nav-a')) a.classList.toggle('on', !!a.dataset.r && route.startsWith(a.dataset.r) || (!a.dataset.r && route === ''));
}

function homePage() {
  document.title = 'Pocket Engine Docs';
  const comps = components().length, ns = nodes().length, tr = [P.LOGIC_EVENTS, P.LOGIC_CONDITIONS, P.LOGIC_ACTIONS].reduce((a, t) => a + Object.values(t).filter((d) => !d.hidden).length, 0);
  return `<h1>Pocket Engine documentation</h1>
  <p class="lead">Pocket Engine is a 2D and 3D game engine for phones, with an editor you use on your phone. These pages explain how everything works, from your first game to writing your own components in JavaScript.</p>
  <p class="crumb">Engine ${esc(P.VERSION || '')} · ${comps} components · ${ns} visual-script nodes · ${tr} Trigger pieces</p>
  ${GUIDES.map((g) => `<h2>${esc(g.sec)}</h2><div class="cards">${g.items.map(([id, t, s]) => `<a class="card" href="#/guide/${id}"><b>${esc(t)}</b><span>${esc(s)}</span></a>`).join('')}</div>`).join('')}
  <h2>Reference</h2><p>Generated from the engine itself, so it always matches the version you are running.</p>
  <div class="cards">${REFS.map(([id, t, s]) => `<a class="card" href="#/ref/${id}"><b>${esc(t)}</b><span>${esc(s)}</span></a>`).join('')}</div>`;
}

async function guidePage(id, anchorId) {
  const i = GUIDE_FLAT.findIndex((g) => g.id === id); if (i < 0) return notFound();
  const g = GUIDE_FLAT[i];
  let text; try { text = await guideText(id); } catch { return `<h1>${esc(g.title)}</h1><p>This page couldn't be loaded. Check your connection and try again.</p>`; }
  const { html, heads } = md(text, (h) => `#/guide/${id}/${h}`);
  document.title = `${g.title} · Pocket Engine Docs`;
  const toc = heads.filter((h) => h.n === 2);
  const prev = GUIDE_FLAT[i - 1], next = GUIDE_FLAT[i + 1];
  return { html: `<p class="crumb">${esc(g.sec)}</p>${html.replace(/(<\/h1>)/, `$1${toc.length > 2 ? `<div class="toc"><b>On this page</b>${toc.map((h) => `<a href="#/guide/${id}/${h.id}">${inline(h.text)}</a>`).join('')}</div>` : ''}`)}
    <div class="pager">${prev ? `<a href="#/guide/${prev.id}"><small>‹ Previous</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="#/guide/${next.id}"><small>Next ›</small>${esc(next.title)}</a>` : `<a class="next" href="#/ref/components"><small>Next ›</small>Reference</a>`}</div>`, anchor: anchorId };
}

function componentsPage() {
  document.title = 'Components · Pocket Engine Docs';
  const by = new Map(); for (const c of components()) { if (!by.has(c.cat)) by.set(c.cat, []); by.get(c.cat).push(c); }
  const cats = [...by.keys()].sort(catSort);
  return `<p class="crumb">Reference</p><h1>Components</h1>
  <p class="lead">${components().length} components. Add them in the Inspector with <b>Add Component</b>; in a game file they are <code>behaviors: [{ type, …settings }]</code> on an object.</p>
  <input class="filter" placeholder="Filter components" oninput="for (const a of document.querySelectorAll('.ref-list a')) a.hidden = !a.textContent.toLowerCase().includes(this.value.toLowerCase())">
  <div class="toc"><b>Folders</b>${cats.map((c) => `<a href="#/ref/components/${slug(c)}">${esc(c)}</a>`).join('')}</div>
  ${cats.map((c) => `<h2 id="${slug(c)}">${esc(c)}</h2><div class="ref-list">${by.get(c).sort((a, b) => a.label.localeCompare(b.label)).map((d) => `<a href="#/ref/component/${d.type}">${esc(d.label)} <span class="chip k">${esc(d.type)}</span><small>${esc(d.description || '')}</small></a>`).join('')}</div>`).join('')}`;
}
function componentPage(type) {
  const d = P.Behaviors[type]; if (!d) return notFound();
  document.title = `${d.label} · Components · Pocket Engine Docs`;
  const ex = { type }; for (const q of (d.params || []).slice(0, 4)) ex[q.key] = P.paramDefault(q, false);
  return `<p class="crumb"><a href="#/ref/components">Components</a> › ${esc(compCat(type))}</p><h1>${esc(d.label)}</h1>
  <p><span class="chip k">type: ${esc(type)}</span><span class="chip">${esc(compCat(type))}</span>${d.passthrough ? `<span class="chip">also keeps: ${d.passthrough.map(esc).join(', ')}</span>` : ''}</p>
  <p class="lead">${esc(d.description || '')}</p>
  <h2 id="add">Adding it</h2><p>Select an object, then <b>Inspector › Add Component › ${esc(compCat(type))} › ${esc(d.label)}</b>. In a game file or from code:</p>
  <pre><code>${esc(`{ name: 'My Object', …, behaviors: [${JSON.stringify(ex).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')}] }`)}</code></pre>
  <p>Settings you leave out use their default. Numbers that differ in 3D games show both defaults.</p>
  <h2 id="settings">Settings</h2>${paramRows(d.params)}`;
}

function nodesPage() {
  document.title = 'Nodes · Pocket Engine Docs';
  const by = new Map(); for (const n of nodes()) { if (!by.has(n.cat)) by.set(n.cat, []); by.get(n.cat).push(n); }
  const cats = [...by.keys()].sort((a, b) => (a === 'Events' ? -1 : b === 'Events' ? 1 : a.localeCompare(b)));
  return `<p class="crumb">Reference</p><h1>Visual script nodes</h1>
  <p class="lead">${nodes().length} nodes in ${cats.length} folders. <b>Events</b> start a chain, <b>steps</b> do something and pass the white "exec" wire on, <b>values</b> feed numbers, text or true/false into inputs. See <a href="#/guide/visual-scripting">Visual scripting</a>.</p>
  <input class="filter" placeholder="Filter nodes" oninput="for (const a of document.querySelectorAll('.ref-list a')) a.hidden = !a.textContent.toLowerCase().includes(this.value.toLowerCase())">
  <div class="toc"><b>Folders</b>${cats.map((c) => `<a href="#/ref/nodes/${slug(c)}">${esc(c)} (${by.get(c).length})</a>`).join('')}</div>
  ${cats.map((c) => `<h2 id="${slug(c)}">${esc(c)}</h2><div class="ref-list">${by.get(c).sort((a, b) => a.label.localeCompare(b.label)).map((d) => `<a href="#/ref/node/${d.type}">${esc(d.label)} <span class="chip">${esc(nodeKind(d))}</span><small>${esc(NODE_HELP[d.type] || '')}</small></a>`).join('')}</div>`).join('')}`;
}
function nodePage(type) {
  const d = P.NODE_TYPES[type]; if (!d) return notFound();
  document.title = `${d.label} · Nodes · Pocket Engine Docs`;
  const ins = (d.inputs || []), outs = d.outs || [];
  const logicKey = type.replace(/^l[ace]_/, ''), table = type.startsWith('la_') ? 'instruction' : type.startsWith('lc_') ? 'condition' : type.startsWith('le_') ? 'event' : '';
  return `<p class="crumb"><a href="#/ref/nodes">Nodes</a> › ${esc(d.cat)}</p><h1>${esc(d.label)}</h1>
  <p><span class="chip k">type: ${esc(type)}</span><span class="chip">${esc(nodeKind(d))}</span><span class="chip">${esc(d.cat)}</span></p>
  ${NODE_HELP[type] ? `<p class="lead">${esc(NODE_HELP[type])}</p>` : ''}
  ${table ? `<p>This node is the Triggers ${table} <a href="#/ref/triggers/${table}-${logicKey}">${esc(d.label.replace(/^When: /, ''))}</a>, so it behaves exactly the same in both.</p>` : ''}
  <h2 id="ports">Wires</h2><ul>
  ${d.exec ? '<li><span class="port kind-exec">◆ in</span>: runs when the wire before it fires.</li>' : ''}
  ${outs.map((o) => `<li><span class="port kind-exec">◆ ${esc(o)}</span>: ${o === 'then' ? 'carries on after this node' : `fires when it is "${esc(o)}"`}.</li>`).join('')}
  ${d.value ? `<li><span class="port kind-${esc(d.value)}">● out</span>: gives a ${d.value === 'bool' ? 'true / false' : esc(d.value)} value to whatever it is wired into.</li>` : ''}
  ${ins.map((q) => `<li><span class="port kind-${esc(q.type || 'number')}">● ${esc(q.key)}</span> (${esc(q.type || 'number')}, default <code>${esc(show(q.default))}</code>): wire a value in, or type one on the node.</li>`).join('')}
  </ul>
  <h2 id="settings">Settings on the node</h2>${paramRows(d.params, false)}
  <h2 id="json">In a saved script</h2><pre><code>${esc(`{ id: 'n1', type: '${type}', x: 0, y: 0, params: { ${[...(d.params || []), ...ins].slice(0, 3).map((q) => `${q.key}: ${show(q.default)}`).join(', ')} } }`)}</code></pre>`;
}

function triggersPage() {
  document.title = 'Trigger pieces · Pocket Engine Docs';
  const sec = (title, key, table, prefix, extra) => {
    const list = Object.entries(table).filter(([, d]) => !d.hidden).sort((a, b) => (a[1].cat || '').localeCompare(b[1].cat || '') || a[1].label.localeCompare(b[1].label));
    let cat = null;
    return `<h2 id="${key}">${title} (${list.length})</h2>${extra}${list.map(([k, d]) => {
      const head = d.cat && d.cat !== cat ? `<h3>${esc((cat = d.cat))}</h3>` : '';
      return `${head}<div class="api-m" id="${prefix}-${k}"><code class="sig">${esc(d.label)}  ·  ${esc(k)}</code>${(d.params || []).length ? `<p>${d.params.map((q) => `<span class="chip"><b>${esc(q.label || q.key)}</b> <code>${esc(q.key)}</code> = ${esc(show(q.default))}${Array.isArray(q.options) ? ` · ${q.options.map((o) => (Array.isArray(o) ? o[0] : o)).map(esc).join(' / ')}` : ''}</span>`).join('')}</p>` : ''}${d.fsm ? '<p>Only in State Machines.</p>' : ''}${P.NODE_TYPES[(prefix === 'event' ? 'le_' : prefix === 'condition' ? 'lc_' : 'la_') + k] ? `<p>Also a node: <a href="#/ref/node/${(prefix === 'event' ? 'le_' : prefix === 'condition' ? 'lc_' : 'la_') + k}">${esc(P.NODE_TYPES[(prefix === 'event' ? 'le_' : prefix === 'condition' ? 'lc_' : 'la_') + k].label)}</a></p>` : ''}</div>`;
    }).join('')}`;
  };
  return `<p class="crumb">Reference</p><h1>Trigger events, conditions and instructions</h1>
  <p class="lead">Everything you can pick in a Triggers card or a State Machine. Each one is also a visual-script node. Saved as <code>{ type: 'key', …settings }</code>. See <a href="#/guide/triggers">Triggers and state machines</a>.</p>
  <div class="toc"><b>Sections</b><a href="#/ref/triggers/events">Events</a><a href="#/ref/triggers/conditions">Conditions</a><a href="#/ref/triggers/instructions">Instructions</a></div>
  ${sec('Events', 'events', P.LOGIC_EVENTS, 'event', '<p>ON: what starts a trigger.</p>')}
  ${sec('Conditions', 'conditions', P.LOGIC_CONDITIONS, 'condition', '<p>IF: all (or any) must be true. Every condition can be flipped with NOT (<code>not: true</code>).</p>')}
  ${sec('Instructions', 'instructions', P.LOGIC_ACTIONS, 'instruction', '<p>DO: run top to bottom. Some wait (Wait, Move… with "wait until done").</p>')}`;
}

async function apiPage(cls) {
  const A = await apiIndex();
  if (cls) {
    const c = A.classes.find((q) => q.name === cls); if (!c) return notFound();
    document.title = `${c.name} · API · Pocket Engine Docs`;
    return `<p class="crumb"><a href="#/ref/api">JavaScript API</a></p><h1>${esc(c.name)}${c.ext ? ` <small class="chip">extends ${esc(c.ext)}</small>` : ''}</h1>
    ${c.doc ? `<p class="lead">${inline(c.doc)}</p>` : ''}<p>${c.methods.length} methods, in the order they appear in <code>engine/pocket.js</code>.</p>
    <input class="filter" placeholder="Filter methods" oninput="for (const a of document.querySelectorAll('.api-m')) a.hidden = !a.textContent.toLowerCase().includes(this.value.toLowerCase())">
    ${c.methods.map((m) => `<div class="api-m" id="${slug(m.name)}"><code class="sig">${m.kind ? esc(m.kind) + ' ' : ''}${esc(m.name === 'constructor' ? `new ${c.name}` : m.name)}(${esc(m.args)})</code>${m.doc ? `<p>${inline(m.doc)}</p>` : ''}</div>`).join('')}`;
  }
  document.title = 'JavaScript API · Pocket Engine Docs';
  const key = ['Engine', 'Scene', 'Entity', 'Input', 'Audio', 'Physics', 'Tween', 'Sequence', 'SaveFiles', 'Online'];
  const cs = [...A.classes].sort((a, b) => ((key.indexOf(a.name) + 99) % 99) - ((key.indexOf(b.name) + 99) % 99));
  return `<p class="crumb">Reference</p><h1>JavaScript API</h1>
  <p class="lead">Everything <code>engine/pocket.js</code> exports, read from the source with its comments. Start with <a href="#/guide/engine-api">Using the engine from code</a>.</p>
  <pre><code>import { Engine, Scene, registerBehavior } from './engine/pocket.js';</code></pre>
  <h2 id="classes">Classes</h2><div class="ref-list">${cs.map((c) => `<a href="#/ref/api/${c.name}">${esc(c.name)} <span class="chip">${c.methods.length} methods</span><small>${esc(c.doc.slice(0, 160))}</small></a>`).join('')}</div>
  <h2 id="functions">Functions</h2>${A.funcs.map((f) => `<div class="api-m" id="${slug(f.name)}"><code class="sig">${esc(f.name)}(${esc(f.args)})</code>${f.doc ? `<p>${inline(f.doc)}</p>` : ''}</div>`).join('')}
  <h2 id="constants">Constants and tables</h2><div class="ref-list">${A.consts.map((k) => `<a href="#/ref/data/${slug(k.name)}">${esc(k.name)}<small>${esc(k.doc.slice(0, 160))}</small></a>`).join('')}</div>`;
}

function eventsPage() {
  document.title = 'Scene events · Pocket Engine Docs';
  return `<p class="crumb">Reference</p><h1>Scene events</h1>
  <p class="lead">Listen with <code>scene.on(name, (…args) =&gt; { … })</code> in a Custom Script's <code>start()</code>, or in your own component. Send your own with <code>scene.emit(name, …args)</code>; game-wide messages go through <code>scene.send(name, value)</code> and arrive as <code>message</code>.</p>
  <pre><code>function start(e, scene) {
  scene.on('damage', (target, amount, from, type) =&gt; {
    if (target === e) P.log('ouch', amount, type);
  });
}</code></pre>
  <div class="tbl"><table><thead><tr><th>Event</th><th>Arguments</th><th>When</th></tr></thead><tbody>${SCENE_EVENTS.map(([n, a, w]) => `<tr id="${n}"><td><code>${esc(n)}</code></td><td><code>${esc(a || '—')}</code></td><td>${esc(w)}</td></tr>`).join('')}</tbody></table></div>`;
}

function dataPage() {
  document.title = 'Built-in lists · Pocket Engine Docs';
  const T = (name, about, rows, cols) => `<h2 id="${slug(name)}"><code>${esc(name)}</code></h2><p>${about}</p><div class="tbl"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const kv = (o) => Object.entries(o).map(([k, v]) => [`<code>${esc(k)}</code>`, `<code>${esc(typeof v === 'object' ? JSON.stringify(v) : show(v))}</code>`]);
  const chips = (list) => `<p>${list.map((x) => `<span class="chip k">${esc(x)}</span>`).join('')}</p>`;
  return `<p class="crumb">Reference</p><h1>Built-in lists</h1><p class="lead">Tables the engine uses, straight from <code>engine/pocket.js</code>.</p>
  <div class="toc"><b>On this page</b>${['ITEM_TYPES', 'RARITY', 'EQUIP_SLOTS', 'STATUS_FX', 'EASES', 'GEOMETRIES', 'LIGHT_PRESETS', 'SOUNDS', 'FONTS', 'UI_THEMES', 'TWEEN_EFFECTS', 'PHYSICS_LAYERS', 'TILE_KINDS', 'VOXEL_NAMES', 'SHAPE_DEFAULTS', 'TEXT_DEFAULTS', 'BODY_DEFAULTS'].filter((k) => P[k]).map((k) => `<a href="#/ref/data/${slug(k)}">${k}</a>`).join('')}</div>
  ${T('ITEM_TYPES', 'Item types for Game Settings › Items. Food, drinks, potions and “other” are used up when used; weapons, armour and tools are equipped.', Object.entries(P.ITEM_TYPES).map(([k, v]) => [`<code>${k}</code>`, `${v.icon} ${esc(v.label)}`]), ['Key', 'Shown as'])}
  ${T('RARITY', 'Rarities and the colour of their slot frame.', Object.entries(P.RARITY).map(([k, v]) => [`<code>${k}</code>`, `<span style="color:${v}">■</span> <code>${v}</code>`]), ['Rarity', 'Colour'])}
  <h2 id="equip-slots"><code>EQUIP_SLOTS</code></h2>${chips(P.EQUIP_SLOTS)}
  ${T('STATUS_FX', 'Status effects that Health understands (Damage Dealer, items, nodes and Triggers give them).', Object.entries(P.STATUS_FX).map(([k, v]) => [`<code>${k}</code>`, esc(v.label), v.heal ? 'heals over time' : v.speed != null ? `movement × ${v.speed}` : `damage over time (type <code>${esc(v.type)}</code>)`]), ['Key', 'Name', 'Does'])}
  <h2 id="eases"><code>EASES</code></h2><p>Easing curves for tweens and animation keys.</p>${chips(P.EASES || Object.keys(P.Ease || {}))}
  <h2 id="geometries"><code>GEOMETRIES</code></h2><p>3D mesh shapes (<code>mesh: { geometry }</code>).</p>${chips(P.GEOMETRIES)}
  ${T('LIGHT_PRESETS', 'One-tap lighting moods (Game Settings › Lighting Presets, Lighting Preset node). 2D sets brightness and colour; 3D sets the sun, ambient, sky, ground and background.', Object.entries(P.LIGHT_PRESETS).map(([k, v]) => [esc(k), `brightness ${v.d2[0]} · <code>${v.d2[1]}</code>`, `<code>${esc(JSON.stringify(v.d3))}</code>`]), ['Preset', '2D', '3D'])}
  ${P.SOUNDS ? `<h2 id="sounds"><code>SOUNDS</code></h2><p>Built-in sound effects (<code>engine.audio.sfx(name)</code>); your imported sounds work by name too.</p>${chips(Array.isArray(P.SOUNDS) ? P.SOUNDS.map((s) => (Array.isArray(s) ? s[0] : s.key || s.name || s)) : Object.keys(P.SOUNDS))}` : ''}
  ${P.FONTS ? `<h2 id="fonts"><code>FONTS</code></h2><p>Built-in fonts; any Google Font works too.</p>${chips(Array.isArray(P.FONTS) ? P.FONTS.map((f) => (Array.isArray(f) ? f[0] : f.name || f.key || f)) : Object.keys(P.FONTS))}` : ''}
  ${P.UI_THEMES ? `<h2 id="ui-themes"><code>UI_THEMES</code></h2>${chips(Object.keys(P.UI_THEMES))}` : ''}
  ${P.TWEEN_EFFECTS ? `<h2 id="tween-effects"><code>TWEEN_EFFECTS</code></h2><p>Effects the Tween component and Tween Sequence steps can play.</p>${chips(Array.isArray(P.TWEEN_EFFECTS) ? P.TWEEN_EFFECTS.map((t) => (Array.isArray(t) ? t[0] : t)) : Object.keys(P.TWEEN_EFFECTS))}` : ''}
  <h2 id="physics-layers"><code>PHYSICS_LAYERS</code></h2><p>The eight collision layers (renamable in Tags &amp; Layers).</p>${chips(P.PHYSICS_LAYERS)}
  ${P.TILE_KINDS ? `<h2 id="tile-kinds"><code>TILE_KINDS</code></h2>${chips(Array.isArray(P.TILE_KINDS) ? P.TILE_KINDS.map((t) => (Array.isArray(t) ? t[0] : t)) : Object.keys(P.TILE_KINDS))}` : ''}
  ${P.VOXEL_NAMES ? `<h2 id="voxel-names"><code>VOXEL_NAMES</code></h2><p>Voxel block ids, in order (0 = air).</p>${chips(P.VOXEL_NAMES)}` : ''}
  ${T('SHAPE_DEFAULTS', 'Defaults for <code>shape: { … }</code> (2D).', kv(P.SHAPE_DEFAULTS), ['Field', 'Default'])}
  ${T('TEXT_DEFAULTS', 'Defaults for <code>text: { … }</code>.', kv(P.TEXT_DEFAULTS), ['Field', 'Default'])}
  ${T('SPRITE_DEFAULTS', 'Defaults for <code>sprite: { … }</code>.', kv(P.SPRITE_DEFAULTS), ['Field', 'Default'])}
  ${T('MESH_DEFAULTS', 'Defaults for <code>mesh: { … }</code> (3D).', kv(P.MESH_DEFAULTS), ['Field', 'Default'])}
  ${T('BAR_DEFAULTS', 'Defaults for <code>bar: { … }</code> (progress bars).', kv(P.BAR_DEFAULTS), ['Field', 'Default'])}
  ${T('LIGHT_DEFAULTS', 'Defaults for <code>light: { … }</code>.', kv(P.LIGHT_DEFAULTS), ['Field', 'Default'])}
  ${T('BODY_DEFAULTS', 'Defaults for <code>body: { … }</code> (rigidbodies).', kv(P.BODY_DEFAULTS), ['Field', 'Default'])}`;
}

function notFound() { document.title = 'Not found · Pocket Engine Docs'; return `<h1>Page not found</h1><p>That page doesn't exist (any more). Try the search box, or go <a href="#/">home</a>.</p>`; }

// ---------------------------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------------------------
let INDEX = null;
async function buildIndex() {
  if (INDEX) return INDEX;
  const out = [];
  await Promise.all(GUIDE_FLAT.map(async (g) => {
    let text = ''; try { text = await guideText(g.id); } catch { /* offline and never opened */ }
    out.push({ kind: 'Guide', title: g.title, sub: g.sub, href: `#/guide/${g.id}`, text: (g.title + ' ' + g.sub + ' ' + text).toLowerCase(), w: 3 });
    let cur = null;
    for (const line of text.split('\n')) {
      const h = /^(#{2,3})\s+(.*)$/.exec(line);
      if (h) { cur = { kind: 'Section', title: h[2].replace(/`/g, ''), sub: g.title, href: `#/guide/${g.id}/${slug(h[2])}`, text: h[2].toLowerCase(), w: 2 }; out.push(cur); }
      else if (cur && line.trim()) cur.text += ' ' + line.toLowerCase();
    }
  }));
  for (const c of components()) out.push({ kind: 'Component', title: c.label, sub: c.description || '', href: `#/ref/component/${c.type}`, text: `${c.label} ${c.type} ${c.description || ''} ${(c.params || []).map((q) => q.label + ' ' + q.key).join(' ')}`.toLowerCase(), w: 2.5 });
  for (const n of nodes()) out.push({ kind: 'Node', title: n.label, sub: NODE_HELP[n.type] || n.cat, href: `#/ref/node/${n.type}`, text: `${n.label} ${n.type} ${n.cat} ${NODE_HELP[n.type] || ''}`.toLowerCase(), w: 2 });
  for (const [pre, t, kind] of [['event', P.LOGIC_EVENTS, 'Trigger event'], ['condition', P.LOGIC_CONDITIONS, 'Condition'], ['instruction', P.LOGIC_ACTIONS, 'Instruction']]) for (const [k, d] of Object.entries(t)) if (!d.hidden) out.push({ kind, title: d.label, sub: k, href: `#/ref/triggers/${pre}-${k}`, text: `${d.label} ${k}`.toLowerCase(), w: 2 });
  try { const A = await apiIndex(); for (const c of A.classes) { out.push({ kind: 'Class', title: c.name, sub: c.doc, href: `#/ref/api/${c.name}`, text: `${c.name} ${c.doc}`.toLowerCase(), w: 2.5 }); for (const m of c.methods) out.push({ kind: 'Method', title: `${c.name}.${m.name}(${m.args})`, sub: m.doc, href: `#/ref/api/${c.name}/${slug(m.name)}`, text: `${c.name} ${m.name} ${m.doc}`.toLowerCase(), w: 1.5 }); } for (const f of A.funcs) out.push({ kind: 'Function', title: `${f.name}(${f.args})`, sub: f.doc, href: `#/ref/api/functions`, text: `${f.name} ${f.doc}`.toLowerCase(), w: 1.5 }); } catch { /* source not reachable */ }
  for (const [n, a, w] of SCENE_EVENTS) out.push({ kind: 'Scene event', title: n, sub: w, href: `#/ref/events/${n}`, text: `${n} ${a} ${w} event`.toLowerCase(), w: 1.5 });
  return (INDEX = out);
}
function score(e, words) {
  let s = 0; const t = e.title.toLowerCase();
  for (const w of words) { if (!e.text.includes(w)) return 0; s += t === w ? 12 : t.startsWith(w) ? 8 : t.includes(w) ? 5 : 1; }
  return s * e.w;
}
const mark = (s, words) => { let h = esc(s); for (const w of words) if (w.length > 1) h = h.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => `<mark>${m}</mark>`); return h; };
async function search(q) {
  const box = $('#results'), words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) { box.hidden = true; return; }
  box.hidden = false; const idx = await buildIndex();
  const hits = idx.map((e) => [score(e, words), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, 60);
  box.innerHTML = hits.length ? hits.map(([, e]) => `<a class="r" href="${e.href}"><i>${esc(e.kind)}</i>${mark(e.title, words)}<small>${mark(String(e.sub || '').slice(0, 180), words)}</small></a>`).join('') : `<p class="none">Nothing found for “${esc(q)}”.</p>`;
}

// ---------------------------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------------------------
async function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, '')), parts = raw.split('/');
  setNav(raw); document.body.classList.remove('nav-open'); $('#results').hidden = true;
  let res, anchor = null;
  try {
    if (!raw) res = homePage();
    else if (parts[0] === 'guide') { res = await guidePage(parts[1], parts[2]); }
    else if (parts[0] === 'ref') {
      const [, kind, a, b] = parts;
      if (kind === 'components') { res = componentsPage(); anchor = a; }
      else if (kind === 'component') res = componentPage(a);
      else if (kind === 'nodes') { res = nodesPage(); anchor = a; }
      else if (kind === 'node') res = nodePage(a);
      else if (kind === 'triggers') { res = triggersPage(); anchor = a; }
      else if (kind === 'api') { res = await apiPage(a === 'functions' ? null : a); anchor = a === 'functions' ? 'functions' : b; }
      else if (kind === 'events') { res = eventsPage(); anchor = a; }
      else if (kind === 'data') { res = dataPage(); anchor = a; }
      else res = notFound();
    } else res = notFound();
  } catch (err) { res = `<h1>Something went wrong</h1><pre><code>${esc(err.stack || err)}</code></pre>`; }
  if (res && typeof res === 'object') { anchor = res.anchor || anchor; res = res.html; }
  const el = page(); el.innerHTML = res;
  for (const pre of el.querySelectorAll('pre')) { const b = document.createElement('button'); b.className = 'copy'; b.textContent = 'Copy'; b.onclick = () => { navigator.clipboard?.writeText(pre.querySelector('code')?.textContent || '').then(() => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1200); }).catch(() => {}); }; pre.append(b); }
  const target = anchor && document.getElementById(anchor);
  if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
}

if (typeof window !== 'undefined' && document.getElementById('page')) {
  addEventListener('hashchange', route);
  $('#navBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#page').addEventListener('click', () => document.body.classList.remove('nav-open'));
  let t = null; $('#q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => search(e.target.value.trim()), 120); });
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; search(''); } if (e.key === 'Enter') $('#results a')?.click(); });
  $('#results').addEventListener('click', (e) => { if (e.target.closest('a')) { $('#q').value = ''; $('#results').hidden = true; } });
  route();
}
