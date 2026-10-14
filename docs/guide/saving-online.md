# Saving, online and the phone

## Ways to keep progress

| Way | Keeps | Best for |
|---|---|---|
| **Best score** (`settings.saveBest`) | `{best}` | Arcade games |
| **Auto-save variables** (`settings.saveProgress`) | Variables, the level, the inventory | Clicker and idle games |
| **Save slots** | Variables, the level, positions, what was collected or destroyed, the inventory | Adventures, RPGs |
| **Save files** (Easy Save style) | Any key you choose: numbers, text, lists, dictionaries, objects | Settings, unlocks, anything custom |
| **Auto Save / Save Manager** components | One object's state / chosen variables | Persistent worlds |
| **Cloud save** (PlayFab) | Variables in the player's online account | Playing on several devices |

Everything except cloud saves is stored on the player's device, per game.

### Save slots

Save with a **Save Point** prefab, a Button set to *save game* (Amount = slot), the *Save game* instruction, the **Save Game** node, the Pause Menu widget, or `scene.saveGame(1)`. Load with *Load game*, the Continue Menu widget or `scene.loadGame(1)`. *Game Settings › Saving › Continue from save slot 1 on start* resumes automatically.

A save keeps:

- the variables and the level;
- each saved object's position, rotation, visibility and own variables;
- which objects were removed (collected coins stay collected);
- the inventory, the equipment and the recipes learned.

```js
scene.saveGame(2); scene.hasSave(2); scene.loadGame(2); scene.deleteSave(2);
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

### Photon (real-time multiplayer)

- **Join Room** (by name, or any open room), **Leave Room**, or join when the game starts. The **Multiplayer Lobby** widget has status, Play Online and Leave.
- **Network Sync** (on your player): everyone else sees a copy that follows you, tagged `remote`.
- **Spawn For Everyone**, and spawners or shooters that spawn for everyone.
- **Send Network Message** arrives as a normal game message; **Set Shared Variable** keeps a variable the same for everyone.
- Events: On Joined Room, On Player Joined / Left, On Online Error. Text can show `{netState}`, `{netPlayers}`, `{netRoom}`, `{pfName}`, `{pfRank}`.

```js
const o = scene.engine.online;
o.join('room1'); o.sendMessage('ping', 5); o.setShared('round', 2);
o.pfSubmit('score', 1200); o.pfLeaderboard('score');
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
