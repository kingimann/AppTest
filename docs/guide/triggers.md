# Triggers and state machines

**Triggers** are rules written as friendly cards: **ON** something happens → **IF** conditions are true → **DO** these instructions, top to bottom. **State Machines** keep an object in one state at a time (Patrol, Chase, Attack) and switch states on events. Neither needs code, and both can use everything visual scripts can.

## Adding Triggers

- *Create → Logic & Scripts → Triggers* adds an empty Logic object and opens the editor.
- *Add Component → Logic → Triggers* adds them to the selected object; tap **Open Triggers** on the card.

Put triggers on the object they're about (a door's triggers on the door). Then "this object" and "touched by" make sense. Game-wide rules can live on any object, such as an empty "Game Manager".

## Anatomy of a trigger

```
ON   Touched by tag: player
IF   has item: Key
     coins ≥ 10
DO   Change variable: coins − 10
     Play sound: power
     Move by: y −80 over 0.5 s (wait until done)
     Show message: "The door opens!"
ELSE Show message: "It's locked."
```

### ON: events

The event decides **when** the trigger checks its conditions. There are about 50, for example:

- **Touch and input:** tapped, double-tapped, pressed and held, swiped, button pressed, keyboard key, phone shaken, phone turned.
- **Objects:** touched by tag, stops touching, comes near a tag, starts seeing a tag, lands, destroyed, takes damage, dies, gets healed.
- **Game:** game starts, level won, game over, every few seconds, after a delay (once), at random times, every frame (while conditions are true).
- **Data:** variable reaches, variable changes, message received, inventory changes, crafts an item, page changes, state machine enters a state.
- **App:** player leaves / comes back to the app, internet lost / back, permission answered, side menu opens / closes.
- **Run by another trigger / custom event:** started by name from elsewhere.

Every visual-script event node is available too (*Show N more from visual-script nodes*). The full list is in the [Trigger reference](#/ref/triggers/events).

### IF: conditions

All conditions must be true (or **any** one, if you switch the trigger to *any*). Each condition can be flipped with **NOT**. Examples: compare variable, compare two variables, has item, health ≤ 30%, number of objects with tag, touching, on ground, distance, can see, random chance, time of day, page is, text variable, list contains, event value.

Any value node works as a condition too: true / false nodes directly, number and text nodes compared with = ≠ > < ≥ ≤.

### DO: instructions

Instructions run **in order**, and some wait before the next one starts:

- **Wait** / **Wait a random time** / **Wait until a variable…**
- Motion with *wait until done* (move, rotate, scale, fade).
- **Say dialogue** (waits until closed), **Ask the player to type**, My Instructions.

Flow instructions shape the list:

| Instruction | Does |
|---|---|
| Continue only if… | Stops here unless a condition is true |
| Repeat the steps above N times | Loops back |
| Stop here | Ends the list |
| Run another trigger | Starts a named trigger, on this or any object |
| Call a custom event | Reaches visual scripts and Triggers listening for it, with a value |
| Go to state | Switches the State Machine |

There are about 95 instructions in groups: Variables, Lists, Objects, Motion, Physics, Camera, Scripts, Flow and Game. See the [instruction reference](#/ref/triggers/instructions).

### ELSE

**ELSE** steps run when the event happens but the conditions are false: a locked door, a 30% rare drop that gives coins otherwise.

## Trigger options

Tap ⚙ on a trigger. Options show as chips on its header.

| Option | Meaning |
|---|---|
| Name | Used by *Run another trigger* and in the Console |
| Runs | Every time, only once, or up to N times |
| Cooldown | Seconds before it can run again |
| Delay | Seconds between the event and the first step |
| Chance % | Only runs this often |
| All / any | All conditions, or any one |
| If it fires again while running | Run another copy, ignore it, or start over |
| Write to the Console | Logs each run (great for debugging) |

> **Good to know:** Triggers only listen while the game is playing, except events that make sense on menus: tapped, message, custom event, level won, game over, app hidden / shown, variable changes, page changes, permission, internet, phone turned, side menu and inventory.

## Event values and `@event`

Messages, custom events and many events carry a value: the damage taken, the item crafted, the speed of a landing. Read it with:

- the **Event value** condition;
- `@event` typed into any number or text field;
- `{@event}` inside a text.

```
ON   Message received: add coins
DO   Change variable: coins + @event
     Pop-up text: "+{@event}"
```

Send it with *Send message with value* (`add coins`, `25`).

## "Other"

When something touched, hit, was found by a search or called this object, it becomes **other**. Fields that say *who: self / other / name* can act on it: destroy other, damage other, push other, spawn at other.

## My Instructions and My Conditions

Build your own instructions from other instructions (with waits), and your own conditions from other conditions. They belong to the whole game, so every object's triggers, state machines and visual scripts can use them.

- **Save as My Instruction / My Condition** (next to DO and IF) turns a trigger's steps or checks into one reusable piece and puts it in their place. Pick which steps to bundle.
- **New instruction… / New condition…** starts blank or from a ready-made one (*Reward*, *Spend coins*, *Hurt the player*, *Celebrate*, *Respawn*, *Spawn a few*, *Can afford*, *Low health*, *Player is near*, *None left*…).
- **Inputs:** give it inputs (number or text, with defaults). Type `@amount` in any field inside it, or `{@amount}` in text. Tap **@** next to a value to turn it into an input.
- **How it reads:** the sentence shown where it is used, e.g. "Reward {@amount} coins".
- A trigger waits for a My Instruction to finish, unless you pick *Don't wait for it*.
- **Save to Library** keeps it on your device for other games.

In visual scripts they're the **Run My Instruction** and **My Condition** nodes.

## Templates

The Triggers editor has ready-made triggers: tap to score, touch to collect, door opens with a key, hazard hurts, spawn every 2 s, win at 100, double-tap for a super jump, hold to charge, all enemies gone → win, a treasure chest with a rare drop, a clicker with a cooldown, blink 3 times, random spawns, save coins when the player leaves, talk to an NPC.

## State Machines

A **State Machine** keeps an object in exactly one **state** at a time. Each state has:

- **When entering:** instructions that run once when it starts;
- **Every frame:** instructions that run while it lasts;
- **When leaving:** instructions that run as it ends;
- **Transitions:** "ON event, IF conditions → go to another state".

Two events exist only in state machines: **after N seconds in this state** and **when this state's actions finish**. **Any State** transitions work from every state (e.g. "takes damage → Hurt").

States are cards on a map with arrows between them. Drag to arrange. The start state has a green border. The current state is checked with the *State is* condition, and entering one fires *State machine enters a state* (other objects can react).

### Example: a patrol guard

```
Patrol   enter: Patrol back and forth       → Chase  ON comes near tag: player (200)
Chase    every frame: Move toward player     → Patrol ON after 3 s, IF NOT can see player
                                            → Attack ON comes near tag: player (40)
Attack   enter: Play animation: attack       → Chase  ON when this state's actions finish
         Damage other: 1, Wait 0.5
```

The *Patrol Guard (FSM)* prefab is a complete example.

## How it's saved

```js
{ type: 'triggers', triggers: [
  { name: 'Open door', event: { type: 'touch', tag: 'player' },
    conditions: [{ type: 'hasItem', item: 'Key', count: 1 }],
    actions: [{ type: 'giveItem', item: 'Key', amount: -1 }, { type: 'destroy', object: 'self' }],
    elseActions: [{ type: 'message', text: 'Locked.' }],
    once: true, cooldown: 0, match: 'all' },
] }
```

Each event, condition and instruction is `{ type, …its settings }`. Settings you leave out use their defaults, and conditions take `not: true`. The keys and defaults of every piece are in the [Trigger reference](#/ref/triggers).

A state machine is saved as:

```js
{ type: 'fsm', fsm: { start: 's1', any: [ /* transitions */ ], states: [
  { id: 's1', name: 'Patrol', x: 0, y: 0, enter: [ … ], stay: [ … ], exit: [ … ],
    transitions: [{ event: { type: 'near', tag: 'player', distance: 200 }, conditions: [], to: 's2' }] },
] } }
```

## Triggers or visual scripts?

Use **Triggers** for rules that read like a sentence. Use [visual scripts](#/guide/visual-scripting) when you need loops, functions, maths, lists or many branches. They can call each other:

- Triggers can run a visual script function (*Run visual script function*, *Visual script function result*).
- Visual scripts can use any Trigger piece (the **Instructions**, **Conditions** and **Events** "When: …" nodes).
- Custom events, messages and variables connect them both ways.
