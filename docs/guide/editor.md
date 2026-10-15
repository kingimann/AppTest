# The editor

The editor is designed for one hand on a phone, and grows into side panels on a tablet or computer. This page explains every part of it.

## The layout

- **Top bar:** ☰ menu, the game's name, Undo / Redo, and **▶ Play**.
- **View bar** (under the top bar): 2D / 3D view options, the **Level** button, **UI** mode, the snap (magnet) and grid buttons.
- **Scene view:** your level. Select, move, rotate, scale and paint objects here.
- **Tool rail** (left edge of the Scene): Hand, Move, Rotate, Scale, **Rect** and **Paint**.
- **Blue + button:** opens the **Create** screen.
- **Bottom bar:** **Scene · Hierarchy · Inspector · Scripts · Project · Console**. Tap a tab to open its panel; tap it again (or **Scene**) to put the panel away.

On a phone, panels open full size above the bottom bar. Drag the handle to make one half height (remembered), or swipe up and down on the tabs. Held sideways, or on a bigger screen, the panels move to the side.

## Scene view

| Do this | To |
|---|---|
| Tap an object | Select it |
| Drag an object | Move it (snaps when the magnet is on). It lines up with other objects' centres and edges (a pink guide line shows it), and a label shows where it is |
| Double-tap an object | Edit its words (a text), or open it in the Inspector |
| Drag empty space | Pan (2D) or orbit (3D) |
| Pinch | Zoom |
| Double-tap empty space | Reset the view |
| Long-press an object | Object menu: Inspect, Duplicate, Copy, Paint copies, Focus, Hide, Lock, Make Prefab, Make Child Of…, Delete |
| Long-press empty space | Paste here, Add object here, Reset view, Game settings |
| Two-finger tap / three-finger tap | Undo / Redo |
| ⟲ button (− / + too on a computer) | Reset the view (zoom out, zoom in) |
| 👁 button next to snap and grid | **Clean view:** hide the buttons over the Scene |
| HUD button (next to 👁) | **Hide UI:** hide the game's UI in the Scene while you build the level. The UI editor still shows it |

In a 2D Scene the game's **UI sits inside the camera frame** (the white rectangle), laid out for the game's screen size, so it zooms and pans with the level and shows where it really goes. Anything outside the frame is hidden, as it would be in the game. In 3D, the UI is drawn over the whole view.

When something is selected, a small **quick-action bar** floats next to it (never over it): Inspect, Duplicate, Focus, Attach / Detach (parenting) and Delete. While you drag, the buttons over the Scene fade out of the way.

The **tool bar** on the left shows only the tool you're using; tap it to see the others (*☰ → Preferences › Fold the tool bar* turns this off). Cameras, lights and empty objects show their name only when selected, and tool tips stop after the first few times.

### Tools

- **Hand:** only pans and zooms the view, so you can't move things by accident.
- **Move / Rotate / Scale:** drag the handles. With the magnet on, moves snap (2D: 10 px by default, 3D: 0.5) and rotations snap (15° by default). Set the steps in *☰ → Preferences*.
- **Rect:** eight handles to resize UI elements and 2D objects; the opposite edge stays put. A live **W × H** label shows the size.
- **Paint:** stamps copies of the selected object where you tap or drag. On a Tilemap it paints tiles; on a Voxel World it adds or removes blocks.

### View modes

The view button above the Scene switches between:

- **Scene:** the normal view.
- **Top:** a 3D level seen from straight above with no perspective, like a map.
- **UI:** only the screen and its UI. The game's screen is shown at its real size (the design width × height, 400 × 700 by default), fitted into the space you have, so the layout matches the phone; pinch to zoom in. You get safe-area and centre guides, the 9 anchor points, and chips to preview each screen (Playing, Title, Paused, Game Over, Win). The Hierarchy lists only UI, and **Create** offers UI widgets.
  - **+ Add** sits in the bar above the screen, so it never covers your own buttons.
  - Apps show **one page at a time**: the page the app opens on, or the one picked in the page button. Selecting something on another page (from the Hierarchy) shows that page. *All pages at once* stacks them.
  - The quick-action bar keeps to Inspect, Duplicate and Delete; small things are moved by their middle and resized by the handles at their edges.
  - **Tap** picks the smallest thing under your finger (a button rather than the card or page behind it). **Drag** moves it straight away.
  - Dragging a full-screen **page** pans the view instead of moving it (tap it to select it). **Pinch** zooms, or use − / + / fit; a pinch that starts on a button doesn't move the button.
  - With a panel open (little room left), the screen fills the width and follows the selected element, so you see your changes to it; the floating bars step aside.
  - Things **stretched** to the screen width (search bars, app bars) move only up and down, and pulling their left or right edge changes their **margin** from the screen edge.

## Create screen

The blue **+**, the Hierarchy's **Create** button and the Project tab all open it. It has:

- **Search** across everything.
- **Quick add:** player, jumper / 3D player, platform, coin, enemy, score.
- **Folders:** Gameplay, Characters & Sprites, Shapes & Objects, 3D Models, UI & Menus, Logic & Scripts, Camera & Lights, My Prefabs.

Tap a tile to add it at the centre, or press, hold and drag it to the exact spot.

## Hierarchy

Every object in the current level, in drawing order.

- **The top row is the level itself.** Tap it to open **Game Settings** in the Inspector.
- Rows show a coloured icon by kind (player, UI, logic, camera, light, template) and a line listing the object's components.
- Three or more objects with the same name fold into one row (**Gem ×8**).
- **Children** sit indented under their parent with a fold arrow and a tree line. Drag a row's grip onto another object to make it a child.
- The eye and the drag grip are faint until a row is selected; the selected row has an accent edge.
- **Folders:** long-press → *Put in Folder…*.
- **Filter:** player, logic, physics, UI, templates, a tag or a layer. Search matches names, tags and components.
- **Select** (tick button): tick several objects, then Duplicate, Group, Hide / Show, put in a Folder or Delete them together.

## Inspector

The selected object's settings, as **components** (cards).

- **Header:** name, **tags** (chips; + adds one), **Layer** (collision layer), **Draw** layer and order, **Parent**.
- **Components:** each card can be folded. Closed cards show a summary ("run speed 240 · jump power 680").
- **Add Component:** suggestions for this object, recently used, and folders (Physics, Colliders, Controllers, Combat, Survival, Crafting, AI, Logic, UI…). Search covers everything.
- **Quick add** chips sit next to Add Component.
- **⋯ on a card:** Copy, **Paste Values** (from another component of the same type), Copy as Text, move up / down, turn off, remove, and **Docs** (opens this component's reference page).
- **Collapse all / Expand all** folds every card. The choice is remembered for the next object you select.
- **Jump chips:** with four or more cards (and in Game Settings), a row of chips sits at the top of the Inspector, one per card. It stays there while you scroll and lights up the card you're in. Tap a chip to open that card and jump to it. A card's header also sticks to the top while you scroll through it.

*Preferences › Compact panels* (on by default) makes Hierarchy rows shorter and Inspector fields smaller, so more fits on a phone screen.

### Fields

- **Numbers:** type, use − / +, or **drag the label** left and right to scrub the value.
- **Changed from default:** the field gets a blue edge and a **↺** reset button. **✎ Changed only** hides everything else.
- **Dropdowns** with 2–4 short choices become toggle buttons.
- **Lists** typed "one per line, A | B | C" (shop items, tabs, camera shots) become tables with a row menu.
- **Comma lists** (tags, variables, messages) become chips with suggestions from your game.
- Fields only appear when they matter (e.g. Speed only for movement types that use it). **Advanced** shows the rarely used ones.
- **Search settings** at the top finds any field.

## Game Settings

Tap the level row at the top of the Hierarchy. The sections are:

| Section | What's in it |
|---|---|
| Level | Name, background, 2D / 3D, design size (view width × height), gravity |
| Start Screen | Title, subtitle, the built-in title / pause / game-over screens, custom screens |
| Orientation | Portrait, landscape or either, and what happens when the phone is held the other way |
| Screen & Safe Area | Notch handling, extra edge space, keeping UI apart, UI scaling |
| Touch Controls | Joystick, jump / action buttons, D-pad / arrows, player settings (⚙) |
| Mobile | Back gesture, edge swipe, vibration |
| Physics | Gravity X / Y / Z |
| Collision Layers | Which of the eight layers collide with which |
| Lighting / Lighting Presets | 2D darkness, 3D sun, ambient, sky and ground; one-tap moods |
| Camera & Fog / Environment | 3D camera defaults, fog, sky |
| Post Processing | Bloom, vignette, colour grading |
| UI Theme | Fonts and colours used by the built-in screens and new UI |
| Saving | Save slots, auto-save, save files, encryption |
| Inventory / Items / Recipes | Inventory size, the item list and crafting recipes |
| Notifications | In-game pop-up notification types |
| Phone Notifications | Real notifications on the phone, reminders |
| Permissions | Location, camera, microphone, motion, notifications, storage |
| Online (PlayFab & Photon) | Leaderboards, cloud saves, multiplayer |

More settings live in *☰ → Build Settings* (app name, icon, loading screen, exports).

## Project

- **Prefabs:** ready-made objects, and **My Prefabs** (your own). Tap or drag into the Scene.
- **Objects:** plain shapes, text, images, tilemaps, 3D primitives, cameras and lights.
- **Sprites:** about 100 drawn sprites (characters, enemies, items, nature, vehicles, blocks, UI icons and frames).
- **UI:** widgets grouped as Buttons, Inputs, Lists, Controls, Charts, HUD, Game Systems, Navigation, Loading, Animated.
- **Models:** ready-made 3D models.
- **Sounds:** import MP3, WAV, OGG or M4A files.
- **Components:** every component, to drag onto an object.

## Scripts

Every Visual Script in the game, as cards showing the object, a mini map, which events start it and how many nodes it has. Tap a card to open the Node Editor. **Saved scripts** are your reusable scripts. See [Visual scripting](#/guide/visual-scripting).

## Console

What your game reports while it runs: the **Debug Log** instruction and node, `P.log()` / `P.warn()` in scripts, warnings (like spawning a template that doesn't exist) and errors with their stack.

- Filter by Log / Warn / Error, search, tap a message for details, **Show object**.
- **Watch** variables: pinned chips show live values.
- **Command line:** `score`, `score = 10`, `send win`, `page shop`, `pause`, `step`, `restart`, `level 2`, `speed 0.5`, `objects`, `find Player`, `help`.

Errors never freeze the game: an error in a component, node or script is logged and the game keeps running.

## Play mode

**▶ Play** runs the game from what's in the editor. The play bar has:

- **Stop**, **Pause** and **Step** (one frame while paused).
- **Inspect:** pause without the PAUSED screen, tap any object (even spawned ones) to see and change its live position, velocity and components.
- **Stats:** FPS, objects, bodies, state, time and variables.
- **Console** with a red count for errors.
- **⋮:** put the bar above or below the game, floating, or as a small button.

## Levels

The **Level** button above the Scene lists the levels, switches between them and adds new ones: **New 2D Level** or **New 3D Level**. Each level has its own mode, so a game can mix 2D and 3D. When a level is won, the next one starts and variables like `score` carry over. See [Core concepts › Levels](#/guide/concepts/games-levels-and-scenes).

## Prefabs

Long-press an object → **Make Prefab**. It appears in *Project › Prefabs › My Prefabs*; place copies by tapping or dragging. Copies keep their own position, rotation, scale and name, and share everything else with the prefab. Change a copy and its banner offers **Apply to all** (updates every copy in every level), **Revert**, or **Unpack** (makes it a plain object).

## Find Problems

*☰ → Find Problems…* checks every level, object, component and script: missing templates, objects that don't exist, scripts with no event, empty images, uses of deleted My Instructions. Tap a problem to go to it.

## Saving, history and backups

- **Projects are saved only when you save them.** Tap the **Save** button in the top bar (or ☰ → *Save*, or Ctrl/⌘ S). A dot after the game's name means there are unsaved changes.
- **New games and templates aren't kept until you save them.** Before another project replaces the open one (opening a game, starting a new one, importing), it asks: **Save**, **Don't save** or **Cancel**. The browser also asks before the tab is closed with unsaved changes.
- **If the app is closed with unsaved changes**, they are kept aside (not saved as the project), and next time it asks whether to bring them back.
- To save as you go instead, pick *Straight away*, *After a few seconds* or *Every 10 seconds* in *☰ → Preferences… › Save my work*.
- Saved projects live in the browser's database (IndexedDB).
- *☰ → Restore Earlier Version…* keeps a restore point every few minutes (the last 12).
- *☰ → Back Up All Games* makes one file with every game and your saved scripts; **Restore** brings it back on any device.
- *☰ → Export / Import JSON* moves a single game.

> **Warning:** Safari can clear a website's storage after a week without a visit. Add the editor to your Home Screen (or back up) to keep your games safe on iPhone.

## Preferences

*☰ → Preferences…* holds settings for you on this device: theme and accent colour, panel text size, reduce motion, snapping steps, grid, showing all colliders, vibration, how often to save and keep restore points, opening on the Home screen or the last game, and **Check for updates**.
