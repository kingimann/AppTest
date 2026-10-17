# UI, screens and navigation

UI is everything drawn on the screen rather than in the world: scores, health bars, buttons, menus, shops, popups, nav bars. In Pocket Engine a UI element is a normal object with **UI** turned on, plus components that make it interactive.

## UI basics

- Turn on **UI** in an object's **UI Element** card, or add anything from *Create → UI & Menus* / *Project › UI*.
- The **UI** button above the Scene switches to the **UI editor**. It shows only the screen, with safe-area and centre guides, the 9 anchor points and screen preview chips.
- UI is positioned from an **anchor** plus an offset in design pixels, so it stays in the right place on every phone shape.
- **Snapping:** when you move or resize UI (in the UI editor or the Scene view), it snaps to things near it:
  - other elements' edges and centres on the same page;
  - next to another element, touching or a gap away (8 px by default);
  - its parent's edges and centre (and a gap inside them);
  - the screen's centre and safe-area edges, and its own anchor point;
  - **equal spacing:** halfway between the elements on either side of it, or the same gap the others in that row or column already have (both gaps are labelled).
  - While **resizing**, the edge you pull also catches the **same width or height** as another element ("= width of Pill Button" shows next to the size).
  - Pink guides show what it lined up with, and a small label shows the gap. A little buzz tells you it caught.
  - The camera and light markers stay hidden where UI covers them (select one to see it).
  - *Preferences › Editing* has **UI snaps to other UI** (on/off), **UI snap gap** (none, 4–24 px) and **UI snap strength**.
- **Keep proportions:** the 🔒 between W and H in *Size* keeps width and height in step, both when you type a size and when you drag a handle. Hold **Shift** while dragging for the same thing once. Grid snapping only rounds the side you pull.
- **Nudge with the keyboard:** after tapping something in the Scene, the arrow keys move it 1 px (**Shift**: 10 px), or everything selected. A run of taps is one undo step. Tap the Hierarchy and the arrows go back to moving through the list.
- **Place (UI Element card):** one tap puts the element at the **left, centre or right** and the **top, middle or bottom** of its page (or the screen, if it has no parent), 16 px in from the edge. The last button makes it **full width** with a 16 px margin.
- **Align several at once:** in the Hierarchy tap **Select**, tick two or more UI elements, then **Align**:
  - **Line up:** left edges, centres across, right edges, top edges, middles down or bottom edges.
  - **Spread out:** even gaps across or down (three or more; the first and last stay put).
  - **Align to:** the selection's outer edges, **the first one ticked** (it stays put and the rest line up to it), or **the page** (or the screen).
  - **Stack down, gap… / Row across, gap…:** one after another with the exact gap you type, in the order they are now (the first stays put).
  - **Size:** the same width, height, or both as the first one ticked.
- **Staying on screen:** in play, a button, field or card a little wider than the page (less 16 px each side) narrows to fit. Text set to wrap at a width wraps before the edge, so nothing runs off a narrow phone or touches the sides. Things much wider than the screen, like backgrounds, are left alone.

### Anchors

The UI Element card has a 4 × 4 anchor grid: top / middle / bottom / stretch × left / centre / right / stretch. Picking one keeps the element where it is on screen.

| Anchor | Use for |
|---|---|
| `top-left`, `top-right` | Score, lives, pause button |
| `top`, `bottom` | Titles, a bottom button bar |
| `center` | Popups, menus |
| stretch | Full-width bars, full-screen panels (`stretch: 'width' / 'height' / 'both'` with a margin) |

A UI element inside another UI element is anchored to its **parent's box**, not the screen. Build a panel, then put labels and buttons inside it.

### The safe area

UI anchored to edges stays clear of notches, the Dynamic Island, camera holes, rounded corners and the home bar, using the phone's real insets.

- **Ignore safe area** (UI Element card) lets a full-screen background go under the notch.
- *Game Settings › Screen & Safe Area* turns the safe area off, adds extra edge space, and sets **Keep UI from overlapping**: stay clear of nav bars (default), also push overlapping UI apart, or off.
- The UI editor's phone button previews iPhone notches, the Dynamic Island, Android camera holes and sideways phones.

### Scaling

UI grows and shrinks with the screen, using the level's design size (view width × height) as the reference, like Unity's Canvas Scaler. **Match width ↔ height** picks what to follow (0 = width, 1 = height, 0.5 = both), and **UI size multiplier** makes everything bigger or smaller.

## Screens: title, pause, game over, win

The engine has built-in screens: a title screen (when the level has a title), a pause screen, game over and win. Their look follows the **UI Theme**, and they animate in with springs:

| Screen | What it shows |
|---|---|
| Title | The title (it springs in and floats gently), the subtitle, your best score, and a **Play** button |
| Pause | A card with **Resume**, **Restart**, **Sound on / off**, *‹ Back to app* in a game inside an app, and the player's ⚙ Settings under it |
| Game over, You win | A card with the score counting up, your best (or a **NEW BEST!** badge), **Play again**, and *Share* or *Back to app* when they're on |
| Level complete | The score and **Next level** |

Tapping anywhere outside a button still does the main thing (start, resume, play again, next level). A win, a finished level or a new best throws confetti. Messages (`scene.message`) and the dialogue box use the theme too, and the *LEVEL 2* banner drops in.

A text that shows a variable (`{score}`, `{coins}`, `{time}`) **pops** for a moment whenever its value changes. Turn it off for one text with *Pop when the value changes* (Text › Numbers and fitting). With *Reduce motion* on, nothing pops and the screens fade in without moving.

To make your own, set any UI element's **Show when** to `title`, `paused`, `over` or `win`. It replaces that built-in screen. Everything inside a panel with *Show when* belongs to that screen too. *Game Settings › Start Screen › Custom screens* turns all the built-in screens off, so your own UI and Buttons run them.

**Button** actions include start / restart / pause / resume the game, next level, go to page, go back, show / hide an object, change a variable, open settings and save / load.

## Showing values

- **Text** with `{variables}`: `Score {score}`, `♥ {lives}`, `{coins}` (shown as 1.2K when big). Number format, shrink to fit, wrapping and text animations are in the Text card.

### Text settings

| Setting | What it does |
|---|---|
| **Rich text** (Style) | Style single words with tags: `<b>bold</b>`, `<i>italic</i>`, `<u>underline</u>`, `<s>strike</s>`, `<color=#e53935>red</color>` (or `<color=@accent>`), `<size=30>big</size>` (or `150%`), `<mark=#ffeb3b>highlight</mark>`, and icons: `<icon=star>`, `<icon=heart>`, `<icon=play>` |
| **Gradient to** + direction | Two colours, top to bottom, left to right or diagonal |
| **Letters** | As typed, UPPERCASE, lowercase or Title Case |
| **Wrap to fit its box** | On a shape, lines break at the shape's width (it follows when you resize it) |
| **At most lines** | Longer text is cut and ends in "…" |
| **Inset**, **Padding top and bottom** | Room between the text and its box's edges |
| **Auto size** | Like Unity's *Best Fit*: as big as its Font Size, smaller when it would not fit its box, wrap width or line limit (down to *Smallest size*) |
| **Numbers count up / down** | A number in the text rolls to its new value (coins, score) |
| **Shadow across / down / softness** | A shadow anywhere; softness 0 makes a hard cartoon shadow |
| **Box behind the text** | Padding for the sides and for top and bottom, roundness, and a border |
| **Appear: Typewriter** | Letters appear one by one (letters per second), again whenever the text changes, and a message when it's done |

Long text that doesn't fit its space ends in "…" instead of being squeezed. Taps on a text button hit exactly the text you see, whatever its alignment.
- **Progress Bar** (`bar`): bound to a variable, with looks (flat, striped, blocks, glossy, glowing), fill directions, a damage trail, a warning colour, a label with `{value}`, `{max}`, `{percent}`, and ring or heart-icon styles.
- **Animated Counter**, **XP Bar**, **Timer**, **Chart**, **News Ticker**, **Minimap**, **Off-screen Arrows**, **Crosshair**, **Screen Effects**.

## Controls

| Component | Does |
|---|---|
| Button | Tap / press / hold / long-press to do an action. Cost, cooldown, "only works when…", pressed look, sound and buzz |
| Toggle, Checkbox, Segmented Control, Option Picker, Stepper, Star Rating | Set variables |
| Slider | Drag to set a variable (one bound to `volume` 0–100 controls the game's sound) |
| Text Input | Type into a variable (text, number, password, e-mail, search). Search bars suggest as you type, remember recent searches, and can have Cancel and a 🎤 button (see *Making apps › Search bars*) |
| Dropdown, Keypad, Colour Picker, Carousel | Choices |
| Skill Button, Radial Menu, Prize Wheel | Game controls |
| Touch Button | Your own on-screen control: left, right, up, down, jump, fire or a message while held |
| List View / Scroll View | Scrolling lists and grids, with flick, snapping, pull to refresh and "load more" |

**List View** rows can be plain or rich:

- **Items:** one row per line, `Title | line under it | icon | on the right` (`Profile | Name, photo, bio | user`, `Language | | globe | English`). A line starting with `#` is a **section** title. Plain comma-separated items still work. A list variable can hold the same lines (or objects with `title`, `subtitle`, `icon`, `right`).
- **Icons:** an icon name (`heart`, `bell`, `lock`…) sits in a tinted tile; an emoji or a picture is shown as it is.
- **Look:** **cards** (a rounded card per row), **plain lines** (rows on the background with thin lines between, like Mail) or **inset grouped** (each section in a rounded box, like iPhone Settings). Section titles stay at the top while you scroll.
- **Search with variable:** a Search Bar or Text Field writing into it filters the rows; *When there is nothing* shows when no row is left.
- **Tapping ticks rows (pick several):** a round tick on each row; the ticked titles go into a list variable (`ticked`).
- **Swipe left to delete:** a red Delete slides out; rows from a list variable are taken out of it, with **Undo**. *Deleting sends* a message with the row's title.
- Presets under **Lists**: *Settings List (grouped)*, *Contacts List (sections)*, *Checklist (tick several)* and *Inbox List (swipe to delete)*.

**Data List** extras: with a checkbox field, **swipe right** ticks a row (or un-ticks it); with *Group under headings*, the heading of the group at the top stays there while you scroll.

**How scrolling feels:** every scrolling list, feed, page and Scroll View works like an iPhone. A flick keeps gliding at the speed your finger was moving as it let go, then slows down gently. If your finger stops before it lifts, the list stays put. A glide that reaches the end stops quickly and springs back, and a drag starts from where your finger is, with no jump.

Lists inside components are typed one item per line with `|` between the parts, like `Coin Pack | 🪙 | 5 | item:Coin Pack`. The Inspector shows them as tables.

## Pages and navigation

Apps and menus are built from **pages**. A page is a panel with **Show If** (or *Show when*) on the `page` variable. Navigation changes `page`, and pages fade or slide between each other.

- **Bottom Nav:** a complete tab bar (16 styles, badges, animations). In the Inspector each tab is a card: tap its icon to pick from the icon grid (or an emoji), type its label, and choose the page it opens from a list. **+ Add Tab** offers your pages that aren't tabs yet, **a new page** (made for you, with a fitting icon), or a ☰ tab for the Side Menu. A tab's ⋯ menu adds a badge, moves it left or right, shows its page or removes it. (*Text* edits them as lines: `Label | icon | page | badge variable`.)
  - **Two bars in the same place:** only the one on top takes taps (a hidden one underneath can't fire its tabs, like a *More* tab that opens the Side Menu). The editor points out the duplicate (see *Duplicates* in the Editor guide).
  - **Top tabs (Top Nav):** set **Position** to **Top** (or add a *Top Nav* from the UI library) and the bar runs along the top of the screen. Under an App Bar it sits just below it, and pages start below both.
    - It has its own **Top style**, picked from pictures:
      - **tabs** (a line under the whole tab, like Android);
      - **short line** (a short rounded line under bold names, like X);
      - **text** (just names, the selected one bigger, like TikTok's *Following | For You*);
      - **pills**, **chips** (every tab a chip, good for many tabs), **segmented** (a grey track and a sliding white thumb, like iOS), **folder** (the selected tab joins the page), **gradient**, **neon** and **boxed**.
    - Or pick *like the bottom bar* to use one of the 16 bottom styles.
    - The indicator slides and stretches from tab to tab.
    - **Tab widths:** fill the width, fit the names, or centred. *Auto* fills the bar when the names fit; otherwise each tab is as wide as its name and the row scrolls sideways (drag it, and it follows the selected tab).
    - **Icons** beside or above the names, **Name size**, a **Thumb / card colour** (segmented, folder) and a **Gradient** colour.
    - Badges show as a count or a dot beside the name.
    - Swipe left or right on the page to change tab. It slides up and away when it hides, and fills the notch area above it.
  - **New Page…** asks whether to add the page to the bottom bar too, and the page button's *Add “page” to the bottom bar* adds a page that's already there.
  - **Style:** pick from pictures of the 16 styles: classic, pill, underline, dot, bubble, floating, raised center, glass, minimal, **segmented** (a solid highlight slides along a floating capsule), **curved** (the selected icon rides in a circle inside a notch that slides), **neon** (a glowing line and icon), **dock** (big icons that magnify around the selected one), **spotlight** (a beam of light on the selected tab), **outline** (a ring) and **chips** (every tab a chip, the selected one filled). Floating, glass and minimal bars sit over the open page's colour; *raised center* needs an odd number of tabs; in *bubble* the selected tab widens to fit its name.
  - *Animation*: **The newly selected icon** bounces, pops, spins, wiggles or flips. *Colours*: **Glow** (neon, spotlight) and **Icon and text on the highlight** (segmented, curved, chips). Ready presets: Segmented, Curved, Neon, Dock, Spotlight, Ring and Chips.
  - **Each tab's badge:** its ⋯ menu → *Badge…* picks the variable it counts and the number it **starts at**, whether it shows a **count or a dot**, and **its own colour**. A tab with a badge shows a small badge on its card, and the editor draws a sample badge so you can see the look while designing.
  - *Badges* (for every tab): colour, number colour, size, shape (round, rounded square, square), a ring around them, **where** (icon corner, top right of the tab, beside the name, over the icon) with nudges, the **highest number shown** (then `99+`), **words** (a variable set to `NEW` shows NEW), count or dot only, showing 0, an animation (pop or shake when it changes, pulse, glow), **hide it on the selected tab**, and **opening a tab clears its badge** (for unread counts).
  - A tab can have its own **icon when selected** (a filled heart) and **colour when selected** (in its ⋯ menu).
  - *Behaviour*: **Swipe left / right to change tab**, **Tapping the current tab again scrolls its page to the top**, **Open on the last tab used** (next time the app opens), and **Pressing and holding a tab sends** a message (the tab's page is in `heldTab`).
  - *Size & shape*: label weight (normal, bold, bold when selected) and UPPERCASE labels.
  - *Background*: **Background see-through** (1 = solid, 0 = clear), **Blur what is behind** (frosted glass, like iOS), a **gradient** to a second colour, and the **line colour** on its top edge. **Pages run under the bar** (auto, yes or no): on *auto*, a see-through, blurred, floating, glass or minimal bar lets the open page reach the bottom of the screen and show through it. What's on the page (buttons, lists, the last item of a scrolling page) still stops above the bar, and dragging on the bar never scrolls the page.
- **Pages that line themselves up:** turn on the page's **Line everything up (no overlaps)**; new pages made in the editor have it on.
  - What is on the page stacks top to bottom, in its order, with an even *Gap*, on every screen size. A text that wraps to more lines, or an element hidden by its own Show If, moves what is under it.
  - Things placed side by side stay a row. Drag one above or below another to change the order.
  - A feed, chat, inbox, list or photo grid that fills the page starts under them. Elements anchored to the middle or bottom (a + button) float where they are.
  - Adding a feed, chat, inbox, notifications, friends, Data List or photo grid to any page makes it fill the room under what is already there.
- **Top and bottom bars take their own taps:** a tap or drag on the App Bar or Bottom Nav never reaches what is behind it (a feed, a page, a profile), even where the page goes under the bar.
- **Side Menu:** a drawer with a header, sections, switches, footer items and 13 styles.
  - **With a Bottom Nav:** the menu stays between the bars (the default), except when the Bottom Nav has a raised middle button (*raised center* or *curved*): then the menu goes over the bottom bar, so nothing pokes into it. Set *With a Bottom Nav / App Bar* to *cover them* for a drawer over everything.
  - **What opened it:** each time it opens in play, the **Console** says why: “Side Menu opened by the “menu” message from App Bar”, “…by a swipe from the screen edge” or “…by its own ☰ button”. Handy when it opens when you don't expect it.
  - **Tabs never open it:** for half a second after a page tab on the Bottom Nav is picked, the Side Menu stays shut, whatever asks (only the App Bar's ☰, a ☰ button or its own button can open it then). The Console notes what was stopped. While you play in the editor, a short message on screen says what opened the menu (or what was stopped), unless it was a ☰.
  - **Its ☰ sits in a top bar.** Adding a Side Menu (in a game or an app) also adds an App Bar whose ☰ opens it, unless you already have one, so pages and page templates lay out under the bar instead of running into a floating button. A project made before this, with a ☰ floating in the corner, shows **Put the ☰ in a top bar** at the top of the Side Menu's Inspector: one tap swaps the button for the bar (Undo brings it back).
  - **An App Bar you already have gets the ☰:** an App Bar set to *‹ Back only* still shows ☰ (when there's nothing to go back to) once there's a Side Menu to open. Presets of several parts (like App Layout) reuse the App Bar, Bottom Nav and pages you already have instead of adding second ones.
  - **Two pages for the same value** (two Home pages) both show at once and overlap: the Page card warns about it, with **Move its contents here and remove it**.
  - **A right-hand Side Menu's ⚙ goes on the top bar too**, as one of its right buttons, instead of floating in the corner. A project with a floating ⚙ gets **Put the ⚙ in the top bar** in the Side Menu's Inspector.
  - **In an app, new UI goes on the page the app opens on** (Stories, a post box, a list…), under what's already there, instead of floating over every page. Select another page first (or show it in the UI editor) to put it there instead.
  - In the editor's Scene view, tapping an App Bar's ☰ shows the Side Menu it opens (as tapping the menu's own ☰ does). A ☰ under the finger twice in one tap (two buttons stacked) opens the menu once instead of opening and closing it.
  - Side Menu presets use the theme colours (*@card*, *@text*, *@accent*), so the menu is light in a light app and dark in a dark one.
  - The first page you add also shows when the menu points at a page that doesn't exist yet (a menu starting on *home* with no Home page), so a game never opens on an empty screen.
  - **Keep in step with** the Bottom Nav tabs, all pages, or the tabs then the other pages. The menu then lists those pages (names, icons and badges) by itself and changes when they change. Your own items come after them.
  - **A Side Menu added to an app with a Bottom Nav or pages keeps in step with them by itself** (the tabs first, then the other pages), keeping only its switches and sections, so the menu and the bar always list the same pages. A menu that still lists pages your app doesn't have (Shop, Map…) shows **Match the Bottom Nav** (or **List my pages**) at the top of its Inspector.
  - The Bottom Nav has **Keep in step with** too (the Side Menu's pages, or all pages, with *Most tabs* and where your own tabs go). A new page added in the editor also asks to join the side menu.
  - **For social apps:** turn on *Show the signed-in person*. The header then shows who is signed in: their initials or picture, name and @handle, with **Following / Followers / Friends** counts from the social graph.
    - Tapping the person opens *Tapping the person goes to page* (their profile), and tapping the numbers opens *Tapping the numbers goes to page*.
    - Give it items with badges (`Notifications | bell | notifications | notifications_unread`) and a big **Post** button (`Post | edit | button:msg:compose`). The New Post Box opens on the message `compose`, from any page.
  - Taps on a menu, sheet or popup never reach the page under it, even when it closes on that tap. A pull down that starts near the screen edge (a feed's pull to refresh) doesn't open the menu; only a sideways swipe does.
  - **In the editor** a Side Menu shows open while it's selected. Select it in the *Hierarchy*, or tap its ☰ button or Icon Rail in the scene. A closed menu doesn't catch taps meant for the page. While it's open, taps beside it select what's there, and its ✕ closes it.
  - While it's open it always shows **over the page's own UI** (search bars, headings, buttons), whatever order you added them in, and taps on the menu never reach what's under it. A popup opened from the menu shows over the menu. The same goes for the **Side Bar (drawer)**, **Bottom Sheet**, **Popup** and an open **Dropdown**: they cover the page, and their own buttons are the only ones that react.
  - In the Inspector each item is a card: tap its icon to pick one, type its name, and choose what it does: a page (or *+ New page…*), **a switch** for a variable (music, sound, dark mode) or **a message** (help, log out). Its ⋯ menu adds a badge, a **line under it** (small text, `{variables}` work), shows its page, moves it or removes it. **+ Add** also adds section titles and lines. (*Text* edits them as lines: `Label | icon | page or msg:name or toggle:var | badge | line under it`.)
  - **Style:** pick from pictures of the 13 styles: classic, rounded, floating, glass (real frosted glass over the page), rail, fullscreen, minimal, **grouped** (items in rounded cards per section, like iPhone Settings), **gradient** (a colourful panel with white text), **neon** (a glowing edge and a glowing selected row), **compact** (smaller rows, to fit more), **pills** (each item a rounded outline) and **cards** (each item its own card).
  - **Page behind:** while the menu is open the page behind it **dims**, **blurs**, **is hidden** (filled with a colour, so only the menu shows) or **stays as it is**. Set how dark it gets and the colour. **The page still works** lets people keep using the page while the menu is open: taps outside the menu reach the page and the menu stays open until they close it.
  - **Items:** space between items, roundness of the highlight, **icons in coloured circles**, **lines between items** and a **line along its edge**.
  - **Selected row:** soft tint, filled with the accent, a bar on its edge, or text only. **Gradient to** fades the background into a second colour. Corner roundness, blur and shadow.
  - **Header:** a title, a subtitle with variables, and a picture: an icon, an emoji or a **photo** (an image address or data URL). **Tapping the header sends** a message (open a profile page). **Small print at the bottom** for a version or *Signed in as {name}*.
  - **More kinds of items** (+ Add, or *What it does* on an item):
    - **a slider** for a variable (volume, brightness), with its lowest and highest values;
    - **a choice** (Light / Dark / Auto): a segmented control that sets a variable;
    - **a progress bar** (XP, health), full at a number or at another variable;
    - **a button**: any item can *Show as a button* in its ⋯ menu, filled with the accent (Log out, Upgrade);
    - **a website link**;
    - **some text** (a paragraph, `{variables}` work), **a row of numbers** in little cards (`Coins: {coins} | Gems: {gems}`) and **some space**.
    - An item's ⋯ menu also adds **a value on the right** (`{coins}`, *3 new*) and **its own colour**.
  - **Top bar:** turn on **Top bar** for a bar across the top of the menu, with the ✕ on the left or right, a **title** (`{variables}` work; left or centred) and **icon buttons** that open a page, send a message, flip a switch (the icon dims while it's off), open a submenu or a website, each with a badge (a count, or a word like `"NEW"`). In a submenu the bar shows **‹** and the submenu's name instead. The header, if any, sits under the bar. Set its height, title size, colours and the line under it. *Side Menu (top bar)* and *Side Menu (submenus)* in the UI library start with one.
  - **Submenus:** *What it does › Open a submenu…* (or **+ Add › A submenu…**) makes an item that slides in a second list, with a **‹ Back** row at the top. Its items are listed under a *☰ submenu* row in the Inspector (in the text: `## Account`, its items, then `##`). The message `menu sub:Account` opens the menu straight at it, and **Set variable to the open submenu** tells your logic which one is showing.
  - **Folding sections:** turn on **Sections fold**, or use a section's ⋯ menu (**Can fold**, **Starts folded**), and a tap on the section title hides or shows its items (▸ / ▾). What people fold is remembered on their phone.
  - **Show only if…** (an item's ⋯ menu): the item shows only while a variable says so: `loggedIn`, `!loggedIn`, `level >= 5`, `plan = pro`. Start it with `?` (e.g. `?level >= 5`) to show it **locked** instead (greyed, with a lock, and a tap does nothing, or sends **Tapping a locked item sends**).
  - **Badges can be words:** type `"NEW"`, `"PRO"` or `"SALE"` (with quotes) instead of a variable.
  - **Search:** set **Search the items with variable** to `search` and put a Search Bar inside the menu: as people type, the menu shows only the items whose name matches, from every submenu too, or *No matches*.
  - **UI inside the menu:** put anything inside the Side Menu: a search bar, a profile card, buttons, a picture, Coins & Gems, a slider row… Tap **UI inside** under the items (or **+ Add › UI inside the menu**) and pick a block, or drag any UI object onto the menu in the Hierarchy. They show only while the menu is open, slide and fade with it, are cut off at its edges, and their buttons work.
    - **Objects inside › go:** **under the header** (the items move down to make room), **after the items** (they scroll with the list), **above the footer**, or **where I put them**. Set the space between them and line them up in the centre, left or right. Objects set to stretch across fill the menu's width. **Their buttons close the menu** is optional.
  - **More looks:**
    - Header: **card** look (the header in a rounded card), **picture beside** or **centred**, the picture's **shape** (circle, rounded, square) and **size**, the **title size**, a **background picture** (darkened at the bottom so the name stays readable) and the **header height**.
    - Items: names on the **left** or **centred**, **regular / bold / heavy** text, **arrows (›)** on page items, and section titles as **small capitals**, a **title** or **accent capitals**.
    - Colours: a **background picture** (and how strong it is), and separate colours for **icons**, the **selected item's text**, **section titles** and **lines**.
    - Size: **width as a % of the screen**.
- **App Bar:** a top bar with ‹ Back / ☰, a title that follows the page, and up to 5 right buttons.
  - **Hides by itself › when scrolling down** (on the App Bar and the Bottom Nav): scrolling any page, list, feed or chat down slides the bar away; scrolling up a little, reaching the top or changing page brings it back.
  - **Right buttons** are cards in the Inspector, shown left to right as on the bar. Each one has:
    - an **icon** (any icon, an emoji or your own);
    - what it **does**: open a page, light / dark mode, open the side menu, new post, settings, or send a message;
    - an optional **badge** variable (e.g. `notifications_unread`);
    - **Only on some pages** (blank = every page).
  - **Add Button** offers Notifications, Search, Messages, Friends, Light / dark mode, Your profile picture, New post, Settings, Side menu or a custom one. Use **⋯** to move or remove a button. Nothing is fixed: take away the bell or the search if you don't want them.
  - The **light / dark** button shows a moon in light mode and a sun in dark mode. The **profile picture** button shows your avatar.
  - As text, one per line: `icon | does | badge variable | only on pages`, e.g. `theme | dark mode toggle` or `avatar | page:profile | | profile`. The first line is the button at the right edge.
- **App Layout:** all three set up to work together.
- **Back Button**, **Sliding Page**, **Swipe Pages**, **Tab Bar**.

Navigation keeps a **history**: *Go To Page* (open, switch or start over) and *Go Back*. The phone's back gesture, the browser's Back button, Esc and an edge swipe all go back too.

```js
scene.navTo('shop');            // open the shop page (Back returns)
scene.navTo('weekly', 'tab');   // another variable, e.g. tabs inside a page
scene.navBack();
scene.canGoBack();
```

Nodes: Go To Page, Go Back, On Page Opened, On Page Closed, On Back, Page Is, Can Go Back.

**The Page card:** select a page and its settings are in one **Page** card in the Inspector:

- Its name (**Rename**, which updates the buttons and tabs that open it), **Show** it in the UI editor, **The app opens on this page**, its **Title in the App Bar**, and **Add to the bottom bar**.
- **Look:** background colour or gradient, a **background picture** (cover, fit, tile or stretch, with opacity and a tint over it so text stays readable), and space at the top and bottom.
- **What's on this page:** everything on it, top to bottom. Tap one to select it; ↑ and ↓ move it (things side by side move together); its ⋯ menu has *Duplicate* (right under it), *Add under it…* and *Delete*.
- **Add to page** (also **+ Add** in the UI editor while a page is shown) opens a picker of ready blocks in your app's theme colours, sorted into **Basics**, **Social**, **Game menu** and **Forms & settings**:

  | Block | What it is |
  |---|---|
  | Heading, Text | A big title; a paragraph that wraps |
  | Button, Outline Button, Menu Row | Open a page: pick one of yours or *A new page…* (made for you) |
  | Card | A title with a line under it |
  | Two Numbers, Two Buttons | Side by side, sharing the width on every screen |
  | Switch Row, Text Box, Search Bar | A setting, typing into a variable, searching |
  | Picture, Divider, Data List | A photo from your device, a thin line, your data's records |
  | Space, Small Print | Empty space; a small grey note |
  | Profile Header, Post, Stories Row, Chat Bubbles, Comment Box, Person Row, Notification Row | **Social:** a profile with avatar and counts, a post with likes, a row of story circles, a chat, a box to write a comment, a person with a Follow button, an activity line |
  | Game Title, Big Play Button, Menu Buttons, Level Grid, Coins & Gems, Leaderboard, Shop Item, Progress Bar | **Game menu:** a title screen, the main buttons, a grid of levels, currencies, a top-scores list, something to buy, a bar with a label |
  | Slider Row, Segmented Tabs | **Forms & settings:** a labelled slider; a row of choices |

  Each block goes under the last thing on the page, or under the one selected (what's below moves down to make room). *Any UI…* opens the full list; whatever you add while a page is shown goes on that page. **Line up** spaces everything evenly from top to bottom, and a page turns on scrolling by itself when its content gets taller than the screen.
- **Opening and closing**, **Scrolling**, **Bottom bar and access**, **Messages** (the settings below).

A page only moves when you drag it if there's something below the screen to scroll to (or pull to refresh is on).

- **Scroll when it is taller than the screen:** drag up and down (with a flick, a rubber band at the ends and a thin scroll bar). Lists and scroll views inside it still scroll on their own, and a scroll never presses a button. The App Bar can hide or gain its shadow as the page scrolls.
- **Remember where it was scrolled to**, or start at the top each time.
- **Message when it opens / closes**, and a **message the first time it opens** (load its data once).
- **Hide the bottom bar on this page** (a game, a photo, a checkout): the Bottom Nav slides away and comes back on other pages.
- **Tab that stays lit on this page** (a detail page opened from Explore keeps Explore lit), **Bottom bar on this page** (as the bar says, solid, half see-through, see-through or clear) and **Bottom bar colour on this page**. A page that asks for a solid bar also stops running under it.
- **Only open when this variable is set** (e.g. `loggedIn`), **otherwise go to page** (a sign-in page).
- **Pull down to refresh sends** a message (a spinner shows while it works), and **Scroll to the top on message**.
- **Transition speed** (1 = normal, 2 = twice as fast).

While a page is sliding away it no longer takes taps, so one tap can't press buttons on two pages.

In the editor, the **page button** above the UI editor lists the pages and has **New Page…**, **Duplicate**, **Rename** (it also updates the buttons, tabs, lists and titles that lead to the page) and **Delete**.

## Panels and windows

Any rectangle can be a panel: **Corner Radius** with **Rounded corners** (all four, top only, bottom only, left or right), fill, gradient, outline and shadow.

Add **Panel (window)** to make it a window (or add *UI › Window* / *Glass Panel*):

- A **header** with a title (left or centred), its own colour and a line under it.
- A **✕ close button** that hides it and can send a message. *Open on message* / *Close on message* show and hide it.
- **Drag to move** by the header or anywhere, kept on the screen.
- **Tap the header to fold it** to just the header (what's inside hides), tap again to open.
- **Resize from the corner**, with a smallest width and height.
- **Grow to fit what is inside** (children anchored to its top) plus padding.
- **Frosted glass**: blurs the game behind the panel (use a see-through fill).

## Popups, toasts and notifications

- **Popup** (modal or toast) and **Popup Dialog** open on a message; **Side Bar** slides in from any edge.
- Nodes: **Show Toast**, **Show Alert** (*closed*), **Ask Yes / No** (*yes* / *no*), **Ask For Text**.
- **Notifications** are built in: send `notify:reward Daily gift|+50 coins|🎁`, or use the **Notify** node. Notification types (achievement, reward, level up, info, warning, error, chat…) are styled in *Game Settings › Notifications*.

## Social app UI

Pieces for feeds, stories and profiles, like the big social apps. They're in *Project › UI › Social* and *Add Component › UI*. The **Social** app template (*New › App*) puts them together: a home timeline with stories and a post box, a photo feed, a friends feed, and a profile with a photo grid.

- **Social Feed:** a scrolling list of posts with pull to refresh (a round spinner opens in the gap under its tabs, fills as you pull and spins while it refreshes). Pick a look:
  - **timeline:** text first, small avatar, name, verified tick, @handle and how long ago. Under each post: comment, repost, like and share, with counts.
  - **photos:** a header with a ringed avatar, a big square picture, then heart / comment / send / save, the likes, the caption and "View all comments". Double-tap the picture to like it (a heart pops). Posts without a picture are skipped.
  - **cards:** each post on a card with reaction counts and Like / Comment / Share buttons.
  - Posts come from a data collection called **Posts**. Fields: author, handle, text, media (an emoji or a picture link), color, likes, liked, comments, reposts, reposted, saved, verified.
  - Until you make that collection, it shows sample posts.
  - Likes, reposts and saves are stored in the record.
  - **Tapping a post** opens it full size with its comments. If *Tapping a post opens page* is set, it goes to that page instead (`{record_text}`… work there).
  - **Comments:** the comment button opens a comments sheet with a box to write one. You can like comments, reply (which fills in @name) and delete your own. Comments are written as *Comments are written as* (default `{playerName}`). They're stored in a **Comments** collection (fields: post, author, handle, text, likes, liked) if there is one, otherwise on the device. Each comment adds to the post's comment count. *Writing a comment sends* sends a message.
  - **The opened post** shows everything in the post:
    - who reposted it, the author with a *Follow* button, the location and the text;
    - a picture carousel (swipe, double-tap to like with a heart, tap to see the pictures full screen);
    - the poll (you can vote there), the link card, LIVE / video badges;
    - the full time (7:36 PM · Oct 15, 2026), *Edited* and views (`views` field);
    - counts (comments, reposts, likes, saves), and a row of Comment, Repost, Like, Save and Share buttons;
    - a ⋯ menu: Copy text, Not interested, Mute, Report.
    *Opened posts show as* a sheet or **full screen** (with a ← back arrow; swipe right to close).
  - **Comment threads:**
    - Reply to a comment shows "Replying to @name". **Threads nest:** a reply goes under the comment it answers (replies to replies too), joined by a thread line, behind "View 2 replies" (counting the whole branch). Deep threads stop indenting after three levels. Opening a saved comment opens every thread above it.
    - **Emoji and GIFs, in place:** under the comment box are Photo, Emoji and GIF buttons. Emoji and GIF open a tray right there (tabs side by side: an emoji keyboard with categories and recently used, and the GIF finder), pushing the box up so nothing covers the comments. The chat bar has the same tray.
    - **Photos and GIFs in comments:** the picture and GIF buttons attach one (a comment can be just a picture). Tap a picture in a comment to see it full screen. Turn off *Photos and GIFs in comments* on the feed to hide them; add a **Media** field to the Comments collection to keep them online.
    - Sort comments by **Top** (most liked) or **Newest**, with *Comments sorted by* setting the start.
    - Comments by the post's author get an *Author* tag, and `pinned = yes` comments come first.
    - @mentions are coloured, and you can double-tap a comment to like it.
    - A row of quick emoji (❤️ 🙌 🔥 👏 😢 😍 😮 😂) sits above the comment box.
    - In a Comments collection, replies use a **parent** field (the comment they answer).
  - **Quote posts:** the repost button offers **Repost** or **Quote**, in the feed and in an opened post.
    - **Quote** opens the composer with the post as a card under your text. The new post's `quote` field holds the quoted post's id.
    - The feed and the opened post show the quoted post as a small card (name, @handle, two lines and a thumbnail); tap it to open that post. A deleted one shows "This post is unavailable".
    - Turn it off with *Repost button offers "Quote"*; *Quoting a post sends* sends a message.
  - **Videos:** a `media` link ending in .mp4, .webm, .mov or .m4v shows a play button in the feed. Tapping it opens the post, where the video plays with controls; it also plays in the full-screen viewer.
  - **Loading placeholders:** while a feed's Supabase collection loads, grey placeholder posts shimmer instead of "No posts yet" (*Grey placeholder posts while loading*).
  - **Share:** opens a share menu: *Share via…* (the phone's share sheet), Copy text, Copy link, Repost and Save. Set *Share button sends* to send a message instead.
- **Feed settings** (in the Inspector, grouped):
  - **Content:** collection, sort, filter, a search variable (matches name, handle and text), most posts shown, and *My field names* (e.g. `text = body, media = photo`) if your collection uses other names.
  - **Show:**
    - Which buttons appear, in what order (`like, comment, repost, share, save, views`), and the like icon (heart, thumbs up, star, fire).
    - Avatars, @handles and verified ticks on or off.
    - Time as short (3h), long (3 hours ago), a date, or hidden.
    - Counts, pictures and the ⋯ button on or off.
    - *Lines before "Show more"*.
  - **Layout:**
    - Text size, name size, avatar size and shape (circle, rounded square, square), padding and space between posts.
    - Picture shape (16:9, 2:1, square, 4:5) and roundness.
    - Lines between posts, and card roundness and shadow.
  - **Behaviour:**
    - Double-tap to like, pull to refresh, how posts appear (slide up, fade, pop, at once) and a scroll bar.
    - Messages for tapping a post, liking, comment, share and ⋯.
  - **Colours:** background, cards, text, grey text, lines, accent, liked, reposted, verified tick, card border and the avatar ring.
  - There's also a fourth look, **compact**: tighter rows with a small picture on the right.
  - **Tabs** on top (*Tabs* setting, one per line: `Label | only where…`, e.g. `For you |` and `Saved | saved = yes`).
    - *Tab look* has the same 10 styles as the Top Nav, with a sliding indicator. The picked tab can go in a variable.
    - Swipe the posts sideways to change tab, and tap the current tab to go back to the top.
    - Each tab remembers where it was scrolled to, and a dot shows on tabs with posts newer than the last time you looked.
    - *Tab widths*, *Tab name size*, *Tab row height* and *Tab row colour* change how they look.
  - **It stays between the bars:** a feed (and Chat, Inbox, Notifications and Friends) taller than the space between the App Bar and the Bottom Nav is fitted into that space. It never runs under them, on short phones or in the editor's phone frame.
  - **What is above it scrolls away:** scrolling the feed down first moves up whatever is above it on the page (stories, the post box), so the posts get the whole screen while the tabs stay under the App Bar. It all comes back when you scroll to the top. Turn this off with *What is above it scrolls away*.
  - **Pinned posts** (`pinned = yes`) come first with 📌 Pinned. A **label** field puts a small line above a post, like *Sponsored* or *Suggested for you*.
  - **#hashtags, @mentions and links** are coloured. Tapping a tag fills the search variable and sends a message; tapping a link opens it.
  - **Font** for the whole feed, colours for names, @handles, links, the post background and a pressed post.
  - **Verified tick colours:** accent, blue, gold, grey, green, or taken from the verified field (`gold`, `grey`, `green`).
  - **Buttons:** icons only, or icons with words ("12 likes", "Reply"), and their icon size. Numbers can be auto, short (1.2K) or full (1,234).
  - **Avatar rings** (none, gradient, accent) on any look, and pictures that fill (crop) or fit (whole picture).
  - **Lines between posts** can start at the text instead of the edge.
  - **Messages:** holding a post, tapping a tag, and *load more* when you scroll near the end.
  - **"↑ New posts"** button when posts arrive while you're scrolled down (tap to jump up).
  - **End text** like "You're all caught up ✨".
- **Feed features** (each turns on when a post has the field):
  - **Polls:** `poll = Dark mode | Faster sync | Fewer bugs`, with `votes = 64, 21, 33`. Tap an option to vote. The bars fill in with percentages and your pick gets a ✓. The vote is stored in `voted` (1, 2…) and *Voting in a poll sends* a message.
  - **Several pictures:** put them in `media` separated by `|` (or commas). Photos and cards become a swipeable carousel with dots and a *2/3* badge. Timeline shows a 2, 3 or 4 picture grid, and compact shows a ⧉ badge.
  - **Live and video:** `live = yes` shows a red LIVE badge. `video = yes` adds a play button, and `duration` (e.g. 0:42) adds a time badge.
  - **Link cards:** `link`, `link_title` and `link_image` show a preview card with the site name. Tapping it opens the link.
  - **Reposted by:** `reposted_by = Maya Chen` puts "🔁 Maya Chen reposted" above the post.
  - **Location and edited:** `location` shows 📍 next to the time, and `edited = yes` adds "· Edited".
  - **Top comment:** `top_comment = Leo Park: Unreal colours!` shows one comment under photos and cards.
  - **Follow button:** posts with `following = no` show a *Follow* pill. Tapping it follows that author on all their posts and sends *Following someone sends*.
  - **Reactions:** hold the like button for 👍 ❤️ 😂 😮 😢 😡. Slide to one and let go. It's stored in `reaction`, and cards show *Love*, *Haha*…
  - **⋯ menu:** Save post, Copy text, Not interested (hides the post), Mute @handle (hides all their posts) and Report post. Each has an **Undo** snackbar. Hidden posts and muted people are remembered on the device. Turn it off with *⋯ opens a menu*; *Reporting a post sends* and *Hiding or muting sends* send messages.
- **More looks:**
  - **grid:** pictures three across (2–5 columns; square, 4:5 or 9:16 tiles), like an explore page. Tiles show likes and badges for several pictures (⧉), video (▶) and LIVE. Text posts become coloured tiles. Tap one to open it.
  - **reels:** one post per screen with the like, comment, repost, share and ⋯ buttons down the side, and the person and text at the bottom.
    - Swipe up or down for the next post. Videos play.
    - Text-only posts become big text on a colour.
  - **magazine:** the newest post as a big card, then a compact list.
- **Photos, GIFs and videos:**
  - **Videos** play muted, looping, while they're on screen (*Videos play (muted) as they scroll by*). They pause when they scroll away and play with sound and controls in the opened post.
  - **GIFs** animate in the feed with a *GIF* badge.
  - A video in `media` is a link ending in .mp4, .webm, .mov or .m4v, or anything starting with `video:`.
- **Threads:** a post with `reply_to` (another post's id) comes right under that post, joined to it by a line between the avatars, and a thread can go on and on. A reply whose post isn't shown says *↩ Replying to @someone*. Turn it off with *Threads*.
- **Search:** a feed's search variable now understands:
  - several words (all must match, in the name, handle, text or place);
  - `#tag` (that exact tag);
  - `@someone` or `from:someone` (their posts, or posts mentioning them);
  - `has:photo`, `has:video`, `has:gif`, `has:poll` and `has:link`.

  With no results it says *No results for "…"*.
- **Your own posts** get their own ⋯ menu: **Edit post** (opens the composer with the text; saving marks it *Edited*), **Pin to top**, Save, Copy and **Delete post** (with Undo). Other people's posts get **Message @someone**, which opens a chat with them (*Messaging opens page*, default `chat`).
- **Search chip:** while a feed's search variable has something in it (a tapped #tag, a search box), a pill at the top shows it; ✕ clears it.
  - The menu also has **Add to thread**, which posts a reply to your own post that continues the thread. The opened post's ⋯ has Edit, Add to thread, Pin and Delete for your posts too.
- **Editing comments:** your own comments have **Edit** next to Reply and Delete. Change the text in place and press Enter or Save. Edited comments say *· edited*.
- **Search Bar:** a bar that opens a search screen:
  - recent searches (with ✕ and *Clear all*);
  - trending #tags, people, and filter chips (📷 Photos, 🎬 Videos, GIFs, 📊 Polls);
  - suggestions for tags and people as you type.

  Picking something puts it in its variable (`q`). Give a Social Feed the same *Search with variable* and it shows the results. *Searching goes to page* can open a results page.
- **Chat:** a conversation in bubbles, like a messaging app. It works for direct messages and group chats.
  - Yours are on the right in the accent colour, theirs on the left with avatars, plus names in group chats.
  - Times appear between messages more than 15 minutes apart, as *Today · 7:32 PM*, *Yesterday · …*, the weekday for this week, then the date (*Today / Yesterday between days*). Emoji-only messages show big, and photos show in the bubble.
  - **Swipe a message right to reply** (a reply arrow appears; let go past it). *Swipe a message right to reply* turns it off.
  - Tap the bar at the bottom to type; Enter sends and 🖼️ sends a photo. Tapping elsewhere closes it.
  - **Press and hold a message:**
    - react with ❤️ 😂 😮 😢 😡 👍 (*Reactions*);
    - **Reply** (the reply quotes it; tap the quote to jump to the original);
    - **Copy**;
    - **Forward**: pick a person or a group you're in; the copy is marked *↪ Forwarded*;
    - **Pin** / **Unpin**: the message shows in a **Pinned message** banner at the top of the chat for everyone in it (tap the banner to jump to it). Pinning adds a note like “Alex pinned …” to the chat;
    - for your own messages, **Edit** (marked *Edited*) and **Unsend** (with Undo).
  - Double-tap a message for ❤️.
  - Under your last message: *Sending…*, *Sent*, then **Seen** (in a group, *Seen by Maya, Leo* or *Seen by everyone*).
  - **Ticks** next to your messages: a little clock while sending, **✓** sent, **✓✓** once someone has seen it (or answered after it), blue when everyone has (*✓ sent / ✓✓ seen*).
  - **↓ back to the newest:** scroll up and a round button appears above the bar, with how many new messages came in; tap it to jump down.
  - **Typing and sample replies:** with sample or local chats (not online yet), the person you write to shows *typing…* dots and answers, so you can try the chat in the editor (*Sample replies while testing*). Online chats never do this.
  - Messages are kept in a **Messages** collection: chat, author, handle, text, media, reaction, reply_to, reply_text, reply_author, edited, deleted, system, members, title, forwarded, pin.
    - The conversation comes from the variable `chat` (blank = the room in *Room*).
    - With Supabase (*shared with everyone*, *Update live*), messages arrive on every phone at once, and the people in the conversation get a notification.
  - **Read receipts:** add a **Reads** collection (chat, handle, at) and "Seen" works across phones. Without one, each phone only knows what it has read.
- **Inbox:** your conversations, newest first: your direct messages and the group chats you are in (public rooms only if you turn them on).
  - Each row shows the person (or two faces for a group), the last message (*You:* for yours, the name in groups), when it was sent, and an unread count. Your last message shows ✓ when sent and ✓✓ once they have read it.
  - **Search** by name or words. **All / Unread / Groups** tabs, in any Top Nav *Tab look*.
  - **✏️ starts a conversation:**
    - **New message:** pick a person (friends, people you follow, your followers and everyone who has posted, with search).
    - **New group:** tick two or more people and give it a name.
  - **Press and hold** a conversation to **pin** it to the top (📌), **mute** it (🔕, it doesn't count in the badge), **mark it unread or read**, or **delete** it (with Undo; it comes back when a new message arrives). These choices are kept on the phone.
  - The unread total goes in `{unread}`, for a Bottom Nav badge (`Messages | chat | inbox | unread`). Tapping a conversation sets `chat` and `chatTitle` and goes to the page `chat`.
  - Direct messages use ids like `dm-alex-maya`, the same from both sides. Groups use `g-…` with their members and name on their first message.
  - **Private by default:** a Chat only shows a direct message to its two people and a group to its members. Anyone else (or no conversation picked) sees “You’re not in this conversation” and no message bar. Set *Who can see and write* to *anyone (a public room)* for an open room (other ids, like `general`); the Inbox lists rooms only with *Also list public rooms*.
- **Trending:** the most used #hashtags in recent posts (*From the last … days*), with post counts. Tapping one puts it in a search variable (`q`) and can go to a page, so a feed with that search variable shows those posts.
- **Who To Follow:** people you don't follow yet, most liked first, each with a **Follow** button.
- **The social graph** connects all the social pieces. It keeps who follows whom, friends and notifications in the collections **Follows** (follower, followee), **Friends** (from, to, status) and **Notifications** (to, from, from_name, type, post, text, read). Add these collections to make them online with Supabase; without them, they are kept on the device.
  - Following someone anywhere (a feed's Follow pill, Who To Follow, a Profile Header, Friends, *Follow back*) follows them everywhere. A feed tab with filter `following` shows posts from people you follow, plus your own.
  - Likes, comments, replies, reposts, quotes, @mentions, follows, friend requests, accepted requests and direct messages each send a notification to that person.
  - A new notification pops up a banner and buzzes. Turn this off with the setting `socialBanners: false`.
  - Variables: `{notifications_unread}`, `{friend_requests}`, `{followers_count}`, `{following_count}` and `{friends_count}`. Use them as badges, for example the App Bar action `bell | page:notifications | notifications_unread`.
- **Liking comments** is per person: who liked a comment is kept on it (a *liked_by* field in the Comments collection), so someone else's like counts but doesn't show as yours. Your phone also remembers your own likes, so they stay even where you can't change someone else's comment online. The comment's author gets a notification (*liked your comment*).
- **Notifications (social):** All / Mentions / Requests tabs (any Top Nav *Tab look*).
- **Reposts are per person:** reposting adds you to the post's **reposters** (handles), so it shows as reposted only for the people who reposted it. A post says “You reposted”, or “Maya Chen reposted” when someone you follow did. A profile shows only posts that person wrote. Tick *A person’s posts (a profile) also show what they reposted*, or switch on *Show posts I reposted* in Settings and privacy, to add their reposts too, labelled with their name (like X). The author gets a notification.
- **GIFs:** the GIF button in the post composer, the comment box and the chat bar opens a GIF picker. Upload a GIF from the phone or paste a link. Add a GIPHY or Tenor key in *Game Settings › GIFs* to search GIFs and see trending ones there.
- **Icons, not emoji:** menus, bars, labels and notifications use clean line icons that take the text colour (menu items given an emoji like 🔁 or 🗑️ show the matching icon). Emoji stay where they are content: reactions and quick emoji.
- **App pages and game pages:** select a page and set *This page is* to **an app page** or **a game page** (or leave it to follow the game). On an app page there is no pause button, no mute button and no “tap to start” screen, and leaving the app and coming back doesn't show PAUSED. Game pages keep all of that. In a game, pages without a setting of their own are **automatic**: a page showing a feed, chat, list, form, profile, marketplace or similar is an app page, anything else is a game page (*Game Settings › App › Pages without a setting of their own are* can make them all game pages or all app pages).
- **The ☰ corner button and bars:** a Search Bar sharing the top row with the Side Menu's built-in ☰ button starts after the button instead of running under it. It also makes room for a ☰ button of your own (or any small control at either end of the row; a centred title doesn't count). A Stories Row moves down below the button instead, keeping its left edge, when there's room under it; when something already sits right under the row (a post box, tabs), it stays in place and starts after the button, so nothing overlaps. Set *A floating ☰ in the corner* to **starts after it** to always keep it beside the button. Adding a second Side Menu preset doesn't add a second ☰ when you already have one that opens the menu. When the page or a feed scrolls, what moves up (a search bar, the post box, tabs) goes out of sight just under the button instead of passing behind it, and a feed stops below it.
- **Feels native:** in an app the phone's status bar takes the app's bar colour (and follows dark mode), buttons dim while pressed with no grey tap flash, and where there's a page to go back to, the left-edge swipe goes back instead of opening the side menu.
- **Marketplace (like Facebook):** a grid of listings with photo, price, title and place; category chips; search; Browse / Your listings / Saved tabs. Tap a listing for its photos, price, details and the seller, then **Message** (or a quick “Is this still available?”), which sends them a direct message quoting the listing. **Sell** opens a form for photos, title, price (0 = free), category, condition, place and description. Your own listings can be marked sold or deleted. Listings live in a **Listings** collection (title, price, category, condition, location, description, media, seller, handle, sold).
- **Points and achievements (like a Snap Score):** being active earns points (post 10, story 6, listing 5, comment 3, repost 2, follow 2, like / message / save 1, plus 5 the first time each day) and keeps a daily streak. Thirteen trophies unlock along the way (first post, 25 comments, a 7-day streak, 1,000 points…) with a banner. The **Achievements** component shows the score card, the streak and the trophy case (tap a trophy for what it takes, tap the score for how points are earned). Use {points} and {streak} anywhere (the Social profile shows the score). A **Points** collection shares scores for leaderboards; turn points off with the game setting *points: false*.
- **Crisp:** text is smoothed like native apps and separators are true hairlines on sharp screens.
- **Views, like X:** every post counts one view from each person once it has been at least half on their screen for a moment, or they open it (your own posts don't count your views). The count shows with the bar-chart icon when the feed's *Buttons* include `views` (the timeline and compact looks have it by default; with many buttons they space out like X, with save and share together at the end) and in the open post (“30.1K views”). Turn off *Count views* to only show the number already on the post.
- **App Bar looks (X, Facebook, Instagram, Threads):** *Look* on the App Bar: **x** puts your avatar on the left (it opens the Side Menu) and a logo or the app name in the middle; **facebook** puts a big wordmark on the left and round grey icon buttons on the right; **instagram** a script-font wordmark with plain icons; **threads** just a logo in the middle. The brand shows on the pages in *Show the logo / wordmark on pages* (home by default); other pages keep their title and ‹ Back. Customise the *Wordmark* text, font (bold, rounded, serif, script, condensed, mono), size and colour, *Your avatar instead of ☰*, the *Avatar picture*, and *Icon buttons* (plain, circles, outlined circles) with their colour. The library has each look ready to add, and the Social template uses the X look.
- **Composer options (New Post Box):** *Composer look* **x** (full screen, Cancel and Post), **facebook** (“Create post”, ✕ and an *Add to your post* row of coloured tools) or **sheet** (from the bottom). Turn on **Choose who can see it** (Everyone, Followers, Friends, Only me: feeds only show a post to the people it's for), **Choose who can reply** (everyone, people you follow, people you mention: others see “The author limited who can reply” instead of the comment box) and **Text on a colour** (short posts without pictures as big text on a colour or gradient, shown that way in the feed). The **emoji** button opens the emoji keyboard beside the GIFs, in place. Also: the composer title, the Post button (pill, square, text), the characters-left counter (ring, number, hidden) and whether drafts are kept. The Posts collection needs Audience, Reply Setting and Background fields (the Social template has them).
- **Writing a post:** #hashtags, @names and links show in the accent colour as you type, and anything past the longest post shows in red. Typing **@** suggests people (the ones you follow and friends first, then people who post) and **#** suggests hashtags already used in posts, with how many: tap one, or press Enter / Tab. The first link gets a **preview card** (✕ posts it as plain text) and is saved on the post as `link` and `link_title`, so the feed shows it as a link card.
- **New Post Box looks:** *Look* picks **pill** (avatar, “What’s happening?” and a Post button), **card** (a card with Photo, GIF, Poll and Place buttons under the field: each opens the composer with that tool), **facebook** (outlined “What’s on your mind?” and a photo button), **threads** (your name, “Start a thread…” and small icons), **minimal** (hint and pencil on a line), **button** (a big New post button) or **round button** (a round + for a corner). *Avatar picture* shows a photo instead of initials. It follows the theme colours and dark mode. The library has each look ready to add.
- **Bookmarks:** the bookmark on a post (in the feed when *Buttons* include `save`, in the open post, or ⋯ › Save post) and **Save** under any comment keep them for you only. **Saved** lists them, newest first, with All / Posts / Comments tabs: tap one to open the post (a saved comment is scrolled to and highlighted), tap its bookmark to remove it (Undo in the snackbar). A feed tab `Saved | saved` shows your saved posts, and the feed's *Saved page* adds a **View** button to the “Saved” snackbar. With a **Bookmarks** collection (handle, kind, ref, post, author, author_handle, text, media) they follow you to every phone; without one they stay on this phone. The Social template has a Saved page in the side menu.
  - Likes, reposts and follows on the same post are grouped ("Maya and 2 others liked your post"). New ones are highlighted and marked read once seen.
  - Friend requests have **Accept / Decline**, and follows have **Follow back**.
  - Tapping a notification opens the post (on the page *Open posts on page*, using the variable `openPost`), the chat, or the person's profile.
- **Friends:** the tabs **Friends** (with Message), **Requests** (Accept / Decline, plus the ones you sent, with Cancel) and **Find people** (Follow and + Friend). Tapping a person opens their profile.
- **Profiles:** tapping a name or avatar in a feed sets `profile`, `profile_name` and `profile_verified`, then goes to *Profile page* (or *My profile page* for you).
  - A Profile Header with *Follow, friends and counts from the social graph* shows Follow, **Add friend / Requested / Accept / Friends ✓** and ✉ (opens a direct message).
  - Its counts are real: posts, followers, following and friends. Tapping the counts goes to *Lists page*.
- **Stories:** a row of round bubbles with a coloured ring that turns grey once you've seen every slide. Tap one to watch full screen: each person's stories play one after another with a progress bar per slide, tap right / left for the next or previous one, hold to pause, swipe sideways for the next person and swipe down to close. Videos play for as long as they last. **Reply** sends them a direct message quoting the story (or tap a quick emoji), **♥** likes it, and both send them a notification. **Your story** (tap the **+**) opens a story maker: pick a photo, video or GIF from the phone, or write words on a colour, then **Share**. On your own stories the bottom shows **Seen by N** (tap it for the list) and **⋯** deletes one. With a **Stories** collection (author, handle, media, color, text, liked_by) stories are shared between phones and disappear after 24 hours (set **Stories disappear after**); add a **StoryViews** collection (story, handle, name) to see who viewed them. Without a collection the list in the inspector shows (a name again adds another slide), and your own stories stay on the phone. **Only people I follow** hides everyone else's.
  - Tap one to watch full screen. Progress bars run along the top; tap right for the next story, left to go back, hold to pause, and ✕ closes.
  - One per line: `Name | emoji or picture | colour | text`.
  - "Your story" (first) sends a message.
  - **Fold or hide it:** a small ⌃ at the row's top-right folds it into a slim bar with the pictures of people who have new stories (“5 new stories”); tap the bar to open the row again. Hold the row for **Fold stories** / **Hide stories**. Hidden stories come back from **Settings and privacy → Stories** (*Show stories*, *Keep them folded*) or the message `show stories`. The messages `fold stories`, `unfold stories`, `toggle stories` and `hide stories` work too. What each person chooses stays on their phone. What is under the row moves up and down with it, also on a page that doesn't line things up.
  - Settings (*Fold and hide*): *Can be folded*, *Starts folded*, *Show the ⌃ fold button*, *People can hide stories*.
- **Like Button:** a heart (or 👍, or ★) that pops with little sparks, turns a variable on or off and counts. Tick *Hold to pick a reaction* for 👍 ❤️ 😂 😮 😢 😡.
- **Feeds and profiles are connected:**
  - Each post shows its author's **current name, picture and verified tick** from their profile, so changing your picture in *Edit profile* updates all your posts. *Names and pictures come from profiles* turns this off.
  - Tapping a name or picture opens their profile. If *Tapping a name or avatar opens page* and *Tapping my own name opens page* are blank, the feed finds the page that has a Profile Header (someone else's, or your own).
  - With no profile page at all, a **profile card** slides up: picture, name, bio, counts, Follow, Message and their latest posts.
- **Profile Header:** a cover, a big avatar, name with a verified tick, @handle, bio, and counts (`Label | value` lines; `{variables}` work).
  - **Look:** **x** (a wide cover with the picture over its edge and buttons on the right), **instagram** (the picture with the counts beside it, the bio under it and wide Follow / Message buttons) or **centered** (everything in the middle, like TikTok or Facebook).
  - It shows pronouns after the @handle, a **Follows you** chip, and a row with the **place**, a tappable **website** and **Joined** month. **Followed by …** lists people you follow who follow them, with their pictures.
  - A gradient **ring** goes around the picture when they have a story. Tapping it goes to the page with the Stories (*Stories are on page*) and plays theirs. Without a story, tapping a picture (or a cover photo) opens it full screen.
  - **⋯** opens Share profile, Copy username, **Mute**, **Block** and **Report**. Muting hides their posts and stories everywhere except their own page. Blocking also hides that page's posts, unfollows them, removes them as a friend and as your follower; the header then shows **Blocked** (tap to unblock).
  - **Follow / Following** toggles a variable and changes the followers count. A ✉ button sends a message.
  - Tick *This is my profile* for **Edit profile** instead. With the social graph it opens an **editor**: change the cover (a photo or one of the colours), your picture, name, bio, pronouns, **category**, **status**, place, website and **links**, then **Save**. A new name also goes on your posts, comments and stories and in `{playerName}`.
  - **More to show** (the *Show* group):
    - **Category** under the name (e.g. *Photographer*) and a **status** pill (e.g. *🎧 Listening to lo-fi*).
    - **Links**: one per line, `Label | address | icon`. They show as chips under the bio and open the address (web, `mailto:` or `tel:`; a bare email works too).
    - **Highlights**: round covers under the bio, like Instagram story highlights. One per line, `Name | emoji or picture | message`. Tapping one sends its message, with the name in `{highlight}`, or opens its picture full screen. On your own profile, *a “New” highlight sends* adds a **+ New** circle that sends that message.
    - **Finish your profile**: on your own profile, a card with a progress bar (picture, cover, bio, place, a link, a first post) and the next step. Tapping it opens Edit profile. It goes away at 100%.
    - **Counts to show, in order**: any of `posts`, `followers`, `following`, `friends`, `likes` (likes on their posts) and `points` (yours).
    - Switches for the @handle line, the bio, the counts and the buttons.
  - **Look settings:** picture shape (**circle**, **rounded** or **square**), picture size, cover height, name size and button shape (**pill**, **rounded** or **square**). 0 keeps what the look uses.
  - Everything shown comes from a **Profiles** collection (handle, name, bio, avatar, cover, location, website, pronouns, category, status, links, joined, verified) when there is one, otherwise from the settings; your own edits stay on the phone without one.
  - **Settings and privacy** (the ⚙ next to *Edit profile*, the ⋯ menu, or the message `settings` from anywhere, e.g. a Side Menu item `Settings and privacy | settings | msg:settings`) opens a full-screen page:
    - **Your account**: your picture and name (tap to edit your profile), *Copy your username*.
    - **Private account**: only people who follow you see your posts. Other people's feeds hide them, and your Profile Header says the account is private until they follow you.
    - **Who can message you**: Everyone, People I follow, Friends or No one. *Message* on your profile or profile card says when you aren't taking messages.
    - **Your profile**: what people see on your profile: posts you reposted (off at first), the Replies, Media and Likes tabs, follower and following counts, where you are, your website and links, when you joined, your status and highlights. Saved with your profile (fields `show_reposts`, `show_replies`, `show_media`, `show_likes`, `show_counts`, `show_location`, `show_website`, `show_joined`, `show_status`, `show_highlights`, each `yes` / `no`).
    - **Notifications**: switch off likes, comments and replies, reposts and quotes, mentions, new followers and friends, or messages.
    - **Appearance**: Light, Dark or Automatic.
    - **Muted accounts** and **Blocked accounts**, each with *Unmute* / *Unblock*.
    - **Log out**, when people sign in with Supabase.
    - The choices are saved with your profile (fields `private`, `dm`, `notes_off`).
  - At the top of a page that lines things up, a full-width Profile Header sits right under the App Bar: no gap above its cover.
  - It **grows to fit** what it shows. On a page set to *Line everything up*, what is under it (a feed) moves down; otherwise its top stays put.
  - A page with a feed (or list) filling it doesn't scroll by itself: the feed does the scrolling, and what is above it scrolls away with it. No more page bouncing on top of the feed.
  - **Pull to refresh** on a profile keeps the page together: the header, tabs and posts stay put and the spinner shows on the cover.
  - It grows to fit in the editor too, and a feed filling the page under it starts below it, even on a page that doesn't *Line everything up* (like the ready-made *My Profile* page), so the feed is never drawn over it.
  - With a feed under it, the **whole page scrolls**: dragging on the header (not just the posts) moves it up out of the way, then the posts scroll. A feed with tabs now scrolls far enough to show its last post in full.
  - Tapping the **Followers / Following / Friends** counts opens *Lists page* (the Friends page) on that person's lists, with a Follow button on each.
- **Show posts from** (Social Feed): **auto** (on a page with a Profile Header, only that person's posts, yours on your own profile; anywhere else everyone's), **everyone**, **me**, **the person in a variable** (*Person's handle is in variable*, e.g. `profile`), **people I follow** or **my saved posts**. *Only show* still applies on top. A feed and a Profile Header shown together count as one profile page, even when the feed isn't inside the page. The Console says whose posts a profile feed is showing. The sample posts (in the editor, or before there is a Posts collection) follow it too. The **Likes** tab lists posts that person liked.
- **Who “you” are:** the New Post Box, the feed (comments, likes, *your* posts) and your Profile Header all use the same person: the signed-in account, else `{playerName}` / `{playerHandle}`, else **You @you**. A feed filter `handle = {playerHandle}` (your profile's posts) reads it the same way, so what you post always shows on your profile, even in an app without those variables or while signed in. Posts written before this fix under the old default (**Me @me**) move to you by themselves.
- **Profile tabs on a feed:** a feed's tabs can use `posts` (no replies), `replies`, `media` (posts with pictures or videos) and `likes` (posts you liked). A third column gives a tab its own look, e.g. `Media | media | grid`. The Social template's profiles use `Posts | posts`, `Replies | replies`, `Media | media | grid` and, on your own, `Likes | likes`.
- **New Post Box:** "What's happening?" with your avatar. Tap to write a post; it's added to the Posts collection (author `{playerName}`, handle `{playerHandle}`) and shows in the feed at once. If the app has no Posts collection yet, the first post makes one (with the sample posts the feed was showing), so **Post** always works; open **Data** to change its fields.
  - Tapping it opens a **full composer** (or, with *Tapping it opens: simple text box*, the old one-line box):
    - a big text area with a **character ring** that turns orange near the limit and red over it (with the count left);
    - **up to 4 photos** from the phone, made smaller to fit in a record. Videos too if you turn that on; they stay on that device only;
    - a **poll** with 2–4 choices, and a **📍 place**;
    - **Post** lights up when there's something to post.
  - Closing it keeps a **draft** that comes back next time.
  - The new post gets `media`, `poll` and `votes`, and `location`. Turn photos, polls and places on or off one by one.
  - **Videos and GIFs:** pick videos and GIFs with the photos, or tap **GIF** to paste a GIF link (Giphy, Tenor…).
    - With a **Supabase media bucket** (*Game Settings › Supabase › Media bucket*; **Copy media bucket SQL** makes it), photos, GIFs and videos are uploaded there and the post keeps their links, so everyone sees them. People need to be signed in to upload.
    - Without a bucket: photos are made smaller and kept in the post, GIFs up to 3 MB and videos up to 6 MB are kept in the post, and bigger videos stay on that phone.
  - **Threads:** 🧵 adds another post under the first, up to 10. Posting makes a thread: each post replies to the one before (`reply_to`).
- **Colours:** these pieces use theme colours. In an app they follow light / dark mode; in a game they follow the game's background (dark background → light text). Lists scroll their last item clear of a bottom tab bar.
- **Photo Grid:** a scrolling grid of square pictures from the collection's media field (or emojis). Tap one to open it.

## Tooltips, menus and more UI pieces

Each is a component (*Add Component › UI*) and has ready-made versions in *Project › UI*.

- **Tooltip:** a help bubble beside any element.
  - It can show on tap, on long-press, always, once ever (the first time, for "New!" hints), or on a message.
  - It points at the element, stays on screen, and hides after a few seconds or when you tap elsewhere.
  - Pick dark, light, accent, warning or your own colours. Text can use `{variables}`, with an optional bold title.
  - In the editor, selecting the element shows its tooltip.
  - Ready-made: *Info Icon with Tooltip*, *Button with Tooltip (hold)*, *New Feature Hint (once)*.
- **Popover Menu:** tap (or long-press) an element, such as a ⋯ button or an avatar, to open a small menu beside it.
  - One item per line: `Label | message | icon`. Start a label with `!` to make it red.
  - Tapping outside closes it, and the picked label can go into a variable.
  - Ready-made: *Popover Menu (⋯)*, *Profile Menu (avatar)*.
- **Spinner:** ring, dots, bars, pulse, orbit or bouncing dots, with optional text. It can show only while a variable (like `loading`) is on.
- **Skeleton Loader:** shimmering grey placeholders while content loads (text lines, avatar + lines, a card, list rows or a picture). It fades away when a variable (like `loaded`) turns on.
- **Chips:** tappable filter or tag chips that wrap onto more lines. Pick one, or several (the variable gets `Music, Sport`). Looks: filled, outlined or soft.
- **Avatar:** initials (or an emoji) on a colour picked from the name. Optional ring and online / away / busy / offline dot, which can come from a variable. Give the element an image to show a photo.
- **Banner:** an info, success, warning, error or tip strip with an icon, title, text, an optional button and ✕.
  - Show and hide it with messages.
  - It can stay closed once closed.
- **Steps:** where someone is in a flow (Cart › Address › Pay), from a step variable. Done steps get a tick, and tapping one goes back to it. Looks: circles and lines, numbers, or a bar.
- **Divider:** a line across, optionally with a word in the middle ("or"). Solid, dashed, dotted or faded.

## UI Theme and styling

*Game Settings › UI Theme* picks a look (Default, Neon, Candy, Retro, Fantasy, Ocean, Light) or your own: font, text, accent, panel, dimming, touch controls, win and lose colours, corner roundness. The built-in screens, touch controls, messages and dialogs follow it, as does any text using **Theme font**. **Apply to my UI** restyles what you already made.

- **Fonts:** eleven built-in fonts plus any Google Font (downloaded the first time a player opens the game).
- **Images:** rounded corners, and **9-slice** (the *UI Frames* sprites are drawn for it).
- **Inset from the box edge:** left- or right-aligned text on a box starts this far from the box's edge, leaving room for an icon (*Text › Wrapping and line spacing*). Search bars use it so the text starts after the magnifier.
- **Long text** that doesn't fit its space ends in **…**.
- **Copy Style / Paste Style** copies colours, fonts, outlines and shadows between elements.

## Looks, styles and effects

Every UI element with a shape (buttons, cards, panels, fields…) can be restyled in a few taps. Select it and look at **UI Element** in the Inspector:

- **Looks…** opens 18 ready-made looks, each with a preview: Flat, Soft card, Outline, Pill, **Glass** (frosted, blurs what's behind it), **Soft (neumorphic)**, **Pressed in**, **Neon**, Gradient, Sunset, Ocean, **Gradient border**, **Retro** (a hard offset shadow), **Dots**, **Stripes**, **Grid**, Paper and Clear. Tap one and the element takes its colours, corners, border, shadow and effects (and a readable text colour). Fine-tune it afterwards.
- **My Styles…** saves an element's look under a name (*Primary Button*, *Card*, *Title*) to use on other elements, on any level. Elements using a style stay linked:
  - change one, then tap **Update “Primary Button” everywhere** and every element using that style changes with it;
  - **Reset to it** puts an element back to its style, **Unlink** lets it go its own way;
  - in My Styles, each style shows how many elements use it, and can be renamed, deleted or used to find one.
- **Copy Style / Paste Style** copy one element's look onto another.

**Shape Renderer › More looks** has the effects one by one:

- **Gradient to** (fill) and **Outline gradient to** (a two-colour border), each with a direction.
- **Drop shadow** with softness, distance and **sideways** offset (a hard, offset shadow at softness 0 makes the retro look), or a **Glow**.
- **Inner shadow** with softness and distance: dark for a pressed-in button, light for a soft raised (neumorphic) one.
- **Pattern**: dots, stripes, a grid or checks, in any colour and size, over the fill.
- **Frosted glass**: blurs whatever is behind the element (use a see-through fill, like white at 12%). It shows in Play.
- **Dashed outline**, **rounded corners** (all, or only some), and all of it works with theme colours.

## Shapes, icons and fonts

**Shapes.** In **Shape Renderer**, tap **Shapes…** for a gallery with pictures of every shape:

- *Basic*: rectangle, capsule, circle, ellipse, **squircle** (smooth iPhone-style corners), **cut corners**, **slanted**, triangle, diamond, pentagon, hexagon, octagon.
- *UI*: **speech bubble** (tail on the left, middle or right), **ticket**, **price tag**, **ribbon**, **step arrow**, **bookmark**, **shield**, **wavy edge**, ring.
- *Fun*: star, **starburst**, **badge** (a wavy edge), heart, **blob** (change its number for a new blob), cloud, **drop**, **leaf**, **lightning**, **moon**, **plus**, arrow.

The UI shapes keep their corners when you stretch them, and every look and effect (gradients, borders, shadows, inner shadow, patterns, glass) works on all of them.

**Your own shapes:** tap **Draw or paste…** (next to Shapes…) for:

- **Draw a shape…**: tap to place corners, drag one to move it, tick **Smooth** for curves, then **Use this shape**.
- **Paste SVG…**: paste an SVG from Figma, Canva or an icon site (or just its path). It fills the element and stretches with it. The path and view box can be edited in the Inspector too.
- **Draw your own (2D Sprite Editor)** and **Use a sprite picture instead** are in the same menu.

**Your own UI pieces:** build something once (a card, a shop row, a score panel, with whatever is inside it), then tap **Save to My UI** in UI Element. It shows up under **My UI** when you add to a page, and in My Prefabs. Edit one and *Apply to Prefab* to update every copy.

**Icons.** The icon picker (Bottom Nav tabs, Side Menu items, top bar buttons, App Bar…) has **over 120 icons** with a search box: gift, key, shield, bolt, fire, globe, link, eye, wifi, battery, compass, send, mic, video, headphones, gamepad, dice, crown, rocket, target, medal, users, log in / log out, folder, card, wallet, bag, truck, sparkles, bulb, palette, code, layers, music controls, sword, potion, skull, podium and more. **Upload your own…** turns any picture (PNG or SVG with a clear background) into an icon, coloured like the rest; it's saved in the game as `my:Name`. Emoji still work too.

**Fonts.** Tap **More fonts…** on any text:

- **About 100 Google Fonts** in groups: *Game & display*, *Rounded & friendly*, *Clean (apps)*, *Serif & elegant*, *Handwriting & fun*, *Pixel & retro*, *Mono & tech*.
- **Search** them all, or type the name of any font on fonts.google.com.
- **Preview** each font with your own words.
- **Upload a font file…** (.ttf, .otf, .woff, .woff2): it's saved in the game, works offline, and shows under *Your fonts* (where you can remove it).

## Animation

- **UI Animation** component: an entrance (on start, on show, or on a message, children one by one) and an idle loop (float, pulse, breathe, wiggle, heartbeat, bounce, spin, glow, shake).
- Show / hide animations everywhere: fade, pop, spring pop, zoom, slide, drop in, flip, spin in, elastic pop, swing in, rise, stretch. A panel that pops or zooms scales with everything inside it.
- Page transitions that follow navigation (Back plays them in reverse): slide, push, shared axis, zoom, card stack, reveal from tap and wipe. *Game Settings › Motion › Page transitions* picks one for every page; see [Making apps](#/guide/apps).
- **Show / Hide UI** node with *done*.

## Touch controls

The touch buttons dip and light up while held. The pause and sound buttons draw their own icons, so they look the same on every phone.

*Game Settings › Touch Controls* sets the built-in joystick (floating, static or fixed; side; touch area; directions; response; dead zone; look), jump and action buttons, a D-pad or arrows, and where the player's ⚙ settings open. A finger that lands on something tappable never starts the joystick, so taps on buttons and objects always work.

The players' own **Settings** panel (left-handed, control size and opacity, sensitivities, invert, sound, music, vibration) is saved on their device.

## Ready-made UI

*Project › UI* has dozens of widgets in groups: Menus & HUD, Buttons, Inputs, Lists, Controls, Charts, HUD, Game Systems (Shop, Inventory, Hotbar, Equipment, Crafting, Quest Log, Daily Reward, Level Map, Tutorial), Navigation and Loading. Each is one or a few objects you can restyle.
