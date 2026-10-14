# Using the engine from code

The whole engine is one ES module, `engine/pocket.js`, with no dependencies and no build step. You can use it without the editor: write games in code, embed the player in your own page, or generate levels.

Every class and method is listed, with its source comment, in the [JavaScript API reference](#/ref/api).

## Setting up

Serve the folder over HTTP (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
```

```html
<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<body style="margin:0;background:#000">
<script type="module">
  import { Engine, Scene } from './engine/pocket.js';
  const engine = new Engine();          // full screen
  engine.start(() => new Scene({ mode: '2d', view: { width: 400, height: 700 } }));
</script>
```

### Engine options

```js
new Engine({
  parent: document.querySelector('#game'),  // draw inside an element instead of full screen
  maxPixelRatio: 2,                         // cap the resolution (battery and speed)
  pauseOnHide: true,                        // pause when the player switches apps
  keepAwake: true,                          // keep the screen on while playing
});
```

## Starting a game

`engine.start(source, { level })` takes one of three things:

| Source | When it's used |
|---|---|
| Game JSON (what the editor saves) | Levels in `levels: […]` play in order; `{ level: 1 }` starts at the second one |
| A function returning a `Scene` | Called again for "play again", so every run starts fresh |
| A `Scene` | One fixed scene |

```js
engine.start(await (await fetch('my-game.json')).json());
engine.start(gameJson, { level: 2 });

engine.start(() => {
  const s = new Scene({ mode: '2d', view: { width: 400, height: 700 }, settings: { title: 'MY GAME', joystick: true, saveBest: 'my-game' }, vars: { score: 0, lives: 3 } });
  s.add({ name: 'Player', tags: ['player'], x: 200, y: 500, shape: { type: 'circle', r: 20, fill: '#33f0ff' }, behaviors: [{ type: 'move', speed: 260 }] });
  s.add({ ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: 'Score {score}', align: 'left' } });
  return s;
});
```

### Subclassing Scene

For a game written fully in code, extend `Scene` and override `init(engine)` (called when the scene starts) and `update(dt, engine)` (called every frame, after the components):

```js
import { Engine, Scene, rand } from './engine/pocket.js';

class Dodge extends Scene {
  constructor() { super({ mode: '2d', view: { width: 400, height: 700 }, settings: { title: 'DODGE', saveBest: 'dodge' } }); }
  init() {
    this.player = this.add({ name: 'Player', tags: ['player'], x: 200, y: 600, shape: { type: 'circle', r: 14, fill: '#33f0ff' }, body: { type: 'dynamic', gravityScale: 0 }, behaviors: [{ type: 'move', control: 'drag' }, { type: 'timeScore', rate: 10 }] });
    this.every(0.5, () => this.add({ x: rand(20, 380), y: -20, shape: { type: 'rect', w: 30, h: 30, fill: '#ff3dac' }, behaviors: [{ type: 'velocity', vy: [180, 320] }, { type: 'hazard' }, { type: 'destroyOffscreen' }] }));
  }
  update(dt) { if (this.vars.score > 500) this.win(); }
}
new Engine().start(() => new Dodge());
```

`examples/neon-dodge/main.js` is a complete game written this way.

## The frame

Each frame the engine:

1. handles pause, the title and end screens, dialogue and loading screens (UI keeps running on those);
2. calls `start()` on new components;
3. calls every component's `update(e, dt, scene)` in object order;
4. calls `scene.update(dt, engine)`;
5. in turn-based games, runs `turn()` hooks after the turn delay;
6. steps physics (sub-steps for fast objects), firing `collide` / `separate`;
7. advances time, the time limit and `winScore`;
8. adds objects created this frame and removes destroyed ones (their `destroy()` hooks run);
9. draws the world, the UI, notifications and the touch controls.

`dt` is capped, so a long pause (a phone call) doesn't make things jump. `engine.timeScale` slows or speeds the whole game (Slow Motion uses it).

## Engine

| Member | Meaning |
|---|---|
| `engine.scene` | The running scene |
| `engine.input`, `engine.audio`, `engine.physics`, `engine.renderer` | Subsystems |
| `engine.saves` | Save files (Easy Save style) |
| `engine.online` | PlayFab and Photon |
| `engine.paused`, `engine.timeScale` | Pause; game speed (1 = normal) |
| `engine.width`, `engine.height`, `engine.safe` | Screen size in CSS pixels; the safe-area insets and UI scale |
| `engine.prefs`, `engine.setPref(k, v)`, `engine.openSettings()` | The player's own settings (sound, music, vibration, left-handed…) |
| `engine.restart()`, `engine.nextLevel()`, `engine.goToLevel(n)` | Flow |
| `engine.saveGame(slot)`, `engine.loadGame(slot)` | Save slots |
| `engine.notify({ type, title, text, icon, buttons })` | In-game notification |
| `engine.vibrate(ms)` | Haptics |
| `engine.takePhoto()` | A promise of a PNG data URL of the game and its UI |
| `engine.destroy()` | Stop and remove the engine |

## Scene

The scene is the running level. Most of the API is here.

### Objects

```js
scene.add(props)                      // plain props or an Entity; returns the Entity
scene.spawn('Template', { x, y })     // a copy of a template object
scene.find(name), scene.findAll(tagOrName), scene.byId(id), scene.player()
scene.childrenOf(e), scene.attach(child, parent)
scene.entities                        // all objects (objects added this frame join at its end)
scene.setLayer(e, 'Enemy'), scene.findInLayer('Enemy')
```

### Variables, messages, events

```js
scene.vars, scene.setVar(k, v), scene.addVar(k, d)
scene.send(name, value)                // a game message
scene.on(event, fn), scene.emit(event, ...args)
```

See [Scene events](#/ref/events) for everything you can listen to.

### Time and tweens

```js
scene.time
scene.after(seconds, fn), scene.every(seconds, fn)
scene.tween(target, { x: 10 }, 0.3, 'outCubic')
scene.to / from / sequence / punch / shakeProps / path / jumpTo / counter / typeText / blink …
scene.killTweens(target), scene.isTweening(target)
```

See [Animation and audio › Tweens](#/guide/animation-audio/tweens).

### Game flow

```js
scene.state                       // 'title' | 'play' | 'over' | 'win'
scene.win(), scene.gameOver()
scene.message('Hi!', 3)           // a banner over the game
scene.endTurn(), scene.isPlayerTurn
scene.navTo(page), scene.navBack(), scene.canGoBack()
scene.saveGame(slot), scene.loadGame(slot), scene.hasSave(slot)
```

### World

```js
scene.mode                        // '2d' | '3d'
scene.camera, scene.setCamera(name), scene.impulse(strength, at)
scene.raycast(origin, dir, maxDist, opts), scene.canSee(a, b)
scene.gravity, scene.gravityX, scene.gravityZ
scene.light, scene.fog, scene.background, scene.post
scene.burst(x, y, z, color, count), scene.flashScreen(color)
scene.viewBounds()                // { left, right, top, bottom } of what the camera sees (2D)
```

### Inventory and crafting

```js
scene.addItem(name, n), scene.itemCount(name), scene.useItem(name), scene.equip(name), scene.unequip(slot)
scene.itemStacks(type), scene.slotsFree(), scene.sortInventory('type'), scene.dropNear(name, n)
scene.craft(item, times), scene.canCraft(item), scene.craftMissing(item), scene.learnRecipe(item)
```

## Entity

```js
const e = scene.add({ name: 'Box', x: 100, y: 100, shape: { type: 'rect', w: 40, h: 40, fill: '#fff' } });
e.x += 10; e.rz = 45; e.sx = 2; e.visible = false; e.alpha = 0.5;
e.tags.add('crate'); e.has('crate');
e.data.hp = 3;
e.setBody({ type: 'dynamic' }); e.ensureBody({ type: 'kinematic', sensor: true });
e.body.vel.x = 100;
e.addBehavior({ type: 'rotate', speed: 90 });                   // a registered component
e.addBehavior({ update(e, dt, s) { e.rz += 90 * dt; } });       // or plain hooks
e.getBehavior('rotate');
e.extents()                       // half-sizes used for physics and taps
e.destroy();
```

## Input

```js
const inp = engine.input;
inp.axis()                        // { x, y }: joystick, D-pad, tilt and arrow keys / WASD combined
inp.pressed('jump')               // this frame: 'jump', 'action', 'tap', 'swipe', 'swipe:left' / right / up / down, 'btn:pause'
inp.isDown('jump')                // 'jump' or 'action' touch button held
inp.taps                          // [{ x, y }] taps this frame (screen pixels)
inp.downs, inp.ups                // fingers that landed / lifted this frame
inp.pointers                      // Map of fingers on the screen
inp.drag                          // { dx, dy } finger drag this frame
inp.keys, inp.keysDown, inp.keysUp   // keyboard: 'space', 'arrowup', 'a', 'enter'…
inp.useTilt = true; inp.calibrateTilt(); inp.requestMotion();
```

Turn on the built-in controls with settings (`joystick`, `jumpButton`, `actionButton`) and they feed `axis()` and `pressed()`.

## Audio

```js
engine.audio.sfx('coin')                       // built-in or imported sound by name
engine.audio.play(url, volume)
engine.audio.music('theme', { loop: true, vol: 0.6 })
engine.audio.tone({ freq: 440, to: 880, dur: 0.15, type: 'square', vol: 0.1 })
engine.audio.setMuted(true); engine.audio.setVolume(0.5);
```

## Rendering

- **2D** (`Renderer2D`, canvas 2D) draws shapes, sprites, text, tilemaps and lights, then the UI on a second canvas.
- **3D** (`Renderer3D`, WebGL) draws meshes, models and voxels with up to 8 lights, fog, shadows and an orthographic option.
- Both apply post-processing and lower their resolution when a phone can't keep a smooth frame rate.
- `renderer.worldToScreen(scene, x, y[, z])` and `renderer.screenToWorld(scene, sx, sy)` convert coordinates. `screenRay(scene, sx, sy)` gives a 3D ray.

## Making the editor understand your code

- Components you register with `registerBehavior` show up in the editor's Add Component (when your module is loaded before it), with a settings form built from their `params`. See [Writing your own components](#/guide/custom-components).
- The editor saves plain JSON, so anything you build in code can be saved in the same shape and opened in the editor.
