/*!
 * Pocket Engine — a small 2D + 3D game engine for mobile web browsers.
 * One file, no dependencies. 2D renders with Canvas 2D, 3D with WebGL.
 *
 *   import { Engine, Scene, Entity } from './pocket.js';
 *   const engine = new Engine();
 *   engine.start(() => Scene.fromJSON(myGameJson));
 */
export const VERSION = '0.1.0';

/** The game's console: messages from logic and scripts, warnings and errors (shown in the editor's Console). */
export const Log = {
  entries: [], listeners: new Set(), max: 500,
  add(level, text, source) {
    const last = this.entries[this.entries.length - 1], msg = String(text);
    if (last && last.level === level && last.text === msg && last.source === source) { last.count++; last.t = Date.now(); } // repeats collapse into one line
    else { this.entries.push({ level, text: msg, source: source || '', t: Date.now(), count: 1 }); if (this.entries.length > this.max) this.entries.shift(); }
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)('[pocket]', source ? source + ':' : '', msg);
    for (const f of this.listeners) { try { f(); } catch { /* a listener failing must not break the game */ } }
  },
  clear() { this.entries.length = 0; for (const f of this.listeners) f(); },
};

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

const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${a})`; };
const flickerK = (L, time, i) => (L.flicker ? 1 - L.flicker * 0.25 * (1 + Math.sin(time * 23 + i * 7) * Math.sin(time * 7.3 + i)) : 1);

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
  ortho(l, r, b, t, n, f) {
    return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
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
export const BAR_DEFAULTS = { var: 'hp', max: 100, maxVar: '', w: 160, h: 16, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 8, label: false, icon: '' }; // icon: show the value as repeated emoji (hearts)
export const TEXT_DEFAULTS = { value: 'Text', size: 24, color: '#ffffff', font: 'system-ui, -apple-system, sans-serif', weight: '800', align: 'center', outline: '', outlineWidth: 4, shadow: false };
export const LIGHT_DEFAULTS = { color: '#ffd9a0', intensity: 1, range: 160, flicker: 0 }; // 2D range in px, 3D range in units
export const MESH_DEFAULTS = { geometry: 'box', w: 1, h: 1, d: 1, r: 0.5, color: '#33f0ff', emissive: 0, opacity: 1 };
export const SPRITE_DEFAULTS = { src: '', w: 64, h: 64 };
export const BODY_DEFAULTS = {
  type: 'dynamic', shape: 'auto', w: 0, h: 0, d: 0, r: 0, sensor: false, gravityScale: 1, bounce: 0, vx: 0, vy: 0, vz: 0,
  ox: 0, oy: 0, oz: 0, // collider offset from the object's center
  oneWay: false, // platforms you can jump up through and land on
  mass: 1, friction: 0, drag: 0, maxFall: 0,
  lockX: false, lockY: false, lockZ: false, // freeze movement along an axis
  maxSpeed: 0, // 0 = no limit
  ignore: '', // comma-separated tags this body passes through
  layer: 0, // physics layer (0-7): which others it collides with comes from the scene's layer matrix
};
/** A collider component's shape as body settings (sizes left out = fit the visible shape). */
export function colliderBody(c) {
  if (!c) return null;
  const sized = c.w || c.h || c.r || c.d, shape = c.shape === 'circle' || c.shape === 'sphere' ? c.shape : 'box';
  const out = { shape: sized ? shape : 'auto', sensor: !!c.trigger };
  for (const k of ['w', 'h', 'd', 'r', 'ox', 'oy', 'oz', 'bounce', 'friction', 'layer', 'oneWay']) if (c[k] !== undefined && c[k] !== '') out[k] = c[k];
  return out;
}
/** Physics layers (Unity-style). matrix[i] is a bit mask of the layers layer i collides with. */
export const PHYSICS_LAYERS = ['Default', 'Player', 'Enemy', 'Bullet', 'Ground', 'Pickup', 'Layer 6', 'Layer 7'];
export const layerMatrix = (pl) => (Array.isArray(pl?.matrix) && pl.matrix.length === 8 ? pl.matrix : Array(8).fill(255));

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
    this.tiles = props.tiles ? new TileMap(props.tiles) : null; // 2D tilemap
    this.sun = props.sun ? { color: '#ffffff', intensity: 1, ambient: 0.45, shadows: true, ...props.sun } : null; // Directional Light (3D): its rotation aims the sunlight
    this.globalLight = props.globalLight ? { brightness: 1, color: '#0a0a1e', ...props.globalLight } : null; // Global Light 2D: how bright the whole scene is
    this.tileLayer = props.tiles?.layer ?? 4; // tilemaps collide as the Ground physics layer
    this.model = props.model ? { parts: (props.model.parts || []).map((q) => ({ ...q })) } : null;
    this.light = props.light ? { ...LIGHT_DEFAULTS, ...props.light } : null; // point light (2D and 3D)
    this.minimap = props.minimap ? { w: 120, h: 120, range: 800, bg: 'rgba(0,0,0,0.5)', border: '#ffffff', round: false, ...props.minimap } : null; // UI: overview of the level
    this.stretch = props.stretch || 'none'; this.margin = props.margin ?? 16; // UI: fill the screen width / height minus margins
    this.parentId = props.parent || null; this.parentEnt = null; this.local = null; // hierarchy: x/y/z… are relative to the parent
    this.collider = props.collider ? { ...props.collider } : null; // Unity-style collider: alone it makes a solid (static) object
    this.body = null;
    const col = colliderBody(props.collider);
    if (props.body || col) { this.setBody({ ...(props.body ? {} : { type: 'static' }), ...(props.body || {}), ...(col || {}) }); if (!props.body) this.body._colliderOnly = true; }
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
      if (!def) { Log.add('warn', `Unknown component "${b.type}"`, this.name); return null; }
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
    const x = this.rawExtents();
    if (x.swap) { const t = x.hx; x.hx = x.hy; x.hy = t; delete x.swap; }
    if (x.rot) { const c = Math.abs(Math.cos(x.rot)), n = Math.abs(Math.sin(x.rot)); x.bx = c * x.hx + n * x.hy; x.by = n * x.hx + c * x.hy; }
    return x;
  }
  rawExtents() {
    if (this.tiles) { // box around the painted cells; the entity sits at the top-left of cell (0, 0)
      const b = this.tiles.bounds, s = this.tiles.size, w = (b.i1 - b.i0 + 1) * s, hgt = (b.j1 - b.j0 + 1) * s;
      return { sphere: false, hx: w / 2, hy: hgt / 2, hz: Infinity, ox: b.i0 * s + w / 2, oy: b.j0 * s + hgt / 2, tiles: true };
    }
    if (this.voxels) {
      const b = this.voxels.bounds, s = this.voxels.size;
      return { sphere: false, hx: (b.i1 - b.i0 + 1) * s / 2, hy: (b.j1 - b.j0 + 1) * s / 2, hz: (b.k1 - b.k0 + 1) * s / 2, voxel: true };
    }
    const b = this.body, is2D = !this.mesh;
    const sx = Math.abs(this.sx), sy = Math.abs(this.sy), sz = Math.abs(this.sz);
    const off = b && (b.ox || b.oy || b.oz) ? { ox: b.ox * sx, oy: b.oy * sy, oz: (b.oz || 0) * sz } : null;
    if (b && b.shape !== 'auto') {
      if (b.shape === 'circle' || b.shape === 'sphere') return { sphere: true, r: (b.r || 10) * Math.max(sx, sy, is2D ? 0 : sz), ...off };
      return { sphere: false, hx: (b.w || 1) * sx / 2, hy: (b.h || 1) * sy / 2, hz: is2D ? Infinity : (b.d || 1) * sz / 2, ...off, ...this.rot2D() };
    }
    if (this.model && this.model.parts?.length) { // box around all the parts
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const q of this.model.parts) {
        const { c: [ox, oy, oz], s: [gx, gy, gz] } = partBounds(q), px = (q.x || 0) + ox, py = (q.y || 0) + oy, pz = (q.z || 0) + oz;
        x0 = Math.min(x0, px - gx / 2); x1 = Math.max(x1, px + gx / 2);
        y0 = Math.min(y0, py - gy / 2); y1 = Math.max(y1, py + gy / 2);
        z0 = Math.min(z0, pz - gz / 2); z1 = Math.max(z1, pz + gz / 2);
      }
      return { sphere: false, hx: (x1 - x0) * sx / 2, hy: (y1 - y0) * sy / 2, hz: (z1 - z0) * sz / 2, ox: (x0 + x1) / 2 * sx + (off?.ox || 0), oy: (y0 + y1) / 2 * sy + (off?.oy || 0), oz: (z0 + z1) / 2 * sz + (off?.oz || 0) };
    }
    if (off) { const r = this.rawExtents.call(Object.assign(Object.create(Entity.prototype), this, { body: { ...b, ox: 0, oy: 0, oz: 0 } })); return { ...r, ...off }; }
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
      return { sphere: false, hx: s.w * sx / 2, hy: s.h * sy / 2, hz: Infinity, ...this.rot2D() };
    }
    if (this.sprite) return { sphere: false, hx: this.sprite.w * sx / 2, hy: this.sprite.h * sy / 2, hz: Infinity, ...this.rot2D() };
    if (this.bar) return { sphere: false, hx: this.bar.w * sx / 2, hy: this.bar.h * sy / 2, hz: Infinity };
    if (this.minimap) return { sphere: false, hx: this.minimap.w * sx / 2, hy: this.minimap.h * sy / 2, hz: Infinity };
    if (this.text) {
      const len = String(this.text.value).length;
      return { sphere: false, hx: this.text.size * len * 0.3 * sx, hy: this.text.size * 0.6 * sy, hz: Infinity };
    }
    return { sphere: false, hx: 10, hy: 10, hz: is2D ? Infinity : 0.5 };
  }

  /** 2D boxes turned by rz collide as rotated rectangles. */
  rot2D() {
    if (this.mesh || this.ui || !this.rz || this.rz % 180 === 0) return null;
    if (this.rz % 90 === 0) return { swap: true };
    return { rot: this.rz * DEG };
  }

  /** Give this entity a body sized to its visuals if it has none. */
  ensureBody(opts = {}) {
    if (!this.body) this.setBody(opts);
    else if (this.body._colliderOnly && opts.type) { // a component needs this collider to move or be a trigger (coins, hazards)
      this.body.type = opts.type; if (opts.sensor) this.body.sensor = true; if (opts.gravityScale != null) this.body.gravityScale = opts.gravityScale;
      this.body._colliderOnly = false;
    }
    return this.body;
  }
}

// ============================================================================
// Voxels (Minecraft-style block worlds)
// ============================================================================
export const VOXEL_PALETTE = ['#6aa84f', '#8d6e63', '#9e9e9e', '#6d4c41', '#3d8b37', '#e3cf8f', '#4fa3e0', '#c0392b', '#f5f5f5', '#2b2b2b', '#f1c40f', '#8e44ad'];
export const VOXEL_NAMES = ['Grass', 'Dirt', 'Stone', 'Wood', 'Leaves', 'Sand', 'Water', 'Brick', 'Snow', 'Obsidian', 'Gold', 'Crystal'];
const CHUNK = 16;

/** 2D tile types: what a painted cell does. */
export const TILE_KINDS = [['solid', 'Solid (walls, ground)'], ['platform', 'One-way platform'], ['hazard', 'Hazard (hurts the player)'], ['decor', 'Decoration (no collision)']];
export const TILE_PALETTE = [
  { fill: '#6d4c41', top: '#7cb342', kind: 'solid' }, // grass
  { fill: '#8d6e63', kind: 'solid' },                  // dirt
  { fill: '#78909c', kind: 'solid' },                  // stone
  { fill: '#a1887f', kind: 'platform' },               // plank
  { fill: '#b0bec5', emoji: '🔺', kind: 'hazard' },     // spikes
  { fill: '#4fc3f7', kind: 'decor' },                  // water / sky decor
];
/** A 2D grid of painted tiles. Cell (i, j) fills [i, i+1) × size from the owning entity's position (its top-left corner). */
export class TileMap {
  constructor(o = {}) {
    this.size = o.size || 40;
    this.palette = (o.palette && o.palette.length ? o.palette : TILE_PALETTE).map((t) => ({ ...t }));
    this.cells = new Map();
    for (const [k, v] of Object.entries(o.cells || {})) if (v) this.cells.set(k, v);
    this.version = 0;
  }
  get(i, j) { return this.cells.get(i + ',' + j) || 0; }
  set(i, j, n) { const k = i + ',' + j; if (n) this.cells.set(k, n); else this.cells.delete(k); this.version++; this._b = null; }
  kindOf(n) { return n ? this.palette[n - 1]?.kind || 'solid' : null; }
  cell(e, x, y) { return [Math.floor((x - e.x) / this.size), Math.floor((y - e.y) / this.size)]; }
  /** The tile type at a world point (0 when empty). */
  at(e, x, y) { const [i, j] = this.cell(e, x, y); return this.get(i, j); }
  solidAtWorld(e, x, y) { const n = this.at(e, x, y); return !!n && this.kindOf(n) === 'solid'; }
  get count() { return this.cells.size; }
  get bounds() {
    if (this._b) return this._b;
    let i0 = 0, i1 = 0, j0 = 0, j1 = 0, first = true;
    for (const k of this.cells.keys()) {
      const [i, j] = k.split(',').map(Number);
      if (first) { i0 = i1 = i; j0 = j1 = j; first = false; continue; }
      i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
    }
    return (this._b = { i0, i1, j0, j1 });
  }
  toJSON() { return { size: this.size, palette: this.palette, cells: Object.fromEntries(this.cells) }; }
}

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
    this.ortho = !!o.ortho; this.orthoSize = o.orthoSize ?? 14; // orthographic: no perspective, orthoSize = visible height
  }
}

// ============================================================================
// Tweens (DOTween-style): eases, chainable tweens, sequences, punch / shake / path / jump
// ============================================================================
const PI = Math.PI, c1 = 1.70158, c2 = c1 * 1.525, c3 = c1 + 1, c4 = (2 * PI) / 3, c5 = (2 * PI) / 4.5;
const bounceOut = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
export const Ease = {
  linear: (x) => x,
  inSine: (x) => 1 - Math.cos((x * PI) / 2), outSine: (x) => Math.sin((x * PI) / 2), inOutSine: (x) => -(Math.cos(PI * x) - 1) / 2,
  inQuad: (x) => x * x, outQuad: (x) => 1 - (1 - x) * (1 - x), inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inCubic: (x) => x ** 3, outCubic: (x) => 1 - (1 - x) ** 3, inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4, outQuart: (x) => 1 - (1 - x) ** 4, inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  inExpo: (x) => (x === 0 ? 0 : 2 ** (10 * x - 10)), outExpo: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2),
  inCirc: (x) => 1 - Math.sqrt(1 - x * x), outCirc: (x) => Math.sqrt(1 - (x - 1) ** 2), inOutCirc: (x) => (x < 0.5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2),
  inBack: (x) => c3 * x ** 3 - c1 * x * x, outBack: (x) => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2,
  inOutBack: (x) => (x < 0.5 ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2 : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2),
  inElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * c4)),
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1),
  inOutElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1),
  inBounce: (x) => 1 - bounceOut(1 - x), outBounce: bounceOut, inOutBounce: (x) => (x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2),
};
export const EASES = Object.keys(Ease);
const easeFn = (e) => (typeof e === 'function' ? e : Ease[e] || Ease.outQuad);
const getP = (o, path) => (path.includes('.') ? path.split('.').reduce((a, k) => a?.[k], o) : o[path]);
const setP = (o, path, v) => { if (!path.includes('.')) { o[path] = v; return; } const ks = path.split('.'); let a = o; for (const k of ks.slice(0, -1)) { if (a[k] == null) return; a = a[k]; } a[ks.at(-1)] = v; };
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v);
const mixColor = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + [0, 1, 2].map((i) => Math.round((A[i] + (B[i] - A[i]) * t) * 255).toString(16).padStart(2, '0')).join(''); };

/**
 * A tween: animates properties of `target` (numbers or #colors, nested paths like 'shape.fill'; 'scale' sets sx/sy/sz).
 * Chain options: .setEase('outBack').setDelay(0.2).setLoops(3, 'yoyo').setRelative().onComplete(fn)
 */
export class Tween {
  constructor(target, props, duration = 0.5, o = {}) {
    this.target = target; this.props = { ...props }; this.duration = Math.max(1e-4, duration);
    this.ease = easeFn(o.ease); this.delay = o.delay || 0; this.loops = o.loops ?? 0; this.loopType = o.loopType || 'restart';
    this.relative = !!o.relative; this.custom = o.custom || null; this.done = false; this.paused = false; this.time = 0;
    this.completeFns = o.onComplete ? [o.onComplete] : []; this.updateFn = o.onUpdate || null; this.from = null; this.id = o.id;
    if (this.props.scale !== undefined) { const k = this.props.scale; delete this.props.scale; Object.assign(this.props, { sx: k, sy: k, sz: k }); }
  }
  setEase(e) { this.ease = easeFn(e); return this; }
  setDelay(d) { this.delay = d; return this; }
  setLoops(n, type = 'restart') { this.loops = n; this.loopType = type; return this; }
  setRelative(r = true) { this.relative = r; return this; }
  onComplete(fn) { this.completeFns.push(fn); return this; }
  onUpdate(fn) { this.updateFn = fn; return this; }
  kill(complete = false) { if (complete) this.seek(this.totalDuration()); this.done = true; return this; }
  pause() { this.paused = true; return this; }
  play() { this.paused = false; return this; }
  totalDuration() { return this.loops < 0 ? Infinity : this.delay + this.duration * (this.loops + 1); }
  capture() {
    this.from = {}; this.to = {};
    for (const [k, v] of Object.entries(this.props)) {
      const cur = getP(this.target, k);
      this.from[k] = cur;
      this.to[k] = this.relative && !isColor(v) ? (+cur || 0) + v : v;
    }
  }
  /** Set the state at local time t (seconds since the tween started, delay included). */
  seek(t) {
    this.time = t;
    if (t < this.delay) return false;
    if (!this.from) this.capture();
    const lt = t - this.delay, cycle = Math.floor(lt / this.duration), end = this.loops >= 0 && cycle > this.loops;
    let k = end ? 1 : (lt % this.duration) / this.duration, c = end ? this.loops : cycle;
    if (end && this.loopType === 'yoyo' && this.loops % 2 === 1) k = 0;
    else if (this.loopType === 'yoyo' && c % 2 === 1) k = 1 - k;
    const e = this.ease(k);
    if (this.custom) this.custom(e, k, this);
    else for (const key in this.to) {
      const a = this.from[key], b = this.to[key];
      if (isColor(b)) setP(this.target, key, mixColor(isColor(a) ? a : b, b, e));
      else {
        const inc = this.loopType === 'incremental' ? (b - a) * c : 0;
        setP(this.target, key, (+a || 0) + inc + ((+b || 0) - (+a || 0)) * e);
      }
    }
    this.updateFn?.(e, this);
    return end;
  }
  update(dt) {
    if (this.paused || this.done) return this.done;
    if (this.seek(this.time + dt)) { this.done = true; for (const f of this.completeFns) f(this); }
    return this.done;
  }
}

/** A timeline of tweens and callbacks (DOTween Sequence): append, join, insert, interval, callback. */
export class Sequence {
  constructor() { this.items = []; this.end = 0; this.lastStart = 0; this.time = 0; this.loops = 0; this.loopType = 'restart'; this.done = false; this.paused = false; this.completeFns = []; }
  append(tw) { this.lastStart = this.end; this.items.push({ at: this.end, tw }); this.end += tw.totalDuration(); return this; }
  join(tw) { this.items.push({ at: this.lastStart, tw }); this.end = Math.max(this.end, this.lastStart + tw.totalDuration()); return this; }
  insert(at, tw) { this.items.push({ at, tw }); this.end = Math.max(this.end, at + tw.totalDuration()); return this; }
  appendInterval(sec) { this.end += sec; return this; }
  appendCallback(fn) { this.items.push({ at: this.end, fn }); return this; }
  setLoops(n, type = 'restart') { this.loops = n; this.loopType = type; return this; }
  onComplete(fn) { this.completeFns.push(fn); return this; }
  kill() { this.done = true; return this; }
  pause() { this.paused = true; return this; }
  play() { this.paused = false; return this; }
  totalDuration() { return this.loops < 0 ? Infinity : this.end * (this.loops + 1); }
  seek(t) {
    const len = this.end || 1e-4, cycle = Math.floor(t / len), end = this.loops >= 0 && cycle > this.loops;
    let lt = end ? len : t % len;
    if (this.loopType === 'yoyo' && cycle % 2 === 1 && !end) lt = len - lt;
    if (cycle !== this.cycle) { this.cycle = cycle; this.fired = new Set(); }
    for (const it of this.items) {
      if (it.fn) { if (lt >= it.at && !this.fired.has(it)) { this.fired.add(it); it.fn(); } continue; }
      if (lt >= it.at) it.tw.seek(Math.min(lt - it.at, it.tw.totalDuration()));
    }
    return end;
  }
  update(dt) {
    if (this.paused || this.done) return this.done;
    this.time += dt;
    if (this.seek(this.time)) { this.done = true; for (const f of this.completeFns) f(this); }
    return this.done;
  }
}
const catmull = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };

/** A point in a parent's local space → world space (parent position, rotation, scale). */
export function localToWorld(p, x, y, z, mode) {
  if (mode !== '3d' && !p.mesh && !p.model && !p.voxels) { const a = (p.rz || 0) * DEG, c = Math.cos(a), sn = Math.sin(a), lx = x * p.sx, ly = y * p.sy; return [p.x + lx * c - ly * sn, p.y + lx * sn + ly * c, p.z + z * p.sz]; }
  const q = M4.transformPoint(M4.trs(p.x, p.y, p.z, p.rx * DEG, p.ry * DEG, p.rz * DEG, p.sx, p.sy, p.sz), x, y, z);
  return [q.x, q.y, q.z];
}
/** A world point → a parent's local space. */
export function worldToLocal(p, x, y, z, mode) {
  if (mode !== '3d' && !p.mesh && !p.model && !p.voxels) { const a = -(p.rz || 0) * DEG, c = Math.cos(a), sn = Math.sin(a), dx = x - p.x, dy = y - p.y; return [(dx * c - dy * sn) / (p.sx || 1), (dx * sn + dy * c) / (p.sy || 1), (z - p.z) / (p.sz || 1)]; }
  const q = M4.transformPoint(M4.invert(M4.trs(p.x, p.y, p.z, p.rx * DEG, p.ry * DEG, p.rz * DEG, p.sx, p.sy, p.sz)), x, y, z);
  return [q.x, q.y, q.z];
}
/** A world-space movement → the same movement in a parent's local space. */
export function localDelta(p, dx, dy, dz, mode) {
  const a = worldToLocal(p, p.x, p.y, p.z, mode), b = worldToLocal(p, p.x + dx, p.y + dy, p.z + dz, mode);
  return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
}

// ============================================================================
// Scene
// ============================================================================
const DEFAULT_SETTINGS = {
  joystick: false, jumpButton: false, title: '', subtitle: '', saveBest: '', pauseButton: true, timeLimit: 0,
  muteButton: true, orientation: 'any', fullscreen: false,
  joystickSide: 'left', controlSize: 'medium', shareButton: true, saveProgress: false,
  controls: 'auto', joystickMode: 'floating', controlsOpacity: 1, jumpLabel: 'JUMP', actionLabel: 'FIRE', customScreens: false,
  turnBased: false, turnDelay: 0.3, loadOnStart: false,
};
const CONTROL_SCALE = { small: 0.8, medium: 1, large: 1.25 };

export class Scene {
  constructor(opts = {}) {
    this.mode = opts.mode === '3d' ? '3d' : '2d';
    this.name = opts.name || 'Scene';
    this.background = opts.background || (this.mode === '3d' ? '#87b8e8' : '#0b0b1a');
    this.view = { width: 400, height: 700, ...(opts.view || {}) };
    this.gravity = opts.gravity ?? (this.mode === '3d' ? -20 : 0); // along y (2D: +down, 3D: +up)
    this.gravityX = +opts.gravityX || 0; this.gravityZ = +opts.gravityZ || 0; // sideways gravity (wind, tilted worlds)
    this.settings = { ...DEFAULT_SETTINGS, ...(opts.settings || {}) };
    this.post = { ...(opts.post || {}) }; // post-processing: bloom, vignette, colour grading
    this.layerMask = layerMatrix(opts.physicsLayers); // which physics layers collide
    // sun (3D), ambient, sky/ground tint (3D), darkness (2D: 0 = off, 1 = pitch black; lights cut through it)
    this.light = { dir: { x: -0.4, y: -1, z: -0.3 }, color: '#ffffff', ambient: 0.45, intensity: 1, sky: '', ground: '', shadows: true, darkness: 0, ambientColor: '#0a0a1e', ...(opts.light || {}) };
    if (this.light.sunAngle != null || this.light.sunHeight != null) { // editor-friendly angles in degrees
      const a = (+this.light.sunAngle || 0) * DEG, h = (this.light.sunHeight ?? 60) * DEG;
      this.light.dir = { x: -Math.cos(h) * Math.sin(a), y: -Math.sin(h), z: -Math.cos(h) * Math.cos(a) };
    }
    this.fog = { near: 30, far: 120, ...(opts.fog || {}) };
    this.vars = { score: 0, ...(opts.vars || {}) };
    this.initialVars = { ...this.vars };
    this.camera = this.mode === '3d'
      ? new Camera3D(opts.camera)
      : new Camera2D({ x: this.view.width / 2, y: this.view.height / 2, ...(opts.camera || {}) });
    this.entities = [];
    this.templates = {};
    this.templateKids = {}; // template id → child descriptions
    this.kids = []; // entities that have a parent, parents first
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

  /**
   * Cast a ray and return the closest body it hits: { entity, dist, point } or null.
   * opts: { ignore: entity, tag: only this tag, solidOnly: skip triggers (default true) }
   */
  raycast(origin, dir, maxDist = Infinity, opts = {}) {
    const o = { x: origin.x, y: origin.y, z: origin.z || 0 }, l = Math.hypot(dir.x, dir.y, dir.z || 0) || 1;
    const d = { x: dir.x / l, y: dir.y / l, z: (dir.z || 0) / l };
    let best = null;
    for (const e of this.entities) {
      if (e.dead || e === opts.ignore || e.ui || !(e.body || opts.any)) continue;
      if (e.body && e.body.sensor && opts.solidOnly !== false) continue;
      if (opts.tag && !e.has(opts.tag)) continue;
      const t = rayHitExtents(o, d, e, e.extents());
      if (t != null && t <= maxDist && (!best || t < best.dist)) best = { entity: e, dist: t };
    }
    if (best) best.point = { x: o.x + d.x * best.dist, y: o.y + d.y * best.dist, z: o.z + d.z * best.dist };
    return best;
  }
  /** Camera impulse (Cinemachine): a shake that is weaker the further `at` is from the camera's focus. */
  impulse(strength = 10, at = null) {
    const c = this.camera, fx = this.mode === '3d' ? c.target.x : c.x, fy = this.mode === '3d' ? c.target.y : c.y, fz = this.mode === '3d' ? c.target.z : 0;
    const d = at ? Math.hypot(at.x - fx, at.y - fy, (at.z || 0) - fz) : 0, range = this.mode === '3d' ? 15 : 500;
    c.shake = Math.max(c.shake, strength / (1 + d / range));
    this.engine?.vibrate(Math.min(60, strength * 3));
  }
  /** Can `a` see `b` without a solid body in between? */
  canSee(a, b, maxDist = Infinity) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = (b.z || 0) - (a.z || 0), dist = Math.hypot(dx, dy, dz);
    if (dist > maxDist) return false;
    const hit = this.raycast(a, { x: dx, y: dy, z: dz }, dist, { ignore: a });
    return !hit || hit.entity === b || hit.dist >= dist - 1e-3;
  }

  // ---- save slots: variables, level, and where things are (collected items stay collected) ----
  saveGame(slot = 1) { return this.engine?.saveGame(slot); }
  loadGame(slot = 1) { return this.engine?.loadGame(slot); }
  hasSave(slot = 1) { return !!this.engine?.readSave(slot); }
  deleteSave(slot = 1) { this.engine?.deleteSave(slot); }

  // ---- cameras: objects with a Camera component; the active one drives the view ----
  setCamera(name) { this.activeCamera = name; this.cameraCut = true; }
  isActiveCamera(e) {
    const cams = (this.cameras || []).filter((c) => !c.dead);
    if (this.activeCamera) { const named = cams.find((c) => c.name === this.activeCamera); if (named) return named === e; }
    let top = null;
    for (const c of cams) if (!top || (c.data.camPriority || 0) > (top.data.camPriority || 0)) top = c;
    return top === e;
  }

  /** Show a message banner over the game for a few seconds. */
  message(text, seconds = 2.5) { this.msg = { text: String(text), t: seconds }; }

  /** Build a scene from a plain JSON description (what the editor saves). */
  static fromJSON(json, { editing = false } = {}) {
    const s = new Scene({ ...json, json });
    const tplIds = new Set((json.entities || []).filter((q) => q.template).map((q) => q.id)), inTpl = (ep) => { let q = ep, n = 0; const byId = s._jsonIds ||= new Map((json.entities || []).map((x) => [x.id, x])); while (q?.parent && n++ < 50) { if (tplIds.has(q.parent)) return true; q = byId.get(q.parent); } return false; };
    for (const ep of json.entities || []) {
      if (!editing && !ep.template && inTpl(ep)) { (s.templateKids[ep.parent] ||= []).push(ep); continue; } // children of templates spawn with them
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
    if (!base) { Log.add('warn', `Spawn: there is no template called "${templateOrProps}"`); return null; }
    const e = this.add(new Entity({ ...base, template: false, id: undefined, ...overrides }));
    const spawnKids = (srcId, parent) => { for (const k of this.templateKids[srcId] || []) { const c = this.add(new Entity({ ...k, template: false, id: undefined, parent: parent.id })); spawnKids(k.id, c); } };
    if (base.id) spawnKids(base.id, e);
    return e;
  }

  flush() {
    if (this.pending.length) {
      const linked = this.pending.some((e) => e.parentId) || this.kids.length;
      this.entities.push(...this.pending); this.pending.length = 0; this.entities.sort((a, b) => a.layer - b.layer);
      if (linked) this.linkHierarchy();
    }
    if (this.entities.some((e) => e.dead)) {
      for (const e of this.entities) if (e.dead) for (const b of e.behaviors) b.destroy?.(e, this);
      this.entities = this.entities.filter((e) => !e.dead);
    }
  }

  /** Connect children to parents (by id) and remember each child's local transform. */
  linkHierarchy() {
    const byId = new Map(this.entities.map((e) => [e.id, e]));
    const depth = (e) => { let n = 0, q = e; while (q.parentEnt && n < 50) { q = q.parentEnt; n++; } return n; };
    for (const e of this.entities) {
      const p = e.parentId ? byId.get(e.parentId) || null : null;
      e.parentEnt = p && p !== e ? p : null;
      if (e.parentEnt && !e.local) { e.local = { x: e.x, y: e.y, z: e.z, rx: e.rx, ry: e.ry, rz: e.rz, sx: e.sx, sy: e.sy, sz: e.sz, visible: e.visible }; e._lw = null; }
    }
    this.kids = this.entities.filter((e) => e.parentEnt).sort((a, b) => depth(a) - depth(b));
    this.syncHierarchy(true);
  }
  /** Children follow their parents (position, rotation, scale, visibility). Moves made to a child this frame are kept. */
  syncHierarchy(edit = false) {
    for (const e of this.kids) {
      const p = e.parentEnt;
      if (e.dead || !p) continue;
      if (p.dead) { if (!edit) e.destroy(); continue; }
      e._parentHidden = p.visible === false || !!p._parentHidden;
      if (e.ui) continue; // UI children are positioned inside their parent's box (uiOrigin)
      const L = e.local;
      if (!edit && e._lw) { // a behaviour or physics moved the child: fold that into its local transform
        const dx = e.x - e._lw.x, dy = e.y - e._lw.y, dz = e.z - e._lw.z;
        if (dx || dy || dz) { const d = localDelta(p, dx, dy, dz, this.mode); L.x += d[0]; L.y += d[1]; L.z += d[2]; }
        for (const k of ['rx', 'ry', 'rz']) L[k] += e[k] - e._lw[k];
        for (const k of ['sx', 'sy', 'sz']) if (e._lw[k]) L[k] *= e[k] / e._lw[k];
      }
      const w = localToWorld(p, L.x, L.y, L.z, this.mode);
      e.x = w[0]; e.y = w[1]; e.z = w[2];
      e.rx = p.rx + L.rx; e.ry = p.ry + L.ry; e.rz = p.rz + L.rz;
      e.sx = p.sx * L.sx; e.sy = p.sy * L.sy; e.sz = p.sz * L.sz;
      e._lw = { x: e.x, y: e.y, z: e.z, rx: e.rx, ry: e.ry, rz: e.rz, sx: e.sx, sy: e.sy, sz: e.sz };
    }
  }
  /** Light objects (Unity's Directional Light / Global Light 2D) drive the scene lighting. */
  syncLights() {
    let sun = null, gl = null;
    for (const e of this.entities) { if (e.dead || e.visible === false) continue; if (e.sun && !sun) sun = e; if (e.globalLight && !gl) gl = e; }
    if (sun && this.mode === '3d' && !this.light._driven) { // (a Day/Night Cycle component drives the sun itself)
      const rx = (sun.rx || 0) * DEG, ry = (sun.ry || 0) * DEG, L = this.light, S = sun.sun;
      L.dir = { x: Math.cos(rx) * Math.sin(ry), y: -Math.sin(rx), z: Math.cos(rx) * Math.cos(ry) };
      L.color = S.color; L.intensity = +S.intensity; L.ambient = +S.ambient; L.shadows = !!S.shadows;
    }
    if (gl && this.mode !== '3d' && !this.light._driven) { this.light.darkness = clamp(1 - (+gl.globalLight.brightness), 0, 1); this.light.ambientColor = gl.globalLight.color; }
  }
  childrenOf(e) { return this.entities.filter((q) => q.parentEnt === e && !q.dead); }

  find(name) { return this.entities.find((e) => e.name === name && !e.dead) || this.pending.find((e) => e.name === name); }
  findAll(tag) { return this.entities.filter((e) => !e.dead && (e.tags.has(tag) || e.name === tag)); }
  byId(id) { return this.entities.find((e) => e.id === id); }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); return this; }
  emit(evt, ...args) { for (const fn of this.listeners[evt] || []) fn(...args); }

  setVar(k, v) { this.vars[k] = v; this.emit('var', k, v); }
  /** Inventory: add (or with a negative n, remove) items. {inventory} lists them, {item_Name} counts one. */
  addItem(name, n = 1, icon = '') {
    const inv = (this.inventory ||= {});
    const it = inv[name] ||= { n: 0, icon };
    it.n = Math.max(0, it.n + n); if (icon) it.icon = icon;
    if (!it.n) delete inv[name];
    this.setVar('item_' + name, it.n || 0);
    this.setVar('inventory', Object.entries(inv).map(([k, v]) => `${v.icon || k}×${v.n}`).join('  ') || '—');
    this.emit('inventory', name, it.n || 0);
  }
  itemCount(name) { return this.inventory?.[name]?.n || 0; }
  /** Broadcast a message by name; Tween / Animator / Sprite Animation components and "On Message" nodes can react. */
  send(name, data) { if (name) this.emit('message', String(name), data); }
  addVar(k, d = 1) { this.setVar(k, (+this.vars[k] || 0) + d); }

  after(sec, fn) { this.timers.push({ t: sec, fn, every: 0 }); }
  every(sec, fn) { this.timers.push({ t: sec, fn, every: sec }); }
  /** Quick tween (kept for older code): animate `to` over `duration`. */
  tween(target, to, duration = 0.3, ease = 'outCubic') { return this.to(target, to, duration, { ease }); }
  /** DOTween-style: scene.to(e, { x: 100, 'shape.fill': '#f00' }, 0.5, { ease: 'outBack', loops: -1, loopType: 'yoyo' }) */
  to(target, props, duration = 0.5, opts = {}) { const t = new Tween(target, props, duration, opts); this.tweens.push(t); return t; }
  /** A sequence you fill with .append(scene.make(...)), .join(...), .appendInterval(s), .appendCallback(fn). */
  sequence() { const q = new Sequence(); this.tweens.push(q); return q; }
  /** A tween that is not started on its own (for sequences). */
  make(target, props, duration = 0.5, opts = {}) { return new Tween(target, props, duration, opts); }
  /** Punch: kick a property set away and spring back (DOPunchScale / DOPunchPosition). */
  punch(target, amount, duration = 0.5, { vibrato = 8, elasticity = 0.6, add = false } = {}) {
    const base = {}; for (const k in amount) base[k] = getP(target, k);
    const t = new Tween(target, {}, duration, { ease: 'linear', custom: (e, k) => {
      const w = Math.sin(k * PI * vibrato) * (1 - k) ** (1 + elasticity);
      for (const key in amount) setP(target, key, base[key] + amount[key] * w);
      if (k >= 1) for (const key in amount) setP(target, key, base[key]);
    } });
    if (!add) this.killTweens(target, true);
    this.tweens.push(t); return t;
  }
  /** Shake: random jitter that fades out (DOShakePosition / DOShakeRotation). */
  shakeProps(target, amount, duration = 0.5, { vibrato = 18 } = {}) {
    const base = {}; for (const k in amount) base[k] = getP(target, k);
    let last = -1, off = {};
    const t = new Tween(target, {}, duration, { ease: 'linear', custom: (e, k) => {
      const step = Math.floor(k * vibrato);
      if (step !== last) { last = step; for (const key in amount) off[key] = rand(-1, 1) * amount[key] * (1 - k); }
      for (const key in amount) setP(target, key, k >= 1 ? base[key] : base[key] + off[key]);
    } });
    this.tweens.push(t); return t;
  }
  /** Move through points [{x,y,z}…] on a smooth curve (DOPath). orient: turn to face the direction of travel. */
  path(target, points, duration = 2, opts = {}) {
    const P = [{ x: target.x, y: target.y, z: target.z || 0 }, ...points.map((q) => ({ x: +q.x || 0, y: +q.y || 0, z: +q.z || 0 }))];
    if (opts.closed) P.push({ ...P[0] });
    const n = P.length - 1, at = (i) => P[clamp(i, 0, n)];
    const t = new Tween(target, {}, duration, { ...opts, custom: (e) => {
      const f = clamp(e, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
      const nx = catmull(a.x, b.x, c.x, d.x, u), ny = catmull(a.y, b.y, c.y, d.y, u), nz = catmull(a.z, b.z, c.z, d.z, u);
      if (opts.orient) { const dx = nx - target.x, dy = ny - target.y, dz = nz - target.z; if (Math.hypot(dx, dy, dz) > 1e-4) { if (this.mode === '3d') target.ry = Math.atan2(dx, dz) / DEG; else target.rz = Math.atan2(dy, dx) / DEG; } }
      target.x = nx; target.y = ny; target.z = nz;
    } });
    this.tweens.push(t); return t;
  }
  /** Hop to a point in an arc (DOJump). */
  jumpTo(target, to, power = 80, jumps = 1, duration = 0.6, opts = {}) {
    const fx = target.x, fy = target.y, fz = target.z || 0, up = this.mode === '3d' ? 1 : -1;
    const t = new Tween(target, {}, duration, { ease: 'linear', ...opts, custom: (e, k) => {
      target.x = fx + ((to.x ?? fx) - fx) * e; target.z = fz + ((to.z ?? fz) - fz) * e;
      const hop = Math.abs(Math.sin(k * PI * jumps)) * power * up;
      target.y = fy + ((to.y ?? fy) - fy) * e + hop;
    } });
    this.tweens.push(t); return t;
  }
  /** Stop tweens on a target (or all with no target). complete: jump to their end first. */
  killTweens(target, complete = false) { for (const t of this.tweens) if (!target || t.target === target) t.kill(complete); }
  tweensOf(target) { return this.tweens.filter((t) => t.target === target && !t.done); }

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
    this.state = state; this.emit(state === 'win' ? 'win' : 'gameover');
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

/** Distance along a ray to an entity's collider, or null. */
function rayHitExtents(o, d, e, ex) {
  const c = { x: e.x + (ex.ox || 0), y: e.y + (ex.oy || 0), z: e.z + (ex.oz || 0) };
  if (ex.sphere) {
    const flat = !e.mesh && e.scene?.mode !== '3d';
    const mx = o.x - c.x, my = o.y - c.y, mz = flat ? 0 : o.z - c.z, dz = flat ? 0 : d.z;
    const A = d.x * d.x + d.y * d.y + dz * dz || 1, B = mx * d.x + my * d.y + mz * dz, C = mx * mx + my * my + mz * mz - ex.r * ex.r;
    if (C <= 0) return 0;
    const disc = B * B - A * C; if (disc < 0 || B > 0) return null;
    return (-B - Math.sqrt(disc)) / A;
  }
  let ox = o.x - c.x, oy = o.y - c.y, dx = d.x, dy = d.y;
  if (ex.rot) { const cs = Math.cos(ex.rot), sn = Math.sin(ex.rot); [ox, oy] = [ox * cs + oy * sn, -ox * sn + oy * cs]; [dx, dy] = [dx * cs + dy * sn, -dx * sn + dy * cs]; }
  let t0 = 0, t1 = Infinity;
  for (const [p, v, h] of [[ox, dx, ex.hx], [oy, dy, ex.hy], [o.z - c.z, d.z, ex.hz]]) {
    if (!Number.isFinite(h)) continue;
    if (Math.abs(v) < 1e-9) { if (Math.abs(p) > h) return null; continue; }
    let a = (-h - p) / v, b = (h - p) / v;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}

// ============================================================================
// Physics (arcade: axis-aligned boxes & spheres, shared by 2D and 3D)
// ============================================================================
function overlap(a, ea, b, eb) {
  if (ea.ox || ea.oy || ea.oz) a = { x: a.x + (ea.ox || 0), y: a.y + (ea.oy || 0), z: a.z + (ea.oz || 0) };
  if (eb.ox || eb.oy || eb.oz) b = { x: b.x + (eb.ox || 0), y: b.y + (eb.oy || 0), z: b.z + (eb.oz || 0) };
  return overlapRaw(a, ea, b, eb);
}
/** 2D separating-axis test for rotated rectangles (and circles against them). Normal points from a to b. */
function overlapSAT(a, ea, b, eb) {
  if (ea.sphere && eb.sphere) return null;
  if (ea.sphere || eb.sphere) {
    const [c, ec, bx, eBox, flip] = ea.sphere ? [a, ea, b, eb, false] : [b, eb, a, ea, true];
    const t = eBox.rot || 0, cs = Math.cos(t), sn = Math.sin(t);
    const dx = c.x - bx.x, dy = c.y - bx.y, lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs; // circle in the box's frame
    const qx = clamp(lx, -eBox.hx, eBox.hx), qy = clamp(ly, -eBox.hy, eBox.hy);
    let nx, ny, depth;
    const ox = lx - qx, oy = ly - qy, d = Math.hypot(ox, oy);
    if (d > 1e-6) { if (d >= ec.r) return null; nx = ox / d; ny = oy / d; depth = ec.r - d; }
    else { // center inside the box: push out along the nearest face
      const px = eBox.hx - Math.abs(lx), py = eBox.hy - Math.abs(ly);
      if (px < py) { nx = Math.sign(lx) || 1; ny = 0; depth = px + ec.r; } else { nx = 0; ny = Math.sign(ly) || 1; depth = py + ec.r; }
    }
    // (nx, ny) points box → circle in box space; rotate back to world
    let wx = nx * cs - ny * sn, wy = nx * sn + ny * cs;
    if (!flip) { wx = -wx; wy = -wy; } // a is the circle: normal from circle to box
    return { nx: wx, ny: wy, nz: 0, depth };
  }
  const axes = [];
  for (const e of [ea, eb]) { const t = e.rot || 0; axes.push([Math.cos(t), Math.sin(t)], [-Math.sin(t), Math.cos(t)]); }
  const dx = b.x - a.x, dy = b.y - a.y;
  let best = null;
  for (const [ux, uy] of axes) {
    const ra = proj(ea, ux, uy), rb = proj(eb, ux, uy), d = dx * ux + dy * uy, o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (!best || o < best.depth) best = { nx: ux * (Math.sign(d) || 1), ny: uy * (Math.sign(d) || 1), nz: 0, depth: o };
  }
  return best;
}
function proj(e, ux, uy) { const t = e.rot || 0, c = Math.cos(t), s = Math.sin(t); return e.hx * Math.abs(c * ux + s * uy) + e.hy * Math.abs(-s * ux + c * uy); }

function overlapRaw(a, ea, b, eb) {
  if (ea.rot || eb.rot) { // only 2D rectangles carry a rotation
    const ia = ea.sphere ? ea.r : ea.bx ?? ea.hx, ja = ea.sphere ? ea.r : ea.by ?? ea.hy, ib = eb.sphere ? eb.r : eb.bx ?? eb.hx, jb = eb.sphere ? eb.r : eb.by ?? eb.hy;
    if (Math.abs(b.x - a.x) >= ia + ib || Math.abs(b.y - a.y) >= ja + jb) return null;
    return overlapSAT(a, ea, b, eb);
  }
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

const ignoreSet = (b) => (b.ignore ? (b._ig && b._igSrc === b.ignore ? b._ig : (b._igSrc = b.ignore, b._ig = new Set(String(b.ignore).split(',').map((t) => t.trim()).filter(Boolean)))) : null);
const passes = (a, b) => { const ia = ignoreSet(a.body), ib = ignoreSet(b.body); return (ia && [...b.tags].some((t) => ia.has(t))) || (ib && [...a.tags].some((t) => ib.has(t))); };
/** Half-size of the box around a collider on the sweep axis (x). */
const spanX = (ex) => (ex.sphere ? ex.r : ex.bx ?? ex.hx);

export class Physics {
  constructor() { this.contacts = new Map(); }

  /** How many sub-steps this frame needs so fast, small bodies can't tunnel through walls. */
  substeps(scene, dt) {
    let n = Math.ceil(dt / (1 / 120));
    for (const e of scene.entities) {
      const b = e.body;
      if (!b || b.type === 'static' || e.dead || b.sensor && !b.ccd) continue;
      const v = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
      if (v < 1e-3) continue;
      const ex = e.extents(), size = Math.max(1e-3, ex.sphere ? ex.r : Math.min(ex.hx, ex.hy, Number.isFinite(ex.hz) ? ex.hz : Infinity));
      n = Math.max(n, Math.ceil(v * dt / (size * 0.8)));
    }
    return Math.min(n, 24);
  }

  step(scene, dt) {
    const g = scene.gravity, gd = Math.sign(g); // gravity along y
    const gx = scene.gravityX || 0, gz = scene.gravityZ || 0;
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
        b.vel.y += g * b.gravityScale * dt; b.vel.x += gx * b.gravityScale * dt; b.vel.z += gz * b.gravityScale * dt;
        if (b.force && b.forceT === scene.time) { b.vel.x += b.force.x * dt; b.vel.y += b.force.y * dt; b.vel.z += b.force.z * dt; } // force zones
        if (b.drag) { const k = Math.max(0, 1 - b.drag * dt); b.vel.x *= k; b.vel.z *= k; if (!g || !b.gravityScale) b.vel.y *= k; }
        if (b.maxFall && gd && b.vel.y * gd > b.maxFall) b.vel.y = b.maxFall * gd;
        if (b.maxSpeed) { const v = Math.hypot(b.vel.x, b.vel.y, b.vel.z); if (v > b.maxSpeed) { const k = b.maxSpeed / v; b.vel.x *= k; b.vel.y *= k; b.vel.z *= k; } }
      }
      if (b.lockX) b.vel.x = 0; if (b.lockY) b.vel.y = 0; if (b.lockZ) b.vel.z = 0;
      b.lx = e.x; b.ly = e.y; b.lz = e.z;
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
    // dynamic bodies collide with 2D tilemaps cell by cell
    const maps = scene.mode === '3d' ? [] : scene.entities.filter((e) => e.tiles && !e.dead && e.visible !== false);
    if (maps.length) {
      for (const e of list) {
        const b = e.body;
        if (b.type !== 'dynamic' || b.sensor) continue;
        for (const w of maps) {
          if (!((scene.layerMask[b.layer | 0] >> (w.tileLayer | 0)) & 1)) continue;
          const T = w.tiles, sz = T.size, half = sz / 2, box = { sphere: false, hx: half, hy: half, hz: Infinity };
          let ex = e.extents();
          const hx = ex.sphere ? ex.r : ex.bx ?? ex.hx, hy = ex.sphere ? ex.r : ex.by ?? ex.hy, cx = e.x + (ex.ox || 0), cy = e.y + (ex.oy || 0);
          const [i0, j0] = T.cell(w, cx - hx, cy - hy), [i1, j1] = T.cell(w, cx + hx - 1e-6, cy + hy - 1e-6);
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const n = T.get(i, j), kind = T.kindOf(n);
            if (!kind || kind === 'decor') continue;
            const c = { x: w.x + (i + 0.5) * sz, y: w.y + (j + 0.5) * sz, z: e.z };
            ex = e.extents();
            const m = overlap(e, ex, c, box);
            if (!m) continue;
            if (kind === 'hazard') { if (e.has('player') && scene.state === 'play' && !(e.data.invuln > 0)) respawnOrEnd(e, scene, 'damage'); continue; }
            if (kind === 'platform') { // only solid for something landing on top while falling
              if (!(gd && m.ny * gd > 0.5) || b.vel.y * gd < -0.01) continue;
              const top = gd > 0 ? w.y + j * sz : w.y + (j + 1) * sz, was = (b.ly ?? e.y) + (ex.oy || 0) + hy * gd; // where its feet were last step
              if ((was - top) * gd > 1) continue; // it was already below the top: let it pass
              if (T.get(i, j - gd) && T.kindOf(T.get(i, j - gd)) === 'platform') continue; // only the top of a stack
            } else if (Math.abs(m.nx) > 0.5 && T.kindOf(T.get(i - Math.sign(m.nx), j)) === 'solid') continue; // inner seam between two solid cells: don't snag
            else if (Math.abs(m.ny) > 0.5 && T.kindOf(T.get(i, j - Math.sign(m.ny))) === 'solid') continue;
            e.x -= m.nx * m.depth; e.y -= m.ny * m.depth;
            const vn = b.vel.x * m.nx + b.vel.y * m.ny;
            if (vn > 0) { b.vel.x -= m.nx * vn; b.vel.y -= m.ny * vn; }
            if (gd && m.ny * gd > 0.5) { b.grounded = true; b.groundedOn = w; }
          }
        }
      }
    }
    // broad phase: sort by left edge on x and only test bodies whose x ranges overlap (sweep and prune)
    const items = list.map((e) => { const ex = e.extents(), cx = e.x + (ex.ox || 0), w = spanX(ex); return { e, ex, l: cx - w, r: cx + w }; });
    items.sort((p, q) => p.l - q.l);
    const now = new Map();
    for (let i = 0; i < items.length; i++) {
      const A = items[i], a = A.e, ba = a.body;
      for (let j = i + 1; j < items.length; j++) {
        const B = items[j];
        if (B.l > A.r) break; // everything after starts further right
        const b = B.e, bb = b.body;
        if (ba.type === 'static' && bb.type === 'static') continue;
        if (a.dead || b.dead) continue;
        if ((ba.ignore || bb.ignore) && passes(a, b)) continue;
        if (!((scene.layerMask[ba.layer | 0] >> (bb.layer | 0)) & 1)) continue; // layer matrix says these two don't touch
        const m = overlap(a, A.ex, b, B.ex);
        if (!m) continue;
        const key = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
        now.set(key, [a, b]);
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
          if (vn > 0) { const k = vn * (1 + Math.max(ba.bounce, bb.bounce * 0.5)); ba.vel.x -= m.nx * k; ba.vel.y -= m.ny * k; ba.vel.z -= m.nz * k; }
          if (gd && m.ny * gd > 0.5) {
            ba.grounded = true; ba.groundedOn = b;
            if (!mb && bb.dx !== undefined) { a.x += bb.dx; a.z += bb.dz; if (bb.dy * gd < 0) a.y += bb.dy; } // ride moving platforms
            if (fr) { const k = Math.max(0, 1 - fr * dt * 10); ba.vel.x *= k; if (gd && b.mesh) ba.vel.z *= k; }
          }
          A.ex = a.extents();
        }
        if (mb) {
          b.x += m.nx * m.depth * shareB; b.y += m.ny * m.depth * shareB; b.z += m.nz * m.depth * shareB;
          const vn = bb.vel.x * m.nx + bb.vel.y * m.ny + bb.vel.z * m.nz;
          if (vn < 0) { const k = vn * (1 + Math.max(bb.bounce, ba.bounce * 0.5)); bb.vel.x -= m.nx * k; bb.vel.y -= m.ny * k; bb.vel.z -= m.nz * k; }
          if (gd && m.ny * gd < -0.5) {
            bb.grounded = true; bb.groundedOn = a;
            if (!ma && ba.dx !== undefined) { b.x += ba.dx; b.z += ba.dz; if (ba.dy * gd < 0) b.y += ba.dy; }
            if (fr) { const k = Math.max(0, 1 - fr * dt * 10); bb.vel.x *= k; if (b.mesh) bb.vel.z *= k; }
          }
          B.ex = b.extents();
        }
      }
    }
    // contacts that ended this step
    for (const [key, [a, b]] of this.contacts) if (!now.has(key)) { separate(a, b); separate(b, a); }
    this.contacts = now;
    for (const e of list) {
      const b = e.body;
      if (b.type !== 'dynamic') { b.px = e.x; b.py = e.y; b.pz = e.z; }
      else { if (b.lockX) e.x = b.lx; if (b.lockY) e.y = b.ly; if (b.lockZ) e.z = b.lz; }
    }
  }

  /** Is `a` touching something tagged `tag` right now? */
  touching(a, tag) {
    for (const [x, y] of this.contacts.values()) if ((x === a && y.has(tag)) || (y === a && x.has(tag))) return true;
    return false;
  }
}

function separate(e, other) {
  if (e.dead) return;
  for (const b of e.behaviors) b.separate?.(e, other, e.scene);
  e.scene?.emit('separate', e, other);
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
    this.ups = []; // fingers lifted this frame: { id, x, y, sx, sy, time }
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
    const btn = this.buttons.find((b) => (b.w ? Math.abs(p.x - b.x) < b.w / 2 && Math.abs(p.y - b.y) < b.h / 2 : Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3));
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
    if (!cancelled && ptr.role === 'free') this.ups.push({ id: e.pointerId, x: ptr.x, y: ptr.y, sx: ptr.sx, sy: ptr.sy, time: dt / 1000 });
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

  endFrame() { this.justPressed.clear(); this.taps.length = 0; this.downs.length = 0; this.ups.length = 0; this.drag.dx = 0; this.drag.dy = 0; }
  reset() { this.pointers.clear(); this.stick = null; this.useTilt = false; this.tiltBase = null; this.endFrame(); }
}

// ============================================================================
// Audio: tiny WebAudio synth for sound effects, plus file playback
// ============================================================================
/** Sound names every picker offers: the built-in synth sounds, then the game's imported sounds (the editor adds those). */
export const SOUNDS = ['coin', 'jump', 'hit', 'power', 'win', 'lose', 'click'];
export class Audio {
  constructor() { this.ctx = null; this.muted = store.get('pocket.muted', '0') === '1'; this.buffers = new Map(); this.volume = 1; this.clips = {}; }
  unlock() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; } }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; store.set('pocket.muted', m ? '1' : '0'); }
  tone({ freq = 440, to = freq, dur = 0.15, type = 'square', vol = 0.15, delay = 0 } = {}) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    if (this.volume <= 0.001) return;
    g.gain.setValueAtTime(vol * this.volume, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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
      default: if (name) this.play(this.clips[name] || name); // an imported sound by name, or a URL
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
    s.buffer = buf; g.gain.value = vol * this.volume; s.connect(g).connect(this.ctx.destination); s.start();
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

/** Paint a tilemap's cells (only the ones on screen). */
function drawTiles2D(ctx, e) {
  const T = e.tiles, sz = T.size, m = ctx.getTransform(), inv = m.inverse(), W = ctx.canvas.width, H = ctx.canvas.height;
  const p0 = inv.transformPoint({ x: 0, y: 0 }), p1 = inv.transformPoint({ x: W, y: H });
  const xa = Math.min(p0.x, p1.x) - e.x, xb = Math.max(p0.x, p1.x) - e.x, ya = Math.min(p0.y, p1.y) - e.y, yb = Math.max(p0.y, p1.y) - e.y;
  ctx.save(); ctx.translate(e.x, e.y); ctx.globalAlpha = e.alpha;
  for (const [k, n] of T.cells) {
    const c = k.indexOf(','), i = +k.slice(0, c), j = +k.slice(c + 1), x = i * sz, y = j * sz;
    if (x + sz < xa || x > xb || y + sz < ya || y > yb) continue;
    const t = T.palette[n - 1]; if (!t) continue;
    const kind = t.kind || 'solid', above = T.get(i, j - 1);
    if (kind === 'platform') { ctx.fillStyle = t.fill; ctx.fillRect(x, y, sz, sz * 0.3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + sz * 0.3 - 3, sz, 3); }
    else if (t.fill && !(kind === 'hazard' && t.emoji)) { ctx.fillStyle = t.fill; ctx.fillRect(x, y, sz + 0.5, sz + 0.5); }
    if (t.top && kind === 'solid' && (!above || T.kindOf(above) !== 'solid')) { ctx.fillStyle = t.top; ctx.fillRect(x, y, sz + 0.5, sz * 0.22); }
    if (kind === 'solid' && !t.top) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, sz, 2); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x, y + sz - 2, sz, 2); }
    if (t.emoji) { ctx.font = `${Math.round(sz * 0.8)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.emoji, x + sz / 2, y + sz / 2 + sz * 0.04); }
  }
  ctx.restore();
}
function drawEntity2D(ctx, e, vars, time) {
  if (e.tiles) { drawTiles2D(ctx, e); if (!e.shape && !e.sprite && !e.text) return; }
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
    if (img.complete && img.naturalWidth) {
      const S = e.sprite, cols = Math.max(1, S.cols | 0 || 1), rows = Math.max(1, S.rows | 0 || 1);
      if (S.flip) ctx.scale(-1, 1);
      if (cols > 1 || rows > 1) { // sprite sheet: draw one cell of the grid
        const fw = img.naturalWidth / cols, fh = img.naturalHeight / rows, f = ((S.frame | 0) % (cols * rows) + cols * rows) % (cols * rows);
        ctx.drawImage(img, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh, -S.w / 2, -S.h / 2, S.w, S.h);
      } else ctx.drawImage(img, -S.w / 2, -S.h / 2, S.w, S.h);
      if (S.flip) ctx.scale(-1, 1);
    }
  }
  if (e.bar) { // progress / health bar bound to a variable (or this object's own value with "self.hp")
    const b = e.bar, src = b.var.startsWith('self.') ? e.data : vars, key = b.var.replace(/^self\./, '');
    const max = (b.maxVar ? +(b.maxVar.startsWith('self.') ? e.data : vars)[b.maxVar.replace(/^self\./, '')] : +b.max) || 1;
    const k = clamp((+src[key] || 0) / max, 0, 1);
    if (b.style === 'ring') { // radial / circular progress
      const r = Math.min(b.w, b.h) / 2, lw = Math.max(3, r * 0.22);
      e.data._barK = e.data._barK == null ? k : e.data._barK + (k - e.data._barK) * 0.25;
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.strokeStyle = b.bg; ctx.beginPath(); ctx.arc(0, 0, r - lw / 2, 0, Math.PI * 2); ctx.stroke();
      if (e.data._barK > 0.001) { ctx.strokeStyle = b.fill; ctx.beginPath(); ctx.arc(0, 0, r - lw / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * e.data._barK); ctx.stroke(); }
      if (b.label) { ctx.font = `800 ${Math.round(r * 0.5)}px system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(k * 100)}%`, 0, 1); }
    } else if (b.icon) { // hearts-style: one icon per point, empty ones faded
      const n = Math.min(20, Math.round(max)), val = Math.round(+src[key] || 0), sz = b.h, gap = sz * 1.15, x0 = -((n - 1) * gap) / 2;
      ctx.font = `${Math.round(sz)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { ctx.globalAlpha = alpha * (i < val ? 1 : 0.25); ctx.fillText(b.icon, x0 + i * gap, sz * 0.06); }
      ctx.globalAlpha = alpha;
    } else {
    e.data._barK = e.data._barK == null ? k : e.data._barK + (k - e.data._barK) * 0.25;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, b.radius); else ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.fillStyle = b.bg; ctx.fill();
    if (e.data._barK > 0.001) {
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-b.w / 2, -b.h / 2, b.w * e.data._barK, b.h, b.radius); else ctx.rect(-b.w / 2, -b.h / 2, b.w * e.data._barK, b.h);
      ctx.fillStyle = b.fill; ctx.fill();
    }
    if (b.label) { ctx.font = `800 ${Math.round(b.h * 0.7)}px system-ui, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${formatNumber(+src[key] || 0)} / ${formatNumber(max)}`, 0, 1); }
    }
  }
  if (e.text) {
    const t = e.text;
    ctx.font = `${t.weight} ${t.size}px ${t.font}`;
    ctx.fillStyle = t.color; ctx.textAlign = t.align; ctx.textBaseline = 'middle';
    const str = fillTemplate(t.value, Object.keys(e.data).length ? Object.assign(Object.create(vars), e.data) : vars);
    if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = t.size * 0.25; ctx.shadowOffsetY = t.size * 0.08; }
    if (t.outline) { ctx.strokeStyle = t.outline; ctx.lineWidth = t.outlineWidth || 4; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); ctx.shadowColor = 'transparent'; }
    ctx.fillText(str, 0, 0);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
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
    for (const e of scene.entities) { const L = e.data._line; if (L && !e.dead) { ctx.strokeStyle = L[6]; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[3], L[4]); ctx.stroke(); } }
    for (const e of scene.entities) if (e.visible && !e.ui && !e.dead && !e._parentHidden) drawEntity2D(ctx, e, scene.vars, scene.time);
    for (const p of scene.particles) {
      ctx.globalAlpha = Math.max(0, p.life) * (p.alpha ?? 1);
      ctx.fillStyle = p.color;
      if (p.round) { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      else if (p.stretch) ctx.fillRect(p.x - p.size / 4, p.y - p.size * p.stretch / 2, p.size / 2, p.size * p.stretch);
      else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // lights: a soft additive glow, and holes cut into the darkness layer
    const lights = scene.entities.filter((e) => e.light && !e.light.off && e.visible && !e.dead && !e.ui);
    if (lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      lights.forEach((e, i) => {
        const L = e.light, r = L.range * flickerK(L, scene.time, i), gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        gr.addColorStop(0, rgba(L.color, clamp(0.35 * L.intensity, 0, 1))); gr.addColorStop(1, rgba(L.color, 0));
        ctx.fillStyle = gr; ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2);
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    engine.onRenderWorld?.(ctx, scene, z);
    ctx.restore();
    const dark = +scene.light.darkness || 0;
    if (dark > 0) {
      const lm = this.lightMap ||= document.createElement('canvas');
      if (lm.width !== this.canvas.width || lm.height !== this.canvas.height) { lm.width = this.canvas.width; lm.height = this.canvas.height; }
      const l = lm.getContext('2d');
      l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over';
      l.clearRect(0, 0, lm.width, lm.height);
      l.fillStyle = rgba(scene.light.ambientColor || '#0a0a1e', clamp(engine.editing ? dark * 0.6 : dark, 0, 1));
      l.fillRect(0, 0, lm.width, lm.height);
      l.globalCompositeOperation = 'destination-out';
      l.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0); l.translate(engine.width / 2, engine.height / 2); l.scale(z, z); l.translate(-c.x, -c.y);
      lights.forEach((e, i) => {
        const L = e.light, r = L.range * flickerK(L, scene.time, i), gr = l.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        gr.addColorStop(0, `rgba(0,0,0,${clamp(L.intensity, 0, 1)})`); gr.addColorStop(0.55, `rgba(0,0,0,${clamp(L.intensity * 0.6, 0, 1)})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = gr; l.fillRect(e.x - r, e.y - r, r * 2, r * 2);
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lm, 0, 0);
    }
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
uniform vec3 uColor, uLightDir, uLightColor, uFogColor, uCamPos, uSky, uGround;
uniform float uAmbient, uEmissive, uFogNear, uFogFar, uOpacity, uVColor;
uniform vec3 uPLPos[8]; uniform vec3 uPLCol[8]; uniform float uPLRange[8]; uniform int uPLCount; uniform float uDouble;
void main() {
  vec3 base = mix(uColor, vCol, uVColor);
  vec3 n = normalize(vN);
  if (uDouble > 0.5 && !gl_FrontFacing) n = -n;
  vec3 l = normalize(-uLightDir);
  float d = max(dot(n, l), 0.0);
  vec3 v = normalize(uCamPos - vW);
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), 32.0) * 0.25;
  vec3 amb = uAmbient * mix(uGround, uSky, n.y * 0.5 + 0.5);
  vec3 lit = base * (amb + uLightColor * d * (1.0 - uAmbient)) + sp * uLightColor;
  for (int i = 0; i < 8; i++) {
    if (i >= uPLCount) break;
    vec3 tl = uPLPos[i] - vW; float dist = length(tl);
    float att = clamp(1.0 - dist / uPLRange[i], 0.0, 1.0); att *= att;
    vec3 pl = tl / max(dist, 0.0001);
    lit += base * uPLCol[i] * max(dot(n, pl), 0.0) * att + uPLCol[i] * pow(max(dot(n, normalize(pl + v)), 0.0), 24.0) * 0.2 * att;
  }
  vec3 c = mix(lit, base, uEmissive);
  float f = clamp((length(uCamPos - vW) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogColor, f), uOpacity);
}`;

export { geometry as geometryArrays };
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
/** Bounding box of an editable mesh part, in its local (scaled) space: { min: [x,y,z], max: [x,y,z] }. */
export function meshBounds(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], sc = [m.sx ?? 1, m.sy ?? 1, m.sz ?? 1];
  for (const v of m.verts || []) for (let i = 0; i < 3; i++) { const c = v[i] * sc[i]; if (c < min[i]) min[i] = c; if (c > max[i]) max[i] = c; }
  if (min[0] === Infinity) return { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] };
  return { min, max };
}
/** Part box: center offset (local) and size. Primitives are centered; meshes may not be. */
export function partBounds(m) {
  if (m.geometry === 'mesh') { const b = meshBounds(m); return { c: [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2), s: [0, 1, 2].map((i) => Math.max(0.02, b.max[i] - b.min[i])) }; }
  return { c: [0, 0, 0], s: partSize(m) };
}
export function partSize(m) {
  if (m.geometry === 'mesh') return partBounds(m).s;
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

/** Newell normal of a polygon (un-normalized: length = 2 × area). */
export function faceNormal(verts, idx) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < idx.length; i++) {
    const a = verts[idx[i]], b = verts[idx[(i + 1) % idx.length]];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [x, y, z];
}
/** Triangles (fan) for an editable mesh: interleaved position / normal / color. */
function buildMeshData(q) {
  const V = q.verts, out = [], base = hexToRgb(q.color || '#cccccc');
  const fns = q.faces.map((f) => faceNormal(V, f.v));
  let vn = null;
  if (q.smooth) {
    vn = V.map(() => [0, 0, 0]);
    q.faces.forEach((f, i) => { for (const k of f.v) if (vn[k]) { vn[k][0] += fns[i][0]; vn[k][1] += fns[i][1]; vn[k][2] += fns[i][2]; } });
    vn = vn.map((n) => { const l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; });
  }
  q.faces.forEach((f, i) => {
    if (f.v.length < 3 || f.v.some((k) => !V[k])) return;
    const l = Math.hypot(...fns[i]) || 1, fn = [fns[i][0] / l, fns[i][1] / l, fns[i][2] / l], col = f.c ? hexToRgb(f.c) : base;
    for (let t = 1; t < f.v.length - 1; t++) for (const k of [f.v[0], f.v[t], f.v[t + 1]]) {
      const p = V[k], n = vn ? vn[k] : fn;
      out.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2]);
    }
  });
  return new Float32Array(out);
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
    this.meshCache = new Map(); // editable mesh parts (by their verts array) → GPU buffers, oldest dropped first
    this.u = {};
    for (const n of ['uModel', 'uViewProj', 'uNormalMat', 'uColor', 'uLightDir', 'uLightColor', 'uFogColor', 'uCamPos', 'uAmbient', 'uEmissive', 'uFogNear', 'uFogFar', 'uOpacity', 'uVColor', 'uSky', 'uGround', 'uPLPos', 'uPLCol', 'uPLRange', 'uPLCount', 'uDouble']) this.u[n] = gl.getUniformLocation(prog, n);
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

  /** Editable mesh part (verts + polygon faces with their own colors), drawn double-sided. */
  drawEditableMesh(q, model, opacity = 1) {
    const gl = this.gl;
    if (!q.verts?.length || !q.faces?.length) return;
    let h = (q.verts.length * 31 + q.faces.length * 17) | 0;
    for (const v of q.verts) h = (h * 31 + ((v[0] * 997 + v[1] * 991 + v[2] * 983) * 1000 | 0)) | 0;
    for (const f of q.faces) { h = (h * 31 + f.v.length) | 0; for (const i of f.v) h = (h * 7 + i) | 0; if (f.c) h = (h * 13 + f.c.charCodeAt(1) + f.c.charCodeAt(6)) | 0; }
    const key = h + '|' + (q.color || '') + '|' + (q.smooth ? 1 : 0);
    let c = this.meshCache.get(q.verts);
    if (!c || c.key !== key) {
      const data = buildMeshData(q);
      if (!c) {
        c = { buf: gl.createBuffer() }; this.meshCache.set(q.verts, c);
        if (this.meshCache.size > 160) { const [k0, old] = this.meshCache.entries().next().value; gl.deleteBuffer(old.buf); this.meshCache.delete(k0); }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, c.buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      c.count = data.length / 9; c.key = key;
    }
    const nm = M4.invert(model);
    gl.uniformMatrix4fv(this.u.uModel, false, model);
    gl.uniformMatrix3fv(this.u.uNormalMat, false, [nm[0], nm[4], nm[8], nm[1], nm[5], nm[9], nm[2], nm[6], nm[10]]);
    gl.uniform3f(this.u.uColor, 1, 1, 1); gl.uniform1f(this.u.uEmissive, q.emissive || 0); gl.uniform1f(this.u.uOpacity, opacity); gl.uniform1f(this.u.uVColor, 1); gl.uniform1f(this.u.uDouble, 1);
    gl.disable(gl.CULL_FACE);
    if (opacity < 1) gl.enable(gl.BLEND);
    gl.enableVertexAttribArray(2);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, c.count);
    gl.disableVertexAttribArray(2); gl.vertexAttrib3f(2, 1, 1, 1);
    gl.uniform1f(this.u.uVColor, 0); gl.uniform1f(this.u.uDouble, 0);
    gl.enable(gl.CULL_FACE);
    if (opacity < 1) gl.disable(gl.BLEND);
  }

  /** Draw a model: each part is a primitive placed relative to the object. */
  drawModel(e, opacityMul = 1) {
    const base = M4.trs(e.x, e.y, e.z, e.rx * DEG, e.ry * DEG, e.rz * DEG, e.sx, e.sy, e.sz);
    for (const q of e.model.parts) {
      if (q.geometry === 'mesh') {
        const local = M4.trs(q.x || 0, q.y || 0, q.z || 0, (q.rx || 0) * DEG, (q.ry || 0) * DEG, (q.rz || 0) * DEG, q.sx ?? 1, q.sy ?? 1, q.sz ?? 1);
        this.drawEditableMesh(q, M4.mul(base, local), (q.opacity ?? 1) * e.alpha * opacityMul);
        continue;
      }
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
    const hh = (c.orthoSize || 14) / 2, proj = c.ortho ? M4.ortho(-hh * aspect, hh * aspect, -hh, hh, -c.far, c.far) : M4.perspective(fovy, aspect, c.near, c.far);
    const up = c.ortho && Math.abs(eye.x - c.target.x) < 1e-3 && Math.abs(eye.z - c.target.z) < 1e-2 ? { x: 0, y: 0, z: -1 } : undefined; // straight-down views
    this.viewProj = M4.mul(proj, M4.lookAt(eye, c.target, up));
    const L = scene.light, ld = L.dir, ll = Math.hypot(ld.x, ld.y, ld.z) || 1;
    gl.uniformMatrix4fv(this.u.uViewProj, false, this.viewProj);
    gl.uniform3f(this.u.uLightDir, ld.x / ll, ld.y / ll, ld.z / ll);
    const lc = hexToRgb(L.color), li = L.intensity ?? 1;
    gl.uniform3f(this.u.uLightColor, lc[0] * li, lc[1] * li, lc[2] * li);
    gl.uniform1f(this.u.uAmbient, L.ambient);
    gl.uniform3fv(this.u.uSky, L.sky ? hexToRgb(L.sky) : [1, 1, 1]);
    gl.uniform3fv(this.u.uGround, L.ground ? hexToRgb(L.ground) : L.sky ? hexToRgb(L.sky).map((c) => c * 0.6) : [1, 1, 1]);
    // point lights: the 8 nearest to the camera
    const lights = scene.entities.filter((e) => e.light && !e.light.off && e.visible !== false && !e.dead && !e.ui)
      .sort((a, b) => Math.hypot(a.x - eye.x, a.y - eye.y, a.z - eye.z) - Math.hypot(b.x - eye.x, b.y - eye.y, b.z - eye.z)).slice(0, 8);
    const pos = new Float32Array(24), col = new Float32Array(24), rng = new Float32Array(8);
    lights.forEach((e, i) => {
      const Lt = e.light, c = hexToRgb(Lt.color), k = (Lt.intensity ?? 1) * flickerK(Lt, scene.time, i);
      pos.set([e.x, e.y, e.z], i * 3); col.set([c[0] * k, c[1] * k, c[2] * k], i * 3); rng[i] = Math.max(0.1, Lt.range > 50 ? 8 : Lt.range || 8);
    });
    gl.uniform3fv(this.u.uPLPos, pos); gl.uniform3fv(this.u.uPLCol, col); gl.uniform1fv(this.u.uPLRange, rng); gl.uniform1i(this.u.uPLCount, lights.length);
    gl.uniform3fv(this.u.uFogColor, bg);
    gl.uniform1f(this.u.uFogNear, scene.fog.near); gl.uniform1f(this.u.uFogFar, scene.fog.far);
    gl.uniform3f(this.u.uCamPos, eye.x, eye.y, eye.z);

    const transparent = [], shadows = [];
    for (const e of scene.entities) if (e.voxels && e.visible && !e.dead && !e._parentHidden) this.drawVoxels(e);
    for (const e of scene.entities) {
      if (!e.model || !e.visible || e.dead || e._parentHidden) continue;
      this.drawModel(e, e.data.invuln > 0 && Math.floor(scene.time * 12) % 2 ? 0.3 : 1);
      if (e.body && e.body.type !== 'static' && !e.body.sensor) shadows.push(e);
    }
    for (const e of scene.entities) {
      if (!e.mesh || !e.visible || e.dead || e._parentHidden) continue;
      let op = e.mesh.opacity * e.alpha;
      if (e.data.invuln > 0 && Math.floor(scene.time * 12) % 2) op *= 0.3;
      if (op < 1) { transparent.push([e, op]); } else this.drawMesh(e.mesh.geometry, this.meshModel(e), e.mesh.color, e.mesh.emissive);
      if (e.body && e.body.type !== 'static' && !e.body.sensor) shadows.push(e);
    }
    // blob shadows onto the highest static surface below each moving body
    gl.enable(gl.BLEND); gl.depthMask(false);
    const statics = scene.entities.filter((e) => e.body && e.body.type === 'static' && (e.mesh || e.model));
    for (const e of L.shadows === false ? [] : shadows) {
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
    for (const p of scene.particles) this.drawMesh(p.round ? 'sphere' : 'box', M4.trs(p.x, p.y, p.z, 0, 0, 0, p.size, p.size * (p.stretch || 1), p.size), p.color, 1, Math.max(0, p.life) * (p.alpha ?? 1));
    for (const e of scene.entities) if (e.data._line && !e.dead) { const L = e.data._line; this.drawLines(L.slice(0, 6), L[6]); }
    gl.depthMask(true); gl.disable(gl.BLEND);
    engine.onRenderWorld?.(this, scene);
  }
}

// ============================================================================
// UI overlay (HUD, joystick, buttons, title / game over screens) — always 2D
// ============================================================================
/** Dialogue box: speaker name, typewriter text, tap to continue. */
function drawDialog(ctx, scene, W, H, engine) {
  const d = scene.dialog, line = d.lines[d.i]; if (!line) return;
  const m = 14, bw = Math.min(W - m * 2, 560), bh = 132, x = (W - bw) / 2, y = H - engine.safe.bottom - bh - 20;
  ctx.save();
  ctx.fillStyle = 'rgba(12,12,26,0.92)'; ctx.strokeStyle = 'rgba(255,224,130,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, 16); else ctx.rect(x, y, bw, bh); ctx.fill(); ctx.stroke();
  if (line.who) {
    ctx.font = '800 15px system-ui, sans-serif'; const tw = ctx.measureText(line.who).width + 24;
    ctx.fillStyle = '#ffe082'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 14, y - 14, tw, 28, 14); else ctx.rect(x + 14, y - 14, tw, 28); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(line.who, x + 26, y + 1);
  }
  ctx.fillStyle = '#fff'; ctx.font = '600 17px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const text = line.text.slice(0, Math.floor(d.chars)), words = text.split(' '); let row = '', ty = y + 26;
  for (const w of words) { const t = row ? row + ' ' + w : w; if (ctx.measureText(t).width > bw - 36 && row) { ctx.fillText(row, x + 18, ty); row = w; ty += 24; } else row = t; }
  ctx.fillText(row, x + 18, ty);
  if (d.chars >= line.text.length) { ctx.fillStyle = `rgba(255,224,130,${0.5 + Math.sin(performance.now() / 200) * 0.5})`; ctx.textAlign = 'right'; ctx.fillText(d.i < d.lines.length - 1 ? '▼' : '✓', x + bw - 16, y + bh - 28); }
  ctx.restore();
}
/** Advance the dialogue: typewriter, tap to finish the line, tap again for the next. Returns true if it used the tap. */
function stepDialog(s, dt, tapped) {
  const d = s.dialog, line = d?.lines[d.i]; if (!line) { s.dialog = null; return false; }
  d.chars = Math.min(line.text.length, d.chars + dt * 45);
  if (!tapped) return false;
  if (d.chars < line.text.length) d.chars = line.text.length;
  else if (++d.i >= d.lines.length) { s.dialog = null; if (d.then) s.send(d.then); }
  s.engine.audio.sfx('click');
  return true;
}

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

const AFRAC = (a = 'top-left') => ({ x: a.includes('left') ? 0 : a.includes('right') ? 1 : 0.5, y: a.startsWith('top') ? 0 : a.startsWith('bottom') ? 1 : 0.5 });
/** Screen point a UI element is positioned from: its anchor on the screen, or inside its parent UI element's box. */
export function uiOrigin(e, W, H, safe) {
  const p = e.parentEnt;
  if (p && p.ui && !p.dead) { const r = uiBox(p, W, H, safe), f = AFRAC(e.anchor); return { x: r.x - r.w / 2 + f.x * r.w, y: r.y - r.h / 2 + f.y * r.h }; }
  return anchorPoint(e.anchor, W, H, safe);
}
/** Screen box of a UI element: centre x/y, width, height. */
export function uiBox(e, W, H, safe) {
  const o = uiOrigin(e, W, H, safe), ex = e.extents(), hw = ex.sphere ? ex.r : ex.hx, hh = ex.sphere ? ex.r : ex.hy;
  return { x: o.x + e.x + (ex.ox || 0), y: o.y + e.y + (ex.oy || 0), w: hw * 2, h: hh * 2 };
}
export function anchorPoint(anchor, W, H, safe) {
  const a = anchor || 'top-left';
  const x = a.includes('left') ? safe.left : a.includes('right') ? W - safe.right : W / 2;
  const y = a.startsWith('top') ? safe.top : a.startsWith('bottom') ? H - safe.bottom : H / 2;
  return { x, y };
}

/** UI stretch (like Unity's stretch anchors): fill the screen width and/or height minus a margin. */
function applyStretch(e, W, H, safe) {
  const m = +e.margin || 0, ao = uiOrigin(e, W, H, safe), p = e.parentEnt?.ui ? uiBox(e.parentEnt, W, H, safe) : null;
  const box = p ? { l: p.x - p.w / 2, t: p.y - p.h / 2, w: p.w, h: p.h } : { l: safe.left, t: safe.top, w: W - safe.left - safe.right, h: H - safe.top - safe.bottom };
  const set = (k, v) => { for (const c of [e.shape, e.sprite, e.bar, e.minimap]) if (c) c[k] = v; };
  if (e.stretch === 'width' || e.stretch === 'both') { set('w', Math.max(4, box.w - m * 2)); e.x = box.l + box.w / 2 - ao.x; }
  if (e.stretch === 'height' || e.stretch === 'both') { set('h', Math.max(4, box.h - m * 2)); e.y = box.t + box.h / 2 - ao.y; }
}
/** Minimap: a small overview of the level around the player (or the whole view in 2D). */
function drawMinimap(ctx, e, s) {
  const M = e.minimap, w = M.w * e.sx, h = M.h * e.sy, three = s.mode === '3d';
  const center = s.findAll(M.follow || 'player')[0] || { x: three ? s.camera.target.x : s.camera.x, y: three ? s.camera.target.z : s.camera.y, z: 0 };
  const cx = center.x, cy = three ? center.z : center.y, range = +M.range || 800, k = Math.min(w, h) / range;
  ctx.save();
  ctx.beginPath(); if (M.round) ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); else if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 10); else ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = M.bg; ctx.fill(); ctx.save(); ctx.clip();
  for (const q of s.entities) {
    if (q.ui || q.dead || !q.visible || q.minimap || q.template) continue;
    const px = (q.x - cx) * k, py = ((three ? q.z : q.y) - cy) * k;
    if (Math.abs(px) > w / 2 + 6 || Math.abs(py) > h / 2 + 6) continue;
    const isP = q.has('player'), isE = q.has('enemy');
    const ex = q.extents(), sw = Math.max(isP || isE ? 6 : 2, (ex.sphere ? ex.r * 2 : (ex.bx ?? ex.hx) * 2) * k), sh = Math.max(isP || isE ? 6 : 2, (ex.sphere ? ex.r * 2 : three ? ex.hz * 2 : (ex.by ?? ex.hy) * 2) * k);
    ctx.fillStyle = isP ? (M.playerColor || '#4fc3f7') : isE ? (M.enemyColor || '#ff5252') : q.body?.type === 'static' ? 'rgba(255,255,255,0.55)' : q.getBehavior?.('collectible') ? '#ffd54f' : 'rgba(255,255,255,0.25)';
    if (isP || isE) { ctx.beginPath(); ctx.arc(px, py, Math.max(sw, sh) / 2, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(px - sw / 2, py - sh / 2, Math.min(sw, w), Math.min(sh, h));
  }
  ctx.restore();
  ctx.strokeStyle = M.border; ctx.lineWidth = 2; ctx.beginPath(); if (M.round) ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2); else if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 10); else ctx.rect(-w / 2, -h / 2, w, h); ctx.stroke();
  ctx.restore();
}
/** Screen rectangle of a UI element: { x, y (center), w, h }. */
function uiRect(s, e) { const eng = s.engine; return uiBox(e, eng.width, eng.height, eng.safe); }

/** Does the game have its own UI for this screen (title, paused, over, win)? Then the built-in one steps aside. */
function ownScreen(scene, screen) {
  if (scene.settings.customScreens) return true;
  return scene.entities.some((e) => e.ui && !e.dead && e.visible && e.showWhen === screen);
}

function renderUI(engine, scene) {
  const ctx = engine.uiCtx, W = engine.width, H = engine.height, inp = engine.input;
  ctx.setTransform(engine.dpr, 0, 0, engine.dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!scene) return;
  engine.onBeforeUI?.(ctx, scene);
  if (!engine.editing || engine.showUI) {
    const screen = engine.paused ? 'paused' : scene.state, V = engine.editing && engine.uiView;
    if (V) { ctx.save(); ctx.translate(W / 2 + V.x, H / 2 + V.y); ctx.scale(V.z, V.z); ctx.translate(-W / 2, -H / 2); } // the editor's UI zoom
    for (const e of scene.entities) {
      if (!e.ui || !e.visible || e.dead || e._parentHidden) continue;
      if (!engine.editing && e.showWhen !== 'always' && e.showWhen !== screen) continue;
      if (engine.editing && engine.screenFilter && !['always', 'play'].includes(e.showWhen) && !engine.screenFilter(e)) continue; // menus for other screens stay out of the way
      if (e.stretch && e.stretch !== 'none') applyStretch(e, W, H, engine.safe);
      const o = uiOrigin(e, W, H, engine.safe);
      ctx.save(); ctx.translate(o.x, o.y); drawEntity2D(ctx, e, scene.vars, scene.time);
      if (e.minimap) { ctx.translate(e.x, e.y); drawMinimap(ctx, e, scene); }
      ctx.restore();
    }
    if (V) ctx.restore();
  }
  if (engine.editing) return;
  for (const f of scene.overlays || []) f(ctx, scene); // components that draw on screen (aim lines, hold rings)
  if (scene.popups?.length) { // floating "+10" texts
    const now = scene.time;
    scene.popups = scene.popups.filter((q) => now - q.t < q.life);
    for (const q of scene.popups) {
      const k = (now - q.t) / q.life;
      ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.font = `900 ${Math.round(q.size * (k < 0.15 ? 0.7 + k * 2 : 1))}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.fillStyle = q.color;
      const y = q.y - k * q.rise; ctx.strokeText(q.text, q.x, y); ctx.fillText(q.text, q.x, y);
    }
    ctx.globalAlpha = 1;
  }

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
      if (b.hidden) continue; // UI Touch Buttons draw themselves
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
  if (scene.dialog) drawDialog(ctx, scene, W, H, engine);
  if (scene.rotateNeeded) {
    dim(0.9);
    big('⟳', H * 0.4, 64);
    big(`Turn your device to ${scene.settings.orientation}`, H * 0.52, 18);
    return;
  }
  if (scene.settings.customScreens) return; // the game draws its own title / pause / end screens with UI elements
  if (ownScreen(scene, engine.paused ? 'paused' : scene.state) || (engine.paused && engine.inspecting)) return; // the editor's Inspect keeps the view clear
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
/** Actions shared by Trigger, Timer, Condition, Button, Rules and Tween ("when finished"). */
export const ACTIONS = ['message', 'add score', 'add to variable', 'set variable', 'spawn template', 'destroy object', 'destroy other', 'show object', 'hide object', 'toggle object',
  'play sound', 'vibrate', 'camera shake', 'jump', 'move by', 'win', 'game over', 'next level', 'start game', 'restart game', 'pause game', 'resume game',
  'save game', 'load game', 'delete save', 'switch camera', 'push', 'set gravity', 'toggle light', 'send message', 'play animation'];
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
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
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

/** Camera (Cinemachine-style virtual camera): put it on a camera object. The highest-priority (or switched-to) camera drives the view and blends smoothly from the last one. */
registerBehavior('camera', {
  label: 'Camera', description: 'A virtual camera: follow, fixed, side scroller, top down, orbit (drag), group (frames several targets) or dolly track. Smoothing, look-ahead, dead zone, screen offset, handheld noise, bounds, blends between cameras, orthographic 3D.',
  params: [
    { key: 'mode', label: 'Mode', type: 'select', options: ['follow', 'fixed', 'side scroller', 'top down', 'orbit', 'group', 'dolly'], default: 'follow' },
    { key: 'target', label: 'Follow tag', type: 'text', default: 'player', suggest: 'tags', info: { group: 'Frames every object with this tag.', fixed: 'Fixed cameras look at this tag (3D). Leave empty to look straight ahead.' } },
    { key: 'lookAt', label: 'Look at tag (3D, empty = same)', type: 'text', default: '', suggest: 'tags', only3d: true, showIf: { mode: ['follow', 'dolly', 'side scroller'] } },
    { key: 'smooth', label: 'Damping (higher = snappier)', type: 'number', default: 6, range: [0.5, 30], step: 0.5 },
    { key: 'zoom', label: 'Zoom (2D)', type: 'number', default: 1, range: [0.2, 4], step: 0.05, only2d: true },
    { key: 'fov', label: 'Field of view (3D)', type: 'number', default: 60, range: [10, 120], step: 1, only3d: true, showIf: (b) => !b.ortho },
    { key: 'ortho', label: 'Orthographic (3D, no perspective)', type: 'bool', default: false, only3d: true },
    { key: 'orthoSize', label: 'Ortho view height', type: 'number', default: 14, only3d: true, showIf: (b) => !!b.ortho },
    { key: 'ox', label: 'Offset X', type: 'number', default: 0, showIf: { mode: ['follow', 'side scroller', 'orbit', 'group'] } },
    { key: 'oy', label: 'Offset Y', type: 'number', default: 0, default3d: 7, showIf: { mode: ['follow', 'side scroller', 'orbit', 'group', 'top down'] } },
    { key: 'oz', label: 'Offset Z (3D)', type: 'number', default: 0, default3d: 11, only3d: true, showIf: { mode: ['follow', 'side scroller', 'orbit', 'group'] } },
    { key: 'path', label: 'Dolly track points (world)', type: 'json', default: [{ x: 0, y: 350 }, { x: 800, y: 350 }], default3d: [{ x: -10, y: 4, z: 10 }, { x: 10, y: 4, z: 10 }], showIf: { mode: ['dolly'] } },
    { key: 'padding', label: 'Group padding', type: 'number', default: 80, default3d: 3, showIf: { mode: ['group'] } },
    { key: 'screenX', label: 'Screen X (-0.5 left … 0.5 right)', type: 'number', default: 0, range: [-0.5, 0.5], step: 0.05, group: 'Framing' },
    { key: 'screenY', label: 'Screen Y (-0.5 top … 0.5 bottom)', type: 'number', default: 0, range: [-0.5, 0.5], step: 0.05, group: 'Framing' },
    { key: 'lookAhead', label: 'Look ahead (sec of movement)', type: 'number', default: 0, range: [0, 2], step: 0.05, group: 'Framing' },
    { key: 'deadZone', label: 'Dead zone (target moves freely inside)', type: 'number', default: 0, group: 'Framing' },
    { key: 'bounds', label: 'Keep inside (2D confiner)', type: 'select', options: ['none', 'level', 'custom'], default: 'none', only2d: true, group: 'Framing' },
    { key: 'minX', label: 'Bounds min X', type: 'number', default: 0, showIf: { bounds: ['custom'] }, group: 'Framing' },
    { key: 'maxX', label: 'Bounds max X', type: 'number', default: 400, showIf: { bounds: ['custom'] }, group: 'Framing' },
    { key: 'minY', label: 'Bounds min Y', type: 'number', default: 0, showIf: { bounds: ['custom'] }, group: 'Framing' },
    { key: 'maxY', label: 'Bounds max Y', type: 'number', default: 700, showIf: { bounds: ['custom'] }, group: 'Framing' },
    { key: 'noise', label: 'Handheld noise (shake amount)', type: 'number', default: 0, range: [0, 20], step: 0.5, group: 'Noise & blend' },
    { key: 'noiseSpeed', label: 'Noise speed', type: 'number', default: 1, range: [0.1, 5], step: 0.1, group: 'Noise & blend', showIf: (b) => +b.noise > 0 },
    { key: 'blend', label: 'Blend in from previous camera (sec)', type: 'number', default: 0.8, range: [0, 4], step: 0.1, group: 'Noise & blend' },
    { key: 'blendEase', label: 'Blend ease', type: 'select', options: EASES, default: 'inOutCubic', ease: true, group: 'Noise & blend' },
    { key: 'priority', label: 'Priority (highest starts active)', type: 'number', default: 0, step: 1, group: 'Noise & blend' },
  ],
  create(p) {
    let yaw = 0, pitch = 0.5, dist = 10, box = null, st = null;
    const levelBounds = (s) => {
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      for (const e of s.entities) {
        if (e.ui || e.dead || e.template || e.getBehavior('camera') || !(e.shape || e.sprite || e.text)) continue;
        const ex = e.extents(), hx = ex.sphere ? ex.r : ex.bx ?? ex.hx, hy = ex.sphere ? ex.r : ex.by ?? ex.hy;
        l = Math.min(l, e.x - hx); r = Math.max(r, e.x + hx); t = Math.min(t, e.y - hy); b = Math.max(b, e.y + hy);
      }
      return Number.isFinite(l) ? { l: Math.min(l, 0), r: Math.max(r, s.view.width), t: Math.min(t, 0), b: Math.max(b, s.view.height) } : null;
    };
    const closestOnPath = (pts, q) => {
      let best = null, bd = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], ab = [b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0)], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
        const u = clamp(((q.x - a.x) * ab[0] + (q.y - a.y) * ab[1] + ((q.z || 0) - (a.z || 0)) * ab[2]) / l2, 0, 1);
        const c = { x: a.x + ab[0] * u, y: a.y + ab[1] * u, z: (a.z || 0) + ab[2] * u }, d = Math.hypot(c.x - q.x, c.y - q.y, c.z - (q.z || 0));
        if (d < bd) { bd = d; best = c; }
      }
      return best || pts[0];
    };
    const group = (s, e) => {
      const list = s.findAll(p.target).filter((q) => q !== e);
      if (!list.length) return null;
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity, n = Infinity, f = -Infinity;
      for (const q of list) { l = Math.min(l, q.x); r = Math.max(r, q.x); t = Math.min(t, q.y); b = Math.max(b, q.y); n = Math.min(n, q.z); f = Math.max(f, q.z); }
      return { x: (l + r) / 2, y: (t + b) / 2, z: (n + f) / 2, w: r - l, h: b - t, d: f - n, vel: { x: 0, y: 0, z: 0 } };
    };
    const noise = (s, k) => { const tt = s.time * (+p.noiseSpeed || 1), a = +p.noise || 0; return a ? [Math.sin(tt * 2.1 + k) * 0.6 + Math.sin(tt * 5.3 + k * 2) * 0.4, Math.sin(tt * 1.7 + k + 3) * 0.6 + Math.sin(tt * 4.1 + k) * 0.4, Math.sin(tt * 2.9 + k + 5) * 0.5].map((v) => v * a) : [0, 0, 0]; };
    /** Where this camera wants to be right now. */
    const desired = (e, s, cur) => {
      const three = is3D(e), tgt = p.mode === 'fixed' ? null : p.mode === 'group' ? group(s, e) : p.target ? s.findAll(p.target).find((q) => q !== e) : null;
      const vel = tgt?.vel || tgt?.body?.vel || { x: 0, y: 0, z: 0 }, la = +p.lookAhead || 0, dz = +p.deadZone || 0;
      if (!three) {
        let zoom = +p.zoom || 1, fx = e.x, fy = e.y;
        if (tgt) {
          fx = tgt.x + p.ox + vel.x * la; fy = p.mode === 'side scroller' ? e.y : tgt.y + p.oy + (p.mode === 'top down' ? vel.y * la : 0);
          if (p.mode === 'group') zoom = clamp(Math.min(s.view.width / (tgt.w + 2 * p.padding), s.view.height / (tgt.h + 2 * p.padding)), 0.15, +p.zoom || 1);
          if (p.mode === 'dolly' && Array.isArray(p.path) && p.path.length > 1) { const c = closestOnPath(p.path, tgt); fx = c.x; fy = c.y; }
        }
        fx -= (+p.screenX || 0) * s.view.width / zoom; fy -= (+p.screenY || 0) * s.view.height / zoom;
        if (dz && tgt && cur) { const ax = fx - cur.x, ay = fy - cur.y; fx = Math.abs(ax) < dz ? cur.x : fx - Math.sign(ax) * dz; fy = Math.abs(ay) < dz ? cur.y : fy - Math.sign(ay) * dz; }
        return { x: fx, y: fy, zoom };
      }
      const lookTag = p.lookAt ? s.findAll(p.lookAt).find((q) => q !== e) : null;
      let pos, look;
      if (!tgt) {
        const ry = e.ry * DEG, rx = e.rx * DEG, ft = p.target ? s.findAll(p.target).find((q) => q !== e) : null;
        pos = [e.x, e.y, e.z];
        look = ft ? [ft.x, ft.y, ft.z] : [e.x - Math.sin(ry) * Math.cos(rx), e.y + Math.sin(rx), e.z - Math.cos(ry) * Math.cos(rx)];
      } else {
        let L = [tgt.x + vel.x * la, p.mode === 'side scroller' ? e.y : tgt.y, tgt.z + vel.z * la];
        if (dz && cur) for (const k of [0, 2]) { const d = L[k] - cur.look[k]; L[k] = Math.abs(d) < dz ? cur.look[k] : L[k] - Math.sign(d) * dz; }
        if (p.mode === 'orbit') {
          const inp = s.engine.input;
          if (inp.pointerDown && !inp.stick) { yaw -= inp.drag.dx * 0.008; pitch = clamp(pitch + inp.drag.dy * 0.006, -0.2, 1.45); }
          pos = [L[0] + Math.sin(yaw) * Math.cos(pitch) * dist, L[1] + Math.sin(pitch) * dist, L[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
        } else if (p.mode === 'top down') pos = [L[0], L[1] + (+p.oy || dist), L[2] + 0.001];
        else if (p.mode === 'dolly' && Array.isArray(p.path) && p.path.length > 1) { const c = closestOnPath(p.path, { x: L[0], y: L[1], z: L[2] }); pos = [c.x, c.y, c.z]; }
        else if (p.mode === 'group') {
          const off = [p.ox, p.oy, p.oz], ol = Math.hypot(...off) || 1, rad = Math.hypot(tgt.w, tgt.h, tgt.d) / 2 + (+p.padding || 0);
          const need = Math.max(ol, rad / Math.tan(((+p.fov || 60) * DEG) / 2));
          pos = off.map((o, k) => L[k] + o / ol * need);
        } else pos = [L[0] + p.ox, L[1] + p.oy, L[2] + p.oz];
        look = lookTag ? [lookTag.x, lookTag.y, lookTag.z] : L;
      }
      if (p.screenX || p.screenY) { // composer: put the target off-centre on screen
        const f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...f) || 1, r = [-f[2] / fl, 0, f[0] / fl], rl = Math.hypot(...r) || 1;
        const sx = -(+p.screenX || 0) * fl, sy = (+p.screenY || 0) * fl;
        for (const k of [0, 1, 2]) { const d = r[k] / rl * sx + (k === 1 ? sy : 0); look[k] += d; pos[k] += d; }
      }
      return { pos, look, fov: +p.fov || 60 };
    };
    return {
      start(e, s) {
        (s.cameras ||= []).push(e); e.data.camPriority = +p.priority || 0;
        if (is3D(e)) { dist = Math.hypot(p.ox, p.oy, p.oz) || 10; yaw = Math.atan2(p.ox, p.oz); pitch = Math.atan2(p.oy, Math.hypot(p.ox, p.oz)); }
        else if (p.bounds === 'level') box = levelBounds(s);
        else if (p.bounds === 'custom') box = { l: p.minX, r: p.maxX, t: p.minY, b: p.maxY };
      },
      update(e, dt, s) {
        if (!s.isActiveCamera(e)) { st = null; return; }
        const c = s.camera, three = is3D(e);
        if (s.activeCamEntity !== e) { // just became active: cut, or blend from wherever the view is now
          const had = !!s.activeCamEntity && !s.activeCamEntity.dead;
          s.activeCamEntity = e; st = null;
          s.camBlend = had && +p.blend > 0 ? { t: 0, dur: +p.blend, ease: easeFn(p.blendEase), from: three ? { pos: [c.position.x, c.position.y, c.position.z], look: [c.target.x, c.target.y, c.target.z], fov: c.fov } : { x: c.x, y: c.y, zoom: c.zoom } } : null;
        }
        if (s.cameraCut) { st = null; s.cameraCut = false; }
        const want = desired(e, s, st), k = !st ? 1 : 1 - Math.exp(-(+p.smooth || 6) * dt);
        if (!st) st = JSON.parse(JSON.stringify(want));
        const nz = noise(s, e.id.length);
        let out;
        if (!three) {
          st.x += (want.x - st.x) * k; st.y += (want.y - st.y) * k; st.zoom += (want.zoom - st.zoom) * k;
          out = { x: st.x + nz[0], y: st.y + nz[1], zoom: st.zoom };
          if (box && s.engine) {
            const zf = s.engine.renderer.zoomFor ? s.engine.renderer.zoomFor({ ...s, camera: { zoom: out.zoom } }) : out.zoom, hw = s.engine.width / 2 / zf, hh = s.engine.height / 2 / zf;
            out.x = box.r - box.l > hw * 2 ? clamp(out.x, box.l + hw, box.r - hw) : (box.l + box.r) / 2;
            out.y = box.b - box.t > hh * 2 ? clamp(out.y, box.t + hh, box.b - hh) : (box.t + box.b) / 2;
          }
        } else {
          for (const q of [0, 1, 2]) { st.pos[q] += (want.pos[q] - st.pos[q]) * k; st.look[q] += (want.look[q] - st.look[q]) * k; }
          st.fov += (want.fov - st.fov) * k;
          out = { pos: st.pos.map((v, q) => v + nz[q] * 0.05), look: st.look.map((v, q) => v + nz[q] * 0.02), fov: st.fov };
        }
        const B = s.camBlend;
        if (B) {
          B.t += dt; const u = B.ease(clamp(B.t / B.dur, 0, 1));
          if (!three) out = { x: lerp(B.from.x, out.x, u), y: lerp(B.from.y, out.y, u), zoom: lerp(B.from.zoom, out.zoom, u) };
          else out = { pos: out.pos.map((v, q) => lerp(B.from.pos[q], v, u)), look: out.look.map((v, q) => lerp(B.from.look[q], v, u)), fov: lerp(B.from.fov, out.fov, u) };
          if (B.t >= B.dur) s.camBlend = null;
        }
        if (!three) { c.x = out.x; c.y = out.y; c.zoom = out.zoom; }
        else {
          c.position = { x: out.pos[0], y: out.pos[1], z: out.pos[2] }; c.target = { x: out.look[0], y: out.look[1], z: out.look[2] }; c.fov = out.fov;
          c.ortho = !!p.ortho; c.orthoSize = +p.orthoSize || 14;
        }
      },
      destroy(e, s) { s.cameras = (s.cameras || []).filter((q) => q !== e); },
    };
  },
});

// ---- animation components ----
const VEC_FX = ['move to', 'move by', 'jump to', 'punch position'];
/** Tween (DOTween Animation): animate this object with easing and loops, no code needed. */
registerBehavior('tween', {
  label: 'Tween', description: 'Animate this object with no code: move, rotate, scale, fade, color, punch, shake, follow a path or jump, with easing, loops and delays.',
  params: [
    { key: 'effect', label: 'Effect', type: 'select', options: ['move by', 'move to', 'rotate by', 'scale to', 'fade to', 'color to', 'punch scale', 'punch position', 'shake position', 'shake rotation', 'path', 'jump to'], default: 'move by' },
    { key: 'x', label: 'X', type: 'number', default: 0, showIf: { effect: VEC_FX } },
    { key: 'y', label: 'Y', type: 'number', default: -40, default3d: 1, showIf: { effect: VEC_FX } },
    { key: 'z', label: 'Z (3D)', type: 'number', default: 0, showIf: { effect: VEC_FX }, only3d: true },
    { key: 'angle', label: 'Degrees', type: 'number', default: 360, showIf: { effect: ['rotate by'] } },
    { key: 'amount', label: 'Amount', type: 'number', default: 0.3, showIf: { effect: ['scale to', 'fade to', 'punch scale', 'shake position', 'shake rotation'] }, info: { 'scale to': 'Final size (1 = normal).', 'fade to': 'Final opacity: 0 = invisible, 1 = solid.', 'punch scale': 'How much bigger it pops (0.3 = 30%).', 'shake position': 'How far it jitters.', 'shake rotation': 'How many degrees it wobbles.' } },
    { key: 'color', label: 'Color', type: 'color', default: '#ff5252', showIf: { effect: ['color to'] } },
    { key: 'points', label: 'Path points (relative)', type: 'json', default: [{ x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }], default3d: [{ x: 3, y: 0, z: 0 }, { x: 3, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }], showIf: { effect: ['path'] } },
    { key: 'orient', label: 'Face the way it moves', type: 'bool', default: false, showIf: { effect: ['path'] } },
    { key: 'height', label: 'Jump height', type: 'number', default: 80, default3d: 2, showIf: { effect: ['jump to'] } },
    { key: 'duration', label: 'Duration (sec)', type: 'number', default: 1, range: [0.05, 10], step: 0.05 },
    { key: 'ease', label: 'Ease', type: 'select', options: EASES, default: 'inOutSine', ease: true },
    { key: 'loops', label: 'Loops (-1 = forever)', type: 'number', default: -1, range: [-1, 20], step: 1 },
    { key: 'loopType', label: 'Loop type', type: 'select', options: ['yoyo', 'restart', 'incremental'], default: 'yoyo', showIf: (b) => +b.loops !== 0 },
    { key: 'delay', label: 'Delay (sec)', type: 'number', default: 0, range: [0, 10], step: 0.05, group: 'Timing & trigger' },
    { key: 'playOn', label: 'Play on', type: 'select', options: ['start', 'tap', 'touched by tag', 'message', 'never'], default: 'start', group: 'Timing & trigger' },
    { key: 'tag', label: 'Touched by tag', type: 'text', default: 'player', suggest: 'tags', showIf: { playOn: ['touched by tag'] }, group: 'Timing & trigger' },
    { key: 'message', label: 'Message name', type: 'text', default: 'go', suggest: 'messages', showIf: { playOn: ['message'] }, group: 'Timing & trigger' },
    { key: 'thenDo', label: 'When finished, do', type: 'select', options: ['nothing', ...ACTIONS], default: 'nothing', group: 'When finished', showIf: (b) => +b.loops >= 0 },
    { key: 'thenValue', label: 'Message / variable / object', type: 'text', default: '', group: 'When finished', showIf: (b) => b.thenDo && b.thenDo !== 'nothing' && +b.loops >= 0 },
  ],
  create(p) {
    let tw = null;
    const play = (e, s) => {
      tw?.kill();
      const o = { ease: p.ease, loops: +p.loops, loopType: p.loopType, delay: +p.delay || 0 }, d = Math.max(0.01, +p.duration || 1), three = is3D(e);
      const vec = { x: +p.x || 0, y: +p.y || 0, ...(three ? { z: +p.z || 0 } : {}) };
      switch (p.effect) {
        case 'move to': tw = s.to(e, vec, d, o); break;
        case 'move by': tw = s.to(e, vec, d, { ...o, relative: true }); break;
        case 'rotate by': tw = s.to(e, three ? { ry: +p.angle || 0 } : { rz: +p.angle || 0 }, d, { ...o, relative: true }); break;
        case 'scale to': tw = s.to(e, { scale: +p.amount || 1 }, d, o); break;
        case 'fade to': tw = s.to(e, { alpha: clamp(+p.amount, 0, 1) }, d, o); break;
        case 'color to': tw = s.to(e, e.mesh ? { 'mesh.color': p.color } : e.text && !e.shape ? { 'text.color': p.color } : { 'shape.fill': p.color }, d, o); break;
        case 'punch scale': { const a = +p.amount || 0.3; tw = s.punch(e, three ? { sx: a, sy: a, sz: a } : { sx: a, sy: a }, d, { add: true }); tw.setLoops(+p.loops, 'restart'); tw.delay = o.delay; break; }
        case 'punch position': tw = s.punch(e, vec, d, { add: true }); tw.setLoops(+p.loops, 'restart'); tw.delay = o.delay; break;
        case 'shake position': { const a = +p.amount || 10; tw = s.shakeProps(e, three ? { x: a, y: a, z: a } : { x: a, y: a }, d); tw.setLoops(+p.loops, 'restart'); tw.delay = o.delay; break; }
        case 'shake rotation': { const a = +p.amount || 15; tw = s.shakeProps(e, three ? { ry: a } : { rz: a }, d); tw.setLoops(+p.loops, 'restart'); tw.delay = o.delay; break; }
        case 'path': { const pts = (Array.isArray(p.points) ? p.points : []).map((q) => ({ x: e.x + (+q.x || 0), y: e.y + (+q.y || 0), z: e.z + (+q.z || 0) })); if (pts.length) tw = s.path(e, pts, d, { ...o, orient: p.orient }); break; }
        case 'jump to': tw = s.jumpTo(e, { x: e.x + vec.x, y: e.y + vec.y, z: e.z + (vec.z || 0) }, +p.height || 0, 1, d, { ease: p.ease, delay: o.delay }); tw.setLoops(+p.loops, p.loopType); break;
        default: break;
      }
      if (tw && p.thenDo && p.thenDo !== 'nothing') tw.onComplete(() => runAction(s, e, { action: p.thenDo, value: p.thenValue, amount: 1 }));
    };
    let off = null;
    return {
      play, uiAlways: true,
      start(e, s) {
        if (p.playOn === 'start') play(e, s);
        if (p.playOn === 'touched by tag') { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); }
        if (p.playOn === 'message') s.on('message', off = (name) => { if (name === p.message && !e.dead) play(e, s); });
      },
      update(e, dt, s) { if (p.playOn === 'tap' && e.visible && s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) play(e, s); },
      collide(e, other, s) { if (p.playOn === 'touched by tag' && other.has(p.tag)) play(e, s); },
      destroy() { tw?.kill(); },
    };
  },
});

/** Sprite Animation (flipbook): cycle through emoji or image frames. */
registerBehavior('flipbook', {
  label: 'Sprite Animation', description: 'Flip through frames like a cartoon: emoji (🐱,😺,😸) or image links, at a speed you choose. Can play only while moving.',
  params: [
    { key: 'frames', label: 'Frames (comma separated)', type: 'text', default: '🐥,🐤,🐣,🐤' },
    { key: 'fps', label: 'Frames per second', type: 'number', default: 6, range: [1, 30], step: 1 },
    { key: 'mode', label: 'Play mode', type: 'select', options: ['loop', 'ping-pong', 'once'], default: 'loop' },
    { key: 'when', label: 'Play', type: 'select', options: ['always', 'while moving', 'on message'], default: 'always' },
    { key: 'message', label: 'Message name', type: 'text', default: 'go', suggest: 'messages', showIf: { when: ['on message'] } },
  ],
  create(p) {
    const frames = String(p.frames || '').split(',').map((f) => f.trim()).filter(Boolean);
    let t = 0, px = null, py = null, active = p.when === 'always';
    const show = (e, f) => {
      if (/^(https?:|data:|blob:|\.?\/)/.test(f)) { e.sprite ||= { ...SPRITE_DEFAULTS }; e.sprite.src = f; }
      else { e.shape ||= { ...SHAPE_DEFAULTS, type: 'emoji', w: 56, h: 56, fill: '' }; e.shape.type = 'emoji'; e.shape.emoji = f; }
    };
    return {
      uiAlways: true,
      start(e, s) { if (frames.length) show(e, frames[0]); if (p.when === 'on message') s.on('message', (n) => { if (n === p.message) { active = true; t = 0; } }); },
      update(e, dt) {
        if (!frames.length) return;
        if (p.when === 'while moving') { const moved = px !== null && Math.hypot(e.x - px, e.y - py) > 0.01; px = e.x; py = e.y; if (!moved) { show(e, frames[0]); t = 0; return; } }
        else if (!active) return;
        t += dt * (+p.fps || 6);
        const n = frames.length; let i = Math.floor(t);
        if (p.mode === 'once') { if (i >= n) { i = n - 1; if (p.when === 'on message') active = false; } }
        else if (p.mode === 'ping-pong' && n > 1) { const c = (n - 1) * 2; i %= c; if (i >= n) i = c - i; }
        else i %= n;
        show(e, frames[i]);
      },
    };
  },
});

/** Sample a keyframe track [[time, value, ease?], ...] at a time. */
export function sampleTrack(tr, time) {
  if (!tr?.length) return null;
  if (time <= tr[0][0]) return tr[0][1];
  for (let i = 0; i < tr.length - 1; i++) {
    const a = tr[i], b = tr[i + 1];
    if (time < b[0]) { const k = (time - a[0]) / ((b[0] - a[0]) || 1); return a[1] + (b[1] - a[1]) * easeFn(a[2] || 'linear')(k); }
  }
  return tr[tr.length - 1][1];
}
export const ANIM_PROPS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'sx', 'sy', 'sz', 'alpha'];
export const ANIM_MULT = new Set(['sx', 'sy', 'sz', 'alpha']); // these tracks multiply; the rest add on top of where the object is
/** Animator: keyframe animation clips (made in the editor's Animation timeline). */
registerBehavior('animator', {
  label: 'Animator', description: 'Keyframe animation clips you record in the Animation timeline: wave, bounce, walk cycles, doors opening… Play them from Visual Scripts, buttons or messages.',
  params: [
    { key: 'clips', label: 'Clips', type: 'clips', default: [{ name: 'Bounce', length: 1, loop: 'loop', tracks: { y: [[0, 0, 'outQuad'], [0.5, -30, 'inQuad'], [1, 0]], sy: [[0, 1, 'outQuad'], [0.5, 1.12, 'inQuad'], [1, 1]] } }],
      default3d: [{ name: 'Bounce', length: 1, loop: 'loop', tracks: { y: [[0, 0, 'outQuad'], [0.5, 1, 'inQuad'], [1, 0]], ry: [[0, 0], [1, 360]] } }] },
    { key: 'autoplay', label: 'Play on start', type: 'text', default: 'Bounce', suggest: 'clips' },
    { key: 'speed', label: 'Speed', type: 'number', default: 1, range: [0, 4], step: 0.1 },
    { key: 'idleClip', label: 'Auto: clip when standing still', type: 'text', default: '', suggest: 'clips', group: 'Auto states', info: 'Fill these and it switches clips by itself, like Unity\'s Animator: idle, moving, in the air.' },
    { key: 'moveClip', label: 'Auto: clip when moving', type: 'text', default: '', suggest: 'clips', group: 'Auto states' },
    { key: 'airClip', label: 'Auto: clip in the air', type: 'text', default: '', suggest: 'clips', group: 'Auto states' },
  ],
  create(p) {
    let clip = null, t = 0, dir = 1, playing = false, last = {}, rate = 1, px = null, py = null, pz = null, mode = 'once', manual = false;
    const clips = Array.isArray(p.clips) ? p.clips : [];
    const inst = {
      uiAlways: true,
      play(name, loop, auto = false) { // loop: undefined = the clip's own setting, true / false to override
        const e = inst.entity;
        if (e && clip) inst.apply(e, true); // undo the current clip's offsets
        clip = clips.find((c) => c.name === name) || null; t = 0; dir = 1; playing = !!clip; last = {};
        mode = loop === undefined ? clip?.loop : loop ? 'loop' : 'once'; manual = !auto;
        return !!clip;
      },
      stop() { const e = inst.entity; if (e && clip) inst.apply(e, true); playing = false; clip = null; },
      setSpeed(k) { rate = +k || 0; },
      get current() { return playing ? clip?.name : ''; },
      apply(e, reset = false) {
        for (const [prop, tr] of Object.entries(clip.tracks || {})) {
          if (!ANIM_PROPS.includes(prop) || !tr.length) continue;
          const v = reset ? (ANIM_MULT.has(prop) ? 1 : 0) : sampleTrack(tr, t), prev = last[prop] ?? (ANIM_MULT.has(prop) ? 1 : 0);
          if (ANIM_MULT.has(prop)) e[prop] = prev ? e[prop] / prev * v : v; else e[prop] += v - prev;
          last[prop] = v;
        }
      },
      start(e, s) {
        inst.entity = e;
        if (p.autoplay) inst.play(p.autoplay);
        s.on('message', (n) => { if (!e.dead && clips.some((c) => c.name === n)) inst.play(n); });
      },
      update(e, dt, s) {
        if ((p.idleClip || p.moveClip || p.airClip) && !(manual && playing && mode !== 'loop')) { // auto states (a one-shot clip played by a node finishes first)
          const moved = px !== null && Math.hypot(e.x - px, e.y - py, e.z - pz) > 0.5 * dt * (s.mode === '3d' ? 1 : 30); px = e.x; py = e.y; pz = e.z;
          const want = e.body && !e.body.grounded && (s.gravity || 0) !== 0 && e.body.gravityScale !== 0 && p.airClip ? p.airClip : moved && p.moveClip ? p.moveClip : p.idleClip;
          if (want && (clip?.name !== want || !playing)) inst.play(want, undefined, true);
        }
        if (!playing || !clip) return;
        const L = Math.max(0.01, +clip.length || 1);
        t += dt * (+p.speed || 0) * rate * dir;
        if (t >= L || t < 0) {
          if (mode === 'loop') t = ((t % L) + L) % L;
          else if (mode === 'ping-pong') { dir = -dir; t = clamp(t, 0, L); }
          else { t = L; inst.apply(e); playing = false; s.emit('animationEnd', e, clip.name); return; }
        }
        inst.apply(e);
      },
    };
    return inst;
  },
});

/** Play a clip on whichever animator the object has (keyframe Animator or Sprite Sheet). */
export function playClip(e, name, loop) {
  for (const t of ['animator', 'spriteSheet']) { const a = e?.getBehavior(t); if (a?.play(name, loop)) return true; }
  return false;
}
/** Sprite sheet animation: one image cut into a grid of frames, played as named clips. */
export function parseSheetClips(text) {
  const out = {};
  for (const part of String(text || '').split(',')) {
    const m = part.match(/^\s*([^:]+?)\s*:\s*(\d+)\s*(?:-\s*(\d+))?\s*$/); if (!m) continue;
    const a = +m[2], b = m[3] != null ? +m[3] : a; out[m[1]] = a <= b ? [a, b] : [b, a];
  }
  return out;
}
registerBehavior('spriteSheet', {
  label: 'Sprite Sheet Animator', description: 'Animate with a sprite sheet: one picture cut into a grid of frames. Name clips by frame range (idle: 0-3, run: 4-9) and it can switch idle / run / jump by itself.',
  params: [
    { key: 'image', label: 'Sprite sheet', type: 'image', default: '' },
    { key: 'cols', label: 'Columns', type: 'number', default: 4, step: 1, range: [1, 32] },
    { key: 'rows', label: 'Rows', type: 'number', default: 1, step: 1, range: [1, 32] },
    { key: 'size', label: 'Size on screen', type: 'number', default: 64, step: 4 },
    { key: 'fps', label: 'Frames per second', type: 'number', default: 8, step: 1, range: [1, 30] },
    { key: 'clips', label: 'Clips (name: first-last, …)', type: 'text', default: 'idle: 0-3', info: 'Frames count from 0, left to right, then the next row. e.g. idle: 0-3, run: 4-9, jump: 10-11' },
    { key: 'autoplay', label: 'Play on start', type: 'text', default: 'idle' },
    { key: 'auto', label: 'Switch idle / run / jump by itself', type: 'bool', default: false },
    { key: 'runClip', label: 'Run clip', type: 'text', default: 'run', showIf: { auto: [true] } },
    { key: 'jumpClip', label: 'Jump clip', type: 'text', default: 'jump', showIf: { auto: [true] } },
    { key: 'flip', label: 'Face the way it moves (2D)', type: 'bool', default: true },
  ],
  create(p) {
    const clips = parseSheetClips(p.clips); let cur = null, t = 0, playing = false, once = false, rate = 1, px = null, py = null, manual = false;
    const inst = {
      uiAlways: true,
      play(name, loop, auto = false) { loop ??= true; if (!clips[name]) return false; if (cur !== name) t = 0; cur = name; playing = true; once = !loop; manual = !auto; return true; },
      stop() { playing = false; },
      setSpeed(k) { rate = +k || 0; },
      get current() { return playing ? cur : ''; },
      start(e, s) {
        inst.entity = e;
        e.sprite = { ...SPRITE_DEFAULTS, ...(e.sprite || {}), src: p.image || e.sprite?.src || '', w: p.size, h: p.size, cols: p.cols, rows: p.rows, frame: 0 };
        if (p.image) { const img = loadImage(p.image); const fit = () => { if (img.naturalWidth) e.sprite.h = p.size * (img.naturalHeight / p.rows) / (img.naturalWidth / p.cols); }; if (img.complete) fit(); else img.addEventListener('load', fit, { once: true }); }
        if (p.autoplay) inst.play(p.autoplay);
        s.on('message', (n) => { if (!e.dead && clips[n]) inst.play(n); });
      },
      update(e, dt, s) {
        if (!e.sprite) return;
        const dx = px === null ? 0 : e.x - px, moved = px !== null && Math.hypot(dx, e.y - py) > 15 * dt; px = e.x; py = e.y;
        if (p.flip && Math.abs(dx) > 0.5 * dt) e.sprite.flip = dx < 0;
        if (p.auto && !(manual && playing && once)) { // a clip played once by a node/trigger finishes first
          const air = e.body && !e.body.grounded && (s.gravity || 0) !== 0 && e.body.gravityScale !== 0;
          const want = air && clips[p.jumpClip] ? p.jumpClip : moved && clips[p.runClip] ? p.runClip : p.autoplay;
          if (want && (want !== cur || !playing)) inst.play(want, true, true);
        }
        if (!playing || !clips[cur]) return;
        const [a, b] = clips[cur], n = b - a + 1;
        t += dt * p.fps * rate;
        if (t >= n) { if (once) { t = n - 1e-6; playing = false; s.emit('animationEnd', e, cur); } else t %= n; }
        e.sprite.frame = a + Math.floor(t);
      },
    };
    return inst;
  },
});

registerBehavior('forceZone', {
  label: 'Force Zone', description: 'An area that pushes bodies inside it: wind, conveyor, water current, magnet (pull) or blast (push away).',
  params: [
    { key: 'mode', label: 'Force', type: 'select', options: ['direction', 'pull to center', 'push from center'], default: 'direction' },
    { key: 'fx', label: 'Direction X', type: 'number', default: 0 },
    { key: 'fy', label: 'Direction Y', type: 'number', default: -1, default3d: 1 },
    { key: 'fz', label: 'Direction Z (3D)', type: 'number', default: 0 },
    { key: 'strength', label: 'Strength', type: 'number', default: 1800, default3d: 40 },
    { key: 'tag', label: 'Only affects tag (empty = all)', type: 'text', default: '' },
    { key: 'hidden', label: 'Invisible while playing', type: 'bool', default: false },
  ],
  create(p) {
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); if (p.hidden) e.visible = false; if (p.tag) s.want(p.tag); },
      update(e, dt, s) {
        const ez = e.extents();
        const l = Math.hypot(p.fx, p.fy, p.fz) || 1;
        for (const o of s.entities) {
          const b = o.body;
          if (o === e || o.dead || !b || b.type !== 'dynamic' || (p.tag && !o.has(p.tag))) continue;
          if (!overlap(e, ez, o, o.extents())) continue;
          let fx, fy, fz;
          if (p.mode === 'direction') { fx = p.fx / l; fy = p.fy / l; fz = p.fz / l; }
          else { const dx = e.x - o.x, dy = e.y - o.y, dz = e.z - o.z, d = Math.hypot(dx, dy, dz) || 1, sg = p.mode === 'pull to center' ? 1 : -1; fx = sg * dx / d; fy = sg * dy / d; fz = sg * dz / d; }
          if (b.forceT !== s.time) { b.force = { x: 0, y: 0, z: 0 }; b.forceT = s.time; }
          b.force.x += fx * p.strength; b.force.y += fy * p.strength; b.force.z += fz * p.strength;
        }
      },
    };
  },
});

registerBehavior('savePoint', {
  label: 'Save Point', description: 'Saves the game when the player touches it (variables, level and what was collected). Load it with the Load Game action or Load on start.',
  params: [
    { key: 'slot', label: 'Save slot', type: 'number', default: 1 },
    { key: 'text', label: 'Message', type: 'text', default: 'Game saved' },
    { key: 'tag', label: 'Touched by tag', type: 'text', default: 'player' },
  ],
  create(p) {
    let cool = 0;
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      update(e, dt) { cool -= dt; },
      collide(e, other, s) {
        if (!other.has(p.tag) || cool > 0) return;
        cool = 2;
        if (s.saveGame(p.slot)) { if (p.text) s.message(p.text, 1.5); s.burst(e.x, e.y, e.z, '#7cf7a0', 14); s.engine.audio.sfx('power'); }
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
    { key: 'sound', label: 'Sound', type: 'select', options: SOUNDS, default: 'power' },
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
  if (e._parentHidden) return false;
  if (e.ui) {
    const o = uiOrigin(e, eng.width, eng.height, eng.safe), ex = e.extents();
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
  label: 'Breakable', description: 'Takes hits from objects with a tag (like bullets) and breaks when its hits run out. For full health with damage, healing and death actions use Health & Damage.',
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

// ---- UI components ----
/** Slider: drag along a bar to set a variable (volume, difficulty, size…). */
registerBehavior('uiSlider', {
  label: 'Slider', description: 'Drag along it to change a variable between a minimum and maximum. Put it on a Progress Bar. A slider for {volume} (0–100) controls the game’s sound.',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'volume', suggest: 'vars' },
    { key: 'min', label: 'Minimum', type: 'number', default: 0 },
    { key: 'max', label: 'Maximum', type: 'number', default: 100 },
    { key: 'step', label: 'Step (0 = smooth)', type: 'number', default: 1 },
    { key: 'start', label: 'Starting value', type: 'number', default: 80 },
  ],
  create(p) {
    let dragging = null;
    return {
      uiAlways: true,
      start(e, s) {
        if (s.vars[p.var] == null) s.setVar(p.var, +p.start);
        if (e.bar) { e.bar.var = p.var; e.bar.max = +p.max - +p.min || 1; if (+p.min) e.bar.var = p.var; }
      },
      update(e, dt, s) {
        if (!e.visible) return;
        const inp = s.engine.input, r = uiRect(s, e);
        if (!dragging) for (const d of inp.downs) if (Math.abs(d.x - r.x) < r.w / 2 + 12 && Math.abs(d.y - r.y) < Math.max(22, r.h / 2 + 10)) dragging = d.id;
        const ptr = dragging != null && inp.pointers.get(dragging);
        if (!ptr) { dragging = null; return; }
        let v = +p.min + clamp((ptr.x - (r.x - r.w / 2)) / (r.w || 1), 0, 1) * (+p.max - +p.min);
        if (+p.step > 0) v = Math.round(v / p.step) * p.step;
        if (v !== s.vars[p.var]) s.setVar(p.var, +v.toFixed(3));
      },
    };
  },
});

/** Toggle: tap to switch a variable between on (1) and off (0); changes its text and color. */
registerBehavior('uiToggle', {
  label: 'Toggle', description: 'A switch or checkbox: tap to turn a variable on (1) or off (0). Shows different text and color for each state (e.g. Sound: ON / OFF).',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'music', suggest: 'vars' },
    { key: 'start', label: 'Starts on', type: 'bool', default: true },
    { key: 'onText', label: 'Text when on', type: 'text', default: 'ON' },
    { key: 'offText', label: 'Text when off', type: 'text', default: 'OFF' },
    { key: 'onColor', label: 'Color when on', type: 'color', default: '#43a047' },
    { key: 'offColor', label: 'Color when off', type: 'color', default: '#616161' },
  ],
  create(p) {
    const show = (e, s) => { const on = !!+s.vars[p.var]; if (e.text) e.text.value = on ? p.onText : p.offText; if (e.shape) e.shape.fill = on ? p.onColor : p.offColor; };
    return {
      uiAlways: true,
      start(e, s) { if (s.vars[p.var] == null) s.setVar(p.var, p.start ? 1 : 0); show(e, s); },
      update(e, dt, s) {
        if (e.visible && s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) { s.setVar(p.var, +s.vars[p.var] ? 0 : 1); s.engine.audio.sfx('click'); s.punch(e, { sx: 0.12, sy: 0.12 }, 0.25, { add: true }); }
        show(e, s);
      },
    };
  },
});

/** Layout Group (like Unity's Horizontal / Vertical / Grid Layout): lines up UI elements with a tag inside this one. */
registerBehavior('uiLayout', {
  label: 'Layout Group', description: 'Lines up other UI elements in a row, a column or a grid inside this one, with even spacing. Give the elements a tag and enter it here.',
  params: [
    { key: 'tag', label: 'Arrange UI tagged', type: 'text', default: 'menu', suggest: 'tags' },
    { key: 'direction', label: 'Direction', type: 'select', options: ['vertical', 'horizontal', 'grid'], default: 'vertical' },
    { key: 'spacing', label: 'Spacing', type: 'number', default: 12 },
    { key: 'columns', label: 'Columns (grid)', type: 'number', default: 3, showIf: { direction: ['grid'] } },
    { key: 'align', label: 'Align', type: 'select', options: ['center', 'start', 'end'], default: 'center' },
  ],
  create(p) {
    return {
      uiAlways: true,
      update(e, dt, s) {
        const items = s.entities.filter((q) => q !== e && q.ui && !q.dead && q.has(p.tag) && q.visible);
        if (!items.length) return;
        const box = uiRect(s, e), sizes = items.map((q) => { const r = uiRect(s, q); return [r.w, r.h]; }), gap = +p.spacing || 0;
        const eng = s.engine, place = (q, cx, cy) => { const o = uiOrigin(q, eng.width, eng.height, eng.safe), ex = q.extents(); q.x = cx - o.x - (ex.ox || 0); q.y = cy - o.y - (ex.oy || 0); };
        if (p.direction === 'grid') {
          const cols = Math.max(1, +p.columns || 1), cw = Math.max(...sizes.map((z) => z[0])), ch = Math.max(...sizes.map((z) => z[1])), rows = Math.ceil(items.length / cols);
          const W = cols * cw + (cols - 1) * gap, H = rows * ch + (rows - 1) * gap;
          items.forEach((q, i) => place(q, box.x - W / 2 + cw / 2 + (i % cols) * (cw + gap), box.y - H / 2 + ch / 2 + Math.floor(i / cols) * (ch + gap)));
          return;
        }
        const v = p.direction === 'vertical', total = sizes.reduce((a, z) => a + (v ? z[1] : z[0]), 0) + gap * (items.length - 1);
        let at = (v ? box.y : box.x) - total / 2;
        items.forEach((q, i) => {
          const [w, h] = sizes[i], len = v ? h : w, cross = v ? w : h, room = v ? box.w : box.h;
          const off = p.align === 'start' ? -room / 2 + cross / 2 : p.align === 'end' ? room / 2 - cross / 2 : 0;
          if (v) place(q, box.x + off, at + len / 2); else place(q, at + len / 2, box.y + off);
          at += len + gap;
        });
      },
    };
  },
});

/** Animated Counter: shows a variable that counts up/down smoothly, like a slot machine score. */
registerBehavior('uiCounter', {
  label: 'Animated Counter', description: 'Shows a variable in this text and makes it count up (or down) smoothly when it changes, with a little pop. Great for scores and coins.',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'score', suggest: 'vars' },
    { key: 'prefix', label: 'Before', type: 'text', default: '' },
    { key: 'suffix', label: 'After', type: 'text', default: '' },
    { key: 'speed', label: 'Counting speed', type: 'number', default: 8, range: [1, 30], step: 1 },
    { key: 'pop', label: 'Pop when it changes', type: 'bool', default: true },
  ],
  create(p) {
    let shown = null, last = null;
    return {
      uiAlways: true,
      update(e, dt, s) {
        const v = +s.vars[p.var] || 0;
        if (shown === null) shown = v;
        if (last !== null && v > last && p.pop) s.punch(e, { sx: 0.18, sy: 0.18 }, 0.3, { add: false });
        last = v;
        shown += (v - shown) * Math.min(1, dt * (+p.speed || 8));
        if (Math.abs(v - shown) < 0.5) shown = v;
        e.text ||= { ...TEXT_DEFAULTS };
        e.text.value = `${p.prefix}${formatNumber(Math.round(shown))}${p.suffix}`;
      },
    };
  },
});

/** Typewriter: reveals this text one letter at a time. */
registerBehavior('typewriter', {
  label: 'Typewriter Text', description: 'Reveals this text one letter at a time, like a story or a hint. Can start on a message and repeat.',
  params: [
    { key: 'speed', label: 'Letters per second', type: 'number', default: 30, range: [2, 120], step: 1 },
    { key: 'startOn', label: 'Start', type: 'select', options: ['start', 'message'], default: 'start' },
    { key: 'message', label: 'Message', type: 'text', default: 'story', suggest: 'messages', showIf: { startOn: ['message'] } },
    { key: 'sound', label: 'Typing sound', type: 'bool', default: true },
  ],
  create(p) {
    let full = '', n = 0, on = false;
    return {
      uiAlways: true,
      start(e, s) { full = e.text?.value || ''; if (e.text) e.text.value = ''; on = p.startOn === 'start'; s.on('message', (m) => { if (m === p.message) { n = 0; on = true; } }); },
      update(e, dt, s) {
        if (!on || !e.text) return;
        const before = Math.floor(n); n = Math.min(full.length, n + dt * (+p.speed || 30));
        if (p.sound && Math.floor(n) > before && full[Math.floor(n) - 1] !== ' ' && Math.floor(n) % 2 === 0) s.engine.audio.tone({ freq: 900 + Math.random() * 200, dur: 0.02, vol: 0.03 });
        e.text.value = full.slice(0, Math.floor(n));
        if (n >= full.length) on = false;
      },
    };
  },
});

/** Text Input: tap to type a name or answer into a variable. */
registerBehavior('uiInput', {
  label: 'Text Input', description: 'Tap to type something (a player name, an answer) into a variable. Show it anywhere with {name}.',
  params: [
    { key: 'var', label: 'Variable', type: 'text', default: 'name', suggest: 'vars' },
    { key: 'question', label: 'Question', type: 'text', default: 'What is your name?' },
    { key: 'placeholder', label: 'Shown when empty', type: 'text', default: 'Tap to type…' },
    { key: 'maxLength', label: 'Max letters', type: 'number', default: 16 },
  ],
  create(p) {
    return {
      uiAlways: true,
      update(e, dt, s) {
        if (e.visible && s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) {
          s.engine.input.reset();
          const v = typeof prompt === 'function' ? prompt(p.question, s.vars[p.var] || '') : null;
          if (v != null) s.setVar(p.var, String(v).slice(0, +p.maxLength || 16));
        }
        e.text ||= { ...TEXT_DEFAULTS };
        e.text.value = s.vars[p.var] ? String(s.vars[p.var]) : p.placeholder;
      },
    };
  },
});

/** Touch Button: your own on-screen control, placed and sized anywhere (left, right, jump, fire…). */
registerBehavior('touchButton', {
  label: 'Touch Button', description: 'Make this UI element a game control you can place and size anywhere: move left/right/up/down, jump, fire, or send a message while held. Lights up while pressed.',
  params: [
    { key: 'action', label: 'Does', type: 'select', options: ['jump', 'fire', 'left', 'right', 'up', 'down', 'message'], default: 'jump' },
    { key: 'message', label: 'Message when pressed', type: 'text', default: 'boost', suggest: 'messages', showIf: { action: ['message'] } },
  ],
  create(p) {
    const ACT = { jump: 'jump', fire: 'action', left: 'dleft', right: 'dright', up: 'dup', down: 'ddown', message: 'msg' };
    let btn = null, was = false;
    return {
      update(e, dt, s) {
        const inp = s.engine.input, r = uiRect(s, e);
        if (!btn || !inp.buttons.includes(btn)) { btn = { action: ACT[p.action] || 'jump', label: '', hidden: true, id: null }; inp.buttons.push(btn); }
        Object.assign(btn, { x: r.x, y: r.y, w: r.w + 16, h: r.h + 16, r: Math.max(r.w, r.h) / 2 });
        const held = btn.id != null && e.visible;
        if (!e.visible) btn.x = -9999;
        e.alpha = held ? 1 : 0.75;
        if (held && !was) { s.punch(e, { sx: -0.1, sy: -0.1 }, 0.15, { add: true }); if (p.action === 'message') s.send(p.message); }
        was = held;
      },
      destroy(e, s) { const inp = s.engine.input; inp.buttons = inp.buttons.filter((b) => b !== btn); },
    };
  },
});

// ---- advanced components ----
/** Health & Damage: hit points, damage from tags, invulnerability, knockback, regeneration and what happens on death. */
registerBehavior('health', {
  label: 'Health & Damage', description: 'Hit points that go down when touched by dangerous tags. Brief invulnerability, knockback, regeneration, a health variable for your HUD, and a death action.',
  params: [
    { key: 'hp', label: 'Max health', type: 'number', default: 3, range: [1, 100], step: 1 },
    { key: 'hurtBy', label: 'Hurt by tags (comma separated)', type: 'text', default: 'enemy, hazard', suggest: 'tags' },
    { key: 'damage', label: 'Damage per hit', type: 'number', default: 1, step: 1 },
    { key: 'invuln', label: 'Invulnerable after a hit (sec)', type: 'number', default: 1, range: [0, 5], step: 0.1 },
    { key: 'knockback', label: 'Knockback', type: 'number', default: 300, default3d: 8 },
    { key: 'regen', label: 'Heal per second', type: 'number', default: 0, step: 0.1, group: 'More' },
    { key: 'syncVar', label: 'Show health in variable', type: 'text', default: '', suggest: 'vars', info: 'e.g. “hp”: show it with a Progress Bar or {hp} in a text.', group: 'More' },
    { key: 'onDeath', label: 'When health reaches 0', type: 'select', options: ['destroy', 'game over', 'respawn', 'send message', 'nothing'], default: 'destroy' },
    { key: 'message', label: 'Message to send', type: 'text', default: 'died', suggest: 'messages', showIf: { onDeath: ['send message'] } },
    { key: 'points', label: 'Points when it dies', type: 'number', default: 0, step: 5, group: 'More' },
  ],
  create(p) {
    let hp = 0, home = null;
    const tags = String(p.hurtBy || '').split(',').map((t) => t.trim()).filter(Boolean);
    const inst = {
      get hp() { return hp; },
      sync(e, s) { e.data.hp = hp; e.data.hpMax = p.hp; if (p.syncVar) s.setVar(p.syncVar, Math.ceil(hp)); },
      heal(n, e = inst.entity) { hp = Math.min(p.hp, hp + n); inst.sync(e, e.scene); },
      damage(n, e = inst.entity, from = null) {
        const s = e.scene; if (e.dead || hp <= 0 || (e.data.invuln || 0) > 0) return;
        hp -= n; e.data.invuln = +p.invuln || 0; inst.sync(e, s);
        s.emit('damage', e, n); s.engine.audio.sfx('hit'); s.impulse(6, e);
        if (from && p.knockback && e.body) { const dx = e.x - from.x, dy = e.y - from.y, dz = e.z - from.z, l = Math.hypot(dx, dy, dz) || 1, up = is3D(e) ? 1 : -1; e.body.vel.x = dx / l * p.knockback; e.body.vel.z = dz / l * p.knockback; e.body.vel.y = up * Math.abs(p.knockback) * 0.6; }
        if (hp > 0) return;
        s.emit('death', e); if (p.points) s.addVar('score', p.points);
        s.burst(e.x, e.y, e.z, e.mesh?.color || e.shape?.fill || '#ff8a3d', 24);
        if (p.onDeath === 'destroy') e.destroy();
        else if (p.onDeath === 'game over') s.gameOver();
        else if (p.onDeath === 'respawn') { Object.assign(e, home); if (e.body) e.body.vel = { x: 0, y: 0, z: 0 }; hp = p.hp; inst.sync(e, s); }
        else if (p.onDeath === 'send message') s.send(p.message);
      },
      start(e, s) { inst.entity = e; hp = p.hp; home = { x: e.x, y: e.y, z: e.z }; inst.sync(e, s); for (const t of tags) s.want(t); },
      update(e, dt, s) { if (p.regen && hp > 0 && hp < p.hp) { hp = Math.min(p.hp, hp + p.regen * dt); inst.sync(e, s); } },
      collide(e, other) { if (tags.some((t) => other.has(t))) inst.damage(+p.damage || 1, e, other); },
    };
    return inst;
  },
});

/** Enemy AI: patrol → chase when it sees the target → attack in range → give up and go home. */
registerBehavior('enemyAI', {
  label: 'Enemy AI', description: 'A smart enemy: patrols, chases the player when it can see them, attacks up close (damaging their Health), and returns home when it loses them.',
  params: [
    { key: 'target', label: 'Target tag', type: 'text', default: 'player', suggest: 'tags' },
    { key: 'sight', label: 'Sight range', type: 'number', default: 260, default3d: 9 },
    { key: 'needLineOfSight', label: 'Walls block its view', type: 'bool', default: true },
    { key: 'patrol', label: 'Patrol distance (0 = stand guard)', type: 'number', default: 100, default3d: 3 },
    { key: 'speed', label: 'Patrol speed', type: 'number', default: 60, default3d: 2 },
    { key: 'chaseSpeed', label: 'Chase speed', type: 'number', default: 140, default3d: 4.5 },
    { key: 'attackRange', label: 'Attack range', type: 'number', default: 44, default3d: 1.4 },
    { key: 'attackEvery', label: 'Attack every (sec)', type: 'number', default: 1, range: [0.1, 5], step: 0.1 },
    { key: 'damage', label: 'Damage', type: 'number', default: 1, step: 1 },
    { key: 'giveUp', label: 'Give up after losing sight (sec)', type: 'number', default: 3, group: 'More' },
  ],
  create(p) {
    let home = null, dir = 1, lost = 0, cool = 0, state = 'patrol';
    const moveTo = (e, s, tx, tz, speed, dt) => { // tz = target y in 2D
      const three = is3D(e), b = e.body, grav = !three && s.gravity && b?.type === 'dynamic' && b.gravityScale;
      let dx = tx - e.x, dy = three ? tz - e.z : tz - e.y; if (grav) dy = 0;
      const l = Math.hypot(dx, dy); if (l < 1e-3) { if (b?.type === 'dynamic') { b.vel.x = 0; if (three) b.vel.z = 0; else if (!grav) b.vel.y = 0; } return; }
      const vx = dx / l * speed, vy = dy / l * speed;
      if (b?.type === 'dynamic') { b.vel.x = vx; if (three) b.vel.z = vy; else if (!grav) b.vel.y = vy; }
      else { e.x += vx * dt; if (three) e.z += vy * dt; else e.y += vy * dt; }
      if (Math.abs(vx) > 1e-3) e.data.flipX = vx < 0;
      if (three) e.ry = Math.atan2(-vx, -vy) / DEG;
    };
    return {
      start(e) { home = { x: e.x, y: e.y, z: e.z }; e.data.state = state; },
      update(e, dt, s) {
        const t = s.findAll(p.target).find((q) => q !== e && !q.dead), three = is3D(e);
        const d = t ? Math.hypot(t.x - e.x, three ? 0 : t.y - e.y, three ? t.z - e.z : 0) : Infinity;
        const sees = !!t && d <= p.sight && (!p.needLineOfSight || s.canSee(e, t));
        cool -= dt;
        if (sees) { lost = 0; state = d <= p.attackRange ? 'attack' : 'chase'; }
        else if (state === 'chase' || state === 'attack') { lost += dt; if (lost > p.giveUp) state = 'return'; }
        if (state === 'attack' && t) {
          moveTo(e, s, e.x, three ? e.z : e.y, 0, dt);
          if (cool <= 0) { cool = p.attackEvery; const hb = t.getBehavior('health'); if (hb) hb.damage(+p.damage || 1, t, e); else s.emit('attack', e, t); s.punch(e, three ? { sx: 0.25, sy: 0.25, sz: 0.25 } : { sx: 0.25, sy: 0.25 }, 0.3, { add: true }); }
        } else if (state === 'chase' && t) moveTo(e, s, t.x, three ? t.z : t.y, p.chaseSpeed, dt);
        else if (state === 'return') { const hz = three ? home.z : home.y; moveTo(e, s, home.x, hz, p.speed, dt); if (Math.hypot(e.x - home.x, (three ? e.z : e.y) - hz) < 4 * (three ? 0.05 : 1)) state = 'patrol'; }
        else if (p.patrol > 0) { const tx = home.x + dir * p.patrol; moveTo(e, s, tx, three ? home.z : (s.gravity ? e.y : home.y), p.speed, dt); if (Math.abs(e.x - tx) < (three ? 0.1 : 3)) dir = -dir; }
        else moveTo(e, s, e.x, three ? e.z : e.y, 0, dt);
        e.data.state = state;
      },
    };
  },
});

/** Grid A* over the level: static colliders are walls. Returns a list of points or null. */
function findPath(s, from, to, cell, agentR, ignore) {
  const three = s.mode === '3d', walls = s.entities.filter((q) => q.body && q.body.type === 'static' && !q.body.sensor && !q.dead && q !== ignore && !q.ui);
  let x0 = Math.min(from.x, to.x), x1 = Math.max(from.x, to.x), y0 = Math.min(three ? from.z : from.y, three ? to.z : to.y), y1 = Math.max(three ? from.z : from.y, three ? to.z : to.y);
  const pad = cell * 12; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = Math.min(160, Math.ceil((x1 - x0) / cell) + 1), H = Math.min(160, Math.ceil((y1 - y0) / cell) + 1);
  const blocked = new Uint8Array(W * H), wb = walls.map((q) => { const ex = q.extents(); return { cx: q.x + (ex.ox || 0), cy: three ? q.z + (ex.oz || 0) : q.y + (ex.oy || 0), hx: (ex.sphere ? ex.r : ex.bx ?? ex.hx) + agentR, hy: (ex.sphere ? ex.r : three ? ex.hz : ex.by ?? ex.hy) + agentR, top: q.y + (ex.oy || 0) + (ex.sphere ? ex.r : ex.hy), bot: q.y + (ex.oy || 0) - (ex.sphere ? ex.r : ex.hy) }; })
    .filter((w) => !three || (w.top > from.y - 0.4 && w.bot < from.y + 0.9)); // 3D: only things at body height are walls (floors aren't)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + i * cell, y = y0 + j * cell;
    for (const w of wb) if (Math.abs(x - w.cx) < w.hx && Math.abs(y - w.cy) < w.hy) { blocked[j * W + i] = 1; break; }
  }
  const idx = (x, y) => [Math.round((x - x0) / cell), Math.round((y - y0) / cell)];
  const [si, sj] = idx(from.x, three ? from.z : from.y), [ti, tj] = idx(to.x, three ? to.z : to.y);
  if (ti < 0 || tj < 0 || ti >= W || tj >= H || si < 0 || sj < 0 || si >= W || sj >= H) return null;
  blocked[sj * W + si] = 0; blocked[tj * W + ti] = 0;
  const g = new Float32Array(W * H).fill(Infinity), came = new Int32Array(W * H).fill(-1), open = [[0, si, sj]], closed = new Uint8Array(W * H);
  g[sj * W + si] = 0;
  const hf = (i, j) => Math.hypot(i - ti, j - tj);
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0], id = j * W + i;
    if (closed[id]) continue; closed[id] = 1;
    if (i === ti && j === tj) {
      const pts = []; let c = id;
      while (c !== -1) { const ci = c % W, cj = (c / W) | 0; pts.unshift(three ? { x: x0 + ci * cell, y: from.y, z: y0 + cj * cell } : { x: x0 + ci * cell, y: y0 + cj * cell, z: 0 }); c = came[c]; }
      return pts;
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nid = nj * W + ni; if (blocked[nid] || closed[nid]) continue;
      if (di && dj && (blocked[j * W + ni] || blocked[nj * W + i])) continue; // no cutting corners
      const ng = g[id] + (di && dj ? 1.414 : 1);
      if (ng < g[nid]) { g[nid] = ng; came[nid] = id; open.push([ng + hf(ni, nj), ni, nj]); }
    }
    if (open.length > 20000) break;
  }
  return null;
}
registerBehavior('navigator', {
  label: 'Pathfinding (Navigator)', description: 'Finds a way around walls to reach a target (A* pathfinding): smart chasers, pets that follow you, NPCs walking to places.',
  params: [
    { key: 'target', label: 'Go to tag or object', type: 'text', default: 'player', suggest: 'tags' },
    { key: 'speed', label: 'Speed', type: 'number', default: 120, default3d: 3.5 },
    { key: 'cell', label: 'Grid size (smaller = more precise)', type: 'number', default: 24, default3d: 0.5 },
    { key: 'stop', label: 'Stop this close', type: 'number', default: 30, default3d: 1 },
    { key: 'repath', label: 'Re-plan every (sec)', type: 'number', default: 0.5, range: [0.1, 3], step: 0.1, group: 'More' },
  ],
  create(p) {
    let path = null, t = 0, k = 1;
    return {
      update(e, dt, s) {
        const goal = s.find(p.target) || s.findAll(p.target).find((q) => q !== e);
        if (!goal) return;
        const three = is3D(e), dist = Math.hypot(goal.x - e.x, three ? goal.z - e.z : goal.y - e.y);
        const b = e.body;
        if (dist <= p.stop) { path = null; if (b?.type === 'dynamic') { b.vel.x = 0; if (three) b.vel.z = 0; else if (!s.gravity) b.vel.y = 0; } return; }
        if ((t -= dt) <= 0 || !path) { t = p.repath; const ex = e.extents(); path = findPath(s, e, goal, Math.max(0.05, +p.cell || 24), (ex.sphere ? ex.r : Math.max(ex.hx, three ? ex.hz : ex.hy)) * 0.9, e); k = 1; }
        const wp = path?.[Math.min(k, path.length - 1)] || goal;
        const dx = wp.x - e.x, dy = three ? wp.z - e.z : wp.y - e.y, l = Math.hypot(dx, dy);
        if (l < (+p.cell || 24) * 0.5 && path && k < path.length - 1) k++;
        const vx = l ? dx / l * p.speed : 0, vy = l ? dy / l * p.speed : 0;
        if (b?.type === 'dynamic') { b.vel.x = vx; if (three) b.vel.z = vy; else if (!s.gravity) b.vel.y = vy; }
        else { e.x += vx * dt; if (three) e.z += vy * dt; else e.y += vy * dt; }
        if (Math.abs(vx) > 1e-3) e.data.flipX = vx < 0;
        if (three && l) e.ry = Math.atan2(-vx, -vy) / DEG;
      },
    };
  },
});

/** Joint: tie this object to another with a spring, a rope or a stiff rod. */
registerBehavior('joint', {
  label: 'Joint (spring / rope / rod)', description: 'Connects this object to another one: a bouncy spring, a rope that stops it going too far (swinging, pendulums, grappling), or a stiff rod.',
  params: [
    { key: 'connectTo', label: 'Connect to object', type: 'text', default: '', suggest: 'objects' },
    { key: 'kind', label: 'Type', type: 'select', options: ['rope', 'spring', 'rod'], default: 'rope' },
    { key: 'length', label: 'Length (0 = current distance)', type: 'number', default: 0 },
    { key: 'stiffness', label: 'Spring stiffness', type: 'number', default: 30, showIf: { kind: ['spring'] } },
    { key: 'damping', label: 'Spring damping', type: 'number', default: 2, showIf: { kind: ['spring'] } },
    { key: 'showLine', label: 'Draw the rope', type: 'bool', default: true },
    { key: 'color', label: 'Rope color', type: 'color', default: '#d7ccc8', showIf: (b) => !!b.showLine },
  ],
  create(p) {
    let L = 0;
    return {
      start(e, s) { const a = s.find(p.connectTo); e.ensureBody({ type: 'dynamic' }); L = +p.length || (a ? Math.hypot(a.x - e.x, a.y - e.y, a.z - e.z) : 100); },
      update(e, dt, s) {
        const a = s.find(p.connectTo); if (!a || a === e) { e.data._line = null; return; }
        const b = e.body, dx = e.x - a.x, dy = e.y - a.y, dz = e.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, nx = dx / d, ny = dy / d, nz = dz / d;
        if (p.kind === 'spring') { const f = -(d - L) * p.stiffness, vn = b.vel.x * nx + b.vel.y * ny + b.vel.z * nz; b.vel.x += (f * nx - p.damping * vn * nx) * dt; b.vel.y += (f * ny - p.damping * vn * ny) * dt; b.vel.z += (f * nz - p.damping * vn * nz) * dt; }
        else if (d > L || p.kind === 'rod') {
          e.x = a.x + nx * L; e.y = a.y + ny * L; e.z = a.z + nz * L;
          const vn = b.vel.x * nx + b.vel.y * ny + b.vel.z * nz;
          if (vn > 0 || p.kind === 'rod') { b.vel.x -= vn * nx; b.vel.y -= vn * ny; b.vel.z -= vn * nz; }
        }
        e.data._line = p.showLine ? [a.x, a.y, a.z, e.x, e.y, e.z, p.color || '#d7ccc8'] : null;
      },
    };
  },
});

/** Wave Spawner: waves of enemies with breaks in between, then do something when they are all beaten. */
registerBehavior('waveSpawner', {
  label: 'Wave Spawner', description: 'Spawns waves of a template (5 enemies, then 8, then a boss…) with breaks in between. Shows the wave number in {wave}. Can win the game when all waves are beaten.',
  params: [
    { key: 'waves', label: 'Waves', type: 'json', default: [{ template: 'Enemy', count: 4, every: 1 }, { template: 'Enemy', count: 7, every: 0.7 }, { template: 'Enemy', count: 12, every: 0.5 }] },
    { key: 'pause', label: 'Break between waves (sec)', type: 'number', default: 3, range: [0, 15], step: 0.5 },
    { key: 'area', label: 'Spawn area width', type: 'number', default: 300, default3d: 10 },
    { key: 'areaH', label: 'Spawn area height / depth', type: 'number', default: 0, default3d: 10 },
    { key: 'whenDone', label: 'When every wave is beaten', type: 'select', options: ['win', 'send message', 'loop waves', 'nothing'], default: 'win' },
    { key: 'message', label: 'Message', type: 'text', default: 'waves-done', showIf: { whenDone: ['send message'] } },
  ],
  create(p) {
    const waves = Array.isArray(p.waves) ? p.waves : [];
    let w = -1, left = 0, t = 0, spawned = [], phase = 'break';
    return {
      start(e, s) { t = 1; s.setVar('wave', 0); },
      update(e, dt, s) {
        spawned = spawned.filter((q) => !q.dead);
        t -= dt;
        if (phase === 'break' && t <= 0) {
          w++;
          if (w >= waves.length) {
            if (p.whenDone === 'loop waves') { w = 0; } else { phase = 'done'; if (p.whenDone === 'win') s.win(); else if (p.whenDone === 'send message') s.send(p.message); return; }
          }
          phase = 'spawn'; left = +waves[w].count || 1; t = 0; s.setVar('wave', w + 1); s.message(`Wave ${w + 1}`, 1.5); s.send('wave-' + (w + 1));
        } else if (phase === 'spawn' && t <= 0 && left > 0) {
          const W = waves[w], three = is3D(e);
          const q = s.spawn(W.template, { x: e.x + rand(-0.5, 0.5) * p.area, y: three ? e.y : e.y + rand(-0.5, 0.5) * p.areaH, z: three ? e.z + rand(-0.5, 0.5) * p.areaH : 0 });
          if (q) spawned.push(q);
          left--; t = +W.every || 1;
        } else if (phase === 'spawn' && left <= 0 && !spawned.length) { phase = 'break'; t = p.pause; }
      },
    };
  },
});

/** Dialogue: a conversation box with speaker names and typewriter text; tap to continue. */
registerBehavior('dialogue', {
  label: 'Dialogue', description: 'Shows a conversation, one line at a time, with speaker names and typewriter text. Tap to continue. Write one line per row as “Name: text”.',
  params: [
    { key: 'lines', label: 'Lines (one per row, “Name: text”)', type: 'code', default: 'Guard: Halt! Who goes there?\nYou: Just a traveler.\nGuard: Fine. Watch out for slimes!' },
    { key: 'trigger', label: 'Start when', type: 'select', options: ['touched by tag', 'tapped', 'game starts', 'message'], default: 'touched by tag' },
    { key: 'tag', label: 'Tag', type: 'text', default: 'player', suggest: 'tags', showIf: { trigger: ['touched by tag'] } },
    { key: 'message', label: 'Message', type: 'text', default: 'talk', suggest: 'messages', showIf: { trigger: ['message'] } },
    { key: 'once', label: 'Only once', type: 'bool', default: true },
    { key: 'pause', label: 'Pause the game while talking', type: 'bool', default: true },
    { key: 'then', label: 'Afterwards, send message', type: 'text', default: '', suggest: 'messages', group: 'More' },
  ],
  create(p) {
    let done = false;
    const lines = String(p.lines || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^([^:]{1,24}):\s*(.*)$/); return m ? { who: m[1], text: m[2] } : { who: '', text: l }; });
    const open = (s) => { if (done && p.once) return; if (s.dialog || !lines.length) return; done = true; s.dialog = { lines, i: 0, chars: 0, pause: p.pause, then: p.then }; };
    return {
      uiAlways: true,
      start(e, s) { if (p.trigger === 'touched by tag') { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); } if (p.trigger === 'game starts') open(s); if (p.trigger === 'message') s.on('message', (n) => { if (n === p.message) open(s); }); },
      update(e, dt, s) { if (p.trigger === 'tapped' && e.visible && s.engine.input.taps.some((t) => hitTest(s, e, t.x, t.y))) open(s); },
      collide(e, other, s) { if (p.trigger === 'touched by tag' && other.has(p.tag)) open(s); },
    };
  },
});

/** Day / Night Cycle: the sun moves, light and sky colors change; 2D levels get darker at night. */
registerBehavior('dayNight', {
  label: 'Day / Night Cycle', description: 'Time passes: the sun moves and the light and sky change from day to night and back. 2D levels get dark at night (add lights!). Shows the hour in {hour}.',
  params: [
    { key: 'dayLength', label: 'Length of a full day (sec)', type: 'number', default: 60, range: [5, 600], step: 5 },
    { key: 'start', label: 'Start at hour (0–24)', type: 'number', default: 8, range: [0, 24], step: 0.5 },
    { key: 'dayColor', label: 'Day sky', type: 'color', default: '#87b8e8' },
    { key: 'nightColor', label: 'Night sky', type: 'color', default: '#0b1030' },
    { key: 'maxDark', label: 'Night darkness (2D)', type: 'number', default: 0.8, range: [0, 1], step: 0.05, only2d: true },
  ],
  create(p) {
    let hour = 0;
    return {
      start(e, s) { hour = +p.start || 0; },
      update(e, dt, s) {
        hour = (hour + dt * 24 / Math.max(1, +p.dayLength || 60)) % 24;
        const sun = Math.sin((hour - 6) / 24 * Math.PI * 2), day = clamp(sun * 1.6 + 0.3, 0, 1);
        s.background = mixColor(p.nightColor, p.dayColor, day); s.light._driven = true;
        if (s.mode === '3d') {
          s.light.sunAngle = hour * 15; const h = clamp(sun, 0.05, 1) * 80 + 5, a = s.light.sunAngle * DEG, hh = h * DEG;
          s.light.dir = { x: -Math.cos(hh) * Math.sin(a), y: -Math.sin(hh), z: -Math.cos(hh) * Math.cos(a) };
          s.light.intensity = 0.15 + day * 0.95; s.light.ambient = 0.18 + day * 0.32;
          s.light.color = mixColor('#ffb37a', '#ffffff', clamp(sun * 2, 0, 1));
        } else s.light.darkness = (1 - day) * (+p.maxDark || 0);
        const hr = Math.floor(hour); if (s.vars.hour !== hr) s.setVar('hour', hr);
      },
    };
  },
});

/** Particle System: fire, smoke, rain, snow, sparkles, confetti, magic, bubbles. */
const PARTICLE_PRESETS = {
  fire: { rate: 40, colors: ['#ffd54f', '#ff9800', '#f44336'], speed: 60, spread: 0.6, dir: -90, life: 0.8, size: 7, gravity: -120, shrink: true, round: true },
  smoke: { rate: 12, colors: ['#9e9e9e', '#757575'], speed: 30, spread: 0.5, dir: -90, life: 2, size: 14, gravity: -30, grow: true, round: true, alpha: 0.5 },
  rain: { rate: 120, colors: ['#90caf9'], speed: 700, spread: 0.05, dir: 95, life: 1.2, size: 3, gravity: 0, area: true, stretch: 4 },
  snow: { rate: 40, colors: ['#ffffff'], speed: 60, spread: 0.6, dir: 90, life: 6, size: 5, gravity: 10, area: true, round: true, wobble: true },
  sparkle: { rate: 18, colors: ['#ffffff', '#fff59d', '#80deea'], speed: 40, spread: 3.2, dir: 0, life: 0.7, size: 4, gravity: 0, shrink: true },
  confetti: { rate: 60, colors: ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'], speed: 300, spread: 0.8, dir: -90, life: 2.5, size: 7, gravity: 500 },
  magic: { rate: 30, colors: ['#ce93d8', '#80cbc4', '#fff59d'], speed: 50, spread: 3.2, dir: -90, life: 1.2, size: 5, gravity: -60, shrink: true, round: true },
  bubbles: { rate: 8, colors: ['#b3e5fc'], speed: 50, spread: 0.4, dir: -90, life: 3, size: 10, gravity: -40, round: true, alpha: 0.6, wobble: true },
};
registerBehavior('particles', {
  label: 'Particle System', description: 'Ready-made effects: fire, smoke, rain, snow, sparkles, confetti, magic, bubbles. Rain and snow cover the whole screen.',
  params: [
    { key: 'preset', label: 'Effect', type: 'select', options: Object.keys(PARTICLE_PRESETS), default: 'fire' },
    { key: 'rate', label: 'Amount (per second, 0 = preset)', type: 'number', default: 0, range: [0, 300], step: 5 },
    { key: 'size', label: 'Size (0 = preset)', type: 'number', default: 0, step: 1 },
    { key: 'color', label: 'Tint (optional)', type: 'color', optional: true, default: '' },
    { key: 'playing', label: 'Playing', type: 'bool', default: true },
  ],
  create(p) {
    const P = PARTICLE_PRESETS[p.preset] || PARTICLE_PRESETS.fire;
    let acc = 0, on = !!p.playing;
    return {
      start(e, s) { s.on('message', (n) => { if (n === 'particles-on' || n === e.name + '-on') on = true; if (n === 'particles-off' || n === e.name + '-off') on = false; }); },
      update(e, dt, s) {
        if (!on || !e.visible) return;
        const three = s.mode === '3d', k3 = three ? 0.03 : 1, rate = +p.rate || P.rate, size = (+p.size || P.size) * (three ? 0.03 : 1);
        acc += rate * dt;
        const vb = !three && P.area ? s.viewBounds() : null;
        while (acc >= 1 && s.particles.length < 1500) {
          acc--;
          const a = (P.dir * DEG) + rand(-P.spread, P.spread), sp = P.speed * rand(0.6, 1.2) * k3;
          const c = p.color || P.colors[(Math.random() * P.colors.length) | 0];
          let x = e.x, y = e.y, z = e.z;
          if (P.area) { if (vb) { x = rand(vb.left - 40, vb.right + 40); y = vb.top - 10; } else { x = s.camera.target.x + rand(-12, 12); y = s.camera.target.y + 10; z = s.camera.target.z + rand(-12, 12); } }
          s.particles.push({ x, y, z, color: c, life: 1, decay: 1 / (P.life * rand(0.8, 1.2)), vx: Math.cos(a) * sp, vy: three ? -Math.sin(a) * sp : Math.sin(a) * sp, vz: three ? rand(-0.3, 0.3) * sp : 0,
            size: size * rand(0.7, 1.3), g: (three ? -P.gravity * 0.03 : P.gravity), drag: 1, shrink: P.shrink, grow: P.grow, round: P.round, alpha: P.alpha, stretch: P.stretch, wobble: P.wobble });
        }
      },
    };
  },
});

/** Inventory Item: picked up into the player's inventory ({inventory} shows it; conditions and instructions can check or use items). */
registerBehavior('inventoryItem', {
  label: 'Inventory Item', description: 'An item to pick up (key, potion, gem…). It goes into the inventory: show it with {inventory}, or {item_Key} for one item. Use “Has item” conditions and “Use item” instructions.',
  params: [
    { key: 'item', label: 'Item name', type: 'text', default: 'Key' },
    { key: 'icon', label: 'Icon (emoji)', type: 'text', default: '🔑' },
    { key: 'amount', label: 'Amount', type: 'number', default: 1, step: 1 },
    { key: 'tag', label: 'Picked up by tag', type: 'text', default: 'player', suggest: 'tags' },
  ],
  create(p) {
    return {
      start(e, s) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(p.tag); },
      collide(e, other, s) { if (!other.has(p.tag) || e.dead) return; s.addItem(p.item, +p.amount || 1, p.icon); s.engine.audio.sfx('power'); s.burst(e.x, e.y, e.z, '#fff59d', 12); s.message(`${p.icon} ${p.item}${+p.amount > 1 ? ' ×' + p.amount : ''}`, 1.2); e.destroy(); },
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
    case 'save game': if (s.saveGame(p.amount || 1)) s.message(v && v !== 'Hello!' ? v : 'Game saved', 1.5); break;
    case 'load game': if (!s.loadGame(p.amount || 1)) s.message('No saved game yet', 1.5); return;
    case 'delete save': s.deleteSave(p.amount || 1); s.message('Save deleted', 1.5); break;
    case 'switch camera': s.setCamera(v); break;
    case 'push': { const t = (v ? obj(v) : other) || e, b = t?.ensureBody({ type: 'dynamic' }); const [px, py, pz] = String(p.amount).split(',').map(Number); if (b) { b.vel.x += px || 0; b.vel.y += py || 0; b.vel.z += pz || 0; } break; }
    case 'set gravity': s.gravity = +p.amount || 0; break;
    case 'toggle light': { const t = obj(v); if (t?.light) t.light.off = !t.light.off; break; }
    case 'send message': s.send(v); break;
    case 'play animation': playClip(e, v); break;
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
    if (o.tiles) { if (s.mode !== '3d' && o.tiles.solidAtWorld(o, x, y)) return o; continue; }
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
      start(e, s) { e.ensureBody({ type: 'kinematic' }); s.want('player'); },
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

// ---- Character Controller 2D: one component, many kinds of 2D movement ----
const withParamDefaults = (type, extra) => { const d = Behaviors[type]; const o = {}; for (const q of d.params || []) o[q.key] = paramDefault(q, false); return { ...o, ...extra }; };
registerBehavior('controller2d', {
  label: 'Character Controller 2D', description: 'Pick how the player moves: top-down, platformer, runner, flappy, car, spaceship, tank, tap to move, follow finger, paddle or grid steps.',
  params: [
    { key: 'mode', label: 'Movement type', type: 'select', default: 'topdown8', options: [
      ['topdown8', 'Top-down (8 directions)'], ['topdown4', 'Top-down (4 directions)'], ['platformer', 'Platformer (run & jump)'], ['runner', 'Auto-runner (tap to jump)'],
      ['flappy', 'Flappy (tap to fly up)'], ['car', 'Car (steer & drive)'], ['spaceship', 'Spaceship (turn & thrust)'], ['tank', 'Tank (turn & roll)'],
      ['tapToMove', 'Tap to move (point & click)'], ['followFinger', 'Follow finger'], ['sideToSide', 'Side to side (paddle)'], ['grid', 'Grid steps (one tile per swipe)']],
      info: { topdown8: 'Joystick or drag moves it in any direction.', topdown4: 'Up, down, left or right only (classic RPG).', platformer: 'Needs gravity. Joystick to run, jump button or tap to jump.',
        runner: 'Runs forward on its own; tap to jump. Needs gravity and ground.', flappy: 'Each tap pushes it up; gravity pulls it down.', car: 'Joystick left/right steers, up drives (or always drives).',
        spaceship: 'Turn with the joystick, push forward to thrust. Drifts in space.', tank: 'Joystick left/right turns, up/down drives forward and back.', tapToMove: 'Tap anywhere and it walks there.',
        followFinger: 'Sticks to your finger while you touch the screen.', sideToSide: 'Left and right only, like a paddle or shooter ship.', grid: 'One tile per swipe or joystick push.' } },
    { key: 'speed', label: 'Speed', type: 'number', default: 240, step: 10 },
    { key: 'jump', label: 'Jump / flap power', type: 'number', default: 620, step: 20, showIf: { mode: ['platformer', 'runner', 'flappy'] } },
    { key: 'turn', label: 'Turn speed (°/s)', type: 'number', default: 200, step: 10, showIf: { mode: ['car', 'spaceship', 'tank'] } },
    { key: 'accel', label: 'Acceleration', type: 'number', default: 600, step: 50, showIf: { mode: ['car', 'spaceship'] } },
    { key: 'friction', label: 'Slow down (0 = slide forever)', type: 'number', default: 2, step: 0.25, showIf: { mode: ['car', 'spaceship', 'topdown8', 'topdown4'] } },
    { key: 'autoDrive', label: 'Always drive forward', type: 'bool', default: false, showIf: { mode: ['car'] } },
    { key: 'faceMove', label: 'Turn to face movement', type: 'bool', default: false, showIf: { mode: ['topdown8', 'topdown4', 'tapToMove'] } },
    { key: 'tile', label: 'Tile size', type: 'number', default: 40, showIf: { mode: ['grid'] } },
    { key: 'keepInView', label: 'Keep on screen', type: 'bool', default: true, showIf: { mode: ['topdown8', 'topdown4', 'sideToSide', 'followFinger', 'spaceship', 'flappy'] } },
    { key: 'onFall', label: 'When falling off', type: 'select', options: ['gameover', 'respawn', 'damage'], default: 'respawn', showIf: { mode: ['platformer', 'runner', 'flappy'] } },
  ],
  create(p) {
    // movements the engine already does well
    const delegate = { topdown8: () => Behaviors.move.create(withParamDefaults('move', { speed: p.speed, control: 'both', axes: 'all', keepInView: p.keepInView })),
      sideToSide: () => Behaviors.move.create(withParamDefaults('move', { speed: p.speed, control: 'both', axes: 'horizontal', keepInView: p.keepInView })),
      platformer: () => Behaviors.platformer.create(withParamDefaults('platformer', { speed: p.speed, jump: p.jump, onFall: p.onFall })),
      grid: () => Behaviors.gridMove.create(withParamDefaults('gridMove', { tile: p.tile })) }[p.mode];
    if (delegate) {
      const inner = delegate();
      return { ...inner, start(e, s) { if (['topdown8', 'sideToSide', 'platformer'].includes(p.mode)) { s.settings.joystick = true; if (p.mode === 'platformer') s.settings.jumpButton = true; s.engine.layoutButtons?.(); } inner.start?.(e, s); } };
    }
    let heading = 0, target = null, speed = 0;
    const keep = (e, s) => { if (!p.keepInView) return; const v = s.viewBounds(), ex = e.extents(), hx = ex.sphere ? ex.r : ex.hx, hy = ex.sphere ? ex.r : ex.hy; e.x = clamp(e.x, v.left + hx, v.right - hx); e.y = clamp(e.y, v.top + hy, v.bottom - hy); };
    const fell = (e, s) => { const v = s.viewBounds(); if (e.y > v.bottom + 300) respawnOrEnd(e, s, p.onFall); };
    const face = (e, vx, vy) => { if (p.faceMove && Math.hypot(vx, vy) > 5) e.rz = Math.atan2(vy, vx) / DEG; };
    return {
      start(e, s) {
        const gravity = ['runner', 'flappy'].includes(p.mode);
        e.ensureBody({ type: 'dynamic', gravityScale: gravity ? 1 : 0 });
        if (!gravity) e.body.gravityScale = 0;
        heading = (e.rz || 0) * DEG; e.data.respawn ||= { x: e.x, y: e.y, z: e.z };
        if (['topdown4', 'car', 'spaceship', 'tank'].includes(p.mode)) { s.settings.joystick = true; s.engine.layoutButtons?.(); }
        if (p.mode === 'runner') { s.settings.jumpButton = true; s.engine.layoutButtons?.(); }
      },
      update(e, dt, s) {
        if (s.state !== 'play') return;
        const inp = s.engine.input, a = inp.axis(), b = e.body, damp = Math.max(0, 1 - (+p.friction || 0) * dt);
        switch (p.mode) {
          case 'topdown4': {
            let ax = a.x, ay = a.y; if (Math.abs(ax) > Math.abs(ay)) ay = 0; else ax = 0;
            const d = inp.drag; let dx = d.dx, dy = d.dy; if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
            const z = s.engine.renderer.zoomFor(s);
            b.vel.x = Math.sign(ax) * (Math.abs(ax) > 0.3 ? p.speed : 0); b.vel.y = Math.sign(ay) * (Math.abs(ay) > 0.3 ? p.speed : 0);
            e.x += dx / z; e.y += dy / z; face(e, b.vel.x || dx, b.vel.y || dy); keep(e, s); break;
          }
          case 'runner': {
            b.vel.x = p.speed;
            if ((inp.pressed('tap') || inp.pressed('btn:jump') || inp.pressed('swipe:up')) && b.grounded) { b.vel.y = -p.jump; s.engine.audio.sfx('jump'); }
            fell(e, s); break;
          }
          case 'flappy': {
            if (inp.pressed('tap') || inp.pressed('btn:jump')) { b.vel.y = -p.jump * 0.6; s.engine.audio.sfx('jump'); }
            e.rz = clamp(b.vel.y / 12, -30, 70); if (p.keepInView) { const v = s.viewBounds(); if (e.y < v.top) { e.y = v.top; b.vel.y = 0; } }
            fell(e, s); break;
          }
          case 'car': {
            const thr = p.autoDrive ? 1 : Math.max(0, -a.y) + (a.y > 0.3 ? -0.5 : 0);
            speed = speed * damp + thr * p.accel * dt; speed = clamp(speed, -p.speed * 0.4, p.speed);
            heading += a.x * (p.turn * DEG) * dt * clamp(Math.abs(speed) / (p.speed * 0.3), 0, 1) * Math.sign(speed || 1);
            b.vel.x = Math.cos(heading) * speed; b.vel.y = Math.sin(heading) * speed; e.rz = heading / DEG; break;
          }
          case 'spaceship': {
            heading += a.x * (p.turn * DEG) * dt;
            const thrust = Math.max(0, -a.y) + (inp.pointers.size && !inp.stick ? 1 : 0);
            b.vel.x = b.vel.x * damp + Math.cos(heading) * thrust * p.accel * dt; b.vel.y = b.vel.y * damp + Math.sin(heading) * thrust * p.accel * dt;
            const v = Math.hypot(b.vel.x, b.vel.y); if (v > p.speed) { b.vel.x *= p.speed / v; b.vel.y *= p.speed / v; }
            e.rz = heading / DEG;
            if (p.keepInView) { const vb = s.viewBounds(); if (e.x < vb.left) e.x = vb.right; else if (e.x > vb.right) e.x = vb.left; if (e.y < vb.top) e.y = vb.bottom; else if (e.y > vb.bottom) e.y = vb.top; }
            break;
          }
          case 'tank': {
            heading += a.x * (p.turn * DEG) * dt; const fwd = -a.y * p.speed;
            b.vel.x = Math.cos(heading) * fwd; b.vel.y = Math.sin(heading) * fwd; e.rz = heading / DEG; break;
          }
          case 'tapToMove': {
            const t = inp.taps[0] || [...inp.pointers.values()][0];
            if (t) { const w = s.engine.renderer.screenToWorld(s, t.x, t.y); target = { x: w.x, y: w.y }; }
            if (target) {
              const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy);
              if (d < 4) { b.vel.x = b.vel.y = 0; target = null; } else { const v = Math.min(p.speed, d / Math.max(dt, 1e-3)); b.vel.x = dx / d * v; b.vel.y = dy / d * v; face(e, dx, dy); }
            }
            break;
          }
          case 'followFinger': {
            const t = [...inp.pointers.values()].find((q) => q.role === 'free');
            if (t) { const w = s.engine.renderer.screenToWorld(s, t.x, t.y), dx = w.x - e.x, dy = w.y - e.y, k = Math.min(1, dt * (p.speed / 20)); b.vel.x = dx * k / Math.max(dt, 1e-3); b.vel.y = dy * k / Math.max(dt, 1e-3); }
            else { b.vel.x = 0; b.vel.y = 0; }
            keep(e, s); break;
          }
          default: break;
        }
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
    { key: 'sound', label: 'Sound', type: 'select', options: SOUNDS, default: 'hit' },
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

// ---- tap & click components ----
/** Float a text up from a screen point (clicker "+10" feedback). */
export function popText(s, x, y, text, color = '#ffd23d', size = 26) { (s.popups ||= []).push({ x: x + rand(-18, 18), y, text: String(text), color, size, t: s.time, life: 0.9, rise: 60 }); }
const screenOf = (s, e) => (e.ui ? (() => { const o = uiOrigin(e, s.engine.width, s.engine.height, s.engine.safe); return { x: o.x + e.x, y: o.y + e.y }; })() : s.engine.renderer.worldToScreen(s, e.x, e.y, e.z));
const tapsOn = (s, e) => s.engine.input.taps.filter((t) => e.visible && !e.dead && hitTest(s, e, t.x, t.y));
const squash = (s, e, k = 0.88) => { const b = e.data.baseScale ??= e.sx; e.sx = e.sy = b * k; s.tween(e, { sx: b, sy: b }, 0.18); };

registerBehavior('clickPopup', {
  label: 'Click Popup', description: 'Floating text like “+10” rises where this object is tapped. Use {score} and other variables. Pairs well with Tap Target and Combo Clicker.',
  params: [
    { key: 'text', label: 'Text', type: 'text', default: '+1' },
    { key: 'color', label: 'Colour', type: 'color', default: '#ffd23d' },
    { key: 'size', label: 'Size', type: 'number', default: 26, range: [10, 80] },
  ],
  create(p) { return { uiAlways: true, update(e, dt, s) { for (const t of tapsOn(s, e)) popText(s, t.x, t.y - 20, fillTemplate(p.text, s.vars), p.color, p.size); } }; },
});

registerBehavior('comboClicker', {
  label: 'Combo Clicker', description: 'Tap it for points. Quick taps build a combo that multiplies them; some taps are critical hits. {combo} shows the combo.',
  params: [
    { key: 'points', label: 'Points per tap', type: 'number', default: 1 },
    { key: 'var', label: 'Adds to variable', type: 'text', default: 'score', suggest: 'vars' },
    { key: 'bonusVar', label: 'Extra points from variable', type: 'text', default: '', suggest: 'vars', info: 'e.g. “power”, raised by an Upgrade Button.' },
    { key: 'window', label: 'Combo window (seconds)', type: 'number', default: 0.6, step: 0.1, range: [0.1, 3] },
    { key: 'comboStep', label: 'Extra multiplier per combo tap', type: 'number', default: 0.25, step: 0.05 },
    { key: 'maxCombo', label: 'Max combo', type: 'number', default: 50, step: 5 },
    { key: 'critChance', label: 'Critical hit chance %', type: 'number', default: 10, range: [0, 100] },
    { key: 'critMult', label: 'Critical multiplier', type: 'number', default: 3, step: 0.5 },
    { key: 'popup', label: 'Show “+points”', type: 'bool', default: true },
    { key: 'sound', label: 'Sound', type: 'select', options: SOUNDS, default: 'click' },
  ],
  create(p) {
    let combo = 0, last = -99;
    return {
      update(e, dt, s) {
        if (combo && s.time - last > p.window) { combo = 0; s.setVar('combo', 0); }
        for (const t of tapsOn(s, e)) {
          combo = s.time - last <= p.window ? Math.min(p.maxCombo, combo + 1) : 1; last = s.time;
          const crit = Math.random() * 100 < p.critChance, mult = (1 + (combo - 1) * p.comboStep) * (crit ? p.critMult : 1);
          const pts = Math.max(0, Math.round((p.points + (p.bonusVar ? +s.vars[p.bonusVar] || 0 : 0)) * mult * 100) / 100);
          s.addVar(p.var || 'score', pts); s.setVar('combo', combo);
          s.engine.audio.sfx(crit ? 'power' : p.sound); s.engine.vibrate(crit ? 25 : 8);
          if (p.popup) popText(s, t.x, t.y - 20, (crit ? 'CRIT +' : '+') + formatNumber(pts), crit ? '#ff5d8f' : '#ffd23d', crit ? 34 : 24 + Math.min(10, combo / 3));
          squash(s, e, crit ? 0.8 : 0.9);
          if (crit) s.burst(e.x, e.y, e.z, '#ff5d8f', 14, 0.8);
        }
      },
    };
  },
});

registerBehavior('longPress', {
  label: 'Long Press', description: 'Hold a finger on it for a moment to do something. A ring fills up while you hold.',
  params: [{ key: 'seconds', label: 'Hold for (seconds)', type: 'number', default: 0.8, step: 0.1, range: [0.2, 5] }, ...ACTION_PARAMS.map((q) => (q.key === 'value' ? { ...q, default: 'Held!' } : q))],
  create(p) {
    let held = null, t = 0, fired = false, ref = null;
    return {
      uiAlways: true,
      start(e, s) { (s.overlays ||= []).push(ref = (ctx) => {
        if (!held || fired || e.dead) return;
        const c = screenOf(s, e); if (!c) return;
        ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(c.x, c.y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, t / p.seconds)); ctx.stroke(); ctx.restore();
      }); },
      update(e, dt, s) {
        const inp = s.engine.input;
        if (!held) { const d = inp.downs.find((q) => e.visible && hitTest(s, e, q.x, q.y)); if (d) { held = d.id; t = 0; fired = false; } return; }
        const ptr = inp.pointers.get(held);
        if (!ptr || !hitTest(s, e, ptr.x, ptr.y)) { held = null; return; } // let go or slid off
        t += dt;
        if (!fired && t >= p.seconds) { fired = true; s.engine.vibrate(30); squash(s, e, 0.85); if (p.sound && p.sound !== 'none') s.engine.audio.sfx(p.sound); runAction(s, e, p); }
      },
      destroy(e, s) { s.overlays = (s.overlays || []).filter((f) => f !== ref); },
    };
  },
});

registerBehavior('doubleTap', {
  label: 'Double Tap', description: 'Tap it twice quickly to do something.',
  params: [{ key: 'gap', label: 'Max time between taps', type: 'number', default: 0.35, step: 0.05, range: [0.15, 1] }, ...ACTION_PARAMS.map((q) => (q.key === 'value' ? { ...q, default: 'Double tap!' } : q))],
  create(p) {
    let last = -99;
    return {
      uiAlways: true,
      update(e, dt, s) {
        for (const t of tapsOn(s, e)) {
          if (s.time - last <= p.gap) { last = -99; squash(s, e, 0.85); s.engine.vibrate(15); if (p.sound && p.sound !== 'none') s.engine.audio.sfx(p.sound); runAction(s, e, p); }
          else last = s.time;
        }
      },
    };
  },
});

registerBehavior('tapToggle', {
  label: 'Tap Toggle', description: 'Each tap switches it on or off: sets a variable to 1 or 0, swaps its colour, and can show or hide another object.',
  params: [
    { key: 'var', label: 'Variable (1 = on, 0 = off)', type: 'text', default: 'switch', suggest: 'vars' },
    { key: 'startOn', label: 'Starts on', type: 'bool', default: false },
    { key: 'onColor', label: 'Colour when on', type: 'color', default: '#66bb6a' },
    { key: 'offColor', label: 'Colour when off', type: 'color', default: '#78909c' },
    { key: 'object', label: 'Shows / hides object (optional)', type: 'text', default: '', suggest: 'objects' },
    { key: 'message', label: 'Sends “<message> on” / “off” (optional)', type: 'text', default: '', suggest: 'messages' },
  ],
  create(p) {
    let on = false;
    const apply = (e, s) => {
      s.setVar(p.var || 'switch', on ? 1 : 0);
      const c = on ? p.onColor : p.offColor; if (e.shape) e.shape.fill = c; else if (e.mesh) e.mesh.color = c;
      if (p.object) { const t = s.find(p.object); if (t) t.visible = on; }
    };
    return {
      uiAlways: true,
      start(e, s) { on = !!p.startOn; apply(e, s); },
      update(e, dt, s) {
        for (const t of tapsOn(s, e)) { on = !on; apply(e, s); squash(s, e); s.engine.audio.sfx('click'); s.engine.vibrate(10); if (p.message) s.send(`${p.message} ${on ? 'on' : 'off'}`); }
      },
    };
  },
});

registerBehavior('pressFeedback', {
  label: 'Press Feedback', description: 'Makes tapping feel good: squashes the moment a finger lands, springs back on release, with a sound, a buzz and optional sparkles.',
  params: [
    { key: 'squash', label: 'Squash to', type: 'number', default: 0.88, step: 0.02, range: [0.5, 1] },
    { key: 'sound', label: 'Sound', type: 'select', options: ['none', ...SOUNDS], default: 'click' },
    { key: 'haptic', label: 'Buzz', type: 'bool', default: true },
    { key: 'sparkles', label: 'Sparkles', type: 'bool', default: false },
  ],
  create(p) {
    let held = null;
    return {
      uiAlways: true,
      update(e, dt, s) {
        const inp = s.engine.input, base = e.data.baseScale ??= e.sx;
        if (held == null) {
          const d = inp.downs.find((q) => e.visible && hitTest(s, e, q.x, q.y)); if (!d) return;
          held = d.id; s.killTweens(e); e.sx = e.sy = base * p.squash;
          if (p.sound !== 'none') s.engine.audio.sfx(p.sound); if (p.haptic) s.engine.vibrate(8);
          if (p.sparkles) s.burst(e.x, e.y, e.z, e.shape?.fill || e.mesh?.color || '#fff', 10, 0.6);
        } else if (!inp.pointers.has(held)) { held = null; s.tween(e, { sx: base, sy: base }, 0.22, 'outBack'); }
      },
    };
  },
});

registerBehavior('tapToSpawn', {
  label: 'Tap to Spawn', description: 'Tapping the screen creates a copy of a template where you tapped (on the ground in 3D). Put it on any object; it listens to the whole screen.',
  params: [
    { key: 'template', label: 'Template', type: 'template', default: '' },
    { key: 'where', label: 'Taps on', type: 'select', options: [['empty', 'Empty space only'], ['anywhere', 'Anywhere']], default: 'empty' },
    { key: 'cooldown', label: 'Cooldown (seconds)', type: 'number', default: 0.2, step: 0.1 },
    { key: 'max', label: 'Max at once (0 = no limit)', type: 'number', default: 20 },
    { key: 'cost', label: 'Costs (from variable)', type: 'number', default: 0, info: 'e.g. 5 coins per spawn. Leave 0 for free.' },
    { key: 'costVar', label: 'Pay with', type: 'text', default: 'score', suggest: 'vars', showIf: (b) => +b.cost > 0 },
  ],
  create(p) {
    let last = -99; const made = [];
    return {
      update(e, dt, s) {
        if (!p.template || s.state !== 'play') return;
        for (const t of s.engine.input.taps) {
          if (s.time - last < p.cooldown) continue;
          if (p.where === 'empty' && s.entities.some((q) => q !== e && q.visible && !q.dead && (q.shape || q.mesh || q.sprite || q.ui) && hitTest(s, q, t.x, t.y))) continue;
          for (let i = made.length - 1; i >= 0; i--) if (made[i].dead) made.splice(i, 1);
          if (p.max > 0 && made.length >= p.max) { s.message('Too many!', 0.8); continue; }
          if (p.cost > 0) { if ((+s.vars[p.costVar] || 0) < p.cost) { s.message(`Need ${formatNumber(p.cost)} ${p.costVar}`, 1); continue; } s.addVar(p.costVar, -p.cost); }
          let at;
          if (s.mode === '3d') { const r = s.engine.renderer.screenRay(s, t.x, t.y); if (!r || Math.abs(r.dir.y) < 1e-4) continue; const k = -r.origin.y / r.dir.y; if (k < 0) continue; at = { x: r.origin.x + r.dir.x * k, y: 0.5, z: r.origin.z + r.dir.z * k }; }
          else { const w = s.engine.renderer.screenToWorld(s, t.x, t.y); at = { x: w.x, y: w.y, z: 0 }; }
          const c = s.spawn(p.template, at); if (c) { made.push(c); last = s.time; s.engine.vibrate(8); }
        }
      },
    };
  },
});

registerBehavior('dragLaunch', {
  label: 'Drag to Launch', description: 'Slingshot: pull back from it and let go to fling it (Angry Birds, golf, pool). An aim line shows the shot.',
  params: [
    { key: 'power', label: 'Power', type: 'number', default: 6, step: 0.5, range: [0.5, 30] },
    { key: 'maxPull', label: 'Max pull (pixels)', type: 'number', default: 140, step: 10 },
    { key: 'shots', label: 'Shots (0 = no limit)', type: 'number', default: 0 },
    { key: 'whileStill', label: 'Only when it has stopped', type: 'bool', default: true },
    { key: 'shotsVar', label: 'Count shots in variable', type: 'text', default: 'shots', suggest: 'vars' },
  ],
  create(p) {
    let held = null, used = 0, ref = null;
    const pull = (s, e) => { const ptr = s.engine.input.pointers.get(held), c = screenOf(s, e); if (!ptr || !c) return null; let dx = c.x - ptr.x, dy = c.y - ptr.y; const d = Math.hypot(dx, dy); if (d > p.maxPull) { dx *= p.maxPull / d; dy *= p.maxPull / d; } return { c, dx, dy }; };
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic' });
        (s.overlays ||= []).push(ref = (ctx) => {
          if (held == null || e.dead) return;
          const q = pull(s, e); if (!q) return;
          ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([2, 10]); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.c.x, q.c.y); ctx.lineTo(q.c.x + q.dx * 1.6, q.c.y + q.dy * 1.6); ctx.stroke();
          ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(q.c.x, q.c.y); ctx.lineTo(q.c.x - q.dx, q.c.y - q.dy); ctx.stroke();
          ctx.fillStyle = '#ffd23d'; ctx.beginPath(); ctx.arc(q.c.x + q.dx * 1.6, q.c.y + q.dy * 1.6, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        });
      },
      update(e, dt, s) {
        if (s.state !== 'play') return;
        const inp = s.engine.input, b = e.body;
        if (held == null) {
          if (p.shots > 0 && used >= p.shots) return;
          if (p.whileStill && b && Math.hypot(b.vel.x, b.vel.y, b.vel.z) > (s.mode === '3d' ? 0.3 : 20)) return;
          const d = inp.downs.find((q) => hitTest(s, e, q.x, q.y)); if (d) held = d.id;
          return;
        }
        if (inp.pointers.has(held)) return;
        // released: launch opposite the pull
        const up = inp.ups.find((u) => u.id === held); held = null;
        const c = screenOf(s, e); if (!up || !c) return;
        let dx = c.x - up.x, dy = c.y - up.y; const d = Math.hypot(dx, dy); if (d < 12) return;
        if (d > p.maxPull) { dx *= p.maxPull / d; dy *= p.maxPull / d; }
        const k = p.power * (s.mode === '3d' ? 0.06 : 1);
        if (s.mode === '3d') { b.vel.x = dx * k; b.vel.z = dy * k; b.vel.y = Math.hypot(dx, dy) * k * 0.35; } else { b.vel.x = dx * k; b.vel.y = dy * k; }
        used++; if (p.shotsVar) s.addVar(p.shotsVar, 1);
        s.engine.audio.sfx('jump'); s.engine.vibrate(15);
      },
      destroy(e, s) { s.overlays = (s.overlays || []).filter((f) => f !== ref); },
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

// ---- node-based visual scripting ----
const num = (k, d = 0, label) => ({ key: k, type: 'number', default: d, label: label || k });
const txt = (k, d = '', label) => ({ key: k, type: 'text', default: d, label: label || k });
const opt = (k, options, d, label) => ({ key: k, type: 'select', options, default: d ?? options[0], label: label || k });
/**
 * Node types. Events start a flow (white "exec" wires); actions run in order; values feed numbers/booleans
 * into inputs (blue/orange wires). Unwired inputs use the value typed on the node.
 */
/** The closest live object with this name or tag (not `e` itself). */
function nearest(s, e, key) {
  if (!key) return null;
  const named = s.find(key); if (named && named !== e && !named.dead) return named;
  let best = null, bd = Infinity;
  for (const q of s.findAll(key)) { if (q === e || q.dead) continue; const d = Math.hypot(q.x - e.x, q.y - e.y, q.z - e.z); if (d < bd) { bd = d; best = q; } }
  return best;
}
export const NODE_TYPES = {
  // events
  start: { cat: 'Events', label: 'On Start', outs: ['then'] },
  update: { cat: 'Events', label: 'Every Frame', outs: ['then'] },
  every: { cat: 'Events', label: 'Every N Seconds', outs: ['then'], params: [num('seconds', 1, 'seconds')] },
  touch: { cat: 'Events', label: 'On Touch', outs: ['then'], params: [txt('tag', 'player', 'by tag')] },
  tap: { cat: 'Events', label: 'On Tap', outs: ['then'] },
  button: { cat: 'Events', label: 'On Button', outs: ['then'], params: [opt('button', ['jump', 'fire'], 'jump', 'button')] },
  swipe: { cat: 'Events', label: 'On Swipe', outs: ['then'], params: [opt('dir', ['up', 'down', 'left', 'right'], 'up', 'direction')] },
  destroyed: { cat: 'Events', label: 'On Destroyed', outs: ['then'] },
  onMessage: { cat: 'Events', label: 'On Message', outs: ['then'], params: [txt('message', 'go', 'message')] },
  touchEnd: { cat: 'Events', label: 'On Touch End', outs: ['then'], params: [txt('tag', 'player', 'by tag')] },
  varChanged: { cat: 'Events', label: 'On Variable Changed', outs: ['then'], params: [txt('name', 'score', 'variable')] },
  damaged: { cat: 'Events', label: 'On Damaged', outs: ['then'] },
  death: { cat: 'Events', label: 'On Death', outs: ['then'] },
  holding: { cat: 'Events', label: 'While Touching Screen', outs: ['then'] },
  released: { cat: 'Events', label: 'On Finger Lifted', outs: ['then'] },
  onWin: { cat: 'Events', label: 'On Win', outs: ['then'] },
  onGameOver: { cat: 'Events', label: 'On Game Over', outs: ['then'] },
  stateEntered: { cat: 'Events', label: 'On State Entered', outs: ['then'], params: [txt('state', 'Idle', 'state (blank = any)')] },
  animEnd: { cat: 'Animation', label: 'On Animation End', outs: ['then'], params: [txt('clip', '', 'clip (blank = any)')] },
  // flow
  branch: { cat: 'Flow', label: 'If', exec: true, inputs: [{ key: 'condition', type: 'bool', default: true }], outs: ['true', 'false'] },
  wait: { cat: 'Flow', label: 'Wait', exec: true, outs: ['then'], inputs: [{ key: 'seconds', type: 'number', default: 1 }] },
  chance: { cat: 'Flow', label: 'Random Chance', exec: true, outs: ['yes', 'no'], inputs: [{ key: 'percent', type: 'number', default: 50 }] },
  once: { cat: 'Flow', label: 'Do Once', exec: true, outs: ['then'] },
  sequence: { cat: 'Flow', label: 'Sequence', exec: true, outs: ['first', 'second', 'third'] },
  loop: { cat: 'Flow', label: 'Repeat N Times', exec: true, outs: ['each', 'done'], inputs: [{ key: 'count', type: 'number', default: 3 }] },
  flipFlop: { cat: 'Flow', label: 'Flip Flop', exec: true, outs: ['A', 'B'] },
  cooldown: { cat: 'Flow', label: 'Cooldown', exec: true, outs: ['then', 'blocked'], inputs: [{ key: 'seconds', type: 'number', default: 1 }] },
  countTo: { cat: 'Flow', label: 'Count To', exec: true, outs: ['reached', 'not yet'], inputs: [{ key: 'times', type: 'number', default: 3 }], params: [opt('after', ['start over', 'stay done'], 'start over', 'then')] },
  randomBranch: { cat: 'Flow', label: 'Random Branch', exec: true, outs: ['1', '2', '3'] },
  switchNum: { cat: 'Flow', label: 'Switch on Number', exec: true, outs: ['0', '1', '2', '3', 'other'], inputs: [{ key: 'value', type: 'number', default: 0 }] },
  compareBranch: { cat: 'Flow', label: 'Compare Branch', exec: true, outs: ['yes', 'no'], inputs: [{ key: 'a', type: 'number', default: 0 }, { key: 'b', type: 'number', default: 0 }], params: [opt('op', ['≥', '≤', '=', '>', '<', '≠'], '≥', 'is')] },
  // actions
  setVar: { cat: 'Actions', label: 'Set Variable', exec: true, outs: ['then'], params: [txt('name', 'score', 'variable')], inputs: [{ key: 'value', type: 'number', default: 0 }] },
  addVar: { cat: 'Actions', label: 'Add to Variable', exec: true, outs: ['then'], params: [txt('name', 'score', 'variable')], inputs: [{ key: 'amount', type: 'number', default: 1 }] },
  message: { cat: 'Actions', label: 'Show Message', exec: true, outs: ['then'], params: [txt('text', 'Hello! Score: {score}', 'text'), num('seconds', 2, 'seconds')] },
  log: { cat: 'Actions', label: 'Debug Log', exec: true, outs: ['then'], params: [txt('text', 'score is {score}', 'text')] },
  sound: { cat: 'Actions', label: 'Play Sound', exec: true, outs: ['then'], params: [opt('sound', SOUNDS, 'coin', 'sound')] },
  spawn: { cat: 'Actions', label: 'Spawn Template', exec: true, outs: ['then'], params: [txt('template', '', 'template')] },
  destroy: { cat: 'Actions', label: 'Destroy', exec: true, outs: ['then'], params: [opt('target', ['self', 'other'], 'self', 'who')] },
  moveBy: { cat: 'Actions', label: 'Move By', exec: true, outs: ['then'], inputs: [{ key: 'x', type: 'number', default: 0 }, { key: 'y', type: 'number', default: 0 }, { key: 'z', type: 'number', default: 0 }] },
  setVelocity: { cat: 'Actions', label: 'Set Velocity', exec: true, outs: ['then'], inputs: [{ key: 'x', type: 'number', default: 0 }, { key: 'y', type: 'number', default: 0 }, { key: 'z', type: 'number', default: 0 }] },
  jump: { cat: 'Actions', label: 'Jump', exec: true, outs: ['then'], inputs: [{ key: 'power', type: 'number', default: 600 }] },
  showHide: { cat: 'Actions', label: 'Show / Hide Object', exec: true, outs: ['then'], params: [txt('object', '', 'object name'), opt('mode', ['show', 'hide', 'toggle'], 'toggle', 'make it')] },
  vibrate: { cat: 'Actions', label: 'Vibrate', exec: true, outs: ['then'] },
  shake: { cat: 'Actions', label: 'Camera Shake', exec: true, outs: ['then'], inputs: [{ key: 'strength', type: 'number', default: 10 }] },
  win: { cat: 'Actions', label: 'Win', exec: true, outs: [] },
  gameOver: { cat: 'Actions', label: 'Game Over', exec: true, outs: [] },
  nextLevel: { cat: 'Actions', label: 'Next Level', exec: true, outs: [] },
  restart: { cat: 'Actions', label: 'Restart Game', exec: true, outs: [] },
  saveGame: { cat: 'Actions', label: 'Save Game', exec: true, outs: ['then'], params: [num('slot', 1, 'slot'), txt('text', 'Game saved', 'message')] },
  loadGame: { cat: 'Actions', label: 'Load Game', exec: true, outs: ['then', 'no save'], params: [num('slot', 1, 'slot')] },
  deleteSave: { cat: 'Actions', label: 'Delete Save', exec: true, outs: ['then'], params: [num('slot', 1, 'slot')] },
  push: { cat: 'Actions', label: 'Push (add velocity)', exec: true, outs: ['then'], params: [opt('target', ['self', 'other'], 'self', 'who')], inputs: [{ key: 'x', type: 'number', default: 0 }, { key: 'y', type: 'number', default: -400 }, { key: 'z', type: 'number', default: 0 }] },
  setGravity: { cat: 'Actions', label: 'Set Gravity', exec: true, outs: ['then'], inputs: [{ key: 'y', type: 'number', default: 1600 }, { key: 'x', type: 'number', default: 0 }] },
  switchCamera: { cat: 'Actions', label: 'Switch Camera', exec: true, outs: ['then'], params: [txt('camera', 'Camera', 'camera object')] },
  zoomCamera: { cat: 'Actions', label: 'Zoom Camera (2D)', exec: true, outs: ['then'], inputs: [{ key: 'zoom', type: 'number', default: 1.5 }], params: [num('seconds', 0.5, 'seconds')] },
  setLight: { cat: 'Actions', label: 'Set Light', exec: true, outs: ['then'], params: [txt('object', '', 'object (empty = this)'), opt('mode', ['on', 'off', 'toggle'], 'toggle', 'make it')], inputs: [{ key: 'intensity', type: 'number', default: 1 }] },
  tweenTo: { cat: 'Actions', label: 'Tween', exec: true, outs: ['then', 'finished'], params: [opt('prop', ['x', 'y', 'z', 'rz', 'ry', 'scale', 'alpha'], 'y', 'property'), opt('mode', ['by', 'to'], 'by', 'mode'), opt('ease', EASES, 'outQuad', 'ease')], inputs: [{ key: 'value', type: 'number', default: -40 }, { key: 'seconds', type: 'number', default: 0.5 }] },
  punch: { cat: 'Actions', label: 'Punch', exec: true, outs: ['then'], params: [opt('what', ['scale', 'position', 'rotation'], 'scale', 'what'), opt('target', ['self', 'other'], 'self', 'who')], inputs: [{ key: 'amount', type: 'number', default: 0.3 }, { key: 'seconds', type: 'number', default: 0.4 }] },
  killTweens: { cat: 'Actions', label: 'Stop Tweens', exec: true, outs: ['then'] },
  playAnim: { cat: 'Animation', label: 'Play Animation', exec: true, outs: ['then'], params: [txt('clip', 'Bounce', 'clip'), opt('loop', ['clip setting', 'loop', 'once'], 'clip setting', 'repeat')] },
  stopAnim: { cat: 'Animation', label: 'Stop Animation', exec: true, outs: ['then'] },
  animSpeed: { cat: 'Animation', label: 'Set Animation Speed', exec: true, outs: ['then'], inputs: [{ key: 'speed', type: 'number', default: 2 }] },
  setFrame: { cat: 'Animation', label: 'Show Sprite Frame', exec: true, outs: ['then'], inputs: [{ key: 'frame', type: 'number', default: 0 }] },
  flipX: { cat: 'Animation', label: 'Flip Sprite', exec: true, outs: ['then'], params: [opt('mode', ['face left', 'face right', 'toggle'], 'toggle', 'make it')] },
  fadeTo: { cat: 'Animation', label: 'Fade To', exec: true, outs: ['then', 'finished'], inputs: [{ key: 'alpha', type: 'number', default: 0 }, { key: 'seconds', type: 'number', default: 0.5 }] },
  blink: { cat: 'Animation', label: 'Blink', exec: true, outs: ['then'], inputs: [{ key: 'seconds', type: 'number', default: 1 }] },
  sendMessage: { cat: 'Actions', label: 'Send Message', exec: true, outs: ['then'], params: [txt('message', 'go', 'message')] },
  impulse: { cat: 'Actions', label: 'Camera Impulse', exec: true, outs: ['then'], inputs: [{ key: 'strength', type: 'number', default: 12 }] },
  toggleVar: { cat: 'Actions', label: 'Toggle Variable (0 ↔ 1)', exec: true, outs: ['then'], params: [txt('name', 'on', 'variable')] },
  setBackground: { cat: 'Looks', label: 'Set Background', exec: true, outs: ['then'], params: [{ key: 'color', type: 'color', default: '#20304a', label: 'colour' }] },
  setAlpha: { cat: 'Looks', label: 'Set Opacity', exec: true, outs: ['then'], inputs: [{ key: 'alpha', type: 'number', default: 0.5 }] },
  stopMoving: { cat: 'Move', label: 'Stop Moving', exec: true, outs: ['then'], params: [opt('target', ['self', 'other'], 'self', 'who')] },
  gravityScale: { cat: 'Move', label: 'Set Gravity Scale', exec: true, outs: ['then'], inputs: [{ key: 'scale', type: 'number', default: 0 }] },
  setDarkness: { cat: 'Actions', label: 'Set Darkness (2D)', exec: true, outs: ['then'], inputs: [{ key: 'darkness', type: 'number', default: 0.8 }] },
  setPosition: { cat: 'Move', label: 'Set Position', exec: true, outs: ['then'], inputs: [{ key: 'x', type: 'number', default: 0 }, { key: 'y', type: 'number', default: 0 }, { key: 'z', type: 'number', default: 0 }], params: [opt('target', ['self', 'other'], 'self', 'who')] },
  moveToward: { cat: 'Move', label: 'Move Toward', exec: true, outs: ['then', 'arrived'], inputs: [{ key: 'speed', type: 'number', default: 120 }], params: [txt('tag', 'player', 'tag')] },
  lookAt: { cat: 'Move', label: 'Look At', exec: true, outs: ['then'], params: [txt('tag', 'player', 'tag')] },
  rotateBy: { cat: 'Move', label: 'Rotate By', exec: true, outs: ['then'], inputs: [{ key: 'degrees', type: 'number', default: 15 }] },
  setScale: { cat: 'Move', label: 'Set Scale', exec: true, outs: ['then'], inputs: [{ key: 'scale', type: 'number', default: 1 }] },
  teleport: { cat: 'Move', label: 'Teleport To', exec: true, outs: ['then'], params: [txt('object', '', 'object or tag')] },
  setText: { cat: 'Looks', label: 'Set Text', exec: true, outs: ['then'], params: [txt('object', '', 'object (blank = me)'), txt('text', 'Score: {score}', 'text')] },
  setColor: { cat: 'Looks', label: 'Set Colour', exec: true, outs: ['then'], params: [{ key: 'color', type: 'color', default: '#ff5252', label: 'colour' }, opt('target', ['self', 'other'], 'self', 'who')] },
  particles: { cat: 'Looks', label: 'Particle Burst', exec: true, outs: ['then'], params: [{ key: 'color', type: 'color', default: '#ffd54f', label: 'colour' }], inputs: [{ key: 'count', type: 'number', default: 20 }] },
  spawnAt: { cat: 'Objects', label: 'Spawn At', exec: true, outs: ['then'], params: [txt('template', '', 'template'), txt('at', 'player', 'at object or tag')] },
  destroyTag: { cat: 'Objects', label: 'Destroy All With Tag', exec: true, outs: ['then'], params: [txt('tag', 'enemy', 'tag')] },
  tagOp: { cat: 'Objects', label: 'Add / Remove Tag', exec: true, outs: ['then'], params: [txt('tag', 'marked', 'tag'), opt('mode', ['add', 'remove'], 'add', 'do')] },
  slowMo: { cat: 'Game', label: 'Slow Motion', exec: true, outs: ['then'], inputs: [{ key: 'speed', type: 'number', default: 0.3 }, { key: 'seconds', type: 'number', default: 1 }] },
  damage: { cat: 'Game', label: 'Damage', exec: true, outs: ['then'], inputs: [{ key: 'amount', type: 'number', default: 1 }], params: [opt('target', ['self', 'other'], 'other', 'who')] },
  heal: { cat: 'Game', label: 'Heal', exec: true, outs: ['then'], inputs: [{ key: 'amount', type: 'number', default: 1 }], params: [opt('target', ['self', 'other'], 'self', 'who')] },
  giveItem: { cat: 'Game', label: 'Give Item', exec: true, outs: ['then'], params: [txt('item', 'key', 'item')], inputs: [{ key: 'count', type: 'number', default: 1 }] },
  // values
  number: { cat: 'Values', label: 'Number', value: 'number', params: [num('value', 1, 'value')] },
  getVar: { cat: 'Values', label: 'Get Variable', value: 'number', params: [txt('name', 'score', 'variable')] },
  random: { cat: 'Values', label: 'Random Number', value: 'number', params: [num('min', 0, 'min'), num('max', 10, 'max')] },
  math: { cat: 'Values', label: 'Math', value: 'number', inputs: [{ key: 'a', type: 'number', default: 0 }, { key: 'b', type: 'number', default: 0 }], params: [opt('op', ['+', '−', '×', '÷', 'min', 'max'], '+', 'operation')] },
  compare: { cat: 'Values', label: 'Compare', value: 'bool', inputs: [{ key: 'a', type: 'number', default: 0 }, { key: 'b', type: 'number', default: 0 }], params: [opt('op', ['≥', '≤', '=', '>', '<', '≠'], '≥', 'is')] },
  and: { cat: 'Values', label: 'And', value: 'bool', inputs: [{ key: 'a', type: 'bool', default: true }, { key: 'b', type: 'bool', default: true }] },
  or: { cat: 'Values', label: 'Or', value: 'bool', inputs: [{ key: 'a', type: 'bool', default: false }, { key: 'b', type: 'bool', default: false }] },
  not: { cat: 'Values', label: 'Not', value: 'bool', inputs: [{ key: 'a', type: 'bool', default: false }] },
  position: { cat: 'Values', label: 'My Position', value: 'number', params: [opt('axis', ['x', 'y', 'z'], 'x', 'axis')] },
  distance: { cat: 'Values', label: 'Distance To', value: 'number', params: [txt('tag', 'player', 'tag')] },
  time: { cat: 'Values', label: 'Game Time', value: 'number' },
  hasSave: { cat: 'Values', label: 'Has Saved Game', value: 'bool', params: [num('slot', 1, 'slot')] },
  grounded: { cat: 'Values', label: 'Is On Ground', value: 'bool' },
  velocity: { cat: 'Values', label: 'My Velocity', value: 'number', params: [opt('axis', ['x', 'y', 'z', 'speed'], 'x', 'axis')] },
  touching: { cat: 'Values', label: 'Is Touching', value: 'bool', params: [txt('tag', 'player', 'tag')] },
  canSee: { cat: 'Values', label: 'Can See', value: 'bool', params: [txt('tag', 'player', 'tag'), num('range', 0, 'range (0 = any)')] },
  math1: { cat: 'Math', label: 'Math (one value)', value: 'number', inputs: [{ key: 'a', type: 'number', default: 0 }], params: [opt('op', ['abs', 'round', 'floor', 'ceil', 'sqrt', 'negate', 'sin', 'cos'], 'abs', 'operation')] },
  clamp: { cat: 'Math', label: 'Clamp', value: 'number', inputs: [{ key: 'value', type: 'number', default: 0 }, { key: 'min', type: 'number', default: 0 }, { key: 'max', type: 'number', default: 10 }] },
  lerp: { cat: 'Math', label: 'Lerp (blend)', value: 'number', inputs: [{ key: 'a', type: 'number', default: 0 }, { key: 'b', type: 'number', default: 10 }, { key: 't', type: 'number', default: 0.5 }] },
  loopIndex: { cat: 'Math', label: 'Loop Index', value: 'number' },
  angleTo: { cat: 'Values', label: 'Angle To', value: 'number', params: [txt('tag', 'player', 'tag')] },
  countTag: { cat: 'Values', label: 'Count With Tag', value: 'number', params: [txt('tag', 'enemy', 'tag')] },
  exists: { cat: 'Values', label: 'Object Exists', value: 'bool', params: [txt('object', 'Boss', 'object or tag')] },
  health: { cat: 'Values', label: 'My Health', value: 'number' },
  itemCount: { cat: 'Values', label: 'Item Count', value: 'number', params: [txt('item', 'key', 'item')] },
  joystick: { cat: 'Values', label: 'Joystick', value: 'number', params: [opt('axis', ['x', 'y'], 'x', 'axis')] },
  screen: { cat: 'Values', label: 'Screen Size', value: 'number', params: [opt('what', ['width', 'height'], 'width', 'what')] },
  isMoving: { cat: 'Values', label: 'Is Moving', value: 'bool' },
  isHolding: { cat: 'Values', label: 'Finger On Screen', value: 'bool' },
  touchPos: { cat: 'Values', label: 'Finger Position', value: 'number', params: [opt('axis', ['x', 'y'], 'x', 'axis')] },
  coinFlip: { cat: 'Values', label: 'Coin Flip', value: 'bool' },
  level: { cat: 'Values', label: 'Level Number', value: 'number' },
  animPlaying: { cat: 'Animation', label: 'Is Animation Playing', value: 'bool', params: [txt('clip', '', 'clip (blank = any)')] },
  spriteFrame: { cat: 'Animation', label: 'Sprite Frame', value: 'number' },
};

// ---- Logic library (PlayMaker / Game Creator style): events → conditions → instructions ----
const bool = (k, d = false, label) => ({ key: k, type: 'bool', default: d, label: label || k });
const sug = (prm, kind) => ({ ...prm, suggest: kind });
const OPS6 = ['=', '≠', '>', '<', '≥', '≤'];
const cmp = (a, op, b) => ({ '=': a === b, '≠': a !== b, '>': a > b, '<': a < b, '≥': a >= b, '≤': a <= b }[op] ?? false);
const fmtVal = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
/** Events that start trigger lists or FSM transitions. */
export const LOGIC_EVENTS = {
  start: { label: 'Game starts', icon: 'play' },
  every: { label: 'Every few seconds', icon: 'clock', params: [num('seconds', 1, 'seconds')], say: (p) => `Every ${p.seconds}s` },
  tap: { label: 'Tapped', icon: 'hand' },
  touch: { label: 'Touched by tag', icon: 'player', params: [sug(txt('tag', 'player', 'tag'), 'tags')], say: (p) => `Touched by ${p.tag}` },
  touchEnd: { label: 'Stops touching tag', icon: 'player', params: [sug(txt('tag', 'player', 'tag'), 'tags')], say: (p) => `Stops touching ${p.tag}` },
  button: { label: 'Button pressed', icon: 'gamepad', params: [opt('button', ['jump', 'fire'], 'jump', 'button')], say: (p) => `${p.button} button` },
  swipe: { label: 'Swiped', icon: 'arrow', params: [opt('dir', ['up', 'down', 'left', 'right'], 'up', 'direction')], say: (p) => `Swiped ${p.dir}` },
  message: { label: 'Message received', icon: 'sign', params: [sug(txt('message', 'go', 'message'), 'messages')], say: (p) => `Message “${p.message}”` },
  variable: { label: 'Variable reaches', icon: 'trophy', params: [sug(txt('name', 'score', 'variable'), 'vars'), opt('op', OPS6, '≥', 'is'), num('value', 10, 'value')], say: (p) => `${p.name} ${p.op} ${p.value}` },
  destroyed: { label: 'Destroyed', icon: 'trash' },
  animEnd: { label: 'Animation finished', icon: 'clock', params: [sug(txt('clip', '', 'clip (empty = any)'), 'clips')], say: (p) => (p.clip ? `${p.clip} finished` : 'Animation finished') },
  always: { label: 'Every frame (while conditions are true)', icon: 'bolt', say: () => 'When conditions are true' },
  after: { label: 'After time in this state', icon: 'clock', fsm: true, params: [num('seconds', 1, 'seconds')], say: (p) => `After ${p.seconds}s` },
  finished: { label: 'When this state’s actions finish', icon: 'check', fsm: true, say: () => 'When done' },
};
/** Conditions (all must pass; each can be flipped with "not"). */
export const LOGIC_CONDITIONS = {
  variable: { label: 'Compare variable', icon: 'trophy', params: [sug(txt('name', 'score', 'variable'), 'vars'), opt('op', OPS6, '≥', 'is'), num('value', 10, 'value')], test: (c, p) => cmp(+c.s.vars[p.name] || 0, p.op, +p.value || 0), say: (p) => `${p.name} ${p.op} ${p.value}` },
  chance: { label: 'Random chance', icon: 'star', params: [num('percent', 50, 'percent')], test: (c, p) => Math.random() * 100 < +p.percent, say: (p) => `${p.percent}% chance` },
  touching: { label: 'Is touching tag', icon: 'player', params: [sug(txt('tag', 'player', 'tag'), 'tags')], test: (c, p) => c.s.engine.physics.touching(c.e, p.tag), say: (p) => `touching ${p.tag}` },
  grounded: { label: 'Is on the ground', icon: 'platform', test: (c) => !!c.e.body?.grounded, say: () => 'on the ground' },
  near: { label: 'Distance to tag', icon: 'crosshair', params: [sug(txt('tag', 'player', 'tag'), 'tags'), opt('op', ['<', '>'], '<', 'is'), num('value', 150, 'distance')], test: (c, p) => { const t = c.s.findAll(p.tag).find((q) => q !== c.e); const d = t ? Math.hypot(t.x - c.e.x, t.y - c.e.y, t.z - c.e.z) : Infinity; return p.op === '<' ? d < +p.value : d > +p.value; }, say: (p) => `${p.tag} ${p.op === '<' ? 'closer than' : 'further than'} ${p.value}` },
  canSee: { label: 'Can see tag', icon: 'eye', params: [sug(txt('tag', 'player', 'tag'), 'tags')], test: (c, p) => { const t = c.s.findAll(p.tag).find((q) => q !== c.e); return !!t && c.s.canSee(c.e, t); }, say: (p) => `can see ${p.tag}` },
  exists: { label: 'Object exists', icon: 'cube', params: [sug(txt('object', '', 'object'), 'objects')], test: (c, p) => !!c.s.find(p.object), say: (p) => `${p.object} exists` },
  visible: { label: 'Is visible', icon: 'eye', params: [sug(txt('object', '', 'object (empty = this)'), 'objects')], test: (c, p) => !!(p.object ? c.s.find(p.object) : c.e)?.visible, say: (p) => `${p.object || 'this'} is visible` },
  state: { label: 'State is', icon: 'nodes', params: [txt('state', 'Idle', 'state')], test: (c, p) => c.e.data.state === p.state, say: (p) => `state is ${p.state}` },
  hasSave: { label: 'Has saved game', icon: 'save', params: [num('slot', 1, 'slot')], test: (c, p) => c.s.hasSave(+p.slot || 1), say: () => 'has a save' },
  hasItem: { label: 'Has item', icon: 'key', params: [txt('item', 'Key', 'item'), num('count', 1, 'at least')], test: (c, p) => c.s.itemCount(p.item) >= (+p.count || 1), say: (p) => `has ${p.count} ${p.item}` },
  playing: { label: 'Game is playing', icon: 'play', test: (c) => c.s.state === 'play' && !c.s.engine.paused, say: () => 'game is playing' },
};
const target = (c, name) => (!name || name === 'self' ? c.e : name === 'other' ? c.other : c.s.find(name) || c.s.findAll(name)[0]);
const obj = (k = 'object', label = 'object (empty = this)') => sug(txt(k, '', label), 'objects');
/** Instructions, run top to bottom. Returning a number waits that many seconds before the next one. */
export const LOGIC_ACTIONS = {
  // variables & score
  setVar: { cat: 'Variables', label: 'Change variable', icon: 'trophy', params: [sug(txt('name', 'score', 'variable'), 'vars'), opt('op', ['add', 'set', 'subtract', 'multiply'], 'add', 'how'), num('value', 1, 'value')],
    run: (c, p) => { const v = +p.value || 0, k = p.name || 'score', cur = +c.s.vars[k] || 0; c.s.setVar(k, p.op === 'set' ? v : p.op === 'subtract' ? cur - v : p.op === 'multiply' ? cur * v : cur + v); },
    say: (p) => ({ add: `Add ${p.value} to ${p.name}`, set: `Set ${p.name} to ${p.value}`, subtract: `Subtract ${p.value} from ${p.name}`, multiply: `Multiply ${p.name} by ${p.value}` })[p.op] },
  // objects
  showHide: { cat: 'Objects', label: 'Show / hide object', icon: 'eye', params: [obj(), opt('mode', ['hide', 'show', 'toggle'], 'hide', 'make it')], run: (c, p) => { const t = target(c, p.object); if (t) t.visible = p.mode === 'show' ? true : p.mode === 'hide' ? false : !t.visible; }, say: (p) => `${p.mode[0].toUpperCase() + p.mode.slice(1)} ${p.object || 'this'}` },
  destroy: { cat: 'Objects', label: 'Destroy object', icon: 'trash', params: [sug(txt('object', 'self', 'object (self / other / name)'), 'objects'), bool('burst', true, 'particle burst')], run: (c, p) => { const t = target(c, p.object); if (t) { if (p.burst) c.s.burst(t.x, t.y, t.z, '#fff', 14); t.destroy(); } }, say: (p) => `Destroy ${p.object || 'self'}` },
  spawn: { cat: 'Objects', label: 'Spawn template', icon: 'spawner', params: [sug(txt('template', '', 'template'), 'templates'), num('ox', 0, 'offset x'), num('oy', 0, 'offset y')], run: (c, p) => { if (p.template) c.s.spawn(p.template, { x: c.e.x + (+p.ox || 0), y: c.e.y + (+p.oy || 0), z: c.e.z }); }, say: (p) => `Spawn ${p.template || '…'}` },
  setText: { cat: 'Objects', label: 'Set text', icon: 'text', params: [obj(), txt('text', 'Hello {score}', 'text')], run: (c, p) => { const t = target(c, p.object); if (t) { t.text ||= { ...TEXT_DEFAULTS }; t.text.value = p.text; } }, say: (p) => `Text: “${p.text}”` },
  setColor: { cat: 'Objects', label: 'Set color', icon: 'brush', params: [obj(), { key: 'color', type: 'color', default: '#ff5252', label: 'color' }, num('seconds', 0.3, 'fade time')], run: (c, p) => { const t = target(c, p.object); if (!t) return; const key = t.mesh ? 'mesh.color' : t.shape ? 'shape.fill' : 'text.color'; c.s.to(t, { [key]: p.color }, Math.max(0.01, +p.seconds || 0.01)); }, say: (p) => `Color ${p.object || 'this'} ${p.color}` },
  teleport: { cat: 'Objects', label: 'Move to object', icon: 'portal', params: [obj('to', 'object to go to')], run: (c, p) => { const t = c.s.find(p.to); if (t) { c.e.x = t.x; c.e.y = t.y; c.e.z = t.z; } }, say: (p) => `Move to ${p.to || '…'}` },
  giveItem: { cat: 'Variables', label: 'Give / use item', icon: 'key', params: [txt('item', 'Key', 'item'), num('amount', 1, 'amount (− to use up)'), txt('icon', '', 'icon (emoji)')], run: (c, p) => c.s.addItem(p.item, +p.amount || 0, p.icon), say: (p) => (+p.amount < 0 ? `Use ${-p.amount} ${p.item}` : `Give ${p.amount} ${p.item}`) },
  damage: { cat: 'Objects', label: 'Damage / heal', icon: 'heart', params: [sug(txt('object', 'other', 'who (self / other / name)'), 'objects'), num('amount', 1, 'damage (− heals)')], run: (c, p) => { const t = target(c, p.object), hb = t?.getBehavior('health'); if (hb) { if (+p.amount < 0) hb.heal(-p.amount, t); else hb.damage(+p.amount || 1, t, c.e); } }, say: (p) => (+p.amount < 0 ? `Heal ${p.object} ${-p.amount}` : `Damage ${p.object} ${p.amount}`) },
  talk: { cat: 'Game', label: 'Say dialogue', icon: 'sign', params: [txt('who', 'Guide', 'speaker'), txt('text', 'Hello there!', 'text'), bool('wait', true, 'wait until closed')], run: (c, p) => { if (!c.s.dialog) c.s.dialog = { lines: [{ who: p.who, text: fillTemplate(p.text, c.s.vars) }], i: 0, chars: 0, pause: true }; return p.wait ? { until: () => !c.s.dialog } : 0; }, say: (p) => `${p.who}: “${p.text}”` },
  // motion & animation
  moveBy: { cat: 'Motion', label: 'Move by', icon: 'move', params: [num('x', 0, 'x'), num('y', -40, 'y'), num('z', 0, 'z (3D)'), num('seconds', 0.3, 'over seconds'), opt('ease', EASES, 'outQuad', 'ease'), bool('wait', false, 'wait until done')], run: (c, p) => { const d = +p.seconds || 0; if (d <= 0) { c.e.x += +p.x || 0; c.e.y += +p.y || 0; c.e.z += +p.z || 0; return; } c.s.to(c.e, { x: +p.x || 0, y: +p.y || 0, z: +p.z || 0 }, d, { ease: p.ease, relative: true }); return p.wait ? d : 0; }, say: (p) => `Move by ${p.x}, ${p.y}${+p.z ? ', ' + p.z : ''}${+p.seconds ? ` in ${p.seconds}s` : ''}` },
  rotateBy: { cat: 'Motion', label: 'Rotate by', icon: 'rotate', params: [num('degrees', 90, 'degrees'), num('seconds', 0.3, 'over seconds'), opt('ease', EASES, 'outQuad', 'ease'), bool('wait', false, 'wait until done')], run: (c, p) => { const k = c.s.mode === '3d' ? 'ry' : 'rz', d = +p.seconds || 0; if (d <= 0) { c.e[k] += +p.degrees || 0; return; } c.s.to(c.e, { [k]: +p.degrees || 0 }, d, { ease: p.ease, relative: true }); return p.wait ? d : 0; }, say: (p) => `Rotate ${p.degrees}°` },
  scaleTo: { cat: 'Motion', label: 'Scale to', icon: 'scale', params: [num('scale', 1.5, 'scale'), num('seconds', 0.3, 'over seconds'), opt('ease', EASES, 'outBack', 'ease'), bool('wait', false, 'wait until done')], run: (c, p) => { const d = Math.max(0.01, +p.seconds || 0.01); c.s.to(c.e, { scale: +p.scale || 1 }, d, { ease: p.ease }); return p.wait ? d : 0; }, say: (p) => `Scale to ${p.scale}` },
  fade: { cat: 'Motion', label: 'Fade', icon: 'eye', params: [num('alpha', 0, 'opacity (0–1)'), num('seconds', 0.5, 'over seconds'), bool('wait', false, 'wait until done')], run: (c, p) => { const d = Math.max(0.01, +p.seconds || 0.01); c.s.to(c.e, { alpha: clamp(+p.alpha, 0, 1) }, d); return p.wait ? d : 0; }, say: (p) => `Fade to ${p.alpha}` },
  punch: { cat: 'Motion', label: 'Punch (juice)', icon: 'star', params: [opt('what', ['scale', 'position', 'rotation'], 'scale', 'what'), num('amount', 0.3, 'amount'), num('seconds', 0.4, 'seconds')], run: (c, p) => { const a = +p.amount || 0.3, three = c.s.mode === '3d'; c.s.punch(c.e, p.what === 'scale' ? (three ? { sx: a, sy: a, sz: a } : { sx: a, sy: a }) : p.what === 'rotation' ? (three ? { ry: a * 90 } : { rz: a * 90 }) : { y: three ? a : -a * 60 }, +p.seconds || 0.4); }, say: (p) => `Punch ${p.what}` },
  playAnim: { cat: 'Motion', label: 'Play animation', icon: 'clock', params: [sug(txt('clip', 'Bounce', 'clip'), 'clips')], run: (c, p) => playClip(c.e, p.clip), say: (p) => `Play “${p.clip}”` },
  // physics
  push: { cat: 'Physics', label: 'Push (add velocity)', icon: 'arrow', params: [opt('who', ['self', 'other'], 'self', 'who'), num('x', 0, 'x'), num('y', -500, 'y'), num('z', 0, 'z (3D)')], run: (c, p) => { const t = p.who === 'other' ? c.other : c.e, b = t?.ensureBody({ type: 'dynamic' }); if (b) { b.vel.x += +p.x || 0; b.vel.y += +p.y || 0; b.vel.z += +p.z || 0; } }, say: (p) => `Push ${p.who} ${p.x}, ${p.y}` },
  setVelocity: { cat: 'Physics', label: 'Set velocity', icon: 'arrow', params: [num('x', 0, 'x'), num('y', 0, 'y'), num('z', 0, 'z (3D)')], run: (c, p) => { const b = c.e.ensureBody({ type: 'dynamic' }); b.vel.x = +p.x || 0; b.vel.y = +p.y || 0; b.vel.z = +p.z || 0; }, say: (p) => `Velocity ${p.x}, ${p.y}` },
  jump: { cat: 'Physics', label: 'Jump', icon: 'jumper', params: [num('power', 600, 'power')], run: (c, p) => { if (c.e.body) { c.e.body.vel.y = (+p.power || 0) * (c.s.mode === '3d' ? 1 : -1); c.s.engine.audio.sfx('jump'); } }, say: (p) => `Jump (${p.power})` },
  setGravity: { cat: 'Physics', label: 'Set gravity', icon: 'body', params: [num('y', 1600, 'gravity y'), num('x', 0, 'gravity x')], run: (c, p) => { c.s.gravity = +p.y || 0; c.s.gravityX = +p.x || 0; }, say: (p) => `Gravity ${p.y}` },
  // flow
  wait: { cat: 'Flow', label: 'Wait', icon: 'clock', params: [num('seconds', 1, 'seconds')], run: (c, p) => Math.max(0, +p.seconds || 0), say: (p) => `Wait ${p.seconds}s` },
  sendMessage: { cat: 'Flow', label: 'Send message', icon: 'sign', params: [sug(txt('message', 'go', 'message'), 'messages')], run: (c, p) => c.s.send(p.message), say: (p) => `Send “${p.message}”` },
  setState: { cat: 'Flow', label: 'Go to state', icon: 'nodes', params: [txt('state', 'Idle', 'state')], run: (c, p) => c.e.getBehavior('fsm')?.goTo(p.state), say: (p) => `Go to ${p.state}` },
  // game
  message: { cat: 'Game', label: 'Show message', icon: 'sign', params: [txt('text', 'Hello! {score}', 'text'), num('seconds', 2, 'seconds')], run: (c, p) => c.s.message(fillTemplate(p.text, c.s.vars), +p.seconds || 2), say: (p) => `Say “${p.text}”` },
  log: { cat: 'Game', label: 'Debug log', icon: 'list', params: [txt('text', 'score is {score}', 'text')], run: (c, p) => Log.add('info', fillTemplate(p.text, c.s.vars), c.e?.name), say: (p) => `Log “${p.text}”` },
  sound: { cat: 'Game', label: 'Play sound', icon: 'bolt', params: [opt('sound', SOUNDS, 'coin', 'sound')], run: (c, p) => c.s.engine.audio.sfx(p.sound), say: (p) => `Sound: ${p.sound}` },
  vibrate: { cat: 'Game', label: 'Vibrate', icon: 'gamepad', run: (c) => c.s.engine.vibrate([30, 30, 30]), say: () => 'Vibrate' },
  shake: { cat: 'Game', label: 'Camera shake', icon: 'camera', params: [num('strength', 12, 'strength')], run: (c, p) => c.s.impulse(+p.strength || 10, c.e), say: (p) => `Shake camera (${p.strength})` },
  switchCamera: { cat: 'Game', label: 'Switch camera', icon: 'camera', params: [sug(txt('camera', 'Camera', 'camera object'), 'objects')], run: (c, p) => c.s.setCamera(p.camera), say: (p) => `Camera → ${p.camera}` },
  save: { cat: 'Game', label: 'Save game', icon: 'save', params: [num('slot', 1, 'slot')], run: (c, p) => { if (c.s.saveGame(+p.slot || 1)) c.s.message('Game saved', 1.2); }, say: () => 'Save game' },
  load: { cat: 'Game', label: 'Load game', icon: 'folder', params: [num('slot', 1, 'slot')], run: (c, p) => { c.s.loadGame(+p.slot || 1); }, say: () => 'Load game' },
  win: { cat: 'Game', label: 'Win', icon: 'trophy', run: (c) => c.s.win(), say: () => 'Win!' },
  gameOver: { cat: 'Game', label: 'Game over', icon: 'enemy', run: (c) => c.s.gameOver(), say: () => 'Game over' },
  nextLevel: { cat: 'Game', label: 'Next level', icon: 'flag', run: (c) => { if (c.s.engine.hasNextLevel()) c.s.win(); }, say: () => 'Next level' },
  restart: { cat: 'Game', label: 'Restart', icon: 'rotate', run: (c) => c.s.engine.restart(), say: () => 'Restart' },
};
const withDefaults = (def, it) => { const p = { ...it }; for (const q of def?.params || []) if (p[q.key] === undefined) p[q.key] = q.default; return p; };
export const logicSay = (lib, it) => { const def = lib[it?.type]; if (!def) return it?.type || '?'; const p = withDefaults(def, it); return (def.say ? def.say(p) : def.label) || def.label; };
/** Run an instruction list; waits pause it. ctx.cancelled stops it. */
export function runInstructions(list, ctx, done) {
  let i = 0;
  const next = () => {
    while (i < (list || []).length) {
      if (ctx.cancelled || ctx.e.dead || ctx.s.engine?.scene !== ctx.s) return;
      const it = list[i++], def = LOGIC_ACTIONS[it?.type];
      if (!def || it.off) continue;
      let r;
      try { r = def.run(ctx, withDefaults(def, it)); } catch (err) { Log.add('error', `${def.label || it.type} failed: ${err.message}`, ctx.e?.name); }
      if (typeof r === 'number' && r > 0) { ctx.s.after(r, next); return; }
      if (r && typeof r.until === 'function') { const poll = () => (ctx.cancelled ? null : r.until() ? next() : ctx.s.after(0.05, poll)); ctx.s.after(0.05, poll); return; }
    }
    done?.();
  };
  next();
}
export function conditionsPass(list, ctx) {
  for (const cd of list || []) { const def = LOGIC_CONDITIONS[cd.type]; if (!def) continue; const ok = !!def.test(ctx, withDefaults(def, cd)); if (ok === !!cd.not) return false; }
  return true;
}
/** Watches what happened to an object this frame, for matching against events. */
class LogicWatcher {
  constructor(e, s) {
    this.e = e; this.s = s; this.queue = []; this.now = []; this.timers = new Map(); this.edges = new Map(); this.first = true;
    s.on('message', (n) => this.queue.push({ type: 'message', name: n }));
    s.on('animationEnd', (ent, clip) => { if (ent === e) this.queue.push({ type: 'animEnd', clip }); });
  }
  push(ev) { this.queue.push(ev); }
  frame(dt) {
    const s = this.s, e = this.e, inp = s.engine.input, ev = this.queue;
    this.queue = []; this.dt = dt;
    if (e.visible && inp.taps.some((t) => hitTest(s, e, t.x, t.y))) ev.push({ type: 'tap' });
    if (inp.pressed('jump')) ev.push({ type: 'button', button: 'jump' });
    if (inp.pressed('action')) ev.push({ type: 'button', button: 'fire' });
    for (const d of ['up', 'down', 'left', 'right']) if (inp.pressed('swipe:' + d)) ev.push({ type: 'swipe', dir: d });
    if (this.first) { ev.push({ type: 'start' }); this.first = false; }
    this.now = ev;
  }
  /** Did event `x` happen? Returns { other } or null. key: per-listener timer/edge state; extra: { stateTime, finished } for state machines. */
  match(x, key, extra = {}) {
    const p = withDefaults(LOGIC_EVENTS[x?.type], x || {});
    switch (x?.type) {
      case 'every': { const t = (this.timers.get(key) || 0) + this.dt; if (t >= Math.max(0.05, +p.seconds || 1)) { this.timers.set(key, 0); return {}; } this.timers.set(key, t); return null; }
      case 'variable': { const now = cmp(+this.s.vars[p.name] || 0, p.op, +p.value || 0), was = this.edges.get(key); this.edges.set(key, now); return now && !was ? {} : null; }
      case 'always': return {};
      case 'after': return (extra.stateTime || 0) >= (+p.seconds || 0) ? {} : null;
      case 'finished': return extra.finished ? {} : null;
      default: {
        const hit = this.now.find((q) => q.type === x?.type && (x.type !== 'touch' && x.type !== 'touchEnd' || q.other?.has(p.tag)) && (x.type !== 'button' || q.button === p.button) && (x.type !== 'swipe' || q.dir === p.dir) && (x.type !== 'message' || q.name === p.message) && (x.type !== 'animEnd' || !p.clip || q.clip === p.clip));
        return hit ? { other: hit.other } : null;
      }
    }
  }
  resetTimers() { this.timers.clear(); }
}
const needsSensor = (events, e, s) => {
  for (const x of events) if (x && (x.type === 'touch' || x.type === 'touchEnd')) { e.ensureBody({ type: 'kinematic', sensor: true }); s.want(x.tag || 'player'); }
};

/** Triggers (Game Creator style): On [event] → If [conditions] → Do [instructions, one after another]. */
registerBehavior('triggers', {
  label: 'Triggers', description: 'Easy logic: On something happening → If conditions are true → Do a list of instructions in order (with waits). Like Game Creator.',
  params: [{ key: 'triggers', label: 'Triggers', type: 'triggers', default: [{ event: { type: 'tap' }, conditions: [], actions: [{ type: 'setVar', name: 'score', op: 'add', value: 1 }, { type: 'punch', what: 'scale', amount: 0.3, seconds: 0.4 }] }] }],
  create(p) {
    const list = Array.isArray(p.triggers) ? p.triggers : [];
    let w = null;
    return {
      uiAlways: true,
      start(e, s) { w = new LogicWatcher(e, s); needsSensor(list.map((t) => t.event), e, s); },
      update(e, dt, s) {
        w.frame(dt);
        list.forEach((t, i) => {
          if (t.off || (s.state !== 'play' && t.event?.type !== 'tap' && t.event?.type !== 'message')) return;
          if (t.once && t.fired) return;
          const hit = w.match(t.event, i);
          if (!hit) return;
          const c = { s, e, other: hit.other };
          if (!conditionsPass(t.conditions, c)) return;
          t.fired = true;
          runInstructions(t.actions, c);
        });
      },
      collide(e, other) { w?.push({ type: 'touch', other }); },
      separate(e, other) { w?.push({ type: 'touchEnd', other }); },
      destroy(e, s) { for (const t of list) if (t.event?.type === 'destroyed' && conditionsPass(t.conditions, { s, e })) runInstructions(t.actions, { s, e }); },
    };
  },
});

/** State Machine (PlayMaker style): states with actions, and transitions between them on events. */
registerBehavior('fsm', {
  label: 'State Machine', description: 'Like PlayMaker: the object is always in one state (Idle, Chase, Attack…). Each state runs actions when it starts, and moves to another state when an event happens.',
  params: [{ key: 'fsm', label: 'States', type: 'fsm', default: { start: 's1', any: [], states: [
    { id: 's1', name: 'Idle', x: 30, y: 60, enter: [{ type: 'fade', alpha: 1, seconds: 0.2 }], stay: [], exit: [], transitions: [{ event: { type: 'tap' }, conditions: [], to: 's2' }] },
    { id: 's2', name: 'Excited', x: 290, y: 60, enter: [{ type: 'punch', what: 'scale', amount: 0.4, seconds: 0.5 }, { type: 'setVar', name: 'score', op: 'add', value: 1 }], stay: [], exit: [], transitions: [{ event: { type: 'after', seconds: 1 }, conditions: [], to: 's1' }] },
  ] } }],
  create(p) {
    const g = p.fsm || { states: [] }, states = new Map((g.states || []).map((q) => [q.id, q]));
    let cur = null, t = 0, finished = false, run = null, w = null;
    const inst = {
      uiAlways: false,
      get state() { return cur?.name; },
      enter(id, e, s) {
        if (run) run.cancelled = true;
        if (cur) runInstructions(cur.exit, { s, e });
        cur = states.get(id) || null; t = 0; finished = false; w?.resetTimers();
        e.data.state = cur?.name || '';
        if (!cur) return;
        run = { s, e, cancelled: false };
        runInstructions(cur.enter, run, () => { finished = true; });
        s.emit('state', e, cur.name);
      },
      goTo(name) { const st = (g.states || []).find((q) => q.name === name || q.id === name); if (st && inst.entity) inst.enter(st.id, inst.entity, inst.entity.scene); },
      start(e, s) {
        inst.entity = e; w = new LogicWatcher(e, s);
        needsSensor([...(g.states || []).flatMap((q) => (q.transitions || []).map((tr) => tr.event)), ...(g.any || []).map((tr) => tr.event)], e, s);
        inst.enter(g.start || g.states?.[0]?.id, e, s);
      },
      update(e, dt, s) {
        if (!cur) return;
        w.frame(dt); t += dt;
        if (cur.stay?.length) runInstructions(cur.stay.filter((it) => it.type !== 'wait'), { s, e });
        const trs = [...(cur.transitions || []).map((tr, i) => [tr, cur.id + ':' + i]), ...(g.any || []).map((tr, i) => [tr, 'any:' + i])];
        for (const [tr, key] of trs) {
          if (!states.has(tr.to) || (key.startsWith('any') && tr.to === cur.id)) continue;
          const hit = w.match(tr.event, key, { stateTime: t, finished });
          if (!hit || !conditionsPass(tr.conditions, { s, e, other: hit.other })) continue;
          if (tr.actions?.length) runInstructions(tr.actions, { s, e, other: hit.other });
          inst.enter(tr.to, e, s);
          break;
        }
      },
      collide(e, other) { w?.push({ type: 'touch', other }); },
      separate(e, other) { w?.push({ type: 'touchEnd', other }); },
      destroy() { if (run) run.cancelled = true; },
    };
    return inst;
  },
});

registerBehavior('graph', {
  label: 'Visual Script', description: 'Node-based coding: connect event, action and value nodes in the Node Editor.',
  params: [{ key: 'graph', label: 'Graph', type: 'graph', default: { nodes: [
    { id: 'n1', type: 'tap', x: 20, y: 40, params: {} },
    { id: 'n2', type: 'addVar', x: 330, y: 20, params: { name: 'score', amount: 1 } },
    { id: 'n3', type: 'message', x: 640, y: 40, params: { text: 'Score: {score}', seconds: 1.5 } },
  ], links: [{ from: { node: 'n1', port: 'then' }, to: { node: 'n2', port: 'in' } }, { from: { node: 'n2', port: 'then' }, to: { node: 'n3', port: 'in' } }] } }],
  create(p) {
    const g = p.graph || { nodes: [], links: [] }, byId = new Map(g.nodes.map((n) => [n.id, n])), state = new Map();
    const def = (n) => NODE_TYPES[n.type] || {};
    const anims = (e) => ['animator', 'spriteSheet'].map((t) => e.getBehavior(t)).filter(Boolean);
    const param = (n, key) => { const d = [...(def(n).params || []), ...(def(n).inputs || [])].find((q) => q.key === key); return n.params?.[key] ?? d?.default; };
    const input = (n, key, ctx, depth = 0) => {
      const l = g.links.find((q) => q.to.node === n.id && q.to.port === key);
      return l && depth < 50 ? value(byId.get(l.from.node), ctx, depth + 1) : param(n, key);
    };
    const value = (n, ctx, depth) => {
      if (!n) return 0;
      const s = ctx.s, e = ctx.e, I = (k) => input(n, k, ctx, depth), P = (k) => param(n, k);
      switch (n.type) {
        case 'number': return +P('value') || 0;
        case 'getVar': return +s.vars[P('name')] || 0;
        case 'random': { const a = +P('min') || 0, b = +P('max') || 0; return Number.isInteger(a) && Number.isInteger(b) ? Math.min(b, Math.floor(rand(a, b + 1))) : rand(a, b); }
        case 'math': { const a = +I('a') || 0, b = +I('b') || 0; return { '+': a + b, '−': a - b, '×': a * b, '÷': b ? a / b : 0, min: Math.min(a, b), max: Math.max(a, b) }[P('op')] ?? 0; }
        case 'compare': { const a = +I('a') || 0, b = +I('b') || 0; return { '≥': a >= b, '≤': a <= b, '=': a === b, '>': a > b, '<': a < b, '≠': a !== b }[P('op')] ?? false; }
        case 'and': return !!I('a') && !!I('b');
        case 'or': return !!I('a') || !!I('b');
        case 'not': return !I('a');
        case 'position': return e[P('axis')] || 0;
        case 'distance': { const t = s.findAll(P('tag'))[0]; return t ? Math.hypot(t.x - e.x, t.y - e.y, t.z - e.z) : Infinity; }
        case 'time': return s.time;
        case 'hasSave': return s.hasSave(+P('slot') || 1);
        case 'grounded': return !!e.body?.grounded;
        case 'velocity': { const v = e.body?.vel || { x: 0, y: 0, z: 0 }; return P('axis') === 'speed' ? Math.hypot(v.x, v.y, v.z) : v[P('axis')] || 0; }
        case 'touching': return s.engine.physics.touching(e, P('tag'));
        case 'canSee': { const t = s.findAll(P('tag')).find((q) => q !== e); return !!t && s.canSee(e, t, +P('range') || Infinity); }
        case 'math1': { const a = +I('a') || 0; return { abs: Math.abs(a), round: Math.round(a), floor: Math.floor(a), ceil: Math.ceil(a), sqrt: Math.sqrt(Math.max(0, a)), negate: -a, sin: Math.sin(a * DEG), cos: Math.cos(a * DEG) }[P('op')] ?? a; }
        case 'clamp': return clamp(+I('value') || 0, +I('min') || 0, +I('max') || 0);
        case 'lerp': return lerp(+I('a') || 0, +I('b') || 0, +I('t') || 0);
        case 'loopIndex': return ctx.index ?? 0;
        case 'angleTo': { const t = nearest(s, e, P('tag')); if (!t) return 0; return s.mode === '3d' ? Math.atan2(t.x - e.x, t.z - e.z) / DEG : Math.atan2(t.y - e.y, t.x - e.x) / DEG; }
        case 'countTag': return s.findAll(P('tag')).filter((q) => !q.dead).length;
        case 'exists': { const k = P('object'); return !!(s.find(k) && !s.find(k).dead) || s.findAll(k).some((q) => !q.dead); }
        case 'health': return e.getBehavior('health')?.hp ?? e.data.hp ?? 0;
        case 'itemCount': return s.itemCount(P('item'));
        case 'joystick': { const a = s.engine.input.axis(); return P('axis') === 'y' ? a.y : a.x; }
        case 'screen': return P('what') === 'height' ? s.engine.height : s.engine.width;
        case 'isMoving': { const v = e.body?.vel; if (v) return Math.hypot(v.x, v.y, v.z) > (s.mode === '3d' ? 0.2 : 10); const m = state.get('_moved'); return !!m && s.time - m < 0.1; }
        case 'isHolding': return s.engine.input.pointers.size > 0;
        case 'touchPos': {
          const inp = s.engine.input, pt = [...inp.pointers.values()][0] || inp.taps[0] || inp.ups[0];
          if (pt) state.set('_finger', s.mode === '2d' ? s.engine.renderer.screenToWorld(s, pt.x, pt.y) : { x: pt.x, y: pt.y });
          return state.get('_finger')?.[P('axis') === 'y' ? 'y' : 'x'] ?? 0;
        }
        case 'coinFlip': return Math.random() < 0.5;
        case 'level': return (s.engine.levelIndex ?? 0) + 1;
        case 'animPlaying': { const c = anims(e).map((a) => a.current).find(Boolean) || ''; return P('clip') ? c === P('clip') : !!c; }
        case 'spriteFrame': return e.sprite?.frame | 0;
        default: return 0;
      }
    };
    const follow = (n, port, ctx) => { for (const l of g.links) if (l.from.node === n.id && l.from.port === port) run(byId.get(l.to.node), ctx); };
    const run = (n, ctx) => {
      if (!n || ++ctx.steps > 300) return; // (a chain keeps going after its object is destroyed, like the rest of a Unity frame)
      const s = ctx.s, e = ctx.e, I = (k) => input(n, k, ctx), P = (k) => param(n, k), up = s.mode === '3d' ? 1 : -1;
      switch (n.type) {
        case 'branch': return follow(n, I('condition') ? 'true' : 'false', ctx);
        case 'wait': { s.after(Math.max(0, +I('seconds') || 0), () => { if (!e.dead) follow(n, 'then', { ...ctx, steps: 0 }); }); return; }
        case 'chance': return follow(n, Math.random() * 100 < (+I('percent') || 0) ? 'yes' : 'no', ctx);
        case 'once': if (state.get(n.id)) return; state.set(n.id, true); break;
        case 'sequence': for (const port of ['first', 'second', 'third']) follow(n, port, ctx); return;
        case 'loop': { const c = Math.min(100, Math.max(0, Math.floor(+I('count') || 0))); for (let i = 0; i < c; i++) follow(n, 'each', { ...ctx, index: i, steps: ctx.steps }); return follow(n, 'done', ctx); }
        case 'flipFlop': { const a = !state.get(n.id); state.set(n.id, a); return follow(n, a ? 'A' : 'B', ctx); }
        case 'cooldown': { const last = state.get(n.id); if (last != null && s.time - last < (+I('seconds') || 0)) return follow(n, 'blocked', ctx); state.set(n.id, s.time); return follow(n, 'then', ctx); }
        case 'countTo': { const c = (state.get(n.id) || 0) + 1, need = Math.max(1, Math.round(+I('times') || 1)); if (c >= need) { state.set(n.id, P('after') === 'stay done' ? need : 0); return follow(n, 'reached', ctx); } state.set(n.id, c); return follow(n, 'not yet', ctx); }
        case 'randomBranch': { const ports = ['1', '2', '3'].filter((pt) => g.links.some((l) => l.from.node === n.id && l.from.port === pt)); return ports.length ? follow(n, ports[Math.floor(Math.random() * ports.length)], ctx) : undefined; }
        case 'switchNum': { const v = Math.round(+I('value') || 0); return follow(n, v >= 0 && v <= 3 ? String(v) : 'other', ctx); }
        case 'compareBranch': { const a = +I('a') || 0, b = +I('b') || 0, ok = { '≥': a >= b, '≤': a <= b, '=': a === b, '>': a > b, '<': a < b, '≠': a !== b }[P('op')]; return follow(n, ok ? 'yes' : 'no', ctx); }
        case 'setPosition': { const t = P('target') === 'other' ? ctx.other : e; if (t) { t.x = +I('x') || 0; t.y = +I('y') || 0; if (s.mode === '3d') t.z = +I('z') || 0; if (t.body) t.body.vel = { x: 0, y: 0, z: 0 }; } break; }
        case 'moveToward': {
          const t = nearest(s, e, P('tag')); if (!t) break;
          const dx = t.x - e.x, dy = s.mode === '3d' ? 0 : t.y - e.y, dz = s.mode === '3d' ? t.z - e.z : 0, d = Math.hypot(dx, dy, dz), step = (+I('speed') || 0) * (ctx.dt ?? 1 / 60);
          if (d <= step || d < 1e-6) { e.x = t.x; if (s.mode === '3d') e.z = t.z; else e.y = t.y; follow(n, 'arrived', ctx); break; }
          e.x += dx / d * step; e.y += dy / d * step; e.z += dz / d * step; break;
        }
        case 'lookAt': { const t = nearest(s, e, P('tag')); if (t) { if (s.mode === '3d') e.ry = Math.atan2(t.x - e.x, t.z - e.z) / DEG; else e.rz = Math.atan2(t.y - e.y, t.x - e.x) / DEG; } break; }
        case 'rotateBy': if (s.mode === '3d') e.ry += +I('degrees') || 0; else e.rz += +I('degrees') || 0; break;
        case 'setScale': { const k = +I('scale') || 0; e.sx = e.sy = k; if (s.mode === '3d') e.sz = k; break; }
        case 'teleport': { const k = P('object'), t = s.find(k) || s.findAll(k).find((q) => q !== e); if (t) { e.x = t.x; e.y = t.y; e.z = t.z; if (e.body) e.body.vel = { x: 0, y: 0, z: 0 }; } break; }
        case 'setText': { const t = P('object') ? s.find(P('object')) : e; if (t) { t.text ||= { ...TEXT_DEFAULTS }; t.text.value = P('text'); } break; }
        case 'setColor': { const t = P('target') === 'other' ? ctx.other : e, c = P('color'); if (t) { if (t.shape) t.shape.fill = c; if (t.mesh) t.mesh.color = c; if (t.text && !t.shape && !t.mesh) t.text.color = c; } break; }
        case 'particles': s.burst(e.x, e.y, e.z, P('color') || '#ffd54f', Math.min(200, Math.max(1, +I('count') || 20))); break;
        case 'spawnAt': { const k = P('at'), at = (k && (s.find(k) || nearest(s, e, k))) || e; if (P('template')) s.spawn(P('template'), { x: at.x, y: at.y, z: at.z }); break; }
        case 'destroyTag': for (const t of s.findAll(P('tag'))) if (!t.dead) { s.burst(t.x, t.y, t.z, '#fff', 8); t.destroy(); } break;
        case 'tagOp': if (P('tag')) { if (P('mode') === 'remove') e.tags.delete(P('tag')); else e.tags.add(P('tag')); } break;
        case 'slowMo': { const eng = s.engine, k = clamp(+I('speed') || 0, 0.05, 4); eng.timeScale = k; const secs = +I('seconds') || 0; if (secs > 0) setTimeout(() => { if (eng.timeScale === k) eng.timeScale = 1; }, secs * 1000); break; }
        case 'damage': { const t = P('target') === 'self' ? e : ctx.other; t?.getBehavior('health')?.damage(+I('amount') || 0, t, e); break; }
        case 'heal': { const t = P('target') === 'other' ? ctx.other : e; t?.getBehavior('health')?.heal(+I('amount') || 0, t); break; }
        case 'giveItem': s.addItem(P('item') || 'item', Math.round(+I('count') || 1)); break;
        case 'setVar': s.setVar(P('name') || 'score', +I('value') || 0); break;
        case 'addVar': s.addVar(P('name') || 'score', +I('amount') || 0); break;
        case 'message': s.message(fillTemplate(P('text'), s.vars), +P('seconds') || 2); break;
        case 'log': Log.add('info', fillTemplate(P('text'), s.vars), e?.name); break;
        case 'sound': s.engine.audio.sfx(P('sound')); break;
        case 'spawn': if (P('template')) s.spawn(P('template'), { x: e.x, y: e.y, z: e.z }); break;
        case 'destroy': { const t = P('target') === 'other' ? ctx.other : e; if (t) { s.burst(t.x, t.y, t.z, '#fff', 12); t.destroy(); } break; }
        case 'moveBy': e.x += +I('x') || 0; e.y += +I('y') || 0; e.z += +I('z') || 0; break;
        case 'setVelocity': { const b = e.ensureBody({ type: 'dynamic' }); b.vel.x = +I('x') || 0; b.vel.y = +I('y') || 0; b.vel.z = +I('z') || 0; break; }
        case 'jump': if (e.body) e.body.vel.y = (+I('power') || 0) * up; s.engine.audio.sfx('jump'); break;
        case 'showHide': { const t = P('object') ? s.find(P('object')) : e; if (t) t.visible = P('mode') === 'show' ? true : P('mode') === 'hide' ? false : !t.visible; break; }
        case 'vibrate': s.engine.vibrate([30, 30, 30]); break;
        case 'shake': s.camera.shake = Math.max(s.camera.shake, +I('strength') || 10); break;
        case 'win': s.win(); return;
        case 'gameOver': s.gameOver(); return;
        case 'nextLevel': if (s.engine.hasNextLevel()) s.win(); return;
        case 'restart': s.engine.restart(); return;
        case 'saveGame': if (s.saveGame(+P('slot') || 1) && P('text')) s.message(P('text'), 1.5); break;
        case 'loadGame': follow(n, s.loadGame(+P('slot') || 1) ? 'then' : 'no save', ctx); return;
        case 'deleteSave': s.deleteSave(+P('slot') || 1); break;
        case 'push': { const t = P('target') === 'other' ? ctx.other : e, b = t?.ensureBody({ type: 'dynamic' }); if (b) { b.vel.x += +I('x') || 0; b.vel.y += +I('y') || 0; b.vel.z += +I('z') || 0; } break; }
        case 'setGravity': s.gravity = +I('y') || 0; s.gravityX = +I('x') || 0; break;
        case 'switchCamera': s.setCamera(P('camera')); break;
        case 'zoomCamera': if (s.mode === '2d') s.tween(s.camera, { zoom: Math.max(0.05, +I('zoom') || 1) }, Math.max(0.01, +P('seconds') || 0.01)); else s.tween(s.camera, { fov: clamp(60 / (+I('zoom') || 1), 10, 120) }, Math.max(0.01, +P('seconds') || 0.01)); break;
        case 'setLight': { const t = P('object') ? s.find(P('object')) : e; if (t) { t.light ||= { ...LIGHT_DEFAULTS, range: s.mode === '3d' ? 8 : 160 }; t.light.off = P('mode') === 'off' ? true : P('mode') === 'on' ? false : !t.light.off; t.light.intensity = +I('intensity') || 0; } break; }
        case 'setDarkness': s.light.darkness = clamp(+I('darkness') || 0, 0, 1); break;
        case 'tweenTo': {
          const prop = P('prop'), v = +I('value') || 0, d = Math.max(0.01, +I('seconds') || 0.5);
          const tw = s.to(e, { [prop]: v }, d, { ease: P('ease'), relative: P('mode') === 'by' && prop !== 'scale' });
          tw.onComplete(() => follow(n, 'finished', { ...ctx, steps: 0 }));
          break;
        }
        case 'punch': {
          const t = P('target') === 'other' ? ctx.other : e; if (!t) break;
          const a = +I('amount') || 0.3, d = +I('seconds') || 0.4, three = s.mode === '3d';
          s.punch(t, P('what') === 'scale' ? (three ? { sx: a, sy: a, sz: a } : { sx: a, sy: a }) : P('what') === 'rotation' ? (three ? { ry: a * 90 } : { rz: a * 90 }) : { y: three ? a : -a * 60 }, d);
          break;
        }
        case 'killTweens': s.killTweens(e); break;
        case 'playAnim': { const lp = P('loop'), loop = lp === 'loop' ? true : lp === 'once' ? false : undefined; playClip(e, P('clip'), loop); break; }
        case 'stopAnim': for (const a of anims(e)) a.stop(); break;
        case 'animSpeed': for (const a of anims(e)) a.setSpeed(+I('speed') || 0); break;
        case 'setFrame': { e.getBehavior('spriteSheet')?.stop(); if (e.sprite) e.sprite.frame = Math.max(0, Math.round(+I('frame') || 0)); break; }
        case 'flipX': if (e.sprite) e.sprite.flip = P('mode') === 'face left' ? true : P('mode') === 'face right' ? false : !e.sprite.flip; else if (P('mode') !== 'toggle') e.sx = Math.abs(e.sx) * (P('mode') === 'face left' ? -1 : 1); else e.sx = -e.sx; break;
        case 'fadeTo': { const tw = s.to(e, { alpha: clamp(+I('alpha') || 0, 0, 1) }, Math.max(0.01, +I('seconds') || 0.5), { ease: 'outQuad' }); tw.onComplete(() => follow(n, 'finished', { ...ctx, steps: 0 })); break; }
        case 'blink': { const end = s.time + Math.max(0.05, +I('seconds') || 1), id = e.data._blink = (e.data._blink || 0) + 1, tick = () => { if (e.dead || e.data._blink !== id) return; if (s.time >= end) { e.visible = true; return; } e.visible = !e.visible; s.after(0.08, tick); }; tick(); break; }
        case 'toggleVar': s.setVar(P('name') || 'on', +s.vars[P('name') || 'on'] ? 0 : 1); break;
        case 'setBackground': s.background = P('color') || s.background; break;
        case 'setAlpha': e.alpha = clamp(+I('alpha') || 0, 0, 1); break;
        case 'stopMoving': { const t = P('target') === 'other' ? ctx.other : e; if (t?.body) { t.body.vel.x = t.body.vel.y = t.body.vel.z = 0; if (t.body.angVel != null) t.body.angVel = 0; } break; }
        case 'gravityScale': { const b = e.ensureBody({ type: 'dynamic' }); b.gravityScale = +I('scale') || 0; break; }
        case 'sendMessage': s.send(P('message')); break;
        case 'impulse': s.impulse(+I('strength') || 10, e); break;
        default: break;
      }
      follow(n, 'then', ctx);
    };
    const fire = (type, e, s, other, filter, dt) => {
      if (e.dead && type !== 'destroyed') return;
      for (const n of g.nodes) if (n.type === type && (!filter || filter(n))) follow(n, 'then', { s, e, other, steps: 0, dt });
    };
    const timers = new Map();
    return {
      uiAlways: true,
      start(e, s) {
        if (g.nodes.some((n) => n.type === 'onMessage')) s.on('message', (name) => { if (!e.dead) fire('onMessage', e, s, null, (n) => param(n, 'message') === name); });
        if (g.nodes.some((n) => n.type === 'varChanged')) s.on('var', (k) => { if (!e.dead) fire('varChanged', e, s, null, (n) => param(n, 'name') === k); });
        if (g.nodes.some((n) => n.type === 'damaged')) s.on('damage', (who) => { if (who === e) fire('damaged', e, s); });
        if (g.nodes.some((n) => n.type === 'death')) s.on('death', (who) => { if (who === e) fire('death', e, s); });
        if (g.nodes.some((n) => n.type === 'onWin')) s.on('win', () => fire('onWin', e, s));
        if (g.nodes.some((n) => n.type === 'onGameOver')) s.on('gameover', () => fire('onGameOver', e, s));
        if (g.nodes.some((n) => n.type === 'animEnd')) s.on('animationEnd', (who, clip) => { if (who === e) fire('animEnd', e, s, null, (n) => !param(n, 'clip') || param(n, 'clip') === clip); });
        if (g.nodes.some((n) => n.type === 'stateEntered')) s.on('state', (who, name) => { if (who === e) fire('stateEntered', e, s, null, (n) => !param(n, 'state') || param(n, 'state') === name); });
        if (g.nodes.some((n) => n.type === 'touch' || n.type === 'touchEnd' || n.type === 'touching')) { e.ensureBody({ type: 'kinematic', sensor: true }); for (const n of g.nodes) if (['touch', 'touchEnd', 'touching'].includes(n.type)) s.want(param(n, 'tag')); }
        fire('start', e, s);
      },
      update(e, dt, s) {
        const inp = s.engine.input, playing = s.state === 'play';
        if (e.visible && g.nodes.some((n) => n.type === 'tap') && inp.taps.some((t) => hitTest(s, e, t.x, t.y)) && (playing || e.ui)) fire('tap', e, s);
        if (!playing) return;
        fire('update', e, s, null, null, dt);
        if (inp.pointers.size && g.nodes.some((n) => n.type === 'holding')) fire('holding', e, s, null, null, dt);
        if (g.nodes.some((n) => n.type === 'released') && inp.ups?.length) fire('released', e, s);
        if (g.nodes.some((n) => n.type === 'isMoving')) { const m = state.get('_pos'); if (m && Math.hypot(e.x - m.x, e.y - m.y, e.z - m.z) > (s.mode === '3d' ? 0.2 : 10) * dt) state.set('_moved', s.time); state.set('_pos', { x: e.x, y: e.y, z: e.z }); }
        for (const n of g.nodes) {
          if (n.type === 'every') { const t = (timers.get(n.id) || 0) + dt; if (t >= Math.max(0.05, +param(n, 'seconds') || 1)) { timers.set(n.id, 0); follow(n, 'then', { s, e, steps: 0 }); } else timers.set(n.id, t); }
          else if (n.type === 'button' && inp.pressed(param(n, 'button') === 'fire' ? 'action' : 'jump')) follow(n, 'then', { s, e, steps: 0 });
          else if (n.type === 'swipe' && inp.pressed('swipe:' + param(n, 'dir'))) follow(n, 'then', { s, e, steps: 0 });
        }
      },
      collide(e, other, s) { fire('touch', e, s, other, (n) => other.has(param(n, 'tag'))); },
      separate(e, other, s) { fire('touchEnd', e, s, other, (n) => other.has(param(n, 'tag'))); },
      destroy(e, s) { fire('destroyed', e, s); },
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
      const hooks = f(Pocket), out = {};
      for (const [k, fn] of Object.entries(hooks)) if (fn) out[k] = (e, ...a) => { // a crash in one script is logged, not fatal
        try { return fn(e, ...a); } catch (err) { if (!e.data._scriptErr || e.data._scriptErr !== err.message) { e.data._scriptErr = err.message; Log.add('error', `${k}(): ${err.message}`, (e.name || 'Object') + ' script'); } }
      };
      return out;
    } catch (err) {
      Log.add('error', `Script can't run: ${err.message}`, 'Custom script');
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
    this.canvas = document.createElement('canvas'); this._grade = null;
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
    if (source && typeof source === 'object' && !(source instanceof Scene)) this.audio.clips = { ...(source.sounds || {}) }; // imported sounds
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
    const json = i === 0 ? lv : { ...lv, physicsLayers: first.physicsLayers, settings: { ...(lv.settings || {}), title: this.carry ? '' : lv.settings?.title || '', saveBest: first.settings?.saveBest || '' } };
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

  setScene(scene, { skipRestore = false } = {}) {
    scene.engine = this;
    this.scene = scene;
    if (scene.settings.loadOnStart && !this.editing && !skipRestore && !this.loadedOnce && this.readSave(1)) { // continue from save slot 1
      this.loadedOnce = true;
      return this.loadGame(1, { keepTitle: true });
    }
    if (scene.settings.saveProgress && !this.editing && !this.restoredOnce && !skipRestore) { // continue where the player left off
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

  // ---- save slots (Save Game / Load Game actions and nodes) ----
  slotKey(slot) { return this.saveKey() + '.slot' + (slot || 1); }
  readSave(slot) { try { return JSON.parse(store.get(this.slotKey(slot), 'null')); } catch { return null; } }
  deleteSave(slot) { try { localStorage.removeItem(this.slotKey(slot)); } catch { /* storage unavailable */ } }
  saveGame(slot = 1) {
    const s = this.scene;
    if (!s || this.editing) return false;
    const vars = { ...s.vars }; delete vars.best;
    const ids = new Set((s.json?.entities || []).filter((ep) => ep.id && !ep.template).map((ep) => ep.id)), alive = new Set();
    const entities = {};
    for (const e of s.entities) {
      if (e.dead || !ids.has(e.id)) continue;
      alive.add(e.id);
      entities[e.id] = { x: e.x, y: e.y, z: e.z, rx: e.rx, ry: e.ry, rz: e.rz, visible: e.visible, data: Object.fromEntries(Object.entries(e.data).filter(([k, v]) => !k.startsWith('_') && typeof v !== 'object')) };
    }
    const data = { vars, level: this.levelIndex || 0, entities, removed: [...ids].filter((id) => !alive.has(id)), time: s.time, saved: Date.now() };
    store.set(this.slotKey(slot), JSON.stringify(data));
    return true;
  }
  loadGame(slot = 1, { keepTitle = false } = {}) {
    const d = this.readSave(slot);
    if (!d || !this.factory) return false;
    if (this.levels && d.level !== this.levelIndex && d.level < this.levels.length) this.levelIndex = d.level;
    this.carry = null;
    const s = this.factory();
    if (!keepTitle || s.state !== 'title') s.state = 'play';
    this.setScene(s, { skipRestore: true });
    Object.assign(s.vars, d.vars);
    const removed = new Set(d.removed || []);
    for (const e of s.entities) {
      if (removed.has(e.id)) { e.dead = true; continue; }
      const st = d.entities?.[e.id];
      if (!st) continue;
      Object.assign(e, { x: st.x, y: st.y, z: st.z, rx: st.rx, ry: st.ry, rz: st.rz, visible: st.visible });
      Object.assign(e.data, st.data || {});
      if (e.body) e.body.vel = { x: 0, y: 0, z: 0 };
    }
    s.flush();
    return true;
  }

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
    if (s.vars.volume != null) this.audio.volume = clamp((+s.vars.volume || 0) / 100, 0, 1); // a Slider bound to {volume} (0–100) controls sound
    s.rotateNeeded = this.wrongOrientation(s);
    if (s.rotateNeeded) return;
    if (this.paused && this.stepFrames > 0) this.stepFrames--; // editor "Step": run exactly one frame, then stay paused
    else if (this.paused) {
      this.runUIOnly(s, dt);
      if (!this.inspecting && ((inp.pressed('tap') && !ownScreen(s, 'paused')) || inp.pressed('btn:pause'))) this.paused = false;
      return;
    }
    if (inp.pressed('btn:pause') && s.state === 'play') { this.paused = true; return; }
    if (s.state === 'title') {
      this.runUIOnly(s, dt);
      if (inp.pressed('tap') && !ownScreen(s, 'title')) { s.state = 'play'; this.audio.sfx('click'); }
      s.time += dt; this.stepEffects(dt); return;
    }
    if (s.state !== 'play') {
      s.time += dt; this.stepEffects(dt);
      this.runUIOnly(s, dt);
      if (s.time - s.endTime > 0.8 && inp.pressed('tap') && !ownScreen(s, s.state)) {
        const t = inp.taps[0], r = this.shareRect;
        if (r && t && t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h && !s.levelComplete) this.shareScore();
        else if (s.levelComplete) this.nextLevel(); else this.restart();
      }
      return;
    }
    if (s.dialog) { // conversations: taps go to the dialogue; optionally the game waits
      const used = stepDialog(s, dt, inp.taps.length > 0);
      if (used) inp.taps.length = 0;
      if (s.dialog?.pause) { s.time += dt; this.stepEffects(dt); this.runUIOnly(s, dt); return; }
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
    const steps = this.physics.substeps(s, dt); // more steps when something moves fast (no tunnelling)
    for (let i = 0; i < steps; i++) this.physics.step(s, dt / steps);
    s.time += dt;
    if (s.settings.winScore && s.vars.score >= s.settings.winScore) s.win();
    if (s.settings.timeLimit && s.state === 'play') {
      s.vars.time = Math.max(0, (s.vars.time ?? s.settings.timeLimit) - dt);
      if (s.vars.time <= 0) { s.message("Time's up!", 3); s.gameOver(); }
    }
    this.stepEffects(dt);
    s.flush();
    if (s.kids.length) s.syncHierarchy(false);
  }

  stepEffects(dt) {
    const s = this.scene;
    for (let i = s.timers.length - 1; i >= 0; i--) {
      const t = s.timers[i];
      if ((t.t -= dt) <= 0) { t.fn(); if (t.every) t.t += t.every; else s.timers.splice(i, 1); }
    }
    const tdt = dt * (s.tweenScale ?? 1);
    for (let i = 0; i < s.tweens.length; i++) { const tw = s.tweens[i]; if (tw.target?.dead) tw.done = true; else tw.update(tdt); }
    if (s.tweens.some((t) => t.done)) s.tweens = s.tweens.filter((t) => !t.done);
    const drag = s.mode === '3d' ? 0.97 : 0.95, g = s.mode === '3d' ? -6 : 0;
    for (let i = s.particles.length - 1; i >= 0; i--) {
      const p = s.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const dr = p.drag ?? drag;
      p.vx *= dr; p.vy = p.vy * dr + (p.g ?? g) * dt; p.vz *= dr;
      if (p.wobble) p.x += Math.sin((s.time + i) * 3) * dt * (s.mode === '3d' ? 0.3 : 20);
      if (p.shrink) p.size *= 1 - dt * 1.2; else if (p.grow) p.size *= 1 + dt * 0.8;
      if ((p.life -= p.decay * dt) <= 0) s.particles.splice(i, 1);
    }
    s.camera.shake = Math.max(0, s.camera.shake - dt * 40);
    if (s.msg && (s.msg.t -= dt) <= 0) s.msg = null;
  }

  render() {
    if (!this.scene || !this.renderer) return;
    if (this.editing && this.scene.kids.length) this.scene.syncHierarchy(true);
    this.scene.syncLights();
    this.renderer.render(this.scene, this);
    this.applyPost(this.scene.post);
    renderUI(this, this.scene);
    this.onRenderUI?.(this.uiCtx, this.scene);
  }

  /** Post-processing over the game view (not the HUD): colour grading and bloom on the GPU, vignette and tint as overlays. */
  applyPost(P = {}) {
    const on = (k) => +P[k] > 0, grade = [
      P.brightness != null && +P.brightness !== 100 && `brightness(${+P.brightness / 100})`,
      P.contrast != null && +P.contrast !== 100 && `contrast(${+P.contrast / 100})`,
      P.saturation != null && +P.saturation !== 100 && `saturate(${+P.saturation / 100})`,
      +P.hue && `hue-rotate(${+P.hue}deg)`,
    ].filter(Boolean).join(' ');
    if (this.canvas && this._grade !== grade) { this.canvas.style.filter = grade; this._grade = grade; }
    // bloom: a small copy of the frame, bright parts kept, blurred, and added on top with "screen"
    if (on('bloom')) {
      let b = this.bloomCanvas;
      if (!b) {
        b = this.bloomCanvas = document.createElement('canvas');
        b.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;mix-blend-mode:screen;';
        this.root.insertBefore(b, this.uiCanvas);
      }
      const w = Math.max(1, Math.round(this.width / 4)), hgt = Math.max(1, Math.round(this.height / 4));
      if (b.width !== w || b.height !== hgt) { b.width = w; b.height = hgt; }
      const g = b.getContext('2d'); g.clearRect(0, 0, w, hgt); g.drawImage(this.canvas, 0, 0, w, hgt);
      const r = Math.max(1, (+P.bloomRadius || 12) / 4), th = 1 + +(P.bloomThreshold ?? 60) / 40;
      const f = `brightness(${0.85 - (th - 1) * 0.15}) contrast(${th}) blur(${r}px) ${grade}`;
      if (b._f !== f) { b.style.filter = f; b._f = f; }
      b.style.opacity = Math.min(1, +P.bloom); b.hidden = false;
    } else if (this.bloomCanvas) this.bloomCanvas.hidden = true;
    // vignette (dark edges) and tint (a colour wash)
    const vig = on('vignette'), tint = on('tintAmount') && P.tint;
    if (vig || tint) {
      let o = this.postOverlay;
      if (!o) { o = this.postOverlay = document.createElement('div'); o.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;'; this.root.insertBefore(o, this.uiCanvas); }
      const key = `${P.vignette}|${P.tint}|${P.tintAmount}|${P.vignetteColor}`;
      if (o._k !== key) {
        o._k = key;
        const c255 = (hex) => hexToRgb(hex).map((v) => Math.round(v * 255)), [vr, vg, vb] = c255(P.vignetteColor || '#000000'), [tr, tg, tb] = c255(P.tint || '#ff8800');
        o.style.background = [vig && `radial-gradient(ellipse at center, rgba(${vr},${vg},${vb},0) ${Math.round(70 - +P.vignette * 35)}%, rgba(${vr},${vg},${vb},${Math.min(1, +P.vignette * 0.9)}) 100%)`,
          tint && `linear-gradient(rgba(${tr},${tg},${tb},${Math.min(0.8, +P.tintAmount * 0.75)}), rgba(${tr},${tg},${tb},${Math.min(0.8, +P.tintAmount * 0.75)}))`].filter(Boolean).join(',');
      }
      o.hidden = false;
    } else if (this.postOverlay) this.postOverlay.hidden = true;
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
  Log, log: (...a) => Log.add('info', a.join(' '), 'script'), warn: (...a) => Log.add('warn', a.join(' '), 'script'),
};
export default Pocket;
