// The Scene view of the phone app's native editor (mobile/src/editor/). The app (React Native) holds the project and draws the
// Hierarchy, Inspector, Add menu and the rest; this page only runs Pocket Engine: it shows the level, lets you tap an object to
// select it, drag it to move it, drag the empty view to pan (2D) or orbit (3D), pinch or scroll to zoom, and Play / Stop.
// Messages in: { id?, op, ... }; answers: { re: id, ok, data | error }; events out: ready, tap, moved, log, played, stopped.
import { Engine, Scene, Behaviors, Log, uiBox, placeUI } from '../engine/pocket.js';
import { BEH_META, CAT_ORDER } from './library.js';
import { PREFABS_2D, PREFABS_3D, OBJECTS_2D, OBJECTS_3D } from './presets.js';

const post = (m) => { const s = JSON.stringify(m); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage(s, '*'); };
const view = document.getElementById('view'), selBox = document.getElementById('sel');
const engine = new Engine({ parent: view, systemBack: false });
engine.editing = true; engine.showUI = true; engine.input.enabled = false;
window.engine = engine;

let game = null, level = 0, lv = null, selected = null, playing = false;
let cam2d = null, orbit = null; // the view: kept across rebuilds, reset for a new project
const levelOf = (g, i) => (i > 0 ? g.levels?.[i - 1] || g : g);
const is3D = () => lv?.mode === '3d';

engine.drawGrid = (ctx, s, z) => { // a light grid, like the editor's
  const v = s.viewBounds(), step = z < 0.35 ? 100 : z > 2 ? 10 : 50;
  ctx.lineWidth = 1 / z; ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath();
  for (let x = Math.floor(v.left / step) * step; x < v.right; x += step) { ctx.moveTo(x, v.top); ctx.lineTo(x, v.bottom); }
  for (let y = Math.floor(v.top / step) * step; y < v.bottom; y += step) { ctx.moveTo(v.left, y); ctx.lineTo(v.right, y); }
  ctx.stroke();
};

function applyCamera() {
  const s = engine.scene; if (!s || playing) return;
  if (s.mode === '2d') Object.assign(s.camera, cam2d);
  else { const o = orbit, cp = Math.cos(o.pitch); s.camera.ortho = false; s.camera.target = { ...o.target }; s.camera.position = { x: o.target.x + o.dist * cp * Math.sin(o.yaw), y: o.target.y + o.dist * Math.sin(o.pitch), z: o.target.z + o.dist * cp * Math.cos(o.yaw) }; s.camera.far = 1000; s.fog = { near: 400, far: 1000 }; }
  engine.wake?.(); engine.render?.();
}
function rebuild() {
  if (!lv) return;
  try { engine.setScene(Scene.fromJSON(lv, { editing: true })); } catch (err) { post({ type: 'log', level: 'error', text: 'This level could not be shown: ' + err.message }); return; }
  engine.letterbox = false; engine.fitScreen();
  applyCamera();
}

// ---------- where things are on screen ----------
const ent = (id) => engine.scene?.byId(id);
const hasVisual = (e) => !!(e.shape || e.mesh || e.text || e.sprite || e.voxels || e.tiles || e.model || e.bar);
function screenRect(e) {
  const s = engine.scene, r = engine.renderer;
  if (e.ui) { const b = uiBox(e, engine.width, engine.height, engine.safe); return { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h }; }
  const ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx || 10, hy = ex.sphere ? ex.r : ex.hy || 10;
  if (s.mode === '2d') { const cx = e.x + (ex.ox || 0), cy = e.y + (ex.oy || 0), a = r.worldToScreen(s, cx - hx, cy - hy), b = r.worldToScreen(s, cx + hx, cy + hy); return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; }
  const c = r.worldToScreen(s, e.x, e.y, e.z); if (c.behind) return null;
  const top = r.worldToScreen(s, e.x, e.y + Math.max(hy, ex.hz || hy, 0.3), e.z), rad = Math.max(14, Math.abs(c.y - top.y));
  return { x: c.x - rad, y: c.y - rad, w: rad * 2, h: rad * 2 };
}
function drawSelection() {
  const e = selected && !playing ? ent(selected) : null, R = e && screenRect(e);
  if (!R) { selBox.style.display = 'none'; return; }
  Object.assign(selBox.style, { display: 'block', left: R.x - 3 + 'px', top: R.y - 3 + 'px', width: R.w + 6 + 'px', height: R.h + 6 + 'px' });
}
(function loop() { drawSelection(); requestAnimationFrame(loop); })();

function pick(sx, sy) {
  const s = engine.scene; if (!s) return null;
  const list = s.entities.slice().reverse().filter((e) => e.visible !== false && !e._parentHidden);
  let best = null, bestA = Infinity;
  for (const e of list) { if (!e.ui || e._clipHidden || !engine.uiFilter?.(e) || !(['always', 'play'].includes(e.showWhen) || engine.screenFilter?.(e))) continue;
    const R = screenRect(e), pad = Math.max(6, 22 - Math.min(R.w, R.h) / 2);
    if (sx >= R.x - pad && sx <= R.x + R.w + pad && sy >= R.y - pad && sy <= R.y + R.h + pad) { const a = R.w * R.h; if (a < bestA) { bestA = a; best = e; } } }
  if (best) return best;
  for (const e of list) { if (e.ui || hasVisual(e)) continue; const R = screenRect(e); if (R && Math.abs(sx - (R.x + R.w / 2)) < 18 && Math.abs(sy - (R.y + R.h / 2)) < 18) return e; }
  let hit = null, bestD = Infinity;
  for (const e of list) { if (e.ui || !hasVisual(e) || e.voxels) continue; const R = screenRect(e); if (!R) continue;
    if (sx >= R.x - 4 && sx <= R.x + R.w + 4 && sy >= R.y - 4 && sy <= R.y + R.h + 4) { const d = R.w * R.h; if (d < bestD) { bestD = d; hit = e; } } }
  return hit;
}

// ---------- touch: tap selects, drag moves (or pans / orbits), pinch zooms ----------
const pts = new Map(); let gesture = null;
view.addEventListener('pointerdown', (ev) => {
  if (playing) return;
  view.setPointerCapture?.(ev.pointerId); pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (pts.size === 2) { const [a, b] = [...pts.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), cam: cam2d && { ...cam2d }, dist: orbit?.dist }; return; }
  const e = selected && ent(selected), onSel = e && !e.parentEnt && (() => { const R = screenRect(e); return R && ev.clientX >= R.x - 12 && ev.clientX <= R.x + R.w + 12 && ev.clientY >= R.y - 12 && ev.clientY <= R.y + R.h + 12; })();
  gesture = { kind: onSel ? 'move' : 'view', x0: ev.clientX, y0: ev.clientY, moved: false, start: e ? { x: e.x, y: e.y, z: e.z } : null, cam: cam2d && { ...cam2d }, orbit: orbit && { ...orbit, target: { ...orbit.target } } };
});
view.addEventListener('pointermove', (ev) => {
  if (!pts.has(ev.pointerId) || !gesture) return;
  pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  const s = engine.scene; if (!s) return;
  if (gesture.kind === 'pinch' && pts.size >= 2) { const [a, b] = [...pts.values()], k = Math.hypot(a.x - b.x, a.y - b.y) / (gesture.d || 1);
    if (s.mode === '2d') cam2d.zoom = Math.max(0.1, Math.min(6, gesture.cam.zoom * k)); else orbit.dist = Math.max(3, Math.min(200, gesture.dist / k)); applyCamera(); return; }
  const dx = ev.clientX - gesture.x0, dy = ev.clientY - gesture.y0;
  if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
  gesture.moved = true;
  if (gesture.kind === 'move') {
    const e = ent(selected); if (!e) return;
    if (e.ui) { const k = engine.safe?.k || 1; e.x = gesture.start.x + dx / k; e.y = gesture.start.y + dy / k; }
    else if (s.mode === '2d') { const z = engine.renderer.zoomFor(s); e.x = gesture.start.x + dx / z; e.y = gesture.start.y + dy / z; }
    else { const r0 = engine.renderer.screenRay(s, gesture.x0, gesture.y0), r1 = engine.renderer.screenRay(s, ev.clientX, ev.clientY), y = gesture.start.y, at = (r) => { const t = (y - r.origin.y) / (r.dir.y || 1e-6); return { x: r.origin.x + r.dir.x * t, z: r.origin.z + r.dir.z * t }; }, a = at(r0), b = at(r1);
      e.x = gesture.start.x + (b.x - a.x); e.z = gesture.start.z + (b.z - a.z); }
    engine.wake?.(); engine.render?.();
  } else if (s.mode === '2d') { const z = engine.renderer.zoomFor(s); cam2d.x = gesture.cam.x - dx / z; cam2d.y = gesture.cam.y - dy / z; applyCamera(); }
  else { orbit.yaw = gesture.orbit.yaw - dx * 0.008; orbit.pitch = Math.max(-1.45, Math.min(1.45, gesture.orbit.pitch + dy * 0.008)); applyCamera(); }
});
const end = (ev) => {
  if (!pts.has(ev.pointerId)) return; pts.delete(ev.pointerId);
  if (!gesture || pts.size) return;
  const g = gesture; gesture = null;
  if (g.kind === 'pinch') return;
  if (!g.moved) { const e = pick(ev.clientX, ev.clientY); selected = e ? e.id : null; post({ type: 'tap', id: selected }); return; }
  if (g.kind === 'move') { const e = ent(selected); if (e) post({ type: 'moved', id: e.id, x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100, z: e.z != null ? Math.round(e.z * 100) / 100 : undefined }); }
};
view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
view.addEventListener('wheel', (ev) => { if (playing || !engine.scene) return; ev.preventDefault(); const k = Math.exp(-ev.deltaY * 0.0015); if (engine.scene.mode === '2d') cam2d.zoom = Math.max(0.1, Math.min(6, cam2d.zoom * k)); else orbit.dist = Math.max(3, Math.min(200, orbit.dist / k)); applyCamera(); }, { passive: false });

// ---------- what the app asks ----------
/** Every component's settings, for the native Inspector and Add Component (functions and long help left out). */
function schemas() {
  const out = {};
  for (const [type, d] of Object.entries(Behaviors)) {
    if (d.hidden) continue;
    out[type] = { label: d.label, description: d.description || '', category: BEH_META[type]?.[0] || 'Other',
      params: (d.params || []).map((p) => ({ key: p.key, label: p.label || p.key, type: p.type, default: typeof p.default === 'function' ? undefined : p.default, ...(Array.isArray(p.options) ? { options: p.options.filter((o) => typeof o === 'string' || typeof o === 'number') } : {}), ...(p.group ? { group: p.group } : {}), ...(p.range ? { range: p.range } : {}), ...(p.step ? { step: p.step } : {}), ...(p.optional ? { optional: true } : {}) })) };
  }
  return { behaviors: out, categories: CAT_ORDER };
}
const presets = (three) => ({ prefabs: (three ? PREFABS_3D : PREFABS_2D).map(({ icon, label, group, desc, props }) => ({ icon, label, group: group || 'Objects', desc: desc || '', props })), objects: (three ? OBJECTS_3D : OBJECTS_2D).map(({ icon, label, props }) => ({ icon, label, props })) });

const ops = {
  load({ game: g, level: i = 0, keepView }) {
    const fresh = !game || !keepView || g.name !== game?.name || i !== level;
    game = g; level = i; lv = levelOf(g, i);
    if (fresh || !cam2d) { const v = lv.view || { width: 400, height: 700 }; cam2d = { x: v.width / 2, y: v.height / 2, zoom: 0.85 }; orbit = { yaw: 0.5, pitch: 0.8, dist: 22, target: { x: 0, y: 0, z: 0 } }; }
    if (!playing) rebuild();
    return { mode: lv.mode || '2d' };
  },
  select({ id }) { selected = id || null; return true; },
  frame({ id }) { const e = ent(id); if (!e) return false; if (engine.scene.mode === '2d') { cam2d.x = e.x; cam2d.y = e.y; } else orbit.target = { x: e.x, y: e.y, z: e.z }; applyCamera(); return true; },
  resetView() { const v = lv?.view || { width: 400, height: 700 }; cam2d = { x: v.width / 2, y: v.height / 2, zoom: 0.85 }; orbit = { yaw: 0.5, pitch: 0.8, dist: 22, target: { x: 0, y: 0, z: 0 } }; applyCamera(); return true; },
  play() {
    if (!game) return false;
    const json = JSON.parse(JSON.stringify(game));
    for (const l of [json, ...(json.levels || [])]) l.settings = { ...l.settings, pauseButton: false, muteButton: false, fullscreen: false, saveProgress: false, loadOnStart: false };
    playing = true; engine.editing = false; engine.letterbox = true; engine.input.enabled = true; engine.timeScale = 1; Log.clear();
    try { engine.start(json, { level }); if (engine.scene.state === 'title') engine.scene.state = 'play'; } catch (err) { post({ type: 'log', level: 'error', text: "The game couldn't start: " + err.message }); ops.stop(); return false; }
    requestAnimationFrame(() => { engine.fitScreen(); engine.resize(); engine.layoutButtons?.(); });
    post({ type: 'played' }); return true;
  },
  stop() {
    playing = false; engine.editing = true; engine.paused = false; engine.input.enabled = false; engine.input.reset?.(true);
    engine.closeSettings?.(true); engine.clearOverlays?.(); engine.audio?.stopAll?.();
    rebuild(); post({ type: 'stopped' }); return true;
  },
  schemas, presets: ({ three }) => presets(three),
};
let seen = 0;
Log.listeners.add(() => { const L = Log.entries; if (L.length < seen) seen = 0; for (; seen < L.length; seen++) { const e = L[seen]; post({ type: 'log', level: e.level, text: e.text, source: e.source }); } });

async function handle(raw) {
  let m; try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  if (!m || !m.op || !ops[m.op]) return;
  try { const data = await ops[m.op](m); if (m.id != null) post({ re: m.id, ok: true, data }); } catch (err) { if (m.id != null) post({ re: m.id, ok: false, error: String(err?.message || err) }); }
}
window.pocketScene = handle; // (react-native-webview: injectJavaScript calls this)
window.addEventListener('message', (e) => handle(e.data)); // (the app's web version)
document.addEventListener('message', (e) => handle(e.data)); // (Android's web view)
addEventListener('resize', () => { engine.resize(); engine.fitScreen?.(); applyCamera(); });
post({ type: 'ready' });
