# Pocket Engine

A small **2D + 3D game engine for mobile web browsers**, plus a **visual editor that works on your phone**.
Plain JavaScript ES modules. No dependencies and no build step.

- `engine/pocket.js`: the engine, one file
- `editor/`: the visual editor (make games without code)
- `examples/`: Neon Dodge (written in code) and the starter templates
- `play.html`: plays a template (`?game=jump-quest`) or any scene JSON (`?src=my-game.json`)

## Running it

ES modules need to be served over HTTP (opening the files with `file://` won't work):

```sh
python3 -m http.server 8000
# open http://localhost:8000, or http://<your-computer-ip>:8000 on your phone
```

Or turn on **GitHub Pages** for the repo (Settings → Pages → deploy from branch) to get a public link you can open on any phone.

## The editor

Open `editor/` on your phone (or a desktop browser). **Live version: https://kingimann.github.io/AppTest/editor/** — use *☰ → Install App* to add it to your home screen; it works offline. The layout follows desktop game engines: a toolbar, the **Scene** view, and **Hierarchy**, **Inspector** and **Project** panels (tabs at the bottom on phones, docked around the scene on wide screens).

| Do this | How |
| --- | --- |
| Add objects | **Project → Prefabs / Objects**: drag a tile into the Scene (press and hold briefly on touch), or tap it to add at the center. Also **Hierarchy → Create** |
| Add components | **Project → Components**: drag onto an object in the Scene or Hierarchy, or use **Add Component** in the Inspector |
| Select | Tap an object in the Scene or Hierarchy. Tap the scene name at the top of the Hierarchy for game settings |
| Move / Rotate / Scale | Toolbar tools (Q W E R). Drag the object, or drag the gizmo handles to lock an axis |
| Paint copies | Select an object, pick the brush tool (B), then tap or drag in the Scene to stamp copies |
| Quick actions | With an object selected, the bar over the Scene offers Inspect, Duplicate, Focus and Delete |
| Levels | The level button above the Scene adds, duplicates, renames, reorders and switches levels. Reaching a Goal moves to the next level; score and lives carry over |
| More room | Tap the open panel tab (Hierarchy / Inspector / Project) to hide the panels; tap again to bring them back |
| Pan / Orbit / Zoom | Drag empty space (2D pans, 3D orbits), pinch to zoom. Hand tool always pans. Desktop: wheel zooms, shift-drag pans |
| Edit numbers | Type in the field, or drag the field's label left and right. ‹ › in the Inspector steps through objects; the ⋮ menu copies a component so you can paste it onto another object |
| Test | **▶** in the toolbar. **▶** again (or the floating bar) stops |
| Save / share | Saving is automatic. **☰** menu: New/Open Project, Build HTML (one offline file), JSON export/import |

**On a phone** the Scene fills the screen with a tool rail on the left, and the Hierarchy / Inspector / Project panels live in a bottom sheet: drag its handle (or tap the open tab) to switch between peek, half and full height. Held sideways, the panels move to the right. Touch gestures:

| Gesture | Does |
| --- | --- |
| Long-press an object | Object menu: Inspect, Duplicate, Copy, Paint copies, Focus, Hide, Lock, Delete |
| Long-press empty space | Paste here, Add object here, Reset view, Game settings |
| Two-finger tap / three-finger tap | Undo / Redo |
| Double-tap empty space | Reset the view |
| − / + next to numbers | Nudge values without typing |

Other shortcuts: undo/redo arrows (Ctrl/Cmd+Z), F frames the selection, Ctrl+D duplicates, Delete removes.

**Templates and spawners.** Tick *Template* on an object to hide it during play. A **Spawner** or **Shooter** component then creates copies of it by name. Sky Dodge shows how.

## Using the engine from code

```js
import { Engine, Scene, Entity, registerBehavior } from './engine/pocket.js';

const engine = new Engine();               // full-screen; or new Engine({ parent: someDiv })
engine.start(() => {                       // a factory, so "play again" gets a fresh scene
  const s = new Scene({
    mode: '2d',                            // or '3d'
    view: { width: 400, height: 700 },     // 2D design size, scaled to fit any screen
    settings: { title: 'MY GAME', joystick: true, saveBest: 'my-game' },
    vars: { score: 0, lives: 3 },
  });
  s.add({ name: 'Player', tags: ['player'], x: 200, y: 500,
          shape: { type: 'circle', r: 20, fill: '#33f0ff' },
          behaviors: [{ type: 'move', speed: 260 }] });
  s.add({ ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: 'Score {score}', align: 'left' } });
  return s;
});
```

`engine.start()` also accepts scene JSON directly (what the editor saves), e.g. `engine.start(await (await fetch('game.json')).json())`.
For more control, subclass `Scene` and override `init(engine)` and `update(dt, engine)`. See `examples/neon-dodge/main.js`.

### Entities

```js
{
  name, tags: ['player'], x, y, z, rx, ry, rz /* degrees */, sx, sy, sz, layer, visible, alpha,
  shape:  { type: 'rect'|'circle'|'triangle'|'star'|'polygon', w, h, r, radius, fill, stroke, lineWidth, glow },  // 2D
  text:   { value: 'Lives {lives}', size, color, align, weight, font },
  sprite: { src, w, h },                                                                             // 2D image
  mesh:   { geometry: 'box'|'sphere'|'cylinder'|'cone'|'plane', w, h, d, r, color, emissive, opacity },  // 3D
  body:   { type: 'static'|'dynamic'|'kinematic', sensor, gravityScale, bounce, shape: 'auto'|'box'|'circle'|'sphere', w, h, d, r },
  behaviors: [{ type: 'collectible', score: 10 }, { update(e, dt, scene) { /* plain hooks work too */ } }],
  ui: true, anchor: 'top-right',           // HUD element in screen space (works in 3D games too)
  template: true,                          // hidden; spawned by name with scene.spawn('Name', { x, y })
}
```

Coordinates: in 2D, units are design pixels and y points down. In 3D, units are roughly metres and y points up.

### Behaviors

| Type | What it does | Params (defaults) |
| --- | --- | --- |
| `move` | Player movement with joystick, keyboard, dragging, or tilting the phone (`control: "tilt"`). | `speed` (260 / 3D 7), `control` ("both"), `axes` ("all"), `keepInView` (true), `face` (true) |
| `platformer` | Run & jump. Uses gravity; tap or the jump button to jump. | `speed` (240 / 3D 7), `jump` (620 / 3D 10), `doubleJump` (false), `onFall` ("respawn") |
| `rotate` | Spin continuously. | `speed` (90), `axis` ("z" / 3D "y") |
| `patrol` | Move back and forth from the start point. | `dx` (120 / 3D 4), `dy` (0), `dz` (0), `duration` (2) |
| `velocity` | Move at a constant speed. Give a min–max range for random speeds. | `vx` (0), `vy` (200 / 3D 0), `vz` (0 / 3D 6) |
| `spawner` | Spawn copies of a template object over time, at random positions in a range. | `template` (""), `every` (1), `x` ([20,380] / 3D [-8,8]), `y` (-40 / 3D 1), `z` (0 / 3D -40), `relative` (false), `ramp` (0.1), `max` (60) |
| `shooter` | Fire copies of a template (give the template a Velocity). | `template` (""), `every` (0.25), `trigger` ("auto") |
| `destroyOffscreen` | Remove the object once it leaves the view. | `margin` (120 / 3D 60) |
| `lifetime` | Remove the object after some seconds. | `seconds` (3) |
| `collectible` | Adds to the score when the player touches it. | `score` (10), `var` ("score"), `tag` ("player"), `sound` ("coin") |
| `hazard` | Hurts the player on touch. | `action` ("gameover"), `tag` ("player"), `destroySelf` (false) |
| `goal` | The player wins when touching this. | `tag` ("player") |
| `spring` | Bounces the player upward on touch. | `power` (900 / 3D 16), `tag` ("player") |
| `cameraFollow` | The camera tracks this object. | `smooth` (6), `axes` ("both"), `ox` (0), `oy` (0 / 3D 7), `oz` (0 / 3D 11) |
| `wrap` | Leaving one edge brings it back on the other (2D). | — |
| `timeScore` | Adds points every second while playing. | `rate` (10) |
| `chase` | Moves toward the player when it gets close. | `speed` (110 / 3D 3.5), `range` (320 / 3D 10), `tag` ("player") |
| `float` | Bobs gently up and down. | `amount` (8 / 3D 0.25), `period` (1.6) |
| `message` | Shows a message when the player touches it (signs, hints, story). | `text`, `seconds` (3), `once` (true), `tag` ("player") |
| `teleport` | Sends the player to another object (by name). | `target` (""), `tag` ("player") |
| `unlock` | Disappears once a variable reaches an amount, e.g. a door that opens with keys. | `var` ("keys"), `amount` (1), `text` |
| `sound` | Plays a sound when the game starts or when touched. | `sound` ("power"), `when` ("touched"), `tag` ("player") |
| `tappable` | The player taps it on screen to score (clicker, whack-a-mole, bubble games). | `points` (10), `destroy` (true), `sound` ("coin") |
| `draggable` | The player can pick it up and move it with a finger (puzzles, sorting games). | `snap` (0), `lift` (true) |
| `swipeMove` | Swipe left/right to change lanes, swipe up to jump (endless-runner controls). | `distance` (110 / 3D 2.5), `lanes` (3), `jump` (0 / 3D 9) |
| `orbit` | Circles around its starting point. | `radius` (80 / 3D 3), `speed` (90) |
| `pulse` | Grows and shrinks to draw attention. | `amount` (0.15), `period` (0.8) |
| `checkpoint` | The player respawns here after falling or getting hurt. | `text`, `tag` ("player") |
| `destructible` | Health: takes hits from objects with a tag (like bullets) and breaks when health runs out. | `hp` (3), `hitBy` ("bullet"), `points` (10), `removeHitter` (true) |
| `script` | Custom JavaScript: define `start(e, scene)`, `update(e, dt, scene)` and/or `collide(e, other, scene)`. | `code` |

Number params can be `[min, max]` for a random value where it makes sense (`velocity`, `spawner`).

Add your own behavior, and it shows up in the editor too, with a form built from `params`:

```js
registerBehavior('blink', {
  label: 'Blink', description: 'Flash on and off.',
  params: [{ key: 'rate', label: 'Times / sec', type: 'number', default: 2 }],
  create: (p) => ({ update(e, dt, scene) { e.visible = Math.floor(scene.time * p.rate * 2) % 2 === 0; } }),
});
```

### Scene API

| | |
| --- | --- |
| `scene.add(props)` / `scene.spawn('Template', overrides)` | add entities |
| `scene.find(name)`, `scene.findAll(tagOrName)`, `entity.destroy()` | look up / remove |
| `scene.vars`, `scene.setVar(k, v)`, `scene.addVar(k, d)` | game variables, shown in text with `{name}` |
| `scene.gameOver()`, `scene.win()` | end screens (tap to play again) |
| `scene.after(sec, fn)`, `scene.every(sec, fn)`, `scene.tween(obj, {x: 10}, 0.3)` | timing |
| `scene.message('Hi!', 3)` | message banner over the game |
| `scene.burst(x, y, z, color, count)` | particle burst |
| `scene.camera` | 2D: `{x, y, zoom, shake}`. 3D: `{position, target, fov, shake}` |
| `scene.on('collide' \| 'var' \| 'over' \| 'win', fn)` | events |

| | |
| --- | --- |
| `engine.input.axis()` | `{x, y}` from joystick or keys |
| `engine.input.pressed('jump' \| 'action' \| 'tap' \| 'swipe:left' \| 'KeyX')`, `isDown(...)` | buttons, taps, swipes, keys |
| `engine.input.taps`, `engine.input.pointers`, `engine.input.useTilt = true` | raw touches, tilt controls |
| `engine.audio.sfx('coin' \| 'jump' \| 'hit' \| 'power' \| 'win' \| 'lose')`, `audio.play(url)` | sound |
| `engine.vibrate(ms)`, `engine.timeScale`, `engine.paused`, `engine.restart()` | misc |

### Scene settings

`settings: { title, subtitle, joystick, jumpButton, actionButton, pauseButton, muteButton, winScore, timeLimit, saveBest, orientation, fullscreen }`. `orientation` (`'portrait'`/`'landscape'`) shows a "turn your device" screen when a phone is held the wrong way; `fullscreen` goes fullscreen on the first tap. Games keep the screen awake while playing and have a mute button. With `timeLimit`, `{time}` counts down and the game ends at zero.

**Levels:** put more scenes in `levels: [sceneJson, ...]` on the first scene. Winning a level shows "Level complete" and continues to the next one, carrying variables like score and lives over; `{level}` shows the level number. `engine.start(json, { level: 1 })` starts at the second level. Also `background`, `gravity` (2D: positive is down, e.g. `1600` for a platformer; 3D: e.g. `-25`), `view` (2D design size), `camera`, `light: { dir, color, ambient }` and `fog: { near, far }` for 3D.

## Limitations (v0.1)

- Physics uses axis-aligned boxes and spheres. Rotation is visual only, and there are no slopes or joints.
- 3D has primitive meshes only (no model loading or textures yet) and blob shadows instead of real shadow maps.
- Projects are saved in the browser's local storage. Use JSON export for backups.
