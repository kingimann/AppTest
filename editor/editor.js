// Pocket Editor: build Pocket Engine games on a phone.
// Layout: toolbar · Scene view · Hierarchy / Inspector / Project panels.
// A project is plain scene JSON (see examples/templates.js), the same thing Engine.start() plays.
import { Engine, Scene, Behaviors, paramDefault, uid, anchorPoint, VERSION, VOXEL_NAMES, GEOMETRIES, ACTIONS, RULE_EVENTS, partSize, M4, DEG, NODE_TYPES } from '../engine/pocket.js';
import { EMOJI, MODELS_3D, UI_WIDGETS } from './library.js';
import { templates, templateInfo } from '../examples/templates.js';
import { icon } from './icons.js';
import { openNodeEditor } from './nodes.js';
import { openModeler } from './modeler.js';
import { makeCube } from './meshops.js';

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
let uiMode = false;
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
const hasVisual = (e) => !!(e.shape || e.mesh || e.text || e.sprite || e.voxels || e.model || e.bar);

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
    // Camera objects: dashed frame of what they see; selected lights: their range
    for (const pe of project.entities) {
      const cam = (pe.behaviors || []).find((b) => b.type === 'camera');
      if (!cam || pe.ui) continue;
      const zm = +cam.zoom || 1, w = s.view.width / zm, hgt = s.view.height / zm;
      ctx.save(); ctx.setLineDash([8 / z, 6 / z]); ctx.strokeStyle = pe.id === selectedId ? ORANGE : 'rgba(140,200,255,0.7)'; ctx.lineWidth = 1.5 / z;
      ctx.strokeRect((pe.x || 0) - w / 2, (pe.y || 0) - hgt / 2, w, hgt); ctx.restore();
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
    const pe = ent(e.id), glyph = (pe?.behaviors || []).some((b) => b.type === 'camera') ? '🎥' : e.light ? '💡' : '';
    if (glyph) { ctx.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; ctx.fillText(glyph, p.x, p.y + 1); }
    else {
      ctx.strokeStyle = isSel ? ORANGE : '#cfcfcf'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6); ctx.lineTo(p.x + Math.cos(a) * 8.5, p.y + Math.sin(a) * 8.5); }
      ctx.stroke();
    }
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
  const s = engine.scene, list = s.entities.slice().reverse().filter((e) => !ent(e.id)?.locked && (!uiMode || e.ui));
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
  } else if (g.type === 'voxel') {
    voxelPaint(x, y);
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
  cancelLongPress();
  if (ptrs.size === 0 && tapTrack && tapTrack.max >= 2 && !tapTrack.moved && performance.now() - tapTrack.t0 < 400) {
    undoRedo(tapTrack.max >= 3 ? 1 : -1); buzz(10); toast(tapTrack.max >= 3 ? 'Redo' : 'Undo');
    tapTrack = null; gesture = null; return;
  }
  const g = gesture;
  if (!g) return;
  if (['free', 'axis', 'rotate', 'scale'].includes(g.type) && g.moved) { pushHistory(); saveSoon(); }
  if (g.type === 'voxel' && g.count) { pushHistory(); saveSoon(); renderInspector(); }
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
  if (selectedId && fromScene && dockTab === 'hierarchy' && sheetState() !== 'peek') setDock('inspector');
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
  if (e.voxels) return 'grid';
  if ((e.behaviors || []).some((b) => b.type === 'camera')) return 'camera';
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
function renderHierarchy() {
  const box = $('#hierarchy');
  const scroll = box.scrollTop;
  box.replaceChildren();
  const search = h('input', { type: 'text', placeholder: 'Search', value: hFilter, autocapitalize: 'off',
    oninput: (e) => { hFilter = e.target.value.toLowerCase(); renderRows(); } });
  box.append(h('div', { class: 'h-tools' }, h('button', { onclick: (e) => openCreateMenu(e.currentTarget) }, icon('plus'), 'Create'), search));
  const gs = gettingStarted();
  if (gs) box.append(gs);
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
    { done: has((e) => beh(e, 'graph') || beh(e, 'rules')), label: 'Add logic with nodes', btn: 'Script', fn: addVisualScript },
    { done: store.get('pocket.editor.played.' + projectId, '') === '1', label: 'Press Play to test', btn: 'Play', fn: play },
  ];
  const n = steps.filter((x) => x.done).length;
  if (n === steps.length) return null;
  return h('div', { class: 'gs' },
    h('div', { class: 'gs-hd' }, h('b', {}, 'Getting started'), h('span', { class: 'gs-n' }, `${n} / ${steps.length}`),
      h('button', { class: 'gs-x', title: 'Hide', onclick: () => { store.set(key, 'hide'); renderHierarchy(); } }, icon('close'))),
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
  (j.behaviors ||= []).push(b);
  selectedId = j.id;
  changed({ structure: true }); pushHistory();
  editGraph(() => ent(j.id) || {}, `behaviors.${j.behaviors.length - 1}.graph`);
}

function openCreateMenu(anchor) {
  const groups = is3D() ? PREFABS_3D : PREFABS_2D, objs = is3D() ? OBJECTS_3D : OBJECTS_2D;
  popMenu(anchor, [
    { cap: 'Objects' }, ...objs.map((o) => ({ icon: o.icon, label: o.label, fn: () => addEntity(o.props) })),
    '-', { cap: 'Prefabs' }, ...groups.map((o) => ({ icon: o.icon, label: o.label, fn: () => addPrefab(o) })),
    '-', { cap: 'Logic' }, { icon: 'nodes', label: 'Visual Script (nodes)', fn: addVisualScript },
    is3D() && { icon: 'cube', label: 'New 3D Model (Modeler)', fn: newModel },
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
    case 'rules':
      return rulesEditor(target, path);
    case 'graph':
      return graphCard(target, path);
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

/** Node-based coding: a summary card that opens the full-screen Node Editor. */
function graphCard(target, path) {
  const g = getPath(target(), path) || { nodes: [], links: [] };
  const events = [...new Set((g.nodes || []).filter((n) => NODE_TYPES[n.type]?.cat === 'Events').map((n) => NODE_TYPES[n.type].label))];
  return h('div', { class: 'row full graph-card' },
    h('div', { class: 'gc-sum' }, icon('nodes'), h('div', {},
      h('b', {}, `${(g.nodes || []).length} nodes · ${(g.links || []).length} wires`),
      h('small', {}, events.length ? 'Runs: ' + events.join(', ') : 'No event yet. Add a green Event node to start.'))),
    h('button', { class: 'btn primary gc-open', onclick: () => editGraph(target, path) }, icon('nodes'), 'Open Node Editor'));
}
function editGraph(target, path) {
  const e = target(), id = e.id;
  const T = () => ent(id) || e;
  const back = () => ed.close();
  const ed = openNodeEditor({
    graph: getPath(e, path), title: e.name, h, popMenu, toast, buzz,
    templates: project.entities.filter((x) => x.template).map((x) => x.name),
    objects: project.entities.filter((x) => !x.template && x.name).map((x) => x.name),
    vars: [...new Set(['score', 'lives', 'hp', ...Object.keys(levelList()[0].vars || {}), ...Object.keys(project.vars || {})])],
    onChange: (g) => { setPath(T(), path, g); requestRebuild(); saveSoon(); },
    onClose: () => { dropBack(back); pushHistory(); renderInspector(); },
  });
  pushBack(back);
}

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
    const b = h('b', { class: 'xyz'[i] }, 'XYZ'[i]);
    scrubber(b, inp, get, set, step);
    return h('div', { class: 'vf' }, b, inp);
  });
  return h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'vec', style: `--n:${keys.length}` }, fields));
}

const GEO_OPTIONS = [['box', 'Cube'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['capsule', 'Capsule'], ['pyramid', 'Pyramid'], ['wedge', 'Ramp / Wedge'], ['prism', 'Prism'], ['gem', 'Gem'], ['dome', 'Dome'], ['torus', 'Ring / Torus'], ['plane', 'Plane']];

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
function newModel() {
  const j = addEntity({ name: 'Model', y: 0, model: { parts: [{ geometry: 'mesh', ...makeCube(), x: 0, y: 0.5, z: 0, color: '#b0bec5' }] } });
  editModel(j, { edit: true });
}

const closedComps = new Set();
let showAdvanced = store.get('pocket.editor.advanced', '0') === '1', lastInspected = null, selectedPart = -1;
const voxelBrush = { mode: 'add', block: 1 };
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
  if (lastInspected !== j.id) { // new selection: keep long component lists tidy
    lastInspected = j.id; selectedPart = -1;
    closedComps.clear();
    const n = (j.behaviors || []).length + ['shape', 'mesh', 'text', 'sprite', 'body', 'bar', 'model', 'voxels'].filter((k) => j[k]).length;
    if (n > 3) { (j.behaviors || []).forEach((b, i) => closedComps.add('b' + i + b.type)); if (j.body) closedComps.add('body'); }
  }

  box.append(h('div', { class: 'nav-strip' },
    h('button', { class: 'btn back', onclick: () => setDock('hierarchy') }, icon('left'), 'Hierarchy'),
    h('span', { class: 'crumb' }, `${idx + 1} of ${project.entities.length}`),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn', title: 'Previous object', onclick: () => stepSelection(-1) }, icon('left')),
    h('button', { class: 'btn', title: 'Next object', onclick: () => stepSelection(1) }, icon('right'))));
  box.append(h('div', { class: 'nav-strip' }, h('label', { class: 'adv-toggle' },
    h('input', { type: 'checkbox', checked: showAdvanced, onchange: (e) => { showAdvanced = e.target.checked; store.set('pocket.editor.advanced', showAdvanced ? '1' : '0'); renderInspector(); } }), 'Show advanced options')));

  // header: active toggle + name, tag, flags
  box.append(h('div', { class: 'insp-head' },
    h('div', { class: 'big-ico' }, icon(iconFor(j))),
    h('input', { type: 'checkbox', checked: j.visible !== false, title: 'Active', onchange: (e) => { j.visible = e.target.checked; changed({ structure: true }); } }),
    h('input', { type: 'text', value: j.name || '', oninput: (e) => { j.name = e.target.value; changed(); renderHierarchy(); } }),
    h('div', { class: 'sub' },
      h('span', {}, 'Tags'),
      h('input', { type: 'text', value: (j.tags || []).join(', '), placeholder: 'player, enemy', autocapitalize: 'off',
        onchange: (e) => { j.tags = e.target.value.split(',').map((t) => t.trim()).filter(Boolean); changed({ structure: true }); } })),
    showAdvanced && h('div', { class: 'sub' },
      h('label', { title: 'Hidden while playing; Spawner/Shooter make copies' }, h('input', { type: 'checkbox', checked: !!j.template, onchange: (e) => { j.template = e.target.checked; changed({ structure: true }); } }), 'Template'),
      h('label', { title: 'Cannot be picked in the Scene view' }, h('input', { type: 'checkbox', checked: !!j.locked, onchange: (e) => { j.locked = e.target.checked; changed({ structure: true }); } }), 'Locked'),
      !threeD && !j.ui && h('label', {}, 'Layer', h('input', { type: 'number', value: j.layer || 0, style: 'width:54px', oninput: (e) => { j.layer = parseInt(e.target.value, 10) || 0; changed(); } })))));
  if (j.template) box.append(h('p', { class: 'desc', style: 'padding:0 8px;color:var(--dim);font-size:11.5px' }, 'Template: hidden while playing. Spawner and Shooter components create copies of it by name.'));

  // Transform
  box.append(comp(j.ui ? 'Rect Transform' : 'Transform', threeD
    ? [vecRow(T, 'Position', ['x', 'y', 'z'], [0, 0, 0], 0.1), vecRow(T, 'Rotation', ['rx', 'ry', 'rz'], [0, 0, 0], 1), vecRow(T, 'Scale', ['sx', 'sy', 'sz'], [1, 1, 1], 0.05)]
    : [
      vecRow(T, j.ui ? 'Offset' : 'Position', ['x', 'y'], [0, 0], 1), vecRow(T, 'Rotation', ['rz'], [0], 1), vecRow(T, 'Scale', ['sx', 'sy'], [1, 1], 0.05)],
  { icon: 'move', key: 'transform', menu: [{ label: 'Reset', fn: () => { for (const k of ['rx', 'ry', 'rz']) delete j[k]; for (const k of ['sx', 'sy', 'sz']) delete j[k]; changed({ inspector: true }); } }] }));

  if (j.ui) {
    const ANCH = [['top-left', '↖'], ['top', '↑'], ['top-right', '↗'], ['left', '←'], ['center', '•'], ['right', '→'], ['bottom-left', '↙'], ['bottom', '↓'], ['bottom-right', '↘']];
    box.append(comp('UI Element', [
      h('p', { class: 'desc' }, 'UI stays fixed on the screen. Pin it to a corner or edge so it fits every phone.'),
      h('div', { class: 'row' }, h('label', {}, 'Pin to screen'), h('div', { class: 'anchor-grid' }, ANCH.map(([a, ic]) => h('button', {
        class: (j.anchor || 'top-left') === a ? 'on' : '', title: a, onclick: () => { j.anchor = a; changed({ inspector: true }); } }, ic)))),
      C('showWhen', { label: 'Show when', type: 'select', options: [['always', 'Always'], ['play', 'While playing'], ['title', 'Title screen'], ['paused', 'Paused'], ['over', 'Game over'], ['win', 'Win / level complete']], def: 'always' }),
      h('p', { class: 'desc' }, 'Make your own menus: turn on "Custom Screens" in Game Settings, then add Buttons that start, pause or restart the game.'),
    ], { icon: 'hud', key: 'uiel' }));
  }

  const copyItem = (kind, get) => ({ icon: 'copy', label: 'Copy Component', fn: () => { compClipboard = { kind, data: clone(get()) }; toast('Component copied'); } });
  const removeMenu = (fn, kind) => [kind && copyItem(kind, () => j[kind]), { icon: 'trash', label: 'Remove Component', fn }].filter(Boolean);
  if (j.shape) {
    const t = j.shape.type;
    box.append(comp('Shape Renderer', [
      C('shape.type', { label: 'Shape', type: 'select', options: [['emoji', 'Sprite (emoji)'], ['rect', 'Rectangle'], ['circle', 'Circle'], ['ellipse', 'Ellipse'], ['triangle', 'Triangle'], ['star', 'Star'], ['heart', 'Heart'], ['diamond', 'Diamond'], ['hexagon', 'Hexagon'], ['pentagon', 'Pentagon'], ['octagon', 'Octagon'], ['capsule', 'Capsule'], ['ring', 'Ring'], ['arrow', 'Arrow'], ['cloud', 'Cloud']], structure: true }),
      t === 'emoji' && h('div', { class: 'row' }, h('label', {}, 'Sprite'), h('button', { class: 'btn', style: 'font-size:30px', onclick: () => pickEmoji((em) => { j.shape.emoji = em; changed({ inspector: true }); }) }, j.shape.emoji || '⭐', h('span', { style: 'font-size:15px' }, 'Change…'))),
      t === 'circle' || t === 'ring' ? C('shape.r', { label: 'Radius', type: 'number', def: 20 }) : [C('shape.w', { label: 'Width', type: 'number', def: 40 }), C('shape.h', { label: t === 'emoji' ? 'Size' : 'Height', type: 'number', def: 40 })],
      t === 'rect' && C('shape.radius', { label: 'Corner Radius', type: 'number', def: 0 }),
      t !== 'emoji' && C('shape.fill', { label: 'Fill', type: 'color', optional: true }),
      t !== 'emoji' && C('shape.stroke', { label: 'Outline', type: 'color', optional: true }),
      t !== 'emoji' && j.shape.stroke && C('shape.lineWidth', { label: 'Outline Width', type: 'number', def: 2 }),
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
      C('text.font', { label: 'Font', type: 'select', options: [['system-ui, -apple-system, sans-serif', 'Clean'], ['"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif', 'Rounded'], ['Georgia, "Times New Roman", serif', 'Classic'], ['ui-monospace, Menlo, Consolas, monospace', 'Retro (mono)'], ['Impact, "Arial Black", sans-serif', 'Bold poster']], def: 'system-ui, -apple-system, sans-serif' }),
      C('text.weight', { label: 'Weight', type: 'select', options: [['400', 'Normal'], ['600', 'Semi-bold'], ['800', 'Bold'], ['900', 'Black']], def: '800' }),
      C('text.outline', { label: 'Outline', type: 'color', optional: true }),
      j.text.outline && C('text.outlineWidth', { label: 'Outline Width', type: 'number', def: 4 }),
      C('text.shadow', { label: 'Drop Shadow', type: 'bool', def: false }),
    ], { icon: 'text', key: 'text', menu: removeMenu(() => { delete j.text; changed({ structure: true }); }, 'text') }));
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
        h('button', { class: 'btn' + (!j.bar.icon ? ' primary' : ''), style: 'flex:1', onclick: () => { delete j.bar.icon; changed({ inspector: true }); } }, 'Bar'),
        h('button', { class: 'btn' + (j.bar.icon ? ' primary' : ''), style: 'flex:1;font-size:20px', onclick: () => pickEmoji((em) => { j.bar.icon = em; if (j.bar.h < 22) j.bar.h = 28; changed({ inspector: true }); }) }, j.bar.icon || '❤️', h('span', { style: 'font-size:15px' }, 'Icons')))),
      C('bar.max', { label: 'Maximum', type: 'number', def: 100 }),
      showAdvanced && C('bar.maxVar', { label: 'Maximum from variable', type: 'text', def: '' }),
      C('bar.w', { label: 'Width', type: 'number', def: 160 }), C('bar.h', { label: 'Height', type: 'number', def: 16 }),
      C('bar.fill', { label: 'Bar color', type: 'color' }), C('bar.bg', { label: 'Background', type: 'color' }),
      C('bar.radius', { label: 'Roundness', type: 'number', def: 8 }),
      C('bar.label', { label: 'Show numbers', type: 'bool', def: false }),
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
  if (j.light) {
    box.append(comp('Light', [
      h('p', { class: 'desc' }, threeD ? 'A point light: lights up nearby objects (up to 8 at once).' : 'Glows, and cuts through the darkness when Game Settings → Lighting → Darkness is above 0.'),
      C('light.color', { label: 'Color', type: 'color' }),
      C('light.intensity', { label: 'Brightness', type: 'number', def: 1, step: 0.1 }),
      C('light.range', { label: 'Range', type: 'number', def: threeD ? 8 : 160, step: threeD ? 0.5 : 10 }),
      C('light.flicker', { label: 'Flicker (0–1, like a torch)', type: 'number', def: 0, step: 0.1 }),
    ], { icon: 'bulb', key: 'light', menu: removeMenu(() => { delete j.light; changed({ structure: true }); }, 'light') }));
  }
  if (j.body && !j.ui) {
    const shp = j.body.shape || 'auto';
    box.append(comp(threeD ? 'Rigidbody' : 'Rigidbody 2D', [
      C('body.type', { label: 'Body Type', type: 'select', options: [['static', 'Static'], ['dynamic', 'Dynamic'], ['kinematic', 'Kinematic']], def: 'dynamic', structure: true }),
      C('body.sensor', { label: 'Is Trigger', type: 'bool', def: false }),
      h('div', { class: 'row' }, h('label', {}, 'Material'), h('select', { onchange: (e) => { const m = MATERIALS[e.target.value]; if (m) { Object.assign(j.body, m); changed({ inspector: true }); pushHistory(); } } },
        h('option', { value: '' }, materialOf(j.body)), Object.keys(MATERIALS).map((k) => h('option', { value: k }, k)))),
      j.body.type === 'dynamic' && [C('body.gravityScale', { label: 'Gravity Scale', type: 'number', def: 1, step: 0.1 }), C('body.bounce', { label: 'Bounciness', type: 'number', def: 0, step: 0.05 })],
      j.body.type === 'dynamic' && h('div', { class: 'row' }, h('label', {}, 'Freeze'), h('div', { class: 'pair' }, (threeD ? ['X', 'Y', 'Z'] : ['X', 'Y']).map((a) =>
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!j.body['lock' + a], onchange: (e) => { if (e.target.checked) j.body['lock' + a] = true; else delete j.body['lock' + a]; changed(); } }), a)))),
      C('body.ignore', { label: 'Pass through tags', type: 'text', def: '' }),
      C('body.shape', { label: 'Collider', type: 'select', options: [['auto', 'Fit to shape'], ['box', 'Box'], [threeD ? 'sphere' : 'circle', threeD ? 'Sphere' : 'Circle']], def: 'auto', structure: true }),
      shp === 'box' && [C('body.w', { label: 'Size X', type: 'number', def: 1 }), C('body.h', { label: 'Size Y', type: 'number', def: 1 }), threeD && C('body.d', { label: 'Size Z', type: 'number', def: 1 })],
      (shp === 'circle' || shp === 'sphere') && C('body.r', { label: 'Radius', type: 'number', def: 10 }),
      j.body.type !== 'dynamic' && C('body.oneWay', { label: 'One-way platform (jump up through)', type: 'bool', def: false }),
      showAdvanced && vecRow(() => (T().body ||= {}), 'Collider Offset', threeD ? ['ox', 'oy', 'oz'] : ['ox', 'oy'], [0, 0, 0], threeD ? 0.05 : 1),
      showAdvanced && j.body.type === 'dynamic' && [
        C('body.mass', { label: 'Mass (who pushes whom)', type: 'number', def: 1, step: 0.5 }),
        C('body.friction', { label: 'Friction on ground', type: 'number', def: 0, step: 0.1 }),
        C('body.drag', { label: 'Air drag', type: 'number', def: 0, step: 0.1 }),
        C('body.maxFall', { label: 'Max fall speed (0 = none)', type: 'number', def: 0 }),
        C('body.maxSpeed', { label: 'Max speed (0 = none)', type: 'number', def: 0 })],
      showAdvanced && j.body.type !== 'dynamic' && C('body.friction', { label: 'Surface friction', type: 'number', def: 0, step: 0.1 }),
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
    box.append(comp(def.label, def.params.filter((p) => showAdvanced || !p.advanced).map((p) => C(`behaviors.${i}.${p.key}`, { ...p, def: paramDefault(p, threeD) })), {
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
    h('p', { class: 'desc' }, threeD ? 'Gravity is in Physics below: about -25 is normal.' : 'Gravity is in Physics below: 0 for top-down games, about 1600 for platformers.'),
    !threeD && vecRow(() => (project.view ||= { width: 400, height: 700 }), 'Screen Size', ['width', 'height'], [400, 700], 10),
  ], { icon: 'sun', key: 's-env' }));
  box.append(comp('Physics', [
    C('gravity', { label: threeD ? 'Gravity Y (down is −)' : 'Gravity Y (down is +)', type: 'number', def: threeD ? -25 : 0, step: threeD ? 1 : 50 }),
    C('gravityX', { label: 'Gravity X (sideways)', type: 'number', def: 0, step: threeD ? 1 : 50 }),
    threeD && C('gravityZ', { label: 'Gravity Z', type: 'number', def: 0, step: 1 }),
    h('p', { class: 'desc' }, 'Fast objects are checked in small steps so they never pass through walls. Rotated 2D boxes collide at their angle. Use Rigidbody → Material for ice, rubber or sticky surfaces, and a Force Zone for wind, water or magnets.'),
  ], { icon: 'body', key: 's-phys' }));
  box.append(comp('Lighting', threeD ? [
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
  ], { icon: 'save', key: 's-save' }));
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
    C('settings.joystickMode', { label: 'Joystick Style', type: 'select', options: [['floating', 'Appears where you touch'], ['fixed', 'Fixed in the corner']], def: 'floating' }),
    C('settings.controlsOpacity', { label: 'Controls Opacity (0.2–1)', type: 'number', def: 1, step: 0.1 }),
    C('settings.jumpLabel', { label: 'Jump Button Text', type: 'text', def: 'JUMP' }),
    C('settings.actionLabel', { label: 'Fire Button Text', type: 'text', def: 'FIRE' }),
    C('settings.joystickSide', { label: 'Joystick Side', type: 'select', options: [['left', 'Left (buttons on right)'], ['right', 'Right (left-handed)']], def: 'left' }),
    C('settings.controlSize', { label: 'Control Size', type: 'select', options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], def: 'medium' }),
    h('p', { class: 'desc' }, 'On a keyboard: arrows/WASD move, Space jumps, E fires.'),
  ], { icon: 'gamepad', key: 's-touch' }));
  box.append(comp('Mobile', [
    C('settings.orientation', { label: 'Screen Orientation', type: 'select', options: [['any', 'Any'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], def: 'any' }),
    h('p', { class: 'desc' }, 'Players holding the phone the wrong way see a "turn your device" screen.'),
    C('settings.fullscreen', { label: 'Go Fullscreen on First Tap', type: 'bool', def: false }),
    C('settings.shareButton', { label: 'Share Score Button', type: 'bool', def: true }),
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
  float: ['Effects', 'arrow'], message: ['Gameplay', 'sign'], teleport: ['Gameplay', 'portal'],
  unlock: ['Gameplay', 'door'], sound: ['Audio', 'bolt'],
  tappable: ['Touch', 'hand'], draggable: ['Touch', 'move'], swipeMove: ['Touch', 'arrow'],
  orbit: ['Movement', 'rotate'], pulse: ['Effects', 'circle'], checkpoint: ['Gameplay', 'flag'], destructible: ['Combat', 'bolt'],
  firstPerson: ['Controllers', 'crosshair'], thirdPerson: ['Controllers', 'player'], car: ['Controllers', 'car'],
  projectile: ['Combat', 'arrow'], income: ['Clicker', 'coin'], upgrade: ['Clicker', 'plus'],
  follow: ['AI', 'player'], wander: ['AI', 'ghost'], path: ['Movement', 'arrow'], turret: ['Combat', 'crosshair'],
  bounce: ['Movement', 'circle'], trigger: ['Logic', 'bolt'], timer: ['Logic', 'clock'], dropItem: ['Gameplay', 'coin'],
  emitter: ['Effects', 'star'], blink: ['Effects', 'eye'], chase: ['AI', 'ghost'],
  gridMove: ['Turn-Based', 'move'], gridEnemy: ['Turn-Based', 'enemy'], boardCell: ['Turn-Based', 'grid'],
  turnAction: ['Turn-Based', 'hand'], turnOpponent: ['Turn-Based', 'ghost'], condition: ['Logic', 'bolt'],
  voxelBuilder: ['Voxel', 'cube'], button: ['UI', 'hand'], rules: ['Logic', 'bolt'], graph: ['Logic', 'nodes'], camera: ['Camera', 'camera'], forceZone: ['Physics', 'arrow'], savePoint: ['Saving', 'save'],
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
    { cat: 'Rendering', key: 'model', label: '3D Model', icon: 'cube', desc: 'Build a model out of shapes (3D modeling)', ok: (e) => threeD && !e.model && !e.ui, add: (e) => { e.model = { parts: [{ geometry: 'box', x: 0, y: 0.5, z: 0, w: 1, h: 1, d: 1, color: '#90caf9' }] }; } },
    { cat: 'UI', key: 'bar', label: 'Progress Bar', icon: 'hud', desc: 'Health, energy or progress shown as a bar', ok: (e) => !e.bar && (e.ui || !threeD), add: (e) => { e.bar = { var: 'hp', max: 100, w: 160, h: 16, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 8 }; } },
    { cat: 'Voxel', key: 'voxels', label: 'Voxel World', icon: 'cube', desc: 'Minecraft-style block terrain you can build on', ok: (e) => threeD && !e.voxels && !e.ui, add: (e) => { e.voxels = { size: 1, gen: { type: 'hills', w: 24, d: 24, h: 5, seed: 1, trees: true }, edits: {} }; } },
    { cat: 'Rendering', key: 'light', label: 'Light', icon: 'bulb', desc: threeD ? 'A point light that lights up nearby objects' : 'A glow that cuts through darkness', ok: (e) => !e.light && !e.ui, add: (e) => { e.light = threeD ? { color: '#ffd9a0', intensity: 1.5, range: 8 } : { color: '#ffd9a0', intensity: 1, range: 160 }; } },
    { cat: 'Physics', key: 'body', label: threeD ? 'Rigidbody' : 'Rigidbody 2D', icon: 'body', desc: 'Collide, fall and stand on things', ok: (e) => !e.ui && !e.body, add: (e) => { e.body = { type: 'dynamic' }; } },
  ];
  for (const [type, def] of Object.entries(Behaviors)) {
    list.push({ cat: BEH_META[type]?.[0] || 'Other', key: 'b:' + type, label: def.label, icon: BEH_META[type]?.[1] || 'bolt', desc: def.description,
      ok: (e) => !e.ui || ['script', 'graph', 'rules', 'button'].includes(type), add: (e) => { (e.behaviors ||= []).push(defaultBehavior(type, threeD)); if (type === 'move' || type === 'platformer') e.tags = [...new Set([...(e.tags || []), 'player'])]; } });
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
  { icon: 'move', label: 'Grid Hero', props: { name: 'Hero', tags: ['player'], shape: { type: 'circle', r: 15, fill: '#4fc3f7' }, behaviors: [{ type: 'gridMove', tile: 40, tapToMove: true, damage: 1 }] }, settings: { turnBased: true } },
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
  { icon: 'save', label: 'Save Point', props: { name: 'Save Point', shape: { type: 'emoji', emoji: '💾', w: 40, h: 40 }, behaviors: [{ type: 'savePoint', slot: 1, text: 'Game saved', tag: 'player' }, { type: 'float', amount: 6, period: 1.6 }] } },
  { icon: 'bulb', label: 'Torch', props: { name: 'Torch', shape: { type: 'emoji', emoji: '🔥', w: 36, h: 36 }, light: { color: '#ffb056', intensity: 1, range: 180, flicker: 0.5 } }, scene: { light: { darkness: 0.85 } } },
  { icon: 'rotate', label: 'Spinning Bar', props: { name: 'Spinning Bar', shape: { type: 'rect', w: 160, h: 16, radius: 8, fill: '#e53935' }, body: { type: 'kinematic' }, behaviors: [{ type: 'rotate', speed: 90 }, { type: 'hazard', action: 'damage' }] } },
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
  { icon: 'cube', label: 'Block Builder', props: { name: 'Builder', tags: ['player'], y: 10, mesh: { geometry: 'box', w: 0.6, h: 1.7, d: 0.6, color: '#4f8ef7' }, behaviors: [{ type: 'firstPerson', speed: 5, look: 0.25, eye: 0.65, jump: 8.5 }, { type: 'voxelBuilder', reach: 6, block: 3, mode: 'break' }] },
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
  { icon: 'star', label: 'Sprite', props: { name: 'Sprite', shape: { type: 'emoji', emoji: '🐱', w: 56, h: 56 } } },
  { icon: 'text', label: 'Text', props: { name: 'Text', text: { value: 'Hello', size: 32, color: '#ffffff' } } },
  { icon: 'hud', label: 'UI Text', props: { name: 'UI Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } } },
  { icon: 'image', label: 'Image', props: { name: 'Image', sprite: { src: '', w: 80, h: 80 } }, pickImage: true },
  { icon: 'camera', label: 'Camera', props: { name: 'Camera', behaviors: [{ type: 'camera', mode: 'follow', target: 'player', smooth: 6, zoom: 1, fov: 60, ox: 0, oy: 0, oz: 0, lookAhead: 0, deadZone: 0, bounds: 'none', priority: 0 }] } },
  { icon: 'bulb', label: 'Light', props: { name: 'Light', light: { color: '#ffd9a0', intensity: 1, range: 160 } } },
];
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
  { icon: 'bulb', label: 'Lamp', props: { name: 'Lamp', model: { parts: [{ geometry: 'cylinder', x: 0, y: 1, z: 0, r: 0.06, h: 2, color: '#455a64' }, { geometry: 'sphere', x: 0, y: 2.1, z: 0, r: 0.22, color: '#fff3c4', emissive: 1 }] }, light: { color: '#ffd9a0', intensity: 1.6, range: 7 } } },
];

let projectTab = 'prefabs';
function renderProject() {
  const box = $('#project');
  box.replaceChildren();
  const tabs = [['prefabs', 'Prefabs', 'folder'], ['objects', 'Objects', 'folder'], is3D() ? ['models', 'Models', 'cube'] : ['sprites', 'Sprites', 'star'], ['ui', 'UI', 'hud'], ['components', 'Components', 'folder']];
  if (!tabs.some((t) => t[0] === projectTab)) projectTab = 'prefabs';
  box.append(h('div', { class: 'p-tabs' }, tabs.map(([k, l, ic]) => h('button', { class: projectTab === k ? 'active' : '', onclick: () => { projectTab = k; renderProject(); } }, icon(ic), l))));
  box.append(h('div', { class: 'p-path' }, `Assets › ${tabs.find((t) => t[0] === projectTab)[1]}`));
  let items;
  if (projectTab === 'components') {
    items = componentsFor(null).filter((c) => c.ok({})).map((c) => ({ icon: c.icon, label: c.label, payload: { kind: 'component', key: c.key, label: c.label, icon: c.icon }, comp: true }));
  } else {
    const src = projectTab === 'prefabs' ? (is3D() ? PREFABS_3D : PREFABS_2D)
      : projectTab === 'models' ? MODELS_3D.map((m) => ({ icon: m.icon, label: m.label, props: { name: m.label, y: 0, model: { parts: clone(m.parts) } } }))
        : projectTab === 'sprites' ? Object.entries(EMOJI).flatMap(([cat, list]) => { const one = { Characters: 'Character', Enemies: 'Enemy', Items: 'Item', Vehicles: 'Vehicle', Places: 'Prop' }[cat] || cat; return list.map((em) => ({ emoji: em, label: one, props: { name: one, shape: { type: 'emoji', emoji: em, w: 56, h: 56 } } })); })
          : projectTab === 'ui' ? UI_WIDGETS : (is3D() ? OBJECTS_3D : OBJECTS_2D);
    items = src.map((o) => ({ icon: o.icon, emoji: o.emoji, label: o.label, payload: { kind: 'prefab', def: o, label: o.emoji ? `${o.emoji} ${o.label}` : o.label, icon: o.icon || 'star' } }));
  }
  box.append(h('div', { class: 'tiles' }, items.map((it) => {
    const t = h('div', { class: 'tile' + (it.comp ? ' comp-tile' : '') }, it.emoji ? h('div', { class: 'th emo' }, it.emoji) : h('div', { class: 'th' }, icon(it.icon)), h('div', { class: 'lb' }, it.label));
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
    if (def.scene.light && !(project.light?.darkness > 0)) project.light = { ...(project.light || {}), ...def.scene.light };
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
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, window.innerWidth - mw - 8), y = r.bottom + 2;
  if (y + mh > window.innerHeight - 8) y = Math.max(8, r.top - mh - 2);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
}
function openDialog(title, kids) {
  const d = h('div', { class: 'dialog' }, h('div', { class: 'dh' }, h('span', {}, title), h('button', { onclick: closeLayer, title: 'Close' }, icon('close'))), h('div', { class: 'db' }, kids));
  layer.replaceChildren(d); layer.className = 'dim'; layer.hidden = false;
  pushBack(layerBack);
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
  $('.toast')?.remove();
  const home = $('#home'), all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  const cur = root && all.find(([id]) => id === projectId);
  home.replaceChildren(...[
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
  ].flat().filter(Boolean)); // DOM nodes only: nested arrays or false would render as text
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
  for (const lv of [json, ...(json.levels || [])]) lv.settings = { ...lv.settings, pauseButton: false, muteButton: false, fullscreen: false, orientation: 'any', saveProgress: false, loadOnStart: false };
  try {
    engine.start(json, { level: levelIdx });
    if (engine.scene.state === 'title') engine.scene.state = 'play';
  } catch (err) { console.error(err); toast('Error: ' + err.message); stop(); return; }
  updatePauseButtons();
  pushBack(stop);
  store.set('pocket.editor.played.' + projectId, '1');
  requestAnimationFrame(() => { engine.resize(); engine.layoutButtons(); });
}
function stop() {
  if (!playing) return;
  playing = false;
  dropBack(stop);
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
  renderHierarchy();
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
$('#addFab').append(icon('plus'));
for (const [z, ic] of [['out', 'minus'], ['in', 'plus'], ['reset', 'frame']]) {
  const b = $(`#zoomBar [data-zoom="${z}"]`);
  b.append(icon(ic));
  b.addEventListener('click', () => {
    if (z === 'reset') { resetCamera(); applyCamera(); return; }
    const k = z === 'in' ? 1.35 : 1 / 1.35;
    if (is3D()) orbit.dist = Math.min(300, Math.max(2, orbit.dist / k)); else cam2d.zoom = Math.min(8, Math.max(0.08, cam2d.zoom * k));
    applyCamera(); buzz(4);
  });
}
// stop the browser from zooming the whole page (pinch or double tap); pinch inside the Scene zooms the view instead
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && !e.target.closest('canvas')) e.preventDefault(); }, { passive: false });
$('#uiBtn').addEventListener('click', () => {
  uiMode = !uiMode;
  $('#uiBtn').classList.toggle('on', uiMode);
  if (uiMode) { projectTab = 'ui'; renderProject(); toast('UI mode: only screen UI can be selected. Add widgets from Project → UI.'); }
});
engine.screenFilter = (e) => uiMode || e.id === selectedId; // title / pause / game-over UI shows in UI mode or when selected
engine.onBeforeUI = (ctx) => { if (uiMode && !playing) { ctx.fillStyle = 'rgba(10,10,20,0.55)'; ctx.fillRect(0, 0, engine.width, engine.height); } };
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
$('#app').dataset.sheet = 'peek'; // big Scene first; tap a tab (or swipe up) to open the panel
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
