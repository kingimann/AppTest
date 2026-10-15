# Saving, online and the phone

## Ways to keep progress

| Way | Keeps | Best for |
|---|---|---|
| **Best score** (`settings.saveBest`) | `{best}` | Arcade games |
| **Auto-save variables** (`settings.saveProgress`) | Variables, the level, the inventory | Clicker and idle games |
| **Save slots** | Variables, the level, positions and sizes, texts, what was collected or destroyed, objects made while playing, the inventory | Adventures, RPGs |
| **Save files** (Easy Save style) | Any key you choose: numbers, text, lists, dictionaries, objects | Settings, unlocks, anything custom |
| **Auto Save / Save Manager** components | One object's state / chosen variables | Persistent worlds |
| **Cloud save** (PlayFab) | Variables, or a whole save slot, in the player's online account | Playing on several devices |

Everything except cloud saves is stored on the player's device, per game.

### Save slots

Save with a **Save Point** prefab, a Button set to *save game* (Amount = slot), the *Save game* instruction, the **Save Game** node (it can also give the slot a name, like `{area}`), a **Save Slots** menu, the Pause Menu widget, or `scene.saveGame(1)`. Load with *Load game*, a Save Slots menu, the Continue Menu widget or `scene.loadGame(1)`.

A save keeps:

- the variables and the level;
- each saved object's position, rotation, size, visibility, text and own variables (lists and dictionaries too);
- which objects were removed (collected coins stay collected);
- objects made while playing (spawned bullets, placed blocks, dropped items), which are made again on load;
- the inventory, the equipment and the recipes learned;
- for the slot card: its name, the level, when it was saved, the time played and a small picture of the game.

**Game Settings › Saving:**

- **Save slots:** how many slots there are (1–10, 3 by default).
- **Auto-save:** off, every 30 seconds, every minute, every 5 minutes, or only when leaving the game. It saves into its own **Auto-save** slot, also when the player switches apps and when a new level starts.
- **Continue from the newest save on start:** the game opens on its title screen with the most recent save (a numbered slot or the auto-save) already loaded.
- **A picture of the game in each slot.**
- **Save version:** raise it when an update changes what your game saves. A loaded save puts its version in `{loadedSaveVersion}`, so an *On Save Loaded* script can fix up older saves (give new variables a value, move renamed ones).
- **Encrypt save files** covers slots too: players can't read or edit them, and a changed slot is refused.

#### The Save Slots menu

*Add → UI → Game Systems* has three ready menus: **Save Slots (load)**, **Save Slots (save)** and **Save / Load Menu (popup)** (it opens on the message `open saves` and closes after saving or loading). Each slot is a card with its picture, name, level, *2 h ago* and the time played.

- **Tapping a slot** loads it, saves there, or shows a *Save* and a *Load* button.
- It asks before saving over a slot (*Tap again to save over it*), and each saved slot has a delete button (tap twice).
- The auto-save shows first, when auto-save is on. It can be loaded, not saved over.
- **Name new saves from a variable** (e.g. the area or the player's name). Colours, the title and the slot name (`Slot {n}`) can be changed.

#### Nodes and instructions

- **Save Game** (with a slot name), **Load Game**, **Delete Save**, **Has Saved Game**.
- **Continue (load the newest save)**, also a Button action (*continue from newest save*), and **Has any save** for a Continue button that only shows when there is one.
- **Save Slot Info**: when it was saved (*saved ago* or the date and time), the time played, the level, its name, or whether it is saved. Slots are numbers, or `auto`.
- **Newest Save Slot**, **On Slot Saved** (the event value is the slot).
- **Export Save Slot As Text** / **Import Save Slot From Text**, to move a save to another phone.
- **Delete every save of this game** (slots, the auto-save, saved progress and save files) for a *Reset progress* button.
- **Cloud Save Slot** / **Cloud Load Slot** (PlayFab): the whole slot in the player's account.

```js
const E = scene.engine;
E.saveGame(2, { label: 'Forest camp' }); E.loadGame(2); E.deleteSave(2);
E.slotInfo(2);        // { exists, label, levelName, ago, when, playTime, pic, … }
E.newestSlot();       // 2, 'auto' or 0
E.exportSave(2); E.importSave(3, text); E.deleteAllSaves();
```

### Save files

Named files of keys, like Unity's Easy Save. Nodes in the **Save Files** folder:

- **Save Key**, **Save Variable To Key**, **Load Key Into Variable** (with a *not saved yet* way out), **Load Key** as text or a number;
- **Key Exists**, **Save File Exists**, **Number Of Saved Keys**, **Seconds Since Saved** (offline earnings);
- **Delete Key**, **Delete Save File**, **Save / Load Variables**, **Save / Load Object**;
- **Copy**, **Back Up** and **Restore** files;
- **Export Save As Text** / **Import Save From Text** to move progress to another phone;
- **On Game Saved**.

*Game Settings › Saving › Save files* can **encrypt** files with a password (players can't read or edit them, and a changed file is refused) and keep the previous save as a backup. **Save Data…** in the editor browses and edits the saves Play mode wrote on your device.

```js
const saves = scene.engine.saves;
saves.save('coins', 120);                 // key, value, (file)
saves.load('coins');                      // → 120
saves.has('coins'); saves.deleteKey('coins');
saves.saveVars('coins, gems'); saves.loadVars('coins, gems');
```

## Online: PlayFab and Photon

Each game uses **your own free accounts**: *Game Settings › Online* takes a PlayFab **Title ID** and a Photon **App ID**, with test buttons. Nothing goes online until you add one, and the game keeps working offline.

### PlayFab (accounts, leaderboards, cloud saves)

- Players sign in automatically with a private ID on their device. **Set Player Name** names them on leaderboards.
- **Online Leaderboard** widget; **Post Score** node (in PlayFab, allow clients to post player statistics).
- **Cloud Save / Cloud Load** keep variables in the player's account. **Load Remote Config** turns Title Data into variables. **Track Event** records analytics.
- **Accounts:** *Add Email Login* links an email and password to the player's account, *Sign In With Email* gets the same player (scores, cloud save, items) on another phone, *Send Password Reset* emails a reset link.
- **Currency and store:** *Add Currency* adds or (with a minus amount) takes virtual currency; balances are in `pf` + the code (`{pfGC}`). *Buy Item* buys from your catalog with currency, *Get Inventory* fills the list `pfItems`, and *Owns Item* checks one. (In PlayFab, allow clients to add currency in the title's API settings.)
- **Player data:** *Save Player Data* / *Load Player Data* keep chosen variables by key (lists and dictionaries too). *Get My Stats* reads the player's statistics into variables.
- **Friends:** *Add Friend* by player name, and the Online Leaderboard's *Only my friends*.
- **Cloud Script:** *Run Cloud Script* calls one of your functions on PlayFab's servers with arguments (`amount = 5, item = gem`). An object it returns becomes variables, anything else goes in `pfResult`.
- **News and time:** *Get News* reads Title News (`pfNews`, `pfNewsTitle`, `pfNewsBody`). *Get Server Time* puts the server's clock in `pfServerTime`, for daily rewards that changing the phone's clock can't cheat.

### Photon (real-time multiplayer)

- **Join Room** (by name, or any open room), **Leave Room**, or join when the game starts. The **Multiplayer Lobby** widget has status, Play Online and Leave.
- **Network Sync** (on your player): everyone else sees a copy that follows you, tagged `remote`.
- **Spawn For Everyone**, and spawners or shooters that spawn for everyone.
- **Send Network Message** arrives as a normal game message; **Set Shared Variable** keeps a variable the same for everyone.
- **Send Network Message** can go to everyone else, everyone (you too) or just **the host**.
- **Rooms:** *Create Room* makes a room by name, or with a short code to share (`K7Q2M`, in `{netRoom}`), public or **private** (found only by its name), with settings like `mode = race, map = 2`. *Join Matching Room* joins any room with the same settings, or makes one. The **Room List** widget shows the open rooms with their players; tap one to join. The list is also in `netRooms` and `netRoomCount`.
- **Room settings:** *Set Room Setting* sets a variable for everyone in the room. It's kept for players who join later.
- **Players:** *Set My Name*, and *Set My Player Info* (team, ready, skin…). `netPlayerNames` lists everyone, `netPlayerProps` has their info, and `netAllReady` is 1 when everyone set `ready`.
- **Chat:** *Send Chat* and the **Chat Box** widget (bubbles, a text box and a Send button). The last 30 lines are in `netChat`.
- Events: On Joined Room, On Player Joined / Left, **On Became Host** (the host left and you took over), **On Room List Changed**, **On Chat Message**, On Online Error. Text can show `{netState}`, `{netPlayers}`, `{netRoom}`, `{pfName}`, `{pfRank}`.

```js
const o = scene.engine.online;
o.join('room1'); o.sendMessage('ping', 5); o.setShared('round', 2);
o.pfSubmit('score', 1200); o.pfLeaderboard('score');
o.createRoom('', { max: 4, priv: true, props: { mode: 'race' } }); o.joinMatching({ mode: 'race' });
o.setRoomProp('round', 3); o.setPlayerProp('ready', 1); o.chat('gg!'); o.sendMessage('ping', 1, 'host');
await o.pfAddCurrency('GC', 50); await o.pfBuy('sword', 'GC', 100); await o.pfCloud('grantReward', { amount: 5 });
```

## Notifications

### In-game notifications

Pop-up cards are built in. Send the message `notify:reward Daily gift|+50 coins|🎁` (type, title, text, icon, buttons), use the **Notify** node, or call `engine.notify({ type, title, text, icon, buttons, duration })`. *Game Settings › Notifications* styles each type: default, achievement, reward, level up, info, warning, error, chat, or your own.

### Phone notifications

Real notifications in the phone's notification area ("Your energy is full!"):

- **Phone Notification** node: now, in N seconds / minutes / hours / days, daily at a time, or repeating, with an id to replace older ones. **Cancel Phone Notification**.
- **Come-back reminders** (`24 | We miss you! | Your daily chest is ready`) count from when the player leaves. A **daily reminder** repeats at a time.
- Tapping one opens the game and sends `notification opened`.
- **Where they work:**
  - App builds: fully, even when the game is closed.
  - Web apps on the Home Screen (*Build Web App*): while open.
  - A single HTML file: on computers.

## Permissions

Ask for **location**, **camera**, **microphone**, **motion sensors** (tilt, shake), **notifications** or **lasting storage** with a friendly card that explains why first. Use the **Ask Permission** node (*allowed*, *not allowed*, *not supported*), the *Ask permission* instruction, or *Game Settings › Permissions › Ask on the first tap*.

Then use them: **Location** values and **Distance To Place** (treasure hunts), **On Location Changed**, **Microphone Loudness** (blow, shout or clap to play), **Permission Status**. App builds declare only the permissions the game uses, with your reasons as the iOS usage texts.

## The phone itself

| Nodes | Do |
|---|---|
| Share, Copy To Clipboard, Open Website | The phone's share sheet, clipboard and browser |
| Device Is | Portrait, landscape, touch screen, online, installed app, dark mode, reduced motion |
| Battery Level, Phone Language | Read the device |
| On App Hidden / On App Back | The player switched apps (the game pauses by itself) |
| On Screen Turned, On Connection Changed | Device events |
| Full Screen, Keep Screen On, App Icon Badge | App behaviour |
| Phone Tilt, Calibrate Tilt, On Phone Shaken | Motion |
