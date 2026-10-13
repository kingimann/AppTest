// 3D Modeler: a full-screen, touch-first modeling workspace in the spirit of Blender.
// Object mode arranges parts; Edit mode reshapes editable meshes by vertex or face:
// move / rotate / scale with axis locks, extrude, inset, subdivide, smooth, merge, fill, delete, flip and paint.
// Drag the selection (or the round handle) to transform it; drag empty space to orbit; two fingers pan and zoom.
import { Engine, Scene, M4, DEG, partSize, geometryArrays } from '../engine/pocket.js';
import { icon } from './icons.js';
import * as MO from './meshops.js';

const { sub, add, mul, cross, dot, len, norm } = MO.V3;
const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const AXIS_COLOR = { x: '#e8453c', y: '#8bd347', z: '#3d7bf2', free: '#ffffff', normal: '#f7a02c' };
const PALETTE = ['#f5f5f5', '#9e9e9e', '#424242', '#212121', '#e53935', '#fb8c00', '#fdd835', '#7cb342', '#43a047', '#26a69a', '#29b6f6', '#1e88e5', '#5e35b1', '#d81b60', '#8d6e63', '#ffccbc'];
const PRIMS = [
  ['Cube', () => MO.makeCube()], ['Plane', () => MO.makePlane(2, 2)], ['Cylinder', () => MO.makeCylinder(12)], ['Cone', () => MO.makeCylinder(12, 0.5, 1, true)],
  ['UV Sphere', () => MO.makeSphere(16, 10)], ['Ico Sphere', () => MO.makeIcoSphere(0.5, 1)], ['Torus', () => MO.makeTorus()],
];
const SHAPES = [['box', 'Box'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['capsule', 'Capsule'], ['pyramid', 'Pyramid'], ['wedge', 'Ramp'], ['prism', 'Prism'], ['gem', 'Gem'], ['dome', 'Dome'], ['torus', 'Torus (smooth)']];

const r4 = (x) => Math.round(x * 10000) / 10000;
const tp = (M, p) => { const q = M4.transformPoint(M, p[0], p[1], p[2]); return [q.x, q.y, q.z]; };

/** opts: { model, title, h, popMenu, toast, buzz, onChange(model), onClose() } */
export function openModeler(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts;
  let parts = JSON.parse(JSON.stringify(opts.model?.parts || []));
  let sel = parts.length ? 0 : -1, mode = 'object', selMode = 'vert', tool = 'move', axis = 'free', snap = false, mirror = false;
  let selV = new Set(), selF = new Set();
  const undo = [], redo = [];

  // ---------- layout ----------
  const view = h('div', { class: 'mo-view' });
  const hint = h('div', { class: 'mo-hint' });
  const info = h('div', { class: 'mo-info' });
  const rows = h('div', { class: 'mo-rows' });
  const undoBtn = h('button', { class: 'ne-btn', title: 'Undo', onclick: () => doUndo() }, icon('undo'));
  const redoBtn = h('button', { class: 'ne-btn', title: 'Redo', onclick: () => doRedo() }, icon('redo'));
  const root = h('div', { class: 'mo' },
    h('div', { class: 'ne-top' },
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('div', { class: 'ne-title' }, h('b', {}, '3D Modeler'), h('small', {}, opts.title || '')),
      undoBtn, redoBtn,
      h('button', { class: 'ne-btn', title: 'View', onclick: (e) => viewMenu(e.currentTarget) }, icon('eye'))),
    h('div', { class: 'mo-stage' }, view, hint,
      h('div', { class: 'mo-views' }, ['Persp', 'Front', 'Side', 'Top'].map((v) => h('button', { onclick: () => setView(v) }, v)))),
    h('div', { class: 'mo-panel' }, info, rows));
  document.body.append(root);

  // ---------- viewport (its own little engine) ----------
  const engine = new Engine({ parent: view });
  engine.editing = true; engine.showUI = false; engine.input.enabled = false;
  const scene = new Scene({ mode: '3d', background: '#303236', light: { ambient: 0.5, sky: '#dfe8ff', ground: '#8a7d70', shadows: false }, fog: { near: 200, far: 400 } });
  const ent = scene.add({ name: 'Model', model: { parts: [] } });
  engine.start(scene);
  ent.model.parts = parts;
  const cam = { yaw: 0.75, pitch: 0.42, dist: 5, target: [0, 0.5, 0] };
  const applyCam = () => {
    const c = scene.camera, t = cam.target;
    c.target = { x: t[0], y: t[1], z: t[2] };
    c.position = { x: t[0] + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, y: t[1] + Math.sin(cam.pitch) * cam.dist, z: t[2] + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist };
  };
  applyCam();
  const eye = () => { const p = scene.camera.position; return [p.x, p.y, p.z]; };
  const camBasis = () => {
    const f = norm(sub(cam.target, eye())), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    return { f, r: len(r) ? r : [1, 0, 0], u };
  };
  const project = (p) => engine.renderer.worldToScreen(scene, p[0], p[1], p[2]);
  const local = (e) => { const b = view.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };

  // ---------- part helpers ----------
  const isMesh = (q) => q?.geometry === 'mesh';
  const partMatrix = (q) => {
    if (isMesh(q)) return M4.trs(q.x || 0, q.y || 0, q.z || 0, (q.rx || 0) * DEG, (q.ry || 0) * DEG, (q.rz || 0) * DEG, q.sx ?? 1, q.sy ?? 1, q.sz ?? 1);
    const [gx, gy0, gz] = partSize(q), gy = q.geometry === 'plane' ? 1 : gy0;
    return M4.trs(q.x || 0, q.y || 0, q.z || 0, (q.rx || 0) * DEG, (q.ry || 0) * DEG, (q.rz || 0) * DEG, gx, gy, gz);
  };
  const geoCache = {};
  const primTris = (kind) => {
    if (!geoCache[kind]) { const g = geometryArrays(kind || 'box'); geoCache[kind] = MO.fromTriangles(g.P, g.I); }
    return geoCache[kind];
  };
  const meshOf = (q) => (isMesh(q) ? q : primTris(q.geometry));
  const worldVerts = (q) => { const M = partMatrix(q); return meshOf(q).verts.map((p) => tp(M, p)); };
  const cur = () => parts[sel];
  const editMesh = () => (mode === 'edit' && isMesh(cur()) ? cur() : null);
  const selVerts = () => { const m = editMesh(); if (!m) return new Set(); return selMode === 'face' ? MO.faceVerts(m, selF) : new Set([...selV].filter((i) => i < m.verts.length)); };
  const pivot = () => {
    const q = cur(); if (!q) return null;
    if (mode === 'edit') {
      const vs = selVerts(); if (!vs.size) return null;
      const M = partMatrix(q); return MO.centroid(q.verts.map((p) => tp(M, p)), [...vs]);
    }
    const wv = worldVerts(q); return MO.centroid(wv, wv.map((_, i) => i));
  };

  // ---------- history ----------
  const snapshot = () => JSON.stringify({ parts, sel });
  const push = () => { undo.push(snapshot()); if (undo.length > 80) undo.shift(); redo.length = 0; syncUndo(); };
  const restore = (s) => { const d = JSON.parse(s); parts = d.parts; sel = d.sel; ent.model.parts = parts; if (!editMesh() && mode === 'edit') mode = 'object'; selV.clear(); selF.clear(); emit(); render(); };
  function doUndo() { if (!undo.length) return; redo.push(snapshot()); restore(undo.pop()); syncUndo(); }
  function doRedo() { if (!redo.length) return; undo.push(snapshot()); restore(redo.pop()); syncUndo(); }
  const syncUndo = () => { undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; };
  const emit = () => opts.onChange({ parts: parts.map((q) => (isMesh(q) ? { ...q, verts: q.verts.map((p) => p.map(r4)), faces: q.faces.map((f) => ({ ...f, v: [...f.v] })) } : { ...q })) });

  // ---------- picking ----------
  function rayTri(o, d, a, b, c) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-9) return null;
    const inv = 1 / det, s = sub(o, a), u = dot(s, p) * inv; if (u < 0 || u > 1) return null;
    const q = cross(s, e1), v = dot(d, q) * inv; if (v < 0 || u + v > 1) return null;
    const t = dot(e2, q) * inv; return t > 1e-6 ? t : null;
  }
  function rayHitMesh(o, d, wv, faces) {
    let best = null;
    faces.forEach((f, fi) => { for (let t = 1; t < f.v.length - 1; t++) { const hit = rayTri(o, d, wv[f.v[0]], wv[f.v[t]], wv[f.v[t + 1]]); if (hit != null && (!best || hit < best.t)) best = { t: hit, face: fi }; } });
    return best;
  }
  const ray = (sx, sy) => { const r = engine.renderer.screenRay(scene, sx, sy); return { o: [r.origin.x, r.origin.y, r.origin.z], d: [r.dir.x, r.dir.y, r.dir.z] }; };
  function pickPart(sx, sy) {
    const { o, d } = ray(sx, sy); let best = null;
    parts.forEach((q, i) => { const hit = rayHitMesh(o, d, worldVerts(q), meshOf(q).faces); if (hit && (!best || hit.t < best.t)) best = { t: hit.t, i }; });
    return best ? best.i : -1;
  }
  function pickFace(sx, sy) { const m = editMesh(); if (!m) return -1; const { o, d } = ray(sx, sy); const hit = rayHitMesh(o, d, worldVerts(m), m.faces); return hit ? hit.face : -1; }
  function pickVert(sx, sy, radius = 26) {
    const m = editMesh(); if (!m) return -1;
    let best = -1, bd = radius;
    worldVerts(m).forEach((p, i) => { const s = project(p); if (s.behind) return; const dd = Math.hypot(s.x - sx, s.y - sy); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }

  // ---------- overlays ----------
  const GRID = (() => { const p = []; for (let i = -10; i <= 10; i++) p.push(i, 0, -10, i, 0, 10, -10, 0, i, 10, 0, i); return p; })();
  engine.onRenderWorld = (r) => {
    r.drawLines(GRID, '#ffffff', 0.08);
    r.drawLines([-10, 0.001, 0, 10, 0.001, 0], AXIS_COLOR.x, 0.6); r.drawLines([0, 0.001, -10, 0, 0.001, 10], AXIS_COLOR.z, 0.6);
    const q = cur();
    if (q && mode === 'object') { // box around the selected part
      const M = partMatrix(q), mm = meshOf(q), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of mm.verts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      const c = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map((b) => tp(M, b.map((t, k) => (t ? hi[k] : lo[k]))));
      const pts = []; for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[a], ...c[b]);
      const gl = r.gl; gl.disable(gl.DEPTH_TEST); r.drawLines(pts, '#f7a02c'); gl.enable(gl.DEPTH_TEST);
    }
    const pv = pivot();
    if (pv && ['x', 'y', 'z', 'normal'].includes(axis)) { const a = axisDir(); if (a) r.drawLines([...sub(pv, mul(a, 50)), ...add(pv, mul(a, 50))], AXIS_COLOR[axis], 0.7); }
  };
  engine.onRenderUI = (ctx) => {
    const m = editMesh();
    if (m) {
      const wv = worldVerts(m), sv = wv.map(project), vs = selVerts();
      ctx.lineWidth = 1.5;
      for (const [a, b] of MO.edges(m)) {
        const A = sv[a], B = sv[b]; if (A.behind || B.behind) continue;
        ctx.strokeStyle = vs.has(a) && vs.has(b) ? '#ffb340' : 'rgba(10,10,10,0.75)';
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(247,160,44,0.35)';
      const fs = selMode === 'face' ? selF : MO.facesFromVerts(m, vs);
      for (const f of fs) { const F = m.faces[f]; if (!F) continue; ctx.beginPath(); F.v.forEach((k, i) => (i ? ctx.lineTo(sv[k].x, sv[k].y) : ctx.moveTo(sv[k].x, sv[k].y))); ctx.closePath(); ctx.fill(); }
      if (selMode === 'vert') {
        sv.forEach((s, i) => { if (s.behind) return; const on = vs.has(i); ctx.fillStyle = on ? '#ffb340' : '#111'; ctx.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(s.x, s.y, on ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      } else {
        m.faces.forEach((F, i) => { const c = project(MO.centroid(wv, F.v)); if (c.behind) return; ctx.fillStyle = selF.has(i) ? '#ffb340' : 'rgba(20,20,20,0.8)'; ctx.fillRect(c.x - 3.5, c.y - 3.5, 7, 7); });
      }
    }
    const pv = pivot();
    if (pv) { // the transform handle: drag it to move / rotate / scale
      const s = project(pv); if (s.behind) return;
      handle = s; root.dataset.hx = Math.round(s.x); root.dataset.hy = Math.round(s.y); // handle position (also read by tests)
      ctx.fillStyle = 'rgba(30,30,30,0.55)'; ctx.strokeStyle = AXIS_COLOR[axis] || '#fff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.x, s.y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText({ move: '✥', rotate: '⟳', scale: '⤡' }[tool], s.x, s.y + 1);
    } else handle = null;
  };
  let handle = null;

  // ---------- transforms ----------
  function axisDir() {
    if (axis === 'normal') {
      const m = editMesh(); if (!m) return null;
      const fs = selMode === 'face' ? selF : MO.facesFromVerts(m, selVerts());
      const M = partMatrix(m); let n = [0, 0, 0];
      for (const f of fs) n = add(n, MO.newell(m.verts, m.faces[f].v));
      if (!len(n)) return null;
      const o = tp(M, [0, 0, 0]); return norm(sub(tp(M, n), o));
    }
    return AXES[axis] || null;
  }
  const rotate = (v, a, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return add(add(mul(v, c), mul(cross(a, v), s)), mul(a, dot(a, v) * (1 - c))); };
  let drag = null;
  function beginTransform(sx, sy) {
    const q = cur(), pv = pivot(); if (!q || !pv) return false;
    push();
    drag = { kind: 'xf', sx, sy, pv, q, orig: JSON.parse(JSON.stringify(q)), M: partMatrix(q), ax: axisDir(), sp: project(pv) };
    if (mode === 'edit') {
      const vs = [...selVerts()];
      drag.ids = vs;
      if (mirror) { drag.mir = new Map(); for (const i of vs) { const j = MO.mirrorOf(q, i); if (j >= 0) drag.mir.set(i, j); } }
    }
    return true;
  }
  function worldPerPixel(p) {
    const c = scene.camera, aspect = engine.width / engine.height, fov = aspect < 1 ? 2 * Math.atan(Math.tan(c.fov * DEG / 2) / Math.sqrt(aspect)) : c.fov * DEG;
    return 2 * len(sub(p, eye())) * Math.tan(fov / 2) / engine.height;
  }
  function updateTransform(x, y) {
    const d = drag, dx = x - d.sx, dy = y - d.sy, q = d.q;
    // world-space change for a point p
    let fn;
    if (tool === 'move') {
      let delta;
      if (d.ax) {
        const tip = project(add(d.pv, d.ax)), sd = [tip.x - d.sp.x, tip.y - d.sp.y], l2 = sd[0] * sd[0] + sd[1] * sd[1];
        let amt = l2 > 4 ? (dx * sd[0] + dy * sd[1]) / l2 : -dy * worldPerPixel(d.pv);
        if (snap) amt = Math.round(amt / 0.25) * 0.25;
        delta = mul(d.ax, amt);
      } else {
        const { r, u } = camBasis(), k = worldPerPixel(d.pv);
        delta = add(mul(r, dx * k), mul(u, -dy * k));
        if (snap) delta = delta.map((c) => Math.round(c / 0.25) * 0.25);
      }
      fn = (p) => add(p, delta);
      setInfo(`Move ${delta.map((c) => c.toFixed(2)).join(', ')}`);
    } else if (tool === 'rotate') {
      let ang = (dx - dy) * 0.012;
      if (snap) ang = Math.round(ang / (15 * DEG)) * 15 * DEG;
      const a = d.ax || camBasis().f.map((c) => -c);
      fn = (p) => add(d.pv, rotate(sub(p, d.pv), a, ang));
      d.ang = ang;
      setInfo(`Rotate ${(ang / DEG).toFixed(0)}°`);
    } else {
      let f = Math.exp((dx - dy) * 0.006);
      if (snap) f = Math.max(0.25, Math.round(f * 4) / 4);
      const a = d.ax;
      fn = (p) => { const v = sub(p, d.pv); if (!a) return add(d.pv, mul(v, f)); const along = dot(v, a); return add(add(d.pv, sub(v, mul(a, along))), mul(a, along * f)); };
      d.f = f;
      setInfo(`Scale ×${f.toFixed(2)}`);
    }
    if (mode === 'edit') {
      const Minv = M4.invert(d.M);
      const picked = new Set(d.ids);
      for (const i of d.ids) {
        const j = d.mir?.get(i);
        if (j != null && j !== i && picked.has(j) && j < i) continue; // its twin already set both
        const np = tp(Minv, fn(tp(d.M, d.orig.verts[i])));
        q.verts[i] = j === i ? [0, np[1], np[2]] : np;
        if (j != null && j !== i) q.verts[j] = [-np[0], np[1], np[2]];
      }
    } else {
      const o = d.orig;
      if (tool === 'move') { const np = fn([o.x || 0, o.y || 0, o.z || 0]); q.x = r4(np[0]); q.y = r4(np[1]); q.z = r4(np[2]); }
      else if (tool === 'rotate') { const k = axis === 'x' ? 'rx' : axis === 'z' ? 'rz' : 'ry'; q[k] = Math.round(((o[k] || 0) + d.ang / DEG) * 10) / 10; }
      else {
        const f = d.f, sc = (k, dflt) => { q[k] = r4(Math.max(0.01, (o[k] ?? dflt) * f)); };
        if (isMesh(q)) { if (!d.ax || axis === 'x') sc('sx', 1); if (!d.ax || axis === 'y') sc('sy', 1); if (!d.ax || axis === 'z') sc('sz', 1); }
        else if (q.geometry === 'sphere') sc('r', 0.5);
        else if (q.geometry === 'cylinder' || q.geometry === 'cone') { if (!d.ax || axis !== 'y') sc('r', 0.5); if (!d.ax || axis === 'y') sc('h', 1); }
        else { if (!d.ax || axis === 'x') sc('w', 1); if (!d.ax || axis === 'y') sc('h', 1); if (!d.ax || axis === 'z') sc('d', 1); }
      }
    }
  }

  // ---------- gestures ----------
  const ptrs = new Map();
  let pinch = null;
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    ptrs.set(e.pointerId, { x, y });
    if (ptrs.size === 2) {
      if (drag?.kind === 'xf') { restore(undo.pop()); syncUndo(); }
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: cam.dist, target: [...cam.target] };
      drag = null; return;
    }
    if (ptrs.size > 2) return;
    // start on the handle or on the selection → transform; otherwise orbit (decided once the finger moves)
    const onHandle = handle && Math.hypot(handle.x - x, handle.y - y) < 34;
    let onSel = false;
    if (!onHandle && cur()) {
      if (mode === 'edit') { const v = pickVert(x, y, 22); onSel = selMode === 'vert' ? v >= 0 && selV.has(v) : selF.has(pickFace(x, y)); }
      else onSel = pickPart(x, y) === sel;
    }
    drag = { kind: 'pending', x, y, t: performance.now(), grab: onHandle || onSel, yaw: cam.yaw, pitch: cam.pitch };
  });
  view.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const [x, y] = local(e);
    ptrs.set(e.pointerId, { x, y });
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()], dd = Math.hypot(a.x - b.x, a.y - b.y);
      cam.dist = Math.max(0.5, Math.min(80, pinch.dist * pinch.d / (dd || 1)));
      const { r, u } = camBasis(), k = worldPerPixel(cam.target);
      const mx = (a.x + b.x) / 2 - pinch.mx, my = (a.y + b.y) / 2 - pinch.my;
      cam.target = add(add(pinch.target, mul(r, -mx * k)), mul(u, my * k));
      applyCam(); return;
    }
    if (!drag) return;
    if (drag.kind === 'pending') {
      if (Math.hypot(x - drag.x, y - drag.y) < 8) return;
      if (drag.grab && beginTransform(drag.x, drag.y)) { /* now transforming */ } else drag = { kind: 'orbit', x: drag.x, y: drag.y, yaw: cam.yaw, pitch: cam.pitch };
    }
    if (drag.kind === 'xf') updateTransform(x, y);
    else if (drag.kind === 'orbit') {
      cam.yaw = drag.yaw - (x - drag.x) * 0.01; cam.pitch = Math.max(-1.5, Math.min(1.5, drag.pitch + (y - drag.y) * 0.008));
      applyCam();
    }
  });
  const up = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (pinch) { if (ptrs.size < 2) pinch = null; drag = null; return; }
    const d = drag; drag = null;
    if (!d) return;
    if (d.kind === 'xf') { emit(); renderPanel(); setInfo(); return; }
    if (d.kind === 'pending' && e.type !== 'pointercancel') tapAt(d.x, d.y);
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(0.5, Math.min(80, cam.dist * Math.exp(e.deltaY * 0.001))); applyCam(); }, { passive: false });

  let lastTap = { t: 0, i: -2 };
  function tapAt(x, y) {
    if (mode === 'object') {
      const i = pickPart(x, y), now = performance.now();
      if (i >= 0 && i === lastTap.i && now - lastTap.t < 350 && isMesh(parts[i])) { sel = i; setMode('edit'); return; } // double tap a mesh: edit it
      lastTap = { t: now, i };
      if (i !== sel) { sel = i; render(); }
      return;
    }
    if (selMode === 'vert') {
      const v = pickVert(x, y);
      if (v >= 0) { selV.has(v) ? selV.delete(v) : selV.add(v); buzz(5); renderPanel(); }
    } else {
      const f = pickFace(x, y);
      if (f >= 0) { selF.has(f) ? selF.delete(f) : selF.add(f); buzz(5); renderPanel(); }
    }
  }

  // ---------- operations ----------
  const needMesh = () => { const m = editMesh(); if (!m) toast('Select an editable mesh first'); return m; };
  const facesSel = (m) => (selMode === 'face' ? selF : MO.facesFromVerts(m, selVerts()));
  function op(fn, msg) { const m = needMesh(); if (!m) return; push(); const r = fn(m); emit(); render(); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); }
  const setSelFaces = (fs) => { selF = new Set(fs); if (selMode === 'vert') selV = MO.faceVerts(editMesh(), selF); };
  const OPS = {
    all: () => { const m = needMesh(); if (!m) return; if (selMode === 'vert') selV = new Set(m.verts.map((_, i) => i)); else selF = new Set(m.faces.map((_, i) => i)); render(); },
    none: () => { selV.clear(); selF.clear(); render(); },
    grow: () => { const m = needMesh(); if (!m) return; if (selMode === 'vert') selV = MO.growVerts(m, selV); else selF = MO.growFaces(m, selF); render(); },
    extrude: () => op((m) => { const fs = facesSel(m); if (!fs.size) { toast('Select faces to extrude'); return; } setSelFaces(MO.extrude(m, fs, 0.25)); tool = 'move'; axis = 'normal'; }, 'Extruded: drag the handle to pull it'),
    inset: () => op((m) => { const fs = facesSel(m); if (!fs.size) { toast('Select faces to inset'); return; } setSelFaces(MO.inset(m, fs, 0.25)); }),
    subdivide: () => op((m) => { const fs = facesSel(m); setSelFaces(fs.size ? MO.subdivide(m, fs) : (MO.subdivide(m), [])); }, 'Subdivided'),
    smooth: () => op((m) => MO.smooth(m, selVerts(), 0.5), 'Smoothed'),
    merge: () => op((m) => { const vs = selVerts(); if (vs.size < 2) { toast('Select 2 or more vertices'); return; } selV = MO.merge(m, vs); selF.clear(); }, 'Merged'),
    fill: () => op((m) => { const f = MO.fill(m, selVerts()); if (f < 0) toast('Select 3 or more vertices'); else { selF = new Set([f]); } }),
    remove: () => op((m) => { if (selMode === 'face') MO.deleteFaces(m, selF); else MO.deleteVerts(m, selVerts()); selV.clear(); selF.clear(); }, 'Deleted'),
    flip: () => op((m) => MO.flip(m, facesSel(m)), 'Flipped'),
    paint: (c) => op((m) => { const fs = facesSel(m); if (!fs.size) { toast('Select faces to paint'); return; } for (const f of fs) m.faces[f].c = c; }),
  };

  function addPart(kind, label) {
    push();
    let q;
    const at = cam.target.map((c) => Math.round(c * 4) / 4);
    if (kind.startsWith('mesh:')) { const gen = PRIMS.find((p) => p[0] === kind.slice(5))[1]; q = { geometry: 'mesh', ...gen(), color: '#b0bec5', x: at[0], y: Math.max(0.5, at[1]), z: at[2] }; }
    else q = { geometry: kind, x: at[0], y: Math.max(0.5, at[1]), z: at[2], w: 1, h: 1, d: 1, r: 0.5, color: '#90caf9' };
    parts.push(q); sel = parts.length - 1;
    emit(); render(); toast(`Added ${label}`);
  }
  /** Turn a primitive part into an editable mesh with the same shape and size. */
  function makeEditable() {
    const q = cur(); if (!q || isMesh(q)) return;
    push();
    const [w, hh, d] = partSize(q), g = q.geometry || 'box';
    const m = g === 'box' ? MO.makeCube(w, hh, d) : g === 'plane' ? MO.makePlane(w, d)
      : g === 'cylinder' ? MO.makeCylinder(16, w / 2, hh) : g === 'cone' ? MO.makeCylinder(16, w / 2, hh, true)
        : g === 'sphere' ? MO.makeSphere(16, 10, w / 2) : (() => { const t = primTris(g); return { verts: t.verts.map((p) => [p[0] * w, p[1] * hh, p[2] * d]), faces: t.faces.map((f) => ({ v: [...f.v] })) }; })();
    const nq = { geometry: 'mesh', verts: m.verts, faces: m.faces, x: q.x || 0, y: q.y || 0, z: q.z || 0, rx: q.rx || 0, ry: q.ry || 0, rz: q.rz || 0, color: q.color || '#cccccc', ...(q.emissive ? { emissive: q.emissive } : {}) };
    parts[sel] = nq;
    emit(); setMode('edit'); toast('Now editable: pick vertices or faces');
  }
  function duplicate() { const q = cur(); if (!q) return; push(); const c = JSON.parse(JSON.stringify(q)); c.x = (c.x || 0) + 0.5; parts.push(c); sel = parts.length - 1; emit(); render(); }
  function removePart() { if (!cur()) return; push(); parts.splice(sel, 1); sel = Math.min(sel, parts.length - 1); emit(); render(); }
  function mirrorPart() {
    const q = cur(); if (!q) return; push();
    const c = JSON.parse(JSON.stringify(q)); c.x = -(c.x || 0); c.ry = -(c.ry || 0); c.rz = -(c.rz || 0);
    if (isMesh(c)) { c.verts = c.verts.map((p) => [-p[0], p[1], p[2]]); c.faces.forEach((f) => f.v.reverse()); }
    parts.push(c); sel = parts.length - 1; emit(); render(); toast('Mirrored copy across X');
  }
  function setColor(c) {
    if (mode === 'edit' && editMesh()) return OPS.paint(c);
    const q = cur(); if (!q) return; push(); q.color = c; emit(); render();
  }
  function colorMenu() {
    const box = h('div', { class: 'mo-pal' }, PALETTE.map((c) => h('button', { style: `background:${c}`, onclick: () => { pal.remove(); setColor(c); } })),
      h('label', { class: 'mo-custom' }, 'Custom', h('input', { type: 'color', value: cur()?.color || '#cccccc', onchange: (e) => { pal.remove(); setColor(e.target.value); } })));
    const pal = h('div', { class: 'ne-picker', onpointerdown: (e) => { if (e.target === pal) pal.remove(); } },
      h('div', { class: 'ne-psheet' }, h('div', { class: 'ne-phead' }, h('b', {}, mode === 'edit' ? 'Paint selected faces' : 'Part color'), h('button', { class: 'ne-btn', onclick: () => pal.remove() }, icon('close'))), box));
    root.append(pal);
  }
  function addMenu(anchor) {
    popMenu(anchor, [
      { cap: 'Editable mesh (reshape in Edit mode)' }, ...PRIMS.map(([n]) => ({ icon: 'cube', label: n, fn: () => addPart('mesh:' + n, n) })),
      '-', { cap: 'Simple shape' }, ...SHAPES.map(([g, n]) => ({ icon: 'square', label: n, fn: () => addPart(g, n) })),
      '-', { icon: 'upload', label: 'Import OBJ file…', fn: importOBJ },
    ]);
  }
  function importOBJ() {
    const inp = h('input', { type: 'file', accept: '.obj,text/plain', style: 'display:none' });
    inp.onchange = async () => {
      const file = inp.files[0]; inp.remove(); if (!file) return;
      const m = MO.fromOBJ(await file.text());
      if (!m.faces.length) { toast('No faces found in that file'); return; }
      if (m.faces.length > 6000) { toast('That model is too big for phones (over 6000 faces)'); return; }
      const lo = [0, 1, 2].map((k) => Math.min(...m.verts.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...m.verts.map((p) => p[k])));
      const size = Math.max(...hi.map((v, k) => v - lo[k])) || 1, k = size > 4 || size < 0.2 ? 2 / size : 1;
      m.verts = m.verts.map((p) => [(p[0] - (lo[0] + hi[0]) / 2) * k, (p[1] - lo[1]) * k, (p[2] - (lo[2] + hi[2]) / 2) * k]);
      push(); parts.push({ geometry: 'mesh', ...m, color: '#b0bec5', x: 0, y: 0, z: 0 }); sel = parts.length - 1;
      emit(); render(); fit(); toast(`Imported ${m.faces.length} faces`);
    };
    document.body.append(inp); inp.click();
  }
  function exportOBJ() {
    const groups = parts.map((q, i) => { const M = partMatrix(q), mm = meshOf(q); return { name: `part${i + 1}`, verts: mm.verts.map((p) => tp(M, p)), faces: mm.faces }; });
    const blob = new Blob([MO.toOBJ(groups)], { type: 'text/plain' }), a = h('a', { href: URL.createObjectURL(blob), download: (opts.title || 'model').replace(/\W+/g, '-') + '.obj' });
    document.body.append(a); a.click(); a.remove(); toast('Exported OBJ');
  }
  function viewMenu(anchor) {
    popMenu(anchor, [
      { icon: 'frame', label: 'Frame Everything', fn: fit },
      { icon: 'frame', label: 'Frame Selection', fn: () => { const p = pivot(); if (p) { cam.target = p; applyCam(); } } },
      '-', { icon: 'download', label: 'Export OBJ', fn: exportOBJ }, { icon: 'upload', label: 'Import OBJ…', fn: importOBJ },
    ]);
  }
  function setView(v) {
    if (v === 'Front') { cam.yaw = 0; cam.pitch = 0; } else if (v === 'Side') { cam.yaw = Math.PI / 2; cam.pitch = 0; } else if (v === 'Top') { cam.yaw = 0; cam.pitch = 1.5; } else { cam.yaw = 0.75; cam.pitch = 0.42; }
    applyCam();
  }
  function fit() {
    const all = parts.flatMap((q) => worldVerts(q));
    if (!all.length) return;
    const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k]))), hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])));
    cam.target = lo.map((v, k) => (v + hi[k]) / 2); cam.dist = Math.max(2, len(sub(hi, lo)) * 1.6); applyCam();
  }

  // ---------- panel ----------
  function setMode(m) {
    if (m === 'edit' && !isMesh(cur())) { if (cur()) makeEditable(); else toast('Add or select a part first'); return; }
    mode = m; selV.clear(); selF.clear();
    if (axis === 'normal' && m === 'object') axis = 'free';
    render();
  }
  const seg = (items, val, on) => h('div', { class: 'mo-seg' }, items.map(([v, l]) => h('button', { class: val === v ? 'on' : '', onclick: () => on(v) }, l)));
  const act = (ic, label, fn, cls = '') => h('button', { class: 'mo-act ' + cls, onclick: fn }, icon(ic), h('span', {}, label));
  function setInfo(text) {
    if (text) { info.textContent = text; return; }
    const q = cur();
    if (!q) { info.textContent = parts.length ? 'Tap a part to select it' : 'Add a mesh with +'; return; }
    if (mode === 'edit') { const m = editMesh(); info.textContent = `${m.verts.length} vertices · ${m.faces.length} faces · selected ${selMode === 'face' ? selF.size + ' faces' : selV.size + ' vertices'}`; }
    else info.textContent = `Part ${sel + 1} of ${parts.length} · ${isMesh(q) ? `mesh, ${q.faces.length} faces` : q.geometry || 'box'}`;
  }
  function renderPanel() {
    const q = cur();
    rows.replaceChildren(
      h('div', { class: 'mo-row' },
        seg([['object', 'Object'], ['edit', 'Edit']], mode, setMode),
        mode === 'edit' && seg([['vert', 'Vertex'], ['face', 'Face']], selMode, (v) => { if (v === selMode) return; const m = editMesh(); if (v === 'face') selF = MO.facesFromVerts(m, selV); else selV = MO.faceVerts(m, selF); selMode = v; if (v === 'vert' && axis === 'normal') axis = 'free'; render(); }),
        mode === 'edit' && h('button', { class: 'mo-tog' + (mirror ? ' on' : ''), onclick: () => { mirror = !mirror; renderPanel(); toast(mirror ? 'X-mirror on: edits copy to the other side' : 'X-mirror off'); } }, 'Mirror X')),
      h('div', { class: 'mo-row' },
        seg([['move', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']], tool, (v) => { tool = v; renderPanel(); }),
        seg([['x', 'X'], ['y', 'Y'], ['z', 'Z'], ['free', 'Free'], ...(mode === 'edit' ? [['normal', 'Normal']] : [])], axis, (v) => { axis = v; renderPanel(); }),
        h('button', { class: 'mo-tog' + (snap ? ' on' : ''), onclick: () => { snap = !snap; renderPanel(); } }, icon('magnet'))),
      h('div', { class: 'mo-row mo-acts' }, mode === 'object' ? [
        act('plus', 'Add', (e) => addMenu(e.currentTarget), 'primary'),
        q && !isMesh(q) && act('edit', 'Make Editable', makeEditable),
        q && isMesh(q) && act('edit', 'Edit Mesh', () => setMode('edit')),
        q && act('copy', 'Duplicate', duplicate),
        q && act('layers', 'Mirror', mirrorPart),
        q && act('brush', 'Color', colorMenu),
        q && isMesh(q) && act('sphere', q.smooth ? 'Flat' : 'Smooth', () => { push(); q.smooth = !q.smooth; emit(); render(); }),
        q && act('trash', 'Delete', removePart, 'danger'),
      ] : [
        act('frame', 'All', OPS.all), act('close', 'None', OPS.none), act('plus', 'Grow', OPS.grow),
        act('upload', 'Extrude', OPS.extrude, 'primary'), act('square', 'Inset', OPS.inset), act('grid', 'Subdivide', OPS.subdivide),
        act('circle', 'Smooth', OPS.smooth), act('magnet', 'Merge', OPS.merge), act('triangle', 'Fill', OPS.fill),
        act('brush', 'Paint', colorMenu), act('rotate', 'Flip', OPS.flip), act('trash', 'Delete', OPS.remove, 'danger'),
      ]));
    setInfo();
    hint.textContent = mode === 'object' ? 'Tap a part · drag it (or the round handle) to transform · drag empty space to orbit · pinch to zoom'
      : selMode === 'vert' ? 'Tap vertices to select · drag the handle to transform · Mirror X edits both sides' : 'Tap faces to select · Extrude, then drag the handle out';
  }
  function render() { renderPanel(); }

  // ---------- open / close ----------
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    engine.destroy(); root.remove();
    opts.onClose?.();
  }
  render(); syncUndo();
  requestAnimationFrame(() => { engine.resize(); fit(); });
  if (parts.length && isMesh(parts[0]) && opts.edit) setMode('edit');
  return { close };
}
