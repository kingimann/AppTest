# Objects and the game file

A game is saved as plain JSON: the editor writes it, `engine.start(json)` plays it, and you can write it by hand or generate it from code. This page describes every part of that file. Each object field matches an Inspector card.

## The game file

```js
{
  version: 1,
  name: 'Coin Rush',             // also the key for saved progress and best scores
  mode: '2d',                    // '2d' or '3d' (each level can differ)
  background: '#0b0b1a',         // colour (2D and 3D)
  view: { width: 400, height: 700 },   // 2D design size; scaled to fit any screen
  gravity: 1600,                 // 2D: + is down. 3D: - is down (e.g. -25)
  gravityX: 0, gravityZ: 0,      // sideways gravity
  settings: { … },               // Game Settings (see below)
  vars: { score: 0, lives: 3 },  // starting variables
  light: { … }, fog: { … },      // lighting (2D darkness, 3D sun) and 3D fog
  post: { bloom: 0.6, vignette: 0.3 },  // post-processing
  camera: { … },                 // starting camera (usually a Camera object instead)
  entities: [ … ],               // the objects in this level
  levels: [ { …another level… } ],  // levels 2, 3, … (same shape, without `levels`)

  // whole-game data, kept on the first level
  physicsLayers: { names: [ … ], matrix: [ … ] },
  items: [ … ], recipes: [ … ],  // Game Settings › Items and Recipes
  sounds: { jump2: 'data:audio/…' },    // imported sounds
  customActions: [ … ], customConditions: [ … ],  // My Instructions / My Conditions
  tagList: [ 'player', 'enemy', … ],
}
```

Load and play it:

```js
import { Engine } from './engine/pocket.js';
const engine = new Engine();
engine.start(await (await fetch('coin-rush.json')).json());
```

`play.html?src=coin-rush.json` does the same with no code.

### Settings

`settings` holds Game Settings. The most used:

| Setting | Meaning |
|---|---|
| `title`, `subtitle` | Show the built-in title screen ("tap to play") |
| `customScreens` | Turn off the built-in title / pause / end screens so your UI runs them |
| `timeLimit` | Seconds; `{time}` counts down and the game ends at 0 |
| `saveBest` | A key: the best score is kept on the device in `{best}` |
| `saveProgress` | Variables and the level survive closing the game |
| `loadOnStart` | Continue from save slot 1 when the game opens |
| `orientation` | `'portrait'`, `'landscape'` or `'any'`; `wrongWay`: `'ask'` or `'letterbox'` |
| `joystick`, `jumpButton`, `actionButton` | Built-in touch controls |
| `controls` | `'auto'`, `'joystick'`, `'dpad'` or `'arrows'` |
| `joystickSide`, `joystickMode`, `controlSize`, `controlsOpacity` | How the controls look and behave |
| `pauseButton`, `muteButton`, `shareButton` | Built-in buttons |
| `turnBased`, `turnDelay` | Turn-based games |
| `invSlots`, `invStack`, `keepInventory` | Inventory size and rules |
| `uiTheme` | The UI theme |

Many more (notifications, permissions, online IDs, safe area, scaling) are set from their Game Settings sections.

### Light and fog

```js
light: {
  // 2D
  darkness: 0.7, ambientColor: '#0a0a1e',   // 0 = off; lights cut through the dark
  // 3D
  color: '#ffffff', intensity: 1, ambient: 0.45,
  sunAngle: 30, sunHeight: 60,               // or dir: { x, y, z }
  sky: '#88bbff', ground: '#446633', shadows: true,
},
fog: { near: 30, far: 120 },
```

A **Global Light 2D** or **Directional Light** object in the level overrides these.

## Objects

```js
{
  id: 'p1',                 // unique in the game; used by parent, saves and links
  name: 'Player',
  tags: ['player'],
  x: 200, y: 500, z: 0,     // position
  rx: 0, ry: 0, rz: 0,      // rotation in degrees
  sx: 1, sy: 1, sz: 1,      // scale
  visible: true, alpha: 1,
  layer: 0,                 // draw order (higher = in front)
  physLayer: 0,             // collision layer 0–7
  parent: 'id',             // child of another object: position is relative to it
  template: false,          // hidden while playing; spawned by name
  data: { hp: 3 },          // the object's own variables
  // looks (pick what you need)
  shape: { … }, sprite: { … }, text: { … }, mesh: { … }, model: { … },
  light: { … }, bar: { … }, tiles: { … }, voxels: { … },
  // physics
  collider: { … }, body: { … },
  // UI
  ui: false, anchor: 'top-left', showWhen: 'always', stretch: 'none', margin: 16,
  // behaviour
  behaviors: [ { type: 'move', speed: 260 } ],
}
```

Only `name` and a position are really needed. Everything you leave out uses a default.

### Shape (2D)

```js
shape: { type: 'rect', w: 40, h: 40, radius: 8, fill: '#33f0ff', stroke: '#ffffff', lineWidth: 2, glow: 0 }
```

`type` can be `rect`, `circle` (uses `r`), `ellipse`, `triangle`, `star`, `heart`, `diamond`, `pentagon`, `hexagon`, `octagon`, `capsule`, `ring`, `arrow`, `cloud`, `polygon` (with `points`) or `emoji`:

```js
shape: { type: 'emoji', emoji: '🐱', w: 48, h: 48 }
```

Shapes can also have a gradient fill, a soft shadow and dashed outlines (set in the Shape Renderer card).

The Shape Renderer has more under its folds:

- **Opacity:** 0 (invisible) to 1.
- **Colour, flip, order & blend:**
  - Flip left ↔ right or upside down.
  - Turn the shape without turning the object.
  - Hue shift, brightness and saturation (0 = grey).
  - **Order in layer:** a higher number draws in front, without moving it in the Hierarchy. Images have this too.
  - Blend mode: Add for glowing light, Multiply for shadows and tints, also Screen, Overlay, Darken and Lighten.
  - Round or cut outline corners.
- **Animated look:**
  - Pulse, blink, spin, wobble, float, rainbow colours, or a shimmer that sweeps a shine across.
  - It has a speed setting, and only the look moves: the collider stays put.
- **Shapes:**
  - A star can have 3–24 points and a point depth.
  - **Polygon (any sides)** has 3–24 sides.

**Game Settings › Environment › Lower objects draw in front** gives top-down games depth: a character below a tree is drawn over it.

### Sprite (image)

```js
sprite: { src: 'art:slime', w: 64, h: 64 }       // built-in drawn sprite
sprite: { src: 'data:image/png;base64,…', w: 64, h: 64 }   // imported picture
```

Sprites can have rounded corners and **9-slice** scaling (corners stay sharp). The Sprite Sheet Animator plays frames from one picture.

### Text

```js
text: { value: 'Score {score}', size: 24, color: '#ffffff', font: 'theme', weight: '800', align: 'center', outline: '#000', outlineWidth: 4, shadow: true }
```

`{name}` shows a variable; `{@event}` shows a Trigger's event value. Texts can wrap, shrink to fit, glow, use a gradient, show numbers as `1.2K` or `m:ss`, and animate (wave, bounce, rainbow…).

### Mesh and model (3D)

```js
mesh: { geometry: 'box', w: 1, h: 1, d: 1, r: 0.5, color: '#33f0ff', emissive: 0, opacity: 1 }
```

Geometries: `box`, `sphere`, `cylinder`, `cone`, `capsule`, `pyramid`, `wedge`, `prism`, `gem`, `dome`, `torus`, `plane`.

A **model** is several parts, each placed relative to the object:

```js
model: { parts: [
  { geometry: 'box', y: 0.5, w: 1, h: 1, d: 1, color: '#8d6e63' },
  { geometry: 'cone', y: 1.4, r: 0.8, h: 0.8, color: '#c62828' },
] }
```

Parts made in the 3D Modeler are editable meshes: `{ geometry: 'mesh', verts: [[x, y, z], …], faces: [{ v: [0, 1, 2], c: '#color' }], smooth }`.

### Light

```js
light: { color: '#ffd9a0', intensity: 1, range: 160, type: 'point', effect: 'fire', shadows: true }
```

`type` is `point` or `spot` (with `cone`, plus `aim` in 2D or `tilt` in 3D). `effect`: `pulse`, `blink`, `fire` or `rainbow` (with `speed`). In 2D, `soft` sets the edge and `shadows` lets solid objects block the light. 3D shows up to 8 lights at once.

### Progress bar

```js
bar: { var: 'hp', max: 100, maxVar: '', w: 160, h: 16, fill: '#ef5350', bg: 'rgba(0,0,0,0.45)', radius: 8, label: false, icon: '' }
```

`var: 'self.hp'` shows the object's own health. `icon: '❤️'` draws repeated icons (hearts) instead of a bar.

### Tilemap (2D)

```js
tiles: { size: 40, palette: [{ fill: '#6d4c41', top: '#7cb342', kind: 'solid' }], cells: { '0,0': 1, '1,0': 1 } }
```

Each palette entry has a colour, an optional top edge and emoji, and a `kind`: `solid`, `platform` (one-way), `hazard` or `decor`. Cells are `"column,row": paletteIndex + 1`.

### Voxels (3D)

```js
voxels: { size: 1, gen: { type: 'hills', w: 32, d: 32, h: 8, seed: 1, trees: true }, edits: { '3,4,5': 2 } }
```

A Minecraft-style world drawn as merged chunks. `gen.type` is `hills`, `flat` or `empty`. `edits` stores changed blocks.

### Collider and body (physics)

```js
collider: { shape: 'box', w: 40, h: 40, trigger: false, ox: 0, oy: 0 }
body: { type: 'dynamic', gravityScale: 1, bounce: 0, friction: 0, mass: 1, layer: 0 }
```

A collider alone makes a solid object that never moves (a wall). Add a body to make it fall and be pushed. See [Physics and collisions](#/guide/physics) for every option.

### UI fields

| Field | Meaning |
|---|---|
| `ui: true` | Screen space: positioned from an anchor, ignores the camera |
| `anchor` | `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right` |
| `x, y` | Offset from the anchor in design pixels |
| `stretch` | `none`, `width`, `height` or `both` (fill, minus `margin`) |
| `showWhen` | `always`, `play`, `title`, `paused`, `over`, `win` |
| `ignoreSafe` | Go under the notch (full-screen backgrounds) |
| `ignoreBars` | Go under the Bottom Nav / App Bar |
| `overlap` | Allowed to overlap other UI when "push UI apart" is on |

A UI object inside another UI object is anchored to its parent's box.

### Components

```js
behaviors: [
  { type: 'move', control: 'both', speed: 260 },
  { type: 'health', hp: 5, hurtBy: 'enemy' },
  { type: 'graph', graph: { nodes: [ … ], links: [ … ] } },
  { type: 'triggers', triggers: [ … ] },
  { type: 'collectible', enabled: false },   // switched off
]
```

Any setting you leave out takes its default. Look up every component's settings in the [Components reference](#/ref/components).

Number settings of some components can be `[min, max]` for a random value each time (Velocity, Spawner).

## Items and recipes

```js
items: [
  { name: 'Apple', icon: '🍎', type: 'food', stack: 20, rarity: 'common', food: 20 },
  { name: 'Iron Sword', icon: '⚔️', type: 'weapon', stack: 1, rarity: 'rare', damage: 5 },
  { name: 'Iron Helmet', icon: '⛑️', type: 'armor', slot: 'head', armor: 2 },
],
recipes: [
  { result: 'Iron Sword', amount: 1, ingredients: 'Iron Bar 3, Stick 1', station: 'Workbench', time: 0 },
  { result: 'Iron Helmet', ingredients: 'Iron Bar 4', locked: true },
],
```

See [Gameplay systems › Inventory and crafting](#/guide/gameplay/inventory-and-crafting).

## Building a game from code

You don't need the editor at all:

```js
import { Engine } from './engine/pocket.js';

const level = (n) => ({
  name: 'Level ' + n, mode: '2d', view: { width: 400, height: 700 }, gravity: 0,
  vars: { score: 0 },
  entities: [
    { name: 'Player', tags: ['player'], x: 200, y: 600, shape: { type: 'circle', r: 18, fill: '#4fc3f7' }, behaviors: [{ type: 'move', control: 'both' }] },
    ...Array.from({ length: 5 + n * 2 }, (_, i) => ({ name: 'Coin', tags: ['coin'], x: 40 + Math.random() * 320, y: 80 + Math.random() * 400, shape: { type: 'circle', r: 10, fill: '#ffca28' }, behaviors: [{ type: 'collectible' }] })),
    { name: 'Score', ui: true, anchor: 'top', y: 40, text: { value: '{score}', size: 30 } },
  ],
});

const game = { ...level(1), settings: { title: 'COIN RUSH' }, levels: [level(2), level(3)] };
new Engine().start(game);
```

Add a win rule with a Triggers component, or with the Condition component:

```js
{ name: 'Rules', behaviors: [{ type: 'triggers', triggers: [
  { event: { type: 'always' }, conditions: [{ type: 'tagCount', tag: 'coin', op: '=', value: 0 }], actions: [{ type: 'win' }] },
] }] }
```
