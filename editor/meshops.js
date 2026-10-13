// Mesh modeling operations for editable mesh parts: { verts: [[x,y,z]...], faces: [{ v: [i,j,k,...], c?: '#hex' }...] }.
// Faces are convex polygons wound counter-clockwise when seen from outside. All operations edit the mesh in place.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const V3 = { sub, add, mul, cross, dot, len, norm, lerp };

export function newell(verts, idx) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < idx.length; i++) {
    const a = verts[idx[i]], b = verts[idx[(i + 1) % idx.length]];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
export const faceNormal = (m, f) => norm(newell(m.verts, m.faces[f].v));
export function centroid(verts, idx) { const c = [0, 0, 0]; for (const i of idx) { c[0] += verts[i][0]; c[1] += verts[i][1]; c[2] += verts[i][2]; } return mul(c, 1 / (idx.length || 1)); }
const ekey = (a, b) => (a < b ? a + ',' + b : b + ',' + a);

/** Unique edges [a, b]. */
export function edges(m) {
  const seen = new Set(), out = [];
  for (const f of m.faces) for (let i = 0; i < f.v.length; i++) {
    const a = f.v[i], b = f.v[(i + 1) % f.v.length], k = ekey(a, b);
    if (!seen.has(k)) { seen.add(k); out.push([a, b]); }
  }
  return out;
}
/** Vertices used by the given faces. */
export function faceVerts(m, faces) { const s = new Set(); for (const f of faces) for (const v of m.faces[f]?.v || []) s.add(v); return s; }
/** Faces whose vertices are all in the set. */
export function facesFromVerts(m, vs) { const out = new Set(); m.faces.forEach((f, i) => { if (f.v.every((v) => vs.has(v))) out.add(i); }); return out; }

/** Drop unused vertices and renumber. Returns the old → new index map. */
export function cleanup(m) {
  const used = new Set(); for (const f of m.faces) for (const v of f.v) used.add(v);
  const map = new Map(), verts = [];
  m.verts.forEach((p, i) => { if (used.has(i)) { map.set(i, verts.length); verts.push(p); } });
  m.verts = verts;
  for (const f of m.faces) f.v = f.v.map((v) => map.get(v));
  return map;
}

/** Extrude a region of faces along its average normal. The selected faces move out; side walls fill the gap. */
export function extrude(m, sel, dist = 0.25) {
  const faces = [...sel].filter((f) => m.faces[f]);
  if (!faces.length) return sel;
  const count = new Map();
  for (const f of faces) { const v = m.faces[f].v; for (let i = 0; i < v.length; i++) { const k = ekey(v[i], v[(i + 1) % v.length]); count.set(k, (count.get(k) || 0) + 1); } }
  const map = new Map(), dup = (v) => { if (!map.has(v)) { map.set(v, m.verts.length); m.verts.push([...m.verts[v]]); } return map.get(v); };
  const sides = [];
  for (const f of faces) {
    const F = m.faces[f], v = F.v;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      if (count.get(ekey(a, b)) === 1) sides.push({ v: [a, b, dup(b), dup(a)], ...(F.c ? { c: F.c } : {}) });
    }
  }
  let n = [0, 0, 0];
  for (const f of faces) { const F = m.faces[f]; n = add(n, newell(m.verts, F.v)); F.v = F.v.map(dup); }
  n = norm(n);
  for (const nv of map.values()) m.verts[nv] = add(m.verts[nv], mul(n, dist));
  m.faces.push(...sides);
  cleanup(m);
  return new Set(faces);
}

/** Inset each selected face: a smaller copy inside, joined to the border by a ring of quads. */
export function inset(m, sel, t = 0.25) {
  const out = new Set();
  for (const f of sel) {
    const F = m.faces[f]; if (!F) continue;
    const c = centroid(m.verts, F.v), inner = F.v.map((v) => { m.verts.push(lerp(m.verts[v], c, t)); return m.verts.length - 1; });
    for (let i = 0; i < F.v.length; i++) {
      const j = (i + 1) % F.v.length;
      m.faces.push({ v: [F.v[i], F.v[j], inner[j], inner[i]], ...(F.c ? { c: F.c } : {}) });
    }
    F.v = inner; out.add(f);
  }
  return out;
}

/** Split faces: triangles into 4, quads and polygons into one quad per corner. Returns the new face set. */
export function subdivide(m, sel) {
  const list = sel && sel.size ? [...sel] : m.faces.map((_, i) => i);
  const mids = new Map(), mid = (a, b) => { const k = ekey(a, b); if (!mids.has(k)) { mids.set(k, m.verts.length); m.verts.push(lerp(m.verts[a], m.verts[b], 0.5)); } return mids.get(k); };
  const out = new Set();
  for (const f of list) {
    const F = m.faces[f]; if (!F) continue;
    const v = F.v, n = v.length, ms = v.map((a, i) => mid(a, v[(i + 1) % n])), col = F.c ? { c: F.c } : {};
    let parts;
    if (n === 3) parts = [[v[0], ms[0], ms[2]], [v[1], ms[1], ms[0]], [v[2], ms[2], ms[1]], [ms[0], ms[1], ms[2]]];
    else {
      m.verts.push(centroid(m.verts, v)); const c = m.verts.length - 1;
      parts = v.map((a, i) => [a, ms[i], c, ms[(i - 1 + n) % n]]);
    }
    F.v = parts[0]; out.add(f);
    for (const p of parts.slice(1)) { m.faces.push({ v: p, ...col }); out.add(m.faces.length - 1); }
  }
  return out;
}

/** Relax vertices toward the average of their neighbours. */
export function smooth(m, vs, k = 0.5) {
  const nb = new Map();
  for (const [a, b] of edges(m)) { (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
  const ids = vs && vs.size ? [...vs] : m.verts.map((_, i) => i);
  const next = ids.map((i) => { const ns = nb.get(i) || []; if (!ns.length) return m.verts[i]; return lerp(m.verts[i], centroid(m.verts, ns), k); });
  ids.forEach((i, j) => { m.verts[i] = next[j]; });
}

/** Collapse vertices into one at their center. */
export function merge(m, vs) {
  const ids = [...vs]; if (ids.length < 2) return new Set(ids);
  const keep = ids[0]; m.verts[keep] = centroid(m.verts, ids);
  const set = new Set(ids);
  m.faces = m.faces.map((f) => ({ ...f, v: f.v.map((v) => (set.has(v) ? keep : v)).filter((v, i, a) => a.indexOf(v) === i) })).filter((f) => f.v.length >= 3);
  const map = cleanup(m);
  return new Set([map.get(keep)].filter((x) => x != null));
}

export function deleteFaces(m, sel) { m.faces = m.faces.filter((_, i) => !sel.has(i)); cleanup(m); }
export function deleteVerts(m, vs) { m.faces = m.faces.filter((f) => !f.v.some((v) => vs.has(v))); cleanup(m); }
export function flip(m, sel) { for (const f of sel) if (m.faces[f]) m.faces[f].v.reverse(); }

/** Make a face from 3+ selected vertices (ordered around their center, facing away from the mesh). */
export function fill(m, vs) {
  const ids = [...vs]; if (ids.length < 3) return -1;
  const P = ids.map((i) => m.verts[i]), c = centroid(m.verts, ids);
  let n = [0, 0, 0], best = 0;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const x = cross(sub(P[i], c), sub(P[j], c)), l = len(x); if (l > best) { best = l; n = x; } }
  if (best < 1e-9) return -1;
  n = norm(n);
  const u = norm(sub(P[0], c)), w = cross(n, u);
  const order = ids.map((i, k) => ({ i, a: Math.atan2(dot(sub(P[k], c), w), dot(sub(P[k], c), u)) })).sort((a, b) => a.a - b.a).map((o) => o.i);
  const all = m.verts.length ? centroid(m.verts, m.verts.map((_, i) => i)) : [0, 0, 0];
  if (dot(newell(m.verts, order), sub(c, all)) < 0) order.reverse();
  m.faces.push({ v: order });
  return m.faces.length - 1;
}

/** Vertices next to the selection. */
export function growVerts(m, vs) { const out = new Set(vs); for (const [a, b] of edges(m)) { if (vs.has(a)) out.add(b); if (vs.has(b)) out.add(a); } return out; }
export function growFaces(m, fs) { const vs = faceVerts(m, fs), out = new Set(fs); m.faces.forEach((f, i) => { if (f.v.some((v) => vs.has(v))) out.add(i); }); return out; }

/** For X-mirror modeling: index of the vertex mirrored across x = 0 (or -1). */
export function mirrorOf(m, i, eps = 1e-3) {
  const p = m.verts[i];
  if (Math.abs(p[0]) < eps) return i;
  for (let j = 0; j < m.verts.length; j++) { const q = m.verts[j]; if (j !== i && Math.abs(q[0] + p[0]) < eps && Math.abs(q[1] - p[1]) < eps && Math.abs(q[2] - p[2]) < eps) return j; }
  return -1;
}

// ---- primitives (centered at the origin, about 1 unit) ----
function orientOut(m, centerOf = () => [0, 0, 0]) {
  for (const f of m.faces) { const c = centroid(m.verts, f.v); if (dot(newell(m.verts, f.v), sub(c, centerOf(c))) < 0) f.v.reverse(); }
  return m;
}
export function makeCube(w = 1, h = 1, d = 1) {
  const x = w / 2, y = h / 2, z = d / 2;
  return orientOut({ verts: [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]],
    faces: [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4]].map((v) => ({ v })) });
}
export function makePlane(w = 1, d = 1) { return { verts: [[-w / 2, 0, d / 2], [w / 2, 0, d / 2], [w / 2, 0, -d / 2], [-w / 2, 0, -d / 2]], faces: [{ v: [0, 1, 2, 3] }] }; }
export function makeCylinder(n = 12, r = 0.5, h = 1, cone = false) {
  const verts = [], faces = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; verts.push([Math.cos(a) * r, -h / 2, Math.sin(a) * r]); }
  if (cone) { verts.push([0, h / 2, 0]); for (let i = 0; i < n; i++) faces.push({ v: [i, n, (i + 1) % n] }); }
  else {
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; verts.push([Math.cos(a) * r, h / 2, Math.sin(a) * r]); }
    for (let i = 0; i < n; i++) faces.push({ v: [i, n + i, n + (i + 1) % n, (i + 1) % n] });
    faces.push({ v: Array.from({ length: n }, (_, i) => n + n - 1 - i) });
  }
  faces.push({ v: Array.from({ length: n }, (_, i) => i) });
  return orientOut({ verts, faces });
}
export function makeSphere(seg = 12, rings = 8, r = 0.5) {
  const verts = [[0, r, 0]], faces = [];
  for (let k = 1; k < rings; k++) { const t = k / rings * Math.PI; for (let i = 0; i < seg; i++) { const a = i / seg * Math.PI * 2; verts.push([Math.cos(a) * Math.sin(t) * r, Math.cos(t) * r, Math.sin(a) * Math.sin(t) * r]); } }
  verts.push([0, -r, 0]);
  const P = (k, i) => 1 + (k - 1) * seg + (i % seg), bottom = verts.length - 1;
  for (let i = 0; i < seg; i++) faces.push({ v: [P(1, i), 0, P(1, i + 1)] });
  for (let k = 1; k < rings - 1; k++) for (let i = 0; i < seg; i++) faces.push({ v: [P(k + 1, i), P(k, i), P(k, i + 1), P(k + 1, i + 1)] });
  for (let i = 0; i < seg; i++) faces.push({ v: [bottom, P(rings - 1, i), P(rings - 1, i + 1)] });
  return orientOut({ verts, faces });
}
export function makeIcoSphere(r = 0.5, subdivisions = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  const m = { verts: [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]],
    faces: [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]].map((v) => ({ v })) };
  for (let s = 0; s < subdivisions; s++) subdivide(m);
  m.verts = m.verts.map((p) => mul(norm(p), r));
  return orientOut(m);
}
export function makeTorus(seg = 16, tube = 8, R = 0.35, r = 0.15) {
  const verts = [], faces = [];
  for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
    const u = i / seg * Math.PI * 2, v = j / tube * Math.PI * 2;
    verts.push([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)]);
  }
  const P = (i, j) => (i % seg) * tube + (j % tube);
  for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) faces.push({ v: [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)] });
  return orientOut({ verts, faces }, (c) => { const l = Math.hypot(c[0], c[2]) || 1; return [c[0] / l * R, 0, c[2] / l * R]; });
}

/** Weld a triangle soup (positions + indices) into a mesh. */
export function fromTriangles(P, I, scale = [1, 1, 1]) {
  const map = new Map(), verts = [], faces = [];
  const idx = (k) => {
    const p = [P[k * 3] * scale[0], P[k * 3 + 1] * scale[1], P[k * 3 + 2] * scale[2]], key = p.map((x) => x.toFixed(4)).join(',');
    if (!map.has(key)) { map.set(key, verts.length); verts.push(p); }
    return map.get(key);
  };
  const n = I ? I.length : P.length / 3;
  for (let t = 0; t < n; t += 3) {
    const a = idx(I ? I[t] : t), b = idx(I ? I[t + 1] : t + 1), c = idx(I ? I[t + 2] : t + 2);
    if (a !== b && b !== c && a !== c) faces.push({ v: [a, b, c] });
  }
  return { verts, faces };
}

// ---- OBJ ----
export function toOBJ(groups) {
  let out = '# Pocket Engine model\n', base = 1;
  for (const g of groups) {
    out += `o ${g.name}\n`;
    for (const p of g.verts) out += `v ${p.map((x) => +x.toFixed(5)).join(' ')}\n`;
    for (const f of g.faces) out += `f ${f.v.map((i) => i + base).join(' ')}\n`;
    base += g.verts.length;
  }
  return out;
}
export function fromOBJ(text) {
  const verts = [], faces = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'v') verts.push([+t[1] || 0, +t[2] || 0, +t[3] || 0]);
    else if (t[0] === 'f') {
      const v = t.slice(1).map((s) => { const i = parseInt(s.split('/')[0], 10); return i < 0 ? verts.length + i : i - 1; }).filter((i) => i >= 0 && i < verts.length);
      if (v.length >= 3) faces.push({ v });
    }
  }
  return { verts, faces };
}
