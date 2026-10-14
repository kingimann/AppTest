// Quests & Dialogues (Game Settings): the game's quest list (objectives, rewards, giver, chains) and its
// dialogue scripts, with a live check and a preview player. NPCs, Triggers and nodes read these.
import { parseDialogue, parseObjectives, parseRewards, DialogueRunner } from '../engine/pocket.js';
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

/** A small village story: two chained quests from the Elder, an exploring quest, and three dialogues. */
export const STARTER_QUESTS = [
  { name: 'Firewood', icon: '🪵', giver: 'Elder', desc: 'The Elder needs wood for the winter fire.', objectives: 'collect Wood 5 (take) | Bring 5 Wood', rewards: 'coins 20, item Apple 2', turnIn: 'at giver',
    offer: 'Winter is coming and my fire is low. Could you bring me 5 Wood?', accepted: 'Thank you! The trees are east of the village.', reminder: 'Any luck with the wood?', thanks: 'Wonderful, now I can stay warm!' },
  { name: 'Slime Trouble', icon: '🟢', giver: 'Elder', requires: 'Firewood', desc: 'Slimes are eating the crops. Chase them away.', objectives: 'kill slime 3 | Defeat 3 slimes', rewards: 'coins 50, xp 25, item Health Potion 1', turnIn: 'at giver',
    offer: 'Slimes again! They are eating our crops. Will you chase off three of them?', thanks: 'The fields are safe. You are a true hero!' },
  { name: 'Explorer', icon: '🧭', autoStart: true, desc: 'Have a look around the village.', objectives: 'talk Villager | Say hello to a villager\nreach Old Well | Find the Old Well', rewards: 'gems 1' },
];
export const STARTER_DIALOGUES = [
  { name: 'Villager', portrait: '🧑‍🌾', script: [
    '? quest Slime Trouble is done -> hero',
    'Villager: Hello, {name}! Lovely day, isn’t it?',
    '* (once) Any news? -> news',
    '* [if has Apple] Here, have an apple -> apple',
    '* Bye -> END',
    '# news',
    'Villager: The Elder is looking for help. Look for the ! above her head.',
    '-> start',
    '# apple',
    '@take Apple 1',
    '@add coins 5',
    'Villager: For me? Thank you! Take these coins.',
    '# hero',
    'Villager: Our hero! Thank you for chasing off the slimes.',
  ].join('\n') },
  { name: 'Signpost', portrait: '🪧', script: 'North: the Old Well\nEast: the Dark Forest (dangerous!)\nWest: the village' },
  { name: 'Shopkeeper', portrait: '🧔', script: [
    'Shopkeeper: Welcome! What can I get you?',
    '* [if coins >= 10] Health Potion (10 coins) -> potion',
    '* [if coins < 10] I can’t afford anything -> broke',
    '* Just looking -> END',
    '# potion',
    '@add coins -10',
    '@give Health Potion 1',
    'Shopkeeper: Here you go. Come again!',
    '# broke',
    'Shopkeeper: Come back when you have 10 coins.',
  ].join('\n') },
];

let X = null; // { root(), save(), openDialog, closeLayer, toast, objects() }
export function initStory(ctx) { X = ctx; }
const rootOf = () => X.root();
const quests = () => (rootOf().quests ||= []);
const dialogues = () => (rootOf().dialogues ||= []);
const byName = (list, n) => list.find((d) => String(d.name).trim().toLowerCase() === String(n || '').trim().toLowerCase());
const uniqueName = (list, base) => { let n = base, k = 2; while (byName(list, n)) n = `${base} ${k++}`; return n; };

/** Add the starter quests and dialogues that aren't there yet. Returns how many were added. */
export function addStarterStory() {
  let n = 0;
  for (const q of STARTER_QUESTS) if (!byName(quests(), q.name)) { quests().push({ ...q }); n++; }
  for (const d of STARTER_DIALOGUES) if (!byName(dialogues(), d.name)) { dialogues().push({ ...d }); n++; }
  return n;
}
/** Story presets call this: a game with no quests or dialogues gets the starter story so the NPCs talk right away. */
export function ensureStarterStory() { if (quests().length || dialogues().length) return 0; const n = addStarterStory(); if (n) setTimeout(() => X.toast('Also added a starter story (Game Settings › Quests and Dialogues)'), 1800); return n; }

function field(obj, key, label, kind = 'text', opts = {}) {
  const v = obj[key];
  const set = (val) => { if (kind === 'bool') { if (val) obj[key] = true; else delete obj[key]; } else if (val === '' || val == null) delete obj[key]; else obj[key] = val; X.save(); opts.after?.(); };
  let input;
  if (kind === 'select') input = h('select', { onchange: (e) => set(e.target.value) }, opts.options.map(([val, txt]) => h('option', { value: val, selected: String(v ?? '') === String(val) }, txt)));
  else if (kind === 'bool') input = h('input', { type: 'checkbox', checked: !!v, onchange: (e) => set(e.target.checked) });
  else if (kind === 'area') input = h('textarea', { class: 'st-code', rows: opts.rows || 4, value: v ?? '', placeholder: opts.ph || '', spellcheck: false, autocapitalize: 'off', onchange: (e) => set(e.target.value), oninput: opts.oninput });
  else {
    input = h('input', { type: 'text', value: v ?? '', placeholder: opts.ph || '', autocapitalize: 'off', onchange: (e) => set(e.target.value) });
    if (opts.list) { const id = 'st-dl-' + Math.random().toString(36).slice(2, 7); input.setAttribute('list', id); return h('label', { class: 'it-f' }, h('span', {}, label), input, h('datalist', { id }, opts.list.map((q) => h('option', { value: q })))); }
  }
  return h('label', { class: 'it-f' + (kind === 'bool' ? ' bool' : '') + (kind === 'area' ? ' st-area' : '') }, h('span', {}, label), input);
}

// ---------------------------------------------------------------------------- quests
const OBJ_ICON = { collect: '🎒', kill: '⚔️', talk: '💬', reach: '📍', craft: '🛠️', use: '✋', gather: '🪓', message: '✉️', var: '🔢', quest: '📜', custom: '⭐' };
const rewardChip = (r) => (r.kind === 'var' ? `${r.n > 0 ? '+' : ''}${r.n} ${r.name}` : r.kind === 'item' ? `🎁 ${r.name}${r.n > 1 ? ' ×' + r.n : ''}` : r.kind === 'recipe' ? `📜 ${r.name}` : r.kind === 'quest' ? `➡️ ${r.name}` : `✉️ ${r.name}`);
const questSummary = (q) => {
  const o = parseObjectives(q.objectives), bits = [o.length ? `${o.length} objective${o.length > 1 ? 's' : ''}` : 'no objectives yet'];
  if (q.giver) bits.push(`from ${q.giver}`); if (q.requires) bits.push(`after ${q.requires}`); if (q.autoStart) bits.push('starts by itself');
  return bits.join(' · ');
};
/** Problems the editor can spot: names that don't exist in the game. */
function questWarnings(q) {
  const W = [], objs = new Set(X.objects().map((n) => n.toLowerCase())), items = new Set((rootOf().items || []).map((d) => d.name.toLowerCase()));
  if (q.giver && !objs.has(q.giver.toLowerCase())) W.push(`No object is called “${q.giver}”. Give the NPC that name, or set its NPC › Name.`);
  for (const r of String(q.requires || '').split(',').map((t) => t.trim()).filter(Boolean)) if (!byName(quests(), r)) W.push(`There is no quest called “${r}”.`);
  for (const o of parseObjectives(q.objectives)) {
    if (['collect', 'craft', 'use', 'gather'].includes(o.type) && items.size && !items.has(o.target.toLowerCase())) W.push(`“${o.target}” isn’t in Game Settings › Items (it still works by name).`);
    if (['reach', 'talk'].includes(o.type) && !objs.has(o.target.toLowerCase())) W.push(`No object is called “${o.target}”.`);
    if (o.type === 'quest' && !byName(quests(), o.target)) W.push(`There is no quest called “${o.target}”.`);
  }
  for (const r of parseRewards(q.rewards)) if (r.kind === 'quest' && !byName(quests(), r.name)) W.push(`The reward quest “${r.name}” doesn’t exist.`);
  if (q.turnIn === 'at giver' && !q.giver) W.push('“Hand in to the giver” needs a giver.');
  return W;
}
const OBJ_SNIPPETS = [['🎒 Collect', 'collect Wood 3'], ['⚔️ Defeat', 'kill enemy 3'], ['💬 Talk to', 'talk Villager'], ['📍 Go to', 'reach Old Well'], ['🛠️ Craft', 'craft Axe'], ['✋ Use', 'use Apple'], ['🔢 Variable', 'var coins >= 100'], ['✉️ Message', 'message bell rung'], ['⭐ Custom', 'Find the secret | Find the secret']];

export function openQuestEditor(i) {
  const q = quests()[i]; if (!q) return;
  const re = () => openQuestEditor(quests().indexOf(q));
  const objs = parseObjectives(q.objectives), rewards = parseRewards(q.rewards), warn = questWarnings(q), names = X.objects();
  const addObj = (t) => { q.objectives = [String(q.objectives || '').trim(), t].filter(Boolean).join('\n'); X.save(); re(); };
  X.openDialog('Quest', [
    h('div', { class: 'it-head' }, h('span', { class: 'it-big', style: '--r:#ffd23d' }, q.icon || '📜'), h('b', {}, q.name)),
    h('div', { class: 'it-grid' },
      field(q, 'name', 'Name', 'text', { after: () => { X.redrawQ?.(); re(); } }),
      field(q, 'icon', 'Icon', 'text', { ph: '📜', after: re }),
      field(q, 'giver', 'Given by (NPC name)', 'text', { list: names, ph: 'Elder', after: re }),
      field(q, 'requires', 'Unlocks after quest(s)', 'text', { list: quests().filter((o) => o !== q).map((o) => o.name), ph: 'none', after: re })),
    field(q, 'desc', 'Description (the journal shows it)', 'text', { ph: 'What it’s about' }),
    h('h4', { class: 'tl-h' }, icon('check'), 'Objectives'),
    field(q, 'objectives', 'One per line; “| text” renames it', 'area', { rows: 4, ph: 'collect Wood 5 (take)\nkill slime 3\nreach Old Well', after: re }),
    h('div', { class: 'it-chips' }, objs.map((o) => h('span', { class: 'it-chip' }, `${OBJ_ICON[o.type] || '⭐'} ${o.label}${o.take ? ' (taken)' : ''}`))),
    h('div', { class: 'it-icons' }, h('small', {}, 'Add:'), OBJ_SNIPPETS.map(([t, v]) => h('button', { class: 'btn st-snip', onclick: () => addObj(v) }, t))),
    h('p', { class: 'desc' }, 'collect Item n (take = hand them over at the end) · kill tag n · talk Name · reach Object [distance] · craft / use / gather Item n · var coins >= 100 · message name n · quest Other Quest. Anything else is a custom step: move it on with the “Advance quest” instruction.'),
    h('div', { class: 'it-grid' },
      field(q, 'order', 'Objectives', 'select', { options: [['', 'in any order'], ['in order', 'one after another']] }),
      field(q, 'turnIn', 'When they’re all done', 'select', { options: [['', 'complete right away'], ['at giver', 'hand in to the giver']], after: re })),
    h('h4', { class: 'tl-h' }, icon('gem'), 'Rewards'),
    field(q, 'rewards', 'Comma separated: coins 50, item Iron Sword, recipe Axe, quest Next Quest, message party', 'text', { ph: 'coins 50, item Health Potion 2', after: re }),
    rewards.length && h('div', { class: 'it-chips' }, rewards.map((r) => h('span', { class: 'it-chip' }, rewardChip(r)))),
    h('h4', { class: 'tl-h' }, icon('gear'), 'Starting'),
    h('div', { class: 'it-grid' },
      field(q, 'autoStart', 'Starts by itself (when unlocked)', 'bool'),
      field(q, 'repeatable', 'Can be done again', 'bool')),
    q.giver && h('h4', { class: 'tl-h' }, icon('sign'), `What ${q.giver} says`),
    q.giver && h('div', { class: 'st-says' },
      field(q, 'offer', 'Offering it', 'text', { ph: q.desc || 'I need your help with something.' }),
      field(q, 'accepted', 'After you accept', 'text', { ph: 'Thank you! Come back when it’s done.' }),
      field(q, 'reminder', 'While it’s going', 'text', { ph: `How is “${q.name}” going?` }),
      field(q, 'thanks', 'When you hand it in', 'text', { ph: 'You did it! Thank you.' })),
    q.giver && h('p', { class: 'desc' }, 'An NPC called the giver, with no dialogue of its own, offers the quest (Accept / Not now), reminds you and takes it back with these lines. A giver with its own dialogue can use “@quest start …” and “? quest … is ready”.'),
    warn.length && h('div', { class: 'st-warn' }, warn.map((w) => h('div', {}, '⚠️ ', w))),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { const c = { ...q, name: uniqueName(quests(), q.name) }; quests().splice(quests().indexOf(q) + 1, 0, c); X.save(); X.redrawQ?.(); openQuestEditor(quests().indexOf(c)); } }, icon('copy'), 'Duplicate'),
      h('button', { class: 'btn', onclick: () => { if (!confirm(`Delete “${q.name}”?`)) return; quests().splice(quests().indexOf(q), 1); X.save(); X.closeLayer(); X.redrawQ?.(); } }, icon('trash'), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { X.closeLayer(); X.redrawQ?.(); } }, icon('check'), 'Done')),
  ]);
}

export function questsEditor() {
  const box = h('div', { class: 'it-ed' });
  const draw = () => box.replaceChildren(
    h('p', { class: 'desc' }, 'Quests: objectives to do, rewards, who gives them and what must be done first. NPCs offer them, the Quest Tracker and Journal show them, and Triggers and nodes can start, check and finish them.'),
    quests().length ? h('div', { class: 'it-list' }, quests().map((q, i) => h('button', { class: 'it-row', onclick: () => openQuestEditor(i) },
      h('span', { class: 'it-ic', style: '--r:#ffd23d' }, q.icon || '📜'), h('span', { class: 'it-t' }, h('b', {}, q.name), h('small', {}, questSummary(q))),
      questWarnings(q).length ? h('span', { class: 'st-dot', title: 'Has warnings' }, '⚠️') : null, icon('chevron'))))
      : h('p', { class: 'desc' }, 'No quests yet.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { quests().push({ name: uniqueName(quests(), 'New Quest'), icon: '📜', objectives: '' }); X.save(); draw(); openQuestEditor(quests().length - 1); } }, icon('plus'), 'Add quest'),
      h('button', { class: 'btn', onclick: () => { const n = addStarterStory(); X.save(); draw(); X.redrawD?.(); X.toast(n ? `Added ${n} starter quests and dialogues` : 'You have them all already'); } }, icon('download'), 'Starter story')));
  X.redrawQ = draw; draw();
  return box;
}

// ---------------------------------------------------------------------------- dialogues
const SNIPPETS = [
  ['Line', 'Name: Hello there!'], ['Choice', '* What’s new? -> news'], ['Section', '# news'], ['Jump', '-> start'], ['End', '-> END'],
  ['If', '? quest Firewood is done -> thanks'], ['Only if', '* [if has Key] Open the door -> open'], ['Once', '* (once) Who are you? -> who'],
  ['Give', '@give Apple 1'], ['Take', '@take Wood 3'], ['Set', '@set metGuard = 1'], ['Add', '@add coins 10'],
  ['Start quest', '@quest start Firewood'], ['Hand in', '@quest complete Firewood'], ['Message', '@send door open'], ['Sound', '@sound coin'],
];
/** Things a script mentions that don't exist (quests, sections are checked by the parser). */
function scriptWarnings(script) {
  const p = parseDialogue(script), W = [...p.errors];
  for (const s of p.steps) {
    const m = s.k === 'do' && s.cmd.match(/^quest\s+\w+\s+(.+?)(?:\s+\d+)?$/i), c = (s.cond || '').match(/quest\s+(.+?)\s+(?:is\s+)?(?:locked|available|active|ready|done|failed|started|not started)\b/i);
    for (const n of [m?.[1], c?.[1]]) if (n && !byName(quests(), n)) W.push(`Line ${s.line}: there is no quest called “${n}”`);
    if (s.k === 'do' && !/^(set|add|give|take|quest|send|message|sound|learn|end|stop)\b/i.test(s.cmd)) W.push(`Line ${s.line}: unknown command “@${s.cmd.split(' ')[0]}”`);
  }
  return W;
}
/** Plays a script inside the editor with pretend variables, items and quests. */
function previewPlayer(getScript, portrait) {
  const box = h('div', { class: 'st-play' });
  let run = null, log = [], vars = {}, inv = {}, qs = {};
  const env = () => ({
    first: true, chosen: new Set(),
    getVar: (k) => vars[k], setVar: (k, v) => { vars[k] = v; log.push({ fx: `${k} = ${v}` }); },
    itemCount: (n) => inv[n.toLowerCase()] || 0,
    give: (n, k) => { inv[n.toLowerCase()] = Math.max(0, (inv[n.toLowerCase()] || 0) + k); log.push({ fx: `${k > 0 ? 'gets' : 'loses'} ${n} ×${Math.abs(k)}` }); },
    questState: (n) => qs[n.toLowerCase()] || (byName(quests(), n) ? 'available' : 'locked'),
    quest: (cmd, n) => { const st = { start: 'active', complete: 'done', turnin: 'done', fail: 'failed', reset: 'available' }[cmd]; if (st) qs[n.toLowerCase()] = st; log.push({ fx: `quest ${cmd} ${n}` }); },
    send: (m) => log.push({ fx: `sends “${m}”` }), sound: (x) => log.push({ fx: `🔊 ${x}` }), learn: (r) => log.push({ fx: `learns ${r}` }),
    fill: (t) => String(t).replace(/\{([^}]+)\}/g, (_, k) => (vars[k.trim()] ?? `{${k}}`)),
    log: (m) => log.push({ fx: `⚠️ ${m}` }),
  });
  const restart = () => {
    vars = { name: 'Player', ...(rootOf().vars || {}) }; log = [];
    for (const [k, v] of Object.entries(box._inv || {})) inv[k] = v;
    try { run = new DialogueRunner(getScript(), env()); } catch (err) { run = null; log.push({ fx: `⚠️ ${err.message}` }); }
    draw();
  };
  const said = () => { if (run?.line?.text) log.push({ who: run.line.who, text: run.line.text }); };
  const draw = () => {
    const cur = run && !run.done ? run.line : null;
    box.replaceChildren(
      h('div', { class: 'st-log' }, log.slice(-12).map((l) => (l.fx ? h('div', { class: 'st-fx' }, l.fx) : h('div', { class: 'st-said' }, l.who ? h('b', {}, l.who + ': ') : null, l.text)))),
      cur ? h('div', { class: 'st-bubble' }, h('span', { class: 'st-por' }, portrait() || '💬'), h('div', {}, cur.who && h('b', {}, cur.who), h('p', {}, cur.text || '…'))) : h('div', { class: 'st-end' }, run ? '— The end —' : 'Fix the script to preview it.'),
      h('div', { class: 'st-choices' },
        run?.choices ? run.choices.map((c, k) => h('button', { class: 'btn', onclick: () => { said(); log.push({ who: 'You', text: c.text }); run.choose(k); draw(); } }, c.text))
          : cur ? h('button', { class: 'btn primary', onclick: () => { said(); run.next(); draw(); } }, 'Next ›') : null,
        h('button', { class: 'btn', onclick: () => box.restart() }, icon('undo'), 'Restart')),
      h('details', { class: 'st-pretend' }, h('summary', {}, 'Pretend the player has…'),
        h('label', { class: 'it-f' }, h('span', {}, 'Items (Apple 2, Key 1)'), h('input', { type: 'text', value: Object.entries(box._inv || {}).map(([k, v]) => `${k} ${v}`).join(', '), onchange: (e) => { box._inv = {}; inv = {}; for (const part of e.target.value.split(',')) { const m = part.trim().match(/^(.+?)(?:\s+(\d+))?$/); if (m) box._inv[m[1].toLowerCase()] = +m[2] || 1; } box.restart(); } })),
        h('label', { class: 'it-f' }, h('span', {}, 'Finished quests'), h('input', { type: 'text', value: box._done || '', placeholder: 'Firewood, Slime Trouble', onchange: (e) => { box._done = e.target.value; box.restart(); } }))));
  };
  const rs = restart;
  box.restart = () => { qs = {}; inv = {}; for (const n of String(box._done || '').split(',').map((t) => t.trim()).filter(Boolean)) qs[n.toLowerCase()] = 'done'; rs(); };
  box.restart();
  return box;
}

export function openDialogueEditor(i) {
  const d = dialogues()[i]; if (!d) return;
  const warnBox = h('div', { class: 'st-warn' });
  const showWarn = () => { const W = scriptWarnings(d.script); warnBox.replaceChildren(...W.map((w) => h('div', {}, '⚠️ ', w))); warnBox.hidden = !W.length; };
  const play = previewPlayer(() => d.script || '', () => d.portrait);
  let t = 0;
  const area = h('textarea', { class: 'st-code st-script', rows: 12, spellcheck: false, autocapitalize: 'off', value: d.script || '', placeholder: 'Guard: Halt! Who goes there?\n* A friend -> friend\n* Nobody -> END\n# friend\nGuard: Then pass.',
    oninput: (e) => { d.script = e.target.value; clearTimeout(t); t = setTimeout(() => { X.save(); showWarn(); play.restart(); }, 350); } });
  const insert = (snip) => {
    const v = area.value, at = area.selectionEnd ?? v.length, lineStart = v.lastIndexOf('\n', at - 1) + 1, lineEnd = v.indexOf('\n', at), eol = lineEnd < 0 ? v.length : lineEnd;
    const pos = v.slice(lineStart, eol).trim() ? eol : lineStart, pre = v.slice(0, pos), add = (pos === eol && pre && !pre.endsWith('\n') ? '\n' : '') + snip;
    area.value = pre + add + v.slice(pos); area.focus(); area.setSelectionRange(pos + add.length, pos + add.length); area.dispatchEvent(new Event('input'));
  };
  showWarn();
  X.openDialog('Dialogue', [
    h('div', { class: 'it-grid' },
      field(d, 'name', 'Name (NPCs and the Start Dialogue instruction use it)', 'text', { after: () => X.redrawD?.() }),
      field(d, 'portrait', 'Portrait (emoji or art:name)', 'text', { ph: '🧙', after: () => play.restart() })),
    h('label', { class: 'it-f st-area' }, h('span', {}, 'Script'), area),
    h('div', { class: 'it-icons st-snips' }, SNIPPETS.map(([l, v]) => h('button', { class: 'btn st-snip', onclick: () => insert(v) }, l))),
    warnBox,
    h('h4', { class: 'tl-h' }, icon('eye'), 'Preview'),
    play,
    h('details', { class: 'st-help' }, h('summary', {}, 'How to write a dialogue'),
      h('pre', {}, [
        'Name: text          a line (say {coins} to show a variable)',
        'text                narration (no speaker)',
        '* text -> section   a choice button; -> END ends the talk',
        '* [if has Key] …    a choice only shown when…',
        '* (once) …          a choice that goes away once picked',
        '# section           a part to jump to (ends where the next starts)',
        '-> section          jump',
        '? condition -> sec  jump only if…',
        '@give / @take Item n · @set x = 1 · @add coins 5',
        '@quest start|complete|fail|progress Name',
        '@send message · @sound coin · @learn Recipe · @end',
        '',
        'Conditions: has Item 2 · coins >= 10 · quest Name is active|ready|done',
        '            first (first talk) · chance 30 · not … · … and … · … or …',
        'my.x is the NPC’s own variable: @add my.talks 1',
      ].join('\n'))),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { const c = { ...d, name: uniqueName(dialogues(), d.name) }; dialogues().splice(dialogues().indexOf(d) + 1, 0, c); X.save(); X.redrawD?.(); openDialogueEditor(dialogues().indexOf(c)); } }, icon('copy'), 'Duplicate'),
      h('button', { class: 'btn', onclick: () => { if (!confirm(`Delete “${d.name}”?`)) return; dialogues().splice(dialogues().indexOf(d), 1); X.save(); X.closeLayer(); X.redrawD?.(); } }, icon('trash'), 'Delete'),
      h('button', { class: 'btn primary', onclick: () => { clearTimeout(t); X.save(); X.closeLayer(); X.redrawD?.(); } }, icon('check'), 'Done')),
  ]);
}

export function dialoguesEditor() {
  const box = h('div', { class: 'it-ed' });
  const users = (name) => X.objects(true).filter((o) => o.dialogue && o.dialogue.toLowerCase() === name.toLowerCase()).map((o) => o.name);
  const draw = () => box.replaceChildren(
    h('p', { class: 'desc' }, 'Conversations with lines, choices, conditions and actions (give items, start quests, set variables). Give one to an NPC, or start it with the Start Dialogue instruction or node.'),
    dialogues().length ? h('div', { class: 'it-list' }, dialogues().map((d, i) => {
      const p = parseDialogue(d.script), lines = p.steps.filter((s) => s.k === 'say').length, ch = p.steps.filter((s) => s.k === 'choice').length, u = users(d.name);
      return h('button', { class: 'it-row', onclick: () => openDialogueEditor(i) },
        h('span', { class: 'it-ic', style: '--r:#7fb2ea' }, d.portrait || '💬'),
        h('span', { class: 'it-t' }, h('b', {}, d.name), h('small', {}, [`${lines} line${lines === 1 ? '' : 's'}`, ch && `${ch} choice${ch === 1 ? '' : 's'}`, u.length ? `used by ${u.slice(0, 2).join(', ')}${u.length > 2 ? '…' : ''}` : 'not used yet'].filter(Boolean).join(' · '))),
        scriptWarnings(d.script).length ? h('span', { class: 'st-dot', title: 'Has problems' }, '⚠️') : null, icon('chevron'));
    })) : h('p', { class: 'desc' }, 'No dialogues yet.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { dialogues().push({ name: uniqueName(dialogues(), 'New Dialogue'), script: 'Name: Hello!\n* Hi! -> END\n* Who are you? -> who\n# who\nName: Just a traveller.' }); X.save(); draw(); openDialogueEditor(dialogues().length - 1); } }, icon('plus'), 'Add dialogue'),
      h('button', { class: 'btn', onclick: () => { const n = addStarterStory(); X.save(); draw(); X.redrawQ?.(); X.toast(n ? `Added ${n} starter quests and dialogues` : 'You have them all already'); } }, icon('download'), 'Starter story')));
  X.redrawD = draw; draw();
  return box;
}
