// Pocket Editor: build Pocket Engine games on a phone.
// Layout: toolbar · Scene view · Hierarchy / Inspector / Project panels.
// A project is plain scene JSON (see examples/templates.js), the same thing Engine.start() plays.
import { Engine, Scene, Behaviors, paramDefault, uid, anchorPoint, VERSION } from '../engine/pocket.js';
import { templates, templateInfo } from '../examples/templates.js';
import { icon } from './icons.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

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
const PROJECTS_KEY = 'pocket.editor.projects', CURRENT_KEY = 'pocket.editor.current';
const loadProjects = () => { try { return JSON.parse(store.get(PROJECTS_KEY, '{}')) || {}; } catch { return {}; } };
const SCENE_ID = '__scene';

// root = the whole game (level 1 plus root.levels[]); project = the level being edited
let root = null, project = null, projectId = null, selectedId = null, levelIdx = 0;
let history = [], hIndex = -1;
let snap = store.get('pocket.editor.snap', '1') === '1';
let showGrid = store.get('pocket.editor.grid', '1') === '1';
let tool = 'move';
let playing = false;

function saveNow() {
  if (!project) return;
  const all = loadProjects();
  all[projectId] = { name: root.name, updated: Date.now(), json: root };
  if (!store.set(PROJECTS_KEY, JSON.stringify(all))) toast('Could not save: browser storage is full');
  store.set(CURRENT_KEY, projectId);
}
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); };

const levelList = () => [root, ...(root.levels || [])];
const levelName = (lv, i) => lv.levelName || `Level ${i + 1}`;
function normalize(lv) { lv.entities ||= []; lv.settings ||= {}; lv.vars ||= {}; return lv; }

function openProject(json, id = uid('p')) {
  root = json;
  normalize(root); root.vars.score ??= 0;
  (root.levels || []).forEach(normalize);
  project = root; levelIdx = 0;
  projectId = id;
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
  for (const e of json.entities) e.id ||= uid();
  openProject(json);
}

function setLevel(i) {
  levelIdx = Math.max(0, Math.min(i, levelList().length - 1));
  project = levelList()[levelIdx];
  selectedId = null;
  resetCamera(); rebuild(); refreshAll();
}
function addLevel(duplicate) {
  const n = levelList().length + 1;
  const lv = duplicate ? clone(project) : {
    mode: root.mode, background: project.background, view: clone(project.view || { width: 400, height: 700 }), gravity: project.gravity,
    settings: { joystick: !!project.settings.joystick, jumpButton: !!project.settings.jumpButton }, vars: {},
    camera: project.camera ? clone(project.camera) : undefined, entities: project.entities.filter((e) => e.ui).map(clone),
  };
  if (duplicate) { delete lv.levels; delete lv.name; delete lv.version; for (const e of lv.entities) e.id = uid(); }
  lv.levelName = duplicate ? `${levelName(project, levelIdx)} (copy)` : `Level ${n}`;
  for (const e of lv.entities) e.id = uid();
  (root.levels ||= []).push(normalize(lv));
  pushHistory(); saveSoon();
  setLevel(levelList().length - 1);
  toast(`Added ${lv.levelName}`);
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
    ...list.map((lv, i) => ({ icon: i === levelIdx ? 'right' : 'layers', label: `${i + 1}. ${levelName(lv, i)}`, fn: () => setLevel(i) })),
    '-',
    { icon: 'plus', label: 'New Level', fn: () => addLevel(false) },
    { icon: 'copy', label: 'Duplicate This Level', fn: () => addLevel(true) },
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
  rebuild(); refreshAll(); saveSoon(); updateUndoButtons(); updateCtxBar();
}
function updateUndoButtons() { $('#undoBtn').disabled = hIndex <= 0; $('#redoBtn').disabled = hIndex >= history.length - 1; }

/** Call after any edit. structure: object list / inspector layout changed. */
function changed({ structure = false, inspector = false } = {}) {
  requestRebuild();
  saveSoon();
  pushHistorySoon();
  if (structure) { renderHierarchy(); renderInspector(); }
  else if (inspector) renderInspector();
}

// ============================================================================
// Engine in edit mode
// ============================================================================
const engine = new Engine({ parent: $('#viewport') });
engine.editing = true;
engine.showUI = true;
engine.input.enabled = false;
window.engine = engine;

const ent = (id) => project?.entities.find((e) => e.id === id);
const is3D = () => project.mode === '3d';
const hasVisual = (e) => !!(e.shape || e.mesh || e.text || e.sprite);

let cam2d = { x: 200, y: 350, zoom: 0.85 };
let orbit = { yaw: 0.5, pitch: 0.8, dist: 22, target: { x: 0, y: 0, z: 0 } };
function resetCamera() {
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
  applyCamera();
}
function applyCamera() {
  const s = engine.scene;
  if (!s || playing) return;
  if (s.mode === '2d') Object.assign(s.camera, { x: cam2d.x, y: cam2d.y, zoom: cam2d.zoom });
  else {
    const o = orbit, cp = Math.cos(o.pitch);
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
  return { x, y: e.y, hx, hy, sphere: ex.sphere, r: ex.r };
}
function uiBounds(e) {
  const o = anchorPoint(e.anchor, engine.width, engine.height, engine.safe), b = boundsOf(e);
  return { ...b, x: o.x + b.x, y: o.y + b.y };
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

engine.onRenderWorld = (r, s, z) => {
  if (playing) return;
  const sel = s.byId(selectedId), hover = s.byId(dropHoverId);
  if (s.mode === '2d') {
    const ctx = r;
    // game camera frame
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 / z;
    ctx.strokeRect(0, 0, s.view.width, s.view.height);
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
    for (const [e, col] of [[hover, '#4c8bd6'], [sel, ORANGE]]) {
      if (!e || e.ui || !e.mesh) continue;
      const ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy, hz = ex.sphere ? ex.r : ex.hz;
      const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => [e.x + a * hx * 1.04, e.y + b * hy * 1.04, e.z + d * hz * 1.04]);
      const pts = [];
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[i], ...c[j]);
      r.drawLines(pts, col);
    }
  }
};

engine.onRenderUI = (ctx, s) => {
  if (playing) return;
  // invisible logic objects
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of s.entities) {
    if (e.ui || hasVisual(e)) continue;
    const p = toScreen(e); if (!p) continue;
    const isSel = e.id === selectedId;
    ctx.fillStyle = isSel ? 'rgba(247,160,44,0.25)' : 'rgba(30,30,30,0.6)';
    ctx.strokeStyle = isSel ? ORANGE : 'rgba(200,200,200,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.rect(p.x - 12, p.y - 12, 24, 24); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = isSel ? ORANGE : '#cfcfcf'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6); ctx.lineTo(p.x + Math.cos(a) * 8.5, p.y + Math.sin(a) * 8.5); }
    ctx.stroke();
    ctx.font = '11px -apple-system, Segoe UI, sans-serif'; ctx.fillStyle = 'rgba(230,230,230,0.85)';
    ctx.fillText(e.name, p.x, p.y + 22);
  }
  const sel = s.byId(selectedId);
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
function gizmoAxes(e) {
  const s = engine.scene, o = screenCenter(e);
  if (!o) return null;
  if (e.ui) return { o, axes: [{ k: 'x', dx: 1, dy: 0, ppu: 1, sign: 1 }, { k: 'y', dx: 0, dy: -1, ppu: 1, sign: -1 }] };
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

/** Which gizmo handle is under a screen point, if any. */
function hitGizmo(x, y) {
  const sel = engine.scene?.byId(selectedId);
  if (!sel || tool === 'hand') return null;
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
  const s = engine.scene, list = s.entities.slice().reverse().filter((e) => !ent(e.id)?.locked);
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
      const b = boundsOf(e);
      if (b.sphere ? Math.hypot(w.x - b.x, w.y - b.y) <= b.r + pad : Math.abs(w.x - b.x) <= b.hx + pad && Math.abs(w.y - b.y) <= b.hy + pad) return e;
    }
    return null;
  }
  const ray = engine.renderer.screenRay(s, sx, sy);
  let best = null, bestT = Infinity;
  for (const e of list) {
    if (e.ui || !e.mesh) continue;
    const t = rayHit(ray, e);
    if (t != null && t < bestT) { bestT = t; best = e; }
  }
  return best;
}
function rayHit({ origin: o, dir: d }, e) {
  const ex = e.extents();
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
const snapV = (v, step) => (snap ? Math.round(v / step) * step : round(v, 2));
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
  if (ptrs.size === 1 && tool === 'paint' && ev.button === 0 && !ev.altKey) {
    const src = ent(selectedId);
    if (!src || src.ui) { toast('Select an object first, then paint copies of it'); gesture = { type: 'pan', lx: x, ly: y, sx: x, sy: y, moved: true }; return; }
    gesture = { type: 'paint', srcId: src.id, last: null, count: 0 };
    paintAt(x, y);
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
  if (['free', 'axis', 'rotate', 'scale', 'tap'].includes(g.type)) {
    if (!g.moved && Math.hypot(dx, dy) < 5) return;
    g.moved = true;
    if (g.type === 'tap') return;
    const j = ent(g.id), live = s.byId(g.id);
    if (!j) return;
    if (g.type === 'free') {
      if (g.ui) { j.x = Math.round(g.orig.x + dx); j.y = Math.round(g.orig.y + dy); }
      else if (!is3D()) { const z = engine.renderer.zoomFor(s); j.x = snapV(g.orig.x + dx / z, 10); j.y = snapV(g.orig.y + dy / z, 10); }
      else {
        const hit = rayPlaneY(engine.renderer.screenRay(s, x, y), g.orig.y);
        if (hit) { j.x = snapV(hit.x - g.grab.x, 0.5); j.z = snapV(hit.z - g.grab.z, 0.5); }
      }
    } else if (g.type === 'axis') {
      const a = g.axis, along = dx * a.dx + dy * a.dy, step = g.ui ? 1 : is3D() ? 0.5 : 10;
      j[a.k] = g.ui ? Math.round(g.orig[a.k] + along * a.sign) : snapV(g.orig[a.k] + along / a.ppu * a.sign, step);
    } else if (g.type === 'rotate') {
      g.a1 = Math.atan2(y - g.o.y, x - g.o.x);
      let deg = (g.a1 - g.a0) * 180 / Math.PI;
      const key = is3D() && !g.ui ? 'ry' : 'rz';
      let v = key === 'ry' ? g.orig.ry - deg : g.orig.rz + deg;
      v = snap ? Math.round(v / 15) * 15 : round(v, 1);
      j[key] = v;
    } else if (g.type === 'scale') {
      const keys = g.handle === 'free' ? (is3D() && !g.ui ? ['sx', 'sy', 'sz'] : ['sx', 'sy']) : ['s' + g.handle];
      const along = g.handle === 'free' ? (dx - dy) / Math.SQRT2 : dx * g.axis.dx + dy * g.axis.dy;
      const f = Math.max(0.05, 1 + along / GIZ);
      for (const k of keys) j[k] = snap ? Math.max(0.1, Math.round(g.orig[k] * f * 10) / 10) : round(g.orig[k] * f, 3);
    }
    if (live) Object.assign(live, { x: j.x || 0, y: j.y || 0, z: j.z || 0, rx: j.rx || 0, ry: j.ry || 0, rz: j.rz || 0, sx: j.sx ?? 1, sy: j.sy ?? 1, sz: j.sz ?? 1 });
    syncTransformInputs();
  } else if (g.type === 'paint') {
    paintAt(x, y);
  } else if (g.type === 'pan' || g.type === 'orbit') {
    const mx = x - g.lx, my = y - g.ly;
    g.lx = x; g.ly = y;
    if (Math.hypot(x - g.sx, y - g.sy) > 5) g.moved = true;
    if (!is3D()) { const z = engine.renderer.zoomFor(s); cam2d.x -= mx / z; cam2d.y -= my / z; }
    else if (g.type === 'orbit') { orbit.yaw -= mx * 0.008; orbit.pitch = Math.min(1.5, Math.max(0.05, orbit.pitch + my * 0.008)); }
    else panOrbit(mx, my);
    applyCamera();
  } else if (g.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (!is3D()) {
      const before = engine.renderer.screenToWorld(s, g.mx, g.my);
      cam2d.zoom = Math.min(8, Math.max(0.08, cam2d.zoom * dist / g.d0));
      applyCamera();
      const after = engine.renderer.screenToWorld(s, mx, my);
      cam2d.x += before.x - after.x; cam2d.y += before.y - after.y;
    } else {
      orbit.dist = Math.min(300, Math.max(2, orbit.dist * g.d0 / dist));
      panOrbit(mx - g.mx, my - g.my);
    }
    g.mx = mx; g.my = my; g.d0 = dist;
    applyCamera();
  }
});

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
  cancelLongPress();
  if (ptrs.size === 0 && tapTrack && tapTrack.max >= 2 && !tapTrack.moved && performance.now() - tapTrack.t0 < 400) {
    undoRedo(tapTrack.max >= 3 ? 1 : -1); buzz(10); toast(tapTrack.max >= 3 ? 'Redo' : 'Undo');
    tapTrack = null; gesture = null; return;
  }
  const g = gesture;
  if (!g) return;
  if (['free', 'axis', 'rotate', 'scale'].includes(g.type) && g.moved) { pushHistory(); saveSoon(); }
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
function openObjectMenu(id, sx, sy) {
  const j = ent(id); if (!j) return;
  select(id);
  popMenu(pointRect(sx, sy), [
    { cap: j.name || 'Object' },
    { icon: 'info', label: 'Inspect', fn: () => ctxAction('inspect') },
    { icon: 'copy', label: 'Duplicate', fn: () => duplicateEntity(id) },
    { icon: 'paste', label: 'Copy', fn: () => { objClipboard = clone(j); toast(`Copied ${j.name}. Long-press empty space to paste.`); } },
    !j.ui && { icon: 'brush', label: 'Paint Copies', fn: () => setTool('paint') },
    { icon: 'frame', label: 'Focus', fn: frameSelected },
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
  if (t === 'paint' && was !== 'paint') toast(ent(selectedId) && !ent(selectedId).ui ? `Paint: tap or drag to place copies of ${ent(selectedId).name}` : 'Paint: select an object, then tap or drag in the Scene');
  updateCtxBar();
}

let dockTab = 'hierarchy';
function setDock(name, { fromTab = false } = {}) {
  if (!isDesktop()) {
    if (fromTab && name === dockTab) setSheet(sheetState() === 'peek' ? 'half' : 'peek');
    else if (sheetState() === 'peek') setSheet('half');
  }
  dockTab = name;
  for (const b of $$('#dockTabs button')) b.classList.toggle('active', b.dataset.dock === name);
  for (const p of $$('.dock')) p.classList.toggle('active', p.dataset.dock === name);
}
const isDesktop = () => false; // phones and tablets only

// ---- bottom sheet (phones): peek / half / full ----
function setSheet(state) {
  const app = $('#app');
  if (app.dataset.sheet === state) return;
  app.dataset.sheet = state;
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
    else setSheet(hgt < H * 0.25 ? 'peek' : hgt < H * 0.66 ? 'half' : 'full');
    drag = null;
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function select(id, { fromScene = false } = {}) {
  selectedId = id === SCENE_ID || ent(id) ? id : null;
  renderHierarchy();
  renderInspector();
  updateCtxBar();
  if (selectedId && fromScene && dockTab === 'hierarchy' && !isDesktop()) setDock('inspector');
}

/** Quick actions for the selected object, floating over the Scene view. */
function updateCtxBar() {
  const bar = $('#ctxBar'), j = ent(selectedId);
  bar.hidden = !j || playing;
  if (j) $('#hint').hidden = true;
}
function ctxAction(act) {
  const j = ent(selectedId); if (!j) return;
  if (act === 'inspect') { if (!isDesktop()) { setDock('inspector'); if (sheetState() === 'peek') setSheet('half'); } }
  else if (act === 'duplicate') duplicateEntity(j.id);
  else if (act === 'focus') frameSelected();
  else if (act === 'delete') deleteEntity(j.id);
}
/** Step through objects in the Inspector with ‹ ›. */
function stepSelection(d) {
  const list = project.entities;
  if (!list.length) return;
  const i = list.findIndex((e) => e.id === selectedId);
  select(list[(i + d + list.length) % list.length].id);
}

function refreshAll() {
  $('#sceneTab').replaceChildren(icon(is3D() ? 'cube' : 'grid'), is3D() ? '3D' : '2D');
  $('#projectTitle').textContent = levelList()[0].name || 'Untitled';
  const n = levelList().length;
  $('#levelBtn').replaceChildren(...[icon('layers'), h('span', {}, levelName(project, levelIdx)), n > 1 && h('small', {}, `${levelIdx + 1}/${n}`), icon('chevron')].filter(Boolean));
  renderHierarchy(); renderInspector(); renderProject(); updateUndoButtons(); updateCtxBar();
}

// ============================================================================
// Hierarchy
// ============================================================================
let hFilter = '';
function iconFor(e) {
  if (!e) return 'scene';
  if (e.ui) return 'hud';
  if (e.mesh) return ({ box: 'cube', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', plane: 'plane' })[e.mesh.geometry] || 'cube';
  if (e.shape) return ({ rect: 'square', circle: 'circle', triangle: 'triangle', star: 'star' })[e.shape.type] || 'square';
  if (e.text) return 'text';
  if (e.sprite) return 'image';
  return 'gear';
}
function renderHierarchy() {
  const box = $('#hierarchy');
  const scroll = box.scrollTop;
  box.replaceChildren();
  const search = h('input', { type: 'text', placeholder: 'Search', value: hFilter, autocapitalize: 'off',
    oninput: (e) => { hFilter = e.target.value.toLowerCase(); renderRows(); } });
  box.append(h('div', { class: 'h-tools' }, h('button', { onclick: (e) => openCreateMenu(e.currentTarget) }, icon('plus'), 'Create'), search));
  const rows = h('div');
  box.append(rows);
  function renderRows() {
    rows.replaceChildren(...[
      h('div', { class: 'h-row scene' + (selectedId === SCENE_ID ? ' sel' : ''), onclick: () => select(SCENE_ID) }, icon('scene', 'ico'),
        h('span', { class: 'nm' }, levelList().length > 1 ? `${levelList()[0].name || 'Untitled'} › ${levelName(project, levelIdx)}` : levelList()[0].name || 'Untitled'),
        h('span', { class: 'tagchip' }, 'settings')),
      project.entities.filter((e) => !hFilter || (e.name || '').toLowerCase().includes(hFilter)).map((e) => h('div', {
        class: 'h-row' + (e.id === selectedId ? ' sel' : '') + (e.visible === false ? ' off' : '') + (e.template ? ' tpl' : ''),
        'data-id': e.id, style: '--indent: 14px',
        onclick: () => { if (selectedId === e.id && !isDesktop()) setDock('inspector'); else select(e.id); },
      },
      icon(iconFor(e), 'ico'),
      h('span', { class: 'nm' }, e.name || 'Object'),
      e.template && h('span', { class: 'tagchip' }, 'template'),
      (e.tags || []).includes('player') && h('span', { class: 'tagchip' }, 'player'),
      e.locked && h('span', { class: 'tagchip' }, 'locked'),
      h('button', { class: 'eye', title: 'Toggle visibility', onclick: (ev) => { ev.stopPropagation(); e.visible = e.visible === false; changed({ structure: true }); } }, icon(e.visible === false ? 'eyeoff' : 'eye'))))].flat());
  }
  renderRows();
  box.scrollTop = scroll;
}

function openCreateMenu(anchor) {
  const groups = is3D() ? PREFABS_3D : PREFABS_2D, objs = is3D() ? OBJECTS_3D : OBJECTS_2D;
  popMenu(anchor, [
    { cap: 'Objects' }, ...objs.map((o) => ({ icon: o.icon, label: o.label, fn: () => addEntity(o.props) })),
    '-', { cap: 'Prefabs' }, ...groups.map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o) })),
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
  const get = () => { const v = getPath(target(), path); return v === undefined ? spec.def : v; };
  const set = (v) => {
    setPath(target(), path, v);
    if (path === 'name' && target() === project) refreshAll();
    changed({ structure: spec.structure || ['name', 'tags', 'template', 'locked'].includes(path) });
  };
  const val = get();
  const label = h('label', { title: spec.label }, spec.label);
  let el;
  switch (spec.type) {
    case 'number': {
      const step = spec.step || (is3D() ? 0.1 : 1);
      const inp = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: val ?? '', 'data-path': path,
        oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) set(n); } });
      const bump = (d) => { const v = round((+get() || 0) + d * step, 3); inp.value = v; set(v); buzz(4); };
      el = h('div', { class: 'num' }, h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => bump(-1) }, '−'), inp,
        h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => bump(1) }, '+'));
      scrubber(label, inp, get, set, step);
      break;
    }
    case 'bool':
      el = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) });
      return h('div', { class: 'row inline' }, label, el);
    case 'select':
      el = h('select', { onchange: (e) => set(e.target.value) },
        spec.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === val }, l); }));
      break;
    case 'color': {
      const norm = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : /^#[0-9a-f]{3}$/i.test(c || '') ? '#' + c.slice(1).split('').map((d) => d + d).join('') : '#ffffff');
      if (spec.optional) {
        const cb = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked ? col.value : '') });
        const col = h('input', { type: 'color', value: norm(val), oninput: (e) => { cb.checked = true; set(e.target.value); } });
        el = h('div', { class: 'pair' }, cb, col);
      } else el = h('input', { type: 'color', value: norm(val), oninput: (e) => set(e.target.value) });
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
    case 'code':
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
    case 'template': {
      const names = project.entities.filter((e) => e.template).map((e) => e.name);
      el = h('select', { onchange: (e) => set(e.target.value) },
        h('option', { value: '' }, names.length ? 'None' : 'No templates in scene'),
        names.map((n) => h('option', { value: n, selected: n === val }, n)));
      break;
    }
    default:
      el = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', oninput: (e) => set(e.target.value) });
  }
  return h('div', { class: 'row' + (spec.type === 'code' || spec.type === 'json' ? ' full' : '') }, label, el);
}

/** "Position  X[ ] Y[ ] Z[ ]" row. */
function vecRow(target, label, keys, defs, step) {
  const fields = keys.map((k, i) => {
    const get = () => target()[k] ?? defs[i];
    const set = (v) => { target()[k] = v; changed(); };
    const inp = h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: get(), 'data-path': k,
      oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) set(n); } });
    const b = h('b', { class: 'xyz'[i] }, 'XYZ'[i]);
    scrubber(b, inp, get, set, step);
    return h('div', { class: 'vf' }, b, inp);
  });
  return h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'vec', style: `--n:${keys.length}` }, fields));
}

const closedComps = new Set();
let compClipboard = null;
function pasteComponent(j) {
  const c = compClipboard; if (!c) return;
  if (c.kind === 'behavior') (j.behaviors ||= []).push(clone(c.data));
  else j[c.kind] = clone(c.data);
  changed({ structure: true }); pushHistory();
  toast('Component pasted');
}
/** A collapsible component block. opts: { icon, key, enabled, onToggle, menu: [{label, fn}], desc } */
function comp(title, kids, opts = {}) {
  const key = opts.key || title;
  const el = h('div', { class: 'comp' + (closedComps.has(key) ? ' closed' : '') });
  const head = h('div', { class: 'comp-h', onclick: (e) => {
    if (e.target.closest('input,button')) return;
    el.classList.toggle('closed');
    if (el.classList.contains('closed')) closedComps.add(key); else closedComps.delete(key);
  } },
  h('span', { class: 'fold' }, icon('chevron')),
  opts.onToggle && h('input', { type: 'checkbox', checked: opts.enabled !== false, title: 'Enabled', onchange: (e) => opts.onToggle(e.target.checked) }),
  icon(opts.icon || 'bolt', 'ci'),
  h('span', { class: 't' }, title),
  opts.menu && h('button', { class: 'more', title: 'More', onclick: (e) => popMenu(e.currentTarget, opts.menu) }, icon('more')));
  el.append(head, h('div', { class: 'comp-b' }, opts.desc && h('p', { class: 'desc' }, opts.desc), kids));
  return el;
}

function syncTransformInputs() {
  const j = ent(selectedId); if (!j) return;
  for (const k of ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz']) {
    const el = $(`#inspector input[data-path="${k}"]`);
    if (el && document.activeElement !== el) el.value = j[k] ?? (k[0] === 's' ? 1 : 0);
  }
}

function renderInspector() {
  const box = $('#inspector');
  const scroll = box.scrollTop;
  box.replaceChildren();
  if (selectedId === SCENE_ID) { renderSceneSettings(box); box.scrollTop = scroll; return; }
  const j = ent(selectedId);
  if (!j) { box.append(h('div', { class: 'empty' }, 'Nothing selected.', h('br'), 'Tap an object in the Scene or Hierarchy.')); return; }
  const T = () => ent(selectedId) || {};
  const C = (path, spec) => control(T, path, spec);
  const threeD = is3D() && !j.ui;
  const idx = project.entities.indexOf(j);

  box.append(h('div', { class: 'nav-strip' },
    h('button', { class: 'btn back', onclick: () => setDock('hierarchy') }, icon('left'), 'Hierarchy'),
    h('span', { class: 'crumb' }, `${idx + 1} of ${project.entities.length}`),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn', title: 'Previous object', onclick: () => stepSelection(-1) }, icon('left')),
    h('button', { class: 'btn', title: 'Next object', onclick: () => stepSelection(1) }, icon('right'))));

  // header: active toggle + name, tag, flags
  box.append(h('div', { class: 'insp-head' },
    h('div', { class: 'big-ico' }, icon(iconFor(j))),
    h('input', { type: 'checkbox', checked: j.visible !== false, title: 'Active', onchange: (e) => { j.visible = e.target.checked; changed({ structure: true }); } }),
    h('input', { type: 'text', value: j.name || '', oninput: (e) => { j.name = e.target.value; changed(); renderHierarchy(); } }),
    h('div', { class: 'sub' },
      h('span', {}, 'Tags'),
      h('input', { type: 'text', value: (j.tags || []).join(', '), placeholder: 'player, enemy', autocapitalize: 'off',
        onchange: (e) => { j.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); changed({ structure: true }); } })),
    h('div', { class: 'sub' },
      h('label', { title: 'Hidden while playing; Spawner/Shooter make copies' }, h('input', { type: 'checkbox', checked: !!j.template, onchange: (e) => { j.template = e.target.checked; changed({ structure: true }); } }), 'Template'),
      h('label', { title: 'Cannot be picked in the Scene view' }, h('input', { type: 'checkbox', checked: !!j.locked, onchange: (e) => { j.locked = e.target.checked; changed({ structure: true }); } }), 'Locked'),
      !threeD && !j.ui && h('label', {}, 'Layer', h('input', { type: 'number', value: j.layer || 0, style: 'width:54px', oninput: (e) => { j.layer = parseInt(e.target.value, 10) || 0; changed(); } })))));
  if (j.template) box.append(h('p', { class: 'desc', style: 'padding:0 8px;color:var(--dim);font-size:11.5px' }, 'Template: hidden while playing. Spawner and Shooter components create copies of it by name.'));

  // Transform
  box.append(comp(j.ui ? 'Rect Transform' : 'Transform', threeD
    ? [vecRow(T, 'Position', ['x', 'y', 'z'], [0, 0, 0], 0.1), vecRow(T, 'Rotation', ['rx', 'ry', 'rz'], [0, 0, 0], 1), vecRow(T, 'Scale', ['sx', 'sy', 'sz'], [1, 1, 1], 0.05)]
    : [
      j.ui && C('anchor', { label: 'Anchor', type: 'select', options: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'], def: 'top-left' }),
      vecRow(T, j.ui ? 'Offset' : 'Position', ['x', 'y'], [0, 0], 1), vecRow(T, 'Rotation', ['rz'], [0], 1), vecRow(T, 'Scale', ['sx', 'sy'], [1, 1], 0.05)],
  { icon: 'move', key: 'transform', menu: [{ label: 'Reset', fn: () => { for (const k of ['rx', 'ry', 'rz']) delete j[k]; for (const k of ['sx', 'sy', 'sz']) delete j[k]; changed({ inspector: true }); } }] }));

  const copyItem = (kind, get) => ({ icon: 'copy', label: 'Copy Component', fn: () => { compClipboard = { kind, data: clone(get()) }; toast('Component copied'); } });
  const removeMenu = (fn, kind) => [kind && copyItem(kind, () => j[kind]), { icon: 'trash', label: 'Remove Component', fn }].filter(Boolean);
  if (j.shape) {
    const t = j.shape.type;
    box.append(comp('Shape Renderer', [
      C('shape.type', { label: 'Shape', type: 'select', options: [['rect', 'Rectangle'], ['circle', 'Circle'], ['triangle', 'Triangle'], ['star', 'Star']], structure: true }),
      t === 'circle' ? C('shape.r', { label: 'Radius', type: 'number', def: 20 }) : [C('shape.w', { label: 'Width', type: 'number', def: 40 }), C('shape.h', { label: 'Height', type: 'number', def: 40 })],
      t === 'rect' && C('shape.radius', { label: 'Corner Radius', type: 'number', def: 0 }),
      C('shape.fill', { label: 'Fill', type: 'color', optional: true }),
      C('shape.stroke', { label: 'Outline', type: 'color', optional: true }),
      j.shape.stroke && C('shape.lineWidth', { label: 'Outline Width', type: 'number', def: 2 }),
      C('shape.glow', { label: 'Glow', type: 'number', def: 0 }),
    ], { icon: iconFor(j), key: 'shape', menu: removeMenu(() => { delete j.shape; changed({ structure: true }); }, 'shape') }));
  }
  if (j.sprite) {
    box.append(comp('Image', [
      C('sprite.src', { label: 'Source URL', type: 'text' }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => pickImage((url) => { j.sprite.src = url; changed({ inspector: true }); }) }, icon('image'), 'Choose from device')),
      C('sprite.w', { label: 'Width', type: 'number', def: 64 }),
      C('sprite.h', { label: 'Height', type: 'number', def: 64 }),
    ], { icon: 'image', key: 'sprite', menu: removeMenu(() => { delete j.sprite; changed({ structure: true }); }, 'sprite') }));
  }
  if (j.text) {
    box.append(comp('Text', [
      C('text.value', { label: 'Text', type: 'text' }),
      h('p', { class: 'desc' }, 'Show game variables with braces: {score}, {lives}, {best}.'),
      C('text.size', { label: 'Font Size', type: 'number', def: 24 }),
      C('text.color', { label: 'Color', type: 'color' }),
      C('text.align', { label: 'Alignment', type: 'select', options: ['left', 'center', 'right'], def: 'center' }),
    ], { icon: 'text', key: 'text', menu: removeMenu(() => { delete j.text; changed({ structure: true }); }, 'text') }));
  }
  if (j.mesh) {
    const g = j.mesh.geometry;
    box.append(comp('Mesh Renderer', [
      C('mesh.geometry', { label: 'Mesh', type: 'select', options: [['box', 'Cube'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['plane', 'Plane']], structure: true }),
      g === 'box' && [C('mesh.w', { label: 'Width', type: 'number', def: 1, step: 0.1 }), C('mesh.h', { label: 'Height', type: 'number', def: 1, step: 0.1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1, step: 0.1 })],
      g === 'sphere' && C('mesh.r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 }),
      (g === 'cylinder' || g === 'cone') && [C('mesh.r', { label: 'Radius', type: 'number', def: 0.5, step: 0.05 }), C('mesh.h', { label: 'Height', type: 'number', def: 1, step: 0.1 })],
      g === 'plane' && [C('mesh.w', { label: 'Width', type: 'number', def: 1, step: 0.1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1, step: 0.1 })],
      C('mesh.color', { label: 'Color', type: 'color' }),
      C('mesh.emissive', { label: 'Emission', type: 'number', def: 0, step: 0.05 }),
      C('mesh.opacity', { label: 'Opacity', type: 'number', def: 1, step: 0.05 }),
    ], { icon: 'cube', key: 'mesh', menu: removeMenu(() => { delete j.mesh; changed({ structure: true }); }, 'mesh') }));
  }
  if (j.body && !j.ui) {
    const shp = j.body.shape || 'auto';
    box.append(comp(threeD ? 'Rigidbody' : 'Rigidbody 2D', [
      C('body.type', { label: 'Body Type', type: 'select', options: [['static', 'Static'], ['dynamic', 'Dynamic'], ['kinematic', 'Kinematic']], def: 'dynamic', structure: true }),
      C('body.sensor', { label: 'Is Trigger', type: 'bool', def: false }),
      j.body.type === 'dynamic' && [C('body.gravityScale', { label: 'Gravity Scale', type: 'number', def: 1, step: 0.1 }), C('body.bounce', { label: 'Bounciness', type: 'number', def: 0, step: 0.05 })],
      C('body.shape', { label: 'Collider', type: 'select', options: [['auto', 'Fit to shape'], ['box', 'Box'], [threeD ? 'sphere' : 'circle', threeD ? 'Sphere' : 'Circle']], def: 'auto', structure: true }),
      shp === 'box' && [C('body.w', { label: 'Size X', type: 'number', def: 1 }), C('body.h', { label: 'Size Y', type: 'number', def: 1 }), threeD && C('body.d', { label: 'Size Z', type: 'number', def: 1 })],
      (shp === 'circle' || shp === 'sphere') && C('body.r', { label: 'Radius', type: 'number', def: 10 }),
    ], { icon: 'body', key: 'body', desc: 'Static: walls and ground. Dynamic: pushed by physics. Kinematic: moves on its own.',
      menu: removeMenu(() => { delete j.body; changed({ structure: true }); }, 'body') }));
  }

  (j.behaviors || []).forEach((b, i) => {
    const def = Behaviors[b.type];
    const menu = [
      { icon: 'copy', label: 'Copy Component', fn: () => { compClipboard = { kind: 'behavior', data: clone(b) }; toast('Component copied'); } },
      { icon: 'trash', label: 'Remove Component', fn: () => { j.behaviors.splice(i, 1); changed({ structure: true }); } },
      i > 0 && { icon: 'upload', label: 'Move Up', fn: () => { j.behaviors.splice(i - 1, 0, j.behaviors.splice(i, 1)[0]); changed({ structure: true }); } },
      i < j.behaviors.length - 1 && { icon: 'download', label: 'Move Down', fn: () => { j.behaviors.splice(i + 1, 0, j.behaviors.splice(i, 1)[0]); changed({ structure: true }); } },
      def && { icon: 'rotate', label: 'Reset', fn: () => { j.behaviors[i] = defaultBehavior(b.type, threeD); changed({ structure: true }); } },
    ].filter(Boolean);
    if (!def) { box.append(comp(b.type, [h('p', { class: 'desc' }, 'Unknown component')], { menu })); return; }
    box.append(comp(def.label, def.params.map((p) => C(`behaviors.${i}.${p.key}`, { ...p, def: paramDefault(p, threeD) })), {
      icon: BEH_META[b.type]?.[1] || 'bolt', key: 'b' + i + b.type, desc: def.description, menu,
      enabled: b.enabled, onToggle: (on) => { if (on) delete b.enabled; else b.enabled = false; changed(); },
    }));
  });

  box.append(h('div', { class: 'add-comp', style: 'flex-direction:column;align-items:center;gap:10px' },
    h('button', { class: 'btn wide', onclick: openAddComponent }, icon('plus'), 'Add Component'),
    compClipboard && h('button', { class: 'btn wide', onclick: () => pasteComponent(j) }, icon('paste'), `Paste ${compClipboard.kind === 'behavior' ? Behaviors[compClipboard.data.type]?.label || 'Component' : compClipboard.kind}`)));
  box.append(h('div', { class: 'btns', style: 'padding:0 8px 24px' },
    h('button', { class: 'btn', onclick: () => duplicateEntity(j.id) }, icon('copy'), 'Duplicate'),
    h('button', { class: 'btn', onclick: () => deleteEntity(j.id) }, icon('trash'), 'Delete')));
  box.scrollTop = scroll;
}

// ---- scene settings (shown when the scene root is selected) ----
function renderSceneSettings(box) {
  const P = () => project, C = (path, spec) => control(P, path, spec), threeD = is3D();
  const game = levelList()[0];
  box.append(h('div', { class: 'insp-head' }, h('div', { class: 'big-ico' }, icon('scene')),
    h('span'), h('input', { type: 'text', value: game.name, placeholder: 'Game name', oninput: (e) => { game.name = e.target.value; changed(); renderHierarchy(); } }),
    h('div', { class: 'sub' }, `${threeD ? '3D' : '2D'} game · Pocket Engine ${VERSION}`)));
  box.append(comp('Level', [
    C('levelName', { label: 'Level Name', type: 'text', def: levelName(project, levelIdx) }),
    h('p', { class: 'desc' }, `This is level ${levelIdx + 1} of ${levelList().length}. Reaching a Goal moves on to the next level; score and lives carry over.`),
    h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => addLevel(false) }, icon('plus'), 'New Level'), h('button', { class: 'btn', onclick: openLevelMenu }, icon('layers'), 'All Levels')),
  ], { icon: 'layers', key: 's-level' }));
  box.append(comp('Environment', [
    C('background', { label: 'Background', type: 'color' }),
    C('gravity', { label: 'Gravity', type: 'number', def: threeD ? -25 : 0, step: threeD ? 1 : 50 }),
    h('p', { class: 'desc' }, threeD ? 'Use about -25 for normal gravity.' : 'Use 0 for top-down games and about 1600 for platformers.'),
    !threeD && vecRow(() => (project.view ||= { width: 400, height: 700 }), 'Screen Size', ['width', 'height'], [400, 700], 10),
  ], { icon: 'sun', key: 's-env' }));
  box.append(comp('Start Screen', [
    levelIdx > 0 && h('p', { class: 'desc' }, 'The start screen only shows before level 1.'),
    C('settings.title', { label: 'Title', type: 'text', def: '' }),
    C('settings.subtitle', { label: 'Subtitle', type: 'text', def: '' }),
    h('p', { class: 'desc' }, 'Leave Title empty to start the game right away.'),
  ], { icon: 'hud', key: 's-start' }));
  box.append(comp('Touch Controls', [
    C('settings.joystick', { label: 'Joystick', type: 'bool', def: false }),
    C('settings.jumpButton', { label: 'Jump Button', type: 'bool', def: false }),
    C('settings.actionButton', { label: 'Fire Button', type: 'bool', def: false }),
    C('settings.pauseButton', { label: 'Pause Button', type: 'bool', def: true }),
    C('settings.muteButton', { label: 'Mute Button', type: 'bool', def: true }),
    h('p', { class: 'desc' }, 'On a keyboard: arrows/WASD move, Space jumps, E fires.'),
  ], { icon: 'gamepad', key: 's-touch' }));
  box.append(comp('Mobile', [
    C('settings.orientation', { label: 'Screen Orientation', type: 'select', options: [['any', 'Any'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], def: 'any' }),
    h('p', { class: 'desc' }, 'Players holding the phone the wrong way see a "turn your device" screen.'),
    C('settings.fullscreen', { label: 'Go Fullscreen on First Tap', type: 'bool', def: false }),
    h('p', { class: 'desc' }, 'The screen stays awake while playing. Tilt controls: set a Move component\'s Control to "tilt".'),
  ], { icon: 'gamepad', key: 's-mobile' }));
  box.append(comp('Rules', [
    C('settings.winScore', { label: 'Win at Score', type: 'number', def: 0, step: 10 }),
    C('settings.timeLimit', { label: 'Time Limit (sec)', type: 'number', def: 0, step: 5 }),
    h('p', { class: 'desc' }, 'With a time limit, show the countdown in a text with {time}. 0 = no limit.'),
    h('div', { class: 'row inline' }, h('label', {}, 'Save Best Score'), h('div', {}, h('input', { type: 'checkbox', checked: !!project.settings.saveBest,
      onchange: (e) => { project.settings.saveBest = e.target.checked ? slug(levelList()[0].name) + '-' + projectId.slice(-4) : ''; changed(); } }))),
    C('vars', { label: 'Variables', type: 'json' }),
    h('p', { class: 'desc' }, 'Starting values, e.g. {"score": 0, "lives": 3}. Hazards that "damage" use lives.'),
  ], { icon: 'trophy', key: 's-rules' }));
  if (threeD) {
    box.append(comp('Camera & Lighting', [
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => {
        const c = engine.scene.camera, rv = (v) => ({ x: round(v.x), y: round(v.y), z: round(v.z) });
        project.camera = { ...(project.camera || {}), position: rv(c.position), target: rv(c.target) };
        changed(); toast('Game camera aligned with Scene view');
      } }, icon('camera'), 'Align Game Camera with View')),
      h('p', { class: 'desc' }, 'Used when no object has a Camera Follow component.'),
      C('camera.fov', { label: 'Field of View', type: 'number', def: 60 }),
      C('light.ambient', { label: 'Ambient Light', type: 'number', def: 0.45, step: 0.05 }),
      C('fog.near', { label: 'Fog Start', type: 'number', def: 30 }),
      C('fog.far', { label: 'Fog End', type: 'number', def: 120 }),
    ], { icon: 'camera', key: 's-cam' }));
  }
  box.append(h('div', { class: 'btns', style: 'padding:12px 8px 24px' },
    h('button', { class: 'btn primary', onclick: play }, icon('play'), 'Play'),
    h('button', { class: 'btn', onclick: exportHTML }, icon('download'), 'Build HTML')));
}

// ============================================================================
// Components (Add Component list + Project panel)
// ============================================================================
const BEH_META = {
  move: ['Controllers', 'player'], platformer: ['Controllers', 'jumper'], patrol: ['Movement', 'arrow'], velocity: ['Movement', 'arrow'],
  rotate: ['Movement', 'rotate'], wrap: ['Movement', 'frame'], cameraFollow: ['Camera', 'camera'],
  collectible: ['Gameplay', 'coin'], hazard: ['Gameplay', 'enemy'], goal: ['Gameplay', 'flag'], spring: ['Gameplay', 'jumper'],
  timeScore: ['Gameplay', 'trophy'], lifetime: ['Gameplay', 'clock'], destroyOffscreen: ['Gameplay', 'close'],
  spawner: ['Spawning', 'spawner'], shooter: ['Combat', 'bolt'], script: ['Scripting', 'script'],
  chase: ['Movement', 'ghost'], float: ['Movement', 'arrow'], message: ['Gameplay', 'sign'], teleport: ['Gameplay', 'portal'],
  unlock: ['Gameplay', 'door'], sound: ['Audio', 'bolt'],
  tappable: ['Touch', 'hand'], draggable: ['Touch', 'move'], swipeMove: ['Touch', 'arrow'],
  orbit: ['Movement', 'rotate'], pulse: ['Effects', 'circle'], checkpoint: ['Gameplay', 'flag'], destructible: ['Combat', 'bolt'],
  firstPerson: ['Controllers', 'crosshair'], thirdPerson: ['Controllers', 'player'], car: ['Controllers', 'car'],
  projectile: ['Combat', 'arrow'], income: ['Clicker', 'coin'], upgrade: ['Clicker', 'plus'],
};
function defaultBehavior(type, threeD) {
  const b = { type };
  for (const p of Behaviors[type].params) b[p.key] = clone(paramDefault(p, threeD));
  return b;
}
/** Every component that can be added to the object j. */
function componentsFor(j) {
  const threeD = is3D() && !(j && j.ui);
  const list = [
    { cat: 'Rendering', key: 'shape', label: 'Shape Renderer', icon: 'square', desc: 'Rectangle, circle, triangle or star', ok: (e) => !threeD && !e.shape, add: (e) => { e.shape = { type: 'rect', w: 40, h: 40, fill: '#4c8bd6' }; } },
    { cat: 'Rendering', key: 'mesh', label: 'Mesh Renderer', icon: 'cube', desc: 'Cube, sphere, cylinder, cone or plane', ok: (e) => threeD && !e.mesh, add: (e) => { e.mesh = { geometry: 'box', w: 1, h: 1, d: 1, color: '#4c8bd6' }; } },
    { cat: 'Rendering', key: 'text', label: 'Text', icon: 'text', desc: 'Words and live variables like {score}', ok: (e) => !e.text, add: (e) => { e.text = { value: 'Text', size: 24, color: '#ffffff' }; } },
    { cat: 'Rendering', key: 'sprite', label: 'Image', icon: 'image', desc: 'A picture from your device', ok: (e) => !threeD && !e.sprite, add: (e) => { e.sprite = { src: '', w: 64, h: 64 }; } },
    { cat: 'Physics', key: 'body', label: threeD ? 'Rigidbody' : 'Rigidbody 2D', icon: 'body', desc: 'Collide, fall and stand on things', ok: (e) => !e.ui && !e.body, add: (e) => { e.body = { type: 'dynamic' }; } },
  ];
  for (const [type, def] of Object.entries(Behaviors)) {
    list.push({ cat: BEH_META[type]?.[0] || 'Other', key: 'b:' + type, label: def.label, icon: BEH_META[type]?.[1] || 'bolt', desc: def.description,
      ok: (e) => !e.ui || type === 'script', add: (e) => { (e.behaviors ||= []).push(defaultBehavior(type, threeD)); if (type === 'move' || type === 'platformer') e.tags = [...new Set([...(e.tags || []), 'player'])]; } });
  }
  return list;
}
function addComponentTo(id, key) {
  const j = ent(id);
  if (!j) { toast('Select an object first'); return false; }
  const c = componentsFor(j).find((x) => x.key === key);
  if (!c) return false;
  if (!c.ok(j)) { toast(`${c.label} can't be added to ${j.name}`); return false; }
  c.add(j);
  if (key === 'b:platformer' && !project.gravity) project.gravity = is3D() ? -25 : 1600;
  if (key === 'b:platformer') Object.assign(project.settings, { joystick: true, jumpButton: true });
  selectedId = id;
  changed({ structure: true }); pushHistory();
  toast(`Added ${c.label} to ${j.name}`);
  return true;
}

function openAddComponent() {
  const j = ent(selectedId); if (!j) return;
  const list = componentsFor(j).filter((c) => c.ok(j));
  const body = h('div');
  const search = h('input', { class: 'ac-search', type: 'search', placeholder: 'Search components', autocapitalize: 'off', oninput: () => draw() });
  function draw() {
    const q = search.value.toLowerCase();
    const cats = {};
    for (const c of list) if (!q || c.label.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)) (cats[c.cat] ||= []).push(c);
    body.replaceChildren(...Object.entries(cats).flatMap(([cat, items]) => [h('div', { class: 'ac-cat' }, cat),
      ...items.map((c) => h('button', { class: 'ac-item', onclick: () => { closeLayer(); addComponentTo(j.id, c.key); } }, icon(c.icon, 'ci'), h('span', {}, c.label, h('small', {}, c.desc))))]));
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
  { icon: 'move', label: 'Draggable', props: { name: 'Draggable Block', shape: { type: 'rect', w: 70, h: 70, radius: 10, fill: '#7e57c2' }, behaviors: [{ type: 'draggable', snap: 0, lift: true }] } },
  { icon: 'arrow', label: 'Lane Runner', props: { name: 'Runner', tags: ['player'], shape: { type: 'rect', w: 40, h: 40, radius: 8, fill: '#4fc3f7' }, behaviors: [{ type: 'swipeMove', distance: 110, lanes: 3, jump: 0 }] } },
  { icon: 'flag', label: 'Checkpoint', props: { name: 'Checkpoint', shape: { type: 'rect', w: 14, h: 70, fill: '#90a4ae' }, behaviors: [{ type: 'checkpoint', text: 'Checkpoint!', tag: 'player' }] } },
  { icon: 'rotate', label: 'Orbiter', props: { name: 'Orbiter', shape: { type: 'circle', r: 14, fill: '#e53935' }, behaviors: [{ type: 'orbit', radius: 80, speed: 120 }, { type: 'hazard', action: 'damage' }] } },
  { icon: 'bolt', label: 'Shooter Ship', props: { name: 'Ship', tags: ['player'], shape: { type: 'triangle', w: 34, h: 40, fill: '#4fc3f7' }, behaviors: [{ type: 'move', control: 'both', speed: 280, axes: 'horizontal' }, { type: 'shooter', template: 'Bullet', every: 0.25, trigger: 'auto' }] },
    extra: [{ name: 'Bullet', template: true, tags: ['bullet'], offset: { x: 60, y: 0 }, shape: { type: 'rect', w: 6, h: 16, radius: 3, fill: '#fff59d' }, behaviors: [{ type: 'velocity', vx: 0, vy: -600, vz: 0 }, { type: 'destroyOffscreen', margin: 60 }] }] },
  { icon: 'square', label: 'Target', props: { name: 'Target', shape: { type: 'rect', w: 50, h: 50, radius: 8, fill: '#ff8a65' }, behaviors: [{ type: 'destructible', hp: 3, hitBy: 'bullet', points: 10, removeHitter: true }] } },
  { icon: 'car', label: 'Car', props: { name: 'Car', tags: ['player'], shape: { type: 'rect', w: 26, h: 44, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'car', maxSpeed: 320, accel: 260, turn: 160, autoGas: false }, { type: 'cameraFollow', axes: 'both', smooth: 5 }] } },
  { icon: 'hand', label: 'Clicker', props: { name: 'Big Button', shape: { type: 'circle', r: 80, fill: '#ffb74d', stroke: '#e65100', lineWidth: 6 }, behaviors: [{ type: 'tappable', points: 1, var: 'score', bonusVar: 'perTap', destroy: false, sound: 'click' }] }, vars: { perTap: 0 } },
  { icon: 'plus', label: 'Upgrade', props: { name: 'Upgrade Button', ui: true, anchor: 'bottom', x: 0, y: -100, shape: { type: 'rect', w: 320, h: 60, radius: 14, fill: '#5d4037' }, text: { value: 'Upgrade +1/s  ·  {cost}', size: 18, color: '#fff3e0' }, behaviors: [{ type: 'upgrade', cost: 15, costVar: 'score', addVar: 'perSecond', amount: 1, growth: 1.15 }] }, vars: { perSecond: 0 },
    extra: [{ name: 'Income', offset: { x: -150, y: -300 }, behaviors: [{ type: 'income', var: 'score', rateVar: 'perSecond' }] }] },
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
  { icon: 'player', label: 'TPS Player', props: { name: 'Hero', tags: ['player'], y: 1, mesh: { geometry: 'cylinder', r: 0.4, h: 1.4, color: '#ff8a3d' }, behaviors: [{ type: 'thirdPerson', speed: 6, jump: 10, distance: 7, height: 25, look: 0.3 }] },
    scene: { settings: { joystick: true, jumpButton: true } } },
  { icon: 'car', label: 'Car', props: { name: 'Car', tags: ['player'], y: 0.5, mesh: { geometry: 'box', w: 1.4, h: 0.8, d: 2.4, color: '#e53935' }, behaviors: [{ type: 'car', maxSpeed: 16, accel: 12, turn: 110, autoGas: false, chaseCam: true }] },
    scene: { settings: { joystick: true } } },
];
const OBJECTS_2D = [
  { icon: 'gear', label: 'Empty', props: { name: 'GameObject' } },
  { icon: 'square', label: 'Square', props: { name: 'Square', shape: { type: 'rect', w: 60, h: 60, fill: '#4c8bd6' } } },
  { icon: 'circle', label: 'Circle', props: { name: 'Circle', shape: { type: 'circle', r: 30, fill: '#e57373' } } },
  { icon: 'triangle', label: 'Triangle', props: { name: 'Triangle', shape: { type: 'triangle', w: 60, h: 60, fill: '#9575cd' } } },
  { icon: 'star', label: 'Star', props: { name: 'Star', shape: { type: 'star', w: 60, h: 60, fill: '#ffca28' } } },
  { icon: 'text', label: 'Text', props: { name: 'Text', text: { value: 'Hello', size: 32, color: '#ffffff' } } },
  { icon: 'hud', label: 'UI Text', props: { name: 'UI Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } } },
  { icon: 'image', label: 'Image', props: { name: 'Image', sprite: { src: '', w: 80, h: 80 } }, pickImage: true },
];
const OBJECTS_3D = [
  { icon: 'gear', label: 'Empty', props: { name: 'GameObject' } },
  { icon: 'cube', label: 'Cube', props: { name: 'Cube', mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#4c8bd6' } } },
  { icon: 'sphere', label: 'Sphere', props: { name: 'Sphere', mesh: { geometry: 'sphere', r: 0.5, color: '#e57373' } } },
  { icon: 'cylinder', label: 'Cylinder', props: { name: 'Cylinder', mesh: { geometry: 'cylinder', r: 0.5, h: 1, color: '#9575cd' } } },
  { icon: 'cone', label: 'Cone', props: { name: 'Cone', mesh: { geometry: 'cone', r: 0.5, h: 1, color: '#ffca28' } } },
  { icon: 'plane', label: 'Plane', props: { name: 'Plane', y: 0.01, mesh: { geometry: 'plane', w: 4, d: 4, color: '#8d8d9a' } } },
  { icon: 'hud', label: 'UI Text', props: { name: 'UI Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } } },
];

let projectTab = 'prefabs';
function renderProject() {
  const box = $('#project');
  box.replaceChildren();
  const tabs = [['prefabs', 'Prefabs', 'folder'], ['objects', 'Objects', 'folder'], ['components', 'Components', 'folder']];
  box.append(h('div', { class: 'p-tabs' }, tabs.map(([k, l, ic]) => h('button', { class: projectTab === k ? 'active' : '', onclick: () => { projectTab = k; renderProject(); } }, icon(ic), l))));
  box.append(h('div', { class: 'p-path' }, `Assets › ${tabs.find((t) => t[0] === projectTab)[1]}`));
  let items;
  if (projectTab === 'components') {
    items = componentsFor(null).filter((c) => c.ok({})).map((c) => ({ icon: c.icon, label: c.label, payload: { kind: 'component', key: c.key, label: c.label, icon: c.icon }, comp: true }));
  } else {
    const src = projectTab === 'prefabs' ? (is3D() ? PREFABS_3D : PREFABS_2D) : (is3D() ? OBJECTS_3D : OBJECTS_2D);
    items = src.map((o) => ({ icon: o.icon, label: o.label, payload: { kind: 'prefab', def: o, label: o.label, icon: o.icon } }));
  }
  box.append(h('div', { class: 'tiles' }, items.map((it) => {
    const t = h('div', { class: 'tile' + (it.comp ? ' comp-tile' : '') }, h('div', { class: 'th' }, icon(it.icon)), h('div', { class: 'lb' }, it.label));
    draggable(t, it.payload);
    return t;
  })));
  box.append(h('p', { class: 'p-note' }, projectTab === 'components'
    ? 'Drag a component onto an object in the Scene or Hierarchy, or tap to add it to the selected object.'
    : 'Drag into the Scene to place, or tap to add at the center of the view.'));
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
  if (def.scene) {
    if (def.scene.gravity != null && !project.gravity) project.gravity = def.scene.gravity;
    Object.assign(project.settings, def.scene.settings || {});
  }
  if (def.props.behaviors?.some((b) => b.type === 'hazard') && project.vars.lives == null) project.vars.lives = 3;
  if (def.vars) for (const [k, v] of Object.entries(def.vars)) project.vars[k] ??= v;
  if (def.settings) for (const [k, v] of Object.entries(def.settings)) if (!project.settings[k]) project.settings[k] = v;
  for (const x of def.extra || []) {
    if (project.entities.some((e) => e.name === x.name)) continue;
    const { offset, ...props } = x;
    const base = at || (is3D() ? orbit.target : { x: engine.scene.camera.x, y: engine.scene.camera.y });
    addEntity(props, props.ui ? undefined : { x: (base.x || 0) + (offset?.x || 0), y: (base.y || 0) + (offset?.y || 0), z: base.z || 0 });
  }
  const j = addEntity(def.props, at);
  if (def.pickImage) pickImage((url) => { const e = ent(j.id); if (e?.sprite) { e.sprite.src = url; changed({ inspector: true }); } });
  toast(`Added ${j.name}`);
}
function placePrefab(def, sx, sy) {
  const s = engine.scene;
  if (def.props.ui) { addPrefab(def); return; }
  if (is3D()) {
    const hit = rayPlaneY(engine.renderer.screenRay(s, sx, sy), 0);
    addPrefab(def, hit ? { x: hit.x, z: hit.z } : undefined);
  } else addPrefab(def, engine.renderer.screenToWorld(s, sx, sy));
}

function duplicateEntity(id) {
  const j = ent(id); if (!j) return;
  const c = clone(j); c.id = uid(); c.name = (j.name || 'Object') + ' (copy)';
  if (j.ui) c.y = (c.y || 0) + 30; else if (is3D()) c.x = (c.x || 0) + 1.5; else { c.x = (c.x || 0) + 30; c.y = (c.y || 0) + 30; }
  project.entities.splice(project.entities.indexOf(j) + 1, 0, c);
  selectedId = c.id;
  changed({ structure: true }); pushHistory();
}
function deleteEntity(id) {
  const i = project.entities.findIndex((e) => e.id === id); if (i < 0) return;
  const name = project.entities[i].name;
  project.entities.splice(i, 1);
  if (selectedId === id) selectedId = null;
  changed({ structure: true }); pushHistory(); updateCtxBar();
  toast(`Deleted ${name}. Undo to restore.`);
}

function pickImage(cb) {
  const fi = $('#fileInput');
  fi.accept = 'image/*';
  fi.onchange = () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { // downscale so projects fit in local storage
      const k = Math.min(1, 256 / Math.max(img.width, img.height)), c = document.createElement('canvas');
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
function closeLayer() { layer.hidden = true; layer.className = ''; layer.replaceChildren(); }
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
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, window.innerWidth - mw - 8), y = r.bottom + 2;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 2);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
}
function openDialog(title, kids) {
  const d = h('div', { class: 'dialog' }, h('div', { class: 'dh' }, h('span', {}, title), h('button', { onclick: closeLayer, title: 'Close' }, icon('close'))), h('div', { class: 'db' }, kids));
  layer.replaceChildren(d); layer.className = 'dim'; layer.hidden = false;
}

function openFileMenu() {
  popMenu($('#fileBtn'), [
    { icon: 'home', label: 'Home', fn: showHome },
    { icon: 'newfile', label: 'New Game…', fn: openNewDialog },
    { icon: 'folder', label: 'Open Project…', fn: openProjectsDialog },
    { icon: 'undo', label: 'Undo', k: '2-finger tap', fn: () => undoRedo(-1) },
    { icon: 'redo', label: 'Redo', k: '3-finger tap', fn: () => undoRedo(1) },
    '-',
    { icon: 'save', label: 'Save', k: 'auto', fn: () => { saveNow(); toast('Saved'); } },
    { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Project name', root.name); if (n) { root.name = n; changed(); refreshAll(); } } },
    { icon: 'copy', label: 'Duplicate Project', fn: () => { const c = clone(root); c.name += ' (copy)'; openProject(c); toast('Project duplicated'); } },
    { icon: 'layers', label: 'Levels…', fn: openLevelMenu },
    '-',
    { icon: 'gear', label: 'Scene Settings', fn: () => { select(SCENE_ID); if (!isDesktop()) setDock('inspector'); } },
    { icon: 'play', label: 'Play', fn: play },
    { icon: 'download', label: 'Build HTML', k: 'offline file', fn: exportHTML },
    '-',
    { icon: 'download', label: 'Export Project (.json)', fn: () => download(slug(root.name) + '.json', JSON.stringify(root, null, 2), 'application/json') },
    { icon: 'upload', label: 'Import Project…', fn: importJSON },
    '-',
    !matchMedia('(display-mode: standalone)').matches && { icon: 'download', label: 'Install App', k: 'works offline', fn: installApp },
    { icon: 'bulb', label: 'Quick Tour', fn: () => openTour(0) },
    { icon: 'help', label: 'Controls', fn: openHelp },
    { icon: 'external', label: 'Examples & Docs', fn: () => { location.href = '../'; } },
  ]);
}

const TPL_COLORS = { 'tap-frenzy': '#16233b', 'sky-dodge': '#22314f', 'jump-quest': '#2d3f6b', 'gem-garden': '#3f6d4a', 'empty-2d': '#2b2b2b', 'empty-3d': '#2f3a44' };
function typeCards(onPick) {
  return h('div', { class: 'types' }, templateInfo.map((t) => h('button', { class: 'type', onclick: () => onPick(t) },
    h('div', { class: 'pv', style: `background:${t.color || '#2b2b2b'}` }, icon(t.icon || 'cube')),
    h('b', {}, t.title), h('small', {}, `${templates[t.key].mode.toUpperCase()} · ${t.blurb}`))));
}
function startGame(t) {
  closeLayer(); hideHome();
  if (store.get('pocket.editor.toured', '') !== '1') setTimeout(() => openTour(0), 400);
  newFromTemplate(t.key, t.key.startsWith('empty') ? 'New Game' : undefined);
  toast(`Created ${root.name}. Tap ▶ Play to try it!`);
}
function openNewDialog() {
  openDialog('New Game', [h('p', { class: 'desc', style: 'color:var(--muted);margin:0 0 12px' }, 'Pick a game type. Each one is a working game you can change any way you like.'), typeCards(startGame)]);
}

// ---- Home screen: continue, new game by type, my games ----
function showHome() {
  closeLayer();
  const home = $('#home'), all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  const cur = root && all.find(([id]) => id === projectId);
  home.replaceChildren(
    h('div', { class: 'hd' }, h('img', { src: '../icon.svg', alt: '' }), h('h1', {}, 'Pocket Engine')),
    h('p', { class: 'sub' }, 'Make 2D and 3D games on your phone.'),
    cur && h('button', { class: 'continue', onclick: hideHome },
      h('span', { class: 'ic' }, icon('play')), h('span', {}, h('b', {}, `Continue “${root.name}”`), h('small', {}, `${root.mode.toUpperCase()} · last edited ${new Date(cur[1].updated).toLocaleString()}`))),
    h('h2', {}, 'New game'),
    typeCards(startGame),
    all.length ? [h('h2', {}, 'My games'), h('div', { class: 'mine' }, all.map(([id, pr]) => h('div', { class: 'proj-row' },
      icon(pr.json.mode === '3d' ? 'cube' : 'grid'),
      h('span', { class: 'nm', onclick: () => { saveNow(); openProject(pr.json, id); hideHome(); } }, pr.name),
      h('small', {}, new Date(pr.updated).toLocaleDateString()),
      id !== projectId && h('button', { title: 'Delete', onclick: () => {
        if (!confirm(`Delete "${pr.name}"? This cannot be undone.`)) return;
        const a = loadProjects(); delete a[id]; store.set(PROJECTS_KEY, JSON.stringify(a)); showHome();
      } }, icon('trash')))))] : null,
    h('div', { class: 'home-actions' },
      h('button', { class: 'btn', onclick: importJSON }, icon('upload'), 'Import'),
      !matchMedia('(display-mode: standalone)').matches && h('button', { class: 'btn', onclick: installApp }, icon('download'), 'Install App')),
  );
  home.hidden = false;
  home.scrollTop = 0;
}
function hideHome() { $('#home').hidden = true; requestAnimationFrame(() => engine.resize()); }
function openProjectsDialog() {
  const all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  openDialog('Open Project', all.length ? all.map(([id, p]) => h('div', { class: 'proj-row' },
    icon(p.json.mode === '3d' ? 'cube' : 'grid'),
    h('span', { class: 'nm', onclick: () => { closeLayer(); saveNow(); openProject(p.json, id); } }, p.name, id === projectId ? ' (open)' : ''),
    h('small', {}, new Date(p.updated).toLocaleDateString()),
    id !== projectId && h('button', { title: 'Delete', onclick: () => {
      if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
      const a = loadProjects(); delete a[id]; store.set(PROJECTS_KEY, JSON.stringify(a)); openProjectsDialog();
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

function openHelp() {
  const row = (a, b) => h('div', { class: 'help-row' }, h('b', {}, a), h('span', {}, b));
  openDialog('Controls', [
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
function importJSON() {
  const fi = $('#fileInput');
  fi.accept = 'application/json,.json';
  fi.onchange = async () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      if (!Array.isArray(json.entities)) throw new Error('not a Pocket project');
      for (const e of json.entities) e.id ||= uid();
      openProject(json); hideHome(); toast(`Imported ${json.name || 'project'}`);
    } catch (err) { toast('Could not import: ' + err.message); }
  };
  fi.click();
}
/** One self-contained HTML file: engine source + game JSON. */
async function exportHTML() {
  try {
    const src = await (await fetch(new URL('../engine/pocket.js', import.meta.url))).text();
    const game = JSON.stringify(root).replace(/</g, '\\u003c');
    const title = String(root.name).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' })[c]);
    const bg = /^#[0-9a-f]{3,8}$/i.test(root.background || '') ? root.background : '#000000';
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="${bg}">
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:${bg};overflow:hidden;overscroll-behavior:none}</style>
</head><body>
<script type="module">
${src.replace(/<\/script/gi, '<\\/script')}
new Engine().start(${game});
</script>
</body></html>`;
    download(slug(root.name) + '.html', html, 'text/html');
    toast('Build complete: open the HTML file in any browser');
  } catch (err) {
    toast('Build failed: ' + err.message);
  }
}

// ============================================================================
// Play mode
// ============================================================================
function play() {
  if (playing) return;
  closeLayer();
  document.activeElement?.blur?.();
  playing = true;
  updateCtxBar();
  document.body.classList.add('playing');
  $('#playBar').hidden = false;
  $('#playBtn').classList.add('on'); $('#playBtn').replaceChildren(icon('stop'), h('span', {}, 'Stop'));
  engine.editing = false;
  engine.input.enabled = true;
  engine.timeScale = 1;
  const json = clone(root);
  for (const lv of [json, ...(json.levels || [])]) lv.settings = { ...lv.settings, pauseButton: false, muteButton: false, fullscreen: false, orientation: 'any' };
  try {
    engine.start(json, { level: levelIdx });
    if (engine.scene.state === 'title') engine.scene.state = 'play';
  } catch (err) { console.error(err); toast('Error: ' + err.message); stop(); return; }
  updatePauseButtons();
  requestAnimationFrame(() => { engine.resize(); engine.layoutButtons(); });
}
function stop() {
  if (!playing) return;
  playing = false;
  document.body.classList.remove('playing');
  $('#playBar').hidden = true;
  $('#playBtn').classList.remove('on'); $('#playBtn').replaceChildren(icon('play'), h('span', {}, 'Play'));
  engine.editing = true;
  engine.paused = false;
  engine.input.enabled = false;
  engine.input.reset();
  engine.timeScale = 1;
  engine.factory = null;
  updatePauseButtons();
  updateCtxBar();
  requestAnimationFrame(() => { engine.resize(); rebuild(); });
}
function togglePause() { if (!playing) return; engine.paused = !engine.paused; updatePauseButtons(); }
function updatePauseButtons() {
  $('#pauseBtn').disabled = !playing;
  for (const b of [$('#pauseBtn'), $('#pbPause')]) b.classList.toggle('on', playing && engine.paused);
}
setInterval(() => { if (playing) updatePauseButtons(); }, 300); // the game can unpause itself on tap

// ============================================================================
// Wire up
// ============================================================================
$('#fileBtn').append(icon('menu'));
for (const b of $$('#toolRail [data-tool]')) { b.append(icon(b.dataset.tool === 'paint' ? 'brush' : b.dataset.tool)); b.addEventListener('click', () => setTool(b.dataset.tool)); }
$('#playBtn').append(icon('play'), h('span', {}, 'Play')); $('#pauseBtn').append(icon('pause'));
$('#pbPlay').append(icon('play')); $('#pbPause').append(icon('pause'));
$('#undoBtn').append(icon('undo')); $('#redoBtn').append(icon('redo'));
$('#snapBtn').append(icon('magnet')); $('#gridBtn').append(icon('grid')); $('#frameBtn').append(icon('frame'));
for (const [name, ic, label] of [['hierarchy', 'list', 'Hierarchy'], ['inspector', 'info', 'Inspector'], ['project', 'folder', 'Project']]) {
  $(`#dockTabs [data-dock="${name}"]`).append(icon(ic), label);
  $(`.ptab[data-title="${name}"]`).append(icon(ic), label);
}
$('#dockTabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setDock(b.dataset.dock, { fromTab: true }); });
$('#panelsFab').append(icon('list'));
$('#addFab').append(icon('plus'));
$('#addFab').addEventListener('click', () => { projectTab = 'prefabs'; renderProject(); setDock('project'); setSheet('half'); });
$('#panelsFab').addEventListener('click', () => setSheet('half'));
for (const [act, ic, label] of [['inspect', 'info', 'Inspect'], ['duplicate', 'copy', 'Duplicate'], ['focus', 'frame', 'Focus'], ['delete', 'trash', 'Delete']]) {
  const b = $(`#ctxBar [data-act="${act}"]`);
  b.append(icon(ic), label);
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
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
$('#app').dataset.sheet = 'half';
setTool('move');

{
  const all = loadProjects(), cur = store.get(CURRENT_KEY, '');
  const q = new URLSearchParams(location.search);
  if (q.get('template') && templates[q.get('template')]) newFromTemplate(q.get('template'));
  else {
    if (all[cur]) openProject(all[cur].json, cur);
    else newFromTemplate('sky-dodge', 'My First Game');
    showHome();
    if (store.get('pocket.editor.toured', '') !== '1') {
      const hint = $('#hint');
      hint.textContent = 'Tap + to add things · tap an object to edit it';
      hint.hidden = false;
    }
  }
}
