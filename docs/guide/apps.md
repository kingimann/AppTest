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

## Triggers, visual scripts and code

| Kind | Pieces |
|---|---|
| Events | Record added, Record changed, Record deleted, Record opened (for one collection or any) |
| Conditions | Number of records (with a filter), A record is open |
| Instructions | Add record (`title = {name}, done = no`), Change the opened record, Delete the opened record, Open a record (first match), Clear a collection (empty it, or back to the starting records), Data summary into variable |
| Nodes | All of the above, plus **Data Value** (count / sum / average / min / max) |
| Button actions | new record, edit opened record, delete opened record |

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

- Want a game with data? Collections, lists and forms work in games too: a high score table, a level editor, a shop catalogue.
- Use **Bottom Nav** for the app's main sections and **App Bar** for titles and Back.
- Light colours suit apps. The templates use a white app bar, a `#f4f6fb` background and white rows. Set the **UI Theme** font for everything at once.
- Ask for **notifications** (reminders) and **permissions** (camera, location) like a game does, from *Game Settings*.
