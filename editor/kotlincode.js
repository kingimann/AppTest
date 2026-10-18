// Native Kotlin export: an app project written out as a Kotlin Multiplatform app with Compose Multiplatform, so one Kotlin
// codebase (the UI too) runs on Android and iOS. Same model as the Flutter / SwiftUI exports (appmodel.js): pages, the
// App Bar, the Bottom Nav, text, buttons, Data Lists, Forms, inputs, switches and data become Compose code over a fixed
// runtime (editor/native/kotlin/Pocket.kt); anything else is a TODO placeholder.
import { appModel, PALETTES } from './appmodel.js';
import { nativeReadme, names } from './nativecode.js';
import { pbxproj, plist } from './native.js';

/** Versions that go together (built and checked with these). */
export const KOTLIN_VERSIONS = { kotlin: '2.4.21', compose: '1.11.1', agp: '8.13.2', gradle: '8.14.6', serialization: '1.11.0', icons: '1.7.3', activity: '1.13.0', compileSdk: 36, minSdk: 24 };

const KW = new Set(['as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface', 'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val', 'var', 'when', 'while']);
/** com.pocket.my-app → com.pocket.my_app (a Kotlin package). */
export const kotlinPackage = (appId) => String(appId || 'com.example.app').toLowerCase().split('.').map((p) => { let s = p.replace(/[^a-z0-9_]/g, '_'); if (!/^[a-z_]/.test(s)) s = 'p' + s; return KW.has(s) ? s + '_' : s; }).join('.');
const semver = (v) => String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.');
/** A Kotlin string literal. */
const ks = (s) => '"' + String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n') + '"';
const kv = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v + '.0' : String(v)) : typeof v === 'boolean' ? String(v) : v == null ? 'null' : ks(v));
const tokenColor = (c) => (c && (/^@\w+$/.test(c) || /^#[0-9a-f]{6}$/i.test(c)) ? c : '');
const ICON_K = { home: 'Home', search: 'Search', explore: 'Search', user: 'Person', profile: 'Person', users: 'Face', chat: 'Email', bell: 'Notifications', heart: 'Favorite', star: 'Star', settings: 'Settings', gear: 'Settings', plus: 'Add', add: 'Add',
  list: 'Menu', check: 'Check', calendar: 'DateRange', clock: 'DateRange', video: 'PlayArrow', play: 'PlayArrow', shop: 'ShoppingCart', cart: 'ShoppingCart', trophy: 'Star', map: 'Place', camera: 'Face', image: 'Face', edit: 'Edit',
  trash: 'Delete', info: 'Info', menu: 'Menu', bookmark: 'Star', wallet: 'ShoppingCart', money: 'ShoppingCart', chart: 'Info', note: 'Edit', book: 'Info', music: 'PlayArrow', globe: 'Place', gamepad: 'PlayArrow', circle: 'CheckCircle' };
const iconK = (n) => 'Icons.Filled.' + (ICON_K[String(n || '').toLowerCase()] || 'CheckCircle');

function kElement(x, ind, fill) {
  const pad = ' '.repeat(ind), mod = fill ? ', modifier = Modifier.weight(1f)' : '';
  switch (x.kind) {
    case 'text': return `PText(${ks(x.value)}${x.size !== 16 ? `, size = ${Math.round(x.size)}` : ''}${x.weight !== '600' ? `, weight = ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color = ${ks(tokenColor(x.color))}` : ''})`;
    case 'button': return `PButton(${ks(x.label)}${x.outlined ? `, look = ${/danger/.test(x.color) ? 'Look.Danger' : 'Look.Outlined'}` : ''}) { app.run(${ks(x.action)}, ${kv(x.value)}${x.amount !== 1 && x.amount != null ? `, ${kv(+x.amount || 0)}` : ''}) }`;
    case 'list': return `RecordList(${ks(x.collection)}${mod}, title = ${ks(x.title)}${x.subtitle ? `, subtitle = ${ks(x.subtitle)}` : ''}${x.icon ? `, icon = ${ks(x.icon)}` : ''}${x.check ? `, check = ${ks(x.check)}` : ''}${x.search ? `, search = ${ks(x.search)}` : ''}${x.filter ? `, filter = ${ks(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort = ${ks(x.sort)}` : ''}${x.openPage ? `, openPage = ${ks(x.openPage)}` : ''}, empty = ${ks(x.empty)})`;
    case 'form': return `RecordForm(${ks(x.collection)}${mod}${x.fields.length ? `, fields = listOf(${x.fields.map(ks).join(', ')})` : ''}, mode = FormMode.${{ new: 'NewRecord', edit: 'EditOpened', auto: 'Auto' }[x.mode]}, saveLabel = ${ks(x.saveLabel)}${x.after !== 'go back' ? `, after = ${ks(x.after)}` : ''}${x.page ? `, page = ${ks(x.page)}` : ''})`;
    case 'input': return `VarField(${ks(x.var)}${x.placeholder ? `, placeholder = ${ks(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard = ${ks(x.keyboard)}` : ''})`;
    case 'toggle': return `VarSwitch(${ks(x.var)}${x.label ? `, label = ${ks(x.label)}` : ''})`;
    case 'items': return `StaticList(listOf(${x.items.map(ks).join(', ')}))`;
    case 'image': return `TodoBox("Picture", "image") // TODO: show ${x.src.slice(0, 60)} (add an image library such as Coil 3)`;
    case 'row': return `PCard {\n${x.children.map((c) => pad + '    ' + kElement(c, ind + 4, false)).join('\n')}\n${pad}}`;
    default: return `TodoBox(${ks(x.name)}, ${ks(x.type)}) // TODO: build the ${x.type} natively`;
  }
}

function kPage(p, fn, pkg) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = p.items.map((x) => kElement(x, 8, fills && x.fill && (x.kind === 'list' || x.kind === 'form')));
  const firstBtn = p.items.findIndex((x) => x.kind === 'button');
  if (!fills && firstBtn > 0) parts.splice(firstBtn, 0, 'Spacer(Modifier.weight(1f))');
  const scroll = !fills && firstBtn <= 0;
  const fab = p.fab ? `, fab = { app.run(${ks(p.fab.action)}, ${kv(p.fab.value)}) }` : '';
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
package ${pkg}.pages

import androidx.compose.foundation.layout.Spacer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ${pkg}.*

@Composable
fun ${fn}() {
    PocketPage(${ks(p.title)}${scroll ? '' : ', scroll = false'}${fab}) {
${parts.map((c) => '        ' + c).join('\n')}
    }
}
`;
}

function kApp(model, N, pkg) {
  const argb = (h) => '0xFF' + String(h).replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const pal = (P) => `Palette(mapOf(${Object.entries(P).map(([k, v]) => `${ks(k)} to Color(${argb(v)})`).join(', ')}))`;
  const light = { ...PALETTES.light, accent: model.accent }, dark = { ...PALETTES.dark };
  const field = (f) => `Field(${ks(f.key)}, ${ks(f.name)}, ${ks(f.type)}${f.options.length ? `, options = listOf(${f.options.map(ks).join(', ')})` : ''}${f.def !== '' && f.def != null ? `, def = ${kv(f.def)}` : ''})`;
  const row = (r) => `mapOf(${Object.entries(r).map(([k, v]) => `${ks(k)} to ${kv(v)}`).join(', ')})`;
  return `// ${model.name}: a native Kotlin Multiplatform app (Compose for Android and iOS), made by Pocket Engine's native export.
// Pocket.kt has the app's state and building blocks; pages/ has one composable per page.
package ${pkg}

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import ${pkg}.pages.*

fun setupApp() {
    if (appReady()) return
    app = AppState(
        name = ${ks(model.name)},
        home = ${ks(model.home)},
        themeSetting = ${ks(model.theme)},
        light = ${pal(light)},
        dark = ${pal(dark)},
        vars = mapOf(${Object.entries(model.vars).map(([k, v]) => `${ks(k)} to ${kv(v)}`).join(', ')}),
        tabs = listOf(${model.tabs.map((t) => `\n            NavTab(${ks(t.label)}, ${iconK(t.icon)}, ${ks(t.page)}${t.badge ? `, badge = ${ks(t.badge)}` : ''}),`).join('')}${model.tabs.length ? '\n        ' : ''}),
        collections = listOf(${model.collections.map((c) => `\n            Collection(${ks(c.name)}, listOf(${c.fields.map(field).join(', ')})${c.rows.length ? `, sample = listOf(${c.rows.map(row).join(', ')})` : ''}),`).join('')}${model.collections.length ? '\n        ' : ''}),
        stats = listOf(${model.stats.map((s) => `\n            Stat(${ks(s.var)}, ${ks(s.collection)}, ${ks(s.how)}${s.field && s.field !== 'field' ? `, field = ${ks(s.field)}` : ''}${s.filter ? `, filter = ${ks(s.filter)}` : ''}),`).join('')}${model.stats.length ? '\n        ' : ''}),
    )
}

@Composable
fun App() {
    remember { setupApp() }
    PocketApp(
        mapOf(
${model.pages.map((p) => `            ${ks(p.value)} to { ${N[p.value]}() },`).join('\n')}
        ),
    )
}
`;
}

const androidPlatform = (pkg) => `package ${pkg}

import android.content.Context
import android.content.SharedPreferences
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable

actual object Store {
    private var prefs: SharedPreferences? = null
    private val memory = mutableMapOf<String, String>()
    fun init(context: Context) { prefs = context.getSharedPreferences("pocket", Context.MODE_PRIVATE) }
    actual fun get(key: String): String? = prefs?.getString(key, null) ?: memory[key]
    actual fun put(key: String, value: String) { val p = prefs; if (p != null) p.edit().putString(key, value).apply() else memory[key] = value }
}

@Composable
actual fun PlatformBack(enabled: Boolean, onBack: () -> Unit) = BackHandler(enabled, onBack)
`;
const mainActivity = (pkg) => `package ${pkg}

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        Store.init(applicationContext)
        setContent { App() }
    }
}
`;
const iosPlatform = (pkg) => `package ${pkg}

import androidx.compose.runtime.Composable
import platform.Foundation.NSUserDefaults

actual object Store {
    actual fun get(key: String): String? = NSUserDefaults.standardUserDefaults.stringForKey(key)
    actual fun put(key: String, value: String) { NSUserDefaults.standardUserDefaults.setObject(value, forKey = key) }
}

/** iOS has no Back button: pages opened on top show a back arrow. */
@Composable
actual fun PlatformBack(enabled: Boolean, onBack: () -> Unit) {}
`;
const iosMain = (pkg) => `package ${pkg}

import androidx.compose.ui.window.ComposeUIViewController

/** The app for iOS: iosApp/ContentView.swift shows this. */
fun MainViewController() = ComposeUIViewController { App() }
`;

function gradleFiles(o, pkg, V) {
  return {
    settings: `rootProject.name = ${ks(pkg.split('.').pop())}

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

include(":composeApp")
`,
    root: `plugins {
    kotlin("multiplatform") version "${V.kotlin}" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "${V.kotlin}" apply false
    id("org.jetbrains.compose") version "${V.compose}" apply false
    id("com.android.application") version "${V.agp}" apply false
}
`,
    props: 'org.gradle.jvmargs=-Xmx4g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=true\nkotlin.code.style=official\nkotlin.mpp.enableCInteropCommonization=true\n',
    app: `import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("multiplatform")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
    id("com.android.application")
}

kotlin {
    androidTarget {
        compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
    }
    listOf(iosArm64(), iosSimulatorArm64()).forEach {
        it.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }
    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation("org.jetbrains.compose.material:material-icons-core:${V.icons}")
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:${V.serialization}")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
        androidMain.dependencies {
            implementation("androidx.activity:activity-compose:${V.activity}")
        }
    }
}

android {
    namespace = ${ks(pkg)}
    compileSdk = ${V.compileSdk}
    defaultConfig {
        applicationId = ${ks(o.appId)}
        minSdk = ${V.minSdk}
        targetSdk = ${V.compileSdk}
        versionCode = ${Math.max(1, +o.buildNumber || 1)}
        versionName = ${ks(semver(o.version))}
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildTypes {
        getByName("release") { isMinifyEnabled = false }
    }
}
`,
    wrapperProps: `distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-${V.gradle}-bin.zip\nnetworkTimeout=10000\nvalidateDistributionUrl=true\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n`,
  };
}

function kotlinReadme(model, o) {
  const base = nativeReadme(model, o, 'flutter');
  const todo = base.includes('## Still to build') ? base.slice(base.indexOf('## Still to build')) : '';
  return `# ${model.name} (native Kotlin: Compose Multiplatform)

Your Pocket Engine app written out as a **Kotlin Multiplatform** app: one Kotlin codebase, the UI too
(Compose Multiplatform), for **Android and iOS**. No web view: native pages, navigation${model.tabs.length ? ', tabs' : ''}, lists, forms
and your data collections (saved on the phone). It's a starting point to keep building on.

## Android

Open this folder in **Android Studio** (with the Kotlin Multiplatform plugin) and press Run, or from a terminal:

    sh gradlew :composeApp:installDebug

(\`chmod +x gradlew\` once lets you run \`./gradlew\`.) For Google Play: **Build › Generate Signed App Bundle**, or \`sh gradlew :composeApp:bundleRelease\`.

## iOS (on a Mac)

Open \`iosApp/iosApp.xcodeproj\` in Xcode 16 or newer, pick your team under *Signing & Capabilities* and press Run.
The first build compiles the Kotlin code into a framework (Xcode runs \`gradlew\` for you), so it takes a few minutes.

## How it's made

| Pocket Engine | Kotlin |
| --- | --- |
| Pages | \`composeApp/src/commonMain/kotlin/…/pages/\`, one composable per page |
| App Bar | \`TopAppBar\` with the page title (and a back arrow) |
| Bottom Nav | \`NavigationBar\` |
| Data List / Form | \`RecordList\` / \`RecordForm\` |
| Variables, collections, stats | \`AppState\` in \`Pocket.kt\` |
| Saving on the phone | \`Store\`: SharedPreferences (\`androidMain\`), NSUserDefaults (\`iosMain\`) |
| Button actions | \`app.run(...)\` |

App ID **${o.appId}** · Kotlin ${KOTLIN_VERSIONS.kotlin} · Compose Multiplatform ${KOTLIN_VERSIONS.compose} · Android 7+ · iOS 15+

${todo}`;
}

/** All the files. runtime: Pocket.kt's text; wrapper: { jar (bytes), gradlew, gradlewBat }; icon: 1024 px PNG bytes. */
export function kotlinNativeFiles(game, o, { runtime, wrapper, icon }) {
  const model = appModel(game), N = names(model), pkg = kotlinPackage(o.appId), V = KOTLIN_VERSIONS;
  const dir = (o.slug || pkg.split('.').pop()) + '-kotlin/', src = (set) => `${dir}composeApp/src/${set}/kotlin/${pkg.replace(/\./g, '/')}/`;
  const G = gradleFiles(o, pkg, V);
  const xo = { ...o, name: 'iosApp', xcFolder: 'iosApp', iosTarget: '15.0', xcScript: { name: 'Compile Kotlin Framework', script: 'if [ "YES" = "$OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED" ]; then\n  echo "Skipping Gradle build task invocation due to OVERRIDE_KOTLIN_BUILD_IDE_SUPPORTED environment variable set to \\"YES\\""\n  exit 0\nfi\ncd "$SRCROOT/.."\nsh ./gradlew :composeApp:embedAndSignAppleFrameworkForXcode\n' },
    xcExtra: '\n\t\t\t\tFRAMEWORK_SEARCH_PATHS = "$(SRCROOT)/../composeApp/build/xcode-frameworks/$(CONFIGURATION)/$(SDK_NAME)";\n\t\t\t\tOTHER_LDFLAGS = (\n\t\t\t\t\t"$(inherited)",\n\t\t\t\t\t"-framework",\n\t\t\t\t\tComposeApp,\n\t\t\t\t);' };
  const orient = o.orientation === 'landscape' ? ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] : o.orientation === 'portrait' ? ['UIInterfaceOrientationPortrait'] : ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
  const infoPlist = plist({ CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)', CFBundleDisplayName: model.name, CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)', CFBundleInfoDictionaryVersion: '6.0', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)', CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    LSRequiresIPhoneOS: true, ITSAppUsesNonExemptEncryption: false, CADisableMinimumFrameDurationOnPhone: true, UIApplicationSceneManifest: { UIApplicationSupportsMultipleScenes: false }, UILaunchScreen: {}, UISupportedInterfaceOrientations: orient, 'UISupportedInterfaceOrientations~ipad': orient });
  const icons = JSON.stringify({ images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2);
  return { model, files: [
    { name: dir + 'README.md', data: kotlinReadme(model, o) },
    { name: dir + '.gitignore', data: '.gradle/\nbuild/\n*.iml\n.idea/\nlocal.properties\n.kotlin/\nxcuserdata/\nDerivedData/\n' },
    { name: dir + 'settings.gradle.kts', data: G.settings },
    { name: dir + 'build.gradle.kts', data: G.root },
    { name: dir + 'gradle.properties', data: G.props },
    { name: dir + 'gradle/wrapper/gradle-wrapper.properties', data: G.wrapperProps },
    { name: dir + 'gradle/wrapper/gradle-wrapper.jar', data: wrapper.jar },
    { name: dir + 'gradlew', data: wrapper.gradlew },
    { name: dir + 'gradlew.bat', data: wrapper.gradlewBat },
    { name: dir + 'composeApp/build.gradle.kts', data: G.app },
    { name: src('commonMain') + 'Pocket.kt', data: runtime.replace('package __PACKAGE__', 'package ' + pkg) },
    { name: src('commonMain') + 'App.kt', data: kApp(model, N, pkg) },
    ...model.pages.map((p) => ({ name: src('commonMain') + `pages/${N[p.value]}.kt`, data: kPage(p, N[p.value], pkg) })),
    { name: src('commonTest') + 'AppTest.kt', data: `package ${pkg}\n\nimport kotlin.test.Test\nimport kotlin.test.assertTrue\n\nclass AppTest {\n    @Test fun pagesAreNamed() { assertTrue(${model.pages.length} > 0) }\n}\n` },
    { name: src('androidMain') + 'MainActivity.kt', data: mainActivity(pkg) },
    { name: src('androidMain') + 'Platform.android.kt', data: androidPlatform(pkg) },
    { name: dir + 'composeApp/src/androidMain/AndroidManifest.xml', data: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${String(model.name).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true"${o.orientation === 'portrait' ? '\n            android:screenOrientation="portrait"' : o.orientation === 'landscape' ? '\n            android:screenOrientation="sensorLandscape"' : ''}
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
` },
    { name: dir + 'composeApp/src/androidMain/res/mipmap-xxxhdpi/ic_launcher.png', data: icon },
    { name: src('iosMain') + 'MainViewController.kt', data: iosMain(pkg) },
    { name: src('iosMain') + 'Platform.ios.kt', data: iosPlatform(pkg) },
    { name: dir + 'iosApp/iosApp.xcodeproj/project.pbxproj', data: pbxproj(xo, 'iosApp') },
    { name: dir + 'iosApp/Info.plist', data: infoPlist },
    { name: dir + 'iosApp/iosApp/iOSApp.swift', data: 'import SwiftUI\n\n@main\nstruct iOSApp: App {\n    var body: some Scene {\n        WindowGroup { ContentView() }\n    }\n}\n' },
    { name: dir + 'iosApp/iosApp/ContentView.swift', data: `// The Kotlin app (Compose Multiplatform) inside SwiftUI.
import SwiftUI
import UIKit
import ComposeApp

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController { MainViewControllerKt.MainViewController() }
    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct ContentView: View {
    var body: some View { ComposeView().ignoresSafeArea() }
}
` },
    { name: dir + 'iosApp/iosApp/Assets.xcassets/Contents.json', data: JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) },
    { name: dir + 'iosApp/iosApp/Assets.xcassets/AppIcon.appiconset/Contents.json', data: icons },
    { name: dir + 'iosApp/iosApp/Assets.xcassets/AppIcon.appiconset/icon-1024.png', data: icon },
    { name: dir + 'iosApp/iosApp/Assets.xcassets/LaunchBackground.colorset/Contents.json', data: JSON.stringify({ colors: [{ color: { 'color-space': 'srgb', components: { red: '1.000', green: '1.000', blue: '1.000', alpha: '1.000' } }, idiom: 'universal' }], info: { author: 'xcode', version: 1 } }, null, 2) },
  ] };
}
