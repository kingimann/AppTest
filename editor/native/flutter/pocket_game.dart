// Pocket game runtime for Flutter: plays a Pocket Engine 2D game natively, with no web view. The game itself is
// assets/game.json (exactly as Pocket Engine saved it); this file reads it and runs it with the engine's rules:
// shapes, emoji and text drawn on a Flutter canvas, objects inside objects, physics (gravity, solid ground, moving
// platforms), the HUD, touch (joystick, jump / fire buttons, swipes, drags) and keys, score, lives, best score,
// the title and game-over screens, and the components (Move, Platformer, Spawner, Health, Damage Dealer, Trigger…).
// Made by Pocket Engine's native export; it's a readable file: change anything you like.
import 'dart:convert';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

final _rng = math.Random();
double numOf(Object? v, [double d = 0]) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? d;
bool onOf(Object? v, [bool d = false]) => v == null ? d : v == true || v == 1 || v == 'yes' || v == 'true';
String strOf(Object? v, [String d = '']) => v == null || '$v'.isEmpty ? d : '$v';
double rand(double a, double b) => a + _rng.nextDouble() * (b - a);
const deg = math.pi / 180;

/// A number, or a random number in a [min, max] range (the engine's "range" settings).
double pick(Object? v, [double d = 0]) {
  if (v is List && v.length >= 2) { final a = numOf(v[0]), b = numOf(v[1]); return a + _rng.nextDouble() * (b - a); }
  if (v is List && v.isNotEmpty) return numOf(v[0], d);
  return numOf(v, d);
}

/// "enemy, hazard" → ['enemy', 'hazard'].
List<String> tagList(Object? v) => '${v ?? ''}'.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

/// '#ff8800', '#f80', '#ff880080' or 'rgba(255,136,0,0.5)' → a colour.
Color? colorOf(Object? v) {
  final s = '${v ?? ''}'.trim();
  if (s.isEmpty || s == 'none' || s == 'transparent') return null;
  if (s.startsWith('#')) {
    var h = s.substring(1);
    if (h.length == 3) h = h.split('').map((c) => c + c).join();
    if (h.length == 6) return Color(int.parse('FF$h', radix: 16));
    if (h.length == 8) return Color(int.parse(h.substring(6) + h.substring(0, 6), radix: 16));
    return null;
  }
  final m = RegExp(r'rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)').firstMatch(s);
  if (m != null) return Color.fromRGBO(double.parse(m[1]!).round(), double.parse(m[2]!).round(), double.parse(m[3]!).round(), double.tryParse(m[4] ?? '1') ?? 1);
  return null;
}

/// Between two colours (k: 0 → a, 1 → b).
Color mixColor(Color a, Color b, double k) => Color.lerp(a, b, k.clamp(0.0, 1.0))!;

/// 12.7 → "12", 15300 → "15.3K" (the engine's formatNumber).
String formatNumber(double v) {
  final a = v.abs();
  if (a < 10000) return v.floor().toString();
  for (final (n, u) in const [(1e12, 'T'), (1e9, 'B'), (1e6, 'M'), (1e3, 'K')]) {
    if (a >= n) { final k = (v / n * 10).floor() / 10; return '${k == k.roundToDouble() ? k.toInt() : k}$u'; }
  }
  return v.floor().toString();
}

/// The engine's easing curves by name (linear, inOutSine, outBack, outBounce…).
double ease(String name, double t) {
  t = t.clamp(0.0, 1.0);
  switch (name) {
    case 'linear': return t;
    case 'inQuad': return t * t;
    case 'outQuad': return 1 - (1 - t) * (1 - t);
    case 'inOutQuad': return t < 0.5 ? 2 * t * t : 1 - math.pow(-2 * t + 2, 2) / 2;
    case 'inCubic': return t * t * t;
    case 'outCubic': return 1 - math.pow(1 - t, 3).toDouble();
    case 'inOutCubic': return t < 0.5 ? 4 * t * t * t : 1 - math.pow(-2 * t + 2, 3) / 2;
    case 'inSine': return 1 - math.cos(t * math.pi / 2);
    case 'outSine': return math.sin(t * math.pi / 2);
    case 'inOutSine': return -(math.cos(math.pi * t) - 1) / 2;
    case 'inBack': return 2.70158 * t * t * t - 1.70158 * t * t;
    case 'outBack': return 1 + 2.70158 * math.pow(t - 1, 3) + 1.70158 * math.pow(t - 1, 2);
    case 'inOutBack': { const c = 1.70158 * 1.525; return t < 0.5 ? (math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2; }
    case 'outElastic': return t == 0 || t == 1 ? t : math.pow(2, -10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1;
    case 'inElastic': return t == 0 || t == 1 ? t : -math.pow(2, 10 * t - 10) * math.sin((t * 10 - 10.75) * (2 * math.pi / 3));
    case 'outBounce': return _bounce(t);
    case 'inBounce': return 1 - _bounce(1 - t);
    case 'inOutBounce': return t < 0.5 ? (1 - _bounce(1 - 2 * t)) / 2 : (1 + _bounce(2 * t - 1)) / 2;
    case 'outExpo': return t == 1 ? 1 : 1 - math.pow(2, -10 * t).toDouble();
    case 'inExpo': return t == 0 ? 0 : math.pow(2, 10 * t - 10).toDouble();
    default: return -(math.cos(math.pi * t) - 1) / 2;
  }
}
double _bounce(double t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
  if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
  t -= 2.625 / d; return n * t * t + 0.984375;
}

// ---------------------------------------------------------------------------------------------------------------
// Objects in the game
// ---------------------------------------------------------------------------------------------------------------

/// A physics body: dynamic ones fall and are pushed out of solid ones; static and kinematic ones are the ground,
/// walls and moving platforms; sensors only notice touches.
class Body {
  Body(Map<String, dynamic> j) {
    type = strOf(j['type'], 'dynamic');
    sensor = onOf(j['sensor']); oneWay = onOf(j['oneWay']);
    gravityScale = numOf(j['gravityScale'], 1); bounce = numOf(j['bounce']); friction = numOf(j['friction']); drag = numOf(j['drag']);
    maxFall = numOf(j['maxFall']); maxSpeed = numOf(j['maxSpeed']);
    vx = numOf(j['vx']); vy = numOf(j['vy']);
    lockX = onOf(j['lockX']); lockY = onOf(j['lockY']);
    shape = strOf(j['shape'], 'auto'); w = numOf(j['w']); h = numOf(j['h']); r = numOf(j['r']); ox = numOf(j['ox']); oy = numOf(j['oy']);
    ignore = tagList(j['ignore']);
  }
  late String type, shape;
  late bool sensor, oneWay, lockX, lockY;
  late double gravityScale, bounce, friction, drag, maxFall, maxSpeed, vx, vy, w, h, r, ox, oy;
  late List<String> ignore;
  bool grounded = false, wasGrounded = false;
  /// How hard it landed this frame (speed), 0 if it didn't.
  double landed = 0;
  /// A force zone's push this frame.
  double fx = 0, fy = 0;
  /// How far a platform moved since the last step (riders go with it).
  double dx = 0, dy = 0, px = double.nan, py = double.nan;
  GameObject? groundedOn;
  bool get solid => !sensor && (type == 'static' || type == 'kinematic');
  bool get isDynamic => type == 'dynamic';
}

/// One object: where it is, how it looks (shape, text), its tags, its body and its components.
class GameObject {
  GameObject(this.json, PocketGame game, {double? x, double? y, double? rz, this.parent}) {
    uid = ++_uids;
    id = strOf(json['id'], 'o$uid');
    name = '${json['name'] ?? ''}';
    tags = {for (final t in (json['tags'] as List? ?? const [])) '$t'};
    this.x = x ?? numOf(json['x']); this.y = y ?? numOf(json['y']);
    this.rz = rz ?? numOf(json['rz']);
    sx = numOf(json['sx'], 1); sy = numOf(json['sy'], 1);
    alpha = numOf(json['alpha'], 1);
    layer = numOf(json['layer']).toInt();
    visible = json['visible'] != false;
    ui = json['ui'] == true;
    anchor = '${json['anchor'] ?? 'top-left'}';
    showWhen = strOf(json['showWhen'], 'always');
    stretch = strOf(json['stretch']);
    margin = numOf(json['margin']);
    final sh = (json['shape'] as Map?)?.cast<String, dynamic>();
    shape = sh == null ? null : {...sh}; // (components change colours; the template keeps its own)
    final tx = (json['text'] as Map?)?.cast<String, dynamic>();
    text = tx == null ? null : {...tx};
    sprite = (json['sprite'] as Map?)?.cast<String, dynamic>();
    bar = (json['bar'] as Map?)?.cast<String, dynamic>();
    final b = (json['body'] as Map?)?.cast<String, dynamic>();
    if (b != null) body = Body(b);
    home = Offset(this.x, this.y);
    lx = this.x; ly = this.y; lrz = this.rz;
    for (final raw in (json['behaviors'] as List? ?? const [])) {
      final p = (raw as Map).cast<String, dynamic>();
      final type = '${p['type']}';
      final made = makeComponent(type, p.containsKey('params') ? (p['params'] as Map).cast<String, dynamic>() : p);
      if (made != null) { made.type = type; parts.add(made); } else { game.missing.add(type); }
    }
  }
  static int _uids = 0;
  final Map<String, dynamic> json;
  late final int uid;
  late String id, name, anchor, showWhen, stretch;
  late Set<String> tags;
  late double x, y, rz, sx, sy, alpha, margin;
  /// Its place inside its parent (children follow their parent).
  late double lx, ly, lrz;
  Offset? lastWorld;
  late int layer;
  late bool visible, ui;
  late Offset home;
  GameObject? parent;
  Map<String, dynamic>? shape, text, sprite, bar;
  Body? body;
  final List<Component> parts = [];
  final Map<String, Object?> data = {};
  bool dead = false;
  double invuln = 0;
  /// Bars drawn over it (health, hunger…): 0–1 and a colour.
  final Map<String, (double, Color)> bars = {};

  bool has(String tag) => tags.contains(tag) || name == tag;
  void destroy() => dead = true;
  T? part<T extends Component>() { for (final c in parts) { if (c is T) return c; } return null; }
  Component? partNamed(String type) { for (final c in parts) { if (c.type == type) return c; } return null; }
  bool get shown => visible && (parent == null || parent!.shown);

  /// A body (as a component needs one): keeps what it has, or makes one.
  Body ensureBody(String type, {double? gravityScale, bool sensor = false}) {
    final b = body ??= Body({'type': type, 'sensor': sensor});
    if (gravityScale != null && b.isDynamic) b.gravityScale = gravityScale;
    return b;
  }

  /// Half its width and height (a circle: its radius both ways), scaled.
  Size get half {
    final b = body;
    if (b != null && b.shape != 'auto') {
      if (b.shape == 'circle') { final r = (b.r > 0 ? b.r : 10.0) * math.max(sx.abs(), sy.abs()); return Size(r, r); }
      if (b.w > 0 || b.h > 0) return Size(b.w / 2 * sx.abs(), b.h / 2 * sy.abs());
    }
    final s = shape;
    if (s == null) {
      final sp = sprite;
      if (sp != null) return Size(numOf(sp['w'], 64) / 2 * sx.abs(), numOf(sp['h'], 64) / 2 * sy.abs());
      final t = text;
      if (t != null) { final sz = numOf(t['size'], 16); return Size('${t['value']}'.length * sz * 0.3 * sx.abs(), sz * 0.6 * sy.abs()); }
      final br = bar;
      if (br != null) return Size(numOf(br['w'], 200) / 2 * sx.abs(), numOf(br['h'], 12) / 2 * sy.abs());
      return Size.zero;
    }
    if (s['type'] == 'circle' || s['type'] == 'ring') { final r = numOf(s['r'], numOf(s['radius'], 16)); return Size(r * sx.abs(), r * sy.abs()); }
    return Size(numOf(s['w'], 32) / 2 * sx.abs(), numOf(s['h'], 32) / 2 * sy.abs());
  }
  bool get round { final b = body; if (b != null && b.shape != 'auto') return b.shape == 'circle'; return shape?['type'] == 'circle' || shape?['type'] == 'ring'; }

  double getField(String k) => switch (k) { 'x' => x, 'y' => y, 'rz' || 'angle' => rz, 'sx' => sx, 'sy' => sy, 'alpha' => alpha, _ => numOf(data[k]) };
  void setField(String k, double v) {
    switch (k) {
      case 'x': x = v;
      case 'y': y = v;
      case 'rz' || 'angle': rz = v;
      case 'sx': sx = v;
      case 'sy': sy = v;
      case 'alpha': alpha = v;
      default: data[k] = v;
    }
  }
}

/// A component that decides for itself what it touches (more than one tag, or anything).
mixin Toucher on Component {
  @override
  bool get listens => true;
}

/// What a component does each frame and when something touches its object.
abstract class Component {
  /// Its type name in Pocket Engine ("platformer", "health"…).
  String type = '';
  /// The tag it cares about touching ("player", "bullet"…), or null.
  String? get wants => null;
  /// Does it care about touching this object? (wants a tag by default)
  bool cares(GameObject other) { final w = wants; return w != null && other.has(w); }
  /// Hears touches with what it cares about (a tag it wants, or its own test).
  bool get listens => wants != null;
  /// Keeps working on the title and end screens (buttons).
  bool get always => false;
  void start(GameObject e, PocketGame g) {}
  void update(GameObject e, double dt, PocketGame g) {}
  /// Something it cares about started touching it.
  void touch(GameObject e, GameObject other, PocketGame g) {}
  /// Its object is being removed.
  void gone(GameObject e, PocketGame g) {}
}

// ---------------------------------------------------------------------------------------------------------------
// The game: its objects, variables, time and rules
// ---------------------------------------------------------------------------------------------------------------

class Particle {
  Particle(this.p, this.v, this.color, this.size, {this.life = 0.6, this.gravity = 0, this.shrink = true, this.grow = false, this.round = true, this.alpha = 1, this.stretch = 0}) : full = life;
  Offset p, v;
  final Color color;
  final double size, gravity, alpha, stretch, full;
  final bool shrink, grow, round;
  double life;
}
class Tap { Tap(this.screen, this.world, [this.id = 0]); final Offset screen, world; final int id; }
/// A finger on the screen: where it started and is now, and what it's doing (the joystick, a button, or free).
class Pointer { Pointer(this.id, this.start, this.at, this.t0); final int id; final Offset start; Offset at; final double t0; String role = 'free'; }
/// "+10" floating up from a point on the screen.
class FloatText { FloatText(this.at, this.text, this.color, this.size); Offset at; final String text; final Color color; final double size; double life = 1; }
/// A value easing to another over time (the engine's tweens: punch, squash, fades, moves).
class Tween {
  Tween(this.o, this.field, this.from, this.to, this.seconds, this.curve, {this.delay = 0, this.yoyo = false, this.done});
  final GameObject o;
  final String field, curve;
  final double from, to, seconds;
  double delay, t = 0;
  final bool yoyo;
  final VoidCallback? done;
}
/// A touch button on the screen: jump, fire, or a D-pad arrow.
class TouchButton { TouchButton(this.action, this.label, this.at, this.r); final String action, label; Offset at; final double r; int? finger; }

class PocketGame extends ChangeNotifier {
  /// vars: the variables (an app's, when the game shares them with native widgets in its HUD).
  PocketGame(this.json, {Map<String, Object?>? vars}) : vars = vars ?? {} {
    final s = (json['settings'] as Map?)?.cast<String, dynamic>() ?? {};
    settings = {...s};
    final view = (json['view'] as Map?)?.cast<String, dynamic>() ?? {};
    viewW = numOf(view['width'], 400); viewH = numOf(view['height'], 700);
    baseBackground = colorOf(json['background']) ?? const Color(0xFF101830);
    background = baseBackground;
  }
  final Map<String, dynamic> json;
  late final Map<String, dynamic> settings;
  late final double viewW, viewH;
  late final Color baseBackground;
  late Color background;
  /// title, play, over or win.
  String state = 'title';
  bool paused = false;
  final Map<String, Object?> vars;
  List<GameObject> objects = [];
  final List<GameObject> _born = [];
  final Map<String, Map<String, dynamic>> templates = {};
  /// Children of templates (they spawn with their template), by the template's id.
  final Map<String, List<Map<String, dynamic>>> templateKids = {};
  final Set<String> missing = {};
  final List<Particle> particles = [];
  final List<FloatText> floats = [];
  final List<Tween> tweens = [];
  final List<(String, double)> messages = [];
  final List<void Function(String)> listeners = [];
  final List<(double, VoidCallback)> _later = [];
  final Set<String> _contacts = {};
  /// Things drawn over the game by components (a pull line, a hold ring…), in screen pixels.
  final List<void Function(Canvas)> overlays = [];
  double time = 0, shake = 0, gravity = 0, darkness = 0;
  /// The camera: what the middle of the screen looks at, and how far in it's zoomed (a Camera component moves it).
  late double camX = viewW / 2, camY = viewH / 2, camZoom = 1;
  bool newBest = false;
  SharedPreferences? prefs;
  // input
  Size screen = Size.zero;
  EdgeInsets safe = EdgeInsets.zero;
  final Set<LogicalKeyboardKey> keys = {};
  final Set<LogicalKeyboardKey> _keysBefore = {};
  final List<Tap> taps = [];
  final Map<int, Pointer> pointers = {};
  final List<Pointer> downs = [], ups = [];
  final Set<String> pressed = {};
  final List<TouchButton> buttons = [];
  Pointer? stick;
  Offset? finger;
  Offset dragDelta = Offset.zero;
  /// UI objects a touch presses (buttons): those touches never steer the joystick or jump.
  final Set<GameObject> tapTargets = {};
  /// Directions and buttons held by HUD Touch Buttons.
  final Set<String> virtualHeld = {};
  /// The camera object driving the view (several cameras: the one switched to).
  GameObject? activeCamera;
  /// Things drawn in the world by components (a rope), in world units.
  final List<void Function(Canvas)> worldOverlays = [];
  /// Flutter widgets components put over the game (a dialogue box, an inventory, a shop), drawn in order.
  final List<Widget Function(BuildContext)> panels = [];
  /// Game-wide systems components share (the inventory, quests, turns…), by name.
  final Map<String, Object?> systems = {};
  /// Things to do when the game resets (systems clear their state).
  final List<VoidCallback> onReset = [];
  /// HUD objects drawn by a native widget instead of the canvas (their id → the widget).
  Widget? Function(GameObject o)? hudWidget;
  /// The objects (by id) hudWidget draws: the canvas leaves them out.
  Set<String> hudIds = {};
  /// Saved game data from Game Settings (items, recipes, quests, dialogues…).
  Map<String, dynamic> get gameData => json;

  String get saveKey => '${settings['saveBest'] ?? ''}'.isNotEmpty ? '${settings['saveBest']}' : '${json['name'] ?? 'game'}';
  double get zoom => (screen.isEmpty ? 1 : math.min(screen.width / viewW, screen.height / viewH)) * camZoom;
  /// How big the HUD is on this screen (the engine's "scale with screen size").
  double get uiK => screen.isEmpty ? 1 : math.exp(0.5 * math.log(screen.width / viewW) + 0.5 * math.log(screen.height / viewH)).clamp(0.6, 2.5).toDouble();
  Offset toWorld(Offset s) => Offset((s.dx - screen.width / 2) / zoom + camX, (s.dy - screen.height / 2) / zoom + camY);
  Offset toScreen(double x, double y) => Offset((x - camX) * zoom + screen.width / 2, (y - camY) * zoom + screen.height / 2);
  Rect get viewBounds { final hw = screen.width / 2 / zoom, hh = screen.height / 2 / zoom; return Rect.fromLTRB(camX - hw, camY - hh, camX + hw, camY + hh); }

  Future<void> load() async {
    try { prefs = await SharedPreferences.getInstance(); } catch (_) {}
    reset();
    if ('${settings['title'] ?? ''}'.isEmpty && !objects.any((o) => o.ui && o.showWhen == 'title')) start(); // (no title screen: straight in)
  }

  /// Everything back to how the game starts.
  void reset() {
    vars..clear()..addAll((json['vars'] as Map?)?.cast<String, Object?>() ?? {});
    if (settings['saveBest'] != null && '${settings['saveBest']}'.isNotEmpty) vars['best'] = prefs?.getDouble('pocket.best.$saveKey') ?? 0;
    if (numOf(settings['timeLimit']) > 0) vars['time'] = numOf(settings['timeLimit']);
    if (settings['saveProgress'] == true) {
      final saved = prefs?.getString('pocket.save.$saveKey');
      if (saved != null) vars.addAll((jsonDecode(saved) as Map).cast<String, Object?>());
    }
    templates.clear(); templateKids.clear(); missing.clear(); particles.clear(); floats.clear(); tweens.clear(); messages.clear();
    listeners.clear(); _later.clear(); _contacts.clear(); tapTargets.clear(); _born.clear(); overlays.clear(); worldOverlays.clear(); virtualHeld.clear(); activeCamera = null; panels.clear(); systems.clear(); for (final f in [...onReset]) { f(); }
    objects = [];
    gravity = numOf(json['gravity']);
    background = baseBackground; darkness = 0; paused = false;
    final all = (json['entities'] as List? ?? const []).map((r) => (r as Map).cast<String, dynamic>()).toList();
    final tplIds = {for (final j in all) if (j['template'] == true) '${j['id']}'};
    final byId = {for (final j in all) '${j['id']}': j};
    bool inTemplate(Map<String, dynamic> j) {
      var q = j; var n = 0;
      while (q['parent'] != null && n++ < 50) { if (tplIds.contains('${q['parent']}')) return true; final up = byId['${q['parent']}']; if (up == null) return false; q = up; }
      return false;
    }
    for (final j in all) {
      if (j['template'] != true && inTemplate(j)) { templateKids.putIfAbsent('${j['parent']}', () => []).add(j); continue; }
      if (j['template'] == true) { templates['${j['name']}'] = j; continue; }
      objects.add(GameObject(j, this));
    }
    final ids = {for (final o in objects) o.id: o};
    for (final o in objects) { final pid = o.json['parent']; if (pid != null) o.parent = ids['$pid']; }
    for (final t in templates.values) { GameObject(t, this); } // (notes their missing components too)
    for (final k in templateKids.values) { for (final j in k) { GameObject(j, this); } }
    time = 0; shake = 0; newBest = false;
    camX = viewW / 2; camY = viewH / 2; camZoom = 1;
    _syncHierarchy();
    layoutButtons();
  }

  void start() {
    reset();
    state = 'play';
    if ((json['items'] as List? ?? const []).isNotEmpty || (json['quests'] as List? ?? const []).isNotEmpty || (json['dialogues'] as List? ?? const []).isNotEmpty) ItemSystems.of(this); // (quests that start by themselves, the logic's item instructions)
    for (final o in [...objects]) { for (final c in o.parts) { c.start(o, this); } }
    _addBorn();
    layoutButtons();
    notifyListeners();
  }

  /// A copy of a template object ("Rock", "Bullet"…) at a spot, with what's inside it.
  GameObject? spawn(String name, double x, double y, [double rz = 0]) {
    final t = templates[name];
    if (t == null) return null;
    final o = GameObject(t, this, x: x, y: y, rz: rz == 0 ? null : rz);
    o.data['spawned'] = true;
    _born.add(o);
    void kids(String srcId, GameObject parent) {
      for (final k in templateKids[srcId] ?? const <Map<String, dynamic>>[]) {
        final c = GameObject(k, this, parent: parent);
        _born.add(c);
        kids('${k['id']}', c);
      }
    }
    kids('${t['id']}', o);
    return o;
  }
  void _addBorn() {
    while (_born.isNotEmpty) {
      final list = [..._born]; _born.clear();
      objects.addAll(list);
      _syncHierarchy(list);
      for (final o in list) { for (final c in o.parts) { c.start(o, this); } }
    }
  }

  /// An object by its name (or id), or the first with that tag.
  GameObject? find(String name) {
    if (name.isEmpty) return null;
    for (final o in objects) { if (!o.dead && (o.name == name || o.id == name)) return o; }
    for (final o in objects) { if (!o.dead && o.tags.contains(name)) return o; }
    return null;
  }
  /// Every object with a tag (or name).
  List<GameObject> findAll(String tag) => [for (final o in objects) if (!o.dead && o.has(tag)) o];

  double numVar(String k) => numOf(vars[k]);
  void setVar(String k, Object? v) { vars[k] = v; }
  void addVar(String k, double by) => vars[k] = numVar(k) + by;

  /// '{score} points' → '12 points' (an object's own values first: an upgrade's {cost}).
  String fill(String t, [GameObject? o]) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
        final k = m[1]!, v = o?.data[k] ?? vars[k];
        if (v is num) return formatNumber(v.toDouble());
        return v == null ? '' : '$v';
      });

  void message(String text, [double seconds = 2]) => messages.add((fill(text), seconds));
  /// Messages between components ("open shop", "boss-down"): anything listening hears it.
  void send(String m) { if (m.isEmpty) return; for (final l in [...listeners]) { l(m); } }
  void on(void Function(String) l) => listeners.add(l);
  /// Do something a little later (seconds of game time).
  void after(double seconds, VoidCallback f) => _later.add((time + seconds, f));
  void burst(double x, double y, Color color, int count, [double size = 1]) {
    for (var i = 0; i < count; i++) {
      final a = _rng.nextDouble() * math.pi * 2, sp = (60 + _rng.nextDouble() * 160) * size;
      particles.add(Particle(Offset(x, y), Offset(math.cos(a) * sp, math.sin(a) * sp), color, (2 + _rng.nextDouble() * 3) * size));
    }
  }
  /// "+10" floating up from a point on the screen.
  void popText(Offset screenAt, String text, Color color, [double size = 24]) => floats.add(FloatText(screenAt, text, color, size));
  /// "+10" over an object.
  void popOver(GameObject o, String text, Color color, [double size = 22]) => popText(o.ui ? uiRect(o).center : toScreen(o.x, o.y - o.half.height), text, color, size);
  void buzz([bool hard = false]) { hard ? HapticFeedback.heavyImpact() : HapticFeedback.selectionClick(); }
  /// The engine's sounds (coin, jump, hit, power, win, lose, click): a tap of the phone's haptics and its click.
  void sfx(String name) {
    if (name.isEmpty || name == 'none') return;
    if (name == 'hit' || name == 'lose') { HapticFeedback.mediumImpact(); } else { HapticFeedback.selectionClick(); }
    if (name == 'click') SystemSound.play(SystemSoundType.click);
  }

  /// Ease a value of an object to another (moves, fades, squashes).
  Tween tween(GameObject o, String field, double to, double seconds, {String curve = 'outQuad', double delay = 0, bool yoyo = false, VoidCallback? done}) {
    final t = Tween(o, field, o.getField(field), to, math.max(0.001, seconds), curve, delay: delay, yoyo: yoyo, done: done);
    tweens.add(t);
    return t;
  }
  void killTweens(GameObject o, [String? field]) => tweens.removeWhere((t) => t.o == o && (field == null || t.field == field));
  /// Squash it a little and spring back (a press).
  void squash(GameObject o, [double k = 0.9]) {
    final bx = numOf(o.data['baseSx'], o.sx), by = numOf(o.data['baseSy'], o.sy);
    o.data['baseSx'] = bx; o.data['baseSy'] = by;
    killTweens(o, 'sx'); killTweens(o, 'sy');
    o.sx = bx * k; o.sy = by * k;
    tween(o, 'sx', bx, 0.3, curve: 'outBack'); tween(o, 'sy', by, 0.3, curve: 'outBack');
  }

  void gameOver() => _end('over');
  void win() => _end('win');
  void _end(String how) {
    if (state != 'play') return;
    state = how;
    if ('${settings['saveBest'] ?? ''}'.isNotEmpty && numVar('score') > numVar('best')) {
      vars['best'] = numVar('score').floorToDouble(); newBest = true;
      prefs?.setDouble('pocket.best.$saveKey', numVar('best'));
    }
    if (settings['saveProgress'] == true) prefs?.remove('pocket.save.$saveKey');
    sfx(how == 'win' ? 'win' : 'lose');
    buzz(true);
    send(how == 'win' ? 'won' : 'game over');
    notifyListeners();
  }

  /// The player hit something: lose a life, go back to the start (or the last checkpoint), or end the game (the engine's respawnOrEnd).
  void hurt(GameObject player, String action) {
    if (action == 'respawn' || (action == 'damage' && numVar('lives') > 1)) {
      if (action == 'damage') addVar('lives', -1);
      sfx('hit'); buzz(true); shake = 10;
      burst(player.x, player.y, colorOf(player.shape?['fill']) ?? Colors.white, 14);
      if (action == 'respawn' || player.data['respawnOnHit'] == true) {
        final sp = player.data['respawn'] as Offset? ?? player.home;
        player.x = sp.dx; player.y = sp.dy;
        player.body?..vx = 0..vy = 0;
      }
      player.invuln = 1.2;
      return;
    }
    if (action == 'damage') setVar('lives', 0);
    sfx('hit'); shake = 18;
    burst(player.x, player.y, colorOf(player.shape?['fill']) ?? Colors.white, 40, 1.4);
    player.visible = false; player.destroy();
    gameOver();
  }

  // ---- saving (the Save game / Load game actions, Save Point, Save Manager) ----
  /// Variables and where everything is, in a save slot on the phone.
  bool saveGame([Object? slot = 1, bool positions = true]) {
    final data = {
      'vars': vars,
      if (positions) 'objects': {for (final o in objects) if (!o.ui && !o.dead) o.id: [o.x, o.y, o.visible ? 1 : 0]},
      'removed': [for (final j in (json['entities'] as List? ?? const [])) if ((j as Map)['template'] != true && !objects.any((o) => o.id == '${j['id']}')) '${j['id']}'],
    };
    prefs?.setString('pocket.slot.$saveKey.$slot', jsonEncode(data));
    return true;
  }
  bool loadGame([Object? slot = 1]) {
    final s = prefs?.getString('pocket.slot.$saveKey.$slot');
    if (s == null) return false;
    final d = jsonDecode(s) as Map<String, dynamic>;
    vars.addAll((d['vars'] as Map).cast<String, Object?>());
    final pos = (d['objects'] as Map?)?.cast<String, dynamic>() ?? {};
    final removed = {for (final r in (d['removed'] as List? ?? const [])) '$r'};
    for (final o in objects) {
      if (removed.contains(o.id)) { o.destroy(); continue; }
      final p = pos[o.id];
      if (p is List && p.length >= 2) { o.x = numOf(p[0]); o.y = numOf(p[1]); if (p.length > 2) o.visible = numOf(p[2]) > 0; o.body?..vx = 0..vy = 0; }
    }
    return true;
  }
  bool hasSave([Object? slot = 1]) => prefs?.getString('pocket.slot.$saveKey.$slot') != null;
  void deleteSave([Object? slot = 1]) => prefs?.remove('pocket.slot.$saveKey.$slot');

  /// Do one of the engine's actions (Trigger, Timer, Condition, Button, Rules: "add score", "spawn template", "win"…).
  void runAction(GameObject e, Map<String, dynamic> p, [GameObject? other]) {
    final v = strOf(p['value']), action = strOf(p['action'], 'message'), amount = p['amount'] ?? 1;
    GameObject? obj(String n) => n.isEmpty ? e : find(n);
    List<double> nums(Object? a) => '$a'.split(',').map((s) => double.tryParse(s.trim()) ?? 0).toList();
    switch (action) {
      case 'set variable': setVar(v.isEmpty ? 'score' : v, amount is num ? amount : double.tryParse('$amount') ?? amount);
      case 'add score': addVar('score', numOf(amount, 1));
      case 'add to variable': addVar(v.isEmpty ? 'score' : v, numOf(amount, 1));
      case 'hide object': obj(v)?.visible = false;
      case 'show object': find(v)?.visible = true;
      case 'toggle object': { final t = obj(v); if (t != null) t.visible = !t.visible; }
      case 'destroy other': if (other != null) { burst(other.x, other.y, Colors.white, 12); other.destroy(); }
      case 'destroy object': { final t = v.isEmpty ? e : find(v); if (t != null) { burst(t.x, t.y, Colors.white, 16); t.destroy(); } }
      case 'spawn template': if (v.isNotEmpty) spawn(v, e.x, e.y);
      case 'play sound': sfx(strOf(p['sound']) != '' && p['sound'] != 'none' ? '${p['sound']}' : v.isEmpty ? 'click' : v); return;
      case 'vibrate': buzz(true);
      case 'camera shake': shake = math.max(shake, numOf(amount) * 4 > 0 ? numOf(amount) * 4 : 10);
      case 'jump': { final t = obj(v) ?? e, a = numOf(amount, 1), b = t.body; if (b != null) b.vy = -(a > 50 ? a : a * 60); }
      case 'move by': { final t = obj(v) ?? e, d = nums(amount); t.x += d.isNotEmpty ? d[0] : 0; t.y += d.length > 1 ? d[1] : 0; }
      case 'push': { final t = (v.isNotEmpty ? obj(v) : other) ?? e, b = t.ensureBody('dynamic'), d = nums(amount); b.vx += d.isNotEmpty ? d[0] : 0; b.vy += d.length > 1 ? d[1] : 0; }
      case 'set gravity': gravity = numOf(amount);
      case 'win' || 'next level': win();
      case 'game over': gameOver();
      case 'message': message(v.isEmpty ? '…' : v, 2.5);
      case 'start game': if (state != 'play') start();
      case 'restart game': start(); return;
      case 'pause game': paused = !paused;
      case 'resume game': paused = false;
      case 'save game': if (saveGame(numOf(amount, 1).toInt())) message(v.isNotEmpty && v != 'Hello!' ? v : 'Game saved', 1.5);
      case 'load game': if (!loadGame(numOf(amount, 1).toInt())) message('No saved game yet', 1.5); return;
      case 'continue from newest save': if (!loadGame(1)) message('No saved game yet', 1.5); return;
      case 'delete save': deleteSave(numOf(amount, 1).toInt()); message('Save deleted', 1.5);
      case 'send message' || 'send network message': send(v);
      case 'show notification' || 'phone notification': { final parts = v.split('|'); message(parts.length > 1 ? '${parts[0].trim()}: ${parts[1].trim()}' : v, 2.5); }
      case 'switch camera': send('camera:$v');
      case 'play animation': send('play:${e.id}:$v');
      case 'go to page': { final kv = v.split('='); if (kv.length > 1) { setVar(kv[0].trim(), kv[1].trim()); } else { setVar('page', v.trim().isEmpty ? 'home' : v.trim()); } }
      default: send(action); // (sign-in, purchases and the online actions are in the web build; here they're a message other parts can hear)
    }
    final snd = strOf(p['sound']);
    if (snd.isNotEmpty && snd != 'none') sfx(snd);
  }

  // ---- where things are on the screen ----
  /// The rectangle of a HUD object on the screen: its anchor (in its parent's box, or the screen's safe area) plus its offset.
  Rect uiRect(GameObject o) {
    final k = uiK;
    final Rect area = o.parent != null && o.parent!.ui ? uiRect(o.parent!) : Rect.fromLTRB(safe.left, safe.top, screen.width - safe.right, screen.height - safe.bottom);
    final a = o.anchor;
    final fx = a.contains('left') ? 0.0 : a.contains('right') ? 1.0 : 0.5, fy = a.startsWith('top') ? 0.0 : a.startsWith('bottom') ? 1.0 : 0.5;
    var h = o.half;
    final wide = o.stretch == 'width' || o.stretch == 'both';
    if (wide) h = Size(math.max(1.0, area.width / k - o.margin * 2) / 2, o.stretch == 'both' ? math.max(1.0, area.height / k - o.margin * 2) / 2 : h.height);
    final cx = wide ? area.center.dx + o.x * k : area.left + fx * area.width + o.x * k;
    final cy = o.stretch == 'both' ? area.center.dy + o.y * k : area.top + fy * area.height + o.y * k;
    return Rect.fromCenter(center: Offset(cx, cy), width: h.width * 2 * k, height: h.height * 2 * k);
  }
  Offset uiCentre(GameObject o) => uiRect(o).center;
  /// Where an object is on the screen (HUD or world).
  Offset screenOf(GameObject o) => o.ui ? uiRect(o).center : toScreen(o.x, o.y);

  /// Is a point (a tap) on this object?
  bool hits(GameObject o, Tap t) => hitsAt(o, t.screen);
  bool hitsAt(GameObject o, Offset screenAt) {
    if (!o.shown || o.dead || (o.ui && !onScreen(o))) return false;
    if (o.ui) { final r = uiRect(o).inflate(4); return o.round ? (screenAt - r.center).distance <= r.width / 2 : r.contains(screenAt); }
    final at = toWorld(screenAt), h = o.half, pad = 6.0;
    if (o.round) return (at - Offset(o.x, o.y)).distance <= h.width + pad;
    return (at.dx - o.x).abs() <= h.width + pad && (at.dy - o.y).abs() <= h.height + pad;
  }
  /// The taps this frame that landed on an object.
  Iterable<Tap> tapsOn(GameObject o) => taps.where((t) => hits(o, t));
  /// The first new finger this frame on an object.
  Pointer? downOn(GameObject o) { for (final d in downs) { if (hitsAt(o, d.at)) return d; } return null; }

  /// Do two objects touch? (circles and boxes; a little slack so a bounce still counts as a hit)
  static bool overlap(GameObject a, GameObject b, [double slack = 1.5]) {
    final ha = a.half, hb = b.half;
    final ax = a.x + (a.body?.ox ?? 0), ay = a.y + (a.body?.oy ?? 0), bx = b.x + (b.body?.ox ?? 0), by = b.y + (b.body?.oy ?? 0);
    if (a.round && b.round) return (Offset(ax, ay) - Offset(bx, by)).distance <= ha.width + hb.width + slack;
    if (a.round || b.round) {
      final cx = a.round ? ax : bx, cy = a.round ? ay : by, rx = a.round ? bx : ax, ry = a.round ? by : ay, hr = a.round ? hb : ha, rad = a.round ? ha.width : hb.width;
      final nx = cx.clamp(rx - hr.width, rx + hr.width), ny = cy.clamp(ry - hr.height, ry + hr.height);
      return (Offset(cx, cy) - Offset(nx, ny)).distance <= rad + slack;
    }
    return (ax - bx).abs() <= ha.width + hb.width + slack && (ay - by).abs() <= ha.height + hb.height + slack;
  }
  /// Everything touching an object right now (that passes a test).
  List<GameObject> touching(GameObject e, bool Function(GameObject) test) => [for (final o in objects) if (o != e && !o.dead && !o.ui && test(o) && overlap(e, o)) o];

  /// How far b is pushed into a (which way, how deep): null if they don't overlap.
  static (double, double, double)? manifold(GameObject a, GameObject b) {
    final ha = a.half, hb = b.half;
    final ax = a.x + (a.body?.ox ?? 0), ay = a.y + (a.body?.oy ?? 0), bx = b.x + (b.body?.ox ?? 0), by = b.y + (b.body?.oy ?? 0);
    if (a.round && b.round) {
      final dx = bx - ax, dy = by - ay, d = math.sqrt(dx * dx + dy * dy), r = ha.width + hb.width;
      if (d >= r) return null;
      return d < 1e-6 ? (0.0, 1.0, r) : (dx / d, dy / d, r - d);
    }
    if (a.round || b.round) {
      final c = a.round ? Offset(ax, ay) : Offset(bx, by), rc = a.round ? Offset(bx, by) : Offset(ax, ay), hr = a.round ? hb : ha, rad = a.round ? ha.width : hb.width;
      final nx = c.dx.clamp(rc.dx - hr.width, rc.dx + hr.width), ny = c.dy.clamp(rc.dy - hr.height, rc.dy + hr.height);
      final dx = c.dx - nx, dy = c.dy - ny, d = math.sqrt(dx * dx + dy * dy);
      if (d >= rad) return null;
      double n1, n2, depth;
      if (d < 1e-6) { // the centre is inside the box: out along the shallow side
        final px = hr.width - (c.dx - rc.dx).abs(), py = hr.height - (c.dy - rc.dy).abs();
        if (px < py) { n1 = c.dx < rc.dx ? -1 : 1; n2 = 0; depth = px + rad; } else { n1 = 0; n2 = c.dy < rc.dy ? -1 : 1; depth = py + rad; }
      } else { n1 = dx / d; n2 = dy / d; depth = rad - d; }
      return a.round ? (-n1, -n2, depth) : (n1, n2, depth); // (from the box to the circle, turned to point from a to b)
    }
    final dx = bx - ax, dy = by - ay, px = ha.width + hb.width - dx.abs(), py = ha.height + hb.height - dy.abs();
    if (px <= 0 || py <= 0) return null;
    return px < py ? (dx < 0 ? -1.0 : 1.0, 0.0, px) : (0.0, dy < 0 ? -1.0 : 1.0, py);
  }

  /// Physics: gravity and speed move dynamic bodies, then they're pushed out of solid ones (landing on the ground, riding platforms).
  void _physics(double dt) {
    final list = [for (final o in objects) if (o.body != null && !o.dead && !o.ui) o];
    for (final e in list) {
      final b = e.body!;
      if (!b.isDynamic) { b.dx = b.px.isNaN ? 0 : e.x - b.px; b.dy = b.py.isNaN ? 0 : e.y - b.py; continue; }
      b.vy += gravity * b.gravityScale * dt;
      b.vx += b.fx * dt; b.vy += b.fy * dt; b.fx = 0; b.fy = 0;
      if (b.drag > 0) { final k = math.max(0.0, 1 - b.drag * dt); b.vx *= k; if (gravity == 0 || b.gravityScale == 0) b.vy *= k; }
      if (b.maxFall > 0 && gravity != 0 && b.vy * gravity.sign > b.maxFall) b.vy = b.maxFall * gravity.sign;
      if (b.maxSpeed > 0) { final v = math.sqrt(b.vx * b.vx + b.vy * b.vy); if (v > b.maxSpeed) { b.vx *= b.maxSpeed / v; b.vy *= b.maxSpeed / v; } }
      if (b.lockX) b.vx = 0;
      if (b.lockY) b.vy = 0;
      e.x += b.vx * dt; e.y += b.vy * dt;
      b.wasGrounded = b.grounded; b.grounded = false; b.groundedOn = null; b.landed = 0;
    }
    final gd = gravity == 0 ? 0.0 : gravity.sign;
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        final a = list[i], c = list[j], ba = a.body!, bc = c.body!;
        if (a.dead || c.dead || ba.sensor || bc.sensor) continue;
        if (!ba.isDynamic && !bc.isDynamic) continue;
        if (ba.ignore.any(c.has) || bc.ignore.any(a.has)) continue;
        final m = manifold(a, c);
        if (m == null) continue;
        final (nx, ny, depth) = m;
        // one-way platforms: only solid for something landing on top while falling
        if (ba.oneWay || bc.oneWay) {
          final dynA = ba.isDynamic && !bc.isDynamic, dyn = dynA ? a : bc.isDynamic && !ba.isDynamic ? c : null;
          if (dyn == null) continue;
          final n = dynA ? ny : -ny;
          if (!(gd != 0 && n * gd > 0.5) || dyn.body!.vy * gd < -0.01 || depth > math.max(dyn.half.height * 0.5, 0.0001)) continue;
        }
        final share = ba.isDynamic && bc.isDynamic ? 0.5 : 1.0;
        if (ba.isDynamic) {
          a.x -= nx * depth * share; a.y -= ny * depth * share;
          final vn = ba.vx * nx + ba.vy * ny;
          if (vn > 0) { final k = vn * (1 + math.max(ba.bounce, bc.bounce * 0.5)); ba.vx -= nx * k; ba.vy -= ny * k; }
          if (gd != 0 && ny * gd > 0.5) {
            if (!ba.wasGrounded && vn > gravity.abs() * 0.02) ba.landed = math.max(ba.landed, vn);
            ba.grounded = true; ba.groundedOn = c;
            if (!bc.isDynamic) { a.x += bc.dx; if (bc.dy * gd < 0) a.y += bc.dy; } // ride moving platforms
            final fr = math.max(ba.friction, bc.friction); if (fr > 0) ba.vx *= math.max(0.0, 1 - fr * dt * 10);
          }
        }
        if (bc.isDynamic) {
          c.x += nx * depth * share; c.y += ny * depth * share;
          final vn = bc.vx * nx + bc.vy * ny;
          if (vn < 0) { final k = vn * (1 + math.max(bc.bounce, ba.bounce * 0.5)); bc.vx -= nx * k; bc.vy -= ny * k; }
          if (gd != 0 && ny * gd < -0.5) {
            if (!bc.wasGrounded && -vn > gravity.abs() * 0.02) bc.landed = math.max(bc.landed, -vn);
            bc.grounded = true; bc.groundedOn = a;
            if (!ba.isDynamic) { c.x += ba.dx; if (ba.dy * gd < 0) c.y += ba.dy; }
            final fr = math.max(ba.friction, bc.friction); if (fr > 0) bc.vx *= math.max(0.0, 1 - fr * dt * 10);
          }
        }
      }
    }
    for (final e in list) { final b = e.body!; if (!b.isDynamic) { b.px = e.x; b.py = e.y; } }
  }

  /// Children follow their parents (position, turn and size); moves made to a child are kept as its new place in the parent.
  void _syncHierarchy([List<GameObject>? only]) {
    final list = (only ?? objects).where((e) => e.parent != null).toList();
    int depth(GameObject e) { var n = 0; var q = e.parent; while (q != null && n < 50) { n++; q = q.parent; } return n; }
    list.sort((a, b) => depth(a).compareTo(depth(b)));
    for (final e in list) {
      final p = e.parent!;
      if (e.dead) continue;
      if (p.dead) { e.destroy(); continue; }
      if (e.ui) continue; // (HUD children are laid out in their parent's box)
      final lw = e.lastWorld;
      if (lw != null && (e.x != lw.dx || e.y != lw.dy)) { // a component moved it: fold that into its place in the parent
        final a = -p.rz * deg, dx = e.x - lw.dx, dy = e.y - lw.dy;
        e.lx += (dx * math.cos(a) - dy * math.sin(a)) / (p.sx == 0 ? 1 : p.sx);
        e.ly += (dx * math.sin(a) + dy * math.cos(a)) / (p.sy == 0 ? 1 : p.sy);
      }
      final a = p.rz * deg, ox = e.lx * p.sx, oy = e.ly * p.sy;
      e.x = p.x + ox * math.cos(a) - oy * math.sin(a);
      e.y = p.y + ox * math.sin(a) + oy * math.cos(a);
      e.rz = p.rz + e.lrz;
      e.lastWorld = Offset(e.x, e.y);
    }
  }

  // ---- input ----
  /// Joystick, D-pad / arrow buttons and the arrow keys (or WASD) as one direction (x right, y down), at most 1 long.
  Offset axis() {
    var x = 0.0, y = 0.0;
    final st = stick;
    if (st != null) {
      final r = 50.0 * uiK, d = (st.at - st.start) / r, l = d.distance;
      if (l > 0.12) { final m = math.min(1.0, (l - 0.12) / 0.88); x += d.dx / l * m; y += d.dy / l * m; }
      final dir = strOf(settings['joystickDirections'], 'all');
      if (dir == 'horizontal') y = 0;
      if (dir == 'vertical') x = 0;
    }
    for (final a in virtualHeld) {
      if (a == 'dleft') x -= 1;
      if (a == 'dright') x += 1;
      if (a == 'dup') y -= 1;
      if (a == 'ddown') y += 1;
    }
    for (final b in buttons) {
      if (b.finger == null) continue;
      if (b.action == 'dleft') x -= 1;
      if (b.action == 'dright') x += 1;
      if (b.action == 'dup') y -= 1;
      if (b.action == 'ddown') y += 1;
    }
    bool k(List<LogicalKeyboardKey> l) => l.any(keys.contains);
    if (k([LogicalKeyboardKey.arrowRight, LogicalKeyboardKey.keyD])) x += 1;
    if (k([LogicalKeyboardKey.arrowLeft, LogicalKeyboardKey.keyA])) x -= 1;
    if (k([LogicalKeyboardKey.arrowDown, LogicalKeyboardKey.keyS])) y += 1;
    if (k([LogicalKeyboardKey.arrowUp, LogicalKeyboardKey.keyW])) y -= 1;
    final l = math.sqrt(x * x + y * y);
    return l > 1 ? Offset(x / l, y / l) : Offset(x, y);
  }
  bool isDown(String action) {
    if (virtualHeld.contains(action)) return true;
    if (buttons.any((b) => b.action == action && b.finger != null)) return true;
    if (action == 'jump') return keys.contains(LogicalKeyboardKey.space) || keys.contains(LogicalKeyboardKey.arrowUp) || keys.contains(LogicalKeyboardKey.keyW);
    if (action == 'action') return keys.contains(LogicalKeyboardKey.keyX) || keys.contains(LogicalKeyboardKey.keyF) || keys.contains(LogicalKeyboardKey.enter);
    return false;
  }
  bool hasButton(String action) => buttons.any((b) => b.action == action) || objects.any((o) => !o.dead && o.part<TouchKey>() != null && (o.part<TouchKey>()!.p['action'] ?? 'jump') == (action == 'action' ? 'fire' : action));
  /// The screen a HUD object belongs to: its own "Show when", or its nearest parent's (title, play, over, win, paused, always).
  String screenOfUi(GameObject o) { for (GameObject? q = o; q != null; q = q.parent) { if (q.showWhen != 'always') return q.showWhen; } return 'always'; }
  /// Is it on the screen being shown now?
  bool onScreen(GameObject o) {
    if (!o.ui) return state == 'play' || state == 'title';
    final w = screenOfUi(o);
    if (w == 'always') return true;
    if (paused) return w == 'paused';
    return w == state || (w == 'over' && state == 'win' && !objects.any((q) => q.ui && q.showWhen == 'win'));
  }
  /// Can one object see another (no solid object in between)?
  bool canSee(GameObject a, GameObject b) {
    for (final o in objects) {
      if (o == a || o == b || o.dead || o.body == null || !o.body!.solid) continue;
      final r = Rect.fromCenter(center: Offset(o.x, o.y), width: o.half.width * 2, height: o.half.height * 2);
      for (var i = 1; i < 12; i++) { final k = i / 12; if (r.contains(Offset(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k))) return false; }
    }
    return true;
  }
  /// The engine's on-screen controls: a joystick on one side, jump / fire buttons on the other (or a D-pad / arrows).
  void wantJoystick() { if (settings['joystick'] != true) { settings['joystick'] = true; layoutButtons(); } }
  void wantButton(String action) {
    final k = action == 'jump' ? 'jumpButton' : 'actionButton';
    if (settings[k] != true) { settings[k] = true; layoutButtons(); }
  }
  void layoutButtons() {
    buttons.clear();
    if (screen.isEmpty) return;
    final r = math.min(44.0, screen.width * 0.11), m = 24.0, bottom = screen.height - safe.bottom - m - r;
    double bx(double off) => screen.width - safe.right - m - r - off;
    final jump = settings['jumpButton'] == true;
    if (jump) buttons.add(TouchButton('jump', strOf(settings['jumpLabel'], 'JUMP'), Offset(bx(0), bottom), r));
    if (settings['actionButton'] == true) buttons.add(TouchButton('action', strOf(settings['actionLabel'], 'FIRE'), Offset(bx(jump ? r * 2.4 : 0), bottom - (jump ? r * 0.9 : 0)), r));
    final c = settings['controls'];
    double dx(double off) => safe.left + m + off;
    if (c == 'arrows') {
      buttons.add(TouchButton('dleft', '◀', Offset(dx(r), bottom), r));
      buttons.add(TouchButton('dright', '▶', Offset(dx(r * 3.4), bottom), r));
    } else if (c == 'dpad') {
      final cx = dx(r * 2.2), cy = bottom - r * 1.1, dr = r * 0.78;
      buttons.add(TouchButton('dup', '▲', Offset(cx, cy - dr * 1.9), dr));
      buttons.add(TouchButton('ddown', '▼', Offset(cx, cy + dr * 1.9), dr));
      buttons.add(TouchButton('dleft', '◀', Offset(cx - dr * 1.9, cy), dr));
      buttons.add(TouchButton('dright', '▶', Offset(cx + dr * 1.9, cy), dr));
    }
  }
  Size _laidOutFor = Size.zero;

  void pointerDown(int id, Offset at) {
    final p = Pointer(id, at, at, time);
    pointers[id] = p; downs.add(p);
    finger = at;
    if (state != 'play' || paused) { taps.add(Tap(at, toWorld(at), id)); return; }
    for (final b in buttons) {
      if (b.finger == null && (at - b.at).distance <= b.r * 1.25) { b.finger = id; p.role = 'button'; pressed.add(b.action); if (b.action == 'jump') pressed.add('btn:jump'); buzz(); return; }
    }
    if (tapTargets.any((o) => !o.dead && o.ui && hitsAt(o, at))) { p.role = 'ui'; taps.add(Tap(at, toWorld(at), id)); return; }
    final zone = strOf(settings['joystickZone'], 'left half');
    if (settings['joystick'] == true && stick == null && (zone == 'anywhere' || at.dx < screen.width / 2)) { p.role = 'stick'; stick = p; return; }
    taps.add(Tap(at, toWorld(at), id));
    pressed.add('tap');
    if (!hasButton('jump')) pressed.add('jump'); // (no jump button: a tap jumps)
  }
  void pointerMove(int id, Offset at) {
    final p = pointers[id];
    if (p == null) return;
    if (p.role == 'free') dragDelta += at - p.at;
    p.at = at; finger = at;
  }
  void pointerUp(int id) {
    final p = pointers.remove(id);
    if (p == null) return;
    ups.add(p);
    if (stick == p) stick = null;
    for (final b in buttons) { if (b.finger == id) b.finger = null; }
    if (pointers.isEmpty) finger = null;
    final d = p.at - p.start;
    if (p.role == 'free' && time - p.t0 < 0.6 && d.distance > 40) { // a swipe
      pressed.add(d.dx.abs() > d.dy.abs() ? (d.dx < 0 ? 'swipe:left' : 'swipe:right') : (d.dy < 0 ? 'swipe:up' : 'swipe:down'));
    }
  }

  /// One step of the game.
  void step(double dt) {
    if (screen != _laidOutFor) { _laidOutFor = screen; layoutButtons(); }
    for (final k in keys) {
      if (_keysBefore.contains(k)) continue;
      if (k == LogicalKeyboardKey.space || k == LogicalKeyboardKey.arrowUp || k == LogicalKeyboardKey.keyW) pressed.add('jump');
      if (k == LogicalKeyboardKey.keyX || k == LogicalKeyboardKey.keyF) pressed.add('action');
      if (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.keyA) pressed.add('swipe:left');
      if (k == LogicalKeyboardKey.arrowRight || k == LogicalKeyboardKey.keyD) pressed.add('swipe:right');
      if (k == LogicalKeyboardKey.arrowUp || k == LogicalKeyboardKey.keyW) pressed.add('swipe:up');
      if (k == LogicalKeyboardKey.arrowDown || k == LogicalKeyboardKey.keyS) pressed.add('swipe:down');
    }
    _keysBefore..clear()..addAll(keys);
    for (var i = 0; i < messages.length; i++) { messages[i] = (messages[i].$1, messages[i].$2 - dt); }
    messages.removeWhere((m) => m.$2 <= 0);
    for (final p in particles) { p.v += Offset(0, p.gravity * dt); p.p += p.v * dt; if (p.gravity == 0 && p.full < 1) p.v *= math.pow(0.05, dt).toDouble(); p.life -= dt; }
    particles.removeWhere((p) => p.life <= 0);
    for (final f in floats) { f.at += Offset(0, -50 * dt); f.life -= dt; }
    floats.removeWhere((f) => f.life <= 0);
    shake = math.max(0, shake - dt * 40);
    if (state != 'play' || paused) { // the title and end screens (and paused): only buttons work
      for (final o in [...objects]) { if (o.dead || !o.shown) continue; for (final c in o.parts) { if (c.always) c.update(o, dt, this); } }
      _endFrame(); return;
    }
    time += dt;
    for (final l in [..._later]) { if (l.$1 <= time) { _later.remove(l); l.$2(); } }
    _tweens(dt);
    for (final o in [...objects]) {
      if (o.dead) continue;
      if (o.invuln > 0) o.invuln -= dt;
      for (final c in o.parts) { if (o.dead || state != 'play') break; c.update(o, dt, this); }
    }
    _addBorn();
    _physics(dt);
    _syncHierarchy();
    // touches: each component that cares about something hears it when it starts touching its object
    final now = <String>{};
    for (final o in [...objects]) {
      if (o.dead || o.ui) continue;
      for (var ci = 0; ci < o.parts.length; ci++) {
        final c = o.parts[ci];
        if (!c.listens) continue;
        for (final other in [...objects]) {
          if (other == o || other.dead || o.dead || other.ui || !c.cares(other) || !overlap(o, other)) continue;
          final key = '${o.uid}:$ci:${other.uid}';
          now.add(key);
          if (!_contacts.contains(key)) c.touch(o, other, this);
        }
      }
    }
    _contacts..clear()..addAll(now);
    for (final o in objects) { o.part<Bounce>()?.collide(o, this); } // (balls bounce off solid objects: paddles, bricks, walls)
    for (final o in [...objects]) { if (o.dead) { for (final c in o.parts) { c.gone(o, this); } } }
    for (final o in objects) { if (!o.dead && o.parent != null && o.parent!.dead) o.destroy(); }
    objects.removeWhere((o) => o.dead);
    _addBorn();
    tapTargets.removeWhere((o) => o.dead);
    if (numOf(settings['winScore']) > 0 && numVar('score') >= numOf(settings['winScore'])) win();
    if (numOf(settings['timeLimit']) > 0 && state == 'play') {
      vars['time'] = math.max(0.0, numVar('time') - dt);
      if (numVar('time') <= 0) { message("Time's up!", 3); gameOver(); }
    }
    if (settings['saveProgress'] == true && (time * 2).floor() != ((time - dt) * 2).floor()) prefs?.setString('pocket.save.$saveKey', jsonEncode(vars));
    _endFrame();
  }
  void _endFrame() {
    taps.clear(); downs.clear(); ups.clear(); pressed.clear(); dragDelta = Offset.zero;
    notifyListeners();
  }
  void _tweens(double dt) {
    for (final t in [...tweens]) {
      if (t.o.dead) { tweens.remove(t); continue; }
      if (t.delay > 0) { t.delay -= dt; continue; }
      t.t += dt;
      var k = (t.t / t.seconds).clamp(0.0, 1.0);
      if (t.yoyo) k = k < 0.5 ? k * 2 : (1 - k) * 2;
      t.o.setField(t.field, t.from + (t.to - t.from) * ease(t.curve, k));
      if (t.t >= t.seconds) { tweens.remove(t); t.done?.call(); }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Components (the same names and settings as in Pocket Engine)
// ---------------------------------------------------------------------------------------------------------------

/// The component for a type, with its settings (and the engine's defaults); null: no native version yet.
Component? makeComponent(String type, Map<String, dynamic> p) => switch (type) {
      'move' => Move(p),
      'platformer' => Platformer(p),
      'controller2d' => Controller2D(p),
      'timeScore' => TimeScore(p),
      'spawner' => Spawner(p),
      'velocity' => Velocity(p),
      'rotate' => Rotate(p),
      'hazard' => Hazard(p),
      'destroyOffscreen' => DestroyOffscreen(p),
      'collectible' => Collectible(p),
      'tappable' => Tappable(p),
      'pulse' => Pulse(p),
      'lifetime' => Lifetime(p),
      'income' => Income(p),
      'upgrade' => Upgrade(p),
      'shooter' => Shooter(p),
      'projectile' => Projectile(p),
      'destructible' => Destructible(p),
      'bounce' => Bounce(p),
      'camera' => CameraRig(p),
      'cameraFollow' => CameraFollow(p),
      'cameraImpulse' => CameraImpulse(p),
      'cameraControls' => CameraControls(p),
      'patrol' => Patrol(p),
      'goal' => Goal(p),
      'spring' => Spring(p),
      'wrap' => Wrap(p),
      'chase' => Chase(p),
      'float' => FloatUpDown(p),
      'message' => MessageZone(p),
      'teleport' => Teleport(p),
      'unlock' => Unlock(p),
      'sound' => SoundZone(p),
      'draggable' => Draggable(p),
      'swipeMove' => SwipeLanes(p),
      'orbit' => Orbit(p),
      'checkpoint' => Checkpoint(p),
      'follow' => Follow(p),
      'wander' => Wander(p),
      'path' => PathMove(p),
      'turret' => Turret(p),
      'dropItem' => DropItem(p),
      'emitter' => Emitter(p),
      'particles' => Particles(p),
      'blink' => Blink(p),
      'forceZone' => ForceZone(p),
      'touchButton' => TouchKey(p),
      'button' => ButtonPart(p),
      'clickPopup' => ClickPopup(p),
      'comboClicker' => ComboClicker(p),
      'longPress' => LongPress(p),
      'doubleTap' => DoubleTap(p),
      'tapToggle' => TapToggle(p),
      'pressFeedback' => PressFeedback(p),
      'tapToSpawn' => TapToSpawn(p),
      'dragLaunch' => DragLaunch(p),
      'trigger' => TriggerZone(p),
      'timer' => TimerPart(p),
      'condition' => Condition(p),
      'waveSpawner' => WaveSpawner(p),
      'dayNight' => DayNight(p),
      'typewriter' => Typewriter(p),
      'health' => Health(p),
      'damager' => Damager(p),
      'hunger' => Need(p, 'hunger', const Color(0xFFFFA63D)),
      'thirst' => Need(p, 'thirst', const Color(0xFF4DB8FF)),
      'car' => Car(p),
      'savePoint' => SavePoint(p),
      'autoSave' => AutoSave(p),
      'saveManager' => SaveManager(p),
      'joint' => Joint(p),
      'navigator' => Navigator(p),
      'enemyAI' => EnemyAI(p),
      'loader' => Loader(p),
      'rules' => Rules(p),
      'uiPopup' => GamePopup(p, false),
      'uiSheet' => GamePopup(p, true),
      'uiPanel' => GamePanel(p),
      'uiLayout' => LayoutGroup(p),
      'uiScroll' => ScrollBox(p),
      'uiPopover' => Popover(p),
      'uiAppBar' => GameAppBar(p),
      'uiBottomNav' => GameBottomNav(p),
      'uiSideBar' => GameSideMenu(p),
      'uiBack' => BackButtonPart(p),
      'uiTabIndicator' => TabIndicator(p),
      'uiCrosshair' => Crosshair(p),
      'uiOffscreen' => OffscreenArrows(p),
      'uiScreenFX' => ScreenFX(p),
      'uiSaveSlots' => SaveSlots(p),
      'uiTutorial' => Tutorial(p),
      'uiShowIf' => ShowIf(p),
      'uiAnim' => UiAnim(p),
      'uiTooltip' => HudTooltip(p),
      'uiNotifications' => Notifications(p),
      'navItem' => NavItem(p),
      'drawer' => SideDrawer(p),
      'dataStat' => DataStat(p),
      'netSync' => NetSync(p),
      'pfLeaderboard' => LocalLeaderboard(p),
      'netRoomList' => RoomList(p),
      'netChat' => ChatBox(p),
      'tween' => TweenPart(p),
      'tweenSequence' => TweenSequencePart(p),
      'flipbook' => Flipbook(p),
      'animator' => Animator(p),
      'spriteSheet' => SpriteSheet(p),
      'cameraBrain' => CameraBrain(p),
      'cameraSequence' => CameraSequence(p),
      'cameraMixer' => CameraMixer(p),
      'cameraTargetGroup' => CameraTargetGroup(p),
      'cameraZone' => CameraZone(p),
      'cameraSwitcher' => CameraSwitcher(p),
      'gridMove' => GridMove(p),
      'gridEnemy' => GridEnemy(p),
      'gridUnit' => GridUnit(p),
      'squadControl' => SquadControl(p),
      'boardCell' => BoardCell(p),
      'turnAction' => TurnAction(p),
      'turnOpponent' => TurnOpponent(p),
      'inventoryItem' => InventoryItem(p),
      'craftingStation' => CraftingStation(p),
      'loot' => Loot(p),
      'resource' => ResourceNode(p),
      'npc' => Npc(p),
      'dialogue' => DialoguePart(p),
      'uiHotbar' => InventorySlots(p, true),
      'uiInventoryGrid' => InventorySlots(p, false),
      'uiEquipment' => EquipmentHud(p),
      'uiCrafting' => CraftingHud(p),
      'uiQuestLog' => QuestLogHud(p),
      'uiQuestJournal' => QuestJournalHud(p),
      'uiQuestTracker' => QuestTrackerHud(p),
      'triggers' => Triggers(p),
      'fsm' => StateMachine(p),
      'graph' => VisualScript(p),
      _ => null,
    };

/// Its speed, slowed by status effects (Health's freeze / slow) and hunger.
double slowed(GameObject e, double speed) => speed * numOf(e.data['slow'], 1);

/// Faces the way it moves: emoji flip, sprites and shapes mirror.
void faceX(GameObject e, double vx) {
  if (vx.abs() < 1e-3) return;
  if (e.shape?['type'] == 'emoji') { e.data['flipX'] = vx > 0; } else if (e.sprite != null) { e.sx = e.sx.abs() * (vx < 0 ? -1 : 1); }
}

/// Move: arrow keys / WASD, the joystick, and dragging on the screen (the object follows the finger's movement).
class Move extends Component {
  Move(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final speed = slowed(e, numOf(p['speed'], 260)), axes = '${p['axes'] ?? 'all'}', control = '${p['control'] ?? 'both'}';
    var a = control == 'drag' ? Offset.zero : g.axis();
    if (axes == 'vertical') a = Offset(0, a.dy);
    if (axes == 'horizontal') a = Offset(a.dx, 0);
    final b = e.body;
    if (b != null && b.isDynamic && g.gravity != 0 && b.gravityScale != 0) { b.vx = a.dx * speed; } // (with gravity: left and right only)
    else { e.x += a.dx * speed * dt; e.y += a.dy * speed * dt; }
    if (control == 'drag' || control == 'both') { // the finger's movement, a little faster (the engine's drag speed 1.2)
      final d = g.dragDelta / g.zoom * numOf(p['dragSpeed'], 1.2);
      e.x += axes == 'vertical' ? 0 : d.dx; e.y += axes == 'horizontal' ? 0 : d.dy;
    }
    if (strOf(p['face2D']) == 'flip') faceX(e, a.dx);
    if (strOf(p['face2D']) == 'rotate' && a.distance > 0.1) e.rz = math.atan2(a.dy, a.dx) / deg + 90;
    if (p['keepInView'] != false) {
      final v = g.viewBounds, h = e.half;
      e.x = e.x.clamp(v.left + h.width, math.max(v.left + h.width, v.right - h.width)).toDouble();
      e.y = e.y.clamp(v.top + h.height, math.max(v.top + h.height, v.bottom - h.height)).toDouble();
    }
  }
}

/// Platformer: run and jump with gravity (the joystick or arrows, and the jump button, a tap or space).
class Platformer extends Component {
  Platformer(this.p);
  final Map<String, dynamic> p;
  double coyote = 0;
  int jumps = 0;
  bool rising = false;
  @override
  void start(GameObject e, PocketGame g) {
    e.ensureBody('dynamic');
    if (g.gravity == 0) g.gravity = 1600;
    if (g.settings['controls'] == null) g.wantJoystick();
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final a = g.axis(), b = e.ensureBody('dynamic'), speed = slowed(e, numOf(p['speed'], 240)), accel = numOf(p['accel']);
    final ctl = b.grounded ? 1.0 : numOf(p['airControl'], 1).clamp(0.0, 1.0);
    final want = a.dx * speed;
    b.vx = accel > 0 ? b.vx + (want - b.vx).clamp(-accel * ctl * dt, accel * ctl * dt) : b.vx + (want - b.vx) * ctl;
    if (b.grounded) { coyote = 0.12; jumps = 0; } else { coyote -= dt; }
    if (g.pressed.contains('jump') && (coyote > 0 || (onOf(p['doubleJump']) && jumps < 2))) {
      b.vy = -numOf(p['jump'], 620); coyote = 0; jumps = jumps == 0 ? 1 : jumps + 1; rising = true;
      g.sfx('jump');
    }
    if (rising && p['variableJump'] != false && g.hasButton('jump') && !g.isDown('jump') && b.vy < 0) { b.vy *= 0.5; rising = false; } // let go early: a short hop
    if (b.vy >= 0) rising = false;
    if (p['faceDirection'] != false) faceX(e, a.dx);
    if (e.y > g.viewH + 600) g.hurt(e, strOf(p['onFall'], 'respawn'));
  }
}

/// Character Controller 2D: one of many ways to move (top-down, side to side, platformer, runner, flappy, car, spaceship, tank, tap to move, follow the finger).
class Controller2D extends Component {
  Controller2D(this.p) {
    final mode = strOf(p['mode'], 'topdown8');
    inner = switch (mode) {
      'topdown8' => Move({'speed': p['speed'] ?? 240, 'control': 'both', 'axes': 'all', 'keepInView': p['keepInView'] ?? true}),
      'sideToSide' => Move({'speed': p['speed'] ?? 240, 'control': 'both', 'axes': 'horizontal', 'keepInView': p['keepInView'] ?? true}),
      'platformer' => Platformer({'speed': p['speed'] ?? 240, 'jump': p['jump'] ?? 620, 'onFall': p['onFall'] ?? 'respawn'}),
      'grid' => GridStep({'tile': p['tile'] ?? 40}),
      _ => null,
    };
  }
  final Map<String, dynamic> p;
  Component? inner;
  double heading = 0, speed = 0;
  Offset? target;
  String get mode => strOf(p['mode'], 'topdown8');
  @override
  void start(GameObject e, PocketGame g) {
    final i = inner;
    if (i != null) { if (mode != 'grid') g.wantJoystick(); if (mode == 'platformer') g.wantButton('jump'); i.start(e, g); return; }
    final gravity = mode == 'runner' || mode == 'flappy';
    final b = e.ensureBody('dynamic');
    b.gravityScale = gravity ? 1 : 0;
    if (gravity && g.gravity == 0) g.gravity = 1600;
    heading = e.rz * deg;
    e.data['respawn'] ??= Offset(e.x, e.y);
    if (['topdown4', 'car', 'spaceship', 'tank'].contains(mode)) g.wantJoystick();
    if (mode == 'runner') g.wantButton('jump');
  }
  void _keep(GameObject e, PocketGame g) {
    if (p['keepInView'] == false) return;
    final v = g.viewBounds, h = e.half;
    e.x = e.x.clamp(v.left + h.width, math.max(v.left + h.width, v.right - h.width)).toDouble();
    e.y = e.y.clamp(v.top + h.height, math.max(v.top + h.height, v.bottom - h.height)).toDouble();
  }
  void _face(GameObject e, double vx, double vy) { if (onOf(p['faceMove']) && math.sqrt(vx * vx + vy * vy) > 5) e.rz = math.atan2(vy, vx) / deg; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final i = inner;
    if (i != null) { i.update(e, dt, g); return; }
    final a = g.axis(), b = e.ensureBody('dynamic'), sp = slowed(e, numOf(p['speed'], 240)), damp = math.max(0.0, 1 - numOf(p['friction'], 2) * dt);
    final turn = numOf(p['turn'], 200) * deg, accel = numOf(p['accel'], 600);
    switch (mode) {
      case 'topdown4':
        var ax = a.dx, ay = a.dy;
        if (ax.abs() > ay.abs()) { ay = 0; } else { ax = 0; }
        b.vx = ax.sign * (ax.abs() > 0.3 ? sp : 0); b.vy = ay.sign * (ay.abs() > 0.3 ? sp : 0);
        _face(e, b.vx, b.vy); _keep(e, g);
      case 'runner':
        b.vx = sp;
        if ((g.pressed.contains('tap') || g.pressed.contains('btn:jump') || g.pressed.contains('swipe:up') || g.pressed.contains('jump')) && b.grounded) { b.vy = -numOf(p['jump'], 620); g.sfx('jump'); }
        if (e.y > g.viewBounds.bottom + 300) g.hurt(e, strOf(p['onFall'], 'respawn'));
      case 'flappy':
        if (g.pressed.contains('tap') || g.pressed.contains('btn:jump') || g.pressed.contains('jump')) { b.vy = -numOf(p['jump'], 620) * 0.6; g.sfx('jump'); }
        e.rz = (b.vy / 12).clamp(-30.0, 70.0);
        if (p['keepInView'] != false && e.y < g.viewBounds.top) { e.y = g.viewBounds.top; b.vy = 0; }
        if (e.y > g.viewBounds.bottom + 300) g.hurt(e, strOf(p['onFall'], 'respawn'));
      case 'car':
        final thr = onOf(p['autoDrive']) ? 1.0 : math.max(0.0, -a.dy) + (a.dy > 0.3 ? -0.5 : 0);
        speed = (speed * damp + thr * accel * dt).clamp(-sp * 0.4, sp);
        heading += a.dx * turn * dt * (speed.abs() / (sp * 0.3)).clamp(0.0, 1.0) * (speed == 0 ? 1 : speed.sign);
        b.vx = math.cos(heading) * speed; b.vy = math.sin(heading) * speed; e.rz = heading / deg;
      case 'spaceship':
        heading += a.dx * turn * dt;
        final thrust = math.max(0.0, -a.dy) + (g.pointers.values.any((q) => q.role == 'free') ? 1 : 0);
        b.vx = b.vx * damp + math.cos(heading) * thrust * accel * dt; b.vy = b.vy * damp + math.sin(heading) * thrust * accel * dt;
        final v = math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (v > sp) { b.vx *= sp / v; b.vy *= sp / v; }
        e.rz = heading / deg;
        if (p['keepInView'] != false) { final vb = g.viewBounds; if (e.x < vb.left) { e.x = vb.right; } else if (e.x > vb.right) { e.x = vb.left; } if (e.y < vb.top) { e.y = vb.bottom; } else if (e.y > vb.bottom) { e.y = vb.top; } }
      case 'tank':
        heading += a.dx * turn * dt;
        final fwd = -a.dy * sp;
        b.vx = math.cos(heading) * fwd; b.vy = math.sin(heading) * fwd; e.rz = heading / deg;
      case 'tapToMove':
        final t = g.taps.isNotEmpty ? g.taps.first.world : g.pointers.values.where((q) => q.role == 'free').map((q) => g.toWorld(q.at)).firstOrNull;
        if (t != null) target = t;
        final tg = target;
        if (tg != null) {
          final dx = tg.dx - e.x, dy = tg.dy - e.y, d = math.sqrt(dx * dx + dy * dy);
          if (d < 4) { b.vx = 0; b.vy = 0; target = null; } else { final v = math.min(sp, d / math.max(dt, 1e-3)); b.vx = dx / d * v; b.vy = dy / d * v; _face(e, dx, dy); }
        }
      case 'followFinger':
        final f = g.pointers.values.where((q) => q.role == 'free').firstOrNull;
        if (f != null) { final w = g.toWorld(f.at), k = math.min(1.0, dt * (sp / 20)); b.vx = (w.dx - e.x) * k / math.max(dt, 1e-3); b.vy = (w.dy - e.y) * k / math.max(dt, 1e-3); } else { b.vx = 0; b.vy = 0; }
        _keep(e, g);
    }
  }
}

/// Grid steps: moves one tile at a time (arrow keys, joystick, or swipes).
class GridStep extends Component {
  GridStep(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  Offset? to;
  @override
  void start(GameObject e, PocketGame g) { final s = numOf(p['tile'], 40); e.x = (e.x / s).round() * s; e.y = (e.y / s).round() * s; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final s = numOf(p['tile'], 40), step = numOf(p['stepTime'], 0.14);
    final dest = to;
    if (dest != null) {
      t += dt;
      final k = (t / step).clamp(0.0, 1.0), from = e.data['from'] as Offset;
      e.x = from.dx + (dest.dx - from.dx) * k; e.y = from.dy + (dest.dy - from.dy) * k;
      if (k >= 1) to = null;
      return;
    }
    var a = g.axis();
    if (g.pressed.contains('swipe:left')) a = const Offset(-1, 0);
    if (g.pressed.contains('swipe:right')) a = const Offset(1, 0);
    if (g.pressed.contains('swipe:up')) a = const Offset(0, -1);
    if (g.pressed.contains('swipe:down')) a = const Offset(0, 1);
    if (a.distance < 0.4) return;
    final dx = a.dx.abs() > a.dy.abs() ? a.dx.sign : 0.0, dy = dx == 0 ? a.dy.sign : 0.0;
    final nx = e.x + dx * s, ny = e.y + dy * s;
    if (g.objects.any((o) => o != e && !o.dead && o.body != null && o.body!.solid && (o.x - nx).abs() < s * 0.5 + o.half.width - 2 && (o.y - ny).abs() < s * 0.5 + o.half.height - 2)) return; // a wall
    e.data['from'] = Offset(e.x, e.y); to = Offset(nx, ny); t = 0;
    faceX(e, dx);
  }
}

/// Score over time: points every second while playing.
class TimeScore extends Component {
  TimeScore(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) => g.addVar('score', numOf(p['rate'], 10) * dt);
}

/// Spawner: copies of a template object every so often, at random spots in a range; faster as time goes on (ramp).
class Spawner extends Component {
  Spawner(this.p);
  final Map<String, dynamic> p;
  double t = 0.5;
  final List<GameObject> alive = [];
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final mul = 1 + numOf(p['ramp'], 0.1) * (g.time / 10);
    t -= dt * mul;
    if (t > 0) return;
    t = math.max(0.05, pick(p['every'], 1));
    alive.removeWhere((o) => o.dead);
    if (alive.length >= numOf(p['max'], 60)) return;
    final rel = p['relative'] == true, snap = numOf(p['snap']);
    double sn(double v) => snap > 0 ? (v / snap).round() * snap : v;
    final x = (rel ? e.x : 0) + sn(pick(p['x'] ?? const [20, 380])), y = (rel ? e.y : 0) + pick(p['y'] ?? -40);
    final clear = numOf(p['clear']);
    if (clear > 0 && g.objects.any((o) => !o.dead && o.data['spawned'] == true && (o.x - x).abs() < clear && (o.y - y).abs() < clear)) return;
    final c = g.spawn('${p['template'] ?? ''}', x, y);
    if (c != null) { c.data['speedMul'] = math.min(3.0, mul); alive.add(c); }
  }
}

/// Velocity: a steady speed (a range gives each copy its own).
class Velocity extends Component {
  Velocity(this.p);
  final Map<String, dynamic> p;
  Offset v = Offset.zero;
  @override
  void start(GameObject e, PocketGame g) { final m = numOf(e.data['speedMul'], 1); v = Offset(pick(p['vx']) * m, pick(p['vy'] ?? 200) * m); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final b = e.body;
    if (b != null && b.isDynamic) { b.vx = v.dx; if (g.gravity == 0 || b.gravityScale == 0) b.vy = v.dy; return; }
    e.x += v.dx * dt; e.y += v.dy * dt;
  }
}

/// Rotate: spins.
class Rotate extends Component {
  Rotate(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) { if ('${p['axis'] ?? 'z'}' == 'z') e.rz += numOf(p['speed'], 90) * dt; }
}

/// Hazard: hurts the player on touch (game over, lose a life, or back to the start).
class Hazard extends Component {
  Hazard(this.p);
  final Map<String, dynamic> p;
  @override
  String get wants => '${p['tag'] ?? 'player'}';
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (other.dead || g.state != 'play' || other.invuln > 0 || e.data['blinkOff'] == true) return;
    final hb = other.part<Health>();
    if (hb != null) { hb.damage(other, g, 1, from: e); if (p['destroySelf'] == true) e.destroy(); return; }
    if (p['destroySelf'] == true) e.destroy();
    g.hurt(other, '${p['action'] ?? 'gameover'}');
  }
}

/// Destroy off-screen: removed once it leaves the view.
class DestroyOffscreen extends Component {
  DestroyOffscreen(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final v = g.viewBounds, m = numOf(p['margin'], 120);
    if (e.x < v.left - m || e.x > v.right + m || e.y < v.top - m * 4 || e.y > v.bottom + m) e.destroy();
  }
}

/// Collectible: adds to the score when the player touches it.
class Collectible extends Component {
  Collectible(this.p);
  final Map<String, dynamic> p;
  @override
  String get wants => '${p['tag'] ?? 'player'}';
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (e.dead) return;
    g.addVar('${p['var'] ?? 'score'}', numOf(p['score'], 10));
    g.sfx(strOf(p['sound'], 'coin'));
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFFD23D), 14, 0.8);
    e.destroy();
  }
}

/// Tap Target: tap it to score (it pops, or bounces when it stays).
class Tappable extends Component {
  Tappable(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    for (final t in g.taps) {
      if (e.dead || !g.hits(e, t)) continue;
      final bonus = '${p['bonusVar'] ?? ''}'.isEmpty ? 0.0 : g.numVar('${p['bonusVar']}');
      g.addVar('${p['var'] ?? 'score'}', numOf(p['points'], 10) + bonus);
      g.sfx(strOf(p['sound'], 'coin'));
      if (!e.ui) g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFFD23D), 14, 0.8);
      if (p['destroy'] != false) { e.destroy(); } else { e.data['pop'] = 0.2; }
    }
  }
}

/// Pulse: grows and shrinks.
class Pulse extends Component {
  Pulse(this.p);
  final Map<String, dynamic> p;
  double t = 0, bx = 1, by = 1;
  @override
  void start(GameObject e, PocketGame g) { bx = e.sx; by = e.sy; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    t += dt;
    final k = 1 + math.sin(t / math.max(0.1, numOf(p['period'], 0.8)) * math.pi * 2) * numOf(p['amount'], 0.15);
    e.sx = bx * k; e.sy = by * k;
  }
}

/// Lifetime: removed after some seconds.
class Lifetime extends Component {
  Lifetime(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  void update(GameObject e, double dt, PocketGame g) { if ((t += dt) > numOf(p['seconds'], 3)) e.destroy(); }
}

/// Income: adds one variable to another every second (idle "per second" earnings).
class Income extends Component {
  Income(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) { final r = g.numVar('${p['rateVar'] ?? 'perSecond'}'); if (r != 0) g.addVar('${p['var'] ?? 'score'}', r * dt); }
}

/// Upgrade Button: tap to buy; spends a variable to raise another; the price grows. Its text can show {cost}.
class Upgrade extends Component {
  Upgrade(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) { e.data['cost'] = numOf(p['cost'], 10); e.data['owned'] = 0; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    for (final t in g.taps) {
      if (!g.hits(e, t)) continue;
      final cost = numOf(e.data['cost']), costVar = '${p['costVar'] ?? 'score'}', have = g.numVar(costVar);
      if (have < cost) { g.buzz(); g.message('Need ${formatNumber(cost - have)} more', 1); continue; }
      g.addVar(costVar, -cost);
      g.addVar('${p['addVar'] ?? 'perSecond'}', numOf(p['amount'], 1));
      e.data['owned'] = numOf(e.data['owned']) + 1;
      e.data['cost'] = (cost * numOf(p['growth'], 1.15)).ceilToDouble();
      e.data['pop'] = 0.18;
      g.sfx('power');
    }
  }
}

/// Shooter: fires copies of a template (automatically, on a tap, or with the fire button).
class Shooter extends Component {
  Shooter(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  void start(GameObject e, PocketGame g) { if (strOf(p['trigger']) == 'action button') g.wantButton('action'); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    t -= dt;
    if (t > 0) return;
    final trigger = '${p['trigger'] ?? 'auto'}';
    if (trigger == 'tap' && g.taps.isEmpty) return;
    if (trigger == 'action button' && !g.isDown('action')) return;
    t = numOf(p['every'], 0.25);
    g.spawn('${p['template'] ?? ''}', e.x, e.y, e.rz);
  }
}

/// Projectile: flies straight the way it faces, for a while.
class Projectile extends Component {
  Projectile(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final a = e.rz * math.pi / 180, sp = numOf(p['speed'], 650);
    e.x += math.sin(a) * sp * dt; e.y -= math.cos(a) * sp * dt;
    if ((t += dt) > numOf(p['life'], 2)) e.destroy();
  }
}

/// Breakable: takes hits from objects with a tag (bullets, a ball) and breaks when its hits run out.
class Destructible extends Component {
  Destructible(this.p);
  final Map<String, dynamic> p;
  late double hp;
  @override
  String get wants => '${p['hitBy'] ?? 'bullet'}';
  @override
  void start(GameObject e, PocketGame g) { hp = numOf(p['hp'], 3); }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (e.dead || numOf(e.data['hitT']) > g.time) return;
    if (p['removeHitter'] != false) other.destroy();
    hp--; e.data['hitT'] = g.time + 0.15; e.data['flash'] = 0.12;
    if (hp > 0) { g.sfx('hit'); return; }
    g.addVar('score', numOf(p['points'], 10));
    g.shake = math.max(g.shake, 6);
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFF8A3D), 26, 1.1);
    e.destroy();
  }
}

/// Bouncing Ball: a steady speed, bouncing off the screen edges and solid objects (paddles, bricks); off the bottom loses a life.
class Bounce extends Component {
  Bounce(this.p);
  final Map<String, dynamic> p;
  Offset v = Offset.zero, home = Offset.zero;
  double get speed => numOf(p['speed'], 340);
  void launch(GameObject e) { final a = -0.6 + _rng.nextDouble() * 1.2; v = Offset(math.sin(a) * speed, -math.cos(a) * speed); }
  @override
  void start(GameObject e, PocketGame g) { home = Offset(e.x, e.y); launch(e); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    e.x += v.dx * dt; e.y += v.dy * dt;
    final vb = g.viewBounds, r = e.half.width;
    if (e.x < vb.left + r) { e.x = vb.left + r; v = Offset(v.dx.abs(), v.dy); }
    if (e.x > vb.right - r) { e.x = vb.right - r; v = Offset(-v.dx.abs(), v.dy); }
    if (e.y < vb.top + r) { e.y = vb.top + r; v = Offset(v.dx, v.dy.abs()); }
    if (e.y > vb.bottom - r) {
      if ('${p['bottom'] ?? 'lose a life'}' == 'bounce') { e.y = vb.bottom - r; v = Offset(v.dx, -v.dy.abs()); }
      else {
        final lives = g.vars.containsKey('lives') ? g.numVar('lives') : 1;
        g.buzz(true);
        if (lives <= 1) { g.setVar('lives', 0); g.gameOver(); return; }
        g.addVar('lives', -1); e.x = home.dx; e.y = home.dy; launch(e); return;
      }
    }
  }
  /// Push out of solid objects it overlaps and turn around (along the shallower side).
  void collide(GameObject e, PocketGame g) {
    final r = e.half.width;
    for (final o in g.objects) {
      if (o == e || o.dead || o.body == null || !o.body!.solid || !PocketGame.overlap(e, o, 0)) continue;
      final h = o.half, dx = e.x - o.x, dy = e.y - o.y, px = h.width + r - dx.abs(), py = h.height + r - dy.abs();
      if (px < py) { e.x += dx < 0 ? -px : px; v = Offset(dx < 0 ? -v.dx.abs() : v.dx.abs(), v.dy); }
      else {
        e.y += dy < 0 ? -py : py; v = Offset(v.dx, dy < 0 ? -v.dy.abs() : v.dy.abs());
        if (o.part<Move>() != null) { final off = (dx / (h.width + r)).clamp(-1.0, 1.0); v = Offset(off * speed * 0.75, v.dy); } // (a paddle: where it hits steers the ball)
      }
    }
    if (v.dy.abs() < speed * 0.3) v = Offset(v.dx, (v.dy < 0 ? -1 : 1) * speed * 0.3); // never stuck going flat
    final l = v.distance; if (l > 0) v = v / l * speed;
  }
}

// ---- cameras ----

/// Camera: fixed, or following its target (follow, side scroller, top down) smoothly, with an offset and a zoom.
/// Several cameras: the one switched to ("switch camera" action, a Camera Zone or Switcher) drives the view.
class CameraRig extends Component {
  CameraRig(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) {
    g.on((m) { if (m == 'camera:${e.name}' || m == 'camera:${e.id}') g.activeCamera = e; });
    if (g.activeCamera == null || numOf(p['priority']) > numOf(g.activeCamera!.data['priority'])) g.activeCamera = e;
    e.data['priority'] = numOf(p['priority']);
    if (g.activeCamera == e) { g.camZoom = numOf(p['zoom'], 1).clamp(0.1, 10).toDouble(); _aim(e, g, 1); }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (g.activeCamera != null && g.activeCamera != e) return;
    final z = numOf(e.data['camZoom'], numOf(p['zoom'], 1)).clamp(0.1, 10).toDouble();
    g.camZoom += (z - g.camZoom) * math.min(1.0, dt * 8);
    _aim(e, g, 1 - math.exp(-numOf(p['smooth'], 6) * dt));
  }
  void _aim(GameObject e, PocketGame g, double k) {
    final mode = '${p['mode'] ?? 'follow'}';
    if (mode == 'fixed') { g.camX += (e.x - g.camX) * k; g.camY += (e.y - g.camY) * k; return; }
    final tag = '${p['target'] ?? 'player'}';
    GameObject? t;
    for (final o in g.objects) { if (!o.dead && o.has(tag)) { t = o; break; } }
    if (t == null) return;
    final wantX = t.x + numOf(p['ox']), wantY = mode == 'side scroller' ? g.viewH / 2 + numOf(p['oy']) : t.y + numOf(p['oy']);
    g.camX += (wantX - g.camX) * k; g.camY += (wantY - g.camY) * k;
  }
}

/// Camera follow: the view follows this object smoothly (both ways, or only across / up and down).
class CameraFollow extends Component {
  CameraFollow(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) { final ax = strOf(p['axes'], 'both'); if (ax != 'y') g.camX = e.x + numOf(p['ox']); if (ax != 'x') g.camY = e.y + numOf(p['oy']); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final ax = strOf(p['axes'], 'both'), k = 1 - math.exp(-numOf(p['smooth'], 6) * dt);
    if (ax != 'y') g.camX += (e.x + numOf(p['ox']) - g.camX) * k;
    if (ax != 'x') g.camY += (e.y + numOf(p['oy']) - g.camY) * k;
  }
}

/// Camera Impulse: shakes the view when it starts, lands, hits something, every few seconds, on a message or when destroyed.
class CameraImpulse extends Component with Toucher {
  CameraImpulse(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  bool wasGround = true;
  String get when => strOf(p['when'], 'it hits something');
  void fire(GameObject e, PocketGame g) {
    final r = numOf(p['range']), d = (Offset(e.x, e.y) - Offset(g.camX, g.camY)).distance;
    final a = numOf(p['strength'], 10) * (r > 0 ? (1 - d / r).clamp(0.0, 1.0) : 1);
    if (a <= 0.2) return;
    g.shake = math.max(g.shake, a);
    if (p['vibrate'] != false) g.buzz(a > 12);
  }
  @override
  bool cares(GameObject other) => when == 'it hits something' && other.body != null && !other.body!.sensor;
  @override
  void start(GameObject e, PocketGame g) {
    if (when == 'it starts') fire(e, g);
    if (when == 'a message arrives') g.on((m) { if (!e.dead && m == strOf(p['message'], 'boom')) fire(e, g); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (when == 'every few seconds' && (t += dt) >= math.max(0.1, numOf(p['every'], 3))) { t = 0; fire(e, g); }
    final b = e.body;
    if (when == 'it lands' && b != null) { if (b.landed > 0 || (b.grounded && !wasGround)) { if ((b.landed > 0 ? b.landed : b.vy.abs()) >= numOf(p['minSpeed'])) fire(e, g); } wasGround = b.grounded; }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { final b = e.body, sp = b == null ? 0.0 : math.sqrt(b.vx * b.vx + b.vy * b.vy); if (sp >= numOf(p['minSpeed'])) fire(e, g); }
  @override
  void gone(GameObject e, PocketGame g) { if (when == 'it is destroyed') fire(e, g); }
}

/// Camera Controls: drag to pan the view, pinch to zoom, double-tap to go back.
class CameraControls extends Component {
  CameraControls(this.p);
  final Map<String, dynamic> p;
  Offset home = Offset.zero, v = Offset.zero;
  double lastPinch = 0, lastTap = -9, zoom = 1;
  @override
  void start(GameObject e, PocketGame g) { home = Offset(g.camX, g.camY); zoom = g.camZoom; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final free = g.pointers.values.where((q) => q.role == 'free').toList();
    final lo = math.min(numOf(p['minZoom'], 0.5), numOf(p['maxZoom'], 3)), hi = math.max(numOf(p['minZoom'], 0.5), numOf(p['maxZoom'], 3));
    if (p['zoom'] != false && free.length >= 2) {
      final d = (free[0].at - free[1].at).distance;
      if (lastPinch > 0) zoom = (zoom * d / lastPinch).clamp(lo, hi);
      lastPinch = d; v = Offset.zero; g.camZoom = zoom; return;
    }
    lastPinch = 0;
    if (p['reset'] != false) {
      for (final _ in g.taps) { if (g.time - lastTap < 0.35) { g.camX = home.dx; g.camY = home.dy; zoom = 1; g.camZoom = 1; v = Offset.zero; lastTap = -9; } else { lastTap = g.time; } }
    }
    if (p['pan'] != false && free.length == 1) { v = -g.dragDelta / g.zoom / math.max(dt, 1e-3); g.camX += v.dx * dt; g.camY += v.dy * dt; }
    else if (p['glide'] != false && v != Offset.zero) { v *= math.exp(-5 * dt); if (v.distance < 2) v = Offset.zero; g.camX += v.dx * dt; g.camY += v.dy * dt; }
    final l = numOf(p['limit']);
    if (l > 0) { g.camX = g.camX.clamp(home.dx - l, home.dx + l); g.camY = g.camY.clamp(home.dy - l, home.dy + l); }
    g.camZoom = zoom;
  }
}

// ---- movement ----

/// Patrol: back and forth by an amount, easing at the ends.
class Patrol extends Component {
  Patrol(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  Offset o = Offset.zero;
  @override
  void start(GameObject e, PocketGame g) => o = Offset(e.x, e.y);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    t += dt;
    final k = 0.5 - 0.5 * math.cos(t / math.max(0.1, numOf(p['duration'], 2)) * math.pi);
    e.x = o.dx + numOf(p['dx'], 120) * k; e.y = o.dy + numOf(p['dy']) * k;
  }
}

/// Goal: the player touching it wins the level.
class Goal extends Component {
  Goal(this.p);
  final Map<String, dynamic> p;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { g.burst(e.x, e.y, const Color(0xFF5DFF8A), 40, 1.2); g.win(); }
}

/// Spring: bounces the player up.
class Spring extends Component {
  Spring(this.p);
  final Map<String, dynamic> p;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { final b = other.body; if (b == null) return; b.vy = -numOf(p['power'], 900); g.sfx('jump'); e.data['pop'] = 0.2; }
}

/// Screen wrap: leaving one edge brings it back on the other.
class Wrap extends Component {
  Wrap(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final v = g.viewBounds;
    if (e.x < v.left) { e.x += v.width; } else if (e.x > v.right) { e.x -= v.width; }
    if (e.y < v.top) { e.y += v.height; } else if (e.y > v.bottom) { e.y -= v.height; }
  }
}

/// Chase: moves toward the nearest object with a tag, when it's in range.
class Chase extends Component {
  Chase(this.p);
  final Map<String, dynamic> p;
  GameObject? target;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (target == null || target!.dead) target = g.findAll(strOf(p['tag'], 'player')).where((o) => o != e).firstOrNull;
    final t = target;
    if (t == null) return;
    final dx = t.x - e.x, dy = t.y - e.y, d = math.sqrt(dx * dx + dy * dy), range = numOf(p['range'], 320);
    if (d < 1e-3 || (range > 0 && d > range)) return;
    final k = math.min(d, slowed(e, numOf(p['speed'], 110)) * dt) / d;
    e.x += dx * k; e.y += dy * k;
    faceX(e, dx);
  }
}

/// Float: bobs up and down.
class FloatUpDown extends Component {
  FloatUpDown(this.p);
  final Map<String, dynamic> p;
  double t = _rng.nextDouble() * 10, base = 0;
  @override
  void start(GameObject e, PocketGame g) => base = e.y;
  @override
  void update(GameObject e, double dt, PocketGame g) { t += dt; e.y = base - math.sin(t / math.max(0.1, numOf(p['period'], 1.6)) * math.pi * 2) * numOf(p['amount'], 8); }
}

/// Message: shows a message when the player touches it (once, or every time).
class MessageZone extends Component {
  MessageZone(this.p);
  final Map<String, dynamic> p;
  bool shown = false;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (p['once'] != false && shown) return;
    shown = true; g.message(strOf(p['text'], 'Hello there!'), numOf(p['seconds'], 3)); g.sfx('click');
  }
}

/// Teleport: sends the player to another object.
class Teleport extends Component {
  Teleport(this.p);
  final Map<String, dynamic> p;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (numOf(other.data['tpUntil']) > g.time) return;
    final dest = g.find(strOf(p['target']));
    if (dest == null || dest == e) return;
    const purple = Color(0xFFA77BFF);
    g.burst(other.x, other.y, purple, 16);
    other.x = dest.x; other.y = dest.y; other.body?..vx = 0..vy = 0;
    other.data['tpUntil'] = g.time + 0.8;
    g.burst(dest.x, dest.y, purple, 16);
    g.sfx('power');
  }
}

/// Unlock: disappears (a door, a gate) once a variable reaches an amount.
class Unlock extends Component {
  Unlock(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (g.numVar(strOf(p['var'], 'keys')) < numOf(p['amount'], 1)) return;
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? Colors.white, 30, 1.2);
    if (strOf(p['text']).isNotEmpty) g.message(strOf(p['text']), 2);
    g.sfx('power');
    e.destroy();
  }
}

/// Sound: plays a sound when it starts or when touched.
class SoundZone extends Component {
  SoundZone(this.p);
  final Map<String, dynamic> p;
  @override
  String? get wants => strOf(p['when'], 'touched') == 'touched' ? strOf(p['tag'], 'player') : null;
  @override
  void start(GameObject e, PocketGame g) { if (p['when'] == 'start') g.sfx(strOf(p['sound'], 'power')); }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) => g.sfx(strOf(p['sound'], 'power'));
}

/// Draggable: pick it up with a finger and put it down (snapping to a grid).
class Draggable extends Component {
  Draggable(this.p);
  final Map<String, dynamic> p;
  int? grab;
  Offset off = Offset.zero, base = const Offset(1, 1);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (grab == null) {
      final d = g.downOn(e);
      if (d == null) return;
      final w = g.toWorld(d.at);
      grab = d.id; off = Offset(e.x - w.dx, e.y - w.dy); base = Offset(e.sx, e.sy);
      d.role = 'drag';
      if (p['lift'] != false) { e.sx *= 1.12; e.sy *= 1.12; }
      g.buzz();
    }
    final ptr = g.pointers[grab];
    if (ptr == null) {
      final s = numOf(p['snap']);
      if (s > 0) { e.x = (e.x / s).round() * s; e.y = (e.y / s).round() * s; }
      e.sx = base.dx; e.sy = base.dy; grab = null;
      return;
    }
    final w = g.toWorld(ptr.at);
    e.x = w.dx + off.dx; e.y = w.dy + off.dy;
    e.body?..vx = 0..vy = 0;
  }
}

/// Swipe Lanes: swipe left and right to change lanes (and up to jump).
class SwipeLanes extends Component {
  SwipeLanes(this.p);
  final Map<String, dynamic> p;
  int lane = 0;
  double home = 0;
  @override
  void start(GameObject e, PocketGame g) {
    home = e.x;
    final b = e.ensureBody('dynamic'), jump = numOf(p['jump']);
    if (jump <= 0) b.gravityScale = 0;
    if (jump > 0 && g.gravity == 0) g.gravity = 1600;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final max = ((numOf(p['lanes'], 3) - 1) / 2).floor();
    if (g.pressed.contains('swipe:left')) lane = math.max(-max, lane - 1);
    if (g.pressed.contains('swipe:right')) lane = math.min(max, lane + 1);
    final jump = numOf(p['jump']), b = e.body;
    if (jump > 0 && b != null && b.grounded && g.pressed.contains('swipe:up')) { b.vy = -jump; g.sfx('jump'); }
    e.x += (home + lane * numOf(p['distance'], 110) - e.x) * math.min(1.0, dt * 14);
  }
}

/// Orbit: circles around where it started.
class Orbit extends Component {
  Orbit(this.p);
  final Map<String, dynamic> p;
  Offset c = Offset.zero;
  double a = 0;
  @override
  void start(GameObject e, PocketGame g) => c = Offset(e.x, e.y);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    a += numOf(p['speed'], 90) * dt * deg;
    e.x = c.dx + math.cos(a) * numOf(p['radius'], 80); e.y = c.dy + math.sin(a) * numOf(p['radius'], 80);
  }
}

/// Checkpoint: the player comes back here after a fall or a hit.
class Checkpoint extends Component {
  Checkpoint(this.p);
  final Map<String, dynamic> p;
  bool hit = false;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (hit) return;
    hit = true;
    other.data['respawn'] = Offset(e.x, e.y - 20); other.data['respawnOnHit'] = true;
    e.shape?['fill'] = '#5dff8a';
    if (strOf(p['text']).isNotEmpty) g.message(strOf(p['text']), 1.5);
    g.sfx('power');
    g.burst(e.x, e.y, const Color(0xFF5DFF8A), 18);
  }
}

/// Follow: keeps near another object (a pet, a sidekick).
class Follow extends Component {
  Follow(this.p);
  final Map<String, dynamic> p;
  GameObject? t;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (t == null || t!.dead) t = g.find(strOf(p['target'], 'player'));
    final o = t;
    if (o == null || o == e) return;
    final dx = o.x - e.x, dy = o.y - e.y, d = math.sqrt(dx * dx + dy * dy), dist = numOf(p['distance'], 60);
    if (d <= dist) return;
    final k = math.min(d - dist, slowed(e, numOf(p['speed'], 200)) * dt) / d;
    e.x += dx * k; e.y += dy * k;
    faceX(e, dx);
  }
}

/// Wander: walks about at random near where it started.
class Wander extends Component {
  Wander(this.p);
  final Map<String, dynamic> p;
  Offset home = Offset.zero;
  double? dir;
  double t = 0;
  bool started = false;
  @override
  void start(GameObject e, PocketGame g) => home = Offset(e.x, e.y);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if ((t -= dt) <= 0) {
      t = rand(1, 3);
      final away = (Offset(e.x, e.y) - home).distance > numOf(p['radius'], 120);
      dir = _rng.nextDouble() < 0.25 && !away && started ? null : away ? math.atan2(home.dy - e.y, home.dx - e.x) : rand(0, math.pi * 2);
      started = true;
    }
    final d = dir;
    if (d == null) return;
    final sp = slowed(e, numOf(p['speed'], 60));
    e.x += math.cos(d) * sp * dt; e.y += math.sin(d) * sp * dt;
    faceX(e, math.cos(d));
  }
}

/// Path: walks through points ("0,0; 150,0; 150,-100"), looping or back and forth.
class PathMove extends Component {
  PathMove(this.p);
  final Map<String, dynamic> p;
  List<Offset> pts = [];
  int i = 1, step = 1;
  Offset home = Offset.zero;
  @override
  void start(GameObject e, PocketGame g) {
    home = Offset(e.x, e.y);
    pts = [for (final q in strOf(p['points'], '0,0; 150,0; 150,-100; 0,-100').split(';')) if (q.split(',').length >= 2) Offset(numOf(q.split(',')[0].trim()), numOf(q.split(',')[1].trim()))];
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (pts.length < 2) return;
    final t = home + pts[i], dx = t.dx - e.x, dy = t.dy - e.y, d = math.sqrt(dx * dx + dy * dy), mv = slowed(e, numOf(p['speed'], 120)) * dt;
    if (d <= mv) {
      e.x = t.dx; e.y = t.dy;
      if (p['loop'] != false) { i = (i + 1) % pts.length; } else { if (i + step < 0 || i + step >= pts.length) step = -step; i += step; }
      return;
    }
    e.x += dx / d * mv; e.y += dy / d * mv;
    faceX(e, dx);
  }
}

/// Turret: turns toward the nearest target in range and fires a template at it.
class Turret extends Component {
  Turret(this.p);
  final Map<String, dynamic> p;
  double t = 1;
  GameObject? target;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (target == null || target!.dead) target = g.findAll(strOf(p['tag'], 'player')).where((o) => o != e).firstOrNull;
    final o = target;
    if (o == null) return;
    final dx = o.x - e.x, dy = o.y - e.y;
    if (math.sqrt(dx * dx + dy * dy) > numOf(p['range'], 300)) return;
    e.rz = math.atan2(dx, -dy) / deg;
    if ((t -= dt) > 0 || strOf(p['template']).isEmpty) return;
    t = numOf(p['every'], 1.2);
    g.spawn(strOf(p['template']), e.x + math.sin(e.rz * deg) * 24, e.y - math.cos(e.rz * deg) * 24, e.rz);
  }
}

/// Drop Item: leaves a template behind when it's destroyed (loot, coins), by chance.
class DropItem extends Component {
  DropItem(this.p);
  final Map<String, dynamic> p;
  @override
  void gone(GameObject e, PocketGame g) { if (strOf(p['template']).isNotEmpty && g.state == 'play' && _rng.nextDouble() < numOf(p['chance'], 1)) g.spawn(strOf(p['template']), e.x, e.y); }
}

/// Particle Emitter: a steady stream of sparks.
class Emitter extends Component {
  Emitter(this.p);
  final Map<String, dynamic> p;
  double acc = 0;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    acc += numOf(p['rate'], 20) * dt;
    final n = acc.floor();
    if (n > 0) { acc -= n; g.burst(e.x, e.y, colorOf(p['color']) ?? const Color(0xFFFFB74D), n, numOf(p['spread'], 0.5)); }
  }
}

/// Particle System: fire, smoke, rain, snow, sparkles, confetti, magic or bubbles.
class Particles extends Component {
  Particles(this.p);
  final Map<String, dynamic> p;
  static const presets = <String, Map<String, Object>>{
    'fire': {'rate': 40, 'colors': ['#ffd54f', '#ff9800', '#f44336'], 'speed': 60, 'spread': 0.6, 'dir': -90, 'life': 0.8, 'size': 7, 'gravity': -120, 'shrink': true},
    'smoke': {'rate': 12, 'colors': ['#9e9e9e', '#757575'], 'speed': 30, 'spread': 0.5, 'dir': -90, 'life': 2, 'size': 14, 'gravity': -30, 'grow': true, 'alpha': 0.5},
    'rain': {'rate': 120, 'colors': ['#90caf9'], 'speed': 700, 'spread': 0.05, 'dir': 95, 'life': 1.2, 'size': 3, 'gravity': 0, 'area': true, 'stretch': 4},
    'snow': {'rate': 40, 'colors': ['#ffffff'], 'speed': 60, 'spread': 0.6, 'dir': 90, 'life': 6, 'size': 5, 'gravity': 10, 'area': true},
    'sparkle': {'rate': 18, 'colors': ['#ffffff', '#fff59d', '#80deea'], 'speed': 40, 'spread': 3.2, 'dir': 0, 'life': 0.7, 'size': 4, 'gravity': 0, 'shrink': true},
    'confetti': {'rate': 60, 'colors': ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'], 'speed': 300, 'spread': 0.8, 'dir': -90, 'life': 2.5, 'size': 7, 'gravity': 500, 'square': true},
    'magic': {'rate': 30, 'colors': ['#ce93d8', '#80cbc4', '#fff59d'], 'speed': 50, 'spread': 3.2, 'dir': -90, 'life': 1.2, 'size': 5, 'gravity': -60, 'shrink': true},
    'bubbles': {'rate': 8, 'colors': ['#b3e5fc'], 'speed': 50, 'spread': 0.4, 'dir': -90, 'life': 3, 'size': 10, 'gravity': -40, 'alpha': 0.6},
  };
  double acc = 0;
  late bool on = p['playing'] != false;
  @override
  void start(GameObject e, PocketGame g) => g.on((m) { if (m == 'particles-on' || m == '${e.name}-on') on = true; if (m == 'particles-off' || m == '${e.name}-off') on = false; });
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!on || !e.shown) return;
    final P = presets[strOf(p['preset'], 'fire')] ?? presets['fire']!;
    final rate = numOf(p['rate']) > 0 ? numOf(p['rate']) : numOf(P['rate']), size = numOf(p['size']) > 0 ? numOf(p['size']) : numOf(P['size']);
    final colors = (P['colors'] as List).cast<String>(), vb = g.viewBounds;
    acc += rate * dt;
    while (acc >= 1 && g.particles.length < 1500) {
      acc--;
      final a = numOf(P['dir']) * deg + rand(-numOf(P['spread']), numOf(P['spread'])), sp = numOf(P['speed']) * rand(0.6, 1.2);
      final at = P['area'] == true ? Offset(rand(vb.left - 40, vb.right + 40), vb.top - 10) : Offset(e.x, e.y);
      final life = numOf(P['life']) * rand(0.8, 1.2);
      g.particles.add(Particle(at, Offset(math.cos(a) * sp, math.sin(a) * sp), colorOf(p['color']) ?? colorOf(colors[_rng.nextInt(colors.length)])!, size * rand(0.7, 1.3),
          life: life, gravity: numOf(P['gravity']), shrink: P['shrink'] == true, grow: P['grow'] == true, round: P['square'] != true, alpha: numOf(P['alpha'], 1), stretch: numOf(P['stretch'])));
    }
  }
}

/// Blink: on and off (a hazard that's only dangerous while showing).
class Blink extends Component {
  Blink(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final on = numOf(p['on'], 0.6), off = numOf(p['off'], 0.6);
    t = (t + dt) % math.max(0.01, on + off);
    e.visible = t < on;
    e.data['blinkOff'] = p['solid'] != false && !e.visible;
  }
}

/// Force Zone: pushes things inside it one way (wind, a conveyor, a fan), or toward / away from its centre.
class ForceZone extends Component {
  ForceZone(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) { if (onOf(p['hidden'])) e.visible = false; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final tag = strOf(p['tag']), mode = strOf(p['mode'], 'direction'), s = numOf(p['strength'], 1800);
    final fx = numOf(p['fx']), fy = numOf(p['fy'], -1), l = math.sqrt(fx * fx + fy * fy) == 0 ? 1 : math.sqrt(fx * fx + fy * fy);
    for (final o in g.objects) {
      final b = o.body;
      if (o == e || o.dead || b == null || !b.isDynamic || (tag.isNotEmpty && !o.has(tag)) || !PocketGame.overlap(e, o)) continue;
      double ux, uy;
      if (mode == 'direction') { ux = fx / l; uy = fy / l; }
      else { final dx = e.x - o.x, dy = e.y - o.y, d = math.max(1.0, math.sqrt(dx * dx + dy * dy)), sg = mode == 'pull to center' ? 1 : -1; ux = sg * dx / d; uy = sg * dy / d; }
      b.fx += ux * s; b.fy += uy * s;
    }
  }
}

// ---- touch and buttons ----

/// Touch Button: a HUD object that works as the jump / fire button or a direction (or sends a message while pressed).
class TouchKey extends Component {
  TouchKey(this.p);
  final Map<String, dynamic> p;
  bool was = false;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    g.tapTargets.add(e);
    const act = {'jump': 'jump', 'fire': 'action', 'left': 'dleft', 'right': 'dright', 'up': 'dup', 'down': 'ddown', 'message': 'msg'};
    final a = act[strOf(p['action'], 'jump')] ?? 'jump';
    final held = e.shown && g.pointers.values.any((q) => g.hitsAt(e, q.at));
    if (held) { g.virtualHeld.add(a); } else { g.virtualHeld.remove(a); }
    e.alpha = held ? 1 : 0.75;
    if (held && !was) { g.pressed.add(a); if (a == 'jump') g.pressed.add('btn:jump'); g.squash(e, 0.9); if (a == 'msg') g.send(strOf(p['message'], 'boost')); }
    was = held;
  }
  @override
  void gone(GameObject e, PocketGame g) => g.virtualHeld.clear();
}

/// Button: does an action on a tap (or on press, while held, on a long press); can cost a variable, need one, cool down or work once.
class ButtonPart extends Component {
  ButtonPart(this.p);
  final Map<String, dynamic> p;
  int? held;
  double heldT = 0, nextRep = 0, cdUntil = -1;
  bool longDone = false, used = false;
  Offset? base;
  @override
  bool get always => true;
  bool get gated => strOf(p['enableVar']).isNotEmpty || strOf(p['costVar']).isNotEmpty || onOf(p['once']) || numOf(p['cooldown']) > 0;
  bool allowed(PocketGame g) {
    if (onOf(p['once']) && used) return false;
    final ev = strOf(p['enableVar']);
    if (ev.isNotEmpty) {
      final a = g.numVar(ev), b = numOf(p['enableValue'], 1);
      final ok = switch (strOf(p['enableOp'], '≥')) { '>' => a > b, '=' => a == b, '≠' => a != b, '<' => a < b, '≤' => a <= b, _ => a >= b };
      if (!ok) return false;
    }
    final cv = strOf(p['costVar']);
    if (cv.isNotEmpty && g.numVar(cv) < numOf(p['cost'], 10)) return false;
    return true;
  }
  void fire(GameObject e, PocketGame g) {
    if (g.time < cdUntil && g.state == 'play') return;
    if (!allowed(g)) { g.sfx('hit'); g.tween(e, 'x', e.x + 8, 0.3, curve: 'outElastic', yoyo: true); if (strOf(p['denied']).isNotEmpty) g.message(strOf(p['denied']), 1.3); return; }
    final cv = strOf(p['costVar']);
    if (cv.isNotEmpty) g.addVar(cv, -numOf(p['cost'], 10));
    if (p['haptic'] != false) g.buzz();
    if (p['action'] != 'play sound' && strOf(p['sound'], 'none') == 'none') g.sfx('click');
    g.runAction(e, p);
    if (strOf(p['also']).isNotEmpty) g.send(strOf(p['also']));
    used = true;
    if (numOf(p['cooldown']) > 0) cdUntil = g.time + numOf(p['cooldown']);
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!g.onScreen(e)) { held = null; return; }
    g.tapTargets.add(e);
    base ??= Offset(e.sx, e.sy);
    final mode = strOf(p['when'], 'on tap');
    if (held == null) {
      for (final d in g.downs) {
        if (!g.hitsAt(e, d.at)) continue;
        held = d.id; heldT = 0; nextRep = 0; longDone = false;
        if (mode == 'on press') fire(e, g);
        break;
      }
    }
    final ptr = held == null ? null : g.pointers[held];
    if (ptr != null) {
      heldT += dt;
      if (mode == 'while held (repeats)' && heldT >= nextRep) { fire(e, g); nextRep = heldT + math.max(0.05, numOf(p['repeat'], 0.15)) + (nextRep == 0 ? 0.25 : 0); }
      if (mode == 'on long press' && !longDone && heldT >= numOf(p['holdTime'], 0.6)) { longDone = true; fire(e, g); }
    } else { held = null; }
    if (mode == 'on tap') { for (final t in g.taps) { if (g.hits(e, t)) { fire(e, g); break; } } }
    // pressed in while the finger is on it
    final down = ptr != null && g.hitsAt(e, ptr.at), k = down ? numOf(p['pressScale'], 0.92) : 1.0, a = math.min(1.0, dt * 25), b = base!;
    if (strOf(p['feel'], 'spring') != 'none') { e.sx += (b.dx * k - e.sx) * a; e.sy += (b.dy * k - e.sy) * a; }
    if (strOf(p['pressColor']).isNotEmpty && e.shape != null) { e.data['fill0'] ??= e.shape!['fill']; e.shape!['fill'] = down ? p['pressColor'] : e.data['fill0']; }
    if (gated) e.alpha = !allowed(g) || g.time < cdUntil ? numOf(p['disabledAlpha'], 0.45) : 1;
    e.data['cooldown'] = cdUntil > g.time ? (cdUntil - g.time) / math.max(0.01, numOf(p['cooldown'], 1)) : 0;
  }
}

/// Click Popup: "+1" floats up where you tap it.
class ClickPopup extends Component {
  ClickPopup(this.p);
  final Map<String, dynamic> p;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    for (final t in g.tapsOn(e)) { g.popText(t.screen - const Offset(0, 20), g.fill(strOf(p['text'], '+1')), colorOf(p['color']) ?? const Color(0xFFFFD23D), numOf(p['size'], 26)); }
  }
}

/// Combo Clicker: quick taps build a combo that multiplies the points; sometimes a critical hit.
class ComboClicker extends Component {
  ComboClicker(this.p);
  final Map<String, dynamic> p;
  int combo = 0;
  double last = -99;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    final window = numOf(p['window'], 0.6);
    if (combo > 0 && g.time - last > window) { combo = 0; g.setVar('combo', 0); }
    for (final t in g.tapsOn(e)) {
      combo = g.time - last <= window ? math.min(numOf(p['maxCombo'], 50).toInt(), combo + 1) : 1; last = g.time;
      final crit = _rng.nextDouble() * 100 < numOf(p['critChance'], 10), mult = (1 + (combo - 1) * numOf(p['comboStep'], 0.25)) * (crit ? numOf(p['critMult'], 3) : 1);
      final bv = strOf(p['bonusVar']), pts = math.max(0.0, ((numOf(p['points'], 1) + (bv.isEmpty ? 0 : g.numVar(bv))) * mult * 100).round() / 100);
      g.addVar(strOf(p['var'], 'score'), pts); g.setVar('combo', combo);
      g.sfx(crit ? 'power' : strOf(p['sound'], 'click')); g.buzz(crit);
      if (p['popup'] != false) g.popText(t.screen - const Offset(0, 20), '${crit ? 'CRIT +' : '+'}${formatNumber(pts)}', crit ? const Color(0xFFFF5D8F) : const Color(0xFFFFD23D), crit ? 34 : 24 + math.min(10, combo / 3));
      g.squash(e, crit ? 0.8 : 0.9);
      if (crit) g.burst(e.x, e.y, const Color(0xFFFF5D8F), 14, 0.8);
    }
  }
}

/// Long Press: hold a finger on it for a moment (a ring fills) to do an action.
class LongPress extends Component {
  LongPress(this.p);
  final Map<String, dynamic> p;
  int? held;
  double t = 0;
  bool fired = false, hooked = false;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    if (!hooked) {
      hooked = true;
      g.overlays.add((c) {
        if (held == null || fired || e.dead) return;
        final at = g.screenOf(e), k = math.min(1.0, t / numOf(p['seconds'], 0.8));
        c.drawCircle(at, 34, Paint()..color = const Color(0x59000000)..style = PaintingStyle.stroke..strokeWidth = 6);
        c.drawArc(Rect.fromCircle(center: at, radius: 34), -math.pi / 2, math.pi * 2 * k, false, Paint()..color = const Color(0xFFFFD23D)..style = PaintingStyle.stroke..strokeWidth = 6);
      });
    }
    if (held == null) { final d = g.downOn(e); if (d != null) { held = d.id; t = 0; fired = false; } return; }
    final ptr = g.pointers[held];
    if (ptr == null || !g.hitsAt(e, ptr.at)) { held = null; return; }
    t += dt;
    if (!fired && t >= numOf(p['seconds'], 0.8)) { fired = true; g.buzz(true); g.squash(e, 0.85); g.runAction(e, p); }
  }
}

/// Double Tap: two quick taps do an action.
class DoubleTap extends Component {
  DoubleTap(this.p);
  final Map<String, dynamic> p;
  double last = -99;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    for (final _ in g.tapsOn(e)) {
      if (g.time - last <= numOf(p['gap'], 0.35)) { last = -99; g.squash(e, 0.85); g.buzz(); g.runAction(e, p); } else { last = g.time; }
    }
  }
}

/// Tap Toggle: tap to switch on and off (a variable, its colour, and showing another object).
class TapToggle extends Component {
  TapToggle(this.p);
  final Map<String, dynamic> p;
  bool on = false;
  void apply(GameObject e, PocketGame g) {
    g.setVar(strOf(p['var'], 'switch'), on ? 1 : 0);
    e.shape?['fill'] = on ? strOf(p['onColor'], '#66bb6a') : strOf(p['offColor'], '#78909c');
    final o = strOf(p['object']);
    if (o.isNotEmpty) g.find(o)?.visible = on;
  }
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) { on = onOf(p['startOn']); apply(e, g); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    for (final _ in g.tapsOn(e)) {
      on = !on; apply(e, g); g.squash(e); g.sfx('click');
      if (strOf(p['message']).isNotEmpty) g.send('${p['message']} ${on ? 'on' : 'off'}');
    }
  }
}

/// Press Feedback: squashes while pressed, springs back on release (a click, a buzz, sparkles).
class PressFeedback extends Component {
  PressFeedback(this.p);
  final Map<String, dynamic> p;
  int? held;
  double base = 1;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (held == null) {
      final d = g.downOn(e);
      if (d == null) { base = e.sx; return; }
      held = d.id; g.killTweens(e); e.sx = e.sy = base * numOf(p['squash'], 0.88);
      g.sfx(strOf(p['sound'], 'click'));
      if (p['haptic'] != false) g.buzz();
      if (onOf(p['sparkles'])) g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? Colors.white, 10, 0.6);
    } else if (!g.pointers.containsKey(held)) { held = null; g.tween(e, 'sx', base, 0.22, curve: 'outBack'); g.tween(e, 'sy', base, 0.22, curve: 'outBack'); }
  }
}

/// Tap to Spawn: taps (on empty space, or anywhere) make copies of a template; can cost a variable.
class TapToSpawn extends Component {
  TapToSpawn(this.p);
  final Map<String, dynamic> p;
  double last = -99;
  final List<GameObject> made = [];
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final tpl = strOf(p['template']);
    if (tpl.isEmpty) return;
    for (final t in g.taps) {
      if (g.time - last < numOf(p['cooldown'], 0.2)) continue;
      if (strOf(p['where'], 'empty') == 'empty' && g.objects.any((q) => q != e && q.shown && !q.dead && (q.shape != null || q.sprite != null || q.ui) && g.hits(q, t))) continue;
      made.removeWhere((o) => o.dead);
      if (numOf(p['max'], 20) > 0 && made.length >= numOf(p['max'], 20)) { g.message('Too many!', 0.8); continue; }
      final cost = numOf(p['cost']), cv = strOf(p['costVar'], 'score');
      if (cost > 0) { if (g.numVar(cv) < cost) { g.message('Need ${formatNumber(cost)} $cv', 1); continue; } g.addVar(cv, -cost); }
      final c = g.spawn(tpl, t.world.dx, t.world.dy);
      if (c != null) { made.add(c); last = g.time; g.buzz(); }
    }
  }
}

/// Drag to Launch: pull back from it and let go to fling it (slingshot).
class DragLaunch extends Component {
  DragLaunch(this.p);
  final Map<String, dynamic> p;
  int? held;
  int used = 0;
  Offset pull(GameObject e, PocketGame g, Offset at) { final c = g.screenOf(e); var d = c - at; final l = d.distance, m = numOf(p['maxPull'], 140); if (l > m) d = d / l * m; return d; }
  @override
  void start(GameObject e, PocketGame g) {
    e.ensureBody('dynamic');
    g.overlays.add((c) {
      final ptr = held == null ? null : g.pointers[held];
      if (ptr == null || e.dead) return;
      final at = g.screenOf(e), d = pull(e, g, ptr.at), tip = at + d * 1.6;
      c.drawLine(at, tip, Paint()..color = const Color(0xD9FFFFFF)..strokeWidth = 3..strokeCap = StrokeCap.round);
      c.drawLine(at, at - d, Paint()..color = const Color(0x59FFFFFF)..strokeWidth = 3);
      c.drawCircle(tip, 6, Paint()..color = const Color(0xFFFFD23D));
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final b = e.ensureBody('dynamic');
    if (held == null) {
      if (numOf(p['shots']) > 0 && used >= numOf(p['shots'])) return;
      if (p['whileStill'] != false && math.sqrt(b.vx * b.vx + b.vy * b.vy) > 20) return;
      final d = g.downOn(e);
      if (d != null) { held = d.id; d.role = 'drag'; }
      return;
    }
    if (g.pointers.containsKey(held)) return;
    final up = g.ups.where((u) => u.id == held).firstOrNull;
    held = null;
    if (up == null) return;
    final d = pull(e, g, up.at);
    if (d.distance < 12) return;
    final k = numOf(p['power'], 6) / g.zoom;
    b.vx = d.dx * k; b.vy = d.dy * k;
    used++;
    final sv = strOf(p['shotsVar'], 'shots');
    if (sv.isNotEmpty) g.addVar(sv, 1);
    g.sfx('jump'); g.buzz();
  }
}

// ---- logic ----

/// Trigger Zone: does an action when something with a tag enters it (once, or every time).
class TriggerZone extends Component {
  TriggerZone(this.p);
  final Map<String, dynamic> p;
  bool done = false;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void start(GameObject e, PocketGame g) { if (p['hidden'] != false) e.visible = false; }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { if (p['once'] != false && done) return; done = true; g.runAction(e, p, other); }
}

/// Timer: does an action after some seconds (once, or over and over).
class TimerPart extends Component {
  TimerPart(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  bool done = false;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (done || (t += dt) < numOf(p['seconds'], 5)) return;
    g.runAction(e, p);
    if (onOf(p['repeat'])) { t = 0; } else { done = true; }
  }
}

/// Condition: does an action once a variable reaches a value (hp ≤ 0 → game over).
class Condition extends Component {
  Condition(this.p);
  final Map<String, dynamic> p;
  bool done = false;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (done) return;
    final v = g.numVar(strOf(p['var'], 'hp')), t = numOf(p['target']), op = strOf(p['op'], '<=');
    if (op == '<=' ? v <= t : op == '>=' ? v >= t : v == t) { done = true; g.runAction(e, p); }
  }
}

/// Wave Spawner: waves of enemies with breaks in between; when they're all beaten it wins, loops or sends a message.
class WaveSpawner extends Component {
  WaveSpawner(this.p);
  final Map<String, dynamic> p;
  int w = -1, left = 0;
  double t = 1;
  String phase = 'break';
  final List<GameObject> spawned = [];
  List get waves => p['waves'] is List ? p['waves'] as List : const [];
  @override
  void start(GameObject e, PocketGame g) { t = 1; g.setVar('wave', 0); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    spawned.removeWhere((q) => q.dead);
    t -= dt;
    if (phase == 'break' && t <= 0) {
      w++;
      if (w >= waves.length) {
        final when = strOf(p['whenDone'], 'win');
        if (when == 'loop waves' && waves.isNotEmpty) { w = 0; } else { phase = 'done'; if (when == 'win') { g.win(); } else if (when == 'send message') { g.send(strOf(p['message'], 'waves-done')); } return; }
      }
      phase = 'spawn'; left = numOf((waves[w] as Map)['count'], 1).toInt(); t = 0; g.setVar('wave', w + 1); g.message('Wave ${w + 1}', 1.5); g.send('wave-${w + 1}');
    } else if (phase == 'spawn' && t <= 0 && left > 0) {
      final W = waves[w] as Map;
      final q = g.spawn('${W['template']}', e.x + rand(-0.5, 0.5) * numOf(p['area'], 300), e.y + rand(-0.5, 0.5) * numOf(p['areaH']));
      if (q != null) spawned.add(q);
      left--; t = numOf(W['every'], 1);
    } else if (phase == 'spawn' && left <= 0 && spawned.isEmpty) { phase = 'break'; t = numOf(p['pause'], 3); }
  }
}

/// Day / Night Cycle: the sky colour changes through the day and the world gets darker at night; {hour} counts the hours.
class DayNight extends Component {
  DayNight(this.p);
  final Map<String, dynamic> p;
  double hour = 0;
  @override
  void start(GameObject e, PocketGame g) => hour = numOf(p['start'], 8);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    hour = (hour + dt * 24 / math.max(1, numOf(p['dayLength'], 60))) % 24;
    final sun = math.sin((hour - 6) / 24 * math.pi * 2), day = (sun * 1.6 + 0.3).clamp(0.0, 1.0);
    g.background = mixColor(colorOf(p['nightColor']) ?? const Color(0xFF0B1030), colorOf(p['dayColor']) ?? const Color(0xFF87B8E8), day);
    g.darkness = (1 - day) * numOf(p['maxDark'], 0.8);
    final hr = hour.floor();
    if (g.vars['hour'] != hr) g.setVar('hour', hr);
  }
}

/// Typewriter Text: its text appears letter by letter (when the game starts, or on a message).
class Typewriter extends Component {
  Typewriter(this.p);
  final Map<String, dynamic> p;
  String full = '';
  double n = 0;
  bool on = false;
  @override
  void start(GameObject e, PocketGame g) {
    full = strOf(e.text?['value']);
    e.text?['value'] = '';
    on = strOf(p['startOn'], 'start') == 'start';
    g.on((m) { if (m == strOf(p['message'], 'story')) { n = 0; on = true; } });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final t = e.text;
    if (!on || t == null) return;
    final before = n.floor();
    n = math.min(full.length.toDouble(), n + dt * numOf(p['speed'], 30));
    if (p['sound'] != false && n.floor() > before && n.floor() % 3 == 0) HapticFeedback.selectionClick();
    t['value'] = full.substring(0, n.floor());
    if (n >= full.length) on = false;
  }
}

// ---- health and damage ----

/// Health & Damage: hit points; hurt by touching things with tags (or by a Damage Dealer), invulnerable for a moment,
/// knocked back, armour and shields, regeneration, poison / burn / freeze effects; when it runs out: destroy, respawn, lose a life, game over.
class Health extends Component with Toucher {
  Health(this.p);
  final Map<String, dynamic> p;
  double hp = 1, max = 1, shield = 0, shieldMax = 0, since = 99;
  bool dead = false;
  Offset home = Offset.zero;
  late final List<String> tags = tagList(p['hurtBy'] ?? 'enemy, hazard'), healTags = tagList(p['healTags']);
  /// Status effects: name → (damage per second, seconds left).
  final Map<String, (double, double)> effects = {};
  double tick = 0;
  late final Map<String, double> resist = {
    for (final part in strOf(p['resist']).split(',')) if (part.trim().contains(' ')) part.trim().split(RegExp(r'\s+'))[0].toLowerCase(): numOf(part.trim().split(RegExp(r'\s+')).last.replaceAll('%', '')) / (part.contains('%') ? 100 : 1),
  };
  bool hurtsMe(GameObject o) => tags.any(o.has) && !(o.part<Damager>()?.hits(o, this) ?? false);
  @override
  bool cares(GameObject other) => tags.any(other.has) || healTags.any(other.has);
  void sync(GameObject e, PocketGame g) {
    final sv = strOf(p['syncVar']);
    if (sv.isNotEmpty) g.setVar(sv, hp.ceil());
    e.data['hp'] = hp; e.data['hpMax'] = max;
    final k = max > 0 ? hp / max : 0.0, show = strOf(p['showBar'], 'never');
    if (!dead && (show == 'always' || (show == 'when hurt' && hp < max))) { e.bars['health'] = (k, k > 0.5 ? const Color(0xFF5DFF8A) : k > 0.25 ? const Color(0xFFFFD23D) : const Color(0xFFFF4D4D)); } else { e.bars.remove('health'); }
  }
  @override
  void start(GameObject e, PocketGame g) {
    max = math.max(1, numOf(p['hp'], 3)); hp = max; shield = shieldMax = numOf(p['shield']);
    home = Offset(e.x, e.y); sync(e, g);
  }
  double heal(GameObject e, PocketGame g, double n) {
    final was = hp; hp = math.min(max, hp + math.max(0, n));
    if (hp > 0) dead = false;
    sync(e, g);
    if (hp > was && onOf(p['numbers'])) g.popOver(e, '+${(hp - was).round()}', const Color(0xFF5DFF8A), 18);
    return hp - was;
  }
  /// Hurt it; returns the damage done.
  double damage(GameObject e, PocketGame g, double n, {GameObject? from, String type = '', bool crit = false, bool pierce = false, bool dot = false, double? knockback, bool ignoreInvuln = false}) {
    if (e.dead || dead || hp <= 0 || onOf(p['god'])) return 0;
    if (!dot && !ignoreInvuln && e.invuln > 0) return 0;
    var d = n;
    if (type.isNotEmpty && resist.containsKey(type)) d *= resist[type]!;
    if (!pierce) d = d * (1 - numOf(p['defense']).clamp(0, 100) / 100) - (dot ? 0 : numOf(p['armor']) + numOf(e.data['equipArmor']));
    if (d <= 0.001) { if (onOf(p['numbers']) && !dot) g.popOver(e, 'Blocked', const Color(0xFF9FB3C8), 18); return 0; }
    d = (d * 100).round() / 100;
    final total = d;
    if (shield > 0) { final soak = math.min(shield, d); shield -= soak; d -= soak; }
    hp = math.max(0, hp - d); since = 0;
    if (!dot) e.invuln = numOf(p['invuln'], 1);
    sync(e, g);
    g.send('damage');
    if (!dot) { g.sfx('hit'); g.shake = math.max(g.shake, 6); e.data['flash'] = 0.12; }
    if (onOf(p['numbers'])) g.popOver(e, '${crit ? 'CRIT ' : ''}-${total.round()}', crit ? const Color(0xFFFF5D8F) : const Color(0xFFFF4D4D), crit ? 30 : 22);
    final kb = knockback ?? numOf(p['knockback'], 300);
    final b = e.body;
    if (from != null && kb != 0 && b != null && !dot) { final dx = e.x - from.x, dy = e.y - from.y, l = math.max(1e-6, math.sqrt(dx * dx + dy * dy)); b.vx = dx / l * kb; b.vy = -kb.abs() * 0.6; }
    if (hp <= 0) die(e, g);
    return total;
  }
  void die(GameObject e, PocketGame g) {
    if (dead || e.dead) return;
    dead = true; hp = 0; effects.clear(); sync(e, g);
    g.send(strOf(p['message'], 'died'));
    if (numOf(p['points']) != 0) g.addVar('score', numOf(p['points']));
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFF8A3D), 24);
    final on = strOf(p['onDeath'], 'destroy');
    final act = on == 'lose a life' ? (g.numVar('lives') > 1 ? 'life' : 'game over') : on;
    if (act == 'life') g.addVar('lives', -1);
    if (act == 'destroy') { e.destroy(); }
    else if (act == 'game over') { if (on == 'lose a life') g.setVar('lives', 0); g.gameOver(); }
    else if (act == 'respawn' || act == 'life') { final sp = e.data['respawn'] as Offset? ?? home; e.x = sp.dx; e.y = sp.dy; e.body?..vx = 0..vy = 0; hp = max; shield = shieldMax; dead = false; e.invuln = math.max(numOf(p['invuln'], 1), 1); sync(e, g); }
  }
  /// Poison, burn, bleed (damage over time), regen (healing), freeze and slow (speed).
  void addEffect(GameObject e, String name, double perSec, double seconds) { if (!dead) effects[name] = (perSec, seconds); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    since += dt;
    var slow = 1.0;
    tick += dt;
    final ticks = tick >= 0.5;
    if (ticks) tick -= 0.5;
    for (final k in [...effects.keys]) {
      final (dps, left) = effects[k]!;
      if (k == 'freeze') { slow = math.min(slow, 0.0); } else if (k == 'slow') { slow = math.min(slow, 0.5); }
      else if (ticks) { if (k == 'regen') { heal(e, g, dps * 0.5); } else { damage(e, g, dps * 0.5, dot: true, pierce: true); } }
      if (left - dt <= 0) { effects.remove(k); } else { effects[k] = (dps, left - dt); }
      if (dead) break;
    }
    if (slow < 1) { e.data['slow'] = slow; } else { e.data.remove('slow'); }
    if (dead) return;
    final calm = since >= numOf(p['regenDelay']);
    if (numOf(p['regen']) > 0 && calm && hp < max) { hp = math.min(max, hp + numOf(p['regen']) * dt); sync(e, g); }
    if (shieldMax > 0 && calm && shield < shieldMax) shield = math.min(shieldMax, shield + numOf(p['shieldRegen'], 1) * dt);
    final fall = numOf(p['fallDamage']), fs = numOf(p['fallSpeed'], 900), b = e.body;
    if (fall > 0 && b != null && b.landed > fs) damage(e, g, fall * (1 + (b.landed - fs) / fs), ignoreInvuln: true);
    if (p['hurtWhileTouching'] != false && tags.isNotEmpty && e.invuln <= 0) {
      final o = g.touching(e, hurtsMe).firstOrNull;
      if (o != null) damage(e, g, numOf(p['damage'], 1), from: o);
    }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (healTags.any(other.has)) { if (hp < max) { heal(e, g, numOf(p['healAmount'], 1)); other.destroy(); g.sfx('power'); } return; }
    if (hurtsMe(other)) damage(e, g, numOf(p['damage'], 1), from: other);
  }
}

/// Damage Dealer: hurts objects with Health (weapons, bullets, spikes, lava, explosions): on touch or over time, crits, area damage, effects.
class Damager extends Component with Toucher {
  Damager(this.p);
  final Map<String, dynamic> p;
  late final List<String> tags = tagList(p['targets'] ?? 'enemy');
  final Map<int, double> last = {};
  double tickT = 0;
  /// Does this dealer hurt that object (so its Health doesn't hurt it twice)?
  bool hits(GameObject self, Health target) => true;
  bool targets(GameObject o) => tags.any(o.has);
  @override
  bool cares(GameObject other) => targets(other);
  double hit(GameObject e, GameObject t, PocketGame g, [double k = 1]) {
    if (g.time - (last[t.uid] ?? -99) < numOf(p['cooldown'], 0.3)) return 0;
    last[t.uid] = g.time;
    final hb = t.part<Health>();
    if (hb == null) { if (onOf(p['noHealth'])) { g.burst(t.x, t.y, colorOf(t.shape?['fill']) ?? const Color(0xFFFF8A3D), 16); t.destroy(); } return 0; }
    final crit = numOf(p['critChance']) > 0 && _rng.nextDouble() * 100 < numOf(p['critChance']);
    final owner = e.has('player') ? e : e.parent?.has('player') == true ? e.parent : null, bonus = p['useWeapon'] != false && owner != null ? numOf(owner.data['equipDamage']) : 0;
    final d = (numOf(p['amount'], 1) + bonus) * k * (crit ? numOf(p['critTimes'], 2) : 1);
    final dt = strOf(p['dtype'], 'normal');
    final dealt = hb.damage(t, g, d, from: e, type: dt == 'normal' ? '' : dt, crit: crit, pierce: onOf(p['pierce']), knockback: numOf(p['knockback']) != 0 ? numOf(p['knockback']) : null, ignoreInvuln: strOf(p['mode'], 'when it touches') != 'when it touches');
    final fx = strOf(p['effect'], 'nothing');
    if (fx != 'nothing') hb.addEffect(t, fx, numOf(p['effectDps'], 1), numOf(p['effectTime'], 3));
    if (dealt > 0 && numOf(p['points']) != 0) g.addVar('score', numOf(p['points']));
    return dealt;
  }
  void strike(GameObject e, GameObject t, PocketGame g) {
    final area = numOf(p['area']);
    if (area > 0) {
      for (final q in [...g.objects]) { if (!q.dead && q != e && targets(q)) { final d = (Offset(q.x, q.y) - Offset(e.x, e.y)).distance; if (d <= area) hit(e, q, g, 1 - 0.5 * d / area); } }
    } else { hit(e, t, g); }
    if (onOf(p['destroyOnHit'])) e.destroy();
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (strOf(p['mode'], 'when it touches') == 'when it touches') return;
    if ((tickT -= dt) > 0) return;
    tickT = math.max(0.05, numOf(p['every'], 0.5));
    for (final o in g.touching(e, targets)) { strike(e, o, g); if (e.dead) break; }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { if (strOf(p['mode'], 'when it touches') == 'when it touches' && !other.dead) strike(e, other, g); }
}

/// Hunger and Thirst: a need that drains over time (faster while moving), is refilled by food / drink, and hurts or slows when empty.
class Need extends Component with Toucher {
  Need(this.p, this.key, this.col);
  final Map<String, dynamic> p;
  final String key;
  final Color col;
  double v = 0, max = 1, hurtT = 0;
  bool low = false, empty = false;
  late final List<String> items = tagList(p['items'] ?? (key == 'thirst' ? 'water' : 'food'));
  late final Map<String, double> amounts = {
    for (final part in strOf(p['amounts']).split(',')) if (part.trim().contains(' ')) part.trim().substring(0, part.trim().lastIndexOf(' ')).toLowerCase(): numOf(part.trim().split(' ').last),
  };
  @override
  bool cares(GameObject other) => items.any(other.has);
  void sync(GameObject e, PocketGame g) {
    final sv = strOf(p['syncVar'], key);
    if (sv.isNotEmpty) g.setVar(sv, v.round());
    final k = v / max, show = strOf(p['showBar'], 'never');
    if (show == 'always' || (show == 'when low' && k * 100 <= numOf(p['lowAt'], 25))) { e.bars[key] = (k, col); } else { e.bars.remove(key); }
  }
  void check(GameObject e, PocketGame g) {
    final pc = v / max * 100, nowLow = pc <= numOf(p['lowAt'], 25) && v > 0, nowEmpty = v <= 0;
    if (nowLow && !low && strOf(p['lowMessage']).isNotEmpty) g.send(strOf(p['lowMessage']));
    if (nowEmpty && !empty && p['whenEmpty'] == 'game over') g.gameOver();
    low = nowLow; empty = nowEmpty;
    if (empty && strOf(p['whenEmpty'], 'hurts health').contains('slows')) { e.data['slow'] = numOf(p['slowTo'], 0.5).clamp(0.0, 1.0); } else if (!e.data.containsKey('slowFx')) { e.data.remove('slow'); }
  }
  @override
  void start(GameObject e, PocketGame g) { max = math.max(1, numOf(p['max'], 100)); v = max * numOf(p['start'], 100).clamp(0, 100) / 100; check(e, g); sync(e, g); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final b = e.body, moving = b != null && math.sqrt(b.vx * b.vx + b.vy * b.vy) > 20;
    final was = v;
    v = math.max(0, v - numOf(p['drain'], key == 'thirst' ? 0.8 : 0.5) * (moving ? numOf(p['moveDrain'], 1.5) : 1) * dt);
    if (v != was) { check(e, g); if (v.round() != was.round() || v == 0) sync(e, g); }
    final hb = e.part<Health>();
    if (empty && strOf(p['whenEmpty'], 'hurts health').contains('hurts') && hb != null && (hurtT += dt) >= 1) { hurtT -= 1; hb.damage(e, g, numOf(p['emptyDamage'], 1), dot: true, pierce: true); }
    if (!empty) hurtT = 0;
    if (numOf(p['healAbove']) > 0 && hb != null && v / max * 100 >= numOf(p['healAbove']) && hb.hp < hb.max && hb.hp > 0) hb.heal(e, g, numOf(p['healRate'], 0.2) * dt);
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (other.dead || v >= max) return;
    final n = other.name.toLowerCase();
    var worth = amounts[n] ?? numOf(p['perItem'], key == 'thirst' ? 30 : 25);
    for (final t in other.tags) { if (amounts.containsKey(t.toLowerCase())) worth = amounts[t.toLowerCase()]!; }
    v = math.min(max, v + worth); check(e, g); sync(e, g);
    g.sfx(strOf(p['sound'], 'power'));
    if (p['consume'] != false) other.destroy();
  }
}

/// Car: drive with the joystick (up for gas), steer harder the faster it goes; walls bleed speed.
class Car extends Component {
  Car(this.p);
  final Map<String, dynamic> p;
  double v = 0;
  @override
  void start(GameObject e, PocketGame g) { e.ensureBody('dynamic', gravityScale: 0); g.wantJoystick(); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final a = g.axis(), b = e.ensureBody('dynamic', gravityScale: 0), maxV = numOf(p['maxSpeed'], 320);
    final gas = onOf(p['autoGas']) ? 1.0 : -a.dy;
    v += gas * numOf(p['accel'], 260) * dt;
    v -= v * math.min(1.0, (gas != 0 ? 0.6 : 1.8) * dt);
    v = v.clamp(-maxV * 0.4, maxV);
    final grip = (v.abs() / (maxV * 0.25)).clamp(0.0, 1.0) * (v == 0 ? 1 : v.sign);
    e.rz += a.dx * numOf(p['turn'], 160) * grip * dt;
    b.vx = math.sin(e.rz * deg) * v; b.vy = -math.cos(e.rz * deg) * v;
  }
}

// ---- saving ----

/// Save Point: touching it saves the game (a slot).
class SavePoint extends Component {
  SavePoint(this.p);
  final Map<String, dynamic> p;
  double cool = 0;
  @override
  String get wants => strOf(p['tag'], 'player');
  @override
  void update(GameObject e, double dt, PocketGame g) => cool -= dt;
  @override
  void touch(GameObject e, GameObject other, PocketGame g) {
    if (cool > 0) return;
    cool = 2;
    if (g.saveGame(numOf(p['slot'], 1).toInt())) { if (strOf(p['text']).isNotEmpty) g.message(strOf(p['text']), 1.5); g.burst(e.x, e.y, const Color(0xFF7CF7A0), 14); g.sfx('power'); }
  }
}

/// Auto Save: keeps this object's place, look and whether it was removed on the phone (and puts it back next time).
class AutoSave extends Component {
  AutoSave(this.p);
  final Map<String, dynamic> p;
  String key = '';
  double t = 0;
  void save(GameObject e, PocketGame g) => g.prefs?.setString(key, jsonEncode({'x': e.x, 'y': e.y, 'visible': e.visible, 'data': {for (final d in e.data.entries) if (d.value is num || d.value is String || d.value is bool) d.key: d.value}}));
  @override
  void start(GameObject e, PocketGame g) {
    key = 'pocket.obj.${g.saveKey}.${strOf(p['file'], 'save')}.${strOf(p['key'], e.id)}';
    final s = g.prefs?.getString(key);
    if (s != null && p['loadOnStart'] != false) {
      final o = jsonDecode(s) as Map<String, dynamic>;
      if (o['removed'] == true && p['removed'] != false) { e.destroy(); return; }
      if (p['transform'] != false) { e.x = numOf(o['x'], e.x); e.y = numOf(o['y'], e.y); }
      if (p['visible'] != false) e.visible = o['visible'] != false;
      if (p['data'] != false) e.data.addAll((o['data'] as Map? ?? {}).cast<String, Object?>());
    }
    g.on((m) { if (m == strOf(p['message'], 'save') || (p['onLevelEnd'] != false && (m == 'won' || m == 'game over'))) save(e, g); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) { if (numOf(p['every']) > 0 && (t += dt) >= numOf(p['every'])) { t = 0; save(e, g); } }
  @override
  void gone(GameObject e, PocketGame g) { if (p['removed'] != false && g.state == 'play') g.prefs?.setString(key, jsonEncode({'removed': true})); }
}

/// Save Manager: keeps variables (all, or a list) on the phone and loads them when the game starts.
class SaveManager extends Component {
  SaveManager(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  String key(PocketGame g) => 'pocket.vars.${g.saveKey}.${strOf(p['file'], 'save')}';
  void save(PocketGame g) {
    final names = tagList(p['vars']);
    g.prefs?.setString(key(g), jsonEncode({for (final k in g.vars.keys) if ((names.isEmpty && k != 'time' && k != 'best') || names.contains(k)) k: g.vars[k]}));
    if (strOf(p['savedText']).isNotEmpty) g.message(strOf(p['savedText']), 1.2);
  }
  @override
  void start(GameObject e, PocketGame g) {
    final s = g.prefs?.getString(key(g));
    if (s != null && p['loadOnStart'] != false) g.vars.addAll((jsonDecode(s) as Map).cast<String, Object?>());
    g.on((m) { if (m == strOf(p['message'], 'save') || (p['onLevelEnd'] != false && (m == 'won' || m == 'game over'))) save(g); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) { if (numOf(p['every']) > 0 && (t += dt) >= numOf(p['every'])) { t = 0; save(g); } }
}

// ---- physics helpers and AI ----

/// Joint: ties this object to another with a rope (up to a length), a stiff rod, or a spring; draws the line.
class Joint extends Component {
  Joint(this.p);
  final Map<String, dynamic> p;
  double len = 0;
  @override
  void start(GameObject e, PocketGame g) {
    final a = g.find(strOf(p['connectTo']));
    e.ensureBody('dynamic');
    len = numOf(p['length']) > 0 ? numOf(p['length']) : a != null ? (Offset(a.x, a.y) - Offset(e.x, e.y)).distance : 100;
    if (p['showLine'] != false) {
      g.worldOverlays.add((c) {
        final o = g.find(strOf(p['connectTo']));
        if (o == null || e.dead) return;
        c.drawLine(Offset(o.x, o.y), Offset(e.x, e.y), Paint()..color = colorOf(p['color']) ?? const Color(0xFFD7CCC8)..strokeWidth = 2);
      });
    }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final a = g.find(strOf(p['connectTo']));
    if (a == null || a == e) return;
    final b = e.ensureBody('dynamic'), dx = e.x - a.x, dy = e.y - a.y, d = math.max(1e-6, math.sqrt(dx * dx + dy * dy)), nx = dx / d, ny = dy / d, kind = strOf(p['kind'], 'rope');
    if (kind == 'spring') {
      final f = -(d - len) * numOf(p['stiffness'], 30), vn = b.vx * nx + b.vy * ny, damp = numOf(p['damping'], 2);
      b.vx += (f * nx - damp * vn * nx) * dt; b.vy += (f * ny - damp * vn * ny) * dt;
    } else if (d > len || kind == 'rod') {
      e.x = a.x + nx * len; e.y = a.y + ny * len;
      final vn = b.vx * nx + b.vy * ny;
      if (vn > 0 || kind == 'rod') { b.vx -= vn * nx; b.vy -= vn * ny; }
    }
  }
}

/// Pathfinding (Navigator): walks to a target around walls (solid objects), finding the way on a grid.
class Navigator extends Component {
  Navigator(this.p);
  final Map<String, dynamic> p;
  List<Offset>? path;
  double t = 0;
  int k = 1;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final goal = g.findAll(strOf(p['target'], 'player')).where((q) => q != e).firstOrNull;
    if (goal == null) return;
    final b = e.body, dist = (Offset(goal.x, goal.y) - Offset(e.x, e.y)).distance, cell = math.max(4.0, numOf(p['cell'], 24)), speed = slowed(e, numOf(p['speed'], 120));
    if (dist <= numOf(p['stop'], 30)) { path = null; if (b != null && b.isDynamic) { b.vx = 0; if (g.gravity == 0) b.vy = 0; } return; }
    if ((t -= dt) <= 0 || path == null) { t = numOf(p['repath'], 0.5); path = findPath(g, e, Offset(goal.x, goal.y), cell, math.max(e.half.width, e.half.height) * 0.9); k = 1; }
    final pts = path;
    final wp = pts != null && pts.isNotEmpty ? pts[math.min(k, pts.length - 1)] : Offset(goal.x, goal.y);
    final dx = wp.dx - e.x, dy = wp.dy - e.y, l = math.sqrt(dx * dx + dy * dy);
    if (l < cell * 0.5 && pts != null && k < pts.length - 1) k++;
    final vx = l > 0 ? dx / l * speed : 0.0, vy = l > 0 ? dy / l * speed : 0.0;
    if (b != null && b.isDynamic) { b.vx = vx; if (g.gravity == 0) b.vy = vy; } else { e.x += vx * dt; e.y += vy * dt; }
    faceX(e, vx);
  }
}

/// A* on a grid around the start and goal: solid objects are walls. A list of points (the start first), or null.
List<Offset>? findPath(PocketGame g, GameObject self, Offset goal, double cell, double radius) {
  final walls = [for (final o in g.objects) if (o != self && !o.dead && o.body != null && o.body!.solid) Rect.fromCenter(center: Offset(o.x, o.y), width: o.half.width * 2 + radius * 2, height: o.half.height * 2 + radius * 2)];
  final start = Offset(self.x, self.y);
  final minX = math.min(start.dx, goal.dx) - cell * 12, minY = math.min(start.dy, goal.dy) - cell * 12;
  final w = (((start.dx - goal.dx).abs() + cell * 24) / cell).ceil(), h = (((start.dy - goal.dy).abs() + cell * 24) / cell).ceil();
  if (w * h > 40000) return null;
  (int, int) cellOf(Offset p) => (((p.dx - minX) / cell).floor().clamp(0, w - 1), ((p.dy - minY) / cell).floor().clamp(0, h - 1));
  Offset centre(int i, int j) => Offset(minX + (i + 0.5) * cell, minY + (j + 0.5) * cell);
  bool blocked(int i, int j) { final c = centre(i, j); return walls.any((r) => r.contains(c)); }
  final (si, sj) = cellOf(start);
  final (gi, gj) = cellOf(goal);
  final open = <int>{sj * w + si}, came = <int, int>{}, gs = <int, double>{sj * w + si: 0};
  double hh(int n) => ((n % w - gi).abs() + (n ~/ w - gj).abs()).toDouble();
  var guard = 0;
  while (open.isNotEmpty && guard++ < 6000) {
    var cur = open.first;
    for (final n in open) { if (gs[n]! + hh(n) < gs[cur]! + hh(cur)) cur = n; }
    if (cur == gj * w + gi) {
      final out = <Offset>[goal];
      var c = cur;
      while (came.containsKey(c)) { c = came[c]!; out.add(centre(c % w, c ~/ w)); }
      out[out.length - 1] = start;
      return out.reversed.toList();
    }
    open.remove(cur);
    final ci = cur % w, cj = cur ~/ w;
    for (final (di, dj) in const [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]) {
      final ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= w || nj >= h || blocked(ni, nj)) continue;
      if (di != 0 && dj != 0 && (blocked(ci + di, cj) || blocked(ci, cj + dj))) continue; // (no cutting corners)
      final n = nj * w + ni, cost = gs[cur]! + (di != 0 && dj != 0 ? 1.414 : 1);
      if (cost < (gs[n] ?? double.infinity)) { gs[n] = cost; came[n] = cur; open.add(n); }
    }
  }
  return null;
}

/// Enemy AI: patrols, chases what it sees, attacks in range (hurting its Health), gives up and goes home.
class EnemyAI extends Component {
  EnemyAI(this.p);
  final Map<String, dynamic> p;
  Offset home = Offset.zero;
  double dir = 1, lost = 0, cool = 0;
  String state = 'patrol';
  @override
  void start(GameObject e, PocketGame g) { home = Offset(e.x, e.y); e.data['state'] = state; }
  void moveTo(GameObject e, PocketGame g, double tx, double ty, double speed, double dt) {
    final b = e.body, grav = g.gravity != 0 && b != null && b.isDynamic && b.gravityScale != 0;
    final dx = tx - e.x, dy = grav ? 0.0 : ty - e.y, l = math.sqrt(dx * dx + dy * dy);
    if (l < 1e-3) { if (b != null && b.isDynamic) { b.vx = 0; if (!grav) b.vy = 0; } return; }
    final vx = dx / l * speed, vy = dy / l * speed;
    if (b != null && b.isDynamic) { b.vx = vx; if (!grav) b.vy = vy; } else { e.x += vx * dt; e.y += vy * dt; }
    faceX(e, vx);
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final t = g.findAll(strOf(p['target'], 'player')).where((q) => q != e).firstOrNull;
    final d = t == null ? double.infinity : (Offset(t.x, t.y) - Offset(e.x, e.y)).distance;
    final sees = t != null && d <= numOf(p['sight'], 260) && (p['needLineOfSight'] == false || g.canSee(e, t));
    cool -= dt;
    if (sees) { lost = 0; state = d <= numOf(p['attackRange'], 44) ? 'attack' : 'chase'; }
    else if (state == 'chase' || state == 'attack') { lost += dt; if (lost > numOf(p['giveUp'], 3)) state = 'return'; }
    final sp = slowed(e, numOf(p['speed'], 60));
    if (state == 'attack' && t != null) {
      moveTo(e, g, e.x, e.y, 0, dt);
      if (cool <= 0) {
        cool = numOf(p['attackEvery'], 1);
        final hb = t.part<Health>();
        if (hb != null) { hb.damage(t, g, numOf(p['damage'], 1), from: e); } else if (t.invuln <= 0) { g.hurt(t, 'damage'); }
        g.squash(e, 1.25);
      }
    } else if (state == 'chase' && t != null) { moveTo(e, g, t.x, t.y, slowed(e, numOf(p['chaseSpeed'], 140)), dt); }
    else if (state == 'return') { moveTo(e, g, home.dx, home.dy, sp, dt); if ((Offset(e.x, e.y) - home).distance < 4 || (g.gravity != 0 && (e.x - home.dx).abs() < 4)) state = 'patrol'; }
    else if (numOf(p['patrol'], 100) > 0) { final tx = home.dx + dir * numOf(p['patrol'], 100); moveTo(e, g, tx, home.dy, sp, dt); if ((e.x - tx).abs() < 3) dir = -dir; }
    else { moveTo(e, g, e.x, e.y, 0, dt); }
    e.data['state'] = state;
  }
}

/// Loading Screen: fills a variable 0 → 100 like a real loader (with stalls), shows tips, then hides this screen and does an action.
class Loader extends Component {
  Loader(this.p);
  final Map<String, dynamic> p;
  double t = 0, shown = 0, tipT = 0;
  int tipI = 0;
  bool running = false, waiting = false;
  List<String> get tips => strOf(p['tips']).split('|').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  @override
  bool get always => true;
  void begin(GameObject e, PocketGame g) {
    t = 0; shown = 0; running = true; waiting = false; e.visible = true;
    g.setVar(strOf(p['var'], 'loading'), 0);
    final tv = strOf(p['tipVar'], 'tip');
    if (tips.isNotEmpty && tv.isNotEmpty) g.setVar(tv, tips[tipI++ % tips.length]);
  }
  void finish(GameObject e, PocketGame g) {
    running = false; waiting = false;
    g.setVar(strOf(p['var'], 'loading'), 100);
    if (strOf(p['action']).isNotEmpty) g.runAction(e, p);
    g.send('loaded');
    if (p['hideSelf'] == false) return;
    g.tween(e, 'alpha', 0, math.max(0.01, numOf(p['fade'], 0.4)), done: () { e.visible = false; e.alpha = 1; });
  }
  @override
  void start(GameObject e, PocketGame g) {
    if (p['startOn'] == 'on a message') { e.visible = false; g.on((m) { if (!e.dead && m == strOf(p['message'], 'loading')) begin(e, g); }); } else { begin(e, g); }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!running) return;
    final tv = strOf(p['tipVar'], 'tip');
    if (!waiting && tips.length > 1 && tv.isNotEmpty && (tipT += dt) >= numOf(p['tipEvery'], 3)) { tipT = 0; g.setVar(tv, tips[tipI++ % tips.length]); }
    if (waiting) { if (g.taps.isNotEmpty) finish(e, g); return; }
    t += dt;
    final f = (t / math.max(0.1, numOf(p['seconds'], 2.5))).clamp(0.0, 1.0);
    final pace = strOf(p['pace'], 'realistic');
    final k = pace == 'steady' ? f : pace == 'fast then slow' ? 1 - math.pow(1 - f, 3).toDouble() : pace == 'slow then fast' ? math.pow(f, 2.2).toDouble() : pace == 'steps' ? (f >= 1 ? 1.0 : (f * 5).floor() / 5) : (f + 0.06 * math.sin(f * 17)).clamp(0.0, 1.0);
    shown = math.max(shown, k);
    g.setVar(strOf(p['var'], 'loading'), (shown * 100).round());
    if (f >= 1) { if (onOf(p['tapToContinue'])) { waiting = true; if (tv.isNotEmpty) g.setVar(tv, strOf(p['tapText'], 'Tap to continue')); } else { finish(e, g); } }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// On screen: the game view (drawn every frame), touch and keys, and the title / pause / game-over cards
// ---------------------------------------------------------------------------------------------------------------

/// Pictures (sprites saved in the game as data: URLs), decoded once.
class Sprites {
  static final Map<String, ui.Image?> _cache = {};
  static ui.Image? of(String src, VoidCallback ready) {
    if (_cache.containsKey(src)) return _cache[src];
    _cache[src] = null;
    final i = src.indexOf('base64,');
    if (!src.startsWith('data:image') || i < 0) return null;
    try { ui.decodeImageFromList(base64Decode(src.substring(i + 7)), (img) { _cache[src] = img; ready(); }); } catch (_) {}
    return null;
  }
}

class PocketGameView extends StatefulWidget {
  const PocketGameView({super.key, required this.game});
  final PocketGame game;
  @override
  State<PocketGameView> createState() => _PocketGameViewState();
}

class _PocketGameViewState extends State<PocketGameView> with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  PocketGame get g => widget.game;
  @override
  void initState() {
    super.initState();
    _ticker = createTicker((now) {
      final dt = ((now - _last).inMicroseconds / 1e6).clamp(0.0, 1 / 30);
      _last = now;
      g.step(dt.toDouble());
    })..start();
  }
  @override
  void dispose() { _ticker.dispose(); super.dispose(); }

  bool _has(String screen) => g.objects.any((o) => o.ui && !o.dead && o.showWhen == screen);

  /// HUD objects drawn by native widgets (sliders, toggles, charts, a shop…): each in its place on the screen.
  List<Widget> _hudWidgets() {
    final f = g.hudWidget;
    if (f == null) return const [];
    final out = <Widget>[];
    final list = g.objects.where((o) => o.ui && !o.dead && o.shown && g.onScreen(o)).toList()..sort((a, b) => a.layer.compareTo(b.layer));
    for (final o in list) {
      if (!g.hudIds.contains(o.id)) continue;
      final w = f(o);
      if (w == null) continue;
      g.tapTargets.add(o); // (touches on it are for the widget, not the joystick or a jump)
      final r = g.uiRect(o);
      out.add(Positioned(key: ValueKey(o.id), left: r.left, top: r.top, width: r.width, child: Opacity(opacity: o.alpha.clamp(0.0, 1.0), child: Material(type: MaterialType.transparency, child: w))));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    g.safe = MediaQuery.paddingOf(context);
    return Focus(
      autofocus: true,
      onKeyEvent: (_, ev) {
        if (ev is KeyDownEvent) { g.keys.add(ev.logicalKey); } else if (ev is KeyUpEvent) { g.keys.remove(ev.logicalKey); }
        if (ev is KeyDownEvent && (ev.logicalKey == LogicalKeyboardKey.enter || ev.logicalKey == LogicalKeyboardKey.space) && g.state != 'play') g.start();
        if (ev is KeyDownEvent && ev.logicalKey == LogicalKeyboardKey.escape && g.state == 'play') g.paused = !g.paused;
        return KeyEventResult.handled;
      },
      child: LayoutBuilder(builder: (context, box) {
        g.screen = Size(box.maxWidth, box.maxHeight);
        return Listener(
          onPointerDown: (e) => g.pointerDown(e.pointer, e.localPosition),
          onPointerMove: (e) => g.pointerMove(e.pointer, e.localPosition),
          onPointerUp: (e) => g.pointerUp(e.pointer),
          onPointerCancel: (e) => g.pointerUp(e.pointer),
          child: ListenableBuilder(
            listenable: g,
            builder: (context, _) => Stack(fit: StackFit.expand, children: [
              CustomPaint(painter: GamePainter(g, () => setState(() {}))),
              ..._hudWidgets(),
              for (final p in g.panels) p(context),
              for (final (i, m) in g.messages.indexed)
                Positioned(left: 0, right: 0, top: box.maxHeight * 0.32 + i * 44, child: IgnorePointer(child: Center(child: _Pill(m.$1)))),
              if (g.state == 'play' && !g.paused && g.settings['pauseButton'] == true)
                Positioned(top: g.safe.top + 10, right: g.safe.right + 10, child: GestureDetector(onTap: () => g.paused = true, child: const _RoundIcon(Icons.pause))),
              if (g.state == 'title' && !_has('title') && '${g.settings['title'] ?? ''}'.isNotEmpty)
                _Card(title: '${g.settings['title']}', sub: '${g.settings['subtitle'] ?? ''}', button: 'Play', onTap: g.start),
              if (g.paused && g.state == 'play' && !_has('paused'))
                _Card(title: 'PAUSED', sub: '', button: 'Resume', onTap: () => g.paused = false),
              if ((g.state == 'over' && !_has('over')) || (g.state == 'win' && !_has('win') && !_has('over')))
                _Card(
                  title: g.state == 'win' ? 'YOU WIN!' : 'GAME OVER',
                  sub: '${formatNumber(g.numVar('score'))} points${g.vars.containsKey('best') ? (g.newBest ? ' · new best!' : ' · best ${formatNumber(g.numVar('best'))}') : ''}',
                  button: 'Play again', onTap: g.start),
            ]),
          ),
        );
      }),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(color: const Color(0xCC000000), borderRadius: BorderRadius.circular(24)),
        child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16, decoration: TextDecoration.none)),
      );
}

class _RoundIcon extends StatelessWidget {
  const _RoundIcon(this.icon);
  final IconData icon;
  @override
  Widget build(BuildContext context) => Container(width: 42, height: 42, decoration: const BoxDecoration(color: Color(0x66000000), shape: BoxShape.circle), child: Icon(icon, color: Colors.white));
}

/// The title and game-over screens: a big title, a line under it and a button.
class _Card extends StatelessWidget {
  const _Card({required this.title, required this.sub, required this.button, required this.onTap});
  final String title, sub, button;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          color: const Color(0x8C000000),
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w900, letterSpacing: 1, decoration: TextDecoration.none, shadows: [Shadow(color: Color(0x66000000), blurRadius: 12)])),
            if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(sub, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xE6FFFFFF), fontSize: 16, fontWeight: FontWeight.w600, decoration: TextDecoration.none))),
            const SizedBox(height: 36),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 44, vertical: 16),
              decoration: BoxDecoration(color: const Color(0xFFFFD23D), borderRadius: BorderRadius.circular(18), boxShadow: const [BoxShadow(color: Color(0x66FFD23D), blurRadius: 20)]),
              child: Text('▶  $button', style: const TextStyle(color: Color(0xFF1B1B1B), fontSize: 20, fontWeight: FontWeight.w900, decoration: TextDecoration.none)),
            ),
            const SizedBox(height: 12),
            const Text('or tap anywhere', style: TextStyle(color: Color(0x99FFFFFF), fontSize: 13, decoration: TextDecoration.none)),
          ]),
        ),
      );
}

/// Draws the game: the background, the objects in layer order (shapes, emoji, pictures, text, bars), particles,
/// darkness at night, then the HUD for the screen being shown, the touch controls and floating text.
class GamePainter extends CustomPainter {
  GamePainter(this.g, this.repaint);
  final PocketGame g;
  final VoidCallback repaint;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = g.background);
    final z = g.zoom;
    canvas.save();
    final sh = g.shake > 0 ? Offset((_rng.nextDouble() - 0.5) * g.shake, (_rng.nextDouble() - 0.5) * g.shake) : Offset.zero;
    canvas.translate(size.width / 2 + sh.dx, size.height / 2 + sh.dy);
    canvas.scale(z);
    canvas.translate(-g.camX, -g.camY);
    final world = g.objects.where((o) => !o.ui && o.shown && !o.dead).toList()..sort((a, b) => a.layer.compareTo(b.layer));
    for (final o in world) {
      if (o.invuln > 0 && (o.invuln * 10).floor().isOdd) continue; // (blinks while it can't be hurt)
      _drawObject(canvas, o, Offset(o.x, o.y), 1, o.half);
    }
    for (final f in g.worldOverlays) { f(canvas); }
    for (final p in g.particles) {
      final k = (p.life / p.full).clamp(0.0, 1.0), r = p.size * (p.shrink ? math.max(0.2, k) : p.grow ? 1 + (1 - k) * 1.5 : 1);
      final paint = Paint()..color = p.color.withValues(alpha: (p.alpha * (p.full >= 1 ? math.min(1.0, k * 2) : k)).clamp(0.0, 1.0));
      if (p.stretch > 0) { canvas.drawLine(p.p, p.p - p.v * 0.012 * p.stretch, paint..strokeWidth = r * 0.6); }
      else if (p.round) { canvas.drawCircle(p.p, r, paint); } else { canvas.drawRect(Rect.fromCenter(center: p.p, width: r * 1.4, height: r * 0.8), paint); }
    }
    for (final o in world) { _drawBars(canvas, o); }
    canvas.restore();
    if (g.darkness > 0) canvas.drawRect(Offset.zero & size, Paint()..color = Color.fromRGBO(0, 0, 20, g.darkness.clamp(0.0, 0.95)));
    final hud = g.objects.where((o) => o.ui && o.shown && !o.dead && g.onScreen(o)).toList();
    int depth(GameObject o) { var n = 0; for (var q = o.parent; q != null; q = q.parent) { n++; } return n; }
    hud.sort((a, b) { final l = a.layer.compareTo(b.layer); return l != 0 ? l : depth(a).compareTo(depth(b)); });
    for (final o in hud) {
      final dim = numOf(o.data['dimBehind']);
      if (dim > 0 && o.visible) canvas.drawRect(Offset.zero & size, Paint()..color = Color.fromRGBO(0, 0, 0, dim)); // (a popup or sheet darkens what's behind it)
      if (g.hudIds.contains(o.id)) continue; // (a native widget draws it, over the canvas)
      final r = g.uiRect(o);
      _drawObject(canvas, o, r.center, g.uiK, Size(r.width / 2 / g.uiK, r.height / 2 / g.uiK));
      final cd = numOf(o.data['cooldown']);
      if (cd > 0) canvas.drawArc(r, -math.pi / 2, math.pi * 2 * cd, true, Paint()..color = const Color(0x73000000));
    }
    if (g.state == 'play' && !g.paused) _drawControls(canvas);
    for (final f in g.overlays) { f(canvas); }
    for (final f in g.floats) {
      final tp = TextPainter(text: TextSpan(text: f.text, style: TextStyle(color: f.color.withValues(alpha: f.life.clamp(0.0, 1.0)), fontSize: f.size, fontWeight: FontWeight.w900, shadows: const [Shadow(color: Color(0x88000000), blurRadius: 4)])), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, f.at - Offset(tp.width / 2, tp.height / 2));
    }
  }

  /// The joystick (where the thumb is) and the jump / fire / arrow buttons.
  void _drawControls(Canvas canvas) {
    final st = g.stick;
    if (st != null) {
      final r = 50.0 * g.uiK, d = st.at - st.start, k = d.distance > r ? d / d.distance * r : d;
      canvas.drawCircle(st.start, r, Paint()..color = const Color(0x33FFFFFF));
      canvas.drawCircle(st.start, r, Paint()..color = const Color(0x55FFFFFF)..style = PaintingStyle.stroke..strokeWidth = 2);
      canvas.drawCircle(st.start + k, r * 0.45, Paint()..color = const Color(0x88FFFFFF));
    } else if (g.settings['joystick'] == true && g.time < 4) {
      final c = Offset(g.safe.left + 90, g.screen.height - g.safe.bottom - 110);
      canvas.drawCircle(c, 50 * g.uiK, Paint()..color = Color.fromRGBO(255, 255, 255, 0.12 * (1 - g.time / 4)));
    }
    for (final b in g.buttons) {
      canvas.drawCircle(b.at, b.r, Paint()..color = b.finger != null ? const Color(0x88FFFFFF) : const Color(0x44FFFFFF));
      canvas.drawCircle(b.at, b.r, Paint()..color = const Color(0x66FFFFFF)..style = PaintingStyle.stroke..strokeWidth = 2);
      final tp = TextPainter(text: TextSpan(text: b.label, style: TextStyle(color: Colors.white, fontSize: b.label.length > 2 ? b.r * 0.36 : b.r * 0.6, fontWeight: FontWeight.w900)), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, b.at - Offset(tp.width / 2, tp.height / 2));
    }
  }

  /// Health / hunger bars over an object.
  void _drawBars(Canvas canvas, GameObject o) {
    if (o.bars.isEmpty) return;
    final h = o.half, w = math.max(28.0, h.width * 2);
    var y = o.y - h.height - 10;
    for (final (k, c) in o.bars.values) {
      final r = Rect.fromLTWH(o.x - w / 2, y, w, 5);
      canvas.drawRRect(RRect.fromRectAndRadius(r.inflate(1), const Radius.circular(3)), Paint()..color = const Color(0x99000000));
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(r.left, r.top, r.width * k.clamp(0.0, 1.0), r.height), const Radius.circular(3)), Paint()..color = c);
      y -= 8;
    }
  }

  void _drawObject(Canvas canvas, GameObject o, Offset at, double k, Size half) {
    final pop = numOf(o.data['pop']);
    if (pop > 0) o.data['pop'] = math.max(0.0, pop - 1 / 60);
    final bump = 1 + pop * 1.2, alpha = o.alpha.clamp(0.0, 1.0);
    if (alpha <= 0) return;
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(o.rz * math.pi / 180);
    canvas.scale(o.sx.sign * k * bump, o.sy.sign * k * bump); // (the size is in half: stretched HUD objects fill their row)
    final flash = numOf(o.data['flash']) > 0;
    if (flash) o.data['flash'] = numOf(o.data['flash']) - 1 / 60;
    final w = half.width * 2, h = half.height * 2;
    final s = o.shape;
    if (s != null) _drawShape(canvas, o, s, w, h, flash, alpha);
    final sp = o.sprite;
    if (sp != null && '${sp['src'] ?? ''}'.isNotEmpty) {
      final img = Sprites.of('${sp['src']}', repaint);
      if (img != null) {
        canvas.save();
        if (o.data['flipX'] == true) canvas.scale(-1, 1);
        canvas.drawImageRect(img, Rect.fromLTWH(0, 0, img.width.toDouble(), img.height.toDouble()), Rect.fromCenter(center: Offset.zero, width: w, height: h), Paint()..color = Color.fromRGBO(255, 255, 255, alpha)..filterQuality = FilterQuality.medium);
        canvas.restore();
      } else if (s == null) {
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: h), const Radius.circular(8)), Paint()..color = Color.fromRGBO(255, 255, 255, 0.25 * alpha));
      }
    }
    final b = o.bar;
    if (b != null) {
      final v = (g.numVar(strOf(b['var'], 'xp')) / math.max(1e-6, numOf(b['max'], 100))).clamp(0.0, 1.0), rad = Radius.circular(numOf(b['radius'], 6));
      final r = Rect.fromCenter(center: Offset.zero, width: w, height: h);
      canvas.drawRRect(RRect.fromRectAndRadius(r, rad), Paint()..color = (colorOf(b['bg']) ?? const Color(0x33FFFFFF)).withValues(alpha: alpha));
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(r.left, r.top, r.width * v, r.height), rad), Paint()..color = (colorOf(b['fill']) ?? const Color(0xFF5DFF8A)).withValues(alpha: alpha));
    }
    final t = o.text;
    if (t != null && '${t['value'] ?? ''}'.isNotEmpty) {
      final align = '${t['align'] ?? 'center'}', color = colorOf(t['color']) ?? Colors.white;
      final wrap = numOf(t['wrap']);
      final tp = TextPainter(
        text: TextSpan(text: g.fill('${t['value']}', o), style: TextStyle(color: color.withValues(alpha: color.a * alpha), fontSize: numOf(t['size'], 16), fontWeight: FontWeight.values[((numOf(t['weight'], 800) ~/ 100) - 1).clamp(0, 8)])),
        textDirection: TextDirection.ltr, textAlign: align == 'left' ? TextAlign.left : align == 'right' ? TextAlign.right : TextAlign.center,
      )..layout(maxWidth: wrap > 0 ? wrap : double.infinity);
      if (o.sx < 0) canvas.scale(-1, 1);
      final dx = s == null ? (align == 'left' ? 0.0 : align == 'right' ? -tp.width : -tp.width / 2) : -tp.width / 2; // (text on a shape sits in its middle)
      tp.paint(canvas, Offset(dx, -tp.height / 2));
    }
    canvas.restore();
  }

  void _drawShape(Canvas canvas, GameObject o, Map<String, dynamic> s, double w, double h, bool flash, double alpha) {
    final type = '${s['type'] ?? 'rect'}', r = math.min(w, h) / 2;
    if (type == 'emoji') {
      canvas.save();
      if (o.data['flipX'] == true) canvas.scale(-1, 1);
      final tp = TextPainter(text: TextSpan(text: strOf(s['emoji'], '⭐'), style: TextStyle(fontSize: h * 0.92, color: Color.fromRGBO(0, 0, 0, alpha))), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
      canvas.restore();
      return;
    }
    final path = Path();
    void poly(List<List<double>> pts) { for (var i = 0; i < pts.length; i++) { final x = pts[i][0] * w / 2, y = pts[i][1] * h / 2; i == 0 ? path.moveTo(x, y) : path.lineTo(x, y); } path.close(); }
    switch (type) {
      case 'circle': path.addOval(Rect.fromCircle(center: Offset.zero, radius: r));
      case 'ring': path.addOval(Rect.fromCircle(center: Offset.zero, radius: r)); path.addOval(Rect.fromCircle(center: Offset.zero, radius: r * (1 - numOf(s['thickness'], 0.3)).clamp(0.1, 0.95))); path.fillType = PathFillType.evenOdd;
      case 'star':
        final n = numOf(s['points'], 5).toInt().clamp(3, 12), inner = numOf(s['inner'], 0.45);
        for (var i = 0; i < n * 2; i++) {
          final a = -math.pi / 2 + i * math.pi / n, rr = i.isEven ? 1.0 : inner;
          final pt = Offset(math.cos(a) * w / 2 * rr, math.sin(a) * h / 2 * rr);
          i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
        }
        path.close();
      case 'triangle': poly([[0, -1], [1, 1], [-1, 1]]);
      case 'ellipse': path.addOval(Rect.fromCenter(center: Offset.zero, width: w, height: h));
      case 'diamond': poly([[0, -1], [1, 0], [0, 1], [-1, 0]]);
      case 'hexagon': poly([for (var i = 0; i < 6; i++) [math.cos(i * math.pi / 3), math.sin(i * math.pi / 3)]]);
      case 'pentagon': poly([for (var i = 0; i < 5; i++) [math.cos(-math.pi / 2 + i * 2 * math.pi / 5), math.sin(-math.pi / 2 + i * 2 * math.pi / 5)]]);
      case 'cross': { const t = 0.34; poly([[-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t], [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t]]); }
      case 'arrow': poly([[-1, -0.35], [0.2, -0.35], [0.2, -1], [1, 0], [0.2, 1], [0.2, 0.35], [-1, 0.35]]);
      case 'capsule' || 'pill': path.addRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: h), Radius.circular(r)));
      case 'heart':
        path..moveTo(0, h * 0.35)..cubicTo(-w * 0.55, -h * 0.05, -w * 0.45, -h * 0.55, 0, -h * 0.22)..cubicTo(w * 0.45, -h * 0.55, w * 0.55, -h * 0.05, 0, h * 0.35)..close();
      case 'line': canvas.drawLine(Offset(-w / 2, 0), Offset(w / 2, 0), Paint()..color = (colorOf(s['stroke']) ?? colorOf(s['fill']) ?? Colors.white).withValues(alpha: alpha)..strokeWidth = numOf(s['lineWidth'], 3)..strokeCap = StrokeCap.round); return;
      case 'polygon':
        final pts = (s['points'] as List? ?? const []).map((q) => q is List && q.length >= 2 ? Offset(numOf(q[0]), numOf(q[1])) : Offset.zero).toList();
        if (pts.isNotEmpty) { path.addPolygon(pts, true); } else { path.addRect(Rect.fromCenter(center: Offset.zero, width: w, height: h)); }
      default: path.addRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: h), Radius.circular(numOf(s['radius']).clamp(0, math.min(w, h) / 2).toDouble())));
    }
    final fill = flash ? Colors.white : colorOf(s['fill']), fill2 = colorOf(s['fill2']), stroke = colorOf(s['stroke']), glow = numOf(s['glow']);
    if (s['shadow'] == true && fill != null) canvas.drawShadow(path, Colors.black, 6, false);
    if (glow > 0 && (fill ?? stroke) != null) canvas.drawPath(path, Paint()..color = (fill ?? stroke)!.withValues(alpha: 0.7 * alpha)..maskFilter = MaskFilter.blur(BlurStyle.normal, glow / 2));
    if (fill != null) {
      final paint = Paint()..color = fill.withValues(alpha: fill.a * alpha);
      if (fill2 != null && !flash) paint.shader = LinearGradient(colors: [fill.withValues(alpha: fill.a * alpha), fill2.withValues(alpha: fill2.a * alpha)], begin: Alignment.topCenter, end: Alignment.bottomCenter).createShader(Rect.fromCenter(center: Offset.zero, width: w, height: h));
      canvas.drawPath(path, paint);
    }
    if (stroke != null) canvas.drawPath(path, Paint()..color = stroke.withValues(alpha: stroke.a * alpha)..style = PaintingStyle.stroke..strokeWidth = numOf(s['lineWidth'], 2));
    if (s['emoji'] != null) {
      final tp = TextPainter(text: TextSpan(text: '${s['emoji']}', style: TextStyle(fontSize: math.min(w, h) * 0.8)), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(GamePainter old) => true;
}

/// Rules: WHEN something happens (game starts, every few seconds, tapped, touched by a tag, jump / fire button, swipe,
/// a variable reaches a value, destroyed), IF a variable test passes, DO a list of actions.
class Rules extends Component with Toucher {
  Rules(this.p) {
    rules = [for (final r in (p['rules'] as List? ?? const [])) if (r is Map) {...r.cast<String, dynamic>(), '_t': 0.0, '_fired': false, '_was': false}];
  }
  final Map<String, dynamic> p;
  late final List<Map<String, dynamic>> rules;
  @override
  bool get always => true;
  bool check(Map<String, dynamic> r, PocketGame g, [String? fallback]) {
    final k = strOf(r['ifVar'], fallback ?? '');
    if (k.isEmpty) return true;
    final v = g.numVar(k), n = numOf(r['ifValue']);
    return switch (strOf(r['ifOp'], '>=')) { '<=' => v <= n, '==' => v == n, '<' => v < n, '>' => v > n, _ => v >= n };
  }
  void fire(Map<String, dynamic> r, GameObject e, PocketGame g, [GameObject? other]) {
    if ((onOf(r['once']) && r['_fired'] == true) || !check(r, g)) return;
    r['_fired'] = true;
    for (final a in (r['do'] as List? ?? const [])) { if (a is Map) g.runAction(e, {'sound': 'none', ...a.cast<String, dynamic>()}, other); }
  }
  @override
  bool cares(GameObject other) => rules.any((r) => r['when'] == 'touched by tag' && other.has(strOf(r['tag'], 'player')));
  @override
  void start(GameObject e, PocketGame g) { for (final r in rules) { if (r['when'] == 'game starts') fire(r, e, g); } }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    final playing = g.state == 'play' && !g.paused;
    for (final r in rules) {
      final when = strOf(r['when']);
      if (!playing && !(when == 'tapped' && e.ui)) continue;
      switch (when) {
        case 'every few seconds':
          r['_t'] = numOf(r['_t']) + dt;
          if (numOf(r['_t']) >= math.max(0.05, numOf(r['seconds'], 1))) { r['_t'] = 0.0; fire(r, e, g); }
        case 'tapped': if (e.shown && g.tapsOn(e).isNotEmpty) fire(r, e, g);
        case 'jump button': if (g.pressed.contains('jump')) fire(r, e, g);
        case 'fire button': if (g.pressed.contains('action')) fire(r, e, g);
        case 'swipe': if (g.pressed.contains('swipe:${strOf(r['dir'], 'up')}')) fire(r, e, g);
        case 'variable reaches':
          final now = check(r, g, 'score');
          if (now && r['_was'] != true) { r['_was'] = true; for (final a in (r['do'] as List? ?? const [])) { if (a is Map) g.runAction(e, {'sound': 'none', ...a.cast<String, dynamic>()}); } }
          else if (!now) { r['_was'] = false; }
      }
    }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { for (final r in rules) { if (r['when'] == 'touched by tag' && other.has(strOf(r['tag'], 'player'))) fire(r, e, g, other); } }
  @override
  void gone(GameObject e, PocketGame g) { for (final r in rules) { if (r['when'] == 'destroyed') fire(r, e, g); } }
}

// ---- UI containers and the app's bars in games ----

/// An icon: an emoji as itself, or an icon name as the nearest Material icon.
Widget hudIcon(String icon, double size, Color color) {
  if (icon.runes.any((r) => r > 0x2000)) return Text(icon, style: TextStyle(fontSize: size * 0.9, decoration: TextDecoration.none));
  const m = {'home': Icons.home_rounded, 'shop': Icons.storefront_rounded, 'store': Icons.storefront_rounded, 'user': Icons.person_rounded, 'profile': Icons.person_rounded, 'settings': Icons.settings_rounded, 'gear': Icons.settings_rounded,
    'star': Icons.star_rounded, 'bell': Icons.notifications_rounded, 'notifications': Icons.notifications_rounded, 'search': Icons.search_rounded, 'menu': Icons.menu_rounded, 'play': Icons.play_arrow_rounded, 'trophy': Icons.emoji_events_rounded,
    'heart': Icons.favorite_rounded, 'chat': Icons.chat_bubble_rounded, 'map': Icons.map_rounded, 'info': Icons.info_rounded, 'back': Icons.arrow_back_rounded, 'close': Icons.close_rounded, 'plus': Icons.add_rounded, 'list': Icons.list_rounded,
    'bag': Icons.backpack_rounded, 'inventory': Icons.backpack_rounded, 'friends': Icons.people_rounded, 'users': Icons.people_rounded, 'edit': Icons.edit_rounded, 'share': Icons.share_rounded, 'trash': Icons.delete_rounded, 'help': Icons.help_rounded};
  return Icon(m[icon] ?? Icons.circle_outlined, size: size, color: color);
}
/// "Label | icon | target" lines.
List<List<String>> hudLines(Object? v) => [for (final l in strOf(v).split('\n')) if (l.trim().isNotEmpty) l.split('|').map((x) => x.trim()).toList()];

/// The page variable's history (Back goes to the page before).
class PageHistory {
  PageHistory(this.g, this.key) { last = strOf(g.vars[key]); }
  final PocketGame g;
  final String key;
  final List<String> stack = [];
  String last = '';
  static PageHistory of(PocketGame g, String key) => (g.systems['pages:$key'] ??= PageHistory(g, key)) as PageHistory;
  void watch() { final now = strOf(g.vars[key]); if (now != last) { if (last.isNotEmpty && (stack.isEmpty || stack.last != now)) stack.add(last); if (stack.isNotEmpty && stack.last == now) stack.removeLast(); last = now; } }
}

/// Popup and Bottom Sheet: the object (and what's inside it) opens on a message and closes on another, after some seconds,
/// or with a tap outside; a popup pops in, a sheet slides up; the game behind it darkens.
class GamePopup extends Component {
  GamePopup(this.p, this.sheet);
  final Map<String, dynamic> p;
  final bool sheet;
  double openedAt = -1, baseY = 0;
  bool hooked = false;
  @override
  bool get always => true;
  void open(GameObject e, PocketGame g) {
    if (e.visible) return;
    e.visible = true; openedAt = g.time;
    if (sheet) { e.y = baseY + 600; g.tween(e, 'y', baseY, 0.35, curve: 'outCubic'); } else { e.sx = e.sy = 0.6; g.tween(e, 'sx', 1, 0.3, curve: 'outBack'); g.tween(e, 'sy', 1, 0.3, curve: 'outBack'); }
    g.sfx('click');
  }
  void close(GameObject e, PocketGame g) { if (!e.visible) return; e.visible = false; if (strOf(p['message']).isNotEmpty) g.send('${p['message']} closed'); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!hooked) {
      hooked = true; baseY = e.y;
      e.visible = onOf(p['startOpen']);
      final openOn = strOf(p['openOn'], sheet ? 'open sheet' : 'popup'), closeOn = strOf(p['closeOn'], sheet ? 'close sheet' : 'close');
      g.on((m) { if (e.dead) return; if (m == openOn || m == '${e.name} open') { open(e, g); } else if (m == closeOn || m == '${e.name} close') { close(e, g); } });
    }
    e.data['dimBehind'] = e.visible && (sheet ? p['dim'] != false : p['modal'] != false) ? 0.45 : 0.0;
    if (!e.visible) return;
    g.tapTargets.add(e);
    final auto = numOf(p['autoClose']);
    if (auto > 0 && openedAt >= 0 && g.time - openedAt >= auto) close(e, g);
    if (sheet || onOf(p['tapCloses'])) { for (final t in g.taps) { if (!g.uiRect(e).contains(t.screen) && g.time - openedAt > 0.2) { close(e, g); break; } } }
  }
}

/// Panel: a window with a title bar (and ✕ to close); opens / closes on messages.
class GamePanel extends Component {
  GamePanel(this.p);
  final Map<String, dynamic> p;
  bool hooked = false;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (hooked) {
      if (p['closeButton'] != false && e.visible) {
        final r = g.uiRect(e), x = Rect.fromCircle(center: Offset(r.right - 22 * g.uiK, r.top + numOf(p['headerH'], 44) / 2 * g.uiK), radius: 18 * g.uiK);
        for (final t in g.taps) { if (x.contains(t.screen)) { e.visible = false; if (strOf(p['closeMessage']).isNotEmpty) g.send(strOf(p['closeMessage'])); g.sfx('click'); } }
      }
      return;
    }
    hooked = true;
    if (strOf(p['openOn']).isNotEmpty || strOf(p['closeOn']).isNotEmpty) g.on((m) { if (m == strOf(p['openOn']) && strOf(p['openOn']).isNotEmpty) e.visible = true; if (m == strOf(p['closeOn']) && strOf(p['closeOn']).isNotEmpty) e.visible = false; });
    g.overlays.add((c) {
      if (e.dead || !e.shown || !g.onScreen(e)) return;
      final r = g.uiRect(e), k = g.uiK, title = g.fill(strOf(p['title']), e), hh = numOf(p['headerH'], 44) * k;
      if (title.isNotEmpty) {
        final tp = TextPainter(text: TextSpan(text: title, style: TextStyle(color: colorOf(p['titleColor']) ?? Colors.white, fontSize: numOf(p['titleSize'], 17) * k, fontWeight: FontWeight.w800)), textDirection: TextDirection.ltr)..layout(maxWidth: r.width - 60 * k);
        final x = p['titleAlign'] == 'center' ? r.center.dx - tp.width / 2 : r.left + 16 * k;
        tp.paint(c, Offset(x, r.top + hh / 2 - tp.height / 2));
      }
      if (p['closeButton'] != false) {
        final cc = Offset(r.right - 22 * k, r.top + hh / 2), pen = Paint()..color = const Color(0xCCFFFFFF)..strokeWidth = 2.2 * k..strokeCap = StrokeCap.round;
        c.drawLine(cc + Offset(-6 * k, -6 * k), cc + Offset(6 * k, 6 * k), pen); c.drawLine(cc + Offset(6 * k, -6 * k), cc + Offset(-6 * k, 6 * k), pen);
      }
    });
  }
}

/// Layout Group: lays its children out in a column, a row or a grid, with spacing and padding.
class LayoutGroup extends Component {
  LayoutGroup(this.p);
  final Map<String, dynamic> p;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final kids = [for (final o in g.objects) if (o.parent == e && !o.dead && o.visible) o]..sort((a, b) => a.layer != b.layer ? a.layer.compareTo(b.layer) : a.uid.compareTo(b.uid));
    if (kids.isEmpty) return;
    final dir = strOf(p['direction'], 'vertical'), gap = numOf(p['spacing'], 12), pad = numOf(p['pad'], 12), cols = math.max(1, numOf(p['columns'], 3).toInt());
    final box = e.half;
    if (dir == 'grid') {
      final cw = (box.width * 2 - pad * 2 - gap * (cols - 1)) / cols;
      var y = pad;
      for (var i = 0; i < kids.length; i += cols) {
        final row = kids.sublist(i, math.min(kids.length, i + cols));
        final rh = row.map((o) => o.half.height * 2).fold<double>(0, math.max);
        for (var j = 0; j < row.length; j++) { final o = row[j]; o.anchor = 'top-left'; o.x = pad + j * (cw + gap) + cw / 2; o.y = y + rh / 2; }
        y += rh + gap;
      }
      return;
    }
    final total = kids.fold<double>(0, (n, o) => n + (dir == 'horizontal' ? o.half.width * 2 : o.half.height * 2)) + gap * (kids.length - 1);
    var at = strOf(p['justify'], 'center') == 'start' ? pad : strOf(p['justify'], 'center') == 'end' ? (dir == 'horizontal' ? box.width * 2 : box.height * 2) - pad - total : ((dir == 'horizontal' ? box.width * 2 : box.height * 2) - total) / 2;
    for (final o in kids) {
      o.anchor = 'top-left';
      final w = o.half.width * 2, h = o.half.height * 2;
      if (dir == 'horizontal') { o.x = at + w / 2; o.y = box.height; at += w + gap; } else { o.x = box.width; o.y = at + h / 2; at += h + gap; }
    }
  }
}

/// Scroll View: drag inside it to scroll what's in it (up and down, or sideways).
class ScrollBox extends Component {
  ScrollBox(this.p);
  final Map<String, dynamic> p;
  double off = 0, v = 0;
  final Map<int, Offset> base = {};
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final kids = [for (final o in g.objects) if (o.parent == e && !o.dead) o];
    for (final o in kids) { base.putIfAbsent(o.uid, () => Offset(o.x, o.y)); }
    if (kids.isEmpty) return;
    final horiz = p['direction'] == 'horizontal', r = g.uiRect(e), k = g.uiK;
    final ptr = g.pointers.values.where((q) => r.contains(q.start)).firstOrNull;
    if (ptr != null) { g.tapTargets.add(e); final d = g.dragDelta / k; v = (horiz ? -d.dx : -d.dy) / math.max(dt, 1e-3); off += horiz ? -d.dx : -d.dy; } else { v *= math.exp(-5 * dt); off += v * dt; }
    final extent = kids.map((o) => (horiz ? base[o.uid]!.dx + o.half.width : base[o.uid]!.dy + o.half.height)).fold<double>(0, math.max), view = horiz ? e.half.width * 2 : e.half.height * 2;
    final maxOff = math.max(0.0, extent - view / 2 + numOf(p['padding'], 12));
    off = off.clamp(0.0, maxOff);
    for (final o in kids) { final b = base[o.uid]!; if (horiz) { o.x = b.dx - off; } else { o.y = b.dy - off; } o.visible = true; }
  }
}

/// Popover: a small menu next to it (on a tap or a message): each row sends its message (and can set a variable).
class Popover extends Component {
  Popover(this.p);
  final Map<String, dynamic> p;
  bool open = false, hooked = false;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!hooked) {
      hooked = true;
      g.on((m) { if (m == strOf(p['message'], 'more')) open = !open; });
      g.panels.add((context) {
        if (!open || e.dead || !e.shown) return const SizedBox.shrink();
        final r = g.uiRect(e), rows = hudLines(p['items']), w = numOf(p['width'], 200) * g.uiK;
        final below = r.bottom + rows.length * 46 < g.screen.height - 20;
        return Stack(children: [
          Positioned.fill(child: GestureDetector(onTap: () => open = false, behavior: HitTestBehavior.translucent)),
          Positioned(left: (r.center.dx - w / 2).clamp(8.0, math.max(8.0, g.screen.width - w - 8)), top: below ? r.bottom + 6 : null, bottom: below ? null : g.screen.height - r.top + 6, width: w,
            child: Container(decoration: BoxDecoration(color: const Color(0xFF232842), borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 16)]),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                for (final row in rows)
                  GestureDetector(onTap: () { open = false; final pv = strOf(p['pickVar']); if (pv.isNotEmpty) g.setVar(pv, row[0]); g.send(row.length > 1 && row[1].isNotEmpty ? row[1] : row[0]); g.sfx('click'); },
                    child: Container(height: 46, padding: const EdgeInsets.symmetric(horizontal: 14), color: Colors.transparent, child: Row(children: [
                      if (row.length > 2) Padding(padding: const EdgeInsets.only(right: 10), child: hudIcon(row[2], 18, Colors.white)),
                      Expanded(child: Text(row[0], style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600, decoration: TextDecoration.none))),
                    ]))),
              ]))),
        ]);
      });
    }
    g.tapTargets.add(e);
    if (strOf(p['opensOn'], 'tap') == 'tap') { for (final _ in g.tapsOn(e)) { open = !open; g.sfx('click'); } }
  }
}

/// App Bar in a game: the page's title along the top, ☰ for the side menu, and its buttons (a message or page:name).
class GameAppBar extends Component {
  GameAppBar(this.p);
  final Map<String, dynamic> p;
  bool hooked = false;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) => _hook(e, g);
  void _hook(GameObject e, PocketGame g) {
    if (hooked) return;
    hooked = true; e.shape = null; e.text = null;
    final key = strOf(p['var'], 'page');
    final titles = {for (final l in strOf(p['titles']).split('\n')) if (l.contains('=')) l.split('=')[0].trim(): l.split('=').sublist(1).join('=').trim()};
    g.panels.add((context) {
      if (e.dead || !e.shown || !g.onScreen(e)) return const SizedBox.shrink();
      final page = strOf(g.vars[key]), bg = colorOf(p['bg']) ?? const Color(0xFF12141F), fg = colorOf(p['text']) ?? Colors.white;
      final title = strOf(p['title']).isNotEmpty ? g.fill(strOf(p['title'])) : titles[page] ?? (page.isEmpty ? strOf(g.json['name'], 'Game') : page[0].toUpperCase() + page.substring(1));
      final hist = PageHistory.of(g, key)..watch();
      final left = strOf(p['left'], 'back, else menu'), canBack = hist.stack.isNotEmpty && left.contains('back');
      final acts = hudLines(p['actions'] ?? 'bell | notifications | unread\nsearch | search');
      return Positioned(left: 0, right: 0, top: 0, child: Container(
        padding: EdgeInsets.only(top: g.safe.top), color: bg,
        child: SizedBox(height: 56, child: Row(children: [
          if (canBack) IconButton(onPressed: () { g.setVar(key, hist.stack.removeLast()); hist.last = strOf(g.vars[key]); }, icon: Icon(Icons.arrow_back_rounded, color: fg))
          else if (left.contains('menu')) IconButton(onPressed: () => g.send(strOf(p['menuMessage'], 'menu')), icon: Icon(Icons.menu_rounded, color: fg))
          else const SizedBox(width: 16),
          Expanded(child: Text(title, textAlign: p['titleAlign'] == 'center' ? TextAlign.center : TextAlign.left, style: TextStyle(color: fg, fontSize: numOf(p['titleSize'], 19), fontWeight: FontWeight.w800, decoration: TextDecoration.none))),
          for (final a in acts.take(4))
            IconButton(onPressed: () { final does = a.length > 1 ? a[1] : a[0]; if (does.startsWith('page:')) { g.setVar(key, does.substring(5)); } else { g.send(does); } }, icon: hudIcon(a[0], 24, colorOf(p['iconColor']) ?? fg)),
        ])),
      ));
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) => _hook(e, g);
}

/// Bottom Nav in a game: tabs along the bottom; tapping one sets the page variable.
class GameBottomNav extends Component {
  GameBottomNav(this.p);
  final Map<String, dynamic> p;
  bool hooked = false;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) => _hook(e, g);
  void _hook(GameObject e, PocketGame g) {
    if (hooked) return;
    hooked = true; e.shape = null; e.text = null;
    final key = strOf(p['var'], 'page'), tabs = hudLines(p['tabs'] ?? 'Home | home | home\nShop | shop | shop\nProfile | user | profile');
    if (strOf(g.vars[key]).isEmpty && tabs.isNotEmpty) { final i = (numOf(p['start'], 1).toInt() - 1).clamp(0, tabs.length - 1); g.setVar(key, tabs[i].length > 2 ? tabs[i][2] : tabs[i][0].toLowerCase()); }
    g.panels.add((context) {
      if (e.dead || !e.shown || !g.onScreen(e)) return const SizedBox.shrink();
      final page = strOf(g.vars[key]), on = colorOf(p['activeColor']) ?? const Color(0xFF4FA3FF), off = colorOf(p['idleColor']) ?? const Color(0xFF8B90A5);
      return Positioned(left: 0, right: 0, bottom: 0, child: Container(
        padding: EdgeInsets.only(bottom: g.safe.bottom), color: colorOf(p['barColor']) ?? const Color(0xFF12141F),
        child: SizedBox(height: 62, child: Row(children: [
          for (final t in tabs)
            Expanded(child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () { g.setVar(key, t.length > 2 ? t[2] : t[0].toLowerCase()); g.sfx('click'); }, child: Builder(builder: (_) {
              final sel = page == (t.length > 2 ? t[2] : t[0].toLowerCase()), c = sel ? on : off;
              return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                hudIcon(t.length > 1 ? t[1] : 'circle', 24, c),
                if (p['labels'] != 'never') Text(t[0], style: TextStyle(color: c, fontSize: 11.5, fontWeight: sel ? FontWeight.w800 : FontWeight.w600, decoration: TextDecoration.none)),
              ]);
            }))),
        ])),
      ));
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) => _hook(e, g);
}

/// Side Menu in a game: slides in on its message (☰), with a header and rows that open a page or send a message (msg:name).
class GameSideMenu extends Component {
  GameSideMenu(this.p);
  final Map<String, dynamic> p;
  bool hooked = false, open = false;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) => _hook(e, g);
  void _hook(GameObject e, PocketGame g) {
    if (hooked) return;
    hooked = true; e.shape = null; e.text = null;
    final key = strOf(p['var'], 'page'), msg = strOf(p['message'], 'menu');
    g.on((m) { if (m == msg || m == '$msg open') open = m == msg ? !open : true; if (m == '$msg close') open = false; });
    void pick(List<String> row) {
      open = false;
      final to = row.length > 2 ? row[2] : row[0].toLowerCase();
      if (to.startsWith('msg:')) { g.send(to.substring(4)); } else { g.setVar(key, to); }
      g.sfx('click');
    }
    g.panels.add((context) {
      if (!open || e.dead) return const SizedBox.shrink();
      final bg = colorOf(p['bg']) ?? const Color(0xFF151826), fg = colorOf(p['text']) ?? const Color(0xFFE8EAF2), ac = colorOf(p['accent']) ?? const Color(0xFF4FA3FF), right = p['side'] == 'right';
      final page = strOf(g.vars[key]), w = math.min(300.0, g.screen.width * 0.8);
      Widget row(List<String> r) { final sel = page == (r.length > 2 ? r[2] : r[0].toLowerCase());
        return GestureDetector(onTap: () => pick(r), child: Container(margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(color: sel ? ac.withValues(alpha: 0.18) : Colors.transparent, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [hudIcon(r.length > 1 ? r[1] : 'circle', 22, sel ? ac : fg), const SizedBox(width: 14), Text(r[0], style: TextStyle(color: sel ? ac : fg, fontSize: 16, fontWeight: FontWeight.w700, decoration: TextDecoration.none))]))); }
      return Stack(children: [
        Positioned.fill(child: GestureDetector(onTap: () => open = false, child: const ColoredBox(color: Color(0x80000000)))),
        Positioned(top: 0, bottom: 0, left: right ? null : 0, right: right ? 0 : null, width: w, child: Container(color: bg, padding: EdgeInsets.only(top: g.safe.top + 16, bottom: g.safe.bottom + 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 16), child: Row(children: [
            CircleAvatar(radius: 24, backgroundColor: ac.withValues(alpha: 0.25), child: hudIcon(strOf(p['avatar'], '🙂'), 26, fg)),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(g.fill(strOf(p['title'], 'My Game')), style: TextStyle(color: fg, fontSize: 18, fontWeight: FontWeight.w900, decoration: TextDecoration.none)),
              if (strOf(p['subtitle']).isNotEmpty) Text(g.fill(strOf(p['subtitle'])), style: TextStyle(color: fg.withValues(alpha: 0.6), fontSize: 13, decoration: TextDecoration.none)),
            ])),
          ])),
          for (final r in hudLines(p['items'] ?? 'Home | home | home\nShop | shop | shop')) row(r),
          const Spacer(),
          for (final r in hudLines(p['footer'] ?? 'Help | info | msg:help')) row(r),
        ]))),
      ]);
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) => _hook(e, g);
}

/// Back button: goes to the page before (the page variable's history), or a fallback page; hides when there's nowhere to go.
class BackButtonPart extends Component {
  BackButtonPart(this.p);
  final Map<String, dynamic> p;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final key = strOf(p['var'], 'page'), h = PageHistory.of(g, key)..watch(), fb = strOf(p['fallback']);
    if (p['hide'] != false) e.visible = h.stack.isNotEmpty || fb.isNotEmpty;
    if (e.ui) g.tapTargets.add(e);
    for (final _ in g.tapsOn(e)) {
      if (h.stack.isNotEmpty) { g.setVar(key, h.stack.removeLast()); h.last = strOf(g.vars[key]); } else if (fb.isNotEmpty) { g.setVar(key, fb); }
      g.send('go back'); g.sfx('click');
    }
  }
}

/// Tab Indicator: the Bottom Nav draws its own, so it's nothing to draw here.
class TabIndicator extends Component {
  TabIndicator(this.p);
  final Map<String, dynamic> p;
}

// makeComponent: 'uiCrosshair' => Crosshair(p), 'uiOffscreen' => OffscreenArrows(p), 'uiScreenFX' => ScreenFX(p), 'uiSaveSlots' => SaveSlots(p), 'uiTutorial' => Tutorial(p), 'uiShowIf' => ShowIf(p), 'uiAnim' => UiAnim(p), 'uiTooltip' => HudTooltip(p), 'uiNotifications' => Notifications(p), 'navItem' => NavItem(p), 'drawer' => SideDrawer(p), 'dataStat' => DataStat(p), 'netSync' => NetSync(p), 'pfLeaderboard' => LocalLeaderboard(p), 'netRoomList' => RoomList(p), 'netChat' => ChatBox(p),

// ---------------------------------------------------------------------------------------------------------------
// Game HUD: crosshair, off-screen arrows, screen effects, save slots, tutorial, Show If pages, UI animation, tooltips,
// notifications; tabs (Nav Item) and the slide-in Side Bar; Data Summary; and the online parts, played offline
// (a local leaderboard of your best scores, your own chat, an empty room list).
// ---------------------------------------------------------------------------------------------------------------

/// Text laid out for drawing on the HUD canvas (one line, cut with … when wider than maxW).
TextPainter hudTp(String t, double size, Color color, {FontWeight weight = FontWeight.w700, double maxW = double.infinity, int? maxLines = 1, TextAlign align = TextAlign.left}) =>
    TextPainter(text: TextSpan(text: t, style: TextStyle(color: color, fontSize: size, fontWeight: weight)), textDirection: TextDirection.ltr, textAlign: align, maxLines: maxLines, ellipsis: maxLines == null ? null : '…')..layout(maxWidth: maxW);
/// Draws text centred on y; align left / center / right of x.
void hudText(Canvas c, String t, double x, double y, {double size = 14, FontWeight weight = FontWeight.w700, Color color = Colors.white, String align = 'center', double maxW = double.infinity}) {
  final tp = hudTp(t, size, color, weight: weight, maxW: maxW);
  tp.paint(c, Offset(align == 'left' ? x : align == 'right' ? x - tp.width : x - tp.width / 2, y - tp.height / 2));
}
/// A colour setting (or its default).
Color hudColor(Object? v, String d) => colorOf(v) ?? colorOf(d)!;
/// The component draws the whole look itself: the object's own shape, picture and text go (its size stays, for its box).
void hudOwnLook(GameObject e) {
  final s = e.shape;
  if (s != null) e.shape = {...s, 'type': s['type'] == 'emoji' ? 'rect' : s['type'], 'fill': null, 'fill2': null, 'stroke': null, 'glow': 0, 'emoji': null, 'shadow': false};
  e.text = null; e.sprite = null;
}
/// Is a HUD object showing now (not hidden, not dead, on the screen being shown)?
bool hudLive(GameObject e, PocketGame g) => !e.dead && e.shown && g.onScreen(e);
/// A panel that draws nothing (for a component that isn't showing).
const Widget hudNothing = Positioned(left: 0, top: 0, width: 0, height: 0, child: SizedBox());
/// Canvas drawing in a panel (so it sits over other panels: a tutorial's spotlight, notifications).
class HudPainter extends CustomPainter {
  HudPainter(this.draw);
  final void Function(Canvas) draw;
  @override
  void paint(Canvas canvas, Size size) => draw(canvas);
  @override
  bool shouldRepaint(HudPainter old) => true;
}
/// A full-screen panel that draws on a canvas and lets touches through.
Widget hudCanvasPanel(void Function(Canvas) draw) => Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: HudPainter(draw))));

/// The children of an object (HUD pages, tab groups).
List<GameObject> hudKids(PocketGame g, GameObject e) => [for (final o in g.objects) if (o.parent == e && !o.dead) o];

/// Crosshair: an aiming reticle in many looks; spreads when you fire (a message) or move, and shows a hit marker on a message.
class Crosshair extends Component {
  Crosshair(this.p);
  final Map<String, dynamic> p;
  double spread = 0, hit = 0;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) {
    hudOwnLook(e);
    g.on((m) { if (e.dead) return; if (m == strOf(p['spreadOn'], 'fire')) spread = math.min(1, spread + 0.6); if (m == strOf(p['hitOn'], 'hit')) hit = 1; });
    g.overlays.add((c) => draw(c, e, g));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    var mv = 0.0;
    if (p['spreadMove'] != false) { final b = g.findAll('player').firstOrNull?.body; if (b != null) mv = math.sqrt(b.vx * b.vx + b.vy * b.vy) / 300; }
    spread = math.max(math.min(0.6, mv), spread - dt * 3); hit = math.max(0, hit - dt * 3);
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (!hudLive(e, g)) return;
    final at = g.uiRect(e).center, sz = numOf(p['size'], 10), gap = numOf(p['gap'], 5) + spread * 14, th = numOf(p['thickness'], 2), col = hudColor(p['color'], '#ffffff'), look = strOf(p['look'], 'cross + dot');
    final path = Path();
    if (look.startsWith('cross') || look == 'T') {
      for (final (dx, dy) in const [(1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)]) { if (look == 'T' && dy < 0) continue; path..moveTo(at.dx + dx * gap, at.dy + dy * gap)..lineTo(at.dx + dx * (gap + sz), at.dy + dy * (gap + sz)); }
    }
    if (look.startsWith('circle')) path.addOval(Rect.fromCircle(center: at, radius: gap + sz * 0.8));
    if (look == 'chevron') path..moveTo(at.dx - sz, at.dy + gap + sz * 0.6)..lineTo(at.dx, at.dy + gap)..lineTo(at.dx + sz, at.dy + gap + sz * 0.6);
    if (look == 'brackets') { final r = gap + sz; for (final sx in const [-1.0, 1.0]) { path..moveTo(at.dx + sx * r * 0.6, at.dy - r)..lineTo(at.dx + sx * r, at.dy - r)..lineTo(at.dx + sx * r, at.dy + r)..lineTo(at.dx + sx * r * 0.6, at.dy + r); } }
    final outline = p['outline'] != false;
    if (outline) c.drawPath(path, Paint()..color = const Color(0x99000000)..style = PaintingStyle.stroke..strokeWidth = th + 2..strokeCap = StrokeCap.round);
    c.drawPath(path, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = th..strokeCap = StrokeCap.round);
    if (look.contains('dot')) { if (outline) c.drawCircle(at, th + 1, Paint()..color = const Color(0x99000000)); c.drawCircle(at, th, Paint()..color = col); }
    if (hit > 0) {
      final hp = Paint()..color = hudColor(p['hitColor'], '#ff4d5e').withValues(alpha: hit)..strokeWidth = th + 0.5..strokeCap = StrokeCap.round;
      for (final (dx, dy) in const [(1.0, 1.0), (-1.0, 1.0), (1.0, -1.0), (-1.0, -1.0)]) { c.drawLine(at + Offset(dx * 6, dy * 6), at + Offset(dx * 13, dy * 13), hp); }
    }
  }
}

/// Off-screen Arrows: arrows at the screen edge pointing to objects you can't see (with their distance); optional markers over the ones you can.
class OffscreenArrows extends Component {
  OffscreenArrows(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) { hudOwnLook(e); g.overlays.add((c) => draw(c, e, g)); }
  /// The things it points at: where on the screen, how far from the player, and whether they're off the screen.
  List<(Offset, double, bool)> targets(GameObject e, PocketGame g) {
    final tag = strOf(p['tag'], 'enemy'), me = g.findAll('player').firstOrNull, m = numOf(p['margin'], 28), W = g.screen.width, H = g.screen.height;
    final seen = <GameObject>{};
    final list = [for (final q in [g.find(tag), ...g.findAll(tag)]) if (q != null && !q.dead && q.visible && q != e && !q.ui && seen.add(q)) q];
    final out = [for (final q in list) (g.toScreen(q.x, q.y), me == null ? 0.0 : (Offset(q.x, q.y) - Offset(me.x, me.y)).distance)]..sort((a, b) => a.$2.compareTo(b.$2));
    return [for (final (sp, d) in out.take(numOf(p['max'], 5).toInt())) (sp, d, sp.dx < m || sp.dx > W - m || sp.dy < m + g.safe.top || sp.dy > H - m - g.safe.bottom)];
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (!hudLive(e, g) || g.state != 'play') return;
    final W = g.screen.width, H = g.screen.height, m = numOf(p['margin'], 28), sz = numOf(p['size'], 18), col = hudColor(p['color'], '#ff4d5e'), look = strOf(p['look'], 'arrow'), me = g.findAll('player').firstOrNull;
    for (final (sp, d, off) in targets(e, g)) {
      if (!off) {
        if (onOf(p['onScreen'])) c.drawPath(Path()..moveTo(sp.dx - 7, sp.dy - 34)..lineTo(sp.dx + 7, sp.dy - 34)..lineTo(sp.dx, sp.dy - 24)..close(), Paint()..color = col);
        continue;
      }
      final dx = sp.dx - W / 2, dy = sp.dy - H / 2, a = math.atan2(dy, dx);
      final kx = (W / 2 - m) / math.max(1e-6, math.cos(a).abs()), ky = (H / 2 - m - math.max(g.safe.top, g.safe.bottom)) / math.max(1e-6, math.sin(a).abs()), k = math.min(kx, ky);
      final x = W / 2 + math.cos(a) * k, y = H / 2 + math.sin(a) * k;
      c.save(); c.translate(x, y);
      if (look == 'dot') { c.drawCircle(Offset.zero, sz * 0.45, Paint()..color = col.withValues(alpha: 0.92)); }
      else if (look == 'icon') {
        c.drawCircle(Offset.zero, sz * 0.8, Paint()..color = const Color(0x80000000));
        final tp = hudTp(strOf(p['icon'], '❗'), sz * 0.9, col); tp.paint(c, Offset(-tp.width / 2, -tp.height / 2));
        c.rotate(a); c.drawPath(Path()..moveTo(sz * 1.25, 0)..lineTo(sz * 0.85, -5)..lineTo(sz * 0.85, 5)..close(), Paint()..color = col);
      } else {
        c.rotate(a);
        final path = look == 'chevron'
            ? (Path()..moveTo(sz * 0.6, 0)..lineTo(-sz * 0.4, -sz * 0.6)..lineTo(-sz * 0.1, 0)..lineTo(-sz * 0.4, sz * 0.6)..close())
            : (Path()..moveTo(sz * 0.7, 0)..lineTo(-sz * 0.5, -sz * 0.55)..lineTo(-sz * 0.5, sz * 0.55)..close());
        c.drawPath(path, Paint()..color = col.withValues(alpha: 0.92));
        c.drawPath(path, Paint()..color = const Color(0x66000000)..style = PaintingStyle.stroke..strokeWidth = 2);
      }
      c.restore();
      if (p['distance'] != false && me != null) hudText(c, '${(d / 10).round()}m', x - math.cos(a) * sz * 1.4, y - math.sin(a) * sz * 1.4, size: 11, weight: FontWeight.w800);
    }
  }
}

/// Screen Effects: a red flash when a variable (health) drops, a pulsing vignette when it's low, a white flash and confetti on messages (and when you win).
class ScreenFX extends Component {
  ScreenFX(this.p);
  final Map<String, dynamic> p;
  double hurt = 0, flash = 0, beat = 0;
  double? last;
  /// Confetti: position, speed, turn, turn speed, size, colour, age.
  final List<List<Object>> bits = [];
  @override
  bool get always => true;
  double? value(PocketGame g) { final k = strOf(p['hurtVar'], 'hp'), v = g.vars[k]; return v == null || '$v'.isEmpty ? null : numOf(v); }
  void confetti(PocketGame g) {
    const cols = [Color(0xFFE53935), Color(0xFFFDD835), Color(0xFF43A047), Color(0xFF1E88E5), Color(0xFF8E24AA), Color(0xFFFF7043)];
    for (var i = 0; i < numOf(p['amount'], 120); i++) {
      bits.add([Offset(rand(0, g.screen.width), -20 - rand(0, 200)), Offset(rand(-80, 80), rand(80, 260)), rand(0, 6), rand(-5, 5), rand(6, 12), cols[_rng.nextInt(cols.length)], 0.0]);
    }
  }
  @override
  void start(GameObject e, PocketGame g) {
    hudOwnLook(e);
    last = value(g);
    g.on((m) {
      if (e.dead) return;
      if (m == strOf(p['flashOn'], 'flash')) flash = 1;
      if (m == strOf(p['confettiOn'], 'celebrate')) confetti(g);
      if (m == 'won' && p['confettiOnWin'] != false) confetti(g);
    });
    g.overlays.add((c) => draw(c, e, g));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final v = value(g);
    if (v != null && last != null && v < last!) { hurt = 1; g.buzz(); }
    last = v;
    hurt = math.max(0, hurt - dt * 2.2); flash = math.max(0, flash - dt * 3); beat += dt;
    for (final b in bits) {
      final age = (b[6] as double) + dt;
      final vel = (b[1] as Offset) + Offset(0, 120 * dt);
      b[6] = age; b[1] = vel;
      b[0] = (b[0] as Offset) + Offset((vel.dx + math.sin(age * 4 + (b[2] as double)) * 30) * dt, vel.dy * dt);
      b[2] = (b[2] as double) + (b[3] as double) * dt;
    }
    bits.removeWhere((b) => (b[0] as Offset).dy > g.screen.height + 30);
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (e.dead || !e.shown) return;
    final full = Offset.zero & g.screen, v = value(g), low = numOf(p['lowAt'], 25) > 0 && v != null && v <= numOf(p['lowAt'], 25) && v > 0;
    final va = math.max(hurt * 0.75, low ? 0.25 + math.sin(beat * 5) * 0.15 : 0.0), hc = hudColor(p['hurt'], '#ff2a3d');
    if (va > 0.01) c.drawRect(full, Paint()..shader = RadialGradient(colors: [hc.withValues(alpha: 0), hc.withValues(alpha: va.clamp(0.0, 1.0))], stops: const [0.45, 1]).createShader(full));
    if (flash > 0.01) c.drawRect(full, Paint()..color = hudColor(p['flashColor'], '#ffffff').withValues(alpha: flash * 0.7));
    for (final b in bits) {
      final at = b[0] as Offset, r = b[2] as double, w = b[4] as double, age = b[6] as double;
      c.save(); c.translate(at.dx, at.dy); c.rotate(r); c.scale(1, math.cos(age * 6 + r).abs());
      c.drawRect(Rect.fromCenter(center: Offset.zero, width: w, height: w * 0.6), Paint()..color = b[5] as Color);
      c.restore();
    }
  }
}

/// Save Slots: a card for each save slot (its name, when it was saved, time played); tap to load it or to save there, with a delete button.
class SaveSlots extends Component {
  SaveSlots(this.p);
  final Map<String, dynamic> p;
  /// A slot waiting for a second tap ('save' over it / 'del'), and a short note on a slot ("Saved ✓").
  (Object, String, double)? pend;
  (Object, String, double)? flash;
  @override
  bool get always => true;
  List<int> slots(PocketGame g) => [for (var i = 1; i <= (numOf(p['slots']) > 0 ? numOf(p['slots']).round() : numOf(g.settings['saveSlots'], 3).round()).clamp(1, 10); i++) i];
  String metaKey(PocketGame g, Object k) => 'pocket.slotmeta.${g.saveKey}.$k';
  Map<String, dynamic>? meta(PocketGame g, Object k) {
    if (!g.hasSave(k)) return null;
    final s = g.prefs?.getString(metaKey(g, k));
    return s == null ? {} : (jsonDecode(s) as Map).cast<String, dynamic>();
  }
  static String ago(num ms) {
    final d = DateTime.now().millisecondsSinceEpoch - ms;
    if (d < 60000) return 'just now';
    if (d < 3600000) return '${d ~/ 60000} min ago';
    if (d < 86400000) return '${d ~/ 3600000} h ago';
    return '${d ~/ 86400000} d ago';
  }
  void done(PocketGame g, String what) { if (strOf(p['message']).isNotEmpty) g.send(strOf(p['message'])); }
  void doSave(PocketGame g, int k) {
    if (g.state != 'play') return;
    final label = strOf(p['nameVar']).isEmpty ? '' : '${g.vars[p['nameVar']] ?? ''}';
    if (g.saveGame(k)) {
      g.prefs?.setString(metaKey(g, k), jsonEncode({'label': label, 'at': DateTime.now().millisecondsSinceEpoch, 'played': g.time}));
      flash = (k, 'Saved ✓', 1.4); g.sfx('coin'); done(g, 'saved');
    }
  }
  void doLoad(PocketGame g, int k) {
    if (!g.hasSave(k)) { flash = (k, 'Empty', 1); return; }
    if (g.state != 'play') g.start();
    if (g.loadGame(k)) done(g, 'loaded');
  }
  void doDelete(PocketGame g, int k) { g.deleteSave(k); g.prefs?.remove(metaKey(g, k)); flash = (k, 'Deleted', 1.2); }
  /// A tap on a slot (act: save / load / del), with the engine's "tap again" for saving over a slot and deleting.
  void tap(PocketGame g, int k, String act) {
    g.sfx('click');
    if (act == 'del') { if (pend != null && pend!.$1 == k && pend!.$2 == 'del') { pend = null; doDelete(g, k); } else { pend = (k, 'del', 2.5); } return; }
    if (act == 'save') { if (g.hasSave(k) && p['confirm'] != false && !(pend != null && pend!.$1 == k && pend!.$2 == 'save')) { pend = (k, 'save', 2.5); return; } pend = null; doSave(g, k); return; }
    doLoad(g, k);
  }
  @override
  void start(GameObject e, PocketGame g) { hudOwnLook(e); g.tapTargets.add(e); g.panels.add((ctx) => build(ctx, e, g)); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    g.tapTargets.add(e);
    if (flash != null) { final f = flash!; flash = f.$3 - dt <= 0 ? null : (f.$1, f.$2, f.$3 - dt); }
    if (pend != null) { final f = pend!; pend = f.$3 - dt <= 0 ? null : (f.$1, f.$2, f.$3 - dt); }
  }
  Widget build(BuildContext ctx, GameObject e, PocketGame g) {
    if (!hudLive(e, g)) return hudNothing;
    final r = g.uiRect(e), txt = hudColor(p['text'], '#ffffff'), acc = hudColor(p['accent'], '#4fa3ff'), dg = hudColor(p['danger'], '#ff5c6c'), card = hudColor(p['card'], '#232842');
    final mode = strOf(p['mode'], 'loads it'), both = mode.startsWith('saves or loads'), saving = mode == 'saves there';
    TextStyle st(double size, Color c, [FontWeight w = FontWeight.w800]) => TextStyle(color: c, fontSize: size, fontWeight: w, decoration: TextDecoration.none);
    Widget pill(String label, Color bg, Color fg, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Container(margin: const EdgeInsets.symmetric(vertical: 2), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)), child: Text(label, style: st(13.5, fg))));
    final rows = <Widget>[];
    for (final k in slots(g)) {
      final m = meta(g, k), exists = m != null, P = pend != null && pend!.$1 == k ? pend : null, F = flash != null && flash!.$1 == k ? flash : null;
      final name = exists && strOf(m['label']).isNotEmpty ? strOf(m['label']) : strOf(p['slotName'], 'Slot {n}').replaceAll('{n}', '$k');
      final title = P != null ? (P.$2 == 'del' ? 'Tap again to delete' : 'Tap again to save over it') : F != null ? F.$2 : name;
      final sub = exists ? [if (m['at'] != null) ago(numOf(m['at'])), if (m['played'] != null) '${(numOf(m['played']) / 60).ceil()} min played'].join(' · ') : (saving ? 'Empty: tap to save' : 'Empty');
      rows.add(GestureDetector(
        onTap: () => tap(g, k, both ? (exists ? 'load' : 'save') : saving ? 'save' : 'load'),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: F != null ? Color.lerp(card, acc, 0.25) : card, borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            if (p['pictures'] != false) Container(width: 56, height: 44, decoration: BoxDecoration(color: exists ? acc.withValues(alpha: 0.35) : const Color(0x0FFFFFFF), borderRadius: BorderRadius.circular(10)), child: Icon(exists ? Icons.download_rounded : Icons.add_rounded, color: txt.withValues(alpha: 0.8))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: st(16, P != null ? (P.$2 == 'del' ? dg : acc) : txt)),
              if (sub.isNotEmpty && P == null && F == null) Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: st(12.5, txt.withValues(alpha: 0.6), FontWeight.w700)),
            ])),
            if (both) Column(mainAxisSize: MainAxisSize.min, children: [pill('Save', acc, Colors.white, () => tap(g, k, 'save')), pill('Load', txt.withValues(alpha: exists ? 0.14 : 0.06), txt.withValues(alpha: exists ? 1 : 0.35), () => tap(g, k, 'load'))]),
            if (p['allowDelete'] != false && exists) GestureDetector(onTap: () => tap(g, k, 'del'), child: Container(margin: const EdgeInsets.only(left: 6), width: 32, height: 32, decoration: BoxDecoration(color: P?.$2 == 'del' ? dg : dg.withValues(alpha: 0.16), shape: BoxShape.circle), child: Icon(Icons.delete_outline, size: 17, color: P?.$2 == 'del' ? Colors.white : dg))),
          ]),
        ),
      ));
    }
    return Positioned.fromRect(rect: r, child: Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 2),
      decoration: BoxDecoration(color: colorOf(p['bg'] ?? '#181c2c'), borderRadius: BorderRadius.circular(20)),
      child: ListView(padding: EdgeInsets.zero, children: [
        if (strOf(p['title'], 'Saved games').isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(6, 2, 0, 12), child: Text(strOf(p['title'], 'Saved games'), style: st(19, txt, FontWeight.w900))),
        ...rows,
      ]),
    ));
  }
}

/// Tutorial (coach marks): step-by-step tips that point at things (an object, or x%,y% of the screen): the screen darkens except a spotlight, with a bubble, Next and Skip. Can run only the first time.
class Tutorial extends Component {
  Tutorial(this.p);
  final Map<String, dynamic> p;
  List<(String, String, double)> steps = [];
  int idx = -1;
  double t = 0;
  (Offset, double)? spot;
  Rect? skip;
  bool paused = false;
  GameObject? guard;
  String key = '';
  @override
  bool get always => true;
  bool get active => idx >= 0;
  void begin(GameObject e, PocketGame g) {
    if (steps.isEmpty || active) return;
    if (p['once'] != false && g.prefs?.getString(key) == '1') return;
    idx = 0; t = 0; spot = null;
    if (p['pause'] != false && g.state == 'play' && !g.paused) {
      paused = true; g.paused = true;
      // (a hidden "paused" screen object, so the runtime's PAUSED card stays away while the tutorial shows)
      final o = GameObject({'name': 'Tutorial pause', 'ui': true, 'visible': false, 'showWhen': 'paused'}, g);
      g.objects.add(o); guard = o;
    }
  }
  void finish(GameObject e, PocketGame g) {
    if (!active) return;
    idx = -1;
    if (paused) { paused = false; g.paused = false; guard?.dead = true; guard = null; }
    if (p['once'] != false) g.prefs?.setString(key, '1');
    g.send(strOf(p['doneMessage'], 'tutorial done'));
  }
  /// Where the spotlight goes for a step (screen pixels) and how big it is.
  (Offset, double) where(PocketGame g, (String, String, double) st) {
    final m = RegExp(r'^\s*(-?[\d.]+)%\s*,\s*(-?[\d.]+)%\s*$').firstMatch(st.$2);
    if (m != null) return (Offset(g.screen.width * double.parse(m[1]!) / 100, g.screen.height * double.parse(m[2]!) / 100), st.$3);
    final q = st.$2.isEmpty ? null : g.find(st.$2);
    if (q == null) return (Offset(g.screen.width / 2, g.screen.height / 2), 0);
    if (q.ui) { final r = g.uiRect(q); return (r.center, st.$3 > 0 ? st.$3 : math.max(r.width, r.height) * 0.6 + 10); }
    return (g.toScreen(q.x, q.y), st.$3 > 0 ? st.$3 : 50);
  }
  @override
  void start(GameObject e, PocketGame g) {
    hudOwnLook(e);
    steps = [for (final l in strOf(p['steps']).split('\n')) if (l.trim().isNotEmpty) () { final c = l.split('|').map((x) => x.trim()).toList(); return (c[0], c.length > 1 ? c[1] : '', c.length > 2 ? numOf(c[2], 60) : 60.0); }()];
    key = 'pocket.tutorial.${g.saveKey}.${e.name}';
    if (p['startOn'] != 'on a message') begin(e, g);
    g.on((m) { if (!e.dead && p['startOn'] == 'on a message' && m == strOf(p['message'], 'tutorial')) begin(e, g); });
    g.panels.add((ctx) => active ? hudCanvasPanel((c) => draw(c, e, g)) : hudNothing); // (over other panels)
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!active) return;
    t += dt;
    final w = where(g, steps[idx]), k = math.min(1.0, dt * 10), s = spot;
    spot = s == null ? w : (Offset.lerp(s.$1, w.$1, k)!, s.$2 + (w.$2 - s.$2) * k);
    for (final tp in [...g.taps]) {
      if (t < 0.25) continue;
      final sk = skip;
      if (sk != null && sk.inflate(12).contains(tp.screen)) { finish(e, g); g.sfx('click'); g.taps.clear(); return; }
      g.sfx('click'); idx++; t = 0;
      if (idx >= steps.length) { finish(e, g); g.taps.clear(); return; }
    }
    g.taps.clear(); // (taps go to the tutorial while it shows)
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (!active || e.dead) return;
    final st = steps[idx], sp = spot ?? where(g, st), a = math.min(1.0, t * 4), W = g.screen.width, H = g.screen.height;
    final dim = Path()..fillType = PathFillType.evenOdd..addRect(Offset.zero & g.screen);
    if (sp.$2 > 0) dim.addOval(Rect.fromCircle(center: sp.$1, radius: sp.$2 * (1 + math.sin(g.time * 3.3) * 0.03)));
    c.drawPath(dim, Paint()..color = Color.fromRGBO(0, 0, 0, numOf(p['dim'], 0.7) * (idx == 0 ? a : 1)));
    if (sp.$2 > 0) c.drawCircle(sp.$1, sp.$2 + 6, Paint()..color = Colors.white.withValues(alpha: 0.7)..style = PaintingStyle.stroke..strokeWidth = 2);
    final txt = hudColor(p['text'], '#1d2033'), bw = math.min(W - 48, 300.0);
    final body = hudTp(st.$1, 15, txt, maxW: bw - 28, maxLines: null);
    final bh = body.height + 62, below = sp.$1.dy + sp.$2 + 20 + bh < H - g.safe.bottom - 10;
    final double by = sp.$2 <= 0 ? H / 2 - bh / 2 : below ? sp.$1.dy + sp.$2 + 20 : sp.$1.dy - sp.$2 - 20 - bh;
    final double bx = (sp.$1.dx - bw / 2).clamp(16.0, math.max(16.0, W - bw - 16)).toDouble();
    final bubble = RRect.fromRectAndRadius(Rect.fromLTWH(bx, by, bw, bh), const Radius.circular(16)), bg = hudColor(p['bubble'], '#ffffff');
    c.drawShadow(Path()..addRRect(bubble), Colors.black, 8, false);
    c.drawRRect(bubble, Paint()..color = bg);
    if (sp.$2 > 0) { final tx = sp.$1.dx.clamp(bx + 20, bx + bw - 20).toDouble(); c.drawPath(below ? (Path()..moveTo(tx - 10, by)..lineTo(tx, by - 10)..lineTo(tx + 10, by)..close()) : (Path()..moveTo(tx - 10, by + bh)..lineTo(tx, by + bh + 10)..lineTo(tx + 10, by + bh)..close()), Paint()..color = bg); }
    body.paint(c, Offset(bx + 14, by + 14));
    final fy = by + bh - 22, last = idx >= steps.length - 1;
    hudText(c, '${idx + 1} / ${steps.length}', bx + 14, fy, size: 12, color: txt.withValues(alpha: 0.5), align: 'left');
    c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(bx + bw - 92, fy - 14, 80, 28), const Radius.circular(14)), Paint()..color = hudColor(p['accent'], '#4fa3ff'));
    hudText(c, last ? 'Got it!' : 'Next ›', bx + bw - 52, fy, size: 13, weight: FontWeight.w900);
    if (!last) { hudText(c, 'Skip', bx + bw - 124, fy, size: 13, weight: FontWeight.w800, color: txt.withValues(alpha: 0.55)); skip = Rect.fromCenter(center: Offset(bx + bw - 124, fy), width: 40, height: 22); } else { skip = null; }
  }
}

/// Show If (pages): shows this object (and everything inside it) only while a variable matches (page = shop, coins > 0…); fades in, can send messages when it opens and closes.
class ShowIf extends Component {
  ShowIf(this.p);
  final Map<String, dynamic> p;
  bool? shown;
  bool firstDone = false;
  @override
  bool get always => true;
  static bool same(Object? a, Object? b) => (a == null ? '' : '$a') == (b == null ? '' : '$b');
  bool test(PocketGame g) {
    final k = strOf(p['var'], 'page'), v = g.vars[k], want = '${p['value'] ?? 'home'}', op = strOf(p['op'], '=');
    if (v == null || '$v'.isEmpty) return onOf(p['whenUnset']);
    if (onOf(p['whenUnset']) && op == '=' && !same(v, want)) { // the first page also shows when no page is for this value
      final any = g.objects.any((o) => !o.dead && o.parts.any((c) => c is ShowIf && strOf(c.p['var'], 'page') == k && strOf(c.p['op'], '=') == '=' && same(v, c.p['value'] ?? 'home')));
      if (!any) return true;
    }
    final a = double.tryParse('$v'), b = double.tryParse(want), num = want.isNotEmpty && a != null && b != null;
    switch (op) {
      case '≠': return num ? a != b : !same(v, want);
      case '>': return (a ?? 0) > (b ?? 0);
      case '<': return (a ?? 0) < (b ?? 0);
      case '≥': return (a ?? 0) >= (b ?? 0);
      case '≤': return (a ?? 0) <= (b ?? 0);
      default: return num ? a == b : same(v, want);
    }
  }
  @override
  void start(GameObject e, PocketGame g) {
    shown = test(g); e.visible = shown!;
    if (shown! && strOf(p['showMessage']).isNotEmpty) g.after(0, () => g.send(strOf(p['showMessage'])));
    if (shown! && strOf(p['firstMessage']).isNotEmpty) { firstDone = true; g.after(0, () => g.send(strOf(p['firstMessage']))); }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final want = test(g);
    if (want == shown) return;
    shown = want; e.visible = want;
    if (want && strOf(p['showMessage']).isNotEmpty) { g.send(strOf(p['showMessage'])); } else if (!want && strOf(p['hideMessage']).isNotEmpty) { g.send(strOf(p['hideMessage'])); }
    if (want && strOf(p['firstMessage']).isNotEmpty && !firstDone) { firstDone = true; g.send(strOf(p['firstMessage'])); }
    if (want && strOf(p['anim'], 'fade') != 'none') { final a = e.alpha <= 0.01 ? 1.0 : e.alpha; g.killTweens(e, 'alpha'); e.alpha = 0; g.tween(e, 'alpha', a, 0.22); }
  }
}

/// Plays an entrance on an object (pop, fade, zoom, drop, slide, flip, spin, elastic, swing) over some seconds, after a delay.
void hudEntrance(PocketGame g, GameObject q, String anim, double d, [double delay = 0]) {
  final bx = numOf(q.data['animSx'], q.sx), by = numOf(q.data['animSy'], q.sy), x0 = numOf(q.data['animX'], q.x), y0 = numOf(q.data['animY'], q.y), a0 = numOf(q.data['animA'], q.alpha <= 0 ? 1 : q.alpha);
  q.data['animSx'] = bx; q.data['animSy'] = by; q.data['animX'] = x0; q.data['animY'] = y0; q.data['animA'] = a0;
  g.killTweens(q);
  void go() {
    q.visible = true;
    q.sx = bx; q.sy = by; q.x = x0; q.y = y0; q.alpha = a0;
    final n = anim.toLowerCase();
    if (n == 'none') return;
    q.alpha = 0; g.tween(q, 'alpha', a0, d * (n.contains('fade') ? 1.4 : 0.8));
    if (n.contains('pop') || n.contains('zoom') || n.contains('elastic') || n.contains('bounce in')) {
      final s0 = n.contains('zoom') ? 0.3 : 0.6, curve = n.contains('elastic') ? 'outElastic' : n.contains('zoom') ? 'outCubic' : 'outBack';
      q.sx = bx * s0; q.sy = by * s0; g.tween(q, 'sx', bx, d * (curve == 'outElastic' ? 2.5 : 1.4), curve: curve); g.tween(q, 'sy', by, d * (curve == 'outElastic' ? 2.5 : 1.4), curve: curve);
    } else if (n.contains('drop')) { q.y = y0 - 60; g.tween(q, 'y', y0, d * 2, curve: 'outBounce'); }
    else if (n.contains('from left')) { q.x = x0 - 80; g.tween(q, 'x', x0, d * 1.3, curve: 'outCubic'); }
    else if (n.contains('from right')) { q.x = x0 + 80; g.tween(q, 'x', x0, d * 1.3, curve: 'outCubic'); }
    else if (n.contains('bottom') || n.contains('sheet') || n.contains('rise') || n.contains('slide')) { q.y = y0 + 60; g.tween(q, 'y', y0, d * 1.3, curve: 'outCubic'); }
    else if (n.contains('top')) { q.y = y0 - 60; g.tween(q, 'y', y0, d * 1.3, curve: 'outCubic'); }
    else if (n.contains('flip')) { q.sy = 0.02; g.tween(q, 'sy', by, d * 1.4, curve: 'outBack'); }
    else if (n.contains('spin')) { q.rz = -180; g.tween(q, 'rz', 0, d * 1.6, curve: 'outBack'); q.sx = bx * 0.4; q.sy = by * 0.4; g.tween(q, 'sx', bx, d * 1.6, curve: 'outBack'); g.tween(q, 'sy', by, d * 1.6, curve: 'outBack'); }
    else if (n.contains('swing')) { q.rz = -25; g.tween(q, 'rz', 0, d * 2.5, curve: 'outElastic'); }
  }
  if (delay > 0) { q.visible = false; g.after(delay, go); } else { go(); }
}

/// UI Animation: an entrance (when the game starts, every time it appears, or on a message; optionally its children one after another) and an idle loop (float, pulse, breathe, wiggle, heartbeat, bounce, spin, glow, attention shake).
class UiAnim extends Component {
  UiAnim(this.p);
  final Map<String, dynamic> p;
  double t = 0, busy = 0, nextAttn = 2;
  bool wasShown = false;
  Map<String, double>? base;
  @override
  bool get always => true;
  void play(GameObject e, PocketGame g) {
    final d = math.max(0.05, numOf(p['duration'], 0.3)), delay = numOf(p['delay']), gap = numOf(p['gap'], 0.08);
    final list = onOf(p['stagger']) ? hudKids(g, e) : [e];
    busy = delay + d * 3 + (onOf(p['stagger']) ? list.length * gap : 0); base = null;
    if (onOf(p['stagger'])) e.visible = true;
    for (var i = 0; i < list.length; i++) { hudEntrance(g, list[i], strOf(p['entrance'], 'pop'), d, delay + (onOf(p['stagger']) ? i * gap : 0)); }
  }
  @override
  void start(GameObject e, PocketGame g) {
    final on = strOf(p['playOn'], 'when the game starts');
    if (on == 'when the game starts') play(e, g);
    if (on == 'on a message') g.on((m) { if (!e.dead && m == strOf(p['message'], 'show')) play(e, g); });
    wasShown = e.shown;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final shown = e.shown;
    if (p['playOn'] == 'every time it appears' && shown && !wasShown) play(e, g);
    wasShown = shown;
    if (busy > 0) { busy -= dt; return; }
    final idle = strOf(p['idle'], 'none');
    if (idle == 'none' || !shown) return;
    final b = base ??= {'x': e.x, 'y': e.y, 'sx': e.sx, 'sy': e.sy, 'rz': e.rz, 'glow': numOf(e.shape?['glow'])};
    final sp = numOf(p['idleSpeed'], 1), A = numOf(p['idleAmount'], 1);
    t += dt * sp;
    switch (idle) {
      case 'float': e.y = b['y']! + math.sin(t * 2) * 6 * A;
      case 'pulse': { final k = 1 + math.sin(t * 4) * 0.05 * A; e.sx = b['sx']! * k; e.sy = b['sy']! * k; }
      case 'breathe': { final k = 1 + math.sin(t * 1.6) * 0.03 * A; e.sx = b['sx']! * k; e.sy = b['sy']! * k; e.alpha = 0.85 + math.sin(t * 1.6) * 0.15; }
      case 'wiggle': e.rz = b['rz']! + math.sin(t * 9) * 3 * A;
      case 'heartbeat': {
        final c = t % 1.2, k = 1 + (c < 0.12 ? c / 0.12 : c < 0.24 ? (0.24 - c) / 0.12 : c < 0.36 ? (c - 0.24) / 0.12 * 0.7 : c < 0.48 ? (0.48 - c) / 0.12 * 0.7 : 0) * 0.1 * A;
        e.sx = b['sx']! * k; e.sy = b['sy']! * k;
      }
      case 'bounce': e.y = b['y']! - math.sin(t * 3).abs() * 10 * A;
      case 'spin': e.rz += 90 * sp * dt;
      case 'glow': { final s = e.shape; if (s != null) { s['glow'] = b['glow']! + (10 + math.sin(t * 3) * 8) * A; s['stroke'] ??= s['fill']; } }
      case 'attention shake':
        if (g.time >= nextAttn) { nextAttn = g.time + 3 / sp; final r0 = b['rz']!; e.rz = r0 + 10 * A; g.tween(e, 'rz', r0, 0.6, curve: 'outElastic'); }
    }
  }
}

/// Tooltip: a small bubble of help beside this object (on tap, on long-press, always, the first time, or on a message); hides by itself.
class HudTooltip extends Component {
  HudTooltip(this.p);
  final Map<String, dynamic> p;
  bool on = false;
  double k = 0, age = 0, ht = 0, wait = -1;
  int? held;
  @override
  bool get always => true;
  String get showOn => strOf(p['showOn'], 'long-press');
  void show(bool v) { if (v && !on) age = 0; on = v; }
  @override
  void start(GameObject e, PocketGame g) {
    if (showOn == 'always') on = true;
    if (showOn == 'on a message') g.on((m) { if (!e.dead && m == strOf(p['message'], 'tip')) show(true); });
    if (showOn == 'first time only') { final key = 'pocket.tip.${g.saveKey}.${e.name.isEmpty ? e.id : e.name}'; if (g.prefs?.getString(key) == null) { g.prefs?.setString(key, '1'); wait = 0.6; } }
    g.overlays.add((c) => draw(c, e, g));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    k = (k + (on ? dt : -dt) / 0.15).clamp(0.0, 1.0);
    final live = e.ui ? hudLive(e, g) : e.shown && !e.dead;
    if (wait >= 0 && (wait -= dt) < 0 && live) show(true);
    if (!live) { if (showOn != 'always') on = false; return; }
    if (showOn == 'long-press') {
      if (held == null) { final d = g.downOn(e); if (d != null) { held = d.id; ht = 0; } }
      else {
        final q = g.pointers[held];
        if (q == null || !g.hitsAt(e, q.at)) { held = null; if (on && numOf(p['seconds'], 3) > 0) age = math.max(age, numOf(p['seconds'], 3) - 0.8); }
        else if ((ht += dt) > 0.45 && !on) { show(true); g.buzz(); }
      }
    }
    final tapped = g.taps.any((t) => g.hits(e, t));
    if (showOn == 'tap' && tapped) { show(!on); }
    else if (on && showOn != 'always' && g.taps.isNotEmpty && !tapped) { on = false; }
    if (on && showOn != 'always' && numOf(p['seconds'], 3) > 0 && held == null && (age += dt) > numOf(p['seconds'], 3)) on = false;
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (k <= 0.01 || e.dead) return;
    const styles = {'dark': ['#1f2430', '#ffffff'], 'light': ['#ffffff', '#1c1f26'], 'accent': ['#3a7bfd', '#ffffff'], 'warning': ['#ffb020', '#1c1f26']};
    final style = strOf(p['style'], 'dark'), sc = styles[style] ?? styles['dark']!;
    final bg = style == 'custom' ? hudColor(p['bg'], '#1f2430') : colorOf(sc[0])!, fg = style == 'custom' ? hudColor(p['fg'], '#ffffff') : colorOf(sc[1])!;
    final r = e.ui ? g.uiRect(e) : Rect.fromCenter(center: g.toScreen(e.x, e.y), width: e.half.width * 2 * g.zoom, height: e.half.height * 2 * g.zoom);
    final title = strOf(p['title']), size = numOf(p['size'], 14), maxW = math.max(60.0, numOf(p['width'], 220));
    final tt = title.isEmpty ? null : hudTp(title, size, fg.withValues(alpha: k), weight: FontWeight.w900, maxW: maxW);
    final body = hudTp(g.fill(strOf(p['text'], 'Tap to jump')), size, fg.withValues(alpha: k), weight: FontWeight.w600, maxW: maxW, maxLines: null);
    final w = math.max(tt?.width ?? 0, body.width) + 20, h = (tt == null ? 0 : tt.height + 2) + body.height + 16;
    var place = strOf(p['place'], 'auto');
    if (place == 'auto') place = r.top - h - 12 > g.safe.top ? 'above' : 'below';
    final cx = r.center.dx, W = g.screen.width;
    Offset at;
    switch (place) {
      case 'below': at = Offset(cx - w / 2, r.bottom + 10);
      case 'left': at = Offset(r.left - w - 10, r.center.dy - h / 2);
      case 'right': at = Offset(r.right + 10, r.center.dy - h / 2);
      default: at = Offset(cx - w / 2, r.top - h - 10);
    }
    at = Offset(at.dx.clamp(8.0, math.max(8.0, W - w - 8)), at.dy);
    final box = RRect.fromRectAndRadius(at & Size(w, h), const Radius.circular(10)), paint = Paint()..color = bg.withValues(alpha: bg.a * k);
    c.drawRRect(box, paint);
    if (p['arrow'] != false) {
      final path = Path();
      switch (place) {
        case 'below': path..moveTo(cx - 7, at.dy)..lineTo(cx, at.dy - 7)..lineTo(cx + 7, at.dy);
        case 'left': path..moveTo(at.dx + w, r.center.dy - 7)..lineTo(at.dx + w + 7, r.center.dy)..lineTo(at.dx + w, r.center.dy + 7);
        case 'right': path..moveTo(at.dx, r.center.dy - 7)..lineTo(at.dx - 7, r.center.dy)..lineTo(at.dx, r.center.dy + 7);
        default: path..moveTo(cx - 7, at.dy + h)..lineTo(cx, at.dy + h + 7)..lineTo(cx + 7, at.dy + h);
      }
      c.drawPath(path..close(), paint);
    }
    var y = at.dy + 8;
    if (tt != null) { tt.paint(c, Offset(at.dx + 10, y)); y += tt.height + 2; }
    body.paint(c, Offset(at.dx + 10, y));
  }
}

/// Notifications: pop-ups that stack and slide away; send "notify Title|text|icon" to show one (card, pill, achievement or banner; top, bottom, top right or centre).
class Notifications extends Component {
  Notifications(this.p);
  final Map<String, dynamic> p;
  /// Showing: title, text, icon, age.
  final List<List<Object>> list = [];
  final List<(Rect, List<Object>)> rects = [];
  @override
  bool get always => true;
  double get life => numOf(p['seconds'], 3);
  @override
  void start(GameObject e, PocketGame g) {
    hudOwnLook(e);
    final pre = strOf(p['listen'], 'notify');
    g.on((m) {
      if (e.dead || !(m == pre || m.startsWith('$pre '))) return;
      final parts = g.fill(m == pre ? '' : m.substring(pre.length + 1)).split('|').map((x) => x.trim()).toList();
      list.add([parts.isNotEmpty ? parts[0] : '', parts.length > 1 ? parts[1] : '', parts.length > 2 && parts[2].isNotEmpty ? parts[2] : (p['look'] == 'achievement' ? '🏆' : ''), 0.0]);
      while (list.length > numOf(p['max'], 3)) { list.removeAt(0); }
      g.sfx(strOf(p['sound'], 'power')); g.buzz();
    });
    g.panels.add((ctx) => list.isEmpty ? hudNothing : hudCanvasPanel((c) => draw(c, e, g)));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    for (final n in list) { n[3] = (n[3] as double) + dt; }
    while (list.isNotEmpty && (list.first[3] as double) > life + 0.4) { list.removeAt(0); }
    if (p['tapToClose'] != false) {
      for (final t in g.taps) { for (final (r, n) in rects) { if (r.contains(t.screen) && (n[3] as double) < life) n[3] = life; } }
    }
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    rects.clear();
    if (e.dead || list.isEmpty) return;
    final W = g.screen.width, H = g.screen.height, look = strOf(p['look'], 'card'), pos = strOf(p['position'], 'top'), txt = hudColor(p['text'], '#ffffff'), acc = hudColor(p['accent'], '#ffd23d');
    final double w = look == 'banner' ? W : look == 'pill' ? math.min(W - 40, 320.0) : math.min(W - 24, 380.0), h = look == 'pill' ? 44.0 : look == 'banner' ? 64.0 + (pos.startsWith('top') ? g.safe.top : 0.0) : 66.0;
    var y = pos == 'bottom' ? H - g.safe.bottom - 20 - h : pos == 'center' ? H * 0.32 : (look == 'banner' ? 0.0 : g.safe.top + 14);
    for (final n in list.reversed) {
      final t = n[3] as double, inT = (t / 0.3).clamp(0.0, 1.0), outT = ((t - life) / 0.35).clamp(0.0, 1.0), k = ease('outCubic', inT) * (1 - outT);
      final x = pos == 'top right' ? W - w - 12 + (1 - k) * (w + 20) : (W - w) / 2, yy = y + (pos == 'bottom' ? 1 : -1) * (1 - k) * (h + 30);
      final rr = RRect.fromRectAndRadius(Rect.fromLTWH(x, yy, w, h), Radius.circular(look == 'banner' ? 0.0 : look == 'pill' ? h / 2 : 16.0));
      c.drawShadow(Path()..addRRect(rr), Colors.black.withValues(alpha: k), 8, false);
      c.drawRRect(rr, Paint()..color = (look == 'achievement' ? const Color(0xFF2A2210) : hudColor(p['bg'], '#1e2235')).withValues(alpha: k));
      if (look == 'achievement') c.drawRRect(rr, Paint()..color = acc.withValues(alpha: k)..style = PaintingStyle.stroke..strokeWidth = 2);
      final ty = yy + h - (look == 'banner' ? 32 : h / 2), icon = n[2] as String, pill = look == 'pill';
      if (icon.isNotEmpty) {
        final ix = x + (pill ? 24 : 34);
        c.drawCircle(Offset(ix, ty), pill ? 16 : 22, Paint()..color = acc.withValues(alpha: 0.2 * k));
        final ip = hudTp(icon, pill ? 16 : 22, acc.withValues(alpha: k)); ip.paint(c, Offset(ix - ip.width / 2, ty - ip.height / 2));
      }
      final tx = x + (icon.isNotEmpty ? (pill ? 48 : 66) : 18), mw = math.max(10.0, x + w - tx - 12), title = n[0] as String, text = n[1] as String;
      if (look == 'achievement') hudText(c, 'ACHIEVEMENT', tx, ty - 17, size: 9.5, weight: FontWeight.w900, color: acc.withValues(alpha: k), align: 'left');
      hudText(c, title, tx, text.isNotEmpty && !pill ? ty - (look == 'achievement' ? 2 : 9) : ty, size: pill ? 14 : 15, weight: FontWeight.w800, color: txt.withValues(alpha: k), align: 'left', maxW: mw);
      if (text.isNotEmpty && !pill) hudText(c, text, tx, ty + (look == 'achievement' ? 15 : 11), size: 12.5, weight: FontWeight.w600, color: txt.withValues(alpha: 0.72 * k), align: 'left', maxW: mw);
      c.drawRect(Rect.fromLTWH(x + (look == 'banner' ? 0 : 14), yy + h - 3, (w - (look == 'banner' ? 0 : 28)) * (1 - t / life).clamp(0.0, 1.0), 2), Paint()..color = acc.withValues(alpha: 0.7 * k));
      rects.add((rr.outerRect, n));
      y += (pos == 'bottom' ? -1 : 1) * (h + 8) * k;
    }
  }
}

/// Nav Item (tab): tap it to switch pages (sets a variable, e.g. page = home); it lights up while its page shows (what's inside dims when not).
class NavItem extends Component {
  NavItem(this.p);
  final Map<String, dynamic> p;
  @override
  bool get always => true;
  String get key => strOf(p['var'], 'page');
  @override
  void start(GameObject e, PocketGame g) {
    final v = g.vars[key];
    if (onOf(p['startHere']) && (v == null || '$v'.isEmpty || v == 0)) g.setVar(key, '${p['page'] ?? 'home'}');
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (e.ui) g.tapTargets.add(e);
    if (g.tapsOn(e).isNotEmpty) {
      g.setVar(key, '${p['page'] ?? 'home'}');
      g.sfx('click'); g.squash(e, 0.92);
      if (strOf(p['message']).isNotEmpty) g.send(strOf(p['message']));
    }
    final on = ShowIf.same(g.vars[key], p['page'] ?? 'home');
    if (e.shape != null) e.shape!['fill'] = on ? (p['activeColor'] ?? '#3a6ea5') : (p['idleColor'] ?? '');
    final a = on || p['dimIdle'] == false ? 1.0 : 0.55;
    for (final q in hudKids(g, e)) { q.alpha = a; }
    if (e.shape == null && e.text != null) e.alpha = a;
  }
}

/// Side Bar (drawer): slides in from a side when a message arrives (e.g. from a ☰ button), dims the game behind it; a tap outside or picking a page closes it.
class SideDrawer extends Component {
  SideDrawer(this.p);
  final Map<String, dynamic> p;
  bool open = false;
  Offset? home;
  GameObject? dim;
  Object? lastPage;
  double openedAt = -1;
  @override
  bool get always => true;
  void set(GameObject e, PocketGame g, bool want, [bool instant = false]) {
    open = want;
    if (want) openedAt = g.time;
    final h = home ??= Offset(e.x, e.y);
    final r = g.uiRect(e), k = g.uiK, d = instant ? 0.001 : numOf(p['duration'], 0.25);
    final side = strOf(p['side'], 'left');
    final away = switch (side) { 'right' => Offset(h.dx + r.width / k + 40, h.dy), 'bottom' => Offset(h.dx, h.dy + r.height / k + 40), 'top' => Offset(h.dx, h.dy - r.height / k - 40), _ => Offset(h.dx - r.width / k - 40, h.dy) };
    g.killTweens(e);
    final dm = dim;
    if (dm != null) g.killTweens(dm);
    if (want) {
      e.visible = true;
      g.tween(e, 'x', h.dx, d, curve: 'outCubic'); g.tween(e, 'y', h.dy, d, curve: 'outCubic');
      if (dm != null) { dm.visible = true; g.tween(dm, 'alpha', numOf(p['dim'], 0.5), d); }
    } else {
      g.tween(e, 'x', away.dx, d, curve: 'inCubic'); g.tween(e, 'y', away.dy, d, curve: 'inCubic', done: () { if (!open) e.visible = false; });
      if (dm != null) g.tween(dm, 'alpha', 0, d, done: () { if (!open) dm.visible = false; });
    }
    if (instant) { e.x = want ? h.dx : away.dx; e.y = want ? h.dy : away.dy; e.visible = want; if (dm != null) { dm.alpha = want ? numOf(p['dim'], 0.5) : 0; dm.visible = want; } }
  }
  @override
  void start(GameObject e, PocketGame g) {
    if (numOf(p['dim'], 0.5) > 0) { // the dark layer behind the bar (tap it to close)
      final o = GameObject({'name': '${e.name} dim', 'ui': true, 'anchor': 'center', 'stretch': 'both', 'layer': e.layer - 1, 'alpha': 0, 'visible': false, 'shape': {'type': 'rect', 'w': 400, 'h': 700, 'fill': '#000000'}}, g);
      g.objects.add(o); dim = o;
    }
    set(e, g, onOf(p['startOpen']), true);
    lastPage = g.vars[strOf(p['var'], 'page')];
    final msg = strOf(p['message'], 'menu');
    g.on((m) {
      if (e.dead) return;
      if (m == msg) { set(e, g, !open); } else if (m == '$msg open' || m == 'open $msg') { set(e, g, true); } else if (m == '$msg close' || m == 'close $msg') { set(e, g, false); }
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final dm = dim;
    if (dm != null) g.tapTargets.add(dm);
    if (open && g.time > openedAt) { // (not the tap that opened it)
      for (final t in g.taps) { if (!g.hitsAt(e, t.screen)) { set(e, g, false); break; } }
    }
    final pv = g.vars[strOf(p['var'], 'page')];
    if (p['closeOnPick'] != false && open && !ShowIf.same(pv, lastPage)) set(e, g, false);
    lastPage = pv;
  }
  @override
  void gone(GameObject e, PocketGame g) => dim?.destroy();
}

/// The field names (and keys) of a data collection, and its starting records (Game Settings › Data).
Map<String, dynamic>? hudCollection(PocketGame g, String name) {
  String key(Object? n) => '${n ?? ''}'.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_').replaceAll(RegExp(r'^_+|_+$'), '');
  for (final c in (g.gameData['collections'] as List? ?? const [])) { if (c is Map && key(c['name']) == key(name)) return c.cast<String, dynamic>(); }
  return null;
}
/// A record's value for a field (by name or key; yes/no as 1 / 0).
Object? hudField(Map r, String field) {
  String key(Object? n) => '${n ?? ''}'.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '_').replaceAll(RegExp(r'^_+|_+$'), '');
  final k = key(field);
  for (final e in r.entries) { if (key(e.key) == k) { final v = e.value; return v == true ? 1 : v == false ? 0 : v == 'yes' ? 1 : v == 'no' ? 0 : v; } }
  return null;
}
/// Does a record pass a filter ("done = no", "amount > 10 and category = Food")?
bool hudMatches(Map r, String filter) {
  for (final part in filter.split(RegExp(r'\s+and\s+', caseSensitive: false))) {
    final m = RegExp(r'^\s*(.+?)\s*(>=|<=|!=|≠|≥|≤|=|>|<)\s*(.*?)\s*$').firstMatch(part);
    if (m == null) continue;
    final a = hudField(r, m[1]!), bRaw = m[3]!.toLowerCase() == 'yes' ? '1' : m[3]!.toLowerCase() == 'no' ? '0' : m[3]!;
    final an = double.tryParse('${a ?? ''}'), bn = double.tryParse(bRaw), both = an != null && bn != null;
    final ok = switch (m[2]) {
      '>' => both && an > bn, '<' => both && an < bn, '>=' || '≥' => both && an >= bn, '<=' || '≤' => both && an <= bn,
      '!=' || '≠' => both ? an != bn : '${a ?? ''}'.toLowerCase() != bRaw.toLowerCase(),
      _ => both ? an == bn : '${a ?? ''}'.toLowerCase() == bRaw.toLowerCase(),
    };
    if (!ok) return false;
  }
  return true;
}

/// Data Summary: keeps a variable up to date with a count, total, average, smallest or largest value from a data collection (as saved in the game).
class DataStat extends Component {
  DataStat(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  bool get always => true;
  double calc(PocketGame g) {
    final c = hudCollection(g, strOf(p['collection'], 'Expenses'));
    final rows = [for (final r in (c?['rows'] as List? ?? const [])) if (r is Map && hudMatches(r, g.fill(strOf(p['filter'])))) r];
    final how = strOf(p['how'], 'count');
    if (how == 'count') return rows.length.toDouble();
    final nums = [for (final r in rows) numOf(hudField(r, strOf(p['field'], 'amount')))];
    if (nums.isEmpty) return 0;
    final sum = nums.fold(0.0, (a, b) => a + b);
    return switch (how) { 'sum' => (sum * 100).round() / 100, 'average' => (sum / nums.length * 100).round() / 100, 'min' => nums.reduce(math.min), _ => nums.reduce(math.max) };
  }
  void apply(PocketGame g) {
    final v = calc(g), k = strOf(p['var'], 'total');
    g.setVar(k, v == v.roundToDouble() ? v.toInt() : v);
    if (p['format'] == 'money') g.setVar('${k}_text', '\$${v.toStringAsFixed(2)}');
  }
  @override
  void start(GameObject e, PocketGame g) => apply(g);
  @override
  void update(GameObject e, double dt, PocketGame g) { if ((t += dt) >= 1 || strOf(p['filter']).contains('{')) { t = 0; apply(g); } }
}

/// Network Sync (Photon): online, other players see a copy of this object. The native game plays single-player, so it just keeps playing.
class NetSync extends Component {
  NetSync(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) => e.data['netId'] ??= e.id;
}

/// Online Leaderboard: in the native game, a leaderboard of the best scores on this phone (top 10, in the engine's row format), refreshed on its message and after each game.
class LocalLeaderboard extends Component {
  LocalLeaderboard(this.p);
  final Map<String, dynamic> p;
  @override
  bool get always => true;
  String get stat => strOf(p['stat'], 'score');
  String key(PocketGame g) => 'pocket.board.${g.saveKey}.$stat';
  List<Map<String, dynamic>> rows(PocketGame g) { final s = g.prefs?.getString(key(g)); return s == null ? [] : [for (final r in jsonDecode(s) as List) (r as Map).cast<String, dynamic>()]; }
  /// Adds the current score (the variable named like the statistic, or score).
  void record(PocketGame g) {
    final v = g.vars.containsKey(stat) ? g.numVar(stat) : g.numVar('score');
    if (v <= 0) return;
    final name = strOf(g.vars['playerName'], 'You');
    final L = rows(g)..add({'name': name, 'value': v.floor(), 'at': DateTime.now().millisecondsSinceEpoch});
    L.sort((a, b) => numOf(b['value']).compareTo(numOf(a['value'])));
    g.prefs?.setString(key(g), jsonEncode(L.take(50).toList()));
  }
  void show(GameObject e, PocketGame g) {
    final L = rows(g).take(numOf(p['count'], 10).toInt()).toList();
    final t = e.text ??= {'value': '', 'size': 18, 'align': 'left', 'color': '#ffffff', 'weight': '700'};
    if (e.shape != null && numOf(t['wrap']) <= 0) t['wrap'] = math.max(40.0, e.half.width * 2 - 16); // (rows fit its box)
    t['value'] = L.isEmpty ? 'No scores yet — be the first!' : [for (var i = 0; i < L.length; i++) strOf(p['format'], '{rank}. {name}  {value}').replaceAll('{rank}', '${i + 1}').replaceAll('{name}', '${L[i]['name']}').replaceAll('{value}', formatNumber(numOf(L[i]['value'])))].join('\n');
  }
  @override
  void start(GameObject e, PocketGame g) {
    show(e, g);
    g.on((m) {
      if (e.dead) return;
      if (m == 'won' || m == 'game over' || m == 'submit score online') { record(g); show(e, g); }
      if (m == strOf(p['refreshOn'], 'leaderboard')) show(e, g);
    });
  }
}

/// Room List (Photon): online it lists the open rooms. Played offline there are none: it says so (its empty text) with a row to make one, which sends the engine's "join online room" message.
class RoomList extends Component {
  RoomList(this.p);
  final Map<String, dynamic> p;
  Rect? make;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) => g.overlays.add((c) => draw(c, e, g));
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!hudLive(e, g)) return;
    g.tapTargets.add(e);
    final m = make;
    for (final t in g.taps) {
      if (m == null || !m.contains(t.screen)) continue;
      g.sfx('click'); g.send('join online room');
      if (strOf(p['message']).isNotEmpty) g.send(strOf(p['message']));
      g.message('Playing offline: online rooms need a connection', 2);
    }
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    make = null;
    if (!hudLive(e, g)) return;
    final b = g.uiRect(e), rh = math.max(30.0, numOf(p['rowH'], 56)), sub = hudColor(p['sub'], 'rgba(255,255,255,0.6)'), txt = hudColor(p['text'], '#ffffff');
    c.save(); c.clipRect(b);
    hudText(c, strOf(p['empty'], 'No open rooms yet. Make one!'), b.center.dx, b.top + math.min(60, b.height / 2), size: 15, weight: FontWeight.w600, color: sub, maxW: b.width - 24);
    final y = b.top + math.min(60, b.height / 2) + 28;
    if (y + rh <= b.bottom) {
      final r = Rect.fromLTWH(b.left + 4, y, b.width - 8, rh);
      c.drawRRect(RRect.fromRectAndRadius(r, const Radius.circular(12)), Paint()..color = hudColor(p['row'], 'rgba(255,255,255,0.08)'));
      hudText(c, 'Make a room', r.left + 14, r.center.dy, size: 16, weight: FontWeight.w800, color: txt, align: 'left');
      c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(r.right - 74, r.center.dy - 15, 64, 30), const Radius.circular(15)), Paint()..color = hudColor(p['accent'], '#3a7bfd'));
      hudText(c, 'Make', r.right - 42, r.center.dy, size: 14, weight: FontWeight.w800);
      make = r;
    }
    c.restore();
  }
}

/// Chat Box (Photon): chat bubbles, newest at the bottom. Played offline it shows what you send (the text in its input variable, on its send message).
class ChatBox extends Component {
  ChatBox(this.p);
  final Map<String, dynamic> p;
  final List<(String, String, bool)> log = [];
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) {
    g.on((m) {
      if (e.dead || m != strOf(p['sendOn'], 'send chat')) return;
      final k = strOf(p['inputVar'], 'chatText'), v = '${g.vars[k] ?? ''}'.trim();
      if (v.isEmpty) return;
      log.add((strOf(g.vars['playerName'], 'You'), v, true));
      g.setVar(k, '');
      g.setVar('netChat', [for (final l in log) {'name': l.$1, 'text': l.$2}]);
    });
    g.overlays.add((c) => draw(c, e, g));
  }
  void draw(Canvas c, GameObject e, PocketGame g) {
    if (!hudLive(e, g)) return;
    final b = g.uiRect(e), fs = numOf(p['size'], 14), pad = 10.0, room = numOf(p['bottomSpace']), names = hudColor(p['names'], 'rgba(255,255,255,0.6)'), txt = hudColor(p['text'], '#ffffff');
    c.save(); c.clipRect(Rect.fromLTRB(b.left, b.top, b.right, math.max(b.top, b.bottom - room)));
    var y = b.bottom - pad - room;
    for (var i = log.length - 1; i >= 0 && y > b.top; i--) {
      final (name, text, mine) = log[i];
      final tp = hudTp(text, fs, txt, weight: FontWeight.w600, maxW: b.width * 0.7 - 24, maxLines: null);
      final w = math.min(b.width * 0.75, tp.width + 24), h = tp.height + 14;
      y -= h;
      final x = mine ? b.right - pad - w : b.left + pad;
      c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, h), const Radius.circular(14)), Paint()..color = mine ? hudColor(p['mine'], '#3a7bfd') : hudColor(p['theirs'], 'rgba(255,255,255,0.12)'));
      tp.paint(c, Offset(x + 12, y + 7));
      if (!mine) { y -= fs; hudText(c, name, x + 4, y + fs * 0.45, size: fs * 0.8, color: names, align: 'left'); }
      y -= 6;
    }
    if (log.isEmpty) hudText(c, 'Say hi 👋', b.center.dx, b.center.dy, size: fs, weight: FontWeight.w600, color: names);
    c.restore();
  }
}

// makeComponent: 'tween' => TweenPart(p), 'tweenSequence' => TweenSequencePart(p), 'flipbook' => Flipbook(p), 'animator' => Animator(p), 'spriteSheet' => SpriteSheet(p), 'cameraBrain' => CameraBrain(p), 'cameraSequence' => CameraSequence(p), 'cameraMixer' => CameraMixer(p), 'cameraTargetGroup' => CameraTargetGroup(p), 'cameraZone' => CameraZone(p), 'cameraSwitcher' => CameraSwitcher(p), 'gridMove' => GridMove(p), 'gridEnemy' => GridEnemy(p), 'gridUnit' => GridUnit(p), 'squadControl' => SquadControl(p), 'boardCell' => BoardCell(p), 'turnAction' => TurnAction(p), 'turnOpponent' => TurnOpponent(p),

// ---------------------------------------------------------------------------------------------------------------
// Animation: Tween, Tween Sequence, Sprite Animation (flipbook), Animator (keyframe clips), Sprite Sheet
// ---------------------------------------------------------------------------------------------------------------

/// One tween effect on an object ("move by", "punch scale", "path"…), driven by a progress 0 → 1.
/// Positions and turns are added as offsets (so other movement still works); sizes, fades and colours are set.
class FxStep {
  FxStep(this.e, this.p, this.g) {
    duration = math.max(0.01, numOf(p['duration'], 1));
    curve = strOf(p['ease'], 'inOutSine');
    effect = strOf(p['effect'], 'move by');
    rebase();
    if (p['speedBased'] == true && ['move by', 'move to', 'move from', 'rotate by', 'rotate to'].contains(effect)) {
      final dist = effect.startsWith('rotate') ? (effect == 'rotate by' ? A('angle', 360) : A('angle', 0) - e.rz).abs() : effect == 'move to' ? (Offset(A('x', 0), A('y', 0)) - Offset(e.x, e.y)).distance : Offset(A('x', 0), A('y', 0)).distance;
      duration = math.max(0.01, dist / math.max(0.001, numOf(p['duration'], 1)));
    }
  }
  final GameObject e;
  final Map<String, dynamic> p;
  final PocketGame g;
  late double duration;
  late String curve, effect;
  // where it started (for set values), and the offsets already added (for added ones)
  double x0 = 0, y0 = 0, rz0 = 0, sx0 = 1, sy0 = 1, a0 = 1, lx = 0, ly = 0, lrz = 0;
  Color? c0;
  String text0 = '';
  bool vis0 = true;
  final List<Offset> shakes = [];
  double A(String k, double d) { final v = p[k]; return v == null || '$v'.isEmpty || double.tryParse('$v') == null ? d : numOf(v); }
  bool get fromMode => p['from'] == true && effect != 'move from';
  /// Start again from where the object is now (the next loop of an incremental tween, a replay).
  void rebase() {
    x0 = e.x; y0 = e.y; rz0 = e.rz; sx0 = e.sx; sy0 = e.sy; a0 = e.alpha; lx = 0; ly = 0; lrz = 0;
    c0 = colorOf(e.text != null && e.shape == null ? e.text!['color'] : e.shape?['fill']);
    text0 = strOf(e.text?['value']); vis0 = e.visible;
  }
  void _add(double ox, double oy, double orz) { e.x += ox - lx; e.y += oy - ly; e.rz += orz - lrz; lx = ox; ly = oy; lrz = orz; }
  /// Show the effect at raw progress t (0 → 1; the ease is applied here).
  void at(double t) {
    t = t.clamp(0.0, 1.0);
    var k = ease(curve, t);
    if (fromMode) k = 1 - k;
    final vx = A('x', 0), vy = A('y', -40);
    switch (effect) {
      case 'move by': _add(vx * k, vy * k, 0);
      case 'move from': _add(vx * (1 - k) - vx, vy * (1 - k) - vy, 0);
      case 'move to': _add((vx - x0) * k, (vy - y0) * k, 0);
      case 'rotate by': _add(0, 0, A('angle', 360) * k);
      case 'rotate to': _add(0, 0, (A('angle', 0) - rz0) * k);
      case 'spin': _add(0, 0, A('angle', 360) * t);
      case 'scale to': { final a = A('amount', 1); e.sx = sx0 + (a * sx0.sign - sx0) * k; e.sy = sy0 + (a * sy0.sign - sy0) * k; }
      case 'scale by': { final a = A('amount', 1.5); e.sx = sx0 * (1 + (a - 1) * k); e.sy = sy0 * (1 + (a - 1) * k); }
      case 'fade to': e.alpha = a0 + (A('amount', 0).clamp(0.0, 1.0) - a0) * k;
      case 'color to': {
        final to = colorOf(p['color']) ?? const Color(0xFFFF5252), from = c0 ?? Colors.white;
        final hex = '#${(mixColor(from, to, k).toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
        if (e.text != null && e.shape == null) { e.text!['color'] = hex; } else { e.shape?['fill'] = hex; }
      }
      case 'punch scale' || 'punch position' || 'punch rotation': {
        final vib = A('vibrato', 8), el = A('elasticity', 0.6), w = math.sin(t * vib * math.pi) * math.pow(1 - t, 1 + el);
        if (effect == 'punch scale') { final a = A('amount', 0.3); e.sx = sx0 * (1 + a * w); e.sy = sy0 * (1 + a * w); }
        else if (effect == 'punch position') { _add(vx * w, vy * w, 0); }
        else { _add(0, 0, A('amount', 30) * w); }
      }
      case 'shake position' || 'shake rotation' || 'shake scale': {
        final vib = math.max(1.0, A('vibrato', 18)), n = (t * vib).floor();
        while (shakes.length <= n) { shakes.add(Offset(rand(-1, 1), rand(-1, 1))); }
        final s = t >= 1 ? Offset.zero : shakes[n] * (1 - t);
        if (effect == 'shake position') { final a = A('amount', 10); _add(s.dx * a, s.dy * a, 0); }
        else if (effect == 'shake rotation') { _add(0, 0, s.dx * A('amount', 15)); }
        else { final a = A('amount', 0.2); e.sx = sx0 * (1 + s.dx * a); e.sy = sy0 * (1 + s.dy * a); }
      }
      case 'path': {
        final raw = p['points'] is List ? p['points'] as List : const [];
        final pts = <Offset>[Offset.zero, for (final q in raw) if (q is Map) Offset(numOf(q['x']), numOf(q['y']))];
        if (p['closed'] == true) pts.add(Offset.zero);
        if (pts.length < 2) return;
        var total = 0.0;
        for (var i = 1; i < pts.length; i++) { total += (pts[i] - pts[i - 1]).distance; }
        var d = total * k;
        for (var i = 1; i < pts.length; i++) {
          final seg = (pts[i] - pts[i - 1]).distance;
          if (d <= seg || i == pts.length - 1) {
            final f = seg == 0 ? 1.0 : (d / seg).clamp(0.0, 1.0), at = pts[i - 1] + (pts[i] - pts[i - 1]) * f;
            final turn = p['orient'] == true ? math.atan2(pts[i].dy - pts[i - 1].dy, pts[i].dx - pts[i - 1].dx) / deg + 90 - rz0 : 0.0;
            _add(at.dx, at.dy, turn);
            break;
          }
          d -= seg;
        }
      }
      case 'jump to': { final hops = math.max(1.0, A('jumps', 1)); _add(vx * k, vy * k - A('height', 80) * math.sin(k * math.pi * hops).abs(), 0); }
      case 'spiral': { final r = A('radius', 120) * k, a = A('turns', 3) * math.pi * 2 * k; _add(math.cos(a) * r - (k == 0 ? 0 : 0), math.sin(a) * r, 0); }
      case 'look at': {
        final t2 = g.findAll(strOf(p['target'], 'player')).where((q) => q != e).firstOrNull;
        if (t2 == null) return;
        var want = math.atan2(t2.x - e.x, -(t2.y - e.y)) / deg, diff = (want - rz0) % 360;
        if (diff > 180) diff -= 360;
        _add(0, 0, diff * k);
      }
      case 'blink': { final times = math.max(1.0, A('times', 6)); e.visible = t >= 1 ? vis0 : (t * times * 2).floor().isEven ? !vis0 : vis0; }
      case 'type text': {
        final full = strOf(p['text'], 'Hello there!'), n = (full.length * k).round();
        var s = full.substring(0, n.clamp(0, full.length));
        if (p['scramble'] == true && n < full.length) s += String.fromCharCode(65 + _rng.nextInt(26));
        e.text ??= {'size': 22, 'color': '#ffffff'};
        e.text!['value'] = s;
      }
      case 'count up': {
        final v = strOf(p['var']), to = A('to', 100);
        if (v.isNotEmpty) { final from = numOf(e.data['countFrom'] ?? g.vars[v]); e.data['countFrom'] = from; g.setVar(v, (from + (to - from) * k).round()); }
        else { e.text ??= {'size': 22, 'color': '#ffffff'}; final from = A('from', 0); e.text!['value'] = '${strOf(p['prefix'])}${(from + (to - from) * k).round()}${strOf(p['suffix'])}'; }
      }
    }
  }
  /// Undo what it added and put set values back (before a sequence restarts).
  void undo() { _add(0, 0, 0); if (effect.contains('scale')) { e.sx = sx0; e.sy = sy0; } if (effect == 'fade to') e.alpha = a0; if (effect == 'blink') e.visible = vis0; }
}

/// A playing tween: loops (−1 = forever) as yoyo, restart or incremental, a delay, and what to do each loop / at the end.
class FxPlay {
  FxPlay(this.step, {this.loops = 0, this.loopType = 'yoyo', this.delay = 0});
  final FxStep step;
  final int loops;
  final String loopType;
  double delay, t = 0, dir = 1;
  int loop = 0;
  bool done = false;
  VoidCallback? onLoop, onDone;
  /// Each tap of a forward / back tween turns it around.
  void flip() { dir = -dir; done = false; }
  void update(double dt) {
    if (done) return;
    if (delay > 0) { delay -= dt; return; }
    final d = step.duration;
    t += dt * dir;
    if (dir < 0 && t <= 0) { t = 0; step.at(0); done = true; return; }
    if (t < d) { final back = loopType == 'yoyo' && loop.isOdd; step.at(back ? 1 - t / d : t / d); return; }
    // the end of a loop
    final back = loopType == 'yoyo' && loop.isOdd;
    step.at(back ? 0 : 1);
    if (loops == 0 || (loops > 0 && loop + 1 > loops)) { if (dir > 0) { done = true; onDone?.call(); } return; }
    loop++; t -= d;
    onLoop?.call();
    if (loopType == 'incremental') { step.rebase(); }
    else if (loopType == 'restart') { step.at(0); }
  }
}

/// The tweens playing on the game's objects (driven once a frame by whichever animation component runs first).
class FxSystem {
  final List<FxPlay> plays = [];
  double stamp = -1;
  static FxSystem of(PocketGame g) => (g.systems['fx'] ??= FxSystem()) as FxSystem;
  void tick(PocketGame g, double dt) {
    if (stamp == g.time) return;
    stamp = g.time;
    for (final f in [...plays]) { if (f.step.e.dead) { plays.remove(f); continue; } f.update(dt); if (f.done && f.dir > 0 && !f.keep) plays.remove(f); }
  }
}

extension on FxPlay { bool get keep => step.p['_keep'] == true; }

/// Whether a component should play now: on start, a tap, touch, a message, or never.
mixin PlayOn on Component {
  Map<String, dynamic> get pp;
  String get playOn => strOf(pp['playOn'], 'start');
  void play(GameObject e, PocketGame g);
  @override
  bool get always => true;
  @override
  bool get listens => playOn == 'touched by tag';
  @override
  bool cares(GameObject other) => other.has(strOf(pp['tag'], 'player'));
  @override
  void touch(GameObject e, GameObject other, PocketGame g) => play(e, g);
  void startPlayOn(GameObject e, PocketGame g) {
    if (playOn == 'start') play(e, g);
    if (playOn == 'message') g.on((m) { if (m == strOf(pp['message'], 'go') && !e.dead) play(e, g); });
  }
  void updatePlayOn(GameObject e, double dt, PocketGame g) {
    FxSystem.of(g).tick(g, dt);
    if (playOn.startsWith('tap')) { if (e.ui) g.tapTargets.add(e); if (e.shown && g.tapsOn(e).isNotEmpty) play(e, g); }
  }
}

/// Tween: animates its object with no code (move, rotate, spin, scale, fade, colour, punch, shake, path, jump, spiral, look at, blink, type text, count up).
class TweenPart extends Component with PlayOn {
  TweenPart(this.p);
  final Map<String, dynamic> p;
  @override
  Map<String, dynamic> get pp => p;
  FxPlay? fx;
  bool get toggle => playOn == 'tap (forward / back)';
  @override
  void play(GameObject e, PocketGame g) {
    final sys = FxSystem.of(g);
    if (toggle && fx != null) { fx!.flip(); if (!sys.plays.contains(fx)) sys.plays.add(fx!); return; }
    if (fx != null) { sys.plays.remove(fx); }
    final step = FxStep(e, {...p, if (toggle) '_keep': true}, g);
    final f = FxPlay(step, loops: toggle ? 0 : numOf(p['loops'], -1).toInt(), loopType: strOf(p['loopType'], 'yoyo'), delay: numOf(p['delay']));
    final loopDo = strOf(p['loopDo'], 'nothing'), thenDo = strOf(p['thenDo'], 'nothing');
    if (loopDo != 'nothing') f.onLoop = () => g.runAction(e, {'action': loopDo, 'value': p['loopValue'] ?? '', 'amount': 1});
    if (thenDo != 'nothing') f.onDone = () => g.runAction(e, {'action': thenDo, 'value': p['thenValue'] ?? '', 'amount': 1});
    fx = f;
    sys.plays.add(f);
  }
  @override
  void start(GameObject e, PocketGame g) => startPlayOn(e, g);
  @override
  void update(GameObject e, double dt, PocketGame g) => updatePlayOn(e, dt, g);
}

/// Tween Sequence: several tween steps one after another ("after"), at the same time ("with") or a pause ("wait"), as one animation.
class TweenSequencePart extends Component with PlayOn {
  TweenSequencePart(this.p);
  final Map<String, dynamic> p;
  @override
  Map<String, dynamic> get pp => p;
  final List<(double, FxStep)> steps = [];
  double t = 0, length = 0, delay = 0;
  int loop = 0;
  bool playing = false;
  Map<String, double>? base;
  @override
  void play(GameObject e, PocketGame g) {
    if (playing && p['restartOnPlay'] != true) return;
    final b = base;
    if (b != null) { for (final s in steps.reversed) { s.$2.undo(); } e.x = b['x']!; e.y = b['y']!; e.rz = b['rz']!; e.sx = b['sx']!; e.sy = b['sy']!; e.alpha = b['a']!; }
    base = {'x': e.x, 'y': e.y, 'rz': e.rz, 'sx': e.sx, 'sy': e.sy, 'a': e.alpha};
    steps.clear(); begun.clear();
    var at = 0.0, lastStart = 0.0;
    for (final raw in (p['steps'] is List ? p['steps'] as List : const [])) {
      final st = (raw as Map).cast<String, dynamic>(), d = math.max(0.0, numOf(st['duration'], 0.2)), w = strOf(st['with'], 'after');
      if (w == 'wait') { at += d; continue; }
      final start = w == 'with' ? lastStart : at;
      steps.add((start, FxStep(e, st, g)));
      lastStart = start;
      at = math.max(at, start + math.max(0.01, d));
    }
    length = math.max(0.01, at); t = 0; loop = 0; delay = numOf(p['delay']); playing = true;
  }
  final Set<FxStep> begun = {};
  void _show(double time) {
    for (final (start, s) in steps) {
      if (time < start) { if (begun.contains(s)) s.at(0); continue; }
      s.at((time - start) / s.duration);
    }
  }
  @override
  void start(GameObject e, PocketGame g) => startPlayOn(e, g);
  @override
  void update(GameObject e, double dt, PocketGame g) {
    updatePlayOn(e, dt, g);
    if (!playing) return;
    if (delay > 0) { delay -= dt; return; }
    final before = t;
    t += dt;
    final yoyoBack = strOf(p['loopType'], 'restart') == 'yoyo' && loop.isOdd;
    // steps that start this frame begin from where the object is now
    if (!yoyoBack) { for (final (start, s) in steps) { if (!begun.contains(s) && start <= t && (start > before || before == 0)) { s.rebase(); begun.add(s); } } }
    _show(yoyoBack ? length - math.min(t, length) : math.min(t, length));
    if (t < length) return;
    final loops = numOf(p['loops']).toInt();
    if (loops == 0 || (loops > 0 && loop + 1 > loops)) {
      playing = false;
      final then = strOf(p['thenDo'], 'nothing');
      if (then != 'nothing') g.runAction(e, {'action': then, 'value': p['thenValue'] ?? '', 'amount': 1});
      return;
    }
    loop++; t = 0;
    if (strOf(p['loopType'], 'restart') != 'yoyo') { for (final s in steps.reversed) { s.$2.undo(); } begun.clear(); }
  }
}

/// Sprite Animation (flipbook): cycles through emoji or picture frames (always, while moving, or on a message), looping, once or back and forth.
class Flipbook extends Component {
  Flipbook(this.p);
  final Map<String, dynamic> p;
  late final List<String> frames = strOf(p['frames']).split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  double t = 0;
  Offset? last;
  late bool active = strOf(p['when'], 'always') == 'always';
  @override
  bool get always => true;
  void show(GameObject e, String f) {
    if (f.startsWith('art:')) return; // (built-in vector art: the object keeps its own look in the native build)
    if (RegExp(r'^(https?:|data:|blob:|\.?/)').hasMatch(f)) {
      e.sprite = {...?e.sprite, 'src': f, 'w': e.sprite?['w'] ?? 56, 'h': e.sprite?['h'] ?? 56};
      if (e.shape?['type'] == 'emoji') e.shape = null;
    } else {
      e.shape ??= {'type': 'emoji', 'w': 56, 'h': 56, 'fill': ''};
      e.shape!['type'] = 'emoji'; e.shape!['emoji'] = f;
    }
  }
  @override
  void start(GameObject e, PocketGame g) {
    if (frames.isNotEmpty) show(e, frames.first);
    if (strOf(p['when']) == 'on message') g.on((m) { if (m == strOf(p['message'], 'go')) { active = true; t = 0; } });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (frames.isEmpty) return;
    if (strOf(p['when']) == 'while moving') {
      final now = Offset(e.x, e.y), moved = last != null && (now - last!).distance > 0.01;
      last = now;
      if (!moved) { show(e, frames.first); t = 0; return; }
    } else if (!active) { return; }
    t += dt * numOf(p['fps'], 6);
    final n = frames.length;
    var i = t.floor();
    final mode = strOf(p['mode'], 'loop');
    if (mode == 'once') { if (i >= n) { i = n - 1; if (strOf(p['when']) == 'on message') active = false; } }
    else if (mode == 'ping-pong' && n > 1) { final c = (n - 1) * 2; i %= c; if (i >= n) i = c - i; }
    else { i %= n; }
    show(e, frames[i]);
  }
}

/// A keyframe track [[time, value, ease?], …] at a time.
double? sampleTrack(List? tr, double time) {
  if (tr == null || tr.isEmpty) return null;
  final first = tr.first as List;
  if (time <= numOf(first[0])) return numOf(first[1]);
  for (var i = 0; i < tr.length - 1; i++) {
    final a = tr[i] as List, b = tr[i + 1] as List;
    if (time < numOf(b[0])) {
      final span = numOf(b[0]) - numOf(a[0]), k = span == 0 ? 1.0 : (time - numOf(a[0])) / span;
      return numOf(a[1]) + (numOf(b[1]) - numOf(a[1])) * ease(a.length > 2 ? strOf(a[2], 'linear') : 'linear', k);
    }
  }
  return numOf((tr.last as List)[1]);
}

/// Something that plays named clips (Animator, Sprite Sheet): the "play animation" action and messages pick it.
mixin ClipPlayer on Component {
  bool playClip(String name, {bool? loop});
  void listenForClips(GameObject e, PocketGame g, bool Function(String) has) {
    g.on((m) {
      if (e.dead) return;
      if (m.startsWith('play:')) { final rest = m.substring(5), i = rest.indexOf(':'); if (i > 0 && rest.substring(0, i) == e.id) playClip(rest.substring(i + 1)); return; }
      if (has(m)) playClip(m);
    });
  }
}

/// Animator: keyframe clips (x, y, turn, size, fade) made in the Animation timeline; plays on start, on a message, or by state (idle / moving / in the air).
class Animator extends Component with ClipPlayer {
  Animator(this.p);
  final Map<String, dynamic> p;
  late final List<Map<String, dynamic>> clips = [for (final c in (p['clips'] is List ? p['clips'] as List : const [])) (c as Map).cast<String, dynamic>()];
  Map<String, dynamic>? clip;
  double t = 0, dir = 1;
  bool playing = false, manual = false;
  String mode = 'once';
  final Map<String, double> last = {};
  Offset? prev;
  GameObject? ent;
  static const props = ['x', 'y', 'rz', 'sx', 'sy', 'alpha'], mult = {'sx', 'sy', 'alpha'};
  void apply(GameObject e, {bool reset = false}) {
    final c = clip;
    if (c == null) return;
    final tracks = (c['tracks'] as Map? ?? const {}).cast<String, dynamic>();
    for (final entry in tracks.entries) {
      if (!props.contains(entry.key) || entry.value is! List || (entry.value as List).isEmpty) continue;
      final isMult = mult.contains(entry.key), v = reset ? (isMult ? 1.0 : 0.0) : sampleTrack(entry.value as List, t)!, before = last[entry.key] ?? (isMult ? 1.0 : 0.0);
      final cur = e.getField(entry.key);
      e.setField(entry.key, isMult ? (before != 0 ? cur / before * v : v) : cur + v - before);
      last[entry.key] = v;
    }
  }
  @override
  bool playClip(String name, {bool? loop, bool auto = false}) {
    final e = ent;
    if (e != null && clip != null) apply(e, reset: true);
    clip = clips.where((c) => c['name'] == name).firstOrNull;
    t = 0; dir = 1; playing = clip != null; last.clear();
    mode = loop == null ? strOf(clip?['loop'], 'once') : loop ? 'loop' : 'once';
    manual = !auto;
    return clip != null;
  }
  String get current => playing ? strOf(clip?['name']) : '';
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) {
    ent = e;
    if (strOf(p['autoplay']).isNotEmpty) playClip(strOf(p['autoplay']));
    listenForClips(e, g, (m) => clips.any((c) => c['name'] == m));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final idle = strOf(p['idleClip']), move = strOf(p['moveClip']), air = strOf(p['airClip']);
    if ((idle.isNotEmpty || move.isNotEmpty || air.isNotEmpty) && !(manual && playing && mode != 'loop')) {
      final now = Offset(e.x, e.y), moved = prev != null && (now - prev!).distance > 0.5 * dt * 30;
      prev = now;
      final b = e.body, inAir = b != null && !b.grounded && g.gravity != 0 && b.gravityScale != 0;
      final want = inAir && air.isNotEmpty ? air : moved && move.isNotEmpty ? move : idle;
      if (want.isNotEmpty && (clip?['name'] != want || !playing)) playClip(want, auto: true);
    }
    final c = clip;
    if (!playing || c == null) return;
    final len = math.max(0.01, numOf(c['length'], 1));
    t += dt * numOf(p['speed'], 1) * dir;
    if (t >= len || t < 0) {
      if (mode == 'loop') { t = ((t % len) + len) % len; }
      else if (mode == 'ping-pong') { dir = -dir; t = t.clamp(0.0, len); }
      else { t = len; apply(e); playing = false; g.send('animation done: ${c['name']}'); return; }
    }
    apply(e);
  }
}

/// Sprite Sheet Animator: plays frames from a sheet picture (columns × rows) by clip ("idle: 0-3, run: 4-7"); can switch to run / jump by itself and flip to face the way it goes.
class SpriteSheet extends Component with ClipPlayer {
  SpriteSheet(this.p);
  final Map<String, dynamic> p;
  late final Map<String, (int, int)> clips = parse(strOf(p['clips'], 'idle: 0-3'));
  String cur = '', src = '';
  double t = 0;
  bool playing = false, once = false, manual = false, flip = false, hooked = false;
  int frame = 0;
  Offset? prev;
  static Map<String, (int, int)> parse(String text) {
    final out = <String, (int, int)>{};
    for (final part in text.split(',')) {
      final m = RegExp(r'^\s*([^:]+?)\s*:\s*(\d+)\s*(?:-\s*(\d+))?\s*$').firstMatch(part);
      if (m == null) continue;
      final a = int.parse(m[2]!), b = m[3] != null ? int.parse(m[3]!) : a;
      out[m[1]!] = a <= b ? (a, b) : (b, a);
    }
    return out;
  }
  @override
  bool playClip(String name, {bool? loop, bool auto = false}) {
    if (!clips.containsKey(name)) return false;
    if (cur != name) t = 0;
    cur = name; playing = true; once = loop == false; manual = !auto;
    return true;
  }
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) {
    final size = numOf(p['size'], 64);
    src = strOf(p['image'], strOf(e.sprite?['src']));
    e.sprite = {'w': size, 'h': size}; // (no picture of its own: this component draws the frame)
    if (strOf(p['autoplay']).isNotEmpty) playClip(strOf(p['autoplay']), loop: true, auto: true);
    listenForClips(e, g, clips.containsKey);
    if (!hooked) {
      hooked = true;
      void draw(Canvas c, bool hud) {
        if (e.dead || !e.shown || src.isEmpty || e.ui != hud || (hud && !g.onScreen(e))) return;
        final img = Sprites.of(src, () {});
        if (img == null) return;
        final cols = math.max(1, numOf(p['cols'], 4).toInt()), rows = math.max(1, numOf(p['rows'], 1).toInt());
        final fw = img.width / cols, fh = img.height / rows;
        e.sprite!['h'] = size * fh / fw;
        final f = frame % (cols * rows), sr = Rect.fromLTWH((f % cols) * fw, (f ~/ cols) * fh, fw, fh);
        final at = hud ? g.uiRect(e).center : Offset(e.x, e.y), k = hud ? g.uiK : 1.0, half = e.half;
        c.save();
        c.translate(at.dx, at.dy);
        c.rotate(e.rz * deg);
        c.scale(k * (flip ? -1 : 1) * e.sx.sign, k * e.sy.sign);
        c.drawImageRect(img, sr, Rect.fromCenter(center: Offset.zero, width: half.width * 2, height: half.height * 2), Paint()..color = Color.fromRGBO(255, 255, 255, e.alpha.clamp(0.0, 1.0))..filterQuality = FilterQuality.none);
        c.restore();
      }
      g.worldOverlays.add((c) => draw(c, false));
      g.overlays.add((c) => draw(c, true));
    }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final now = Offset(e.x, e.y), dx = prev == null ? 0.0 : now.dx - prev!.dx, moved = prev != null && (now - prev!).distance > 15 * dt;
    prev = now;
    if (p['flip'] != false && dx.abs() > 0.5 * dt) flip = dx < 0;
    if (onOf(p['auto']) && !(manual && playing && once)) {
      final b = e.body, inAir = b != null && !b.grounded && g.gravity != 0 && b.gravityScale != 0;
      final run = strOf(p['runClip'], 'run'), jump = strOf(p['jumpClip'], 'jump');
      final want = inAir && clips.containsKey(jump) ? jump : moved && clips.containsKey(run) ? run : strOf(p['autoplay']);
      if (want.isNotEmpty && (want != cur || !playing)) playClip(want, loop: true, auto: true);
    }
    final c = clips[cur];
    if (!playing || c == null) return;
    final n = c.$2 - c.$1 + 1;
    t += dt * numOf(p['fps'], 8);
    if (t >= n) { if (once) { t = n - 1e-6; playing = false; } else { t %= n; } }
    frame = c.$1 + t.floor();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Cameras: blends between cameras (Brain), cutscenes (Sequence), mixing two cameras, framing a group, zones, switching
// ---------------------------------------------------------------------------------------------------------------

/// Which camera is live and how the view blends to the next one ("Wide Cam", 1.5 s, inOutCubic).
class CamDirector {
  static CamDirector of(PocketGame g) => (g.systems['camdir'] ??= CamDirector()) as CamDirector;
  /// The next switch's blend (a sequence shot, a zone): seconds and ease.
  (double, String?)? nextBlend;
  /// Camera Brain rules: (from, to, seconds, ease); '*' matches any camera.
  List<(String, String, double, String?)> rules = [];
  double? defaultBlend;
  String defaultEase = 'inOutCubic';
  // a blend in progress
  GameObject? to;
  double bt = 0, bdur = 0, fx = 0, fy = 0, fz = 1;
  String bease = 'inOutCubic';
  double stamp = -1;
  GameObject? lastLive;
  late final GameObject holder = GameObject({'name': '(camera blend)'}, _dummyGame);
  static final PocketGame _dummyGame = PocketGame({});

  /// The camera object with this name (null / empty: back to priorities).
  void live(PocketGame g, String? name) {
    final cam = name == null || name.isEmpty ? null : g.objects.where((o) => !o.dead && o.name == name && (o.part<CameraRig>() != null || o.part<CameraMixer>() != null)).firstOrNull ?? g.find(name);
    var from = g.activeCamera == holder ? to : g.activeCamera;
    if (from == cam && lastLive != cam) from = lastLive; // (the "switch camera" action already made it live: blend from the one before)
    if (cam == from && to == null) return;
    final nb = nextBlend; nextBlend = null;
    (double, String?)? rule;
    if (nb == null) {
      final fn = from?.name ?? '', tn = cam?.name ?? '';
      for (final r in rules) { if (r.$1 == fn && r.$2 == tn) { rule = (r.$3, r.$4); break; } }
      rule ??= rules.where((r) => r.$1 == fn && r.$2 == '*').map((r) => (r.$3, r.$4)).firstOrNull;
      rule ??= rules.where((r) => r.$1 == '*' && r.$2 == tn).map((r) => (r.$3, r.$4)).firstOrNull;
      if (rule == null && defaultBlend != null) rule = (defaultBlend!, defaultEase);
    }
    final dur = nb?.$1 ?? rule?.$1 ?? -1;
    if (cam == null) { to = null; g.activeCamera = null; return; }
    if (dur <= 0) { to = null; g.activeCamera = cam; if (dur == 0) { final w = camWant(g, cam); if (w != null) { g.camX = w.$1; g.camY = w.$2; g.camZoom = w.$3; } } return; }
    to = cam; bt = 0; bdur = dur; bease = nb?.$2 ?? rule?.$2 ?? defaultEase; fx = g.camX; fy = g.camY; fz = g.camZoom;
    g.activeCamera = holder; // (no camera moves the view while the blend does)
  }
  /// Once a frame: move the view along a blend.
  void tick(PocketGame g, double dt) {
    if (stamp == g.time) return;
    stamp = g.time;
    if (g.activeCamera != holder && g.activeCamera != to) lastLive = g.activeCamera;
    final c = to;
    if (c == null) return;
    if (c.dead) { to = null; g.activeCamera = null; return; }
    if (g.activeCamera == c) g.activeCamera = holder; // (a camera's own listener made it live first: the blend still runs)
    if (g.activeCamera != holder) { to = null; return; } // (something else took over)
    bt += dt;
    final k = ease(bease, bt / bdur), w = camWant(g, c);
    if (w != null) { g.camX = fx + (w.$1 - fx) * k; g.camY = fy + (w.$2 - fy) * k; g.camZoom = fz + (w.$3 - fz) * k; }
    if (bt >= bdur) { to = null; g.activeCamera = c; }
  }
}

/// Where a camera object wants the view (x, y, zoom): a fixed camera its own spot, a following one its target (plus offsets), a mixer its blend.
(double, double, double)? camWant(PocketGame g, GameObject cam) {
  final mix = cam.part<CameraMixer>();
  if (mix != null) return mix.want(g, cam);
  final r = cam.part<CameraRig>();
  if (r == null) return (cam.x, cam.y, 1);
  final p = r.p, zoom = numOf(cam.data['camZoom'], numOf(p['zoom'], 1)).clamp(0.1, 10).toDouble(), mode = strOf(p['mode'], 'follow');
  if (mode == 'fixed') return (cam.x, cam.y, zoom);
  final tag = strOf(p['target'], 'player');
  final t = g.objects.where((o) => !o.dead && o.has(tag)).firstOrNull;
  if (t == null) return (g.camX, g.camY, zoom);
  return (t.x + numOf(p['ox']), mode == 'side scroller' ? g.viewH / 2 + numOf(p['oy']) : t.y + numOf(p['oy']), zoom);
}

/// Camera Brain: custom blends between particular cameras ("Menu Cam > * = 2 inOutSine"), and a default blend.
class CameraBrain extends Component {
  CameraBrain(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) {
    final d = CamDirector.of(g);
    d.rules = [
      for (final l in strOf(p['blends']).split('\n'))
        if (RegExp(r'^\s*(.+?)\s*>\s*(.+?)\s*=\s*([\d.]+)\s*(\w+)?\s*$').firstMatch(l) case final m?) (m[1]!, m[2]!, numOf(m[3]), m[4]),
    ];
    d.defaultBlend = '${p['defaultBlend'] ?? ''}'.isEmpty ? null : numOf(p['defaultBlend']);
    d.defaultEase = strOf(p['defaultEase'], 'inOutCubic');
    g.on((m) { if (m.startsWith('camera:') && d.rules.isNotEmpty) d.live(g, m.substring(7)); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) => CamDirector.of(g).tick(g, dt);
}

/// Camera Sequence: a cutscene of camera shots ("Wide Cam | hold 2 | blend 1"), with letterbox bars; tap to skip.
class CameraSequence extends Component {
  CameraSequence(this.p);
  final Map<String, dynamic> p;
  int i = -1;
  double t = 0, bars = 0;
  bool playing = false;
  GameObject? before;
  List<(String, double, double)> get shots => [
        for (final l in strOf(p['shots']).split('\n'))
          if (l.split('|').map((s) => s.trim()).toList() case final r when r[0].isNotEmpty) (r[0], math.max(0.0, numOf(r.length > 1 ? r[1] : '2', 2)), math.max(0.0, numOf(r.length > 2 ? r[2] : '1', 1))),
      ];
  bool go(PocketGame g, int k) {
    final s = shots;
    if (k < 0 || k >= s.length) return false;
    i = k; t = 0;
    final d = CamDirector.of(g);
    d.nextBlend = (s[k].$3, null);
    d.live(g, s[k].$1);
    return true;
  }
  void stop(GameObject e, PocketGame g, bool done) {
    if (!playing) return;
    playing = false; i = -1;
    final d = CamDirector.of(g);
    d.nextBlend = (0.3, null);
    d.live(g, before?.name);
    if (before == null) g.activeCamera = null;
    if (done && strOf(p['endMessage']).isNotEmpty) g.send(strOf(p['endMessage']));
  }
  void play(GameObject e, PocketGame g) {
    if (playing) return;
    before = g.activeCamera == CamDirector.of(g).holder ? CamDirector.of(g).to : g.activeCamera;
    playing = true;
    if (!go(g, 0)) stop(e, g, true);
  }
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) {
    if (strOf(p['start']) == 'on a message') { g.on((m) { if (!e.dead && m == strOf(p['message'], 'cutscene')) play(e, g); }); } else { play(e, g); }
    g.overlays.add((c) {
      if (bars <= 0.002 || e.dead) return;
      final h = g.screen.height * 0.11 * bars, paint = Paint()..color = Colors.black;
      c.drawRect(Rect.fromLTWH(0, 0, g.screen.width, h), paint);
      c.drawRect(Rect.fromLTWH(0, g.screen.height - h, g.screen.width, h), paint);
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    CamDirector.of(g).tick(g, dt);
    bars += ((playing && p['bars'] != false ? 1 : 0) - bars) * math.min(1.0, dt * 6);
    if (!playing) return;
    if (p['skip'] != false && g.taps.isNotEmpty && t > 0.2) { g.taps.clear(); stop(e, g, true); return; }
    t += dt;
    final s = shots;
    if (i < 0 || i >= s.length) { stop(e, g, true); return; }
    if (t >= s[i].$3 + s[i].$2) { if (!go(g, i + 1)) { if (onOf(p['loop'])) { go(g, 0); } else { stop(e, g, true); } } }
  }
  @override
  void gone(GameObject e, PocketGame g) => stop(e, g, false);
}

/// Camera Mixer: a camera that sits between two others (a weight, or a variable): an aim camera halfway to a follow camera…
class CameraMixer extends Component {
  CameraMixer(this.p);
  final Map<String, dynamic> p;
  (double, double, double)? st;
  (double, double, double)? want(PocketGame g, GameObject e) {
    final a = g.find(strOf(p['camA'], 'Camera 1')), b = g.find(strOf(p['camB'], 'Camera 2'));
    final wa = a == null || a == e ? null : camWant(g, a), wb = b == null || b == e ? null : camWant(g, b);
    if (wa == null && wb == null) return null;
    final A = wa ?? wb!, B = wb ?? wa!, v = strOf(p['var']);
    final w = (e.data['camMix'] != null ? numOf(e.data['camMix']) : v.isNotEmpty ? g.numVar(v) / math.max(1e-6, numOf(p['max'], 1)) : numOf(p['weight'], 0.5)).clamp(0.0, 1.0);
    return (A.$1 + (B.$1 - A.$1) * w, A.$2 + (B.$2 - A.$2) * w, A.$3 + (B.$3 - A.$3) * w);
  }
  @override
  void start(GameObject e, PocketGame g) {
    e.data['priority'] = numOf(p['priority']);
    g.on((m) { if (m == 'camera:${e.name}' || m == 'camera:${e.id}') g.activeCamera = e; });
    if (g.activeCamera == null || numOf(p['priority']) > numOf(g.activeCamera!.data['priority'])) g.activeCamera = e;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (g.activeCamera != e) { st = null; return; }
    final w = want(g, e);
    if (w == null) return;
    final k = st == null ? 1.0 : 1 - math.exp(-numOf(p['smooth'], 8) * dt), s = st ?? w;
    st = (s.$1 + (w.$1 - s.$1) * k, s.$2 + (w.$2 - s.$2) * k, s.$3 + (w.$3 - s.$3) * k);
    g.camX = st!.$1; g.camY = st!.$2; g.camZoom = st!.$3.clamp(0.1, 10).toDouble();
  }
}

/// Target Group: a camera aimed at this object frames everything in the group ("player | 1 | 40" lines: tag, weight, radius).
class CameraTargetGroup extends Component {
  CameraTargetGroup(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    var sx = 0.0, sy = 0.0, sw = 0.0, l = double.infinity, t = double.infinity, r = -double.infinity, b = -double.infinity;
    for (final line in strOf(p['members']).split('\n')) {
      final parts = line.split('|').map((s) => s.trim()).toList();
      if (parts[0].isEmpty) continue;
      final w = parts.length > 1 ? numOf(parts[1], 1) : 1.0, rad = parts.length > 2 ? numOf(parts[2]) : 0.0;
      if (w <= 0) continue;
      for (final q in g.findAll(parts[0])) {
        if (q == e) continue;
        sx += q.x * w; sy += q.y * w; sw += w;
        l = math.min(l, q.x - rad); r = math.max(r, q.x + rad); t = math.min(t, q.y - rad); b = math.max(b, q.y + rad);
      }
    }
    if (sw == 0) return;
    e.x = sx / sw; e.y = sy / sw;
    // cameras aimed at the group zoom out to fit everyone (with some room)
    final fit = math.min(g.viewW / math.max(1.0, (r - l) + 120), g.viewH / math.max(1.0, (b - t) + 120)).clamp(0.3, 1.5);
    for (final o in g.objects) { final rig = o.part<CameraRig>(); if (rig != null && (e.has(strOf(rig.p['target'], 'player')))) o.data['camZoom'] = math.min(numOf(rig.p['zoom'], 1), fit); }
  }
}

/// Camera Zone: while the player is inside, another camera is live (then back to the one before, or keep it).
class CameraZone extends Component {
  CameraZone(this.p);
  final Map<String, dynamic> p;
  bool inside = false;
  String? before;
  @override
  void start(GameObject e, PocketGame g) { if (p['hide'] != false) e.visible = false; }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final d = CamDirector.of(g);
    d.tick(g, dt);
    final h = e.half, now = g.findAll(strOf(p['tag'], 'player')).any((q) => q != e && (q.x - e.x).abs() <= h.width && (q.y - e.y).abs() <= h.height);
    if (now == inside) return;
    inside = now;
    if ('${p['blend'] ?? ''}'.isNotEmpty) d.nextBlend = (numOf(p['blend']), null);
    final cam = strOf(p['camera'], 'Camera 2');
    if (now) {
      final cur = g.activeCamera == d.holder ? d.to : g.activeCamera;
      before = cur?.name;
      d.live(g, cam);
      if (strOf(p['message']).isNotEmpty) g.send(strOf(p['message']));
    } else if (p['mode'] != 'keep this camera') {
      final cur = g.activeCamera == d.holder ? d.to : g.activeCamera;
      if (cur?.name == cam) d.live(g, before);
    }
  }
}

/// Camera Switcher: picks the live camera from a variable ("run = Follow Cam"), or the first camera that can see the target (clear shot).
class CameraSwitcher extends Component {
  CameraSwitcher(this.p);
  final Map<String, dynamic> p;
  double held = 9;
  String? cur = '\u0000';
  String? pick(PocketGame g) {
    final fb = strOf(p['fallback']).isEmpty ? null : strOf(p['fallback']);
    if (p['mode'] == 'clear shot') {
      final t = g.findAll(strOf(p['target'], 'player')).firstOrNull;
      if (t == null) return fb;
      for (final name in tagList(p['cameras'])) { final c = g.find(name); if (c != null && g.canSee(c, t)) return name; }
      return fb;
    }
    final v = g.vars[strOf(p['var'], 'state')];
    for (final l in strOf(p['map']).split('\n')) {
      final m = RegExp(r'^\s*([^=]+?)\s*=\s*(.+?)\s*$').firstMatch(l);
      if (m != null && (m[1] == '$v' || (double.tryParse(m[1]!) != null && v is num && double.parse(m[1]!) == v))) return m[2];
    }
    return fb;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final d = CamDirector.of(g);
    d.tick(g, dt);
    held += dt;
    final want = pick(g);
    if (want == cur || held < numOf(p['hold'], 0.5)) return;
    cur = want; held = 0;
    d.live(g, want);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Turn-based games: whose turn it is, the enemy turn, grid movement, grid enemies, squads, boards and battle buttons
// ---------------------------------------------------------------------------------------------------------------

/// A component that acts on the enemy's turn (Turn Enemy, enemy Squad Units, Enemy Turn, the computer on a board).
mixin TurnTaker on Component {
  void onTurn(GameObject e, PocketGame g);
}

/// Whose turn it is: the player moves, then enemies act (after a short delay), then it's the player's turn again.
class Turns {
  Turns(PocketGame g) {
    if (g.settings['turnBased'] == true) { g.vars['turn'] ??= 1; g.vars['turnText'] = 'Your turn'; }
  }
  static Turns of(PocketGame g) => (g.systems['turns'] ??= Turns(g)) as Turns;
  /// player, enemy, or enemyBusy (enemies still walking).
  String side = 'player';
  double delay = 0, holdFor = 0, stamp = -1;
  final List<VoidCallback> onPlayerTurn = [];
  bool get isPlayerTurn => side == 'player';
  /// The player finished a move: enemies act next.
  void endTurn(PocketGame g) {
    if (side != 'player' || g.state != 'play') return;
    side = 'enemy';
    delay = numOf(g.settings['turnDelay'], 0.3);
    g.setVar('turnText', strOf(g.settings['enemyTurnText'], 'Enemy turn'));
  }
  /// Enemy turn: keep it going this long (enemies walking several tiles, one after another).
  void holdTurn(double sec) => holdFor = math.max(holdFor, sec);
  void playerTurn(PocketGame g) {
    side = 'player';
    g.addVar('turn', 1);
    g.setVar('turnText', strOf(g.settings['playerTurnText'], 'Your turn'));
    for (final f in [...onPlayerTurn]) { f(); }
  }
  /// Once a frame (whichever turn component runs first).
  void tick(PocketGame g, double dt) {
    if (stamp == g.time) return;
    stamp = g.time;
    if (g.state != 'play') return;
    if (side == 'enemy' && (delay -= dt) <= 0) {
      holdFor = 0;
      for (final o in [...g.objects]) { if (o.dead) continue; for (final c in o.parts) { if (c is TurnTaker) c.onTurn(o, g); } }
      if (g.state == 'play') { if (holdFor > 0) { side = 'enemyBusy'; delay = holdFor; } else { playerTurn(g); } }
    } else if (side == 'enemyBusy' && (delay -= dt) <= 0) { playerTurn(g); }
  }
}

bool _turnBased(PocketGame g) => g.settings['turnBased'] == true;

/// Is a grid tile blocked? Walls (static bodies, "wall" tags), squad units, turn enemies, "pushable" things, living enemies.
GameObject? blockerAt(PocketGame g, double x, double y, GameObject? except, [bool Function(GameObject)? skip]) {
  for (final o in g.objects) {
    if (o == except || o.dead || o.ui || (skip?.call(o) ?? false)) continue;
    final gu = o.part<GridUnit>();
    if (gu != null) { final h = gu.tile / 2 - 0.01; if ((gu.cx - x).abs() < h && (gu.cy - y).abs() < h) return o; continue; }
    final b = o.body, hb = o.part<Health>();
    final solid = (b != null && !b.sensor && (b.type == 'static' || o.tags.contains('wall'))) || o.part<GridEnemy>() != null || o.tags.contains('pushable') || (o.has('enemy') && hb != null && !hb.dead);
    if (!solid) continue;
    final h = o.half;
    if ((o.x - x).abs() < h.width - 0.01 && (o.y - y).abs() < h.height - 0.01) return o;
  }
  return null;
}

/// The grid the walls sit on (so heroes and enemies line up with the level).
Offset gridOrigin(PocketGame g, double t) {
  final cache = (g.systems['gridOrigin'] ??= <double, Offset>{}) as Map<double, Offset>;
  final hit = cache[t];
  if (hit != null) return hit;
  double m(double v) => (((v % t) + t) % t * 1000).round() / 1000;
  final ref = g.objects.where((o) => !o.dead && !o.ui && o.body != null && o.body!.type == 'static' && !o.body!.sensor).firstOrNull ?? g.objects.where((o) => !o.dead && o.part<GridMove>() != null).firstOrNull;
  return cache[t] = ref == null ? Offset.zero : Offset(m(ref.x), m(ref.y));
}
void snapToGrid(PocketGame g, GameObject e, double t) { final o = gridOrigin(g, t); e.x = ((e.x - o.dx) / t).round() * t + o.dx; e.y = ((e.y - o.dy) / t).round() * t + o.dy; }
/// Things on a grid that fight back: Turn Enemies, enemy units, and enemies with Health.
bool gridFoe(GameObject? o) => o != null && !o.dead && (o.part<GridEnemy>() != null || o.part<GridUnit>()?.team == 'enemy' || (o.has('enemy') && o.part<Health>() != null));
/// Shortest walk over free tiles: steps [(dx, dy)…], or null. The last tile may hold a foe (to attack it).
List<(int, int)>? gridPath(PocketGame g, GameObject e, double tx, double ty, double t, {bool diagonal = false, int maxCells = 900, bool foeOk = true, bool Function(GameObject?)? isFoe, bool Function(GameObject)? skip, Offset? from}) {
  final sx = from?.dx ?? e.x, sy = from?.dy ?? e.y, gx = ((tx - sx) / t).round(), gy = ((ty - sy) / t).round();
  if (gx == 0 && gy == 0) return [];
  final foe = isFoe ?? gridFoe, R = math.max(gx.abs(), gy.abs()) + 8;
  final prev = <(int, int), (int, int)?>{(0, 0): null}, q = <(int, int)>[(0, 0)];
  final dirs = diagonal ? const [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)] : const [(1, 0), (-1, 0), (0, 1), (0, -1)];
  GameObject? block(int i, int j) => blockerAt(g, sx + i * t, sy + j * t, e, skip);
  var head = 0;
  while (head < q.length && prev.length < maxCells) {
    final (i, j) = q[head++];
    if (i == gx && j == gy) {
      final out = <(int, int)>[];
      var c = (i, j);
      while (prev[c] != null) { final pv = prev[c]!; out.insert(0, (c.$1 - pv.$1, c.$2 - pv.$2)); c = pv; }
      return out;
    }
    for (final (dx, dy) in dirs) {
      final ni = i + dx, nj = j + dy, k = (ni, nj);
      if (prev.containsKey(k) || ni.abs() > R || nj.abs() > R) continue;
      if (dx != 0 && dy != 0 && (block(i + dx, j) != null || block(i, j + dy) != null)) continue; // (no cutting corners)
      final b = block(ni, nj), goal = ni == gx && nj == gy;
      if (b != null && !(goal && foeOk && foe(b))) continue;
      prev[k] = (i, j); q.add(k);
    }
  }
  return null;
}
/// A little nudge toward a direction and back (bumping a wall, attacking).
void gridNudge(PocketGame g, GameObject e, int dx, int dy, double t) {
  final x0 = e.x, y0 = e.y, k = t * 0.25;
  g.tween(e, 'x', x0 + dx * k, 0.06); g.tween(e, 'y', y0 + dy * k, 0.06);
  g.after(0.07, () { g.tween(e, 'x', x0, 0.07); g.tween(e, 'y', y0, 0.07); });
}
/// Hurt whatever is on a grid tile: a Turn Enemy, a unit, or anything with Health.
double gridHurt(PocketGame g, GameObject target, double amount, GameObject? from) {
  final ge = target.part<GridEnemy>();
  if (ge != null) return ge.hurt(target, g, amount, from);
  final gu = target.part<GridUnit>();
  if (gu != null) return gu.hurt(target, g, amount, from);
  return target.part<Health>()?.damage(target, g, amount, from: from, knockback: 0) ?? 0;
}
void _barOver(GameObject e, String show, double hp, double max, Color full, Color low) {
  final k = max > 0 ? hp / max : 0.0;
  if (show == 'always' || (show != 'never' && hp < max)) { e.bars['health'] = (k, k > 0.5 ? full : k > 0.25 ? const Color(0xFFFFD23D) : low); } else { e.bars.remove('health'); }
  e.data['hp'] = hp; e.data['hpMax'] = max;
}

/// Grid Move: one tile at a time (arrow keys, joystick, swipes, or tap a tile to walk there around walls); bump enemies to attack, push "pushable" things.
/// In turn-based games each step ends your turn.
class GridMove extends Component {
  GridMove(this.p);
  final Map<String, dynamic> p;
  double busy = 0, held = 0;
  List<(int, int)> path = [];
  Offset? goal;
  double get tile => numOf(p['tile'], 40);
  (int, int)? dirOf(Offset a) {
    final ax = a.dx.abs() > 0.38 ? a.dx.sign.toInt() : 0, ay = a.dy.abs() > 0.38 ? a.dy.sign.toInt() : 0;
    if (onOf(p['diagonal'])) return ax != 0 || ay != 0 ? (ax, ay) : null;
    if (ax == 0 && ay == 0) return null;
    return a.dx.abs() > a.dy.abs() ? (ax, 0) : (0, ay);
  }
  void face(GameObject e, int dx, int dy) {
    final f = strOf(p['face'], 'flip left / right');
    if (f == 'turn') { e.rz = math.atan2(dy.toDouble(), dx.toDouble()) / deg; } else if (f != 'no' && dx != 0) { faceX(e, dx.toDouble()); }
  }
  /// One step: false if a wall stopped it; true if it moved, attacked or pushed.
  bool step(GameObject e, PocketGame g, int dx, int dy) {
    final t = tile, tx = e.x + dx * t, ty = e.y + dy * t, st = numOf(p['stepTime'], 0.14);
    face(e, dx, dy);
    final hit = blockerAt(g, tx, ty, e);
    if (gridFoe(hit)) {
      gridNudge(g, e, dx, dy, t); gridHurt(g, hit!, numOf(p['damage'], 1) + numOf(e.data['equipDamage']), e);
      path = []; goal = null; busy = math.max(0.16, st);
      if (_turnBased(g)) Turns.of(g).endTurn(g);
      return true;
    }
    if (hit != null && hit.tags.contains('pushable')) {
      final bx = hit.x + dx * t, by = hit.y + dy * t;
      if (blockerAt(g, bx, by, hit) != null) { gridNudge(g, e, dx, dy, t); g.buzz(); path = []; goal = null; busy = 0.15; return false; }
      g.tween(hit, 'x', bx, st); g.tween(hit, 'y', by, st);
    } else if (hit != null) { gridNudge(g, e, dx, dy, t); g.buzz(); path = []; goal = null; busy = 0.15; return false; }
    g.killTweens(e, 'x'); g.killTweens(e, 'y');
    e.x = e.x; g.tween(e, 'x', tx, st * 0.9); g.tween(e, 'y', ty, st * 0.9);
    e.data['gridX'] = tx; e.data['gridY'] = ty;
    if (p['sound'] != false) g.sfx('click');
    busy = st;
    if (_turnBased(g)) Turns.of(g).endTurn(g);
    return true;
  }
  @override
  void start(GameObject e, PocketGame g) {
    e.ensureBody('kinematic');
    if (p['snap'] != false) snapToGrid(g, e, tile);
    e.data['gridX'] = e.x; e.data['gridY'] = e.y;
    if (_turnBased(g)) Turns.of(g);
    if (p['marker'] != false) {
      g.overlays.add((c) {
        final gl = goal;
        if (gl == null || e.dead) return;
        final q = g.toScreen(gl.dx, gl.dy), r = tile * g.zoom * 0.32, k = 0.6 + 0.4 * math.sin(g.time * 6).abs();
        c.drawCircle(q, r, Paint()..color = Color.fromRGBO(255, 255, 255, 0.8 * k)..style = PaintingStyle.stroke..strokeWidth = 2.5);
      });
    }
  }
  bool tapIgnored(PocketGame g, Tap t) => g.objects.any((o) => o.ui && !o.dead && o.shown && o.parts.isNotEmpty && g.hits(o, t)) || g.tapTargets.any((o) => !o.dead && g.hits(o, t));
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (_turnBased(g)) Turns.of(g).tick(g, dt);
    busy -= dt;
    if (g.state != 'play') { path = []; goal = null; return; }
    (int, int)? want;
    for (final (d, v) in const [('left', (-1, 0)), ('right', (1, 0)), ('up', (0, -1)), ('down', (0, 1))]) { if (g.pressed.contains('swipe:$d')) { want = v; break; } }
    final a = dirOf(g.axis());
    if (want == null && a != null) { held += dt; if (held == dt) want = a; } else if (a == null) { held = 0; }
    if (want != null) { path = [want]; goal = null; }
    else if (p['tapToMove'] != false && g.taps.isNotEmpty) {
      final t = g.taps.where((q) => !tapIgnored(g, q)).firstOrNull;
      if (t != null) {
        final w = t.world, o = gridOrigin(g, tile), cx = ((w.dx - o.dx) / tile).round() * tile + o.dx, cy = ((w.dy - o.dy) / tile).round() * tile + o.dy;
        final from = Offset(numOf(e.data['gridX'], e.x), numOf(e.data['gridY'], e.y));
        if (p['tapMode'] == 'steps toward the tap') {
          final ox = w.dx - from.dx, oy = w.dy - from.dy;
          if (math.sqrt(ox * ox + oy * oy) > tile * 0.4) { path = [ox.abs() > oy.abs() ? (ox.sign.toInt(), 0) : (0, oy.sign.toInt())]; goal = null; }
        } else {
          final route = gridPath(g, e, cx, cy, tile, diagonal: onOf(p['diagonal']), from: from);
          if (route != null && route.isNotEmpty) { path = route; goal = Offset(cx, cy); } else if (route == null) { g.buzz(); g.message("Can't get there", 0.8); }
        }
      }
    }
    if (busy > 0 || (_turnBased(g) && !Turns.of(g).isPlayerTurn)) return;
    if (path.isEmpty && a != null && p['holdRepeat'] != false && held > 0.22) path = [a];
    if (path.isEmpty) { goal = null; return; }
    // (positions come from where the last step ends, not the tween in between)
    e.x = numOf(e.data['gridX'], e.x); e.y = numOf(e.data['gridY'], e.y);
    final (dx, dy) = path.removeAt(0);
    step(e, g, dx, dy);
    if (path.isEmpty) goal = null;
  }
}

/// The nearest thing a side goes after: team 'enemy' looks for the player (or player units); team 'player' for foes.
GameObject? gridTargetFor(PocketGame g, GameObject e, [String team = 'enemy', double maxDist = double.infinity]) {
  GameObject? best;
  var bd = maxDist;
  for (final o in g.objects) {
    if (o.dead || o == e || o.ui) continue;
    final u = o.part<GridUnit>();
    if (!(team == 'enemy' ? (u != null ? u.team == 'player' : o.has('player')) : (u != null ? u.team == 'enemy' : gridFoe(o)))) continue;
    final d = (Offset(o.x, o.y) - Offset(e.x, e.y)).distance;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

/// Turn Enemy: acts on each enemy turn (or every so often): walks toward the player around walls when it sees them,
/// wanders or goes home, and attacks when next to them. Bump it to hurt it.
class GridEnemy extends Component with TurnTaker {
  GridEnemy(this.p);
  final Map<String, dynamic> p;
  double hp = 1, max = 1, clock = 0;
  int turns = 0;
  Offset home = Offset.zero;
  double get tile => numOf(p['tile'], 40);
  void bar(GameObject e) => _barOver(e, strOf(p['showBar'], 'when hurt'), hp, max, const Color(0xFF5DFF8A), const Color(0xFFFF4D4D));
  double hurt(GameObject e, PocketGame g, double dmg, GameObject? from) {
    final hb = e.part<Health>();
    if (hb != null) return hb.damage(e, g, dmg, from: from, knockback: 0);
    hp -= dmg; e.invuln = 0.2; g.sfx('hit'); bar(e); e.data['flash'] = 0.12;
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFF5555), 12);
    g.popOver(e, '-${dmg.round()}', const Color(0xFFFF6B6B), 20);
    if (hp <= 0) { g.addVar('score', numOf(p['points'], 10)); e.destroy(); }
    return dmg;
  }
  void attack(GameObject e, PocketGame g, GameObject pl) {
    g.squash(e, 1.2);
    final dmg = numOf(p['attack'], 1);
    if (pl.part<GridUnit>() != null) { gridHurt(g, pl, dmg, e); }
    else if (pl.part<Health>() != null) { pl.part<Health>()!.damage(pl, g, dmg, from: e, knockback: 0); }
    else if (pl.invuln <= 0) { g.hurt(pl, 'damage'); }
  }
  bool moveTo(GameObject e, PocketGame g, int dx, int dy) {
    final t = tile, tx = e.x + dx * t, ty = e.y + dy * t, key = '${tx.round()},${ty.round()}';
    final res = (g.systems['gridRes'] ??= <String, Object>{'t': -1.0, 'set': <String>{}}) as Map<String, Object>;
    if (res['t'] != g.time) { res['t'] = g.time; (res['set'] as Set<String>).clear(); }
    final taken = res['set'] as Set<String>;
    if (taken.contains(key) || blockerAt(g, tx, ty, e) != null) return false;
    final pl = g.findAll('player').firstOrNull;
    if (pl != null && (pl.x - tx).abs() < t / 2 && (pl.y - ty).abs() < t / 2) return false;
    taken.add(key);
    g.tween(e, 'x', tx, 0.15); g.tween(e, 'y', ty, 0.15);
    if (dx != 0) faceX(e, dx.toDouble());
    return true;
  }
  void act(GameObject e, PocketGame g) {
    final pl = gridTargetFor(g, e, 'enemy');
    if (pl == null || e.dead) return;
    final t = tile, dx = ((pl.x - e.x) / t).round(), dy = ((pl.y - e.y) / t).round(), d = dx.abs() + dy.abs();
    if (d == 1) { attack(e, g, pl); return; }
    final sight = numOf(p['sight'], 6);
    if (sight == 0 || d <= sight) {
      final route = gridPath(g, e, pl.x, pl.y, t, maxCells: 400, foeOk: false);
      final first = route != null && route.isNotEmpty ? route.first : null;
      if (first != null && moveTo(e, g, first.$1, first.$2)) return;
      final tries = dx.abs() >= dy.abs() ? [(dx.sign, 0), (0, dy.sign)] : [(0, dy.sign), (dx.sign, 0)];
      for (final (mx, my) in tries) { if ((mx != 0 || my != 0) && moveTo(e, g, mx, my)) return; }
      return;
    }
    final mode = strOf(p['mode'], 'waits');
    if (mode == 'wanders') { final dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]..shuffle(_rng); for (final (mx, my) in dirs) { if (moveTo(e, g, mx, my)) return; } }
    else if (mode == 'goes back home') { final r = gridPath(g, e, home.dx, home.dy, t, maxCells: 400, foeOk: false); if (r != null && r.isNotEmpty) moveTo(e, g, r.first.$1, r.first.$2); }
  }
  @override
  void start(GameObject e, PocketGame g) {
    max = math.max(1, numOf(p['hp'], 1)); hp = max;
    if (p['snap'] != false) snapToGrid(g, e, tile);
    home = Offset(e.x, e.y);
    if (e.part<Health>() == null) bar(e);
    final pl = g.findAll('player').firstOrNull;
    if (pl != null && pl.part<Health>() == null && g.vars['lives'] == null) g.setVar('lives', 3);
    if (_turnBased(g)) Turns.of(g);
  }
  @override
  void onTurn(GameObject e, PocketGame g) { if (++turns % math.max(1, numOf(p['every'], 1).round()) != 0) return; act(e, g); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (_turnBased(g)) { Turns.of(g).tick(g, dt); return; }
    if (g.state != 'play') return;
    if ((clock += dt) >= math.max(0.15, numOf(p['realTime'], 0.7)) * math.max(1, numOf(p['every'], 1).round())) { clock = 0; act(e, g); }
  }
}

// ---- squads: grid units the player selects (one or many) and moves together: tactics and RTS games ----

GridUnit? unitOf(GameObject? o) => o == null || o.dead ? null : o.part<GridUnit>();
List<GameObject> squadUnits(PocketGame g, String team) => [for (final o in g.objects) if (!o.dead && unitOf(o)?.team == team) o];
Offset cellOfObj(GameObject o) { final u = unitOf(o); return u != null ? Offset(u.cx, u.cy) : Offset(o.x, o.y); }

/// The squad: who's selected, the selection box, effects; one per game (made by the first unit).
class Squad {
  Squad(this.g) {
    g.on((m) {
      final k = m.trim().toLowerCase();
      if (k == 'select all') { select(squadUnits(g, 'player').where(canAct).toList()); }
      else if (k == 'select none' || k == 'deselect') { select([]); }
      else if (k == 'select next') { final l = squadUnits(g, 'player').where(canAct).toList(); if (l.isNotEmpty) { final cur = sel.firstOrNull, i = cur == null ? -1 : l.indexOf(cur); select([l[(i + 1) % l.length]]); } }
      else if (k == 'stop') { for (final e in sel) { unitOf(e)?.stop(); } }
      else if (k == 'end turn' && _turnBased(g) && Turns.of(g).isPlayerTurn) { endTurn(); }
    });
    Turns.of(g).onPlayerTurn.add(() { ending = false; for (final e in squadUnits(g, 'player')) { unitOf(e)!.newTurn(e); } });
    g.overlays.add(draw);
  }
  static Squad of(PocketGame g) => (g.systems['squad'] ??= Squad(g)) as Squad;
  final PocketGame g;
  Map<String, dynamic> cfgRaw = {};
  Set<GameObject> sel = {};
  Map<String, Object?>? box;
  (GameObject, double)? last;
  final List<Map<String, Object?>> fx = [];
  double stamp = -1;
  bool ending = false;
  int hadPlayer = 0, hadEnemy = 0;
  String sync = '';
  T cfg<T>(String k, T d) => (cfgRaw[k] ?? d) as T;
  bool canAct(GameObject e) { final u = unitOf(e); return u != null && u.team == 'player' && (!_turnBased(g) || !u.done); }
  void select(List<GameObject> list) {
    final before = sel.map((e) => e.uid).join(',');
    sel = list.where(canAct).toSet();
    if (sel.map((e) => e.uid).join(',') == before) return;
    if (sel.isNotEmpty) g.buzz();
    g.setVar('selectedUnits', sel.length);
  }
  void endTurn() { sel.clear(); g.setVar('selectedUnits', 0); for (final e in squadUnits(g, 'player')) { unitOf(e)!.stop(); } Turns.of(g).endTurn(g); }
  /// Send units to a tile, or after a foe.
  void order(List<GameObject> units, {Offset? to, GameObject? attack}) {
    final list = units.where((e) => canAct(e) && !e.dead).toList();
    if (list.isEmpty) return;
    if (attack != null) { for (final e in list) { unitOf(e)!.order(e, attack: attack); } fx.add({'k': 'hit', 'e': attack, 't': g.time}); g.sfx('click'); return; }
    final where = formation(list, to!.dx, to.dy, strOf(cfgRaw['formation'], 'group'));
    var n = 0;
    for (final e in list) { final c = where[e]; if (c != null && unitOf(e)!.order(e, to: c)) n++; }
    fx.add({'k': 'tap', 'x': to.dx, 'y': to.dy, 't': g.time, 'ok': n > 0});
    if (n == 0) { g.message("Can't get there", 0.8); g.buzz(); } else { g.sfx('click'); }
  }
  /// Free tiles around a spot for a group, in formation (group, line, column, keep their shape).
  Map<GameObject, Offset> formation(List<GameObject> units, double gx, double gy, String mode) {
    final t = unitOf(units[0])!.tile, n = units.length;
    bool free(double x, double y) => blockerAt(g, x, y, null, (o) => units.contains(o)) == null;
    final seen = <(int, int)>{(0, 0)}, q = <(int, int)>[(0, 0)], out = <(int, int, Offset)>[];
    var head = 0;
    while (head < q.length && out.length < math.max(n * 4, n + 10) && seen.length < 900) {
      final (i, j) = q[head++];
      final x = gx + i * t, y = gy + j * t;
      if (free(x, y)) out.add((i, j, Offset(x, y)));
      for (final (a, b) in const [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]) { final k = (i + a, j + b); if (!seen.contains(k) && (i + a).abs() < 30 && (j + b).abs() < 30) { seen.add(k); q.add(k); } }
    }
    final res = <GameObject, Offset>{};
    if (mode == 'keep their shape') {
      final mx = units.map((e) => unitOf(e)!.cx).reduce((a, b) => a + b) / n, my = units.map((e) => unitOf(e)!.cy).reduce((a, b) => a + b) / n, used = <String>{};
      for (final e in units) { final u = unitOf(e)!, x = gx + ((u.cx - mx) / t).round() * t, y = gy + ((u.cy - my) / t).round() * t; if (free(x, y) && used.add('$x,$y')) res[e] = Offset(x, y); }
      final rest = out.where((c) => !used.contains('${c.$3.dx},${c.$3.dy}')).map((c) => c.$3).toList();
      for (final e in units) { if (res.containsKey(e) || rest.isEmpty) continue; final u = unitOf(e)!; rest.sort((a, b) => (a - Offset(u.cx, u.cy)).distance.compareTo((b - Offset(u.cx, u.cy)).distance)); res[e] = rest.removeAt(0); }
      return res;
    }
    double w((int, int, Offset) c) => mode == 'line' ? c.$2.abs() * 4.0 + c.$1.abs() : mode == 'column' ? c.$1.abs() * 4.0 + c.$2.abs() : math.sqrt((c.$1 * c.$1 + c.$2 * c.$2).toDouble());
    out.sort((a, b) => w(a).compareTo(w(b)));
    final cells = out.take(n).map((c) => c.$3).toList(), left = [...units];
    while (cells.isNotEmpty && left.isNotEmpty) { // (the closest pair first: nobody walks across the whole group)
      var bi = 0, bj = 0, bd = double.infinity;
      for (var i = 0; i < cells.length; i++) { for (var j = 0; j < left.length; j++) { final u = unitOf(left[j])!, d = (cells[i] - Offset(u.cx, u.cy)).distance; if (d < bd) { bd = d; bi = i; bj = j; } } }
      res[left[bj]] = cells[bi]; cells.removeAt(bi); left.removeAt(bj);
    }
    return res;
  }
  bool uiTap(Offset at) => g.objects.any((o) => o.ui && !o.dead && o.shown && o.parts.isNotEmpty && g.hitsAt(o, at)) || g.tapTargets.any((o) => !o.dead && unitOf(o) == null && g.hitsAt(o, at));
  GameObject? unitAt(Offset at, String team) => g.objects.where((o) => !o.dead && o.shown && unitOf(o)?.team == team && g.hitsAt(o, at)).firstOrNull;
  Offset cellAt(Offset screen, GameObject ref) { final t = unitOf(ref)!.tile, w = g.toWorld(screen), o = gridOrigin(g, t); return Offset(((w.dx - o.dx) / t).round() * t + o.dx, ((w.dy - o.dy) / t).round() * t + o.dy); }

  /// Once a frame: taps, the selection box, dragging units, ending the turn, winning and losing.
  void tick() {
    if (stamp == g.time) return;
    stamp = g.time;
    final tb = _turnBased(g);
    sel.removeWhere((e) => !canAct(e));
    final mine = squadUnits(g, 'player'), foes = [for (final o in g.objects) if (!o.dead && !o.ui && (unitOf(o)?.team == 'enemy' || o.part<GridEnemy>() != null)) o];
    hadPlayer = math.max(hadPlayer, mine.length); hadEnemy = math.max(hadEnemy, foes.length);
    final ready = tb ? mine.where((e) => !unitOf(e)!.done).length : mine.length, sig = '${sel.length},${mine.length},${foes.length},$ready';
    if (sig != sync) { sync = sig; g.setVar('selectedUnits', sel.length); g.setVar('unitsLeft', mine.length); g.setVar('enemiesLeft', foes.length); g.setVar('unitsReady', ready); }
    if (g.state != 'play') { box = null; return; }
    if (g.time > 0.3) {
      if (cfg('winWhenNoEnemies', true) != false && hadEnemy > 0 && foes.isEmpty) { g.win(); return; }
      if (cfg('loseWhenNoUnits', true) != false && hadPlayer > 0 && mine.isEmpty) { g.gameOver(); return; }
    }
    final myTurn = !tb || Turns.of(g).isPlayerTurn;
    if (tb && myTurn && cfg('autoEndTurn', true) != false && !ending && mine.isNotEmpty && mine.every((e) => unitOf(e)!.done && !unitOf(e)!.busy) && mine.any((e) => unitOf(e)!.acted)) {
      ending = true;
      g.after(0.35, () { if (Turns.of(g).isPlayerTurn && g.state == 'play') endTurn(); });
    }
    // dragging: a box over empty ground, a line from a unit (send it there), or moving the camera
    for (final ptr in g.pointers.values) {
      if (ptr.role != 'free' || (ptr.at - ptr.start).distance < 18) continue;
      if (box == null || box!['id'] != ptr.id) {
        if (uiTap(ptr.start)) continue;
        final u = myTurn ? unitAt(ptr.start, 'player') : null, drag = strOf(cfgRaw['drag'], 'draws a selection box');
        if (u != null && canAct(u)) { box = {'id': ptr.id, 'unit': u}; }
        else if (drag == 'moves the camera') { box = {'id': ptr.id, 'pan': true, 'p': ptr.start}; }
        else if (drag == 'draws a selection box' && myTurn) { box = {'id': ptr.id}; }
        else { continue; }
      }
      final b = box!;
      if (b['pan'] == true) { final pp = b['p'] as Offset; g.camX -= (ptr.at.dx - pp.dx) / g.zoom; g.camY -= (ptr.at.dy - pp.dy) / g.zoom; b['p'] = ptr.at; }
      b['a'] = ptr.start; b['b'] = ptr.at;
      break;
    }
    final b = box;
    if (b != null) {
      final up = g.ups.where((u) => u.id == b['id']).firstOrNull;
      if (up != null && b['pan'] != true && myTurn) {
        final unit = b['unit'] as GameObject?;
        if (unit != null) {
          final group = sel.contains(unit) ? [...sel] : [unit];
          if (!sel.contains(unit)) select([unit]);
          final foe = g.objects.where((o) => !o.dead && !o.ui && gridFoe(o) && g.hitsAt(o, up.at)).firstOrNull;
          if (foe != null) { order(group, attack: foe); } else { order(group, to: cellAt(up.at, unit)); }
        } else if (b['a'] != null) {
          final r = Rect.fromPoints(b['a'] as Offset, b['b'] as Offset);
          select(mine.where((e) => canAct(e) && r.contains(g.toScreen(e.x, e.y))).toList());
        }
      }
      if (up != null || !g.pointers.containsKey(b['id'])) box = null;
    }
    if (!myTurn) return;
    // taps: a finger lifted quickly without sliding
    for (final up in g.ups) {
      if (up.role != 'free' || (up.at - up.start).distance >= 18 || g.time - up.t0 > 0.6 || uiTap(up.at)) continue;
      final u = unitAt(up.at, 'player');
      if (u != null) {
        final dbl = last != null && last!.$1 == u && g.time - last!.$2 < 0.35;
        last = (u, g.time);
        if (dbl) { select(mine.where(canAct).toList()); last = null; break; }
        if (!canAct(u)) { g.message('${u.name} is done this turn', 0.9); g.buzz(); break; }
        if (strOf(cfgRaw['tapMode'], 'adds to the group') == 'picks just that one') { select(sel.length == 1 && sel.contains(u) ? [] : [u]); }
        else { final l = {...sel}; if (!l.remove(u)) l.add(u); select(l.toList()); }
        break;
      }
      if (sel.isEmpty) break;
      final foe = g.objects.where((o) => !o.dead && !o.ui && gridFoe(o) && g.hitsAt(o, up.at)).firstOrNull;
      if (foe != null) { order([...sel], attack: foe); break; }
      order([...sel], to: cellAt(up.at, sel.first));
      break;
    }
  }
  /// Tiles a unit can walk to this turn (turn-based).
  List<Offset> reach(GameObject e) {
    final u = unitOf(e)!, t = u.tile, cells = <Offset>[], seen = <(int, int), int>{(0, 0): 0}, q = <(int, int)>[(0, 0)];
    var head = 0;
    while (head < q.length) {
      final (i, j) = q[head++];
      final d = seen[(i, j)]!;
      if (d >= u.movesLeft) continue;
      for (final (a, b) in u.dirs) {
        final k = (i + a, j + b);
        if (seen.containsKey(k)) continue;
        final x = u.cx + k.$1 * t, y = u.cy + k.$2 * t, bl = blockerAt(g, x, y, e);
        if (bl != null && unitOf(bl)?.team != u.team) continue;
        seen[k] = d + 1; q.add(k);
        if (bl == null) cells.add(Offset(x, y));
      }
    }
    return cells;
  }
  /// Highlights: reachable tiles, foes in range, paths, the selection, tap markers, shots, the selection box.
  void draw(Canvas c) {
    if (g.state != 'play') return;
    final tb = _turnBased(g), now = g.time, color = colorOf(cfgRaw['color']) ?? const Color(0xFF4FC3F7), moveC = colorOf(cfgRaw['moveColor']) ?? color, atkC = colorOf(cfgRaw['attackColor']) ?? const Color(0xFFFF5252);
    final z = g.zoom, list = [...sel];
    void ring(GameObject e, Color col, [double k = 1]) {
      final t = unitOf(e)?.tile ?? 40, at = g.toScreen(e.x, e.y);
      c.drawCircle(at, math.max(10.0, t * 0.45 * z) * k, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = 3);
    }
    if (cfgRaw['showRange'] != false && list.isNotEmpty && tb && Turns.of(g).isPlayerTurn) {
      final done = <String>{}, paint = Paint()..color = moveC.withValues(alpha: 0.18);
      for (final e in list) {
        final u = unitOf(e)!;
        if (u.busy || u.attacked) continue;
        for (final cell in reach(e)) { if (!done.add('${cell.dx},${cell.dy}')) continue; final h = (u.tile / 2 - 1) * z, at = g.toScreen(cell.dx, cell.dy); c.drawRect(Rect.fromCenter(center: at, width: h * 2, height: h * 2), paint); }
      }
    }
    if (list.isNotEmpty) {
      final pulse = 0.55 + 0.45 * math.sin(now * 5).abs();
      for (final o in g.objects) { if (o.dead || o.ui || !gridFoe(o)) continue; if (list.any((e) { final u = unitOf(e)!; return !(tb && u.attacked) && u.inRange(o); })) ring(o, atkC.withValues(alpha: pulse), 1.05); }
    }
    for (final e in squadUnits(g, 'player')) {
      final u = unitOf(e)!;
      if (u.path.isEmpty || !(cfgRaw['showPaths'] != false && (sel.contains(e) || !tb))) continue;
      var x = u.cx, y = u.cy;
      final pts = [g.toScreen(e.x, e.y), g.toScreen(x, y)];
      for (final (dx, dy) in u.path) { x += dx * u.tile; y += dy * u.tile; pts.add(g.toScreen(x, y)); }
      final path = Path()..addPolygon(pts, false);
      c.drawPath(path, Paint()..color = color.withValues(alpha: 0.75)..style = PaintingStyle.stroke..strokeWidth = 3);
      c.drawCircle(pts.last, 5, Paint()..color = color.withValues(alpha: 0.9));
    }
    for (final e in list) { ring(e, color, 1 + 0.06 * math.sin(now * 6)); }
    fx.removeWhere((f) => now - (f['t'] as double) >= 0.6);
    for (final f in fx) {
      final k = (now - (f['t'] as double)) / 0.6;
      if (f['k'] == 'tap') { c.drawCircle(g.toScreen(f['x'] as double, f['y'] as double), 8 + k * 22, Paint()..color = (f['ok'] == true ? color : const Color(0xFFFF5252)).withValues(alpha: 1 - k)..style = PaintingStyle.stroke..strokeWidth = 3); }
      else if (f['k'] == 'hit' && !(f['e'] as GameObject).dead) { ring(f['e'] as GameObject, atkC.withValues(alpha: 1 - k), 1.4 - k * 0.4); }
      else if (f['k'] == 'shot' && k < 0.3) {
        final a = g.toScreen(f['x0'] as double, f['y0'] as double), b2 = g.toScreen(f['x1'] as double, f['y1'] as double), m = k / 0.3, at = a + (b2 - a) * m;
        c.drawLine(at - (b2 - a) * 0.12, at, Paint()..color = f['col'] as Color..strokeWidth = f['look'] == 'magic bolt' ? 5 : 3);
      }
    }
    final b = box;
    if (b != null && b['pan'] != true && b['b'] != null) {
      final a = b['a'] as Offset, e2 = b['b'] as Offset;
      if (b['unit'] != null) { c.drawLine(a, e2, Paint()..color = color..strokeWidth = 3); c.drawCircle(e2, 12, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 3); }
      else { final r = Rect.fromPoints(a, e2); c.drawRect(r, Paint()..color = color.withValues(alpha: 0.15)); c.drawRect(r, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 2); }
    }
  }
}

/// Squad Unit: a unit on a grid for tactics and strategy games. Selected units walk to tapped tiles in formation and attack tapped foes;
/// turn-based: each moves and attacks once per turn; real-time: they fight what comes in range. Enemy units are played by the computer.
class GridUnit extends Component with TurnTaker {
  GridUnit(this.p);
  final Map<String, dynamic> p;
  late final String team = p['team'] == 'enemy' ? 'enemy' : 'player';
  double cx = 0, cy = 0, hp = 1, max = 1, stepT = 0, cool = 0, wait = 0, think = 0;
  late int movesLeft = numOf(p['moves'], 4).round();
  bool attacked = false, acted = false, autoT = false;
  List<(int, int)> path = [];
  Offset? goal;
  GameObject? target, ent;
  PocketGame? g0;
  double get tile => numOf(p['tile'], 40);
  int get rng => math.max(1, numOf(p['range'], 1).round());
  late final List<(int, int)> dirs = onOf(p['diagonal']) ? const [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)] : const [(1, 0), (-1, 0), (0, 1), (0, -1)];
  bool isFoe(GameObject? o) => o != null && !o.dead && o != ent && (team == 'player' ? gridFoe(o) : (unitOf(o) != null ? unitOf(o)!.team == 'player' : o.has('player')));
  bool get busy => path.isNotEmpty || stepT > 0.02 || (target != null && !target!.dead && !(g0 != null && _turnBased(g0!) && attacked));
  bool get done { if (attacked) return true; if (movesLeft > 0) return false; final g = g0; return g == null || !g.objects.any((o) => isFoe(o) && inRange(o)); }
  bool inRange(GameObject? o) {
    if (o == null || o.dead) return false;
    final c = cellOfObj(o), dx = ((c.dx - cx) / tile).round().abs(), dy = ((c.dy - cy) / tile).round().abs();
    if (dx + dy == 0) return false;
    final diag = onOf(p['diagonal']);
    return rng <= 1 ? (diag ? math.max(dx, dy) <= 1 : dx + dy <= 1) : (diag ? math.max(dx, dy) : dx + dy) <= rng;
  }
  bool myPhase(PocketGame g) => !_turnBased(g) || (team == 'player' ? Turns.of(g).isPlayerTurn : !Turns.of(g).isPlayerTurn);
  bool friendSkip(GameObject o) => unitOf(o)?.team == team;
  bool plan(GameObject e, PocketGame g, [bool strict = false]) {
    final from = Offset(cx, cy);
    List<(int, int)>? route;
    final t = target;
    if (t != null) {
      final c = cellOfObj(t);
      route = gridPath(g, e, c.dx, c.dy, tile, diagonal: onOf(p['diagonal']), maxCells: 1500, from: from, skip: strict ? null : friendSkip, foeOk: true, isFoe: (b) => b == t);
      if (route != null && route.isNotEmpty) route.removeLast(); // (stop next to it)
    } else if (goal != null) {
      route = gridPath(g, e, goal!.dx, goal!.dy, tile, diagonal: onOf(p['diagonal']), maxCells: 1500, from: from, skip: strict ? null : friendSkip, foeOk: false);
    }
    if (route == null) { path = []; return false; }
    if (_turnBased(g)) route = route.take(math.max(0, movesLeft)).toList();
    path = route;
    return true;
  }
  void attack(GameObject e, PocketGame g, GameObject o) {
    final c = cellOfObj(o), dx = ((c.dx - cx) / tile).round().sign, dy = ((c.dy - cy) / tile).round().sign;
    if (dx != 0) faceX(e, dx.toDouble());
    cool = math.max(0.2, numOf(p['attackEvery'], 0.8)); attacked = true; acted = true;
    final dmg = math.max(0.0, numOf(p['damage'], 1)) + numOf(e.data['equipDamage']);
    void hit() { if (!o.dead) gridHurt(g, o, dmg, e); }
    final shot = strOf(p['shot'], 'arrow');
    if (rng > 1 && shot != 'nothing') {
      Squad.of(g).fx.add({'k': 'shot', 'x0': e.x, 'y0': e.y, 'x1': o.x, 'y1': o.y, 't': g.time, 'look': shot, 'col': shot == 'magic bolt' ? const Color(0xFFB388FF) : const Color(0xFFFFE082)});
      if (p['sound'] != false) g.sfx('click');
      g.after(0.17, hit);
    } else { gridNudge(g, e, dx, dy, tile); hit(); stepT = math.max(stepT, 0.17); }
  }
  /// Walk to a tile, or go after a foe; false if there's no way.
  bool order(GameObject e, {Offset? to, GameObject? attack}) {
    final g = g0;
    if (g == null || e.dead) return false;
    if (_turnBased(g) && attacked) return false;
    wait = 0; autoT = false;
    if (attack != null) {
      target = attack; goal = null;
      if (inRange(target)) { path = []; return true; }
      if (!plan(e, g) || path.isEmpty) { if (team == 'player') g.message("Can't reach it", 0.8); target = null; return false; }
      return true;
    }
    target = null; goal = to;
    if (to!.dx == cx && to.dy == cy) { goal = null; path = []; return true; }
    if (!plan(e, g) || path.isEmpty) { goal = null; return false; }
    return true;
  }
  void stop() { path = []; goal = null; target = null; }
  void newTurn(GameObject e) { movesLeft = numOf(p['moves'], 4).round(); attacked = false; acted = false; e.alpha = 1; }
  void bar(GameObject e) => _barOver(e, strOf(p['showBar'], 'always'), hp, max, team == 'player' ? const Color(0xFF4FC3F7) : const Color(0xFFFF7043), team == 'player' ? const Color(0xFFFFD23D) : const Color(0xFFFF4D4D));
  double hurt(GameObject e, PocketGame g, double dmg, GameObject? from) {
    final hb = e.part<Health>();
    if (hb != null) return hb.damage(e, g, dmg, from: from, knockback: 0);
    hp -= dmg; e.invuln = 0.2; if (p['sound'] != false) g.sfx('hit'); bar(e);
    g.popOver(e, '-${dmg.round()}', const Color(0xFFFF6B6B), 20);
    g.squash(e, 1.15);
    if (from != null && !from.dead && target == null && path.isEmpty && isFoe(from) && p['fight'] != 'only does what it’s told' && !_turnBased(g)) { target = from; plan(e, g); } // (fight back)
    if (hp <= 0) {
      if (team == 'enemy') g.addVar('score', numOf(p['points'], 10));
      g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFFF5555), 16);
      g.send('unit defeated'); e.destroy();
    }
    return dmg;
  }
  @override
  void start(GameObject e, PocketGame g) {
    ent = e; g0 = g; max = math.max(1, numOf(p['hp'], 5)); hp = max;
    if (p['snap'] != false) snapToGrid(g, e, tile);
    cx = e.x; cy = e.y;
    e.tags.add(team == 'enemy' ? 'enemy' : 'ally'); e.tags.add('unit');
    if (e.part<Health>() == null) bar(e);
    Squad.of(g);
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    Turns.of(g).tick(g, dt);
    Squad.of(g).tick();
    stepT -= dt; cool -= dt;
    if (g.state != 'play' || e.dead) return;
    final tb = _turnBased(g);
    if (tb && team == 'player' && Turns.of(g).isPlayerTurn) e.alpha += ((done && !busy ? 0.5 : 1) - e.alpha) * math.min(1.0, dt * 8); // (finished units fade a little)
    if (!myPhase(g)) return;
    if (!tb && (think -= dt) <= 0) { // thinking on its own (real-time)
      think = 0.35 + _rng.nextDouble() * 0.2;
      final chase = team == 'enemy' || p['fight'] == 'chases foes it sees';
      if ((target == null && goal == null && path.isEmpty && p['fight'] != 'only does what it’s told') || (team == 'enemy' && goal == null)) {
        final sight = numOf(p['sight'], 6), f = gridTargetFor(g, e, team == 'enemy' ? 'enemy' : 'player', sight > 0 ? (sight + 0.5) * tile : double.infinity);
        if (f != null && (chase || inRange(f)) && f != target) { target = f; autoT = !chase; plan(e, g); }
      } else if (target != null && !target!.dead && !inRange(target) && team == 'enemy') { plan(e, g); }
    }
    if (stepT > 0) return;
    final k = math.min(1.0, dt * 14);
    e.x += (cx - e.x) * k; e.y += (cy - e.y) * k; // (settle on its tile)
    final t = target;
    if (t != null) {
      if (t.dead) { target = null; path = []; }
      else if (inRange(t)) {
        path = [];
        if (tb) { if (!attacked) attack(e, g, t); target = null; } else if (cool <= 0) { attack(e, g, t); }
        return;
      } else if (autoT) { target = null; autoT = false; path = []; }
      else if (path.isEmpty) { if (tb && movesLeft <= 0) { target = null; return; } if (!plan(e, g) || path.isEmpty) { target = null; return; } }
    }
    if (path.isEmpty) { if (goal != null) goal = null; return; }
    final (dx, dy) = path.first;
    final nx = cx + dx * tile, ny = cy + dy * tile;
    final b = blockerAt(g, nx, ny, e);
    if (b != null) {
      if (b == target) { path = []; return; }
      if (unitOf(b)?.team == team && (wait += dt) < 0.45) return; // (a friend is in the way: wait a moment)
      wait = 0;
      if (!plan(e, g, true) || path.isEmpty) { path = []; goal = null; }
      return;
    }
    wait = 0; path.removeAt(0); cx = nx; cy = ny; movesLeft--; acted = true;
    if (dx != 0) faceX(e, dx.toDouble());
    final st = math.max(0.03, numOf(p['stepTime'], 0.16));
    g.tween(e, 'x', nx, st * 0.92); g.tween(e, 'y', ny, st * 0.92); stepT = st;
    if (path.isEmpty && target == null && goal != null) goal = null;
  }
  /// Enemy units take their turn one after another.
  @override
  void onTurn(GameObject e, PocketGame g) {
    if (team != 'enemy') return;
    movesLeft = numOf(p['moves'], 4).round(); attacked = false;
    final list = squadUnits(g, 'enemy'), i = list.indexOf(e), st = math.max(0.03, numOf(p['stepTime'], 0.16));
    Turns.of(g).holdTurn(i * 0.3 + (movesLeft + 1) * st + 0.45);
    g.after(i * 0.3, () {
      if (e.dead || g.state != 'play') return;
      final sight = numOf(p['sight'], 6), f = gridTargetFor(g, e, 'enemy', sight > 0 ? (sight + 0.5) * tile : double.infinity);
      if (f == null) return;
      target = f;
      if (!inRange(f)) plan(e, g);
    });
  }
  @override
  void gone(GameObject e, PocketGame g) { (g.systems['squad'] as Squad?)?.sel.remove(e); }
}

/// Unit Commander: how the player commands Squad Units (tapping, box select or camera drag, formation, highlights, ending turns, win / lose).
class SquadControl extends Component {
  SquadControl(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) => Squad.of(g).cfgRaw = p;
  @override
  void update(GameObject e, double dt, PocketGame g) { Turns.of(g).tick(g, dt); Squad.of(g).tick(); }
}

// ---- boards and turn-based battles ----

/// Board Cell: a square of a tic-tac-toe style board: tap to place X; against the computer (it plays O on its turn) or two players.
class BoardCell extends Component with TurnTaker {
  BoardCell(this.p);
  final Map<String, dynamic> p;
  static List<GameObject> cells(PocketGame g) => [for (final o in g.objects) if (!o.dead && o.part<BoardCell>() != null) o];
  static GameObject? at(PocketGame g, int r, int c) => cells(g).where((x) => x.data['row'] == r && x.data['col'] == c).firstOrNull;
  static bool wins(PocketGame g, GameObject cell, String mark) {
    final r0 = cell.data['row'] as int, c0 = cell.data['col'] as int, line = cell.data['line'] as int;
    for (final (dr, dc) in const [(0, 1), (1, 0), (1, 1), (1, -1)]) {
      var n = 1;
      for (final sgn in const [1, -1]) { for (var k = 1; ; k++) { final o = at(g, r0 + dr * k * sgn, c0 + dc * k * sgn); if (o != null && o.data['mark'] == mark) { n++; } else { break; } } }
      if (n >= line) return true;
    }
    return false;
  }
  static bool place(PocketGame g, GameObject cell, String mark) {
    cell.data['mark'] = mark;
    final size = math.min(numOf(cell.shape?['w'], 80), numOf(cell.shape?['h'], 80));
    cell.text = {'value': mark, 'size': size * 0.62, 'weight': '900', 'color': mark == 'X' ? '#4fc3f7' : '#ff7043'};
    g.sfx(mark == 'X' ? 'click' : 'coin'); g.buzz();
    g.squash(cell, 0.85);
    final col = mark == 'X' ? const Color(0xFF4FC3F7) : const Color(0xFFFF7043);
    if (wins(g, cell, mark)) {
      g.burst(cell.x, cell.y, col, 30);
      if (cell.data['vs'] == true) { if (mark == 'X') { g.win(); } else { g.message('The computer wins!', 2); g.gameOver(); } }
      else { g.message('$mark wins!', 2.5); g.addVar('score', 1); g.win(); }
      return true;
    }
    if (cells(g).every((c) => '${c.data['mark']}'.isNotEmpty)) { g.message("It's a draw!", 1.4); g.after(1.5, g.start); return true; }
    return false;
  }
  @override
  void start(GameObject e, PocketGame g) {
    e.data.addAll({'row': numOf(p['row']).toInt(), 'col': numOf(p['col']).toInt(), 'line': numOf(p['line'], 3).toInt(), 'vs': p['vsComputer'] != false, 'mark': ''});
    g.vars['turnText'] = p['vsComputer'] != false ? 'Your turn (X)' : 'X to play';
    Turns.of(g);
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final t = Turns.of(g);
    t.tick(g, dt);
    if (g.state != 'play' || '${e.data['mark']}'.isNotEmpty || !t.isPlayerTurn) return;
    if (e.ui) g.tapTargets.add(e);
    if (g.tapsOn(e).isEmpty) return;
    final vs = p['vsComputer'] != false, mark = vs ? 'X' : strOf(g.vars['nextMark'], 'X');
    if (place(g, e, mark)) return;
    if (vs) { g.settings['enemyTurnText'] = 'Computer is thinking…'; g.settings['playerTurnText'] = 'Your turn (X)'; g.settings['turnDelay'] = 0.5; t.endTurn(g); }
    else { final next = mark == 'X' ? 'O' : 'X'; g.vars['nextMark'] = next; g.setVar('turnText', '$next to play'); }
  }
  @override
  void onTurn(GameObject e, PocketGame g) {
    final all = cells(g);
    if (all.isEmpty || all.first != e || e.data['vs'] != true) return; // (one cell plays for the computer)
    final empty = all.where((c) => '${c.data['mark']}'.isEmpty).toList();
    if (empty.isEmpty) return;
    GameObject? tryMark(String mark) => empty.where((c) { c.data['mark'] = mark; final w = wins(g, c, mark); c.data['mark'] = ''; return w; }).firstOrNull;
    final mid = (math.sqrt(all.length) / 2).floor();
    final pick = tryMark('O') ?? tryMark('X') ?? empty.where((c) => c.data['row'] == mid && c.data['col'] == mid).firstOrNull ?? empty[_rng.nextInt(empty.length)];
    place(g, pick, 'O');
  }
}

/// Turn Button: on your turn, tap to change a variable by an amount (a range: an attack, a heal), maybe costing another (mana); then it's the enemy's turn.
class TurnAction extends Component {
  TurnAction(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final t = Turns.of(g);
    t.tick(g, dt);
    final cv = strOf(p['costVar']), cost = numOf(p['cost']);
    final ready = g.state == 'play' && t.isPlayerTurn && (cv.isEmpty || g.numVar(cv) >= cost);
    e.alpha += ((ready ? 1 : 0.45) - e.alpha) * math.min(1.0, dt * 10);
    if (e.ui) g.tapTargets.add(e);
    if (g.state != 'play' || !t.isPlayerTurn || g.tapsOn(e).isEmpty) return;
    if (cv.isNotEmpty && g.numVar(cv) < cost) { g.message('Not enough $cv', 1.2); g.buzz(true); return; }
    if (cv.isNotEmpty) g.addVar(cv, -cost);
    final n = pick(p['amount'] ?? const [-14, -8]).round(), v0 = g.numVar(strOf(p['var'], 'enemyHp'));
    var v = v0 + n;
    if (n < 0) v = math.max(0, v);
    if (numOf(p['max']) > 0) v = math.min(numOf(p['max']), v);
    g.setVar(strOf(p['var'], 'enemyHp'), v);
    g.message(strOf(p['text'], 'You hit for {n}!').replaceAll('{n}', '${n.abs()}'), math.max(0.8, numOf(g.settings['turnDelay'], 0.3) + 0.4));
    g.sfx(strOf(p['sound'], 'hit')); g.buzz();
    g.squash(e, 0.92);
    t.endTurn(g);
  }
}

/// Enemy Turn: on the enemy's turn, changes a variable by an amount (the enemy hits you for 6–12).
class TurnOpponent extends Component with TurnTaker {
  TurnOpponent(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) => Turns.of(g);
  @override
  void update(GameObject e, double dt, PocketGame g) => Turns.of(g).tick(g, dt);
  @override
  void onTurn(GameObject e, PocketGame g) {
    final n = pick(p['amount'] ?? const [-12, -6]).round(), k = strOf(p['var'], 'hp');
    g.setVar(k, math.max(0, g.numVar(k) + n));
    g.message(strOf(p['text'], 'The enemy hits you for {n}!').replaceAll('{n}', '${n.abs()}'), 1.4);
    g.sfx('hit'); g.buzz(true); g.shake = 8;
    g.squash(e, 1.15);
  }
}

// makeComponent: 'inventoryItem' => InventoryItem(p), 'craftingStation' => CraftingStation(p), 'loot' => Loot(p), 'resource' => ResourceNode(p), 'npc' => Npc(p), 'dialogue' => DialoguePart(p), 'uiHotbar' => InventorySlots(p, true), 'uiInventoryGrid' => InventorySlots(p, false), 'uiEquipment' => EquipmentHud(p), 'uiCrafting' => CraftingHud(p), 'uiQuestLog' => QuestLogHud(p), 'uiQuestJournal' => QuestJournalHud(p), 'uiQuestTracker' => QuestTrackerHud(p),

// ---------------------------------------------------------------------------------------------------------------
// Items, crafting, quests and dialogue (Game Settings › Items, Recipes, Quests, Dialogues)
// ---------------------------------------------------------------------------------------------------------------

/// Item types and rarity colours (the same as Pocket Engine).
const itemTypes = ['material', 'food', 'drink', 'potion', 'weapon', 'armor', 'tool', 'ammo', 'key', 'quest', 'misc'];
const itemTypeLabels = {'material': 'Material', 'food': 'Food', 'drink': 'Drink', 'potion': 'Potion', 'weapon': 'Weapon', 'armor': 'Armour', 'tool': 'Tool', 'ammo': 'Ammo', 'key': 'Key', 'quest': 'Quest item', 'misc': 'Other'};
const rarityColors = {'common': Color(0xFFB0BEC5), 'uncommon': Color(0xFF66BB6A), 'rare': Color(0xFF42A5F5), 'epic': Color(0xFFAB47BC), 'legendary': Color(0xFFFFA726)};
const equipSlots = ['hand', 'offhand', 'head', 'body', 'legs', 'feet', 'neck', 'ring'];
const _consumable = {'food', 'drink', 'potion', 'misc'};
const _defaultSlot = {'weapon': 'hand', 'armor': 'body', 'tool': 'hand'};

/// The equipment slot an item goes in ('' if it isn't worn or held).
String equipSlotOf(Map<String, dynamic> d) => d['slot'] == 'none' ? '' : strOf(d['slot'], _defaultSlot[strOf(d['type'], 'misc')] ?? '');

/// "Wood 3, Stone x2, 2 Rope, Hammer (keep)" → name, how many, kept?
List<(String, int, bool)> parseIngredients(Object? t) {
  if (t is List) return [for (final q in t) if (q is Map) (strOf(q['name']), numOf(q['n'], 1).toInt(), q['keep'] == true)];
  final out = <(String, int, bool)>[];
  for (var q in '${t ?? ''}'.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty)) {
    final keep = RegExp(r'\((keep|tool|not used up)\)\s*$', caseSensitive: false).hasMatch(q);
    q = q.replaceAll(RegExp(r'\s*\((keep|tool|not used up)\)\s*$', caseSensitive: false), '');
    var m = RegExp(r'^(\d+)\s*[x×]?\s+(.+)$').firstMatch(q);
    if (m != null) { out.add((m[2]!.trim(), int.parse(m[1]!), keep)); continue; }
    m = RegExp(r'^(.+?)\s*[x×]?\s*(\d+)$').firstMatch(q);
    if (m != null) { out.add((m[1]!.trim(), int.parse(m[2]!), keep)); continue; }
    out.add((q, 1, keep));
  }
  return out;
}

/// "Coin 3-6, Apple 1 50%, Gem 5%" → name, min, max, chance.
List<(String, int, int, double)> parseLoot(Object? t) {
  final out = <(String, int, int, double)>[];
  for (var q in '${t ?? ''}'.split(RegExp(r'[,\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty)) {
    var chance = 100.0, min = 1, max = 1;
    final c = RegExp(r'\s*@?\s*(\d+(?:\.\d+)?)\s*%$').firstMatch(q);
    if (c != null) { chance = double.parse(c[1]!); q = q.substring(0, c.start).trim(); }
    final n = RegExp(r'\s*[x×]?\s*(\d+)(?:\s*-\s*(\d+))?$').firstMatch(q);
    if (n != null) { min = int.parse(n[1]!); max = n[2] != null ? int.parse(n[2]!) : min; q = q.substring(0, n.start).trim(); }
    if (q.isNotEmpty) out.add((q, min, math.max(min, max), chance));
  }
  return out;
}

/// One quest objective: collect Wood 5 (take) · kill slime 3 · talk Guard · reach Castle [60] · craft Axe · use Apple · gather Wood · var coins >= 100 · message x · quest Other · anything else.
class Objective {
  Objective(this.type, this.target, this.n, {this.dist = 0, this.op = '', this.value = '', this.take = false, this.label = ''});
  final String type, target, op, value;
  final int n;
  final double dist;
  final bool take;
  String label;
}
List<Objective> parseObjectives(Object? text) {
  final out = <Objective>[];
  for (final raw in '${text ?? ''}'.split('\n').map((s) => s.trim()).where((s) => s.isNotEmpty && !s.startsWith('//'))) {
    final parts = raw.split('|').map((s) => s.trim()).toList();
    var body = parts[0];
    final label = parts.length > 1 ? parts[1] : '';
    var take = false;
    if (RegExp(r'\(take\)\s*$', caseSensitive: false).hasMatch(body)) { take = true; body = body.replaceAll(RegExp(r'\s*\(take\)\s*$', caseSensitive: false), ''); }
    final sp = body.indexOf(' '), type = (sp < 0 ? body : body.substring(0, sp)).toLowerCase(), rest = sp < 0 ? '' : body.substring(sp + 1).trim();
    (String, int) nameN(String s) { final k = RegExp(r'^(.+?)(?:\s+(\d+))?$').firstMatch(s); return k == null ? (s, 1) : (k[1]!.trim(), math.max(1, int.tryParse(k[2] ?? '') ?? 1)); }
    Objective o;
    if (['collect', 'kill', 'defeat', 'craft', 'use', 'gather', 'message'].contains(type)) { final (t, n) = nameN(rest); o = Objective(type == 'defeat' ? 'kill' : type, t, n, take: take); }
    else if (type == 'talk' || type == 'reach' || type == 'goto') { final k = RegExp(r'^(.+?)(?:\s+(\d+(?:\.\d+)?))?$').firstMatch(rest); o = Objective(type == 'goto' ? 'reach' : type, k != null ? k[1]!.trim() : rest, 1, dist: k != null && k[2] != null ? double.parse(k[2]!) : 0, take: take); }
    else if (type == 'var' && RegExp(r'^(\S+)\s*(>=|<=|==|!=|=|>|<|≥|≤)\s*(.+)$').hasMatch(rest)) { final m = RegExp(r'^(\S+)\s*(>=|<=|==|!=|=|>|<|≥|≤)\s*(.+)$').firstMatch(rest)!; o = Objective('var', m[1]!, 1, op: m[2]!, value: m[3]!.trim(), take: take); }
    else if (type == 'quest') { o = Objective('quest', rest, 1, take: take); }
    else { final m = RegExp(r'\s(\d+)$').firstMatch(body); o = Objective('custom', body, m != null ? int.parse(m[1]!) : 1, take: take); }
    final n = o.n > 1 ? '${o.n} ' : '';
    o.label = label.isNotEmpty ? label : switch (o.type) {
      'collect' => 'Collect ${o.n} ${o.target}', 'kill' => 'Defeat $n${o.target}', 'talk' => 'Talk to ${o.target}', 'reach' => 'Go to ${o.target}', 'craft' => 'Craft $n${o.target}',
      'use' => 'Use $n${o.target}', 'gather' => 'Gather ${o.n} ${o.target}', 'var' => '${o.target} ${o.op} ${o.value}', 'message' => o.target, 'quest' => 'Finish “${o.target}”', _ => o.target,
    };
    out.add(o);
  }
  return out;
}

/// "coins 50, xp 20, item Iron Sword 1, recipe Axe, message party, quest Next" → rewards (kind, name, amount).
List<(String, String, double)> parseRewards(Object? text) {
  final out = <(String, String, double)>[];
  for (final q in '${text ?? ''}'.split(RegExp(r'[,\n]')).map((s) => s.trim()).where((s) => s.isNotEmpty)) {
    RegExpMatch? m;
    if ((m = RegExp(r'^item\s+(.+?)(?:\s+(\d+))?$', caseSensitive: false).firstMatch(q)) != null) { out.add(('item', m![1]!, double.tryParse(m[2] ?? '') ?? 1)); continue; }
    if ((m = RegExp(r'^recipe\s+(.+)$', caseSensitive: false).firstMatch(q)) != null) { out.add(('recipe', m![1]!, 1)); continue; }
    if ((m = RegExp(r'^(?:message|send)\s+(.+)$', caseSensitive: false).firstMatch(q)) != null) { out.add(('message', m![1]!, 1)); continue; }
    if ((m = RegExp(r'^quest\s+(.+)$', caseSensitive: false).firstMatch(q)) != null) { out.add(('quest', m![1]!, 1)); continue; }
    if ((m = RegExp(r'^(\S+)\s+(-?[\d.]+)$').firstMatch(q)) != null) { out.add(('var', m![1]!, double.parse(m[2]!))); continue; }
    if ((m = RegExp(r'^(.+?)\s+(\d+)$').firstMatch(q)) != null) { out.add(('item', m![1]!, double.parse(m[2]!))); continue; }
    out.add(('item', q, 1));
  }
  return out;
}

/// The game's item, crafting, quest and dialogue systems (made the first time a component needs them).
class ItemSystems {
  ItemSystems(this.g) {
    for (final d in (g.gameData['items'] as List? ?? const [])) {
      if (d is Map && strOf(d['name']).trim().isNotEmpty) { final m = d.cast<String, dynamic>(); db[strOf(m['name']).trim().toLowerCase()] = {...m, 'name': strOf(m['name']).trim()}; }
    }
    recipes = [for (final r in (g.gameData['recipes'] as List? ?? const [])) if (r is Map && strOf(r['result']).isNotEmpty) r.cast<String, dynamic>()];
    questDefs = [for (final q in (g.gameData['quests'] as List? ?? const [])) if (q is Map && strOf(q['name']).isNotEmpty) q.cast<String, dynamic>()];
    dialogues = [for (final q in (g.gameData['dialogues'] as List? ?? const [])) if (q is Map && strOf(q['name']).isNotEmpty) q.cast<String, dynamic>()];
    g.on((m) => questEvent('message', m, 1));
    // the logic system's item, quest and dialogue instructions and conditions (Triggers, State Machine, Visual Script)
    String ps(Map<String, dynamic> p, String k) => g.fill(strOf(p[k]));
    final acts = (g.systems['actions'] ??= <String, Object? Function(LogicCtx, Map<String, dynamic>)>{}) as Map<String, Object? Function(LogicCtx, Map<String, dynamic>)>;
    acts['giveItem'] = (c, p) { add(ps(p, 'item'), numOf(p['amount'], 1).round(), icon: strOf(p['icon'])); return null; };
    acts['dropItem'] = (c, p) { dropNear(ps(p, 'item'), numOf(p['amount'], 1).round(), c.e); return null; };
    acts['useItemFx'] = (c, p) { use(ps(p, 'item'), c.e); return null; };
    acts['craftItem'] = (c, p) { craft(ps(p, 'item'), numOf(p['times'], 1).round()); return null; };
    acts['learnRecipe'] = (c, p) { learn(ps(p, 'item')); return null; };
    acts['questStart'] = (c, p) { startQuest(ps(p, 'quest')); return null; };
    acts['questComplete'] = (c, p) { completeQuest(ps(p, 'quest')); return null; };
    acts['questFail'] = (c, p) { failQuest(ps(p, 'quest')); return null; };
    acts['questReset'] = (c, p) { resetQuest(ps(p, 'quest')); return null; };
    acts['questAdvance'] = (c, p) { advanceQuest(ps(p, 'quest'), numOf(p['amount'], 1).round(), numOf(p['objective']).round()); return null; };
    acts['startDialogue'] = (c, p) { startDialogue(ps(p, 'dialogue'), start: strOf(p['section'], 'start')); return null; };
    final conds = (g.systems['conditions'] ??= <String, bool Function(LogicCtx, Map<String, dynamic>)>{}) as Map<String, bool Function(LogicCtx, Map<String, dynamic>)>;
    conds['hasItem'] = (c, p) => count(ps(p, 'item')) >= math.max(1, numOf(p['count'], 1));
    conds['canCraft'] = (c, p) => canCraft(ps(p, 'item'), numOf(p['times'], 1).round());
    conds['knowsRecipe'] = (c, p) => knows(ps(p, 'item'));
    conds['questIs'] = (c, p) { final st = questState(ps(p, 'quest')), want = strOf(p['state'], 'active'); return want == 'started' ? st != 'available' && st != 'locked' : want == 'not started' ? st == 'available' || st == 'locked' : st == want; };
    // a hidden helper object that runs every frame (first, and on paused screens too): dialogue taps, quest checks, deaths
    final t = GameObject(const {'name': '__systems'}, g);
    t.parts.add(_SystemsTicker(this)..type = '__systems');
    g.objects.insert(0, t);
    sync();
  }
  final PocketGame g;
  static ItemSystems of(PocketGame g) => (g.systems['items'] ??= ItemSystems(g)) as ItemSystems;

  // ---- inventory ----
  final Map<String, Map<String, dynamic>> db = {};
  final Map<String, int> inv = {};
  final Map<String, String> icons = {};
  final List<String> order = [];
  final Map<String, String> equipped = {};
  final Set<String> known = {};
  final Map<String, double> stations = {};
  late List<Map<String, dynamic>> recipes;
  (String, int, double, double)? crafting; // result, amount, started, seconds
  double _fullMsg = -9;

  /// The Items entry for a name (any case), or a plain one.
  Map<String, dynamic> def(String name) => db[name.trim().toLowerCase()] ?? {'name': name, 'icon': icons[name] ?? '', 'type': 'misc', 'plain': true};
  String nameOf(String n) => strOf(def(n)['name'], n);
  String iconOf(String n) => strOf(icons[nameOf(n)], strOf(def(n)['icon']));
  int stackOf(String n) => math.max(1, numOf(def(n)['stack'], numOf(g.settings['invStack'], 99)).round());
  int count(String name) => inv[name] ?? inv[nameOf(name)] ?? 0;
  int get slotsUsed { var n = 0; inv.forEach((k, v) => n += (v / stackOf(k)).ceil()); return n; }
  int get slotCount => math.max(0, numOf(g.settings['invSlots']).round());
  double get slotsFree => slotCount == 0 ? double.infinity : math.max(0, slotCount - slotsUsed).toDouble();
  double room(String name) {
    if (slotCount == 0) return double.infinity;
    final st = stackOf(name), have = count(name), part = have % st != 0 ? st - have % st : 0;
    return part + slotsFree * st;
  }
  /// Add (or with a negative n, take) items; respects inventory slots and stack sizes. Returns how many changed.
  int add(String name, int n, {String icon = '', bool force = false}) {
    if (name.isEmpty || n == 0) return 0;
    name = nameOf(name);
    if (n > 0 && !force) {
      final r = room(name);
      if (r < n) { if (g.time - _fullMsg > 1.5) { _fullMsg = g.time; g.message('Inventory full', 1.2); } if (r <= 0) return 0; n = r.toInt(); }
    }
    final before = inv[name] ?? 0, after = math.max(0, before + n);
    if (icon.isNotEmpty) icons[name] = icon;
    if (after > 0) { inv[name] = after; if (!order.contains(name)) order.add(name); } else { inv.remove(name); order.remove(name); }
    g.setVar('item_$name', after);
    sync();
    questCheckAll();
    return after - before;
  }
  /// Items as stacks in inventory order (what grids and hotbars show): name, icon, how many, its entry.
  List<(String, String, int, Map<String, dynamic>)> stacks([String filter = 'all']) {
    final out = <(String, String, int, Map<String, dynamic>)>[];
    for (final name in order) {
      final v = inv[name];
      if (v == null) continue;
      final d = def(name);
      if (filter != 'all' && filter.isNotEmpty && strOf(d['type'], 'misc') != filter) continue;
      final st = stackOf(name);
      var left = v;
      final ic = iconOf(name).isNotEmpty ? iconOf(name) : (name.length > 2 ? name.substring(0, 2) : name);
      while (left > 0) { final k = math.min(st, left); out.add((name, ic, k, d)); left -= k; }
    }
    return out;
  }
  void sync() {
    final s = [for (final k in order) if (inv[k] != null) '${iconOf(k).isNotEmpty ? iconOf(k) : k}×${inv[k]}'].join('  ');
    g.setVar('inventory', s.isEmpty ? '—' : s);
    g.setVar('slotsFree', slotsFree.isFinite ? slotsFree.toInt() : 999);
  }
  GameObject? player() { for (final o in g.objects) { if (!o.dead && o.has('player')) return o; } return null; }

  /// Use an item: eat / drink / heal / cure from its Items entry, or equip it (weapons, armour, tools).
  bool use(String name, [GameObject? user, bool? consume]) {
    if (count(name) <= 0) return false;
    final d = def(name);
    name = nameOf(name);
    user ??= player();
    if (equipSlotOf(d).isNotEmpty) return equip(name, user);
    final hb = user?.part<Health>();
    if (user != null) {
      if (numOf(d['heal']) > 0 && hb != null) hb.heal(user, g, numOf(d['heal']));
      for (final c in user.parts) {
        if (c is Need && ((c.key == 'hunger' && numOf(d['food']) > 0) || (c.key == 'thirst' && numOf(d['drink']) > 0))) {
          c.v = math.min(c.max, c.v + numOf(c.key == 'hunger' ? d['food'] : d['drink'])); c.check(user, g); c.sync(user, g);
        }
      }
      if (hb != null) {
        if (numOf(d['shield']) > 0) { hb.shield += numOf(d['shield']); hb.shieldMax = math.max(hb.shieldMax, hb.shield); }
        final cure = strOf(d['cure'], 'nothing');
        if (cure != 'nothing') { if (cure == 'everything') { hb.effects.clear(); } else { hb.effects.remove(cure); } }
        final fx = strOf(d['effect'], 'nothing');
        if (fx != 'nothing') hb.addEffect(user, fx, numOf(d['effectPower'], 1), numOf(d['effectTime'], 5));
      }
    }
    if (strOf(d['message']).isNotEmpty) g.send(strOf(d['message']));
    g.send('use $name'); g.send('use item');
    final used = consume ?? (d['plain'] == true ? true : (d['consume'] is bool ? d['consume'] as bool : _consumable.contains(strOf(d['type'], 'misc'))));
    if (used) add(name, -1);
    if (user != null && (numOf(d['heal']) > 0 || numOf(d['food']) > 0 || numOf(d['drink']) > 0)) g.popOver(user, '${strOf(d['icon'])} $name'.trim(), rarityColors[d['rarity']] ?? Colors.white, 18);
    questEvent('use', name, 1);
    return true;
  }
  /// Put an item into its equipment slot (what was there goes back into the inventory).
  bool equip(String name, [GameObject? user]) {
    final d = def(name);
    name = nameOf(name);
    final slot = equipSlotOf(d).isEmpty ? 'hand' : equipSlotOf(d);
    if (count(name) <= 0) return false;
    if (equipped[slot] != null) unequip(slot, user, true);
    add(name, -1); equipped[slot] = name; g.setVar('equip_$slot', name);
    applyEquip(user); g.sfx('click');
    return true;
  }
  bool unequip(String slot, [GameObject? user, bool swapping = false]) {
    final name = equipped[slot];
    if (name == null) return false;
    if (!swapping && room(name) < 1) { g.message('Inventory full', 1.2); return false; }
    equipped.remove(slot); add(name, 1, force: true); g.setVar('equip_$slot', '');
    applyEquip(user);
    return true;
  }
  /// Total of a stat (damage, armor, speed ×) over everything worn.
  double equipStat(String k) {
    final list = equipped.values.map((n) => numOf(def(n)[k]));
    return k == 'speed' ? list.fold(1.0, (m, v) => m * (v == 0 ? 1 : v)) : list.fold(0.0, (a, v) => a + v);
  }
  void applyEquip([GameObject? user]) {
    user ??= player();
    if (user == null) return;
    user.data['equipDamage'] = equipStat('damage'); user.data['equipArmor'] = equipStat('armor'); user.data['equipSpeed'] = equipStat('speed');
    g.setVar('equipDamage', equipStat('damage')); g.setVar('equipArmor', equipStat('armor'));
  }

  // ---- crafting ----
  Map<String, dynamic>? recipeFor(Object? item) {
    if (item is Map<String, dynamic>) return item;
    final k = '${item ?? ''}'.trim().toLowerCase();
    for (final r in recipes) { if (r['id'] == item || strOf(r['result']).toLowerCase() == k) return r; }
    return null;
  }
  bool knows(Object? r) { final q = recipeFor(r); return q != null && (q['locked'] != true || known.contains(strOf(q['result']).toLowerCase())); }
  bool learn(String item) { final r = recipeFor(item); if (r == null) return false; return known.add(strOf(r['result']).toLowerCase()); }
  bool nearStation(String name) { if (name.isEmpty) return true; final t = stations[name.toLowerCase()]; return t != null && g.time - t < 0.25; }
  List<String> craftMissing(Object? item, [int times = 1]) {
    final r = recipeFor(item);
    if (r == null) return ['no recipe'];
    final miss = <String>[];
    if (!knows(r)) miss.add('not learned');
    if (strOf(r['station']).isNotEmpty && !nearStation(strOf(r['station']))) miss.add('needs ${r['station']}');
    for (final (name, n, _) in parseIngredients(r['ingredients'])) { final have = count(name); if (have < n * times) miss.add('${n * times - have} $name'); }
    if (crafting != null) miss.add('busy');
    return miss;
  }
  bool canCraft(Object? r, [int times = 1]) => craftMissing(r, times).isEmpty;
  /// Craft a recipe: takes the ingredients and gives the result (after its time, if it has one).
  bool craft(Object? item, [int times = 1]) {
    final r = recipeFor(item);
    if (r == null || !canCraft(r, times)) return false;
    for (final (name, n, keep) in parseIngredients(r['ingredients'])) { if (!keep) add(name, -n * times); }
    final amount = math.max(1, numOf(r['amount'], 1).round()) * times, result = strOf(r['result']);
    void done() {
      crafting = null;
      final got = add(result, amount);
      if (got < amount) dropNear(result, amount - got);
      g.sfx('power');
      questEvent('craft', result, amount);
      final pl = player();
      if (pl != null) g.popOver(pl, '+$amount ${iconOf(result).isNotEmpty ? iconOf(result) : result}', const Color(0xFFFFD23D), 20);
    }
    final t = numOf(r['time']) * times;
    if (t > 0) { crafting = (result, amount, g.time, t); g.after(t, done); } else { done(); }
    return true;
  }
  /// Drop items on the ground near someone as pick-ups.
  GameObject? dropNear(String name, int n, [GameObject? at]) {
    if (n <= 0) return null;
    final d = def(name);
    name = nameOf(name);
    at ??= player();
    final ic = strOf(d['icon']);
    final look = ic.isNotEmpty && !ic.startsWith('art:') ? {'type': 'emoji', 'emoji': ic, 'w': 28, 'h': 28} : {'type': 'circle', 'r': 12, 'fill': '#ffd23d'};
    final o = GameObject({'name': name, 'shape': look, 'behaviors': [{'type': 'inventoryItem', 'item': name, 'icon': ic, 'amount': n, 'delay': 0.8}]}, g, x: (at?.x ?? 0) + rand(-40, 40), y: (at?.y ?? 0) + rand(-30, 10));
    g.objects.add(o);
    for (final c in o.parts) { c.start(o, g); }
    return o;
  }
  /// Roll a loot list and hand it out (into the inventory or onto the ground); what came up, as text.
  List<String> giveLoot(GameObject e, Object? list, bool into) {
    final got = <String>[];
    for (final (name, min, max, chance) in parseLoot(list)) {
      if (_rng.nextDouble() * 100 >= chance) continue;
      final n = min + _rng.nextInt(max - min + 1);
      if (n <= 0) continue;
      if (into) { final k = add(name, n); if (k < n) dropNear(name, n - k, e); }
      else { final step = math.max(1, (n / 3).ceil()); for (var i = 0; i < n; i += step) { dropNear(name, math.min(step, n - i), e); } }
      got.add('${iconOf(name)}$name${n > 1 ? ' ×$n' : ''}');
    }
    return got;
  }

  // ---- quests ----
  late List<Map<String, dynamic>> questDefs;
  final Map<String, Map<String, dynamic>> quests = {}; // lower-case name → state, prog, snap
  Map<String, dynamic>? questDef(String name) { final k = name.trim().toLowerCase(); for (final q in questDefs) { if (strOf(q['name']).trim().toLowerCase() == k) return q; } return null; }
  Map<String, dynamic>? questRec(String name) { final d = questDef(name); return d == null ? null : quests[strOf(d['name']).toLowerCase()]; }
  /// locked · available · active · ready · done · failed · unknown
  String questState(String name) {
    final d = questDef(name);
    if (d == null) return 'unknown';
    final r = questRec(name);
    if (r != null) return '${r['state']}';
    return tagList(d['requires']).every((q) => questState(q) == 'done') ? 'available' : 'locked';
  }
  /// Objectives with how far along each is: objective, have, done, waiting.
  List<(Objective, int, bool, bool)> questObjectives(String name) {
    final d = questDef(name);
    if (d == null) return [];
    final r = questRec(name), objs = parseObjectives(d['objectives']), out = <(Objective, int, bool, bool)>[];
    var blocked = false;
    for (var i = 0; i < objs.length; i++) {
      final o = objs[i];
      final prog = r == null ? <int>[] : (r['prog'] as List<int>);
      var have = r != null && i < prog.length ? prog[i] : 0;
      if (r != null && r['state'] != 'active') { have = o.n; }
      else if (o.type == 'collect') { have = math.min(o.n, count(o.target)); }
      else if (o.type == 'var') { have = storyCond('${o.target} ${o.op} ${o.value}', StoryEnv(this)) ? 1 : 0; }
      else if (o.type == 'quest') { have = questState(o.target) == 'done' ? 1 : 0; }
      final done = have >= o.n && !blocked;
      out.add((o, math.min(have, o.n), done, blocked));
      if (d['order'] == 'in order' && !done) blocked = true;
    }
    return out;
  }
  /// Something happened that objectives may count (kill / talk / message / craft / gather / use).
  void questEvent(String kind, Object? key, int n) {
    bool match(Objective o) {
      if (key is GameObject) return key.name.toLowerCase() == o.target.toLowerCase() || key.has(o.target);
      return '$key'.trim().toLowerCase() == o.target.toLowerCase();
    }
    for (final d in questDefs) {
      final name = strOf(d['name']), r = questRec(name);
      if (r == null || r['state'] != 'active') continue;
      final objs = questObjectives(name), prog = r['prog'] as List<int>;
      var changed = false;
      for (var i = 0; i < objs.length && i < prog.length; i++) {
        final (o, _, done, waiting) = objs[i];
        if (o.type == kind && !done && !waiting && match(o)) { prog[i] = math.min(o.n, prog[i] + n); changed = true; }
      }
      if (changed) questCheck(name, true);
    }
  }
  void questCheckAll() { for (final d in questDefs) { if (questRec(strOf(d['name']))?['state'] == 'active') questCheck(strOf(d['name'])); } }
  void questCheck(String name, [bool progressed = false]) {
    final d = questDef(name), r = questRec(name);
    if (d == null || r == null || r['state'] != 'active') return;
    final objs = questObjectives(name), snap = objs.map((o) => o.$2).join(',');
    if (snap != r['snap']) { final first = r['snap'] == null; r['snap'] = snap; if (!first || progressed) g.send('quest updated'); }
    if (objs.isEmpty || !objs.every((o) => o.$3)) return;
    if (d['turnIn'] == 'at giver' && strOf(d['giver']).isNotEmpty) { r['state'] = 'ready'; syncQuests(); g.message('Quest ready: Return to ${d['giver']}', 2); }
    else { completeQuest(name); }
  }
  void syncQuests() {
    final recs = quests.values;
    g.setVar('questsDone', recs.where((r) => r['state'] == 'done').length);
    g.setVar('questsActive', recs.where((r) => r['state'] == 'active' || r['state'] == 'ready').length);
    final tq = strOf(g.vars['trackedQuest']);
    if (tq.isNotEmpty && !['active', 'ready'].contains(questState(tq))) {
      g.setVar('trackedQuest', questDefs.map((q) => strOf(q['name'])).firstWhere((n) => ['active', 'ready'].contains(questState(n)), orElse: () => ''));
    }
  }
  bool startQuest(String name) {
    final d = questDef(name);
    if (d == null) return false;
    final st = questState(name);
    if (!(st == 'available' || st == 'failed' || (d['repeatable'] == true && st == 'done'))) return false;
    final n = strOf(d['name']);
    quests[n.toLowerCase()] = {'state': 'active', 'prog': List<int>.filled(parseObjectives(d['objectives']).length, 0), 't': g.time};
    final tq = strOf(g.vars['trackedQuest']);
    if (tq.isEmpty || !['active', 'ready'].contains(questState(tq))) g.setVar('trackedQuest', n);
    syncQuests(); g.message('New quest: $n', 2); g.sfx('power');
    questCheck(n);
    return true;
  }
  /// Finish a quest (hand it in): takes "(take)" items and gives the rewards.
  bool completeQuest(String name) {
    final d = questDef(name), st = questState(name);
    if (d == null || !['active', 'ready'].contains(st)) return false;
    for (final o in parseObjectives(d['objectives'])) { if (o.type == 'collect' && o.take) add(o.target, -o.n); }
    final n = strOf(d['name']);
    quests[n.toLowerCase()]!['state'] = 'done';
    final rs = parseRewards(d['rewards']);
    for (final (kind, rn, amount) in rs) {
      if (kind == 'item' || (kind == 'var' && def(rn)['plain'] != true)) { final got = add(rn, amount.round()); if (got < amount) dropNear(rn, amount.round() - got); }
      else if (kind == 'var') { g.addVar(rn, amount); }
      else if (kind == 'recipe') { learn(rn); }
      else if (kind == 'message') { g.send(rn); }
      else if (kind == 'quest') { g.after(0.8, () => startQuest(rn)); }
    }
    syncQuests(); g.sfx('win');
    g.message('Quest complete! $n${rs.isNotEmpty ? ' · ${rewardText(rs)}' : ''}', 2.5);
    questCheckAll();
    return true;
  }
  String rewardText(List<(String, String, double)> rs) => rs.map((r) {
        final (kind, name, n) = r;
        final k = n == n.roundToDouble() ? n.toInt().toString() : '$n';
        return kind == 'var' ? '${n > 0 ? '+' : ''}$k $name' : kind == 'item' ? '${iconOf(name)}$name${n > 1 ? ' ×$k' : ''}' : kind == 'recipe' ? '📜 $name' : kind == 'quest' ? 'New quest: $name' : '';
      }).where((s) => s.isNotEmpty).join('  ');
  bool failQuest(String name) { final r = questRec(name); if (r == null || !['active', 'ready'].contains(r['state'])) return false; r['state'] = 'failed'; syncQuests(); g.message('Quest failed: ${questDef(name)!['name']}', 2); return true; }
  bool resetQuest(String name) { final d = questDef(name); if (d == null) return false; quests.remove(strOf(d['name']).toLowerCase()); syncQuests(); return true; }
  /// Move a quest on by hand: the first unfinished custom / message objective, or objective number `which` (1 = first).
  bool advanceQuest(String name, [int n = 1, int which = 0]) {
    final r = questRec(name);
    if (r == null || r['state'] != 'active') return false;
    final objs = questObjectives(name), prog = r['prog'] as List<int>;
    final i = which > 0 ? which - 1 : objs.indexWhere((o) => !o.$3 && !o.$4 && (o.$1.type == 'custom' || o.$1.type == 'message'));
    if (i < 0 || i >= objs.length || i >= prog.length) return false;
    prog[i] = math.min(objs[i].$1.n, prog[i] + n); questCheck(name, true);
    return true;
  }

  // ---- dialogue ----
  late List<Map<String, dynamic>> dialogues;
  final Map<String, int> talked = {};
  DialogueState? dialog;
  Map<String, dynamic>? dialogueDef(String name) { final k = name.trim().toLowerCase(); for (final d in dialogues) { if (strOf(d['name']).trim().toLowerCase() == k) return d; } return null; }
  /// Start a conversation from a dialogue's name or a script.
  bool startDialogue(String src, {GameObject? npc, String start = 'start', bool pause = true, String then = '', String portrait = '', bool inline = false, String name = ''}) {
    if (dialog != null) return false;
    final d = dialogueDef(src), script = d != null ? strOf(d['script']) : src;
    if (script.isEmpty || (d == null && !inline && !RegExp(r'\n|:\s').hasMatch(script) && !RegExp(r'^[*#@?]|->').hasMatch(script))) return false;
    final nm = d != null ? strOf(d['name']) : name, key = (nm.isNotEmpty ? nm : npc?.name ?? 'dialogue').toLowerCase();
    final run = DialogueRunner(script, StoryEnv(this, npc: npc, first: (talked[key] ?? 0) == 0), start: start);
    talked[key] = (talked[key] ?? 0) + 1;
    if (npc != null) questEvent('talk', npc, 1);
    if (run.done) { if (then.isNotEmpty) g.send(then); return true; }
    final realPause = g.objects.any((o) => o.ui && !o.dead && o.showWhen == 'paused' && o.name != '__dialoguePause');
    final ds = DialogueState(run, npc: npc, name: nm, then: then, portrait: portrait.isNotEmpty ? portrait : strOf(d?['portrait']), pause: pause && !realPause);
    dialog = ds;
    if (ds.pause) {
      final hold = GameObject(const {'name': '__dialoguePause', 'ui': true, 'showWhen': 'paused', 'visible': false}, g); // (keeps the PAUSED card away)
      g.objects.add(hold); ds.hold = hold;
      g.paused = true;
    }
    g.panels.add(_dialogPanel);
    return true;
  }
  void endDialogue() {
    final d = dialog;
    if (d == null) return;
    dialog = null;
    g.panels.remove(_dialogPanel);
    if (d.pause) { g.paused = false; d.hold?.destroy(); }
    g.send('dialogue ended');
    if (d.then.isNotEmpty) g.send(d.then);
  }
  /// Typewriter, tap to finish the line, tap again for the next (or pick a choice).
  void stepDialog(double dt) {
    final d = dialog;
    if (d == null) return;
    final r = d.run, line = r.line;
    if (r.done || line == null) { endDialogue(); return; }
    d.chars = math.min(line.$2.length.toDouble(), d.chars + dt * 45);
    _layoutDialog(d);
    if (g.taps.isEmpty) return;
    final t = g.taps.first;
    g.taps.clear(); // (taps go to the conversation)
    if (d.chars < line.$2.length) { d.chars = line.$2.length.toDouble(); }
    else if (r.choices != null && r.choices!.isNotEmpty) {
      final k = d.choiceRects.indexWhere((q) => q.contains(t.screen));
      if (k < 0) return;
      r.choose(k); d.chars = 0;
    } else { r.next(); d.chars = 0; }
    g.sfx('click');
    if (r.done) endDialogue();
  }
  /// Where the box and choices go on this screen (the panel draws them there; taps are checked against them).
  void _layoutDialog(DialogueState d) {
    final line = d.run.line;
    if (line == null) return;
    final w = g.screen.width, h = g.screen.height, bw = math.min(w - 28, 560.0), x = (w - bw) / 2;
    final por = d.portraitFor(line.$1), pic = por.isNotEmpty ? 64.0 : 0.0;
    final tp = TextPainter(text: TextSpan(text: line.$2, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)), textDirection: TextDirection.ltr)..layout(maxWidth: math.max(40, bw - 40 - pic));
    final rows = (tp.height / 22).ceil();
    final double bh = math.max(math.max(pic > 0 ? 100.0 : 0.0, 128.0), 48.0 + rows * 24), y = h - g.safe.bottom - bh - 20;
    d.box = Rect.fromLTWH(x, y, bw, bh);
    d.choiceRects = [];
    final ch = d.run.choices;
    if (ch != null && d.chars >= line.$2.length) {
      var cy = y - 12 - ch.length * 58;
      for (var i = 0; i < ch.length; i++) { d.choiceRects.add(Rect.fromLTWH(x + 10, cy, bw - 20, 50)); cy += 58; }
    }
  }
  Widget _dialogPanel(BuildContext context) {
    final d = dialog;
    final line = d?.run.line;
    if (d == null || line == null || d.box == Rect.zero) return const Positioned(left: 0, top: 0, child: SizedBox.shrink());
    const acc = Color(0xFF4FA3FF), panel = Color(0xFF1E2235);
    final b = d.box, por = d.portraitFor(line.$1), shown = line.$2.substring(0, d.chars.floor().clamp(0, line.$2.length));
    final ready = d.chars >= line.$2.length, ch = d.run.choices;
    return Positioned.fill(child: IgnorePointer(child: Stack(children: [
      for (var i = 0; i < d.choiceRects.length && ch != null && i < ch.length; i++)
        Positioned.fromRect(rect: d.choiceRects[i], child: Container(
          decoration: BoxDecoration(color: panel.withValues(alpha: 0.96), borderRadius: BorderRadius.circular(25), border: Border.all(color: acc.withValues(alpha: 0.55), width: 1.5), boxShadow: const [BoxShadow(color: Color(0x4D000000), blurRadius: 12, offset: Offset(0, 3))]),
          child: Row(children: [
            const SizedBox(width: 13),
            Container(width: 24, height: 24, alignment: Alignment.center, decoration: const BoxDecoration(color: acc, shape: BoxShape.circle), child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900, decoration: TextDecoration.none))),
            const SizedBox(width: 11),
            Expanded(child: Text(ch[i].$1, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700, decoration: TextDecoration.none))),
          ]),
        )),
      Positioned.fromRect(rect: b, child: Container(
        decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color.lerp(panel, Colors.white, 0.06)!.withValues(alpha: 0.97), panel.withValues(alpha: 0.97)]), borderRadius: BorderRadius.circular(18), border: Border.all(color: acc.withValues(alpha: 0.5), width: 1.5), boxShadow: const [BoxShadow(color: Color(0x66000000), blurRadius: 26, offset: Offset(0, 8))]),
        padding: EdgeInsets.fromLTRB(por.isNotEmpty ? 84 : 20, 28, 20, 12),
        child: Align(alignment: Alignment.topLeft, child: Text(shown, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600, height: 1.3, decoration: TextDecoration.none))),
      )),
      if (por.isNotEmpty) Positioned(left: b.left + 14, top: b.top + 26, child: Container(width: 56, height: 56, alignment: Alignment.center, decoration: BoxDecoration(color: const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(14)), child: Text(por, style: const TextStyle(fontSize: 38, decoration: TextDecoration.none)))),
      if (line.$1.isNotEmpty) Positioned(left: b.left + 16, top: b.top - 15, child: Container(height: 30, padding: const EdgeInsets.symmetric(horizontal: 14), alignment: Alignment.center, decoration: BoxDecoration(color: acc, borderRadius: BorderRadius.circular(15)), child: Text(line.$1, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800, decoration: TextDecoration.none)))),
      if (ready && (ch == null || ch.isEmpty)) Positioned(left: b.right - 32, top: b.bottom - 30, child: Text(d.run.lastStep ? '✓' : '▼', style: const TextStyle(color: acc, fontSize: 16, fontWeight: FontWeight.w900, decoration: TextDecoration.none))),
    ])));
  }

  // ---- every frame ----
  final Map<int, GameObject> _withHealth = {};
  final Set<int> _counted = {};
  int _qt = 0;
  void tick(double dt) {
    stepDialog(dt);
    if (g.state != 'play' || g.paused) return;
    // deaths (Health running out) count for "kill" objectives
    void died(GameObject o) { if (_counted.add(o.uid)) questEvent('kill', o, 1); }
    for (final o in [..._withHealth.values]) {
      final gone = o.dead || !g.objects.contains(o);
      if (gone && o.part<Health>()?.dead == true) died(o);
      if (gone) _withHealth.remove(o.uid);
    }
    for (final o in g.objects) {
      final hb = o.part<Health>();
      if (hb == null) continue;
      if (hb.dead) { died(o); } else if (!o.dead) { _withHealth[o.uid] = o; }
    }
    if ((_qt++) % 6 != 0) return;
    for (final d in questDefs) {
      final name = strOf(d['name']);
      if (d['autoStart'] == true && questState(name) == 'available') startQuest(name);
      final r = questRec(name);
      if (r == null || r['state'] != 'active') continue;
      final pl = player();
      if (pl == null) continue;
      final objs = questObjectives(name), prog = r['prog'] as List<int>;
      for (var i = 0; i < objs.length && i < prog.length; i++) {
        final (o, _, done, waiting) = objs[i];
        if (o.type != 'reach' || done || waiting) continue;
        final t = g.find(o.target);
        if (t == null) continue;
        final size = math.max(t.half.width, t.half.height);
        if ((Offset(pl.x, pl.y) - Offset(t.x, t.y)).distance <= (o.dist > 0 ? o.dist : 60) + size) { prog[i] = 1; questCheck(name, true); }
      }
    }
  }
}

class _SystemsTicker extends Component {
  _SystemsTicker(this.s);
  final ItemSystems s;
  @override
  bool get always => true;
  @override
  void update(GameObject e, double dt, PocketGame g) => s.tick(dt);
}

// ---- dialogue scripts ----

/// A step of a dialogue script.
class DStep {
  DStep(this.k, {this.who = '', this.text = '', this.cond = '', this.go = '', this.cmd = '', this.once = false});
  final String k, who, text, cond, go, cmd;
  final bool once;
}

/// A conversation going on: the runner, who it's with, and where its box and choices are on the screen.
class DialogueState {
  DialogueState(this.run, {this.npc, this.name = '', this.then = '', this.portrait = '', this.pause = true});
  final DialogueRunner run;
  final GameObject? npc;
  final String name, then, portrait;
  final bool pause;
  GameObject? hold;
  double chars = 0;
  Rect box = Rect.zero;
  List<Rect> choiceRects = [];
  /// The face to show for a speaker: the NPC's portrait, or the dialogue's.
  String portraitFor(String who) {
    if (portrait.isNotEmpty && !portrait.startsWith('art:')) {
      if (npc == null || who.isEmpty || who.toLowerCase() == npc!.name.toLowerCase() || who.toLowerCase() == strOf(npc!.partNamed('npc') is Npc ? (npc!.partNamed('npc') as Npc).who(npc!) : '').toLowerCase()) return portrait;
    }
    return '';
  }
}

/// What a dialogue script can read and change: variables (my.x = the NPC's own), items, quests, messages.
class StoryEnv {
  StoryEnv(this.s, {this.npc, this.first = false});
  final ItemSystems s;
  final GameObject? npc;
  final bool first;
  Set<int> get chosen => npc == null ? <int>{} : (npc!.data['_chosen'] ??= <int>{}) as Set<int>;
  PocketGame get g => s.g;
  Object? getVar(String k) {
    if (k.startsWith('my.')) { final n = k.substring(3), npcPart = npc?.part<Npc>(); if (n == 'friendship' && npcPart != null) return g.numVar(npcPart.friendKey(npc!)); return npc?.data[n]; }
    return g.vars[k];
  }
  void setVar(String k, Object? v) {
    if (k.startsWith('my.')) { final n = k.substring(3), npcPart = npc?.part<Npc>(); if (n == 'friendship' && npcPart != null) { g.setVar(npcPart.friendKey(npc!), v); } else { npc?.data[n] = v; } return; }
    g.setVar(k, v);
  }
  int itemCount(String n) => s.count(n);
  void give(String n, int k) {
    if (k > 0) { final got = s.add(n, k); if (got < k) s.dropNear(n, k - got); if (got > 0) g.message('${s.iconOf(n)} ${s.nameOf(n)}${got > 1 ? ' ×$got' : ''}'.trim(), 1.2); }
    else { s.add(n, k); }
  }
  String questState(String n) => s.questState(n);
  void quest(String cmd, String n, int k) {
    switch (cmd) {
      case 'start': s.startQuest(n);
      case 'complete' || 'turnin': s.completeQuest(n);
      case 'fail': s.failQuest(n);
      case 'reset': s.resetQuest(n);
      case 'progress': s.advanceQuest(n, k);
      case 'track': g.setVar('trackedQuest', strOf(s.questDef(n)?['name'], n));
    }
  }
  String fill(String t) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
        final k = m[1]!, v = g.vars.containsKey(k) ? g.vars[k] : npc?.data[k];
        if (v is num) return formatNumber(v.toDouble());
        return v == null ? '{$k}' : '$v';
      });
}

/// Is a dialogue / quest condition true? (has Item [n] · quest Name is active · coins >= 10 · first · chance 30 · not … · and · or)
bool storyCond(String cond, StoryEnv env) {
  final c = cond.trim();
  if (c.isEmpty) return true;
  if (RegExp(r'\s(?:or|\|\|)\s', caseSensitive: false).hasMatch(c)) return c.split(RegExp(r'\s+(?:or|\|\|)\s+', caseSensitive: false)).any((q) => storyCond(q, env));
  if (RegExp(r'\s(?:and|&&)\s', caseSensitive: false).hasMatch(c)) return c.split(RegExp(r'\s+(?:and|&&)\s+', caseSensitive: false)).every((q) => storyCond(q, env));
  RegExpMatch? m;
  if ((m = RegExp(r'^(?:not|!)\s*(.+)$', caseSensitive: false).firstMatch(c)) != null) return !storyCond(m![1]!, env);
  if ((m = RegExp(r'^has\s+(.+?)(?:\s+(\d+))?$', caseSensitive: false).firstMatch(c)) != null) return env.itemCount(m![1]!) >= (int.tryParse(m[2] ?? '') ?? 1);
  if ((m = RegExp(r'^quest\s+(.+?)\s+(?:is\s+)?(locked|available|active|ready|done|failed|started|not started)$', caseSensitive: false).firstMatch(c)) != null) {
    final st = env.questState(m![1]!), w = m[2]!.toLowerCase();
    return w == 'started' ? ['active', 'ready', 'done'].contains(st) : w == 'not started' ? ['available', 'locked'].contains(st) : st == w;
  }
  if ((m = RegExp(r'^chance\s+(\d+(?:\.\d+)?)\s*%?$', caseSensitive: false).firstMatch(c)) != null) return _rng.nextDouble() * 100 < double.parse(m![1]!);
  if (RegExp(r'^first(\s+time)?$', caseSensitive: false).hasMatch(c)) return env.first;
  if ((m = RegExp(r'^(.+?)\s*(>=|<=|==|!=|≥|≤|≠|=|>|<)\s*(.+)$').firstMatch(c)) != null) {
    final a = env.getVar(m![1]!.trim()), b = m[3]!.trim().replaceAll(RegExp(r'''^["']|["']$'''), '');
    final op = const {'=': '==', '≥': '>=', '≤': '<=', '≠': '!='}[m[2]] ?? m[2]!;
    final bn = double.tryParse(b), an = a == null || '$a'.isEmpty ? 0.0 : double.tryParse('$a');
    if (b.isNotEmpty && bn != null && an != null) return switch (op) { '>=' => an >= bn, '<=' => an <= bn, '>' => an > bn, '<' => an < bn, '!=' => an != bn, _ => an == bn };
    final x = '${a ?? ''}';
    return op == '!=' ? x != b : op == '==' ? x == b : false;
  }
  final v = env.getVar(c);
  return v != null && v != false && v != 0 && v != '0' && v != '';
}

/// Run a dialogue "@command" (set / add / give / take / quest / send / sound / learn / end); 'end' finishes the conversation.
String? storyDo(String cmd, StoryEnv env) {
  final c = cmd.trim(), sp = c.indexOf(' '), verb = (sp < 0 ? c : c.substring(0, sp)).toLowerCase(), arg = sp < 0 ? '' : c.substring(sp + 1).trim();
  Object value(String t) { final s = t.trim().replaceAll(RegExp(r'''^["']|["']$'''), ''); return s.isNotEmpty && double.tryParse(s) != null ? double.parse(s) : s; }
  RegExpMatch? m;
  switch (verb) {
    case 'set': if ((m = RegExp(r'^(\S+)\s*(?:=|to)?\s*(.*)$', caseSensitive: false).firstMatch(arg)) != null) env.setVar(m![1]!, value(m[2]!));
    case 'add': if ((m = RegExp(r'^(\S+)\s+(-?[\d.]+)$').firstMatch(arg)) != null) env.setVar(m![1]!, numOf(env.getVar(m[1]!)) + double.parse(m[2]!));
    case 'give' || 'take': if ((m = RegExp(r'^(.+?)(?:\s+(\d+))?$').firstMatch(arg)) != null) env.give(m![1]!, (int.tryParse(m[2] ?? '') ?? 1) * (verb == 'take' ? -1 : 1));
    case 'quest':
      if ((m = RegExp(r'^(start|complete|finish|fail|turnin|turn in|reset|progress|track)\s+(.+?)(?:\s+(\d+))?$', caseSensitive: false).firstMatch(arg)) != null) {
        env.quest(m![1]!.toLowerCase().replaceAll(RegExp(r'\s+'), '').replaceAll('finish', 'complete'), m[2]!, int.tryParse(m[3] ?? '') ?? 1);
      }
    case 'send' || 'message': if ((m = RegExp(r'^(.+?)(?:\s+(-?[\d.]+))?$').firstMatch(arg)) != null) env.g.send(m![1]!);
    case 'sound': env.g.sfx(arg);
    case 'learn': if (env.s.learn(arg)) env.g.message('📜 New recipe: $arg', 1.4);
    case 'end' || 'stop': return 'end';
  }
  return null;
}

/// Plays a dialogue script: `line` is what to show (speaker, text), `choices` the buttons (or null), `done` when it's over.
class DialogueRunner {
  DialogueRunner(String script, this.env, {String start = 'start'}) {
    _parse(script);
    chosen = env.chosen;
    i = labels[start.toLowerCase()] ?? 0;
    advance();
  }
  final StoryEnv env;
  final List<DStep> steps = [];
  final Map<String, int> labels = {'start': 0};
  late Set<int> chosen;
  int i = 0, after = 0;
  bool done = false;
  (String, String)? line, lastLine;
  /// Choice buttons: text, where it goes, the step it is.
  List<(String, String, int)>? choices;
  /// Is the line showing the last thing before the end?
  bool get lastStep { var j = i; while (j < steps.length && steps[j].k == 'do') { j++; } return j >= steps.length || (steps[j].k == 'goto' && RegExp(r'^end$', caseSensitive: false).hasMatch(steps[j].go)); }

  void _parse(String src) {
    for (final raw in src.split('\n')) {
      final l = raw.trim();
      if (l.isEmpty || l.startsWith('//')) continue;
      RegExpMatch? m;
      if ((m = RegExp(r'^(?:#|==)\s*(.+?)\s*=*$').firstMatch(l)) != null) {
        if (steps.isNotEmpty && steps.last.k != 'goto') steps.add(DStep('goto', go: 'END'));
        labels[m![1]!.trim().toLowerCase()] = steps.length;
        continue;
      }
      if (l.startsWith('*')) {
        var t = l.substring(1).trim(), cond = '', go = '';
        var once = false;
        for (var k = 0; k < 4; k++) {
          final c = RegExp(r'^\[if\s+([^\]]+)\]\s*', caseSensitive: false).firstMatch(t);
          if (c != null) { cond = c[1]!.trim(); t = t.substring(c.end); continue; }
          final o = RegExp(r'^\(once\)\s*', caseSensitive: false).firstMatch(t);
          if (o != null) { once = true; t = t.substring(o.end); continue; }
          break;
        }
        final gm = RegExp(r'\s*->\s*(.+)$').firstMatch(t);
        if (gm != null) { go = gm[1]!.trim(); t = t.substring(0, gm.start).trim(); }
        steps.add(DStep('choice', text: t, cond: cond, once: once, go: go));
        continue;
      }
      if ((m = RegExp(r'^->\s*(.+)$').firstMatch(l)) != null) { steps.add(DStep('goto', go: m![1]!.trim())); continue; }
      if ((m = RegExp(r'^\?\s*(.+?)\s*->\s*(.+)$').firstMatch(l)) != null) { steps.add(DStep('if', cond: m![1]!.trim(), go: m[2]!.trim())); continue; }
      if (l.startsWith('@')) { steps.add(DStep('do', cmd: l.substring(1).trim())); continue; }
      m = RegExp(r'^([^:]{1,24}):\s+(.*)$').firstMatch(l);
      steps.add(m != null && !RegExp(r'^(https?|note)$', caseSensitive: false).hasMatch(m[1]!.trim()) ? DStep('say', who: m[1]!.trim(), text: m[2]!) : DStep('say', text: l));
    }
  }
  void finish() { done = true; line = null; choices = null; }
  bool jump(String go) {
    if (go.isEmpty || go.toLowerCase() == 'end') { finish(); return false; }
    final j = labels[go.toLowerCase()];
    if (j == null) { finish(); return false; }
    i = j;
    return true;
  }
  List<(String, String, int)>? readChoices() {
    var j = i;
    final list = <(String, String, int)>[];
    while (j < steps.length && steps[j].k == 'choice') {
      final s = steps[j];
      if (!(s.once && chosen.contains(j)) && storyCond(s.cond, env)) list.add((env.fill(s.text), s.go, j));
      j++;
    }
    after = j;
    return j > i ? list : null;
  }
  void advance() {
    var guard = 0;
    line = null; choices = null;
    while (!done) {
      if (++guard > 1000) return finish();
      if (i >= steps.length) return finish();
      final s = steps[i];
      if (s.k == 'say') {
        i++;
        line = lastLine = (s.who, env.fill(s.text));
        final ch = readChoices();
        if (ch != null) { if (ch.isNotEmpty) { choices = ch; } else { i = after; } }
        return;
      }
      if (s.k == 'choice') { final ch = readChoices()!; if (ch.isNotEmpty) { choices = ch; line = lastLine ?? ('', ''); return; } i = after; continue; }
      i++;
      if (s.k == 'goto') { if (!jump(s.go)) return; continue; }
      if (s.k == 'if') { if (storyCond(s.cond, env) && !jump(s.go)) return; continue; }
      if (s.k == 'do' && storyDo(s.cmd, env) == 'end') return finish();
    }
  }
  void next() { if (done || choices != null) return; advance(); }
  void choose(int k) {
    final c = choices;
    if (c == null || k < 0 || k >= c.length) return;
    chosen.add(c[k].$3);
    i = after; choices = null;
    if (c[k].$2.isNotEmpty && !jump(c[k].$2)) return;
    advance();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// World components: pick-ups, crafting stations, chests, resources, NPCs and dialogue
// ---------------------------------------------------------------------------------------------------------------

/// The nearest object with a tag.
GameObject? nearestTagged(PocketGame g, GameObject e, String tag) {
  GameObject? best;
  var bd = double.infinity;
  for (final o in g.objects) {
    if (o == e || o.dead || !o.has(tag)) continue;
    final d = (Offset(o.x, o.y) - Offset(e.x, e.y)).distance;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
double distTo(GameObject? a, GameObject b) => a == null ? double.infinity : (Offset(a.x, a.y) - Offset(b.x, b.y)).distance;

/// A label over an object in the world (screen pixels): a pill with text.
void drawPillOver(Canvas c, Offset at, String text, {Color bg = const Color(0x99000000), Color fg = Colors.white, double size = 13}) {
  final tp = TextPainter(text: TextSpan(text: text, style: TextStyle(color: fg, fontSize: size, fontWeight: FontWeight.w800)), textDirection: TextDirection.ltr)..layout();
  final r = Rect.fromCenter(center: at, width: tp.width + 18, height: tp.height + 8);
  c.drawRRect(RRect.fromRectAndRadius(r, Radius.circular(r.height / 2)), Paint()..color = bg);
  tp.paint(c, at - Offset(tp.width / 2, tp.height / 2));
}

/// Inventory Item: picked up into the inventory on touch or tap ({inventory} shows it), maybe pulled in like a magnet.
class InventoryItem extends Component {
  InventoryItem(this.p);
  final Map<String, dynamic> p;
  double age = 0;
  int n = 0;
  String get tag => strOf(p['tag'], 'player');
  String get pickup => strOf(p['pickup'], 'on touch');
  @override
  String? get wants => pickup != 'on tap' ? tag : null;
  void take(GameObject e, PocketGame g) {
    if (e.dead || age < numOf(p['delay'])) return;
    final s = ItemSystems.of(g), item = strOf(p['item'], 'Key'), d = s.def(item), icon = strOf(p['icon'], strOf(d['icon']));
    final got = s.add(item, n, icon: icon);
    if (got <= 0) return;
    g.sfx('power');
    g.burst(e.x, e.y, rarityColors[d['rarity']] ?? const Color(0xFFFFF59D), 12);
    if (p['note'] != false) g.message('$icon ${strOf(d['name'], item)}${got > 1 ? ' ×$got' : ''}'.trim(), 1.2);
    n -= got;
    if (n <= 0) e.destroy();
  }
  @override
  void start(GameObject e, PocketGame g) {
    ItemSystems.of(g);
    final a = numOf(p['amount'], 1).round(), b = numOf(p['amountMax']).round();
    n = b > a ? a + _rng.nextInt(b - a + 1) : a;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    age += dt;
    if (pickup != 'on touch') { if (e.ui) g.tapTargets.add(e); for (final _ in g.tapsOn(e)) { take(e, g); break; } }
    final mag = numOf(p['magnet']);
    if (mag > 0 && age >= numOf(p['delay'])) {
      final pl = nearestTagged(g, e, tag);
      if (pl != null) { final d = distTo(pl, e); if (d < mag && d > 1e-3) { final k = math.min(1.0, dt * 8); e.x += (pl.x - e.x) * k; e.y += (pl.y - e.y) * k; } }
    }
    if (pickup != 'on tap' && age >= numOf(p['delay']) && g.touching(e, (o) => o.has(tag)).isNotEmpty) take(e, g);
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) => take(e, g);
}

/// Crafting Station: recipes that need it (Workbench, Furnace…) can be made while the player is close; tap it to open crafting.
class CraftingStation extends Component {
  CraftingStation(this.p);
  final Map<String, dynamic> p;
  bool near = false;
  String get station => strOf(p['station'], 'Workbench');
  @override
  void start(GameObject e, PocketGame g) {
    ItemSystems.of(g);
    if (p['hint'] != false) {
      g.overlays.add((c) { if (!near || e.dead || !e.shown) return; drawPillOver(c, g.toScreen(e.x, e.y - e.half.height) - const Offset(0, 22), '🔨 $station'); });
    }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final s = ItemSystems.of(g), pl = nearestTagged(g, e, strOf(p['tag'], 'player')), now = distTo(pl, e) <= numOf(p['range'], 100);
    if (now) s.stations[station.toLowerCase()] = g.time;
    if (now != near) { near = now; if (now) { g.setVar('station', station); } else if (g.vars['station'] == station) { g.setVar('station', ''); } }
    for (final _ in g.tapsOn(e)) { g.setVar('station', station); g.send(strOf(p['message'], 'open crafting')); break; }
  }
}

/// Loot / Chest: gives (or drops) items with chances when tapped, touched, destroyed or on a message.
class Loot extends Component {
  Loot(this.p);
  final Map<String, dynamic> p;
  bool opened = false;
  String get when => strOf(p['when'], 'tapped');
  bool get into => strOf(p['into'], 'straight into the inventory') != 'onto the ground';
  @override
  String? get wants => when == 'touched by tag' ? strOf(p['tag'], 'player') : null;
  void open(GameObject e, PocketGame g) {
    if (opened && p['once'] != false) return;
    opened = true;
    final got = ItemSystems.of(g).giveLoot(e, p['loot'] ?? 'Coin 3-6\nApple 1 50%\nGem 1 10%', into);
    g.sfx('power'); g.burst(e.x, e.y, const Color(0xFFFFD23D), 18);
    if (got.isNotEmpty && into) { g.message(got.join('  '), 1.6); } else if (got.isEmpty && when != 'destroyed') { g.message('Empty', 1); }
    if (strOf(p['openIcon']).isNotEmpty && e.shape?['type'] == 'emoji') e.shape!['emoji'] = p['openIcon'];
    if (onOf(p['destroyAfter']) && when != 'destroyed') e.destroy();
  }
  @override
  void start(GameObject e, PocketGame g) {
    ItemSystems.of(g);
    if (when == 'message') g.on((m) { if (m == strOf(p['message'], 'open chest') && !e.dead) open(e, g); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (when != 'tapped') return;
    for (final _ in g.tapsOn(e)) {
      final reach = numOf(p['reach']);
      if (reach > 0 && distTo(nearestTagged(g, e, strOf(p['tag'], 'player')), e) > reach) { g.message('Too far away', 1); break; }
      open(e, g);
      break;
    }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) => open(e, g);
  @override
  void gone(GameObject e, PocketGame g) { if (when == 'destroyed' && g.state == 'play') open(e, g); }
}

/// Resource: trees, rocks and ore the player gathers items from by tapping or touching (maybe needing a tool); grows back.
class ResourceNode extends Component {
  ResourceNode(this.p);
  final Map<String, dynamic> p;
  int left = 0;
  double cool = 0, regrow = 0;
  bool regrowing = false;
  String get gather => strOf(p['gather'], 'tapping');
  String get tag => strOf(p['tag'], 'player');
  void hit(GameObject e, PocketGame g) {
    if (regrowing || cool > 0) return;
    cool = numOf(p['cooldown'], 0.3);
    final s = ItemSystems.of(g), reach = numOf(p['reach'], 120);
    if (reach > 0 && distTo(nearestTagged(g, e, tag), e) > reach) { g.message('Get closer', 0.8); return; }
    final tool = strOf(p['tool']);
    if (tool.isNotEmpty && s.count(tool) <= 0 && !s.equipped.values.any((q) => q.toLowerCase() == tool.toLowerCase())) { g.message('Needs ${RegExp(r'^[aeiou]', caseSensitive: false).hasMatch(tool) ? 'an' : 'a'} $tool', 1.2); return; }
    left--;
    g.squash(e, 0.92); g.sfx('hit');
    g.burst(e.x, e.y, colorOf(e.shape?['fill']) ?? const Color(0xFFA1887F), 8);
    final item = strOf(p['item'], 'Wood'), n = math.max(1, numOf(p['amount'], 1).round());
    if (strOf(p['into']) == 'onto the ground') { s.dropNear(item, n, e); }
    else { final k = s.add(item, n); if (k < n) { s.dropNear(item, n - k, e); } else { g.popOver(e, '+$n ${s.iconOf(item).isNotEmpty ? s.iconOf(item) : item}', Colors.white, 18); } }
    s.questEvent('gather', item, n);
    if (left > 0) return;
    if (strOf(p['bonus']).isNotEmpty) s.giveLoot(e, p['bonus'], strOf(p['into']) != 'onto the ground');
    if (numOf(p['respawn'], 20) > 0) { regrowing = true; regrow = numOf(p['respawn'], 20); e.visible = false; } else { e.destroy(); }
  }
  @override
  void start(GameObject e, PocketGame g) { ItemSystems.of(g); left = math.max(1, numOf(p['hits'], 3).round()); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    cool -= dt;
    if (regrowing) { if ((regrow -= dt) <= 0) { regrowing = false; left = math.max(1, numOf(p['hits'], 3).round()); e.visible = true; g.squash(e, 0.5); } return; }
    if (gather != 'touching') { if (e.ui) g.tapTargets.add(e); for (final _ in g.tapsOn(e)) { hit(e, g); break; } }
    if (gather != 'tapping' && g.touching(e, (o) => o.has(tag)).isNotEmpty) hit(e, g);
  }
}

/// Dialogue: a conversation box (speaker names, typewriter text, choices); starts on touch, tap, a message or the game starting.
class DialoguePart extends Component {
  DialoguePart(this.p);
  final Map<String, dynamic> p;
  bool done = false;
  String get trigger => strOf(p['trigger'], 'touched by tag');
  @override
  String? get wants => trigger == 'touched by tag' ? strOf(p['tag'], 'player') : null;
  void open(GameObject e, PocketGame g) {
    final s = ItemSystems.of(g);
    if ((done && p['once'] != false) || s.dialog != null) return;
    final dlg = strOf(p['dialogue']);
    final ok = dlg.isNotEmpty
        ? s.startDialogue(dlg, npc: e, pause: p['pause'] != false, then: strOf(p['then']), portrait: strOf(p['portrait']))
        : s.startDialogue(strOf(p['lines'], 'Guard: Halt! Who goes there?\nYou: Just a traveler.\nGuard: Fine. Watch out for slimes!'), npc: e, pause: p['pause'] != false, then: strOf(p['then']), portrait: strOf(p['portrait']), inline: true, name: e.name);
    if (ok) done = true;
  }
  @override
  void start(GameObject e, PocketGame g) {
    ItemSystems.of(g);
    if (trigger == 'game starts') g.after(0.01, () => open(e, g));
    if (trigger == 'message') g.on((m) { if (m == strOf(p['message'], 'talk') && !e.dead) open(e, g); });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (trigger != 'tapped') return;
    if (e.ui) g.tapTargets.add(e);
    if (g.tapsOn(e).isNotEmpty) open(e, g);
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) => open(e, g);
}

/// NPC: someone to talk to. Starts a dialogue, hands in finished quests, offers its quests (! and ? markers), sells and buys,
/// likes gifts, says things in a bubble, and stands still, wanders, walks a route or follows the player.
class Npc extends Component with Toucher {
  Npc(this.p);
  final Map<String, dynamic> p;
  bool near = false, walking = false;
  double cool = 0, barkT = 0, barkCool = 0, pauseT = 0, barkAt = 0;
  int routeI = 0, lastBark = -1;
  Offset home = Offset.zero;
  Offset? dest;
  List<Offset> route = [];
  String? bark;
  String get tag => strOf(p['tag'], 'player');
  String get startMode => strOf(p['start'], 'tapped when close');
  double get range => numOf(p['range'], 100);
  String who(GameObject e) => strOf(p['talkName'], e.name.isEmpty ? 'NPC' : e.name).trim();
  String friendKey(GameObject e) => 'friend_${who(e).replaceAll(RegExp(r'\W+'), '_')}';
  @override
  bool cares(GameObject other) => startMode == 'touched by tag' && other.has(tag);
  List<Map<String, dynamic>> gives(ItemSystems s, GameObject e) => s.questDefs.where((q) => strOf(q['giver']).trim().toLowerCase() == who(e).toLowerCase()).toList();
  String marker(ItemSystems s, GameObject e) {
    final g = gives(s, e);
    if (g.any((q) => s.questState(strOf(q['name'])) == 'ready')) return '?';
    if (g.any((q) => s.questState(strOf(q['name'])) == 'available')) return '!';
    return '';
  }
  List<List<String>> rows(Object? t) => '${t ?? ''}'.split('\n').map((l) => l.split('|').map((q) => q.trim()).toList()).where((r) => r[0].isNotEmpty).toList();
  double priceOf(ItemSystems s, List<String> r) => r.length > 1 && double.tryParse(r[1]) != null ? double.parse(r[1]) : math.max(1, numOf(s.def(r[0])['value'], 10));
  String fmt(double v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';
  List<String> get likes => tagList(p['likes']);
  /// Shop, sell and gift sections, plus a menu leading to them.
  (String, bool) extras(ItemSystems s, GameObject e, {bool shop = false, bool sell = false, bool gift = false, bool menuHave = false}) {
    final n = who(e), cur = strOf(p['currency'], 'coins').trim(), L = <String>[], menu = <String>[];
    final sells = rows(p['sells']), buys = rows(p['buys']);
    if (sells.isNotEmpty && !shop) {
      menu.add('* Buy -> shop');
      L.addAll(['# shop', '$n: Take a look!']);
      for (var i = 0; i < sells.length; i++) {
        final r = sells[i], pr = fmt(priceOf(s, r)), k = r.length > 2 ? (int.tryParse(r[2]) ?? 1) : 1;
        L.add('* [if $cur >= $pr] ${r[0]}${k > 1 ? ' ×$k' : ''} — $pr $cur -> buy$i');
        L.add('* [if $cur < $pr] ${r[0]} — $pr $cur (not enough) -> broke');
      }
      L.add('* Back -> menu');
      for (var i = 0; i < sells.length; i++) {
        final r = sells[i], k = math.max(1, r.length > 2 ? (int.tryParse(r[2]) ?? 1) : 1);
        L.addAll(['# buy$i', '@add $cur -${fmt(priceOf(s, r))}', '@give ${r[0]} $k', '@sound coin', '$n: Thank you!', '-> shop']);
      }
      L.addAll(['# broke', '$n: You don’t have enough $cur for that.', '-> shop']);
    }
    if (buys.isNotEmpty && !sell) {
      menu.add('* Sell -> sell');
      L.addAll(['# sell', '$n: What have you got for me?']);
      for (var i = 0; i < buys.length; i++) { L.add('* [if has ${buys[i][0]}] ${buys[i][0]} — ${fmt(priceOf(s, buys[i]))} $cur -> sold$i'); }
      L.add('* Back -> menu');
      for (var i = 0; i < buys.length; i++) { L.addAll(['# sold$i', '@take ${buys[i][0]} 1', '@add $cur ${fmt(priceOf(s, buys[i]))}', '@sound coin', '$n: Pleasure doing business.', '-> sell']); }
    }
    final lk = likes;
    if (lk.isNotEmpty && !gift) {
      menu.add('* Give a gift -> gift');
      L.addAll(['# gift', '$n: Oh? What is it?']);
      for (var i = 0; i < lk.length; i++) { L.add('* [if has ${lk[i]}] ${lk[i]} -> gave$i'); }
      L.add('* Never mind -> menu');
      for (var i = 0; i < lk.length; i++) { L.addAll(['# gave$i', '@take ${lk[i]} 1', '@add my.friendship 1', '@sound power', '$n: ${strOf(p['giftReply'], 'Thank you!')}', '-> menu']); }
    }
    if (menu.isNotEmpty && !menuHave) L.addAll(['# menu', ...menu, '* Bye -> END']);
    return (L.join('\n'), menu.isNotEmpty);
  }
  /// A dialogue made up on the spot: thanks for finished quests, offers the next one, then the shop / gift menu.
  String autoScript(ItemSystems s, GameObject e, List<Map<String, dynamic>> handed) {
    final n = who(e), L = <String>[];
    final (xt, xm) = extras(s, e);
    final next = xm ? 'menu' : 'END';
    for (final q in handed) { L.add('$n: ${strOf(q['thanks'], 'You did it! Thank you.')}'); }
    final gv = gives(s, e);
    final avail = gv.where((q) => s.questState(strOf(q['name'])) == 'available').firstOrNull, active = gv.where((q) => ['active', 'ready'].contains(s.questState(strOf(q['name'])))).firstOrNull;
    final lines = strOf(p['lines']).trim();
    if (avail != null) {
      L.addAll(['$n: ${strOf(avail['offer'], strOf(avail['desc'], 'I need your help with something.'))}', '* Accept -> accept', '* Not now -> $next', '# accept', '@quest start ${avail['name']}', '$n: ${strOf(avail['accepted'], 'Thank you! Come back when it’s done.')}']);
    } else if (active != null) { L.add('$n: ${strOf(active['reminder'], 'How is “${active['name']}” going?')}'); }
    else if (lines.isNotEmpty && handed.isEmpty) { L.add(lines); }
    else if (handed.isEmpty) { L.add('$n: ${strOf(p['greeting'], 'Hello there!')}'); }
    if (xm && !(lines.isNotEmpty && RegExp(r'^\s*\*', multiLine: true).hasMatch(lines) && avail == null && active == null && handed.isEmpty)) L.add('-> menu');
    return L.join('\n') + (xt.isNotEmpty ? '\n$xt' : '');
  }
  void talk(GameObject e, PocketGame g) {
    final s = ItemSystems.of(g);
    if (s.dialog != null || g.state != 'play') return;
    final handed = <Map<String, dynamic>>[];
    if (p['turnIn'] != false) { for (final q in gives(s, e)) { if (s.questState(strOf(q['name'])) == 'ready' && s.completeQuest(strOf(q['name']))) handed.add(q); } }
    final pause = p['pause'] != false, then = strOf(p['then']), portrait = strOf(p['portrait']);
    final dlg = strOf(p['dialogue']), def = dlg.isNotEmpty ? s.dialogueDef(dlg) : null;
    if (def != null) {
      final script = strOf(def['script']);
      bool has(String label) => RegExp('^\\s*(?:#|==)\\s*$label\\s*=*\\s*\$', multiLine: true, caseSensitive: false).hasMatch(script);
      final (xt, _) = extras(s, e, shop: has('shop'), sell: has('sell'), gift: has('gift'), menuHave: has('menu'));
      s.startDialogue(script + (xt.isNotEmpty ? '\n$xt' : ''), npc: e, pause: pause, then: then, portrait: portrait.isNotEmpty ? portrait : strOf(def['portrait']), inline: true, name: strOf(def['name']));
    } else if (dlg.isEmpty) {
      s.startDialogue(autoScript(s, e, handed), npc: e, pause: pause, then: then, portrait: portrait, inline: true, name: who(e));
    }
    bark = null; cool = 0.4;
  }
  void say(PocketGame g, String text) { bark = g.fill(text); barkT = 2.8; barkAt = g.time; }
  void face(GameObject e, double dx) { if (dx.abs() < 0.5) return; if (e.shape?['type'] == 'emoji') { e.data['flipX'] = dx > 0; } else { e.sx = e.sx.abs() * (dx < 0 ? -1 : 1); } }
  /// Walk toward a point; true once there.
  bool walkTo(GameObject e, double tx, double ty, double dt, [double stopAt = 0]) {
    final dx = tx - e.x, dy = ty - e.y, d = math.sqrt(dx * dx + dy * dy);
    if (d <= stopAt + 2) return true;
    final step = math.min(d - stopAt, numOf(p['speed'], 60) * dt);
    e.x += dx / d * step; e.y += dy / d * step;
    face(e, dx); walking = true;
    return false;
  }
  @override
  void start(GameObject e, PocketGame g) {
    final s = ItemSystems.of(g);
    home = Offset(e.x, e.y);
    if (startMode == 'message') g.on((m) { if (m == strOf(p['message'], 'talk') && !e.dead) talk(e, g); });
    if (likes.isNotEmpty && g.vars[friendKey(e)] == null) g.vars[friendKey(e)] = 0;
    route = [];
    for (final q in strOf(p['route']).split(RegExp(r'[\n;]')).map((x) => x.trim()).where((x) => x.isNotEmpty)) {
      final m = RegExp(r'^(-?[\d.]+)\s*,\s*(-?[\d.]+)$').firstMatch(q);
      if (m != null) { route.add(home + Offset(double.parse(m[1]!), double.parse(m[2]!))); continue; }
      final o = g.find(q);
      if (o != null) route.add(Offset(o.x, o.y));
    }
    g.overlays.add((c) {
      if (e.dead || !e.shown || g.state != 'play') return;
      final mk = p['markers'] != false ? marker(s, e) : '', bub = p['bubble'] != false && near && s.dialog == null && bark == null, tagOn = onOf(p['nameTag']);
      if (mk.isEmpty && !bub && bark == null && !tagOn) return;
      final q = g.toScreen(e.x, e.y - e.half.height);
      var y = q.dy - 22 + math.sin(g.time * 4) * 3;
      if (tagOn) {
        final f = likes.isNotEmpty ? math.min(5, g.numVar(friendKey(e)).toInt()) : 0;
        drawPillOver(c, Offset(q.dx, q.dy - 12), who(e) + (f > 0 ? '  ${'♥' * f}' : ''), size: 12);
        y -= 16;
      }
      if (mk.isNotEmpty) {
        c.drawCircle(Offset(q.dx, y), 13, Paint()..color = const Color(0xFFFFD23D));
        c.drawCircle(Offset(q.dx, y), 13, Paint()..color = const Color(0x8C000000)..style = PaintingStyle.stroke..strokeWidth = 3);
        final tp = TextPainter(text: TextSpan(text: mk, style: const TextStyle(color: Color(0xFF1B1B1B), fontSize: 18, fontWeight: FontWeight.w900)), textDirection: TextDirection.ltr)..layout();
        tp.paint(c, Offset(q.dx, y) - Offset(tp.width / 2, tp.height / 2));
      }
      if (bub) {
        final bx = q.dx + (mk.isNotEmpty ? 26 : 0);
        c.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(bx, y), width: 32, height: 26), const Radius.circular(10)), Paint()..color = const Color(0xF2FFFFFF));
        final tp = TextPainter(text: const TextSpan(text: '💬', style: TextStyle(fontSize: 14)), textDirection: TextDirection.ltr)..layout();
        tp.paint(c, Offset(bx, y) - Offset(tp.width / 2, tp.height / 2));
      }
      final bk = bark;
      if (bk != null && s.dialog == null) {
        final a = math.min(1.0, math.min(barkT * 3, (g.time - barkAt) * 6)).clamp(0.0, 1.0);
        final tp = TextPainter(text: TextSpan(text: bk, style: TextStyle(color: const Color(0xFF1B1B1B).withValues(alpha: a), fontSize: 13, fontWeight: FontWeight.w700)), textDirection: TextDirection.ltr, textAlign: TextAlign.center)..layout(maxWidth: 170);
        final w = tp.width + 20, h = tp.height + 12, by = y - (mk.isNotEmpty ? 20 : 4) - h;
        final paint = Paint()..color = Color.fromRGBO(255, 255, 255, 0.96 * a);
        c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(q.dx - w / 2, by, w, h), const Radius.circular(10)), paint);
        c.drawPath(Path()..moveTo(q.dx - 6, by + h - 1)..lineTo(q.dx, by + h + 7)..lineTo(q.dx + 6, by + h - 1)..close(), paint);
        tp.paint(c, Offset(q.dx - tp.width / 2, by + 6));
      }
    });
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final s = ItemSystems.of(g);
    cool -= dt; barkT -= dt; barkCool -= dt; pauseT -= dt; walking = false;
    if (bark != null && barkT <= 0) bark = null;
    final pl = nearestTagged(g, e, tag), d = distTo(pl, e), was = near;
    near = d <= range;
    final talking = s.dialog?.npc == e;
    // chatter
    final barks = strOf(p['barks']).split('\n').map((q) => q.trim()).where((q) => q.isNotEmpty).toList();
    if (barks.isNotEmpty && s.dialog == null && barkCool <= 0) {
      final every = p['barkWhen'] == 'every few seconds';
      if (every ? d < range * 4 : near && !was) {
        var i = _rng.nextInt(barks.length);
        if (barks.length > 1 && i == lastBark) i = (i + 1) % barks.length;
        lastBark = i; say(g, barks[i]);
        barkCool = every ? math.max(2, numOf(p['barkEvery'], 8)) : 6;
      }
    }
    // moving
    final mode = strOf(p['moveMode'], 'stands still');
    if (!talking && s.dialog == null && mode != 'stands still' && !(near && p['stopNear'] != false && mode != 'follows the player') && pauseT <= 0) {
      if (mode == 'follows the player' && pl != null) {
        final f = numOf(p['followDist'], 70);
        if (distTo(pl, e) > f * 1.15) walkTo(e, pl.x, pl.y, dt, f);
      } else if (mode == 'wanders around') {
        if (dest == null) { final r = numOf(p['wander'], 120), a = _rng.nextDouble() * math.pi * 2, k = math.sqrt(_rng.nextDouble()) * r; dest = home + Offset(math.cos(a) * k, math.sin(a) * k); }
        if (walkTo(e, dest!.dx, dest!.dy, dt)) { dest = null; pauseT = numOf(p['waitAt'], 1.5) * (0.5 + _rng.nextDouble()); }
      } else if (mode == 'patrols a route' && route.isNotEmpty) {
        final t = route[routeI % route.length];
        if (walkTo(e, t.dx, t.dy, dt)) { routeI = (routeI + 1) % route.length; pauseT = numOf(p['waitAt'], 1.5); }
      }
    }
    if (e.shape?['type'] == 'emoji') e.rz = walking ? math.sin(g.time * 14) * 6 : e.rz * 0.8; // a little waddle
    if (p['facePlayer'] != false && pl != null && (near || talking) && !walking) face(e, pl.x - e.x);
    if (s.dialog != null || cool > 0) return;
    if (startMode == 'player comes close' && near && !was) talk(e, g);
    if (startMode.startsWith('tapped')) {
      for (final _ in g.tapsOn(e)) { if (startMode == 'tapped when close' && !near) { g.message('Get closer to talk', 1); } else { talk(e, g); } break; }
    }
  }
  @override
  void touch(GameObject e, GameObject other, PocketGame g) { if (cool <= 0) talk(e, g); }
}

// ---------------------------------------------------------------------------------------------------------------
// HUD: hotbar, inventory grid, equipment, crafting, quest log / journal / tracker (native widgets over the game)
// ---------------------------------------------------------------------------------------------------------------

/// A HUD component drawn as Flutter widgets in its object's box (its own shape and text aren't drawn on the canvas).
abstract class HudPart extends Component {
  @override
  bool get always => true;
  bool _hooked = false;
  /// Draw it (r: its box on the screen, k: the HUD scale).
  Widget build(GameObject e, PocketGame g, Rect r, double k);
  void hook(GameObject e, PocketGame g) {
    if (_hooked) return;
    _hooked = true;
    final sh = e.shape;
    if (sh != null) e.shape = {'type': sh['type'] == 'circle' ? 'circle' : 'rect', 'w': sh['w'], 'h': sh['h'], 'r': sh['r']}; // (keeps its size, draws nothing)
    e.text = null;
    g.panels.add((ctx) {
      if (e.dead || !e.shown || !g.onScreen(e) || !g.objects.contains(e)) return const Positioned(left: 0, top: 0, child: SizedBox.shrink());
      final r = g.uiRect(e);
      return Positioned.fromRect(rect: r, child: IgnorePointer(child: DefaultTextStyle(style: const TextStyle(decoration: TextDecoration.none, color: Colors.white), child: build(e, g, r, g.uiK))));
    });
  }
  @override
  void start(GameObject e, PocketGame g) { ItemSystems.of(g); hook(e, g); }
  @override
  void update(GameObject e, double dt, PocketGame g) { ItemSystems.of(g); hook(e, g); if (e.ui) g.tapTargets.add(e); }
  /// Taps this frame inside a rectangle (screen pixels).
  Iterable<Tap> tapsIn(PocketGame g, Rect r) => g.taps.where((t) => r.contains(t.screen));
}

Text itemText(String t, double size, {FontWeight w = FontWeight.w700, Color c = Colors.white, TextAlign align = TextAlign.left, int lines = 1}) =>
    Text(t, maxLines: lines, overflow: TextOverflow.ellipsis, textAlign: align, style: TextStyle(color: c, fontSize: size, fontWeight: w, decoration: TextDecoration.none));

/// Inventory Grid and Hotbar: slots showing the inventory (stacks, rarity frames). Tap to pick, tap again to use / equip / drop.
class InventorySlots extends HudPart {
  InventorySlots(this.p, this.hotbar);
  final Map<String, dynamic> p;
  final bool hotbar;
  final Map<int, double> pop = {};
  String get v => strOf(p['var'], hotbar ? 'heldItem' : 'selectedItem');
  int get n => math.max(1, numOf(p['slots'], hotbar ? 6 : 12).round());
  /// The slots' rectangles on the screen.
  (List<Rect>, Rect) geo(Rect b, double k) {
    final cols = math.max(1, (hotbar ? n : numOf(p['columns'], 4).round())), rows = (n / cols).ceil(), gap = (hotbar ? 6 : 8) * k, ih = p['info'] == true ? 40 * k : 0.0;
    final sz = math.max(4.0, math.min((b.width - gap * (cols - 1)) / cols, (b.height - ih - gap * (rows - 1)) / rows));
    final ox = b.center.dx - (cols * sz + (cols - 1) * gap) / 2, oy = b.top + (b.height - ih - (rows * sz + (rows - 1) * gap)) / 2;
    final rects = [for (var i = 0; i < n; i++) Rect.fromLTWH(ox + (i % cols) * (sz + gap), oy + (i ~/ cols) * (sz + gap), sz, sz)];
    return (rects, Rect.fromLTWH(b.left, oy + rows * (sz + gap), b.width, ih));
  }
  void act(PocketGame g, ItemSystems s, String name) {
    final how = strOf(p['onUse'], 'use or equip');
    if (how == 'select only') return;
    if (how == 'drop') { if (s.add(name, -1) != 0) s.dropNear(name, 1); }
    else { s.use(name, s.player(), p['consume'] == false ? false : null); }
    if (s.count(name) <= 0) g.setVar(v, '');
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    for (final k in [...pop.keys]) { final x = pop[k]! - dt * 4; if (x <= 0) { pop.remove(k); } else { pop[k] = x; } }
    final s = ItemSystems.of(g), list = s.stacks(strOf(p['filter'], 'all'));
    final (rects, _) = geo(g.uiRect(e), g.uiK);
    if (hotbar && p['keys'] != false) {
      const digits = [LogicalKeyboardKey.digit1, LogicalKeyboardKey.digit2, LogicalKeyboardKey.digit3, LogicalKeyboardKey.digit4, LogicalKeyboardKey.digit5, LogicalKeyboardKey.digit6, LogicalKeyboardKey.digit7, LogicalKeyboardKey.digit8, LogicalKeyboardKey.digit9];
      for (var i = 0; i < digits.length && i < n; i++) {
        final down = g.keys.contains(digits[i]), was = e.data['key$i'] == true;
        e.data['key$i'] = down;
        if (down && !was) { g.setVar(v, i < list.length ? list[i].$1 : ''); pop[i] = 1; }
      }
    }
    for (final t in g.taps) {
      for (var i = 0; i < rects.length; i++) {
        if (!rects[i].contains(t.screen)) continue;
        g.sfx('click'); pop[i] = 1;
        if (i >= list.length) { g.setVar(v, ''); break; }
        final name = list[i].$1;
        if (strOf(g.vars[v]) == name && p['useOnSecondTap'] != false) { act(g, s, name); } else { g.setVar(v, name); }
        break;
      }
    }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final s = ItemSystems.of(g), list = s.stacks(strOf(p['filter'], 'all'));
    final (rects, info) = geo(b, k);
    final txt = colorOf(p['text']) ?? Colors.white, acc = colorOf(p['accent']) ?? const Color(0xFFFFD23D), slotC = colorOf(p['slot']) ?? const Color(0x14FFFFFF), border = colorOf(p['border']) ?? const Color(0x26FFFFFF);
    final kids = <Widget>[];
    for (var i = 0; i < rects.length; i++) {
      final r = rects[i].shift(-b.topLeft), it = i < list.length ? list[i] : null, on = it != null && strOf(g.vars[v]) == it.$1;
      final rc = it != null && p['rarity'] != false && strOf(it.$4['rarity'], 'common') != 'common' ? rarityColors[it.$4['rarity']] : null;
      final sc = 1 + math.sin((pop[i] ?? 0) * math.pi) * 0.08, sz = r.width;
      kids.add(Positioned.fromRect(rect: r, child: Transform.scale(scale: sc, child: Container(
        decoration: BoxDecoration(color: rc != null ? rc.withValues(alpha: 0.18) : slotC, borderRadius: BorderRadius.circular(10 * k), border: Border.all(color: on ? acc : rc ?? border, width: on ? 3 : rc != null ? 2 : 1.5)),
        child: Stack(children: [
          if (hotbar && p['numbers'] != false) Positioned(left: 5 * k, top: 3 * k, child: itemText('${i + 1}', 9 * k, w: FontWeight.w800, c: txt.withValues(alpha: 0.5))),
          if (it != null) Center(child: Padding(padding: EdgeInsets.only(bottom: p['labels'] == true ? 12 * k : 0), child: Text(it.$2, style: TextStyle(fontSize: sz * 0.42, decoration: TextDecoration.none)))),
          if (it != null && it.$3 > 1) Positioned(right: 5 * k, bottom: 2 * k, child: itemText('${it.$3}', math.max(10, sz * 0.2), w: FontWeight.w900, c: txt)),
          if (it != null && p['labels'] == true) Positioned(left: 2, right: 2, bottom: 3 * k, child: itemText(it.$1, 9.5 * k, c: txt.withValues(alpha: 0.8), align: TextAlign.center)),
        ]),
      ))));
    }
    if (p['info'] == true) {
      final pick = list.where((q) => q.$1 == strOf(g.vars[v])).firstOrNull;
      final r = info.shift(-b.topLeft);
      if (pick != null) {
        final d = pick.$4, type = strOf(d['type'], 'misc');
        final bits = [strOf(d['desc']), if (numOf(d['heal']) > 0) '+${d['heal']} health', if (numOf(d['food']) > 0) '+${d['food']} food', if (numOf(d['drink']) > 0) '+${d['drink']} drink', if (numOf(d['damage']) > 0) '⚔ ${d['damage']}', if (numOf(d['armor']) > 0) '🛡 ${d['armor']}'].where((x) => x.isNotEmpty).join(' · ');
        kids.add(Positioned.fromRect(rect: r, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          itemText('${pick.$1}${type != 'misc' ? ' · ${itemTypeLabels[type] ?? type}' : ''}', 13 * k, w: FontWeight.w800, c: strOf(d['rarity'], 'common') != 'common' ? rarityColors[d['rarity']] ?? txt : txt, align: TextAlign.center),
          if (bits.isNotEmpty) itemText(bits, 11 * k, w: FontWeight.w600, c: txt.withValues(alpha: 0.75), align: TextAlign.center),
        ])));
      } else {
        kids.add(Positioned.fromRect(rect: r, child: Center(child: itemText(s.slotCount > 0 ? '${s.slotsUsed} / ${s.slotCount} slots' : 'Tap an item', 12 * k, c: txt.withValues(alpha: 0.6)))));
      }
    }
    return Stack(clipBehavior: Clip.none, children: kids);
  }
}

/// Equipment: the player's slots (hand, head, body…) with what's worn and the total damage, armour and speed. Tap one to take it off.
class EquipmentHud extends HudPart {
  EquipmentHud(this.p);
  final Map<String, dynamic> p;
  static const icons = {'hand': '✋', 'offhand': '🤚', 'head': '⛑️', 'body': '👕', 'legs': '👖', 'feet': '👢', 'neck': '📿', 'ring': '💍'};
  List<String> get slots => tagList(p['slots'] ?? 'hand, offhand, head, body, legs, feet').map((q) => q.toLowerCase()).toList();
  (List<Rect>, double) geo(Rect b, double k) {
    final S = slots, cols = math.max(1, numOf(p['columns'], 3).round()), rows = math.max(1, (S.length / cols).ceil()), sh = p['stats'] != false ? 26 * k : 0, gap = 8 * k;
    final sz = math.max(4.0, math.min((b.width - gap * (cols - 1)) / cols, (b.height - sh - gap * (rows - 1)) / rows - 12 * k));
    final ox = b.center.dx - (cols * sz + (cols - 1) * gap) / 2, oy = b.top + 4 * k;
    return ([for (var i = 0; i < S.length; i++) Rect.fromLTWH(ox + (i % cols) * (sz + gap), oy + (i ~/ cols) * (sz + 12 * k + gap), sz, sz + 12 * k)], oy + rows * (sz + 12 * k + gap));
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    final s = ItemSystems.of(g);
    final (rects, _) = geo(g.uiRect(e), g.uiK);
    final S = slots;
    for (final t in g.taps) { for (var i = 0; i < rects.length; i++) { if (rects[i].contains(t.screen) && s.equipped[S[i]] != null) { g.sfx('click'); s.unequip(S[i]); } } }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final s = ItemSystems.of(g);
    final (rects, statsY) = geo(b, k);
    final S = slots, txt = colorOf(p['text']) ?? Colors.white;
    final kids = <Widget>[];
    for (var i = 0; i < S.length; i++) {
      final r = rects[i].shift(-b.topLeft), name = s.equipped[S[i]], d = name == null ? null : s.def(name), sz = r.width;
      final rc = d != null && strOf(d['rarity'], 'common') != 'common' ? rarityColors[d['rarity']] : null;
      kids.add(Positioned.fromRect(rect: r, child: Column(children: [
        Container(width: sz, height: sz, alignment: Alignment.center,
          decoration: BoxDecoration(color: rc != null ? rc.withValues(alpha: 0.18) : colorOf(p['slot']) ?? const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(10 * k), border: Border.all(color: rc ?? colorOf(p['border']) ?? const Color(0x2EFFFFFF), width: rc != null ? 2 : 1.5)),
          child: Opacity(opacity: name != null ? 1 : 0.3, child: Text(name != null ? (s.iconOf(name).isNotEmpty ? s.iconOf(name) : name.substring(0, math.min(2, name.length))) : icons[S[i]] ?? '▫️', style: TextStyle(fontSize: sz * (name != null ? 0.45 : 0.32), decoration: TextDecoration.none)))),
        itemText(name ?? S[i], 10 * k, c: txt.withValues(alpha: name != null ? 0.9 : 0.5), align: TextAlign.center),
      ])));
    }
    if (p['stats'] != false) {
      final sp = s.equipStat('speed');
      kids.add(Positioned(left: 0, right: 0, top: statsY - b.top, child: itemText('⚔ ${formatNumber(s.equipStat('damage'))}   🛡 ${formatNumber(s.equipStat('armor'))}${sp != 1 ? '   👟 ×${(sp * 100).round() / 100}' : ''}', 13 * k, w: FontWeight.w800, c: txt, align: TextAlign.center)));
    }
    return Stack(clipBehavior: Clip.none, children: kids);
  }
}

/// Crafting: the recipes with what each needs (green when you have it); tap one to make it. Drag to scroll.
class CraftingHud extends HudPart {
  CraftingHud(this.p);
  final Map<String, dynamic> p;
  double scroll = 0;
  int? drag;
  double dragY0 = 0, scroll0 = 0;
  final Map<int, double> flash = {};
  List<Map<String, dynamic>> rows(ItemSystems s) {
    var R = s.recipes;
    final cat = strOf(p['category']), st = strOf(p['station']);
    if (cat.isNotEmpty) R = R.where((r) => strOf(r['category']).toLowerCase() == cat.toLowerCase()).toList();
    if (st.isNotEmpty) R = R.where((r) => strOf(r['station']).toLowerCase() == st.toLowerCase()).toList();
    if (p['locked'] != true) R = R.where(s.knows).toList();
    if (p['show'] == 'ones I can make') R = R.where((r) => s.canCraft(r)).toList();
    if (p['show'] == 'ones for nearby stations') R = R.where((r) => strOf(r['station']).isEmpty || s.nearStation(strOf(r['station']))).toList();
    return R;
  }
  (double, double, double) geo(Rect b, double k) { final head = strOf(p['title'], 'Crafting').isNotEmpty ? 40 * k : 8 * k; return (b.top + head, b.height - head - 8 * k, math.max(44.0, numOf(p['rowH'], 62)) * k); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    for (final i in [...flash.keys]) { final v = flash[i]!, n = v > 0 ? v - dt : v + dt; if (n.abs() < 0.02 || (v > 0) != (n > 0)) { flash.remove(i); } else { flash[i] = n; } }
    final s = ItemSystems.of(g), b = g.uiRect(e), k = g.uiK;
    final (top, h, rh) = geo(b, k);
    final R = rows(s), list = Rect.fromLTWH(b.left, top, b.width, h);
    final maxS = math.max(0.0, R.length * (rh + 6 * k) - h);
    for (final d in g.downs) { if (list.contains(d.at)) { drag = d.id; dragY0 = d.at.dy; scroll0 = scroll; } }
    if (drag != null) { final q = g.pointers[drag]; if (q != null) { scroll = (scroll0 - (q.at.dy - dragY0)).clamp(0.0, maxS); } else { drag = null; } }
    scroll = scroll.clamp(0.0, maxS);
    for (final t in tapsIn(g, list)) {
      final i = ((t.screen.dy - top + scroll) / (rh + 6 * k)).floor();
      if (i < 0 || i >= R.length) continue;
      g.sfx('click');
      if (s.craft(R[i])) { flash[i] = 0.5; } else { flash[i] = -0.5; final m = s.craftMissing(R[i]); g.message(m.isNotEmpty ? 'Need ${m.join(', ')}' : 'Can’t craft', 1.4); }
    }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final s = ItemSystems.of(g);
    final (top, h, rh) = geo(b, k);
    final R = rows(s), txt = colorOf(p['text']) ?? Colors.white;
    final have = colorOf(p['have']) ?? const Color(0xFF5DFF8A), need = colorOf(p['need']) ?? const Color(0xFFFF6B6B), acc = colorOf(p['accent']) ?? const Color(0xFF4FA3FF);
    final title = strOf(p['title'], 'Crafting'), c = s.crafting;
    return Container(
      decoration: BoxDecoration(color: colorOf(p['bg']) ?? const Color(0xEB141828), borderRadius: BorderRadius.circular(16 * k)),
      child: Stack(children: [
        if (title.isNotEmpty) Positioned(left: 16 * k, top: 10 * k, child: itemText(title, 17 * k, w: FontWeight.w900, c: txt)),
        if (title.isNotEmpty && c != null) Positioned(right: 14 * k, top: 15 * k, child: Container(width: 90 * k, height: 12 * k, decoration: BoxDecoration(color: const Color(0x1FFFFFFF), borderRadius: BorderRadius.circular(6 * k)), alignment: Alignment.centerLeft,
            child: FractionallySizedBox(widthFactor: ((g.time - c.$3) / c.$4).clamp(0.0, 1.0), child: Container(decoration: BoxDecoration(color: acc, borderRadius: BorderRadius.circular(6 * k)))))),
        Positioned(left: 0, right: 0, top: top - b.top, height: math.max(0, h), child: ClipRect(child: Stack(children: [
          if (R.isEmpty) Positioned(left: 0, right: 0, top: 20 * k, child: itemText('Nothing to craft yet', 13 * k, c: txt.withValues(alpha: 0.6), align: TextAlign.center)),
          for (var i = 0; i < R.length; i++)
            Positioned(left: 8 * k, right: 8 * k, top: i * (rh + 6 * k) - scroll, height: rh, child: _row(s, R[i], i, rh, k, txt, have, need, acc)),
        ]))),
      ]),
    );
  }
  Widget _row(ItemSystems s, Map<String, dynamic> r, int i, double rh, double k, Color txt, Color have, Color need, Color acc) {
    final result = strOf(r['result']), known = s.knows(r), d = s.def(result), ok = s.canCraft(r), fl = flash[i] ?? 0, st = strOf(r['station']);
    final far = st.isNotEmpty && !s.nearStation(st), amount = numOf(r['amount'], 1);
    return Container(
      decoration: BoxDecoration(color: fl > 0 ? have.withValues(alpha: 0.25) : fl < 0 ? need.withValues(alpha: 0.2) : colorOf(p['row']) ?? const Color(0x0FFFFFFF), borderRadius: BorderRadius.circular(12 * k)),
      padding: EdgeInsets.symmetric(horizontal: 8 * k),
      child: Row(children: [
        SizedBox(width: rh * 0.62, child: Center(child: Text(known ? (strOf(d['icon']).isNotEmpty ? strOf(d['icon']) : result.substring(0, math.min(2, result.length))) : '❔', style: TextStyle(fontSize: rh * 0.4, decoration: TextDecoration.none)))),
        SizedBox(width: 8 * k),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
          itemText(known ? '$result${amount > 1 ? ' ×${amount.toInt()}' : ''}' : '???', 14 * k, w: FontWeight.w800, c: strOf(d['rarity'], 'common') != 'common' ? rarityColors[d['rarity']] ?? txt : txt),
          SizedBox(height: 4 * k),
          SizedBox(height: 18 * k, child: ClipRect(child: Row(children: [
            for (final (name, n, _) in parseIngredients(r['ingredients']))
              Padding(padding: EdgeInsets.only(right: 5 * k), child: Container(
                padding: EdgeInsets.symmetric(horizontal: 6 * k), alignment: Alignment.center,
                decoration: BoxDecoration(color: (s.count(name) >= n ? have : need).withValues(alpha: 0.18), borderRadius: BorderRadius.circular(9 * k)),
                child: itemText('${s.iconOf(name).isNotEmpty ? s.iconOf(name) : name} ${s.count(name)}/$n', 11 * k, c: s.count(name) >= n ? have : need))),
          ]))),
        ])),
        Container(width: 62 * k, height: 30 * k, alignment: Alignment.center, decoration: BoxDecoration(color: ok ? acc : const Color(0x1FFFFFFF), borderRadius: BorderRadius.circular(15 * k)),
          child: itemText(far ? '📍$st' : numOf(r['time']) > 0 ? '⏱ ${formatNumber(numOf(r['time']))}s' : 'Make', (far ? 9 : 12) * k, w: FontWeight.w800, c: ok ? Colors.white : txt.withValues(alpha: 0.5), align: TextAlign.center)),
      ]),
    );
  }
}

/// Quest Log: goals with progress bars, each following a variable up to a target; ticks off when done and can give a reward.
class QuestLogHud extends HudPart {
  QuestLogHud(this.p);
  final Map<String, dynamic> p;
  final Map<int, double> flash = {};
  /// Goals: text, variable, target, reward variable, reward amount.
  List<(int, String, String, double, String, double)> get goals {
    final out = <(int, String, String, double, String, double)>[];
    final lines = strOf(p['quests'], 'Collect 50 coins | coins | 50 | gems 5\nDefeat 10 enemies | kills | 10 | coins 100\nReach level 3 | playerLevel | 3 | gems 10\nJump 25 times | jumps | 25 | coins 30').split('\n');
    for (final l in lines) {
      final c = l.split('|').map((x) => x.trim()).toList();
      if (c[0].isEmpty) continue;
      final rw = c.length > 3 ? c[3].split(RegExp(r'\s+')).where((x) => x.isNotEmpty).toList() : <String>[];
      out.add((out.length, c[0], c.length > 1 ? c[1] : '', math.max(1, numOf(c.length > 2 ? c[2] : '1', 1)), rw.length >= 2 ? rw[0] : '', rw.length >= 2 ? numOf(rw[1]) : 0));
    }
    return out;
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    for (final i in [...flash.keys]) { final n = flash[i]! - dt; if (n <= 0) { flash.remove(i); } else { flash[i] = n; } }
    for (final (i, text, v, target, rv, ra) in goals) {
      final key = 'quest_done_$i';
      if (g.vars[key] != true && g.numVar(v) >= target) {
        g.setVar(key, true); flash[i] = 1.5;
        if (rv.isNotEmpty) g.addVar(rv, ra);
        g.send(strOf(p['doneMessage'], 'quest done')); g.sfx('win');
        g.message('✓ $text', 1.6);
      }
    }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final txt = colorOf(p['text']) ?? Colors.white, acc = colorOf(p['accent']) ?? const Color(0xFF4FA3FF), dn = colorOf(p['done']) ?? const Color(0xFF3CCF7A);
    final Q = goals, title = strOf(p['title'], 'Quests');
    final list = p['hideDone'] != false ? ([...Q]..sort((a, c) => (g.vars['quest_done_${a.$1}'] == true ? 1 : 0) - (g.vars['quest_done_${c.$1}'] == true ? 1 : 0))) : Q;
    final headH = title.isNotEmpty ? 34 * k : 0.0, rh = math.min(58 * k, (b.height - 14 * k - headH - 6 * k) / math.max(1, list.length));
    return Container(
      decoration: BoxDecoration(color: colorOf(p['bg'] ?? '#181c2c'), borderRadius: BorderRadius.circular(18 * k)),
      padding: EdgeInsets.only(top: 14 * k),
      child: ClipRect(child: Column(children: [
        if (title.isNotEmpty) SizedBox(height: headH, child: Padding(padding: EdgeInsets.symmetric(horizontal: 16 * k), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: itemText(title, 18 * k, w: FontWeight.w900, c: txt)),
          itemText('${Q.where((q) => g.vars['quest_done_${q.$1}'] == true).length}/${Q.length}', 13 * k, w: FontWeight.w800, c: txt.withValues(alpha: 0.6)),
        ]))),
        for (final (i, text, v, target, rv, ra) in list) () {
          final done = g.vars['quest_done_$i'] == true, have = g.numVar(v), f = (have / target).clamp(0.0, 1.0), fl = flash[i] ?? 0;
          return Container(height: rh, margin: EdgeInsets.symmetric(horizontal: 8 * k), padding: EdgeInsets.symmetric(horizontal: 8 * k),
            decoration: BoxDecoration(color: fl > 0 ? dn.withValues(alpha: fl * 0.25) : null, borderRadius: BorderRadius.circular(10 * k)),
            child: Row(children: [
              Container(width: 22 * k, height: 22 * k, alignment: Alignment.center, decoration: BoxDecoration(color: done ? dn : const Color(0x1AFFFFFF), shape: BoxShape.circle), child: done ? Icon(Icons.check, size: 15 * k, color: Colors.white) : null),
              SizedBox(width: 10 * k),
              Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: done ? txt.withValues(alpha: 0.5) : txt, fontSize: 14 * k, fontWeight: FontWeight.w700, decoration: done ? TextDecoration.lineThrough : TextDecoration.none, decorationColor: txt.withValues(alpha: 0.5)))),
                  if (rv.isNotEmpty) itemText('+${formatNumber(ra)} $rv', 11 * k, w: FontWeight.w800, c: done ? dn.withValues(alpha: 0.8) : const Color(0xFFFFD23D)),
                ]),
                SizedBox(height: 5 * k),
                Row(children: [
                  Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(3 * k), child: SizedBox(height: 6 * k, child: Stack(children: [
                    const Positioned.fill(child: ColoredBox(color: Color(0x1AFFFFFF))),
                    FractionallySizedBox(widthFactor: math.max(0.02, f), heightFactor: 1, child: ColoredBox(color: done ? dn : acc)),
                  ])))),
                  SizedBox(width: 8 * k),
                  itemText('${formatNumber(math.min(have, target))}/${formatNumber(target)}', 11 * k, w: FontWeight.w800, c: txt.withValues(alpha: 0.7)),
                ]),
              ])),
            ]));
        }(),
      ])),
    );
  }
}

/// A quest as the HUD shows it.
class QuestView {
  QuestView(ItemSystems s, Map<String, dynamic> d) : name = strOf(d['name']), icon = strOf(d['icon'], '📜'), state = s.questState(strOf(d['name'])), desc = strOf(d['desc']), giver = strOf(d['giver']), rewards = s.rewardText(parseRewards(d['rewards'])), objs = s.questObjectives(strOf(d['name']));
  final String name, icon, state, desc, giver, rewards;
  final List<(Objective, int, bool, bool)> objs;
}

/// Quest Tracker: the tracked quest (or every active one) with its objectives ticking off; tap to send a message.
class QuestTrackerHud extends HudPart {
  QuestTrackerHud(this.p);
  final Map<String, dynamic> p;
  double flash = 0;
  String last = '';
  List<QuestView> list(ItemSystems s, PocketGame g) {
    if (p['show'] == 'all active quests') return s.questDefs.where((q) => ['active', 'ready'].contains(s.questState(strOf(q['name'])))).take(math.max(1, numOf(p['max'], 2).round())).map((q) => QuestView(s, q)).toList();
    final t = strOf(g.vars['trackedQuest']), d = t.isEmpty ? null : s.questDef(t);
    return d != null && ['active', 'ready'].contains(s.questState(t)) ? [QuestView(s, d)] : [];
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    flash = math.max(0, flash - dt);
    final key = list(ItemSystems.of(g), g).map((q) => '${q.name}${q.state}${q.objs.map((o) => o.$2).join(',')}').join('|');
    if (key != last && last.isNotEmpty) flash = 1;
    last = key;
    if (tapsIn(g, g.uiRect(e)).isNotEmpty) { g.sfx('click'); if (strOf(p['message'], 'open quests').isNotEmpty) g.send(strOf(p['message'], 'open quests')); }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final Q = list(ItemSystems.of(g), g), right = p['align'] == 'right', txt = colorOf(p['text']) ?? Colors.white, tc = colorOf(p['title']) ?? const Color(0xFFFFD23D), dn = colorOf(p['done']) ?? const Color(0xFF5DFF8A);
    final bg = colorOf(p['bg']) ?? const Color(0x73000000), al = right ? TextAlign.right : TextAlign.left;
    if (Q.isEmpty) {
      if (strOf(p['empty']).isEmpty) return const SizedBox.shrink();
      return Align(alignment: Alignment.topLeft, child: Container(width: b.width, height: 34 * k, alignment: right ? Alignment.centerRight : Alignment.centerLeft, padding: EdgeInsets.symmetric(horizontal: 12 * k), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10 * k)), child: itemText(strOf(p['empty']), 13 * k, c: txt.withValues(alpha: 0.7), align: al)));
    }
    return Align(alignment: Alignment.topLeft, child: Container(
      width: b.width, padding: EdgeInsets.fromLTRB(12 * k, 8 * k, 12 * k, 8 * k),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12 * k), border: flash > 0 ? Border.all(color: tc.withValues(alpha: flash), width: 2) : null),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: right ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
        for (final q in Q) ...[
          itemText('${q.icon} ${q.name}', 14 * k, w: FontWeight.w900, c: tc, align: al),
          SizedBox(height: 3 * k),
          if (q.state == 'ready') itemText('✔ Return to ${q.giver.isNotEmpty ? q.giver : 'the quest giver'}', 12.5 * k, w: FontWeight.w800, c: dn, align: al),
          for (final (o, have, done, waiting) in q.objs)
            if (!(p['hideDone'] == true && done)) itemText('${done ? '✓' : '○'} ${o.label}${o.n > 1 ? '  $have/${o.n}' : ''}', 12.5 * k, c: done ? dn : txt.withValues(alpha: waiting ? 0.45 : 0.9), align: al),
          SizedBox(height: 6 * k),
        ],
      ]),
    ));
  }
}

/// Quest Journal: every quest you've started (and optionally ones you can start); tap one for its details, rewards and Track.
class QuestJournalHud extends HudPart {
  QuestJournalHud(this.p);
  final Map<String, dynamic> p;
  String? open;
  double scroll = 0, dragY0 = 0, scroll0 = 0;
  int? drag;
  static const order = {'ready': 0, 'active': 1, 'available': 2, 'done': 3, 'failed': 4};
  static const chip = {'active': 'Active', 'ready': 'Hand in', 'available': 'New', 'done': 'Done', 'failed': 'Failed'};
  List<QuestView> list(ItemSystems s) {
    final out = <QuestView>[];
    for (final q in s.questDefs) {
      final st = s.questState(strOf(q['name']));
      if (['active', 'ready'].contains(st) || (p['showDone'] != false && ['done', 'failed'].contains(st)) || (p['showAvailable'] == true && st == 'available' && q['hidden'] != true)) out.add(QuestView(s, q));
    }
    out.sort((a, b) => (order[a.state] ?? 9) - (order[b.state] ?? 9));
    return out;
  }
  double detailH(QuestView q, double k) => (30 + (q.desc.isNotEmpty ? 36 : 0) + q.objs.length * 20 + (q.rewards.isNotEmpty ? 22 : 0) + 38) * k;
  (double, double, double) geo(Rect b, double k) { final head = strOf(p['title'], 'Quests').isNotEmpty ? 42 * k : 8 * k; return (b.top + head, b.height - head - 8 * k, math.max(40.0, numOf(p['rowH'], 54)) * k); }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    super.update(e, dt, g);
    final s = ItemSystems.of(g), b = g.uiRect(e), k = g.uiK;
    final (top, h, rh) = geo(b, k);
    final L = list(s), area = Rect.fromLTWH(b.left, top, b.width, h);
    var total = 0.0;
    for (final q in L) { total += rh + 6 * k + (open == q.name ? detailH(q, k) : 0); }
    final maxS = math.max(0.0, total - h);
    for (final d in g.downs) { if (area.contains(d.at)) { drag = d.id; dragY0 = d.at.dy; scroll0 = scroll; } }
    if (drag != null) { final q = g.pointers[drag]; if (q != null) { scroll = (scroll0 - (q.at.dy - dragY0)).clamp(0.0, maxS); } else { drag = null; } }
    scroll = scroll.clamp(0.0, maxS);
    for (final t in tapsIn(g, area)) {
      var y = top - scroll;
      for (final q in L) {
        final hh = rh + (open == q.name ? detailH(q, k) : 0);
        if (t.screen.dy >= y && t.screen.dy < y + hh) {
          g.sfx('click');
          final onButton = open == q.name && t.screen.dy > y + hh - 40 * k;
          if (onButton && ['active', 'ready'].contains(q.state)) { g.setVar('trackedQuest', q.name); }
          else if (onButton && q.state == 'available') { s.startQuest(q.name); }
          else { open = open == q.name ? null : q.name; }
          break;
        }
        y += hh + 6 * k;
      }
    }
  }
  @override
  Widget build(GameObject e, PocketGame g, Rect b, double k) {
    final s = ItemSystems.of(g);
    final (top, h, rh) = geo(b, k);
    final L = list(s), txt = colorOf(p['text']) ?? Colors.white, acc = colorOf(p['accent']) ?? const Color(0xFFFFD23D), dn = colorOf(p['done']) ?? const Color(0xFF5DFF8A);
    final title = strOf(p['title'], 'Quests');
    final rowsW = <Widget>[];
    var y = -scroll;
    for (final q in L) {
      final isOpen = open == q.name, hh = rh + (isOpen ? detailH(q, k) : 0), tracked = strOf(g.vars['trackedQuest']) == q.name;
      final cc = q.state == 'ready' || q.state == 'done' ? dn : q.state == 'failed' ? const Color(0xFFFF6B6B) : acc, dnN = q.objs.where((o) => o.$3).length;
      final btn = ['active', 'ready'].contains(q.state) ? (tracked ? '★ Tracked' : 'Track') : q.state == 'available' ? 'Start quest' : '';
      rowsW.add(Positioned(left: 8 * k, right: 8 * k, top: y, height: hh, child: Container(
        decoration: BoxDecoration(color: colorOf(p['row']) ?? const Color(0x0FFFFFFF), borderRadius: BorderRadius.circular(12 * k)),
        foregroundDecoration: tracked ? BoxDecoration(borderRadius: BorderRadius.circular(12 * k), border: Border.all(color: acc, width: 2)) : null,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(height: rh, child: Row(children: [
            SizedBox(width: 46 * k, child: Center(child: Text(q.icon, style: TextStyle(fontSize: rh * 0.38, decoration: TextDecoration.none)))),
            Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              itemText(q.name, 15 * k, w: FontWeight.w800, c: q.state == 'done' ? txt.withValues(alpha: 0.6) : txt),
              if (q.objs.isNotEmpty && q.state != 'done') itemText('$dnN / ${q.objs.length} done', 11.5 * k, c: txt.withValues(alpha: 0.6)),
            ])),
            Container(height: 22 * k, padding: EdgeInsets.symmetric(horizontal: 8 * k), margin: EdgeInsets.only(right: 10 * k), alignment: Alignment.center, decoration: BoxDecoration(color: cc.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(11 * k)), child: itemText(chip[q.state] ?? q.state, 11 * k, w: FontWeight.w800, c: cc)),
          ])),
          if (isOpen) Expanded(child: Padding(padding: EdgeInsets.symmetric(horizontal: 14 * k), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(height: 22 * k, child: q.giver.isNotEmpty ? itemText('From ${q.giver}', 12 * k, c: txt.withValues(alpha: 0.6)) : null),
            if (q.desc.isNotEmpty) SizedBox(height: 36 * k, child: itemText(q.desc, 13 * k, w: FontWeight.w600, c: txt.withValues(alpha: 0.85), lines: 2)),
            for (final (o, have, done, _) in q.objs) SizedBox(height: 20 * k, child: itemText('${done ? '✓' : '○'} ${o.label}${o.n > 1 ? '  $have/${o.n}' : ''}', 13 * k, c: done ? dn : txt)),
            if (q.rewards.isNotEmpty) SizedBox(height: 22 * k, child: itemText('Rewards: ${q.rewards}', 12.5 * k, c: acc)),
            const Spacer(),
            if (btn.isNotEmpty) Container(width: 120 * k, height: 28 * k, margin: EdgeInsets.only(bottom: 10 * k), alignment: Alignment.center, decoration: BoxDecoration(color: acc.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(14 * k)), child: itemText(btn, 12.5 * k, w: FontWeight.w800, c: acc)),
          ]))),
        ]),
      )));
      y += hh + 6 * k;
    }
    return Container(
      decoration: BoxDecoration(color: colorOf(p['bg']) ?? const Color(0xF0141828), borderRadius: BorderRadius.circular(16 * k)),
      child: Stack(children: [
        if (title.isNotEmpty) Positioned(left: 16 * k, top: 11 * k, child: itemText(title, 17 * k, w: FontWeight.w900, c: txt)),
        Positioned(left: 0, right: 0, top: top - b.top, height: math.max(0, h), child: ClipRect(child: Stack(children: [
          if (L.isEmpty) Positioned(left: 0, right: 0, top: 20 * k, child: itemText('No quests yet', 13 * k, c: txt.withValues(alpha: 0.6), align: TextAlign.center)),
          ...rowsW,
        ]))),
      ]),
    );
  }
}

// makeComponent: 'triggers' => Triggers(p), 'fsm' => StateMachine(p), 'graph' => VisualScript(p),

// ---------------------------------------------------------------------------------------------------------------
// Logic: Triggers, State Machine and Visual Script, with Pocket Engine's shared logic library (events, conditions,
// instructions). Other systems (inventory, quests, dialogue…) can add instructions and conditions of their own:
//   g.systems['actions']    : Map<String, Object? Function(LogicCtx c, Map<String, dynamic> p)>  (return like an instruction)
//   g.systems['conditions'] : Map<String, bool Function(LogicCtx c, Map<String, dynamic> p)>
// Sign-in, cloud data, purchases, online play and phone permissions are in the web build; here those instructions send
// their name as a message (g.send) so the rest of the game can react.
// ---------------------------------------------------------------------------------------------------------------

/// JS-style values: true counts as 1, text is read as a number.
double lnum(Object? v) => v is bool ? (v ? 1 : 0) : v is num ? v.toDouble() : double.tryParse('${v ?? ''}'.trim()) ?? 0;
/// Is it "true"? (0, empty text, false and nothing are not)
bool ltruthy(Object? v) => v == null ? false : v is bool ? v : v is num ? v != 0 && !v.isNaN : v is String ? v.isNotEmpty : true;
/// A value as text: 3.0 → "3", lists as "a, b".
String ltext(Object? v) {
  if (v == null) return '';
  if (v is num) { final r = (v * 10000).round() / 10000; return r == r.roundToDouble() && r.abs() < 1e15 ? r.toInt().toString() : '$r'; }
  if (v is List) return v.map(ltext).join(', ');
  return '$v';
}
bool lsame(Object? a, Object? b) => ltext(a) == ltext(b);
/// "12" → 12, "sword" stays text.
Object lval(Object? v) { final t = ltext(v); final n = double.tryParse(t.trim()); return t.trim().isNotEmpty && n != null ? n : t; }
bool lcmp(double a, String op, double b) => switch (op) { '=' || '==' => a == b, '≠' || '!=' => a != b, '>' => a > b, '<' => a < b, '≥' || '>=' => a >= b, '≤' || '<=' => a <= b, _ => false };
/// A list kept in a game variable.
List<Object?> lvarList(PocketGame g, String name) { final v = g.vars[name]; return v is List ? v.cast<Object?>() : v == null || v == '' || v == 0 ? <Object?>[] : <Object?>[v]; }
/// A dictionary kept in a game variable.
Map<String, Object?> lvarMap(PocketGame g, String name) { final v = g.vars[name]; return v is Map ? v.map((k, x) => MapEntry('$k', x)) : <String, Object?>{}; }
/// An object by name, else the nearest with that tag (never e itself).
GameObject? lnearest(PocketGame g, GameObject e, String key) {
  if (key.isEmpty) return null;
  final named = g.objects.where((o) => !o.dead && o != e && (o.name == key || o.id == key)).firstOrNull;
  if (named != null) return named;
  GameObject? best; var bd = double.infinity;
  for (final o in g.objects) { if (o == e || o.dead || !o.has(key)) continue; final d = (Offset(o.x, o.y) - Offset(e.x, e.y)).distance; if (d < bd) { bd = d; best = o; } }
  return best;
}
double ldist(GameObject a, GameObject b) => (Offset(a.x, a.y) - Offset(b.x, b.y)).distance;
/// A keyboard key by the engine's name: space, a, arrowup, enter…
String lkeyName(LogicalKeyboardKey k) { final l = k.keyLabel; return l == ' ' ? 'space' : l.toLowerCase().replaceAll(' ', ''); }
String lkeyWant(Object? v) { final s = ltext(v).trim().toLowerCase(); return s == ' ' ? 'space' : s.replaceAll(' ', ''); }
/// Put inputs into steps: "@amount" becomes the value; "{@amount}" inside text is replaced.
Object? lbind(Object? v, Map<String, Object?> args) {
  if (v is String) {
    final m = RegExp(r'^@(\w+)$').firstMatch(v);
    if (m != null && args.containsKey(m[1])) return args[m[1]];
    return v.contains('{@') ? v.replaceAllMapped(RegExp(r'\{@(\w+)\}'), (a) => args.containsKey(a[1]) ? ltext(args[a[1]]) : a[0]!) : v;
  }
  if (v is List) return v.map((x) => lbind(x, args)).toList();
  if (v is Map) return v.map((k, x) => MapEntry('$k', lbind(x, args)));
  return v;
}

/// Logic happenings shared between objects (Run trigger, custom events, state changes, object variables).
class LogicBus {
  final List<void Function(String type, List<Object?> args)> subs = [];
  void emit(String type, [List<Object?> args = const []]) { for (final f in [...subs]) { f(type, args); } }
  static LogicBus of(PocketGame g) => (g.systems['logicBus'] ??= LogicBus()) as LogicBus;
}

/// What an instruction returns to its list: wait until this is true.
class LUntil { LUntil(this.test); final bool Function() test; }
/// What an instruction returns to its list: go to step i.
class LGoto { LGoto(this.i); final int i; }

/// One run of an instruction list: who runs it, who else is involved, the value that came with the event.
class LogicCtx {
  LogicCtx(this.g, this.e, {this.other, this.eventValue, this.afterDeath = false});
  final PocketGame g;
  final GameObject e;
  GameObject? other;
  Object? eventValue;
  bool cancelled = false, done = false, afterDeath;
  int at = 0, depth = 0;
  final Map<int, int> reps = {};
  LogicCtx sub() => LogicCtx(g, e, other: other, eventValue: eventValue, afterDeath: afterDeath)..depth = depth + 1;
}

/// A setting with the library's default.
Map<String, dynamic> logicWith(String lib, Map it) {
  final p = <String, dynamic>{...it.map((k, v) => MapEntry('$k', v))};
  final d = logicDefaults[lib]?['${it['type']}'];
  if (d != null) { for (final kv in d.entries) { p.putIfAbsent(kv.key, () => kv.value); } }
  return p;
}

/// Run an instruction list in order; a wait pauses it (game time); c.cancelled stops it.
void runInstructions(List? list, LogicCtx c, [VoidCallback? done]) {
  final steps = list ?? const [];
  var i = 0;
  late void Function() next;
  next = () {
    while (i < steps.length) {
      if (c.cancelled || (c.e.dead && !c.afterDeath)) return;
      final it = steps[i++];
      if (it is! Map || it['off'] == true) continue;
      c.at = i - 1;
      Object? r;
      try { r = logicAction(c, logicWith('ac', it)); } catch (err) { debugPrint('Pocket: ${it['type']} failed: $err'); }
      if (r == 'stop') break;
      if (r is LGoto) { i = r.i; continue; }
      if (r is num && r > 0) { c.g.after(r.toDouble(), next); return; }
      if (r is LUntil) {
        final u = r;
        void poll() { if (c.cancelled) return; if (u.test()) { next(); } else { c.g.after(0.05, poll); } }
        c.g.after(0.05, poll);
        return;
      }
    }
    c.done = true;
    done?.call();
  };
  next();
}

/// Do all the conditions pass (or any of them)? Each can be flipped with "not".
bool logicConditionsPass(List? list, LogicCtx c, {bool any = false}) {
  final l = list ?? const [];
  if (any && l.isNotEmpty) return l.any((cd) => logicConditionsPass([cd], c));
  for (final cd in l) {
    if (cd is! Map) continue;
    final ok = logicCondition(c, logicWith('cd', cd));
    if (ok == (cd['not'] == true)) return false;
  }
  return true;
}

GameObject? _ltarget(LogicCtx c, Object? name) {
  final n = ltext(name);
  if (n.isEmpty || n == 'self' || n == 'this') return c.e;
  if (n == 'other') return c.other;
  return c.g.find(n);
}

/// One condition of the logic library.
bool logicCondition(LogicCtx c, Map<String, dynamic> p) {
  final g = c.g, e = c.e, type = '${p['type']}';
  final ext = g.systems['conditions'];
  if (ext is Map && ext[type] is Function) return (ext[type] as bool Function(LogicCtx, Map<String, dynamic>))(c, p);
  double v(String k) => lnum(p[k]);
  String s(String k) => ltext(p[k]);
  switch (type) {
    case 'variable': return lcmp(g.numVar(s('name')), s('op'), v('value'));
    case 'chance': return math.Random().nextDouble() * 100 < v('percent');
    case 'touching': return g.touching(e, (o) => o.has(s('tag'))).isNotEmpty;
    case 'grounded': return e.body?.grounded ?? false;
    case 'near': { final t = g.findAll(s('tag')).where((q) => q != e).firstOrNull; final d = t == null ? double.infinity : ldist(t, e); return s('op') == '>' ? d > v('value') : d < v('value'); }
    case 'canSee': { final t = g.findAll(s('tag')).where((q) => q != e).firstOrNull; return t != null && g.canSee(e, t); }
    case 'exists': return g.find(s('object')) != null;
    case 'visible': return (s('object').isEmpty ? e : g.find(s('object')))?.visible ?? false;
    case 'state': return '${e.data['state'] ?? ''}' == s('state');
    case 'anySave': return g.hasSave(1) || g.hasSave(2) || g.hasSave(3);
    case 'hasSave': return g.hasSave(v('slot') <= 0 ? 1 : v('slot').toInt());
    case 'hasItem': return g.numVar('item_${s('item')}') >= (v('count') <= 0 ? 1 : v('count')) || (lvarList(g, 'inventory').where((x) => lsame(x, s('item'))).length >= (v('count') <= 0 ? 1 : v('count')));
    case 'playing': return g.state == 'play' && !g.paused;
    case 'compareVars': return lcmp(g.numVar(s('a')), s('op'), g.numVar(s('b')));
    case 'myVar': return lcmp(lnum(e.data[s('name')]), s('op'), v('value'));
    case 'textVar': {
      final a = ltext(g.vars[s('name')]).toLowerCase(), t = s('text').toLowerCase();
      return switch (s('op')) { 'contains' => a.contains(t), 'starts with' => a.startsWith(t), 'is empty' => a.trim().isEmpty, _ => a == t };
    }
    case 'health': { final hp = lnum(e.data['hp']), val = onOf(p['percent']) ? hp / (lnum(e.data['hpMax']) == 0 ? 1 : lnum(e.data['hpMax'])) * 100 : hp; return lcmp(val, s('op'), v('value')); }
    case 'need': {
      final cur = e.data[s('need')]; if (cur == null) return false;
      final mx = lnum(e.data['${s('need')}Max']);
      return lcmp(onOf(p['percent'], true) ? lnum(cur) / (mx == 0 ? 100 : mx) * 100 : lnum(cur), s('op'), v('value'));
    }
    case 'hasStatus': return s('effect') == 'any' ? '${e.data['status'] ?? ''}'.isNotEmpty : '${e.data['status'] ?? ''}'.split(',').contains(s('effect'));
    case 'shieldUp': return lcmp(lnum(e.data['hpShield']), s('op'), v('value'));
    case 'tagCount': return lcmp(g.findAll(s('tag')).length.toDouble(), s('op'), v('value'));
    case 'moving': { final b = e.body; return b != null && math.sqrt(b.vx * b.vx + b.vy * b.vy) > v('speed'); }
    case 'level': return lcmp(g.numVar('level') == 0 ? 1 : g.numVar('level'), s('op'), v('value'));
    case 'timeIn': return lcmp(g.time, s('op'), v('value'));
    case 'portrait': return g.screen.height >= g.screen.width;
    case 'listHas': return lvarList(g, s('list')).any((x) => lsame(x, lval(s('value'))));
    case 'listCount': return lcmp(lvarList(g, s('list')).length.toDouble(), s('op'), v('value'));
    case 'dictHas': return lvarMap(g, s('dict')).containsKey(s('key'));
    case 'pageIs': return lsame(g.vars['page'], s('page'));
    case 'keyHeld': return g.keys.any((k) => lkeyName(k) == lkeyWant(p['key']));
    case 'screenHeld': return g.pointers.values.any((q) => q.role == 'free');
    case 'online': return true;
    case 'hour': return lcmp(DateTime.now().hour.toDouble(), s('op'), v('value'));
    case 'objVar': { final t = _ltarget(c, p['object']); return t != null && lcmp(lnum(t.data[s('name')]), s('op'), v('value')); }
    case 'eventValue': {
      final ev = c.eventValue, a = double.tryParse(ltext(ev)), b = double.tryParse(s('value').trim());
      return a != null && b != null && s('value').trim().isNotEmpty ? lcmp(a, s('op'), b) : (s('op') == '≠') != lsame(ev, p['value']);
    }
    case 'isPlayerTurn': return g.vars['playerTurn'] != false && g.vars['playerTurn'] != 0;
    case 'unitCount': {
      final k = switch (s('which')) { 'yours' => 'unitsLeft', 'enemy' => 'enemiesLeft', 'ready this turn' => 'unitsReady', _ => 'selectedUnits' };
      return lcmp(g.numVar(k), s('op'), v('value'));
    }
    case 'funcResult': {
      final t = s('on') == 'other' ? c.other : s('on') == 'this object' ? e : lnearest(g, e, s('object'));
      final r = t?.part<VisualScript>()?.callFn(s('name'), {'a': 0, 'b': 0, 'c': 0}, e, null);
      final val = r?.$2 ?? 0;
      return lcmp(val, s('op'), v('value'));
    }
    case 'custom': {
      final defs = (g.json['customConditions'] as List? ?? const []).whereType<Map>();
      final def = defs.where((q) => q['id'] == p['ref']).firstOrNull;
      if (def == null || c.depth > 12) return false;
      final args = _customArgs(def, p);
      return logicConditionsPass(lbind(def['conditions'] ?? const [], args) as List?, c.sub());
    }
    default: return false; // (signed in, data counts, quests, permissions…: the web build)
  }
}

Map<String, Object?> _customArgs(Map def, Map p) => {
      for (final q in (def['params'] as List? ?? const []).whereType<Map>())
        '${q['key']}': () { final v = p[q['key']] ?? q['default'] ?? ''; return q['type'] == 'number' && double.tryParse('$v') != null ? double.parse('$v') : v; }(),
    };

/// Colour of an object (its shape fill, or its text) eased to another over some seconds.
void lfadeColor(PocketGame g, GameObject t, String color, double seconds) {
  final key = t.shape != null ? 'fill' : 'color';
  final map = t.shape ?? (t.text ??= {'value': ''});
  final from = colorOf(map[key]) ?? Colors.white, to = colorOf(color) ?? Colors.white;
  if (seconds <= 0.01) { map[key] = color; return; }
  final t0 = g.time;
  void tick() {
    if (t.dead) return;
    final k = ((g.time - t0) / seconds).clamp(0.0, 1.0), c = Color.lerp(from, to, k)!;
    map[key] = '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
    if (k < 1) { g.after(1 / 60, tick); } else { map[key] = color; }
  }
  tick();
}

/// A colour covering the screen: fades in, holds, fades out (screen fades).
void lscreenFade(PocketGame g, Color color, double a, double hold, double b) {
  final t0 = g.time;
  late void Function(Canvas) draw;
  draw = (cv) {
    final t = g.time - t0, k = t < a ? t / a : t < a + hold ? 1.0 : 1 - (t - a - hold) / b;
    if (t > a + hold + b) { g.after(0, () => g.overlays.remove(draw)); return; }
    if (k > 0) cv.drawRect(Offset.zero & g.screen, Paint()..color = color.withValues(alpha: k.clamp(0.0, 1.0)));
  };
  g.overlays.add(draw);
}

/// "Punch": out by an amount and back (scale, position or rotation).
void lpunch(PocketGame g, GameObject t, String what, double a, double d) {
  if (what == 'scale') { g.tween(t, 'sx', t.sx * (1 + a), d, curve: 'outQuad', yoyo: true); g.tween(t, 'sy', t.sy * (1 + a), d, curve: 'outQuad', yoyo: true); }
  else if (what == 'rotation') { g.tween(t, 'rz', t.rz + a * 90, d, curve: 'outQuad', yoyo: true); }
  else { g.tween(t, 'y', t.y - a * 60, d, curve: 'outQuad', yoyo: true); }
}

/// The logic library's defaults (Pocket Engine's LOGIC_EVENTS / LOGIC_CONDITIONS / LOGIC_ACTIONS settings), so a saved trigger that leaves one out works the same.
const logicDefaults = <String, Map<String, Map<String, Object>>>{
  "ev": {
    "every": {"seconds": 1},
    "touch": {"tag": "player"},
    "touchEnd": {"tag": "player"},
    "button": {"button": "jump"},
    "swipe": {"dir": "up"},
    "message": {"message": "go"},
    "variable": {"name": "score", "op": "≥", "value": 10},
    "animEnd": {"clip": ""},
    "longPress": {"seconds": 0.6},
    "key": {"key": "space"},
    "varChanged": {"name": "score"},
    "delay": {"seconds": 2},
    "random": {"seconds": 3},
    "near": {"tag": "player", "distance": 120},
    "sees": {"tag": "player"},
    "damaged": {"dtype": "any"},
    "statusGot": {"effect": "any"},
    "needLow": {"need": "any"},
    "needEmpty": {"need": "any"},
    "crafted": {"item": ""},
    "itemUsed": {"item": ""},
    "equipped": {"mode": "puts on", "item": ""},
    "recipeLearned": {"item": ""},
    "gathered": {"item": ""},
    "questStarted": {"quest": ""},
    "questUpdated": {"quest": ""},
    "questReady": {"quest": ""},
    "questCompleted": {"quest": ""},
    "questFailed": {"quest": ""},
    "dialogueStarted": {"dialogue": ""},
    "dialogueEnded": {"dialogue": ""},
    "dialogueChoice": {"choice": ""},
    "gameFinished": {"game": "", "result": "any"},
    "recordAdded": {"collection": ""},
    "recordChanged": {"collection": ""},
    "recordDeleted": {"collection": ""},
    "recordOpened": {"collection": ""},
    "unitArrived": {"unit": ""},
    "unitDefeated": {"team": "any"},
    "ate": {"need": "any"},
    "called": {"name": "Open door"},
    "pageChanged": {"page": ""},
    "stateEntered": {"state": ""},
    "inventory": {"item": ""},
    "permission": {"kind": "any", "answer": "any"},
    "online": {"mode": "is lost"},
    "orientation": {"to": "any"},
    "menu": {"mode": "opens"},
    "after": {"seconds": 1},
  },
  "cd": {
    "variable": {"name": "score", "op": "≥", "value": 10},
    "chance": {"percent": 50},
    "touching": {"tag": "player"},
    "near": {"tag": "player", "op": "<", "value": 150},
    "canSee": {"tag": "player"},
    "exists": {"object": ""},
    "visible": {"object": ""},
    "state": {"state": "Idle"},
    "modActive": {"mod": ""},
    "hasSave": {"slot": 1},
    "hasItem": {"item": "Key", "count": 1},
    "dataCount": {"collection": "Tasks", "filter": "", "op": "≥", "value": 1},
    "unitCount": {"which": "selected", "op": "≥", "value": 1},
    "questIs": {"quest": "The Lost Ring", "state": "active"},
    "storyCheck": {"check": "has Key and coins >= 10"},
    "canCraft": {"item": "Wooden Sword", "times": 1},
    "isEquipped": {"item": "", "slot": "any"},
    "invSpace": {"op": "≥", "value": 1},
    "hasItemType": {"type": "food", "count": 1},
    "knowsRecipe": {"item": "Iron Sword"},
    "compareVars": {"a": "score", "op": "≥", "b": "best"},
    "myVar": {"name": "hp", "op": "≤", "value": 0},
    "textVar": {"name": "playerName", "op": "equals", "text": "Hero"},
    "health": {"op": "≤", "value": 1, "percent": false},
    "need": {"need": "hunger", "op": "≤", "value": 25, "percent": true},
    "hasStatus": {"effect": "poison"},
    "shieldUp": {"op": ">", "value": 0},
    "tagCount": {"tag": "enemy", "op": "=", "value": 0},
    "moving": {"speed": 10},
    "level": {"op": "=", "value": 1},
    "timeIn": {"op": "≥", "value": 10},
    "listHas": {"list": "inventory", "value": "sword"},
    "listCount": {"list": "inventory", "op": "≥", "value": 3},
    "dictHas": {"dict": "stats", "key": "hp"},
    "pageIs": {"page": "home"},
    "keyHeld": {"key": "space"},
    "hour": {"op": "≥", "value": 18},
    "permission": {"kind": "location"},
    "objVar": {"object": "Door", "name": "open", "op": "=", "value": 1},
    "funcResult": {"name": "canAfford", "on": "this object", "object": "", "a": 0, "op": "≠", "value": 0},
    "eventValue": {"op": "=", "value": "1"},
    "savedKey": {"key": "coins", "file": "save"},
  },
  "ac": {
    "setVar": {"name": "score", "op": "add", "value": 1},
    "showHide": {"object": "", "mode": "hide"},
    "destroy": {"object": "self", "burst": true},
    "spawn": {"template": "", "ox": 0, "oy": 0, "at": "this"},
    "setText": {"object": "", "text": "Hello {score}"},
    "setColor": {"object": "", "color": "#ff5252", "seconds": 0.3},
    "teleport": {"to": ""},
    "toggleVar": {"name": "open"},
    "randomVar": {"name": "roll", "min": 1, "max": 6, "whole": true},
    "textVar": {"name": "playerName", "text": "Hero {level}"},
    "myVar": {"name": "hp", "op": "add", "value": 1, "object": ""},
    "saveKey": {"name": "coins", "file": "save"},
    "loadKey": {"name": "coins", "file": "save"},
    "giveItem": {"item": "Key", "amount": 1, "icon": ""},
    "snackbar": {"text": "Saved", "action": "", "message": "", "seconds": 4},
    "playGame": {"level": "2"},
    "supaSignIn": {"email": "{email}", "password": "{password}"},
    "supaSignUp": {"email": "{email}", "password": "{password}", "name": "{name}"},
    "supaReset": {"email": "{email}"},
    "supaLoadProfile": {"who": "{username}"},
    "buyProduct": {"product": "coins_100"},
    "supaRpc": {"fn": "get_top_scores", "args": "", "into": "supaResult"},
    "supaEdge": {"fn": "hello", "args": "", "into": "supaResult"},
    "supaRefresh": {"collection": ""},
    "dataAdd": {"collection": "Tasks", "values": "title = New task, done = no", "open": false},
    "dataSet": {"field": "done", "value": "yes"},
    "dataOpen": {"collection": "Tasks", "filter": "", "page": ""},
    "dataClear": {"collection": "Tasks", "how": "delete every record"},
    "dataToVar": {"collection": "Expenses", "how": "sum", "field": "amount", "filter": "", "var": "total"},
    "npcSay": {"npc": "Villager", "text": "Nice day!"},
    "squadSelect": {"which": "all yours", "tag": "archer"},
    "squadMove": {"who": "selected", "tag": "archer", "to": "an object", "object": "Flag", "x": 0, "y": 0},
    "questStart": {"quest": "The Lost Ring"},
    "questComplete": {"quest": "The Lost Ring"},
    "questFail": {"quest": "The Lost Ring"},
    "questAdvance": {"quest": "The Lost Ring", "amount": 1, "objective": 0},
    "questReset": {"quest": "The Lost Ring"},
    "questTrack": {"quest": "The Lost Ring"},
    "startDialogue": {"dialogue": "Elder", "section": "", "wait": true},
    "useItemFx": {"item": "Apple"},
    "equipItem": {"mode": "equip", "item": "Iron Sword", "slot": "hand"},
    "craftItem": {"item": "Wooden Sword", "times": 1},
    "learnRecipe": {"item": "Iron Sword"},
    "dropItem": {"item": "Wood", "amount": 1},
    "lootRoll": {"loot": "Coin 3-6, Gem 1 10%", "into": "inventory"},
    "invManage": {"what": "sort by type", "amount": 20},
    "damage": {"object": "other", "amount": 1, "dtype": "normal", "pierce": false},
    "statusFx": {"object": "self", "effect": "poison", "perSecond": 1, "seconds": 3},
    "cure": {"object": "self", "effect": "any"},
    "healthSet": {"object": "self", "what": "refill health", "amount": 5},
    "invulnerable": {"object": "self", "seconds": 3},
    "eat": {"object": "self", "need": "hunger", "mode": "add", "amount": 25},
    "talk": {"who": "Guide", "text": "Hello there!", "wait": true},
    "moveBy": {"x": 0, "y": -40, "z": 0, "seconds": 0.3, "ease": "outQuad", "wait": false},
    "rotateBy": {"degrees": 90, "seconds": 0.3, "ease": "outQuad", "wait": false},
    "scaleTo": {"scale": 1.5, "seconds": 0.3, "ease": "outBack", "wait": false},
    "fade": {"alpha": 0, "seconds": 0.5, "wait": false},
    "punch": {"what": "scale", "amount": 0.3, "seconds": 0.4},
    "playAnim": {"clip": "Bounce"},
    "push": {"who": "self", "x": 0, "y": -500, "z": 0},
    "setVelocity": {"x": 0, "y": 0, "z": 0},
    "jump": {"power": 600},
    "setGravity": {"y": 1600, "x": 0},
    "wait": {"seconds": 1},
    "waitRandom": {"min": 0.5, "max": 2},
    "waitUntil": {"name": "score", "op": "≥", "value": 10},
    "onlyIf": {"name": "score", "op": "≥", "value": 10},
    "repeat": {"times": 2},
    "runTrigger": {"name": "Open door"},
    "sendMessage": {"message": "go"},
    "setState": {"state": "Idle"},
    "message": {"text": "Hello! {score}", "seconds": 2},
    "log": {"text": "score is {score}"},
    "sound": {"sound": "coin"},
    "shake": {"strength": 12},
    "switchCamera": {"camera": "Camera"},
    "save": {"slot": 1},
    "load": {"slot": 1},
    "askPermission": {"kind": "location", "why": ""},
    "phoneNotify": {"title": "Come back!", "text": "", "minutes": 0, "id": ""},
    "notify": {"type": "default", "title": "Well done!", "text": "", "icon": ""},
    "listAdd": {"list": "inventory", "value": "sword", "where": "at the end", "unique": false},
    "listRemove": {"list": "inventory", "mode": "this value", "value": "sword"},
    "listClear": {"list": "inventory", "do": "clear"},
    "listPick": {"list": "prizes", "which": "random", "into": "prize"},
    "mapSet": {"dict": "stats", "key": "hp", "value": "100", "op": "set"},
    "mapRemove": {"dict": "stats", "key": "hp"},
    "setPos": {"x": 0, "y": 0, "z": 0, "relative": false, "object": ""},
    "glideTo": {"to": "player", "seconds": 0.6, "ease": "inOutQuad", "wait": true},
    "face": {"tag": "player"},
    "pushToward": {"tag": "player", "power": 500, "away": false},
    "stopMove": {"object": ""},
    "tagAdd": {"tag": "collected", "mode": "add", "object": ""},
    "destroyTag": {"tag": "enemy", "burst": true},
    "setImage": {"image": "art:star", "object": ""},
    "camLive": {"camera": "Camera 2", "seconds": -1},
    "camFollow": {"tag": "player", "camera": ""},
    "camZoom": {"zoom": 1.5, "camera": ""},
    "screenFade": {"color": "#000000", "out": 0.4, "hold": 0.3, "in": 0.4, "wait": true},
    "slowMo": {"speed": 0.3, "seconds": 1.5},
    "pauseGame": {"mode": "pause"},
    "haptic": {"style": "medium"},
    "openUrl": {"url": "https://"},
    "copyText": {"text": "My score: {score}"},
    "shareText": {"text": "I scored {score}!"},
    "askText": {"question": "What's your name?", "name": "playerName", "max": 16},
    "setPage": {"page": "shop"},
    "callEvent": {"name": "explode", "on": "everything", "object": "", "value": ""},
    "runFunction": {"name": "double", "on": "this object", "object": "", "a": 0, "b": 0, "store": ""},
    "goLevel": {"level": 1},
    "music": {"sound": "", "volume": 0.6},
    "burst": {"color": "#ffd23f", "count": 16, "at": "this"},
    "toast": {"text": "+1", "color": "#ffffff"},
  },
};

/// Instructions that only the web build can do (sign-in, cloud data, purchases, online, phone permissions…): here they send their name as a message.
const _webOnlyActions = {
  'supaSignIn', 'supaSignUp', 'supaSignOut', 'supaReset', 'supaSaveProfile', 'supaLoadProfile', 'buyProduct', 'restorePurchases', 'supaRpc', 'supaEdge', 'supaRefresh',
  'dataAdd', 'dataSet', 'dataDelete', 'dataOpen', 'dataClear', 'dataToVar', 'playGame', 'backToApp', 'openMods', 'askPermission', 'phoneNotify', 'notify', 'openUrl',
  'copyText', 'shareText', 'askText', 'music', 'goLevel', 'loadNewest', 'deleteAllSaves', 'squadSelect', 'squadMove', 'squadStop', 'endTurn', 'questStart', 'questComplete',
  'questFail', 'questAdvance', 'questReset', 'startDialogue', 'useItemFx', 'equipItem', 'craftItem', 'learnRecipe', 'dropItem', 'lootRoll', 'invManage', 'npcSay', 'cure',
  'statusFx', 'healthSet', 'eat', 'setImage', 'playAnim', 'slowMo', 'log',
};

/// One instruction of the logic library. Returns null (go on), 'stop', seconds to wait, LUntil (wait until) or LGoto.
Object? logicAction(LogicCtx c, Map<String, dynamic> p) {
  final g = c.g, e = c.e, type = '${p['type']}';
  final ext = g.systems['actions'];
  if (ext is Map && ext[type] is Function) return (ext[type] as Object? Function(LogicCtx, Map<String, dynamic>))(c, p);
  double v(String k) => lnum(p[k]);
  String s(String k) => ltext(p[k]);
  String filled(String k) => g.fill(s(k), e);
  bool wait() => onOf(p['wait']);
  switch (type) {
    // variables
    case 'setVar': {
      final k = s('name').isEmpty ? 'score' : s('name'), val = v('value'), cur = g.numVar(k);
      g.setVar(k, switch (s('op')) { 'set' => val, 'subtract' => cur - val, 'multiply' => cur * val, _ => cur + val });
    }
    case 'toggleVar': g.setVar(s('name'), g.numVar(s('name')) != 0 ? 0 : 1);
    case 'randomVar': { final a = v('min'), b = v('max'), whole = onOf(p['whole'], true), r = a + math.Random().nextDouble() * (b - a + (whole ? 1 : 0)); g.setVar(s('name'), whole ? r.floorToDouble() : (r * 100).round() / 100); }
    case 'textVar': g.setVar(s('name'), g.fill(s('text')));
    case 'myVar': {
      final t = _ltarget(c, p['object']); if (t == null) return null;
      final val = v('value'), cur = lnum(t.data[s('name')]);
      t.data[s('name')] = switch (s('op')) { 'set' => val, 'subtract' => cur - val, 'multiply' => cur * val, _ => cur + val };
      LogicBus.of(g).emit('myvar', [t, s('name'), t.data[s('name')]]);
    }
    case 'saveKey': g.prefs?.setString('pocket.var.${g.saveKey}.${s('file')}.${s('name')}', jsonEncode(g.vars[s('name')] ?? 0));
    case 'loadKey': { final raw = g.prefs?.getString('pocket.var.${g.saveKey}.${s('file')}.${s('name')}'); if (raw != null) g.setVar(s('name'), jsonDecode(raw)); }
    case 'giveItem': {
      final item = s('item'), n = v('amount');
      g.addVar('item_$item', n);
      final inv = [...lvarList(g, 'inventory')];
      if (n > 0) { for (var i = 0; i < n.round(); i++) { inv.add(item); } } else { for (var i = 0; i < (-n).round(); i++) { inv.remove(item); } }
      g.setVar('inventory', inv);
    }
    // objects
    case 'showHide': { final t = _ltarget(c, p['object']); if (t != null) t.visible = s('mode') == 'show' ? true : s('mode') == 'hide' ? false : !t.visible; }
    case 'destroy': { final t = _ltarget(c, p['object']); if (t != null) { if (onOf(p['burst'], true)) g.burst(t.x, t.y, Colors.white, 14); t.destroy(); } }
    case 'destroyTag': for (final t in g.findAll(s('tag'))) { if (onOf(p['burst'], true)) g.burst(t.x, t.y, const Color(0xFFFFD23F), 10); t.destroy(); }
    case 'spawn': { final t = (s('at') == 'other' ? c.other : null) ?? e; if (s('template').isNotEmpty) g.spawn(s('template'), t.x + v('ox'), t.y + v('oy')); }
    case 'setText': { final t = _ltarget(c, p['object']); if (t != null) { (t.text ??= {'value': '', 'size': 24, 'color': '#ffffff'})['value'] = s('text'); } }
    case 'setColor': { final t = _ltarget(c, p['object']); if (t != null) lfadeColor(g, t, s('color'), v('seconds')); }
    case 'teleport': { final t = g.find(s('to')); if (t != null) { e.x = t.x; e.y = t.y; } }
    case 'tagAdd': {
      final t = _ltarget(c, p['object']); if (t == null || s('tag').isEmpty) return null;
      final has = t.tags.contains(s('tag')), on = s('mode') == 'toggle' ? !has : s('mode') != 'remove';
      if (on) { t.tags.add(s('tag')); } else { t.tags.remove(s('tag')); }
    }
    case 'damage': {
      final t = _ltarget(c, p['object'] ?? 'other'); final hb = t?.part<Health>(); if (t == null || hb == null) return null;
      final n = v('amount');
      if (n < 0) { hb.heal(t, g, -n); } else { hb.damage(t, g, n, from: e, type: s('dtype') == 'normal' ? '' : s('dtype'), pierce: onOf(p['pierce'])); }
    }
    case 'invulnerable': { final t = _ltarget(c, p['object']); if (t != null) t.invuln = v('seconds'); }
    // motion
    case 'moveBy': {
      final d = v('seconds');
      if (d <= 0) { e.x += v('x'); e.y += v('y'); return null; }
      g.tween(e, 'x', e.x + v('x'), d, curve: s('ease')); g.tween(e, 'y', e.y + v('y'), d, curve: s('ease'));
      return wait() ? d : null;
    }
    case 'rotateBy': { final d = v('seconds'); if (d <= 0) { e.rz += v('degrees'); return null; } g.tween(e, 'rz', e.rz + v('degrees'), d, curve: s('ease')); return wait() ? d : null; }
    case 'scaleTo': { final d = math.max(0.01, v('seconds')), k = v('scale') == 0 ? 1.0 : v('scale'); g.tween(e, 'sx', k * e.sx.sign, d, curve: s('ease')); g.tween(e, 'sy', k, d, curve: s('ease')); return wait() ? d : null; }
    case 'fade': { final d = math.max(0.01, v('seconds')); g.tween(e, 'alpha', v('alpha').clamp(0, 1).toDouble(), d); return wait() ? d : null; }
    case 'punch': lpunch(g, e, s('what'), v('amount') == 0 ? 0.3 : v('amount'), v('seconds') == 0 ? 0.4 : v('seconds'));
    case 'setPos': {
      final t = _ltarget(c, p['object']); if (t == null) return null;
      if (onOf(p['relative'])) { t.x += v('x'); t.y += v('y'); } else { t.x = v('x'); t.y = v('y'); }
      t.body?..vx = 0..vy = 0;
    }
    case 'glideTo': {
      final t = g.find(s('to')) ?? lnearest(g, e, s('to')); if (t == null) return null;
      final d = math.max(0.01, v('seconds'));
      g.tween(e, 'x', t.x, d, curve: s('ease')); g.tween(e, 'y', t.y, d, curve: s('ease'));
      return onOf(p['wait'], true) ? d : null;
    }
    case 'face': { final t = g.find(s('tag')) ?? lnearest(g, e, s('tag')); if (t != null) e.rz = math.atan2(t.y - e.y, t.x - e.x) / deg; }
    // physics
    case 'push': { final t = s('who') == 'other' ? c.other : e; if (t == null) return null; final b = t.ensureBody('dynamic'); b.vx += v('x'); b.vy += v('y'); }
    case 'setVelocity': { final b = e.ensureBody('dynamic'); b.vx = v('x'); b.vy = v('y'); }
    case 'jump': { final b = e.body; if (b != null) { b.vy = -v('power'); g.sfx('jump'); } }
    case 'setGravity': g.gravity = v('y');
    case 'pushToward': {
      final t = g.find(s('tag')) ?? lnearest(g, e, s('tag')); if (t == null) return null;
      final b = e.ensureBody('dynamic'), dx = t.x - e.x, dy = t.y - e.y, l = math.max(1e-6, math.sqrt(dx * dx + dy * dy)), k = v('power') * (onOf(p['away']) ? -1 : 1);
      b.vx += dx / l * k; b.vy += dy / l * k;
    }
    case 'stopMove': { final t = _ltarget(c, p['object']); if (t != null) { t.body?..vx = 0..vy = 0; g.killTweens(t); } }
    // flow
    case 'wait': return math.max(0.0, v('seconds'));
    case 'waitRandom': return math.max(0.0, v('min') + math.Random().nextDouble() * math.max(0.0, v('max') - v('min')));
    case 'waitUntil': return LUntil(() => lcmp(g.numVar(s('name')), s('op'), v('value')));
    case 'onlyIf': return lcmp(g.numVar(s('name')), s('op'), v('value')) ? null : 'stop';
    case 'repeat': {
      final n = (c.reps[c.at] ?? 0) + 1;
      c.reps[c.at] = n;
      if (n <= v('times').round().clamp(0, 1000)) return LGoto(0);
      c.reps[c.at] = 0;
    }
    case 'stop': return 'stop';
    case 'runTrigger': LogicBus.of(g).emit('runTrigger', [s('name')]);
    case 'sendMessage': g.send(s('message'));
    case 'setState': e.part<StateMachine>()?.goTo(e, g, s('state'));
    case 'callEvent': {
      final on = s('on'), tag = s('object'), named = on == 'object named' ? g.find(tag) : null;
      bool Function(GameObject) who = on == 'other' ? (q) => q == c.other : on == 'all with tag' || on == 'first with tag' ? (q) => q.has(tag) : on == 'everything' ? (q) => true : on == 'object named' ? (q) => q == named : (q) => q == e;
      LogicBus.of(g).emit('graphCall', [s('name'), who, e, lval(p['value'])]);
    }
    case 'runFunction': {
      final on = s('on'), tag = s('object');
      final targets = on == 'other' ? [if (c.other != null) c.other!] : on == 'all with tag' ? g.findAll(tag) : on == 'first with tag' ? g.findAll(tag).take(1).toList() : on == 'object named' ? [if (g.find(tag) != null) g.find(tag)!] : on == 'everything' ? [...g.objects] : [e];
      for (final t in targets) { final r = t.part<VisualScript>()?.callFn(s('name'), {'a': v('a'), 'b': v('b'), 'c': 0}, e, null); if (r != null && r.$1 && s('store').isNotEmpty) g.setVar(s('store'), r.$2); }
    }
    case 'custom': {
      final def = (g.json['customActions'] as List? ?? const []).whereType<Map>().where((q) => q['id'] == p['ref']).firstOrNull;
      if (def == null || c.depth > 12) return null;
      final sub = c.sub();
      var fin = false;
      runInstructions(lbind(def['actions'] ?? const [], _customArgs(def, p)) as List?, sub, () => fin = true);
      return fin || p['wait'] == false ? null : LUntil(() => fin);
    }
    // camera
    case 'switchCamera' || 'camLive': g.send('camera:${s('camera')}');
    case 'camFollow': g.systems['camFollow'] = s('tag').isEmpty ? null : s('tag');
    case 'camZoom': {
      final cam = s('camera').isNotEmpty ? g.find(s('camera')) : g.activeCamera, z = v('zoom');
      if (cam != null) { if (z == 0) { cam.data.remove('camZoom'); } else { cam.data['camZoom'] = z; } } else { g.camZoom = z == 0 ? 1 : z; }
    }
    case 'screenFade': {
      final a = math.max(0.01, v('out')), h = math.max(0.0, v('hold')), b = math.max(0.01, v('in'));
      lscreenFade(g, colorOf(p['color']) ?? Colors.black, a, h, b);
      return onOf(p['wait'], true) ? a + h : null;
    }
    case 'shake': g.shake = math.max(g.shake, v('strength') == 0 ? 10 : v('strength'));
    // game
    case 'message': g.message(s('text'), v('seconds') == 0 ? 2 : v('seconds'));
    case 'snackbar': g.message(s('text'), v('seconds') == 0 ? 4 : v('seconds'));
    case 'toast': g.popText(g.screenOf(e), filled('text'), colorOf(p['color']) ?? Colors.white, 26);
    case 'talk': g.message('${s('who').isEmpty ? '' : '${s('who')}: '}${s('text')}', 3); return onOf(p['wait'], true) ? 3.0 : null;
    case 'sound': g.sfx(s('sound'));
    case 'vibrate' || 'haptic': g.buzz(s('style') == 'heavy' || s('style') == 'error');
    case 'save': if (g.saveGame(v('slot') <= 0 ? 1 : v('slot').toInt())) g.message('Game saved', 1.2);
    case 'load': g.loadGame(v('slot') <= 0 ? 1 : v('slot').toInt());
    case 'win' || 'nextLevel': g.win();
    case 'gameOver': g.gameOver();
    case 'restart': g.start(); return 'stop';
    case 'pauseGame': g.paused = s('mode') == 'pause' ? true : s('mode') == 'resume' ? false : !g.paused;
    case 'burst': { final t = s('at') == 'other' ? c.other : e; if (t != null) g.burst(t.x, t.y, colorOf(p['color']) ?? const Color(0xFFFFD23F), v('count').clamp(1, 200).toInt()); }
    case 'setPage': g.setVar('page', s('page'));
    // lists
    case 'listAdd': {
      final a = [...lvarList(g, s('list'))], val = lval(g.fill(s('value')));
      if (onOf(p['unique']) && a.any((x) => lsame(x, val))) return null;
      if (s('where') == 'at the start') { a.insert(0, val); } else { a.add(val); }
      g.setVar(s('list'), a);
    }
    case 'listRemove': {
      final a = [...lvarList(g, s('list'))], val = lval(p['value']);
      switch (s('mode')) {
        case 'last': if (a.isNotEmpty) a.removeLast();
        case 'first': if (a.isNotEmpty) a.removeAt(0);
        case 'all of this value': a.removeWhere((x) => lsame(x, val));
        default: { final i = a.indexWhere((x) => lsame(x, val)); if (i >= 0) a.removeAt(i); }
      }
      g.setVar(s('list'), a);
    }
    case 'listClear': {
      final a = [...lvarList(g, s('list'))];
      switch (s('do')) {
        case 'shuffle': a.shuffle();
        case 'sort up': a.sort((x, y) => lnum(x).compareTo(lnum(y)));
        case 'sort down': a.sort((x, y) => lnum(y).compareTo(lnum(x)));
        case 'reverse': { final r = a.reversed.toList(); a..clear()..addAll(r); }
        default: a.clear();
      }
      g.setVar(s('list'), a);
    }
    case 'listPick': { final a = lvarList(g, s('list')); if (a.isEmpty) return null; g.setVar(s('into'), s('which') == 'first' ? a.first : s('which') == 'last' ? a.last : a[math.Random().nextInt(a.length)]); }
    case 'mapSet': { final m = {...lvarMap(g, s('dict'))}, val = lval(g.fill(s('value'))); m[s('key')] = s('op') == 'add' ? lnum(m[s('key')]) + lnum(val) : val; g.setVar(s('dict'), m); }
    case 'mapRemove': { final m = s('key').isEmpty ? <String, Object?>{} : {...lvarMap(g, s('dict'))}; m.remove(s('key')); g.setVar(s('dict'), m); }
    default:
      if (_webOnlyActions.contains(type)) g.send(type);
  }
  return null;
}

/// Something that happened to an object this frame (for matching against logic events).
class LogicEv {
  LogicEv(this.type, {this.other, this.value, this.name = '', this.item = ''});
  final String type, name, item;
  final GameObject? other;
  final Object? value;
}
/// A matched event: who else was involved and the value that came with it.
class LogicHit { LogicHit({this.other, this.value}); final GameObject? other; final Object? value; }

/// Watches what happens to an object each frame (taps, touches, messages, keys, buttons, variables, health…) for logic events.
class LogicWatcher {
  LogicWatcher(this.e, this.g, {this.contacts = false}) {
    g.on((m) {
      if (e.dead) return;
      queue.add(LogicEv('message', name: m));
      if (m == 'won') queue.add(LogicEv('win'));
      if (m == 'game over') queue.add(LogicEv('lose'));
    });
    LogicBus.of(g).subs.add((type, a) {
      if (e.dead) return;
      if (type == 'runTrigger') queue.add(LogicEv('called', name: ltext(a[0])));
      if (type == 'graphCall' && (a[1] as bool Function(GameObject))(e)) queue.add(LogicEv('called', name: ltext(a[0]), other: a[2] as GameObject?, value: a[3]));
      if (type == 'state' && a[0] == e) queue.add(LogicEv('stateEntered', name: ltext(a[1])));
      if (type == 'animEnd' && a[0] == e) queue.add(LogicEv('animEnd', name: ltext(a[1])));
    });
    _vars = {for (final kv in g.vars.entries) kv.key: ltext(kv.value)};
  }
  final GameObject e;
  final PocketGame g;
  /// Does anything listen for touches (touch / stops touching)?
  bool contacts;
  List<LogicEv> queue = [], now = [];
  final Map<String, double> timers = {};
  final Map<String, Object?> edges = {};
  bool first = true;
  double age = 0, dt = 0, lastTap = -9;
  Map<String, String> _vars = {};
  final Set<LogicalKeyboardKey> _keys = {};
  Set<GameObject> _touching = {};
  double? _hp;
  bool _died = false;

  void push(LogicEv ev) => queue.add(ev);

  void frame(double dt) {
    final ev = queue;
    queue = [];
    this.dt = dt;
    age += dt;
    if (e.shown && g.tapsOn(e).isNotEmpty) {
      ev.add(LogicEv('tap'));
      if (g.time - lastTap < 0.35) { ev.add(LogicEv('doubleTap')); lastTap = -9; } else { lastTap = g.time; }
    }
    for (final k in g.keys) { if (!_keys.contains(k)) ev.add(LogicEv('key', name: lkeyName(k))); }
    _keys..clear()..addAll(g.keys);
    if (g.pressed.contains('jump')) ev.add(LogicEv('button', name: 'jump'));
    if (g.pressed.contains('action')) ev.add(LogicEv('button', name: 'fire'));
    for (final d in const ['up', 'down', 'left', 'right']) { if (g.pressed.contains('swipe:$d')) ev.add(LogicEv('swipe', name: d)); }
    if (first) { ev.add(LogicEv('start')); first = false; }
    // variables that changed
    for (final kv in g.vars.entries) {
      final t = ltext(kv.value);
      if (_vars[kv.key] != t) { ev.add(LogicEv('varChanged', name: kv.key)); if (kv.key == 'page') ev.add(LogicEv('pageChanged', name: t)); _vars[kv.key] = t; }
    }
    // health: damage, healing, death
    final hp = e.data['hp'];
    if (hp is num) {
      final was = _hp;
      if (was != null && hp < was) ev.add(LogicEv('damaged', value: ((was - hp) * 100).round() / 100, name: 'normal'));
      if (was != null && hp > was) ev.add(LogicEv('healed', value: ((hp - was) * 100).round() / 100));
      _hp = hp.toDouble();
    }
    final dead = e.part<Health>()?.dead ?? false;
    if (dead && !_died) ev.add(LogicEv('died'));
    _died = dead;
    // touches that started and ended
    if (contacts && !e.ui) {
      final cur = {for (final o in g.objects) if (o != e && !o.dead && !o.ui && PocketGame.overlap(e, o)) o};
      for (final o in cur) { if (!_touching.contains(o)) ev.add(LogicEv('touch', other: o)); }
      for (final o in _touching) { if (!cur.contains(o)) ev.add(LogicEv('touchEnd', other: o)); }
      _touching = cur;
    }
    now = ev;
  }

  bool _evOk(String type, Map<String, dynamic> p, LogicEv q) {
    switch (type) {
      case 'touch' || 'touchEnd': return q.other?.has(ltext(p['tag'])) ?? false;
      case 'button': return q.name == ltext(p['button']);
      case 'swipe': return q.name == ltext(p['dir']);
      case 'message': return q.name == ltext(p['message']);
      case 'animEnd': return ltext(p['clip']).isEmpty || q.name == ltext(p['clip']);
      case 'varChanged': return ltext(p['name']).isEmpty || q.name == ltext(p['name']);
      case 'called': return q.name == ltext(p['name']);
      case 'key': return q.name == lkeyWant(p['key']);
      case 'pageChanged': return ltext(p['page']).isEmpty || q.name == ltext(p['page']);
      case 'stateEntered': return ltext(p['state']).isEmpty || q.name == ltext(p['state']);
      case 'damaged': return ltext(p['dtype']).isEmpty || p['dtype'] == 'any' || q.name == p['dtype'];
      default: return true;
    }
  }

  /// Did this event happen? key: the listener's own timer / edge state; stateTime / finished: for state machines.
  LogicHit? match(Map x, String key, {double stateTime = 0, bool finished = false}) {
    final p = logicWith('ev', x), type = '${x['type']}';
    switch (type) {
      case 'every': {
        final t = (timers[key] ?? 0) + dt;
        if (t >= math.max(0.05, lnum(p['seconds']) == 0 ? 1 : lnum(p['seconds']))) { timers[key] = 0; return LogicHit(); }
        timers[key] = t; return null;
      }
      case 'variable': { final on = lcmp(g.numVar(ltext(p['name'])), ltext(p['op']), lnum(p['value'])), was = edges[key] == true; edges[key] = on; return on && !was ? LogicHit() : null; }
      case 'always': return LogicHit();
      case 'delay': { if (edges[key] == true || age < lnum(p['seconds'])) return null; edges[key] = true; return LogicHit(); }
      case 'random': return math.Random().nextDouble() < dt / math.max(0.1, lnum(p['seconds']) == 0 ? 3 : lnum(p['seconds'])) ? LogicHit() : null;
      case 'landed': {
        final b = e.body, gr = b?.grounded ?? false, was = edges[key];
        edges[key] = gr;
        return (b?.landed ?? 0) > 0 || (gr && was == false) ? LogicHit(value: (b?.landed ?? 0).round()) : null;
      }
      case 'near' || 'sees': {
        final t = lnearest(g, e, ltext(p['tag']));
        final on = t != null && (type == 'near' ? ldist(t, e) < (lnum(p['distance']) == 0 ? 120 : lnum(p['distance'])) : g.canSee(e, t));
        final was = edges[key] == true; edges[key] = on;
        return on && !was ? LogicHit(other: t) : null;
      }
      case 'longPress': {
        final secs = lnum(p['seconds']) == 0 ? 0.6 : lnum(p['seconds']);
        final held = g.pointers.values.where((q) => q.role != 'stick' && q.role != 'button' && g.time - q.t0 >= secs && g.hitsAt(e, q.at)).firstOrNull;
        if (held == null) { edges.remove(key); return null; }
        if (edges[key] == held.id) return null;
        edges[key] = held.id; return LogicHit();
      }
      case 'after': return stateTime >= lnum(p['seconds']) ? LogicHit() : null;
      case 'finished': return finished ? LogicHit() : null;
      default: {
        final hit = now.where((q) => q.type == type && _evOk(type, p, q)).firstOrNull;
        return hit == null ? null : LogicHit(other: hit.other, value: hit.value);
      }
    }
  }

  static const _edgeTypes = {'every', 'variable', 'always', 'after', 'finished', 'delay', 'random', 'landed', 'near', 'sees', 'longPress'};
  /// Every match this frame (two messages in one frame run a trigger twice); timed and edge events give at most one.
  List<LogicHit> matchAll(Map x, String key, {double stateTime = 0, bool finished = false}) {
    final type = '${x['type']}';
    if (_edgeTypes.contains(type)) { final m = match(x, key, stateTime: stateTime, finished: finished); return m == null ? const [] : [m]; }
    final p = logicWith('ev', x);
    return [for (final q in now) if (q.type == type && _evOk(type, p, q)) LogicHit(other: q.other, value: q.value)];
  }
  void resetTimers() => timers.clear();
}

bool _usesTouch(Iterable events) => events.any((x) => x is Map && (x['type'] == 'touch' || x['type'] == 'touchEnd'));
bool _usesTap(Iterable events) => events.any((x) => x is Map && (x['type'] == 'tap' || x['type'] == 'doubleTap' || x['type'] == 'longPress'));

/// Triggers (Game Creator style): On [event] → If [conditions] → Do [instructions, one after another, with waits].
/// Each trigger can run once or up to a number of times, have a cooldown, a delay, a chance, "any" conditions and an Else list.
class Triggers extends Component {
  Triggers(this.p) : list = [for (final t in (p['triggers'] is List ? p['triggers'] as List : const [])) if (t is Map) t.cast<String, dynamic>()];
  final Map<String, dynamic> p;
  final List<Map<String, dynamic>> list;
  late final List<({int runs, double last, LogicCtx? run})> _st = List.filled(list.length, (runs: 0, last: -1e9, run: null));
  LogicWatcher? w;
  static const _always = {'tap', 'message', 'called', 'win', 'lose', 'varChanged', 'pageChanged', 'inventory'};
  @override
  bool get always => true;
  Iterable get _events => list.map((t) => t['event']);
  void _watch(GameObject e, PocketGame g) {
    w ??= LogicWatcher(e, g, contacts: _usesTouch(_events));
    if (_usesTap(_events) && e.ui) g.tapTargets.add(e);
  }
  @override
  void start(GameObject e, PocketGame g) => _watch(e, g);
  void fire(int i, GameObject e, PocketGame g, {GameObject? other, Object? value}) {
    final t = list[i], st = _st[i];
    final max = t['once'] == true ? 1 : lnum(t['maxRuns']).round();
    if (max > 0 && st.runs >= max) return;
    if (lnum(t['cooldown']) > 0 && g.time - st.last < lnum(t['cooldown'])) return;
    final ch = t['chance'];
    if (ch != null && '$ch' != '' && lnum(ch) < 100 && math.Random().nextDouble() * 100 >= lnum(ch)) return;
    final c = LogicCtx(g, e, other: other, eventValue: value, afterDeath: e.dead);
    final ok = logicConditionsPass(t['conditions'] as List?, c, any: t['match'] == 'any');
    Object? steps = ok ? t['actions'] : t['elseActions'];
    if (steps is List && jsonEncode(steps).contains('@event')) steps = lbind(steps, {'event': value ?? ''});
    if (!ok && (steps is! List || steps.isEmpty)) return;
    final running = st.run;
    if (running != null && !running.done) { if (t['overlap'] == 'skip') return; if (t['overlap'] == 'restart') running.cancelled = true; }
    _st[i] = (runs: ok ? st.runs + 1 : st.runs, last: ok ? g.time : st.last, run: c);
    void go() { if (c.cancelled || (e.dead && !c.afterDeath)) return; runInstructions(steps as List?, c); }
    if (lnum(t['delay']) > 0) { g.after(lnum(t['delay']), go); } else { go(); }
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    _watch(e, g);
    final w = this.w!;
    w.frame(dt);
    for (var i = 0; i < list.length; i++) {
      final t = list[i], ev = t['event'];
      if (t['off'] == true || ev is! Map) continue;
      if (g.state != 'play' && !_always.contains(ev['type'])) continue;
      for (final hit in w.matchAll(ev, '$i')) { fire(i, e, g, other: hit.other, value: hit.value); }
    }
  }
  @override
  void gone(GameObject e, PocketGame g) {
    for (var i = 0; i < list.length; i++) { if (list[i]['off'] != true && (list[i]['event'] as Map?)?['type'] == 'destroyed') fire(i, e, g); }
  }
}

/// State Machine (PlayMaker style): the object is always in one state (Idle, Chase, Attack…). Each state runs actions when it
/// starts (and every frame, and when it ends), and moves to another state when an event happens (After N seconds, When done…).
class StateMachine extends Component {
  StateMachine(this.p) {
    final f = p['fsm'];
    fsm = f is Map ? f.cast<String, dynamic>() : {'states': []};
    for (final s in (fsm['states'] as List? ?? const [])) { if (s is Map) states['${s['id']}'] = s.cast<String, dynamic>(); }
  }
  final Map<String, dynamic> p;
  late final Map<String, dynamic> fsm;
  final Map<String, Map<String, dynamic>> states = {};
  Map<String, dynamic>? cur;
  double t = 0;
  bool finished = false;
  LogicCtx? run;
  LogicWatcher? w;
  String? get state => cur?['name'] as String?;
  List get _allTransitions => [for (final s in states.values) ...(s['transitions'] as List? ?? const []), ...(fsm['any'] as List? ?? const [])];

  void enter(String id, GameObject e, PocketGame g) {
    run?.cancelled = true;
    final was = cur;
    if (was != null) runInstructions(was['exit'] as List?, LogicCtx(g, e));
    cur = states[id]; t = 0; finished = false; w?.resetTimers();
    e.data['state'] = cur?['name'] ?? '';
    final now = cur;
    if (now == null) return;
    final c = run = LogicCtx(g, e);
    runInstructions(now['enter'] as List?, c, () => finished = true);
    LogicBus.of(g).emit('state', [e, now['name']]);
  }
  void goTo(GameObject e, PocketGame g, String name) {
    final s = states.values.where((q) => q['name'] == name || q['id'] == name).firstOrNull;
    if (s != null) enter('${s['id']}', e, g);
  }
  @override
  void start(GameObject e, PocketGame g) {
    w = LogicWatcher(e, g, contacts: _usesTouch(_allTransitions.map((tr) => tr is Map ? tr['event'] : null)));
    if (_usesTap(_allTransitions.map((tr) => tr is Map ? tr['event'] : null)) && e.ui) g.tapTargets.add(e);
    final first = (fsm['states'] as List? ?? const []).whereType<Map>().firstOrNull;
    enter('${fsm['start'] ?? first?['id']}', e, g);
  }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final s = cur, w = this.w;
    if (s == null || w == null) return;
    w.frame(dt);
    t += dt;
    final stay = (s['stay'] as List? ?? const []).where((it) => it is Map && it['type'] != 'wait').toList();
    if (stay.isNotEmpty) runInstructions(stay, LogicCtx(g, e));
    final trs = <(Map, String)>[
      for (final (i, tr) in (s['transitions'] as List? ?? const []).indexed) if (tr is Map) (tr, '${s['id']}:$i'),
      for (final (i, tr) in (fsm['any'] as List? ?? const []).indexed) if (tr is Map) (tr, 'any:$i'),
    ];
    for (final (tr, key) in trs) {
      final to = '${tr['to']}';
      if (!states.containsKey(to) || (key.startsWith('any') && to == '${s['id']}')) continue;
      final ev = tr['event'];
      if (ev is! Map) continue;
      final hit = w.match(ev, key, stateTime: t, finished: finished);
      if (hit == null || !logicConditionsPass(tr['conditions'] as List?, LogicCtx(g, e, other: hit.other))) continue;
      if ((tr['actions'] as List?)?.isNotEmpty ?? false) runInstructions(tr['actions'] as List?, LogicCtx(g, e, other: hit.other));
      enter(to, e, g);
      break;
    }
  }
  @override
  void gone(GameObject e, PocketGame g) => run?.cancelled = true;
}

// ---- Visual Script (node graphs) ----
// Native node families: events (start, every frame, every N seconds, tap, double tap, long press, touch / stops touching,
// trigger and collision enter / stay / exit, buttons, swipes, keys, screen touch, finger down / drag, messages, variables,
// my variables, damage / death / healing, win / game over / game state / pause, custom events, state entered, landed / left
// ground, near / far / sight, movement / falling / speed, shown / hidden, objects spawned / destroyed / none left, timers,
// first play / new day / welcome back, Triggers events as nodes); flow (branch, sequence, loops: count, for range, for each
// list / dictionary / tag / overlap, while, repeat until, break, continue; wait, random wait, wait frames, wait until, wait for
// message, once, flip-flop, cooldown, count to, every Nth, cycle, weighted / random branch, switch on number / text, gates,
// repeat every, delayed calls, functions with inputs and return values, delegates, message bindings); maths and logic (every
// value node: math, compare, random, formula, clamp, lerp, remap, noise, easing, vectors, angles…); variables, object
// variables, text and lists / dictionaries; objects (spawn, spawn and launch, destroy, show / hide, text, colour, position,
// scale, layer-free tags, teleport, look at, raycasts against solid objects, overlaps, pick nearest); motion and tweens (move,
// glide, punch, spin, pulse, fade, blink, typewriter text, counters); physics (velocity, push, forces, explosions, gravity,
// body type, trigger); camera (switch, zoom, move to, shake, flash / fade); game flow (score, lives, time, best, win, lose,
// restart, pause, save / load slots and saved variables, checkpoints, achievements, toasts and messages, sounds, haptics).
// Nodes for sign-in, cloud data, purchases, online play, social, phone permissions and web pages pass straight through
// (their "then"), sending their name as a message, as do any node types this runtime doesn't know.

class GRet { double v = 0; bool done = false; VoidCallback? late; }
class GFlow { int n = 0; VoidCallback? check; }
class GLoop { bool stop = false; }
/// What a running chain of nodes knows: the other object, the event's value, the loop it's in, the function it runs for.
class GCtx {
  GCtx({this.other, this.eventValue, this.dt = 1 / 60, this.steps = 0, this.index, this.item, this.key, this.args, this.ret, this.flow, this.loop, this.callDepth = 0, this.impact = 0, this.hit});
  GameObject? other;
  Object? eventValue, index, item, key;
  double dt, impact;
  int steps, callDepth;
  Map<String, double>? args;
  GRet? ret;
  GFlow? flow;
  GLoop? loop;
  ({double dist, Offset point, Offset normal})? hit;
  GCtx clone() => GCtx(other: other, eventValue: eventValue, dt: dt, steps: steps, index: index, item: item, key: key, args: args, ret: ret, flow: flow, loop: loop, callDepth: callDepth, impact: impact, hit: hit);
  GCtx fresh() => clone()..steps = 0;
}

double gfield(GameObject o, String a) => switch (a) {
      'x' => o.x, 'y' => o.y, 'rz' || 'rotation' || 'angle' => o.rz, 'sx' || 'scale' => o.sx, 'sy' => o.sy, 'alpha' || 'opacity' => o.alpha,
      'width' => o.half.width * 2, 'height' => o.half.height * 2, _ => 0,
    };

/// Formula node: a tiny, safe maths language. Numbers, a b c d, game variables by name, pi, e, time; + − × ÷ % ^,
/// comparisons (1 / 0), parentheses and functions (sin cos tan in degrees, abs, floor, round, sqrt, min, max, clamp, lerp, random…).
double gformula(String src, double Function(String) env) {
  final toks = RegExp(r'\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|==|!=|[-+*/%^(),<>×÷−]').allMatches(src).map((m) => m[0]!).toList();
  var i = 0;
  String? peek() => i < toks.length ? toks[i] : null;
  String? next() => i < toks.length ? toks[i++] : null;
  late double Function() cmp;
  double atom() {
    final t = next();
    if (t == null) throw const FormatException('unfinished');
    if (t == '(') { final a = cmp(); next(); return a; }
    final n = double.tryParse(t);
    if (n != null) return n;
    if (peek() == '(') {
      next();
      final args = <double>[];
      if (peek() != ')') { args.add(cmp()); while (peek() == ',') { next(); args.add(cmp()); } }
      next();
      double a0() => args.isNotEmpty ? args[0] : 0;
      double a1() => args.length > 1 ? args[1] : 0;
      return switch (t.toLowerCase()) {
        'sin' => math.sin(a0() * deg), 'cos' => math.cos(a0() * deg), 'tan' => math.tan(a0() * deg),
        'asin' => math.asin(a0()) / deg, 'acos' => math.acos(a0()) / deg, 'atan' => math.atan(a0()) / deg, 'atan2' => math.atan2(a0(), a1()) / deg,
        'abs' => a0().abs(), 'floor' => a0().floorToDouble(), 'ceil' => a0().ceilToDouble(), 'round' => a0().roundToDouble(), 'sqrt' => math.sqrt(math.max(0, a0())),
        'pow' => math.pow(a0(), a1()).toDouble(), 'sign' => a0().sign, 'log' => math.log(a0()), 'exp' => math.exp(a0()),
        'min' => args.isEmpty ? 0 : args.reduce(math.min), 'max' => args.isEmpty ? 0 : args.reduce(math.max),
        'clamp' => a0().clamp(math.min(a1(), args.length > 2 ? args[2] : 0), math.max(a1(), args.length > 2 ? args[2] : 0)).toDouble(),
        'lerp' => a0() + (a1() - a0()) * (args.length > 2 ? args[2] : 0), 'mod' => a1() == 0 ? 0 : ((a0() % a1()) + a1()) % a1(),
        'random' => (args.isEmpty ? 0 : a0()) + math.Random().nextDouble() * ((args.length > 1 ? a1() : 1) - (args.isEmpty ? 0 : a0())),
        _ => throw FormatException('unknown function $t'),
      };
    }
    final k = t.toLowerCase();
    if (k == 'pi') return math.pi;
    if (k == 'e') return math.e;
    return env(t);
  }
  double unary() { if (peek() == '-' || peek() == '−') { next(); return -unary(); } if (peek() == '+') { next(); return unary(); } return atom(); }
  double pow() { final a = unary(); if (peek() != '^') return a; next(); return math.pow(a, pow()).toDouble(); }
  double mul() {
    var a = pow();
    while (const ['*', '/', '%', '×', '÷'].contains(peek())) {
      final o = next(), b = pow();
      a = o == '%' ? (b == 0 ? 0 : ((a % b) + b) % b) : o == '/' || o == '÷' ? (b == 0 ? 0 : a / b) : a * b;
    }
    return a;
  }
  double add() { var a = mul(); while (peek() == '+' || peek() == '-' || peek() == '−') { final o = next(), b = mul(); a = o == '+' ? a + b : a - b; } return a; }
  cmp = () {
    var a = add();
    while (const ['<', '>', '<=', '>=', '==', '!='].contains(peek())) {
      final o = next()!, b = add();
      a = lcmp(a, o, b) ? 1 : 0;
    }
    return a;
  };
  try { final r = cmp(); return r.isFinite ? r : 0; } catch (_) { return 0; }
}

/// One visual script: its nodes and links, its state, and how it runs (events start chains of nodes along their "then" links).
class GraphRun {
  GraphRun(Map graph) {
    for (final n in (graph['nodes'] as List? ?? const [])) { if (n is Map) { final m = n.cast<String, dynamic>(); nodes.add(m); byId['${m['id']}'] = m; } }
    for (final l in (graph['links'] as List? ?? const [])) {
      if (l is! Map) continue;
      final f = l['from'], t = l['to'];
      if (f is! Map || t is! Map) continue;
      outs.putIfAbsent('${f['node']}|${f['port']}', () => []).add('${t['node']}');
      ins['${t['node']}|${t['port']}'] = '${f['node']}';
      linkedPorts.putIfAbsent('${f['node']}', () => {}).add('${f['port']}');
    }
  }
  final List<Map<String, dynamic>> nodes = [];
  final Map<String, Map<String, dynamic>> byId = {};
  final Map<String, List<String>> outs = {};
  final Map<String, String> ins = {};
  final Map<String, Set<String>> linkedPorts = {};
  final Map<String, Object?> state = {};
  final Map<String, double> timers = {};
  final Map<String, Set<Object>> repeats = {};
  final List<(int, VoidCallback)> frameQueue = [];
  final Map<String, ({String message, String func})> bindings = {};
  final Map<int, ({double t, Offset at, bool done})> press = {};
  late PocketGame g;
  late GameObject e;
  LogicWatcher? lw;
  late List<Map<String, dynamic>> leNodes;
  final Set<int> _contacts = {};
  final Map<int, GameObject> _contactObj = {};
  Set<int> _alive = {};
  Map<String, String> _vars = {};
  double? _hp;
  bool _died = false, _paused = false, _first = true;
  String _gameState = '';
  bool? wasGround, wasOn;
  double lastTapT = -9;

  String ty(Map n) => '${n['type']}';
  bool has(List<String> types) => nodes.any((n) => types.contains(n['type']) && n['off'] != true);
  Iterable<Map<String, dynamic>> nodesOf(String type) => nodes.where((n) => n['type'] == type && n['off'] != true);
  Object? param(Map n, String k) {
    final pr = n['params'];
    if (pr is Map && pr[k] != null) return pr[k];
    return graphDefaults[ty(n)]?[k];
  }
  String ps(Map n, String k) => ltext(param(n, k));
  double pn(Map n, String k) => lnum(param(n, k));
  Object? input(Map n, String k, GCtx ctx, [int depth = 0]) {
    final from = ins['${n['id']}|$k'];
    return from != null && depth < 50 ? value(byId[from], ctx, depth + 1) : param(n, k);
  }
  double inum(Map n, String k, GCtx ctx) => lnum(input(n, k, ctx));
  bool tagOk(GameObject o, String tag) => tag.isEmpty || o.has(tag);
  void setMy(GameObject? who, String k, Object? v) { if (who == null) return; final old = who.data[k]; who.data[k] = v; if (!lsame(old, v)) LogicBus.of(g).emit('myvar', [who, k, v]); }
  GameObject? who(Map n, GCtx ctx, [String key = 'target', String self = 'self']) { final w = ps(n, key); return w == 'other' ? ctx.other : e; }

  void follow(Map n, String port, GCtx ctx) {
    for (final id in outs['${n['id']}|$port'] ?? const <String>[]) { run(byId[id], ctx); }
  }
  /// Something in a loop's pass carries on later (a Wait): the loop holds on until it's done. Returns the release.
  VoidCallback hold(GCtx ctx) { final f = ctx.flow; if (f != null) f.n++; return () { if (f != null) { f.n--; f.check?.call(); } }; }
  /// A loop's passes one after another; a pass with a Wait finishes before the next starts; "done" after the last.
  void seq(Map n, GCtx ctx, int count, Map<String, Object?>? Function(int i) pass, [VoidCallback? after]) {
    final outer = ctx.flow, loop = GLoop();
    var i = 0;
    var held = false;
    late void Function() next;
    next = () {
      while (i < count && !loop.stop && !e.dead) {
        final extra = pass(i++);
        if (extra == null) break;
        final f = GFlow();
        final c = ctx.clone()..loop = loop..flow = f;
        if (extra.containsKey('index')) c.index = extra['index'];
        if (extra.containsKey('item')) c.item = extra['item'];
        if (extra.containsKey('key')) c.key = extra['key'];
        if (extra.containsKey('other')) { c.other = extra['other'] as GameObject?; c.steps = 0; }
        follow(n, 'each', c);
        if (f.n > 0) {
          if (!held && outer != null) { outer.n++; held = true; }
          f.check = () { if (f.n == 0) { f.check = null; next(); } };
          return;
        }
      }
      if (!e.dead) { if (after != null) { after(); } else { follow(n, 'done', ctx); } }
      if (held && outer != null) { held = false; outer.n--; outer.check?.call(); }
    };
    next();
  }
  /// Run this script's Function (inputs a–c). onDone(value, late): a Function that Waits before Return Value calls it later.
  double callFunction(GCtx ctx, String name, Map<String, double> args, [void Function(double v, bool late)? onDone]) {
    final depth = ctx.callDepth + 1;
    if (depth > 20) { onDone?.call(0, false); return 0; }
    final ret = GRet(), f = GFlow();
    for (final fn in nodes) {
      if (fn['type'] == 'funcDef' && ps(fn, 'name') == name) {
        follow(fn, 'then', GCtx(other: ctx.other, dt: ctx.dt, args: args, ret: ret, callDepth: depth, flow: f));
        if (ret.done) break;
      }
    }
    if (onDone != null) {
      if (ret.done || f.n <= 0) { onDone(ret.v, false); }
      else {
        var fin = false;
        void end() { if (fin) return; fin = true; f.check = null; ret.late = null; onDone(ret.v, true); }
        f.check = () { if (f.n <= 0) end(); };
        ret.late = end;
      }
    }
    return ret.v;
  }
  bool hasFunction(String name) => nodes.any((n) => n['type'] == 'funcDef' && ps(n, 'name') == name);

  /// Where a ray from this object hits a solid object (or one with a tag).
  ({double dist, Offset point, Offset normal, GameObject? o})? ray(Map n, GCtx ctx) {
    final dir = ps(n, 'dir');
    Offset d;
    if (dir == 'toward tag') { final t = lnearest(g, e, ps(n, 'toward')); if (t == null) return null; d = Offset(t.x - e.x, t.y - e.y); }
    else if (dir == 'custom') { d = Offset(inum(n, 'dx', ctx), inum(n, 'dy', ctx)); }
    else if (dir == 'up') { d = const Offset(0, -1); }
    else if (dir == 'down' || dir == 'ahead & down') { d = const Offset(0, 1); }
    else if (dir == 'left') { d = const Offset(-1, 0); }
    else if (dir == 'right') { d = const Offset(1, 0); }
    else { final k = e.data['flipX'] == true || e.sx < 0 ? -1.0 : 1.0; d = Offset(math.cos(e.rz * deg) * k, math.sin(e.rz * deg) * k); }
    if (d.distance == 0) return null;
    d = d / d.distance;
    var o = Offset(e.x, e.y);
    if (dir == 'ahead & down') { final k = e.data['flipX'] == true || e.sx < 0 ? -1.0 : 1.0; o = Offset(e.x + k * (e.half.width + 6), e.y); }
    final max = inum(n, 'distance', ctx) > 0 ? inum(n, 'distance', ctx) : dir == 'ahead & down' ? e.half.height + 24 : 400.0;
    final tag = ps(n, 'tag'), triggers = onOf(param(n, 'triggers'));
    ({double dist, Offset point, Offset normal, GameObject? o})? best;
    for (final q in g.objects) {
      if (q == e || q.dead || q.ui) continue;
      if (tag.isNotEmpty) { if (!q.has(tag)) continue; } else if (!(q.body?.solid ?? false) && !(triggers && q.body != null)) { continue; }
      final r = Rect.fromCenter(center: Offset(q.x, q.y), width: q.half.width * 2, height: q.half.height * 2);
      // slab test
      var t0 = 0.0, t1 = max;
      var nrm = Offset.zero;
      var ok = true;
      for (final ax in [0, 1]) {
        final oo = ax == 0 ? o.dx : o.dy, dd = ax == 0 ? d.dx : d.dy, lo = ax == 0 ? r.left : r.top, hi = ax == 0 ? r.right : r.bottom;
        if (dd.abs() < 1e-9) { if (oo < lo || oo > hi) { ok = false; break; } continue; }
        var a = (lo - oo) / dd, b = (hi - oo) / dd;
        var na = ax == 0 ? const Offset(-1, 0) : const Offset(0, -1);
        if (a > b) { final tmp = a; a = b; b = tmp; na = -na; }
        if (a > t0) { t0 = a; nrm = na; }
        t1 = math.min(t1, b);
        if (t0 > t1) { ok = false; break; }
      }
      if (!ok || (best != null && t0 >= best.dist)) continue;
      best = (dist: t0, point: o + d * t0, normal: nrm, o: q);
    }
    return best;
  }

  // ---- values ----
  Object? value(Map? n, GCtx ctx, [int depth = 0]) {
    if (n == null) return 0;
    final t = ty(n);
    if (t.startsWith('lc_')) {
      final k = t.substring(3), it = <String, dynamic>{'type': k, ...?(n['params'] as Map?)?.cast<String, dynamic>()};
      return logicConditionsPass([it], LogicCtx(g, e, other: ctx.other, eventValue: ctx.eventValue));
    }
    Object? i(String k) => input(n, k, ctx, depth);
    double I(String k) => lnum(i(k));
    String P(String k) => ps(n, k);
    double pn2(String k) => pn(n, k);
    switch (t) {
      case 'number': return pn2('value');
      case 'getVar': return g.numVar(P('name'));
      case 'random': { final a = pn2('min'), b = pn2('max'); return a == a.roundToDouble() && b == b.roundToDouble() ? math.min(b, rand(a, b + 1).floorToDouble()) : rand(a, b); }
      case 'math': {
        final a = I('a'), b = I('b');
        return switch (P('op')) { '+' => a + b, '−' || '-' => a - b, '×' || '*' => a * b, '÷' || '/' => b == 0 ? 0 : a / b, 'min' => math.min(a, b), 'max' => math.max(a, b), 'mod' => b == 0 ? 0 : ((a % b) + b) % b, 'power' => math.pow(a, b).toDouble(), _ => 0 };
      }
      case 'compare': return lcmp(I('a'), P('op'), I('b'));
      case 'and': return ltruthy(i('a')) && ltruthy(i('b'));
      case 'or': return ltruthy(i('a')) || ltruthy(i('b'));
      case 'not': return !ltruthy(i('a'));
      case 'position': return gfield(e, P('axis'));
      case 'distance': { final o = g.findAll(P('tag')).firstOrNull; return o == null ? double.infinity : ldist(o, e); }
      case 'time': return g.time;
      case 'deltaTime': return ctx.dt;
      case 'hasSave': return g.hasSave(pn2('slot') <= 0 ? 1 : pn2('slot').toInt());
      case 'grounded': return e.body?.grounded ?? false;
      case 'velocity': { final b = e.body; if (b == null) return 0; return P('axis') == 'speed' ? math.sqrt(b.vx * b.vx + b.vy * b.vy) : P('axis') == 'y' ? b.vy : P('axis') == 'x' ? b.vx : 0; }
      case 'touching': return g.touching(e, (o) => o.has(P('tag'))).isNotEmpty;
      case 'canSee': { final o = g.findAll(P('tag')).where((q) => q != e).firstOrNull; return o != null && g.canSee(e, o) && (pn2('range') <= 0 || ldist(o, e) <= pn2('range')); }
      case 'math1': {
        final a = I('a');
        return switch (P('op')) {
          'abs' => a.abs(), 'round' => a.roundToDouble(), 'floor' => a.floorToDouble(), 'ceil' => a.ceilToDouble(), 'sqrt' => math.sqrt(math.max(0, a)), 'negate' => -a,
          'sin' => math.sin(a * deg), 'cos' => math.cos(a * deg), 'tan' => math.tan(a * deg), 'square' => a * a, 'cube root' => (a < 0 ? -1 : 1) * math.pow(a.abs(), 1 / 3).toDouble(),
          'reciprocal' => a == 0 ? 0 : 1 / a, 'fraction' => a - a.floorToDouble(), 'log' => a > 0 ? math.log(a) : 0, 'exp' => math.exp(a), _ => a,
        };
      }
      case 'clamp': { final lo = math.min(I('min'), I('max')), hi = math.max(I('min'), I('max')); return I('value').clamp(lo, hi).toDouble(); }
      case 'lerp': return I('a') + (I('b') - I('a')) * I('t');
      case 'loopIndex': return lnum(ctx.index);
      case 'angleTo': { final o = lnearest(g, e, P('tag')); return o == null ? 0 : math.atan2(o.y - e.y, o.x - e.x) / deg; }
      case 'countTag': return g.findAll(P('tag')).length;
      case 'exists': return g.find(P('object')) != null;
      case 'health': return e.part<Health>()?.hp ?? lnum(e.data['hp']);
      case 'healthOf': {
        final o = P('object').isEmpty ? e : (g.find(P('object')) ?? e), d = o.data;
        double pc(Object? a, Object? b) => lnum(b) == 0 ? 0 : lnum(a) / lnum(b) * 100;
        return switch (P('what')) { 'max health' => lnum(d['hpMax']), 'health %' => pc(d['hp'], d['hpMax']), 'shield' => lnum(d['hpShield']), 'hunger' => lnum(d['hunger']), 'hunger %' => pc(d['hunger'], d['hungerMax']), 'thirst' => lnum(d['thirst']), 'thirst %' => pc(d['thirst'], d['thirstMax']), _ => lnum(d['hp']) };
      }
      case 'itemCount': return g.numVar('item_${P('item')}');
      case 'hasItem': return g.numVar('item_${P('item')}') >= math.max(1, I('count'));
      case 'joystick': { final a = g.axis(); return P('axis') == 'y' ? a.dy : a.dx; }
      case 'screen': return P('what') == 'height' ? g.screen.height : g.screen.width;
      case 'isMoving': { final b = e.body; if (b != null) return math.sqrt(b.vx * b.vx + b.vy * b.vy) > 10; final m = state['_moved']; return m is double && g.time - m < 0.1; }
      case 'isTweening': return g.tweens.any((tw) => tw.o == e);
      case 'choose': return ltruthy(i('condition')) ? I('yes') : I('no');
      case 'wave': {
        final tt = g.time * I('speed'), k = I('size'), f = tt - tt.floorToDouble();
        return k * (P('shape') == 'square' ? (f < 0.5 ? 1 : -1) : P('shape') == 'triangle' ? 1 - 4 * (f - 0.5).abs() : math.sin(tt * math.pi * 2));
      }
      case 'remap': { final a = I('fromMin'), b = I('fromMax'), k = b == a ? 0.0 : (I('value') - a) / (b - a); return I('toMin') + (I('toMax') - I('toMin')) * k; }
      case 'objPos': { final o = g.find(P('object')) ?? lnearest(g, e, P('object')) ?? (e.has(P('object')) ? e : null); return o == null ? 0 : gfield(o, P('axis')); }
      case 'isHolding': return g.pointers.isNotEmpty;
      case 'touchPos': {
        final pt = g.pointers.values.firstOrNull?.at ?? g.taps.firstOrNull?.screen ?? g.ups.firstOrNull?.at;
        if (pt != null) state['_finger'] = g.toWorld(pt);
        final f = state['_finger'] as Offset?;
        return f == null ? 0 : P('axis') == 'y' ? f.dy : f.dx;
      }
      case 'coinFlip': return math.Random().nextBool();
      case 'level': return g.numVar('level') == 0 ? 1 : g.numVar('level');
      case 'impactSpeed': return ctx.impact;
      case 'inTrigger' || 'isColliding': {
        final wantSensor = t == 'inTrigger';
        return g.objects.any((o) => o != e && !o.dead && !o.ui && tagOk(o, P('tag')) && PocketGame.overlap(e, o) && _isSensor(o) == wantSensor);
      }
      case 'rayHits': return ray(n, ctx) != null;
      case 'hitInfo': {
        final h = ctx.hit; if (h == null) return 0;
        final w = P('what');
        if (w == 'distance') return h.dist;
        final parts = w.split(' ');
        final v = parts[0] == 'point' ? h.point : h.normal;
        return parts.length > 1 && parts[1] == 'y' ? v.dy : parts.length > 1 && parts[1] == 'x' ? v.dx : 0;
      }
      case 'countRadius': { final r = I('radius') > 0 ? I('radius') : 150; return g.objects.where((q) => q != e && !q.dead && !q.ui && tagOk(q, P('tag')) && ldist(q, e) <= r).length; }
      case 'onScreen': return g.viewBounds.inflate(10).contains(Offset(e.x, e.y));
      case 'otherInfo': {
        final o = ctx.other; if (o == null) return 0;
        return switch (P('what')) {
          'speed' => o.body == null ? 0 : math.sqrt(o.body!.vx * o.body!.vx + o.body!.vy * o.body!.vy),
          'distance' => ldist(o, e), 'angle' => math.atan2(o.y - e.y, o.x - e.x) / deg, 'health' => o.part<Health>()?.hp ?? lnum(o.data['hp']),
          final w => gfield(o, w),
        };
      }
      case 'otherHasTag': return ctx.other?.has(P('tag')) ?? false;
      case 'hasOther': return ctx.other != null && !ctx.other!.dead;
      case 'pageIs': return lsame(g.vars[P('var').isEmpty ? 'page' : P('var')], P('page'));
      case 'curPage': return ltext(g.vars[P('var').isEmpty ? 'page' : P('var')]);
      case 'getMyVar': return lnum(e.data[P('name')]);
      case 'textIs': {
        final a = ltext(g.vars[P('name')]).toLowerCase(), b = P('text').toLowerCase();
        return switch (P('op')) { 'contains' => a.contains(b), 'starts with' => a.startsWith(b), 'is empty' => a.trim().isEmpty, _ => a == b };
      }
      case 'listGet': { final a = lvarList(g, P('name')), k = I('position').round() - 1; return k >= 0 && k < a.length ? lnum(a[k]) : 0; }
      case 'listLen': return lvarList(g, P('name')).length;
      case 'listHas': { final v = I('value'); return lvarList(g, P('name')).any((q) => lnum(q) == v); }
      case 'listFind': { final v = I('value'); return lvarList(g, P('name')).indexWhere((q) => lnum(q) == v) + 1; }
      case 'listRandom': { final a = lvarList(g, P('name')); return a.isEmpty ? 0 : lnum(a[math.Random().nextInt(a.length)]); }
      case 'listStat': {
        final a = lvarList(g, P('name')).map(lnum).toList(); if (a.isEmpty) return 0;
        final sum = a.reduce((x, y) => x + y);
        return switch (P('op')) { 'min' => a.reduce(math.min), 'max' => a.reduce(math.max), 'average' => sum / a.length, _ => sum };
      }
      case 'loopItem': return lnum(ctx.item);
      case 'loopItemText': return ltext(ctx.item);
      case 'loopKey': return ltext(ctx.key);
      case 'funcArg': return ctx.args?[P('which').isEmpty ? 'a' : P('which')] ?? 0;
      case 'callFunc': return callFunction(ctx, P('name'), {'a': I('a'), 'b': I('b'), 'c': I('c')});
      case 'callerIs': return ctx.other?.has(P('tag')) ?? false;
      case 'getOtherVar': return lnum(ctx.other?.data[P('name')]);
      case 'varAt': { final o = g.find(P('object')) ?? lnearest(g, e, P('object')); return lnum(o?.data[P('name')]); }
      case 'getObjVar': { final o = _named(P('object'), ctx); return lnum(o?.data[P('name')]); }
      case 'getObjText': { final o = _named(P('object'), ctx); return ltext(o?.data[P('name')]); }
      case 'eventValue': return lnum(ctx.eventValue);
      case 'eventText': return ltext(ctx.eventValue);
      case 'directionTo': {
        final o = lnearest(g, e, P('tag')); if (o == null) return 0;
        final dx = o.x - e.x, dy = o.y - e.y, l = math.max(1e-9, math.sqrt(dx * dx + dy * dy));
        return P('axis') == 'y' ? dy / l : P('axis') == 'x' ? dx / l : 0;
      }
      case 'distBetween': { final a = g.find(P('a')), b = g.find(P('b')); return a != null && b != null ? ldist(a, b) : 0; }
      case 'snapTo': { final st = I('step').abs(); return st == 0 ? I('value') : (I('value') / st).roundToDouble() * st; }
      case 'pingPong': { final l = I('length').abs() == 0 ? 1.0 : I('length').abs(), tt = ((I('value') % (2 * l)) + 2 * l) % (2 * l); return tt <= l ? tt : 2 * l - tt; }
      case 'sign': return I('value').sign;
      case 'smooth': {
        final key = 'sm:${n['id']}', target = I('target'), cur = state.containsKey(key) ? lnum(state[key]) : target, k = math.min(1.0, ctx.dt * (I('speed') == 0 ? 5 : I('speed')));
        final v = cur + (target - cur) * k; state[key] = v; return v;
      }
      case 'chanceOf': return math.Random().nextDouble() * 100 < I('percent');
      case 'fingers': return g.pointers.length;
      case 'isPaused': return g.paused;
      case 'childCount': return g.objects.where((q) => q.parent == e && !q.dead).length;
      case 'formula': {
        final env = {'a': I('a'), 'b': I('b'), 'c': I('c'), 'd': I('d')};
        return gformula(P('expr').isEmpty ? '0' : P('expr'), (k) => env[k] ?? (k.toLowerCase() == 'time' ? g.time : g.numVar(k)));
      }
      case 'randomRange': { final a = I('min'), b = I('max'); return onOf(param(n, 'whole')) ? rand(math.min(a, b), math.max(a, b) + 1).floorToDouble() : rand(a, b); }
      case 'randomPick': { final c = pn2('count').round().clamp(2, 4); return I('abcd'[math.Random().nextInt(c)]); }
      case 'noise': { final sc = I('scale') == 0 ? 1.0 : I('scale'), x = (P('by') == 'input value' ? I('value') : g.time + I('value')) * sc; return _noise1(x); }
      case 'invLerp': { final a = I('a'), b = I('b'); return b == a ? 0 : (I('value') - a) / (b - a); }
      case 'moveTowards': { final c = I('current'), tg = I('target'), st = I('step').abs(); return (tg - c).abs() <= st ? tg : c + (tg - c).sign * st; }
      case 'angleDiff': return ((((I('b') - I('a')) % 360) + 540) % 360) - 180;
      case 'wrap': { final lo = I('min'), hi = I('max'), r = hi - lo; return r == 0 ? lo : lo + (((I('value') - lo) % r) + r) % r; }
      case 'roundTo': { final k = math.pow(10, I('decimals').round().clamp(0, 8)).toDouble(); return (I('value') * k).roundToDouble() / k; }
      case 'percent': return I('total') == 0 ? 0 : I('part') / I('total') * 100;
      case 'easeVal': return ease(P('ease'), I('t').clamp(0, 1).toDouble());
      case 'vecLength': return math.sqrt(I('x') * I('x') + I('y') * I('y') + I('z') * I('z'));
      case 'distPoints': return (Offset(I('x2'), I('y2')) - Offset(I('x1'), I('y1'))).distance;
      case 'anglePoints': return math.atan2(I('y2') - I('y1'), I('x2') - I('x1')) / deg;
      case 'minMax3': {
        final c = pn2('count').round().clamp(2, 4), vals = [for (final k in 'abcd'.substring(0, c).split('')) I(k)];
        return switch (P('op')) { 'min' => vals.reduce(math.min), 'average' => vals.reduce((a, b) => a + b) / vals.length, 'sum' => vals.reduce((a, b) => a + b), _ => vals.reduce(math.max) };
      }
      case 'between': { final v = I('value'), a = I('min'), b = I('max'); return v >= math.min(a, b) && v <= math.max(a, b); }
      case 'isEven': return I('value').round() % 2 == 0;
      case 'isUnlocked': return g.prefs?.getString('pocket.ach.${g.saveKey}.${P('name')}') == '1';
      case 'gameValue': { final w = P('what'); return w == 'time left' ? g.numVar('time') : w == 'level' ? (g.numVar('level') == 0 ? 1 : g.numVar('level')) : w == 'levels' ? 1 : g.numVar(w); }
      case 'gameStateIs': { final st = P('state'); return st == 'paused' ? g.paused : !g.paused && g.state == (switch (st) { 'playing' => 'play', 'title' => 'title', 'game over' => 'over', 'won' => 'win', _ => st }); }
      case 'callFuncOn': { final o = _whoOf(P('on'), P('object'), ctx).firstOrNull; return o?.part<VisualScript>()?.callFn(P('name'), {'a': I('a'), 'b': I('b'), 'c': I('c')}, e, null).$2 ?? 0; }
      case 'objHasFunc': return _named(P('object'), ctx)?.part<VisualScript>()?.hasFn(P('name')) ?? false;
      case 'liveCamera': return g.activeCamera?.name ?? '';
      case 'camIsLive': return g.activeCamera?.name == P('camera');
      case 'camValue': { final w = P('what'); return w == 'zoom' ? g.camZoom : w == 'y' ? g.camY : g.camX; }
      case 'arrGetText': { final a = lvarList(g, P('name')), k = I('position').round(); final idx = k < 0 ? a.length + k : k - 1; return idx >= 0 && idx < a.length ? ltext(a[idx]) : ''; }
      case 'arrJoin': return lvarList(g, P('name')).map(ltext).join(param(n, 'sep') == null ? ', ' : ltext(param(n, 'sep')));
      case 'arrCount': { final v = lval(i('value')); return lvarList(g, P('name')).where((x) => lsame(x, v)).length; }
      case 'arrIndexOfMax': {
        final a = lvarList(g, P('name')).map(lnum).toList(); if (a.isEmpty) return 0;
        var b = 0;
        for (var k = 1; k < a.length; k++) { if (P('which') == 'smallest' ? a[k] < a[b] : a[k] > a[b]) b = k; }
        return b + 1;
      }
      case 'mapGet': return ltext(lvarMap(g, P('name'))[ltext(i('key'))]);
      case 'mapGetNum': return lnum(lvarMap(g, P('name'))[ltext(i('key'))]);
      case 'mapHas': return lvarMap(g, P('name')).containsKey(ltext(i('key')));
      case 'mapSize': return lvarMap(g, P('name')).length;
      case 'callDelegateV': { final f = ltext(g.vars[P('var')]); return f.isEmpty ? 0 : callFunction(ctx, f, {'a': I('a'), 'b': I('b'), 'c': I('c')}); }
      case 'hasFunction': return hasFunction(P('func'));
      case 'textJoin': return [i('a'), i('b'), i('c')].map(ltext).where((x) => x.isNotEmpty).join(param(n, 'sep') == null ? '' : ltext(param(n, 'sep')));
      case 'textFill': {
        final a = I('a'), b = I('b');
        return P('text').replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) { final k = m[1]!; final v = k == 'a' ? a : k == 'b' ? b : e.data[k] ?? g.vars[k]; return v is num ? formatNumber(v.toDouble()) : ltext(v); });
      }
      case 'numText': return _numText(I('value'), P('format'));
      case 'textLen': return ltext(i('text')).length;
      case 'textCase': {
        final s = ltext(i('text'));
        return switch (P('to')) {
          'lower' => s.toLowerCase(), 'Title Case' => s.toLowerCase().replaceAllMapped(RegExp(r'(^|\s)\S'), (m) => m[0]!.toUpperCase()),
          'reversed' => s.split('').reversed.join(), 'trimmed' => s.trim(), _ => s.toUpperCase(),
        };
      }
      case 'textReplace': { final f = ltext(i('find')); return f.isEmpty ? ltext(i('text')) : ltext(i('text')).split(f).join(ltext(i('with'))); }
      case 'textPart': { final s = ltext(i('text')).split(''), a = math.max(0, I('start').round() - 1); return a >= s.length ? '' : s.sublist(a, math.min(s.length, a + math.max(0, I('length').round()))).join(); }
      case 'textCheck': {
        final a = ltext(i('text')), b = ltext(i('other'));
        return switch (P('op')) {
          'equals' => a == b, 'equals (any case)' => a.toLowerCase() == b.toLowerCase(), 'contains' => a.toLowerCase().contains(b.toLowerCase()),
          'starts with' => a.toLowerCase().startsWith(b.toLowerCase()), 'ends with' => a.toLowerCase().endsWith(b.toLowerCase()), 'is empty' => a.trim().isEmpty, 'is a number' => double.tryParse(a.trim()) != null, _ => false,
        };
      }
      case 'textNum': return double.tryParse(ltext(i('text')).replaceAll(RegExp(r'[, ]'), '')) ?? 0;
      case 'getText': return ltext(g.vars[P('name')]);
      case 'randomWord': { final w = _words(P('words')); return w.isEmpty ? '' : w[math.Random().nextInt(w.length)]; }
      case 'wordAt': { final w = _words(P('words')); if (w.isEmpty) return ''; final k = ((I('position').round() - 1) % w.length + w.length) % w.length; return w[k]; }
      case 'timerValue': {
        final tm = _timers[P('name').isEmpty ? 'timer' : P('name')]; if (tm == null) return 0;
        return switch (P('what')) { 'whole seconds' => tm.down ? tm.t.ceilToDouble() : tm.t.floorToDouble(), 'fraction done (0–1)' => tm.down ? (tm.total == 0 ? 1 : 1 - tm.t / tm.total) : 0, 'is running' => tm.running, _ => tm.t };
      }
      case 'clock': {
        final d = DateTime.now();
        return switch (P('part')) { 'minute' => d.minute, 'second' => d.second, 'weekday (0 = Sun)' => d.weekday % 7, 'day of month' => d.day, 'month' => d.month, 'year' => d.year, _ => d.hour };
      }
      case 'keyHeld': return g.keys.any((k) => lkeyName(k) == lkeyWant(param(n, 'key')));
      case 'keyAxis': {
        bool k(List<String> names) => g.keys.any((q) => names.contains(lkeyName(q)));
        return P('axis') == 'up / down' ? (k(['arrowdown', 's']) ? 1 : 0) - (k(['arrowup', 'w']) ? 1 : 0) : (k(['arrowright', 'd']) ? 1 : 0) - (k(['arrowleft', 'a']) ? 1 : 0);
      }
      case 'dragAmount': { final d = g.dragDelta; return P('axis') == 'y' ? d.dy : P('axis') == 'distance' ? d.distance : d.dx; }
      case 'pinchAmount': {
        final ps2 = g.pointers.values.toList(), key = 'pinch:${n['id']}';
        if (ps2.length < 2) { state.remove(key); return 1; }
        final d = (ps2[0].at - ps2[1].at).distance;
        state.putIfAbsent(key, () => d == 0 ? 1.0 : d);
        return d / lnum(state[key]);
      }
      case 'deviceIs': return P('is') == 'landscape' ? g.screen.width > g.screen.height : P('is') == 'touch screen';
      case 'popupOpen': return g.panels.isNotEmpty;
      case 'safeArea': return switch (P('side')) { 'bottom' => g.safe.bottom, 'left' => g.safe.left, 'right' => g.safe.right, _ => g.safe.top };
      case 'isDarkMode': return g.vars['darkMode'] == true;
      case 'animPlaying': return '${e.data['clip'] ?? ''}'.isNotEmpty && (P('clip').isEmpty || e.data['clip'] == P('clip'));
      case 'spriteFrame': return lnum(e.data['frame']);
      default: return 0;
    }
  }

  bool _isSensor(GameObject o) => (e.body?.sensor ?? true) || (o.body?.sensor ?? true) || e.body == null || o.body == null;
  GameObject? _named(String k, GCtx ctx) => k.isEmpty || k == 'self' ? e : k == 'other' ? ctx.other : g.find(k);
  List<GameObject> _whoOf(String on, String name, GCtx ctx) => switch (on) {
        'other' => [if (ctx.other != null) ctx.other!],
        'all with tag' => g.findAll(name),
        'first with tag' => g.findAll(name).take(1).toList(),
        'object named' => [if (g.find(name) != null) g.find(name)!],
        'everything' => [...g.objects],
        _ => [e],
      };
  static List<String> _words(String s) => s.split(RegExp(r'[|\n,]')).map((x) => x.trim()).where((x) => x.isNotEmpty).toList();
  static double _noise1(double x) {
    double h(double n) { final v = math.sin(n * 127.1 + 311.7) * 43758.5453; return (v - v.floorToDouble()) * 2 - 1; }
    final i = x.floorToDouble(), f = x - i, u = f * f * (3 - 2 * f);
    return h(i) * (1 - u) + h(i + 1) * u;
  }
  static String _numText(double v, String f) {
    if (f.startsWith('ordinal')) { final n = v.round(), t = n.abs() % 100, u = n.abs() % 10; return '$n${t >= 11 && t <= 13 ? 'th' : u == 1 ? 'st' : u == 2 ? 'nd' : u == 3 ? 'rd' : 'th'}'; }
    if (f.startsWith('short')) return formatNumber(v);
    if (f.startsWith('time')) { final s = v.round().abs(); return '${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}'; }
    if (f.startsWith('percent')) return '${v.round()}%';
    if (f.startsWith('2 decimals')) return v.toStringAsFixed(2);
    if (f.startsWith('whole')) return '${v.round()}';
    final s = ltext(v), parts = s.split('.');
    final whole = parts[0].replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
    return parts.length > 1 ? '$whole.${parts[1]}' : whole;
  }

  /// Named timers (Start Timer / Timer Control nodes), shared by every script and ticked once a frame.
  Map<String, ({double t, double total, bool down, bool running})> get _timers =>
      (g.systems['namedTimers'] ??= <String, ({double t, double total, bool down, bool running})>{}) as Map<String, ({double t, double total, bool down, bool running})>;
  void _tickTimers(double dt) {
    if (g.systems['timersT'] == g.time) return;
    g.systems['timersT'] = g.time;
    final tm = _timers;
    for (final k in [...tm.keys]) {
      final t = tm[k]!;
      if (!t.running) continue;
      if (t.down) {
        final left = math.max(0.0, t.t - dt);
        tm[k] = (t: left, total: t.total, down: true, running: left > 0);
        if (g.vars[k] != left.ceil()) g.setVar(k, left.ceil());
        if (left <= 0) LogicBus.of(g).emit('timerDone', [k]);
      } else {
        tm[k] = (t: t.t + dt, total: t.total, down: false, running: true);
        g.setVar(k, (t.t + dt).floor());
      }
    }
  }
}

/// Graph nodes that only the web build can run (sign-in, cloud, purchases, online, social, web pages): they send their name and go on.
bool _graphWebOnly(String t) => t.startsWith('supa') || t.startsWith('soc') || t.startsWith('net') || t.startsWith('pf') || t.startsWith('es') || t.startsWith('cloud') ||
    const {'buyProduct', 'restorePurchases', 'exportSlot', 'importSlot', 'phoneNotify', 'phoneCancel', 'phoneAsk', 'notify', 'askPermission', 'openSettings', 'share', 'copyText', 'openLink', 'openPhoneApp',
      'playGameN', 'backToAppN', 'goToLevel', 'restartLevel', 'playMusic', 'stopMusic', 'setVolume', 'muteSound', 'playNote', 'takePhoto', 'setLight', 'fadeLight', 'lightEffect', 'setSun', 'lightingPreset',
      'appBadge', 'fullScreen', 'keepScreenOn', 'navBars', 'menuOpen', 'calibrateTilt', 'hitStop', 'gameSpeed', 'slowMo', 'setObjLayer', 'forEachInLayer', 'uiShow', 'openPopup', 'closeTop', 'uiEnable',
      'setImage', 'setBadge', 'uiTheme', 'uiOrder', 'uiSize', 'scrollTo', 'goPageWith', 'forEachRecord', 'findRecord', 'setRecordField', 'toggleField', 'updateRecords', 'deleteRecords', 'recordsToArray',
      'setDarkMode', 'showLoading', 'toggleComp', 'playAnim', 'stopAnim', 'animSpeed', 'setFrame', 'squadSelect', 'squadMove', 'squadStop', 'endTurn', 'giveItem', 'useItem', 'runMyAction', 'camLens', 'camDutch', 'camNoise'}.contains(t);

extension GraphRunExec on GraphRun {
  // ---- running nodes ----
  void run(Map? n, GCtx ctx) {
    if (n == null || ++ctx.steps > 300) return;
    final t = ty(n);
    if (n['off'] == true) { final ports = linkedPorts['${n['id']}'] ?? const <String>{}; follow(n, ports.contains('then') || ports.isEmpty ? 'then' : ports.first, ctx); return; }
    if (t.startsWith('la_')) { // a Triggers instruction as a node
      final it = <String, dynamic>{'type': t.substring(3), ...?(n['params'] as Map?)?.cast<String, dynamic>()};
      final later = ctx.fresh();
      var sync = true, doneNow = false;
      runInstructions([it], LogicCtx(g, e, other: ctx.other, eventValue: ctx.eventValue), () { if (sync) { doneNow = true; } else if (!e.dead) { follow(n, 'then', later); } });
      sync = false;
      if (doneNow) follow(n, 'then', ctx);
      return;
    }
    double I(String k) => inum(n, k, ctx);
    Object? iv(String k) => input(n, k, ctx);
    String P(String k) => ps(n, k);
    double pn2(String k) => pn(n, k);
    void tw(GameObject o, String f, double to, double secs, String curve, [VoidCallback? done]) => g.tween(o, f, to, math.max(0.01, secs), curve: curve.isEmpty ? 'outQuad' : curve, done: done);
    void finishedLater() => follow(n, 'finished', ctx.fresh());
    switch (t) {
      case 'branch': follow(n, ltruthy(iv('condition')) ? 'true' : 'false', ctx); return;
      case 'wait': { final rel = hold(ctx); g.after(math.max(0.0, I('seconds')), () { if (!e.dead) follow(n, 'then', ctx.fresh()); rel(); }); return; }
      case 'chance': follow(n, math.Random().nextDouble() * 100 < I('percent') ? 'yes' : 'no', ctx); return;
      case 'once': if (state['${n['id']}'] == true) return; state['${n['id']}'] = true;
      case 'sequence': for (final port in const ['first', 'second', 'third']) { follow(n, port, ctx); } return;
      case 'loop': { final c = I('count').floor().clamp(0, 100); seq(n, ctx, c, (i) => {'index': i}); return; }
      case 'flipFlop': { final a = state['${n['id']}'] != true; state['${n['id']}'] = a; follow(n, a ? 'A' : 'B', ctx); return; }
      case 'cooldown': {
        final last = state['${n['id']}'];
        if (last is double && g.time - last < I('seconds')) { follow(n, 'blocked', ctx); return; }
        state['${n['id']}'] = g.time; follow(n, 'then', ctx); return;
      }
      case 'countTo': {
        final c = lnum(state['${n['id']}']) + 1, need = math.max(1.0, I('times').roundToDouble());
        if (c >= need) { state['${n['id']}'] = P('after') == 'stay done' ? need : 0.0; follow(n, 'reached', ctx); return; }
        state['${n['id']}'] = c; follow(n, 'not yet', ctx); return;
      }
      case 'randomBranch': { final ports = ['1', '2', '3'].where((q) => (linkedPorts['${n['id']}'] ?? const {}).contains(q)).toList(); if (ports.isNotEmpty) follow(n, ports[math.Random().nextInt(ports.length)], ctx); return; }
      case 'switchNum': { final v = I('value').round(); follow(n, v >= 0 && v <= 3 ? '$v' : 'other', ctx); return; }
      case 'compareBranch': follow(n, lcmp(I('a'), P('op'), I('b')) ? 'yes' : 'no', ctx); return;
      case 'setPosition': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { o.x = I('x'); o.y = I('y'); o.body?..vx = 0..vy = 0; } }
      case 'moveToward': {
        final o = lnearest(g, e, P('tag')); if (o == null) break;
        final dx = o.x - e.x, dy = o.y - e.y, d = math.sqrt(dx * dx + dy * dy), step = I('speed') * ctx.dt;
        if (d <= step || d < 1e-6) { e.x = o.x; e.y = o.y; follow(n, 'arrived', ctx); break; }
        e.x += dx / d * step; e.y += dy / d * step;
      }
      case 'lookAt': { final o = lnearest(g, e, P('tag')); if (o != null) e.rz = math.atan2(o.y - e.y, o.x - e.x) / deg; }
      case 'rotateBy': e.rz += I('degrees');
      case 'setScale': { final k = I('scale'); e.sx = k; e.sy = k; }
      case 'teleport': { final o = g.find(P('object')); if (o != null && o != e) { e.x = o.x; e.y = o.y; e.body?..vx = 0..vy = 0; } }
      case 'setText' || 'showText': {
        final k = P('object'), o = k.isEmpty ? e : g.find(k);
        if (o != null) (o.text ??= {'value': '', 'size': 24, 'color': '#ffffff'})['value'] = t == 'showText' ? ltext(iv('text')) : P('text');
      }
      case 'setColor': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { if (o.shape != null) { o.shape!['fill'] = P('color'); } else { o.text?['color'] = P('color'); } } }
      case 'particles': g.burst(e.x, e.y, colorOf(P('color')) ?? const Color(0xFFFFD54F), I('count').clamp(1, 200).toInt());
      case 'spawnAt': { final k = P('at'), at = (k.isEmpty ? null : g.find(k) ?? lnearest(g, e, k)) ?? e; if (P('template').isNotEmpty) g.spawn(P('template'), at.x, at.y); }
      case 'destroyTag': for (final o in g.findAll(P('tag'))) { g.burst(o.x, o.y, Colors.white, 8); o.destroy(); }
      case 'tagOp': if (P('tag').isNotEmpty) { if (P('mode') == 'remove') { e.tags.remove(P('tag')); } else { e.tags.add(P('tag')); } }
      case 'damage': { final o = P('target') == 'self' ? e : ctx.other; final hb = o?.part<Health>(); if (o != null && hb != null) hb.damage(o, g, I('amount'), from: e); }
      case 'heal': { final o = P('target') == 'other' ? ctx.other : e; final hb = o?.part<Health>(); if (o != null && hb != null) hb.heal(o, g, I('amount')); }
      case 'setVar': g.setVar(P('name').isEmpty ? 'score' : P('name'), I('value'));
      case 'addVar': g.addVar(P('name').isEmpty ? 'score' : P('name'), I('amount'));
      case 'message': g.message(P('text'), pn2('seconds') == 0 ? 2 : pn2('seconds'));
      case 'log' || 'logValue': debugPrint('Pocket: ${t == 'log' ? g.fill(P('text')) : '${P('label').isEmpty ? 'value' : P('label')} = ${ltext(iv('value'))}'}');
      case 'sound': g.sfx(P('sound'));
      case 'spawn': if (P('template').isNotEmpty) g.spawn(P('template'), e.x, e.y);
      case 'destroy': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { g.burst(o.x, o.y, Colors.white, 12); o.destroy(); } }
      case 'moveBy': e.x += I('x'); e.y += I('y');
      case 'setVelocity': { final b = e.ensureBody('dynamic'); b.vx = I('x'); b.vy = I('y'); }
      case 'jump': { final b = e.body; if (b != null) b.vy = -I('power'); g.sfx('jump'); }
      case 'showHide': { final k = P('object'), o = k.isEmpty ? e : g.find(k); if (o != null) o.visible = P('mode') == 'show' ? true : P('mode') == 'hide' ? false : !o.visible; }
      case 'vibrate': g.buzz(true);
      case 'haptic' || 'vibratePattern': g.buzz(P('style') == 'heavy' || P('style') == 'error');
      case 'shake' || 'impulse': g.shake = math.max(g.shake, I('strength') == 0 ? 10 : I('strength'));
      case 'win': g.win(); return;
      case 'gameOver': g.gameOver(); return;
      case 'nextLevel': g.win(); return;
      case 'restart': g.start(); return;
      case 'saveGame': if (g.saveGame(pn2('slot') <= 0 ? 1 : pn2('slot').toInt()) && P('text').isNotEmpty) g.message(P('text'), 1.5);
      case 'loadGame': follow(n, g.loadGame(pn2('slot') <= 0 ? 1 : pn2('slot').toInt()) ? 'then' : 'no save', ctx); return;
      case 'deleteSave': g.deleteSave(pn2('slot') <= 0 ? 1 : pn2('slot').toInt());
      case 'push': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { final b = o.ensureBody('dynamic'); b.vx += I('x'); b.vy += I('y'); } }
      case 'setGravity': g.gravity = I('y');
      case 'switchCamera' || 'camLive': g.send('camera:${P('camera')}');
      case 'zoomCamera' || 'camZoomTo': { final z = math.max(0.05, I('zoom') == 0 ? 1.0 : I('zoom')); final cam = g.activeCamera; if (cam != null) { cam.data['camZoom'] = z; } else { g.camZoom = z; } }
      case 'tweenTo': {
        final prop = P('prop'), val = I('value'), secs = I('seconds') == 0 ? 0.5 : I('seconds'), by = P('mode') == 'by' && prop != 'scale';
        if (prop == 'scale') { tw(e, 'sx', val, secs, P('ease')); tw(e, 'sy', val, secs, P('ease'), finishedLater); }
        else { final f = prop == 'ry' ? 'rz' : prop == 'z' ? 'y' : prop; tw(e, f, by ? e.getField(f) + val : val, secs, P('ease'), finishedLater); }
      }
      case 'punch': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) lpunch(g, o, P('what'), I('amount') == 0 ? 0.3 : I('amount'), I('seconds') == 0 ? 0.4 : I('seconds')); }
      case 'killTweens': g.killTweens(e);
      case 'tweenMove': {
        final m = P('mode'), x = I('x'), y = I('y'), secs = I('seconds');
        if (m == 'from') { final tx = e.x, ty2 = e.y; e.x = x; e.y = y; tw(e, 'x', tx, secs, P('ease')); tw(e, 'y', ty2, secs, P('ease'), finishedLater); }
        else { tw(e, 'x', m == 'to' ? x : e.x + x, secs, P('ease')); tw(e, 'y', m == 'to' ? y : e.y + y, secs, P('ease'), finishedLater); }
      }
      case 'tweenToObj': { final o = g.find(P('object')) ?? lnearest(g, e, P('object')); if (o != null) { tw(e, 'x', o.x, I('seconds'), P('ease')); tw(e, 'y', o.y, I('seconds'), P('ease'), finishedLater); } }
      case 'spin': {
        final forever = P('repeat') == 'forever', secs = I('seconds'), deg2 = I('degrees');
        void go() { if (e.dead) return; tw(e, 'rz', e.rz + deg2, secs, forever ? 'linear' : P('ease'), forever ? go : finishedLater); }
        go();
      }
      case 'pulse': {
        final k = I('amount') == 0 ? 1.0 : I('amount'), secs = I('seconds'), forever = P('repeat') == 'forever', bx = e.sx, by = e.sy;
        void go() { if (e.dead) return; g.tween(e, 'sx', bx * k, math.max(0.01, secs), curve: 'inOutSine', yoyo: true); g.tween(e, 'sy', by * k, math.max(0.01, secs), curve: 'inOutSine', yoyo: true, done: forever ? go : null); }
        go();
      }
      case 'tweenVar': {
        final k = P('name').isEmpty ? 'score' : P('name'), from = g.numVar(k), to = I('to'), secs = math.max(0.01, I('seconds')), t0 = g.time;
        void tick() { final f = ((g.time - t0) / secs).clamp(0.0, 1.0); g.setVar(k, from + (to - from) * ease(P('ease').isEmpty ? 'outQuad' : P('ease'), f)); if (f < 1) { g.after(1 / 60, tick); } else { finishedLater(); } }
        tick();
      }
      case 'typeText': {
        final o = P('object').isEmpty ? e : g.find(P('object')); if (o == null) break;
        final full = g.fill(P('text')), secs = math.max(0.01, I('seconds')), t0 = g.time;
        final txt = o.text ??= {'value': '', 'size': 24, 'color': '#ffffff'};
        void tick() { final f = ((g.time - t0) / secs).clamp(0.0, 1.0); txt['value'] = full.substring(0, (full.length * f).floor()); if (f < 1) { g.after(1 / 60, tick); } else { finishedLater(); } }
        tick();
      }
      case 'fadeTo': tw(e, 'alpha', I('alpha').clamp(0, 1).toDouble(), I('seconds') == 0 ? 0.5 : I('seconds'), 'outQuad', finishedLater);
      case 'delayedCall': g.after(math.max(0.0, I('seconds')), () { if (!e.dead) follow(n, 'later', ctx.fresh()); });
      case 'popText': g.popText(g.screenOf(e), g.fill(P('text')), colorOf(P('color')) ?? const Color(0xFFFFD23D), pn2('size') == 0 ? 26 : pn2('size'));
      case 'flashScreen': lscreenFade(g, colorOf(P('color')) ?? Colors.white, 0.01, 0, math.max(0.01, I('seconds')));
      case 'randomVar': { final a = I('min').round(), b = I('max').round(); g.setVar(P('name').isEmpty ? 'roll' : P('name'), (math.min(a, b) + math.Random().nextInt((b - a).abs() + 1)).toDouble()); }
      case 'waitUntil': {
        final start = g.time, limit = pn2('timeout'), c2 = ctx.fresh(), rel = hold(ctx);
        void check() {
          if (e.dead) { rel(); return; }
          if (ltruthy(input(n, 'condition', c2))) { follow(n, 'then', c2.fresh()); rel(); }
          else if (limit > 0 && g.time - start >= limit) { rel(); }
          else { g.after(0, check); }
        }
        check(); return;
      }
      case 'randomWait': { final a = I('min'), b = I('max'), rel = hold(ctx); g.after(math.max(0.0, rand(math.min(a, b), math.max(a, b))), () { if (!e.dead) follow(n, 'then', ctx.fresh()); rel(); }); return; }
      case 'flipX': {
        final m = P('mode');
        if (e.shape?['type'] == 'emoji') { e.data['flipX'] = m == 'face right' ? true : m == 'face left' ? false : e.data['flipX'] != true; }
        else if (m == 'toggle') { e.sx = -e.sx; } else { e.sx = e.sx.abs() * (m == 'face left' ? -1 : 1); }
      }
      case 'blink': {
        final end = g.time + math.max(0.05, I('seconds')), id = lnum(e.data['_blink']) + 1;
        e.data['_blink'] = id;
        void tick() { if (e.dead || e.data['_blink'] != id) return; if (g.time >= end) { e.visible = true; return; } e.visible = !e.visible; g.after(0.1, tick); }
        tick();
      }
      case 'toggleVar': { final k = P('name').isEmpty ? 'on' : P('name'); g.setVar(k, g.numVar(k) != 0 ? 0 : 1); }
      case 'setBackground': g.background = colorOf(P('color')) ?? g.background;
      case 'setAlpha': e.alpha = I('alpha').clamp(0, 1).toDouble();
      case 'stopMoving': { final o = P('target') == 'other' ? ctx.other : e; o?.body?..vx = 0..vy = 0; }
      case 'gravityScale': e.ensureBody('dynamic').gravityScale = I('scale');
      case 'sendMessage': g.send(P('message'));
      case 'sendValue': g.send(P('message'));
      case 'addForce': {
        final o = P('target') == 'other' ? ctx.other : e; if (o == null) break;
        final b = o.ensureBody('dynamic'), k = P('mode') == 'force (every frame)' ? ctx.dt : 1.0;
        b.vx += I('x') * k; b.vy += I('y') * k;
      }
      case 'explosion': {
        final r = I('radius') > 0 ? I('radius') : 300, f = I('force') > 0 ? I('force') : 900;
        for (final q in g.objects) {
          final b = q.body;
          if (q == e || q.dead || q.ui || b == null || !b.isDynamic || !tagOk(q, P('tag'))) continue;
          final dx = q.x - e.x, dy = q.y - e.y, d = math.sqrt(dx * dx + dy * dy);
          if (d > r) continue;
          final k = f * (1 - d / r) / (d == 0 ? 1 : d);
          b.vx += dx * k; b.vy += (dy == 0 ? -0.3 * d : dy) * k;
        }
        g.shake = math.max(g.shake, math.min(20, f / 80));
      }
      case 'setBodyType': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { final b = o.ensureBody(P('type')); b.type = P('type'); if (!b.isDynamic) { b.vx = 0; b.vy = 0; } } }
      case 'setTrigger': { final o = P('target') == 'other' ? ctx.other : e; if (o != null) { final b = o.ensureBody('kinematic'); b.sensor = P('mode') == 'toggle' ? !b.sensor : P('mode') == 'trigger'; } }
      case 'physMaterial': { final b = e.ensureBody('dynamic'); b.bounce = math.max(0, I('bounce')); b.friction = math.max(0, I('friction')); }
      case 'setMyVar': setMy(e, P('name').isEmpty ? 'hp' : P('name'), I('value'));
      case 'addMyVar': { final k = P('name').isEmpty ? 'hp' : P('name'); setMy(e, k, lnum(e.data[k]) + I('amount')); }
      case 'setOtherVar': setMy(ctx.other, P('name').isEmpty ? 'hp' : P('name'), I('value'));
      case 'callEvent': {
        final on = P('on'), name = P('name'), raw = iv('value'), val = raw is num ? raw : lval(raw ?? 0), tag = P('tag'), named = on == 'object named' ? g.find(tag) : null;
        final bool Function(GameObject) whoT = on == 'other' ? (q) => q == ctx.other : on == 'all with tag' ? (q) => q.has(tag) : on == 'everything' ? (q) => true : on == 'object named' ? (q) => q == named : (q) => q == e;
        LogicBus.of(g).emit('graphCall', [name, whoT, e, val]);
      }
      case 'changeVar' || 'clampVar': {
        final k = P('name').isEmpty ? 'score' : P('name'), sc = P('scope'), w = sc == 'this object' ? e : sc == 'other' ? ctx.other : null;
        if (sc == 'other' && w == null) break;
        final cur = lnum(w != null ? w.data[k] : g.vars[k]), val = I('value');
        final double nv;
        if (t == 'clampVar') { nv = cur.clamp(math.min(I('min'), I('max')), math.max(I('min'), I('max'))).toDouble(); }
        else {
          nv = switch (P('op')) { 'set' => val, 'subtract' => cur - val, 'multiply' => cur * val, 'divide' => val == 0 ? cur : cur / val, 'min' => math.min(cur, val), 'max' => math.max(cur, val), 'power' => math.pow(cur, val).toDouble(), 'mod' => val == 0 ? cur : ((cur % val) + val) % val, _ => cur + val };
        }
        if (w != null) { setMy(w, k, nv); } else { g.setVar(k, nv); }
      }
      case 'copyVar': { final v = g.vars[P('from')]; g.setVar(P('to').isEmpty ? 'copy' : P('to'), v is List ? [...v] : v ?? 0); }
      case 'toggleMyVar': { final k = P('name').isEmpty ? 'on' : P('name'); setMy(e, k, lnum(e.data[k]) != 0 ? 0.0 : 1.0); }
      case 'resetVars': {
        final start = (g.json['vars'] as Map?) ?? const {}, names = P('names').split(',').map((q) => q.trim()).where((q) => q.isNotEmpty).toList();
        for (final k in names.isNotEmpty ? names : g.vars.keys.where((q) => !RegExp(r'^(time|best|level|net|pf|online|item_|inventory)').hasMatch(q)).toList()) {
          final s0 = start[k];
          g.setVar(k, s0 is List ? [...s0] : s0 ?? (g.vars[k] is List ? <Object?>[] : 0));
        }
      }
      case 'setTextVar': g.setVar(P('name').isEmpty ? 'text' : P('name'), g.fill(P('text'), e));
      case 'setTextTo': g.setVar(P('name').isEmpty ? 'text' : P('name'), ltext(iv('text')));
      case 'clearVars': for (final k in P('names').split(',').map((q) => q.trim()).where((q) => q.isNotEmpty)) { g.setVar(k, g.vars[k] is List ? <Object?>[] : ''); }
      case 'runFuncOn': {
        var found = false;
        final store = P('store');
        for (final o in _whoOf(P('on'), P('object'), ctx)) {
          final r = o.part<VisualScript>()?.callFn(P('name'), {'a': I('a'), 'b': I('b'), 'c': I('c')}, e, store.isEmpty ? null : (v) => g.setVar(store, v));
          if (r != null && r.$1) { found = true; if (store.isNotEmpty) g.setVar(store, r.$2); }
        }
        follow(n, found ? 'then' : 'not found', ctx); return;
      }
      case 'setObjVar': {
        final o = _named(P('object'), ctx); if (o == null) { follow(n, 'not found', ctx); return; }
        final k = P('name').isEmpty ? 'value' : P('name'), raw = iv('value'), v = raw is num ? raw : lval(raw), cur = lnum(o.data[k]);
        setMy(o, k, switch (P('op')) { 'add' => cur + lnum(v), 'subtract' => cur - lnum(v), 'multiply' => cur * lnum(v), _ => v });
      }
      case 'runTriggerN': LogicBus.of(g).emit('runTrigger', [P('name')]);
      case 'camFocus' || 'camToObject' || 'camMoveTo': {
        double x = I('x'), y = I('y');
        if (t != 'camMoveTo') { final o = g.find(P('object')) ?? lnearest(g, e, P('object')); if (o == null) break; x = o.x; y = o.y; }
        g.systems['camFollow'] = null;
        final cx = g.camX, cy = g.camY, secs = math.max(0.001, I('seconds')), t0 = g.time;
        void tick() { final f = ease('inOutCubic', ((g.time - t0) / secs).clamp(0.0, 1.0)); g.camX = cx + (x - cx) * f; g.camY = cy + (y - cy) * f; if (g.time - t0 < secs) { g.after(1 / 60, tick); } else if (!e.dead) { follow(n, t == 'camFocus' ? 'back' : 'arrived', ctx.fresh()); } }
        tick();
      }
      case 'zoomPunch': { final z = g.camZoom, a = I('amount') == 0 ? 0.12 : I('amount'), secs = math.max(0.05, I('seconds') == 0 ? 0.25 : I('seconds')), t0 = g.time; void tick() { final k = (g.time - t0) / secs; if (k >= 1) { g.camZoom = z; return; } g.camZoom = z * (1 + math.sin(math.pi * k) * a); g.after(1 / 60, tick); } tick(); }
      case 'setDarkness': g.darkness = I('darkness').clamp(0, 1).toDouble();
      case 'saveVar': { final k = P('name').isEmpty ? 'coins' : P('name'); g.prefs?.setString('pocket.var.${g.saveKey}.$k', jsonEncode(g.vars[k] ?? 0)); }
      case 'loadVar': {
        final k = P('name').isEmpty ? 'coins' : P('name'), raw = g.prefs?.getString('pocket.var.${g.saveKey}.$k');
        if (raw == null) { follow(n, 'not saved yet', ctx); return; }
        g.setVar(k, jsonDecode(raw)); follow(n, 'loaded', ctx); return;
      }
      case 'deleteSavedVar': g.prefs?.remove('pocket.var.${g.saveKey}.${P('name').isEmpty ? 'coins' : P('name')}');
      case 'listAdd' || 'arrAdd': { final a = [...lvarList(g, P('name'))], v = t == 'listAdd' ? I('value') : lval(iv('value')); if (P('where') == 'at the start') { a.insert(0, v); } else { a.add(v); } g.setVar(P('name'), a); }
      case 'listRemove': {
        final a = [...lvarList(g, P('name'))], m = P('mode'), v = I('n');
        final k = m == 'last' ? a.length - 1 : m == 'first' ? 0 : m == 'at position' ? v.round() - 1 : a.indexWhere((q) => lnum(q) == v);
        if (k < 0 || k >= a.length) { follow(n, 'nothing removed', ctx); return; }
        a.removeAt(k); g.setVar(P('name'), a);
      }
      case 'listSet': { final a = [...lvarList(g, P('name'))], k = I('position').round() - 1; if (k >= 0 && k < 1000) { while (a.length <= k) { a.add(0.0); } a[k] = I('value'); g.setVar(P('name'), a); } }
      case 'listClear': g.setVar(P('name'), <Object?>[]);
      case 'listOrder': {
        final a = [...lvarList(g, P('name'))], m = P('mode');
        if (m == 'shuffle') { a.shuffle(); } else if (m == 'reverse') { final r = a.reversed.toList(); a..clear()..addAll(r); } else { a.sort((x, y) => m == 'sort big → small' ? lnum(y).compareTo(lnum(x)) : lnum(x).compareTo(lnum(y))); }
        g.setVar(P('name'), a);
      }
      case 'listFill': { final a0 = I('from').round(), b0 = I('to').round(), st = b0 >= a0 ? 1 : -1, a = <Object?>[]; for (var k = a0; st > 0 ? k <= b0 : k >= b0; k += st) { a.add(k.toDouble()); if (a.length >= 1000) break; } g.setVar(P('name'), a); }
      case 'forEachList': { final a = lvarList(g, P('name')).take(1000).toList(); seq(n, ctx, a.length, (i) => {'index': i + 1, 'item': a[i]}); return; }
      case 'funcReturn': { final r = ctx.ret; if (r != null && !r.done) { r.v = I('value'); r.done = true; r.late?.call(); } return; }
      case 'runFunc': {
        VoidCallback? rel;
        Object sync = true;
        final store = P('store');
        callFunction(ctx, P('name'), {'a': I('a'), 'b': I('b'), 'c': I('c')}, (v, late) {
          if (store.isNotEmpty) g.setVar(store, v);
          if (late || sync != true) { if (!e.dead) follow(n, 'then', ctx.fresh()); rel?.call(); } else { sync = 'now'; }
        });
        if (sync == 'now') break;
        sync = false; rel = hold(ctx); return;
      }
      case 'callLater': {
        final name = P('name'), v = I('value'), all = P('on') == 'everything';
        g.after(math.max(0.0, I('seconds')), () { if (!e.dead || all) LogicBus.of(g).emit('graphCall', [name, all ? (GameObject q) => true : (GameObject q) => q == e, e, v]); });
      }
      case 'forRange': {
        final a = I('from'), b = I('to'), st = (I('step') == 0 ? 1.0 : I('step').abs()) * (b >= a ? 1 : -1);
        final cnt = math.min(1000, ((b - a) / st + 1e-9).floor() + 1);
        seq(n, ctx, math.max(0, cnt), (k) => {'index': a + k * st}); return;
      }
      case 'repeatEvery': {
        final secs = math.max(0.02, I('seconds') == 0 ? 0.5 : I('seconds')), times = I('times').floor(), id = P('id'), token = Object();
        repeats.putIfAbsent(id, () => {}).add(token);
        var k = 0;
        final later = ctx.fresh();
        void tick() {
          if (e.dead || !(repeats[id]?.contains(token) ?? false)) return;
          follow(n, 'each', later.fresh()..index = k);
          k++;
          if (times > 0 && k >= times) { repeats[id]?.remove(token); follow(n, 'done', later.fresh()); return; }
          g.after(secs, tick);
        }
        tick(); return;
      }
      case 'stopRepeat': { final id = P('id'); if (id.isNotEmpty) { repeats.remove(id); } else { repeats.clear(); } }
      case 'cycle': { final c = pn2('count').round().clamp(2, 4), k = lnum(state['${n['id']}']).toInt(); state['${n['id']}'] = ((k + 1) % c).toDouble(); follow(n, '${k + 1}', ctx); return; }
      case 'weighted': {
        final w = [for (final k in const ['A', 'B', 'C']) math.max(0.0, I(k))], tot = w[0] + w[1] + w[2];
        if (tot <= 0) return;
        var r = math.Random().nextDouble() * tot;
        for (final (k, port) in const ['A', 'B', 'C'].indexed) { r -= w[k]; if (r < 0) { follow(n, port, ctx); return; } }
        follow(n, 'C', ctx); return;
      }
      case 'gate': { final key = 'gate:${P('name')}'; state.putIfAbsent(key, () => param(n, 'startOpen') != false); follow(n, state[key] == true ? 'open' : 'closed', ctx); return; }
      case 'setGate': {
        final key = 'gate:${P('name')}', gn = nodes.where((q) => q['type'] == 'gate' && ps(q, 'name') == P('name')).firstOrNull;
        final cur = state.containsKey(key) ? state[key] == true : (gn == null || param(gn, 'startOpen') != false);
        state[key] = P('mode') == 'open' ? true : P('mode') == 'close' ? false : !cur;
      }
      case 'waitFrames': frameQueue.add((math.max(1, I('frames').round()), () { if (!e.dead) follow(n, 'then', ctx.fresh()); })); return;
      case 'spawnLaunch': {
        final c = g.spawn(P('template'), e.x, e.y); if (c == null) break;
        final sp = I('speed'), dir = P('dir');
        Offset? d = switch (dir) { 'up' => const Offset(0, -1), 'down' => const Offset(0, 1), 'left' => const Offset(-1, 0), 'right' => const Offset(1, 0), 'random' => () { final a = rand(0, math.pi * 2); return Offset(math.cos(a), math.sin(a)); }(), _ => null };
        if (dir == 'toward tag') { final o = lnearest(g, e, P('tag')); if (o != null) d = Offset(o.x - e.x, o.y - e.y); }
        if (dir == 'toward finger') { final f = g.pointers.values.firstOrNull?.at ?? g.taps.firstOrNull?.screen; if (f != null) { final w = g.toWorld(f); d = Offset(w.dx - e.x, w.dy - e.y); } }
        if (d == null) { final k = e.data['flipX'] == true || e.sx < 0 ? -1.0 : 1.0; d = Offset(math.cos(e.rz * deg) * k, math.sin(e.rz * deg) * k); }
        final l = d.distance == 0 ? 1 : d.distance, b = c.ensureBody('dynamic', gravityScale: 0);
        b.vx = d.dx / l * sp; b.vy = d.dy / l * sp;
        c.rz = math.atan2(d.dy, d.dx) / deg;
        follow(n, 'then', ctx.clone()..other = c); return;
      }
      case 'moveToFinger': {
        final f = g.pointers.values.where((q) => q.role == 'free').firstOrNull?.at ?? g.taps.firstOrNull?.screen; if (f == null) break;
        final w = g.toWorld(f), sp = I('speed');
        if (sp == 0) { e.x = w.dx; e.y = w.dy; } else { final dx = w.dx - e.x, dy = w.dy - e.y, d = math.sqrt(dx * dx + dy * dy), st = math.min(d, sp * ctx.dt); if (d > 0) { e.x += dx / d * st; e.y += dy / d * st; } }
      }
      case 'lookAtFinger': { final f = g.pointers.values.firstOrNull?.at ?? g.taps.firstOrNull?.screen; if (f != null) { final w = g.toWorld(f); e.rz = math.atan2(w.dy - e.y, w.dx - e.x) / deg; } }
      case 'celebrate': g.send('celebrate'); g.burst(e.x, e.y, const Color(0xFFFFD23D), 40, 1.4);
      case 'pauseGame': g.paused = P('mode') == 'pause' ? true : P('mode') == 'resume' ? false : !g.paused;
      case 'addScore': { final a = I('amount'); g.addVar('score', a); if (param(n, 'pop') != false && a != 0) g.popText(g.screenOf(e), '${a > 0 ? '+' : ''}${formatNumber(a)}', const Color(0xFFFFD23D), 26); }
      case 'loseLife': {
        final left = math.max(0.0, g.numVar('lives') - 1); g.setVar('lives', left); g.buzz(true);
        if (left <= 0) { follow(n, 'no lives left', ctx); if (param(n, 'end') != false) g.gameOver(); return; }
      }
      case 'gainLife': { final mx = pn2('max'), v = g.numVar('lives') + (I('amount') == 0 ? 1 : I('amount')); g.setVar('lives', mx > 0 ? math.min(mx, v) : v); }
      case 'checkBest': {
        final sc = g.numVar('score').floorToDouble(), best = g.numVar('best');
        if (sc > best) { g.setVar('best', sc); g.prefs?.setDouble('pocket.best.${g.saveKey}', sc); g.newBest = true; follow(n, 'new best', ctx); return; }
        follow(n, 'not', ctx); return;
      }
      case 'addTime': g.setVar('time', math.max(0.0, (P('mode') == 'set' ? 0 : g.numVar('time')) + I('seconds')));
      case 'setCheckpoint': { final pl = g.findAll('player').firstOrNull; if (pl != null) { final at = P('at') == 'this object' ? e : pl; pl.data['respawn'] = Offset(at.x, at.y); pl.data['respawnOnHit'] = true; } }
      case 'respawn': { final pl = g.findAll('player').firstOrNull; if (pl != null) g.hurt(pl, 'respawn'); }
      case 'combo': {
        final w = math.max(0.1, pn2('window') == 0 ? 1.5 : pn2('window')), now = g.time, last = g.systems['comboT'];
        g.setVar('combo', (last is double && now - last <= w ? g.numVar('combo') : 0) + 1);
        g.systems['comboT'] = now;
        g.after(w + 0.01, () { if (g.systems['comboT'] == now) g.setVar('combo', 0); });
      }
      case 'unlock': {
        final nm = P('name').isEmpty ? 'Achievement' : P('name'), key = 'pocket.ach.${g.saveKey}.$nm';
        if (g.prefs?.getString(key) == '1') { follow(n, 'already', ctx); return; }
        g.prefs?.setString(key, '1'); g.setVar('ach_${nm.replaceAll(RegExp(r'\W+'), '_')}', 1);
        if (param(n, 'show') != false) { g.message('🏆 $nm', 2); g.sfx('win'); }
        follow(n, 'first time', ctx); return;
      }
      case 'whileLoop' || 'repeatUntil': {
        final max = pn2('max').round().clamp(1, 10000), until = t == 'repeatUntil';
        seq(n, ctx, max, (i) { final c = ltruthy(input(n, until ? 'stop when' : 'condition', ctx)); return (until ? c : !c) ? null : {'index': i}; }); return;
      }
      case 'breakLoop': ctx.loop?.stop = true; return;
      case 'continueLoop': return;
      case 'switchText': { final s = ltext(iv('text')).trim().toLowerCase(), cs = P('cases').split(',').map((x) => x.trim().toLowerCase()).take(5).toList(), k = cs.indexOf(s); follow(n, k >= 0 ? 'case ${k + 1}' : 'other', ctx); return; }
      case 'arrInsert': { final a = [...lvarList(g, P('name'))], k = (I('position').round() - 1).clamp(0, a.length); a.insert(k, lval(iv('value'))); g.setVar(P('name'), a); }
      case 'arrSplit': { final sep = param(n, 'sep') == null ? ',' : ltext(param(n, 'sep')); g.setVar(P('name'), ltext(iv('text')).split(sep).map((x) => x.trim()).where((x) => x.isNotEmpty).map(lval).toList()); }
      case 'arrSlice': { final a = lvarList(g, P('name')), f = math.max(1, I('from').round()), to = iv('to position') == null ? a.length : I('to position').round(); g.setVar(P('to').isEmpty ? 'part' : P('to'), a.sublist(math.min(a.length, f - 1), math.min(a.length, math.max(f - 1, to)))); }
      case 'arrConcat': g.setVar(P('to').isEmpty ? 'all' : P('to'), [...lvarList(g, P('a')), ...lvarList(g, P('b'))]);
      case 'arrUnique': { final out = <Object?>[]; for (final v in lvarList(g, P('name'))) { if (!out.any((q) => lsame(q, v))) out.add(v); } g.setVar(P('name'), out); }
      case 'arrFilter': {
        final v = lval(iv('value')), op = P('op');
        bool test(Object? x) { final a = double.tryParse(ltext(x)), b = double.tryParse(ltext(v)), numeric = a != null && b != null;
          return switch (op) { '=' => lsame(x, v), '≠' => !lsame(x, v), '>' => numeric && a > b, '<' => numeric && a < b, '≥' => numeric && a >= b, '≤' => numeric && a <= b, 'contains' => ltext(x).toLowerCase().contains(ltext(v).toLowerCase()), _ => true }; }
        g.setVar(P('to').isEmpty ? P('name') : P('to'), lvarList(g, P('name')).where(test).toList());
      }
      case 'arrMap': {
        final v = iv('value'), op = P('op');
        Object? f(Object? x) => switch (op) { 'add' => lnum(x) + lnum(v), 'multiply' => lnum(x) * lnum(v), 'round' => lnum(x).roundToDouble(), 'abs' => lnum(x).abs(), 'UPPER' => ltext(x).toUpperCase(), 'lower' => ltext(x).toLowerCase(), _ => x };
        g.setVar(P('name'), lvarList(g, P('name')).map(f).toList());
      }
      case 'arrSwap': { final a = [...lvarList(g, P('name'))], i = I('a').round() - 1, j = I('b').round() - 1; if (i >= 0 && j >= 0 && i < a.length && j < a.length) { final tmp = a[i]; a[i] = a[j]; a[j] = tmp; g.setVar(P('name'), a); } }
      case 'mapSet': { final m = {...lvarMap(g, P('name'))}; m[ltext(iv('key'))] = lval(iv('value')); g.setVar(P('name'), m); }
      case 'mapAdd': { final m = {...lvarMap(g, P('name'))}, k = ltext(iv('key')); m[k] = lnum(m[k]) + I('amount'); g.setVar(P('name'), m); }
      case 'mapRemove': { final m = {...lvarMap(g, P('name'))}; m.remove(ltext(iv('key'))); g.setVar(P('name'), m); }
      case 'mapClear': g.setVar(P('name'), <String, Object?>{});
      case 'mapKeys': g.setVar(P('to').isEmpty ? 'keys' : P('to'), lvarMap(g, P('name')).keys.toList());
      case 'mapForEach': { final m = lvarMap(g, P('name')).entries.take(1000).toList(); seq(n, ctx, m.length, (i) => {'index': i + 1, 'key': m[i].key, 'item': m[i].value}); return; }
      case 'waitEvent': {
        final later = ctx.fresh(), name = P('message'), to = pn2('timeout');
        var done = false;
        g.on((m) { if (done || e.dead || m != name) return; done = true; follow(n, 'then', later.fresh()); });
        if (to > 0) g.after(to, () { if (!done && !e.dead) { done = true; follow(n, 'timed out', later.fresh()); } });
        return;
      }
      case 'setDelegate': g.setVar(P('var'), P('func'));
      case 'callDelegate': {
        final f = ltext(g.vars[P('var')]);
        if (f.isEmpty) { follow(n, 'empty', ctx); return; }
        final v = callFunction(ctx, f, {'a': I('a'), 'b': I('b'), 'c': I('c')});
        if (P('store').isNotEmpty) g.setVar(P('store'), v);
      }
      case 'bindMessage': { final key = '${P('message')}|${P('func')}'; if (P('mode') == 'stop listening') { bindings.remove(key); } else { bindings[key] = (message: P('message'), func: P('func')); } }
      case 'everyNth': { final c = lnum(state['${n['id']}']) + 1; state['${n['id']}'] = c; follow(n, c % math.max(1, pn2('n').round()) == 0 ? 'then' : 'skip', ctx); return; }
      case 'firstTimeEver': {
        final key = 'pocket.first.${g.saveKey}.${P('key').isEmpty ? 'x' : P('key')}', seen = g.prefs?.getString(key) != null;
        if (!seen) g.prefs?.setString(key, '1');
        follow(n, seen ? 'seen before' : 'first time', ctx); return;
      }
      case 'timerStart': {
        final k = P('name').isEmpty ? 'timer' : P('name'), secs = math.max(0.0, I('seconds')), down = P('mode') != 'count up (stopwatch)';
        _timers[k] = (t: down ? secs : 0, total: secs, down: down, running: true);
        g.setVar(k, down ? secs.ceil() : 0);
      }
      case 'timerControl': {
        final k = P('name').isEmpty ? 'timer' : P('name'), tm = _timers[k]; if (tm == null) break;
        switch (P('do')) {
          case 'pause': _timers[k] = (t: tm.t, total: tm.total, down: tm.down, running: false);
          case 'resume': _timers[k] = (t: tm.t, total: tm.total, down: tm.down, running: tm.down ? tm.t > 0 : true);
          case 'stop': _timers.remove(k); g.setVar(k, 0);
          default: { final nt = math.max(0.0, tm.t + I('seconds')); _timers[k] = (t: nt, total: tm.down ? math.max(tm.total, nt) : tm.total, down: tm.down, running: tm.running); if (tm.down) g.setVar(k, nt.ceil()); }
        }
      }
      case 'dailyCheck': {
        final key = 'pocket.daily.${g.saveKey}.${P('key').isEmpty ? 'daily' : P('key')}', sv = P('streak').isEmpty ? 'streak' : P('streak');
        String day(DateTime d) => '${d.year}-${d.month}-${d.day}';
        final today = day(DateTime.now()), yest = day(DateTime.now().subtract(const Duration(days: 1)));
        final rec = (() { try { return (jsonDecode(g.prefs?.getString(key) ?? '{}') as Map).cast<String, dynamic>(); } catch (_) { return <String, dynamic>{}; } })();
        if (rec['day'] == today) { g.setVar(sv, rec['streak'] ?? 1); follow(n, 'same day', ctx); return; }
        final streak = rec['day'] == yest ? lnum(rec['streak']) + 1 : 1.0;
        g.prefs?.setString(key, jsonEncode({'day': today, 'streak': streak}));
        g.setVar(sv, streak); follow(n, 'new day', ctx); return;
      }
      case 'stampTime': g.prefs?.setString('pocket.time.${g.saveKey}.${P('key').isEmpty ? 'lastPlayed' : P('key')}', '${DateTime.now().millisecondsSinceEpoch}');
      case 'chase' || 'flee' || 'keepDistance': {
        final o = lnearest(g, e, P('tag')); if (o == null) break;
        final sp = (I('speed') == 0 ? 140 : I('speed')) * ctx.dt, dx = o.x - e.x, dy = o.y - e.y, d = math.max(1e-6, math.sqrt(dx * dx + dy * dy));
        var dir = 0;
        if (t == 'chase') { final stop = I('stopAt') == 0 ? 36 : I('stopAt'); if (d <= stop) { follow(n, 'caught', ctx); break; } dir = 1; }
        else if (t == 'flee') { final safe = I('safeDistance') == 0 ? 260 : I('safeDistance'); if (d >= safe) { follow(n, 'safe', ctx); break; } dir = -1; }
        else { final want = I('distance') == 0 ? 150 : I('distance'); dir = (d - want).abs() < 3 ? 0 : d > want ? 1 : -1; }
        final step = math.min(sp, t == 'chase' ? d : double.infinity);
        e.x += dx / d * step * dir; e.y += dy / d * step * dir;
      }
      case 'wander': {
        final sp = (I('speed') == 0 ? 60 : I('speed')) * ctx.dt, r = I('radius') == 0 ? 150 : I('radius');
        final home = state.putIfAbsent('home:${n['id']}', () => Offset(e.x, e.y)) as Offset;
        Offset pick() { final a = rand(0, math.pi * 2), rr = math.sqrt(_rng.nextDouble()) * r; return home + Offset(math.cos(a) * rr, math.sin(a) * rr); }
        final goal = state.putIfAbsent('goal:${n['id']}', pick) as Offset;
        final dx = goal.dx - e.x, dy = goal.dy - e.y, d = math.sqrt(dx * dx + dy * dy);
        if (d <= sp) { e.x = goal.dx; e.y = goal.dy; state['goal:${n['id']}'] = pick(); } else { e.x += dx / d * sp; e.y += dy / d * sp; }
      }
      case 'orbit': {
        final o = lnearest(g, e, P('tag')); if (o == null) break;
        final r = I('radius') == 0 ? 100 : I('radius');
        var a = state['ang:${n['id']}'] as double? ?? math.atan2(e.y - o.y, e.x - o.x);
        a += I('degreesPerSecond') * deg * ctx.dt; state['ang:${n['id']}'] = a;
        e.x = o.x + math.cos(a) * r; e.y = o.y + math.sin(a) * r;
      }
      case 'patrol': {
        final vert = P('axis') == 'up / down', f = vert ? 'y' : 'x', dd = I('distance') == 0 ? 140 : I('distance'), sp = (I('speed') == 0 ? 80 : I('speed')) * ctx.dt;
        final o = state.putIfAbsent('o:${n['id']}', () => e.getField(f)) as double;
        var dir = lnum(state['d:${n['id']}'] ?? 1.0);
        e.setField(f, e.getField(f) + sp * dir);
        if ((dir > 0 && e.getField(f) >= o + dd) || (dir < 0 && e.getField(f) <= o)) { e.setField(f, dir > 0 ? o + dd : o); dir = -dir; state['d:${n['id']}'] = dir; follow(n, 'turned', ctx); }
      }
      case 'toast': g.message(g.fill(P('text'), e), math.max(0.3, I('seconds') == 0 ? 2 : I('seconds')));
      case 'alert' || 'confirm': { g.message('${g.fill(P('title'), e)}${P('text').isEmpty ? '' : ' — ${g.fill(P('text'), e)}'}', 2.5); follow(n, t == 'alert' ? 'closed' : 'yes', ctx.fresh()); return; }
      case 'askText': follow(n, 'cancelled', ctx); return;
      case 'raycast': {
        final h = ray(n, ctx);
        if (h != null) { final c = ctx.clone()..hit = (dist: h.dist, point: h.point, normal: h.normal); if (h.o != null) c.other = h.o; follow(n, 'hit', c); } else { follow(n, 'miss', ctx); }
        return;
      }
      case 'overlap' || 'forEachTag': {
        final r = t == 'overlap' ? (I('radius') > 0 ? I('radius') : 150) : double.infinity, tag = P('tag');
        final list = g.objects.where((q) => q != e && !q.dead && !q.ui && (t == 'overlap' ? tagOk(q, tag) : tag.isNotEmpty && q.has(tag)) && ldist(q, e) <= r).toList()..sort((a, b) => ldist(a, e).compareTo(ldist(b, e)));
        final l = list.take(100).toList();
        seq(n, ctx, l.length, (i) => {'other': l[i], 'index': i}, t == 'forEachTag' ? null : () { if (l.isNotEmpty) { follow(n, 'found', ctx.clone()..other = l.first); } else { follow(n, 'none', ctx); } });
        return;
      }
      case 'pickNearest': { final o = lnearest(g, e, P('tag')), mx = I('maxDistance') > 0 ? I('maxDistance') : double.infinity; if (o != null && ldist(o, e) <= mx) { follow(n, 'found', ctx.clone()..other = o); } else { follow(n, 'none', ctx); } return; }
      case 'pickObject': { final k = P('object'), o = g.find(k) ?? lnearest(g, e, k); if (o != null) { follow(n, 'found', ctx.clone()..other = o); } else { follow(n, 'none', ctx); } return; }
      case 'lineOfSight': { final o = lnearest(g, e, P('tag')); if (o != null && g.canSee(e, o) && (pn2('range') <= 0 || ldist(o, e) <= pn2('range'))) { follow(n, 'visible', ctx.clone()..other = o); } else { follow(n, 'blocked', ctx.clone()..other = o ?? ctx.other); } return; }
      case 'goToPage': g.setVar(P('var').isEmpty ? 'page' : P('var'), P('page'));
      case 'goBack': follow(n, 'nowhere to go', ctx); return;
      default:
        if (_graphWebOnly(t)) g.send(t);
    }
    follow(n, 'then', ctx);
  }

  // ---- events ----
  void fire(String type, {bool Function(Map n)? filter, GameObject? other, double dt = 1 / 60, Object? eventValue, double impact = 0}) {
    if (e.dead && type != 'destroyed') return;
    for (final n in [...nodes]) {
      if (n['type'] == type && n['off'] != true && (filter == null || filter(n))) follow(n, 'then', GCtx(other: other, dt: dt, eventValue: eventValue, impact: impact));
    }
  }
  Map<String, dynamic> leEvent(Map n) => <String, dynamic>{'type': ty(n).substring(3), ...?(n['params'] as Map?)?.cast<String, dynamic>()};
  bool _edge(Map n, String key, Object? now) { final k = '${n['id']}:$key', was = state[k]; state[k] = now; return was == true; }
  Object? _was(Map n, String key, Object? now) { final k = '${n['id']}:$key', was = state[k]; state[k] = now; return was; }

  void startGraph(GameObject e, PocketGame g) {
    this.e = e; this.g = g;
    leNodes = nodes.where((n) => ty(n).startsWith('le_') && n['off'] != true).toList();
    final touchEvents = has(['touch', 'touchEnd', 'triggerEnter', 'triggerExit', 'triggerStay', 'collisionEnter', 'collisionExit', 'collisionStay']);
    if (leNodes.isNotEmpty) lw = LogicWatcher(e, g, contacts: _usesTouch(leNodes.map(leEvent)));
    if (has(['tap', 'onDoubleTap', 'onLongPress', 'onDragThis', 'le_tap', 'le_doubleTap', 'le_longPress']) && e.ui) g.tapTargets.add(e);
    if (touchEvents && e.body == null && has(['collisionEnter', 'collisionExit', 'collisionStay'])) e.ensureBody('kinematic');
    _vars = {for (final kv in g.vars.entries) kv.key: ltext(kv.value)};
    _alive = {for (final o in g.objects) o.uid};
    for (final n in nodesOf('onVarReaches')) { state['${n['id']}:vr'] = lcmp(g.numVar(ps(n, 'name')), ps(n, 'op'), pn(n, 'value')); }
    for (final n in nodesOf('whenMyVarReaches')) { state['${n['id']}:mr'] = lcmp(lnum(e.data[ps(n, 'name')]), ps(n, 'op'), pn(n, 'value')); }
    for (final n in nodesOf('onFellFar')) { state['${n['id']}:y0'] = e.y; }
    g.on((m) {
      if (e.dead) return;
      fire('onMessage', filter: (n) => ps(n, 'message') == m);
      fire('onAnyMessage', eventValue: m);
      if (m == 'won') { fire('onWin'); for (final n in nodesOf('onGameState')) { follow(n, 'won', GCtx()); } }
      if (m == 'game over') { fire('onGameOver'); for (final n in nodesOf('onGameState')) { follow(n, 'game over', GCtx()); } }
      for (final b in [...bindings.values]) { if (b.message == m) callFunction(GCtx(), b.func, {'a': 0, 'b': 0, 'c': 0}); }
    });
    LogicBus.of(g).subs.add((type, a) {
      if (e.dead) return;
      if (type == 'graphCall' && (a[1] as bool Function(GameObject))(e)) fire('customEvent', filter: (n) => ps(n, 'name') == ltext(a[0]), other: a[2] as GameObject?, eventValue: a[3]);
      if (type == 'runTrigger') fire('customEvent', filter: (n) => ps(n, 'name') == ltext(a[0]));
      if (type == 'state' && a[0] == e) fire('stateEntered', filter: (n) => ps(n, 'state').isEmpty || ps(n, 'state') == ltext(a[1]));
      if (type == 'animEnd' && a[0] == e) fire('animEnd', filter: (n) => ps(n, 'clip').isEmpty || ps(n, 'clip') == ltext(a[1]));
      if (type == 'timerDone') fire('onTimerDone', filter: (n) => ps(n, 'name').isEmpty || ps(n, 'name') == ltext(a[0]));
      if (type == 'myvar' && a[0] == e) {
        final k = ltext(a[1]);
        fire('onMyVarChanged', filter: (n) => ps(n, 'name').isEmpty || ps(n, 'name') == k);
        for (final n in nodesOf('whenMyVarReaches')) {
          if (ps(n, 'name') != k) continue;
          final on = lcmp(lnum(a[2]), ps(n, 'op'), pn(n, 'value'));
          if (on && state['${n['id']}:mr'] != true) follow(n, 'then', GCtx());
          state['${n['id']}:mr'] = on;
        }
      }
    });
    // once per app session: first time ever, new day, welcome back
    final now = DateTime.now();
    for (final n in nodesOf('onFirstPlay')) { final k = 'pocket.ev.${g.saveKey}.first'; if (g.prefs?.getString(k) == null) { g.prefs?.setString(k, '1'); g.after(0, () => follow(n, 'then', GCtx())); } }
    for (final n in nodesOf('onNewDay')) { final k = 'pocket.ev.${g.saveKey}.day', today = '${now.year}-${now.month}-${now.day}'; if (g.prefs?.getString(k) != today) { g.prefs?.setString(k, today); g.after(0, () => follow(n, 'then', GCtx())); } }
    for (final n in nodesOf('onWelcomeBack')) {
      final k = 'pocket.ev.${g.saveKey}.lastSeen', last = int.tryParse(g.prefs?.getString(k) ?? '') ?? 0, away = last == 0 ? 0.0 : (now.millisecondsSinceEpoch - last) / 3600000;
      if (last > 0 && away >= pn(n, 'hours')) g.after(0, () => follow(n, 'then', GCtx(eventValue: (away * 10).round() / 10)));
    }
    if (has(['onWelcomeBack'])) g.prefs?.setString('pocket.ev.${g.saveKey}.lastSeen', '${now.millisecondsSinceEpoch}');
    if (e.data['spawned'] == true) { for (final n in nodesOf('onSpawnedSelf')) { g.after(0, () { if (!e.dead) follow(n, 'then', GCtx()); }); } }
    fire('start');
  }

  void updateGraph(double dt) {
    final playing = g.state == 'play' && !g.paused;
    _tickTimers(dt);
    final lw = this.lw;
    if (lw != null) {
      lw.frame(dt);
      for (final n in leNodes) {
        final ev = leEvent(n);
        for (final hit in lw.matchAll(ev, '${n['id']}')) { if (playing || const ['tap', 'message', 'called'].contains(ev['type'])) follow(n, 'then', GCtx(other: hit.other, eventValue: hit.value, dt: dt)); }
      }
    }
    if (e.shown && has(['tap']) && g.tapsOn(e).isNotEmpty && (playing || e.ui)) fire('tap');
    // game state and pause (also on the title and end screens)
    if (has(['onGameState'])) {
      final st = g.state, was = _gameState;
      if (was.isNotEmpty && was != st) { final port = st == 'title' ? 'title screen' : st == 'play' ? 'playing' : null; if (port != null) { for (final n in nodesOf('onGameState')) { follow(n, port, GCtx()); } } }
      _gameState = st;
    }
    if (g.paused != _paused) { for (final n in nodesOf('onPauseChange')) { follow(n, g.paused ? 'paused' : 'resumed', GCtx()); } _paused = g.paused; }
    // variables, pages, health
    if (has(['varChanged', 'onVarReaches', 'onPage'])) {
      for (final kv in g.vars.entries) {
        final tx = ltext(kv.value);
        if (_vars[kv.key] == tx) continue;
        _vars[kv.key] = tx;
        fire('varChanged', filter: (n) => ps(n, 'name') == kv.key);
        fire('onPage', filter: (n) => (ps(n, 'var').isEmpty ? 'page' : ps(n, 'var')) == kv.key && (ps(n, 'page').isEmpty || lsame(kv.value, ps(n, 'page'))));
        for (final n in nodesOf('onVarReaches')) {
          if (ps(n, 'name') != kv.key) continue;
          final on = lcmp(lnum(kv.value), ps(n, 'op'), pn(n, 'value'));
          if (on && state['${n['id']}:vr'] != true) follow(n, 'then', GCtx());
          state['${n['id']}:vr'] = on;
        }
      }
    }
    final hp = e.data['hp'];
    if (hp is num) {
      final was = _hp;
      if (was != null && hp < was) fire('damaged', filter: (n) => ps(n, 'dtype').isEmpty || ps(n, 'dtype') == 'any' || ps(n, 'dtype') == 'normal', eventValue: ((was - hp) * 100).round() / 100);
      _hp = hp.toDouble();
    }
    final dead = e.part<Health>()?.dead ?? false;
    if (dead && !_died) fire('death');
    _died = dead;
    // objects appearing and disappearing
    if (has(['onAnySpawned', 'onAnyDestroyed'])) {
      final now = {for (final o in g.objects) if (!o.dead) o.uid};
      for (final o in g.objects) { if (!_alive.contains(o.uid) && !o.dead && o != e) { fire('onAnySpawned', filter: (n) => ps(n, 'tag').isEmpty || o.has(ps(n, 'tag')), other: o, eventValue: o.name); } }
      if (_alive.length != now.length || !_alive.every(now.contains)) {
        for (final o in g.objects.where((q) => q.dead && _alive.contains(q.uid) && q != e)) { fire('onAnyDestroyed', filter: (n) => ps(n, 'tag').isEmpty || o.has(ps(n, 'tag')), other: o, eventValue: o.name); }
      }
      _alive = now;
    }
    _pollMore(dt, playing);
    if (!playing) return;
    if (_first) { _first = false; }
    fire('update', dt: dt);
    if (g.pointers.isNotEmpty) fire('holding', dt: dt);
    if (g.ups.isNotEmpty) fire('released');
    for (var i = frameQueue.length - 1; i >= 0; i--) { final (left, fn) = frameQueue[i]; if (left <= 1) { frameQueue.removeAt(i); fn(); } else { frameQueue[i] = (left - 1, fn); } }
    if (has(['onLongPress', 'onDoubleTap']) && e.shown) {
      for (final d in g.downs) { if (g.hitsAt(e, d.at)) press[d.id] = (t: g.time, at: d.at, done: false); }
      for (final id in [...press.keys]) {
        final q = press[id]!, ptr = g.pointers[id];
        if (ptr == null || (ptr.at - q.at).distance > 14) { press.remove(id); continue; }
        for (final n in nodesOf('onLongPress')) { if (!q.done && g.time - q.t >= math.max(0.1, pn(n, 'seconds'))) { press[id] = (t: q.t, at: q.at, done: true); follow(n, 'then', GCtx()); } }
      }
      if (has(['onDoubleTap']) && g.tapsOn(e).isNotEmpty) { if (g.time - lastTapT < 0.35) { lastTapT = -9; fire('onDoubleTap'); } else { lastTapT = g.time; } }
    }
    // touches: enter / stay / exit
    if (has(['touch', 'touchEnd', 'triggerEnter', 'triggerExit', 'triggerStay', 'collisionEnter', 'collisionExit', 'collisionStay']) && !e.ui) {
      final cur = <int, GameObject>{for (final o in g.objects) if (o != e && !o.dead && !o.ui && PocketGame.overlap(e, o)) o.uid: o};
      for (final o in cur.values) {
        final sensor = _isSensor(o);
        if (!_contacts.contains(o.uid)) {
          fire('touch', filter: (n) => o.has(ps(n, 'tag')), other: o);
          if (sensor) { fire('triggerEnter', filter: (n) => tagOk(o, ps(n, 'tag')), other: o); }
          else {
            final va = e.body, vb = o.body, rv = Offset((va?.vx ?? 0) - (vb?.vx ?? 0), (va?.vy ?? 0) - (vb?.vy ?? 0)).distance;
            fire('collisionEnter', filter: (n) => tagOk(o, ps(n, 'tag')) && rv >= pn(n, 'minSpeed'), other: o, impact: rv);
          }
        } else {
          fire(sensor ? 'triggerStay' : 'collisionStay', filter: (n) => tagOk(o, ps(n, 'tag')), other: o, dt: dt);
        }
      }
      for (final uid in _contacts) {
        if (cur.containsKey(uid)) continue;
        final o = _contactObj[uid];
        if (o == null) continue;
        fire('touchEnd', filter: (n) => o.has(ps(n, 'tag')), other: o);
        fire(_isSensor(o) ? 'triggerExit' : 'collisionExit', filter: (n) => tagOk(o, ps(n, 'tag')), other: o);
      }
      _contacts..clear()..addAll(cur.keys);
      _contactObj..clear()..addAll(cur);
    }
    final b = e.body;
    if (b != null && has(['landed', 'leftGround'])) {
      final gr = b.grounded;
      if (b.landed > 0 || (wasGround == false && gr)) { fire('landed', eventValue: b.landed.round()); }
      else if (wasGround == true && !gr) { fire('leftGround'); }
      wasGround = gr;
    }
    if (has(['screenEnter', 'screenExit'])) { final on = g.viewBounds.inflate(10).contains(Offset(e.x, e.y)); if (wasOn != null && on != wasOn) fire(on ? 'screenEnter' : 'screenExit'); wasOn = on; }
    for (final n in nodesOf('objectNear')) {
      final o = lnearest(g, e, ps(n, 'tag')), r = pn(n, 'range') > 0 ? pn(n, 'range') : 150, isNear = o != null && ldist(o, e) <= r;
      if (isNear != (state['${n['id']}:near'] == true)) { follow(n, isNear ? 'near' : 'left', GCtx(other: o ?? state['${n['id']}:o'] as GameObject?, dt: dt)); state['${n['id']}:near'] = isNear; if (o != null) state['${n['id']}:o'] = o; }
    }
    if (has(['isMoving'])) { final m = state['_pos'] as Offset?; if (m != null && (Offset(e.x, e.y) - m).distance > 10 * dt) state['_moved'] = g.time; state['_pos'] = Offset(e.x, e.y); }
    if (has(['onUiTap']) && g.taps.isNotEmpty) {
      for (final n in nodesOf('onUiTap')) {
        final k = ps(n, 'object'), list = k.isEmpty ? <GameObject>[] : [...g.objects.where((o) => !o.dead && (o.name == k || o.id == k || o.has(k)))];
        final hit = list.where((q) => q.shown && g.tapsOn(q).isNotEmpty).firstOrNull;
        if (hit != null) follow(n, 'then', GCtx(other: hit));
      }
    }
    for (final n in nodesOf('onKey')) {
      final want = lkeyWant(param(n, 'key')), w = ps(n, 'when');
      final ok = w == 'held' ? g.keys.any((k) => lkeyName(k) == want) : w == 'released' ? _keysUp.contains(want) : _keysDown.contains(want);
      if (ok) follow(n, 'then', GCtx(dt: dt));
    }
    if (g.downs.isNotEmpty) {
      for (final n in nodesOf('onScreenTouch')) {
        final w = ps(n, 'where'), W = g.screen.width, H = g.screen.height;
        if (g.downs.any((d) => w == 'left half' ? d.at.dx < W / 2 : w == 'right half' ? d.at.dx >= W / 2 : w == 'top half' ? d.at.dy < H / 2 : w == 'bottom half' ? d.at.dy >= H / 2 : true)) follow(n, 'then', GCtx());
      }
    }
    for (final n in nodes) {
      if (n['off'] == true) continue;
      final t = n['type'];
      if (t == 'every') {
        final tt = (timers['${n['id']}'] ?? 0) + dt;
        if (tt >= math.max(0.05, pn(n, 'seconds') == 0 ? 1 : pn(n, 'seconds'))) { timers['${n['id']}'] = 0; follow(n, 'then', GCtx(dt: dt)); } else { timers['${n['id']}'] = tt; }
      } else if (t == 'button' && g.pressed.contains(ps(n, 'button') == 'fire' ? 'action' : 'jump')) { follow(n, 'then', GCtx()); }
      else if (t == 'swipe' && g.pressed.contains('swipe:${ps(n, 'dir')}')) { follow(n, 'then', GCtx()); }
    }
  }

  Set<String> get _keysDown => (state['_kd'] as Set<String>?) ?? const {};
  Set<String> get _keysUp => (state['_ku'] as Set<String>?) ?? const {};

  /// Per-frame checks for the "more events" family (finger, drag, keys, joystick, idle, movement, sight, health…).
  void _pollMore(double dt, bool playing) {
    final names = {for (final k in g.keys) lkeyName(k)}, before = (state['_kn'] as Set<String>?) ?? <String>{};
    state['_kd'] = names.difference(before); state['_ku'] = before.difference(names); state['_kn'] = names;
    if (!playing && !e.ui) return;
    final b = e.body, speed = b == null ? 0.0 : math.sqrt(b.vx * b.vx + b.vy * b.vy);
    for (final n in nodes) {
      if (n['off'] == true) continue;
      String p(String k) => ps(n, k);
      double q(String k) => pn(n, k);
      switch (ty(n)) {
        case 'onFingerDown': for (final d in g.downs) { if (p('where') == 'anywhere' || g.hitsAt(e, d.at)) follow(n, 'then', GCtx(eventValue: '${d.at.dx.round()},${d.at.dy.round()}')); }
        case 'onDragThis': {
          final id = state['${n['id']}:drag'];
          if (id == null) { final d = g.downOn(e); if (d != null) { state['${n['id']}:drag'] = d.id; d.role = 'drag'; follow(n, 'start', GCtx()); } }
          else if (g.pointers.containsKey(id)) { final ptr = g.pointers[id]!; follow(n, 'dragging', GCtx(eventValue: (ptr.at - ptr.start).distance.round(), dt: dt)); }
          else { state.remove('${n['id']}:drag'); follow(n, 'dropped', GCtx()); }
        }
        case 'onKeyUp': if (_keysUp.contains(lkeyWant(param(n, 'key')))) follow(n, 'then', GCtx());
        case 'onAnyKey': for (final k in _keysDown) { follow(n, 'then', GCtx(eventValue: k)); }
        case 'onJoystick': { final on = g.stick != null, was = _was(n, 'stick', on); if (on && was != true) { follow(n, 'pushed', GCtx()); } else if (!on && was == true) { follow(n, 'released', GCtx()); } }
        case 'onIdle': {
          final busy = g.pointers.isNotEmpty || g.keys.isNotEmpty;
          if (busy) { state['${n['id']}:idle'] = 0.0; state.remove('${n['id']}:idf'); break; }
          final t2 = lnum(state['${n['id']}:idle']) + dt; state['${n['id']}:idle'] = t2;
          if (t2 >= (q('seconds') == 0 ? 5 : q('seconds')) && state['${n['id']}:idf'] != true) { state['${n['id']}:idf'] = true; follow(n, 'then', GCtx()); }
        }
        case 'onMovement': { final m = speed > (q('speed') == 0 ? 10 : q('speed')), was = _was(n, 'mv', m); if (was == null) break; if (m && was != true) { follow(n, 'starts moving', GCtx()); } else if (!m && was == true) { follow(n, 'stops', GCtx()); } }
        case 'onFalling': { final f = b != null && !b.grounded && b.vy > (q('speed') == 0 ? 60 : q('speed')); if (f && !_edge(n, 'fall', f)) { follow(n, 'then', GCtx()); } else { _edge(n, 'fall', f); } }
        case 'onFellFar': { final y0 = lnum(state['${n['id']}:y0'] ?? e.y), far = e.y - y0 > (q('distance') == 0 ? 800 : q('distance')); if (far && !_edge(n, 'far', far)) { follow(n, 'then', GCtx()); } else { _edge(n, 'far', far); } }
        case 'onSpeedAbove': { final f = speed > (q('speed') == 0 ? 400 : q('speed')); if (f && !_edge(n, 'spd', f)) { follow(n, 'then', GCtx(eventValue: speed.round())); } else { _edge(n, 'spd', f); } }
        case 'onObjectFar': { final o = lnearest(g, e, p('tag')), far = o == null || ldist(o, e) > (q('distance') == 0 ? 200 : q('distance')), was = _was(n, 'far', far); if (far && was == false) follow(n, 'then', GCtx(other: o)); }
        case 'onSight': { final o = lnearest(g, e, p('tag')), see = o != null && g.canSee(e, o), was = _was(n, 'see', see); if (see && was != true) { follow(n, 'sees', GCtx(other: o)); } else if (!see && was == true) { follow(n, 'loses sight', GCtx(other: o)); } }
        case 'onHealed': { final hp = e.data['hp']; if (hp is! num) break; final was = _was(n, 'hp', hp); if (was is num && hp > was) follow(n, 'then', GCtx(eventValue: hp - was)); }
        case 'onHealthLow': { final mx = lnum(e.data['hpMax']); if (mx == 0) break; final low = lnum(e.data['hp']) / mx * 100 <= (q('percent') == 0 ? 30 : q('percent')); if (low && !_edge(n, 'low', low)) { follow(n, 'then', GCtx()); } else { _edge(n, 'low', low); } }
        case 'onNoneLeft': { final cnt = g.findAll(p('tag')).length, was = _was(n, 'cnt', cnt); if (cnt == 0 && was is int && was > 0) follow(n, 'then', GCtx()); }
        case 'onShownHidden': { final vis = e.visible, was = _was(n, 'vis', vis); if (was != null && vis != was) follow(n, vis ? 'shown' : 'hidden', GCtx()); }
        case 'onTimeReaches': if (g.time >= q('seconds') && state['${n['id']}:t'] != true) { state['${n['id']}:t'] = true; follow(n, 'then', GCtx()); }
        case 'onClock': {
          final d = DateTime.now(), hm = '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}', want = p('time').trim().padLeft(5, '0'), key = '${d.year}${d.month}${d.day}$hm';
          if (hm == want && state['${n['id']}:clk'] != key) { state['${n['id']}:clk'] = key; follow(n, 'then', GCtx()); }
        }
        case 'onSpriteFrame': { final f = lnum(e.data['frame']).toInt(), was = _was(n, 'fr', f); if (f == q('frame').toInt() && was != f) follow(n, 'then', GCtx()); }
      }
    }
  }
}

/// Visual Script: node-based logic (events → actions, values, flow), made in the Node Editor. Several scripts in one component run side by side.
class VisualScript extends Component {
  VisualScript(this.p) {
    final extra = [for (final q in (p['scripts'] is List ? p['scripts'] as List : const [])) if (q is Map && q['graph'] is Map && q['off'] != true) q['graph'] as Map];
    if (p['mainOff'] != true && p['graph'] is Map) runs.add(GraphRun(p['graph'] as Map));
    for (final gr in extra) { runs.add(GraphRun(gr)); }
  }
  final Map<String, dynamic> p;
  final List<GraphRun> runs = [];
  bool _started = false;
  @override
  bool get always => true;
  @override
  void start(GameObject e, PocketGame g) { _started = true; for (final r in runs) { r.startGraph(e, g); } }
  @override
  void update(GameObject e, double dt, PocketGame g) {
    if (!_started) { // the title screen: buttons still work, without the On Start events
      _started = true;
      for (final r in runs) { r.e = e; r.g = g; r.leNodes = const []; }
    }
    for (final r in runs) { r.updateGraph(dt); }
  }
  @override
  void gone(GameObject e, PocketGame g) { if (!_started) return; for (final r in runs) { r.fire('destroyed'); } }
  bool hasFn(String name) => runs.any((r) => r.hasFunction(name));
  /// Run one of this object's script Functions: (found, value). onLate: a Function that Waits gives its value later.
  (bool, double) callFn(String name, Map<String, double> args, GameObject? from, void Function(double)? onLate) {
    for (final r in runs) {
      if (!r.hasFunction(name)) continue;
      double? now;
      final v = r.callFunction(GCtx(other: from), name, args, (x, late) { if (late) { onLate?.call(x); } else { now = x; } });
      return (true, now ?? v);
    }
    return (false, 0);
  }
}

/// Node settings' defaults (Pocket Engine's NODE_TYPES), for the node types this runtime runs.
const graphDefaults = <String, Map<String, Object>>{
  "every": {"seconds": 1},
  "touch": {"tag": "player"},
  "button": {"button": "jump"},
  "swipe": {"dir": "up"},
  "onMessage": {"message": "go"},
  "touchEnd": {"tag": "player"},
  "varChanged": {"name": "score"},
  "damaged": {"dtype": "any"},
  "stateEntered": {"state": "Idle"},
  "animEnd": {"clip": ""},
  "branch": {"condition": true},
  "wait": {"seconds": 1},
  "chance": {"percent": 50},
  "loop": {"count": 3},
  "cooldown": {"seconds": 1},
  "countTo": {"after": "start over", "times": 3},
  "switchNum": {"value": 0},
  "compareBranch": {"op": "≥", "a": 0, "b": 0},
  "setVar": {"name": "score", "value": 0},
  "addVar": {"name": "score", "amount": 1},
  "message": {"text": "Hello! Score: {score}", "seconds": 2},
  "log": {"text": "score is {score}", "level": "log"},
  "logValue": {"label": "speed", "level": "log", "value": ""},
  "sound": {"sound": "coin"},
  "spawn": {"template": ""},
  "destroy": {"target": "self"},
  "moveBy": {"x": 0, "y": 0, "z": 0},
  "setVelocity": {"x": 0, "y": 0, "z": 0},
  "jump": {"power": 600},
  "showHide": {"object": "", "mode": "toggle"},
  "shake": {"strength": 10},
  "saveGame": {"slot": 1, "text": "Game saved", "name": ""},
  "loadGame": {"slot": 1},
  "deleteSave": {"slot": 1},
  "push": {"target": "self", "x": 0, "y": -400, "z": 0},
  "setGravity": {"y": 1600, "x": 0},
  "switchCamera": {"camera": "Camera"},
  "zoomCamera": {"seconds": 0.5, "zoom": 1.5},
  "setLight": {"object": "", "mode": "toggle", "intensity": 1},
  "tweenTo": {"prop": "y", "mode": "by", "ease": "outQuad", "value": -40, "seconds": 0.5},
  "punch": {"what": "scale", "target": "self", "amount": 0.3, "seconds": 0.4},
  "killTweens": {"id": "", "mode": "stop"},
  "tweenMove": {"mode": "to", "ease": "outQuad", "id": "", "x": 200, "y": 300, "z": 0, "seconds": 0.6},
  "tweenToObj": {"object": "Goal", "ease": "outQuad", "seconds": 0.6},
  "spin": {"repeat": "once", "ease": "outQuad", "degrees": 360, "seconds": 1},
  "pulse": {"repeat": "forever", "id": "pulse", "amount": 1.15, "seconds": 0.4},
  "tweenVar": {"name": "score", "ease": "outQuad", "to": 100, "seconds": 1},
  "typeText": {"object": "", "text": "Hello there!", "scramble": false, "seconds": 1},
  "delayedCall": {"id": "", "seconds": 1},
  "playAnim": {"clip": "Bounce", "loop": "clip setting"},
  "animSpeed": {"speed": 2},
  "setFrame": {"frame": 0},
  "flipX": {"mode": "toggle"},
  "fadeTo": {"alpha": 0, "seconds": 0.5},
  "blink": {"seconds": 1},
  "sendMessage": {"message": "go"},
  "impulse": {"strength": 12},
  "toggleVar": {"name": "on"},
  "setBackground": {"color": "#20304a"},
  "setAlpha": {"alpha": 0.5},
  "stopMoving": {"target": "self"},
  "gravityScale": {"scale": 0},
  "popText": {"text": "+1", "color": "#ffd23d", "size": 26},
  "flashScreen": {"color": "#ffffff", "seconds": 0.3},
  "randomVar": {"name": "roll", "min": 1, "max": 6},
  "goToLevel": {"level": 1},
  "toggleComp": {"component": "patrol", "mode": "off", "object": ""},
  "waitUntil": {"timeout": 0, "condition": false},
  "randomWait": {"min": 0.5, "max": 2},
  "setPosition": {"target": "self", "x": 0, "y": 0, "z": 0},
  "moveToward": {"tag": "player", "speed": 120},
  "lookAt": {"tag": "player"},
  "rotateBy": {"degrees": 15},
  "setScale": {"scale": 1},
  "teleport": {"object": ""},
  "setText": {"object": "", "text": "Score: {score}"},
  "setColor": {"color": "#ff5252", "target": "self"},
  "particles": {"color": "#ffd54f", "count": 20},
  "spawnAt": {"template": "", "at": "player"},
  "destroyTag": {"tag": "enemy"},
  "tagOp": {"tag": "marked", "mode": "add"},
  "slowMo": {"speed": 0.3, "seconds": 1},
  "damage": {"target": "other", "amount": 1},
  "heal": {"target": "self", "amount": 1},
  "giveItem": {"item": "key", "count": 1},
  "number": {"value": 1},
  "getVar": {"name": "score"},
  "random": {"min": 0, "max": 10},
  "math": {"op": "+", "a": 0, "b": 0},
  "compare": {"op": "≥", "a": 0, "b": 0},
  "and": {"a": true, "b": true},
  "or": {"a": false, "b": false},
  "not": {"a": false},
  "position": {"axis": "x"},
  "distance": {"tag": "player"},
  "hasSave": {"slot": 1},
  "velocity": {"axis": "x"},
  "touching": {"tag": "player"},
  "canSee": {"tag": "player", "range": 0},
  "math1": {"op": "abs", "a": 0},
  "clamp": {"value": 0, "min": 0, "max": 10},
  "lerp": {"a": 0, "b": 10, "t": 0.5},
  "angleTo": {"tag": "player"},
  "countTag": {"tag": "enemy"},
  "exists": {"object": "Boss"},
  "healthOf": {"object": "", "what": "health"},
  "itemCount": {"item": "key"},
  "joystick": {"axis": "x"},
  "screen": {"what": "width"},
  "isTweening": {"id": ""},
  "choose": {"condition": true, "yes": 1, "no": 0},
  "wave": {"shape": "sine", "size": 1, "speed": 1},
  "remap": {"value": 0.5, "fromMin": 0, "fromMax": 1, "toMin": 0, "toMax": 100},
  "objPos": {"object": "Player", "axis": "x"},
  "touchPos": {"axis": "x"},
  "setMyVar": {"name": "hp", "value": 0},
  "addMyVar": {"name": "hp", "amount": 1},
  "getMyVar": {"name": "hp"},
  "setOtherVar": {"name": "hp", "value": 0},
  "getOtherVar": {"name": "hp"},
  "varAt": {"object": "Player", "name": "hp"},
  "onVarReaches": {"name": "score", "op": "≥", "value": 100},
  "customEvent": {"name": "explode"},
  "callEvent": {"name": "explode", "on": "this object", "tag": "enemy", "value": 0},
  "forRange": {"from": 1, "to": 5, "step": 1},
  "repeatEvery": {"id": "", "seconds": 0.5, "times": 5},
  "stopRepeat": {"id": ""},
  "cycle": {"count": 3},
  "weighted": {"A": 60, "B": 30, "C": 10},
  "gate": {"name": "door", "startOpen": true},
  "setGate": {"name": "door", "mode": "close"},
  "waitFrames": {"frames": 1},
  "onLongPress": {"seconds": 0.5},
  "spawnLaunch": {"template": "", "dir": "facing", "tag": "enemy", "speed": 500},
  "moveToFinger": {"speed": 0},
  "phoneNotify": {"title": "Come back!", "text": "Your energy is full", "when": "now", "amount": 1, "unit": "hours", "time": "19:00", "every": "day", "id": ""},
  "phoneCancel": {"id": ""},
  "notify": {"type": "default", "title": "Well done!", "text": "", "icon": "", "buttons": ""},
  "pauseGame": {"mode": "toggle"},
  "directionTo": {"tag": "player", "axis": "x"},
  "distBetween": {"a": "Player", "b": "Goal"},
  "snapTo": {"value": 0, "step": 32},
  "pingPong": {"value": 0, "length": 1},
  "sign": {"value": 0},
  "smooth": {"target": 0, "speed": 5},
  "chanceOf": {"percent": 25},
  "formula": {"expr": "a * 2 + b", "a": 0, "b": 0, "c": 0, "d": 0},
  "randomRange": {"whole": false, "min": 0, "max": 1},
  "randomPick": {"count": 4, "a": 0, "b": 0, "c": 0, "d": 0},
  "noise": {"by": "game time", "value": 0, "scale": 1},
  "invLerp": {"a": 0, "b": 100, "value": 50},
  "moveTowards": {"current": 0, "target": 10, "step": 1},
  "angleDiff": {"a": 0, "b": 90},
  "wrap": {"value": 0, "min": 0, "max": 360},
  "roundTo": {"value": 0, "decimals": 1},
  "percent": {"part": 25, "total": 100},
  "easeVal": {"ease": "outQuad", "t": 0.5},
  "vecLength": {"x": 3, "y": 4, "z": 0},
  "distPoints": {"x1": 0, "y1": 0, "x2": 3, "y2": 4},
  "anglePoints": {"x1": 0, "y1": 0, "x2": 1, "y2": 1},
  "minMax3": {"op": "max", "count": 3, "a": 0, "b": 0, "c": 0, "d": 0},
  "between": {"value": 5, "min": 0, "max": 10},
  "isEven": {"value": 2},
  "addScore": {"pop": true, "amount": 10},
  "loseLife": {"end": true},
  "gainLife": {"max": 0, "amount": 1},
  "addTime": {"mode": "add", "seconds": 5},
  "setCheckpoint": {"at": "this object"},
  "useItem": {"item": "key", "count": 1},
  "hasItem": {"item": "key", "count": 1},
  "combo": {"window": 1.5},
  "unlock": {"name": "First Win", "show": true},
  "isUnlocked": {"name": "First Win"},
  "hitStop": {"seconds": 0.08},
  "gameSpeed": {"speed": 1},
  "gameValue": {"what": "score"},
  "gameStateIs": {"state": "playing"},
  "changeVar": {"name": "score", "op": "add", "scope": "game", "value": 0},
  "clampVar": {"name": "hp", "scope": "game", "min": 0, "max": 100},
  "copyVar": {"from": "score", "to": "lastScore"},
  "toggleMyVar": {"name": "open"},
  "resetVars": {"names": "score, combo"},
  "setTextVar": {"name": "playerName", "text": "Hero {level}"},
  "textIs": {"name": "playerName", "op": "equals", "text": "Hero"},
  "saveVar": {"name": "coins"},
  "loadVar": {"name": "coins"},
  "deleteSavedVar": {"name": "coins"},
  "onMyVarChanged": {"name": "hp"},
  "whenMyVarReaches": {"name": "hp", "op": "≤", "value": 0},
  "listAdd": {"name": "list", "where": "at the end", "value": 0},
  "listRemove": {"name": "list", "mode": "last", "n": 1},
  "listSet": {"name": "list", "position": 1, "value": 0},
  "listClear": {"name": "list"},
  "listOrder": {"name": "list", "mode": "shuffle"},
  "listFill": {"name": "list", "from": 1, "to": 10},
  "forEachList": {"name": "list"},
  "listGet": {"name": "list", "position": 1},
  "listLen": {"name": "list"},
  "listHas": {"name": "list", "value": 0},
  "listFind": {"name": "list", "value": 0},
  "listRandom": {"name": "list"},
  "listStat": {"name": "list", "op": "sum"},
  "funcDef": {"name": "double"},
  "funcArg": {"which": "a"},
  "funcReturn": {"value": 0},
  "callFunc": {"name": "double", "a": 0, "b": 0, "c": 0},
  "runFunc": {"name": "double", "store": "", "a": 0, "b": 0, "c": 0},
  "callLater": {"name": "explode", "on": "this object", "seconds": 1, "value": 0},
  "callerIs": {"tag": "player"},
  "callFuncOn": {"name": "double", "on": "object named", "object": "Game Manager", "a": 0, "b": 0, "c": 0},
  "runFuncOn": {"name": "double", "on": "object named", "object": "Game Manager", "store": "", "a": 0, "b": 0, "c": 0},
  "objHasFunc": {"name": "double", "object": "Game Manager"},
  "getObjVar": {"object": "Door", "name": "open"},
  "getObjText": {"object": "Door", "name": "label"},
  "setObjVar": {"object": "Door", "name": "open", "op": "set", "value": "1"},
  "runTriggerN": {"name": "Open door"},
  "runMyAction": {"name": "Reward", "a": "", "b": "", "c": ""},
  "goToPage": {"page": "shop", "var": "page", "history": "open (Back returns)"},
  "goBack": {"var": ""},
  "onPage": {"page": "shop", "var": "page"},
  "pageIs": {"page": "home", "var": "page"},
  "triggerEnter": {"tag": ""},
  "triggerExit": {"tag": ""},
  "triggerStay": {"tag": ""},
  "collisionEnter": {"tag": "", "minSpeed": 0},
  "collisionExit": {"tag": ""},
  "collisionStay": {"tag": ""},
  "addForce": {"mode": "force (every frame)", "target": "self", "x": 0, "y": 0, "z": 0},
  "explosion": {"tag": "", "force": 0, "radius": 0},
  "setBodyType": {"type": "dynamic", "target": "self"},
  "setTrigger": {"mode": "trigger", "target": "self"},
  "physMaterial": {"bounce": 0.5, "friction": 0.2, "mass": 1},
  "inTrigger": {"tag": ""},
  "isColliding": {"tag": ""},
  "raycast": {"dir": "forward", "tag": "", "toward": "player", "triggers": false, "debug": false, "distance": 0, "dx": 1, "dy": 0, "dz": 0},
  "rayHits": {"dir": "ahead & down", "tag": "", "toward": "player", "distance": 0},
  "hitInfo": {"what": "distance"},
  "overlap": {"tag": "enemy", "radius": 0},
  "countRadius": {"tag": "enemy", "radius": 0},
  "forEachTag": {"tag": "enemy"},
  "pickNearest": {"tag": "enemy", "maxDistance": 0},
  "pickObject": {"object": "Player"},
  "lineOfSight": {"tag": "player", "range": 0},
  "objectNear": {"tag": "player", "range": 0},
  "otherInfo": {"what": "x"},
  "otherHasTag": {"tag": "enemy"},
  "animPlaying": {"clip": ""},
  "textJoin": {"sep": "", "a": "Score: ", "b": "", "c": ""},
  "textFill": {"text": "Hi {playerName}! {a} coins", "a": 0, "b": 0},
  "numText": {"format": "normal (1,234)", "value": 1234},
  "textLen": {"text": "hello"},
  "textCase": {"to": "UPPER", "text": "hello world"},
  "textReplace": {"text": "I like cats", "find": "cats", "with": "dogs"},
  "textPart": {"text": "Pocket", "start": 1, "length": 3},
  "textCheck": {"op": "starts with", "text": "Hello", "other": "he"},
  "textNum": {"text": "42"},
  "getText": {"name": "playerName"},
  "setTextTo": {"name": "playerName", "text": "Hero"},
  "showText": {"object": "", "text": "Hello"},
  "randomWord": {"words": "red | green | blue"},
  "wordAt": {"words": "Mon | Tue | Wed | Thu | Fri | Sat | Sun", "position": 1},
  "timerStart": {"name": "timer", "mode": "count down", "seconds": 30},
  "timerControl": {"name": "timer", "do": "pause", "seconds": 5},
  "timerValue": {"name": "timer", "what": "seconds"},
  "onTimerDone": {"name": "timer"},
  "clock": {"part": "hour"},
  "dailyCheck": {"key": "daily", "streak": "streak"},
  "stampTime": {"key": "lastPlayed"},
  "onKey": {"key": "Space", "when": "pressed"},
  "keyHeld": {"key": "Space"},
  "keyAxis": {"axis": "left / right"},
  "onScreenTouch": {"where": "anywhere"},
  "dragAmount": {"axis": "x"},
  "askPermission": {"kind": "location", "title": "", "why": "", "soft": true},
  "camLive": {"camera": "Camera 2", "seconds": -1, "ease": "inOutCubic"},
  "camNoise": {"camera": "Camera", "amount": 4},
  "camDutch": {"camera": "Camera", "degrees": 12},
  "camLens": {"camera": "Camera", "what": "zoom (2D)", "value": 1.5},
  "camFocus": {"object": "Chest", "zoom": 1.6, "seconds": 1.5},
  "zoomPunch": {"amount": 0.12, "seconds": 0.25},
  "takePhoto": {"then": "share", "var": "photo", "text": "Look at this!"},
  "fadeLight": {"object": "", "color": "#ffd9a0", "keepColor": true, "brightness": 1, "range": 0, "seconds": 1},
  "lightEffect": {"object": "", "effect": "pulse", "speed": 1},
  "setDarkness": {"color": "#0a0a1e", "darkness": 0.7, "seconds": 1},
  "setSun": {"color": "#ffffff", "brightness": 1, "ambient": 0.45, "seconds": 1},
  "lightingPreset": {"preset": "Night", "seconds": 2},
  "camIsLive": {"camera": "Camera"},
  "camMoveTo": {"x": 200, "y": 350, "seconds": 0.6},
  "camToObject": {"object": "Player", "seconds": 0.6},
  "camZoomTo": {"zoom": 1.5, "seconds": 0.5},
  "camValue": {"what": "x"},
  "playMusic": {"sound": "", "loop": "loop", "volume": 0.6},
  "stopMusic": {"fade": 0.5},
  "setVolume": {"volume": 1},
  "muteSound": {"mode": "toggle"},
  "playNote": {"wave": "triangle", "note": 60, "seconds": 0.25},
  "chase": {"tag": "player", "speed": 0, "stopAt": 0},
  "flee": {"tag": "player", "speed": 0, "safeDistance": 0},
  "wander": {"speed": 0, "radius": 0},
  "orbit": {"tag": "player", "radius": 0, "degreesPerSecond": 90},
  "keepDistance": {"tag": "player", "distance": 0, "speed": 0},
  "patrol": {"axis": "left / right", "distance": 0, "speed": 0},
  "share": {"text": "I scored {score}!"},
  "copyText": {"text": "{score}"},
  "openLink": {"url": "https://"},
  "deviceIs": {"is": "portrait"},
  "setObjLayer": {"target": "self", "object": "", "layer": "Enemy"},
  "forEachInLayer": {"layer": "Enemy"},
  "onUiTap": {"object": "Play Button"},
  "uiShow": {"object": "Panel", "mode": "show", "anim": "pop", "seconds": 0.25},
  "openPopup": {"object": "Popup", "mode": "open"},
  "toast": {"text": "Saved!", "where": "bottom", "color": "#1f2433", "seconds": 2},
  "alert": {"title": "Level complete!", "text": "You scored {score}.", "ok": "OK", "pause": true},
  "confirm": {"title": "Restart?", "text": "Your progress on this level will be lost.", "yes": "Yes", "no": "No", "pause": true},
  "askText": {"question": "What's your name?", "name": "playerName", "placeholder": "Hero", "max": 16},
  "uiEnable": {"object": "Shop Button", "mode": "disable"},
  "setImage": {"object": "", "image": "art:star"},
  "setBadge": {"object": "Shop Button", "color": "#ff3b30", "number": 3},
  "uiTheme": {"theme": "Neon"},
  "uiOrder": {"object": "", "mode": "to front"},
  "uiSize": {"object": "", "width": 200, "height": 60, "seconds": 0},
  "scrollTo": {"object": "Scroll View", "where": "top", "fraction": 0.5},
  "safeArea": {"side": "top"},
  "whileLoop": {"max": 1000, "condition": false},
  "repeatUntil": {"max": 1000, "stop when": false},
  "switchText": {"cases": "home, shop, map", "text": "shop"},
  "arrAdd": {"name": "items", "where": "at the end", "value": "sword"},
  "arrInsert": {"name": "items", "position": 1, "value": "shield"},
  "arrGetText": {"name": "items", "position": 1},
  "arrJoin": {"name": "items", "sep": ", "},
  "arrSplit": {"name": "items", "sep": ",", "text": "a, b, c"},
  "arrCount": {"name": "items", "value": "sword"},
  "arrSlice": {"name": "items", "to": "part", "from": 1, "to position": 3},
  "arrConcat": {"a": "items", "b": "more", "to": "all"},
  "arrUnique": {"name": "items"},
  "arrFilter": {"name": "items", "op": ">", "to": "", "value": "10"},
  "arrMap": {"name": "items", "op": "add", "value": "1"},
  "arrSwap": {"name": "items", "a": 1, "b": 2},
  "arrIndexOfMax": {"name": "items", "which": "biggest"},
  "mapSet": {"name": "stats", "key": "hp", "value": "100"},
  "mapGet": {"name": "stats", "key": "hp"},
  "mapGetNum": {"name": "stats", "key": "hp"},
  "mapAdd": {"name": "stats", "key": "xp", "amount": 1},
  "mapHas": {"name": "stats", "key": "hp"},
  "mapRemove": {"name": "stats", "key": "hp"},
  "mapClear": {"name": "stats"},
  "mapSize": {"name": "stats"},
  "mapKeys": {"name": "stats", "to": "keys"},
  "mapForEach": {"name": "stats"},
  "sendValue": {"message": "hit", "value": "10"},
  "waitEvent": {"message": "ready", "timeout": 0},
  "setDelegate": {"var": "onHit", "func": "double"},
  "callDelegate": {"var": "onHit", "store": "", "a": 0, "b": 0, "c": 0},
  "callDelegateV": {"var": "onHit", "a": 0, "b": 0, "c": 0},
  "bindMessage": {"message": "hit", "func": "double", "mode": "start listening"},
  "hasFunction": {"func": "double"},
  "onFingerDown": {"where": "on this object"},
  "onKeyUp": {"key": "space"},
  "onIdle": {"seconds": 5},
  "onMovement": {"speed": 10},
  "onFalling": {"speed": 60},
  "onFellFar": {"distance": 800},
  "onSpeedAbove": {"speed": 400},
  "onObjectFar": {"tag": "player", "distance": 200},
  "onSight": {"tag": "player"},
  "onHealthLow": {"percent": 30},
  "onAnySpawned": {"tag": ""},
  "onAnyDestroyed": {"tag": "enemy"},
  "onNoneLeft": {"tag": "enemy"},
  "onSpriteFrame": {"frame": 0},
  "buyProduct": {"product": "coins_100"},
  "exportSlot": {"slot": "1", "var": "saveCode", "copy": true},
  "importSlot": {"slot": "1", "var": "saveCode"},
  "onTimeReaches": {"seconds": 30},
  "onClock": {"time": "18:00"},
  "onWelcomeBack": {"hours": 1},
  "menuOpen": {"menu": "menu", "mode": "toggle"},
  "navBars": {"mode": "hide"},
  "haptic": {"style": "medium"},
  "vibratePattern": {"pattern": "80, 60, 80, 60, 200"},
  "appBadge": {"count": 1},
  "fullScreen": {"mode": "toggle"},
  "keepScreenOn": {"mode": "on"},
  "everyNth": {"n": 3},
  "firstTimeEver": {"key": "tutorial"},
  "le_longPress": {"seconds": 0.6},
  "playGameN": {"game": "2"},
  "curPage": {"var": "page"},
  "goPageWith": {"page": "details", "name": "selected", "var": "page", "value": ""},
  "forEachRecord": {"collection": "Tasks", "filter": "", "sort": "newest first", "max": 100},
  "findRecord": {"collection": "Tasks", "field": "title", "op": "is", "page": "", "value": "Milk"},
  "setRecordField": {"field": "done", "value": "yes"},
  "toggleField": {"field": "done"},
  "updateRecords": {"collection": "Tasks", "filter": "done = yes", "field": "archived", "value": "yes"},
  "deleteRecords": {"collection": "Tasks", "filter": "done = yes"},
  "recordsToArray": {"collection": "Tasks", "field": "title", "filter": "", "sort": "newest first", "name": "titles"},
  "clearVars": {"names": "title, amount, note"},
  "setDarkMode": {"mode": "toggle"},
  "showLoading": {"mode": "show", "text": "Loading…"},
  "openPhoneApp": {"app": "email", "to": "hello@example.com", "subject": "", "body": ""},
};
