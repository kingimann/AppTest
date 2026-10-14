# UI, screens and navigation

UI is everything drawn on the screen rather than in the world: scores, health bars, buttons, menus, shops, popups, nav bars. In Pocket Engine a UI element is a normal object with **UI** turned on, plus components that make it interactive.

## UI basics

- Turn on **UI** in an object's **UI Element** card, or add anything from *Create → UI & Menus* / *Project › UI*.
- The **UI** button above the Scene switches to the **UI editor**. It shows only the screen, with safe-area and centre guides, the 9 anchor points and screen preview chips.
- UI is positioned from an **anchor** plus an offset in design pixels, so it stays in the right place on every phone shape.

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
- **Progress Bar** (`bar`): bound to a variable, with looks (flat, striped, blocks, glossy, glowing), fill directions, a damage trail, a warning colour, a label with `{value}`, `{max}`, `{percent}`, and ring or heart-icon styles.
- **Animated Counter**, **XP Bar**, **Timer**, **Chart**, **News Ticker**, **Minimap**, **Off-screen Arrows**, **Crosshair**, **Screen Effects**.

## Controls

| Component | Does |
|---|---|
| Button | Tap / press / hold / long-press to do an action. Cost, cooldown, "only works when…", pressed look, sound and buzz |
| Toggle, Checkbox, Segmented Control, Option Picker, Stepper, Star Rating | Set variables |
| Slider | Drag to set a variable (one bound to `volume` 0–100 controls the game's sound) |
| Text Input | Type into a variable (text, number, password, e-mail, search) |
| Dropdown, Keypad, Colour Picker, Carousel | Choices |
| Skill Button, Radial Menu, Prize Wheel | Game controls |
| Touch Button | Your own on-screen control: left, right, up, down, jump, fire or a message while held |
| List View / Scroll View | Scrolling lists and grids, with flick, snapping, pull to refresh and "load more" |

Lists inside components are typed one item per line with `|` between the parts, like `Coin Pack | 🪙 | 5 | item:Coin Pack`. The Inspector shows them as tables.

## Pages and navigation

Apps and menus are built from **pages**. A page is a panel with **Show If** (or *Show when*) on the `page` variable. Navigation changes `page`, and pages fade or slide between each other.

- **Bottom Nav:** a complete tab bar (9 styles, badges, animations). Tabs are `Label | icon | page | badge variable`.
- **Side Menu:** a drawer with sections, toggles, footer items and 7 styles. Items are `Label | icon | page or msg:name or toggle:var | badge`.
- **App Bar:** a top bar with ‹ Back / ☰, a title that follows the page, and up to 4 right buttons.
- **App Layout:** all three set up to work together.
- **Back Button**, **Sliding Page**, **Swipe Pages**, **Tab Bar**.

Navigation keeps a **history**: *Go To Page* (open, switch or start over) and *Go Back*. The phone's back gesture, the browser's Back button, Esc and an edge swipe all go back too.

```js
scene.navTo('shop');            // open the shop page (Back returns)
scene.navTo('weekly', 'tab');   // another variable, e.g. tabs inside a page
scene.navBack();
scene.canGoBack();
```

Nodes: Go To Page, Go Back, On Page Opened, On Back, Page Is, Can Go Back.

## Popups, toasts and notifications

- **Popup** (modal or toast) and **Popup Dialog** open on a message; **Side Bar** slides in from any edge.
- Nodes: **Show Toast**, **Show Alert** (*closed*), **Ask Yes / No** (*yes* / *no*), **Ask For Text**.
- **Notifications** are built in: send `notify:reward Daily gift|+50 coins|🎁`, or use the **Notify** node. Notification types (achievement, reward, level up, info, warning, error, chat…) are styled in *Game Settings › Notifications*.

## UI Theme and styling

*Game Settings › UI Theme* picks a look (Default, Neon, Candy, Retro, Fantasy, Ocean, Light) or your own: font, text, accent, panel, dimming, touch controls, win and lose colours, corner roundness. The built-in screens, touch controls, messages and dialogs follow it, as does any text using **Theme font**. **Apply to my UI** restyles what you already made.

- **Fonts:** eleven built-in fonts plus any Google Font (downloaded the first time a player opens the game).
- **Images:** rounded corners, and **9-slice** (the *UI Frames* sprites are drawn for it).
- **Inset from the box edge:** left- or right-aligned text on a box starts this far from the box's edge, leaving room for an icon (*Text › Wrapping and line spacing*). Search bars use it so the text starts after the magnifier.
- **Long text** that doesn't fit its space ends in **…**.
- **Copy Style / Paste Style** copies colours, fonts, outlines and shadows between elements.

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
