// Native Kotlin export: an app project written out as a Kotlin Multiplatform app with Compose Multiplatform, so one Kotlin
// codebase (the UI too) runs on Android and iOS. Same model as the Flutter / SwiftUI exports (appmodel.js): pages, the
// App Bar, the Bottom Nav, text, buttons, Data Lists, Forms, inputs, switches and data become Compose code over a fixed
// runtime (editor/native/kotlin/Pocket.kt); anything else is a TODO placeholder.
import { appModel, PALETTES, barIcons } from './appmodel.js';
import { NAV_ART } from './navart.js';
import { nativeReadme, names, listExtras, pinArgs, placeOf, btnExtras, menuTo, optArgs } from './nativecode.js';
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

const kf = (v) => `${+v}f`, kd = (v) => (Number.isInteger(+v) ? `${+v}.0` : String(+v));
/** Number arguments by name: Double (1.0), Float (1f) or Int (1, the rest), as the runtime's parameter is. */
const KN = (by) => (v, k) => String((by[k] || Math.round)(v));

export function kElement(x, ind, fill) {
  const pad = ' '.repeat(ind), mod = fill ? ', modifier = Modifier.weight(1f)' : '';
  switch (x.kind) {
    case 'text': return `PText(${ks(x.value)}${x.size !== 16 ? `, size = ${Math.round(x.size)}` : ''}${x.weight !== '600' ? `, weight = ${parseInt(x.weight, 10) || 600}` : ''}${tokenColor(x.color) ? `, color = ${ks(tokenColor(x.color))}` : ''}${x.align && x.align !== 'left' ? `, align = ${ks(x.align)}` : ''})`;
    case 'box': return `PBox(w = ${Math.round(x.w || 368)}, h = ${Math.round(x.h)}${x.radius ? `, radius = ${Math.round(x.radius)}` : ''}${tokenColor(x.fill) ? `, fill = ${ks(x.fill)}` : ''}${tokenColor(x.stroke) ? `, stroke = ${ks(x.stroke)}, strokeW = ${Math.round(x.strokeW || 1)}` : ''}${x.shadow ? ', shadow = true' : ''}${x.text ? `, text = ${ks(x.text.value)}, textSize = ${Math.round(x.text.size)}, textWeight = ${parseInt(x.text.weight, 10) || 600}${tokenColor(x.text.color) ? `, textColor = ${ks(x.text.color)}` : ''}` : ''}${x.row != null ? `, row = ${Math.round(x.row)}` : ''}${x.action ? `, onTap = { app.run(${ks(x.action.action)}, ${kv(x.action.value)}) }` : ''}${x.children.length ? `, pins = listOf(\n${x.children.map((c) => pad + '    ' + `Pin(${pinArgs(c.pin, ' = ', kf)}) { ${kElement(c, ind + 4, false)} }`).join(',\n')},\n${pad})` : ''})`;
    case 'space': return `PSpace(${Math.round(x.h)})`;
    case 'bar': return `PBar(${ks(x.var)}, max = ${kd(x.max)}, height = ${Math.round(x.h)}, fill = ${ks(tokenColor(x.fill) || '@accent')}, bg = ${ks(tokenColor(x.bg) || '@line')}, radius = ${Math.round(x.radius)})`;
    case 'slider': return `PSlider(${ks(x.var)}, min = ${kd(x.min)}, max = ${kd(x.max)}, step = ${kd(x.step)})`;
    case 'segmented': return `Segmented(${ks(x.var)}, listOf(${x.options.map(ks).join(', ')})${x.index ? ', index = true' : ''})`;
    case 'chips': return `Chips(${ks(x.var)}, listOf(${x.options.map(ks).join(', ')}))`;
    case 'dropdown': return `PDropdown(${ks(x.var)}, listOf(${x.options.map((o) => `${ks(o.label)} to ${ks(o.value)}`).join(', ')}), placeholder = ${ks(x.placeholder)})`;
    case 'stepper': return `PStepper(${ks(x.var)}, min = ${kd(x.min)}, max = ${kd(x.max)}, step = ${kd(x.step)})`;
    case 'rating': return `PRating(${ks(x.var)}, max = ${Math.round(x.max)})`;
    case 'divider': return `PDivider(${x.label ? ks(x.label) : ''})`;
    case 'avatar': return `PAvatar(${x.emoji ? `emoji = ${ks(x.emoji)}, ` : ''}size = ${Math.round(x.size)})`;
    case 'banner': return `PBanner(tone = ${ks(x.tone)}, title = ${ks(x.title)}, text = ${ks(x.text)}, icon = ${ks(x.icon)})`;
    case 'xpbar': return `XpBar(xpVar = ${ks(x.xpVar)}, levelVar = ${ks(x.levelVar)}, base = ${kd(x.base)}, growth = ${kd(x.growth)})`;
    case 'steps': return `PSteps(${ks(x.var)}, listOf(${x.steps.map(ks).join(', ')}))`;
    case 'spinner': return 'PSpinner()';
    case 'button': return `PButton(${ks(x.label)}${x.plain ? ', look = Look.Plain' : x.outlined ? `, look = ${/danger/.test(x.color) ? 'Look.Danger' : 'Look.Outlined'}` : ''}${btnExtras({ ...x, h: x.h && Math.round(x.h), radius: x.radius != null ? Math.round(x.radius) : x.radius, size: x.size && Math.round(x.size) }, ' = ', ks)}) { app.run(${ks(x.action)}, ${kv(x.value)}${x.amount !== 1 && x.amount != null ? `, ${kv(+x.amount || 0)}` : ''}) }`;
    case 'list': return `RecordList(${ks(x.collection)}${mod}, title = ${ks(x.title)}${x.subtitle ? `, subtitle = ${ks(x.subtitle)}` : ''}${x.icon ? `, icon = ${ks(x.icon)}` : ''}${x.check ? `, check = ${ks(x.check)}` : ''}${x.search ? `, search = ${ks(x.search)}` : ''}${x.filter ? `, filter = ${ks(x.filter)}` : ''}${x.sort !== 'newest first' ? `, sort = ${ks(x.sort)}` : ''}${x.openPage ? `, openPage = ${ks(x.openPage)}` : ''}, empty = ${ks(x.empty)}${listExtras(x, ' = ', ks)})`;
    case 'form': return `RecordForm(${ks(x.collection)}${mod}${x.fields.length ? `, fields = listOf(${x.fields.map(ks).join(', ')})` : ''}, mode = FormMode.${{ new: 'NewRecord', edit: 'EditOpened', auto: 'Auto' }[x.mode]}, saveLabel = ${ks(x.saveLabel)}${x.after !== 'go back' ? `, after = ${ks(x.after)}` : ''}${x.page ? `, page = ${ks(x.page)}` : ''})`;
    case 'input': return `VarField(${ks(x.var)}${x.placeholder ? `, placeholder = ${ks(x.placeholder)}` : ''}${x.keyboard !== 'text' ? `, keyboard = ${ks(x.keyboard)}` : ''}${x.outlined ? ', outlined = true' : ''})`;
    case 'toggle': return `VarSwitch(${ks(x.var)}${x.label ? `, label = ${ks(x.label)}` : ''})`;
    case 'items': return `StaticList(listOf(${x.items.map(ks).join(', ')}))`;
    case 'image': return `TodoBox("Picture", "image") // TODO: show ${x.src.slice(0, 60)} (add an image library such as Coil 3)`;
    case 'row': return `PCard {\n${x.children.map((c) => pad + '    ' + kElement(c, ind + 4, false)).join('\n')}\n${pad}}`;
    case 'feed': return `SocialFeed(${ks(x.collection)}${x.look !== 'timeline' ? `, look = ${ks(x.look)}` : ''}${x.filter ? `, filter = ${ks(x.filter)}` : ''}${x.search ? `, search = ${ks(x.search)}` : ''}${x.look === 'grid' && x.columns !== 3 ? `, columns = ${x.columns}` : ''}${x.profilePage ? `, profilePage = ${ks(x.profilePage)}` : ''}, empty = ${ks(x.empty)}${x.tabs?.length ? `, tabs = listOf(${x.tabs.map((t) => `FeedTab(${ks(t.label)}${t.only || t.look ? `, ${ks(t.only)}` : ''}${t.look ? `, ${ks(t.look)}` : ''})`).join(', ')})` : ''}${x.actions ? `, actions = listOf(${x.actions.map(ks).join(', ')})` : ''})`;
    case 'composer': return `Composer(${ks(x.collection)}, placeholder = ${ks(x.placeholder)})`;
    case 'stories': return `Stories(${ks(x.collection)}${x.yours === false ? ', yours = false' : ''})`;
    case 'inbox': return `Inbox(${ks(x.collection)}, openPage = ${ks(x.openPage)})`;
    case 'chat': return `Chat(${ks(x.collection)})`;
    case 'profile': return `ProfileHeader(name = ${ks(x.name)}, handle = ${ks(x.handle)}${x.bio ? `, bio = ${ks(x.bio)}` : ''}${x.stats.length ? `, stats = listOf(${x.stats.map((s) => `${ks(s.label)} to ${ks(s.value)}`).join(', ')})` : ''}, cover = ${ks(tokenColor(x.cover) || '@accent')})`;
    case 'market': return `Marketplace(${ks(x.collection)}${x.chatPage ? `, chatPage = ${ks(x.chatPage)}` : ''})`;
    case 'activity': return `Activity(${ks(x.collection)}${x.profilePage ? `, profilePage = ${ks(x.profilePage)}` : ''})`;
    case 'people': return `People(${ks(x.collection)}${x.profilePage ? `, profilePage = ${ks(x.profilePage)}` : ''})`;
    case 'achievements': return 'Achievements()';
    case 'trending': return `Trending(${ks(x.collection)}${x.searchVar ? `, searchVar = ${ks(x.searchVar)}` : ''})`;
    case 'chart': return `PChart(listOf(${x.data.map((d) => `${ks(d.label)} to ${ks(d.value)}`).join(', ')})${optArgs([['chart', x.chart, 'columns'], ['track', x.track, ''], ['every', x.every, 1], ['points', x.points, 30], ['title', x.title, ''], ['max', x.max, 0], ['values', x.values, true], ['labels', x.labels, true], ['grid', x.grid, true], ['color', x.color, '@accent'], ['text', x.text, ''], ['bg', x.bg, ''], ['height', x.h, 200]], ' = ', ks, KN({ every: kd, max: kd, points: Math.round, height: Math.round }))})`;
    case 'carousel': return `Carousel(${ks(x.var)}, listOf(\n${x.items.map((i) => `${pad}    CarouselItem(${ks(i.name)}, ${ks(i.icon)}, ${ks(i.value)}${i.lock ? `, lock = ${ks(i.lock)}` : ''}${i.desc ? `, desc = ${ks(i.desc)}` : ''}),`).join('\n')}\n${pad})${optArgs([['cardWidth', x.cardWidth, 0.55], ['arrows', x.arrows, true], ['dots', x.dots, true], ['loop', x.loop, false], ['message', x.message, ''], ['card', x.card, '@card'], ['text', x.text, ''], ['accent', x.accent, '@accent'], ['height', x.h, 220]], ' = ', ks, KN({ cardWidth: kf, height: Math.round }))})`;
    case 'pager': return `Pager(${ks(x.var)}${optArgs([['dots', x.dots, true], ['dotColor', x.dotColor, '@accent'], ['loop', x.loop, false], ['auto', x.auto, 0], ['message', x.message, 'slide'], ['height', x.h, 320]], ' = ', ks, KN({ auto: kd, height: Math.round }))}, pages = listOf(\n${x.children.map((c) => `${pad}    { ${kElement(c, ind + 4, false)} },`).join('\n')}\n${pad}))`;
    case 'photogrid': return `PhotoGrid(${optArgs([['collection', x.collection, 'Posts'], ['field', x.field, 'media'], ['filter', x.filter, ''], ['columns', x.columns, 3], ['gap', x.gap, 2], ['radius', x.radius, 0], ['openPage', x.openPage, ''], ['message', x.message, '']], ' = ', ks, Math.round).slice(2)})`;
    case 'like': return `LikeButton(${ks(x.var)}${optArgs([['countVar', x.countVar, 'likes'], ['icon', x.icon, 'heart'], ['message', x.message, ''], ['on', x.on, '#f91880'], ['off', x.off, '@sub'], ['text', x.text, '@sub']], ' = ', ks)})`;
    case 'ticker': return `Ticker(${ks(x.text)}${optArgs([['speed', x.speed, 60], ['direction', x.direction, 'left'], ['gap', x.gap, 60], ['size', x.size, 15], ['bg', x.bg, ''], ['color', x.color, ''], ['accent', x.accent, '#ffd23d'], ['height', x.h, 36]], ' = ', ks, KN({ speed: kd, gap: Math.round, size: Math.round, height: Math.round }))})`;
    case 'timer': return `PTimer(${optArgs([['seconds', x.seconds, 30], ['countUp', x.countUp, false], ['look', x.look, 'ring'], ['format', x.format, 'seconds'], ['autoStart', x.autoStart, true], ['message', x.message, 'timer'], ['endMessage', x.endMessage, ''], ['endAction', x.endAction, 'nothing else'], ['warnAt', x.warnAt, 5], ['variable', x.var, ''], ['color', x.color, '@accent'], ['warn', x.warn, '#ff4d5e'], ['track', x.track, '@line'], ['text', x.text, ''], ['size', x.size, 120]], ' = ', ks, KN({ seconds: kd, warnAt: kd, size: Math.round })).slice(2)})`;
    case 'skeleton': return `Skeleton(${optArgs([['layout', x.layout, 'avatar + lines'], ['lines', x.lines, 3], ['doneVar', x.doneVar, ''], ['radius', x.radius, 8]], ' = ', ks, Math.round).slice(2)})`;
    case 'colors': return `ColorSwatches(${ks(x.var)}, listOf(${x.colors.map(ks).join(', ')})${optArgs([['columns', x.columns, 5], ['shape', x.shape, 'circle'], ['gap', x.gap, 10], ['ring', x.ring, '@text'], ['message', x.message, '']], ' = ', ks, Math.round)})`;
    case 'keypad': return `Keypad(${ks(x.var)}${optArgs([['maxLength', x.maxLength, 4], ['mask', x.mask, false], ['answer', x.answer, ''], ['rightMessage', x.rightMessage, ''], ['wrongMessage', x.wrongMessage, ''], ['enterMessage', x.enterMessage, ''], ['autoEnter', x.autoEnter, true], ['display', x.display, true], ['keyStyle', x.keyStyle, 'round'], ['keyColor', x.keyColor, '@field'], ['text', x.text, ''], ['accent', x.accent, '@good'], ['displayBg', x.displayBg, '']], ' = ', ks, Math.round)})`;
    case 'selector': return `Selector(${ks(x.var)}, listOf(${x.options.map(ks).join(', ')})${x.wrap ? '' : ', wrap = false'})`;
    case 'overlay': return `PPopup(${optArgs([['mode', x.mode, 'popup'], ['openOn', x.openOn, 'popup'], ['closeOn', x.closeOn, 'close'], ['startOpen', x.startOpen, false], ['autoClose', x.autoClose, 0], ['tapCloses', x.tapCloses, false], ['dim', x.dim, true], ['handle', x.handle, true]], ' = ', ks, kd).slice(2)}) {\n${pad}    ${kElement(x.box, ind + 4, false)}\n${pad}}`;
    default: return `TodoBox(${ks(x.name)}, ${ks(x.type)}) // TODO: build the ${x.type} natively`;
  }
}

function kPage(p, fn, pkg) {
  const fills = p.items.some((x) => x.fill && (x.kind === 'list' || x.kind === 'form'));
  const parts = p.items.map((x) => { const pl = placeOf(x), code = kElement(x, 8, fills && x.fill && (x.kind === 'list' || x.kind === 'form')); return pl ? `Place(${kf(pl.fx)}, ${Math.round(pl.w)}) { ${code} }` : code; });
  const firstBtn = p.items.findIndex((x) => x.kind === 'button' && x.pin?.fy === 1); // (buttons anchored to the bottom of the page sit at the bottom)
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
    PocketPage(${ks(p.title)}, page = ${ks(p.value)}${scroll ? '' : ', scroll = false'}${fab}) {
${parts.map((c) => '        ' + c).join('\n')}
    }
}
`;
}

const tok = (c, fb) => tokenColor(c) || fb;
const kMenu = (m) => { const M = m.menu; if (!M) return 'null';
  const it = (i) => `MenuItem(${ks(i.kind)}, ${ks(i.label || '')}${i.icon ? `, icon = ${ks(i.icon)}` : ''}${menuTo(i) ? `, to = ${ks(menuTo(i))}` : ''}${i.badge ? `, badge = ${ks(i.badge)}` : ''})`;
  return `SideMenuStyle(side = ${ks(M.side)}, title = ${ks(M.title)}, subtitle = ${ks(M.subtitle)}, avatar = ${ks(M.avatar)}, header = ${ks(M.header)}, social = ${M.social}, profilePage = ${ks(M.profilePage)}, items = listOf(${M.items.map(it).join(', ')}), footer = listOf(${M.footer.map(it).join(', ')}), footerText = ${ks(M.footerText)}, bg = ${ks(tok(M.bg, '@card'))}, text = ${ks(tok(M.text, '@text'))}, accent = ${ks(tok(M.accent, '@accent'))}, badge = ${ks(tok(M.badge, '#ff3b5c'))}, width = ${Math.round(M.width)})`; };
const kBar = (m) => { const b = m.bar; if (!b) return 'BarStyle()';
  return `BarStyle(look = ${ks(b.look)}, brandPages = listOf(${b.brandPages.map(ks).join(', ')}), center = ${b.align === 'center'}, avatar = ${b.avatar}, left = ${ks(b.left || 'back, else menu')}, circles = ${ks(b.circles || 'plain')}, actions = listOf(${b.actions.map((a) => `BarAction(${ks(a.icon)}, ${ks(a.does)}${a.badge ? `, badge = ${ks(a.badge)}` : ''}${a.only.length ? `, only = listOf(${a.only.map(ks).join(', ')})` : ''})`).join(', ')}), bg = ${ks(tok(b.bg, '@bar'))}, text = ${ks(tok(b.text, '@text'))}, icon = ${ks(tok(b.icon, '@text'))}, border = ${b.border}, size = ${Math.round(b.size)})`; };

function kApp(model, N, pkg) {
  const argb = (h) => '0xFF' + String(h).replace('#', '').padEnd(6, '0').slice(0, 6).toUpperCase();
  const pal = (P) => `Palette(mapOf(${Object.entries(P).map(([k, v]) => `${ks(k)} to Color(${argb(v)})`).join(', ')}))`;
  const light = { ...PALETTES.light, accent: model.accent || PALETTES.light.accent }, dark = { ...PALETTES.dark, accent: model.accent || PALETTES.dark.accent };
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
    PocketIcons.art.putAll(mapOf(${barIcons(model).filter((n) => NAV_ART[n]).map((n) => `\n        ${ks(n)} to listOf(${NAV_ART[n].map(ks).join(', ')}),`).join('')}${barIcons(model).some((n) => NAV_ART[n]) ? '\n    ' : ''})) // the App Bar's and Bottom Nav's icons, drawn like the editor's
    app = AppState(
        name = ${ks(model.name)},
        home = ${ks(model.home)},
        themeSetting = ${ks(model.theme)},
        light = ${pal(light)},
        dark = ${pal(dark)},
        vars = mapOf(${Object.entries(model.vars).map(([k, v]) => `${ks(k)} to ${kv(v)}`).join(', ')}),
        tabs = listOf(${model.tabs.map((t) => `\n            NavTab(${ks(t.label)}, ${NAV_ART[t.icon] ? `PocketIcons.nav(${ks(t.icon)})` : iconK(t.icon)}, ${ks(t.page)}${t.badge ? `, badge = ${ks(t.badge)}` : ''}),`).join('')}${model.tabs.length ? '\n        ' : ''}),
        collections = listOf(${model.collections.map((c) => `\n            Collection(${ks(c.name)}, listOf(${c.fields.map(field).join(', ')})${c.rows.length ? `, sample = listOf(${c.rows.map(row).join(', ')})` : ''}),`).join('')}${model.collections.length ? '\n        ' : ''}),
        bar = ${kBar(model)},
        menu = ${kMenu(model)},${model.notify ? `\n        notify = NotifyStyle(${optArgs([['listen', model.notify.listen, 'notify'], ['position', model.notify.position, 'top'], ['look', model.notify.look, 'card'], ['seconds', model.notify.seconds, 3], ['max', model.notify.max, 3], ['bg', model.notify.bg, '#1e2235'], ['text', model.notify.text, '#ffffff'], ['accent', model.notify.accent, '#ffd23d']], ' = ', ks, KN({ seconds: kd })).slice(2)}),` : ''}
        nav = ${model.nav ? `NavStyle(${ks(model.nav.style)}, ${ks(tok(model.nav.bar, '@bar'))}, ${ks(tok(model.nav.active, '@accent'))}, ${ks(tok(model.nav.idle, '@sub'))}, labels = ${ks(model.nav.labels || 'always')}, margin = ${Math.round(+model.nav.margin || 0)}, on = ${ks(tok(model.nav.on, '#ffffff'))})` : 'NavStyle()'},
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

// =============================================================================================================
// Games: the game in a web view (Android WebView / iOS WKWebView), hosted by Compose Multiplatform
// =============================================================================================================

/** The game page with the bridge: window.Capacitor calls go to Kotlin (Android: PocketBridge, iOS: webkit.messageHandlers.pocket). */
export function kotlinGameHtml(html, bridge) {
  const tag = `<script>window.__pkPlatform=/android/i.test(navigator.userAgent)?'android':'ios';window.ReactNativeWebView={postMessage:function(s){if(window.PocketBridge)PocketBridge.postMessage(s);else window.webkit.messageHandlers.pocket.postMessage(s)}};${bridge.replace(/ true;$/, '')}</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
}

const gameBridgeKt = (pkg) => `package ${pkg}

import kotlinx.serialization.json.*

/**
 * The game's native calls (window.Capacitor in the page): haptics, Back and closing the app are answered here.
 * Phone notifications and in-app purchases aren't in this project yet: the game is told so and carries on
 * (Pocket Engine's Flutter, Xcode and Android Studio projects have them).
 */
object GameBridge {
    /** Handles one message from the page; returns the JavaScript to run in the page in reply (or null). */
    fun handle(text: String, haptic: (String) -> Unit, exit: () -> Unit): String? {
        val m = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull() ?: return null
        if (m["exit"]?.jsonPrimitive?.booleanOrNull == true) { exit(); return null }
        val id = m["id"]?.jsonPrimitive?.content ?: return null
        val plugin = m["plugin"]?.jsonPrimitive?.content
        val method = m["method"]?.jsonPrimitive?.content
        val args = m["args"] as? JsonObject
        fun ok(v: JsonElement = JsonObject(emptyMap())) = "window.__pkReply($id, true, $v)"
        fun no(why: String) = "window.__pkReply($id, false, \${JsonPrimitive(why)})"
        return when (plugin) {
            "Haptics" -> {
                haptic(when (method) { "impact" -> args?.get("style")?.jsonPrimitive?.content ?: "MEDIUM"; "notification" -> args?.get("type")?.jsonPrimitive?.content ?: "SUCCESS"; else -> "VIBRATE" })
                ok()
            }
            "LocalNotifications" -> when (method) {
                "checkPermissions", "requestPermissions" -> ok(buildJsonObject { put("display", "denied") })
                "getPending" -> ok(buildJsonObject { put("notifications", JsonArray(emptyList())) })
                "createChannel", "cancel" -> ok()
                else -> no("Phone notifications aren't in the Kotlin project yet")
            }
            "Purchases" -> no("In-app purchases aren't in the Kotlin project yet")
            else -> no("$plugin.$method is not available")
        }
    }
}
`;

const gameAppKt = (pkg) => `// The game, made with Pocket Engine, in a full-screen web view (Compose Multiplatform for Android and iOS).
package ${pkg}

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/** The web view with the game (GameView.android.kt / GameView.ios.kt). */
@Composable
expect fun GameView(modifier: Modifier)

@Composable
fun App() {
    GameView(Modifier.fillMaxSize().background(Color.Black))
}
`;

const gameAndroidKt = (pkg) => `package ${pkg}

import android.annotation.SuppressLint
import android.app.Activity
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView

private class Bridge(private val web: WebView) {
    @JavascriptInterface
    fun postMessage(text: String) {
        web.post {
            val js = GameBridge.handle(text,
                haptic = { web.performHapticFeedback(if (it == "HEAVY" || it == "ERROR" || it == "VIBRATE") HapticFeedbackConstants.LONG_PRESS else HapticFeedbackConstants.VIRTUAL_KEY) },
                exit = { (web.context as? Activity)?.finish() })
            if (js != null) web.evaluateJavascript(js, null)
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
actual fun GameView(modifier: Modifier) {
    val holder = remember { arrayOfNulls<WebView>(1) }
    BackHandler { holder[0]?.evaluateJavascript("window.__pkBack && window.__pkBack()", null) } // Back goes back in the game first
    AndroidView(modifier = modifier, factory = { ctx ->
        WebView(ctx).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            webViewClient = WebViewClient()
            addJavascriptInterface(Bridge(this), "PocketBridge")
            loadUrl("file:///android_asset/index.html")
            holder[0] = this
        }
    })
}
`;

const gameIosKt = (pkg) => `@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package ${pkg}

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.UIKitView
import kotlinx.cinterop.readValue
import platform.CoreGraphics.CGRectZero
import platform.Foundation.NSBundle
import platform.UIKit.UIImpactFeedbackGenerator
import platform.UIKit.UIImpactFeedbackStyle
import platform.WebKit.WKAudiovisualMediaTypeNone
import platform.WebKit.WKScriptMessage
import platform.WebKit.WKScriptMessageHandlerProtocol
import platform.WebKit.WKUserContentController
import platform.WebKit.WKWebView
import platform.WebKit.WKWebViewConfiguration
import platform.darwin.NSObject

private object Bridge : NSObject(), WKScriptMessageHandlerProtocol {
    var web: WKWebView? = null
    override fun userContentController(userContentController: WKUserContentController, didReceiveScriptMessage: WKScriptMessage) {
        val text = didReceiveScriptMessage.body as? String ?: return
        val js = GameBridge.handle(text,
            haptic = { UIImpactFeedbackGenerator(style = if (it == "HEAVY" || it == "ERROR") UIImpactFeedbackStyle.UIImpactFeedbackStyleHeavy else UIImpactFeedbackStyle.UIImpactFeedbackStyleMedium).impactOccurred() },
            exit = {}) // (iOS apps don't close themselves)
        if (js != null) web?.evaluateJavaScript(js, completionHandler = null)
    }
}

@Composable
actual fun GameView(modifier: Modifier) {
    UIKitView(modifier = modifier, factory = {
        val config = WKWebViewConfiguration().apply {
            allowsInlineMediaPlayback = true
            mediaTypesRequiringUserActionForPlayback = WKAudiovisualMediaTypeNone
            userContentController.addScriptMessageHandler(Bridge, name = "pocket")
        }
        WKWebView(frame = CGRectZero.readValue(), configuration = config).also { web ->
            Bridge.web = web
            NSBundle.mainBundle.URLForResource("index", withExtension = "html")?.let { url ->
                url.URLByDeletingLastPathComponent?.let { dir -> web.loadFileURL(url, allowingReadAccessToURL = dir) }
            }
        }
    })
}
`;

/** The Kotlin game project. html: the built game (native build); bridge: expo.js BRIDGE; wrapper / icon as for apps. */
export function kotlinGameFiles(o, { html, bridge, wrapper, icon }) {
  const shell = kotlinNativeFiles({ name: o.name, settings: { app: true, appName: o.name }, entities: [] }, o, { runtime: '', wrapper, icon });
  const pkg = kotlinPackage(o.appId), dir = shell.files[0].name.split('/')[0] + '/', src = (set) => `${dir}composeApp/src/${set}/kotlin/${pkg.replace(/\./g, '/')}/`;
  const page = kotlinGameHtml(html, bridge);
  const keep = shell.files.filter((f) => !/\/commonMain\/|\/commonTest\/|\/iosMain\/|Platform\.android\.kt$|MainActivity\.kt$|README\.md$/.test(f.name));
  return [
    ...keep,
    { name: dir + 'README.md', data: `# ${o.name} (Kotlin: Compose Multiplatform)

Your Pocket Engine game in a full-screen web view, hosted by a **Kotlin Multiplatform** app for **Android and iOS**
(Android WebView / iOS WKWebView). The game is \`composeApp/src/androidMain/assets/index.html\` and \`iosApp/iosApp/index.html\`.

- **Android:** open this folder in Android Studio and press Run, or \`sh gradlew :composeApp:installDebug\`.
- **iOS (Mac):** open \`iosApp/iosApp.xcodeproj\` in Xcode and press Run (Xcode builds the Kotlin part with Gradle).

Native features: haptics, the Back button (Android) and closing the app are handled in \`GameBridge.kt\`. Phone notifications and
in-app purchases aren't in this project yet (the game is told and carries on); the Flutter, Xcode and Android Studio projects have them.

To update the game: export again from Pocket Engine, or replace both \`index.html\` files.
` },
    { name: src('commonMain') + 'App.kt', data: gameAppKt(pkg) },
    { name: src('commonMain') + 'GameBridge.kt', data: gameBridgeKt(pkg) },
    { name: src('commonTest') + 'GameBridgeTest.kt', data: `package ${pkg}\n\nimport kotlin.test.Test\nimport kotlin.test.assertEquals\nimport kotlin.test.assertTrue\n\nclass GameBridgeTest {\n    @Test fun hapticsAnswer() {\n        var felt = ""\n        val js = GameBridge.handle("""{"id":3,"plugin":"Haptics","method":"impact","args":{"style":"HEAVY"}}""", { felt = it }, {})\n        assertEquals("HEAVY", felt)\n        assertTrue(js!!.startsWith("window.__pkReply(3, true"))\n    }\n}\n` },
    { name: src('androidMain') + 'GameView.android.kt', data: gameAndroidKt(pkg) },
    { name: src('androidMain') + 'MainActivity.kt', data: `package ${pkg}\n\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.activity.enableEdgeToEdge\n\nclass MainActivity : ComponentActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        enableEdgeToEdge()\n        setContent { App() }\n    }\n}\n` },
    { name: dir + 'composeApp/src/androidMain/assets/index.html', data: page },
    { name: src('iosMain') + 'GameView.ios.kt', data: gameIosKt(pkg) },
    { name: src('iosMain') + 'MainViewController.kt', data: `package ${pkg}\n\nimport androidx.compose.ui.window.ComposeUIViewController\n\nfun MainViewController() = ComposeUIViewController { App() }\n` },
    { name: dir + 'iosApp/iosApp/index.html', data: page },
  ];
}
