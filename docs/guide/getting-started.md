# Getting started

Pocket Engine is a game engine and editor that runs in your phone's web browser. It makes apps too ([Making apps](#/guide/apps)). You build games by placing objects and giving them **components** (ready-made behaviours like *Move*, *Health* or *Collectible*). For your own rules you use **Triggers** (ON something → IF true → DO this) or **visual scripts** (nodes). There's no install and no build step, and games run on any modern phone.

This page walks you through making a small game from scratch, then shows where to go next.

## Open the editor

- **On a phone:** open [the editor](../editor/). Use *☰ → Install App* to add it to your home screen: it opens full screen and works offline.
- **On a computer:** the same link works. A mouse and keyboard work too, but everything is designed for touch first.
- **Your own copy:** the whole engine is plain JavaScript files. Serve the folder over HTTP (`python3 -m http.server 8000`) and open `http://localhost:8000/editor/`. Opening the files directly with `file://` doesn't work, because ES modules need a web server.

Your games are saved automatically on the device, in the browser's storage.

## Start from a template, or from nothing

The **Home** screen (*☰ → Home*) has, from the top:

- **Your picture** (top right): your name and colour, and signing in to sync your games between devices ([Accounts](#/guide/accounts)).
- **Continue:** the game or app you have open, with a picture of it, *Play* and *Keep editing*.
- **Games | Apps:** a switch that splits everything below into two sections. It remembers your choice, and the first time it opens on the kind you have open.
- **New game** (*New 2D game*, *New 3D game*; *New games start* picks portrait or landscape) or **New app** (*New app*, *To-do list*, *App with games*): one tap each.
- **My games** or **My apps:** your projects as picture cards, newest first, showing when you last edited them. The picture is the game as it was when you last stopped Play. Each card's ⋯ menu opens, plays, renames, duplicates or deletes. My games can be filtered by 2D or 3D.
- **Game templates** (2D or 3D) or **App templates:** complete, playable starters you can change any way you like. There are platformers, third and first person 3D, top-down, shooters, racing, runners, clickers, Breakout, a voxel sandbox, a turn-based RPG, a dungeon crawler, board games and more. Opening one is the fastest way to see how a kind of game is put together. The **Apps** tab has a to-do list, notes and an expense tracker. Apps have pages, lists and forms instead of levels, and save what people add on their phone. See [Making apps](#/guide/apps).

> **Tip:** Templates are the best documentation for "how would I make X?". Open one, select its objects and look at their components in the Inspector.

## Your first game: collect the coins

We'll make a 2D game where you steer a ball, collect coins against the clock and avoid an enemy.

### 1. Create the game

Tap **New Game → Blank 2D (Portrait)**. The **Scene** view fills the screen. The bar at the bottom has **Scene · Hierarchy · Inspector · Scripts · Project · Console**.

New games show a **Getting started** checklist at the top of the Hierarchy. Each step has a button that does it for you. We'll do the same steps by hand so you see how they work.

### 2. Add a player

1. Tap the blue **+** button. The **Create** screen opens.
2. Under **Quick add**, tap **Player**. A blue circle appears in the middle of the level.
3. Tap the circle to select it, then open the **Inspector** tab.

The Inspector shows the player's components:

- **Transform:** where it is (x, y), its rotation and scale.
- **Shape:** what it looks like (a circle).
- **Move:** you steer it with a joystick or by dragging. When the game starts, Move gives the player a physics body, so walls stop it.

The player also has the **tag** `player`. Many components look for that tag: coins give points when *something tagged player* touches them.

### 3. Add coins

1. **+ → Gameplay → Coin**. Drag it somewhere away from the player.
2. Give it a tag so rules can count coins later: at the top of the Inspector, tap **+** next to *Tags* and pick `coin`.
3. With the coin selected, use the quick-action bar over the Scene: **Duplicate** a few times, and drag the copies around. Copies keep the tag.

Each coin has a **Collectible** component. When an object tagged `player` touches it, it adds 10 to the `score` variable, plays a sound and disappears.

### 4. Show the score

1. **+ → UI & Menus → Score** (or tap **Score** under Quick add).
2. A text appears at the top of the screen showing `{score}`.

`{score}` in any text is replaced by the variable's value while the game runs. Every variable works this way: `{lives}`, `{hp}`, `{time}`.

### 5. Add an enemy

1. **+ → Gameplay → Enemy**. It patrols left and right.
2. Select it and look at its **Hazard** component. *On touch* decides what happens to the player: `gameover` (the default for this enemy), `damage` (lose a life, or health if the player has a Health component) or `respawn`.

### 6. Play

Tap **▶ Play**. Drag anywhere on the left of the screen to steer with the joystick. Collect the coins, avoid the enemy. Tap **■ Stop** (or use your phone's back gesture) to return to editing.

> **Good to know:** Play always starts the game fresh from what's in the editor. Changes you make while playing (with the Inspect tool) are thrown away when you stop.

### 7. Win when every coin is collected

Let's add a rule: when no coins are left, you win.

1. Select the player and tap **Add Component → Logic → Triggers**. Tap **Open Triggers** on the new component, then **Add Trigger**. A new trigger starts as "ON Tapped".
2. **ON:** pick *Every frame (while conditions are true)*.
3. **IF:** pick *Number of objects with tag*, set the tag to `coin`, *is* `=`, value `0`.
4. **DO:** pick *Win*.

Press Play again and collect everything. "You win!" appears.

### 8. Add a time limit

Tap the top row of the **Hierarchy** (the level itself) to open **Game Settings**. Set **Time Limit (sec)** to `30`. A `{time}` variable now counts down, and the game ends when it reaches 0. Add a text showing `Time {time}` to see it.

## What you just used

| Idea | What it was | Learn more |
|---|---|---|
| Objects | Player, coins, enemy, score text | [Core concepts](#/guide/concepts) |
| Components | Move, Collectible, Hazard, Patrol | [Components reference](#/ref/components) |
| Tags | `player`, `coin` | [Core concepts › Tags](#/guide/concepts/tags) |
| Variables | `score`, `time` shown with `{braces}` | [Core concepts › Variables](#/guide/concepts/variables) |
| Triggers | Win when no coins are left | [Triggers](#/guide/triggers) |
| Game Settings | Time limit | [The editor › Game Settings](#/guide/editor/game-settings) |

## Share it

- **☰ → Build HTML** makes one file anyone can open in a phone browser.
- **☰ → Build Settings** sets the name, icon and loading screen, and can build a Home Screen web app or an App Store / Google Play project.

See [Publishing your game](#/guide/publishing).

## Where to go next

- **Without code:** [Triggers and state machines](#/guide/triggers) for rules, [Visual scripting](#/guide/visual-scripting) for anything bigger, [UI](#/guide/ui) for menus and HUDs, [Gameplay systems](#/guide/gameplay) for health, inventory, crafting and AI.
- **With code:** [Scripting with JavaScript](#/guide/scripting), then [Using the engine from code](#/guide/engine-api) and [Writing your own components](#/guide/custom-components).
- **Look things up:** every component, node and Trigger piece is listed in the [Reference](#/ref/components), with all its settings and defaults.
