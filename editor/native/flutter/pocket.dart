// Pocket runtime for Flutter: the app's state (variables, data collections, the opened record, navigation)
// and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by Pocket Engine's
// native export; the pages in lib/pages/ are yours to change, and so is this file.
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ---------------------------------------------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------------------------------------------

class Field {
  const Field(this.key, this.name, this.type, {this.options = const [], this.def});
  final String key, name, type; // type: text, long text, number, money, date, choice, yes/no, icon…
  final List<String> options;
  final Object? def;
}

class Collection {
  const Collection(this.name, this.fields, {this.sample = const []});
  final String name;
  final List<Field> fields;
  final List<Map<String, Object?>> sample;
}

/// A number worked out from a collection (count, sum, average, min, max) and kept in a variable.
class Stat {
  const Stat(this.variable, this.collection, this.how, {this.field = '', this.filter = '', this.money = false});
  final String variable, collection, how, field, filter;
  final bool money;
}

class NavTab {
  const NavTab(this.label, this.icon, this.page, {this.badge = '', this.name = ''});
  /// name: the icon's name in Pocket Engine (drawn with its line icon when artIcons has it; icon otherwise).
  final String label, page, badge, name;
  final IconData icon;
}

/// A button on the right of the App Bar: icon (a name, or theme for the dark mode moon / sun), what it does
/// ("dark mode toggle", "page:friends", or a message), a badge variable, and the pages it shows on (blank = all).
class BarAction {
  const BarAction(this.icon, this.does, {this.badge = '', this.only = const []});
  final String icon, does, badge;
  final List<String> only;
}

/// The App Bar's look, from the project: x (your avatar on the left, the app's name on brand pages), title position, buttons, colours.
class BarStyle {
  const BarStyle({this.look = 'standard', this.brandPages = const ['home'], this.center = false, this.avatar = false, this.left = 'back, else menu', this.circles = 'plain', this.actions = const [], this.bg = '@bar', this.text = '@text', this.icon = '@text', this.border = true, this.size = 19});
  /// circles: the buttons sit in a filled circle ("circles"), a ring ("outlined circles") or nothing ("plain").
  /// left: the left button (back, else menu · menu · back · none); ☰ or your avatar opens the Side Menu.
  final String look, left, circles, bg, text, icon;
  final List<String> brandPages;
  final bool center, avatar, border;
  final List<BarAction> actions;
  final double size;
}

/// The Bottom Nav's style (pill, floating, glass, segmented, dock, minimal…), when names show (always, selected only, never),
/// the gap around a floating bar, and colours (on: the icon on a solid highlight).
class NavStyle {
  const NavStyle({this.style = 'pill', this.labels = 'always', this.margin = 14, this.bar = '@bar', this.active = '@accent', this.idle = '@sub', this.on = '#ffffff'});
  final String style, labels, bar, active, idle, on;
  final double margin;
  bool get floating => const ['floating', 'glass', 'segmented', 'dock'].contains(style);
  /// The highlight behind the selected icon: a soft pill, a solid one, or none.
  bool get pill => const ['pill', 'floating', 'glass', 'bubble', 'classic'].contains(style);
  bool get solid => const ['segmented', 'chips'].contains(style);
}

/// A row of the Side Menu: a page, a message, a switch for a variable (toggle), a section title or a line.
class MenuItem {
  const MenuItem(this.kind, this.label, {this.icon = '', this.to = '', this.badge = ''});
  final String kind, label, icon, to, badge;
}

/// The Side Menu: its header (the signed-in person, or a title, subtitle and picture), rows, footer and colours.
class SideMenuStyle {
  const SideMenuStyle({this.side = 'left', this.title = '', this.subtitle = '', this.avatar = '', this.header = 'simple', this.social = false, this.profilePage = 'profile', this.items = const [], this.footer = const [], this.footerText = '', this.bg = '#151826', this.text = '#e8eaf2', this.accent = '#4fa3ff', this.badge = '#ff3b5c', this.width = 290});
  final String side, title, subtitle, avatar, header, profilePage, footerText, bg, text, accent, badge;
  final bool social;
  final List<MenuItem> items, footer;
  final double width;
}

/// The editor's own line icons (64 × 64 SVG path data: [stroked, filled]), for the App Bar and Bottom Nav. Set in main.dart.
Map<String, List<String>> artIcons = {};

/// SVG path data → a Path (M L H V C S Q A Z, absolute and relative).
Path svgPath(String d) {
  final p = Path(), t = RegExp(r'[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)').allMatches(d).map((m) => m.group(0)!).toList();
  var i = 0, cmd = '';
  double x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0; // the pen, where the shape started, the last control point
  bool letter(String s) => RegExp(r'^[a-zA-Z]$').hasMatch(s);
  double n() => i < t.length ? double.parse(t[i++]) : 0;
  while (i < t.length) {
    if (letter(t[i])) cmd = t[i++];
    final at = i, rel = cmd == cmd.toLowerCase(), ox = rel ? x : 0.0, oy = rel ? y : 0.0;
    switch (cmd.toUpperCase()) {
      case 'M': x = ox + n(); y = oy + n(); p.moveTo(x, y); sx = x; sy = y; cx = x; cy = y; cmd = rel ? 'l' : 'L';
      case 'L': x = ox + n(); y = oy + n(); p.lineTo(x, y); cx = x; cy = y;
      case 'H': x = ox + n(); p.lineTo(x, y); cx = x; cy = y;
      case 'V': y = oy + n(); p.lineTo(x, y); cx = x; cy = y;
      case 'C': final x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n(); x = ox + n(); y = oy + n(); p.cubicTo(x1, y1, x2, y2, x, y); cx = x2; cy = y2;
      case 'S': final x1 = 2 * x - cx, y1 = 2 * y - cy, x2 = ox + n(), y2 = oy + n(); x = ox + n(); y = oy + n(); p.cubicTo(x1, y1, x2, y2, x, y); cx = x2; cy = y2;
      case 'Q': final x1 = ox + n(), y1 = oy + n(); x = ox + n(); y = oy + n(); p.quadraticBezierTo(x1, y1, x, y); cx = x1; cy = y1;
      case 'A':
        final rx = n(), ry = n(), rot = n(), large = n() != 0, sweep = n() != 0;
        x = ox + n(); y = oy + n(); p.arcToPoint(Offset(x, y), radius: Radius.elliptical(rx, ry), rotation: rot, largeArc: large, clockwise: sweep); cx = x; cy = y;
      case 'Z': p.close(); x = sx; y = sy; cx = x; cy = y;
    }
    if (i == at && i < t.length && !letter(t[i])) i++; // (a stray number)
  }
  return p;
}

/// One of the editor's line icons, in a colour.
class ArtIcon extends StatelessWidget {
  const ArtIcon(this.paths, {super.key, required this.color, this.size = 24});
  final List<String> paths;
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size, child: CustomPaint(painter: _ArtPainter(paths, color)));
}

class _ArtPainter extends CustomPainter {
  _ArtPainter(this.paths, this.color);
  final List<String> paths;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 64, size.height / 64);
    canvas.drawPath(svgPath(paths[0]), Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 5..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round);
    if (paths.length > 1 && paths[1].isNotEmpty) canvas.drawPath(svgPath(paths[1]), Paint()..color = color);
  }
  @override
  bool shouldRepaint(_ArtPainter o) => o.color != color || o.paths != paths;
}

/// An App Bar / Bottom Nav icon by its Pocket Engine name: the editor's line icon, or the nearest Material icon.
Widget barIcon(String name, {required Color color, double size = 24, IconData? fallback}) {
  final art = artIcons[name];
  return art != null ? ArtIcon(art, color: color, size: size) : Icon(fallback ?? iconNamed(name), color: color, size: size);
}

/// Icon names (as in Pocket Engine) → Material icons.
IconData iconNamed(String name, {bool on = false}) => switch (name) {
      'home' => on ? Icons.home : Icons.home_outlined, 'search' || 'explore' => Icons.search, 'user' || 'profile' => on ? Icons.person : Icons.person_outline,
      'users' || 'friends' => Icons.people_outline, 'chat' => on ? Icons.chat_bubble : Icons.chat_bubble_outline, 'bell' => Icons.notifications_none, 'heart' => Icons.favorite_border,
      'video' => on ? Icons.smart_display : Icons.smart_display_outlined, 'info' => Icons.info_outline, 'settings' || 'gear' => Icons.settings_outlined, 'plus' || 'add' => Icons.add,
      'shop' => Icons.storefront_outlined, 'bookmark' => Icons.bookmark_border, 'trophy' => Icons.emoji_events_outlined, 'edit' => Icons.edit_outlined, 'moon' => Icons.dark_mode_outlined,
      'sun' => Icons.light_mode_outlined, 'menu' || 'list' => Icons.menu, 'star' => Icons.star_border, 'camera' => Icons.photo_camera_outlined,
      _ => Icons.circle_outlined,
    };

// ---------------------------------------------------------------------------------------------------------------
// Colours (the app's @tokens) for light and dark
// ---------------------------------------------------------------------------------------------------------------

class Palette {
  const Palette(this.c);
  final Map<String, Color> c;
  Color get bg => c['bg']!;
  Color get card => c['card']!;
  Color get text => c['text']!;
  Color get sub => c['sub']!;
  Color get line => c['line']!;
  Color get field => c['field']!;
  Color get accent => c['accent']!;
  Color get onAccent => c['onAccent']!;
  Color get danger => c['danger']!;
  /// '@sub' / 'sub' → the token; '#ff8800' → that colour; anything else → null.
  Color? resolve(String? v) {
    if (v == null || v.isEmpty) return null;
    final t = v.startsWith('@') ? v.substring(1) : v;
    if (c.containsKey(t)) return c[t];
    final h = v.replaceFirst('#', '');
    if (RegExp(r'^[0-9a-fA-F]{6}$').hasMatch(h)) return Color(int.parse('FF$h', radix: 16));
    final m = RegExp(r'^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$').firstMatch(v); // rgba(255,255,255,0.1)
    if (m != null) return Color.fromRGBO(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!), double.tryParse(m[4] ?? '1') ?? 1);
    return null;
  }
}

Palette pal(BuildContext context) => Theme.of(context).brightness == Brightness.dark ? app.dark : app.light;

// ---------------------------------------------------------------------------------------------------------------
// The app's state
// ---------------------------------------------------------------------------------------------------------------

late AppState app;

class AppState extends ChangeNotifier {
  AppState({required this.name, required this.collections, required this.stats, required Map<String, Object?> vars, required this.tabs, required this.home, required this.light, required this.dark, this.themeSetting = 'follow the phone', this.bar = const BarStyle(), this.nav = const NavStyle(), this.menu, this.notify}) {
    this.vars.addAll(vars);
  }

  final String name, home, themeSetting;
  final List<Collection> collections;
  final List<Stat> stats;
  final List<NavTab> tabs;
  final Palette light, dark;
  final BarStyle bar;
  /// The Side Menu (null: the app has none).
  final SideMenuStyle? menu;
  /// Pop-up notifications ("notify Title|text|icon"); null: the app has none.
  final NotifyStyle? notify;
  bool get menuOn => menu != null && bar.left != 'none' && bar.left != 'back';
  final NavStyle nav;
  final Map<String, Object?> vars = {};
  final Map<String, List<Map<String, Object?>>> data = {};
  final navigator = GlobalKey<NavigatorState>();
  int tab = 0;
  String? openCollection, openId;
  SharedPreferences? _prefs;

  ThemeMode get themeMode {
    final d = vars['darkMode'];
    if (d is bool) return d ? ThemeMode.dark : ThemeMode.light;
    return themeSetting == 'dark' ? ThemeMode.dark : themeSetting == 'light' ? ThemeMode.light : ThemeMode.system;
  }

  /// Load what was saved on the phone (or the sample records the first time).
  Future<void> load() async {
    try { _prefs = await SharedPreferences.getInstance(); } catch (_) {}
    final saved = _prefs?.getString('pocket.data');
    final Map<String, dynamic> s = saved != null ? jsonDecode(saved) as Map<String, dynamic> : {};
    for (final c in collections) {
      final rows = s[c.name] as List?;
      data[c.name] = rows != null
          ? rows.map((r) => Map<String, Object?>.from(r as Map)).toList()
          : [for (var i = 0; i < c.sample.length; i++) {...blank(c.name), ...c.sample[i], '_id': 's$i', '_at': c.sample[i]['_at'] ?? i}]; // (later rows count as newer)
    }
    final v = _prefs?.getString('pocket.vars');
    if (v != null) vars.addAll(Map<String, Object?>.from(jsonDecode(v) as Map));
    _work();
  }

  void _changed() { _work(); _prefs?.setString('pocket.data', jsonEncode(data)); _prefs?.setString('pocket.vars', jsonEncode(vars)); notifyListeners(); }

  /// Stats are worked out again whenever the data changes.
  /// Stats, {posts_count}-style counts and the social counts ({unread}, {notifications_unread}, {friend_requests}).
  void _work() {
    final me = show(vars['playerHandle']).isEmpty ? (show(vars['playerName']).isEmpty ? 'You' : show(vars['playerName'])).toLowerCase().replaceAll(RegExp(r'\s+'), '') : show(vars['playerHandle']), mine = {for (final s in stats) s.variable};
    for (final c in collections) { vars['${c.name.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_')}_count'] = rows(c.name).length; }
    if (def('Notifications') != null) vars['notifications_unread'] = rows('Notifications').where((r) => show(r['to']) == me && !_on(r['read'])).length;
    if (def('Friends') != null) vars['friend_requests'] = rows('Friends').where((r) => show(r['status']) != 'accepted' && show(r['to']) == me).length;
    if (def('Messages') != null && !mine.contains('unread')) {
      final read = <String, num>{for (final r in rows('Reads')) if (show(r['handle']) == me) show(r['chat']): (r['at'] as num?) ?? 0};
      vars['unread'] = rows('Messages').where((r) => show(r['handle']) != me && ((r['_at'] as num?) ?? 0) > (read[show(r['chat'])] ?? 0)).length;
    }
    for (final s in stats) { vars[s.variable] = stat(s.collection, s.how, field: s.field, filter: s.filter); }
  }
  static bool _on(Object? v) => v == true || v == 1 || v == 'yes' || v == 'true';
  static String today([int days = 0]) { final d = DateTime.now().add(Duration(days: days)); return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}'; }

  /// A new record's values: each field's default (dates: today).
  Map<String, Object?> blank(String name) => {
        for (final f in def(name)?.fields ?? const <Field>[])
          f.key: f.def != null && f.def != ''
              ? (f.type == 'yes/no' ? _on(f.def) : ['number', 'money', 'rating'].contains(f.type) ? num.tryParse('${f.def}') ?? 0 : f.def == 'today' && f.type == 'date' ? today() : f.def)
              : f.type == 'yes/no' ? false : f.type == 'date' ? today() : f.type == 'choice' ? (f.options.isEmpty ? '' : f.options.first) : ['number', 'money', 'rating'].contains(f.type) ? 0 : '',
      };

  /// How a value reads: dates as Today / Tomorrow / 3 Mar, money with \$, yes/no as ✓.
  String text(String? collection, String key, Object? v) {
    if (v == null || v == '') return '';
    Field? f;
    for (final x in def(collection ?? '')?.fields ?? const <Field>[]) { if (x.key == key) f = x; }
    switch (f?.type) {
      case 'money': final n = v is num ? v : num.tryParse('$v') ?? 0; return '${n < 0 ? '−' : ''}\$${n.abs().toStringAsFixed(2).replaceAll(RegExp(r'\.00$'), '')}';
      case 'yes/no': return _on(v) ? '✓' : '';
      case 'date':
        final k = '$v'.length >= 10 ? '$v'.substring(0, 10) : '$v', d = DateTime.tryParse(k);
        if (d == null) return show(v);
        if (k == today()) return 'Today';
        if (k == today(-1)) return 'Yesterday';
        if (k == today(1)) return 'Tomorrow';
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return '${d.day} ${months[d.month - 1]}${d.year != DateTime.now().year ? ' ${d.year}' : ''}';
      default: return show(v);
    }
  }

  // ---- variables and text ----
  Object? get(String k) => vars[k];
  void set(String k, Object? v) { vars[k] = v; _changed(); }
  void add(String k, num by) { final c = vars[k]; set(k, (c is num ? c : num.tryParse('$c') ?? 0) + by); }
  static String show(Object? v) {
    if (v == null) return '';
    if (v is bool) return v ? 'yes' : 'no';
    if (v is double && v == v.roundToDouble()) return v.toInt().toString();
    return '$v';
  }
  /// '{score} points' → '12 points'; {record_title} is the opened record's title; with a row, {title} is the row's.
  String fill(String t, [Map<String, Object?>? row, String? collection]) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
        final k = m[1]!;
        if (row != null && row.containsKey(k)) return collection == null ? show(row[k]) : text(collection, k, row[k]);
        if (k.startsWith('record_')) return text(openCollection, k.substring(7), opened?[k.substring(7)]);
        return show(vars[k]);
      });

  // ---- data ----
  Collection? def(String name) { for (final c in collections) { if (c.name == name) return c; } return null; }
  List<Map<String, Object?>> rows(String name) => data[name] ?? [];
  Map<String, Object?>? get opened { if (openCollection == null || openId == null) return null; for (final r in rows(openCollection!)) { if (r['_id'] == openId) return r; } return null; }

  /// Rows that pass the filter ("done = no", "amount > 10 and kind = Food"), match the search, in order.
  List<Map<String, Object?>> query(String name, {String filter = '', String search = '', String sort = 'newest first'}) {
    final c = def(name);
    var list = rows(name).where((r) => _passes(r, fill(filter))).toList();
    final q = search.trim().toLowerCase();
    if (q.isNotEmpty) list = list.where((r) => (c?.fields ?? []).any((f) => ['text', 'long text', 'choice', 'icon'].contains(f.type) && '${r[f.key] ?? ''}'.toLowerCase().contains(q))).toList();
    final s = sort.toLowerCase();
    int at(Map r) => (r['_at'] as num?)?.toInt() ?? 0;
    if (s == 'newest first') { list.sort((a, b) => at(b).compareTo(at(a))); }
    else if (s == 'oldest first') { list.sort((a, b) => at(a).compareTo(at(b))); }
    else {
      final m = RegExp(r'^(.+?)(?:\s+\((a-z|z-a|low-high|high-low)\))?$').firstMatch(s);
      if (m != null) {
        final key = m[1]!.trim().replaceAll(RegExp(r'[^a-z0-9]+'), '_'), dir = RegExp(r'z-a|high-low').hasMatch(m[2] ?? '') ? -1 : 1;
        list.sort((a, b) { final x = a[key], y = b[key]; return dir * (x is num && y is num ? x.compareTo(y) : '${x ?? ''}'.compareTo('${y ?? ''}')); });
      }
    }
    return list;
  }

  bool _passes(Map<String, Object?> r, String filter) {
    if (filter.trim().isEmpty) return true;
    for (final part in filter.split(RegExp(r'\s+and\s+', caseSensitive: false))) {
      final m = RegExp(r'^\s*(\w[\w ]*?)\s*(!=|≠|>=|≥|<=|≤|=|>|<)\s*(.*?)\s*$').firstMatch(part);
      if (m == null) continue;
      final key = m[1]!.toLowerCase().replaceAll(' ', '_'), op = m[2]!, raw = m[3]!;
      final v = r[key];
      Object? want = raw.toLowerCase() == 'yes' ? true : raw.toLowerCase() == 'no' ? false : num.tryParse(raw) ?? raw;
      if (want is bool) { final b = v == true || v == 1 || v == 'yes'; if ((op == '=') != (b == want)) return false; continue; }
      final a = v is num ? v : num.tryParse('${v ?? ''}');
      if (want is num && a != null) {
        final ok = switch (op) { '=' => a == want, '!=' || '≠' => a != want, '>' => a > want, '<' => a < want, '>=' || '≥' => a >= want, _ => a <= want };
        if (!ok) return false;
        continue;
      }
      final same = '${v ?? ''}'.toLowerCase() == '$want'.toLowerCase();
      if ((op == '=' && !same) || ((op == '!=' || op == '≠') && same)) return false;
    }
    return true;
  }

  num stat(String name, String how, {String field = '', String filter = ''}) {
    final list = query(name, filter: filter, sort: 'oldest first');
    if (how == 'count') return list.length;
    final nums = list.map((r) => r[field] is num ? r[field] as num : num.tryParse('${r[field] ?? ''}') ?? 0).toList();
    if (nums.isEmpty) return 0;
    final sum = nums.fold<num>(0, (a, b) => a + b);
    if (how == 'sum') return (sum * 100).round() / 100;
    if (how == 'average') return (sum / nums.length * 100).round() / 100;
    return how == 'min' ? nums.reduce((a, b) => a < b ? a : b) : nums.reduce((a, b) => a > b ? a : b);
  }

  String addRecord(String name, Map<String, Object?> values) {
    final id = 'r${DateTime.now().microsecondsSinceEpoch}';
    (data[name] ??= []).add({...blank(name), ...values, '_id': id, '_at': DateTime.now().millisecondsSinceEpoch});
    _changed();
    return id;
  }
  void updateRecord(String name, String id, Map<String, Object?> values) { for (final r in rows(name)) { if (r['_id'] == id) r.addAll(values); } _changed(); }
  void deleteRecord(String name, String id) { rows(name).removeWhere((r) => r['_id'] == id); _changed(); }
  void open(String name, String id) { openCollection = name; openId = id; notifyListeners(); }

  // ---- navigation ----
  /// A page with a tab switches to that tab; any other page opens on top (Back returns).
  void go(String page) {
    final i = tabs.indexWhere((t) => t.page == page);
    if (i >= 0) { navigator.currentState?.popUntil((r) => r.isFirst); tab = i; notifyListeners(); return; }
    if (page == home && tabs.isEmpty) { navigator.currentState?.popUntil((r) => r.isFirst); return; }
    navigator.currentState?.pushNamed(page);
  }
  void back() => navigator.currentState?.maybePop();
  void pickTab(int i) { tab = i; notifyListeners(); }

  // ---- messages ----
  final List<void Function(String)> _listeners = [];
  /// The pop-up notifications on screen now.
  final toasts = ValueNotifier<List<Toast>>([]);
  /// Hear the app's messages (a popup's "popup", a timer's "timer pause"…); call what it returns to stop.
  void Function() listen(void Function(String) f) { _listeners.add(f); return () => _listeners.remove(f); }
  /// Send a message (a button's "message" action, an App Bar button…) to everything listening.
  void send(String message) {
    final m = fill(message).trim();
    if (m.isEmpty) return;
    for (final f in [..._listeners]) { f(m); }
    final n = notify;
    if (n != null && (m == n.listen || m.startsWith('${n.listen} '))) {
      final parts = m.substring(n.listen.length).trim().split('|').map((x) => x.trim()).toList();
      final t = Toast(parts[0], parts.length > 1 ? parts[1] : '', parts.length > 2 && parts[2].isNotEmpty ? parts[2] : (n.look == 'achievement' ? '🏆' : ''));
      final list = [...toasts.value, t];
      toasts.value = list.length > n.max ? list.sublist(list.length - n.max) : list;
      Timer(Duration(milliseconds: (n.seconds * 1000).round()), () => toasts.value = toasts.value.where((x) => x != t).toList());
    }
  }

  /// What a button does (the same words as the button's Action in Pocket Engine).
  void run(String action, [Object? value, num amount = 1]) {
    final v = '${value ?? ''}';
    switch (action) {
      case 'message': send(v);
      case 'go to page': go(v);
      case 'go back': back();
      case 'set variable': set(v, amount);
      case 'add to variable': add(v, amount);
      case 'new record': openId = null; go(v);
      case 'edit opened record': go(v);
      case 'delete opened record':
        if (openCollection != null && openId != null) { deleteRecord(openCollection!, openId!); openId = null; }
        back();
      default: debugPrint('TODO: the "$action" action ($v) has no native version yet');
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The app shell: tabs (a Bottom Nav) and the pages
// ---------------------------------------------------------------------------------------------------------------

ThemeData pocketTheme(Palette p, Brightness b) => ThemeData(
      brightness: b,
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: p.accent, brightness: b, primary: p.accent, onPrimary: p.onAccent, surface: p.card, error: p.danger),
      scaffoldBackgroundColor: p.bg,
      appBarTheme: AppBarTheme(backgroundColor: p.card, foregroundColor: p.text, surfaceTintColor: Colors.transparent, elevation: 0, scrolledUnderElevation: 1),
      floatingActionButtonTheme: FloatingActionButtonThemeData(backgroundColor: p.accent, foregroundColor: p.onAccent, shape: const CircleBorder()),
      cardTheme: CardThemeData(color: p.card, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
      inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: p.field, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none)),
    );

class PocketApp extends StatelessWidget {
  const PocketApp({super.key, required this.pages});
  final Map<String, WidgetBuilder> pages;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (context, _) => MaterialApp(
          title: app.name,
          debugShowCheckedModeBanner: false,
          navigatorKey: app.navigator,
          themeMode: app.themeMode,
          theme: pocketTheme(app.light, Brightness.light),
          darkTheme: pocketTheme(app.dark, Brightness.dark),
          home: app.tabs.isEmpty ? pages[app.home]!(context) : _Tabs(pages: pages),
          builder: (context, child) => Stack(children: [child ?? const SizedBox.shrink(), if (app.notify != null) const ToastLayer()]), // (pop-up notifications over every page)
          onGenerateRoute: (s) => pages[s.name] == null ? null : MaterialPageRoute(builder: pages[s.name]!, settings: s),
        ),
      );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.pages});
  final Map<String, WidgetBuilder> pages;
  @override
  Widget build(BuildContext context) => Scaffold(
        body: IndexedStack(index: app.tab, children: [for (final t in app.tabs) pages[t.page]!(context)]),
        bottomNavigationBar: Builder(builder: (context) {
          // the project's Bottom Nav: its style (minimal = icons only, no pill) and colours
          final p = pal(context), n = app.nav, minimal = n.style == 'minimal', on = p.resolve(n.active) ?? p.accent, off = p.resolve(n.idle) ?? p.sub, onSolid = p.resolve(n.on) ?? Colors.white;
          Widget icon(NavTab t, bool sel) => Badge(
                isLabelVisible: t.badge.isNotEmpty && (num.tryParse(AppState.show(app.get(t.badge))) ?? 0) > 0,
                label: Text(AppState.show(app.get(t.badge))),
                child: barIcon(t.name, fallback: sel && t.icon == Icons.home_outlined ? Icons.home : t.icon, color: sel ? (n.solid ? onSolid : on) : off, size: minimal ? 28 : 24),
              );
          final bar = NavigationBarTheme(
            data: NavigationBarThemeData(labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: s.contains(WidgetState.selected) ? on : off))),
            child: NavigationBar(
              selectedIndex: app.tab,
              onDestinationSelected: app.pickTab,
              backgroundColor: (p.resolve(n.bar) ?? p.card).withValues(alpha: n.style == 'glass' ? 0.72 : 1),
              indicatorColor: n.solid ? on : n.pill ? on.withValues(alpha: 0.22) : Colors.transparent,
              labelBehavior: n.labels == 'never' ? NavigationDestinationLabelBehavior.alwaysHide : n.labels == 'selected only' ? NavigationDestinationLabelBehavior.onlyShowSelected : NavigationDestinationLabelBehavior.alwaysShow,
              height: n.labels == 'never' ? 60 : n.floating ? 66 : null,
              destinations: [for (final t in app.tabs) NavigationDestination(icon: icon(t, false), selectedIcon: icon(t, true), label: t.label)],
            ),
          );
          if (!n.floating) return bar;
          // floating styles: a rounded bar inset from the edges, with a shadow
          return SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.fromLTRB(n.margin, 0, n.margin, n.margin < 8 ? 8 : n.margin),
              child: DecoratedBox(
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(26), boxShadow: const [BoxShadow(color: Color(0x59000000), blurRadius: 22, offset: Offset(0, 6))]),
                child: ClipRRect(borderRadius: BorderRadius.circular(26), child: MediaQuery.removePadding(context: context, removeBottom: true, child: bar)),
              ),
            ),
          );
        }),
      );
}

/// The Side Menu: a header, rows that open pages, send messages or switch a variable, and a footer.
class PocketDrawer extends StatelessWidget {
  const PocketDrawer({super.key});
  @override
  Widget build(BuildContext context) {
    final m = app.menu!, p = pal(context), bg = p.resolve(m.bg) ?? p.card, fg = p.resolve(m.text) ?? p.text, acc = p.resolve(m.accent) ?? p.accent;
    final page = (ModalRoute.of(context)?.settings.name) ?? (app.tabs.isEmpty ? app.home : app.tabs[app.tab].page);
    Widget row(MenuItem it) {
      if (it.kind == 'line') return Divider(color: fg.withValues(alpha: 0.2), indent: 8, endIndent: 8);
      if (it.kind == 'section') return Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 4), child: Text(it.label.toUpperCase(), style: TextStyle(color: fg.withValues(alpha: 0.55), fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.6)));
      final n = it.badge.isEmpty ? 0 : (num.tryParse(AppState.show(app.get(it.badge))) ?? 0).toInt(), on = it.kind == 'page' && it.to == page;
      return ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        selected: on, selectedTileColor: acc.withValues(alpha: 0.18), selectedColor: acc, iconColor: fg, textColor: fg,
        leading: it.icon.isEmpty ? null : barIcon(it.icon, color: on ? acc : fg, size: 22),
        title: Text(app.fill(it.label), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
        trailing: it.kind == 'toggle'
            ? Switch(value: isOn(app.get(it.to)), activeTrackColor: acc, onChanged: (v) => app.set(it.to, v))
            : n > 0 ? Badge(label: Text(n > 99 ? '99+' : '$n'), backgroundColor: p.resolve(m.badge)) : null,
        onTap: () {
          if (it.kind == 'toggle') { app.set(it.to, !isOn(app.get(it.to))); return; }
          Navigator.of(context).pop(); // (closes the menu)
          if (it.kind == 'page') { app.go(it.to); } else { app.send(it.to.replaceFirst('msg:', '')); }
        },
      );
    }
    final header = m.header == 'none' ? null : m.social
        ? InkWell(onTap: () { Navigator.of(context).pop(); app.go(m.profilePage); }, child: Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Avatar(meName, me, size: 52), const SizedBox(height: 8), Text(meName, style: TextStyle(color: fg, fontSize: 18, fontWeight: FontWeight.w800)), Text('@$me', style: TextStyle(color: fg.withValues(alpha: 0.65))),
          ])))
        : Container(
            margin: const EdgeInsets.fromLTRB(8, 0, 8, 8), padding: const EdgeInsets.all(14),
            decoration: m.header == 'banner' ? BoxDecoration(color: acc, borderRadius: BorderRadius.circular(16)) : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (m.avatar.isNotEmpty) artIcons[m.avatar] != null ? barIcon(m.avatar, color: fg, size: 34) : Text(m.avatar, style: const TextStyle(fontSize: 34)),
              Text(app.fill(m.title), style: TextStyle(color: m.header == 'banner' ? Colors.white : fg, fontSize: 18, fontWeight: FontWeight.w800)),
              if (m.subtitle.isNotEmpty) Text(app.fill(m.subtitle), style: TextStyle(color: (m.header == 'banner' ? Colors.white : fg).withValues(alpha: 0.65))),
            ]),
          );
    return Drawer(
      backgroundColor: bg, width: m.width,
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Align(alignment: Alignment.centerRight, child: IconButton(icon: Icon(Icons.close, color: fg.withValues(alpha: 0.7)), onPressed: () => Navigator.of(context).pop())),
          ?header,
          Expanded(child: ListView(padding: const EdgeInsets.symmetric(horizontal: 8), children: [for (final it in m.items) row(it)])),
          if (m.footer.isNotEmpty) ...[Divider(color: fg.withValues(alpha: 0.2)), for (final it in m.footer) Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: row(it))],
          if (m.footerText.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: Text(app.fill(m.footerText), style: TextStyle(color: fg.withValues(alpha: 0.5), fontSize: 12))),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------------

/// A page: the app bar with its title, then what's on it (a list or form fills the rest).
/// Things that run edge to edge on a page (a feed), instead of inside the page's side margins.
mixin FullBleed on Widget {}

class PocketPage extends StatelessWidget {
  const PocketPage({super.key, required this.title, required this.body, this.page = '', this.fab, this.appBar = true, this.scroll = true});
  final String title, page;
  final List<Widget> Function(BuildContext context) body;
  final Widget? fab;
  final bool appBar, scroll;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (context, _) {
          final kids = body(context);
          return Scaffold(
            appBar: appBar ? _bar(context) : null,
            drawer: app.menuOn && app.menu!.side != 'right' ? const PocketDrawer() : null,
            endDrawer: app.menuOn && app.menu!.side == 'right' ? const PocketDrawer() : null,
            floatingActionButton: fab,
            body: SafeArea(
              child: scroll
                  ? ListView(padding: const EdgeInsets.only(top: 12, bottom: 96), children: _spaced(kids, 16))
                  : Padding(padding: const EdgeInsets.only(top: 8), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _spaced(kids, 12))),
            ),
          );
        },
      );

  /// The project's App Bar: its look (x: your avatar on the left and the app's name on the home page), title position, buttons with badges, colours.
  PreferredSizeWidget _bar(BuildContext context) {
    final p = pal(context), b = app.bar, back = Navigator.of(context).canPop();
    final brand = b.look != 'standard' && !back && (b.brandPages.isEmpty || b.brandPages.contains(page));
    final ic = p.resolve(b.icon) ?? p.text, dark = Theme.of(context).brightness == Brightness.dark;
    return AppBar(
      backgroundColor: p.resolve(b.bg) ?? p.card,
      foregroundColor: p.resolve(b.text) ?? p.text,
      iconTheme: IconThemeData(color: ic),
      centerTitle: b.center,
      shape: b.border ? Border(bottom: BorderSide(color: p.line)) : null,
      leading: back ? null : b.avatar || app.menuOn ? Builder(builder: (context) { // your avatar or ☰: opens the Side Menu
        void open() { if (!app.menuOn) return; final s = Scaffold.of(context); app.menu!.side == 'right' ? s.openEndDrawer() : s.openDrawer(); }
        return b.avatar
            ? GestureDetector(onTap: open, child: Padding(padding: const EdgeInsets.all(10), child: Avatar(barName.isEmpty ? '?' : barName, '?', size: 34)))
            : IconButton(tooltip: 'Menu', onPressed: open, icon: barIcon('menu', color: ic));
      }) : null,
      automaticallyImplyLeading: back,
      title: Text(brand ? app.name : app.fill(title), style: TextStyle(fontWeight: brand ? FontWeight.w900 : FontWeight.w800, fontSize: brand ? 22 : b.size)),
      actions: [
        for (final a in b.actions.reversed) // (the first sits at the right edge)
          if (a.only.isEmpty || a.only.contains(page))
            IconButton(
              tooltip: a.icon,
              style: b.circles == 'plain' ? null : IconButton.styleFrom(
                backgroundColor: b.circles == 'circles' ? (dark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.06)) : null,
                side: b.circles == 'outlined circles' ? BorderSide(color: ic.withValues(alpha: 0.35), width: 1.4) : null,
              ),
              icon: Badge(
                isLabelVisible: a.badge.isNotEmpty && (num.tryParse(AppState.show(app.get(a.badge))) ?? 0) > 0,
                label: Text(AppState.show(app.get(a.badge))),
                child: barIcon(a.icon == 'theme' ? (dark ? 'sun' : 'moon') : a.icon, color: ic, size: b.circles == 'plain' ? 24 : 20),
              ),
              onPressed: () {
                if (a.does.contains('dark mode')) { app.set('darkMode', !dark); }
                else if (a.does.startsWith('page:')) { app.go(a.does.substring(5)); }
                else { app.send(a.does); }
              },
            ),
        const SizedBox(width: 4),
      ],
    );
  }

  static List<Widget> _spaced(List<Widget> k, double side) => [
        for (var i = 0; i < k.length; i++) ...[
          if (i > 0 && k[i] is! Expanded && k[i] is! Spacer) const SizedBox(height: 12),
          k[i] is FullBleed || k[i] is Spacer ? k[i] : k[i] is Expanded ? Expanded(child: Padding(padding: EdgeInsets.symmetric(horizontal: side), child: (k[i] as Expanded).child)) : Padding(padding: EdgeInsets.symmetric(horizontal: side), child: k[i]),
        ],
      ];
}

/// Text with {variables} filled in.
class PText extends StatelessWidget {
  const PText(this.text, {super.key, this.size = 16, this.weight = 600, this.color, this.align = 'left'});
  final String text;
  final double size;
  final int weight;
  final String? color;
  final String align; // left, center or right
  @override
  Widget build(BuildContext context) {
    final p = pal(context), a = align == 'center' ? TextAlign.center : align == 'right' ? TextAlign.right : TextAlign.left;
    return SizedBox(
      width: double.infinity,
      child: Text(app.fill(text), textAlign: a, style: TextStyle(fontSize: size, height: 1.2, fontWeight: FontWeight.values[((weight ~/ 100) - 1).clamp(0, 8)], color: p.resolve(color) ?? p.text)),
    );
  }
}

enum Look { filled, outlined, danger, plain }

/// A button in the project's look: filled, outlined or plain (a link), with its own colours, height and corners.
class PButton extends StatelessWidget {
  const PButton(this.label, {super.key, required this.onTap, this.look = Look.filled, this.bg, this.fg, this.stroke, this.height = 52, this.radius = 16, this.size = 17});
  final String label;
  final VoidCallback onTap;
  final Look look;
  final String? bg, fg, stroke;
  final double height, radius, size;
  @override
  Widget build(BuildContext context) {
    // the words shrink to fit rather than being cut short
    final p = pal(context), text = FittedBox(fit: BoxFit.scaleDown, child: Text(app.fill(label), maxLines: 1, style: TextStyle(fontSize: size, fontWeight: FontWeight.w800)));
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(radius));
    final min = Size.fromHeight(height);
    final f = p.resolve(fg);
    return switch (look) {
      Look.filled => FilledButton(onPressed: onTap, style: FilledButton.styleFrom(minimumSize: min, shape: shape, padding: const EdgeInsets.symmetric(horizontal: 8), backgroundColor: p.resolve(bg) ?? p.accent, foregroundColor: f ?? p.onAccent), child: text),
      Look.danger => OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: min, shape: shape, foregroundColor: f ?? p.danger, side: BorderSide(color: p.resolve(stroke) ?? p.danger, width: 2), backgroundColor: p.resolve(bg) ?? p.card), child: text),
      Look.outlined => OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: min, shape: shape, padding: const EdgeInsets.symmetric(horizontal: 8), foregroundColor: f ?? p.accent, backgroundColor: p.resolve(bg), side: BorderSide(color: p.resolve(stroke) ?? f ?? p.accent, width: 2)), child: text),
      Look.plain => TextButton(onPressed: onTap, style: TextButton.styleFrom(minimumSize: min, padding: const EdgeInsets.symmetric(horizontal: 4), foregroundColor: f ?? p.accent), child: text),
    };
  }
}

/// Where a thing sits in a card (PBox): the anchor (0, ½ or 1 of the width / height), the offset from it, its size and how its text lines up,
/// all in the design's sizes (the card scales them to the phone's width).
class Pin {
  const Pin({this.fx = 0.5, this.fy = 0.5, this.x = 0, this.y = 0, this.w = 0, this.h = 0, this.align = 'center', this.m = -1, this.wrap = 0, this.cell = -1, this.cells = 0, required this.child});
  final double fx, fy, x, y, w, h, m, wrap;
  final String align;
  final int cell, cells;
  final Widget child;
}

/// A card, badge, picture box or tappable row: its size, colours, corners, its own centred text, and the things in it where the design puts them.
class PBox extends StatelessWidget {
  const PBox({super.key, this.w = 368, this.h = 48, this.radius = 0, this.fill = '', this.stroke = '', this.strokeW = 0, this.shadow = false, this.text = '', this.textSize = 16, this.textWeight = 600, this.textColor = '', this.row, this.onTap, this.pins = const []});
  final double w, h, radius, strokeW, textSize;
  final String fill, stroke, text, textColor;
  final int textWeight;
  final bool shadow;
  final double? row; // a row: its stretched things share the width, this far apart
  final VoidCallback? onTap;
  final List<Pin> pins;

  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    final body = LayoutBuilder(builder: (context, c) {
      final double dw = w > 0 ? w : 368, width = c.hasBoundedWidth ? c.maxWidth : dw, s = width / dw;
      return SizedBox(width: width, height: h, child: Stack(clipBehavior: Clip.none, children: [
        if (text.isNotEmpty) Center(child: Text(app.fill(text), textAlign: TextAlign.center, style: TextStyle(fontSize: textSize, height: 1.15, fontWeight: FontWeight.values[((textWeight ~/ 100) - 1).clamp(0, 8)], color: p.resolve(textColor) ?? p.text))),
        for (final q in pins) _place(q, width, s),
      ]));
    });
    final deco = BoxDecoration(
      color: p.resolve(fill),
      borderRadius: BorderRadius.circular(radius),
      border: stroke.isEmpty ? null : Border.all(color: p.resolve(stroke) ?? p.line, width: strokeW > 0 ? strokeW : 1),
      boxShadow: shadow ? const [BoxShadow(color: Color(0x1A000000), blurRadius: 12, offset: Offset(0, 3))] : null,
    );
    final card = Container(height: h, decoration: deco, clipBehavior: Clip.antiAlias, child: body);
    return onTap == null ? card : Material(color: Colors.transparent, child: InkWell(onTap: onTap, borderRadius: BorderRadius.circular(radius), child: card));
  }

  Widget _place(Pin q, double width, double s) {
    final px = q.fx * width + q.x * s, top = q.fy * h + q.y;
    double left, wd;
    if (q.cells > 0 && row != null) { final cw = (width - row! * s * (q.cells - 1)) / q.cells; left = q.cell * (cw + row! * s) + q.m * s; wd = cw - 2 * q.m * s; }
    else if (q.m >= 0) { left = q.m * s; wd = width - 2 * q.m * s; }
    else if (q.w > 0) { wd = q.w * s; left = px - wd / 2; }
    else if (q.align == 'left') { wd = (q.wrap > 0 ? q.wrap * s : width) .clamp(0, width - px - 2).toDouble(); left = px; }
    else if (q.align == 'right') { wd = (q.wrap > 0 ? q.wrap * s : width).clamp(0, px - 2).toDouble(); left = px - wd; }
    else { final half = (px < width - px ? px : width - px) - 2; wd = q.wrap > 0 && q.wrap * s < 2 * half ? q.wrap * s : 2 * half; left = px - wd / 2; }
    return Positioned(
      left: left, top: top, width: wd < 0 ? 0 : wd,
      child: FractionalTranslation(translation: const Offset(0, -0.5), child: q.h > 0 ? SizedBox(height: q.h, child: q.child) : q.child),
    );
  }
}

/// A thing narrower than the page on its own line: left, centred or right, as in the design.
class Place extends StatelessWidget {
  const Place({super.key, this.fx = 0.5, required this.width, required this.child});
  final double fx, width;
  final Widget child;
  @override
  Widget build(BuildContext context) => Align(alignment: Alignment(fx * 2 - 1, 0), child: ConstrainedBox(constraints: BoxConstraints(maxWidth: width), child: SizedBox(width: double.infinity, child: child)));
}

/// Room between things.
class PSpace extends StatelessWidget {
  const PSpace(this.h, {super.key});
  final double h;
  @override
  Widget build(BuildContext context) => SizedBox(height: h > 12 ? h - 12 : 0);
}

/// A bar that fills from a variable (XP, health…).
class PBar extends StatelessWidget {
  const PBar(this.variable, {super.key, this.max = 100, this.height = 12, this.fill = '@accent', this.bg = '@line', this.radius = 6});
  final String variable, fill, bg;
  final double max, height, radius;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), v = (nv(app.get(variable)) / (max == 0 ? 1 : max)).clamp(0.0, 1.0).toDouble();
    return ClipRRect(borderRadius: BorderRadius.circular(radius), child: SizedBox(height: height, child: Stack(children: [
      Positioned.fill(child: ColoredBox(color: p.resolve(bg) ?? p.line)),
      FractionallySizedBox(widthFactor: v, heightFactor: 1, child: ColoredBox(color: p.resolve(fill) ?? p.accent)),
    ])));
  }
}

/// A slider for a number variable.
class PSlider extends StatelessWidget {
  const PSlider(this.variable, {super.key, this.min = 0, this.max = 100, this.step = 1});
  final String variable;
  final double min, max, step;
  @override
  Widget build(BuildContext context) {
    final v = nv(app.get(variable)).toDouble().clamp(min, max).toDouble();
    return Slider(value: v, min: min, max: max, divisions: step > 0 ? ((max - min) / step).round().clamp(1, 1000) : null, onChanged: (x) => app.set(variable, x));
  }
}

/// Segmented tabs: pick one (keeps its text, or its position 1, 2, 3…).
class Segmented extends StatelessWidget {
  const Segmented(this.variable, this.options, {super.key, this.index = false});
  final String variable;
  final List<String> options;
  final bool index;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), cur = AppState.show(app.get(variable));
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: p.field, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        for (var i = 0; i < options.length; i++)
          Expanded(child: GestureDetector(
            onTap: () => app.set(variable, index ? i + 1 : options[i]),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: (index ? cur == '${i + 1}' : cur == options[i]) ? p.accent : Colors.transparent, borderRadius: BorderRadius.circular(10)),
              child: Text(options[i], maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: (index ? cur == '${i + 1}' : cur == options[i]) ? p.onAccent : p.sub)),
            ),
          )),
      ]),
    );
  }
}

/// Chips: pick one.
class Chips extends StatelessWidget {
  const Chips(this.variable, this.options, {super.key});
  final String variable;
  final List<String> options;
  @override
  Widget build(BuildContext context) {
    final cur = AppState.show(app.get(variable));
    return Wrap(spacing: 8, runSpacing: 8, children: [for (final o in options) ChoiceChip(label: Text(o), selected: cur == o, onSelected: (_) => app.set(variable, o))]);
  }
}

/// A drop-down list: label | value lines.
class PDropdown extends StatelessWidget {
  const PDropdown(this.variable, this.options, {super.key, this.placeholder = 'Choose…'});
  final String variable, placeholder;
  final List<(String, String)> options;
  @override
  Widget build(BuildContext context) {
    final cur = AppState.show(app.get(variable));
    return DropdownButtonFormField<String>(
      initialValue: options.any((o) => o.$2 == cur) ? cur : null,
      hint: Text(placeholder),
      items: [for (final o in options) DropdownMenuItem(value: o.$2, child: Text(o.$1))],
      onChanged: (v) => app.set(variable, v),
    );
  }
}

/// − number +
class PStepper extends StatelessWidget {
  const PStepper(this.variable, {super.key, this.min = 0, this.max = 10, this.step = 1});
  final String variable;
  final num min, max, step;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), v = nv(app.get(variable));
    Widget b(String t, num d) => IconButton.filled(onPressed: () => app.set(variable, (v + d).clamp(min, max)), style: IconButton.styleFrom(backgroundColor: p.accent, foregroundColor: p.onAccent), icon: Text(t, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)));
    return Row(mainAxisSize: MainAxisSize.min, children: [b('−', -step), SizedBox(width: 48, child: Text(AppState.show(v), textAlign: TextAlign.center, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))), b('+', step)]);
  }
}

/// Tap a star.
class PRating extends StatelessWidget {
  const PRating(this.variable, {super.key, this.max = 5});
  final String variable;
  final int max;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), v = nv(app.get(variable));
    return Row(mainAxisSize: MainAxisSize.min, children: [for (var i = 0; i < max; i++) GestureDetector(onTap: () => app.set(variable, i + 1), child: Text('★', style: TextStyle(fontSize: 30, color: i < v ? const Color(0xFFF5B301) : p.line)))]);
  }
}

/// A thin line, with a word in the middle.
class PDivider extends StatelessWidget {
  const PDivider({super.key, this.label = ''});
  final String label;
  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    if (label.isEmpty) return Divider(color: p.line, height: 1);
    return Row(children: [Expanded(child: Divider(color: p.line)), Padding(padding: const EdgeInsets.symmetric(horizontal: 10), child: Text(app.fill(label), style: TextStyle(color: p.sub, fontSize: 13))), Expanded(child: Divider(color: p.line))]);
  }
}

/// A notice: info, success, warning or error.
class PBanner extends StatelessWidget {
  const PBanner({super.key, this.tone = 'info', this.title = '', this.text = '', this.icon = ''});
  final String tone, title, text, icon;
  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    final (bg, fg) = switch (tone) { 'warning' => (const Color(0xFFFFF4D6), const Color(0xFF7A5200)), 'error' => (const Color(0xFFFFE1E1), const Color(0xFF8A1C1C)), 'success' => (const Color(0xFFDDF6E8), const Color(0xFF145C34)), _ => (p.accent.withValues(alpha: 0.14), p.text) };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (icon.isNotEmpty) Padding(padding: const EdgeInsets.only(right: 10), child: Text(icon, style: const TextStyle(fontSize: 18))),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (title.isNotEmpty) Text(app.fill(title), style: TextStyle(fontWeight: FontWeight.w800, color: fg)),
          if (text.isNotEmpty) Text(app.fill(text), style: TextStyle(color: fg)),
        ])),
      ]),
    );
  }
}

/// Level badge, XP bar and xp / needed (each level needs base × growth^(level − 1)).
class XpBar extends StatelessWidget {
  const XpBar({super.key, this.xpVar = 'xp', this.levelVar = 'playerLevel', this.base = 100, this.growth = 1.4});
  final String xpVar, levelVar;
  final double base, growth;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), lv = nv(app.get(levelVar)) < 1 ? 1 : nv(app.get(levelVar)).toInt(), xp = nv(app.get(xpVar));
    var need = base;
    for (var i = 1; i < lv; i++) { need *= growth; }
    return Row(children: [
      CircleAvatar(radius: 15, backgroundColor: p.accent, child: Text('$lv', style: TextStyle(color: p.onAccent, fontWeight: FontWeight.w800))),
      const SizedBox(width: 10),
      Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: (xp / need).clamp(0, 1).toDouble(), minHeight: 12, color: p.accent, backgroundColor: p.line))),
      const SizedBox(width: 10),
      Text('${AppState.show(xp)} / ${need.round()}', style: TextStyle(color: p.sub, fontWeight: FontWeight.w700)),
    ]);
  }
}

/// Numbered steps (the one in the variable is lit).
class PSteps extends StatelessWidget {
  const PSteps(this.variable, this.steps, {super.key});
  final String variable;
  final List<String> steps;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), cur = nv(app.get(variable)) < 1 ? 1 : nv(app.get(variable));
    return Row(children: [
      for (var i = 0; i < steps.length; i++)
        Expanded(child: Column(children: [
          CircleAvatar(radius: 14, backgroundColor: i + 1 <= cur ? p.accent : p.line, child: Text(i + 1 < cur ? '✓' : '${i + 1}', style: TextStyle(color: i + 1 <= cur ? p.onAccent : p.sub, fontWeight: FontWeight.w800, fontSize: 13))),
          const SizedBox(height: 4),
          Text(steps[i], style: TextStyle(color: i + 1 == cur ? p.text : p.sub, fontSize: 12, fontWeight: i + 1 == cur ? FontWeight.w700 : FontWeight.w500)),
        ])),
    ]);
  }
}

/// Loading.
class PSpinner extends StatelessWidget {
  const PSpinner({super.key});
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}

/// Your picture: an emoji, or the initials of {playerName}.
class PAvatar extends StatelessWidget {
  const PAvatar({super.key, this.emoji = '', this.size = 64});
  final String emoji;
  final double size;
  @override
  Widget build(BuildContext context) => Center(child: Avatar(meName, me, size: size, label: emoji.isEmpty ? null : emoji));
}

/// A card with things side by side (a settings row, a summary).
class PCard extends StatelessWidget {
  const PCard({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), child: Row(children: [for (var i = 0; i < children.length; i++) i == 0 ? Expanded(child: children[i]) : children[i]])));
}

/// A text box that edits a variable (search boxes too).
class VarField extends StatefulWidget {
  const VarField(this.variable, {super.key, this.placeholder = '', this.keyboard = 'text', this.outlined = false});
  final String variable, placeholder, keyboard;
  final bool outlined;
  @override
  State<VarField> createState() => _VarFieldState();
}

class _VarFieldState extends State<VarField> {
  late final c = TextEditingController(text: AppState.show(app.get(widget.variable)));
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), line = OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: p.line));
    return TextField(
      controller: c,
      obscureText: widget.keyboard == 'password',
      keyboardType: widget.keyboard == 'number' ? TextInputType.number : widget.keyboard == 'email' ? TextInputType.emailAddress : TextInputType.text,
      decoration: InputDecoration(
        hintText: widget.placeholder,
        prefixIcon: widget.keyboard == 'search' ? Icon(Icons.search, color: p.sub) : null,
        // outlined: a white box with a thin line (the project's input has a stroke)
        fillColor: widget.outlined ? p.card : null,
        enabledBorder: widget.outlined ? line : null,
        focusedBorder: widget.outlined ? line.copyWith(borderSide: BorderSide(color: p.accent, width: 2)) : null,
      ),
      onChanged: (v) => app.set(widget.variable, widget.keyboard == 'number' ? num.tryParse(v) ?? 0 : v),
    );
  }
}

/// A switch for a yes/no variable (darkMode switches the app's look).
class VarSwitch extends StatelessWidget {
  const VarSwitch(this.variable, {super.key, this.label = ''});
  final String variable, label;
  @override
  Widget build(BuildContext context) {
    final on = app.get(variable) == true || (variable == 'darkMode' && app.get(variable) == null && Theme.of(context).brightness == Brightness.dark);
    final s = Switch(value: on, onChanged: (v) => app.set(variable, v));
    return label.isEmpty ? Align(alignment: Alignment.centerRight, child: s) : SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(app.fill(label)), value: on, onChanged: (v) => app.set(variable, v));
  }
}

/// The records of a collection: tap one to open it, tick its checkbox, swipe to delete.
class RecordList extends StatelessWidget {
  const RecordList({super.key, required this.collection, this.title = '{title}', this.subtitle = '', this.right = '', this.icon = '', this.check = '', this.search = '', this.filter = '', this.sort = 'newest first', this.openPage = '', this.empty = 'Nothing here yet', this.swipeDelete = true, this.rowH = 64, this.gap = 8, this.radius = 14, this.doneLook = true});
  final String collection, title, subtitle, right, icon, check, search, filter, sort, openPage, empty;
  final bool swipeDelete, doneLook;
  final double rowH, gap, radius;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection, filter: filter, search: search.isEmpty ? '' : AppState.show(app.get(search)), sort: sort);
    if (rows.isEmpty) return Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(empty, textAlign: TextAlign.center, style: TextStyle(color: p.sub, fontSize: 16))));
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: rows.length,
      separatorBuilder: (_, _) => SizedBox(height: gap),
      itemBuilder: (context, i) {
        final r = rows[i], id = '${r['_id']}', done = check.isNotEmpty && (r[check] == true || r[check] == 1), faded = done && doneLook;
        // a row the way the app draws it: a round tick, the title (struck through when done), the line under it, swipe left to delete
        final row = Material(
          color: p.card,
          borderRadius: BorderRadius.circular(radius),
          child: InkWell(
            borderRadius: BorderRadius.circular(radius),
            onTap: openPage.isEmpty ? null : () { app.open(collection, id); app.go(openPage); },
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: rowH),
              child: Opacity(
                opacity: faded ? 0.55 : 1,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(children: [
                    if (check.isNotEmpty)
                      GestureDetector(
                        onTap: () => app.updateRecord(collection, id, {check: !done}),
                        child: Container(
                          width: 28, height: 28, margin: const EdgeInsets.only(right: 14),
                          decoration: BoxDecoration(shape: BoxShape.circle, color: done ? p.accent : null, border: Border.all(color: done ? p.accent : p.sub, width: 2)),
                          child: done ? const Icon(Icons.check, size: 18, color: Colors.white) : null,
                        ),
                      )
                    else if (icon.isNotEmpty)
                      Padding(padding: const EdgeInsets.only(right: 14), child: Text(app.fill(icon, r, collection), style: const TextStyle(fontSize: 26))),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(app.fill(title, r, collection), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.text, decoration: done ? TextDecoration.lineThrough : null)),
                      if (subtitle.isNotEmpty) Text(app.fill(subtitle, r, collection), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.sub, fontWeight: FontWeight.w600)),
                    ])),
                    if (right.isNotEmpty) Text(app.fill(right, r, collection), style: TextStyle(color: p.sub, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ),
          ),
        );
        if (!swipeDelete) return row;
        return Dismissible(
          key: ValueKey(id),
          direction: DismissDirection.endToStart,
          background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 24), decoration: BoxDecoration(color: p.danger, borderRadius: BorderRadius.circular(radius)), child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
          onDismissed: (_) => app.deleteRecord(collection, id),
          child: row,
        );
      },
    );
  }
}

enum FormMode { auto, newRecord, editOpened }

/// A form for a record: adds a new one, or changes the opened one.
class RecordForm extends StatefulWidget {
  const RecordForm({super.key, required this.collection, this.fields = const [], this.mode = FormMode.auto, this.saveLabel = 'Save', this.after = 'go back', this.page = ''});
  final String collection, saveLabel, after, page;
  final List<String> fields;
  final FormMode mode;
  @override
  State<RecordForm> createState() => _RecordFormState();
}

class _RecordFormState extends State<RecordForm> {
  final values = <String, Object?>{};
  final text = <String, TextEditingController>{};
  late final bool editing = widget.mode == FormMode.editOpened || (widget.mode == FormMode.auto && app.opened != null && app.openCollection == widget.collection);
  List<Field> get fields { final all = app.def(widget.collection)?.fields ?? []; return widget.fields.isEmpty ? all : [for (final k in widget.fields) ...all.where((f) => f.key == k)]; }

  static String today() { final d = DateTime.now(); return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}'; }

  @override
  void initState() {
    super.initState();
    final o = editing ? app.opened : null;
    for (final f in fields) {
      final v = o != null ? o[f.key] : f.def == 'today' ? today() : f.type == 'yes/no' ? (f.def == true || f.def == 'yes') : f.def;
      values[f.key] = v;
      if (!['choice', 'yes/no', 'date'].contains(f.type)) text[f.key] = TextEditingController(text: AppState.show(v));
    }
  }

  @override
  void dispose() { for (final c in text.values) { c.dispose(); } super.dispose(); }

  void save() {
    for (final f in fields) {
      final c = text[f.key];
      if (c != null) values[f.key] = ['number', 'money'].contains(f.type) ? num.tryParse(c.text) ?? 0 : c.text;
    }
    if (editing && app.openId != null) { app.updateRecord(widget.collection, app.openId!, values); }
    else { app.addRecord(widget.collection, values); }
    switch (widget.after) {
      case 'clear the form': setState(() { for (final c in text.values) { c.clear(); } });
      case 'go to page': app.go(widget.page);
      case 'stay': break;
      default: app.back();
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    return ListView(padding: const EdgeInsets.fromLTRB(4, 8, 4, 32), children: [
      for (final f in fields) ...[
        Padding(padding: const EdgeInsets.only(left: 4, bottom: 6, top: 10), child: Text(f.name, style: TextStyle(color: p.sub, fontWeight: FontWeight.w700))),
        _input(f, p),
      ],
      const SizedBox(height: 24),
      PButton(widget.saveLabel, onTap: save),
    ]);
  }

  Widget _input(Field f, Palette p) {
    switch (f.type) {
      case 'yes/no':
        return Card(child: SwitchListTile(title: Text(f.name), value: values[f.key] == true, onChanged: (v) => setState(() => values[f.key] = v)));
      case 'choice':
        final cur = f.options.contains(values[f.key]) ? values[f.key] as String : null;
        return DropdownButtonFormField<String>(initialValue: cur, items: [for (final o in f.options) DropdownMenuItem(value: o, child: Text(o))], onChanged: (v) => setState(() => values[f.key] = v));
      case 'date':
        return Card(child: ListTile(
          leading: const Icon(Icons.calendar_today),
          title: Text(AppState.show(values[f.key]).isEmpty ? 'Pick a date' : AppState.show(values[f.key])),
          onTap: () async {
            final d = await showDatePicker(context: context, firstDate: DateTime(2000), lastDate: DateTime(2100), initialDate: DateTime.tryParse(AppState.show(values[f.key])) ?? DateTime.now());
            if (d != null) setState(() => values[f.key] = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
          },
        ));
      default:
        return TextField(
          controller: text[f.key],
          maxLines: f.type == 'long text' ? 5 : 1,
          keyboardType: ['number', 'money'].contains(f.type) ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
          decoration: InputDecoration(hintText: f.name, prefixText: f.type == 'money' ? '\$ ' : null),
        );
    }
  }
}

/// A plain list of lines.
class StaticList extends StatelessWidget {
  const StaticList(this.items, {super.key});
  final List<String> items;
  @override
  Widget build(BuildContext context) => Card(child: Column(children: [for (final t in items) ListTile(title: Text(app.fill(t)))]));
}

/// A picture from the web.
class PImage extends StatelessWidget {
  const PImage(this.url, {super.key, this.height = 160});
  final String url;
  final double height;
  @override
  Widget build(BuildContext context) => ClipRRect(borderRadius: BorderRadius.circular(16), child: Image.network(url, height: height, fit: BoxFit.cover));
}

/// A Pocket component with no native version yet: shows where it goes.
class TodoBox extends StatelessWidget {
  const TodoBox(this.name, this.type, {super.key});
  final String name, type;
  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: p.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: p.line, width: 2)),
      child: Column(children: [Icon(Icons.construction, color: p.sub), const SizedBox(height: 8), Text(name, style: TextStyle(fontWeight: FontWeight.w800, color: p.text)), Text('$type: to build natively', style: TextStyle(color: p.sub))]),
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Social building blocks: a feed, a composer, stories, messages, profiles, a marketplace, notifications…
// They read and change the same data collections as the app (Posts, Messages, Stories, Listings, Profiles…).
// ---------------------------------------------------------------------------------------------------------------

/// You: {playerName} and {playerHandle}; no name yet → “You”, @you (the same as the editor).
String get meName => AppState.show(app.get('playerName')).isEmpty ? 'You' : AppState.show(app.get('playerName'));
/// The name on the App Bar's avatar: “Me” until there is a playerName variable, then the name (blank shows “?”).
String get barName => app.vars.containsKey('playerName') ? AppState.show(app.get('playerName')) : 'Me';
String get me => AppState.show(app.get('playerHandle')).isEmpty ? meName.toLowerCase().replaceAll(RegExp(r'\s+'), '') : AppState.show(app.get('playerHandle'));
String sv(Map<String, Object?> r, String k) => AppState.show(r[k]);
bool isOn(Object? v) => v == true || v == 1 || v == 'yes' || v == 'true';
num nv(Object? v) => v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
// the engine's avatar colours and initials (Maya Chen → MC)
const _avatarColors = [0xFFEF5350, 0xFFEC407A, 0xFFAB47BC, 0xFF7E57C2, 0xFF5C6BC0, 0xFF42A5F5, 0xFF26A69A, 0xFF66BB6A, 0xFFFFA726, 0xFF8D6E63];
Color avatarColor(String s) {
  var n = 0;
  for (final c in (s.isEmpty ? '?' : s).codeUnits) { n = (n * 31 + c) & 0xFFFFFFFF; }
  return Color(_avatarColors[n % _avatarColors.length]);
}
String initials(String s) {
  final w = s.trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).take(2).map((x) => String.fromCharCode(x.runes.first).toUpperCase()).join();
  return w.isEmpty ? '?' : w;
}
List<String> mediaList(Object? m) => AppState.show(m).split('|').map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
String firstMedia(Object? m) { final l = mediaList(m); return l.isEmpty ? '' : l.first; }
bool isUrl(String s) => s.startsWith('http:') || s.startsWith('https:');
Color? hexColor(String v) => RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(v) ? Color(int.parse('FF${v.substring(1)}', radix: 16)) : null;
Color colorOf(Map<String, Object?> r, String seed) => hexColor(sv(r, 'color')) ?? avatarColor(seed);
/// 1284 → 1.3K, 48200 → 48K.
String compactNum(Object? v) {
  final n = nv(v);
  if (n < 1000) return '${n.round()}';
  if (n < 10000) return '${((n / 100).round() / 10).toString().replaceAll('.0', '')}K';
  if (n < 1e6) return '${(n / 1000).round()}K';
  return '${((n / 1e5).round() / 10).toString().replaceAll('.0', '')}M';
}
/// 9m, 2h, 3d, then the date.
String ago(Object? at) {
  final t = nv(at);
  if (t < 1e11) return '';
  final s = (DateTime.now().millisecondsSinceEpoch - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return '${s ~/ 60}m';
  if (s < 86400) return '${s ~/ 3600}h';
  if (s < 604800) return '${s ~/ 86400}d';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final d = DateTime.fromMillisecondsSinceEpoch(t.toInt());
  return '${months[d.month - 1]} ${d.day}';
}
/// The colours of a CSS gradient ("linear-gradient(135deg,#f58529,#dd2a7b)").
List<Color> gradientColors(Object? bg) => RegExp(r'#[0-9a-fA-F]{6}').allMatches(AppState.show(bg)).map((m) => hexColor(m[0]!)!).toList();

/// Opens a person's profile page (it shows {profile} and {profile_name}).
void openProfile(String page, String handle, String name) {
  if (page.isEmpty) return;
  app.vars['profile'] = handle;
  app.vars['profile_name'] = name;
  app.go(page);
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, this.seed, {super.key, this.size = 40, this.label});
  final String name, seed;
  final double size;
  final String? label;
  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: size / 2,
        backgroundColor: avatarColor(name.isEmpty ? seed : name),
        child: Text(label ?? initials(name.isEmpty ? seed : name), style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: size * (label == null ? 0.38 : 0.5))),
      );
}

/// A picture: a photo from the web, or an emoji on a colour.
class Tile extends StatelessWidget {
  const Tile(this.media, this.color, {super.key, this.height = 200});
  final String media;
  final Color color;
  final double height;
  @override
  Widget build(BuildContext context) => isUrl(media)
      ? Image.network(media, height: height, width: double.infinity, fit: BoxFit.cover)
      : Container(height: height, width: double.infinity, alignment: Alignment.center, color: color, child: Text(media, style: TextStyle(fontSize: (height < 150 ? height : 150) * 0.42)));
}

/// A post's first picture (rounded).
class Media extends StatelessWidget {
  const Media(this.row, {super.key, this.height = 200, this.radius = 12});
  final Map<String, Object?> row;
  final double height, radius;
  @override
  Widget build(BuildContext context) {
    final m = firstMedia(row['media']);
    if (m.isEmpty) return const SizedBox.shrink();
    return ClipRRect(borderRadius: BorderRadius.circular(radius), child: Tile(m, colorOf(row, sv(row, 'handle') + m), height: height));
  }
}

/// 1 to 4 pictures, laid out like the app's feed: one big, two side by side, one big and two stacked, two by two.
class MediaGrid extends StatelessWidget {
  const MediaGrid(this.row, {super.key, this.height = 220});
  final Map<String, Object?> row;
  final double height;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), l = mediaList(row['media']).take(4).toList();
    if (l.isEmpty) return const SizedBox.shrink();
    final bg = colorOf(row, sv(row, 'handle') + l.first), half = height / 2 - 1;
    Widget col(List<String> ms) => Expanded(child: Column(children: [Tile(ms[0], bg, height: half), const SizedBox(height: 2), Tile(ms[1], bg, height: half)]));
    final Widget body = switch (l.length) {
      1 => Tile(l[0], bg, height: height),
      2 => Row(children: [Expanded(child: Tile(l[0], bg, height: height)), const SizedBox(width: 2), Expanded(child: Tile(l[1], bg, height: height))]),
      3 => Row(children: [Expanded(child: Tile(l[0], bg, height: height)), const SizedBox(width: 2), col([l[1], l[2]])]),
      _ => Row(children: [col([l[0], l[2]]), const SizedBox(width: 2), col([l[1], l[3]])]),
    };
    return Container(decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: p.line)), clipBehavior: Clip.antiAlias, child: body);
  }
}

/// A tab on top of a feed: its name and which posts it shows (following, saved, media, replies, posts, likes, or a filter).
class FeedTab {
  const FeedTab(this.label, [this.only = '', this.look = '']);
  final String label, only, look;
}

/// Posts, newest first, the way the app draws them (X style): avatar, name ✓ @handle · 9m, text with #tags, pictures, and
/// comment / repost / like / views / save / share. Tap the author for their profile. look: timeline, reels or grid.
class SocialFeed extends StatefulWidget with FullBleed {
  const SocialFeed({super.key, this.collection = 'Posts', this.look = 'timeline', this.filter = '', this.search = '', this.columns = 3, this.profilePage = '', this.empty = 'No posts yet', this.tabs = const [], this.actions = const ['comment', 'repost', 'like', 'share']});
  final String collection, look, filter, search, profilePage, empty;
  final int columns;
  final List<FeedTab> tabs;
  final List<String> actions;
  @override
  State<SocialFeed> createState() => _SocialFeedState();
}

class _SocialFeedState extends State<SocialFeed> {
  int tab = 0;
  String get collection => widget.collection;

  void _toggle(Map<String, Object?> r, String flag, [String? count]) {
    final now = !isOn(r[flag]);
    final change = <String, Object?>{flag: now};
    if (count != null) change[count] = (nv(r[count]) + (now ? 1 : -1)).clamp(0, 1 << 31);
    app.updateRecord(collection, sv(r, '_id'), change);
  }

  /// A tab's test, or null when "only" is a filter for the query.
  bool Function(Map<String, Object?>)? _test(String only) {
    final o = only.trim().toLowerCase();
    switch (o) {
      case '': return (_) => true;
      case 'following':
        final f = {for (final r in app.rows('Follows')) if (sv(r, 'follower') == me) sv(r, 'followee')};
        return (r) => f.contains(sv(r, 'handle')) || isOn(r['following']);
      case 'saved': return (r) => isOn(r['saved']);
      case 'media': return (r) => firstMedia(r['media']).isNotEmpty;
      case 'replies': return (r) => sv(r, 'reply_to').isNotEmpty;
      case 'posts': return (r) => sv(r, 'reply_to').isEmpty;
      case 'likes': return (r) => isOn(r['liked']);
      default: return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = pal(context), t = widget.tabs.isEmpty ? null : widget.tabs[tab.clamp(0, widget.tabs.length - 1)];
    final test = t == null ? null : _test(t.only);
    final filter = [widget.filter, if (t != null && test == null) t.only].where((x) => x.isNotEmpty).join(' and ');
    final rows = app.query(collection, filter: filter, search: widget.search.isEmpty ? '' : AppState.show(app.get(widget.search))).where(test ?? (_) => true).toList();
    final look = (t?.look.isNotEmpty ?? false) ? t!.look : widget.look;
    final Widget body = rows.isEmpty
        ? Padding(padding: const EdgeInsets.all(32), child: Text(widget.empty, textAlign: TextAlign.center, style: TextStyle(color: p.sub)))
        : look == 'grid'
            ? Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: GridView.count(
                  crossAxisCount: widget.columns, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 4, crossAxisSpacing: 4,
                  children: [for (final r in rows) GestureDetector(onTap: () => openProfile(widget.profilePage, sv(r, 'handle'), sv(r, 'author')), child: firstMedia(r['media']).isEmpty ? Container(color: avatarColor(sv(r, 'author')), padding: const EdgeInsets.all(6), child: Text(sv(r, 'text'), maxLines: 4, style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w700))) : Media(r, height: 120, radius: 6))],
                ),
              )
            : Column(children: [for (final r in rows) look == 'reels' ? _reel(r, p) : _post(r, p)]);
    if (widget.tabs.length < 2) return body;
    return Column(children: [
      Container(
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: p.line))),
        child: Row(children: [
          for (var i = 0; i < widget.tabs.length; i++)
            Expanded(child: InkWell(
              onTap: () => setState(() => tab = i),
              child: Padding(padding: const EdgeInsets.only(top: 14), child: Column(children: [
                Text(widget.tabs[i].label, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: i == tab ? p.text : p.sub)),
                const SizedBox(height: 10),
                Container(height: 4, width: 48, decoration: BoxDecoration(color: i == tab ? p.accent : Colors.transparent, borderRadius: BorderRadius.circular(2))),
              ])),
            )),
        ]),
      ),
      body,
    ]);
  }

  Widget _actions(Map<String, Object?> r, Palette p) {
    Widget btn(IconData icon, String count, bool lit, Color color, VoidCallback? tap, {bool grow = true}) {
      final b = InkWell(onTap: tap, child: Padding(padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4), child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 19, color: lit ? color : p.sub),
        if (count.isNotEmpty) Flexible(child: Padding(padding: const EdgeInsets.only(left: 4), child: Text(count, maxLines: 1, overflow: TextOverflow.clip, softWrap: false, style: TextStyle(fontSize: 13.5, color: lit ? color : p.sub)))),
      ])));
      return grow ? Expanded(child: Align(alignment: Alignment.centerLeft, child: b)) : b;
    }
    const pink = Color(0xFFF91880), green = Color(0xFF00BA7C);
    return Row(children: [
      for (final a in widget.actions)
        switch (a) {
          'comment' => btn(Icons.chat_bubble_outline, compactNum(r['comments']), false, p.accent, null),
          'repost' => btn(Icons.repeat, compactNum(r['reposts']), isOn(r['reposted']), green, () => _toggle(r, 'reposted', 'reposts')),
          'like' => btn(isOn(r['liked']) ? Icons.favorite : Icons.favorite_border, compactNum(r['likes']), isOn(r['liked']), pink, () => _toggle(r, 'liked', 'likes')),
          'views' => btn(Icons.bar_chart, compactNum(r['views']), false, p.accent, null),
          'save' => btn(isOn(r['saved']) ? Icons.bookmark : Icons.bookmark_border, '', isOn(r['saved']), p.accent, () => _toggle(r, 'saved'), grow: false),
          'share' => Padding(padding: const EdgeInsets.only(left: 10), child: btn(Icons.ios_share, '', false, p.accent, null, grow: false)),
          _ => const SizedBox.shrink(),
        },
    ]);
  }

  Widget _post(Map<String, Object?> r, Palette p) {
    final grad = firstMedia(r['media']).isEmpty ? gradientColors(r['background']) : <Color>[];
    final sub = ['@${sv(r, 'handle')}', ago(r['_at']), if (sv(r, 'location').isNotEmpty) '📍 ${sv(r, 'location')}'].where((x) => x.isNotEmpty).join(' · ');
    void open() => openProfile(widget.profilePage, sv(r, 'handle'), sv(r, 'author'));
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 2),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: p.line))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(onTap: open, child: Avatar(sv(r, 'author'), sv(r, 'handle'), size: 46)),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          GestureDetector(onTap: open, child: Row(children: [
            // name ✓ @handle · 9m on one line (the name first, the rest cut short when it doesn't fit), ••• at the right edge
            Expanded(child: Text.rich(TextSpan(children: [
              TextSpan(text: sv(r, 'author'), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: p.text)),
              if (isOn(r['verified'])) WidgetSpan(alignment: PlaceholderAlignment.middle, child: Padding(padding: const EdgeInsets.only(left: 3), child: Icon(Icons.verified, size: 17, color: p.accent))),
              TextSpan(text: '  $sub', style: TextStyle(color: p.sub, fontSize: 15)),
            ]), maxLines: 1, overflow: TextOverflow.ellipsis)),
            Icon(Icons.more_horiz, size: 20, color: p.sub),
          ])),
          const SizedBox(height: 4),
          if (grad.isNotEmpty)
            Container(
              height: 150, width: double.infinity, alignment: Alignment.center, padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: LinearGradient(colors: grad.length > 1 ? grad : [grad.first, grad.first], begin: Alignment.topLeft, end: Alignment.bottomRight)),
              child: Text(sv(r, 'text'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            )
          else if (sv(r, 'text').isNotEmpty)
            Text.rich(TextSpan(children: [
              for (final w in sv(r, 'text').splitMapJoin(RegExp(r'[#@]\w+'), onMatch: (m) => '\u0000${m[0]}\u0000', onNonMatch: (n) => n).split('\u0000'))
                if (w.isNotEmpty) TextSpan(text: w, style: TextStyle(color: RegExp(r'^[#@]\w+$').hasMatch(w) ? p.accent : p.text)),
            ]), style: const TextStyle(fontSize: 16)),
          if (sv(r, 'poll').isNotEmpty)
            for (final o in sv(r, 'poll').split('|'))
              Container(
                margin: const EdgeInsets.only(top: 6), padding: const EdgeInsets.symmetric(vertical: 7), width: double.infinity, alignment: Alignment.center,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), border: Border.all(color: p.accent)),
                child: Text(o.trim(), style: TextStyle(color: p.accent, fontWeight: FontWeight.w700)),
              ),
          if (sv(r, 'link').isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.all(10), width: double.infinity,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: p.line)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(sv(r, 'link_title').isEmpty ? sv(r, 'link') : sv(r, 'link_title'), style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(Uri.tryParse(sv(r, 'link'))?.host ?? '', style: TextStyle(color: p.sub)),
              ]),
            ),
          if (firstMedia(r['media']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: MediaGrid(r)),
          _actions(r, p),
        ])),
      ]),
    );
  }

  Widget _reel(Map<String, Object?> r, Palette p) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          InkWell(onTap: () => openProfile(widget.profilePage, sv(r, 'handle'), sv(r, 'author')), child: Row(children: [
            Avatar(sv(r, 'author'), sv(r, 'handle')),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(sv(r, 'author'), style: const TextStyle(fontWeight: FontWeight.w800)), Text('@${sv(r, 'handle')}', style: TextStyle(color: p.sub))])),
          ])),
          const SizedBox(height: 8),
          if (firstMedia(r['media']).isNotEmpty) Media(r, height: 380) else Text(sv(r, 'text'), style: const TextStyle(fontSize: 16)),
          _actions(r, p),
        ]))),
      );
}

/// A box to write a post: Post adds it to the top of the feed.
class Composer extends StatefulWidget {
  const Composer({super.key, this.collection = 'Posts', this.placeholder = 'What’s happening?'});
  final String collection, placeholder;
  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  final c = TextEditingController();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  void post() {
    final t = c.text.trim();
    if (t.isEmpty) return;
    app.addRecord(widget.collection, {'author': meName, 'handle': me, 'text': t, 'likes': 0, 'comments': 0, 'reposts': 0, 'liked': false, 'reposted': false, 'saved': false});
    c.clear();
  }
  @override
  Widget build(BuildContext context) => Row(children: [
        Avatar(meName, me),
        const SizedBox(width: 10),
        Expanded(child: TextField(controller: c, decoration: InputDecoration(hintText: widget.placeholder, isDense: true, border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide.none)), onSubmitted: (_) => post())),
        const SizedBox(width: 10),
        FilledButton(onPressed: post, style: FilledButton.styleFrom(textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)), child: const Text('Post')),
      ]);
}

/// Story circles, one per person (newest first), "Your story" first; tap one to see it.
class Stories extends StatelessWidget {
  const Stories({super.key, this.collection = 'Stories', this.yours = true});
  final String collection;
  final bool yours;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), seen = <String>{};
    final rows = [for (final r in app.query(collection)) if (sv(r, 'handle') != me && seen.add(sv(r, 'handle').isEmpty ? sv(r, 'author') : sv(r, 'handle'))) r];
    Widget label(String t) => Padding(padding: const EdgeInsets.only(top: 4), child: Text(t, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: p.text)));
    return SizedBox(
      height: 98,
      child: ListView(scrollDirection: Axis.horizontal, children: [
        if (yours)
          Padding(padding: const EdgeInsets.only(right: 14), child: Column(children: [
            Stack(clipBehavior: Clip.none, children: [
              Padding(padding: const EdgeInsets.all(3), child: Avatar(meName, me, size: 62)),
              Positioned(right: 0, bottom: 0, child: Container(
                width: 22, height: 22, alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: p.accent, border: Border.all(color: p.bg, width: 2)),
                child: const Icon(Icons.add, size: 14, color: Colors.white),
              )),
            ]),
            label('Your story'),
          ])),
        for (final r in rows)
          GestureDetector(
            onTap: () => showDialog<void>(context: context, builder: (_) => Dialog(
              backgroundColor: colorOf(r, sv(r, 'author')),
              child: SizedBox(height: 460, child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(sv(r, 'author'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                Text(firstMedia(r['media']), style: const TextStyle(fontSize: 110)),
                Text(sv(r, 'text'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 16)),
              ]))),
            )),
            child: Padding(padding: const EdgeInsets.only(right: 14), child: Column(children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6)], begin: Alignment.bottomLeft, end: Alignment.topRight)),
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(shape: BoxShape.circle, color: p.bg),
                  child: firstMedia(r['media']).isEmpty || isUrl(firstMedia(r['media']))
                      ? Avatar(sv(r, 'author'), sv(r, 'handle'), size: 58)
                      : CircleAvatar(radius: 29, backgroundColor: colorOf(r, sv(r, 'author')), child: Text(firstMedia(r['media']), style: const TextStyle(fontSize: 27))),
                ),
              ),
              label(sv(r, 'author').split(' ').first),
            ])),
          ),
      ]),
    );
  }
}

/// The name to show for a chat: the other person in it.
String chatName(String collection, String id) {
  for (final r in app.rows(collection)) { if (sv(r, 'chat') == id && sv(r, 'handle') != me) return sv(r, 'author'); }
  final who = id.replaceFirst('dm-', '').split('-').where((s) => s != me).join(', ');
  return who.isEmpty ? id : who;
}

/// Conversations, latest first: tap one to open it on the chat page.
class Inbox extends StatelessWidget {
  const Inbox({super.key, this.collection = 'Messages', this.openPage = 'chat'});
  final String collection, openPage;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), latest = <String, Map<String, Object?>>{};
    for (final r in app.query(collection)) { latest.putIfAbsent(sv(r, 'chat'), () => r); }
    latest.remove('');
    if (latest.isEmpty) return Padding(padding: const EdgeInsets.all(32), child: Text('No messages yet', textAlign: TextAlign.center, style: TextStyle(color: p.sub)));
    return Column(children: [
      for (final e in latest.entries)
        Card(child: ListTile(
          leading: Avatar(chatName(collection, e.key), chatName(collection, e.key)),
          title: Text(chatName(collection, e.key), style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text('${sv(e.value, 'handle') == me ? 'You: ' : ''}${sv(e.value, 'text')}', maxLines: 1, overflow: TextOverflow.ellipsis),
          onTap: () { app.vars['chat'] = e.key; app.vars['chatTitle'] = chatName(collection, e.key); app.go(openPage); },
        )),
    ]);
  }
}

/// The messages of the open chat ({chat}), and a box to send one.
class Chat extends StatefulWidget {
  const Chat({super.key, this.collection = 'Messages'});
  final String collection;
  @override
  State<Chat> createState() => _ChatState();
}

class _ChatState extends State<Chat> {
  final c = TextEditingController();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  void send() {
    final t = c.text.trim(), id = AppState.show(app.get('chat'));
    if (t.isEmpty || id.isEmpty) return;
    app.addRecord(widget.collection, {'chat': id, 'author': meName, 'handle': me, 'text': t});
    c.clear();
  }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), id = AppState.show(app.get('chat'));
    final rows = app.query(widget.collection, sort: 'oldest first').where((r) => sv(r, 'chat') == id).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (rows.isEmpty) Padding(padding: const EdgeInsets.all(32), child: Text('Say hello 👋', textAlign: TextAlign.center, style: TextStyle(color: p.sub))),
      for (final r in rows)
        Align(
          alignment: sv(r, 'handle') == me ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            constraints: const BoxConstraints(maxWidth: 280),
            decoration: BoxDecoration(color: sv(r, 'handle') == me ? p.accent : p.card, borderRadius: BorderRadius.circular(18)),
            child: Text(sv(r, 'text'), style: TextStyle(color: sv(r, 'handle') == me ? p.onAccent : p.text, fontSize: 16)),
          ),
        ),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: TextField(controller: c, decoration: const InputDecoration(hintText: 'Message', isDense: true), onSubmitted: (_) => send())),
        const SizedBox(width: 8),
        FilledButton(onPressed: send, child: const Text('Send')),
      ]),
    ]);
  }
}

/// A profile header: cover, picture, name, @handle, bio and counts.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, this.name = '{playerName}', this.handle = '{playerHandle}', this.bio = '', this.stats = const [], this.cover = '@accent'});
  final String name, handle, bio, cover;
  final List<(String, String)> stats;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), n = app.fill(name), h = app.fill(handle);
    final own = {'points': nv(app.get('points'))};
    return Card(clipBehavior: Clip.antiAlias, child: Column(children: [
      Container(height: 80, color: p.resolve(cover) ?? p.accent),
      Transform.translate(offset: const Offset(0, -38), child: Container(decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: p.card, width: 3)), child: Avatar(n, h, size: 76))),
      Transform.translate(offset: const Offset(0, -30), child: Column(children: [
        Text(n, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text('@$h', style: TextStyle(color: p.sub)),
        if (bio.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(app.fill(bio), textAlign: TextAlign.center)),
        if (stats.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (final s in stats) Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Column(children: [
            Text(app.fill(s.$2, own), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
            Text(s.$1, style: TextStyle(color: p.sub, fontSize: 12)),
          ])),
        ])),
      ])),
    ]));
  }
}

/// Things for sale in a grid: tap one for its details and to message the seller.
class Marketplace extends StatelessWidget {
  const Marketplace({super.key, this.collection = 'Listings', this.chatPage = ''});
  final String collection, chatPage;
  static String price(Map<String, Object?> r) => num.tryParse(sv(r, 'price')) != null ? '\$${sv(r, 'price')}' : sv(r, 'price');
  void _details(BuildContext context, Map<String, Object?> r) => showModalBottomSheet<void>(context: context, builder: (ctx) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Media(r, height: 150),
          const SizedBox(height: 8),
          Text(sv(r, 'title'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          Text(price(r), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          Text([sv(r, 'condition'), sv(r, 'location'), if (sv(r, 'seller').isNotEmpty) 'Seller: ${sv(r, 'seller')}'].where((s) => s.isNotEmpty).join(' · ')),
          if (sv(r, 'description').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(sv(r, 'description'))),
          const SizedBox(height: 12),
          if (chatPage.isNotEmpty && sv(r, 'handle') != me)
            PButton('Message seller', onTap: () {
              Navigator.pop(ctx);
              app.vars['chat'] = 'dm-${([me, sv(r, 'handle')]..sort()).join('-')}';
              app.vars['chatTitle'] = sv(r, 'seller').isEmpty ? sv(r, 'handle') : sv(r, 'seller');
              app.go(chatPage);
            }),
        ]),
      ));
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection);
    if (rows.isEmpty) return Padding(padding: const EdgeInsets.all(32), child: Text('Nothing for sale yet', textAlign: TextAlign.center, style: TextStyle(color: p.sub)));
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), mainAxisSpacing: 8, crossAxisSpacing: 8, childAspectRatio: 0.72,
      children: [
        for (final r in rows)
          InkWell(onTap: () => _details(context, r), child: Card(child: Padding(padding: const EdgeInsets.all(6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Media(r, height: 120),
            const SizedBox(height: 4),
            Text('${price(r)}${isOn(r['sold']) ? ' · Sold' : ''}', style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(sv(r, 'title'), maxLines: 1, overflow: TextOverflow.ellipsis),
            Text(sv(r, 'location'), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.sub, fontSize: 12)),
          ])))),
      ],
    );
  }
}

/// Likes, comments, follows and reposts for me, newest first.
class Activity extends StatelessWidget {
  const Activity({super.key, this.collection = 'Notifications', this.profilePage = ''});
  final String collection, profilePage;
  static const icons = {'like': '❤️', 'comment': '💬', 'follow': '👤', 'repost': '🔁', 'mention': '@'};
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection).where((r) => sv(r, 'to').isEmpty || sv(r, 'to') == me).toList();
    if (rows.isEmpty) return Padding(padding: const EdgeInsets.all(32), child: Text('No notifications yet', textAlign: TextAlign.center, style: TextStyle(color: p.sub)));
    return Column(children: [
      for (final r in rows)
        Card(child: ListTile(
          leading: Text(icons[sv(r, 'type')] ?? '🔔', style: const TextStyle(fontSize: 24)),
          title: Text.rich(TextSpan(children: [TextSpan(text: sv(r, 'from_name').isEmpty ? sv(r, 'from') : sv(r, 'from_name'), style: const TextStyle(fontWeight: FontWeight.w800)), TextSpan(text: ' ${sv(r, 'text')}')])),
          tileColor: isOn(r['read']) ? null : p.accent.withValues(alpha: 0.08),
          onTap: () { app.updateRecord(collection, sv(r, '_id'), {'read': true}); openProfile(profilePage, sv(r, 'from'), sv(r, 'from_name')); },
        )),
    ]);
  }
}

/// People (Profiles), A to Z: tap one for their profile.
class People extends StatelessWidget {
  const People({super.key, this.collection = 'Profiles', this.profilePage = ''});
  final String collection, profilePage;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection, sort: 'name (a-z)').where((r) => sv(r, 'handle') != me).toList();
    if (rows.isEmpty) return Padding(padding: const EdgeInsets.all(32), child: Text('No one here yet', textAlign: TextAlign.center, style: TextStyle(color: p.sub)));
    return Column(children: [
      for (final r in rows)
        Card(child: ListTile(
          leading: Avatar(sv(r, 'name'), sv(r, 'handle')),
          title: Text('${sv(r, 'name')}${isOn(r['verified']) ? ' ✓' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text('@${sv(r, 'handle')}${sv(r, 'bio').isEmpty ? '' : ' · ${sv(r, 'bio')}'}', maxLines: 1, overflow: TextOverflow.ellipsis),
          onTap: () => openProfile(profilePage, sv(r, 'handle'), sv(r, 'name')),
        )),
    ]);
  }
}

/// Milestones worked out from my posts, the likes on them and my followers.
class Achievements extends StatelessWidget {
  const Achievements({super.key});
  @override
  Widget build(BuildContext context) {
    final p = pal(context), mine = app.rows('Posts').where((r) => sv(r, 'handle') == me).toList();
    final likes = mine.fold<num>(0, (a, r) => a + nv(r['likes'])), followers = nv(app.get('followers'));
    final list = [('✍️', 'First post', mine.length, 1), ('📚', '10 posts', mine.length, 10), ('❤️', 'First like', likes, 1), ('🔥', '100 likes', likes, 100), ('⭐', '1,000 followers', followers, 1000)];
    return Column(children: [
      for (final (ic, label, have, need) in list)
        Card(child: ListTile(
          leading: Text(have >= need ? ic : '🔒', style: const TextStyle(fontSize: 24)),
          title: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: have >= need ? p.text : p.sub)),
          subtitle: Text(have >= need ? 'Unlocked' : '${AppState.show(have < need ? have : need)} / $need'),
        )),
    ]);
  }
}

/// The most used #hashtags; tap one to search for it.
class Trending extends StatelessWidget {
  const Trending({super.key, this.collection = 'Posts', this.searchVar = ''});
  final String collection, searchVar;
  @override
  Widget build(BuildContext context) {
    final n = <String, int>{};
    for (final r in app.rows(collection)) { for (final m in RegExp(r'#\w+').allMatches(sv(r, 'text'))) { n[m[0]!] = (n[m[0]!] ?? 0) + 1; } }
    final top = n.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final e in top.take(8)) ActionChip(label: Text('${e.key} · ${e.value}'), onPressed: () { if (searchVar.isNotEmpty) app.set(searchVar, e.key); }),
    ]);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// More components: charts, carousels, swipe pages, timers, keypads, popups, notifications…
// ---------------------------------------------------------------------------------------------------------------

/// Hears the app's messages while it's on screen.
mixin Listens<T extends StatefulWidget> on State<T> {
  void Function()? _off;
  void onMessage(String m);
  @override
  void initState() { super.initState(); _off = app.listen(onMessage); }
  @override
  void dispose() { _off?.call(); super.dispose(); }
}

/// How pop-up notifications look and where they show.
class NotifyStyle {
  const NotifyStyle({this.listen = 'notify', this.position = 'top', this.look = 'card', this.seconds = 3, this.max = 3, this.bg = '#1e2235', this.text = '#ffffff', this.accent = '#ffd23d'});
  final String listen, position, look, bg, text, accent;
  final double seconds;
  final int max;
}

class Toast {
  Toast(this.title, this.text, this.icon);
  final String title, text, icon;
}

/// The notifications on screen, stacked at the top (or bottom, or centre), sliding in.
class ToastLayer extends StatelessWidget {
  const ToastLayer({super.key});
  @override
  Widget build(BuildContext context) {
    final n = app.notify!, p = pal(context), bg = p.resolve(n.bg) ?? p.card, fg = p.resolve(n.text) ?? p.text, ac = p.resolve(n.accent) ?? p.accent;
    final pill = n.look == 'pill', banner = n.look == 'banner';
    return ValueListenableBuilder<List<Toast>>(
      valueListenable: app.toasts,
      builder: (context, list, _) => SafeArea(
        child: Align(
          alignment: switch (n.position) { 'bottom' => Alignment.bottomCenter, 'center' => Alignment.center, 'top right' => Alignment.topRight, _ => Alignment.topCenter },
          child: Padding(
            padding: EdgeInsets.fromLTRB(banner ? 0 : 12, 8, banner ? 0 : 12, n.position == 'bottom' ? 96 : 8),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              for (final t in list)
                TweenAnimationBuilder<double>(
                  key: ObjectKey(t), tween: Tween(begin: 0, end: 1), duration: const Duration(milliseconds: 260), curve: Curves.easeOutBack,
                  builder: (context, k, child) => Opacity(opacity: k.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(0, (1 - k) * (n.position == 'bottom' ? 24 : -24)), child: child)),
                  child: GestureDetector(
                    onTap: () => app.toasts.value = app.toasts.value.where((x) => x != t).toList(),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      constraints: BoxConstraints(maxWidth: banner ? double.infinity : 420),
                      width: banner ? double.infinity : null,
                      padding: EdgeInsets.symmetric(horizontal: pill ? 18 : 14, vertical: pill ? 10 : 12),
                      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(banner ? 0 : pill ? 30 : 16), border: n.look == 'achievement' ? Border.all(color: ac, width: 2) : null, boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 18, offset: Offset(0, 6))]),
                      child: Material(type: MaterialType.transparency, child: Row(mainAxisSize: MainAxisSize.min, children: [
                        if (t.icon.isNotEmpty) Padding(padding: const EdgeInsets.only(right: 10), child: Text(t.icon, style: TextStyle(fontSize: pill ? 18 : 24))),
                        Flexible(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          if (t.title.isNotEmpty) Text(t.title, style: TextStyle(color: n.look == 'achievement' ? ac : fg, fontWeight: FontWeight.w800, fontSize: 15)),
                          if (t.text.isNotEmpty && !pill) Text(t.text, style: TextStyle(color: fg.withValues(alpha: 0.8), fontSize: 13)),
                        ])),
                      ])),
                    ),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// A bar, column, line, area, pie, donut or radar chart: from label | value lines ({variables} work), or a variable tracked over time.
class PChart extends StatefulWidget {
  const PChart({super.key, this.chart = 'columns', this.data = const [], this.track = '', this.every = 1, this.points = 30, this.title = '', this.max = 0, this.values = true, this.labels = true, this.grid = true, this.color = '#4fa3ff', this.text = '', this.bg = '', this.height = 200});
  final String chart, track, title, color, text, bg;
  final List<(String, String)> data;
  final double every, max, height;
  final int points;
  final bool values, labels, grid;
  @override
  State<PChart> createState() => _PChartState();
}

class _PChartState extends State<PChart> {
  final List<double> history = [];
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    if (widget.track.isNotEmpty) {
      history.add(nv(app.get(widget.track)).toDouble());
      _timer = Timer.periodic(Duration(milliseconds: (widget.every * 1000).round().clamp(100, 3600000)), (_) => setState(() {
            history.add(nv(app.get(widget.track)).toDouble());
            if (history.length > widget.points) history.removeAt(0);
          }));
    }
  }
  @override
  void dispose() { _timer?.cancel(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), fg = p.resolve(widget.text) ?? p.text;
    final items = widget.track.isNotEmpty ? [for (final v in history) ('', v)] : [for (final d in widget.data) (app.fill(d.$1), (num.tryParse(app.fill(d.$2).trim()) ?? 0).toDouble())];
    final kind = widget.track.isNotEmpty && !['line', 'area', 'columns', 'bars'].contains(widget.chart) ? 'line' : widget.chart;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: p.resolve(widget.bg), borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (widget.title.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(app.fill(widget.title), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: fg))),
        SizedBox(height: widget.height - (widget.title.isEmpty ? 24 : 52), width: double.infinity, child: CustomPaint(painter: _ChartPainter(kind, items, widget.max, p.resolve(widget.color) ?? p.accent, fg, p.line, widget.values, widget.labels, widget.grid))),
      ]),
    );
  }
}

class _ChartPainter extends CustomPainter {
  _ChartPainter(this.kind, this.items, this.max, this.color, this.text, this.line, this.values, this.labels, this.grid);
  final String kind;
  final List<(String, double)> items;
  final double max;
  final Color color, text, line;
  final bool values, labels, grid;
  static const _more = [Color(0xFFFF6B8B), Color(0xFFFFC94D), Color(0xFF3CCF7A), Color(0xFF8E6BF2), Color(0xFF22B8C9), Color(0xFFFF9F43), Color(0xFFE0559B)];
  Color _slice(int i) => i == 0 ? color : _more[(i - 1) % _more.length];
  static String _n(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toStringAsFixed(1);
  void _txt(Canvas c, String s, Offset at, {double size = 11, Color? color, bool bold = false, double align = 0.5}) {
    if (s.isEmpty) return;
    final tp = TextPainter(text: TextSpan(text: s, style: TextStyle(fontSize: size, color: color ?? text.withValues(alpha: 0.75), fontWeight: bold ? FontWeight.w800 : FontWeight.w600)), textDirection: TextDirection.ltr, maxLines: 1)..layout();
    tp.paint(c, at - Offset(tp.width * align, tp.height / 2));
  }

  @override
  void paint(Canvas c, Size s) {
    if (items.isEmpty) return;
    final top = items.fold<double>(0, (a, e) => math.max(a, e.$2)), hi = max > 0 ? max : (top <= 0 ? 1 : top * 1.12);
    final n = items.length, ink = Paint()..color = color;
    if (kind == 'pie' || kind == 'donut') {
      final total = items.fold<double>(0, (a, e) => a + math.max(0, e.$2));
      if (total <= 0) return;
      final r = math.min(s.width, s.height) / 2 - 4, ctr = Offset(s.width / 2, s.height / 2);
      var a = -math.pi / 2;
      for (var i = 0; i < n; i++) {
        final sw = math.max(0, items[i].$2) / total * math.pi * 2;
        if (kind == 'donut') {
          c.drawArc(Rect.fromCircle(center: ctr, radius: r * 0.78), a + 0.02, math.max(0, sw - 0.04), false, Paint()..color = _slice(i)..style = PaintingStyle.stroke..strokeWidth = r * 0.42);
        } else {
          c.drawArc(Rect.fromCircle(center: ctr, radius: r), a, sw, true, Paint()..color = _slice(i));
        }
        if (labels && sw > 0.4) { final m = a + sw / 2; _txt(c, items[i].$1, ctr + Offset(math.cos(m), math.sin(m)) * r * (kind == 'donut' ? 0.78 : 0.62), color: Colors.white, bold: true); }
        a += sw;
      }
      if (kind == 'donut' && values) _txt(c, _n(total), ctr, size: 20, color: text, bold: true);
      return;
    }
    if (kind == 'radar') {
      final r = math.min(s.width, s.height) / 2 - (labels ? 18 : 4), ctr = Offset(s.width / 2, s.height / 2);
      Offset at(int i, double k) { final a = -math.pi / 2 + i * math.pi * 2 / n; return ctr + Offset(math.cos(a), math.sin(a)) * r * k; }
      final web = Paint()..color = line..style = PaintingStyle.stroke;
      for (final k in [0.33, 0.66, 1.0]) { if (!grid && k < 1) continue; c.drawPath(Path()..addPolygon([for (var i = 0; i < n; i++) at(i, k)], true), web); }
      for (var i = 0; i < n; i++) { c.drawLine(ctr, at(i, 1), web); if (labels) _txt(c, items[i].$1, at(i, 1.18)); }
      final poly = [for (var i = 0; i < n; i++) at(i, (items[i].$2 / hi).clamp(0.0, 1.0))];
      c.drawPath(Path()..addPolygon(poly, true), Paint()..color = color.withValues(alpha: 0.3));
      c.drawPath(Path()..addPolygon(poly, true), Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 2.5);
      return;
    }
    if (kind == 'bars') { // across
      final lw = labels && items.any((e) => e.$1.isNotEmpty) ? 52.0 : 0.0, vw = values ? 34.0 : 0.0, row = s.height / n, w = s.width - lw - vw;
      for (var i = 0; i < n; i++) {
        final y = row * i + row * 0.2, bh = row * 0.6, bw = w * (items[i].$2 / hi).clamp(0.0, 1.0);
        c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(lw, y, bw, bh), Radius.circular(bh / 3)), ink);
        if (lw > 0) _txt(c, items[i].$1, Offset(lw - 6, y + bh / 2), align: 1);
        if (values) _txt(c, _n(items[i].$2), Offset(lw + bw + 6, y + bh / 2), align: 0, color: text, bold: true);
      }
      return;
    }
    final lb = labels && items.any((e) => e.$1.isNotEmpty) ? 18.0 : 2.0, tp = values ? 16.0 : 4.0, h = s.height - lb - tp, slot = s.width / n;
    if (grid) { for (var i = 0; i <= 3; i++) { final y = tp + h * i / 3; c.drawLine(Offset(0, y), Offset(s.width, y), Paint()..color = line..strokeWidth = 1); } }
    double yOf(double v) => tp + h * (1 - (v / hi).clamp(0.0, 1.0));
    if (kind == 'line' || kind == 'area') {
      final pts = [for (var i = 0; i < n; i++) Offset(n == 1 ? s.width / 2 : i * s.width / (n - 1), yOf(items[i].$2))];
      final path = Path()..addPolygon(pts, false);
      if (kind == 'area') c.drawPath(Path.from(path)..lineTo(pts.last.dx, tp + h)..lineTo(pts.first.dx, tp + h)..close(), Paint()..color = color.withValues(alpha: 0.25));
      c.drawPath(path, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 3..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round);
      for (var i = 0; i < n; i++) {
        if (n <= 14) c.drawCircle(pts[i], 3.5, ink);
        if (values && n <= 14) _txt(c, _n(items[i].$2), pts[i] - const Offset(0, 11), color: text, bold: true);
        if (lb > 2) _txt(c, items[i].$1, Offset(pts[i].dx.clamp(14, s.width - 14), s.height - 8));
      }
      return;
    }
    for (var i = 0; i < n; i++) { // columns
      final x = slot * i + slot * 0.2, bw = slot * 0.6, y = yOf(items[i].$2);
      c.drawRRect(RRect.fromRectAndCorners(Rect.fromLTRB(x, y, x + bw, tp + h), topLeft: const Radius.circular(6), topRight: const Radius.circular(6)), ink);
      if (values) _txt(c, _n(items[i].$2), Offset(x + bw / 2, y - 8), color: text, bold: true);
      if (lb > 2) _txt(c, items[i].$1, Offset(x + bw / 2, s.height - 8));
    }
  }

  @override
  bool shouldRepaint(_ChartPainter o) => true;
}

/// One card in a carousel: its name, icon (an emoji), the value it picks, the variable that unlocks it, a line about it.
class CarouselItem {
  const CarouselItem(this.name, this.icon, this.value, {this.lock = '', this.desc = ''});
  final String name, icon, value, lock, desc;
}

/// Swipe through cards; the one in the middle is picked into a variable (locked cards wait for their variable).
class Carousel extends StatefulWidget {
  const Carousel(this.variable, this.items, {super.key, this.cardWidth = 0.55, this.arrows = true, this.dots = true, this.loop = false, this.message = '', this.card = '@card', this.text = '', this.accent = '@accent', this.height = 220});
  final String variable, message, card, text, accent;
  final List<CarouselItem> items;
  final double cardWidth, height;
  final bool arrows, dots, loop;
  @override
  State<Carousel> createState() => _CarouselState();
}

class _CarouselState extends State<Carousel> {
  late int _i = math.max(0, widget.items.indexWhere((x) => x.value == AppState.show(app.get(widget.variable))));
  late final PageController _c = PageController(viewportFraction: widget.cardWidth, initialPage: widget.loop ? widget.items.length * 500 + _i : _i);
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  bool _locked(CarouselItem x) => x.lock.isNotEmpty && !isOn(app.get(x.lock));
  void _picked(int page) {
    final n = widget.items.length;
    setState(() => _i = page % n);
    final x = widget.items[_i];
    if (!_locked(x)) { app.set(widget.variable, x.value); if (widget.message.isNotEmpty) app.send(widget.message); }
  }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), n = widget.items.length, fg = p.resolve(widget.text) ?? p.text, ac = p.resolve(widget.accent) ?? p.accent;
    if (n == 0) return const SizedBox.shrink();
    Widget arrow(IconData icon, int d) => IconButton(onPressed: () => _c.animateToPage((_c.page ?? 0).round() + d, duration: const Duration(milliseconds: 280), curve: Curves.easeOut), icon: Icon(icon, color: fg));
    return Column(children: [
      SizedBox(
        height: widget.height - (widget.dots ? 22 : 0),
        child: Stack(alignment: Alignment.center, children: [
          PageView.builder(
            controller: _c,
            itemCount: widget.loop ? null : n,
            onPageChanged: _picked,
            itemBuilder: (context, page) {
              final x = widget.items[page % n], on = page % n == _i, locked = _locked(x);
              return AnimatedScale(
                scale: on ? 1 : 0.86, duration: const Duration(milliseconds: 220),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 6),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: p.resolve(widget.card) ?? p.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: on ? ac : Colors.transparent, width: 2.5)),
                  child: Opacity(opacity: locked ? 0.5 : 1, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(locked ? '🔒' : x.icon, style: const TextStyle(fontSize: 46)),
                    const SizedBox(height: 8),
                    Text(x.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: fg, fontWeight: FontWeight.w800, fontSize: 17)),
                    if (x.desc.isNotEmpty) Text(app.fill(x.desc), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: TextStyle(color: fg.withValues(alpha: 0.7), fontSize: 13)),
                  ])),
                ),
              );
            },
          ),
          if (widget.arrows) Row(children: [arrow(Icons.chevron_left, -1), const Spacer(), arrow(Icons.chevron_right, 1)]),
        ]),
      ),
      if (widget.dots) Padding(padding: const EdgeInsets.only(top: 10), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var i = 0; i < n; i++) AnimatedContainer(duration: const Duration(milliseconds: 200), margin: const EdgeInsets.symmetric(horizontal: 3), width: i == _i ? 18 : 7, height: 7, decoration: BoxDecoration(color: i == _i ? ac : p.line, borderRadius: BorderRadius.circular(4))),
      ])),
    ]);
  }
}

/// Swipe left and right between pages (onboarding, a tour); the page number goes into a variable, and "slide next" / "slide prev" / "slide 2" move it.
class Pager extends StatefulWidget {
  const Pager(this.variable, {super.key, required this.pages, this.dots = true, this.dotColor = '@accent', this.loop = false, this.auto = 0, this.message = 'slide', this.height = 320});
  final String variable, dotColor, message;
  final List<Widget> pages;
  final bool dots, loop;
  final double auto, height;
  @override
  State<Pager> createState() => _PagerState();
}

class _PagerState extends State<Pager> with Listens<Pager> {
  late int _i = (nv(app.get(widget.variable)).toInt() - 1).clamp(0, math.max(0, widget.pages.length - 1));
  late final PageController _c = PageController(initialPage: _i);
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    if (widget.auto > 0) _timer = Timer.periodic(Duration(milliseconds: (widget.auto * 1000).round()), (_) => _go(_i + 1));
  }
  @override
  void dispose() { _timer?.cancel(); _c.dispose(); super.dispose(); }
  void _go(int i) {
    final n = widget.pages.length;
    if (n == 0) return;
    final j = widget.loop ? (i % n + n) % n : i.clamp(0, n - 1);
    if (_c.hasClients) _c.animateToPage(j, duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic);
  }
  @override
  void onMessage(String m) {
    final pre = widget.message;
    if (m == '$pre next') { _go(_i + 1); } else if (m == '$pre prev' || m == '$pre back') { _go(_i - 1); }
    else if (m.startsWith('$pre ') && int.tryParse(m.substring(pre.length + 1)) != null) { _go(int.parse(m.substring(pre.length + 1)) - 1); }
  }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), dot = p.resolve(widget.dotColor) ?? p.accent;
    final want = nv(app.get(widget.variable)).toInt() - 1; // (the variable changed somewhere else: follow it)
    if (want != _i && want >= 0 && want < widget.pages.length) WidgetsBinding.instance.addPostFrameCallback((_) => _go(want));
    return SizedBox(height: widget.height, child: Column(children: [
      Expanded(child: PageView(controller: _c, onPageChanged: (i) { setState(() => _i = i); app.set(widget.variable, i + 1); }, children: [for (final w in widget.pages) Center(child: w)])),
      if (widget.dots) Padding(padding: const EdgeInsets.only(top: 8), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var i = 0; i < widget.pages.length; i++) AnimatedContainer(duration: const Duration(milliseconds: 200), margin: const EdgeInsets.symmetric(horizontal: 3), width: i == _i ? 18 : 7, height: 7, decoration: BoxDecoration(color: i == _i ? dot : dot.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(4))),
      ])),
    ]));
  }
}

/// A grid of square pictures from a collection's media field (or emojis); tap one to open it.
class PhotoGrid extends StatelessWidget {
  const PhotoGrid({super.key, this.collection = 'Posts', this.field = 'media', this.filter = '', this.columns = 3, this.gap = 2, this.radius = 0, this.openPage = '', this.message = ''});
  final String collection, field, filter, openPage, message;
  final int columns;
  final double gap, radius;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection, filter: filter).where((r) => mediaList(r[field]).isNotEmpty).toList();
    if (rows.isEmpty) return Padding(padding: const EdgeInsets.all(24), child: Text('No pictures yet', textAlign: TextAlign.center, style: TextStyle(color: p.sub)));
    return GridView.count(
      crossAxisCount: columns < 1 ? 3 : columns, mainAxisSpacing: gap, crossAxisSpacing: gap, shrinkWrap: true, padding: EdgeInsets.zero, physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final r in rows)
          GestureDetector(
            onTap: () { app.open(collection, '${r['_id']}'); if (openPage.isNotEmpty) app.go(openPage); if (message.isNotEmpty) app.send(message); },
            child: ClipRRect(borderRadius: BorderRadius.circular(radius), child: LayoutBuilder(builder: (context, c) => Tile(mediaList(r[field]).first, colorOf(r, '${r['_id']}'), height: c.maxWidth))),
          ),
      ],
    );
  }
}

/// A heart (or thumbs-up, or star) that turns a variable on or off, with a count next to it.
class LikeButton extends StatelessWidget {
  const LikeButton(this.variable, {super.key, this.countVar = 'likes', this.icon = 'heart', this.message = '', this.on = '#f91880', this.off = '@sub', this.text = '@sub'});
  final String variable, countVar, icon, message, on, off, text;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), liked = isOn(app.get(variable)), c = liked ? (p.resolve(on) ?? p.accent) : (p.resolve(off) ?? p.sub);
    final ic = switch (icon) { 'thumbs up' => liked ? Icons.thumb_up : Icons.thumb_up_off_alt, 'star' => liked ? Icons.star : Icons.star_border, _ => liked ? Icons.favorite : Icons.favorite_border };
    return Align(alignment: Alignment.centerLeft, child: InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () { app.set(variable, !liked); if (countVar.isNotEmpty) app.add(countVar, liked ? -1 : 1); if (message.isNotEmpty) app.send(message); },
      child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: Row(mainAxisSize: MainAxisSize.min, children: [
        TweenAnimationBuilder<double>(key: ValueKey(liked), tween: Tween(begin: liked ? 1.5 : 1, end: 1), duration: const Duration(milliseconds: 300), curve: Curves.elasticOut, builder: (context, k, child) => Transform.scale(scale: k, child: child), child: Icon(ic, color: c, size: 26)),
        if (countVar.isNotEmpty) Padding(padding: const EdgeInsets.only(left: 6), child: Text(compactNum(app.get(countVar)), style: TextStyle(color: liked ? c : (p.resolve(text) ?? p.sub), fontWeight: FontWeight.w700))),
      ])),
    ));
  }
}

/// Text that scrolls across (several messages separated by |, with {variables}).
class Ticker extends StatefulWidget {
  const Ticker(this.text, {super.key, this.speed = 60, this.direction = 'left', this.gap = 60, this.size = 15, this.bg = '', this.color = '', this.accent = '#ffd23d', this.height = 36});
  final String text, direction, bg, color, accent;
  final double speed, gap, size, height;
  @override
  State<Ticker> createState() => _TickerState();
}

class _TickerState extends State<Ticker> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 10))..repeat();
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), fg = p.resolve(widget.color) ?? p.text, parts = widget.text.split('|').map((x) => app.fill(x.trim())).where((x) => x.isNotEmpty).toList();
    final span = TextSpan(style: TextStyle(fontSize: widget.size, color: fg, fontWeight: FontWeight.w700), children: [
      for (var i = 0; i < parts.length; i++) ...[if (i > 0) TextSpan(text: '   ●   ', style: TextStyle(color: p.resolve(widget.accent) ?? p.accent)), TextSpan(text: parts[i])],
    ]);
    final tp = TextPainter(text: span, textDirection: TextDirection.ltr, maxLines: 1)..layout();
    final w = tp.width + widget.gap, ms = (w / math.max(10, widget.speed) * 1000).round();
    if (_c.duration!.inMilliseconds != ms) { _c.duration = Duration(milliseconds: ms); _c.repeat(); }
    return Container(
      height: widget.height, color: p.resolve(widget.bg),
      child: ClipRect(child: LayoutBuilder(builder: (context, box) {
        final copies = (box.maxWidth / w).ceil() + 1;
        return AnimatedBuilder(animation: _c, builder: (context, _) {
          final dx = widget.direction == 'right' ? -w + _c.value * w : -_c.value * w;
          return OverflowBox(alignment: Alignment.centerLeft, maxWidth: double.infinity, child: Transform.translate(offset: Offset(dx, 0), child: Row(mainAxisSize: MainAxisSize.min, children: [
            for (var k = 0; k < copies; k++) SizedBox(width: w, child: Text.rich(span, maxLines: 1, softWrap: false)),
          ])));
        });
      })),
    );
  }
}

/// A countdown (or count-up) as a ring, bar, big digits or a pill: red near the end, then a message. "timer start / pause / reset / restart / add 5" control it.
class PTimer extends StatefulWidget {
  const PTimer({super.key, this.seconds = 30, this.countUp = false, this.look = 'ring', this.format = 'seconds', this.autoStart = true, this.message = 'timer', this.endMessage = '', this.endAction = 'nothing else', this.warnAt = 5, this.variable = '', this.color = '@accent', this.warn = '#ff4d5e', this.track = '@line', this.text = '', this.size = 120});
  final double seconds, warnAt, size;
  final bool countUp, autoStart;
  final String look, format, message, endMessage, endAction, variable, color, warn, track, text;
  @override
  State<PTimer> createState() => _PTimerState();
}

class _PTimerState extends State<PTimer> with Listens<PTimer> {
  double t = 0;
  late bool running = widget.autoStart;
  bool done = false;
  int _shown = -1;
  Timer? _tick;
  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(milliseconds: 100), (_) {
      if (!running || done) return;
      setState(() { t = math.min(widget.seconds, t + 0.1); if (t >= widget.seconds) _end(); });
      final left = widget.countUp ? t.floor() : (widget.seconds - t).ceil();
      if (widget.variable.isNotEmpty && left != _shown) { _shown = left; app.set(widget.variable, left); }
    });
  }
  @override
  void dispose() { _tick?.cancel(); super.dispose(); }
  void _end() {
    done = true;
    if (widget.endMessage.isNotEmpty) app.send(widget.endMessage);
    if (widget.endAction == 'restart timer') { t = 0; done = false; }
  }
  @override
  void onMessage(String m) {
    final base = widget.message;
    if (!m.startsWith(base)) return;
    final rest = m.substring(base.length).trim();
    setState(() {
      if (rest == 'start' || rest == 'resume' || rest.isEmpty) { running = true; }
      else if (rest == 'pause' || rest == 'stop') { running = false; }
      else if (rest == 'reset') { t = 0; done = false; }
      else if (rest == 'restart') { t = 0; done = false; running = true; }
      else if (RegExp(r'^add\s+-?\d').hasMatch(rest)) { t = math.max(0, t - (double.tryParse(rest.split(RegExp(r'\s+'))[1]) ?? 0) * (widget.countUp ? -1 : 1)); }
    });
  }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), s = widget.seconds <= 0 ? 1.0 : widget.seconds, left = widget.countUp ? t : s - t;
    final warn = !widget.countUp && left <= widget.warnAt && !done && running, c = warn ? (p.resolve(widget.warn) ?? p.danger) : (p.resolve(widget.color) ?? p.accent);
    final label = switch (widget.format) {
      'm:ss' => '${(widget.countUp ? left.floor() : left.ceil()) ~/ 60}:${((widget.countUp ? left.floor() : left.ceil()) % 60).toString().padLeft(2, '0')}',
      'seconds.tenths' => left.toStringAsFixed(1),
      _ => '${widget.countUp ? left.floor() : left.ceil()}',
    };
    final frac = (left / s).clamp(0.0, 1.0), fg = p.resolve(widget.text) ?? p.text, track = p.resolve(widget.track) ?? p.line;
    final digits = Text(label, style: TextStyle(color: warn ? c : fg, fontWeight: FontWeight.w900, fontSize: widget.look == 'digits' ? widget.size * 0.45 : widget.size * 0.26, fontFeatures: const [FontFeature.tabularFigures()]));
    final body = switch (widget.look) {
      'bar' => Column(mainAxisSize: MainAxisSize.min, children: [digits, const SizedBox(height: 6), ClipRRect(borderRadius: BorderRadius.circular(6), child: LinearProgressIndicator(value: frac, minHeight: 12, color: c, backgroundColor: track))]),
      'digits' => digits,
      'pill' => Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(color: c.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(30)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.timer_outlined, color: c, size: 20), const SizedBox(width: 6), digits])),
      _ => SizedBox(width: widget.size, height: widget.size, child: Stack(fit: StackFit.expand, children: [CircularProgressIndicator(value: frac, strokeWidth: widget.size * 0.08, color: c, backgroundColor: track, strokeCap: StrokeCap.round), Center(child: digits)])),
    };
    return Center(child: AnimatedScale(scale: warn && (t * 2).floor().isEven ? 1.06 : 1, duration: const Duration(milliseconds: 200), child: body));
  }
}

/// Grey shapes that shimmer while content loads; gone when its variable turns on.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.layout = 'avatar + lines', this.lines = 3, this.doneVar = '', this.radius = 8});
  final String layout, doneVar;
  final int lines;
  final double radius;
  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);
  @override
  void dispose() { _c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    if (widget.doneVar.isNotEmpty && isOn(app.get(widget.doneVar))) return const SizedBox.shrink();
    final p = pal(context);
    return AnimatedBuilder(animation: _c, builder: (context, _) {
      final col = Color.lerp(p.text.withValues(alpha: 0.07), p.text.withValues(alpha: 0.15), _c.value)!;
      Widget bar(double w, [double h = 12]) => FractionallySizedBox(widthFactor: w, child: Container(height: h, margin: const EdgeInsets.symmetric(vertical: 5), decoration: BoxDecoration(color: col, borderRadius: BorderRadius.circular(widget.radius))));
      Widget lines(int n) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (var i = 0; i < n; i++) bar(i == n - 1 && n > 1 ? 0.6 : 1)]);
      Widget dot(double d) => Container(width: d, height: d, decoration: BoxDecoration(color: col, shape: BoxShape.circle));
      return switch (widget.layout) {
        'text lines' => lines(widget.lines),
        'card' => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(height: 140, decoration: BoxDecoration(color: col, borderRadius: BorderRadius.circular(widget.radius * 1.5))), const SizedBox(height: 8), lines(math.max(1, widget.lines - 1))]),
        'list rows' => Column(children: [for (var i = 0; i < widget.lines; i++) Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(children: [dot(40), const SizedBox(width: 12), Expanded(child: lines(2))]))]),
        'picture' => Container(height: 180, decoration: BoxDecoration(color: col, borderRadius: BorderRadius.circular(widget.radius * 1.5))),
        _ => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [dot(48), const SizedBox(width: 12), Expanded(child: lines(widget.lines))]),
      };
    });
  }
}

/// Colour swatches: tap one to pick it into a variable.
class ColorSwatches extends StatelessWidget {
  const ColorSwatches(this.variable, this.colors, {super.key, this.columns = 5, this.shape = 'circle', this.gap = 10, this.ring = '@text', this.message = ''});
  final String variable, shape, ring, message;
  final List<String> colors;
  final int columns;
  final double gap;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), cur = AppState.show(app.get(variable)).toLowerCase();
    return GridView.count(
      crossAxisCount: columns < 1 ? 5 : columns, mainAxisSpacing: gap, crossAxisSpacing: gap, shrinkWrap: true, padding: EdgeInsets.zero, physics: const NeverScrollableScrollPhysics(),
      children: [
        for (final c in colors)
          GestureDetector(
            onTap: () { app.set(variable, c); if (message.isNotEmpty) app.send(message); },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              decoration: BoxDecoration(
                color: p.resolve(c) ?? p.line,
                shape: shape == 'circle' ? BoxShape.circle : BoxShape.rectangle,
                borderRadius: shape == 'circle' ? null : BorderRadius.circular(shape == 'rounded' ? 12 : 3),
                border: Border.all(color: c.toLowerCase() == cur ? (p.resolve(ring) ?? p.text) : p.line, width: c.toLowerCase() == cur ? 3.5 : 1),
              ),
              child: c.toLowerCase() == cur ? Icon(Icons.check, color: (p.resolve(c) ?? p.line).computeLuminance() > 0.5 ? Colors.black87 : Colors.white) : null,
            ),
          ),
      ],
    );
  }
}

/// A number pad for a code, a PIN or an answer: ✓ checks it against the answer and sends the right / wrong message.
class Keypad extends StatelessWidget {
  const Keypad(this.variable, {super.key, this.maxLength = 4, this.mask = false, this.answer = '', this.rightMessage = '', this.wrongMessage = '', this.enterMessage = '', this.autoEnter = true, this.display = true, this.keyStyle = 'round', this.keyColor = '@field', this.text = '', this.accent = '@good', this.displayBg = ''});
  final String variable, answer, rightMessage, wrongMessage, enterMessage, keyStyle, keyColor, text, accent, displayBg;
  final int maxLength;
  final bool mask, autoEnter, display;
  void _enter(String v) {
    if (enterMessage.isNotEmpty) app.send(enterMessage);
    if (answer.isEmpty) return;
    if (v == answer) { if (rightMessage.isNotEmpty) app.send(rightMessage); }
    else { if (wrongMessage.isNotEmpty) app.send(wrongMessage); app.set(variable, ''); }
  }
  void _press(String k) {
    final cur = AppState.show(app.get(variable));
    if (k == '⌫') { if (cur.isNotEmpty) app.set(variable, cur.substring(0, cur.length - 1)); return; }
    if (k == '✓') { _enter(cur); return; }
    if (cur.length >= maxLength) return;
    final next = cur + k;
    app.set(variable, next);
    if (autoEnter && next.length == maxLength) _enter(next);
  }
  @override
  Widget build(BuildContext context) {
    final p = pal(context), cur = AppState.show(app.get(variable)), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? p.accent;
    final shape = keyStyle == 'round' ? const CircleBorder() : RoundedRectangleBorder(borderRadius: BorderRadius.circular(keyStyle == 'flat' ? 6 : 16));
    Widget key(String k) => Padding(padding: const EdgeInsets.all(6), child: AspectRatio(aspectRatio: keyStyle == 'round' ? 1 : 1.5, child: Material(
          color: k == '✓' ? ac : keyStyle == 'flat' ? Colors.transparent : (p.resolve(keyColor) ?? p.field), shape: shape,
          child: InkWell(customBorder: shape, onTap: () => _press(k), child: Center(child: Text(k, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: k == '✓' ? Colors.white : fg)))),
        )));
    return Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 300), child: Column(mainAxisSize: MainAxisSize.min, children: [
      if (display) Container(
        width: double.infinity, margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(color: p.resolve(displayBg) ?? p.field, borderRadius: BorderRadius.circular(14)),
        child: Text(List.generate(maxLength, (i) => i < cur.length ? (mask ? '•' : cur[i]) : '–').join('  '), textAlign: TextAlign.center, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, letterSpacing: 2, color: fg)),
      ),
      for (final r in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', '✓']]) Row(children: [for (final k in r) Expanded(child: key(k))]),
    ])));
  }
}

/// ‹ Easy › : pick one of several options with arrows; the choice goes into a variable.
class Selector extends StatelessWidget {
  const Selector(this.variable, this.options, {super.key, this.wrap = true});
  final String variable;
  final List<String> options;
  final bool wrap;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), n = options.length;
    if (n == 0) return const SizedBox.shrink();
    final i = math.max(0, options.indexOf(AppState.show(app.get(variable))));
    void pick(int d) => app.set(variable, options[wrap ? (i + d + n) % n : (i + d).clamp(0, n - 1)]);
    return Container(
      decoration: BoxDecoration(color: p.field, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        IconButton(tooltip: 'Previous', onPressed: wrap || i > 0 ? () => pick(-1) : null, icon: const Icon(Icons.chevron_left)),
        Expanded(child: AnimatedSwitcher(duration: const Duration(milliseconds: 180), child: Text(options[i], key: ValueKey(i), textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: p.text)))),
        IconButton(tooltip: 'Next', onPressed: wrap || i < n - 1 ? () => pick(1) : null, icon: const Icon(Icons.chevron_right)),
      ]),
    );
  }
}

/// A popup (a dialog) or a bottom sheet with things inside: opens on a message and closes on another (or after a few seconds).
class PPopup extends StatefulWidget {
  const PPopup({super.key, this.mode = 'popup', this.openOn = 'popup', this.closeOn = 'close', this.startOpen = false, this.autoClose = 0, this.tapCloses = false, this.dim = true, this.handle = true, required this.child});
  final String mode, openOn, closeOn;
  final bool startOpen, tapCloses, dim, handle;
  final double autoClose;
  final Widget child;
  @override
  State<PPopup> createState() => _PPopupState();
}

class _PPopupState extends State<PPopup> with Listens<PPopup> {
  bool _open = false;
  @override
  void initState() {
    super.initState();
    if (widget.startOpen) WidgetsBinding.instance.addPostFrameCallback((_) => _show());
  }
  @override
  void onMessage(String m) { if (m == widget.openOn) { _show(); } else if (m == widget.closeOn) { _hide(); } }
  void _show() {
    if (_open || !mounted) return;
    _open = true;
    final content = ListenableBuilder(listenable: app, builder: (context, _) => widget.child);
    final Future<void> shown = widget.mode == 'sheet'
        ? showModalBottomSheet<void>(context: context, useRootNavigator: true, isScrollControlled: true, showDragHandle: widget.handle, barrierColor: widget.dim ? null : Colors.transparent, builder: (context) => SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: content)))
        : showDialog<void>(context: context, useRootNavigator: true, barrierDismissible: widget.tapCloses, barrierColor: widget.dim ? Colors.black54 : Colors.transparent, builder: (context) => Dialog(backgroundColor: Colors.transparent, elevation: 0, insetPadding: const EdgeInsets.all(20), child: content));
    shown.whenComplete(() => _open = false);
    if (widget.autoClose > 0) Timer(Duration(milliseconds: (widget.autoClose * 1000).round()), _hide);
  }
  void _hide() { if (_open && mounted) Navigator.of(context, rootNavigator: true).pop(); }
  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
