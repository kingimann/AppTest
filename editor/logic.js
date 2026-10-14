// Logic editor: PlayMaker-style State Machines and Game Creator-style Triggers, built from friendly cards.
// Events start things, Conditions check things, Instructions do things (top to bottom, waits included).
import { LOGIC_EVENTS, LOGIC_CONDITIONS, LOGIC_ACTIONS, logicSay } from '../engine/pocket.js';
import { icon } from './icons.js';

const CAT_COLOR = { Variables: '#a86b16', Objects: '#2c6cb0', Motion: '#7e57c2', Physics: '#00897b', Flow: '#5c6bc0', Game: '#c0392b' };
const TRIGGER_TEMPLATES = [
  { label: 'Tap to score', make: () => ({ event: { type: 'tap' }, conditions: [], actions: [{ type: 'setVar', name: 'score', op: 'add', value: 1 }, { type: 'punch', what: 'scale', amount: 0.3, seconds: 0.4 }, { type: 'sound', sound: 'click' }] }) },
  { label: 'Touch to collect', make: () => ({ event: { type: 'touch', tag: 'player' }, conditions: [], actions: [{ type: 'setVar', name: 'score', op: 'add', value: 10 }, { type: 'sound', sound: 'coin' }, { type: 'destroy', object: 'self', burst: true }] }) },
  { label: 'Door opens with a key', make: () => ({ event: { type: 'touch', tag: 'player' }, conditions: [{ type: 'hasItem', item: 'Key', count: 1 }], actions: [{ type: 'giveItem', item: 'Key', amount: -1 }, { type: 'message', text: 'Unlocked!', seconds: 1.5 }, { type: 'moveBy', x: 0, y: -120, z: 0, seconds: 0.6, ease: 'outQuad', wait: true }, { type: 'showHide', object: '', mode: 'hide' }] }) },
  { label: 'Hazard hurts the player', make: () => ({ event: { type: 'touch', tag: 'player' }, conditions: [], actions: [{ type: 'damage', object: 'other', amount: 1 }, { type: 'shake', strength: 12 }] }) },
  { label: 'Spawn every 2 seconds', make: () => ({ event: { type: 'every', seconds: 2 }, conditions: [{ type: 'playing' }], actions: [{ type: 'spawn', template: '', ox: 0, oy: 0 }] }) },
  { label: 'Win at 100 points', make: () => ({ event: { type: 'variable', name: 'score', op: '≥', value: 100 }, conditions: [], actions: [{ type: 'message', text: 'You did it!', seconds: 2 }, { type: 'wait', seconds: 1 }, { type: 'win' }] }) },
  { label: 'Double tap for a super jump', make: () => ({ name: 'Super jump', event: { type: 'doubleTap' }, conditions: [], cooldown: 1, actions: [{ type: 'jump', power: 900 }, { type: 'burst', color: '#33f0ff', count: 20, at: 'this' }] }) },
  { label: 'Hold to charge, then launch', make: () => ({ event: { type: 'longPress', seconds: 0.8 }, conditions: [], actions: [{ type: 'scaleTo', scale: 1.3, seconds: 0.2 }, { type: 'push', who: 'self', x: 0, y: -900 }, { type: 'scaleTo', scale: 1, seconds: 0.3 }] }) },
  { label: 'All enemies gone → win', make: () => ({ name: 'Cleared', event: { type: 'every', seconds: 0.5 }, once: true, conditions: [{ type: 'tagCount', tag: 'enemy', op: '=', value: 0 }, { type: 'playing' }], actions: [{ type: 'message', text: 'Level cleared!', seconds: 1.5 }, { type: 'wait', seconds: 1 }, { type: 'win' }] }) },
  { label: 'Treasure chest with a 30% rare drop', make: () => ({ event: { type: 'tap' }, once: true, conditions: [{ type: 'chance', percent: 30 }], actions: [{ type: 'toast', text: 'RARE!', color: '#e056fd' }, { type: 'setVar', name: 'gems', op: 'add', value: 5 }], elseActions: [{ type: 'toast', text: '+10 coins', color: '#ffd23f' }, { type: 'setVar', name: 'coins', op: 'add', value: 10 }] }) },
  { label: 'Tap with a cooldown (clicker)', make: () => ({ event: { type: 'tap' }, cooldown: 0.25, overlap: 'skip', conditions: [], actions: [{ type: 'setVar', name: 'coins', op: 'add', value: 1 }, { type: 'toast', text: '+1', color: '#ffd23f' }, { type: 'punch', what: 'scale', amount: 0.2, seconds: 0.25 }] }) },
  { label: 'Blink 3 times', make: () => ({ event: { type: 'message', message: 'blink' }, conditions: [], overlap: 'restart', actions: [{ type: 'fade', alpha: 0.2, seconds: 0.15, wait: true }, { type: 'fade', alpha: 1, seconds: 0.15, wait: true }, { type: 'repeat', times: 2 }] }) },
  { label: 'Random spawns (only while playing)', make: () => ({ event: { type: 'random', seconds: 2 }, conditions: [{ type: 'playing' }, { type: 'tagCount', tag: 'enemy', op: '<', value: 5 }], actions: [{ type: 'spawn', template: '', ox: 0, oy: 0 }] }) },
  { label: 'Save coins when the player leaves', make: () => ({ event: { type: 'appHidden' }, conditions: [], actions: [{ type: 'saveKey', name: 'coins', file: 'save' }] }) },
  { label: 'Talk to an NPC', make: () => ({ event: { type: 'tap' }, conditions: [], actions: [{ type: 'talk', who: 'Villager', text: 'Hello traveler!', wait: true }, { type: 'talk', who: 'Villager', text: 'The cave is to the east.', wait: true }] }) },
];

/** opts: { kind: 'triggers' | 'fsm', data, title, h, popMenu, toast, buzz, suggest(kind), onChange(data), onClose() } */
export function openLogic(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts;
  let data = JSON.parse(JSON.stringify(opts.data ?? (opts.kind === 'fsm' ? { start: 's1', any: [], states: [] } : [])));
  const undo = [];
  const open = new Set(); // expanded rows
  const emit = () => opts.onChange(JSON.parse(JSON.stringify(data)));
  const snap = () => { undo.push(JSON.stringify(data)); if (undo.length > 60) undo.shift(); undoBtn.disabled = false; };
  const change = (rerender = true) => { emit(); if (rerender) render(); };

  const body = h('div', { class: 'lg-body' });
  const undoBtn = h('button', { class: 'ne-btn', title: 'Undo', disabled: true, onclick: () => { if (!undo.length) return; data = JSON.parse(undo.pop()); undoBtn.disabled = !undo.length; change(); } }, icon('undo'));
  const root = h('div', { class: 'lg' + (opts.kind === 'fsm' ? ' fsm' : '') },
    h('div', { class: 'ne-top' },
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('div', { class: 'ne-title' }, h('b', {}, opts.kind === 'fsm' ? 'State Machine' : 'Triggers'), h('small', {}, opts.title || '')),
      undoBtn),
    body);
  document.body.append(root);

  // ---------- shared pieces ----------
  function picker(lib, title, onPick, { fsm = false } = {}) {
    const list = h('div', { class: 'ne-plist' });
    const search = h('input', { type: 'search', placeholder: 'Search', autocapitalize: 'off', oninput: () => draw() });
    function draw() {
      const q = search.value.toLowerCase(), groups = {};
      for (const [k, d] of Object.entries(lib)) {
        if (d.fsm && !fsm) continue;
        if (q && !d.label.toLowerCase().includes(q) && !(d.cat || '').toLowerCase().includes(q)) continue;
        (groups[d.cat || ''] ||= []).push([k, d]);
      }
      list.replaceChildren(...Object.entries(groups).flatMap(([cat, items]) => [
        cat ? h('div', { class: 'ne-pcat' }, h('i', { style: `background:${CAT_COLOR[cat] || '#666'}` }), cat) : '',
        h('div', { class: 'ne-pgrid' }, items.map(([k, d]) => h('button', { class: 'ne-pitem lg-pitem', style: `--c:${CAT_COLOR[d.cat] || '#4c8bd6'}`, onclick: () => { sheet.remove(); onPick(k); } },
          h('span', { class: 'lg-pic' }, icon(d.icon || 'bolt')), h('b', {}, d.label))))]));
    }
    draw();
    const sheet = h('div', { class: 'ne-picker', onpointerdown: (e) => { if (e.target === sheet) sheet.remove(); } },
      h('div', { class: 'ne-psheet' }, h('div', { class: 'ne-phead' }, h('b', {}, title), h('button', { class: 'ne-btn', onclick: () => sheet.remove() }, icon('close'))), search, list));
    root.append(sheet);
  }
  function form(def, item, onEdit) {
    return (def?.params || []).map((p) => {
      const val = item[p.key] ?? p.default, set = (v) => { item[p.key] = v; onEdit(); };
      let el;
      if (p.type === 'select') el = h('select', { onchange: (e) => set(e.target.value) }, p.options.map((o) => h('option', { value: o, selected: o === val }, o)));
      else if (p.type === 'bool') el = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) });
      else if (p.type === 'number') el = h('input', { type: 'text', inputMode: 'decimal', value: val ?? 0, oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) set(n); } });
      else if (p.type === 'color') el = h('input', { type: 'color', value: val || '#ffffff', oninput: (e) => set(e.target.value) });
      else {
        el = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', spellcheck: false, oninput: (e) => set(e.target.value) });
        const list = p.suggest ? opts.suggest(p.suggest) : [];
        if (list.length) { const id = 'lg-' + p.suggest + Math.random().toString(36).slice(2, 6); el.setAttribute('list', id); el = h('div', { class: 'lg-sug' }, el, h('datalist', { id }, list.map((v) => h('option', { value: v })))); }
      }
      return h('label', { class: 'lg-f' + (p.type === 'bool' ? ' inline' : '') }, h('span', {}, p.label || p.key), el);
    });
  }
  /** "On …" event button + its settings. */
  function eventBlock(holder, key, fsm) {
    const ev = holder[key] ||= { type: 'tap' }, def = LOGIC_EVENTS[ev.type], say = h('span', {}, logicSay(LOGIC_EVENTS, ev));
    return h('div', { class: 'lg-sec' },
      h('div', { class: 'lg-kw on' }, 'ON'),
      h('button', { class: 'lg-chip ev', onclick: () => picker(LOGIC_EVENTS, 'When should this happen?', (k) => { snap(); holder[key] = { type: k }; change(); }, { fsm }) }, icon(def?.icon || 'bolt'), say, icon('chevron')),
      def?.params?.length ? h('div', { class: 'lg-form' }, form(def, ev, () => { emit(); say.textContent = logicSay(LOGIC_EVENTS, ev); })) : '');
  }
  function condBlock(holder) {
    const list = holder.conditions ||= [];
    return h('div', { class: 'lg-sec' },
      h('div', { class: 'lg-kw if' }, list.length ? 'IF' : 'IF (optional)'),
      list.map((cd, i) => {
        const def = LOGIC_CONDITIONS[cd.type], id = 'c' + holderId(holder) + ':' + i, isOpen = open.has(id), say = h('span', { class: 'lg-say' }, logicSay(LOGIC_CONDITIONS, cd));
        return h('div', { class: 'lg-row cond' + (isOpen ? ' open' : '') },
          h('div', { class: 'lg-rh', onclick: () => { isOpen ? open.delete(id) : open.add(id); render(); } },
            h('button', { class: 'lg-not' + (cd.not ? ' on' : ''), title: 'Flip (NOT)', onclick: (e) => { e.stopPropagation(); snap(); cd.not = !cd.not; change(); } }, cd.not ? 'NOT' : 'is'),
            icon(def?.icon || 'bolt'), say,
            h('button', { class: 'lg-x', title: 'Remove', onclick: (e) => { e.stopPropagation(); snap(); list.splice(i, 1); change(); } }, icon('close'))),
          isOpen && def?.params?.length ? h('div', { class: 'lg-form' }, form(def, cd, () => { emit(); say.textContent = logicSay(LOGIC_CONDITIONS, cd); })) : '');
      }),
      h('button', { class: 'lg-add', onclick: () => picker(LOGIC_CONDITIONS, 'Add a condition', (k) => { snap(); list.push({ type: k }); open.add('c' + holderId(holder) + ':' + (list.length - 1)); change(); }) }, icon('plus'), 'Condition'));
  }
  function actionBlock(holder, key, label, kw = 'do') {
    const list = holder[key] ||= [];
    return h('div', { class: 'lg-sec' },
      h('div', { class: 'lg-kw ' + kw }, label),
      list.map((it, i) => {
        const def = LOGIC_ACTIONS[it.type], id = 'a' + holderId(holder) + key + ':' + i, isOpen = open.has(id), say = h('span', { class: 'lg-say' }, logicSay(LOGIC_ACTIONS, it));
        return h('div', { class: 'lg-row act' + (isOpen ? ' open' : '') + (it.off ? ' off' : ''), style: `--c:${CAT_COLOR[def?.cat] || '#666'}` },
          h('div', { class: 'lg-rh', onclick: () => { isOpen ? open.delete(id) : open.add(id); render(); } },
            h('span', { class: 'lg-n' }, i + 1), h('span', { class: 'lg-ic' }, icon(def?.icon || 'bolt')), say,
            h('button', { class: 'lg-x', title: 'More', onclick: (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
              i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { snap(); list.splice(i - 1, 0, list.splice(i, 1)[0]); change(); } },
              i < list.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { snap(); list.splice(i + 1, 0, list.splice(i, 1)[0]); change(); } },
              { icon: 'copy', label: 'Duplicate', fn: () => { snap(); list.splice(i + 1, 0, JSON.parse(JSON.stringify(it))); change(); } },
              { icon: it.off ? 'eye' : 'eyeoff', label: it.off ? 'Enable' : 'Disable', fn: () => { snap(); it.off = !it.off; change(); } },
              '-', { icon: 'trash', label: 'Delete', fn: () => { snap(); list.splice(i, 1); change(); } },
            ]); } }, icon('more'))),
          isOpen && def?.params?.length ? h('div', { class: 'lg-form' }, form(def, it, () => { emit(); say.textContent = logicSay(LOGIC_ACTIONS, it); })) : '');
      }),
      h('button', { class: 'lg-add', onclick: () => picker(LOGIC_ACTIONS, 'Add an instruction', (k) => { snap(); list.push({ type: k }); open.add('a' + holderId(holder) + key + ':' + (list.length - 1)); change(); }) }, icon('plus'), 'Instruction'));
  }
  const ids = new WeakMap(); let nextId = 1;
  const holderId = (o) => { if (!ids.has(o)) ids.set(o, nextId++); return ids.get(o); };

  // ---------- Triggers ----------
  const folded = new Set(), optsOpen = new Set();
  /** The small chips that say how a trigger runs (once, cooldown, chance…). */
  function optionChips(t) {
    const c = [];
    if (t.once) c.push('once'); else if (+t.maxRuns > 0) c.push(`max ${t.maxRuns}×`);
    if (+t.cooldown > 0) c.push(`cooldown ${t.cooldown}s`);
    if (+t.delay > 0) c.push(`delay ${t.delay}s`);
    if (t.chance != null && t.chance !== '' && +t.chance < 100) c.push(`${t.chance}% chance`);
    if (t.match === 'any') c.push('any condition');
    if (t.overlap === 'skip') c.push('no overlap'); else if (t.overlap === 'restart') c.push('restarts');
    if (t.log) c.push('logs');
    return c;
  }
  function optionsForm(t) {
    const set = (k, v, re = false) => { if (v === '' || v == null || v === false) delete t[k]; else t[k] = v; emit(); if (re) render(); };
    const numF = (k, label, ph) => h('label', { class: 'lg-f' }, h('span', {}, label), h('input', { type: 'text', inputMode: 'decimal', value: t[k] ?? '', placeholder: ph, onfocus: () => snap(), oninput: (e) => { const n = parseFloat(e.target.value); set(k, Number.isNaN(n) ? '' : n); }, onchange: () => render() }));
    const selF = (k, label, options) => h('label', { class: 'lg-f' }, h('span', {}, label), h('select', { onchange: (e) => { snap(); set(k, e.target.value === options[0][0] ? '' : e.target.value, true); } }, options.map(([v, l]) => h('option', { value: v, selected: (t[k] || options[0][0]) === v }, l))));
    return h('div', { class: 'lg-form lg-opts' },
      h('label', { class: 'lg-f' }, h('span', {}, 'Name (for “Run another trigger”)'), h('input', { type: 'text', value: t.name || '', placeholder: 'Open door', onfocus: () => snap(), oninput: (e) => set('name', e.target.value.trim()), onchange: () => render() })),
      h('label', { class: 'lg-f' }, h('span', {}, 'Runs'), h('select', { onchange: (e) => { snap(); const v = e.target.value; delete t.once; delete t.maxRuns; if (v === 'once') t.once = true; if (v === 'max') t.maxRuns = 3; emit(); render(); } },
        [['every', 'Every time'], ['once', 'Only once'], ['max', 'Up to a number of times']].map(([v, l]) => h('option', { value: v, selected: (t.once ? 'once' : +t.maxRuns > 0 ? 'max' : 'every') === v }, l)))),
      +t.maxRuns > 0 && numF('maxRuns', 'How many times', '3'),
      numF('cooldown', 'Cooldown (seconds between runs)', '0'),
      numF('delay', 'Delay before the steps (seconds)', '0'),
      numF('chance', 'Chance it runs (%)', '100'),
      (t.conditions || []).length > 1 && selF('match', 'Conditions', [['all', 'All must be true'], ['any', 'Any one is enough']]),
      selF('overlap', 'If it fires again while running', [['allow', 'Run another copy'], ['skip', 'Ignore it until done'], ['restart', 'Start over']]),
      h('label', { class: 'lg-f inline' }, h('span', {}, 'Write to the Console when it runs'), h('input', { type: 'checkbox', checked: !!t.log, onchange: (e) => { snap(); set('log', e.target.checked, true); } })));
  }
  function renderTriggers() {
    const list = data;
    body.replaceChildren(
      h('p', { class: 'lg-intro' }, 'Each trigger: ON something happening → IF conditions are true → DO instructions, one after another (ELSE runs when the conditions are false). Tap a trigger’s name to fold it.'),
      list.length > 2 ? h('div', { class: 'lg-tools' },
        h('button', { class: 'btn', onclick: () => { if (folded.size >= list.length) folded.clear(); else list.forEach((t, i) => folded.add(i)); render(); } }, icon('list'), folded.size >= list.length ? 'Unfold all' : 'Fold all')) : '',
      ...list.map((t, i) => {
        const fold = folded.has(i), chips = optionChips(t), name = t.name || `Trigger ${i + 1}`;
        const sum = `${logicSay(LOGIC_EVENTS, t.event)}${(t.conditions || []).length ? ` · if ${t.conditions.length}` : ''} → ${(t.actions || []).length} step${(t.actions || []).length === 1 ? '' : 's'}`;
        return h('div', { class: 'lg-card' + (t.off ? ' off' : '') + (fold ? ' folded' : '') },
          h('div', { class: 'lg-ch' },
            h('button', { class: 'lg-name', onclick: () => { fold ? folded.delete(i) : folded.add(i); render(); } }, icon('chevron'), h('b', {}, name), fold ? h('small', {}, sum) : ''),
            ...chips.map((c) => h('span', { class: 'tagchip' }, c)),
            h('button', { class: 'lg-x' + (optsOpen.has(i) ? ' on' : ''), title: 'Options', onclick: () => { optsOpen.has(i) ? optsOpen.delete(i) : optsOpen.add(i); folded.delete(i); render(); } }, icon('gear')),
            h('button', { class: 'lg-x', onclick: (e) => popMenu(e.currentTarget, [
              { icon: 'copy', label: 'Duplicate', fn: () => { snap(); list.splice(i + 1, 0, JSON.parse(JSON.stringify(t))); change(); } },
              i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { snap(); list.splice(i - 1, 0, list.splice(i, 1)[0]); change(); } },
              i < list.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { snap(); list.splice(i + 1, 0, list.splice(i, 1)[0]); change(); } },
              { icon: 'clock', label: t.once ? 'Run every time' : 'Run only once', fn: () => { snap(); t.once = !t.once; delete t.maxRuns; change(); } },
              { icon: t.off ? 'eye' : 'eyeoff', label: t.off ? 'Enable' : 'Disable', fn: () => { snap(); t.off = !t.off; change(); } },
              '-', { icon: 'trash', label: 'Delete Trigger', fn: () => { snap(); list.splice(i, 1); folded.clear(); optsOpen.clear(); change(); } },
            ].filter(Boolean)) }, icon('more'))),
          !fold && optsOpen.has(i) ? optionsForm(t) : '',
          !fold && [eventBlock(t, 'event', false), condBlock(t), actionBlock(t, 'actions', 'DO'), (t.conditions || []).length || (t.elseActions || []).length ? actionBlock(t, 'elseActions', 'ELSE (conditions false)', 'else') : '']);
      }),
      h('div', { class: 'lg-foot' },
        h('button', { class: 'btn primary', onclick: () => { snap(); list.push({ event: { type: 'tap' }, conditions: [], actions: [] }); change(); body.scrollTop = 1e6; } }, icon('plus'), 'Add Trigger'),
        h('button', { class: 'btn', onclick: (e) => popMenu(e.currentTarget, [{ cap: 'Ready-made triggers' }, ...TRIGGER_TEMPLATES.map((tp) => ({ icon: 'bolt', label: tp.label, fn: () => { snap(); list.push(tp.make()); change(); body.scrollTop = 1e6; toast(`Added “${tp.label}”`); } }))]) }, icon('star'), 'Templates')));
  }

  // ---------- State machine ----------
  let selState = data.states?.[0]?.id || null, view = { x: 10, y: 10 };
  const W = 150, HH = 64;
  function renderFSM() {
    const g = data; g.states ||= []; g.any ||= [];
    if (!g.states.some((s) => s.id === selState) && selState !== 'any') selState = g.states[0]?.id || null;
    const canvas = h('div', { class: 'fsm-canvas' });
    const world = h('div', { class: 'fsm-world', style: `transform:translate(${view.x}px,${view.y}px)` });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'fsm-svg');
    world.append(svg);
    const byId = Object.fromEntries(g.states.map((s) => [s.id, s]));
    const anyNode = { id: 'any', x: g.anyX ?? -170, y: g.anyY ?? 10 };
    const nodes = [...(g.any.length || selState === 'any' ? [anyNode] : []), ...g.states];
    for (const st of nodes) {
      const isAny = st.id === 'any';
      const el = h('div', { class: 'fsm-node' + (st.id === selState ? ' sel' : '') + (st.id === g.start ? ' start' : '') + (isAny ? ' any' : ''), style: `left:${st.x}px;top:${st.y}px;width:${W}px` },
        h('b', {}, isAny ? 'Any State' : st.name), h('small', {}, isAny ? `${g.any.length} global` : st.id === g.start ? 'start' : `${(st.enter || []).length} actions`));
      dragNode(el, st, isAny);
      world.append(el);
    }
    const ns = 'http://www.w3.org/2000/svg';
    svg.innerHTML = '<defs><marker id="fsm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#9ec5ff"/></marker></defs>';
    const edge = (a, b, label, hot, k) => {
      const ax = a.x + W / 2, ay = a.y + HH / 2, bx = b.x + W / 2, by = b.y + HH / 2, dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
      const off = 9 * (k % 2 ? -1 : 1), ox = -dy / l * off, oy = dx / l * off;
      const clip = (cx, cy, sx, sy) => { const tx = Math.abs(sx) > 1e-6 ? (W / 2 + 6) / Math.abs(sx) : Infinity, ty = Math.abs(sy) > 1e-6 ? (HH / 2 + 6) / Math.abs(sy) : Infinity, t = Math.min(tx, ty); return [cx + sx * t, cy + sy * t]; };
      const [x1, y1] = clip(ax + ox, ay + oy, dx / l, dy / l), [x2, y2] = clip(bx + ox, by + oy, -dx / l, -dy / l);
      const line = document.createElementNS(ns, 'line');
      Object.entries({ x1, y1, x2, y2, class: 'fsm-edge' + (hot ? ' hot' : ''), 'marker-end': 'url(#fsm-arr)' }).forEach(([kk, v]) => line.setAttribute(kk, v));
      const tx = document.createElementNS(ns, 'text');
      Object.entries({ x: x1 + (x2 - x1) * 0.38 + ox * 1.6, y: y1 + (y2 - y1) * 0.38 + oy * 1.6 + 4, class: 'fsm-lbl' }).forEach(([kk, v]) => tx.setAttribute(kk, v));
      tx.textContent = label.length > 22 ? label.slice(0, 21) + '…' : label;
      svg.append(line, tx);
    };
    let k = 0;
    for (const st of g.states) for (const tr of st.transitions || []) { const b = byId[tr.to]; if (b && b !== st) edge(st, b, logicSay(LOGIC_EVENTS, tr.event), st.id === selState, k++); }
    if (nodes.includes(anyNode)) for (const tr of g.any) { const b = byId[tr.to]; if (b) edge(anyNode, b, logicSay(LOGIC_EVENTS, tr.event), selState === 'any', k++); }
    canvas.append(world, h('div', { class: 'fsm-tools' },
      h('button', { class: 'ne-btn', onclick: addState }, icon('plus'), 'State'),
      h('button', { class: 'ne-btn', onclick: () => { selState = 'any'; render(); } }, icon('nodes'), 'Any State')));
    panCanvas(canvas);
    body.replaceChildren(canvas, h('div', { class: 'fsm-detail' }, stateDetail(g)));
  }
  function addState() {
    snap();
    const g = data, n = g.states.length + 1, id = 's' + Date.now().toString(36);
    const last = g.states.at(-1);
    g.states.push({ id, name: `State ${n}`, x: last ? last.x + (n % 2 ? 0 : 190) : 30, y: last ? last.y + (n % 2 ? 110 : 0) : 60, enter: [], stay: [], exit: [], transitions: [] });
    if (!g.start) g.start = id;
    selState = id; change();
  }
  function stateDetail(g) {
    if (selState === 'any') {
      return [h('div', { class: 'lg-ch' }, h('b', {}, 'Any State'), h('small', { class: 'lg-sub' }, 'These transitions work from every state (e.g. “touched by enemy → Hurt”).')),
        transitions(g, g.any, true)];
    }
    const st = g.states.find((s) => s.id === selState);
    if (!st) return [h('p', { class: 'lg-intro' }, 'Tap “+ State” to add your first state. A state is what the object is doing right now: Idle, Patrol, Chase, Jumping…')];
    return [
      h('div', { class: 'lg-ch' },
        h('input', { class: 'fsm-name', type: 'text', value: st.name, oninput: (e) => { st.name = e.target.value; emit(); clearTimeout(stateDetail.t); stateDetail.t = setTimeout(render, 800); } }),
        g.start === st.id ? h('span', { class: 'tagchip' }, 'start') : h('button', { class: 'btn', onclick: () => { snap(); g.start = st.id; change(); } }, 'Make Start'),
        h('button', { class: 'lg-x', onclick: (e) => popMenu(e.currentTarget, [
          { icon: 'copy', label: 'Duplicate State', fn: () => { snap(); const c = JSON.parse(JSON.stringify(st)); c.id = 's' + Date.now().toString(36); c.name += ' copy'; c.x += 30; c.y += 30; g.states.push(c); selState = c.id; change(); } },
          '-', { icon: 'trash', label: 'Delete State', fn: () => { snap(); g.states = g.states.filter((s) => s !== st); for (const s of g.states) s.transitions = (s.transitions || []).filter((t) => t.to !== st.id); g.any = g.any.filter((t) => t.to !== st.id); if (g.start === st.id) g.start = g.states[0]?.id; change(); } },
        ]) }, icon('more'))),
      actionBlock(st, 'enter', 'WHEN ENTERING', 'do'),
      transitions(g, st.transitions ||= [], false),
      h('details', { class: 'lg-more' }, h('summary', {}, 'Every frame & when leaving'),
        actionBlock(st, 'stay', 'EVERY FRAME (no waits)', 'do'), actionBlock(st, 'exit', 'WHEN LEAVING', 'do')),
    ];
  }
  function transitions(g, list, any) {
    return h('div', { class: 'lg-sec' },
      h('div', { class: 'lg-kw go' }, 'GO TO ANOTHER STATE'),
      list.map((tr, i) => h('div', { class: 'lg-card tr' },
        eventBlock(tr, 'event', true), condBlock(tr),
        h('div', { class: 'lg-sec' }, h('div', { class: 'lg-kw go' }, '→'),
          h('select', { class: 'fsm-to', onchange: (e) => { snap(); tr.to = e.target.value; change(); } }, g.states.map((s) => h('option', { value: s.id, selected: s.id === tr.to }, s.name))),
          h('button', { class: 'lg-x', title: 'Remove', onclick: () => { snap(); list.splice(i, 1); change(); } }, icon('trash'))))),
      h('button', { class: 'lg-add', onclick: () => {
        const other = g.states.find((s) => s.id !== selState) || g.states[0];
        if (!other) { toast('Add another state first'); return; }
        snap(); list.push({ event: { type: any ? 'touch' : 'tap' }, conditions: [], to: other.id }); change();
      } }, icon('plus'), 'Transition'));
  }
  function dragNode(el, st, isAny) {
    let d = null;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); el.setPointerCapture(e.pointerId); d = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y, moved: false }; });
    el.addEventListener('pointermove', (e) => {
      if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 6) return;
      d.moved = true; st.x = Math.round(d.sx + dx); st.y = Math.round(d.sy + dy);
      if (isAny) { data.anyX = st.x; data.anyY = st.y; }
      el.style.left = st.x + 'px'; el.style.top = st.y + 'px';
    });
    el.addEventListener('pointerup', () => { if (!d) return; const moved = d.moved; d = null; if (moved) { emit(); render(); } else { selState = st.id; buzz(5); render(); } });
  }
  function panCanvas(cv) {
    let d = null;
    cv.addEventListener('pointerdown', (e) => { if (e.target.closest('.fsm-node, button')) return; cv.setPointerCapture(e.pointerId); d = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; });
    cv.addEventListener('pointermove', (e) => { if (!d) return; view.x = d.vx + e.clientX - d.x; view.y = d.vy + e.clientY - d.y; cv.querySelector('.fsm-world').style.transform = `translate(${view.x}px,${view.y}px)`; });
    cv.addEventListener('pointerup', () => { d = null; });
    cv.addEventListener('pointercancel', () => { d = null; });
  }

  function render() {
    const y = body.querySelector('.fsm-detail')?.scrollTop ?? body.scrollTop;
    if (opts.kind === 'fsm') renderFSM(); else renderTriggers();
    const det = body.querySelector('.fsm-detail'); if (det) det.scrollTop = y; else body.scrollTop = y;
  }
  let closed = false;
  function close() { if (closed) return; closed = true; root.remove(); opts.onClose?.(); }
  render();
  return { close };
}
