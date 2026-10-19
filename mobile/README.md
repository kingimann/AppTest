# Pocket Engine for iPhone and Android

This folder is Pocket Engine as a phone app, made with [Expo](https://expo.dev) (React Native).

- **Native screens** (React Native): **Home** (carry on with your last project, start a game or app from a template, recent projects), **Projects** (search, filter 2D / 3D / apps; open, rename, duplicate, export, delete; import a project or a backup; back up everything), **Learn** (the guides) and **Settings** (dark / light / follow the phone, haptics, the editor's address).
- **The editor** is native too (`src/editor/`): a top bar (Home, the project name with Saved / Saving…, Undo, Redo, Play / Stop, ⋯), the scene, and a panel you drag between three heights with four tabs, all in React Native: **Hierarchy** (the object tree, search, show / hide, hold an object for Duplicate, Move up / down, Delete), **Inspector** (name, visible, tags, transform, shape, mesh, text, physics, and every component with its settings made from the engine's own schemas; **Add Component** with search and categories), **Add** (ready-made objects and shapes, placed in the middle of the view) and **Console** (logs, warnings and errors while you play). Changes save on their own and can be undone. Only the scene and the running game are drawn by the engine, in a web view (`editor/scene.html`): tap an object to select it, drag it to move it, drag empty space to pan (2D) or orbit (3D), pinch to zoom.
- **The full editor** (Pocket Engine's web editor, full screen in the app) is one tap away for everything else (node logic, triggers, data, Build Settings…): ⋯ › Open in the full editor, the project sheet's row of the same name, or Settings › Open projects in. Its Home and the phone's Back button come back to the app's Home (your work is saved first). What it exports (store projects, backups, native code) opens the phone's share sheet. Vibration becomes haptics.
- **Your projects** stay in the editor's storage on the phone, the same as the web version. The app reads and changes them through a small hidden page on the editor's site (`editor/bridge.html`).

## Try it

1. Install [Node.js](https://nodejs.org) 20 or newer. In this folder, run `npm install`.
2. Run `npx expo start` and scan the QR code with **Expo Go** (iPhone: the Camera app). Or press `a` for an Android emulator, `i` for the iOS simulator, or `w` for a web browser.

## Build and publish

1. Make a free account at [expo.dev](https://expo.dev). Then run `npm install -g eas-cli` and `eas login`.
2. `eas build --platform all` builds the iOS and Android apps in the cloud. `eas submit` uploads them to the App Store and Google Play.

The bundle ID and package are `com.pocketengine.app` (app.json). Change them to your own before you publish.

## The code

- `App.js`: the tabs, the project sheet (⋯), and moving between the native screens and the editor.
- `src/screens/`: Home, Projects, Learn, Settings, Editor (the editor in a web view) and Docs (a guide in a web view).
- `src/bridge.js`: asks the hidden `editor/bridge.html` page to list, rename, duplicate, delete, import, export or back up projects.
- `src/WebFrame.js`: the web view (`WebFrame.web.js` is an iframe for the web version). It sends downloads to `src/files.js` (save and share) and turns vibration into haptics.
- `src/prefs.js`: the settings. `src/icons.js`: the editor's own line icons.

By default the app opens the editor from https://kingimann.github.io/AppTest. If you host your own copy, change it in Settings › Editor address. In the web version, `?site=` does the same.
