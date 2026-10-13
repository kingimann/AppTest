// Node Editor: full-screen, touch-first visual scripting for the "Visual Script" (graph) behavior.
// Tap a dot, then another dot, to wire them (or drag from dot to dot). Drag nodes to move them,
// drag empty space to pan, pinch to zoom. Edits are written straight back through onChange().
import { NODE_TYPES } from '../engine/pocket.js';
import { icon } from './icons.js';

const NODE_W = 260;
export const CAT_COLOR = { Events: '#3d8b40', Flow: '#7e57c2', Actions: '#2c6cb0', Move: '#1f7f99', Looks: '#9c3f86', Animation: '#c2185b', Tween: '#00897b', Objects: '#5a7a2a', Game: '#b0453a', Values: '#a86b16', Math: '#8a6d1a' };
const KIND_COLOR = { exec: '#e8e8e8', number: '#4fc3f7', bool: '#f7a02c' };
const CATS = ['Events', 'Flow', 'Actions', 'Move', 'Looks', 'Animation', 'Tween', 'Objects', 'Game', 'Values', 'Math'];
const CAT_ICON = { Events: 'bolt', Flow: 'nodes', Actions: 'step', Move: 'move', Looks: 'brush', Animation: 'clock', Tween: 'rotate', Objects: 'cube', Game: 'trophy', Values: 'list', Math: 'plus' };
/** "What usually comes next" for the Add Node picker. */
const NEXT = {
  _events: ['start', 'tap', 'touch', 'update', 'every', 'button', 'swipe', 'onMessage'],
  _exec: ['addVar', 'sound', 'tweenMove', 'punch', 'branch', 'wait', 'popText', 'destroy'],
  _bool: ['compare', 'touching', 'grounded', 'isMoving', 'coinFlip', 'and', 'not'],
  _number: ['number', 'getVar', 'random', 'math', 'distance', 'position'],
  tap: ['addVar', 'punch', 'popText', 'sound', 'pulse', 'playAnim', 'particles', 'destroy'],
  touch: ['destroy', 'damage', 'addVar', 'sound', 'particles', 'playAnim', 'blink'],
  update: ['branch', 'moveToward', 'lookAt', 'rotateBy', 'cooldown'],
  every: ['spawn', 'spawnAt', 'chance', 'randomBranch', 'addVar'],
  start: ['setVar', 'playAnim', 'message', 'loadGame', 'loop'],
  damaged: ['blink', 'playAnim', 'impulse', 'sound'], death: ['playAnim', 'fadeTo', 'particles', 'destroy', 'gameOver'],
  animEnd: ['playAnim', 'destroy', 'sendMessage'], playAnim: ['wait', 'sound', 'particles'],
  tweenMove: ['punch', 'sound', 'particles'], tweenVar: ['popText', 'sound'], delayedCall: ['destroy', 'tweenMove', 'message'],
  branch: ['playAnim', 'addVar', 'sound', 'message'], wait: ['playAnim', 'destroy', 'spawn', 'showHide'],
};
const RECENT_KEY = 'pocket.recentNodes';
const recentNodes = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((t) => NODE_TYPES[t]); } catch { return []; } };
const rememberNode = (t) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...recentNodes().filter((q) => q !== t)].slice(0, 8))); } catch {} };
const CAT_HELP = {
  Events: 'Start here: when something happens…',
  Actions: '…do something.',
  Move: 'Position, rotation and size.',
  Looks: 'Text, colour and effects.',
  Animation: 'Play clips, sprite frames, fades and flips.',
  Tween: 'Smooth moves like DOTween: move, jump, shake, spin, pulse, count up, type text; pause, reverse or speed them up.',
  Objects: 'Create, remove and tag objects.',
  Game: 'Health, items and time.',
  Flow: 'Decide, wait, repeat, count.',
  Values: 'Numbers and true/false to plug into inputs.',
  Math: 'Work numbers out.',
};
export const NODE_HELP = {
  start: 'When the game starts', update: 'Runs every frame', every: 'Repeats on a timer', touch: 'When something with a tag touches this',
  tap: 'When the player taps this object', button: 'When an on-screen button is pressed', swipe: 'When the player swipes', destroyed: 'When this object is removed',
  branch: 'Go one way if true, another if false', wait: 'Pause, then continue', chance: 'Pick a random path', once: 'Only the first time', sequence: 'Run up to three things in order',
  setVar: 'Set a variable like score or hp', addVar: 'Add (or subtract) from a variable', message: 'Pop up text on screen', sound: 'Play a sound effect',
  spawn: 'Create a copy of a template', destroy: 'Remove this or the other object', moveBy: 'Nudge the position', setVelocity: 'Set speed and direction',
  jump: 'Jump upward', showHide: 'Show or hide an object', vibrate: 'Buzz the phone', shake: 'Shake the camera', win: 'Player wins', gameOver: 'Game over',
  nextLevel: 'Go to the next level', restart: 'Start again',
  number: 'A fixed number', getVar: 'Read a variable', random: 'A random number (whole if min and max are whole)', math: 'Add, subtract, multiply…', compare: 'Is A bigger than B?',
  touchEnd: 'When something with a tag stops touching this', saveGame: 'Save variables, level and collected items', loadGame: 'Continue from a save (or go to “no save”)',
  deleteSave: 'Erase a save slot', push: 'Add speed: knockback, dash, boost', setGravity: 'Change gravity (flip it, zero-g…)', switchCamera: 'Make another Camera object active',
  zoomCamera: 'Smoothly zoom in or out', setLight: 'Turn a light on/off or dim it', setDarkness: 'How dark the 2D scene is (0–1)',
  hasSave: 'Is there a saved game?', grounded: 'Standing on something?', velocity: 'How fast this moves', touching: 'Touching something with a tag right now?', canSee: 'Nothing solid in between?',
  onMessage: 'When a message is sent (Send Message, buttons, tweens)', tweenTo: 'Smoothly animate a property with easing', punch: 'Pop, bump or wobble for juicy feedback',
  killTweens: 'Stop tweens on this object (or by tween ID)', playAnim: 'Play a clip (Animator or Sprite Sheet)', stopAnim: 'Stop the animation', sendMessage: 'Tell other objects something happened',
  impulse: 'Shake the camera from this spot (weaker far away)',
  varChanged: 'When a variable (score, hp…) changes', damaged: 'When this object loses health', death: 'When this object\'s health reaches 0', holding: 'Every frame while a finger is on the screen',
  loop: 'Run “each” several times, then “done” (use Loop Index)', flipFlop: 'Alternate: A, then B, then A…', cooldown: 'Let it through at most once every N seconds',
  countTo: 'Count runs; go to “reached” on the Nth', randomBranch: 'Pick one wired path at random', switchNum: 'Go down the path matching the number', compareBranch: 'Compare two numbers and branch',
  setPosition: 'Put an object at an exact spot', moveToward: 'Step toward the nearest tagged object (use with Every Frame)', lookAt: 'Turn to face the nearest tagged object',
  rotateBy: 'Turn by some degrees', setScale: 'Make bigger or smaller', teleport: 'Jump to another object', setText: 'Change a text (use {score} etc.)',
  setColor: 'Change the colour', particles: 'A burst of particles here', spawnAt: 'Create a copy of a template at another object', destroyTag: 'Remove every object with a tag',
  tagOp: 'Add or remove a tag on this object', slowMo: 'Slow the whole game down for a moment', damage: 'Hurt something with Health', heal: 'Give health back', giveItem: 'Add to the inventory',
  math1: 'abs, round, square root, sin…', clamp: 'Keep a number between min and max', lerp: 'Blend from A to B (t from 0 to 1)', loopIndex: 'Which repeat this is (0, 1, 2…)',
  angleTo: 'Direction to the nearest tagged object, in degrees', countTag: 'How many objects have a tag', exists: 'Is that object (or tag) still around?', health: 'This object\'s health',
  itemCount: 'How many of an item you have', joystick: 'Joystick direction (−1 to 1)', screen: 'Screen width or height',
  released: 'When a finger is lifted off the screen', onWin: 'When the player wins', onGameOver: 'When the game is lost', stateEntered: 'When a State Machine enters a state',
  animEnd: 'When a “once” clip finishes playing', animSpeed: 'Play animations faster or slower (1 = normal)', setFrame: 'Show one frame of the sprite sheet',
  flipX: 'Face left or right (mirror the sprite)', fadeTo: 'Fade in or out (0 = invisible, 1 = solid)', blink: 'Flash on and off (like after getting hit)',
  toggleVar: 'Switch a variable between 0 and 1', setBackground: 'Change the background colour', setAlpha: 'See-through amount (0–1)', stopMoving: 'Set speed to zero',
  gravityScale: 'How much gravity pulls this (0 = floats)', isMoving: 'Moving right now?', isHolding: 'Is a finger on the screen?', touchPos: 'Where the finger is (in the world, 2D)',
  coinFlip: 'Randomly true or false', level: 'Which level this is (1, 2, 3…)', animPlaying: 'Is a clip playing right now?', spriteFrame: 'Which sprite sheet frame is showing',
  tweenMove: 'Glide to (or by, or from) a point with easing', tweenToObj: 'Glide to where another object is', jumpTo: 'Hop in an arc', shakeTw: 'Jitter position, rotation or size',
  spin: 'Turn round once or forever', pulse: 'Grow and shrink like a heartbeat', tweenColor: 'Fade to another colour', tweenVar: 'Count a variable up or down smoothly (score counters)',
  typeText: 'Type a text letter by letter', spiralTw: 'Spiral outward', lookAtTw: 'Turn smoothly to face something', pauseTw: 'Pause or resume tweens (by ID or on this object)',
  reverseTw: 'Play tweens backwards, forwards, flipped or from the start', tweenSpeed: 'Make tweens faster or slower (1 = normal)', playTween: 'Play this object\'s Tween / Tween Sequence',
  delayedCall: '“later” runs after a delay; cancel it with Stop Tweens and its ID', isTweening: 'Is something still animating?',
  popText: 'Floating text like “+10”', flashScreen: 'Flash the whole screen a colour', randomVar: 'Roll a random whole number into a variable', goToLevel: 'Jump to a level by number',
  toggleComp: 'Turn a component (patrol, spawner…) on or off', waitUntil: 'Wait until something is true', randomWait: 'Wait a random time',
  choose: 'Pick “yes” if the condition is true, else “no”', wave: 'A value that swings back and forth over time', remap: 'Convert a number from one range to another',
  objPos: 'Where another object is', deltaTime: 'Seconds since the last frame',
  and: 'Both are true', or: 'Either is true', not: 'Flip true/false', position: 'Where this object is', distance: 'How far to the nearest tagged object', time: 'Seconds since start',
};

/** Ready-made node graphs you can drop in and change. */
const GRAPH_TEMPLATES = [
  { label: 'Tap → score + pop', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'addVar', x: 300, y: 0, params: { name: 'score', amount: 1 } }, { id: 'c', type: 'punch', x: 600, y: 0, params: { what: 'scale', amount: 0.3, seconds: 0.4 } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Touch player → hurt + shake', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'player' } }, { id: 'b', type: 'addVar', x: 300, y: 0, params: { name: 'lives', amount: -1 } }, { id: 'c', type: 'impulse', x: 600, y: 0, params: { strength: 14 } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Every 2s → spawn', nodes: [{ id: 'a', type: 'every', x: 0, y: 0, params: { seconds: 2 } }, { id: 'b', type: 'spawn', x: 300, y: 0, params: { template: '' } }], links: [['a', 'then', 'b']] },
  { label: 'Score ≥ 10 → win', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'branch', x: 300, y: 0 }, { id: 'c', type: 'compare', x: 0, y: 150, params: { op: '≥', b: 10 } }, { id: 'd', type: 'getVar', x: -300, y: 150, params: { name: 'score' } }, { id: 'e', type: 'win', x: 600, y: 0 }], links: [['a', 'then', 'b'], ['b', 'true', 'e'], ['c', 'value', 'b', 'condition'], ['d', 'value', 'c', 'a']] },
  { label: 'Swipe up → jump', nodes: [{ id: 'a', type: 'swipe', x: 0, y: 0, params: { dir: 'up' } }, { id: 'b', type: 'jump', x: 300, y: 0, params: { power: 650 } }], links: [['a', 'then', 'b']] },
  { label: 'Chase the player', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'moveToward', x: 300, y: 0, params: { tag: 'player', speed: 90 } }, { id: 'c', type: 'lookAt', x: 600, y: 0, params: { tag: 'player' } }], links: [['a', 'then', 'b'], ['b', 'then', 'c']] },
  { label: 'Tap 5 times → win', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'countTo', x: 300, y: 0, params: { times: 5 } }, { id: 'c', type: 'particles', x: 620, y: -40 }, { id: 'd', type: 'win', x: 620, y: 140 }], links: [['a', 'then', 'b'], ['b', 'not yet', 'c'], ['b', 'reached', 'd']] },
  { label: 'Hit → blink + hurt animation', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'enemy' } }, { id: 'b', type: 'playAnim', x: 300, y: 0, params: { clip: 'hurt', loop: 'once' } }, { id: 'c', type: 'blink', x: 600, y: 0, params: { seconds: 1 } }, { id: 'd', type: 'animEnd', x: 0, y: 220, params: { clip: 'hurt' } }, { id: 'e', type: 'playAnim', x: 300, y: 220, params: { clip: 'idle', loop: 'loop' } }], links: [['a', 'then', 'b'], ['b', 'then', 'c'], ['d', 'then', 'e']] },
  { label: 'Run / idle by speed', nodes: [{ id: 'a', type: 'update', x: 0, y: 0 }, { id: 'b', type: 'branch', x: 300, y: 0 }, { id: 'c', type: 'isMoving', x: 0, y: 150 }, { id: 'd', type: 'playAnim', x: 620, y: -60, params: { clip: 'run', loop: 'loop' } }, { id: 'e', type: 'playAnim', x: 620, y: 160, params: { clip: 'idle', loop: 'loop' } }], links: [['a', 'then', 'b'], ['c', 'value', 'b', 'condition'], ['b', 'true', 'd'], ['b', 'false', 'e']] },
  { label: 'Collect: hop, fade, remove', nodes: [{ id: 'a', type: 'touch', x: 0, y: 0, params: { tag: 'player' } }, { id: 'b', type: 'popText', x: 300, y: 0, params: { text: '+10' } }, { id: 'c', type: 'jumpTo', x: 600, y: 0, params: { x: 0, y: 0, height: 60, seconds: 0.4 } }, { id: 'd', type: 'fadeTo', x: 900, y: 0, params: { alpha: 0, seconds: 0.4 } }, { id: 'e', type: 'destroy', x: 1200, y: 60 }], links: [['a', 'then', 'b'], ['b', 'then', 'c'], ['c', 'then', 'd'], ['d', 'finished', 'e']] },
  { label: 'Tap → score counts up', nodes: [{ id: 'a', type: 'tap', x: 0, y: 0 }, { id: 'b', type: 'math', x: 0, y: 180, params: { op: '+', b: 10 } }, { id: 'g', type: 'getVar', x: -300, y: 180, params: { name: 'score' } }, { id: 'c', type: 'tweenVar', x: 300, y: 0, params: { name: 'score', seconds: 0.6 } }, { id: 'd', type: 'pulse', x: 620, y: 0, params: { amount: 1.2, seconds: 0.15, repeat: 'once' } }], links: [['a', 'then', 'c'], ['g', 'value', 'b', 'a'], ['b', 'value', 'c', 'to'], ['c', 'then', 'd']] },
  { label: 'Spawn a ring of 8', nodes: [{ id: 'a', type: 'start', x: 0, y: 0 }, { id: 'b', type: 'loop', x: 300, y: 0, params: { count: 8 } }, { id: 'c', type: 'spawn', x: 620, y: 0, params: { template: '' } }], links: [['a', 'then', 'b'], ['b', 'each', 'c']] },
];
const def = (n) => NODE_TYPES[n.type] || { label: n.type, cat: 'Actions' };
const outKind = (d) => d.value || 'exec';

/**
 * opts: { graph, title, h, popMenu, toast, buzz, templates: [names], objects: [names], vars: [names], onChange(graph), onClose() }
 * Returns { close }.
 */
export function openNodeEditor(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts;
  const g = JSON.parse(JSON.stringify(opts.graph || { nodes: [], links: [] }));
  g.nodes ||= []; g.links ||= [];
  let k = 0.85, tx = 20, ty = 20;
  let pending = null; // { node, port, dir, kind }
  let selected = null;
  const undo = [];

  const emit = () => opts.onChange(JSON.parse(JSON.stringify(g)));
  const snap = () => { undo.push(JSON.stringify(g)); if (undo.length > 60) undo.shift(); undoBtn.disabled = false; };
  const nid = () => { let i = g.nodes.length + 1; while (g.nodes.some((n) => n.id === 'n' + i)) i++; return 'n' + i; };

  // ---------- DOM ----------
  const world = h('div', { class: 'ne-world' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ne-links');
  world.append(svg);
  const area = h('div', { class: 'ne-area' }, world);
  const empty = h('div', { class: 'ne-empty' }, h('b', {}, 'No nodes yet'), 'Tap “Add Node” and start with a green Event, like On Tap.');
  const hint = h('div', { class: 'ne-hint' });
  const undoBtn = h('button', { class: 'ne-btn', title: 'Undo', disabled: true, onclick: () => {
    if (!undo.length) return;
    const prev = JSON.parse(undo.pop()); g.nodes = prev.nodes; g.links = prev.links;
    undoBtn.disabled = !undo.length; pending = null; render(); emit();
  } }, icon('undo'));
  const root = h('div', { class: 'ne' },
    h('div', { class: 'ne-top' },
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('div', { class: 'ne-title' }, h('b', {}, opts.title || 'Visual Script'), h('small', {}, opts.linked?.()?.name ? 'Saved script: ' + opts.linked().name : 'Visual Script')),
      undoBtn,
      h('button', { class: 'ne-btn', title: 'Save / reuse scripts', onclick: (e) => scriptMenu(e.currentTarget) }, icon('save')),
      h('button', { class: 'ne-btn', title: 'Templates', onclick: (e) => templateMenu(e.currentTarget) }, icon('star')),
      h('button', { class: 'ne-btn', title: 'Fit all nodes', onclick: () => fit() }, icon('frame'))),
    area, empty, hint,
    h('button', { class: 'ne-add', onclick: () => openPicker() }, icon('plus'), 'Add Node'));
  document.body.append(root);

  // ---------- view ----------
  const applyView = () => { world.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`; };
  function fit() {
    const a = area.getBoundingClientRect();
    if (!g.nodes.length) { k = 0.85; tx = 20; ty = 20; applyView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of g.nodes) {
      const el = world.querySelector(`[data-id="${n.id}"]`), hgt = el ? el.offsetHeight : 120;
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + NODE_W); y1 = Math.max(y1, n.y + hgt);
    }
    const pad = 24;
    k = Math.max(0.35, Math.min(1.1, (a.width - pad * 2) / (x1 - x0), (a.height - pad * 2 - 90) / (y1 - y0)));
    tx = pad - x0 * k + Math.max(0, (a.width - pad * 2 - (x1 - x0) * k) / 2);
    ty = pad - y0 * k;
    applyView(); drawLinks();
  }
  const toWorld = (cx, cy) => { const a = area.getBoundingClientRect(); return { x: (cx - a.left - tx) / k, y: (cy - a.top - ty) / k }; };
  function portPos(nodeId, port, dir) {
    const el = world.querySelector(`.port[data-node="${nodeId}"][data-port="${port}"][data-dir="${dir}"] i`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return toWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  // ---------- links ----------
  const curve = (a, b) => { const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };
  let temp = null;
  function drawLinks() {
    const ns = 'http://www.w3.org/2000/svg';
    svg.replaceChildren();
    g.links.forEach((l, i) => {
      const a = portPos(l.from.node, l.from.port, 'out'), b = portPos(l.to.node, l.to.port, 'in');
      if (!a || !b) return;
      const from = g.nodes.find((n) => n.id === l.from.node), kind = from ? outKind(def(from)) : 'exec';
      const d = curve(a, b);
      const hit = document.createElementNS(ns, 'path');
      hit.setAttribute('d', d); hit.setAttribute('class', 'ne-hit'); hit.dataset.link = i;
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d); p.setAttribute('class', 'ne-wire' + (kind === 'exec' ? ' exec' : '')); p.style.stroke = KIND_COLOR[kind];
      svg.append(hit, p);
    });
    if (temp) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', temp.dir === 'out' ? curve(temp.a, temp.b) : curve(temp.b, temp.a));
      p.setAttribute('class', 'ne-wire temp'); p.style.stroke = KIND_COLOR[temp.kind];
      svg.append(p);
    }
  }
  const portInfo = (el) => el && { node: el.dataset.node, port: el.dataset.port, dir: el.dataset.dir, kind: el.dataset.kind };
  function connect(a, b) {
    if (!a || !b || a.dir === b.dir || a.node === b.node) return false;
    if ((a.kind === 'exec') !== (b.kind === 'exec')) { toast(a.kind === 'exec' || b.kind === 'exec' ? 'White dots connect to white dots (the order things happen)' : 'Can’t connect those'); return false; }
    const [from, to] = a.dir === 'out' ? [a, b] : [b, a];
    snap();
    // one wire per data input and per exec output
    g.links = g.links.filter((l) => !(l.to.node === to.node && l.to.port === to.port && to.kind !== 'exec') && !(from.kind === 'exec' && l.from.node === from.node && l.from.port === from.port));
    g.links.push({ from: { node: from.node, port: from.port }, to: { node: to.node, port: to.port } });
    buzz(10); emit(); render();
    return true;
  }
  function setPending(p) {
    pending = p;
    for (const el of world.querySelectorAll('.port')) {
      const q = portInfo(el);
      el.classList.toggle('src', !!p && q.node === p.node && q.port === p.port && q.dir === p.dir);
      el.classList.toggle('can', !!p && q.node !== p.node && q.dir !== p.dir && (q.kind === 'exec') === (p.kind === 'exec'));
    }
    root.classList.toggle('linking', !!p);
    updateHint();
  }
  function tapPort(el) {
    const q = portInfo(el);
    if (pending) {
      if (q.node === pending.node && q.port === pending.port && q.dir === pending.dir) return setPending(null);
      if (connect(pending, q)) return setPending(null);
      if (q.dir === pending.dir) return setPending(q);
      return;
    }
    const wired = g.links.filter((l) => q.dir === 'in' ? l.to.node === q.node && l.to.port === q.port : l.from.node === q.node && l.from.port === q.port);
    if (wired.length && q.dir === 'in' && q.kind !== 'exec') { // tapping a wired input unplugs it
      snap(); g.links = g.links.filter((l) => !wired.includes(l)); emit(); render(); toast('Wire removed'); return;
    }
    setPending(q); buzz(6);
  }
  function updateHint() {
    hint.replaceChildren(...(pending
      ? [h('span', {}, 'Now tap a glowing dot to connect'), h('button', { onclick: () => setPending(null) }, 'Cancel')]
      : [h('span', {}, g.nodes.length ? 'Tap a dot, then another dot to wire them · tap a wire to delete it' : 'Events (green) start a script · Actions (blue) do things')]));
  }

  // ---------- nodes ----------
  function field(n, spec) {
    const val = n.params?.[spec.key] ?? spec.default;
    const set = (v) => { (n.params ||= {})[spec.key] = v; emit(); };
    const pick = (list, none) => h('select', { onchange: (e) => set(e.target.value) },
      h('option', { value: '' }, none), list.map((o) => h('option', { value: o, selected: o === val }, o)));
    if (n.type === 'spawn' && spec.key === 'template') return pick(opts.templates || [], opts.templates?.length ? '— choose —' : '(no templates yet)');
    if (n.type === 'showHide' && spec.key === 'object') return pick((opts.objects || []).filter(Boolean), 'this object');
    if (spec.type === 'select') return h('select', { onchange: (e) => set(e.target.value) }, spec.options.map((o) => h('option', { value: o, selected: o === val }, o)));
    if (spec.type === 'bool') return h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) });
    if (spec.type === 'color') return h('input', { type: 'color', value: val || '#ffffff', oninput: (e) => set(e.target.value) });
    if (spec.type === 'number') return h('input', { type: 'text', inputMode: 'decimal', value: val ?? 0, oninput: (e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) set(v); } });
    const inp = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', spellcheck: false, oninput: (e) => set(e.target.value) });
    if (spec.key === 'name' && opts.vars?.length) { inp.setAttribute('list', 'ne-vars'); }
    return inp;
  }
  const port = (n, name, dir, kind, label) => h('span', { class: `port ${dir} k-${kind}`, 'data-node': n.id, 'data-port': name, 'data-dir': dir, 'data-kind': kind, title: label || name },
    h('i', { style: `--c:${KIND_COLOR[kind]}` }));
  function nodeEl(n) {
    const d = def(n), linkedIn = (key) => g.links.some((l) => l.to.node === n.id && l.to.port === key);
    const head = h('div', { class: 'ne-head', style: `background:${CAT_COLOR[d.cat] || '#555'}` },
      d.exec ? port(n, 'in', 'in', 'exec', 'in') : h('span', { class: 'port-sp' }),
      h('span', { class: 'ne-name' }, d.label),
      h('button', { class: 'ne-more', title: 'Node menu', onclick: (e) => nodeMenu(n, e.currentTarget) }, icon('more')));
    const rows = [];
    for (const o of d.outs || []) {
      if (o === 'then' && (d.outs.length === 1)) { head.insertBefore(port(n, o, 'out', 'exec', 'then'), head.lastChild); continue; }
      rows.push(h('div', { class: 'ne-row out' }, h('span', { class: 'lbl' }, o), port(n, o, 'out', 'exec', o)));
    }
    if (d.value) rows.push(h('div', { class: 'ne-row out' }, h('span', { class: 'lbl' }, d.value === 'bool' ? 'true / false' : 'value'), port(n, 'value', 'out', d.value)));
    for (const inp of d.inputs || []) {
      const wired = linkedIn(inp.key);
      rows.push(h('div', { class: 'ne-row in' + (wired ? ' wired' : '') }, port(n, inp.key, 'in', inp.type, inp.key),
        h('span', { class: 'lbl' }, inp.key), wired ? h('span', { class: 'wired-tag' }, 'wired') : field(n, inp)));
    }
    for (const p of d.params || []) rows.push(h('div', { class: 'ne-row param' }, h('span', { class: 'lbl' }, p.label || p.key), field(n, p)));
    if (!rows.length) rows.push(h('div', { class: 'ne-row note' }, NODE_HELP[n.type] || ''));
    return h('div', { class: 'ne-node' + (selected === n.id ? ' sel' : ''), 'data-id': n.id, style: `left:${n.x}px;top:${n.y}px;width:${NODE_W}px` }, head, h('div', { class: 'ne-body' }, rows));
  }
  function render() {
    for (const el of world.querySelectorAll('.ne-node')) el.remove();
    world.append(...g.nodes.map(nodeEl));
    empty.hidden = g.nodes.length > 0;
    setPending(pending && g.nodes.some((n) => n.id === pending.node) ? pending : null);
    requestAnimationFrame(drawLinks);
  }
  function nodeMenu(n, anchor) {
    popMenu(anchor, [
      { cap: def(n).label },
      { icon: 'copy', label: 'Duplicate', fn: () => { snap(); const c = JSON.parse(JSON.stringify(n)); c.id = nid(); c.x += 30; c.y += 40; g.nodes.push(c); selected = c.id; emit(); render(); } },
      { icon: 'close', label: 'Remove Wires', fn: () => { snap(); g.links = g.links.filter((l) => l.from.node !== n.id && l.to.node !== n.id); emit(); render(); } },
      '-',
      { icon: 'trash', label: 'Delete Node', fn: () => { snap(); g.nodes = g.nodes.filter((q) => q !== n); g.links = g.links.filter((l) => l.from.node !== n.id && l.to.node !== n.id); if (selected === n.id) selected = null; emit(); render(); } },
    ]);
  }

  function templateMenu(anchor) {
    const mine = opts.scripts?.() || [];
    popMenu(anchor, [
      ...(mine.length ? [{ cap: 'My saved scripts' }, ...mine.map((q) => ({ icon: 'nodes', label: q.here ? q.name : `${q.name} (other game)`, fn: () => addTemplate({ label: q.name, ...q.graph }) }))] : []),
      { cap: 'Add a ready-made script' }, ...GRAPH_TEMPLATES.map((t) => ({ icon: 'star', label: t.label, fn: () => addTemplate(t) }))]);
  }
  function scriptMenu(anchor) {
    const L = opts.linked?.();
    popMenu(anchor, L ? [
      { cap: `Linked: “${L.name}” · ${L.uses} cop${L.uses === 1 ? 'y' : 'ies'}` },
      { icon: 'info', label: 'Edits here update every copy', fn: () => toast(`Every object using “${L.name}” gets these changes`) },
      { icon: 'unlink', label: 'Unlink (edit this one only)', fn: () => { opts.unlink?.(); toast('Unlinked'); } },
      { icon: 'save', label: 'Save as a New Script…', fn: () => saveAs() },
    ] : [
      { cap: 'Reuse this script' },
      { icon: 'save', label: 'Save as Reusable Script…', fn: () => saveAs() },
      { icon: 'nodes', label: 'Insert a Saved Script…', fn: () => templateMenu(anchor) },
    ]);
  }
  function saveAs() {
    if (!g.nodes.length) { toast('Add some nodes first'); return; }
    const name = prompt('Name this script so you can reuse it on other objects', opts.title ? `${opts.title} script` : 'My script');
    if (name?.trim()) opts.saveScript?.(name.trim(), JSON.parse(JSON.stringify(g)));
  }
  function addTemplate(t) {
    snap();
    const map = {}, oy = g.nodes.length ? Math.max(...g.nodes.map((n) => n.y)) + 220 : 40;
    for (const n of t.nodes) {
      const id = nid(); map[n.id] = id;
      const d = NODE_TYPES[n.type] || {}, params = {};
      for (const q of [...(d.params || []), ...(d.inputs || [])]) params[q.key] = q.default;
      g.nodes.push({ id, type: n.type, x: n.x + 40, y: n.y + oy, params: { ...params, ...(n.params || {}) } });
    }
    for (const l of t.links || []) {
      const [a, port, b, to = 'in'] = Array.isArray(l) ? l : [l.from.node, l.from.port, l.to.node, l.to.port];
      if (map[a] && map[b]) g.links.push({ from: { node: map[a], port }, to: { node: map[b], port: to } });
    }
    emit(); render(); requestAnimationFrame(fit); toast(`Added “${t.label}”`);
  }

  // ---------- add node ----------
  function addNode(type) {
    const d = NODE_TYPES[type], a = area.getBoundingClientRect();
    const sel = g.nodes.find((n) => n.id === selected);
    const c = toWorld(a.left + a.width / 2 - NODE_W * k / 2, a.top + a.height * 0.35);
    const n = { id: nid(), type, x: Math.round(c.x), y: Math.round(c.y), params: {} };
    for (const p of [...(d.params || []), ...(d.inputs || [])]) n.params[p.key] = p.default;
    snap();
    let link = null;
    if (sel) { // auto-wire to the selected node so scripts grow in a chain
      const sd = def(sel);
      if (d.exec && (sd.outs || []).length) {
        const free = sd.outs.find((o) => !g.links.some((l) => l.from.node === sel.id && l.from.port === o));
        if (free) { link = { from: { node: sel.id, port: free }, to: { node: n.id, port: 'in' } }; n.x = sel.x + NODE_W + 50; n.y = sel.y; }
      } else if (d.value) {
        const free = (sd.inputs || []).find((i) => !g.links.some((l) => l.to.node === sel.id && l.to.port === i.key));
        if (free) { link = { from: { node: n.id, port: 'value' }, to: { node: sel.id, port: free.key } }; n.x = sel.x - NODE_W - 50; n.y = sel.y + 60; }
      }
    }
    // slide down until it doesn't cover another node
    const estH = 56 + 46 * (((d.outs || []).length > 1 ? d.outs.length : 0) + (d.value ? 1 : 0) + (d.inputs || []).length + (d.params || []).length || 1);
    const rectOf = (q) => { const el = world.querySelector(`[data-id="${q.id}"]`); return { x: q.x, y: q.y, h: el ? el.offsetHeight : 150 }; };
    for (let tries = 0; tries < 50; tries++) {
      const r = g.nodes.map(rectOf).find((q) => n.x < q.x + NODE_W + 16 && n.x + NODE_W + 16 > q.x && n.y < q.y + q.h + 16 && n.y + estH + 16 > q.y);
      if (!r) break;
      n.y = r.y + r.h + 30;
    }
    g.nodes.push(n);
    if (link) g.links.push(link);
    selected = n.id;
    emit(); render();
    toast(link ? `Added ${d.label} and wired it up` : `Added ${d.label}`);
    // keep the new node on screen
    requestAnimationFrame(() => {
      const el = world.querySelector(`[data-id="${n.id}"]`); if (!el) return;
      const r = el.getBoundingClientRect(), A = area.getBoundingClientRect();
      if (r.right > A.right - 10) tx -= r.right - A.right + 20;
      if (r.left < A.left + 10) tx += A.left - r.left + 20;
      if (r.bottom > A.bottom - 90) ty -= r.bottom - A.bottom + 100;
      if (r.top < A.top + 10) ty += A.top - r.top + 20;
      applyView(); drawLinks();
    });
  }
  let picker = null;
  /** Add Node: search, "suggested next", recently used, then category folders (tap one to open it). */
  function openPicker() {
    closePicker();
    const sel = g.nodes.find((n) => n.id === selected), sd = sel && def(sel);
    let folder = null;
    const list = h('div', { class: 'ne-plist' });
    const search = h('input', { type: 'search', placeholder: `Search ${Object.keys(NODE_TYPES).length} nodes`, autocapitalize: 'off', oninput: () => draw() });
    const match = (t, d, q) => d.label.toLowerCase().includes(q) || t.toLowerCase().includes(q) || (NODE_HELP[t] || '').toLowerCase().includes(q) || d.cat.toLowerCase().includes(q);
    const item = (t, showCat) => { const d = NODE_TYPES[t]; return h('button', { class: 'ne-pitem', 'data-type': t, style: `--c:${CAT_COLOR[d.cat]}`, onclick: () => { closePicker(); rememberNode(t); addNode(t); } },
      h('b', {}, d.label), showCat ? h('em', { class: 'ne-pcatname', style: `color:${CAT_COLOR[d.cat]}` }, d.cat) : null, h('small', {}, NODE_HELP[t] || '')); };
    const section = (title, types, showCat, sub) => types.length ? [h('div', { class: 'ne-pcat' }, title, sub ? h('small', {}, sub) : null), h('div', { class: 'ne-pgrid' }, types.map((t) => item(t, showCat)))] : [];
    function suggestions() {
      if (!sd) return g.nodes.some((n) => !NODE_TYPES[n.type]?.exec && !NODE_TYPES[n.type]?.value) ? [] : NEXT._events;
      const freeIn = (sd.inputs || []).find((i) => !g.links.some((l) => l.to.node === sel.id && l.to.port === i.key));
      const out = [...(NEXT[sel.type] || []), ...((sd.outs || []).length ? NEXT._exec : []), ...(freeIn ? NEXT['_' + freeIn.type] || [] : [])];
      return [...new Set(out)].filter((t) => NODE_TYPES[t]).slice(0, 8);
    }
    function draw() {
      const q = search.value.trim().toLowerCase();
      back.hidden = !folder || !!q;
      title.textContent = q ? 'Search' : folder || 'Add Node';
      if (q) {
        const hits = Object.entries(NODE_TYPES).filter(([t, d]) => match(t, d, q)).map(([t]) => t);
        list.replaceChildren(...(hits.length ? section(`${hits.length} found`, hits, true) : [h('div', { class: 'ne-pnone' }, `No node matches “${search.value}”`)]));
        return;
      }
      if (folder) {
        list.replaceChildren(h('div', { class: 'ne-pcat' }, h('i', { style: `background:${CAT_COLOR[folder]}` }), CAT_HELP[folder] || ''),
          h('div', { class: 'ne-pgrid' }, Object.entries(NODE_TYPES).filter(([, d]) => d.cat === folder).map(([t]) => item(t))));
        list.scrollTop = 0;
        return;
      }
      const recent = recentNodes();
      list.replaceChildren(
        ...section(sd ? 'Suggested next' : 'Start with an event', suggestions(), true, sd ? `after “${sd.label}”` : 'green nodes start a script'),
        ...section('Recently used', recent, true),
        h('div', { class: 'ne-pcat' }, 'All nodes', h('small', {}, 'by category')),
        h('div', { class: 'ne-folders' }, CATS.map((cat) => {
          const n = Object.values(NODE_TYPES).filter((d) => d.cat === cat).length;
          return h('button', { class: 'ne-folder', 'data-cat': cat, style: `--c:${CAT_COLOR[cat]}`, onclick: () => { folder = cat; draw(); } },
            h('span', { class: 'ne-ficon' }, icon(CAT_ICON[cat] || 'folder')), h('b', {}, cat), h('small', {}, CAT_HELP[cat]), h('em', {}, String(n)));
        })));
    }
    const back = h('button', { class: 'ne-btn', title: 'Back', onclick: () => { folder = null; draw(); } }, icon('left'));
    const title = h('b', {}, 'Add Node');
    picker = h('div', { class: 'ne-picker', onpointerdown: (e) => { if (e.target === picker) closePicker(); } },
      h('div', { class: 'ne-psheet' },
        h('div', { class: 'ne-phead' }, back, title, sel ? h('small', {}, `wires to “${def(sel).label}”`) : h('small', {}), h('button', { class: 'ne-btn', onclick: closePicker }, icon('close'))),
        search, list));
    draw();
    root.append(picker);
  }
  function closePicker() { picker?.remove(); picker = null; }

  // ---------- gestures ----------
  const ptrs = new Map();
  let drag = null; // {type:'pan'|'node'|'port'|'wire', ...}
  let pinch = null;
  area.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input, select, textarea, button')) return;
    area.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, tx, ty, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null; temp = null; drawLinks();
      return;
    }
    const portEl = e.target.closest('.port'), nodeEl = e.target.closest('.ne-node'), hit = e.target.closest('.ne-hit');
    const base = { x: e.clientX, y: e.clientY, moved: false };
    if (portEl) drag = { ...base, type: 'port', el: portEl };
    else if (nodeEl) { const n = g.nodes.find((q) => q.id === nodeEl.dataset.id); drag = { ...base, type: 'node', n, el: nodeEl, nx: n.x, ny: n.y }; }
    else if (hit) drag = { ...base, type: 'wire', i: +hit.dataset.link, tx, ty };
    else drag = { ...base, type: 'pan', tx, ty };
  });
  area.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const nk = Math.max(0.3, Math.min(2, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / (pinch.d || 1)));
      const A = area.getBoundingClientRect(), cx = pinch.cx - A.left, cy = pinch.cy - A.top;
      const mx = (a.x + b.x) / 2 - pinch.cx, my = (a.y + b.y) / 2 - pinch.cy;
      tx = cx - (cx - pinch.tx) * nk / pinch.k + mx; ty = cy - (cy - pinch.ty) * nk / pinch.k + my; k = nk;
      applyView();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    if (drag.type === 'pan' || drag.type === 'wire') { tx = drag.tx + dx; ty = drag.ty + dy; applyView(); }
    else if (drag.type === 'node') { drag.n.x = Math.round(drag.nx + dx / k); drag.n.y = Math.round(drag.ny + dy / k); drag.el.style.left = drag.n.x + 'px'; drag.el.style.top = drag.n.y + 'px'; drawLinks(); }
    else if (drag.type === 'port') {
      const q = portInfo(drag.el), a = portPos(q.node, q.port, q.dir);
      temp = { a, b: toWorld(e.clientX, e.clientY), dir: q.dir, kind: q.kind };
      if (!pending || pending.node !== q.node || pending.port !== q.port) setPending(q);
      drawLinks();
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    const d = drag; drag = null;
    if (!d || e.type === 'pointercancel') { temp = null; drawLinks(); return; }
    if (d.type === 'port') {
      if (!d.moved) { tapPort(d.el); return; }
      temp = null;
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.port');
      if (!(target && connect(portInfo(d.el), portInfo(target)))) drawLinks();
      setPending(null);
    } else if (d.type === 'node') {
      if (d.moved) { emit(); return; }
      selected = selected === d.n.id ? null : d.n.id;
      for (const el of world.querySelectorAll('.ne-node')) el.classList.toggle('sel', el.dataset.id === selected);
    } else if (d.type === 'wire' && !d.moved) {
      const l = g.links[d.i];
      if (l) popMenu({ left: e.clientX - 60, top: e.clientY - 10, bottom: e.clientY + 10 }, [{ icon: 'trash', label: 'Delete Wire', fn: () => { snap(); g.links = g.links.filter((q) => q !== l); emit(); render(); } }]);
    } else if (d.type === 'pan' && !d.moved) {
      if (pending) setPending(null);
      else if (selected) { selected = null; for (const el of world.querySelectorAll('.ne-node.sel')) el.classList.remove('sel'); }
    }
  };
  area.addEventListener('pointerup', up);
  area.addEventListener('pointercancel', up);

  // variable suggestions for "variable" fields
  if (opts.vars?.length) root.append(h('datalist', { id: 'ne-vars' }, opts.vars.map((v) => h('option', { value: v }))));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    closePicker();
    root.remove();
    opts.onClose?.();
  }
  render();
  requestAnimationFrame(() => fit());
  return { close };
}
