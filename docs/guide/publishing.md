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

- **What are you making?** Pick **Play file**, **Website**, **App Store & Google Play**, **Expo app**, **Xcode project**, **Android Studio project** or **itch.io**. Each is a compact tile; the picked one's description shows under them. Build Settings then shows only the settings that kind of build needs (tap **Show all kinds** to see them all), and the big button at the bottom makes it (it stays on top while you scroll).
- **The ready check** lists what to look at before you build, each with a button that fixes it or takes you there, and **Use the recommended settings** at the bottom:
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

## Previews while you build

The **phone** button next to Play (also in the play tools while a game runs) has:

- **Play in the editor**: the usual way, with the play tools around it.
- **Standalone preview**: the project on its own in a new tab, with no editor controls, exactly the size of the window. Preview again after a change and that tab reloads with it.
- **Phone-size window** (on a computer): the same in a narrow window shaped like a phone.
- **Device preview**: a **QR code** to scan with a phone's camera, and the link to send (Share on a phone: AirDrop, Messages…). The project travels inside the link as its changes to the template it started from, so it stays short; nothing is uploaded. A project too big for a QR code still works through the link. A phone can only open it when the editor runs on its https address (not on your computer's localhost).
- **Test the built web app**: see below.

## Test in Safari

Before you upload anything, try the web app exactly as people will get it:

- **Test in Safari** (top of Build Settings, or *☰ → Test in Safari*) builds the web app and opens it in a new tab. On an iPhone or iPad that is Safari itself, so you see real touch, safe areas, the keyboard and the status bar colour. Close the tab to come back to the editor.
- **Copy test link** packs the project into a link to `play.html` (no upload needed). On a computer it is copied; on a phone the share sheet opens, so you can AirDrop or message it to your iPhone and open it in Safari. Very large projects (lots of pictures and sounds) are too big for a link: use Test in Safari or *A web app* instead.

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

### Build on Codemagic from the editor

Under the download button, **Build on Codemagic from here** does steps 4 and 5 for you, with your own accounts:

1. **Sign in with GitHub.** With the editor's accounts server (Supabase with GitHub sign-in turned on), tap **Sign in with GitHub** and approve; otherwise paste a GitHub token with the `repo` permission. The app project goes into a **private repository in your GitHub** (`your-game-app`).
2. **Connect Codemagic.** Paste your Codemagic API token once (codemagic.io › Teams › Personal Account › Integrations › Codemagic API). Builds use **your** Codemagic account, signing keys and build minutes.
3. **Send & build.** Makes the project from the game as it is now, sends it to GitHub as one commit, adds the repository to your Codemagic (with a read-only deploy key it makes for you) the first time, and starts the iOS and / or Android workflows. The status shows right there (waiting, building, sending to the store, done or failed), with links to download the `.ipa` / `.aab`, open the build on Codemagic, or cancel it. **Recent builds** shows the last few.

Tokens stay on this device and are only sent to GitHub and Codemagic. You still do Codemagic's one-time signing setup (App Store Connect key, Android keystore, Google Play key) on codemagic.io; README.md in the repository has the steps.

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

The **Xcode & Android Studio** section of Build Settings (also shown for Flutter) has the **Bundle ID** / **package name** (the App ID), the **build number** (raise it for every upload), full screen and, for Xcode, your **Apple Team ID** and iPhone-only or iPhone and iPad. Both buttons are there, so you can download either project from either target.

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

## Flutter

Pick **Flutter project** in Build Settings for one Flutter (Dart) project that builds for **both iOS and Android**. Like the Xcode and Android Studio projects, the game runs in a full-screen web view (`webview_flutter`), and `lib/main.dart` answers the game's native calls in Dart:

- phone notifications (now, at a time, every day at a time, or repeating; tapping one tells the game which), through `flutter_local_notifications`;
- haptics;
- in-app purchases through `in_app_purchase` (StoreKit and Google Play Billing), when the game sells products;
- camera and microphone for the game, and the permission texts it needs;
- the Back button on Android (the game goes back a page first).

The download has a `your_game/` folder (with `store-listing/` inside).

1. Install Flutter (`flutter doctor` should tick Android Studio and, on a Mac, Xcode).
2. In the folder, run `dart run tool/setup.dart` once. It runs `flutter create` to make the `android/` and `ios/` folders, then sets the **App ID**, the name, the permissions, the screen orientation, the app icon and the launch colour. Running it again is safe.
3. Run `flutter run` with a phone plugged in or a simulator open.
4. To publish: `flutter build appbundle` for Google Play, and `flutter build ipa` (or **Product › Archive** in Xcode) for the App Store.

The version comes from **App** in Build Settings and the build number from the Flutter section (both end up in `pubspec.yaml`). To update the game later, replace `assets/game/index.html` with a new download's.

## Native Preview for games

**File › Native Preview…**, the phone button in the scene toolbar, or *Preview it* in Build Settings › Flutter project runs your **game** in a phone right in the scene view (sized to fit; **⤢** for full screen; it rebuilds the game a moment after you edit, and **↺ Restart** rebuilds it now), inside a web view the way the native projects host it, and lets you read each project's code. Pick **Flutter**, **Kotlin** or **Xcode** at the top:

- the game sees a native Android (Flutter, Kotlin) or iOS (Xcode) app, just as it will on the phone;
- the native bridge is simulated the way each project answers it: the **notification permission** prompt (Allow / Don't Allow), **notifications** dropping in as banners (tap one and the game gets *notification opened*), the **store sheet** for in-app purchases (Buy / Cancel, nothing charged), **haptics** (the phone shakes), Android's **Back** key (◁ under the phone) and the game closing the app;
- **Native calls** under the phone lists each call as it happens;
- **Code** shows every file of that project (`lib/main.dart`, `GameBridge.kt`, `GameApp.swift`…), and **Download** gives the real one.

The **Kotlin project** (Build Settings › Flutter project › *Also: Kotlin project*) hosts the game in a Kotlin Multiplatform app (Compose) for Android and iOS: an Android WebView and an iOS WKWebView, with haptics, Back and closing in `GameBridge.kt`. It doesn't have phone notifications and in-app purchases yet (the game is told and carries on; the preview shows exactly that); the Flutter, Xcode and Android Studio projects have them.

## Pocket Engine as a phone app

The repository's `mobile/` folder is Pocket Engine itself as an iPhone and Android app, made with Expo (React Native).

- **Native screens:** Home, Projects (search, open, rename, duplicate, export, delete, import, back up), Learn (the guides) and Settings (the look, haptics, the editor's address).
- **The editor:** native React Native screens: Hierarchy, Inspector (every component's settings, Add Component), Add, Console, undo / redo, auto-save and Play. Only the scene and the running game are drawn by the engine, in a web view; tap to select, drag to move, pinch to zoom.
- **The full editor:** the web editor opens full screen in the app for everything else (⋯ › Open in the full editor, or Settings › Open projects in). The phone's Back button returns to Home.
- **Exports:** they go to the phone's share sheet.
- **Your projects:** they stay in the editor's storage on the phone, the same as the web version.

To try it, run `npm install` and then `npx expo start` in `mobile/`. Its README has the build and store steps.

## Native code (games)

2D games can be written out as native code too, with **no web view**: a **Flutter** app (Dart, drawn on a Flutter canvas) or a **Kotlin Multiplatform** app (Compose, Android and iOS). The game goes in exactly as it's saved (\`assets/game.json\` / \`GameData.kt\`), and a readable runtime (\`lib/pocket_game.dart\` / \`PocketGame.kt\`) plays it with the engine's rules: shapes (with their glow) and text, the HUD anchored to the screen edges, touch, dragging and keys, the camera (fixed or following), score, lives, the best score, saved progress, a time limit and a win score, the title and game-over screens, particles, screen shake and haptics.

Components with a native version so far: Move, Score over time, Spawner, Velocity, Rotate, Hazard, Destroy off-screen, Collectible, Tap Target, Pulse, Lifetime, Income, Upgrade Button, Shooter, Projectile, Breakable, Bouncing Ball and Camera. That covers games like Sky Dodge, Tap Frenzy, Cookie Tap, Star Defender and Brick Breaker. Anything else is listed in the README, in Build Settings and in the Native Preview, and does nothing in the native version yet (choose **Web view** there to keep it). Sound effects, pictures (sprites) and levels after the first aren't in the native version yet. 3D games use the web view projects.

**File › Native Preview** has a **Native code / Web view** switch for Flutter and Kotlin: Native code shows and downloads the native project; Web view is the game in a WebView, as before. Build Settings › Native code has the same downloads for games.

## Native code (apps)

**Edit it right in the native preview.** In File › Native App Preview, turn on **✎ Edit** and tap any part of the app (in the Flutter, Kotlin, SwiftUI or React Native tab): the editor selects that object and opens it in the Inspector. Change it there and the preview, and the code of all four, follow straight away; selecting something in the editor lights it up in the preview (on its page). Turn ✎ Edit off to use the app again.

The Inspector's **Native code** card (on any part of an app's page) says whether it's fully native in all four, drawn as its card, or a placeholder, and shows the exact Flutter, Kotlin, SwiftUI and React Native code made for it, with Copy and *Show in the native preview*. In games, each component's header has a **native** or **web view only** chip for the native Flutter / Kotlin game.

The Flutter, Xcode and Android Studio projects all run your project in a web view. For an **app**, pick **Native code (apps)** in Build Settings to get it written out as real native code instead, to keep building on in code:

- **Native Flutter code**: a Flutter app (Dart widgets) for iOS and Android. Run `dart run tool/setup.dart`, then `flutter run`.
- **Native SwiftUI code**: an Xcode project with a SwiftUI app (iOS 16 or newer). Open the `.xcodeproj` and press Run.
- **Native Kotlin code**: a Kotlin Multiplatform app with Compose Multiplatform: one Kotlin codebase, the screens too, for **Android and iOS**. Open the folder in Android Studio (with the Kotlin Multiplatform plugin) and press Run, or `sh gradlew :composeApp:installDebug`; for iOS open `iosApp/iosApp.xcodeproj` on a Mac (Xcode builds the Kotlin part with Gradle for you). Data is saved with SharedPreferences on Android and NSUserDefaults on iOS.
- **Native React Native code**: an [Expo](https://expo.dev) app with real React Native views (JavaScript), for **iOS and Android** (and the web). Run `npm install`, then `npx expo start` and scan the QR code with Expo Go; `eas build` makes the store apps. `App.js` holds the app (pages, tabs, data, App Bar, Bottom Nav, Side Menu), `pages/` one component per page, `pocket.js` the runtime. It's built from the same model as the other three, so it looks and works the same (the editor's line icons too, drawn with react-native-svg); the native preview's **React Native** tab shows it and its code.

What becomes native code:

| In Pocket Engine | Native |
| --- | --- |
| Pages (Show If on `page`) | one widget / view per page, with Back |
| App Bar titles | the page title in the navigation bar |
| Bottom Nav | Flutter and Compose `NavigationBar` / SwiftUI `TabView` (badges too); floating styles (Floating, Glass, Segmented, Dock) as a rounded bar inset from the edges |
| Side Menu | opened by the App Bar's ☰ or your avatar: a Flutter `Drawer`, a Compose / SwiftUI panel over the app, with its header (you, or a title and picture), rows that open pages, switches for variables (Dark mode…), badges, sections, lines and footer; message rows are TODOs |
| Text with `{variables}` and `{record_field}` | text that fills them in |
| Buttons: go to page, go back, new record, edit / delete the opened record, set / add to a variable | the same, through `app.run(...)` |
| Data List (search, filter, sort, checkbox, open a page, swipe to delete) | `RecordList` |
| Form (adds, or changes the opened record; text, numbers, dates, choices, yes/no) | `RecordForm` |
| Text inputs, switches (Dark mode too), cards, plain lists, web pictures | native controls |
| Cards, badges, picture boxes and menu rows with things inside (every Page Template: Welcome, Sign In, Settings, Dashboard, Pricing, FAQ, Game Shop, Levels, Leaderboard…) | `PBox`: the card's size, colours, corners and shadow, with each thing in it pinned where the design puts it (left, centred or right, scaled to the phone's width); rows share their width |
| Slider, Segmented tabs, Chips, Dropdown, Stepper, Star Rating, Divider, Avatar, Banner, XP Bar, Steps, Spinner, Back Button, Animated Counter, progress bars, empty space | `PSlider`, `Segmented`, `Chips`, `PDropdown`, `PStepper`, `PRating`, `PDivider`, `PAvatar`, `PBanner`, `XpBar`, `PSteps`, `PSpinner`, `PBar`, `PSpace` |
| Data collections and their sample records, Data Stats | `AppState`, saved on the phone |
| Social: Feed (timeline, reels, grid; like, repost, save, tap an author for their profile), Composer, Stories, Inbox and Chat, Profile header, Marketplace (details, Message seller), Notifications, Saved, Friends / Who to follow, Achievements, Trending | `SocialFeed`, `Composer`, `Stories`, `Inbox`, `Chat`, `ProfileHeader`, `Marketplace`, `Activity`, `People`, `Achievements`, `Trending`, reading the same Posts, Messages, Stories, Listings, Profiles and Notifications collections |

**Try it first: the phone button in the scene toolbar** (next to **UI**), **File › Native App Preview…** or *Preview & test the native app* in this section opens your app the way the native code builds it, right in the scene view, with the Hierarchy and Inspector still there. It follows your edits: change a text, a page or a component and the preview updates a moment later, on the same tab. The phone is sized to fit the space (**Fit**); **−** and **+** make it smaller or bigger, **⤢** makes the preview full screen and **⊡** puts it back, and the phone button (or **✕**) closes it. Pick **Flutter**, **Kotlin** or **SwiftUI** at the top: Flutter and Kotlin show the Material look, SwiftUI the iOS look. Tap around, add, edit, tick and delete records, search, switch tabs and Dark mode: the preview follows the same rules as the native runtimes, with the app's sample data (**Reset** starts again). **Code** shows every file the export writes (on a wide screen, next to the app); **This page** jumps to the code for the page on screen, and **Copy** copies a file. **Download** gives the real project. Nothing is compiled in the preview: build the download to run it on a phone. Like a real phone it has no scroll bars (not even the iPhone's own scroll indicator down the right side): scroll with a finger, the mouse wheel or a trackpad.

The native code also follows your design: light or dark the way the editor decides (the darkMode variable, else the theme you picked, else — no theme picked — your background's brightness), your accent in both, the App Bar's look (an X-style avatar showing your name's initials, “?” while the name is blank, and the app name, centred or left title), its buttons with their badges (dark mode, pages) plain or in circles / rings (*Icon buttons*), the Bottom Nav's style, when names show and colours, and the editor's own line icons on both bars (Flutter, Compose, SwiftUI and React Native draw the same shapes; a tab bar that isn't floating on iPhone uses the nearest SF Symbol), Data List rows (round ticks, faded done rows, swipe left to delete, dates read as Today / Tomorrow), outlined search boxes, and the feed the way the app draws it (a feed whose collection you haven't made shows the editor's sample posts, and the export gets them as its Posts; the preview also shows the records you've saved while trying the app in the editor, so it looks like your scene): initials avatars, name ✓ @handle · 9m, #hashtags in your accent colour, one to four pictures, comment / repost / like / views / save / share, its tabs (For you / Following), and “Your story” first in Stories. The social versions cover the everyday actions (post, like, repost, save, message, open a profile); the web app's extras (comments threads, polls, voice notes, reactions, encryption, online sync) stay in the web version for now. Any other component is drawn as its card (its shape, colours, text and what's inside, without its own behaviour), or as a placeholder marked **TODO** when it has no card; the README lists them.

All four (Flutter, Kotlin, SwiftUI and React Native) also have native versions of these components: **Chart** (columns, bars, line, area, pie, donut, radar; tracking a variable over time too), **Carousel**, **Swipe Pages**, **Photo Grid**, **Like Button**, **News Ticker**, **Timer** (ring, bar, digits or pill, with its start / pause / reset messages), **Skeleton Loader**, **Colour Picker**, **Keypad** (with an answer and right / wrong messages), **Option Picker**, **Popup** and **Bottom Sheet** (open and close on their messages), and **Notifications** ("notify Title|text|icon", over every page). Buttons, App Bar buttons and Side Menu rows that send a **message** now send it in the native app too (`app.send`), so these components hear them. A component's game colours that you haven't changed follow the app's light or dark theme. Wrappers like **UI Animation**, **Tooltip**, **Layout Group**, **Scroll View** and **Panel** keep their card and everything in it (a Panel shows its title). Build Settings shows how many pages convert and which parts will be placeholders before you download. The pages are generated from your project; the runtime (`lib/pocket.dart`, `App/Pocket.swift` or `Pocket.kt`) is a fixed, readable file with the state and the building blocks. Change both as you like: from then on the code is yours.

## In-app purchases

Sell coins, unlocks (Remove Ads, a level pack) and subscriptions with the App Store and Google Play.

1. **Game Settings › In-App Purchases**: add each product with a **Product ID** (like `coins_100` or `remove_ads`), a name, the price to show while testing, and its kind:
   - **Consumable** (buy again and again): set *Adds to variable* and *Amount*, e.g. `coins` + `100`.
   - **Unlock** (bought once, kept forever): check it with **Owns Product**.
   - **Subscription** (VIP, monthly): also checked with **Owns Product**.
2. In a script, use **Buy Product** (ports *bought*, *cancelled*, *failed*), **Restore Purchases** (*done*), **Owns Product** (true / false) and **Product Price** (the store's price in the player's money once known). Triggers have *Buy product* and *Restore purchases* actions. Scripts get the `purchase` event (`id`, `status`) and the messages `purchase bought` / `purchase cancelled` / `purchase failed` (with the product ID), plus `purchased` when an approval arrives later (Ask to Buy, a pending card payment).
3. **Testing**: in the editor and test links, Buy Product shows a test sheet with *Buy*, *Cancel* and *Test a failed payment*. Nothing is charged. Unlocks are remembered on the device like real ones.
4. **Builds**: the Xcode export answers with **StoreKit 2**. The Android Studio export adds **Google Play Billing 7** (`Billing.java`). The Expo export adds **expo-iap** (StoreKit 2 / Play Billing; needs an EAS or dev build, not Expo Go). The Flutter export uses **in_app_purchase**. Each README lists your products and the store steps:
   - create each product with **the same ID** in App Store Connect (*Monetization › In-App Purchases*) and in Google Play Console (*Monetize › Products*, after uploading a testing build);
   - sign Apple's Paid Apps agreement;
   - test with an Apple Sandbox account and a Google Play license tester.
5. A plain web build can't take payments: Buy Product reports *failed* and tells the player to use the app.

Apple requires a **Restore Purchases** button when you sell unlocks or subscriptions. Consumables are used up right away (so they can be bought again); unlocks and subscriptions are acknowledged so Google doesn't refund them. On Google Play, consumables paid for while the game was closed are given the next time it starts.

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
