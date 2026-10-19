// Native code export: the app as a React Native app (Expo, for iOS and Android), with real React Native views (no web view).
// Made from the same app model as the Flutter, Kotlin and SwiftUI exports, so it looks and works the same.
// App.js has the app (pages, tabs, data, App Bar, Bottom Nav, Side Menu); pages/ has one component per page;
// pocket.js (editor/native/rn/pocket.js) is the fixed runtime with the state and the building blocks.
import { appModel, PALETTES, barIcons } from './appmodel.js';
import { NAV_ART } from './navart.js';
import { names, placeOf } from './nativecode.js';

/** The versions an Expo 57 app uses (from expo's bundledNativeModules.json). */
export const RN_VERSIONS = {
  expo: '~57.0.28', react: '19.2.3', 'react-native': '0.86.3', 'react-native-svg': '15.15.4', '@react-native-async-storage/async-storage': '2.2.0',
  'react-native-safe-area-context': '~5.7.0', 'expo-status-bar': '~57.0.1', 'react-dom': '19.2.3', 'react-native-web': '~0.21.0', '@expo/metro-runtime': '~57.0.16',
};

/** Icon names the editor also knows by another name (settings → gear…). */
export const ICON_TWIN = { settings: 'gear', profile: 'user', explore: 'search', friends: 'users', add: 'plus', people: 'users', messages: 'chat', notifications: 'bell', shop: 'shop', store: 'shop', cog: 'gear', person: 'user', home: 'home' };
export const artOf = (n) => NAV_ART[n] || NAV_ART[ICON_TWIN[n]] || null;

/** Element kind → the runtime component that draws it. */
const COMP = {
  text: 'PText', button: 'PButton', box: 'PBox', space: 'PSpace', bar: 'PBar', slider: 'PSlider', segmented: 'Segmented', chips: 'Chips', dropdown: 'PDropdown', stepper: 'PStepper',
  rating: 'PRating', divider: 'PDivider', avatar: 'PAvatar', banner: 'PBanner', xpbar: 'XpBar', steps: 'PSteps', spinner: 'PSpinner', list: 'RecordList', form: 'RecordForm',
  input: 'VarField', toggle: 'VarSwitch', items: 'StaticList', image: 'PImage', row: 'PCard', feed: 'SocialFeed', composer: 'Composer', stories: 'Stories', inbox: 'Inbox',
  chat: 'Chat', profile: 'ProfileHeader', market: 'Marketplace', activity: 'Activity', people: 'People', achievements: 'Achievements', trending: 'Trending', todo: 'TodoBox',
};
/** Parts that fill the rest of the page (it doesn't scroll as a whole then). */
const FILLS = ['list', 'form', 'inbox', 'chat', 'market', 'activity', 'people'];
const SKIP = new Set(['kind', 'children', 'pin', 'start', 'fab']);

/** A JSX attribute: name="text", name={1}, name (true), name={{…}}. */
const attr = (k, v) => {
  if (v === true) return k;
  if (typeof v === 'string') return /^[^"{}\\\n<>]*$/.test(v) ? `${k}="${v}"` : `${k}={${JSON.stringify(v)}}`;
  return `${k}={${JSON.stringify(v)}}`;
};
/** Settings that are on unless turned off (their false is written out; other false settings are just left out). */
const ON_BY_DEFAULT = new Set(['swipeDelete', 'doneLook', 'yours', 'border']);
const attrs = (x, extra = {}) => Object.entries({ ...x, ...extra }).filter(([k, v]) => !SKIP.has(k) && v !== '' && v != null && (v !== false || ON_BY_DEFAULT.has(k)) && !(Array.isArray(v) && !v.length && k !== 'options')).map(([k, v]) => attr(k, v));

/** One element as JSX (cards with things inside get their children with where each sits). */
function rnElement(x, ind, inBox = false) {
  const pad = ' '.repeat(ind), comp = COMP[x.kind] || 'TodoBox';
  const a = [...attrs(x.kind === 'todo' || !COMP[x.kind] ? { name: x.name || x.type, type: x.type || x.kind } : x), ...(inBox && x.pin ? [attr('pin', x.pin)] : [])];
  const open = `<${comp}${a.length ? ' ' + a.join(' ') : ''}`;
  if ((x.kind === 'box' || x.kind === 'row') && x.children?.length) {
    return `${open}>\n${x.children.map((c) => pad + '  ' + rnElement(c, ind + 2, x.kind === 'box')).join('\n')}\n${pad}</${comp}>`;
  }
  return open + ' />';
}

function rnPage(p, cls, model) {
  const fills = p.items.some((x) => x.fill && FILLS.includes(x.kind)), used = new Set(['PocketPage']);
  const walk = (x) => { used.add(COMP[x.kind] || 'TodoBox'); (x.children || []).forEach(walk); };
  const parts = [];
  let bottom = false;
  for (const x of p.items) {
    walk(x);
    const pl = placeOf(x), code = rnElement(x, pl ? 8 : 6);
    if (pl) { used.add('Place'); parts.push(`<Place fx={${pl.fx}} width={${pl.w}}>\n        ${code}\n      </Place>`); } else parts.push(code);
    if (x.kind === 'button' && x.pin?.fy === 1) bottom = true; // (a button anchored to the bottom of the page)
  }
  // buttons that sit at the bottom of a page without a list: pushed down
  if (!fills && bottom) { const i = parts.findIndex((_, k) => p.items[k].kind === 'button' && p.items[k].pin?.fy === 1); if (i > 0) { parts.splice(i, 0, '<Spacer />'); used.add('Spacer'); } }
  const scroll = !fills && !parts.includes('<Spacer />');
  const props = [attr('title', p.title), attr('page', p.value), ...(model.appBar ? [] : ['appBar={false}']), ...(scroll ? [] : ['scroll={false}']), ...(p.fab ? [attr('fab', { action: p.fab.action, value: p.fab.value, amount: p.fab.amount })] : [])];
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
import React from 'react';
import { ${[...used].sort().join(', ')} } from '../pocket';

export default function ${cls}() {
  return (
    <PocketPage ${props.join(' ')}>
${parts.map((c) => '      ' + c).join('\n')}
    </PocketPage>
  );
}
`;
}

function rnApp(model, N) {
  const icons = barIcons(model).filter((n) => artOf(n));
  const M = {
    name: model.name, home: model.home, theme: model.theme,
    light: { ...PALETTES.light, accent: model.accent || PALETTES.light.accent }, dark: { ...PALETTES.dark, accent: model.accent || PALETTES.dark.accent },
    vars: model.vars, tabs: model.tabs, pages: model.pages.map((p) => ({ value: p.value })), collections: model.collections.map(({ name, fields, rows }) => ({ name, fields, rows })), stats: model.stats,
    appBar: model.appBar, bar: model.bar, nav: model.nav, menu: model.menu,
    art: Object.fromEntries(icons.map((n) => [n, artOf(n)])), // the App Bar's, Bottom Nav's and Side Menu's icons, drawn like the editor's (other names: their usual twin)
  };
  return `// ${model.name}: a native React Native app (Expo), made by Pocket Engine's native export.
// pocket.js has the app's state and building blocks; pages/ has one component per page.
import React from 'react';
import { PocketApp, setupApp } from './pocket';
${model.pages.map((p) => `import ${N[p.value]} from './pages/${N[p.value]}';`).join('\n')}

setupApp(${JSON.stringify(M, null, 2).replace(/\n/g, '\n')});

export default function App() {
  return (
    <PocketApp
      pages={{
${model.pages.map((p) => `        ${JSON.stringify(p.value)}: ${N[p.value]},`).join('\n')}
      }}
    />
  );
}
`;
}

function rnReadme(model, o, dir) {
  const todo = [...new Map(model.todo.map((t) => [t.name, t])).values()];
  return `# ${model.name} (React Native)

Made with Pocket Engine. This folder is an [Expo](https://expo.dev) app with real React Native views: the same pages, tabs,
App Bar, Bottom Nav, Side Menu, lists, forms and social feed as the Flutter, Kotlin and SwiftUI versions, drawn the same way.

## Try it

1. Install [Node.js](https://nodejs.org) (20 or newer), then in this folder run \`npm install\`.
2. Run \`npx expo start\` and scan the QR code with the **Expo Go** app (iPhone: the Camera app), or press \`a\` / \`i\` for
   an Android emulator / iOS simulator, or \`w\` for a web browser.

## Publish

1. Make a free account at [expo.dev](https://expo.dev), then \`npm install -g eas-cli\` and \`eas login\`.
2. \`eas build --platform all\` builds the iOS and Android apps in the cloud; \`eas submit\` uploads them to the stores.

The app's ID is \`${o.appId}\` (app.json).

## The code

- \`App.js\`: the app — its pages, tabs, data collections (with their starting records), App Bar, Bottom Nav and Side Menu.
- \`pages/\`: one component per page (${model.pages.length}), made from your project. Each part of a page is a component with its settings as props.
- \`pocket.js\`: the runtime — the state (variables and data, saved on the phone), the page stack on each tab, and the building blocks.

Change anything: from now on the code is yours.
${todo.length ? `\n## To build\n\nThese parts have no native version yet; they're placeholders (\`TodoBox\`) in the pages:\n\n${todo.map((t) => `- ${t.name} (${t.type})`).join('\n')}\n` : ''}`;
}

/** The React Native (Expo) project's files. o: { name, appId, version, slug }; runtime: the text of editor/native/rn/pocket.js. */
export function reactNativeFiles(game, o, { runtime, icon }) {
  const model = appModel(game), N = names(model), slug = o.slug || 'app', dir = slug + '-react-native/';
  const pkg = { name: slug, version: o.version || '1.0.0', private: true, main: 'index.js',
    scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios', web: 'expo start --web' },
    dependencies: Object.fromEntries(Object.entries(RN_VERSIONS)) };
  const appJson = { expo: { name: model.name, slug, version: o.version || '1.0.0', orientation: 'portrait', icon: './assets/icon.png', userInterfaceStyle: 'automatic',
    ios: { bundleIdentifier: o.appId, supportsTablet: true }, android: { package: o.appId.replace(/-/g, '_'), adaptiveIcon: { foregroundImage: './assets/icon.png', backgroundColor: '#ffffff' } }, web: { bundler: 'metro' } } };
  const files = [
    { name: dir + 'package.json', data: JSON.stringify(pkg, null, 2) + '\n' },
    { name: dir + 'app.json', data: JSON.stringify(appJson, null, 2) + '\n' },
    { name: dir + 'babel.config.js', data: "module.exports = function (api) {\n  api.cache(true);\n  return { presets: ['babel-preset-expo'] };\n};\n" },
    { name: dir + 'index.js', data: "import { registerRootComponent } from 'expo';\nimport App from './App';\n\nregisterRootComponent(App);\n" },
    { name: dir + 'App.js', data: rnApp(model, N) },
    { name: dir + 'pocket.js', data: runtime },
    ...model.pages.map((p) => ({ name: `${dir}pages/${N[p.value]}.js`, data: rnPage(p, N[p.value], model) })),
    { name: dir + '.gitignore', data: 'node_modules/\n.expo/\ndist/\nweb-build/\n*.log\n' },
    { name: dir + 'README.md', data: rnReadme(model, o, dir) },
  ];
  if (icon && icon.length) files.push({ name: dir + 'assets/icon.png', data: icon });
  return { model, files };
}
