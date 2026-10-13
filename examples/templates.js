// Starter games in Pocket's scene JSON format. The editor uses these as templates,
// and play.html?game=<key> plays them directly.

const hud = (extra = []) => [
  { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
  ...extra,
];

export const templates = {
  'sky-dodge': {
    version: 1, name: 'Sky Dodge', mode: '2d', background: '#101830', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'SKY DODGE', subtitle: 'Drag to move. Avoid the red, grab the stars.', saveBest: 'sky-dodge' },
    vars: { score: 0 },
    entities: [
      { id: 'player', name: 'Player', tags: ['player'], x: 200, y: 580, shape: { type: 'circle', r: 16, fill: '#33f0ff', glow: 16 },
        behaviors: [{ type: 'move', control: 'both', speed: 320 }, { type: 'timeScore', rate: 10 }] },
      { id: 'rock-spawner', name: 'Rock Spawner', x: 60, y: 40, behaviors: [{ type: 'spawner', template: 'Rock', every: [0.35, 0.8], x: [20, 380], y: -40, ramp: 0.15 }] },
      { id: 'star-spawner', name: 'Star Spawner', x: 340, y: 40, behaviors: [{ type: 'spawner', template: 'Star', every: [1.5, 3], x: [30, 370], y: -30, ramp: 0 }] },
      { id: 'rock', name: 'Rock', template: true, x: 120, y: 200, shape: { type: 'rect', w: 44, h: 44, radius: 8, fill: '#ff4d6d' },
        behaviors: [{ type: 'velocity', vy: [180, 280] }, { type: 'rotate', speed: 120 }, { type: 'hazard' }, { type: 'destroyOffscreen' }] },
      { id: 'star', name: 'Star', template: true, x: 280, y: 200, shape: { type: 'star', w: 32, h: 32, fill: '#ffd23d', glow: 10 },
        behaviors: [{ type: 'velocity', vy: 160 }, { type: 'rotate', speed: 180 }, { type: 'collectible', score: 25 }, { type: 'destroyOffscreen' }] },
      ...hud([{ id: 'hud-best', name: 'Best Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: 'BEST {best}', size: 15, align: 'right', color: '#9aa0c8' } }]),
    ],
  },

  'jump-quest': {
    version: 1, name: 'Jump Quest', levelName: 'Green Hills', mode: '2d', background: '#1d2b53', view: { width: 400, height: 700 }, gravity: 1600,
    settings: { title: 'JUMP QUEST', subtitle: 'Reach the green flag', joystick: true, jumpButton: true },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'player', name: 'Player', tags: ['player'], x: 60, y: 540, layer: 2, shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffd23d' },
        behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'damage' }, { type: 'cameraFollow', axes: 'x', smooth: 6 }] },
      ...[[300, 640, 600], [880, 640, 360], [1480, 640, 560]].map(([x, y, w], i) => ({
        id: 'ground' + i, name: 'Ground', x, y, shape: { type: 'rect', w, h: 60, fill: '#3a8a4f' }, body: { type: 'static' } })),
      ...[[520, 500, 140], [760, 410, 140], [1340, 470, 120]].map(([x, y, w], i) => ({
        id: 'plat' + i, name: 'Platform', x, y, shape: { type: 'rect', w, h: 20, radius: 6, fill: '#8a6a4f' }, body: { type: 'static' } })),
      { id: 'mover', name: 'Moving Platform', x: 1110, y: 520, shape: { type: 'rect', w: 120, h: 20, radius: 6, fill: '#c38b5f' }, body: { type: 'kinematic' },
        behaviors: [{ type: 'patrol', dx: 120, duration: 2.2 }] },
      ...[[520, 450], [760, 360], [900, 590], [1110, 470], [1340, 420], [1500, 590]].map(([x, y], i) => ({
        id: 'coin' + i, name: 'Coin', x, y, shape: { type: 'circle', r: 11, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] })),
      { id: 'spike', name: 'Spikes', x: 960, y: 598, shape: { type: 'triangle', w: 44, h: 24, fill: '#ff4d6d' }, behaviors: [{ type: 'hazard', action: 'damage' }] },
      { id: 'enemy', name: 'Enemy', x: 1450, y: 590, shape: { type: 'rect', w: 34, h: 34, radius: 10, fill: '#ff4d6d' },
        behaviors: [{ type: 'patrol', dx: 140, duration: 1.6 }, { type: 'hazard', action: 'damage' }] },
      { id: 'spring', name: 'Spring', x: 1250, y: 600, shape: { type: 'rect', w: 40, h: 20, radius: 4, fill: '#33f0ff' }, body: { type: 'static' }, behaviors: [{ type: 'spring', power: 950 }] },
      { id: 'goal', name: 'Goal Flag', x: 1700, y: 560, shape: { type: 'rect', w: 16, h: 100, fill: '#5dff8a' }, behaviors: [{ type: 'goal' }] },
      ...hud([{ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } }]),
    ],
    levels: [{
      levelName: 'The Locked Door', mode: '2d', background: '#2b1d43', view: { width: 400, height: 700 }, gravity: 1600,
      settings: { joystick: true, jumpButton: true }, vars: { keys: 0 },
      entities: [
        { id: 'l2-player', name: 'Player', tags: ['player'], x: 60, y: 540, layer: 2, shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffd23d' },
          behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'damage' }, { type: 'cameraFollow', axes: 'x', smooth: 6 }] },
        ...[[300, 640, 600], [1060, 640, 720]].map(([x, y, w], i) => ({
          id: 'l2-ground' + i, name: 'Ground', x, y, shape: { type: 'rect', w, h: 60, fill: '#5b4a8a' }, body: { type: 'static' } })),
        ...[[620, 520, 140], [840, 430, 140]].map(([x, y, w], i) => ({
          id: 'l2-plat' + i, name: 'Platform', x, y, shape: { type: 'rect', w, h: 20, radius: 6, fill: '#8a6a4f' }, body: { type: 'static' } })),
        { id: 'l2-sign', name: 'Sign', x: 170, y: 588, shape: { type: 'rect', w: 34, h: 44, radius: 4, fill: '#c38b5f' },
          behaviors: [{ type: 'message', text: 'Grab the key to open the door. Watch out for the ghost!', seconds: 3.5, once: true }] },
        { id: 'l2-key', name: 'Key', x: 840, y: 380, shape: { type: 'star', w: 32, h: 32, fill: '#ffd23d', glow: 12 },
          behaviors: [{ type: 'float', amount: 8, period: 1.4 }, { type: 'collectible', score: 1, var: 'keys', sound: 'power' }] },
        { id: 'l2-door', name: 'Door', x: 1180, y: 560, shape: { type: 'rect', w: 30, h: 100, radius: 4, fill: '#a0522d', stroke: '#ffd23d', lineWidth: 3 }, body: { type: 'static' },
          behaviors: [{ type: 'unlock', var: 'keys', amount: 1, text: 'The door is open!' }] },
        { id: 'l2-ghost', name: 'Ghost', x: 1000, y: 520, shape: { type: 'circle', r: 16, fill: '#ff4d6d', glow: 10 },
          behaviors: [{ type: 'chase', speed: 85, range: 260 }, { type: 'hazard', action: 'damage' }, { type: 'float', amount: 6, period: 1 }] },
        ...[[620, 470], [700, 590], [1300, 590], [1360, 590]].map(([x, y], i) => ({
          id: 'l2-coin' + i, name: 'Coin', x, y, shape: { type: 'circle', r: 11, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] })),
        { id: 'l2-goal', name: 'Goal Flag', x: 1380, y: 560, shape: { type: 'rect', w: 16, h: 100, fill: '#5dff8a' }, behaviors: [{ type: 'goal' }] },
        { id: 'l2-hud', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
        { id: 'l2-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
        { id: 'l2-keys', name: 'Keys Text', ui: true, anchor: 'top-left', x: 20, y: 70, text: { value: 'Keys {keys}', size: 16, align: 'left', color: '#ffd23d' } },
      ],
    }],
  },

  'gem-garden': {
    version: 1, name: 'Gem Garden', mode: '3d', background: '#8fc4ef', gravity: -25,
    settings: { title: 'GEM GARDEN', subtitle: 'Collect every gem. Avoid the red cubes.', joystick: true, winScore: 80 },
    vars: { score: 0, lives: 3 },
    camera: { position: { x: 0, y: 9, z: 11 }, target: { x: 0, y: 0, z: 0 }, fov: 55 },
    fog: { near: 25, far: 70 },
    entities: [
      { id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 24, h: 1, d: 24, color: '#6cc46c' }, body: { type: 'static' } },
      ...[[0, -12.5, 25, 1], [0, 12.5, 25, 1], [-12.5, 0, 1, 24], [12.5, 0, 1, 24]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 0.5, z, mesh: { geometry: 'box', w, h: 1.2, d, color: '#c9a77a' }, body: { type: 'static' } })),
      ...[[-5, -4], [5, 3], [-3, 6], [6, -6]].map(([x, z], i) => ({
        id: 'pillar' + i, name: 'Pillar', x, y: 1, z, mesh: { geometry: 'cylinder', r: 0.8, h: 2, color: '#e8e0d0' }, body: { type: 'static' } })),
      { id: 'player', name: 'Player', tags: ['player'], x: 0, y: 0.6, z: 0, mesh: { geometry: 'sphere', r: 0.6, color: '#3a7bff' },
        behaviors: [{ type: 'move', speed: 7, control: 'joystick' }, { type: 'cameraFollow', oy: 9, oz: 10, smooth: 5 }] },
      ...[[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -9], [0, 9], [-9, 0], [9, 0]].map(([x, z], i) => ({
        id: 'gem' + i, name: 'Gem', x, y: 0.9, z, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.6, h: 0.6, d: 0.6, color: '#ffd23d', emissive: 0.5 },
        behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'collectible', score: 10 }] })),
      ...[[[-6, 0], 0, 8], [[2, -9], 6, 0], [[9, 4], 0, -8]].map(([[x, z], dx, dz], i) => ({
        id: 'enemy' + i, name: 'Enemy', x, y: 0.5, z, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#ff4d6d' },
        behaviors: [{ type: 'patrol', dx, dz, duration: 2.5 + i * 0.4 }, { type: 'hazard', action: 'damage' }, { type: 'rotate', axis: 'y', speed: 90 }] })),
      ...hud([{ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } }]),
    ],
  },

  'tap-frenzy': {
    version: 1, name: 'Tap Frenzy', mode: '2d', background: '#16233b', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TAP FRENZY', subtitle: 'Pop the bubbles, avoid the bombs. 30 seconds!', saveBest: 'tap-frenzy', timeLimit: 30, orientation: 'portrait' },
    vars: { score: 0 },
    entities: [
      { id: 'bubble-spawner', name: 'Bubble Spawner', x: 60, y: 120, behaviors: [{ type: 'spawner', template: 'Bubble', every: [0.35, 0.7], x: [50, 350], y: [160, 640], ramp: 0.2, max: 12 }] },
      { id: 'bomb-spawner', name: 'Bomb Spawner', x: 340, y: 120, behaviors: [{ type: 'spawner', template: 'Bomb', every: [1.2, 2.2], x: [50, 350], y: [160, 640], ramp: 0.1, max: 4 }] },
      { id: 'bubble', name: 'Bubble', template: true, x: 120, y: 300, shape: { type: 'circle', r: 30, fill: 'rgba(80,200,255,0.35)', stroke: '#7fdcff', lineWidth: 3, glow: 10 },
        behaviors: [{ type: 'tappable', points: 10, destroy: true, sound: 'coin' }, { type: 'pulse', amount: 0.08, period: 0.9 }, { type: 'lifetime', seconds: 1.8 }] },
      { id: 'bomb', name: 'Bomb', template: true, x: 280, y: 300, shape: { type: 'circle', r: 26, fill: '#222', stroke: '#ff4d6d', lineWidth: 4 },
        behaviors: [{ type: 'tappable', points: -30, destroy: true, sound: 'hit' }, { type: 'pulse', amount: 0.15, period: 0.4 }, { type: 'lifetime', seconds: 1.6 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-time', name: 'Timer Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '{time}s', size: 24, align: 'right', color: '#ffd23d' } },
    ],
  },

  'fps-arena': {
    version: 1, name: 'Target Range', mode: '3d', background: '#9ec9ef', gravity: -25,
    settings: { title: 'TARGET RANGE', subtitle: 'Joystick to walk, drag to aim, hold FIRE to shoot', joystick: true, actionButton: true, jumpButton: true, winScore: 80, orientation: 'landscape' },
    vars: { score: 0, lives: 3 }, fog: { near: 30, far: 80 },
    camera: { position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1.6, z: 0 }, fov: 70 },
    entities: [
      { id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 40, h: 1, d: 40, color: '#7a9e6a' }, body: { type: 'static' } },
      ...[[0, -20, 41, 1], [0, 20, 41, 1], [-20, 0, 1, 40], [20, 0, 1, 40]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 1.5, z, mesh: { geometry: 'box', w, h: 3, d, color: '#c9b79c' }, body: { type: 'static' } })),
      ...[[-4, 2], [3, -1], [-7, -6], [6, -8], [0, -4]].map(([x, z], i) => ({
        id: 'crate' + i, name: 'Crate', x, y: 0.75, z, mesh: { geometry: 'box', w: 1.5, h: 1.5, d: 1.5, color: '#b58a5a' }, body: { type: 'static' } })),
      { id: 'player', name: 'Player', tags: ['player'], x: 0, y: 1, z: 8, mesh: { geometry: 'box', w: 0.8, h: 1.8, d: 0.8, color: '#4f8ef7' },
        behaviors: [{ type: 'firstPerson', speed: 6, look: 0.25, eye: 0.6, jump: 9 }, { type: 'shooter', template: 'Bullet', every: 0.18, trigger: 'action button' }] },
      { id: 'bullet', name: 'Bullet', template: true, tags: ['bullet'], x: 2, y: 1, z: 6, mesh: { geometry: 'sphere', r: 0.15, color: '#fff59d', emissive: 1 },
        behaviors: [{ type: 'projectile', speed: 30, life: 1.5 }] },
      ...[[-6, 2, -12], [-2, 3, -15], [3, 1.6, -13], [8, 2.4, -14], [-10, 1.8, -8], [11, 2.2, -4], [-12, 2.6, 4], [12, 1.8, 6]].map(([x, y, z], i) => ({
        id: 'target' + i, name: 'Target', x, y, z, mesh: { geometry: 'box', w: 1.2, h: 1.2, d: 0.4, color: '#e53935', emissive: 0.15 },
        behaviors: [{ type: 'destructible', hp: 1, hitBy: 'bullet', points: 10, removeHitter: true }, { type: 'float', amount: 0.3, period: 2 + i * 0.2 }] })),
      ...[[-14, -14], [14, -14]].map(([x, z], i) => ({
        id: 'drone' + i, name: 'Drone', x, y: 0.6, z, mesh: { geometry: 'sphere', r: 0.6, color: '#8e24aa' },
        behaviors: [{ type: 'chase', speed: 2.2, range: 14 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destructible', hp: 3, hitBy: 'bullet', points: 0 }] })),
      { id: 'crosshair', name: 'Crosshair', ui: true, anchor: 'center', x: 0, y: 0, text: { value: '+', size: 34, color: '#ffffff' } },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } },
    ],
  },

  'tps-adventure': {
    version: 1, name: 'Sky Islands', mode: '3d', background: '#a8d8f0', gravity: -25,
    settings: { title: 'SKY ISLANDS', subtitle: 'Joystick to run, drag to look around, JUMP between islands', joystick: true, jumpButton: true },
    vars: { score: 0, lives: 3 }, fog: { near: 35, far: 95 },
    entities: [
      ...[[0, -0.5, 0, 9, 9, '#6cc46c'], [0, 0.5, -11, 5, 5, '#78c878'], [7, 1.5, -18, 5, 5, '#6cc46c'], [0, 2.5, -26, 6, 6, '#78c878'], [-8, 3.5, -33, 5, 5, '#6cc46c'], [0, 4.5, -42, 9, 9, '#8bd38b']].map(([x, y, z, w, d, color], i) => ({
        id: 'island' + i, name: i === 5 ? 'Goal Island' : 'Island', x, y, z, mesh: { geometry: 'box', w, h: 1, d, color }, body: { type: 'static' } })),
      { id: 'player', name: 'Hero', tags: ['player'], x: 0, y: 1, z: 2, mesh: { geometry: 'cylinder', r: 0.4, h: 1.4, color: '#ff8a3d' },
        behaviors: [{ type: 'thirdPerson', speed: 6, jump: 10, distance: 7, height: 25, look: 0.3 }] },
      ...[[0, 1.6, -11], [7, 2.6, -18], [0, 3.6, -26], [-8, 4.6, -33], [2, 5.6, -42], [-2, 5.6, -42]].map(([x, y, z], i) => ({
        id: 'gem' + i, name: 'Gem', x, y, z, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.5, h: 0.5, d: 0.5, color: '#4dd0e1', emissive: 0.5 },
        behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'float', amount: 0.2, period: 1.5 }, { type: 'collectible', score: 10 }] })),
      { id: 'cp', name: 'Checkpoint', x: 0, y: 3.75, z: -24, mesh: { geometry: 'cylinder', r: 0.15, h: 1.5, color: '#90a4ae' }, behaviors: [{ type: 'checkpoint', text: 'Checkpoint!' }] },
      { id: 'enemy', name: 'Spiky', x: -8, y: 4.5, z: -33, mesh: { geometry: 'cone', r: 0.5, h: 1, color: '#e53935' },
        behaviors: [{ type: 'patrol', dx: 3, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'damage' }] },
      { id: 'goal', name: 'Goal', x: 0, y: 6, z: -44, mesh: { geometry: 'cylinder', r: 0.7, h: 2, color: '#ffd23d', emissive: 0.5, opacity: 0.8 }, behaviors: [{ type: 'goal' }, { type: 'rotate', axis: 'y', speed: 60 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } },
    ],
  },

  'racer': {
    version: 1, name: 'Desert Rally', mode: '3d', background: '#f2d3a0', gravity: -25,
    settings: { title: 'DESERT RALLY', subtitle: 'Push the joystick up to drive. Grab every flag before time runs out!', joystick: true, timeLimit: 60, winScore: 120, orientation: 'landscape' },
    vars: { score: 0 }, fog: { near: 40, far: 120 },
    entities: [
      { id: 'ground', name: 'Desert', locked: true, y: -0.5, mesh: { geometry: 'box', w: 120, h: 1, d: 120, color: '#d9b27a' }, body: { type: 'static' } },
      ...[[0, -60, 121, 1], [0, 60, 121, 1], [-60, 0, 1, 120], [60, 0, 1, 120]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 1, z, mesh: { geometry: 'box', w, h: 2, d, color: '#b08860' }, body: { type: 'static' } })),
      { id: 'car', name: 'Car', tags: ['player'], x: 0, y: 0.5, z: 30, ry: 90, mesh: { geometry: 'box', w: 1.4, h: 0.8, d: 2.4, color: '#e53935' },
        behaviors: [{ type: 'car', maxSpeed: 18, accel: 12, turn: 110, autoGas: false, chaseCam: true }] },
      ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return {
        id: 'flag' + i, name: 'Flag', x: Math.round(Math.sin(a) * 30 * 10) / 10, y: 1.5, z: Math.round(Math.cos(a) * 30 * 10) / 10,
        mesh: { geometry: 'cylinder', r: 0.5, h: 3, color: '#ffd23d', emissive: 0.5 }, behaviors: [{ type: 'collectible', score: 10 }, { type: 'pulse', amount: 0.1, period: 1 }] }; }),
      ...[[8, 12], [-10, 6], [15, -12], [-18, -20], [0, -5], [22, 18], [-25, 25], [5, -28]].map(([x, z], i) => ({
        id: 'rock' + i, name: 'Rock', x, y: 0.8, z, mesh: { geometry: 'cone', r: 1.2, h: 1.6, color: '#8d6e63' }, body: { type: 'static' } })),
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-time', name: 'Timer Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '{time}s', size: 26, align: 'right', color: '#5d4037' } },
    ],
  },

  'idle-clicker': {
    version: 1, name: 'Cookie Tap', mode: '2d', background: '#3b2a20', view: { width: 400, height: 700 }, gravity: 0,
    settings: { orientation: 'portrait', pauseButton: false, muteButton: false, saveProgress: true },
    vars: { score: 0, perSecond: 0, perTap: 0 },
    entities: [
      { id: 'bank', name: 'Bank', x: 40, y: 40, behaviors: [{ type: 'income', var: 'score', rateVar: 'perSecond' }] },
      { id: 'cookie', name: 'Cookie', x: 200, y: 280, shape: { type: 'circle', r: 95, fill: '#c68642', stroke: '#8d5524', lineWidth: 8 },
        behaviors: [{ type: 'tappable', points: 1, var: 'score', bonusVar: 'perTap', destroy: false, sound: 'click' }, { type: 'pulse', amount: 0.03, period: 1.2 }] },
      ...[[170, 245], [230, 300], [185, 330], [235, 240], [150, 300]].map(([x, y], i) => ({
        id: 'chip' + i, name: 'Chip', x, y, layer: 1, shape: { type: 'circle', r: 9, fill: '#4e342e' } })),
      { id: 'hud-score', name: 'Cookies', ui: true, anchor: 'top', x: 0, y: 56, text: { value: '{score}', size: 46, color: '#ffe0b2' } },
      { id: 'hud-rate', name: 'Rate', ui: true, anchor: 'top', x: 0, y: 100, text: { value: 'cookies · {perSecond} per second', size: 16, color: '#d7ccc8', weight: '600' } },
      { id: 'up1', name: 'Auto Baker', ui: true, anchor: 'bottom', x: 0, y: -250, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#5d4037' },
        text: { value: 'Auto Baker  +1/s  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 15, costVar: 'score', addVar: 'perSecond', amount: 1, growth: 1.15 }] },
      { id: 'up2', name: 'Strong Fingers', ui: true, anchor: 'bottom', x: 0, y: -175, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#5d4037' },
        text: { value: 'Strong Fingers  +1/tap  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 25, costVar: 'score', addVar: 'perTap', amount: 1, growth: 1.3 }] },
      { id: 'up3', name: 'Bakery', ui: true, anchor: 'bottom', x: 0, y: -100, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#6d4c41' },
        text: { value: 'Bakery  +8/s  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 200, costVar: 'score', addVar: 'perSecond', amount: 8, growth: 1.2 }] },
    ],
  },

  'space-shooter': {
    version: 1, name: 'Star Defender', mode: '2d', background: '#0a0f24', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'STAR DEFENDER', subtitle: 'Drag to move. Your ship fires on its own.', saveBest: 'star-defender', orientation: 'portrait' },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'ship', name: 'Ship', tags: ['player'], x: 200, y: 600, layer: 3, shape: { type: 'triangle', w: 40, h: 46, fill: '#4fc3f7', glow: 12 },
        behaviors: [{ type: 'move', control: 'drag', speed: 300, axes: 'all', keepInView: true }, { type: 'shooter', template: 'Bullet', every: 0.22, trigger: 'auto' }] },
      { id: 'bullet', name: 'Bullet', template: true, tags: ['bullet'], x: 60, y: 520, shape: { type: 'rect', w: 5, h: 16, radius: 2, fill: '#fff59d' },
        behaviors: [{ type: 'projectile', speed: 700, life: 1.2 }] },
      { id: 'alien', name: 'Alien', template: true, x: 120, y: 160, shape: { type: 'rect', w: 38, h: 30, radius: 9, fill: '#ab47bc' },
        behaviors: [{ type: 'velocity', vy: [90, 160] }, { type: 'destructible', hp: 1, hitBy: 'bullet', points: 10 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destroyOffscreen' }] },
      { id: 'boss', name: 'Big Alien', template: true, x: 280, y: 160, shape: { type: 'rect', w: 70, h: 50, radius: 14, fill: '#e53935', glow: 8 },
        behaviors: [{ type: 'velocity', vy: 55 }, { type: 'destructible', hp: 6, hitBy: 'bullet', points: 60 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destroyOffscreen' }] },
      { id: 'star', name: 'Star Dust', template: true, layer: -5, x: 200, y: 100, shape: { type: 'rect', w: 2, h: 6, fill: 'rgba(255,255,255,0.6)' },
        behaviors: [{ type: 'velocity', vy: [180, 320] }, { type: 'destroyOffscreen' }] },
      { id: 'sp1', name: 'Alien Spawner', x: 60, y: 40, behaviors: [{ type: 'spawner', template: 'Alien', every: [0.6, 1.2], x: [30, 370], y: -40, ramp: 0.15, max: 30 }] },
      { id: 'sp2', name: 'Boss Spawner', x: 200, y: 40, behaviors: [{ type: 'spawner', template: 'Big Alien', every: [6, 9], x: [60, 340], y: -60, ramp: 0.05, max: 3 }] },
      { id: 'sp3', name: 'Star Spawner', x: 340, y: 40, behaviors: [{ type: 'spawner', template: 'Star Dust', every: [0.05, 0.15], x: [0, 400], y: -10, ramp: 0, max: 80 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
    ],
  },

  'lane-runner': {
    version: 1, name: 'Lane Rush', mode: '3d', background: '#7ec8e3', gravity: -25,
    settings: { title: 'LANE RUSH', subtitle: 'Swipe left/right to dodge, swipe up to jump', saveBest: 'lane-rush', orientation: 'portrait' },
    vars: { score: 0 }, fog: { near: 25, far: 70 },
    camera: { position: { x: 0, y: 5, z: 8 }, target: { x: 0, y: 0.5, z: -4 }, fov: 60 },
    entities: [
      { id: 'road', name: 'Road', locked: true, y: -0.5, z: -80, mesh: { geometry: 'box', w: 9, h: 1, d: 200, color: '#5d6d7e' }, body: { type: 'static' } },
      ...[-1.25, 1.25].map((x, i) => ({ id: 'stripe' + i, name: 'Lane Line', locked: true, x, y: 0.01, z: -80, mesh: { geometry: 'plane', w: 0.12, d: 200, color: '#ecf0f1' } })),
      { id: 'runner', name: 'Runner', tags: ['player'], x: 0, y: 0.5, z: 0, mesh: { geometry: 'box', w: 0.8, h: 1, d: 0.8, color: '#ffca28' },
        behaviors: [{ type: 'swipeMove', distance: 2.5, lanes: 3, jump: 9 }, { type: 'timeScore', rate: 10 }] },
      { id: 'block', name: 'Barrier', template: true, x: -3, y: 0.6, z: -10, mesh: { geometry: 'box', w: 1.8, h: 1.2, d: 0.8, color: '#e53935' },
        behaviors: [{ type: 'velocity', vz: 16 }, { type: 'hazard', action: 'gameover' }, { type: 'destroyOffscreen', margin: 80 }] },
      { id: 'coin', name: 'Coin', template: true, x: 3, y: 0.8, z: -10, rx: 90, mesh: { geometry: 'cylinder', r: 0.35, h: 0.1, color: '#ffd23d', emissive: 0.6 },
        behaviors: [{ type: 'velocity', vz: 16 }, { type: 'collectible', score: 25 }, { type: 'destroyOffscreen', margin: 80 }] },
      { id: 'sp1', name: 'Barrier Spawner', x: -3, y: 2, z: -20, behaviors: [{ type: 'spawner', template: 'Barrier', every: [0.55, 1.1], x: [-2.5, 2.5], y: 0.6, z: -60, ramp: 0.12, max: 40, snap: 2.5, clear: 2 }] },
      { id: 'sp2', name: 'Coin Spawner', x: 3, y: 2, z: -20, behaviors: [{ type: 'spawner', template: 'Coin', every: [0.35, 0.8], x: [-2.5, 2.5], y: 0.8, z: -60, ramp: 0.12, max: 40, snap: 2.5, clear: 2 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-best', name: 'Best Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: 'BEST {best}', size: 15, align: 'right', color: '#1b4f72' } },
    ],
  },

  'breakout': {
    version: 1, name: 'Brick Breaker', mode: '2d', background: '#14142b', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'BRICK BREAKER', subtitle: 'Drag to move the paddle. Break every brick!', orientation: 'portrait', winScore: 350, saveBest: 'brick-breaker' },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'paddle', name: 'Paddle', tags: ['player'], x: 200, y: 630, shape: { type: 'rect', w: 90, h: 16, radius: 8, fill: '#4fc3f7', glow: 10 }, body: { type: 'kinematic' },
        behaviors: [{ type: 'move', control: 'drag', speed: 0, axes: 'horizontal', keepInView: true }] },
      { id: 'ball', name: 'Ball', tags: ['ball'], x: 200, y: 560, shape: { type: 'circle', r: 9, fill: '#ffffff', glow: 8 },
        behaviors: [{ type: 'bounce', speed: 360, bottom: 'lose a life' }] },
      ...Array.from({ length: 35 }, (_, i) => {
        const row = Math.floor(i / 7), col = i % 7;
        return { id: 'brick' + i, name: 'Brick', x: 44 + col * 52, y: 130 + row * 28, shape: { type: 'rect', w: 46, h: 20, radius: 4, fill: ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5'][row] },
          body: { type: 'static' }, behaviors: [{ type: 'destructible', hp: 1, hitBy: 'ball', points: 10, removeHitter: false }] };
      }),
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
    ],
  },

  'rpg-battle': {
    version: 1, name: 'Slime Battle', mode: '2d', background: '#1e2a38', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'SLIME BATTLE', subtitle: 'A turn-based fight. Pick an action each turn.', turnBased: true, turnDelay: 1, orientation: 'portrait', pauseButton: false, messageTop: true },
    vars: { hp: 60, mp: 12, enemyHp: 90, score: 0 },
    entities: [
      { id: 'floor', name: 'Floor', x: 200, y: 360, shape: { type: 'rect', w: 400, h: 120, fill: '#2c3e50' } },
      { id: 'slime', name: 'Slime', x: 200, y: 270, shape: { type: 'circle', r: 70, fill: '#66bb6a', stroke: '#2e7d32', lineWidth: 6 },
        behaviors: [{ type: 'turnOpponent', var: 'hp', amount: [-12, -6], text: 'The slime bounces on you for {n}!' }, { type: 'pulse', amount: 0.04, period: 1.4 }] },
      ...[[175, 255], [225, 255]].map(([x, y], i) => ({ id: 'eye' + i, name: 'Eye', x, y, layer: 1, shape: { type: 'circle', r: 9, fill: '#1b1b1b' } })),
      { id: 'enemy-hp', name: 'Enemy HP', ui: true, anchor: 'top', x: 0, y: 104, text: { value: 'Slime  HP {enemyHp}', size: 22, color: '#a5d6a7' } },
      { id: 'turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 72, text: { value: '{turnText}', size: 18, color: '#ffd23d', weight: '700' } },
      { id: 'hp', name: 'Player HP', ui: true, anchor: 'bottom-left', x: 24, y: -300, text: { value: 'HP {hp}', size: 22, align: 'left', color: '#ef9a9a' } },
      { id: 'mp', name: 'Player MP', ui: true, anchor: 'bottom-right', x: -24, y: -300, text: { value: 'MP {mp}', size: 22, align: 'right', color: '#90caf9' } },
      ...[
        ['Attack', 'enemyHp', [-14, -8], 0, '', 0, 'You strike for {n}!', 'hit', '#455a64', -230],
        ['Fireball  (4 MP)', 'enemyHp', [-26, -18], 0, 'mp', 4, 'Fireball! {n} damage!', 'power', '#bf360c', -160],
        ['Heal  (3 MP)', 'hp', [14, 22], 60, 'mp', 3, 'You heal {n} HP.', 'coin', '#2e7d32', -90],
      ].map(([label, v, amount, max, costVar, cost, text, sound, fill, y], i) => ({
        id: 'act' + i, name: label.split(' ')[0] + ' Button', ui: true, anchor: 'bottom', x: 0, y,
        shape: { type: 'rect', w: 330, h: 58, radius: 14, fill }, text: { value: label, size: 20, color: '#ffffff' },
        behaviors: [{ type: 'turnAction', var: v, amount, max, costVar, cost, text, sound }] })),
      { id: 'win', name: 'Win Check', x: 30, y: 30, behaviors: [{ type: 'condition', var: 'enemyHp', op: '<=', target: 0, action: 'win', value: '', amount: 1, sound: 'none' }] },
      { id: 'lose', name: 'Lose Check', x: 370, y: 30, behaviors: [{ type: 'condition', var: 'hp', op: '<=', target: 0, action: 'game over', value: '', amount: 1, sound: 'none' }] },
    ],
  },

  'dungeon': {
    version: 1, name: 'Tiny Dungeon', mode: '2d', background: '#120f1a', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TINY DUNGEON', subtitle: 'Turn-based: swipe or tap to step. Bump monsters to fight. Reach the stairs!', turnBased: true, turnDelay: 0.15, orientation: 'portrait' },
    vars: { score: 0, lives: 3 },
    entities: (() => {
      const map = ['#########', '#P..#..c#', '#.#.#.#.#', '#.#...#.#', '#.##E##.#', '#c......#', '###.#.###', '#...#..E#', '#.#c#.#.#', '#.#.....#', '#E..##.c#', '#..#...G#', '#########'];
      const out = [], at = (c, r) => ({ x: 40 + c * 40, y: 130 + r * 40 });
      map.forEach((row, r) => [...row].forEach((ch, c) => {
        const { x, y } = at(c, r), id = `t${r}_${c}`;
        if (ch === '#') out.push({ id, name: 'Wall', x, y, shape: { type: 'rect', w: 40, h: 40, fill: '#4a3f5c', stroke: '#2b2438', lineWidth: 2 }, body: { type: 'static' } });
        else out.push({ id: id + 'f', name: 'Floor', layer: -1, x, y, shape: { type: 'rect', w: 40, h: 40, fill: (r + c) % 2 ? '#211b2d' : '#1c1726' } });
        if (ch === 'P') out.push({ id: 'hero', name: 'Hero', tags: ['player'], layer: 3, x, y, shape: { type: 'circle', r: 15, fill: '#4fc3f7' }, behaviors: [{ type: 'gridMove', tile: 40, tapToMove: true, damage: 1 }] });
        if (ch === 'E') out.push({ id: id + 'e', name: 'Goblin', layer: 2, x, y, shape: { type: 'rect', w: 28, h: 28, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'gridEnemy', tile: 40, hp: 2, points: 25, sight: 5 }] });
        if (ch === 'c') out.push({ id: id + 'c', name: 'Gold', layer: 1, x, y, shape: { type: 'star', w: 22, h: 22, fill: '#ffd23d' }, behaviors: [{ type: 'collectible', score: 10 }] });
        if (ch === 'G') out.push({ id: 'stairs', name: 'Stairs', layer: 1, x, y, shape: { type: 'rect', w: 30, h: 30, radius: 4, fill: '#66bb6a' }, behaviors: [{ type: 'goal' }] });
      }));
      out.push({ id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 28, align: 'left' } });
      out.push({ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } });
      out.push({ id: 'hud-turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Turn {turn} · {turnText}', size: 15, color: '#b39ddb', weight: '600' } });
      return out;
    })(),
  },

  'tic-tac-toe': {
    version: 1, name: 'Tic-Tac-Toe', mode: '2d', background: '#1b2433', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TIC-TAC-TOE', subtitle: 'Three in a row beats the computer', turnBased: true, orientation: 'portrait', pauseButton: false },
    vars: { score: 0 },
    entities: [
      ...Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3), c = i % 3;
        return { id: 'cell' + i, name: `Cell ${r + 1}-${c + 1}`, x: 90 + c * 110, y: 240 + r * 110, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' },
          behaviors: [{ type: 'boardCell', row: r, col: c, line: 3, vsComputer: true }] };
      }),
      { id: 'hud-turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 96, text: { value: '{turnText}', size: 22, color: '#ffd23d' } },
    ],
  },

  'voxel-world': {
    version: 1, name: 'Block Craft', mode: '3d', background: '#8fd0ff', gravity: -25,
    settings: { title: 'BLOCK CRAFT', subtitle: 'Left thumb: walk. Right thumb: drag to look, hold on a block to mine it, tap to place. Pick blocks in the hotbar.', joystick: true, jumpButton: true, pauseButton: true, orientation: 'landscape' },
    vars: { score: 0, blocks: 0 }, fog: { near: 22, far: 52 }, light: { dir: { x: -0.5, y: -1, z: -0.3 }, color: '#ffffff', ambient: 0.5 },
    camera: { position: { x: 0, y: 14, z: 14 }, target: { x: 0, y: 4, z: 0 }, fov: 70 },
    entities: [
      { id: 'world', name: 'World', voxels: { size: 1, gen: { type: 'hills', w: 48, d: 48, h: 7, seed: 7, trees: true }, edits: {} } },
      { id: 'player', name: 'Player', tags: ['player'], x: 0.5, y: 14, z: 0.5, mesh: { geometry: 'box', w: 0.6, h: 1.7, d: 0.6, color: '#4f8ef7' },
        behaviors: [{ type: 'firstPerson', speed: 4.3, look: 0.3, eye: 0.65, jump: 8.5, autoJump: true }, { type: 'voxelBuilder', reach: 5, controls: 'hold to mine', aim: 'finger', hotbar: '1,2,3,4,5,6,8,9,12', inventory: 'creative', mineSpeed: 1 }] },
      { id: 'hud', name: 'Blocks Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: 'Mined {blocks}', size: 20, align: 'left' } },
    ],
  },

  'empty-2d': {
    version: 1, name: 'Empty 2D', mode: '2d', background: '#0b0b1a', view: { width: 400, height: 700 }, gravity: 1600,
    settings: {}, vars: { score: 0 }, entities: [],
  },
  'empty-3d': {
    version: 1, name: 'Empty 3D', mode: '3d', background: '#8fc4ef', gravity: -25,
    settings: {}, vars: { score: 0 },
    camera: { position: { x: 0, y: 8, z: 12 }, target: { x: 0, y: 0, z: 0 }, fov: 60 },
    entities: [{ id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 20, h: 1, d: 20, color: '#6cc46c' }, body: { type: 'static' } }],
  },
};

/** Game types for the editor's "New Game" screen. */
export const templateInfo = [
  { key: 'jump-quest', title: 'Platformer', blurb: 'Run & jump, 2 levels', icon: 'jumper', color: '#2d3f6b' },
  { key: 'tps-adventure', title: 'Third Person', blurb: '3D adventure, follow camera', icon: 'player', color: '#3c6e8f' },
  { key: 'fps-arena', title: 'First Person', blurb: '3D shooter, look & aim', icon: 'crosshair', color: '#4a5a3a' },
  { key: 'gem-garden', title: 'Top Down 3D', blurb: 'Joystick, collect, avoid', icon: 'cube', color: '#3f6d4a' },
  { key: 'sky-dodge', title: 'Top Down 2D', blurb: 'Dodge and collect', icon: 'star', color: '#22314f' },
  { key: 'space-shooter', title: 'Space Shooter', blurb: 'Waves of enemies', icon: 'bolt', color: '#141b3a' },
  { key: 'racer', title: 'Racing', blurb: 'Drive, beat the clock', icon: 'car', color: '#8a6a3a' },
  { key: 'lane-runner', title: 'Endless Runner', blurb: 'Swipe between lanes', icon: 'arrow', color: '#2f6f8f' },
  { key: 'idle-clicker', title: 'Clicker / Idle', blurb: 'Tap, earn, upgrade (saves progress)', icon: 'hand', color: '#5d4037' },
  { key: 'voxel-world', title: 'Voxel Sandbox', blurb: 'Minecraft-style mine & build', icon: 'cube', color: '#4e7d3a' },
  { key: 'rpg-battle', title: 'Turn-Based RPG', blurb: 'Pick attacks, heals and spells', icon: 'bolt', color: '#2e4057' },
  { key: 'dungeon', title: 'Dungeon Crawler', blurb: 'Turn-based grid adventure', icon: 'door', color: '#3b2f4f' },
  { key: 'tic-tac-toe', title: 'Board Game', blurb: 'Tic-tac-toe vs the computer', icon: 'grid', color: '#2a3550' },
  { key: 'breakout', title: 'Breakout', blurb: 'Bounce the ball, break bricks', icon: 'square', color: '#2a2450' },
  { key: 'tap-frenzy', title: 'Tap Arcade', blurb: 'Quick tap reflex game', icon: 'circle', color: '#16233b' },
  { key: 'empty-2d', title: 'Blank 2D', blurb: 'Start from nothing', icon: 'grid', color: '#2b2b2b' },
  { key: 'empty-3d', title: 'Blank 3D', blurb: 'Just a floor', icon: 'cube', color: '#2f3a44' },
];
