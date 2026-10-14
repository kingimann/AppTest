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

**Finding your way around (phones):**
- **Bottom bar:** works like an app's navigation bar: **Scene · Hierarchy · Inspector · Scripts · Project · Console**.
  - **Scene** gives the Scene view the whole screen.
  - The other tabs open full size, so nothing is cramped. Drag the handle to make them half height (remembered), or tap the open tab again to go back to the Scene.
  - Pressing Play always shows the game, and Stop brings your panel back.
- **+ Add opens the Create screen:** a full-screen place for everything you can add.
  - A search box and **Quick add** (player, platform, coin, enemy, goal, score).
  - Big folders: Gameplay, Characters & Sprites, Shapes & Objects, 3D Models, UI & Menus, Logic & Scripts, Camera & Lights, My Prefabs.
  - The Hierarchy's **Create** button and the Project tab open it too.

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
   | Online Coin Rush | Online Coin Rush | Multiplayer coin race (Photon) with an online leaderboard (PlayFab); plays solo until you add your IDs |
   | Voxel Sandbox | Block Craft | Minecraft-style terrain: hold to mine, tap to place, hotbar, auto-jump |
   | Turn-Based RPG | Slime Battle | attack/heal/spell buttons, enemy turns, HP & MP |
   | Dungeon Crawler | Tiny Dungeon | turn-based grid movement, bump combat, goblins |
   | Board Game | Tic-Tac-Toe | tap cells, play the computer |
   | Tap Arcade | Tap Frenzy | tap targets against the clock |
   | Blank 2D / 3D | | start from nothing |

2. **Scene** fills the screen. Tap an object to select it; drag to move it. The tool rail on the left has Hand, Move, Rotate, Scale and **Paint** (stamp copies by tapping or dragging). Pinch to zoom; drag empty space to pan (2D) or orbit (3D).
3. **Blue + button**: add things. Tap a tile to add it, or press, hold and drag it to the exact spot.
4. **Bottom sheet**: **Hierarchy** (all objects; the top row opens game settings), **Inspector** (the selected object's components; −/+ buttons nudge numbers, ⋮ copies or removes a component, **Add Component** adds more) and **Project** (prefabs, objects, components). It starts small so the Scene gets the screen.
   - The tabs (Scene, Hierarchy, Inspector, Scripts, Project, Console) always sit at the bottom edge, where your thumb is, and the panel opens above them. The open tab has a bar over it.
   - Tap a tab to open it, or tap the open tab again (or **Scene**) to put the panel away. Swiping up or down on the tabs opens or closes it too.
   - Drag the handle, or drag a list down from its top, and the panel follows your finger. Let go low to close it, or halfway to make it half height.
   - A blue dot on **Inspector** means something is selected: one tap edits it.
   - Held sideways, the panels move to the right.
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

**Build Settings** (*☰ → Build Settings…*, or **Build…** at the bottom of Scene Settings) decide what that file becomes:
- **App:** name, version, author, description and file name.
- **Icon:** your own picture, or an emoji on a colour. It shows on the Home Screen, in the browser tab and on the loading screen.
- **Loading screen designer**, with a live phone preview and a full-screen **Preview**:
  - **Presets:** Classic, Minimal, Neon, Retro, Candy, Cinematic, Storybook and Arcade, set in one tap.
  - **Background:** a colour, a second colour blended in (top to bottom, across, diagonal or a glow from the middle), and your own picture (fill, whole or tiled, with darkening).
  - **Logo and name:** the app icon, another picture or none; size, shape (rounded, circle, square, as it is) and animation (pulse, bounce, float, spin, glow); the name's font (including the game's Google Fonts), colour and size.
  - **Loading bar:** thin line, rounded, thick with %, striped (moving), retro blocks, glowing, ring, bouncing dots, spinner or none. Set its colours (with a blend), the empty part, width, position and a label with `{percent}`. The bar follows the real loading: unpacking the engine and game, then the game's pictures and fonts.
  - **Text and tips:** extra text, rotating tips (separate with `|`) and an optional "Made with Pocket Engine" line.
  - **Finish:** minimum time, **Tap to Start** with your own text (so music can play straight away), and how it leaves (fade, slide up, zoom, circle wipe or cut).
- **Levels:** untick unfinished levels to leave them out, and pick the level to start at (handy for testing).
- **Player:** graphics quality (battery saver, balanced, sharpest), the back gesture, and blocking long-press menus.
- **Web app:** how the game behaves once it is on the Home Screen or in a browser.
  - **Can be added to the Home Screen**, with a short **Home Screen name**.
  - **Opens:** full screen, like an app (keeps the status bar), with small browser buttons, or in the browser.
  - **Suggest installing:** never, shortly after it starts, or after a game ends. A small bar shows an **Install** button where the browser offers one (Android / Chrome) or the steps on iPhone ("Tap Share, then Add to Home Screen"). It never shows once installed, the player can close it, and the message is yours to write.
  - **Screen:** orientation (same as the game, portrait, landscape, either), **browser bar colour** and the **iPhone status bar** (see-through, black, white).
  - **Behaviour:** **pause when switching apps**, **keep the screen on while playing**, and **ask before leaving mid-game**.
  - **Sharing:** a **link preview** (title and description for messages and social posts) and the **language code**.
  - **Extra code in `<head>`** (advanced): analytics, fonts or meta tags, pasted into every build as-is.
- **App stores (iOS & Android):** publish with **Codemagic** ([codemagic.io](https://codemagic.io)), a cloud build service. You don't need a Mac or Android Studio.
  - Set the **App ID** (like `com.yourname.game`; it's checked as you type) and tick iOS, Android or both.
  - **iOS:** send to TestFlight, to TestFlight and then App Store review, or just build the .ipa; iPhone only or iPhone + iPad; the name of your App Store Connect key in Codemagic.
  - **Android:** publish to internal / closed / open testing or production, or just build the .aab; *First release* (Google only accepts drafts until the first review); the keystore and Google Play key names in Codemagic.
  - Also: full screen, a number to add to build numbers, and an email when a build finishes.
  - **Download app project (.zip)** makes a [Capacitor](https://capacitorjs.com) project:
    - `www/index.html`: the game, without the Home Screen prompts.
    - `capacitor.config.json` and the icon / splash images in `assets/`.
    - `codemagic.yaml` with an iOS and / or Android workflow.
    - `@capacitor/local-notifications`, so Phone Notifications work in the app.
    - `scripts/prepare-native.mjs`: sets the version, build number, release signing, orientation and full screen in the native projects that Codemagic generates on each build.
    - A `README.md` with the one-time setup: Apple / Google accounts, App Store Connect key, certificates, keystore, Play service account, and the first manual Play upload.
  - Put the folder on GitHub, add it in Codemagic, and start a workflow. Build numbers go up by themselves; raise **Version** for a store update.
- **File size:** **Compress** makes the file about 3× smaller (needs iOS 16.4+ or a 2023 browser). A report shows the total size, the engine, the game data, pictures, sounds and the biggest files.
- **Testing:** a frame-rate counter and errors on screen, for trying the build on another phone.
- **Build** downloads it, **Share** sends it with the phone's share sheet, and **Test** opens the build in a new tab.

### Editor Preferences (☰ → Preferences…)

Settings for you on this device (games keep their own settings):

| Group | Settings |
|---|---|
| Look | theme (Dark, Black, Slate, Warm), accent colour, panel text size, reduce motion |
| Editing | snap on / off, snap step for 2D (1–50 px) and 3D (0.1–1), rotation snap (5°–90°), grid, all colliders, vibration on taps |
| Saving | save straight away, after a few seconds, every 10 seconds, or only on Save / leaving; how often restore points are taken (1–10 min) and how many are kept (6–40); back up and restore |
| App | open on the Home screen or straight into the last game, keep the screen on while editing, version and **Check for updates**, **Install app**, storage used and **Protect my games** (asks the browser not to clear them) |

**Reset preferences** puts them back.

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

- **Home** and **New Game** split game types into **2D games** and **3D games** (with Blank first), and **My games** has All / 2D / 3D tabs with a 2D/3D badge on each.
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
  - **Add Component** opens with suggestions for the selected object (e.g. Rigidbody, Health, Triggers for a player that lacks them), your recently used components, and category folders with counts (Physics, Controllers, Combat, AI, Logic…). Tap a folder to browse it, or search everything at once.
  - Components have a coloured edge by category.

### Node coding (Visual Script)

Add **Visual Script** from *Add Component → Logic*, from *Create → Visual Script*, or from the Getting started list, then tap **Open Node Editor**.

The **Scripts** tab (between Inspector and Project) lists every Visual Script in the game:
- Each card shows the object, a mini map of its nodes, which events start it and how many nodes it has.
- Tap a card to open it in the Node Editor. Scripts on other levels are listed under their level; opening one switches to that level.
- ⋮ shows the object in the Inspector, saves the script for reuse (or unlinks it), turns it off or on, or removes it.
- **New Visual Script** adds one to the selected object. With more than a few scripts, search by object, event or node name.
- **Saved scripts** lists your reusable scripts with how often each is used; **Add** puts one on the selected object.

The editor fills the screen:

- **Add Node** opens like Add Component: a search box, **Suggested next** (nodes that usually follow the selected one, or events to start with), **Recently used**, and a folder per category with how many nodes it holds. Tap a folder to open it, ‹ to go back:
  - **Events** (green): On Start, On Tap, On Touch / Touch End, Every N Seconds, Every Frame, On Button, On Swipe, On Destroyed, On Message, **On Variable Changed**, **On Damaged**, **On Death**, **While Touching Screen**, **On Finger Lifted**, **On Win**, **On Game Over**, **On State Entered**.
  - **Math, more:** **Formula** (type any math with up to four inputs a–d and game variables: `a * 2 + b`, `sqrt(a^2 + b^2)`, `score / 10`, `max(a, lives)`; + − × ÷ % ^, comparisons, and sin cos tan asin acos atan atan2 abs floor ceil round sqrt pow min max clamp lerp sign log exp mod random; no code is run, a typo just gives 0 and a Console warning), **Random Between** (with inputs, whole numbers or not), **Random Pick**, **Smooth Noise** (drifting random for wobbles and flicker), **Inverse Lerp**, **Move Towards Value**, **Angle Difference**, **Wrap Around**, **Round To Decimals**, **Percent Of**, **Ease Curve** (any easing), **Vector Length**, **Distance / Angle between points**, **Min / Max / Average / Sum**, **Is Between**, **Is Even**; **Math (one value)** adds tan, square, cube root, reciprocal, fraction, log and exp.
  - **Game, more:** **Add Score** (with a "+10" pop-up), **Lose a Life** (*no lives left* → game over if you like), **Gain a Life** (up to a maximum), **Check Best Score** (*new best* saves it), **Add / Set Time**, **Restart Level**, **Set Checkpoint** + **Respawn Player**, **Use Item** (*used* / *not enough*) and **Has Item**, **Add Combo** (`{combo}` resets after a pause), **Unlock Achievement** (once per device, with a 🏆 message; *first time* / *already*) and **Is Unlocked**, **Hit Stop** (a freeze-frame on big hits), **Set Game Speed**, **Say** (a dialogue box with a *closed* output), **Game Value** (score, lives, best, time left, combo, level, levels) and **Game State Is**.
  - **Variables** (gold): **Set / Add To My Variable** and **My Variable** (each object keeps its own, so every enemy has its own hp; text on the object shows it with `{hp}`), **Set Other's Variable / Other's Variable**, **Variable Of Object**, and **When Variable Reaches** (runs once when, say, score ≥ 100).
  - **Variables, more:** **Change Variable** (set, add, subtract, multiply, divide, min, max, power or mod; for the game, this object, or *other*), **Clamp Variable**, **Copy Variable**, **Toggle My Variable**, **Reset Variables** (back to their starting values), **Set Text Variable** (words, with `{braces}`) and **Text Variable Is** (equals / contains / starts with / empty), **Save / Load / Forget Variable** on the device (coins, settings, unlocked levels; *loaded* / *not saved yet*), and per-object events **On My Variable Changed** and **When My Variable Reaches** (hp ≤ 0 → die).
  - **Lists** (brown): lists of numbers kept in a variable and shown in text as `1, 2, 3`. **Add** (end or start), **Remove** (last, first, a position or a value; *nothing removed*), **Set At**, **Clear**, **Shuffle / Sort / Reverse**, **Fill With Numbers** (1–10 → a deck), **For Each** (with **Loop Item**); values **Item At**, **Length**, **Contains**, **Position Of**, **Random Item**, **Sum / Min / Max / Average**. Positions start at 1.
  - **Functions, more:** **Function** (a named piece of script) with **Function Input** (a, b, c) and **Return Value**, used through **Call Function** (as a number, e.g. inside a Formula) or **Run Function** (as a step, optionally storing the result); functions can call each other and themselves (20 deep). **Call Event Later** runs a Custom Event after a delay; **Caller Has Tag** checks who called a Custom Event.
  - **Functions** (indigo): **Custom Event** + **Call Custom Event** (on this object, *other*, everything with a tag, or everywhere, with a number read by **Event Value**), and **Comment** sticky notes.
  - **More flow:** **For Range** (from → to by step), **Repeat Every** (every N seconds, N times or forever, with **Stop Repeat**), **Cycle** (1, 2, 3, 1…), **Weighted Random**, **Gate** + **Open / Close Gate**, **Wait Frames**. **Touch:** **On Long Press**, **On Double Tap** (on this object). **Objects:** **Attach To** / **Detach** (carry things, ride platforms), **Spawn & Launch** (facing, up, down, toward the finger, toward a tag, random). **Move:** **Move To Finger**, **Look At Finger**. **Game:** **Pause / Resume**. **Values / Math:** **Direction To**, **Distance Between**, **Snap To Step**, **Ping Pong**, **Sign**, **Smooth**, **Chance %**, **Fingers On Screen**, **Is Paused**, **Child Count**; **Position Of** also gives rotation, scale and opacity.
  - **Physics** (rust): **On Trigger Enter / Exit**, **While In Trigger**, **On Collision Enter** (with an optional *only harder than* speed) / **Exit**, **While Colliding**, **On Landed**, **On Left Ground**; **Add Force** (steady force, one-off impulse or velocity change; mass-aware), **Explosion Force** (blasts nearby physics objects away, stronger close up), **Set Body Type**, **Make Trigger / Solid**, **Set Collision Layer**, **Set Bounce & Friction** (and mass); values **Impact Speed**, **Is In Trigger**, **Is Colliding**. Trigger and collision events work on any object: one without a collider gets a trigger (or a solid body for collision events).
  - **Sensing** (blue): **Raycast** (forward, up, down, left, right, *ahead & down* for ledges, toward a tag, or a custom direction; only a tag, or also triggers; it hits voxel blocks in 3D; *show the ray* draws it, green on a hit) with **hit** / **miss** outputs, **Ray Hits** (the same as a true/false value), **Hit Info** (distance, hit point, surface normal; also filled by On Collision Enter), **Find In Radius** (runs *each* for every match, then *found* with the nearest), **Count In Radius**, **For Each With Tag**, **Pick Nearest**, **Pick Object**, **Line of Sight** (*visible* / *blocked*), **On Object Near** (*near* / *left*), **On Enter Screen**, **On Leave Screen**, and the values **Is On Screen**, **Other Object** (x, y, z, speed, distance, angle, health), **Other Has Tag**, **Has Other Object**.
  - **“Other”:** whatever a trigger, collision, raycast or search found becomes *other*, so the nodes with a *who: other* choice (Destroy, Damage, Push, Add Force, Set Colour, Punch, Stop Moving…) act on it.
  - **Tween** (teal): Tween, Punch, Stop Tweens (by object or ID, optionally jumping to the end), **Tween Move To** (to / by / from), **Tween To Object**, **Jump Tween**, **Shake**, **Spin**, **Pulse**, **Tween Colour**, **Tween Variable** (smooth score counters), **Type Text**, **Spiral**, **Turn To Face**, **Pause / Resume**, **Play Backwards / Flip / Restart**, **Tween Speed**, **Play Tween Component**, **Delayed Call**, and the value **Is Tweening**. Most have a **finished** output for what happens when they end.
  - **Animation** (pink): **Play Animation** (loop / once / the clip's setting), Stop Animation, **Set Animation Speed**, **Show Sprite Frame**, **Flip Sprite**, **Fade To**, **Blink**, **On Animation End**, and the values **Is Animation Playing** and **Sprite Frame**. They work with both the Animator and the Sprite Sheet Animator.
  - **Flow** (purple): If, Wait, Random Chance, Do Once, Sequence, **Repeat N Times** (with Loop Index), **Flip Flop**, **Cooldown**, **Count To**, **Random Branch**, **Switch on Number**, **Compare Branch**.
  - **Actions** (blue): variables, messages, Debug Log, sounds, spawn, destroy, velocity, jump, show/hide, camera, lights, tweens, animation, saving, win / game over.
  - **Move**: **Set Position**, **Move Toward** (a tag), **Look At**, **Rotate By**, **Set Scale**, **Teleport To**. **Looks**: **Set Text**, **Set Colour**, **Particle Burst**, **Set Background**, **Set Opacity**. More moves: **Stop Moving**, **Set Gravity Scale**; **Toggle Variable** flips a variable between 0 and 1. Also **Pop Text** (“+10”), **Flash Screen**, **Set Variable to Random**, **Go To Level**, **Turn Component On / Off**, **Wait Until** (a condition), **Random Wait**, and the values **Choose (if)**, **Wave**, **Remap**, **Position Of**, **Frame Time**; Math also does **mod** and **power**. **Objects**: **Spawn At**, **Destroy All With Tag**, **Add / Remove Tag**. **Game**: **Slow Motion**, **Damage**, **Heal**, **Give Item**.
  - **Values** (orange): numbers, variables, random, compare, and/or/not, position, distance, velocity, touching, can see, **Angle To**, **Count With Tag**, **Object Exists**, **My Health**, **Item Count**, **Joystick**, **Screen Size**, **Is Moving**, **Finger On Screen**, **Finger Position**, **Coin Flip**, **Level Number**. **Math**: math, **Math (one value)** (abs, round, sqrt, sin…), **Clamp**, **Lerp**, **Loop Index**.
  - **Text** (green, with green dots that carry words): **Join Text**, **Fill In Text** (`{variables}` plus inputs a and b), **Number As Text** (normal, 1.2K, whole, 2 decimals, 1:05, percent, plain, **1st**, **XII**, **+5**), **Text Length**, **Change Case** (UPPER, lower, Title Case, reversed, tidy spaces), **Replace In Text**, **Part Of Text**, **Text Check** (equals, contains, starts / ends with, empty), **Text To Number**, **Get Text Variable**, **Set Text Variable To**, **Show Text On Object**, **Random Word** and **Word At** (words separated with `|`).
  - **Time** (blue): **Start Timer** (count down or stopwatch; the timer's name is also a variable, so text shows `{timer}`), **Pause / Resume / Stop Timer** (or add seconds), **Timer Value**, **On Timer Finished**, **Real Clock** (hour, minute, weekday, date, year…), **Daily Check** (*new day* / *same day*, with a streak of days in a row), **Remember Time Now** and **Seconds Since Remembered** (refill energy while the player was away).
  - **Input** (magenta): **On Key** (pressed, released or held: Space, arrows, letters, Enter…), **Key Is Held**, **Arrow Keys / WASD** (−1, 0, 1), **Phone Tilt**, **Calibrate Tilt**, **On Phone Shaken**, **On Screen Touched** (anywhere or one half), **Finger Drag** and **Pinch Zoom**.
  - **Camera**: **Move Camera To** (a point), **Move Camera To Object**, **Zoom Camera To** (all glide smoothly, with *arrived*), **Camera Value**.
  - **Audio**: **Play Music** (an imported sound, looped), **Stop Music** (with a fade), **Set Volume**, **Mute / Unmute**, **Play Note** (60 = middle C), **Is Muted**.
  - **AI** (orange, run from Every Frame): **Chase** (*caught*), **Run Away From** (*safe*), **Wander**, **Orbit Around**, **Keep Distance**, **Patrol Back And Forth** (*turned*). Speeds and distances pick sensible 2D / 3D defaults when left at 0.
  - **UI** (pink):
    - **Events and screens:** **On UI Tapped** (any named element, from any script), **Show / Hide UI** (fade, pop, zoom or slide, with *done*), **Open / Close Popup** (Popup or Side Bar components), **Close Top Popup**.
    - **Messages and questions:** **Show Toast** (slides in and out), **Show Alert** (*closed*), **Ask Yes / No** (*yes* / *no*). These use the game's UI theme and can pause the game. **Ask For Text** opens a text box with the keyboard and stores the answer, e.g. a player name.
    - **Changing elements:** **Enable / Disable UI** (greyed out and not tappable), **Set Image**, **Set Badge** (a red number bubble), **Set Progress Bar** (variable, maximum, colour), **Set UI Theme**, **Bring To Front / Back**, **Set UI Size**, **Scroll To** (top, bottom or part of the way).
    - **Values:** **Is A Popup Open**, **Is Shown**, **Is Enabled**, **Safe Area**.
  - **Device**: **Share**, **Copy To Clipboard**, **Open Website**, **Device Is** (portrait, landscape, touch screen, online, installed app, dark mode, reduced motion).
- ★ Templates include Chase the player, Tap 5 times → win, Spawn a ring of 8, Hit → blink + hurt animation, Run / idle by speed, Collect: hop, fade, remove, and Tap → score counts up.
- **Reusable scripts.** The 💾 button (or *Save as Reusable Script* on the component) names and saves the graph. Add it to any other object from **Add Component → My Scripts**. Copies stay **linked**: edit any of them and every copy updates (the component shows the script's name and how many objects use it; ⋮ → *Unlink* to change one copy on its own, or *Rename*). Saved scripts are also kept on your device, so **My Scripts** and ★ list the ones from your other games too.
- **Live debug:** after you Play, each node shows how often it ran (**×12**) and value nodes show their last value (**= 3.5**); nodes that never ran are faded, so you can see at a glance which part of a script didn't happen.
- **Copy / paste:** ⋮ → *Copy* (one node) or *Copy From Here* (the node, everything it leads to and the values feeding them); paste from the top of **Add Node**, in this script, another object's, or another game. Pasted nodes go below the others.
- **Turn Off** (⋮): skip a node without deleting it (the script passes straight through), handy for testing. **Comment** nodes are yellow sticky notes.
- More ★ templates: *Enemy with its own HP (3 hits)*, *Custom event: explode on call*, *Wave: 5 enemies, one every 0.8 s*, *Daily reward with streak*, *Countdown: 30 seconds to win*, *Enemy AI: wander, chase when near*, *Keyboard: arrows move, Space jumps*, *Name tag: “Hero the 3rd”*, *UI: ask the player's name*, *UI: Restart button asks first*, *UI: menu button opens a panel* and *UI: shop badge counts new items*.
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

### Tags and layers

Every object has **Tags**, a **Layer** and (in 2D and UI) a **draw layer**, at the top of the Inspector:
- **Tags:** chips you add from a game-wide list (+ → pick, or **New Tag…**) and remove with ×. An object can have several. Triggers, hazards, cameras, colliders' *Pass through tags* and scripts use them.
- **Layer:** one of eight named layers (Default, Player, Enemy, Bullet, Ground, Pickup…). It is the object's collision layer, and its collider follows it (the Rigidbody shows the same setting).
- **Draw:** Background, Default, Foreground or Top, plus an **Order** within it (higher is in front).
- **Tags & Layers…** (☰ menu, Scene Settings › Collision Layers, or the bottom of a tag or layer menu):
  - Add tags, or rename or delete a tag on every object at once.
  - Rename layers, and see how many objects use each one.
- **Hierarchy:** the filter can show only objects **with a tag** or **on a layer**.
- **Visual Script:** **Set Layer**, **Layer Is**, **Count In Layer** and **For Each In Layer**. In scripts: `scene.setLayer(e, 'Enemy')`, `scene.findInLayer('Enemy')`, `scene.layerNames`.

### Collision layers

- Each **Rigidbody** has a **Physics layer**: Default, Player, Enemy, Bullet, Ground, Pickup, or two spare layers you can rename.
- Tap the level → **Collision Layers**: a grid of which layers collide. Untick a box and those two layers pass through each other with no touch events (e.g. enemies' bullets ignore other enemies). Tilemaps count as Ground. The grid is shared by every level.

```js
{ physicsLayers: { names: [...], matrix: [255, 251, 253, 255, 255, 255, 255, 255] } } // on the project; body: { layer: 1 }
```

### Colliders and Rigidbody (Unity-style)

- **2D games:** Box, Circle, Capsule, Polygon and Edge Collider 2D. **3D games:** Box, Sphere, Capsule and Cylinder Collider. Find them in *Add Component → Colliders* (an object without one gets a collider suggested first).
- **See them like Unity:** every collider is outlined in green in the Scene view (2D outlines, 3D wireframes; triggers are dashed / lighter). Turn it off with *2D/3D menu → Show All Colliders* or the checkbox on a collider; the selected object's collider always shows.

- **Colliders** are their own components. New Squares, Circles, Cubes, Spheres… come with one, like Unity's primitives.
  - A collider on its own makes a solid object that never moves (walls, ground, obstacles). Add a **Rigidbody** to make it fall and get pushed.
  - **Is Trigger** detects touches without blocking. Coins, hazards and other "touch" components turn a plain collider into a trigger for you.
  - **Size** / **Radius**, **Offset**, **Set Size / Fit to Shape**, **Shape** (switch to any other collider type), **Material** (bounce, friction), and **Edit Collider** handles in the 2D Scene.
  - **Collider shapes:**

    | Shape | Mode | Good for | Settings |
    |---|---|---|---|
    | Box | 2D, 3D | most things | Size |
    | Circle / Sphere | 2D / 3D | balls, coins, wheels | Radius |
    | Capsule | 2D, 3D | characters (they slide over bumps) | 2D: width × height (rounded along its long side); 3D: radius + height, upright |
    | Polygon | 2D | triangles, slopes, stars, any outline | Points |
    | Edge | 2D | ground lines, hills, slopes, walls | Points (an open path with no inside) |
    | Cylinder | 3D | pillars, barrels, towers | radius + height, upright |
  - **Points** (Polygon and Edge): edit each corner's X/Y, **+ Point** adds a corner, − removes one. **Presets**:
    - Polygon: Box, Triangle, Slope ◢ / ◣, Diamond, Pentagon, Hexagon, Octagon, Star, Ramp, and **Match the drawn shape** (triangles, diamonds, stars, polygons, arrows…).
    - Edge: Flat line, Slope up / down, Hill, Valley, Bowl, Zigzag, Steps, Wave.
    - Both: flip left ↔ right, flip upside down, bigger, smaller.
  - Polygons with dents (like a star or a cup) are split into convex pieces automatically. Polygon, Edge and Capsule colliders turn with the object (Rotation Z) and follow its scale.
  - 3D capsules and cylinders draw as green wireframes in the Scene.
- **Rigidbody 2D / Rigidbody**: Body Type (Dynamic / Kinematic / Static), Mass, Gravity Scale, Linear Drag, Bounciness, Friction, Material, Freeze Position, Start Velocity, Max Speed, Max Fall Speed, Collision Detection (Continuous for fast objects), Physics layer and pass-through tags.
- New blank 2D games have gravity on (like Unity). If a level's gravity is off, a Rigidbody shows a **Turn on gravity** button. Top-down movers set their own Gravity Scale to 0.

### Camera and lights in the scene

- New games start, like a Unity scene, with a **Main Camera** object (follows the player, or stays put if there isn't one) and a light object: **Directional Light** in 3D (its rotation aims the sun and the shadows; colour, intensity, ambient, shadows) or **Global Light 2D** (how bright the level is; Point Lights shine through the dark).
- Create → **Camera & lights** adds more: Camera, Directional Light / Global Light 2D, Point Light. While a light object exists, the level's Lighting settings defer to it.

### Move: joystick, tilt and drag

The **Move** component steers with the joystick, a finger drag, both, or tilting the phone.

**Movement** (Move › Movement):
- **Time to full speed** / **Time to stop** (seconds): 0 = instant. Bigger values feel heavier or slide like ice. The older *Smooth start / stop* still works when these are 0.
- **Directions**: any, 8 or 4 (no diagonals), for this object whatever the joystick allows.
- **Speed × variable**: multiplies the speed by a variable (e.g. `speedBoost` for power-ups).
- **Face where it moves (2D)**: flip left/right or turn to face it. **Turn speed** (°/s) also limits how fast 3D objects turn.
- **Up on the stick moves (3D)**: up the screen, or away from the camera (for orbiting / third-person cameras).

**Run & dash** (Move › Run & dash):
- **Run with**: pushing the joystick to the edge, holding the Fire or Jump button, or always. Shift runs on a keyboard. **Run speed ×** sets how much faster.
- **Dash with**: the Fire button, the Jump button, a double tap or a swipe (dashes that way); Space on a keyboard.
  - Settings: **Dash speed**, **Dash length**, **Cooldown** and a dash effect.
  - A dash ignores gravity while it lasts.
- A button picked for run or dash is switched on and labelled RUN / DASH.

**Nodes** (Move category): **Set Move Speed** (set to / multiply by), **Lock Movement** (lock / unlock / toggle, e.g. during dialogue), **Dash** (outputs *dashed* or *not ready*), **On Dash**, **Is Running**.


**Joystick** (Game Settings › Touch Controls › Joystick):

| Setting | Choices |
|---|---|
| Where it appears | where you touch and follows your thumb · where you touch and stays put · fixed in the corner |
| Side, Touch area | left / right · half, a third or the whole screen |
| Directions | any · 8 · 4 · left/right only · up/down only (snapped, with little arrows on the stick) |
| Response | push further = faster · gentle near the middle · always full speed |
| Dead zone | how far you push before it moves (default 0.12); past it, speed still starts from zero |
| Look | size, knob size, style (classic, ring, just the knob, with arrows), colour |
| Show | only while touching, or always (resting in the corner at a chosen opacity) |
| Vibration | a tap when it appears, also at the edge, or off; the "Touch & drag here" hint can be turned off |

**Tilt** (Move › Control: tilt):
- **iPhone / iPad:** a **"📱 Tap to turn on tilt"** button appears and asks for motion access when tapped. A tap on the game also asks.
  - If access was refused, the button says how to fix it: close Safari fully, reopen the game, then tap Allow.
  - Tilt needs the game served over https; GitHub Pages is.
- Tilt reads the direction of gravity instead of raw angles, so it steers properly whether the phone is flat, at an angle or held upright, in portrait or landscape.
- Settings:
  - **Tilt for full speed** (degrees, default 20), **Dead zone** (degrees) and **Smoothing**.
  - **Level is**: how you hold it at the start, or flat on a table.
  - **Invert** left/right or forward/back.
  - **No tilt sensor**: on a computer it switches to the joystick; arrow keys always work.
- The **Calibrate Tilt** node makes the current angle count as level.

**Drag** (Move › Control: drag or both):
- **Drag style:**
  - **Moves as far as your finger**: a relative drag, scaled by *Drag sensitivity*.
  - **Goes to your finger.**
  - **Follows your finger (keeps the gap).**
- **Start a drag**: anywhere, or only on the object.
- **Drag smoothing** and **Max drag speed**.
- **Walls stop it**: dragging moves the body by velocity, so colliders block it.
- **Keep sliding when you let go**: a flick throws it.

### Player settings (⚙)

Players get their own **Settings** panel. Their choices are saved on their device for each game.

| Section | Settings | Shows when the game uses |
|---|---|---|
| Controls | **Left-handed** (joystick and buttons swap sides), **Control size**, **Control opacity** | a joystick, D-pad / arrows or touch buttons |
| Movement | **Joystick sensitivity** (higher = less push for full speed) | the joystick |
| | **Drag sensitivity** | Move with drag |
| | **Tilt sensitivity**, **Invert tilt forward / back**, **Set level to how I'm holding it** | tilt |
| | **Look sensitivity**, **Invert look up / down** | First / Third Person, orbit camera |
| Sound & feel | **Sound effects**, **Music** (volume), **Vibration** | always |

- **Reset** puts everything back. Opening the panel pauses the game; **Done** carries on.
- Game Settings › Touch Controls › **Player Settings (⚙)** sets where it opens: on the pause screen (default), also as a ⚙ in the top-right corner, or off.
  - A Button (Do → **open settings**) or the **Open Settings** node opens it too.
  - The **Player Setting** node reads a choice (left-handed and vibration are 1 / 0).
  - Games with *Custom Screens* open it with their own button.

### Character Controller 2D

- One component with a **Movement type**: Top-down (8 or 4 directions), Platformer, Auto-runner (tap to jump), Flappy (tap to fly up), Car (steer & drive), Spaceship (turn & thrust, wraps around the screen), Tank, Tap to move (point & click), Follow finger, Side to side (paddle) and Grid steps. Only the settings that matter for the chosen type are shown, with a tip for each.

### Progress bars and in-game loading screens

- **Progress Bar** looks: flat, striped (moving), blocks, glossy or glowing. Bars can fill left to right, right to left, bottom to top, top to bottom or from the middle, blend to a second colour and have a border.
- **Motion:** how fast it follows the value, a **damage trail** (the lost part lingers, then slides away), a **warning colour** that pulses below a set amount, and **Busy** for waiting when you don't know how long it takes.
- **Label:** your own text with `{value}`, `{max}`, `{percent}` and `{left}`, placed inside, above, below or to the right, with its colour and size. Rings get a thickness, blocks and glow too.
- **Loading Screen** component (on a full-screen panel): fills a variable (`loading`) from 0 to 100 with a pace (realistic stops and starts, steady, fast then slow, slow then fast, or steps), waits for pictures and fonts, rotates tips into `{tip}`, pauses the game and hides touch controls while it shows, can wait for a tap at 100%, then hides with a fade, slide or zoom and does an action (by default it sends the message `loaded`). It can start with the game or when a message arrives.
- **Project → UI → Loading:** ready-made Classic, Retro and Ring loading screens, a **Level Loading** screen that appears on the message `loading` and then goes to the next level, plus Striped Loading Bar, Busy Bar, Battery Blocks, Boss Health with a damage trail, Vertical Gauge and Loading Ring.

### Tap and click components

- **Click Popup**: a floating "+1" (any text, with `{score}` etc.) rises where the object is tapped.
- **Combo Clicker**: tap for points; quick taps build a combo multiplier (`{combo}`), with critical hits, popups, squash and sparkles.
- **Long Press**: hold a finger on it for a moment (a ring fills up) to do any Button action.
- **Double Tap**: two quick taps do any Button action.
- **Button** settings:
  - **When it fires**: on tap (finger lifted on it), on press (finger lands), while held (repeats every N seconds, after a short pause) or on long press (hold for N seconds). **Only once** makes a one-shot button.
  - **Look & feel**: how far it squashes while pressed, an optional pressed colour, and a buzz.
  - **Only works when…**: a variable check such as `level ≥ 3`. Until then the button fades out and does nothing.
  - **Cost & cooldown**: spend a variable (for example 10 `coins`) each time; it fades out when you can't afford it, shakes and sends an optional "denied" message. A cooldown dims it with a sweep and a countdown.
  - **Also send message**: send a message as well as doing the action.
- **Tap Toggle**: each tap switches on/off: a 0/1 variable, its colour, another object's visibility, and an "on/off" message.
- **Press Feedback**: squashes the moment a finger lands, springs back on release, with sound, buzz and optional sparkles (great on UI buttons).
- **Tap to Spawn**: tapping empty space (or anywhere) creates a template there; cooldown, max count and an optional cost.
- **Drag to Launch**: slingshot — pull back from the object and let go to fling it, with an aim line (Angry Birds, golf, pool).
- New prefabs: **Big Clicker**, **Slingshot Ball** and **Switch**.

### Sounds

- **Project › Sounds › Import Sound** brings in MP3, WAV, OGG or M4A files from your phone (short clips work best: they're saved inside the project). Tap ▶ to preview; ⋯ renames (everything using it follows) or deletes.
- Imported sounds appear in every Sound picker: the Sound component, Turret, the Play Sound action and node. From code: `s.engine.audio.sfx('name')`.

### Edit Collider (2D)

- On a Rigidbody 2D, tap **Edit Collider**. A green outline shows the collider: drag an edge handle to resize it (the opposite edge stays put), the middle handle to move it off-centre, or a circle's rim handle to change its radius. A "fit to shape" collider becomes an explicit box or circle the first time you drag it. On a **Polygon** or **Edge** collider every corner gets a green dot: drag it to move that corner. Works on rotated and scaled objects.

### Play mode tools

The bar at the top while playing: **Stop**, **Pause**, **Step** (one frame while paused), **Inspect**, **Stats**, **Console**.
- **Inspect** pauses without the "PAUSED" screen. Tap any object in the running game, including ones spawned while playing, to see its live position, rotation, velocity, visibility and components, and change them. Step moves the game on a frame at a time while you watch the numbers. Changes last until you stop.
- **Stats** shows FPS, objects, bodies, the game state, time and your variables (score, lives…).

### Console

- The **Console** tab lists what your game reports while it runs: the **Debug Log** action (Triggers) and node (Visual Script), `P.log()` / `P.warn()` in custom scripts, warnings (e.g. spawning a template that doesn't exist) and errors.
- Repeated messages fold into one line with a count. Filter by Log / Warn / Error, clear it, and choose whether Play clears it. Tap a message from an object to jump to it.
- While playing, the console button in the play bar (with a red count for errors) opens a live log over the game.
- A custom script that crashes is reported once and the game keeps running.

### Portrait or landscape

- **Pick it when you start:** New Game has a *Blank game: Portrait / Landscape* switch, and every game type shows which way it plays.
- **Change it any time:**
  - *Game Settings → Orientation* (Portrait / Landscape / Either), or the orientation button on the UI editor's screen bar.
  - Switching turns a 2D game's screen size around (400 × 700 ↔ 700 × 400) for every level, and a camera sitting in the middle of the old screen moves to the middle of the new one.
- **Held the other way?** Choose what players see: *Ask the player to turn it*, or *Play in a box* (the game keeps its shape with bars at the edges). *Go full screen and lock the rotation* locks it on phones that allow it.
- **In the editor:** the UI editor and Play show the game in its own shape, so a landscape game is a wide box on a portrait phone. Turn the phone to play it full screen.
- From code: `settings.orientation` ('portrait' | 'landscape' | 'any'), `settings.wrongWay` ('ask' | 'letterbox'), `engine.letterbox` to force the box, and `engine.fitScreen()`.

### Lists, buttons, inputs, sliders and UI animation

New groups in *Project › UI*: **Buttons**, **Inputs**, **Lists** and **Animated**. The parts these components build (rows, knobs, ± buttons, options) appear when you press Play.
- **List View** component: a scrolling list of rows.
  - **Rows from:** typed items, a list variable (e.g. high scores) or numbers 1 to N.
  - **Row text:** use `{item}`, `{i}` and any `{variable}`.
  - **Picking:** drag to scroll, tap a row to pick it. Its position goes in `picked`, its text in `pickedItem`, and the message `picked` is sent.
  - **Look:** row height, gaps, colours (with every other row and the picked row), roundness, numbering, a › arrow, and rows that slide in one after another.
  - **Widgets:** List View, Leaderboard List, Settings List, Level Select List.
- **Buttons:**
  - Pill, Outline, Gradient, 3D, Glass, Neon, Danger, Chip.
  - Round Icon Button, Floating Action Button.
  - Hold-to-Confirm (a ring fills while you hold).
- **Inputs:**
  - **Text Input** now types right in the bar (the phone keyboard opens) instead of a pop-up. It handles text, numbers, passwords (shown as •••), e-mail and search. It has a hint colour, an outline while typing, live updates and a message on Enter, and the pop-up box is still an option. Widgets: Input Bar, Password Field, Number Field, Search Bar.
  - **Toggle** can look like a **switch** (sliding knob) or a **checkbox** (a tick), and can send a message when it changes.
  - **Segmented Control** (new): Easy | Normal | Hard with a highlight that slides to your pick. It stores the text or the position.
  - **Stepper** (new): − value + with min, max, step, a value format like `x{value}`, and hold to keep counting.
- **Slider:**
  - A knob (circle or square, any colour and size), vertical sliders, and a click on each step.
  - The value can show above the knob, while dragging, or at the end, with a format like `{value}%`.
  - It can send a message when you let go.
  - Widgets: Slider with Knob, Stepped Slider, Vertical Slider.
- **UI Animation** component:
  - **Entrance:** plays when the game starts, every time the element appears, or on a message, with a delay. It can animate the children one by one (menus whose buttons arrive in turn).
  - **Idle loop:** float, pulse, breathe, wiggle, heartbeat, bounce, spin, glow, or a shake every few seconds.
  - **Widgets:** Bouncing Title, Pulsing Play Button, Menu That Slides In, Spinning Reward Star, Heartbeat Heart, Attention Badge.
- **New animations** everywhere UI shows and hides (popups, pages, Show / Hide UI node, UI Animation): **drop in** (falls and bounces), **flip**, **spin in**, **elastic pop**, **swing in**, **rise**, **stretch**.

### Notifications (Game Settings › Notifications)

Pop-up notifications are built in; there's no component to add. Every game has **notification types**, each with its own look.
- **Built-in types:**

  | Type | Look |
  |---|---|
  | default | card at the top |
  | achievement | gold border with a shine |
  | reward | green, with a **Claim** button |
  | levelup | gradient banner |
  | info | pill at the bottom |
  | warning | orange border, shakes |
  | error | red toast |
  | chat | speech bubble at the top left |

  Edit any of them (**Reset to built-in** puts it back), **Duplicate** one, or make a **New type**.
- **Showing one:**
  - The message `notify:TYPE Title|text|icon|buttons`, e.g. `notify:reward Daily gift|+50 coins|🎁`. Plain `notify Title|text` uses *default*, and `{variables}` work.
  - The **Notify** node (type, title, text, icon, buttons, and a *tapped* output).
  - A trigger's **Show notification**.
  - A Button / Timer / Trigger Zone action **show notification** with `type: Title|text|icon` (or just `Title|text`).
  - `engine.notify({ type, title, text, icon, image, buttons, duration })`.
- **Each type sets:**
  - **Look:** style (card, pill, banner, achievement, toast, speech bubble, minimal, picture background), position (top, bottom, middle or any corner), width, corner roundness, and how many show at once.
  - **Colours:** background with an optional gradient, title, text, accent, border and border width, shadow, and glow.
  - **Content:** a small heading (e.g. ACHIEVEMENT), an icon (UI icon or emoji) with a circle / square / no background, a picture (replaces the icon, or fills the *picture* style), and title and text sizes.
  - **Motion & sound:** comes in with slide, fade, pop, bounce, drop, flip, zoom or shake; leaves with slide, fade, shrink or disappear; how long it stays; a timer bar; sound and vibration.
  - **Tapping:** close, send a message, open a page, or do nothing. Up to **2 buttons** (`Claim > claim reward, Later`): the first uses the accent colour, and a button without a message just closes it.
- **Test** shows a type in the editor. From the type editor, the dialog steps aside while the preview plays. *Test a few* shows several at once.
- Types are game-wide: every level uses them. A *Notifications* component (Project › UI › HUD) still works, and handles plain `notify` messages in scenes that have one.

### Phone notifications (Game Settings › Phone Notifications)

Real notifications in the phone's own notification area (the lock screen and pull-down list), such as "Your energy is full!".

- **Where they work:**
  - **iOS / Android apps** made with *Build Settings › App stores*: full support. They can be scheduled and arrive while the game is closed. The app project includes `@capacitor/local-notifications`.
  - **Browsers:** only while the game is open (the Notification API). On iPhone, only once the game is added to the Home Screen.
- **Sending one:**
  - The **Phone Notification** node: title and text (with `{variables}`), and *when*: now, in N seconds / minutes / hours / days, daily at a time (HH:MM), or every minute / hour / day / week. An **id** lets a newer one replace an older one. Its *not allowed* output runs if the player said no.
  - **Cancel Phone Notification** cancels one by id, or all of them if the id is blank.
  - A trigger's **Phone notification** (in N minutes, 0 = now), or the action **phone notification** with `Title|text` (amount = seconds from now).
- **Permission:** the player has to allow notifications once. *Ask the player* can be: on their first tap, when the **Ask Notification Permission** node runs (outputs *allowed* / *not allowed*), or only when the first one is sent.
- **Come-back reminders:** one per line, `hours | Title | text` (e.g. `24 | We miss you! | Your daily chest is ready`). They count from when the player leaves the game, and are replaced each time they come back.
- **Daily reminder:** a title, text and time that repeats every day.
- Tapping a notification opens the game and sends the message `notification opened` (and `notification opened ID`).
- **Test on this device** and **In 10 seconds** send a test notification from the editor.

### UI components pack (21 new components, 43 presets)

Each of these is one object with one component: it draws itself, handles taps and shows a live preview in the editor. Find them in *Project › UI* under **Controls**, **Charts**, **HUD** and **Game Systems**, or in *Add Component › UI*. Lists are typed one item per line, with `|` between the parts.

**Controls**

| Component | What it does |
|---|---|
| **Dropdown** | Choices (`Label \| value`) into a variable. Looks: filled, outline, underline, pill. Scrolls when long, opens upward near the bottom, and can send a message on change. Presets: Dropdown, Language Dropdown. |
| **Keypad** | Number pad into a variable, with max digits and PIN dots. With an **Answer**, ✓ (or reaching max digits) sends a right / wrong message and shakes when wrong. Keys: round, rounded or flat. Presets: Keypad (PIN), Code Lock Keypad. |
| **Colour Picker** | Swatches into a variable, and can recolour an object or tag (shape fill, text, mesh or tint). Circle, rounded or square swatches. |
| **Carousel** | Swipe or tap the arrows through cards (`Name \| icon \| value \| unlocked-when variable \| subtitle`); the middle card goes into a variable. Locked cards show 🔒. Looks: cover flow, flat row, stack. Dots, and optional looping. Presets: Character Select, Level Cards. |
| **Skill Button** | Tap or press a key to send a message. Then a cooldown sweep with seconds. Charges, a cost from a variable (mana), and circle / rounded / hexagon shapes. Presets: Skill Button, with charges, Mana Spell Button. |
| **Radial Menu** | A button that opens a wheel of choices (`Label \| icon \| message`): hold and slide, or tap then tap. Dims behind it. Presets: Emote Wheel, Build Wheel. |
| **Prize Wheel** | Spins on a tap or message and lands on a weighted prize (`Label \| colour \| amount \| chance`). Adds the amount to a variable, puts the label in another, ticks as it spins, and can limit spins with a variable. |

**Charts:** **Chart** draws columns, bars, line, area, pie, donut or radar from `Label | variable or number | colour`. It has a title, values, labels, grid and a grow-in animation. A line or area chart can **track a variable over time**. Presets: Column, Bar (stats), Score Over Time, Pie, Donut, Radar Stats.

**HUD**

| Component | What it does |
|---|---|
| **XP Bar** | XP and level variables. It levels up by itself (each level needs × more), with a LEVEL UP flash, sound and message, and an optional max level. Looks: bar with hex badge, thin bar, ring, segments. Text: xp / needed, percent or level. |
| **Timer** | Countdown or stopwatch as a ring, bar, pill or digits, in seconds, m:ss or tenths. Warns (red, pulsing, ticking) near the end, writes a variable and sends a message at zero. It can also end the game, win, or restart. Control it with messages: `timer pause`, `timer start`, `timer reset`, `timer restart`, `timer add 5`. |
| **Off-screen Arrows** | Edge arrows to a tag (2D and 3D, including behind the camera), with distance. Looks: arrow, chevron, dot, icon. Optional markers over targets you can see. Presets: Off-screen Arrows, Goal Marker. |
| **Crosshair** | Cross, cross + dot, dot, circle, circle + dot, chevron, brackets or T. Spreads on a message (`fire`) and while the player moves, shows a hit marker on `hit`, and has an outline. Presets: Crosshair, Sniper Scope. |
| **News Ticker** | Scrolling text with `{variables}`. Separate several messages with `\|`. Set speed and direction; the edges fade. |
| **Notifications** | Stacking pop-ups from the message `notify Title\|text\|icon` or the **Notify** node. Looks: card, pill, achievement, banner. Position, duration, max at once and sound; tap to close. Presets: Achievement Popups, Toast Messages. |
| **Screen Effects** | A red flash when a variable (hp) drops, a pulsing vignette when it's low, a white flash on `flash`, and confetti on `celebrate`, on winning, or from the **Celebrate** node. |

**Game Systems**

| Component | What it does |
|---|---|
| **Shop** | Items (`Name \| icon \| price \| ID or item:Name \| note`) bought with a currency variable. Unlocks set `owned_ID` and can be equipped into a variable; `item:` entries go into the inventory each time. Tap twice to buy, a shake when you can't afford it, and a message when bought. Grid or list. |
| **Inventory Grid** | The inventory as slots with counts. Tap to pick (into a variable), tap again to use: it sends `use Name` / `use item` and can use one up. |
| **Quest Log** | Goals (`Text \| variable \| target \| reward`) with progress bars. They tick off and strike through, give rewards like `coins 100`, send a message and sort finished goals last. |
| **Daily Reward** | A 7-day calendar, one claim per day, saved on the device. Rewards go into variables or the inventory, and the streak resets if a day is missed (optional). Send `daily reset` / `daily next day` to test it. |
| **Level Map** | A winding path, straight line or grid of levels, with stars from `stars_1`, `stars_2`… and locks above the `unlocked` variable. The next level pulses, and it scrolls. Tapping a level plays it (`goToLevel`), sends a message or sets a variable. Presets: Level Map, Level Grid. |
| **Tutorial** | Coach marks (`Text \| target object or x%,y% \| spotlight size`): a spotlight on the target, a speech bubble with Next / Skip and a step counter. It can pause the game, run once per player, and starts on load or on a message. |

### Navigation, popups and more UI

Find them in *Project › UI* (grouped) or the UI editor's + button. Widgets come with their parts inside them (children), so they move and stretch together.
- **Bottom Nav Bar:** one **Bottom Nav** component draws and runs the whole bar. Presets: Bottom Nav Bar (pill), Floating, Raised center, Bubble, Underline, Glass and Minimal icons. **Bottom Nav (separate tabs)** is the older version, made of one object per tab.
  - **Tabs:** one per line, `Label | icon | page | badge variable`.
    - The icon is a built-in UI icon (`home`, `shop`, `trophy`, `user`, `chat`, `gear`, `play`, `plus`, `star`, `heart`, `bell`…) or an emoji.
    - A badge variable shows a red count (99+) when it is a number, or a dot when it is `true`.
  - **Page changes** cross-fade in about a quarter of a second: everything inside a page fades with it, and it still finishes while the game is paused or on the title screen.
  - **9 styles:**

    | Style | Look |
    |---|---|
    | classic | icons and labels; the selected tab lights up |
    | pill | a soft pill behind the selected icon |
    | underline | a line slides along the top |
    | dot | a dot under the selected tab |
    | bubble | the selected tab grows into a bubble with its name |
    | floating | a rounded bar above the bottom edge |
    | raised center | a big round middle button that sticks up; it can send a message instead of being a tab |
    | glass | a see-through floating bar with a glow |
    | minimal | just icons |
  - **Labels:** auto, always, selected only, or never.
  - **Colours:** bar, selected, other tabs, indicator and badge. *Apply theme* recolours the bar too.
  - **Size & shape:** icon and label size, corner radius, floating gap, line along the top, shadow, and filling the home-bar area.
  - **Animation:** the indicator slides, fades or jumps, at a set speed. Tap effects: bounce, ripple, grow or none. Also a tap sound and vibration.
  - **Behaviour:** switch tab, or open as a page (Back returns). **Hide on these pages** slides the bar away (e.g. during `game`), and it can also send a message when the tab changes.
  - Tapping a tab sets the variable `page`. Ready-made **Pages** show when it matches, and they slide toward the tab you picked. The bar is drawn in the editor too, so you see it while designing.
- **Side Menus:** one **Side Menu** component draws and runs the whole menu.
  - **Presets:** Side Menu (left), Side Menu (right) (settings switches behind a ⚙ button), Floating, Glass, Banner header, Icon Rail (always visible), Full-screen Menu and Minimal. The older menus made of separate objects are still there as *Side Bar (left / right, separate items)*.
  - **Items:** one per line, `Label | icon | what it does | badge variable`.
    - *What it does* is a page name (sets `page`), `msg:name` (sends a message, shown with ›), or `toggle:var` (an on/off switch that keeps the menu open).
    - `# Title` starts a section and `-` draws a line.
    - **Footer items** sit at the bottom (e.g. Help).
  - **7 styles:** classic (tinted row with a bar on its edge), rounded, floating, glass, rail (a slim icon column that opens to the full menu), fullscreen (big centred items) and minimal.
  - **Header:** a title and subtitle (with `{variables}`), a picture (icon or emoji), simple / banner / none, and a ✕ close button.
  - **Colours:** background, text, accent, banner and badge.
  - **Size:** width, row height, text and icon size, icons on or off, and the floating gap.
  - **Animation:** opens with a slide, fade or zoom, at a set speed. Items can flow in one by one, and the game behind dims. Also a tap sound and vibration.
  - **Opening and closing:**
    - Open: the ☰ button, the message (`menu`, or `menu open` / `menu close`), or a **swipe from the screen edge**.
    - Close: **drag it back**, tap outside, use the phone's Back gesture, or pick an item.
    - Choose whether picking an item switches page or opens it as a page that Back returns from.
  - **Bottom Sheet:** a + button slides up a panel.
- **Tab Bar, Page, App Bar** (menu + title + settings).
- **Popups:** **Popup Dialog** (opens on the message `popup`, OK sends `close`), **Toast** (slides in for 2 s on `toast`), **Badge** (a red counter that hides at 0).
- **Controls:** **Checkbox**, **Segmented** choice, **Option Picker** (‹ Easy / Normal / Hard ›), **Stepper** (− value +), **Star Rating**, **Scroll List** (drag to scroll, items outside are hidden), **Card**, **Icon Button**, **UI Image**, **Loading Spinner**.
- **New components** (Add Component › UI):
  - **Bottom Nav** and **Side Menu:** complete navigation bars and menus (styles, badges, animations). See above.
  - **Nav Item (tab):** sets a variable when tapped and lights up while selected.
  - **Show If (pages):** shows UI only when a variable matches, with fade / pop / slide.
  - **Side Bar (drawer):** slides in from any edge on a message.
  - **Popup (modal / toast)**, **Option Picker**, **Scroll View**, **Star Rating**.
  - **Layout Group** can now arrange its own children and spread them evenly.
- **In the UI editor:** the **Pages** button previews one page at a time.

Everything inside a panel that has *Show when* (title, game over, paused…) now belongs to that screen too: it's only drawn, and can only be tapped, on that screen.

**Advanced navigation (pages with history, like an app):**
- **Menu with Pages:** a main menu whose buttons open Levels, Settings and Credits pages (Levels has a World 2 page inside it). Each page slides in from the right; Back slides it out to the left and returns to the exact page you came from.
- **Back Button:** goes back one page, closing an open popup or side bar first, and hides itself when there's nowhere to go back to (or goes to a *fallback* page). The **phone's back gesture / browser Back**, **Esc**, and a **swipe in from the left edge** (Game Settings › Mobile, on by default) do the same in played and exported games.
- **Sliding Page:** a ready page with a Back button. **Show If** has two new animations: **slide (follows navigation)** (forward slides in from the right, Back from the left, and tabs slide toward the side you tapped) and **zoom**.
- **Swipe Pages:** swipe between cards (onboarding, shop carousel, worlds) with dots, rubber-band ends, optional loop and auto-advance; the page number is in a variable (`slide`), and the messages `slide next`, `slide prev` and `slide 2` move it.
- **Sliding Tab Bar:** a pill (**Tab Indicator**) slides and resizes to the selected tab.
- **Nav Item** can *switch tab* (no history) or *open page (Back returns)*. Buttons, triggers and rules have the actions **go to page** (`shop`, or `tab = weekly` for another variable) and **go back**.
- **Nodes:** **Go To Page** (open / switch / start over), **Go Back** (*then* / *nowhere to go*), **On Page Opened**, **On Back**, and the values **Page Is** and **Can Go Back**.
- Scripts: `scene.navTo(page, variable, { history, dir, clear })`, `scene.navBack()`, `scene.canGoBack()`.

### Sprites (drawn art, no emoji)

- *Project › Sprites* is a library of about 100 drawn sprites (as of v0.1): characters, enemies, items, nature, vehicles, blocks and white UI icons. They are vector art, so they stay sharp at any size and add almost nothing to a project (`sprite: { src: 'art:slime' }`).
- The Image component has **Sprite library** and **From device** buttons. A shape can be turned into a sprite with *Use a sprite picture instead*.
- Built-in prefabs (NPC, guard, torch, key, bird…) and UI widgets use these sprites instead of emoji. Hearts and star ratings can use sprites as their icons (`icon: 'art:heart'`), and Sprite Animation frames can be sprites (`art:bird,art:bird2`).

### UI themes, fonts and styling

- **UI Theme** (Game Settings): pick a ready-made look (Default, Neon, Candy, Retro, Fantasy, Ocean, Light) or set your own font, text, accent, panel, dimming, touch-control, win and lose colours and corner roundness. The built-in title, pause and game-over screens, touch buttons, joystick, messages and dialogs all follow it, as does any text whose font is **Theme font** (the default for new text). **Apply to my UI** restyles everything you already made; **Use Theme** does one element.
- **Fonts:** eleven built-in fonts plus any **Google Font** (*More fonts…*; it downloads the first time a player opens the game). The theme can use one too.
- **Text:** gradient colour, italic, UPPERCASE / lowercase, letter spacing, wrap width with line spacing (type `\n` for a line break), outline, and a drop shadow with its own colour.
- **More text options:**
  - **Glow**, **underline** and **strikethrough**.
  - **Number format** for `{variables}`: short (1.2K, 3.4M), whole number, 2 decimals, time (m:ss), percent, or plain.
  - **Shrink to fit**: the text gets smaller so it never runs wider than a set width.
  - **Lines grow**: from the middle, downward or upward.
  - **Label box**: a rounded background behind the text, with padding and corner settings.
  - **Animation**: wave, bounce, shake, rainbow (moving letter by letter), pulse or float.
- **Shapes:** gradient fill (down, across, diagonal or from the centre), soft drop shadow with distance, dashed outlines.
- **Images:** rounded corners (round avatars) and **9-slice** (corners stay sharp while the middle stretches). The new **UI Frames** sprites (wood, stone, glass, parchment, gold and neon panels; blue, green, red, yellow, purple and grey buttons) are drawn for it and set it up by themselves.
- **Copy Style / Paste Style** (UI Element card) copies colours, fonts, outlines and shadows from one element to another.

### Online: PlayFab and Photon

Each game uses **your own free accounts**: Game Settings › **Online (PlayFab & Photon)** takes a PlayFab **Title ID** and a Photon **App ID** (with *Test PlayFab* / *Test Photon* buttons). Nothing goes online until you add one, and the rest of the game keeps working offline.

**PlayFab** (accounts, leaderboards, cloud saves, remote config), using its Client API directly (no SDK):
- Players are signed in automatically with a private ID kept on their device (*Sign players in when the game starts*), so there's no password screen. **Set Player Name** sets the name on leaderboards.
- **Online Leaderboard** widget / component: shows the top players (or the ones around you) in a text, refreshing on start, on the message `leaderboard`, and after posting. **Post Score** (node or the *submit score online* button action) sends a variable to a leaderboard. In PlayFab, turn on *Title settings › API Features › Allow client to post player statistics*.
- **Cloud Save / Cloud Load** keep the game's variables in the player's account. **Load Remote Config** turns Title Data into variables, so you can tune a live game. **Track Event** records analytics events. Virtual currencies show up as variables like `{pfGC}`.

**Photon** (real-time multiplayer), loading the official Photon Realtime library (`photon-realtime` from npm via jsDelivr) when it's first needed:
- **Join Room** (by name, or any open room; it connects first), **Leave Room**, or *Join a room when the game starts*. **Multiplayer Lobby** widget: status, *Play Online* and *Leave* buttons.
- **Network Sync** component: put it on your player. Everyone else in the room sees a copy that follows you (position, turning, facing, animation clip), with your name over it in 2D. Copies are tagged `remote` and are left out of the camera and the player tag; *solid* makes them bump.
- **Spawn For Everyone** (node), Spawner's *room host spawns for everyone* and Shooter's *bullets appear for everyone*: the object appears for every player, and when it's collected or destroyed anywhere it disappears everywhere. Players who join later get the objects that are already there.
- **Send Network Message** (with a number) arrives at everyone else as a normal game message and fires **On Network Message**; **Set Shared Variable** keeps a variable the same for everyone (late joiners get it too).
- Events **On Joined Room**, **On Player Joined**, **On Player Left**, **On PlayFab Logged In**, **On Online Error**; values **Players In Room**, **Is Room Host**, **Is In Room**, **Network Message Value**. Show `{netState}`, `{netPlayers}`, `{netRoom}`, `{pfName}`, `{pfRank}` or `{onlineError}` in any text.
- Scripts: `engine.online` has `join()`, `leave()`, `sendMessage()`, `setShared()`, `pfLogin()`, `pfSubmit()`, `pfLeaderboard()`, `pfSave()`, `pfLoad()`, `pfTitleData()`, `pfEvent()`.

### Saving, restore points and backups

- **Autosave** to the browser's database (IndexedDB), one record per game, with room for hundreds of MB, so imported pictures and sounds no longer fill a ~5 MB limit. Games saved by older versions move across by themselves the first time.
- **Safety copy:** when you switch apps, lock the phone or close the tab, the open game is also copied instantly, so a phone freezing the page mid-save can't lose the last edits.
- **Earlier versions** (☰ → *Restore Earlier Version…*): a restore point every few minutes while you work (the last 12 per game). Restoring keeps your current version as a restore point too.
- **Back Up All Games** (☰ or the Home card) puts every game and your saved scripts in one file and opens the share sheet (Files, iCloud Drive, Google Drive, email…). **Restore** brings them back on any phone or browser: missing games are added, older copies updated, and newer ones on the phone kept.
- The Home screen shows how your games are kept (size, *kept safe ✓* when the browser promises not to clear them) and nudges you to back up after a week. On iPhone it explains that Safari can clear a website's data after a week without a visit and suggests adding the app to the Home Screen, which avoids that.
- If storage runs out, a dialog says so and offers a backup straight away.

### Updates

The editor, home page and player check for a new release when they open, when you come back to them, when the phone goes online and every 10 minutes. A bar says *A new version is ready*: **Update** saves your project, clears the old cached files and reloads. Home → **Updates** checks by hand and shows the version you're on. This matters most for the home-screen app, which a phone can keep open for days.

**Pull down to refresh** on the home page and the editor's home screen. Drag down from the top and let go once it says *Release to refresh*. If a new version is out, it installs it. Otherwise it saves your project and reloads. It only works when the page is scrolled to the top, and a short pull or a sideways swipe does nothing.

### Safe area and UI scaling (fits every phone)

- **Safe area:** UI anchored to corners and edges stays clear of notches, the Dynamic Island, camera holes, rounded corners and the home bar, using the phone's real safe-area insets. Stretched UI fills the safe area.
  - Tick **Ignore safe area** on a UI element (UI Element card) for full-screen backgrounds that should go under the notch.
  - *Game Settings → Screen & Safe Area*: turn the safe area off, or add **extra edge space** on every side.
- **UI scaling (like Unity's Canvas Scaler):** UI grows or shrinks with the screen, using the game's design size (*view width × height*) as the reference. **Match width ↔ height** picks what to follow (0 = width, 1 = height, 0.5 = both), **UI size multiplier** makes everything bigger or smaller, and *Same size on every screen* turns scaling off. Taps, sliders, buttons and layouts all follow the scale.
- **Preview phones in the UI editor:** the phone button on the screen bar shows an iPhone notch, Dynamic Island, Android camera hole, a sideways iPhone, no notch, or this device. The safe area is outlined, the unsafe edges are tinted, and the preview also applies when you press Play.
- From code: `uiBox(e, W, H, engine.safe)` gives an element's on-screen box, `placeUI(e, x, y, W, H, engine.safe)` moves it to a screen point, `engine.safe` holds the insets and the scale `k`, and `engine.safeOverride` fakes insets for testing.

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
  - Effects: move by / to / **from**, rotate by / **to**, **spin**, scale to / **by**, fade, colour, punch scale / position / **rotation**, shake position / rotation / **scale**, path (optionally closed), jump (with **number of hops**), **spiral**, **look at**, **blink**, **type text** (optionally scrambled) and **count up** (a variable or the object's text).
  - 33 eases with a curve preview (adds smoothStep, spring and flash), loops (−1 = forever), yoyo / restart / incremental, delay, **vibrato and elasticity** for punches and shakes.
  - **Play as From**, **speed-based** duration (units per second), a **Tween ID** for controlling it from nodes.
  - Play on start, tap, **tap (forward / back)** like a switch, touch or message; **each loop, do** and **when finished, do** an action. **Preview** plays it right in the Scene.
- **Tween Sequence** component (DOTween Sequence): a list of steps, each one **Then** (after the last), **Together** (with the last) or a **Pause**. Pick the effect, ease and values per step, reorder, duplicate or delete steps. Loop it (restart or yoyo), add a delay, play on start, tap, touch or message, and do something when it ends. **Preview** plays the whole sequence.
- **Sprite Animation** (flipbook): emoji or image frames at any fps; loop, ping-pong or once; always, only while moving, or on a message.
- **Sprite Sheet Animator**: pick one picture holding a grid of frames, set columns and rows, and name clips by frame range (`idle: 0-3, run: 4-9, jump: 10`). It plays the start clip, can switch **idle / run / jump by itself**, and faces the way it moves. Play clips from nodes, triggers or messages; a clip played *once* finishes before the automatic switching takes over again, and fires **On Animation End**.
- **Animator auto states**: fill *clip when standing still / moving / in the air* and the Animator picks the clip itself, like Unity's Animator.
- **From code** (DOTween style):
  - `scene.to(obj, { x: 100, 'shape.fill': '#f00' }, 0.5, { ease: 'outBack', loops: -1, loopType: 'yoyo' })` returns a tween you can chain: `.setDelay()`, `.setFrom()`, `.setSpeedBased()`, `.setBlendable()`, `.setId()`, `.setTimeScale()`, `.setAutoKill(false)`, `.onStart()`, `.onUpdate()`, `.onStepComplete()`, `.onComplete()`, `.onKill()`, `.onRewind()`.
  - Playback: `.pause()`, `.play()`, `.togglePause()`, `.playBackwards()`, `.playForward()`, `.flip()`, `.restart()`, `.rewind()`, `.complete()`, `.goto(seconds)`, `.kill()`, `.progress()`, `.isPlaying()`.
  - `scene.from(…)`, `scene.sequence({ loops, loopType, delay })` with `.append`, `.join`, `.insert`, `.prepend`, `.appendInterval`, `.prependInterval`, `.appendCallback`, `.insertCallback`.
  - `scene.punch`, `scene.shakeProps`, `scene.path`, `scene.jumpTo`, `scene.spiral`, `scene.lookAtTween`, `scene.blink`, `scene.typeText`, `scene.counter`, `scene.virtual` (DOVirtual.Float), `scene.delayedCall`, `scene.flashScreen`.
  - Control many at once by target or ID: `scene.killTweens`, `pauseTweens`, `playTweens`, `reverseTweens`, `restartTweens`, `completeTweens`, `tweenSpeed`, `isTweening`.
  - `Ease.outBounce` and friends, `Ease.curve([[0.5, 0.9]])` for your own curve, and `'steps4'` for stepped motion.
- **Messages:** `scene.send('door-open')`, the *send message* action, and the Send Message / On Message nodes let objects trigger each other.
- **Nodes:** Tween, Punch, Stop Tweens, Play/Stop Animation, Animation Speed, Sprite Frame, Flip, Fade, Blink, On Animation End, Send Message, On Message, Camera Impulse.

### A tidier Inspector

- **One slim top row:** back to the Hierarchy, search (with "2/21"), Advanced, previous / next object.
- **Compact object header:**
  - The name, then tag chips.
  - Two rows of small pickers: Layer · Draw + order · Parent · Child (New Child / Add Existing).
  - The Children list only appears when there are children.
- **Filter chips** (Visual, Physics, Logic…) only appear when an object has five or more components; otherwise it just says how many there are.
- **Closed components show a summary:**
  - Transform shows its position, Shape shows "Rectangle · 30×40", Text shows its words and size.
  - Other components show their first settings, e.g. "run speed 240 · jump power 680".
  - Fold everything with the list button to see the whole object at a glance.
- **Less to scroll:**
  - Rarely used settings fold away, and a fold opens by itself (with a dot) when something in it is set:
    - Shape: **More looks** (outline width, dashes, gradient, shadow, glow).
    - Text: **Style**, **Wrapping**, **Outline / shadow / glow**, **Numbers and fitting**, **Label box** and **Animation**.
    - Components with a long list: the extra settings go in **More settings**.
  - Descriptions show two lines; tap to read the rest.
  - Rows and number fields are a little more compact.

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
| `move` | Player movement with the joystick, dragging, or tilting the phone (`control: "tilt"`). | `speed` (260 / 3D 7), `control` ("both"), `axes` ("all"), `keepInView` (true), `face` (true), `accel` (0); movement: `accelTime` / `decelTime` (0), `directions` (any / 8 / 4), `speedVar`, `face2D` (none / flip / rotate), `turnSpeed` (0), `relative` (world / camera); run & dash: `runWith` (off / edge / action / jump / always), `runSpeed` (1.7), `dashWith` (off / action / jump / doubletap / swipe), `dashSpeed` (800 / 3D 22), `dashTime` (0.15), `dashCooldown` (0.6), `dashTrail` (true); tilt: `tiltMax` (20), `tiltDead` (3), `tiltSmooth` (0.3), `tiltLevel` (start / flat), `tiltInvertX/Y`, `tiltFallback` (joystick / none); drag: `dragMode` (relative / follow / offset), `dragArea` (anywhere / object), `dragSpeed` (1.2), `dragSmooth` (0), `dragMax` (0), `dragSolid` (true), `dragThrow` (false) |
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
| `firstPerson` | First-person controls: joystick to walk, drag the screen to look. In a voxel world it hops up one-block steps on its own (auto-jump). | `speed` (6), `look` (0.25), `eye` (0.6), `jump` (9), `autoJump` (on) |
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
| `voxelBuilder` | Block Builder, with Minecraft-style touch controls: hold a finger still on a block to mine it (a ring fills; stone takes longer than dirt, leaves break fast), tap to place the block picked in the hotbar on the face you tapped, and drag to look. The targeted block gets a dark outline. Survival inventory collects what you mine and counts it in the hotbar. `controls: 'mode buttons'` keeps the old tap-to-break with BREAK/PLACE buttons. | `reach` (6), `controls` (hold to mine / mode buttons), `aim` (finger / crosshair), `hotbar` (`'1,2,3,4,5,6,8,9,12'`), `inventory` (creative / survival), `mineSpeed` (1) |
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
| `engine.prefs`, `engine.setPref(key, value)`, `engine.openSettings()`, `engine.stickSide` | the player's saved settings (`lefty`, `controlScale`, `opacity`, `stickSens`, `dragSens`, `tiltSens`, `tiltInvert`, `lookSens`, `invertLook`, `sfx`, `music`, `vibration`), the Settings panel, the joystick side after left-handed |
| `engine.input.requestMotion()`, `engine.input.calibrateTilt()`, `engine.input.tiltCfg` | ask for motion access from a tap (iPhone), set level, tilt range / dead zone / smoothing |
| `engine.audio.sfx('coin' \| 'jump' \| 'hit' \| 'power' \| 'win' \| 'lose')`, `audio.play(url)` | sound |
| `engine.vibrate(ms)`, `engine.timeScale`, `engine.paused`, `engine.restart()` | misc |

### Scene settings

`settings: { title, subtitle, joystick, jumpButton, actionButton, pauseButton, muteButton, winScore, timeLimit, saveBest, orientation, fullscreen }`. `orientation` (`'portrait'`/`'landscape'`) shows a "turn your device" screen when a phone is held the wrong way; `fullscreen` goes fullscreen on the first tap. Games keep the screen awake while playing and have a mute button. More phone settings: `joystickSide` (`'left'`/`'right'` for left-handed players; buttons move to the other side), `controlSize` (`'small'`/`'medium'`/`'large'`), `saveProgress` (variables and level survive closing the game; reset on game over), `shareButton` (a *Share score* button on the end screen using the phone's share sheet). Buttons vibrate when pressed, audio recovers after calls or app switches, and the engine lowers its resolution automatically if a phone can't hold a smooth frame rate. With `timeLimit`, `{time}` counts down and the game ends at zero.

**Turn-based games:** set `settings.turnBased`. Grid Move, Turn Button and Board Cell end the player's turn; then every component with a `turn(e, scene)` hook acts (Turn Enemy, Enemy Turn, the board's computer player) after `turnDelay` seconds. Texts can show `{turnText}` and `{turn}`; `scene.endTurn()` ends a turn from scripts. `messageTop` moves message banners to the top of the screen.

**Actions** (Trigger, Timer, Condition, Button, Rules): message, add score, add to variable, set variable, spawn template, destroy object/other, show/hide/toggle object, play sound, vibrate, camera shake, jump, move by, win, game over, next level, start/restart/pause/resume game.

**Custom UI:** UI entities can have a `bar: { var, max, maxVar, w, h, fill, bg, radius, label }` (health/progress bar; `var: "self.hp"` reads an object's own health from the Health component) and `showWhen: 'always' | 'play' | 'title' | 'paused' | 'over' | 'win'`. `settings.customScreens` turns off the built-in title/pause/end screens so your own UI and Buttons run them. Anchors include `left`, `center` and `right` edges.

**Controls:** `settings.controls` = `'auto'` (joystick when `joystick` is on) / `'joystick'` / `'dpad'` / `'arrows'`; `joystickMode` `'floating'` / `'static'` / `'fixed'`; `joystickZone` (`half`/`third`/`full`), `joystickDirections` (`all`/`8`/`4`/`horizontal`/`vertical`), `joystickResponse` (`analog`/`curve`/`full`), `joystickDeadZone`, `joystickSize`, `joystickKnob`, `joystickStyle` (`classic`/`ring`/`dot`/`arrows`), `joystickColor`, `joystickVisible` (`touch`/`always`), `joystickIdleOpacity`, `joystickHaptics` (`tap`/`edge`/`off`), `joystickHint`; `playerSettings` (`pause`/`corner`/`off`); `controlsOpacity`; `jumpLabel` / `actionLabel`. Platformer has acceleration, air control and short hops when the jump button is released early.

**Physics:** bodies support `oneWay` platforms (jump up through, land on top), riding moving (kinematic) platforms, `mass` (heavier pushes lighter), `friction`, `drag`, `maxFall`, and collider offsets `ox/oy/oz`.

**Collider shapes:** `collider: { shape, … }` takes `box` (`w, h, d`), `circle` / `sphere` (`r`), `capsule` (2D `w, h`; 3D `r, h`), `cylinder` (3D `r, h`), `polygon` and `edge` (2D `points: [[x, y], …]` around the object's centre). Concave polygons are split into convex pieces (ear clipping); an edge is a chain of two-sided segments. Every shape also takes `trigger`, `ox/oy/oz`, `bounce`, `friction`, `layer` and `oneWay`.

**3D shapes and models:** meshes come in box, sphere, cylinder, cone, capsule, pyramid, wedge (ramp), prism, gem, dome, torus and plane. `model: { parts: [{ geometry, x, y, z, rx, ry, rz, w, h, d, r, color, emissive }] }` builds a model from parts (the editor's 3D Model component edits parts and highlights the selected one; Project → Models has 17 ready-made models). The collider fits around all parts.

**2D sprites:** shapes include rect, circle, ellipse, triangle, star, heart, diamond, hexagon, pentagon, octagon, capsule, ring, arrow, cloud, and `emoji` sprites (`shape: { type: 'emoji', emoji: '🐱', w, h }`; Project → Sprites has a library of characters, enemies, items, nature, food, vehicles and props).

**Voxels:** give an entity `voxels: { size, gen: { type: 'hills' | 'flat' | 'empty', w, d, h, seed, trees }, edits: { "i,j,k": block } }` for a Minecraft-style block world (12-block palette: grass, dirt, stone, wood, leaves, sand, water, brick, snow, obsidian, gold, crystal). It is drawn as merged chunks (only visible faces), dynamic bodies walk on it and bump into it, projectiles stop at blocks, and `entity.voxels.get/set(i, j, k)` / `raycast(entity, origin, dir)` let scripts dig and build. In the editor, select the world, pick the brush (Paint tool), choose Add/Remove and a block, then tap or drag to build.

**Levels:** put more scenes in `levels: [sceneJson, ...]` on the first scene. Winning a level shows "Level complete" and continues to the next one, carrying variables like score and lives over; `{level}` shows the level number. `engine.start(json, { level: 1 })` starts at the second level. Also `background`, `gravity` (2D: positive is down, e.g. `1600` for a platformer; 3D: e.g. `-25`), `view` (2D design size), `camera`, `light: { dir, color, ambient }` and `fog: { near, far }` for 3D.

## Limitations (v0.1)

- Physics uses axis-aligned boxes and spheres. Rotation is visual only, and there are no slopes or joints.
- 3D has primitive meshes only (no model loading or textures yet) and blob shadows instead of real shadow maps.
- Projects are saved in the browser's local storage. Use JSON export for backups.
