// Pocket Editor: build Pocket Engine games on a phone.
// Layout: toolbar · Scene view · Hierarchy / Inspector / Project panels.
// A project is plain scene JSON (see examples/templates.js), the same thing Engine.start() plays.
import { Engine, Scene, SaveFiles, LIGHT_PRESETS, Behaviors, paramDefault, SPRITE_GROUPS, artURL, TWEEN_EFFECTS, SEQ_STEP_DEFAULT, uid, anchorPoint, VERSION, VOXEL_NAMES, GEOMETRIES, ACTIONS, RULE_EVENTS, partSize, M4, DEG, NODE_TYPES, Ease, EASES, sampleTrack, ANIM_PROPS, ANIM_MULT, LOGIC_EVENTS, logicSay, uiOrigin, uiBox, worldToLocal, localDelta, TILE_PALETTE, TILE_KINDS, Log, PHYSICS_LAYERS, layerMatrix, SOUNDS, FONTS, UI_THEMES, themeOf, googleFont, loadFonts, frameSlice, PHOTON_REGIONS, NOTIFY_TYPES, NOTIFY_DEFAULTS, Haptics, PERMISSIONS, APP_PALETTES, THEME_TOKENS } from '../engine/pocket.js';
import { EMOJI, MODELS_3D, UI_WIDGETS as UI_BASE, UI_WIDGETS_MORE, BEH_META, CAT_ORDER } from './library.js';
const UI_WIDGETS = [...UI_WIDGETS_MORE, ...UI_BASE.map((w) => ({ group: 'Menus & HUD', ...w }))];
const UI_GROUPS = ['App', 'Buttons', 'Inputs', 'Lists', 'Animated', 'Loading', 'Navigation', 'Popups', 'Controls', 'Text & HUD', 'Menus & HUD'];
import { templates, templateInfo } from '../examples/templates.js';
import { initStorage, allProjects, saveProject, deleteProject, rescueCopy, snapshot, listSnapshots, askPersist, isPersisted, storageUse, makeBackup, restoreBackup, lastBackup, markBackedUp, usingIndexedDB, setSnapshotPolicy } from './storage.js';
import { icon } from './icons.js';
import { openNodeEditor, CAT_COLOR as NODE_CAT_COLOR } from './nodes.js';
import { openModeler } from './modeler.js';
import { openSprite2D, newDrawing } from './sprite2d.js';
import { LOADING_DEFAULTS, LOADING_PRESETS, BAR_STYLES, loadingParts } from './loading.js';
import { openTimeline } from './timeline.js';
import { openLogic } from './logic.js';
import { initItems, itemsEditor, recipesEditor, inventorySettings, ensureStarterItems } from './items.js';
import { initStory, questsEditor, dialoguesEditor, ensureStarterStory } from './story.js';
import { initData, dataEditor, ensureCollection } from './data.js';
import { makeCube } from './meshops.js';
import { storeFiles, makeZip, suggestAppId, validAppId } from './stores.js';
import { expoFiles } from './expo.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
// ---------- Editor Preferences (this device only) ----------
const EDITOR_PREFS = { dense: true, compactTools: true, clean: false, theme: 'dark', accent: '#4c8bd6', uiSize: 1, reduceMotion: false, snap2D: 10, snap3D: 0.5, rotSnap: 15, haptics: true, autosave: '0.5', snapEvery: 3, snapKeep: 12, startOn: 'home', keepAwake: false };
let EP = (() => { try { return { ...EDITOR_PREFS, ...JSON.parse(localStorage.getItem('pocket.editor.prefs') || '{}') }; } catch { return { ...EDITOR_PREFS }; } })();
const THEMES = {
  dark: {},
  black: { '--toolbar': '#000', '--bg': '#0a0a0a', '--panel': '#151515', '--card': '#1a1a1a', '--tab': '#222', '--tab-off': '#101010', '--header': '#1c1c1c', '--field': '#0f0f0f', '--field-b': '#050505', '--line': '#000', '--hover': '#262626',
    '--g0': '#000', '--g1': '#0b0b0b', '--g2': '#141414', '--g3': '#1b1b1b', '--g4': '#222', '--g5': '#2c2c2c', '--g6': '#3a3a3a' },
  slate: { '--toolbar': '#1b2029', '--bg': '#232a35', '--panel': '#323b4a', '--card': '#384252', '--tab': '#414c5e', '--tab-off': '#29313d', '--header': '#3b4556', '--field': '#252c37', '--field-b': '#1c222b', '--line': '#181d25', '--hover': '#465267',
    '--g0': '#141921', '--g1': '#1c222b', '--g2': '#262d38', '--g3': '#2e3643', '--g4': '#363f4d', '--g5': '#424c5c', '--g6': '#525d6f' },
  midnight: { '--toolbar': '#0b0e1a', '--bg': '#10142a', '--panel': '#181d38', '--card': '#1e2444', '--tab': '#262d52', '--tab-off': '#141932', '--header': '#202748', '--field': '#121630', '--field-b': '#0b0e20', '--line': '#080b18', '--hover': '#2a3260',
    '--g0': '#070a16', '--g1': '#0d1124', '--g2': '#141933', '--g3': '#1a203e', '--g4': '#20274a', '--g5': '#2a3259', '--g6': '#38416e', '--text': '#e3e7f7', '--muted': '#a6acc9', '--dim': '#6f7697' },
  warm: { '--toolbar': '#1f1a17', '--bg': '#2a2420', '--panel': '#3d3530', '--card': '#433a34', '--tab': '#4b413a', '--tab-off': '#2f2824', '--header': '#463c36', '--field': '#2b2521', '--field-b': '#211c19', '--line': '#1b1714', '--hover': '#53473f',
    '--g0': '#171310', '--g1': '#211c19', '--g2': '#2b2521', '--g3': '#342d28', '--g4': '#3d3530', '--g5': '#4a413a', '--g6': '#5b5048' },
  light: { '--toolbar': '#ffffff', '--bg': '#eceef3', '--panel': '#ffffff', '--card': '#f5f6f9', '--tab': '#e4e7ee', '--tab-off': '#f5f6f9', '--header': '#eef0f5', '--field': '#f1f3f7', '--field-b': '#d6dae2', '--line': '#e1e4eb', '--hover': '#e7ebf2',
    '--g0': '#cfd4dd', '--g1': '#dde1e8', '--g2': '#eef0f4', '--g3': '#e9ecf1', '--g4': '#e3e6ec', '--g5': '#d8dce4', '--g6': '#c3c9d3', '--text': '#1c2029', '--muted': '#5a6372', '--dim': '#8a93a2', '--shadow': 'rgba(30,40,60,.18)',
    '--sel': 'var(--accent)', '--accent-soft': 'var(--accent)', '--accent-faint': 'color-mix(in srgb, var(--accent) 16%, #fff)', '--accent-text': 'var(--accent-strong)' },
};
const THEME_NAMES = [['dark', 'Dark'], ['black', 'Black'], ['slate', 'Slate'], ['midnight', 'Midnight'], ['warm', 'Warm'], ['light', 'Light']];
const ACCENTS = [['#4c8bd6', 'Blue'], ['#8e6bf2', 'Purple'], ['#e0559b', 'Pink'], ['#e8743c', 'Orange'], ['#3dbb7a', 'Green'], ['#22b8c9', 'Teal']];
let wakeLockEd = null;
async function editorWake() { if (!EP.keepAwake || document.hidden || wakeLockEd || !navigator.wakeLock) return; try { wakeLockEd = await navigator.wakeLock.request('screen'); wakeLockEd.addEventListener('release', () => { wakeLockEd = null; }); } catch { /* not allowed now */ } }
document.addEventListener('visibilitychange', editorWake);
function applyEditorPrefs() {
  const st = document.documentElement.style;
  for (const t of Object.values(THEMES)) for (const k of Object.keys(t)) st.removeProperty(k);
  for (const [k, v] of Object.entries(THEMES[EP.theme] || {})) st.setProperty(k, v);
  st.setProperty('--accent', EP.accent || EDITOR_PREFS.accent);
  st.setProperty('--ui-zoom', String(EP.uiSize || 1));
  document.documentElement.classList.toggle('reduce-motion', !!EP.reduceMotion);
  document.getElementById('toolRail')?.classList.toggle('compact', EP.compactTools !== false);
  document.documentElement.classList.toggle('dense', EP.dense !== false); // Compact panels: shorter rows and fields, more fits on screen
  document.documentElement.dataset.edTheme = EP.theme === 'light' ? 'light' : 'dark'; // light needs a few extra rules (white text on panels, shadows)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', (THEMES[EP.theme] || {})['--toolbar'] || '#191919');
  setSnapshotPolicy(EP.snapEvery, EP.snapKeep);
  if (EP.keepAwake) editorWake(); else { wakeLockEd?.release?.(); wakeLockEd = null; }
}
function setEP(k, v) { EP[k] = v; try { localStorage.setItem('pocket.editor.prefs', JSON.stringify(EP)); } catch { /* storage unavailable */ } applyEditorPrefs(); }
applyEditorPrefs();
const buzz = (ms = 8) => { if (EP.haptics) Haptics.play(ms); }; // (iPhone: a haptic tick)

/** DOM builder: h('div', { class: 'x', onclick }, child, 'text') */
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

let toastTimer;
function toast(msg) {
  $('.toast')?.remove();
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200);
}

// ============================================================================
// Projects (saved in localStorage)
// ============================================================================
const CURRENT_KEY = 'pocket.editor.current'; // projects themselves live in IndexedDB (storage.js)
const loadProjects = () => allProjects(); // every project, kept in memory by storage.js (IndexedDB underneath)
const SCENE_ID = '__scene';

// root = the whole game (level 1 plus root.levels[]); project = the level being edited
let root = null, project = null, projectId = null, selectedId = null, levelIdx = 0;
// Items & Recipes editors (Game Settings) work on the whole game
queueMicrotask(() => initItems({ root: () => root, save: () => changed(), openDialog: (t, k) => openDialog(t, k), closeLayer: () => closeLayer(), toast: (m) => toast(m),
  stations: () => levelList().flatMap((lv) => lv.entities || []).flatMap((e) => (e.behaviors || []).filter((b) => b.type === 'craftingStation').map((b) => b.station)).filter(Boolean) }));
// App Data (Game Settings › Data) works on the whole game too
queueMicrotask(() => initData({ root: () => root, save: () => changed(), openDialog: (t, k) => openDialog(t, k), closeLayer: () => closeLayer(), toast: (m) => toast(m) }));
// Quests & Dialogues editors (Game Settings) also work on the whole game
queueMicrotask(() => initStory({ root: () => root, save: () => changed(), openDialog: (t, k) => openDialog(t, k), closeLayer: () => closeLayer(), toast: (m) => toast(m),
  objects: (npcs) => { const all = levelList().flatMap((lv) => lv.entities || []).filter((e) => !e.template); return npcs ? all.flatMap((e) => (e.behaviors || []).filter((b) => b.type === 'npc' || b.type === 'dialogue').map((b) => ({ name: e.name, dialogue: b.dialogue || '' }))) : [...new Set(all.flatMap((e) => [e.name, ...(e.behaviors || []).filter((b) => b.type === 'npc' && b.talkName).map((b) => b.talkName)]).filter(Boolean))]; } }));
let history = [], hIndex = -1;
let snap = store.get('pocket.editor.snap', '1') === '1';
let showGrid = store.get('pocket.editor.grid', '1') === '1';
let showColliders = store.get('pocket.editor.colliders', '1') === '1'; // Unity-style green collider outlines on every object
let tool = 'move';
let uiMode = false; // UI editor view
let viewMode = 'scene'; // scene | top (3D levels laid out from above, no perspective) | ui
let uiScreen = 'all'; // which screen's UI the UI editor previews
let playing = false;

function saveNow() {
  if (!project) return;
  const rec = { name: root.name, updated: Date.now(), json: root };
  saveProject(projectId, rec).then((ok) => { if (!ok) storageFull(); });
  store.set(CURRENT_KEY, projectId);
}
/** Leaving the app (switching apps, locking the phone, closing the tab): save, plus an instant safety copy. */
function saveOnLeave() { if (!project) return; saveNow(); rescueCopy(projectId, { name: root.name, updated: Date.now(), json: root }); }
let fullWarned = 0;
function storageFull() {
  if (Date.now() - fullWarned < 60000) return; fullWarned = Date.now();
  openDialog('Storage is full', [h('div', { class: 'tour' }, h('div', { class: 'big' }, icon('save')),
    h('h4', {}, 'Your latest changes could not be saved'),
    h('p', {}, 'The phone has run out of space for this app. Back up your games to a file now, then delete games you no longer need or remove big imported pictures and sounds.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: () => { closeLayer(); backupAll(); } }, icon('download'), 'Back Up Now'), h('button', { class: 'btn', onclick: closeLayer }, 'Later')))]);
}
let saveTimer;
/** The action bar for Select mode, pinned to the bottom of the Hierarchy. */
function renderMultiBar() {
  const box = $('#hierarchy');
  box.querySelector('.multi-bar')?.remove();
  if (!multi) return;
  for (const id of [...multi]) if (!ent(id)) multi.delete(id);
  const list = [...multi].map(ent).filter(Boolean), n = list.length, none = !n;
  const act = (icn, label, fn, cls = '') => h('button', { class: cls, disabled: none, onclick: fn }, icon(icn), label);
  const visible = list.some((e) => e.visible !== false);
  box.append(h('div', { class: 'multi-bar' },
    h('div', { class: 'mb-top' }, h('b', {}, n ? `${n} selected` : 'Tap objects to select them'),
      h('button', { class: 'mb-all', onclick: () => { const all = project.entities.filter(hMatch).map((e) => e.id), every = all.every((id) => multi.has(id)); multi = new Set(every ? [] : all); renderHierarchy(); } }, 'All'),
      h('button', { class: 'mb-done', onclick: () => { multi = null; renderHierarchy(); } }, 'Done')),
    h('div', { class: 'mb-acts' },
      act('copy', 'Duplicate', () => multiDuplicate(list)),
      act('child', 'Group', () => multiGroup(list)),
      act(visible ? 'eyeoff' : 'eye', visible ? 'Hide' : 'Show', () => { for (const e of list) e.visible = !visible; changed({ structure: true }); pushHistory(); }),
      act('folder', 'Folder', () => moveToFolder(list)),
      act('trash', 'Delete', () => multiDelete(list), 'danger'))));
}
/** Top-most picks only: a ticked child is already covered by its ticked parent. */
const topPicks = (list) => list.filter((e) => !list.some((q) => q !== e && isInside(e.id, q.id)));
function multiDelete(list) {
  const tops = topPicks(list), ids = new Set(tops.flatMap((e) => subtree(e.id)));
  if (ids.size > 1 && !confirm(`Delete ${ids.size} objects?`)) return;
  project.entities = project.entities.filter((e) => !ids.has(e.id));
  if (ids.has(selectedId)) selectedId = null;
  multi = new Set(); changed({ structure: true }); pushHistory(); updateCtxBar();
  toast(`Deleted ${ids.size} object${ids.size > 1 ? 's' : ''}. Undo to restore.`);
}
function multiDuplicate(list) {
  const made = [];
  for (const e of topPicks(list)) { duplicateEntity(e.id); made.push(selectedId); }
  multi = new Set(made); renderHierarchy(); toast(`Duplicated ${made.length} object${made.length > 1 ? 's' : ''}`);
}
/** Put the picked objects inside a new empty parent at their middle, so they move together. */
function multiGroup(list) {
  const tops = topPicks(list);
  if (tops.some((e) => !!e.ui !== !!tops[0].ui)) { toast('Group UI and game objects separately'); return; }
  const live = tops.map((e) => engine.scene.byId(e.id)).filter(Boolean), avg = (k) => live.reduce((a, q) => a + (q[k] || 0), 0) / (live.length || 1);
  const r = (v) => (is3D() ? round(v, 2) : Math.round(v));
  const g = { id: uid(), name: 'Group', ...(tops[0].ui ? { ui: true, anchor: tops[0].anchor || 'center', x: 0, y: 0 } : { x: r(avg('x')), y: r(avg('y')), ...(is3D() ? { z: r(avg('z')) } : {}) }) };
  if (tops.every((e) => e.folder && e.folder === tops[0].folder)) g.folder = tops[0].folder;
  const L = project.entities; L.splice(Math.min(...tops.map((e) => L.indexOf(e))), 0, g);
  rebuild();
  for (const e of tops) setParent(e.id, g.id, { batch: true });
  multi = null; selectedId = g.id; closedKids.delete(g.id);
  changed({ structure: true }); pushHistory(); updateCtxBar();
  toast(`Grouped ${tops.length} objects. Move the Group to move them all.`);
}
const openDups = new Set(); // Hierarchy "Gem ×8" groups the user opened
let hRevealed = null; // last selection the Hierarchy scrolled to
let attachFor = null;
let colliderEdit = null; // object whose 2D collider is being edited with handles
let multi = null; // Hierarchy "Select" mode: the ids ticked (null when off) // object waiting for the user to tap its new parent (Attach mode)
const saveSoon = () => { clearTimeout(saveTimer); if (EP.autosave === 'leave') return; saveTimer = setTimeout(saveNow, (+EP.autosave || 0.5) * 1000); }; // Preferences › Saving

const levelList = () => [root, ...(root.levels || [])];
const levelName = (lv, i) => lv.levelName || `Level ${i + 1}`;
function normalize(lv) { lv.entities ||= []; lv.settings ||= {}; lv.vars ||= {}; return lv; }

function openProject(json, id = uid('p')) {
  root = json;
  normalize(root); root.vars.score ??= 0;
  (root.levels || []).forEach(normalize);
  project = root; levelIdx = 0;
  projectId = id;
  syncSoundNames();
  selectedId = null;
  history = []; hIndex = -1; pushHistory();
  resetCamera();
  rebuild();
  refreshAll();
  saveNow();
}

function newFromTemplate(key, name) {
  const json = clone(templates[key]);
  json.name = name || (key.startsWith('empty') ? 'New Game' : json.name);
  for (const lv of [json, ...(json.levels || [])]) { for (const e of lv.entities || []) e.id ||= uid(); addSceneEssentials(lv, json.mode); }
  openProject(json);
}
/** Like a new Unity scene: a Main Camera and the level's light as objects you can select and change. */
function addSceneEssentials(lv, mode) {
  const three = (lv.mode || mode) === '3d', E = (lv.entities ||= []), L = lv.light || {};
  const hasCam = E.some((e) => (e.behaviors || []).some((b) => b.type === 'camera' || b.type === 'cameraFollow' || b.type === 'firstPerson' || b.type === 'thirdPerson'));
  const add = [];
  if (!hasCam) add.push(three
    ? { id: uid(), name: 'Main Camera', x: 0, y: 8, z: 12, rx: -34, behaviors: [{ type: 'camera', mode: 'follow', target: 'player', smooth: 6, fov: 60, ox: 0, oy: 7, oz: 11, priority: 0 }] }
    : { id: uid(), name: 'Main Camera', x: (lv.view?.width || 400) / 2, y: (lv.view?.height || 700) / 2, behaviors: [{ type: 'camera', mode: 'follow', target: 'player', smooth: 6, zoom: 1, ox: 0, oy: 0, priority: 0 }] });
  if (three && !E.some((e) => e.sun)) {
    let rx = 68, ry = -127; // aim the sun the way the level was already lit (these match the engine's default sunlight)
    if (L.sunAngle != null || L.sunHeight != null) { rx = +(L.sunHeight ?? 60); ry = 180 + (+L.sunAngle || 0); }
    else if (L.dir) { const d = L.dir, n = Math.hypot(d.x, d.y, d.z) || 1; rx = Math.asin(-d.y / n) / DEG; ry = Math.atan2(d.x, d.z) / DEG; }
    add.push({ id: uid(), name: 'Directional Light', x: 0, y: 6, z: 0, rx: Math.round(rx), ry: Math.round(ry), sun: { color: L.color || '#ffffff', intensity: L.intensity ?? 1, ambient: L.ambient ?? 0.45, shadows: L.shadows !== false } });
  }
  if (!three && !E.some((e) => e.globalLight)) add.push({ id: uid(), name: 'Global Light 2D', x: 40, y: 40, globalLight: { brightness: Math.round((1 - (+L.darkness || 0)) * 100) / 100, color: L.ambientColor || '#0a0a1e' } });
  E.unshift(...add);
}

function setLevel(i) {
  levelIdx = Math.max(0, Math.min(i, levelList().length - 1));
  project = levelList()[levelIdx];
  project.mode ||= root.mode;
  selectedId = null;
  if (viewMode === 'top' && project.mode !== '3d') { viewMode = 'scene'; $('#app').dataset.view = 'scene'; }
  resetCamera(); rebuild(); refreshAll();
}
function addLevel(duplicate, mode) {
  const n = levelList().length + 1, m = mode || project.mode || root.mode, same = m === project.mode;
  const lv = duplicate ? clone(project) : {
    mode: m, background: same ? project.background : m === '3d' ? '#87b8e8' : '#0b0b1a', view: clone(project.view || { width: 400, height: 700 }), gravity: same ? project.gravity : m === '3d' ? -25 : 0,
    settings: { joystick: !!project.settings.joystick, jumpButton: !!project.settings.jumpButton }, vars: {},
    camera: same && project.camera ? clone(project.camera) : undefined, entities: project.entities.filter((e) => e.ui).map(clone),
  };
  if (duplicate) { delete lv.levels; delete lv.name; delete lv.version; for (const e of lv.entities) e.id = uid(); }
  lv.levelName = duplicate ? `${levelName(project, levelIdx)} (copy)` : `Level ${n}`;
  for (const e of lv.entities) e.id = uid();
  (root.levels ||= []).push(normalize(lv));
  pushHistory(); saveSoon();
  setLevel(levelList().length - 1);
  toast(`Added ${lv.levelName}`);
}
/** Put a whole game (a template or one of your projects) into this project as new levels: apps open it with Play Game. */
function addGameToProject(json, name) {
  const g = clone(json), lvls = [g, ...(g.levels || [])], base = (name || g.name || 'Game').trim(), first = levelList().length + 1;
  lvls.forEach((lv, k) => {
    if (k === 0) { delete lv.levels; delete lv.version; delete lv.name; for (const key of ['items', 'recipes', 'quests', 'dialogues', 'collections', 'sounds', 'customActions', 'customConditions']) delete lv[key]; }
    lv.mode ||= g.mode || '2d';
    lv.levelName = lvls.length > 1 ? `${base} ${k + 1}` : base;
    if (lv.settings?.app) delete lv.settings.app;
    const ids = {}; for (const e of lv.entities || []) { const n = uid(); ids[e.id] = n; e.id = n; }
    for (const e of lv.entities || []) if (e.parent && ids[e.parent]) e.parent = ids[e.parent];
    addSceneEssentials(lv, lv.mode);
    (root.levels ||= []).push(normalize(lv));
  });
  // what the game needs from the whole project: items, recipes, quests, dialogues, data, sounds, My Instructions
  const same = (a, b, key) => String(a[key] ?? '').toLowerCase() === String(b[key] ?? '').toLowerCase();
  for (const [k, key] of [['items', 'name'], ['recipes', 'result'], ['quests', 'name'], ['dialogues', 'name'], ['collections', 'name'], ['customActions', 'name'], ['customConditions', 'name']]) for (const x of json[k] || []) { const L = (root[k] ||= []); if (!L.some((y) => same(y, x, key))) L.push(clone(x)); }
  if (json.sounds) { root.sounds = { ...json.sounds, ...(root.sounds || {}) }; syncSoundNames(); }
  // an app gets a button that opens it
  if (root.settings?.app && project.settings?.app !== false && levelIdx === 0) {
    const n = project.entities.filter((e) => (e.behaviors || []).some((b) => b.action === 'play game')).length;
    project.entities.push({ id: uid(), name: `Play ${base}`, ui: true, anchor: 'center', x: 0, y: -60 + n * 66, layer: 3, shape: { type: 'rect', w: 300, h: 56, radius: 16, fill: '#6366f1' }, text: { value: `▶ Play ${base}`, size: 18, color: '#ffffff', weight: '800' }, behaviors: [{ type: 'button', action: 'play game', value: base, amount: 1, sound: 'click' }] });
  }
  pushHistory(); saveSoon(); rebuild(); refreshAll();
  toast(`Added “${base}” as level ${first}${lvls.length > 1 ? `–${first + lvls.length - 1}` : ''}${root.settings?.app ? ' with a Play button' : ''}`);
}
/** Pick a game to add: a game type, or one of your own games. */
function openAddGameDialog() {
  const mine = Object.entries(loadProjects()).filter(([id, p]) => id !== projectId && !p.json.settings?.app).sort((a, b) => b[1].updated - a[1].updated);
  const games = templateInfo.filter((t) => t.kind !== 'app' && !t.key.startsWith('empty'));
  openDialog('Add a Game', [
    h('p', { class: 'desc' }, root.settings?.app ? 'The game becomes part of this app (new levels). A Play button opens it; when it ends, or you go Back, you are back in the app, with {lastScore} and {lastResult}.' : 'The game is added as new levels of this project. Open it with a Play Game button or instruction (and come back with Back to App).'),
    mine.length ? [h('h4', { class: 'tl-h' }, icon('folder'), 'My games'), h('div', { class: 'it-list' }, mine.map(([id, pr]) => h('button', { class: 'it-row', onclick: () => { closeLayer(); addGameToProject(pr.json, pr.name); } }, modeBadge(pr.json), h('span', { class: 'it-t' }, h('b', {}, pr.name), h('small', {}, `${[pr.json, ...(pr.json.levels || [])].length} level(s)`)), icon('plus'))))] : null,
    h('h4', { class: 'tl-h' }, icon('gamepad'), 'Game types'),
    h('div', { class: 'it-list' }, games.map((t) => h('button', { class: 'it-row', onclick: () => { closeLayer(); addGameToProject(templates[t.key], t.title); } }, modeBadge(templates[t.key]), h('span', { class: 'it-t' }, h('b', {}, t.title), h('small', {}, t.blurb)), icon('plus')))),
  ].flat().filter(Boolean));
}
function deleteLevel() {
  const list = levelList();
  if (list.length < 2) { toast('A game needs at least one level'); return; }
  if (!confirm(`Delete "${levelName(project, levelIdx)}"?`)) return;
  list.splice(levelIdx, 1);
  const first = list[0];
  if (first !== root) { // promote the next level to be level 1
    first.name = root.name; first.version = root.version;
    first.settings = { ...first.settings, title: root.settings.title, subtitle: root.settings.subtitle, saveBest: root.settings.saveBest };
  }
  first.levels = list.slice(1);
  if (!first.levels.length) delete first.levels;
  root = first;
  pushHistory(); saveSoon();
  setLevel(Math.min(levelIdx, levelList().length - 1));
}
function moveLevel(d) {
  const list = levelList(), j = levelIdx + d;
  if (j < 0 || j >= list.length) return;
  if (levelIdx === 0 || j === 0) { toast('Level 1 holds the game settings; add a new level and move others instead'); return; }
  root.levels.splice(j - 1, 0, root.levels.splice(levelIdx - 1, 1)[0]);
  pushHistory(); saveSoon(); setLevel(j);
}
function openLevelMenu() {
  const list = levelList();
  popMenu($('#levelBtn'), [
    { cap: 'Levels' },
    ...list.map((lv, i) => ({ icon: i === levelIdx ? 'right' : 'layers', label: `${i + 1}. ${levelName(lv, i)} · ${(lv.mode || root.mode) === '3d' ? '3D' : '2D'}`, fn: () => setLevel(i) })),
    '-',
    { icon: 'plus', label: 'New Level', fn: () => addLevel(false) },
    { icon: 'grid', label: 'New 2D Level', fn: () => addLevel(false, '2d') },
    { icon: 'cube', label: 'New 3D Level', fn: () => addLevel(false, '3d') },
    { icon: 'copy', label: 'Duplicate This Level', fn: () => addLevel(true) },
    { icon: 'gamepad', label: root.settings?.app ? 'Add a Game to This App…' : 'Add a Game as New Levels…', fn: openAddGameDialog },
    { icon: 'edit', label: 'Rename Level…', fn: () => { const n = prompt('Level name', levelName(project, levelIdx)); if (n) { project.levelName = n; changed(); refreshAll(); } } },
    levelIdx > 1 && { icon: 'upload', label: 'Move Earlier', fn: () => moveLevel(-1) },
    levelIdx > 0 && levelIdx < list.length - 1 && { icon: 'download', label: 'Move Later', fn: () => moveLevel(1) },
    list.length > 1 && { icon: 'trash', label: 'Delete Level', fn: deleteLevel },
  ]);
}

// ============================================================================
// Undo history
// ============================================================================
function pushHistory() {
  const s = JSON.stringify(root);
  if (history[hIndex] === s) return;
  history = history.slice(0, hIndex + 1);
  history.push(s);
  if (history.length > 100) history.shift();
  hIndex = history.length - 1;
  updateUndoButtons();
}
let histTimer;
const pushHistorySoon = () => { clearTimeout(histTimer); histTimer = setTimeout(pushHistory, 400); };
function undoRedo(step) {
  clearTimeout(histTimer); pushHistory();
  const i = hIndex + step;
  if (i < 0 || i >= history.length) return;
  hIndex = i;
  root = JSON.parse(history[i]);
  levelIdx = Math.min(levelIdx, levelList().length - 1);
  project = levelList()[levelIdx];
  if (selectedId !== SCENE_ID && !ent(selectedId)) selectedId = null;
  syncSoundNames();
  rebuild(); refreshAll(); saveSoon(); updateUndoButtons(); updateCtxBar();
}
function updateUndoButtons() { $('#undoBtn').disabled = hIndex <= 0; $('#redoBtn').disabled = hIndex >= history.length - 1; }

/** Call after any edit. structure: object list / inspector layout changed. */
function changed({ structure = false, inspector = false } = {}) {
  requestRebuild();
  saveSoon();
  pushHistorySoon();
  if (structure) { renderHierarchy(); renderInspector(); updateCtxBar(); if (dockTab === 'scripts') renderScripts(); }
  else if (inspector) renderInspector();
  else { // a field changed: keep the prefab banner's "changed here" state current
    const j = ent(selectedId), old = j?.prefab && $('#inspector .pf-banner');
    if (old) old.replaceWith(prefabBanner(j) || '');
  }
}

// ============================================================================
// Engine in edit mode
// ============================================================================
const engine = new Engine({ parent: $('#viewport'), systemBack: false }); // the editor handles the phone's Back itself
engine.recordGraphs = true; // remember which Visual Script nodes ran, for the node editor's badges
engine.editing = true;
engine.showUI = true;
engine.input.enabled = false;
window.engine = engine;

const ent = (id) => project?.entities.find((e) => e.id === id);
const is3D = () => project.mode === '3d';
const hasVisual = (e) => !!(e.shape || e.mesh || e.text || e.sprite || e.voxels || e.tiles || e.model || e.bar);

let cam2d = { x: 200, y: 350, zoom: 0.85 };
let orbit = { yaw: 0.5, pitch: 0.8, dist: 22, target: { x: 0, y: 0, z: 0 } };
/** UI editor zoom / pan (only changes how the screen is shown while editing). */
const uiView = { z: 1, x: 0, y: 0 };
/**
 * The Scene view (2D, not the UI editor) shows the UI where it really is: laid out for the game's screen (its view size) and
 * drawn inside the camera frame, so it zooms and pans with the level. The engine asks for this frame each time it draws.
 */
let sceneUI = null;
engine.uiFrame = (s) => {
  sceneUI = null;
  engine.showUI = uiMode || !EP.hideUI; // Hide UI (Scene view): build the level without the HUD in the way
  if (uiMode || playing || s.mode === '3d' || !engine.showUI) return null;
  const v = s.view || { width: 400, height: 700 }, w = +v.width || 400, hh = +v.height || 700, R = engine.renderer;
  const a = R.worldToScreen(s, 0, 0), b = R.worldToScreen(s, w, hh), z = (b.x - a.x) / w;
  if (!(z > 0)) return null;
  sceneUI = { w, h: hh, safe: { top: 0, right: 0, bottom: 0, left: 0, k: 1 }, v: { z, x: a.x + w / 2 * z - w / 2, y: a.y + hh / 2 * z - hh / 2 }, clip: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } };
  return sceneUI;
};
/** The screen UI is laid out on, and how it's shown: the game's screen in the camera frame (Scene view), or the UI editor's view. */
const UIS = () => sceneUI || { w: engine.width, h: engine.height, safe: engine.safe, v: uiView };
const uiv = (x, y) => { const S = UIS(), V = S.v, cx = S.w / 2, cy = S.h / 2; return { x: (x - cx) * V.z + cx + V.x, y: (y - cy) * V.z + cy + V.y }; };
function zoomUI(k, mx = engine.width / 2, my = engine.height / 2) {
  const z = Math.min(5, Math.max(0.25, uiView.z * k)), cx = engine.width / 2, cy = engine.height / 2;
  const ux = (mx - cx - uiView.x) / uiView.z + cx, uy = (my - cy - uiView.y) / uiView.z + cy; // the point under the fingers stays put
  uiView.z = z; uiView.x = mx - cx - (ux - cx) * z; uiView.y = my - cy - (uy - cy) * z;
}
function resetCamera() {
  Object.assign(uiView, { z: 1, x: 0, y: 0 });
  const v = project.view || { width: 400, height: 700 };
  cam2d = { x: v.width / 2, y: v.height / 2, zoom: 0.85 };
  orbit = { yaw: 0.5, pitch: 0.8, dist: 22, target: { x: 0, y: 0, z: 0 } };
}

let rebuildQueued = false;
function requestRebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => { rebuildQueued = false; if (!playing) rebuild(); });
}
function rebuild() {
  engine.setScene(Scene.fromJSON(project, { editing: true }));
  fitEditorScreen();
  applyCamera();
}
/** The UI editor and Play show the game's screen in its own shape (a landscape box on a portrait phone, and the other way). */
function fitEditorScreen() {
  engine.letterbox = !!(uiMode || playing);
  engine.fitScreen();
}
const orientationOf = () => (root ? levelList()[0].settings?.orientation || 'any' : 'any');
/** Portrait or landscape for the whole game: every level's setting, and 2D screen sizes turned to match. */
function setOrientation(o) {
  for (const lv of levelList()) {
    lv.settings = { ...(lv.settings || {}), orientation: o };
    if (lv.mode === '3d' || o === 'any') continue;
    const v = (lv.view ||= { width: 400, height: 700 });
    if ((o === 'landscape') === (v.width > v.height)) continue;
    const ow = v.width, oh = v.height; v.width = oh; v.height = ow;
    for (const e of lv.entities || []) // a camera still sitting in the middle of the old screen moves to the middle of the new one
      if ((e.behaviors || []).some((b) => b.type === 'camera') && Math.abs((e.x || 0) - ow / 2) < 1 && Math.abs((e.y || 0) - oh / 2) < 1) { e.x = v.width / 2; e.y = v.height / 2; }
  }
  changed({ structure: true }); pushHistory(); renderInspector(); refreshOrientBtn();
  toast(o === 'any' ? 'Plays either way up' : `Now a ${o} game${is3D() ? '' : ` (${project.view.width} × ${project.view.height})`}`);
}
function orientationRow() {
  const cur = orientationOf();
  return h('div', { class: 'row full' }, h('label', {}, 'Game orientation'),
    h('div', { class: 'seg orient' }, [['portrait', 'Portrait', 'phone'], ['landscape', 'Landscape', 'phone'], ['any', 'Either', 'rotate']].map(([k, l, ic]) =>
      h('button', { class: (cur === k ? 'on ' : '') + k, onclick: () => setOrientation(k) }, icon(ic), l))));
}
function refreshOrientBtn() { const b = $('.orient-btn'); if (b) b.replaceChildren(icon(orientationOf() === 'any' ? 'rotate' : 'phone'), h('span', {}, { portrait: 'Portrait', landscape: 'Landscape', any: 'Either way' }[orientationOf()])); const ic = b?.querySelector('svg'); if (ic && orientationOf() === 'landscape') ic.style.transform = 'rotate(90deg)'; }
function applyCamera() {
  const s = engine.scene;
  if (!s || playing) return;
  if (s.mode === '2d') Object.assign(s.camera, { x: cam2d.x, y: cam2d.y, zoom: cam2d.zoom });
  else if (viewMode === 'top') { // straight down, no perspective: lay a 3D level out like a 2D map
    const o = orbit;
    s.camera.target = { ...o.target };
    s.camera.position = { x: o.target.x, y: o.target.y + 200, z: o.target.z };
    s.camera.ortho = true; s.camera.orthoSize = o.dist; s.camera.far = 1000;
    s.fog = { near: 400, far: 1000 };
  } else {
    const o = orbit, cp = Math.cos(o.pitch);
    s.camera.ortho = false;
    s.camera.target = { ...o.target };
    s.camera.position = { x: o.target.x + o.dist * cp * Math.sin(o.yaw), y: o.target.y + o.dist * Math.sin(o.pitch), z: o.target.z + o.dist * cp * Math.cos(o.yaw) };
    s.camera.far = 1000;
    s.fog = { near: 400, far: 1000 };
  }
}

function toScreen(e) {
  const s = engine.scene;
  if (s.mode === '2d') return engine.renderer.worldToScreen(s, e.x, e.y);
  const p = engine.renderer.worldToScreen(s, e.x, e.y, e.z);
  return p.behind ? null : p;
}
function boundsOf(e) {
  const ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy;
  let x = e.x;
  if (e.text && !e.shape && !e.sprite) x += e.text.align === 'left' ? hx : e.text.align === 'right' ? -hx : 0;
  if (ex.tiles) return { x: e.x + ex.ox, y: e.y + ex.oy, hx, hy, sphere: false };
  return { x, y: e.y, hx, hy, sphere: ex.sphere, r: ex.r };
}
function uiBounds(e) { // on screen, with the UI editor's zoom applied
  const S = UIS(), o = uiOrigin(e, S.w, S.h, S.safe), b = boundsOf(e), z = S.v.z, v = uiv(o.x + b.x, o.y + b.y);
  return { ...b, x: v.x, y: v.y, hx: b.hx * z, hy: b.hy * z, r: (b.r || 0) * z };
}
/** Screen-space center of an entity, for gizmos. */
function screenCenter(e) {
  if (e.ui) { const b = uiBounds(e); return { x: b.x, y: b.y }; }
  return toScreen(e);
}

// ---- scene view overlays ----
const ORANGE = '#f7a02c', AXIS = { x: '#e8453c', y: '#8bd347', z: '#3d7bf2' }, HOT = '#f5e14b';

engine.drawGrid = (ctx, s, z) => {
  if (!showGrid) return;
  const v = s.viewBounds(), step = z < 0.35 ? 100 : z > 2 ? 10 : 50;
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  for (let x = Math.floor(v.left / step) * step; x < v.right; x += step) { ctx.moveTo(x, v.top); ctx.lineTo(x, v.bottom); }
  for (let y = Math.floor(v.top / step) * step; y < v.bottom; y += step) { ctx.moveTo(v.left, y); ctx.lineTo(v.right, y); }
  ctx.stroke();
};

const GRID3D = (() => { const p = []; for (let i = -30; i <= 30; i++) p.push(i, 0.01, -30, i, 0.01, 30, -30, 0.01, i, 30, 0.01, i); return p; })();

function toggleColliders(on = !showColliders) { showColliders = on; store.set('pocket.editor.colliders', on ? '1' : ''); engine.render(); renderInspector(); toast(on ? 'Showing every collider (green)' : 'Collider outlines only on the selected object'); }
const COLLIDER_GREEN = '#39ff8f', TRIGGER_GREEN = '#b9f6ca';
/** Objects whose collider outline shows: all of them with "Show colliders" on, otherwise only the selected one. */
const colliderShown = (s, sel) => s.entities.filter((e) => e.body && !e.ui && !e.dead && !e._parentHidden && (showColliders || e === sel) && !(e === sel && colliderEdit === selectedId && !is3D()));
const BOX_EDGES = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
engine.onRenderWorld = (r, s, z) => {
  if (playing) return;
  const sel = s.byId(selectedId), hover = s.byId(dropHoverId);
  if (s.mode === '2d') {
    const ctx = r;
    for (const e of colliderShown(s, sel)) { // collider outlines (green; triggers dashed)
      const ex = e.extents(); if (!Number.isFinite(ex.hx ?? ex.r)) continue;
      ctx.save(); ctx.strokeStyle = e.body.sensor ? TRIGGER_GREEN : COLLIDER_GREEN; ctx.globalAlpha = e === sel ? 1 : 0.85; ctx.lineWidth = (e === sel ? 2.5 : 1.75) / z;
      if (e.body.sensor) ctx.setLineDash([5 / z, 4 / z]);
      ctx.translate(e.x + (ex.ox || 0), e.y + (ex.oy || 0)); ctx.beginPath();
      if (ex.sphere) ctx.arc(0, 0, ex.r, 0, Math.PI * 2);
      else if (ex.kind) { ctx.rotate(ex.rot || 0); ex.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); if (ex.kind !== 'edge') ctx.closePath(); else for (const [px, py] of ex.pts) { ctx.moveTo(px + 3 / z, py); ctx.arc(px, py, 3 / z, 0, Math.PI * 2); } }
      else { ctx.rotate(ex.rot || 0); ctx.rect(-ex.hx, -ex.hy, ex.hx * 2, ex.hy * 2); }
      ctx.stroke(); ctx.restore();
    }
    // game camera frame
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 / z;
    ctx.strokeRect(0, 0, s.view.width, s.view.height);
    // Camera objects: dashed frame of what they see; selected lights: their range
    for (const pe of project.entities) {
      const cam = (pe.behaviors || []).find((b) => b.type === 'camera');
      if (!cam || pe.ui) continue;
      const zm = +cam.zoom || 1, w = s.view.width / zm, hgt = s.view.height / zm;
      ctx.save(); ctx.setLineDash([8 / z, 6 / z]); ctx.strokeStyle = pe.id === selectedId ? ORANGE : 'rgba(140,200,255,0.7)'; ctx.lineWidth = 1.5 / z;
      ctx.strokeRect((pe.x || 0) - w / 2, (pe.y || 0) - hgt / 2, w, hgt); ctx.restore();
    }
    if (multi) for (const id of multi) { // objects ticked in the Hierarchy's Select mode
      const e = s.byId(id); if (!e || e.ui) continue;
      const b = boundsOf(e), pad = 4 / z;
      ctx.save(); ctx.setLineDash([6 / z, 4 / z]); ctx.strokeStyle = ORANGE; ctx.lineWidth = 2 / z;
      if (b.sphere) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r + pad, 0, Math.PI * 2); ctx.stroke(); } else ctx.strokeRect(b.x - b.hx - pad, b.y - b.hy - pad, (b.hx + pad) * 2, (b.hy + pad) * 2);
      ctx.restore();
    }
    if (sel?.tiles && tool === 'paint') { // the tile grid while painting
      const T = sel.tiles, sz = T.size, inv = ctx.getTransform().inverse(), W = ctx.canvas.width, H = ctx.canvas.height;
      const p0 = inv.transformPoint({ x: 0, y: 0 }), p1 = inv.transformPoint({ x: W, y: H });
      const i0 = Math.floor((Math.min(p0.x, p1.x) - sel.x) / sz), i1 = Math.ceil((Math.max(p0.x, p1.x) - sel.x) / sz), j0 = Math.floor((Math.min(p0.y, p1.y) - sel.y) / sz), j1 = Math.ceil((Math.max(p0.y, p1.y) - sel.y) / sz);
      if ((i1 - i0) * (j1 - j0) < 40000) {
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 1 / z; ctx.beginPath();
        for (let i = i0; i <= i1; i++) { ctx.moveTo(sel.x + i * sz, sel.y + j0 * sz); ctx.lineTo(sel.x + i * sz, sel.y + j1 * sz); }
        for (let j = j0; j <= j1; j++) { ctx.moveTo(sel.x + i0 * sz, sel.y + j * sz); ctx.lineTo(sel.x + i1 * sz, sel.y + j * sz); }
        ctx.stroke(); ctx.restore();
      }
    }
    if (sel?.light) { ctx.save(); ctx.setLineDash([5 / z, 5 / z]); ctx.strokeStyle = 'rgba(255,220,140,0.8)'; ctx.lineWidth = 1.5 / z; ctx.beginPath(); ctx.arc(sel.x, sel.y, sel.light.range, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    for (const [e, col] of [[hover, '#4c8bd6'], [sel, ORANGE]]) {
      if (!e || e.ui) continue;
      const b = boundsOf(e), pad = 3 / z;
      ctx.strokeStyle = col; ctx.lineWidth = 2 / z;
      if (b.sphere) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r + pad, 0, Math.PI * 2); ctx.stroke(); }
      else {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate((e.rz || 0) * Math.PI / 180);
        ctx.strokeRect(b.x - e.x - b.hx - pad, -b.hy - pad, b.hx * 2 + pad * 2, b.hy * 2 + pad * 2);
        ctx.restore();
      }
    }
  } else {
    if (showGrid) {
      r.drawLines(GRID3D, '#ffffff', 0.16);
      r.drawLines([-30, 0.02, 0, 30, 0.02, 0], AXIS.x, 0.55);
      r.drawLines([0, 0.02, -30, 0, 0.02, 30], AXIS.z, 0.55);
    }
    if (sel?.model && selectedPart >= 0 && sel.model.parts[selectedPart]) { // highlight the part being edited
      const q = sel.model.parts[selectedPart], [gx, gy, gz] = partSize(q);
      const M = M4.mul(M4.trs(sel.x, sel.y, sel.z, sel.rx * DEG, sel.ry * DEG, sel.rz * DEG, sel.sx, sel.sy, sel.sz), M4.trs(q.x || 0, q.y || 0, q.z || 0, (q.rx || 0) * DEG, (q.ry || 0) * DEG, (q.rz || 0) * DEG, gx * 1.06, Math.max(gy, 0.02) * 1.06, gz * 1.06));
      const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => { const p = M4.transformPoint(M, a / 2, b / 2, d / 2); return [p.x, p.y, p.z]; });
      const pts = [];
      for (const [i, k] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[i], ...c[k]);
      const gl = r.gl; gl.disable(gl.DEPTH_TEST); r.drawLines(pts, '#ffeb3b'); gl.enable(gl.DEPTH_TEST);
    }
    for (const e of colliderShown(s, sel)) { // 3D collider wireframes
      const ex = e.extents(), cx = e.x + (ex.ox || 0), cy = e.y + (ex.oy || 0), cz = e.z + (ex.oz || 0), pts = [], grow = 1.03; // a hair bigger so the lines don't hide in the faces
      if (ex.voxel || !Number.isFinite(ex.sphere ? ex.r : ex.hz)) continue;
      if (ex.sphere) {
        const R = ex.r * grow, N = 32;
        for (let i = 0; i < N; i++) {
          const a = (i / N) * Math.PI * 2, b = ((i + 1) / N) * Math.PI * 2, ca = Math.cos(a) * R, sa = Math.sin(a) * R, cb = Math.cos(b) * R, sb = Math.sin(b) * R;
          pts.push(cx + ca, cy + sa, cz, cx + cb, cy + sb, cz, cx + ca, cy, cz + sa, cx + cb, cy, cz + sb, cx, cy + ca, cz + sa, cx, cy + cb, cz + sb);
        }
      } else if (ex.kind === 'capsule' || ex.kind === 'cylinder') { // rings at the ends (domes for a capsule) joined by four lines
        const R = ex.r * grow + 0.01, N = 32, top = ex.kind === 'capsule' ? ex.half : ex.hy * grow + 0.01, ring = (y) => { for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2; pts.push(cx + Math.cos(a) * R, y, cz + Math.sin(a) * R, cx + Math.cos(b) * R, y, cz + Math.sin(b) * R); } };
        ring(cy + top); ring(cy - top);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pts.push(cx + dx * R, cy - top, cz + dz * R, cx + dx * R, cy + top, cz + dz * R);
        if (ex.kind === 'capsule') for (const sgn of [1, -1]) for (const [ux, uz] of [[1, 0], [0, 1]]) for (let i = 0; i < N / 2; i++) { // half circles over each end
          const a = i / N * Math.PI * 2, b = (i + 1) / N * Math.PI * 2;
          pts.push(cx + Math.cos(a) * R * ux, cy + sgn * (top + Math.sin(a) * R), cz + Math.cos(a) * R * uz, cx + Math.cos(b) * R * ux, cy + sgn * (top + Math.sin(b) * R), cz + Math.cos(b) * R * uz);
        }
      } else {
        const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => [cx + a * (ex.hx * grow + 0.01), cy + b * (ex.hy * grow + 0.01), cz + d * (ex.hz * grow + 0.01)]);
        for (const [i, k] of BOX_EDGES) pts.push(...c[i], ...c[k]);
      }
      const gl = r.gl; if (e === sel) gl.disable(gl.DEPTH_TEST);
      r.drawLines(pts, e.body.sensor ? TRIGGER_GREEN : COLLIDER_GREEN, e === sel ? 1 : 0.75);
      if (e === sel) gl.enable(gl.DEPTH_TEST);
    }
    for (const [e, col] of [[hover, '#4c8bd6'], [sel, ORANGE]]) {
      if (!e || e.ui || !(e.mesh || e.model)) continue;
      const ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy, hz = ex.sphere ? ex.r : ex.hz, cx = e.x + (ex.ox || 0), cy = e.y + (ex.oy || 0), cz = e.z + (ex.oz || 0);
      const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => [cx + a * hx * 1.04, cy + b * hy * 1.04, cz + d * hz * 1.04]);
      const pts = [];
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[i], ...c[j]);
      r.drawLines(pts, col);
    }
  }
};

engine.onRenderUI = (ctx, s) => {
  if (playing) { // play-mode Inspect: ring the inspected object
    const e = inspectId && s.byId(inspectId);
    if (e && !e.dead) {
      const p = e.ui ? uiBounds(e) : toScreen(e); if (!p) return;
      let hx = 24, hy = 24;
      if (!is3D() && !e.ui) { const b = boundsOf(e), z = engine.renderer.zoomFor(s); hx = (b.sphere ? b.r : b.hx) * z + 6; hy = (b.sphere ? b.r : b.hy) * z + 6; }
      ctx.save(); ctx.strokeStyle = ORANGE; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]); ctx.strokeRect(p.x - hx, p.y - hy, hx * 2, hy * 2); ctx.restore();
    }
    return;
  }
  const ce = colliderEdit === selectedId && s.byId(colliderEdit);
  if (ce?.body && !is3D()) { // Edit Collider: green outline with handles
    const f = colliderFrame(ce);
    ctx.save(); ctx.strokeStyle = '#69f0ae'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(105,240,174,0.12)';
    ctx.beginPath();
    if (f.sphere) ctx.arc(f.c.x, f.c.y, f.r, 0, Math.PI * 2);
    else if (f.pts) { f.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); if (f.closed) ctx.closePath(); }
    else { const p = [f.at(-f.hx, -f.hy), f.at(f.hx, -f.hy), f.at(f.hx, f.hy), f.at(-f.hx, f.hy)]; ctx.moveTo(p[0].x, p[0].y); for (const q of p.slice(1)) ctx.lineTo(q.x, q.y); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    for (const [part, q] of f.handles) {
      ctx.beginPath();
      if (part[0] === 'p') { ctx.arc(q.x, q.y, 8, 0, Math.PI * 2); ctx.fillStyle = '#69f0ae'; ctx.fill(); ctx.strokeStyle = '#0b3d27'; ctx.stroke(); ctx.strokeStyle = '#69f0ae'; }
      else if (part === 'c') { ctx.arc(q.x, q.y, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(105,240,174,0.35)'; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(q.x - 5, q.y); ctx.lineTo(q.x + 5, q.y); ctx.moveTo(q.x, q.y - 5); ctx.lineTo(q.x, q.y + 5); ctx.stroke(); }
      else { ctx.rect(q.x - 8, q.y - 8, 16, 16); ctx.fillStyle = '#69f0ae'; ctx.fill(); ctx.strokeStyle = '#0b3d27'; ctx.stroke(); ctx.strokeStyle = '#69f0ae'; }
    }
    ctx.restore();
  }
  // invisible logic objects
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of s.entities) {
    if (e.ui || hasVisual(e)) continue;
    const p = toScreen(e); if (!p) continue;
    const isSel = e.id === selectedId;
    ctx.fillStyle = isSel ? 'rgba(247,160,44,0.25)' : 'rgba(30,30,30,0.6)';
    ctx.strokeStyle = isSel ? ORANGE : 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(p.x - 12, p.y - 12, 24, 24); ctx.fill(); ctx.stroke();
    const pe = ent(e.id), glyph = (pe?.behaviors || []).some((b) => b.type === 'camera') ? '🎥' : e.sun || e.globalLight ? '☀️' : e.light ? '💡' : '';
    if (glyph) { ctx.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.fillText(glyph, p.x, p.y + 1); }
    else {
      ctx.strokeStyle = isSel ? ORANGE : '#cfcfcf'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6); ctx.lineTo(p.x + Math.cos(a) * 8.5, p.y + Math.sin(a) * 8.5); }
      ctx.stroke();
    }
    if (isSel || EP.labels === 'always') { ctx.font = '11px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = 'rgba(230,230,230,0.85)'; ctx.fillText(e.name, p.x, p.y + 22); } // names of cameras, lights and empties only when selected (less clutter)
  }
  // smart guides while dragging (2D), and where the object is
  if (sceneGuide && !is3D()) {
    ctx.save(); ctx.strokeStyle = '#ff5ad1'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath();
    if (sceneGuide.x != null) { const q = engine.renderer.worldToScreen(s, sceneGuide.x, 0); ctx.moveTo(q.x, 0); ctx.lineTo(q.x, engine.height); }
    if (sceneGuide.y != null) { const q = engine.renderer.worldToScreen(s, 0, sceneGuide.y); ctx.moveTo(0, q.y); ctx.lineTo(engine.width, q.y); }
    ctx.stroke(); ctx.restore();
  }
  if (gesture?.moved && (gesture.type === 'free' || gesture.type === 'axis') && !gesture.ui) {
    const j = ent(gesture.id), e = s.byId(gesture.id), p = e && toScreen(e);
    if (j && p) {
      const txt = is3D() ? `x ${round(j.x || 0, 1)} · z ${round(j.z || 0, 1)}` : `x ${Math.round(j.x || 0)} · y ${Math.round(j.y || 0)}`;
      ctx.save(); ctx.font = '700 12px system-ui, sans-serif'; const tw = ctx.measureText(txt).width + 16, ly = p.y - 46 < 70 ? p.y + 46 : p.y - 46;
      ctx.fillStyle = 'rgba(20,20,26,0.88)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(p.x - tw / 2, ly - 11, tw, 22, 11); else ctx.rect(p.x - tw / 2, ly - 11, tw, 22); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, p.x, ly + 0.5); ctx.restore();
    }
  }
  placeCtxBar(s);
  const sel = s.byId(selectedId);
  if (sel?.ui && !playing) { // Unity-style anchor marker: where the element is pinned, and its parent's box
    const S = UIS(), o = uiOrigin(sel, S.w, S.h, S.safe), a = uiv(o.x, o.y), b0 = uiBounds(sel);
    if (sel.parentEnt?.ui) { const pb = uiBounds(sel.parentEnt); ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(126,200,255,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(pb.x - pb.hx, pb.y - pb.hy, pb.hx * 2, pb.hy * 2); ctx.restore(); }
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b0.x, b0.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2f6db5'; ctx.lineWidth = 1.5;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(a.x + dx * 2, a.y + dy * 2); ctx.lineTo(a.x + dx * 11, a.y + dy * 5); ctx.lineTo(a.x + dx * 5, a.y + dy * 11); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  if (sel?.ui) {
    const b = uiBounds(sel);
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 2;
    ctx.strokeRect(b.x - b.hx - 3, b.y - b.hy - 3, b.hx * 2 + 6, b.hy * 2 + 6);
  }
  if (sel && tool !== 'hand') drawGizmo(ctx, sel);
  if (dnd?.started && dnd.payload.kind === 'prefab' && dnd.overScene) {
    ctx.strokeStyle = '#4c8bd6'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(dnd.lx, dnd.ly, 14, 0, Math.PI * 2); ctx.moveTo(dnd.lx - 20, dnd.ly); ctx.lineTo(dnd.lx + 20, dnd.ly); ctx.moveTo(dnd.lx, dnd.ly - 20); ctx.lineTo(dnd.lx, dnd.ly + 20); ctx.stroke();
  }
};

// ============================================================================
// Transform gizmos (move / rotate / scale)
// ============================================================================
const GIZ = 84;
/** Screen-space axes for the selected entity: [{ k, dx, dy, ppu, sign }] */
// ---- Rect tool (like Unity's): resize UI and 2D objects by their edges and corners ----
const RECT_HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
/** Screen rectangle of an entity for the Rect tool: centre, half sizes and pixels per unit. */
function rectFrame(e) {
  if (e.ui) { const b = uiBounds(e); return { cx: b.x, cy: b.y, hw: b.sphere ? b.r : b.hx, hh: b.sphere ? b.r : b.hy, k: UIS().v.z }; }
  if (is3D()) return null;
  const b = boundsOf(e), z = engine.renderer.zoomFor(engine.scene), p = engine.renderer.worldToScreen(engine.scene, b.x, b.y);
  return { cx: p.x, cy: p.y, hw: (b.sphere ? b.r : b.hx) * z, hh: (b.sphere ? b.r : b.hy) * z, k: z };
}
/** Editable size of an object: [width, height, square?] (shape, image, bar, minimap; text by font size). */
function sizeOf(j) {
  if (j.minimap) return [j.minimap.w ?? 120, j.minimap.h ?? 120, false];
  if (j.shape) return ['circle', 'ring'].includes(j.shape.type) ? [(j.shape.r ?? 20) * 2, (j.shape.r ?? 20) * 2, true] : [j.shape.w ?? 40, j.shape.h ?? 40, false];
  if (j.sprite) return [j.sprite.w ?? 64, j.sprite.h ?? 64, false];
  if (j.bar) return [j.bar.w ?? 160, j.bar.h ?? 16, j.bar.style === 'ring'];
  if (j.text) { const sz = j.text.size ?? 24; return [String(j.text.value || '').length * sz * 0.6, sz * 1.2, true]; }
  return null;
}
function setSize(j, w, hgt) {
  w = Math.max(4, Math.round(w)); hgt = Math.max(4, Math.round(hgt));
  if (j.minimap) Object.assign(j.minimap, { w, h: hgt });
  if (j.shape) { if (['circle', 'ring'].includes(j.shape.type)) j.shape.r = Math.round(Math.min(w, hgt) / 2); else Object.assign(j.shape, { w, h: hgt }); }
  if (j.sprite) Object.assign(j.sprite, { w, h: hgt });
  if (j.bar) Object.assign(j.bar, { w, h: hgt });
  if (j.text && !j.shape && !j.sprite && !j.bar && !j.minimap) j.text.size = Math.max(6, Math.round(hgt / 1.2));
}

function gizmoAxes(e) {
  const s = engine.scene, o = screenCenter(e);
  if (!o) return null;
  if (e.ui) return { o, axes: [{ k: 'x', dx: 1, dy: 0, ppu: UIS().v.z, sign: 1 }, { k: 'y', dx: 0, dy: -1, ppu: UIS().v.z, sign: -1 }] };
  if (s.mode === '2d') {
    const z = engine.renderer.zoomFor(s);
    return { o, axes: [{ k: 'x', dx: 1, dy: 0, ppu: z, sign: 1 }, { k: 'y', dx: 0, dy: -1, ppu: z, sign: -1 }] };
  }
  const axes = [];
  for (const k of ['x', 'y', 'z']) {
    const p = engine.renderer.worldToScreen(s, e.x + (k === 'x'), e.y + (k === 'y'), e.z + (k === 'z'));
    const vx = p.x - o.x, vy = p.y - o.y, ppu = Math.hypot(vx, vy);
    if (ppu < 3 || p.behind) continue;
    axes.push({ k, dx: vx / ppu, dy: vy / ppu, ppu, sign: 1 });
  }
  return { o, axes };
}

function drawGizmo(ctx, e) {
  if (tool === 'rect') { const f = rectFrame(e); if (f) { drawRectGizmo(ctx, f, e); return; } }
  const g = gizmoAxes(e); if (!g) return;
  const { o } = g, active = gesture?.handle;
  ctx.lineCap = 'round';
  if (tool === 'rotate') {
    const r = GIZ * 0.8;
    ctx.strokeStyle = active === 'rot' ? HOT : (is3D() && !e.ui ? AXIS.y : AXIS.z); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(o.x, o.y, r + 7, 0, Math.PI * 2); ctx.stroke();
    if (gesture?.type === 'rotate') {
      ctx.fillStyle = 'rgba(245,225,75,0.18)';
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.arc(o.x, o.y, r, gesture.a0, gesture.a1, gesture.a1 < gesture.a0); ctx.closePath(); ctx.fill();
    }
    return;
  }
  for (const a of g.axes) {
    const ex = o.x + a.dx * GIZ, ey = o.y + a.dy * GIZ, col = active === a.k ? HOT : AXIS[a.k];
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(o.x + a.dx * 10, o.y + a.dy * 10); ctx.lineTo(ex, ey); ctx.stroke();
    if (tool === 'move') {
      const px = -a.dy, py = a.dx;
      ctx.beginPath(); ctx.moveTo(ex + a.dx * 12, ey + a.dy * 12); ctx.lineTo(ex + px * 6, ey + py * 6); ctx.lineTo(ex - px * 6, ey - py * 6); ctx.closePath(); ctx.fill();
    } else ctx.fillRect(ex - 6, ey - 6, 12, 12);
  }
  ctx.fillStyle = active === 'free' ? 'rgba(245,225,75,0.6)' : 'rgba(220,220,220,0.35)';
  ctx.strokeStyle = active === 'free' ? HOT : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
  ctx.fillRect(o.x - 8, o.y - 8, 16, 16); ctx.strokeRect(o.x - 8, o.y - 8, 16, 16);
}

function drawRectGizmo(ctx, f) {
  const { cx, cy, hw, hh } = f, live = gesture?.type === 'rect';
  ctx.save();
  ctx.strokeStyle = '#4c8bd6'; ctx.lineWidth = 2; ctx.setLineDash([]);
  ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
  for (const [i, j] of RECT_HANDLES) {
    const x = cx + i * hw, y = cy + j * hh, hot = live && gesture.dir[0] === i && gesture.dir[1] === j;
    ctx.fillStyle = hot ? HOT : '#ffffff'; ctx.strokeStyle = '#2f6db5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(x - 7, y - 7, 14, 14); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(76,139,214,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
  if (live && gesture.label) {
    ctx.font = '700 13px system-ui, sans-serif'; const tw = ctx.measureText(gesture.label).width + 16, ly = cy - hh - 30 < 110 ? cy + hh + 30 : cy - hh - 30;
    ctx.fillStyle = 'rgba(20,20,26,0.9)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx - tw / 2, ly - 12, tw, 24, 8); else ctx.rect(cx - tw / 2, ly - 12, tw, 24); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(gesture.label, cx, ly);
  }
  ctx.restore();
}


/** Smart guides (2D): while dragging, the object's centre and edges snap to other objects' centres and edges, with a line to show it. */
let sceneGuide = null, lastObjTap = { id: null, t: 0 };
function snapScene2D(j, live, z) {
  sceneGuide = null;
  if (!live) return;
  const ex = live.extents(), hw = ex.sphere ? ex.r : ex.hx, hh = ex.sphere ? ex.r : ex.hy, T = 7 / z;
  let bx = null, by = null;
  for (const q of engine.scene.entities) {
    if (q === live || q.ui || q.dead || q.parentEnt || !q.visible || q.tiles || !hasVisual(q)) continue;
    const qe = q.extents(), qw = qe.sphere ? qe.r : qe.hx, qh = qe.sphere ? qe.r : qe.hy;
    if (qw > 4000 || qh > 4000) continue; // backgrounds
    for (const [mine, theirs] of [[0, 0], [-hw, -qw], [hw, qw], [-hw, qw], [hw, -qw]]) { const d = (q.x + theirs) - (j.x + mine); if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: q.x + theirs }; }
    for (const [mine, theirs] of [[0, 0], [-hh, -qh], [hh, qh], [-hh, qh], [hh, -qh]]) { const d = (q.y + theirs) - (j.y + mine); if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: q.y + theirs }; }
  }
  if (bx || by) {
    sceneGuide = {};
    if (bx) { j.x = round(j.x + bx.d, 2); sceneGuide.x = bx.at; }
    if (by) { j.y = round(j.y + by.d, 2); sceneGuide.y = by.at; }
    if (!sceneGuide._buzzed) buzz(4);
  }
}
/** Double-tap an object in the Scene: a text gets its words edited right away; anything else opens in the Inspector. */
function quickEdit(id) {
  const j = ent(id); if (!j) return;
  if (j.text && !(j.behaviors || []).some((b) => ['uiInput', 'uiDataList', 'uiForm'].includes(b.type))) {
    const v = prompt('Text', j.text.value ?? '');
    if (v != null && v !== j.text.value) { j.text.value = v; pushHistory(); changed({ structure: false }); renderInspector(); toast('Text changed'); }
    return;
  }
  setDock('inspector'); buzz(8);
}
/** Which gizmo handle is under a screen point, if any. */
/** The selected object's 2D collider on screen: centre, half sizes (or radius) and angle, plus its handles. */
function colliderFrame(e) {
  const ex = e.extents(), z = engine.renderer.zoomFor(engine.scene), c = engine.renderer.worldToScreen(engine.scene, e.x + (ex.ox || 0), e.y + (ex.oy || 0));
  const rot = ex.rot || 0, cs = Math.cos(rot), sn = Math.sin(rot), at = (lx, ly) => ({ x: c.x + (lx * cs - ly * sn), y: c.y + (lx * sn + ly * cs) });
  if (ex.sphere) { const r = ex.r * z; return { c, sphere: true, r, rot, handles: [['rad', at(r, 0)], ['c', c]] }; }
  const hx = ex.hx * z, hy = ex.hy * z, pts = ex.kind ? ex.pts.map(([px, py]) => at(px * z, py * z)) : null, closed = ex.kind !== 'edge';
  if (ex.kind && e.body.shape !== 'capsule') return { c, hx, hy, rot, at, pts, closed, handles: [...pts.map((q, i) => ['p' + i, q]), ['c', c]] }; // polygon / edge: drag the corners
  return { c, hx, hy, rot, at, pts, closed, handles: [['r', at(hx, 0)], ['l', at(-hx, 0)], ['b', at(0, hy)], ['t', at(0, -hy)], ['c', c]] };
}
function hitGizmo(x, y) {
  const sel = engine.scene?.byId(selectedId);
  if (!sel || tool === 'hand') return null;
  if (colliderEdit === selectedId && sel.body && !is3D()) { // Edit Collider: its handles come first
    const f = colliderFrame(sel);
    let best = null, bd = 28;
    for (const [part, q] of f.handles) { const d = Math.hypot(x - q.x, y - q.y); if (d < bd) { bd = d; best = part; } }
    if (best) return { handle: 'collider', part: best, g: { o: f.c } };
  }
  if (tool === 'rect') {
    const f = rectFrame(sel);
    if (f) {
      let best = null, bd = 26;
      for (const dir of RECT_HANDLES) { const d = Math.hypot(x - (f.cx + dir[0] * f.hw), y - (f.cy + dir[1] * f.hh)); if (d < bd) { bd = d; best = dir; } }
      if (best) return { handle: 'rect', dir: best, f, g: { o: { x: f.cx, y: f.cy } } };
      if (Math.abs(x - f.cx) < f.hw && Math.abs(y - f.cy) < f.hh) return { handle: 'free', g: { o: { x: f.cx, y: f.cy } } };
      return null;
    }
  }
  const g = gizmoAxes(sel); if (!g) return null;
  const { o } = g, d = Math.hypot(x - o.x, y - o.y);
  if (tool === 'rotate') return Math.abs(d - GIZ * 0.8) < 22 ? { handle: 'rot', g } : null;
  if (Math.abs(x - o.x) < 14 && Math.abs(y - o.y) < 14) return { handle: 'free', g };
  for (const a of g.axes) {
    const t = (x - o.x) * a.dx + (y - o.y) * a.dy;
    if (t < 12 || t > GIZ + 16) continue;
    const perp = Math.abs((x - o.x) * -a.dy + (y - o.y) * a.dx);
    if (perp < 16) return { handle: a.k, axis: a, g };
  }
  return null;
}

// ============================================================================
// Picking
// ============================================================================
function pick(sx, sy) {
  const s = engine.scene, list = s.entities.slice().reverse().filter((e) => !ent(e.id)?.locked && (!uiMode || e.ui) && (uiMode || !e.ui || !EP.hideUI)); // hidden UI can't be tapped
  for (const e of list) {
    if (!e.ui) continue;
    const b = uiBounds(e);
    if (Math.abs(sx - b.x) <= b.hx + 6 && Math.abs(sy - b.y) <= b.hy + 6) return e;
  }
  for (const e of list) {
    if (e.ui || hasVisual(e)) continue;
    const p = toScreen(e);
    if (p && Math.abs(sx - p.x) < 18 && Math.abs(sy - p.y) < 18) return e;
  }
  if (s.mode === '2d') {
    const w = engine.renderer.screenToWorld(s, sx, sy), pad = 6 / engine.renderer.zoomFor(s);
    for (const e of list) {
      if (e.ui || !hasVisual(e)) continue;
      if (e.tiles) { if (e.tiles.at(e, w.x, w.y) || (tool === 'paint' && e.id === selectedId)) return e; continue; } // empty cells don't grab the finger
      const b = boundsOf(e);
      if (b.sphere ? Math.hypot(w.x - b.x, w.y - b.y) <= b.r + pad : Math.abs(w.x - b.x) <= b.hx + pad && Math.abs(w.y - b.y) <= b.hy + pad) return e;
    }
    return null;
  }
  const ray = engine.renderer.screenRay(s, sx, sy);
  let best = null, bestT = Infinity;
  for (const e of list) {
    if (e.voxels) { // huge terrain: only grab it with the brush, so dragging the view still orbits
      if (tool !== 'paint') continue;
      const hv = e.voxels.raycast(e, ray.origin, ray.dir, 400); if (hv && hv.dist < bestT) { bestT = hv.dist; best = e; } continue;
    }
    if (e.ui || !(e.mesh || e.model)) continue;
    const t = rayHit(ray, e);
    if (t != null && t < bestT) { bestT = t; best = e; }
  }
  return best;
}
function rayHit({ origin: o, dir: d }, e0) {
  const ex = e0.extents(), e = { x: e0.x + (ex.ox || 0), y: e0.y + (ex.oy || 0), z: e0.z + (ex.oz || 0) };
  if (ex.sphere) {
    const ox = o.x - e.x, oy = o.y - e.y, oz = o.z - e.z;
    const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - ex.r * ex.r, disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t >= 0 ? t : null;
  }
  let tmin = -Infinity, tmax = Infinity;
  for (const [a, hk] of [['x', 'hx'], ['y', 'hy'], ['z', 'hz']]) {
    const half = Math.max(ex[hk], 0.05), lo = e[a] - half, hi = e[a] + half;
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo || o[a] > hi) return null; continue; }
    let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmax < 0 ? null : Math.max(tmin, 0);
}
function rayPlaneY(ray, y) {
  if (Math.abs(ray.dir.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.dir.y;
  if (t < 0) return null;
  return { x: ray.origin.x + ray.dir.x * t, z: ray.origin.z + ray.dir.z * t };
}

// ============================================================================
// Scene view gestures
// ============================================================================
const surface = engine.uiCanvas;
const ptrs = new Map();
let gesture = null;
const snapV = (v, step) => { if (!snap) return round(v, 2); const st = step === 10 ? +EP.snap2D || 10 : step === 0.5 ? +EP.snap3D || 0.5 : step; return round(Math.round(v / st) * st, 3); }; // steps from Preferences
const localXY = (ev) => { const r = surface.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };

let tapTrack = null, lastEmptyTap = 0, lpTimer = 0;
const LONG_PRESS = 520;
function armLongPress(fn) { clearTimeout(lpTimer); lpTimer = setTimeout(() => { lpTimer = 0; fn(); }, LONG_PRESS); }
const cancelLongPress = () => { clearTimeout(lpTimer); lpTimer = 0; };

surface.addEventListener('pointerdown', (ev) => {
  if (playing) return;
  surface.setPointerCapture(ev.pointerId);
  const { x, y } = localXY(ev);
  ptrs.set(ev.pointerId, { x, y, sx: x, sy: y });
  if (ptrs.size === 1) tapTrack = { t0: performance.now(), max: 1, moved: false };
  else if (tapTrack) tapTrack.max = Math.max(tapTrack.max, ptrs.size);
  if (ptrs.size > 1) cancelLongPress();
  $('#hint').hidden = true;
  if (ptrs.size === 1 && tool === 'paint' && ent(selectedId)?.tiles && !is3D()) {
    gesture = { type: 'tile', id: selectedId, last: '', count: 0 };
    tilePaint(x, y);
    return;
  }
  if (ptrs.size === 1 && tool === 'paint' && ent(selectedId)?.voxels) {
    gesture = { type: 'voxel', id: selectedId, last: '', count: 0 };
    voxelPaint(x, y);
    return;
  }
  if (ptrs.size === 1 && tool === 'paint' && ev.button === 0 && !ev.altKey) {
    const src = ent(selectedId);
    if (!src || src.ui) { toast('Select an object first, then paint copies of it'); gesture = { type: 'pan', lx: x, ly: y, sx: x, sy: y, moved: true }; return; }
    gesture = { type: 'paint', srcId: src.id, last: null, count: 0 };
    paintAt(x, y);
    return;
  }
  if (ptrs.size === 1 && attachFor) { // Attach mode: this tap picks the new parent (empty space cancels)
    const hit = pick(x, y);
    endAttach(hit ? hit.id : null);
    gesture = { type: 'pan', lx: x, ly: y, sx: x, sy: y, moved: true };
    return;
  }
  if (ptrs.size === 1) {
    const panBtn = ev.button === 1 || ev.button === 2 || ev.altKey;
    const giz = !panBtn && hitGizmo(x, y);
    if (giz) {
      beginTransform(giz, x, y);
      if (giz.handle === 'free') armLongPress(() => { if (gesture && !gesture.moved) { const id = gesture.id; gesture = null; buzz(15); openObjectMenu(id, x, y); } });
      return;
    }
    const hit = panBtn || tool === 'hand' ? null : pick(x, y);
    if (hit) {
      const was = selectedId === hit.id;
      select(hit.id, { fromScene: true });
      const j = ent(hit.id);
      if (tool === 'rotate' || tool === 'scale') { gesture = { type: 'tap', id: hit.id, sx: x, sy: y, moved: false, was }; return; }
      gesture = { type: 'free', id: hit.id, sx: x, sy: y, orig: { x: j.x || 0, y: j.y || 0, z: j.z || 0 }, ui: !!j.ui, moved: false };
      armLongPress(() => { if (gesture?.id === hit.id && !gesture.moved) { gesture = null; buzz(15); openObjectMenu(hit.id, x, y); } });
      if (is3D() && !j.ui) {
        const p = rayPlaneY(engine.renderer.screenRay(engine.scene, x, y), gesture.orig.y);
        gesture.grab = p ? { x: p.x - gesture.orig.x, z: p.z - gesture.orig.z } : { x: 0, z: 0 };
      }
    } else {
      const orbitMode = is3D() && !panBtn && !ev.shiftKey;
      gesture = { type: orbitMode ? 'orbit' : 'pan', lx: x, ly: y, sx: x, sy: y, moved: false };
      armLongPress(() => { if (gesture && !gesture.moved && (gesture.type === 'pan' || gesture.type === 'orbit')) { gesture = null; buzz(15); openSpaceMenu(x, y); } });
    }
  } else if (ptrs.size === 2) {
    if (gesture && gesture.moved && gesture.type !== 'pan' && gesture.type !== 'orbit') pushHistory();
    const [a, b] = [...ptrs.values()];
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom0: cam2d.zoom, dist0: orbit.dist };
  }
});
surface.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press menus are handled above

function beginTransform(giz, x, y) {
  const j = ent(selectedId);
  const o = giz.g.o;
  if (giz.handle === 'collider') {
    const live = engine.scene.byId(selectedId), ex = live.extents(), sx = Math.abs(j.sx ?? 1) || 1, sy = Math.abs(j.sy ?? 1) || 1;
    const C0 = j.collider || j.body, fitted = j.collider ? !(C0.w || C0.h || C0.r || C0.points?.length) : (C0.shape || 'auto') === 'auto';
    if (fitted) { // fitted collider: becomes an explicit box / circle the first time you drag it
      if (ex.sphere) Object.assign(C0, { shape: 'circle', r: round(ex.r / Math.max(sx, sy), 1) }); else Object.assign(C0, { shape: 'box', w: round(ex.hx * 2 / sx, 1), h: round(ex.hy * 2 / sy, 1) });
      Object.assign(live.body, { shape: C0.shape, r: C0.r, w: C0.w, h: C0.h });
    }
    gesture = { type: 'collider', part: giz.part, id: selectedId, sx: x, sy: y, moved: false, rot: ex.rot || 0, scale: [sx, sy],
      flip: [Math.sign(j.sx ?? 1) || 1, Math.sign(j.sy ?? 1) || 1], orig: { w: C0.w || 1, h: C0.h || 1, r: C0.r || 10, ox: C0.ox || 0, oy: C0.oy || 0, points: (C0.points || []).map((q) => [...q]) } };
    return;
  }
  if (giz.handle === 'rect') {
    const sz = sizeOf(j); if (!sz) return;
    gesture = { type: 'rect', dir: giz.dir, id: selectedId, sx: x, sy: y, f: giz.f, size0: sz, square: sz[2], ui: !!j.ui, moved: false, orig: { x: j.x || 0, y: j.y || 0 } };
    return;
  }
  gesture = { type: tool === 'rotate' ? 'rotate' : tool === 'scale' ? 'scale' : giz.handle === 'free' ? 'free' : 'axis', handle: giz.handle, axis: giz.axis,
    id: selectedId, sx: x, sy: y, o, ui: !!j.ui, moved: false,
    orig: { x: j.x || 0, y: j.y || 0, z: j.z || 0, rx: j.rx || 0, ry: j.ry || 0, rz: j.rz || 0, sx: j.sx ?? 1, sy: j.sy ?? 1, sz: j.sz ?? 1 } };
  if (gesture.type === 'rotate') { gesture.a0 = gesture.a1 = Math.atan2(y - o.y, x - o.x); }
  if (gesture.type === 'free' && is3D() && !j.ui) {
    const p = rayPlaneY(engine.renderer.screenRay(engine.scene, x, y), gesture.orig.y);
    gesture.grab = p ? { x: p.x - gesture.orig.x, z: p.z - gesture.orig.z } : { x: 0, z: 0 };
  }
}

surface.addEventListener('pointermove', (ev) => {
  const p = ptrs.get(ev.pointerId);
  if (!p || !gesture || playing) return;
  const { x, y } = localXY(ev);
  p.x = x; p.y = y;
  if (Math.hypot(x - p.sx, y - p.sy) > 10) { if (tapTrack) tapTrack.moved = true; cancelLongPress(); }
  const s = engine.scene, g = gesture;
  const dx = x - (g.sx ?? x), dy = y - (g.sy ?? y);
  if (g.type === 'collider') {
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    const j = ent(g.id), live = s.byId(g.id); if (!(j?.collider || j?.body) || !live) return;
    const z = engine.renderer.zoomFor(s), wx = dx / z, wy = dy / z, cs = Math.cos(-g.rot), sn = Math.sin(-g.rot);
    const lx = wx * cs - wy * sn, ly = wx * sn + wy * cs, [scx, scy] = g.scale, o = g.orig, B = j.collider || j.body, r1 = (v) => Math.round(v);
    const shift = (lxx, lyy) => { const c2 = Math.cos(g.rot), s2 = Math.sin(g.rot); B.ox = r1(o.ox + (lxx * c2 - lyy * s2) / scx); B.oy = r1(o.oy + (lxx * s2 + lyy * c2) / scy); };
    if (g.part[0] === 'p') { const i = +g.part.slice(1), q = o.points[i]; if (!q) return; B.points = o.points.map((v) => [...v]); B.points[i] = [r1(q[0] + lx / scx * g.flip[0]), r1(q[1] + ly / scy * g.flip[1])]; live.body.points = B.points.map((v) => [...v]); return; }
    if (g.part === 'c') { B.ox = r1(o.ox + wx / scx); B.oy = r1(o.oy + wy / scy); }
    else if (g.part === 'rad') B.r = Math.max(2, r1(o.r + lx / Math.max(scx, scy)));
    else if (g.part === 'r' || g.part === 'l') { const d = g.part === 'r' ? lx : -lx; B.w = Math.max(2, r1(o.w + d / scx)); const real = (B.w - o.w) * scx; shift((g.part === 'r' ? 1 : -1) * real / 2, 0); B.oy = r1(B.oy); }
    else { const d = g.part === 'b' ? ly : -ly; B.h = Math.max(2, r1(o.h + d / scy)); const real = (B.h - o.h) * scy; shift(0, (g.part === 'b' ? 1 : -1) * real / 2); }
    for (const k of ['w', 'h', 'r', 'ox', 'oy']) if (B[k] !== undefined) live.body[k] = B[k];
    return;
  }
  if (['free', 'axis', 'rotate', 'scale', 'tap', 'rect'].includes(g.type)) {
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    if (!g.moved && g.type !== 'tap') $('#app').classList.add('dragging'); // the buttons over the Scene fade while you drag
    g.moved = true;
    if (g.type === 'tap') return;
    const j = ent(g.id), live = s.byId(g.id);
    if (!j) return;
    if (g.type === 'free') {
      if (g.ui) { const z = UIS().v.z; j.x = Math.round(g.orig.x + dx / z); j.y = Math.round(g.orig.y + dy / z); if (uiMode) snapUI(j); }
      else if (childOf(g)) { // a child: move it in the world, store the result relative to its parent
        let W;
        if (!is3D()) { const z = engine.renderer.zoomFor(s); W = [snapV(g.origW.x + dx / z, 10), snapV(g.origW.y + dy / z, 10), 0]; }
        else { const hit = rayPlaneY(engine.renderer.screenRay(s, x, y), g.origW.y); if (hit) W = [snapV(hit.x - g.grabW.x, 0.5), g.origW.y, snapV(hit.z - g.grabW.z, 0.5)]; }
        if (W) { const l = worldToLocal(g.par, W[0], W[1], W[2], s.mode); j.x = round(l[0], 3); j.y = round(l[1], 3); if (is3D()) j.z = round(l[2], 3); }
      } else if (!is3D()) { const z = engine.renderer.zoomFor(s); j.x = snapV(g.orig.x + dx / z, 10); j.y = snapV(g.orig.y + dy / z, 10); snapScene2D(j, live, z); }
      else {
        const hit = rayPlaneY(engine.renderer.screenRay(s, x, y), g.orig.y);
        if (hit) { j.x = snapV(hit.x - g.grab.x, 0.5); j.z = snapV(hit.z - g.grab.z, 0.5); }
      }
    } else if (g.type === 'axis') {
      const a = g.axis, along = dx * a.dx + dy * a.dy, step = g.ui ? 1 : is3D() ? 0.5 : 10;
      if (g.ui) j[a.k] = Math.round(g.orig[a.k] + along / a.ppu * a.sign);
      else if (childOf(g)) { const v = { x: 0, y: 0, z: 0 }; v[a.k] = snapV(along / a.ppu * a.sign, step); const d = localDelta(g.par, v.x, v.y, v.z, engine.scene.mode); j.x = round(g.orig.x + d[0], 3); j.y = round(g.orig.y + d[1], 3); if (is3D()) j.z = round(g.orig.z + d[2], 3); }
      else j[a.k] = snapV(g.orig[a.k] + along / a.ppu * a.sign, step);
    } else if (g.type === 'rotate') {
      g.a1 = Math.atan2(y - g.o.y, x - g.o.x);
      let deg = (g.a1 - g.a0) * 180 / Math.PI;
      const key = is3D() && !g.ui ? 'ry' : 'rz';
      let v = key === 'ry' ? g.orig.ry - deg : g.orig.rz + deg;
      v = snap ? Math.round(v / (+EP.rotSnap || 15)) * (+EP.rotSnap || 15) : round(v, 1);
      j[key] = v;
    } else if (g.type === 'rect') {
      const [hx, hy] = g.dir, k = g.f.k, scX = Math.abs(j.sx ?? 1) || 1, scY = Math.abs(j.sy ?? 1) || 1, [w0, h0] = g.size0;
      let w = w0 + hx * dx / k / scX, hgt = h0 + hy * dy / k / scY;
      if (!hx) w = w0; if (!hy) hgt = h0;
      if (g.square) { const m = hx && hy ? Math.max(w, hgt) : hx ? w : hgt; w = hgt = m; }
      if (snap) { const st = g.ui ? 4 : 5; w = Math.round(w / st) * st; hgt = Math.round(hgt / st) * st; }
      w = Math.max(4, w); hgt = Math.max(4, hgt);
      setSize(j, w, hgt);
      if (!(j.text && !j.shape && !j.sprite && !j.bar && !j.minimap)) { // the opposite edge stays put
        j.x = round(g.orig.x + (g.square && !hx ? 0 : hx) * (w - w0) * scX / 2, 2);
        j.y = round(g.orig.y + (g.square && !hy ? 0 : hy) * (hgt - h0) * scY / 2, 2);
      }
      g.label = `${Math.round(w)} × ${Math.round(hgt)}`;
      requestRebuild();
    } else if (g.type === 'scale') {
      const keys = g.handle === 'free' ? (is3D() && !g.ui ? ['sx', 'sy', 'sz'] : ['sx', 'sy']) : ['s' + g.handle];
      const along = g.handle === 'free' ? (dx - dy) / Math.SQRT2 : dx * g.axis.dx + dy * g.axis.dy;
      const f = Math.max(0.05, 1 + along / GIZ);
      for (const k of keys) j[k] = snap ? Math.max(0.1, Math.round(g.orig[k] * f * 10) / 10) : round(g.orig[k] * f, 3);
    }
    if (live) { const T = { x: j.x || 0, y: j.y || 0, z: j.z || 0, rx: j.rx || 0, ry: j.ry || 0, rz: j.rz || 0, sx: j.sx ?? 1, sy: j.sy ?? 1, sz: j.sz ?? 1 }; if (live.parentEnt && !live.ui && live.local) Object.assign(live.local, T); else Object.assign(live, T); }
    syncTransformInputs();
  } else if (g.type === 'paint') {
    paintAt(x, y);
  } else if (g.type === 'voxel') {
    voxelPaint(x, y);
  } else if (g.type === 'tile') {
    tilePaint(x, y);
  } else if (g.type === 'pan' || g.type === 'orbit') {
    const mx = x - g.lx, my = y - g.ly;
    g.lx = x; g.ly = y;
    if (Math.hypot(x - g.sx, y - g.sy) > 5) g.moved = true;
    if (uiMode) { uiView.x += mx; uiView.y += my; return; }
    if (!is3D()) { const z = engine.renderer.zoomFor(s); cam2d.x -= mx / z; cam2d.y -= my / z; }
    else if (viewMode === 'top') { const k = orbit.dist / engine.height; orbit.target.x -= mx * k; orbit.target.z -= my * k; }
    else if (g.type === 'orbit') { orbit.yaw -= mx * 0.008; orbit.pitch = Math.min(1.5, Math.max(0.05, orbit.pitch + my * 0.008)); }
    else panOrbit(mx, my);
    applyCamera();
  } else if (g.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (uiMode) { zoomUI(dist / g.d0, mx, my); uiView.x += mx - g.mx; uiView.y += my - g.my; g.mx = mx; g.my = my; g.d0 = dist; return; }
    if (!is3D()) {
      const before = engine.renderer.screenToWorld(s, g.mx, g.my);
      cam2d.zoom = Math.min(8, Math.max(0.08, cam2d.zoom * dist / g.d0));
      applyCamera();
      const after = engine.renderer.screenToWorld(s, mx, my);
      cam2d.x += before.x - after.x; cam2d.y += before.y - after.y;
    } else {
      orbit.dist = Math.min(300, Math.max(2, orbit.dist * g.d0 / dist));
      if (viewMode === 'top') { const k = orbit.dist / engine.height; orbit.target.x -= (mx - g.mx) * k; orbit.target.z -= (my - g.my) * k; } else panOrbit(mx - g.mx, my - g.my);
    }
    g.mx = mx; g.my = my; g.d0 = dist;
    applyCamera();
  }
});

/** For a drag on a child object: its live parent, and where it started in the world. */
function childOf(g) {
  if (g.par === undefined) {
    const live = engine.scene.byId(g.id);
    g.par = (!g.ui && live?.parentEnt) || null;
    if (g.par) {
      g.origW = { x: live.x, y: live.y, z: live.z };
      const hit = is3D() ? rayPlaneY(engine.renderer.screenRay(engine.scene, g.sx, g.sy), live.y) : null;
      g.grabW = hit ? { x: hit.x - live.x, z: hit.z - live.z } : { x: 0, z: 0 };
    }
  }
  return g.par;
}

// ---- Tags & Layers (Unity-style): a game-wide tag list, named Layers (also the collision layers) and draw layers ----
const DEFAULT_TAGS = ['player', 'enemy', 'coin', 'pickup', 'hazard', 'ground', 'platform', 'bullet', 'goal', 'npc'];
const allEnts = () => levelList().flatMap((lv) => lv.entities || []);
const allTags = () => [...new Set([...DEFAULT_TAGS, ...(root.tagList || []), ...allEnts().flatMap((e) => e.tags || [])])].filter(Boolean);
const layerOf = (j) => +(j.body?.layer ?? j.physLayer ?? 0) || 0;
function setLayerOf(j, i) { i = Math.max(0, Math.min(7, +i || 0)); if (i) j.physLayer = i; else delete j.physLayer; if (j.body) j.body.layer = i; }
const SORT_LAYERS = [['Background', -1000], ['Default', 0], ['Foreground', 1000], ['Top', 2000]];
const sortOf = (j) => { const v = +j.layer || 0; let b = SORT_LAYERS[0]; for (const q of SORT_LAYERS) if (v >= q[1] - 500) b = q; return { name: b[0], base: b[1], order: v - b[1] }; };
function addTag(j, t) { t = String(t || '').trim(); if (!t) return; j.tags = [...new Set([...(j.tags || []), t])]; if (!allTags().includes(t) || !DEFAULT_TAGS.includes(t)) root.tagList = [...new Set([...(root.tagList || []), t])]; changed({ structure: true }); pushHistory(); }
function tagMenu(anchor, j) {
  const on = new Set(j.tags || []);
  popMenu(anchor, [{ cap: 'Tags (tap to add or remove)' },
    ...allTags().map((t) => ({ icon: on.has(t) ? 'check' : 'key', label: t, fn: () => { if (on.has(t)) j.tags = (j.tags || []).filter((q) => q !== t); else j.tags = [...(j.tags || []), t]; changed({ structure: true }); pushHistory(); renderInspector(); } })),
    '-', { icon: 'plus', label: 'New Tag…', fn: () => { const t = prompt('New tag (e.g. boss, door, checkpoint)'); if (t?.trim()) { addTag(j, t.trim().toLowerCase().replace(/\s+/g, '-')); renderInspector(); } } },
    { icon: 'gear', label: 'Manage Tags & Layers…', fn: openTagsLayers }]);
}
/** Inspector header, compact: tag chips, then one row of small pickers (Layer, Draw + order, Parent, + Child). */
function tagLayerRows(j) {
  const threeD = is3D(), names = layerNames(), so = sortOf(j), kids = kidsOf(j.id);
  const chips = h('div', { class: 'tag-chips' }, (j.tags || []).map((t) => h('span', { class: 'tag-chip' }, t,
    h('button', { type: 'button', title: 'Remove tag', onclick: () => { j.tags = (j.tags || []).filter((q) => q !== t); changed({ structure: true }); pushHistory(); renderInspector(); } }, '×'))),
    h('button', { type: 'button', class: 'tag-add', onclick: (e) => tagMenu(e.currentTarget, j) }, icon('plus'), (j.tags || []).length ? '' : 'Tag'));
  const pill = (label, el, title) => h('label', { class: 'pill', title }, h('span', {}, label), el);
  return [
    h('div', { class: 'meta' }, chips),
    h('div', { class: 'meta pills' },
      pill('Layer', h('select', { class: 'layer-sel', onchange: (e) => { if (e.target.value === 'edit') { e.target.value = String(layerOf(j)); openTagsLayers(); return; } setLayerOf(j, e.target.value); changed({ structure: true }); pushHistory(); } },
        names.map((n, i) => h('option', { value: String(i), selected: i === layerOf(j) }, n)), h('option', { value: 'edit' }, 'Edit layers…')), 'Which layer it is on: decides what it collides with'),
      !threeD && pill('Draw', h('span', { class: 'pill-pair' },
        h('select', { class: 'sort-sel', onchange: (e) => { const b = SORT_LAYERS.find((q) => q[0] === e.target.value)[1]; j.layer = b + sortOf(j).order; if (!j.layer) delete j.layer; changed(); pushHistory(); renderInspector(); } },
          SORT_LAYERS.map(([n]) => h('option', { value: n, selected: n === so.name }, n))),
        h('input', { class: 'ord', type: 'number', inputMode: 'numeric', value: so.order, title: 'Order: higher draws in front',
          oninput: (e) => { j.layer = sortOf(j).base + (parseInt(e.target.value, 10) || 0); if (!j.layer) delete j.layer; changed(); } })), 'Draw layer and order: Background is behind, Top is in front'),
      pill('Parent', h('select', { class: 'parent-sel', onchange: (e) => setParent(j.id, e.target.value || null) },
        h('option', { value: '' }, 'None'), parentChoices(j).map((q) => h('option', { value: q.id, selected: q.id === j.parent }, q.name || 'Object'))), 'Put it inside another object: it moves with it'),
      h('button', { type: 'button', class: 'pill pill-btn', onclick: (e) => popMenu(e.currentTarget, [{ icon: 'plus', label: 'New Child', fn: () => addChild(j.id) }, { icon: 'link', label: 'Add Existing…', fn: () => addExistingMenu(j, e.target) }]) },
        icon('child'), kids.length ? `${kids.length} child${kids.length === 1 ? '' : 'ren'}` : 'Child')),
  ];
}
/** The Tags & Layers manager: add, rename and delete tags (everywhere at once), rename layers, see what uses them. */
/** Easy Save-style save data browser: the save files Play mode wrote on this device, their keys and values (view, edit, back up, export). */
function openSaveData(openFile = '') {
  const sv = new SaveFiles({ gameKey: root.name || 'game', levels: [root] }), files = sv.files(), redo = (f = openFile) => { closeLayer(); openSaveData(f); };
  const preview = (v) => { const t = typeof v === 'string' ? `“${v}”` : JSON.stringify(v); return t.length > 60 ? t.slice(0, 59) + '…' : t; };
  const ago = (t) => { if (!t) return 'never'; const s = Math.round((Date.now() - t) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString(); };
  const editKey = (f, k) => {
    const cur = sv.load(k, f), txt = prompt(`Value of “${k}” (JSON: 12, "text", [1,2], {"hp":3})`, JSON.stringify(cur)); if (txt === null) return;
    let v; try { v = JSON.parse(txt); } catch { v = txt; }
    sv.save(k, v, f); redo(f);
  };
  const fileCard = (f) => {
    const d = sv.read(f), keys = Object.keys(d?.keys || {}), raw = store.get(sv.key(f), ''), open = f === openFile;
    return h('div', { class: 'sd-file' + (open ? ' open' : '') },
      h('button', { class: 'sd-fh', onclick: () => redo(open ? '' : f) }, icon('chevron'), icon('save'), h('b', {}, f),
        h('small', {}, d ? `${keys.length} key${keys.length === 1 ? '' : 's'} · ${(raw.length / 1024).toFixed(1)} KB · ${ago(d.saved)}${raw.startsWith('PES1:') ? ' · 🔒' : ''}` : 'Locked or damaged (wrong password?)')),
      open && h('div', { class: 'sd-fb' },
        keys.length ? h('div', { class: 'sd-keys' }, keys.map((k) => h('div', { class: 'sd-key' }, h('code', {}, k), h('span', { title: JSON.stringify(d.keys[k].v) }, preview(d.keys[k].v)),
          h('button', { class: 'btn', title: 'Edit', onclick: () => editKey(f, k) }, icon('edit')),
          h('button', { class: 'btn', title: 'Delete key', onclick: () => { sv.deleteKey(k, f); redo(f); } }, icon('trash'))))) : h('p', { class: 'desc' }, 'No keys yet.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: () => { const k = prompt('New key name')?.trim(); if (k) editKey(f, k); } }, icon('plus'), 'Add Key'),
          h('button', { class: 'btn', onclick: () => { const t = sv.exportFile(f); navigator.clipboard?.writeText(t).then(() => toast('Save copied as text'), () => prompt('Save as text', t)); } }, icon('copy'), 'Export'),
          h('button', { class: 'btn', onclick: () => { const t = prompt('Paste a save exported from a game'); if (t && !sv.importFile(f, t)) toast('That is not a save file'); redo(f); } }, icon('paste'), 'Import'),
          h('button', { class: 'btn', onclick: () => { sv.backup(f); toast('Backup kept'); redo(f); } }, icon('download'), 'Back Up'),
          sv.hasBackup(f) && h('button', { class: 'btn', onclick: () => { if (sv.restore(f)) toast('Backup restored'); redo(f); } }, icon('rotate'), 'Restore'),
          h('button', { class: 'btn', onclick: () => { const n = prompt('Copy to file', f + ' copy')?.trim(); if (n) { sv.copyFile(f, n); redo(n); } } }, icon('layers'), 'Duplicate'),
          h('button', { class: 'btn', onclick: () => { if (confirm(`Delete the save file “${f}”?`)) { sv.deleteFile(f); redo(''); } } }, icon('trash'), 'Delete'))));
  };
  openDialog('Save Data', [
    h('p', { class: 'desc' }, 'Save files written while you play this game on this device (Save Key / Save Variables nodes, Auto Save and Save Manager components). Players each have their own. Edit values to test, or delete a file to start fresh.'),
    files.length ? h('div', { class: 'sd-list' }, files.map(fileCard)) : h('p', { class: 'empty' }, 'No save files yet. Play the game and save something.'),
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: () => { const n = prompt('New save file name', 'save')?.trim(); if (n) { sv.saveMany({}, n); redo(n); } } }, icon('plus'), 'New File'),
      files.length > 0 && h('button', { class: 'btn', onclick: () => { if (confirm(`Delete all ${files.length} save file${files.length === 1 ? '' : 's'} of this game?`)) { files.forEach((f) => sv.deleteFile(f)); redo(''); } } }, icon('trash'), 'Delete All')),
  ]);
}
function openTagsLayers() {
  const ents = allEnts(), names = layerNames();
  const used = (t) => ents.filter((e) => (e.tags || []).includes(t)).length;
  const onLayer = (i) => ents.filter((e) => layerOf(e) === i).length;
  const redo = () => { closeLayer(); openTagsLayers(); };
  const renameTag = (t) => { const n = prompt(`Rename tag "${t}" on every object to`, t)?.trim(); if (!n || n === t) return; for (const e of ents) if ((e.tags || []).includes(t)) e.tags = [...new Set(e.tags.map((q) => (q === t ? n : q)))]; root.tagList = [...new Set([...(root.tagList || []).filter((q) => q !== t), n])]; changed({ structure: true }); pushHistory(); redo(); };
  const deleteTag = (t) => { const k = used(t); if (k && !confirm(`Remove the tag "${t}" from ${k} object${k === 1 ? '' : 's'}?`)) return; for (const e of ents) if (e.tags) e.tags = e.tags.filter((q) => q !== t); root.tagList = (root.tagList || []).filter((q) => q !== t); root.hiddenTags = [...new Set([...(root.hiddenTags || []), t])]; changed({ structure: true }); pushHistory(); redo(); };
  const renameLayer = (i) => { const n = prompt('Layer name', names[i])?.trim(); if (!n) return; const all = layerNames(); all[i] = n; root.physicsLayers = { ...(root.physicsLayers || {}), names: all }; changed({ structure: true }); pushHistory(); redo(); };
  const add = h('input', { type: 'text', placeholder: 'New tag (boss, door…)', autocapitalize: 'off', onkeydown: (e) => { if (e.key === 'Enter') addBtn.click(); } });
  const addBtn = h('button', { class: 'btn primary', onclick: () => { const t = add.value.trim().toLowerCase().replace(/\s+/g, '-'); if (!t) return; root.tagList = [...new Set([...(root.tagList || []), t])]; root.hiddenTags = (root.hiddenTags || []).filter((q) => q !== t); changed(); pushHistory(); redo(); } }, icon('plus'), 'Add');
  const tags = allTags().filter((t) => !(root.hiddenTags || []).includes(t) || used(t));
  openDialog('Tags & Layers', [
    h('p', { class: 'desc' }, 'Tags name what an object is (player, enemy, coin): triggers, hazards, cameras and scripts look for them. An object can have several. Layers decide what collides with what (Scene Settings › Collision Layers) and can be used by scripts. Every object has one Layer.'),
    h('h4', { class: 'tl-h' }, icon('key'), 'Tags'),
    h('div', { class: 'tl-list' }, tags.map((t) => h('div', { class: 'tl-item' }, h('span', { class: 'tag-chip big' }, t), h('small', {}, `${used(t)} object${used(t) === 1 ? '' : 's'}`),
      h('button', { class: 'btn', title: 'Rename everywhere', onclick: () => renameTag(t) }, icon('edit')), h('button', { class: 'btn', title: 'Delete', onclick: () => deleteTag(t) }, icon('trash'))))),
    h('div', { class: 'tl-add' }, add, addBtn),
    h('h4', { class: 'tl-h' }, icon('layers'), 'Layers'),
    h('div', { class: 'tl-list' }, names.map((n, i) => h('div', { class: 'tl-item' }, h('span', { class: 'tl-idx' }, i), h('b', {}, n), h('small', {}, `${onLayer(i)} object${onLayer(i) === 1 ? '' : 's'}`),
      h('button', { class: 'btn', title: 'Rename', onclick: () => renameLayer(i) }, icon('edit'))))),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { closeLayer(); select(SCENE_ID); if (!isDesktop()) setDock('inspector'); toast('Collision Layers are in Scene Settings'); } }, icon('grid'), 'Which layers collide…')),
    h('h4', { class: 'tl-h' }, icon('scene'), 'Draw layers (2D and UI)'),
    h('p', { class: 'desc' }, 'Background is drawn behind everything, then Default, Foreground and Top. Order picks who is in front within the same draw layer. Set both at the top of the Inspector.'),
  ]);
}

// ---- physics layers (Unity-style collision matrix), shared by every level ----
const layerNames = () => { const n = root.physicsLayers?.names; return PHYSICS_LAYERS.map((d, i) => n?.[i] || d); };
function layerMatrixEditor() {
  const names = layerNames(), M = layerMatrix(root.physicsLayers).slice();
  const used = new Set(levelList().flatMap((lv) => lv.entities).map((e) => +(e.body?.layer || 0)));
  const set = (i, j, on) => { for (const [a, b] of [[i, j], [j, i]]) M[a] = on ? M[a] | (1 << b) : M[a] & ~(1 << b);
    root.physicsLayers = { ...(root.physicsLayers || {}), matrix: M }; changed({ inspector: true }); pushHistory(); };
  const rename = (i) => { const n = prompt('Layer name', names[i]); if (!n?.trim()) return; const all = layerNames(); all[i] = n.trim(); root.physicsLayers = { ...(root.physicsLayers || {}), names: all, matrix: M }; changed({ inspector: true }); pushHistory(); };
  return h('div', { class: 'lm' },
    h('p', { class: 'desc' }, 'Pick a layer on each Rigidbody (Player, Enemy, Bullet…). Untick a box and those two layers pass through each other — no bumping, no touch events. Tilemaps count as Ground. Tap a name to rename it.'),
    h('div', { class: 'lm-grid', style: `--n:${names.length}` },
      names.map((nm, i) => h('div', { class: 'lm-row' },
        h('button', { class: 'lm-name' + (used.has(i) ? ' used' : ''), onclick: () => rename(i) }, nm),
        names.map((_, j) => j > i ? h('span', { class: 'lm-sp' }) : h('label', { class: 'lm-cell', title: `${nm} ↔ ${names[j]}` },
          h('input', { type: 'checkbox', checked: !!((M[i] >> j) & 1), onchange: (e) => set(i, j, e.target.checked) }))))),
      h('div', { class: 'lm-row lm-foot' }, h('span', { class: 'lm-name' }), names.map((nm) => h('span', { class: 'lm-col' }, nm.slice(0, 3))))),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { root.physicsLayers = { ...(root.physicsLayers || {}), matrix: Array(8).fill(255) }; changed({ inspector: true }); pushHistory(); } }, icon('undo'), 'Everything collides')));
}

/** Inspector card for a 2D tilemap: brush, tile types, and the selected type's look and behaviour. */
function tilemapCard(j, C) {
  const T = j.tiles, pal = T.palette ||= TILE_PALETTE.map((t) => ({ ...t })), cur = Math.min(tileBrush.tile, pal.length), t = pal[cur - 1];
  const live = engine.scene.byId(j.id), count = Object.keys(T.cells || {}).length;
  const pick = (n) => { tileBrush.tile = n; tileBrush.mode = 'paint'; setTool('paint'); renderInspector(); };
  const swatch = (q, n) => h('button', { class: 'tile-sw' + (tileBrush.mode === 'paint' && cur === n ? ' on' : ''), title: (TILE_KINDS.find(([k]) => k === (q.kind || 'solid')) || [])[1], onclick: () => pick(n) },
    h('i', { style: `background:${q.fill || 'transparent'};${q.top && (q.kind || 'solid') === 'solid' ? `border-top:6px solid ${q.top}` : ''}${q.kind === 'platform' ? ';height:40%;align-self:start' : ''}` }), q.emoji ? h('b', {}, q.emoji) : null,
    h('small', {}, { solid: 'Solid', platform: 'Platform', hazard: 'Hazard', decor: 'Decor' }[q.kind || 'solid']));
  const set = (k, v) => { t[k] = v; if (!v && k !== 'kind') delete t[k]; changed({ inspector: false }); if (live) live.tiles.palette[cur - 1] = { ...t }; };
  return comp('Tilemap', [
    h('p', { class: 'desc' }, `${count} tile${count === 1 ? '' : 's'}. Pick a tile below, then drag on the Scene to paint. Solid tiles are walls and ground; platforms can be jumped through from below; hazards hurt the player.`),
    h('div', { class: 'row' }, h('label', {}, 'Brush'), h('div', { class: 'pair' },
      h('button', { class: 'btn' + (tileBrush.mode === 'paint' && tool === 'paint' ? ' primary' : ''), style: 'flex:1', onclick: () => { tileBrush.mode = 'paint'; setTool('paint'); renderInspector(); } }, icon('brush'), 'Paint'),
      h('button', { class: 'btn' + (tileBrush.mode === 'erase' && tool === 'paint' ? ' primary' : ''), style: 'flex:1', onclick: () => { tileBrush.mode = 'erase'; setTool('paint'); renderInspector(); } }, icon('trash'), 'Erase'))),
    h('div', { class: 'tile-pal' }, pal.map((q, i) => swatch(q, i + 1)),
      h('button', { class: 'tile-sw add', title: 'New tile type', onclick: () => { pal.push({ fill: '#90a4ae', kind: 'solid' }); changed({ structure: true }); pick(pal.length); } }, icon('plus'), h('small', {}, 'New'))),
    t && h('div', { class: 'tile-edit' },
      h('div', { class: 'row side' }, h('label', {}, 'Does'), h('select', { onchange: (e) => { set('kind', e.target.value); renderInspector(); } }, TILE_KINDS.map(([k, l]) => h('option', { value: k, selected: (t.kind || 'solid') === k }, l)))),
      h('div', { class: 'row side' }, h('label', {}, 'Colour'), h('input', { type: 'color', value: t.fill || '#888888', oninput: (e) => set('fill', e.target.value), onchange: () => renderInspector() })),
      (t.kind || 'solid') === 'solid' && h('div', { class: 'row side' }, h('label', {}, 'Top edge'), h('div', { class: 'pair' },
        h('input', { type: 'checkbox', checked: !!t.top, onchange: (e) => { set('top', e.target.checked ? '#7cb342' : ''); renderInspector(); } }),
        t.top && h('input', { type: 'color', value: t.top, oninput: (e) => set('top', e.target.value), onchange: () => renderInspector() }))),
      h('div', { class: 'row side' }, h('label', {}, 'Emoji'), h('div', { class: 'pair' },
        h('button', { class: 'btn', style: 'flex:1', onclick: () => pickEmoji((em) => { set('emoji', em); renderInspector(); }) }, t.emoji || 'Choose…'),
        t.emoji && h('button', { class: 'btn', title: 'No emoji', onclick: () => { set('emoji', ''); renderInspector(); } }, icon('close')))),
      pal.length > 1 && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => {
        const used = Object.values(T.cells || {}).filter((v) => v === cur).length;
        if (used && !confirm(`Remove this tile type and its ${used} painted tile${used === 1 ? '' : 's'}?`)) return;
        pal.splice(cur - 1, 1);
        for (const [k, v] of Object.entries(T.cells || {})) { if (v === cur) delete T.cells[k]; else if (v > cur) T.cells[k] = v - 1; }
        tileBrush.tile = Math.max(1, cur - 1); changed({ structure: true }); pushHistory();
      } }, icon('trash'), 'Remove this tile type'))),
    C('tiles.size', { label: 'Tile size', type: 'number', def: 40, step: 4, structure: true }),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { if (!confirm('Erase every tile?')) return; T.cells = {}; changed({ structure: true }); pushHistory(); } }, icon('trash'), 'Erase all')),
  ], { icon: 'grid', key: 'tiles', menu: [{ icon: 'trash', label: 'Remove Component', fn: () => { delete j.tiles; changed({ structure: true }); } }] });
}

/** Paint tool on a tilemap: paint or erase the cell under the finger (dragging fills a line, so fast strokes leave no gaps). */
function tilePaint(sx, sy) {
  const g = gesture, j = ent(g.id), live = engine.scene.byId(g.id);
  if (!j || !live?.tiles) return;
  const T = live.tiles, w = engine.renderer.screenToWorld(engine.scene, sx, sy), [ci, cj] = T.cell(live, w.x, w.y);
  const n = tileBrush.mode === 'erase' ? 0 : Math.min(tileBrush.tile, T.palette.length);
  const from = g.lastCell || [ci, cj], steps = Math.max(Math.abs(ci - from[0]), Math.abs(cj - from[1]), 1);
  for (let t = 1; t <= steps; t++) {
    const i = Math.round(from[0] + (ci - from[0]) * t / steps), jj = Math.round(from[1] + (cj - from[1]) * t / steps), key = i + ',' + jj;
    if (T.get(i, jj) === n) continue;
    T.set(i, jj, n);
    j.tiles.cells ||= {};
    if (n) j.tiles.cells[key] = n; else delete j.tiles.cells[key];
    g.count++;
  }
  if (g.lastCell?.[0] !== ci || g.lastCell?.[1] !== cj) buzz(4);
  g.lastCell = [ci, cj];
}

/** Paint tool on a voxel world: add or remove blocks where the finger is. */
function voxelPaint(sx, sy) {
  const g = gesture, j = ent(g.id), live = engine.scene.byId(g.id);
  if (!j || !live?.voxels) return;
  const V = live.voxels, hit = V.raycast(live, ...Object.values(engine.renderer.screenRay(engine.scene, sx, sy)), 400);
  let i, jj, k, c;
  if (hit) {
    if (voxelBrush.mode === 'remove') { i = hit.i; jj = hit.j; k = hit.k; c = 0; }
    else { i = hit.i + hit.n[0]; jj = hit.j + hit.n[1]; k = hit.k + hit.n[2]; c = voxelBrush.block; }
  } else if (voxelBrush.mode === 'add') { // empty world: build on the ground plane
    const p = rayPlaneY(engine.renderer.screenRay(engine.scene, sx, sy), live.y);
    if (!p) return;
    [i, jj, k] = V.cell(live, p.x, live.y + 0.01, p.z); c = voxelBrush.block;
  } else return;
  const key = `${i},${jj},${k}`;
  if (key === g.last) return;
  g.last = key;
  V.set(i, jj, k, c);
  (j.voxels.edits ||= {})[key] = c;
  g.count++;
  buzz(4);
}

/** Paint tool: stamp a copy of the source object at a screen point, spaced by its size. */
function paintAt(sx, sy) {
  const g = gesture, src = ent(g.srcId), s = engine.scene, live = s.byId(g.srcId);
  if (!src) return;
  let pos;
  if (is3D()) {
    const hit = rayPlaneY(engine.renderer.screenRay(s, sx, sy), src.y || 0);
    if (!hit) return;
    pos = { x: snapV(hit.x, 0.5), y: src.y || 0, z: snapV(hit.z, 0.5) };
  } else {
    const w = engine.renderer.screenToWorld(s, sx, sy);
    pos = { x: snapV(w.x, 10), y: snapV(w.y, 10), z: 0 };
  }
  const ex = live ? live.extents() : { hx: 20, hy: 20, hz: 0.5 };
  const sw = ex.sphere ? ex.r * 2 : ex.hx * 2, sh = ex.sphere ? ex.r * 2 : (is3D() ? ex.hz : ex.hy) * 2;
  const near = (p) => Math.abs(p.x - pos.x) < sw * 0.95 && Math.abs((is3D() ? p.z : p.y) - (is3D() ? pos.z : pos.y)) < sh * 0.95;
  if (g.last && near(g.last)) return;
  if (near({ x: src.x || 0, y: src.y || 0, z: src.z || 0 })) { g.last = pos; return; }
  const c = clone(src); c.id = uid(); c.x = pos.x; c.y = pos.y; c.z = pos.z;
  delete c.locked;
  project.entities.push(c);
  g.last = pos; g.count++;
  s.add({ ...c, behaviors: [] });
  s.flush();
  buzz(5);
}

function panOrbit(dx, dy) {
  const k = orbit.dist * 0.0022, sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
  orbit.target.x -= (cy * dx + sy * dy) * k;
  orbit.target.z -= (-sy * dx + cy * dy) * k;
}

const endPointer = (ev) => {
  if (!ptrs.has(ev.pointerId)) return;
  ptrs.delete(ev.pointerId);
  if (!ptrs.size) $('#app').classList.remove('dragging');
  cancelLongPress();
  if (ptrs.size === 0 && tapTrack && tapTrack.max >= 2 && !tapTrack.moved && performance.now() - tapTrack.t0 < 400) {
    undoRedo(tapTrack.max >= 3 ? 1 : -1); buzz(10); toast(tapTrack.max >= 3 ? 'Redo' : 'Undo');
    tapTrack = null; gesture = null; return;
  }
  const g = gesture;
  if (!g) return;
  if (['free', 'axis', 'rotate', 'scale', 'rect'].includes(g.type) && g.moved) { pushHistory(); saveSoon(); if (g.type === 'rect') renderInspector(); }
  if (g.type === 'collider' && g.moved) { pushHistory(); saveSoon(); renderInspector(); }
  uiGuide = null; sceneGuide = null;
  if (['free', 'axis', 'tap', 'rotate', 'scale', 'rect'].includes(g.type) && g.id && !g.moved && ptrs.size === 0 && (!tapTrack || tapTrack.max === 1)) { // double-tap an object: edit its text, or open the Inspector
    const now = performance.now();
    if (lastObjTap.id === g.id && now - lastObjTap.t < 340) { lastObjTap = { id: null, t: 0 }; quickEdit(g.id); }
    else lastObjTap = { id: g.id, t: now };
  }
  if ((g.type === 'voxel' || g.type === 'tile') && g.count) { pushHistory(); saveSoon(); renderInspector(); }
  if (g.type === 'paint' && g.count) { pushHistory(); saveSoon(); renderHierarchy(); toast(`Painted ${g.count} ${g.count === 1 ? 'copy' : 'copies'}`); }
  if ((g.type === 'pan' || g.type === 'orbit') && !g.moved && ptrs.size === 0 && (!tapTrack || tapTrack.max === 1)) {
    const now = performance.now();
    if (now - lastEmptyTap < 320) { resetCamera(); applyCamera(); lastEmptyTap = 0; }
    else { lastEmptyTap = now; if (tool !== 'hand') select(null); }
  }
  if (ptrs.size === 0 || g.type === 'pinch') gesture = null;
};
surface.addEventListener('pointerup', endPointer);
surface.addEventListener('pointercancel', endPointer);

let objClipboard = null;
/** Turn a Scene-view point into an "at" position for addEntity. */
function worldAt(sx, sy) {
  const s = engine.scene;
  if (!is3D()) return engine.renderer.screenToWorld(s, sx, sy);
  const hit = rayPlaneY(engine.renderer.screenRay(s, sx, sy), 0);
  return hit ? { x: hit.x, z: hit.z } : undefined;
}
const pointRect = (sx, sy) => { const r = surface.getBoundingClientRect(); return { left: r.left + sx + 12, right: r.left + sx + 12, top: r.top + sy + 12, bottom: r.top + sy - 12, guard: true }; };
function openObjectMenu(id, sx, sy, anchor) {
  const j = ent(id); if (!j) return;
  select(id);
  popMenu(anchor || pointRect(sx, sy), [
    { cap: j.name || 'Object' },
    { icon: 'info', label: 'Inspect', fn: () => ctxAction('inspect') },
    { icon: 'copy', label: 'Duplicate', fn: () => duplicateEntity(id) },
    { icon: 'paste', label: 'Copy', fn: () => { objClipboard = clone(j); toast(`Copied ${j.name}. Long-press empty space to paste.`); } },
    !j.ui && { icon: 'brush', label: 'Paint Copies', fn: () => setTool('paint') },
    { icon: 'frame', label: 'Focus', fn: frameSelected },
    j.prefab ? { icon: 'upload', label: 'Apply to Prefab', fn: () => applyPrefab(id) } : { icon: 'cube', label: 'Make Prefab', fn: () => makePrefab(id) },
    { icon: 'clock', label: 'Animate…', fn: () => openAnim(j, (j.behaviors || []).findIndex((b) => b.type === 'animator')) },
    { icon: 'layers', label: 'Make Child Of…', fn: () => parentMenu(j) },
    j.parent && { icon: 'upload', label: 'Unparent (top level)', fn: () => setParent(j.id, null) },
    { icon: 'plus', label: 'Add Child Object', fn: () => addChild(j.id) },
    j.parent && { icon: 'right', label: 'Select Parent', fn: () => select(j.parent) },
    { icon: 'folder', label: j.folder ? `Folder: ${j.folder}…` : 'Put in Folder…', fn: () => moveToFolder(j) },
    { icon: 'upload', label: 'Bring to Front', fn: () => { const L = project.entities; L.push(L.splice(L.indexOf(j), 1)[0]); changed({ structure: true }); pushHistory(); } },
    { icon: 'download', label: 'Send to Back', fn: () => { const L = project.entities; L.unshift(L.splice(L.indexOf(j), 1)[0]); changed({ structure: true }); pushHistory(); } },
    { icon: j.visible === false ? 'eye' : 'eyeoff', label: j.visible === false ? 'Show' : 'Hide', fn: () => { j.visible = j.visible === false; changed({ structure: true }); } },
    { icon: 'gear', label: j.locked ? 'Unlock' : 'Lock', fn: () => { j.locked = !j.locked; changed({ structure: true }); } },
    '-',
    { icon: 'trash', label: 'Delete', fn: () => deleteEntity(id) },
  ]);
}
function openSpaceMenu(sx, sy) {
  const at = worldAt(sx, sy);
  const objs = is3D() ? OBJECTS_3D : OBJECTS_2D, prefabs = is3D() ? PREFABS_3D : PREFABS_2D;
  popMenu(pointRect(sx, sy), [
    objClipboard && { icon: 'paste', label: `Paste ${objClipboard.name || 'object'} here`, fn: () => { const c = clone(objClipboard); delete c.id; addEntity(c, objClipboard.ui ? undefined : at); toast('Pasted'); } },
    { icon: 'plus', label: 'Add Object Here…', fn: () => popMenu(pointRect(sx, sy), [{ cap: 'Objects' }, ...objs.map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o, at) })),
      '-', { cap: 'Prefabs' }, ...prefabs.map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o, at) }))]) },
    { icon: 'frame', label: 'Reset View', fn: () => { resetCamera(); applyCamera(); } },
    { icon: 'gear', label: 'Game Settings', fn: () => { select(SCENE_ID); setDock('inspector'); } },
  ]);
}

function frameSelected() {
  const j = ent(selectedId);
  if (!j || j.ui) { resetCamera(); applyCamera(); return; }
  if (is3D()) { orbit.target = { x: j.x || 0, y: j.y || 0, z: j.z || 0 }; orbit.dist = Math.min(orbit.dist, 12); }
  else { cam2d.x = j.x || 0; cam2d.y = j.y || 0; cam2d.zoom = Math.max(cam2d.zoom, 1); }
  applyCamera();
}

// ============================================================================
// Tools, dock panels
// ============================================================================
function setTool(t) {
  const was = tool;
  tool = t;
  for (const b of $$('#toolRail [data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
  if (t !== was && tipOnce('tool-' + t, null, 3)) showToolName(t);
  if (t === 'rect' && was !== 'rect') { if (is3D() && !ent(selectedId)?.ui) toast('Rect tool works on UI and 2D objects. In 3D use Scale.'); else tipOnce('rect', 'Rect: drag the edges and corners to resize. Drag the middle to move.'); }
  if (t === 'paint' && was !== 'paint') toast(ent(selectedId) && !ent(selectedId).ui ? `Paint: tap or drag to place copies of ${ent(selectedId).name}` : 'Paint: select an object, then tap or drag in the Scene');
  updateCtxBar();
}

/** A teaching message only the first few times (then the editor stops repeating itself). */
function tipOnce(key, msg, times = 2) {
  let seen = {}; try { seen = JSON.parse(localStorage.getItem('pocket.editor.tips') || '{}'); } catch { /* storage unavailable */ }
  if ((seen[key] || 0) >= times) return false;
  seen[key] = (seen[key] || 0) + 1; try { localStorage.setItem('pocket.editor.tips', JSON.stringify(seen)); } catch { /* storage unavailable */ }
  if (msg) toast(msg);
  return true;
}
const TOOL_NAMES = { hand: 'Hand · pan the view', move: 'Move', rotate: 'Rotate', scale: 'Scale', rect: 'Rect · resize', paint: 'Paint · place copies' };
let toolTipTimer;
/** Name the tool next to its button for a moment (the rail only shows icons). */
function showToolName(t) {
  const b = $(`#toolRail [data-tool="${t}"]`), rail = $('#toolRail'); if (!b || !rail.offsetParent) return;
  let tip = $('#toolTip'); if (!tip) { tip = h('div', { id: 'toolTip' }); $('#viewport').append(tip); }
  const rr = rail.getBoundingClientRect(), br = b.getBoundingClientRect(), vr = $('#viewport').getBoundingClientRect();
  tip.textContent = TOOL_NAMES[t] || t;
  tip.style.left = (rr.right - vr.left + 8) + 'px'; tip.style.top = (br.top - vr.top + br.height / 2) + 'px';
  tip.classList.add('show'); clearTimeout(toolTipTimer); toolTipTimer = setTimeout(() => tip.classList.remove('show'), 1100);
}

let dockTab = 'hierarchy';
/** How big panels open: the size you last dragged them to (full screen at first, so nothing is cramped). */
const panelSize = () => (store.get('pocket.editor.panel', 'full') === 'half' ? 'half' : 'full');
function setDock(name, { fromTab = false } = {}) {
  if (name === 'scene') { setSheet('peek'); return; } // the Scene tab: the panel steps aside
  if (!isDesktop()) {
    if (fromTab && name === dockTab && sheetState() !== 'peek') { setSheet('peek'); return; } // tap the open tab again: back to the Scene
    if (sheetState() === 'peek') setSheet(panelSize());
  }
  dockTab = name;
  if (name === 'console') { consoleSeen = Log.entries.length; renderConsole(); }
  if (name === 'scripts') renderScripts();
  markTabs();
  for (const p of $$('.dock')) p.classList.toggle('active', p.dataset.dock === name);
}
const isDesktop = () => false; // phones and tablets only

// ---- Console (Unity-style, and more): messages, warnings and errors from the game; search, details, watches and commands ----
let consoleSeen = 0, consoleLevel = 'all', consoleFrame = 0, consoleQuery = '', consoleOpen = null, playStartedAt = 0;
const LOG_ICON = { info: 'info', warn: 'help', error: 'close', cmd: 'right', result: 'check' };
const CP = (k, d) => store.get('pocket.editor.console.' + k, d);
const clearOnPlay = () => store.get('pocket.editor.clearOnPlay', '1') === '1';
const consoleOpts = () => ({ collapse: CP('collapse', '1') === '1', time: CP('time', 'play'), newest: CP('newest', '1') === '1', pauseOnError: CP('pauseOnError', '') === '1' });
const watches = () => { try { return JSON.parse(CP('watches', '[]')).filter(Boolean); } catch { return []; } };
const setWatches = (w) => store.set('pocket.editor.console.watches', JSON.stringify([...new Set(w)].slice(0, 12)));
const fmtVal = (v) => (v === undefined ? '(not set)' : typeof v === 'object' && v !== null ? JSON.stringify(v) : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v));
const logTime = (x) => { const o = consoleOpts(); if (o.time === 'off') return ''; if (o.time === 'play' && playStartedAt && x.t0 >= playStartedAt) return '+' + ((x.t0 - playStartedAt) / 1000).toFixed(1) + 's'; return new Date(x.t0 || x.t).toLocaleTimeString(); };
/** Entries to show: level filter, search, and (optionally) identical messages merged into one row. */
function consoleRows() {
  const o = consoleOpts(), q = consoleQuery.trim().toLowerCase();
  let rows = Log.entries.filter((x) => (consoleLevel === 'all' || x.level === consoleLevel || (consoleLevel === 'info' && (x.level === 'cmd' || x.level === 'result'))) && (!q || x.text.toLowerCase().includes(q) || x.source.toLowerCase().includes(q)));
  if (o.collapse) { const m = new Map(); for (const x of rows) { const k = x.level + '|' + x.source + '|' + x.text; const y = m.get(k); if (y) { y.count += x.count; y.t = Math.max(y.t, x.t); } else m.set(k, { ...x }); } rows = [...m.values()]; }
  rows = rows.slice(-300);
  return o.newest ? rows.reverse() : rows;
}
function logRow(x) {
  const obj = x.source && project.entities.find((e) => e.name === x.source.replace(/ script$/, '')), key = x.t0 + '|' + x.text, open = consoleOpen === key;
  const row = h('div', { class: 'log-row ' + x.level + (open ? ' open' : ''), onclick: (ev) => { if (ev.target.closest('.log-acts')) return; consoleOpen = open ? null : key; refreshConsoles(); } },
    h('span', { class: 'log-ic' }, icon(LOG_ICON[x.level] || 'info')),
    h('span', { class: 'log-txt' }, h('span', {}, x.text), h('small', {}, [x.source, logTime(x)].filter(Boolean).join(' · ')),
      open && x.stack ? h('pre', { class: 'log-stack' }, x.stack) : null,
      open ? h('div', { class: 'log-acts' },
        h('button', { onclick: () => { navigator.clipboard?.writeText([x.text, x.source, x.stack].filter(Boolean).join('\n')).then(() => toast('Copied')).catch(() => toast('Couldn’t copy')); } }, icon('copy'), 'Copy'),
        obj && !playing ? h('button', { onclick: () => { select(obj.id); setDock('inspector'); } }, icon('target'), 'Show object') : null,
        obj && playing ? h('button', { onclick: () => { const live = engine.scene?.entities.find((q) => q.name === obj.name); if (live) { inspectId = live.id; engine.paused = true; updatePauseButtons(); renderInspectCard?.(); } } }, icon('target'), 'Inspect') : null,
        h('button', { onclick: () => { consoleQuery = x.text.slice(0, 40); consoleOpen = null; refreshConsoles(); } }, icon('search'), 'Find similar')) : null),
    x.count > 1 && h('span', { class: 'log-n' }, x.count > 999 ? '999+' : x.count));
  return row;
}
function watchBar() {
  const W = watches();
  return h('div', { class: 'log-watch' },
    ...W.map((k) => h('span', { class: 'lw', 'data-k': k }, h('b', {}, k), h('em', {}, fmtVal(engine.scene?.vars?.[k])), h('button', { title: 'Stop watching', onclick: () => { setWatches(watches().filter((q) => q !== k)); refreshConsoles(); } }, icon('close')))),
    h('button', { class: 'lw-add', onclick: () => { const vars = Object.keys(engine.scene?.vars || {}).filter((k) => !W.includes(k)); const k = prompt('Watch which variable?' + (vars.length ? '\n\n' + vars.slice(0, 30).join(', ') : ''), vars[0] || 'score'); if (k?.trim()) { setWatches([...watches(), k.trim()]); refreshConsoles(); } } }, icon('plus'), W.length ? '' : 'Watch a variable'));
}
let cmdHistory = [], cmdPos = -1;
function cmdLine() {
  const inp = h('input', { type: 'text', class: 'log-cmd', placeholder: 'Command: score = 10, send win, vars, help…', autocapitalize: 'off', autocomplete: 'off', spellcheck: false, enterkeyhint: 'go',
    onkeydown: (e) => {
      if (e.key === 'Enter' && inp.value.trim()) { const c = inp.value.trim(); cmdHistory.push(c); cmdPos = cmdHistory.length; inp.value = ''; runCommand(c); setTimeout(() => $$('.log-cmd').forEach((q) => { if (q.isConnected && q.dataset.where === inp.dataset.where) q.focus(); }), 30); }
      else if (e.key === 'ArrowUp' && cmdHistory.length) { cmdPos = Math.max(0, cmdPos - 1); inp.value = cmdHistory[cmdPos] || ''; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && cmdHistory.length) { cmdPos = Math.min(cmdHistory.length, cmdPos + 1); inp.value = cmdHistory[cmdPos] || ''; e.preventDefault(); }
    } });
  return h('div', { class: 'log-cmdrow' }, h('span', { class: 'log-prompt' }, '›'), inp, h('button', { class: 'log-run', title: 'Run', onclick: () => inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })) }, icon('play')));
}
const parseVal = (t) => { t = t.trim(); if (t === 'true') return true; if (t === 'false') return false; if (t !== '' && Number.isFinite(+t)) return +t; if (/^[[{"]/.test(t)) { try { return JSON.parse(t); } catch { /* text */ } } return t.replace(/^'(.*)'$/, '$1'); };
/** The Console's command line: inspect and change the running game. */
function runCommand(c) {
  Log.add('cmd', c, '');
  const S = engine.scene, out = (t, lv = 'result') => Log.add(lv, t, '');
  const need = () => { if (!playing || !S) { out('Press Play first: commands work on the running game', 'warn'); return false; } return true; };
  const [word, ...rest] = c.split(/\s+/), arg = rest.join(' '), m = /^([\w.]+)\s*(=|\+=|-=)\s*(.+)$/.exec(c);
  switch (word.toLowerCase()) {
    case 'help': out('vars · NAME · NAME = value (+= −=) · watch NAME · unwatch NAME · send MESSAGE [value] · objects · find NAME · pause · resume · step · restart · win · lose · level N · speed 0.5 · page NAME · back · clear'); return;
    case 'clear': Log.clear(); consoleSeen = 0; return;
    case 'watch': if (arg) { setWatches([...watches(), arg]); refreshConsoles(); out('Watching ' + arg); } return;
    case 'unwatch': setWatches(watches().filter((q) => q !== arg)); refreshConsoles(); return;
  }
  if (!need()) return;
  switch (word.toLowerCase()) {
    case 'vars': { const v = Object.entries(S.vars).filter(([k]) => !k.startsWith('_')); out(v.length ? v.map(([k, x]) => `${k} = ${fmtVal(x)}`).join('\n') : 'No variables yet'); return; }
    case 'send': { const [msg, ...v] = rest; if (!msg) return out('send MESSAGE [value]', 'warn'); S.send(msg, v.length ? parseVal(v.join(' ')) : undefined); out('Sent ' + msg); return; }
    case 'objects': { const L = S.entities.filter((e) => !e.dead && !e.template && e.name); out(`${L.length} objects: ` + L.slice(0, 60).map((e) => e.name).join(', ') + (L.length > 60 ? '…' : '')); return; }
    case 'find': { const e = S.find(arg) || S.findAll(arg)[0]; if (!e) return out('No object called ' + arg, 'warn'); out(`${e.name}: x ${Math.round(e.x)}, y ${Math.round(e.y)}${e.z ? ', z ' + Math.round(e.z) : ''} · ${e.visible ? 'visible' : 'hidden'}${e.tags?.length ? ' · tags ' + e.tags.join(', ') : ''}${e.health != null ? ' · health ' + e.health : ''}${Object.keys(e.data || {}).length ? ' · ' + Object.entries(e.data).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}=${fmtVal(v)}`).join(' ') : ''}`); return; }
    case 'pause': engine.paused = true; updatePauseButtons(); out('Paused'); return;
    case 'resume': engine.paused = false; updatePauseButtons(); out('Running'); return;
    case 'step': engine.paused = true; engine.stepFrames = 1; updatePauseButtons(); return;
    case 'restart': engine.restart?.(); out('Restarted'); return;
    case 'win': S.win?.(); return;
    case 'lose': case 'gameover': S.gameOver?.(); return;
    case 'level': engine.goToLevel ? engine.goToLevel(Math.max(0, (+arg || 1) - 1)) : out('Can’t change level here', 'warn'); return;
    case 'speed': engine.timeScale = Math.max(0, Math.min(4, +arg || 1)); out('Game speed ' + engine.timeScale + '×'); return;
    case 'page': S.navTo(arg, 'page'); return;
    case 'back': out(S.navBack() ? 'Went back' : 'Nowhere to go back to'); return;
  }
  if (m) { const [, k, op, v] = m, old = S.vars[k], nv = op === '=' ? parseVal(v) : (+old || 0) + (op === '+=' ? 1 : -1) * (+v || 0); S.setVar(k, nv); out(`${k} = ${fmtVal(nv)}`); return; }
  if (/^\w+$/.test(c)) { out(`${c} = ${fmtVal(S.vars[c])}`); return; }
  out('Unknown command. Type help', 'warn');
}
function consoleMenu(anchor) {
  const o = consoleOpts(), set = (k, v) => { store.set('pocket.editor.console.' + k, v); refreshConsoles(); };
  popMenu(anchor, [
    { cap: 'Console' },
    { icon: o.collapse ? 'check' : 'square', label: 'Merge identical messages', fn: () => set('collapse', o.collapse ? '' : '1') },
    { icon: o.newest ? 'check' : 'square', label: 'Newest at the top', fn: () => set('newest', o.newest ? '' : '1') },
    { icon: o.pauseOnError ? 'check' : 'square', label: 'Pause the game on an error', fn: () => set('pauseOnError', o.pauseOnError ? '' : '1') },
    { icon: clearOnPlay() ? 'check' : 'square', label: 'Clear when you press Play', fn: () => { store.set('pocket.editor.clearOnPlay', clearOnPlay() ? '' : '1'); refreshConsoles(); } },
    { icon: 'clock', label: 'Times: ' + { play: 'since Play', clock: 'clock', off: 'hidden' }[o.time], fn: () => set('time', { play: 'clock', clock: 'off', off: 'play' }[o.time]) },
    '-',
    { icon: 'copy', label: 'Copy All', fn: () => navigator.clipboard?.writeText(logText()).then(() => toast('Console copied')).catch(() => toast('Couldn’t copy')) },
    { icon: 'download', label: 'Save as a File', fn: () => download('console-' + slug(root?.name || 'game') + '.txt', logText(), 'text/plain') },
  ]);
}
const logText = () => Log.entries.map((x) => `[${new Date(x.t0 || x.t).toLocaleTimeString()}] ${x.level.toUpperCase()}${x.source ? ' (' + x.source + ')' : ''}: ${x.text}${x.count > 1 ? ' ×' + x.count : ''}${x.stack ? '\n' + x.stack : ''}`).join('\n');
function consoleTools(compact) {
  const E = Log.entries, n = (lv) => E.filter((x) => x.level === lv).reduce((a, x) => a + x.count, 0);
  const search = h('input', { type: 'search', class: 'log-search', placeholder: 'Search', value: consoleQuery, autocapitalize: 'off', oninput: (e) => { consoleQuery = e.target.value; refreshConsoles(true); } });
  return h('div', { class: 'log-tools' + (compact ? ' compact' : '') },
    ...[['all', 'All', E.filter((x) => x.level !== 'cmd' && x.level !== 'result').reduce((a, x) => a + x.count, 0)], ['info', 'Log', n('info')], ['warn', 'Warn', n('warn')], ['error', 'Error', n('error')]].map(([k, l, c]) =>
      h('button', { class: 'log-f ' + k + (consoleLevel === k ? ' on' : ''), onclick: () => { consoleLevel = k; refreshConsoles(); } }, compact ? null : l, h('b', {}, c), compact ? icon(LOG_ICON[k] || 'list') : null)),
    search,
    h('button', { class: 'log-clear', title: 'More', onclick: (e) => consoleMenu(e.currentTarget) }, icon('more')),
    h('button', { class: 'log-clear', title: 'Clear', onclick: () => { Log.clear(); consoleSeen = 0; } }, icon('trash')));
}
function renderConsole(keepSearch) {
  const box = $('#console'); if (!box) return;
  const rows = consoleRows(), focused = keepSearch && document.activeElement?.classList.contains('log-search') && box.contains(document.activeElement), list = box.querySelector('.log-list');
  if (focused) { list?.replaceWith(rows.length ? h('div', { class: 'log-list' }, rows.map(logRow)) : h('div', { class: 'log-list' }, h('div', { class: 'empty' }, 'Nothing matches.'))); updateConsoleBadge(); return; }
  box.replaceChildren(consoleTools(false), watchBar(),
    rows.length ? h('div', { class: 'log-list' }, rows.map(logRow))
      : h('div', { class: 'log-list' }, h('div', { class: 'empty' }, Log.entries.length ? 'Nothing of this kind.' : 'Messages from your game appear here while it runs: the Debug Log action and nodes, P.log() in scripts, warnings and errors. Tap a message for details. Below, type commands to look inside the running game.')),
    cmdLine());
  box.querySelector('.log-cmd').dataset.where = 'dock';
  updateConsoleBadge();
}
function updateConsoleBadge() {
  const fresh = Log.entries.slice(consoleSeen), errs = fresh.filter((x) => x.level === 'error').length, warns = fresh.filter((x) => x.level === 'warn').length;
  const tab = $('#dockTabs [data-dock="console"]'); if (!tab) return;
  tab.querySelector('.dock-badge')?.remove();
  if (dockTab !== 'console' && (errs || warns)) tab.append(h('span', { class: 'dock-badge' + (errs ? ' err' : '') }, String(errs || warns)));
  const pb = $('#pbLog'); if (pb) { pb.querySelector('.dock-badge')?.remove(); const all = Log.entries.filter((x) => x.level === 'error').length; if (all) pb.append(h('span', { class: 'dock-badge err' }, String(all))); }
}
function renderPlayConsole(keepSearch) {
  const pc = $('#playConsole'), rows = consoleRows().slice(0, 80);
  if (keepSearch && document.activeElement?.classList.contains('log-search') && pc.contains(document.activeElement)) { pc.querySelector('.pc-list')?.replaceChildren(...rows.map(logRow)); return; }
  pc.replaceChildren(h('div', { class: 'pc-h' }, h('b', {}, 'Console'), h('button', { title: 'Bigger / smaller', onclick: () => pc.classList.toggle('tall') }, icon('frame')), h('button', { onclick: () => { pc.hidden = true; } }, icon('close'))),
    consoleTools(true), watchBar(), h('div', { class: 'pc-list' }, rows.map(logRow)), cmdLine());
  pc.querySelector('.log-cmd').dataset.where = 'play';
}
/** Redraw whichever consoles are showing (keepSearch: don't steal the search box's focus). */
function refreshConsoles(keepSearch) {
  if (dockTab === 'console') { consoleSeen = Log.entries.length; renderConsole(keepSearch); } else updateConsoleBadge();
  if (!$('#playConsole').hidden) renderPlayConsole(keepSearch);
}
Log.listeners.add(() => { // batch redraws to once a frame
  const last = Log.entries[Log.entries.length - 1];
  if (last?.level === 'error' && playing && consoleOpts().pauseOnError && !engine.paused && last.count === 1) { engine.paused = true; updatePauseButtons(); toast('Paused on an error (see Console)'); }
  if (consoleFrame) return;
  consoleFrame = requestAnimationFrame(() => { consoleFrame = 0; if (document.activeElement?.classList?.contains('log-cmd')) { const a = document.activeElement; refreshConsoles(true); if (!a.isConnected) $$('.log-cmd').find?.((q) => q.dataset.where === a.dataset.where)?.focus(); return; } refreshConsoles(true); });
});
setInterval(() => { // live watches
  if (!playing) return;
  for (const el of $$('.log-watch .lw')) { const em = el.querySelector('em'), v = fmtVal(engine.scene?.vars?.[el.dataset.k]); if (em && em.textContent !== v) { em.textContent = v; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
}, 200);
window.addEventListener('error', (e) => { if (playing) Log.add('error', e.message || 'Error', 'game', e.error); });
window.addEventListener('unhandledrejection', (e) => { if (playing) Log.add('error', 'Unhandled: ' + (e.reason?.message || e.reason), 'game', e.reason); });

// ---- Scripts tab: every Visual Script in the game at a glance; tap one to open it ----
let scriptQuery = '';
/** Each Visual Script component: { lv, li, e, b, bi }. */
function allGraphs() {
  const out = [];
  levelList().forEach((lv, li) => { for (const e of lv.entities || []) (e.behaviors || []).forEach((b, bi) => {
    if (b.type !== 'graph') return;
    out.push({ lv, li, e, b, bi, t: b, path: `behaviors.${bi}.graph`, name: (b.scripts || []).length ? b.mainName || 'Main script' : '' });
    (b.scripts || []).forEach((sc, k) => out.push({ lv, li, e, b, bi, t: sc, k, path: `behaviors.${bi}.scripts.${k}.graph`, name: sc.name || `Script ${k + 2}` }));
  }); });
  return out;
}
const graphEvents = (g) => [...new Set((g?.nodes || []).filter((n) => NODE_TYPES[n.type]?.cat === 'Events' || (NODE_TYPES[n.type]?.cat === 'Animation' && !NODE_TYPES[n.type].exec && !NODE_TYPES[n.type].value)).map((n) => NODE_TYPES[n.type].label.replace(/^On /, '')))];
/** A tiny map of the graph: coloured blocks for nodes, lines for wires. */
function graphThumb(g) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), N = g?.nodes || [];
  svg.setAttribute('class', 'sc-thumb');
  if (!N.length) { svg.setAttribute('viewBox', '0 0 100 60'); return svg; }
  const W = 260, H = 90, x0 = Math.min(...N.map((n) => n.x || 0)), y0 = Math.min(...N.map((n) => n.y || 0));
  const x1 = Math.max(...N.map((n) => (n.x || 0) + W)), y1 = Math.max(...N.map((n) => (n.y || 0) + H)), pad = 30;
  svg.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${Math.max(400, x1 - x0) + pad * 2} ${Math.max(240, y1 - y0) + pad * 2}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const at = new Map(N.map((n) => [n.id, n]));
  for (const l of g.links || []) {
    const a = at.get(l.from.node), c = at.get(l.to.node); if (!a || !c) continue;
    const ax = (a.x || 0) + W, ay = (a.y || 0) + H / 2, cx = c.x || 0, cy = (c.y || 0) + H / 2, d = Math.max(40, Math.abs(cx - ax) / 2);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${ax},${ay} C${ax + d},${ay} ${cx - d},${cy} ${cx},${cy}`);
    path.setAttribute('class', NODE_TYPES[a.type]?.value ? 'v' : '');
    svg.append(path);
  }
  for (const n of N) {
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('x', n.x || 0); r.setAttribute('y', n.y || 0); r.setAttribute('width', W); r.setAttribute('height', H); r.setAttribute('rx', 22);
    r.setAttribute('fill', NODE_CAT_COLOR[NODE_TYPES[n.type]?.cat] || '#555');
    svg.append(r);
  }
  return svg;
}
function openGraphAt(li, id, bi) {
  if (li !== levelIdx) setLevel(li);
  selectedId = id; renderHierarchy(); updateCtxBar();
  editGraph(() => ent(id) || {}, typeof bi === 'string' ? bi : `behaviors.${bi}.graph`); // a path for scripts inside a component
}
function scriptCard(x) {
  const { li, e, b } = x, t = x.t || b, bi = x.path || x.bi, g = t.graph || { nodes: [] }, sc = scriptOf(t), ev = graphEvents(g), here = li === levelIdx, sub = t !== b;
  const off = b.enabled === false || (sub ? t.off : b.mainOff);
  const menu = (anchor) => popMenu(anchor, [
    { cap: `${e.name || 'Object'} · Visual Script` },
    { icon: 'nodes', label: 'Open Node Editor', fn: () => openGraphAt(li, e.id, bi) },
    { icon: 'info', label: 'Show Object in Inspector', fn: () => { if (li !== levelIdx) setLevel(li); select(e.id); setDock('inspector'); } },
    sc ? { icon: 'unlink', label: `Unlink from “${sc.name}”`, fn: () => { delete t.scriptRef; changed(); renderScripts(); toast('Unlinked'); } }
      : { icon: 'save', label: 'Save as Reusable Script…', fn: () => { if (!g.nodes.length) { toast('Add some nodes first'); return; } const n = prompt('Name this script so you can reuse it', `${e.name || 'My'} script`); if (n?.trim()) { saveScript(t, g, n.trim()); renderScripts(); } } },
    sub ? { icon: t.off ? 'eye' : 'eyeoff', label: t.off ? 'Turn On' : 'Turn Off', fn: () => { if (t.off) delete t.off; else t.off = true; changed(); renderScripts(); } }
      : { icon: b.enabled === false ? 'eye' : 'eyeoff', label: b.enabled === false ? 'Turn On' : 'Turn Off', fn: () => { if (b.enabled === false) delete b.enabled; else b.enabled = false; changed(); renderScripts(); } },
    '-',
    { icon: 'trash', label: 'Remove Script', fn: () => {
      if (!confirm(`Remove ${x.name ? `“${x.name}”` : 'this Visual Script'} from ${e.name || 'the object'}?`)) return;
      if (sub) { b.scripts.splice(b.scripts.indexOf(t), 1); if (!b.scripts.length) delete b.scripts; }
      else if ((b.scripts || []).length) { const nx = b.scripts.shift(); b.graph = nx.graph; b.mainName = nx.name; if (nx.scriptRef) b.scriptRef = nx.scriptRef; else delete b.scriptRef; if (nx.off) b.mainOff = true; else delete b.mainOff; if (!b.scripts.length) delete b.scripts; } // the next script becomes the main one
      else e.behaviors.splice(e.behaviors.indexOf(b), 1);
      changed({ structure: true }); pushHistory(); renderScripts();
    } },
  ]);
  return h('div', { class: 'sc-card' + (off ? ' off' : '') + (selectedId === e.id && here ? ' sel' : ''), 'data-obj': e.name || '', onclick: (ev2) => { if (!ev2.target.closest('.sc-more')) openGraphAt(li, e.id, bi); } },
    graphThumb(g),
    h('div', { class: 'sc-info' },
      x.name ? h('span', { class: 'sc-sub' }, x.name) : null,
      h('b', {}, e.name || 'Object', e.behaviors.filter((q) => q.type === 'graph').length > 1 ? h('span', { class: 'sc-nth' }, `#${e.behaviors.filter((q) => q.type === 'graph').indexOf(b) + 1}`) : null, e.template ? h('em', { class: 'sc-tag' }, 'template') : null, sc ? h('em', { class: 'sc-tag link' }, icon('link'), sc.name) : null, b.enabled === false ? h('em', { class: 'sc-tag' }, 'off') : null),
      h('small', {}, ev.length ? 'When: ' + ev.join(', ') : 'No event yet: add a green Event node'),
      h('small', { class: 'sc-n' }, `${g.nodes.length} node${g.nodes.length === 1 ? '' : 's'} · ${(g.links || []).length} wire${(g.links || []).length === 1 ? '' : 's'}`)),
    h('button', { class: 'sc-more', title: 'Script options', onclick: (ev2) => { ev2.stopPropagation(); menu(ev2.currentTarget); } }, icon('more')));
}
function renderScripts() {
  const box = $('#scripts'); if (!box) return;
  const all = allGraphs(), q = scriptQuery.trim().toLowerCase();
  const match = (x) => !q || [x.e.name, x.name, ...(x.e.tags || []), scriptOf(x.t)?.name, ...graphEvents(x.t.graph), ...(x.t.graph?.nodes || []).map((n) => NODE_TYPES[n.type]?.label)].some((t) => String(t || '').toLowerCase().includes(q));
  const shown = all.filter(match), here = shown.filter((x) => x.li === levelIdx), other = shown.filter((x) => x.li !== levelIdx);
  const saved = userScripts();
  const sel = ent(selectedId);
  const search = all.length > 3 ? h('input', { class: 'sc-search', type: 'search', placeholder: `Search ${all.length} scripts (object, event or node)`, value: scriptQuery, autocapitalize: 'off',
    oninput: (ev) => { scriptQuery = ev.target.value; const pos = ev.target.selectionStart; renderScripts(); const n = $('#scripts .sc-search'); n?.focus(); n?.setSelectionRange(pos, pos); } }) : null;
  const parts = [
    h('div', { class: 'sc-top' },
      h('button', { class: 'btn primary sc-new', onclick: () => { addVisualScript(); } }, icon('plus'), sel && !sel.template ? `New Script on ${sel.name || 'object'}` : 'New Visual Script'),
      search),
  ];
  if (!all.length) parts.push(h('div', { class: 'sc-empty' }, icon('nodes'), h('b', {}, 'No Visual Scripts yet'),
    h('span', {}, 'Visual Scripts make things happen with nodes: “On Tap → Add to Score → Play Sound”. Every script in your game shows up here, so you can open it with one tap.')));
  else if (!shown.length) parts.push(h('div', { class: 'empty' }, `No script matches “${scriptQuery}”.`));
  if (here.length) parts.push(h('div', { class: 'sc-head' }, levelList().length > 1 ? `This level · ${levelName(project, levelIdx)}` : 'In this game', h('small', {}, String(here.length))), ...here.map(scriptCard));
  if (other.length) {
    const byLevel = new Map(); for (const x of other) (byLevel.get(x.li) || byLevel.set(x.li, []).get(x.li)).push(x);
    for (const [li, xs] of byLevel) parts.push(h('div', { class: 'sc-head' }, levelName(levelList()[li], li), h('small', {}, String(xs.length))), ...xs.map(scriptCard));
  }
  if (saved.length && !q) {
    parts.push(h('div', { class: 'sc-head' }, 'Saved scripts', h('small', {}, 'reuse on any object')));
    for (const sc of saved) {
      let uses = 0; eachScriptUse(sc.id, () => uses++);
      parts.push(h('div', { class: 'sc-saved' }, h('span', { class: 'sc-sic' }, icon('link')),
        h('span', { class: 'sc-info' }, h('b', {}, sc.name), h('small', {}, `${sc.graph.nodes.length} nodes · used ${uses} time${uses === 1 ? '' : 's'}`)),
        h('button', { class: 'btn', disabled: !sel, title: sel ? `Add to ${sel.name}` : 'Select an object first', onclick: () => { const j = ent(selectedId); if (!j) { toast('Select an object first'); return; } addSavedScript(j, sc); changed({ structure: true }); pushHistory(); renderScripts(); toast(`Added “${sc.name}” to ${j.name}`); } }, icon('plus'), 'Add'),
        h('button', { class: 'sc-more', title: 'More', onclick: (ev) => popMenu(ev.currentTarget, [
          { cap: sc.name },
          { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Script name', sc.name); if (!n?.trim()) return; sc.name = n.trim(); saveScriptToLibrary(sc); changed(); renderScripts(); } },
          { icon: 'trash', label: 'Delete Saved Script', fn: () => {
            if (!confirm(`Delete “${sc.name}”? Objects using it keep their own copy.`)) return;
            eachScriptUse(sc.id, (b) => delete b.scriptRef); root.scripts = userScripts().filter((q2) => q2 !== sc);
            changed({ structure: true }); pushHistory(); renderScripts();
          } },
        ]) }, icon('more'))));
    }
  }
  box.replaceChildren(...parts);
}

// ---- bottom sheet (phones): peek / half / full ----
function setSheet(state) {
  const app = $('#app');
  if (app.dataset.sheet === state) return;
  app.dataset.sheet = state;
  markTabs();
}
/** The bottom tabs work like an app's navigation bar: Scene is lit while the panel is down. */
function markTabs() {
  const st = $('#app').dataset.sheet;
  for (const b of $$('#dockTabs button')) b.classList.toggle('active', st === 'peek' ? b.dataset.dock === 'scene' : b.dataset.dock === dockTab);
  // a dot on Inspector while something is selected and the Inspector isn't showing: one tap edits it
  const ins = $('#dockTabs [data-dock="inspector"]');
  if (ins) { let dot = ins.querySelector('.sel-dot'); const want = !!selectedId && selectedId !== SCENE_ID; if (want && !dot) ins.append(h('span', { class: 'sel-dot' })); else if (!want && dot) dot.remove(); }
}
const sheetState = () => $('#app').dataset.sheet || 'half';
{
  const handle = $('#sheetHandle'), app = $('#app');
  let drag = null;
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, h: $('#sheet').getBoundingClientRect().height, moved: false };
    app.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 4) drag.moved = true;
    const hgt = Math.max(70, Math.min(window.innerHeight - 90, drag.h - dy));
    app.style.setProperty('--sheet-h', hgt + 'px');
  });
  const end = () => {
    if (!drag) return;
    app.classList.remove('dragging');
    const hgt = parseFloat(app.style.getPropertyValue('--sheet-h')) || drag.h, H = window.innerHeight;
    app.style.removeProperty('--sheet-h');
    if (!drag.moved) setSheet(sheetState() === 'peek' ? 'half' : sheetState() === 'half' ? 'full' : 'peek');
    else { const st = hgt < H * 0.25 ? 'peek' : hgt < H * 0.66 ? 'half' : 'full'; setSheet(st); if (st !== 'peek') store.set('pocket.editor.panel', st); }
    drag = null;
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function select(id, { fromScene = false } = {}) {
  selectedId = id === SCENE_ID || ent(id) ? id : null;
  engine.editSelected = selectedId; // a Side Menu previews open only while it's selected
  $('#app')?.classList.toggle('has-sel', !!selectedId && selectedId !== SCENE_ID);
  if (colliderEdit && colliderEdit !== selectedId) colliderEdit = null;
  renderHierarchy();
  renderInspector();
  updateCtxBar();
  markTabs();
  if (selectedId && fromScene && dockTab === 'hierarchy' && sheetState() !== 'peek') setDock('inspector');
}

/** Quick actions for the selected object, floating over the Scene view. */
/** The selection bar floats just above the selected object (below it near the top of the Scene), so it never covers what you are editing. */
let ctxPos = '';
function placeCtxBar(s) {
  const bar = $('#ctxBar'); if (!bar || bar.hidden) return;
  const e = s.byId(selectedId); if (!e) return;
  let x, top, bot;
  if (e.ui) { const b = uiBounds(e); x = b.x; top = b.y - b.hy; bot = b.y + b.hy; }
  else { const p = toScreen(e); if (!p) return; let hy = 30; if (!is3D()) { const b = boundsOf(e), z = engine.renderer.zoomFor(s); hy = (b.sphere ? b.r : b.hy) * z; } x = p.x; top = p.y - hy; bot = p.y + hy; }
  const W = engine.width, H = engine.height, bw = bar.offsetWidth || 240, bh = bar.offsetHeight || 54, gap = e.ui ? 14 : GIZ + 22; // room for the move arrows
  let y = top - gap - bh; if (y < 64) y = Math.min(bot + gap, H - bh - 84); // too close to the top: put it underneath
  y = Math.max(8, Math.min(y, H - bh - 84)); x = Math.max(bw / 2 + 8, Math.min(x, W - bw / 2 - 8));
  const k = `${Math.round(x)},${Math.round(y)}`; if (k === ctxPos) return; ctxPos = k;
  bar.style.left = Math.round(x) + 'px'; bar.style.top = Math.round(y) + 'px';
}
function updateCtxBar() {
  const bar = $('#ctxBar'), j = ent(selectedId);
  bar.hidden = !j || playing || !!attachFor;
  if (j) $('#hint').hidden = true;
  if (j) { $('#ctxBar [data-act="detach"]').hidden = !j.parent; $('#ctxBar [data-act="attach"]').hidden = !parentChoices(j).length; }
}
// ---- Attach mode: tap "Attach", then tap the object (in the scene or the Hierarchy) it should go inside ----
function startAttach(id) {
  const j = ent(id); if (!j) return;
  if (!parentChoices(j).length) { toast(j.ui ? 'Add another UI element first' : 'Add another object first'); return; }
  attachFor = id;
  const bar = $('#attachBar');
  bar.querySelector('span').textContent = `Tap the object to put “${j.name || 'Object'}” inside`;
  bar.hidden = false; buzz(8); updateCtxBar(); renderHierarchy();
}
function endAttach(targetId) {
  const id = attachFor; if (!id) return false;
  attachFor = null; $('#attachBar').hidden = true;
  if (targetId && targetId !== id) setParent(id, targetId);
  else if (targetId === id) toast('Pick a different object');
  updateCtxBar(); renderHierarchy();
  return true;
}
function ctxAction(act) {
  const j = ent(selectedId); if (!j) return;
  if (act === 'inspect') { if (!isDesktop()) { setDock('inspector'); if (sheetState() === 'peek') setSheet('half'); } }
  else if (act === 'duplicate') duplicateEntity(j.id);
  else if (act === 'focus') frameSelected();
  else if (act === 'delete') deleteEntity(j.id);
  else if (act === 'attach') startAttach(j.id);
  else if (act === 'detach') setParent(j.id, null);
}
/** Step through objects in the Inspector with ‹ ›. */
function stepSelection(d) {
  const list = project.entities;
  if (!list.length) return;
  const i = list.findIndex((e) => e.id === selectedId);
  select(list[(i + d + list.length) % list.length].id);
}

function refreshAll() {
  $('#sceneTab').replaceChildren(icon(uiMode ? 'hud' : is3D() ? 'cube' : 'grid'), uiMode ? 'UI' : viewMode === 'top' ? 'Top' : is3D() ? '3D' : '2D', icon('chevron'));
  $('#projectTitle').textContent = levelList()[0].name || 'Untitled';
  const n = levelList().length;
  $('#levelBtn').replaceChildren(...[icon('layers'), h('span', {}, levelName(project, levelIdx)), n > 1 && h('small', {}, `${levelIdx + 1}/${n}`), icon('chevron')].filter(Boolean));
  renderHierarchy(); renderInspector(); renderProject(); updateUndoButtons(); updateCtxBar(); if (dockTab === 'scripts') renderScripts();
}

// ============================================================================
// Hierarchy
// ============================================================================
let hFilter = '';
function iconFor(e) {
  if (!e) return 'scene';
  if (e.voxels || e.tiles) return 'grid';
  if ((e.behaviors || []).some((b) => b.type === 'camera')) return 'camera';
  if (e.sun || e.globalLight) return 'sun';
  if (e.light && !e.shape && !e.mesh && !e.model) return 'bulb';
  if (e.model) return 'cube';
  if (e.bar) return 'hud';
  if (e.ui) return 'hud';
  if (e.mesh) return ({ box: 'cube', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', plane: 'plane' })[e.mesh.geometry] || 'cube';
  if (e.shape) return ({ rect: 'square', circle: 'circle', triangle: 'triangle', star: 'star' })[e.shape.type] || 'square';
  if (e.text) return 'text';
  if (e.sprite) return 'image';
  return 'gear';
}
/** Short component names shown under each object in the Hierarchy. */
function compBadges(e) {
  const out = [];
  if (e.body) out.push(e.body.type === 'static' ? 'Static' : e.body.sensor ? 'Trigger' : 'Rigidbody');
  if (e.light) out.push('Light');
  if (e.model) out.push('Model');
  if (e.tiles) out.push('Tilemap');
  if (e.collider && !e.body) out.push(e.collider.trigger ? 'Trigger' : 'Collider');
  for (const b of e.behaviors || []) { const d = Behaviors[b.type]; if (d) out.push(d.label.replace(/ \(.*\)$/, '')); }
  return out;
}
const KIND_TINT = { player: '#4fc3f7', ui: '#ce93d8', logic: '#ffca28', camera: '#80cbc4', light: '#fff59d', template: '#9e9e9e' };
function kindOf(e) {
  if (e.template) return 'template';
  if ((e.tags || []).includes('player')) return 'player';
  if (e.ui) return 'ui';
  if ((e.behaviors || []).some((b) => b.type === 'camera')) return 'camera';
  if ((e.light || e.sun || e.globalLight) && !hasVisual(e)) return 'light';
  if ((e.behaviors || []).some((b) => ['triggers', 'fsm', 'graph', 'rules', 'script'].includes(b.type))) return 'logic';
  return '';
}
const H_FILTERS = [['all', 'All'], ['player', 'Player'], ['logic', 'Logic'], ['physics', 'Physics'], ['ui', 'UI'], ['template', 'Templates']];
let hKind = 'all';
const closedFolders = new Set();
const closedKids = new Set(); // parents whose children are folded away in the Hierarchy
/** Drag an object's grip onto another row to put it inside, or onto the top row to take it out. */
function startRowDrag(ev, id) {
  ev.stopPropagation(); ev.preventDefault();
  const grip = ev.currentTarget, j = ent(id); if (!j) return;
  grip.setPointerCapture(ev.pointerId);
  const ghost = h('div', { class: 'h-ghost' }, icon('layers'), j.name || 'Object');
  document.body.append(ghost);
  let over = null;
  const at = (e) => { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; };
  const target = (e) => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.h-row, .h-folder'); return el && el.dataset.id !== id ? el : null; };
  at(ev); buzz(8);
  const move = (e) => { at(e); const t = target(e); if (t !== over) { over?.classList.remove('drop'); over = t; over?.classList.add('drop'); } };
  const up = (e) => {
    grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up);
    ghost.remove(); over?.classList.remove('drop');
    const t = e.type === 'pointerup' ? target(e) : null;
    if (!t) return;
    if (t.classList.contains('scene')) { if (j.parent) setParent(id, null); return; }
    if (t.dataset.folder) { if (j.parent) setParent(id, null); j.folder = t.dataset.folder; changed({ structure: true }); pushHistory(); return; }
    if (t.dataset.id) setParent(id, t.dataset.id);
  };
  grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
}
function hMatch(e) {
  if (uiMode && !e.ui) return false;
  if (hFilter && !(e.name || '').toLowerCase().includes(hFilter) && !(e.tags || []).some((t) => t.includes(hFilter)) && !compBadges(e).some((c) => c.toLowerCase().includes(hFilter))) return false;
  if (hKind.startsWith('tag:')) return (e.tags || []).includes(hKind.slice(4));
  if (hKind.startsWith('layer:')) return layerOf(e) === +hKind.slice(6);
  if (hKind === 'physics') return !!e.body;
  if (hKind === 'logic') return kindOf(e) === 'logic' || (e.behaviors || []).some((b) => ['triggers', 'fsm', 'graph', 'rules'].includes(b.type));
  return hKind === 'all' || kindOf(e) === hKind;
}
function renderHierarchy() {
  const box = $('#hierarchy');
  const scroll = box.scrollTop;
  box.replaceChildren();
  const search = h('input', { type: 'text', placeholder: 'Search', value: hFilter, autocapitalize: 'off',
    oninput: (e) => { hFilter = e.target.value.toLowerCase(); renderRows(); } });
  const kindLabel = hKind.startsWith('tag:') ? `tag “${hKind.slice(4)}”` : hKind.startsWith('layer:') ? `layer “${layerNames()[+hKind.slice(6)]}”` : H_FILTERS.find(([k]) => k === hKind)?.[1] || 'All';
  const filterBtn = h('button', { class: 'h-filter-btn' + (hKind !== 'all' ? ' on' : ''), title: 'Show only…',
    onclick: (e) => { const usedTags = [...new Set(project.entities.flatMap((q) => q.tags || []))].sort(), usedLayers = [...new Set(project.entities.map(layerOf))].sort((a, b) => a - b);
      popMenu(e.currentTarget, [{ cap: 'Show' }, ...H_FILTERS.map(([k, l]) => ({ icon: k === hKind ? 'check' : 'list', label: k === 'all' ? 'Everything' : l, fn: () => { hKind = k; renderHierarchy(); } })),
        usedTags.length && { cap: 'With tag' }, ...usedTags.map((t) => ({ icon: hKind === 'tag:' + t ? 'check' : 'key', label: t, fn: () => { hKind = 'tag:' + t; renderHierarchy(); } })),
        { cap: 'On layer' }, ...usedLayers.map((i) => ({ icon: hKind === 'layer:' + i ? 'check' : 'layers', label: `${i} · ${layerNames()[i]}`, fn: () => { hKind = 'layer:' + i; renderHierarchy(); } })),
        '-', { icon: 'gear', label: 'Tags & Layers…', fn: openTagsLayers }].filter(Boolean)); } },
    icon('list'), hKind === 'all' ? '' : kindLabel);
  const selBtn = h('button', { class: 'h-sel-btn' + (multi ? ' on' : ''), title: 'Select several objects', onclick: () => { multi = multi ? null : new Set(selectedId && ent(selectedId) ? [selectedId] : []); renderHierarchy(); } }, icon('check'));
  box.append(h('div', { class: 'h-tools' }, h('button', { onclick: () => openCreate() }, icon('plus'), 'Create'), search, filterBtn, selBtn));
  if (hKind !== 'all') box.append(h('div', { class: 'h-active' }, `Showing ${kindLabel} only`, h('button', { onclick: () => { hKind = 'all'; renderHierarchy(); } }, icon('close'), 'Show all')));
  const rows = h('div');
  box.append(rows);
  const gs = gettingStarted(); // after the list, so your objects come first
  if (gs) box.append(gs);
  const row = (e, depth = 0) => {
    const badges = compBadges(e), kind = kindOf(e), kids = kidsOf(e.id).length, shut = closedKids.has(e.id);
    const parentName = depth === 0 && e.parent && ent(e.parent)?.name;
    return h('div', {
      class: 'h-row' + (e.prefab ? ' pf' : '') + (e.id === selectedId ? ' sel' : '') + (e.visible === false ? ' off' : '') + (e.template ? ' tpl' : '') + (e.folder && !depth ? ' in-folder' : ''),
      'data-id': e.id, style: depth ? `padding-left:${14 + depth * 26}px;--tree:${depth * 26}px` : '',
      onclick: () => { if (multi) { multi.has(e.id) ? multi.delete(e.id) : multi.add(e.id); renderRows(); renderMultiBar(); } else if (attachFor) endAttach(e.id); else if (selectedId === e.id && !isDesktop()) setDock('inspector'); else select(e.id); },
    },
    multi ? h('span', { class: 'h-check' + (multi.has(e.id) ? ' on' : '') }, multi.has(e.id) ? icon('check') : null) : '',
    depth ? h('span', { class: 'h-branch' }) : '',
    kids ? h('button', { class: 'h-twisty' + (shut ? ' shut' : ''), title: shut ? 'Show children' : 'Hide children', onclick: (ev) => { ev.stopPropagation(); shut ? closedKids.delete(e.id) : closedKids.add(e.id); renderHierarchy(); } }, icon('chevron')) : h('span', { class: 'h-twisty-sp' }),
    h('span', { class: 'h-ico', style: kind ? `color:${KIND_TINT[kind]};background:${KIND_TINT[kind]}22` : '' }, icon(iconFor(e))),
    h('span', { class: 'h-txt' },
      h('span', { class: 'nm' }, e.name || 'Object', e.template && h('span', { class: 'tagchip' }, 'template'), (e.tags || []).includes('player') && h('span', { class: 'tagchip' }, 'player')),
      (badges.length || kids || parentName) ? h('span', { class: 'h-sub' }, [parentName && `in ${parentName}`, kids && `${kids} child${kids > 1 ? 'ren' : ''}`, ...badges.slice(0, 3)].filter(Boolean).join(' · ') + (badges.length > 3 ? ` +${badges.length - 3}` : '')) : ''),
    e.locked && h('button', { class: 'eye', title: 'Unlock', onclick: (ev) => { ev.stopPropagation(); e.locked = false; changed({ structure: true }); } }, icon('key')),
    h('button', { class: 'eye', title: 'Toggle visibility', onclick: (ev) => { ev.stopPropagation(); e.visible = e.visible === false; changed({ structure: true }); } }, icon(e.visible === false ? 'eyeoff' : 'eye')),
    e.id === selectedId && h('button', { class: 'eye', title: 'More actions', onclick: (ev) => { ev.stopPropagation(); openObjectMenu(e.id, 0, 0, ev.currentTarget); } }, icon('more')),
    h('button', { class: 'eye h-grip', title: 'Drag onto another object to make it a child', onpointerdown: (ev) => startRowDrag(ev, e.id), onclick: (ev) => ev.stopPropagation() }, icon('move')));
  };
  const tree = (list) => { // parents with their children folded underneath; 3+ top-level copies of one name fold into a group
    const inList = new Set(list.map((e) => e.id)), out = [];
    const walk = (e, d) => { out.push([e, d]); if (!closedKids.has(e.id)) for (const k of kidsOf(e.id)) if (inList.has(k.id)) walk(k, d + 1); };
    const tops = list.filter((e) => !e.parent || !inList.has(e.parent)), count = new Map();
    for (const e of tops) count.set(e.name || 'Object', (count.get(e.name || 'Object') || 0) + 1);
    const done = new Set();
    for (const e of tops) {
      const nm = e.name || 'Object';
      if (count.get(nm) < 3) { walk(e, 0); continue; }
      if (done.has(nm)) continue;
      done.add(nm);
      const members = tops.filter((q) => (q.name || 'Object') === nm), gk = (e.folder || '') + '/' + nm;
      out.push(['group', { key: gk, name: nm, members }]);
      if (openDups.has(gk)) for (const m of members) walk(m, 1);
    }
    return out;
  };
  const groupRow = (g) => {
    const shut = !openDups.has(g.key), first = g.members[0], kind = kindOf(first), badges = compBadges(first), vis = g.members.some((m) => m.visible !== false);
    const allOn = multi && g.members.every((m) => multi.has(m.id)), fold = () => { shut ? openDups.add(g.key) : openDups.delete(g.key); renderRows(); };
    return h('div', { class: 'h-row h-group' + (g.members.some((m) => m.id === selectedId) ? ' has-sel' : ''),
      onclick: () => { if (!multi) return fold(); for (const m of g.members) allOn ? multi.delete(m.id) : multi.add(m.id); renderRows(); renderMultiBar(); } },
      multi ? h('span', { class: 'h-check' + (allOn ? ' on' : '') }, allOn ? icon('check') : null) : '',
      h('button', { class: 'h-twisty' + (shut ? ' shut' : ''), onclick: (ev) => { ev.stopPropagation(); fold(); } }, icon('chevron')),
      h('span', { class: 'h-ico', style: kind ? `color:${KIND_TINT[kind]};background:${KIND_TINT[kind]}22` : '' }, icon(iconFor(first))),
      h('span', { class: 'h-txt' }, h('span', { class: 'nm' }, g.name, h('span', { class: 'h-count' }, '×' + g.members.length)),
        h('span', { class: 'h-sub' }, [multi ? 'tap to select all' : shut ? 'tap to show all' : 'tap to fold', ...badges.slice(0, 2)].join(' · '))),
      h('button', { class: 'eye', title: vis ? 'Hide all' : 'Show all', onclick: (ev) => { ev.stopPropagation(); for (const m of g.members) m.visible = !vis; changed({ structure: true }); } }, icon(vis ? 'eye' : 'eyeoff')));
  };
  const rowsOf = (items) => tree(items).map(([e, d]) => (e === 'group' ? groupRow(d) : row(e, d)));
  function renderRows() {
    const list = project.entities.filter(hMatch), flat = !!hFilter || hKind !== 'all';
    const topOf = (e) => { let q = e, n = 0; while (q.parent && ent(q.parent) && n++ < 60) q = ent(q.parent); return q; }, folderOf = (e) => (flat ? e.folder : topOf(e).folder);
    const folders = [...new Set(list.map(folderOf).filter(Boolean))];
    rows.replaceChildren(...[
      h('div', { class: 'h-row scene' + (selectedId === SCENE_ID ? ' sel' : ''), onclick: () => select(SCENE_ID) }, h('span', { class: 'h-ico' }, icon('scene')),
        h('span', { class: 'h-txt' }, h('span', { class: 'nm' }, levelList().length > 1 ? `${levelList()[0].name || 'Untitled'} › ${levelName(project, levelIdx)}` : levelList()[0].name || 'Untitled'),
          h('span', { class: 'h-sub' }, `${project.entities.length} objects · ${is3D() ? '3D' : '2D'} · settings`))),
      uiMode && h('div', { class: 'h-cap' }, 'UI editor: screen elements only'),
      ...folders.flatMap((f) => {
        const items = list.filter((e) => folderOf(e) === f), shut = closedFolders.has(f);
        return [h('div', { class: 'h-folder' + (shut ? ' shut' : ''), 'data-folder': f, onclick: () => { shut ? closedFolders.delete(f) : closedFolders.add(f); renderRows(); } },
          icon('chevron'), icon('folder'), h('span', { class: 'nm' }, f), h('span', { class: 'h-count' }, items.length),
          h('button', { class: 'eye', title: 'Folder options', onclick: (ev) => { ev.stopPropagation(); popMenu(ev.currentTarget, [
            { icon: 'edit', label: 'Rename Folder…', fn: () => { const n = prompt('Folder name', f); if (n == null) return; for (const e of project.entities) if (e.folder === f) e.folder = n.trim() || undefined; changed({ structure: true }); } },
            { icon: 'eyeoff', label: 'Hide / Show All', fn: () => { const vis = items.some((e) => e.visible !== false); for (const e of items) e.visible = !vis; changed({ structure: true }); } },
            { icon: 'close', label: 'Remove Folder (keep objects)', fn: () => { for (const e of project.entities) if (e.folder === f) delete e.folder; changed({ structure: true }); } },
          ]); } }, icon('more'))),
        ...(shut ? [] : rowsOf(items))];
      }),
      ...(flat ? list.filter((e) => !e.folder).map((e) => row(e, 0)) : rowsOf(list.filter((e) => !folderOf(e)))),
      !list.length && h('div', { class: 'empty' }, hFilter || hKind !== 'all' ? 'Nothing matches.' : 'No objects yet. Tap Create or the blue + button.'),
    ].filter(Boolean));
  }
  if (selectedId && selectedId !== hRevealed) reveal(selectedId); // newly selected (maybe in the Scene): unfold its way and scroll to it
  box.classList.toggle('multi-on', !!multi);
  renderRows();
  renderMultiBar();
  box.scrollTop = scroll;
  if (selectedId && selectedId !== hRevealed) { hRevealed = selectedId; box.querySelector(`.h-row[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' }); }
}
/** Open whatever hides `id` in the Hierarchy: folded parents, its folder, its group of copies. */
function reveal(id) {
  let q = ent(id), n = 0;
  while (q?.parent && n++ < 60) { closedKids.delete(q.parent); q = ent(q.parent); }
  if (!q) return;
  if (q.folder) closedFolders.delete(q.folder);
  openDups.add((q.folder || '') + '/' + (q.name || 'Object'));
}

// ---- parenting (make one object a child of another) ----
const kidsOf = (id) => project.entities.filter((e) => e.parent === id);
function isInside(id, ancestorId) { let q = ent(id), n = 0; while (q?.parent && n++ < 60) { if (q.parent === ancestorId) return true; q = ent(q.parent); } return false; }
function subtree(id) { const out = [id]; for (const k of kidsOf(id)) out.push(...subtree(k.id)); return out; }
/** Objects that `j` could be put inside (not itself or its own children; UI only inside UI). */
const parentChoices = (j) => project.entities.filter((e) => e.id !== j.id && !isInside(e.id, j.id) && !!e.ui === !!j.ui && !e.template);
/** Make `id` a child of `pid` (or move it back to the top level with null), keeping where it is on screen. */
function setParent(id, pid, { batch = false } = {}) {
  const j = ent(id); if (!j) return;
  const pj = pid ? ent(pid) : null;
  if (pid && (pid === id || isInside(pid, id))) { toast('An object can’t go inside its own child'); return; }
  if (pj && !!pj.ui !== !!j.ui) { toast(j.ui ? 'UI can only go inside other UI' : 'Game objects can’t go inside UI'); return; }
  const live = engine.scene.byId(id), lp = pid ? engine.scene.byId(pid) : null, mode = engine.scene.mode, r3 = (v) => round(v, 3);
  if (j.ui) {
    const before = live ? uiBox(live, UIS().w, UIS().h, UIS().safe) : null;
    if (pid) j.parent = pid; else delete j.parent;
    rebuild();
    const nl = engine.scene.byId(id);
    if (before && nl) { const S = UIS(), o = uiOrigin(nl, S.w, S.h, S.safe), ex = nl.extents(); j.x = Math.round(before.x - o.x - (ex.ox || 0)); j.y = Math.round(before.y - o.y - (ex.oy || 0)); }
  } else if (live) {
    const W = [live.x, live.y, live.z], rot = [live.rx, live.ry, live.rz], sc = [live.sx, live.sy, live.sz];
    const L = lp ? worldToLocal(lp, W[0], W[1], W[2], mode) : W;
    j.x = r3(L[0]); j.y = r3(L[1]); if (is3D()) j.z = r3(L[2]);
    ['rx', 'ry', 'rz'].forEach((k, i) => { const v = r3(rot[i] - (lp ? lp[k] : 0)); if (v || j[k] != null) j[k] = v; });
    ['sx', 'sy', 'sz'].forEach((k, i) => { const v = r3(sc[i] / (lp ? lp[k] || 1 : 1)); if (v !== 1 || j[k] != null) j[k] = v; });
    if (pid) j.parent = pid; else delete j.parent;
  } else if (pid) j.parent = pid; else delete j.parent;
  if (pid) { // keep children listed (and drawn) right after their parent
    const L = project.entities, ids = subtree(id), moving = L.filter((e) => ids.includes(e.id));
    for (const m of moving) L.splice(L.indexOf(m), 1);
    const at = L.indexOf(pj) + 1 + subtree(pid).filter((x) => x !== pid && L.some((e) => e.id === x)).length;
    L.splice(at, 0, ...moving);
    closedKids.delete(pid);
  }
  if (batch) return;
  changed({ structure: true }); pushHistory();
  toast(pid ? `${j.name} is now inside ${pj.name}` : `${j.name} moved to the top level`);
}
function addChild(pid) {
  const pj = ent(pid); if (!pj) return;
  const c = { id: uid(), name: pj.ui ? 'Child UI' : 'Child', parent: pid, x: pj.ui ? 0 : is3D() ? 0 : 0, y: is3D() ? 1 : pj.ui ? 0 : -50, ...(pj.ui ? { ui: true, anchor: 'center', text: { value: 'Text', size: 18, color: '#ffffff' } } : is3D() ? { mesh: { geometry: 'box', w: 0.5, h: 0.5, d: 0.5, color: '#90caf9' } } : { shape: { type: 'rect', w: 30, h: 30, fill: '#90caf9' } }) };
  const L = project.entities; L.splice(L.indexOf(pj) + subtree(pid).length, 0, c);
  closedKids.delete(pid); selectedId = c.id;
  changed({ structure: true }); pushHistory(); toast(`Added a child to ${pj.name}`);
}
/** Objects that could be put inside `j` (not its parents or children, same kind: UI with UI). */
const childChoices = (j) => project.entities.filter((e) => e.id !== j.id && e.parent !== j.id && !isInside(j.id, e.id) && !!e.ui === !!j.ui && !e.template);
/** Inspector card: the object's children, each with a one-tap remove, plus New Child / Add Existing. */
function kidsCard(j) {
  const kids = kidsOf(j.id);
  return h('div', { class: 'kids' },
    h('div', { class: 'kids-h' }, icon('child'), h('b', {}, 'Children'), h('small', {}, kids.length ? String(kids.length) : 'none')),
    kids.map((k) => h('div', { class: 'kid' },
      h('button', { class: 'kid-nm', onclick: () => select(k.id) }, icon(iconFor(k)), h('span', {}, k.name || 'Object')),
      h('button', { class: 'kid-x', title: `Take ${k.name} out of ${j.name}`, onclick: () => setParent(k.id, null) }, icon('unlink'), 'Remove'))),
    h('div', { class: 'kids-btns' },
      h('button', { class: 'btn', onclick: () => addChild(j.id) }, icon('plus'), 'New Child'),
      h('button', { class: 'btn', onclick: (ev) => addExistingMenu(j, ev.currentTarget) }, icon('link'), 'Add Existing')));
}
function addExistingMenu(j, anchor) {
  const opts = childChoices(j);
  popMenu(anchor, [
    { cap: `Put inside “${j.name}”…` },
    ...(opts.length ? opts.map((e) => ({ icon: iconFor(e), label: e.name || 'Object', fn: () => setParent(e.id, j.id) })) : [{ cap: j.ui ? 'No other UI to add' : 'No other objects to add' }]),
  ]);
}
function parentMenu(j, anchor) {
  const opts = parentChoices(j);
  popMenu(anchor || { left: window.innerWidth / 2 - 110, top: window.innerHeight / 3, bottom: window.innerHeight / 3 }, [
    { cap: `Put “${j.name}” inside…` },
    ...(opts.length ? opts.map((e) => ({ icon: iconFor(e), label: e.name || 'Object', fn: () => setParent(j.id, e.id) })) : [{ cap: j.ui ? 'Add another UI element first' : 'Add another object first' }]),
    j.parent && '-', j.parent && { icon: 'upload', label: 'Move to Top Level', fn: () => setParent(j.id, null) },
  ]);
}

function moveToFolder(j) {
  const list = Array.isArray(j) ? j : [j];
  const existing = [...new Set(project.entities.map((e) => e.folder).filter(Boolean))];
  const pick = (f) => { for (const q of list) { if (f) q.folder = f; else delete q.folder; } changed({ structure: true }); pushHistory(); };
  popMenu({ left: window.innerWidth / 2 - 110, top: window.innerHeight / 3, bottom: window.innerHeight / 3 }, [
    { cap: 'Folder' }, ...existing.map((f) => ({ icon: 'folder', label: f, fn: () => pick(f) })),
    { icon: 'plus', label: 'New Folder…', fn: () => { const n = prompt('Folder name', is3D() ? 'Environment' : 'Level'); if (n?.trim()) pick(n.trim()); } },
    list.some((q) => q.folder) && { icon: 'close', label: 'No Folder', fn: () => pick('') },
  ]);
}

/** A short checklist that walks new users through making a playable game. */
function gettingStarted() {
  const key = 'pocket.editor.gs.' + projectId;
  if (store.get(key, '') === 'hide' || uiMode) return null;
  const E = project.entities, has = (f) => E.some(f), beh = (e, t) => (e.behaviors || []).some((b) => b.type === t);
  const P = is3D() ? PREFABS_3D : PREFABS_2D, pf = (...labels) => labels.map((l) => P.find((q) => q.label === l)).find(Boolean);
  const steps = [
    { done: has((e) => (e.tags || []).includes('player')), label: 'Add a player', btn: 'Player', fn: () => addPrefab(pf('Player')) },
    { done: has((e) => e.body?.type === 'static' || e.voxels), label: 'Add ground to stand on', btn: 'Platform', fn: () => addPrefab(pf('Platform')) },
    { done: has((e) => ['collectible', 'hazard', 'tappable', 'goal'].some((t) => beh(e, t))), label: 'Add something to collect', btn: is3D() ? 'Gem' : 'Coin', fn: () => addPrefab(pf('Coin', 'Gem')) },
    { done: has((e) => ['graph', 'rules', 'triggers', 'fsm'].some((t) => beh(e, t))), label: 'Add some logic', btn: 'Triggers', fn: () => addLogic('triggers') },
    { done: store.get('pocket.editor.played.' + projectId, '') === '1', label: 'Press Play to test', btn: 'Play', fn: play },
  ];
  const n = steps.filter((x) => x.done).length;
  if (n === steps.length) return null;
  const open = store.get(key + '.open', '') === '1', next = steps.find((x) => !x.done);
  const toggle = () => { store.set(key + '.open', open ? '' : '1'); renderHierarchy(); };
  const close = h('button', { class: 'gs-x', title: 'Hide', onclick: (ev) => { ev.stopPropagation(); store.set(key, 'hide'); renderHierarchy(); } }, icon('close'));
  if (!open) return h('div', { class: 'gs mini', onclick: toggle }, // one line: progress + the next step
    h('span', { class: 'gs-ring', style: `--p:${(n / steps.length) * 100}%` }, `${n}/${steps.length}`),
    h('span', { class: 'gs-l' }, h('small', {}, 'Next step'), next.label),
    h('button', { class: 'gs-go', onclick: (ev) => { ev.stopPropagation(); next.fn(); } }, next.btn), close);
  return h('div', { class: 'gs' },
    h('div', { class: 'gs-hd', onclick: toggle }, icon('chevron'), h('b', {}, 'Getting started'), h('span', { class: 'gs-n' }, `${n} / ${steps.length}`), close),
    h('div', { class: 'gs-bar' }, h('i', { style: `width:${(n / steps.length) * 100}%` })),
    steps.map((x) => h('div', { class: 'gs-step' + (x.done ? ' done' : '') },
      h('span', { class: 'gs-dot' }, x.done ? icon('check') : null), h('span', { class: 'gs-l' }, x.label),
      !x.done && h('button', { class: 'gs-go', onclick: x.fn }, x.btn))));
}

/** Add a Visual Script to the selected object (or the player, or a new logic object) and open the Node Editor. */
function addVisualScript() {
  let j = ent(selectedId);
  if (!j || j.template) j = project.entities.find((e) => (e.tags || []).includes('player'));
  if (!j) j = addEntity({ name: 'Game Logic', ...(is3D() ? { y: 0 } : {}) });
  const b = defaultBehavior('graph', is3D() && !j.ui);
  if (!(j.tags || []).includes('player') && !j.ui && !hasVisual(j)) // no shape to tap: start from a timer instead
    b.graph = { nodes: [{ id: 'n1', type: 'every', x: 20, y: 40, params: { seconds: 1 } }, { id: 'n2', type: 'addVar', x: 330, y: 20, params: { name: 'score', amount: 1 } }],
      links: [{ from: { node: 'n1', port: 'then' }, to: { node: 'n2', port: 'in' } }] };
  const bi = (j.behaviors || []).findIndex((q) => q.type === 'graph');
  selectedId = j.id;
  if (bi >= 0) { // it already has a Visual Script component: add another script inside it
    const host = j.behaviors[bi]; (host.scripts ||= []).push({ id: uid('gs'), name: `Script ${host.scripts.length + 2}`, graph: b.graph });
    changed({ structure: true }); pushHistory();
    editGraph(() => ent(j.id) || {}, `behaviors.${bi}.scripts.${host.scripts.length - 1}.graph`); return;
  }
  (j.behaviors ||= []).push(b);
  changed({ structure: true }); pushHistory();
  editGraph(() => ent(j.id) || {}, `behaviors.${j.behaviors.length - 1}.graph`);
}

/** The Create screen: everything you can add, in big, easy groups. Search, quick picks, then folders. */
function openCreate(startCat) {
  $('.cs')?.remove();
  const three = is3D(), objs = three ? OBJECTS_3D : OBJECTS_2D, prefabs = three ? PREFABS_3D : PREFABS_2D;
  const CAMLIGHT = ['Camera', 'Directional Light', 'Global Light 2D', 'Light', 'Spotlight', 'Torch (fire light)'];
  const artOf = (o) => { const src = o.props?.sprite?.src; return typeof src === 'string' && src.startsWith('art:') ? src : null; };
  const fromDef = (o, kind) => ({ label: o.label, icon: o.icon, art: o.art || artOf(o), desc: o.desc || o.note || '', group: o.group, fn: () => (kind === 'entity' ? addEntity(o.props) : addPrefab(o)) });
  const spriteItems = Object.entries(SPRITE_GROUPS).filter(([g]) => g !== 'Icons' && g !== 'UI Frames').flatMap(([g, list]) => list.map((k) => {
    const nm = k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    return { label: nm, art: 'art:' + k, group: g, fn: () => addEntity({ name: nm, sprite: { src: 'art:' + k, w: 56, h: 56 } }) };
  }));
  const logicItems = [
    { label: 'Visual Script', icon: 'nodes', desc: 'Connect nodes: On Tap → Add Score…', fn: addVisualScript },
    { label: 'Triggers', icon: 'bolt', desc: 'When … if … do …, in plain words', fn: () => addLogic('triggers') },
    { label: 'State Machine', icon: 'nodes', desc: 'Idle, chase, attack… and what switches them', fn: () => addLogic('fsm') },
    ...userScripts().map((sc) => ({ label: sc.name, icon: 'link', desc: 'Your saved script: added to the selected object', fn: () => { const j = ent(selectedId) || project.entities.find((e) => (e.tags || []).includes('player')); if (!j) { toast('Select an object first'); return; } addSavedScript(j, sc); changed({ structure: true }); pushHistory(); toast(`Added “${sc.name}” to ${j.name}`); } })),
  ];
  const cats = [
    { key: 'gameplay', title: 'Gameplay', icon: 'player', color: '#3a6ea5', desc: 'Players, enemies, coins, goals…', items: prefabs.map((o) => fromDef(o)) },
    !three && { key: 'sprites', title: 'Characters & Sprites', icon: 'image', color: '#8e44ad', desc: 'Drawn characters, items, nature, blocks, or draw your own', items: [{ label: 'Draw Your Own', icon: 'brush', group: 'Draw', desc: '2D Sprite Editor: shapes, pen, pixels, frames', fn: () => editSprite2D(null) }, ...spriteItems] },
    { key: 'objects', title: three ? 'Shapes' : 'Shapes & Objects', icon: 'square', color: '#2e7d5b', desc: three ? 'Cube, sphere, plane, text…' : 'Boxes, circles, text, images…', items: objs.filter((o) => !CAMLIGHT.includes(o.label)).map((o) => fromDef(o, 'entity')) },
    three && { key: 'models', title: '3D Models', icon: 'cube', color: '#2e7d5b', desc: 'Trees, houses, cars… or build your own', items: [{ label: 'New Model (Modeler)', icon: 'edit', desc: 'Model it like in Blender', fn: newModel }, ...MODELS_3D.map((m) => ({ label: m.label, icon: m.icon, fn: () => addEntity({ name: m.label, y: 0, model: { parts: clone(m.parts) } }) }))] },
    { key: 'ui', title: 'UI & Menus', icon: 'hud', color: '#c2185b', desc: 'Buttons, nav bars, side bars, popups…', items: UI_WIDGETS.map((o) => fromDef(o)) },
    { key: 'logic', title: 'Logic & Scripts', icon: 'bolt', color: '#e67e22', desc: 'Make things happen: nodes or triggers', items: logicItems },
    { key: 'camera', title: 'Camera & Lights', icon: 'camera', color: '#00897b', desc: 'What the player sees, and how it is lit', items: objs.filter((o) => CAMLIGHT.includes(o.label)).map((o) => fromDef({ ...o, label: o.label === 'Light' ? 'Point Light' : o.label }, 'entity')) },
    userPrefabs().length && { key: 'mine', title: 'My Prefabs', icon: 'cube', color: '#5d4037', desc: 'Things you saved to reuse', items: userPrefabs().map((pf) => ({ label: pf.name, icon: iconFor(pf.entities[0]), fn: () => instantiatePrefab(pf.id) })) },
  ].filter(Boolean);
  const quick = (three ? ['Player (3rd person)', 'Player', 'Platform', 'Coin', 'Enemy', 'Goal'] : ['Player', 'Jumper', 'Platform', 'Coin', 'Enemy', 'Goal'])
    .map((l) => prefabs.find((o) => o.label === l)).filter(Boolean).slice(0, 5).map((o) => fromDef(o));
  const scoreUI = UI_WIDGETS.find((o) => o.label === 'Score'); if (scoreUI) quick.push(fromDef(scoreUI));
  let cat = startCat || (uiMode ? 'ui' : null);
  const body = h('div', { class: 'cs-body' });
  const search = h('input', { type: 'search', class: 'cs-search', placeholder: 'Search everything you can add', autocapitalize: 'off', oninput: () => draw() });
  const title = h('b', {}, 'Create');
  const backBtn = h('button', { class: 'cs-btn', 'aria-label': 'Back', onclick: () => { cat = null; search.value = ''; draw(); } }, icon('left'));
  const close = () => { root.remove(); dropBack(close); };
  const pick = (it) => { close(); it.fn(); buzz(8); };
  const tile = (it) => h('button', { class: 'cs-tile', onclick: () => pick(it) },
    h('span', { class: 'cs-pv' + (it.art?.startsWith('art:ui-') ? ' uiic' : '') }, it.art ? h('img', { src: artURL(it.art), alt: '' }) : icon(it.icon || 'cube')),
    h('b', {}, it.label), it.desc ? h('small', {}, it.desc) : null);
  const grid = (items) => h('div', { class: 'cs-grid' }, items.map(tile));
  function draw() {
    const q = search.value.trim().toLowerCase();
    backBtn.hidden = !cat && !q;
    if (q) {
      const hits = cats.flatMap((c) => c.items.map((it) => ({ ...it, cat: c.title }))).filter((it) => (it.label + ' ' + (it.desc || '') + ' ' + it.cat + ' ' + (it.group || '')).toLowerCase().includes(q));
      title.textContent = 'Search';
      body.replaceChildren(hits.length ? grid(hits.slice(0, 60)) : h('div', { class: 'empty' }, `Nothing called “${search.value}”.`));
      return;
    }
    if (cat) {
      const c = cats.find((x) => x.key === cat); if (!c) { cat = null; return draw(); }
      title.textContent = c.title;
      const groups = [...new Set(c.items.map((it) => it.group).filter(Boolean))];
      body.replaceChildren(...(groups.length > 1 ? groups.flatMap((g) => [h('div', { class: 'cs-sec' }, g), grid(c.items.filter((it) => it.group === g))]) : [grid(c.items)]));
      body.scrollTop = 0;
      return;
    }
    title.textContent = 'Create';
    body.replaceChildren(
      h('div', { class: 'cs-sec' }, 'Quick add'),
      h('div', { class: 'cs-quick' }, quick.map((it) => h('button', { class: 'cs-chip', onclick: () => pick(it) }, it.art ? h('img', { src: artURL(it.art), alt: '' }) : icon(it.icon || 'cube'), it.label))),
      h('div', { class: 'cs-sec' }, 'Browse'),
      h('div', { class: 'cs-cats' }, cats.map((c) => h('button', { class: 'cs-cat', style: `--c:${c.color}`, onclick: () => { cat = c.key; draw(); } },
        h('span', { class: 'cs-ic' }, icon(c.icon)), h('b', {}, c.title), h('small', {}, c.desc), h('em', {}, String(c.items.length))))));
  }
  const root = h('div', { class: 'cs' },
    h('div', { class: 'cs-top' }, backBtn, title, h('button', { class: 'cs-btn', 'aria-label': 'Close', onclick: close }, icon('close'))),
    search, body);
  document.body.append(root);
  pushBack(close);
  draw();
}
function openCreateMenu(anchor) {
  if (uiMode) { popMenu(anchor, UI_GROUPS.flatMap((g) => [{ cap: g }, ...UI_WIDGETS.filter((o) => o.group === g).map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o) }))])); return; }
  const groups = is3D() ? PREFABS_3D : PREFABS_2D, objs = is3D() ? OBJECTS_3D : OBJECTS_2D;
  const sceneObj = (label) => objs.find((o) => o.label === label);
  popMenu(anchor, [
    { cap: 'Camera & lights' }, ...['Camera', is3D() ? 'Directional Light' : 'Global Light 2D', 'Light'].map(sceneObj).filter(Boolean).map((o) => ({ icon: o.icon, label: o.label === 'Light' ? 'Point Light' : o.label, fn: () => addEntity(o.props) })),
    '-', { cap: 'Objects' }, ...objs.filter((o) => !['Camera', 'Directional Light', 'Global Light 2D', 'Light'].includes(o.label)).map((o) => ({ icon: o.icon, label: o.label, fn: () => addEntity(o.props) })),
    '-', { cap: 'Prefabs' }, ...groups.map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o) })),
    '-', { cap: 'Logic' },
    { icon: 'bolt', label: 'Triggers (On → If → Do)', fn: () => addLogic('triggers') },
    { icon: 'nodes', label: 'State Machine', fn: () => addLogic('fsm') },
    { icon: 'nodes', label: 'Visual Script (nodes)', fn: addVisualScript },
    is3D() && { icon: 'cube', label: 'New 3D Model (Modeler)', fn: newModel },
    { icon: 'brush', label: 'Draw a Sprite (2D Editor)', fn: () => editSprite2D(null) },
  ]);
}

// ============================================================================
// Inspector
// ============================================================================
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (const k of ks.slice(0, -1)) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }
  if (v === undefined) delete a[ks.at(-1)]; else a[ks.at(-1)] = v;
}

/** Drag horizontally on a label to change a number, like desktop engines. */
function scrubber(labelEl, inputEl, get, set, step) {
  labelEl.classList.add('scrub');
  let start = null;
  labelEl.addEventListener('pointerdown', (e) => { labelEl.setPointerCapture(e.pointerId); start = { x: e.clientX, v: +get() || 0 }; });
  labelEl.addEventListener('pointermove', (e) => {
    if (!start) return;
    const v = round(start.v + Math.round((e.clientX - start.x) / 4) * step, 3);
    inputEl.value = v; set(v);
  });
  const end = () => { start = null; };
  labelEl.addEventListener('pointerup', end); labelEl.addEventListener('pointercancel', end);
}

/** An input bound to target()[path]. spec: { type, label, options, def, structure, step } */
function control(target, path, spec) {
  let rowEl = null; // the finished row (deco)
  const get = () => { const v = getPath(target(), path); return v === undefined ? spec.def : v; };
  const set = (v) => {
    setPath(target(), path, v); markMod();
    if (path === 'name' && target() === project) refreshAll();
    changed({ structure: spec.structure || ['name', 'tags', 'template', 'locked'].includes(path) });
  };
  const val = get();
  let text = String(spec.label ?? '').replace(/ \((2D|3D)\)$/, ''), unit = spec.unit || ''; // the other mode's fields are hidden, so no need to say which
  const um = !unit && spec.type === 'number' && text.match(/\s*\((s|sec|seconds|px|°|%|deg|degrees|ms|m|m\/s)\)$/); // Odin-style [SuffixLabel]: "Speed (px)" → a px chip in the field
  if (um) { unit = { sec: 's', seconds: 's', deg: '°', degrees: '°' }[um[1]] || um[1]; text = text.slice(0, um.index); }
  const label = h('label', { title: text }, text);
  let el;
  switch (spec.type) {
    case 'number': {
      const step = spec.step || (is3D() ? 0.1 : 1);
      let slider = null;
      const lazy = () => { if (spec.lazy) renderInspector(); }; // other fields depend on this one: refresh when done typing
      const inp = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: val ?? '', 'data-path': path,
        oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) { set(n); if (slider) slider.value = n; } }, onchange: lazy });
      const bump = (d) => { let v = round((+get() || 0) + d * step, 3); if (spec.range) v = Math.min(spec.range[1], Math.max(spec.range[0], v)); inp.value = v; if (slider) slider.value = v; set(v); buzz(4); lazy(); };
      el = h('div', { class: 'num' + (unit ? ' has-unit' : '') }, h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => bump(-1) }, '−'), unit ? h('span', { class: 'num-u' }, inp, h('i', { class: 'unit' }, unit)) : inp,
        h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => bump(1) }, '+'));
      scrubber(label, inp, get, set, step);
      if (spec.range) { // Odin-style [Range] slider under the number
        slider = h('input', { type: 'range', class: 'slider', min: spec.range[0], max: spec.range[1], step: spec.step || 'any', value: val ?? spec.range[0],
          oninput: (e) => { const n = parseFloat(e.target.value); inp.value = n; set(n); }, onchange: lazy });
        el = h('div', { class: 'num-wrap' }, el, slider);
      }
      break;
    }
    case 'bool':
      el = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => { set(e.target.checked); markMod(); } });
      return deco(h('div', { class: 'row inline' }, label, el));
    case 'select': {
      const opts = spec.options.map((o) => (Array.isArray(o) ? o : [o, o]));
      if (!spec.ease && !spec.dropdown && opts.length >= 2 && opts.length <= 4 && opts.reduce((n, [, l]) => n + String(l).length, 0) <= 24) { // Odin [EnumToggleButtons]: few short choices are buttons
        el = h('div', { class: 'etb', role: 'radiogroup' }, opts.map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === val), class: v === val ? 'on' : '', 'data-v': v,
          onclick: (e) => { set(v); for (const b of e.currentTarget.parentNode.children) { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); } markMod(); buzz(4); } }, l)));
        break;
      }
      el = h('select', { onchange: (e) => { set(e.target.value); if (spec.ease) drawEase(cv, e.target.value); } },
        spec.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === val }, l); }));
      if (spec.ease) { var cv = h('canvas', { class: 'ease-cv', width: 96, height: 60 }); drawEase(cv, val); el = h('div', { class: 'ease-row' }, el, cv); }
      break;
    }
    case 'color': {
      const norm = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : /^#[0-9a-f]{3}$/i.test(c || '') ? '#' + c.slice(1).split('').map((d) => d + d).join('') : '#ffffff');
      if (spec.optional) {
        const cb = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked ? col.value : '') });
        const col = h('input', { type: 'color', value: norm(val), oninput: (e) => { cb.checked = true; set(e.target.value); } });
        el = h('div', { class: 'pair' }, cb, col);
      } else el = h('input', { type: 'color', value: norm(val), oninput: (e) => set(e.target.value), onchange: (e) => rememberColor(e.target.value) });
      // theme colours (@bg, @card…): follow the app's light / dark mode
      const TL = { bg: 'Background', card: 'Cards', text: 'Text', sub: 'Second text', line: 'Lines', field: 'Fields', bar: 'Bars', accent: 'Accent', onAccent: 'On accent', danger: 'Danger', good: 'Good', shadow: 'Shadow', dim: 'Dim' };
      const tokBtn = h('button', { type: 'button', class: 'csw tokbtn', title: 'Use a theme colour (follows light / dark mode)', onclick: (ev) => popMenu(ev.currentTarget, [{ cap: 'Theme colours (light / dark)' }, ...THEME_TOKENS.map((t) => ({ icon: 'sun', label: `${TL[t] || t}  @${t}`, fn: () => { set('@' + t); renderInspector(); } }))]) }, '@');
      if (typeof val === 'string' && val.startsWith('@')) {
        const t = val.slice(1);
        el = h('div', { class: 'pair tokval' }, h('span', { class: 'tokchip' }, h('i', { style: `background:${APP_PALETTES.light[t] || '#888'}` }), h('i', { style: `background:${APP_PALETTES.dark[t] || '#888'}` }), `${TL[t] || t} (theme)`), tokBtn,
          h('button', { type: 'button', class: 'csw', title: 'Use a fixed colour instead', onclick: () => { set(APP_PALETTES.light[t] && /^#/.test(APP_PALETTES.light[t]) ? APP_PALETTES.light[t] : '#ffffff'); renderInspector(); } }, '✕'));
        break;
      }
      // Odin-style color palette: recently used colors, one tap to reuse
      const sw = recentColors.slice(0, 8).map((c) => h('button', { type: 'button', class: 'csw', style: `background:${c}`, title: c, onclick: () => { set(c); renderInspector(); } }));
      el = h('div', { class: 'color-wrap' }, h('div', { class: 'pair' }, el, tokBtn), sw.length ? h('div', { class: 'csws' }, sw) : null);
      break;
    }
    case 'range': {
      const [a, b] = Array.isArray(val) ? val : [val ?? 0, val ?? 0];
      const upd = () => {
        const x = parseFloat(lo.value), y = parseFloat(hi.value);
        if (Number.isNaN(x)) return;
        set(Number.isNaN(y) || x === y ? x : [Math.min(x, y), Math.max(x, y)]);
      };
      const lo = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: a, oninput: upd });
      const hi = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: b, oninput: upd });
      el = h('div', { class: 'pair' }, h('span', {}, 'min'), lo, h('span', {}, 'max'), hi);
      break;
    }
    case 'image': { // picture picker: thumbnail + choose / clear
      const thumb = val ? h('img', { class: 'img-thumb', src: val, alt: '' }) : h('span', { class: 'muted' }, 'None');
      el = h('div', { class: 'pair img-pick' }, thumb,
        h('button', { type: 'button', class: 'btn', onclick: () => pickImage((url) => { set(url); renderInspector(); }, spec.maxSize || 1024) }, val ? 'Change' : 'Choose image'),
        val ? h('button', { type: 'button', class: 'btn', onclick: () => { set(''); renderInspector(); } }, 'Clear') : null);
      break;
    }
    case 'code':
      if (/\|/.test(text) && !rawTables.has(path)) { el = tableList(get, set, text, path); label.textContent = text.replace(/\s*\(.*$/, '') || text; break; } // the columns say the rest
      el = h('textarea', { spellcheck: false, autocapitalize: 'off', value: val ?? '', oninput: (e) => set(e.target.value) });
      break;
    case 'tags':
      el = h('input', { type: 'text', value: (val || []).join(', '), placeholder: 'player, enemy', autocapitalize: 'off',
        onchange: (e) => set(e.target.value.split(',').map((t) => t.trim()).filter(Boolean)) });
      break;
    case 'json':
      el = h('textarea', { spellcheck: false, value: JSON.stringify(val ?? {}, null, 1), style: 'min-height:64px',
        oninput: (e) => { try { set(JSON.parse(e.target.value)); e.target.style.borderColor = ''; } catch { e.target.style.borderColor = '#c0392b'; } } });
      break;
    case 'rules':
      return rulesEditor(target, path);
    case 'clips':
      return clipsCard(target, path);
    case 'triggers': case 'fsm':
      return logicCard(target, path, spec.type);
    case 'graph':
      return scriptsCard(target, path);
    case 'tweenSteps':
      return stepsCard(target, path);
    case 'template': {
      const names = project.entities.filter((e) => e.template).map((e) => e.name);
      el = h('select', { onchange: (e) => set(e.target.value) },
        h('option', { value: '' }, names.length ? 'None' : 'No templates in scene'),
        names.map((n) => h('option', { value: n, selected: n === val }, n)));
      break;
    }
    default: {
      if (/comma list|comma-separated|separated by commas/i.test(text) && !rawTables.has(path)) { el = chipList(get, set, spec, text, path); break; }
      el = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', placeholder: spec.placeholder, oninput: (e) => set(e.target.value) });
      const list = spec.suggest && suggestions(spec.suggest);
      if (list?.length) { // Odin-style [ValueDropdown]: type or pick from what exists in the game
        const id = 'dl-' + spec.suggest + '-' + Math.random().toString(36).slice(2, 7);
        el.setAttribute('list', id);
        el = h('div', { class: 'sugg' }, el, h('datalist', { id }, list.map((v) => h('option', { value: v }))),
          h('button', { type: 'button', class: 'sugg-btn', title: 'Pick', onclick: (e) => popMenu(e.currentTarget, list.map((v) => ({ label: v, fn: () => { set(v); renderInspector(); } }))) }, icon('chevron')));
      }
    }
  }
  const wide = el.classList?.contains('tlist') || el.classList?.contains('chips-ed');
  const side = ['number', 'select', 'color', 'template', undefined, 'text'].includes(spec.type) && !spec.ease && !wide; // label left, control right
  const row = h('div', { class: 'row' + (spec.type === 'code' || spec.type === 'json' ? ' full' : side ? ' side' : '') }, label, el);
  if (spec.infoText) row.append(h('div', { class: 'obox info' }, spec.infoText));
  return deco(row);
  /** Odin-style override marks: a dot and a reset button on values changed from the default (and "Changed only" uses them). */
  function deco(r) { rowEl = r; markMod(); if (spec.required && String(get() ?? '').trim() === '') { r.classList.add('req'); r.append(h('div', { class: 'obox error' }, `${text} is required.`)); } return r; } // Odin [Required]
  function markMod() {
    if (!rowEl || spec.def === undefined || NO_RESET.has(spec.type)) return;
    const raw = getPath(target(), path), mod = raw !== undefined && raw !== '' && JSON.stringify(raw) !== JSON.stringify(spec.def) && !(raw === false && !spec.def);
    rowEl.classList.toggle('mod', mod);
    let b = label.querySelector('.rst');
    if (mod && !b) {
      b = h('button', { type: 'button', class: 'rst', title: 'Reset to ' + (typeof spec.def === 'string' ? `“${spec.def}”` : JSON.stringify(spec.def)), 'aria-label': 'Reset to default',
        onpointerdown: (e) => e.stopPropagation(), onclick: (e) => { e.preventDefault(); e.stopPropagation(); set(clone(spec.def)); renderInspector(); toast(`${text}: back to default`); } }, '↺');
      label.prepend(b);
    } else if (!mod && b) b.remove();
  }
}
const NO_RESET = new Set(['rules', 'clips', 'triggers', 'fsm', 'graph', 'tweenSteps']);
const rawTables = new Set(); // table / chip fields switched to plain text
/** Odin [TableList]: "a | b | c" lines (shop items, tabs, camera shots…) as a table with a column per part. */
function tableList(get, set, text, path) {
  const inner = (text.match(/\(([^)]*\|[^)]*)\)/) || [, text])[1].replace(/^one per line:\s*/i, '').split(';')[0];
  const cols = inner.split('|').map((c) => c.trim()).filter(Boolean);
  const special = (l) => !l.includes('|') && /^\s*(#|-\s*$)/.test(l);
  let rows = String(get() ?? '').split('\n').filter((l) => l.trim()).map((l) => (special(l) ? l.trim() : l.split('|').map((c) => c.trim())));
  const save = () => set(rows.map((r) => { if (typeof r === 'string') return r; const c = [...r]; while (c.length > 1 && c[c.length - 1] === '') c.pop(); return c.join(' | '); }).join('\n'));
  const box = h('div', { class: 'tlist' });
  const draw = () => {
    const grid = `repeat(${cols.length}, minmax(84px, 1fr)) 40px`;
    box.replaceChildren(
      h('div', { class: 'tl-scroll' },
        h('div', { class: 'tl-row tl-head', style: `grid-template-columns:${grid}` }, cols.map((c) => h('span', { title: c }, c)), h('span')),
        rows.map((r, i) => h('div', { class: 'tl-row', style: `grid-template-columns:${grid}` },
          typeof r === 'string'
            ? h('input', { type: 'text', class: 'tl-sp', value: r, style: `grid-column:1 / span ${cols.length}`, oninput: (e) => { rows[i] = e.target.value; save(); } })
            : cols.map((c, k) => h('input', { type: 'text', value: r[k] ?? '', placeholder: c, autocapitalize: 'off', 'aria-label': c, oninput: (e) => { r[k] = e.target.value; save(); } })),
          h('button', { type: 'button', class: 'tl-m', title: 'Row', onclick: (e) => popMenu(e.currentTarget, [
            i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); save(); draw(); } },
            i < rows.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); save(); draw(); } },
            { icon: 'copy', label: 'Duplicate', fn: () => { rows.splice(i + 1, 0, clone(r)); save(); draw(); } },
            { icon: 'trash', label: 'Delete Row', fn: () => { rows.splice(i, 1); save(); draw(); } },
          ].filter(Boolean)) }, icon('more'))))),
      h('div', { class: 'tl-foot' },
        h('button', { type: 'button', class: 'btn', onclick: () => { rows.push(cols.map(() => '')); save(); draw(); box.querySelector('.tl-row:last-child input')?.focus(); } }, icon('plus'), 'Add Row'),
        h('span', { class: 'tl-n' }, `${rows.length} row${rows.length === 1 ? '' : 's'}`),
        h('button', { type: 'button', class: 'btn', title: 'Edit as plain text', onclick: () => { rawTables.add(path); renderInspector(); } }, icon('text'), 'Text')));
  };
  draw();
  return box;
}
/** Odin-style list drawer for comma lists: chips you can remove or tap to rename, plus an add field with suggestions. */
function chipList(get, set, spec, text, path) {
  const items = () => String(get() ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const put = (a) => set(a.join(', '));
  const kind = spec.suggest || (/variable/i.test(text) ? 'vars' : /tag/i.test(text) ? 'tags' : /message/i.test(text) ? 'messages' : '');
  const box = h('div', { class: 'chips-ed' });
  const draw = () => {
    const a = items(), id = 'dl-c' + Math.random().toString(36).slice(2, 7), sug = kind ? suggestions(kind).filter((v) => !a.includes(v)) : [];
    const add = h('input', { type: 'text', placeholder: a.length ? 'Add…' : spec.placeholder || (/blank/i.test(text) ? 'Add (none = all)' : 'Add…'), autocapitalize: 'off', list: sug.length ? id : null,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }, onchange: () => commit() });
    const commit = () => { const v = add.value.replace(/,/g, ' ').trim(); if (!v) return; put([...items(), v]); draw(); box.querySelector('input')?.focus(); };
    box.replaceChildren(
      ...a.map((t, i) => h('span', { class: 'chip' },
        h('button', { type: 'button', class: 'chip-t', title: 'Rename', onclick: () => { const n = prompt('Rename', t)?.replace(/,/g, ' ').trim(); if (n) { const b = items(); b[i] = n; put(b); draw(); } } }, t),
        h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Remove ' + t, onclick: () => { const b = items(); b.splice(i, 1); put(b); draw(); } }, '×'))),
      add, sug.length ? h('datalist', { id }, sug.map((v) => h('option', { value: v }))) : null,
      h('button', { type: 'button', class: 'chip-raw', title: 'Edit as plain text', onclick: () => { rawTables.add(path); renderInspector(); } }, icon('text')));
  };
  draw();
  return box;
}

// ---- Odin-style inspector helpers ----
const openGroups = new Set();
/** A folding group inside a component; it starts open when something in it is already set (so nothing is hidden by surprise). */
function fold(key, title, kids, isSet = false) {
  kids = [kids].flat(Infinity).filter(Boolean); if (!kids.length) return null;
  const body = h('div', { class: 'og-b' }, kids), open = openGroups.has(key) || (isSet && !openGroups.has('-' + key));
  const g = h('div', { class: 'og' + (open ? ' open' : '') },
    h('button', { class: 'og-h', onclick: () => { g.classList.toggle('open'); const on = g.classList.contains('open'); openGroups.delete(on ? '-' + key : key); openGroups.add(on ? key : '-' + key); } }, icon('chevron'), title, isSet ? h('span', { class: 'og-dot', title: 'Something here is set' }) : null), body);
  return g;
}
/** A component's fields: validation messages, buttons, then params (hidden by showIf, folded into groups, with sliders and info boxes). */
function behaviorBody(def, b, i, j, threeD, C) {
  const params = def.params.map((p) => ({ ...p, def: paramDefault(p, threeD) })), deps = showIfDeps(params);
  const out = validate(b, j).map(([lvl, txt]) => h('div', { class: 'obox ' + lvl }, txt));
  const btns = (BEH_BUTTONS[b.type] || []).filter((x) => !x.when || x.when(b, threeD));
  if (btns.length) out.push(h('div', { class: 'btns' }, btns.map((x) => h('button', { class: 'btn' + (x.primary ? ' primary' : ''), onclick: () => x.fn(j, i, b) }, icon(x.icon || 'play'), x.label))));
  const groups = new Map();
  const visible = params.filter((p) => !((!showAdvanced && p.advanced) || !shown(p, b, threeD)));
  const loose = visible.filter((p) => !p.group), MAIN = 5; // the first few loose settings stay out; the rest fold into "More settings"
  const extra = !showAdvanced && loose.length > MAIN + 1 ? new Set(loose.slice(MAIN).map((p) => p.key)) : new Set();
  for (const p of params) {
    if ((!showAdvanced && p.advanced) || !shown(p, b, threeD)) continue;
    if (extra.has(p.key)) p.group = 'More settings';
    let infoText = typeof p.info === 'string' ? p.info : null;
    if (p.info && typeof p.info === 'object') { const k = Object.keys(p.info).find((v) => Object.values(b).includes(v)); if (k) infoText = p.info[k]; }
    const dep = deps.has(p.key), el = C(`behaviors.${i}.${p.key}`, { ...p, infoText, structure: dep && p.type !== 'number', lazy: dep && p.type === 'number' });
    if (!p.group) { out.push(el); continue; }
    if (!groups.has(p.group)) {
      const key = b.type + ':' + p.group, body = h('div', { class: 'og-b' });
      const g = h('div', { class: 'og' + (openGroups.has(key) ? ' open' : '') },
        h('button', { class: 'og-h', onclick: () => { g.classList.toggle('open'); if (g.classList.contains('open')) openGroups.add(key); else openGroups.delete(key); } }, icon('chevron'), p.group), body);
      groups.set(p.group, body); out.push(g);
    }
    groups.get(p.group).append(el);
  }
  return out;
}
let recentColors = (() => { try { return JSON.parse(store.get('pocket.editor.colors', '[]')); } catch { return []; } })();
function rememberColor(c) { recentColors = [c, ...recentColors.filter((x) => x !== c)].slice(0, 12); store.set('pocket.editor.colors', JSON.stringify(recentColors)); }
function drawEase(cv, name) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, f = Ease[name] || Ease.linear, pad = 12;
  g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  g.strokeStyle = '#7fb5ff'; g.lineWidth = 2; g.beginPath();
  for (let i = 0; i <= 40; i++) { const t = i / 40, x = pad + t * (W - 2 * pad), y = H - pad - f(t) * (H - 2 * pad); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}
/** Values that already exist in the game, for dropdown suggestions. */
function suggestions(kind) {
  const all = levelList().flatMap((lv) => lv.entities || []), uniq = (a) => [...new Set(a.filter(Boolean))];
  if (kind === 'tags') return uniq([...allTags(), ...all.map((e) => e.name)]);
  if (kind === 'items') return uniq([...(root.items || []).map((d) => d.name), ...all.flatMap((e) => (e.behaviors || []).filter((b) => ['inventoryItem', 'resource'].includes(b.type)).map((b) => b.item))]);
  if (kind === 'quests') return uniq((root.quests || []).map((q) => q.name));
  if (kind === 'collections') return uniq((root.collections || []).map((c) => c.name));
  if (kind === 'dialogues') return uniq((root.dialogues || []).map((d) => d.name));
  if (kind === 'templates') return uniq(all.filter((e) => e.template).map((e) => e.name));
  if (kind === 'objects') return uniq(all.filter((e) => !e.template).map((e) => e.name));
  if (kind === 'vars') return uniq(['score', 'lives', 'hp', ...Object.keys(levelList()[0].vars || {}), ...Object.keys(project.vars || {})]);
  if (kind === 'notifyTypes') return allNotifyTypes().map((t) => t.name);
  if (kind === 'clips') return uniq((ent(selectedId)?.behaviors || []).filter((b) => b.type === 'animator').flatMap((b) => (b.clips || []).map((c) => c.name)));
  if (kind === 'messages') {
    const out = [];
    for (const e of all) for (const b of e.behaviors || []) {
      if (b.message) out.push(b.message);
      if (b.action === 'send message' || b.thenDo === 'send message') out.push(b.value || b.thenValue);
      for (const n of b.graph?.nodes || []) if (n.params?.message) out.push(n.params.message);
      for (const r of b.rules || []) for (const d of r.do || []) if (d.action === 'send message') out.push(d.value);
    }
    return uniq(['go', ...out]);
  }
  return [];
}
/** showIf: { key: [values] } or (behavior) => bool */
function shown(p, b, threeD) {
  if (p.only3d && !threeD) return false;
  if (p.only2d && threeD) return false;
  if (/\((2D|3D)\)$/.test(p.label || '') && p.label.endsWith(threeD ? '(2D)' : '(3D)')) return false; // e.g. "Offset Z (3D)" in a 2D game
  if (!p.showIf) return true;
  if (typeof p.showIf === 'function') { try { return !!p.showIf(b); } catch { return true; } }
  return Object.entries(p.showIf).every(([k, vals]) => vals.includes(b[k] ?? p.def));
}
/** Which params other params' showIf depends on (those refresh the inspector when changed). */
function showIfDeps(params) {
  const deps = new Set();
  for (const p of params) {
    if (!p.showIf) continue;
    if (typeof p.showIf === 'function') for (const m of String(p.showIf).matchAll(/b\.(\w+)/g)) deps.add(m[1]);
    else Object.keys(p.showIf).forEach((k) => deps.add(k));
  }
  return deps;
}
/** Problems with a component's settings (Odin-style validation). */
function validate(b, j) {
  const out = [], all = project.entities, has = (n) => all.some((e) => e.name === n), tagged = (t) => all.some((e) => e.name === t || (e.tags || []).includes(t));
  if ((b.type === 'spawner' || b.type === 'shooter') && b.template && !all.some((e) => e.template && e.name === b.template)) out.push(['error', `No template named “${b.template}”. Tick “Template” on the object to spawn.`]);
  if ((b.type === 'spawner' || b.type === 'shooter') && !b.template) out.push(['warn', 'Pick a template to spawn.']);
  if (b.type === 'teleport' && b.target && !has(b.target)) out.push(['error', `No object named “${b.target}”.`]);
  if (b.type === 'camera' && b.mode !== 'fixed' && b.target && !tagged(b.target)) out.push(['warn', `Nothing is tagged “${b.target}” yet: the camera will stay put.`]);
  if (b.type === 'animator' && b.autoplay && !(b.clips || []).some((c) => c.name === b.autoplay)) out.push(['error', `There is no clip called “${b.autoplay}”.`]);
  if (b.type === 'flipbook' && !String(b.frames || '').trim()) out.push(['warn', 'Add some frames, separated by commas.']);
  if (b.type === 'graph') {
    const noEv = (g) => !(g?.nodes || []).some((n) => NODE_TYPES[n.type]?.cat === 'Events' || (NODE_TYPES[n.type] && !NODE_TYPES[n.type].exec && !NODE_TYPES[n.type].value && (NODE_TYPES[n.type].outs || []).length && n.type !== 'funcDef'));
    const lst = b.scripts || [];
    if (!b.mainOff && noEv(b.graph)) out.push(['warn', lst.length ? `“${b.mainName || 'Main script'}” has no Event node, so it never runs.` : 'This script has no Event node, so it never runs.']);
    for (const [k, sc] of lst.entries()) if (!sc.off && noEv(sc.graph) && !(sc.graph?.nodes || []).some((n) => n.type === 'funcDef')) out.push(['warn', `“${sc.name || 'Script ' + (k + 2)}” has no Event node, so it never runs.`]);
  }
  if (b.type === 'fsm' && !(b.fsm?.states || []).length) out.push(['warn', 'Add at least one state.']);
  if (b.type === 'joint' && b.connectTo && !has(b.connectTo)) out.push(['error', `No object named “${b.connectTo}”.`]);
  if (b.type === 'joint' && !b.connectTo) out.push(['warn', 'Pick the object to connect to.']);
  if (b.type === 'waveSpawner' && (b.waves || []).some((w) => !all.some((e) => e.template && e.name === w.template))) out.push(['error', 'A wave uses a template that does not exist. Tick “Template” on the enemy object.']);
  if (b.type === 'tween' && b.effect === 'path' && !(Array.isArray(b.points) && b.points.length)) out.push(['error', 'The path needs at least one point.']);
  if (b.type === 'triggers') {
    const called = new Set(all.flatMap((e) => (e.behaviors || []).filter((q) => q.type === 'triggers').flatMap((q) => (q.triggers || []).filter((t) => t.event?.type === 'called').map((t) => t.event.name))));
    const cA = new Set((root.customActions || []).map((d) => d.id)), cC = new Set((root.customConditions || []).map((d) => d.id));
    for (const t of b.triggers || []) { if ((t.actions || []).concat(t.elseActions || []).some((a) => a.type === 'custom' && !cA.has(a.ref)) || (t.conditions || []).some((c) => c.type === 'custom' && !cC.has(c.ref))) { out.push(['error', 'A trigger uses a My Instruction or My Condition that was deleted. Open Triggers and remove it.']); break; } }
    for (const t of b.triggers || []) for (const a of [...(t.actions || []), ...(t.elseActions || [])]) if (a.type === 'runTrigger' && !called.has(a.name)) out.push(['warn', `“Run another trigger: ${a.name || '…'}” finds no trigger with the event “Run by another trigger” named that.`]);
  }
  if (b.type === 'autoSave' && j.template && !b.key) out.push(['warn', 'On a template every copy gets a new name, so copies are saved but never found again. Give it a Key, or save copies with nodes.']);
  if ((b.type === 'autoSave' || b.type === 'saveManager') && /[.]bak$/.test(b.file || '')) out.push(['error', 'Save file names can\'t end in .bak (used for backups).']);
  if (b.type === 'cameraMixer' && b.camA && !has(b.camA)) out.push(['warn', `No object named “${b.camA}” in this level.`]);
  if (b.type === 'cameraMixer' && b.camB && !has(b.camB)) out.push(['warn', `No object named “${b.camB}” in this level.`]);
  if (['move', 'platformer', 'firstPerson', 'thirdPerson'].includes(b.type) && !(j.tags || []).includes('player')) out.push(['info', 'Tip: tag this object “player” so enemies, coins and cameras find it.']);
  return out;
}

/** Odin-style Project Validator: every level, object and component checked at once; tap a problem to go to it. */
function projectProblems() {
  const out = [], keep = project;
  levelList().forEach((lv, li) => {
    project = lv;
    try {
      for (const e of lv.entities || []) {
        const add = (lvl, comp, msg) => out.push({ lvl, li, id: e.id, name: e.name || 'Object', comp, msg });
        if (e.sprite && !e.sprite.src) add('warn', 'Image', 'The Image has no picture.');
        for (const b of e.behaviors || []) {
          const def = Behaviors[b.type];
          if (!def) { add('error', b.type, 'Unknown component (from a newer version?).'); continue; }
          for (const [lvl, msg] of validate(b, e)) if (lvl !== 'info') add(lvl, def.label, msg);
          for (const p of def.params) if (p.required && (b[p.key] ?? '') === '') add('error', def.label, `${p.label || p.key} is required.`);
        }
      }
    } finally { project = keep; }
  });
  for (const sc of userScripts()) if (!(sc.graph?.nodes || []).some((n) => NODE_TYPES[n.type]?.cat === 'Events')) out.push({ lvl: 'warn', li: -1, name: sc.name || 'Script', comp: 'Script', msg: 'This reusable script has no Event node.' });
  return out.sort((a, b) => (a.lvl === b.lvl ? 0 : a.lvl === 'error' ? -1 : 1));
}
function openProblems() {
  const list = projectProblems(), errs = list.filter((p) => p.lvl === 'error').length;
  const go = (p) => { if (p.li < 0) return; closeLayer(); if (p.li !== levelIdx) setLevel(p.li); select(p.id); if (!isDesktop()) setDock('inspector'); };
  openDialog('Problems', [
    h('p', { class: 'desc' }, list.length ? `${errs} error${errs === 1 ? '' : 's'} and ${list.length - errs} warning${list.length - errs === 1 ? '' : 's'} across ${levelList().length} level${levelList().length === 1 ? '' : 's'}. Tap one to go to it.` : 'No problems found in any level. 🎉'),
    h('div', { class: 'pb-list' }, list.map((p) => h('button', { class: 'pb-item ' + p.lvl, onclick: () => go(p) },
      icon(p.lvl === 'error' ? 'close' : 'warn'), h('span', {}, h('b', {}, p.name), h('small', {}, `${p.comp}${levelList().length > 1 && p.li >= 0 ? ` · level ${p.li + 1}` : ''}`), h('em', {}, p.msg))))),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { closeLayer(); openProblems(); } }, icon('rotate'), 'Check Again')),
  ]);
}

/** One Visual Script component can hold several scripts: the main one, then any number more, each with its own events. */
function scriptsCard(target, path) {
  const bpath = path.replace(/\.graph$/, ''), b = getPath(target(), bpath) || {}, list = b.scripts || [];
  const re = () => { changed({ structure: true }); pushHistory(); renderInspector(); };
  const add = (obj, open) => { (b.scripts ||= []).push({ id: uid('gs'), ...obj }); re(); if (open) editGraph(target, `${bpath}.scripts.${b.scripts.length - 1}.graph`); };
  const addBtn = h('button', { class: 'btn wide gs-add', onclick: (e) => popMenu(e.currentTarget, [
    { cap: 'Add a script to this component' },
    { icon: 'plus', label: 'Blank script', fn: () => add({ name: `Script ${list.length + 2}`, graph: { nodes: [], links: [] } }, true) },
    ...allScripts().map((s2) => ({ icon: 'link', label: s2.name, k: s2.here ? 'saved script' : 'from another game', fn: () => { let sc = userScripts().find((q) => q.id === s2.id); if (!sc) { sc = { id: s2.id, name: s2.name, graph: clone(s2.graph) }; userScripts().push(sc); } add({ name: sc.name, graph: clone(sc.graph), scriptRef: sc.id }); toast(`Added “${sc.name}” (linked)`); } })),
  ]) }, icon('plus'), list.length ? 'Add Another Script' : 'Add Another Script (runs side by side)');
  if (!list.length) return h('div', { class: 'row full gs-list' }, graphCard(target, path), addBtn); // one script: the usual big card
  const mainName = b.mainName || 'Main script';
  /** One compact row per script: on/off, name, what starts it, open, options. */
  const row = (holder, name, off, gpath, extraMenu, onToggle) => {
    const g = holder.graph || { nodes: [], links: [] }, ev = graphEvents(g), sc = scriptOf(holder);
    return h('div', { class: 'gs-item' + (off ? ' off' : ''), onclick: (e) => { if (!e.target.closest('input,button')) editGraph(target, gpath); } },
      h('input', { type: 'checkbox', checked: !off, title: off ? 'Turned off' : 'On', onchange: (e) => onToggle(e.target.checked) }),
      h('span', { class: 'gs-txt' }, h('b', {}, sc ? icon('link') : null, name), h('small', {}, `${g.nodes.length} node${g.nodes.length === 1 ? '' : 's'} · ${ev.length ? ev.slice(0, 2).join(', ') + (ev.length > 2 ? '…' : '') : g.nodes.some((n) => n.type === 'funcDef') ? 'functions: ' + g.nodes.filter((n) => n.type === 'funcDef').map((n) => n.params?.name || 'function').join(', ') : 'no event yet'}`)),
      h('button', { class: 'btn gs-open', onclick: () => editGraph(target, gpath) }, icon('nodes'), 'Open'),
      h('button', { class: 'gs-more', title: 'Script options', onclick: (e) => popMenu(e.currentTarget, [
        { cap: name },
        { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Script name', name); if (n?.trim()) extraMenu.rename(n.trim()); } },
        ...extraMenu.items,
        sc ? { icon: 'unlink', label: `Unlink from “${sc.name}”`, fn: () => { delete holder.scriptRef; re(); } }
          : g.nodes.length && { icon: 'save', label: 'Save as Reusable Script…', fn: () => { const n = prompt('Name this script so you can reuse it', name); if (n?.trim()) { saveScript(holder, g, n.trim()); renderInspector(); } } },
      ].filter(Boolean)) }, icon('more')));
  };
  const items = [row(b, mainName, b.mainOff, path, { rename: (n) => { b.mainName = n; re(); }, items: [
    { icon: 'copy', label: 'Duplicate', fn: () => add({ name: mainName + ' copy', graph: clone(b.graph || { nodes: [], links: [] }) }) },
  ] }, (on) => { if (on) delete b.mainOff; else b.mainOff = true; re(); })];
  list.forEach((sc, k) => {
    const nm = sc.name || `Script ${k + 2}`;
    items.push(row(sc, nm, sc.off, `${bpath}.scripts.${k}.graph`, { rename: (n) => { sc.name = n; re(); }, items: [
      { icon: 'copy', label: 'Duplicate', fn: () => { const c = clone(sc); c.id = uid('gs'); c.name = nm + ' copy'; delete c.scriptRef; list.splice(k + 1, 0, c); re(); } },
      k > 0 && { icon: 'upload', label: 'Move Up', fn: () => { list.splice(k - 1, 0, list.splice(k, 1)[0]); re(); } },
      k < list.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { list.splice(k + 1, 0, list.splice(k, 1)[0]); re(); } },
      { icon: 'upload', label: 'Make Main Script', fn: () => { const m = { id: sc.id, name: mainName, graph: b.graph, ...(b.scriptRef ? { scriptRef: b.scriptRef } : {}), ...(b.mainOff ? { off: true } : {}) }; b.graph = sc.graph; b.mainName = nm; if (sc.scriptRef) b.scriptRef = sc.scriptRef; else delete b.scriptRef; if (sc.off) b.mainOff = true; else delete b.mainOff; list[k] = m; re(); } },
      '-', { icon: 'trash', label: 'Delete Script', fn: () => { if ((sc.graph?.nodes || []).length && !confirm(`Delete “${nm}”?`)) return; list.splice(k, 1); if (!list.length) delete b.scripts; re(); } },
    ].filter(Boolean) }, (on) => { if (on) delete sc.off; else sc.off = true; re(); }));
  });
  return h('div', { class: 'row full gs-list' }, h('div', { class: 'gs-note' }, `${list.length + 1} scripts in this component. Each runs on its own, side by side.`), items, addBtn);
}
/** Node-based coding: a summary card that opens the full-screen Node Editor. */
function graphCard(target, path) {
  const g = getPath(target(), path) || { nodes: [], links: [] }, beh = getPath(target(), path.replace(/\.graph$/, '')), sc = scriptOf(beh);
  const events = [...new Set((g.nodes || []).filter((n) => NODE_TYPES[n.type]?.cat === 'Events').map((n) => NODE_TYPES[n.type].label))];
  let uses = 0; if (sc) eachScriptUse(sc.id, () => uses++);
  return h('div', { class: 'row full graph-card' },
    sc ? h('div', { class: 'gc-link' }, icon('link'), h('span', {}, h('b', {}, sc.name), h('small', {}, `Saved script · used ${uses} time${uses === 1 ? '' : 's'} · edits update every copy`)),
      h('button', { class: 'btn', title: 'Script options', onclick: (ev) => popMenu(ev.currentTarget, [
        { cap: sc.name },
        { icon: 'edit', label: 'Rename Script…', fn: () => { const n = prompt('Script name', sc.name); if (!n?.trim()) return; sc.name = n.trim(); saveScriptToLibrary(sc); changed(); renderInspector(); } },
        { icon: 'unlink', label: 'Unlink (edit this copy only)', fn: () => { delete beh.scriptRef; changed(); pushHistory(); renderInspector(); toast('Unlinked: this copy changes on its own now'); } },
      ]) }, icon('more'))) : null,
    h('div', { class: 'gc-sum' }, icon('nodes'), h('div', {},
      h('b', {}, `${(g.nodes || []).length} nodes · ${(g.links || []).length} wires`),
      h('small', {}, events.length ? 'Runs: ' + events.join(', ') : 'No event yet. Add a green Event node to start.'))),
    h('button', { class: 'btn primary gc-open', onclick: () => editGraph(target, path) }, icon('nodes'), 'Open Node Editor'),
    !sc && (g.nodes || []).length ? h('button', { class: 'btn gc-save', onclick: () => { const n = prompt('Name this script so you can reuse it', target().name ? `${target().name} script` : 'My script'); if (n?.trim()) { saveScript(beh, g, n.trim()); renderInspector(); } } }, icon('save'), 'Save as Reusable Script') : null);
}
function editGraph(target, path) {
  const e = target(), id = e.id;
  const T = () => ent(id) || e;
  const B = () => getPath(T(), path.replace(/\.graph$/, ''));
  const back = () => ed.close();
  const ed = openNodeEditor({
    graph: getPath(e, path), title: e.name, h, popMenu, toast, buzz,
    stats: (nodeId) => { const sk = /\.scripts\.\d+\.graph$/.test(path) ? getPath(e, path.replace(/\.graph$/, ''))?.id : ''; return engine.graphStats?.get(e.id + '|' + (sk ? sk + ':' : '') + nodeId); }, // live debug: what ran in the last Play
    templates: project.entities.filter((x) => x.template).map((x) => x.name),
    objects: project.entities.filter((x) => !x.template && x.name).map((x) => x.name),
    vars: [...new Set(['score', 'lives', 'hp', ...Object.keys(levelList()[0].vars || {}), ...Object.keys(project.vars || {})])],
    scripts: () => allScripts().filter((q) => q.id !== B()?.scriptRef),
    linked: () => { const sc = scriptOf(B()); if (!sc) return null; let n = 0; eachScriptUse(sc.id, () => n++); return { name: sc.name, uses: n }; },
    saveScript: (name, g) => saveScript(B(), g, name),
    unlink: () => { delete B().scriptRef; changed(); },
    onChange: (g) => { setPath(T(), path, g); const b = B(); if (b?.scriptRef) syncScript(b.scriptRef, g, b); requestRebuild(); saveSoon(); },
    onClose: () => { dropBack(back); pushHistory(); renderInspector(); if (dockTab === 'scripts') renderScripts(); },
  });
  pushBack(back);
}

// ---- Saved Visual Scripts: save a graph once, reuse it on any object; linked copies update together ----
const userScripts = () => (root.scripts ||= []);
const SCRIPT_LIB = 'pocket.scriptLibrary'; // also kept on this device so other games can use them
const scriptLibrary = () => { try { return JSON.parse(store.get(SCRIPT_LIB, '[]')).filter((q) => q?.graph?.nodes); } catch { return []; } };
function saveScriptToLibrary(sc) { store.set(SCRIPT_LIB, JSON.stringify([{ id: sc.id, name: sc.name, graph: sc.graph }, ...scriptLibrary().filter((q) => q.id !== sc.id)].slice(0, 40))); }
/** This game's scripts, then ones saved in your other games. */
const allScripts = () => { const mine = userScripts(); return [...mine.map((q) => ({ ...q, here: true })), ...scriptLibrary().filter((q) => !mine.some((m) => m.id === q.id))]; };
const scriptOf = (b) => (b?.scriptRef ? userScripts().find((q) => q.id === b.scriptRef) || null : null);
function eachScriptUse(sid, fn) { for (const lv of levelList()) for (const e of lv.entities) for (const b of e.behaviors || []) if (b.type === 'graph') for (const t of [b, ...(b.scripts || [])]) if (t.scriptRef === sid) fn(t, e, lv); }
function saveScript(beh, graph, name) {
  const sc = { id: uid('sc'), name, graph: clone(graph) };
  userScripts().push(sc); if (beh) beh.scriptRef = sc.id;
  saveScriptToLibrary(sc); changed(); pushHistory();
  toast(`Saved “${name}”. Add it to any object from Add Component › My Scripts.`);
  return sc;
}
/** A linked copy changed: update the saved script and every other copy. */
function syncScript(sid, graph, from) {
  const sc = userScripts().find((q) => q.id === sid); if (!sc) return;
  sc.graph = clone(graph);
  eachScriptUse(sid, (b) => { if (b !== from) b.graph = clone(graph); });
  saveScriptToLibrary(sc);
}
/** Give an object a linked copy of a saved script (importing it into this game if it came from another one). */
function addSavedScript(j, s) {
  let sc = userScripts().find((q) => q.id === s.id);
  if (!sc) { sc = { id: s.id, name: s.name, graph: clone(s.graph) }; userScripts().push(sc); }
  (j.behaviors ||= []).push({ type: 'graph', graph: clone(sc.graph), scriptRef: sc.id });
  if (sc.graph.nodes.some((n) => ['touch', 'touchEnd', 'touching'].includes(n.type)) && !j.ui && !j.body && !j.collider) j.collider = fitCollider(j, 'box');
}

/** Tween Sequence steps: one card per step, in order, each playing after the last, together with it, or as a pause. */
const STEP_FIELDS = {
  vec: ['move by', 'move to', 'move from', 'jump to', 'punch position'], angle: ['rotate by', 'rotate to', 'spin'],
  amount: ['scale to', 'scale by', 'fade to', 'punch scale', 'punch rotation', 'shake position', 'shake rotation', 'shake scale'],
};
function stepsCard(target, path) {
  const get = () => getPath(target(), path) || [];
  const save = (list, structure) => { setPath(target(), path, list); changed({ inspector: structure }); if (structure) pushHistory(); };
  const steps = get(), three = is3D() && !target().ui;
  const num = (st, k, label, def) => h('label', { class: 'st-f' }, h('span', {}, label), h('input', { type: 'text', inputMode: 'decimal', value: st[k] ?? def ?? 0,
    oninput: (ev) => { const v = parseFloat(ev.target.value); if (!Number.isNaN(v)) { st[k] = v; save(get()); } } }));
  const sel = (val, options, on) => h('select', { onchange: (ev) => on(ev.target.value) }, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === val }, l); }));
  const cards = steps.map((st, i) => {
    const wait = st.with === 'wait', fx = st.effect || 'move by';
    const fields = [];
    if (!wait) {
      if (STEP_FIELDS.vec.includes(fx)) fields.push(num(st, 'x', 'X'), num(st, 'y', 'Y'), three ? num(st, 'z', 'Z') : null);
      if (STEP_FIELDS.angle.includes(fx)) fields.push(num(st, 'angle', 'Degrees', 360));
      if (STEP_FIELDS.amount.includes(fx)) fields.push(num(st, 'amount', fx === 'fade to' ? 'Opacity' : fx.startsWith('scale') ? 'Size' : 'Amount', 0.3));
      if (fx === 'jump to') fields.push(num(st, 'height', 'Height', three ? 2 : 80));
      if (fx === 'spiral') fields.push(num(st, 'radius', 'Radius', three ? 3 : 120), num(st, 'turns', 'Turns', 3));
      if (fx === 'blink') fields.push(num(st, 'times', 'Blinks', 6));
      if (fx === 'count up') fields.push(num(st, 'to', 'Count to', 100));
      if (fx === 'color to') fields.push(h('label', { class: 'st-f' }, h('span', {}, 'Colour'), h('input', { type: 'color', value: st.color || '#ff5252', oninput: (ev) => { st.color = ev.target.value; save(get()); } })));
      if (fx === 'type text' || fx === 'look at' || fx === 'count up') {
        const k = fx === 'type text' ? 'text' : fx === 'look at' ? 'target' : 'var';
        fields.push(h('label', { class: 'st-f wide' }, h('span', {}, fx === 'type text' ? 'Text' : fx === 'look at' ? 'Object or tag' : 'Variable (blank = text)'),
          h('input', { type: 'text', value: st[k] ?? (k === 'target' ? 'player' : ''), autocapitalize: 'off', oninput: (ev) => { st[k] = ev.target.value; save(get()); } })));
      }
    }
    fields.push(num(st, 'duration', wait ? 'Seconds' : 'Duration', 0.4));
    const move = (d) => { const L = get(), j = i + d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; save(L, true); };
    return h('div', { class: 'st-card' + (wait ? ' wait' : st.with === 'with' ? ' with' : '') },
      h('div', { class: 'st-top' },
        h('span', { class: 'st-n' }, String(i + 1)),
        sel(st.with || 'after', [['after', 'Then'], ['with', 'Together'], ['wait', 'Pause']], (v) => { st.with = v; save(get(), true); }),
        h('button', { class: 'st-b', title: 'Move up', disabled: i === 0, onclick: () => move(-1) }, icon('chevron')),
        h('button', { class: 'st-b down', title: 'Move down', disabled: i === steps.length - 1, onclick: () => move(1) }, icon('chevron')),
        h('button', { class: 'st-b', title: 'Duplicate', onclick: () => { const L = get(); L.splice(i + 1, 0, clone(st)); save(L, true); } }, icon('copy')),
        h('button', { class: 'st-b del', title: 'Remove step', onclick: () => { const L = get(); L.splice(i, 1); save(L, true); } }, icon('trash'))),
      wait ? null : h('div', { class: 'st-row' }, sel(fx, TWEEN_EFFECTS.filter((x) => x !== 'path'), (v) => { st.effect = v; save(get(), true); }),
        sel(st.ease || 'outQuad', EASES, (v) => { st.ease = v; save(get()); })),
      h('div', { class: 'st-fields' }, fields));
  });
  const total = (() => { let t = 0, last = 0; for (const st of steps) { const d = +st.duration || 0; if (st.with === 'with') t = Math.max(t, last + d); else { last = t; t += d; } } return t; })();
  return h('div', { class: 'row full steps-card' },
    h('div', { class: 'st-sum' }, `${steps.length} step${steps.length === 1 ? '' : 's'} · ${round(total, 2)} s`),
    ...cards,
    h('div', { class: 'st-add' },
      h('button', { class: 'btn', onclick: () => { const L = get(); L.push({ ...SEQ_STEP_DEFAULT, ...(three ? { y: 1 } : {}) }); save(L, true); } }, icon('plus'), 'Add Step'),
      h('button', { class: 'btn', onclick: () => { const L = get(); L.push({ ...SEQ_STEP_DEFAULT, with: 'wait', duration: 0.3 }); save(L, true); } }, icon('clock'), 'Add Pause')));
}
/** How long a Tween Sequence plays once (for Preview). */
const seqLength = (b) => { let t = 0, last = 0; for (const st of b.steps || []) { const d = +st.duration || 0; if (st.with === 'with') t = Math.max(t, last + d); else { last = t; t += d; } } return (+b.delay || 0) + t * (+b.loops < 0 ? 2 : (+b.loops || 0) + 1) + 0.3; };

/** Visual logic: WHEN … IF … DO … cards. */
function rulesEditor(target, path) {
  const get = () => getPath(target(), path) || [];
  const save = (rules, structure) => { setPath(target(), path, rules); changed({ inspector: structure }); if (structure) pushHistory(); };
  const rules = get();
  const sel = (val, opts, on) => h('select', { onchange: (e) => on(e.target.value) }, opts.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === val }, l); }));
  const txt = (val, ph, on) => h('input', { type: 'text', value: val ?? '', placeholder: ph, autocapitalize: 'off', oninput: (e) => on(e.target.value) });
  const num = (val, on) => h('input', { type: 'text', inputMode: 'decimal', value: val ?? 0, oninput: (e) => on(e.target.value.includes(',') ? e.target.value : parseFloat(e.target.value) || 0) });
  const OPS = [['>=', '≥'], ['<=', '≤'], ['==', '='], ['>', '>'], ['<', '<']];
  const out = h('div', { class: 'row full' });
  rules.forEach((r, i) => {
    const upd = (k, v, structure) => { const rs = clone(get()); rs[i][k] = v; save(rs, structure); };
    out.append(h('div', { class: 'rule' },
      h('div', { class: 'rule-h' }, h('span', {}, `Rule ${i + 1}`), h('button', { class: 'more', title: 'Delete rule', onclick: () => { const rs = clone(get()); rs.splice(i, 1); save(rs, true); } }, icon('trash'))),
      h('span', { class: 'kw when' }, 'WHEN'),
      sel(r.when, RULE_EVENTS, (v) => upd('when', v, true)),
      r.when === 'touched by tag' && txt(r.tag, 'tag, e.g. player', (v) => upd('tag', v)),
      r.when === 'every few seconds' && num(r.seconds, (v) => upd('seconds', v)),
      r.when === 'swipe' && sel(r.dir || 'up', ['up', 'down', 'left', 'right'], (v) => upd('dir', v)),
      h('span', { class: 'kw if' }, r.when === 'variable reaches' ? 'VARIABLE' : 'IF (optional)'),
      h('div', { class: 'pair' }, txt(r.ifVar, r.when === 'variable reaches' ? 'score' : 'variable', (v) => upd('ifVar', v)), sel(r.ifOp || '>=', OPS, (v) => upd('ifOp', v)), num(r.ifValue, (v) => upd('ifValue', v))),
      h('label', { class: 'adv-toggle', style: 'margin-top:10px' }, h('input', { type: 'checkbox', checked: !!r.once, onchange: (e) => upd('once', e.target.checked) }), 'Only once'),
      h('span', { class: 'kw do' }, 'DO'),
      ...(r.do || []).map((a, k) => {
        const updA = (key, v, structure) => { const rs = clone(get()); rs[i].do[k][key] = v; save(rs, structure); };
        const needsValue = !['win', 'game over', 'next level', 'vibrate', 'start game', 'restart game', 'pause game', 'resume game', 'add score', 'destroy other', 'camera shake'].includes(a.action);
        const needsAmount = ['add score', 'add to variable', 'set variable', 'camera shake', 'jump', 'move by'].includes(a.action);
        return h('div', { class: 'act-row' }, h('div', { class: 'fields' },
          sel(a.action, ACTIONS, (v) => updA('action', v, true)),
          needsValue && txt(a.value, a.action === 'message' ? 'message text' : a.action === 'play sound' ? 'coin, jump, hit, power, win…' : a.action.includes('variable') ? 'variable name' : a.action === 'spawn template' ? 'template name' : 'object name (empty = this)', (v) => updA('value', v)),
          needsAmount && num(a.amount, (v) => updA('amount', v))),
        h('button', { title: 'Remove action', onclick: () => { const rs = clone(get()); rs[i].do.splice(k, 1); save(rs, true); } }, icon('close')));
      }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { const rs = clone(get()); (rs[i].do ||= []).push({ action: 'message', value: 'Hello!', amount: 1 }); save(rs, true); } }, icon('plus'), 'Add action'))));
  });
  out.append(h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: () => { const rs = clone(get()); rs.push({ when: 'touched by tag', tag: 'player', seconds: 1, dir: 'up', ifVar: '', ifOp: '>=', ifValue: 0, once: false, do: [{ action: 'add score', value: '', amount: 1 }] }); save(rs, true); } }, icon('plus'), 'Add rule')));
  return out;
}

/** "Position  X[ ] Y[ ] Z[ ]" row. */
function vecRow(target, label, keys, defs, step) {
  const fields = keys.map((k, i) => {
    const get = () => target()[k] ?? defs[i];
    const set = (v) => { target()[k] = v; changed(); };
    const inp = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: get(), 'data-path': k,
      oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) set(n); } });
    const one = keys.length === 1, b = h('b', { class: one ? 'deg' : 'xyz'[i] }, one ? (label === 'Rotation' ? '°' : '⇆') : 'XYZ'[i]);
    scrubber(b, inp, get, set, step);
    return h('div', { class: 'vf' }, b, inp);
  });
  return h('div', { class: 'row' + (keys.length === 1 ? ' side' : '') }, h('label', {}, label), h('div', { class: 'vec', style: `--n:${keys.length}` }, fields));
}

const GEO_OPTIONS = [['box', 'Cube'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['capsule', 'Capsule'], ['pyramid', 'Pyramid'], ['wedge', 'Ramp / Wedge'], ['prism', 'Prism'], ['gem', 'Gem'], ['dome', 'Dome'], ['torus', 'Ring / Torus'], ['plane', 'Plane']];

/** Built-in sprite art picker (and your own pictures). */
function pickSprite(cb, { device = true } = {}) {
  openDialog('Choose a sprite', [
    device ? h('div', { class: 'btns', style: 'margin-bottom:8px' }, h('button', { class: 'btn', onclick: () => { closeLayer(); pickImage((url) => cb(url), 512); } }, icon('image'), 'From your device…')) : null,
    ...Object.entries(SPRITE_GROUPS).flatMap(([cat, list]) => [h('div', { class: 'ac-cat' }, cat),
      h('div', { class: 'art-grid' }, list.map((k) => h('button', { title: k, onclick: () => { closeLayer(); cb('art:' + k); } }, h('img', { src: artURL('art:' + k), alt: k, class: k.startsWith('ui-') ? 'uiic' : '' }))))])]);
}
function pickEmoji(cb) {
  openDialog('Choose a sprite', Object.entries(EMOJI).flatMap(([cat, list]) => [h('div', { class: 'ac-cat' }, cat),
    h('div', { class: 'emoji-grid' }, list.map((em) => h('button', { onclick: () => { closeLayer(); cb(em); } }, em)))]));
}

/** 3D modeling: a model is a list of parts (primitive shapes) placed relative to the object. */
function modelSection(j) {
  const parts = j.model.parts;
  const partDims = (q, i) => {
    const P = () => ent(selectedId)?.model?.parts[i] || {}, C = (path, spec) => control(P, path, spec), g = q.geometry || 'box';
    if (g === 'mesh') return [
      h('p', { class: 'desc' }, `Editable mesh: ${q.verts?.length || 0} vertices, ${q.faces?.length || 0} faces.`),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => editModel(j) }, icon('cube'), 'Edit in 3D Modeler')),
      vecRow(P, 'Position', ['x', 'y', 'z'], [0, 0, 0], 0.05),
      vecRow(P, 'Rotation', ['rx', 'ry', 'rz'], [0, 0, 0], 5),
      vecRow(P, 'Scale', ['sx', 'sy', 'sz'], [1, 1, 1], 0.05),
      C('color', { label: 'Color', type: 'color' }),
      C('smooth', { label: 'Smooth shading', type: 'bool', def: false }),
    ];
    return [
      C('geometry', { label: 'Shape', type: 'select', options: GEO_OPTIONS, structure: true }),
      vecRow(P, 'Position', ['x', 'y', 'z'], [0, 0, 0], 0.05),
      vecRow(P, 'Rotation', ['rx', 'ry', 'rz'], [0, 0, 0], 5),
      g === 'sphere' ? C('r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 })
        : g === 'cylinder' || g === 'cone' ? [C('r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 }), C('h', { label: 'Height', type: 'number', def: 1, step: 0.05 })]
          : vecRow(P, 'Size', ['w', 'h', 'd'], [1, 1, 1], 0.05),
      C('color', { label: 'Color', type: 'color' }),
      showAdvanced && C('emissive', { label: 'Glow', type: 'number', def: 0, step: 0.1 }),
    ];
  };
  const body = [
    h('button', { class: 'btn primary gc-open', onclick: () => editModel(j) }, icon('cube'), 'Open 3D Modeler'),
    h('p', { class: 'desc' }, 'Model like in Blender: reshape meshes by vertex or face (extrude, inset, subdivide…), or build from parts below. The collider fits around everything.'),
    ...parts.map((q, i) => h('div', { class: 'part' + (selectedPart === i ? ' sel' : ' closed') },
      h('div', { class: 'part-h', onclick: (e) => { if (e.target.closest('button')) return; selectedPart = selectedPart === i ? -1 : i; renderInspector(); } },
        h('span', { class: 'dot', style: `background:${q.color || '#ccc'}` }), h('span', { class: 't' }, `${i + 1}. ${q.geometry === 'mesh' ? 'Mesh' : (GEO_OPTIONS.find((g) => g[0] === (q.geometry || 'box')) || ['', 'Part'])[1]}`),
        h('button', { class: 'more', title: 'Part options', onclick: (e) => popMenu(e.currentTarget, [
          { icon: 'copy', label: 'Duplicate Part', fn: () => { parts.splice(i + 1, 0, { ...clone(q), x: (q.x || 0) + 0.3 }); selectedPart = i + 1; changed({ inspector: true }); pushHistory(); } },
          i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { parts.splice(i - 1, 0, parts.splice(i, 1)[0]); selectedPart = i - 1; changed({ inspector: true }); } },
          { icon: 'trash', label: 'Delete Part', fn: () => { parts.splice(i, 1); selectedPart = -1; changed({ inspector: true }); pushHistory(); } },
        ]) }, icon('more'))),
      selectedPart === i && h('div', { class: 'part-b' }, partDims(q, i)))),
    h('div', { class: 'row' }, h('label', {}, 'Add a part'), h('select', { onchange: (e) => {
      if (!e.target.value) return;
      parts.push({ geometry: e.target.value, x: 0, y: 0.5 + parts.length * 0.2, z: 0, w: 0.6, h: 0.6, d: 0.6, r: 0.3, color: '#90caf9' });
      selectedPart = parts.length - 1; changed({ inspector: true }); pushHistory();
    } }, h('option', { value: '' }, '+ Choose a shape…'), GEO_OPTIONS.map(([v, l]) => h('option', { value: v }, l)))),
  ];
  return comp('3D Model', body, { icon: 'cube', key: 'model', menu: [{ icon: 'trash', label: 'Remove Component', fn: () => { delete j.model; changed({ structure: true }); } }] });
}

/** Full-screen 3D Modeler for an object's model. */
function editModel(j, { edit = false } = {}) {
  const id = j.id;
  const back = () => mo.close();
  const mo = openModeler({
    model: j.model, title: j.name, h, popMenu, toast, buzz, edit,
    onChange: (m) => { const e = ent(id); if (e) { e.model = m; requestRebuild(); saveSoon(); } },
    onClose: () => { dropBack(back); pushHistory(); renderInspector(); },
  });
  pushBack(back);
}
/** 2D Sprite Editor: draw a sprite from shapes, pen lines and pixels (with frames), saved as the object's picture. */
function drawingFromLooks(j) { // start from what the object looks like now
  const sh = j?.shape;
  if (!sh) return newDrawing(64, 64);
  const w0 = sh.type === 'circle' || sh.type === 'ring' ? (sh.r || 20) * 2 : sh.w || 40, h0 = sh.type === 'circle' || sh.type === 'ring' ? w0 : sh.h || 40;
  const d = newDrawing(64, Math.max(8, Math.min(256, Math.round(64 * h0 / w0)))), pad = 4, base = { x: pad, y: pad, w: d.w - pad * 2, h: d.h - pad * 2, fill: sh.fill || '', ...(sh.stroke ? { stroke: sh.stroke, lw: Math.max(1, (sh.lineWidth || 2) * 64 / w0) } : {}), ...(sh.fill2 ? { fill2: sh.fill2, gradDir: sh.gradDir } : {}) };
  const t = { rect: ['rect'], circle: ['ellipse'], ellipse: ['ellipse'], triangle: ['triangle'], star: ['star', { sides: 5 }], heart: ['heart'], diamond: ['polygon', { sides: 4 }], hexagon: ['polygon', { sides: 6 }], pentagon: ['polygon', { sides: 5 }], octagon: ['polygon', { sides: 8 }], capsule: ['rect', { radius: 999 }], emoji: ['text', { text: sh.emoji || '⭐', fill: '#ffffff' }] }[sh.type];
  if (t) d.frames[0].parts.push({ type: t[0], ...base, ...(sh.type === 'rect' && sh.radius ? { radius: sh.radius * 64 / w0 } : {}), ...(t[1] || {}) });
  return d;
}
function editSprite2D(j) {
  const id = j?.id, back = () => ed.close();
  const ed = openSprite2D({
    drawing: j?.sprite?.drawing || drawingFromLooks(j), title: j?.name || 'New sprite', h, popMenu, toast, buzz, pickImage: (cb) => pickImage(cb, 512),
    onDone: ({ drawing, src, cols, clips }) => {
      const e = id ? ent(id) : addEntity({ name: 'Drawing', sprite: { src: '', w: 64, h: 64 } });
      if (!e) return;
      const old = e.sprite || {}, w = old.drawing || old.src ? old.w || 64 : e.shape ? (e.shape.type === 'circle' || e.shape.type === 'ring' ? (e.shape.r || 20) * 2 : e.shape.w || 64) : 64;
      e.sprite = { ...old, src, drawing, w, h: Math.round(w * drawing.h / drawing.w) };
      delete e.sprite.slice; delete e.shape;
      const bs = (e.behaviors ||= []), sheet = bs.find((b) => b.type === 'spriteSheet' && b.drawn);
      if (cols > 1) {
        Object.assign(e.sprite, { cols, rows: 1, frame: 0 });
        const conf = { image: '', cols, rows: 1, size: w, fps: drawing.fps || 8, clips, autoplay: clips.split(':')[0] || 'idle', drawn: true };
        if (sheet) Object.assign(sheet, conf); else bs.push({ type: 'spriteSheet', flip: false, auto: false, ...conf });
      } else {
        delete e.sprite.cols; delete e.sprite.rows; delete e.sprite.frame;
        if (sheet) bs.splice(bs.indexOf(sheet), 1);
      }
      changed({ structure: true }); pushHistory(); toast(cols > 1 ? `Sprite saved with ${cols} frames` : 'Sprite saved');
    },
    onClose: () => { dropBack(back); renderInspector(); },
  });
  pushBack(back);
}
function newModel() {
  const j = addEntity({ name: 'Model', y: 0, model: { parts: [{ geometry: 'mesh', ...makeCube(), x: 0, y: 0.5, z: 0, color: '#b0bec5' }] } });
  editModel(j, { edit: true });
}

const closedComps = new Set();
let showAdvanced = store.get('pocket.editor.advanced', '0') === '1', lastInspected = null, selectedPart = -1;
const voxelBrush = { mode: 'add', block: 1 };
const tileBrush = { mode: 'paint', tile: 1 };
let compClipboard = null;
function pasteComponent(j) {
  const c = compClipboard; if (!c) return;
  if (c.kind === 'behavior') (j.behaviors ||= []).push(clone(c.data));
  else j[c.kind] = clone(c.data);
  changed({ structure: true }); pushHistory();
  toast('Component pasted');
}
/** A collapsible component block. opts: { icon, key, enabled, onToggle, menu: [{label, fn}], desc } */
/** Unity-style anchor presets: 3×3 positions plus stretch row / column; changing them keeps the element where it is. */
function anchorPresets(j, inParent) {
  const cur = j.anchor || 'top-left', st = j.stretch || 'none';
  const rowOf = st === 'height' || st === 'both' ? 3 : cur.startsWith('top') ? 0 : cur.startsWith('bottom') ? 2 : 1;
  const colOf = st === 'width' || st === 'both' ? 3 : cur.includes('left') ? 0 : cur.includes('right') ? 2 : 1;
  const apply = (r, c) => {
    const live = engine.scene.byId(j.id), before = live ? uiBox(live, UIS().w, UIS().h, UIS().safe) : null;
    const v = r === 0 ? 'top' : r === 2 ? 'bottom' : '', hz = c === 0 ? 'left' : c === 2 ? 'right' : '';
    j.anchor = v && hz ? `${v}-${hz}` : v || hz || 'center';
    j.stretch = r === 3 && c === 3 ? 'both' : r === 3 ? 'height' : c === 3 ? 'width' : 'none';
    if (j.stretch === 'none') delete j.stretch;
    rebuild();
    const nl = engine.scene.byId(j.id);
    if (before && nl) { const S = UIS(), o = uiOrigin(nl, S.w, S.h, S.safe), ex = nl.extents(); j.x = Math.round(before.x - o.x - (ex.ox || 0)); j.y = Math.round(before.y - o.y - (ex.oy || 0)); } // stays where it was
    changed({ inspector: true }); pushHistory();
  };
  const cells = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const dot = h('i', { class: 'ap-dot', style: `left:${c === 3 ? 50 : [12, 50, 88][c]}%;top:${r === 3 ? 50 : [12, 50, 88][r]}%` });
    cells.push(h('button', { class: 'ap' + (r === rowOf && c === colOf ? ' on' : '') + (r === 3 ? ' sv' : '') + (c === 3 ? ' sh' : ''), title: `${['Top', 'Middle', 'Bottom', 'Stretch'][r]} · ${['Left', 'Centre', 'Right', 'Stretch'][c]}`, onclick: () => apply(r, c) }, h('span', { class: 'ap-box' }, dot)));
  }
  return h('div', { class: 'row' }, h('label', {}, inParent ? 'Anchor (in parent)' : 'Anchor'), h('div', { class: 'ap-wrap' }, h('div', { class: 'ap-grid' }, cells),
    h('div', { class: 'ap-help' }, h('b', {}, `${['Top', 'Middle', 'Bottom', 'Stretch'][rowOf]} · ${['Left', 'Centre', 'Right', 'Stretch'][colOf]}`), h('span', {}, 'Last row / column stretches across. It keeps its place when you change the anchor.'))));
}
/** Width / height of a UI element (what the Rect tool changes). */
function sizeRow(j) {
  const sz = sizeOf(j); if (!sz) return null;
  const inp = (i) => h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: Math.round(sz[i]),
    onchange: (e) => { const v = parseFloat(e.target.value); if (Number.isNaN(v)) return; const n = [...sizeOf(j)]; n[i] = v; if (n[2]) n[1 - i] = v; setSize(j, n[0], n[1]); changed({ inspector: true }); pushHistory(); } });
  return h('div', { class: 'row' }, h('label', {}, 'Size (W × H)'), h('div', { class: 'pair' }, h('span', {}, 'W'), inp(0), h('span', {}, 'H'), inp(1)));
}
const INSP_CATS = [['all', 'All'], ['visual', 'Visual'], ['physics', 'Physics'], ['logic', 'Logic'], ['anim', 'Animation'], ['game', 'Gameplay']];
const CAT_TINT = { visual: '#4c8bd6', physics: '#26a69a', logic: '#ffca28', anim: '#ab47bc', game: '#ef5350', other: '#777' };
let inspCat = 'all';
/** Which inspector filter a component belongs to. */
function compCat(key) {
  if (['shape', 'mesh', 'text', 'sprite', 'model', 'bar', 'voxels', 'tiles', 'light', 'sun', 'globalLight', 'uiel'].includes(key)) return 'visual';
  if (key === 'collider') return 'physics';
  if (key === 'body') return 'physics';
  const type = String(key).replace(/^b\d+/, ''), c = BEH_META[type]?.[0];
  if (!c) return 'other';
  if (['Logic', 'Scripting', 'AI', 'Turn-Based'].includes(c)) return 'logic';
  if (['Animation', 'Effects'].includes(c)) return 'anim';
  if (['Physics', 'Movement', 'Controllers', 'Camera'].includes(c)) return 'physics';
  return 'game';
}
function comp(title, kids, opts = {}) {
  const key = opts.key || title;
  const cat = opts.cat || compCat(key);
  const el = h('div', { class: 'comp' + (closedComps.has(key) ? ' closed' : ''), 'data-key': key, 'data-cat': cat, style: `--cc:${CAT_TINT[cat] || '#555'}` });
  const head = h('div', { class: 'comp-h', onclick: (e) => {
    if (e.target.closest('input,button')) return;
    el.classList.toggle('closed');
    if (el.classList.contains('closed')) closedComps.add(key); else closedComps.delete(key);
    const ib = el.closest('#inspector'); if (ib) syncFoldBtn(ib);
  } },
  h('span', { class: 'fold' }, icon('chevron')),
  opts.onToggle && h('input', { type: 'checkbox', checked: opts.enabled !== false, title: 'Enabled', onchange: (e) => opts.onToggle(e.target.checked) }),
  icon(opts.icon || 'bolt', 'ci'),
  h('span', { class: 't' }, title, opts.summary ? h('small', { class: 'sum' }, opts.summary) : null),
  opts.menu && h('button', { class: 'more', title: 'More', onclick: (e) => popMenu(e.currentTarget, opts.menu) }, icon('more')));
  const desc = opts.desc && h('p', { class: 'desc clamp', title: 'Tap to read all', onclick: (e) => e.currentTarget.classList.toggle('clamp') }, opts.desc);
  el.append(head, h('div', { class: 'comp-b' }, desc, kids));
  return el;
}

let inspQuery = '';
/** Odin-style inspector search: keep only matching fields (and open their components). */
function applyInspSearch(box) {
  const q = inspQuery.trim().toLowerCase();
  for (const c of box.querySelectorAll('.comp')) {
    const title = (c.querySelector('.comp-h .t')?.textContent || '').toLowerCase();
    let any = !q || title.includes(q);
    for (const r of c.querySelectorAll('.row')) {
      const lab = (r.querySelector(':scope > label')?.textContent || r.textContent || '').toLowerCase(), hit = !!q && lab.includes(q);
      r.classList.toggle('hit', hit);
      r.style.display = !q || hit || title.includes(q) ? '' : 'none';
      if (hit) { any = true; r.closest('.og')?.classList.add('open'); }
    }
    c.style.display = any ? '' : 'none';
    if (q && any) c.classList.remove('closed');
  }
}
function syncTransformInputs() {
  const j = ent(selectedId); if (!j) return;
  for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz']) {
    const el = $(`#inspector input[data-path="${k}"]`);
    if (el && document.activeElement !== el) el.value = j[k] ?? (k[0] === 's' ? 1 : 0);
  }
}

/** The Inspector with nothing selected: what it's for, a few ways to start, and the main objects to jump to. */
function inspectorEmpty() {
  const list = (project.entities || []).filter((e) => !e.ui && !e.template && e.name && !/camera|light/i.test(e.name));
  const seen = new Set(), key = [...list.filter((e) => (e.tags || []).includes('player')), ...list.filter((e) => !(e.tags || []).includes('player'))].filter((e) => !seen.has(e.name) && seen.add(e.name)).slice(0, 4); // one of each name
  const uiCount = (project.entities || []).filter((e) => e.ui && !e.parent).length;
  return h('div', { class: 'insp-empty' },
    h('div', { class: 'ie-ic' }, icon('info')),
    h('b', {}, 'Nothing selected'),
    h('p', {}, 'Tap an object in the Scene or the Hierarchy to change how it looks and what it does.'),
    h('div', { class: 'ie-btns' },
      h('button', { class: 'btn primary', onclick: () => openCreate() }, icon('plus'), 'Add'),
      h('button', { class: 'btn', onclick: () => select(SCENE_ID) }, icon('gear'), 'Game Settings'),
      h('button', { class: 'btn', onclick: () => setDock('hierarchy') }, icon('list'), 'Hierarchy'),
      h('button', { class: 'btn', onclick: () => setDock('scripts') }, icon('nodes'), 'Scripts')),
    key.length ? h('div', { class: 'ie-recent' }, h('small', {}, `In this level · ${(project.entities || []).length} objects${uiCount ? `, ${uiCount} UI` : ''}`),
      key.map((e) => h('button', { onclick: () => select(e.id) }, icon(iconFor(e)), e.name, (e.tags || []).includes('player') ? h('small', { style: 'margin:0 0 0 auto;text-transform:none;letter-spacing:0' }, 'player') : null))) : null);
}
function renderInspector() {
  const box = $('#inspector');
  const scroll = box.scrollTop;
  box.replaceChildren();
  if (selectedId === SCENE_ID) {
    const fresh = lastInspected !== SCENE_ID; lastInspected = SCENE_ID;
    renderSceneSettings(box); if (fresh && foldAllPref) foldAll(box, true); syncFoldBtn(box); compJump(box); box.scrollTop = scroll; return;
  }
  const j = ent(selectedId);
  if (!j) { box.append(inspectorEmpty()); return; }
  const T = () => ent(selectedId) || {};
  const C = (path, spec) => control(T, path, spec);
  const threeD = is3D() && !j.ui;
  const idx = project.entities.indexOf(j);
  let freshSel = false;
  if (lastInspected !== j.id) { // new selection: keep long component lists tidy
    lastInspected = j.id; selectedPart = -1; freshSel = true;
    closedComps.clear();
    const n = (j.behaviors || []).length + ['shape', 'mesh', 'text', 'sprite', 'body', 'bar', 'model', 'voxels', 'tiles'].filter((k) => j[k]).length;
    if (n > 3) { (j.behaviors || []).forEach((b, i) => closedComps.add('b' + i + b.type)); if (j.body) closedComps.add('body'); }
  }

  box.append(h('div', { class: 'insp-bar' }, // one slim row: back · search · advanced · previous / next
    h('button', { class: 'ib', title: 'Back to the Hierarchy', onclick: () => setDock('hierarchy') }, icon('left')),
    h('input', { type: 'search', placeholder: `Search (${idx + 1}/${project.entities.length})`, value: inspQuery, autocapitalize: 'off', oninput: (e) => { inspQuery = e.target.value; applyInspSearch(box); } }),
    h('button', { class: 'ib adv-btn' + (showAdvanced ? ' on' : ''), title: 'Show advanced options', 'aria-pressed': String(showAdvanced),
      onclick: () => { showAdvanced = !showAdvanced; store.set('pocket.editor.advanced', showAdvanced ? '1' : '0'); renderInspector(); toast(showAdvanced ? 'Showing advanced options' : 'Advanced options hidden'); } }, icon('gear')),
    h('button', { class: 'ib mod-btn' + (onlyChanged ? ' on' : ''), title: 'Show only settings changed from their defaults', 'aria-pressed': String(onlyChanged),
      onclick: () => { onlyChanged = !onlyChanged; renderInspector(); toast(onlyChanged ? 'Showing only changed settings' : 'Showing all settings'); } }, icon('edit')),
    h('button', { class: 'ib', title: 'Previous object', onclick: () => stepSelection(-1) }, icon('chevron')),
    h('button', { class: 'ib next', title: 'Next object', onclick: () => stepSelection(1) }, icon('chevron'))));

  // header: active toggle + name, tag, flags
  box.append(h('div', { class: 'insp-head' },
    h('div', { class: 'big-ico' }, icon(iconFor(j))),
    h('input', { type: 'checkbox', checked: j.visible !== false, title: 'Active', onchange: (e) => { j.visible = e.target.checked; changed({ structure: true }); } }),
    h('input', { type: 'text', value: j.name || '', oninput: (e) => { j.name = e.target.value; changed(); renderHierarchy(); } }),
    ...tagLayerRows(j),
    kidsOf(j.id).length ? kidsCard(j) : null,
    showAdvanced && h('div', { class: 'sub' },
      h('label', { title: 'Hidden while playing; Spawner/Shooter make copies' }, h('input', { type: 'checkbox', checked: !!j.template, onchange: (e) => { j.template = e.target.checked; changed({ structure: true }); } }), 'Template'),
      h('label', { title: 'Cannot be picked in the Scene view' }, h('input', { type: 'checkbox', checked: !!j.locked, onchange: (e) => { j.locked = e.target.checked; changed({ structure: true }); } }), 'Locked'))));
  if (j.template) box.append(h('p', { class: 'desc', style: 'padding:0 8px;color:var(--dim);font-size:11.5px' }, 'Template: hidden while playing. Spawner and Shooter components create copies of it by name.'));
  const pfb = prefabBanner(j); if (pfb) box.append(pfb);

  // quick add + component filters (Odin-style tidy inspector)
  const quick = ['b:triggers', 'body', 'b:tween', 'b:health', 'b:animator', 'b:fsm'].map((k) => componentsFor(j).find((c) => c.key === k)).filter((c) => c && c.ok(j) && !(c.key.startsWith('b:') && (j.behaviors || []).some((b) => 'b:' + b.type === c.key)));
  const quickRow = quick.length && h('div', { class: 'quick-add' }, h('span', {}, 'Quick add'), quick.slice(0, 4).map((c) => h('button', { onclick: () => addComponentTo(j.id, c.key) }, icon(c.icon), c.label.replace(/ \(.*\)$/, '')))); // shown by Add Component below
  const nComps = 1 + ['shape', 'text', 'sprite', 'mesh', 'model', 'bar', 'body', 'collider', 'light', 'voxels', 'tiles'].filter((k) => j[k]).length + (j.behaviors || []).length;
  if (nComps < 5 && inspCat !== 'all') inspCat = 'all';
  box.append(h('div', { class: 'comp-tools' + (nComps < 5 ? ' few' : '') },
    h('div', { class: 'cf' }, nComps < 5 ? h('span', { class: 'cf-n' }, `${nComps} component${nComps === 1 ? '' : 's'}`) : INSP_CATS.map(([k, l]) => h('button', { class: inspCat === k ? 'on' : '', onclick: () => { inspCat = k; renderInspector(); } }, l))),
    foldAllBtn(box)));

  // Transform
  box.append(comp(j.ui ? 'Rect Transform' : 'Transform', threeD
    ? [vecRow(T, 'Position', ['x', 'y', 'z'], [0, 0, 0], 0.1), vecRow(T, 'Rotation', ['rx', 'ry', 'rz'], [0, 0, 0], 1), vecRow(T, 'Scale', ['sx', 'sy', 'sz'], [1, 1, 1], 0.05)]
    : [
      vecRow(T, j.ui ? 'Offset' : 'Position', ['x', 'y'], [0, 0], 1), vecRow(T, 'Rotation', ['rz'], [0], 1), vecRow(T, 'Scale', ['sx', 'sy'], [1, 1], 0.05)],
  { icon: 'move', key: 'transform', summary: threeD ? `${round(j.x || 0)}, ${round(j.y || 0)}, ${round(j.z || 0)}` : `${round(j.x || 0)}, ${round(j.y || 0)}${j.rz ? ` · ${round(j.rz)}°` : ''}`, menu: [{ label: 'Reset', fn: () => { for (const k of ['rx', 'ry', 'rz']) delete j[k]; for (const k of ['sx', 'sy', 'sz']) delete j[k]; changed({ inspector: true }); } }] }));

  if (j.ui) {
    const inParent = j.parent && ent(j.parent)?.ui;
    box.append(comp('UI Element', [
      h('p', { class: 'desc' }, inParent ? `Anchored inside its parent “${ent(j.parent).name}”: it moves and stretches with it.` : 'UI stays fixed on the screen. Anchor it to a corner, edge or the centre so it fits every phone, or stretch it across.'),
      anchorPresets(j, inParent),
      sizeRow(j),
      C('stretch', { label: inParent ? 'Stretch inside parent' : 'Stretch to screen', type: 'select', options: [['none', 'No'], ['width', 'Full width'], ['height', 'Full height'], ['both', 'Fill']], def: 'none', structure: true }),
      j.stretch && j.stretch !== 'none' && C('margin', { label: 'Margin', type: 'number', def: 16, range: [0, 120], step: 2 }),
      j.stretch && j.stretch !== 'none' && C('marginTop', { label: 'Top margin (blank = Margin)', type: 'number', def: '', step: 2 }),
      j.stretch && j.stretch !== 'none' && C('marginBottom', { label: 'Bottom margin (blank = Margin)', type: 'number', def: '', step: 2 }),
      !inParent && C('ignoreSafe', { label: 'Ignore safe area (go under the notch)', type: 'bool', def: false, structure: true }),
      !inParent && j.ignoreSafe && h('p', { class: 'desc' }, 'For full-screen backgrounds and images. Keep buttons and text inside the safe area so notches and the home bar never cover them.'),
      !inParent && !j.ignoreSafe && !(j.behaviors || []).some((b) => ['uiBottomNav', 'uiAppBar', 'uiSideBar'].includes(b.type)) && C('ignoreBars', { label: 'Go under the nav bars', type: 'bool', def: false, structure: true, infoText: 'Normally UI stays clear of a Bottom Nav, App Bar or Icon Rail. Turn this on for backgrounds that should fill the whole screen.' }),
      (root.settings?.uiOverlap === 'push apart') && C('overlap', { label: 'Allowed to overlap other UI', type: 'bool', def: false, structure: true, infoText: 'Game Settings › Screen keeps UI apart; this element may sit on top of others (badges, labels on pictures).' }),
      C('showWhen', { label: 'Show when', type: 'select', options: [['always', 'Always'], ['play', 'While playing'], ['title', 'Title screen'], ['paused', 'Paused'], ['over', 'Game over'], ['win', 'Win / level complete']], def: 'always' }),
      h('p', { class: 'desc' }, 'Make your own menus: turn on "Custom Screens" in Game Settings, then add Buttons that start, pause or restart the game.'),
      h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: () => { styleClipboard = styleOf(j); toast('Style copied'); } }, icon('copy'), 'Copy Style'),
        h('button', { class: 'btn', onclick: () => { if (!styleClipboard) return toast('Copy a style first'); pasteStyle(j, styleClipboard); changed({ inspector: true }); pushHistory(); toast('Style pasted'); } }, icon('paste'), 'Paste Style'),
        h('button', { class: 'btn', onclick: () => { applyTheme([j]); changed({ inspector: true }); pushHistory(); } }, icon('brush'), 'Use Theme')),
    ], { icon: 'hud', key: 'uiel' }));
  }

  const copyItem = (kind, get) => ({ icon: 'copy', label: 'Copy Component', fn: () => { compClipboard = { kind, data: clone(get()) }; toast('Component copied'); } });
  const removeMenu = (fn, kind) => [kind && copyItem(kind, () => j[kind]),
    kind && compClipboard?.kind === kind && { icon: 'paste', label: 'Paste Values', fn: () => { j[kind] = clone(compClipboard.data); changed({ structure: true }); pushHistory(); toast('Values pasted'); } },
    { icon: 'trash', label: 'Remove Component', fn }].filter(Boolean);
  if (j.shape) {
    const t = j.shape.type;
    box.append(comp('Shape Renderer', [
      C('shape.type', { label: 'Shape', type: 'select', options: [['rect', 'Rectangle'], ['circle', 'Circle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['star', 'Star'], ['heart', 'Heart'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['pentagon', 'Pentagon'], ['octagon', 'Octagon'], ['capsule', 'Capsule'], ['ring', 'Ring'], ['arrow', 'Arrow'], ['cloud', 'Cloud'], ['emoji', 'Emoji (text)']], structure: true }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => editSprite2D(j) }, icon('brush'), 'Draw your own (2D Sprite Editor)')),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => pickSprite((url) => { j.sprite = { src: url, w: j.shape.w || (j.shape.r || 20) * 2 || 56, h: j.shape.h || (j.shape.r || 20) * 2 || 56 }; delete j.shape; changed({ structure: true }); pushHistory(); toast('Now a sprite: change it in the Image component'); }) }, icon('image'), 'Use a sprite picture instead')),
      t === 'emoji' && h('div', { class: 'row' }, h('label', {}, 'Sprite'), h('button', { class: 'btn', style: 'font-size:30px', onclick: () => pickEmoji((em) => { j.shape.emoji = em; changed({ inspector: true }); }) }, j.shape.emoji || '⭐', h('span', { style: 'font-size:15px' }, 'Change…'))),
      t === 'circle' || t === 'ring' ? C('shape.r', { label: 'Radius', type: 'number', def: 20 }) : [C('shape.w', { label: 'Width', type: 'number', def: 40 }), C('shape.h', { label: t === 'emoji' ? 'Size' : 'Height', type: 'number', def: 40 })],
      t === 'rect' && C('shape.radius', { label: 'Corner Radius', type: 'number', def: 0 }),
      t !== 'emoji' && C('shape.fill', { label: 'Fill', type: 'color', optional: true }),
      t !== 'emoji' && C('shape.stroke', { label: 'Outline', type: 'color', optional: true, structure: true }),
      fold('shape:more', 'More looks', [
      t !== 'emoji' && j.shape.stroke && C('shape.lineWidth', { label: 'Outline Width', type: 'number', def: 2 }),
      t !== 'emoji' && j.shape.stroke && C('shape.dash', { label: 'Dashed outline', type: 'number', def: 0, range: [0, 30], step: 1 }),
      t !== 'emoji' && j.shape.fill && C('shape.fill2', { label: 'Gradient to', type: 'color', optional: true, structure: true }),
      t !== 'emoji' && j.shape.fill2 && C('shape.gradDir', { label: 'Gradient direction', type: 'select', options: [['down', 'Top to bottom'], ['right', 'Left to right'], ['diagonal', 'Diagonal'], ['radial', 'From the centre']], def: 'down' }),
      C('shape.shadow', { label: 'Drop shadow', type: 'color', optional: true, structure: true }),
      j.shape.shadow && [C('shape.shadowBlur', { label: 'Shadow softness', type: 'number', def: 10, range: [0, 60], step: 1 }), C('shape.shadowY', { label: 'Shadow distance', type: 'number', def: 4, range: [-30, 30], step: 1 })],
      !j.shape.shadow && C('shape.glow', { label: 'Glow', type: 'number', def: 0 }),
      ], !!(j.shape.fill2 || j.shape.shadow || +j.shape.glow || +j.shape.dash)),
    ], { icon: iconFor(j), key: 'shape', summary: `${t === 'rect' ? 'Rectangle' : t} · ${t === 'circle' || t === 'ring' ? 'r ' + (j.shape.r ?? 20) : `${j.shape.w ?? 40}×${j.shape.h ?? 40}`}`, menu: removeMenu(() => { delete j.shape; changed({ structure: true }); }, 'shape') }));
  }
  if (j.sprite) {
    box.append(comp('Image', [
      C('sprite.src', { label: 'Source URL', type: 'text' }),
      j.sprite.src ? h('div', { class: 'row side' }, h('label', {}, 'Picture'), h('img', { class: 'img-thumb', src: artURL(j.sprite.src), alt: '' })) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn' + (j.sprite.drawing ? '' : ' primary'), onclick: () => pickSprite((url) => { j.sprite.src = url; delete j.sprite.drawing; if (frameSlice(url) && !j.sprite.slice) j.sprite.slice = frameSlice(url); changed({ inspector: true }); }, { device: false }) }, icon('star'), 'Sprite library'),
        h('button', { class: 'btn', onclick: () => pickImage((url) => { j.sprite.src = url; delete j.sprite.drawing; changed({ inspector: true }); }) }, icon('image'), 'From device'),
        h('button', { class: 'btn' + (j.sprite.drawing ? ' primary' : ''), onclick: () => editSprite2D(j) }, icon('brush'), j.sprite.drawing ? 'Edit Drawing' : 'Draw')),
      C('sprite.w', { label: 'Width', type: 'number', def: 64 }),
      C('sprite.h', { label: 'Height', type: 'number', def: 64 }),
      C('sprite.radius', { label: 'Round corners', type: 'number', def: 0, range: [0, 100], step: 1 }),
      C('sprite.slice', { label: '9-slice border (px)', type: 'number', def: 0, range: [0, 128], step: 1, structure: true, infoText: 'For framed panels and buttons: the picture\'s corners stay sharp and only the middle stretches, so one image fits any size. 0 = stretch the whole picture.' }),
      j.sprite.slice > 0 && C('sprite.sliceScale', { label: 'Border size', type: 'number', def: 1, range: [0.25, 4], step: 0.25 }),
    ], { icon: 'image', key: 'sprite', menu: removeMenu(() => { delete j.sprite; changed({ structure: true }); }, 'sprite') }));
  }
  if (j.text) {
    box.append(comp('Text', [
      C('text.value', { label: 'Text', type: 'text' }),
      h('p', { class: 'desc' }, 'Show game variables with braces: {score}, {lives}, {best}.'),
      C('text.size', { label: 'Font Size', type: 'number', def: 24 }),
      C('text.color', { label: 'Color', type: 'color' }),
      C('text.align', { label: 'Alignment', type: 'select', options: ['left', 'center', 'right'], def: 'center' }),
      C('text.font', { label: 'Font', type: 'select', options: fontOptions(j.text.font), def: 'theme' }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => openFontPicker((f) => { j.text.font = f; changed({ inspector: true }); pushHistory(); }) }, icon('text'), 'More fonts…')),
      C('text.weight', { label: 'Weight', type: 'select', options: [['400', 'Normal'], ['600', 'Semi-bold'], ['800', 'Bold'], ['900', 'Black']], def: '800' }),
      fold('text:style', 'Style: italic, letters, gradient', [
      C('text.italic', { label: 'Italic', type: 'bool', def: false }),
      C('text.color2', { label: 'Gradient to', type: 'color', optional: true }),
      C('text.case', { label: 'Letters', type: 'select', options: [['', 'As typed'], ['upper', 'UPPERCASE'], ['lower', 'lowercase']], def: '' }),
      C('text.spacing', { label: 'Letter spacing', type: 'number', def: 0, range: [-4, 20], step: 0.5 }),
      ], !!(j.text.italic || j.text.color2 || j.text.case || +j.text.spacing)),
      fold('text:lines', 'Wrapping and line spacing', [
      C('text.wrap', { label: 'Wrap width (0 = one line)', type: 'number', def: 0, range: [0, 600], step: 10, infoText: 'Long text breaks onto new lines to fit this width. Type \\n in the text for a line break anywhere.' }),
      C('text.lineHeight', { label: 'Line spacing', type: 'number', def: 1.2, range: [0.8, 2.5], step: 0.05 }),
      j.shape && j.shape.type !== 'circle' && j.text.align && j.text.align !== 'center' && C('text.inset', { label: 'Inset from the box edge (0 = off)', type: 'number', def: 0, range: [0, 200], step: 1, infoText: 'Left or right text starts this far in from the edge of its box (room for an icon, like a search bar). 0 = from the middle.' }),
      ], !!(+j.text.wrap || (j.text.lineHeight && +j.text.lineHeight !== 1.2) || +j.text.inset)),
      fold('text:fx', 'Outline, shadow, glow, underline', [
      C('text.outline', { label: 'Outline', type: 'color', optional: true }),
      j.text.outline && C('text.outlineWidth', { label: 'Outline Width', type: 'number', def: 4 }),
      C('text.shadow', { label: 'Drop Shadow', type: 'bool', def: false, structure: true }),
      j.text.shadow && C('text.shadowColor', { label: 'Shadow color', type: 'color', def: '#000000' }),
      C('text.glow', { label: 'Glow', type: 'color', optional: true }),
      C('text.underline', { label: 'Underline', type: 'bool', def: false }),
      C('text.strike', { label: 'Strikethrough', type: 'bool', def: false }),
      ], !!(j.text.outline || j.text.shadow || j.text.glow || j.text.underline || j.text.strike)),
      fold('text:numbers', 'Numbers and fitting', [
      C('text.format', { label: 'Show numbers as', type: 'select', options: [['', 'Normal (1,234)'], ['short (1.2K)', 'Short (1.2K, 3.4M)'], ['whole number', 'Whole number'], ['2 decimals', '2 decimals'], ['time (m:ss)', 'Time (1:05)'], ['percent', 'Percent (0.5 → 50%)'], ['plain', 'Plain']], def: '' }),
      C('text.fit', { label: 'Shrink to fit width (0 = off)', type: 'number', def: 0, range: [0, 600], step: 10, infoText: 'Long names or big numbers get smaller instead of spilling out.' }),
      String(j.text.value || '').includes('{') && j.ui && C('text.bump', { label: 'Pop when the value changes', type: 'bool', def: true, infoText: 'A score or coin count grows for a moment whenever it changes.' }),
      C('text.valign', { label: 'Lines grow', type: 'select', options: [['', 'From the middle'], ['top', 'Downward (first line here)'], ['bottom', 'Upward (last line here)']], def: '' }),
      ], !!(j.text.format || +j.text.fit || j.text.valign)),
      fold('text:box', 'Label box', [
      C('text.bg', { label: 'Box behind the text', type: 'color', optional: true, structure: true }),
      j.text.bg && [C('text.bgPad', { label: 'Box padding', type: 'number', def: 8, range: [0, 40], step: 1 }), C('text.bgRadius', { label: 'Box roundness', type: 'number', def: 8, range: [0, 40], step: 1 })],
      ], !!j.text.bg),
      fold('text:anim', 'Animation', [
      C('text.effect', { label: 'Effect', type: 'select', options: [['', 'None'], ['wave', 'Wave (letters)'], ['bounce', 'Bounce (letters)'], ['shake', 'Shake (letters)'], ['rainbow', 'Rainbow (letters)'], ['pulse', 'Pulse'], ['float', 'Float up and down']], def: '' }),
      ], !!j.text.effect),
    ], { icon: 'text', key: 'text', summary: `“${String(j.text.value || '').slice(0, 18)}${String(j.text.value || '').length > 18 ? '…' : ''}” · ${j.text.size || 24}px`, menu: removeMenu(() => { delete j.text; changed({ structure: true }); }, 'text') }));
  }
  if (j.mesh) {
    const g = j.mesh.geometry;
    box.append(comp('Mesh Renderer', [
      C('mesh.geometry', { label: 'Mesh', type: 'select', options: GEO_OPTIONS, structure: true }),
      !['sphere', 'cylinder', 'cone', 'plane'].includes(g) && [C('mesh.w', { label: 'Width', type: 'number', def: 1, step: 0.1 }), C('mesh.h', { label: 'Height', type: 'number', def: 1, step: 0.1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1, step: 0.1 })],
      g === 'sphere' && C('mesh.r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 }),
      (g === 'cylinder' || g === 'cone') && [C('mesh.r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 }), C('mesh.h', { label: 'Height', type: 'number', def: 1, step: 0.1 })],
      g === 'plane' && [C('mesh.w', { label: 'Width', type: 'number', def: 1, step: 0.1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1, step: 0.1 })],
      C('mesh.color', { label: 'Color', type: 'color' }),
      C('mesh.emissive', { label: 'Emission', type: 'number', def: 0, step: 0.05 }),
      C('mesh.opacity', { label: 'Opacity', type: 'number', def: 1, step: 0.05 }),
    ], { icon: 'cube', key: 'mesh', menu: removeMenu(() => { delete j.mesh; changed({ structure: true }); }, 'mesh') }));
  }
  if (j.model) box.append(modelSection(j));
  if (j.bar) {
    box.append(comp('Progress Bar', [
      h('p', { class: 'desc' }, 'Shows a variable as a bar: health, energy, progress. Use "self.hp" for this object\'s own health (Health component).'),
      C('bar.var', { label: 'Variable', type: 'text', def: 'hp' }),
      h('div', { class: 'row' }, h('label', {}, 'Style'), h('div', { class: 'pair' },
        h('button', { class: 'btn' + (!j.bar.icon && j.bar.style !== 'ring' ? ' primary' : ''), style: 'flex:1', onclick: () => { delete j.bar.icon; delete j.bar.style; changed({ inspector: true }); } }, 'Bar'),
        h('button', { class: 'btn' + (j.bar.style === 'ring' ? ' primary' : ''), style: 'flex:1', onclick: () => { delete j.bar.icon; j.bar.style = 'ring'; const m = Math.max(j.bar.w, j.bar.h, 60); j.bar.w = j.bar.h = Math.min(m, 120); changed({ inspector: true }); } }, 'Ring'),
        h('button', { class: 'btn' + (j.bar.icon ? ' primary' : ''), style: 'flex:1;font-size:20px', onclick: () => pickEmoji((em) => { j.bar.icon = em; delete j.bar.style; if (j.bar.h < 22) j.bar.h = 28; changed({ inspector: true }); }) }, j.bar.icon || '❤️', h('span', { style: 'font-size:15px' }, 'Icons')))),
      C('bar.max', { label: 'Maximum', type: 'number', def: 100 }),
      showAdvanced && C('bar.maxVar', { label: 'Maximum from variable', type: 'text', def: '' }),
      C('bar.w', { label: 'Width', type: 'number', def: 160 }), C('bar.h', { label: 'Height', type: 'number', def: 16 }),
      C('bar.fill', { label: 'Bar color', type: 'color' }), C('bar.bg', { label: 'Background', type: 'color' }),
      !j.bar.icon && j.bar.style !== 'ring' && C('bar.radius', { label: 'Roundness', type: 'number', def: 8 }),
      !j.bar.icon && [
        h('h5', { class: 'sub-head' }, 'Look'),
        h('div', { class: 'bar-looks' }, [['', 'Flat'], ['striped', 'Striped'], ['segments', 'Blocks'], ['glossy', 'Glossy'], ['glow', 'Glow']].map(([v, l]) =>
          h('button', { type: 'button', class: 'btn' + ((j.bar.look || '') === v ? ' primary' : ''), onclick: () => { if (v) j.bar.look = v; else delete j.bar.look; changed({ inspector: true }); } }, l))),
        j.bar.look === 'segments' && C('bar.segments', { label: 'Blocks', type: 'number', def: 10, step: 1, range: [2, 30] }),
        j.bar.style === 'ring' ? C('bar.thick', { label: 'Thickness', type: 'number', def: 0.22, step: 0.02, range: [0.05, 0.5] })
          : C('bar.dir', { label: 'Fills', type: 'select', options: [['right', 'Left → right'], ['left', 'Right → left'], ['up', 'Bottom → top'], ['down', 'Top → bottom'], ['center', 'From the middle']], def: 'right' }),
        j.bar.style !== 'ring' && C('bar.fill2', { label: 'Gradient to', type: 'color', optional: true }),
        C('bar.border', { label: 'Border', type: 'color', optional: true }),
        C('bar.borderWidth', { label: 'Border width', type: 'number', def: 2, step: 1 }),
        h('h5', { class: 'sub-head' }, 'Motion'),
        C('bar.smooth', { label: 'Changes', type: 'select', options: [['', 'Smoothly (default)'], ['instant', 'Instantly'], ['snappy', 'Quickly'], ['smooth', 'Gently'], ['slow', 'Slowly']], def: '' }),
        C('bar.trail', { label: 'Damage trail', type: 'color', optional: true, infoText: 'When the value drops, the lost part stays in this colour for a moment, then slides away (fighting-game health bars).' }),
        C('bar.lowAt', { label: 'Warn below (0–1)', type: 'number', def: 0, step: 0.05, range: [0, 1], lazy: true }),
        +j.bar.lowAt > 0 && C('bar.lowColor', { label: 'Warning colour', type: 'color', def: '#ff5252' }),
        C('bar.busy', { label: 'Busy (unknown progress)', type: 'bool', def: false, infoText: 'A piece sweeps across again and again: for waiting when you don\'t know how long it takes.' }),
      ],
      h('h5', { class: 'sub-head' }, 'Label'),
      C('bar.label', { label: 'Show numbers', type: 'bool', def: false, structure: true }),
      j.bar.label && [
        C('bar.labelText', { label: 'Text', def: '', placeholder: j.bar.style === 'ring' ? '{percent}%' : '{value} / {max}', infoText: 'Use {value}, {max}, {percent} and {left}. Empty: ' + (j.bar.style === 'ring' ? '{percent}%' : '{value} / {max}') + '.' }),
        j.bar.style !== 'ring' && C('bar.labelPos', { label: 'Where', type: 'select', options: [['inside', 'Inside'], ['above', 'Above'], ['below', 'Below'], ['right', 'To the right']], def: 'inside' }),
        C('bar.labelColor', { label: 'Colour', type: 'color', def: '#ffffff' }),
        j.bar.style !== 'ring' && C('bar.labelSize', { label: 'Size (0 = auto)', type: 'number', def: 0, step: 1 }),
      ],
    ], { icon: 'hud', key: 'bar', menu: [{ icon: 'trash', label: 'Remove Component', fn: () => { delete j.bar; changed({ structure: true }); } }] }));
  }
  if (j.voxels) {
    const V = engine.scene.byId(j.id)?.voxels, pal = V?.palette || [];
    box.append(comp('Voxel World', [
      h('p', { class: 'desc' }, `${V ? V.count.toLocaleString() : 0} blocks. To build here: pick the Paint tool (brush), choose Add or Remove and a block, then tap or drag on the world.`),
      h('div', { class: 'row' }, h('label', {}, 'Brush'), h('div', { class: 'pair' },
        ...['add', 'remove'].map((m) => h('button', { class: 'btn' + (voxelBrush.mode === m ? ' primary' : ''), style: 'flex:1', onclick: () => { voxelBrush.mode = m; setTool('paint'); renderInspector(); } }, m === 'add' ? 'Add' : 'Remove')))),
      h('div', { class: 'row' }, h('label', {}, 'Block'), h('div', { class: 'swatches' }, pal.map((c, i) => h('button', {
        class: 'sw' + (voxelBrush.block === i + 1 ? ' on' : ''), style: `background:${c}`, title: VOXEL_NAMES[i] || `Block ${i + 1}`,
        onclick: () => { voxelBrush.block = i + 1; voxelBrush.mode = 'add'; setTool('paint'); renderInspector(); } })))),
      C('voxels.gen.type', { label: 'Terrain', type: 'select', options: [['hills', 'Hills with trees'], ['flat', 'Flat'], ['empty', 'Empty (build from scratch)']], def: 'hills', structure: true }),
      C('voxels.gen.w', { label: 'Width', type: 'number', def: 24, step: 4 }),
      C('voxels.gen.d', { label: 'Depth', type: 'number', def: 24, step: 4 }),
      C('voxels.gen.h', { label: 'Hill height', type: 'number', def: 5 }),
      C('voxels.gen.seed', { label: 'Seed (shape of the land)', type: 'number', def: 1 }),
      C('voxels.gen.trees', { label: 'Trees', type: 'bool', def: true }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { if (!confirm('Remove all blocks you added or removed by hand?')) return; j.voxels.edits = {}; changed({ inspector: true }); pushHistory(); } }, icon('trash'), 'Clear my edits')),
    ], { icon: 'grid', key: 'voxels', menu: [{ icon: 'trash', label: 'Remove Component', fn: () => { delete j.voxels; changed({ structure: true }); } }] }));
  }
  if (j.tiles) box.append(tilemapCard(j, C));
  if (j.minimap) {
    box.append(comp('Minimap', [
      h('p', { class: 'desc' }, 'A small map of the level: the player (blue), enemies (red), walls and coins. Resize it with the Rect tool.'),
      C('minimap.follow', { label: 'Centre on tag', type: 'text', def: 'player', suggest: 'tags' }),
      C('minimap.range', { label: 'How much it shows', type: 'number', def: 800, step: threeD ? 5 : 50 }),
      C('minimap.round', { label: 'Round', type: 'bool', def: false }),
      C('minimap.bg', { label: 'Background', type: 'color' }), C('minimap.border', { label: 'Border', type: 'color' }),
      C('minimap.playerColor', { label: 'Player dot', type: 'color', def: '#4fc3f7' }), C('minimap.enemyColor', { label: 'Enemy dots', type: 'color', def: '#ff5252' }),
    ], { icon: 'grid', key: 'minimap', menu: removeMenu(() => { delete j.minimap; changed({ structure: true }); }, 'minimap') }));
  }
  if (j.light) {
    box.append(comp('Light', [
      h('p', { class: 'desc' }, threeD ? 'A point light: lights up nearby objects (up to 8 at once).' : 'Glows, and cuts through the darkness when Game Settings → Lighting → Darkness is above 0.'),
      C('light.color', { label: 'Color', type: 'color' }),
      C('light.intensity', { label: 'Brightness', type: 'number', def: 1, step: 0.1 }),
      C('light.range', { label: 'Range', type: 'number', def: threeD ? 8 : 160, step: threeD ? 0.5 : 10 }),
      C('light.flicker', { label: 'Flicker (0–1, like a torch)', type: 'number', def: 0, step: 0.1 }),
      C('light.type', { label: 'Type', type: 'select', options: [['point', 'Point'], ['spot', 'Spotlight']], def: +j.light.cone > 0 ? 'spot' : 'point', structure: true }),
      (j.light.type === 'spot' || (!j.light.type && +j.light.cone > 0)) && C('light.cone', { label: 'Spot width (°)', type: 'number', def: 60, range: [5, 179], step: 5 }),
      (j.light.type === 'spot' || (!j.light.type && +j.light.cone > 0)) && (threeD ? C('light.tilt', { label: 'Aim down (°, 90 = straight down; turn the object to aim it)', type: 'number', def: 90, range: [0, 90], step: 5 })
        : C('light.aim', { label: 'Aim (°, 0 = right, 90 = down; plus the object’s rotation)', type: 'number', def: 0, range: [-180, 180], step: 15 })),
      C('light.effect', { label: 'Effect', type: 'select', options: [['', 'Steady'], ['pulse', 'Pulse'], ['blink', 'Blink'], ['fire', 'Fire'], ['rainbow', 'Rainbow']], def: '', structure: true, dropdown: true }),
      j.light.effect && C('light.speed', { label: 'Effect speed', type: 'number', def: 1, range: [0.1, 6], step: 0.1 }),
      !threeD && C('light.soft', { label: 'Softness', type: 'number', def: 0.5, range: [0, 1], step: 0.05 }),
      !threeD && C('light.shadows', { label: 'Casts shadows (solid objects block it)', type: 'bool', def: false }),
    ], { icon: 'bulb', key: 'light', menu: removeMenu(() => { delete j.light; changed({ structure: true }); }, 'light') }));
  }
  if (j.sun) box.append(comp('Directional Light', [
    h('p', { class: 'desc' }, 'Sunlight for the whole level. Turn it with Rotation (X tilts it down, Y swings it around) to move the shadows.'),
    C('sun.color', { label: 'Colour', type: 'color', def: '#ffffff' }),
    C('sun.intensity', { label: 'Intensity', type: 'number', def: 1, step: 0.1, range: [0, 3] }),
    C('sun.ambient', { label: 'Ambient (shadow fill)', type: 'number', def: 0.45, step: 0.05, range: [0, 1] }),
    C('sun.shadows', { label: 'Shadows', type: 'bool', def: true }),
  ], { icon: 'sun', key: 'sun', menu: removeMenu(() => { delete j.sun; changed({ structure: true }); }, 'sun') }));
  if (j.globalLight) box.append(comp('Global Light 2D', [
    h('p', { class: 'desc' }, 'How bright the whole level is. Turn Brightness down for night or caves; objects with a Light shine through the dark.'),
    C('globalLight.brightness', { label: 'Brightness', type: 'number', def: 1, step: 0.05, range: [0, 1] }),
    C('globalLight.color', { label: 'Darkness colour', type: 'color', def: '#0a0a1e' }),
  ], { icon: 'sun', key: 'globalLight', menu: removeMenu(() => { delete j.globalLight; changed({ structure: true }); }, 'globalLight') }));
  const editColliderBtn = () => !threeD && h('div', { class: 'btns' }, h('button', { class: 'btn' + (colliderEdit === j.id ? ' primary' : ''), onclick: () => {
    colliderEdit = colliderEdit === j.id ? null : j.id; renderInspector(); engine.render();
    if (colliderEdit) { if (!isDesktop() && sheetState() === 'full') setSheet('half'); toast(['polygon', 'edge'].includes(j.collider?.shape) ? 'Drag the green dots to move the corners; the middle moves it all' : 'Drag the green handles: edges resize, the middle moves the collider'); }
  } }, icon('body'), colliderEdit === j.id ? 'Done Editing Collider' : 'Edit Collider'));
  if (j.collider && !j.ui) { // Unity-style collider component
    const cs = j.collider.shape || 'box', round_ = cs === 'circle' || cs === 'sphere', pointy = cs === 'polygon' || cs === 'edge';
    const fitted = !(j.collider.w || j.collider.h || j.collider.r || j.collider.points?.length), info = colliderInfo(cs, threeD), step = threeD ? 0.05 : 1;
    const setPts = (fn) => { const np = (j.collider.points || []).map((q) => [...q]); fn(np); j.collider.points = np; changed({ inspector: true }); pushHistory(); };
    const presetMenu = (ev) => popMenu(ev.currentTarget, [{ cap: cs === 'edge' ? 'Edge shape' : 'Polygon shape' },
      ...(cs === 'polygon' && shapeOutline(j) ? [{ icon: 'frame', label: 'Match the drawn shape', fn: () => setPts((np) => np.splice(0, np.length, ...shapeOutline(j))) }] : []),
      ...(cs === 'edge' ? EDGE_PRESETS : POLY_PRESETS).map(([k, l]) => ({ icon: cs, label: l, fn: () => { const f = fitCollider(j, 'box'), hx = (f.w || 40) / 2, hy = (f.h || 40) / 2; setPts((np) => np.splice(0, np.length, ...colliderPreset(cs, k, hx, hy))); } })),
      { cap: 'Change' },
      { icon: 'move', label: 'Flip left ↔ right', fn: () => setPts((np) => { for (const q of np) q[0] = -q[0]; np.reverse(); }) },
      { icon: 'move', label: 'Flip upside down', fn: () => setPts((np) => { for (const q of np) q[1] = -q[1]; np.reverse(); }) },
      { icon: 'scale', label: 'Bigger (×1.25)', fn: () => setPts((np) => { for (const q of np) { q[0] = round(q[0] * 1.25, 2); q[1] = round(q[1] * 1.25, 2); } }) },
      { icon: 'scale', label: 'Smaller (×0.8)', fn: () => setPts((np) => { for (const q of np) { q[0] = round(q[0] * 0.8, 2); q[1] = round(q[1] * 0.8, 2); } }) }]);
    const pointsEditor = () => {
      const P = j.collider.points || [], min = cs === 'edge' ? 2 : 3;
      return h('div', { class: 'pts-ed' },
        h('div', { class: 'row side' }, h('label', {}, `Points (${P.length})`), h('div', { class: 'btns' },
          h('button', { class: 'btn', onclick: presetMenu }, icon(cs), 'Presets'),
          h('button', { class: 'btn', onclick: () => setPts((np) => { // a new corner halfway along the last side (an edge grows at its end)
            const n = np.length, a = np[n - 1] || [0, 0], b = cs === 'edge' ? null : np[0], prev = np[n - 2] || [a[0] - 20, a[1]];
            np.push(b ? [round((a[0] + b[0]) / 2, 2), round((a[1] + b[1]) / 2, 2)] : [round(a[0] + (a[0] - prev[0] || 20), 2), round(a[1] + (a[1] - prev[1]), 2)]);
          }) }, icon('plus'), 'Point'))),
        P.map((q, i) => h('div', { class: 'pt-row' }, vecRow(() => j.collider.points[i], String(i + 1), ['0', '1'], [0, 0], step),
          h('button', { class: 'icon-btn', title: 'Remove point', disabled: P.length <= min, onclick: () => setPts((np) => np.splice(i, 1)) }, icon('minus')))),
        cs === 'polygon' && h('p', { class: 'desc' }, 'Corners go around the outline. Dents are fine: they\'re split into pieces automatically.'),
        cs === 'edge' && h('p', { class: 'desc' }, 'A path things stand on. It has no inside, so keep it under the ground or along walls.'));
    };
    const sizeFields = fitted ? h('p', { class: 'desc' }, 'Fits the object\'s shape. Drag the handles or tap Set Size to change it.')
      : round_ ? C('collider.r', { label: 'Radius', type: 'number', def: threeD ? 0.5 : 20, step })
        : threeD && (cs === 'capsule' || cs === 'cylinder') ? [C('collider.r', { label: 'Radius', type: 'number', def: 0.5, step }), C('collider.h', { label: 'Height', type: 'number', def: cs === 'capsule' ? 2 : 1, step })]
          : pointy ? pointsEditor()
            : vecRow(() => T().collider, 'Size', threeD ? ['w', 'h', 'd'] : ['w', 'h'], [1, 1, 1], step);
    box.append(comp(info[1], [
      C('collider.trigger', { label: 'Is Trigger (detect, don\'t block)', type: 'bool', def: false, structure: true }),
      h('label', { class: 'row inline' }, h('span', {}, 'Show all colliders in the Scene'), h('input', { type: 'checkbox', checked: showColliders, onchange: (ev) => toggleColliders(ev.target.checked) })),
      sizeFields,
      vecRow(() => T().collider, 'Offset', threeD ? ['ox', 'oy', 'oz'] : ['ox', 'oy'], [0, 0, 0], step),
      h('div', { class: 'btns' },
        !pointy && h('button', { class: 'btn', onclick: () => { const f = fitCollider(j, cs); Object.assign(j.collider, f); changed({ inspector: true }); pushHistory(); } }, icon('frame'), fitted ? 'Set Size' : 'Fit to Shape'),
        h('button', { class: 'btn', onclick: (ev) => popMenu(ev.currentTarget, [{ cap: 'Collider shape' }, ...COLLIDER_TYPES[threeD ? '3d' : '2d'].map(([k, l, ic]) => ({ icon: ic, label: l.replace(/ Collider( 2D)?$/, ''), fn: () => { j.collider = { ...fitCollider(j, k), ...(j.collider.trigger ? { trigger: true } : {}), ...(j.collider.ox ? { ox: j.collider.ox } : {}), ...(j.collider.oy ? { oy: j.collider.oy } : {}) }; changed({ structure: true }); pushHistory(); } }))]) }, icon(info[2]), 'Shape')),
      editColliderBtn(),
      h('div', { class: 'row side' }, h('label', {}, 'Material'), h('select', { onchange: (e) => { const m = MATERIALS[e.target.value]; if (m) { j.collider.bounce = m.bounce; j.collider.friction = m.friction; changed({ inspector: true }); pushHistory(); } } },
        h('option', { value: '' }, materialOf({ bounce: j.collider.bounce || 0, friction: j.collider.friction || 0, drag: 0 })), Object.keys(MATERIALS).map((k) => h('option', { value: k }, k)))),
      !j.body && C('collider.layer', { label: 'Physics layer', type: 'select', options: layerNames().map((n, i) => [String(i), n]), def: '0' }),
      !j.body && C('collider.oneWay', { label: 'One-way platform (jump up through)', type: 'bool', def: false }),
      !j.body && h('p', { class: 'desc' }, 'On its own it\'s solid but never moves. Add a Rigidbody to make it fall and get pushed.'),
    ], { icon: info[2], key: 'collider', desc: info[3], summary: pointy ? `${(j.collider.points || []).length} points` : fitted ? 'Fits the shape' : round_ ? `r ${j.collider.r}` : threeD && j.collider.r ? `r ${j.collider.r} · h ${j.collider.h}` : `${j.collider.w ?? '–'} × ${j.collider.h ?? '–'}`,
      menu: removeMenu(() => { delete j.collider; changed({ structure: true }); }, 'collider') }));
  }
  if (j.body && !j.ui) {
    const shp = j.body.shape || 'auto', dyn = j.body.type === 'dynamic', g = +project.gravity || 0;
    box.append(comp(threeD ? 'Rigidbody' : 'Rigidbody 2D', [
      C('body.type', { label: 'Body Type', type: 'select', options: [['dynamic', 'Dynamic (falls, gets pushed)'], ['kinematic', 'Kinematic (moved by code)'], ['static', 'Static (never moves)']], def: 'dynamic', structure: true }),
      dyn && !g && (+j.body.gravityScale || 1) && h('div', { class: 'obox warn' }, 'Gravity is off in this level, so it won\'t fall. ',
        h('button', { class: 'btn', style: 'margin-top:8px;width:100%', onclick: () => { project.gravity = threeD ? -25 : 1600; changed({ inspector: true }); pushHistory(); toast('Gravity on (level settings › Physics). Objects with Gravity Scale 0 stay put.'); } }, icon('download'), 'Turn on gravity')),
      dyn && [
        C('body.mass', { label: 'Mass', type: 'number', def: 1, step: 0.5 }),
        C('body.gravityScale', { label: 'Gravity Scale', type: 'number', def: 1, step: 0.1 }),
        C('body.drag', { label: 'Linear Drag (air)', type: 'number', def: 0, step: 0.1 }),
        C('body.bounce', { label: 'Bounciness', type: 'number', def: 0, step: 0.05, range: [0, 1.2] }),
        C('body.friction', { label: 'Friction', type: 'number', def: 0, step: 0.1 }),
      ],
      h('div', { class: 'row side' }, h('label', {}, 'Material'), h('select', { onchange: (e) => { const m = MATERIALS[e.target.value]; if (m) { Object.assign(j.body, m); changed({ inspector: true }); pushHistory(); } } },
        h('option', { value: '' }, materialOf(j.body)), Object.keys(MATERIALS).map((k) => h('option', { value: k }, k)))),
      dyn && h('div', { class: 'row' }, h('label', {}, 'Freeze Position'), h('div', { class: 'pair' }, (threeD ? ['X', 'Y', 'Z'] : ['X', 'Y']).map((a) =>
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!j.body['lock' + a], onchange: (e) => { if (e.target.checked) j.body['lock' + a] = true; else delete j.body['lock' + a]; changed(); } }), a)))),
      dyn && vecRow(() => T().body, 'Start Velocity', threeD ? ['vx', 'vy', 'vz'] : ['vx', 'vy'], [0, 0, 0], threeD ? 0.5 : 10),
      dyn && [C('body.maxSpeed', { label: 'Max Speed (0 = none)', type: 'number', def: 0, step: threeD ? 1 : 50 }), C('body.maxFall', { label: 'Max Fall Speed (0 = none)', type: 'number', def: 0, step: threeD ? 1 : 50 })],
      dyn && C('body.ccd', { label: 'Collision Detection', type: 'select', options: [['', 'Discrete'], ['1', 'Continuous (fast objects)']], def: '' }),
      h('div', { class: 'row' }, h('label', {}, 'Layer'), h('select', { onchange: (e) => { setLayerOf(j, e.target.value); changed({ inspector: true }); pushHistory(); } }, layerNames().map((n, i) => h('option', { value: String(i), selected: i === layerOf(j) }, n)))),
      C('body.ignore', { label: 'Pass through tags', type: 'text', def: '', suggest: 'tags' }),
      !dyn && C('body.oneWay', { label: 'One-way platform (jump up through)', type: 'bool', def: false }),
      ...(j.collider ? [] : [ // no collider component: the body fits the visible shape (older projects can size it here)
        h('div', { class: 'obox info' }, 'No collider: it uses its shape. Add a collider to control the exact shape.',
          h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { j.collider = { ...fitCollider(j, threeD ? 'box' : 'box'), ...(j.body.sensor ? { trigger: true } : {}) }; for (const k of ['shape', 'w', 'h', 'd', 'r', 'ox', 'oy', 'oz', 'sensor']) delete j.body[k]; changed({ structure: true }); pushHistory(); } }, icon('plus'), threeD ? 'Add Box Collider' : 'Add Box Collider 2D'))),
        C('body.sensor', { label: 'Is Trigger', type: 'bool', def: false }),
        shp !== 'auto' && C('body.shape', { label: 'Collider', type: 'select', options: [['auto', 'Fit to shape'], ['box', 'Box'], [threeD ? 'sphere' : 'circle', threeD ? 'Sphere' : 'Circle']], def: 'auto', structure: true }),
        shp === 'box' && [C('body.w', { label: 'Size X', type: 'number', def: 1 }), C('body.h', { label: 'Size Y', type: 'number', def: 1 }), threeD && C('body.d', { label: 'Size Z', type: 'number', def: 1 })],
        (shp === 'circle' || shp === 'sphere') && C('body.r', { label: 'Radius', type: 'number', def: 10 }),
        editColliderBtn()]),
    ], { icon: 'body', key: 'body', desc: 'Makes it move with physics: gravity, pushes, bounces.',
      menu: removeMenu(() => { delete j.body; changed({ structure: true }); }, 'body') }));
  }

  (j.behaviors || []).forEach((b, i) => {
    const def = Behaviors[b.type];
    const menu = [
      { icon: 'copy', label: 'Copy Component', fn: () => { compClipboard = { kind: 'behavior', data: clone(b) }; toast('Component copied'); } },
      compClipboard?.kind === 'behavior' && compClipboard.data.type === b.type && compClipboard.data !== b && { icon: 'paste', label: 'Paste Values', fn: () => { j.behaviors[i] = { ...clone(compClipboard.data), ...(b.enabled === false ? { enabled: false } : {}) }; changed({ structure: true }); pushHistory(); toast('Values pasted'); } },
      { icon: 'text', label: 'Copy as Text', fn: () => navigator.clipboard?.writeText(JSON.stringify(b, null, 1)).then(() => toast('Copied as text'), () => {}) },
      { icon: 'trash', label: 'Remove Component', fn: () => { j.behaviors.splice(i, 1); changed({ structure: true }); } },
      i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { j.behaviors.splice(i - 1, 0, j.behaviors.splice(i, 1)[0]); changed({ structure: true }); } },
      i < j.behaviors.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { j.behaviors.splice(i + 1, 0, j.behaviors.splice(i, 1)[0]); changed({ structure: true }); } },
      def && { icon: 'rotate', label: 'Reset', fn: () => { j.behaviors[i] = defaultBehavior(b.type, threeD); changed({ structure: true }); } },
      def && { icon: 'help', label: 'Docs', fn: () => openDocs('ref/component/' + b.type) },
    ].filter(Boolean);
    if (!def) { box.append(comp(b.type, [h('p', { class: 'desc' }, 'Unknown component')], { menu })); return; }
    const summary = def.params.filter((p) => !p.group && !p.advanced && ['number', 'select', 'text'].includes(p.type || 'text') && shown({ ...p, def: paramDefault(p, threeD) }, b, threeD)).slice(0, 2)
      .map((p) => { const v = b[p.key] ?? paramDefault(p, threeD); const t = String(v ?? ''); return t === '' ? null : `${String(p.label || p.key).replace(/\s*\(.*\)$/, '').split(' ').slice(0, 2).join(' ').toLowerCase()} ${t.length > 14 ? t.slice(0, 13) + '…' : t}`; }).filter(Boolean).join(' · ');
    box.append(comp(def.label, behaviorBody(def, b, i, j, threeD, C), {
      icon: BEH_META[b.type]?.[1] || 'bolt', key: 'b' + i + b.type, desc: def.description, menu, summary,
      enabled: b.enabled, onToggle: (on) => { if (on) delete b.enabled; else b.enabled = false; changed(); },
    }));
  });

  if (quickRow) box.append(quickRow);
  box.append(h('div', { class: 'add-comp', style: 'flex-direction:column;align-items:center;gap:10px' },
    h('button', { class: 'btn wide', onclick: () => openAddComponent() }, icon('plus'), 'Add Component'),
    compClipboard && h('button', { class: 'btn wide', onclick: () => pasteComponent(j) }, icon('paste'), `Paste ${compClipboard.kind === 'behavior' ? Behaviors[compClipboard.data.type]?.label || 'Component' : compClipboard.kind}`)));
  box.append(h('div', { class: 'btns', style: 'padding:0 8px 24px' },
    h('button', { class: 'btn', onclick: () => duplicateEntity(j.id) }, icon('copy'), 'Duplicate'),
    h('button', { class: 'btn', onclick: () => deleteEntity(j.id) }, icon('trash'), 'Delete')));
  if (inspCat !== 'all') for (const el of box.querySelectorAll('.comp')) if (el.dataset.cat !== inspCat && el.dataset.key !== 'transform') el.style.display = 'none';
  if (inspQuery) applyInspSearch(box);
  if (onlyChanged) applyOnlyChanged(box);
  if (freshSel && foldAllPref) foldAll(box, true);
  syncFoldBtn(box);
  compJump(box);
  box.scrollTop = scroll;
}
/** A row of chips, one per component (or Game Settings section), that stays at the top of the Inspector: tap one to jump there. */
function compJump(box) {
  const comps = [...box.querySelectorAll(':scope > .comp')].filter((c) => c.style.display !== 'none');
  if (comps.length < 4) return;
  const chips = comps.map((c) => {
    const t = c.querySelector('.comp-h .t')?.firstChild?.textContent?.trim() || c.dataset.key, ic = c.querySelector('.comp-h svg.ci')?.cloneNode(true);
    const b = h('button', { type: 'button', class: 'cj', onclick: () => {
      if (c.classList.contains('closed')) { c.classList.remove('closed'); closedComps.delete(c.dataset.key); syncFoldBtn(box); }
      const bar = box.querySelector('.comp-jump'), top = c.offsetTop - (bar?.offsetHeight || 0) - 6;
      box.scrollTo({ top, behavior: EP.reduceMotion ? 'auto' : 'smooth' }); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); buzz(5);
    } }, ic, h('span', {}, t));
    b._comp = c; return b;
  });
  const bar = h('div', { class: 'comp-jump' }, chips);
  (box.querySelector('.comp-tools') || comps[0]).after(bar);
  const mark = () => { // the chip of the component at the top lights up
    const y = box.scrollTop + bar.offsetHeight + 12; let cur = chips[0];
    for (const b of chips) if (b._comp.offsetTop <= y) cur = b;
    for (const b of chips) b.classList.toggle('on', b === cur);
    if (cur && !cur.classList.contains('seen')) { chips.forEach((b) => b.classList.remove('seen')); cur.classList.add('seen'); const l = cur.offsetLeft - bar.clientWidth / 2 + cur.offsetWidth / 2; bar.scrollTo({ left: Math.max(0, l), behavior: 'auto' }); }
  };
  box.onscroll = mark; mark();
}
let onlyChanged = false;
/** Odin-style "show only overrides": keep rows changed from their defaults, open their groups, hide the rest. */
function applyOnlyChanged(box) {
  let any = false;
  for (const c of box.querySelectorAll('.comp')) {
    if (c.dataset.key === 'transform') continue;
    const mods = c.querySelectorAll('.row.mod');
    for (const el of c.querySelectorAll('.comp-b > *, .og-b > *')) if (!el.classList.contains('og') && !el.classList.contains('mod')) el.style.display = 'none';
    for (const g of c.querySelectorAll('.og')) { const has = !!g.querySelector('.row.mod'); g.style.display = has ? '' : 'none'; if (has) g.classList.add('open'); }
    if (!mods.length) c.style.display = 'none'; else { c.classList.remove('closed'); any = true; }
  }
  if (!any) box.querySelector('.comp-tools')?.after(h('p', { class: 'empty' }, 'Nothing here is changed from its defaults.'));
}

// ---- physics materials: presets for bounce / friction / drag ----
const MATERIALS = {
  Default: { bounce: 0, friction: 0, drag: 0 }, Ice: { bounce: 0.05, friction: 0, drag: 0 }, Rubber: { bounce: 0.8, friction: 0.3, drag: 0 },
  Wood: { bounce: 0.1, friction: 0.6, drag: 0 }, Metal: { bounce: 0.2, friction: 0.2, drag: 0 }, Sticky: { bounce: 0, friction: 3, drag: 0 },
  Bouncy: { bounce: 1, friction: 0, drag: 0 }, Feather: { bounce: 0, friction: 0.2, drag: 3 },
};
function materialOf(b) {
  const hit = Object.entries(MATERIALS).find(([, m]) => (b.bounce || 0) === m.bounce && (b.friction || 0) === m.friction && (b.drag || 0) === m.drag);
  return hit ? hit[0] + ' ✓' : 'Custom';
}

// ---- UI styling: fonts, themes, copy / paste style ----
const GOOGLE_FONTS = ['Press Start 2P', 'Bangers', 'Luckiest Guy', 'Fredoka', 'Lilita One', 'Bungee', 'Orbitron', 'Russo One', 'Silkscreen', 'Pixelify Sans', 'VT323',
  'Permanent Marker', 'Creepster', 'Cinzel', 'Baloo 2', 'Titan One', 'Chewy', 'Audiowide', 'Black Ops One', 'Patrick Hand'];
const fontOptions = (cur) => {
  const list = [...FONTS, ...(root?.settings?.fonts || []).map((n) => [googleFont(n), n])];
  if (cur && !list.some(([v]) => v === cur)) list.push([cur, String(cur).split(',')[0].replace(/"/g, '')]);
  return list;
};
/** Pick a font: the built-in ones, or any Google Font (added to the game and loaded). */
function openFontPicker(onPick) {
  loadFonts(GOOGLE_FONTS);
  const row = (fam, name, add) => h('button', { class: 'font-row', style: `font-family:${fam === 'theme' ? themeOf(root.settings).font : fam}`, onclick: () => {
    if (add) { root.settings.fonts = [...new Set([...(root.settings.fonts || []), name])]; loadFonts([name]); }
    closeLayer(); onPick(fam);
  } }, name, h('small', {}, add ? 'Google Font' : fam === 'theme' ? 'follows the UI theme' : 'built in'));
  const inp = h('input', { type: 'text', placeholder: 'Any Google Font name, e.g. Roboto Slab' });
  openDialog('Fonts', [
    h('p', { class: 'desc' }, 'Google Fonts download the first time a player opens the game (they need the internet once).'),
    h('div', { class: 'row' }, inp, h('button', { class: 'btn primary', onclick: () => { const n = inp.value.trim(); if (!n) return; root.settings.fonts = [...new Set([...(root.settings.fonts || []), n])]; loadFonts([n]); closeLayer(); onPick(googleFont(n)); } }, 'Add')),
    h('div', { class: 'font-list' }, FONTS.map(([v, n]) => row(v, n, false)), GOOGLE_FONTS.map((n) => row(googleFont(n), n, true))),
  ]);
}
const STYLE_KEYS = { shape: ['fill', 'fill2', 'gradDir', 'stroke', 'lineWidth', 'dash', 'radius', 'glow', 'shadow', 'shadowBlur', 'shadowY'], text: ['size', 'color', 'color2', 'font', 'weight', 'italic', 'case', 'spacing', 'lineHeight', 'outline', 'outlineWidth', 'shadow', 'shadowColor'], sprite: ['radius', 'slice', 'sliceScale'] };
let styleClipboard = null;
function styleOf(j) { const out = {}; for (const [k, keys] of Object.entries(STYLE_KEYS)) if (j[k]) out[k] = Object.fromEntries(keys.filter((q) => j[k][q] !== undefined).map((q) => [q, j[k][q]])); return clone(out); }
function pasteStyle(j, st) { for (const [k, v] of Object.entries(st)) if (j[k]) Object.assign(j[k], clone(v)); }
const mixHex = (a, b, t) => { const p = (h) => parseInt(String(h).replace('#', '').slice(0, 6), 16), A = p(a), B = p(b); if (!Number.isFinite(A) || !Number.isFinite(B)) return a; const c = (sh) => Math.round((A >> sh & 255) * (1 - t) + (B >> sh & 255) * t); return '#' + [16, 8, 0].map((sh) => c(sh).toString(16).padStart(2, '0')).join(''); }; // a colour t of the way from a to b
const isLight = (hex) => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0; return ((n >> 16 & 255) * 0.299 + (n >> 8 & 255) * 0.587 + (n & 255) * 0.114) > 160; };
/** Restyle UI elements with the game's theme: font, text colours, panel and button colours, corner radius. */
function applyTheme(list) {
  const T = themeOf(root.settings), btn = (e) => (e.behaviors || []).some((b) => ['button', 'navItem', 'touchButton'].includes(b.type));
  const byId = new Map(list.map((e) => [e.id, e])), onButton = (e) => btn(e) || (e.parent && btn(byId.get(e.parent) || ent(e.parent) || {}));
  for (const e of list) {
    for (const b of e.behaviors || []) if (b.type === 'uiBottomNav') { b.activeColor = T.accent; b.barColor = T.panel; b.idleColor = mixHex(T.text, T.panel, 0.4); }
    for (const b of e.behaviors || []) if (b.type === 'uiAppBar') { b.accent = T.accent; b.bg = T.panel; b.text = T.text; }
    for (const b of e.behaviors || []) if (b.type === 'uiSideBar') { b.accent = T.accent; b.bg = T.panel; b.text = T.text; }
    if (e.text) { e.text.font = 'theme'; e.text.color = onButton(e) ? (isLight(T.accent) ? '#1b1b1b' : '#ffffff') : T.text; delete e.text.color2; }
    if (e.shape && e.shape.type !== 'emoji' && e.shape.fill) {
      e.shape.fill = btn(e) ? T.accent : T.panel; delete e.shape.fill2;
      if (e.shape.type === 'rect' || e.shape.type === 'capsule') e.shape.radius = T.radius;
      if (e.shape.stroke) e.shape.stroke = T.text;
    }
    if (e.bar) e.bar.radius = Math.min(T.radius, (e.bar.h || 16) / 2);
  }
}

// ---- scene settings (shown when the scene root is selected) ----
/** Collapse / expand every component; the choice is remembered, so the next object opens the same way. */
let foldAllPref = store.get('pocket.editor.foldAll', '0') === '1';
function foldAll(box, shut) {
  for (const el of box.querySelectorAll('.comp')) { el.classList.toggle('closed', shut); if (shut) closedComps.add(el.dataset.key); else closedComps.delete(el.dataset.key); }
}
function foldAllBtn(box) {
  return h('button', { class: 'ct fold-all', title: 'Collapse or expand all components', onclick: () => {
    const comps = [...box.querySelectorAll('.comp')], allShut = comps.length && comps.every((el) => el.classList.contains('closed'));
    foldAll(box, !allShut); foldAllPref = !allShut; store.set('pocket.editor.foldAll', foldAllPref ? '1' : '0'); syncFoldBtn(box); buzz(6);
  } }, icon('collapse'), h('span', {}, 'Collapse all'));
}
function syncFoldBtn(box) {
  const b = box.querySelector('.fold-all'); if (!b) return;
  const comps = [...box.querySelectorAll('.comp')], allShut = comps.length && comps.every((el) => el.classList.contains('closed'));
  b.querySelector('span').textContent = allShut ? 'Expand all' : 'Collapse all'; b.classList.toggle('on', !!allShut);
}
/** Lighting Presets: through the level's light object (Directional Light / Global Light 2D) when it has one. */
function applyLightingPreset(name) {
  const pr = LIGHT_PRESETS[name]; if (!pr) return;
  const threeD = is3D(), lo = project.entities.find((e) => (threeD ? e.sun : e.globalLight));
  if (threeD) {
    const P = pr.d3; if (lo) Object.assign(lo.sun, { color: P.color, intensity: P.intensity, ambient: P.ambient }); else Object.assign(project.light ||= {}, { color: P.color, intensity: P.intensity, ambient: P.ambient });
    Object.assign(project.light ||= {}, { sky: P.sky, ground: P.ground }); project.background = P.bg;
  } else if (lo) Object.assign(lo.globalLight, { brightness: pr.d2[0], color: pr.d2[1] });
  else Object.assign(project.light ||= {}, { darkness: 1 - pr.d2[0], ambientColor: pr.d2[1] });
  changed({ structure: true }); pushHistory(); renderInspector(); toast(`Lighting: ${name}`);
}
function renderSceneSettings(box) {
  const P = () => project, C = (path, spec) => control(P, path, spec), threeD = is3D();
  const game = levelList()[0], GS = (path, spec) => control(() => levelList()[0], path, spec); // game-wide settings live on the first level
  box.append(h('div', { class: 'insp-head' }, h('div', { class: 'big-ico' }, icon('scene')),
    h('span'), h('input', { type: 'text', value: game.name, placeholder: 'Game name', oninput: (e) => { game.name = e.target.value; changed(); renderHierarchy(); } }),
    h('div', { class: 'sub' }, `${threeD ? '3D' : '2D'} game · Pocket Engine ${VERSION}`)));
  box.append(h('div', { class: 'comp-tools few' }, h('div', { class: 'cf' }, h('span', { class: 'cf-n' }, 'Game Settings')), foldAllBtn(box)));
  box.append(comp('Level', [
    C('levelName', { label: 'Level Name', type: 'text', def: levelName(project, levelIdx) }),
    h('p', { class: 'desc' }, `This is level ${levelIdx + 1} of ${levelList().length}. Reaching a Goal moves on to the next level; score and lives carry over.`),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => addLevel(false) }, icon('plus'), 'New Level'), h('button', { class: 'btn', onclick: openLevelMenu }, icon('layers'), 'All Levels')),
  ], { icon: 'layers', key: 's-level' }));
  box.append(comp('Environment', [
    C('background', { label: 'Background', type: 'color' }),
    h('p', { class: 'desc' }, threeD ? 'Gravity is in Physics below: about -25 is normal.' : 'Gravity is in Physics below: 0 for top-down games, about 1600 for platformers.'),
    !threeD && vecRow(() => (project.view ||= { width: 400, height: 700 }), 'Screen Size', ['width', 'height'], [400, 700], 10),
  ], { icon: 'sun', key: 's-env' }));
  box.append(comp('Orientation', [
    orientationRow(),
    h('p', { class: 'desc' }, threeD ? 'Lock the game to portrait or landscape. 3D games fill the screen either way.' : 'Lock the game to portrait (tall) or landscape (wide). Switching turns the 2D screen size around too, so the camera shows the right shape.'),
    orientationOf() !== 'any' && C('settings.wrongWay', { label: 'If the phone is held the other way', type: 'select', options: [['ask', 'Ask the player to turn it'], ['letterbox', 'Play in a box (bars at the edges)']], def: 'ask' }),
    orientationOf() !== 'any' && C('settings.fullscreen', { label: 'Go full screen and lock the rotation on first tap', type: 'bool', def: false }),
  ], { icon: 'phone', key: 's-orient' }));
  const POST_PRESETS = [['none', 'None', {}], ['glow', 'Neon glow', { bloom: 0.8, bloomRadius: 16, bloomThreshold: 50, saturation: 125, vignette: 0.35 }],
    ['warm', 'Warm sunset', { tint: '#ff9a3c', tintAmount: 0.25, saturation: 115, contrast: 105, vignette: 0.3 }], ['cold', 'Cold', { tint: '#4fa3ff', tintAmount: 0.2, saturation: 85, contrast: 108 }],
    ['night', 'Night', { brightness: 70, saturation: 70, tint: '#2a3d8f', tintAmount: 0.35, vignette: 0.6 }], ['retro', 'Retro', { contrast: 120, saturation: 140, vignette: 0.5, bloom: 0.35 }],
    ['dream', 'Dreamy', { bloom: 0.9, bloomRadius: 28, bloomThreshold: 20, brightness: 108, saturation: 90 }], ['bw', 'Black & white', { saturation: 0, contrast: 115, vignette: 0.4 }]];
  box.append(comp('Post Processing', [
    h('p', { class: 'desc' }, 'Effects over the whole game view (your HUD stays crisp). Start from a look, then tune it.'),
    h('div', { class: 'post-presets' }, POST_PRESETS.map(([k, l, v]) => h('button', { class: 'btn', onclick: () => { project.post = clone(v); changed({ inspector: true }); pushHistory(); toast(k === 'none' ? 'Effects off' : `${l} look`); } }, l))),
    C('post.bloom', { label: 'Bloom (glow)', type: 'number', def: 0, step: 0.05, range: [0, 1] }),
    C('post.bloomRadius', { label: 'Glow size', type: 'number', def: 12, step: 2, range: [2, 40] }),
    C('post.bloomThreshold', { label: 'Glow only bright parts', type: 'number', def: 60, step: 5, range: [0, 100] }),
    C('post.vignette', { label: 'Vignette (dark edges)', type: 'number', def: 0, step: 0.05, range: [0, 1] }),
    C('post.brightness', { label: 'Brightness %', type: 'number', def: 100, step: 5, range: [20, 200] }),
    C('post.contrast', { label: 'Contrast %', type: 'number', def: 100, step: 5, range: [20, 200] }),
    C('post.saturation', { label: 'Saturation %', type: 'number', def: 100, step: 5, range: [0, 250] }),
    C('post.hue', { label: 'Hue shift °', type: 'number', def: 0, step: 10, range: [-180, 180] }),
    C('post.tint', { label: 'Tint colour', type: 'color', def: '#ff8800' }),
    C('post.tintAmount', { label: 'Tint amount', type: 'number', def: 0, step: 0.05, range: [0, 1] }),
  ], { icon: 'sun', key: 's-post' }));
  box.append(comp('Collision Layers', [layerMatrixEditor(), h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: openTagsLayers }, icon('key'), 'Tags & Layers…'))], { icon: 'grid', key: 's-layers' }));
  box.append(comp('Physics', [
    C('gravity', { label: threeD ? 'Gravity Y (down is −)' : 'Gravity Y (down is +)', type: 'number', def: threeD ? -25 : 0, step: threeD ? 1 : 50 }),
    C('gravityX', { label: 'Gravity X (sideways)', type: 'number', def: 0, step: threeD ? 1 : 50 }),
    threeD && C('gravityZ', { label: 'Gravity Z', type: 'number', def: 0, step: 1 }),
    h('p', { class: 'desc' }, 'Fast objects are checked in small steps so they never pass through walls. Rotated 2D boxes collide at their angle. Use Rigidbody → Material for ice, rubber or sticky surfaces, and a Force Zone for wind, water or magnets.'),
  ], { icon: 'body', key: 's-phys' }));
  box.append(comp('Inventory', [inventorySettings()], { icon: 'key', key: 's-inv' }));
  box.append(comp('Items', [itemsEditor()], { icon: 'gem', key: 's-items' }));
  box.append(comp('Recipes', [recipesEditor()], { icon: 'list', key: 's-recipes' }));
  box.append(comp('Quests', [questsEditor()], { icon: 'flag', key: 's-quests' }));
  box.append(comp('Dialogues', [dialoguesEditor()], { icon: 'sign', key: 's-dialogues' }));
  box.append(comp('Lighting Presets', [
    h('p', { class: 'desc' }, 'One tap sets the whole mood. Change it while playing with the Lighting Preset node (with a fade).'),
    h('div', { class: 'lp-grid' }, Object.entries(LIGHT_PRESETS).map(([name, pr]) => h('button', { class: 'lp-btn', style: `--a:${threeD ? pr.d3.bg : pr.d2[1]};--b:${threeD ? pr.d3.color : mixHex('#000000', '#ffffff', pr.d2[0])}`, onclick: () => applyLightingPreset(name) }, h('i'), name))),
  ], { icon: 'sun', key: 's-lightpre' }));
  const lightObj = project.entities.find((e) => (threeD ? e.sun : e.globalLight));
  if (lightObj) box.append(h('div', { class: 'obox info', style: 'margin:16px 14px 0' }, `Lighting comes from “${lightObj.name}”. `, h('button', { class: 'btn', style: 'margin-top:8px;width:100%', onclick: () => select(lightObj.id) }, icon('sun'), `Select ${lightObj.name}`)));
  else box.append(comp('Lighting', threeD ? [
    C('light.color', { label: 'Sun Color', type: 'color', def: '#ffffff' }),
    C('light.intensity', { label: 'Sun Brightness', type: 'number', def: 1, step: 0.1 }),
    C('light.sunAngle', { label: 'Sun Direction (°)', type: 'number', def: 20, step: 15 }),
    C('light.sunHeight', { label: 'Sun Height (°)', type: 'number', def: 60, step: 5 }),
    C('light.ambient', { label: 'Ambient Light', type: 'number', def: 0.45, step: 0.05 }),
    C('light.sky', { label: 'Sky Tint', type: 'color', optional: true }),
    C('light.ground', { label: 'Ground Tint', type: 'color', optional: true }),
    C('light.shadows', { label: 'Shadows', type: 'bool', def: true }),
    h('p', { class: 'desc' }, 'Add Light objects (Create → Light) for lamps, torches and glowing gems. Low ambient + low sun = night.'),
  ] : [
    C('light.darkness', { label: 'Darkness (0 = off, 1 = black)', type: 'number', def: 0, step: 0.1 }),
    C('light.ambientColor', { label: 'Darkness Color', type: 'color', def: '#0a0a1e' }),
    h('p', { class: 'desc' }, 'Turn up Darkness for caves and night levels, then add Light objects or a Light component to the player (torch).'),
  ], { icon: 'bulb', key: 's-light' }));
  box.append(comp('Saving', [
    h('p', { class: 'desc' }, 'Save games keep variables, the level, where things are and what was collected. Save with a Save Point, a Button (Do → save game) or the Save Game node; load with Load Game. Amount = slot number.'),
    C('settings.loadOnStart', { label: 'Continue from save slot 1 on start', type: 'bool', def: false }),
    C('settings.saveProgress', { label: 'Auto-save variables (clicker games)', type: 'bool', def: false }),
    fold('s-save:files', 'Save files (Easy Save)', [
      h('p', { class: 'desc' }, 'Named save files hold any value under a key: numbers, text, lists, dictionaries, whole objects. Use the Save Files nodes, or add Auto Save (remembers an object) and Save Manager (remembers game variables) components.'),
      GS('settings.saveEncrypt', { label: 'Encrypt save files', type: 'bool', def: false, structure: true, infoText: game.settings?.saveEncrypt ? 'Players can\'t read or change their saves; a changed file is refused. Changing the password makes old saves unreadable.' : null }),
      game.settings?.saveEncrypt && GS('settings.savePassword', { label: 'Password', type: 'text', def: '', placeholder: 'pocket' }),
      GS('settings.saveBackup', { label: 'Keep the previous save as a backup', type: 'bool', def: false }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => openSaveData() }, icon('folder'), 'Save Data…')),
    ], !!(game.settings?.saveEncrypt || game.settings?.saveBackup)),
  ], { icon: 'save', key: 's-save' }));
  box.append(comp('App', [
    C('settings.app', { label: 'This is an app, not a game', type: 'bool', def: false, structure: true }),
    h('p', { class: 'desc' }, 'Apps open straight on their first page: no title screen, pause, sound or share buttons. Build them from pages, an App Bar or Bottom Nav, Data Lists and Record Forms (Add → UI & Menus → App).'),
    h('p', { class: 'desc' }, 'Apps can hold games: add one as new levels, and a Play Game button opens it. The game keeps its own title, pause and end screens, with a “Back to app” button.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: openAddGameDialog }, icon('gamepad'), 'Add a game…')),
    C('settings.recordPlays', { label: 'Record every game played in collection (blank = don’t)', type: 'text', def: '', infoText: 'Each play adds a record with game, score, result (won / lost / quit) and date. Make the collection in Data below.' }),
  ], { icon: 'phone', key: 's-app' }));
  box.append(comp('Theme & Dark Mode', [
    C('settings.appTheme', { label: 'Look', type: 'select', options: [['light', 'Light'], ['dark', 'Dark'], ['follow the phone', 'Follow the phone (light or dark)']], def: 'light' }),
    C('settings.appAccent', { label: 'Accent colour (blank = blue)', type: 'color', def: '', optional: true }),
    h('p', { class: 'desc' }, 'Colours written as theme colours (the @ button next to any colour: Background, Cards, Text, Accent…) follow light and dark mode. The variable darkMode (1 / 0) switches it while playing: bind a Toggle to it for a Dark mode switch.'),
    h('div', { class: 'tok-prev' }, ['light', 'dark'].map((m) => h('div', { class: 'tp ' + m, style: `background:${APP_PALETTES[m].bg};color:${APP_PALETTES[m].text}` }, h('b', {}, m === 'light' ? 'Light' : 'Dark'),
      h('div', { style: `background:${APP_PALETTES[m].card};border-radius:10px;padding:8px 10px;margin-top:6px` }, 'A card', h('small', { style: `display:block;color:${APP_PALETTES[m].sub}` }, 'Second line')),
      h('span', { style: `display:inline-block;margin-top:8px;padding:4px 12px;border-radius:99px;background:${project.settings?.appAccent || APP_PALETTES[m].accent};color:${APP_PALETTES[m].onAccent}` }, 'Accent')))),
  ], { icon: 'sun', key: 's-theme' }));
  box.append(comp('Motion', [
    C('settings.motionSpeed', { label: 'Animation speed (1 = normal, 2 = twice as fast)', type: 'number', def: 1, step: 0.1, range: [0.25, 3] }),
    C('settings.reduceMotion', { label: 'Reduce motion', type: 'select', options: [['follow the phone', 'Follow the phone (Reduce Motion setting)'], ['always', 'Always (quick fades only)'], ['never', 'Never']], def: 'follow the phone' }),
    C('settings.pageAnim', { label: 'Page transitions', type: 'select', def: 'as each page says', options: [['as each page says', 'As each page says (its Show If)'], ['push (iOS, follows navigation)', 'Push (iPhone style)'], ['shared axis (follows navigation)', 'Shared axis (Android style)'], ['zoom (follows navigation)', 'Zoom'], ['card stack (follows navigation)', 'Card stack (sheets)'], ['reveal from tap (follows navigation)', 'Reveal from where you tap'], ['wipe (follows navigation)', 'Wipe'], ['slide (follows navigation)', 'Slide'], ['fade through', 'Fade through'], ['fade', 'Fade'], ['none', 'None (instant)']],
      infoText: 'One transition for every page (everything with Show If on the page variable): try them in ▶ Play. Back always plays it in reverse.' }),
    h('div', { class: 'anim-demo' }, [['push', 'push (iOS, follows navigation)', 'Push'], ['axis', 'shared axis (follows navigation)', 'Shared axis'], ['zoom', 'zoom (follows navigation)', 'Zoom'], ['stack', 'card stack (follows navigation)', 'Card stack'], ['reveal', 'reveal from tap (follows navigation)', 'Reveal'], ['wipe', 'wipe (follows navigation)', 'Wipe']]
      .map(([k, v, l]) => h('button', { type: 'button', class: 'ad ad-' + k + ((project.settings?.pageAnim || '') === v ? ' on' : ''), title: l, onclick: () => { (project.settings ||= {}).pageAnim = v; changed(); renderInspector(); toast(l + ' for every page: press ▶ Play and open a page'); } }, h('span', { class: 'ad-ph' }, h('i'), h('b')), h('small', {}, l)))),
    h('p', { class: 'desc' }, 'Page transitions, staggered lists, button springs, ripples, switches and sheets all follow these. People who turn on Reduce Motion on their phone get quick fades instead of movement.'),
  ], { icon: 'star', key: 's-motion' }));
  box.append(comp('Data', [dataEditor()], { icon: 'list', key: 's-data' }));
  box.append(comp('Start Screen', [
    levelIdx > 0 && h('p', { class: 'desc' }, 'The start screen only shows before level 1.'),
    C('settings.title', { label: 'Title', type: 'text', def: '' }),
    C('settings.subtitle', { label: 'Subtitle', type: 'text', def: '' }),
    C('settings.customScreens', { label: 'Custom Screens (my own UI)', type: 'bool', def: false }),
    h('p', { class: 'desc' }, 'Hides the built-in title, pause and game-over screens. Add UI with "Show when" set to Title / Game over, and Buttons that start or restart the game (Project → UI has ready-made menus).'),
    h('p', { class: 'desc' }, 'Leave Title empty to start the game right away.'),
  ], { icon: 'hud', key: 's-start' }));
  box.append(comp('Touch Controls', [
    C('settings.joystick', { label: 'Joystick', type: 'bool', def: false }),
    C('settings.jumpButton', { label: 'Jump Button', type: 'bool', def: false }),
    C('settings.actionButton', { label: 'Fire Button', type: 'bool', def: false }),
    C('settings.pauseButton', { label: 'Pause Button', type: 'bool', def: true }),
    C('settings.muteButton', { label: 'Mute Button', type: 'bool', def: true }),
    C('settings.controls', { label: 'Movement Controls', type: 'select', options: [['auto', 'Joystick (when turned on)'], ['dpad', 'D-pad (4 arrows)'], ['arrows', 'Left / right arrows'], ['joystick', 'Joystick']], def: 'auto' }),
    C('settings.controlsOpacity', { label: 'Controls Opacity (0.2–1)', type: 'number', def: 1, step: 0.1 }),
    C('settings.playerSettings', { label: 'Player Settings (⚙)', type: 'select', options: [['pause', 'On the pause screen'], ['corner', 'Pause screen + a ⚙ in the corner'], ['off', 'Off']], def: 'pause', infoText: 'Lets players pick left-handed controls, sensitivity, control size, sound and vibration. It only shows what your game uses. A Button (Do → open settings) or the Open Settings node opens it too.' }),
    C('settings.controlSize', { label: 'Control Size', type: 'select', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], def: 'medium' }),
    C('settings.jumpLabel', { label: 'Jump Button Text', type: 'text', def: 'JUMP' }),
    C('settings.actionLabel', { label: 'Fire Button Text', type: 'text', def: 'FIRE' }),
    fold('s-joy', 'Joystick', [
      C('settings.joystickMode', { label: 'Where it appears', type: 'select', options: [['floating', 'Where you touch (follows your thumb)'], ['static', 'Where you touch (stays put)'], ['fixed', 'Fixed in the corner']], def: 'floating' }),
      C('settings.joystickSide', { label: 'Side', type: 'select', options: [['left', 'Left (buttons on right)'], ['right', 'Right (left-handed)']], def: 'left' }),
      C('settings.joystickZone', { label: 'Touch area', type: 'select', options: [['half', 'Half the screen'], ['third', 'A third of the screen'], ['full', 'The whole screen']], def: 'half' }),
      C('settings.joystickDirections', { label: 'Directions', type: 'select', options: [['all', 'Any direction'], ['8', '8 directions'], ['4', '4 directions'], ['horizontal', 'Left / right only'], ['vertical', 'Up / down only']], def: 'all' }),
      C('settings.joystickResponse', { label: 'Response', type: 'select', options: [['analog', 'Push further = faster'], ['curve', 'Gentle near the middle'], ['full', 'Always full speed']], def: 'analog' }),
      C('settings.joystickDeadZone', { label: 'Dead zone (0–0.6)', type: 'number', def: 0.12, step: 0.02, range: [0, 0.6], infoText: 'How far you push before it moves. Bigger stops tiny accidental moves.' }),
      C('settings.joystickSize', { label: 'Size', type: 'number', def: 1, step: 0.1, range: [0.5, 2] }),
      C('settings.joystickKnob', { label: 'Knob size (0.2–0.8)', type: 'number', def: 0.42, step: 0.02, range: [0.2, 0.8] }),
      C('settings.joystickStyle', { label: 'Look', type: 'select', options: [['classic', 'Classic (filled)'], ['ring', 'Ring'], ['dot', 'Just the knob'], ['arrows', 'With arrows']], def: 'classic' }),
      C('settings.joystickColor', { label: 'Colour', type: 'color', def: '#ffffff' }),
      C('settings.joystickVisible', { label: 'Show', type: 'select', options: [['touch', 'Only while touching'], ['always', 'Always (resting in the corner)']], def: 'touch' }),
      C('settings.joystickIdleOpacity', { label: 'Resting opacity', type: 'number', def: 0.6, step: 0.1, range: [0, 1] }),
      C('settings.joystickHaptics', { label: 'Vibration', type: 'select', options: [['tap', 'Tap when it appears'], ['edge', 'Tap at the edge too'], ['off', 'Off']], def: 'tap' }),
      C('settings.joystickHint', { label: '"Touch & drag here" hint', type: 'bool', def: true }),
    ], ['joystickMode', 'joystickZone', 'joystickDirections', 'joystickResponse', 'joystickDeadZone', 'joystickSize', 'joystickStyle', 'joystickColor', 'joystickVisible'].some((k) => project.settings?.[k] != null && project.settings[k] !== '')),
    h('p', { class: 'desc' }, 'On a keyboard: arrows/WASD move, Space jumps, E fires.'),
  ], { icon: 'gamepad', key: 's-touch' }));
  box.append(comp('Notifications', [
    h('p', { class: 'desc' }, 'Pop-ups for achievements, rewards and messages. Each type has its own look. Show one with the message notify:TYPE Title|text|icon (e.g. notify:reward Coins!|+50), the Notify node, a trigger\'s "Show notification", or a Button set to "show notification".'),
    h('div', { class: 'nt-list' }, allNotifyTypes().map((t) => h('div', { class: 'nt-row' },
      h('span', { class: 't-sw', style: `background:${t.bg2 ? `linear-gradient(135deg,${t.bg},${t.bg2})` : t.bg};border-color:${t.accent}` }, t.icon && !/^[a-z]/.test(t.icon) ? t.icon : ''),
      h('span', { class: 'nt-name' }, t.name, h('small', {}, `${t.look} · ${t.position}${customNotify(t.name) ? ' · edited' : ''}`)),
      h('button', { class: 'btn', onclick: () => testNotify(t.name) }, icon('play'), 'Test'),
      h('button', { class: 'btn', onclick: () => openNotifyEditor(t.name) }, icon('edit'), 'Edit')))),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { const name = uniqueNotifyName('custom'); gameSettings().notifyTypes = [...(gameSettings().notifyTypes || []), { name, look: 'card', icon: '🔔' }]; changed({ inspector: true }); pushHistory(); openNotifyEditor(name); } }, icon('plus'), 'New type'),
      h('button', { class: 'btn', onclick: () => ['default', 'achievement', 'reward', 'warning'].forEach((n, i) => setTimeout(() => testNotify(n), i * 450)) }, icon('play'), 'Test a few')),
  ], { icon: 'bell', key: 's-notify', summary: `${allNotifyTypes().length} types` }));
  const G = (path, spec) => control(() => game, 'settings.phoneNotify.' + path, spec), PN = game.settings?.phoneNotify || {};
  box.append(comp('Phone Notifications', [
    h('p', { class: 'desc' }, 'Real notifications in the phone\'s notification area, like "Your energy is full!". Send them from the Phone Notification node or a trigger\'s "Phone notification". Tapping one opens the game and sends the message notification opened (and notification opened ID).'),
    h('div', { class: 'obox info' }, 'Full support (scheduled, arrives while the game is closed) is in iOS / Android apps made with Build Settings › App stores. On a website (menu › Build Web App) they appear while the game is open; on iPhone once it is added to the Home Screen.'),
    G('ask', { label: 'Ask the player', type: 'select', options: [['first tap', 'On their first tap'], ['when asked', 'When a node asks'], ['never', 'Only when one is sent']], def: 'when asked', infoText: 'Phones need the player to allow notifications once. Asking at a good moment (after a win, from a "Remind me" button) gets more yeses.' }),
    G('reminders', { label: 'Come-back reminders', type: 'code', def: '', infoText: 'One per line: hours | Title | text. Counted from when the player leaves the game, and replaced each time they come back. E.g. 24 | We miss you! | Your daily chest is ready' }),
    G('dailyTitle', { label: 'Daily reminder title', type: 'text', def: '' }),
    PN.dailyTitle && [
      G('dailyText', { label: 'Daily reminder text', type: 'text', def: '' }),
      G('dailyTime', { label: 'Time (HH:MM)', type: 'text', def: '19:00' }),
    ],
    h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { const ok = await engine.phone.send({ id: 'editor-test', title: game.name || 'My game', text: 'This is a test notification 🔔', when: 'now' }); toast(ok ? 'Sent. Check your notifications' : engine.phone.kind === 'none' ? 'This browser has no notifications' : 'Notifications are blocked for this site'); } }, icon('bell'), 'Test on this device'),
      h('button', { class: 'btn', onclick: async () => { const ok = await engine.phone.send({ id: 'editor-test', title: game.name || 'My game', text: 'Sent 10 seconds later', when: 'in', seconds: 10 }); toast(ok ? 'Coming in 10 seconds (keep this tab open)' : 'Notifications are blocked for this site'); } }, icon('play'), 'In 10 seconds')),
  ], { icon: 'bell', key: 's-phone', summary: PN.reminders || PN.dailyTitle ? 'reminders on' : '' }));
  const used = usedPermissions();
  box.append(comp('Permissions', [
    h('p', { class: 'desc' }, 'Things only the player can allow: location, camera, microphone, motion sensors and keeping saves safe. Ask with the Ask Permission node (allowed / not allowed) or a trigger\'s "Ask permission", or here on the first tap. A card explains why first; its Allow button then brings up the phone\'s own question, so players aren\'t surprised.'),
    used.length ? h('div', { class: 'obox info' }, 'This game uses: ' + used.join(', ') + '. App exports (Build Settings › App stores) include what iOS and Android need for these.') : null,
    ...['location', 'camera', 'microphone', 'motion', 'storage'].map((k) => {
      const PK = (path, spec) => control(() => game, `settings.permissions.${k}.${path}`, spec), cur = game.settings?.permissions?.[k] || {};
      return h('div', { class: 'perm-row' },
        h('div', { class: 'perm-h' }, h('span', { class: 'perm-ic' }, PERMISSIONS[k].icon), h('b', {}, k[0].toUpperCase() + k.slice(1)),
          h('button', { class: 'btn', onclick: async () => { const r = await engine.perms.ask(k, { title: cur.title, why: cur.why, soft: cur.soft !== false }); toast(r === 'granted' ? 'Allowed on this device' : r === 'unsupported' ? 'Not available in this browser' : 'Not allowed'); } }, icon('play'), 'Test')),
        PK('ask', { label: 'Ask', type: 'select', options: [['when asked', 'When a node asks'], ['first tap', 'On the first tap']], def: 'when asked' }),
        PK('why', { label: 'Why', type: 'text', def: '', placeholder: PERMISSIONS[k].why, infoText: 'Shown on the card, and by iOS when it asks (app builds).' }),
        PK('soft', { label: 'Explain first (recommended)', type: 'bool', def: true }));
    }),
    h('p', { class: 'desc' }, 'Notifications are in Phone Notifications above. Nodes that use these: Location, Distance To Place, On Location Changed, Microphone Loudness, Permission Status, Has Permission, On Permission Answered.'),
  ], { icon: 'key', key: 's-perms', summary: used.length ? used.join(', ') : '' }));
  box.append(comp('Screen & Safe Area', [
    h('p', { class: 'desc' }, 'Phones come in many sizes, and many have a notch, rounded corners or a home bar. UI anchored to corners and edges stays inside the safe area, and grows or shrinks to suit the screen.'),
    C('settings.safeArea', { label: 'Safe area', type: 'select', options: [['device', 'Keep UI clear of notches & home bar'], ['off', 'Use the whole screen']], def: 'device' }),
    C('settings.safeMargin', { label: 'Extra edge space', type: 'number', def: 0, range: [0, 48], step: 2, infoText: 'Space between the UI and every screen edge, on top of the safe area.' }),
    C('settings.uiScale', { label: 'UI size', type: 'select', options: [['scale with screen', 'Scale with screen size'], ['constant', 'Same size on every screen']], def: 'scale with screen', structure: true }),
    (project.settings?.uiScale || 'scale with screen') === 'scale with screen' && C('settings.uiMatch', { label: 'Match width ↔ height', type: 'number', def: 0.5, range: [0, 1], step: 0.1, infoText: `Your design size is ${project.view?.width || 400} × ${project.view?.height || 700}. 0 = scale by width, 1 = by height, 0.5 = a mix (good for portrait and landscape).` }),
    C('settings.uiScaleFactor', { label: 'UI size multiplier', type: 'number', def: 1, range: [0.5, 2], step: 0.05 }),
    control(() => game, 'settings.uiOverlap', { label: 'Keep UI from overlapping', type: 'select', options: [['bars', 'Stay clear of nav bars'], ['push apart', 'Nav bars + push UI apart'], ['off', 'Off (place everything yourself)']], def: 'bars', structure: true, infoText: 'Nav bars (Bottom Nav, App Bar, Icon Rail) hold their edge of the screen and everything else is laid out in the rest. "Push apart" also moves UI elements that overlap each other (up or down, away from their anchor).' }),
    h('p', { class: 'desc' }, 'Check it in the UI editor: the Phone button shows a notch, Dynamic Island or home bar.'),
  ], { icon: 'hud', key: 's-safe' }));
  const R = (path, spec) => control(() => root, path, spec), T = themeOf(root.settings), custom = root.settings.theme || {};
  const setTheme = (name) => { root.settings.uiTheme = name; delete root.settings.theme; changed({ inspector: true }); pushHistory(); };
  box.append(comp('UI Theme', [
    h('p', { class: 'desc' }, 'One look for the whole game: the title, pause and game-over screens, touch controls, messages, and any text set to "Theme font". Tap Apply to restyle the UI you already made.'),
    h('div', { class: 'theme-grid' }, Object.entries(UI_THEMES).map(([name, th]) => h('button', {
      class: 'theme-card' + ((root.settings.uiTheme || 'Default') === name ? ' on' : ''), style: `background:${th.overlay};color:${th.text};font-family:${th.font};border-radius:${Math.min(th.radius, 14)}px`, onclick: () => setTheme(name),
    }, h('b', {}, name), h('span', { class: 'chipline' }, h('i', { style: `background:${th.accent}` }), h('i', { style: `background:${th.panel}` }), h('i', { style: `background:${th.good}` }), h('i', { style: `background:${th.bad}` }))))),
    h('div', { class: 'row' }, h('label', {}, 'Font'), h('button', { class: 'btn', style: `font-family:${T.font};flex:1`, onclick: () => openFontPicker((f) => { (root.settings.theme ||= {}).font = f === 'theme' ? UI_THEMES[root.settings.uiTheme || 'Default'].font : f; changed({ inspector: true }); pushHistory(); }) }, fontOptions(T.font).find(([v]) => v === T.font)?.[1] || 'Custom', ' ▾')),
    [['text', 'Text'], ['accent', 'Accent (score, buttons)'], ['panel', 'Panels'], ['overlay', 'Screen dimming'], ['button', 'Touch controls'], ['good', 'Win colour'], ['bad', 'Lose colour']].map(([k, label]) =>
      R(`settings.theme.${k}`, { label: label + (custom[k] ? ' •' : ''), type: 'color', def: T[k] })),
    R('settings.theme.radius', { label: 'Corner roundness', type: 'number', def: T.radius, range: [0, 30], step: 1 }),
    h('div', { class: 'btns' },
      h('button', { class: 'btn primary', onclick: () => { const ui = levelList().flatMap((lv) => lv.entities.filter((e) => e.ui)); applyTheme(ui); changed({ structure: true }); pushHistory(); toast(`Theme applied to ${ui.length} UI elements`); } }, icon('brush'), 'Apply to my UI'),
      Object.keys(custom).length ? h('button', { class: 'btn', onclick: () => setTheme(root.settings.uiTheme || 'Default') }, icon('undo'), 'Reset colours') : null),
  ], { icon: 'brush', key: 's-theme' }));
  // ---- online services: each game brings its own PlayFab Title ID and Photon App ID ----
  const pf = root.settings.playfab || {}, ph = root.settings.photon || {};
  const testOnline = async (what) => {
    engine.scene.settings.playfab = clone(root.settings.playfab || {}); engine.scene.settings.photon = clone(root.settings.photon || {});
    const O = engine.online;
    if (what === 'playfab') { toast('Signing in to PlayFab…'); const ok = await O.pfLogin(); toast(ok ? `PlayFab works ✓ player ${O.pf.id}` : `PlayFab: ${engine.scene.vars.onlineError || 'could not sign in'}`); return; }
    toast('Connecting to Photon…'); O.disconnect(); await O.connect();
    const t0 = Date.now(); while (Date.now() - t0 < 8000 && !['lobby', 'offline'].includes(O.state)) await new Promise((r) => setTimeout(r, 200));
    toast(O.state === 'lobby' ? `Photon works ✓ connected to region ${ph.region || 'eu'}` : `Photon: ${engine.scene.vars.onlineError || 'could not connect'}`); O.disconnect();
  };
  box.append(comp('Online (PlayFab & Photon)', [
    h('p', { class: 'desc' }, 'Add online features with your own free accounts. PlayFab: player accounts, leaderboards, cloud saves and remote config. Photon: real-time multiplayer rooms. Players need the internet for these; the rest of the game works offline.'),
    h('h5', { class: 'sub-head' }, 'PlayFab'),
    R('settings.playfab.titleId', { label: 'Title ID', type: 'text', def: '', infoText: 'From developer.playfab.com: create a title, then copy its Title ID (like 1A2B3).' }),
    R('settings.playfab.autoLogin', { label: 'Sign players in when the game starts', type: 'bool', def: true }),
    pf.titleId && h('p', { class: 'desc' }, 'For leaderboards, turn on Title settings › API Features › "Allow client to post player statistics" in PlayFab.'),
    pf.titleId && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => testOnline('playfab') }, icon('check'), 'Test PlayFab')),
    h('h5', { class: 'sub-head' }, 'Photon (multiplayer)'),
    R('settings.photon.appId', { label: 'App ID (Realtime)', type: 'text', def: '', infoText: 'From dashboard.photonengine.com: create a "Realtime" app (free for 20 players at once) and copy its App ID.' }),
    ph.appId && [
      R('settings.photon.region', { label: 'Region', type: 'select', options: PHOTON_REGIONS.map((r) => [r, { eu: 'Europe', us: 'USA East', usw: 'USA West', asia: 'Asia', jp: 'Japan', kr: 'South Korea', in: 'India', au: 'Australia', sa: 'South America', cae: 'Canada East', za: 'South Africa', uae: 'UAE', tr: 'Turkey' }[r] || r]), def: 'eu' }),
      R('settings.photon.maxPlayers', { label: 'Players per room', type: 'number', def: 4, range: [2, 16], step: 1 }),
      R('settings.photon.autoJoin', { label: 'Join a room when the game starts', type: 'bool', def: false, infoText: 'Otherwise use a "join online room" button or the Join Room node.' }),
      R('settings.photon.room', { label: 'Room name (blank = any open room)', type: 'text', def: '' }),
      R('settings.photon.appVersion', { label: 'Game version (players only meet the same version)', type: 'text', def: '1.0' }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => testOnline('photon') }, icon('check'), 'Test Photon')),
    ],
    h('p', { class: 'desc' }, 'Then: put Network Sync on your player, add an Online Leaderboard or Multiplayer Lobby from Project › UI › Online, or use the Online nodes. Variables you can show in text: {netState}, {netPlayers}, {netRoom}, {pfName}, {pfRank}, {onlineError}.'),
  ], { icon: 'globe', key: 's-online' }));
  box.append(comp('Mobile', [
    h('p', { class: 'desc' }, 'Portrait or landscape: see Orientation above.'),
    orientationOf() === 'any' && C('settings.fullscreen', { label: 'Go Fullscreen on First Tap', type: 'bool', def: false }),
    C('settings.shareButton', { label: 'Share Score Button', type: 'bool', def: true }),
    C('settings.edgeSwipeBack', { label: 'Swipe from the left edge goes Back', type: 'bool', def: true, infoText: 'In menus with pages: a swipe in from the left edge goes back, like an iPhone app. The phone\'s back gesture and Esc always do.' }),
    h('p', { class: 'desc' }, 'The screen stays awake while playing. Tilt controls: set a Move component\'s Control to "tilt".'),
  ], { icon: 'gamepad', key: 's-mobile' }));
  box.append(comp('Rules', [
    C('settings.winScore', { label: 'Win at Score', type: 'number', def: 0, step: 10 }),
    C('settings.timeLimit', { label: 'Time Limit (sec)', type: 'number', def: 0, step: 5 }),
    C('settings.turnBased', { label: 'Turn-Based', type: 'bool', def: false }),
    h('p', { class: 'desc' }, 'Turn-based: each player move (Grid Move, Turn Button, Board Cell) ends your turn, then enemies act. Show it with {turnText} and {turn}.'),
    C('settings.turnDelay', { label: 'Enemy Turn Delay (sec)', type: 'number', def: 0.3, step: 0.1 }),
    C('settings.messageTop', { label: 'Show Messages at the Top', type: 'bool', def: false }),
    h('p', { class: 'desc' }, 'With a time limit, show the countdown in a text with {time}. 0 = no limit.'),
    h('div', { class: 'row inline' }, h('label', {}, 'Save Best Score'), h('div', {}, h('input', { type: 'checkbox', checked: !!project.settings.saveBest,
      onchange: (e) => { project.settings.saveBest = e.target.checked ? slug(levelList()[0].name) + '-' + projectId.slice(-4) : ''; changed(); } }))),
    C('vars', { label: 'Variables', type: 'json' }),
    h('p', { class: 'desc' }, 'Starting values, e.g. {"score": 0, "lives": 3}. Hazards that "damage" use lives.'),
  ], { icon: 'trophy', key: 's-rules' }));
  if (threeD) {
    box.append(comp('Camera & Fog', [
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => {
        const c = engine.scene.camera, rv = (v) => ({ x: round(v.x), y: round(v.y), z: round(v.z) });
        project.camera = { ...(project.camera || {}), position: rv(c.position), target: rv(c.target) };
        changed(); toast('Game camera aligned with Scene view');
      } }, icon('camera'), 'Align Game Camera with View')),
      h('p', { class: 'desc' }, 'Used when no object has a Camera component (Create → Camera).'),
      C('camera.fov', { label: 'Field of View', type: 'number', def: 60 }),
      C('fog.near', { label: 'Fog Start', type: 'number', def: 30 }),
      C('fog.far', { label: 'Fog End', type: 'number', def: 120 }),
    ], { icon: 'camera', key: 's-cam' }));
  }
  box.append(h('div', { class: 'btns', style: 'padding:12px 8px 24px' },
    h('button', { class: 'btn primary', onclick: play }, icon('play'), 'Play'),
    h('button', { class: 'btn', onclick: openBuildSettings }, icon('download'), 'Build…')));
}

// ============================================================================
// Components (Add Component list + Project panel)
// ============================================================================
/** Odin-style [Button]s shown at the top of a component. */
const BEH_BUTTONS = {
  tween: [{ label: 'Preview', icon: 'play', fn: (j, i, b) => previewBehavior(j, b) }],
  tweenSequence: [{ label: 'Preview', icon: 'play', primary: true, fn: (j, i, b) => previewBehavior(j, b, Math.min(8, seqLength(b))) }],
  flipbook: [{ label: 'Preview', icon: 'play', fn: (j, i, b) => previewBehavior(j, b, 3) }],
  animator: [{ label: 'Open Animation Timeline', icon: 'clock', primary: true, fn: (j, i) => openAnim(j, i) }],
  camera: [{ label: 'Look Through Camera', icon: 'camera', fn: (j, i, b) => lookThrough(j, b) }],
  particles: [{ label: 'Preview', icon: 'play', fn: (j, i, b) => previewBehavior(j, b, 2.5) }],
};
let previewing = null;
/** Run a Tween / Sprite Animation on the Scene view for a few seconds, then put everything back. */
function previewBehavior(j, b, seconds) {
  cancelPreview();
  const s = engine.scene, e = s.byId(j.id), def = Behaviors[b.type]; if (!e || !def) return;
  const params = {}; for (const p of def.params) params[p.key] = b[p.key] ?? paramDefault(p, is3D() && !j.ui);
  const inst = def.create(params, e);
  if (inst.play) inst.play(e, s); else inst.start?.(e, s);
  const dur = seconds || Math.min(6, (+b.delay || 0) + (+b.duration || 1) * (+b.loops < 0 ? 2 : (+b.loops || 0) + 1) + 0.3);
  let last = performance.now(); const t0 = last;
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!inst.play) inst.update?.(e, dt, s);
    for (const tw of s.tweens) tw.update(dt);
    for (let k = s.particles.length - 1; k >= 0; k--) { const q = s.particles[k]; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.g ?? 0) * dt; if (q.shrink) q.size *= 1 - dt * 1.2; if ((q.life -= q.decay * dt) <= 0) s.particles.splice(k, 1); }
    if (now - t0 < dur * 1000 && previewing) previewing.raf = requestAnimationFrame(step); else cancelPreview();
  };
  previewing = { raf: requestAnimationFrame(step) };
  toast('Previewing…');
}
function cancelPreview() { if (!previewing) return; cancelAnimationFrame(previewing.raf); previewing = null; engine.scene.tweens = []; engine.scene.particles = []; rebuild(); }
function lookThrough(j, b) {
  if (is3D() && !j.ui) { orbit.target = { x: j.x || 0, y: j.y || 0, z: j.z || 0 }; orbit.dist = Math.max(4, Math.hypot(b.ox || 0, b.oy || 0, b.oz || 0)); }
  else cam2d = { x: j.x || 0, y: j.y || 0, zoom: (+b.zoom || 1) * 0.85 };
  applyCamera(); toast('Scene view moved to the camera');
}
/** Animator clips summary + button. */
function clipsCard(target, path) {
  const clips = getPath(target(), path) || [];
  const i = +path.split('.')[1];
  return h('div', { class: 'row full graph-card' },
    h('div', { class: 'gc-sum' }, icon('clock'), h('div', {}, h('b', {}, `${clips.length} clip${clips.length === 1 ? '' : 's'}`),
      h('small', {}, clips.map((c) => `${c.name} (${c.length}s, ${Object.keys(c.tracks || {}).length} tracks)`).join(' · ') || 'No clips yet'))),
    h('button', { class: 'btn primary gc-open', onclick: () => openAnim(target(), i) }, icon('clock'), 'Open Animation Timeline'));
}
/** Summary card for State Machine / Triggers, with a button to the full-screen Logic editor. */
function logicCard(target, path, kind) {
  const v = getPath(target(), path) || (kind === 'fsm' ? { states: [] } : []);
  const sum = kind === 'fsm' ? `${(v.states || []).length} states · ${(v.states || []).reduce((n, s) => n + (s.transitions || []).length, 0) + (v.any || []).length} transitions`
    : `${v.length} trigger${v.length === 1 ? '' : 's'}`;
  const sub = kind === 'fsm' ? (v.states || []).map((s) => s.name + (s.id === v.start ? ' ★' : '')).join(' → ') : v.map((t) => logicSay(LOGIC_EVENTS, t.event)).join(' · ');
  return h('div', { class: 'row full graph-card' },
    h('div', { class: 'gc-sum' }, icon(kind === 'fsm' ? 'nodes' : 'bolt'), h('div', {}, h('b', {}, sum), h('small', {}, sub || 'Empty: open the editor to add some'))),
    h('button', { class: 'btn primary gc-open', onclick: () => editLogic(target, path, kind) }, icon(kind === 'fsm' ? 'nodes' : 'bolt'), kind === 'fsm' ? 'Open State Machine' : 'Open Triggers'));
}
function editLogic(target, path, kind) {
  const e = target(), id = e.id, T = () => ent(id) || e;
  const back = () => ed.close();
  const ed = openLogic({
    kind, data: getPath(e, path), title: e.name, h, popMenu, toast, buzz, suggest: suggestions,
    custom: { actions: (root.customActions ||= []), conditions: (root.customConditions ||= []) }, onCustomChange: () => { requestRebuild(); saveSoon(); },
    onChange: (d) => { setPath(T(), path, d); requestRebuild(); saveSoon(); },
    onClose: () => { dropBack(back); pushHistory(); renderInspector(); },
  });
  pushBack(back);
}
/** Add a State Machine or Triggers component to the selected object (or a new Logic object) and open it. */
function addLogic(kind) {
  let j = ent(selectedId);
  if (!j || j.template) j = addEntity({ name: kind === 'fsm' ? 'Brain' : 'Logic', ...(is3D() ? { y: 0.5 } : {}) });
  const b = defaultBehavior(kind, is3D() && !j.ui);
  (j.behaviors ||= []).push(b);
  selectedId = j.id; changed({ structure: true }); pushHistory();
  editLogic(() => ent(j.id) || {}, `behaviors.${j.behaviors.length - 1}.${kind === 'fsm' ? 'fsm' : 'triggers'}`, kind);
}

let timeline = null;
function openAnim(j, i) {
  if (timeline) return;
  if (i == null || j.behaviors?.[i]?.type !== 'animator') { (j.behaviors ||= []).push(defaultBehavior('animator', is3D() && !j.ui)); i = j.behaviors.length - 1; j.behaviors[i].clips = [{ name: 'Clip 1', length: 1, loop: 'loop', tracks: {} }]; j.behaviors[i].autoplay = 'Clip 1'; }
  const id = j.id, b = j.behaviors[i];
  setSheet('half');
  document.body.classList.add('animating');
  const back = () => timeline?.close();
  timeline = openTimeline({
    get: () => ent(id), behavior: b, threeD: is3D() && !j.ui, h, popMenu, toast, buzz, parent: $('#app'),
    onPose: () => { requestRebuild(); syncTransformInputs(); },
    onChange: () => { saveSoon(); },
    onClose: () => { timeline = null; document.body.classList.remove('animating'); dropBack(back); changed({ structure: true }); pushHistory(); },
  });
  pushBack(back);
}

function defaultBehavior(type, threeD) {
  const b = { type };
  for (const p of Behaviors[type].params) b[p.key] = clone(paramDefault(p, threeD));
  return b;
}
/** Every component that can be added to the object j. */
/** A collider sized to the object's visible shape (unscaled units, like the body settings). */
function fitCollider(j, shape) {
  const live = engine.scene.byId(j.id), ex = live && visualExtents(live), sx = Math.abs(j.sx ?? 1) || 1, sy = Math.abs(j.sy ?? 1) || 1, sz = Math.abs(j.sz ?? 1) || 1;
  if (!ex || ex.hx === Infinity || (!ex.sphere && !ex.hx)) return shape === 'polygon' || shape === 'edge' ? { shape, points: colliderPreset(shape, shape === 'edge' ? 'flat' : 'box', 40, 40) } : { shape };
  const r1 = (v) => round(v, is3D() ? 2 : 0), rad = ex.sphere ? ex.r : Math.max(ex.hx, ex.hy);
  const hx = (ex.sphere ? ex.r : ex.hx) / sx, hy = (ex.sphere ? ex.r : ex.hy) / sy, hz = (ex.sphere ? ex.r : ex.hz === Infinity ? 0.5 : ex.hz) / sz;
  if (shape === 'circle' || shape === 'sphere') return { shape, r: r1(rad / Math.max(sx, sy)) };
  if (shape === 'capsule' && is3D()) return { shape, r: r1(Math.max(hx, hz)), h: r1(Math.max(hy, hx) * 2) };
  if (shape === 'cylinder') return { shape, r: r1(Math.max(hx, hz)), h: r1(hy * 2) };
  if (shape === 'polygon') return { shape, points: shapeOutline(j) || colliderPreset('polygon', 'box', hx, hy) };
  if (shape === 'edge') return { shape, points: colliderPreset('edge', 'flat', hx, hy) };
  return { shape, w: r1(hx * 2), h: r1(hy * 2), ...(is3D() && shape === 'box' ? { d: r1(hz * 2) } : {}) };
}
/** An object's size from what it draws, ignoring its current collider (falls back to the collider when it draws nothing). */
function visualExtents(live) {
  const bare = Object.assign(Object.create(Object.getPrototypeOf(live)), live, { body: null }), ex = bare.extents();
  return hasVisual(live) && ex && (ex.sphere ? ex.r : ex.hx) && Number.isFinite(ex.sphere ? ex.r : ex.hx) ? ex : live.extents();
}
/** Ready-made polygon / edge outlines, hx × hy half size, centred on the object. */
const POLY_PRESETS = [['box', 'Box'], ['triangle', 'Triangle'], ['slopeR', 'Slope ◢'], ['slopeL', 'Slope ◣'], ['diamond', 'Diamond'], ['pentagon', 'Pentagon'], ['hexagon', 'Hexagon'], ['octagon', 'Octagon'], ['star', 'Star'], ['ramp', 'Ramp (rounded)']];
const EDGE_PRESETS = [['flat', 'Flat line'], ['slopeUp', 'Slope up'], ['slopeDown', 'Slope down'], ['hill', 'Hill'], ['valley', 'Valley'], ['bowl', 'Bowl ◡'], ['zigzag', 'Zigzag'], ['steps', 'Steps'], ['wave', 'Wave']];
function colliderPreset(shape, kind, hx, hy) {
  const R = (v) => Math.round(v * 100) / 100, P = (list) => list.map(([x, y]) => [R(x), R(y)]), ring = (n, a0 = -Math.PI / 2) => P(Array.from({ length: n }, (_, i) => [Math.cos(a0 + i / n * Math.PI * 2) * hx, Math.sin(a0 + i / n * Math.PI * 2) * hy]));
  if (shape === 'edge') {
    const curve = (f, n = 9) => P(Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [-hx + t * hx * 2, f(t)]; }));
    switch (kind) {
      case 'slopeUp': return P([[-hx, hy], [hx, -hy]]);
      case 'slopeDown': return P([[-hx, -hy], [hx, hy]]);
      case 'hill': return curve((t) => hy - Math.sin(t * Math.PI) * hy * 2);
      case 'valley': return P([[-hx, -hy], [0, hy], [hx, -hy]]);
      case 'bowl': return curve((t) => -hy + Math.sin(t * Math.PI) * hy * 2);
      case 'zigzag': return P([[-hx, hy], [-hx / 2, -hy], [0, hy], [hx / 2, -hy], [hx, hy]]);
      case 'steps': return P([[-hx, hy], [-hx / 3, hy], [-hx / 3, 0], [hx / 3, 0], [hx / 3, -hy], [hx, -hy]]);
      case 'wave': return curve((t) => Math.sin(t * Math.PI * 4) * hy, 17);
      default: return P([[-hx, -hy], [hx, -hy]]); // the top of the object
    }
  }
  switch (kind) {
    case 'triangle': return P([[0, -hy], [hx, hy], [-hx, hy]]);
    case 'slopeR': return P([[-hx, hy], [hx, hy], [hx, -hy]]);
    case 'slopeL': return P([[-hx, hy], [hx, hy], [-hx, -hy]]);
    case 'diamond': return P([[0, -hy], [hx, 0], [0, hy], [-hx, 0]]);
    case 'pentagon': return ring(5);
    case 'hexagon': return ring(6);
    case 'octagon': return ring(8, -Math.PI / 2 + Math.PI / 8);
    case 'star': return P(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? 0.4 : 1; return [Math.cos(a) * hx * k, Math.sin(a) * hy * k]; }));
    case 'ramp': return P([[-hx, hy], ...Array.from({ length: 7 }, (_, i) => { const t = (i + 1) / 8 * Math.PI / 2; return [-hx + Math.sin(t) * hx * 2, hy - (1 - Math.cos(t)) * hy * 2]; }), [hx, -hy], [hx, hy]]);
    default: return P([[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]);
  }
}
/** The object's drawn shape as polygon points (unscaled), when it has a matching outline. */
function shapeOutline(j) {
  const s = j.shape; if (!s || is3D()) return null;
  const hx = (s.w || 40) / 2, hy = (s.h || 40) / 2;
  if (s.type === 'polygon' && s.points?.length >= 3) return s.points.map(([x, y]) => [x, y]);
  if (s.type === 'triangle') return colliderPreset('polygon', 'triangle', hx, hy);
  if (s.type === 'diamond' || s.type === 'star' || s.type === 'pentagon' || s.type === 'hexagon' || s.type === 'octagon') {
    if (s.type === 'octagon') return Array.from({ length: 8 }, (_, i) => { const a = -Math.PI / 2 + i / 8 * Math.PI * 2; return [Math.round(Math.cos(a) * hx * 100) / 100, Math.round(Math.sin(a) * hy * 100) / 100]; });
    if (s.type === 'star') return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s.w * 0.2 : s.w / 2; return [Math.round(Math.cos(a) * r * 100) / 100, Math.round(Math.sin(a) * r * (s.h / s.w) * 100) / 100]; });
    return colliderPreset('polygon', s.type, hx, hy);
  }
  if (s.type === 'arrow') return [[hx, 0], [0, -hy], [0, -hy * 0.4], [-hx, -hy * 0.4], [-hx, hy * 0.4], [0, hy * 0.4], [0, hy]];
  return null;
}
/** Collider types per mode: [shape, label, icon, what it's for]. */
const COLLIDER_TYPES = {
  '2d': [['box', 'Box Collider 2D', 'square', 'A rectangle. Best for most things.'], ['circle', 'Circle Collider 2D', 'circle', 'Round: balls, coins, wheels.'], ['capsule', 'Capsule Collider 2D', 'capsule', 'A pill: great for characters (slides over bumps).'],
    ['polygon', 'Polygon Collider 2D', 'polygon', 'Any outline: triangles, slopes, stars. Edit the points.'], ['edge', 'Edge Collider 2D', 'edge', 'A line (or path) to stand on: ground, hills, slopes.']],
  '3d': [['box', 'Box Collider', 'square', 'A box. Best for most things.'], ['sphere', 'Sphere Collider', 'sphere', 'Round: balls, coins, planets.'], ['capsule', 'Capsule Collider', 'capsule', 'An upright pill: great for characters.'], ['cylinder', 'Cylinder Collider', 'cylinder', 'An upright column: pillars, barrels, towers.']],
};
const colliderInfo = (shape, threeD) => COLLIDER_TYPES[threeD ? '3d' : '2d'].find((t) => t[0] === shape) || COLLIDER_TYPES[threeD ? '3d' : '2d'][0];
function componentsFor(j) {
  const threeD = is3D() && !(j && j.ui);
  const list = [
    { cat: 'Rendering', key: 'shape', label: 'Shape Renderer', icon: 'square', desc: 'Rectangle, circle, triangle or star', ok: (e) => !threeD && !e.shape, add: (e) => { e.shape = { type: 'rect', w: 40, h: 40, fill: '#4c8bd6' }; } },
    { cat: 'Rendering', key: 'mesh', label: 'Mesh Renderer', icon: 'cube', desc: 'Cube, sphere, cylinder, cone or plane', ok: (e) => threeD && !e.mesh, add: (e) => { e.mesh = { geometry: 'box', w: 1, h: 1, d: 1, color: '#4c8bd6' }; } },
    { cat: 'Rendering', key: 'text', label: 'Text', icon: 'text', desc: 'Words and live variables like {score}', ok: (e) => !e.text, add: (e) => { e.text = { value: 'Text', size: 24, color: '#ffffff' }; } },
    { cat: 'Rendering', key: 'sprite', label: 'Image', icon: 'image', desc: 'A picture from your device', ok: (e) => !threeD && !e.sprite, add: (e) => { e.sprite = { src: '', w: 64, h: 64 }; } },
    { cat: 'Rendering', key: 'model', label: '3D Model', icon: 'cube', desc: 'Build a model out of shapes (3D modeling)', ok: (e) => threeD && !e.model && !e.ui, add: (e) => { e.model = { parts: [{ geometry: 'box', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, color: '#90caf9' }] }; } },
    { cat: 'UI', key: 'bar', label: 'Progress Bar', icon: 'hud', desc: 'Health, energy or progress shown as a bar', ok: (e) => !e.bar && (e.ui || !threeD), add: (e) => { e.bar = { var: 'hp', max: 100, w: 160, h: 16, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 8 }; } },
    { cat: 'Voxel', key: 'voxels', label: 'Voxel World', icon: 'cube', desc: 'Minecraft-style block terrain you can build on', ok: (e) => threeD && !e.voxels && !e.ui, add: (e) => { e.voxels = { size: 1, gen: { type: 'hills', w: 24, d: 24, h: 5, seed: 1, trees: true }, edits: {} }; } },
    { cat: 'UI', key: 'minimap', label: 'Minimap', icon: 'grid', desc: 'A small map of the level on screen', ok: (e) => e.ui && !e.minimap, add: (e) => { e.minimap = { w: 120, h: 120, range: is3D() ? 40 : 800, bg: 'rgba(0,0,0,0.5)', border: '#ffffff', round: false }; } },
    { cat: 'Rendering', key: 'light', label: 'Light', icon: 'bulb', desc: threeD ? 'A point light that lights up nearby objects' : 'A glow that cuts through darkness', ok: (e) => !e.light && !e.ui, add: (e) => { e.light = threeD ? { color: '#ffd9a0', intensity: 1.5, range: 8 } : { color: '#ffd9a0', intensity: 1, range: 160 }; } },
    { cat: 'Physics', key: 'body', label: threeD ? 'Rigidbody' : 'Rigidbody 2D', icon: 'body', desc: 'Falls, gets pushed and bounces (needs gravity; uses its collider)', ok: (e) => !e.ui && !e.body, add: (e) => { e.body = { type: 'dynamic' }; } },
    ...COLLIDER_TYPES[threeD ? '3d' : '2d'].map(([shape, label, ic, desc]) => ({
      cat: 'Colliders', key: 'col:' + shape, label, icon: ic, desc: desc + ' Tick Is Trigger to detect touches without blocking.', ok: (e) => !e.ui && !e.collider, add: (e) => { e.collider = fitCollider(e, shape); } })),
  ];
  for (const sc of allScripts()) list.push({ cat: 'My Scripts', key: 'sc:' + sc.id, label: sc.name, icon: 'nodes', desc: sc.here ? `Your saved Visual Script · ${sc.graph.nodes.length} nodes` : `Saved in another game · ${sc.graph.nodes.length} nodes`, ok: () => true, add: (e) => addSavedScript(e, sc) });
  for (const [type, def] of Object.entries(Behaviors)) {
    if (def.hidden) continue; // engine-internal helpers
    if (type === 'controller2d' && threeD) continue; // 2D only
    if (!threeD && (type === 'firstPerson' || type === 'thirdPerson')) continue; // 3D only
    list.push({ cat: BEH_META[type]?.[0] || 'Other', key: 'b:' + type, label: def.label, icon: BEH_META[type]?.[1] || 'bolt', desc: def.description,
      ok: (e) => (!e.ui || ['script', 'graph', 'rules', 'button', 'triggers', 'fsm', 'tween', 'tweenSequence', 'animator', 'flipbook', 'dialogue'].includes(type) || BEH_META[type]?.[0] === 'UI') && (e.ui || BEH_META[type]?.[0] !== 'UI' || ['button', 'dialogue'].includes(type)), add: (e) => { (e.behaviors ||= []).push(defaultBehavior(type, threeD)); if (type === 'move' || type === 'platformer') e.tags = [...new Set([...(e.tags || []), 'player'])]; } });
  }
  return list;
}
function addComponentTo(id, key) {
  const j = ent(id);
  if (!j) { toast('Select an object first'); return false; }
  const c = componentsFor(j).find((x) => x.key === key);
  if (!c) return false;
  if (!c.ok(j)) { toast(`${c.label} can't be added to ${j.name}`); return false; }
  c.add(j); rememberComp(key);
  if (key === 'b:platformer' && !project.gravity) project.gravity = is3D() ? -25 : 1600;
  if (key === 'b:platformer') Object.assign(project.settings, { joystick: true, jumpButton: true });
  if (key === 'b:uiSlider' && !j.bar) j.bar = { var: j.behaviors.at(-1).var || 'volume', max: 100, w: 200, h: 18, fill: '#4c8bd6', bg: 'rgba(0,0,0,0.45)', radius: 9, label: true };
  if ((key === 'b:uiToggle' || key === 'b:touchButton' || key === 'b:uiInput') && !j.shape && !j.sprite) j.shape = { type: 'rect', w: 140, h: 52, radius: 14, fill: '#3a6ea5' };
  if ((key === 'b:uiToggle' || key === 'b:uiInput' || key === 'b:uiCounter') && !j.text) j.text = { value: 'Text', size: 20, color: '#ffffff' };
  selectedId = id;
  changed({ structure: true }); pushHistory();
  toast(`Added ${c.label} to ${j.name}`);
  return true;
}

/** Unity-style Add Component: search, suggestions for this object, recently used, and category folders to browse. */
const CAT_ICON = { Rendering: 'square', Physics: 'body', Controllers: 'player', Movement: 'arrow', Gameplay: 'coin', Combat: 'enemy', AI: 'ghost', Logic: 'script', Scripting: 'script',
  Animation: 'clock', 'My Scripts': 'nodes', Colliders: 'square', Effects: 'star', Camera: 'camera', UI: 'hud', Touch: 'hand', Spawning: 'spawner', Clicker: 'hand', Saving: 'save', Audio: 'bolt', Voxel: 'cube', 'Turn-Based': 'grid', Other: 'gear' };
const recentComps = () => { try { return JSON.parse(store.get('pocket.editor.recentComps', '[]')); } catch { return []; } };
function rememberComp(key) { store.set('pocket.editor.recentComps', JSON.stringify([key, ...recentComps().filter((k) => k !== key)].slice(0, 6))); }
/** A few components that usually make sense next for this object. */
function suggestComps(j, list) {
  const has = (t) => (j.behaviors || []).some((b) => b.type === t), keys = [];
  const isPlayer = (j.tags || []).includes('player'), logic = ['triggers', 'graph', 'fsm', 'rules', 'script'].some(has);
  if (j.ui) keys.push('b:button', 'b:pressFeedback', 'b:tween', 'b:triggers', 'b:uiCounter');
  else if (has('tappable') || has('comboClicker') || has('upgrade')) keys.push('b:clickPopup', 'b:pressFeedback', 'b:comboClicker', 'b:longPress');
  else {
    if (!j.collider) keys.push('col:box');
    if (!j.body) keys.push('body');
    if (isPlayer) keys.push(...(is3D() ? ['b:thirdPerson', 'b:move'] : has('move') || has('platformer') ? [] : ['b:controller2d']), 'b:health', 'b:cameraFollow');
    else keys.push('b:collectible', 'b:hazard', 'b:patrol', 'b:health');
    if (!logic) keys.push('b:triggers');
    keys.push('b:tween');
  }
  return keys.filter((k) => !(k.startsWith('b:') && has(k.slice(2)))).map((k) => list.find((c) => c.key === k)).filter(Boolean).slice(0, 6);
}
function openAddComponent(startCat) {
  const j = ent(selectedId); if (!j) return;
  const list = componentsFor(j).filter((c) => c.ok(j));
  let cat = startCat || null;
  const body = h('div', { class: 'ac-body' });
  const search = h('input', { class: 'ac-search', type: 'search', placeholder: `Search ${list.length} components`, autocapitalize: 'off', oninput: () => draw() });
  const add = (c) => { closeLayer(); addComponentTo(j.id, c.key); };
  const item = (c, showCat) => h('button', { class: 'ac-item', onclick: () => add(c) }, h('span', { class: 'ac-ic' }, icon(c.icon)),
    h('span', {}, c.label, h('small', {}, showCat ? `${c.cat} · ${c.desc || ''}` : c.desc)));
  const chip = (c) => h('button', { class: 'ac-chip', onclick: () => add(c) }, icon(c.icon), c.label.replace(/ \(.*\)$/, ''));
  function draw() {
    const q = search.value.trim().toLowerCase();
    if (q) { // search everything, best matches first
      const score = (c) => { const l = c.label.toLowerCase(); return l.startsWith(q) ? 0 : l.includes(q) ? 1 : c.cat.toLowerCase().includes(q) ? 2 : 3; };
      const hits = list.filter((c) => (c.label + ' ' + c.cat + ' ' + (c.desc || '')).toLowerCase().includes(q)).sort((a, b) => score(a) - score(b));
      body.replaceChildren(hits.length ? h('div', { class: 'ac-list' }, hits.map((c) => item(c, true))) : h('div', { class: 'empty' }, `Nothing called “${search.value}”. Try another word, like “move” or “health”.`));
      return;
    }
    if (cat) { // inside a folder
      const items = list.filter((c) => c.cat === cat).sort((x, y) => (y.key === 'b:controller2d') - (x.key === 'b:controller2d'));
      body.replaceChildren(h('button', { class: 'ac-back', onclick: () => { cat = null; draw(); } }, icon('left'), 'All categories'),
        h('div', { class: 'ac-cat' }, cat, ` · ${items.length}`), h('div', { class: 'ac-list' }, items.map((c) => item(c))));
      return;
    }
    const cats = [...new Set(list.map((c) => c.cat))].sort((a, b) => (CAT_ORDER.indexOf(a) + 99) % 99 - (CAT_ORDER.indexOf(b) + 99) % 99);
    const recent = recentComps().map((k) => list.find((c) => c.key === k)).filter(Boolean), sugg = suggestComps(j, list);
    body.replaceChildren(
      sugg.length ? h('div', { class: 'ac-cat' }, `Suggested for ${j.name || 'this object'}`) : '', sugg.length ? h('div', { class: 'ac-chips' }, sugg.map(chip)) : '',
      recent.length ? h('div', { class: 'ac-cat' }, 'Recently used') : '', recent.length ? h('div', { class: 'ac-chips' }, recent.map(chip)) : '',
      h('div', { class: 'ac-cat' }, 'Browse'),
      h('div', { class: 'ac-folders' }, cats.map((k) => h('button', { class: 'ac-folder', onclick: () => { cat = k; draw(); body.parentElement?.scrollTo?.(0, 0); } },
        icon(CAT_ICON[k] || 'folder'), h('b', {}, k), h('small', {}, `${list.filter((c) => c.cat === k).length}`)))));
  }
  draw();
  openDialog('Add Component', [search, body]);
  if (isDesktop()) search.focus();
}

// ---- Project panel: prefabs, objects, components (tap to add, drag into the scene) ----
const PREFABS_2D = [
  { icon: 'player', label: 'Player', props: { name: 'Player', tags: ['player'], shape: { type: 'circle', r: 18, fill: '#4fc3f7' }, behaviors: [{ type: 'move', control: 'both', speed: 260 }] } },
  { icon: 'jumper', label: 'Jumper', props: { name: 'Jumper', tags: ['player'], shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffca28' }, behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'respawn' }] }, scene: { gravity: 1600, settings: { joystick: true, jumpButton: true } } },
  { icon: 'platform', label: 'Platform', props: { name: 'Platform', shape: { type: 'rect', w: 200, h: 30, radius: 4, fill: '#5d8a4a' }, body: { type: 'static' } } },
  { icon: 'coin', label: 'Coin', props: { name: 'Coin', shape: { type: 'circle', r: 12, fill: '#ffca28', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] } },
  { icon: 'enemy', label: 'Enemy', props: { name: 'Enemy', shape: { type: 'rect', w: 36, h: 36, radius: 10, fill: '#e53935' }, behaviors: [{ type: 'patrol', dx: 120, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'gameover' }] } },
  { icon: 'flag', label: 'Goal', props: { name: 'Goal', shape: { type: 'rect', w: 20, h: 100, fill: '#66bb6a' }, behaviors: [{ type: 'goal' }] } },
  { icon: 'spawner', label: 'Spawner', props: { name: 'Spawner', behaviors: [{ type: 'spawner', template: '', every: 1, x: [20, 380], y: -40, z: 0, relative: false, ramp: 0.1, max: 60 }] } },
  { icon: 'hud', label: 'Score Text', props: { name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left', color: '#ffffff' } } },
  { icon: 'ghost', label: 'Chaser', props: { name: 'Chaser', shape: { type: 'circle', r: 16, fill: '#e53935' }, behaviors: [{ type: 'chase', speed: 100, range: 300, tag: 'player' }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'key', label: 'Key', props: { name: 'Key', shape: { type: 'star', w: 30, h: 30, fill: '#ffca28' }, behaviors: [{ type: 'float', amount: 8, period: 1.4 }, { type: 'collectible', score: 1, var: 'keys', sound: 'power' }] }, vars: { keys: 0 } },
  { icon: 'door', label: 'Door', props: { name: 'Door', shape: { type: 'rect', w: 30, h: 100, radius: 4, fill: '#a0522d', stroke: '#ffca28', lineWidth: 3 }, body: { type: 'static' }, behaviors: [{ type: 'unlock', var: 'keys', amount: 1, text: 'Unlocked!' }] }, vars: { keys: 0 } },
  { icon: 'sign', label: 'Sign', props: { name: 'Sign', shape: { type: 'rect', w: 34, h: 44, radius: 4, fill: '#c38b5f' }, behaviors: [{ type: 'message', text: 'Hello! Edit me in the Inspector.', seconds: 3, once: true, tag: 'player' }] } },
  { icon: 'portal', label: 'Portal', props: { name: 'Portal', shape: { type: 'circle', r: 22, fill: '', stroke: '#a77bff', lineWidth: 5, glow: 12 }, behaviors: [{ type: 'teleport', target: '', tag: 'player' }, { type: 'rotate', speed: 90 }] } },
  { icon: 'clock', label: 'Timer Text', props: { name: 'Timer Text', ui: true, anchor: 'top', x: 0, y: 34, text: { value: '{time}', size: 26, color: '#ffffff' } }, settings: { timeLimit: 60 } },
  { icon: 'hand', label: 'Tap Target', props: { name: 'Tap Target', shape: { type: 'circle', r: 30, fill: 'rgba(80,200,255,0.35)', stroke: '#7fdcff', lineWidth: 3 }, behaviors: [{ type: 'tappable', points: 10, destroy: true, sound: 'coin' }, { type: 'pulse', amount: 0.08, period: 0.9 }] } },
  { icon: 'coin', label: 'Big Clicker', props: { name: 'Big Clicker', shape: { type: 'circle', r: 70, fill: '#c98a4b', stroke: '#8d5a2b', lineWidth: 6 }, behaviors: [{ type: 'comboClicker', points: 1, var: 'score', window: 0.6, comboStep: 0.25, maxCombo: 50, critChance: 10, critMult: 3, popup: true, sound: 'click' }, { type: 'pressFeedback', squash: 0.9, sound: 'none', haptic: true, sparkles: true }] } },
  { icon: 'arrow', label: 'Slingshot Ball', props: { name: 'Slingshot Ball', tags: ['player'], shape: { type: 'circle', r: 18, fill: '#ef5350' }, body: { type: 'dynamic', bounce: 0.3, friction: 0.4 }, behaviors: [{ type: 'dragLaunch', power: 6, maxPull: 140, shots: 0, whileStill: true, shotsVar: 'shots' }] } },
  { icon: 'check', label: 'Switch', props: { name: 'Switch', shape: { type: 'rect', w: 70, h: 40, radius: 20, fill: '#78909c' }, behaviors: [{ type: 'tapToggle', var: 'switch', startOn: false, onColor: '#66bb6a', offColor: '#78909c', object: '', message: '' }] } },
  { icon: 'move', label: 'Draggable', props: { name: 'Draggable Block', shape: { type: 'rect', w: 70, h: 70, radius: 10, fill: '#7e57c2' }, behaviors: [{ type: 'draggable', snap: 0, lift: true }] } },
  { icon: 'arrow', label: 'Lane Runner', props: { name: 'Runner', tags: ['player'], shape: { type: 'rect', w: 40, h: 40, radius: 8, fill: '#4fc3f7' }, behaviors: [{ type: 'swipeMove', distance: 110, lanes: 3, jump: 0 }] } },
  { icon: 'flag', label: 'Checkpoint', props: { name: 'Checkpoint', shape: { type: 'rect', w: 14, h: 70, fill: '#90a4ae' }, behaviors: [{ type: 'checkpoint', text: 'Checkpoint!', tag: 'player' }] } },
  { icon: 'rotate', label: 'Orbiter', props: { name: 'Orbiter', shape: { type: 'circle', r: 14, fill: '#e53935' }, behaviors: [{ type: 'orbit', radius: 80, speed: 120 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'bolt', label: 'Shooter Ship', props: { name: 'Ship', tags: ['player'], shape: { type: 'triangle', w: 34, h: 40, fill: '#4fc3f7' }, behaviors: [{ type: 'move', control: 'both', speed: 280, axes: 'horizontal' }, { type: 'shooter', template: 'Bullet', every: 0.25, trigger: 'auto' }] },
    extra: [{ name: 'Bullet', template: true, tags: ['bullet'], offset: { x: 60, y: 0 }, shape: { type: 'rect', w: 6, h: 16, radius: 3, fill: '#fff59d' }, behaviors: [{ type: 'velocity', vx: 0, vy: -600, vz: 0 }, { type: 'destroyOffscreen', margin: 60 }] }] },
  { icon: 'square', label: 'Target', props: { name: 'Target', shape: { type: 'rect', w: 50, h: 50, radius: 8, fill: '#ff8a65' }, behaviors: [{ type: 'destructible', hp: 3, hitBy: 'bullet', points: 10, removeHitter: true }] } },
  { icon: 'move', label: 'Grid Hero', props: { name: 'Hero', tags: ['player'], shape: { type: 'circle', r: 15, fill: '#4fc3f7' }, behaviors: [{ type: 'gridMove', tile: 40, tapToMove: true, damage: 1 }, { type: 'health', hp: 5, hurtBy: '', invuln: 0, knockback: 0, onDeath: 'game over', showBar: 'always', numbers: true, syncVar: 'hp' }] }, settings: { turnBased: true }, vars: { hp: 5 } },
  { icon: 'enemy', label: 'Turn Enemy', props: { name: 'Goblin', shape: { type: 'rect', w: 28, h: 28, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'gridEnemy', tile: 40, hp: 2, points: 25, sight: 5 }] }, settings: { turnBased: true } },
  { icon: 'square', label: 'Wall Tile', props: { name: 'Wall', shape: { type: 'rect', w: 40, h: 40, fill: '#4a3f5c', stroke: '#2b2438', lineWidth: 2 }, body: { type: 'static' } } },
  { icon: 'square', label: 'Push Crate', props: { name: 'Crate', tags: ['pushable'], shape: { type: 'rect', w: 36, h: 36, radius: 4, fill: '#a1887f', stroke: '#6d4c41', lineWidth: 3 } } },
  { icon: 'grid', label: 'Board 3×3', props: { name: 'Cell 2-2', shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 1, col: 1, line: 3, vsComputer: true }] }, settings: { turnBased: true },
    extra: [{ name: 'Cell 1-1', offset: { x: -110, y: -110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 0, col: 0, line: 3, vsComputer: true }] }, { name: 'Cell 1-2', offset: { x: 0, y: -110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 0, col: 1, line: 3, vsComputer: true }] }, { name: 'Cell 1-3', offset: { x: 110, y: -110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 0, col: 2, line: 3, vsComputer: true }] }, { name: 'Cell 2-1', offset: { x: -110, y: 0 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 1, col: 0, line: 3, vsComputer: true }] }, { name: 'Cell 2-3', offset: { x: 110, y: 0 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 1, col: 2, line: 3, vsComputer: true }] }, { name: 'Cell 3-1', offset: { x: -110, y: 110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 2, col: 0, line: 3, vsComputer: true }] }, { name: 'Cell 3-2', offset: { x: 0, y: 110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 2, col: 1, line: 3, vsComputer: true }] }, { name: 'Cell 3-3', offset: { x: 110, y: 110 }, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' }, behaviors: [{ type: 'boardCell', row: 2, col: 2, line: 3, vsComputer: true }] }] },
  { icon: 'hand', label: 'Battle Button', props: { name: 'Attack Button', ui: true, anchor: 'bottom', x: 0, y: -120, shape: { type: 'rect', w: 320, h: 58, radius: 14, fill: '#455a64' }, text: { value: 'Attack', size: 20, color: '#ffffff' }, behaviors: [{ type: 'turnAction', var: 'enemyHp', amount: [-14, -8], max: 0, costVar: '', cost: 0, text: 'You strike for {n}!', sound: 'hit' }] },
    settings: { turnBased: true, turnDelay: 1 }, vars: { enemyHp: 60, hp: 50 } },
  { icon: 'ghost', label: 'Battle Enemy', props: { name: 'Monster', shape: { type: 'circle', r: 60, fill: '#66bb6a' }, behaviors: [{ type: 'turnOpponent', var: 'hp', amount: [-10, -5], text: 'The monster hits you for {n}!' }] },
    settings: { turnBased: true, turnDelay: 1 }, vars: { enemyHp: 60, hp: 50 },
    extra: [{ name: 'Win Check', offset: { x: -150, y: -200 }, behaviors: [{ type: 'condition', var: 'enemyHp', op: '<=', target: 0, action: 'win', value: '', amount: 1, sound: 'none' }] },
      { name: 'Lose Check', offset: { x: 150, y: -200 }, behaviors: [{ type: 'condition', var: 'hp', op: '<=', target: 0, action: 'game over', value: '', amount: 1, sound: 'none' }] }] },
  { icon: 'crosshair', label: 'Turret', props: { name: 'Turret', shape: { type: 'triangle', w: 34, h: 40, fill: '#8e24aa' }, body: { type: 'static' }, behaviors: [{ type: 'turret', template: 'Enemy Bullet', every: 1.2, range: 320, tag: 'player' }] },
    extra: [{ name: 'Enemy Bullet', template: true, offset: { x: 60, y: 0 }, shape: { type: 'circle', r: 6, fill: '#ff5252' }, behaviors: [{ type: 'projectile', speed: 320, life: 3 }, { type: 'hazard', action: 'damage', destroySelf: true }] }] },
  { icon: 'ghost', label: 'Wanderer', props: { name: 'Wanderer', shape: { type: 'circle', r: 16, fill: '#81c784' }, behaviors: [{ type: 'wander', speed: 60, radius: 120 }] } },
  { icon: 'player', label: 'Sidekick', props: { name: 'Sidekick', shape: { type: 'circle', r: 10, fill: '#fff176' }, behaviors: [{ type: 'follow', target: 'player', distance: 50, speed: 220 }, { type: 'float', amount: 6, period: 1.2 }] } },
  { icon: 'arrow', label: 'Patroller', props: { name: 'Patroller', shape: { type: 'rect', w: 32, h: 32, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'path', points: '0,0; 150,0; 150,-100; 0,-100', speed: 120, loop: true }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'circle', label: 'Ball', props: { name: 'Ball', tags: ['ball'], shape: { type: 'circle', r: 9, fill: '#ffffff' }, behaviors: [{ type: 'bounce', speed: 340, bottom: 'lose a life' }] } },
  { icon: 'square', label: 'Brick', props: { name: 'Brick', shape: { type: 'rect', w: 46, h: 20, radius: 4, fill: '#ef5350' }, body: { type: 'static' }, behaviors: [{ type: 'destructible', hp: 1, hitBy: 'ball', points: 10, removeHitter: false }] } },
  { icon: 'bolt', label: 'Trigger Zone', props: { name: 'Trigger Zone', shape: { type: 'rect', w: 80, h: 80, fill: 'rgba(76,139,214,0.25)', stroke: '#4c8bd6', lineWidth: 2 }, behaviors: [{ type: 'trigger', action: 'message', value: 'You found a secret!', amount: 1, sound: 'power', tag: 'player', once: true, hidden: true }] } },
  { icon: 'clock', label: 'Timer', props: { name: 'Timer', behaviors: [{ type: 'timer', seconds: 5, repeat: false, action: 'message', value: 'Hurry up!', amount: 1, sound: 'none' }] } },
  { icon: 'star', label: 'Fire', props: { name: 'Fire', shape: { type: 'triangle', w: 24, h: 30, fill: '#ff7043' }, behaviors: [{ type: 'emitter', color: '#ffb74d', rate: 25, spread: 0.4 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'car', label: 'Car', props: { name: 'Car', tags: ['player'], shape: { type: 'rect', w: 26, h: 44, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'car', maxSpeed: 320, accel: 260, turn: 160, autoGas: false }, { type: 'cameraFollow', axes: 'both', smooth: 5 }] } },
  { icon: 'hand', label: 'Clicker', props: { name: 'Big Button', shape: { type: 'circle', r: 80, fill: '#ffb74d', stroke: '#e65100', lineWidth: 6 }, behaviors: [{ type: 'tappable', points: 1, var: 'score', bonusVar: 'perTap', destroy: false, sound: 'click' }] }, vars: { perTap: 0 } },
  { icon: 'plus', label: 'Upgrade', props: { name: 'Upgrade Button', ui: true, anchor: 'bottom', x: 0, y: -100, shape: { type: 'rect', w: 320, h: 60, radius: 14, fill: '#5d4037' }, text: { value: 'Upgrade +1/s  ·  {cost}', size: 18, color: '#fff3e0' }, behaviors: [{ type: 'upgrade', cost: 15, costVar: 'score', addVar: 'perSecond', amount: 1, growth: 1.15 }] }, vars: { perSecond: 0 },
    extra: [{ name: 'Income', offset: { x: -150, y: -300 }, behaviors: [{ type: 'income', var: 'score', rateVar: 'perSecond' }] }] },
  { icon: 'arrow', label: 'Wind Zone', props: { name: 'Wind Zone', shape: { type: 'rect', w: 120, h: 200, fill: 'rgba(120,200,255,0.18)', stroke: 'rgba(120,200,255,0.5)', lineWidth: 2 }, behaviors: [{ type: 'forceZone', mode: 'direction', fx: 0, fy: -1, fz: 0, strength: 2400, tag: '', hidden: false }] } },
  { icon: 'save', label: 'Save Point', props: { name: 'Save Point', sprite: { src: 'art:scroll', w: 40, h: 40 }, behaviors: [{ type: 'savePoint', slot: 1, text: 'Game saved', tag: 'player' }, { type: 'float', amount: 6, period: 1.6 }] } },
  { icon: 'bulb', label: 'Torch', props: { name: 'Torch', sprite: { src: 'art:torch', w: 36, h: 36 }, light: { color: '#ffb056', intensity: 1, range: 180, flicker: 0.5 } }, scene: { light: { darkness: 0.85 } } },
  { icon: 'rotate', label: 'Spinning Bar', props: { name: 'Spinning Bar', shape: { type: 'rect', w: 160, h: 16, radius: 8, fill: '#e53935' }, body: { type: 'kinematic' }, behaviors: [{ type: 'rotate', speed: 90 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'platform', label: 'Moving Platform', props: { name: 'Moving Platform', shape: { type: 'rect', w: 140, h: 24, radius: 6, fill: '#8d6e63' }, body: { type: 'kinematic' }, behaviors: [{ type: 'tween', effect: 'move by', x: 160, y: 0, duration: 2, ease: 'inOutSine', loops: -1, loopType: 'yoyo', playOn: 'start' }] } },
  { icon: 'image', label: 'Animated Sprite', props: { name: 'Bird', sprite: { src: 'art:bird', w: 56, h: 56 }, behaviors: [{ type: 'flipbook', frames: 'art:bird,art:bird2', fps: 6, mode: 'loop', when: 'always' }, { type: 'tween', effect: 'move by', x: 0, y: -20, duration: 0.8, ease: 'inOutSine', loops: -1, loopType: 'yoyo', playOn: 'start' }] } },
  { icon: 'camera', label: 'Group Camera', props: { name: 'Group Camera', behaviors: [{ type: 'camera', mode: 'group', target: 'player', smooth: 4, zoom: 1, padding: 80, blend: 0.8, priority: 0 }] } },
  { icon: 'square', label: 'Camera Zone', props: { name: 'Camera Zone', shape: { type: 'rect', w: 300, h: 260, fill: 'rgba(120,180,255,0.12)', stroke: 'rgba(120,180,255,0.6)', lineWidth: 2 }, behaviors: [{ type: 'cameraZone', camera: 'Zone Camera', tag: 'player', mode: 'go back to the camera before' }] },
    extra: [{ name: 'Zone Camera', offset: { x: 0, y: 0 }, behaviors: [{ type: 'camera', mode: 'fixed', target: '', zoom: 1.4, blend: 0.8, priority: -1 }] }] },
  { icon: 'camera', label: 'Dolly Camera (cart)', props: { name: 'Dolly Camera', behaviors: [{ type: 'camera', mode: 'dolly', dollyMode: 'travel by itself', dollySpeed: 0.08, dollyLoop: 'back and forth', path: [{ x: 0, y: 350 }, { x: 900, y: 350 }], zoom: 1, blend: 1.2, priority: -1 }] } },
  { icon: 'clock', label: 'Camera Sequence (cutscene)', props: { name: 'Camera Sequence', behaviors: [{ type: 'cameraSequence', shots: 'Wide Cam | 1.5 | 0\nMain Camera | 0.3 | 1.2', start: 'when the level starts', loop: false, skip: true, bars: true, endMessage: 'cutscene done' }] },
    extra: [{ name: 'Wide Cam', offset: { x: 0, y: 0 }, behaviors: [{ type: 'camera', mode: 'fixed', target: '', zoom: 0.6, blend: 1, priority: -1 }] }] },
  { icon: 'target', label: 'Target Group', props: { name: 'Target Group', behaviors: [{ type: 'cameraTargetGroup', members: 'player | 1 | 60\nenemy | 0.5 | 40' }] },
    extra: [{ name: 'Group Cam', offset: { x: 0, y: 0 }, behaviors: [{ type: 'camera', mode: 'group', target: 'Target Group', smooth: 4, zoom: 1, padding: 80, blend: 0.8, priority: -1 }] }] },
  { icon: 'layers', label: 'Camera Mixer', props: { name: 'Camera Mixer', behaviors: [{ type: 'cameraMixer', camA: 'Main Camera', camB: 'Zone Camera', var: '', weight: 0.5, priority: -1 }] } },
  { icon: 'camera', label: 'Camera Brain (custom blends)', props: { name: 'Camera Brain', behaviors: [{ type: 'cameraBrain', defaultBlend: '', defaultEase: 'inOutCubic', blends: 'Wide Cam > * = 1.5 inOutSine' }] } },
  { icon: 'camera', label: 'Camera Switcher', props: { name: 'Camera Switcher', behaviors: [{ type: 'cameraSwitcher', mode: 'a variable', var: 'state', map: 'run = Main Camera\nzoom = Zone Camera', hold: 0.3 }] } },
  { icon: 'enemy', label: 'Smart Enemy', props: { name: 'Smart Enemy', tags: ['enemy'], sprite: { src: 'art:zombie', w: 44, h: 44 }, body: { type: 'dynamic' }, behaviors: [{ type: 'enemyAI', target: 'player', sight: 260, needLineOfSight: true, patrol: 100, speed: 60, chaseSpeed: 140, attackRange: 44, attackEvery: 1, damage: 1, giveUp: 3 }, { type: 'health', hp: 3, hurtBy: 'bullet', damage: 1, invuln: 0.2, knockback: 200, onDeath: 'destroy', points: 10 }] } },
  { icon: 'sign', label: 'Talking NPC', props: { name: 'Villager', sprite: { src: 'art:wizard', w: 48, h: 48 }, behaviors: [{ type: 'dialogue', lines: 'Villager: Welcome, hero!\nVillager: Bring me 3 gems and I will open the gate.', trigger: 'touched by tag', tag: 'player', once: true, pause: true }] } },
  { icon: 'key', label: 'Inventory Key', props: { name: 'Key Pickup', sprite: { src: 'art:key', w: 36, h: 36 }, behaviors: [{ type: 'inventoryItem', item: 'Key', icon: '🔑', amount: 1, tag: 'player' }, { type: 'tween', effect: 'move by', x: 0, y: -8, duration: 0.8, ease: 'inOutSine', loops: -1, loopType: 'yoyo', playOn: 'start' }] } },
  { icon: 'star', label: 'Rain', props: { name: 'Rain', behaviors: [{ type: 'particles', preset: 'rain', rate: 0, size: 0, playing: true }] } },
  { icon: 'sun', label: 'Day & Night', props: { name: 'Day & Night', behaviors: [{ type: 'dayNight', dayLength: 60, start: 8, dayColor: '#87b8e8', nightColor: '#0b1030', maxDark: 0.8 }] } },
  { icon: 'spawner', label: 'Wave Spawner', props: { name: 'Wave Spawner', y: -40, behaviors: [{ type: 'waveSpawner', waves: [{ template: 'Wave Enemy', count: 4, every: 1 }, { template: 'Wave Enemy', count: 7, every: 0.7 }], pause: 3, area: 300, areaH: 0, whenDone: 'win' }] },
    extra: [{ name: 'Wave Enemy', template: true, tags: ['enemy'], offset: { x: 0, y: 0 }, sprite: { src: 'art:alien', w: 36, h: 36 }, behaviors: [{ type: 'velocity', vx: 0, vy: 120, vz: 0 }, { type: 'health', hp: 1, hurtBy: 'bullet', damage: 1, invuln: 0, knockback: 0, onDeath: 'destroy', points: 5 }, { type: 'destroyOffscreen', margin: 80 }] }] },
  { icon: 'nodes', label: 'Patrol Guard (FSM)', props: { name: 'Guard', tags: ['enemy'], sprite: { src: 'art:knight', w: 44, h: 44 }, behaviors: [{ type: 'fsm', fsm: { start: 'p', any: [], states: [
    { id: 'p', name: 'Patrol', x: 30, y: 40, enter: [{ type: 'moveBy', x: 120, y: 0, z: 0, seconds: 1.5, ease: 'inOutSine', wait: true }, { type: 'moveBy', x: -120, y: 0, z: 0, seconds: 1.5, ease: 'inOutSine', wait: true }], stay: [], exit: [], transitions: [{ event: { type: 'finished' }, conditions: [], to: 'p2' }, { event: { type: 'always' }, conditions: [{ type: 'near', tag: 'player', op: '<', value: 150 }], to: 'a' }] },
    { id: 'p2', name: 'Look Around', x: 30, y: 170, enter: [{ type: 'rotateBy', degrees: 20, seconds: 0.3 }, { type: 'wait', seconds: 0.4 }, { type: 'rotateBy', degrees: -20, seconds: 0.3 }], stay: [], exit: [], transitions: [{ event: { type: 'after', seconds: 1.2 }, conditions: [], to: 'p' }] },
    { id: 'a', name: 'Alert', x: 260, y: 100, enter: [{ type: 'punch', what: 'scale', amount: 0.4, seconds: 0.4 }, { type: 'message', text: 'Hey! Stop!', seconds: 1.2 }, { type: 'shake', strength: 8 }], stay: [], exit: [], transitions: [{ event: { type: 'after', seconds: 2 }, conditions: [{ type: 'near', tag: 'player', op: '>', value: 220 }], to: 'p' }] },
  ] } }] } },
  { icon: 'heart', label: 'Survivor', group: 'Survival', desc: 'A player with Health, Hunger and Thirst', props: { name: 'Survivor', tags: ['player'], shape: { type: 'circle', r: 18, fill: '#8bc34a' }, behaviors: [{ type: 'move', control: 'both', speed: 240 }, { type: 'health', hp: 100, damage: 10, hurtBy: 'enemy', invuln: 0.8, onDeath: 'game over', syncVar: 'hp', numbers: true, showBar: 'when hurt', regen: 1, regenDelay: 4 }, { type: 'hunger' }, { type: 'thirst' }] } },
  { icon: 'heart', label: 'Apple (food)', group: 'Survival', desc: 'Fills Hunger', props: { name: 'Apple', tags: ['food'], shape: { type: 'emoji', emoji: '🍎', w: 30, h: 30 }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'heart', label: 'Water (drink)', group: 'Survival', desc: 'Fills Thirst', props: { name: 'Water', tags: ['water'], shape: { type: 'emoji', emoji: '💧', w: 30, h: 30 }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'heart', label: 'Medkit', group: 'Survival', desc: 'Heals: add “medkit” to Health › Health pickups', props: { name: 'Medkit', tags: ['medkit'], shape: { type: 'emoji', emoji: '🩹', w: 30, h: 30 }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'enemy', label: 'Spikes', group: 'Survival', desc: 'Hurts the player while they stand on it', props: { name: 'Spikes', shape: { type: 'rect', w: 90, h: 16, radius: 3, fill: '#9e9e9e' }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'damager', targets: 'player', amount: 10, mode: 'while touching (every few seconds)', every: 0.6 }] } },
  { icon: 'enemy', label: 'Fire', group: 'Survival', desc: 'Fire damage that keeps burning', props: { name: 'Fire', shape: { type: 'emoji', emoji: '🔥', w: 40, h: 40 }, body: { type: 'kinematic', sensor: true }, light: { color: '#ffb35c', intensity: 1, range: 160, effect: 'fire' }, behaviors: [{ type: 'damager', targets: 'player', amount: 10, dtype: 'fire', effect: 'burn', effectDps: 4, effectTime: 3 }] } },
  { icon: 'enemy', label: 'Poison Pool', group: 'Survival', desc: 'Poisons whoever steps in', props: { name: 'Poison Pool', shape: { type: 'circle', r: 34, fill: '#7cb342' }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'damager', targets: 'player', amount: 0, dtype: 'poison', effect: 'poison', effectDps: 5, effectTime: 4 }] } },
  { icon: 'gear', label: 'Workbench', group: 'Crafting', items: true, desc: 'Crafting station: Workbench recipes work next to it', props: { name: 'Workbench', shape: { type: 'emoji', emoji: '🛠️', w: 54, h: 54 }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'craftingStation', station: 'Workbench' }] } },
  { icon: 'gear', label: 'Furnace', group: 'Crafting', items: true, desc: 'Smelts ore and cooks food', props: { name: 'Furnace', shape: { type: 'emoji', emoji: '🧱', w: 54, h: 54 }, body: { type: 'kinematic', sensor: true }, light: { color: '#ff9a4d', intensity: 0.8, range: 140, effect: 'fire' }, behaviors: [{ type: 'craftingStation', station: 'Furnace' }] } },
  { icon: 'gem', label: 'Tree', group: 'Crafting', items: true, desc: 'Tap to chop: gives Wood, grows back', props: { name: 'Tree', shape: { type: 'emoji', emoji: '🌳', w: 70, h: 70 }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Wood', hits: 3, bonus: 'Apple 1 30%, Stick 1-2 50%', respawn: 30 }] } },
  { icon: 'gem', label: 'Rock', group: 'Crafting', items: true, desc: 'Tap to mine: gives Stone', props: { name: 'Rock', shape: { type: 'emoji', emoji: '🪨', w: 50, h: 50 }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Stone', hits: 4, bonus: 'Coal 1 40%', respawn: 40 }] } },
  { icon: 'gem', label: 'Iron Rock', group: 'Crafting', items: true, desc: 'Needs a Pickaxe: gives Iron Ore', props: { name: 'Iron Rock', shape: { type: 'emoji', emoji: '⛰️', w: 56, h: 56 }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Iron Ore', hits: 5, tool: 'Pickaxe', bonus: 'Gem 1 10%', respawn: 60 }] } },
  { icon: 'gem', label: 'Berry Bush', group: 'Crafting', items: true, desc: 'Walk into it for Berries', props: { name: 'Berry Bush', shape: { type: 'emoji', emoji: '🫐', w: 44, h: 44 }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'resource', item: 'Berries', amount: 2, hits: 1, gather: 'tapping or touching', respawn: 25 }] } },
  { icon: 'gem', label: 'Treasure Chest', group: 'Crafting', items: true, desc: 'Tap to open: random loot', props: { name: 'Chest', shape: { type: 'emoji', emoji: '🧰', w: 48, h: 48 }, body: { type: 'static' }, behaviors: [{ type: 'loot', loot: 'Gem 1-2\nHealth Potion 1 60%\nIron Bar 2-4 50%\nKey 1 20%', when: 'tapped', reach: 120, openIcon: '📭' }] } },
  { icon: 'gem', label: 'Breakable Crate', group: 'Crafting', items: true, desc: 'Has health; drops loot when broken', props: { name: 'Crate', tags: ['enemy'], shape: { type: 'emoji', emoji: '📦', w: 44, h: 44 }, body: { type: 'static' }, behaviors: [{ type: 'health', hp: 3, hurtBy: 'bullet', invuln: 0.2, knockback: 0 }, { type: 'loot', loot: 'Wood 1-3\nApple 1 30%', when: 'destroyed', into: 'onto the ground' }] } },
  { icon: 'gem', label: 'Item Pick-up', group: 'Crafting', items: true, desc: 'Walk over it to pick it up (set the item)', props: { name: 'Wood', shape: { type: 'emoji', emoji: '🪵', w: 32, h: 32 }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'inventoryItem', item: 'Wood', icon: '', amount: 3 }] } },
  { icon: 'sign', label: 'Quest Giver', group: 'Story', story: true, desc: 'An NPC that offers quests (! and ?) and takes them back', props: { name: 'Elder', shape: { type: 'emoji', emoji: '🧙', w: 48, h: 48 }, body: { type: 'static' }, behaviors: [{ type: 'npc', portrait: '🧙' }] } },
  { icon: 'sign', label: 'Villager', group: 'Story', story: true, desc: 'Tap to talk: a dialogue with choices', props: { name: 'Villager', shape: { type: 'emoji', emoji: '🧑‍🌾', w: 44, h: 44 }, body: { type: 'static' }, behaviors: [{ type: 'npc', dialogue: 'Villager', portrait: '🧑‍🌾' }] } },
  { icon: 'sign', label: 'Shopkeeper', group: 'Story', story: true, desc: 'Sells a potion through dialogue choices', props: { name: 'Shopkeeper', shape: { type: 'emoji', emoji: '🧔', w: 44, h: 44 }, body: { type: 'static' }, behaviors: [{ type: 'npc', dialogue: 'Shopkeeper', portrait: '🧔' }] }, vars: { coins: 20 } },
  { icon: 'sign', label: 'Signpost', group: 'Story', story: true, desc: 'Read it when you walk up', props: { name: 'Signpost', shape: { type: 'emoji', emoji: '🪧', w: 40, h: 40 }, behaviors: [{ type: 'npc', dialogue: 'Signpost', start: 'player comes close', range: 60, markers: false, bubble: false, pause: false }] } },
  { icon: 'flag', label: 'Quest Spot', group: 'Story', story: true, desc: 'A place to reach for a quest (“reach Old Well”)', props: { name: 'Old Well', shape: { type: 'emoji', emoji: '🪣', w: 44, h: 44 }, body: { type: 'static' } } },
  { icon: 'coin', label: 'Merchant', group: 'Story', desc: 'Buys and sells: talk to trade', props: { name: 'Merchant', shape: { type: 'emoji', emoji: '🧑‍💼', w: 44, h: 44 }, body: { type: 'static' }, behaviors: [{ type: 'npc', portrait: '🧑‍💼', nameTag: true, greeting: 'Welcome, traveller!', sells: 'Health Potion | 10\nApple | 3 | 2\nTorch | 5', buys: 'Wood | 2\nGem | 30', barks: 'Fresh potions!\nBest prices in town!' }] }, vars: { coins: 30 }, items: true },
  { icon: 'sign', label: 'Wandering Villager', group: 'Story', desc: 'Strolls around, chats as you pass, likes gifts', props: { name: 'Villager', shape: { type: 'emoji', emoji: '👩‍🌾', w: 40, h: 40 }, body: { type: 'kinematic' }, behaviors: [{ type: 'npc', portrait: '👩‍🌾', moveMode: 'wanders around', nameTag: true, likes: 'Apple, Berries', barks: 'Lovely weather!\nHave you seen my cat?\nThe Elder knows everything.' }] } },
  { icon: 'enemy', label: 'Patrol Guard', group: 'Story', desc: 'Walks a route and calls out', props: { name: 'Guard', shape: { type: 'emoji', emoji: '💂', w: 40, h: 40 }, body: { type: 'kinematic' }, behaviors: [{ type: 'npc', portrait: '💂', moveMode: 'patrols a route', route: '0,0\n160,0', barks: 'Halt! Who goes there?\nAll quiet.', barkWhen: 'every few seconds', barkEvery: 7, greeting: 'Stay out of trouble.' }] }, note: 'Set its Route (Moving): object names or x,y points, one per line.' },
  { icon: 'heart', label: 'Companion', group: 'Story', desc: 'Follows you around', props: { name: 'Dog', shape: { type: 'emoji', emoji: '🐕', w: 34, h: 34 }, behaviors: [{ type: 'npc', portrait: '🐕', moveMode: 'follows the player', markers: false, greeting: 'Woof!', barks: 'Woof!\n*wags tail*', range: 50 }] } },
  // squads (tactics and strategy)
  { icon: 'player', label: 'Soldier', group: 'Squad', desc: 'Your unit: tap to select, tap a tile to move', props: { name: 'Soldier', layer: 3, shape: { type: 'emoji', emoji: '🗡️', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', hp: 6, damage: 2, moves: 4 }] } },
  { icon: 'crosshair', label: 'Archer', group: 'Squad', desc: 'Your unit: shoots 3 tiles away', props: { name: 'Archer', layer: 3, shape: { type: 'emoji', emoji: '🏹', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', hp: 4, damage: 2, range: 3, moves: 3 }] } },
  { icon: 'player', label: 'Knight', group: 'Squad', desc: 'Your unit: tough and strong, slower', props: { name: 'Knight', layer: 3, shape: { type: 'emoji', emoji: '🛡️', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', hp: 10, damage: 3, moves: 3 }] } },
  { icon: 'star', label: 'Mage', group: 'Squad', desc: 'Your unit: magic bolts, far but fragile', props: { name: 'Mage', layer: 3, shape: { type: 'emoji', emoji: '🧙', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', hp: 3, damage: 3, range: 4, moves: 3, shot: 'magic bolt' }] } },
  { icon: 'enemy', label: 'Enemy Unit', group: 'Squad', desc: 'The computer moves it toward your units', props: { name: 'Goblin', layer: 3, shape: { type: 'emoji', emoji: '👺', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', team: 'enemy', hp: 4, damage: 2, moves: 4, sight: 7, points: 20 }] } },
  { icon: 'enemy', label: 'Enemy Archer', group: 'Squad', desc: 'Shoots your units from afar', props: { name: 'Goblin Archer', layer: 3, shape: { type: 'emoji', emoji: '🧝', w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', team: 'enemy', hp: 3, damage: 1, range: 3, moves: 3, sight: 7, points: 20 }] } },
  { icon: 'flag', label: 'Unit Commander', group: 'Squad', desc: 'How you command units: selection, formation, turns', props: { name: 'Unit Commander', behaviors: [{ type: 'squadControl' }] } },
];
const PREFABS_3D = [
  { icon: 'player', label: 'Player', props: { name: 'Player', tags: ['player'], y: 0.6, mesh: { geometry: 'sphere', r: 0.6, color: '#4f8ef7' }, behaviors: [{ type: 'move', speed: 7, control: 'joystick' }, { type: 'cameraFollow', oy: 9, oz: 10, smooth: 5 }] }, scene: { settings: { joystick: true } } },
  { icon: 'jumper', label: 'Jumper', props: { name: 'Jumper', tags: ['player'], y: 1, mesh: { geometry: 'box', w: 0.8, h: 1.2, d: 0.8, color: '#ffca28' }, behaviors: [{ type: 'platformer', speed: 7, jump: 10, onFall: 'respawn' }, { type: 'cameraFollow', oy: 7, oz: 11, smooth: 5 }] }, scene: { settings: { joystick: true, jumpButton: true } } },
  { icon: 'platform', label: 'Platform', props: { name: 'Platform', y: 0, mesh: { geometry: 'box', w: 4, h: 0.5, d: 4, color: '#a1887f' }, body: { type: 'static' } } },
  { icon: 'coin', label: 'Gem', props: { name: 'Gem', y: 0.9, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.6, h: 0.6, d: 0.6, color: '#ffca28', emissive: 0.5 }, behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'collectible', score: 10 }] } },
  { icon: 'enemy', label: 'Enemy', props: { name: 'Enemy', y: 0.5, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#e53935' }, behaviors: [{ type: 'patrol', dx: 4, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'gameover' }] } },
  { icon: 'flag', label: 'Goal', props: { name: 'Goal', y: 1, mesh: { geometry: 'cylinder', r: 0.6, h: 2, color: '#66bb6a', emissive: 0.4, opacity: 0.7 }, behaviors: [{ type: 'goal' }] } },
  { icon: 'spawner', label: 'Spawner', props: { name: 'Spawner', y: 3, behaviors: [{ type: 'spawner', template: '', every: 1, x: [-8, 8], y: 5, z: [-8, 8], relative: false, ramp: 0.1, max: 60 }] } },
  { icon: 'hud', label: 'Score Text', props: { name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left', color: '#ffffff' } } },
  { icon: 'ghost', label: 'Chaser', props: { name: 'Chaser', y: 0.5, mesh: { geometry: 'sphere', r: 0.5, color: '#e53935' }, behaviors: [{ type: 'chase', speed: 3.5, range: 10, tag: 'player' }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'key', label: 'Key', props: { name: 'Key', y: 0.9, mesh: { geometry: 'cone', r: 0.3, h: 0.6, color: '#ffca28', emissive: 0.4 }, behaviors: [{ type: 'rotate', axis: 'y', speed: 150 }, { type: 'float', amount: 0.2, period: 1.4 }, { type: 'collectible', score: 1, var: 'keys', sound: 'power' }] }, vars: { keys: 0 } },
  { icon: 'door', label: 'Door', props: { name: 'Door', y: 1, mesh: { geometry: 'box', w: 2, h: 2, d: 0.3, color: '#a0522d' }, body: { type: 'static' }, behaviors: [{ type: 'unlock', var: 'keys', amount: 1, text: 'Unlocked!' }] }, vars: { keys: 0 } },
  { icon: 'sign', label: 'Sign', props: { name: 'Sign', y: 0.6, mesh: { geometry: 'box', w: 0.8, h: 1.2, d: 0.15, color: '#c38b5f' }, behaviors: [{ type: 'message', text: 'Hello! Edit me in the Inspector.', seconds: 3, once: true, tag: 'player' }] } },
  { icon: 'portal', label: 'Portal', props: { name: 'Portal', y: 0.05, mesh: { geometry: 'cylinder', r: 0.8, h: 0.1, color: '#a77bff', emissive: 0.6 }, behaviors: [{ type: 'teleport', target: '', tag: 'player' }] } },
  { icon: 'clock', label: 'Timer Text', props: { name: 'Timer Text', ui: true, anchor: 'top', x: 0, y: 34, text: { value: '{time}', size: 26, color: '#ffffff' } }, settings: { timeLimit: 60 } },
  { icon: 'hand', label: 'Tap Target', props: { name: 'Tap Target', y: 0.6, mesh: { geometry: 'sphere', r: 0.6, color: '#4fc3f7', emissive: 0.3 }, behaviors: [{ type: 'tappable', points: 10, destroy: true, sound: 'coin' }, { type: 'pulse', amount: 0.08, period: 0.9 }] } },
  { icon: 'move', label: 'Draggable', props: { name: 'Draggable Block', y: 0.5, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#7e57c2' }, behaviors: [{ type: 'draggable', snap: 0, lift: true }] } },
  { icon: 'arrow', label: 'Lane Runner', props: { name: 'Runner', tags: ['player'], y: 0.5, mesh: { geometry: 'box', w: 0.8, h: 1, d: 0.8, color: '#4fc3f7' }, behaviors: [{ type: 'swipeMove', distance: 2.5, lanes: 3, jump: 9 }, { type: 'cameraFollow', oy: 5, oz: 8, smooth: 5 }] } },
  { icon: 'flag', label: 'Checkpoint', props: { name: 'Checkpoint', y: 0.75, mesh: { geometry: 'cylinder', r: 0.15, h: 1.5, color: '#90a4ae' }, behaviors: [{ type: 'checkpoint', text: 'Checkpoint!', tag: 'player' }] } },
  { icon: 'rotate', label: 'Orbiter', props: { name: 'Orbiter', y: 0.5, mesh: { geometry: 'sphere', r: 0.4, color: '#e53935' }, behaviors: [{ type: 'orbit', radius: 3, speed: 90 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'square', label: 'Target', props: { name: 'Target', y: 0.75, mesh: { geometry: 'box', w: 1.5, h: 1.5, d: 0.4, color: '#ff8a65' }, behaviors: [{ type: 'destructible', hp: 3, hitBy: 'bullet', points: 10, removeHitter: true }] } },
  { icon: 'crosshair', label: 'FPS Player', props: { name: 'FPS Player', tags: ['player'], y: 1, mesh: { geometry: 'box', w: 0.8, h: 1.8, d: 0.8, color: '#4f8ef7' }, behaviors: [{ type: 'firstPerson', speed: 6, look: 0.25, eye: 0.6, jump: 9 }, { type: 'shooter', template: 'Bullet', every: 0.18, trigger: 'action button' }] },
    scene: { settings: { joystick: true, actionButton: true, jumpButton: true } },
    extra: [{ name: 'Bullet', template: true, tags: ['bullet'], offset: { x: 2, y: 1 }, mesh: { geometry: 'sphere', r: 0.15, color: '#fff59d', emissive: 1 }, behaviors: [{ type: 'projectile', speed: 30, life: 1.5 }] },
      { name: 'Crosshair', ui: true, anchor: 'center', x: 0, y: 0, text: { value: '+', size: 34, color: '#ffffff' } }] },
  { icon: 'cube', label: 'Block Builder', props: { name: 'Builder', tags: ['player'], y: 10, mesh: { geometry: 'box', w: 0.6, h: 1.7, d: 0.6, color: '#4f8ef7' }, behaviors: [{ type: 'firstPerson', speed: 4.3, look: 0.3, eye: 0.65, jump: 8.5, autoJump: true }, { type: 'voxelBuilder', reach: 5, controls: 'hold to mine', inventory: 'creative' }] },
    scene: { settings: { joystick: true, jumpButton: true } }, extra: [{ name: 'Crosshair', ui: true, anchor: 'center', x: 0, y: 0, text: { value: '+', size: 30, color: '#ffffff' } }] },
  { icon: 'player', label: 'TPS Player', props: { name: 'Hero', tags: ['player'], y: 1, mesh: { geometry: 'cylinder', r: 0.4, h: 1.4, color: '#ff8a3d' }, behaviors: [{ type: 'thirdPerson', speed: 6, jump: 10, distance: 7, height: 25, look: 0.3 }] },
    scene: { settings: { joystick: true, jumpButton: true } } },
  { icon: 'crosshair', label: 'Turret', props: { name: 'Turret', y: 0.6, mesh: { geometry: 'cylinder', r: 0.5, h: 1.2, color: '#8e24aa' }, body: { type: 'static' }, behaviors: [{ type: 'turret', template: 'Enemy Bullet', every: 1.2, range: 14, tag: 'player' }] },
    extra: [{ name: 'Enemy Bullet', template: true, offset: { x: 2, y: 0 }, mesh: { geometry: 'sphere', r: 0.15, color: '#ff5252', emissive: 1 }, behaviors: [{ type: 'projectile', speed: 12, life: 3 }, { type: 'hazard', action: 'damage', destroySelf: true }] }] },
  { icon: 'ghost', label: 'Wanderer', props: { name: 'Wanderer', y: 0.4, mesh: { geometry: 'sphere', r: 0.4, color: '#81c784' }, behaviors: [{ type: 'wander', speed: 2, radius: 5 }] } },
  { icon: 'player', label: 'Sidekick', props: { name: 'Sidekick', y: 1.2, mesh: { geometry: 'sphere', r: 0.25, color: '#fff176', emissive: 0.5 }, behaviors: [{ type: 'follow', target: 'player', distance: 1.5, speed: 7 }, { type: 'float', amount: 0.2, period: 1.2 }] } },
  { icon: 'arrow', label: 'Patroller', props: { name: 'Patroller', y: 0.5, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#e53935' }, behaviors: [{ type: 'path', points: '0,0; 4,0; 4,-4; 0,-4', speed: 3, loop: true }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'bolt', label: 'Trigger Zone', props: { name: 'Trigger Zone', y: 1, mesh: { geometry: 'box', w: 2, h: 2, d: 2, color: '#4c8bd6', opacity: 0.3 }, behaviors: [{ type: 'trigger', action: 'message', value: 'You found a secret!', amount: 1, sound: 'power', tag: 'player', once: true, hidden: true }] } },
  { icon: 'clock', label: 'Timer', props: { name: 'Timer', y: 2, behaviors: [{ type: 'timer', seconds: 5, repeat: false, action: 'message', value: 'Hurry up!', amount: 1, sound: 'none' }] } },
  { icon: 'star', label: 'Fire', props: { name: 'Fire', y: 0.3, mesh: { geometry: 'cone', r: 0.3, h: 0.6, color: '#ff7043', emissive: 0.6 }, behaviors: [{ type: 'emitter', color: '#ffb74d', rate: 25, spread: 0.4 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'car', label: 'Car', props: { name: 'Car', tags: ['player'], y: 0.5, mesh: { geometry: 'box', w: 1.4, h: 0.8, d: 2.4, color: '#e53935' }, behaviors: [{ type: 'car', maxSpeed: 16, accel: 12, turn: 110, autoGas: false, chaseCam: true }] },
    scene: { settings: { joystick: true } } },
  { icon: 'arrow', label: 'Wind Zone', props: { name: 'Wind Zone', y: 1.5, mesh: { geometry: 'box', w: 3, h: 3, d: 3, color: '#78c8ff', opacity: 0.2 }, behaviors: [{ type: 'forceZone', mode: 'direction', fx: 0, fy: 1, fz: 0, strength: 45, tag: '', hidden: false }] } },
  { icon: 'save', label: 'Save Point', props: { name: 'Save Point', y: 0.6, mesh: { geometry: 'gem', w: 0.6, h: 1, d: 0.6, color: '#7cf7a0', emissive: 0.5 }, light: { color: '#7cf7a0', intensity: 1, range: 4 }, behaviors: [{ type: 'savePoint', slot: 1, text: 'Game saved', tag: 'player' }, { type: 'rotate', axis: 'y', speed: 90 }] } },
  { icon: 'coin', label: 'Spinning Coin', props: { name: 'Spinning Coin', y: 1, mesh: { geometry: 'cylinder', r: 0.4, h: 0.1, color: '#ffca28', emissive: 0.3 }, rx: 90, behaviors: [{ type: 'tween', effect: 'rotate by', angle: 360, duration: 1.5, ease: 'linear', loops: -1, loopType: 'restart', playOn: 'start' }, { type: 'collectible', score: 10 }] } },
  { icon: 'platform', label: 'Moving Platform', props: { name: 'Moving Platform', y: 1, mesh: { geometry: 'box', w: 3, h: 0.4, d: 3, color: '#8d6e63' }, body: { type: 'kinematic' }, behaviors: [{ type: 'tween', effect: 'move by', x: 5, y: 0, z: 0, duration: 3, ease: 'inOutSine', loops: -1, loopType: 'yoyo', playOn: 'start' }] } },
  { icon: 'heart', label: 'Survivor', group: 'Survival', desc: 'A player with Health, Hunger and Thirst', props: { name: 'Survivor', tags: ['player'], y: 0.6, mesh: { geometry: 'capsule', r: 0.45, h: 1.2, color: '#8bc34a' }, behaviors: [{ type: 'move', speed: 7, control: 'joystick' }, { type: 'cameraFollow', oy: 9, oz: 10, smooth: 5 }, { type: 'health', hp: 100, damage: 10, hurtBy: 'enemy', invuln: 0.8, onDeath: 'game over', syncVar: 'hp', numbers: true, showBar: 'when hurt', regen: 1, regenDelay: 4 }, { type: 'hunger' }, { type: 'thirst' }] }, scene: { settings: { joystick: true } } },
  { icon: 'heart', label: 'Apple (food)', group: 'Survival', desc: 'Fills Hunger', props: { name: 'Apple', tags: ['food'], y: 0.4, mesh: { geometry: 'sphere', r: 0.3, color: '#e53935' }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'heart', label: 'Water (drink)', group: 'Survival', desc: 'Fills Thirst', props: { name: 'Water', tags: ['water'], y: 0.4, mesh: { geometry: 'cylinder', r: 0.2, h: 0.6, color: '#4db8ff', opacity: 0.8 }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'heart', label: 'Medkit', group: 'Survival', desc: 'Heals: add “medkit” to Health › Health pickups', props: { name: 'Medkit', tags: ['medkit'], y: 0.3, mesh: { geometry: 'box', w: 0.6, h: 0.4, d: 0.6, color: '#ffffff' }, body: { type: 'kinematic', sensor: true } } },
  { icon: 'enemy', label: 'Spikes', group: 'Survival', desc: 'Hurts the player while they stand on it', props: { name: 'Spikes', y: 0.15, mesh: { geometry: 'pyramid', w: 1.5, h: 0.3, d: 1.5, color: '#9e9e9e' }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'damager', targets: 'player', amount: 10, mode: 'while touching (every few seconds)', every: 0.6 }] } },
  { icon: 'enemy', label: 'Fire', group: 'Survival', desc: 'Fire damage that keeps burning', props: { name: 'Fire', y: 0.5, mesh: { geometry: 'cone', r: 0.4, h: 1, color: '#ff7043', emissive: 0.9 }, body: { type: 'kinematic', sensor: true }, light: { color: '#ffb35c', intensity: 2, range: 6, effect: 'fire' }, behaviors: [{ type: 'damager', targets: 'player', amount: 10, dtype: 'fire', effect: 'burn', effectDps: 4, effectTime: 3 }] } },
  { icon: 'enemy', label: 'Poison Pool', group: 'Survival', desc: 'Poisons whoever steps in', props: { name: 'Poison Pool', y: 0.05, mesh: { geometry: 'cylinder', r: 1, h: 0.1, color: '#7cb342' }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'damager', targets: 'player', amount: 0, dtype: 'poison', effect: 'poison', effectDps: 5, effectTime: 4 }] } },
  { icon: 'gear', label: 'Workbench', group: 'Crafting', items: true, desc: 'Crafting station: Workbench recipes work next to it', props: { name: 'Workbench', y: 0.45, mesh: { geometry: 'box', w: 1.6, h: 0.9, d: 0.9, color: '#8d6e63' }, body: { type: 'static' }, behaviors: [{ type: 'craftingStation', station: 'Workbench' }] } },
  { icon: 'gear', label: 'Furnace', group: 'Crafting', items: true, desc: 'Smelts ore and cooks food', props: { name: 'Furnace', y: 0.6, mesh: { geometry: 'box', w: 1.2, h: 1.2, d: 1.2, color: '#757575' }, body: { type: 'static' }, light: { color: '#ff9a4d', intensity: 2, range: 5, effect: 'fire' }, behaviors: [{ type: 'craftingStation', station: 'Furnace' }] } },
  { icon: 'gem', label: 'Tree', group: 'Crafting', items: true, desc: 'Tap to chop: gives Wood, grows back', props: { name: 'Tree', y: 1.5, mesh: { geometry: 'cone', r: 1, h: 3, color: '#2e7d32' }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Wood', hits: 3, bonus: 'Apple 1 30%, Stick 1-2 50%', respawn: 30 }] } },
  { icon: 'gem', label: 'Rock', group: 'Crafting', items: true, desc: 'Tap to mine: gives Stone', props: { name: 'Rock', y: 0.5, mesh: { geometry: 'gem', r: 0.8, color: '#9e9e9e' }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Stone', hits: 4, bonus: 'Coal 1 40%', respawn: 40 }] } },
  { icon: 'gem', label: 'Iron Rock', group: 'Crafting', items: true, desc: 'Needs a Pickaxe: gives Iron Ore', props: { name: 'Iron Rock', y: 0.5, mesh: { geometry: 'gem', r: 0.8, color: '#8d6e63' }, body: { type: 'static' }, behaviors: [{ type: 'resource', item: 'Iron Ore', hits: 5, tool: 'Pickaxe', bonus: 'Gem 1 10%', respawn: 60 }] } },
  { icon: 'gem', label: 'Treasure Chest', group: 'Crafting', items: true, desc: 'Tap to open: random loot', props: { name: 'Chest', y: 0.4, mesh: { geometry: 'box', w: 1, h: 0.8, d: 0.7, color: '#a1887f' }, body: { type: 'static' }, behaviors: [{ type: 'loot', loot: 'Gem 1-2\nHealth Potion 1 60%\nIron Bar 2-4 50%\nKey 1 20%', when: 'tapped', reach: 3.5 }] } },
  { icon: 'gem', label: 'Item Pick-up', group: 'Crafting', items: true, desc: 'Walk over it to pick it up (set the item)', props: { name: 'Wood', y: 0.3, mesh: { geometry: 'box', w: 0.5, h: 0.3, d: 0.3, color: '#8d6e63' }, body: { type: 'kinematic', sensor: true }, behaviors: [{ type: 'inventoryItem', item: 'Wood', icon: '', amount: 3 }] } },
  { icon: 'coin', label: 'Merchant', group: 'Story', desc: 'Buys and sells: talk to trade', props: { name: 'Merchant', y: 0.9, mesh: { geometry: 'capsule', r: 0.4, h: 1.8, color: '#ffb300' }, body: { type: 'static' }, behaviors: [{ type: 'npc', portrait: '🧑‍💼', nameTag: true, range: 3, sells: 'Health Potion | 10\nApple | 3 | 2', buys: 'Wood | 2' }] }, vars: { coins: 30 }, items: true },
  { icon: 'sign', label: 'Wandering Villager', group: 'Story', desc: 'Strolls around and chats as you pass', props: { name: 'Villager', y: 0.9, mesh: { geometry: 'capsule', r: 0.4, h: 1.8, color: '#ec407a' }, body: { type: 'kinematic' }, behaviors: [{ type: 'npc', portrait: '👩‍🌾', range: 3, moveMode: 'wanders around', nameTag: true, barks: 'Lovely weather!\nHave you seen my cat?' }] } },
  { icon: 'player', label: 'Soldier', group: 'Squad', desc: 'Your unit: tap to select, tap the ground to move', props: { name: 'Soldier', y: 0.5, mesh: { geometry: 'capsule', r: 0.3, h: 1, color: '#4fc3f7' }, behaviors: [{ type: 'gridUnit', tile: 1, hp: 6, damage: 2, moves: 4 }] } },
  { icon: 'crosshair', label: 'Archer', group: 'Squad', desc: 'Your unit: shoots 3 tiles away', props: { name: 'Archer', y: 0.5, mesh: { geometry: 'capsule', r: 0.3, h: 1, color: '#81c784' }, behaviors: [{ type: 'gridUnit', tile: 1, hp: 4, damage: 2, range: 3, moves: 3 }] } },
  { icon: 'enemy', label: 'Enemy Unit', group: 'Squad', desc: 'The computer moves it toward your units', props: { name: 'Orc', y: 0.5, mesh: { geometry: 'box', w: 0.7, h: 1, d: 0.7, color: '#e53935' }, behaviors: [{ type: 'gridUnit', tile: 1, team: 'enemy', hp: 4, damage: 2, moves: 4, sight: 7, points: 20 }] } },
  { icon: 'flag', label: 'Unit Commander', group: 'Squad', desc: 'How you command units: selection, formation, turns', props: { name: 'Unit Commander', behaviors: [{ type: 'squadControl' }] } },
  { icon: 'sign', label: 'Quest Giver', group: 'Story', story: true, desc: 'An NPC that offers quests (! and ?) and takes them back', props: { name: 'Elder', y: 0.9, mesh: { geometry: 'capsule', r: 0.4, h: 1.8, color: '#7e57c2' }, body: { type: 'static' }, behaviors: [{ type: 'npc', portrait: '🧙', range: 3 }] } },
  { icon: 'sign', label: 'Villager', group: 'Story', story: true, desc: 'Tap to talk: a dialogue with choices', props: { name: 'Villager', y: 0.9, mesh: { geometry: 'capsule', r: 0.4, h: 1.8, color: '#8bc34a' }, body: { type: 'static' }, behaviors: [{ type: 'npc', dialogue: 'Villager', portrait: '🧑‍🌾', range: 3 }] } },
  { icon: 'sign', label: 'Signpost', group: 'Story', story: true, desc: 'Read it when you walk up', props: { name: 'Signpost', y: 0.6, mesh: { geometry: 'box', w: 0.8, h: 1.2, d: 0.15, color: '#a1887f' }, behaviors: [{ type: 'npc', dialogue: 'Signpost', start: 'player comes close', range: 2, markers: false, bubble: false, pause: false }] } },
];
const OBJECTS_2D = [
  { icon: 'gear', label: 'Empty', props: { name: 'GameObject' } },
  { icon: 'square', label: 'Square', props: { name: 'Square', shape: { type: 'rect', w: 60, h: 60, fill: '#4c8bd6' } } },
  { icon: 'circle', label: 'Circle', props: { name: 'Circle', shape: { type: 'circle', r: 30, fill: '#e57373' } } },
  { icon: 'triangle', label: 'Triangle', props: { name: 'Triangle', shape: { type: 'triangle', w: 60, h: 60, fill: '#9575cd' } } },
  { icon: 'star', label: 'Star', props: { name: 'Star', shape: { type: 'star', w: 60, h: 60, fill: '#ffca28' } } },
  { icon: 'heart', label: 'Heart', props: { name: 'Heart', shape: { type: 'heart', w: 50, h: 46, fill: '#ef5350' } } },
  { icon: 'gem', label: 'Diamond', props: { name: 'Diamond', shape: { type: 'diamond', w: 40, h: 56, fill: '#4dd0e1' } } },
  { icon: 'circle', label: 'Hexagon', props: { name: 'Hexagon', shape: { type: 'hexagon', w: 60, h: 60, fill: '#7e57c2' } } },
  { icon: 'circle', label: 'Ellipse', props: { name: 'Ellipse', shape: { type: 'ellipse', w: 80, h: 50, fill: '#26a69a' } } },
  { icon: 'square', label: 'Capsule', props: { name: 'Capsule', shape: { type: 'capsule', w: 90, h: 36, fill: '#5c6bc0' } } },
  { icon: 'circle', label: 'Ring', props: { name: 'Ring', shape: { type: 'ring', r: 30, fill: '#ffca28' } } },
  { icon: 'arrow', label: 'Arrow', props: { name: 'Arrow', shape: { type: 'arrow', w: 60, h: 40, fill: '#ffffff' } } },
  { icon: 'star', label: 'Cloud', props: { name: 'Cloud', shape: { type: 'cloud', w: 100, h: 60, fill: '#ffffff' } } },
  { icon: 'star', label: 'Sprite', props: { name: 'Sprite', sprite: { src: 'art:hero', w: 56, h: 56 } } },
  { icon: 'text', label: 'Text', props: { name: 'Text', text: { value: 'Hello', size: 32, color: '#ffffff' } } },
  { icon: 'hud', label: 'UI Text', props: { name: 'UI Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } } },
  { icon: 'image', label: 'Image', props: { name: 'Image', sprite: { src: '', w: 80, h: 80 } }, pickImage: true },
  { icon: 'camera', label: 'Camera', props: { name: 'Camera', behaviors: [{ type: 'camera', mode: 'follow', target: 'player', smooth: 6, zoom: 1, fov: 60, ox: 0, oy: 0, oz: 0, lookAhead: 0, deadZone: 0, bounds: 'none', priority: 0 }] } },
  { icon: 'bulb', label: 'Light', props: { name: 'Light', light: { color: '#ffd9a0', intensity: 1, range: 160 } } },
  { icon: 'bulb', label: 'Spotlight', props: { name: 'Spotlight', light: { color: '#fff3c4', intensity: 1.2, range: 260, type: 'spot', cone: 50, aim: 90, shadows: true } } },
  { icon: 'bulb', label: 'Torch (fire light)', props: { name: 'Torch', shape: { type: 'emoji', emoji: '🔥', w: 30, h: 30 }, light: { color: '#ffb35c', intensity: 1, range: 180, effect: 'fire', shadows: true } } },
  { icon: 'sun', label: 'Global Light 2D', props: { name: 'Global Light 2D', globalLight: { brightness: 1, color: '#0a0a1e' } } },
  { icon: 'grid', label: 'Tilemap', props: { name: 'Tilemap', x: 0, y: 520, tiles: { size: 40, palette: TILE_PALETTE.map((t) => ({ ...t })), cells: Object.fromEntries([...Array(10)].map((_, i) => [i + ',0', 1])) } }, tilemap: true },
];
const ROUND_2D = ['circle', 'ring', 'ellipse'];
for (const o of OBJECTS_2D) { const sh = o.props.shape; if (sh && sh.type !== 'emoji' && sh.type !== 'cloud' && !o.props.body) o.props.collider = { shape: ROUND_2D.includes(sh.type) ? 'circle' : 'box' }; } // like Unity's 2D primitives
const OBJECTS_3D = [
  { icon: 'gear', label: 'Empty', props: { name: 'GameObject' } },
  { icon: 'grid', label: 'Voxel World', props: { name: 'Voxel World', y: 0, voxels: { size: 1, gen: { type: 'hills', w: 24, d: 24, h: 5, seed: 1, trees: true }, edits: {} } } },
  { icon: 'grid', label: 'Empty Voxels', props: { name: 'Voxel Build', y: 0, voxels: { size: 1, gen: { type: 'flat', w: 16, d: 16, h: 1, seed: 1, trees: false }, edits: {} } } },
  { icon: 'cube', label: 'Cube', props: { name: 'Cube', mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#4c8bd6' } } },
  { icon: 'cube', label: 'Empty Model', props: { name: 'Model', model: { parts: [{ geometry: 'box', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, color: '#90caf9' }] } } },
  { icon: 'sphere', label: 'Sphere', props: { name: 'Sphere', mesh: { geometry: 'sphere', r: 0.5, color: '#e57373' } } },
  { icon: 'cylinder', label: 'Cylinder', props: { name: 'Cylinder', mesh: { geometry: 'cylinder', r: 0.5, h: 1, color: '#9575cd' } } },
  { icon: 'cone', label: 'Cone', props: { name: 'Cone', mesh: { geometry: 'cone', r: 0.5, h: 1, color: '#ffca28' } } },
  { icon: 'player', label: 'Capsule', props: { name: 'Capsule', mesh: { geometry: 'capsule', w: 0.6, h: 1.2, d: 0.6, color: '#4db6ac' } } },
  { icon: 'triangle', label: 'Pyramid', props: { name: 'Pyramid', mesh: { geometry: 'pyramid', w: 1, h: 1, d: 1, color: '#ffb74d' } } },
  { icon: 'plane', label: 'Ramp', props: { name: 'Ramp', mesh: { geometry: 'wedge', w: 2, h: 1, d: 2, color: '#a1887f' }, body: { type: 'static' } } },
  { icon: 'triangle', label: 'Prism', props: { name: 'Prism', mesh: { geometry: 'prism', w: 1, h: 1, d: 1, color: '#9575cd' } } },
  { icon: 'star', label: 'Gem', props: { name: 'Gem', mesh: { geometry: 'gem', w: 0.6, h: 1, d: 0.6, color: '#4dd0e1', emissive: 0.3 } } },
  { icon: 'circle', label: 'Dome', props: { name: 'Dome', mesh: { geometry: 'dome', w: 1.5, h: 0.75, d: 1.5, color: '#e57373' } } },
  { icon: 'circle', label: 'Torus', props: { name: 'Torus', mesh: { geometry: 'torus', w: 1, h: 1, d: 1, color: '#f06292' } } },
  { icon: 'plane', label: 'Plane', props: { name: 'Plane', y: 0.01, mesh: { geometry: 'plane', w: 4, d: 4, color: '#8d8d9a' } } },
  { icon: 'hud', label: 'UI Text', props: { name: 'UI Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } } },
  { icon: 'camera', label: 'Camera', props: { name: 'Camera', y: 4, z: 8, behaviors: [{ type: 'camera', mode: 'follow', target: 'player', smooth: 6, zoom: 1, fov: 60, ox: 0, oy: 7, oz: 11, lookAhead: 0, deadZone: 0, bounds: 'none', priority: 0 }] } },
  { icon: 'bulb', label: 'Light', props: { name: 'Light', y: 2, light: { color: '#ffd9a0', intensity: 1.5, range: 8 } } },
  { icon: 'bulb', label: 'Spotlight', props: { name: 'Spotlight', y: 4, light: { color: '#fff3c4', intensity: 2.5, range: 10, type: 'spot', cone: 50, tilt: 90 } } },
  { icon: 'bulb', label: 'Lamp', props: { name: 'Lamp', model: { parts: [{ geometry: 'cylinder', x: 0, y: 1, z: 0, r: 0.06, h: 2, color: '#455a64' }, { geometry: 'sphere', x: 0, y: 2.1, z: 0, r: 0.22, color: '#fff3c4', emissive: 1 }] }, light: { color: '#ffd9a0', intensity: 1.6, range: 7 } } },
  { icon: 'sun', label: 'Directional Light', props: { name: 'Directional Light', y: 6, rx: 50, ry: -30, sun: { color: '#fff4e0', intensity: 1, ambient: 0.45, shadows: true } } },
];
for (const o of OBJECTS_3D) { const m = o.props.mesh; if (m && !o.props.body) o.props.collider = { shape: m.geometry === 'sphere' ? 'sphere' : 'box' }; } // Unity's 3D primitives come with colliders

let projectTab = 'prefabs';
function renderProject() {
  const box = $('#project');
  box.replaceChildren();
  const tabs = [['prefabs', 'Prefabs', 'folder'], ['objects', 'Objects', 'folder'], is3D() ? ['models', 'Models', 'cube'] : ['sprites', 'Sprites', 'star'], ['ui', 'UI', 'hud'], ['sounds', 'Sounds', 'bolt'], ['components', 'Components', 'folder']];
  if (!tabs.some((t) => t[0] === projectTab)) projectTab = 'prefabs';
  box.append(h('div', { class: 'p-tabs' }, tabs.map(([k, l, ic]) => h('button', { class: projectTab === k ? 'active' : '', onclick: () => { projectTab = k; renderProject(); } }, icon(ic), l))));
  box.append(h('div', { class: 'p-path' }, `Assets › ${tabs.find((t) => t[0] === projectTab)[1]}`));
  if (projectTab === 'sounds') { box.append(...soundsTab()); return; }
  let items;
  if (projectTab === 'components') {
    items = componentsFor(null).filter((c) => c.ok({})).map((c) => ({ icon: c.icon, label: c.label, payload: { kind: 'component', key: c.key, label: c.label, icon: c.icon }, comp: true }));
  } else {
    const src = projectTab === 'prefabs' ? (is3D() ? PREFABS_3D : PREFABS_2D)
      : projectTab === 'models' ? MODELS_3D.map((m) => ({ icon: m.icon, label: m.label, props: { name: m.label, y: 0, model: { parts: clone(m.parts) } } }))
        : projectTab === 'sprites' ? Object.entries(SPRITE_GROUPS).flatMap(([cat, list]) => list.map((k) => { const nm = k.replace(/^ui-/, '').replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()); return { art: 'art:' + k, label: nm, group: cat, props: { name: nm, ...(k.startsWith('ui-') || frameSlice('art:' + k) ? { ui: true, anchor: 'center', x: 0, y: 0 } : {}), sprite: frameSlice('art:' + k) ? { src: 'art:' + k, w: k.startsWith('btn') ? 180 : 260, h: k.startsWith('btn') ? 64 : 180, slice: frameSlice('art:' + k) } : { src: 'art:' + k, w: k.startsWith('ui-') ? 40 : 56, h: k.startsWith('ui-') ? 40 : 56 } } }; }))
          : projectTab === 'ui' ? UI_WIDGETS : (is3D() ? OBJECTS_3D : OBJECTS_2D);
    items = src.map((o) => ({ icon: o.icon, emoji: o.emoji, art: o.art, group: o.group, label: o.label, payload: { kind: 'prefab', def: o, label: o.emoji ? `${o.emoji} ${o.label}` : o.label, icon: o.icon || 'image' } }));
  }
  const mine = projectTab === 'prefabs' ? userPrefabs().filter((p) => !!p.entities[0].ui === !!uiMode || !uiMode) : [];
  if (projectTab !== 'components') box.append(h('button', { class: 'btn primary p-create', onclick: () => openCreate({ prefabs: 'gameplay', objects: 'objects', sprites: 'sprites', ui: 'ui', models: 'models' }[projectTab]) }, icon('plus'), 'Open the Create screen'));
  if (projectTab === 'prefabs' && mine.length) {
    box.append(h('div', { class: 'p-sec' }, 'My Prefabs'));
    box.append(h('div', { class: 'tiles' }, mine.map((pf) => {
      const t = h('div', { class: 'tile mine' }, h('div', { class: 'th' }, icon(iconFor(pf.entities[0]))), h('div', { class: 'lb' }, pf.name),
        h('button', { class: 'tile-more', title: 'Prefab options', onpointerdown: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); prefabAssetMenu(pf, e.currentTarget); } }, icon('more')));
      draggable(t, { kind: 'prefab', def: { userPrefab: pf.id, label: pf.name }, label: pf.name, icon: iconFor(pf.entities[0]) });
      return t;
    })));
    box.append(h('div', { class: 'p-sec' }, 'Built-in'));
  }
  const tileOf = (it) => {
    const t = h('div', { class: 'tile' + (it.comp ? ' comp-tile' : '') }, it.art ? h('div', { class: 'th art' + (it.art.startsWith('art:ui-') ? ' uiic' : '') }, h('img', { src: artURL(it.art), alt: '' })) : it.emoji ? h('div', { class: 'th emo' }, it.emoji) : h('div', { class: 'th' }, icon(it.icon)), h('div', { class: 'lb' }, it.label));
    draggable(t, it.payload);
    return t;
  };
  const groups = [...new Set(items.map((it) => it.group).filter(Boolean))].sort((a, b) => (UI_GROUPS.indexOf(a) + 99) % 99 - (UI_GROUPS.indexOf(b) + 99) % 99);
  if (groups.length > 1) for (const g of groups) box.append(h('div', { class: 'p-sec' }, g), h('div', { class: 'tiles' }, items.filter((it) => it.group === g).map(tileOf)));
  else box.append(h('div', { class: 'tiles' }, items.map(tileOf)));
  box.append(h('p', { class: 'p-note' }, projectTab === 'components'
    ? 'Drag a component onto an object in the Scene or Hierarchy, or tap to add it to the selected object.'
    : 'Drag into the Scene to place, or tap to add at the center of the view.' + (projectTab === 'prefabs' && !mine.length ? ' Make your own prefabs: long-press an object (or its ⋯ menu) and pick Make Prefab.' : '')));
}

// ---- drag & drop ----
let dnd = null, dropHoverId = null;
const ghost = $('#dragGhost');
function draggable(el, payload) {
  el.addEventListener('pointerdown', (e) => {
    if (playing || e.button > 0) return;
    dnd = { payload, el, id: e.pointerId, sx: e.clientX, sy: e.clientY, started: false, cancelled: false };
    dnd.timer = setTimeout(() => { if (dnd && !dnd.cancelled) startDrag(e.clientX, e.clientY); }, 220); // press & hold to pick up
  });
}
function startDrag(x, y) {
  dnd.started = true;
  clearTimeout(dnd.timer);
  try { dnd.el.setPointerCapture(dnd.id); } catch { /* pointer already gone */ }
  ghost.replaceChildren(icon(dnd.payload.icon), dnd.payload.label);
  ghost.hidden = false;
  buzz(10);
  moveDrag(x, y);
}
function moveDrag(x, y) {
  ghost.style.left = x + 'px'; ghost.style.top = y + 'px';
  const r = surface.getBoundingClientRect();
  dnd.overScene = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  dnd.lx = x - r.left; dnd.ly = y - r.top;
  let hover = null;
  for (const row of $$('.h-row.drop')) row.classList.remove('drop');
  if (dnd.payload.kind === 'component') {
    if (dnd.overScene) hover = pick(dnd.lx, dnd.ly)?.id || null;
    else {
      const row = document.elementFromPoint(x, y)?.closest('.h-row[data-id]');
      if (row) { row.classList.add('drop'); hover = row.dataset.id; }
    }
  }
  dropHoverId = hover;
}
window.addEventListener('pointermove', (e) => {
  if (!dnd || e.pointerId !== dnd.id) return;
  if (!dnd.started) {
    const d = Math.hypot(e.clientX - dnd.sx, e.clientY - dnd.sy);
    if (d > 10) { dnd.cancelled = true; clearTimeout(dnd.timer); } // finger moved first: it's a scroll
    return;
  }
  moveDrag(e.clientX, e.clientY);
});
// While dragging, stop the panel from scrolling under the finger.
document.addEventListener('touchmove', (e) => { if (dnd?.started) e.preventDefault(); }, { passive: false });
function endDrag(e, cancelled) {
  if (!dnd || e.pointerId !== dnd.id) return;
  const d = dnd; dnd = null;
  clearTimeout(d.timer);
  ghost.hidden = true;
  for (const row of $$('.h-row.drop')) row.classList.remove('drop');
  const target = dropHoverId; dropHoverId = null;
  if (cancelled) return;
  if (!d.started) { if (!d.cancelled) tapPayload(d.payload); return; }
  const insp = document.elementFromPoint(e.clientX, e.clientY)?.closest('#inspectorPanel');
  if (d.payload.kind === 'component') {
    const id = target || (insp ? selectedId : null);
    if (id && id !== SCENE_ID) addComponentTo(id, d.payload.key);
    else toast('Drop components onto an object');
  } else if (d.overScene) {
    placePrefab(d.payload.def, d.lx, d.ly);
  }
}
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

function tapPayload(p) {
  if (p.kind === 'component') {
    if (!ent(selectedId)) { toast('Select an object first, or drag the component onto one'); return; }
    addComponentTo(selectedId, p.key);
  } else addPrefab(p.def);
}

// ============================================================================
// Creating objects
// ============================================================================
function addEntity(props, at) {
  const s = engine.scene, j = { id: uid(), ...clone(props) };
  if (!j.ui) {
    if (is3D()) {
      const p = at || orbit.target;
      j.x = snapV(p.x, 0.5); j.z = snapV(p.z, 0.5); j.y ??= 0.5;
    } else {
      const p = at || { x: s.camera.x, y: s.camera.y };
      j.x = snapV(p.x, 10); j.y = snapV(p.y, 10);
    }
  }
  let n = 1; const base = j.name;
  while (project.entities.some((e) => e.name === j.name)) j.name = `${base} (${n++})`;
  project.entities.push(j);
  selectedId = j.id;
  changed({ structure: true }); pushHistory();
  closeLayer();
  return j;
}
function addPrefab(def, at) {
  if (def.userPrefab) { instantiatePrefab(def.userPrefab, at); return; }
  if (def.scene) {
    if (def.scene.gravity != null && !project.gravity) project.gravity = def.scene.gravity;
    Object.assign(project.settings, def.scene.settings || {});
    if (def.scene.light && !(project.light?.darkness > 0)) project.light = { ...(project.light || {}), ...def.scene.light };
  }
  if (def.props.behaviors?.some((b) => b.type === 'hazard') && project.vars.lives == null) project.vars.lives = 3;
  if (def.vars) for (const [k, v] of Object.entries(def.vars)) project.vars[k] ??= v;
  if (def.items) ensureStarterItems(); // crafting presets: an empty game gets starter items and recipes
  if (def.story) ensureStarterStory(); // NPC presets and quest UI: an empty game gets the starter story
  if (def.data) { // app widgets: the game needs a data collection, and the widget points at one that exists
    const name = ensureCollection(def.data === true ? 'Tasks' : def.data), have = new Set((root.collections || []).map((c) => c.name.toLowerCase()));
    def = { ...def, props: JSON.parse(JSON.stringify(def.props)) };
    for (const b of def.props.behaviors || []) if (b.collection && !have.has(String(b.collection).toLowerCase())) b.collection = name;
  }
  if (def.settings) for (const [k, v] of Object.entries(def.settings)) if (!project.settings[k]) project.settings[k] = v;
  if (def.forceSettings) Object.assign(project.settings, def.forceSettings); // e.g. custom touch controls replace the built-in joystick
  for (const x of def.extra || []) {
    if (project.entities.some((e) => e.name === x.name)) continue;
    const { offset, ...props } = x;
    const base = at || (is3D() ? orbit.target : { x: engine.scene.camera.x, y: engine.scene.camera.y });
    addEntity(props, props.ui ? undefined : { x: (base.x || 0) + (offset?.x || 0), y: (base.y || 0) + (offset?.y || 0), z: base.z || 0 });
  }
  const addTree = (props, parent, where) => { // an element and everything inside it
    const { children, offset, ...rest } = props;
    const base = where || (is3D() ? orbit.target : { x: engine.scene.camera.x, y: engine.scene.camera.y });
    const k = addEntity({ ...rest, ...(parent ? { parent } : {}) }, rest.ui || parent ? undefined : { x: (base.x || 0) + (offset?.x || 0), y: (base.y || 0) + (offset?.y || 0), z: base.z || 0 });
    for (const c of children || []) addTree({ ui: rest.ui, ...c }, k.id);
    return k;
  };
  for (const b of def.before || []) addTree(b, null, at);
  const kids = def.children || def.props.children; // children can sit on the widget or inside its props
  const j = kids ? addTree({ ...def.props, children: kids }, null, at) : addEntity(def.props, at);
  for (const a of def.after || []) addTree(a, null, at); // drawn above the main element (e.g. a Next button under a pager)
  if (kids || def.before || def.after) { selectedId = j.id; changed({ structure: true }); }
  if (def.note) setTimeout(() => tipOnce('note-' + (def.label || ''), def.note, 1), 900); // a widget explains itself the first time you add it
  if (def.pickImage) pickImage((url) => { const e = ent(j.id); if (e?.sprite) { e.sprite.src = url; changed({ inspector: true }); } });
  if (def.tilemap) { // centre the starter row under the drop point and get ready to paint
    const sz = j.tiles.size; j.x = Math.round((j.x - 5 * sz) / sz) * sz; j.y = Math.round((j.y + 2 * sz) / sz) * sz;
    tileBrush.mode = 'paint'; tileBrush.tile = 1; changed({ structure: true }); setTool('paint');
    toast('Tilemap added: drag on the Scene to paint tiles'); return;
  }
  toast(`Added ${j.name}`);
}
function placePrefab(def, sx, sy) {
  const s = engine.scene;
  if (def.props?.ui || (def.userPrefab && userPrefabs().find((p) => p.id === def.userPrefab)?.entities[0].ui)) { addPrefab(def); return; }
  if (is3D()) {
    const hit = rayPlaneY(engine.renderer.screenRay(s, sx, sy), 0);
    addPrefab(def, hit ? { x: hit.x, z: hit.z } : undefined);
  } else addPrefab(def, engine.renderer.screenToWorld(s, sx, sy));
}

// ---- Prefabs (Unity-style): an object saved once; its copies in every level update together ----
/** Per-copy fields: everything else comes from the prefab. */
const OVERRIDES = ['id', 'name', 'x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz', 'parent', 'folder', 'prefab', 'locked', 'visible', 'anchor'];
const userPrefabs = () => (root.prefabs ||= []);
const prefabOf = (j) => (j?.prefab ? userPrefabs().find((p) => p.id === j.prefab) : null);
/** An object and its children in prefab form: root 'r', children 'c1', 'c2'… with per-copy fields left out of the root. */
function prefabSnapshot(id) {
  const ids = subtree(id), local = new Map(ids.map((x, i) => [x, i ? 'c' + i : 'r']));
  return ids.map((x, i) => {
    const c = clone(ent(x)); c.id = local.get(x);
    if (i === 0) { for (const k of OVERRIDES) if (k !== 'id') delete c[k]; }
    else { c.parent = local.get(c.parent) || 'r'; delete c.prefab; }
    return c;
  });
}
/** Rebuild one copy from its prefab, keeping its own position, name and other per-copy fields. */
function syncInstance(inst, pf, lv) {
  const L = lv.entities, inLevel = (q) => L.find((e) => e.id === q);
  const old = new Set(); const walk = (pid) => { for (const e of L) if (e.parent === pid) { old.add(e.id); walk(e.id); } }; walk(inst.id);
  lv.entities = L.filter((e) => !old.has(e.id));
  const keep = {}; for (const k of OVERRIDES) if (inst[k] !== undefined) keep[k] = inst[k];
  for (const k of Object.keys(inst)) delete inst[k];
  const [r, ...kids] = clone(pf.entities); delete r.id;
  Object.assign(inst, r, keep);
  const map = new Map(kids.map((c) => [c.id, uid()])); map.set('r', inst.id);
  const copies = kids.map((c) => ({ ...c, id: map.get(c.id), parent: map.get(c.parent) || inst.id }));
  lv.entities.splice(lv.entities.indexOf(inLevel(inst.id) || inst) + 1, 0, ...copies);
}
/** Rotation, scale and anchor a new copy starts with (each copy can change its own). */
const prefabBase = (j) => Object.fromEntries(['rx', 'ry', 'rz', 'sx', 'sy', 'sz', 'anchor'].filter((k) => j[k] !== undefined).map((k) => [k, j[k]]));
function eachInstance(pid, fn) { for (const lv of levelList()) for (const e of [...lv.entities]) if (e.prefab === pid) fn(e, lv); }
function makePrefab(id) {
  const j = ent(id); if (!j) return;
  if (j.prefab) { toast(`${j.name} is already a copy of a prefab`); return; }
  const pf = { id: uid('pf'), name: j.name || 'Prefab', entities: prefabSnapshot(id), base: prefabBase(j) };
  userPrefabs().push(pf); j.prefab = pf.id;
  changed({ structure: true }); pushHistory(); renderProject();
  toast(`Saved “${pf.name}” as a prefab. Find it in Project › Prefabs.`);
}
function applyPrefab(id) {
  const j = ent(id), pf = prefabOf(j); if (!pf) return;
  pf.entities = prefabSnapshot(id); pf.base = prefabBase(j);
  let n = 0; eachInstance(pf.id, (e, lv) => { if (e !== j) { syncInstance(e, pf, lv); n++; } });
  changed({ structure: true }); pushHistory(); renderProject();
  toast(n ? `Updated the prefab and ${n} other cop${n === 1 ? 'y' : 'ies'}` : 'Updated the prefab');
}
function revertPrefab(id) {
  const j = ent(id), pf = prefabOf(j); if (!pf) return;
  syncInstance(j, pf, project);
  changed({ structure: true }); pushHistory(); toast('Back to the prefab');
}
function unpackPrefab(id) { const j = ent(id); if (!j) return; delete j.prefab; changed({ structure: true }); pushHistory(); toast(`${j.name} is now a plain object`); }
/** Same content regardless of key order. */
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((q) => [q, x[q]])) : x));
const prefabChanged = (j) => { const pf = prefabOf(j); return !!pf && canon(prefabSnapshot(j.id)) !== canon(pf.entities); };
/** Place a new copy of a prefab. */
function instantiatePrefab(pid, at) {
  const pf = userPrefabs().find((p) => p.id === pid); if (!pf) return;
  const r = pf.entities[0], j = addEntity({ name: pf.name, prefab: pid, ...(pf.base || {}), ...(r.ui ? { ui: true, x: 0, y: 0 } : {}) }, at);
  if (!at && !j.ui) { // don't stack a new copy exactly on another one
    const step = is3D() ? 1.5 : 40, taken = (q) => project.entities.some((e) => e !== j && e.prefab === pid && Math.abs((e.x || 0) - q.x) < step / 2 && Math.abs((is3D() ? e.z || 0 : e.y || 0) - (is3D() ? q.z : q.y)) < step / 2);
    for (let n = 0; n < 40 && taken(j); n++) { j.x = (j.x || 0) + step; if (is3D()) j.z = j.z || 0; }
  }
  syncInstance(j, pf, project); j.name = pf.name; // copies share the prefab's name (the Hierarchy folds them into one row)
  changed({ structure: true }); pushHistory(); toast(`Added ${pf.name}`);
}
function prefabAssetMenu(pf, anchor) {
  let count = 0; eachInstance(pf.id, () => count++);
  popMenu(anchor, [
    { cap: `${pf.name} · ${count} cop${count === 1 ? 'y' : 'ies'}` },
    { icon: 'plus', label: 'Add a Copy', fn: () => instantiatePrefab(pf.id) },
    { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Prefab name', pf.name); if (!n?.trim()) return; pf.name = n.trim(); changed(); renderProject(); } },
    { icon: 'trash', label: 'Delete Prefab', fn: () => {
      if (!confirm(`Delete the prefab “${pf.name}”? Its ${count} cop${count === 1 ? 'y stays' : 'ies stay'} as plain objects.`)) return;
      eachInstance(pf.id, (e) => delete e.prefab); root.prefabs = userPrefabs().filter((p) => p !== pf);
      changed({ structure: true }); pushHistory(); renderProject();
    } },
  ]);
}
/** Inspector banner on a prefab copy. */
function prefabBanner(j) {
  const pf = prefabOf(j); if (!pf) return null;
  const dirty = prefabChanged(j); let count = 0; eachInstance(pf.id, () => count++);
  return h('div', { class: 'pf-banner' + (dirty ? ' dirty' : '') },
    h('div', { class: 'pf-t' }, icon('cube'), h('span', {}, h('b', {}, pf.name), h('small', {}, dirty ? 'Changed here — apply to update every copy' : `Prefab · ${count} cop${count === 1 ? 'y' : 'ies'}`))),
    h('div', { class: 'pf-acts' },
      h('button', { class: 'btn' + (dirty ? ' primary' : ''), disabled: !dirty, onclick: () => applyPrefab(j.id) }, icon('upload'), 'Apply to all'),
      h('button', { class: 'btn', disabled: !dirty, onclick: () => revertPrefab(j.id) }, icon('undo'), 'Revert'),
      h('button', { class: 'btn', title: 'More', onclick: (ev) => popMenu(ev.currentTarget, [
        { icon: 'list', label: 'Select All Copies', fn: () => { const ids = []; eachInstance(pf.id, (e, lv) => { if (lv === project) ids.push(e.id); }); multi = new Set(ids); setDock('hierarchy'); renderHierarchy(); } },
        { icon: 'unlink', label: 'Unpack (make a plain object)', fn: () => unpackPrefab(j.id) },
      ]) }, icon('more'))));
}

function duplicateEntity(id) {
  const j = ent(id); if (!j) return;
  const ids = subtree(id), map = new Map(ids.map((x) => [x, uid()])); // copies children too
  const copies = ids.map((x) => { const c = clone(ent(x)); c.id = map.get(x); if (c.parent && map.has(c.parent)) c.parent = map.get(c.parent); return c; });
  const c = copies[0]; c.name = (j.name || 'Object') + ' (copy)';
  if (j.ui) c.y = (c.y || 0) + 30; else if (is3D()) c.x = (c.x || 0) + 1.5; else { c.x = (c.x || 0) + 30; c.y = (c.y || 0) + 30; }
  project.entities.splice(project.entities.indexOf(j) + ids.length, 0, ...copies);
  selectedId = c.id;
  changed({ structure: true }); pushHistory();
}
function deleteEntity(id) {
  const j = ent(id); if (!j) return;
  const ids = new Set(subtree(id)); // children go with their parent
  project.entities = project.entities.filter((e) => !ids.has(e.id));
  if (ids.has(selectedId)) selectedId = null;
  changed({ structure: true }); pushHistory(); updateCtxBar();
  toast(ids.size > 1 ? `Deleted ${j.name} and ${ids.size - 1} child object${ids.size > 2 ? 's' : ''}. Undo to restore.` : `Deleted ${j.name}. Undo to restore.`);
}

// ---- Sounds (Unity AudioClips): imported files, usable everywhere a sound is picked ----
const BUILTIN_SOUNDS = SOUNDS.slice();
/** Keep the engine's shared sound list (every Sound picker) in step with this project's imported sounds. */
function syncSoundNames() { SOUNDS.splice(0, SOUNDS.length, ...BUILTIN_SOUNDS, ...Object.keys(root.sounds || {})); engine.audio.clips = { ...(root.sounds || {}) }; }
function previewSound(name) { engine.audio.unlock(); engine.audio.sfx(name); buzz(4); }
function importSound() {
  const fi = $('#fileInput');
  fi.accept = 'audio/*';
  fi.onchange = () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    if (f.size > 600 * 1024 && !confirm(`${f.name} is ${Math.round(f.size / 1024)} KB. Big sounds fill up the phone's project storage. Use it anyway? (Short clips under 200 KB work best.)`)) return;
    const rd = new FileReader();
    rd.onload = () => {
      let base = f.name.replace(/\.[^.]+$/, '').replace(/[^\w -]+/g, '').trim().slice(0, 24) || 'sound', name = base, n = 2;
      while (SOUNDS.includes(name)) name = `${base} ${n++}`;
      (root.sounds ||= {})[name] = rd.result;
      syncSoundNames(); changed({ structure: true }); pushHistory(); renderProject(); previewSound(name);
      toast(`Imported “${name}”. Pick it in any Sound setting.`);
    };
    rd.readAsDataURL(f);
  };
  fi.click();
}
function soundsTab() {
  const mine = Object.keys(root.sounds || {});
  const row = (name, own) => h('div', { class: 'snd-row' },
    h('button', { class: 'snd-play', title: 'Play', onclick: () => previewSound(name) }, icon('play')),
    h('span', { class: 'snd-nm' }, name, h('small', {}, own ? `${Math.round((root.sounds[name].length * 3) / 4 / 1024)} KB · imported` : 'built-in')),
    own && h('button', { class: 'eye', title: 'Sound options', onclick: (ev) => popMenu(ev.currentTarget, [
      { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Sound name', name)?.trim(); if (!n || n === name) return; if (SOUNDS.includes(n)) { toast('That name is taken'); return; }
        root.sounds = Object.fromEntries(Object.entries(root.sounds).map(([k, v]) => [k === name ? n : k, v])); renameSoundUses(name, n); syncSoundNames(); changed({ structure: true }); pushHistory(); renderProject(); } },
      { icon: 'trash', label: 'Delete', fn: () => { if (!confirm(`Delete “${name}”? Anything that plays it goes quiet.`)) return; delete root.sounds[name]; syncSoundNames(); changed({ structure: true }); pushHistory(); renderProject(); } },
    ]) }, icon('more')));
  return [
    h('div', { class: 'snd-tools' }, h('button', { class: 'btn primary', onclick: importSound }, icon('download'), 'Import Sound'),
      h('p', { class: 'p-note' }, 'MP3, WAV, OGG or M4A from your phone. Then choose it in a Sound component, a Play Sound action or node, or from code with s.engine.audio.sfx("name").')),
    h('div', { class: 'p-sec' }, 'My Sounds'),
    mine.length ? h('div', { class: 'snd-list' }, mine.map((n) => row(n, true))) : h('p', { class: 'p-note' }, 'No imported sounds yet.'),
    h('div', { class: 'p-sec' }, 'Built-in'),
    h('div', { class: 'snd-list' }, BUILTIN_SOUNDS.map((n) => row(n, false))),
  ];
}
/** Point every Sound setting that used the old name at the new one. */
function renameSoundUses(from, to) {
  const fix = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k === 'sound' && v === from) o[k] = to; else if (v && typeof v === 'object') fix(v); } };
  for (const lv of levelList()) fix(lv.entities);
}

function pickImage(cb, max = 256) {
  const fi = $('#fileInput');
  fi.accept = 'image/*';
  fi.onchange = () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { // downscale so projects fit in local storage
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/png'));
    };
    img.src = url;
  };
  fi.click();
}

// ============================================================================
// Menus & dialogs
// ============================================================================
const layer = $('#menuLayer');
function closeLayer() { layer.hidden = true; layer.className = ''; layer.replaceChildren(); dropBack(layerBack); }

// Phone back button / back gesture closes the open dialog, Node Editor or Home menu instead of leaving the page.
const backStack = [];
let skipPops = 0, owedPushes = 0;
const pushEntry = () => { try { window.history.pushState({ pocket: 1 }, ''); } catch { /* sandboxed */ } };
function pushBack(fn) {
  if (backStack.includes(fn)) return;
  backStack.push(fn);
  if (skipPops) owedPushes++; else pushEntry(); // wait for a pending history.back() to land first
}
function dropBack(fn) { const i = backStack.lastIndexOf(fn); if (i < 0) return; backStack.splice(i, 1); if (owedPushes) { owedPushes--; return; } skipPops++; window.history.back(); }
window.addEventListener('popstate', () => {
  if (skipPops) { if (--skipPops === 0) for (; owedPushes > 0; owedPushes--) pushEntry(); return; }
  const fn = backStack.pop(); if (fn) fn();
});
const layerBack = () => closeLayer();
layer.addEventListener('pointerdown', (e) => { if (e.target === layer) closeLayer(); });

/** Dropdown menu under an element. items: {icon,label,fn,k} | '-' | {cap} */
function popMenu(anchor, items) {
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const m = h('div', { class: 'menu' }, items.filter(Boolean).map((it) => it === '-' ? h('hr') : it.cap ? h('div', { class: 'cap' }, it.cap)
    : h('button', { onclick: () => { closeLayer(); it.fn(); } }, it.icon ? icon(it.icon) : h('span', { style: 'width:16px' }), it.label, it.k && h('span', { class: 'k' }, it.k))));
  layer.replaceChildren(m); layer.className = ''; layer.hidden = false;
  if (anchor.guard) { // opened by a long-press: the finger lifting must not tap a menu item
    layer.style.pointerEvents = 'none';
    const release = () => setTimeout(() => { layer.style.pointerEvents = ''; }, 80);
    window.addEventListener('pointerup', release, { once: true });
    window.addEventListener('pointercancel', release, { once: true });
    setTimeout(() => { layer.style.pointerEvents = ''; }, 1500);
  }
  if (phoneSheets()) { // phones: a full-width action sheet at the bottom, easy to reach with a thumb
    m.classList.add('sheet'); layer.className = 'dim';
    m.append(h('button', { class: 'cancel', onclick: closeLayer }, 'Cancel'));
    pushBack(layerBack);
    return;
  }
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, window.innerWidth - mw - 8), y = r.bottom + 2;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 2);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
}
/** Phone-sized portrait screen: menus and dialogs come up from the bottom. */
const phoneSheets = () => window.innerWidth < 700 && window.innerHeight > window.innerWidth;
function openDialog(title, kids) {
  const d = h('div', { class: 'dialog' + (phoneSheets() ? ' sheet' : '') }, h('div', { class: 'dh' }, h('span', {}, title), h('button', { onclick: closeLayer, title: 'Close' }, icon('close'))), h('div', { class: 'db' }, kids));
  layer.replaceChildren(d); layer.className = 'dim'; layer.hidden = false;
  pushBack(layerBack);
}

function openFileMenu() {
  popMenu($('#fileBtn'), [
    { icon: 'home', label: 'Home', fn: showHome },
    { icon: 'newfile', label: 'New Game or App…', fn: openNewDialog },
    { icon: 'folder', label: 'Open Project…', fn: openProjectsDialog },
    { icon: 'undo', label: 'Undo', k: '2-finger tap', fn: () => undoRedo(-1) },
    { icon: 'redo', label: 'Redo', k: '3-finger tap', fn: () => undoRedo(1) },
    '-',
    { icon: 'save', label: 'Save', k: 'auto', fn: () => { saveNow(); toast('Saved'); } },
    { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Project name', root.name); if (n) { root.name = n; changed(); refreshAll(); } } },
    { icon: 'copy', label: 'Duplicate Project', fn: () => { const c = clone(root); c.name += ' (copy)'; openProject(c); toast('Project duplicated'); } },
    { icon: 'layers', label: 'Levels…', fn: openLevelMenu },
    { icon: 'key', label: 'Tags & Layers…', fn: openTagsLayers },
    { icon: 'warn', label: 'Find Problems…', k: 'all levels', fn: openProblems },
    { icon: 'save', label: 'Save Data…', k: 'play saves', fn: () => openSaveData() },
    '-',
    { icon: 'gear', label: 'Scene Settings', fn: () => { select(SCENE_ID); if (!isDesktop()) setDock('inspector'); } },
    { icon: 'play', label: 'Play', fn: play },
    { icon: 'download', label: 'Build HTML', k: 'offline file', fn: exportHTML },
    { icon: 'download', label: 'Build Web App (.zip)', k: 'for a website', fn: exportWebApp },
    { icon: 'gear', label: 'Build Settings…', fn: openBuildSettings },
    '-',
    { icon: 'clock', label: 'Restore Earlier Version…', fn: openRestorePoints },
    { icon: 'save', label: 'Back Up All Games', k: 'one file', fn: backupAll },
    { icon: 'upload', label: 'Restore Backup / Import…', fn: importJSON },
    { icon: 'download', label: 'Export This Project (.json)', fn: () => download(slug(root.name) + '.json', JSON.stringify(root, null, 2), 'application/json') },
    '-',
    !matchMedia('(display-mode: standalone)').matches && { icon: 'download', label: 'Install App', k: 'works offline', fn: installApp },
    { icon: 'gear', label: 'Preferences…', k: 'editor & app', fn: openPreferences },
    { icon: 'bulb', label: 'Quick Tour', fn: () => openTour(0) },
    { icon: 'help', label: 'Documentation', k: 'guides & reference', fn: () => openDocs('') },
    { icon: 'help', label: 'Controls', fn: openHelp },
    { icon: 'external', label: 'Examples', fn: () => { location.href = '../'; } },
  ]);
}

const TPL_COLORS = { 'tap-frenzy': '#16233b', 'sky-dodge': '#22314f', 'jump-quest': '#2d3f6b', 'gem-garden': '#3f6d4a', 'empty-2d': '#2b2b2b', 'empty-3d': '#2f3a44' };
/** Game types to start from, split into 2D and 3D (Blank first) with a switch between them. */
function typeCards(onPick) {
  let mode = ['3d', 'app'].includes(store.get('pocket.editor.newMode', '2d')) ? store.get('pocket.editor.newMode', '2d') : '2d';
  const kindOf = (t) => (t.kind === 'app' ? 'app' : templates[t.key].mode === '3d' ? '3d' : '2d');
  const wrap = h('div', { class: 'type-wrap' });
  const orient = () => store.get('pocket.editor.newOrient', 'portrait');
  const tplOrient = (t) => templates[t.key].settings?.orientation;
  const draw = () => {
    const list = templateInfo.filter((t) => kindOf(t) === mode).sort((a, b) => (/^(empty|app-blank)/.test(b.key) ? 1 : 0) - (/^(empty|app-blank)/.test(a.key) ? 1 : 0));
    wrap.replaceChildren(
      h('div', { class: 'seg' }, ['2d', '3d', 'app'].map((m) => h('button', { class: mode === m ? 'on' : '', onclick: () => { mode = m; store.set('pocket.editor.newMode', m); draw(); } },
        icon(m === '3d' ? 'cube' : m === 'app' ? 'phone' : 'grid'), m === 'app' ? 'Apps' : `${m.toUpperCase()} games`.replace(' games', window.innerWidth < 520 ? '' : ' games'), h('small', {}, String(templateInfo.filter((t) => kindOf(t) === m).length))))),
      ...[mode !== 'app' && h('div', { class: 'seg small orient-pick' }, h('span', { class: 'seg-l' }, 'Blank game:'), [['portrait', 'Portrait'], ['landscape', 'Landscape']].map(([k, l]) => h('button', { class: (orient() === k ? 'on ' : '') + k, onclick: () => { store.set('pocket.editor.newOrient', k); draw(); } }, icon('phone'), l)))].filter(Boolean),
      h('div', { class: 'types' }, list.map((t) => h('button', { class: 'type' + (t.key.startsWith('empty') ? ' blank' : ''), onclick: () => onPick(t, t.key.startsWith('empty') ? orient() : null) },
        h('div', { class: 'pv', style: `background:${t.color || '#2b2b2b'}` }, icon(t.icon || 'cube'),
          (t.key.startsWith('empty') ? orient() : tplOrient(t)) && h('span', { class: 'pv-or ' + (t.key.startsWith('empty') ? orient() : tplOrient(t)) }, (t.key.startsWith('empty') ? orient() : tplOrient(t)) === 'landscape' ? 'Landscape' : 'Portrait')),
        h('b', {}, t.title), h('small', {}, t.blurb)))));
  };
  draw();
  return wrap;
}
/** Saved games with All / 2D / 3D tabs and a 2D/3D badge on each. */
function projectList(all, row) {
  let f = store.get('pocket.editor.projFilter', 'all');
  const wrap = h('div');
  const draw = () => {
    const kind = (j) => (j.settings?.app ? 'app' : j.mode === '3d' ? '3d' : '2d');
    const n = (m) => all.filter(([, p]) => kind(p.json) === m).length, shown = all.filter(([, p]) => f === 'all' || kind(p.json) === f);
    wrap.replaceChildren(h('div', { class: 'seg small' }, [['all', 'All', all.length], ['2d', '2D', n('2d')], ['3d', '3D', n('3d')], ['app', 'Apps', n('app')]].map(([k, l, c]) =>
      h('button', { class: f === k ? 'on' : '', onclick: () => { f = k; store.set('pocket.editor.projFilter', k); draw(); } }, l, h('small', {}, String(c))))),
      shown.length ? h('div', { class: 'mine' }, shown.map(row)) : h('div', { class: 'empty' }, f === 'app' ? 'No apps yet.' : `No ${f.toUpperCase()} games yet.`));
  };
  draw();
  return wrap;
}
const modeBadge = (json) => (json.settings?.app ? h('span', { class: 'mode-badge mapp' }, 'App') : h('span', { class: 'mode-badge ' + (json.mode === '3d' ? 'm3' : 'm2') }, json.mode === '3d' ? '3D' : '2D'));
function startGame(t, orient) {
  closeLayer(); hideHome();
  if (store.get('pocket.editor.toured', '') !== '1') setTimeout(() => openTour(0), 400);
  newFromTemplate(t.key, t.key.startsWith('empty') ? 'New Game' : t.key === 'app-blank' ? 'My App' : undefined);
  if (orient) { setOrientation(orient); resetCamera(); applyCamera(); }
  toast(`Created ${root.name}. Tap ▶ Play to try it!`);
}
function openNewDialog() {
  openDialog('New Game or App', [h('p', { class: 'desc', style: 'color:var(--muted);margin:0 0 12px' }, 'Pick a game type, or an app. Each one already works, and you can change it any way you like.'), typeCards(startGame)]);
}

// ---- Home screen: continue, new game by type, my games ----
function showHome() {
  closeLayer();
  $('.toast')?.remove();
  const home = $('#home'), all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  const cur = root && all.find(([id]) => id === projectId);
  home.replaceChildren(...[
    h('div', { class: 'hd' }, h('img', { src: '../icon.svg', alt: '' }), h('h1', {}, 'Pocket Engine')),
    h('p', { class: 'sub' }, 'Make 2D and 3D games, and apps, on your phone.'),
    cur && h('button', { class: 'continue', onclick: hideHome },
      h('span', { class: 'ic' }, icon('play')), h('span', {}, h('b', {}, `Continue “${root.name}”`), h('small', {}, `${root.settings?.app ? 'App' : root.mode.toUpperCase()} · last edited ${new Date(cur[1].updated).toLocaleString()}`))),
    h('h2', {}, 'New game or app'),
    typeCards(startGame),
    all.length ? [h('h2', {}, 'My games and apps'), projectList(all, ([id, pr]) => h('div', { class: 'proj-row' },
      modeBadge(pr.json),
      h('span', { class: 'nm', onclick: () => { saveNow(); openProject(pr.json, id); hideHome(); } }, pr.name),
      h('small', {}, new Date(pr.updated).toLocaleDateString()),
      id !== projectId && h('button', { title: 'Delete', onclick: () => {
        if (!confirm(`Delete "${pr.name}"? This cannot be undone.`)) return;
        deleteProject(id); showHome();
      } }, icon('trash'))))] : null,
    safetyCard(all.length),
    h('div', { class: 'home-actions' },
      h('button', { class: 'btn', onclick: importJSON }, icon('upload'), 'Import'),
      !matchMedia('(display-mode: standalone)').matches && h('button', { class: 'btn', onclick: installApp }, icon('download'), 'Install App'),
      window.pocketUpdate && h('button', { class: 'btn', onclick: () => { saveNow(); window.pocketUpdate.available ? window.pocketUpdate.apply() : window.pocketUpdate.check(); } }, icon('download'), 'Updates')),
    window.pocketUpdate && h('p', { class: 'sub' }, `Pocket Engine ${window.pocketUpdate.version}`),
  ].flat().filter(Boolean)); // DOM nodes only: nested arrays or false would render as text
  home.hidden = false;
  home.scrollTop = 0;
  document.body.classList.add('home-open'); engine.sleeping = true;
}
function hideHome() { $('#home').hidden = true; document.body.classList.remove('home-open'); engine.sleeping = false; requestAnimationFrame(() => engine.resize()); }
function openProjectsDialog() {
  const all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  openDialog('Open Project', all.length ? projectList(all, ([id, p]) => h('div', { class: 'proj-row' },
    modeBadge(p.json),
    h('span', { class: 'nm', onclick: () => { closeLayer(); saveNow(); openProject(p.json, id); } }, p.name, id === projectId ? ' (open)' : ''),
    h('small', {}, new Date(p.updated).toLocaleDateString()),
    id !== projectId && h('button', { title: 'Delete', onclick: () => {
      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      deleteProject(id); openProjectsDialog();
    } }, icon('trash')))) : h('div', { class: 'empty' }, 'No saved projects.'));
}
const TOUR = [
  ['cube', 'Welcome to Pocket Editor', 'Build 2D and 3D games right on your phone. Here is a quick tour; it takes 30 seconds.'],
  ['plus', 'Add things', 'Tap the blue + button (or the Project tab). Tap a tile to add it, or press, hold and drag it to the exact spot in the Scene.'],
  ['move', 'Arrange', 'Tap an object to select it and drag to move it. The tools at the top rotate, scale, and paint copies.'],
  ['info', 'Customize', 'The Inspector lists the selected object\'s components. Change any value, or tap Add Component for movement, scoring, enemies, doors and more.'],
  ['layers', 'Levels & settings', 'The level button above the Scene adds and switches levels. Tap the game name at the top of the Hierarchy for game settings like controls and time limits.'],
  ['play', 'Play and share', 'Tap the play button to test instantly. Build HTML in the menu makes one file anyone can play in a browser.'],
];
function openTour(i) {
  const [ic, title, text] = TOUR[i], last = i === TOUR.length - 1;
  openDialog('Quick Tour', [h('div', { class: 'tour' },
    h('div', { class: 'big' }, icon(ic)), h('h4', {}, title), h('p', {}, text),
    h('div', { class: 'dots' }, TOUR.map((_, k) => h('i', { class: k === i ? 'on' : '' }))),
    h('div', { class: 'btns' },
      i > 0 ? h('button', { class: 'btn', onclick: () => openTour(i - 1) }, icon('left'), 'Back') : h('button', { class: 'btn', onclick: endTour }, 'Skip'),
      h('button', { class: 'btn primary', onclick: () => (last ? endTour() : openTour(i + 1)) }, last ? 'Start building' : 'Next', !last && icon('right'))))]);
}
function endTour() { store.set('pocket.editor.toured', '1'); closeLayer(); }

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
// ---------- Notifications (Game Settings › Notifications) ----------
const gameSettings = () => { const g = levelList()[0]; return (g.settings ||= {}); };
const customNotify = (name) => (gameSettings().notifyTypes || []).find((t) => t.name === name);
function allNotifyTypes() {
  const own = gameSettings().notifyTypes || [], names = [...NOTIFY_TYPES.map((t) => t.name), ...own.map((t) => t.name).filter((n) => !NOTIFY_TYPES.some((b) => b.name === n))];
  return names.map((n) => ({ ...NOTIFY_DEFAULTS, ...(NOTIFY_TYPES.find((t) => t.name === n) || {}), ...(own.find((t) => t.name === n) || {}), name: n }));
}
const uniqueNotifyName = (base) => { let n = base, i = 2; while (allNotifyTypes().some((t) => t.name === n)) n = base + i++; return n; };
/** The game's own copy of a type (made from the built-in one the first time it is edited). */
function ensureNotifyType(name) {
  const st = gameSettings(); st.notifyTypes ||= [];
  let t = st.notifyTypes.find((q) => q.name === name);
  if (!t) { t = { ...(NOTIFY_TYPES.find((q) => q.name === name) || {}), name }; st.notifyTypes.push(t); }
  return t;
}
function testNotify(name, extra = {}) {
  engine.notifyTypes = gameSettings().notifyTypes; // the editor previews the game-wide types from any level
  const t = allNotifyTypes().find((q) => q.name === name) || {};
  const text = { achievement: 'You collected 100 coins', reward: 'Your daily gift is ready', levelup: 'You reached level 5!', info: '', warning: 'Your health is low', error: 'Could not save the game', chat: 'Want to race again?', default: 'This is how it looks in your game' }[name] ?? 'This is how it looks in your game';
  const title = { achievement: 'Coin Collector', reward: 'Daily reward', levelup: 'Level up!', info: 'Game saved', warning: 'Careful!', error: 'Oops', chat: 'Alex', default: 'Notification' }[name] || t.name;
  const n = engine.notify({ type: name, title, text, ...extra }); engine.render();
  const dlg = !layer.hidden && layer.querySelector('.dialog') ? layer : null; // from the type editor: step aside so the preview shows
  if (dlg) { dlg.style.visibility = 'hidden'; const back = () => { dlg.style.visibility = ''; clearTimeout(tm); }; const tm = setTimeout(back, (n.life + 0.7) * 1000); setTimeout(() => document.addEventListener('pointerdown', back, { once: true, capture: true }), 50); }
  let frames = 0; const tick = () => { engine.render(); if (++frames < 240 && engine.notifier.list.length) requestAnimationFrame(tick); }; requestAnimationFrame(tick); // the editor only redraws on changes
}
function openNotifyEditor(name) {
  const builtIn = NOTIFY_TYPES.some((q) => q.name === name), T = () => ensureNotifyType(name);
  const C = (path, spec) => control(T, path, { ...spec, def: spec.def ?? NOTIFY_DEFAULTS[path] ?? (NOTIFY_TYPES.find((q) => q.name === name) || {})[path] });
  const sec = (title, ic, kids) => h('div', { class: 'build-sec' }, h('h4', {}, icon(ic), title), kids);
  const sounds = [['none', 'None'], ...SOUNDS.map((x) => [x, x]), ...Object.keys(project.sounds || root.sounds || {}).map((x) => [x, x + ' (yours)'])];
  openDialog(`Notification type: ${name}`, [
    h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: () => testNotify(name) }, icon('play'), 'Test'), h('button', { class: 'btn', onclick: () => testNotify(name, { buttons: T().buttons || 'OK > close, Later' }) }, icon('play'), 'Test with buttons')),
    !builtIn && h('div', { class: 'row side' }, h('label', {}, 'Name'), h('input', { type: 'text', value: name, onchange: (e) => { const v = e.target.value.trim().replace(/[^\w-]/g, '') || name; if (v !== name && !allNotifyTypes().some((q) => q.name === v)) { T().name = v; changed({ inspector: true }); pushHistory(); closeLayer(); openNotifyEditor(v); } } })),
    h('p', { class: 'desc' }, `Show it with the message notify:${name} Title|text|icon.`),
    sec('Look', 'brush', [
      C('look', { label: 'Style', type: 'select', options: [['card', 'Card'], ['pill', 'Pill (one line)'], ['banner', 'Banner (full width)'], ['achievement', 'Achievement (shine)'], ['toast', 'Toast (coloured edge)'], ['bubble', 'Speech bubble'], ['minimal', 'Minimal'], ['picture', 'Picture background']] }),
      C('position', { label: 'Where', type: 'select', options: [['top', 'Top'], ['bottom', 'Bottom'], ['center', 'Middle'], ['top left', 'Top left'], ['top right', 'Top right'], ['bottom left', 'Bottom left'], ['bottom right', 'Bottom right']] }),
      C('width', { label: 'Width (0 = automatic)', type: 'number', step: 10 }),
      C('radius', { label: 'Corner roundness', type: 'number', step: 1 }),
      C('max', { label: 'Most at once here', type: 'number', step: 1 }),
    ]),
    sec('Colours', 'brush', [
      C('bg', { label: 'Background', type: 'color' }), C('bg2', { label: 'Blend to (gradient)', type: 'color', optional: true }),
      C('text', { label: 'Title', type: 'color' }), C('sub', { label: 'Text (blank = title, faded)', type: 'color', optional: true }),
      C('accent', { label: 'Accent (icon, buttons, timer)', type: 'color' }),
      C('border', { label: 'Border', type: 'color', optional: true }), C('borderWidth', { label: 'Border width', type: 'number', step: 0.5 }),
      C('shadow', { label: 'Shadow', type: 'bool' }), C('glow', { label: 'Glow in the accent colour', type: 'bool' }),
    ]),
    sec('Content', 'text', [
      C('label', { label: 'Small heading (e.g. ACHIEVEMENT)', type: 'text' }),
      C('icon', { label: 'Icon (UI icon name or emoji)', type: 'text' }),
      C('iconShape', { label: 'Icon background', type: 'select', options: [['circle', 'Circle'], ['square', 'Rounded square'], ['none', 'None']] }),
      C('image', { label: 'Picture (replaces the icon; fills a Picture style)', type: 'image' }),
      C('titleSize', { label: 'Title size', type: 'number', step: 1 }), C('textSize', { label: 'Text size', type: 'number', step: 0.5 }),
    ]),
    sec('Motion & sound', 'play', [
      C('animIn', { label: 'Comes in with', type: 'select', options: [['slide', 'Slide'], ['fade', 'Fade'], ['pop', 'Pop'], ['bounce', 'Bounce'], ['drop', 'Drop'], ['flip', 'Flip'], ['zoom', 'Zoom'], ['shake', 'Shake'], ['none', 'Nothing']] }),
      C('animOut', { label: 'Leaves with', type: 'select', options: [['slide', 'Slide'], ['fade', 'Fade'], ['shrink', 'Shrink'], ['none', 'Disappear']] }),
      C('duration', { label: 'Stays for (sec)', type: 'number', step: 0.5 }),
      C('progress', { label: 'Timer bar along the bottom', type: 'bool' }),
      C('sound', { label: 'Sound', type: 'select', options: sounds }), C('vibrate', { label: 'Vibrate', type: 'bool' }),
    ]),
    sec('Tapping', 'hand', [
      C('tap', { label: 'Tapping it', type: 'select', options: [['close', 'Closes it'], ['message', 'Sends a message'], ['page', 'Opens a page'], ['nothing', 'Does nothing (use buttons)']] }),
      C('tapValue', { label: 'Message / page', type: 'text', suggest: 'messages' }),
      C('buttons', { label: 'Buttons (up to 2: Label > message, Label > message)', type: 'text', placeholder: 'Claim > claim reward, Later' }),
      h('p', { class: 'desc' }, 'A button without "> message" just closes it. The first button uses the accent colour.'),
    ]),
    h('div', { class: 'btns' },
      builtIn ? h('button', { class: 'btn', onclick: () => { const st = gameSettings(); st.notifyTypes = (st.notifyTypes || []).filter((q) => q.name !== name); changed({ inspector: true }); pushHistory(); closeLayer(); openNotifyEditor(name); toast('Back to the built-in look'); } }, icon('undo'), 'Reset to built-in')
        : h('button', { class: 'btn danger', onclick: () => { const st = gameSettings(); st.notifyTypes = (st.notifyTypes || []).filter((q) => q.name !== name); changed({ inspector: true }); pushHistory(); closeLayer(); toast('Type deleted'); } }, icon('trash'), 'Delete type'),
      h('button', { class: 'btn', onclick: () => { const nn = uniqueNotifyName(name + '-copy'); const st = gameSettings(); st.notifyTypes = [...(st.notifyTypes || []), { ...allNotifyTypes().find((q) => q.name === name), name: nn }]; changed({ inspector: true }); pushHistory(); closeLayer(); openNotifyEditor(nn); } }, icon('copy'), 'Duplicate')),
  ]);
  $('.dialog .db')?.addEventListener('change', () => { engine.notifyTypes = gameSettings().notifyTypes; });
}
/** ☰ → Preferences: how the editor looks and behaves on this device, plus the app itself (updates, install, storage). */
function openPreferences() {
  const redo = () => setTimeout(() => { const sc = $('.dialog .db')?.scrollTop; openPreferences(); const db = $('.dialog .db'); if (db) db.scrollTop = sc; });
  const sel = (k, label, options, info) => h('div', { class: 'row side' }, h('label', {}, label), h('select', { onchange: (e) => { const o = options.find(([v]) => String(v) === e.target.value); setEP(k, o ? o[0] : e.target.value); redo(); } }, options.map(([v, l]) => h('option', { value: String(v), selected: String(EP[k]) === String(v) }, l))), info && h('small', { class: 'pref-info' }, info));
  const tog = (k, label, info, after) => h('label', { class: 'row inline' }, h('span', {}, label, info && h('small', { class: 'pref-info' }, info)), h('input', { type: 'checkbox', checked: !!EP[k], onchange: (e) => { setEP(k, e.target.checked); after?.(e.target.checked); } }));
  const flag = (label, get, set) => h('label', { class: 'row inline' }, h('span', {}, label), h('input', { type: 'checkbox', checked: get(), onchange: (e) => set(e.target.checked) }));
  const sec = (title, ic, kids) => h('div', { class: 'build-sec' }, h('h4', {}, icon(ic), title), kids);
  const storeInfo = h('div', { class: 'build-report' }, h('div', { class: 'muted' }, 'Checking storage…'));
  Promise.all([storageUse(), isPersisted()]).then(([u, kept]) => {
    const row = (l, v) => h('div', { class: 'br-row' }, h('span', {}, l), h('b', {}, v));
    storeInfo.replaceChildren(row('Games saved', String(Object.keys(loadProjects()).length)), u ? row('Space used', `${kb(u.used)} of ${kb(u.quota)}`) : null, row('Where', usingIndexedDB() ? 'This device (IndexedDB)' : 'This device (basic storage)'),
      row('Protected from clean-ups', kept ? 'Yes' : 'No'), !kept ? h('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => { await askPersist(); toast((await isPersisted()) ? 'Your games are protected' : 'The browser said no. Installing the app usually helps'); redo(); } }, icon('save'), 'Protect my games') : null);
  });
  const installedApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  openDialog('Preferences', [
    h('p', { class: 'desc' }, 'These are for you on this device. Game settings live in Scene Settings and Build Settings.'),
    sec('Look', 'brush', [
      tog('dense', 'Compact panels', 'Shorter rows in the Hierarchy and smaller fields in the Inspector, so more fits on screen'),
      tog('compactTools', 'Fold the tool bar', 'Shows only the tool you are using over the Scene; tap it for the others'),
      h('div', { class: 'row' }, h('label', {}, 'Theme'), h('div', { class: 'seg small pref-themes' }, THEME_NAMES.map(([v, l]) => h('button', { class: EP.theme === v ? 'on' : '', onclick: () => { setEP('theme', v); redo(); } }, h('i', { class: 'th-dot', style: `background:${THEMES[v]['--panel'] || '#383838'};border-color:${THEMES[v]['--toolbar'] || '#191919'}` }), l)))),
      h('div', { class: 'row' }, h('label', {}, 'Accent colour'), h('div', { class: 'pref-swatches' }, ACCENTS.map(([c, l]) => h('button', { class: 'pref-sw' + (EP.accent === c ? ' on' : ''), title: l, 'aria-label': l, style: `background:${c}`, onclick: () => { setEP('accent', c); redo(); } })))),
      sel('uiSize', 'Panel text size', [[0.9, 'Small'], [1, 'Normal'], [1.1, 'Large'], [1.25, 'Extra large']]),
      tog('reduceMotion', 'Reduce motion', 'Turns off sliding and fading animations'),
    ]),
    sec('Editing', 'move', [
      flag('Snap when moving', () => snap, (v) => { snap = v; store.set('pocket.editor.snap', v ? '1' : '0'); $('#snapBtn')?.classList.toggle('on', v); }),
      sel('snap2D', 'Snap step (2D)', [[1, '1 px'], [5, '5 px'], [10, '10 px'], [16, '16 px (tiles)'], [20, '20 px'], [32, '32 px'], [50, '50 px']]),
      sel('snap3D', 'Snap step (3D)', [[0.1, '0.1'], [0.25, '0.25'], [0.5, '0.5'], [1, '1']]),
      sel('rotSnap', 'Rotation snap', [[5, '5°'], [15, '15°'], [30, '30°'], [45, '45°'], [90, '90°']]),
      flag('Show the grid', () => showGrid, (v) => { showGrid = v; store.set('pocket.editor.grid', v ? '1' : '0'); $('#gridBtn')?.classList.toggle('on', v); engine.render(); }),
      flag('Show all colliders', () => showColliders, (v) => toggleColliders(v)),
      tog('haptics', 'Vibration on taps', 'Little buzzes when you pick, drop or press things'),
    ]),
    sec('Saving', 'save', [
      sel('autosave', 'Save my work', [['0.5', 'Straight away'], ['3', 'After a few seconds'], ['10', 'Every 10 seconds'], ['leave', 'Only when I tap Save or leave']]),
      sel('snapEvery', 'Restore point every', [[1, '1 minute'], [3, '3 minutes'], [5, '5 minutes'], [10, '10 minutes']]),
      sel('snapKeep', 'Restore points kept', [[6, '6'], [12, '12'], [24, '24'], [40, '40']], '☰ → Restore Earlier Version… goes back to one'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { closeLayer(); backupAll(); } }, icon('save'), 'Back up all games'), h('button', { class: 'btn', onclick: () => { closeLayer(); importJSON(); } }, icon('upload'), 'Restore a backup')),
    ]),
    sec('App', 'phone', [
      sel('startOn', 'When the app opens', [['home', 'Show the Home screen'], ['last', 'Go straight to my last game']]),
      tog('keepAwake', 'Keep the screen on while editing'),
      h('div', { class: 'br-row' }, h('span', {}, 'Version'), h('b', {}, window.pocketUpdate?.version || '–')),
      h('div', { class: 'btns' },
        h('button', { class: 'btn', onclick: () => window.pocketUpdate ? window.pocketUpdate.check() : toast('Updates are checked when the app is online') }, icon('download'), window.pocketUpdate?.available ? 'Update now' : 'Check for updates'),
        !installedApp && h('button', { class: 'btn', onclick: installApp }, icon('phone'), 'Install app')),
      storeInfo,
    ]),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { if (!confirm('Put every preference back to how it started?')) return; EP = { ...EDITOR_PREFS }; setEP('theme', 'dark'); redo(); toast('Preferences reset'); } }, icon('undo'), 'Reset preferences')),
  ]);
}
function installApp() {
  if (installPrompt) { installPrompt.prompt(); installPrompt = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  openDialog('Install App', [h('div', { class: 'tour' }, h('div', { class: 'big' }, icon('download')),
    h('h4', {}, 'Add Pocket Editor to your home screen'),
    h('p', {}, ios ? 'In Safari, tap the Share button, then "Add to Home Screen".' : 'Open your browser menu (⋮), then choose "Install app" or "Add to Home screen".'),
    h('p', {}, 'It opens full screen and keeps working offline.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: closeLayer }, 'Got it')))]);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});

/** The documentation (docs/), in a new tab so the project stays open. `route` like 'guide/physics' or 'ref/component/health'. */
function openDocs(route = '') {
  try { saveNow(); } catch { /* saved again soon */ }
  const url = '../docs/' + (route ? '#/' + route : '');
  const w = window.open(url, 'pocket-docs');
  if (!w) location.href = url; // pop-ups blocked (some installed web apps): open here; the project is saved
}

function openHelp() {
  const row = (a, b) => h('div', { class: 'help-row' }, h('b', {}, a), h('span', {}, b));
  openDialog('Controls', [
    h('div', { class: 'btns' }, h('button', { class: 'btn primary', onclick: () => openDocs('') }, icon('help'), 'Open the documentation'), h('button', { class: 'btn', onclick: () => openDocs('guide/getting-started') }, icon('play'), 'Getting started')),
    row('Select', 'Tap an object'), row('Move', 'Drag it, or use the arrows'), row('Rotate / Scale', 'Pick the tool, drag the handles'),
    row('Paint', 'Select an object, pick the brush, tap or drag to place copies'), row('Levels', 'Level button above the Scene'),
    row('More room', 'Tap the open panel tab, or drag the sheet handle'),
    row('Object menu', 'Long-press an object (or empty space to paste/add)'),
    row('Undo / Redo', 'Two-finger tap / three-finger tap'),
    row('Reset view', 'Double-tap empty space'),
    row('Pan / Orbit', 'Drag empty space'), row('Zoom', 'Pinch with two fingers'), row('Add objects', 'Drag from Project into the Scene'),
    row('Add components', 'Drag onto an object, or Add Component'), row('Edit numbers', 'Drag a field label left/right'),
  ]);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/** Every game (and saved scripts) in one file: shared to Files / iCloud / Drive / email, or downloaded. */
async function backupAll() {
  saveNow();
  const data = JSON.stringify(makeBackup()), d = new Date(), name = `pocket-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const file = typeof File === 'function' ? new File([data], name, { type: 'application/json' }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Pocket Engine backup' }); markBackedUp(); toast('Backup saved'); if (!$('#home').hidden) showHome(); return; }
    catch (e) { if (e?.name === 'AbortError') return; } // cancelled: nothing saved
  }
  download(name, data, 'application/json'); markBackedUp(); toast('Backup downloaded'); if (!$('#home').hidden) showHome();
}
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} days ago`; };
/** Restore points: earlier versions of the open game, taken every few minutes while you work. */
async function openRestorePoints() {
  saveNow();
  const list = await listSnapshots(projectId);
  const count = (j) => [j, ...(j.levels || [])].reduce((n, lv) => n + (lv.entities?.length || 0), 0);
  openDialog('Earlier Versions', [
    h('p', { class: 'desc' }, usingIndexedDB() ? `A version of “${root.name}” is kept every few minutes while you work (the last 12). Restoring one keeps your current version here too, so you can always go back.` : 'Earlier versions need more storage than this browser allows (private browsing?).'),
    list.length ? h('div', { class: 'snap-list' }, list.map((sn) => h('div', { class: 'proj-row' },
      h('span', { class: 'nm' }, h('b', {}, new Date(sn.time).toLocaleString()), h('small', {}, ` ${ago(sn.time)} · ${count(sn.json)} objects · ${(sn.json.levels?.length || 0) + 1} level${sn.json.levels?.length ? 's' : ''}${sn.reason !== 'auto' ? ' · ' + sn.reason : ''}`)),
      h('button', { class: 'btn', onclick: async () => {
        await snapshot(projectId, { name: root.name, updated: Date.now(), json: clone(root) }, 'before restore');
        closeLayer(); openProject(clone(sn.json), projectId); saveNow(); toast('Earlier version restored');
      } }, 'Restore')))) : h('div', { class: 'empty' }, 'No earlier versions yet: they appear after a few minutes of editing.'),
  ]);
}
/** Home: how safe your games are, with a nudge to back up. */
function safetyCard(count) {
  if (!count) return null;
  const last = lastBackup(), stale = !last || Date.now() - last > 7 * 86400000;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const info = h('small', { class: 'safe-info' }, `Saved on this phone · ${count} game${count === 1 ? '' : 's'}`);
  storageUse().then((u) => isPersisted().then((p) => { if (u) info.textContent = `Saved on this phone · ${count} game${count === 1 ? '' : 's'} · ${u.used < 1048576 ? Math.max(1, Math.round(u.used / 1024)) + ' KB' : (u.used / 1048576).toFixed(1) + ' MB'}${p ? ' · kept safe ✓' : ''}`; }));
  return h('div', { class: 'safe-card' + (stale ? ' warn' : '') },
    h('div', { class: 'safe-top' }, icon(stale ? 'info' : 'check'), h('b', {}, stale ? (last ? `Last backup ${ago(last)}` : 'Your games aren\'t backed up yet') : `Backed up ${ago(last)}`)),
    info,
    stale && h('p', {}, ios && !standalone ? 'Safari can clear a website\'s data if you don\'t visit for a week. Back up to Files or iCloud, and add the app to your Home Screen.' : 'A backup file keeps your games safe if the phone is lost, reset, or the browser is cleared.'),
    h('div', { class: 'btns' }, h('button', { class: 'btn' + (stale ? ' primary' : ''), onclick: backupAll }, icon('save'), 'Back Up'),
      h('button', { class: 'btn', onclick: importJSON }, icon('upload'), 'Restore')));
}
function importJSON() {
  const fi = $('#fileInput');
  fi.accept = 'application/json,.json,.pocket';
  fi.onchange = async () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (json.pocketBackup) { // a full backup: bring every game back
        saveNow();
        const r = await restoreBackup(json);
        toast(`Backup restored: ${r.added} added, ${r.updated} updated${r.kept ? `, ${r.kept} kept (yours were newer)` : ''}`);
        if (r.updated && allProjects()[projectId]) openProject(clone(allProjects()[projectId].json), projectId);
        showHome(); return;
      }
      if (!Array.isArray(json.entities)) throw new Error('not a Pocket project or backup');
      for (const e of json.entities) e.id ||= uid();
      openProject(json); hideHome(); toast(`Imported ${json.name || 'project'}`);
    } catch (err) { toast('Could not import: ' + err.message); }
  };
  fi.click();
}
// ---- Build Settings: everything about the playable file a game becomes ----
const BUILD_DEFAULTS = {
  title: '', version: '1.0', author: '', description: '', file: '',
  icon: '', iconEmoji: '🎮', iconBg: '#3a8dff', ...LOADING_DEFAULTS,
  startLevel: '1', quality: 'balanced', backGesture: true, installable: true, compress: true,
  noMenu: true, showFps: false, showErrors: false,
  // web app (how the game behaves as an installed / home-screen app)
  display: 'fullscreen', shortName: '', themeColor: '', statusBar: 'black-translucent', orientation: '', lang: 'en',
  installHint: 'off', installText: 'Add this game to your Home Screen to play any time, even offline.', pauseHidden: true, keepAwake: true, confirmLeave: false,
  social: true, headHTML: '',
  // app stores (Codemagic)
  appId: '', storeIOS: true, storeAndroid: true, iosPublish: 'testflight', iosDevices: 'iphone', androidTrack: 'internal', playDraft: true,
  ascIntegration: 'codemagic', keystoreRef: 'keystore_reference', playGroup: 'google_play', buildOffset: 0, notifyEmail: '', storeFullscreen: true,
};
const QUALITY = { battery: 1, balanced: 2, sharp: 3 };
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
const buildOpts = () => ({ ...BUILD_DEFAULTS, ...(root.build || {}) });
const kb = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' MB');
const escHTML = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
const hexOr = (c, d) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : d);
let engineSrc = null;
const loadEngineSrc = async () => (engineSrc ||= await (await fetch(new URL('../engine/pocket.js', import.meta.url))).text());

/** The app icon as a PNG data URL: the chosen picture (cropped to a square), or an emoji on a colour. */
function makeIcon(o, size = 512) {
  return new Promise((ok) => {
    const c = h('canvas', { width: size, height: size }), x = c.getContext('2d');
    x.fillStyle = hexOr(o.iconBg, '#3a8dff'); x.fillRect(0, 0, size, size);
    const emoji = () => { x.font = `${size * 0.6}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.iconEmoji || '🎮', size / 2, size * 0.54); ok(c.toDataURL('image/png')); };
    if (!o.icon) return emoji();
    const img = new Image();
    img.onload = () => { const s = Math.min(img.width, img.height); x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); ok(c.toDataURL('image/png')); };
    img.onerror = emoji; img.src = o.icon;
  });
}
async function gzip64(text) {
  const buf = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}
/** The game data that goes in the build: levels left out are dropped, editor-only notes removed. */
function buildGameJSON() {
  const g = clone(root), o = buildOpts();
  const all = [g, ...(g.levels || [])];
  g.levels = (g.levels || []).filter((lv) => !lv.buildSkip);
  for (const lv of all) delete lv.buildSkip;
  delete g.build;
  const kept = [g, ...g.levels], wanted = all[clampN(Math.round(+o.startLevel || 1), 1, all.length) - 1];
  return { game: g, start: Math.max(0, kept.indexOf(wanted)), levels: kept.length, dropped: all.length - kept.length };
}
/** Where the size goes: the engine, the game, and its biggest pictures and sounds. */
function sizeReport(game) {
  const assets = [];
  const walk = (v, where) => {
    if (typeof v === 'string') { if (v.startsWith('data:')) assets.push({ where, kind: /^data:audio/.test(v) ? 'sound' : /^data:image/.test(v) ? 'picture' : 'file', size: v.length }); return; }
    if (Array.isArray(v)) v.forEach((x) => walk(x, where));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, v.name && typeof v.name === 'string' && v.entities === undefined ? v.name : where === 'game' && k === 'sounds' ? 'Sounds' : where);
  };
  walk(game, 'game');
  const sum = (k) => assets.filter((a) => a.kind === k).reduce((n, a) => n + a.size, 0);
  return { pictures: sum('picture'), sounds: sum('sound'), top: assets.sort((a, b) => b.size - a.size).slice(0, 5) };
}
/** One self-contained HTML file: engine + game + app icon, splash screen and player options. */
async function buildHTML({ native = false } = {}) {
  const o = { ...buildOpts(), ...(native ? { installable: false, installHint: 'off', confirmLeave: false } : {}) }, src = await loadEngineSrc(), { game, start } = buildGameJSON(); // native: inside the iOS / Android app
  const title = o.title || root.name || 'My Game', bg = hexOr(root.background, '#000000'), splashBg = hexOr(o.splashBg, bg);
  const iconURL = await makeIcon(o, 512), small = await makeIcon(o, 180);
  const orient = o.orientation || { portrait: 'portrait', landscape: 'landscape' }[root.settings?.orientation] || 'any', theme = hexOr(o.themeColor, bg), short = (o.shortName || title).slice(0, 12);
  const manifest = { name: title, short_name: short, description: o.description || undefined, display: o.display || 'fullscreen', orientation: orient, lang: o.lang || 'en',
    background_color: splashBg, theme_color: theme, start_url: '.', icons: [{ src: iconURL, sizes: '512x512', type: 'image/png', purpose: 'any' }] };
  const json = JSON.stringify(game);
  const L = loadingParts(o, { title, icon: small, bg, font: themeOf(root.settings).font });
  const gf = (root.settings?.fonts || []).filter(Boolean), nameGF = /^"([^"]+)", system-ui, sans-serif$/.exec(o.nameFont || '')?.[1];
  const cfg = JSON.stringify({ start, dpr: QUALITY[o.quality] || 2, back: o.backGesture !== false, fps: !!o.showFps, errors: !!o.showErrors, noMenu: o.noMenu !== false, title, version: o.version, author: o.author, fonts: gf,
    install: o.installable !== false ? o.installHint || 'off' : 'off', installText: o.installText, pauseHidden: o.pauseHidden !== false, keepAwake: o.keepAwake !== false, confirmLeave: !!o.confirmLeave });
  let payload, engineBytes, gameBytes;
  if (o.compress && typeof CompressionStream === 'function') {
    const [E, G] = await Promise.all([gzip64(src), gzip64(json)]);
    engineBytes = E.length; gameBytes = G.length;
    payload = `const un = async (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); };
LD.set(0.08);
const src = await un("${E}"); LD.set(0.45);
const { Engine } = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); LD.set(0.6);
const game = JSON.parse(await un("${G}")); LD.set(0.66);
boot(Engine, game);`;
  } else {
    const code = src.replace(/<\/script/gi, '<\\/script'), data = json.replace(/</g, '\\u003c');
    engineBytes = code.length; gameBytes = data.length;
    payload = `${code}\nLD.set(0.6);\nboot(Engine, ${data});`;
  }
  const html = `<!doctype html>
<html lang="${escHTML(o.lang || 'en')}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="${escHTML(o.statusBar || 'black-translucent')}">
<meta name="apple-mobile-web-app-title" content="${escHTML((o.shortName || title).slice(0, 20))}">
<meta name="theme-color" content="${theme}">
${o.description ? `<meta name="description" content="${escHTML(o.description)}">\n` : ''}${o.author ? `<meta name="author" content="${escHTML(o.author)}">\n` : ''}<meta name="generator" content="Pocket Engine">
${o.social !== false ? `<meta property="og:type" content="website"><meta property="og:title" content="${escHTML(title)}">${o.description ? `<meta property="og:description" content="${escHTML(o.description)}">` : ''}<meta name="twitter:card" content="summary">\n` : ''}${o.headHTML ? o.headHTML + '\n' : ''}
<title>${escHTML(title)}</title>
<link rel="icon" type="image/png" href="${small}"><link rel="apple-touch-icon" href="${small}">
${o.installable !== false ? `<link rel="manifest" href="data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}">\n` : ''}${nameGF ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(nameGF).replace(/%20/g, '+')}&display=swap">\n` : ''}<style>html,body{margin:0;height:100%;background:${bg};overflow:hidden;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
${L.css}
#fps{position:fixed;left:6px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:98;font:12px monospace;color:#0f0;background:rgba(0,0,0,.55);padding:2px 6px;border-radius:4px;pointer-events:none}
#pk-install{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:99;display:flex;align-items:center;gap:10px;padding:10px 10px 10px 14px;border-radius:16px;background:rgba(20,22,30,.94);color:#fff;font:14px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:460px;margin:0 auto}
#pk-install img{width:40px;height:40px;border-radius:10px}#pk-install p{margin:0;flex:1}#pk-install button{border:0;border-radius:10px;padding:9px 14px;font:600 14px system-ui,sans-serif;background:#3a8dff;color:#fff}#pk-install .x{background:transparent;color:#aaa;padding:6px 8px;font-size:18px}
#err{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:100;background:#b3261e;color:#fff;font:13px/1.4 monospace;padding:10px 12px;border-radius:10px;white-space:pre-wrap;max-height:40%;overflow:auto}</style>
</head><body>
${L.html}
<script>window.POCKET_BUILD = ${cfg.replace(/</g, '\\u003c')};
${L.js}</script>
<script type="module">
const C = window.POCKET_BUILD, LD = window.PocketLoading;
if (C.noMenu) { addEventListener('contextmenu', (e) => e.preventDefault()); document.documentElement.style.webkitUserSelect = 'none'; }
if (C.errors) { const show = (m) => { let d = document.getElementById('err'); if (!d) { d = document.createElement('div'); d.id = 'err'; d.onclick = () => d.remove(); document.body.appendChild(d); } d.textContent = (d.textContent ? d.textContent + '\\n' : '') + m; };
  addEventListener('error', (e) => show(e.message + (e.lineno ? ' (line ' + e.lineno + ')' : ''))); addEventListener('unhandledrejection', (e) => show(String(e.reason && e.reason.message || e.reason))); }
/** Real progress: the pictures the game uses and its fonts (up to a few seconds), then the loading screen leaves. */
async function preload(game) {
  const pics = new Set();
  const walk = (v) => { if (typeof v === 'string') { if (/^data:image\\//.test(v) || /^https?:.*\\.(png|jpe?g|gif|webp|svg)(\\?|$)/i.test(v)) pics.add(v); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const k in v) walk(v[k]); };
  walk(game);
  const jobs = [...pics].map((u) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = u; }));
  for (const f of C.fonts || []) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + '&display=swap'; jobs.push(new Promise((ok) => { l.onload = () => (document.fonts ? document.fonts.load('16px "' + f + '"').then(ok, ok) : ok()); l.onerror = ok; })); document.head.appendChild(l); }
  let n = 0; const all = jobs.length;
  if (!all) return;
  await Promise.race([Promise.all(jobs.map((j) => j.then(() => LD.set(0.66 + 0.32 * (++n / all))))), new Promise((ok) => setTimeout(ok, 6000))]);
}
/** "Add to Home Screen": the browser's own install button where there is one (Android), steps elsewhere (iPhone). */
let installEvt = null; addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
const installed = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
function installHint() {
  if (installed() || document.getElementById('pk-install') || sessionStorage.getItem('pk-install-x')) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!installEvt && !ios) return;
  const d = document.createElement('div'); d.id = 'pk-install';
  const icon = document.querySelector('link[rel=apple-touch-icon]')?.href;
  d.innerHTML = (icon ? '<img alt="">' : '') + '<p></p>' + (installEvt ? '<button class="go">Install</button>' : '') + '<button class="x" aria-label="Not now">✕</button>';
  if (icon) d.querySelector('img').src = icon;
  d.querySelector('p').textContent = ios && !installEvt ? C.installText + ' Tap Share, then "Add to Home Screen".' : C.installText;
  d.querySelector('.x').onclick = () => { d.remove(); sessionStorage.setItem('pk-install-x', '1'); };
  const go = d.querySelector('.go'); if (go) go.onclick = async () => { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} installEvt = null; d.remove(); };
  for (const ev of ['pointerdown', 'touchstart']) d.addEventListener(ev, (e) => e.stopPropagation());
  document.body.appendChild(d);
}
async function boot(Engine, game) {
  await preload(game); LD.set(1);
  LD.done(() => {
    window.engine = new Engine({ maxPixelRatio: C.dpr, systemBack: C.back, pauseOnHide: C.pauseHidden, keepAwake: C.keepAwake });
    window.engine.start(game, { level: C.start });
    if (C.install === 'start') setTimeout(installHint, 2500);
    if (C.install === 'end') { let was = ''; setInterval(() => { const st = window.engine.scene?.state; if ((st === 'over' || st === 'win') && st !== was) setTimeout(installHint, 1200); was = st; }, 500); }
    if (C.confirmLeave) addEventListener('beforeunload', (e) => { if (window.engine.scene?.state === 'play') { e.preventDefault(); e.returnValue = ''; } });
    if (C.fps) { const f = document.createElement('div'); f.id = 'fps'; document.body.appendChild(f); let n = 0, last = performance.now(); const tick = (now) => { n++; if (now - last >= 500) { f.textContent = Math.round(n * 1000 / (now - last)) + ' fps'; n = 0; last = now; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  });
}
${payload}
</script>
</body></html>`;
  return { html, title, engineBytes, gameBytes };
}
/** A square splash for the store apps: the background with the icon in the middle. */
function makeSplash(o, size = 2732, iconFrac = 0.22, transparent = false) {
  return makeIcon(o, 1024).then((url) => new Promise((ok) => {
    const c = h('canvas', { width: size, height: size }), x = c.getContext('2d'), img = new Image(), bg = hexOr(o.splashBg, hexOr(root.background, '#000000'));
    if (!transparent) { x.fillStyle = bg; x.fillRect(0, 0, size, size); }
    img.onload = () => { const w = size * iconFrac; if (!transparent) { x.save(); x.beginPath(); x.roundRect?.((size - w) / 2, (size - w) / 2, w, w, w * 0.22); x.clip(); } x.drawImage(img, (size - w) / 2, (size - w) / 2, w, w); x.restore?.(); ok(c.toDataURL('image/png')); };
    img.src = url;
  }));
}
const dataBytes = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
/** The app-store settings as the project generator wants them. */
function storeOpts() {
  const o = buildOpts(), name = o.title || root.name || 'My Game';
  return { name, appId: o.appId || suggestAppId(o.author, name), version: o.version || '1.0', ios: o.storeIOS !== false, android: o.storeAndroid !== false,
    iosPublish: o.iosPublish, iosDevices: o.iosDevices, androidTrack: o.androidTrack, playDraft: !!o.playDraft, ascIntegration: o.ascIntegration, keystoreRef: o.keystoreRef,
    playGroup: o.playGroup, buildOffset: +o.buildOffset || 0, notifyEmail: o.notifyEmail, fullscreen: o.storeFullscreen !== false,
    orientation: o.orientation && o.orientation !== 'any' ? o.orientation : orientationOf() === 'any' ? '' : orientationOf(),
    iconBg: hexOr(o.iconBg, '#3a8dff'), splashBg: hexOr(o.splashBg, hexOr(root.background, '#000000')) };
}
/** Which permissions the game asks for (Game Settings › Permissions, nodes and triggers): for the app's iOS / Android declarations. */
function usedPermissions() {
  const out = new Set(), P = levelList()[0]?.settings?.permissions || {};
  for (const [k, v] of Object.entries(P)) if (v?.ask === 'first tap') out.add(k);
  const scan = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(scan); return; }
    if ((o.type === 'askPermission' || o.type === 'permStatus' || o.type === 'hasPermission') && o.params?.kind) out.add(o.params.kind);
    if (o.type === 'askPermission' && o.kind) out.add(o.kind); // trigger instruction
    if (o.action === 'ask permission' && o.value) out.add(String(o.value).trim().toLowerCase());
    if (['location', 'distanceTo', 'onLocation'].includes(o.type) && (o.params || o.links === undefined)) out.add('location');
    if (o.type === 'micLevel') out.add('microphone');
    for (const v of Object.values(o)) if (v && typeof v === 'object') scan(v); };
  for (const lv of levelList()) scan(lv.entities);
  return [...out].filter((k) => PERMISSIONS[k] && k !== 'notifications' && k !== 'storage');
}
/** Build Settings → App stores: a Capacitor project with a codemagic.yaml, as a .zip. */
async function exportStoreProject() {
  const so = { ...storeOpts(), perms: usedPermissions().map((k) => ({ kind: k, why: levelList()[0]?.settings?.permissions?.[k]?.why || PERMISSIONS[k].why })) };
  if (!validAppId(so.appId)) return toast('The App ID needs to look like com.yourname.game (letters, numbers, dots)');
  if (!so.ios && !so.android) return toast('Tick iOS, Android or both');
  try {
    toast('Making the app project…');
    const o = buildOpts(), b = await buildHTML({ native: true });
    const [icon, fg, splash, bg] = await Promise.all([makeIcon(o, 1024), makeSplash(o, 1024, 0.62, true), makeSplash(o), makeSplash({ ...o, splashBg: o.iconBg }, 1024, 0, false)].map((p) => p.then(dataBytes)));
    const zip = makeZip(storeFiles(so, { html: b.html, icon, fg, splash: { png: splash, bg } }));
    const a = h('a', { href: URL.createObjectURL(zip), download: slug(so.name) + '-app.zip' }); document.body.append(a); a.click(); a.remove();
    noteBuild('store', zip.size); toast(`App project ready (${kb(zip.size)}): put it on GitHub and open it in Codemagic. README.md has the steps.`);
  } catch (err) { toast('Could not make the app project: ' + err.message); }
}
/** Android's notification icon: a white bell on transparent (PNG). */
async function notifIconPNG(size = 96) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), k = size / 24;
  g.scale(k, k); g.fillStyle = '#ffffff';
  g.fill(new Path2D('M12,22c1.1,0 2,-0.9 2,-2h-4c0,1.1 0.9,2 2,2zM18,16v-5c0,-3.07 -1.64,-5.64 -4.5,-6.32V4c0,-0.83 -0.67,-1.5 -1.5,-1.5s-1.5,0.67 -1.5,1.5v0.68C7.63,5.36 6,7.92 6,11v5l-2,2v1h16v-1l-2,-2z'));
  return dataBytes(c.toDataURL('image/png'));
}
/** Build Settings → App stores: the game as an Expo app (WebView + native bridge), built with EAS. */
async function exportExpoProject() {
  const so = { ...storeOpts(), perms: usedPermissions().map((k) => ({ kind: k, why: levelList()[0]?.settings?.permissions?.[k]?.why || PERMISSIONS[k].why })) };
  if (!validAppId(so.appId)) return toast('The App ID needs to look like com.yourname.game (letters, numbers, dots)');
  try {
    toast('Making the Expo project…');
    const o = buildOpts(), b = await buildHTML({ native: true });
    const [icon, fg, splash] = await Promise.all([makeIcon(o, 1024), makeSplash(o, 1024, 0.62, true), makeSplash(o)].map((p) => p.then(dataBytes)));
    const zip = makeZip(expoFiles(so, { html: b.html, icon, fg, splash, notif: await notifIconPNG() }));
    const a = h('a', { href: URL.createObjectURL(zip), download: slug(so.name) + '-expo.zip' }); document.body.append(a); a.click(); a.remove();
    noteBuild('expo', zip.size); toast(`Expo project ready (${kb(zip.size)}): npm install, then npx expo start to try it, or eas build. README.md has the steps.`);
  } catch (err) { toast('Could not make the Expo project: ' + err.message); }
}
function buildFileName() { const o = buildOpts(); return slug(o.file || o.title || root.name) + '.html'; }
async function exportHTML() {
  try { const b = await buildHTML(); download(buildFileName(), b.html, 'text/html'); noteBuild('html', b.html.length); toast(`Build complete (${kb(b.html.length)}): open the file in any browser`); }
  catch (err) { toast('Build failed: ' + err.message); }
}
/**
 * A folder for a website: the game plus a service worker and manifest, so it installs to the Home Screen, works offline
 * and can show Phone Notifications on Android and on iPhone (once added to the Home Screen). Upload it to any https host.
 */
async function exportWebApp() {
  try {
    toast('Making the web app…');
    const o = buildOpts(), b = await buildHTML(), title = o.title || root.name || 'My Game', bg = hexOr(root.background, '#000000');
    const icon = await makeIcon(o, 512).then(dataBytes), theme = hexOr(o.themeColor, bg), splashBg = hexOr(o.splashBg, bg);
    const manifest = { name: title, short_name: (o.shortName || title).slice(0, 12), display: o.display || 'fullscreen', orientation: o.orientation || { portrait: 'portrait', landscape: 'landscape' }[root.settings?.orientation] || 'any',
      background_color: splashBg, theme_color: theme, start_url: './', scope: './', icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] };
    const html = b.html.replace(/<link rel="manifest" href="data:[^"]*">/, '<link rel="manifest" href="manifest.webmanifest">')
      .replace('</head>', `<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});</script>\n</head>`);
    const sw = `// ${title}: offline play and Phone Notifications (made with Pocket Engine)
const CACHE = 'game-${Date.now().toString(36)}', FILES = ['./', './index.html', './manifest.webmanifest', './icon-512.png'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((h) => h || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const key = (e.notification.data && e.notification.data.key) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((w) => 'focus' in w);
    if (c) { c.postMessage({ pocketNotify: key }); return c.focus(); }
    return self.clients.openWindow('./?notification=' + encodeURIComponent(key));
  }));
});
`;
    const readme = `# ${title} (web app)\n\nUpload everything in this folder to a website with **https** (GitHub Pages, Netlify, itch.io, your own host).\nOpen it on a phone and choose **Add to Home Screen**: it then runs full screen, works offline and can show Phone Notifications.\n\n- index.html: the game\n- sw.js: offline play, and opening the game when a notification is tapped\n- manifest.webmanifest, icon-512.png: the Home Screen app\n\nNotifications in a browser only arrive while the game is open (on iPhone, only once it's on the Home Screen). For reminders that arrive while the game is closed, make an iOS / Android app: Build Settings › App stores.\n`;
    const zip = makeZip([{ name: 'index.html', data: html }, { name: 'sw.js', data: sw }, { name: 'manifest.webmanifest', data: JSON.stringify(manifest, null, 2) }, { name: 'icon-512.png', data: icon }, { name: 'README.md', data: readme }]);
    const a = h('a', { href: URL.createObjectURL(zip), download: slug(title) + '-web.zip' }); document.body.append(a); a.click(); a.remove();
    noteBuild('web', zip.size); toast(`Web app ready (${kb(zip.size)}): upload the folder to an https website`);
  } catch (err) { toast('Could not make the web app: ' + err.message); }
}
async function shareBuild() {
  try {
    const b = await buildHTML(), file = new File([b.html], buildFileName(), { type: 'text/html' });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: b.title }); } catch { /* cancelled */ } return; }
    download(buildFileName(), b.html, 'text/html'); toast('Sharing files isn\'t available here, so it was downloaded');
  } catch (err) { toast('Build failed: ' + err.message); }
}
async function testBuild() {
  const w = window.open('', '_blank');
  try { const b = await buildHTML(), url = URL.createObjectURL(new Blob([b.html], { type: 'text/html' })); if (w) w.location = url; else location.assign(url); setTimeout(() => URL.revokeObjectURL(url), 60000); }
  catch (err) { w?.close(); toast('Build failed: ' + err.message); }
}

const ldOpen = new Set(['Background']); // which loading-screen groups are unfolded
/** Build Settings → Loading screen: presets, a live phone preview and every setting, in folding groups. */
function loadingDesigner(B, C, o, redo) {
  const frame = h('iframe', { class: 'ld-frame', title: 'Loading screen preview', sandbox: 'allow-scripts' });
  const doc = async (preview) => {
    const cur = buildOpts(), title = cur.title || root.name || 'My Game', bg = hexOr(root.background, '#000000');
    const L = loadingParts(cur, { title, icon: await makeIcon(cur, 180), bg, font: themeOf(root.settings).font, preview });
    const gfName = /^"([^"]+)", system-ui, sans-serif$/.exec(cur.nameFont || '')?.[1];
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${gfName ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(gfName).replace(/%20/g, '+')}&display=swap">` : ''}<style>html,body{margin:0;height:100%;background:${bg};overflow:hidden}${L.css}</style></head><body>${L.html}<div style="position:fixed;inset:0;display:grid;place-items:center;color:#fff8;font:600 15px system-ui;z-index:0">Your game starts here</div><script>${L.js}</script></body></html>`;
  };
  let tm = 0;
  const refresh = () => { clearTimeout(tm); tm = setTimeout(async () => { frame.srcdoc = await doc(true); }, 150); };
  refresh();
  const full = async () => { // the real thing, full screen: fills up, waits, leaves, then offers to replay
    const f = h('iframe', { class: 'ld-full-frame', sandbox: 'allow-scripts' });
    const play = async () => { const d = await doc(false); f.srcdoc = d.replace('</body>', `<script>var s=[0.2,0.45,0.5,0.75,0.9,1],i=0;var iv=setInterval(function(){PocketLoading.set(s[i++]);if(i>=s.length){clearInterval(iv);PocketLoading.done(function(){})}},400);</script></body>`); };
    const wrap = h('div', { class: 'ld-full' }, f, h('div', { class: 'ld-full-btns' },
      h('button', { class: 'btn', onclick: play }, icon('redo'), 'Replay'), h('button', { class: 'btn primary', onclick: () => wrap.remove() }, icon('close'), 'Close')));
    document.body.append(wrap); play();
  };
  const fonts = [['', 'Game font'], ...FONTS.filter(([v]) => v !== 'theme'), ...(root.settings?.fonts || []).filter(Boolean).map((n) => [googleFont(n), n + ' (Google)'])];
  const pic = (key, label, max) => h('div', { class: 'row full' }, h('label', {}, label), h('div', { class: 'pair img-pick' },
    o[key] ? h('img', { class: 'img-thumb', src: o[key], alt: '' }) : h('span', { class: 'muted' }, 'None'),
    h('button', { type: 'button', class: 'btn', onclick: () => pickImage((url) => { B()[key] = url; changed(); redo(); }, max) }, o[key] ? 'Change' : 'Choose image'),
    o[key] ? h('button', { type: 'button', class: 'btn', onclick: () => { B()[key] = ''; changed(); redo(); } }, 'Clear') : null));
  const R = C;
  const sel = (path, spec) => { const el = C(path, spec); el.querySelector('select')?.addEventListener('change', redo); return el; };
  const group = (title, kids) => h('details', { class: 'ld-group', open: ldOpen.has(title), ontoggle: (e) => { if (e.target.open) ldOpen.add(title); else ldOpen.delete(title); } }, h('summary', {}, title), kids);
  const hasAmount = !['dots', 'spinner', 'none'].includes(o.bar);
  const wrap = h('div', { class: 'ld' },
    h('div', { class: 'ld-top' },
      h('div', { class: 'ld-phone' }, frame),
      h('div', { class: 'ld-side' },
        h('div', { class: 'ld-presets' }, Object.keys(LOADING_PRESETS).map((n) => h('button', { type: 'button', class: 'btn', onclick: () => { Object.assign(B(), LOADING_PRESETS[n]); changed(); redo(); toast(n + ' look'); } }, n))),
        h('button', { type: 'button', class: 'btn', onclick: full }, icon('play'), 'Preview'))),
    sel('splash', { label: 'Show', type: 'select', options: [['logo', 'Picture and name'], ['text', 'Name and text only'], ['none', 'Nothing (start right away)']] }),
    o.splash !== 'none' && [
      group('Background', [
        R('splashBg', { label: 'Colour', type: 'color', optional: true }),
        R('splashBg2', { label: 'Second colour', type: 'color', optional: true }),
        o.splashBg2 && R('splashGrad', { label: 'Blend', type: 'select', options: [['down', 'Top to bottom'], ['across', 'Left to right'], ['diagonal', 'Diagonal'], ['glow', 'Glow from the middle']] }),
        pic('splashImage', 'Picture', 1280),
        o.splashImage && [R('splashFit', { label: 'Picture fits', type: 'select', options: [['cover', 'Fill the screen'], ['contain', 'Whole picture'], ['tile', 'Repeat (tiles)']] }),
          R('splashDim', { label: 'Darken picture', type: 'number', step: 0.05, range: [0, 0.9] })],
      ]),
      group('Logo and name', [
        o.splash === 'logo' && [
          sel('logo', { label: 'Picture', type: 'select', options: [['icon', 'The app icon'], ['picture', 'Another picture'], ['none', 'None']] }),
          o.logo === 'picture' && pic('logoImage', 'Logo picture', 512),
          o.logo !== 'none' && [R('logoSize', { label: 'Size', type: 'number', step: 8, range: [40, 220] }),
            R('logoShape', { label: 'Shape', type: 'select', options: [['rounded', 'Rounded square'], ['circle', 'Circle'], ['square', 'Square'], ['none', 'As it is (no frame)']] }),
            R('logoAnim', { label: 'Animation', type: 'select', options: [['none', 'None'], ['pulse', 'Pulse'], ['bounce', 'Bounce'], ['float', 'Float'], ['spin', 'Spin'], ['glow', 'Glow']] })],
        ],
        R('showName', { label: 'Show the name', type: 'bool' }),
        R('nameFont', { label: 'Font', type: 'select', options: fonts }),
        R('nameColor', { label: 'Colour', type: 'color' }),
        R('nameSize', { label: 'Size', type: 'number', step: 2, range: [12, 60] }),
      ]),
      group('Loading bar', [
        h('div', { class: 'ld-bars' }, BAR_STYLES.map(([v, l]) => h('button', { type: 'button', class: 'btn' + (o.bar === v ? ' primary' : ''), onclick: () => { B().bar = v; changed(); redo(); } }, l))),
        o.bar !== 'none' && [
          R('barColor', { label: 'Colour', type: 'color' }),
          hasAmount && o.bar !== 'ring' && o.bar !== 'blocks' && R('barColor2', { label: 'Blend to', type: 'color', optional: true }),
          R('barTrack', { label: 'Empty part', def: '', placeholder: 'rgba(255,255,255,0.18)' }),
          hasAmount && R('barWidth', { label: 'Width', type: 'number', step: 10, range: [60, 340] }),
          R('barPos', { label: 'Where', type: 'select', options: [['under', 'Under the name'], ['bottom', 'Near the bottom']] }),
          hasAmount && R('barLabel', { label: 'Label', def: '', placeholder: o.bar === 'thick' || o.bar === 'ring' ? '{percent}%' : 'e.g. Loading… {percent}%' }),
          hasAmount && h('p', { class: 'desc' }, 'The bar follows the real loading: unpacking the game, then its pictures and fonts. {percent} shows the amount.'),
        ],
      ]),
      group('Text and tips', [
        R('splashText', { label: 'Text', def: '' }),
        R('textColor', { label: 'Text colour', type: 'color', optional: true }),
        R('tips', { label: 'Tips (separate with |)', def: '', placeholder: 'Tip: jump twice to fly | Tip: coins buy hats' }),
        R('tipEvery', { label: 'Next tip every (sec)', type: 'number', step: 0.5, range: [1, 10] }),
        R('credit', { label: '“Made with Pocket Engine”', type: 'bool' }),
      ]),
    ],
    group('Finish', [
      R('splashTime', { label: 'Show for at least (sec)', type: 'number', step: 0.5, range: [0, 6] }),
      R('tapToStart', { label: 'Tap to Start', type: 'bool' }),
      R('tapText', { label: 'Tap text', def: 'Tap to start' }),
      R('exit', { label: 'Leaves with', type: 'select', options: [['fade', 'Fade'], ['slide up', 'Slide up'], ['zoom', 'Zoom'], ['wipe', 'Circle wipe'], ['none', 'Cut']] }),
      h('p', { class: 'desc' }, 'Tap to Start waits for a tap before the game begins, so sounds and music can play straight away (phones need a tap first).'),
    ]),
  );
  wrap.addEventListener('input', refresh);
  wrap.addEventListener('change', (e) => { refresh(); if (e.target.matches('input[type=checkbox], select') && !e.target.closest('.ld-top')) redo(); }); // fields that show or hide other fields
  return wrap;
}

/** Remember the last build (Build Settings shows it, and warns when a store upload would reuse a version number). */
function noteBuild(target, size) {
  const B = (root.build ||= {}), v = B.version || BUILD_DEFAULTS.version;
  B.last = { target, at: Date.now(), size, version: v };
  if (target === 'store' || target === 'expo') B.lastStoreVersion = v;
  changed(); if ($('.dialog .build-sec')) setTimeout(() => { const db = $('.dialog .db'), sc = db?.scrollTop; openBuildSettings(); if ($('.dialog .db')) $('.dialog .db').scrollTop = sc; }, 50);
}
const BUILD_TARGETS = [
  ['html', 'newfile', 'Play file', 'One .html file. Send it or open it in any browser; works offline.', 'Build play file'],
  ['web', 'globe', 'Website', 'A folder for itch.io, GitHub Pages or Netlify. Installs to the Home Screen.', 'Download website (.zip)'],
  ['store', 'phone', 'App Store & Google Play', 'An app project that Codemagic builds and uploads for you.', 'Download app project (.zip)'],
  ['expo', 'bolt', 'Expo app', 'An Expo project to build and publish with EAS.', 'Download Expo project (.zip)'],
];
const ICON_EMOJI = ['🎮', '🚀', '⭐', '👾', '🐱', '🐶', '🦄', '🐉', '🧩', '🏎️', '⚔️', '🏰', '💎', '🍀', '🎵', '📝', '✅', '💰', '📚', '❤️'];
const ICON_BG = ['#3a8dff', '#6c5ce7', '#e84393', '#ff4757', '#ff7a1a', '#f5b700', '#22b573', '#00b8d9', '#111827', '#ffffff'];
/** "1.4" → "1.5" (small update) or "2.0" (big update); "1.4.2" → "1.4.3". */
function bumpVersion(v, big) {
  const n = String(v || '1.0').split('.').map((x) => parseInt(x, 10) || 0);
  if (big) return `${n[0] + 1}.0`;
  if (n.length >= 3) { n[n.length - 1]++; return n.join('.'); }
  return `${n[0]}.${(n[1] || 0) + 1}`;
}
/** What to look at before building: each check is ok / warn / bad (bad stops a store build), with a Fix where one helps. */
function buildChecks(o, target, jump) {
  const B = () => (root.build ||= {}), out = [], add = (lvl, text, fix) => out.push({ lvl, text, fix });
  const name = (o.title || root.name || '').trim(), store = target === 'store' || target === 'expo';
  if (!name || /^(untitled|my game|new game|my app|new app)( \d+)?$/i.test(name)) add('warn', `The name is still “${name || 'empty'}”`, ['Change', () => jump('title')]);
  else add('ok', `Name: ${name}`);
  if (!o.icon && (o.iconEmoji || '🎮') === '🎮' && hexOr(o.iconBg, '#3a8dff') === '#3a8dff') add('warn', 'Still the default icon', ['Pick one', () => jump('icon')]);
  else add('ok', 'Icon chosen');
  if (!/^\d+(\.\d+){0,2}$/.test(String(o.version || ''))) add('bad', `“${o.version}” is not a version number (use 1.0, 1.2 or 2.0.1)`, ['Use 1.0', () => { B().version = '1.0'; }]);
  else if (store && B().lastStoreVersion && B().lastStoreVersion === o.version) add('warn', `Version ${o.version} was already sent to the stores: they need a new number for every upload`, [`Make it ${bumpVersion(o.version)}`, () => { B().version = bumpVersion(o.version); }]);
  else add('ok', `Version ${o.version}`);
  if ((target !== 'html') && !String(o.description || '').trim()) add('warn', 'No description (used for link previews and store listings)', ['Write one', () => jump('description')]);
  const lv = levelList();
  if (lv.length > 1 && +o.startLevel > 1) add('warn', `Starts at level ${o.startLevel} (handy for testing, but players start there too)`, ['Start at 1', () => { B().startLevel = '1'; }]);
  const skipped = lv.filter((l) => l.buildSkip).length; if (skipped) add('warn', `${skipped} level${skipped > 1 ? 's are' : ' is'} left out`, ['Show', () => jump('levels')]);
  if (o.showFps || o.showErrors) add('warn', 'Testing options are on (frame rate / errors on screen)', ['Turn off', () => { B().showFps = false; B().showErrors = false; }]);
  if (!o.compress) add('warn', 'Compression is off: the file is about 3× bigger', ['Turn on', () => { B().compress = true; }]);
  if (store) {
    const so = storeOpts();
    if (!validAppId(so.appId)) add('bad', 'The App ID needs to look like com.yourname.game', ['Use ' + suggestAppId(o.author, name), () => { B().appId = suggestAppId(o.author, name); }]);
    else add('ok', `App ID: ${so.appId}${o.appId ? '' : ' (suggested)'}`, !o.appId ? ['Keep it', () => { B().appId = so.appId; }] : null);
    if (target === 'store' && !so.ios && !so.android) add('bad', 'Pick iOS, Android or both', ['Both', () => { B().storeIOS = true; B().storeAndroid = true; }]);
    if (!o.author) add('warn', 'No “Made by” name (shown in the stores)', ['Add it', () => jump('author')]);
  }
  return out;
}
function openBuildSettings() {
  saveNow();
  const B = () => { root.build ||= {}; return root.build; }, o = buildOpts();
  const C = (path, spec) => control(B, path, { def: BUILD_DEFAULTS[path], ...spec, structure: false });
  const redo = () => setTimeout(() => { if (!$('.dialog .build-sec')) return; document.activeElement?.blur?.(); const sc = $('.dialog .db')?.scrollTop; openBuildSettings(); const db = $('.dialog .db'); if (db) db.scrollTop = sc; });
  const SEC_ID = { App: 'app', Icon: 'icon', 'Loading screen': 'loading', Levels: 'levels', Player: 'player', 'Web app': 'web', 'App stores (iOS & Android)': 'stores', 'File size': 'size', Testing: 'testing' };
  const sec = (title, ic, kids) => h('div', { class: 'build-sec', id: 'bs-' + (SEC_ID[title] || title) }, h('h4', {}, icon(ic), title), kids);
  const Cr = (path, spec) => { const el = C(path, spec); el.addEventListener('change', redo); return el; }; // a field that shows or hides others
  const preview = h('img', { class: 'build-icon', alt: '' }); makeIcon(o, 180).then((u) => { preview.src = u; });
  const report = h('div', { class: 'build-report' }, h('div', { class: 'muted' }, 'Working out the size…'));
  const lvls = levelList();

  const updateReport = async () => {
    try {
      const { game } = buildGameJSON(), r = sizeReport(game), b = await buildHTML();
      const row = (l, v, cls = '') => h('div', { class: 'br-row ' + cls }, h('span', {}, l), h('b', {}, v));
      report.replaceChildren(...[
        row('Total file size', kb(b.html.length), 'total'),
        row('Engine', kb(b.engineBytes)),
        row('Game data', kb(b.gameBytes)),
        r.pictures ? row('· pictures', kb(r.pictures)) : null,
        r.sounds ? row('· sounds', kb(r.sounds)) : null,
        r.top.length ? h('div', { class: 'br-sub' }, 'Biggest files: ' + r.top.map((a) => `${a.where === 'game' ? root.name : a.where} (${a.kind}, ${kb(a.size)})`).join(', ')) : null,
        b.html.length > 15 * 1048576 ? h('p', { class: 'desc warn' }, 'This is a big file. Smaller pictures and shorter sounds make it load faster.') : null,
        !o.compress ? h('p', { class: 'desc' }, 'Tip: turn on Compress to make the file about 3× smaller.') : null].filter(Boolean));
    } catch (err) { report.replaceChildren(h('div', { class: 'muted' }, 'Could not measure: ' + err.message)); }
  };

  const target = BUILD_TARGETS.some((t) => t[0] === o.target) ? o.target : 'html', T = BUILD_TARGETS.find((t) => t[0] === target);
  let showAll = false; try { showAll = localStorage.getItem('pocket.build.all') === '1'; } catch { /* storage unavailable */ }
  const want = (k) => showAll || ({ web: ['html', 'web'], stores: ['store', 'expo'] }[k] || []).includes(target); // sections that only matter for some kinds of build
  const jump = (key) => { // scroll to a field (or section) and highlight it
    const el = $(`.dialog [data-bkey="${key}"]`) || $(`.dialog #bs-${key}`); if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(() => el.querySelector('input, select, textarea')?.focus({ preventScroll: true }), 350);
    return true; // (a Fix that only shows where to look: no need to redraw)
  };
  const tag = (el, key) => { el?.setAttribute?.('data-bkey', key); return el; };
  const checkBox = h('div', { class: 'build-check' });
  const drawChecks = () => {
    const list = buildChecks(buildOpts(), target, jump), bad = list.filter((c) => c.lvl === 'bad').length, warn = list.filter((c) => c.lvl === 'warn').length;
    checkBox.replaceChildren(
      h('div', { class: 'bc-head ' + (bad ? 'bad' : warn ? 'warn' : 'ok') }, icon(bad ? 'warn' : warn ? 'info' : 'check'), h('b', {}, bad ? `${bad} thing${bad > 1 ? 's' : ''} to fix first` : warn ? `Ready, with ${warn} thing${warn > 1 ? 's' : ''} to look at` : 'Ready to build'),
        h('button', { type: 'button', class: 'btn', onclick: () => { Object.assign(B(), { compress: true, showFps: false, showErrors: false, startLevel: '1', keepAwake: true, pauseHidden: true, backGesture: true, noMenu: true }); changed(); redo(); toast('Recommended settings on'); } }, icon('star'), 'Recommended')),
      ...list.map((c) => h('div', { class: 'bc-row ' + c.lvl }, h('span', { class: 'bc-dot' }, c.lvl === 'ok' ? '✓' : c.lvl === 'bad' ? '✕' : '!'), h('span', { class: 'bc-t' }, c.text),
        c.fix && h('button', { type: 'button', class: 'btn', onclick: () => { const r = c.fix[1](); if (r === undefined) { changed(); redo(); } } }, c.fix[0]))));
  };
  const last = o.last;
  const go = { html: exportHTML, web: exportWebApp, store: exportStoreProject, expo: exportExpoProject }[target];
  const homeMock = h('div', { class: 'home-mock' }, ['light', 'dark'].map((m) => h('div', { class: 'hm ' + m }, h('img', { class: 'hm-ic', alt: '' }), h('small', {}, (o.shortName || o.title || root.name || 'Game').slice(0, 12)))));
  makeIcon(o, 120).then((u) => homeMock.querySelectorAll('.hm-ic').forEach((i) => { i.src = u; }));
  const sections = [['app', 'App'], ['icon', 'Icon'], ['loading', 'Loading'], ['levels', 'Levels'], ['player', 'Player'], want('web') && ['web', 'Web app'], want('stores') && ['stores', target === 'expo' ? 'Expo' : 'Stores'], ['size', 'Size'], ['testing', 'Testing']].filter(Boolean);

  openDialog('Build Settings', [
    h('h4', { class: 'bt-q' }, 'What are you making?'),
    h('div', { class: 'build-targets' }, BUILD_TARGETS.map(([k, ic, label, desc]) => h('button', { type: 'button', class: 'bt' + (k === target ? ' on' : ''), onclick: () => { B().target = k; changed(); redo(); } }, icon(ic), h('b', {}, label), h('small', {}, desc)))),
    last && h('p', { class: 'desc build-last' }, `Last built ${ago(last.at)}: ${BUILD_TARGETS.find((t) => t[0] === last.target)?.[2] || last.target}, version ${last.version}, ${kb(last.size || 0)}`),
    checkBox,
    h('div', { class: 'build-jump' }, sections.map(([k, l]) => h('button', { type: 'button', class: 'chip', onclick: () => jump(k) }, l)),
      h('label', { class: 'chk bj-all' }, h('input', { type: 'checkbox', checked: showAll, onchange: (e) => { try { localStorage.setItem('pocket.build.all', e.target.checked ? '1' : '0'); } catch { /* storage unavailable */ } redo(); } }), 'Every setting')),
    sec('App', 'phone', [
      h('div', { class: 'build-app' }, preview, h('div', { class: 'build-app-t' }, h('b', {}, o.title || root.name), h('small', {}, [o.version && 'Version ' + o.version, o.author].filter(Boolean).join(' · ') || 'Pocket Engine game'))),
      tag(C('title', { label: 'Name', def: root.name }), 'title'),
      tag(C('version', { label: 'Version' }), 'version'),
      h('div', { class: 'row' }, h('label', {}, 'Next version'), h('div', { class: 'pair' },
        h('button', { type: 'button', class: 'btn', onclick: () => { B().version = bumpVersion(o.version); changed(); redo(); } }, `Small update → ${bumpVersion(o.version)}`),
        h('button', { type: 'button', class: 'btn', onclick: () => { B().version = bumpVersion(o.version, true); changed(); redo(); } }, `Big → ${bumpVersion(o.version, true)}`))),
      tag(C('author', { label: 'Made by' }), 'author'),
      tag(C('description', { label: 'Description' }), 'description'),
      C('file', { label: 'File name', def: slug(o.title || root.name) }),
    ]),
    sec('Icon', 'image', [
      h('div', { class: 'row full' }, h('label', {}, 'Picture'), h('div', { class: 'pair img-pick' },
        o.icon ? h('img', { class: 'img-thumb', src: o.icon, alt: '' }) : h('span', { class: 'muted' }, 'Emoji'),
        h('button', { type: 'button', class: 'btn', onclick: () => pickImage((url) => { B().icon = url; changed(); redo(); }, 512) }, o.icon ? 'Change' : 'Choose image'),
        o.icon ? h('button', { type: 'button', class: 'btn', onclick: () => { B().icon = ''; changed(); redo(); } }, 'Clear') : null)),
      !o.icon && h('div', { class: 'row' }, h('label', {}, 'Emoji'), h('input', { type: 'text', value: o.iconEmoji, maxLength: 8, onchange: (e) => { B().iconEmoji = e.target.value.trim() || '🎮'; changed(); redo(); } })),
      !o.icon && h('div', { class: 'icon-picks' }, ICON_EMOJI.map((em) => h('button', { type: 'button', class: 'ip' + ((o.iconEmoji || '🎮') === em ? ' on' : ''), onclick: () => { B().iconEmoji = em; changed(); redo(); } }, em))),
      h('div', { class: 'row' }, h('label', {}, 'Background'), h('input', { type: 'color', value: hexOr(o.iconBg, '#3a8dff').slice(0, 7), onchange: (e) => { B().iconBg = e.target.value; changed(); redo(); } })),
      h('div', { class: 'icon-picks bg' }, ICON_BG.map((c) => h('button', { type: 'button', class: 'ip sw' + (hexOr(o.iconBg, '#3a8dff').toLowerCase() === c ? ' on' : ''), style: `background:${c}`, title: c, onclick: () => { B().iconBg = c; changed(); redo(); } }))),
      homeMock,
      h('p', { class: 'desc' }, 'Shown on the Home Screen (above, on a light and a dark wallpaper), in the browser tab and on the loading screen.'),
    ]),
    sec('Loading screen', 'clock', loadingDesigner(B, C, o, redo)),
    sec('Levels', 'layers', [
      lvls.length > 1 ? h('div', { class: 'build-lvls' }, lvls.map((lv, i) => h('label', { class: 'build-lvl' },
        h('input', { type: 'checkbox', checked: !lv.buildSkip, disabled: i === 0, onchange: (e) => { if (e.target.checked) delete lv.buildSkip; else lv.buildSkip = true; changed(); updateReport(); } }),
        h('span', {}, `${i + 1}. ${levelName(lv, i)}`), i === 0 ? h('small', {}, 'always included') : null))) : h('p', { class: 'desc' }, 'One level. Add more with ☰ → Levels.'),
      lvls.length > 1 && C('startLevel', { label: 'Start at level', type: 'select', def: '1', options: lvls.map((lv, i) => [String(i + 1), `${i + 1}. ${levelName(lv, i)}`]) }),
      lvls.length > 1 && h('p', { class: 'desc' }, 'Untick a level to leave it out (unfinished levels). Starting at a later level is handy for testing it.'),
    ]),
    sec('Player', 'gamepad', [
      C('quality', { label: 'Graphics', type: 'select', options: [['battery', 'Battery saver (fastest)'], ['balanced', 'Balanced'], ['sharp', 'Sharpest (slower)']] }),
      C('backGesture', { label: 'Back gesture goes back in menus', type: 'bool' }),
      C('noMenu', { label: 'Block long-press menus and text selection', type: 'bool' }),
      h('p', { class: 'desc' }, `Plays ${{ portrait: 'in portrait', landscape: 'in landscape', any: 'either way up' }[orientationOf()]} (change it in Scene Settings). Fullscreen, pause, mute and save options are in Scene Settings too.`),
    ]),
    want('web') && sec('Web app', 'globe', [
      h('p', { class: 'desc' }, 'How the game looks and behaves once it is added to the Home Screen (or opened in a browser).'),
      Cr('installable', { label: 'Can be added to the Home Screen', type: 'bool' }),
      o.installable !== false && [
        C('shortName', { label: 'Home Screen name (short)', def: '', placeholder: (o.title || root.name || '').slice(0, 12) }),
        C('display', { label: 'Opens', type: 'select', options: [['fullscreen', 'Full screen (no bars)'], ['standalone', 'Like an app (keeps the status bar)'], ['minimal-ui', 'With small browser buttons'], ['browser', 'In the browser']] }),
        Cr('installHint', { label: 'Suggest installing', type: 'select', options: [['off', 'Never'], ['start', 'Shortly after it starts'], ['end', 'After a game ends']], infoText: 'A small bar with an Install button (Android) or the steps (iPhone). Never shows once the game is installed, and a player can close it.' }),
        o.installHint && o.installHint !== 'off' && C('installText', { label: 'Install message', def: BUILD_DEFAULTS.installText }),
      ],
      C('orientation', { label: 'Screen orientation', type: 'select', options: [['', `Same as the game (${orientationOf()})`], ['portrait', 'Portrait'], ['landscape', 'Landscape'], ['any', 'Either way']] }),
      C('themeColor', { label: 'Browser bar colour', type: 'color', optional: true, infoText: 'The colour of the status bar / browser bar. Empty = the game\'s background.' }),
      C('statusBar', { label: 'iPhone status bar', type: 'select', options: [['black-translucent', 'See-through (game behind it)'], ['black', 'Black'], ['default', 'White']] }),
      C('pauseHidden', { label: 'Pause when switching apps', type: 'bool' }),
      C('keepAwake', { label: 'Keep the screen on while playing', type: 'bool' }),
      C('confirmLeave', { label: 'Ask before leaving mid-game', type: 'bool', infoText: 'Browsers ask "Leave site?" if the page is closed or reloaded while playing.' }),
      C('social', { label: 'Link preview (title and description)', type: 'bool' }),
      C('lang', { label: 'Language code', def: 'en', placeholder: 'en, fr, es…' }),
      C('headHTML', { label: 'Extra code in <head> (advanced)', type: 'code', def: '', placeholder: '<script>…analytics…</script>', infoText: 'Pasted into every build as-is: analytics, fonts, meta tags. Only paste code you trust.' }),
    ]),
    want('stores') && sec('App stores (iOS & Android)', 'phone', (() => {
      const so = storeOpts(), idOk = validAppId(so.appId);
      return [
        h('p', { class: 'desc' }, 'Publish to the App Store and Google Play with Codemagic, a cloud build service. No Mac or Android Studio needed. Download the app project, put it on GitHub, open it on codemagic.io and start a build: README.md inside walks you through the one-time setup.'),
        Cr('appId', { label: 'App ID (bundle ID / package name)', def: '', placeholder: suggestAppId(o.author, o.title || root.name), infoText: 'Unique, like com.yourname.game. It can never change after the first store release.' }),
        !idOk && h('p', { class: 'desc warn' }, 'Use letters, numbers and dots only, like com.yourname.game (each part starts with a letter).'),
        h('div', { class: 'row' }, h('label', {}, 'Platforms'), h('div', { class: 'pair' },
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.storeIOS !== false, onchange: (e) => { B().storeIOS = e.target.checked; changed(); redo(); } }), 'iOS'),
          h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: o.storeAndroid !== false, onchange: (e) => { B().storeAndroid = e.target.checked; changed(); redo(); } }), 'Android'))),
        o.storeIOS !== false && [
          Cr('iosPublish', { label: 'iOS: send it to', type: 'select', options: [['testflight', 'TestFlight (test on your iPhone)'], ['review', 'TestFlight, then App Store review'], ['none', 'Nowhere (just build the .ipa)']] }),
          C('iosDevices', { label: 'iOS devices', type: 'select', options: [['iphone', 'iPhone only'], ['universal', 'iPhone and iPad']], infoText: 'iPad needs iPad screenshots in App Store Connect too.' }),
          C('ascIntegration', { label: 'App Store Connect key name in Codemagic', def: 'codemagic' }),
        ],
        o.storeAndroid !== false && [
          Cr('androidTrack', { label: 'Android: publish to', type: 'select', options: [['internal', 'Internal testing'], ['alpha', 'Closed testing (alpha)'], ['beta', 'Open testing (beta)'], ['production', 'Production (everyone)'], ['none', 'Nowhere (just build the .aab)']] }),
          o.androidTrack !== 'none' && C('playDraft', { label: 'First release (app still a draft on Google Play)', type: 'bool', infoText: 'Google only accepts drafts until the app has been reviewed once. Turn this off afterwards.' }),
          C('keystoreRef', { label: 'Keystore name in Codemagic', def: 'keystore_reference' }),
          o.androidTrack !== 'none' && C('playGroup', { label: 'Google Play key group in Codemagic', def: 'google_play' }),
        ],
        C('storeFullscreen', { label: 'Full screen (hide the status bar)', type: 'bool' }),
        C('buildOffset', { label: 'Add to build numbers', type: 'number', step: 1, infoText: 'Each Codemagic build gets the next number. Add to it if you already uploaded builds from somewhere else.' }),
        C('notifyEmail', { label: 'Email me when a build finishes', def: '', placeholder: 'you@example.com' }),
        h('p', { class: 'desc' }, `Version ${o.version || '1.0'} (from App above) · ${so.orientation || 'either way up'} · icon and splash from Icon and Loading screen above.`),
        h('div', { class: 'btns' }, h('button', { class: 'btn primary', disabled: !idOk || (!so.ios && !so.android), onclick: exportStoreProject }, icon('download'), 'Download app project (.zip)')),
        h('h4', { class: 'sub-h' }, 'Or with Expo'),
        h('p', { class: 'desc' }, 'Prefer Expo (expo.dev)? Download an Expo project instead: the game in a full-screen WebView, with phone notifications, haptics, permissions and the Android Back button through Expo’s modules (SDK 57). Try it in the Expo Go app with npx expo start, then build and publish with EAS (eas build, eas submit). Uses the same App ID, version, orientation, icon and splash as above.'),
        h('div', { class: 'btns' }, h('button', { class: 'btn', disabled: !idOk, onclick: exportExpoProject }, icon('download'), 'Download Expo project (.zip)')),
      ];
    })()),
    sec('File size', 'download', [
      C('compress', { label: 'Compress (much smaller file)', type: 'bool' }),
      h('p', { class: 'desc' }, 'Needs a browser from 2023 or later (iOS 16.4+). Turn it off for very old phones.'),
      report,
    ]),
    sec('Testing', 'bulb', [
      C('showFps', { label: 'Show frame rate', type: 'bool' }),
      C('showErrors', { label: 'Show errors on screen', type: 'bool' }),
      h('p', { class: 'desc' }, 'Handy while testing on another phone. Turn them off for the finished game.'),
    ]),
    h('div', { class: 'btns build-btns' },
      h('button', { class: 'btn primary', onclick: () => { if (buildChecks(buildOpts(), target, jump).some((c) => c.lvl === 'bad')) { checkBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); return toast('Fix the red items first'); } go(); } }, icon('download'), T[4]),
      target === 'html' && h('button', { class: 'btn', onclick: shareBuild }, icon('external'), 'Share'),
      h('button', { class: 'btn', onclick: testBuild }, icon('play'), 'Test')),
  ]);
  drawChecks();
  // settings that change the look or size refresh the report when edited
  $('.dialog .db').addEventListener('change', () => {
    if (root.build && !root.build.title) delete root.build.title; updateReport(); drawChecks();
  });
  updateReport();
}

// ============================================================================
// Play mode
// ============================================================================
let sheetBeforePlay = null;
function play() {
  if (playing) return;
  closeLayer();
  document.activeElement?.blur?.();
  playing = true;
  sheetBeforePlay = sheetState(); if (!isDesktop() && sheetBeforePlay !== 'peek') setSheet('peek'); // the game gets the whole screen
  updateCtxBar();
  document.body.classList.add('playing');
  $('#playBar').hidden = false; pbOpen = false; applyPlayDock();
  $('#playBtn').classList.add('on'); $('#playBtn').replaceChildren(icon('stop'), h('span', {}, 'Stop'));
  engine.editing = false; engine.letterbox = true; // a landscape game plays in a landscape box even on a portrait phone
  engine.input.enabled = true;
  engine.timeScale = 1;
  if (clearOnPlay()) { Log.clear(); consoleSeen = 0; }
  playStartedAt = Date.now();
  const json = clone(root);
  for (const lv of [json, ...(json.levels || [])]) lv.settings = { ...lv.settings, pauseButton: false, muteButton: false, fullscreen: false, saveProgress: false, loadOnStart: false };
  try {
    engine.start(json, { level: levelIdx });
    if (engine.scene.state === 'title') engine.scene.state = 'play';
  } catch (err) { Log.add('error', `The game couldn't start: ${err.message}`, 'game'); toast('Error: ' + err.message + ' (see Console)'); stop(); return; }
  updatePauseButtons();
  pushBack(stop);
  store.set('pocket.editor.played.' + projectId, '1');
  requestAnimationFrame(() => { engine.fitScreen(); engine.resize(); engine.layoutButtons(); if (engine.boxed) toast(`A ${orientationOf()} game: turn your phone to play it full screen`); });
}
function stop() {
  if (!playing) return;
  playing = false;
  dropBack(stop);
  if (sheetBeforePlay && sheetBeforePlay !== 'peek' && !isDesktop()) setSheet(sheetBeforePlay); sheetBeforePlay = null;
  document.body.classList.remove('playing');
  $('#playBar').hidden = true; $('#playConsole').hidden = true; applyPlayDock();
  engine.inspecting = false; inspectId = null; $('#playInspect').hidden = true; clearInterval(inspectTimer);
  if (!$('#playStats').hidden) toggleStats();
  $('#playBtn').classList.remove('on'); $('#playBtn').replaceChildren(icon('play'), h('span', {}, 'Play'));
  engine.editing = true;
  engine.paused = false;
  engine.input.enabled = false;
  engine.input.reset(true);
  engine.closeSettings?.(true); // a player Settings panel left open
  engine.timeScale = 1;
  engine.factory = null;
  updatePauseButtons();
  updateCtxBar();
  renderHierarchy();
  requestAnimationFrame(() => { engine.resize(); rebuild(); });
}
function togglePause() { if (!playing) return; engine.paused = !engine.paused; if (!engine.paused) setInspecting(false); updatePauseButtons(); }
function updatePauseButtons() {
  $('#pauseBtn').disabled = !playing;
  for (const b of [$('#pauseBtn'), $('#pbPause')]) b.classList.toggle('on', playing && engine.paused);
  $('#pbStep').disabled = !(playing && engine.paused);
  $('#pbInspect').classList.toggle('on', !!engine.inspecting);
}

// ---- play mode tools (Unity's Step, Stats and play-mode Inspector) ----
let inspectId = null, statsTimer = 0, inspectTimer = 0;
function setInspecting(on) {
  engine.inspecting = on;
  if (on) { engine.paused = true; engine.input.enabled = false; engine.input.reset(); toast('Paused. Tap an object to inspect it.'); }
  else { engine.input.enabled = playing; inspectId = null; $('#playInspect').hidden = true; clearInterval(inspectTimer); }
  updatePauseButtons();
}
function toggleStats() {
  const el = $('#playStats'); el.hidden = !el.hidden; $('#pbStats').classList.toggle('on', !el.hidden);
  clearInterval(statsTimer);
  if (el.hidden) return;
  const draw = () => {
    const s = engine.scene; if (!s) return;
    const live = s.entities.filter((e) => !e.dead), vars = Object.entries(s.vars).filter(([, v]) => typeof v !== 'object').slice(0, 8);
    el.replaceChildren(...[['FPS', Math.round(engine.fps)], ['Objects', live.length], ['Bodies', live.filter((e) => e.body).length], ['State', engine.paused ? 'paused' : s.state], ['Time', s.time.toFixed(1) + 's'], ['Pixels', `×${engine.dpr}`], ...vars.map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : String(v)])]
      .map(([k, v]) => h('div', {}, h('span', {}, k), h('b', { class: k === 'FPS' && v < 40 ? 'bad' : '' }, v))));
  };
  draw(); statsTimer = setInterval(draw, 250);
}
/** Live values of the inspected object, refreshed while you look (fields you're typing in are left alone). */
function renderInspectCard() {
  const box = $('#playInspect'), s = engine.scene, e = inspectId && s.byId(inspectId);
  if (!e || e.dead) { box.hidden = true; return; }
  box.hidden = false;
  const r = (v) => Math.round((+v || 0) * 100) / 100, three = s.mode === '3d';
  const num = (label, get, set) => h('label', { class: 'pi-f' }, h('span', {}, label), h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: r(get()), 'data-live': label,
    oninput: (ev) => { const n = parseFloat(ev.target.value); if (!Number.isNaN(n)) { set(n); engine.render(); } } }));
  const fields = [num('X', () => e.x, (v) => (e.x = v)), num('Y', () => e.y, (v) => (e.y = v)), three && num('Z', () => e.z, (v) => (e.z = v)),
    num(three ? 'Rot Y' : 'Rot', () => (three ? e.ry : e.rz), (v) => (three ? (e.ry = v) : (e.rz = v))),
    e.body && num('Vel X', () => e.body.vel.x, (v) => (e.body.vel.x = v)), e.body && num('Vel Y', () => e.body.vel.y, (v) => (e.body.vel.y = v))].filter(Boolean);
  const comps = (e.props?.behaviors || []).map((b) => Behaviors[b.type]?.label?.replace(/ \(.*\)$/, '') || b.type).filter(Boolean);
  const pj = project.entities.find((q) => q.id === e.id);
  box.replaceChildren(
    h('div', { class: 'pi-h' }, icon('target'), h('span', {}, h('b', {}, e.name), h('small', {}, [pj ? 'in the level' : 'spawned while playing', [...e.tags].join(', ')].filter(Boolean).join(' · '))),
      h('button', { title: 'Close', onclick: () => { inspectId = null; box.hidden = true; } }, icon('close'))),
    h('div', { class: 'pi-grid' }, fields),
    h('div', { class: 'pi-row' }, h('label', { class: 'pi-chk' }, h('input', { type: 'checkbox', checked: e.visible, onchange: (ev) => { e.visible = ev.target.checked; engine.render(); } }), 'Visible'),
      e.body && h('span', { class: 'pi-tag' }, e.body.type + (e.body.grounded ? ' · grounded' : '')),
      h('button', { class: 'btn', onclick: () => { e.destroy(); engine.scene.flush?.(); engine.render(); renderInspectCard(); } }, icon('trash'), 'Destroy')),
    comps.length ? h('p', { class: 'pi-comps' }, comps.join(' · ')) : null,
    h('p', { class: 'pi-note' }, 'Changes here last until you stop playing.'));
  clearInterval(inspectTimer);
  inspectTimer = setInterval(() => { // keep the numbers live (Step moves things)
    if (!inspectId || box.hidden) return clearInterval(inspectTimer);
    const ee = engine.scene.byId(inspectId); if (!ee || ee.dead) return renderInspectCard();
    for (const inp of box.querySelectorAll('input[data-live]')) if (document.activeElement !== inp) {
      const k = inp.dataset.live, v = { X: ee.x, Y: ee.y, Z: ee.z, Rot: ee.rz, 'Rot Y': ee.ry, 'Vel X': ee.body?.vel.x, 'Vel Y': ee.body?.vel.y }[k];
      inp.value = r(v);
    }
  }, 200);
}
$('#viewport').addEventListener('pointerdown', (ev) => { // Inspect mode: a tap on the running game picks an object
  if (!playing || !engine.inspecting) return;
  const r = surface.getBoundingClientRect(), hit = pick(ev.clientX - r.left, ev.clientY - r.top);
  inspectId = hit ? hit.id : null; buzz(6);
  if (hit) renderInspectCard(); else { $('#playInspect').hidden = true; toast('Nothing there. Tap an object.'); }
  engine.render();
}, true);
setInterval(() => { if (playing) updatePauseButtons(); }, 300); // the game can unpause itself on tap

// ============================================================================
// Wire up
// ============================================================================
$('#fileBtn').append(icon('menu'));
for (const b of $$('#toolRail [data-tool]')) {
  b.append(icon(b.dataset.tool === 'paint' ? 'brush' : b.dataset.tool));
  b.addEventListener('click', () => {
    const rail = $('#toolRail');
    if (EP.compactTools !== false && !rail.classList.contains('open') && b.dataset.tool === tool) { rail.classList.add('open'); buzz(6); return; } // folded: the tool you're using opens the rest
    setTool(b.dataset.tool); rail.classList.remove('open');
  });
}
$('#toolRail').classList.toggle('compact', EP.compactTools !== false);
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('#toolRail')) $('#toolRail').classList.remove('open'); }, true);
// Clean view: hide the editor's buttons over the Scene (tap the eye again, or the small button left behind, to bring them back)
const cleanBtn = h('button', { class: 'pt-btn', id: 'cleanBtn', title: 'Clean view: hide the buttons over the Scene' });
cleanBtn.append(icon('eye'));
$('#frameBtn').after(cleanBtn);
const setClean = (on) => { $('#app').classList.toggle('clean', on); cleanBtn.classList.toggle('on', on); cleanBtn.replaceChildren(icon(on ? 'eyeoff' : 'eye')); };
cleanBtn.addEventListener('click', () => { const on = !$('#app').classList.contains('clean'); setClean(on); setEP('clean', on); if (on) tipOnce('clean', 'Clean view: tap the eye again to bring the buttons back'); });
setClean(!!EP.clean);
// Hide UI: the level without the HUD, menus and pages over it (the UI editor still shows everything)
const hideUiBtn = h('button', { class: 'pt-btn', id: 'hideUiBtn', title: 'Hide the game\'s UI in the Scene' });
const setHideUI = (on) => { hideUiBtn.classList.toggle('on', on); hideUiBtn.replaceChildren(...[icon('hud'), on && h('i', { class: 'slash' })].filter(Boolean)); };
hideUiBtn.addEventListener('click', () => { const on = !EP.hideUI; setEP('hideUI', on); setHideUI(on); if (on && ent(selectedId)?.ui && !uiMode) select(null); toast(on ? 'UI hidden in the Scene (the UI button still edits it)' : 'UI shown'); });
cleanBtn.before(hideUiBtn); setHideUI(!!EP.hideUI);
$('#playBtn').append(icon('play'), h('span', {}, 'Play')); $('#pauseBtn').append(icon('pause'));
$('#pbPlay').append(icon('play')); $('#pbPause').append(icon('pause')); $('#pbLog').append(icon('terminal'));
$('#pbStep').append(icon('step')); $('#pbInspect').append(icon('target')); $('#pbStats').append(icon('stats'));
$('#pbStep').addEventListener('click', () => { if (!playing || !engine.paused) return; engine.stepFrames = 1; buzz(4); setTimeout(() => { if (inspectId) renderInspectCard(); }, 60); });
$('#pbInspect').addEventListener('click', () => setInspecting(!engine.inspecting));
$('#pbStats').addEventListener('click', toggleStats);
$('#pbLog').addEventListener('click', () => { const pc = $('#playConsole'); pc.hidden = !pc.hidden; if (!pc.hidden) renderPlayConsole(); });
// ---- where the play bar goes: above the game (default) or below it, so it never covers the game's own UI; or floating / a small button you drag ----
const PB_DOCKS = [['top', 'Above the game', 'The game starts under the bar: nothing of it is covered.'], ['bottom', 'Below the game', 'The game ends above the bar.'], ['float', 'Floating over the game', 'Drag the bar by its ⋮ button.'], ['mini', 'Small button', 'One round button you can drag anywhere; tap it for the tools.']];
const pbDock = () => { const d = store.get('pocket.editor.playDock', 'top'); return PB_DOCKS.some(([k]) => k === d) ? d : 'top'; };
let pbOpen = false;
function applyPlayDock() {
  const d = pbDock(), b = document.body;
  for (const [k] of PB_DOCKS) b.classList.toggle('pb-' + k, k === d);
  b.classList.toggle('pb-open', pbOpen);
  const bar = $('#playBar'), pos = store.get('pocket.editor.playDockPos', null);
  if ((d === 'float' || d === 'mini') && pos) { bar.style.left = pos.x + 'px'; bar.style.top = pos.y + 'px'; bar.style.transform = 'none'; }
  else { bar.style.left = ''; bar.style.top = ''; bar.style.transform = ''; }
  // the game's screen no longer reaches the notch / home bar on the side the bar takes
  const base = PHONES[phone].safe || engine.deviceSafe || { top: 0, right: 0, bottom: 0, left: 0 };
  engine.safeOverride = !playing ? PHONES[phone].safe : d === 'top' ? { ...base, top: 0 } : d === 'bottom' ? { ...base, bottom: 0 } : PHONES[phone].safe;
  requestAnimationFrame(() => { engine.resize(); engine.layoutButtons(); });
}
$('#pbDock').append(icon('more')); $('#pbHandle').append(icon('more'));
$('#pbDock').addEventListener('click', (ev) => { if (pbDragged) return; popMenu(ev.currentTarget, [{ cap: 'Play bar' }, ...PB_DOCKS.map(([k, l]) => ({ icon: pbDock() === k ? 'check' : 'square', label: l, fn: () => { store.set('pocket.editor.playDock', k); pbOpen = false; applyPlayDock(); toast(PB_DOCKS.find((q) => q[0] === k)[2]); } }))]); });
$('#pbHandle').addEventListener('click', () => { if (pbDragged) return; pbOpen = !pbOpen; applyPlayDock(); });
let pbDragged = false;
for (const grip of [$('#pbDock'), $('#pbHandle')]) grip.addEventListener('pointerdown', (e) => { // floating / small button: drag it out of the way
  if (!['float', 'mini'].includes(pbDock())) return;
  const bar = $('#playBar'), r = bar.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top, x0 = e.clientX, y0 = e.clientY;
  pbDragged = false;
  const mv = (q) => { if (Math.hypot(q.clientX - x0, q.clientY - y0) > 6) pbDragged = true; if (!pbDragged) return; const x = clampN(q.clientX - dx, 4, innerWidth - r.width - 4), y = clampN(q.clientY - dy, 4, innerHeight - r.height - 4); bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.transform = 'none'; };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (pbDragged) { const rr = bar.getBoundingClientRect(); store.set('pocket.editor.playDockPos', { x: Math.round(rr.left), y: Math.round(rr.top) }); setTimeout(() => { pbDragged = false; }, 0); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
$('#undoBtn').append(icon('undo')); $('#redoBtn').append(icon('redo'));
$('#snapBtn').append(icon('magnet')); $('#gridBtn').append(icon('grid')); $('#frameBtn').append(icon('frame'));
for (const [name, ic, label] of [['scene', 'scene', 'Scene'], ['hierarchy', 'list', 'Hierarchy'], ['inspector', 'info', 'Inspector'], ['scripts', 'nodes', 'Scripts'], ['project', 'folder', 'Project'], ['console', 'terminal', 'Console']]) {
  $(`#dockTabs [data-dock="${name}"]`).append(icon(ic), label);
  $(`.ptab[data-title="${name}"]`)?.append(icon(ic), label);
}
{ // swipe left / right across a panel to move between Hierarchy, Inspector and Project
  const order = ['hierarchy', 'inspector', 'scripts', 'project', 'console'];
  let st = null;
  $('#sheet').addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    st = e.touches.length === 1 && !e.target.closest('input, textarea, select, .p-tabs, .tiles, .num, .slider, .csws, .tl, #dockTabs, .ac-cat, .rule, .h-grip, .ap-grid, .lm-grid') ? { x: t.clientX, y: t.clientY, t: performance.now() } : null;
  }, { passive: true });
  $('#sheet').addEventListener('touchend', (e) => {
    if (!st) return;
    const t = e.changedTouches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Math.abs(dx) > 90 && Math.abs(dy) < 45 && performance.now() - st.t < 600) {
      const i = order.indexOf(dockTab), n = order[i + (dx < 0 ? 1 : -1)];
      if (n) { setDock(n); buzz(6); }
    }
    st = null;
  }, { passive: true });
}
{ // drag a panel down from the top of its list and the sheet follows the finger: let go low enough and it lowers (full → half → down)
  let pd = null;
  const app = $('#app');
  for (const body of $$('.panel.dock .panel-body')) {
    body.addEventListener('touchstart', (e) => {
      pd = null;
      if (e.touches.length !== 1 || body.scrollTop > 0 || sheetState() === 'peek' || e.target.closest('input, textarea, select, .num, .slider, .h-grip, .tl, .ap-grid, .lm-grid')) return;
      pd = { y: e.touches[0].clientY, x: e.touches[0].clientX, t: performance.now(), h: $('#sheet').getBoundingClientRect().height, on: false };
    }, { passive: true });
    body.addEventListener('touchmove', (e) => {
      if (!pd) return;
      const dy = e.touches[0].clientY - pd.y, dx = e.touches[0].clientX - pd.x;
      if (!pd.on) {
        if (dy < -4 || Math.abs(dx) > 12 || body.scrollTop > 0) { pd = null; return; } // scrolling the list or swiping sideways
        if (dy < 10) return;
        pd.on = true; pd.y += 10; app.classList.add('dragging');
      }
      e.preventDefault();
      app.style.setProperty('--sheet-h', Math.max(98, pd.h - Math.max(0, e.touches[0].clientY - pd.y)) + 'px');
    }, { passive: false });
    const end = (e) => {
      if (!pd?.on) { pd = null; return; }
      const dy = (e.changedTouches?.[0]?.clientY ?? pd.y) - pd.y, fast = performance.now() - pd.t < 450, H = window.innerHeight;
      const hgt = pd.h - Math.max(0, dy);
      app.classList.remove('dragging'); app.style.removeProperty('--sheet-h');
      if (fast && dy > 50) setSheet(sheetState() === 'full' && dy < 220 ? 'half' : 'peek');
      else setSheet(hgt < H * 0.25 ? 'peek' : hgt < H * 0.66 ? 'half' : 'full');
      buzz(6); pd = null;
    };
    body.addEventListener('touchend', end, { passive: true });
    body.addEventListener('touchcancel', end, { passive: true });
  }
}
{ // tabs: tap to switch, swipe up/down on them to open or close the panel
  const tabs = $('#dockTabs');
  let sw = null, swiped = false;
  tabs.addEventListener('pointerdown', (e) => { sw = { y: e.clientY, x: e.clientX }; swiped = false; });
  tabs.addEventListener('pointermove', (e) => {
    if (!sw || swiped) return;
    const dy = e.clientY - sw.y;
    if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(e.clientX - sw.x)) {
      swiped = true;
      const order = ['peek', 'half', 'full'], i = order.indexOf(sheetState());
      setSheet(order[Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)))]); buzz(6);
    }
  });
  tabs.addEventListener('pointerup', () => { sw = null; });
  tabs.addEventListener('pointercancel', () => { sw = null; });
  tabs.addEventListener('click', (e) => { if (swiped) { swiped = false; return; } const b = e.target.closest('button'); if (b) setDock(b.dataset.dock, { fromTab: true }); });
}
$('#panelsFab').append(icon('list'));
$('#addFab').append(icon('plus'), h('span', {}, 'Add'));
for (const [z, ic] of [['out', 'minus'], ['in', 'plus'], ['reset', 'frame']]) {
  const b = $(`#zoomBar [data-zoom="${z}"]`);
  b.append(icon(ic));
  b.addEventListener('click', () => {
    if (z === 'reset') { resetCamera(); applyCamera(); return; }
    const k = z === 'in' ? 1.35 : 1 / 1.35;
    if (uiMode) { zoomUI(k); buzz(4); return; }
    if (is3D()) orbit.dist = Math.min(300, Math.max(2, orbit.dist / k)); else cam2d.zoom = Math.min(8, Math.max(0.08, cam2d.zoom * k));
    applyCamera(); buzz(4);
  });
}
// stop the browser from zooming the whole page (pinch or double tap); pinch inside the Scene zooms the view instead
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && !e.target.closest('canvas')) e.preventDefault(); }, { passive: false });
$('#uiBtn').addEventListener('click', () => setViewMode(viewMode === 'ui' ? 'scene' : 'ui'));
$('#sceneTab').addEventListener('click', (e) => popMenu(e.currentTarget, [
  { cap: `This level is ${is3D() ? '3D' : '2D'}` },
  { icon: is3D() ? 'cube' : 'grid', label: is3D() ? 'Scene view (3D)' : 'Scene view (2D)', fn: () => setViewMode('scene') },
  is3D() && { icon: 'grid', label: 'Top view (2D layout)', fn: () => setViewMode('top') },
  { icon: 'hud', label: 'UI editor (screen only)', fn: () => setViewMode('ui') },
  '-', { icon: showColliders ? 'check' : 'square', label: 'Show All Colliders', k: 'green outlines', fn: () => toggleColliders() },
  '-', { icon: 'plus', label: 'New 2D Level', fn: () => addLevel(false, '2d') }, { icon: 'plus', label: 'New 3D Level', fn: () => addLevel(false, '3d') },
]));
/** Scene / Top / UI editor. */
function setViewMode(m) {
  if (m === 'top' && !is3D()) m = 'scene';
  viewMode = m; uiMode = m === 'ui';
  $('#uiBtn').classList.toggle('on', uiMode);
  $('#app').dataset.view = m;
  $('#uiScreens').hidden = !uiMode;
  refreshOrientBtn();
  if (uiMode) { projectTab = 'ui'; renderProject(); setTool('rect'); if (selectedId && !ent(selectedId)?.ui) select(null); tipOnce('ui-editor', 'UI editor: drag to move, pull edges to resize, pinch to zoom.'); }
  if (m === 'top') toast('Top view: lay out your level from above. Drag to pan, pinch to zoom.');
  fitEditorScreen();
  refreshAll(); applyCamera();
}
/** Pretend the screen has a notch / island / home bar while editing, to see the safe area at work. */
const PHONES = {
  device: { label: 'This device', short: 'Phone', safe: null },
  plain: { label: 'No notch', short: 'No notch', safe: { top: 0, right: 0, bottom: 0, left: 0 } },
  notch: { label: 'iPhone with notch', short: 'Notch', safe: { top: 47, right: 0, bottom: 34, left: 0 }, cut: 'notch' },
  island: { label: 'iPhone with Dynamic Island', short: 'Island', safe: { top: 59, right: 0, bottom: 34, left: 0 }, cut: 'island' },
  android: { label: 'Android (camera hole)', short: 'Android', safe: { top: 32, right: 0, bottom: 24, left: 0 }, cut: 'hole' },
  sideways: { label: 'iPhone sideways', short: 'Sideways', safe: { top: 0, right: 47, bottom: 21, left: 47 }, cut: 'side' },
};
let phone = PHONES[store.get('pocket.editor.phone', 'device')] ? store.get('pocket.editor.phone', 'device') : 'device';
function setPhone(k) {
  phone = k; store.set('pocket.editor.phone', k);
  engine.safeOverride = PHONES[k].safe; engine.updateSafe();
  const b = $('.phone-btn span'); if (b) b.textContent = PHONES[k].short;
  rebuild(); toast(PHONES[k].safe ? `Previewing: ${PHONES[k].label}` : 'Using this device’s real safe area');
}
engine.safeOverride = PHONES[phone].safe;
/** Draw the pretend notch / island / camera hole / home bar on the UI editor's screen. */
function drawPhoneCutouts(ctx, W, H) {
  const ph = PHONES[phone]; if (!ph?.cut) return;
  ctx.save(); ctx.fillStyle = '#000';
  const pill = (x, y, w, hh) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, hh, hh / 2); else ctx.rect(x, y, w, hh); ctx.fill(); };
  if (ph.cut === 'notch') { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - 80, -12, 160, 42, 16); else ctx.rect(W / 2 - 80, 0, 160, 30); ctx.fill(); }
  if (ph.cut === 'island') pill(W / 2 - 62, 11, 124, 36);
  if (ph.cut === 'hole') { ctx.beginPath(); ctx.arc(W / 2, 16, 9, 0, Math.PI * 2); ctx.fill(); }
  if (ph.cut === 'side') { pill(-14, H / 2 - 80, 44, 160); }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; pill(W / 2 - 67, H - 13, 134, 5); // home bar
  ctx.restore();
}
/** Pages (UI with "Show If": page = shop…): preview one at a time in the UI editor. */
let uiPage = 'all';
const showIfOf = (j) => (j?.behaviors || []).find((b) => b.type === 'uiShowIf' && (b.op || '=') === '=');
function uiPages() {
  const out = new Map();
  for (const j of project.entities) { const b = showIfOf(j); if (b && j.ui) { const v = b.var || 'page'; if (!out.has(v)) out.set(v, new Set()); out.get(v).add(String(b.value ?? '')); } }
  return out;
}
engine.uiFilter = (e) => {
  if (uiPage === 'all' || !uiMode) return true;
  const [v, val] = uiPage.split('='), seen = new Set();
  for (let j = ent(e.id); j && !seen.has(j.id); j = j.parent ? ent(j.parent) : null) { seen.add(j.id); const b = showIfOf(j); if (b && (b.var || 'page') === v && String(b.value ?? '') !== val) return false; }
  return true;
};
function pageMenu(anchor) {
  const pages = uiPages();
  if (!pages.size) { toast('No pages yet: add Project › UI › Navigation › Page or a Bottom Nav Bar'); return; }
  popMenu(anchor, [{ cap: 'Preview page' }, { icon: uiPage === 'all' ? 'check' : 'layers', label: 'All pages', fn: () => setUIPage('all') },
    ...[...pages].flatMap(([v, vals]) => [...vals].map((val) => ({ icon: uiPage === `${v}=${val}` ? 'check' : 'square', label: `${val}`, k: v, fn: () => setUIPage(`${v}=${val}`) })))]);
}
function setUIPage(k) { uiPage = k; const b = $('.page-btn span'); if (b) b.textContent = k === 'all' ? 'Pages' : k.split('=')[1]; engine.render(); }
const SCREENS = [['all', 'All'], ['play', 'Playing'], ['title', 'Title'], ['paused', 'Paused'], ['over', 'Game Over'], ['win', 'Win']];
{
  const phoneBtn = h('button', { class: 'phone-btn', onclick: (ev) => popMenu(ev.currentTarget, [{ cap: 'Preview on' }, ...Object.entries(PHONES).map(([k, ph]) => ({ icon: k === phone ? 'check' : 'phone', label: ph.label, fn: () => setPhone(k) }))]) }, icon('phone'), h('span', {}, PHONES[phone]?.short || 'Phone'));
  const orientBtn = h('button', { class: 'orient-btn', onclick: (ev) => popMenu(ev.currentTarget, [{ cap: 'Game orientation' }, ...[['portrait', 'Portrait'], ['landscape', 'Landscape'], ['any', 'Either way']].map(([k, l]) => ({ icon: orientationOf() === k ? 'check' : 'phone', label: l, fn: () => setOrientation(k) }))]) });
  const pageBtn = h('button', { class: 'page-btn', onclick: (ev) => pageMenu(ev.currentTarget) }, icon('layers'), h('span', {}, 'Pages'));
  const bar = h('div', { id: 'uiScreens', hidden: true }, orientBtn, phoneBtn, pageBtn, SCREENS.map(([k, l]) => h('button', { class: k === uiScreen ? 'on' : '', 'data-s': k, onclick: () => { uiScreen = k; for (const b of bar.children) b.classList.toggle('on', b.dataset.s === k); } }, l)));
  $('#viewport').before(bar);
}
// title / pause / game-over UI shows in the UI editor (filtered by screen) or when selected
new ResizeObserver(() => { // short view: smaller zoom buttons and the tool rail folds into two columns
  const v = $('#viewport'), rail = $('#toolRail');
  v.classList.toggle('short', v.clientHeight < 260);
  rail.classList.toggle('two', v.clientHeight - 20 < rail.children.length * (rail.firstElementChild.offsetHeight + 4) + 10);
}).observe($('#viewport'));
engine.uiView = uiView; // the engine draws UI with the editor's zoom while editing
engine.screenFilter = (e) => e.id === selectedId || (uiMode && (uiScreen === 'all' || e.showWhen === uiScreen));
engine.onBeforeUI = (ctx) => {
  if (!uiMode || playing) return;
  const W = engine.width, H = engine.height, sf = engine.safe;
  ctx.fillStyle = '#0d0e12'; ctx.fillRect(0, 0, W, H); // UI editor: the world steps away, only the screen is left
  ctx.save(); ctx.translate(W / 2 + uiView.x, H / 2 + uiView.y); ctx.scale(uiView.z, uiView.z); ctx.translate(-W / 2, -H / 2);
  ctx.fillStyle = '#16171d'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5 / uiView.z; ctx.strokeRect(0, 0, W, H); // the phone screen
  if (sf.top || sf.bottom || sf.left || sf.right) { // shade what is outside the safe area
    ctx.fillStyle = 'rgba(255,90,90,0.10)';
    ctx.fillRect(0, 0, W, sf.top); ctx.fillRect(0, H - sf.bottom, W, sf.bottom); ctx.fillRect(0, sf.top, sf.left, H - sf.top - sf.bottom); ctx.fillRect(W - sf.right, sf.top, sf.right, H - sf.top - sf.bottom);
  }
  drawPhoneCutouts(ctx, W, H);
  ctx.strokeStyle = 'rgba(120,170,255,0.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
  ctx.strokeRect(sf.left + 0.5, sf.top + 0.5, W - sf.left - sf.right - 1, H - sf.top - sf.bottom - 1);
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(120,170,255,0.6)';
  for (const a of ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']) { const p = anchorPoint(a, W, H, sf); ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); }
  if (uiGuide) { ctx.strokeStyle = '#ff5ad1'; ctx.lineWidth = 1.5 / uiView.z; ctx.beginPath(); if (uiGuide.x != null) { ctx.moveTo(uiGuide.x, 0); ctx.lineTo(uiGuide.x, H); } if (uiGuide.y != null) { ctx.moveTo(0, uiGuide.y); ctx.lineTo(W, uiGuide.y); } ctx.stroke(); }
  ctx.restore();
};
let uiGuide = null;
/** UI drags snap to the screen centre and to the element's anchor point. */
function snapUI(j) {
  const live = engine.scene.byId(j.id), W = engine.width, H = engine.height, a = live ? uiOrigin(live, W, H, engine.safe) : anchorPoint(j.anchor || 'top-left', W, H, engine.safe), T = 10 / uiView.z;
  uiGuide = {};
  const sx = a.x + j.x, sy = a.y + j.y;
  if (Math.abs(sx - W / 2) < T) { j.x = Math.round(W / 2 - a.x); uiGuide.x = W / 2; } else if (Math.abs(j.x) < T) { j.x = 0; uiGuide.x = a.x; } else if (snap) j.x = Math.round(j.x / 4) * 4;
  if (Math.abs(sy - H / 2) < T) { j.y = Math.round(H / 2 - a.y); uiGuide.y = H / 2; } else if (Math.abs(j.y) < T) { j.y = 0; uiGuide.y = a.y; } else if (snap) j.y = Math.round(j.y / 4) * 4;
  if (!live) return;
  // line up with the other elements in the same parent (centres and edges)
  const W2 = engine.width, H2 = engine.height, flat = (q) => { const o = uiOrigin(q, W2, H2, engine.safe), b = boundsOf(q); return { x: o.x + b.x, y: o.y + b.y, hx: b.hx, hy: b.hy }; }; // (the same space as the centre snapping above)
  const me = boundsOf(live), cx = a.x + j.x + (me.x - (live.x || 0)), cy = a.y + j.y + (me.y - (live.y || 0)), K = 1;
  let bx = null, by = null;
  for (const q of engine.scene.entities) {
    if (q === live || !q.ui || q.dead || !q.visible || q._parentHidden || q.parentEnt !== live.parentEnt) continue;
    const r = flat(q);
    if (uiGuide.x == null) for (const [mine, theirs] of [[0, 0], [-me.hx, -r.hx], [me.hx, r.hx], [-me.hx, r.hx], [me.hx, -r.hx]]) { const d = (r.x + theirs) - (cx + mine); if (Math.abs(d) < T && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, at: r.x + theirs }; }
    if (uiGuide.y == null) for (const [mine, theirs] of [[0, 0], [-me.hy, -r.hy], [me.hy, r.hy], [-me.hy, r.hy], [me.hy, -r.hy]]) { const d = (r.y + theirs) - (cy + mine); if (Math.abs(d) < T && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, at: r.y + theirs }; }
  }
  if (bx) { j.x = Math.round(j.x + bx.d / K); uiGuide.x = bx.at; }
  if (by) { j.y = Math.round(j.y + by.d / K); uiGuide.y = by.at; }
}
$('#addFab').addEventListener('click', () => openCreate());
$('#panelsFab').addEventListener('click', () => setSheet('half'));
$('#attachBar button').addEventListener('click', () => endAttach(null));
for (const [act, ic, label] of [['inspect', 'info', 'Inspect'], ['duplicate', 'copy', 'Duplicate'], ['focus', 'frame', 'Focus'], ['attach', 'link', 'Attach'], ['detach', 'unlink', 'Detach'], ['delete', 'trash', 'Delete']]) {
  const b = $(`#ctxBar [data-act="${act}"]`);
  b.append(icon(ic), h('span', {}, label)); b.title = label;
  b.addEventListener('click', () => ctxAction(act));
}
$('#levelBtn').addEventListener('click', openLevelMenu);
$('#fileBtn').addEventListener('click', openFileMenu);
$('#playBtn').addEventListener('click', () => (playing ? stop() : play()));
$('#pauseBtn').addEventListener('click', togglePause);
$('#pbPlay').addEventListener('click', stop);
$('#pbPause').addEventListener('click', togglePause);
$('#undoBtn').addEventListener('click', () => undoRedo(-1));
$('#redoBtn').addEventListener('click', () => undoRedo(1));
$('#frameBtn').addEventListener('click', frameSelected);
$('#snapBtn').classList.toggle('on', snap);
$('#gridBtn').classList.toggle('on', showGrid);
$('#snapBtn').addEventListener('click', () => { snap = !snap; store.set('pocket.editor.snap', snap ? '1' : '0'); $('#snapBtn').classList.toggle('on', snap); toast(snap ? 'Snapping on' : 'Snapping off'); });
$('#gridBtn').addEventListener('click', () => { showGrid = !showGrid; store.set('pocket.editor.grid', showGrid ? '1' : '0'); $('#gridBtn').classList.toggle('on', showGrid); });
window.addEventListener('beforeunload', saveOnLeave);
window.addEventListener('pagehide', saveOnLeave);
window.pocketBeforeUpdate = saveOnLeave; // the update bar saves before it reloads
document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnLeave(); });
$('#app').dataset.sheet = 'peek'; // big Scene first; tap a tab (or swipe up) to open the panel
setTool('move');

await initStorage();
askPersist(); // ask the browser to keep our data (Android / Chrome say yes for installed or often-used apps)
storageUse().then((u) => { if (u && u.quota && u.used / u.quota > 0.85) toast('Storage is almost full: back up your games'); });
{
  const all = loadProjects(), cur = store.get(CURRENT_KEY, '');
  const q = new URLSearchParams(location.search);
  if (q.get('template') && templates[q.get('template')]) newFromTemplate(q.get('template'));
  else {
    if (all[cur]) openProject(all[cur].json, cur);
    else newFromTemplate('sky-dodge', 'My First Game');
    if (!(EP.startOn === 'last' && all[cur])) showHome(); // Preferences › Start on
    if (store.get('pocket.editor.toured', '') !== '1') {
      const hint = $('#hint');
      hint.textContent = 'Tap + to add things · tap an object to edit it';
      hint.hidden = false;
    }
  }
}
window.pocketReady = true; // boot finished (index.html recovers from a half-updated cache otherwise)
