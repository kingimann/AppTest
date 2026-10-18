// Flutter export: the game as a Flutter project (Dart). It runs in a full-screen WebView (webview_flutter), and the same
// bridge as the Expo / Xcode / Android exports gives it phone notifications, haptics, in-app purchases and the Back button,
// answered in Dart. One project builds for iOS and Android: `dart run tool/setup.dart`, then `flutter run`.
import { BRIDGE } from './expo.js';

/** Package versions that go together (resolved with Flutter 3.47 stable). */
export const FLUTTER_VERSIONS = {
  sdk: '^3.11.0', webview_flutter: '^4.13.0', webview_flutter_android: '^4.10.0', webview_flutter_wkwebview: '^3.23.0',
  flutter_local_notifications: '^22.3.2', timezone: '^0.11.2', flutter_timezone: '^5.1.1', in_app_purchase: '^3.2.3',
  flutter_lints: '^6.0.0', shared_preferences: '^2.5.6', flutter_launcher_icons: '^0.14.4', flutter_native_splash: '^2.4.6', desugar: '2.1.5',
};

/** "Jump Quest!" → "jump_quest" (a Dart package name). */
export const dartName = (s) => { let n = String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'game'; if (/^\d/.test(n)) n = 'app_' + n; return ['flutter', 'test', 'dart', 'async', 'core'].includes(n) ? n + '_app' : n; };
const semver = (v) => String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.');
const dstr = (s) => "'" + String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'";
const hex8 = (hex) => '0xFF' + String(hex || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();

/** The game page with the bridge first in <head>: the game's window.Capacitor calls go to Dart through the PocketBridge channel. */
function gameHtml(html) {
  const tag = `<script>window.__pkPlatform=/android/i.test(navigator.userAgent)?'android':'ios';window.ReactNativeWebView={postMessage:function(s){PocketBridge.postMessage(s)}};${BRIDGE.replace(/ true;$/, '')}</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
}

function pubspec(o, pkg) {
  const V = FLUTTER_VERSIONS, iap = o.products?.length;
  return `name: ${pkg}
description: ${JSON.stringify(o.description || o.name + ', made with Pocket Engine.')}
publish_to: 'none'
version: ${semver(o.version)}+${Math.max(1, +o.buildNumber || 1)}

environment:
  sdk: ${V.sdk}

dependencies:
  flutter:
    sdk: flutter
  webview_flutter: ${V.webview_flutter}
  webview_flutter_android: ${V.webview_flutter_android}
  webview_flutter_wkwebview: ${V.webview_flutter_wkwebview}
  flutter_local_notifications: ${V.flutter_local_notifications}
  timezone: ${V.timezone}
  flutter_timezone: ${V.flutter_timezone}
${iap ? `  in_app_purchase: ${V.in_app_purchase}\n` : ''}
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ${V.flutter_lints}
  flutter_launcher_icons: ${V.flutter_launcher_icons}
  flutter_native_splash: ${V.flutter_native_splash}

flutter:
  uses-material-design: true
  assets:
    - assets/game/

# App icon (dart run flutter_launcher_icons, done by tool/setup.dart)
flutter_launcher_icons:
  android: true
  ios: true
  image_path: assets/icon/icon.png
  remove_alpha_ios: true
  adaptive_icon_background: "${o.iconBg || '#3a8dff'}"
  adaptive_icon_foreground: assets/icon/icon-foreground.png

# Launch screen colour (dart run flutter_native_splash:create, done by tool/setup.dart)
flutter_native_splash:
  color: "${o.splashBg || '#000000'}"
  android_12:
    color: "${o.splashBg || '#000000'}"
`;
}

function mainDart(o) {
  const iap = o.products?.length;
  const orient = o.orientation === 'portrait' ? '[DeviceOrientation.portraitUp]' : o.orientation === 'landscape' ? '[DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]' : '[]';
  return `// ${o.name}: the game in a full-screen WebView, made with Pocket Engine.
// The game calls native features through window.Capacitor (a small bridge in assets/game/index.html);
// this file answers those calls in Dart: notifications, haptics${iap ? ', in-app purchases' : ''} and the Back button.
import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
${iap ? "import 'package:in_app_purchase/in_app_purchase.dart';\n" : ''}import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

const appName = ${dstr(o.name)};
const background = Color(${hex8(o.splashBg)});
const fullScreen = ${o.fullscreen ? 'true' : 'false'};
const orientations = <DeviceOrientation>${orient};

final notifications = FlutterLocalNotificationsPlugin();
String? launchedFrom; // the notification that opened the app (its key)

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (orientations.isNotEmpty) await SystemChrome.setPreferredOrientations(orientations);
  await SystemChrome.setEnabledSystemUIMode(fullScreen ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge);
  tzdata.initializeTimeZones();
  try { tz.setLocalLocation(tz.getLocation((await FlutterTimezone.getLocalTimezone()).identifier)); } catch (_) { /* stays UTC */ }
  await notifications.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(requestAlertPermission: false, requestBadgePermission: false, requestSoundPermission: false),
    ),
    onDidReceiveNotificationResponse: (r) => GamePage.notificationTapped(r.payload),
  );
  final launch = await notifications.getNotificationAppLaunchDetails();
  if (launch?.didNotificationLaunchApp ?? false) launchedFrom = launch!.notificationResponse?.payload;
  runApp(const GameApp());
}

class GameApp extends StatelessWidget {
  const GameApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: appName,
        debugShowCheckedModeBanner: false,
        theme: ThemeData(scaffoldBackgroundColor: background, colorScheme: ColorScheme.fromSeed(seedColor: background)),
        home: const GamePage(),
      );
}

class GamePage extends StatefulWidget {
  const GamePage({super.key});
  static _GamePageState? _live;
  /// Tapping a notification tells the game which one (the message "notification opened ID").
  static void notificationTapped(String? key) => _live?._event('localNotificationActionPerformed', {'notification': {'extra': {'key': key ?? ''}}});
  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> {
  late final WebViewController web;
  bool asked = false; // asked for notification permission (a "no" after that is "denied")

  @override
  void initState() {
    super.initState();
    GamePage._live = this;
    final params = WebViewPlatform.instance is WebKitWebViewPlatform
        ? WebKitWebViewControllerCreationParams(allowsInlineMediaPlayback: true, mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{})
        : const PlatformWebViewControllerCreationParams();
    web = WebViewController.fromPlatformCreationParams(params, onPermissionRequest: (r) => r.grant()) // camera / microphone the game asks for
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(background)
      ..addJavaScriptChannel('PocketBridge', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(onPageFinished: (_) {
        final key = launchedFrom;
        if (key != null) { launchedFrom = null; Future.delayed(const Duration(milliseconds: 1500), () => GamePage.notificationTapped(key)); }
      }))
      ..loadFlutterAsset('assets/game/index.html');
    if (web.platform is AndroidWebViewController) {
      AndroidWebViewController.enableDebugging(kDebugMode);
      (web.platform as AndroidWebViewController).setMediaPlaybackRequiresUserGesture(false);
    }
${iap ? '    Store.instance.onPurchase = (d) => _event(\'purchase\', d);\n' : ''}  }

  @override
  void dispose() { if (GamePage._live == this) GamePage._live = null; super.dispose(); }

  void _js(String code) => web.runJavaScript(code).catchError((_) {});
  void _event(String name, Object data) => _js('window.__pkEvent && window.__pkEvent(\${jsonEncode(name)}, \${jsonEncode(data)})');

  Future<void> _onMessage(String text) async {
    Map<String, dynamic> m;
    try { m = jsonDecode(text) as Map<String, dynamic>; } catch (_) { return; }
    if (m['exit'] == true) { SystemNavigator.pop(); return; }
    final id = m['id'];
    try {
      final v = await _handle('\${m['plugin']}', '\${m['method']}', (m['args'] as Map?)?.cast<String, dynamic>() ?? {});
      _js('window.__pkReply(\$id, true, \${jsonEncode(v)})');
    } catch (e) {
      _js('window.__pkReply(\$id, false, \${jsonEncode('\$e')})');
    }
  }

  /// The game's Capacitor-style calls.
  Future<Object?> _handle(String plugin, String method, Map<String, dynamic> a) async {
${iap ? "    if (plugin == 'Purchases') return Store.instance.handle(method, a);\n" : ''}    if (plugin == 'Haptics') {
      switch (method) {
        case 'impact': await ({'LIGHT': HapticFeedback.lightImpact, 'HEAVY': HapticFeedback.heavyImpact}[a['style']] ?? HapticFeedback.mediumImpact)(); return null;
        case 'notification': await ({'WARNING': HapticFeedback.heavyImpact, 'ERROR': HapticFeedback.vibrate}[a['type']] ?? HapticFeedback.mediumImpact)(); return null;
        case 'vibrate': await HapticFeedback.vibrate(); return null;
      }
    }
    if (plugin == 'LocalNotifications') return _notify(method, a);
    throw '\$plugin.\$method is not available';
  }

  AndroidFlutterLocalNotificationsPlugin? get _android => notifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  IOSFlutterLocalNotificationsPlugin? get _ios => notifications.resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();

  Future<Map<String, String>> _permission() async {
    final on = Platform.isAndroid ? (await _android?.areNotificationsEnabled() ?? false) : (await _ios?.checkPermissions())?.isEnabled ?? false;
    return {'display': on ? 'granted' : asked ? 'denied' : 'prompt'};
  }

  static int _idOf(Object? v) => v is int ? v : int.tryParse('\$v') ?? '\$v'.hashCode & 0x7fffffff;

  Future<Object?> _notify(String method, Map<String, dynamic> a) async {
    switch (method) {
      case 'checkPermissions': return _permission();
      case 'requestPermissions':
        asked = true;
        if (Platform.isAndroid) { await _android?.requestNotificationsPermission(); } else { await _ios?.requestPermissions(alert: true, badge: true, sound: true); }
        return _permission();
      case 'createChannel':
        await _android?.createNotificationChannel(AndroidNotificationChannel('\${a['id'] ?? 'game'}', '\${a['name'] ?? 'Game'}', description: a['description'] as String?, importance: Importance.high));
        return {};
      case 'schedule':
        for (final n in (a['notifications'] as List? ?? []).cast<Map>()) {
          final id = _idOf(n['id']), title = '\${n['title'] ?? ''}', body = '\${n['body'] ?? ''}', key = '\${(n['extra'] as Map?)?['key'] ?? ''}';
          final details = NotificationDetails(
            android: AndroidNotificationDetails('\${n['channelId'] ?? 'game'}', appName, importance: Importance.high, priority: Priority.high),
            iOS: const DarwinNotificationDetails(presentAlert: true, presentBanner: true, presentList: true, presentSound: true),
          );
          final s = (n['schedule'] as Map?) ?? {};
          const mode = AndroidScheduleMode.inexactAllowWhileIdle;
          if (s['at'] != null) {
            final at = s['at'] is num ? DateTime.fromMillisecondsSinceEpoch((s['at'] as num).toInt()) : DateTime.tryParse('\${s['at']}') ?? DateTime.now();
            if (at.isAfter(DateTime.now())) await notifications.zonedSchedule(id: id, title: title, body: body, scheduledDate: tz.TZDateTime.from(at, tz.local), notificationDetails: details, androidScheduleMode: mode, payload: key);
          } else if (s['on'] != null) {
            final on = s['on'] as Map, now = tz.TZDateTime.now(tz.local);
            var when = tz.TZDateTime(tz.local, now.year, now.month, now.day, (on['hour'] as num?)?.toInt() ?? 0, (on['minute'] as num?)?.toInt() ?? 0);
            if (!when.isAfter(now)) when = when.add(const Duration(days: 1));
            await notifications.zonedSchedule(id: id, title: title, body: body, scheduledDate: when, notificationDetails: details, androidScheduleMode: mode, matchDateTimeComponents: DateTimeComponents.time, payload: key);
          } else if (s['every'] != null) {
            final every = {'minute': RepeatInterval.everyMinute, 'hour': RepeatInterval.hourly, 'week': RepeatInterval.weekly}[s['every']] ?? RepeatInterval.daily;
            await notifications.periodicallyShow(id: id, title: title, body: body, repeatInterval: every, notificationDetails: details, androidScheduleMode: mode, payload: key);
          } else {
            await notifications.show(id: id, title: title, body: body, notificationDetails: details, payload: key);
          }
        }
        return {};
      case 'cancel':
        for (final n in (a['notifications'] as List? ?? []).cast<Map>()) { await notifications.cancel(id: _idOf(n['id'])); }
        return {};
      case 'getPending':
        return {'notifications': (await notifications.pendingNotificationRequests()).map((p) => {'id': p.id}).toList()};
    }
    throw 'LocalNotifications.\$method is not available';
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false, // Back goes back a page in the game first (the game closes the app when there's nowhere to go)
        onPopInvokedWithResult: (didPop, _) { if (!didPop) _js('window.__pkBack && window.__pkBack()'); },
        child: Scaffold(body: fullScreen ? WebViewWidget(controller: web) : SafeArea(child: WebViewWidget(controller: web))),
      );
}
${iap ? `
/// In-app purchases (StoreKit / Google Play Billing through in_app_purchase).
class Store {
  Store._();
  static final instance = Store._();
  final iap = InAppPurchase.instance;
  final kinds = <String, String>{}; // product ID → consumable | unlock | subscription
  void Function(Map<String, Object?>)? onPurchase;
  Completer<Map<String, Object?>>? _buying;
  String? _buyingId;
  Set<String>? _restored;
  StreamSubscription<List<PurchaseDetails>>? _sub;

  void _remember(Object? items) { for (final it in (items as List? ?? []).cast<Map>()) { kinds['\${it['id']}'] = '\${it['type'] ?? 'consumable'}'; } }
  void _finish(Map<String, Object?> r) { final b = _buying; _buying = null; _buyingId = null; if (b != null && !b.isCompleted) b.complete(r); }

  void _listen() {
    _sub ??= iap.purchaseStream.listen((list) async {
      for (final p in list) {
        final mine = p.productID == _buyingId;
        if (p.status == PurchaseStatus.pending) { if (mine) _finish({'status': 'pending'}); continue; }
        if (p.pendingCompletePurchase) await iap.completePurchase(p);
        if (p.status == PurchaseStatus.error || p.status == PurchaseStatus.canceled) { if (mine) _finish({'status': p.status == PurchaseStatus.canceled ? 'cancelled' : 'failed', 'error': p.error?.message}); continue; }
        if (p.status == PurchaseStatus.restored) { _restored?.add(p.productID); continue; }
        if (mine) { _finish({'status': 'bought', 'id': p.productID}); } else { onPurchase?.call({'id': p.productID, 'status': 'bought'}); } // (approved later: Ask to Buy, a pending payment)
      }
    });
  }

  Future<Object?> handle(String method, Map<String, dynamic> a) async {
    if (!await iap.isAvailable()) throw 'The store is not available on this device';
    _listen();
    switch (method) {
      case 'products':
        _remember(a['items']);
        final r = await iap.queryProductDetails(((a['items'] as List?) ?? []).map((i) => '\${(i as Map)['id']}').toSet());
        return {'products': r.productDetails.map((p) => {'id': p.id, 'title': p.title, 'description': p.description, 'price': p.price}).toList()};
      case 'buy':
        final id = '\${a['id']}'; kinds[id] = '\${a['type'] ?? 'consumable'}';
        final r = await iap.queryProductDetails({id});
        if (r.productDetails.isEmpty) return {'status': 'failed', 'error': 'No product \$id in the store yet (App Store Connect / Google Play Console)'};
        _finish({'status': 'cancelled'});
        final done = _buying = Completer<Map<String, Object?>>(); _buyingId = id;
        final param = PurchaseParam(productDetails: r.productDetails.first);
        try {
          final ok = kinds[id] == 'consumable' ? await iap.buyConsumable(purchaseParam: param) : await iap.buyNonConsumable(purchaseParam: param);
          if (!ok) _finish({'status': 'failed', 'error': 'The store did not start the purchase'});
        } catch (e) { _finish({'status': 'failed', 'error': '\$e'}); }
        return done.future;
      default: // owned / restore: the unlocks and subscriptions this account owns
        _remember(a['items']);
        final got = _restored = <String>{};
        await iap.restorePurchases();
        await Future.delayed(const Duration(seconds: 2));
        _restored = null;
        return {'ids': got.where((id) => kinds[id] != 'consumable').toList()};
    }
  }
}
` : ''}`;
}

/** tool/setup.dart: makes the iOS and Android folders (flutter create), then sets the app ID, name, permissions, icon and launch colour. */
function setupDart(o, pkg) {
  const perms = o.perms || [], why = (k) => perms.find((p) => p.kind === k)?.why || '';
  const parts = String(o.appId).split('.'), org = parts.slice(0, -1).join('.') || 'com.example';
  return `// Run once after unzipping:   dart run tool/setup.dart
// (and again any time; it only adds what's missing). Needs Flutter on your PATH.
import 'dart:io';

const appId = ${dstr(o.appId)};
const appName = ${dstr(o.name)};
const orientation = ${dstr(o.orientation || '')}; // portrait, landscape or '' (any)
const camera = ${dstr(why('camera'))}, microphone = ${dstr(why('microphone'))}, location = ${dstr(why('location'))};

Future<void> run(String cmd, List<String> args) async {
  stdout.writeln('> \$cmd \${args.join(' ')}');
  final p = await Process.start(cmd, args, mode: ProcessStartMode.inheritStdio, runInShell: true);
  if (await p.exitCode != 0) { stderr.writeln('"\$cmd \${args.join(' ')}" failed. Fix that, then run this again.'); exit(1); }
}

void edit(String path, String Function(String) change) {
  final f = File(path);
  if (!f.existsSync()) { stdout.writeln('  (no \$path: skipped)'); return; }
  final before = f.readAsStringSync(), after = change(before);
  if (after != before) { f.writeAsStringSync(after); stdout.writeln('  updated \$path'); }
}

String addBefore(String text, String anchor, String add) => text.contains(add.trim()) || !text.contains(anchor) ? text : text.replaceFirst(anchor, add + anchor);

Future<void> main() async {
  if (!Directory('android').existsSync() || !Directory('ios').existsSync()) {
    await run('flutter', ['create', '.', '--project-name', ${dstr(pkg)}, '--org', ${dstr(org)}, '--platforms', 'android,ios']);
  }
  await run('flutter', ['pub', 'get']);

  stdout.writeln('Android');
  for (final g in ['android/app/build.gradle.kts', 'android/app/build.gradle']) {
    final kts = g.endsWith('.kts');
    edit(g, (t) {
      t = t.replaceAll(RegExp(r'applicationId\\s*=?\\s*"[^"]*"'), kts ? 'applicationId = "\$appId"' : 'applicationId "\$appId"');
      t = t.replaceAll(RegExp(r'minSdk\\s*=?\\s*flutter\\.minSdkVersion'), kts ? 'minSdk = 24' : 'minSdk 24');
      // flutter_local_notifications needs Java 8+ APIs on older phones (core library desugaring)
      if (!t.contains('isCoreLibraryDesugaringEnabled') && !t.contains('coreLibraryDesugaringEnabled')) {
        t = t.replaceFirst(RegExp(r'compileOptions\\s*\\{'), kts ? 'compileOptions {\\n        isCoreLibraryDesugaringEnabled = true' : 'compileOptions {\\n        coreLibraryDesugaringEnabled true');
      }
      if (!t.contains('desugar_jdk_libs')) {
        t += kts ? '\\ndependencies {\\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:${FLUTTER_VERSIONS.desugar}")\\n}\\n' : '\\ndependencies {\\n    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${FLUTTER_VERSIONS.desugar}"\\n}\\n';
      }
      return t;
    });
  }
  edit('android/app/src/main/AndroidManifest.xml', (t) {
    final perms = ['INTERNET', 'POST_NOTIFICATIONS', 'VIBRATE', 'RECEIVE_BOOT_COMPLETED', if (camera.isNotEmpty) 'CAMERA', if (microphone.isNotEmpty) 'RECORD_AUDIO', if (microphone.isNotEmpty) 'MODIFY_AUDIO_SETTINGS', if (location.isNotEmpty) 'ACCESS_FINE_LOCATION', if (location.isNotEmpty) 'ACCESS_COARSE_LOCATION'];
    for (final p in perms) { t = addBefore(t, '<application', '    <uses-permission android:name="android.permission.\$p"/>\\n'); }
    t = t.replaceFirst(RegExp(r'android:label="[^"]*"'), 'android:label="\${appName.replaceAll('"', '&quot;')}"');
    if (orientation.isNotEmpty && !t.contains('android:screenOrientation')) t = t.replaceFirst('android:name=".MainActivity"', 'android:name=".MainActivity"\\n            android:screenOrientation="\${orientation == 'portrait' ? 'portrait' : 'sensorLandscape'}"');
    // scheduled notifications (and putting them back after the phone restarts)
    t = addBefore(t, '</application>', '''        <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationReceiver" />
        <receiver android:exported="false" android:name="com.dexterous.flutterlocalnotifications.ScheduledNotificationBootReceiver">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED"/>
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED"/>
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <action android:name="com.htc.intent.action.QUICKBOOT_POWERON"/>
            </intent-filter>
        </receiver>
''');
    return t;
  });

  stdout.writeln('iOS');
  edit('ios/Runner.xcodeproj/project.pbxproj', (t) => t.replaceAllMapped(RegExp(r'PRODUCT_BUNDLE_IDENTIFIER = ([^;]*?)(\\.RunnerTests)?;'), (m) => 'PRODUCT_BUNDLE_IDENTIFIER = \$appId\${m[2] ?? ''};'));
  edit('ios/Runner/Info.plist', (t) {
    String set(String text, String key, String xml) {
      final re = RegExp('<key>\$key</key>\\\\s*(<string>[^<]*</string>|<true/>|<false/>|<array>[\\\\s\\\\S]*?</array>)');
      return re.hasMatch(text) ? text.replaceFirst(re, '<key>\$key</key>\\n\\t\$xml') : text.replaceFirst(RegExp(r'</dict>\\s*</plist>\\s*\$'), '\\t<key>\$key</key>\\n\\t\$xml\\n</dict>\\n</plist>\\n');
    }
    String esc(String s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    t = set(t, 'CFBundleDisplayName', '<string>\${esc(appName)}</string>');
    final o = orientation == 'portrait' ? ['UIInterfaceOrientationPortrait'] : orientation == 'landscape' ? ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] : null;
    if (o != null) {
      final arr = '<array>\\n\${o.map((x) => '\\t\\t<string>\$x</string>').join('\\n')}\\n\\t</array>';
      t = set(t, 'UISupportedInterfaceOrientations', arr); t = set(t, 'UISupportedInterfaceOrientations~ipad', arr);
      t = set(t, 'UIRequiresFullScreen', '<true/>');
    }
    t = set(t, 'ITSAppUsesNonExemptEncryption', '<false/>');
    if (camera.isNotEmpty) t = set(t, 'NSCameraUsageDescription', '<string>\${esc(camera)}</string>');
    if (microphone.isNotEmpty) t = set(t, 'NSMicrophoneUsageDescription', '<string>\${esc(microphone)}</string>');
    if (location.isNotEmpty) t = set(t, 'NSLocationWhenInUseUsageDescription', '<string>\${esc(location)}</string>');
    return t;
  });
  // notifications show while the app is open
  edit('ios/Runner/AppDelegate.swift', (t) {
    if (t.contains('UNUserNotificationCenter')) return t;
    t = t.contains('import UserNotifications') ? t : t.replaceFirst('import UIKit', 'import UIKit\\nimport UserNotifications');
    return t.replaceFirstMapped(RegExp(r'(\\n\\s*)return super\\.application\\('), (m) => '\\n    UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate\${m[1]}return super.application(');
  });

  stdout.writeln('Icon and launch screen');
  await run('dart', ['run', 'flutter_launcher_icons']);
  await run('dart', ['run', 'flutter_native_splash:create']);
  stdout.writeln('\\nDone. Plug in a phone (or start a simulator) and run:  flutter run');
}
`;
}

function readme(o, pkg) {
  return `# ${o.name} (Flutter)

Your Pocket Engine ${o.app ? 'app' : 'game'} as a Flutter project. It runs in a full-screen WebView, and \`lib/main.dart\`
answers the game's native calls in Dart: phone notifications, haptics${o.products?.length ? ', in-app purchases' : ''} and the Back button.
One project builds for **iOS and Android**.

## First time

1. Install Flutter: https://docs.flutter.dev/get-started/install (run \`flutter doctor\` until Android Studio / Xcode are ticked).
2. In this folder, run:

   \`\`\`
   dart run tool/setup.dart
   \`\`\`

   It makes the \`android/\` and \`ios/\` folders (\`flutter create\`), then sets the app ID **${o.appId}**, the name,
   permissions, screen orientation, the icon and the launch colour. Running it again is safe.
3. Run it: \`flutter run\` (with a phone plugged in, or a simulator open).

## Publishing

- **Android:** \`flutter build appbundle\` → upload \`build/app/outputs/bundle/release/app-release.aab\` to Google Play.
  Set up signing first: https://docs.flutter.dev/deployment/android#sign-the-app
- **iOS (on a Mac):** \`flutter build ipa\`, or open \`ios/Runner.xcworkspace\` in Xcode, pick your team under
  *Signing & Capabilities*, then *Product › Archive*.${o.products?.length ? `
- **In-app purchases:** make the products in App Store Connect and Google Play Console with the same IDs
  (${o.products.map((p) => '`' + p.id + '`').join(', ')}). On iOS, add the *In-App Purchase* capability in Xcode.` : ''}

## Changing the ${o.app ? 'app' : 'game'}

Edit it in Pocket Engine, export again, and copy the new \`assets/game/index.html\` over this one
(or export a fresh project and run the setup again). Version and build number are in \`pubspec.yaml\`.

## What's inside

| File | What it is |
| --- | --- |
| \`lib/main.dart\` | The app: the WebView and the native features |
| \`assets/game/index.html\` | Your ${o.app ? 'app' : 'game'} (everything in one file) |
| \`assets/icon/\` | The app icon |
| \`tool/setup.dart\` | Makes and sets up the iOS and Android folders |
| \`pubspec.yaml\` | Name, version and packages |
`;
}

/** All the files of the Flutter project (under <name>-flutter/). icon / iconFg: PNG bytes (1024 px, and a padded one for Android's adaptive icon). */
export function flutterFiles(o, { html, icon, iconFg }) {
  const pkg = dartName(o.name), dir = pkg + '/';
  return [
    { name: dir + 'README.md', data: readme(o, pkg) },
    { name: dir + 'pubspec.yaml', data: pubspec(o, pkg) },
    { name: dir + 'lib/main.dart', data: mainDart(o) },
    { name: dir + 'tool/setup.dart', data: setupDart(o, pkg) },
    { name: dir + 'assets/game/index.html', data: gameHtml(html) },
    { name: dir + 'assets/icon/icon.png', data: icon },
    { name: dir + 'assets/icon/icon-foreground.png', data: iconFg || icon },
    { name: dir + 'analysis_options.yaml', data: 'include: package:flutter_lints/flutter.yaml\n' },
    { name: dir + 'test/widget_test.dart', data: `// flutter test: a quick check that the app's settings are in place (the WebView itself runs on a phone).\nimport 'package:flutter_test/flutter_test.dart';\nimport 'package:${pkg}/main.dart';\n\nvoid main() {\n  test('app is named', () => expect(appName, isNotEmpty));\n}\n` },
    { name: dir + '.gitignore', data: '.dart_tool/\n.flutter-plugins\n.flutter-plugins-dependencies\nbuild/\n*.iml\n.idea/\nandroid/.gradle/\nandroid/local.properties\nios/Pods/\nios/.symlinks/\nios/Flutter/Generated.xcconfig\n' },
  ];
}
