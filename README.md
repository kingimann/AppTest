# Pocket Engine

A **2D + 3D game engine for phones**, plus a **visual editor you use on your phone**. It is touch-only by design: no keyboard or mouse controls.

Make any kind of game: platformers, first-person shooters, third-person adventures, top-down games, racing, endless runners, clicker/idle games, space shooters, tap games and puzzles.
Plain JavaScript ES modules. No dependencies and no build step.

- `engine/pocket.js`: the engine, one file
- `editor/`: the visual editor (make games without code)
- `examples/`: Neon Dodge (written in code) and the starter templates
- `play.html`: plays a template (`?game=jump-quest`) or any scene JSON (`?src=my-game.json`)
- `supabase/schema.sql` and `editor/cloud-config.js`: optional accounts and cloud sync for the editor ([Accounts guide](docs/guide/accounts.md)): a profile on each device now, sign-in and syncing games between devices once a Supabase project is connected

## Documentation

The engine has its own documentation site in `docs/`: open **docs/** in the app (or *☰ → Documentation* in the editor, or **Docs** on any component's ⋯ menu). It works offline and has:

- **21 guides:** getting started, the editor, core concepts, the game file, physics, Triggers and state machines, visual scripting, UI, gameplay systems, quests and dialogue, making apps, cameras and lighting, animation and audio, saving and online, scripting with JavaScript, using the engine from code, writing your own components, publishing, accounts and cloud sync, plugins and mods, and troubleshooting.
- **A reference generated from the engine itself**, so it always matches the running version:
  - every component with all its settings, types, defaults (2D and 3D) and choices;
  - every visual-script node with its wires and settings;
  - every Trigger event, condition and instruction;
  - the JavaScript API (classes, methods and functions, with their source comments);
  - the scene events, and the built-in lists (item types, eases, shapes, sounds, defaults…).
- **Search** across all of it.

Guides are Markdown files in `docs/guide/`, so they also read well on GitHub.

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

**Requirements:** anything that needs data or a page the app doesn't have gets it automatically, with a message that has **Undo**. That includes an Inbox (Messages and a chat page), a Bottom Nav tab, a Side Menu item, an App Bar button, a *Go to page* button, a form, or a page field. Pages are ready-made when the name is known, otherwise a titled page that says what it's for, using the exact name the link uses. Opening a project adds what it's missing. The same goes for anything a component, node, trigger or state machine names: in-app products, quests, dialogues, items, data collections, Spawn templates and notification types are made with starter entries. A link to a near-miss page name (*signin* vs *sign-in*) is pointed at the existing page, and the running app finds such pages too. *Preferences › Editing › Missing pages & data › Ask me first* asks instead, with **Make them for me** in the Hierarchy. Before this release, it asked every time (*Needed to work › Add them*, or Undo); deleting something another part needs asks the same; the Hierarchy lists anything already missing. A tab, menu item or App Bar button that opens a page you haven't made yet no longer drops you on the first page. Messages, chat, notifications, friends, saved, marketplace and achievements pages are made while the app runs, and ⋯ › **Make the “inbox” page** builds the ready-made page in the editor.

The Hierarchy has **quick filters** (All, Pages, UI, Player, Logic, Physics, Hidden, Templates, with counts), **Fold all / Unfold all**, a **path** to the selected object (tap a parent to select it, the target button scrolls to it), each component's own icon, and in apps a marker on the page that's **showing** (tapping a page shows it).

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
  - **Build on Codemagic from here:** sign in with GitHub (or a token) and connect your Codemagic API token once; **Send & build** pushes the app project to a private repo in your GitHub, adds it to your Codemagic with a read-only deploy key, starts the iOS / Android workflows and shows their status, downloads and Recent builds in the editor (no server: both APIs allow the browser).
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
  - **Or with Expo:** **Download Expo project (.zip)** makes an [Expo](https://expo.dev) app (SDK 57) instead, with the same App ID, version, orientation, icon and splash:
    - The game runs in a full-screen WebView (`react-native-webview`). A small bridge in `App.js` gives it the same native features as the Capacitor export, through Expo's modules:
      - **phone notifications**: scheduled, daily and repeating, and tapping one opens the game (`expo-notifications`);
      - **haptics** (`expo-haptics`);
      - the permissions your game asks for (camera, microphone and location usage texts on iOS, permissions on Android);
      - the **Android Back button** (it goes back in the game, and closes the app when there's nowhere to go).
    - Try it on your phone: `npm install`, then `npx expo start`, and scan the QR code with the Expo Go app.
    - Build and publish in the cloud with **EAS**: `eas build --profile preview` (an installable test build) or `--profile production` (store builds, build numbers go up by themselves), then `eas submit`. The README inside has the steps.
    - The game is `game/game-html.js`; download again and replace it to update the game.
- **File size:** **Compress** makes the file about 3× smaller (needs iOS 16.4+ or a 2023 browser). A report shows the total size, the engine, the game data, pictures, sounds and the biggest files.
- **Testing:** a frame-rate counter and errors on screen, for trying the build on another phone.
- **Build** downloads it, **Share** sends it with the phone's share sheet, and **Test** opens the build in a new tab.

### Editor Preferences (☰ → Preferences…)

Settings for you on this device (games keep their own settings):

| Group | Settings |
|---|---|
| Look | theme (Dark, Black, Slate, Midnight, Warm, Light), accent colour (it colours the Play and Add buttons, selections and highlights too), panel text size, reduce motion |
| Editing | snap on / off, snap step for 2D (1–50 px) and 3D (0.1–1), rotation snap (5°–90°), grid, all colliders, vibration on taps |
| Saving | after a few seconds (the default), straight away, every 10 seconds, when I leave, or only when I tap Save (asks before leaving); how often restore points are taken (1–10 min) and how many are kept (6–40); back up and restore |
| App | open on the Home screen or straight into the last game, keep the screen on while editing, version and **Check for updates**, **Install app**, storage used and **Protect my games** (asks the browser not to clear them) |

**Reset preferences** puts them back.

### Easy logic: Triggers (Game Creator style) and State Machines (PlayMaker style)

Add them from *Create → Logic*, *Add Component → Logic*, or **Quick add** in the Inspector.

- **Triggers** are friendly cards: **ON** something happens → **IF** conditions are true → **DO** instructions, top to bottom.
  - **38 events**: game starts, every N seconds, tapped, **double-tapped**, **pressed and held**, touched / stops touching a tag, jump/fire button, swipe, **keyboard key**, message, variable reaches, **variable changes**, **after a delay (once)**, **at random times**, **comes near a tag**, **starts seeing a tag**, **lands**, **takes damage**, **dies**, destroyed, animation finished, **level won**, **game over**, **player leaves / comes back to the app**, **run by another trigger or a visual script's custom event**, **phone shaken**, **page changes**, **state machine enters a state**, **inventory changes**, **permission answered**, **internet lost / back**, **phone turned**, **side menu opens / closes**.
  - **35 conditions**, each flippable with NOT: **list contains / list length**, **dictionary has key**, **page is**, **key held**, **finger on the screen**, **online**, **time of day**, **permission granted**, **another object's variable**, **a visual script function's result**, **event value**, compare variable, **compare two variables**, **its own variable**, **text variable**, **health** (or health %), **number of objects with a tag** (e.g. no enemies left), **is moving**, **level number**, **time in this level**, **phone held upright**, **save file has key**, chance, touching, on ground, distance, can see, exists, visible, state is, has item, has save, game playing.
  - **83 instructions** in 8 groups:
    - Lists: **add / remove / clear / shuffle / sort / pick an item**, **dictionary set / add / remove**.
    - Camera: **make a camera live**, **follow a tag**, **zoom**, **fade the screen**.
    - Scripts: **call a custom event** (on this, other, an object, a tag or everything, with a value) and **run a visual script function** (store its result).
    - Variables: change variable, **toggle**, **random number**, **set text**, **change its own variable**, **save / load a variable (save files)**, give/use item.
    - Objects: show/hide, destroy, spawn, set text, set colour, move to, damage/heal.
    - Motion: move/rotate/scale/fade with easing and "wait until done", punch, play animation.
    - Physics: push, set velocity, jump, gravity.
    - Flow: **wait**, **wait a random time**, **wait until a variable…**, **continue only if…**, **repeat the steps above N times**, **stop here**, **run another trigger** (by name, on any object), send message, go to state.
    - Motion, objects and physics (new): **set position**, **glide to an object**, **face a tag**, **push toward / away**, **stop moving**, **add / remove tags**, **destroy all with a tag**, **change picture**.
    - Game (new): **slow motion**, **pause / resume**, **haptic tap**, **open a website**, **copy text**, **share**, **ask the player to type** (waits for the answer), **go to page**.
    - Game: show message, **pop-up text**, **particle burst**, dialogue, sound, **music**, vibrate, camera shake/switch, save/load, win, game over, next level, **go to level N**, restart.
    - Spawn can now spawn at the *other* object (what touched it).
  - **Per-trigger options** (⚙ on each trigger, shown as chips on its header):
    - a **name**;
    - runs every time, only once, or up to N times;
    - a **cooldown**, a **delay** before the steps, and a **chance %**;
    - **all** conditions or **any** one;
    - what happens if it fires again while running: run another copy, ignore it, or start over;
    - **write to the Console** when it runs.
  - **Event values**: a message or custom event can carry a value. Check it with the *Event value* condition, or type `@event` into any field (or `{@event}` inside text).
  - **ELSE** steps run when the event happens but the conditions are false (e.g. a chest with a 30% rare drop, else coins).
  - Fold triggers to a one-line summary (tap the name), **Fold all**, and move triggers up or down. Find Problems warns about a "Run another trigger" with no matching trigger.
  - Tap a row to edit it in place; ⋮ moves, duplicates, disables or deletes it.
  - **Templates** add ready-made triggers: tap to score, touch to collect, door opens with a key, hazard hurts, spawn every 2s, win at 100, double tap for a super jump, hold to charge, all enemies gone → win, a treasure chest with a rare drop, a clicker with a cooldown, blink 3 times, random spawns, save coins when the player leaves, talk to an NPC.
- **My Instructions and My Conditions** (the *Mine* button in the Triggers or State Machine editor, or *New instruction…* / *New condition…* at the bottom of the picker):
  - Build your own instruction from other instructions (with waits), or your own condition from other conditions (all or any must be true).
  - Give them **inputs** (number or text, each with a default). Type `@amount` into any field of the steps to use an input, or `{@amount}` inside text.
  - **Easy ways to make one:**
    - **Save as My Instruction** / **Save as My Condition** (next to DO and IF) bundles a trigger's steps or checks into one reusable piece and puts it in their place. Pick which steps to bundle, or use *Make a My Instruction from this…* on any step.
    - **New instruction… / New condition…** asks for a name, then starts blank or from a ready-made one. Instructions: *Reward*, *Spend coins*, *Hurt the player*, *Celebrate*, *Respawn*, *Spawn a few*. Conditions: *Can afford*, *Low health*, *Player is near*, *None left*, *Night time*, *Has item*.
    - Tap **@** next to any value inside one to plug in an input, or to make that value a new input (its current value becomes the default). *Back to a fixed value* undoes it.
    - **How it reads in a trigger** sets the sentence shown where it is used, e.g. "Reward {@amount} coins" reads "Reward 10 coins".
  - Use them like built-in ones: they appear under *My Instructions* / *My Conditions* in the pickers, and each use fills in its own inputs. A trigger waits for a My Instruction to finish, unless you choose *Don't wait for it*.
  - Edit one from any row that uses it. You can also **Duplicate** it, **Delete** it (it tells you how many times it is used), or **Save to Library** and add it to any other game from *Mine → From your library*.
  - They belong to the whole game, so every object's triggers and state machines can use them. Visual scripts can use them too, with **Run My Instruction** and **My Condition**. Find Problems flags uses of deleted ones.
- **State Machine**:
  - The object is always in one state (Patrol, Look Around, Alert…). States are cards on a map with arrows between them.
  - Tap a state to edit what it does **when entering**, **every frame** and **when leaving**.
  - Each state also has its **transitions**: "ON event, IF conditions → go to another state". Two FSM-only events: "after N seconds in this state" and "when this state's actions finish".
  - **Any State** transitions work from every state. Drag states to arrange them; the start state has a green border.
  - The current state is in `{state}`-style data and the "State is" condition. The *Patrol Guard (FSM)* prefab is a complete example.
- **Node scripts** now have **Templates** too (★ in the Node Editor).
- **Several scripts in one Visual Script component:**
  - **Add Another Script** (blank, or one of your saved scripts, linked) puts more scripts in the same component. Each runs side by side with its own events, functions and state.
  - With more than one, the component shows a compact row per script: on/off, name, what starts it, **Open**, and ⋯ (rename, duplicate, move, make main, save as reusable, unlink, delete).
  - Each script shows up in the Scripts tab, gets its own warnings and keeps its own live-debug badges. Functions in any of them can be called from other objects.
  - *New Script on …* in the Scripts tab adds to the object's existing component instead of making another one.
- **43 new event nodes** (Events folder; each also works as a trigger event):
  - **Touch and keys:** On Finger Down (anywhere or on this object), On Drag This Object (start / dragging / dropped), On Two-Finger Tap, On Pinch (zoom in / out), On Key Released, On Any Key, On Phone Tilted, On Joystick (pushed / released), When Player Is Idle.
  - **Movement and physics:** On Hit Wall, On Hit Ceiling, On Starts / Stops Moving, On Starts Falling, On Fell Far, When Speed Goes Above, On Object Moves Away, On Sees / Loses Sight.
  - **Health:** On Healed, When Health Gets Low.
  - **Objects coming and going:** On Spawned (as a copy), On Object Spawned / Destroyed (by tag or name), When None Left, On Shown / Hidden, On Sprite Frame.
  - **Game flow:** On Paused / Resumed, On Game State (title / playing / game over / won), On New High Score, On Item Collected, On Achievement, On Any Message, On Dialogue Finished, On Cutscene (starts / ends), On Scrolled (up / down), On Save Loaded.
  - **Time and returning players:** When Level Time Reaches, At Clock Time, On First Time Ever, On New Day, On Welcome Back (hours away as Event Value).
  - **Device:** On Battery Low, On Screen Resized, On Dark Mode Changed.
  - Physics bodies now report touching a wall (`body.wall` = −1 / 1) and a ceiling (`body.ceiling`) each frame.
- **Triggers and visual scripts can do the same things:**
  - Every **visual-script node** can be used in Triggers.
    - Node events (On Touch, On Collision Enter, On Message…) are trigger events, with a choice of output when a node has several.
    - Value nodes are conditions: true/false nodes directly; number and text nodes compared with = ≠ > < ≥ ≤.
    - Action nodes are instructions. The trigger waits for the node to finish, and can *continue only if* a chosen output fires (e.g. Random Chance → yes).
    - The pickers show the usual list first, then **Show N more from visual-script nodes**. Search covers everything.
  - Every **trigger event, condition and instruction** is a node.
    - Instructions and conditions have their own **Instructions** and **Conditions** folders.
    - Trigger events are in **Events** as "When: …" (When: double-tapped, When: comes near tag…).
    - A trigger instruction node goes on from "then" once it finishes, so trigger waits work in scripts too.
- **Scripts, triggers and state machines talk to each other:**
  - **Functions across objects:** **Call Function On Object** gives back another script's Return Value (e.g. the Game Manager's `canAfford`). **Run Function On Objects** runs it on one object, everything with a tag, or everything, and can store the result. **Object Has Function** checks first.
  - **Other objects' variables:** **Get / Set Variable Of Object** (a door's `open`, an enemy's `hp`), by name, tag or *other*.
  - **Custom events go everywhere:** *Call Custom Event* (now also *on object named*, with a text or number value) reaches visual scripts and Triggers (*Run by another trigger / custom event*, with the value as `@event`). The **Run Trigger** node and the Triggers instruction *Run another trigger* reach both too.
  - **Triggers can use scripts:** *Run visual script function* (instruction) and *Visual script function result* (condition). **Run My Instruction** and **My Condition** nodes let scripts use the Triggers' reusable pieces.
  - Messages, game variables and the *State machine enters a state* event connect state machines as well.
  - Several messages in the same frame each run their trigger.

### Advanced components

| Component | What it does |
| --- | --- |
| **Health & Damage** | Max health, hurt by tags, invulnerability, knockback, regeneration, a HUD variable, and death action (destroy, game over, respawn, lose a life, message). Also armour, shields, damage types, status effects, health pickups, fall damage, a health bar over it and damage numbers (see *Health, damage and survival*) |
| **Damage Dealer** | Hurts objects with Health that it touches (weapons, bullets, spikes, lava, explosions): damage type, on touch or every few seconds while touching, critical hits, poison / burn / bleed / slow / freeze, area damage, knockback |
| **Hunger** / **Thirst** | Drain over time (faster while moving), refilled by food / drink objects, hurt or slow the player when empty, can heal Health while full |
| **Enemy AI** | Patrols, chases when it sees the target (walls block its view), attacks in range (damaging Health), gives up and returns home |
| **Pathfinding (Navigator)** | A* around walls to a tag or object, for smart chasers, pets and NPCs (2D and 3D) |
| **Joint** | Spring, rope (pendulums, swings) or rod to another object, with a drawn rope |
| **Wave Spawner** | Waves of a template with breaks, `{wave}` counter, win / message / loop when beaten |
| **Dialogue** | Conversation box with speaker names and typewriter text; tap to continue; can pause the game |
| **Day / Night Cycle** | Moves the sun, changes light and sky colours; 2D gets dark at night; `{hour}` |
| **Particle System** | Fire, smoke, rain, snow, sparkle, confetti, magic, bubbles (rain and snow fill the screen) |
| **Inventory Item** | Pick-ups go to the inventory: `{inventory}`, `{item_Key}`, "Has item" condition, "Give / use item" instruction. Picked up on touch, tap or both, random amounts, a magnet pull; it stays on the ground when the inventory is full |
| **Crafting Station** | A Workbench, Furnace or Anvil: recipes that need it work while the player is close; tapping it sends a message |
| **Loot / Chest** | Gives items, with amount ranges and chances, when tapped, touched, destroyed or on a message |
| **Resource (gather)** | Trees, rocks, ore and bushes: tap or touch to gather, several hits to break, can need a tool, extra loot, grows back |

Ready-made prefabs: Smart Enemy, Talking NPC, Inventory Key, Rain, Day & Night, Wave Spawner, Patrol Guard (FSM).

### UI snapping

- Moving or resizing UI snaps its edges and centre to other elements (edges, centres, side by side touching or with a gap), its parent and the screen, with pink guides and a gap label. The gap, strength and an on/off switch are in *Preferences › Editing*.
- **Place** buttons on the UI Element card put an element at the left / centre / right or top / middle / bottom of its page, 16 px in from the edge, or make it full width.
- **Align** (Hierarchy › Select, two or more UI elements) lines up edges or centres against the selection, the first one ticked or the page, spreads them out with even gaps or an exact gap (stack down / row across), or makes them the same width, height or size.
- **Duplicates:** two Bottom Navs or App Bars in one place, two Side Menus on one message, or copies stacked exactly on top of each other are flagged in the Hierarchy (Show / Keep one), the Inspector and Find Problems.
- **Inspector:** the component that makes an object what it is comes first (its layout folds away), the name card's details fold into one line, big components have group chips, and *One open* keeps a single card open.
- **List View:** rows with icons, a line under the title and a value on the right; sections with sticky titles; cards, plain lines or inset grouped looks; search, pick several, swipe left to delete. **Data List:** swipe right to tick, sticky group headings.
- **Resizing and nudging:** keep proportions (🔒 in Size, or Shift while dragging), snap to other elements' widths and heights and to equal spacing, and nudge with the arrow keys (Shift: 10 px).
- In play, fixed-width buttons, fields and text stay inside the screen with a 16 px gutter on narrow or tall phones instead of touching or running off the edges.

### Social app UI

- **Social Feed** with four looks (timeline, compact, photos, cards) and about 80 settings (tabs, pinned posts and labels, coloured #tags / @mentions / links, fonts, tick colours, button words, avatar rings, hold / tag / load-more messages, a “new posts” button, buttons and their order, like icon, time format, text and avatar sizes, picture shape, Show more, search, field mapping, entrance animation, messages, colours). Three of the looks: a text **timeline**, big **photo** posts (double-tap to like) and **cards** with Like / Comment / Share. Pull to refresh; posts come from a *Posts* collection.
- Feed features: **polls** with live percentages, **picture carousels** (swipe, dots, 2/3 badge) and grids, **LIVE** / video badges, **link preview cards**, “reposted by” lines, location and *Edited*, a **top comment**, **Follow** pills, **hold-to-react** (👍 ❤️ 😂 😮 😢 😡) and a **⋯ menu** (save, copy, not interested, mute, report) with Undo.
- Tap a post to open it full size. The comment button opens a **comments sheet** where you can write, like, reply to and delete comments (kept in a *Comments* collection or on the device). Share opens a **share menu** (share, copy text or link, repost, save).
- **New Post composer:** a character ring, up to 4 photos, polls, a place and drafts.
- **Quote posts** from the repost button, shown as cards in the feed and opened posts.
- **Videos** in posts.
- **More feed looks:** **Grid** (an explore grid), **Reels** (one post per screen, swipe, videos play) and **Magazine**.
- **Media:** videos play muted in feeds and GIFs animate. Post photos, GIFs (files or links) and videos, uploaded to a **Supabase Storage** media bucket when you set one.
- **Threads:** replies (`reply_to`) sit under their post with a connecting line. Write a thread in the composer (🧵), or add to one from your post's ⋯ menu.
- **Search Bar** with recent searches, trending tags, people and filters. Feeds understand `#tag`, `@person`, `has:photo/video/gif/poll/link` and multi-word searches.
- **Edit your comments** (marked *edited*), and edit posts from the opened post too.
- The **Social** template has For you / Following tabs, an Explore page (search + grid) and a Reels tab.
- **Feed tabs:**
  - the 10 Top Nav styles;
  - swipe sideways to change tab;
  - each tab keeps its scroll position;
  - new-post dots;
  - tapping the current tab scrolls back to the top.
- **Stories and the post box scroll away** as you scroll the feed, so the posts get the whole screen.
- **Messaging system:**
  - **Chat:** direct messages and group chats with bubbles, photos and big emoji. Press and hold a message to react, reply (with quotes), copy, forward, pin (a banner at the top for everyone), edit it in the bar, delete it for you or for everyone, or **Select** several to copy, star or delete; swipe a message right to reply. In the Inbox, **swipe a conversation** to mute (8 hours, a week or always), archive or delete it (left) or pin it and mark it read (right); archived chats wait in an *Archived* row. Sending… / Sent / Delivered / Seen (or Read) with the time, ✓ / grey ✓✓ / blue ✓✓ ticks and Seen by show how far each message got, pull down to refresh in the chat and the Inbox, Today / Yesterday mark the days, a ↓ button with a count jumps back to new messages, and while testing people “type” and answer. **Message yourself:** you're first in New message (and Forward), for a private chat of notes, links and photos. **End-to-end encrypted chats** (keys on each phone, a safety code in Chat info), **group chats** you can rename, add or remove people from and leave (the online rules follow the newest member list), the 🎙 on the bar records a voice message, and the Console lists missing pages and has **Copy for help** (a report of the app, device and every problem). A Chat page opened without one of your conversations lists yours (with New message) instead of a lock. **Voice messages** (tap the mic, talk, send; tap to play with a waveform), **link cards**, **Star** and *Starred messages*, message **Info** (seen by and when), **Delete for me**, **search in a chat**, a **Chat info** screen (photos, links, members, mute, wallpaper, delete chat), a **wallpaper** per chat and **@mention** notifications. Features from WhatsApp, Messenger and X: **polls** with live counts and *View votes*, **location** map cards (＋ on the bar), **one reaction per person** with *who reacted*, **disappearing messages** (24 hours, 7 days, 90 days), chat **themes** everyone sees, **block**, **message requests** (Accept / Delete / Block; no read receipt until you accept) and **Send in a message** from a post's Share menu. WhatsApp-style **times and ticks inside bubbles**, date chips, a Messenger-style **gradient**, highlighted @mentions, #hashtags and links, an **“N unread messages”** line, **drafts** per chat, **1× / 1.5× / 2×** voice playback, a **Favourites** tab and search through every message.
  - **Inbox:** search, All / Unread / Groups tabs, ✏️ new message or **new group** (pick people), pin, mute, mark unread and delete. Unread badges, and ✓✓ once they have read yours.
  - **Message @someone** from any post. Live with Supabase, with notifications for the people in the conversation.
- **Your own posts:** edit, pin and delete with Undo.
- **Discovery:** **Trending** hashtags, **Who To Follow** suggestions, and a search chip on feeds.
- **Friends, follows and notifications, all connected:**
  - a social graph (Follows / Friends / Notifications collections, online with Supabase);
  - **Add friend** (requests, Accept / Decline) and **Follow** from feeds, profiles, Who To Follow and the **Friends** page;
  - **threaded comments** (replies to replies) with **photos and GIFs**, a GIF picker (upload, paste, or search with a GIPHY / Tenor key), and **per-person reposts** shown on profiles;
  - line **icons** everywhere instead of emoji, and native touches (status bar colour, press feedback, swipe back);
  - **app pages and game pages** in one project (no pause menu on app pages), and **Standalone / Device previews** with a QR code;
  - **X / Facebook / Instagram / Threads top bars**, and a post composer with audience, who-can-reply, text-on-colour posts and an inline emoji keyboard;
  - a **Marketplace** (listings, categories, search, message the seller, sell form) and **points, streaks and achievements** like a Snap Score;
  - an inline **emoji and GIF tray** for comments and chats;
  - **views** on every post, counted once per person like X;
  - private **direct messages** and groups (only their members can see and write);
  - **bookmarks** for posts and comments (each person's own) and a **Saved** page with All / Posts / Comments tabs;
  - a **Notifications** page (grouped likes, comments, mentions, follows, friend requests and messages) with unread badges and live banners;
  - profile pages for everyone, opened by tapping their name:
    - X, Instagram or centered looks;
    - pronouns, **Follows you**, place, website and join date, and **Followed by …** people you know;
    - a story ring that plays their story;
    - **Posts / Replies / Media / Likes** tabs;
    - follower, following and friend lists;
    - a ⋯ menu to share, **mute**, **block** or report;
    - an **Edit profile** editor for your cover, picture, name, bio, pronouns, place and website, saved in a **Profiles** collection.
    - **Settings and privacy**: private account, who can message you, which notifications you get, light or dark, muted and blocked people, log out.
    - Feeds show each author's current name, picture and tick from their profile; tapping a name opens their profile page (found by itself) or a profile card.
- The **Social** template has Explore, Messages, Chat, Notifications, Friends and profile pages.
- **Shimmering placeholders** while online feeds load.
- Opened posts (as a sheet or full screen) show the whole post: swipeable pictures with a full-screen viewer and double-tap to like, polls, link cards, the full time and views, counts, Comment / Repost / Like / Save / Share buttons and a ⋯ menu. Comments have threaded replies, Top / Newest sorting, Author tags, pinned comments and quick emoji.
- **Stories** row (fold it into a slim “5 new stories” bar or hide it; people choose, and bring it back in Settings) with a full-screen viewer (a story per person with several slides, progress bars, tap / hold / swipe, seen rings, reply by message or quick emoji, ♥ likes, “Seen by” on yours) and a story maker (photo, video, GIF or words on a colour) that shares to a Stories collection and disappears after a day, **Like Button** (pop, count, hold for reactions), **Profile Header** (cover, avatar, verified tick, counts you choose, Follow / Following, category, status, link chips, story highlights, a *Finish your profile* card, picture / button shapes and sizes; the whole page scrolls with the feed under it), **New Post Box** and **Photo Grid**.
- A **Social** app template puts them all together.

### More UI pieces

- **Tooltip** (tap, long-press, always, once, or on a message) and **Popover Menu** (⋯ / avatar menus) draw above every other UI.
- **Spinner**, **Skeleton Loader**, **Chips** (single or multi-select), **Avatar** (initials and status dot), **Banner** (info / success / warning / error / tip), **Steps** and **Divider**, each with ready-made versions in *Project › UI*.

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
  - **Drag to reorder:** drop a row's grip on another row's top or bottom edge to move it above / below (same parent); on the middle to make it a child.
  - **Double-tap a row (or F2) to rename it** in place; **hold or right-click any row** for its menu; **Shift-click** a second row to tick both.
  - **Keyboard:** Ctrl/⌘ Z / Shift Z / Y, Delete, Ctrl/⌘ D, Ctrl/⌘ C / V, F2, F (focus), ↑ ↓ (move through the list), ← → (fold children), Esc.
- **Saving:** unsaved changes are kept in IndexedDB (big games too) and offered back after a crash or a closed tab; restore points are taken of unsaved work too.
- **Inspector**:
  - **Several objects ticked:** edits what they share (visible, locked, draw order, rotation, scale, shape fill / outline / corners / shadow, text size / colour / align / font / weight), with *mixed* marks, **Move all by…**, **Line up…** and turning shared components off / on.
  - **Hold or right-click a field's name:** Copy value, Paste value, Reset to default.
  - Short fields (numbers, dropdowns, colours, text) sit beside their label; component headers stay pinned while you scroll.
  - Only fields for the game's mode (2D or 3D) are shown. **Advanced** next to search shows the rarely used ones.
  - Category filters: Visual, Physics, Logic, Animation, Gameplay.
  - **Collapse all / Expand all** folds every component at once. It is in Game Settings too, and remembered, so the next object you select opens collapsed as well.
  - **Quick add** chips for common components, next to Add Component.
  - **Add Component** opens with suggestions for the selected object (e.g. Rigidbody, Health, Triggers for a player that lacks them), your recently used components, and category folders with counts (Physics, Controllers, Combat, AI, Logic…). Tap a folder to browse it, or search everything at once.
  - Components have a coloured edge by category.
  - **Odin-style fields:**
    - Settings changed from their default get a blue edge and a **↺ reset** button. The **✎ Changed only** button next to search hides everything else.
    - A dropdown with 2–4 short choices becomes **toggle buttons**.
    - Numbers whose label ends in a unit, like *(s)*, *(px)*, *(°)* or *(%)*, show it as a chip inside the field.
    - "One per line: A | B | C" settings become a **table** with a column for each part. These include Bottom Nav tabs, shop items, camera shots and side menu items. Rows have a ⋯ menu to move them up or down, duplicate or delete them. **Text** switches back to the plain box.
    - Comma lists (variables, tags, messages) become **chips**. Tap × to remove one, tap a chip to rename it, or add new ones with suggestions from your game.
    - Required fields (like a Camera Mixer's cameras) show an error while they are empty.
  - Each component's ⋯ menu has **Paste Values**, which copies another component of the same type onto this one, and **Copy as Text**.
  - **☰ → Find Problems…** checks every level, object, component and reusable script at once. Examples: missing templates, objects that don't exist, scripts with no Event node, empty Images. Tap a problem to go straight to that object.

### Node coding (Visual Script)

Add **Visual Script** from *Add Component → Logic*, from *Create → Visual Script*, or from the Getting started list, then tap **Open Node Editor**.

The **Scripts** tab (between Inspector and Project) lists every Visual Script in the game:
- Each card shows the object, a mini map of its nodes, which events start it and how many nodes it has.
- Tap a card to open it in the Node Editor. Scripts on other levels are listed under their level; opening one switches to that level.
- ⋮ shows the object in the Inspector, saves the script for reuse (or unlinks it), turns it off or on, or removes it.
- **New Visual Script** adds one to the selected object, starting **blank** or from a small working **example** (tap to score). Add Node lists **Common actions** first and each node name once. Inspector sizes can't go negative (Font Size at least 1), renaming updates the breadcrumb, and Undo is one step per field. Browsers without 3D (WebGL off) get a clear message instead of a broken editor when adding or opening a 3D level. The built-in screens' buttons and the Pause / Sound buttons work with screen readers and the keyboard. Node Editor: drag a wire into empty space for a picker of nodes that fit (wired for you), insert a node on a wire, What Does This Do? on any node, and a Variables list with rename. Field edits in the Node Editor are undoable step by step, number fields flag what isn't a number, and Find Problems lists script nodes that never run. New objects from Create land in a free spot instead of on top of the Player. With more than a few scripts, search by object, event or node name.
- **Saved scripts** lists your reusable scripts with how often each is used; **Add** puts one on the selected object.

The editor fills the screen:

- **Add Node** opens like Add Component: a search box, **Suggested next** (nodes that usually follow the selected one, or events to start with), **Recently used**, and a folder per category with how many nodes it holds. Tap a folder to open it, ‹ to go back:
  - **Events** (green): On Start, On Tap, On Touch / Touch End, Every N Seconds, Every Frame, On Button, On Swipe, On Destroyed, On Message, **On Variable Changed**, **On Damaged**, **On Death**, **While Touching Screen**, **On Finger Lifted**, **On Win**, **On Game Over**, **On State Entered**.
  - **Math, more:** **Formula** (type any math with up to four inputs a–d and game variables: `a * 2 + b`, `sqrt(a^2 + b^2)`, `score / 10`, `max(a, lives)`; + − × ÷ % ^, comparisons, and sin cos tan asin acos atan atan2 abs floor ceil round sqrt pow min max clamp lerp sign log exp mod random; no code is run, a typo just gives 0 and a Console warning), **Random Between** (with inputs, whole numbers or not), **Random Pick**, **Smooth Noise** (drifting random for wobbles and flicker), **Inverse Lerp**, **Move Towards Value**, **Angle Difference**, **Wrap Around**, **Round To Decimals**, **Percent Of**, **Ease Curve** (any easing), **Vector Length**, **Distance / Angle between points**, **Min / Max / Average / Sum**, **Is Between**, **Is Even**; **Math (one value)** adds tan, square, cube root, reciprocal, fraction, log and exp.
  - **Game, more:** **Add Score** (with a "+10" pop-up), **Lose a Life** (*no lives left* → game over if you like), **Gain a Life** (up to a maximum), **Check Best Score** (*new best* saves it), **Add / Set Time**, **Restart Level**, **Set Checkpoint** + **Respawn Player**, **Use Item** (*used* / *not enough*) and **Has Item**, **Add Combo** (`{combo}` resets after a pause), **Unlock Achievement** (once per device, with a 🏆 message; *first time* / *already*) and **Is Unlocked**, **Hit Stop** (a freeze-frame on big hits), **Set Game Speed**, **Say** (a dialogue box with a *closed* output), **Game Value** (score, lives, best, time left, combo, level, levels) and **Game State Is**.
  - **Variables** (gold): **Set / Add To My Variable** and **My Variable** (each object keeps its own, so every enemy has its own hp; text on the object shows it with `{hp}`), **Set Other's Variable / Other's Variable**, **Variable Of Object**, and **When Variable Reaches** (runs once when, say, score ≥ 100).
  - **Variables, more:** **Change Variable** (set, add, subtract, multiply, divide, min, max, power or mod; for the game, this object, or *other*), **Clamp Variable**, **Copy Variable**, **Toggle My Variable**, **Reset Variables** (back to their starting values), **Set Text Variable** (words, with `{braces}`) and **Text Variable Is** (equals / contains / starts with / empty), **Save / Load / Forget Variable** on the device (coins, settings, unlocked levels; *loaded* / *not saved yet*), and per-object events **On My Variable Changed** and **When My Variable Reaches** (hp ≤ 0 → die).
  - **Arrays and dictionaries** (brown, in Lists):
    - **Arrays** hold words or numbers (`"12"` is stored as a number). **Add Item**, **Insert At**, **Item At (text)** (−1 = last), **Array As Text** (with a separator), **Text To Array** (`a, b, c` → 3 items), **Count Of**, **Copy Part**, **Join Two**, **Remove Duplicates**, **Keep Only** (=, ≠, >, <, contains, starts with; into the same or another array), **Change Every Item** (add, multiply, round, abs, UPPER, lower, text before / after), **Swap Two**, **Position Of Biggest / Smallest**, **Loop Item (text)**. All the List nodes work on arrays too.
    - **Dictionaries** (key → value, like `hp: 100, xp: 5`): **Set**, **Get** (text) / **Get Number**, **Add To** (counts per key), **Has Key**, **Remove**, **Clear**, **Size**, **Keys To Array**, **For Each** (with **Loop Key** and Loop Item). Text shows a dictionary as `hp: 100, xp: 5`.
  - **Loops:** **While** (repeats while a condition is true) and **Repeat Until**, both with a safety limit; **Break** stops any loop (Repeat, For Range, For Each, While, Dictionary For Each, For Each In Layer / Radius) and **Next Round** skips the rest of a round. **Switch On Text** picks one of up to 5 ways by text (or *other*).
  - **Events and delegates:** **Send Message With Value** (a number or text), and **On Message** now passes it on: read it with **Event Value** or **Event Value (text)**. **Wait For Message** pauses a script until a message arrives (or a timeout). **Set Delegate** stores which Function to run in a variable and **Call Delegate** (step or value) runs it, so behaviour can be swapped without rewiring. **Listen: Message → Function** subscribes a Function to a message (and *stop listening* unsubscribes). **Function Exists**.
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
  - **App & device** (new):
    - **Events:** **On App Hidden** (the player switched apps or locked the phone) and **On App Back**, **On Phone Notification Tapped** (any, or one id), **On Side Menu Opened / Closed**, **On Screen Turned** (*portrait* / *landscape*), **On Connection Changed** (*online* / *offline*).
    - **Steps:** **Haptic Feedback** (light, medium, heavy, success, warning, error), **Open / Close Side Menu**, **Show / Hide Nav Bars** (slides the Bottom Nav and App Bar away, e.g. during a level), **Vibrate Pattern** (`80, 60, 80`), **App Icon Badge** (the number on the Home Screen icon of an installed web app; 0 clears it), **Full Screen**, **Keep Screen On**.
    - **Flow:** **Every Nth Time** (*then* every 3rd time, *skip* otherwise: tips, ads, bonuses) and **First Time Ever** (once per device: tutorials, welcome messages).
    - **Values:** **Side Menu Is Open**, **Battery Level** (0–100), **Phone Language** (`en`, or `en-GB`), **Notifications Allowed**.
- ★ Templates include Chase the player, Tap 5 times → win, Spawn a ring of 8, Hit → blink + hurt animation, Run / idle by speed, Collect: hop, fade, remove, and Tap → score counts up.
- **Reusable scripts.** The 💾 button (or *Save as Reusable Script* on the component) names and saves the graph. Add it to any other object from **Add Component → My Scripts**. Copies stay **linked**: edit any of them and every copy updates (the component shows the script's name and how many objects use it; ⋮ → *Unlink* to change one copy on its own, or *Rename*). Saved scripts are also kept on your device, so **My Scripts** and ★ list the ones from your other games too.
- **Live debug:** after you Play, each node shows how often it ran (**×12**) and value nodes show their last value (**= 3.5**); nodes that never ran are faded, so you can see at a glance which part of a script didn't happen.
- **Copy / paste:** ⋮ → *Copy* (one node) or *Copy From Here* (the node, everything it leads to and the values feeding them); paste from the top of **Add Node**, in this script, another object's, or another game. Pasted nodes go below the others.
- **Turn Off** (⋮): skip a node without deleting it (the script passes straight through), handy for testing. **Comment** nodes are yellow sticky notes.
- More ★ templates: *Enemy with its own HP (3 hits)*, *Custom event: explode on call*, *Wave: 5 enemies, one every 0.8 s*, *Daily reward with streak*, *Countdown: 30 seconds to win*, *Enemy AI: wander, chase when near*, *Keyboard: arrows move, Space jumps*, *Name tag: “Hero the 3rd”*, *UI: ask the player's name*, *UI: Restart button asks first*, *UI: menu button opens a panel* and *UI: shop badge counts new items*.
- If a node is selected, the new node is **wired to it automatically** and placed next to it, so a script grows as a chain without touching a wire.
- **Wire** two nodes by tapping a dot and then a glowing dot (or drag from dot to dot). White diamonds set the order things happen in; round dots carry numbers (blue) and true/false (orange). An input with no wire uses the value typed on the node.
- Tap a wired input dot to unplug it, or tap a wire to delete it. ⋮ on a node duplicates it, removes its wires or deletes it.
- Drag nodes to move them, drag empty space to pan, pinch to zoom. **Done** or the back gesture closes the editor.
- **Top bar:** **Undo** and **Redo** (moving nodes can be undone too), **🔍 Find a node** (search this script by name, category, help or the values typed in; tap a result to jump to it), and **⋮ More**:
  - **Select Several:** tap nodes to pick them, or drag a box around them. The bar at the bottom copies, duplicates (with their wires), turns on / off or deletes them; drag any picked node to move them all.
  - **Tidy Up:** lays the script out in the order it runs, left to right, one row per event, with value nodes under the node they feed. Notes go in a column on the left. Nothing overlaps afterwards.
  - **Check for Problems:** finds nodes that never run (nothing wired into their white dot), events with nothing after them, values that aren't used, nodes turned off, and wires from removed nodes. They get an orange outline and a note, and the list jumps to each one.
  - **Collapse All / Expand All**, **Fit All Nodes**, **Ready-made Scripts** and **Save / Reuse Script**. ⋮ on a node can also **Collapse** just that node (it keeps its wired dots and shows its values in one line).
- **Keyboard** (tablets and computers): Ctrl/⌘ Z undo, Shift Z or Y redo, F find, C / V copy and paste, A select all, Delete removes the selection, Esc cancels.

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

- **Rapier physics (WebAssembly):** *Game Settings › Physics › Physics engine › Rapier* runs a level on the Rapier engine (Rust compiled to WebAssembly) for realistic stacking, tipping and rolling (**Rigidbody › Rolls & tips over**). Layers, triggers, one-way platforms, grounded checks and collision events all keep working; exports embed it, and the built-in physics takes over if it can't load. See the physics guide.

- **Every landing counts, even quick bounces.** The physics now records every time a body lands during a frame. A bouncy body that hits the ground and leaves again between two frames still fires **On Landed**, the Triggers event **Lands on the ground** and a Camera Impulse set to *it lands*. The hit speed is the Event Value. Bodies settling slowly don't count as new landings.

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

### More lighting and camera tools

- **Light types:** a light is a **Point** light (shines all round) or a **Spotlight** (a cone with a width you set). Aim a 2D spotlight with *Aim* (0 = right, 90 = down) plus the object's rotation; in 3D, *Aim down* tilts it and turning the object points it.
- **Light effects:** Steady, **Pulse**, **Blink**, **Fire** (a flickering warm torch) and **Rainbow**, each with an effect speed.
- **2D soft light and shadows:** *Softness* sets how gently a 2D light fades at its edge. **Casts shadows** makes solid objects (anything with a body) block the light, so walls throw dark shadows behind them.
- **Lighting Presets** (Game Settings): one tap for Day, Golden hour, Evening, Night, Overcast, Cave, Spooky, Underwater or Neon. They set brightness, colours, ambient light, sky and background together, on the Global Light 2D / Directional Light object if there is one.
- **Create → Camera & lights:** new **Spotlight** (2D and 3D) and **Torch (fire light)** objects.
- **Camera Controls** (component, on a camera): lets players **drag to pan**, **pinch** (or use the mouse wheel) to zoom, flick to glide and **double-tap** to go back. It has zoom limits and a pan limit, and ignores fingers that start on tappable objects. Use it for maps, strategy, idle and building games.
- **New nodes:**
  - **Camera:** **Focus Camera On** (zooms on an object for some seconds, then *back*), **Zoom Punch** (a quick zoom in and out for hits and pickups), **Take Photo** (a picture of the game with its UI, which you can share, save to the device or keep in a variable).
  - **Looks:** **Fade Light** (to a brightness, range and colour), **Set Light Effect**, **Set Darkness / Ambient** (2D, it now fades), **Set Sun (3D)**, **Lighting Preset** (fades the whole level to a mood, with *done*).
  - **Values:** **Light Brightness**.
- **From code:** `engine.takePhoto()` returns a PNG data URL. `LIGHT_PRESETS` is exported.

### Health, damage and survival

- **Health & Damage** has new settings, in folders:
  - **Defence:**
    - **armour** (taken off every hit);
    - **damage reduction %**;
    - **damage types ×**, e.g. `fire 0.5, poison 0, ice 2` (0 = immune);
    - a **shield** that soaks up hits first and refills;
    - **can't be hurt**;
    - **keeps hurting while touching**: after the invulnerable time, standing on an enemy or in lava hurts again.
  - **Healing:**
    - heal per second, with a **wait after a hit**;
    - **health pickups** by tag (`medkit`) and the amount each gives;
    - **fall damage** when landing faster than a speed.
  - **Look & sound:**
    - a **health bar over it** (never, when hurt, always), with the shield as a blue strip;
    - **damage numbers** (CRIT in pink, shield hits in blue, poison in green);
    - hit sound, camera shake;
    - death effect: burst, fade out, both or none.
  - **When health reaches 0** can also **lose a life**: it takes one from `lives` and respawns, and it's game over when none are left.
- **Status effects:** **poison**, **burn**, **bleed** (damage every half second), **heal over time**, **slow** and **freeze** (slow the object's movement). Each lasts some seconds. An object immune to a damage type can't get that effect.
- **Damage Dealer** (component): put it on swords, bullets, spikes, lava, bombs. You can set:
  - which tags it hurts and how much;
  - the **damage type**;
  - whether it hurts **when it touches** or **every few seconds while touching**;
  - a cooldown per target and knockback;
  - an effect it **also gives**;
  - **critical hits** (chance and ×), **area damage** (explosions, weaker at the edge);
  - going **through armour**, destroying targets without Health, **destroying itself after a hit** (bullets) and points per hit.
- **Hunger** and **Thirst** (components). You can set:
  - how fast each drains, and how much **faster while moving**;
  - the **food / drink** tags or names, how much each one gives, and **different amounts** by name (`apple 15, steak 60`);
  - a variable for your HUD (`hunger`, `thirst`);
  - a **low** level, with a message (`hungry`, `thirsty`);
  - what happens when it runs out: hurts health, slows down, both, game over or nothing;
  - **heals health while above** a % (well-fed players heal);
  - a bar over the object.
- **Create → Gameplay** has **Survivor** (a player with Health, Hunger and Thirst), **Apple (food)**, **Water (drink)**, **Medkit**, **Spikes**, **Fire** (burns, with a flickering light) and **Poison Pool**, in 2D and 3D. **UI → Hunger Bar** and **Thirst Bar** go under the Health Bar.
- **Triggers:**
  - **Events:** *Takes damage* (by damage type), *Gets healed*, *Shield breaks*, *Gets poisoned / burnt / slowed…*, *Gets hungry / thirsty*, *Starving / out of water*, *Eats or drinks*.
  - **Conditions:** *Hunger / thirst*, *Has status effect*, *Shield left*.
  - **Instructions:** *Damage / heal* (with damage type and "goes through armour"), *Poison / burn / slow…*, *Cure status effects*, *Refill / revive / max health* (also add shield, kill), *Make invulnerable*, *Eat / drink*.
  - All of these are nodes too.
- **Nodes:** **On Damaged** filters by damage type; its Event Value is how much, and "other" is who hurt it. The value node **Health / Hunger / Thirst** reads health, max, %, shield, hunger or thirst of any object.
- **Hazards** set to *damage* now take health from a player that has Health, instead of a life.
- **From code:** `health.damage(n, target, from, { type, crit, pierce, knockback })` returns the damage done. Health also has `heal`, `addShield`, `setMax`, `addEffect(name, perSecond, seconds)`, `cure`, `kill` and `respawn`. Hunger and Thirst have `add` and `set`. `STATUS_FX` is exported.

### Inventory, items and crafting

- **Game Settings › Items:** the list of every item in your game. Each item has:
  - a name and an icon (emoji or `art:` sprite);
  - a **type**: Material, Food, Drink, Potion, Weapon, Armour, Tool, Ammo, Key, Quest item or Other;
  - a **rarity** (common, uncommon, rare, epic, legendary), which colours its slot frame;
  - **how many stack in one slot**, a value and a description.
- **What using an item does** (food, drinks, potions): fill hunger or thirst, heal, add a shield, cure an effect, give an effect (e.g. heal over time), or send a message. Food, drinks and potions are used up; keys and materials stay. You can change this per item.
- **Equipment** (weapons, armour, tools): each piece goes in a **slot** (hand, offhand, head, body, legs, feet, neck, ring) and adds:
  - **damage** to the player's Damage Dealer;
  - **armour** to their Health;
  - **speed ×** to their movement.

  Using an item that can be equipped puts it on. The one already in that slot goes back into the inventory.
- **Starter items** adds 25 ready-made items: wood, stone, iron, food, water, potions, swords, tools, armour and keys.
- **Game Settings › Recipes:** what each recipe makes and how many, what it **needs** (`Wood 3, Stick 1`; mark tools that aren't used up with `(keep)`), and settings for:
  - a **station** (Workbench, Furnace…);
  - a crafting **time**;
  - a category;
  - **must be learned first** (use the *Learn recipe* instruction).

  In the recipe editor, tap any item to add it as an ingredient. **Starter recipes** adds 12 recipes.
- **Game Settings › Inventory:**
  - **slots** (0 = unlimited): each stack takes one slot, and picking up more than fits shows "Inventory full";
  - a default stack size;
  - **keep the inventory between levels**.

  Level changes, save slots and auto-save keep the inventory, the equipment and the recipes you've learned.
- **Create → Gameplay** has Workbench, Furnace, Tree, Rock, Iron Rock (needs a Pickaxe), Berry Bush, Treasure Chest, Breakable Crate (drops loot) and Item Pick-up, in 2D and 3D. If your game has no items yet, adding one of these also adds the starter items and recipes.
- **UI → Game Systems:** Inventory Grid, **Backpack (with info)**, **Hotbar**, **Equipment** and **Crafting Panel**.
- **Triggers:**
  - **Events:** *Crafts an item*, *Uses an item*, *Equips / takes off*, *Inventory is full*, *Learns a recipe*, *Gathered*.
  - **Conditions:** *Can craft*, *Has equipped*, *Inventory space*, *Has item of type*, *Knows recipe*.
  - **Instructions:** *Use item*, *Equip / take off*, *Craft*, *Learn recipe*, *Drop item*, *Give random loot*, *Inventory: sort / clear / slots*.
  - All of these are nodes too, and there's an **Inventory Info** value node: free or used slots, items of a type, equipped damage or armour, crafting progress.
- **From code:**
  - Inventory: `scene.addItem(name, n)` returns how many fit. Also `useItem`, `equip`, `unequip`, `equipStat('damage')`, `itemStacks(type)`, `sortInventory('type')`, `dropNear(name, n)`.
  - Crafting: `craft(item, times)`, `canCraft`, `craftMissing`, `learnRecipe`.
  - Item names match whatever their capitalisation.

### Quests and dialogue

- **NPC (talk & quests)** component: tap someone when close (or walk up, touch them, or send a message) to talk.
  - It shows **!** when it has a quest for you, **?** when one is ready to hand in, and 💬 when you're close.
  - It has a portrait, its own name, and an option to pause the game while talking.
  - A quest giver with no dialogue offers its quests by itself (Accept / Not now), reminds you, and thanks you when you hand them in.
- **Game Settings › Dialogues:** conversations written as simple scripts:
  - `Name: text` lines (with `{variables}`) and narration;
  - `* choice -> section` buttons, with `[if has Key]` and `(once)`;
  - `# sections`, `-> jumps`, `-> END`, and `? condition -> section`;
  - `@give / @take / @set / @add / @quest start|complete|fail|progress / @send / @sound / @learn / @end`.

  Conditions can check items, quest states, variables, `first`, `chance 30`, `not`, `and` and `or`. The editor checks the script as you type, has buttons that insert each kind of line, and a **Preview** that plays the dialogue with pretend items and finished quests.
- **Game Settings › Quests:** each quest has:
  - an icon, a description and a **giver**;
  - what it **unlocks after**;
  - **objectives**: `collect Wood 5 (take)`, `kill slime 3`, `talk Villager`, `reach Old Well`, `craft`, `use`, `gather`, `var coins >= 100`, `message`, `quest`, or a custom step, in any order or one after another;
  - **rewards**: variables, items, recipes, a follow-up quest, a message;
  - whether you **hand it in** to the giver or it completes right away;
  - whether it **starts by itself** or **can be done again**;
  - and what the giver says.

  The editor shows objective and reward chips and warns about names that don't exist. **Starter story** adds three quests and three dialogues.
- **Quest Tracker** (the tracked quest or all active ones, with progress) and **Quest Journal** (details, objectives, rewards, Track; also as a popup) in *UI → Game Systems*.
- **Create → Gameplay → Story:** Quest Giver, Villager, Shopkeeper, Signpost and Quest Spot (2D and 3D). The first one also adds the starter story.
- A notification shows when a quest starts, is ready and completes. The variables `questsDone`, `questsActive` and `trackedQuest` follow along. Quests and conversations carry to the next level and are kept by saves.
- **Triggers and nodes:**
  - **Events:** quest starts, progresses, is ready or completes, quest fails, dialogue starts or ends, dialogue choice picked.
  - **Conditions:** *Quest state*, *Story check*.
  - **Instructions:** start, complete, fail, advance, reset or track a quest; *Start dialogue*, optionally at a section, waiting until it ends.
  - The **Quest Info** value node.
- **From code:** `scene.startQuest`, `questState`, `questObjectives`, `advanceQuest`, `completeQuest`, `failQuest`, `resetQuest`, `startDialogue(name, { npc, start })`, and events such as `questComplete` and `dialogueChoice`. See the [Quests and dialogue guide](docs/guide/quests-dialogue.md).

### Apps (not just games)

- **New Game or App › Apps:** Blank App, To-Do List, Notes, Expense Tracker and Arcade. Each one is a working app with pages, an app bar, lists, forms, search and saving.
- **Text:** rich-text tags (`<b>`, `<color=…>`, `<size=…>`, `<mark=…>`, `<icon=star>`), auto size to fit its box, wrap to its box, a line limit with "…", typewriter reveal, numbers that count up, gradient direction, shadow offset and a bordered label box.
- **Panels (windows):** a header with a title and ✕, drag to move, fold, resize from the corner, grow to fit, frosted glass, and per-corner rounding.
- **Bottom bar tabs:** each tab is a card with an icon grid, a label and a page list; *Add Tab* adds a page you have or a new one (made for you, with a fitting icon), and New Page offers to add its tab.
- **Bottom bar:** swipe between tabs, tap the current tab to scroll to the top, reopen on the last tab, press-and-hold messages, a selected icon and colour per tab, label weight and capitals.
- **Pages:** hide the bottom bar, open only when a variable is set (else go to a sign-in page), pull to refresh, a first-open message, scroll to top on a message, transition speed. They also scroll when taller than the screen, remember their scroll, send messages when they open and close, and New / Duplicate / Rename / Delete in the editor's page button.
- **Social nodes** in visual scripting:
  - actions: Follow Someone, Friend Request, Mute / Block, Open Profile, Change My Profile, Open Edit Profile, Create Post, Open Post Composer, Send Direct Message, Save Post, Send Notification, Mark Notifications Read, Award Points, Watch Their Story;
  - values: Social Check, Social Count, Profile Field, My Points, Has Achievement, Post Is Saved, Who;
  - events: On Follow, On New Friend, On New Notification, On Posted, On Profile Saved, On Achievement Unlocked.
- **Page templates:** **+ Add › Page Templates**, **Add to page › Templates** (adds one to the page you're on) or **New Page…** opens a gallery of 26 ready-made pages, built in your theme and lined up for you. Start: Welcome, Coming Soon, Dashboard. Account: Sign In, Create Account (logo, “or” line, Google button, an error line that only shows when sign-in fails), Settings, My Profile, Account. Social: Feed, Explore, Messages, Chat, Notifications, Friends. Shop: Marketplace, Product, Game Shop, Pricing. Info: About, FAQ, Contact, List. Game: Main Menu, Levels, Leaderboard, Achievements. Or start from a blank page.
- **Adding to pages:** the Page card lists what's on the page, top to bottom, with ↑ ↓ to reorder, Duplicate, Add under it and Delete. **Add to page** (also the UI editor's **+ Add** while a page is shown) has ready blocks in the app's theme colours: Heading, Text, Button, Outline Button, Menu Row (›), Card, Two Numbers, Two Buttons, Switch Row, Text Box, Search Bar, Picture, Divider, Data List, Space and Small Print. The picker sorts them into groups: **Social** (Profile Header, Post, Stories Row, Chat Bubbles, Comment Box, Person Row, Notification Row), **Game menu** (Game Title, Big Play Button, Menu Buttons, Level Grid, Coins & Gems, Leaderboard, Shop Item, Progress Bar) and **Forms & settings** (Slider Row, Segmented Tabs). Each goes under the last one, or under the one selected (what's below moves down). A button or row asks which page it opens, or makes a new one. Any other UI added while a page is shown goes on that page too. **Line up** spaces everything evenly, and a page turns on scrolling by itself once its content no longer fits.
- **UI rows:** give a UI element a `row` gap and its full-width children share its width side by side (two tiles, two buttons), on any screen size.
- **Editing apps:** the Scene and the UI editor show one page at a time (the home page first; picking something on another page switches to it), with the lists, forms and search bars drawn as they look in the app. The UI editor lays the app out at its real screen size, fitted to your screen, with **+ Add** in the bar above it.
- **Sharp and lined up:** UI and app screens are drawn at the phone's full sharpness (up to 3×), even when the game world is drawn at lower quality. Templates share one 16 px edge margin. Search text starts after the magnifier, and text that doesn't fit ends in "…" instead of being squeezed.
- **App mode** (*Game Settings › App*): opens straight on its first page, with no title screen and no pause, sound or share buttons. App projects get an **App** badge and their own filter on the home screen.
- **Data collections** (*Game Settings › Data*):
  - records with fields: text, long text, number, money, yes/no, date, choice, stars and icon;
  - starting records, and ready-made collections (Tasks, Notes, Contacts, Expenses, Products);
  - everything people add, change and delete is saved on their phone, and *Clear saved records* lets you test from the start.
- **Data List:** rows with a title, a second line, an icon, a value on the right and a checkbox.
  - Search, filter (`done = no`), sort (`amount (high-low)`) and headings by field (Today, Yesterday…).
  - Tap a row to open its page, with its fields in `{record_title}`…
  - Swipe left to delete, and it scrolls with a flick.
- **Record Form:** one input per field, with the phone keyboard right on the field, date pickers, switches, choice buttons and stars.
  - Required fields, then add, or edit the opened record (with Delete).
  - Then go back, clear the form or go to a page.
- **Data Summary:** count, sum, average, min or max of a field into a variable (`{total_text}` for money).
- **Buttons:** new record, edit opened record, delete opened record.
- **Triggers and nodes:**
  - **Events:** record added, changed, deleted or opened.
  - **Conditions:** number of records, a record is open.
  - **Instructions:** add, change, delete or open a record, clear a collection, and data summary into a variable.
  - The **Data Value** node.
- **UI & Menus › App:** Data List, Checklist, Record Form, Search Bar, Add Button (+), Edit and Delete Buttons, Record Text, Total / Count Text, App Page, App Bar (light) and Spring Sheet.
- Stretched UI can have its own top and bottom margins.
- **From code:** `engine.data.add / rows / query / update / remove / stat / reset`.
- **Games inside apps:** apps and games live in one project.
  - *Levels › Add a Game to This App* copies one of your games, or a game type, in as new levels, with a Play button. In an app the Levels menu is split into **App** (its pages) and **Games inside**, and the level button says *App* or the game's name.
  - **Play Game** opens a game. It keeps its own title, pause and end screens, with **‹ Back to app** (the back gesture works too).
  - Back in the app: `{lastGame}`, `{lastScore}`, `{lastResult}`, `{best_<game>}`, and the *Back from a game* event (node: **On Back From a Game**, with won / lost / quit outputs).
  - **Variables shared with games** (*Game Settings › App*, e.g. `coins, name` or `*`): a game starts with the app's values and gives them back changed when it ends, so coins won in a game are in the app. Data collections are always shared.
  - **Visual scripts in apps:** the same Node Editor. New scripts go on an *App Logic* object, and an **App** folder (first in apps) gathers pages, menus, data and game nodes: *Play Game*, *Back to App*, *Opened From an App*.
  - **27 more App nodes:** *For Each Record*, *Find Record*, *Record Field*, *Set Record Field*, *Toggle Yes / No Field*, *Change / Delete Records Where*, *Records To Array*, *On Data Changed*; *Current Page*, *Go To Page With Value*; *Text Is Valid*, *Clear Form Fields*; dates (*Now / Today*, *Date As Text* incl. "3 min ago", *Date Plus*, *Time Between Dates*, *Text To Date*) and *Money As Text*; *Set Dark Mode*, *Show / Hide Loading*, *Call / Email / Text / Map*, *App Info*.
  - *Record every game played* fills a collection (game, score, result, date) for score tables.
  - New **Arcade** app type: three games, best scores, and a score list.
- Data Lists, Record Forms and Data Summaries work in games too.
- **Publishing:** Build Settings makes a play file, a website, an **itch.io** upload (index.html at the root, a cover image and the page settings: viewport, Mobile friendly, fullscreen, butler command), an App Store & Google Play project (Codemagic) an **Expo** project (EAS submit settings, Apple privacy manifest, an icon without transparency, optional manual build numbers), or a plain **Xcode** project (SwiftUI + WKWebView, iOS 15+) or **Android Studio** project (Java + WebView, Android 8+, API 36) with notifications, haptics and permissions built in, to build and upload yourself. Store builds include a **store listing kit**, with screenshots taken from the Play bar's camera, captioned and sized for the App Store (iPhone 6.9", iPad 13") and Google Play, and release notes: App Store and Play icons, the Play feature graphic, LISTING.md with the stores' limits and the App Privacy / Data safety answers for what the game uses, and a starter privacy policy. See the [publishing guide](docs/guide/publishing.md).
- **Settings windows:** **Project Settings** (☰, or the button in Game Settings) puts the game's details (name, version, author, description, category, saved or not) and every Game Settings section in one window, sorted by category chips, with search. Build Settings and Preferences have **folding sections** with summaries, search and Expand / Collapse all; open sections are remembered.
- **Plugins and mods** (*Game Settings › Plugins & Mods*): plugins are JavaScript saved with the game that add components, Triggers instructions and conditions, nodes (in a Plugins folder) and hooks, in the editor and in builds (new, from a file or link, My Plugins, export). Players can add **mods** from a Mods screen when you allow it: data patches (variables, settings, change / add / remove objects, new levels, items, quests), and code mods only if you allow code. Make a mod template, test a mod in Play. See the [plugins and mods guide](docs/guide/plugins-mods.md).
- **Supabase for apps** (*Game Settings › Supabase*): your app's own accounts and online data.
  - **Set up social app (one click):** accounts with a unique username, sign-in and sign-up pages, every social collection online and live, a media bucket, and one SQL script that makes it all safe for many people: each person can only post as themselves, likes / reposts / poll votes count each person once (and an edit keeps them), messages and notifications are private to the people in them, only the person a friend request is for can accept it, one profile per username.
  - Sign up, sign in, password reset and Google / Apple sign-in, with a ready **Sign-in Page** and **Account Page**, an optional "must sign in" page, `{userName}`, `{userEmail}`, `{signedIn}` and `{authError}`.
  - Data collections can be **stored online**: private to each person, or shared with everyone (feeds, chats, reviews). **Copy setup SQL** makes the table and its security rules; Data Lists and Forms work unchanged, with auto-refresh for chats and an author field filled in.
  - Buttons (*sign in*, *create account*, *sign out*…), Online nodes and Triggers.
  - **Connect Supabase:** a step-by-step check of the project URL and key, a list of your tables with **Use in app**, ✓ / ✗ for each online collection's table, and the setup SQL.
  - **Your own tables:** collections can read and write tables you already have, column by column. They have a key column, sort, filters and *Make fields from the table*.
  - **Live updates** with Supabase Realtime: changes show up on every phone straight away.
  - **Custom accounts:** your own account fields (username, birthday, role, newsletter…; text, number, date, yes / no, choice, picture), with required and unique checks.
    - `{user_…}` variables, and generated **sign-up** and **edit-profile** pages.
    - Save-profile, change-password, change-email and open-profile buttons and nodes.
    - An optional **profiles table** (public or private) with its SQL and a Profiles collection for people lists.
  - **Database functions and Edge Functions** from nodes and Triggers, with the answer in variables.
- See the [Making apps guide](docs/guide/apps.md).

### UI motion, light and dark mode

- **Springs:** `scene.spring(obj, props, { feel: 'bouncy' })` and the eases `springGentle`, `springBouncy` and `springSnappy`.
- **Buttons** squash and spring back with an ink ripple (*Feel*: spring, squash, jelly or none).
- **Page transitions:** push (iOS), shared axis, fade through, spring pop and sheet. *Stagger* brings a page's children in one after another.
- **Data Lists:** rows stagger in and glide when the order changes, with a press highlight, rubber-band ends, a fading scroll bar, ticks that pop, and swipe-delete with an **Undo snackbar**.
- **Record Forms:** fields come in one by one; focus glow, sliding switches and choices, stars that fill, and a shake for a missing field.
- **Spring Sheet:** a Bottom Sheet that springs up, with a drag handle, half and full stops, and flick to close.
- **Theme colours** (`@bg`, `@card`, `@text`, `@accent`…) follow **light and dark mode**. The **@** button in every colour box picks one. *Game Settings › Theme & Dark Mode* chooses light, dark or follow the phone, and the accent colour.
- The message `dark mode toggle` (or the variable `darkMode`) switches it while the app runs, and the phone remembers the choice. Every app template has a light / dark button in the App Bar (a moon, or a sun in dark mode). The App Bar's **Right buttons** editor picks which buttons show (notifications, search, messages, light / dark, your picture, new post, settings, side menu or your own), their badges and the pages they show on.
- *Game Settings › Motion:* animation speed and **Reduce motion** (follows the phone's setting by default).
- **Snackbars:** the *Show snackbar* instruction, or `scene.snackbar(text, 'Undo', fn)`.

### Game screens and HUD

- **Title screen:** the title springs in and floats, with your best score and a **Play** button.
- **Pause:** a card with **Resume**, **Restart**, **Sound on / off** (and *Back to app* in a game inside an app); ⚙ Settings sits under it.
- **Game over / You win / Level complete:** a card with the score counting up, a **NEW BEST!** badge, **Play again** or **Next level**, Share and Back to app. Wins, finished levels and new bests throw confetti.
- Tapping anywhere outside the buttons still starts, resumes or plays again.
- Messages, the dialogue box (its choices slide in one by one) and the *LEVEL 2* banner animate in and follow the UI Theme. Messages no longer show through the pause and end screens.
- Touch buttons dip and light up while held; pause, sound and D-pad buttons draw their own icons.
- A text showing a variable (`{score}`) pops when the value changes (*Pop when the value changes* in the Text card).
- **Apps:** search bars with a magnifier and a clear ✕, *No results* and empty-list states, and app bars that get a shadow once you scroll.
- **Home screen:** the open game big at the top with a picture, *Play* and *Keep editing*; a **Games | Apps** switch that splits the rest into two sections (remembered); **New 2D game / New 3D game**, or **New app / To-do list / App with games**, in one tap; your games or apps as picture cards (the game as you last played it) with when you edited them and a ⋯ menu (open, play, rename, duplicate, delete); then templates with richer tiles. Side by side on wide screens.
- **Search bars:** suggestions while typing (from a word list, a list variable or a data collection, with the typed part in bold), recent searches kept on the phone, ✕ while typing, an iPhone-style **Cancel**, **voice search** 🎤, hints that take turns (`Search recipes | Try “pasta”`), a message once typing pauses, and `{searchResults}` from the Data List. New preset: *Search Bar (suggestions + voice)*.

### Performance

- **Off-screen culling:** 2D objects outside the camera, and 3D meshes outside its view, aren't drawn. Frames are pixel-identical. A 3,000-object 2D level renders about 6× faster, and a 1,500-mesh 3D scene about 7× faster.
- **Play in the editor runs close to a build:**
  - The node editor's live debug is stored per placed object, with no string keys and nothing for spawned copies.
  - The game area's size is cached instead of measured every frame, so a frame never forces a layout of the editor page.
  - The Console redraws at most 4 times a second while the game runs.

### Editor speed (big projects, phones)

- **Lazy redraw while idle:** the Scene redraws while something happens (touch, typing, camera moves, previews, Timeline playback) and about twice a second otherwise. Idle CPU in a 3D level dropped from a full core to about a fifth.
- **On a 600-object level:**
  - Selecting is about 4× cheaper: only the two Hierarchy rows that changed are redrawn, and the Parent list fills in when you open it.
  - Dragging is about 5× faster: the snap list is built once per drag, collider outlines are culled and batched, and pictures aren't looked up by their full data URL.
  - Undo, duplicate and delete are 2–3× cheaper.
- **Undo memory:** steps share big pictures and sounds instead of copying them.
- **Text:** laid-out text is reused until it changes.

### WebAssembly speed-ups

- **Pathfinding** (A* with a binary heap) and **voxel chunk meshing** run in a 1.5 KB WebAssembly module embedded in the engine (`engine/wasm/pocket.wat`). They give the same results as the JS versions: pathfinding is about 7× faster on big maps and re-meshing is about 8× faster.
- The JS versions run automatically where WebAssembly is missing, or with `Wasm.on = false`.
- Pathfinding marks walls rectangle by rectangle now, so it's faster even without WebAssembly.

### In-app purchases

- **Game Settings › In-App Purchases** lists the products: consumables that add to a variable (coins), unlocks (Remove Ads) and subscriptions.
- Nodes: **Buy Product** (bought / cancelled / failed), **Restore Purchases**, **Owns Product** and **Product Price**. Triggers get matching actions.
- The editor and test links show a **test sheet** (Buy, Cancel, Fail); nothing is charged.
- Native exports use the real stores:
  - Xcode: **StoreKit 2**.
  - Android Studio: **Google Play Billing 7**.
  - Expo: **expo-iap**.
- Unlocks are remembered on the device and synced from the store; consumables are used up so they can be bought again. See *Publishing › In-app purchases*.

### Page transitions and Build Settings

- **New page transitions** that follow navigation (Back reverses them): **zoom**, **card stack** (iPhone-sheet style), **reveal from tap** (a circle growing from your finger) and **wipe**.
- *Game Settings › Motion › Page transitions* sets one transition for every page, picked from little moving previews.
- Pop, spring pop, elastic pop, zoom and fade through now scale a panel **with everything inside it**. The incoming page always draws over the old one, even over its + button.
- **Build Settings** is easier:
  - **What are you making?** (Play file, Website, App Store & Google Play, Expo app, Xcode project, Android Studio project, itch.io) shows only the settings that build needs, with a matching main button;
  - a **ready check** with Fix buttons (name, icon, version, description, App ID, a store version already used, testing options, compression…) and a **Recommended** button;
  - chips that jump to each section, and a **Last built** line;
  - ready-made icon emoji and colours with a light and dark Home Screen preview, and *Small update / Big* version buttons.

### Editor look and feel

- **Every panel follows the theme:** fields, borders, menus, chips and cards now use the theme's colours (on Slate or Warm, nothing stays plain grey).
- **New themes:** **Midnight** (deep blue) and **Light**. Each theme in *Preferences* shows a colour dot.
- **The accent colour is used everywhere:** the Play and Add buttons, primary buttons, selected rows, tabs and highlights.
- **Motion:**
  - panels fade up when you switch tabs;
  - menus and dialogs pop in, and sheets spring up;
  - toasts slide in;
  - buttons dip when pressed;
  - the active bottom tab's icon sits in an accent pill.

  *Reduce motion* turns all of it off.
- **Inspector with nothing selected:** buttons to **Add**, open **Game Settings**, the **Hierarchy** or **Scripts**, and the level's main objects to jump to.
- Thin themed scrollbars on computers, and visible keyboard focus.
- **A calmer Scene:**
  - the tool bar folds to the tool you're using (tap it for the others; *Preferences › Fold the tool bar*);
  - on phones only the "fit" button stays (pinch to zoom);
  - the selection bar is icons only and floats next to the selected object, never over it;
  - the Add button becomes a round + while something is selected;
  - cameras, lights and empty objects show their names only when selected;
  - tool and widget tips show only the first few times.
- **Hierarchy and Inspector:**
  - **Compact panels** (on by default, *Preferences*): shorter Hierarchy rows and smaller Inspector fields, so more fits;
  - tree lines show what's inside what;
  - the eye and drag grip stay quiet until a row is selected;
  - the selected row gets an accent edge;
  - **jump chips** at the top of the Inspector (one per component, or per Game Settings section) stay put while you scroll and light up for the part you're in; tap one to open and jump to it;
  - component headers stick to the top while you scroll through a long component.
- **UI in the Scene:** in 2D the game's UI sits inside the camera frame, laid out for the game's screen, so it zooms and pans with the level. **Hide UI** (the HUD button next to the eye) hides it while you build; the UI editor still shows it.
- **Clean view** (the eye next to snap and grid) hides everything over your game. The buttons also fade while you drag.
- **Easier editing:**
  - **smart guides:** in 2D a dragged object lines up with other objects' centres and edges, and in the UI editor with the other elements in the same panel, with a pink line to show it;
  - a **position readout** while dragging;
  - **double-tap** an object to edit its text (for a text) or open it in the Inspector.

### Squads: select and move many units (tactics and strategy)

- **Squad Unit** component: units on a grid that you command, on your team or the enemy's.
- **Select:**
  - tap units to add them to the group (tap again to remove);
  - double-tap to select all;
  - drag a box over the ground to select every unit inside it;
  - or use the **Select All / Next Unit / End Turn** buttons (messages `select all`, `select none`, `select next`, `stop`, `end turn`).
- **Highlights:** selection rings, health bars, the tiles each unit can reach (turn-based), enemies in range pulsing red, dashed paths with destinations, tap markers, and arrows or magic bolts for ranged attacks.
- **Move:**
  - tap a tile and the whole group walks there in formation (group, line, column or keep their shape), each on its own tile, finding its way around walls and waiting for each other in corridors;
  - tap an enemy and they all attack it;
  - or drag from a unit to send it.
- **Turn-based:**
  - moves per turn and one attack per unit;
  - finished units fade, and the turn ends by itself (or with End Turn);
  - enemy units then move one after another toward your nearest unit, and the enemy turn waits for them.
- **Real-time:** units attack foes in range on their own, chase them, or only do what they're told. Units fight back when hit, and enemy units hunt yours.
- **Unit Commander:** tap mode; dragging draws a box or moves the camera; formation; highlights; auto end turn; win / lose rules; colours.
- **Variables:** `selectedUnits`, `unitsLeft`, `enemiesLeft`, `unitsReady`.
- **Triggers and nodes:**
  - **Events:** your turn starts, units selected, unit arrives, unit defeated.
  - **Conditions:** number of units, it is your turn.
  - **Instructions:** select units, send units (to an object, a position, or to attack), stop units, end turn.
- **Create → Gameplay → Squad:** Soldier, Archer, Knight, Mage, Enemy Unit, Enemy Archer, Unit Commander (2D and 3D).
- **New templates:** **Squad Tactics** (turn-based) and **Squad Battle** (real-time).
- In 3D the floor no longer blocks grid movement; only things that rise above the walker's feet do.

### NPCs: moving, chatting, trading and gifts

- **Moving:** stand still, wander around, patrol a route (object names or x,y points), or follow the player. They stop to talk, can stop when you come close, and turn to face you.
- **Chatter:** random lines in a speech bubble when you come close or every few seconds, and the **NPC says** instruction.
- **Shop:**
  - *Sells* (`Item | price | amount`) and *Buys from you* add **Buy** and **Sell** to the conversation, with "not enough coins" and any money variable;
  - *Likes these gifts* adds **Give a gift**, which raises friendship (`friend_Name`, `my.friendship` in dialogue, ♥ on the name tag).
- **Dialogues:** an NPC's own dialogue can jump to `-> shop`, `-> sell`, `-> gift` or `-> menu`.
- **Name tags**, and **portraits per speaker** in the dialogue box.
- **New presets:** Merchant, Wandering Villager, Patrol Guard, Companion.

### Grid movement (Grid Hero and Turn Enemy)

- **Every input counts:** quick arrow / WASD presses each take a step (before, fast presses could be lost and holding only moved once). Holding a key or the joystick keeps walking.
- **Swipes and taps:** swipe for one step, or **tap any tile to walk there**. It finds the shortest way around walls and shows a marker on the tile it's heading for. In turn-based games it walks one step per turn. Taps on UI buttons no longer move the hero.
- **Lines up with your level:** at the start, the hero and Turn Enemies snap to the grid your walls sit on, so they never end up half a tile off.
- **Fights:** bumping an enemy gives a nudge, hurts it (plus the equipped weapon's damage) and shows its health bar. Bumping a wall nudges and buzzes.
- **Grid Hero** (Create) now comes with Health: 5 hearts and a bar over it. Before, the first enemy hit ended the game.
- **Turn Enemies:**
  - They walk around walls toward the player and never pile onto the same tile.
  - Their attack damage can be set, and it hits the player's Health (or takes a life if the player has no Health).
  - When they can't see the player, they can wait, wander or go back home.
  - They can act every few turns (slow monsters).
  - In games that aren't turn-based, they move every few seconds.

### Move: joystick, tilt and drag

- **Taps and the joystick get along:**
  - A finger that lands on something you can tap never starts the joystick. That covers On Tap / Double Tap / Long Press / Drag nodes, tap triggers and Buttons.
  - A quick touch that did start the joystick still counts as a tap.
  - Taps forgive a little finger wobble (more room on big screens) and up to 0.45 s of press, and they are checked where the finger landed.

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

**Vibration** (every Vibrate action, node and component goes through one place):
- **iOS / Android apps** (Build Settings › App stores): real vibration and haptic taps through `@capacitor/haptics`, now in the app project. Short buzzes become light / medium / heavy taps; success / warning / error get the phone's own patterns.
- **Android browsers:** the Vibration API (patterns work).
- **iPhone browsers** (Safari has no vibration API): on iOS 18 and later each buzz becomes a haptic tick, a few in a row for long ones. It works best right after a touch.
- Muting the sound no longer turns vibration off; the player's **Vibration** setting does.
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

The play bar: **Stop**, **Pause**, **Step** (one frame while paused), **Inspect**, **Stats**, **Console**, and **⋮** to choose where the bar goes:
- **Above the game** (the default) or **Below the game**: the game's screen starts (or ends) at the bar, so nothing at the top of your game (score, App Bar, buttons) is hidden under it. The game then doesn't add notch space on that side, since it no longer reaches the notch.
- **Floating over the game** (drag it by ⋮), or a **Small button** you drag anywhere; tap it to open the tools. The choice and position are remembered.
- **Inspect** pauses without the "PAUSED" screen. Tap any object in the running game, including ones spawned while playing, to see its live position, rotation, velocity, visibility and components, and change them. Step moves the game on a frame at a time while you watch the numbers. Changes last until you stop.
- **Stats** shows FPS, objects, bodies, the game state, time and your variables (score, lives…).

### Console

- The **Console** tab lists what your game reports while it runs: the **Debug Log** action (Triggers) and node (Visual Script), `P.log()` / `P.warn()` in custom scripts, warnings (e.g. spawning a template that doesn't exist) and errors.
- Repeated messages fold into one line with a count, and **Merge identical messages** (⋮) folds them even when other messages come in between. Filter by Log / Warn / Error and **search** the text and object names.
- **Tap a message** for its details: the full text (selectable), where it came from, an error's **stack** (where in the code it happened), and **Copy**, **Show object** (or **Inspect** it while playing) and **Find similar**.
- **Watch variables:** pinned chips at the top show variables' live values while the game runs (they flash when they change). Add with the 👁 button next to the search (then **+**), or `watch score`. The kinds and search stay at the top of the Console and the command line at the bottom; only the messages scroll.
- **Command line** at the bottom, to look inside and change the running game:
  - `score` shows a variable, `score = 10`, `score += 5`, `name = 'Ana'`, `items = [1, 2, 3]` change it, and `vars` lists them all.
  - `send win` (or `send hit 5` with a value), `page shop`, `back`, `pause`, `resume`, `step`, `restart`, `win`, `lose`, `level 2`, `speed 0.5` (slow motion).
  - `objects` lists what's in the scene, `find Player` shows an object's position, tags, health and own variables. `watch`, `unwatch`, `clear`, `help`. ↑ / ↓ go through earlier commands.
- **⋮ options:** merge identical messages, newest at the top, **pause the game on an error**, clear when you press Play, times shown since Play / as the clock / hidden, **Copy All** and **Save as a File**.
- While playing, the console button in the play bar (with a red count for errors) opens the same console over the game: filters, search, watches and the command line. ⛶ makes it taller.
- **Errors never freeze the game:** an error in any frame (a component, a node, a script) is reported with its stack and the game keeps running. Unhandled errors and failed promises are reported too.
- **Nodes:** **Debug Log** can log as a log, warning or error; **Debug Log Value** writes a label and any value (number, text, list, dictionary).

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

### Permissions (Game Settings › Permissions)

Ask the player for **location**, the **camera**, the **microphone**, **motion sensors** (tilt and shake), **notifications** or **lasting storage** (so the phone doesn't clear saves when space runs low).
- **The friendly way:** a card explains why first (an icon, a title and your reason, with **Allow** / **Not now**). Its Allow button is a real tap, so the phone's own question follows straight away, which iPhones need for motion. If the player said no before, the card says how to turn it back on in the phone's settings. *Explain first* can be turned off to ask straight away.
- **When:** the **Ask Permission** node (outputs *allowed*, *not allowed*, *not supported*), a trigger's **Ask permission**, the action **ask permission** (value `location`, `camera`…), or Game Settings › Permissions › Ask **on the first tap** (several are asked one after another). **Test** there asks on your own device.
- **Using them:** **Location** (latitude, longitude, accuracy, speed, heading, altitude, seconds since the last update; it keeps updating while the game runs), **Distance To Place** (metres to a latitude / longitude: treasure hunts, check-ins), **On Location Changed**, **Microphone Loudness** (0–100: blow, shout or clap to play), **Permission Status** (granted / denied / prompt / unsupported), **Has Permission**, **On Permission Answered**.
- **In app builds** (Build Settings › App stores), the project declares what the game uses: iOS gets your reasons as the camera, microphone and location usage texts (iOS requires them), and Android gets the camera, microphone and location permissions. Nothing is declared for permissions the game doesn't use.
- The game waits while the card is up, without the PAUSED screen.

### Phone notifications (Game Settings › Phone Notifications)

Real notifications in the phone's own notification area (the lock screen and pull-down list), such as "Your energy is full!".

- **Where they work:**
  - **iOS / Android apps** made with *Build Settings › App stores*: full support. They can be scheduled and arrive while the game is closed (on time even in Android's battery saver). The app project includes `@capacitor/local-notifications`, an Android status-bar icon (a bell) and a notification channel that pops up on screen.
  - **Websites:** menu › **Build Web App (.zip)** makes a folder to upload to any https host (index.html, a service worker, a manifest and an icon). It installs to the Home Screen, plays offline, and shows notifications through the service worker, which is what Android Chrome and iPhone Home Screen apps need. They arrive while the game is open; on iPhone, only once it's on the Home Screen.
  - A single **Build HTML** file can show them on a computer browser while it's open.
- **Sending one:**
  - The **Phone Notification** node: title and text (with `{variables}`), and *when*: now, in N seconds / minutes / hours / days, daily at a time (HH:MM), or every minute / hour / day / week. An **id** lets a newer one replace an older one. Its *not allowed* output runs if the player said no.
  - **Cancel Phone Notification** cancels one by id, or all of them if the id is blank.
  - A trigger's **Phone notification** (in N minutes, 0 = now), or the action **phone notification** with `Title|text` (amount = seconds from now).
- **Permission:** the player has to allow notifications once. *Ask the player* can be: on their first tap, when the **Ask Notification Permission** node runs (outputs *allowed* / *not allowed*), or only when the first one is sent.
- **Come-back reminders:** one per line, `hours | Title | text` (e.g. `24 | We miss you! | Your daily chest is ready`). They count from when the player leaves the game, and are replaced each time they come back.
- **Daily reminder:** a title, text and time that repeats every day.
- Tapping a notification opens the game (or brings it forward) and sends the message `notification opened` (and `notification opened ID`); the node **On Phone Notification Tapped** does the same.
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
| **Inventory Grid** | The inventory as slots with counts. Tap to pick (into a variable), tap again to use, equip or drop: it sends `use Name` / `use item`. Show one item type only (a backpack tab), rarity frames, and an info line for the picked item. |
| **Hotbar** | A row of quick slots. Tap to hold an item (`heldItem`), tap again to use or equip it; keys 1–9 pick a slot. |
| **Equipment** | The player's slots (hand, offhand, head, body, legs, feet, neck, ring) with total damage, armour and speed. Tap a slot to take the item off. |
| **Crafting** | The recipes, with each ingredient in green (have it) or red (missing). Tap one to craft it. Can show all recipes, only the ones you can make, or only those for nearby stations; it also shows crafting progress. |
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
  - **16 styles:**

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
    | segmented | a floating capsule; a solid highlight slides to the selected tab |
    | curved | the selected icon sits in a circle above the bar, in a notch that slides with it |
    | neon | a glowing line and a glowing icon on a dark bar |
    | dock | a floating dock of big icons; the selected one lifts and its neighbours grow |
    | spotlight | a beam of light shines down on the selected tab |
    | outline | a ring around the selected icon |
    | chips | every tab is a chip; the selected one is filled |
  - **Badges:** per tab (*Badge…* in its ⋯ menu): the variable, its starting number, count or dot, and its own colour; the editor shows a sample badge. For every tab: colour, number colour, size, shape, ring, position (icon corner, top right, beside the name, over the icon) and nudges, highest number shown (`99+`), words like NEW, dot only, show 0, pop / shake / pulse / glow, hide on the selected tab, and clear when the tab is opened.
  - **The newly selected icon** bounces, pops, spins, wiggles or flips. **Glow** for neon and spotlight, and the colour of the icon and text **on the highlight** for segmented, curved and chips.
  - **Labels:** auto, always, selected only, or never.
  - **Colours:** bar, selected, other tabs, indicator and badge. *Apply theme* recolours the bar too.
  - **Size & shape:** icon and label size, corner radius, floating gap, line along the top, shadow, and filling the home-bar area.
  - **Animation:** the indicator slides, fades or jumps, at a set speed. Tap effects: bounce, ripple, grow or none. Also a tap sound and vibration.
  - **Behaviour:** switch tab, or open as a page (Back returns). **Hide on these pages** slides the bar away (e.g. during `game`), **Only show on these pages**, and it can also send a message when the tab changes.
    - A tab can be `msg:menu`: it opens the Side Menu instead of being a page, and lights up while the menu is open.
    - **On a page that isn't a tab** (say Settings, opened from the Side Menu): no tab lit, keep the last tab lit, or hide the bar.
    - **Tapping the current tab again sends** a message (e.g. `scroll top`).
  - **Layout:** **Keep other UI clear of the bar** (on by default; see *Safe area* below) and **Widest the bar gets** (it stays centred on tablets and sideways phones). Also **dot-only badges** and **Selected icon lifts up**.
  - **Bar height** (0 = the object's height): the bar grows up from the bottom edge and everything else makes room. **Background:** see-through amount, **frosted-glass blur** of what's behind, a gradient and the top line colour. With a see-through bar, **pages run under it** (auto, yes or no) while their buttons and lists stay clear. Each page can keep a tab lit, and make the bar solid, see-through or clear, or another colour, while it's open.
  - **Hide & show** (also on the App Bar): **Hides by itself** never, *when scrolling down* (any scrolling page, Scroll View, List, Data List, feed, chat, inbox or other social list scrolling down slides it away; scrolling up a little, reaching the top or changing page brings it back), *after a few seconds* without touches (a touch brings it back), or both. **Goes away by** sliding, fading or both, at a set speed. The messages `navbar hide`, `navbar show` and `navbar toggle` (`appbar …` for the App Bar) and the **Show / Hide Nav Bars** node do it by hand. While a bar is away, its space goes back to the page.
  - Tapping a tab sets the variable `page`. Ready-made **Pages** show when it matches, and they slide toward the tab you picked. The bar is drawn in the editor too, so you see it while designing.
- **Pages that line themselves up:** *Line everything up (no overlaps)* stacks what is on a page top to bottom with even gaps, on any screen. Side-by-side rows stay rows, and a feed or list fills the room under them. On for new pages.
- **Side Menus:** one **Side Menu** component draws and runs the whole menu.
  - **Keep in step with** the Bottom Nav tabs or all pages (and the Bottom Nav with the Side Menu or all pages), so pages, tabs and menu items stay in sync by themselves.
  - **Social header:** the signed-in person's picture, name and @handle with Following / Followers / Friends counts, which open their profile and lists. A **Post** button opens the composer from any page.
  - **Presets:** Side Menu (left), Side Menu (right) (settings switches behind a ⚙ button), Floating, Glass, Banner header, Icon Rail (always visible), Full-screen Menu, Minimal, Grouped, Gradient, Neon, Cards, Pills, Compact, Hides the page and Page still works. The older menus made of separate objects are still there as *Side Bar (left / right, separate items)*.
  - **Items:** one per line, `Label | icon | what it does | badge variable`.
    - *What it does* is a page name (sets `page`), `msg:name` (sends a message, shown with ›), or `toggle:var` (an on/off switch that keeps the menu open).
    - `# Title` starts a section and `-` draws a line.
    - **Footer items** sit at the bottom (e.g. Help).
  - **13 styles** (picked from pictures): classic (tinted row with a bar on its edge), rounded, floating, glass (frosted, the page blurred behind it), rail (a slim icon column that opens to the full menu), fullscreen (big centred items, with their switches), minimal, grouped (items in rounded cards, like iPhone Settings), gradient, neon (glowing edge and selected row), compact, pills and cards.
  - **Page behind:** dims, blurs, is hidden (only the menu shows) or stays as it is, with its darkness and colour. **The page still works** keeps the page usable while the menu is open: taps outside reach the page and the menu stays open.
  - **Items:** space between items, highlight roundness, icons in coloured circles, lines between items and a line along the edge.
  - **Items as cards** in the Inspector: an icon, a name, and a page, a switch or a message; a badge and a line of small text under it; section titles and lines.
  - **Selected row** (soft, filled, edge bar, text only), a background gradient, corner roundness, blur and shadow. The header can show a photo and send a message when tapped (a profile), and small print can sit at the bottom.
  - **Header:** a title and subtitle (with `{variables}`), a picture (icon or emoji), simple / banner / none, and a ✕ close button.
  - **Colours:** background, text, accent, banner and badge.
  - **Size:** width, row height, text and icon size, icons on or off, and the floating gap.
  - **Animation:** opens with a slide, fade or zoom, at a set speed. Items can flow in one by one, and the game behind dims. Also a tap sound and vibration.
  - **Opening and closing:**
    - Open: the ☰ button, the message (`menu`, or `menu open` / `menu close`), or a **swipe from the screen edge**.
    - Close: **drag it back**, tap outside, use the phone's Back gesture, or pick an item.
    - Choose whether picking an item switches page or opens it as a page that Back returns from.
  - **Works with the bars:**
    - **With a Bottom Nav / App Bar:** *stay between them* (the menu fits between the bars, which stay tappable; tapping one closes the menu; with a raised middle button on the Bottom Nav the menu goes over the bottom bar instead), *cover them*, or *hide them while open*.
    - **Opening:** *over the screen*, or *push the screen* (the rest of the UI slides aside, so nothing is hidden under the menu).
    - **Built-in ☰ button** in the top or bottom corner of its side (it steps aside while an App Bar shows its own ☰).
    - Side Menu presets add an **App Bar** with the ☰ (in games too), so pages lay out under it; older projects get a **Put the ☰ in a top bar** button in the Side Menu's Inspector.
    - **Icon Rail** keeps its column of the screen: other UI is laid out next to it.
  - Long menus **scroll** (drag up and down; sideways still closes it) with a thin scroll bar, and never run under the footer.
  - **Set variable while open** (e.g. `menuOpen`), and **Edge swipe area** (how close to the edge a swipe has to start).
  - In the editor the menu shows open only while it's selected, so it doesn't hide the rest of your UI.
  - **Bottom Sheet:** a + button slides up a panel.
- **App Bar** (new component): a top bar like a phone app's.
  - Left: **‹ Back** when there's a page to go back to, else **☰** (opens the Side Menu), or always ☰, only Back, or nothing.
  - The **title follows the page**: it uses the Bottom Nav or Side Menu name for the page, a list of `page = Title` lines, or your own text with `{variables}`.
  - Up to 4 **right buttons**, `icon | message | badge variable` (e.g. `bell | notifications | unread`).
  - **5 styles:** solid, transparent, glass, large title (iOS style) and centered. Hide on / only show on pages.
  - **Large title shrinks when scrolling:** the tall bar with a big title becomes a normal bar as a list scrolls, and grows back at the top.
  - **More settings:** a **subtitle** (with `{variables}`, e.g. `Score: {score}`), a **logo** (icon or emoji) next to the title, **title position** (left or centre), **title weight**, a **custom left button** (your icon and message), **tapping the title sends** a message (e.g. `scroll top`), **bar height**, **gradient** colour, **bar opacity**, separate **icon colour**, bottom **corner radius** and **line colour**, and a **shadow** that's always there, only once the list has scrolled, or never.
  - **Hide & show** by itself (on scroll down, when idle, or both) or by message, like the Bottom Nav above.
  - Presets: App Bar, App Bar (large title), (centered), (glass), (transparent), **(hides on scroll)** and **(gradient)**.
- **App Layout (App Bar + Side Menu + Bottom Nav):** the three parts set up to work together. The App Bar ☰ and the Bottom Nav's *More* tab open the Side Menu, which fits between the bars; all three share `page`, so the right tab lights up and the title follows; the pages fill the space between the bars.
- **Tab Bar, Page** (and the older App Bar made of separate objects).
- **Popups:** **Popup Dialog** (opens on the message `popup`, OK sends `close`), **Toast** (slides in for 2 s on `toast`), **Badge** (a red counter that hides at 0).
- **Controls:** **Checkbox**, **Segmented** choice, **Option Picker** (‹ Easy / Normal / Hard ›), **Stepper** (− value +), **Star Rating**, **Scroll List**, **Card**, **Icon Button**, **UI Image**, **Loading Spinner**.
- **Scroll View** (rebuilt; also used by the List View):
  - **Scrolls** vertically, horizontally or both. Drag, **flick** (it keeps going and slows down: smooth, short or off; the flick speed is measured from the last moments of your finger, and the glide slows like iPhone scrolling — the same in feeds, lists and scrolling pages), or use a **mouse wheel / trackpad**. Pulling past the ends **stretches and springs back** (can be turned off).
  - **Cuts items off cleanly at its edges** (rounded corners too) instead of hiding whole items, and the hidden part can't be tapped. A sideways drag on a vertical list isn't taken as a scroll, so sliders and swipes inside still work; a drag is never taken as a tap.
  - **Lines up the items inside** for you: *as placed*, *one per row* (a list; down, or across for a horizontal view, with a gap and alignment), or a *grid* with N columns. Add or remove children (also while playing) and the rest move up.
  - **Stop on:** anywhere, **items** (settles with an item at the start, like a carousel) or **pages** (one screenful per flick; the page number goes in a variable).
  - **Scroll bar:** while scrolling, always or never, in your colour.
  - **Pull down to refresh** sends a message and shows a spinner until the game sends the message + ` done` (or 3 s). **Reaching the end** sends a message (e.g. `load more`). **Scroll position** (0–1) can go in a variable.
  - **Messages:** `scroll top`, `scroll bottom`, `scroll next` / `scroll prev` (a page or a screenful), `scroll to Item Name`. The Bottom Nav's *tapping the current tab again* and the App Bar's *tapping the title* can send `scroll top`.
  - Scrolling tells the App Bar and Bottom Nav, so they can hide while scrolling down and shrink a large title.
  - **Presets:** Scroll List, Scroll List (pull to refresh), Scroll Grid (shop), Horizontal Scroller (snap) and Paged Scroller (swipe pages).
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

### 2D Sprite Editor (draw your own sprites)

The 2D cousin of the 3D Modeler. Open it from **Create → Characters & Sprites → Draw Your Own** or **+ → Draw a Sprite**. On any object, use **Draw** in the Image component, or **Draw your own** in the Shape Renderer, which starts from the shape it already has.

- **Shapes as parts:** box, rounded box, circle, triangle, star, polygon, heart, line, text / emoji, and pictures from your phone.
  - **Select** a part to drag it. Corners scale it while the opposite corner stays put, and the round knob rotates it. Pinch or drag empty space to pan and zoom.
  - **Style:** fill colour, **gradient** (down, across, diagonal or radial), outline and width, opacity, corner radius, number of sides or points, glow and drop shadow.
  - Flip, **cut out** (makes a hole in the parts below), bring to front / send to back, centre, copy, and **mirror copy** for symmetric characters.
- **Pen:** tap points to draw your own shape; tap the first point to close it.
- **Brush:** draw freely with a finger.
- **Edit points:** drag any point of a shape, or tap the small dots to add points. Turn on **Smooth** for curves. **To points** turns any box, circle or star into an editable shape.
- **Pixel art:** pixel layers with pencil, eraser, fill bucket and colour picker. There are 1×–3× brushes, **mirror painting**, a grid, and **pixel art mode** for crisp pixels and snapping. The fill bucket also recolours a shape when you tap it.
- **Layers:** a thumbnail for each part, with show/hide and lock. You can also rename, reorder, duplicate or delete parts, and merge pixel layers.
- **Frames for animation:**
  - Copy a frame and change it a little. **Onion skin** shows the previous frame faintly.
  - **Play** previews the animation, at your choice of **FPS**.
  - Give frames **clip names** (idle, run…). Done saves the frames as a sprite sheet, with a **Sprite Sheet Animator** already set up with those clips.
- **Starting points:** Smiley, Coin, Tree, Slime, Button and Heart. The ⋯ menu has:
  - canvas size and background;
  - snap, grid and keep proportions;
  - **Save to / Open from My Drawings**, to reuse a drawing in other games.
- Undo / redo throughout. Done saves a picture plus the editable drawing, so the sprite works everywhere a picture does (game, UI, exports) and opens again with every part still editable.

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

PlayFab and Photon are for **games**. An app shows them only once it has a game inside it; Supabase works in both.

Each game uses **your own free accounts**: Game Settings › **Online (PlayFab & Photon)** takes a PlayFab **Title ID** and a Photon **App ID** (with *Test PlayFab* / *Test Photon* buttons). Nothing goes online until you add one, and the rest of the game keeps working offline.

**PlayFab** (accounts, leaderboards, cloud saves, remote config), using its Client API directly (no SDK):
- Players are signed in automatically with a private ID kept on their device (*Sign players in when the game starts*), so there's no password screen. **Set Player Name** sets the name on leaderboards.
- **Online Leaderboard** widget / component: shows the top players (or the ones around you) in a text, refreshing on start, on the message `leaderboard`, and after posting. **Post Score** (node or the *submit score online* button action) sends a variable to a leaderboard. In PlayFab, turn on *Title settings › API Features › Allow client to post player statistics*.
- **Cloud Save / Cloud Load** keep the game's variables in the player's account. **Load Remote Config** turns Title Data into variables, so you can tune a live game. **Track Event** records analytics events. Virtual currencies show up as variables like `{pfGC}`.

- **More PlayFab:** email login (add it to the account, sign in on another phone, password reset), virtual currency (add or take), buying catalog items and the inventory (`pfItems`, *Owns Item*), player data by key, the player's own statistics, friends (and a friends-only leaderboard), Cloud Script, Title News and the server's clock (`pfServerTime`).

**Photon** (real-time multiplayer), loading the official Photon Realtime library (`photon-realtime` from npm via jsDelivr) when it's first needed:
- **Join Room** (by name, or any open room; it connects first), **Leave Room**, or *Join a room when the game starts*. **Multiplayer Lobby** widget: status, *Play Online* and *Leave* buttons.
- **Network Sync** component: put it on your player. Everyone else in the room sees a copy that follows you (position, turning, facing, animation clip), with your name over it in 2D. Copies are tagged `remote` and are left out of the camera and the player tag; *solid* makes them bump.
- **Spawn For Everyone** (node), Spawner's *room host spawns for everyone* and Shooter's *bullets appear for everyone*: the object appears for every player, and when it's collected or destroyed anywhere it disappears everywhere. Players who join later get the objects that are already there.
- **Send Network Message** (with a number) arrives at everyone else as a normal game message and fires **On Network Message**; **Set Shared Variable** keeps a variable the same for everyone (late joiners get it too).
- Events **On Joined Room**, **On Player Joined**, **On Player Left**, **On PlayFab Logged In**, **On Online Error**; values **Players In Room**, **Is Room Host**, **Is In Room**, **Network Message Value**. Show `{netState}`, `{netPlayers}`, `{netRoom}`, `{pfName}`, `{pfRank}` or `{onlineError}` in any text.
- Scripts: `engine.online` has `join()`, `leave()`, `sendMessage()`, `setShared()`, `pfLogin()`, `pfSubmit()`, `pfLeaderboard()`, `pfSave()`, `pfLoad()`, `pfTitleData()`, `pfEvent()`.

- **More Photon:** rooms with a share code, private rooms and settings (*Create Room*, *Join Matching Room*), the **Room List** widget (open rooms; tap to join), room settings for everyone, player names and info (team, ready…) with `netAllReady`, room **chat** (**Chat Box** widget), messages just for the host, and *On Became Host*.

### Save files (Easy Save style)

Games can keep anything between plays in **named save files** of keys, like Unity's Easy Save.

- **Save Files nodes** (their own node folder):
  - Save and load keys: **Save Key**, **Save Variable To Key**, **Load Key Into Variable** (with a *not saved yet* way out), and **Load Key** as text or as a number with a default.
  - A key can hold a number, text, a list, a dictionary or a whole object.
  - Check what is there: **Key Exists**, **Save File Exists**, **Number Of Saved Keys**, **Seconds Since Saved** (useful for offline earnings).
  - Delete: **Delete Key**, **Delete Save File** (for New Game).
  - In bulk: **Save / Load Variables** (all of them, or a comma list), **Save / Load Object** (position, rotation, scale, shown or hidden, its own variables, text).
  - **Save Everything Now**, **Saved Keys To List**, **Save Files To List** (for save-slot menus).
  - Files: **Copy Save File** (or move / rename), **Back Up Save File** and **Restore Backup**.
  - **Export Save As Text** turns a save into one line (and copies it) so a player can move progress to another phone. **Import Save From Text** loads it back.
  - **On Game Saved** is an event that runs whenever a file is written.
- **Auto Save component** remembers one object between plays: where it is, whether it's shown, its own variables, and whether it was destroyed or collected (collected coins stay gone). It loads when the level starts. It saves when the player leaves the app, when the level ends, on a timer, on a message, or on *Save Everything Now*.
- **Save Manager component** does the same for game variables: coins, upgrades, unlocked levels. Pick which ones, or keep them all.
- **Game Settings › Saving › Save files:**
  - **Encrypt save files** with a password. Players can't read or edit them, and a file changed outside the game is refused.
  - **Keep the previous save as a backup.**
  - **Save Data…** (also in ☰) is a save browser for the saves Play mode wrote on this device. It lists every file and key with its value, size and when it was saved. From there you can edit a value, add or delete keys, export or import, back up or restore, duplicate, or delete one file or all of them to start fresh.

### Saving, restore points and backups

- **Auto-save** (on by default): a few seconds after each change. The top-bar Save button's dot blinks blue while a change waits and turns green when saved; tap it to save now, hold it (or ☰ → *Auto-save: On / Off*) to change how often or turn it off.
- **With auto-save off, saved only when you save** (top-bar Save, ☰ → Save, Ctrl/⌘ S): a dot marks unsaved changes; switching or starting a project asks Save / Don't save / Cancel; closing the tab warns; unsaved changes from a closed app are offered back next time. Preferences › *Save my work* can switch back to saving as you go.
- Projects live in the browser's database (IndexedDB), one record per game, with room for hundreds of MB, so imported pictures and sounds no longer fill a ~5 MB limit. Games saved by older versions move across by themselves the first time.
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
- **UI never hides under the nav bars:** a Bottom Nav, an App Bar and an Icon Rail hold their edge of the screen, and everything else is laid out in the space that's left:
  - UI anchored to that edge sits next to the bar instead of under it (a bottom button sits above the Bottom Nav), stretched pages fill the space between the bars, and centred popups are centred in it.
  - Notifications, messages and the touch controls (joystick, buttons, pause and mute) stay clear of the bars too. While a side menu or popup is open, the touch controls hide.
- **Shapes, icons and fonts:** a shape gallery with 19 new shapes (speech bubble, ticket, price tag, ribbon, step arrow, bookmark, shield, wavy edge, squircle, cut corners, slanted, starburst, badge, blob, drop, leaf, lightning, moon, plus); **draw your own shape** or **paste an SVG**; **Save to My UI** to reuse your own UI pieces; 120+ searchable icons and **upload your own**; ~100 Google Fonts in groups with search and a live preview, and **upload your own font files**.
- **Looks and styles for any UI:** **Looks…** (18 one-tap looks with previews: glass, neumorphic, pressed, neon, gradient border, retro, patterns…), **My Styles** (named styles that stay linked: update one and every element using it changes, on every level), and new shape effects: inner shadow, gradient border, sideways shadow, patterns (dots, stripes, grid, checks) and frosted glass that blurs what's behind.
- **Top tabs:** the Bottom Nav can also run along the top (**Position: Top**, or a *Top Nav* preset). It stacks under an App Bar so pages start below both.
  - It has 10 **top styles** made for the top: tabs, short line, text, pills, chips, segmented, folder, gradient, neon and boxed. Or use any of the 16 bottom styles.
  - The indicator slides and stretches between tabs. Too many tabs scroll sideways.
  - It can show icons beside or above the names, and badges beside them.
- **Side Menu, fully customizable:** put any UI inside it (a search bar, profile card, buttons, pictures, Coins & Gems…: **UI inside** under its items, or drag objects onto it). They stack under the header, after the items or above the footer, and show, slide, fade and get cut off with the menu. Items can also be **sliders**, **choices** (Light / Dark / Auto), **progress bars**, **buttons**, **website links**, **text**, **rows of numbers** and **space**, with a value on the right and their own colour. More looks: a card header, a centred header, picture shape and size, title size, header and background pictures, centred items, text weight, arrows, section title styles, colours for icons, selected text, sections and lines, and width as a % of the screen. While open, it (and any Side Bar, Bottom Sheet, Popup or Dropdown) shows over the page's UI and keeps its taps. Also: a **top bar** (✕ or ‹, a title, icon buttons with badges), **submenus** that slide in with a Back row, **folding sections** (remembered), items that **show only if** a variable says so or show **locked** until then, word badges like **"NEW"**, and **search** across every item.
  - When a bar slides away (Hide on pages, the Show / Hide Nav Bars node), its space is given back.
  - **Go under the nav bars** (UI Element card) lets a background fill the whole screen anyway; the bar's own **Keep other UI clear** setting turns it off for that bar.
  - **Game Settings › Screen & Safe Area › Keep UI from overlapping:** *stay clear of nav bars* (the default), *nav bars + push UI apart*, or *off*. **Push apart** also moves UI elements that overlap each other: within the same parent, a later element moves down (or up, if it's anchored to the bottom) until it's clear. Full-screen panels, menus and popups are left alone, and **Allowed to overlap other UI** on an element lets it sit on top (badges, labels on pictures). It shows in the editor too.
- **UI scaling (like Unity's Canvas Scaler):** UI grows or shrinks with the screen, using the game's design size (*view width × height*) as the reference. **Match width ↔ height** picks what to follow (0 = width, 1 = height, 0.5 = both), **UI size multiplier** makes everything bigger or smaller, and *Same size on every screen* turns scaling off. Taps, sliders, buttons and layouts all follow the scale.
- **Preview phones in the UI editor:** the phone button on the screen bar shows an iPhone notch, Dynamic Island, Android camera hole, a sideways iPhone, no notch, or this device. The safe area is outlined, the unsafe edges are tinted, and the preview also applies when you press Play.
- From code: `uiBox(e, W, H, engine.safe)` gives an element's on-screen box, `uiArea(W, H, engine.safe)` the space left between the nav bars, `engine.safe.bars` how much each bar holds, `placeUI(e, x, y, W, H, engine.safe)` moves it to a screen point, `engine.safe` holds the insets and the scale `k`, and `engine.safeOverride` fakes insets for testing.

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

- **One slim top row:** back to the Hierarchy, Search settings, Advanced, Only changed.
- **Path and stepping:** Level › parent › object (tap to go up), with **‹ 2 / 21 ›** to step through objects.
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
- **Free Look** (orbit, 3D): drag to orbit, **pinch** (or the mouse wheel) to zoom between a closest and furthest distance, lowest / highest angle, and **swing back behind the target** after some seconds without touching (it follows the way it moves or faces).
- **Dolly cart:** a dolly camera can **travel by itself** along its track at a speed, looping, going back and forth or stopping at the end, looking at a target or along the track (fly-throughs, title screens). It keeps moving even while another camera is live.
- **More framing:** a separate **up / down dead zone** and **up / down damping** (follow sideways quickly but jumps slowly, so the screen doesn't bounce), **pixel perfect** 2D (no blurry in-between positions), and a **3D confiner** box the camera stays inside.
- **Noise feel:** handheld, gentle sway, earthquake or engine rumble.
- **Camera Zone** (component, *Create → Camera Zone*): an invisible area; when the player walks in, its camera takes over and blends in (with its own blend time if you like), and leaving goes back to the camera before (or keeps it). Like Cinemachine trigger zones.
- **Camera Switcher** (component): **State-Driven Camera**: each value of a variable has its camera (`run = Follow Cam`, `aim = Aim Cam`); or **Clear Shot**: the first camera in a list that can see the target with nothing solid in between. A *stay at least* time stops quick flicking.
- **Camera Impulse** (component, Impulse Source): shakes the camera when the object hits something (faster than a speed), lands, is destroyed, on a message, at the start or every few seconds; weaker further away (*felt up to*), and it can vibrate the phone.
- **Third person (3D):** **Offset turns with** the world, *the way the target faces* (stays behind it as it turns) or *the way the target moves* (swings round behind the direction of travel: cars, runners), plus a **shoulder offset** for over-the-shoulder views.
- **Deoccluder (3D):** *move in front of it* pulls the camera in front of a wall that comes between it and the target, so the player is never hidden.
- **Follow Zoom:** keep the target the same size on screen (a % of the screen height) by zooming (2D) or changing the field of view (3D). **Zoom out with speed** shows more as the target goes faster.
- **Snap on teleport:** when the target jumps further than a distance in one go (respawn, teleport), the camera cuts there instead of gliding across the level.
- **Dutch tilt** (degrees) tilts the view, in 2D and 3D (taps still land in the right place). **Feels shakes** (×) sets how much impulses move this camera (0 = ignores them).
- **Camera Brain** (component): a default blend and **custom blends** between particular cameras (`Menu Cam > * = 2 inOutSine`, `* > Boss Cam = 0.4 outCubic`, `Boss Cam > * = 0` for a cut).
- **Camera Sequence** (component, *Create → Camera Sequence (cutscene)*): a cutscene of shots, each `Camera | hold | blend`, playing when the level starts or on a message, with **cinematic bars**, **tap to skip**, loop, *players can't move meanwhile*, and a message at the end. Then the usual camera takes over again.
- **Camera Mixer** (component): mixes two cameras by a number 0–1 (a variable such as speed, a slider, or the Set Camera Mix node); it goes live like a camera.
- **Target Group** (component): things a Group camera frames together, each `name or tag | weight | radius` (weight = how much the camera cares, radius = room around it). Set the Group camera's Follow tag to the group's name; nodes add and remove members while playing.
- **Nodes:** **Make Camera Live** (with your own blend time and ease), **Back To Camera Priorities**, **Set Camera Priority**, **Set Camera Target** (follow the boss in a cutscene), **Camera Impulse** (from this object or everywhere), **Set Camera Noise**, **Recenter Orbit Camera**, **On Camera Live**, **Camera Is Live**, **Play / Stop Camera Sequence** (with *finished*), **Set Camera Tilt (Dutch)**, **Set Camera Offset**, **Set Camera Zoom / Field Of View**, **Set Camera Mix**, **Freeze Camera**, **Fade Screen** (*faded out* while the screen is covered, then *done*), **Cinematic Bars**, **Add To / Remove From Target Group**, and the values **Live Camera**, **Screen Position Of**, **Distance From Camera**, **Cutscene Playing**.

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

  To load, use *load game*, the Load Game node, or the **Continue Menu** widget. *Game Settings → Saving → Continue from the newest save on start* resumes automatically.
  - Saves also keep sizes, texts and objects made while playing. Each slot remembers its name, level, when it was saved, the time played and a picture of the game.
  - **Save Slots** menus (*Add → UI → Game Systems*): load, save, or a Save / Load popup, with a card per slot, *Tap again to save over it* and delete buttons.
  - **Auto-save** into its own slot (every 30 s, 1 min or 5 min, or only when leaving), plus when the player switches apps and at each new level.
  - **Save version** with `{loadedSaveVersion}` to fix up older saves; **Encrypt save files** covers slots too.
  - Nodes: Save Slot Info, Newest Save Slot, On Slot Saved, Export / Import Save Slot, Continue (newest save), Delete every save (Reset progress), and Cloud Save / Load Slot (PlayFab). See the [saving guide](docs/guide/saving-online.md).
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
| `gridMove` | Moves one tile at a time: arrow keys / WASD (every press counts), joystick, swipes, or tap a tile to walk there by the shortest way around walls. Holding a direction keeps walking. Lines up with the grid your walls sit on. Ends your turn in turn-based games. Bump enemies (Turn Enemies, or anything tagged `enemy` with Health) to attack them; push objects tagged `pushable`. Taps on UI buttons are ignored. | `tile` (40 / 3D 1), `tapToMove`, `tapMode` (walks to the tapped tile / steps toward the tap), `stepTime`, `holdRepeat`, `diagonal`, `damage` (plus the equipped weapon), `snap`, `face`, `marker` |
| `gridEnemy` | Turn Enemy: on each enemy turn it walks around walls toward the player when it sees them (or waits, wanders, goes home), attacks when next to them (their Health, or a life), never shares a tile with another enemy, and shows a health bar when hurt. Not turn-based: it acts every few seconds. | `tile`, `hp`, `attack`, `points`, `sight`, `mode`, `every` (turns), `realTime`, `snap`, `showBar` |
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
| `scene.saveGame(slot)`, `scene.loadGame(slot)`, `scene.hasSave(slot)`, `scene.deleteSave(slot)` | save slots: variables, level, positions, sizes, texts, what was collected and objects made while playing |
| `engine.slotInfo(slot)`, `engine.newestSlot()`, `engine.exportSave(slot)`, `engine.importSave(slot, text)`, `engine.deleteAllSaves()` | slot cards (name, level, saved ago, time played, picture), Continue, moving a save, Reset progress |
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
