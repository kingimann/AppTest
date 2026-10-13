/*!
 * Pocket Engine — a small 2D + 3D game engine for mobile web browsers.
 * One file, no dependencies. 2D renders with Canvas 2D, 3D with WebGL.
 *
 *   import { Engine, Scene, Entity } from './pocket.js';
 *   const engine = new Engine();
 *   engine.start(() => Scene.fromJSON(myGameJson));
 */
export const VERSION = '0.1.0';

// ============================================================================
// Utilities & math
// ============================================================================
let uidCounter = 0;
export const uid = (prefix = 'e') => prefix + Date.now().toString(36).slice(-5) + (uidCounter++).toString(36);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
/** A number, or a random number in [min, max] when given an array. */
export const pick = (v) => (Array.isArray(v) ? rand(v[0], v[1]) : v);
export const DEG = Math.PI / 180;

const colorCache = new Map();
export function hexToRgb(hex) {
  let c = colorCache.get(hex);
  if (c) return c;
  let h = String(hex || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  colorCache.set(hex, c);
  return c;
}

/** Column-major 4x4 matrix helpers (WebGL layout). */
export const M4 = {
  identity() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  },
  lookAt(e, t, up = { x: 0, y: 1, z: 0 }) {
    let zx = e.x - t.x, zy = e.y - t.y, zz = e.z - t.z;
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up.y * zz - up.z * zy, xy = up.z * zx - up.x * zz, xz = up.x * zy - up.y * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e.x + xy * e.y + xz * e.z), -(yx * e.x + yy * e.y + yz * e.z), -(zx * e.x + zy * e.y + zz * e.z), 1,
    ]);
  },
  /** translate * rotY * rotX * rotZ * scale (angles in radians) */
  trs(px, py, pz, rx, ry, rz, sx, sy, sz) {
    const cx = Math.cos(rx), sxn = Math.sin(rx), cy = Math.cos(ry), syn = Math.sin(ry), cz = Math.cos(rz), szn = Math.sin(rz);
    // R = Ry * Rx * Rz
    const m00 = cy * cz + syn * sxn * szn, m01 = cx * szn, m02 = -syn * cz + cy * sxn * szn;
    const m10 = -cy * szn + syn * sxn * cz, m11 = cx * cz, m12 = syn * szn + cy * sxn * cz;
    const m20 = syn * cx, m21 = -sxn, m22 = cy * cx;
    return new Float32Array([
      m00 * sx, m01 * sx, m02 * sx, 0,
      m10 * sy, m11 * sy, m12 * sy, 0,
      m20 * sz, m21 * sz, m22 * sz, 0,
      px, py, pz, 1,
    ]);
  },
  invert(m) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.identity();
    det = 1 / det;
    return new Float32Array([
      (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
      (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
      (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
      (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
      (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
    ]);
  },
  transformPoint(m, x, y, z) {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return {
      x: (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      y: (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      z: (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
    };
  },
};

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
export { store as storage };

// ============================================================================
// Entities
// ============================================================================
export const SHAPE_DEFAULTS = { type: 'rect', w: 40, h: 40, r: 20, radius: 0, fill: '#33f0ff', stroke: '', lineWidth: 2, glow: 0, points: null, emoji: '' };
export const BAR_DEFAULTS = { var: 'hp', max: 100, maxVar: '', w: 160, h: 16, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 8, label: false };
export const TEXT_DEFAULTS = { value: 'Text', size: 24, color: '#ffffff', font: 'system-ui, -apple-system, sans-serif', weight: '800', align: 'center' };
export const MESH_DEFAULTS = { geometry: 'box', w: 1, h: 1, d: 1, r: 0.5, color: '#33f0ff', emissive: 0, opacity: 1 };
export const SPRITE_DEFAULTS = { src: '', w: 64, h: 64 };
export const BODY_DEFAULTS = {
  type: 'dynamic', shape: 'auto', w: 0, h: 0, d: 0, r: 0, sensor: false, gravityScale: 1, bounce: 0, vx: 0, vy: 0, vz: 0,
  ox: 0, oy: 0, oz: 0, // collider offset from the object's center
  oneWay: false, // platforms you can jump up through and land on
  mass: 1, friction: 0, drag: 0, maxFall: 0,
};

const TRANSFORM_KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz'];

export class Entity {
  constructor(props = {}) {
    this.id = props.id || uid();
    this.name = props.name || 'Entity';
    this.tags = new Set(props.tags || []);
    for (const k of TRANSFORM_KEYS) this[k] = +props[k] || 0; // rotations are in degrees
    this.sx = props.sx ?? 1; this.sy = props.sy ?? 1; this.sz = props.sz ?? 1;
    this.visible = props.visible ?? true;
    this.alpha = props.alpha ?? 1;
    this.layer = props.layer || 0;
    this.ui = !!props.ui; // screen-space HUD element (2D overlay, also in 3D games)
    this.anchor = props.anchor || 'top-left';
    this.shape = props.shape ? { ...SHAPE_DEFAULTS, ...props.shape } : null;
    this.text = props.text ? { ...TEXT_DEFAULTS, ...props.text } : null;
    this.sprite = props.sprite ? { ...SPRITE_DEFAULTS, ...props.sprite } : null;
    this.mesh = props.mesh ? { ...MESH_DEFAULTS, ...props.mesh } : null;
    this.bar = props.bar ? { ...BAR_DEFAULTS, ...props.bar } : null;
    this.showWhen = props.showWhen || 'always'; // UI screens: always | play | title | over | win | paused
    this.voxels = props.voxels ? new VoxelWorld(props.voxels) : null;
    this.model = props.model ? { parts: (props.model.parts || []).map((q) => ({ ...q })) } : null;
    this.body = null;
    if (props.body) this.setBody(props.body);
    this.data = { ...(props.data || {}) };
    this.behaviors = [];
    this.scene = null;
    this.dead = false;
    this.started = false;
    this.props = props; // the description this entity was built from
    for (const b of props.behaviors || []) this.addBehavior(b);
  }

  setBody(opts = {}) {
    this.body = { ...BODY_DEFAULTS, ...opts, vel: { x: +opts.vx || 0, y: +opts.vy || 0, z: +opts.vz || 0 }, grounded: false };
    return this.body;
  }

  /** Add a behavior: a {type, ...params} description from the registry, or a plain hooks object. */
  addBehavior(b) {
    if (b && b.enabled === false) return null; // switched off in the editor
    let inst = b;
    if (b && typeof b.type === 'string') {
      const def = Behaviors[b.type];
      if (!def) { console.warn(`[pocket] unknown behavior "${b.type}"`); return null; }
      const params = {};
      for (const p of def.params || []) params[p.key] = b[p.key] ?? paramDefault(p, !!this.mesh);
      inst = def.create(params, this) || {};
      inst.type = b.type;
    }
    this.behaviors.push(inst);
    if (this.started && inst.start) inst.start(this, this.scene);
    return inst;
  }

  getBehavior(type) { return this.behaviors.find((b) => b.type === type); }
  has(tag) { return this.tags.has(tag); }
  destroy() { this.dead = true; }

  /** Half-extents used for physics & picking. Planar 2D entities have infinite depth. */
  extents() {
    if (this.voxels) {
      const b = this.voxels.bounds, s = this.voxels.size;
      return { sphere: false, hx: (b.i1 - b.i0 + 1) * s / 2, hy: (b.j1 - b.j0 + 1) * s / 2, hz: (b.k1 - b.k0 + 1) * s / 2, voxel: true };
    }
    const b = this.body, is2D = !this.mesh;
    const sx = Math.abs(this.sx), sy = Math.abs(this.sy), sz = Math.abs(this.sz);
    const off = b && (b.ox || b.oy || b.oz) ? { ox: b.ox * sx, oy: b.oy * sy, oz: (b.oz || 0) * sz } : null;
    if (b && b.shape !== 'auto') {
      if (b.shape === 'circle' || b.shape === 'sphere') return { sphere: true, r: (b.r || 10) * Math.max(sx, sy, is2D ? 0 : sz), ...off };
      return { sphere: false, hx: (b.w || 1) * sx / 2, hy: (b.h || 1) * sy / 2, hz: is2D ? Infinity : (b.d || 1) * sz / 2, ...off };
    }
    if (this.model && this.model.parts?.length) { // box around all the parts
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of this.model.parts) {
        const [gx, gy, gz] = partSize(q);
        x0 = Math.min(x0, (q.x || 0) - gx / 2); x1 = Math.max(x1, (q.x || 0) + gx / 2);
        y0 = Math.min(y0, (q.y || 0) - gy / 2); y1 = Math.max(y1, (q.y || 0) + gy / 2);
        z0 = Math.min(z0, (q.z || 0) - gz / 2); z1 = Math.max(z1, (q.z || 0) + gz / 2);
      }
      return { sphere: false, hx: (x1 - x0) * sx / 2, hy: (y1 - y0) * sy / 2, hz: (z1 - z0) * sz / 2, ox: (x0 + x1) / 2 * sx + (off?.ox || 0), oy: (y0 + y1) / 2 * sy + (off?.oy || 0), oz: (z0 + z1) / 2 * sz + (off?.oz || 0) };
    }
    if (off) { const r = this.extents.call({ ...this, body: { ...b, ox: 0, oy: 0, oz: 0 } }); return { ...r, ...off }; }
    if (this.mesh) {
      const m = this.mesh;
      switch (m.geometry) {
        case 'sphere': return { sphere: true, r: m.r * Math.max(sx, sy, sz) };
        case 'cylinder': case 'cone': return { sphere: false, hx: m.r * sx, hy: m.h * sy / 2, hz: m.r * sz };
        case 'plane': return { sphere: false, hx: m.w * sx / 2, hy: 0.01, hz: m.d * sz / 2 };
        default: return { sphere: false, hx: m.w * sx / 2, hy: m.h * sy / 2, hz: m.d * sz / 2 };
      }
    }
    if (this.shape) {
      const s = this.shape;
      if (s.type === 'circle' || s.type === 'ring') return { sphere: true, r: s.r * Math.max(sx, sy) };
      return { sphere: false, hx: s.w * sx / 2, hy: s.h * sy / 2, hz: Infinity };
    }
    if (this.sprite) return { sphere: false, hx: this.sprite.w * sx / 2, hy: this.sprite.h * sy / 2, hz: Infinity };
    if (this.bar) return { sphere: false, hx: this.bar.w * sx / 2, hy: this.bar.h * sy / 2, hz: Infinity };
    if (this.text) {
      const len = String(this.text.value).length;
      return { sphere: false, hx: this.text.size * len * 0.3 * sx, hy: this.text.size * 0.6 * sy, hz: Infinity };
    }
    return { sphere: false, hx: 10, hy: 10, hz: is2D ? Infinity : 0.5 };
  }

  /** Give this entity a body sized to its visuals if it has none. */
  ensureBody(opts = {}) {
    if (!this.body) this.setBody(opts);
    return this.body;
  }
}

// ============================================================================
// Voxels (Minecraft-style block worlds)
// ============================================================================
export const VOXEL_PALETTE = ['#6aa84f', '#8d6e63', '#9e9e9e', '#6d4c41', '#3d8b37', '#e3cf8f', '#4fa3e0', '#c0392b', '#f5f5f5', '#2b2b2b', '#f1c40f', '#8e44ad'];
export const VOXEL_NAMES = ['Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Sand', 'Water', 'Brick', 'Snow', 'Obsidian', 'Gold', 'Crystal'];
const CHUNK = 16;

/** A grid of colored blocks. Block (i, j, k) fills [i, i+1) × size from the owning entity's position. */
export class VoxelWorld {
  constructor(o = {}) {
    this.size = o.size || 1;
    this.palette = (o.palette && o.palette.length ? o.palette : VOXEL_PALETTE).slice();
    this.gen = { type: 'hills', w: 32, d: 32, h: 6, seed: 1, trees: true, ...(o.gen || {}) };
    this.edits = { ...(o.edits || {}) };
    this.blocks = new Map();
    this.dirty = new Set();
    this.generate();
  }
  static key(i, j, k) { return ((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512); }
  get(i, j, k) { return this.blocks.get(VoxelWorld.key(i, j, k)) || 0; }
  setRaw(i, j, k, c) {
    const key = VoxelWorld.key(i, j, k);
    if (c) this.blocks.set(key, c); else this.blocks.delete(key);
    if (this.bounds) {
      const b = this.bounds;
      if (c) { b.i0 = Math.min(b.i0, i); b.i1 = Math.max(b.i1, i); b.j0 = Math.min(b.j0, j); b.j1 = Math.max(b.j1, j); b.k0 = Math.min(b.k0, k); b.k1 = Math.max(b.k1, k); }
      for (const di of [-1, 0, 1]) for (const dk of [-1, 0, 1]) this.dirty.add(Math.floor((i + di) / CHUNK) + ',' + Math.floor((k + dk) / CHUNK));
    }
  }
  /** Change a block (0 = remove) and remember it as an edit. */
  set(i, j, k, c) { this.setRaw(i, j, k, c); this.edits[`${i},${j},${k}`] = c; }

  generate() {
    this.blocks.clear(); this.bounds = null;
    const g = this.gen;
    let seed = (g.seed * 9301 + 49297) % 233280 || 1;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7 + g.seed * 74.7) * 43758.5453; return n - Math.floor(n); };
    const smooth = (x, z, sc) => {
      const fx = x / sc, fz = z / sc, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
      const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
      return lerp(lerp(hash(x0, z0), hash(x0 + 1, z0), u), lerp(hash(x0, z0 + 1), hash(x0 + 1, z0 + 1), u), v);
    };
    const set = (i, j, k, c) => this.blocks.set(VoxelWorld.key(i, j, k), c);
    if (g.type !== 'empty') {
      const hw = Math.floor(g.w / 2), hd = Math.floor(g.d / 2), tops = [];
      for (let i = -hw; i < g.w - hw; i++) for (let k = -hd; k < g.d - hd; k++) {
        const n = g.type === 'flat' ? 0 : smooth(i, k, 9) * 0.7 + smooth(i, k, 4) * 0.3;
        const h = g.type === 'flat' ? 2 : Math.max(1, Math.round(1 + n * g.h));
        for (let j = 0; j < h; j++) set(i, j, k, j === h - 1 ? (g.type === 'hills' && h <= 2 ? 6 : 1) : j >= h - 3 ? 2 : 3);
        tops.push([i, h, k]);
      }
      if (g.trees && g.type !== 'flat') {
        for (const [i, h, k] of tops) {
          if (h <= 2 || rnd() > 0.018 || Math.abs(i) < 2 && Math.abs(k) < 2) continue;
          for (let j = h; j < h + 4; j++) set(i, j, k, 4);
          for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let j = h + 3; j <= h + 4; j++) {
            if (Math.abs(a) + Math.abs(b) > 3 || (a === 0 && b === 0 && j < h + 4)) continue;
            if (!this.get(i + a, j, k + b)) set(i + a, j, k + b, 5);
          }
          set(i, h + 5, k, 5);
        }
      }
    }
    for (const [kk, c] of Object.entries(this.edits)) { const [i, j, k] = kk.split(',').map(Number); if (c) set(i, j, k, c); else this.blocks.delete(VoxelWorld.key(i, j, k)); }
    // bounds of what exists
    const b = { i0: 0, i1: 0, j0: 0, j1: 0, k0: 0, k1: 0 };
    let first = true;
    for (const key of this.blocks.keys()) {
      const k = (key % 1024) - 512, j = (Math.floor(key / 1024) % 1024) - 512, i = Math.floor(key / 1048576) - 512;
      if (first) { Object.assign(b, { i0: i, i1: i, j0: j, j1: j, k0: k, k1: k }); first = false; continue; }
      if (i < b.i0) b.i0 = i; if (i > b.i1) b.i1 = i; if (j < b.j0) b.j0 = j; if (j > b.j1) b.j1 = j; if (k < b.k0) b.k0 = k; if (k > b.k1) b.k1 = k;
    }
    this.bounds = b;
    this.allDirty = true;
  }

  /** Local block coordinates for a world point. */
  cell(e, x, y, z) { const s = this.size; return [Math.floor((x - e.x) / s), Math.floor((y - e.y) / s), Math.floor((z - e.z) / s)]; }
  solidAtWorld(e, x, y, z) { const [i, j, k] = this.cell(e, x, y, z); return !!this.get(i, j, k); }
  /** Height (world y) of the highest block top at or below `belowY` in the column under (x, z). */
  groundAt(e, x, z, belowY) {
    const [i, , k] = this.cell(e, x, 0, z), s = this.size;
    for (let j = Math.min(this.bounds.j1, Math.floor((belowY - e.y) / s)); j >= this.bounds.j0; j--) if (this.get(i, j, k)) return e.y + (j + 1) * s;
    return -Infinity;
  }
  /** Step along a ray through the grid; returns the first solid block and the face it entered through. */
  raycast(e, o, d, max = 60) {
    const s = this.size;
    let x = (o.x - e.x) / s, y = (o.y - e.y) / s, z = (o.z - e.z) / s;
    let i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
    const si = Math.sign(d.x), sj = Math.sign(d.y), sk = Math.sign(d.z);
    const tdx = si ? Math.abs(1 / d.x) : Infinity, tdy = sj ? Math.abs(1 / d.y) : Infinity, tdz = sk ? Math.abs(1 / d.z) : Infinity;
    let tx = si ? (si > 0 ? i + 1 - x : x - i) * tdx : Infinity, ty = sj ? (sj > 0 ? j + 1 - y : y - j) * tdy : Infinity, tz = sk ? (sk > 0 ? k + 1 - z : z - k) * tdz : Infinity;
    let n = [0, 0, 0], t = 0;
    const lim = max / s;
    while (t <= lim) {
      if (this.get(i, j, k)) return { i, j, k, n, dist: t * s };
      if (tx < ty && tx < tz) { i += si; t = tx; tx += tdx; n = [-si, 0, 0]; }
      else if (ty < tz) { j += sj; t = ty; ty += tdy; n = [0, -sj, 0]; }
      else { k += sk; t = tz; tz += tdz; n = [0, 0, -sk]; }
    }
    return null;
  }
  toJSON() { return { size: this.size, palette: this.palette, gen: this.gen, edits: this.edits }; }
  get count() { return this.blocks.size; }
}

// ============================================================================
// Cameras
// ============================================================================
export class Camera2D {
  constructor(o = {}) { this.x = o.x ?? 0; this.y = o.y ?? 0; this.zoom = o.zoom ?? 1; this.shake = 0; }
}
export class Camera3D {
  constructor(o = {}) {
    this.position = { x: 0, y: 8, z: 12, ...(o.position || {}) };
    this.target = { x: 0, y: 0, z: 0, ...(o.target || {}) };
    this.fov = o.fov ?? 60; this.near = o.near ?? 0.1; this.far = o.far ?? 500; this.shake = 0;
  }
}

// ============================================================================
// Scene
// ============================================================================
const DEFAULT_SETTINGS = {
  joystick: false, jumpButton: false, title: '', subtitle: '', saveBest: '', pauseButton: true, timeLimit: 0,
  muteButton: true, orientation: 'any', fullscreen: false,
  joystickSide: 'left', controlSize: 'medium', shareButton: true, saveProgress: false,
  controls: 'auto', joystickMode: 'floating', controlsOpacity: 1, jumpLabel: 'JUMP', actionLabel: 'FIRE', customScreens: false,
  turnBased: false, turnDelay: 0.3,
};
const CONTROL_SCALE = { small: 0.8, medium: 1, large: 1.25 };

export class Scene {
  constructor(opts = {}) {
    this.mode = opts.mode === '3d' ? '3d' : '2d';
    this.name = opts.name || 'Scene';
    this.background = opts.background || (this.mode === '3d' ? '#87b8e8' : '#0b0b1a');
    this.view = { width: 400, height: 700, ...(opts.view || {}) };
    this.gravity = opts.gravity ?? (this.mode === '3d' ? -20 : 0); // along y (2D: +down, 3D: +up)
    this.settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
    this.light = { dir: { x: -0.4, y: -1, z: -0.3 }, color: '#ffffff', ambient: 0.45, ...(opts.light || {}) };
    this.fog = { near: 30, far: 120, ...(opts.fog || {}) };
    this.vars = { score: 0, ...(opts.vars || {}) };
    this.initialVars = { ...this.vars };
    this.camera = this.mode === '3d'
      ? new Camera3D(opts.camera)
      : new Camera2D({ x: this.view.width / 2, y: this.view.height / 2, ...(opts.camera || {}) });
    this.entities = [];
    this.templates = {};
    this.particles = [];
    this.timers = [];
    this.tweens = [];
    this.pending = [];
    this.time = 0;
    this.state = this.settings.title ? 'title' : 'play'; // title | play | over | win
    this.listeners = {};
    this.engine = null;
    this.json = opts.json || null;
    if (this.settings.saveBest) this.vars.best = +store.get('pocket.best.' + this.settings.saveBest, 0) || 0;
    if (this.settings.timeLimit) this.vars.time = +this.settings.timeLimit;
    this.msg = null;
    this.level = 1; this.levelCount = 1;
    this.turnSide = 'player';
    if (this.settings.turnBased) { this.vars.turn ??= 1; this.vars.turnText = 'Your turn'; }
  }

  /** Turn-based games: the player finished a move; enemies/opponents act next (their components' turn() hooks). */
  endTurn() {
    if (this.turnSide !== 'player' || this.state !== 'play') return;
    this.turnSide = 'enemy';
    this.turnDelay = this.settings.turnDelay ?? 0.3;
    this.setVar('turnText', this.settings.enemyTurnText || 'Enemy turn');
  }
  get isPlayerTurn() { return this.turnSide === 'player'; }

  /** Components that react to touching a tag call this so tagged objects always take part in collisions. */
  want(tag) { if (tag) (this.wantedTags ||= new Set()).add(tag); }

  /** Show a message banner over the game for a few seconds. */
  message(text, seconds = 2.5) { this.msg = { text: String(text), t: seconds }; }

  /** Build a scene from a plain JSON description (what the editor saves). */
  static fromJSON(json, { editing = false } = {}) {
    const s = new Scene({ ...json, json });
    for (const ep of json.entities || []) {
      if (ep.template && !editing) { s.templates[ep.name] = ep; continue; }
      const e = s.add(new Entity(editing ? { ...ep, behaviors: [] } : ep));
      if (ep.template) { e.template = true; e.alpha = 0.45; }
    }
    s.flush();
    return s;
  }

  add(entity) {
    if (!(entity instanceof Entity)) entity = new Entity(entity);
    entity.scene = this;
    this.pending.push(entity);
    return entity;
  }

  /** Spawn a copy of a template (by name) or a new entity from props. */
  spawn(templateOrProps, overrides = {}) {
    const base = typeof templateOrProps === 'string' ? this.templates[templateOrProps] : templateOrProps;
    if (!base) { console.warn(`[pocket] no template "${templateOrProps}"`); return null; }
    return this.add(new Entity({ ...base, template: false, id: undefined, ...overrides }));
  }

  flush() {
    if (this.pending.length) { this.entities.push(...this.pending); this.pending.length = 0; this.entities.sort((a, b) => a.layer - b.layer); }
    if (this.entities.some((e) => e.dead)) {
      for (const e of this.entities) if (e.dead) for (const b of e.behaviors) b.destroy?.(e, this);
      this.entities = this.entities.filter((e) => !e.dead);
    }
  }

  find(name) { return this.entities.find((e) => e.name === name && !e.dead) || this.pending.find((e) => e.name === name); }
  findAll(tag) { return this.entities.filter((e) => !e.dead && (e.tags.has(tag) || e.name === tag)); }
  byId(id) { return this.entities.find((e) => e.id === id); }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, ...args) { for (const fn of this.listeners[evt] || []) fn(...args); }

  setVar(k, v) { this.vars[k] = v; this.emit('var', k, v); }
  addVar(k, d = 1) { this.setVar(k, (+this.vars[k] || 0) + d); }

  after(sec, fn) { this.timers.push({ t: sec, fn, every: 0 }); }
  every(sec, fn) { this.timers.push({ t: sec, fn, every: sec }); }
  tween(target, to, duration = 0.3, ease = (t) => 1 - (1 - t) ** 3) {
    const from = {}; for (const k in to) from[k] = target[k];
    this.tweens.push({ target, from, to, duration, t: 0, ease });
  }

  burst(x, y, z = 0, color = '#ffffff', count = 16, speed = 1) {
    const is3D = this.mode === '3d', base = is3D ? 6 : 220;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(rand(-1, 1)), s = rand(0.3, 1) * base * speed;
      this.particles.push({
        x, y, z, color, life: 1, decay: rand(1, 2),
        vx: Math.cos(a) * Math.sin(b) * s, vy: is3D ? Math.cos(b) * s : Math.sin(a) * s, vz: is3D ? Math.sin(a) * Math.sin(b) * s : 0,
        size: is3D ? rand(0.08, 0.18) : rand(2, 5),
      });
    }
  }

  gameOver() { this.endWith('over'); }
  win() { this.endWith('win'); }
  endWith(state) {
    if (this.state !== 'play') return;
    this.state = state;
    this.endTime = this.time;
    const key = this.settings.saveBest;
    if (key && (+this.vars.score || 0) > (+this.vars.best || 0)) {
      this.vars.best = Math.floor(this.vars.score); this.newBest = true;
      store.set('pocket.best.' + key, String(this.vars.best));
    }
    this.levelComplete = state === 'win' && !!this.engine?.hasNextLevel();
    if (!this.levelComplete && this.settings.saveProgress) this.engine?.clearProgress();
    this.engine?.audio.sfx(state === 'win' ? 'win' : 'lose');
    this.engine?.vibrate(state === 'win' ? [30, 40, 30] : [80, 40, 120]);
    this.emit(state);
  }

  /** Visible 2D world rectangle. */
  viewBounds() {
    const e = this.engine; const c = this.camera;
    if (!e || this.mode !== '2d') return { left: 0, top: 0, right: this.view.width, bottom: this.view.height };
    const z = e.renderer.zoomFor(this), hw = e.width / 2 / z, hh = e.height / 2 / z;
    return { left: c.x - hw, right: c.x + hw, top: c.y - hh, bottom: c.y + hh };
  }

  // overridable hooks
  init() {}
  update() {}
}

// ============================================================================
// Physics (arcade: axis-aligned boxes & spheres, shared by 2D and 3D)
// ============================================================================
function overlap(a, ea, b, eb) {
  if (ea.ox || ea.oy || ea.oz) a = { x: a.x + (ea.ox || 0), y: a.y + (ea.oy || 0), z: a.z + (ea.oz || 0) };
  if (eb.ox || eb.oy || eb.oz) b = { x: b.x + (eb.ox || 0), y: b.y + (eb.oy || 0), z: b.z + (eb.oz || 0) };
  return overlapRaw(a, ea, b, eb);
}
function overlapRaw(a, ea, b, eb) {
  if (!ea.sphere && !eb.sphere) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const ox = ea.hx + eb.hx - Math.abs(dx); if (ox <= 0) return null;
    const oy = ea.hy + eb.hy - Math.abs(dy); if (oy <= 0) return null;
    const oz = ea.hz + eb.hz - Math.abs(dz); if (oz <= 0) return null;
    if (ox <= oy && ox <= oz) return { nx: Math.sign(dx) || 1, ny: 0, nz: 0, depth: ox };
    if (oy <= oz) return { nx: 0, ny: Math.sign(dy) || 1, nz: 0, depth: oy };
    return { nx: 0, ny: 0, nz: Math.sign(dz) || 1, depth: oz };
  }
  if (ea.sphere && eb.sphere) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz), rs = ea.r + eb.r;
    if (d >= rs) return null;
    if (d < 1e-6) return { nx: 0, ny: 1, nz: 0, depth: rs };
    return { nx: dx / d, ny: dy / d, nz: dz / d, depth: rs - d };
  }
  if (!ea.sphere) { const m = overlapRaw(b, eb, a, ea); if (m) { m.nx = -m.nx; m.ny = -m.ny; m.nz = -m.nz; } return m; }
  // a = sphere, b = box
  const cx = clamp(a.x, b.x - eb.hx, b.x + eb.hx), cy = clamp(a.y, b.y - eb.hy, b.y + eb.hy), cz = clamp(a.z, b.z - eb.hz, b.z + eb.hz);
  const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz, d = Math.hypot(dx, dy, dz);
  if (d >= ea.r) return null;
  if (d > 1e-6) return { nx: -dx / d, ny: -dy / d, nz: -dz / d, depth: ea.r - d };
  return overlapRaw(a, { sphere: false, hx: ea.r, hy: ea.r, hz: Number.isFinite(eb.hz) ? ea.r : Infinity }, b, eb);
}

export class Physics {
  constructor() { this.contacts = new Set(); }

  step(scene, dt) {
    const g = scene.gravity, gd = Math.sign(g); // gravity along y
    if (scene.wantedTags) {
      for (const e of scene.entities) {
        if (e.body || e.dead || e.ui) continue;
        for (const t of e.tags) if (scene.wantedTags.has(t)) { e.setBody({ type: 'kinematic', sensor: true }); break; }
      }
    }
    const list = scene.entities.filter((e) => e.body && !e.dead);
    for (const e of list) {
      const b = e.body;
      if (b.type !== 'dynamic') { // how far moving platforms travelled since last step (to carry riders)
        b.dx = e.x - (b.px ?? e.x); b.dy = e.y - (b.py ?? e.y); b.dz = e.z - (b.pz ?? e.z);
      }
      if (b.type === 'static') continue;
      if (b.type === 'dynamic') {
        b.vel.y += g * b.gravityScale * dt;
        if (b.drag) { const k = Math.max(0, 1 - b.drag * dt); b.vel.x *= k; b.vel.z *= k; if (!g || !b.gravityScale) b.vel.y *= k; }
        if (b.maxFall && gd && b.vel.y * gd > b.maxFall) b.vel.y = b.maxFall * gd;
      }
      e.x += b.vel.x * dt; e.y += b.vel.y * dt; e.z += b.vel.z * dt;
      b.grounded = false; b.groundedOn = null;
    }
    // dynamic bodies collide with voxel worlds block by block
    const worlds = scene.entities.filter((e) => e.voxels && !e.dead);
    if (worlds.length) {
      for (const e of list) {
        const b = e.body;
        if (b.type !== 'dynamic' || b.sensor) continue;
        for (const w of worlds) {
          const V = w.voxels, sz = V.size, half = sz / 2, box = { sphere: false, hx: half, hy: half, hz: half };
          let ex = e.extents();
          const hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy, hz = ex.sphere ? ex.r : ex.hz;
          const [i0, j0, k0] = V.cell(w, e.x - hx, e.y - hy, e.z - hz), [i1, j1, k1] = V.cell(w, e.x + hx, e.y + hy, e.z + hz);
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
            if (!V.get(i, j, k)) continue;
            const c = { x: w.x + (i + 0.5) * sz, y: w.y + (j + 0.5) * sz, z: w.z + (k + 0.5) * sz };
            ex = e.extents();
            const m = overlap(e, ex, c, box);
            if (!m) continue;
            e.x -= m.nx * m.depth; e.y -= m.ny * m.depth; e.z -= m.nz * m.depth;
            const vn = b.vel.x * m.nx + b.vel.y * m.ny + b.vel.z * m.nz;
            if (vn > 0) { b.vel.x -= m.nx * vn; b.vel.y -= m.ny * vn; b.vel.z -= m.nz * vn; }
            if (gd && m.ny * gd > 0.5) b.grounded = true;
          }
        }
      }
    }
    const ext = list.map((e) => e.extents());
    const now = new Set();
    for (let i = 0; i < list.length; i++) {
      const a = list[i], ba = a.body;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j], bb = b.body;
        if (ba.type === 'static' && bb.type === 'static') continue;
        if (a.dead || b.dead) continue;
        const m = overlap(a, ext[i], b, ext[j]);
        if (!m) continue;
        const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        now.add(key);
        if (!this.contacts.has(key)) { collide(a, b, m); collide(b, a, { nx: -m.nx, ny: -m.ny, nz: -m.nz, depth: m.depth }); }
        if (ba.sensor || bb.sensor) continue;
        const ma = ba.type === 'dynamic', mb = bb.type === 'dynamic';
        if (!ma && !mb) continue;
        // one-way platforms: only solid for something landing on top while falling
        if (ba.oneWay || bb.oneWay) {
          const [dyn, plat, n] = ma && !mb ? [a, b, m.ny] : mb && !ma ? [b, a, -m.ny] : [null];
          if (!dyn || !(gd && n * gd > 0.5) || dyn.body.vel.y * gd < -0.01) continue;
          const dex = dyn.extents(), hh = dex.sphere ? dex.r : dex.hy;
          if (m.depth > Math.max(hh * 0.5, 0.0001)) continue;
        }
        const share = ma && mb ? bb.mass / ((ba.mass + bb.mass) || 1) : 1, shareB = ma && mb ? 1 - share : 1;
        const fr = Math.max(ba.friction || 0, bb.friction || 0);
        if (ma) {
          a.x -= m.nx * m.depth * share; a.y -= m.ny * m.depth * share; a.z -= m.nz * m.depth * share;
          const vn = ba.vel.x * m.nx + ba.vel.y * m.ny + ba.vel.z * m.nz;
          if (vn > 0) { const k = vn * (1 + ba.bounce); ba.vel.x -= m.nx * k; ba.vel.y -= m.ny * k; ba.vel.z -= m.nz * k; }
          if (gd && m.ny * gd > 0.5) {
            ba.grounded = true; ba.groundedOn = b;
            if (!mb && bb.dx !== undefined) { a.x += bb.dx; a.z += bb.dz; if (bb.dy * gd < 0) a.y += bb.dy; } // ride moving platforms
            if (fr) { const k = Math.max(0, 1 - fr * dt * 10); ba.vel.x *= k; if (gd && b.mesh) ba.vel.z *= k; }
          }
        }
        if (mb) {
          b.x += m.nx * m.depth * shareB; b.y += m.ny * m.depth * shareB; b.z += m.nz * m.depth * shareB;
          const vn = bb.vel.x * m.nx + bb.vel.y * m.ny + bb.vel.z * m.nz;
          if (vn < 0) { const k = vn * (1 + bb.bounce); bb.vel.x -= m.nx * k; bb.vel.y -= m.ny * k; bb.vel.z -= m.nz * k; }
          if (gd && m.ny * gd < -0.5) {
            bb.grounded = true; bb.groundedOn = a;
            if (!ma && ba.dx !== undefined) { b.x += ba.dx; b.z += ba.dz; if (ba.dy * gd < 0) b.y += ba.dy; }
            if (fr) { const k = Math.max(0, 1 - fr * dt * 10); bb.vel.x *= k; if (b.mesh) bb.vel.z *= k; }
          }
        }
      }
    }
    this.contacts = now;
    for (const e of list) if (e.body.type !== 'dynamic') { e.body.px = e.x; e.body.py = e.y; e.body.pz = e.z; }
  }
}

function collide(e, other, m) {
  for (const b of e.behaviors) if (b.collide && !e.dead) b.collide(e, other, e.scene, m);
  e.scene?.emit('collide', e, other, m);
}

// ============================================================================
// Input: touch — virtual joystick, buttons, taps, drags, swipes and tilt
// ============================================================================
export class Input {
  constructor(engine, el) {
    this.engine = engine;
    this.el = el;
    this.enabled = true;
    this.justPressed = new Set();
    this.pointers = new Map();
    this.taps = [];
    this.drag = { dx: 0, dy: 0 };
    this.stick = null; // { id, bx, by, x, y }
    this.buttons = []; // [{ action, x, y, r, label, id }]
    this.downs = []; // pointers pressed this frame: { id, x, y }
    this.useTilt = false; this.tiltOn = false; this.tiltAxis = null; this.tiltBase = null;

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  down(e) {
    this.engine.audio.unlock();
    if (!this.enabled) return;
    if (this.useTilt && !this.tiltOn) this.enableTilt();
    this.engine.onFirstGesture?.();
    const p = this.local(e);
    this.el.setPointerCapture?.(e.pointerId);
    const btn = this.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3);
    const ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), role: 'free' };
    const st = this.engine.scene?.settings || {};
    const stickSide = st.joystickSide === 'right' ? p.x > this.engine.width * 0.5 : p.x < this.engine.width * 0.5;
    if (btn) { ptr.role = 'button'; btn.id = e.pointerId; this.justPressed.add('btn:' + btn.action); this.engine.vibrate(8); }
    else if (st.joystick && (!st.controls || st.controls === 'auto' || st.controls === 'joystick') && this.engine.scene.state === 'play' && stickSide && !this.stick) {
      ptr.role = 'stick';
      const f = st.joystickMode === 'fixed' ? this.fixedStick() : null;
      this.stick = f ? { id: e.pointerId, bx: f.x, by: f.y, x: p.x, y: p.y, fixed: true } : { id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y };
    }
    this.pointers.set(e.pointerId, ptr);
    if (ptr.role === 'free') this.downs.push({ id: e.pointerId, x: p.x, y: p.y });
  }

  move(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    const p = this.local(e);
    if (ptr.role === 'free') { this.drag.dx += p.x - ptr.x; this.drag.dy += p.y - ptr.y; }
    ptr.x = p.x; ptr.y = p.y;
    if (this.stick && this.stick.id === e.pointerId) {
      const max = this.stickRadius, dx = p.x - this.stick.bx, dy = p.y - this.stick.by, d = Math.hypot(dx, dy);
      if (d > max && !this.stick.fixed) { this.stick.bx = p.x - dx / d * max; this.stick.by = p.y - dy / d * max; } // base follows the thumb
      this.stick.x = p.x; this.stick.y = p.y;
    }
  }

  up(e, cancelled) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    if (this.stick && this.stick.id === e.pointerId) this.stick = null;
    for (const b of this.buttons) if (b.id === e.pointerId) b.id = null;
    const dt = performance.now() - ptr.t, dx = ptr.x - ptr.sx, dy = ptr.y - ptr.sy, dist = Math.hypot(dx, dy);
    if (!cancelled && ptr.role === 'free' && dt < 350 && dist < 14) {
      this.taps.push({ x: ptr.x, y: ptr.y });
      this.justPressed.add('tap');
    } else if (!cancelled && ptr.role === 'free' && dt < 700 && dist > 40) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      this.justPressed.add('swipe:' + dir); this.justPressed.add('swipe');
    }
  }

  /** Tilt-to-move using the device's motion sensors (asks permission on iOS). */
  enableTilt() {
    if (this.tiltOn) return;
    const listen = () => {
      this.tiltOn = true;
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        const angle = screen.orientation?.angle ?? window.orientation ?? 0;
        let x = e.gamma, y = e.beta;
        if (angle === 90) { x = e.beta; y = -e.gamma; } else if (angle === -90 || angle === 270) { x = -e.beta; y = e.gamma; }
        if (this.tiltBase == null) this.tiltBase = y;
        this.tiltAxis = { x: clamp(x / 25, -1, 1), y: clamp((y - this.tiltBase) / 25, -1, 1) };
      });
    };
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') D.requestPermission().then((r) => r === 'granted' && listen()).catch(() => {});
    else if (D) listen();
  }

  /** Where a fixed joystick sits. */
  fixedStick() {
    const eng = this.engine, r = this.stickRadius, right = eng.scene?.settings.joystickSide === 'right';
    return { x: right ? eng.width - eng.safe.right - 30 - r : eng.safe.left + 30 + r, y: eng.height - eng.safe.bottom - 30 - r };
  }
  get stickRadius() { return Math.min(70, this.engine.width * 0.15) * (CONTROL_SCALE[this.engine.scene?.settings.controlSize] || 1); }

  /** Movement axis in [-1, 1] from the joystick or tilt. y is down (forward = negative). */
  axis() {
    let x = 0, y = 0;
    if (this.stick) {
      const sx = (this.stick.x - this.stick.bx) / this.stickRadius, sy = (this.stick.y - this.stick.by) / this.stickRadius, l = Math.hypot(sx, sy);
      if (l > 0.12) { x += sx / Math.max(1, l); y += sy / Math.max(1, l); } // small dead zone
    }
    for (const b of this.buttons) {
      if (b.id == null) continue;
      if (b.action === 'dleft') x -= 1; else if (b.action === 'dright') x += 1; else if (b.action === 'dup') y -= 1; else if (b.action === 'ddown') y += 1;
    }
    if (this.useTilt && this.tiltAxis) {
      const dz = (v) => (Math.abs(v) < 0.08 ? 0 : v);
      x += dz(this.tiltAxis.x); y += dz(this.tiltAxis.y);
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  /** Is a touch button held? Actions: 'jump', 'action' */
  isDown(action) {
    if (action === 'jump' || action === 'action') return this.buttons.some((b) => b.action === action && b.id != null);
    return false;
  }
  /** Was an action pressed this frame? */
  pressed(action) {
    const j = this.justPressed;
    if (action === 'jump') {
      const hasBtn = this.buttons.some((b) => b.action === 'jump');
      return j.has('btn:jump') || (!hasBtn && (j.has('tap') || j.has('swipe:up')));
    }
    if (action === 'action') return j.has('btn:action');
    return j.has(action);
  }
  get pointerDown() { return [...this.pointers.values()].some((p) => p.role === 'free'); }

  endFrame() { this.justPressed.clear(); this.taps.length = 0; this.downs.length = 0; this.drag.dx = 0; this.drag.dy = 0; }
  reset() { this.pointers.clear(); this.stick = null; this.useTilt = false; this.tiltBase = null; this.endFrame(); }
}

// ============================================================================
// Audio: tiny WebAudio synth for sound effects, plus file playback
// ============================================================================
export class Audio {
  constructor() { this.ctx = null; this.muted = store.get('pocket.muted', '0') === '1'; this.buffers = new Map(); }
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; store.set('pocket.muted', m ? '1' : '0'); }
  tone({ freq = 440, to = freq, dur = 0.15, type = 'square', vol = 0.15, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  sfx(name) {
    const T = (o) => this.tone(o);
    switch (name) {
      case 'coin': T({ freq: 880, to: 1760, dur: 0.12, vol: 0.1 }); break;
      case 'jump': T({ freq: 260, to: 620, dur: 0.16, vol: 0.1 }); break;
      case 'hit': T({ freq: 220, to: 50, dur: 0.3, type: 'sawtooth', vol: 0.15 }); break;
      case 'power': [0, 0.07, 0.14].forEach((d, i) => T({ freq: 440 * (1 + i * 0.5), dur: 0.1, delay: d, vol: 0.08, type: 'triangle' })); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => T({ freq: f, dur: 0.18, delay: i * 0.1, vol: 0.1, type: 'triangle' })); break;
      case 'lose': [392, 330, 262].forEach((f, i) => T({ freq: f, to: f * 0.9, dur: 0.22, delay: i * 0.14, vol: 0.12, type: 'sawtooth' })); break;
      case 'click': T({ freq: 1200, dur: 0.04, vol: 0.05 }); break;
      default: if (name) this.play(name);
    }
  }
  async load(url) {
    this.unlock(); if (!this.ctx) return null;
    if (!this.buffers.has(url)) this.buffers.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).catch(() => null));
    return this.buffers.get(url);
  }
  async play(url, vol = 1) {
    if (this.muted) return;
    const buf = await this.load(url); if (!buf) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buf; g.gain.value = vol; s.connect(g).connect(this.ctx.destination); s.start();
  }
}

// ============================================================================
// Asset loading
// ============================================================================
const images = new Map();
export function loadImage(src) {
  if (!images.has(src)) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    images.set(src, img);
  }
  return images.get(src);
}

// ============================================================================
// 2D renderer (Canvas 2D)
// ============================================================================
/** 1234 → "1234", 12345 → "12.3K", 4500000 → "4.5M" */
export function formatNumber(v) {
  const a = Math.abs(v);
  if (a < 10000) return String(Math.floor(v));
  for (const [n, u] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= n) return (Math.floor(v / n * 10) / 10) + u;
  return String(Math.floor(v));
}
const fillTemplate = (str, vars) => String(str).replace(/\{(\w+)\}/g, (_, k) => {
  const v = vars[k];
  if (typeof v !== 'number') return v ?? '';
  return k === 'time' ? String(Math.ceil(v)) : formatNumber(v);
});

function drawEntity2D(ctx, e, vars, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.rz) ctx.rotate(e.rz * DEG);
  if (e.sx !== 1 || e.sy !== 1) ctx.scale(e.sx, e.sy);
  let alpha = e.alpha;
  if (e.data.invuln > 0 && Math.floor(time * 12) % 2) alpha *= 0.3;
  ctx.globalAlpha = alpha;
  const s = e.shape;
  if (s) {
    if (s.glow) { ctx.shadowColor = s.stroke || s.fill; ctx.shadowBlur = s.glow; }
    ctx.beginPath();
    switch (s.type) {
      case 'circle': ctx.arc(0, 0, s.r, 0, Math.PI * 2); break;
      case 'triangle': ctx.moveTo(0, -s.h / 2); ctx.lineTo(s.w / 2, s.h / 2); ctx.lineTo(-s.w / 2, s.h / 2); ctx.closePath(); break;
      case 'star': {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s.w * 0.2 : s.w / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * (s.h / s.w));
        }
        ctx.closePath(); break;
      }
      case 'polygon': (s.points || []).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); break;
      case 'ellipse': ctx.ellipse(0, 0, s.w / 2, s.h / 2, 0, 0, Math.PI * 2); break;
      case 'hexagon': case 'pentagon': case 'octagon': {
        const n = { pentagon: 5, hexagon: 6, octagon: 8 }[s.type];
        for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; ctx.lineTo(Math.cos(a) * s.w / 2, Math.sin(a) * s.h / 2); }
        ctx.closePath(); break;
      }
      case 'diamond': ctx.moveTo(0, -s.h / 2); ctx.lineTo(s.w / 2, 0); ctx.lineTo(0, s.h / 2); ctx.lineTo(-s.w / 2, 0); ctx.closePath(); break;
      case 'heart': {
        const w = s.w / 2, hh = s.h / 2;
        ctx.moveTo(0, hh); ctx.bezierCurveTo(-w * 1.3, hh * 0.2, -w * 0.9, -hh * 1.1, 0, -hh * 0.4);
        ctx.bezierCurveTo(w * 0.9, -hh * 1.1, w * 1.3, hh * 0.2, 0, hh); ctx.closePath(); break;
      }
      case 'capsule': if (ctx.roundRect) ctx.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, Math.min(s.w, s.h) / 2); else ctx.rect(-s.w / 2, -s.h / 2, s.w, s.h); break;
      case 'ring': ctx.arc(0, 0, s.r, 0, Math.PI * 2); ctx.arc(0, 0, s.r * 0.6, 0, Math.PI * 2, true); break;
      case 'arrow': ctx.moveTo(s.w / 2, 0); ctx.lineTo(0, -s.h / 2); ctx.lineTo(0, -s.h / 5); ctx.lineTo(-s.w / 2, -s.h / 5); ctx.lineTo(-s.w / 2, s.h / 5); ctx.lineTo(0, s.h / 5); ctx.lineTo(0, s.h / 2); ctx.closePath(); break;
      case 'cloud':
        for (const [cx, cy, cr] of [[-0.25, 0.1, 0.25], [0, -0.1, 0.32], [0.27, 0.08, 0.24], [0, 0.18, 0.22]]) { ctx.moveTo(cx * s.w + cr * s.w, cy * s.h); ctx.arc(cx * s.w, cy * s.h, cr * s.w, 0, Math.PI * 2); }
        break;
      case 'emoji': break;
      default:
        if (s.radius && ctx.roundRect) ctx.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, s.radius);
        else ctx.rect(-s.w / 2, -s.h / 2, s.w, s.h);
    }
    if (s.type === 'emoji') { // emoji sprites: thousands of ready-made characters, items and props
      ctx.font = `${Math.round(s.h * 0.92)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (e.data.flipX) ctx.scale(-1, 1);
      ctx.fillText(s.emoji || '⭐', 0, s.h * 0.06);
    } else {
      if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(s.type === 'ring' ? 'evenodd' : 'nonzero'); }
      if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.lineWidth; ctx.stroke(); }
    }
    ctx.shadowBlur = 0;
  }
  if (e.sprite && e.sprite.src) {
    const img = loadImage(e.sprite.src);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -e.sprite.w / 2, -e.sprite.h / 2, e.sprite.w, e.sprite.h);
  }
  if (e.bar) { // progress / health bar bound to a variable (or this object's own value with "self.hp")
    const b = e.bar, src = b.var.startsWith('self.') ? e.data : vars, key = b.var.replace(/^self\./, '');
    const max = (b.maxVar ? +(b.maxVar.startsWith('self.') ? e.data : vars)[b.maxVar.replace(/^self\./, '')] : +b.max) || 1;
    const k = clamp((+src[key] || 0) / max, 0, 1);
    e.data._barK = e.data._barK == null ? k : e.data._barK + (k - e.data._barK) * 0.25;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, b.radius); else ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = b.bg; ctx.fill();
    if (e.data._barK > 0.001) {
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-b.w / 2, -b.h / 2, b.w * e.data._barK, b.h, b.radius); else ctx.rect(-b.w / 2, -b.h / 2, b.w * e.data._barK, b.h);
      ctx.fillStyle = b.fill; ctx.fill();
    }
    if (b.label) { ctx.font = `800 ${Math.round(b.h * 0.7)}px system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${formatNumber(+src[key] || 0)} / ${formatNumber(max)}`, 0, 1); }
  }
  if (e.text) {
    const t = e.text;
    ctx.font = `${t.weight} ${t.size}px ${t.font}`;
    ctx.fillStyle = t.color; ctx.textAlign = t.align; ctx.textBaseline = 'middle';
    ctx.fillText(fillTemplate(t.value, Object.keys(e.data).length ? Object.assign(Object.create(vars), e.data) : vars), 0, 0);
  }
  ctx.restore();
}

export class Renderer2D {
  constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.kind = '2d'; }
  zoomFor(scene) {
    const e = scene.engine;
    return scene.camera.zoom * Math.min(e.width / scene.view.width, e.height / scene.view.height);
  }
  screenToWorld(scene, sx, sy) {
    const z = this.zoomFor(scene), e = scene.engine, c = scene.camera;
    return { x: (sx - e.width / 2) / z + c.x, y: (sy - e.height / 2) / z + c.y };
  }
  worldToScreen(scene, x, y) {
    const z = this.zoomFor(scene), e = scene.engine, c = scene.camera;
    return { x: (x - c.x) * z + e.width / 2, y: (y - c.y) * z + e.height / 2 };
  }
  render(scene, engine) {
    const ctx = this.ctx, c = scene.camera, z = this.zoomFor(scene);
    ctx.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, engine.width, engine.height);
    ctx.save();
    ctx.translate(engine.width / 2, engine.height / 2);
    if (c.shake > 0) ctx.translate(rand(-1, 1) * c.shake, rand(-1, 1) * c.shake);
    ctx.scale(z, z);
    ctx.translate(-c.x, -c.y);
    if (engine.editing && engine.drawGrid) engine.drawGrid(ctx, scene, z);
    for (const e of scene.entities) if (e.visible && !e.ui && !e.dead) drawEntity2D(ctx, e, scene.vars, scene.time);
    for (const p of scene.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    engine.onRenderWorld?.(ctx, scene, z);
    ctx.restore();
  }
}

// ============================================================================
// 3D renderer (WebGL)
// ============================================================================
const VS = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uModel, uViewProj; uniform mat3 uNormalMat;
varying vec3 vN; varying vec3 vW; varying vec3 vCol;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = uNormalMat * aNormal; vCol = aColor; gl_Position = uViewProj * w; }`;
const FS = `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec3 vCol;
uniform vec3 uColor, uLightDir, uLightColor, uFogColor, uCamPos;
uniform float uAmbient, uEmissive, uFogNear, uFogFar, uOpacity, uVColor;
void main() {
  vec3 base = mix(uColor, vCol, uVColor);
  vec3 n = normalize(vN);
  vec3 l = normalize(-uLightDir);
  float d = max(dot(n, l), 0.0);
  vec3 v = normalize(uCamPos - vW);
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), 32.0) * 0.25;
  vec3 lit = base * (uAmbient + uLightColor * d * (1.0 - uAmbient)) + sp * uLightColor;
  vec3 c = mix(lit, base, uEmissive);
  float f = clamp((length(uCamPos - vW) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogColor, f), uOpacity);
}`;

export const GEOMETRIES = ['box', 'sphere', 'cylinder', 'cone', 'plane', 'capsule', 'pyramid', 'wedge', 'prism', 'gem', 'dome', 'torus'];

/** Extra shapes built from triangles; each fits a unit box and is oriented outward automatically. */
function extraGeometry(kind) {
  const P = [], N = [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** Add a triangle. Normals: one flat vector, or one per vertex (smooth). `out` points away from the surface. */
  const tri = (a, b, c, ns, out) => {
    const fn = norm(cross(sub(b, a), sub(c, a)));
    const ref = out || (ns && Array.isArray(ns[0]) ? norm([ns[0][0] + ns[1][0] + ns[2][0], ns[0][1] + ns[1][1] + ns[2][1], ns[0][2] + ns[1][2] + ns[2][2]]) : [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
    let v = [a, b, c], n = ns && Array.isArray(ns[0]) ? ns : [fn, fn, fn];
    if (dot(fn, ref) < 0) { v = [a, c, b]; n = n === ns ? [ns[0], ns[2], ns[1]] : [[-fn[0], -fn[1], -fn[2]], [-fn[0], -fn[1], -fn[2]], [-fn[0], -fn[1], -fn[2]]]; }
    for (let i = 0; i < 3; i++) { P.push(...v[i]); N.push(...n[i]); }
  };
  const quad = (a, b, c, d, out) => { tri(a, b, c, null, out); tri(a, c, d, null, out); };
  const h = 0.5, seg = 24;
  if (kind === 'pyramid') {
    const t = [0, h, 0], c = [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]];
    for (let i = 0; i < 4; i++) tri(c[i], c[(i + 1) % 4], t);
    quad(c[0], c[1], c[2], c[3]);
  } else if (kind === 'wedge') { // a ramp: high at the back (-z), low at the front (+z)
    const b0 = [-h, -h, -h], b1 = [h, -h, -h], b2 = [h, -h, h], b3 = [-h, -h, h], t0 = [-h, h, -h], t1 = [h, h, -h];
    quad(b0, b1, b2, b3, [0, -1, 0]); quad(b0, b1, t1, t0, [0, 0, -1]); quad(t0, t1, b2, b3, [0, 1, 1]); // the slope passes through the center, so say which way is out
    tri(b0, t0, b3, null, [-1, 0, 0]); tri(b1, t1, b2, null, [1, 0, 0]);
  } else if (kind === 'prism') {
    const f = [[-h, -h, h], [h, -h, h], [0, h, h]], k = [[-h, -h, -h], [h, -h, -h], [0, h, -h]];
    tri(f[0], f[1], f[2]); tri(k[0], k[1], k[2]);
    for (let i = 0; i < 3; i++) quad(f[i], f[(i + 1) % 3], k[(i + 1) % 3], k[i]);
  } else if (kind === 'gem') {
    const v = [[h, 0, 0], [-h, 0, 0], [0, h, 0], [0, -h, 0], [0, 0, h], [0, 0, -h]];
    for (const x of [0, 1]) for (const y of [2, 3]) for (const z of [4, 5]) tri(v[x], v[y], v[z]);
  } else if (kind === 'dome' || kind === 'capsule') {
    // dome: half an ellipsoid sitting on y = -0.5; capsule: cylinder with rounded ends (shape is right when height = 2 × width)
    const ring = 10, pts = [];
    const prof = kind === 'dome'
      ? Array.from({ length: ring + 1 }, (_, i) => { const v = i / ring * Math.PI / 2; return [Math.sin(v) * h, -h + Math.cos(v) * 1, Math.sin(v), Math.cos(v) * 0.25]; })
      : [...Array.from({ length: ring + 1 }, (_, i) => { const v = i / ring * Math.PI / 2; return [Math.sin(v) * h, 0.25 + Math.cos(v) * 0.25, Math.sin(v), Math.cos(v)]; }),
        ...Array.from({ length: ring + 1 }, (_, i) => { const v = Math.PI / 2 + i / ring * Math.PI / 2; return [Math.sin(v) * h, -0.25 + Math.cos(v) * 0.25, Math.sin(v), Math.cos(v)]; })];
    for (let r = 0; r < prof.length; r++) for (let i = 0; i <= seg; i++) {
      const u = i / seg * Math.PI * 2, [rad, y, nr, ny] = prof[r];
      pts.push({ p: [Math.cos(u) * rad, y, Math.sin(u) * rad], n: norm([Math.cos(u) * nr, ny, Math.sin(u) * nr]) });
    }
    const W = seg + 1;
    for (let r = 0; r < prof.length - 1; r++) for (let i = 0; i < seg; i++) {
      const a = pts[r * W + i], b = pts[r * W + i + 1], c = pts[(r + 1) * W + i + 1], d = pts[(r + 1) * W + i];
      tri(a.p, b.p, c.p, [a.n, b.n, c.n]); tri(a.p, c.p, d.p, [a.n, c.n, d.n]);
    }
    if (kind === 'dome') for (let i = 0; i < seg; i++) {
      const u0 = i / seg * Math.PI * 2, u1 = (i + 1) / seg * Math.PI * 2;
      tri([0, -h, 0], [Math.cos(u0) * h, -h, Math.sin(u0) * h], [Math.cos(u1) * h, -h, Math.sin(u1) * h], null, [0, -1, 0]);
    }
  } else if (kind === 'torus') {
    const R = 0.35, r = 0.15, tube = 14, ptAt = (i, j) => {
      const u = i / seg * Math.PI * 2, v = j / tube * Math.PI * 2;
      return { p: [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)], n: [Math.cos(v) * Math.cos(u), Math.sin(v), Math.cos(v) * Math.sin(u)] };
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const a = ptAt(i, j), b = ptAt(i + 1, j), c = ptAt(i + 1, j + 1), d = ptAt(i, j + 1);
      tri(a.p, b.p, c.p, [a.n, b.n, c.n]); tri(a.p, c.p, d.p, [a.n, c.n, d.n]);
    }
  }
  const n = P.length / 3;
  return { P: new Float32Array(P), N: new Float32Array(N), I: new Uint16Array(Array.from({ length: n }, (_, i) => i)) };
}

/** Size [x, y, z] of a mesh or model part from its geometry and dimensions. */
export function partSize(m) {
  const g = m.geometry || 'box', w = m.w ?? 1, hh = m.h ?? 1, d = m.d ?? 1, r = m.r ?? 0.5;
  if (g === 'sphere') return [r * 2, r * 2, r * 2];
  if (g === 'cylinder' || g === 'cone') return [r * 2, hh, r * 2];
  if (g === 'plane') return [w, 0.02, d];
  return [w, hh, d];
}

function geometry(kind) {
  if (!['box', 'plane', 'sphere', 'cylinder', 'cone'].includes(kind)) return extraGeometry(kind);
  const P = [], N = [], I = [];
  const quad = (a, b, c, d, n) => { const o = P.length / 3; P.push(...a, ...b, ...c, ...d); for (let i = 0; i < 4; i++) N.push(...n); I.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  if (kind === 'box') {
    const h = 0.5;
    quad([-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h], [0, 0, 1]);
    quad([h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h], [0, 0, -1]);
    quad([h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h], [1, 0, 0]);
    quad([-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h], [-1, 0, 0]);
    quad([-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h], [0, 1, 0]);
    quad([-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h], [0, -1, 0]);
  } else if (kind === 'plane') {
    quad([-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], [0, 1, 0]);
  } else if (kind === 'sphere') {
    const seg = 24, ring = 16;
    for (let y = 0; y <= ring; y++) for (let x = 0; x <= seg; x++) {
      const u = x / seg * Math.PI * 2, v = y / ring * Math.PI;
      const nx = Math.cos(u) * Math.sin(v), ny = Math.cos(v), nz = Math.sin(u) * Math.sin(v);
      P.push(nx * 0.5, ny * 0.5, nz * 0.5); N.push(nx, ny, nz);
    }
    for (let y = 0; y < ring; y++) for (let x = 0; x < seg; x++) {
      const a = y * (seg + 1) + x, b = a + seg + 1;
      I.push(a, a + 1, b, b, a + 1, b + 1);
    }
  } else { // cylinder / cone: unit diameter & height
    const seg = 24, top = kind === 'cone' ? 0 : 0.5;
    const slope = kind === 'cone' ? 0.5 : 0;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), l = Math.hypot(1, slope);
      P.push(c * 0.5, -0.5, s * 0.5, c * top, 0.5, s * top);
      N.push(c / l, slope / l, s / l, c / l, slope / l, s / l);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const cap = (y, ny, r) => {
      const o = P.length / 3; P.push(0, y, 0); N.push(0, ny, 0);
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; P.push(Math.cos(a) * r, y, Math.sin(a) * r); N.push(0, ny, 0); }
      for (let i = 0; i < seg; i++) ny > 0 ? I.push(o, o + i + 2, o + i + 1) : I.push(o, o + i + 1, o + i + 2);
    };
    cap(-0.5, -1, 0.5);
    if (kind !== 'cone') cap(0.5, 1, 0.5);
  }
  return { P: new Float32Array(P), N: new Float32Array(N), I: new Uint16Array(I) };
}

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas; this.kind = '3d';
    const gl = this.gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL is not supported on this device');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = this.prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNormal'); gl.bindAttribLocation(prog, 2, 'aColor');
    gl.linkProgram(prog); gl.useProgram(prog);
    this.a = { pos: 0, normal: 1, color: 2 };
    gl.disableVertexAttribArray(2); gl.vertexAttrib3f(2, 1, 1, 1);
    this.voxelCache = new WeakMap();
    this.u = {};
    for (const n of ['uModel', 'uViewProj', 'uNormalMat', 'uColor', 'uLightDir', 'uLightColor', 'uFogColor', 'uCamPos', 'uAmbient', 'uEmissive', 'uFogNear', 'uFogFar', 'uOpacity', 'uVColor']) this.u[n] = gl.getUniformLocation(prog, n);
    this.geoms = {};
    for (const k of GEOMETRIES) {
      const g = geometry(k), b = { count: g.I.length };
      b.pos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, g.P, gl.STATIC_DRAW);
      b.norm = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b.norm); gl.bufferData(gl.ARRAY_BUFFER, g.N, gl.STATIC_DRAW);
      b.idx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.I, gl.STATIC_DRAW);
      this.geoms[k] = b;
    }
    this.lineBuf = gl.createBuffer(); this.lineNorm = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.viewProj = M4.identity();
  }

  /** World-space ray through a screen point (CSS px). */
  screenRay(scene, sx, sy) {
    const e = scene.engine, inv = M4.invert(this.viewProj);
    const nx = sx / e.width * 2 - 1, ny = 1 - sy / e.height * 2;
    const a = M4.transformPoint(inv, nx, ny, -1), b = M4.transformPoint(inv, nx, ny, 1);
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l = Math.hypot(dx, dy, dz);
    return { origin: a, dir: { x: dx / l, y: dy / l, z: dz / l } };
  }
  worldToScreen(scene, x, y, z) {
    const e = scene.engine, p = M4.transformPoint(this.viewProj, x, y, z);
    return { x: (p.x + 1) / 2 * e.width, y: (1 - p.y) / 2 * e.height, behind: p.z > 1 };
  }

  drawMesh(geomName, model, color, emissive = 0, opacity = 1) {
    const gl = this.gl, g = this.geoms[geomName] || this.geoms.box;
    const nm = M4.invert(model); // normal matrix = transpose(inverse(model)) upper 3x3
    gl.uniformMatrix4fv(this.u.uModel, false, model);
    gl.uniformMatrix3fv(this.u.uNormalMat, false, [nm[0], nm[4], nm[8], nm[1], nm[5], nm[9], nm[2], nm[6], nm[10]]);
    gl.uniform3fv(this.u.uColor, hexToRgb(color));
    gl.uniform1f(this.u.uEmissive, emissive);
    gl.uniform1f(this.u.uOpacity, opacity);
    gl.uniform1f(this.u.uVColor, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(this.a.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.norm); gl.vertexAttribPointer(this.a.normal, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(this.a.normal);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.idx);
    gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_SHORT, 0);
  }

  /** Draw unlit line segments: points = [x1,y1,z1, x2,y2,z2, ...] */
  drawLines(points, color, opacity = 1) {
    const gl = this.gl, arr = new Float32Array(points);
    gl.uniformMatrix4fv(this.u.uModel, false, M4.identity());
    gl.uniformMatrix3fv(this.u.uNormalMat, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    gl.uniform3fv(this.u.uColor, hexToRgb(color)); gl.uniform1f(this.u.uEmissive, 1); gl.uniform1f(this.u.uOpacity, opacity);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(this.a.pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineNorm); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr.length), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.a.normal, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(this.a.normal);
    if (opacity < 1) gl.enable(gl.BLEND);
    gl.drawArrays(gl.LINES, 0, arr.length / 3);
    gl.disable(gl.BLEND);
  }

  /** Build one chunk's faces (only faces next to air) as an interleaved pos/normal/color buffer. */
  buildChunk(V, cx, cz) {
    const out = [], s = V.size, b = V.bounds;
    const FACES = [
      [[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], 0.86], [[-1, 0, 0], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], 0.86],
      [[0, 1, 0], [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], 1], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], 0.6],
      [[0, 0, 1], [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], 0.93], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], 0.93],
    ];
    const cols = V.palette.map(hexToRgb);
    for (let i = cx * CHUNK; i < cx * CHUNK + CHUNK; i++) for (let k = cz * CHUNK; k < cz * CHUNK + CHUNK; k++) for (let j = b.j0; j <= b.j1; j++) {
      const c = V.get(i, j, k);
      if (!c) continue;
      const base = cols[(c - 1) % cols.length], h = Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453, jit = 0.94 + (h - Math.floor(h)) * 0.1;
      for (const [n, q, shade] of FACES) {
        if (V.get(i + n[0], j + n[1], k + n[2])) continue;
        const fc = c === 1 && n[1] !== 1 && cols[1] ? cols[1] : base; // grass blocks have dirt sides
        const r = fc[0] * jit * shade, g = fc[1] * jit * shade, bl = fc[2] * jit * shade;
        for (const vi of [0, 1, 2, 0, 2, 3]) {
          const v = q[vi];
          out.push((i + v[0]) * s, (j + v[1]) * s, (k + v[2]) * s, n[0], n[1], n[2], r, g, bl);
        }
      }
    }
    return new Float32Array(out);
  }

  drawVoxels(e) {
    const gl = this.gl, V = e.voxels;
    let cache = this.voxelCache.get(V);
    if (!cache) { cache = new Map(); this.voxelCache.set(V, cache); }
    const rebuild = (key) => {
      const [cx, cz] = key.split(',').map(Number), data = this.buildChunk(V, cx, cz);
      let c = cache.get(key);
      if (!c) { c = { buf: gl.createBuffer(), count: 0 }; cache.set(key, c); }
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      c.count = data.length / 9;
    };
    if (V.allDirty) {
      const b = V.bounds;
      for (let cx = Math.floor(b.i0 / CHUNK); cx <= Math.floor(b.i1 / CHUNK); cx++) for (let cz = Math.floor(b.k0 / CHUNK); cz <= Math.floor(b.k1 / CHUNK); cz++) rebuild(cx + ',' + cz);
      V.allDirty = false; V.dirty.clear();
    } else if (V.dirty.size) { for (const key of V.dirty) rebuild(key); V.dirty.clear(); }
    gl.uniformMatrix4fv(this.u.uModel, false, M4.trs(e.x, e.y, e.z, 0, 0, 0, 1, 1, 1));
    gl.uniformMatrix3fv(this.u.uNormalMat, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    gl.uniform3f(this.u.uColor, 1, 1, 1); gl.uniform1f(this.u.uEmissive, 0); gl.uniform1f(this.u.uOpacity, e.alpha); gl.uniform1f(this.u.uVColor, 1);
    gl.enableVertexAttribArray(2);
    for (const c of cache.values()) {
      if (!c.count) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
      gl.drawArrays(gl.TRIANGLES, 0, c.count);
    }
    gl.disableVertexAttribArray(2); gl.vertexAttrib3f(2, 1, 1, 1);
    gl.uniform1f(this.u.uVColor, 0);
  }

  meshModel(e) {
    const m = e.mesh, [gx, gy0, gz] = partSize(m), gy = m.geometry === 'plane' ? 1 : gy0;
    return M4.trs(e.x, e.y, e.z, e.rx * DEG, e.ry * DEG, e.rz * DEG, e.sx * gx, e.sy * gy, e.sz * gz);
  }

  /** Draw a model: each part is a primitive placed relative to the object. */
  drawModel(e, opacityMul = 1) {
    const base = M4.trs(e.x, e.y, e.z, e.rx * DEG, e.ry * DEG, e.rz * DEG, e.sx, e.sy, e.sz);
    for (const q of e.model.parts) {
      const [gx, gy0, gz] = partSize(q), gy = q.geometry === 'plane' ? 1 : gy0;
      const local = M4.trs(q.x || 0, q.y || 0, q.z || 0, (q.rx || 0) * DEG, (q.ry || 0) * DEG, (q.rz || 0) * DEG, gx, gy, gz);
      this.drawMesh(q.geometry || 'box', M4.mul(base, local), q.color || '#cccccc', q.emissive || 0, (q.opacity ?? 1) * e.alpha * opacityMul);
    }
  }

  render(scene, engine) {
    const gl = this.gl, c = scene.camera, w = this.canvas.width, h = this.canvas.height;
    gl.viewport(0, 0, w, h);
    const bg = hexToRgb(scene.background);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    let eye = c.position;
    if (c.shake > 0) eye = { x: eye.x + rand(-1, 1) * c.shake * 0.02, y: eye.y + rand(-1, 1) * c.shake * 0.02, z: eye.z };
    const aspect = engine.width / engine.height;
    // On portrait screens widen the vertical FOV a little so the scene doesn't feel cramped sideways
    const fovy = aspect < 1 ? 2 * Math.atan(Math.tan(c.fov * DEG / 2) / Math.sqrt(aspect)) : c.fov * DEG;
    this.viewProj = M4.mul(M4.perspective(fovy, aspect, c.near, c.far), M4.lookAt(eye, c.target));
    const L = scene.light, ld = L.dir, ll = Math.hypot(ld.x, ld.y, ld.z) || 1;
    gl.uniformMatrix4fv(this.u.uViewProj, false, this.viewProj);
    gl.uniform3f(this.u.uLightDir, ld.x / ll, ld.y / ll, ld.z / ll);
    gl.uniform3fv(this.u.uLightColor, hexToRgb(L.color));
    gl.uniform1f(this.u.uAmbient, L.ambient);
    gl.uniform3fv(this.u.uFogColor, bg);
    gl.uniform1f(this.u.uFogNear, scene.fog.near); gl.uniform1f(this.u.uFogFar, scene.fog.far);
    gl.uniform3f(this.u.uCamPos, eye.x, eye.y, eye.z);

    const transparent = [], shadows = [];
    for (const e of scene.entities) if (e.voxels && e.visible && !e.dead) this.drawVoxels(e);
    for (const e of scene.entities) {
      if (!e.model || !e.visible || e.dead) continue;
      this.drawModel(e, e.data.invuln > 0 && Math.floor(scene.time * 12) % 2 ? 0.3 : 1);
      if (e.body && e.body.type !== 'static' && !e.body.sensor) shadows.push(e);
    }
    for (const e of scene.entities) {
      if (!e.mesh || !e.visible || e.dead) continue;
      let op = e.mesh.opacity * e.alpha;
      if (e.data.invuln > 0 && Math.floor(scene.time * 12) % 2) op *= 0.3;
      if (op < 1) { transparent.push([e, op]); } else this.drawMesh(e.mesh.geometry, this.meshModel(e), e.mesh.color, e.mesh.emissive);
      if (e.body && e.body.type !== 'static' && !e.body.sensor) shadows.push(e);
    }
    // blob shadows onto the highest static surface below each moving body
    gl.enable(gl.BLEND); gl.depthMask(false);
    const statics = scene.entities.filter((e) => e.body && e.body.type === 'static' && (e.mesh || e.model));
    for (const e of shadows) {
      const ex = e.extents(), r = ex.sphere ? ex.r : Math.max(ex.hx, ex.hz);
      const bottom = e.y - (ex.sphere ? ex.r : ex.hy);
      let ground = -Infinity;
      for (const s of statics) {
        const sx = s.extents(); if (sx.sphere) continue;
        if (Math.abs(e.x - s.x) < sx.hx && Math.abs(e.z - s.z) < sx.hz) { const top = s.y + sx.hy; if (top <= bottom + 0.05 && top > ground) ground = top; }
      }
      for (const w of scene.entities) if (w.voxels) ground = Math.max(ground, w.voxels.groundAt(w, e.x, e.z, bottom + 0.05));
      if (ground === -Infinity) continue;
      const k = clamp(1 - (bottom - ground) / 6, 0.2, 1);
      this.drawMesh('cylinder', M4.trs(e.x, ground + 0.015, e.z, 0, 0, 0, r * 2 * k, 0.01, r * 2 * k), '#000000', 1, 0.28 * k);
    }
    for (const [e, op] of transparent) this.drawMesh(e.mesh.geometry, this.meshModel(e), e.mesh.color, e.mesh.emissive, op);
    for (const p of scene.particles) this.drawMesh('box', M4.trs(p.x, p.y, p.z, 0, 0, 0, p.size, p.size, p.size), p.color, 1, Math.max(0, p.life));
    gl.depthMask(true); gl.disable(gl.BLEND);
    engine.onRenderWorld?.(this, scene);
  }
}

// ============================================================================
// UI overlay (HUD, joystick, buttons, title / game over screens) — always 2D
// ============================================================================
function drawMessage(ctx, scene, W, H, engine) {
  const m = scene.msg;
  if (!m) return;
  const maxW = Math.min(W - 40, 460), size = 18, lines = [];
  ctx.font = `700 ${size}px system-ui, -apple-system, sans-serif`;
  let line = '';
  for (const word of m.text.split(/\s+/)) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW - 32 && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  const h = lines.length * (size + 6) + 24, y = scene.settings.messageTop ? engine.safe.top + H * 0.2 : H - engine.safe.bottom - 130 - h;
  ctx.globalAlpha = Math.min(1, m.t * 3);
  ctx.fillStyle = 'rgba(15,15,25,0.85)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect((W - maxW) / 2, y, maxW, h, 12); else ctx.rect((W - maxW) / 2, y, maxW, h);
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + (size + 6) * i + (size + 6) / 2));
  ctx.globalAlpha = 1;
}

export function anchorPoint(anchor, W, H, safe) {
  const a = anchor || 'top-left';
  const x = a.includes('left') ? safe.left : a.includes('right') ? W - safe.right : W / 2;
  const y = a.startsWith('top') ? safe.top : a.startsWith('bottom') ? H - safe.bottom : H / 2;
  return { x, y };
}

function renderUI(engine, scene) {
  const ctx = engine.uiCtx, W = engine.width, H = engine.height, inp = engine.input;
  ctx.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!scene) return;
  engine.onBeforeUI?.(ctx, scene);
  if (!engine.editing || engine.showUI) {
    const screen = engine.paused ? 'paused' : scene.state;
    for (const e of scene.entities) {
      if (!e.ui || !e.visible || e.dead) continue;
      if (!engine.editing && e.showWhen !== 'always' && e.showWhen !== screen) continue;
      const o = anchorPoint(e.anchor, W, H, engine.safe);
      ctx.save(); ctx.translate(o.x, o.y); drawEntity2D(ctx, e, scene.vars, scene.time); ctx.restore();
    }
  }
  if (engine.editing) return;

  const big = (txt, y, size, color = '#fff') => {
    ctx.font = `900 ${size}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, y);
  };
  const dim = (a = 0.6) => { ctx.fillStyle = `rgba(5,5,15,${a})`; ctx.fillRect(0, 0, W, H); };
  const pulse = 0.6 + Math.sin(performance.now() / 300) * 0.4;

  if (scene.state === 'play' && !engine.paused) {
    ctx.save();
    ctx.globalAlpha = clamp(+scene.settings.controlsOpacity || 1, 0.1, 1);
    const st = scene.settings, useStick = st.joystick && (!st.controls || st.controls === 'auto' || st.controls === 'joystick');
    if (useStick && st.joystickMode === 'fixed' && !inp.stick) {
      const f = inp.fixedStick(), r = inp.stickRadius;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    if (inp.stick) {
      const s = inp.stick, r = inp.stickRadius;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.bx, s.by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    } else if (useStick && st.joystickMode !== 'fixed' && scene.time < 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 * pulse})`; ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Touch & drag here to move', scene.settings.joystickSide === 'right' ? W * 0.75 : W * 0.25, H - engine.safe.bottom - 40);
    }
    for (const b of inp.buttons) {
      ctx.fillStyle = b.id != null ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (b.color) { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = `800 ${b.r * (b.action === 'pause' || b.action === 'mute' ? 0.7 : 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.label, b.x, b.y + 1);
      if (b.action === 'mute' && engine.audio.muted) {
        ctx.strokeStyle = '#ff5d8f'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(b.x - b.r * 0.5, b.y - b.r * 0.5); ctx.lineTo(b.x + b.r * 0.5, b.y + b.r * 0.5); ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (scene.state === 'play' && scene.levelCount > 1 && scene.time < 1.6) {
    ctx.globalAlpha = Math.min(1, (1.6 - scene.time) * 2);
    big(`LEVEL ${scene.level}`, H * 0.3, 36, '#ffffff');
    ctx.globalAlpha = 1;
  }
  drawMessage(ctx, scene, W, H, engine);
  if (scene.rotateNeeded) {
    dim(0.9);
    big('⟳', H * 0.4, 64);
    big(`Turn your device to ${scene.settings.orientation}`, H * 0.52, 18);
    return;
  }
  if (scene.settings.customScreens) return; // the game draws its own title / pause / end screens with UI elements
  if (engine.paused) {
    dim(0.7); big('PAUSED', H * 0.42, 40); big('Tap to resume', H * 0.52, 18, `rgba(255,255,255,${pulse})`);
  } else if (scene.state === 'title') {
    dim(0.55);
    const t = scene.settings.title;
    big(t, H * 0.38, Math.min(64, W * 0.9 / Math.max(4, t.length) * 1.6), '#ffffff');
    if (scene.settings.subtitle) big(scene.settings.subtitle, H * 0.47, 17, 'rgba(220,225,255,0.85)');
    if (scene.vars.best) big(`Best: ${scene.vars.best}`, H * 0.53, 16, 'rgba(220,225,255,0.7)');
    big('Tap to start', H * 0.66, 22, `rgba(255,255,255,${pulse})`);
  } else if (scene.state === 'over' || scene.state === 'win') {
    if (scene.time - (scene.endTime ?? scene.time) < 0.5) { drawMessage(ctx, scene, W, H, engine); return; }
    dim(0.65);
    if (scene.levelComplete) {
      big(`LEVEL ${scene.level} COMPLETE`, H * 0.34, Math.min(40, W / 11), '#5dff8a');
      big(String(Math.floor(scene.vars.score || 0)), H * 0.46, 64, '#ffd23d');
      big('Tap for the next level', H * 0.62, 20, `rgba(255,255,255,${pulse})`);
      return;
    }
    big(scene.state === 'win' ? 'YOU WIN!' : 'GAME OVER', H * 0.34, 44, scene.state === 'win' ? '#5dff8a' : '#ff5d8f');
    big(String(Math.floor(scene.vars.score || 0)), H * 0.46, 64, '#ffd23d');
    if (scene.newBest) big('NEW BEST!', H * 0.54, 16, '#5dff8a');
    else if (scene.vars.best) big(`Best: ${scene.vars.best}`, H * 0.54, 16, 'rgba(220,225,255,0.7)');
    big('Tap to play again', H * 0.66, 20, `rgba(255,255,255,${pulse})`);
    if (scene.settings.shareButton && (navigator.share || navigator.clipboard)) {
      const w = 150, h = 46, x = W / 2 - w / 2, y = H * 0.74;
      engine.shareRect = { x, y, w, h };
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, 23); else ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
      big('Share score', y + h / 2, 17);
    } else engine.shareRect = null;
  }
}

// ============================================================================
// Behaviors — reusable, data-driven logic the editor can attach to entities.
// Each has a params schema (used to build editor forms) and create(params) => hooks:
//   start(entity, scene) · update(entity, dt, scene) · collide(entity, other, scene) · destroy(entity, scene)
// ============================================================================
export const Behaviors = {};
/** Default value of a behavior param for a 2D or 3D entity. */
export const paramDefault = (p, threeD) => (threeD && p.default3d !== undefined ? p.default3d : p.default);
export function registerBehavior(type, def) { Behaviors[type] = def; }
const is3D = (e) => !!(e.mesh || e.voxels || e.model || e.scene?.mode === '3d');

function respawnOrEnd(player, s, action) {
  if (action === 'respawn' || (action === 'damage' && s.vars.lives > 1)) {
    if (action === 'damage') s.addVar('lives', -1);
    s.engine.audio.sfx('hit'); s.engine.vibrate(60); s.camera.shake = is3D(player) ? 12 : 10;
    s.burst(player.x, player.y, player.z, player.mesh?.color || player.shape?.fill || '#fff', 14);
    if (action === 'respawn' || player.data.respawnOnHit) {
      const sp = player.data.respawn || player.props;
      player.x = sp.x || 0; player.y = sp.y || 0; player.z = sp.z || 0;
      if (player.body) player.body.vel = { x: 0, y: 0, z: 0 };
    }
    player.data.invuln = 1.2;
    return;
  }
  if (action === 'damage') s.setVar('lives', 0);
  s.engine.audio.sfx('hit');
  s.camera.shake = 18;
  const col = player.mesh?.color || player.shape?.fill || '#fff';
  s.burst(player.x, player.y, player.z, col, 40, 1.4);
  player.visible = false;
  player.destroy();
  s.gameOver();
}

registerBehavior('move', {
  label: 'Move', description: 'Player movement with the joystick, dragging, or tilting the phone.',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 260, default3d: 7 },
    { key: 'control', label: 'Control', type: 'select', options: ['joystick', 'drag', 'both', 'tilt'], default: 'both' },
    { key: 'axes', label: 'Axes', type: 'select', options: ['all', 'horizontal', 'vertical'], default: 'all' },
    { key: 'keepInView', label: 'Keep on screen (2D)', type: 'bool', default: true },
    { key: 'face', label: 'Face direction (3D)', type: 'bool', default: true },
  ],
  create(p) {
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic', gravityScale: is3D(e) ? 1 : 0 });
        if (p.control === 'tilt') s.engine.input.useTilt = true;
      },
      update(e, dt, s) {
        const inp = s.engine.input, a = p.control === 'drag' ? { x: 0, y: 0 } : inp.axis();
        const ax = p.axes === 'vertical' ? 0 : a.x, ay = p.axes === 'horizontal' ? 0 : a.y, b = e.body;
        const d = p.control === 'drag' || p.control === 'both' ? inp.drag : { dx: 0, dy: 0 };
        if (is3D(e)) {
          b.vel.x = ax * p.speed; b.vel.z = ay * p.speed;
          const k = 0.025 * p.speed / 7;
          if (p.axes !== 'vertical') e.x += d.dx * k;
          if (p.axes !== 'horizontal') e.z += d.dy * k;
          if (p.face && (Math.abs(ax) + Math.abs(ay) > 0.1)) {
            const target = Math.atan2(ax, ay) / DEG;
            let diff = ((target - e.ry + 540) % 360) - 180;
            e.ry += diff * Math.min(1, dt * 12);
          }
        } else {
          b.vel.x = ax * p.speed;
          if (s.gravity === 0 || b.gravityScale === 0) b.vel.y = ay * p.speed;
          const z = s.engine.renderer.zoomFor(s);
          if (p.axes !== 'vertical') e.x += d.dx / z * 1.2;
          if (p.axes !== 'horizontal') e.y += d.dy / z * 1.2;
          if (p.keepInView) {
            const v = s.viewBounds(), ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy;
            e.x = clamp(e.x, v.left + hx, v.right - hx);
            e.y = clamp(e.y, v.top + hy, v.bottom - hy - s.engine.safe.bottom / z);
          }
        }
      },
    };
  },
});

registerBehavior('platformer', {
  label: 'Platformer', description: 'Run & jump. Uses gravity; tap or the jump button to jump.',
  params: [
    { key: 'speed', label: 'Run speed', type: 'number', default: 240, default3d: 7 },
    { key: 'jump', label: 'Jump power', type: 'number', default: 620, default3d: 10 },
    { key: 'doubleJump', label: 'Double jump', type: 'bool', default: false },
    { key: 'onFall', label: 'When falling off', type: 'select', options: ['gameover', 'respawn', 'damage'], default: 'respawn' },
    { key: 'accel', label: 'Acceleration (0 = instant)', type: 'number', default: 0, default3d: 0, advanced: true },
    { key: 'airControl', label: 'Air control (0–1)', type: 'number', default: 1, advanced: true },
    { key: 'variableJump', label: 'Short hop when tapping jump', type: 'bool', default: true, advanced: true },
    { key: 'faceDirection', label: 'Flip to face movement (2D)', type: 'bool', default: true, advanced: true },
  ],
  create(p) {
    let coyote = 0, jumps = 0, rising = false;
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic' });
        if (!s.gravity) s.gravity = is3D(e) ? -25 : 1600;
      },
      update(e, dt, s) {
        const inp = s.engine.input, a = inp.axis(), b = e.body, up = is3D(e) ? 1 : -1;
        const ctl = b.grounded ? 1 : clamp(p.airControl ?? 1, 0, 1);
        const steer = (cur, want) => (p.accel ? cur + clamp(want - cur, -p.accel * ctl * dt, p.accel * ctl * dt) : cur + (want - cur) * ctl);
        b.vel.x = steer(b.vel.x, a.x * p.speed);
        if (is3D(e)) b.vel.z = steer(b.vel.z, a.y * p.speed);
        if (b.grounded) { coyote = 0.12; jumps = 0; } else coyote -= dt;
        if (inp.pressed('jump') && (coyote > 0 || (p.doubleJump && jumps < 2))) {
          b.vel.y = p.jump * up; coyote = 0; jumps = jumps ? jumps + 1 : 1; rising = true;
          s.engine.audio.sfx('jump');
        }
        // let go of the jump button early for a shorter hop
        const hasBtn = inp.buttons.some((q) => q.action === 'jump'); // tap-to-jump fires on release, so only with a button
        if (rising && p.variableJump && hasBtn && !inp.isDown('jump') && b.vel.y * up > 0) { b.vel.y *= 0.5; rising = false; }
        if (b.vel.y * up <= 0) rising = false;
        if (!is3D(e) && a.x && p.faceDirection !== false) {
          if (e.shape?.type === 'emoji') e.data.flipX = a.x > 0; else if (e.sprite) e.sx = Math.abs(e.sx) * (a.x < 0 ? -1 : 1);
        }
        const fell = is3D(e) ? e.y < -25 : e.y > s.view.height + 600;
        if (fell) respawnOrEnd(e, s, p.onFall);
      },
    };
  },
});

registerBehavior('rotate', {
  label: 'Rotate', description: 'Spin continuously.',
  params: [
    { key: 'speed', label: 'Degrees / sec', type: 'number', default: 90 },
    { key: 'axis', label: 'Axis', type: 'select', options: ['x', 'y', 'z'], default: 'z', default3d: 'y' },
  ],
  create(p) { return { update(e, dt) { e['r' + p.axis] += p.speed * dt; } }; },
});

registerBehavior('patrol', {
  label: 'Patrol', description: 'Move back and forth from the start point.',
  params: [
    { key: 'dx', label: 'Distance X', type: 'number', default: 120, default3d: 4 },
    { key: 'dy', label: 'Distance Y', type: 'number', default: 0 },
    { key: 'dz', label: 'Distance Z (3D)', type: 'number', default: 0 },
    { key: 'duration', label: 'Seconds per trip', type: 'number', default: 2 },
  ],
  create(p) {
    let t = 0, ox, oy, oz;
    return {
      start(e) { ox = e.x; oy = e.y; oz = e.z; },
      update(e, dt) {
        t += dt; const k = 0.5 - 0.5 * Math.cos(t / Math.max(0.1, p.duration) * Math.PI);
        e.x = ox + p.dx * k; e.y = oy + p.dy * k; e.z = oz + p.dz * k;
      },
    };
  },
});

registerBehavior('velocity', {
  label: 'Velocity', description: 'Move at a constant speed. Give a min–max range for random speeds.',
  params: [
    { key: 'vx', label: 'Speed X', type: 'range', default: 0 },
    { key: 'vy', label: 'Speed Y', type: 'range', default: 200, default3d: 0 },
    { key: 'vz', label: 'Speed Z (3D)', type: 'range', default: 0, default3d: 6 },
  ],
  create(p) {
    let v;
    return {
      start(e) {
        const m = e.data.speedMul || 1;
        v = { x: pick(p.vx) * m, y: pick(p.vy) * m, z: pick(p.vz) * m };
      },
      update(e, dt) { e.x += v.x * dt; e.y += v.y * dt; e.z += v.z * dt; },
    };
  },
});

registerBehavior('spawner', {
  label: 'Spawner', description: 'Spawn copies of a template object over time, at random positions in a range.',
  params: [
    { key: 'template', label: 'Template name', type: 'template', default: '' },
    { key: 'every', label: 'Every (sec)', type: 'range', default: 1 },
    { key: 'x', label: 'X range', type: 'range', default: [20, 380], default3d: [-8, 8] },
    { key: 'y', label: 'Y range', type: 'range', default: -40, default3d: 1 },
    { key: 'z', label: 'Z range (3D)', type: 'range', default: 0, default3d: -40 },
    { key: 'relative', label: 'Relative to this object', type: 'bool', default: false },
    { key: 'ramp', label: 'Speed-up per 10s', type: 'number', default: 0.1 },
    { key: 'max', label: 'Max alive', type: 'number', default: 60 },
    { key: 'snap', label: 'Snap positions to (0 = off)', type: 'number', default: 0 },
    { key: 'clear', label: 'Keep clear of others (0 = off)', type: 'number', default: 0 },
  ],
  create(p) {
    let t = 0.5; const alive = [];
    return {
      update(e, dt, s) {
        const mul = 1 + (p.ramp || 0) * (s.time / 10);
        t -= dt * mul;
        if (t > 0) return;
        t = Math.max(0.05, pick(p.every));
        for (let i = alive.length - 1; i >= 0; i--) if (alive[i].dead) alive.splice(i, 1);
        if (alive.length >= p.max) return;
        const ox = p.relative ? e.x : 0, oy = p.relative ? e.y : 0, oz = p.relative ? e.z : 0;
        const sn = (v) => (p.snap ? Math.round(v / p.snap) * p.snap : v);
        const pos = { x: ox + sn(pick(p.x)), y: oy + pick(p.y), z: oz + sn(pick(p.z)) };
        // don't drop things on top of each other (e.g. a coin inside a barrier)
        if (p.clear && s.entities.some((o) => o.spawned && !o.dead && Math.abs(o.x - pos.x) < p.clear && Math.abs(o.y - pos.y) < p.clear * (s.mode === '3d' ? 2 : 1) && Math.abs(o.z - pos.z) < p.clear)) return;
        const c = s.spawn(p.template, pos);
        if (c) c.spawned = true;
        if (c) { c.data.speedMul = Math.min(3, mul); alive.push(c); }
      },
    };
  },
});

registerBehavior('shooter', {
  label: 'Shooter', description: 'Fire copies of a template (give the template a Velocity).',
  params: [
    { key: 'template', label: 'Bullet template', type: 'template', default: '' },
    { key: 'every', label: 'Fire rate (sec)', type: 'number', default: 0.25 },
    { key: 'trigger', label: 'Fire when', type: 'select', options: ['auto', 'action button', 'tap'], default: 'auto' },
  ],
  create(p) {
    let t = 0;
    return {
      start(e, s) { if (p.trigger === 'action button') { s.settings.actionButton = true; s.engine.layoutButtons(); } },
      update(e, dt, s) {
        t -= dt;
        if (t > 0) return;
        const inp = s.engine.input;
        if (p.trigger === 'action button' && !inp.isDown('action')) return;
        if (p.trigger === 'tap' && !inp.pressed('tap')) return;
        t = p.every;
        // bullets leave from the eye (first person) and face where the shooter faces
        const o = { x: e.x, y: e.y + (e.data.eyeY || 0), z: e.z, rx: e.data.aimPitch || 0, ry: e.ry, rz: e.rz };
        if (is3D(e)) { // start a little in front so the bullet doesn't fill the camera
          const ry = (e.ry || 0) * DEG, rx = o.rx * DEG;
          o.x += -Math.sin(ry) * Math.cos(rx) * 0.9; o.y += Math.sin(rx) * 0.9; o.z += -Math.cos(ry) * Math.cos(rx) * 0.9;
        }
        s.spawn(p.template, o);
      },
    };
  },
});

registerBehavior('destroyOffscreen', {
  label: 'Destroy off-screen', description: 'Remove the object once it leaves the view.',
  params: [{ key: 'margin', label: 'Margin', type: 'number', default: 120, default3d: 60 }],
  create(p) {
    return {
      update(e, dt, s) {
        if (is3D(e)) {
          const c = s.camera.target;
          if (e.y < -30 || Math.hypot(e.x - c.x, e.z - c.z) > p.margin) e.destroy();
        } else {
          const v = s.viewBounds();
          if (e.x < v.left - p.margin || e.x > v.right + p.margin || e.y < v.top - p.margin * 4 || e.y > v.bottom + p.margin) e.destroy();
        }
      },
    };
  },
});

registerBehavior('lifetime', {
  label: 'Lifetime', description: 'Remove the object after some seconds.',
  params: [{ key: 'seconds', label: 'Seconds', type: 'number', default: 3 }],
  create(p) { let t = 0; return { update(e, dt) { if ((t += dt) > p.seconds) e.destroy(); } }; },
});

registerBehavior('collectible', {
  label: 'Collectible', description: 'Adds to the score when the player touches it.',
  params: [
    { key: 'score', label: 'Points', type: 'number', default: 10 },
    { key: 'var', label: 'Variable', type: 'text', default: 'score' },
    { key: 'tag', label: 'Collected by tag', type: 'text', default: 'player' },
    { key: 'sound', label: 'Sound', type: 'select', options: ['coin', 'power', 'jump', 'click', 'none'], default: 'coin' },
  ],
  create(p) {
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || e.dead) return;
        s.addVar(p.var, p.score);
        if (p.sound !== 'none') s.engine.audio.sfx(p.sound);
        s.engine.vibrate(12);
        s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#ffd23d', 14, 0.8);
        e.destroy();
      },
    };
  },
});

registerBehavior('hazard', {
  label: 'Hazard', description: 'Hurts the player on touch.',
  params: [
    { key: 'action', label: 'On touch', type: 'select', options: ['gameover', 'damage', 'respawn'], default: 'gameover' },
    { key: 'tag', label: 'Hurts tag', type: 'text', default: 'player' },
    { key: 'destroySelf', label: 'Destroy self on hit', type: 'bool', default: false },
  ],
  create(p) {
    return {
      start(e, s) { if (!e.body) e.setBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || other.dead || s.state !== 'play' || e.data.blinkOff) return;
        if (other.data.invuln > 0) return;
        if (other.data.shield > 0) {
          other.data.shield = 0; s.engine.audio.sfx('hit');
          s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.stroke || e.shape?.fill || '#f3a', 20); e.destroy();
          return;
        }
        if (p.destroySelf) e.destroy();
        respawnOrEnd(other, s, p.action);
      },
    };
  },
});

registerBehavior('goal', {
  label: 'Goal', description: 'The player wins when touching this.',
  params: [{ key: 'tag', label: 'Reached by tag', type: 'text', default: 'player' }],
  create(p) {
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) { if (other.has(p.tag)) { s.burst(e.x, e.y, e.z, '#5dff8a', 40, 1.2); s.win(); } },
    };
  },
});

registerBehavior('spring', {
  label: 'Spring', description: 'Bounces the player upward on touch.',
  params: [
    { key: 'power', label: 'Power', type: 'number', default: 900, default3d: 16 },
    { key: 'tag', label: 'Tag', type: 'text', default: 'player' },
  ],
  create(p) {
    return {
      collide(e, other, s) {
        if (!other.has(p.tag) || !other.body) return;
        other.body.vel.y = is3D(e) ? p.power : -p.power; s.engine.audio.sfx('jump');
      },
    };
  },
});

registerBehavior('cameraFollow', {
  label: 'Camera follow', description: 'The camera tracks this object.',
  params: [
    { key: 'smooth', label: 'Smoothness', type: 'number', default: 6 },
    { key: 'axes', label: 'Follow axes (2D)', type: 'select', options: ['both', 'x', 'y'], default: 'both' },
    { key: 'ox', label: 'Offset X', type: 'number', default: 0 },
    { key: 'oy', label: 'Offset Y', type: 'number', default: 0, default3d: 7 },
    { key: 'oz', label: 'Offset Z (3D)', type: 'number', default: 0, default3d: 11 },
  ],
  create(p) {
    return {
      start(e, s) {
        const c = s.camera;
        if (is3D(e)) { c.target = { x: e.x, y: e.y, z: e.z }; c.position = { x: e.x + p.ox, y: e.y + p.oy, z: e.z + p.oz }; }
        else { if (p.axes !== 'y') c.x = e.x + p.ox; if (p.axes !== 'x') c.y = e.y + p.oy; }
      },
      update(e, dt, s) {
        const c = s.camera, k = 1 - Math.exp(-p.smooth * dt);
        if (is3D(e)) {
          c.target.x += (e.x - c.target.x) * k; c.target.y += (e.y - c.target.y) * k; c.target.z += (e.z - c.target.z) * k;
          c.position = { x: c.target.x + p.ox, y: c.target.y + p.oy, z: c.target.z + p.oz };
        } else {
          if (p.axes !== 'y') c.x += (e.x + p.ox - c.x) * k;
          if (p.axes !== 'x') c.y += (e.y + p.oy - c.y) * k;
        }
      },
    };
  },
});

registerBehavior('wrap', {
  label: 'Screen wrap', description: 'Leaving one edge brings it back on the other (2D).',
  params: [],
  create() {
    return {
      update(e, dt, s) {
        const v = s.viewBounds(), w = v.right - v.left, h = v.bottom - v.top;
        if (e.x < v.left) e.x += w; else if (e.x > v.right) e.x -= w;
        if (e.y < v.top) e.y += h; else if (e.y > v.bottom) e.y -= h;
      },
    };
  },
});

registerBehavior('timeScore', {
  label: 'Score over time', description: 'Adds points every second while playing.',
  params: [{ key: 'rate', label: 'Points / sec', type: 'number', default: 10 }],
  create(p) { return { update(e, dt, s) { s.addVar('score', p.rate * dt); } }; },
});

registerBehavior('chase', {
  label: 'Chase', description: 'Moves toward the player when it gets close.',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 110, default3d: 3.5 },
    { key: 'range', label: 'Notice range (0 = always)', type: 'number', default: 320, default3d: 10 },
    { key: 'tag', label: 'Chase tag', type: 'text', default: 'player' },
  ],
  create(p) {
    let target = null;
    return {
      update(e, dt, s) {
        if (!target || target.dead) target = s.findAll(p.tag)[0];
        if (!target) return;
        const dx = target.x - e.x, dy = is3D(e) ? 0 : target.y - e.y, dz = is3D(e) ? target.z - e.z : 0;
        const d = Math.hypot(dx, dy, dz);
        if (d < 1e-3 || (p.range && d > p.range)) return;
        const k = Math.min(d, p.speed * dt) / d;
        e.x += dx * k; e.y += dy * k; e.z += dz * k;
        if (is3D(e)) e.ry = Math.atan2(dx, dz) / DEG;
      },
    };
  },
});

registerBehavior('float', {
  label: 'Float', description: 'Bobs gently up and down.',
  params: [
    { key: 'amount', label: 'Height', type: 'number', default: 8, default3d: 0.25 },
    { key: 'period', label: 'Seconds per bob', type: 'number', default: 1.6 },
  ],
  create(p) {
    let t = Math.random() * 10, base = null;
    return {
      start(e) { base = e.y; },
      update(e, dt) { t += dt; e.y = base + Math.sin(t / Math.max(0.1, p.period) * Math.PI * 2) * p.amount * (is3D(e) ? 1 : -1); },
    };
  },
});

registerBehavior('message', {
  label: 'Message', description: 'Shows a message when the player touches it (signs, hints, story).',
  params: [
    { key: 'text', label: 'Message', type: 'text', default: 'Hello there!' },
    { key: 'seconds', label: 'Show for (sec)', type: 'number', default: 3 },
    { key: 'once', label: 'Only once', type: 'bool', default: true },
    { key: 'tag', label: 'Shown to tag', type: 'text', default: 'player' },
  ],
  create(p) {
    let shown = false;
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || (p.once && shown)) return;
        shown = true; s.message(p.text, p.seconds); s.engine.audio.sfx('click');
      },
    };
  },
});

registerBehavior('teleport', {
  label: 'Teleport', description: 'Sends the player to another object (by name).',
  params: [
    { key: 'target', label: 'Destination name', type: 'text', default: '' },
    { key: 'tag', label: 'Teleports tag', type: 'text', default: 'player' },
  ],
  create(p) {
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || (other.data.tpUntil || 0) > s.time) return;
        const dest = s.find(p.target);
        if (!dest || dest === e) return;
        s.burst(other.x, other.y, other.z, '#a77bff', 16);
        other.x = dest.x; other.y = dest.y; other.z = dest.z;
        if (other.body) other.body.vel = { x: 0, y: 0, z: 0 };
        other.data.tpUntil = s.time + 0.8;
        s.burst(dest.x, dest.y, dest.z, '#a77bff', 16);
        s.engine.audio.sfx('power');
      },
    };
  },
});

registerBehavior('unlock', {
  label: 'Unlock', description: 'Disappears once a variable reaches an amount, e.g. a door that opens with keys.',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'keys' },
    { key: 'amount', label: 'Needed', type: 'number', default: 1 },
    { key: 'text', label: 'Message when opened', type: 'text', default: 'Unlocked!' },
  ],
  create(p) {
    return {
      update(e, dt, s) {
        if ((+s.vars[p.var] || 0) < p.amount) return;
        s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#fff', 30, 1.2);
        if (p.text) s.message(p.text, 2);
        s.engine.audio.sfx('power');
        e.destroy();
      },
    };
  },
});

registerBehavior('sound', {
  label: 'Sound', description: 'Plays a sound when the game starts or when touched.',
  params: [
    { key: 'sound', label: 'Sound', type: 'select', options: ['coin', 'jump', 'hit', 'power', 'win', 'lose', 'click'], default: 'power' },
    { key: 'when', label: 'When', type: 'select', options: ['touched', 'start'], default: 'touched' },
    { key: 'tag', label: 'Touched by tag', type: 'text', default: 'player' },
  ],
  create(p) {
    return {
      start(e, s) { if (p.when === 'start') s.engine.audio.sfx(p.sound); else { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); } },
      collide(e, other, s) { if (p.when === 'touched' && other.has(p.tag)) s.engine.audio.sfx(p.sound); },
    };
  },
});

/** Is a screen point (CSS px) on this entity? Used by tap and drag components. */
function hitTest(s, e, sx, sy) {
  const eng = s.engine;
  if (e.ui) {
    const o = anchorPoint(e.anchor, eng.width, eng.height, eng.safe), ex = e.extents();
    const hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy;
    return Math.abs(sx - o.x - e.x) <= hx + 8 && Math.abs(sy - o.y - e.y) <= hy + 8;
  }
  const ex = e.extents();
  if (s.mode === '2d') {
    const w = eng.renderer.screenToWorld(s, sx, sy), pad = 10 / eng.renderer.zoomFor(s);
    return ex.sphere ? Math.hypot(w.x - e.x, w.y - e.y) <= ex.r + pad : Math.abs(w.x - e.x) <= ex.hx + pad && Math.abs(w.y - e.y) <= ex.hy + pad;
  }
  const p = eng.renderer.worldToScreen(s, e.x, e.y, e.z);
  if (p.behind) return false;
  const edge = eng.renderer.worldToScreen(s, e.x + (ex.sphere ? ex.r : Math.max(ex.hx, ex.hz)), e.y, e.z);
  return Math.hypot(sx - p.x, sy - p.y) <= Math.max(24, Math.hypot(edge.x - p.x, edge.y - p.y) * 1.2);
}
/** World point under a screen point (2D), or on the horizontal plane at height y (3D). */
function screenToWorldAt(s, sx, sy, y) {
  const eng = s.engine;
  if (s.mode === '2d') return eng.renderer.screenToWorld(s, sx, sy);
  const r = eng.renderer.screenRay(s, sx, sy);
  if (Math.abs(r.dir.y) < 1e-6) return null;
  const t = (y - r.origin.y) / r.dir.y;
  return t < 0 ? null : { x: r.origin.x + r.dir.x * t, y, z: r.origin.z + r.dir.z * t };
}

registerBehavior('tappable', {
  label: 'Tap Target', description: 'The player taps it on screen to score (clicker, whack-a-mole, bubble games).',
  params: [
    { key: 'points', label: 'Points', type: 'number', default: 10 },
    { key: 'var', label: 'Adds to variable', type: 'text', default: 'score' },
    { key: 'bonusVar', label: 'Extra points from variable', type: 'text', default: '' },
    { key: 'destroy', label: 'Disappear when tapped', type: 'bool', default: true },
    { key: 'sound', label: 'Sound', type: 'select', options: ['coin', 'power', 'click', 'hit', 'none'], default: 'coin' },
  ],
  create(p) {
    return {
      update(e, dt, s) {
        for (const t of s.engine.input.taps) {
          if (e.dead || !hitTest(s, e, t.x, t.y)) continue;
          s.addVar(p.var || 'score', p.points + (p.bonusVar ? +s.vars[p.bonusVar] || 0 : 0));
          if (p.sound !== 'none') s.engine.audio.sfx(p.sound);
          s.engine.vibrate(10);
          s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#ffd23d', 14, 0.8);
          if (p.destroy) e.destroy(); else { const k = e.sx; e.sx = e.sy = k * 1.25; s.tween(e, { sx: k, sy: k }, 0.2); }
        }
      },
    };
  },
});

registerBehavior('draggable', {
  label: 'Draggable', description: 'The player can pick it up and move it with a finger (puzzles, sorting games).',
  params: [
    { key: 'snap', label: 'Snap to grid', type: 'number', default: 0 },
    { key: 'lift', label: 'Grow while held', type: 'bool', default: true },
  ],
  create(p) {
    let grab = null;
    return {
      update(e, dt, s) {
        const inp = s.engine.input;
        if (!grab) {
          const d = inp.downs.find((q) => hitTest(s, e, q.x, q.y));
          if (!d) return;
          const w = screenToWorldAt(s, d.x, d.y, e.y);
          if (!w) return;
          grab = { id: d.id, ox: e.x - w.x, oy: e.y - w.y, oz: e.z - (w.z || 0), sx: e.sx, sy: e.sy };
          inp.downs.splice(inp.downs.indexOf(d), 1);
          if (p.lift) { e.sx *= 1.12; e.sy *= 1.12; }
          s.engine.vibrate(8);
        }
        const ptr = inp.pointers.get(grab.id);
        if (!ptr) {
          if (p.snap) { e.x = Math.round(e.x / p.snap) * p.snap; e.y = Math.round(e.y / p.snap) * p.snap; if (is3D(e)) e.z = Math.round(e.z / p.snap) * p.snap; }
          e.sx = grab.sx; e.sy = grab.sy; grab = null;
          return;
        }
        inp.drag.dx = 0; inp.drag.dy = 0; // don't also steer the player
        const w = screenToWorldAt(s, ptr.x, ptr.y, e.y);
        if (!w) return;
        if (is3D(e)) { e.x = w.x + grab.ox; e.z = w.z + grab.oz; } else { e.x = w.x + grab.ox; e.y = w.y + grab.oy; }
        if (e.body) e.body.vel = { x: 0, y: 0, z: 0 };
      },
    };
  },
});

registerBehavior('swipeMove', {
  label: 'Swipe Lanes', description: 'Swipe left/right to change lanes, swipe up to jump (endless-runner controls).',
  params: [
    { key: 'distance', label: 'Lane width', type: 'number', default: 110, default3d: 2.5 },
    { key: 'lanes', label: 'Lanes', type: 'number', default: 3 },
    { key: 'jump', label: 'Swipe-up jump power (0 = off)', type: 'number', default: 0, default3d: 9 },
  ],
  create(p) {
    let lane = 0, home = 0;
    return {
      start(e, s) {
        home = e.x;
        // a real body so the runner can jump, land, and get hit
        const b = e.body && e.body.type === 'dynamic' ? e.body : e.setBody({ type: 'dynamic' });
        if (!is3D(e) && !p.jump) b.gravityScale = 0;
        if (p.jump && !s.gravity) s.gravity = is3D(e) ? -25 : 1600;
      },
      update(e, dt, s) {
        const inp = s.engine.input, max = Math.floor((p.lanes - 1) / 2);
        if (inp.pressed('swipe:left')) lane = Math.max(-max, lane - 1);
        if (inp.pressed('swipe:right')) lane = Math.min(max, lane + 1);
        if (p.jump && e.body && e.body.grounded && inp.pressed('swipe:up')) {
          e.body.vel.y = is3D(e) ? p.jump : -p.jump; s.engine.audio.sfx('jump');
        }
        e.x += (home + lane * p.distance - e.x) * Math.min(1, dt * 14);
      },
    };
  },
});

registerBehavior('orbit', {
  label: 'Orbit', description: 'Circles around its starting point.',
  params: [
    { key: 'radius', label: 'Radius', type: 'number', default: 80, default3d: 3 },
    { key: 'speed', label: 'Degrees / sec', type: 'number', default: 90 },
  ],
  create(p) {
    let cx, cy, cz, a = 0;
    return {
      start(e) { cx = e.x; cy = e.y; cz = e.z; },
      update(e, dt) {
        a += p.speed * dt * DEG;
        e.x = cx + Math.cos(a) * p.radius;
        if (is3D(e)) e.z = cz + Math.sin(a) * p.radius; else e.y = cy + Math.sin(a) * p.radius;
      },
    };
  },
});

registerBehavior('pulse', {
  label: 'Pulse', description: 'Grows and shrinks to draw attention.',
  params: [
    { key: 'amount', label: 'Size change', type: 'number', default: 0.15 },
    { key: 'period', label: 'Seconds per pulse', type: 'number', default: 0.8 },
  ],
  create(p) {
    let t = 0, base;
    return {
      start(e) { base = { x: e.sx, y: e.sy, z: e.sz }; },
      update(e, dt) {
        t += dt; const k = 1 + Math.sin(t / Math.max(0.1, p.period) * Math.PI * 2) * p.amount;
        e.sx = base.x * k; e.sy = base.y * k; e.sz = base.z * k;
      },
    };
  },
});

registerBehavior('checkpoint', {
  label: 'Checkpoint', description: 'The player respawns here after falling or getting hurt.',
  params: [
    { key: 'text', label: 'Message', type: 'text', default: 'Checkpoint!' },
    { key: 'tag', label: 'Saved by tag', type: 'text', default: 'player' },
  ],
  create(p) {
    let hit = false;
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || hit) return;
        hit = true;
        other.data.respawn = { x: e.x, y: is3D(e) ? e.y + 1 : e.y - 20, z: e.z };
        other.data.respawnOnHit = true;
        if (e.shape) e.shape.fill = '#5dff8a'; if (e.mesh) e.mesh.color = '#5dff8a';
        if (p.text) s.message(p.text, 1.5);
        s.engine.audio.sfx('power');
        s.burst(e.x, e.y, e.z, '#5dff8a', 18);
      },
    };
  },
});

registerBehavior('destructible', {
  label: 'Health', description: 'Takes hits from objects with a tag (like bullets) and breaks when health runs out.',
  params: [
    { key: 'hp', label: 'Health', type: 'number', default: 3 },
    { key: 'hitBy', label: 'Hurt by tag', type: 'text', default: 'bullet' },
    { key: 'points', label: 'Points when destroyed', type: 'number', default: 10 },
    { key: 'removeHitter', label: 'Remove what hit it', type: 'bool', default: true },
  ],
  create(p) {
    let hp;
    return {
      start(e, s) { hp = p.hp; e.data.hp = hp; e.data.hpMax = p.hp; e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.hitBy); },
      collide(e, other, s) {
        if (!other.has(p.hitBy) || e.dead) return;
        if (p.removeHitter) other.destroy();
        hp--; e.data.hp = hp;
        e.data.invuln = 0.15;
        s.engine.audio.sfx(hp > 0 ? 'click' : 'hit');
        if (hp > 0) return;
        s.addVar('score', p.points);
        s.camera.shake = Math.max(s.camera.shake, 6);
        s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#ff8a3d', 26, 1.1);
        e.destroy();
      },
    };
  },
});

// ---- camera & vehicle controllers for different game types ----
const fwd3 = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });   // facing direction for a yaw (radians); yaw 0 looks toward -z
const right3 = (yaw) => ({ x: Math.cos(yaw), z: -Math.sin(yaw) });

registerBehavior('firstPerson', {
  label: 'First Person', description: 'First-person controls: joystick to walk, drag the screen to look around. Pair with Shooter for an FPS.',
  params: [
    { key: 'speed', label: 'Walk speed', type: 'number', default: 6 },
    { key: 'look', label: 'Look sensitivity', type: 'number', default: 0.25 },
    { key: 'eye', label: 'Eye height above center', type: 'number', default: 0.6 },
    { key: 'jump', label: 'Jump power (0 = off)', type: 'number', default: 9 },
  ],
  create(p) {
    let yaw = 0, pitch = 0;
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic' });
        if (!s.gravity) s.gravity = -25;
        yaw = (e.ry || 0) * DEG; e.visible = false; e.data.eyeY = p.eye;
        s.settings.joystick = true; s.engine.layoutButtons();
        s.camera.near = 0.05;
      },
      update(e, dt, s) {
        const inp = s.engine.input, a = inp.axis(), b = e.body;
        yaw -= inp.drag.dx * p.look * DEG; pitch = clamp(pitch - inp.drag.dy * p.look * DEG, -1.4, 1.4);
        const f = fwd3(yaw), r = right3(yaw);
        b.vel.x = (f.x * -a.y + r.x * a.x) * p.speed;
        b.vel.z = (f.z * -a.y + r.z * a.x) * p.speed;
        if (p.jump && b.grounded && inp.pressed('jump')) { b.vel.y = p.jump; s.engine.audio.sfx('jump'); }
        e.ry = yaw / DEG; e.data.aimPitch = pitch / DEG;
        const eye = { x: e.x, y: e.y + p.eye, z: e.z }, cp = Math.cos(pitch);
        s.camera.position = eye;
        s.camera.target = { x: eye.x + f.x * cp, y: eye.y + Math.sin(pitch), z: eye.z + f.z * cp };
        if (e.y < -25) respawnOrEnd(e, s, 'respawn');
      },
    };
  },
});

registerBehavior('thirdPerson', {
  label: 'Third Person', description: 'Over-the-shoulder controls: joystick moves relative to the camera, drag the screen to turn the camera.',
  params: [
    { key: 'speed', label: 'Run speed', type: 'number', default: 6 },
    { key: 'jump', label: 'Jump power (0 = off)', type: 'number', default: 10 },
    { key: 'distance', label: 'Camera distance', type: 'number', default: 7 },
    { key: 'height', label: 'Camera height angle', type: 'number', default: 25 },
    { key: 'look', label: 'Turn sensitivity', type: 'number', default: 0.3 },
  ],
  create(p) {
    let yaw = 0, tilt = 0, cam = null;
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic' });
        if (!s.gravity) s.gravity = -25;
        yaw = (e.ry || 0) * DEG; tilt = p.height * DEG;
        s.settings.joystick = true; s.engine.layoutButtons();
      },
      update(e, dt, s) {
        const inp = s.engine.input, a = inp.axis(), b = e.body;
        yaw -= inp.drag.dx * p.look * DEG; tilt = clamp(tilt + inp.drag.dy * p.look * DEG * 0.6, 0.05, 1.3);
        const f = fwd3(yaw), r = right3(yaw);
        const vx = (f.x * -a.y + r.x * a.x) * p.speed, vz = (f.z * -a.y + r.z * a.x) * p.speed;
        b.vel.x = vx; b.vel.z = vz;
        if (Math.hypot(vx, vz) > 0.3) {
          const target = Math.atan2(-vx, -vz) / DEG, diff = ((target - e.ry + 540) % 360) - 180;
          e.ry += diff * Math.min(1, dt * 12);
        }
        if (p.jump && b.grounded && inp.pressed('jump')) { b.vel.y = p.jump; s.engine.audio.sfx('jump'); }
        const tgt = { x: e.x, y: e.y + 1, z: e.z }, d = p.distance;
        const want = { x: tgt.x - f.x * d * Math.cos(tilt), y: tgt.y + d * Math.sin(tilt), z: tgt.z - f.z * d * Math.cos(tilt) };
        const k = cam ? 1 - Math.exp(-10 * dt) : 1;
        cam = cam || { ...want };
        cam.x += (want.x - cam.x) * k; cam.y += (want.y - cam.y) * k; cam.z += (want.z - cam.z) * k;
        s.camera.position = { ...cam }; s.camera.target = tgt;
        if (e.y < -25) respawnOrEnd(e, s, 'respawn');
      },
    };
  },
});

registerBehavior('car', {
  label: 'Car', description: 'Drive with the joystick: up = gas, down = brake/reverse, left/right = steer. 3D cars get a chase camera.',
  params: [
    { key: 'maxSpeed', label: 'Top speed', type: 'number', default: 320, default3d: 16 },
    { key: 'accel', label: 'Acceleration', type: 'number', default: 260, default3d: 12 },
    { key: 'turn', label: 'Steering (deg/sec)', type: 'number', default: 160, default3d: 110 },
    { key: 'autoGas', label: 'Always accelerate', type: 'bool', default: false },
    { key: 'chaseCam', label: 'Chase camera (3D)', type: 'bool', default: true },
  ],
  create(p) {
    let v = 0, cam = null;
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic', gravityScale: is3D(e) ? 1 : 0 });
        s.settings.joystick = true; s.engine.layoutButtons();
      },
      update(e, dt, s) {
        const a = s.engine.input.axis(), b = e.body;
        const gas = p.autoGas ? 1 : -a.y;
        v += gas * p.accel * dt;
        v -= v * Math.min(1, (gas ? 0.6 : 1.8) * dt);
        v = clamp(v, -p.maxSpeed * 0.4, p.maxSpeed);
        const grip = clamp(Math.abs(v) / (p.maxSpeed * 0.25), 0, 1) * Math.sign(v || 1);
        if (is3D(e)) {
          e.ry -= a.x * p.turn * grip * dt;
          const f = fwd3(e.ry * DEG);
          b.vel.x = f.x * v; b.vel.z = f.z * v;
          if (p.chaseCam) {
            const want = { x: e.x - f.x * 7, y: e.y + 3.2, z: e.z - f.z * 7 }, k = cam ? 1 - Math.exp(-6 * dt) : 1;
            cam = cam || { ...want };
            cam.x += (want.x - cam.x) * k; cam.y += (want.y - cam.y) * k; cam.z += (want.z - cam.z) * k;
            s.camera.position = { ...cam }; s.camera.target = { x: e.x + f.x * 3, y: e.y + 0.8, z: e.z + f.z * 3 };
          }
          if (e.y < -25) respawnOrEnd(e, s, 'respawn');
        } else {
          e.rz += a.x * p.turn * grip * dt;
          b.vel.x = Math.sin(e.rz * DEG) * v; b.vel.y = -Math.cos(e.rz * DEG) * v;
        }
        // hitting a wall bleeds speed
        if (Math.hypot(b.vel.x, is3D(e) ? b.vel.z : b.vel.y) < Math.abs(v) * 0.3) v *= 0.9;
      },
    };
  },
});

registerBehavior('projectile', {
  label: 'Projectile', description: 'Flies straight the way it faces (use on bullet templates fired by a Shooter).',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 650, default3d: 30 },
    { key: 'life', label: 'Lifetime (sec)', type: 'number', default: 2 },
  ],
  create(p) {
    let d, t = 0;
    return {
      start(e) {
        if (is3D(e)) {
          const ry = (e.ry || 0) * DEG, rx = (e.rx || 0) * DEG;
          d = { x: -Math.sin(ry) * Math.cos(rx), y: Math.sin(rx), z: -Math.cos(ry) * Math.cos(rx) };
        } else d = { x: Math.sin((e.rz || 0) * DEG), y: -Math.cos((e.rz || 0) * DEG), z: 0 };
      },
      update(e, dt, s) {
        e.x += d.x * p.speed * dt; e.y += d.y * p.speed * dt; e.z += d.z * p.speed * dt;
        if ((t += dt) > p.life) e.destroy();
        for (const w of s.entities) if (w.voxels && w.voxels.solidAtWorld(w, e.x, e.y, e.z)) { s.burst(e.x, e.y, e.z, '#ddd', 6, 0.5); e.destroy(); break; }
      },
    };
  },
});

// ---- clicker / idle game pieces ----
registerBehavior('income', {
  label: 'Income', description: 'Adds a variable to another every second (idle/clicker "per second" earnings).',
  params: [
    { key: 'var', label: 'Earns into', type: 'text', default: 'score' },
    { key: 'rateVar', label: 'Rate variable (per sec)', type: 'text', default: 'perSecond' },
  ],
  create(p) { return { update(e, dt, s) { const r = +s.vars[p.rateVar] || 0; if (r) s.addVar(p.var, r * dt); } }; },
});

registerBehavior('upgrade', {
  label: 'Upgrade Button', description: 'Tap to buy: spends a variable to raise another. The price grows each time. Show the price in text with {cost}.',
  params: [
    { key: 'cost', label: 'Starting price', type: 'number', default: 10 },
    { key: 'costVar', label: 'Pay with', type: 'text', default: 'score' },
    { key: 'addVar', label: 'Raises', type: 'text', default: 'perSecond' },
    { key: 'amount', label: 'By', type: 'number', default: 1 },
    { key: 'growth', label: 'Price growth (x)', type: 'number', default: 1.15 },
  ],
  create(p) {
    return {
      start(e) { e.data.cost = p.cost; e.data.owned = 0; },
      update(e, dt, s) {
        for (const t of s.engine.input.taps) {
          if (!hitTest(s, e, t.x, t.y)) continue;
          const have = +s.vars[p.costVar] || 0;
          if (have < e.data.cost) {
            s.engine.audio.sfx('click'); s.engine.vibrate(30);
            s.message(`Need ${formatNumber(e.data.cost - have)} more`, 1);
            continue;
          }
          s.addVar(p.costVar, -e.data.cost);
          s.addVar(p.addVar, p.amount);
          e.data.owned++;
          e.data.cost = Math.ceil(e.data.cost * p.growth);
          s.engine.audio.sfx('power'); s.engine.vibrate(12);
          const k = e.sx; e.sx = e.sy = k * 1.08; s.tween(e, { sx: k, sy: k }, 0.18);
        }
      },
    };
  },
});

// ---- AI & movement ----
registerBehavior('follow', {
  label: 'Follow', description: 'Follows another object at a distance (pets, sidekicks, escorts).',
  params: [
    { key: 'target', label: 'Follow (name or tag)', type: 'text', default: 'player' },
    { key: 'distance', label: 'Keep distance', type: 'number', default: 60, default3d: 2 },
    { key: 'speed', label: 'Speed', type: 'number', default: 200, default3d: 6 },
  ],
  create(p) {
    let t = null;
    return {
      update(e, dt, s) {
        if (!t || t.dead) t = s.find(p.target) || s.findAll(p.target)[0];
        if (!t || t === e) return;
        const dx = t.x - e.x, dy = is3D(e) ? 0 : t.y - e.y, dz = is3D(e) ? t.z - e.z : 0, d = Math.hypot(dx, dy, dz);
        if (d <= p.distance) return;
        const k = Math.min(d - p.distance, p.speed * dt) / d;
        e.x += dx * k; e.y += dy * k; e.z += dz * k;
        if (is3D(e)) e.ry = Math.atan2(-dx, -dz) / DEG;
      },
    };
  },
});

registerBehavior('wander', {
  label: 'Wander', description: 'Roams around its starting area at random (animals, villagers, slimes).',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 60, default3d: 2 },
    { key: 'radius', label: 'Stay within', type: 'number', default: 120, default3d: 5 },
  ],
  create(p) {
    let home, dir, t = 0;
    return {
      start(e) { home = { x: e.x, y: e.y, z: e.z }; },
      update(e, dt) {
        if ((t -= dt) <= 0) {
          t = rand(1, 3);
          const a = rand(0, Math.PI * 2), away = Math.hypot(e.x - home.x, (is3D(e) ? e.z - home.z : e.y - home.y)) > p.radius;
          dir = Math.random() < 0.25 && !away && dir !== undefined ? null : away ? Math.atan2(is3D(e) ? home.z - e.z : home.y - e.y, home.x - e.x) : a;
        }
        if (dir == null) return;
        e.x += Math.cos(dir) * p.speed * dt;
        if (is3D(e)) { e.z += Math.sin(dir) * p.speed * dt; e.ry = Math.atan2(-Math.cos(dir), -Math.sin(dir)) / DEG; }
        else e.y += Math.sin(dir) * p.speed * dt;
      },
    };
  },
});

registerBehavior('path', {
  label: 'Path', description: 'Moves along a list of points, e.g. "0,0; 150,0; 150,-100" (offsets from the start; 3D uses x,z).',
  params: [
    { key: 'points', label: 'Points (x,y; x,y …)', type: 'text', default: '0,0; 150,0; 150,-100; 0,-100', default3d: '0,0; 4,0; 4,-4; 0,-4' },
    { key: 'speed', label: 'Speed', type: 'number', default: 120, default3d: 3 },
    { key: 'loop', label: 'Loop (off = back and forth)', type: 'bool', default: true },
  ],
  create(p) {
    let pts, i = 1, step = 1, home;
    return {
      start(e) {
        home = { x: e.x, y: e.y, z: e.z };
        pts = String(p.points).split(';').map((q) => q.split(',').map(Number)).filter((q) => q.length >= 2 && q.every(Number.isFinite));
        if (pts.length < 2) pts = null;
      },
      update(e, dt) {
        if (!pts) return;
        const [px, py] = pts[i], tx = home.x + px, tyz = (is3D(e) ? home.z : home.y) + py;
        const cy = is3D(e) ? e.z : e.y, dx = tx - e.x, dy = tyz - cy, d = Math.hypot(dx, dy), mv = p.speed * dt;
        if (d <= mv) {
          e.x = tx; if (is3D(e)) e.z = tyz; else e.y = tyz;
          if (p.loop) i = (i + 1) % pts.length;
          else { if (i + step < 0 || i + step >= pts.length) step = -step; i += step; }
          return;
        }
        e.x += dx / d * mv;
        if (is3D(e)) { e.z += dy / d * mv; e.ry = Math.atan2(-dx, -dy) / DEG; } else e.y += dy / d * mv;
      },
    };
  },
});

registerBehavior('turret', {
  label: 'Turret', description: 'Turns toward the player and fires a template when in range (give the template Projectile + Hazard).',
  params: [
    { key: 'template', label: 'Bullet template', type: 'template', default: '' },
    { key: 'every', label: 'Fire rate (sec)', type: 'number', default: 1.2 },
    { key: 'range', label: 'Range', type: 'number', default: 300, default3d: 14 },
    { key: 'tag', label: 'Target tag', type: 'text', default: 'player' },
  ],
  create(p) {
    let t = 1, target = null;
    return {
      update(e, dt, s) {
        if (!target || target.dead) target = s.findAll(p.tag)[0];
        if (!target) return;
        const dx = target.x - e.x, dy = target.y - e.y, dz = target.z - e.z;
        if (Math.hypot(dx, is3D(e) ? dz : dy) > p.range) return;
        if (is3D(e)) e.ry = Math.atan2(-dx, -dz) / DEG; else e.rz = Math.atan2(dx, -dy) / DEG;
        if ((t -= dt) > 0 || !p.template) return;
        t = p.every;
        const o = { x: e.x, y: e.y, z: e.z, ry: e.ry, rz: e.rz, rx: is3D(e) ? Math.atan2(dy, Math.hypot(dx, dz)) / DEG : 0 };
        if (is3D(e)) { const ry = e.ry * DEG; o.x += -Math.sin(ry) * 0.8; o.z += -Math.cos(ry) * 0.8; }
        else { o.x += Math.sin(e.rz * DEG) * 24; o.y += -Math.cos(e.rz * DEG) * 24; }
        s.spawn(p.template, o);
      },
    };
  },
});

registerBehavior('bounce', {
  label: 'Bouncing Ball', description: 'Keeps moving at a steady speed and bounces off walls, paddles and the screen edges (breakout, pong).',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 340, default3d: 9 },
    { key: 'bottom', label: 'At the bottom edge', type: 'select', options: ['lose a life', 'bounce'], default: 'lose a life' },
  ],
  create(p) {
    let home;
    const launch = (e) => { const a = rand(-0.6, 0.6); e.body.vel = { x: Math.sin(a) * p.speed, y: is3D(e) ? 0 : -Math.cos(a) * p.speed, z: is3D(e) ? -Math.cos(a) * p.speed : 0 }; };
    return {
      start(e) {
        home = { x: e.x, y: e.y, z: e.z };
        const b = e.ensureBody({ type: 'dynamic' });
        b.gravityScale = 0; b.bounce = 1;
        launch(e);
      },
      update(e, dt, s) {
        const v = e.body.vel;
        if (!is3D(e)) {
          const vb = s.viewBounds(), r = e.extents().r || e.extents().hx || 10;
          if (e.x < vb.left + r) { e.x = vb.left + r; v.x = Math.abs(v.x); }
          if (e.x > vb.right - r) { e.x = vb.right - r; v.x = -Math.abs(v.x); }
          if (e.y < vb.top + r) { e.y = vb.top + r; v.y = Math.abs(v.y); }
          if (e.y > vb.bottom - r) {
            if (p.bottom === 'bounce') { e.y = vb.bottom - r; v.y = -Math.abs(v.y); }
            else {
              const lives = +s.vars.lives || 1;
              s.engine.audio.sfx('hit'); s.engine.vibrate(60);
              if (lives <= 1) { s.setVar('lives', 0); s.gameOver(); return; }
              s.addVar('lives', -1); e.x = home.x; e.y = home.y; launch(e); return;
            }
          }
          if (Math.abs(v.y) < p.speed * 0.3) v.y = (v.y < 0 ? -1 : 1) * p.speed * 0.3; // never get stuck flat
        }
        const sp = Math.hypot(v.x, v.y, v.z) || 1, k = p.speed / sp;
        v.x *= k; v.y *= k; v.z *= k;
      },
    };
  },
});

// ---- events & effects ----
export const ACTIONS = ['message', 'add score', 'add to variable', 'set variable', 'spawn template', 'destroy object', 'destroy other', 'show object', 'hide object', 'toggle object',
  'play sound', 'vibrate', 'camera shake', 'jump', 'move by', 'win', 'game over', 'next level', 'start game', 'restart game', 'pause game', 'resume game'];
/** Shared actions for Trigger, Timer, Condition, Button and Rules. */
function runAction(s, e, p, other) {
  const v = p.value, obj = (name) => (name ? s.find(name) || s.findAll(name)[0] : e);
  switch (p.action) {
    case 'set variable': s.setVar(v || 'score', p.amount); break;
    case 'hide object': { const t = obj(v); if (t) t.visible = false; break; }
    case 'toggle object': { const t = obj(v); if (t) t.visible = !t.visible; break; }
    case 'destroy other': if (other) { s.burst(other.x, other.y, other.z, '#fff', 12); other.destroy(); } break;
    case 'play sound': s.engine.audio.sfx(p.sound && p.sound !== 'none' ? p.sound : v || 'click'); return;
    case 'camera shake': s.camera.shake = Math.max(s.camera.shake, p.amount * 4 || 10); break;
    case 'jump': { const t = obj(v) || e; if (t?.body) t.body.vel.y = (s.mode === '3d' ? 1 : -1) * (p.amount > 50 || s.mode === '3d' ? p.amount : p.amount * 60); break; }
    case 'move by': { const t = obj(v) || e; const [dx, dy, dz] = String(p.amount).split(',').map(Number); if (t) { t.x += dx || 0; t.y += dy || 0; t.z += dz || 0; } break; }
    case 'start game': if (s.state === 'title') s.state = 'play'; break;
    case 'restart game': s.engine.restart(); return;
    case 'pause game': s.engine.paused = !s.engine.paused; break;
    case 'resume game': s.engine.paused = false; break;
    case 'add score': s.addVar('score', p.amount); break;
    case 'win': s.win(); break;
    case 'game over': s.gameOver(); break;
    case 'message': s.message(v || '…', 2.5); break;
    case 'add to variable': s.addVar(v || 'score', p.amount); break;
    case 'spawn template': if (v) s.spawn(v, { x: e.x, y: e.y, z: e.z }); break;
    case 'destroy object': { const t = v ? s.find(v) : e; if (t) { s.burst(t.x, t.y, t.z, '#ffffff', 16); t.destroy(); } break; }
    case 'show object': { const t = s.find(v); if (t) t.visible = true; break; }
    case 'next level': if (s.engine.hasNextLevel()) s.win(); break;
    case 'vibrate': s.engine.vibrate([40, 30, 40]); break;
    default: break;
  }
  if (p.sound && p.sound !== 'none') s.engine.audio.sfx(p.sound);
}
const ACTION_PARAMS = [
  { key: 'action', label: 'Do', type: 'select', options: ACTIONS, default: 'message' },
  { key: 'value', label: 'Message / variable / template / object name', type: 'text', default: 'Hello!' },
  { key: 'amount', label: 'Amount (for variables)', type: 'number', default: 1 },
  { key: 'sound', label: 'Sound', type: 'select', options: ['none', 'coin', 'power', 'jump', 'hit', 'click', 'win', 'lose'], default: 'none' },
];

registerBehavior('trigger', {
  label: 'Trigger Zone', description: 'When the player touches it, do something: show a message, change a variable, spawn, destroy, win…',
  params: [
    ...ACTION_PARAMS,
    { key: 'tag', label: 'Triggered by tag', type: 'text', default: 'player' },
    { key: 'once', label: 'Only once', type: 'bool', default: true },
    { key: 'hidden', label: 'Invisible while playing', type: 'bool', default: true },
  ],
  create(p) {
    let done = false;
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); if (p.hidden) e.visible = false; s.want(p.tag); },
      collide(e, other, s) {
        if (!other.has(p.tag) || (p.once && done)) return;
        done = true; runAction(s, e, p, other);
      },
    };
  },
});

registerBehavior('timer', {
  label: 'Timer', description: 'After some seconds (optionally repeating), do something: spawn waves, show hints, end the game…',
  params: [
    { key: 'seconds', label: 'After (sec)', type: 'number', default: 5 },
    { key: 'repeat', label: 'Repeat', type: 'bool', default: false },
    ...ACTION_PARAMS,
  ],
  create(p) {
    let t = 0, done = false;
    return {
      update(e, dt, s) {
        if (done) return;
        if ((t += dt) < p.seconds) return;
        runAction(s, e, p);
        if (p.repeat) t = 0; else done = true;
      },
    };
  },
});

registerBehavior('dropItem', {
  label: 'Drop Item', description: 'When this object is destroyed, it drops a copy of a template (loot, power-ups, coins).',
  params: [
    { key: 'template', label: 'Drop template', type: 'template', default: '' },
    { key: 'chance', label: 'Chance (0–1)', type: 'number', default: 1 },
  ],
  create(p) {
    return { destroy(e, s) { if (p.template && s.state === 'play' && Math.random() < p.chance) s.spawn(p.template, { x: e.x, y: e.y, z: e.z }); } };
  },
});

registerBehavior('emitter', {
  label: 'Particle Emitter', description: 'Keeps giving off particles: fire, smoke, sparkles, exhaust.',
  params: [
    { key: 'color', label: 'Color', type: 'text', default: '#ffb74d' },
    { key: 'rate', label: 'Particles / sec', type: 'number', default: 20 },
    { key: 'spread', label: 'Spread', type: 'number', default: 0.5 },
  ],
  create(p) {
    let acc = 0;
    return {
      update(e, dt, s) {
        acc += p.rate * dt;
        const n = Math.floor(acc);
        if (n > 0) { acc -= n; s.burst(e.x, e.y, e.z, p.color, n, p.spread); }
      },
    };
  },
});

registerBehavior('blink', {
  label: 'Blink', description: 'Flashes on and off (warnings, hazards that come and go).',
  params: [
    { key: 'on', label: 'Visible for (sec)', type: 'number', default: 0.6 },
    { key: 'off', label: 'Hidden for (sec)', type: 'number', default: 0.6 },
    { key: 'solid', label: 'Only hurts while visible', type: 'bool', default: true },
  ],
  create(p) {
    let t = 0;
    return {
      update(e, dt) {
        t = (t + dt) % (p.on + p.off);
        e.visible = t < p.on;
        e.data.blinkOff = p.solid && !e.visible; // Hazard ignores touches while hidden
      },
    };
  },
});

// ---- turn-based games ----
/** Is a grid cell blocked? Static bodies, objects tagged "wall", other turn enemies, voxel blocks. */
function blockerAt(s, x, y, z, except) {
  for (const o of s.entities) {
    if (o === except || o.dead || o.ui) continue;
    if (o.voxels) { if (o.voxels.solidAtWorld(o, x, y, z)) return o; continue; }
    const solid = (o.body && !o.body.sensor && (o.body.type === 'static' || o.tags.has('wall'))) || o.getBehavior('gridEnemy') || o.tags.has('pushable');
    if (!solid) continue;
    const ex = o.extents(), hx = (ex.sphere ? ex.r : ex.hx) - 0.01, hy = (ex.sphere ? ex.r : ex.hy) - 0.01, hz = (ex.sphere ? ex.r : ex.hz) - 0.01;
    if (Math.abs(o.x - x) < hx && (s.mode === '3d' ? Math.abs(o.z - z) < hz && Math.abs(o.y - y) < Math.max(hy, 0.6) : Math.abs(o.y - y) < hy)) return o;
  }
  return null;
}

registerBehavior('gridMove', {
  label: 'Grid Move', description: 'Moves one tile per swipe (or joystick push / tap beside the player). In turn-based games each move ends your turn. Bump enemies to attack, push "pushable" objects.',
  params: [
    { key: 'tile', label: 'Tile size', type: 'number', default: 40, default3d: 1 },
    { key: 'tapToMove', label: 'Tap beside the player to move', type: 'bool', default: true },
    { key: 'damage', label: 'Bump attack damage', type: 'number', default: 1 },
  ],
  create(p) {
    let busy = 0, armed = true;
    return {
      start(e, s) { if (!e.body) e.setBody({ type: 'kinematic' }); s.want('player'); },
      update(e, dt, s) {
        if ((busy -= dt) > 0 || s.state !== 'play' || (s.settings.turnBased && !s.isPlayerTurn)) return;
        const inp = s.engine.input, a = inp.axis();
        let dx = 0, dy = 0;
        if (inp.pressed('swipe:left')) dx = -1; else if (inp.pressed('swipe:right')) dx = 1;
        else if (inp.pressed('swipe:up')) dy = -1; else if (inp.pressed('swipe:down')) dy = 1;
        else if (Math.hypot(a.x, a.y) > 0.6) { if (armed) { if (Math.abs(a.x) > Math.abs(a.y)) dx = Math.sign(a.x); else dy = Math.sign(a.y); armed = false; } }
        else armed = true;
        if (!dx && !dy && p.tapToMove && inp.taps.length) {
          const t = inp.taps[0], sp = s.mode === '3d' ? s.engine.renderer.worldToScreen(s, e.x, e.y, e.z) : s.engine.renderer.worldToScreen(s, e.x, e.y);
          const ox = t.x - sp.x, oy = t.y - sp.y;
          if (Math.hypot(ox, oy) > 24) { if (Math.abs(ox) > Math.abs(oy)) dx = Math.sign(ox); else dy = Math.sign(oy); }
        }
        if (!dx && !dy) return;
        const T = p.tile, tx = e.x + dx * T, ty = is3D(e) ? e.y : e.y + dy * T, tz = is3D(e) ? e.z + dy * T : e.z;
        if (is3D(e)) e.ry = Math.atan2(-dx, -dy) / DEG;
        const hit = blockerAt(s, tx, ty, tz, e);
        if (hit && hit.getBehavior('gridEnemy')) { // bump attack
          hit.getBehavior('gridEnemy').hurt(hit, s, p.damage);
          busy = 0.15; if (s.settings.turnBased) s.endTurn(); return;
        }
        if (hit && hit.tags.has('pushable')) {
          const bx = hit.x + dx * T, by = is3D(e) ? hit.y : hit.y + dy * T, bz = is3D(e) ? hit.z + dy * T : hit.z;
          if (blockerAt(s, bx, by, bz, hit)) { s.engine.vibrate(15); return; }
          s.tween(hit, { x: bx, y: by, z: bz }, 0.12);
        } else if (hit) { s.engine.vibrate(15); return; }
        s.tween(e, { x: tx, y: ty, z: tz }, 0.12);
        s.engine.audio.tone({ freq: 520, to: 600, dur: 0.05, vol: 0.05 });
        busy = 0.14;
        if (s.settings.turnBased) s.endTurn();
      },
    };
  },
});

registerBehavior('gridEnemy', {
  label: 'Turn Enemy', description: 'On each enemy turn, steps one tile toward the player and attacks when next to them. Bump it to hurt it.',
  params: [
    { key: 'tile', label: 'Tile size', type: 'number', default: 40, default3d: 1 },
    { key: 'hp', label: 'Health', type: 'number', default: 1 },
    { key: 'points', label: 'Points when defeated', type: 'number', default: 10 },
    { key: 'sight', label: 'Notices player within (tiles, 0 = always)', type: 'number', default: 6 },
  ],
  create(p) {
    let hp = p.hp;
    const self = {
      hurt(e, s, dmg) {
        hp -= dmg; e.data.invuln = 0.2; s.engine.audio.sfx('hit');
        s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#f55', 12);
        if (hp <= 0) { s.addVar('score', p.points); e.destroy(); }
      },
      turn(e, s) {
        const pl = s.findAll('player')[0];
        if (!pl) return;
        const T = p.tile, dx = Math.round((pl.x - e.x) / T), dy = Math.round(((is3D(e) ? pl.z : pl.y) - (is3D(e) ? e.z : e.y)) / T);
        if (Math.abs(dx) + Math.abs(dy) === 1) { // adjacent: attack
          s.tween(e, { sx: e.sx * 1.2, sy: e.sy * 1.2 }, 0.08); s.after(0.1, () => s.tween(e, { sx: e.sx / 1.2, sy: e.sy / 1.2 }, 0.08));
          if (!(pl.data.invuln > 0)) respawnOrEnd(pl, s, 'damage');
          return;
        }
        if (p.sight && Math.abs(dx) + Math.abs(dy) > p.sight) return;
        const tries = Math.abs(dx) >= Math.abs(dy) ? [[Math.sign(dx), 0], [0, Math.sign(dy)]] : [[0, Math.sign(dy)], [Math.sign(dx), 0]];
        for (const [mx, my] of tries) {
          if (!mx && !my) continue;
          const tx = e.x + mx * T, ty = is3D(e) ? e.y : e.y + my * T, tz = is3D(e) ? e.z + my * T : e.z;
          if (blockerAt(s, tx, ty, tz, e) || (Math.abs(pl.x - tx) < T / 2 && Math.abs((is3D(e) ? pl.z - tz : pl.y - ty)) < T / 2)) continue;
          s.tween(e, { x: tx, y: ty, z: tz }, 0.15);
          if (is3D(e)) e.ry = Math.atan2(-mx, -my) / DEG;
          break;
        }
      },
    };
    return self;
  },
});

registerBehavior('boardCell', {
  label: 'Board Cell', description: 'A square on a game board (tic-tac-toe, connect-style). Tap to place your mark; play a friend or the computer.',
  params: [
    { key: 'row', label: 'Row', type: 'number', default: 0 },
    { key: 'col', label: 'Column', type: 'number', default: 0 },
    { key: 'line', label: 'Marks in a row to win', type: 'number', default: 3 },
    { key: 'vsComputer', label: 'Play against the computer', type: 'bool', default: true },
  ],
  create(p) {
    const cells = (s) => s.entities.filter((c) => c.getBehavior('boardCell') && !c.dead);
    const at = (s, r, c) => cells(s).find((x) => x.data.row === r && x.data.col === c);
    const wins = (s, cell, mark) => {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let n = 1;
        for (const sgn of [1, -1]) for (let k = 1; ; k++) { const o = at(s, cell.data.row + dr * k * sgn, cell.data.col + dc * k * sgn); if (o && o.data.mark === mark) n++; else break; }
        if (n >= cell.data.line) return true;
      }
      return false;
    };
    const place = (s, cell, mark) => {
      cell.data.mark = mark;
      const size = Math.min(cell.shape?.w || 80, cell.shape?.h || 80);
      cell.text = { ...TEXT_DEFAULTS, value: mark, size: size * 0.62, weight: '900', color: mark === 'X' ? '#4fc3f7' : '#ff7043' };
      s.engine.audio.sfx(mark === 'X' ? 'click' : 'coin'); s.engine.vibrate(8);
      const k = cell.sx; cell.sx = cell.sy = k * 0.85; s.tween(cell, { sx: k, sy: k }, 0.15);
      if (wins(s, cell, mark)) {
        s.burst(cell.x, cell.y, cell.z, mark === 'X' ? '#4fc3f7' : '#ff7043', 30);
        if (cell.data.vs) { if (mark === 'X') s.win(); else { s.message('The computer wins!', 2); s.gameOver(); } }
        else { s.message(`${mark} wins!`, 2.5); s.addVar('score', 1); s.win(); }
        return true;
      }
      if (cells(s).every((c) => c.data.mark)) { s.message("It's a draw!", 1.4); s.after(1.5, () => s.engine.restart()); return true; }
      return false;
    };
    return {
      start(e, s) {
        Object.assign(e.data, { row: p.row, col: p.col, line: p.line, vs: p.vsComputer, mark: '' });
        s.vars.turnText = p.vsComputer ? 'Your turn (X)' : 'X to play';
      },
      update(e, dt, s) {
        if (s.state !== 'play' || e.data.mark || !s.isPlayerTurn) return;
        if (!s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) return;
        const mark = p.vsComputer ? 'X' : (s.vars.nextMark || 'X');
        if (place(s, e, mark)) return;
        if (p.vsComputer) { s.settings.enemyTurnText = 'Computer is thinking…'; s.settings.playerTurnText = 'Your turn (X)'; s.settings.turnDelay = 0.5; s.endTurn(); }
        else { s.vars.nextMark = mark === 'X' ? 'O' : 'X'; s.setVar('turnText', `${s.vars.nextMark} to play`); }
      },
      turn(e, s) {
        const all = cells(s);
        if (all[0] !== e || !e.data.vs) return; // one cell plays for the computer
        const empty = all.filter((c) => !c.data.mark);
        if (!empty.length) return;
        const tryMark = (mark) => empty.find((c) => { c.data.mark = mark; const w = wins(s, c, mark); c.data.mark = ''; return w; });
        const mid = Math.floor(Math.sqrt(all.length) / 2);
        const pickCell = tryMark('O') || tryMark('X') || empty.find((c) => c.data.row === mid && c.data.col === mid) || empty[Math.floor(Math.random() * empty.length)];
        place(s, pickCell, 'O');
      },
    };
  },
});

registerBehavior('turnAction', {
  label: 'Turn Button', description: 'A battle/menu button: on your turn, tap to change a variable (attack, heal, spell), then the enemy takes its turn.',
  params: [
    { key: 'var', label: 'Changes variable', type: 'text', default: 'enemyHp' },
    { key: 'amount', label: 'By (min/max)', type: 'range', default: [-14, -8] },
    { key: 'max', label: 'Up to (0 = no cap)', type: 'number', default: 0 },
    { key: 'costVar', label: 'Costs variable', type: 'text', default: '' },
    { key: 'cost', label: 'Cost', type: 'number', default: 0 },
    { key: 'text', label: 'Message ({n} = amount)', type: 'text', default: 'You hit for {n}!' },
    { key: 'sound', label: 'Sound', type: 'select', options: ['hit', 'power', 'coin', 'jump', 'click'], default: 'hit' },
  ],
  create(p) {
    return {
      update(e, dt, s) {
        const ready = s.state === 'play' && s.isPlayerTurn && (!p.costVar || (+s.vars[p.costVar] || 0) >= p.cost);
        e.alpha += ((ready ? 1 : 0.45) - e.alpha) * Math.min(1, dt * 10);
        if (s.state !== 'play' || !s.isPlayerTurn) return;
        if (!s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) return;
        if (p.costVar && (+s.vars[p.costVar] || 0) < p.cost) { s.message(`Not enough ${p.costVar}`, 1.2); s.engine.vibrate(30); return; }
        if (p.costVar) s.addVar(p.costVar, -p.cost);
        const n = Math.round(pick(p.amount));
        let v = (+s.vars[p.var] || 0) + n;
        if (n < 0) v = Math.max(0, v);
        if (p.max) v = Math.min(p.max, v);
        s.setVar(p.var, v);
        s.message(p.text.replace('{n}', Math.abs(n)), Math.max(0.8, (s.settings.turnDelay ?? 0.3) + 0.4));
        s.engine.audio.sfx(p.sound); s.engine.vibrate(12);
        const k = e.sx; e.sx = e.sy = k * 0.92; s.tween(e, { sx: k, sy: k }, 0.15);
        s.endTurn();
      },
    };
  },
});

registerBehavior('turnOpponent', {
  label: 'Enemy Turn', description: 'On the enemy\'s turn, changes a variable (e.g. hits the player) and shows a message.',
  params: [
    { key: 'var', label: 'Changes variable', type: 'text', default: 'hp' },
    { key: 'amount', label: 'By (min/max)', type: 'range', default: [-12, -6] },
    { key: 'text', label: 'Message ({n} = amount)', type: 'text', default: 'The enemy hits you for {n}!' },
  ],
  create(p) {
    return {
      turn(e, s) {
        const n = Math.round(pick(p.amount));
        s.setVar(p.var, Math.max(0, (+s.vars[p.var] || 0) + n));
        s.message(p.text.replace('{n}', Math.abs(n)), 1.4);
        s.engine.audio.sfx('hit'); s.engine.vibrate(40); s.camera.shake = 8;
        const k = e.sx; e.sx = e.sy = k * 1.15; s.tween(e, { sx: k, sy: k }, 0.25);
      },
    };
  },
});

registerBehavior('condition', {
  label: 'Condition', description: 'Watches a variable and does something when it passes a value, e.g. win when enemyHp ≤ 0, lose when hp ≤ 0.',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'hp' },
    { key: 'op', label: 'When it is', type: 'select', options: ['<=', '>=', '=='], default: '<=' },
    { key: 'target', label: 'Value', type: 'number', default: 0 },
    ...ACTION_PARAMS.map((q) => (q.key === 'action' ? { ...q, default: 'game over' } : q)),
  ],
  create(p) {
    let done = false;
    return {
      update(e, dt, s) {
        if (done || s.state !== 'play') return;
        const v = +s.vars[p.var] || 0;
        if (p.op === '<=' ? v <= p.target : p.op === '>=' ? v >= p.target : v === p.target) { done = true; runAction(s, e, p); }
      },
    };
  },
});

registerBehavior('voxelBuilder', {
  label: 'Block Builder', description: 'Minecraft-style building: tap a block to break it, or switch to Place and tap to add blocks. Buttons swap mode and block.',
  params: [
    { key: 'reach', label: 'Reach (blocks)', type: 'number', default: 6 },
    { key: 'block', label: 'Starting block (1–12)', type: 'number', default: 3 },
    { key: 'mode', label: 'Starting mode', type: 'select', options: ['break', 'place'], default: 'break' },
  ],
  create(p) {
    let mode = p.mode, block = p.block;
    const syncButtons = (s, V) => {
      const col = V?.palette[(block - 1) % V.palette.length] || '#fff';
      s.customButtons = [{ action: 'vmode', label: mode === 'break' ? 'BREAK' : 'PLACE' }, { action: 'vblock', label: '', color: col }];
      s.engine.layoutButtons();
    };
    const world = (s) => s.entities.find((w) => w.voxels && !w.dead);
    return {
      start(e, s) { syncButtons(s, world(s)?.voxels); },
      update(e, dt, s) {
        const inp = s.engine.input, W = world(s);
        if (!W) return;
        if (inp.pressed('btn:vmode')) { mode = mode === 'break' ? 'place' : 'break'; syncButtons(s, W.voxels); s.message(mode === 'break' ? 'Tap a block to break it' : `Placing ${VOXEL_NAMES[(block - 1) % 12] || 'blocks'}`, 1); }
        if (inp.pressed('btn:vblock')) { block = block % W.voxels.palette.length + 1; if (mode !== 'place') mode = 'place'; syncButtons(s, W.voxels); s.message(VOXEL_NAMES[block - 1] || `Block ${block}`, 0.8); }
        for (const t of inp.taps) {
          const ray = s.engine.renderer.screenRay(s, t.x, t.y), cam = s.camera.position;
          const max = p.reach * W.voxels.size + Math.hypot(cam.x - e.x, cam.y - e.y, cam.z - e.z);
          const hit = W.voxels.raycast(W, ray.origin, ray.dir, max);
          if (!hit) continue;
          const V = W.voxels, sz = V.size;
          if (mode === 'break') {
            const col = V.palette[(V.get(hit.i, hit.j, hit.k) - 1) % V.palette.length];
            V.set(hit.i, hit.j, hit.k, 0);
            s.burst(W.x + (hit.i + 0.5) * sz, W.y + (hit.j + 0.5) * sz, W.z + (hit.k + 0.5) * sz, col, 14, 0.6);
            s.engine.audio.tone({ freq: 180, to: 90, dur: 0.12, type: 'square', vol: 0.08 }); s.engine.vibrate(10);
            s.addVar('blocks', 1);
          } else {
            const ni = hit.i + hit.n[0], nj = hit.j + hit.n[1], nk = hit.k + hit.n[2];
            const cx = W.x + (ni + 0.5) * sz, cy = W.y + (nj + 0.5) * sz, cz = W.z + (nk + 0.5) * sz, ex = e.extents();
            const inside = Math.abs(cx - e.x) < (ex.hx || ex.r) + sz / 2 && Math.abs(cy - e.y) < (ex.hy || ex.r) + sz / 2 && Math.abs(cz - e.z) < (ex.hz || ex.r) + sz / 2;
            if (inside) continue; // don't build inside yourself
            V.set(ni, nj, nk, block);
            s.engine.audio.tone({ freq: 300, to: 420, dur: 0.08, type: 'triangle', vol: 0.08 }); s.engine.vibrate(8);
          }
        }
      },
    };
  },
});

registerBehavior('button', {
  label: 'Button', description: 'Tap it to do something: start/restart the game, pause, show or hide menus, change variables, jump… Works on UI and on objects in the game.',
  params: [...ACTION_PARAMS.map((q) => (q.key === 'action' ? { ...q, default: 'restart game' } : q))],
  create(p) {
    return {
      uiAlways: true, // keeps working on title and end screens
      update(e, dt, s) {
        if (!e.visible) return;
        for (const t of s.engine.input.taps) {
          if (!hitTest(s, e, t.x, t.y)) continue;
          s.engine.vibrate(10);
          const k = e.sx; e.sx = e.sy = k * 0.92; s.tween(e, { sx: k, sy: k }, 0.15);
          if (p.action !== 'play sound' && (!p.sound || p.sound === 'none')) s.engine.audio.sfx('click');
          runAction(s, e, p);
          break;
        }
      },
    };
  },
});

/** Rules: WHEN something happens, IF a condition holds, DO a list of actions. */
export const RULE_EVENTS = ['game starts', 'every few seconds', 'touched by tag', 'tapped', 'jump button', 'fire button', 'swipe', 'variable reaches', 'destroyed'];
registerBehavior('rules', {
  label: 'Rules', description: 'Build logic without code: WHEN something happens, IF a condition is true, DO one or more actions.',
  params: [{ key: 'rules', label: 'Rules', type: 'rules', default: [{ when: 'tapped', tag: 'player', seconds: 1, dir: 'up', ifVar: '', ifOp: '>=', ifValue: 0, once: false, do: [{ action: 'add score', value: '', amount: 1 }] }] }],
  create(p) {
    const rules = (p.rules || []).map((r) => ({ ...r, t: 0, fired: false, wasTrue: false }));
    const check = (r, s) => {
      if (!r.ifVar) return true;
      const v = +s.vars[r.ifVar] || 0, n = +r.ifValue || 0;
      return r.ifOp === '<=' ? v <= n : r.ifOp === '==' ? v === n : r.ifOp === '<' ? v < n : r.ifOp === '>' ? v > n : v >= n;
    };
    const fire = (r, e, s, other) => {
      if ((r.once && r.fired) || !check(r, s)) return;
      r.fired = true;
      for (const a of r.do || []) runAction(s, e, { sound: 'none', ...a }, other);
    };
    return {
      uiAlways: true,
      start(e, s) {
        for (const r of rules) {
          if (r.when === 'touched by tag') { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(r.tag || 'player'); }
          if (r.when === 'game starts') fire(r, e, s);
        }
      },
      update(e, dt, s) {
        const inp = s.engine.input, playing = s.state === 'play';
        for (const r of rules) {
          if (!playing && !(r.when === 'tapped' && e.ui)) continue;
          switch (r.when) {
            case 'every few seconds': if ((r.t += dt) >= Math.max(0.05, +r.seconds || 1)) { r.t = 0; fire(r, e, s); } break;
            case 'tapped': if (e.visible && inp.taps.some((t) => hitTest(s, e, t.x, t.y))) fire(r, e, s); break;
            case 'jump button': if (inp.pressed('jump')) fire(r, e, s); break;
            case 'fire button': if (inp.pressed('action')) fire(r, e, s); break;
            case 'swipe': if (inp.pressed('swipe:' + (r.dir || 'up'))) fire(r, e, s); break;
            case 'variable reaches': { const now = check({ ...r, ifVar: r.ifVar || 'score' }, s); if (now && !r.wasTrue) { r.wasTrue = true; for (const a of r.do || []) runAction(s, e, { sound: 'none', ...a }); } else if (!now) r.wasTrue = false; break; }
            default: break;
          }
        }
      },
      collide(e, other, s) { for (const r of rules) if (r.when === 'touched by tag' && other.has(r.tag || 'player')) fire(r, e, s, other); },
      destroy(e, s) { for (const r of rules) if (r.when === 'destroyed') fire(r, e, s); },
    };
  },
});

registerBehavior('script', {
  label: 'Custom script', description: 'Write JavaScript. Define start(e, scene), update(e, dt, scene) and/or collide(e, other, scene).',
  params: [{ key: 'code', label: 'Code', type: 'code', default: 'function update(e, dt, scene) {\n  // e.x += 50 * dt;\n}\n' }],
  create(p) {
    try {
      const f = new Function('P', `${p.code}\nreturn {
        start: typeof start === 'function' ? start : undefined,
        update: typeof update === 'function' ? update : undefined,
        collide: typeof collide === 'function' ? collide : undefined };`);
      return f(Pocket);
    } catch (err) {
      console.error('[pocket] script error:', err);
      return {};
    }
  },
});

// ============================================================================
// Engine
// ============================================================================
export class Engine {
  constructor(opts = {}) {
    this.parent = opts.parent || document.body;
    this.maxDpr = opts.maxPixelRatio || 2;
    this.root = document.createElement('div');
    this.root.className = 'pocket-root';
    const fixed = this.parent === document.body;
    this.root.style.cssText = `position:${fixed ? 'fixed' : 'absolute'};inset:0;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;`;
    this.parent.appendChild(this.root);
    this.uiCanvas = document.createElement('canvas');
    this.uiCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;touch-action:none;';
    this.root.appendChild(this.uiCanvas);
    this.uiCtx = this.uiCanvas.getContext('2d');
    this.canvas = null; this.renderer = null;
    this.safeProbe = document.createElement('div');
    this.safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    this.root.appendChild(this.safeProbe);
    this.safe = { top: 0, right: 0, bottom: 0, left: 0 };

    this.input = new Input(this, this.uiCanvas);
    this.audio = new Audio();
    this.physics = new Physics();
    this.scene = null;
    this.editing = false;
    this.paused = false;
    this.timeScale = 1;
    this.fps = 60;
    this.width = 1; this.height = 1; this.dpr = 1;

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
    this.onVis = () => {
      if (document.hidden) this.saveProgress();
      else if (this.audio.ctx?.state !== 'running') this.audio.ctx?.resume?.().catch(() => {}); // iOS suspends audio after calls/app switches
      if (document.hidden && this.scene?.state === 'play' && !this.editing) this.paused = true;
      if (!document.hidden && this.scene && !this.editing && this.scene.state === 'play') this.keepAwake();
    };
    document.addEventListener('visibilitychange', this.onVis);
    this.last = performance.now();
    this.running = true;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.width = Math.max(1, r.width); this.height = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    for (const c of [this.uiCanvas, this.canvas]) if (c) { c.width = Math.round(this.width * this.dpr); c.height = Math.round(this.height * this.dpr); }
    const cs = getComputedStyle(this.safeProbe);
    this.safe = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
    if (this.scene && !this.editing) this.render();
  }

  useRenderer(kind) {
    if (this.renderer?.kind === kind) return;
    this.canvas?.remove();
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;';
    this.root.insertBefore(this.canvas, this.uiCanvas);
    this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr);
    this.renderer = kind === '3d' ? new Renderer3D(this.canvas) : new Renderer2D(this.canvas);
  }

  /**
   * Start a game. Pass a function that builds a fresh Scene (used for restarts), a Scene, or scene JSON.
   * Scene JSON may carry more levels in `levels: [sceneJson, ...]`; opts.level picks the starting one.
   */
  start(source, opts = {}) {
    this.levels = null; this.carry = null;
    if (typeof source === 'function') this.factory = source;
    else if (source instanceof Scene) this.factory = () => source;
    else {
      this.levels = [source, ...(source.levels || [])];
      this.levelIndex = clamp(opts.level || 0, 0, this.levels.length - 1);
      this.factory = () => this.buildLevel();
    }
    this.setScene(this.factory());
    return this.scene;
  }

  buildLevel() {
    const first = this.levels[0], lv = this.levels[this.levelIndex], i = this.levelIndex;
    const json = i === 0 ? lv : { ...lv, settings: { ...(lv.settings || {}), title: this.carry ? '' : lv.settings?.title || '', saveBest: first.settings?.saveBest || '' } };
    const s = Scene.fromJSON(json);
    s.level = i + 1; s.levelCount = this.levels.length;
    if (this.carry) { Object.assign(s.vars, this.carry); if (s.state === 'title') s.state = 'play'; }
    if (s.settings.timeLimit) s.vars.time = +s.settings.timeLimit;
    s.vars.level = s.level;
    return s;
  }

  hasNextLevel() { return !!this.levels && this.levelIndex < this.levels.length - 1; }

  nextLevel() {
    if (!this.hasNextLevel()) return;
    const carry = { ...this.scene.vars };
    delete carry.best; delete carry.level; delete carry.time;
    this.carry = carry;
    this.levelIndex++;
    this.setScene(this.factory());
    this.saveProgress();
  }

  restart(skipTitle = true) {
    if (!this.factory) return;
    if (this.levels && this.scene?.state === 'win') { this.levelIndex = 0; this.carry = null; } // finished the last level
    const s = this.factory();
    if (skipTitle && s.state === 'title') s.state = 'play';
    this.setScene(s);
  }

  setScene(scene) {
    scene.engine = this;
    this.scene = scene;
    if (scene.settings.saveProgress && !this.editing && !this.restoredOnce) { // continue where the player left off
      this.restoredOnce = true;
      const saved = this.loadProgress(scene);
      if (saved && this.levels && saved.level > 0 && saved.level < this.levels.length && this.levelIndex !== saved.level) {
        this.levelIndex = saved.level; this.carry = saved.vars;
        return this.setScene(this.factory());
      }
      if (saved?.vars) Object.assign(scene.vars, saved.vars);
    }
    this.useRenderer(scene.mode);
    this.physics.contacts.clear();
    this.input.reset();
    this.paused = false;
    scene.flush();
    scene.init(this);
    this.layoutButtons();
  }

  layoutButtons() {
    const s = this.scene, b = [], m = 24;
    if (s && !this.editing) {
      const r = Math.min(44, this.width * 0.11) * (CONTROL_SCALE[s.settings.controlSize] || 1), bottom = this.height - this.safe.bottom - m - r;
      // buttons go on the side opposite the joystick (left-handed players can swap)
      const left = s.settings.joystickSide === 'right';
      const X = (off) => (left ? this.safe.left + m + r + off : this.width - this.safe.right - m - r - off);
      if (s.settings.jumpButton) b.push({ action: 'jump', label: s.settings.jumpLabel || 'JUMP', x: X(0), y: bottom, r, id: null });
      if (s.settings.actionButton) b.push({ action: 'action', label: s.settings.actionLabel || 'FIRE', x: X(s.settings.jumpButton ? r * 2.4 : 0), y: bottom - (s.settings.jumpButton ? r * 0.9 : 0), r, id: null });
      // D-pad or left/right arrows instead of a joystick
      const c = s.settings.controls, DX = (off) => (left ? this.width - this.safe.right - m - off : this.safe.left + m + off);
      if (c === 'arrows') {
        b.push({ action: 'dleft', label: '◀', x: DX(r), y: bottom, r, id: null });
        b.push({ action: 'dright', label: '▶', x: DX(r * 3.4), y: bottom, r, id: null });
      } else if (c === 'dpad') {
        const cx = DX(r * 2.2), cy = bottom - r * 1.1, dr = r * 0.78;
        b.push({ action: 'dup', label: '▲', x: cx, y: cy - dr * 1.9, r: dr, id: null });
        b.push({ action: 'ddown', label: '▼', x: cx, y: cy + dr * 1.9, r: dr, id: null });
        b.push({ action: 'dleft', label: '◀', x: cx - dr * 1.9, y: cy, r: dr, id: null });
        b.push({ action: 'dright', label: '▶', x: cx + dr * 1.9, y: cy, r: dr, id: null });
      }
      // extra buttons that components add (e.g. the block builder's mode and block pickers), stacked above
      (s.customButtons || []).forEach((cb, i) => b.push({ ...cb, x: X(0), y: bottom - (i + 1) * r * 2.3 - (s.settings.actionButton && !s.settings.jumpButton ? r * 2.3 : 0), r: r * 0.9, id: null }));
      const top = this.safe.top + 30, both = s.settings.pauseButton && s.settings.muteButton;
      if (s.settings.pauseButton) b.push({ action: 'pause', label: 'II', x: this.width / 2 + (both ? 26 : 0), y: top, r: 20, id: null });
      if (s.settings.muteButton) b.push({ action: 'mute', label: '♪', x: this.width / 2 - (both ? 26 : 0), y: top, r: 20, id: null });
    }
    this.input.buttons = b;
  }

  /** Outside of play (title / end screens) only UI buttons keep working, so custom menus can be tapped. */
  runUIOnly(s, dt) {
    for (const e of s.entities) {
      if (!e.ui || e.dead) continue;
      if (!e.started) { e.started = true; for (const b of e.behaviors) b.start?.(e, s); }
      for (const b of e.behaviors) if (b.uiAlways) b.update?.(e, dt, s);
    }
    s.flush();
  }

  /** Share the score with the phone's share sheet (or copy it). */
  shareScore() {
    const s = this.scene, title = s.json?.name || document.title || 'my game';
    const text = `I scored ${formatNumber(s.vars.score || 0)} in ${title}!`;
    if (navigator.share) navigator.share({ title, text, url: location.href }).catch(() => {});
    else navigator.clipboard?.writeText(`${text} ${location.href}`).then(() => s.message('Copied to clipboard', 1.5)).catch(() => {});
  }

  // ---- saved progress (settings.saveProgress): variables and level survive closing the game ----
  saveKey(s = this.scene) { return 'pocket.save.' + (s?.settings.saveBest || s?.json?.name || 'game'); }
  saveProgress() {
    const s = this.scene;
    if (!s || this.editing || !s.settings.saveProgress || s.state !== 'play') return;
    const vars = { ...s.vars }; delete vars.time; delete vars.best;
    store.set(this.saveKey(), JSON.stringify({ vars, level: this.levelIndex || 0 }));
  }
  loadProgress(s) {
    try { return JSON.parse(store.get(this.saveKey(s), 'null')); } catch { return null; }
  }
  clearProgress() { try { localStorage.removeItem(this.saveKey()); } catch { /* storage unavailable */ } }

  /** True when the game wants portrait/landscape and a phone is held the other way. */
  wrongOrientation(s) {
    const o = s.settings.orientation;
    if (!o || o === 'any' || !matchMedia('(pointer: coarse)').matches) return false;
    return o === 'portrait' ? this.width > this.height * 1.1 : this.height > this.width * 1.1;
  }

  /** First touch: go fullscreen if the game asks for it, and keep the screen awake while playing. */
  onFirstGesture() {
    const s = this.scene;
    if (!s || this.editing) return;
    if (s.settings.fullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        if (s.settings.orientation !== 'any') screen.orientation?.lock?.(s.settings.orientation).catch(() => {});
      }).catch(() => {});
    }
    this.keepAwake();
  }
  async keepAwake() {
    if (this.wakeLock || !navigator.wakeLock || this.editing) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
    } catch { /* not allowed right now */ }
  }
  releaseAwake() { this.wakeLock?.release().catch(() => {}); this.wakeLock = null; }

  vibrate(p) { try { if (!this.audio.muted) navigator.vibrate?.(p); } catch { /* unsupported */ } }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
    // adaptive resolution: if a phone can't keep up, render fewer pixels
    if (!this.editing && this.scene?.state === 'play' && !this.paused) {
      this.slowTime = this.fps < 42 ? (this.slowTime || 0) + dt : 0;
      if (this.slowTime > 2 && this.dpr > 1) { this.maxDpr = Math.max(1, this.dpr - 0.5); this.slowTime = 0; this.resize(); }
      if ((this.saveTimer = (this.saveTimer || 0) + dt) > 3) { this.saveTimer = 0; this.saveProgress(); }
    }
    if (this.scene) {
      if (!this.editing) this.update(dt * this.timeScale);
      this.render();
    }
    this.input.endFrame();
    requestAnimationFrame(this.frame);
  }

  update(dt) {
    const s = this.scene, inp = this.input;
    if (this.width !== this.lastLayoutW || this.height !== this.lastLayoutH) { this.layoutButtons(); this.lastLayoutW = this.width; this.lastLayoutH = this.height; }
    if (inp.pressed('btn:mute')) { this.audio.setMuted(!this.audio.muted); if (!this.audio.muted) this.audio.sfx('click'); }
    s.rotateNeeded = this.wrongOrientation(s);
    if (s.rotateNeeded) return;
    if (this.paused) {
      this.runUIOnly(s, dt);
      if ((inp.pressed('tap') && !s.settings.customScreens) || inp.pressed('btn:pause')) this.paused = false;
      return;
    }
    if (inp.pressed('btn:pause') && s.state === 'play') { this.paused = true; return; }
    if (s.state === 'title') {
      this.runUIOnly(s, dt);
      if (inp.pressed('tap') && !s.settings.customScreens) { s.state = 'play'; this.audio.sfx('click'); }
      s.time += dt; this.stepEffects(dt); return;
    }
    if (s.state !== 'play') {
      s.time += dt; this.stepEffects(dt);
      this.runUIOnly(s, dt);
      if (s.time - s.endTime > 0.8 && inp.pressed('tap') && !s.settings.customScreens) {
        const t = inp.taps[0], r = this.shareRect;
        if (r && t && t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h && !s.levelComplete) this.shareScore();
        else if (s.levelComplete) this.nextLevel(); else this.restart();
      }
      return;
    }
    for (const e of s.entities) {
      if (!e.started && !e.dead) { e.started = true; for (const b of e.behaviors) b.start?.(e, s); }
    }
    for (const e of s.entities) {
      if (e.dead) continue;
      if (e.data.invuln > 0) e.data.invuln -= dt;
      for (const b of e.behaviors) { if (e.dead) break; b.update?.(e, dt, s); }
    }
    s.update(dt, this);
    if (s.turnSide === 'enemy' && s.state === 'play' && (s.turnDelay -= dt) <= 0) {
      for (const e of s.entities) if (!e.dead) for (const b of e.behaviors) b.turn?.(e, s);
      if (s.state === 'play') { s.turnSide = 'player'; s.addVar('turn', 1); s.setVar('turnText', s.settings.playerTurnText || 'Your turn'); s.emit('turn'); }
    }
    const steps = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < steps; i++) this.physics.step(s, dt / steps);
    s.time += dt;
    if (s.settings.winScore && s.vars.score >= s.settings.winScore) s.win();
    if (s.settings.timeLimit && s.state === 'play') {
      s.vars.time = Math.max(0, (s.vars.time ?? s.settings.timeLimit) - dt);
      if (s.vars.time <= 0) { s.message("Time's up!", 3); s.gameOver(); }
    }
    this.stepEffects(dt);
    s.flush();
  }

  stepEffects(dt) {
    const s = this.scene;
    for (let i = s.timers.length - 1; i >= 0; i--) {
      const t = s.timers[i];
      if ((t.t -= dt) <= 0) { t.fn(); if (t.every) t.t += t.every; else s.timers.splice(i, 1); }
    }
    for (let i = s.tweens.length - 1; i >= 0; i--) {
      const tw = s.tweens[i]; tw.t += dt;
      const k = tw.ease(Math.min(1, tw.t / tw.duration));
      for (const key in tw.to) tw.target[key] = lerp(tw.from[key], tw.to[key], k);
      if (tw.t >= tw.duration) s.tweens.splice(i, 1);
    }
    const drag = s.mode === '3d' ? 0.97 : 0.95, g = s.mode === '3d' ? -6 : 0;
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= drag; p.vy = p.vy * drag + g * dt; p.vz *= drag;
      if ((p.life -= p.decay * dt) <= 0) s.particles.splice(i, 1);
    }
    s.camera.shake = Math.max(0, s.camera.shake - dt * 40);
    if (s.msg && (s.msg.t -= dt) <= 0) s.msg = null;
  }

  render() {
    if (!this.scene || !this.renderer) return;
    this.renderer.render(this.scene, this);
    renderUI(this, this.scene);
    this.onRenderUI?.(this.uiCtx, this.scene);
  }

  destroy() {
    this.running = false;
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.root.remove();
  }
}

/** Everything, for scripts: `P.Entity`, `P.rand`, ... */
export const Pocket = {
  VERSION, Engine, Scene, Entity, VoxelWorld, GEOMETRIES, partSize, VOXEL_PALETTE, VOXEL_NAMES, Camera2D, Camera3D, Physics, Input, Audio, Renderer2D, Renderer3D, anchorPoint,
  Behaviors, registerBehavior, paramDefault, formatNumber, M4, uid, clamp, lerp, rand, pick, DEG, hexToRgb, loadImage, storage: store,
};
export default Pocket;
