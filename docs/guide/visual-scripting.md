# Visual scripting

A **Visual Script** is logic built from **nodes** joined by **wires**. It can do anything code can (loops, functions, lists, maths) without typing code. There are more than 750 nodes, all listed in the [node reference](#/ref/nodes).

## Adding a script

- *Add Component → Logic → Visual Script*, then **Open Node Editor**.
- *Create → Logic & Scripts → Visual Script*.
- The **Scripts** tab lists every visual script in the game, with a mini map of each. **New Visual Script** adds one to the selected object. It asks how to start: a **Blank script** (an empty canvas) or a small working **Example** (*Tap to score*: On Tap → add 1 to score → show it; *Score every second* on an object you can't tap; *Page opened → message* in an app).

A script belongs to an object: "this object" in a node means that object.

Apps use the same scripts. In an app, *New Visual Script* puts the script on an **App Logic** object that runs on every page, and the **App** folder in Add Node (first in apps) has the page, menu, data and game nodes, plus records (*For Each Record*, *Find Record*, *Record Field*…), forms (*Text Is Valid*), dates and money, dark mode, a loading screen and phone links. See [Making apps › Visual scripts in apps](#/guide/apps).

## Reading a script

```
[On Tap] ──◆──▶ [Add To Variable  score + 1] ──◆──▶ [Punch  scale 0.3]
```

There are three kinds of node:

| Kind | Looks like | Does |
|---|---|---|
| **Event** (green, Events folder) | Only outputs | Starts a chain when something happens: On Start, On Tap, On Touch, Every N Seconds, On Message… |
| **Step** | A white ◆ input on the left | Does something, then fires its white output(s): Set Variable, Spawn, Wait, If… |
| **Value** | A round output | Gives a number (blue dot), true/false (orange) or text (green) to whatever it's wired into: Get Variable, Random, Distance, Compare… |

Two kinds of wire:

- **White wires (◆)** set the **order** things happen in. An event fires, the step after it runs, then the next.
- **Coloured wires (●)** carry **values** into a node's inputs. An input with no wire uses the value typed on the node.

A step with several white outputs chooses one: **If** has *true* / *false*, **Random Chance** has *yes* / *no*, **Raycast** has *hit* / *miss*, **Wait** has *then*. Many timed nodes (tweens, Wait For Message, Fade Screen) also have a *finished* or *done* output.

## Editing

- **Kept simple:** a script opens at a size you can read (a big one starts at its top-left; ⋯ › Fit All Nodes shows it all); the tip at the bottom is one short line and goes away after your first few visits; Add Node shows the 8 main categories (*All 30 categories* shows the rest); a node's ⋯ menu has the few things you need (What Does This Do?, Duplicate, Turn Off, Delete) and *More…* for the rest (Copy, Copy From Here, Collapse, Select Several, Remove Wires).
- **Add Node** (the + button) opens a picker with search, **Suggested next** (what usually follows the selected node), **Recently used**, **Common actions** (the handful most scripts use: Add to Variable, Set Variable, Play Sound, Show Message, Wait, If, Move By, Jump, Spawn, Destroy, Show / Hide, Win, Game Over) and one folder per category. Each name appears once: where a trigger instruction does the same as a node (Play Sound, Wait…), only the node is listed (old scripts using the other one keep working).
- **Drag a wire into empty space** (or tap a dot, then empty space) and a picker opens with only the nodes that can plug in there (*Fits here* first); the new node lands where you let go, already wired.
- **Tap a white wire › Insert Node Here…** puts an action in the middle of it (from → new node → to).
- **⋯ on a node › What Does This Do?** explains the node: what it does, each dot (▷ runs, ● values) and its settings.
- **⋯ › Variables in This Script…** lists every variable the script uses (name fields and `{braces}` in text) with how many nodes use it: **Show** selects them, **Rename** changes the name everywhere in the script at once (one Undo step).
- **Undo / Redo** in the Node Editor cover field edits too: changing a message, a sound or a number is one step (typing a whole word is one step, not one per letter). The main Undo after closing the editor also goes back one edit at a time.
- **Number fields** turn red while what you type isn't a number; leave the field and it goes back to the last good value, with a note saying so.
- **Loops wait for their passes:** in Repeat N Times, For Range, While, Repeat Until and the For Each loops, a pass with a Wait (Random Wait, Wait Until, a timed fade…) finishes before the next pass starts, and *done* runs after the last one. Repeat 3 → Wait 1 s → Add 1, then done → Set Text shows 3 after three seconds. Loops without waits still run all at once.
- **A target that doesn't exist** (Set Text on “NoSuchObject”): Check and Find Problems list it (*No object called …*), and in Play the Console warns once instead of the node silently doing nothing. Names must match exactly; tags and words like this / other / player also count.
- **Duplicate** puts the copy below (or beside) the original, never on top of it.
- Number fields also refuse numbers too big to use (like 1e309) and go back to what they had before you started typing.
- **Find Problems** (☰) also looks inside Visual Scripts: a node nothing is wired into (it never runs), a value wired to nothing, an event that does nothing yet, or a script with no Event node.
- If a node is selected, the new node is **wired to it automatically** and placed next to it. Scripts grow as a chain without touching a wire.
- **Wire** two nodes by tapping a dot and then a glowing dot, or drag from dot to dot.
- Tap a wired input to unplug it, or tap a wire to delete it.
- Drag nodes to move them; drag empty space to pan; pinch to zoom.
- ⋮ on a node: duplicate, copy, copy from here (the node and everything it leads to), collapse, turn off, remove its wires, delete.
- **Comment** nodes are sticky notes.
- Top bar: Undo / Redo, 🔍 **Find a node**, and ⋮ for **Select Several**, **Tidy Up** (lays the script out in the order it runs), **Check for Problems**, **Collapse / Expand All**, **Fit All**, **Ready-made Scripts** and **Save / Reuse Script**.
- On a keyboard: Ctrl/⌘ Z undo, Shift Z or Y redo, F find, C / V copy and paste, A select all, Delete, Esc.

## Events

| Event | Fires |
|---|---|
| On Start | Once, when the object starts |
| Every Frame | Every frame (with the time since the last frame as *dt*) |
| Every N Seconds | On a timer |
| On Tap / Double Tap / Long Press | When this object is tapped |
| On Touch / Touch End | When something tagged X starts / stops touching it |
| On Trigger Enter / Exit, On Collision Enter / Exit | Physics contacts |
| On Message | When a message is sent (the value is the Event Value) |
| On Variable Changed / When Variable Reaches | When a variable changes or crosses a value |
| On Damaged / On Death / On Healed | Health events (filter by damage type) |
| On Button / On Swipe / On Key | Input |
| On Destroyed / On Spawned | The object leaves or arrives |
| When: … | Every Triggers event as a node |

…and many more: game flow (paused, won, game over, new high score), time (at clock time, on new day, welcome back), device (battery low, dark mode, shaken, turned), UI (On UI Tapped, On Page Opened), online.

Events that carry something give it as the **Event Value** node (number) / **Event Value (text)**, and the thing that caused it as **other**.

## Variables

| Node | Scope |
|---|---|
| Set / Add To / Get Variable | The game: `score`, `coins` (shown in text as `{score}`) |
| Set / Add To My Variable, My Variable | This object only: every enemy keeps its own `hp` |
| Set Other's Variable, Other's Variable | The object in *other* |
| Get / Set Variable Of Object | Any object by name or tag |
| Change Variable | Set, add, subtract, multiply, divide, min, max, power or mod, on any of those |
| Set Text Variable, Text Variable Is | Words |
| Save / Load / Forget Variable | Kept on the device between plays |

Per-object events: **On My Variable Changed**, **When My Variable Reaches** (e.g. hp ≤ 0 → die).

## Flow

- **If** (branch on true / false), **Compare Branch**, **Switch On Number / Text**, **Random Branch**, **Weighted Random**, **Random Chance**.
- **Wait**, **Random Wait**, **Wait Until** a condition, **Wait Frames**, **Wait For Message**.
- **Repeat N Times** (with **Loop Index**), **For Range**, **For Each** (lists, dictionaries, objects with a tag, objects in a radius or layer), **While**, **Repeat Until**, **Break**, **Next Round**.
- **Do Once**, **Flip Flop**, **Cycle**, **Count To**, **Gate** with **Open / Close Gate**, **Cooldown**, **Every Nth Time**, **First Time Ever**.
- **Sequence** runs several chains in order.

Loops have a safety limit, so a mistake can't freeze the game.

## Maths and text

- **Math**, **Math (one value)**, **Clamp**, **Lerp**, **Remap**, **Random Between**, **Snap To Step**, **Ping Pong**, **Wave**, **Smooth Noise**, **Ease Curve**, **Distance / Angle Between**, **Min / Max / Average / Sum**.
- **Formula** takes up to four inputs a–d and game variables: `a * 2 + b`, `sqrt(a^2 + b^2)`, `score / 10`, `max(a, lives)`. It supports + − × ÷ % ^, comparisons, and `sin cos tan asin acos atan atan2 abs floor ceil round sqrt pow min max clamp lerp sign log exp mod random`. No code is run; a typo gives 0 and a Console warning.
- **Text:** Join Text, Fill In Text (`{variables}` plus inputs a and b), Number As Text (1.2K, 1:05, 1st, XII, +5, percent), Change Case, Replace, Part Of Text, Text Check, Text To Number, Random Word.

## Lists and dictionaries

Lists live in variables and show in text as `1, 2, 3`. Positions start at **1**.

- **Lists:** Add (end or start), Insert At, Remove (last, first, position, value), Set At, Clear, Shuffle / Sort / Reverse, Fill With Numbers, Item At, Length, Contains, Position Of, Random Item, Sum / Min / Max / Average, Keep Only, Change Every Item, Remove Duplicates, Join Two, Copy Part, Text To Array.
- **Dictionaries** (key → value, like `hp: 100, xp: 5`): Set, Get / Get Number, Add To, Has Key, Remove, Clear, Size, Keys To Array, For Each (with Loop Key and Loop Item).

## Functions and custom events

- **Function** names a piece of script. Give it **Function Input** values (a, b, c) and a **Return Value**.
- **Call Function** uses it as a value (inside a Formula, say). **Run Function** runs it as a step, optionally storing the result. A Function can **Wait** before its Return Value: Run Function then waits too, stores the result when it arrives and only then goes on to *then* (inside a loop, each round waits for it). **Call Function** is a value, so it can't wait: it gives what the Function returned straight away, or 0 if the Return comes after a Wait. **Run Function On Objects** and the Triggers *Run visual script function* go on at once and store a late result when it arrives. Functions can call each other and themselves (up to 20 deep).
- **Custom Event** + **Call Custom Event** (on this object, *other*, an object by name, everything with a tag, or everywhere, with a number or text value). Triggers can listen for the same events (*Run by another trigger / custom event*).
- **Call Function On Object** reads another script's result (the Game Manager's `canAfford`). **Run Function On Objects** runs it on many objects.
- **Delegates:** **Set Delegate** stores which Function to run in a variable and **Call Delegate** runs it, so behaviour can be swapped without rewiring. **Listen: Message → Function** subscribes a function to a message.

## Talking to other objects and scripts

| To | Use |
|---|---|
| Tell everyone something happened | Send Message / On Message |
| Run something on one object | Call Custom Event (on object), Call Function On Object |
| Read another object's data | Variable Of Object, Position Of, Other Object |
| Act on what you touched / found | Nodes with *who: other* (Destroy, Damage, Push, Set Colour…) |
| Use Trigger pieces | The Instructions, Conditions and "When: …" event nodes |
| Use a My Instruction | Run My Instruction, My Condition |

## Several scripts in one component

One Visual Script component can hold several scripts. Each runs side by side with its own events, functions and state. **Add Another Script** adds a blank one or one of your saved scripts (linked). With more than one, the card shows a row per script: on / off, name, what starts it, **Open**, and ⋯ (rename, duplicate, move, make main, save as reusable, unlink, delete). A script switched off never runs, the main one included, even when every script in the component is off.

## Reusable scripts

💾 (or *Save as Reusable Script* on the component) names and saves a script. Add it to other objects from *Add Component → My Scripts*. Copies stay **linked**: edit one and every copy updates. *Unlink* makes a copy independent. Saved scripts are kept on your device, so other games can use them too.

## Social nodes

The **Social** category works with the social app pieces (feeds, profiles, friends, messages, points). They use the same social graph as the Social Feed, Profile Header and Friends page, so a change made by a node shows everywhere at once.
- **Actions:**
  - **Follow Someone** (follow / unfollow / toggle) and **Friend Request** (send or accept / decline / cancel / unfriend);
  - **Mute / Block Someone** (on / off / toggle);
  - **Open Profile**, which sets `{profile}` and goes to their page, or to yours for your own handle;
  - **Change My Profile** (name, bio, place, website, pronouns, picture or cover);
  - **Open Edit Profile**: the editor; its *saved* output fires after Save;
  - **Create Post** (text and a picture, mentions notify people) and **Open Post Composer**;
  - **Send Direct Message** (optionally opens the chat);
  - **Save Post** (save / unsave / toggle);
  - **Send Notification** and **Mark Notifications Read**;
  - **Award Points** (for a post, story, like… with streaks and trophies);
  - **Watch Their Story**, with a *no story* output.
- **Values:**
  - **Social Check**: I follow them, they follow me, we are friends, a friend request either way, muted, blocked, has a story, is me;
  - **Social Count**: followers, following, friends, posts, mutuals, friend requests, unread notifications;
  - **Profile Field**: name, handle, bio, place, website, pronouns, picture, cover, joined, friend status. Leave *who* blank for yourself;
  - **My Points** (points, streak, trophies), **Has Achievement** and **Post Is Saved**.
- **Events:**
  - **On Follow** (followed / unfollowed), **On New Friend**, **On New Notification** (any kind, or one), **On Posted**, **On Profile Saved** and **On Achievement Unlocked**;
  - **Who (Social Event)** gives the @handle of the person the event is about. *Event Value (text)* gives the notification text, the post id or the achievement's name.

## Debugging

- **Live debug:** after you Play, each node shows how often it ran (**×12**), and value nodes show their last value (**= 3.5**). Nodes that never ran are faded.
- **Debug Log** and **Debug Log Value** write to the Console.
- **Check for Problems** finds nodes that never run, events with nothing after them, unused values, nodes turned off and wires from removed nodes.
- **Turn Off** a node (⋮) to skip it without deleting it.

## How a script is saved

```js
{ type: 'graph', graph: {
  nodes: [
    { id: 'a', type: 'tap', x: 0, y: 0 },
    { id: 'b', type: 'addVar', x: 300, y: 0, params: { name: 'score', amount: 1 } },
    { id: 'c', type: 'punch', x: 600, y: 0 },
  ],
  links: [
    { from: { node: 'a', port: 'then' }, to: { node: 'b', port: 'in' } },   // white wire
    { from: { node: 'b', port: 'then' }, to: { node: 'c', port: 'in' } },
  ],
} }
```

A value wire goes from a value node's `out` port to the input's key: `{ from: { node: 'r', port: 'out' }, to: { node: 'b', port: 'amount' } }`. Every node's type, ports and settings are in the [node reference](#/ref/nodes).

## Ready-made scripts

★ in the Node Editor has templates: chase the player, tap 5 times → win, spawn a ring of 8, hit → blink + hurt, run / idle by speed, an enemy with its own HP, explode on a custom event, waves of enemies, a daily reward with a streak, a 30-second countdown, keyboard controls, asking the player's name, a shop badge and more.
