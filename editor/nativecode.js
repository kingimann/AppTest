// Native code export: an app project written out as a real Flutter app (Dart widgets) or a SwiftUI app, with no
// web view. Pages, the App Bar, the Bottom Nav, text, buttons, Data Lists, Forms, inputs, switches and data
// collections become native code; anything else is left as a placeholder with a TODO. The runtime (state, data,
// building blocks) is a fixed file (editor/native/…); the pages are generated from the project.
import { appModel, PALETTES, iconFor } from './appmodel.js';
import { dartName, FLUTTER_VERSIONS } from './flutter.js';

const semver = (v) => String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.');
/** A Dart string literal ('…', with $ and quotes escaped). */
const ds = (s) => "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'";
/** A Swift string literal ("…"). */
const ss = (s) => '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
const camel = (s, fb) => { const w = String(s || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean); const t = w.map((x) => x[0].toUpperCase() + x.slice(1)).join(''); return /^[A-Za-z]/.test(t) ? t : fb + t; };
const hexArgb = (h) => '0xFF' + String(h).replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
const snake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const lit = (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : null);
const tokenColor = (c) => (c && (/^@\w+$/.test(c) || /^#[0-9a-f]{6}$/i.test(c)) ? c : '');

/** Page class / file names that don't clash. */
function names(model) {
  const used = new Set(), out = {};
  for (const p of model.pages) { let n = camel(p.value, 'Page') + 'Page'; while (used.has(n)) n += '2'; used.add(n); out[p.value] = n; }
  return out;
}

// =============================================================================================================
// Flutter
// =============================================================================================================

function dartValue(v) { return lit(v) ?? (v == null ? 'null' : ds(v)); }

function dartElement(x, ind) {
  const pad = ' '.repeat(ind);
  switch (x.kind) {
    case 'text': return `PText(${ds(x.value)}${x.size !== 16 ? `, size: ${x.size}` : ''}${x.weight !== '600' ? `, weight: ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color: ${ds(tokenColor(x.color))}` : ''})`;
    case 'button': return `PButton(${ds(x.label)}, onTap: () => app.run(${ds(x.action)}, ${dartValue(x.value)}${x.amount !== 1 && x.amount != null ? `, ${+x.amount || 0}` : ''})${x.outlined ? `, look: ${/danger/.test(x.color) ? 'Look.danger' : 'Look.outlined'}` : ''})`;
    case 'list': return `RecordList(collection: ${ds(x.collection)}, title: ${ds(x.title)}${x.subtitle ? `, subtitle: ${ds(x.subtitle)}` : ''}${x.icon ? `, icon: ${ds(x.icon)}` : ''}${x.check ? `, check: ${ds(x.check)}` : ''}${x.search ? `, search: ${ds(x.search)}` : ''}${x.filter ? `, filter: ${ds(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort: ${ds(x.sort)}` : ''}${x.openPage ? `, openPage: ${ds(x.openPage)}` : ''}, empty: ${ds(x.empty)})`;
    case 'form': return `RecordForm(collection: ${ds(x.collection)}${x.fields.length ? `, fields: [${x.fields.map(ds).join(', ')}]` : ''}, mode: FormMode.${{ new: 'newRecord', edit: 'editOpened', auto: 'auto' }[x.mode]}, saveLabel: ${ds(x.saveLabel)}${x.after !== 'go back' ? `, after: ${ds(x.after)}` : ''}${x.page ? `, page: ${ds(x.page)}` : ''})`;
    case 'input': return `VarField(${ds(x.var)}${x.placeholder ? `, placeholder: ${ds(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard: ${ds(x.keyboard)}` : ''})`;
    case 'toggle': return `VarSwitch(${ds(x.var)}${x.label ? `, label: ${ds(x.label)}` : ''})`;
    case 'items': return `StaticList([${x.items.map(ds).join(', ')}])`;
    case 'image': return `PImage(${ds(x.src)}, height: ${x.h})`;
    case 'row': return `PCard(children: [\n${x.children.map((c) => pad + '  ' + dartElement(c, ind + 2)).join(',\n')},\n${pad}])`;
    default: return `TodoBox(${ds(x.name)}, ${ds(x.type)}) /* TODO: build the ${x.type} natively */`;
  }
}

function dartPage(p, cls, model) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = [];
  let bottom = false;
  for (const x of p.items) {
    const code = dartElement(x, 8);
    if (fills && x.fill && (x.kind === 'list' || x.kind === 'form')) parts.push(`Expanded(child: ${code})`);
    else parts.push(code);
    if (x.kind === 'button') bottom = true;
  }
  // buttons that sit at the bottom of a page without a list: pushed down with a Spacer
  if (!fills && bottom) { const i = parts.findIndex((_, k) => p.items[k].kind === 'button'); if (i > 0) parts.splice(i, 0, 'const Spacer()'); }
  const scroll = !fills && !(bottom && parts.includes('const Spacer()'));
  const fab = p.fab ? `\n      fab: FloatingActionButton(onPressed: () => app.run(${ds(p.fab.action)}, ${dartValue(p.fab.value)}), child: const Icon(Icons.add)),` : '';
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
import 'package:flutter/material.dart';

import '../pocket.dart';

class ${cls} extends StatelessWidget {
  const ${cls}({super.key});

  @override
  Widget build(BuildContext context) => PocketPage(
      title: ${ds(p.title)},${model.appBar ? '' : '\n      appBar: false,'}${scroll ? '' : '\n      scroll: false,'}${fab}
      body: (context) => [
${parts.map((c) => '        ' + c + ',').join('\n')}
      ],
    );
}
`;
}

function dartMain(model, N) {
  const pal = (P) => `Palette({${Object.entries(P).map(([k, v]) => `${ds(k)}: Color(${hexArgb(v)})`).join(', ')}})`;
  const light = { ...PALETTES.light, accent: model.accent }, dark = { ...PALETTES.dark };
  const field = (f) => `Field(${ds(f.key)}, ${ds(f.name)}, ${ds(f.type)}${f.options.length ? `, options: [${f.options.map(ds).join(', ')}]` : ''}${f.def !== '' && f.def != null ? `, def: ${dartValue(f.def)}` : ''})`;
  const row = (r) => `{${Object.entries(r).map(([k, v]) => `${ds(k)}: ${dartValue(v)}`).join(', ')}}`;
  return `// ${model.name}: a native Flutter app, made by Pocket Engine's native export.
// lib/pocket.dart has the app's state and building blocks; lib/pages/ has one file per page.
import 'package:flutter/material.dart';

import 'pocket.dart';
${model.pages.map((p) => `import 'pages/${snake(N[p.value])}.dart';`).join('\n')}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  app = AppState(
    name: ${ds(model.name)},
    home: ${ds(model.home)},
    themeSetting: ${ds(model.theme)},
    light: const ${pal(light)},
    dark: const ${pal(dark)},
    vars: {${Object.entries(model.vars).map(([k, v]) => `${ds(k)}: ${dartValue(v)}`).join(', ')}},
    tabs: const [${model.tabs.map((t) => `\n      NavTab(${ds(t.label)}, Icons.${iconFor(t.icon, 0)}, ${ds(t.page)}${t.badge ? `, badge: ${ds(t.badge)}` : ''}),`).join('')}${model.tabs.length ? '\n    ' : ''}],
    collections: const [${model.collections.map((c) => `\n      Collection(${ds(c.name)}, [${c.fields.map(field).join(', ')}]${c.rows.length ? `, sample: [${c.rows.map(row).join(', ')}]` : ''}),`).join('')}${model.collections.length ? '\n    ' : ''}],
    stats: const [${model.stats.map((s) => `\n      Stat(${ds(s.var)}, ${ds(s.collection)}, ${ds(s.how)}${s.field && s.field !== 'field' ? `, field: ${ds(s.field)}` : ''}${s.filter ? `, filter: ${ds(s.filter)}` : ''}${s.format === 'money' ? ', money: true' : ''}),`).join('')}${model.stats.length ? '\n    ' : ''}],
  );
  await app.load();
  runApp(PocketApp(pages: {
${model.pages.map((p) => `    ${ds(p.value)}: (_) => const ${N[p.value]}(),`).join('\n')}
  }));
}
`;
}

/** tool/setup.dart for the native app: flutter create, then the app ID, name and icon. */
function dartSetup(o, pkg) {
  const org = String(o.appId).split('.').slice(0, -1).join('.') || 'com.example';
  return `// Run once after unzipping:   dart run tool/setup.dart     (needs Flutter on your PATH; safe to run again)
import 'dart:io';

const appId = ${ds(o.appId)};
const appName = ${ds(o.name)};

Future<void> run(String cmd, List<String> args) async {
  stdout.writeln('> \$cmd \${args.join(' ')}');
  final p = await Process.start(cmd, args, mode: ProcessStartMode.inheritStdio, runInShell: true);
  if (await p.exitCode != 0) { stderr.writeln('That failed. Fix it, then run this again.'); exit(1); }
}

void edit(String path, String Function(String) change) {
  final f = File(path);
  if (!f.existsSync()) return;
  final before = f.readAsStringSync(), after = change(before);
  if (after != before) { f.writeAsStringSync(after); stdout.writeln('  updated \$path'); }
}

Future<void> main() async {
  if (!Directory('android').existsSync() || !Directory('ios').existsSync()) {
    await run('flutter', ['create', '.', '--project-name', ${ds(pkg)}, '--org', ${ds(org)}, '--platforms', 'android,ios']);
  }
  await run('flutter', ['pub', 'get']);
  for (final g in ['android/app/build.gradle.kts', 'android/app/build.gradle']) {
    edit(g, (t) => t.replaceAll(RegExp(r'applicationId\\s*=?\\s*"[^"]*"'), g.endsWith('.kts') ? 'applicationId = "\$appId"' : 'applicationId "\$appId"'));
  }
  edit('android/app/src/main/AndroidManifest.xml', (t) => t.replaceFirst(RegExp(r'android:label="[^"]*"'), 'android:label="\${appName.replaceAll('"', '&quot;')}"'));
  edit('ios/Runner.xcodeproj/project.pbxproj', (t) => t.replaceAllMapped(RegExp(r'PRODUCT_BUNDLE_IDENTIFIER = ([^;]*?)(\\.RunnerTests)?;'), (m) => 'PRODUCT_BUNDLE_IDENTIFIER = \$appId\${m[2] ?? ''};'));
  edit('ios/Runner/Info.plist', (t) => t.replaceFirst(RegExp(r'<key>CFBundleDisplayName</key>\\s*<string>[^<]*</string>'), '<key>CFBundleDisplayName</key>\\n\\t<string>\${appName.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</string>'));
  await run('dart', ['run', 'flutter_launcher_icons']);
  stdout.writeln('\\nDone. Run:  flutter run');
}
`;
}

function nativeReadme(model, o, kind) {
  const todo = model.todo.length ? `\n## Still to build\n\nThese parts of your app have no native version yet. Each shows a placeholder (search the code for \`TODO\`):\n\n${[...new Map(model.todo.map((t) => [t.name, t])).values()].map((t) => `- **${t.name}** (${t.type})`).join('\n')}\n` : '';
  const flutter = kind === 'flutter';
  return `# ${model.name} (native ${flutter ? 'Flutter' : 'SwiftUI'} code)

Your Pocket Engine app written out as a real ${flutter ? 'Flutter (Dart)' : 'SwiftUI (Swift)'} app, with no web view: native
pages, navigation${model.tabs.length ? ', tabs' : ''}, lists, forms and your data collections (saved on the phone).
It's a starting point to keep building on: change anything you like.

## Run it

${flutter ? `1. Install Flutter: https://docs.flutter.dev/get-started/install
2. In this folder: \`dart run tool/setup.dart\` (makes the iOS and Android folders, sets the app ID **${o.appId}**, the name and the icon)
3. \`flutter run\`` : `1. Open \`${o.xcodeName || camel(model.name, 'App')}.xcodeproj\` in Xcode 16 or newer (on a Mac; iOS 16 or newer).
2. Under *Signing & Capabilities*, pick your team.
3. Pick an iPhone (or a simulator) and press Run.`}

## How it's made

| Pocket Engine | ${flutter ? 'Flutter' : 'SwiftUI'} |
| --- | --- |
| Pages | ${flutter ? '`lib/pages/*.dart`, one widget per page' : '`App/Pages/*.swift`, one view per page'} |
| App Bar | ${flutter ? '`AppBar` with the page title' : 'the navigation title'} |
| Bottom Nav | ${flutter ? '`NavigationBar`' : '`TabView`'} |
| Data List | \`RecordList\` |
| Form | \`RecordForm\` |
| Variables, collections, stats | \`AppState\` in ${flutter ? '`lib/pocket.dart`' : '`App/Pocket.swift`'} |
| Button actions (go to page, new record…) | \`app.run(...)\` |
${todo}`;
}

/** The Flutter project's files. runtime: the text of editor/native/flutter/pocket.dart. icon: PNG bytes (1024 px). */
export function flutterNativeFiles(game, o, { runtime, icon }) {
  const model = appModel(game), N = names(model), pkg = dartName(o.name || model.name), dir = pkg + '_native/', V = FLUTTER_VERSIONS;
  return { model, files: [
    { name: dir + 'README.md', data: nativeReadme(model, o, 'flutter') },
    { name: dir + 'pubspec.yaml', data: `name: ${pkg}
description: ${JSON.stringify(model.name + ', made with Pocket Engine.')}
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

flutter_launcher_icons:
  android: true
  ios: true
  image_path: assets/icon/icon.png
  remove_alpha_ios: true
` },
    { name: dir + 'analysis_options.yaml', data: 'include: package:flutter_lints/flutter.yaml\n' },
    { name: dir + 'lib/main.dart', data: dartMain(model, N) },
    { name: dir + 'lib/pocket.dart', data: runtime },
    ...model.pages.map((p) => ({ name: dir + `lib/pages/${snake(N[p.value])}.dart`, data: dartPage(p, N[p.value], model) })),
    { name: dir + 'tool/setup.dart', data: dartSetup({ ...o, name: o.name || model.name }, pkg) },
    { name: dir + 'assets/icon/icon.png', data: icon },
    { name: dir + 'test/widget_test.dart', data: `// flutter test: the app starts and shows its first page.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:${pkg}/main.dart' as entry;

void main() {
  testWidgets('the app starts', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.runAsync(entry.main);
    await tester.pumpAndSettle();
    expect(find.text(${ds(model.pages.find((p) => p.value === model.home)?.title || model.name)}), findsWidgets);
  });
}
` },
    { name: dir + '.gitignore', data: '.dart_tool/\n.flutter-plugins\n.flutter-plugins-dependencies\nbuild/\n*.iml\n.idea/\nandroid/.gradle/\nandroid/local.properties\nios/Pods/\nios/.symlinks/\nios/Flutter/Generated.xcconfig\n' },
  ] };
}

// =============================================================================================================
// SwiftUI
// =============================================================================================================

const swiftVal = (v) => (typeof v === 'number' ? `.n(${v})` : typeof v === 'boolean' ? `.b(${v})` : `.s(${ss(v ?? '')})`);

function swiftElement(x, ind) {
  const pad = ' '.repeat(ind);
  switch (x.kind) {
    case 'text': return `PText(${ss(x.value)}${x.size !== 16 ? `, size: ${x.size}` : ''}${x.weight !== '600' ? `, weight: ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color: ${ss(tokenColor(x.color))}` : ''})`;
    case 'button': return `PButton(${ss(x.label)}${x.outlined ? `, look: ${/danger/.test(x.color) ? '.danger' : '.outlined'}` : ''}) { app.run(${ss(x.action)}, ${swiftVal(x.value)}${x.amount !== 1 && x.amount != null ? `, ${+x.amount || 0}` : ''}) }`;
    case 'list': return `RecordList(collection: ${ss(x.collection)}, title: ${ss(x.title)}${x.subtitle ? `, subtitle: ${ss(x.subtitle)}` : ''}${x.icon ? `, icon: ${ss(x.icon)}` : ''}${x.check ? `, check: ${ss(x.check)}` : ''}${x.search ? `, search: ${ss(x.search)}` : ''}${x.filter ? `, filter: ${ss(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort: ${ss(x.sort)}` : ''}${x.openPage ? `, openPage: ${ss(x.openPage)}` : ''}, empty: ${ss(x.empty)})`;
    case 'form': return `RecordForm(collection: ${ss(x.collection)}${x.fields.length ? `, fields: [${x.fields.map(ss).join(', ')}]` : ''}, mode: .${{ new: 'newRecord', edit: 'editOpened', auto: 'auto' }[x.mode]}, saveLabel: ${ss(x.saveLabel)}${x.after !== 'go back' ? `, after: ${ss(x.after)}` : ''}${x.page ? `, page: ${ss(x.page)}` : ''})`;
    case 'input': return `VarField(${ss(x.var)}${x.placeholder ? `, placeholder: ${ss(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard: ${ss(x.keyboard)}` : ''})`;
    case 'toggle': return `VarSwitch(${ss(x.var)}${x.label ? `, label: ${ss(x.label)}` : ''})`;
    case 'items': return `StaticList([${x.items.map(ss).join(', ')}])`;
    case 'image': return `PImage(${ss(x.src)}, height: ${x.h})`;
    case 'row': return `PCard {\n${x.children.map((c) => pad + '    ' + swiftElement(c, ind + 4)).join('\n')}\n${pad}}`;
    default: return `TodoBox(${ss(x.name)}, ${ss(x.type)}) // TODO: build the ${x.type} natively`;
  }
}

function swiftPage(p, cls, model) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = p.items.map((x) => swiftElement(x, 12));
  const firstBtn = p.items.findIndex((x) => x.kind === 'button');
  if (!fills && firstBtn > 0) parts.splice(firstBtn, 0, 'Spacer()');
  const scroll = !fills && firstBtn <= 0;
  const fab = p.fab ? `, fab: (action: ${ss(p.fab.action)}, value: ${swiftVal(p.fab.value)})` : '';
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
import SwiftUI

struct ${cls}: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        PocketPage(title: ${ss(p.title)}${scroll ? '' : ', scroll: false'}${fab}) {
${parts.map((c) => '            ' + c).join('\n')}
        }
    }
}
`;
}

function swiftApp(model, N, appName) {
  const hex = (h) => '0x' + String(h).replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const pal = (P) => `Palette(c: [${Object.entries(P).map(([k, v]) => `${ss(k)}: Color(hex: ${hex(v)})`).join(', ')}])`;
  const light = { ...PALETTES.light, accent: model.accent }, dark = { ...PALETTES.dark };
  const field = (f) => `Field(key: ${ss(f.key)}, name: ${ss(f.name)}, type: ${ss(f.type)}${f.options.length ? `, options: [${f.options.map(ss).join(', ')}]` : ''}${f.def !== '' && f.def != null ? `, def: ${swiftVal(f.def)}` : ''})`;
  const row = (r) => `[${Object.entries(r).map(([k, v]) => `${ss(k)}: ${swiftVal(v)}`).join(', ') || ':'}]`;
  return `// ${model.name}: a native SwiftUI app, made by Pocket Engine's native export.
// Pocket.swift has the app's state and building blocks; Pages/ has one view per page.
import SwiftUI

@main
struct ${appName}: App {
    @StateObject private var app = AppState(
        name: ${ss(model.name)},
        home: ${ss(model.home)},
        themeSetting: ${ss(model.theme)},
        light: ${pal(light)},
        dark: ${pal(dark)},
        vars: [${Object.entries(model.vars).map(([k, v]) => `${ss(k)}: ${swiftVal(v)}`).join(', ') || ':'}],
        tabs: [${model.tabs.map((t) => `\n            NavTab(label: ${ss(t.label)}, icon: ${ss(iconFor(t.icon, 1))}, page: ${ss(t.page)}${t.badge ? `, badge: ${ss(t.badge)}` : ''}),`).join('')}${model.tabs.length ? '\n        ' : ''}],
        collections: [${model.collections.map((c) => `\n            Collection(name: ${ss(c.name)}, fields: [${c.fields.map(field).join(', ')}]${c.rows.length ? `, sample: [${c.rows.map(row).join(', ')}]` : ''}),`).join('')}${model.collections.length ? '\n        ' : ''}],
        stats: [${model.stats.map((s) => `\n            Stat(variable: ${ss(s.var)}, collection: ${ss(s.collection)}, how: ${ss(s.how)}${s.field && s.field !== 'field' ? `, field: ${ss(s.field)}` : ''}${s.filter ? `, filter: ${ss(s.filter)}` : ''}),`).join('')}${model.stats.length ? '\n        ' : ''}]
    )

    var body: some Scene {
        WindowGroup {
            PocketRoot(pages: [
${model.pages.map((p) => `                ${ss(p.value)}: { AnyView(${N[p.value]}()) },`).join('\n')}
            ])
            .environmentObject(app)
        }
    }
}
`;
}

/** The SwiftUI app's files for an Xcode project (they go in App/). runtime: the text of editor/native/swift/Pocket.swift. */
export function swiftNativeFiles(game, o, { runtime }) {
  const model = appModel(game), N = names(model), appName = camel(o.name || model.name, 'App') + 'App';
  return { model, appName, files: [
    { name: appName + '.swift', data: swiftApp(model, N, appName) },
    { name: 'Pocket.swift', data: runtime },
    ...model.pages.map((p) => ({ name: `Pages/${N[p.value]}.swift`, data: swiftPage(p, N[p.value], model) })),
  ] };
}

export { nativeReadme, names, ss, camel };
