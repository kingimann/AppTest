# Pocket Engine

A **2D + 3D game engine for phones**, plus a **visual editor you use on your phone**. It is touch-only by design: no keyboard or mouse controls.

Make any kind of game: platformers, first-person shooters, third-person adventures, top-down games, racing, endless runners, clicker/idle games, space shooters, tap games and puzzles.
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

Or use the live version: **https://kingimann.github.io/AppTest/editor/**

## The editor

Open **https://kingimann.github.io/AppTest/editor/** on your phone. *☰ → Install App* adds it to your home screen, and it works offline.

1. **Home screen**: continue your last game, or pick a **game type**. Each one is a complete, playable starter you change any way you like:

   | Type | Starter | What it shows |
   | --- | --- | --- |
   | Platformer | Jump Quest | run & jump, 2 levels, keys and doors |
   | Third Person | Sky Islands | 3D follow camera, jumping between islands |
   | First Person | Target Range | look by dragging, aim and fire |
   | Top Down 3D | Gem Garden | joystick, collect, enemies |
   | Top Down 2D | Sky Dodge | dodge and collect, spawners |
   | Space Shooter | Star Defender | waves, bosses with health |
   | Racing | Desert Rally | car controls, chase camera, time limit |
   | Endless Runner | Lane Rush | swipe lanes, jump |
   | Clicker / Idle | Cookie Tap | tap to earn, upgrades, income per second, saved progress |
| Breakout | Brick Breaker | bouncing ball, paddle, breakable bricks |
   | Tap Arcade | Tap Frenzy | tap targets against the clock |
   | Blank 2D / 3D | | start from nothing |

2. **Scene** fills the screen. Tap an object to select it; drag to move it. The tool rail on the left has Hand, Move, Rotate, Scale and **Paint** (stamp copies by tapping or dragging). Pinch to zoom; drag empty space to pan (2D) or orbit (3D).
3. **Blue + button**: add things. Tap a tile to add it, or press, hold and drag it to the exact spot.
4. **Bottom sheet**: **Hierarchy** (all objects; the top row opens game settings), **Inspector** (the selected object's components; −/+ buttons nudge numbers, ⋮ copies or removes a component, **Add Component** adds more) and **Project** (prefabs, objects, components). Drag the handle or tap the open tab for peek, half or full height. Held sideways, the panels move to the right.
5. **▶ Play** tests the game instantly; **■ Stop** returns to editing.

| Gesture | Does |
| --- | --- |
| Long-press an object | Object menu: Inspect, Duplicate, Copy, Paint copies, Focus, Hide, Lock, Delete |
| Long-press empty space | Paste here, Add object here, Reset view, Game settings |
| Two-finger tap / three-finger tap | Undo / Redo |
| Double-tap empty space | Reset the view |
| Drag a field's label | Scrub its number |

The quick-action bar over the Scene (Inspect, Duplicate, Focus, Delete) appears when something is selected. The level button above the Scene adds and switches levels.

**Templates and spawners.** Tick *Template* on an object to hide it during play. A **Spawner** or **Shooter** component then creates copies of it by name.

**Sharing.** *☰ → Build HTML* makes one file anyone can play in a phone browser. Projects are saved on the phone automatically; JSON export/import is in the menu.

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
| `move` | Player movement with the joystick, dragging, or tilting the phone (`control: "tilt"`). | `speed` (260 / 3D 7), `control` ("both"), `axes` ("all"), `keepInView` (true), `face` (true) |
| `platformer` | Run & jump. Uses gravity; tap or the jump button to jump. | `speed` (240 / 3D 7), `jump` (620 / 3D 10), `doubleJump` (false), `onFall` ("respawn") |
| `rotate` | Spin continuously. | `speed` (90), `axis` ("z" / 3D "y") |
| `patrol` | Move back and forth from the start point. | `dx` (120 / 3D 4), `dy` (0), `dz` (0), `duration` (2) |
| `velocity` | Move at a constant speed. Give a min–max range for random speeds. | `vx` (0), `vy` (200 / 3D 0), `vz` (0 / 3D 6) |
| `spawner` | Spawn copies of a template object over time, at random positions in a range. | `template` (""), `every` (1), `x` ([20,380] / 3D [-8,8]), `y` (-40 / 3D 1), `z` (0 / 3D -40), `relative` (false), `ramp` (0.1), `max` (60) |
| `shooter` | Fire copies of a template in the direction the shooter faces (give it a Projectile). | `template` (""), `every` (0.25), `trigger` ("auto" / "action button" / "tap") |
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
| `firstPerson` | First-person controls: joystick to walk, drag the screen to look. | `speed` (6), `look` (0.25), `eye` (0.6), `jump` (9) |
| `thirdPerson` | Over-the-shoulder controls: joystick moves relative to the camera, drag to turn it. | `speed` (6), `jump` (10), `distance` (7), `height` (25), `look` (0.3) |
| `car` | Drive with the joystick (up = gas). 3D cars get a chase camera. | `maxSpeed` (320 / 3D 16), `accel` (260 / 3D 12), `turn` (160 / 3D 110), `autoGas`, `chaseCam` |
| `projectile` | Flies straight the way it faces (bullet templates fired by a Shooter). | `speed` (650 / 3D 30), `life` (2) |
| `income` | Adds a "per second" variable into another every second (idle games). | `var` ("score"), `rateVar` ("perSecond") |
| `upgrade` | Tap to buy: spends one variable to raise another; price grows. Show it with `{cost}`. | `cost` (10), `costVar`, `addVar`, `amount`, `growth` (1.15) |
| `follow` | Follows another object at a distance (pets, sidekicks). | `target` ("player"), `distance` (60 / 3D 2), `speed` |
| `wander` | Roams around its starting area at random (animals, villagers). | `speed` (60 / 3D 2), `radius` (120 / 3D 5) |
| `path` | Moves through points like `"0,0; 150,0; 150,-100"` (offsets; 3D uses x,z). | `points`, `speed`, `loop` |
| `turret` | Turns toward the player and fires a template in range. | `template`, `every` (1.2), `range`, `tag` |
| `bounce` | Bouncing ball at a steady speed off walls, paddles and screen edges (breakout, pong). | `speed` (340 / 3D 9), `bottom` ("lose a life" / "bounce") |
| `trigger` | When the player touches it: message, change a variable, spawn, destroy, show, win, game over, next level, vibrate. | `action`, `value`, `amount`, `sound`, `tag`, `once`, `hidden` |
| `timer` | After some seconds (optionally repeating), do one of the same actions. | `seconds`, `repeat`, `action`, `value`, `amount`, `sound` |
| `dropItem` | Drops a template when destroyed (loot, power-ups). | `template`, `chance` (1) |
| `emitter` | Keeps giving off particles (fire, smoke, sparkles). | `color`, `rate` (20), `spread` (0.5) |
| `blink` | Flashes on and off; with Hazard it only hurts while visible. | `on` (0.6), `off` (0.6), `solid` (true) |
| `script` | Custom JavaScript: define `start(e, scene)`, `update(e, dt, scene)` and/or `collide(e, other, scene)`. | `code` |

Number params can be `[min, max]` for a random value where it makes sense (`velocity`, `spawner`). Texts show variables with `{name}`; big numbers display as 12.3K / 4.5M.

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
| `engine.input.axis()` | `{x, y}` from the joystick or tilt |
| `engine.input.pressed('jump' \| 'action' \| 'tap' \| 'swipe:left')`, `isDown('jump' \| 'action')` | touch buttons, taps, swipes |
| `engine.input.taps`, `engine.input.pointers`, `engine.input.useTilt = true` | raw touches, tilt controls |
| `engine.audio.sfx('coin' \| 'jump' \| 'hit' \| 'power' \| 'win' \| 'lose')`, `audio.play(url)` | sound |
| `engine.vibrate(ms)`, `engine.timeScale`, `engine.paused`, `engine.restart()` | misc |

### Scene settings

`settings: { title, subtitle, joystick, jumpButton, actionButton, pauseButton, muteButton, winScore, timeLimit, saveBest, orientation, fullscreen }`. `orientation` (`'portrait'`/`'landscape'`) shows a "turn your device" screen when a phone is held the wrong way; `fullscreen` goes fullscreen on the first tap. Games keep the screen awake while playing and have a mute button. More phone settings: `joystickSide` (`'left'`/`'right'` for left-handed players; buttons move to the other side), `controlSize` (`'small'`/`'medium'`/`'large'`), `saveProgress` (variables and level survive closing the game; reset on game over), `shareButton` (a *Share score* button on the end screen using the phone's share sheet). Buttons vibrate when pressed, audio recovers after calls or app switches, and the engine lowers its resolution automatically if a phone can't hold a smooth frame rate. With `timeLimit`, `{time}` counts down and the game ends at zero.

**Levels:** put more scenes in `levels: [sceneJson, ...]` on the first scene. Winning a level shows "Level complete" and continues to the next one, carrying variables like score and lives over; `{level}` shows the level number. `engine.start(json, { level: 1 })` starts at the second level. Also `background`, `gravity` (2D: positive is down, e.g. `1600` for a platformer; 3D: e.g. `-25`), `view` (2D design size), `camera`, `light: { dir, color, ambient }` and `fog: { near, far }` for 3D.

## Limitations (v0.1)

- Physics uses axis-aligned boxes and spheres. Rotation is visual only, and there are no slopes or joints.
- 3D has primitive meshes only (no model loading or textures yet) and blob shadows instead of real shadow maps.
- Projects are saved in the browser's local storage. Use JSON export for backups.
