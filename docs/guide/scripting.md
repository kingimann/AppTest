# Scripting with JavaScript

When components, Triggers and nodes aren't enough, write JavaScript. You can do it in two places:

- a **Custom Script** component on an object, written inside the editor;
- your own code that imports the engine. See [Using the engine from code](#/guide/engine-api) and [Writing your own components](#/guide/custom-components).

This page covers the Custom Script component.

## A first script

*Add Component → Scripting → Custom script*. The **Code** box starts with:

```js
function update(e, dt, scene) {
  // e.x += 50 * dt;
}
```

Define any of these functions. Each is optional:

| Function | Runs |
|---|---|
| `start(e, scene)` | Once, when the object starts (the level begins, or it's spawned) |
| `update(e, dt, scene)` | Every frame. `dt` is the time since the last frame in seconds (about 0.016) |
| `collide(e, other, scene)` | When another object starts touching this one |

- `e` is this object (an [Entity](#/ref/api/Entity)).
- `scene` is the running level (a [Scene](#/ref/api/Scene)).
- `P` is the engine's toolbox (see below).

Code outside the functions runs once when the script is created, so use it for your own helper functions and constants.

### Example: spin, and speed up when touched

```js
let speed = 90;

function update(e, dt, scene) {
  e.rz += speed * dt;            // degrees per second
}

function collide(e, other, scene) {
  if (other.has('player')) {
    speed *= 1.5;
    scene.addVar('score', 1);
    scene.burst(e.x, e.y, 0, '#ffd23d', 12);
  }
}
```

### Example: a patrolling enemy that chases when close

```js
let home = null, dir = 1;

function start(e) { home = { x: e.x, y: e.y }; }

function update(e, dt, scene) {
  const player = scene.find('Player');
  const d = player ? Math.hypot(player.x - e.x, player.y - e.y) : Infinity;
  if (d < 200 && scene.canSee(e, player)) {
    e.x += Math.sign(player.x - e.x) * 140 * dt;          // chase
  } else {
    e.x += dir * 60 * dt;                                  // patrol
    if (Math.abs(e.x - home.x) > 120) dir = -dir;
  }
}
```

## The `P` toolbox

| Name | What it is |
|---|---|
| `P.log(...)`, `P.warn(...)` | Write to the Console |
| `P.clamp(v, a, b)`, `P.lerp(a, b, t)`, `P.rand(a, b)`, `P.pick(list)`, `P.DEG` | Maths helpers (`DEG` converts degrees to radians) |
| `P.storage` | Device storage (text): `get(key, default)`, `set(key, value)`. For numbers, lists and objects use save files (`scene.engine.saves`) |
| `P.Behaviors`, `P.registerBehavior` | The component registry |
| `P.Entity`, `P.Scene`, `P.Engine`, `P.Physics`, `P.Input`, `P.Audio` | The engine's classes |
| `P.formatNumber(n)` | `12345` → `12.3K` |
| `P.VERSION` | The engine version |

## Working with objects

```js
e.x, e.y, e.z              // position (2D: pixels, y down; 3D: metres, y up)
e.rx, e.ry, e.rz           // rotation in degrees
e.sx, e.sy, e.sz           // scale
e.visible, e.alpha         // shown, and opacity 0–1
e.name, e.id, e.tags       // tags is a Set: e.has('enemy'), e.tags.add('hit')
e.data                     // the object's own variables: e.data.hp
e.body                     // physics: e.body.vel.x, e.body.grounded, e.body.wall…
e.shape, e.text, e.sprite, e.mesh, e.light   // looks: e.shape.fill = '#f00'; e.text.value = 'Hi'
e.getBehavior('health')    // another component on this object
e.destroy()                // remove it (and its children)
```

Finding other objects:

```js
scene.find('Player')                  // first object with this name
scene.findAll('enemy')                // every object with this tag (or name)
scene.player()                        // the first object tagged player
scene.childrenOf(e)
scene.entities                        // everything
```

Creating them:

```js
scene.spawn('Bullet', { x: e.x, y: e.y - 20 });     // a copy of a template
scene.add({ name: 'Spark', x: e.x, y: e.y, shape: { type: 'circle', r: 4, fill: '#fff' }, behaviors: [{ type: 'lifetime', seconds: 0.5 }] });
```

## Variables, messages and events

```js
scene.vars.score                      // read
scene.setVar('coins', 10);            // write (updates {coins} in texts and fires 'var')
scene.addVar('score', 5);
scene.send('door open', 1);           // a message (Triggers, nodes and components can react)
scene.on('message', (name, value) => { if (name === 'boss defeated') P.log('yay'); });
scene.on('damage', (target, amount) => { /* … */ });
```

Every event the engine sends is listed in the [Scene events reference](#/ref/events). Subscribe in `start()`, so you only subscribe once.

## Time

```js
scene.time                            // seconds since the level started (stops when paused)
scene.after(2, () => e.destroy());    // once, later
scene.every(1, () => scene.addVar('score', 1));
scene.tween(e, { y: e.y - 40, alpha: 0 }, 0.4, 'outQuad');
```

Prefer `scene.after` and tweens over `setTimeout`: they pause with the game and stop when the level ends.

## Input

```js
const inp = scene.engine.input;
inp.axis()                            // { x, y } from the joystick, D-pad, tilt or arrow keys (-1…1)
inp.pressed('jump')                   // this frame: 'jump', 'action', 'tap', 'swipe', 'swipe:left'…
inp.isDown('jump')                    // a touch button held
inp.taps                              // taps this frame: [{ x, y }] in screen pixels
inp.pointers                          // fingers on the screen now
inp.keys.has('space'), inp.keysDown   // keyboard: held, pressed this frame
scene.engine.renderer.screenToWorld(scene, x, y)   // a tap in level coordinates (2D)
```

## Physics

```js
e.body.vel.x = 200;                   // set velocity
e.body.vel.y = -600;                  // jump (2D: negative is up)
if (e.body.grounded) { /* standing on something */ }
scene.raycast({ x: e.x, y: e.y }, { x: 0, y: 1 }, 100, { ignore: e })   // → { entity, dist, point } or null
scene.engine.physics.touching(e, 'lava')
scene.canSee(e, other)
```

## Components from a script

```js
const hb = e.getBehavior('health');
hb.damage(2, e, null, { type: 'fire' });
hb.heal(1);
e.getBehavior('hunger')?.add(20);
scene.useItem('Apple'); scene.craft('Axe');
```

The methods each component offers are listed on its reference page and in [Gameplay systems](#/guide/gameplay).

## Errors and debugging

- `P.log()` and `P.warn()` write to the Console with the object's name.
- An error in a script is logged with its stack, and the game keeps running. The same error isn't repeated every frame.
- If the code can't even be read (a syntax error), the Console says "Script can't run" with the reason.
- The Console's command line can change variables and send messages while you test.

> **Tip:** Keep scripts small and focused, one job per script. For logic other people will edit, Triggers or a visual script are easier to read.

## Limits

- A Custom Script runs inside the game. It has the whole engine and the browser's normal JavaScript, but no editor APIs.
- Scripts are saved as text in the game file, so exported games include them.
- A script only gets `start`, `update` and `collide`. For `separate`, `destroy`, `turn`, drawing UI or settings in the Inspector, write a component with `registerBehavior` instead ([Writing your own components](#/guide/custom-components)).
