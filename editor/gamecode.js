// Native game export: a 2D game written out as a Flutter (Dart) or Kotlin Multiplatform (Compose) project that draws and
// runs it natively, with no web view. The game itself goes in as its saved JSON (assets/game.json); a fixed, readable
// runtime (editor/native/flutter/pocket_game.dart, editor/native/kotlin/PocketGame.kt) plays it with the engine's rules.
// Components with no native version yet are listed in the README (and in Build Settings) and do nothing in the native game.
import { dartName, FLUTTER_VERSIONS } from './flutter.js';
import { dartSetup } from './nativecode.js';
import { kotlinNativeFiles, kotlinPackage } from './kotlincode.js';

/** The components the native game runtimes have (the same in Dart and Kotlin). */
export const NATIVE_GAME_COMPONENTS = new Set([
  'move', 'platformer', 'controller2d', 'timeScore', 'spawner', 'velocity', 'rotate', 'hazard', 'destroyOffscreen', 'collectible', 'tappable',
  'pulse', 'lifetime', 'income', 'upgrade', 'shooter', 'projectile', 'destructible', 'bounce', 'camera', 'cameraFollow', 'cameraImpulse',
  'cameraControls', 'patrol', 'goal', 'spring', 'wrap', 'chase', 'float', 'message', 'teleport', 'unlock', 'sound', 'draggable', 'swipeMove',
  'orbit', 'checkpoint', 'follow', 'wander', 'path', 'turret', 'dropItem', 'emitter', 'particles', 'blink', 'forceZone', 'touchButton', 'button',
  'clickPopup', 'comboClicker', 'longPress', 'doubleTap', 'tapToggle', 'pressFeedback', 'tapToSpawn', 'dragLaunch', 'trigger', 'timer', 'condition',
  'waveSpawner', 'dayNight', 'typewriter', 'health', 'damager', 'hunger', 'thirst', 'car', 'savePoint', 'autoSave', 'saveManager', 'joint',
  'navigator', 'enemyAI', 'loader']);
/** Shapes the native runtimes draw (others are drawn as a rounded box). */
const NATIVE_SHAPES = new Set(['rect', 'circle', 'ring', 'star', 'triangle', 'ellipse', 'diamond', 'emoji', 'hexagon', 'pentagon', 'cross', 'arrow', 'capsule', 'pill', 'heart', 'line', 'polygon']);

const semver = (v) => String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.');
const ds = (s) => "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'";

/** Can this game go native, and what's missing? { ok, three, levels, missing: [{type, names}], shapes: [...], sprites } */
export function gameReport(game) {
  const ents = game.entities || [], three = game.mode === '3d' || ents.some((e) => e.mesh);
  const miss = new Map(), shapes = new Set();
  let sprites = 0;
  for (const e of ents) {
    for (const b of e.behaviors || []) if (!NATIVE_GAME_COMPONENTS.has(b.type)) { if (!miss.has(b.type)) miss.set(b.type, new Set()); miss.get(b.type).add(e.name || e.id); }
    if (e.shape?.type && !NATIVE_SHAPES.has(e.shape.type)) shapes.add(e.shape.type);
    if (e.sprite?.src) sprites++;
  }
  const missing = [...miss].map(([type, names]) => ({ type, names: [...names] }));
  return { ok: !three, three, levels: (game.levels || []).length, missing, shapes: [...shapes], sprites };
}

/** What goes in assets/game.json: the first scene as saved (later levels and the editor's own bits left out). */
const gameJson = (game) => { const { levels, editor, history, ...rest } = game; return JSON.stringify(rest); };

function gameReadme(game, o, rep, kind) {
  const flutter = kind === 'flutter', gaps = [
    ...rep.missing.map((m) => `- **${m.type}** (on ${m.names.slice(0, 4).join(', ')}${m.names.length > 4 ? '…' : ''}): no native version yet, so it does nothing`),
    ...rep.shapes.map((s) => `- the **${s}** shape: drawn as a rounded box`),
    ...(rep.sprites ? [`- pictures (sprites, ${rep.sprites}): drawn as their shape for now`] : []),
    ...(rep.levels ? [`- levels after the first (${rep.levels}): only the first one is in`] : []),
  ];
  return `# ${game.name || 'Game'} (native ${flutter ? 'Flutter' : 'Kotlin'})

Your Pocket Engine game as a native ${flutter ? 'Flutter (Dart)' : 'Kotlin Multiplatform (Compose)'} app for iOS and Android, with **no web view**:
it's drawn on a ${flutter ? 'Flutter' : 'Compose'} canvas and runs in ${flutter ? 'Dart' : 'Kotlin'}, with the same rules as the editor.

## Run it

${flutter ? `1. Install Flutter: https://docs.flutter.dev/get-started/install
2. In this folder: \`dart run tool/setup.dart\` (makes the iOS and Android folders, sets the app ID **${o.appId}**, the name and the icon)
3. \`flutter run\`` : `1. Open this folder in Android Studio (with the Kotlin Multiplatform plugin) and press Run for Android.
2. For iPhone, open \`iosApp/iosApp.xcodeproj\` in Xcode on a Mac and press Run.`}

## How it's made

| File | What it is |
| --- | --- |
| \`${flutter ? 'assets/game.json' : 'composeApp/src/commonMain/composeResources/files/game.json'}\` | Your game, exactly as Pocket Engine saved it: objects, shapes, text, components, settings |
| \`${flutter ? 'lib/pocket_game.dart' : 'PocketGame.kt'}\` | The runtime: reads the game and plays it (drawing, touch and keys, score, lives, best score, title and game-over screens, components) |
| \`${flutter ? 'lib/main.dart' : 'App.kt'}\` | Starts the game full screen |

Change the game in Pocket Engine and download again, or edit \`game.json\` and the runtime directly: from now on the code is yours.
Sound effects aren't in the native version yet; taps and hits use the phone's haptics.
${gaps.length ? `\n## Still to build\n\n${gaps.join('\n')}\n` : ''}`;
}

/** The Flutter project's files for a 2D game. runtime: the text of editor/native/flutter/pocket_game.dart. */
export function flutterGameFiles(game, o, { runtime, icon }) {
  const rep = gameReport(game), pkg = dartName(o.name || game.name || 'game'), dir = pkg + '_native/', V = FLUTTER_VERSIONS;
  const portrait = (game.settings?.orientation || 'portrait') === 'portrait', landscape = game.settings?.orientation === 'landscape';
  const files = [
    { name: dir + 'README.md', data: gameReadme(game, o, rep, 'flutter') },
    { name: dir + 'pubspec.yaml', data: `name: ${pkg}
description: ${JSON.stringify((game.name || 'A game') + ', made with Pocket Engine.')}
publish_to: 'none'
version: ${semver(o.version)}+${Math.max(1, +o.buildNumber || 1)}

environment:
  sdk: ${V.sdk}

dependencies:
  flutter:
    sdk: flutter
  shared_preferences: ${V.shared_preferences}

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ${V.flutter_lints}
  flutter_launcher_icons: ${V.flutter_launcher_icons}

flutter:
  uses-material-design: true
  assets:
    - assets/game.json

flutter_launcher_icons:
  android: true
  ios: true
  image_path: assets/icon/icon.png
  remove_alpha_ios: true
` },
    { name: dir + 'analysis_options.yaml', data: 'include: package:flutter_lints/flutter.yaml\n' },
    { name: dir + 'lib/main.dart', data: `// ${game.name || 'Game'}: a native Flutter game, made by Pocket Engine's native export.
// assets/game.json is the game; lib/pocket_game.dart plays it (no web view).
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'pocket_game.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  ${portrait ? "await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);" : landscape ? "await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);" : '// (any orientation)'}
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  final game = PocketGame(jsonDecode(await rootBundle.loadString('assets/game.json')) as Map<String, dynamic>);
  await game.load();
  runApp(MaterialApp(
    title: ${ds(o.name || game.name || 'Game')},
    debugShowCheckedModeBanner: false,
    home: Scaffold(backgroundColor: game.background, body: PocketGameView(game: game)),
  ));
}
` },
    { name: dir + 'lib/pocket_game.dart', data: runtime },
    { name: dir + 'assets/game.json', data: gameJson(game) },
    { name: dir + 'tool/setup.dart', data: dartSetup({ ...o, name: o.name || game.name || 'Game' }, pkg) },
    { name: dir + 'test/game_test.dart', data: `// flutter test: the game loads, starts and runs a few seconds of play.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:${pkg}/pocket_game.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized(); // (haptics and sounds talk to the phone)
  test('the game plays', () async {
    SharedPreferences.setMockInitialValues({});
    final game = PocketGame(jsonDecode(File('assets/game.json').readAsStringSync()) as Map<String, dynamic>);
    await game.load();
    game.screen = const Size(400, 800);
    game.start();
    for (var i = 0; i < 180; i++) { game.step(1 / 60); }
    expect(game.time, greaterThan(0));
  });
}
` },
    { name: dir + '.gitignore', data: '.dart_tool/\n.flutter-plugins\n.flutter-plugins-dependencies\nbuild/\n*.iml\n.idea/\nandroid/.gradle/\nandroid/local.properties\nios/Pods/\nios/.symlinks/\nios/Flutter/Generated.xcconfig\n' },
  ];
  if (icon && icon.length) files.push({ name: dir + 'assets/icon/icon.png', data: icon });
  return { report: rep, files };
}

/** A Kotlin string literal. */
const ks = (t) => '"' + String(t ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n') + '"';

/** The Kotlin Multiplatform project's files for a 2D game: the app project's Gradle / Android / iOS shell, with the game in it.
 *  runtime: editor/native/kotlin/Pocket.kt (saving, Back), gameRuntime: editor/native/kotlin/PocketGame.kt. */
export function kotlinGameNativeFiles(game, o, { runtime, gameRuntime, wrapper, icon }) {
  const rep = gameReport(game), pkg = kotlinPackage(o.appId), name = o.name || game.name || 'Game';
  const shell = kotlinNativeFiles({ name, settings: { app: true, appName: name }, entities: [] }, { ...o, name, orientation: o.orientation || game.settings?.orientation || 'portrait' }, { runtime, wrapper, icon }).files;
  const dir = shell[0].name.split('/')[0] + '/', src = `${dir}composeApp/src/commonMain/kotlin/${pkg.replace(/\./g, '/')}/`, test = src.replace('commonMain', 'commonTest');
  const keep = shell.filter((f) => !f.name.startsWith(src + 'pages/') && f.name !== src + 'App.kt' && f.name !== dir + 'README.md' && !f.name.startsWith(test));
  const text = gameJson(game), chunks = text.match(/[\s\S]{1,20000}/g) || ['{}'];
  return { report: rep, files: [
    ...keep,
    { name: dir + 'README.md', data: gameReadme(game, o, rep, 'kotlin') },
    { name: src + 'App.kt', data: `// ${name}: a native Kotlin game (Compose for Android and iOS), made by Pocket Engine's native export.
// GameData.kt is the game; PocketGame.kt plays it (no web view).
package ${pkg}

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember

@Composable
fun App() {
    val game = remember { PocketGame(GAME_JSON) }
    PocketGameView(game)
}
` },
    { name: src + 'PocketGame.kt', data: gameRuntime.replace('package __PACKAGE__', 'package ' + pkg) },
    { name: src + 'GameData.kt', data: `// The game, exactly as Pocket Engine saved it (objects, shapes, text, components, settings).
package ${pkg}

val GAME_JSON: String = listOf(
${chunks.map((c) => '    ' + ks(c) + ',').join('\n')}
).joinToString("")
` },
    { name: test + 'GameTest.kt', data: `package ${pkg}

import androidx.compose.ui.geometry.Size
import kotlin.test.Test
import kotlin.test.assertTrue

class GameTest {
    @Test fun thePlayGoesOn() {
        val game = PocketGame(GAME_JSON)
        game.screen = Size(400f, 800f)
        game.start()
        repeat(180) { game.step(1.0 / 60) }
        assertTrue(game.time > 0)
    }
}
` },
  ] };
}
