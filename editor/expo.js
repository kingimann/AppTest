// Expo export: the game as an Expo (React Native) app. It runs in a full-screen WebView, and a small bridge gives the
// game the same native features as the Capacitor export (phone notifications, haptics, Back button), using Expo's
// modules. Build and publish with EAS (expo.dev) — or open it in Expo Go to try it on a phone first.

/** Versions that go together (Expo SDK 57's bundledNativeModules.json). */
export const EXPO_VERSIONS = {
  expo: '~57.0.28', react: '19.2.3', 'react-native': '0.86.3', 'react-native-webview': '13.16.1',
  'expo-haptics': '~57.0.3', 'expo-notifications': '~57.0.22', 'expo-status-bar': '~57.0.1', 'expo-splash-screen': '~57.0.10',
  'expo-screen-orientation': '~57.0.3', 'expo-navigation-bar': '~57.0.3', 'expo-system-ui': '~57.0.4',
};

const slugOf = (s) => String(s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
const semver = (v) => (/^\d+\.\d+\.\d+$/.test(v) ? v : String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.'));

/** app.json: name, IDs, icon, splash, orientation, permissions and the notifications plugin. */
export function appJson(o) {
  const perms = o.perms || [], has = (k) => perms.some((p) => p.kind === k), why = (k) => perms.find((p) => p.kind === k)?.why;
  const infoPlist = { ITSAppUsesNonExemptEncryption: false, UIRequiresFullScreen: true,
    ...(has('camera') ? { NSCameraUsageDescription: why('camera') } : {}), ...(has('microphone') ? { NSMicrophoneUsageDescription: why('microphone') } : {}),
    ...(has('location') ? { NSLocationWhenInUseUsageDescription: why('location') } : {}), ...(o.fullscreen ? { UIStatusBarHidden: true, UIViewControllerBasedStatusBarAppearance: false } : {}) };
  const androidPerms = ['VIBRATE', 'POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'SCHEDULE_EXACT_ALARM',
    ...(has('camera') ? ['CAMERA'] : []), ...(has('microphone') ? ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'] : []), ...(has('location') ? ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'] : [])];
  return {
    expo: {
      name: o.name, slug: slugOf(o.name), version: semver(o.version), orientation: o.orientation === 'landscape' ? 'landscape' : o.orientation === 'portrait' ? 'portrait' : 'default',
      icon: './assets/icon.png', userInterfaceStyle: 'dark', backgroundColor: o.splashBg,
      splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: o.splashBg },
      ios: { bundleIdentifier: o.appId, supportsTablet: o.iosDevices !== 'iphone', requireFullScreen: true, infoPlist },
      android: { package: o.appId, adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: o.iconBg }, permissions: androidPerms },
      plugins: [['expo-notifications', { icon: './assets/notification-icon.png', color: o.notifyColor || '#4fa3ff' }], ['expo-splash-screen', { image: './assets/splash.png', backgroundColor: o.splashBg, imageWidth: 200 }], 'expo-screen-orientation'],
      extra: { madeWith: 'Pocket Engine' },
    },
  };
}

/** eas.json: build profiles (a test build you can install, and store builds) and store uploads. */
export function easJson(o) {
  return {
    cli: { version: '>= 16.0.0', appVersionSource: 'remote' },
    build: {
      preview: { distribution: 'internal', android: { buildType: 'apk' }, ios: { simulator: false } },
      production: { autoIncrement: true },
    },
    submit: { production: { ios: {}, android: { track: o.androidTrack && o.androidTrack !== 'none' ? o.androidTrack : 'internal', ...(o.playDraft ? { releaseStatus: 'draft' } : {}) } } },
  };
}

/** The bridge inside the game: window.Capacitor, so the engine's native code paths (notifications, haptics) work unchanged. */
const BRIDGE = String.raw`(function () {
  if (window.Capacitor) return;
  var seq = 0, waiting = {}, listeners = {};
  function call(plugin, method, args) {
    return new Promise(function (resolve, reject) {
      var id = ++seq; waiting[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, plugin: plugin, method: method, args: args || {} }));
    });
  }
  window.__pkReply = function (id, ok, value) { var w = waiting[id]; if (!w) return; delete waiting[id]; ok ? w.resolve(value) : w.reject(new Error(value || 'failed')); };
  window.__pkEvent = function (name, data) { (listeners[name] || []).forEach(function (f) { try { f(data); } catch (e) {} }); };
  var plugin = function (name, methods) { var o = { addListener: function (ev, f) { (listeners[ev] = listeners[ev] || []).push(f); return Promise.resolve({ remove: function () {} }); } }; methods.forEach(function (m) { o[m] = function (a) { return call(name, m, a); }; }); return o; };
  window.Capacitor = { isNativePlatform: function () { return true; }, getPlatform: function () { return window.__pkPlatform || 'ios'; }, isPluginAvailable: function (n) { return n === 'LocalNotifications' || n === 'Haptics'; },
    Plugins: { LocalNotifications: plugin('LocalNotifications', ['checkPermissions', 'requestPermissions', 'schedule', 'cancel', 'getPending', 'createChannel']), Haptics: plugin('Haptics', ['impact', 'notification', 'vibrate']) } };
  // Android Back: the game goes back a page (or closes a popup); if there's nowhere to go, the app closes
  window.__pkBack = function () { var s = window.engine && window.engine.scene; var went = !!(s && s.canGoBack && s.canGoBack() && s.navBack()); if (!went) window.ReactNativeWebView.postMessage(JSON.stringify({ exit: true })); };
})(); true;`;

/** App.js: the WebView, and Expo's notifications and haptics answering the game's calls. */
export function appJs(o) {
  return `// ${o.name}: the game in a full-screen WebView, made with Pocket Engine.
// The game calls native features through window.Capacitor (the bridge below); this file answers with Expo's modules.
import { useEffect, useRef } from 'react';
import { BackHandler, Platform, StyleSheet, Vibration, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import GAME_HTML from './game/game-html';

SplashScreen.preventAutoHideAsync().catch(() => {});
// notifications show even while the game is open
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });

const BRIDGE = ${JSON.stringify(BRIDGE)};
const T = Notifications.SchedulableTriggerInputTypes;
const EVERY = { minute: 60, hour: 3600, day: 86400, week: 604800 };

async function permissionState() {
  const p = await Notifications.getPermissionsAsync();
  return { display: p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'prompt' };
}
/** The game's Capacitor-style calls, answered by Expo. */
async function handle(plugin, method, a) {
  if (plugin === 'Haptics') {
    if (method === 'impact') return Haptics.impactAsync({ LIGHT: Haptics.ImpactFeedbackStyle.Light, MEDIUM: Haptics.ImpactFeedbackStyle.Medium, HEAVY: Haptics.ImpactFeedbackStyle.Heavy }[a.style] || Haptics.ImpactFeedbackStyle.Medium);
    if (method === 'notification') return Haptics.notificationAsync({ SUCCESS: Haptics.NotificationFeedbackType.Success, WARNING: Haptics.NotificationFeedbackType.Warning, ERROR: Haptics.NotificationFeedbackType.Error }[a.type] || Haptics.NotificationFeedbackType.Success);
    if (method === 'vibrate') return Vibration.vibrate(Math.max(1, Math.round(a.duration || 300)));
  }
  if (plugin === 'LocalNotifications') {
    switch (method) {
      case 'checkPermissions': return permissionState();
      case 'requestPermissions': await Notifications.requestPermissionsAsync(); return permissionState();
      case 'createChannel': if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(a.id || 'game', { name: a.name || 'Game', description: a.description, importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200] }); return {};
      case 'schedule': {
        for (const n of a.notifications || []) {
          const s = n.schedule;
          const trigger = !s ? null
            : s.at ? { type: T.DATE, date: new Date(s.at), channelId: n.channelId }
            : s.on ? { type: T.DAILY, hour: s.on.hour || 0, minute: s.on.minute || 0, channelId: n.channelId }
            : s.every ? { type: T.TIME_INTERVAL, seconds: EVERY[s.every] || 86400, repeats: true, channelId: n.channelId } : null;
          await Notifications.scheduleNotificationAsync({ identifier: String(n.id), content: { title: n.title, body: n.body, data: n.extra || {} }, trigger });
        }
        return {};
      }
      case 'cancel': for (const n of a.notifications || []) await Notifications.cancelScheduledNotificationAsync(String(n.id)); return {};
      case 'getPending': return { notifications: (await Notifications.getAllScheduledNotificationsAsync()).map((n) => ({ id: +n.identifier || n.identifier })) };
    }
  }
  throw new Error(plugin + '.' + method + ' is not available');
}

export default function App() {
  const web = useRef(null);
  const send = (js) => web.current?.injectJavaScript(js + '; true;');
  useEffect(() => {
    // tapping a notification opens the game and tells it which one (the message "notification opened ID")
    const tapped = (r) => { const key = r?.notification?.request?.content?.data?.key || ''; send('window.__pkEvent && window.__pkEvent("localNotificationActionPerformed", ' + JSON.stringify({ notification: { extra: { key } } }) + ')'); };
    const sub = Notifications.addNotificationResponseReceivedListener(tapped);
    Notifications.getLastNotificationResponseAsync().then((r) => r && setTimeout(() => tapped(r), 1500)).catch(() => {});
    // Android Back goes back in the game first
    const back = BackHandler.addEventListener('hardwareBackPress', () => { send('window.__pkBack && window.__pkBack()'); return true; });
    return () => { sub.remove(); back.remove(); };
  }, []);
  const onMessage = async (ev) => {
    let m; try { m = JSON.parse(ev.nativeEvent.data); } catch { return; }
    if (m.exit) { BackHandler.exitApp(); return; }
    try { const v = await handle(m.plugin, m.method, m.args || {}); send('window.__pkReply(' + m.id + ', true, ' + JSON.stringify(v ?? null) + ')'); }
    catch (err) { send('window.__pkReply(' + m.id + ', false, ' + JSON.stringify(String(err?.message || err)) + ')'); }
  };
  return (
    <View style={styles.root}>
      <StatusBar hidden={${!!o.fullscreen}} style="light" />
      <WebView
        ref={web}
        style={styles.root}
        originWhitelist={['*']}
        source={{ html: GAME_HTML, baseUrl: 'https://${slugOf(o.name)}.game/' }}
        injectedJavaScriptBeforeContentLoaded={'window.__pkPlatform = ' + JSON.stringify(Platform.OS) + ';' + BRIDGE}
        onMessage={onMessage}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="prompt"
        geolocationEnabled
        allowFileAccess
        bounces={false}
        overScrollMode="never"
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        textZoom={100}
        allowsBackForwardNavigationGestures={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        hideKeyboardAccessoryView
        webviewDebuggingEnabled={__DEV__}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: ${JSON.stringify(o.splashBg || '#000000')} } });
`;
}

export function expoReadme(o) {
  return `# ${o.name}: Expo app

Made with Pocket Engine. This folder is an [Expo](https://expo.dev) app: the game runs in a full-screen WebView, and a
small bridge in \`App.js\` gives it phone notifications, haptics and the Android Back button through Expo's modules.

| | |
|---|---|
| iOS bundle ID / Android package | \`${o.appId}\` |
| Version | ${o.version} |
| Expo SDK | 57 |

## Try it on your phone (Expo Go)
1. Install [Node.js](https://nodejs.org) (LTS), then in this folder run \`npm install\`.
2. Run \`npx expo start\` and scan the QR code with the **Expo Go** app (iPhone: the Camera app).
   Expo Go can't schedule notifications from your own app; everything else works. Use a build (below) for the full app.

## Build it (EAS, in the cloud: no Mac needed for iOS)
1. Make a free account at [expo.dev](https://expo.dev), then \`npm install -g eas-cli\` and \`eas login\`.
2. \`eas init\` links the project to your account.
3. A test build you can install: \`eas build --profile preview --platform android\` (an .apk) or \`--platform ios\` (needs an Apple Developer account; EAS sets up certificates for you).
4. Store builds: \`eas build --profile production --platform all\`. Build numbers go up by themselves.

## Publish
- \`eas submit --platform ios\` uploads the latest build to App Store Connect (TestFlight).
- \`eas submit --platform android\` uploads to Google Play (the first upload must be done by hand in the Play Console; then it uses a Google service account, see expo.dev/accounts → credentials).

## Updating the game
Make your changes in Pocket Engine and download the Expo project again; replace \`game/game-html.js\` (or the whole folder).
Raise **Version** in Build Settings for a store update.

## What's inside
- \`App.js\`: the WebView and the bridge (notifications → expo-notifications, haptics → expo-haptics, Back → BackHandler).
- \`game/game-html.js\`: the whole game (the same as Build HTML).
- \`app.json\`: name, IDs, icon, splash, orientation${(o.perms || []).length ? ', the permissions the game asks for (' + o.perms.map((p) => p.kind).join(', ') + ')' : ''} and plugins.
- \`eas.json\`: build and submit profiles. \`assets/\`: icon, adaptive icon, splash and notification icon.
`;
}

/** Everything in the zip. html: the game; icon / fg / splash / bg / notif: PNG bytes. */
export function expoFiles(o, { html, icon, fg, splash, notif }) {
  const pkg = {
    name: slugOf(o.name), version: semver(o.version), private: true, main: 'index.js',
    scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios', 'build:preview': 'eas build --profile preview --platform all', 'build:store': 'eas build --profile production --platform all', submit: 'eas submit --platform all' },
    dependencies: { ...EXPO_VERSIONS },
  };
  return [
    { name: 'README.md', data: expoReadme(o) },
    { name: 'package.json', data: JSON.stringify(pkg, null, 2) + '\n' },
    { name: 'app.json', data: JSON.stringify(appJson(o), null, 2) + '\n' },
    { name: 'eas.json', data: JSON.stringify(easJson(o), null, 2) + '\n' },
    { name: 'index.js', data: "import { registerRootComponent } from 'expo';\nimport App from './App';\n\nregisterRootComponent(App);\n" },
    { name: 'App.js', data: appJs(o) },
    { name: 'game/game-html.js', data: '// The whole game (Pocket Engine build). Replace this file to update the game.\nexport default ' + JSON.stringify(html) + ';\n' },
    { name: '.gitignore', data: 'node_modules/\n.expo/\ndist/\nios/\nandroid/\n*.jks\n*.p8\n*.p12\n*.key\n*.mobileprovision\n' },
    { name: 'assets/icon.png', data: icon },
    { name: 'assets/adaptive-icon.png', data: fg || icon },
    { name: 'assets/splash.png', data: splash },
    { name: 'assets/notification-icon.png', data: notif || icon },
  ];
}
