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
  PocketGame(this.json) {
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
  final Map<String, Object?> vars = {};
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
