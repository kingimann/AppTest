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
   | Voxel Sandbox | Block Craft | Minecraft-style terrain, first-person break & build |
   | Turn-Based RPG | Slime Battle | attack/heal/spell buttons, enemy turns, HP & MP |
   | Dungeon Crawler | Tiny Dungeon | turn-based grid movement, bump combat, goblins |
   | Board Game | Tic-Tac-Toe | tap cells, play the computer |
   | Tap Arcade | Tap Frenzy | tap targets against the clock |
   | Blank 2D / 3D | | start from nothing |

2. **Scene** fills the screen. Tap an object to select it; drag to move it. The tool rail on the left has Hand, Move, Rotate, Scale and **Paint** (stamp copies by tapping or dragging). Pinch to zoom; drag empty space to pan (2D) or orbit (3D).
3. **Blue + button**: add things. Tap a tile to add it, or press, hold and drag it to the exact spot.
4. **Bottom sheet**: **Hierarchy** (all objects; the top row opens game settings), **Inspector** (the selected object's components; −/+ buttons nudge numbers, ⋮ copies or removes a component, **Add Component** adds more) and **Project** (prefabs, objects, components). It starts small so the Scene gets the screen: tap a tab or swipe up on the tabs to open it, swipe down to close it, or drag the handle. Held sideways, the panels move to the right.
5. **▶ Play** tests the game instantly; **■ Stop** (or the phone's back gesture) returns to editing.

New projects show a **Getting started** checklist at the top of the Hierarchy: add a player, ground, something to collect, some node logic, and press Play. Each step has a button that does it for you.


| Gesture | Does |
| --- | --- |
| Long-press an object | Object menu: Inspect, Duplicate, Copy, Paint copies, Focus, Hide, Lock, Delete |
| Long-press empty space | Paste here, Add object here, Reset view, Game settings |
| Two-finger tap / three-finger tap | Undo / Redo |
| Double-tap empty space | Reset the view |
| Drag a field's label | Scrub its number |
| − / + / ⟲ buttons over the Scene | Zoom out, zoom in, reset the view (the page itself never zooms) |
| **UI** button above the Scene | UI mode: only on-screen UI can be selected; Project → UI has panels, buttons, bars and ready-made menus |

The quick-action bar over the Scene (Inspect, Duplicate, Focus, Delete) appears when something is selected. The level button above the Scene adds and switches levels.

**Templates and spawners.** Tick *Template* on an object to hide it during play. A **Spawner** or **Shooter** component then creates copies of it by name.

**Sharing.** *☰ → Build HTML* makes one file anyone can play in a phone browser. Projects are saved on the phone automatically; JSON export/import is in the menu.

### Easy logic: Triggers (Game Creator style) and State Machines (PlayMaker style)

Add them from *Create → Logic*, *Add Component → Logic*, or **Quick add** in the Inspector.

- **Triggers** are friendly cards: **ON** something happens → **IF** conditions are true → **DO** instructions, top to bottom.
  - **14 events**: game starts, every N seconds, tapped, touched / stops touching a tag, jump/fire button, swipe, message, variable reaches, destroyed, animation finished, and more.
  - **12 conditions**, each flippable with NOT: compare variable, chance, touching, on ground, distance, can see, exists, visible, state is, has item, has save, game playing.
  - **34 instructions** in 6 groups:
    - Variables: change variable, give/use item.
    - Objects: show/hide, destroy, spawn, set text, set colour, move to, damage/heal.
    - Motion: move/rotate/scale/fade with easing and "wait until done", punch, play animation.
    - Physics: push, set velocity, jump, gravity.
    - Flow: **wait**, send message, go to state.
    - Game: show message, dialogue, sound, vibrate, camera shake/switch, save/load, win, game over, next level, restart.
  - Tap a row to edit it in place; ⋮ moves, duplicates, disables or deletes it.
  - **Templates** add ready-made triggers: tap to score, touch to collect, door opens with a key, hazard hurts, spawn every 2s, win at 100, talk to an NPC.
- **State Machine**:
  - The object is always in one state (Patrol, Look Around, Alert…). States are cards on a map with arrows between them.
  - Tap a state to edit what it does **when entering**, **every frame** and **when leaving**.
  - Each state also has its **transitions**: "ON event, IF conditions → go to another state". Two FSM-only events: "after N seconds in this state" and "when this state's actions finish".
  - **Any State** transitions work from every state. Drag states to arrange them; the start state has a green border.
  - The current state is in `{state}`-style data and the "State is" condition. The *Patrol Guard (FSM)* prefab is a complete example.
- **Node scripts** now have **Templates** too (★ in the Node Editor).

### Advanced components

| Component | What it does |
| --- | --- |
| **Health & Damage** | Max health, hurt by tags, invulnerability, knockback, regeneration, a HUD variable, and death action (destroy, game over, respawn, message) |
| **Enemy AI** | Patrols, chases when it sees the target (walls block its view), attacks in range (damaging Health), gives up and returns home |
| **Pathfinding (Navigator)** | A* around walls to a tag or object, for smart chasers, pets and NPCs (2D and 3D) |
| **Joint** | Spring, rope (pendulums, swings) or rod to another object, with a drawn rope |
| **Wave Spawner** | Waves of a template with breaks, `{wave}` counter, win / message / loop when beaten |
| **Dialogue** | Conversation box with speaker names and typewriter text; tap to continue; can pause the game |
| **Day / Night Cycle** | Moves the sun, changes light and sky colours; 2D gets dark at night; `{hour}` |
| **Particle System** | Fire, smoke, rain, snow, sparkle, confetti, magic, bubbles (rain and snow fill the screen) |
| **Inventory Item** | Pick-ups go to the inventory: `{inventory}`, `{item_Key}`, "Has item" condition, "Give / use item" instruction |

Ready-made prefabs: Smart Enemy, Talking NPC, Inventory Key, Rain, Day & Night, Wave Spawner, Patrol Guard (FSM).

### Hierarchy and Inspector

- **Hierarchy**:
  - Each row shows a coloured icon by kind (player, UI, logic, camera, light, template) and a line listing its components.
  - Three or more objects with the same name fold into one row (**Gem ×8**). Tap to open or fold it; its eye shows or hides them all.
  - **Filter** button next to search: Player, Logic, Physics, UI or Templates only. Search also matches tags and components.
  - Selecting an object in the Scene scrolls the Hierarchy to it, opening its folder, group or parent.
  - **Folders** (long-press → Put in Folder…), collapsible, with rename / hide all / remove.
  - **Select** (the tick button next to search): tick several objects (tapping a ×N group ticks all its copies), then **Duplicate**, **Group** (puts them in a new parent so they move together), **Hide / Show**, **Folder** or **Delete** them at once. **All** ticks everything shown.
  - **Getting started** is a one-line strip with the next step (tap to see all steps).
  - Bring to front / send to back; a lock button on locked objects.
- **Inspector**:
  - Short fields (numbers, dropdowns, colours, text) sit beside their label; component headers stay pinned while you scroll.
  - Only fields for the game's mode (2D or 3D) are shown. **Advanced** next to search shows the rarely used ones.
  - Category filters: Visual, Physics, Logic, Animation, Gameplay, and one fold / unfold-all button.
  - **Quick add** chips for common components, next to Add Component.
  - Components have a coloured edge by category.

### Node coding (Visual Script)

Add **Visual Script** from *Add Component → Logic*, from *Create → Visual Script*, or from the Getting started list, then tap **Open Node Editor**. The editor fills the screen:

- **Add Node** opens a list grouped into **Events** (green: On Start, On Tap, On Touch, Every N Seconds, On Button, On Swipe, Every Frame, On Destroyed), **Actions** (blue: change variables, show messages, sounds, spawn, destroy, move, jump, show/hide, shake, vibrate, win, game over, next level), **Flow** (purple: If, Wait, Random Chance, Do Once, Sequence) and **Values** (orange: numbers, variables, random, math, compare, and/or/not, position, distance, time).
- If a node is selected, the new node is **wired to it automatically** and placed next to it, so a script grows as a chain without touching a wire.
- **Wire** two nodes by tapping a dot and then a glowing dot (or drag from dot to dot). White diamonds set the order things happen in; round dots carry numbers (blue) and true/false (orange). An input with no wire uses the value typed on the node.
- Tap a wired input dot to unplug it, or tap a wire to delete it. ⋮ on a node duplicates it, removes its wires or deletes it.
- Drag nodes to move them, drag empty space to pan, pinch to zoom. ⟲ undoes, ⛶ fits everything on screen, and **Done** or the back gesture closes the editor.

Graphs are saved as JSON on the behavior (`{ nodes: [{ id, type, x, y, params }], links: [{ from: { node, port }, to: { node, port } }] }`), so they work in exported games too. `NODE_TYPES` in the engine lists every node.

### Rect tool and UI components

- **Rect tool** (like Unity's T tool; the corner-squares button on the tool rail, and the default in the UI editor):
  - Drag any of the **8 handles** to resize a UI element or a 2D object. The opposite edge stays put; circles and rings stay round.
  - Drag the middle to move. A live **W × H** label shows the size, and the magnet snaps to 4 px.
  - The UI Element inspector has **Size (W × H)** fields and **Stretch to screen** (full width / full height / fill, with a margin), like Unity's stretch anchors.
- **New UI components**:
  - **Slider** (drag to set a variable; one bound to `{volume}` 0–100 controls the game's sound).
  - **Toggle** (on/off variable with its own text and colour).
  - **Layout Group** (vertical / horizontal / grid of tagged UI with spacing and alignment).
  - **Animated Counter** (scores count up with a pop).
  - **Typewriter Text**, and **Text Input** (tap to type a name into `{name}`).
  - **Touch Button** (your own on-screen control placed and sized anywhere: left, right, up, down, jump, fire or a message while held).
  - **Minimap** (player, enemies, walls and coins around the player), and **Ring** progress bars.
- **New UI widgets**: Volume Slider, Toggle, Progress Ring, Minimap, Animated Score, Typewriter Text, Name Input, Touch Controls (◀ ▶ JUMP; replaces the built-in joystick), Vertical Menu (Play / Continue / Restart in a layout group), Top Bar (full-width).

### Tilemaps (2D)

- Add **Objects → Tilemap**. The Paint tool turns on: drag on the Scene to paint tiles on a grid (a faint grid shows while painting).
- The **Tilemap** card in the Inspector:
  - **Paint** / **Erase** brush and a palette of tile types (tap one to paint with it, **New** adds a type).
  - Each type has a colour, an optional grass-style top edge, an optional emoji, and what it **does**: **Solid** (walls and ground), **One-way platform** (jump up through it, land on top), **Hazard** (hurts the player) or **Decoration** (no collision).
  - Tile size and **Erase all**.
- Bodies slide smoothly along rows of solid tiles (no snagging on the seams). Grid-based games treat solid tiles as walls.

```js
{ name: 'Level', x: 0, y: 400, tiles: { size: 40, palette: [{ fill: '#6d4c41', top: '#7cb342', kind: 'solid' }], cells: { '0,0': 1, '1,0': 1 } } }
```

### Prefabs

- Long-press an object (or its ⋯ menu) → **Make Prefab**. It appears in **Project › Prefabs › My Prefabs**; tap or drag it to place copies.
- Each copy keeps its own position, rotation, scale and name; everything else (look, components, children) comes from the prefab. Copies are blue in the Hierarchy.
- Change a copy and its banner turns amber: **Apply to all** updates the prefab and every copy in every level, **Revert** goes back to the prefab, **⋯** selects all copies or **Unpacks** this one into a plain object.

### Post Processing

- Tap the level (top row of the Hierarchy) → **Post Processing**. Start from a look — **Neon glow**, **Warm sunset**, **Cold**, **Night**, **Retro**, **Dreamy**, **Black & white** — then tune it:
  - **Bloom** (glow around bright things) with size and "only bright parts".
  - **Vignette** (dark edges), **Brightness**, **Contrast**, **Saturation**, **Hue shift**, **Tint** colour and amount.
- Works in 2D and 3D, in the editor and while playing. The HUD isn't affected.

```js
{ post: { bloom: 0.8, bloomRadius: 16, vignette: 0.35, saturation: 125, tint: '#ff9a3c', tintAmount: 0.2 } } // on a level
```

### Collision layers

- Each **Rigidbody** has a **Physics layer**: Default, Player, Enemy, Bullet, Ground, Pickup, or two spare layers you can rename.
- Tap the level → **Collision Layers**: a grid of which layers collide. Untick a box and those two layers pass through each other with no touch events (e.g. enemies' bullets ignore other enemies). Tilemaps count as Ground. The grid is shared by every level.

```js
{ physicsLayers: { names: [...], matrix: [255, 251, 253, 255, 255, 255, 255, 255] } } // on the project; body: { layer: 1 }
```

### Sounds

- **Project › Sounds › Import Sound** brings in MP3, WAV, OGG or M4A files from your phone (short clips work best: they're saved inside the project). Tap ▶ to preview; ⋯ renames (everything using it follows) or deletes.
- Imported sounds appear in every Sound picker: the Sound component, Turret, the Play Sound action and node. From code: `s.engine.audio.sfx('name')`.

### Console

- The **Console** tab lists what your game reports while it runs: the **Debug Log** action (Triggers) and node (Visual Script), `P.log()` / `P.warn()` in custom scripts, warnings (e.g. spawning a template that doesn't exist) and errors.
- Repeated messages fold into one line with a count. Filter by Log / Warn / Error, clear it, and choose whether Play clears it. Tap a message from an object to jump to it.
- While playing, the console button in the play bar (with a red count for errors) opens a live log over the game.
- A custom script that crashes is reported once and the game keeps running.

### Parenting, UI anchoring and UI zoom

- **Make an object a child** (it then moves, turns, scales and hides with its parent, in the editor and in play):
  - Select it, tap **Attach** in the bar over the Scene, then tap the object it should go inside (in the Scene or the Hierarchy).
  - In the Inspector of the parent, the **Children** card has **Add Existing** (pick from a list) and **New Child**.
  - In the Hierarchy, drag an object's **grip** (the move handle on its row) onto another object.
  - Or long-press an object and pick **Make Child Of…**, or choose a **Parent** at the top of the Inspector.
  - **Add Child Object** (long-press menu, or the **+** next to Parent) creates a new object inside the selected one.
- **Take it out again**: tap **Detach** in the bar over the Scene, tap **Remove** next to it in its parent's **Children** card or next to **Parent** in its own Inspector, drag the grip onto the top (scene) row, or set Parent to *none*. It stays where it is on screen.
- The Hierarchy shows children indented under their parent with a fold arrow. Duplicating or deleting a parent includes its children. Children of templates are spawned along with them.
- **UI anchoring** (like Unity's anchor presets): the UI Element inspector has a 4 × 4 grid (top / middle / bottom / stretch × left / centre / right / stretch). Picking one keeps the element where it is.
  - A UI element inside another one (a label inside a panel) is anchored and stretched to its **parent's box** instead of the screen.
  - The selected element shows its anchor marker, a dashed line to it, and its parent's box.
- **Zoom in the UI editor**: pinch, or use the − / + buttons; drag with two fingers (or the hand tool) to pan; the frame button resets the view.

Children store `parent: '<id>'` and their `x / y / z / rotation / scale` are relative to the parent. `scene.childrenOf(e)` lists them. Destroying a parent destroys its children.

### View modes: Scene, Top and UI editor · 2D and 3D levels

- **Scene / Top / UI**: tap the view button above the Scene.
  - **Top view** lays out a 3D level from straight above with no perspective, like a 2D map. Drag pans; pinch zooms.
  - The **UI editor** (also the **UI** button) shows only the screen:
    - safe-area and centre guides, plus the 9 anchor points;
    - drags snap to the centre and to the element's anchor;
    - the Hierarchy lists only UI, and Create offers UI widgets;
    - screen chips (All, Playing, Title, Paused, Game Over, Win) preview what each screen shows.
- **Mix 2D and 3D**: each level has its own mode. *Levels → New 2D Level / New 3D Level*, so a game can go from a 2D menu world into a 3D level. UI carries over to the new level.

### Animation (Animator, Tween, Sprite Animation)

- **Animator + Animation timeline.** Open it from *long-press an object → Animate…* or the Animator's button.
  - Scrub the time bar, pose the object in the Scene, and tap **◆ Key**. With **Auto** on, every change is keyed for you.
  - Tap a key to set its time, value and ease, or delete it. ▶ previews the clip.
  - Clips can loop, ping-pong or play once; you can have several clips per object, with one playing on start.
  - Keys are offsets from the object's rest pose, so clips work wherever the object is (even while physics moves it).
  - Play clips with the *play animation* action, the Play Animation node, or a message with the clip's name.
- **Tween** component (like DOTween Animation):
  - Effects: move by/to, rotate, scale, fade, colour, punch scale/position, shake position/rotation, path, jump.
  - 28 eases with a curve preview, loops (−1 = forever), yoyo/restart/incremental, delay.
  - Play on start, tap, touch or message, and **when finished, do** an action. **Preview** plays it right in the Scene.
- **Sprite Animation** (flipbook): emoji or image frames at any fps; loop, ping-pong or once; always, only while moving, or on a message.
- **From code** (DOTween style):
  - `scene.to(obj, { x: 100, 'shape.fill': '#f00' }, 0.5, { ease: 'outBack', loops: -1, loopType: 'yoyo' })` returns a tween you can chain: `.setDelay()`, `.onComplete()`, `.kill()`.
  - `scene.sequence().append(scene.make(…)).join(…).appendInterval(0.2).appendCallback(fn)`.
  - `scene.punch`, `scene.shakeProps`, `scene.path`, `scene.jumpTo`, `scene.killTweens`.
  - `Ease.outBounce` and friends.
- **Messages:** `scene.send('door-open')`, the *send message* action, and the Send Message / On Message nodes let objects trigger each other.
- **Nodes:** Tween, Punch, Stop Tweens, Play/Stop Animation, Send Message, On Message, Camera Impulse.

### Inspector superpowers (Odin-style)

- Sliders under ranged numbers.
- Fields that only appear when relevant (e.g. a Tween's Amount shows for Fade but not Move).
- Foldout groups ("Timing & trigger", "Framing", …) and info boxes that explain the current choice.
- Pick-lists of the tags, templates, objects, variables, clips and messages already in your game.
- A curve preview for every ease, and a row of recently used colours.
- Warnings when something is wrong (a missing template, a camera with nothing to follow, a script with no event).
- Buttons on components: Preview, Open Animation Timeline, Look Through Camera.
- **Search settings** at the top of the Inspector finds any field.
- Swipe left or right across the bottom panel to move between Hierarchy, Inspector and Project.

### Cameras (Cinemachine-style)

The Camera component is a virtual camera:
- **Modes:** follow, fixed, side scroller, top down, orbit, **group** (frames every object with a tag and zooms out to fit) and **dolly** (rides a track of points, staying as close as it can to the target).
- **Framing:** a separate **look-at** target, **screen X/Y** offsets to put the target off-centre, damping, look-ahead, a dead zone, and a 2D confiner.
- **Noise and impulse:** handheld **noise**, and **impulse** shakes that are weaker far away (`scene.impulse(strength, at)`, Camera Impulse node).
- **Orthographic 3D** for isometric games.
- **Switching:** with several cameras the highest priority starts. Switching (action, node or `scene.setCamera(name)`) **blends** smoothly over the new camera's blend time and ease.

### 3D Modeler (Blender-style modeling)

Open it with **Open 3D Modeler** on any 3D Model component, or *Create → New 3D Model (Modeler)*. It fills the screen with its own 3D view:

- **Object mode** works on whole parts:
  - Add editable meshes (cube, plane, cylinder, cone, UV sphere, ico sphere, torus) or simple shapes.
  - Duplicate, mirror across X, colour, smooth/flat shading, delete.
  - **Make Editable** turns any simple shape into a mesh.
- **Edit mode** reshapes a mesh by **Vertex** or **Face**:
  - Tap to select (taps toggle). All / None / Grow change the selection.
  - **Extrude**, **Inset**, **Subdivide**, **Smooth**, **Merge**, **Fill**, **Flip** and **Delete**.
  - **Paint** colours faces.
  - **Mirror X** edits both sides at once.
- **Transform**:
  - Pick Move, Rotate or Scale and an axis (X, Y, Z, Free, or Normal for faces).
  - Drag the selection or its round handle to apply it. The magnet snaps (0.25 units, 15°, ×0.25).
  - Double-tap a mesh in Object mode to edit it.
- **View**:
  - Drag empty space to orbit; pinch to zoom; two fingers to pan.
  - Persp, Front, Side and Top buttons, and Frame everything / selection.
- **Undo and files**: undo and redo. **Import / Export OBJ** to move models to and from Blender and other tools.

Meshes are saved as `{ geometry: 'mesh', verts: [[x,y,z]…], faces: [{ v: [i,j,k,…], c: '#color' }…], smooth }` parts inside `model.parts`. They render double-sided with per-face colours, and the object's collider fits around them.

### Saving, lighting, physics and cameras

- **Saving.** A save keeps variables, the level, where objects are and what was collected or destroyed. You can save with any of these:
  - a **Save Point** prefab;
  - a Button with *Do → save game* (Amount = slot);
  - the Save Game node;
  - the **Pause Menu** UI widget (Resume / Save / Load / Restart).

  To load, use *load game*, the Load Game node, or the **Continue Menu** widget. *Game Settings → Saving → Continue from save slot 1 on start* resumes automatically.
- **Lighting.** Add a **Light** object, or the Light component on anything (a torch on the player):
  - **2D:** *Game Settings → Lighting → Darkness* makes caves and night levels, and lights cut through it. The **Torch** prefab sets this up for you.
  - **3D:** up to 8 coloured point lights; sun colour, brightness, direction and height; ambient light; sky and ground tint; shadows on or off. The **Lamp** object is a lamp post with its own light.
- **Physics.**
  - Gravity on X, Y (and Z in 3D).
  - Rigidbody materials: Ice, Rubber, Wood, Metal, Sticky, Bouncy, Feather.
  - Freeze X/Y/Z, max speed, and "pass through tags" (e.g. bullets that ignore their shooter).
  - **Force Zones** (Wind Zone prefab).
  - Nodes: Push, Set Gravity, Is On Ground, My Velocity.
- **Collisions.**
  - 2D boxes collide at their rotation (a **Spinning Bar** really sweeps).
  - Fast objects are checked in extra sub-steps, so they don't pass through walls.
  - A sweep-and-prune broad phase keeps big scenes fast.
  - "On Touch End", Is Touching and Can See (line of sight) nodes.
- **Cameras.**
  - Add a **Camera** object (Create → Camera). In 2D its dashed frame shows what it sees.
  - Several cameras can sit in one scene: the highest priority starts active, and Switch Camera / Zoom Camera change it during play.
- **UI.**
  - Text can have fonts, weight, an outline and a drop shadow.
  - Progress bars can show icons (Hearts widget).
  - New widgets: Coin Counter, Big Title, Save / Load buttons, Pause Menu, Continue Menu, Dialog Box.
  - Any UI set to *Show when: Paused / Title / Game over* replaces that built-in screen. In the editor these menus show in UI mode or when selected.

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
  parent: 'id',                            // child of another entity: transform is relative to it
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
| `camera` | Put on a Camera object. Modes: follow, fixed, side scroller, top down, orbit (drag to look around). Smoothing, look-ahead, dead zone, 2D zoom / 3D field of view, keep-inside-level bounds, priority. Switch with the *switch camera* action or Switch Camera node. | `mode`, `target` ("player"), `smooth`, `zoom`, `fov`, `ox/oy/oz`, `lookAhead`, `deadZone`, `bounds`, `priority` |
| `forceZone` | Area that pushes dynamic bodies inside it: wind, currents, conveyors, magnets (pull to center), blasts (push from center). | `mode`, `fx/fy/fz`, `strength`, `tag` |
| `savePoint` | Saves the game when the player touches it. | `slot` (1), `text`, `tag` |
| `cameraFollow` | The camera tracks this object (simple version of `camera`). | `smooth` (6), `axes` ("both"), `ox` (0), `oy` (0 / 3D 7), `oz` (0 / 3D 11) |
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
| `gridMove` | Moves one tile per swipe, joystick push or tap beside the player; ends your turn in turn-based games. Bump enemies to attack, push objects tagged `pushable`. | `tile` (40 / 3D 1), `tapToMove`, `damage` |
| `gridEnemy` | Turn Enemy: each enemy turn steps toward the player and attacks when adjacent. | `tile`, `hp`, `points`, `sight` |
| `boardCell` | A board square (tic-tac-toe, connect-style): tap to place a mark; vs a friend or the computer. | `row`, `col`, `line` (3), `vsComputer` |
| `turnAction` | Turn Button: on your turn, tap to change a variable (attack/heal/spell), optionally costing another. | `var`, `amount` (min/max), `max`, `costVar`, `cost`, `text`, `sound` |
| `turnOpponent` | Enemy Turn: on the enemy's turn, changes a variable and shows a message. | `var`, `amount`, `text` |
| `condition` | When a variable passes a value, do an action (win when enemyHp ≤ 0, lose when hp ≤ 0…). | `var`, `op`, `target`, `action`, … |
| `voxelBuilder` | Block Builder: tap blocks to break them, or switch to place mode; on-screen buttons change mode and block. | `reach` (6), `block`, `mode` |
| `button` | Tap it (UI or game object) to do an action: start/restart/pause the game, show/hide menus, change variables, jump… Keeps working on title and end screens. | `action`, `value`, `amount`, `sound` |
| `rules` | Visual logic: WHEN (game starts, every few seconds, touched by tag, tapped, jump/fire button, swipe, variable reaches, destroyed) IF (variable compare, optional) DO (a list of actions). | `rules` |
| `graph` | Visual Script: node-based logic built in the Node Editor. Events start a chain of actions; value nodes feed numbers and true/false into inputs. | `graph` |
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
| `scene.on('collide' \| 'separate' \| 'var' \| 'over' \| 'win', fn)` | events (`separate` = stopped touching; behaviors get a `separate(e, other, scene)` hook) |
| `scene.raycast(origin, dir, maxDist, { ignore, tag })`, `scene.canSee(a, b)` | ray tests against colliders (rotated 2D boxes, circles, 3D boxes and spheres) |
| `scene.saveGame(slot)`, `scene.loadGame(slot)`, `scene.hasSave(slot)`, `scene.deleteSave(slot)` | save slots: variables, level, positions and what was collected |
| `scene.setCamera('Camera 2')`, `scene.gravityX`, `scene.gravityZ`, `scene.light` | switch cameras, sideways gravity, lighting (`darkness` for 2D, sun / ambient / sky / ground for 3D) |

| | |
| --- | --- |
| `engine.input.axis()` | `{x, y}` from the joystick or tilt |
| `engine.input.pressed('jump' \| 'action' \| 'tap' \| 'swipe:left')`, `isDown('jump' \| 'action')` | touch buttons, taps, swipes |
| `engine.input.taps`, `engine.input.pointers`, `engine.input.useTilt = true` | raw touches, tilt controls |
| `engine.audio.sfx('coin' \| 'jump' \| 'hit' \| 'power' \| 'win' \| 'lose')`, `audio.play(url)` | sound |
| `engine.vibrate(ms)`, `engine.timeScale`, `engine.paused`, `engine.restart()` | misc |

### Scene settings

`settings: { title, subtitle, joystick, jumpButton, actionButton, pauseButton, muteButton, winScore, timeLimit, saveBest, orientation, fullscreen }`. `orientation` (`'portrait'`/`'landscape'`) shows a "turn your device" screen when a phone is held the wrong way; `fullscreen` goes fullscreen on the first tap. Games keep the screen awake while playing and have a mute button. More phone settings: `joystickSide` (`'left'`/`'right'` for left-handed players; buttons move to the other side), `controlSize` (`'small'`/`'medium'`/`'large'`), `saveProgress` (variables and level survive closing the game; reset on game over), `shareButton` (a *Share score* button on the end screen using the phone's share sheet). Buttons vibrate when pressed, audio recovers after calls or app switches, and the engine lowers its resolution automatically if a phone can't hold a smooth frame rate. With `timeLimit`, `{time}` counts down and the game ends at zero.

**Turn-based games:** set `settings.turnBased`. Grid Move, Turn Button and Board Cell end the player's turn; then every component with a `turn(e, scene)` hook acts (Turn Enemy, Enemy Turn, the board's computer player) after `turnDelay` seconds. Texts can show `{turnText}` and `{turn}`; `scene.endTurn()` ends a turn from scripts. `messageTop` moves message banners to the top of the screen.

**Actions** (Trigger, Timer, Condition, Button, Rules): message, add score, add to variable, set variable, spawn template, destroy object/other, show/hide/toggle object, play sound, vibrate, camera shake, jump, move by, win, game over, next level, start/restart/pause/resume game.

**Custom UI:** UI entities can have a `bar: { var, max, maxVar, w, h, fill, bg, radius, label }` (health/progress bar; `var: "self.hp"` reads an object's own health from the Health component) and `showWhen: 'always' | 'play' | 'title' | 'paused' | 'over' | 'win'`. `settings.customScreens` turns off the built-in title/pause/end screens so your own UI and Buttons run them. Anchors include `left`, `center` and `right` edges.

**Controls:** `settings.controls` = `'auto'` (joystick when `joystick` is on) / `'joystick'` / `'dpad'` / `'arrows'`; `joystickMode` `'floating'` or `'fixed'`; `controlsOpacity`; `jumpLabel` / `actionLabel`. Platformer has acceleration, air control and short hops when the jump button is released early.

**Physics:** bodies support `oneWay` platforms (jump up through, land on top), riding moving (kinematic) platforms, `mass` (heavier pushes lighter), `friction`, `drag`, `maxFall`, and collider offsets `ox/oy/oz`.

**3D shapes and models:** meshes come in box, sphere, cylinder, cone, capsule, pyramid, wedge (ramp), prism, gem, dome, torus and plane. `model: { parts: [{ geometry, x, y, z, rx, ry, rz, w, h, d, r, color, emissive }] }` builds a model from parts (the editor's 3D Model component edits parts and highlights the selected one; Project → Models has 17 ready-made models). The collider fits around all parts.

**2D sprites:** shapes include rect, circle, ellipse, triangle, star, heart, diamond, hexagon, pentagon, octagon, capsule, ring, arrow, cloud, and `emoji` sprites (`shape: { type: 'emoji', emoji: '🐱', w, h }`; Project → Sprites has a library of characters, enemies, items, nature, food, vehicles and props).

**Voxels:** give an entity `voxels: { size, gen: { type: 'hills' | 'flat' | 'empty', w, d, h, seed, trees }, edits: { "i,j,k": block } }` for a Minecraft-style block world (12-block palette: grass, dirt, stone, wood, leaves, sand, water, brick, snow, obsidian, gold, crystal). It is drawn as merged chunks (only visible faces), dynamic bodies walk on it and bump into it, projectiles stop at blocks, and `entity.voxels.get/set(i, j, k)` / `raycast(entity, origin, dir)` let scripts dig and build. In the editor, select the world, pick the brush (Paint tool), choose Add/Remove and a block, then tap or drag to build.

**Levels:** put more scenes in `levels: [sceneJson, ...]` on the first scene. Winning a level shows "Level complete" and continues to the next one, carrying variables like score and lives over; `{level}` shows the level number. `engine.start(json, { level: 1 })` starts at the second level. Also `background`, `gravity` (2D: positive is down, e.g. `1600` for a platformer; 3D: e.g. `-25`), `view` (2D design size), `camera`, `light: { dir, color, ambient }` and `fog: { near, far }` for 3D.

## Limitations (v0.1)

- Physics uses axis-aligned boxes and spheres. Rotation is visual only, and there are no slopes or joints.
- 3D has primitive meshes only (no model loading or textures yet) and blob shadows instead of real shadow maps.
- Projects are saved in the browser's local storage. Use JSON export for backups.
