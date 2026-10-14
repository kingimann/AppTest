# Core concepts

A handful of ideas explain almost everything in Pocket Engine. Learn these and the rest of the engine will feel familiar.

## Games, levels and scenes

A **game** is a list of **levels**. Each level is a **scene**: a set of objects plus its own settings (2D or 3D, background, gravity, lighting, design size).

- Levels play in order. Winning a level shows "Level complete" and starts the next one.
- **Variables carry over** between levels (score, lives, coins). So do the inventory, equipment and learned recipes, unless you turn that off.
- Each level can be 2D or 3D, so a game can go from a 2D menu world into a 3D level.
- Some settings belong to the whole game and are shared by every level: collision layers, UI theme, items and recipes, notification types, My Instructions and My Conditions.

## Objects (entities)

Everything in a level is an **object**: the player, a coin, a wall, the score text, the camera, an invisible trigger zone. In the engine's code they're called **entities**.

Every object has:

- a **name** (not unique; `find('Player')` finds the first one);
- a **transform**: position `x, y, z`, rotation `rx, ry, rz` in degrees, scale `sx, sy, sz`;
- **tags**, a **layer** and a **draw order** (see below);
- optionally a look: a 2D **shape** (rectangle, circle, star, emoji…), an **image** (sprite), **text**, a 3D **mesh** or **model**, a **light**, a **progress bar**;
- optionally physics: a **collider** and/or a **rigidbody**;
- any number of **components**.

### Coordinates and units

| | 2D | 3D |
|---|---|---|
| Units | design pixels (the level's *view* size, e.g. 400 × 700) | about one metre |
| y axis | points **down** | points **up** |
| Rotation you'll use most | `rz` (spin on screen) | `ry` (turn left / right) |
| Gravity | positive = down (e.g. `1600` for a platformer) | negative = down (e.g. `-25`) |

The design size is scaled to fit any phone. Objects keep their positions; the camera shows more or less around the edges depending on the screen shape.

### UI objects

An object with **UI** turned on lives in **screen space**: it doesn't move with the camera, and it's positioned from an **anchor** (top-left, top, centre, bottom-right…) in design pixels. Score text, buttons, menus and health bars are UI. UI also works in 3D games. See [UI, screens and navigation](#/guide/ui).

## Components

A **component** is a piece of behaviour you attach to an object, with settings you tune in the Inspector. Pocket Engine has about 150 of them, for example:

- **Movement:** Move, Platformer, Character Controller 2D, First / Third Person, Car, Grid Move.
- **Gameplay:** Collectible, Hazard, Goal, Spring, Checkpoint, Health & Damage, Damage Dealer, Inventory Item.
- **Logic:** Triggers, State Machine, Visual Script, Custom Script.
- **UI:** Button, Slider, Bottom Nav, Side Menu, Inventory Grid, Crafting.

An object can have many components, and they work together: a Collectible needs nothing else, while a Hazard hurts whatever has a Health component.

In a saved game, components are listed as `behaviors: [{ type: 'collectible', score: 10 }]` on the object. Every component, with all its settings and defaults, is in the [Components reference](#/ref/components).

## Tags

**Tags** say what an object *is*: `player`, `enemy`, `coin`, `wall`, `bullet`. An object can have several. They're how components and logic find things:

- Collectible gives points when touched by something tagged `player` (the *Tag* setting).
- Health is hurt by tags in *Hurt by tags* (`enemy, hazard`).
- The camera follows the first object tagged `player`.
- Triggers and nodes check "touched by tag", "count with tag", "nearest with tag".
- `scene.findAll('enemy')` returns every object with that tag (or that name).

> **Tip:** Tags are the glue of most games. If something "doesn't react", the first thing to check is whether the other object has the tag it's looking for.

Manage the game's tag list with *☰ → Tags & Layers…*: add, rename on every object, or delete.

## Layers

There are two kinds, both at the top of the Inspector:

- **Layer** (collision layer): one of eight named layers (Default, Player, Enemy, Bullet, Ground, Pickup and two spares). *Game Settings › Collision Layers* sets which layers collide. For example, untick Enemy ↔ Bullet so enemies' bullets pass through other enemies.
- **Draw** layer and **order** (2D and UI): Background, Default, Foreground or Top, plus an order inside it. Higher is drawn in front.

## Variables

**Variables** are named values the whole game can read and change: `score`, `lives`, `coins`, `hp`, `level`, `page`. They can hold a number, text, a list or a dictionary.

- Show one in any text with braces: `Score {score}`, `♥ {lives}`. Big numbers can show as `12.3K`.
- Change them with Triggers (*Change variable*), nodes (*Set / Add To Variable*), buttons, or code (`scene.setVar('coins', 10)`, `scene.addVar('score', 5)`).
- React to them: the *Variable reaches* and *Variable changes* events, the *Compare variable* condition, the Condition component.
- Set starting values in *Game Settings*; they reset when the game restarts.

Some variables are managed by the engine:

| Variable | Meaning |
|---|---|
| `score`, `best` | The score, and the best score saved with *saveBest* |
| `lives` | Used by Hazard *damage*, Lose a Life… |
| `time` | Counts down when the level has a time limit |
| `level` | The current level number |
| `turn`, `turnText` | Turn-based games |
| `page` | UI navigation (Bottom Nav, Side Menu, Go To Page) |
| `inventory`, `item_Name` | The inventory as text, and the count of one item |
| `hp`, `hunger`, `thirst` | When a component is set to show them there |

### Object variables

Each object also has its **own** variables (`e.data` in code): every enemy can have its own `hp`. Use *Set / Add To My Variable*, *Other's Variable*, *Variable Of Object*, or the Triggers *Change its own variable*. Text on the object can show them with `{hp}`.

## Messages

A **message** is a named signal sent to the whole game: `door-open`, `boss defeated`, `open crafting`. Anything can send one (buttons, Triggers, nodes, components, code) and anything can react (*Message received* event, *On Message* node, Tween / Animator *play on message*, `scene.on('message', …)`).

Messages can carry a value (a number or text), read as the **Event Value** (`@event` in Triggers).

Messages are the easiest way to connect things that don't know about each other: a button sends `shop`, a page listens for `shop`.

Many components understand messages too: `timer pause`, `navbar hide`, `scroll top`, `notify:reward Title|text`, `menu open`. Their reference pages list them.

## Templates and spawning

Tick **Template** on an object to hide it while playing. Other things can then create copies of it **by name**:

- Spawner (over time, in an area), Shooter (bullets), Turret, Wave Spawner, Tap to Spawn;
- the *Spawn* instruction and *Spawn At* / *Spawn & Launch* nodes;
- `scene.spawn('Bullet', { x, y })` in code.

Children of a template are spawned with it.

## Prefabs

A **prefab** is a saved object you can place many times, with linked copies. Edit one copy and **Apply to all** updates the rest, in every level. It's different from a template: templates are spawned *while playing*, prefabs are placed *while editing*.

## Parenting

Make an object a **child** of another and it moves, rotates, scales and hides with its parent: a sword in a hand, a label inside a panel, a group of objects that move together. A child's position is relative to its parent. Destroying a parent destroys its children.

## Game states

A game is always in one of these states:

| State | What's happening |
|---|---|
| `title` | The title screen (when *Game Settings › Start Screen* has a title) |
| `play` | Playing |
| `over` | Game over (`scene.gameOver()`) |
| `win` | Won (`scene.win()`), then the next level if there is one |

**Paused** is separate: the game is in `play` but frozen. UI objects can choose which screens they show on (*Show when*: always, play, title, paused, over, win), which is how you build your own title and game-over screens.

## The three ways to add logic

| | Best for | Looks like |
|---|---|---|
| **Components** | Common behaviours with settings | Collectible: score 10 |
| **Triggers** / **State Machine** | Rules in plain words | ON tapped → IF coins ≥ 10 → DO spend 10 coins, open door |
| **Visual Script** | Anything bigger: loops, functions, maths | Nodes and wires |
| **Custom Script** | JavaScript when you want full control | `function update(e, dt, scene) { … }` |

They all share the same objects, tags, variables and messages, so you can mix them freely. Every Trigger piece is also a node, and every node can be used in Triggers.
