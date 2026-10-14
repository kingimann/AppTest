# Publishing your game

There are four ways to get a game to players, from quickest to most involved:

| Way | What players get | Needs |
|---|---|---|
| **Build HTML** | One file that plays in any phone browser | Nothing |
| **Build Web App (.zip)** | A website that installs to the Home Screen, plays offline and can send notifications | Any https web host (GitHub Pages, Netlify…) |
| **App stores via Codemagic** | Real iOS and Android apps | Apple / Google developer accounts, a free Codemagic account |
| **App stores via Expo** | Real iOS and Android apps (React Native WebView) | An Expo account (EAS) |

All of them start from **☰ → Build Settings…**.

## Build Settings

The top of Build Settings helps you get it right:

- **What are you making?** Pick **Play file**, **Website**, **App Store & Google Play** or **Expo app**. Build Settings then shows only the settings that kind of build needs (tick *Every setting* to see them all), and the big button at the bottom makes it.
- **The ready check** lists what to look at before you build, each with a button that fixes it or takes you there:
  - a name that's still "Untitled", the default 🎮 icon, or a version that isn't a number;
  - no description (for link previews and store listings) and no *Made by* name (for the stores);
  - starting at a later level, levels left out, testing options still on, compression off;
  - for the stores: an App ID that isn't valid (it offers one), no platform picked, and a version you already sent to the stores (they need a new number for every upload).

  Red items stop the build until they're fixed. **Recommended** turns on the usual settings for a finished game in one tap.
- **Chips** (App, Icon, Loading, Levels…) jump to a section.
- **Last built** shows when you last built it, what kind, its version and size.

The sections:

- **App:** name, version, author, description and file name. *Small update* and *Big* set the next version for you (1.0 → 1.1, or 2.0).
- **Icon:** your own picture, or an emoji on a colour: tap one of the ready emoji and colours, or type your own. A preview shows it on a light and a dark Home Screen. It's used on the Home Screen, the browser tab and the loading screen.
- **Loading screen:** presets (Classic, Minimal, Neon, Retro, Candy, Cinematic, Storybook, Arcade). You can then set:
  - the background (colour, gradient, picture), the logo and name, and the loading bar style;
  - text and rotating tips, a minimum time, **Tap to Start** (so music can play straight away), and how it leaves.

  The bar follows the real loading of the engine, the game, its pictures and fonts.
- **Levels:** leave unfinished levels out, and pick the level to start at.
- **Player:** graphics quality (battery saver, balanced, sharpest), the back gesture, blocking long-press menus.
- **Web app:**
  - **Home Screen and screen:** can it be added to the Home Screen, its short name, how it opens (full screen, minimal UI, browser), when to suggest installing it, orientation, and the browser bar and iPhone status bar colours.
  - **While playing:** pause when switching apps, keep the screen on, and ask before leaving mid-game.
  - **Sharing:** the link preview (title and description) and the language code.
  - **Advanced:** extra code in `<head>`.
- **File size:** **Compress** makes the file about 3× smaller (needs iOS 16.4+ or a 2023 browser). A report shows what takes the space.
- **Testing:** an FPS counter and on-screen errors for trying a build on another phone.
- The main button builds what you picked at the top. For a play file, **Share** sends it with the phone's share sheet. **Test** opens it in a new tab.

## One HTML file

**☰ → Build HTML** packs the engine, your game, its pictures and sounds into one `.html` file. Send it, upload it anywhere, or open it from Files. It works offline once opened.

## A web app

**☰ → Build Web App (.zip)** makes a folder with `index.html`, a service worker, a manifest and an icon. Upload the folder to any https host:

- **GitHub Pages:** put the files in a repository, then *Settings → Pages → Deploy from a branch*.
- **Netlify / Cloudflare Pages:** drag the folder onto their dashboard.

Players can add it to their Home Screen. It opens full screen, plays offline and updates when you upload a new version. Phone notifications arrive while it's open (on iPhone, once it's on the Home Screen).

## iOS and Android with Codemagic

[Codemagic](https://codemagic.io) builds the apps in the cloud, so you don't need a Mac or Android Studio.

1. In Build Settings › **App stores**, set the **App ID** (like `com.yourname.game`) and tick iOS, Android or both.
2. **iOS:** choose TestFlight, TestFlight + App Store review, or just the `.ipa`; iPhone only or iPhone + iPad; the name of your App Store Connect key in Codemagic.
3. **Android:** choose internal / closed / open testing or production, or just the `.aab`. Tick *First release* (Google only accepts drafts until the first review). Give the keystore and Google Play key names in Codemagic.
4. **Download app project (.zip).** It's a [Capacitor](https://capacitorjs.com) project with:
   - the game, icons and splash;
   - `codemagic.yaml`;
   - local notifications and haptics;
   - a script that sets the version, build number, signing, orientation and full screen.

   Its `README.md` has the one-time setup for accounts, keys and certificates.
5. Put the folder on GitHub, add it in Codemagic and start the workflow. Build numbers go up by themselves; raise **Version** for a store update.

App builds get real haptics, scheduled notifications that arrive while the game is closed, and the permission texts your game needs.

## iOS and Android with Expo

**Download Expo project (.zip)** makes an [Expo](https://expo.dev) app with the same App ID, version, orientation, icon and splash. The game runs in a full-screen WebView, with a bridge for notifications, haptics, permissions and the Android Back button.

- Try it: `npm install`, then `npx expo start`, and scan the QR code with Expo Go.
- Build: `eas build --profile preview` (a test build) or `--profile production`, then `eas submit`.
- Update the game by replacing `game/game-html.js`.

## Playing a game from a URL

The engine's own `play.html` plays any game JSON or template:

```
play.html?game=jump-quest
play.html?src=my-game.json
```

## Before you publish

- Play it on a real phone, in portrait and landscape if it allows both.
- Check *☰ → Find Problems…*.
- Turn on **Testing** in Build Settings and try the build on another phone (the ready check reminds you to turn it off again).
- Go through Build Settings' ready check until it says **Ready to build**.
- Set a title, an icon and a loading screen.
- Decide what's saved: best score, progress, save slots.
- If it uses sound, give it a **Tap to Start** so music can begin.
- Back up your project (*☰ → Back Up All Games*).

## Updates

The editor, the home page and exported web apps check for a new version when they open, when they come back to the front, when the phone goes online, and every 10 minutes. A bar offers **Update**. For app-store builds, download the project again and run the workflow.
