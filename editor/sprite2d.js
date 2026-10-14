// 2D Sprite Editor: a full-screen, touch-first drawing workspace for sprites (the 2D cousin of the 3D Modeler).
// Shapes are parts you move, scale, rotate, recolour, reorder and reshape point by point; pen and brush draw your own
// shapes; pixel layers paint pixel art; frames make an animation (saved as a sprite sheet). It saves a picture plus the
// editable drawing, so the sprite works everywhere a picture does and can be opened again later.
import { icon } from './icons.js';

const PALETTE = ['#ffffff', '#c7c7c7', '#7a7a7a', '#2b2b2b', '#000000', '#ff4d5e', '#ff8a3d', '#ffd23f', '#9be15d', '#2ecc71', '#1abc9c', '#33f0ff', '#3d8bfd', '#7c4dff', '#e056fd', '#ff7eb6', '#8d6e63', '#ffccaa', '#f5d6a0', '#5d4037'];
const ADD = [
  ['rect', 'Box', 'square'], ['round', 'Rounded', 'square'], ['ellipse', 'Circle', 'circle'], ['triangle', 'Triangle', 'triangle'], ['star', 'Star', 'star'],
  ['polygon', 'Polygon', 'polygon'], ['heart', 'Heart', 'heart'], ['line', 'Line', 'edge'], ['text', 'Text / Emoji', 'text'], ['pixels', 'Pixel Layer', 'grid'], ['image', 'Picture', 'image'],
];
const TOOLS = [['select', 'Select & move', 'select'], ['points', 'Edit points', 'polygon'], ['pen', 'Pen (tap points)', 'edit'], ['brush', 'Brush (draw freely)', 'brush'],
  ['pencil', 'Pixel pencil', 'grid'], ['eraser', 'Eraser', 'trash'], ['fill', 'Fill bucket', 'bulb'], ['picker', 'Colour picker', 'target']];
const TYPE_NAME = { rect: 'Box', ellipse: 'Circle', triangle: 'Triangle', star: 'Star', polygon: 'Polygon', heart: 'Heart', path: 'Shape', line: 'Line', text: 'Text', pixels: 'Pixels', image: 'Picture' };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r2 = (v) => Math.round(v * 100) / 100;
const DEG = Math.PI / 180;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function newDrawing(w = 64, h = 64) { return { w, h, pixel: false, fps: 8, frames: [{ clip: 'idle', parts: [] }] }; }

// ---------- rendering (shared by the editor and the saved picture) ----------
const imgs = new Map(); let imgListener = null;
function getImg(src) {
  if (!imgs.has(src)) { const im = new Image(); im.onload = () => imgListener?.(); im.src = src; imgs.set(src, im); }
  return imgs.get(src);
}
function traceSmooth(P, pts, closed, smooth) {
  if (!pts.length) return;
  if (!smooth || pts.length < 3) { pts.forEach(([x, y], i) => (i ? P.lineTo(x, y) : P.moveTo(x, y))); if (closed) P.closePath(); return; }
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    const m0 = mid(pts[n - 1], pts[0]); P.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) { const c = pts[i], m = mid(c, pts[(i + 1) % n]); P.quadraticCurveTo(c[0], c[1], m[0], m[1]); }
    P.closePath();
  } else {
    P.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const m = mid(pts[i], pts[i + 1]); P.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    P.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}
/** A part's outline in its own box, centred on 0,0. Path / line points are stored 0–1 across the box, so scaling the box reshapes them. */
function partPath(p) {
  const P = new Path2D(), w = p.w, h = p.h, hw = w / 2, hh = h / 2;
  switch (p.type) {
    case 'rect': { const r = clamp(+p.radius || 0, 0, Math.min(hw, hh)); if (P.roundRect) P.roundRect(-hw, -hh, w, h, r); else P.rect(-hw, -hh, w, h); break; }
    case 'ellipse': P.ellipse(0, 0, Math.abs(hw), Math.abs(hh), 0, 0, Math.PI * 2); break;
    case 'triangle': P.moveTo(0, -hh); P.lineTo(hw, hh); P.lineTo(-hw, hh); P.closePath(); break;
    case 'polygon': case 'star': {
      const n = clamp(Math.round(+p.sides || 5), 3, 24), star = p.type === 'star', inner = +p.inner || 0.45, k = star ? n * 2 : n;
      for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i * Math.PI * 2) / k, m = star && i % 2 ? inner : 1, x = Math.cos(a) * hw * m, y = Math.sin(a) * hh * m; if (i) P.lineTo(x, y); else P.moveTo(x, y); }
      P.closePath(); break;
    }
    case 'heart': P.moveTo(0, hh * 0.95); P.bezierCurveTo(-hw * 1.3, hh * 0.1, -hw * 0.75, -hh * 1.15, 0, -hh * 0.45); P.bezierCurveTo(hw * 0.75, -hh * 1.15, hw * 1.3, hh * 0.1, 0, hh * 0.95); P.closePath(); break;
    case 'path': case 'line': traceSmooth(P, (p.points || []).map(([x, y]) => [(x - 0.5) * w, (y - 0.5) * h]), p.type === 'path' && p.closed !== false, !!p.smooth); break;
    default: P.rect(-hw, -hh, w, h);
  }
  return P;
}
function paintOf(ctx, p) {
  if (!p.fill2) return p.fill;
  const hw = Math.abs(p.w) / 2, hh = Math.abs(p.h) / 2, d = p.gradDir || 'down';
  const g = d === 'radial' ? ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(hw, hh)) : d === 'right' ? ctx.createLinearGradient(-hw, 0, hw, 0) : d === 'diagonal' ? ctx.createLinearGradient(-hw, -hh, hw, hh) : ctx.createLinearGradient(0, -hh, 0, hh);
  g.addColorStop(0, p.fill); g.addColorStop(1, p.fill2);
  return g;
}
function drawPart(ctx, p) {
  if (p.hidden) return;
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  if (p.rot) ctx.rotate(p.rot * DEG);
  if (p.flipX || p.flipY) ctx.scale(p.flipX ? -1 : 1, p.flipY ? -1 : 1);
  ctx.globalAlpha *= p.opacity ?? 1;
  if (p.cut) ctx.globalCompositeOperation = 'destination-out';
  if (+p.glow > 0) { ctx.shadowColor = p.glowColor || p.fill || p.stroke || '#fff'; ctx.shadowBlur = +p.glow; }
  if (+p.shadowY) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = Math.abs(+p.shadowY); ctx.shadowOffsetY = +p.shadowY; }
  const w = p.w, h = p.h;
  if (p.type === 'pixels') {
    const cw = w / (p.cols || 1), ch = h / (p.rows || 1);
    for (const [k, c] of Object.entries(p.px || {})) { const [cx, cy] = k.split(',').map(Number); ctx.fillStyle = c; ctx.fillRect(-w / 2 + cx * cw, -h / 2 + cy * ch, cw + 0.02, ch + 0.02); } // a hair of overlap hides seams
  } else if (p.type === 'text') {
    const t = String(p.text ?? '⭐');
    ctx.font = `${p.weight || 800} ${Math.abs(h)}px ${p.font || 'system-ui, -apple-system, sans-serif'}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const m = ctx.measureText(t).width || 1; ctx.scale(Math.abs(w) / m, 1);
    if (p.fill) { ctx.fillStyle = paintOf(ctx, p); ctx.fillText(t, 0, h * 0.06); }
    if (p.stroke && +p.lw > 0) { ctx.strokeStyle = p.stroke; ctx.lineWidth = +p.lw; ctx.lineJoin = 'round'; ctx.strokeText(t, 0, h * 0.06); }
  } else if (p.type === 'image') {
    const im = p.src && getImg(p.src); if (im?.complete && im.naturalWidth) ctx.drawImage(im, -w / 2, -h / 2, w, h);
  } else {
    const path = partPath(p);
    if (p.type !== 'line' && p.fill) { ctx.fillStyle = paintOf(ctx, p); ctx.fill(path); }
    if (p.type === 'line' || (p.stroke && +p.lw > 0)) { ctx.shadowBlur = p.type === 'line' ? ctx.shadowBlur : 0; ctx.strokeStyle = p.stroke || p.fill || '#fff'; ctx.lineWidth = +p.lw || 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); }
  }
  ctx.restore();
}
function drawParts(ctx, parts) { for (const p of parts || []) drawPart(ctx, p); }
const outRes = (d) => clamp(Math.round(256 / Math.max(d.w, d.h)), 1, 8);
/** One frame as a canvas, `res` pixels per drawing unit. */
export function renderFrame(d, fi = 0, res = outRes(d)) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(d.w * res)); c.height = Math.max(1, Math.round(d.h * res));
  const g = c.getContext('2d'); g.imageSmoothingEnabled = !d.pixel; g.scale(res, res); drawParts(g, d.frames[fi]?.parts); return c;
}
/** The picture the game uses: one frame, or every frame side by side (a sprite sheet). */
export function renderDrawing(d) {
  const res = outRes(d), n = d.frames.length, fw = Math.round(d.w * res), fh = Math.round(d.h * res);
  const c = document.createElement('canvas'); c.width = fw * n; c.height = fh;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = !d.pixel;
  d.frames.forEach((f, i) => { g.save(); g.translate(i * fw, 0); g.beginPath(); g.rect(0, 0, fw, fh); g.clip(); g.scale(res, res); drawParts(g, f.parts); g.restore(); });
  return { src: c.toDataURL('image/png'), cols: n, clips: clipsOf(d) };
}
/** "idle: 0-1, run: 2-5" from the frames' clip names. */
export function clipsOf(d) {
  const out = []; let start = 0;
  d.frames.forEach((f, i) => { const nx = d.frames[i + 1]; if (!nx || (nx.clip || 'idle') !== (f.clip || 'idle')) { out.push(`${f.clip || 'idle'}: ${start}-${i}`); start = i + 1; } });
  return out.join(', ');
}

// ---------- starter drawings ----------
const S = (type, x, y, w, h, more = {}) => ({ type, x, y, w, h, fill: '#ffd23f', ...more });
const TEMPLATES = {
  Smiley: () => [S('ellipse', 4, 4, 56, 56, { fill: '#ffd23f', stroke: '#c78a00', lw: 3 }), S('ellipse', 19, 20, 7, 11, { fill: '#2b2b2b' }), S('ellipse', 38, 20, 7, 11, { fill: '#2b2b2b' }), { type: 'path', x: 16, y: 36, w: 32, h: 12, points: [[0, 0], [0.5, 1], [1, 0]], smooth: true, closed: false, fill: '', stroke: '#2b2b2b', lw: 4 }],
  Coin: () => [S('ellipse', 6, 6, 52, 52, { fill: '#ffd23f', fill2: '#ff9f1c', gradDir: 'diagonal', stroke: '#b87400', lw: 3 }), S('ellipse', 14, 14, 36, 36, { fill: '', stroke: '#fff3b0', lw: 3, opacity: 0.8 }), S('star', 22, 21, 20, 20, { fill: '#fff3b0', sides: 5 })],
  Tree: () => [S('rect', 27, 40, 10, 22, { fill: '#8d6e63', radius: 2 }), S('ellipse', 8, 6, 48, 42, { fill: '#2ecc71', fill2: '#1b8f4c', gradDir: 'down' }), S('ellipse', 18, 12, 14, 10, { fill: '#9be15d', opacity: 0.6 })],
  Slime: () => [{ type: 'path', x: 6, y: 18, w: 52, h: 40, points: [[0, 1], [0.05, 0.4], [0.5, 0], [0.95, 0.4], [1, 1]], smooth: true, fill: '#9be15d', fill2: '#2ecc71', stroke: '#1b8f4c', lw: 3 }, S('ellipse', 20, 32, 7, 9, { fill: '#2b2b2b' }), S('ellipse', 37, 32, 7, 9, { fill: '#2b2b2b' }), S('ellipse', 16, 24, 10, 6, { fill: '#ffffff', opacity: 0.5 })],
  Button: () => [S('rect', 2, 18, 60, 28, { fill: '#3d8bfd', fill2: '#2160c4', radius: 12, shadowY: 3 }), S('text', 12, 24, 40, 16, { text: 'PLAY', fill: '#ffffff' })],
  Heart: () => [S('heart', 6, 8, 52, 48, { fill: '#ff4d5e', fill2: '#c2185b', gradDir: 'down', stroke: '#8e0e2a', lw: 2 }), S('ellipse', 15, 16, 10, 7, { fill: '#ffffff', opacity: 0.55, rot: -30 })],
};

/** opts: { drawing, title, h, popMenu, toast, buzz, pickImage(cb), onDone({ drawing, src, cols, clips }), onClose() } */
export function openSprite2D(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts;
  let d = clone(opts.drawing || newDrawing());
  if (!d.frames?.length) d.frames = [{ clip: 'idle', parts: [] }];
  let fi = 0, sel = d.frames[0].parts.length ? d.frames[0].parts.length - 1 : -1, tool = 'select', panel = 'add';
  let color = '#ff4d5e', brush = 1, lockRatio = false, snap = !!d.pixel, grid = !!d.pixel, mirror = false, onion = true, playing = null, penPts = null;
  const undo = [], redo = [];
  const parts = () => d.frames[fi].parts;
  const cur = () => parts()[sel] || null;

  // ---------- layout ----------
  const cv = h('canvas', { class: 'sp-cv' });
  const hint = h('div', { class: 'mo-hint' });
  const panelBox = h('div', { class: 'sp-panel' });
  const undoBtn = h('button', { class: 'ne-btn', title: 'Undo', onclick: () => doUndo() }, icon('undo'));
  const redoBtn = h('button', { class: 'ne-btn', title: 'Redo', onclick: () => doRedo() }, icon('redo'));
  const toolBar = h('div', { class: 'sp-tools' });
  const tabs = h('div', { class: 'mo-seg sp-tabs' });
  const root = h('div', { class: 'mo sp' },
    h('div', { class: 'ne-top' },
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('div', { class: 'ne-title' }, h('b', {}, '2D Sprite Editor'), h('small', {}, opts.title || '')),
      undoBtn, redoBtn,
      h('button', { class: 'ne-btn', title: 'More', onclick: (e) => moreMenu(e.currentTarget) }, icon('more'))),
    h('div', { class: 'mo-stage sp-stage' }, cv, toolBar, hint,
      h('div', { class: 'sp-zoom' },
        h('button', { title: 'Zoom out', onclick: () => zoomBy(1 / 1.25) }, icon('minus')),
        h('button', { title: 'Fit', onclick: () => { fit(); draw(); } }, icon('frame')),
        h('button', { title: 'Zoom in', onclick: () => zoomBy(1.25) }, icon('plus')))),
    h('div', { class: 'mo-panel' }, h('div', { class: 'mo-row' }, tabs), panelBox));
  document.body.append(root);
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, view = { z: 4, ox: 0, oy: 0 };
  const scratch = document.createElement('canvas').getContext('2d');

  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(3, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    draw();
  }
  function fit() { const z = Math.min((W - 90) / d.w, (H - 100) / d.h); view.z = Math.max(0.5, z); view.ox = (W - d.w * view.z) / 2 + 24; view.oy = (H - d.h * view.z) / 2 + 18; }
  function zoomBy(k, cx = W / 2, cy = H / 2) { const z = clamp(view.z * k, 0.5, 80); view.ox = cx - (cx - view.ox) * (z / view.z); view.oy = cy - (cy - view.oy) * (z / view.z); view.z = z; draw(); }
  const toArt = (sx, sy) => [(sx - view.ox) / view.z, (sy - view.oy) / view.z];
  const toScr = (ax, ay) => [ax * view.z + view.ox, ay * view.z + view.oy];
  const gridSize = () => (d.pixel ? 1 : Math.max(1, Math.round(Math.min(d.w, d.h) / 16)));
  const snapV = (v) => (snap ? Math.round(v / gridSize()) * gridSize() : r2(v));

  // ---------- history ----------
  function push() { undo.push(JSON.stringify({ d, fi, sel })); if (undo.length > 80) undo.shift(); redo.length = 0; syncUndo(); }
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify({ d, fi, sel })); ({ d, fi, sel } = JSON.parse(undo.pop())); syncUndo(); render(); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify({ d, fi, sel })); ({ d, fi, sel } = JSON.parse(redo.pop())); syncUndo(); render(); }
  function syncUndo() { undoBtn.disabled = !undo.length; redoBtn.disabled = !redo.length; }

  // ---------- geometry helpers ----------
  const center = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  const rotV = ([x, y], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
  const toLocal = (p, [ax, ay]) => { const [cx, cy] = center(p); const [lx, ly] = rotV([ax - cx, ay - cy], -(p.rot || 0) * DEG); return [p.flipX ? -lx : lx, p.flipY ? -ly : ly]; };
  const fromLocal = (p, [lx, ly]) => { const [cx, cy] = center(p); const [x, y] = rotV([p.flipX ? -lx : lx, p.flipY ? -ly : ly], (p.rot || 0) * DEG); return [cx + x, cy + y]; };
  function hitPart(p, a) {
    if (p.hidden || p.locked) return false;
    const [lx, ly] = toLocal(p, a);
    if (['pixels', 'text', 'image'].includes(p.type)) {
      if (Math.abs(lx) > Math.abs(p.w) / 2 || Math.abs(ly) > Math.abs(p.h) / 2) return false;
      if (p.type !== 'pixels') return true;
      const cx = Math.floor((lx + p.w / 2) / (p.w / p.cols)), cy = Math.floor((ly + p.h / 2) / (p.h / p.rows));
      return !!p.px?.[cx + ',' + cy];
    }
    const path = partPath(p);
    if (p.type !== 'line' && p.fill && scratch.isPointInPath(path, lx, ly)) return true;
    scratch.lineWidth = Math.max(+p.lw || 2, 14 / view.z);
    return (p.type === 'line' || p.stroke || !p.fill) && scratch.isPointInStroke(path, lx, ly);
  }
  const pickAt = (a) => { const ps = parts(); for (let i = ps.length - 1; i >= 0; i--) if (hitPart(ps[i], a)) return i; return -1; };
  const handles = (p) => {
    const hw = p.w / 2, hh = p.h / 2;
    return { corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([kx, ky]) => ({ kx, ky, at: toScr(...fromLocal(p, [kx * hw, ky * hh])) })), rot: toScr(...fromLocal(p, [0, -hh - 18 / view.z])) };
  };
  const pathPts = (p) => (p.points || []).map(([x, y]) => toScr(...fromLocal(p, [(x - 0.5) * p.w, (y - 0.5) * p.h])));
  /** Rebuild a path's box around its points (after editing points) so handles stay tight. */
  function refit(p, artPts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of artPts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = Math.max(0.5, x1 - x0), hgt = Math.max(0.5, y1 - y0);
    Object.assign(p, { x: r2(x0), y: r2(y0), w: r2(w), h: r2(hgt), rot: 0, flipX: false, flipY: false, points: artPts.map(([x, y]) => [r2((x - x0) / w), r2((y - y0) / hgt)]) });
  }
  const artPointsOf = (p) => (p.points || []).map(([x, y]) => fromLocal(p, [(x - 0.5) * p.w, (y - 0.5) * p.h]));

  // ---------- pixel layers ----------
  function pixelLayer(create = true) {
    const c = cur(); if (c?.type === 'pixels') return c;
    const ps = parts(); for (let i = ps.length - 1; i >= 0; i--) if (ps[i].type === 'pixels' && !ps[i].hidden && !ps[i].locked) { sel = i; return ps[i]; }
    if (!create) return null;
    const n = d.pixel ? 1 : Math.max(1, Math.round(Math.max(d.w, d.h) / 32));
    const p = { type: 'pixels', name: 'Pixels', x: 0, y: 0, w: d.w, h: d.h, cols: Math.round(d.w / n), rows: Math.round(d.h / n), px: {} };
    ps.push(p); sel = ps.length - 1; return p;
  }
  const cellAt = (p, a) => { const [lx, ly] = toLocal(p, a); return [Math.floor((lx + p.w / 2) / (p.w / p.cols)), Math.floor((ly + p.h / 2) / (p.h / p.rows))]; };
  function paintCell(p, cx, cy, c) {
    const r = brush - 1;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      for (const x of mirror ? [cx + dx, p.cols - 1 - (cx + dx)] : [cx + dx]) {
        const y = cy + dy; if (x < 0 || y < 0 || x >= p.cols || y >= p.rows) continue;
        if (c) p.px[x + ',' + y] = c; else delete p.px[x + ',' + y];
      }
    }
  }
  function floodFill(p, cx, cy, c) {
    if (cx < 0 || cy < 0 || cx >= p.cols || cy >= p.rows) return;
    const from = p.px[cx + ',' + cy] || null; if (from === (c || null)) return;
    const st = [[cx, cy]], seen = new Set();
    while (st.length) {
      const [x, y] = st.pop(), k = x + ',' + y;
      if (x < 0 || y < 0 || x >= p.cols || y >= p.rows || seen.has(k) || (p.px[k] || null) !== from) continue;
      seen.add(k); if (c) p.px[k] = c; else delete p.px[k];
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      if (seen.size > 40000) break;
    }
  }

  // ---------- adding parts ----------
  function addPart(kind) {
    if (kind === 'image') return opts.pickImage?.((src) => { push(); const im = new Image(); im.onload = () => { const k = Math.min(d.w / im.naturalWidth, d.h / im.naturalHeight, 1) * 0.9, w = r2(im.naturalWidth * k), hh = r2(im.naturalHeight * k); parts().push({ type: 'image', name: 'Picture', src, x: r2((d.w - w) / 2), y: r2((d.h - hh) / 2), w, h: hh }); sel = parts().length - 1; render(); }; im.src = src; });
    if (kind === 'pixels') { push(); const ps = parts(), n = d.pixel ? 1 : Math.max(1, Math.round(Math.max(d.w, d.h) / 32)); ps.push({ type: 'pixels', name: 'Pixels', x: 0, y: 0, w: d.w, h: d.h, cols: Math.round(d.w / n), rows: Math.round(d.h / n), px: {} }); sel = ps.length - 1; setTool('pencil'); return; }
    push();
    const s = Math.round(Math.min(d.w, d.h) * 0.5), x = Math.round((d.w - s) / 2), y = Math.round((d.h - s) / 2);
    const base = { x, y, w: s, h: s, fill: color };
    const p = kind === 'round' ? { type: 'rect', radius: Math.round(s / 5), ...base }
      : kind === 'line' ? { type: 'line', x, y: y + s / 2, w: s, h: 0.5, points: [[0, 0.5], [1, 0.5]], fill: '', stroke: color, lw: Math.max(1, Math.round(s / 12)) }
      : kind === 'text' ? { type: 'text', text: '⭐', ...base, h: Math.round(s * 0.8), fill: color }
      : kind === 'star' ? { type: 'star', sides: 5, inner: 0.45, ...base } : kind === 'polygon' ? { type: 'polygon', sides: 6, ...base } : { type: kind, ...base };
    parts().push(p); sel = parts().length - 1; setTool('select'); panel = 'style'; render(); buzz(6);
  }
  function finishPen(closed = true) {
    const pts = penPts; penPts = null;
    if (!pts || pts.length < 2) { render(); return; }
    push();
    const p = { type: pts.length > 2 && closed ? 'path' : 'line', closed, fill: pts.length > 2 && closed ? color : '', stroke: pts.length > 2 && closed ? '' : color, lw: Math.max(1, Math.round(Math.min(d.w, d.h) / 24)) };
    refit(p, pts); parts().push(p); sel = parts().length - 1; panel = 'style'; render();
  }

  // ---------- pointer input ----------
  const ptrs = new Map(); let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    ptrs.set(e.pointerId, [sx, sy]);
    if (ptrs.size === 2) { // pinch: zoom and pan
      if (drag?.pushed && drag.kind !== 'pan') doUndoSoft();
      const [a, b] = [...ptrs.values()]; drag = { kind: 'pinch', dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], z: view.z, ox: view.ox, oy: view.oy }; return;
    }
    if (ptrs.size > 2) return;
    const a = toArt(sx, sy), p = cur();
    drag = { kind: 'pan', start: [sx, sy], last: [sx, sy], ox: view.ox, oy: view.oy, a0: a, moved: false };
    if (tool === 'select') {
      if (p && !p.locked) {
        const hs = handles(p);
        if (Math.hypot(hs.rot[0] - sx, hs.rot[1] - sy) < 22) { push(); drag = { kind: 'rotate', p }; return; }
        const c = hs.corners.find((q) => Math.hypot(q.at[0] - sx, q.at[1] - sy) < 22);
        if (c) { push(); drag = { kind: 'scale', p, kx: c.kx, ky: c.ky, anchor: fromLocal(p, [-c.kx * p.w / 2, -c.ky * p.h / 2]), w0: p.w, h0: p.h }; return; }
      }
      const i = pickAt(a);
      if (i >= 0) { sel = i; push(); drag = { kind: 'move', p: parts()[i], a0: a, x0: parts()[i].x, y0: parts()[i].y, pushed: true }; render(); return; }
      if (sel >= 0) { sel = -1; render(); }
      return;
    }
    if (tool === 'points' && p && (p.type === 'path' || p.type === 'line')) {
      const pts = pathPts(p), vi = pts.findIndex(([x, y]) => Math.hypot(x - sx, y - sy) < 20);
      if (vi >= 0) { push(); drag = { kind: 'vert', p, vi, art: artPointsOf(p) }; drag.selV = vi; selV = vi; draw(); return; }
      const n = pts.length, closed = p.type === 'path' && p.closed !== false;
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const q = pts[(i + 1) % n], m = [(pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2];
        if (Math.hypot(m[0] - sx, m[1] - sy) < 18) { push(); const art = artPointsOf(p); art.splice(i + 1, 0, a); drag = { kind: 'vert', p, vi: i + 1, art }; selV = i + 1; refit(p, art); draw(); return; }
      }
      return;
    }
    if (tool === 'pen') {
      const q = [snapV(a[0]), snapV(a[1])];
      if (penPts?.length > 2) { const f = toScr(...penPts[0]); if (Math.hypot(f[0] - sx, f[1] - sy) < 20) { finishPen(true); return; } }
      (penPts ||= []).push(q); drag = null; renderPanel(); draw(); return;
    }
    if (tool === 'brush') { drag = { kind: 'brush', pts: [a] }; return; }
    if (tool === 'pencil' || tool === 'eraser') {
      push(); const L = pixelLayer(); const [cx, cy] = cellAt(L, a); paintCell(L, cx, cy, tool === 'eraser' ? null : color);
      drag = { kind: 'paint', L, last: [cx, cy] }; draw(); return;
    }
    if (tool === 'fill') {
      const L = pixelLayer(false);
      if (L) { const [cx, cy] = cellAt(L, a); if (cx >= 0 && cy >= 0 && cx < L.cols && cy < L.rows) { push(); floodFill(L, cx, cy, color); draw(); return; } }
      const i = pickAt(a); if (i >= 0) { push(); const q = parts()[i]; if (q.type === 'line') q.stroke = color; else { q.fill = color; delete q.fill2; } sel = i; render(); } else if (!L) { push(); floodFill(pixelLayer(), ...cellAt(cur(), a), color); render(); }
      return;
    }
    if (tool === 'picker') {
      const L = pixelLayer(false); let c = null;
      if (L) { const [cx, cy] = cellAt(L, a); c = L.px[cx + ',' + cy]; }
      if (!c) { const i = pickAt(a); if (i >= 0) c = parts()[i].fill || parts()[i].stroke; }
      if (c) { color = c; toast('Colour ' + c); setTool(L ? 'pencil' : 'select'); }
    }
  });
  let selV = -1;
  const doUndoSoft = () => { if (undo.length) { ({ d, fi, sel } = JSON.parse(undo.pop())); syncUndo(); } };
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const r = cv.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top; ptrs.set(e.pointerId, [sx, sy]);
    if (!drag) return;
    const a = toArt(sx, sy);
    if (drag.kind === 'pinch' && ptrs.size === 2) {
      const [p1, p2] = [...ptrs.values()], dist = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]), mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const z = clamp(drag.z * dist / (drag.dist || 1), 0.5, 80);
      view.ox = mid[0] - (drag.mid[0] - drag.ox) * (z / drag.z); view.oy = mid[1] - (drag.mid[1] - drag.oy) * (z / drag.z); view.z = z; draw(); return;
    }
    if (drag.kind === 'pan') { if (Math.hypot(sx - drag.start[0], sy - drag.start[1]) > 4) drag.moved = true; view.ox = drag.ox + sx - drag.start[0]; view.oy = drag.oy + sy - drag.start[1]; draw(); return; }
    const p = drag.p;
    if (drag.kind === 'move') { p.x = snapV(drag.x0 + a[0] - drag.a0[0]); p.y = snapV(drag.y0 + a[1] - drag.a0[1]); }
    else if (drag.kind === 'rotate') { const [cx, cy] = center(p); let ang = Math.atan2(a[1] - cy, a[0] - cx) / DEG + 90; if (snap) ang = Math.round(ang / 15) * 15; p.rot = r2(((ang % 360) + 540) % 360 - 180); }
    else if (drag.kind === 'scale') {
      const v = rotV([a[0] - drag.anchor[0], a[1] - drag.anchor[1]], -(p.rot || 0) * DEG);
      let w = Math.max(0.5, v[0] * drag.kx * (p.flipX ? -1 : 1)), hh = Math.max(0.5, v[1] * drag.ky * (p.flipY ? -1 : 1));
      if (lockRatio || p.type === 'text') { const k = Math.max(w / drag.w0, hh / drag.h0); w = drag.w0 * k; hh = drag.h0 * k; }
      w = Math.max(0.5, snapV(w)); hh = Math.max(0.5, snapV(hh));
      const off = rotV([drag.kx * w / 2 * (p.flipX ? -1 : 1), drag.ky * hh / 2 * (p.flipY ? -1 : 1)], (p.rot || 0) * DEG);
      p.w = r2(w); p.h = r2(hh); p.x = r2(drag.anchor[0] + off[0] - w / 2); p.y = r2(drag.anchor[1] + off[1] - hh / 2);
    } else if (drag.kind === 'vert') { drag.art[drag.vi] = [snapV(a[0]), snapV(a[1])]; refit(p, drag.art); }
    else if (drag.kind === 'brush') { const l = drag.pts[drag.pts.length - 1]; if (Math.hypot(a[0] - l[0], a[1] - l[1]) * view.z > 4) drag.pts.push(a); }
    else if (drag.kind === 'paint') {
      const [cx, cy] = cellAt(drag.L, a), [lx, ly] = drag.last, n = Math.max(Math.abs(cx - lx), Math.abs(cy - ly));
      for (let i = 1; i <= n; i++) paintCell(drag.L, Math.round(lx + (cx - lx) * i / n), Math.round(ly + (cy - ly) * i / n), tool === 'eraser' ? null : color);
      drag.last = [cx, cy];
    }
    draw();
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (!drag) return;
    if (drag.kind === 'pinch') { if (!ptrs.size) drag = null; return; }
    if (drag.kind === 'brush' && drag.pts.length > 1) {
      push(); const p = { type: 'line', fill: '', stroke: color, lw: Math.max(1, brush * Math.max(1, Math.round(Math.min(d.w, d.h) / 32))), smooth: true };
      refit(p, drag.pts); parts().push(p); sel = parts().length - 1;
    }
    if (drag.kind === 'move' && drag.p.x === drag.x0 && drag.p.y === drag.y0) undo.pop(), syncUndo(); // a tap that only selected
    drag = null; render();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });

  // ---------- drawing the stage ----------
  let checker = null;
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#1f2023'; g.fillRect(0, 0, W, H);
    const z = view.z;
    if (!checker) { const c = document.createElement('canvas'); c.width = c.height = 16; const q = c.getContext('2d'); q.fillStyle = '#d9d9d9'; q.fillRect(0, 0, 16, 16); q.fillStyle = '#b8b8b8'; q.fillRect(0, 0, 8, 8); q.fillRect(8, 8, 8, 8); checker = g.createPattern(c, 'repeat'); }
    g.save(); g.translate(view.ox, view.oy);
    g.fillStyle = checker; g.fillRect(0, 0, d.w * z, d.h * z);
    if (d.bg) { g.fillStyle = d.bg; g.fillRect(0, 0, d.w * z, d.h * z); }
    g.beginPath(); g.rect(0, 0, d.w * z, d.h * z); g.clip(); g.scale(z, z); g.imageSmoothingEnabled = !d.pixel;
    if (onion && fi > 0 && !playing) { g.globalAlpha = 0.28; drawParts(g, d.frames[fi - 1].parts); g.globalAlpha = 1; }
    drawParts(g, (playing ? d.frames[playing.f] : d.frames[fi]).parts);
    if (grid && z * gridSize() >= 6) {
      g.lineWidth = 1 / z; g.strokeStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); const s = gridSize();
      for (let x = s; x < d.w; x += s) { g.moveTo(x, 0); g.lineTo(x, d.h); }
      for (let y = s; y < d.h; y += s) { g.moveTo(0, y); g.lineTo(d.w, y); }
      g.stroke();
    }
    if (mirror) { g.strokeStyle = 'rgba(255,77,94,0.7)'; g.lineWidth = 1.5 / z; g.setLineDash([4 / z, 4 / z]); g.beginPath(); g.moveTo(d.w / 2, 0); g.lineTo(d.w / 2, d.h); g.stroke(); g.setLineDash([]); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(view.ox - 0.5, view.oy - 0.5, d.w * z + 1, d.h * z + 1);
    const p = cur();
    if (p && !playing) { // selection box, corner handles and the rotate knob
      const hs = handles(p), cs = hs.corners.map((c) => c.at);
      g.strokeStyle = p.locked ? '#f7a02c' : '#4c8bd6'; g.lineWidth = 1.5; g.beginPath(); cs.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      if (tool === 'select' && !p.locked) {
        const top = toScr(...fromLocal(p, [0, -p.h / 2])); g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(hs.rot[0], hs.rot[1]); g.stroke();
        g.fillStyle = '#fff'; for (const [x, y] of cs) { g.beginPath(); g.rect(x - 7, y - 7, 14, 14); g.fill(); g.stroke(); }
        g.beginPath(); g.arc(hs.rot[0], hs.rot[1], 8, 0, Math.PI * 2); g.fillStyle = '#4c8bd6'; g.fill();
      }
      if (tool === 'points' && (p.type === 'path' || p.type === 'line')) {
        const pts = pathPts(p), n = pts.length, closed = p.type === 'path' && p.closed !== false;
        g.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < (closed ? n : n - 1); i++) { const q = pts[(i + 1) % n]; g.beginPath(); g.arc((pts[i][0] + q[0]) / 2, (pts[i][1] + q[1]) / 2, 5, 0, Math.PI * 2); g.fill(); }
        pts.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fillStyle = i === selV ? '#f7a02c' : '#fff'; g.fill(); g.strokeStyle = '#4c8bd6'; g.stroke(); });
      }
    }
    if (penPts?.length) {
      const pts = penPts.map((q) => toScr(...q)); g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      pts.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, i ? 5 : 9, 0, Math.PI * 2); g.fillStyle = i ? '#fff' : '#f7a02c'; g.fill(); });
    }
    if (drag?.kind === 'brush') { const pts = drag.pts.map((q) => toScr(...q)); g.strokeStyle = color; g.lineWidth = Math.max(2, brush * 2); g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
    hint.textContent = HINTS[tool] + (p ? ` · ${p.name || TYPE_NAME[p.type] || p.type}` : '');
  }
  imgListener = draw;
  const HINTS = {
    select: 'Tap a part to select · drag to move · corners scale · round knob rotates · drag empty space or pinch to pan and zoom',
    points: 'Drag a point to reshape · tap a small dot to add a point',
    pen: 'Tap to place points · tap the orange first point to close the shape',
    brush: 'Draw freely with your finger',
    pencil: 'Paint pixels on the pixel layer', eraser: 'Erase pixels', fill: 'Fill an area of pixels, or tap a shape to recolour it', picker: 'Tap a colour to use it',
  };

  // ---------- panels ----------
  function setTool(t) { if (t !== 'pen' && penPts) finishPen(true); tool = t; selV = -1; if (['pencil', 'eraser', 'fill', 'picker'].includes(t)) panel = 'style'; render(); }
  function renderTools() {
    toolBar.replaceChildren(...TOOLS.map(([k, label, ic]) => h('button', { class: tool === k ? 'on' : '', title: label, 'aria-label': label, onclick: () => setTool(k) }, icon(ic))));
  }
  function renderTabs() {
    tabs.replaceChildren(...[['add', 'Add'], ['style', 'Style'], ['layers', `Layers ${parts().length}`], ['frames', `Frames ${d.frames.length}`]].map(([k, l]) => h('button', { class: panel === k ? 'on' : '', onclick: () => { panel = k; renderPanel(); renderTabs(); } }, l)));
  }
  const row = (...kids) => h('div', { class: 'mo-row' }, kids);
  const swatches = (cur2, set, { none = false } = {}) => h('div', { class: 'sp-sw' },
    none && h('button', { class: 'sp-none' + (!cur2 ? ' on' : ''), title: 'None', onclick: () => set('') }, '∅'),
    h('label', { class: 'sp-pick', title: 'Any colour' }, h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(cur2 || '') ? cur2 : '#ffffff', oninput: (e) => set(e.target.value, true), onchange: () => renderPanel() }), h('span', { style: `background:${cur2 || 'transparent'}` })),
    PALETTE.map((c) => h('button', { class: c === cur2 ? 'on' : '', style: `background:${c}`, title: c, onclick: () => set(c) })));
  const num = (label, val, set, { min = -9999, max = 9999, step = 1 } = {}) => h('label', { class: 'sp-num' }, h('span', {}, label),
    h('input', { type: 'number', inputMode: 'decimal', step, value: val ?? 0, onfocus: () => push(), oninput: (e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) { set(clamp(n, min, max)); draw(); } }, onchange: () => render() }));
  const tog = (label, on, fn, ic) => h('button', { class: 'mo-tog' + (on ? ' on' : ''), onclick: fn }, ic ? icon(ic) : null, label);
  const act = (label, ic, fn, cls = '') => h('button', { class: 'mo-act ' + cls, onclick: fn }, icon(ic), label);
  const edit = (fn) => { push(); fn(); render(); };

  function renderPanel() {
    const p = cur();
    if (panel === 'add') {
      panelBox.replaceChildren(
        row(...ADD.map(([k, l, ic]) => act(l, ic, () => addPart(k)))),
        row(h('span', { class: 'sp-lab' }, 'Colour'), swatches(color, (c) => { color = c; renderPanel(); })),
        penPts ? row(act('Finish shape', 'check', () => finishPen(true), 'primary'), act('Open line', 'edge', () => finishPen(false)), act('Cancel', 'close', () => { penPts = null; render(); })) : null,
        row(h('span', { class: 'sp-lab' }, 'Start from'), ...Object.keys(TEMPLATES).map((k) => h('button', { class: 'mo-tog', onclick: () => edit(() => { const t = TEMPLATES[k](), k2 = Math.min(d.w, d.h) / 64; for (const q of t) { q.x *= k2; q.y *= k2; q.w *= k2; q.h *= k2; if (q.lw) q.lw *= k2; } parts().push(...t); sel = parts().length - 1; }) }, k))));
      return;
    }
    if (panel === 'style') {
      if (['pencil', 'eraser', 'fill', 'picker'].includes(tool) || p?.type === 'pixels') {
        const L = p?.type === 'pixels' ? p : null;
        panelBox.replaceChildren(
          row(h('span', { class: 'sp-lab' }, 'Paint'), swatches(color, (c) => { color = c; renderPanel(); })),
          row(h('span', { class: 'sp-lab' }, 'Brush'), h('div', { class: 'mo-seg' }, [1, 2, 3].map((n) => h('button', { class: brush === n ? 'on' : '', onclick: () => { brush = n; renderPanel(); } }, n + '×'))),
            tog('Mirror', mirror, () => { mirror = !mirror; render(); }, 'scale'), tog('Grid', grid, () => { grid = !grid; render(); }, 'grid'),
            L && act('Clear layer', 'trash', () => edit(() => { L.px = {}; }), 'danger'),
            L && num('Columns', L.cols, (v) => { L.cols = Math.round(v); }, { min: 1, max: 256 }), L && num('Rows', L.rows, (v) => { L.rows = Math.round(v); }, { min: 1, max: 256 })),
          row(...TOOLS.slice(4).map(([k, l, ic]) => act(l.replace('Pixel p', 'P'), ic, () => setTool(k), tool === k ? 'primary' : ''))));
        return;
      }
      if (!p) { panelBox.replaceChildren(h('p', { class: 'mo-info' }, 'Select a part to style it, or Add one.')); return; }
      const isLine = p.type === 'line', set = (k) => (v, live) => { if (!live) push(); if (v === '' || v == null) delete p[k]; else p[k] = v; draw(); if (!live) render(); };
      panelBox.replaceChildren(
        p.type === 'text' && row(h('label', { class: 'sp-num wide' }, h('span', {}, 'Text'), h('input', { type: 'text', value: p.text ?? '', onfocus: () => push(), oninput: (e) => { p.text = e.target.value; draw(); } })),
          h('select', { class: 'sp-sel', onchange: (e) => edit(() => { p.font = e.target.value; }) }, [['', 'Bold'], ['Georgia, serif', 'Serif'], ['"Courier New", monospace', 'Mono'], ['"Comic Sans MS", "Chalkboard SE", cursive', 'Comic'], ['Impact, sans-serif', 'Impact']].map(([v, l]) => h('option', { value: v, selected: (p.font || '') === v }, l)))),
        !isLine && p.type !== 'image' && row(h('span', { class: 'sp-lab' }, 'Fill'), swatches(p.fill, set('fill'), { none: true })),
        !isLine && p.type !== 'image' && p.fill && row(h('span', { class: 'sp-lab' }, 'Gradient'), swatches(p.fill2, set('fill2'), { none: true }),
          p.fill2 && h('select', { class: 'sp-sel', onchange: (e) => edit(() => { p.gradDir = e.target.value; }) }, [['down', '↓'], ['right', '→'], ['diagonal', '↘'], ['radial', '◎']].map(([v, l]) => h('option', { value: v, selected: (p.gradDir || 'down') === v }, l)))),
        p.type !== 'image' && row(h('span', { class: 'sp-lab' }, isLine ? 'Colour' : 'Outline'), swatches(p.stroke, set('stroke'), { none: !isLine }), (p.stroke || isLine) && num('Width', p.lw ?? 2, (v) => { p.lw = v; }, { min: 0, max: 64, step: 0.5 })),
        row(
          num('X', p.x, (v) => { p.x = v; }), num('Y', p.y, (v) => { p.y = v; }), num('W', p.w, (v) => { p.w = Math.max(0.5, v); }, { min: 0.5 }), num('H', p.h, (v) => { p.h = Math.max(0.5, v); }, { min: 0.5 }),
          num('Turn°', p.rot || 0, (v) => { p.rot = v; }, { min: -360, max: 360, step: 5 }),
          num('Opacity %', Math.round((p.opacity ?? 1) * 100), (v) => { p.opacity = v / 100; }, { min: 0, max: 100, step: 5 })),
        row(
          p.type === 'rect' && num('Corners', p.radius || 0, (v) => { p.radius = v; }, { min: 0, max: 999 }),
          (p.type === 'polygon' || p.type === 'star') && num(p.type === 'star' ? 'Points' : 'Sides', p.sides || 5, (v) => { p.sides = Math.round(v); }, { min: 3, max: 24 }),
          p.type === 'star' && num('Inner %', Math.round((p.inner || 0.45) * 100), (v) => { p.inner = v / 100; }, { min: 5, max: 95, step: 5 }),
          (p.type === 'path' || isLine) && tog('Smooth', !!p.smooth, () => edit(() => { p.smooth = !p.smooth; })),
          p.type === 'path' && tog('Closed', p.closed !== false, () => edit(() => { p.closed = p.closed === false; })),
          (p.type === 'path' || isLine) && act('Edit points', 'polygon', () => setTool('points'), tool === 'points' ? 'primary' : ''),
          !['path', 'line', 'pixels', 'image', 'text'].includes(p.type) && act('To points', 'polygon', () => edit(() => toPath(p))),
          num('Glow', p.glow || 0, (v) => { p.glow = v; }, { min: 0, max: 60 }), num('Shadow', p.shadowY || 0, (v) => { p.shadowY = v; }, { min: -30, max: 30 })),
        row(
          act('Flip ↔', 'scale', () => edit(() => { p.flipX = !p.flipX; })), act('Flip ↕', 'scale', () => edit(() => { p.flipY = !p.flipY; })),
          act('Cut out', 'close', () => edit(() => { p.cut = !p.cut; }), p.cut ? 'primary' : ''),
          act('Front', 'upload', () => edit(() => { parts().push(parts().splice(sel, 1)[0]); sel = parts().length - 1; })),
          act('Back', 'download', () => edit(() => { parts().unshift(parts().splice(sel, 1)[0]); sel = 0; })),
          act('Centre', 'target', () => edit(() => { p.x = r2((d.w - p.w) / 2); p.y = r2((d.h - p.h) / 2); })),
          act('Copy', 'copy', () => edit(() => { const c = clone(p); c.x += 2; c.y += 2; parts().splice(sel + 1, 0, c); sel++; })),
          act('Mirror copy', 'layers', () => edit(() => { const c = clone(p); c.flipX = !c.flipX; c.x = r2(d.w - p.x - p.w); c.rot = -(p.rot || 0); parts().splice(sel + 1, 0, c); sel++; })),
          act('Delete', 'trash', () => edit(() => { parts().splice(sel, 1); sel = Math.min(sel, parts().length - 1); }), 'danger')));
      return;
    }
    if (panel === 'layers') {
      const ps = parts();
      panelBox.replaceChildren(h('div', { class: 'sp-layers' }, ps.length ? [...ps].map((q, i) => [q, i]).reverse().map(([q, i]) => h('div', { class: 'sp-layer' + (i === sel ? ' on' : '') + (q.hidden ? ' off' : ''), onclick: () => { sel = i; setTool(q.type === 'pixels' ? 'pencil' : 'select'); } },
        mkThumb(40, [q], 'sp-lthumb'),
        h('b', {}, q.name || TYPE_NAME[q.type] || q.type), q.cut ? h('small', {}, 'cut-out') : null,
        h('button', { title: q.hidden ? 'Show' : 'Hide', onclick: (e) => { e.stopPropagation(); edit(() => { q.hidden = !q.hidden; }); } }, icon(q.hidden ? 'eyeoff' : 'eye')),
        h('button', { title: q.locked ? 'Unlock' : 'Lock', class: q.locked ? 'lk' : '', onclick: (e) => { e.stopPropagation(); edit(() => { q.locked = !q.locked; }); } }, icon('key')),
        h('button', { title: 'More', onclick: (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
          { icon: 'edit', label: 'Rename', fn: () => { const n = prompt('Name', q.name || TYPE_NAME[q.type]); if (n != null) edit(() => { q.name = n.trim(); }); } },
          i < ps.length - 1 && { icon: 'upload', label: 'Move Up', fn: () => edit(() => { ps.splice(i + 1, 0, ps.splice(i, 1)[0]); sel = i + 1; }) },
          i > 0 && { icon: 'download', label: 'Move Down', fn: () => edit(() => { ps.splice(i - 1, 0, ps.splice(i, 1)[0]); sel = i - 1; }) },
          i > 0 && { icon: 'layers', label: 'Merge pixels down', fn: () => { const b = ps[i - 1]; if (q.type !== 'pixels' || b.type !== 'pixels' || b.cols !== q.cols) return toast('Merges a pixel layer into the pixel layer below'); edit(() => { Object.assign(b.px, q.px); ps.splice(i, 1); sel = i - 1; }); } },
          { icon: 'copy', label: 'Duplicate', fn: () => edit(() => { ps.splice(i + 1, 0, clone(q)); sel = i + 1; }) },
          { icon: 'trash', label: 'Delete', fn: () => edit(() => { ps.splice(i, 1); sel = Math.min(sel, ps.length - 1); }) },
        ].filter(Boolean)); } }, icon('more')))) : h('p', { class: 'mo-info' }, 'No parts yet. Add shapes or a pixel layer.')));
      return;
    }
    // frames
    const f = d.frames[fi];
    panelBox.replaceChildren(
      h('div', { class: 'sp-frames' }, d.frames.map((q, i) => h('button', { class: 'sp-frame' + (i === fi ? ' on' : ''), onclick: () => { fi = i; sel = -1; render(); } },
        mkThumb(56, q.parts), h('small', {}, `${i + 1} · ${q.clip || 'idle'}`))),
      h('button', { class: 'sp-frame add', onclick: () => edit(() => { d.frames.splice(fi + 1, 0, { clip: f.clip, parts: clone(f.parts) }); fi++; sel = -1; }) }, icon('plus'), h('small', {}, 'Copy frame'))),
      row(
        act(playing ? 'Stop' : 'Play', playing ? 'close' : 'play', () => togglePlay(), playing ? 'primary' : ''),
        num('FPS', d.fps || 8, (v) => { d.fps = Math.round(v); }, { min: 1, max: 30 }),
        h('label', { class: 'sp-num' }, h('span', {}, 'Clip name'), h('input', { type: 'text', value: f.clip || 'idle', placeholder: 'idle', onfocus: () => push(), oninput: (e) => { f.clip = e.target.value.trim() || 'idle'; } })),
        tog('Onion skin', onion, () => { onion = !onion; render(); }),
        act('New empty', 'newfile', () => edit(() => { d.frames.splice(fi + 1, 0, { clip: f.clip, parts: [] }); fi++; sel = -1; })),
        fi > 0 && act('Move left', 'left', () => edit(() => { d.frames.splice(fi - 1, 0, d.frames.splice(fi, 1)[0]); fi--; })),
        fi < d.frames.length - 1 && act('Move right', 'right', () => edit(() => { d.frames.splice(fi + 1, 0, d.frames.splice(fi, 1)[0]); fi++; })),
        d.frames.length > 1 && act('Delete', 'trash', () => edit(() => { d.frames.splice(fi, 1); fi = Math.min(fi, d.frames.length - 1); sel = -1; }), 'danger')),
      h('p', { class: 'mo-info' }, d.frames.length > 1 ? `Clips: ${clipsOf(d)}. The game plays the first clip; Play Animation or a message with a clip name switches.` : 'Add frames to animate it (each frame starts as a copy, so change it a little).'));
  }
  function mkThumb(n, ps, cls = '') { const c = h('canvas', { class: cls, width: n * 2, height: n * 2, style: `width:${n}px;height:${n}px` }); thumb(c, ps); return c; }
  function thumb(c, ps) {
    const q = c.getContext('2d'), k = Math.min(c.width / d.w, c.height / d.h);
    q.clearRect(0, 0, c.width, c.height); q.save(); q.translate((c.width - d.w * k) / 2, (c.height - d.h * k) / 2); q.scale(k, k); q.imageSmoothingEnabled = !d.pixel; drawParts(q, ps); q.restore();
  }
  function toPath(p) { // any shape → editable points
    const n = p.type === 'ellipse' ? 12 : p.type === 'heart' ? 10 : 0;
    let local;
    if (n) local = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / n; return [Math.cos(a) * p.w / 2, Math.sin(a) * p.h / 2]; });
    else if (p.type === 'rect') local = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x * p.w / 2, y * p.h / 2]);
    else if (p.type === 'triangle') local = [[0, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]];
    else { const k = (p.type === 'star' ? 2 : 1) * clamp(Math.round(+p.sides || 5), 3, 24); local = Array.from({ length: k }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / k, m = p.type === 'star' && i % 2 ? +p.inner || 0.45 : 1; return [Math.cos(a) * p.w / 2 * m, Math.sin(a) * p.h / 2 * m]; }); }
    const art = local.map((q) => fromLocal(p, q)); const smooth = n > 0;
    p.type = 'path'; p.closed = true; p.smooth = smooth; delete p.radius; delete p.sides; delete p.inner; refit(p, art); setTool('points');
  }
  function togglePlay() {
    if (playing) { clearInterval(playing.t); playing = null; render(); return; }
    playing = { f: 0, t: setInterval(() => { playing.f = (playing.f + 1) % d.frames.length; draw(); }, 1000 / (d.fps || 8)) };
    render();
  }
  function moreMenu(a) {
    popMenu(a, [
      { icon: 'frame', label: `Canvas size… (${d.w} × ${d.h})`, fn: () => { const t = prompt('Canvas size in units (width × height). Parts keep their size.', `${d.w} x ${d.h}`); const m = t?.match(/(\d+)\D+(\d+)/); if (!m) return; push(); d.w = clamp(+m[1], 4, 512); d.h = clamp(+m[2], 4, 512); fit(); render(); } },
      { icon: 'grid', label: d.pixel ? 'Pixel art mode: on' : 'Pixel art mode: off', k: 'crisp edges, snap to pixels', fn: () => { push(); d.pixel = !d.pixel; snap = grid = d.pixel; render(); } },
      { icon: 'grid', label: grid ? 'Hide grid' : 'Show grid', fn: () => { grid = !grid; render(); } },
      { icon: 'magnet', label: snap ? 'Snap: on' : 'Snap: off', k: 'grid and 15° turns', fn: () => { snap = !snap; render(); } },
      { icon: 'scale', label: lockRatio ? 'Keep proportions: on' : 'Keep proportions: off', fn: () => { lockRatio = !lockRatio; render(); } },
      { icon: 'scale', label: mirror ? 'Mirror painting: on' : 'Mirror painting: off', fn: () => { mirror = !mirror; render(); } },
      { icon: 'brush', label: d.bg ? 'Background: ' + d.bg : 'Background: see-through', fn: () => { const c = prompt('Background colour (blank = see-through)', d.bg || ''); if (c == null) return; push(); d.bg = c.trim() || undefined; render(); } },
      '-',
      { icon: 'save', label: 'Save to My Drawings', fn: () => { const lib = myDrawings(), n = prompt('Name', opts.title || 'Drawing'); if (!n) return; try { localStorage.setItem('pocket.editor.drawings', JSON.stringify([{ name: n, drawing: d }, ...lib.filter((q) => q.name !== n)].slice(0, 30))); toast('Saved to My Drawings'); } catch { toast('Not enough space to save it'); } } },
      myDrawings().length && { icon: 'folder', label: 'Open from My Drawings…', fn: () => popMenu(a, myDrawings().map((q) => ({ icon: 'image', label: q.name, fn: () => { push(); d = clone(q.drawing); fi = 0; sel = -1; fit(); render(); } }))) },
      { icon: 'trash', label: 'Clear this frame', fn: () => edit(() => { d.frames[fi].parts = []; sel = -1; }) },
    ]);
  }
  const myDrawings = () => { try { return JSON.parse(localStorage.getItem('pocket.editor.drawings') || '[]'); } catch { return []; } };

  function render() { renderTools(); renderTabs(); renderPanel(); draw(); }
  function close() {
    if (playing) clearInterval(playing.t);
    if (penPts) finishPen(true);
    ro.disconnect(); imgListener = null; root.remove();
    const empty = d.frames.every((f) => !f.parts.length);
    if (!empty) opts.onDone?.({ drawing: d, ...renderDrawing(d) });
    opts.onClose?.();
  }
  const ro = new ResizeObserver(() => { const first = !W; resize(); if (first) fit(); draw(); }); ro.observe(cv);
  syncUndo(); render();
  return { close, get drawing() { return d; }, get view() { return { ...view }; } };
}
