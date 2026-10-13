// Neon Dodge, written in code against the Pocket Engine API
// (the editor covers the same ground without code).
import { Engine, Scene, rand } from '../../engine/pocket.js';

const COLORS = { player: '#33f0ff', block: '#ff3dac', orb: '#ffd23d', shield: '#5dff8a', slow: '#a77bff' };

class NeonDodge extends Scene {
  constructor() {
    super({
      mode: '2d', name: 'Neon Dodge', background: '#0b0b1a', view: { width: 400, height: 700 },
      settings: { title: 'NEON DODGE', subtitle: 'Drag anywhere to steer · dodge the blocks', saveBest: 'neon-dodge' },
    });
  }

  init(engine) {
    engine.timeScale = 1;
    this.spawnT = 0.6;
    this.pickupT = 3;
    this.slowUntil = 0;

    // Parallax starfield, a plain hooks-object behavior
    for (let i = 0; i < 70; i++) {
      const z = rand(0.2, 1);
      this.add({
        layer: -10, x: rand(-200, 600), y: rand(-100, 800), alpha: z * 0.8,
        shape: { type: 'rect', w: z * 2.2, h: z * 5, fill: '#ffffff' },
        behaviors: [{
          update: (e, dt, s) => {
            const v = s.viewBounds();
            e.y += z * 90 * dt * (1 + this.difficulty() * 2);
            if (e.y > v.bottom) { e.y = v.top; e.x = rand(v.left, v.right); }
          },
        }],
      });
    }

    this.player = this.add({
      name: 'Player', tags: ['player'], x: 200, y: 560, layer: 5,
      shape: { type: 'triangle', w: 28, h: 34, fill: COLORS.player, glow: 20 },
      body: { type: 'dynamic', gravityScale: 0, shape: 'circle', r: 9 },
      behaviors: [{ type: 'move', control: 'drag', speed: 380 }, { type: 'timeScore', rate: 10 }],
    });

    this.ring = this.add({
      name: 'Shield', layer: 6, visible: false,
      shape: { type: 'circle', r: 28, fill: '', stroke: COLORS.shield, lineWidth: 3, glow: 14 },
      behaviors: [{
        update: (e, dt) => {
          const p = this.player, t = p.data.shield || 0;
          e.x = p.x; e.y = p.y;
          e.visible = t > 0 && !p.dead && !(t < 1.5 && Math.floor(t * 8) % 2 === 0);
          if (t > 0) p.data.shield = t - dt;
        },
      }],
    });

    this.add({ ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } });
    this.add({ ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: 'BEST {best}', size: 15, align: 'right', color: '#9aa0c8' } });
  }

  difficulty() { return Math.min(1, this.time / 90); }

  spawnBlock() {
    const d = this.difficulty(), v = this.viewBounds(), size = rand(22, 52 + 30 * d);
    this.add({
      name: 'Block',
      x: rand(v.left + size / 2, v.right - size / 2), y: v.top - size,
      shape: { type: 'rect', w: size, h: size, fill: 'rgba(255,61,172,0.18)', stroke: COLORS.block, lineWidth: 3, glow: 16 },
      behaviors: [
        { type: 'velocity', vy: rand(170, 250) + 260 * d, vx: Math.random() < 0.15 + 0.35 * d ? rand(-60, 60) : 0 },
        { type: 'rotate', speed: rand(-230, 230) },
        { type: 'hazard' },
        { type: 'destroyOffscreen' },
      ],
    });
  }

  spawnPickup() {
    const roll = Math.random(), v = this.viewBounds();
    const kind = roll < 0.7 ? 'orb' : roll < 0.87 ? 'shield' : 'slow';
    const pickup = this.add({
      name: kind, x: rand(v.left + 30, v.right - 30), y: v.top - 20,
      shape: { type: kind === 'orb' ? 'circle' : 'star', r: 10, w: 26, h: 26, fill: COLORS[kind], glow: 16 },
      behaviors: [
        { type: 'velocity', vy: 140 + 80 * this.difficulty() },
        { type: 'collectible', score: kind === 'orb' ? 10 : 0, sound: kind === 'orb' ? 'coin' : 'power' },
        { type: 'destroyOffscreen' },
      ],
    });
    if (kind !== 'orb') {
      pickup.addBehavior({
        collide: (e, other) => {
          if (!other.has('player')) return;
          if (kind === 'shield') other.data.shield = 6;
          else this.slowUntil = performance.now() + 4000;
        },
      });
    }
  }

  update(dt, engine) {
    const d = this.difficulty();
    if ((this.spawnT -= dt) <= 0) {
      this.spawnBlock();
      if (Math.random() < d * 0.4) this.spawnBlock();
      this.spawnT = 0.75 - 0.5 * d + Math.random() * 0.2;
    }
    if ((this.pickupT -= dt) <= 0) { this.spawnPickup(); this.pickupT = rand(1.6, 3.6); }
    engine.timeScale = performance.now() < this.slowUntil ? 0.5 : 1;
    this.background = engine.timeScale < 1 ? '#150f2a' : '#0b0b1a';
  }
}

const engine = new Engine();
engine.start(() => new NeonDodge());
window.engine = engine;
