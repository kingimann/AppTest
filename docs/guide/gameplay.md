# Gameplay systems

The components on this page are complete game systems. Combine them, tune their settings, and connect them with Triggers or visual scripts. Each has a full settings table in the [Components reference](#/ref/components).

## Moving the player

| Component | For |
|---|---|
| **Move** | Top-down and free movement with the joystick, a finger drag, both, or tilting the phone. Speeds, acceleration, 4 / 8 directions, run and dash |
| **Platformer** | Run and jump with gravity: short hops, air jumps, wall slide and wall jump, run, dash, dropping through platforms, ground pound |
| **Character Controller 2D** | One component with a movement type (top-down, platformer, auto-runner, flappy, car, spaceship, tank, tap to move, follow finger, paddle, grid steps, jetpack, lanes, slingshot) and a choice of controls |
| **First Person**, **Third Person** | 3D: joystick to walk, drag to look |
| **Car** | Drive with the joystick (3D gets a chase camera) |
| **Swipe Move** | Endless-runner lanes and jumps |
| **Grid Move** | One tile at a time; tap a tile to walk there |
| **Draggable**, **Drag to Launch** | Pick up objects; slingshot |

### Ways to control the player

The Character Controller's **Controls** setting picks how the player steers it. **Best for this movement** gives the usual controls (a joystick, plus a jump button for jumping).

| Controls | How it works |
|---|---|
| **Joystick** | Appears wherever your thumb touches the left side |
| **Fixed joystick** | Stays in the corner |
| **D-pad** / **◀ ▶ buttons** | Arrow buttons on screen (with Jump for jumping) |
| **Touch the sides** | Hold the left or right side to move. Jumping games: the far left runs left, near the middle runs right, the right half jumps. Top-down: the screen is a big 3 × 3 pad. Cars and ships: hold both sides to go forward |
| **Hold where it should go** | It heads to your finger. Jumping games: touch above it to jump |
| **Swipe** | A swipe sets the direction and it keeps going; a tap stops it (or jumps) |
| **Tilt** | Tilt the phone (a joystick on a computer) |
| **Keyboard only** | Arrow keys / WASD, Space to jump, nothing on screen |

Space always jumps on a keyboard. Shift runs, X or K dashes, and J or Enter is Fire.

### Keyboard and game controllers

**Game controllers** (Bluetooth or USB: Xbox, PlayStation, Switch Pro…) work on phones, tablets and computers. The left stick and D-pad steer, **A** jumps, **B** is Fire, **X** dashes and **RB** runs.

*Game Settings › Keyboard & Controller* changes the keys and buttons for Jump, Fire, Dash and Run (for example `w, pad:y` for Jump), turns controllers off, and sets the stick's dead zone. Controller buttons are named `pad:a`, `pad:b`, `pad:x`, `pad:y`, `pad:lb`, `pad:rb`, `pad:lt`, `pad:rt`, `pad:start`, `pad:select` and `pad:up` / `down` / `left` / `right`. Triggers and scripts can use those names in *Key pressed* and *Key held*, and the game hears a `gamepad` event when a controller connects.

### Platformer moves

Platformer (and the Character Controller's platformer type) has these settings:

- **Jumping:** jumps in the air (1 = double jump), a jump just after leaving a ledge (coyote time), a jump pressed just before landing (jump buffer), and a max fall speed.
- **Walls:** slide down walls slowly, and wall jump (it springs off and the air jumps come back).
- **Run & dash:** run with the joystick at the edge, the Fire button, always or Shift. Dash with the Fire button, a double tap or a swipe, with speed, length, cooldown and dashes in the air.
- **Down:** down drops through one-way platforms; ground pound slams down in the air and shakes the camera.

- **Crouch and slide:** hold down on the ground to crouch (lower and slower). Crouch while running fast to slide.
- **Jump shape:** *Fall faster* (gravity × when falling, 1.5–2 feels snappy) and *Floaty top of the jump* (gravity eases off at the top while jump is held).
- **Feel:** a separate stopping speed, and a *slippery ground tag* that makes anything with that tag slide like ice.
- **Climbing:** up or down on an object tagged `ladder` (make it a trigger) climbs it with no gravity. Jump lets go.
- **Dodge:** *Can't be hurt while dashing* makes the dash a dodge roll.

The *dash*, *wallJump*, *airJump*, *groundPound* and *slide* events fire for Triggers and scripts.

### Movement feel and looks (Character Controller)

Every movement type has a **Feel** group and a **Looks** group in the Inspector:

- **Feel:**
  - *Time to full speed* and *Time to stop* make movement heavier or icier.
  - *Directions* gives top-down movement 4 or 8 directions.
  - *Face where it moves* flips left / right or turns to face the way it moves.
  - *Speed × variable* lets a power-up like `boost = 2` double the speed.
  - *Wrap around the screen edges* works like Asteroids or Pac-Man.
- **Looks:**
  - *Squash & stretch* on jumps and landings.
  - *Lean into movement*.
  - *Bob while walking*.
  - *Dust puffs* when it lands, turns or dashes.

  These only change how it looks: the collider stays the same.

Some movement types have settings of their own:

| Type | Extra settings |
|---|---|
| Car | Grip (low drifts) and reverse speed |
| Auto-runner | Speeds up over time, top speed, jumps in the air (the `runSpeed` variable shows the speed) |
| Flappy | Tilts with its speed (on or off) |
| Tap to move | A ring that shows where you tapped |
| Follow finger | Stay above the finger, and follow sideways or up / down only |
| Jetpack | Thrust power and fuel |
| Slingshot | Bounciness |
| Grid steps | Time per step, keep walking while held, diagonal steps, tap a tile to walk there |

### More movement types

- **Jetpack:** hold to fly up (the FLY button, the right side or Space). It can have fuel that refills on the ground; the `fuel` variable shows what's left.
- **Lanes:** swipe left or right between lanes.
- **Slingshot:** pull back from it and let go to launch it the other way, with a dotted aim line. Turn gravity off for top-down golf or pool.

Nodes such as **Set Move Speed**, **Lock Movement**, **Dash** and **Is Running** change movement while playing. Slow and freeze effects, hunger and equipment speed bonuses all scale movement speed automatically.

## Collecting, winning and losing

- **Collectible:** adds to a variable (score by default) when touched by a tag.
- **Goal:** win when touched. **Hazard:** game over, lose a life, or respawn. **Checkpoint**, **Save Point**, **Teleport**, **Spring**, **Unlock** (a door that opens when a variable reaches an amount).
- **Condition:** when a variable passes a value, do an action (win when `enemyHp ≤ 0`).
- **Time limit** in Game Settings; **Timer** component and UI.
- `scene.win()`, `scene.gameOver()`; the *Win*, *Game over*, *Next level* and *Restart* instructions.

## Health and damage

**Health & Damage** gives an object hit points.

- **Basics:** max health, *hurt by tags* (e.g. `enemy, hazard`) and the damage per hit, invulnerability after a hit (with blinking), and knockback.
- **When health reaches 0:** destroy, game over, respawn, **lose a life** (respawn while `lives` > 1, then game over), send a message, or nothing.
- **Defence:**
  - **armour** (taken off every hit) and **damage reduction %**;
  - **damage types ×**: `fire 0.5, poison 0, ice 2` (0 = immune);
  - a **shield** that soaks up hits first and refills;
  - "can't be hurt";
  - **keeps hurting while touching** a hazard.
- **Healing:**
  - heal per second, after a wait;
  - **health pickups** by tag (`medkit`);
  - **fall damage** above a landing speed.
- **Look & sound:** a **bar over it** (never / when hurt / always) with the shield as a strip, **damage numbers**, hit sound, camera shake, and a death effect (burst, fade).
- **Show health:** a variable for your HUD (`hp`), or a Progress Bar with `var: 'self.hp'`.

### Status effects

| Effect | Does |
|---|---|
| `poison`, `burn`, `bleed` | Damage every half second (types poison, fire, bleed) |
| `regen` | Heals over time |
| `slow` | Movement × 0.5 |
| `freeze` | Can't move |

Give them with a Damage Dealer, an item, the *Poison / burn / slow…* instruction or a node. Cure with *Cure status effects* or an item. Something immune to a damage type can't get its effect.

### Damage Dealer

Put it on swords, bullets, spikes, lava and bombs. It sets:

- which tags it hurts and how much, and the **damage type**;
- when it hurts: on touch, or every few seconds while touching;
- a cooldown per target, and knockback;
- an effect it also gives;
- **critical hits** (chance and ×) and **area damage** (weaker at the edge);
- going through armour, destroying targets without Health, destroying itself after a hit (bullets), and points per hit.

On the player (or a child of the player), it adds the equipped weapon's damage.

```js
// From code
const hb = target.getBehavior('health');
hb.damage(5, target, attacker, { type: 'fire', crit: false, pierce: false }); // returns the damage done
hb.heal(2); hb.addShield(5); hb.addEffect('poison', 2, 4); hb.cure('any'); hb.kill();
```

## Survival: hunger and thirst

**Hunger** and **Thirst** drain over time (faster while moving). Touching food or drinks refills them. They can have different amounts by name, like `apple 15, steak 60`. When low, they send a message (`hungry`); when empty, they hurt Health, slow the player, both, or end the game. **Heals health while above %** rewards a full belly. They show in `{hunger}` / `{thirst}`, the Hunger / Thirst Bar widgets, or a bar over the player.

The **Survivor** preset is a player with Health, Hunger and Thirst. *Create → Gameplay* also has Apple, Water, Medkit, Spikes, Fire and Poison Pool.

## Inventory and crafting

### Items

*Game Settings › Items* lists every item. Each item has:

- a name and an icon (emoji or `art:` sprite);
- a **type**: material, food, drink, potion, weapon, armour, tool, ammo, key, quest item, other;
- a **rarity**, which colours its slot frame;
- a **stack size**, a value and a description;
- **what using it does**: fill hunger / thirst, heal, add a shield, cure, give an effect, send a message. Food, drinks and potions are used up; keys and materials stay.
- **equipment**: a slot (hand, offhand, head, body, legs, feet, neck, ring) and bonuses to damage, armour and speed.

**Starter items** adds 25 ready-made items.

### The inventory

- Items go in with **Inventory Item** pick-ups (touch, tap or both, random amounts, a magnet pull), **Loot / Chest**, **Resource**, crafting, the *Give / use item* instruction, nodes, or `scene.addItem('Wood', 3)`.
- *Game Settings › Inventory* sets the number of **slots** (0 = unlimited; each stack takes one) and the default stack size. When it's full, pick-ups stay on the ground and *Inventory is full* fires.
- The inventory, equipment and learned recipes carry to the next level and are kept by saves.
- Show it with **Inventory Grid** / **Backpack**, **Hotbar** (`heldItem`, keys 1–9) and **Equipment**. Tap an item, then tap it again to use or equip it.
- In text: `{inventory}` lists everything, `{item_Wood}` counts one item.

### Crafting

*Game Settings › Recipes*: what a recipe makes and how many, what it needs (`Wood 3, Stick 1`; `Hammer 1 (keep)` for tools that aren't used up), and optionally a **station**, a **time**, a category and **must be learned first**.

- **Crafting Station** (Workbench, Furnace): station recipes work while the player is close. Tapping it sends a message, e.g. to open your crafting panel.
- **Crafting** UI: recipes with green / red ingredient chips; tap one to craft.
- **Resource:** trees, rocks and bushes to gather from, with hits to break, an optional tool, extra loot and regrowth.
- **Loot / Chest:** `Coin 3-6, Apple 1 50%, Gem 1 10%` when tapped, touched, destroyed or on a message.

```js
scene.addItem('Wood', 5);            // returns how many fit
scene.useItem('Apple');              // eat / drink / equip
scene.equip('Iron Sword'); scene.unequip('hand');
scene.canCraft('Axe'); scene.craftMissing('Axe');   // e.g. ['needs Workbench', '2 Stone']
scene.craft('Axe'); scene.learnRecipe('Iron Helmet');
scene.equipStat('damage');
```

## Enemies and AI

| Component | Does |
|---|---|
| **Enemy AI** | Patrols, chases when it sees the target (walls block its view), attacks in range, gives up and goes home |
| **Chase**, **Follow**, **Wander**, **Orbit**, **Patrol**, **Path** | Simple movement |
| **Pathfinding (Navigator)** | A* around walls to a tag or object, 2D and 3D (runs as WebAssembly, so many chasers stay smooth) |
| **Turret** | Turns toward the player and fires a template |
| **Spawner**, **Wave Spawner** | Create enemies over time or in waves (`{wave}`) |
| **State Machine** | Your own states: patrol, alert, chase, attack |

AI nodes (run from *Every Frame*): Chase, Run Away From, Wander, Orbit Around, Keep Distance, Patrol Back And Forth.

## Turn-based and grid games

Turn on `settings.turnBased`. The player acts, then every component with a `turn()` hook acts (Turn Enemy, Enemy Turn, the board's computer player) after `turnDelay` seconds. Texts can show `{turn}` and `{turnText}`; `scene.endTurn()` ends the player's turn from code.

- **Grid Move:** one tile per arrow / WASD press, swipe or joystick push. Hold to keep walking, or tap a tile to walk there by the shortest path. Bump enemies to attack, push `pushable` objects. It lines up with the grid your walls sit on.
- **Turn Enemy:** walks around walls toward the player when it sees them (or waits, wanders, goes home), attacks next to them, never shares a tile, and can act every N turns. In games that aren't turn-based it acts every few seconds.
- **Turn Button** / **Enemy Turn:** RPG-style battles (attack, heal, spell, with costs).
- **Board Cell:** tic-tac-toe and connect-style boards against a friend or the computer.

### Squads: commanding many units

**Squad Unit** puts a unit on the grid that the player commands, alone or with others. This is the system for tactics games (Fire Emblem, Advance Wars) and real-time strategy (select a group, send it somewhere). Every unit has a **team**: *yours* (you command it) or *enemy* (the computer plays it).

**Selecting:**

- **Tap** a unit to add it to the group, and tap it again to take it out. With *Tapping a unit: picks just that one*, a tap selects only that unit.
- **Double-tap** a unit to select all your units.
- **Drag a box** over empty ground to select every unit inside it.
- Selected units get a ring, and their paths and destinations are shown.
- Messages: `select all`, `select none`, `select next`, `stop`, `end turn`. *Create → UI → Game Systems* has **Select All**, **Next Unit** and **End Turn** buttons and a **Squad Info** text.

**Commanding:**

- **Tap a tile** to move the whole group there. Each unit finds its own way around walls and gets its own tile, in a **formation**: group, line, column or keep their shape.
- **Tap an enemy** to attack it. Every selected unit walks into range and attacks, and enemies in range of the selection pulse red.
- **Drag from a unit** to a tile or an enemy to send it (and its group) there.
- Units wait for each other in narrow corridors, find another way when blocked, and never share a tile.

**Fighting:**

- **Health** (or the unit's own HP, with a bar), **attack damage** and **attack range**: 1 is next to it; more is ranged, with an arrow or magic bolt.
- Defeated enemies give **points**. A unit with the Health component uses it instead.

**Turn-based** (`settings.turnBased`):

- Each unit has **moves per turn** and **one attack**. A selected unit shows the tiles it can reach.
- A tap further away walks as far as its moves allow.
- Units that are done fade, and the turn ends by itself when all of them are done (or press End Turn).
- Enemy units then take their turns one after another: they walk toward your nearest unit and attack it. The enemy turn waits until they finish moving.

**Real-time:**

- Units walk as soon as you command them.
- *On its own* sets what a unit does by itself: **attacks foes in range** (the default), **chases foes it sees**, or **only does what it's told**.
- A unit that is hit fights back.
- Enemy units chase the nearest of your units within their sight.

The **Unit Commander** component (optional) sets the rules:

- the tap mode, and what dragging on the ground does: box select, move the camera, or nothing;
- the formation;
- whether to show move tiles and paths, and whether the turn ends by itself;
- **win when every enemy is gone** and **game over when all your units are gone**;
- the colours.

Variables follow along: `selectedUnits`, `unitsLeft`, `enemiesLeft` and `unitsReady` (units that can still act this turn).

| In Triggers / nodes | |
|---|---|
| Events | Your turn starts, Units selected, Unit arrives, Unit defeated (yours / enemy) |
| Conditions | Number of units (selected, yours, enemy, ready this turn), It is your turn |
| Instructions | Select units (all, none, by tag or name, next), Send units (to an object, a position, or to attack), Stop units, End turn |

Turn Enemies and the Grid Hero work alongside squads: Turn Enemies go after the nearest of your units, and the Grid Hero can bump-attack enemy units. *Create → Gameplay → Squad* has Soldier, Archer, Knight, Mage, Enemy Unit, Enemy Archer and Unit Commander, and the **Squad Tactics** (turn-based) and **Squad Battle** (real-time) templates are complete games. In 3D, set the units' tile size to 1.

```js
{ type: 'gridUnit', team: 'player', tile: 40, hp: 6, damage: 2, range: 1, moves: 4, stepTime: 0.16, fight: 'attacks foes in range' }
scene.squad.sel                 // the selected units (a Set)
entity.getBehavior('gridUnit').order(entity, { x: 220, y: 300 });  // or { attack: enemy }
```

## Clicker and idle games

**Tap Target**, **Combo Clicker**, **Click Popup**, **Income** ("per second" into a variable), **Upgrade** (spend to raise a value, price grows), **Big Clicker** prefab, **Daily Reward**, **Shop**, **Quest Log**, `settings.saveProgress` and **Welcome Back** events for offline earnings.

## Voxel worlds

A **Voxel World** object is a Minecraft-style block world. **Block Builder** gives touch controls: hold to mine (stone takes longer than dirt), tap to place the hotbar block, drag to look. Survival mode collects what you mine. In code: `e.voxels.get(i, j, k)`, `set(i, j, k, block)`, `raycast(entity, origin, dir)`.

## Dialogue, quests and story

**NPCs** talk with dialogue scripts (lines, choices, conditions, actions) and give **quests** (objectives, rewards, chains), shown by the **Quest Tracker** and **Quest Journal**. Everything about them is in [Quests and dialogue](#/guide/quests-dialogue).

Also: the simple **Dialogue** component, **Message** signs, the *Say dialogue* instruction, the **Say** node, the **Quest Log** list, **Tutorial** coach marks and **Camera Sequence** cutscenes.
