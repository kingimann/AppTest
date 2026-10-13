// Pocket Editor: a touch-first visual editor for Pocket Engine games.
// The project is plain scene JSON (see examples/templates.js), the same thing Engine.start() plays.
import { Engine, Scene, Behaviors, paramDefault, uid, anchorPoint, VERSION } from '../engine/pocket.js';
import { templates, templateInfo } from '../examples/templates.js';

const $ = (s, el = document) => el.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

/** Tiny DOM builder: h('div', {class: 'x', onclick}, child, 'text') */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2200);
}

// ============================================================================
// Projects (saved in localStorage)
// ============================================================================
const PROJECTS_KEY = 'pocket.editor.projects', CURRENT_KEY = 'pocket.editor.current';
const loadProjects = () => { try { return JSON.parse(store.get(PROJECTS_KEY, '{}')) || {}; } catch { return {}; } };

let project = null, projectId = null, selectedId = null;
let history = [], hIndex = -1;
let snap = store.get('pocket.editor.snap', '1') === '1';
let playing = false;

function saveNow() {
  if (!project) return;
  const all = loadProjects();
  all[projectId] = { name: project.name, updated: Date.now(), json: project };
  if (!store.set(PROJECTS_KEY, JSON.stringify(all))) toast('Could not save — storage full?');
  store.set(CURRENT_KEY, projectId);
}
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); };

function openProject(json, id = uid('p')) {
  project = json;
  project.entities ||= [];
  project.settings ||= {};
  project.vars ||= { score: 0 };
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
  json.name = name || (key.startsWith('empty') ? 'My Game' : json.name);
  for (const e of json.entities) e.id ||= uid();
  openProject(json);
}

// ============================================================================
// History
// ============================================================================
function pushHistory() {
  const snapStr = JSON.stringify(project);
  if (history[hIndex] === snapStr) return;
  history = history.slice(0, hIndex + 1);
  history.push(snapStr);
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
  project = JSON.parse(history[i]);
  if (!ent(selectedId)) selectedId = null;
  rebuild(); refreshAll(); saveSoon(); updateUndoButtons();
}
function updateUndoButtons() { $('#undoBtn').disabled = hIndex <= 0; $('#redoBtn').disabled = hIndex >= history.length - 1; }

/** Call after any edit to the project. */
function changed({ structure = false, inspector = false } = {}) {
  requestRebuild();
  saveSoon();
  pushHistorySoon();
  if (structure) { renderObjects(); renderInspector(); }
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
  if (!project) return;
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
  const s = Scene.fromJSON(project, { editing: true });
  engine.setScene(s);
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

// ---- overlays: grid, selection, invisible "logic" objects ----
engine.drawGrid = (ctx, s, z) => {
  const v = s.viewBounds(), step = z < 0.4 ? 100 : 50;
  ctx.lineWidth = 1 / z; ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  for (let x = Math.floor(v.left / step) * step; x < v.right; x += step) { ctx.moveTo(x, v.top); ctx.lineTo(x, v.bottom); }
  for (let y = Math.floor(v.top / step) * step; y < v.bottom; y += step) { ctx.moveTo(v.left, y); ctx.lineTo(v.right, y); }
  ctx.stroke();
  ctx.setLineDash([8 / z, 6 / z]); ctx.strokeStyle = 'rgba(51,240,255,0.5)'; ctx.lineWidth = 2 / z;
  ctx.strokeRect(0, 0, s.view.width, s.view.height);
  ctx.setLineDash([]);
};

const GRID3D = (() => { const p = []; for (let i = -30; i <= 30; i++) p.push(i, 0.01, -30, i, 0.01, 30, -30, 0.01, i, 30, 0.01, i); return p; })();

engine.onRenderWorld = (r, s, z) => {
  if (playing) return;
  const sel = s.byId(selectedId);
  if (s.mode === '2d') {
    if (!sel || sel.ui) return;
    const ctx = r, b = boundsOf(sel);
    ctx.strokeStyle = '#33f0ff'; ctx.lineWidth = 2 / z; ctx.setLineDash([6 / z, 4 / z]);
    ctx.strokeRect(b.x - b.hx - 4 / z, b.y - b.hy - 4 / z, b.hx * 2 + 8 / z, b.hy * 2 + 8 / z);
    ctx.setLineDash([]);
  } else {
    r.drawLines(GRID3D, '#ffffff', 0.18);
    r.drawLines([-30, 0.02, 0, 30, 0.02, 0], '#ff5d5d', 0.6);
    r.drawLines([0, 0.02, -30, 0, 0.02, 30], '#5d8bff', 0.6);
    if (sel && !sel.ui && sel.mesh) {
      const ex = sel.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy, hz = ex.sphere ? ex.r : ex.hz;
      const c = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => [sel.x + a * hx * 1.05, sel.y + b * hy * 1.05, sel.z + d * hz * 1.05]);
      const pts = [];
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[i], ...c[j]);
      const gl = r.gl; gl.disable(gl.DEPTH_TEST); r.drawLines(pts, '#33f0ff'); gl.enable(gl.DEPTH_TEST);
    }
  }
};

engine.onRenderUI = (ctx, s) => {
  if (playing) return;
  ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of s.entities) {
    if (e.ui || hasVisual(e)) continue;
    const p = toScreen(e);
    if (!p) continue;
    const isSel = e.id === selectedId;
    ctx.fillStyle = isSel ? 'rgba(51,240,255,0.3)' : 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = isSel ? '#33f0ff' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.fillText('⚙', p.x, p.y + 1);
    ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(e.name, p.x, p.y + 28);
  }
  const sel = s.byId(selectedId);
  if (sel?.ui) {
    const b = uiBounds(sel);
    ctx.strokeStyle = '#33f0ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.x - b.hx - 4, b.y - b.hy - 4, b.hx * 2 + 8, b.hy * 2 + 8); ctx.setLineDash([]);
  }
};

function toScreen(e) {
  const s = engine.scene;
  if (s.mode === '2d') return engine.renderer.worldToScreen(s, e.x, e.y);
  const p = engine.renderer.worldToScreen(s, e.x, e.y, e.z);
  return p.behind ? null : p;
}
/** World-space center & half-size of an entity, adjusted for text alignment. */
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

// ---- picking ----
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
    if (p && Math.hypot(sx - p.x, sy - p.y) < 22) return e;
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

// ---- gestures: tap to select, drag to move, drag empty space to pan/orbit, pinch to zoom ----
const surface = engine.uiCanvas;
const ptrs = new Map();
let gesture = null;
const snapV = (v, step) => (snap ? Math.round(v / step) * step : round(v, 2));

surface.addEventListener('pointerdown', (ev) => {
  if (playing) return;
  surface.setPointerCapture(ev.pointerId);
  const r = surface.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  ptrs.set(ev.pointerId, { x, y });
  $('#hint').hidden = true;
  if (ptrs.size === 1) {
    const hit = ev.button === 2 || ev.shiftKey ? null : pick(x, y);
    if (hit) {
      select(hit.id, { fromViewport: true });
      const j = ent(hit.id);
      gesture = { type: 'move', id: hit.id, sx: x, sy: y, orig: { x: j.x || 0, y: j.y || 0, z: j.z || 0 }, ui: !!j.ui, moved: false };
      if (is3D() && !j.ui) {
        const p = rayPlaneY(engine.renderer.screenRay(engine.scene, x, y), gesture.orig.y);
        gesture.grab = p ? { x: p.x - gesture.orig.x, z: p.z - gesture.orig.z } : { x: 0, z: 0 };
      }
    } else {
      gesture = { type: ev.button === 2 || ev.shiftKey ? 'pan' : is3D() ? 'orbit' : 'pan', lx: x, ly: y, sx: x, sy: y, moved: false };
    }
  } else if (ptrs.size === 2) {
    if (gesture?.type === 'move' && gesture.moved) pushHistory();
    const [a, b] = [...ptrs.values()];
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom0: cam2d.zoom, dist0: orbit.dist };
  }
});
surface.addEventListener('contextmenu', (e) => e.preventDefault());

surface.addEventListener('pointermove', (ev) => {
  const p = ptrs.get(ev.pointerId);
  if (!p || !gesture || playing) return;
  const r = surface.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  p.x = x; p.y = y;
  const s = engine.scene;
  if (gesture.type === 'move') {
    const dx = x - gesture.sx, dy = y - gesture.sy;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    gesture.moved = true;
    const j = ent(gesture.id), live = s.byId(gesture.id);
    if (!j) return;
    if (gesture.ui) { j.x = Math.round(gesture.orig.x + dx); j.y = Math.round(gesture.orig.y + dy); }
    else if (!is3D()) {
      const z = engine.renderer.zoomFor(s);
      j.x = snapV(gesture.orig.x + dx / z, 10); j.y = snapV(gesture.orig.y + dy / z, 10);
    } else {
      const hit = rayPlaneY(engine.renderer.screenRay(s, x, y), gesture.orig.y);
      if (hit) { j.x = snapV(hit.x - gesture.grab.x, 0.5); j.z = snapV(hit.z - gesture.grab.z, 0.5); }
    }
    if (live) { live.x = j.x; live.y = j.y; live.z = j.z || 0; }
    syncTransformInputs();
  } else if (gesture.type === 'pan' || gesture.type === 'orbit') {
    const dx = x - gesture.lx, dy = y - gesture.ly;
    gesture.lx = x; gesture.ly = y;
    if (Math.hypot(x - gesture.sx, y - gesture.sy) > 5) gesture.moved = true;
    if (!is3D()) { const z = engine.renderer.zoomFor(s); cam2d.x -= dx / z; cam2d.y -= dy / z; }
    else if (gesture.type === 'orbit') { orbit.yaw -= dx * 0.008; orbit.pitch = Math.min(1.5, Math.max(0.05, orbit.pitch + dy * 0.008)); }
    else panOrbit(dx, dy);
    applyCamera();
  } else if (gesture.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const k = Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (!is3D()) {
      const before = engine.renderer.screenToWorld(s, gesture.mx, gesture.my);
      cam2d.zoom = Math.min(8, Math.max(0.08, gesture.zoom0 * k));
      applyCamera();
      const after = engine.renderer.screenToWorld(s, mx, my);
      cam2d.x += before.x - after.x; cam2d.y += before.y - after.y;
      gesture.mx = mx; gesture.my = my; gesture.zoom0 = cam2d.zoom; gesture.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    } else {
      orbit.dist = Math.min(300, Math.max(2, gesture.dist0 / k));
      panOrbit(mx - gesture.mx, my - gesture.my);
      gesture.mx = mx; gesture.my = my;
    }
    applyCamera();
  }
});

function panOrbit(dx, dy) {
  const k = orbit.dist * 0.0022, sy = Math.sin(orbit.yaw), cy = Math.cos(orbit.yaw);
  orbit.target.x -= (cy * dx + sy * dy) * k;
  orbit.target.z -= (-sy * dx + cy * dy) * k;
}

const endPointer = (ev) => {
  if (!ptrs.has(ev.pointerId)) return;
  ptrs.delete(ev.pointerId);
  if (!gesture) return;
  if (gesture.type === 'move' && gesture.moved) { pushHistory(); saveSoon(); }
  if ((gesture.type === 'pan' || gesture.type === 'orbit') && !gesture.moved) select(null);
  if (ptrs.size === 0 || gesture.type === 'pinch') gesture = null;
};
surface.addEventListener('pointerup', endPointer);
surface.addEventListener('pointercancel', endPointer);
surface.addEventListener('wheel', (ev) => {
  if (playing) return;
  ev.preventDefault();
  const k = Math.exp(-ev.deltaY * 0.0015);
  if (is3D()) orbit.dist = Math.min(300, Math.max(2, orbit.dist / k));
  else {
    const r = surface.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, s = engine.scene;
    const before = engine.renderer.screenToWorld(s, x, y);
    cam2d.zoom = Math.min(8, Math.max(0.08, cam2d.zoom * k)); applyCamera();
    const after = engine.renderer.screenToWorld(s, x, y);
    cam2d.x += before.x - after.x; cam2d.y += before.y - after.y;
  }
  applyCamera();
}, { passive: false });

window.addEventListener('keydown', (ev) => {
  if (playing) { if (ev.key === 'Escape') stop(); return; }
  if (/input|textarea|select/i.test(ev.target.tagName)) return;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undoRedo(ev.shiftKey ? 1 : -1); }
  else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); undoRedo(1); }
  else if ((ev.key === 'Delete' || ev.key === 'Backspace') && selectedId) deleteEntity(selectedId);
  else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd' && selectedId) { ev.preventDefault(); duplicateEntity(selectedId); }
});

// ============================================================================
// Selection & panel
// ============================================================================
function select(id, { fromViewport = false } = {}) {
  selectedId = id && ent(id) ? id : null;
  renderObjects();
  renderInspector();
  if (selectedId && (fromViewport || currentTab === 'objects')) setTab('inspector');
}

let currentTab = 'objects';
function setTab(t) {
  currentTab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === t);
  for (const el of document.querySelectorAll('.tab')) el.classList.toggle('active', el.id === 'tab-' + t);
  if ($('#panel').classList.contains('min')) setPanel('half');
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

function setPanel(size) { const p = $('#panel'); p.classList.remove('min', 'half', 'full'); p.classList.add(size); }
{
  const handle = $('#panelHandle'); let startY = null, moved = false;
  handle.addEventListener('pointerdown', (e) => { startY = e.clientY; moved = false; handle.setPointerCapture(e.pointerId); });
  handle.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    const dy = e.clientY - startY, order = ['min', 'half', 'full'], p = $('#panel');
    const cur = order.findIndex((c) => p.classList.contains(c));
    if (Math.abs(dy) > 40) { setPanel(order[Math.max(0, Math.min(2, cur + (dy < 0 ? 1 : -1)))]); startY = e.clientY; moved = true; }
  });
  handle.addEventListener('pointerup', () => {
    if (!moved) { const p = $('#panel'); setPanel(p.classList.contains('min') ? 'half' : p.classList.contains('half') ? 'full' : 'min'); }
    startY = null;
  });
}

function refreshAll() {
  $('#projectName').textContent = project.name || 'Untitled';
  renderObjects(); renderInspector(); renderScene(); updateUndoButtons();
}

// ---- objects list ----
const ICONS = { rect: '■', circle: '●', triangle: '▲', star: '★', polygon: '⬟', box: '◼', sphere: '●', cylinder: '▮', cone: '▲', plane: '▬' };
function iconFor(e) {
  if (e.mesh) return { ic: ICONS[e.mesh.geometry] || '◼', color: e.mesh.color };
  if (e.shape) return { ic: ICONS[e.shape.type] || '■', color: e.shape.fill || e.shape.stroke };
  if (e.text) return { ic: 'T', color: '' };
  if (e.sprite) return { ic: '🖼', color: '' };
  return { ic: '⚙', color: '' };
}
function renderObjects() {
  const root = $('#tab-objects');
  root.replaceChildren();
  if (!project.entities.length) { root.append(h('div', { class: 'empty' }, 'No objects yet. Tap + to add one.')); return; }
  for (const e of project.entities) {
    const { ic, color } = iconFor(e);
    root.append(h('div', { class: 'obj' + (e.id === selectedId ? ' sel' : ''), onclick: () => select(e.id) },
      h('span', { class: 'sw', style: color ? `background:${color};color:#0b0b1a` : '' }, ic),
      h('span', { class: 'nm' }, e.name || 'Object'),
      (e.tags || []).includes('player') && h('span', { class: 'badge player' }, 'player'),
      e.template && h('span', { class: 'badge tpl' }, 'template'),
      e.ui && h('span', { class: 'badge' }, 'HUD'),
      e.locked && h('span', { class: 'badge' }, '🔒'),
    ));
  }
}

// ============================================================================
// Inspector: forms generated from field specs
// ============================================================================
const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (const k of ks.slice(0, -1)) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }
  if (v === undefined) delete a[ks.at(-1)]; else a[ks.at(-1)] = v;
}

/**
 * Build an input bound to target()[path].
 * spec: { type, label, options, def, structure, step, min, max, help }
 */
function control(target, path, spec) {
  const get = () => { const v = getPath(target(), path); return v === undefined ? spec.def : v; };
  const set = (v) => {
    setPath(target(), path, v);
    if (path === 'name' && target() === project) $('#projectName').textContent = v;
    changed({ structure: spec.structure || path === 'name' || path === 'tags' || path === 'template' || path === 'ui' });
  };
  const val = get();
  let el;
  switch (spec.type) {
    case 'number':
      el = h('input', { type: 'number', inputMode: 'decimal', step: spec.step ?? 'any', value: val ?? '', 'data-path': path,
        oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) set(n); } });
      break;
    case 'bool':
      el = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => set(e.target.checked) });
      break;
    case 'select':
      el = h('select', { onchange: (e) => set(e.target.value) },
        spec.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: v === val }, l); }));
      break;
    case 'color': {
      const hex = /^#[0-9a-f]{6}$/i.test(val || '') ? val : /^#[0-9a-f]{3}$/i.test(val || '') ? '#' + val.slice(1).split('').map((c) => c + c).join('') : '#ffffff';
      if (spec.optional) {
        const cb = h('input', { type: 'checkbox', checked: !!val, onchange: (e) => { set(e.target.checked ? col.value : ''); } });
        const col = h('input', { type: 'color', value: hex, oninput: (e) => { cb.checked = true; set(e.target.value); } });
        el = h('div', { class: 'pair' }, cb, col);
      } else el = h('input', { type: 'color', value: hex, oninput: (e) => set(e.target.value) });
      break;
    }
    case 'range': {
      const [a, b] = Array.isArray(val) ? val : [val ?? 0, val ?? 0];
      const mk = (v) => h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: v, oninput: upd });
      const lo = mk(a), hi = mk(b);
      function upd() {
        const x = parseFloat(lo.value), y = parseFloat(hi.value);
        if (Number.isNaN(x)) return;
        set(Number.isNaN(y) || x === y ? x : [Math.min(x, y), Math.max(x, y)]);
      }
      el = h('div', { class: 'pair' }, lo, h('span', {}, 'to'), hi);
      break;
    }
    case 'code':
      el = h('textarea', { spellcheck: false, autocapitalize: 'off', value: val ?? '', oninput: (e) => set(e.target.value) });
      break;
    case 'tags':
      el = h('input', { type: 'text', value: (val || []).join(', '), placeholder: 'player, enemy…', autocapitalize: 'off',
        onchange: (e) => set(e.target.value.split(',').map((t) => t.trim()).filter(Boolean)) });
      break;
    case 'json':
      el = h('textarea', { spellcheck: false, value: JSON.stringify(val ?? {}, null, 1), style: 'min-height:70px',
        oninput: (e) => { try { set(JSON.parse(e.target.value)); e.target.style.borderColor = ''; } catch { e.target.style.borderColor = '#ff5d8f'; } } });
      break;
    case 'template': {
      const names = project.entities.filter((e) => e.template).map((e) => e.name);
      el = h('select', { onchange: (e) => set(e.target.value) },
        h('option', { value: '' }, names.length ? '— choose —' : 'No templates yet'),
        names.map((n) => h('option', { value: n, selected: n === val }, n)));
      break;
    }
    default:
      el = h('input', { type: 'text', value: val ?? '', autocapitalize: 'off', oninput: (e) => set(e.target.value) });
  }
  return h('div', { class: 'row' + (spec.type === 'code' || spec.type === 'json' ? ' full' : '') }, h('label', {}, spec.label), el);
}

function section(title, kids, { onRemove, desc } = {}) {
  return h('div', { class: 'sec' },
    h('h4', {}, h('span', { class: 'sp' }, title), onRemove && h('button', { onclick: onRemove, 'aria-label': 'Remove' }, '✕')),
    h('div', { class: 'body' }, desc && h('p', { class: 'desc' }, desc), kids));
}

function syncTransformInputs() {
  const j = ent(selectedId); if (!j) return;
  for (const k of ['x', 'y', 'z']) { const el = document.querySelector(`#tab-inspector input[data-path="${k}"]`); if (el && document.activeElement !== el) el.value = j[k] ?? 0; }
}

function renderInspector() {
  const root = $('#tab-inspector');
  root.replaceChildren();
  const j = ent(selectedId);
  if (!j) { root.append(h('div', { class: 'empty' }, 'Select an object in the scene or the Objects list.')); return; }
  const T = () => ent(selectedId) || {};
  const C = (path, spec) => control(T, path, spec);
  const threeD = is3D() && !j.ui;

  root.append(section('Object', [
    C('name', { label: 'Name', type: 'text' }),
    C('tags', { label: 'Tags', type: 'tags' }),
    C('template', { label: 'Template', type: 'bool', def: false }),
    j.template && h('p', { class: 'desc' }, 'Templates are hidden while playing. Spawner and Shooter behaviors create copies of them by name.'),
    C('visible', { label: 'Visible', type: 'bool', def: true }),
    C('locked', { label: 'Lock in editor', type: 'bool', def: false }),
    j.ui && C('anchor', { label: 'Screen anchor', type: 'select', options: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'], def: 'top-left' }),
    !threeD && !j.ui && C('layer', { label: 'Layer (draw order)', type: 'number', def: 0, step: 1, structure: false }),
  ]));

  const tr = threeD
    ? [C('x', { label: 'X', type: 'number', def: 0 }), C('y', { label: 'Y (up)', type: 'number', def: 0 }), C('z', { label: 'Z', type: 'number', def: 0 }),
      C('rx', { label: 'Rotate X°', type: 'number', def: 0 }), C('ry', { label: 'Rotate Y°', type: 'number', def: 0 }), C('rz', { label: 'Rotate Z°', type: 'number', def: 0 }),
      C('sx', { label: 'Scale X', type: 'number', def: 1 }), C('sy', { label: 'Scale Y', type: 'number', def: 1 }), C('sz', { label: 'Scale Z', type: 'number', def: 1 })]
    : [C('x', { label: j.ui ? 'X offset' : 'X', type: 'number', def: 0 }), C('y', { label: j.ui ? 'Y offset' : 'Y', type: 'number', def: 0 }),
      C('rz', { label: 'Rotation°', type: 'number', def: 0 }), C('sx', { label: 'Scale X', type: 'number', def: 1 }), C('sy', { label: 'Scale Y', type: 'number', def: 1 })];
  root.append(section('Transform', tr));

  if (j.shape) {
    const t = j.shape.type;
    root.append(section('Shape', [
      C('shape.type', { label: 'Type', type: 'select', options: ['rect', 'circle', 'triangle', 'star'], structure: true }),
      t === 'circle' ? C('shape.r', { label: 'Radius', type: 'number', def: 20 }) : [C('shape.w', { label: 'Width', type: 'number', def: 40 }), C('shape.h', { label: 'Height', type: 'number', def: 40 })],
      t === 'rect' && C('shape.radius', { label: 'Corner radius', type: 'number', def: 0 }),
      C('shape.fill', { label: 'Fill', type: 'color', optional: true }),
      C('shape.stroke', { label: 'Outline', type: 'color', optional: true }),
      j.shape.stroke && C('shape.lineWidth', { label: 'Outline width', type: 'number', def: 2 }),
      C('shape.glow', { label: 'Glow', type: 'number', def: 0 }),
    ], { onRemove: () => { delete j.shape; changed({ structure: true }); } }));
  }
  if (j.text) {
    root.append(section('Text', [
      C('text.value', { label: 'Text', type: 'text' }),
      h('p', { class: 'desc' }, 'Use {score}, {lives}, {best} or any game variable in braces.'),
      C('text.size', { label: 'Size', type: 'number', def: 24 }),
      C('text.color', { label: 'Color', type: 'color' }),
      C('text.align', { label: 'Align', type: 'select', options: ['left', 'center', 'right'], def: 'center' }),
    ], { onRemove: () => { delete j.text; changed({ structure: true }); } }));
  }
  if (j.sprite) {
    root.append(section('Image', [
      C('sprite.src', { label: 'Image URL', type: 'text' }),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => pickImage((url) => { j.sprite.src = url; changed({ inspector: true }); }) }, '📷 Choose image…')),
      C('sprite.w', { label: 'Width', type: 'number', def: 64 }),
      C('sprite.h', { label: 'Height', type: 'number', def: 64 }),
    ], { onRemove: () => { delete j.sprite; changed({ structure: true }); } }));
  }
  if (j.mesh) {
    const g = j.mesh.geometry;
    root.append(section('Mesh', [
      C('mesh.geometry', { label: 'Shape', type: 'select', options: ['box', 'sphere', 'cylinder', 'cone', 'plane'], structure: true }),
      g === 'box' && [C('mesh.w', { label: 'Width', type: 'number', def: 1 }), C('mesh.h', { label: 'Height', type: 'number', def: 1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1 })],
      g === 'sphere' && C('mesh.r', { label: 'Radius', type: 'number', def: 0.5 }),
      (g === 'cylinder' || g === 'cone') && [C('mesh.r', { label: 'Radius', type: 'number', def: 0.5 }), C('mesh.h', { label: 'Height', type: 'number', def: 1 })],
      g === 'plane' && [C('mesh.w', { label: 'Width', type: 'number', def: 1 }), C('mesh.d', { label: 'Depth', type: 'number', def: 1 })],
      C('mesh.color', { label: 'Color', type: 'color' }),
      C('mesh.emissive', { label: 'Glow (0–1)', type: 'number', def: 0, step: 0.1 }),
      C('mesh.opacity', { label: 'Opacity (0–1)', type: 'number', def: 1, step: 0.1 }),
    ], { onRemove: () => { delete j.mesh; changed({ structure: true }); } }));
  }
  if (!hasVisual(j)) {
    root.append(section('Looks', [
      h('p', { class: 'desc' }, 'This is an invisible logic object (shown as ⚙ in the editor). Give it a look:'),
      h('div', { class: 'btns' },
        is3D() && !j.ui ? h('button', { class: 'btn', onclick: () => { j.mesh = { geometry: 'box', w: 1, h: 1, d: 1, color: '#33a0ff' }; changed({ structure: true }); } }, 'Add mesh')
          : h('button', { class: 'btn', onclick: () => { j.shape = { type: 'rect', w: 40, h: 40, fill: '#33f0ff' }; changed({ structure: true }); } }, 'Add shape'),
        h('button', { class: 'btn', onclick: () => { j.text = { value: 'Text', size: 24, color: '#ffffff' }; changed({ structure: true }); } }, 'Add text'),
        !is3D() && h('button', { class: 'btn', onclick: () => { j.sprite = { src: '', w: 64, h: 64 }; changed({ structure: true }); } }, 'Add image')),
    ]));
  }

  if (!j.ui) {
    if (j.body) {
      const shp = j.body.shape || 'auto';
      root.append(section('Physics', [
        C('body.type', { label: 'Type', type: 'select', options: [['static', 'Static (walls, ground)'], ['dynamic', 'Dynamic (pushed around)'], ['kinematic', 'Kinematic (moves itself)']], def: 'dynamic' }),
        C('body.sensor', { label: 'Trigger only (no push)', type: 'bool', def: false }),
        j.body.type === 'dynamic' && [C('body.gravityScale', { label: 'Gravity scale', type: 'number', def: 1, step: 0.1 }), C('body.bounce', { label: 'Bounciness', type: 'number', def: 0, step: 0.1 })],
        C('body.shape', { label: 'Collider', type: 'select', options: [['auto', 'Match the look'], ['box', 'Box'], [threeD ? 'sphere' : 'circle', threeD ? 'Sphere' : 'Circle']], def: 'auto', structure: true }),
        shp === 'box' && [C('body.w', { label: 'Width', type: 'number', def: 1 }), C('body.h', { label: 'Height', type: 'number', def: 1 }), threeD && C('body.d', { label: 'Depth', type: 'number', def: 1 })],
        (shp === 'circle' || shp === 'sphere') && C('body.r', { label: 'Radius', type: 'number', def: 10 }),
      ], { onRemove: () => { delete j.body; changed({ structure: true }); } }));
    }
  }

  (j.behaviors || []).forEach((b, i) => {
    const def = Behaviors[b.type];
    if (!def) { root.append(section(b.type, [h('p', { class: 'desc' }, 'Unknown behavior')], { onRemove: () => removeBehavior(i) })); return; }
    root.append(section('⚡ ' + def.label, def.params.map((p) => C(`behaviors.${i}.${p.key}`, { ...p, def: paramDefault(p, threeD) })), {
      desc: def.description, onRemove: () => removeBehavior(i),
    }));
  });

  const addSel = h('select', { onchange: (e) => { if (e.target.value) addBehavior(e.target.value); } },
    h('option', { value: '' }, '+ Add behavior…'),
    Object.entries(Behaviors).filter(([k]) => !(j.ui && k !== 'script')).map(([k, d]) => h('option', { value: k }, d.label)));
  root.append(h('div', { class: 'sec' }, h('div', { class: 'body' },
    h('div', { class: 'row full' }, addSel),
    !j.body && !j.ui && h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => { j.body = { type: 'static' }; changed({ structure: true }); } }, '+ Add physics body')))));

  root.append(h('div', { class: 'btns' },
    h('button', { class: 'btn', onclick: () => duplicateEntity(j.id) }, '⧉ Duplicate'),
    h('button', { class: 'btn danger', onclick: () => deleteEntity(j.id) }, '🗑 Delete')));
}

function addBehavior(type) {
  const j = ent(selectedId), def = Behaviors[type], threeD = is3D() && !j.ui;
  const b = { type };
  for (const p of def.params) b[p.key] = clone(paramDefault(p, threeD));
  (j.behaviors ||= []).push(b);
  if (type === 'move' || type === 'platformer') { j.tags = [...new Set([...(j.tags || []), 'player'])]; }
  changed({ structure: true });
  toast(`Added ${def.label}`);
}
function removeBehavior(i) { const j = ent(selectedId); j.behaviors.splice(i, 1); changed({ structure: true }); }

function duplicateEntity(id) {
  const j = ent(id); if (!j) return;
  const c = clone(j); c.id = uid(); c.name = j.name.replace(/( copy)?$/, ' copy');
  if (j.ui) c.y = (c.y || 0) + 30; else if (is3D()) c.x = (c.x || 0) + 1.5; else { c.x = (c.x || 0) + 30; c.y = (c.y || 0) + 30; }
  project.entities.splice(project.entities.indexOf(j) + 1, 0, c);
  selectedId = c.id;
  changed({ structure: true }); pushHistory();
}
function deleteEntity(id) {
  const i = project.entities.findIndex((e) => e.id === id); if (i < 0) return;
  project.entities.splice(i, 1);
  if (selectedId === id) selectedId = null;
  changed({ structure: true }); pushHistory();
  toast('Deleted — tap ↶ to undo');
}

function pickImage(cb) {
  const fi = $('#fileInput');
  fi.accept = 'image/*';
  fi.onchange = () => {
    const f = fi.files[0]; fi.value = '';
    if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { // downscale to keep projects small enough for local storage
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
// Game (scene) settings
// ============================================================================
function renderScene() {
  const root = $('#tab-scene');
  root.replaceChildren();
  const P = () => project, C = (path, spec) => control(P, path, spec), threeD = is3D();
  root.append(section('Game', [
    C('name', { label: 'Name', type: 'text' }),
    C('background', { label: 'Background', type: 'color' }),
    C('gravity', { label: threeD ? 'Gravity (−25 = normal)' : 'Gravity (0 = top-down, 1600 = platformer)', type: 'number', def: threeD ? -25 : 0 }),
    !threeD && [C('view.width', { label: 'Design width', type: 'number', def: 400 }), C('view.height', { label: 'Design height', type: 'number', def: 700 })],
  ]));
  root.append(section('Start screen', [
    C('settings.title', { label: 'Title', type: 'text', def: '' }),
    C('settings.subtitle', { label: 'Subtitle', type: 'text', def: '' }),
    h('p', { class: 'desc' }, 'Leave the title empty to start playing immediately.'),
  ]));
  root.append(section('Touch controls', [
    C('settings.joystick', { label: 'Virtual joystick', type: 'bool', def: false }),
    C('settings.jumpButton', { label: 'Jump button', type: 'bool', def: false }),
    C('settings.actionButton', { label: 'Fire button', type: 'bool', def: false }),
    C('settings.pauseButton', { label: 'Pause button', type: 'bool', def: true }),
    h('p', { class: 'desc' }, 'Keyboard also works: arrows/WASD to move, Space to jump, E to fire.'),
  ]));
  root.append(section('Rules', [
    C('settings.winScore', { label: 'Win at score (0 = off)', type: 'number', def: 0 }),
    h('div', { class: 'row' }, h('label', {}, 'Save best score'), h('input', { type: 'checkbox', checked: !!project.settings.saveBest,
      onchange: (e) => { project.settings.saveBest = e.target.checked ? slug(project.name) + '-' + projectId.slice(-4) : ''; changed(); } })),
    C('vars', { label: 'Starting variables', type: 'json' }),
    h('p', { class: 'desc' }, 'e.g. {"score": 0, "lives": 3}. "lives" is used by Hazard → damage.'),
  ]));
  if (threeD) {
    root.append(section('Camera & light', [
      h('p', { class: 'desc' }, 'If no object has Camera follow, the game starts from this camera.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn', onclick: () => {
        const c = engine.scene.camera;
        project.camera = { ...(project.camera || {}), position: roundV(c.position), target: roundV(c.target) };
        changed(); toast('Game camera set to current view');
      } }, '🎥 Use current view')),
      C('camera.fov', { label: 'Field of view°', type: 'number', def: 60 }),
      C('light.ambient', { label: 'Ambient light (0–1)', type: 'number', def: 0.45, step: 0.05 }),
      C('fog.near', { label: 'Fog start', type: 'number', def: 30 }),
      C('fog.far', { label: 'Fog end', type: 'number', def: 120 }),
    ]));
  }
  root.append(h('div', { class: 'btns' },
    h('button', { class: 'btn primary', onclick: play }, '▶ Play'),
    h('button', { class: 'btn', onclick: exportHTML }, '⬇ Export game')));
  root.append(h('p', { class: 'desc', style: 'text-align:center;margin-top:16px' }, `Pocket Engine v${VERSION}`));
}
const roundV = (v) => ({ x: round(v.x), y: round(v.y), z: round(v.z) });

// ============================================================================
// Add objects
// ============================================================================
function addEntity(props) {
  const s = engine.scene, j = { id: uid(), ...clone(props) };
  if (!j.ui) {
    if (is3D()) { j.x = snapV(orbit.target.x, 0.5); j.z = snapV(orbit.target.z, 0.5); j.y ??= 0.5; }
    else { j.x = snapV(s.camera.x, 10); j.y = snapV(s.camera.y, 10); }
  }
  let n = 1; const base = j.name;
  while (project.entities.some((e) => e.name === j.name)) j.name = `${base} ${++n}`;
  project.entities.push(j);
  selectedId = j.id;
  changed({ structure: true }); pushHistory();
  setTab('inspector');
  closeSheet();
}

const ADD_2D = {
  Presets: [
    ['🙂', 'Player', 'moves with touch', { name: 'Player', tags: ['player'], shape: { type: 'circle', r: 18, fill: '#33f0ff', glow: 12 }, behaviors: [{ type: 'move', control: 'both', speed: 260 }] }],
    ['🏃', 'Jumper', 'platformer player', { name: 'Jumper', tags: ['player'], shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffd23d' }, behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'respawn' }], _scene: { gravity: 1600, settings: { joystick: true, jumpButton: true } } }],
    ['▬', 'Platform', 'solid ground', { name: 'Platform', shape: { type: 'rect', w: 200, h: 30, radius: 4, fill: '#3a8a4f' }, body: { type: 'static' } }],
    ['🪙', 'Coin', '+10 points', { name: 'Coin', shape: { type: 'circle', r: 12, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] }],
    ['👾', 'Enemy', 'patrols, hurts', { name: 'Enemy', shape: { type: 'rect', w: 36, h: 36, radius: 10, fill: '#ff4d6d' }, behaviors: [{ type: 'patrol', dx: 120, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'gameover' }] }],
    ['🏁', 'Goal', 'win on touch', { name: 'Goal', shape: { type: 'rect', w: 20, h: 100, fill: '#5dff8a' }, behaviors: [{ type: 'goal' }] }],
    ['⚙', 'Spawner', 'spawns templates', { name: 'Spawner', behaviors: [{ type: 'spawner', template: '', every: 1, x: [20, 380], y: -40, z: 0, relative: false, ramp: 0.1, max: 60 }] }],
    ['🔢', 'Score HUD', 'shows {score}', { name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left', color: '#ffffff' } }],
  ],
  Shapes: [
    ['■', 'Rectangle', '', { name: 'Rectangle', shape: { type: 'rect', w: 60, h: 60, fill: '#33f0ff' } }],
    ['●', 'Circle', '', { name: 'Circle', shape: { type: 'circle', r: 30, fill: '#ff3dac' } }],
    ['▲', 'Triangle', '', { name: 'Triangle', shape: { type: 'triangle', w: 60, h: 60, fill: '#a77bff' } }],
    ['★', 'Star', '', { name: 'Star', shape: { type: 'star', w: 60, h: 60, fill: '#ffd23d' } }],
    ['T', 'Text', 'in the world', { name: 'Text', text: { value: 'Hello!', size: 32, color: '#ffffff' } }],
    ['🔤', 'HUD text', 'fixed on screen', { name: 'HUD Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } }],
    ['🖼', 'Image', 'from your photos', { name: 'Image', sprite: { src: '', w: 80, h: 80 }, _pickImage: true }],
    ['⚙', 'Empty', 'invisible logic', { name: 'Logic' }],
  ],
};
const ADD_3D = {
  Presets: [
    ['🙂', 'Player', 'joystick ball', { name: 'Player', tags: ['player'], y: 0.6, mesh: { geometry: 'sphere', r: 0.6, color: '#3a7bff' }, behaviors: [{ type: 'move', speed: 7, control: 'joystick' }, { type: 'cameraFollow', oy: 9, oz: 10, smooth: 5 }], _scene: { settings: { joystick: true } } }],
    ['🏃', 'Jumper', '3D platformer', { name: 'Jumper', tags: ['player'], y: 1, mesh: { geometry: 'box', w: 0.8, h: 1.2, d: 0.8, color: '#ffd23d' }, behaviors: [{ type: 'platformer', speed: 7, jump: 10, onFall: 'respawn' }, { type: 'cameraFollow', oy: 7, oz: 11, smooth: 5 }], _scene: { settings: { joystick: true, jumpButton: true } } }],
    ['▬', 'Platform', 'solid block', { name: 'Platform', y: 0, mesh: { geometry: 'box', w: 4, h: 0.5, d: 4, color: '#c9a77a' }, body: { type: 'static' } }],
    ['💎', 'Gem', '+10 points', { name: 'Gem', y: 0.9, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.6, h: 0.6, d: 0.6, color: '#ffd23d', emissive: 0.5 }, behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'collectible', score: 10 }] }],
    ['👾', 'Enemy', 'patrols, hurts', { name: 'Enemy', y: 0.5, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#ff4d6d' }, behaviors: [{ type: 'patrol', dx: 4, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'gameover' }] }],
    ['🏁', 'Goal', 'win on touch', { name: 'Goal', y: 1, mesh: { geometry: 'cylinder', r: 0.6, h: 2, color: '#5dff8a', emissive: 0.4, opacity: 0.7 }, behaviors: [{ type: 'goal' }] }],
    ['⚙', 'Spawner', 'spawns templates', { name: 'Spawner', y: 3, behaviors: [{ type: 'spawner', template: '', every: 1, x: [-8, 8], y: 5, z: [-8, 8], relative: false, ramp: 0.1, max: 60 }] }],
    ['🔢', 'Score HUD', 'shows {score}', { name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left', color: '#ffffff' } }],
  ],
  Meshes: [
    ['◼', 'Box', '', { name: 'Box', mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#33a0ff' } }],
    ['●', 'Sphere', '', { name: 'Sphere', mesh: { geometry: 'sphere', r: 0.5, color: '#ff3dac' } }],
    ['▮', 'Cylinder', '', { name: 'Cylinder', mesh: { geometry: 'cylinder', r: 0.5, h: 1, color: '#a77bff' } }],
    ['▲', 'Cone', '', { name: 'Cone', mesh: { geometry: 'cone', r: 0.5, h: 1, color: '#ffd23d' } }],
    ['▬', 'Plane', 'flat floor tile', { name: 'Plane', y: 0.01, mesh: { geometry: 'plane', w: 4, d: 4, color: '#8a8aa0' } }],
    ['🔤', 'HUD text', 'fixed on screen', { name: 'HUD Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Lives {lives}', size: 22, color: '#ffffff' } }],
    ['⚙', 'Empty', 'invisible logic', { name: 'Logic' }],
  ],
};

function openAddSheet() {
  const groups = is3D() ? ADD_3D : ADD_2D;
  const body = [];
  for (const [title, items] of Object.entries(groups)) {
    body.push(h('h5', {}, title), h('div', { class: 'tiles' }, items.map(([ic, label, sub, props]) => h('button', { class: 'tile', onclick: () => {
      const p = clone(props); const sceneChanges = p._scene; const wantsImg = p._pickImage;
      delete p._scene; delete p._pickImage;
      if (sceneChanges) {
        if (sceneChanges.gravity != null && !project.gravity) project.gravity = sceneChanges.gravity;
        Object.assign(project.settings, sceneChanges.settings || {});
        renderScene();
      }
      if (p.behaviors?.some((b) => b.type === 'move' || b.type === 'platformer') && !project.vars.lives) project.vars.lives = 3;
      addEntity(p);
      if (wantsImg) pickImage((url) => { const j = ent(selectedId); if (j?.sprite) { j.sprite.src = url; changed({ inspector: true }); } });
    } }, h('span', { class: 'ic' }, ic), label, sub && h('small', {}, sub)))));
  }
  openSheet('Add object', body);
}

// ============================================================================
// Sheets: menu, new game, open
// ============================================================================
function openSheet(title, kids) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').replaceChildren(...[kids].flat());
  $('#sheet').hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; }
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet' || e.target.closest('[data-close]')) closeSheet(); });

const menuItem = (ic, label, fn, small) => h('button', { class: 'menu-item', onclick: () => { closeSheet(); fn(); } }, h('span', { class: 'ic' }, ic), label, small && h('small', {}, small));

function openMenu() {
  openSheet('Pocket Editor', [
    menuItem('✨', 'New game…', openNewSheet),
    menuItem('📂', 'My games…', openProjectsSheet),
    menuItem('✏️', 'Rename game', () => { const n = prompt('Game name', project.name); if (n) { project.name = n; changed(); refreshAll(); } }),
    menuItem('⧉', 'Duplicate game', () => { const c = clone(project); c.name += ' copy'; openProject(c); toast('Duplicated'); }),
    menuItem('⬇', 'Export playable HTML', exportHTML, 'one file, works offline'),
    menuItem('{ }', 'Export project JSON', () => download(slug(project.name) + '.json', JSON.stringify(project, null, 2), 'application/json')),
    menuItem('⬆', 'Import project JSON…', importJSON),
    menuItem('🎮', 'Examples & docs', () => { location.href = '../'; }),
  ]);
}

function openNewSheet() {
  openSheet('New game', [
    h('p', { class: 'desc', style: 'color:var(--muted)' }, 'Start from a template. Your current game is saved in My games.'),
    h('div', { class: 'tiles' }, templateInfo.map((t) => h('button', { class: 'tile', onclick: () => { closeSheet(); newFromTemplate(t.key); toast(`Created “${project.name}”`); } },
      h('span', { class: 'ic' }, templates[t.key].mode === '3d' ? '🧊' : '🟦'), t.title, h('small', {}, t.blurb)))),
  ]);
}

function openProjectsSheet() {
  const all = Object.entries(loadProjects()).sort((a, b) => b[1].updated - a[1].updated);
  openSheet('My games', all.length ? all.map(([id, p]) => h('div', { class: 'menu-item' },
    h('span', { class: 'ic' }, p.json.mode === '3d' ? '🧊' : '🟦'),
    h('span', { style: 'flex:1', onclick: () => { closeSheet(); saveNow(); openProject(p.json, id); } }, p.name, id === projectId ? ' (open)' : ''),
    h('small', {}, new Date(p.updated).toLocaleDateString()),
    id !== projectId && h('button', { class: 'icon', 'aria-label': 'Delete', onclick: () => {
      if (!confirm(`Delete “${p.name}”?`)) return;
      const a = loadProjects(); delete a[id]; store.set(PROJECTS_KEY, JSON.stringify(a)); openProjectsSheet();
    } }, '🗑'))) : h('div', { class: 'empty' }, 'No saved games.'));
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
      openProject(json); toast(`Imported “${json.name || 'game'}”`);
    } catch (err) { toast('Could not import: ' + err.message); }
  };
  fi.click();
}

/** A single self-contained HTML file: the engine source plus the game JSON. */
async function exportHTML() {
  try {
    const src = await (await fetch(new URL('../engine/pocket.js', import.meta.url))).text();
    const game = JSON.stringify(project).replace(/</g, '\\u003c');
    const title = String(project.name).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' })[c]);
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="${project.background || '#000'}">
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:${project.background || '#000'};overflow:hidden;overscroll-behavior:none}</style>
</head><body>
<script type="module">
${src.replace(/<\/script/gi, '<\\/script')}
new Engine().start(${game});
</script>
</body></html>`;
    download(slug(project.name) + '.html', html, 'text/html');
    toast('Exported — open the file in any browser');
  } catch (err) {
    toast('Export failed: ' + err.message);
  }
}

// ============================================================================
// Play mode
// ============================================================================
function play() {
  if (playing) return;
  closeSheet();
  document.activeElement?.blur?.();
  playing = true;
  document.body.classList.add('playing');
  $('#stopBtn').hidden = false;
  engine.editing = false;
  engine.input.enabled = true;
  const json = clone(project);
  json.settings = { ...json.settings, pauseButton: false };
  engine.timeScale = 1;
  try { engine.start(json); } catch (err) { console.error(err); toast('Error: ' + err.message); stop(); }
  requestAnimationFrame(() => { engine.resize(); engine.layoutButtons(); });
}
function stop() {
  if (!playing) return;
  playing = false;
  document.body.classList.remove('playing');
  $('#stopBtn').hidden = true;
  engine.editing = true;
  engine.input.enabled = false;
  engine.input.reset();
  engine.timeScale = 1;
  engine.factory = null;
  requestAnimationFrame(() => { engine.resize(); rebuild(); });
}

// ============================================================================
// Wire up
// ============================================================================
$('#menuBtn').addEventListener('click', openMenu);
$('#addBtn').addEventListener('click', openAddSheet);
$('#playBtn').addEventListener('click', play);
$('#stopBtn').addEventListener('click', stop);
$('#undoBtn').addEventListener('click', () => undoRedo(-1));
$('#redoBtn').addEventListener('click', () => undoRedo(1));
$('#snapBtn').classList.toggle('on', snap);
$('#snapBtn').addEventListener('click', () => {
  snap = !snap; store.set('pocket.editor.snap', snap ? '1' : '0');
  $('#snapBtn').classList.toggle('on', snap); toast(snap ? 'Snap to grid on' : 'Snap to grid off');
});
window.addEventListener('beforeunload', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

// Open the last project, or start with a template
{
  const all = loadProjects(), cur = store.get(CURRENT_KEY, '');
  const q = new URLSearchParams(location.search);
  if (q.get('template') && templates[q.get('template')]) newFromTemplate(q.get('template'));
  else if (all[cur]) openProject(all[cur].json, cur);
  else { newFromTemplate('sky-dodge', 'My First Game'); $('#hint').hidden = false; }
}
