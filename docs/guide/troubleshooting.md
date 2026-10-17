# Troubleshooting and FAQ

Start with the **Console** (bottom bar, or the console button while playing). Most problems leave a warning there, like a template that doesn't exist, a node with nothing wired in or a script error. Then try *☰ → Find Problems…*.

## Something doesn't react

| Symptom | Check |
|---|---|
| Touching doesn't do anything | Does the other object have the **tag** the component looks for (`player`, `enemy`)? Are the two **collision layers** allowed to touch? Does at least one of them have a body? |
| A coin, hazard or goal doesn't work | Its *Tag* setting must match the player's tag exactly (`player`, lowercase). |
| A trigger never runs | Turn on *Write to the Console* (⚙ on the trigger). If it doesn't log, the event isn't happening. If it logs "ran its Else", a condition is false. |
| A visual script does nothing | After Play, faded nodes never ran. Is the event node wired with a **white** wire? *Check for Problems* lists unwired nodes. |
| A message isn't received | Names must match exactly, including spaces and capitals. Try `send name` in the Console's command line. |
| On Tap doesn't fire | The object needs something to tap (a shape or image with a size). Taps on objects take priority over the joystick. |
| A spawn fails | The template's **name** must match, and the template must be ticked *Template*. The Console warns "no template called…". |
| Variable text shows `{score}` | Check the spelling inside the braces. Variables are case-sensitive. |

## 3D levels don't open

- **“This browser can't show 3D”** means its 3D graphics (WebGL) are turned off or blocked (some locked-down or automated browsers, or hardware acceleration switched off). New 3D Level and switching to a 3D level stop there and you stay on your current level; nothing breaks, and 2D levels keep working. Try another browser, turn hardware acceleration on, or open the game on your phone.
- If a 3D level fails to start for another reason, the editor goes back to the level you were on (a new level that couldn't be shown is removed) and the Console says why.

## Movement and physics

| Symptom | Check |
|---|---|
| The player falls through the floor | The floor needs a collider (not just a shape). For very fast objects, turn on Continuous collision. |
| The player doesn't fall | Level gravity 0? Gravity scale 0 (top-down movers set this)? Kinematic or static body? |
| The joystick doesn't appear | *Game Settings › Touch Controls › Joystick*, or a Move component set to joystick / both (which turns it on). |
| Taps move the player instead of tapping | Fixed: fingers that land on tappable things never start the joystick. Make sure the thing has an On Tap / Button / tap trigger. |
| Things jitter on platforms | Use a kinematic platform moved by a tween, Path or Patrol. |
| Grid movement goes off-grid | Grid Move lines up with the walls' grid at the start. Place walls at the tile size apart. |

## Health, items and crafting

| Symptom | Check |
|---|---|
| The player dies instantly | The enemy uses a "life" and `lives` is 1 or unset. Give the player **Health**, or set `lives`. |
| Damage is 0 or "Blocked" | Armour and damage reduction are higher than the hit; or the damage type is resisted (`fire 0`). |
| An item does nothing when used | Is it in *Game Settings › Items*? Its type decides: keys and materials do nothing on use. Set *When used*. |
| Can't craft | The Crafting panel and `scene.craftMissing('Item')` say why: missing ingredients, the station isn't near, or the recipe is locked. |
| "Inventory full" | *Game Settings › Inventory › slots*, and each item's stack size. |

## UI

| Symptom | Check |
|---|---|
| UI is under the notch / nav bar | Keep *Ignore safe area* off; the nav bars push UI aside by default. |
| UI is the wrong size on some phones | *Screen & Safe Area › Match width ↔ height*; anchor to the nearest edge. |
| A menu shows during play | Set its *Show when* (title / paused / over / win), or use Show If on `page`. |
| A popup can't be closed | Popups close on their own message (`close`) or a tap outside; check the message name. |

## Saving and storage

| Symptom | Check |
|---|---|
| Progress resets | Turn on *saveProgress*, use save slots, or save files. Play mode in the editor uses its own saves (*☰ → Save Data…*). |
| My games disappeared on iPhone | Safari can clear website data after a week without a visit. Add the editor to the Home Screen and back up (*☰ → Back Up All Games*). |
| "Storage is full" | Imported sounds and pictures take space. Back up, then remove unused assets. |

## Performance

- Keep the number of moving physics bodies reasonable (hundreds are fine; thousands are not).
- Destroy what leaves the screen: **Destroy Offscreen**, **Lifetime**.
- Prefer **Every N Seconds** over **Every Frame** for things that don't need to run every frame.
- Use **Particle System** limits and short-lived bursts.
- In 3D, merge static scenery into models, and keep up to 8 lights.
- Build Settings › Player › graphics quality *battery saver* lowers the resolution.
- The engine lowers its resolution by itself when a phone can't keep up.
- Check the play bar's **Stats** (FPS, objects, bodies).

## FAQ

**Do players need to install anything?** No. Games run in the phone's browser. They can also be installed as web apps or built as App Store / Google Play apps.

**Does it work offline?** Yes, the editor and exported games keep working offline once opened.

**Can I use my own art and sounds?** Yes. Import pictures in the Image component, draw sprites in the 2D Sprite Editor, model in the 3D Modeler, and import sounds in *Project › Sounds*.

**Can I mix 2D and 3D?** Each level is 2D or 3D, and a game can have both. UI works in both.

**Can I write code?** Yes: Custom Script components, your own components with `registerBehavior`, or whole games in JavaScript. See [Scripting](#/guide/scripting).

**Where is my game saved?** In the browser's storage on this device. Use backups or JSON export to move it.

**How do I report a bug?** Note the steps, check the Console for an error (tap it, then **Copy**), and include the game's JSON (*☰ → Export JSON*) if you can.
