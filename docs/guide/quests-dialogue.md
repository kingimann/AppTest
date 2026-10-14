# Quests and dialogue

Pocket Engine has a built-in story system. **NPCs** talk to the player with **dialogue scripts**: lines, choice buttons, conditions and actions. NPCs also hand out **quests**, which have objectives, rewards and chains. The **Quest Tracker** and **Quest Journal** show the player's quests. Triggers, visual scripts and code can start, check and finish quests and conversations.

## Quick start

1. *Create → Gameplay → Story → Quest Giver*. This adds an NPC called **Elder**. If the game has no quests or dialogues yet, it also adds a small starter story: three quests and three dialogues.
2. Add a player, then *Create → Gameplay → Story → Villager* and *Quest Spot* (an object called **Old Well**).
3. *Create → UI & Menus → Game Systems → Quest Tracker*.
4. Press **Play** and walk up to the Elder. A **!** above her head means she has a quest. Tap her, then pick **Accept**.

Look at the starter story in *Game Settings › Quests* and *Game Settings › Dialogues*, and change it into your own.

## NPCs

The **NPC (talk & quests)** component turns any object into someone the player can talk to.

| Setting | Meaning |
|---|---|
| Dialogue | A dialogue from *Game Settings › Dialogues*. If it's empty, the NPC offers its quests or says its own lines |
| Or its own lines | A short script typed straight into the component |
| Talk when | Tapped when close (the default), tapped from anywhere, the player comes close, touched by a tag, or a message |
| Close means within | The range for "close", in pixels (2D) or metres (3D) |
| Name | The name used for quests and as the speaker. Empty means the object's name |
| Portrait | An emoji or `art:` picture shown next to the text |
| Quest markers | **!** when it has a quest for you, **?** when one is ready to hand in |
| Show 💬 | A speech bubble when the player is close |
| Talking hands in its finished quests | Talking to the giver completes quests that are ready |
| Pause the game while talking | On by default. Enemies and timers stop while the box is open |
| Afterwards, send message | A message sent when the conversation ends |

An NPC is a **quest giver** for every quest whose *Given by* is the NPC's name. A giver with no dialogue makes one up on the spot:

- it thanks you for the quests you hand in;
- it offers its next available quest (**Accept** / **Not now**);
- it reminds you of the one you're doing.

What it says comes from each quest's *What the giver says* lines.

### Moving around

*Moves* (in the component's **Moving** group) sets how the NPC gets around:

- **stands still**;
- **wanders around** its starting spot, within a distance;
- **patrols a route**: object names or `x,y` points, one per line, waiting at each stop;
- **follows the player**: a companion that stays close.

Walking NPCs avoid walls and stop while you talk to them. They also stop when you come close, unless you turn that off. They can turn to face you, and 2D emoji characters waddle as they walk.

### Chatter

**Says in a bubble** holds lines, one per line, that the NPC says at random in a speech bubble: *when the player comes close*, or *every few seconds*. The **NPC says** instruction / node makes any NPC say something, and `scene.on('npcSays', (npc, text) => …)` hears it.

### Shops, selling and gifts

In the component's **Shop & gifts** group:

- **Sells:** `Item | price` lines, plus an optional amount (`Apple | 3 | 2`). Talking shows **Buy**: affordable items are listed, others say "not enough", and buying takes the money (*Money variable*, `coins` by default) and gives the item. Without a price it uses the item's *Value*.
- **Buys from you:** `Item | price`. **Sell** lists what you have that it buys.
- **Likes these gifts:** items it accepts. **Give a gift** takes one and adds 1 to its **friendship**, which is kept in the variable `friend_Name` (saved, and carried to the next level). In its dialogue, friendship is `my.friendship` (`? my.friendship >= 3 -> best friends`). The name tag shows ♥ for each point, up to 5.

An NPC with no dialogue puts **Buy / Sell / Give a gift / Bye** after its greeting (and after offering a quest). An NPC with its own dialogue gets these as sections, so its script can jump to them: `-> shop`, `-> sell`, `-> gift`, or `-> menu` for all of them. A dialogue that writes its own `# shop` (or `# sell`, `# gift`, `# menu`) section keeps its own.

### Name tags and portraits

- **Show its name above it** draws a name tag.
- The dialogue box shows the portrait of **whoever is speaking**. That's the NPC, another NPC with that name (or NPC › Name), or a dialogue with that name and a portrait, so a conversation between two characters shows both faces.

### Ready-made NPCs

*Create → Gameplay → Story* has:

- **Quest Giver**;
- **Villager**;
- **Shopkeeper** (sells a potion through choices);
- **Merchant** (a built-in shop that buys and sells);
- **Wandering Villager** (wanders, chats and likes gifts);
- **Patrol Guard**;
- **Companion** (follows you);
- **Signpost** (reads itself when you walk up);
- **Quest Spot**.

The 3D versions are capsule characters.

## Dialogue scripts

A dialogue is plain text, one instruction per line. Edit dialogues in *Game Settings › Dialogues*. The editor checks the script as you type and has a **Preview** that plays the dialogue right there.

```
? quest Firewood is done -> thanks
Elder: Hello, {name}! Winter is coming.
* (once) Who are you? -> who
* [if has Wood 5] I brought wood -> wood
* Goodbye -> END

# who
Elder: I look after this village.
-> start

# wood
@take Wood 5
@add coins 20
Elder: Wonderful! Here is something for your trouble.

# thanks
Elder: My fire is warm, thanks to you.
```

| Line | Does |
|---|---|
| `Name: text` | Shows a line spoken by *Name*. `{variables}` work inside the text |
| `text` | Narration, with no speaker |
| `* text -> section` | A choice button. Consecutive `*` lines make one set of choices. Without `->`, the choice carries on below the list |
| `* [if condition] text -> …` | A choice shown only when the condition is true |
| `* (once) text -> …` | A choice that goes away once it has been picked (remembered per NPC) |
| `# section` | A place to jump to. The script starts at the top, or at `# start` if there is one |
| `-> section` | Jump. `-> END` ends the conversation; `-> start` goes back to the top |
| `? condition -> section` | Jump only if the condition is true |
| `@command …` | Do something (see below) |
| `// comment` | Ignored |

> **Good to know:** a section ends where the next `#` begins. The conversation stops there instead of running into the next section. To carry on, add `-> section`.

### Conditions

Use conditions in `[if …]` choices, `? … ->` jumps, the *Story check* Trigger condition and the *Quest state* condition.

| Condition | True when |
|---|---|
| `has Key`, `has Wood 5` | The player has the item (at least 1, or that many) |
| `quest Firewood is active` | The quest's state is `active`, `ready`, `done`, `failed`, `available` or `locked` |
| `quest Firewood is started` / `not started` | Started (active, ready or done) / not started yet |
| `coins >= 10`, `name == Ana`, `metGuard` | Compares a variable, or checks that it's set and not 0 |
| `my.talks > 2` | Compares the NPC's own variable |
| `first` | This is the first time talking to this NPC or dialogue |
| `chance 30` | 30% of the time |
| `not …`, `… and …`, `… or …` | Combine conditions |

### Commands

| Command | Does |
|---|---|
| `@give Apple 2`, `@take Wood 3` | Adds or removes items (anything that doesn't fit drops on the ground) |
| `@set metGuard = 1`, `@set mood = happy` | Sets a variable. `my.x` sets the NPC's own variable |
| `@add coins 10`, `@add coins -5` | Adds to a variable |
| `@quest start Firewood` | Also `complete` (or `turnin`), `fail`, `reset`, `progress Name 2` and `track` |
| `@send door open`, `@send score 5` | Sends a message, with an optional value |
| `@sound coin` | Plays a sound |
| `@learn Iron Helmet` | Learns a crafting recipe |
| `@end` | Ends the conversation |

### The dialogue box

The box shows the speaker's name, the portrait and the text, which types itself out. A tap shows the whole text, or moves on if it's already shown. Choices are buttons above the box; on a keyboard, 1–9 picks them. The box follows the **UI Theme**.

The game is paused while the box is open (unless the NPC says otherwise). Triggers that react to *Dialogue choice picked* run as soon as the conversation closes.

## Quests

Make quests in *Game Settings › Quests*. Each quest has:

| Field | Meaning |
|---|---|
| Name, Icon, Description | Shown in the tracker, the journal and notifications |
| Given by | The NPC (by name) that offers it and takes it back |
| Unlocks after quest(s) | Quests that must be done first (comma separated). Until then the quest is **locked** |
| Objectives | What to do, one per line |
| In any order / one after another | Whether objectives must be done in order |
| When they're all done | *Complete right away*, or *hand in to the giver* (the quest becomes **ready** and the giver shows **?**) |
| Rewards | What the player gets when it completes |
| Starts by itself | Starts as soon as it's unlocked: good for tutorials and main quests |
| Can be done again | It can be started again once done |
| What the giver says | Offering it, after accepting, while it's going, and when you hand it in |

The editor warns about names that don't exist, such as a giver, an object to reach or a required quest.

### Objectives

```
collect Wood 5 (take) | Bring 5 Wood
kill slime 3
talk Villager
reach Old Well 80
craft Axe
use Health Potion 2
gather Wood 10
var coins >= 100
message bell rung
quest Firewood
Find the secret door
```

| Objective | Counts |
|---|---|
| `collect Item n` | Having the items. `(take)` hands them over when the quest completes |
| `kill tag n` (or `defeat`) | Objects with that tag or name dying (Health reaching 0, or a Destructible breaking) |
| `talk Name` | Talking to that NPC |
| `reach Object [distance]` | The player coming within the distance of that object (about 60 px, or 2 m in 3D, if none is given) |
| `craft Item n`, `use Item n`, `gather Item n` | Crafting, using items, and gathering from Resources |
| `var name op value` | A variable meeting a comparison |
| `message name n` | That message being sent n times |
| `quest Other` | Another quest being done |
| anything else | A custom objective. Move it on with *Advance quest objective* (Triggers / nodes) or `@quest progress` |

Add `| text` to rename an objective as the player sees it.

### Rewards

These are comma separated: `coins 50, xp 20, item Iron Sword, item Apple 3, recipe Iron Helmet, quest Slime Trouble, message open gate`.

- A number after a name adds to that variable.
- `item` gives items.
- `recipe` learns a recipe.
- `quest` starts a follow-up quest, which makes chains.
- `message` sends a message.

### Quest states

| State | Meaning |
|---|---|
| `locked` | Its *Unlocks after* quests aren't done yet |
| `available` | Can be started |
| `active` | Started; objectives are being counted |
| `ready` | Everything is done; hand it in to the giver |
| `done` | Completed and rewarded |
| `failed` | Failed (it can be started again) |

A notification shows when a quest starts, when it's ready to hand in and when it completes. These variables follow along: `questsDone`, `questsActive` and `trackedQuest`, so you can write `{questsDone} quests done` in a text. Quests carry to the next level and are kept by saves, along with the inventory.

## Showing quests

- **Quest Tracker:** the tracked quest (the newest one, or the one picked with **Track**) with its objectives and progress. It can also show every active quest. Tapping it sends `open quests`.
- **Quest Journal:** every quest with its icon and state. Tap a quest for its description, giver, objectives and rewards, plus **Track**. It can also list quests you can start. **Quest Journal (popup)** opens on `open quests`.
- **Quest Log:** an older, simple checklist driven by variables.

All three are in *Create → UI & Menus → Game Systems*.

## Triggers and visual scripts

| Kind | Pieces |
|---|---|
| Events | Quest starts, Quest progresses, Quest ready to hand in, Quest completed, Quest failed, Dialogue starts, Dialogue ends, Dialogue choice picked |
| Conditions | Quest state (`is active / ready / done…`), Story check (any dialogue condition, e.g. `has Key and coins >= 10`) |
| Instructions | Start quest, Complete / hand in quest, Fail quest, Advance quest objective, Reset quest, Track quest, Start dialogue (optionally at a section, and waits until it ends) |
| Nodes | All of the above, plus **Quest Info** (objectives done, percent, is active, is done, quests done…) |

```
ON   Message received: bell rung
IF   Quest state: Firewood is done
DO   Start dialogue: Elder (section: bell)
     Start quest: Slime Trouble
```

## From code

```js
scene.startQuest('Firewood');
scene.questState('Firewood');            // 'active'
scene.questObjectives('Firewood');       // [{ label, have, need, done }, …]
scene.advanceQuest('Find the door', 1);  // custom objectives
scene.completeQuest('Firewood');         // takes (take) items, gives rewards
scene.failQuest('Escort'); scene.resetQuest('Escort');
scene.startDialogue('Villager', { npc: entity, start: 'news' });
scene.on('questComplete', (name) => { … });
scene.on('dialogueChoice', (npc, text) => { … });
```

The parser is exported too: `parseDialogue(text)`, `DialogueRunner`, `parseObjectives(text)`, `parseRewards(text)`.

## How it's saved

```js
{ quests: [
    { name: 'Firewood', icon: '🪵', giver: 'Elder', desc: '…', objectives: 'collect Wood 5 (take)', rewards: 'coins 20, item Apple 2',
      turnIn: 'at giver', requires: '', autoStart: false, order: '', repeatable: false, offer: '…', accepted: '…', reminder: '…', thanks: '…' },
  ],
  dialogues: [
    { name: 'Villager', portrait: '🧑‍🌾', script: 'Villager: Hello!\n* Bye -> END' },
  ] }
```

Both lists live on the game (level 1), next to `items` and `recipes`. An NPC is `{ type: 'npc', dialogue: 'Villager', start: 'tapped when close', range: 100, portrait: '🧑‍🌾' }`.

## Troubleshooting

| Symptom | Check |
|---|---|
| No **!** over the giver | The quest's *Given by* must match the NPC's name (or its NPC › Name). Is it locked by *Unlocks after*? |
| Tapping the NPC says "Get closer to talk" | Walk closer, raise *Close means within*, or set *Talk when: tapped* |
| "There is no dialogue called …" | The name in the NPC or instruction must match one in *Game Settings › Dialogues* |
| An objective never counts | `kill` matches the tag or name of what dies, and it needs Health or a Destructible. `reach` needs an object with that exact name |
| A choice never shows | Its `[if …]` is false, or it was `(once)` and already picked. Use the Preview's *Pretend the player has…* to test |
| The conversation runs into the next section | Fixed: a `#` section ends the one above it. Add `-> section` to carry on |
