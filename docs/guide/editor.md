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
- **Rect:** eight handles to resize UI elements and 2D objects; the opposite edge stays put. A live **W × H** label shows the size. Hold **Shift** (or turn on the 🔒 in *Size*) to keep its proportions; UI also snaps to other elements' edges, matching widths and heights, and equal spacing. In the Scene, the **arrow keys** nudge what's selected (Shift: 10).
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
- Rows show the icon of the object's main component (App Bar, Feed, Stories, Button…), coloured by kind (player, UI, logic, camera, light, template), and a line listing its components.
- **Quick filters** under the search: *All*, *Pages*, *UI*, *Player*, *Logic*, *Physics*, *Hidden*, *Templates* (only the ones the level has, with how many). Tap one to see only those; tap it again for everything. **Fold all / Unfold all** opens or closes every parent at once.
- **Pages** (in apps) show with a pages icon and their page name. Tapping a page also shows it in the preview, and the page showing is marked **showing**.
- **Where you are:** when the selected object sits inside another, a path at the top (*Home Page › Feed*) shows its parents. Tap one to select it; the target button scrolls the list to the selected object.
- On a phone, a row's eye and drag handle show on the selected row (and the eye on hidden objects), so the list stays clean.
- Three or more objects with the same name fold into one row (**Gem ×8**).
- **Children** sit indented under their parent with a fold arrow and a tree line. Drag a row's grip onto another object to make it a child.
- **Reorder by dragging:** drop the grip on the **top or bottom edge** of a row (a blue line shows) to move the object just above or below it, with the same parent. The order is the drawing order.
- **Rename:** double-tap a row (or press F2) and type right in the list. Enter keeps it, Esc cancels.
- **Hold any row** (or right-click it) for its menu: Rename, Duplicate, Copy, Make Child Of, Folder, Lock, Delete and more.
- The eye and the drag grip are faint until a row is selected; the selected row has an accent edge.
- **Folders:** long-press → *Put in Folder…*.
- **Filter:** player, logic, physics, UI, templates, a tag or a layer. Search matches names, tags and components.
- **Select** (tick button, or Shift-click a second row): tick several objects, then Duplicate, Group, Hide / Show, put in a Folder or Delete them together. The Inspector then edits all of them (below).
- **Keyboard** (a tablet or computer keyboard): Ctrl/⌘ Z undo, Ctrl/⌘ Shift Z or Y redo, Delete removes, Ctrl/⌘ D duplicates, Ctrl/⌘ C / V copy and paste, F2 renames, F focuses the Scene on it, ↑ ↓ move through the Hierarchy, ← → fold and unfold children, Esc deselects. Not while you're typing in a field.

## Duplicates

Things there should be one of, found twice: two **Bottom Navs** (or top tab bars) in the same place, two **App Bars**, two **Side Menus** opening on the same message, and **copies stacked** exactly on top of each other (same place, size and components, names like *Button* and *Button (1)*).

- A duplicate is easy to miss (you only see the one on top), but both work: a hidden Bottom Nav's tabs still fire, so a *More* tab under your *Profile* tab opens the Side Menu.
- The **Hierarchy** shows a yellow note at the top for each duplicate, with **Show** (selects them) and **Keep one** (keeps the one on top, deletes the others; Undo brings them back). Their rows carry a *duplicate* mark.
- The **Inspector** of either one says so too, with **Keep this one** and **Go to the other**.
- When a duplicate appears (or a project opens with one), a short message says so. **Find Problems** lists them.

## Inspector

The selected object's settings, as **components** (cards).

- **Header:** the name, with one line under it ("No tags · Layer Default · in Home Page"). Tap it for the **Details**: **tags** (chips; + adds one), **Layer** (collision layer), **Draw** layer and order and **Parent**. It stays open or closed as you leave it.
- **What it is comes first:** on a UI element with a component of its own (a Bottom Nav, a Feed, a Side Menu, a Button…), that component's card is at the top and open. *Rect Transform* and *UI Element* (where it sits) come after it, folded, the first time you select it.
- **Components:** each card can be folded. Closed cards show a summary ("run speed 240 · jump power 680").
- **Add Component:** suggestions for this object, recently used, and folders (Physics, Colliders, Controllers, Combat, Survival, Crafting, AI, Logic, UI…). Search covers everything.
- **Quick add** chips sit next to Add Component.
- **⋯ on a card:** Copy, **Paste Values** (from another component of the same type), Copy as Text, move up / down, turn off, remove, and **Docs** (opens this component's reference page).
- **Collapse all / Expand all** folds every card. The choice is remembered for the next object you select.
- **One open:** turn it on and opening a card closes the others, so you only ever scroll through one.
- **Group chips:** a big component (a Feed, a Side Menu…) shows a row of chips for its groups (Look, Behaviour, Colours, More settings…). Tap one to open that group, close the others and jump to it.
- **Top row:** back to the Hierarchy, **Search settings** (finds a setting in this object's cards), **Advanced** and **Only changed**.
- **Where it lives:** under the top row, the path to the object (Level › parent › object). Tap a parent to select it, or the level name to go back to nothing selected. On the right, **‹ 2 / 21 ›** steps to the previous or next object in the level.
- **Jump chips:** with three or more cards (and in Game Settings), a row of chips sits at the top of the Inspector, one per card. It stays there while you scroll and lights up the card you're in. Tap a chip to open that card and jump to it. Once you've scrolled down, an **↑** chip at the start takes you back to the top. A card's header also sticks to the top while you scroll through it.
- **Remembers where you were:** come back to an object (with ‹ ›, the Hierarchy or the Scene) and its cards are open or closed as you left them, scrolled to the same place.
- **Several objects ticked** (Hierarchy › Select): the Inspector shows **N objects** and the settings they share: Visible, Locked, Draw order, Rotation and Scale, the Shape's fill, outline, corners and shadow, and the Text's size, colour, alignment, font and weight. A change sets all of them; a field marked *mixed* shows the first one's value. **Move all by…** nudges them together, **Line up…** aligns UI, and the components they all have can be turned off or on together.
- **Copy one setting:** hold a field's name (or right-click it) for **Copy value**, **Paste value** and **Reset to default**. Copy a colour from one object and paste it onto another.
- **Nothing selected:** **Find an object…** searches the level by name, tag or component; tap a result to inspect it. Below it are the main objects (the player first).

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

Tap the level row at the top of the Hierarchy. The same settings open in a bigger window with **Project Settings** (the button at the top of Game Settings, or *☰ → Project Settings…*).

### Project Settings

**Project Settings** opens on an **overview**:

- a card with the project's icon, name, kind (2D game, 3D game or app), version, levels, objects and whether it's saved, with **Edit** for the name, version, *Made by*, description and category (the same ones Build Settings uses);
- buttons for **Save**, **Build Settings**, **Copy from…** and **Preferences**;
- a **tile per category**, with what's in it and how many sections: Project; Screen & start; Gameplay; Look & lighting; Controls; Saving & data; App & online; Notifications & phone; Plugins & mods. In an app, Gameplay and Controls sit apart under *For games*, since an app doesn't use them.

Tap a tile to see only that category's sections. **‹ All settings** goes back, and **Next** moves on to the following category. **Search** looks through every category at once and opens the sections that match.

**Copy from…** takes another project's settings (screen and start, look and theme, saving, controls, online and phone) for this one. Its levels, objects and name stay as they are, and Undo puts the old settings back.

**Search** shows only the sections that match. **Expand all** and **Collapse all** open or fold every section. Settings that show or hide others update straight away.

The sections are:

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

- **Tabs:** all six (Prefabs, Objects, Sprites or Models, UI, Sounds, Components) fit on screen in two rows. The panel opens on the tab you used last and keeps each tab's scroll position.
- **Search all assets:** type to search every tab at once. Results are grouped by tab, and each tab shows how many matches it has.
- **Section chips:** tabs with several sections (Survival, Crafting, Buttons, Charts…) get a row of chips under the search. Tap one to jump to that section; the chip of the section you're in lights up.
- **Tiles or list:** the button next to search switches between compact tiles and a one-line-per-item list.
- **Create** opens the Create screen on the matching category.

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
- **Missing pages:** when the app starts, every Bottom Nav tab, Side Menu item, App Bar button, Inbox and *go to page* button that opens a page the app doesn't have is listed (source **Pages**): a warning for most, a note for the social pages that are made while it runs.
- **Copy for help:** when there are warnings or errors, a yellow copy button appears next to the search (also ⋯ › *Copy for Help*). It copies a report to paste to whoever is helping you: the project, the page, the device, every problem, then the whole log.
- **Watch** variables: pinned chips show live values. Start with the 👁 button next to the search.
- On a phone, the message kinds and the search stay at the top and the command line stays at the bottom; only the messages scroll.
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

- **Auto-save is on:** a few seconds after each change, the project is saved. A small dot on the top bar's **Save** button shows it: blue and blinking while a change waits, green once it's saved. Its tooltip says when.
- **Tap Save** (or ☰ → *Save*, or Ctrl/⌘ S) to save right away. **Hold it** (or right-click) to choose: auto-save after a few seconds, straight away or every 10 seconds, save when you leave the app, or **Only when I tap Save**. ☰ → *Auto-save: On / Off* switches it too, and so does *Preferences… › Save my work*.
- **With auto-save off**, projects are saved only when you save them: a dot after the game's name means there are unsaved changes.
- **New games and templates (with auto-save off) aren't kept until you save them.** Before another project replaces the open one (opening a game, starting a new one, importing), it asks: **Save**, **Don't save** or **Cancel**. The browser also asks before the tab is closed with unsaved changes.
- **If the app is closed with unsaved changes**, they are kept aside (not saved as the project), and next time it asks whether to bring them back. They're kept in the device's database, so big games with pictures and sounds are kept too. The Save button's tooltip says when you last saved, and it gives a little check when you do.
- Saved projects live in the browser's database (IndexedDB).
- *☰ → Restore Earlier Version…* keeps a restore point every few minutes (the last 12), of unsaved work too (marked *not saved yet*), so an hour of changes is never one tap away from being lost.
- *☰ → Back Up All Games* makes one file with every game and your saved scripts; **Restore** brings it back on any device.
- *☰ → Export / Import JSON* moves a single game.

> **Warning:** Safari can clear a website's storage after a week without a visit. Add the editor to your Home Screen (or back up) to keep your games safe on iPhone.

## Preferences

*☰ → Preferences…* holds settings for you on this device. Its sections fold (Look and Saving start open; a folded section shows its current choice), and **Search** finds a preference. They cover: theme and accent colour, panel text size, reduce motion, snapping steps, grid, showing all colliders, vibration, how often to save and keep restore points, opening on the Home screen or the last game, and **Check for updates**.
