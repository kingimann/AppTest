// Ready-made content for the editor: emoji sprites (2D), part-based models (3D) and UI widgets.

export const EMOJI = {
  Characters: ['🧙', '🧝', '🦸', '🥷', '🧑‍🚀', '🤖', '👽', '🐱', '🐶', '🐸', '🐵', '🐧', '🦊', '🐰', '🐻', '🐼', '🦄', '🐢', '🐤', '🐙'],
  Enemies: ['👾', '👻', '💀', '🐉', '🦇', '🕷️', '🐍', '🦈', '🧟', '👹', '🦖', '🐝', '🦂', '🐊', '🧛', '🤡'],
  Items: ['💎', '🪙', '🔑', '❤️', '⭐', '🍄', '🎁', '💣', '🗡️', '🛡️', '🏹', '🧪', '🔮', '🏆', '💰', '⚡', '🧲', '🪄', '📜', '🔦'],
  Nature: ['🌳', '🌲', '🌴', '🌵', '🪨', '🔥', '💧', '🌸', '🍀', '☁️', '🌙', '☀️', '❄️', '🌊', '🌋', '🌈'],
  Food: ['🍎', '🍌', '🍒', '🍕', '🍔', '🍩', '🍪', '🧁', '🥕', '🍉', '🍓', '🧀'],
  Vehicles: ['🚗', '🏎️', '🚓', '🚌', '🚀', '🛸', '✈️', '🚁', '🚂', '⛵', '🛶', '🚲'],
  Places: ['🏠', '🏰', '🏯', '⛺', '🚩', '🪜', '🧱', '📦', '🚪', '⛲', '🗿', '🎯'],
};

const P = (geometry, x, y, z, size, color, extra = {}) => ({ geometry, x, y, z, ...size, color, ...extra });

/** Models are lists of primitive parts (positions relative to the object; y = 0 is the ground). */
export const MODELS_3D = [
  { icon: 'star', label: 'Tree', parts: [P('cylinder', 0, 0.6, 0, { r: 0.18, h: 1.2 }, '#795548'), P('sphere', 0, 1.6, 0, { r: 0.8 }, '#43a047')] },
  { icon: 'cone', label: 'Pine', parts: [P('cylinder', 0, 0.4, 0, { r: 0.15, h: 0.8 }, '#6d4c41'), P('cone', 0, 1.2, 0, { r: 0.8, h: 1.2 }, '#2e7d32'), P('cone', 0, 1.9, 0, { r: 0.55, h: 1 }, '#388e3c')] },
  { icon: 'home', label: 'House', parts: [P('box', 0, 0.75, 0, { w: 2, h: 1.5, d: 2 }, '#f3e5ab'), P('pyramid', 0, 2, 0, { w: 2.5, h: 1, d: 2.5 }, '#c0392b'),
    P('box', 0, 0.45, 1.01, { w: 0.5, h: 0.9, d: 0.06 }, '#6d4c41'), P('box', -0.6, 0.95, 1.01, { w: 0.4, h: 0.4, d: 0.06 }, '#81d4fa'), P('box', 0.6, 0.95, 1.01, { w: 0.4, h: 0.4, d: 0.06 }, '#81d4fa')] },
  { icon: 'player', label: 'Character', parts: [P('box', -0.15, 0.35, 0, { w: 0.22, h: 0.7, d: 0.25 }, '#3949ab'), P('box', 0.15, 0.35, 0, { w: 0.22, h: 0.7, d: 0.25 }, '#3949ab'),
    P('box', 0, 0.95, 0, { w: 0.6, h: 0.6, d: 0.32 }, '#e53935'), P('box', -0.4, 0.95, 0, { w: 0.18, h: 0.6, d: 0.2 }, '#ffcc80'), P('box', 0.4, 0.95, 0, { w: 0.18, h: 0.6, d: 0.2 }, '#ffcc80'),
    P('box', 0, 1.5, 0, { w: 0.45, h: 0.45, d: 0.45 }, '#ffcc80'), P('box', 0, 1.62, -0.01, { w: 0.48, h: 0.2, d: 0.48 }, '#5d4037')] },
  { icon: 'cube', label: 'Robot', parts: [P('box', 0, 0.9, 0, { w: 0.8, h: 0.9, d: 0.5 }, '#90a4ae'), P('box', 0, 1.6, 0, { w: 0.55, h: 0.45, d: 0.45 }, '#b0bec5'),
    P('box', -0.12, 1.63, -0.23, { w: 0.1, h: 0.1, d: 0.02 }, '#00e5ff', { emissive: 1 }), P('box', 0.12, 1.63, -0.23, { w: 0.1, h: 0.1, d: 0.02 }, '#00e5ff', { emissive: 1 }),
    P('cylinder', 0, 1.95, 0, { r: 0.03, h: 0.25 }, '#607d8b'), P('sphere', 0, 2.1, 0, { r: 0.07 }, '#ff5252', { emissive: 1 }),
    P('box', -0.25, 0.25, 0, { w: 0.22, h: 0.5, d: 0.3 }, '#607d8b'), P('box', 0.25, 0.25, 0, { w: 0.22, h: 0.5, d: 0.3 }, '#607d8b')] },
  { icon: 'car', label: 'Car', parts: [P('box', 0, 0.45, 0, { w: 1.6, h: 0.5, d: 3 }, '#e53935'), P('box', 0, 0.9, 0.2, { w: 1.3, h: 0.45, d: 1.5 }, '#ef9a9a'),
    ...[[-0.8, -1], [0.8, -1], [-0.8, 1], [0.8, 1]].map(([x, z]) => P('cylinder', x, 0.3, z, { r: 0.3, h: 0.25 }, '#212121', { rz: 90 }))] },
  { icon: 'arrow', label: 'Rocket', parts: [P('cylinder', 0, 1.2, 0, { r: 0.4, h: 1.8 }, '#eceff1'), P('cone', 0, 2.5, 0, { r: 0.4, h: 0.8 }, '#e53935'),
    P('sphere', 0, 1.6, -0.36, { r: 0.15 }, '#4fc3f7'), ...[0, 120, 240].map((a) => P('wedge', Math.sin(a * Math.PI / 180) * 0.45, 0.45, Math.cos(a * Math.PI / 180) * 0.45, { w: 0.08, h: 0.6, d: 0.5 }, '#e53935', { ry: a + 180 }))] },
  { icon: 'coin', label: 'Chest', parts: [P('box', 0, 0.3, 0, { w: 1, h: 0.6, d: 0.7 }, '#8d6e63'), P('box', 0, 0.68, 0, { w: 1.04, h: 0.18, d: 0.74 }, '#6d4c41'), P('box', 0, 0.5, 0.36, { w: 0.14, h: 0.2, d: 0.04 }, '#ffd54f', { emissive: 0.3 })] },
  { icon: 'sun', label: 'Lamp Post', parts: [P('cylinder', 0, 1.25, 0, { r: 0.06, h: 2.5 }, '#455a64'), P('sphere', 0, 2.6, 0, { r: 0.25 }, '#fff59d', { emissive: 1 }), P('cylinder', 0, 0.05, 0, { r: 0.25, h: 0.1 }, '#37474f')] },
  { icon: 'circle', label: 'Snowman', parts: [P('sphere', 0, 0.5, 0, { r: 0.5 }, '#fafafa'), P('sphere', 0, 1.18, 0, { r: 0.36 }, '#fafafa'), P('sphere', 0, 1.7, 0, { r: 0.25 }, '#fafafa'),
    P('cone', 0, 1.7, -0.32, { r: 0.05, h: 0.25 }, '#ff7043', { rx: -90 }), P('cylinder', 0, 2, 0, { r: 0.2, h: 0.25 }, '#212121')] },
  { icon: 'ghost', label: 'Mushroom', parts: [P('cylinder', 0, 0.3, 0, { r: 0.22, h: 0.6 }, '#fff3e0'), P('dome', 0, 0.85, 0, { w: 1.2, h: 0.55, d: 1.2 }, '#e53935'),
    P('sphere', 0.25, 1.0, -0.3, { r: 0.08 }, '#ffffff'), P('sphere', -0.3, 0.95, 0.15, { r: 0.07 }, '#ffffff')] },
  { icon: 'flag', label: 'Tower', parts: [P('cylinder', 0, 1.5, 0, { r: 0.8, h: 3 }, '#9e9e9e'), P('cone', 0, 3.6, 0, { r: 1, h: 1.2 }, '#3949ab'), P('box', 0, 2.2, 0.79, { w: 0.3, h: 0.5, d: 0.05 }, '#263238')] },
  { icon: 'grid', label: 'Fence', parts: [...[-1, 0, 1].map((x) => P('box', x, 0.5, 0, { w: 0.12, h: 1, d: 0.12 }, '#a1887f')), P('box', 0, 0.7, 0, { w: 2.1, h: 0.1, d: 0.06 }, '#bcaaa4'), P('box', 0, 0.35, 0, { w: 2.1, h: 0.1, d: 0.06 }, '#bcaaa4')] },
  { icon: 'star', label: 'Crystal', parts: [P('gem', 0, 0.7, 0, { w: 0.6, h: 1.4, d: 0.6 }, '#b388ff', { emissive: 0.4 }), P('gem', 0.35, 0.35, 0.1, { w: 0.3, h: 0.7, d: 0.3 }, '#ea80fc', { emissive: 0.4 })] },
  { icon: 'coin', label: 'Coin', parts: [P('cylinder', 0, 0.6, 0, { r: 0.4, h: 0.1 }, '#ffd23d', { rx: 90, emissive: 0.4 })] },
  { icon: 'circle', label: 'Rock', parts: [P('dome', 0, 0.3, 0, { w: 1.3, h: 0.7, d: 1.1 }, '#8d8d8d'), P('dome', 0.45, 0.18, 0.3, { w: 0.6, h: 0.4, d: 0.5 }, '#9e9e9e')] },
  { icon: 'circle', label: 'Donut', parts: [P('torus', 0, 0.3, 0, { w: 1, h: 1, d: 1 }, '#f48fb1')] },
];

/** UI widgets for the on-screen interface. */
export const UI_WIDGETS = [
  { icon: 'square', label: 'Panel', props: { name: 'Panel', ui: true, anchor: 'center', x: 0, y: 0, shape: { type: 'rect', w: 300, h: 220, radius: 20, fill: 'rgba(20,20,35,0.85)', stroke: '#ffffff', lineWidth: 2 } } },
  { icon: 'text', label: 'Label', props: { name: 'Label', ui: true, anchor: 'top', x: 0, y: 120, text: { value: 'Hello!', size: 26, color: '#ffffff' } } },
  { icon: 'hand', label: 'Button', props: { name: 'Button', ui: true, anchor: 'bottom', x: 0, y: -120, shape: { type: 'rect', w: 240, h: 60, radius: 16, fill: '#3a6ea5' }, text: { value: 'Play Again', size: 22, color: '#ffffff' },
    behaviors: [{ type: 'button', action: 'restart game', value: '', amount: 1, sound: 'none' }] } },
  { icon: 'hud', label: 'Health Bar', props: { name: 'Health Bar', ui: true, anchor: 'top-left', x: 110, y: 80, bar: { var: 'hp', max: 100, w: 180, h: 18, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 9, label: true } }, vars: { hp: 100 } },
  { icon: 'hud', label: 'Progress Bar', props: { name: 'Progress Bar', ui: true, anchor: 'top', x: 0, y: 80, bar: { var: 'score', max: 100, w: 240, h: 14, fill: '#66bb6a', bg: 'rgba(0,0,0,0.45)', radius: 7, label: false } } },
  { icon: 'coin', label: 'Score', props: { name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left', color: '#ffffff' } } },
  { icon: 'heart', label: 'Lives', props: { name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '❤️ {lives}', size: 24, align: 'right', color: '#ffffff' } }, vars: { lives: 3 } },
  { icon: 'clock', label: 'Timer', props: { name: 'Timer Text', ui: true, anchor: 'top', x: 0, y: 34, text: { value: '{time}', size: 26, color: '#ffffff' } }, settings: { timeLimit: 60 } },
  { icon: 'star', label: 'Icon', props: { name: 'Icon', ui: true, anchor: 'top-left', x: 40, y: 120, shape: { type: 'emoji', emoji: '⭐', w: 44, h: 44 } } },
  { icon: 'pause', label: 'Pause Button', props: { name: 'Pause Button', ui: true, anchor: 'top-right', x: -36, y: 90, shape: { type: 'circle', r: 24, fill: 'rgba(255,255,255,0.18)' }, text: { value: 'II', size: 18, color: '#ffffff' },
    behaviors: [{ type: 'button', action: 'pause game', value: '', amount: 1, sound: 'none' }] } },
  { icon: 'play', label: 'Start Menu', props: { name: 'Start Button', ui: true, anchor: 'center', x: 0, y: 60, showWhen: 'title', shape: { type: 'rect', w: 220, h: 64, radius: 18, fill: '#43a047' }, text: { value: 'START', size: 26, color: '#ffffff' },
    behaviors: [{ type: 'button', action: 'start game', value: '', amount: 1, sound: 'none' }] },
    extra: [{ name: 'Title Label', ui: true, anchor: 'center', x: 0, y: -60, showWhen: 'title', text: { value: 'MY GAME', size: 48, color: '#ffffff' } }], settings: { customScreens: true, title: 'MY GAME' } },
  { icon: 'stop', label: 'Game Over Menu', props: { name: 'Retry Button', ui: true, anchor: 'center', x: 0, y: 70, showWhen: 'over', shape: { type: 'rect', w: 220, h: 64, radius: 18, fill: '#e53935' }, text: { value: 'TRY AGAIN', size: 24, color: '#ffffff' },
    behaviors: [{ type: 'button', action: 'restart game', value: '', amount: 1, sound: 'none' }] },
    extra: [{ name: 'Game Over Label', ui: true, anchor: 'center', x: 0, y: -50, showWhen: 'over', text: { value: 'GAME OVER  ·  {score}', size: 34, color: '#ffffff' } }], settings: { customScreens: true } },
];
