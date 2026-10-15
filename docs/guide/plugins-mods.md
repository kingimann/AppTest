# Plugins and mods

**Plugins** add to the engine for your game: new components, Triggers instructions and conditions, visual-script nodes, and code that runs when a level starts or every frame. They are JavaScript, saved with the game, and work in the editor and in every build.

**Mods** are for your players. When you allow them, players add mod files to the finished game from a **Mods** screen: new levels, changed objects, different rules.

Both live in *Game Settings › Plugins & Mods*.

## Plugins

### Adding one

- **New plugin** makes one from a starter that shows every kind of addition, and opens its code.
- **From a file** adds a `.js` file (or a `.json` with `name` and `code`). Comment tags at the top fill in its details: `// @name Confetti`, `// @version 1.2`, `// @author Ana`, `// @description …`.
- **From a link** loads a plugin from a web address.
- **From My Plugins** adds one you saved from another game (**To My Plugins** on a plugin card).

Each plugin card shows what the plugin adds (components, instructions, conditions, nodes, hooks), or its error. It has buttons to turn it **On** or off, edit its **Code**, **Export** it as a `.js` file, save it **To My Plugins**, or remove it. Changes show at once. Removing something a plugin already added takes a reload of the editor.

> Plugins run code. Only add plugins you trust.

### Writing one

A plugin is the body of a function that gets `api` (and `P`, the [Pocket toolbox](#/guide/scripting)):

```js
// An instruction for Triggers (also a node in Instructions › Plugins)
api.addInstruction('confetti', {
  label: 'Confetti burst',
  params: [api.text('color', '#ffd23f', 'colour'), api.number('count', 40, 'how many')],
  run(c, p) { c.s.burst(c.e.x, c.e.y, 0, p.color, +p.count); }, // c.s = the scene, c.e = the object
});

// A condition
api.addCondition('isWeekend', { label: 'It is the weekend', test: () => [0, 6].includes(new Date().getDay()) });

// A value node (type: number, text or bool) and an action node; run returns the output to follow
api.addNode('triple', { label: 'Triple', cat: 'Math', value: (ctx) => ctx.input('x') * 3, inputs: [api.input('x', 1)] });
api.addNode('coinFlip', { label: 'Coin Flip', outs: ['heads', 'tails'], run: () => (Math.random() < 0.5 ? 'heads' : 'tails') });

// A component (Add Component › Plugins), the same as registerBehavior
api.registerBehavior('spinForever', {
  label: 'Spin Forever', params: [{ key: 'speed', label: 'Speed (degrees per second)', type: 'number', default: 90 }],
  create(p) { return { update(e, dt, s) { if (!s.engine.editing) e.rz = (e.rz || 0) + p.speed * dt; } }; },
});

// Hooks
api.on('sceneStart', (scene, engine) => api.log('Level started'));
api.on('update', (scene, dt, engine) => { /* every frame while playing */ });
```

| api | What it does |
|---|---|
| `addInstruction(key, { label, params, run(c, p) })` | A Triggers instruction and a node. |
| `addCondition(key, { label, params, test(c, p) })` | A Triggers condition and a yes/no node. |
| `addNode(key, { label, cat, params, inputs, outs, run(ctx) })` | An action node. `run` returns the output to follow, or a promise of it. |
| `addNode(key, { label, cat, type, inputs, value(ctx) })` | A value node. In `ctx`: `s`, `e`, `param(k)`, `input(k)`. |
| `registerBehavior(type, def)` | A component ([Writing your own components](#/guide/custom-components)). |
| `on('sceneStart' \| 'update', fn)` | Code when a level starts, or every frame. |
| `text`, `number`, `choice`, `input` | Settings and inputs for the above. |
| `log`, `warn` | Messages in the Console. |

Plugin nodes are in the node editor's **Plugins** folder.

## Mods

### Letting players add mods

Turn on **Players can add mods**:

- **Mods button in the pause menu and Settings** (on by default). Or open the screen yourself with a Button (*Do → open mods*) or the *Open the Mods screen* instruction.
- **Mods may contain code** (off by default). Off, mods can only change data, which is safe. On, a mod's `code` runs like a plugin, so players should only add mods they trust.

On the **Mods** screen, players **Add a mod file…**, turn mods on or off, remove them, and **Restart with mods**. Mods are kept on their device.

In your game:

- `{modsActive}` is how many mods are on.
- The condition *Mod is on* (with a name, or any) lets the game react to them.

### Making mods

**Make a mod template** downloads a starting file with this game's levels, templates, objects and variables. A mod is JSON:

```json
{
  "pocketMod": 1, "name": "Red Coins", "version": "1.0", "author": "Bo", "description": "Coins are red and worth more",
  "game": "Jump Quest",
  "patch": {
    "vars": { "lives": 5 },
    "settings": { "gravity": 1200 },
    "change": [{ "name": "Coin", "set": { "shape.fill": "#ff3355", "behaviors.0.points": 50 } }],
    "add": [{ "level": 1, "name": "Gem", "x": 200, "y": 300, "shape": { "type": "circle", "r": 12, "fill": "#7af" } }],
    "remove": ["Spikes"],
    "levels": [{ "levelName": "Bonus", "entities": [] }],
    "items": [], "recipes": [], "quests": [], "collections": [], "sounds": {}
  }
}
```

- **change** finds objects by `name` (or `tag`) on every level, or on one `level` (a number or level name). `set` takes paths into the [game file](#/guide/objects).
- **add** puts objects in the game file format on a level. `"template": true` makes templates that others spawn.
- **remove** takes names, or `{ "name", "level" }`.
- **levels** are added at the end.
- **items**, **recipes**, **quests** and **collections** replace one with the same name, or add it.
- A mod can't change the game's online settings (Supabase, PlayFab, Photon) or the mods settings.
- With code allowed, `"code"` is plugin code.

**Test a mod in Play** loads a mod file into the next Play in the editor, even with mods turned off. **Stop testing** ends it.
