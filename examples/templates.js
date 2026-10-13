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

  'empty-2d': {
    version: 1, name: 'Empty 2D', mode: '2d', background: '#0b0b1a', view: { width: 400, height: 700 }, gravity: 0,
    settings: {}, vars: { score: 0 }, entities: [],
  },
  'empty-3d': {
    version: 1, name: 'Empty 3D', mode: '3d', background: '#8fc4ef', gravity: -25,
    settings: {}, vars: { score: 0 },
    camera: { position: { x: 0, y: 8, z: 12 }, target: { x: 0, y: 0, z: 0 }, fov: 60 },
    entities: [{ id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 20, h: 1, d: 20, color: '#6cc46c' }, body: { type: 'static' } }],
  },
};

export const templateInfo = [
  { key: 'sky-dodge', title: 'Sky Dodge', blurb: '2D dodger with spawners' },
  { key: 'jump-quest', title: 'Jump Quest', blurb: '2D platformer, 2 levels' },
  { key: 'gem-garden', title: 'Gem Garden', blurb: '3D collect-a-thon' },
  { key: 'tap-frenzy', title: 'Tap Frenzy', blurb: 'Tap-only arcade, made for phones' },
  { key: 'empty-2d', title: 'Empty 2D', blurb: 'Blank canvas' },
  { key: 'empty-3d', title: 'Empty 3D', blurb: 'Just a floor' },
];
