# Publishing your game

There are five ways to get a game to players, from quickest to most involved:

| Way | What players get | Needs |
|---|---|---|
| **Build HTML** | One file that plays in any phone browser | Nothing |
| **Build Web App (.zip)** | A website that installs to the Home Screen, plays offline and can send notifications | Any https web host (GitHub Pages, Netlify…) |
| **App stores via Codemagic** | Real iOS and Android apps | Apple / Google developer accounts, a free Codemagic account |
| **itch.io** | A page on itch.io that plays in the browser, on phones too | A free itch.io account |
| **App stores via Expo** | Real iOS and Android apps (React Native WebView) | An Expo account (EAS) |
| **Xcode project** | A real iOS app you build and upload yourself | A Mac with Xcode 16 or newer, an Apple developer account |
| **Android Studio project** | A real Android app you build and upload yourself | Android Studio (Windows, Mac or Linux), a Google Play developer account |

All of them start from **☰ → Build Settings…**.

## Build Settings

Every section of Build Settings **folds**:

- tap its title to open or close it;
- a folded section shows a summary, like *2 levels, start at 1*, *compressed*, or *3 of 8* screenshots;
- App, Icon and the section for what you are making start open, and the window remembers what you open and close;
- **Search build settings** shows only the sections that match;
- **Expand all** / **Collapse all** open or fold every section;
- the chips under the checklist jump to a section and open it, and so do the ready check's buttons.

The top of Build Settings helps you get it right:

- **What are you making?** Pick **Play file**, **Website**, **App Store & Google Play**, **Expo app**, **Xcode project**, **Android Studio project** or **itch.io**. Build Settings then shows only the settings that kind of build needs (tick *Every setting* to see them all), and the big button at the bottom makes it.
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

The **Expo & EAS** section of Build Settings adds:

- **Apple ID**, **App Store Connect app ID** and **Team ID**, written into `eas.json`, so `eas submit --platform ios` knows where to upload.
- **Upload to Google Play with a key file**: `eas submit --platform android` uses `google-play-key.json` in the project folder (kept out of git).
- **Set build numbers myself**: off, EAS counts builds up for you; on, the number you type goes in as iOS `buildNumber` and Android `versionCode`.
- Always included:
  - Apple's privacy manifest (no tracking);
  - an app icon without transparency (the App Store refuses icons that have an alpha channel);
  - the adaptive Android icon;
  - the `store-listing/` folder (below).

## Xcode and Android Studio

Want to build the app yourself, with no cloud service, npm or plugins? Pick **Xcode project** or **Android Studio project** in Build Settings. Both are plain native projects: the game runs in a full-screen web view, and a small bridge gives it the same native features as the other app builds:

- phone notifications, scheduled at a time, every day at a time, or repeating, even while the game is closed, and tapping one tells the game which;
- haptics;
- the permission texts your game needs (camera, microphone, location);
- on Android, the Back button too.

The **Xcode & Android Studio** section of Build Settings has the **Bundle ID** / **package name** (the App ID), the **build number** (raise it for every upload), full screen and, for Xcode, your **Apple Team ID** and iPhone-only or iPhone and iPad. Both buttons are there, so you can download either project from either target.

### Xcode (iOS)

The download has a `YourGame/` folder and the `store-listing/` folder.

1. Unzip it on a Mac and double-click `YourGame.xcodeproj` (Xcode 16 or newer).
2. Under **Signing & Capabilities**, pick your team (or type your Team ID in Build Settings first).
3. Plug in your iPhone, pick it at the top and press **Run** (▶).
4. To publish: **Product › Archive**, then **Distribute App › App Store Connect**. Then send it to TestFlight or App Store review in App Store Connect.

Inside are a SwiftUI app (`App/GameApp.swift`), the game (`App/index.html`), Apple's privacy manifest, an app icon without transparency and the launch colour. It runs on iOS 15 and newer. To update the game later, replace `App/index.html` with a new download's.

### Android Studio

The download has a `YourGame-android/` folder and the `store-listing/` folder.

1. Unzip it, open Android Studio and choose **File › Open**, then pick the `YourGame-android` folder. Let it sync (the first time downloads Gradle).
2. Turn on USB debugging on your phone, plug it in and press **Run** (▶).
3. To publish: **Build › Generate Signed App Bundle or APK › Android App Bundle**. Make an upload key there (keep it safe: every update needs the same key), then upload the `.aab` in the Google Play Console.

Inside are a small Java app (`MainActivity.java` and `NotifyReceiver.java` for notifications), the game (`app/src/main/assets/index.html`), the adaptive icon and the older icon sizes, and the notification icon. It runs on Android 8 and newer and targets Android 16 (API 36), as Google Play asks. To update the game later, replace `index.html`.

## itch.io

Pick **itch.io** in Build Settings. The download has:

- `upload-this-to-itch.zip`: the game, with `index.html` at its root, the way itch.io wants HTML5 games.
- `cover-630x500.png`: the cover image, made from your icon and name.
- `ITCH-PAGE.md`: the page settings, worked out for your game:
  - Kind of project: HTML, and "This file will be played in the browser";
  - the viewport size (portrait games get a tall frame, landscape games a wide one);
  - **Mobile friendly** with the right orientation;
  - the fullscreen button;
  - the genre, tags and description;
  - a `butler push` command for updating from a computer (fill in your itch.io username in Build Settings).

## Store listing kit

The stores ask for more than the app. **Store listing** in Build Settings (for the App Store & Google Play, Expo, Xcode and Android Studio targets) takes:

- the subtitle (App Store, 30 letters);
- the short description (Google Play, 80);
- keywords (100);
- the category;
- the privacy policy link, support link and website.

The checklist warns when something is too long, or when the privacy policy link is missing: both stores require one.

**Download store kit (.zip)** (also inside every app project, as `store-listing/`) contains:

| File | For |
|---|---|
| `app-store-icon-1024.png` | App Store Connect: 1024×1024, no transparency |
| `play-icon-512.png` | Google Play's app icon |
| `play-feature-graphic-1024x500.png` | Google Play's feature graphic (required): your icon and name |
| `LISTING.md` | All the text to paste, with each store's limits and category names, the screenshot sizes, age-rating tips, and answers for **App Store › App Privacy** and **Google Play › Data safety** worked out from what your game uses (PlayFab, Photon, Supabase accounts and data, notifications, camera, microphone, location) |
| `privacy-policy.md` | A starter privacy policy that matches what the game does. Put it online (GitHub Pages works) and paste its address as the privacy policy link |

A game that keeps everything on the phone gets "Data not collected", the simplest answer in both stores.

### Screenshots

Press **▶ Play**, then the **camera** on the Play bar at the best moments (up to 8). A flash shows it was taken. The screenshots are kept with the game.

**Build Settings › Screenshots** lists them:

- give each one a caption (optional), reorder them or remove them;
- **Look**: a caption above the screenshot on a coloured background (the usual store style), or just the screenshot filling the picture;
- background and caption colours.

The store kit (and every app project, in `store-listing/screenshots/`) has each screenshot at the exact sizes the stores accept:

- App Store iPhone 6.9" (1320×2868);
- App Store iPad 13" (2064×2752), when the app supports iPad;
- Google Play phone (1080×1920).

Landscape screenshots come out sideways sizes. The itch.io download has them at their own size. The checklist reminds you when there are none.

### Release notes

**What's new in this version** (Build Settings › App) goes into LISTING.md, for the App Store's "What's New" and Google Play's "Release notes", and into ITCH-PAGE.md as a devlog post.

## Smaller builds

**File size › Make pictures smaller** saves the game's big pictures again in a smaller format (WebP, or JPEG where there are no see-through parts). They keep their size. You can also choose to shrink pictures bigger than 2048 px, but not sprite sheets that are cut into frames by pixel size. **Undo** puts them back.

**Recent builds**, under the build targets, lists the last builds: what, which version, how big and when.

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
