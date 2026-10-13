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
export const SHAPE_DEFAULTS = { type: 'rect', w: 40, h: 40, r: 20, radius: 0, fill: '#33f0ff', stroke: '', lineWidth: 2, glow: 0, points: null };
export const TEXT_DEFAULTS = { value: 'Text', size: 24, color: '#ffffff', font: 'system-ui, -apple-system, sans-serif', weight: '800', align: 'center' };
export const MESH_DEFAULTS = { geometry: 'box', w: 1, h: 1, d: 1, r: 0.5, color: '#33f0ff', emissive: 0, opacity: 1 };
export const SPRITE_DEFAULTS = { src: '', w: 64, h: 64 };
export const BODY_DEFAULTS = { type: 'dynamic', shape: 'auto', w: 0, h: 0, d: 0, r: 0, sensor: false, gravityScale: 1, bounce: 0, vx: 0, vy: 0, vz: 0 };

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
    const b = this.body, is2D = !this.mesh;
    const sx = Math.abs(this.sx), sy = Math.abs(this.sy), sz = Math.abs(this.sz);
    if (b && b.shape !== 'auto') {
      if (b.shape === 'circle' || b.shape === 'sphere') return { sphere: true, r: (b.r || 10) * Math.max(sx, sy, is2D ? 0 : sz) };
      return { sphere: false, hx: (b.w || 1) * sx / 2, hy: (b.h || 1) * sy / 2, hz: is2D ? Infinity : (b.d || 1) * sz / 2 };
    }
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
      if (s.type === 'circle') return { sphere: true, r: s.r * Math.max(sx, sy) };
      return { sphere: false, hx: s.w * sx / 2, hy: s.h * sy / 2, hz: Infinity };
    }
    if (this.sprite) return { sphere: false, hx: this.sprite.w * sx / 2, hy: this.sprite.h * sy / 2, hz: Infinity };
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
  joystick: false, jumpButton: false, title: '', subtitle: '', saveBest: '', pauseButton: true,
};

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
  }

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
  if (!ea.sphere) { const m = overlap(b, eb, a, ea); if (m) { m.nx = -m.nx; m.ny = -m.ny; m.nz = -m.nz; } return m; }
  // a = sphere, b = box
  const cx = clamp(a.x, b.x - eb.hx, b.x + eb.hx), cy = clamp(a.y, b.y - eb.hy, b.y + eb.hy), cz = clamp(a.z, b.z - eb.hz, b.z + eb.hz);
  const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz, d = Math.hypot(dx, dy, dz);
  if (d >= ea.r) return null;
  if (d > 1e-6) return { nx: -dx / d, ny: -dy / d, nz: -dz / d, depth: ea.r - d };
  return overlap(a, { sphere: false, hx: ea.r, hy: ea.r, hz: Number.isFinite(eb.hz) ? ea.r : Infinity }, b, eb);
}

export class Physics {
  constructor() { this.contacts = new Set(); }

  step(scene, dt) {
    const g = scene.gravity, gd = Math.sign(g); // gravity along y
    const list = scene.entities.filter((e) => e.body && !e.dead);
    for (const e of list) {
      const b = e.body;
      if (b.type === 'static') continue;
      if (b.type === 'dynamic') b.vel.y += g * b.gravityScale * dt;
      e.x += b.vel.x * dt; e.y += b.vel.y * dt; e.z += b.vel.z * dt;
      b.grounded = false;
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
        const share = ma && mb ? 0.5 : 1;
        if (ma) {
          a.x -= m.nx * m.depth * share; a.y -= m.ny * m.depth * share; a.z -= m.nz * m.depth * share;
          const vn = ba.vel.x * m.nx + ba.vel.y * m.ny + ba.vel.z * m.nz;
          if (vn > 0) { const k = vn * (1 + ba.bounce); ba.vel.x -= m.nx * k; ba.vel.y -= m.ny * k; ba.vel.z -= m.nz * k; }
          if (gd && m.ny * gd > 0.5) ba.grounded = true;
        }
        if (mb) {
          b.x += m.nx * m.depth * share; b.y += m.ny * m.depth * share; b.z += m.nz * m.depth * share;
          const vn = bb.vel.x * m.nx + bb.vel.y * m.ny + bb.vel.z * m.nz;
          if (vn < 0) { const k = vn * (1 + bb.bounce); bb.vel.x -= m.nx * k; bb.vel.y -= m.ny * k; bb.vel.z -= m.nz * k; }
          if (gd && m.ny * gd < -0.5) bb.grounded = true;
        }
      }
    }
    this.contacts = now;
  }
}

function collide(e, other, m) {
  for (const b of e.behaviors) if (b.collide && !e.dead) b.collide(e, other, e.scene, m);
  e.scene?.emit('collide', e, other, m);
}

// ============================================================================
// Input: touch, mouse, keyboard, virtual joystick & buttons
// ============================================================================
export class Input {
  constructor(engine, el) {
    this.engine = engine;
    this.el = el;
    this.enabled = true;
    this.keys = new Set();
    this.justPressed = new Set();
    this.pointers = new Map();
    this.taps = [];
    this.drag = { dx: 0, dy: 0 };
    this.stick = null; // { id, bx, by, x, y }
    this.buttons = []; // [{ action, x, y, r, label, id }]
    this.tilt = null;

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && this.enabled) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  down(e) {
    this.engine.audio.unlock();
    if (!this.enabled) return;
    const p = this.local(e);
    this.el.setPointerCapture?.(e.pointerId);
    const btn = this.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3);
    const ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), role: 'free' };
    if (btn) { ptr.role = 'button'; btn.id = e.pointerId; this.justPressed.add('btn:' + btn.action); }
    else if (this.engine.scene?.settings.joystick && this.engine.scene.state === 'play' && p.x < this.engine.width * 0.5 && !this.stick) {
      ptr.role = 'stick'; this.stick = { id: e.pointerId, bx: p.x, by: p.y, x: p.x, y: p.y };
    }
    this.pointers.set(e.pointerId, ptr);
  }

  move(e) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    const p = this.local(e);
    if (ptr.role === 'free') { this.drag.dx += p.x - ptr.x; this.drag.dy += p.y - ptr.y; }
    ptr.x = p.x; ptr.y = p.y;
    if (this.stick && this.stick.id === e.pointerId) {
      const max = this.stickRadius, dx = p.x - this.stick.bx, dy = p.y - this.stick.by, d = Math.hypot(dx, dy);
      if (d > max) { this.stick.bx = p.x - dx / d * max; this.stick.by = p.y - dy / d * max; } // base follows the thumb
      this.stick.x = p.x; this.stick.y = p.y;
    }
  }

  up(e, cancelled) {
    const ptr = this.pointers.get(e.pointerId);
    if (!ptr) return;
    this.pointers.delete(e.pointerId);
    if (this.stick && this.stick.id === e.pointerId) this.stick = null;
    for (const b of this.buttons) if (b.id === e.pointerId) b.id = null;
    if (!cancelled && ptr.role === 'free' && performance.now() - ptr.t < 350 && Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) < 14) {
      this.taps.push({ x: ptr.x, y: ptr.y });
      this.justPressed.add('tap');
    }
  }

  get stickRadius() { return Math.min(70, this.engine.width * 0.15); }

  /** Movement axis in [-1, 1] from joystick or keyboard. y is down/forward-negative. */
  axis() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    if (this.stick) { x += (this.stick.x - this.stick.bx) / this.stickRadius; y += (this.stick.y - this.stick.by) / this.stickRadius; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  /** Is an action held? Actions: 'jump', 'action', or any KeyboardEvent.code */
  isDown(action) {
    if (action === 'jump') return this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.buttons.some((b) => b.action === 'jump' && b.id != null);
    if (action === 'action') return this.keys.has('KeyE') || this.keys.has('Enter') || this.buttons.some((b) => b.action === 'action' && b.id != null);
    return this.keys.has(action);
  }
  /** Was an action pressed this frame? */
  pressed(action) {
    const j = this.justPressed;
    if (action === 'jump') {
      const hasBtn = this.buttons.some((b) => b.action === 'jump');
      return j.has('Space') || j.has('ArrowUp') || j.has('KeyW') || j.has('btn:jump') || (!hasBtn && j.has('tap'));
    }
    if (action === 'action') return j.has('KeyE') || j.has('Enter') || j.has('btn:action');
    return j.has(action);
  }
  get pointerDown() { return [...this.pointers.values()].some((p) => p.role === 'free'); }

  endFrame() { this.justPressed.clear(); this.taps.length = 0; this.drag.dx = 0; this.drag.dy = 0; }
  reset() { this.pointers.clear(); this.stick = null; this.keys.clear(); this.endFrame(); }
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
const fillTemplate = (str, vars) => String(str).replace(/\{(\w+)\}/g, (_, k) => {
  const v = vars[k];
  return typeof v === 'number' ? String(Math.floor(v)) : v ?? '';
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
      default:
        if (s.radius && ctx.roundRect) ctx.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, s.radius);
        else ctx.rect(-s.w / 2, -s.h / 2, s.w, s.h);
    }
    if (s.fill) { ctx.fillStyle = s.fill; ctx.fill(); }
    if (s.stroke) { ctx.strokeStyle = s.stroke; ctx.lineWidth = s.lineWidth; ctx.stroke(); }
    ctx.shadowBlur = 0;
  }
  if (e.sprite && e.sprite.src) {
    const img = loadImage(e.sprite.src);
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -e.sprite.w / 2, -e.sprite.h / 2, e.sprite.w, e.sprite.h);
  }
  if (e.text) {
    const t = e.text;
    ctx.font = `${t.weight} ${t.size}px ${t.font}`;
    ctx.fillStyle = t.color; ctx.textAlign = t.align; ctx.textBaseline = 'middle';
    ctx.fillText(fillTemplate(t.value, vars), 0, 0);
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
attribute vec3 aPos; attribute vec3 aNormal;
uniform mat4 uModel, uViewProj; uniform mat3 uNormalMat;
varying vec3 vN; varying vec3 vW;
void main() { vec4 w = uModel * vec4(aPos, 1.0); vW = w.xyz; vN = uNormalMat * aNormal; gl_Position = uViewProj * w; }`;
const FS = `
precision mediump float;
varying vec3 vN; varying vec3 vW;
uniform vec3 uColor, uLightDir, uLightColor, uFogColor, uCamPos;
uniform float uAmbient, uEmissive, uFogNear, uFogFar, uOpacity;
void main() {
  vec3 n = normalize(vN);
  vec3 l = normalize(-uLightDir);
  float d = max(dot(n, l), 0.0);
  vec3 v = normalize(uCamPos - vW);
  float sp = pow(max(dot(n, normalize(l + v)), 0.0), 32.0) * 0.25;
  vec3 lit = uColor * (uAmbient + uLightColor * d * (1.0 - uAmbient)) + sp * uLightColor;
  vec3 c = mix(lit, uColor, uEmissive);
  float f = clamp((length(uCamPos - vW) - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, uFogColor, f), uOpacity);
}`;

function geometry(kind) {
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
    gl.linkProgram(prog); gl.useProgram(prog);
    this.a = { pos: gl.getAttribLocation(prog, 'aPos'), normal: gl.getAttribLocation(prog, 'aNormal') };
    this.u = {};
    for (const n of ['uModel', 'uViewProj', 'uNormalMat', 'uColor', 'uLightDir', 'uLightColor', 'uFogColor', 'uCamPos', 'uAmbient', 'uEmissive', 'uFogNear', 'uFogFar', 'uOpacity']) this.u[n] = gl.getUniformLocation(prog, n);
    this.geoms = {};
    for (const k of ['box', 'plane', 'sphere', 'cylinder', 'cone']) {
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

  meshModel(e) {
    const m = e.mesh; let gx = m.w, gy = m.h, gz = m.d;
    if (m.geometry === 'sphere') gx = gy = gz = m.r * 2;
    else if (m.geometry === 'cylinder' || m.geometry === 'cone') { gx = gz = m.r * 2; }
    else if (m.geometry === 'plane') gy = 1;
    return M4.trs(e.x, e.y, e.z, e.rx * DEG, e.ry * DEG, e.rz * DEG, e.sx * gx, e.sy * gy, e.sz * gz);
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
    for (const e of scene.entities) {
      if (!e.mesh || !e.visible || e.dead) continue;
      let op = e.mesh.opacity * e.alpha;
      if (e.data.invuln > 0 && Math.floor(scene.time * 12) % 2) op *= 0.3;
      if (op < 1) { transparent.push([e, op]); } else this.drawMesh(e.mesh.geometry, this.meshModel(e), e.mesh.color, e.mesh.emissive);
      if (e.body && e.body.type !== 'static' && !e.body.sensor) shadows.push(e);
    }
    // blob shadows onto the highest static surface below each moving body
    gl.enable(gl.BLEND); gl.depthMask(false);
    const statics = scene.entities.filter((e) => e.body && e.body.type === 'static' && e.mesh);
    for (const e of shadows) {
      const ex = e.extents(), r = ex.sphere ? ex.r : Math.max(ex.hx, ex.hz);
      const bottom = e.y - (ex.sphere ? ex.r : ex.hy);
      let ground = -Infinity;
      for (const s of statics) {
        const sx = s.extents(); if (sx.sphere) continue;
        if (Math.abs(e.x - s.x) < sx.hx && Math.abs(e.z - s.z) < sx.hz) { const top = s.y + sx.hy; if (top <= bottom + 0.05 && top > ground) ground = top; }
      }
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
  if (!engine.editing || engine.showUI) {
    for (const e of scene.entities) {
      if (!e.ui || !e.visible || e.dead) continue;
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
    if (inp.stick) {
      const s = inp.stick, r = inp.stickRadius;
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.bx, s.by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.42, 0, Math.PI * 2); ctx.fill();
    } else if (scene.settings.joystick && scene.time < 4) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 * pulse})`; ctx.font = '600 14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Touch & drag here to move', W * 0.25, H - engine.safe.bottom - 40);
    }
    for (const b of inp.buttons) {
      ctx.fillStyle = b.id != null ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${b.r * (b.action === 'pause' ? 0.6 : 0.42)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.label, b.x, b.y + 1);
    }
  }
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
    if (scene.time - (scene.endTime ?? scene.time) < 0.5) return;
    dim(0.65);
    big(scene.state === 'win' ? 'YOU WIN!' : 'GAME OVER', H * 0.34, 44, scene.state === 'win' ? '#5dff8a' : '#ff5d8f');
    big(String(Math.floor(scene.vars.score || 0)), H * 0.46, 64, '#ffd23d');
    if (scene.newBest) big('NEW BEST!', H * 0.54, 16, '#5dff8a');
    else if (scene.vars.best) big(`Best: ${scene.vars.best}`, H * 0.54, 16, 'rgba(220,225,255,0.7)');
    big('Tap to play again', H * 0.66, 20, `rgba(255,255,255,${pulse})`);
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
const is3D = (e) => !!e.mesh;

function respawnOrEnd(player, s, action) {
  if (action === 'respawn' || (action === 'damage' && s.vars.lives > 1)) {
    if (action === 'damage') s.addVar('lives', -1);
    s.engine.audio.sfx('hit'); s.engine.vibrate(60); s.camera.shake = is3D(player) ? 12 : 10;
    s.burst(player.x, player.y, player.z, player.mesh?.color || player.shape?.fill || '#fff', 14);
    if (action === 'respawn' || player.data.respawnOnHit) {
      player.x = player.props.x || 0; player.y = player.props.y || 0; player.z = player.props.z || 0;
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
  label: 'Move', description: 'Player movement with joystick, keyboard, or dragging.',
  params: [
    { key: 'speed', label: 'Speed', type: 'number', default: 260, default3d: 7 },
    { key: 'control', label: 'Control', type: 'select', options: ['joystick', 'drag', 'both'], default: 'both' },
    { key: 'axes', label: 'Axes', type: 'select', options: ['all', 'horizontal', 'vertical'], default: 'all' },
    { key: 'keepInView', label: 'Keep on screen (2D)', type: 'bool', default: true },
    { key: 'face', label: 'Face direction (3D)', type: 'bool', default: true },
  ],
  create(p) {
    return {
      start(e) { e.ensureBody({ type: 'dynamic', gravityScale: is3D(e) ? 1 : 0 }); },
      update(e, dt, s) {
        const inp = s.engine.input, a = p.control === 'drag' ? { x: 0, y: 0 } : inp.axis();
        const ax = p.axes === 'vertical' ? 0 : a.x, ay = p.axes === 'horizontal' ? 0 : a.y, b = e.body;
        const d = p.control !== 'joystick' ? inp.drag : { dx: 0, dy: 0 };
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
  ],
  create(p) {
    let coyote = 0, jumps = 0;
    return {
      start(e, s) {
        e.ensureBody({ type: 'dynamic' });
        if (!s.gravity) s.gravity = is3D(e) ? -25 : 1600;
      },
      update(e, dt, s) {
        const inp = s.engine.input, a = inp.axis(), b = e.body, up = is3D(e) ? 1 : -1;
        b.vel.x = a.x * p.speed;
        if (is3D(e)) b.vel.z = a.y * p.speed;
        if (b.grounded) { coyote = 0.12; jumps = 0; } else coyote -= dt;
        if (inp.pressed('jump') && (coyote > 0 || (p.doubleJump && jumps < 2))) {
          b.vel.y = p.jump * up; coyote = 0; jumps = jumps ? jumps + 1 : 1;
          s.engine.audio.sfx('jump');
        }
        if (!is3D(e) && a.x) e.sx = Math.abs(e.sx) * (a.x < 0 && e.data.flip ? -1 : 1);
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
        const c = s.spawn(p.template, { x: ox + pick(p.x), y: oy + pick(p.y), z: oz + pick(p.z) });
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
    { key: 'trigger', label: 'Fire when', type: 'select', options: ['auto', 'action button'], default: 'auto' },
  ],
  create(p) {
    let t = 0;
    return {
      update(e, dt, s) {
        t -= dt;
        if (t > 0) return;
        if (p.trigger !== 'auto' && !s.engine.input.isDown('action')) return;
        t = p.every;
        s.spawn(p.template, { x: e.x, y: e.y, z: e.z, ry: e.ry });
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
      start(e) { e.ensureBody({ type: 'kinematic', sensor: true }); },
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
      start(e) { if (!e.body) e.setBody({ type: 'kinematic', sensor: true }); },
      collide(e, other, s) {
        if (!other.has(p.tag) || other.dead || s.state !== 'play') return;
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
      start(e) { e.ensureBody({ type: 'kinematic', sensor: true }); },
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
    this.onVis = () => { if (document.hidden && this.scene?.state === 'play' && !this.editing) this.paused = true; };
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

  /** Start a game. Pass a function that builds a fresh Scene (used for restarts), a Scene, or scene JSON. */
  start(source) {
    if (typeof source === 'function') this.factory = source;
    else if (source instanceof Scene) this.factory = () => source;
    else this.factory = () => Scene.fromJSON(source);
    this.setScene(this.factory());
    return this.scene;
  }

  restart(skipTitle = true) {
    if (!this.factory) return;
    const s = this.factory();
    if (skipTitle && s.state === 'title') s.state = 'play';
    this.setScene(s);
  }

  setScene(scene) {
    scene.engine = this;
    this.scene = scene;
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
      const r = Math.min(44, this.width * 0.11), bottom = this.height - this.safe.bottom - m - r;
      if (s.settings.jumpButton) b.push({ action: 'jump', label: 'JUMP', x: this.width - this.safe.right - m - r, y: bottom, r, id: null });
      if (s.settings.actionButton) b.push({ action: 'action', label: 'FIRE', x: this.width - this.safe.right - m - r - (s.settings.jumpButton ? r * 2.4 : 0), y: bottom - (s.settings.jumpButton ? r * 0.9 : 0), r, id: null });
      if (s.settings.pauseButton) b.push({ action: 'pause', label: 'II', x: this.width / 2, y: this.safe.top + 30, r: 20, id: null });
    }
    this.input.buttons = b;
  }

  vibrate(p) { try { if (!this.audio.muted) navigator.vibrate?.(p); } catch { /* unsupported */ } }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(1 / 20, (now - this.last) / 1000);
    this.last = now;
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
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
    if (this.paused) { if (inp.pressed('tap') || inp.pressed('Escape') || inp.pressed('btn:pause')) this.paused = false; return; }
    if (inp.pressed('btn:pause') || inp.pressed('Escape') || inp.pressed('KeyP')) { if (s.state === 'play') { this.paused = true; return; } }
    if (s.state === 'title') {
      if (inp.pressed('tap') || inp.pressed('Space') || inp.pressed('Enter')) { s.state = 'play'; this.audio.sfx('click'); }
      s.time += dt; this.stepEffects(dt); return;
    }
    if (s.state !== 'play') {
      s.time += dt; this.stepEffects(dt);
      if (s.time - s.endTime > 0.8 && (inp.pressed('tap') || inp.pressed('Space') || inp.pressed('Enter'))) this.restart();
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
    const steps = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < steps; i++) this.physics.step(s, dt / steps);
    s.time += dt;
    if (s.settings.winScore && s.vars.score >= s.settings.winScore) s.win();
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
  VERSION, Engine, Scene, Entity, Camera2D, Camera3D, Physics, Input, Audio, Renderer2D, Renderer3D, anchorPoint,
  Behaviors, registerBehavior, paramDefault, M4, uid, clamp, lerp, rand, pick, DEG, hexToRgb, loadImage, storage: store,
};
export default Pocket;
