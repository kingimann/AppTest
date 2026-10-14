# Physics and collisions

Pocket Engine has its own physics for 2D and 3D: gravity, solid walls, bouncing, pushing, one-way platforms, triggers and raycasts. It's built to feel right on phones, and fast objects are checked in small steps so they don't pass through walls.

## Colliders and rigidbodies

Two components work together, like in Unity:

| You add | You get |
|---|---|
| A **collider** only | A solid object that never moves: walls, ground, obstacles |
| A collider + **Rigidbody** | An object that falls, gets pushed and bounces |
| A collider with **Is Trigger** | Detects touches but doesn't block anything: coins, zones, hazards |

New shapes from Create (squares, circles, cubes, spheres) come with a matching collider. Components that need a body (Move, Platformer, Collectible, Hazard…) add one by themselves when the game starts. Touch components make theirs a trigger.

### Collider shapes

| Shape | Mode | Good for | Size |
|---|---|---|---|
| Box | 2D, 3D | most things | `w, h` (and `d` in 3D) |
| Circle / Sphere | 2D / 3D | balls, coins, wheels | `r` |
| Capsule | 2D, 3D | characters (slide over bumps) | 2D `w × h`; 3D `r` + `h`, upright |
| Polygon | 2D | slopes, triangles, any outline | `points: [[x, y], …]` around the centre |
| Edge | 2D | ground lines, hills, walls | `points` (an open path) |
| Cylinder | 3D | pillars, barrels | `r` + `h`, upright |

Leave the size empty to **fit the visible shape**. Every collider also takes an **offset** (`ox, oy, oz`), **bounce**, **friction**, a **layer** and **one-way**.

Polygons with dents (a star, a cup) are split into convex pieces for you. Polygon, edge and capsule colliders turn with the object (rotation Z) and follow its scale. 2D boxes collide at their rotation too, so a spinning bar really sweeps.

**Edit Collider** (on the collider card) shows green handles in the Scene: drag edges to resize, the middle to move it off-centre, or any corner of a polygon or edge.

### Rigidbody settings

| Setting | Key | Meaning |
|---|---|---|
| Body Type | `type` | `dynamic` (moves, falls, gets pushed), `kinematic` (moves only when you move it; pushes others; platforms you can ride), `static` (never moves) |
| Mass | `mass` | Heavier bodies push lighter ones |
| Gravity Scale | `gravityScale` | 0 = floats (top-down games), 1 = normal, 2 = falls twice as fast |
| Linear Drag | `drag` | Slows it down over time (air resistance) |
| Bounciness | `bounce` | 0 = no bounce, 1 = bounces forever |
| Friction | `friction` | How much it grips surfaces |
| Material | — | Presets that set bounce and friction: Ice, Rubber, Wood, Metal, Sticky, Bouncy, Feather |
| Freeze Position | `lockX`, `lockY`, `lockZ` | Never moves along that axis |
| Start Velocity | `vx, vy, vz` | Moving when the game starts |
| Max Speed / Max Fall | `maxSpeed`, `maxFall` | Caps (0 = none) |
| One-way | `oneWay` | Jump up through it, land on top |
| Pass through tags | `ignore` | `"bullet, player"`: never collides with those (bullets that ignore their shooter) |
| Physics layer | `layer` | Its collision layer (0–7) |
| Is Trigger | `sensor` | Touches only, no blocking |

```js
{ name: 'Crate', shape: { type: 'rect', w: 40, h: 40, fill: '#a1887f' },
  collider: { shape: 'box' },
  body: { type: 'dynamic', mass: 2, bounce: 0.1, friction: 0.4 } }
```

If a level's gravity is off, the Rigidbody card shows a **Turn on gravity** button. Top-down movers (Move, top-down Character Controller) set their own gravity scale to 0.

## Gravity

Each level has gravity along Y, and optionally X and Z (*Game Settings › Physics*). In 2D, positive Y is down: about `1600` feels like a platformer. In 3D, negative Y is down: about `-25`. `scene.gravityX` / `scene.gravityZ` give sideways gravity (wind, tilted worlds), and the **Set Gravity** node changes it while playing. **Force Zones** push bodies inside an area: wind, conveyors, magnets, blasts.

## Collision layers

Every body is on one of eight **layers**: Default, Player, Enemy, Bullet, Ground, Pickup and two spare ones you can rename. *Game Settings › Collision Layers* is a grid of which layers collide. Untick a box and those two layers pass through each other, with no touch events at all.

Typical uses:

- **Bullet ↔ Bullet** off: bullets don't hit each other.
- **Enemy ↔ Enemy** off: enemies walk through each other.
- **Pickup ↔ Enemy** off: enemies don't collect coins.

The grid is shared by every level. Tilemaps count as Ground.

```js
physicsLayers: { names: ['Default', 'Player', 'Enemy', 'Bullet', 'Ground', 'Pickup', 'Water', 'Ghost'], matrix: [255, 251, 253, 255, 255, 255, 255, 255] }
```

Each matrix entry is a bit mask: bit *j* of entry *i* set means layer *i* collides with layer *j*.

## What happens each frame

1. Components' `update` hooks run (movement sets velocities).
2. Physics moves every dynamic body, in **sub-steps** when something moves fast, and resolves overlaps with solid bodies.
3. New contacts fire **collide**; ended contacts fire **separate**.
4. The body's contact flags are updated for this frame:

| Field | Meaning |
|---|---|
| `body.grounded` | Standing on something |
| `body.groundedOn` | What it's standing on (a moving platform carries it) |
| `body.wall` | Touching a wall: `-1` left, `1` right, `0` none |
| `body.ceiling` | Bumped its head |
| `body.landed` | Landed this frame, at this speed (also for quick bounces between two frames) |
| `body.vel` | Velocity `{ x, y, z }` |

## Touch events

| Where | Fires when |
|---|---|
| Components | `collide(e, other, scene)` when a contact starts, `separate(e, other, scene)` when it ends |
| Triggers | *Touched by tag*, *Stops touching tag*, *Lands on the ground* |
| Nodes | On Touch / Touch End, On Trigger Enter / Exit, While In Trigger, On Collision Enter (optionally "only harder than"), While Colliding, On Landed, On Left Ground, On Hit Wall, On Hit Ceiling |
| Code | `scene.on('collide', (a, b) => …)`, `scene.on('separate', …)`, `scene.engine.physics.touching(e, 'tag')` |

Contacts fire **once** when they start. Use *While In Trigger* / *While Colliding* (or `physics.touching`) for "every frame while touching".

> **Tip:** An object doesn't need a collider for trigger and collision events in visual scripts: one without a collider gets a trigger (or a solid body for collision events) automatically.

## Moving things

- **Set its velocity:** Velocity component, *Set Velocity* instruction / node, `e.body.vel.x = 200`.
- **Push it:** *Push* instruction, **Add Force** node (a steady force, a one-off impulse or a velocity change; mass-aware), **Explosion Force** (pushes everything nearby away).
- **Jump:** *Jump* instruction / node, Platformer, Character Controller.
- **Move it directly:** set `e.x`, *Set Position*, *Move to*, tweens. Fine for kinematic and static objects; a dynamic body moved directly may get pushed back out of walls.

Kinematic bodies are the right choice for moving platforms, doors and elevators: they move where you put them, push dynamic bodies, and carry anything standing on them.

## Raycasts and line of sight

A **raycast** shoots an invisible line and reports the first collider it hits.

- **Raycast** node: forward, up, down, left, right, *ahead & down* (ledge check), toward a tag, or a custom direction. It has *hit* / *miss* outputs, an option to only hit one tag, and *show the ray* for debugging. **Hit Info** gives the distance, point and normal.
- **Line of Sight** node and the *Can see* condition: true when nothing solid is between two objects.
- **Find In Radius**, **Count In Radius**, **Pick Nearest**.
- In code:

```js
const hit = scene.raycast({ x: e.x, y: e.y }, { x: 1, y: 0 }, 300, { ignore: e, tag: 'enemy' });
if (hit) P.log('enemy at', hit.dist, 'px', hit.entity.name, hit.point);
if (scene.canSee(e, scene.find('Player'))) { /* … */ }
```

`raycast(origin, dir, maxDist, { ignore, tag, solidOnly, any })`: `solidOnly: false` also hits triggers, `any: true` also hits objects without a body. In 3D, rays also hit voxel blocks.

## Joints and ropes

The **Joint** component links an object to another as a **spring**, **rope** (pendulums, swings) or **rod**, with a drawn rope.

## Common problems

| Problem | Fix |
|---|---|
| It falls through the floor | The floor needs a collider. Very fast objects: turn on *Continuous* collision detection. |
| It doesn't fall | Is the level's gravity 0? Is its Gravity Scale 0 (top-down movers set that)? Is the body static or kinematic? |
| Touches don't fire | Check the tag; check *Collision Layers*; triggers need one side to have a body. |
| It gets stuck on tile seams | Use a Tilemap (bodies slide smoothly along rows of solid tiles) or a capsule collider. |
| It jitters on a moving platform | Make the platform kinematic and move it with a tween, Path or Patrol. |
| Bouncy landings are missed | Use *On Landed* / *Lands on the ground*: they count landings that happen between frames. |
