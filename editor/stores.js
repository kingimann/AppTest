// App stores: turns a build into a Capacitor project with a codemagic.yaml, so Codemagic (codemagic.io) can build
// and publish it to the App Store (TestFlight) and Google Play. Nothing native is shipped: the iOS and Android
// projects are generated on Codemagic's machines (npx cap add), then scripts/prepare-native.mjs patches in the
// version, build number, signing, orientation and full screen, and @capacitor/assets makes the icons and splash.

export const CAPACITOR_VERSION = '^8.5.0', ASSETS_VERSION = '^3.0.5';

/** A valid reverse-domain app ID from a name (letters, digits and underscores; no part starts with a digit). */
export function suggestAppId(author, title) {
  const part = (s, d) => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^[0-9]+/, '') || d);
  return `com.${part(author, 'pocket')}.${part(title, 'game')}`;
}
export const validAppId = (id) => /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(id || '');

// ---------- tiny ZIP writer (stored, no compression: fine for a few MB) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** files: [{ name, data: string | Uint8Array }] → Blob (application/zip). */
export function makeZip(files) {
  const enc = new TextEncoder(), parts = [], dir = [];
  let offset = 0;
  const d = new Date(), dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 0x031e, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(38, (f.exec ? 0o100755 : 0o100644) << 16, true); c.setUint32(42, offset, true);
    dir.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = dir.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...dir, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

// ---------- the project files ----------
const yamlStr = (s) => JSON.stringify(String(s ?? '')); // JSON strings are valid YAML

/** codemagic.yaml with an iOS and / or Android workflow. */
export function codemagicYaml(o) {
  const out = ['# Codemagic builds for this game. Open the project on codemagic.io and start a workflow.', '# Steps and the one-time setup are in README.md.', 'workflows:'];
  const common = (platform) => [
    '      - name: Install the tools',
    '        script: npm install --no-audit --no-fund',
    `      - name: Make the ${platform === 'ios' ? 'iOS' : 'Android'} project`,
    '        script: |',
    platform === 'ios' ? '          [ -d ios ] || npx cap add ios --packagemanager CocoaPods' : '          [ -d android ] || npx cap add android',
    `          APP_BUILD_NUMBER=$((BUILD_NUMBER + ${Math.max(0, Math.round(+o.buildOffset || 0))})) node scripts/prepare-native.mjs ${platform}`,
    `          npx capacitor-assets generate --${platform} --iconBackgroundColor ${yamlStr(o.iconBg)} --splashBackgroundColor ${yamlStr(o.splashBg)} --iconBackgroundColorDark ${yamlStr(o.iconBg)} --splashBackgroundColorDark ${yamlStr(o.splashBg)}`,
    `          npx cap sync ${platform}`,
  ];
  const email = o.notifyEmail ? ['      email:', '        recipients:', `          - ${yamlStr(o.notifyEmail)}`, '        notify:', '          success: true', '          failure: true'] : [];
  if (o.ios) {
    const pub = o.iosPublish || 'testflight';
    out.push(
      '  ios-release:',
      `    name: ${yamlStr(o.name + ' · iOS')}`,
      '    instance_type: mac_mini_m2',
      '    max_build_duration: 60',
      '    integrations:',
      `      app_store_connect: ${yamlStr(o.ascIntegration || 'codemagic')}`,
      '    environment:',
      '      ios_signing:',
      '        distribution_type: app_store',
      `        bundle_identifier: ${yamlStr(o.appId)}`,
      '      vars:',
      `        APP_VERSION: ${yamlStr(o.version)}`,
      '      node: latest',
      '      xcode: latest',
      '      cocoapods: default',
      '    scripts:',
      ...common('ios'),
      '      - name: Use the signing files',
      '        script: xcode-project use-profiles',
      '      - name: Build the app (.ipa)',
      '        script: xcode-project build-ipa --workspace ios/App/App.xcworkspace --scheme App',
      '    artifacts:',
      '      - build/ios/ipa/*.ipa',
      '      - /tmp/xcodebuild_logs/*.log',
      '    publishing:',
      ...email,
      ...(pub === 'none' ? [] : ['      app_store_connect:', '        auth: integration', `        submit_to_testflight: ${pub === 'testflight' || pub === 'review'}`, ...(pub === 'review' ? ['        submit_to_app_store: true'] : [])]),
    );
    if (pub === 'none' && !email.length) out.splice(out.lastIndexOf('    publishing:'), 1);
  }
  if (o.android) {
    const track = o.androidTrack || 'internal';
    out.push(
      '  android-release:',
      `    name: ${yamlStr(o.name + ' · Android')}`,
      '    instance_type: mac_mini_m2',
      '    max_build_duration: 60',
      '    environment:',
      '      android_signing:',
      `        - ${yamlStr(o.keystoreRef || 'keystore_reference')}`,
      ...(track !== 'none' ? ['      groups:', `        - ${yamlStr(o.playGroup || 'google_play')}`] : []),
      '      vars:',
      `        APP_VERSION: ${yamlStr(o.version)}`,
      '      node: latest',
      '      java: 21',
      '    scripts:',
      ...common('android'),
      '      - name: Point Gradle at the Android SDK',
      '        script: echo "sdk.dir=$ANDROID_SDK_ROOT" > android/local.properties',
      '      - name: Build the app bundle (.aab)',
      '        script: cd android && ./gradlew bundleRelease',
      '    artifacts:',
      '      - android/app/build/outputs/**/*.aab',
      ...(track !== 'none' || email.length ? ['    publishing:'] : []),
      ...email,
      ...(track !== 'none' ? ['      google_play:', '        credentials: $GCLOUD_SERVICE_ACCOUNT_CREDENTIALS', `        track: ${track}`, ...(o.playDraft ? ['        submit_as_draft: true'] : [])] : []),
    );
  }
  return out.join('\n') + '\n';
}

/** Patches the generated native projects (run on Codemagic after `npx cap add`). Plain Node, no packages. */
export function prepareScript(o) {
  const cfg = JSON.stringify({ version: o.version, orientation: o.orientation, fullscreen: o.fullscreen, iosDevices: o.iosDevices, background: o.splashBg }, null, 2);
  return `// Patches the generated iOS / Android projects for this game: version and build number, release signing,
// orientation and full screen. Run after \`npx cap add <platform>\`: node scripts/prepare-native.mjs ios|android
// Codemagic sets BUILD_NUMBER (the codemagic.yaml passes APP_BUILD_NUMBER) and the CM_KEYSTORE_* variables.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const APP = ${cfg};
const platform = process.argv[2];
const build = String(parseInt(process.env.APP_BUILD_NUMBER || process.env.BUILD_NUMBER || '1', 10) || 1);
const version = process.env.APP_VERSION || APP.version || '1.0';
const edit = (file, fn) => { if (!existsSync(file)) { console.error('Missing ' + file + ': run npx cap add ' + platform + ' first'); process.exit(1); } const before = readFileSync(file, 'utf8'), after = fn(before); if (after !== before) writeFileSync(file, after); console.log('patched ' + file); };

if (platform === 'android') {
  edit('android/app/build.gradle', (s) => {
    s = s.replace(/versionCode\\s+\\d+/, 'versionCode ' + build).replace(/versionName\\s+"[^"]*"/, 'versionName "' + version + '"');
    if (!s.includes('signingConfigs {')) {
      s = s.replace(/(\\n\\s*)buildTypes\\s*\\{/, \`$1signingConfigs {
        release {
            if (System.getenv("CM_KEYSTORE_PATH")) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }
    }$1buildTypes {\`);
      s = s.replace(/(release\\s*\\{\\s*\\n)(\\s*)(minifyEnabled)/, '$1$2if (System.getenv("CM_KEYSTORE_PATH")) { signingConfig signingConfigs.release }\\n$2$3');
    }
    return s;
  });
  const orient = { portrait: 'sensorPortrait', landscape: 'sensorLandscape' }[APP.orientation];
  edit('android/app/src/main/AndroidManifest.xml', (s) => {
    s = s.replace(/\\s+android:screenOrientation="[^"]*"/g, '');
    return orient ? s.replace(/<activity\\b/, '<activity\\n            android:screenOrientation="' + orient + '"') : s;
  });
  if (APP.fullscreen) edit('android/app/src/main/res/values/styles.xml', (s) => s.includes('android:windowFullscreen') ? s
    : s.replace(/(<style name="AppTheme.NoActionBar"[^>]*>)/, '$1\\n        <item name="android:windowFullscreen">true</item>\\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>'));
} else if (platform === 'ios') {
  edit('ios/App/App.xcodeproj/project.pbxproj', (s) => {
    s = s.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, 'CURRENT_PROJECT_VERSION = ' + build + ';').replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = ' + version + ';');
    if (APP.iosDevices === 'iphone') s = s.replace(/TARGETED_DEVICE_FAMILY = "[^"]*";/g, 'TARGETED_DEVICE_FAMILY = 1;');
    return s;
  });
  const list = { portrait: ['UIInterfaceOrientationPortrait'], landscape: ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] }[APP.orientation]
    || ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
  const arr = (a) => '<array>\\n' + a.map((x) => '\\t\\t<string>' + x + '</string>').join('\\n') + '\\n\\t</array>';
  const setKey = (s, key, xml) => { const re = new RegExp('<key>' + key.replace(/[~]/g, '\\\\$&') + '</key>\\\\s*(<array>[\\\\s\\\\S]*?</array>|<true/>|<false/>|<string>[^<]*</string>)'); return re.test(s) ? s.replace(re, '<key>' + key + '</key>\\n\\t' + xml) : s.replace(/<\\/dict>\\s*<\\/plist>\\s*$/, '\\t<key>' + key + '</key>\\n\\t' + xml + '\\n</dict>\\n</plist>\\n'); };
  edit('ios/App/App/Info.plist', (s) => {
    s = setKey(s, 'UISupportedInterfaceOrientations', arr(list));
    s = setKey(s, 'UISupportedInterfaceOrientations~ipad', arr(APP.orientation === 'portrait' ? ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown'] : list));
    s = setKey(s, 'UIRequiresFullScreen', '<true/>'); // a game: no iPad split screen (also required when not every orientation is allowed)
    s = setKey(s, 'ITSAppUsesNonExemptEncryption', '<false/>'); // no export-compliance question on every TestFlight upload
    if (APP.fullscreen) { s = setKey(s, 'UIStatusBarHidden', '<true/>'); s = setKey(s, 'UIViewControllerBasedStatusBarAppearance', '<false/>'); }
    return s;
  });
} else {
  console.error('Usage: node scripts/prepare-native.mjs ios|android'); process.exit(1);
}
`;
}

export function readme(o) {
  const both = o.ios && o.android, plat = both ? 'iOS and Android' : o.ios ? 'iOS' : 'Android';
  return `# ${o.name}: ${plat} app

Made with Pocket Engine. This folder turns the game into a native ${plat} app with [Capacitor](https://capacitorjs.com),
and **Codemagic** ([codemagic.io](https://codemagic.io)) builds it in the cloud and sends it to ${[o.ios && 'TestFlight / the App Store', o.android && 'Google Play'].filter(Boolean).join(' and ')}.
You don't need a Mac or Android Studio.

| | |
|---|---|
| App ID | \`${o.appId}\` |
| Version | ${o.version} (the build number goes up by itself on every Codemagic build) |
| Orientation | ${o.orientation || 'either way'} |

## 1. Put this folder on GitHub (or GitLab / Bitbucket)
Make a new **private** repository and upload everything in this folder (keep \`codemagic.yaml\` at the top).

## 2. Connect it to Codemagic
Sign in at codemagic.io, choose **Add application**, pick the repository and choose **codemagic.yaml** as the configuration.
${o.ios ? `
## 3. iOS: one-time setup
1. You need a paid **Apple Developer** account.
2. In **App Store Connect**, create the app with the bundle ID \`${o.appId}\` (My Apps → + → New App).
3. In App Store Connect → Users and Access → Integrations, create an **API key** (App Manager access).
4. In Codemagic → Team settings → **Integrations → Developer Portal**, add that key and name it **\`${o.ascIntegration || 'codemagic'}\`**.
5. In Codemagic → Team settings → **codemagic.yaml settings → Code signing identities**:
   - create or fetch an **Apple Distribution certificate**;
   - fetch an **App Store provisioning profile** for \`${o.appId}\`.
6. Start the **${o.name} · iOS** workflow. ${o.iosPublish === 'none' ? 'The .ipa appears under the build\'s artifacts.' : o.iosPublish === 'review' ? 'It uploads to TestFlight and submits the build for App Store review.' : 'It uploads to TestFlight: install the TestFlight app on your iPhone to play it.'}
` : ''}${o.android ? `
## ${o.ios ? '4' : '3'}. Android: one-time setup
1. Make an **upload keystore** (Codemagic → Team settings → codemagic.yaml settings → Code signing identities → Android keystores → *Generate*), and name its reference **\`${o.keystoreRef || 'keystore_reference'}\`**.
   **Keep a copy of the keystore**: every update has to be signed with it.
${o.androidTrack === 'none' ? '' : `2. You need a **Google Play Console** developer account. Create the app there with the package name \`${o.appId}\`.
3. **The first upload must be done by hand.** Run the workflow once, download the .aab from the artifacts, and upload it in Play Console (Testing → Internal testing). After that, Codemagic publishes every build.
4. Make a Google Cloud **service account** with access to Play Console (Play Console → Users and permissions → invite its email as *Release manager*), and download its **JSON key**.
5. In Codemagic → your app → **Environment variables**, add \`GCLOUD_SERVICE_ACCOUNT_CREDENTIALS\` with the whole JSON key, mark it *Secret*, in the group **\`${o.playGroup || 'google_play'}\`**.
`}${o.androidTrack === 'none' ? '2' : '6'}. Start the **${o.name} · Android** workflow. ${o.androidTrack === 'none' ? 'The .aab appears under the build\'s artifacts.' : `It publishes to the **${o.androidTrack}** track${o.playDraft ? ' as a draft (needed until the app has been reviewed: turn "First release" off in Build Settings afterwards)' : ''}.`}
` : ''}
## Updating the game
Make your changes in Pocket Engine, open **Build Settings → App stores → Download app project** again, and replace \`www/index.html\` (or the whole folder) in the repository. Raise the **Version** in Build Settings for a store update. Then run the workflow again.

## What's inside
- \`www/index.html\`: the whole game (the same file as Build HTML, without the "Add to Home Screen" bits).
- \`capacitor.config.json\`: the app name, ID and background colour.
- \`assets/\`: the icon and splash screen. Codemagic makes every size from these (\`@capacitor/assets\`).
- \`scripts/prepare-native.mjs\`: sets the version, build number, signing, orientation${o.fullscreen ? ' and full screen' : ''} in the generated native projects.
- \`codemagic.yaml\`: the build${both ? 's' : ''}.

The \`ios\` and \`android\` folders are made fresh on every build, so you don't have to keep them.
To customise the native projects yourself, run \`npx cap add ios\` / \`npx cap add android\` on your computer, commit the folders, and delete them from \`.gitignore\`. The workflows then use your versions.
`;
}

/** Everything in the zip. html: the game; icon / splash: PNG bytes. */
export function storeFiles(o, { html, icon, fg, splash }) {
  const slugName = String(o.name || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game';
  const pkg = {
    name: slugName, version: /^\d+\.\d+\.\d+$/.test(o.version) ? o.version : (String(o.version || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.')),
    private: true, description: `${o.name} (made with Pocket Engine)`,
    scripts: { 'add:ios': 'cap add ios --packagemanager CocoaPods && node scripts/prepare-native.mjs ios', 'add:android': 'cap add android && node scripts/prepare-native.mjs android', assets: 'capacitor-assets generate', sync: 'cap sync' },
    dependencies: { '@capacitor/core': CAPACITOR_VERSION, ...(o.android ? { '@capacitor/android': CAPACITOR_VERSION } : {}), ...(o.ios ? { '@capacitor/ios': CAPACITOR_VERSION } : {}) },
    devDependencies: { '@capacitor/cli': CAPACITOR_VERSION, '@capacitor/assets': ASSETS_VERSION },
  };
  const cap = { appId: o.appId, appName: o.name, webDir: 'www', backgroundColor: o.splashBg, ios: { contentInset: 'never', scrollEnabled: false }, android: { backgroundColor: o.splashBg } };
  return [
    { name: 'README.md', data: readme(o) },
    { name: 'codemagic.yaml', data: codemagicYaml(o) },
    { name: 'package.json', data: JSON.stringify(pkg, null, 2) + '\n' },
    { name: 'capacitor.config.json', data: JSON.stringify(cap, null, 2) + '\n' },
    { name: '.gitignore', data: 'node_modules/\n# made fresh on every Codemagic build (remove these lines to keep your own native projects)\nios/\nandroid/\n' },
    { name: 'scripts/prepare-native.mjs', data: prepareScript(o), exec: true },
    { name: 'www/index.html', data: html },
    { name: 'assets/icon-only.png', data: icon },
    { name: 'assets/icon-foreground.png', data: fg || icon },
    { name: 'assets/icon-background.png', data: splash.bg },
    { name: 'assets/splash.png', data: splash.png },
    { name: 'assets/splash-dark.png', data: splash.png },
  ];
}
