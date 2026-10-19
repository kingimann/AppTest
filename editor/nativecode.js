// Native code export: an app project written out as a real Flutter app (Dart widgets) or a SwiftUI app, with no
// web view. Pages, the App Bar, the Bottom Nav, text, buttons, Data Lists, Forms, inputs, switches and data
// collections become native code; anything else is left as a placeholder with a TODO. The runtime (state, data,
// building blocks) is a fixed file (editor/native/…); the pages are generated from the project.
import { appModel, PALETTES, iconFor, barIcons } from './appmodel.js';
import { NAV_ART } from './navart.js';
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
/** A Data List's look settings that differ from the defaults (sep: ': ' for Dart / Swift, ' = ' for Kotlin). */
export const listExtras = (x, sep, q = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v)), right = true) => [
  right && x.right && ['right', q(x.right)], x.swipeDelete === false && ['swipeDelete', 'false'], x.rowH && x.rowH !== 64 && ['rowH', x.rowH], x.gap != null && +x.gap !== 8 && ['gap', +x.gap], x.radius != null && +x.radius !== 14 && ['radius', +x.radius], x.doneLook === false && ['doneLook', 'false'],
].filter(Boolean).map(([k, v]) => `, ${k}${sep}${v}`).join('');
/** Colour tokens kept as text for the runtime to resolve ("@bar", "#1d9bf0"); anything else → the fallback. */
const tok = (c, fb) => tokenColor(c) || fb;
/** A button's own colours, height, corners and text size (when they differ from the defaults). */
const btnExtras = (x, sep, q) => [tokenColor(x.fill) && !x.plain && ['bg', q(x.fill)], tokenColor(x.color) && ['fg', q(x.color)], tokenColor(x.stroke) && ['stroke', q(x.stroke)], x.h && x.h !== 52 && ['height', x.h], x.radius != null && x.radius !== 16 && ['radius', x.radius], x.size && x.size !== 17 && ['size', x.size]].filter(Boolean).map(([k, v]) => `, ${k}${sep}${v}`).join('');
/** Where a thing sits in a card (see Pin in the runtimes). */
export const pinArgs = (q, sep, f = (v) => v) => [['fx', f(q.fx)], ['fy', f(q.fy)], ['x', f(q.x)], ['y', f(q.y)], q.w && ['w', f(q.w)], q.h && ['h', f(q.h)], q.align && q.align !== 'center' && ['align', JSON.stringify(q.align)], q.m >= 0 && ['m', f(q.m)], q.wrap && ['wrap', f(q.wrap)], q.cells && ['cell', q.cell], q.cells && ['cells', q.cells]]
  .filter(Boolean).map(([k, v]) => `${k}${sep}${v}`).join(', ');
export { btnExtras, tok as tokOr, menuTo };
/** A thing narrower than the page, on its own line (left / centre / right). */
export const placeOf = (x) => (x.pin && x.pin.m < 0 && x.pin.w && ['box', 'button', 'image', 'avatar'].includes(x.kind) ? { fx: x.pin.fx, w: x.kind === 'button' ? Math.max(x.pin.w, labelW(x)) : x.pin.w } : null);
/** About how wide a button's words are (so a link like “Forgot password?” is never cut short). */
export const labelW = (x) => Math.round(String(x.label || '').length * (x.size || 17) * 0.6 + (x.plain ? 8 : 24));

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
/** Named arguments that differ from the runtime's defaults: [[name, value, default]] → ", name: value…" (strings written with str). */
/** Swift numbers: the Int settings rounded, the rest as written (CGFloat / Double). */
const SN = (v, k) => (['points', 'columns', 'lines', 'maxLength'].includes(k) ? String(Math.round(v)) : String(v));
export const optArgs = (pairs, eq, str, num = (v) => String(v)) => pairs.filter(([, v, d]) => v != null && v !== d).map(([k, v]) => `, ${k}${eq}${typeof v === 'string' ? str(v) : typeof v === 'number' ? num(v, k) : v}`).join(''); // (num gets the name too: Kotlin's Int / Double / Float)

function dartElement(x, ind) {
  const pad = ' '.repeat(ind);
  switch (x.kind) {
    case 'text': return `PText(${ds(x.value)}${x.size !== 16 ? `, size: ${x.size}` : ''}${x.weight !== '600' ? `, weight: ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color: ${ds(tokenColor(x.color))}` : ''}${x.align && x.align !== 'left' ? `, align: ${ds(x.align)}` : ''})`;
    case 'button': return `PButton(${ds(x.label)}, onTap: () => app.run(${ds(x.action)}, ${dartValue(x.value)}${x.amount !== 1 && x.amount != null ? `, ${+x.amount || 0}` : ''})${x.plain ? ', look: Look.plain' : x.outlined ? `, look: ${/danger/.test(x.color) ? 'Look.danger' : 'Look.outlined'}` : ''}${btnExtras(x, ': ', ds)})`;
    case 'box': return `PBox(w: ${x.w || 368}, h: ${x.h}${x.radius ? `, radius: ${x.radius}` : ''}${tokenColor(x.fill) ? `, fill: ${ds(x.fill)}` : ''}${tokenColor(x.stroke) ? `, stroke: ${ds(x.stroke)}, strokeW: ${x.strokeW || 1}` : ''}${x.shadow ? ', shadow: true' : ''}${x.text ? `, text: ${ds(x.text.value)}, textSize: ${x.text.size}, textWeight: ${parseInt(x.text.weight, 10) || 600}${tokenColor(x.text.color) ? `, textColor: ${ds(x.text.color)}` : ''}` : ''}${x.row != null ? `, row: ${x.row}` : ''}${x.action ? `, onTap: () => app.run(${ds(x.action.action)}, ${dartValue(x.action.value)})` : ''}${x.children.length ? `, pins: [\n${x.children.map((c) => pad + '  ' + `Pin(${pinArgs(c.pin, ': ')}, child: ${dartElement(c, ind + 2)})`).join(',\n')},\n${pad}]` : ''})`;
    case 'space': return `PSpace(${x.h})`;
    case 'bar': return `PBar(${ds(x.var)}, max: ${x.max}, height: ${x.h}, fill: ${ds(tok(x.fill, '@accent'))}, bg: ${ds(tok(x.bg, '@line'))}, radius: ${x.radius})`;
    case 'slider': return `PSlider(${ds(x.var)}, min: ${x.min}, max: ${x.max}, step: ${x.step})`;
    case 'segmented': return `Segmented(${ds(x.var)}, [${x.options.map(ds).join(', ')}]${x.index ? ', index: true' : ''})`;
    case 'chips': return `Chips(${ds(x.var)}, [${x.options.map(ds).join(', ')}])`;
    case 'dropdown': return `PDropdown(${ds(x.var)}, [${x.options.map((o) => `(${ds(o.label)}, ${ds(o.value)})`).join(', ')}], placeholder: ${ds(x.placeholder)})`;
    case 'stepper': return `PStepper(${ds(x.var)}, min: ${x.min}, max: ${x.max}, step: ${x.step})`;
    case 'rating': return `PRating(${ds(x.var)}, max: ${x.max})`;
    case 'divider': return `PDivider(${x.label ? `label: ${ds(x.label)}` : ''})`;
    case 'avatar': return `PAvatar(${x.emoji ? `emoji: ${ds(x.emoji)}, ` : ''}size: ${x.size})`;
    case 'banner': return `PBanner(tone: ${ds(x.tone)}, title: ${ds(x.title)}, text: ${ds(x.text)}, icon: ${ds(x.icon)})`;
    case 'xpbar': return `XpBar(xpVar: ${ds(x.xpVar)}, levelVar: ${ds(x.levelVar)}, base: ${x.base}, growth: ${x.growth})`;
    case 'steps': return `PSteps(${ds(x.var)}, [${x.steps.map(ds).join(', ')}])`;
    case 'spinner': return 'const PSpinner()';
    case 'list': return `RecordList(collection: ${ds(x.collection)}, title: ${ds(x.title)}${x.subtitle ? `, subtitle: ${ds(x.subtitle)}` : ''}${x.icon ? `, icon: ${ds(x.icon)}` : ''}${x.check ? `, check: ${ds(x.check)}` : ''}${x.search ? `, search: ${ds(x.search)}` : ''}${x.filter ? `, filter: ${ds(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort: ${ds(x.sort)}` : ''}${x.openPage ? `, openPage: ${ds(x.openPage)}` : ''}, empty: ${ds(x.empty)}${listExtras(x, ': ', ds)})`;
    case 'form': return `RecordForm(collection: ${ds(x.collection)}${x.fields.length ? `, fields: [${x.fields.map(ds).join(', ')}]` : ''}, mode: FormMode.${{ new: 'newRecord', edit: 'editOpened', auto: 'auto' }[x.mode]}, saveLabel: ${ds(x.saveLabel)}${x.after !== 'go back' ? `, after: ${ds(x.after)}` : ''}${x.page ? `, page: ${ds(x.page)}` : ''})`;
    case 'input': return `VarField(${ds(x.var)}${x.placeholder ? `, placeholder: ${ds(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard: ${ds(x.keyboard)}` : ''}${x.outlined ? ', outlined: true' : ''})`;
    case 'toggle': return `VarSwitch(${ds(x.var)}${x.label ? `, label: ${ds(x.label)}` : ''})`;
    case 'items': return `StaticList([${x.items.map(ds).join(', ')}])`;
    case 'image': return `PImage(${ds(x.src)}, height: ${x.h})`;
    case 'row': return `PCard(children: [\n${x.children.map((c) => pad + '  ' + dartElement(c, ind + 2)).join(',\n')},\n${pad}])`;
    case 'feed': return `SocialFeed(collection: ${ds(x.collection)}${x.look !== 'timeline' ? `, look: ${ds(x.look)}` : ''}${x.filter ? `, filter: ${ds(x.filter)}` : ''}${x.search ? `, search: ${ds(x.search)}` : ''}${x.look === 'grid' && x.columns !== 3 ? `, columns: ${x.columns}` : ''}${x.profilePage ? `, profilePage: ${ds(x.profilePage)}` : ''}, empty: ${ds(x.empty)}${x.tabs?.length ? `, tabs: const [${x.tabs.map((t) => `FeedTab(${ds(t.label)}${t.only || t.look ? `, ${ds(t.only)}` : ''}${t.look ? `, ${ds(t.look)}` : ''})`).join(', ')}]` : ''}${x.actions ? `, actions: const [${x.actions.map(ds).join(', ')}]` : ''})`;
    case 'composer': return `Composer(collection: ${ds(x.collection)}, placeholder: ${ds(x.placeholder)})`;
    case 'stories': return `Stories(collection: ${ds(x.collection)}${x.yours === false ? ', yours: false' : ''})`;
    case 'inbox': return `Inbox(collection: ${ds(x.collection)}, openPage: ${ds(x.openPage)})`;
    case 'chat': return `Chat(collection: ${ds(x.collection)})`;
    case 'profile': return `ProfileHeader(name: ${ds(x.name)}, handle: ${ds(x.handle)}${x.bio ? `, bio: ${ds(x.bio)}` : ''}${x.stats.length ? `, stats: [${x.stats.map((s) => `(${ds(s.label)}, ${ds(s.value)})`).join(', ')}]` : ''}, cover: ${ds(tokenColor(x.cover) || '@accent')})`;
    case 'market': return `Marketplace(collection: ${ds(x.collection)}${x.chatPage ? `, chatPage: ${ds(x.chatPage)}` : ''})`;
    case 'activity': return `Activity(collection: ${ds(x.collection)}${x.profilePage ? `, profilePage: ${ds(x.profilePage)}` : ''})`;
    case 'people': return `People(collection: ${ds(x.collection)}${x.profilePage ? `, profilePage: ${ds(x.profilePage)}` : ''})`;
    case 'achievements': return 'const Achievements()';
    case 'trending': return `Trending(collection: ${ds(x.collection)}${x.searchVar ? `, searchVar: ${ds(x.searchVar)}` : ''})`;
    case 'chart': return `PChart(data: const [${x.data.map((d) => `(${ds(d.label)}, ${ds(d.value)})`).join(', ')}]${optArgs([['chart', x.chart, 'columns'], ['track', x.track, ''], ['every', x.every, 1], ['points', x.points, 30], ['title', x.title, ''], ['max', x.max, 0], ['values', x.values, true], ['labels', x.labels, true], ['grid', x.grid, true], ['color', x.color, '#4fa3ff'], ['text', x.text, ''], ['bg', x.bg, ''], ['height', x.h, 200]], ': ', ds)})`;
    case 'carousel': return `Carousel(${ds(x.var)}, const [\n${x.items.map((i) => `${pad}  CarouselItem(${ds(i.name)}, ${ds(i.icon)}, ${ds(i.value)}${i.lock ? `, lock: ${ds(i.lock)}` : ''}${i.desc ? `, desc: ${ds(i.desc)}` : ''}),`).join('\n')}\n${pad}]${optArgs([['cardWidth', x.cardWidth, 0.55], ['arrows', x.arrows, true], ['dots', x.dots, true], ['loop', x.loop, false], ['message', x.message, ''], ['card', x.card, '@card'], ['text', x.text, ''], ['accent', x.accent, '@accent'], ['height', x.h, 220]], ': ', ds)})`;
    case 'pager': return `Pager(${ds(x.var)}, pages: [\n${x.children.map((c) => pad + '  ' + dartElement(c, ind + 2)).join(',\n')},\n${pad}]${optArgs([['dots', x.dots, true], ['dotColor', x.dotColor, '@accent'], ['loop', x.loop, false], ['auto', x.auto, 0], ['message', x.message, 'slide'], ['height', x.h, 320]], ': ', ds)})`;
    case 'photogrid': return `PhotoGrid(${optArgs([['collection', x.collection, 'Posts'], ['field', x.field, 'media'], ['filter', x.filter, ''], ['columns', x.columns, 3], ['gap', x.gap, 2], ['radius', x.radius, 0], ['openPage', x.openPage, ''], ['message', x.message, '']], ': ', ds).slice(2)})`;
    case 'like': return `LikeButton(${ds(x.var)}${optArgs([['countVar', x.countVar, 'likes'], ['icon', x.icon, 'heart'], ['message', x.message, ''], ['on', x.on, '#f91880'], ['off', x.off, '@sub'], ['text', x.text, '@sub']], ': ', ds)})`;
    case 'ticker': return `Ticker(${ds(x.text)}${optArgs([['speed', x.speed, 60], ['direction', x.direction, 'left'], ['gap', x.gap, 60], ['size', x.size, 15], ['bg', x.bg, ''], ['color', x.color, ''], ['accent', x.accent, '#ffd23d'], ['height', x.h, 36]], ': ', ds)})`;
    case 'timer': return `PTimer(${optArgs([['seconds', x.seconds, 30], ['countUp', x.countUp, false], ['look', x.look, 'ring'], ['format', x.format, 'seconds'], ['autoStart', x.autoStart, true], ['message', x.message, 'timer'], ['endMessage', x.endMessage, ''], ['endAction', x.endAction, 'nothing else'], ['warnAt', x.warnAt, 5], ['variable', x.var, ''], ['color', x.color, '@accent'], ['warn', x.warn, '#ff4d5e'], ['track', x.track, '@line'], ['text', x.text, ''], ['size', x.size, 120]], ': ', ds).slice(2)})`;
    case 'skeleton': return `Skeleton(${optArgs([['layout', x.layout, 'avatar + lines'], ['lines', x.lines, 3], ['doneVar', x.doneVar, ''], ['radius', x.radius, 8]], ': ', ds).slice(2)})`;
    case 'colors': return `ColorSwatches(${ds(x.var)}, const [${x.colors.map(ds).join(', ')}]${optArgs([['columns', x.columns, 5], ['shape', x.shape, 'circle'], ['gap', x.gap, 10], ['ring', x.ring, '@text'], ['message', x.message, '']], ': ', ds)})`;
    case 'keypad': return `Keypad(${ds(x.var)}${optArgs([['maxLength', x.maxLength, 4], ['mask', x.mask, false], ['answer', x.answer, ''], ['rightMessage', x.rightMessage, ''], ['wrongMessage', x.wrongMessage, ''], ['enterMessage', x.enterMessage, ''], ['autoEnter', x.autoEnter, true], ['display', x.display, true], ['keyStyle', x.keyStyle, 'round'], ['keyColor', x.keyColor, '@field'], ['text', x.text, ''], ['accent', x.accent, '@good'], ['displayBg', x.displayBg, '']], ': ', ds)})`;
    case 'selector': return `Selector(${ds(x.var)}, const [${x.options.map(ds).join(', ')}]${x.wrap ? '' : ', wrap: false'})`;
    case 'overlay': return `PPopup(${optArgs([['mode', x.mode, 'popup'], ['openOn', x.openOn, 'popup'], ['closeOn', x.closeOn, 'close'], ['startOpen', x.startOpen, false], ['autoClose', x.autoClose, 0], ['tapCloses', x.tapCloses, false], ['dim', x.dim, true], ['handle', x.handle, true]], ': ', ds).slice(2)}, child: ${dartElement(x.box, ind + 2)})`;
    default: return `TodoBox(${ds(x.name)}, ${ds(x.type)}) /* TODO: build the ${x.type} natively */`;
  }
}

function dartPage(p, cls, model) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = [];
  let bottom = false;
  for (const x of p.items) {
    const pl = placeOf(x), code = pl ? `Place(fx: ${pl.fx}, width: ${pl.w}, child: ${dartElement(x, 8)})` : dartElement(x, 8);
    if (fills && x.fill && (x.kind === 'list' || x.kind === 'form')) parts.push(`Expanded(child: ${code})`);
    else parts.push(code);
    if (x.kind === 'button' && x.pin?.fy === 1) bottom = true; // (a button anchored to the bottom of the page)
  }
  // buttons that sit at the bottom of a page without a list: pushed down with a Spacer
  if (!fills && bottom) { const i = parts.findIndex((_, k) => p.items[k].kind === 'button' && p.items[k].pin?.fy === 1); if (i > 0) parts.splice(i, 0, 'const Spacer()'); }
  const scroll = !fills && !(bottom && parts.includes('const Spacer()'));
  const fab = p.fab ? `\n      fab: FloatingActionButton(onPressed: () => app.run(${ds(p.fab.action)}, ${dartValue(p.fab.value)}), child: const Icon(Icons.add)),` : '';
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
import 'package:flutter/material.dart';

import '../pocket.dart';

class ${cls} extends StatelessWidget {
  const ${cls}({super.key});

  @override
  Widget build(BuildContext context) => PocketPage(
      title: ${ds(p.title)},
      page: ${ds(p.value)},${model.appBar ? '' : '\n      appBar: false,'}${scroll ? '' : '\n      scroll: false,'}${fab}
      body: (context) => [
${parts.map((c) => '        ' + c + ',').join('\n')}
      ],
    );
}
`;
}

const dartBar = (m) => { const b = m.bar; if (!b) return 'const BarStyle()';
  return `const BarStyle(look: ${ds(b.look)}, brandPages: [${b.brandPages.map(ds).join(', ')}], center: ${b.align === 'center'}, avatar: ${b.avatar}, left: ${ds(b.left || 'back, else menu')}, circles: ${ds(b.circles || 'plain')}, actions: [${b.actions.map((a) => `BarAction(${ds(a.icon)}, ${ds(a.does)}${a.badge ? `, badge: ${ds(a.badge)}` : ''}${a.only.length ? `, only: [${a.only.map(ds).join(', ')}]` : ''})`).join(', ')}], bg: ${ds(tok(b.bg, '@bar'))}, text: ${ds(tok(b.text, '@text'))}, icon: ${ds(tok(b.icon, '@text'))}, border: ${b.border}, size: ${b.size})`; };
/** A Side Menu row's target: the page, the message, or the variable a switch changes. */
const menuTo = (i) => i.page ?? i.msg ?? i.var ?? '';
const dartMenu = (m) => { const M = m.menu; if (!M) return 'null';
  const it = (i) => `MenuItem(${ds(i.kind)}, ${ds(i.label || '')}${i.icon ? `, icon: ${ds(i.icon)}` : ''}${menuTo(i) ? `, to: ${ds(menuTo(i))}` : ''}${i.badge ? `, badge: ${ds(i.badge)}` : ''})`;
  return `const SideMenuStyle(side: ${ds(M.side)}, title: ${ds(M.title)}, subtitle: ${ds(M.subtitle)}, avatar: ${ds(M.avatar)}, header: ${ds(M.header)}, social: ${M.social}, profilePage: ${ds(M.profilePage)}, items: [${M.items.map(it).join(', ')}], footer: [${M.footer.map(it).join(', ')}], footerText: ${ds(M.footerText)}, bg: ${ds(tok(M.bg, '@card'))}, text: ${ds(tok(M.text, '@text'))}, accent: ${ds(tok(M.accent, '@accent'))}, badge: ${ds(tok(M.badge, '#ff3b5c'))}, width: ${M.width})`; };
const dartNav = (m) => (m.nav ? `const NavStyle(style: ${ds(m.nav.style)}, labels: ${ds(m.nav.labels || 'always')}, margin: ${+m.nav.margin || 0}, on: ${ds(tok(m.nav.on, '#ffffff'))}, bar: ${ds(tok(m.nav.bar, '@bar'))}, active: ${ds(tok(m.nav.active, '@accent'))}, idle: ${ds(tok(m.nav.idle, '@sub'))})` : 'const NavStyle()');

function dartMain(model, N) {
  const pal = (P) => `Palette({${Object.entries(P).map(([k, v]) => `${ds(k)}: Color(${hexArgb(v)})`).join(', ')}})`;
  const light = { ...PALETTES.light, accent: model.accent || PALETTES.light.accent }, dark = { ...PALETTES.dark, accent: model.accent || PALETTES.dark.accent };
  const field = (f) => `Field(${ds(f.key)}, ${ds(f.name)}, ${ds(f.type)}${f.options.length ? `, options: [${f.options.map(ds).join(', ')}]` : ''}${f.def !== '' && f.def != null ? `, def: ${dartValue(f.def)}` : ''})`;
  const row = (r) => `{${Object.entries(r).map(([k, v]) => `${ds(k)}: ${dartValue(v)}`).join(', ')}}`;
  return `// ${model.name}: a native Flutter app, made by Pocket Engine's native export.
// lib/pocket.dart has the app's state and building blocks; lib/pages/ has one file per page.
import 'package:flutter/material.dart';

import 'pocket.dart';
${model.pages.map((p) => `import 'pages/${snake(N[p.value])}.dart';`).join('\n')}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  artIcons = const {${barIcons(model).filter((n) => NAV_ART[n]).map((n) => `\n    ${ds(n)}: [${NAV_ART[n].map(ds).join(', ')}],`).join('')}${barIcons(model).some((n) => NAV_ART[n]) ? '\n  ' : ''}}; // the App Bar's and Bottom Nav's icons, drawn like the editor's
  app = AppState(
    name: ${ds(model.name)},
    home: ${ds(model.home)},
    themeSetting: ${ds(model.theme)},
    light: const ${pal(light)},
    dark: const ${pal(dark)},
    vars: {${Object.entries(model.vars).map(([k, v]) => `${ds(k)}: ${dartValue(v)}`).join(', ')}},
    tabs: const [${model.tabs.map((t) => `\n      NavTab(${ds(t.label)}, Icons.${iconFor(t.icon, 0)}, ${ds(t.page)}, name: ${ds(t.icon)}${t.badge ? `, badge: ${ds(t.badge)}` : ''}),`).join('')}${model.tabs.length ? '\n    ' : ''}],
    collections: const [${model.collections.map((c) => `\n      Collection(${ds(c.name)}, [${c.fields.map(field).join(', ')}]${c.rows.length ? `, sample: [${c.rows.map(row).join(', ')}]` : ''}),`).join('')}${model.collections.length ? '\n    ' : ''}],
    bar: ${dartBar(model)},
    nav: ${dartNav(model)},
    menu: ${dartMenu(model)},${model.notify ? `\n    notify: const NotifyStyle(${optArgs([['listen', model.notify.listen, 'notify'], ['position', model.notify.position, 'top'], ['look', model.notify.look, 'card'], ['seconds', model.notify.seconds, 3], ['max', model.notify.max, 3], ['bg', model.notify.bg, '#1e2235'], ['text', model.notify.text, '#ffffff'], ['accent', model.notify.accent, '#ffd23d']], ': ', ds).slice(2)}),` : ''}
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
export function dartSetup(o, pkg) {
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
  const parts = model.todo;
  const todo = parts.length ? `\n## Still to build\n\nThese parts of your app have no native version yet. Each is drawn as its card (its shape, colours, text and what's inside) without its own behaviour, or as a placeholder (search the code for \`TODO\`) when it has no card:\n\n${[...new Map(parts.map((t) => [t.name, t])).values()].map((t) => `- **${t.name}** (${t.type})`).join('\n')}\n` : '';
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
    case 'text': return `PText(${ss(x.value)}${x.size !== 16 ? `, size: ${x.size}` : ''}${x.weight !== '600' ? `, weight: ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color: ${ss(tokenColor(x.color))}` : ''}${x.align && x.align !== 'left' ? `, align: ${ss(x.align)}` : ''})`;
    case 'box': return `PBox(w: ${x.w || 368}, h: ${x.h}${x.radius ? `, radius: ${x.radius}` : ''}${tokenColor(x.fill) ? `, fill: ${ss(x.fill)}` : ''}${tokenColor(x.stroke) ? `, stroke: ${ss(x.stroke)}, strokeW: ${x.strokeW || 1}` : ''}${x.shadow ? ', shadow: true' : ''}${x.text ? `, text: ${ss(x.text.value)}, textSize: ${x.text.size}, textWeight: ${parseInt(x.text.weight, 10) || 600}${tokenColor(x.text.color) ? `, textColor: ${ss(x.text.color)}` : ''}` : ''}${x.row != null ? `, row: ${x.row}` : ''}${x.action ? `, onTap: { app.run(${ss(x.action.action)}, ${swiftVal(x.action.value)}) }` : ''}${x.children.length ? `, pins: [\n${x.children.map((c) => pad + '    ' + `Pin(${pinArgs(c.pin, ': ')}) { ${swiftElement(c, ind + 4)} }`).join(',\n')},\n${pad}]` : ''})`;
    case 'space': return `PSpace(${x.h})`;
    case 'bar': return `PBar(${ss(x.var)}, max: ${x.max}, height: ${x.h}, fill: ${ss(tok(x.fill, '@accent'))}, bg: ${ss(tok(x.bg, '@line'))}, radius: ${x.radius})`;
    case 'slider': return `PSlider(${ss(x.var)}, min: ${x.min}, max: ${x.max}, step: ${x.step})`;
    case 'segmented': return `Segmented(${ss(x.var)}, [${x.options.map(ss).join(', ')}]${x.index ? ', index: true' : ''})`;
    case 'chips': return `Chips(${ss(x.var)}, [${x.options.map(ss).join(', ')}])`;
    case 'dropdown': return `PDropdown(${ss(x.var)}, [${x.options.map((o) => `(${ss(o.label)}, ${ss(o.value)})`).join(', ')}], placeholder: ${ss(x.placeholder)})`;
    case 'stepper': return `PStepper(${ss(x.var)}, min: ${x.min}, max: ${x.max}, step: ${x.step})`;
    case 'rating': return `PRating(${ss(x.var)}, max: ${x.max})`;
    case 'divider': return `PDivider(${x.label ? ss(x.label) : ''})`;
    case 'avatar': return `PAvatar(${x.emoji ? `emoji: ${ss(x.emoji)}, ` : ''}size: ${x.size})`;
    case 'banner': return `PBanner(tone: ${ss(x.tone)}, title: ${ss(x.title)}, text: ${ss(x.text)}, icon: ${ss(x.icon)})`;
    case 'xpbar': return `XpBar(xpVar: ${ss(x.xpVar)}, levelVar: ${ss(x.levelVar)}, base: ${x.base}, growth: ${x.growth})`;
    case 'steps': return `PSteps(${ss(x.var)}, [${x.steps.map(ss).join(', ')}])`;
    case 'spinner': return 'PSpinner()';
    case 'button': return `PButton(${ss(x.label)}${x.plain ? ', look: .plain' : x.outlined ? `, look: ${/danger/.test(x.color) ? '.danger' : '.outlined'}` : ''}${btnExtras(x, ': ', ss)}) { app.run(${ss(x.action)}, ${swiftVal(x.value)}${x.amount !== 1 && x.amount != null ? `, ${+x.amount || 0}` : ''}) }`;
    case 'list': return `RecordList(collection: ${ss(x.collection)}, title: ${ss(x.title)}${x.subtitle ? `, subtitle: ${ss(x.subtitle)}` : ''}${x.right ? `, right: ${ss(x.right)}` : ''}${x.icon ? `, icon: ${ss(x.icon)}` : ''}${x.check ? `, check: ${ss(x.check)}` : ''}${x.search ? `, search: ${ss(x.search)}` : ''}${x.filter ? `, filter: ${ss(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort: ${ss(x.sort)}` : ''}${x.openPage ? `, openPage: ${ss(x.openPage)}` : ''}, empty: ${ss(x.empty)}${listExtras(x, ': ', ss, false)})`;
    case 'form': return `RecordForm(collection: ${ss(x.collection)}${x.fields.length ? `, fields: [${x.fields.map(ss).join(', ')}]` : ''}, mode: .${{ new: 'newRecord', edit: 'editOpened', auto: 'auto' }[x.mode]}, saveLabel: ${ss(x.saveLabel)}${x.after !== 'go back' ? `, after: ${ss(x.after)}` : ''}${x.page ? `, page: ${ss(x.page)}` : ''})`;
    case 'input': return `VarField(${ss(x.var)}${x.placeholder ? `, placeholder: ${ss(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard: ${ss(x.keyboard)}` : ''}${x.outlined ? ', outlined: true' : ''})`;
    case 'toggle': return `VarSwitch(${ss(x.var)}${x.label ? `, label: ${ss(x.label)}` : ''})`;
    case 'items': return `StaticList([${x.items.map(ss).join(', ')}])`;
    case 'image': return `PImage(${ss(x.src)}, height: ${x.h})`;
    case 'row': return `PCard {\n${x.children.map((c) => pad + '    ' + swiftElement(c, ind + 4)).join('\n')}\n${pad}}`;
    case 'feed': return `SocialFeed(collection: ${ss(x.collection)}${x.look !== 'timeline' ? `, look: ${ss(x.look)}` : ''}${x.filter ? `, filter: ${ss(x.filter)}` : ''}${x.search ? `, search: ${ss(x.search)}` : ''}${x.look === 'grid' && x.columns !== 3 ? `, columns: ${x.columns}` : ''}${x.profilePage ? `, profilePage: ${ss(x.profilePage)}` : ''}, empty: ${ss(x.empty)}${x.tabs?.length ? `, tabs: [${x.tabs.map((t) => `FeedTab(${ss(t.label)}${t.only || t.look ? `, ${ss(t.only)}` : ''}${t.look ? `, ${ss(t.look)}` : ''})`).join(', ')}]` : ''}${x.actions ? `, actions: [${x.actions.map(ss).join(', ')}]` : ''})`;
    case 'composer': return `Composer(collection: ${ss(x.collection)}, placeholder: ${ss(x.placeholder)})`;
    case 'stories': return `Stories(collection: ${ss(x.collection)}${x.yours === false ? ', yours: false' : ''})`;
    case 'inbox': return `Inbox(collection: ${ss(x.collection)}, openPage: ${ss(x.openPage)})`;
    case 'chat': return `Chat(collection: ${ss(x.collection)})`;
    case 'profile': return `ProfileHeader(name: ${ss(x.name)}, handle: ${ss(x.handle)}${x.bio ? `, bio: ${ss(x.bio)}` : ''}${x.stats.length ? `, stats: [${x.stats.map((s) => `(${ss(s.label)}, ${ss(s.value)})`).join(', ')}]` : ''}, cover: ${ss(tokenColor(x.cover) || '@accent')})`;
    case 'market': return `Marketplace(collection: ${ss(x.collection)}${x.chatPage ? `, chatPage: ${ss(x.chatPage)}` : ''})`;
    case 'activity': return `Activity(collection: ${ss(x.collection)}${x.profilePage ? `, profilePage: ${ss(x.profilePage)}` : ''})`;
    case 'people': return `People(collection: ${ss(x.collection)}${x.profilePage ? `, profilePage: ${ss(x.profilePage)}` : ''})`;
    case 'achievements': return 'Achievements()';
    case 'trending': return `Trending(collection: ${ss(x.collection)}${x.searchVar ? `, searchVar: ${ss(x.searchVar)}` : ''})`;
    case 'chart': return `PChart(data: [${x.data.map((d) => `(${ss(d.label)}, ${ss(d.value)})`).join(', ')}]${optArgs([['chart', x.chart, 'columns'], ['track', x.track, ''], ['every', x.every, 1], ['points', x.points, 30], ['title', x.title, ''], ['max', x.max, 0], ['values', x.values, true], ['labels', x.labels, true], ['grid', x.grid, true], ['color', x.color, '@accent'], ['text', x.text, ''], ['bg', x.bg, ''], ['height', x.h, 200]], ': ', ss, SN)})`;
    case 'carousel': return `Carousel(${ss(x.var)}, [\n${x.items.map((i) => `${pad}    CarouselItem(${ss(i.name)}, ${ss(i.icon)}, ${ss(i.value)}${i.lock ? `, lock: ${ss(i.lock)}` : ''}${i.desc ? `, desc: ${ss(i.desc)}` : ''}),`).join('\n')}\n${pad}]${optArgs([['cardWidth', x.cardWidth, 0.55], ['arrows', x.arrows, true], ['dots', x.dots, true], ['loop', x.loop, false], ['message', x.message, ''], ['card', x.card, '@card'], ['text', x.text, ''], ['accent', x.accent, '@accent'], ['height', x.h, 220]], ': ', ss, SN)})`;
    case 'pager': return `Pager(${ss(x.var)}${optArgs([['dots', x.dots, true], ['dotColor', x.dotColor, '@accent'], ['loop', x.loop, false], ['auto', x.auto, 0], ['message', x.message, 'slide'], ['height', x.h, 320]], ': ', ss, SN)}, pages: [\n${x.children.map((c) => `${pad}    AnyView(${swiftElement(c, ind + 4)}),`).join('\n')}\n${pad}])`;
    case 'photogrid': return `PhotoGrid(${optArgs([['collection', x.collection, 'Posts'], ['field', x.field, 'media'], ['filter', x.filter, ''], ['columns', x.columns, 3], ['gap', x.gap, 2], ['radius', x.radius, 0], ['openPage', x.openPage, ''], ['message', x.message, '']], ': ', ss, SN).slice(2)})`;
    case 'like': return `LikeButton(${ss(x.var)}${optArgs([['countVar', x.countVar, 'likes'], ['icon', x.icon, 'heart'], ['message', x.message, ''], ['on', x.on, '#f91880'], ['off', x.off, '@sub'], ['text', x.text, '@sub']], ': ', ss)})`;
    case 'ticker': return `Ticker(${ss(x.text)}${optArgs([['speed', x.speed, 60], ['direction', x.direction, 'left'], ['gap', x.gap, 60], ['size', x.size, 15], ['bg', x.bg, ''], ['color', x.color, ''], ['accent', x.accent, '#ffd23d'], ['height', x.h, 36]], ': ', ss, SN)})`;
    case 'timer': return `PTimer(${optArgs([['seconds', x.seconds, 30], ['countUp', x.countUp, false], ['look', x.look, 'ring'], ['format', x.format, 'seconds'], ['autoStart', x.autoStart, true], ['message', x.message, 'timer'], ['endMessage', x.endMessage, ''], ['endAction', x.endAction, 'nothing else'], ['warnAt', x.warnAt, 5], ['variable', x.var, ''], ['color', x.color, '@accent'], ['warn', x.warn, '#ff4d5e'], ['track', x.track, '@line'], ['text', x.text, ''], ['size', x.size, 120]], ': ', ss, SN).slice(2)})`;
    case 'skeleton': return `Skeleton(${optArgs([['layout', x.layout, 'avatar + lines'], ['lines', x.lines, 3], ['doneVar', x.doneVar, ''], ['radius', x.radius, 8]], ': ', ss, SN).slice(2)})`;
    case 'colors': return `ColorSwatches(${ss(x.var)}, [${x.colors.map(ss).join(', ')}]${optArgs([['columns', x.columns, 5], ['shape', x.shape, 'circle'], ['gap', x.gap, 10], ['ring', x.ring, '@text'], ['message', x.message, '']], ': ', ss, SN)})`;
    case 'keypad': return `Keypad(${ss(x.var)}${optArgs([['maxLength', x.maxLength, 4], ['mask', x.mask, false], ['answer', x.answer, ''], ['rightMessage', x.rightMessage, ''], ['wrongMessage', x.wrongMessage, ''], ['enterMessage', x.enterMessage, ''], ['autoEnter', x.autoEnter, true], ['display', x.display, true], ['keyStyle', x.keyStyle, 'round'], ['keyColor', x.keyColor, '@field'], ['text', x.text, ''], ['accent', x.accent, '@good'], ['displayBg', x.displayBg, '']], ': ', ss, SN)})`;
    case 'selector': return `Selector(${ss(x.var)}, [${x.options.map(ss).join(', ')}]${x.wrap ? '' : ', wrap: false'})`;
    case 'overlay': return `PPopup(${optArgs([['mode', x.mode, 'popup'], ['openOn', x.openOn, 'popup'], ['closeOn', x.closeOn, 'close'], ['startOpen', x.startOpen, false], ['autoClose', x.autoClose, 0], ['tapCloses', x.tapCloses, false], ['dim', x.dim, true], ['handle', x.handle, true]], ': ', ss, SN).slice(2)}) {\n${pad}    ${swiftElement(x.box, ind + 4)}\n${pad}}`;
    default: return `TodoBox(${ss(x.name)}, ${ss(x.type)}) // TODO: build the ${x.type} natively`;
  }
}

const swiftMenu = (m) => { const M = m.menu; if (!M) return 'nil';
  const it = (i) => `MenuItem(kind: ${ss(i.kind)}, label: ${ss(i.label || '')}${i.icon ? `, icon: ${ss(i.icon)}` : ''}${menuTo(i) ? `, to: ${ss(menuTo(i))}` : ''}${i.badge ? `, badge: ${ss(i.badge)}` : ''})`;
  return `SideMenuStyle(side: ${ss(M.side)}, title: ${ss(M.title)}, subtitle: ${ss(M.subtitle)}, avatar: ${ss(M.avatar)}, header: ${ss(M.header)}, social: ${M.social}, profilePage: ${ss(M.profilePage)}, items: [${M.items.map(it).join(', ')}], footer: [${M.footer.map(it).join(', ')}], footerText: ${ss(M.footerText)}, bg: ${ss(tok(M.bg, '@card'))}, text: ${ss(tok(M.text, '@text'))}, accent: ${ss(tok(M.accent, '@accent'))}, badge: ${ss(tok(M.badge, '#ff3b5c'))}, width: ${M.width})`; };
const swiftBar = (m) => { const b = m.bar; if (!b) return 'BarStyle()';
  return `BarStyle(look: ${ss(b.look)}, brandPages: [${b.brandPages.map(ss).join(', ')}], center: ${b.align === 'center'}, avatar: ${b.avatar}, left: ${ss(b.left || 'back, else menu')}, circles: ${ss(b.circles || 'plain')}, actions: [${b.actions.map((a) => `BarAction(icon: ${ss(a.icon)}, does: ${ss(a.does)}${a.badge ? `, badge: ${ss(a.badge)}` : ''}${a.only.length ? `, only: [${a.only.map(ss).join(', ')}]` : ''})`).join(', ')}], bg: ${ss(tok(b.bg, '@bar'))}, text: ${ss(tok(b.text, '@text'))}, icon: ${ss(tok(b.icon, '@text'))}, border: ${b.border}, size: ${b.size})`; };

function swiftPage(p, cls, model) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = p.items.map((x) => { const pl = placeOf(x), code = swiftElement(x, 12); return pl ? `Place(fx: ${pl.fx}, width: ${pl.w}) { ${code} }` : code; });
  const firstBtn = p.items.findIndex((x) => x.kind === 'button' && x.pin?.fy === 1); // (buttons anchored to the bottom of the page sit at the bottom)
  if (!fills && firstBtn > 0) parts.splice(firstBtn, 0, 'Spacer()');
  const scroll = !fills && firstBtn <= 0;
  const fab = p.fab ? `, fab: (action: ${ss(p.fab.action)}, value: ${swiftVal(p.fab.value)})` : '';
  return `// ${p.name}: made by Pocket Engine's native export. Change anything you like.
import SwiftUI

struct ${cls}: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        PocketPage(title: ${ss(p.title)}, page: ${ss(p.value)}${scroll ? '' : ', scroll: false'}${fab}) {
${(parts.length > 9 ? groups(parts, 8).map((g) => `Group {\n${g.map((c) => '                ' + c).join('\n')}\n            }`) : parts).map((c) => '            ' + c).join('\n')}
        }
    }
}
`;
}
/** SwiftUI takes up to 10 views in a block (iOS 16): longer pages go in Groups. */
const groups = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function swiftApp(model, N, appName) {
  const hex = (h) => '0x' + String(h).replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const pal = (P) => `Palette(c: [${Object.entries(P).map(([k, v]) => `${ss(k)}: Color(hex: ${hex(v)})`).join(', ')}])`;
  const light = { ...PALETTES.light, accent: model.accent || PALETTES.light.accent }, dark = { ...PALETTES.dark, accent: model.accent || PALETTES.dark.accent };
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
        tabs: [${model.tabs.map((t) => `\n            NavTab(label: ${ss(t.label)}, icon: ${ss(iconFor(t.icon, 1))}, page: ${ss(t.page)}${t.badge ? `, badge: ${ss(t.badge)}` : ''}, name: ${ss(t.icon)}),`).join('')}${model.tabs.length ? '\n        ' : ''}],
        collections: [${model.collections.map((c) => `\n            Collection(name: ${ss(c.name)}, fields: [${c.fields.map(field).join(', ')}]${c.rows.length ? `, sample: [${c.rows.map(row).join(', ')}]` : ''}),`).join('')}${model.collections.length ? '\n        ' : ''}],
        stats: [${model.stats.map((s) => `\n            Stat(variable: ${ss(s.var)}, collection: ${ss(s.collection)}, how: ${ss(s.how)}${s.field && s.field !== 'field' ? `, field: ${ss(s.field)}` : ''}${s.filter ? `, filter: ${ss(s.filter)}` : ''}),`).join('')}${model.stats.length ? '\n        ' : ''}],
        bar: ${swiftBar(model)},
        nav: ${model.nav ? `NavStyle(style: ${ss(model.nav.style)}, bar: ${ss(tok(model.nav.bar, '@bar'))}, active: ${ss(tok(model.nav.active, '@accent'))}, idle: ${ss(tok(model.nav.idle, '@sub'))}, labels: ${ss(model.nav.labels || 'always')}, margin: ${+model.nav.margin || 0}, on: ${ss(tok(model.nav.on, '#ffffff'))})` : 'NavStyle()'},
        menu: ${swiftMenu(model)}${model.notify ? `,\n        notify: NotifyStyle(${optArgs([['listen', model.notify.listen, 'notify'], ['position', model.notify.position, 'top'], ['look', model.notify.look, 'card'], ['seconds', model.notify.seconds, 3], ['max', model.notify.max, 3], ['bg', model.notify.bg, '#1e2235'], ['text', model.notify.text, '#ffffff'], ['accent', model.notify.accent, '#ffd23d']], ': ', ss, (v, k) => (k === 'max' ? String(Math.round(v)) : String(v))).slice(2)})` : ''}
    )

    init() { artIcons = [${barIcons(model).filter((n) => NAV_ART[n]).map((n) => `\n        ${ss(n)}: [${NAV_ART[n].map(ss).join(', ')}],`).join('') || ':'}${barIcons(model).some((n) => NAV_ART[n]) ? '\n    ' : ''}] } // the App Bar's and Bottom Nav's icons, drawn like the editor's

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
