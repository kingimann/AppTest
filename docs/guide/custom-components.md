# Writing your own components

Every built-in component, from Collectible to Crafting, is made with the same function you can use: `registerBehavior`. A component you register gets a settings form in the Inspector, appears in Add Component, saves in the game file, and works in exported games.

## The smallest component

```js
import { registerBehavior } from './engine/pocket.js';

registerBehavior('spinner', {
  label: 'Spinner',
  description: 'Spins forever.',
  params: [{ key: 'speed', label: 'Degrees per second', type: 'number', default: 90 }],
  create(p) {
    return {
      update(e, dt, scene) { e.rz += p.speed * dt; },
    };
  },
});
```

Use it like any other component:

```js
{ name: 'Fan', shape: { type: 'star', w: 60, h: 60 }, behaviors: [{ type: 'spinner', speed: 180 }] }
```

## How it works

- `registerBehavior(type, definition)` adds the definition to `Behaviors[type]`.
- When an object is created with `{ type: 'spinner', … }`, the engine fills in every param (your value, else its default), then calls `create(params, entity)`.
- `create` returns an **instance**: an object with hook functions. One instance is made per object, so variables inside `create` belong to that object.
- The engine calls the hooks at the right moments.

## Params

Each entry in `params` is one setting:

```js
{ key: 'speed', label: 'Speed', type: 'number', default: 240, default3d: 7,
  range: [0, 1000], step: 10, group: 'Movement', info: 'How fast it goes.',
  showIf: { mode: ['walk', 'run'] } }
```

| Field | Meaning |
|---|---|
| `key` | The name in `params` and in the saved file |
| `label` | What the Inspector shows |
| `type` | `number`, `text`, `bool`, `select`, `color`, `code` (a big text box), `template` (pick a template object) and a few special editors |
| `default` / `default3d` | Default value; `default3d` is used in 3D games |
| `options` | For `select`: `['a', 'b']` or `[['value', 'Label'], …]` |
| `range`, `step` | Slider limits and step for numbers |
| `group` | Fold it into a named group (e.g. "More", "Look & sound") |
| `info` | Help shown under the field |
| `showIf` | Only show it when other settings have these values |
| `suggest` | Offer the game's `tags`, `vars`, `messages`, `objects`, `templates`, `items` or `sounds` |

> **Tip:** Keep the first four or five settings the important ones. The Inspector folds the rest into *More settings*.

## Hooks

All hooks are optional.

| Hook | Called |
|---|---|
| `start(e, scene)` | Once, before the first update (or when added during play) |
| `update(e, dt, scene)` | Every frame while playing |
| `collide(e, other, scene, contact)` | When a contact with `other` starts (`contact` has the normal `nx, ny, nz` and `depth`) |
| `separate(e, other, scene)` | When it ends |
| `destroy(e, scene)` | When the object is removed. Clean up listeners and overlays here |
| `turn(e, scene)` | Turn-based games: on the enemy turn |
| `drawUI(ctx, e, scene)` | On UI objects: draw extra things on the 2D canvas |
| `uiAlways: true` | (a flag) keep calling `update` on the title, pause and end screens, for menus |

Instances can also expose their own methods for other code: Health has `damage()`, `heal()` and `addEffect()`, and Hunger has `add()`. Get an instance with `e.getBehavior('health')`.

## A complete example: a magnet

```js
import { registerBehavior } from './engine/pocket.js';

registerBehavior('magnet', {
  label: 'Magnet',
  description: 'Pulls objects with a tag toward this one, faster when closer.',
  params: [
    { key: 'tag', label: 'Pulls tag', type: 'text', default: 'coin', suggest: 'tags' },
    { key: 'range', label: 'Range', type: 'number', default: 150, default3d: 5 },
    { key: 'strength', label: 'Strength', type: 'number', default: 400, default3d: 12 },
    { key: 'onlyWhen', label: 'Only while variable is on', type: 'text', default: '', suggest: 'vars', group: 'More' },
  ],
  create(p) {
    let pulled = 0;
    return {
      start(e, scene) { scene.want(p.tag); },          // make sure tagged objects take part in collisions
      update(e, dt, scene) {
        if (p.onlyWhen && !scene.vars[p.onlyWhen]) return;
        pulled = 0;
        for (const o of scene.findAll(p.tag)) {
          const dx = e.x - o.x, dy = e.y - o.y, dz = (e.z || 0) - (o.z || 0), d = Math.hypot(dx, dy, dz);
          if (d > p.range || d < 1e-3) continue;
          const k = p.strength * (1 - d / p.range) * dt / d;
          o.x += dx * k; o.y += dy * k; o.z += dz * k; pulled++;
        }
      },
      get pulled() { return pulled; },                  // other code can read it
    };
  },
});
```

## Talking to the rest of the game

Inside hooks you have the whole [Scene API](#/guide/engine-api/scene):

```js
scene.setVar('magnetOn', 1);            // variables (texts update, Triggers react)
scene.send('magnet full', pulled);      // messages
scene.on('message', (name) => { … });   // listen (subscribe in start, unsubscribe in destroy)
scene.spawn('Spark', { x: e.x, y: e.y });
scene.emit('magnetPulled', e, pulled);  // your own event for other components
```

Listeners stay until the scene ends. If your component can be removed while playing, keep a flag and ignore events after `destroy`.

## Drawing UI

UI components draw themselves with `drawUI`. The canvas is already moved to the object's anchor and scaled to the UI scale, so draw in the same design pixels as the object's `x` and `y`:

```js
import { registerBehavior, uiOrigin, uiK } from './engine/pocket.js';

registerBehavior('uiDots', {
  label: 'Dots', description: 'Shows a variable as dots.',
  params: [{ key: 'var', label: 'Variable', type: 'text', default: 'lives', suggest: 'vars' }, { key: 'max', label: 'Max', type: 'number', default: 5 }],
  create(p) {
    return {
      uiAlways: true,
      update(e, dt, scene) {
        const eng = scene.engine, o = uiOrigin(e, eng.width, eng.height, eng.safe), k = uiK(eng.safe) || 1;
        for (const t of eng.input.taps) {            // taps in this object's space
          const x = (t.x - o.x) / k, y = (t.y - o.y) / k;
          if (Math.abs(x - e.x) < 80 && Math.abs(y - e.y) < 20) scene.send('dots tapped');
        }
      },
      drawUI(ctx, e, scene) {
        const n = Math.round(+scene.vars[p.var] || 0);
        for (let i = 0; i < p.max; i++) {
          ctx.beginPath(); ctx.arc(e.x - (p.max - 1) * 12 + i * 24, e.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = i < n ? '#ff5d8f' : 'rgba(255,255,255,0.2)'; ctx.fill();
        }
      },
    };
  },
});
```

Put it on a UI object (`ui: true`) with a shape the size you want to tap. Note that `drawUI` doesn't run in the editor preview unless the component is one of the engine's own preview components.

## Keeping extra data

Data a component keeps without an Inspector field (like the Visual Script's extra scripts) goes in `passthrough`:

```js
registerBehavior('waypoints', { label: 'Waypoints', params: [ … ], passthrough: ['points'], create(p) { /* p.points is the saved array */ } });
```

## Plain hooks without registering

For a one-off, give an object a plain hooks object instead of a `type`. It doesn't save to JSON, so it's for code-built games:

```js
scene.add({ name: 'Star', shape: { type: 'star', w: 30, h: 30 }, behaviors: [{ update(e, dt) { e.rz += 120 * dt; } }] });
```

## Loading your components in the editor

The editor shows every registered component. To use your own in the editor, load your module before the editor starts, for example in a copy of `editor/index.html`:

```html
<script type="module">
  import './my-components.js';   // calls registerBehavior(…)
  import './editor.js';
</script>
```

Exported games include the engine, but not your extra modules. For games you export from the editor, prefer a **Custom Script** or a **Visual Script** (saved inside the game), or add your module to the exported page yourself.

## Checklist

- `type` is unique and stays the same (saved games refer to it).
- Every param has a sensible `default` (and `default3d` for sizes and speeds).
- State lives inside `create`, not in module variables (one instance per object).
- Fast loops avoid creating objects every frame.
- `destroy` removes overlays, listeners and timers you added.
- It works in both 2D (y down) and 3D (y up), or says which one it's for.
