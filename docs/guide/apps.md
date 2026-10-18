# Making apps

Pocket Engine makes apps as well as games: to-do lists, notes, trackers, catalogues, club or school apps, anything with pages, lists and forms. An app uses the same editor and the same UI components as a game. On top of those it has:

- **app mode**, which removes the game's title screen and buttons;
- **data collections**: records that people add, change and delete, saved on their phone;
- **Data Lists** and **Record Forms** to show and edit those records.

You publish an app the same way as a game: as a link, an installable web app, or for the App Store and Google Play (see [Publishing](#/guide/publishing)).

## Start an app

On the home screen, tap **New app** for a blank app, or pick the **Apps** tab under *Start from a template* (also in *☰ → New Game or App…*):

| App | What it shows you |
|---|---|
| **Blank App** | An app bar, three pages and a bottom tab bar |
| **To-Do List** | A checklist with search, a detail page, add and edit forms, and swipe to delete |
| **Notes** | Notes with a mood, search, and editing |
| **Expense Tracker** | Amounts with categories and dates, grouped by day, with a running total |
| **Arcade** | An app with three games inside, best scores and a list of every play |
| **Social** | Home (stories you can post, reply to and like, then For you / Following), Explore, Reels, Messages (direct and group chats), Saved (bookmarked posts and comments) and a profile you can edit (cover, picture, bio, place, website) with Posts / Replies / Media / Likes tabs, a social Side Menu, plus Notifications, Friends and profile pages for everyone (from a Profiles collection), all connected by follows, friends and notifications (see [Social app UI](#/guide/ui)) |

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
- **Everything comes with what it needs:** components, page templates and links have requirements. When something needs a page or data the app doesn't have, the editor **adds it for you** and says so in a message with **Undo**, for example: *Added the “rewards” page so the Bottom Nav tab “Rewards” works*. That covers:
  - **Data:** for example, an Inbox needs *Messages* (and *Reads*), a Feed needs *Posts* and *Comments*, Friends needs *Follows* and *Friends*, Notifications needs *Notifications*.
  - **Pages it opens:** for example, an Inbox opens the *chat* page, and a Feed's message button opens it too.
  - **Every page a link opens:** Bottom Nav tabs, Side Menu items, App Bar buttons, buttons set to *Go to page*, forms that go to a page after saving, and components' page fields. Known names get a ready-made page (inbox, chat, settings, profile, notifications, friends, marketplace…). Any other name gets a page with its title and a note saying what it was made for. The page uses exactly the name the link uses, so the link works straight away.

  - **Everything else something names:**
    - in-app **products** (a Buy Product node), **quests** (Start Quest, Quest State), **dialogues** (an NPC, Start Dialogue) and **items** (Can Craft, Has Equipped), each made with a starter entry to fill in;
    - data **collections** a node or trigger uses (ready-made when known, otherwise an empty one);
    - **templates** a Spawn copies, and **notification types**.

    This covers component settings you changed, Visual Script nodes, and Triggers and State Machine instructions. A setting that doesn't apply with the current choices is ignored.
  - **Near-miss names:** a link to “signin” when your page is called “sign-in” (or “Sign In”) is pointed at your page instead of making another. The running app also finds a page whose name differs only in dashes, spaces or capitals. Ready-made pages keep the name their links expect (Sign In is *signin*, Create Account is *signup*) when you keep the suggested name.

  It works in a chain: a new chat page brings its own Messages data.
  - **While typing:** typing a page name into a button waits until you stop, so you get one page, not one per letter.
  - **Opening a project:** anything an existing project is missing is added when it opens, with Undo.
  - **Deleting something a part needs** (the chat page, a collection, a page a tab opens) asks first instead of putting it back behind your back: **Add it** or **Undo**.
  - **Asking instead:** *Preferences › Editing › Missing pages & data › Ask me first* asks before adding. Then the **Hierarchy** lists what's missing with **Make them for me**.
- **A button that opens a page you haven't made yet:**
  - **Social pages are made while the app runs.** These are *inbox* / *messages*, *chat*, *notifications*, *friends*, *saved*, *marketplace* and *achievements*. A Messages tab with no Messages page still opens your messages, and the Console says it was made for you.
  - **Any other missing page** shows the first page, with a warning in the Console.
  - **In the editor:** the tab, menu item or App Bar button says *(no page yet)*, and its ⋯ menu has **Make the “inbox” page**. That builds the ready-made page (Messages with an Inbox, Chat, Notifications, Friends…), so you can keep and change it.
- **App Bar** shows the page title (*Page titles*: `home = My Tasks`, one per line) and a ‹ Back button. The phone's back gesture, the browser's Back button and Esc go back too.
- **Page templates:** ready-made pages you can find in three places:
  - **+ Add › Page Templates** (or search, e.g. “settings”) makes a new page from one;
  - **Add to page › Templates** (the Page card, or **+ Add** in the UI editor while a page shows) puts a template's content on the page you're on, under what's already there;
  - the page button › **New Page…** opens the same gallery.
  Pick one, name it, and it's built for you. Everything on it lines up by itself and uses your theme colours; change any of it afterwards.
  - **Start:** Blank, Welcome, Coming Soon, Dashboard.
  - **Account:** Sign In and Create Account (Supabase accounts): a logo, a short welcome, the boxes, a main button, an “or” line and a **Continue with Google** button, with **Forgot password?** under the password box. The `{authError}` line takes no room until sign-in fails. Then Settings (switches, a volume slider, rows, Sign out), My Profile (an editable profile with Posts / Replies / Media / Likes), Account.
  - **Social:** Feed (stories, a post box, For you / Following), Explore, Messages, Chat, Notifications, Friends.
  - **Shop:** Marketplace, Product (picture, price, sizes, Add to cart), Game Shop (coins & gems and items), Pricing (Free / Pro / Team plans).
  - **Info:** About, FAQ, Contact (a form with Send), List (search and your records).
  - **Game:** Main Menu, Levels, Leaderboard, Achievements.
  - Pages that are usually tabs ask whether to add them to the bottom bar and side menu. Sign-in, chat, product and other one-off pages don't. An app's first page shows when it starts.
- *Add → UI & Menus → App → App Page* adds a new page. Change its value from `newpage` to your page's name.
- **In the editor** you see one page at a time, starting with the home page. Switch pages with the page button above the UI editor's screen, or select something on another page in the Hierarchy and the editor shows that page.

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

## Accounts and online data (Supabase)

(PlayFab and Photon are for games, and show up only once an app has a game inside it.) Apps can have their own accounts and keep data online with a free [Supabase](https://supabase.com) project: people sign up and sign in, and data collections are stored in Supabase tables. (For games, PlayFab and Photon fit better: leaderboards, cloud saves, multiplayer.)

### Connect your project

1. Create a project at supabase.com.
2. *Game Settings › Supabase › **Connect Supabase***: paste the **Project URL** and the **anon public key** (Supabase › Project Settings › API) and press **Check connection**. It shows the sign-in methods that are on and then walks you through the rest:
   - **Your tables:** the tables your project already has, each with **Use in app** (see *Your own tables* below).
   - **Online collections:** each online collection's table, ✓ found or ✗ not made yet, and **Copy setup SQL** for the missing ones.
   - **Sign-in:** what to add so people can sign in.

   It warns you if you paste the *service_role* key by mistake. (You can also type the URL and key straight into *Game Settings › Supabase*; **Test Supabase** checks them.)
3. In Supabase, *Authentication › URL Configuration*: put your app's address (where it is published) in **Site URL** and **Redirect URLs**, so email links and Google sign-in come back to it. *Sign In / Providers* turns on Google, Apple and others; turn **Confirm email** off while testing if you like.

The anon key is safe in your app. Never use the *service_role* key.

### A social app online in one click

For a social app (the Social template, or any app with Posts, Comments, Follows, Messages…): *Game Settings › Supabase › **Set up social app***. It:

- adds a required, unique **Username** to accounts and turns on a public profiles table (`accounts`);
- puts every social collection online with live updates: Posts, Comments, Stories, StoryViews, Listings, Profiles (table `social_profiles`), Points, Reads, Follows, Friends, Notifications and Messages are shared; Bookmarks are private to each person;
- sets a media bucket (`media`) for photos and videos;
- adds a **Sign In** page and a **sign-up page** with Email, Password, Name and Username, and makes people sign in first;
- shows **one SQL script**. Copy it, paste it in Supabase › SQL Editor and press Run. (*Copy all setup SQL* gives the same script later; run it again after adding a collection.)

What the script makes sure of:

- **Everyone is who they say they are.** A post, comment, message, story, follow or friend request can only be written under the signed-in person's own @handle (their username), and only they can change or delete it.
- **Likes, reposts and poll votes count each person once.** Liking someone's post adds you to its `liked_by` list and moves its count by one on the server; unliking takes you out. The same for reposts (`reposters`), poll votes (`voters`) and reactions on messages (`reactions`). "Did I like it?" comes from those lists, so each phone shows its own person's likes. Comment counts and views move by one at a time.
- **Editing your own post keeps everyone's likes.** Only the fields you changed are saved.
- **Private things stay private.** Direct messages and group chats can only be read and written by the people in them; notifications only by the person they're for (who can mark them read). A friend request can be accepted or declined only by the person it was sent to.
- **One profile per person.** Each @handle has one profile, which only its owner can change.

While someone is on the sign-in or sign-up page, the App Bar, Bottom Nav and Side Menu stay hidden; signing in from either page goes on into the app. Signed in, `{playerName}` and `{playerHandle}` are the account's name and username, so posts, comments and the profile show them.

### Sign-in

- *Add → UI & Menus → App → **Sign-in Page***: a page (`page = signin`) with Email, Password and Name boxes, **Sign in**, **Create account**, **Forgot password?**, **Continue with Google**, and `{authError}` for what went wrong.
- *Game Settings › Supabase › Sign-in page* (`signin`): while nobody is signed in, the app shows that page. After signing in it goes on to its first page (or *Page after signing in*). Signing out goes back to it. Leave it blank to make signing in optional.
- *Add → UI & Menus → App → **Account Page***: `{userName}`, `{userEmail}` and **Sign out**.
- **Buttons:** *sign in*, *create account*, *sign out*, *send password reset* and *continue with google* (the value can be `apple`, `github`…). They use the variables **email**, **password** and **name**, which the Text Inputs on the Sign-in Page fill in.
- **Variables:** `{signedIn}` (1 or 0), `{userName}`, `{userEmail}`, `{userId}`, `{authError}`.
- **Nodes** (Online): *Sign In*, *Create Account* (outputs: signed in, check email, failed), *Sign Out*, *Send Password Reset*, *Continue With Google / Apple…*, *Change My Name*, *Is Signed In*, *Signed-in Person*, and the events *On Signed In* / *On Signed Out*.
- **Triggers:** the events *Signed in*, *Signed out* and *Sign-in failed*; the condition *Signed in*; and the instructions to sign in, create an account, sign out, send a reset email and refresh online data.

### Custom accounts

*Game Settings › Supabase › Accounts* adds your own fields to accounts, like a **username**, a birthday, a bio, a role or a newsletter tick:

- **Account fields:** each one has a name, a type and a couple of checks.
  - **Types:** text, long text, number, date, yes / no, choice (with its choices) or picture (a link).
  - **Required** fields must be filled in before an account can be made.
  - **Unique** text fields (usernames) must be free. They take 2–32 letters, numbers, dots, dashes or underscores.
  - *Email*, *Password* and *Name* are built in, so they can't be account fields.
- **On the form**, each field is a variable named after it (`{username}`, `{birthday}`), which the boxes fill in. **Create account** sends them with the email, password and name. If something is missing or wrong (or the username is taken), `{authError}` says what.
- **After signing in**, `{user_username}`, `{user_birthday}`… show the signed-in person's fields, and the form variables (`{username}`…) are filled in too, ready for an edit form.
- **Add sign-up page** makes a page (`page = signup`) with Email, Password, Name and a box for each field: a picker for choices and a switch for yes / no. It also has *Create account* and *I have an account: sign in*. Point the Sign-in Page's *Create account* button at it (*go to page* `signup`).
- **Add edit-profile page** makes a page (`page = editprofile`) to change the name and fields (**Save**), and the password.
- **Buttons:** *save profile* (the name and fields from the form), *change password* (`{newPassword}`), *change email* (`{newEmail}`; Supabase emails both addresses to confirm) and *open profile* (fills `{profile_name}`, `{profile_username}`… for a username or id).
- **Nodes** (Online): *Save My Profile*, *Change Password*, *Load Profile*, and *My Account Field* (a value). Triggers have *Save my profile* and *Load a profile*.

**Profiles table.** Set *Profiles table* to **everyone can see them** (or **only the person themselves**). Then **Copy profiles SQL** and run it in Supabase › SQL Editor (run it again after adding fields).
- Each person gets a row with their id, name and account fields. It's saved when they sign up or sign in and whenever they save their profile, and only they can change it.
- With everyone able to see them, usernames are checked before signing up, and the database also refuses a taken one (unique fields get a unique index).
- **Profiles collection** adds a *Profiles* data collection on that table, so a Data List can show a people directory.


In *Game Settings › Data*, open a collection and set **Store online (Supabase)**:

| Choice | Who sees what | Good for |
|---|---|---|
| **Private to each person** | Each signed-in person sees only their own records, on every phone they sign in on. Signing out hides them. | Notes, to-dos, journals, a wallet |
| **Shared with everyone** | Everyone sees every record (even before signing in). Signed-in people add records and change or delete only their own. | Feeds, chats, reviews, a catalogue, leaderboards |
| **From a table I already have** | Whatever your table's row level security rules allow. | A database you already use, tables shared with a website or another app |

- **Copy setup SQL** (on the collection, or in Game Settings › Supabase for all of them) copies the SQL that makes the table and its security rules. Paste it in Supabase › **SQL Editor** and press **Run**. Each table keeps the record's fields in one `data` column, so adding fields later needs no change in Supabase.
- **Table name** defaults to the collection's name (`posts` for Posts).
- **Check for new records every … seconds** keeps a chat or feed up to date (0 = only when the app opens and after signing in).
- A field called **author** is filled in with the writer's name, for "Ana: Hello!" rows. Records also know `_mine` (written by you).
- Data Lists, Record Forms, Data Summaries, the Data nodes and Triggers work as before: adding, changing and deleting records goes to Supabase too. A copy is kept on the phone, so the app opens instantly and works offline. Changes made without a connection wait on the phone and are sent, in order, when it is back online.
- `{dataError}` says why something could not be saved online (for example "Sign in to save this online").
- *Refresh Online Data* (node or instruction) loads the latest records.
- **Update live when the table changes (Supabase Realtime):** new, changed and deleted records show up straight away on every phone, with no refresh. Run the setup SQL once; it turns on Realtime for the table. `{liveOnline}` is 1 while connected. It reconnects by itself and works alongside *Check for new records every … seconds*.

### Your own tables

*Store online → **From a table I already have*** (or **Use in app** in Connect Supabase) reads and writes a table you made yourself, column by column:

- **Fields come from the columns.** A column `due_date` fills the field *Due date*. **Make fields from the table** adds a field for each column, with its type (true/false → yes / no, numbers → number, date → date). The key column and `created_at`, `updated_at` and `user_id` are left out. A field can name its column exactly (`column`) for columns like `ShipDate`.
- **Key column** (default `id`) identifies each row. New rows get their id from the table, so give it a default (an identity column, or `gen_random_uuid()`).
- **Sort by** (`created_at desc`) and **Only rows where**, in Supabase's filter style (`status=eq.open`, `price=lt.10`; several with `&`).
- **Who can read and write** is up to your table's row level security rules. Signing in isn't required unless your rules need it. If a rule refuses a change, `{dataError}` says why.
- Live updates work here too. The setup SQL for an own table only turns on Realtime; it doesn't change your table.

### Media (photos, GIFs and videos)

Set *Game Settings › Supabase › **Media bucket*** (e.g. `media`) and press **Copy media bucket SQL**, then run that SQL in Supabase. It makes a public Storage bucket that signed-in people can upload to, each into their own folder. After that, the post composer uploads photos (made smaller first), GIFs and videos there, and posts keep their public links.

### Database and Edge Functions

- **Call Database Function (Supabase)** runs a Postgres function (Supabase › Database › Functions) with arguments like `player = {playerName}, amount = 10`.
- **Call Edge Function (Supabase)** runs an Edge Function, sending the same kind of arguments as its JSON body, with the signed-in person's token.

Both are nodes (Online; outputs *then*, *done*, *failed*) and Triggers instructions. The answer goes in a variable (default `{supaResult}`; objects and lists as JSON). If the answer is an object, each plain value also gets its own variable: `{ "coins": 20 }` sets `{coins}`. `{supaError}` says why a call failed.

## Games inside apps

An app can hold games, and a game can use everything an app has. They live in the **same project**: the app is level 1, and each game is one or more further levels (each one 2D or 3D).

The Levels menu (the button showing *App* at the top of the editor) keeps them apart: **App** is the app's pages, and **Games inside** lists each game. *New Blank 2D Game* and *New Blank 3D Game* add an empty game to fill in yourself. The Open Project window lists your games and apps in separate groups too.

1. *Levels › Add a Game to This App…* (or *Game Settings › App › Add a game…*). Pick one of your own games or a game type.
   - Its levels are copied in, with what it needs from the whole project: items, recipes, quests, dialogues, data, sounds and My Instructions.
   - The app's page gets a **▶ Play** button for it.
2. A **Play Game Button** (*Add → UI & Menus → App*), the *play game* button action or the **Play a game** instruction opens a game by its level number or name (`2`, `Breakout`).
3. The game plays as a normal game, with its own title screen, pause button and end screens:
   - it starts fresh every time (score 0), except for the **shared variables** (below);
   - **Tap to play again** replays it;
   - its pause and end screens have a **‹ Back to app** button, and the phone's back gesture leaves it too;
   - a *Back to App Button* widget or the **Back to the app** instruction does the same from your own UI.
4. Back in the app, you're on the same page as before, with:
   - `{lastGame}`, `{lastScore}`, `{lastResult}` (won, lost or quit) and `{gamesPlayed}`;
   - the best score per game, as `{best_breakout}`;
   - the **Back from a game** event for Triggers, and **On Back From a Game** for visual scripts (with *won*, *lost* and *quit* outputs; the event value is the score).
5. *Game Settings › App › Record every game played in collection* (e.g. `Scores`) adds a record for each play, with **game**, **score**, **result** and **date**. A Data List can then show a high-score table, and a Data Summary can show the best score (`max` of `score` where `game = Breakout`).

### Sharing variables between the app and its games

*Game Settings › App › Variables shared with games* lists the variables the app and its games have in common, like `coins, gems, name` (or `*` for all of them).

- A game opened from the app starts with the app's values: a game can show the player's name, or spend the coins they have in the app.
- When the game ends, those variables go back to the app as the game left them: coins won in the game are in the app's wallet, and a shop page in the app can sell what the game earns.
- **Play again** keeps what the game has earned so far.
- Variables not in the list stay separate: the game has its own `score`, `lives` and the rest, and the app keeps its own.
- Data collections are always shared: a game can add records the app lists, and read the app's records.

### Visual scripts in apps

Apps use the same Visual Scripts as games (and Triggers, State Machines and JavaScript too).

- *Scripts › New Visual Script* in an app puts the script on an **App Logic** object, which runs on every page. Pick *Blank script*, or the example that starts with *On Page Opened → Show Toast*. (Pages hide when they aren't shown, so app-wide scripts don't go on a page.)
- In the Node Editor, the **App** folder comes first. It has everything for apps in one place: page events and *Go To Page*, *Go Back*, the side menu and nav bars, toasts and alerts, data (*Add / Change / Delete / Open Record*, *Data Value*, record events), and games (*Play Game*, *Back to App*, *On Back From a Game*, *Opened From an App*).
- **More App nodes:**
  - **Pages:** *Current Page* (as text), *Pages To Go Back*, and *Go To Page With Value*. That last one puts a value in a variable and opens a page, e.g. tap a product and open “details” with its name.
  - **Records:**
    - *For Each Record* runs for every record that passes a filter, in a sort order.
    - *Find Record* finds the first record whose field is, contains or starts with a value, opens it, and can go to a page.
    - *On Data Changed* runs when a record is added, changed or deleted.
    - *Record Field* and *Record Field (number)* read the record you're on: inside those three, or the opened record.
    - *Set Record Field* and *Toggle Yes / No Field* change that record.
    - *Change Records Where* and *Delete Records Where* change many at once (mark all done, clear completed).
    - *Records To Array* copies one field of every record into an array.
  - **Forms:** *Text Is Valid* checks for not empty, an email, a phone number, a number, a website, a date or a length. *Clear Form Fields* empties input variables after saving.
  - **Dates and money:**
    - Dates are numbers, and **0 means now**.
    - *Now / Today* gives the date or its year, month, day, weekday, hour or minute; *Part Of Date* does the same for any date.
    - *Date As Text* shows a date as 12 Mar 2026, 14:05, Thursday, *3 min ago*, or 2026-12-25.
    - *Date Plus* adds minutes to years; *Time Between Dates* gives, e.g., days until a birthday.
    - *Text To Date* turns typed 2026-12-25 into a date.
    - *Money As Text* shows $12.50 or €12.50 (a currency code or your own symbol).
  - **App:**
    - *Set Dark Mode* turns it on, off, toggles it, or follows the phone; *Is Dark Mode* reads it.
    - *Show / Hide Loading* dims the screen with a *Loading…* card; nothing under it can be tapped.
    - *Call / Email / Text / Map* opens the phone's dialler, email, messages or maps, filled in.
    - *App Info* gives the platform (iOS, Android, web), installed or not, language, phone or tablet, online.
- Inside a game, **Opened From an App** is true when an app opened it, so a game can skip its own menus or show *Back to app* only then.

The **Arcade** app type is a complete example: three mini games, a card with **Play** and the best score for each, and a *My Scores* tab.

Going the other way, a game can use app pieces directly. A Data List, Record Form or Data Summary works in any level: for a level editor, a high-score table, a shop catalogue, or a player's journal.

## Look and motion

### Sharp, lined-up screens

- UI, text and app screens are always drawn at the phone's full sharpness (up to 3× pixels), whatever the game's *Graphics quality* setting. Only the game world is drawn at a lower resolution to save battery.
- The templates use one grid: cards, lists and search bars sit **16 px** from the screen edge, and titles and section headings line up 20 px in.
- Text that doesn't fit ends in **…** instead of being squeezed narrower.
- Children keep their own parent: a label inside a card (`parent: 'card'`) is placed inside that card, even when the card is on a page.

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

*Game Settings › Theme & Dark Mode* chooses **light**, **dark** or **follow the phone**, and the accent colour, with a preview of both. Until you pick one (for example a game you just turned into an app), theme colours follow the background: a dark background gets light text and dark fields, so nothing turns dark-on-dark.

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

### Search bars

A search bar is a **Text Input** with *Type of input: search*. Its **Search** settings:

| Setting | What it does |
|---|---|
| Suggestions while typing | From words you list, a list variable, or a **data collection** (the records that match, by a field such as `title`). The part you typed is in bold; tap one to search for it. |
| Remember recent searches | Tapping the empty bar shows your last searches (with *Clear*), and matching ones come first among the suggestions. Kept on the phone. |
| ✕ button to clear | Clears the search, while typing too. |
| Cancel button while typing | The bar slides over to make room for *Cancel*, like on an iPhone. |
| Microphone button | Search by voice where the phone's browser can listen (Chrome, Safari). |
| Message when the search changes | Sent once typing pauses (*Pause before that message*), not on every letter: load results from a server, refresh a list. |
| Message when a suggestion is picked | For acting on a picked suggestion. |

- Several hints split by `|` take turns: `Search recipes | Try “pasta” | Search by ingredient`.
- A Data List searching with the variable `search` puts how many records match in `{searchResults}` (the variable's name + `Results`).
- The To-Do and Notes templates suggest their records as you type.
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

## Native code

**Build Settings › Native code (apps)** writes your app out as a real **Flutter** app, a **SwiftUI** app or a **Kotlin Multiplatform** app (Compose, Android and iOS), with no web view: the pages, the App Bar titles, the Bottom Nav, text, buttons, Data Lists, Forms, inputs, switches, your collections and Data Stats, and the social parts (Feed, Composer, Stories, Inbox and Chat, Profile, Marketplace, Notifications, Saved, Friends, Achievements, Trending). It's a starting point to keep building in code; parts with no native version yet become placeholders marked TODO. **File › Native App Preview…** lets you try the app the way the Flutter, Kotlin or SwiftUI code builds it, and read that code, before you download it. See *Publishing › Native code (apps)*.

## Tips

- Use **Bottom Nav** for the app's main sections and **App Bar** for titles and Back.
- Use theme colours (`@bg`, `@card`, `@text`…) so the app looks right in light and dark mode. Set the **UI Theme** font for everything at once.
- Keep motion on *follow the phone*: people who turn on Reduce Motion get calm fades instead.
- Ask for **notifications** (reminders) and **permissions** (camera, location) like a game does, from *Game Settings*.
