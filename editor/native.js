// Native projects: the game as an Xcode project (iOS, Swift + WKWebView) and an Android Studio project
// (Java + WebView). No npm, Capacitor or Expo: open the folder in Xcode or Android Studio and press Run.
// Both use the same bridge as the Expo export (window.Capacitor → native notifications, vibration, Back).
import { BRIDGE } from './expo.js';

const semver = (v) => String(v || '1.0').split('.').concat(['0', '0']).slice(0, 3).map((n) => parseInt(n, 10) || 0).join('.');
const xmlEsc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
/** "Jump Quest!" → "JumpQuest" (an Xcode target / Java-safe name). */
export const codeName = (s) => (String(s || 'Game').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Game').replace(/^(\d)/, 'Game$1');
/** The game HTML with the bridge first in <head>, talking to the native side through `send`. */
const withBridge = (html, platform, send) => {
  const tag = `<script>window.__pkPlatform=${JSON.stringify(platform)};window.ReactNativeWebView={postMessage:function(s){${send}}};${BRIDGE.replace(/ true;$/, '')}</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
};
const hexRGB = (hex) => { const n = parseInt(String(hex || '#000000').replace('#', '').padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// ============================================================================
// Xcode (iOS)
// ============================================================================
const plistVal = (v, ind = '\t') => {
  if (typeof v === 'boolean') return `${ind}<${v}/>`;
  if (typeof v === 'number') return `${ind}<integer>${v}</integer>`;
  if (Array.isArray(v)) return `${ind}<array>\n${v.map((x) => plistVal(x, ind + '\t')).join('\n')}\n${ind}</array>`;
  if (v && typeof v === 'object') return `${ind}<dict>\n${Object.entries(v).map(([k, x]) => `${ind}\t<key>${xmlEsc(k)}</key>\n${plistVal(x, ind + '\t')}`).join('\n')}\n${ind}</dict>`;
  return `${ind}<string>${xmlEsc(v)}</string>`;
};
const plist = (o) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${plistVal(o, '')}\n</plist>\n`;

function infoPlist(o) {
  const perms = o.perms || [], why = (k) => perms.find((p) => p.kind === k)?.why;
  const orient = o.orientation === 'portrait' ? ['UIInterfaceOrientationPortrait'] : o.orientation === 'landscape' ? ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight']
    : ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight', 'UIInterfaceOrientationPortraitUpsideDown'];
  return plist({
    CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)', CFBundleDisplayName: o.name, CFBundleExecutable: '$(EXECUTABLE_NAME)', CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleInfoDictionaryVersion: '6.0', CFBundleName: '$(PRODUCT_NAME)', CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)', CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)',
    LSRequiresIPhoneOS: true, ITSAppUsesNonExemptEncryption: false, UIRequiresFullScreen: true,
    UIApplicationSceneManifest: { UIApplicationSupportsMultipleScenes: false },
    UILaunchScreen: { UIColorName: 'LaunchBackground' },
    UIStatusBarHidden: !!o.fullscreen, UIViewControllerBasedStatusBarAppearance: false,
    UISupportedInterfaceOrientations: orient, 'UISupportedInterfaceOrientations~ipad': orient,
    ...(why('camera') ? { NSCameraUsageDescription: why('camera') } : {}), ...(why('microphone') ? { NSMicrophoneUsageDescription: why('microphone') } : {}),
    ...(why('location') ? { NSLocationWhenInUseUsageDescription: why('location') } : {}),
  });
}
const privacyManifest = () => plist({ NSPrivacyTracking: false, NSPrivacyTrackingDomains: [], NSPrivacyCollectedDataTypes: [],
  NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] }] });

function swiftApp(o) {
  return `// ${o.name}: the game in a full-screen WKWebView, made with Pocket Engine.
// The game calls native features through window.Capacitor (a small bridge in index.html); Bridge below answers them.
import SwiftUI
import WebKit
import UserNotifications
import AudioToolbox

@main
struct GameApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color("LaunchBackground").ignoresSafeArea())
                .statusBarHidden(${o.fullscreen ? 'true' : 'false'})
                .modifier(HideHomeIndicator())
        }
    }
}

/// Dims the iPhone's home bar while playing (iOS 16 and newer).
struct HideHomeIndicator: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) { content.persistentSystemOverlays(.hidden) } else { content }
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        UIApplication.shared.isIdleTimerDisabled = true // keep the screen on while playing
        return true
    }
    // notifications show even while the game is open
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }
    // tapping one tells the game which (the message "notification opened ID")
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        Bridge.shared.notificationTapped(response.notification.request.content.userInfo["key"] as? String ?? "")
        completionHandler()
    }
}

struct GameView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { Bridge.shared.makeWebView() }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

final class Bridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    static let shared = Bridge()
    weak var web: WKWebView?
    private var loaded = false
    private var pendingKey: String?

    func makeWebView() -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: "pocket")
        let w = WKWebView(frame: .zero, configuration: config)
        w.isOpaque = false
        w.backgroundColor = UIColor(named: "LaunchBackground")
        w.scrollView.isScrollEnabled = false
        w.scrollView.bounces = false
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.navigationDelegate = self
        if #available(iOS 16.4, *) { w.isInspectable = true } // Safari › Develop can inspect it
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") { w.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent()) }
        web = w
        return w
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        if let k = pendingKey { pendingKey = nil; DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { self.sendTap(k) } }
    }
    func notificationTapped(_ key: String) { if loaded { sendTap(key) } else { pendingKey = key } }
    private func sendTap(_ key: String) { run("window.__pkEvent && window.__pkEvent('localNotificationActionPerformed', \\(json(["notification": ["extra": ["key": key]]])))") }
    private func run(_ js: String) { DispatchQueue.main.async { self.web?.evaluateJavaScript(js, completionHandler: nil) } }
    private func json(_ v: Any?) -> String {
        guard let v = v, !(v is NSNull) else { return "null" }
        if let d = try? JSONSerialization.data(withJSONObject: v, options: [.fragmentsAllowed]), let s = String(data: d, encoding: .utf8) { return s }
        return "null"
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let s = message.body as? String, let d = s.data(using: .utf8), let m = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any] else { return }
        if m["exit"] != nil { return } // (iOS apps don't close themselves)
        let id = (m["id"] as? NSNumber)?.intValue ?? 0
        handle(m["plugin"] as? String ?? "", m["method"] as? String ?? "", m["args"] as? [String: Any] ?? [:]) { ok, value in
            self.run("window.__pkReply(\\(id), \\(ok), \\(ok ? self.json(value) : self.json(String(describing: value ?? "failed"))))")
        }
    }

    private func permissionState(_ done: @escaping (Bool, Any?) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let state = s.authorizationStatus == .authorized || s.authorizationStatus == .provisional ? "granted" : s.authorizationStatus == .denied ? "denied" : "prompt"
            done(true, ["display": state])
        }
    }
    private func date(_ v: Any?) -> Date? {
        if let n = v as? NSNumber { return Date(timeIntervalSince1970: n.doubleValue / 1000) }
        guard let s = v as? String else { return nil }
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    /// The game's Capacitor-style calls (Haptics, LocalNotifications), answered natively.
    private func handle(_ plugin: String, _ method: String, _ a: [String: Any], _ done: @escaping (Bool, Any?) -> Void) {
        let center = UNUserNotificationCenter.current()
        switch (plugin, method) {
        case ("Haptics", "impact"):
            let style: UIImpactFeedbackGenerator.FeedbackStyle = (a["style"] as? String) == "LIGHT" ? .light : (a["style"] as? String) == "HEAVY" ? .heavy : .medium
            UIImpactFeedbackGenerator(style: style).impactOccurred(); done(true, nil)
        case ("Haptics", "notification"):
            let t: UINotificationFeedbackGenerator.FeedbackType = (a["type"] as? String) == "WARNING" ? .warning : (a["type"] as? String) == "ERROR" ? .error : .success
            UINotificationFeedbackGenerator().notificationOccurred(t); done(true, nil)
        case ("Haptics", "vibrate"):
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate); done(true, nil)
        case ("LocalNotifications", "checkPermissions"):
            permissionState(done)
        case ("LocalNotifications", "requestPermissions"):
            center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in self.permissionState(done) }
        case ("LocalNotifications", "createChannel"):
            done(true, [:]) // (Android only)
        case ("LocalNotifications", "schedule"):
            for n in a["notifications"] as? [[String: Any]] ?? [] {
                let content = UNMutableNotificationContent()
                content.title = n["title"] as? String ?? ""
                content.body = n["body"] as? String ?? ""
                content.sound = .default
                content.userInfo = (n["extra"] as? [String: Any]) ?? [:]
                let s = n["schedule"] as? [String: Any]
                var trigger: UNNotificationTrigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
                if let at = date(s?["at"]) {
                    trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, at.timeIntervalSinceNow), repeats: false)
                } else if let on = s?["on"] as? [String: Any] {
                    var c = DateComponents(); c.hour = (on["hour"] as? NSNumber)?.intValue ?? 0; c.minute = (on["minute"] as? NSNumber)?.intValue ?? 0
                    trigger = UNCalendarNotificationTrigger(dateMatching: c, repeats: true)
                } else if let every = s?["every"] as? String {
                    let secs: Double = ["minute": 60, "hour": 3600, "day": 86400, "week": 604800][every] ?? 86400
                    trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(60, secs), repeats: true)
                }
                let nid = (n["id"] as? NSNumber)?.stringValue ?? (n["id"] as? String ?? UUID().uuidString)
                center.add(UNNotificationRequest(identifier: nid, content: content, trigger: trigger))
            }
            done(true, [:])
        case ("LocalNotifications", "cancel"):
            let ids = (a["notifications"] as? [[String: Any]] ?? []).compactMap { ($0["id"] as? NSNumber)?.stringValue ?? $0["id"] as? String }
            center.removePendingNotificationRequests(withIdentifiers: ids); done(true, [:])
        case ("LocalNotifications", "getPending"):
            center.getPendingNotificationRequests { reqs in done(true, ["notifications": reqs.map { r -> [String: Any] in ["id": Int(r.identifier).map { $0 as Any } ?? r.identifier] }]) }
        default:
            done(false, "\\(plugin).\\(method) is not available")
        }
    }
}
`;
}

/** project.pbxproj (Xcode 16 format: the App folder is synced, so every file in it is part of the app). */
function pbxproj(o, name) {
  const id = (n) => 'A1B2C3D4E5F6' + String(n).padStart(12, '0');
  const I = { project: id(1), mainGroup: id(2), products: id(3), app: id(4), appFolder: id(5), target: id(6), sources: id(7), frameworks: id(8), resources: id(9),
    projList: id(10), projDebug: id(11), projRelease: id(12), tgtList: id(13), tgtDebug: id(14), tgtRelease: id(15) };
  const common = (debug) => `
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ANALYZER_NONNULL = YES;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = ${debug ? 'dwarf' : '"dwarf-with-dsym"'};
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_C_LANGUAGE_STANDARD = gnu17;
				${debug ? 'ENABLE_TESTABILITY = YES;\n				GCC_OPTIMIZATION_LEVEL = 0;\n				GCC_PREPROCESSOR_DEFINITIONS = (\n					"DEBUG=1",\n					"$(inherited)",\n				);\n				ONLY_ACTIVE_ARCH = YES;\n				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";\n				SWIFT_OPTIMIZATION_LEVEL = "-Onone";' : 'ENABLE_NS_ASSERTIONS = NO;\n				SWIFT_COMPILATION_MODE = wholemodule;\n				VALIDATE_PRODUCT = YES;'}
				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
				MTL_ENABLE_DEBUG_INFO = ${debug ? 'INCLUDE_SOURCE' : 'NO'};
				SDKROOT = iphoneos;`;
  const target = () => `
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = LaunchBackground;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = ${Math.max(1, +o.buildNumber || 1)};
				${o.appleTeamId ? `DEVELOPMENT_TEAM = ${o.appleTeamId};` : 'DEVELOPMENT_TEAM = "";'}
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = NO;
				INFOPLIST_FILE = Info.plist;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = ${semver(o.version)};
				PRODUCT_BUNDLE_IDENTIFIER = ${o.appId};
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = ${o.iosDevices === 'universal' ? '"1,2"' : '1'};`;
  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXFileReference section */
		${I.app} /* ${name}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${name}.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
		${I.appFolder} /* App */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = App;
			sourceTree = "<group>";
		};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
		${I.frameworks} /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		${I.mainGroup} = {
			isa = PBXGroup;
			children = (
				${I.appFolder} /* App */,
				${I.products} /* Products */,
			);
			sourceTree = "<group>";
		};
		${I.products} /* Products */ = {
			isa = PBXGroup;
			children = (
				${I.app} /* ${name}.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		${I.target} /* ${name} */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = ${I.tgtList} /* Build configuration list for PBXNativeTarget "${name}" */;
			buildPhases = (
				${I.sources} /* Sources */,
				${I.frameworks} /* Frameworks */,
				${I.resources} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			fileSystemSynchronizedGroups = (
				${I.appFolder} /* App */,
			);
			name = ${name};
			packageProductDependencies = (
			);
			productName = ${name};
			productReference = ${I.app} /* ${name}.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		${I.project} /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1600;
				LastUpgradeCheck = 1600;
				TargetAttributes = {
					${I.target} = {
						CreatedOnToolsVersion = 16.0;
					};
				};
			};
			buildConfigurationList = ${I.projList} /* Build configuration list for PBXProject "${name}" */;
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = ${I.mainGroup};
			minimizedProjectReferenceProxies = 1;
			preferredProjectObjectVersion = 77;
			productRefGroup = ${I.products} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				${I.target} /* ${name} */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		${I.resources} /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		${I.sources} /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		${I.projDebug} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {${common(true)}
			};
			name = Debug;
		};
		${I.projRelease} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {${common(false)}
			};
			name = Release;
		};
		${I.tgtDebug} /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {${target()}
			};
			name = Debug;
		};
		${I.tgtRelease} /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {${target()}
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		${I.projList} /* Build configuration list for PBXProject "${name}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${I.projDebug} /* Debug */,
				${I.projRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		${I.tgtList} /* Build configuration list for PBXNativeTarget "${name}" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				${I.tgtDebug} /* Debug */,
				${I.tgtRelease} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = ${I.project} /* Project object */;
}
`;
}

function xcodeReadme(o, name) {
  return `# ${o.name} for iOS (Xcode)

Made with Pocket Engine: the game runs in a full-screen WKWebView, with native notifications, haptics and the screen kept on.

| | |
|---|---|
| Bundle ID | \`${o.appId}\` |
| Version | ${semver(o.version)} (build ${Math.max(1, +o.buildNumber || 1)}) |
| Needs | A Mac with **Xcode 16** or later, iOS 15+ |

## Run it
1. Open **${name}.xcodeproj** in Xcode.
2. Click the project › target **${name}** › **Signing & Capabilities**: tick *Automatically manage signing* and pick your **Team**${o.appleTeamId ? ` (set to ${o.appleTeamId})` : ' (a free Apple ID works for your own iPhone)'}.
3. Pick a simulator or your iPhone at the top and press **▶ Run**.

## Put it on the App Store
1. You need an Apple Developer account (developer.apple.com) and the app created in App Store Connect with the bundle ID above.
2. Choose **Any iOS Device (arm64)**, then **Product › Archive**.
3. In the Organizer: **Distribute App › App Store Connect › Upload**. It appears in TestFlight a few minutes later.
4. For each update raise **Version** (or the build number) in Pocket Engine's Build Settings and download again, or change *Version* and *Build* in the target's **General** tab.

The **store-listing/** folder (next to this one) has the App Store icon, the listing text and the privacy answers.

## What's inside
- \`App/GameApp.swift\`: the app, the web view and the native bridge (notifications, haptics).
- \`App/index.html\`: the whole game (the same as Build HTML). Replace it to update the game.
- \`App/Assets.xcassets\`: the app icon (1024, no transparency) and the launch background colour.
- \`App/PrivacyInfo.xcprivacy\`: Apple's privacy manifest. \`Info.plist\`: name, orientation${(o.perms || []).length ? ' and permission messages' : ''}.

Inspect the running game from Safari on your Mac: **Develop › (your device) › ${o.name}**.
`;
}

/** Every file of the Xcode project, inside a folder named after the game. icon: 1024 RGB PNG bytes. */
export function xcodeFiles(o, { html, icon }) {
  const name = codeName(o.name), dir = name + '/', [r, g, b] = hexRGB(o.splashBg);
  const color = { colors: [{ color: { 'color-space': 'srgb', components: { red: (r / 255).toFixed(3), green: (g / 255).toFixed(3), blue: (b / 255).toFixed(3), alpha: '1.000' } }, idiom: 'universal' }], info: { author: 'xcode', version: 1 } };
  return [
    { name: dir + 'README.md', data: xcodeReadme(o, name) },
    { name: dir + '.gitignore', data: 'xcuserdata/\nDerivedData/\n*.xcuserstate\nbuild/\n' },
    { name: dir + name + '.xcodeproj/project.pbxproj', data: pbxproj(o, name) },
    { name: dir + 'Info.plist', data: infoPlist(o) },
    { name: dir + 'App/GameApp.swift', data: swiftApp(o) },
    { name: dir + 'App/index.html', data: withBridge(html, 'ios', 'window.webkit.messageHandlers.pocket.postMessage(s)') },
    { name: dir + 'App/PrivacyInfo.xcprivacy', data: privacyManifest() },
    { name: dir + 'App/Assets.xcassets/Contents.json', data: JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) },
    { name: dir + 'App/Assets.xcassets/AppIcon.appiconset/Contents.json', data: JSON.stringify({ images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2) },
    { name: dir + 'App/Assets.xcassets/AppIcon.appiconset/icon-1024.png', data: icon },
    { name: dir + 'App/Assets.xcassets/LaunchBackground.colorset/Contents.json', data: JSON.stringify(color, null, 2) },
  ];
}

// ============================================================================
// Android Studio
// ============================================================================
export const ANDROID_VERSIONS = { agp: '8.10.1', gradle: '8.11.1', compileSdk: 36, targetSdk: 36, minSdk: 26 };

function manifest(o) {
  const perms = o.perms || [], has = (k) => perms.some((p) => p.kind === k);
  const orient = o.orientation === 'portrait' ? 'portrait' : o.orientation === 'landscape' ? 'sensorLandscape' : 'fullSensor';
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
${has('camera') ? '    <uses-permission android:name="android.permission.CAMERA" />\n' : ''}${has('microphone') ? '    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n' : ''}${has('location') ? '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n' : ''}
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:hardwareAccelerated="true"
        android:theme="@style/Theme.Game">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="${orient}"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|keyboard|smallestScreenSize|uiMode">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <receiver android:name=".NotifyReceiver" android:exported="false">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>
`;
}

function mainActivity(o, pkg) {
  return `package ${pkg};

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

/** ${o.name}: the game in a full-screen WebView, made with Pocket Engine. The game calls native features through window.Capacitor (a bridge in index.html); this answers them. */
public class MainActivity extends Activity {
    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private boolean loaded = false;
    private String pendingKey = null;
    private int permissionCallId = -1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(getResources().getColor(R.color.launch_background, getTheme()));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                loaded = true;
                if (pendingKey != null) { final String k = pendingKey; pendingKey = null; ui.postDelayed(() -> sendTap(k), 1500); }
            }
        });
        web.addJavascriptInterface(new Bridge(), "PocketAndroid");
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true); // chrome://inspect
        setContentView(web);
        fullscreen();
        NotifyReceiver.ensureChannel(this, "game", "Game");
        readTap(getIntent());
        web.loadUrl("file:///android_asset/index.html");
    }

    private void fullscreen() {
        if (!${o.fullscreen ? 'true' : 'false'}) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) { super.onWindowFocusChanged(hasFocus); if (hasFocus) fullscreen(); }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); readTap(intent); }
    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }

    // Back goes back in the game first (a page, a popup); with nowhere to go, the game asks to close
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { web.evaluateJavascript("window.__pkBack && window.__pkBack()", null); }

    /** Opened from a notification: tell the game which one (the message "notification opened ID"). */
    private void readTap(Intent intent) {
        if (intent == null || !intent.hasExtra("pkKey")) return;
        String key = intent.getStringExtra("pkKey"); intent.removeExtra("pkKey");
        if (loaded) sendTap(key); else pendingKey = key;
    }
    private void sendTap(String key) {
        try { run("window.__pkEvent && window.__pkEvent('localNotificationActionPerformed', " + new JSONObject().put("notification", new JSONObject().put("extra", new JSONObject().put("key", key))) + ")"); } catch (Exception ignored) { }
    }
    private void run(String js) { ui.post(() -> web.evaluateJavascript(js, null)); }
    private void reply(int id, boolean ok, Object value) { run("window.__pkReply(" + id + ", " + ok + ", " + (value == null ? "null" : ok ? value.toString() : JSONObject.quote(value.toString())) + ")"); }

    private class Bridge {
        @JavascriptInterface public void postMessage(String message) { ui.post(() -> handle(message)); }
    }

    private String permissionState() {
        if (Build.VERSION.SDK_INT < 33) return ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled() ? "granted" : "denied";
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return "granted";
        return shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) || !getSharedPreferences("pk", MODE_PRIVATE).getBoolean("asked", false) ? "prompt" : "denied";
    }

    private void handle(String message) {
        int id = -1;
        try {
            JSONObject m = new JSONObject(message);
            if (m.has("exit")) { finish(); return; }
            id = m.optInt("id"); String plugin = m.optString("plugin"), method = m.optString("method");
            JSONObject a = m.optJSONObject("args"); if (a == null) a = new JSONObject();
            Vibrator vib = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            switch (plugin + "." + method) {
                case "Haptics.impact": { String st = a.optString("style", "MEDIUM"); buzz(vib, st.equals("LIGHT") ? 10 : st.equals("HEAVY") ? 45 : 22); reply(id, true, null); return; }
                case "Haptics.notification": buzz(vib, 30); reply(id, true, null); return;
                case "Haptics.vibrate": buzz(vib, Math.max(1, a.optInt("duration", 300))); reply(id, true, null); return;
                case "LocalNotifications.checkPermissions": reply(id, true, new JSONObject().put("display", permissionState())); return;
                case "LocalNotifications.requestPermissions":
                    if (Build.VERSION.SDK_INT >= 33 && !"granted".equals(permissionState())) { permissionCallId = id; getSharedPreferences("pk", MODE_PRIVATE).edit().putBoolean("asked", true).apply(); requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7); return; }
                    reply(id, true, new JSONObject().put("display", permissionState())); return;
                case "LocalNotifications.createChannel": NotifyReceiver.ensureChannel(this, a.optString("id", "game"), a.optString("name", "Game")); reply(id, true, new JSONObject()); return;
                case "LocalNotifications.schedule": {
                    JSONArray list = a.optJSONArray("notifications");
                    for (int i = 0; list != null && i < list.length(); i++) NotifyReceiver.schedule(this, list.getJSONObject(i));
                    reply(id, true, new JSONObject()); return;
                }
                case "LocalNotifications.cancel": {
                    JSONArray list = a.optJSONArray("notifications");
                    for (int i = 0; list != null && i < list.length(); i++) NotifyReceiver.cancel(this, list.getJSONObject(i).optString("id"));
                    reply(id, true, new JSONObject()); return;
                }
                case "LocalNotifications.getPending": {
                    JSONArray out = new JSONArray();
                    for (String nid : NotifyReceiver.pendingIds(this)) out.put(new JSONObject().put("id", nid.matches("-?\\\\d+") ? (Object) Long.parseLong(nid) : nid));
                    reply(id, true, new JSONObject().put("notifications", out)); return;
                }
                default: reply(id, false, plugin + "." + method + " is not available");
            }
        } catch (Exception e) { if (id >= 0) reply(id, false, String.valueOf(e.getMessage())); }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (permissionCallId >= 0) { try { reply(permissionCallId, true, new JSONObject().put("display", permissionState())); } catch (Exception ignored) { } permissionCallId = -1; }
    }

    private static void buzz(Vibrator v, int ms) {
        if (v == null || !v.hasVibrator()) return;
        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
    }
}
`;
}

function notifyReceiver(o, pkg) {
  return `package ${pkg};

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;

/** Phone notifications the game schedules: kept in preferences (so they survive a restart of the phone) and shown by AlarmManager. */
public class NotifyReceiver extends BroadcastReceiver {
    private static final String PREFS = "pk_notifications";

    static void ensureChannel(Context c, String id, String name) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm.getNotificationChannel(id) == null) nm.createNotificationChannel(new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH));
    }
    private static long parseTime(Object at) {
        if (at instanceof Number) return ((Number) at).longValue();
        String s = String.valueOf(at);
        for (String f : new String[] { "yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX" }) {
            try { SimpleDateFormat d = new SimpleDateFormat(f, Locale.US); d.setTimeZone(TimeZone.getTimeZone("UTC")); return d.parse(s).getTime(); } catch (Exception ignored) { }
        }
        return System.currentTimeMillis() + 1000;
    }
    /** When it next shows, and how often it repeats (0 = once). */
    private static long[] timing(JSONObject n) {
        JSONObject s = n.optJSONObject("schedule"); long now = System.currentTimeMillis();
        if (s == null) return new long[] { now + 1000, 0 };
        if (s.has("at")) return new long[] { Math.max(now + 1000, parseTime(s.opt("at"))), 0 };
        if (s.has("on")) {
            JSONObject on = s.optJSONObject("on"); Calendar c = Calendar.getInstance();
            c.set(Calendar.HOUR_OF_DAY, on.optInt("hour")); c.set(Calendar.MINUTE, on.optInt("minute")); c.set(Calendar.SECOND, 0);
            if (c.getTimeInMillis() <= now) c.add(Calendar.DAY_OF_YEAR, 1);
            return new long[] { c.getTimeInMillis(), 86400000L };
        }
        String every = s.optString("every", "day");
        long ms = every.equals("minute") ? 60000L : every.equals("hour") ? 3600000L : every.equals("week") ? 604800000L : 86400000L;
        return new long[] { now + ms, ms };
    }
    private static PendingIntent pending(Context c, String id, JSONObject n) {
        Intent i = new Intent(c, NotifyReceiver.class).putExtra("id", id);
        if (n != null) i.putExtra("n", n.toString());
        return PendingIntent.getBroadcast(c, id.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void schedule(Context c, JSONObject n) throws Exception {
        String id = n.optString("id", String.valueOf(System.currentTimeMillis()));
        long[] t = timing(n);
        n.put("_at", t[0]); n.put("_repeat", t[1]);
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(id, n.toString()).apply();
        arm(c, id, n, t[0]);
    }
    private static void arm(Context c, String id, JSONObject n, long at) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, id, n));
    }
    static void cancel(Context c, String id) {
        ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).cancel(pending(c, id, null));
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(id).apply();
    }
    static List<String> pendingIds(Context c) { return new ArrayList<>(c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getAll().keySet()); }

    @Override public void onReceive(Context c, Intent intent) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) { // the phone restarted: alarms are gone, set them again
            for (String id : pendingIds(c)) { try { JSONObject n = new JSONObject(p.getString(id, "{}")); long at = n.optLong("_at"), rep = n.optLong("_repeat"); long now = System.currentTimeMillis(); while (rep > 0 && at < now) at += rep; arm(c, id, n, Math.max(at, now + 2000)); } catch (Exception ignored) { } }
            return;
        }
        String id = intent.getStringExtra("id");
        try {
            JSONObject n = new JSONObject(intent.getStringExtra("n") != null ? intent.getStringExtra("n") : p.getString(id, "{}"));
            String channel = n.optString("channelId", "game"); ensureChannel(c, channel, "Game");
            JSONObject extra = n.optJSONObject("extra");
            Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra("pkKey", extra != null ? extra.optString("key", "") : "");
            Notification note = new Notification.Builder(c, channel)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(n.optString("title"))
                .setContentText(n.optString("body"))
                .setStyle(new Notification.BigTextStyle().bigText(n.optString("body")))
                .setAutoCancel(true)
                .setContentIntent(PendingIntent.getActivity(c, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .build();
            ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id.hashCode(), note);
            long rep = n.optLong("_repeat");
            if (rep > 0) { long at = System.currentTimeMillis() + rep; n.put("_at", at); p.edit().putString(id, n.toString()).apply(); arm(c, id, n, at); }
            else p.edit().remove(id).apply();
        } catch (Exception ignored) { }
    }
}
`;
}

function androidReadme(o, pkg) {
  const V = ANDROID_VERSIONS;
  return `# ${o.name} for Android (Android Studio)

Made with Pocket Engine: the game runs in a full-screen WebView, with phone notifications (they come back after a restart), vibration and the Back button.

| | |
|---|---|
| Package | \`${pkg}\` |
| Version | ${o.version} (versionCode ${Math.max(1, +o.buildNumber || 1)}) |
| Builds with | Android Gradle Plugin ${V.agp}, Gradle ${V.gradle}, compile / target SDK ${V.compileSdk}, Android ${V.minSdk === 26 ? '8.0' : V.minSdk}+ |

## Run it
1. Install **Android Studio** (developer.android.com/studio).
2. **File › Open** and pick this folder. Let it sync (the first time it downloads Gradle and the Android SDK). If it offers to update the Android Gradle Plugin, say yes.
3. Plug in your phone (with USB debugging on) or start an emulator, and press **▶ Run**.

From a terminal instead: \`gradle wrapper\` once (or let Android Studio make the wrapper), then \`./gradlew installDebug\`.

## Put it on Google Play
1. **Build › Generate Signed App Bundle / APK › Android App Bundle**, create a key store (keep it safe: every update needs the same key), and build the **release** bundle.
2. Upload \`app/release/app-release.aab\` in the Google Play Console (play.google.com/console) › your app › a testing track or Production.
3. For each update raise **Version** in Pocket Engine's Build Settings and the **build number** (versionCode), then download again, or change \`versionCode\` and \`versionName\` in \`app/build.gradle.kts\`.

The **store-listing/** folder (next to this one) has the Play icon, the feature graphic, the listing text and the Data safety answers.

## What's inside
- \`app/src/main/java/${pkg.replace(/\./g, '/')}/MainActivity.java\`: the WebView and the native bridge. \`NotifyReceiver.java\`: scheduled notifications.
- \`app/src/main/assets/index.html\`: the whole game (the same as Build HTML). Replace it to update the game.
- \`app/src/main/res\`: the icons (adaptive and older phones), the notification icon, colours and the theme.

Debug builds can be inspected from Chrome on your computer: \`chrome://inspect\`.
`;
}

/** Every file of the Android Studio project, in a folder named after the game. icons: { legacy: {48: png, 72: …}, fg: png 432, notif: png } */
export function androidFiles(o, { html, icons }) {
  const V = ANDROID_VERSIONS, pkg = o.appId, dir = codeName(o.name) + '-android/', jdir = 'app/src/main/java/' + pkg.replace(/\./g, '/') + '/';
  const dens = { 48: 'mdpi', 72: 'hdpi', 96: 'xhdpi', 144: 'xxhdpi', 192: 'xxxhdpi' };
  return [
    { name: dir + 'README.md', data: androidReadme(o, pkg) },
    { name: dir + '.gitignore', data: '.gradle/\n/build/\n/app/build/\n/local.properties\n.idea/\n*.iml\n*.jks\n*.keystore\n/captures/\n' },
    { name: dir + 'settings.gradle.kts', data: `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = ${JSON.stringify(o.name)}\ninclude(":app")\n` },
    { name: dir + 'build.gradle.kts', data: `plugins {\n    id("com.android.application") version "${V.agp}" apply false\n}\n` },
    { name: dir + 'gradle.properties', data: 'org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=true\n' },
    { name: dir + 'gradle/wrapper/gradle-wrapper.properties', data: `distributionBase=GRADLE_USER_HOME\ndistributionPath=wrapper/dists\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-${V.gradle}-bin.zip\nnetworkTimeout=10000\nzipStoreBase=GRADLE_USER_HOME\nzipStorePath=wrapper/dists\n` },
    { name: dir + 'app/build.gradle.kts', data: `plugins {\n    id("com.android.application")\n}\n\nandroid {\n    namespace = "${pkg}"\n    compileSdk = ${V.compileSdk}\n\n    defaultConfig {\n        applicationId = "${pkg}"\n        minSdk = ${V.minSdk}\n        targetSdk = ${V.targetSdk}\n        versionCode = ${Math.max(1, +o.buildNumber || 1)}\n        versionName = "${String(o.version || '1.0').replace(/"/g, '')}"\n    }\n\n    buildTypes {\n        release {\n            isMinifyEnabled = false\n        }\n    }\n    buildFeatures {\n        buildConfig = true\n    }\n    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n    }\n}\n` },
    { name: dir + 'app/src/main/AndroidManifest.xml', data: manifest(o) },
    { name: dir + jdir + 'MainActivity.java', data: mainActivity(o, pkg) },
    { name: dir + jdir + 'NotifyReceiver.java', data: notifyReceiver(o, pkg) },
    { name: dir + 'app/src/main/assets/index.html', data: withBridge(html, 'android', 'PocketAndroid.postMessage(s)') },
    { name: dir + 'app/src/main/res/values/strings.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${xmlEsc(o.name)}</string>\n</resources>\n` },
    { name: dir + 'app/src/main/res/values/colors.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="launch_background">${o.splashBg}</color>\n    <color name="ic_launcher_background">${o.iconBg}</color>\n</resources>\n` },
    { name: dir + 'app/src/main/res/values/themes.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="Theme.Game" parent="android:Theme.Material.NoActionBar">\n        <item name="android:windowBackground">@color/launch_background</item>\n        <item name="android:statusBarColor">@color/launch_background</item>\n        <item name="android:navigationBarColor">@color/launch_background</item>\n        <item name="android:windowFullscreen">${o.fullscreen ? 'true' : 'false'}</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>\n    </style>\n</resources>\n` },
    { name: dir + 'app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', data: `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n` },
    { name: dir + 'app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', data: icons.fg },
    ...Object.entries(icons.legacy).map(([px, png]) => ({ name: `${dir}app/src/main/res/mipmap-${dens[px]}/ic_launcher.png`, data: png })),
    { name: dir + 'app/src/main/res/drawable-xxxhdpi/ic_stat_notify.png', data: icons.notif },
  ];
}
