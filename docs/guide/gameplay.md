# Gameplay systems

The components on this page are complete game systems. Combine them, tune their settings, and connect them with Triggers or visual scripts. Each has a full settings table in the [Components reference](#/ref/components).

## Moving the player

| Component | For |
|---|---|
| **Move** | Top-down and free movement with the joystick, a finger drag, both, or tilting the phone. Speeds, acceleration, 4 / 8 directions, run and dash |
| **Platformer** | Run and jump with gravity: coyote time, short hops, double jump |
| **Character Controller 2D** | One component with a movement type: top-down, platformer, auto-runner, flappy, car, spaceship, tank, tap to move, follow finger, paddle, grid steps |
| **First Person**, **Third Person** | 3D: joystick to walk, drag to look |
| **Car** | Drive with the joystick (3D gets a chase camera) |
| **Swipe Move** | Endless-runner lanes and jumps |
| **Grid Move** | One tile at a time; tap a tile to walk there |
| **Draggable**, **Drag to Launch** | Pick up objects; slingshot |

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
| **Pathfinding (Navigator)** | A* around walls to a tag or object, 2D and 3D |
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

## Clicker and idle games

**Tap Target**, **Combo Clicker**, **Click Popup**, **Income** ("per second" into a variable), **Upgrade** (spend to raise a value, price grows), **Big Clicker** prefab, **Daily Reward**, **Shop**, **Quest Log**, `settings.saveProgress` and **Welcome Back** events for offline earnings.

## Voxel worlds

A **Voxel World** object is a Minecraft-style block world. **Block Builder** gives touch controls: hold to mine (stone takes longer than dirt), tap to place the hotbar block, drag to look. Survival mode collects what you mine. In code: `e.voxels.get(i, j, k)`, `set(i, j, k, block)`, `raycast(entity, origin, dir)`.

## Dialogue, quests and story

**Dialogue** (speaker names, typewriter text, tap to continue, pause the game), **Message** signs, the *Say dialogue* instruction, the **Say** node, **Quest Log**, **Tutorial** coach marks and **Camera Sequence** cutscenes.
