// Pocket runtime for Flutter: the app's state (variables, data collections, the opened record, navigation)
// and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by Pocket Engine's
// native export; the pages in lib/pages/ are yours to change, and so is this file.
import 'dart:convert';

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
  const NavTab(this.label, this.icon, this.page, {this.badge = ''});
  final String label, page, badge;
  final IconData icon;
}

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
    return null;
  }
}

Palette pal(BuildContext context) => Theme.of(context).brightness == Brightness.dark ? app.dark : app.light;

// ---------------------------------------------------------------------------------------------------------------
// The app's state
// ---------------------------------------------------------------------------------------------------------------

late AppState app;

class AppState extends ChangeNotifier {
  AppState({required this.name, required this.collections, required this.stats, required Map<String, Object?> vars, required this.tabs, required this.home, required this.light, required this.dark, this.themeSetting = 'follow the phone'}) {
    this.vars.addAll(vars);
  }

  final String name, home, themeSetting;
  final List<Collection> collections;
  final List<Stat> stats;
  final List<NavTab> tabs;
  final Palette light, dark;
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
    final now = DateTime.now().millisecondsSinceEpoch;
    for (final c in collections) {
      final rows = s[c.name] as List?;
      data[c.name] = rows != null
          ? rows.map((r) => Map<String, Object?>.from(r as Map)).toList()
          : [for (var i = 0; i < c.sample.length; i++) {'_id': 's$i', '_at': now - i * 1000, ...c.sample[i]}];
    }
    final v = _prefs?.getString('pocket.vars');
    if (v != null) vars.addAll(Map<String, Object?>.from(jsonDecode(v) as Map));
    _work();
  }

  void _changed() { _work(); _prefs?.setString('pocket.data', jsonEncode(data)); _prefs?.setString('pocket.vars', jsonEncode(vars)); notifyListeners(); }

  /// Stats are worked out again whenever the data changes.
  void _work() { for (final s in stats) { vars[s.variable] = stat(s.collection, s.how, field: s.field, filter: s.filter); } }

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
  String fill(String t, [Map<String, Object?>? row]) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
        final k = m[1]!;
        if (row != null && row.containsKey(k)) return show(row[k]);
        if (k.startsWith('record_')) return show(opened?[k.substring(7)]);
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
    (data[name] ??= []).add({'_id': id, '_at': DateTime.now().millisecondsSinceEpoch, ...values});
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

  /// What a button does (the same words as the button's Action in Pocket Engine).
  void run(String action, [Object? value, num amount = 1]) {
    final v = '${value ?? ''}';
    switch (action) {
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
        bottomNavigationBar: NavigationBar(
          selectedIndex: app.tab,
          onDestinationSelected: app.pickTab,
          destinations: [
            for (final t in app.tabs)
              NavigationDestination(
                icon: Badge(isLabelVisible: t.badge.isNotEmpty && (num.tryParse(AppState.show(app.get(t.badge))) ?? 0) > 0, label: Text(AppState.show(app.get(t.badge))), child: Icon(t.icon)),
                label: t.label,
              ),
          ],
        ),
      );
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------------

/// A page: the app bar with its title, then what's on it (a list or form fills the rest).
class PocketPage extends StatelessWidget {
  const PocketPage({super.key, required this.title, required this.body, this.fab, this.appBar = true, this.scroll = true});
  final String title;
  final List<Widget> Function(BuildContext context) body;
  final Widget? fab;
  final bool appBar, scroll;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (context, _) {
          final kids = body(context);
          return Scaffold(
            appBar: appBar ? AppBar(title: Text(app.fill(title), style: const TextStyle(fontWeight: FontWeight.w800))) : null,
            floatingActionButton: fab,
            body: SafeArea(
              child: scroll
                  ? ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 96), children: _spaced(kids))
                  : Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 0), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: _spaced(kids))),
            ),
          );
        },
      );
  static List<Widget> _spaced(List<Widget> k) => [for (var i = 0; i < k.length; i++) ...[if (i > 0 && k[i] is! Expanded && k[i] is! Spacer) const SizedBox(height: 12), k[i]]];
}

/// Text with {variables} filled in.
class PText extends StatelessWidget {
  const PText(this.text, {super.key, this.size = 16, this.weight = 600, this.color});
  final String text;
  final double size;
  final int weight;
  final String? color;
  @override
  Widget build(BuildContext context) {
    final p = pal(context);
    return Text(app.fill(text), style: TextStyle(fontSize: size, fontWeight: FontWeight.values[((weight ~/ 100) - 1).clamp(0, 8)], color: p.resolve(color) ?? p.text));
  }
}

enum Look { filled, outlined, danger, plain }

class PButton extends StatelessWidget {
  const PButton(this.label, {super.key, required this.onTap, this.look = Look.filled});
  final String label;
  final VoidCallback onTap;
  final Look look;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), text = Text(app.fill(label), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800));
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
    const size = Size.fromHeight(52);
    return switch (look) {
      Look.filled => FilledButton(onPressed: onTap, style: FilledButton.styleFrom(minimumSize: size, shape: shape, backgroundColor: p.accent, foregroundColor: p.onAccent), child: text),
      Look.danger => OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: size, shape: shape, foregroundColor: p.danger, side: BorderSide(color: p.danger, width: 2), backgroundColor: p.card), child: text),
      Look.outlined => OutlinedButton(onPressed: onTap, style: OutlinedButton.styleFrom(minimumSize: size, shape: shape, foregroundColor: p.accent, side: BorderSide(color: p.accent, width: 2)), child: text),
      Look.plain => TextButton(onPressed: onTap, child: text),
    };
  }
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
  const VarField(this.variable, {super.key, this.placeholder = '', this.keyboard = 'text'});
  final String variable, placeholder, keyboard;
  @override
  State<VarField> createState() => _VarFieldState();
}

class _VarFieldState extends State<VarField> {
  late final c = TextEditingController(text: AppState.show(app.get(widget.variable)));
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => TextField(
        controller: c,
        obscureText: widget.keyboard == 'password',
        keyboardType: widget.keyboard == 'number' ? TextInputType.number : widget.keyboard == 'email' ? TextInputType.emailAddress : TextInputType.text,
        decoration: InputDecoration(hintText: widget.placeholder, prefixIcon: widget.keyboard == 'search' ? const Icon(Icons.search) : null),
        onChanged: (v) => app.set(widget.variable, widget.keyboard == 'number' ? num.tryParse(v) ?? 0 : v),
      );
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
  const RecordList({super.key, required this.collection, this.title = '{title}', this.subtitle = '', this.icon = '', this.check = '', this.search = '', this.filter = '', this.sort = 'newest first', this.openPage = '', this.empty = 'Nothing here yet'});
  final String collection, title, subtitle, icon, check, search, filter, sort, openPage, empty;
  @override
  Widget build(BuildContext context) {
    final p = pal(context), rows = app.query(collection, filter: filter, search: search.isEmpty ? '' : AppState.show(app.get(search)), sort: sort);
    if (rows.isEmpty) return Center(child: Padding(padding: const EdgeInsets.all(32), child: Text(empty, textAlign: TextAlign.center, style: TextStyle(color: p.sub, fontSize: 16))));
    return ListView.separated(
      padding: const EdgeInsets.only(bottom: 96),
      itemCount: rows.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final r = rows[i], id = '${r['_id']}', done = check.isNotEmpty && (r[check] == true || r[check] == 1);
        return Dismissible(
          key: ValueKey(id),
          direction: DismissDirection.endToStart,
          background: Container(alignment: Alignment.centerRight, padding: const EdgeInsets.only(right: 24), decoration: BoxDecoration(color: p.danger, borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.delete_outline, color: Colors.white)),
          onDismissed: (_) => app.deleteRecord(collection, id),
          child: Card(
            child: ListTile(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              leading: check.isNotEmpty
                  ? Checkbox(value: done, shape: const CircleBorder(), onChanged: (v) => app.updateRecord(collection, id, {check: v ?? false}))
                  : icon.isNotEmpty ? Text(app.fill(icon, r), style: const TextStyle(fontSize: 26)) : null,
              title: Text(app.fill(title, r), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: done ? p.sub : p.text, decoration: done ? TextDecoration.lineThrough : null)),
              subtitle: subtitle.isEmpty ? null : Text(app.fill(subtitle, r), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: p.sub)),
              trailing: openPage.isEmpty ? null : Icon(Icons.chevron_right, color: p.sub),
              onTap: openPage.isEmpty ? null : () { app.open(collection, id); app.go(openPage); },
            ),
          ),
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
