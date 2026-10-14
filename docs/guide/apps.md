# Making apps

Pocket Engine makes apps as well as games: to-do lists, notes, trackers, catalogues, club or school apps, anything with pages, lists and forms. An app uses the same editor and the same UI components as a game. On top of those it has:

- **app mode**, which removes the game's title screen and buttons;
- **data collections**: records that people add, change and delete, saved on their phone;
- **Data Lists** and **Record Forms** to show and edit those records.

You publish an app the same way as a game: as a link, an installable web app, or for the App Store and Google Play (see [Publishing](#/guide/publishing)).

## Start an app

On the home screen (or *☰ → New Game or App…*), pick the **Apps** tab:

| App | What it shows you |
|---|---|
| **Blank App** | An app bar, three pages and a bottom tab bar |
| **To-Do List** | A checklist with search, a detail page, add and edit forms, and swipe to delete |
| **Notes** | Notes with a mood, search, and editing |
| **Expense Tracker** | Amounts with categories and dates, grouped by day, with a running total |
| **Arcade** | An app with three games inside, best scores and a list of every play |

Each one works as soon as you press **▶ Play**. Change the colours, rename the fields, and add pages.

## App mode

*Game Settings › App › This is an app, not a game*. An app:

- opens straight on its first page, with no title screen;
- has no pause, sound or share buttons, and no game over or win screens;
- still has everything else: pages, back navigation (the phone's back gesture too), notifications, permissions and saving.

App projects show an **App** badge in your list of projects.

## Pages

An app is a set of **pages**. A page is a full-screen panel with **Show If** on the `page` variable (`page = home`, `page = detail`…), and everything inside it shows and hides with it. Pages slide in when you open them and slide back when you go back.

- Open a page with a **Button** (*go to page*), a **Bottom Nav** tab, a **Side Menu** item, or a Data List row.
- **App Bar** shows the page title (*Page titles*: `home = My Tasks`, one per line) and a ‹ Back button. The phone's back gesture, the browser's Back button and Esc go back too.
- *Add → UI & Menus → App → App Page* adds a new page. Change its value from `newpage` to your page's name.

The engine keeps other UI clear of the app bar and the bottom nav. A page that fills the screen starts below the app bar and ends above the tabs. Stretched UI can have a different **top** and **bottom margin**, for example to leave room for a search bar.

## Data collections

*Game Settings › Data* holds the app's **collections**. Each collection is a list of records, and each record has **fields**.

| Field type | Stores | In a form |
|---|---|---|
| Text | A line of text | A text box (the phone keyboard opens on it) |
| Long text | Paragraphs | A tall text box |
| Number, Money | Numbers (money shows with its symbol: $12.50) | A number keyboard |
| Yes / no | true or false | A switch (a tick in lists) |
| Date | `2026-10-14` (shown as Today, Yesterday, Oct 12…) | The phone's date picker |
| Choice | One of a list (`Low, Medium, High`) | Buttons to pick from |
| Stars (1–5) | 0–5 | Five stars to tap |
| Icon / emoji | An emoji or `art:` name | A text box |

- **Starts as** sets a field's value in a new record. `today` works for dates, and `yes` for yes/no.
- **Starting records** are what the app shows the first time it opens.
- After that, everything people add, change and delete is **saved on their phone**. It stays when they close the app and when you publish a new version.
- *Clear saved records on this phone* lets you test from the start again.
- *Add a ready-made one…* adds a ready-made collection: Tasks, Notes, Contacts, Expenses or Products.

A field named *Due date* is `due_date` in text: `{due_date}`. Every collection also keeps `{tasks_count}` up to date (its name, then `_count`).

## Data List

**Data List** shows the records of a collection as rows.

| Setting | Example |
|---|---|
| Row title, line under it, on the right | `{title}`, `{priority} · {due}`, `{amount}` |
| Icon | an emoji, or `{icon}` / `{mood}` from a field |
| Checkbox field | `done`: a circle on the left ticks the record off, and done rows are crossed out and faded |
| Search with variable | `search`: put a **Search Bar** (a Text Input of type *search*) on the same page |
| Only show | `done = no`, `amount > 10 and category = Food`, `priority = {filter}` |
| Sort | `newest first`, `oldest first`, `title (a-z)`, `amount (high-low)`, `due (low-high)` |
| Group under headings by field | `date`: puts headings like TODAY and YESTERDAY over the rows |
| Tapping a row opens page | `detail` |
| Swipe left to delete | On by default |
| When there is nothing | `No tasks. Tap + to add one.` |

The list scrolls with a flick and updates by itself whenever records change.

### The opened record

Tapping a row **opens** that record. Its fields are then available as `{record_title}`, `{record_notes}`, `{record_due}` and so on (money and dates come formatted), plus `{record_id}`. Put **Record Text** elements with those on the page the list opens. A detail page usually has:

- texts showing the record;
- an **Edit Button** (*edit opened record*, which opens the page `edit`);
- a **Delete Button** (*delete opened record*, which deletes it and goes back).

## Record Form

**Record Form** draws one input per field: text boxes with the phone keyboard right on them, number keyboards, date pickers, switches, choice buttons and stars.

- **Fields:** all of them, or a comma separated list (`Title, Notes, Due`).
- **Saving:** *new, or edits when opened with Edit* (the usual), *always adds a new record*, or *always changes the opened record*.
- **Must be filled in:** by default the first text field. An empty one turns red and the phone buzzes.
- **After saving:** go back, clear the form, go to a page, or stay.
- When editing, it also shows a **Delete** button.

The usual setup is an **Add Button (+)** (*new record*, which opens the page `add`) on the list page, a form on the `add` page, and another form on the `edit` page.

## Totals and counts

**Data Summary** (and the *Total / Count Text* widget) keeps a variable up to date with the **count**, **sum**, **average**, **min** or **max** of a field, with an optional filter. With *Show as: money* it also fills `{variable_text}` with the currency symbol:

```
Data Summary   Expenses · sum of amount → total (money)
Text           Spent so far: {total_text}
Data Summary   Tasks · count where done = no → left
Text           {left} to do
```

## Games inside apps

An app can hold games, and a game can use everything an app has. They live in the **same project**: the app is level 1, and each game is one or more further levels (each one 2D or 3D).

1. *Levels › Add a Game to This App…* (or *Game Settings › App › Add a game…*). Pick one of your own games or a game type.
   - Its levels are copied in, with what it needs from the whole project: items, recipes, quests, dialogues, data, sounds and My Instructions.
   - The app's page gets a **▶ Play** button for it.
2. A **Play Game Button** (*Add → UI & Menus → App*), the *play game* button action or the **Play a game** instruction opens a game by its level number or name (`2`, `Breakout`).
3. The game plays as a normal game, with its own title screen, pause button and end screens:
   - it starts fresh every time (score 0);
   - **Tap to play again** replays it;
   - its pause and end screens have a **‹ Back to app** button, and the phone's back gesture leaves it too;
   - a *Back to App Button* widget or the **Back to the app** instruction does the same from your own UI.
4. Back in the app, you're on the same page as before, with:
   - `{lastGame}`, `{lastScore}`, `{lastResult}` (won, lost or quit) and `{gamesPlayed}`;
   - the best score per game, as `{best_breakout}`;
   - the **Back from a game** event, for Triggers and visual scripts.
5. *Game Settings › App › Record every game played in collection* (e.g. `Scores`) adds a record for each play, with **game**, **score**, **result** and **date**. A Data List can then show a high-score table, and a Data Summary can show the best score (`max` of `score` where `game = Breakout`).

The **Arcade** app type is a complete example: three mini games, a card with **Play** and the best score for each, and a *My Scores* tab.

Going the other way, a game can use app pieces directly. A Data List, Record Form or Data Summary works in any level: for a level editor, a high-score table, a shop catalogue, or a player's journal.

## Look and motion

### Light and dark mode

App colours can be **theme colours** instead of fixed ones. In any colour box, the **@** button picks one:

| Colour | Light | Dark | For |
|---|---|---|---|
| `@bg` | very light grey | near black | Page backgrounds |
| `@card` | white | dark grey | Rows, cards, sheets |
| `@text`, `@sub` | near black, grey | white, light grey | Titles and lines under them |
| `@line`, `@field`, `@bar` | | | Dividers, text boxes, app bar and tabs |
| `@accent`, `@onAccent` | your accent colour, and text on it | | Buttons, the + button, ticks |
| `@danger`, `@good`, `@shadow`, `@dim` | | | Delete, success, shadows, dimming |

*Game Settings › Theme & Dark Mode* chooses **light**, **dark** or **follow the phone**, and the accent colour, with a preview of both.

- Every app template uses theme colours, and its app bar has a 🌙 button.
- Send the message `dark mode toggle`, `dark mode on` or `dark mode off` (from a Button or a Trigger), or put a **Toggle** on the variable `darkMode` (the Blank App's profile page has one).
- The app remembers the choice on the phone.

### Motion

Everything in an app moves with **springs**, which feel natural and settle quickly:

- **Buttons** squash when pressed and spring back, with an ink ripple. Their *Feel* is `spring` (the default), `squash`, `jelly` or `none`.
- **Pages** have more transitions in *Show If › Animation*. Those that *follow navigation* play in reverse when you go back:
  - `push (iOS, follows navigation)`: the new page slides over the old one, which moves a little to the side;
  - `shared axis (follows navigation)`: slides and fades;
  - `zoom (follows navigation)`: the new page grows in while the old one grows past you and fades;
  - `card stack (follows navigation)`: the new page rises over the old one, which sinks back and dims, like an iPhone sheet;
  - `reveal from tap (follows navigation)`: the new page opens as a circle growing from where you tapped;
  - `wipe (follows navigation)`: the new page is uncovered from the right edge;
  - `fade through`, `spring pop` and `sheet (from bottom)`.
- **One transition for every page:** *Game Settings › Motion › Page transitions* overrides the pages' own choice. Tap one of the little moving previews to pick it.
- A page or panel that scales (zoom, pop, fade through) scales **with everything inside it**, so its buttons and text grow together.
- *Show If › Stagger* brings in the page's children **one after another** (`rise`, `fade`, `pop` or `slide`).
- **Data Lists** stagger their rows in, glide rows to their new place when the order changes, highlight a row you press, stretch past the ends and show a scroll bar while scrolling. Ticks pop, done rows strike through, and a deleted row shrinks away.
- **Record Forms** bring their fields in one by one. The focused field glows, switches slide, choice buttons have a highlight that slides between them, stars fill one at a time, and a missing field shakes.

- **Search bars** show a magnifier, and an ✕ that clears the search. While a search finds nothing, the Data List says *No results*; an empty list shows its *When there is nothing* line under a soft icon.
- The **App Bar** of the app templates is flat at the top of a page and gets a shadow once you scroll (*Shadow: once scrolled*).

*Game Settings › Motion* sets the **speed** of every animation and **Reduce motion**: *follow the phone* (the default, which uses the phone's accessibility setting), *always* or *never*. With reduced motion, transitions become short fades.

### Snackbar and Undo

Swipe-deleting a row shows a **snackbar** at the bottom: *Deleted · Undo*. Undo puts the same record back. Show your own with the **Show snackbar** instruction, or in code:

```js
scene.snackbar('Saved', 'Undo', () => { /* undo it */ }, 4);   // text, button, what it does, seconds
```

### Bottom Sheet

**Spring Sheet** (*Add → UI & Menus → App*) is a panel that springs up from the bottom, like in Maps or Music. It opens on the message `open sheet` and closes on `close sheet`, a tap outside, Back, or a drag down on its handle (a fast flick closes it too). *Stops at: half, then full* opens it half way first.

### Springs in code

```js
scene.spring(entity, { x: 200, scale: 1.2 }, { feel: 'bouncy' });          // gentle, bouncy, snappy or slow
scene.spring(obj, { y: 0 }, { stiffness: 300, damping: 20, onRest: () => {} });
scene.to(entity, { alpha: 0 }, 0.4, { ease: 'springBouncy' });             // spring eases work in tweens too
```

## Triggers, visual scripts and code

| Kind | Pieces |
|---|---|
| Events | Back from a game (game, won / lost / quit), Record added, Record changed, Record deleted, Record opened (for one collection or any) |
| Conditions | Number of records (with a filter), A record is open |
| Instructions | Show snackbar, Play a game, Back to the app, Add record (`title = {name}, done = no`), Change the opened record, Delete the opened record, Open a record (first match), Clear a collection (empty it, or back to the starting records), Data summary into variable |
| Nodes | All of the above, plus **Data Value** (count / sum / average / min / max) |
| Button actions | play game, back to app, new record, edit opened record, delete opened record |

```js
const data = engine.data;
data.add('Tasks', { title: 'Buy milk', due: '2026-10-20' });   // returns the record (with an id)
data.rows('Tasks');                                            // every record
data.query('Tasks', { filter: 'done = no', sort: 'due (low-high)', search: 'milk' });
data.update('Tasks', id, { done: true });
data.remove('Tasks', id);
data.stat('Expenses', 'sum', 'amount', 'category = Food');
data.reset('Tasks');                                           // back to the starting records
scene.on('data', (collection, kind, record) => { /* kind: added, changed, deleted, cleared, reset */ });
```

## How it's saved

```js
{ settings: { app: true },
  collections: [
    { name: 'Tasks', currency: '$', keep: true,
      fields: [{ name: 'Title', type: 'text' }, { name: 'Due', type: 'date', default: 'today' },
               { name: 'Priority', type: 'choice', options: 'Low, Medium, High' }, { name: 'Done', type: 'yes/no' }],
      rows: [{ title: 'Try the app', priority: 'High', done: false }] },
  ] }
```

On the phone, each collection is kept under the app's name, so two apps never share records. `keep: false` makes a collection forget its changes when the app closes.

## Tips

- Use **Bottom Nav** for the app's main sections and **App Bar** for titles and Back.
- Use theme colours (`@bg`, `@card`, `@text`…) so the app looks right in light and dark mode. Set the **UI Theme** font for everything at once.
- Keep motion on *follow the phone*: people who turn on Reduce Motion get calm fades instead.
- Ask for **notifications** (reminders) and **permissions** (camera, location) like a game does, from *Game Settings*.
