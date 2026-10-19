// Pocket game runtime for Flutter: plays a Pocket Engine 2D game natively, with no web view. The game itself is
// assets/game.json (exactly as Pocket Engine saved it); this file reads it and runs it with the engine's rules:
// shapes and text drawn on a Flutter canvas, the HUD, touch and keys, score, lives, best score, the title and
// game-over screens, and the components (Move, Spawner, Velocity, Hazard, Collectible, Tap Target, Shooter…).
// Made by Pocket Engine's native export; it's a readable file: change anything you like.
import 'dart:convert';
import 'dart:math' as math;

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

/// A number, or a random number in a [min, max] range (the engine's "range" settings).
double pick(Object? v, [double d = 0]) {
  if (v is List && v.length >= 2) { final a = numOf(v[0]), b = numOf(v[1]); return a + _rng.nextDouble() * (b - a); }
  if (v is List && v.isNotEmpty) return numOf(v[0], d);
  return numOf(v, d);
}

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

/// 12.7 → "12", 15300 → "15.3K" (the engine's formatNumber).
String formatNumber(double v) {
  final a = v.abs();
  if (a < 10000) return v.floor().toString();
  for (final (n, u) in const [(1e12, 'T'), (1e9, 'B'), (1e6, 'M'), (1e3, 'K')]) {
    if (a >= n) { final k = (v / n * 10).floor() / 10; return '${k == k.roundToDouble() ? k.toInt() : k}$u'; }
  }
  return v.floor().toString();
}

// ---------------------------------------------------------------------------------------------------------------
// Objects in the game
// ---------------------------------------------------------------------------------------------------------------

/// One object: where it is, how it looks (shape, text), its tags and its components.
class GameObject {
  GameObject(this.json, PocketGame game, {double? x, double? y, double? rz}) {
    name = '${json['name'] ?? ''}';
    tags = {for (final t in (json['tags'] as List? ?? const [])) '$t'};
    this.x = x ?? numOf(json['x']); this.y = y ?? numOf(json['y']);
    this.rz = rz ?? numOf(json['rz']);
    sx = numOf(json['sx'], 1); sy = numOf(json['sy'], 1);
    layer = numOf(json['layer']).toInt();
    visible = json['visible'] != false;
    ui = json['ui'] == true;
    anchor = '${json['anchor'] ?? 'top-left'}';
    shape = (json['shape'] as Map?)?.cast<String, dynamic>();
    text = (json['text'] as Map?)?.cast<String, dynamic>();
    final body = (json['body'] as Map?)?.cast<String, dynamic>();
    solid = body != null && (body['type'] == 'static' || body['type'] == 'kinematic') && body['sensor'] != true;
    home = Offset(this.x, this.y);
    for (final b in (json['behaviors'] as List? ?? const [])) {
      final p = (b as Map).cast<String, dynamic>();
      final made = makeComponent('${p['type']}', p.containsKey('params') ? (p['params'] as Map).cast<String, dynamic>() : p);
      if (made != null) { parts.add(made); } else { game.missing.add('${p['type']}'); }
    }
  }
  final Map<String, dynamic> json;
  late String name, anchor;
  late Set<String> tags;
  late double x, y, rz, sx, sy;
  late int layer;
  late bool visible, ui, solid;
  late Offset home;
  Map<String, dynamic>? shape, text;
  final List<Component> parts = [];
  final Map<String, Object?> data = {};
  bool dead = false;
  double invuln = 0;

  bool has(String tag) => tags.contains(tag);
  void destroy() => dead = true;
  T? part<T extends Component>() { for (final c in parts) { if (c is T) return c; } return null; }

  /// Half its width and height (a circle: its radius both ways), scaled.
  Size get half {
    final s = shape;
    if (s == null) { final t = text; if (t != null) { final sz = numOf(t['size'], 16); return Size('${t['value']}'.length * sz * 0.3, sz * 0.6); } return Size.zero; }
    if (s['type'] == 'circle') { final r = numOf(s['r'], numOf(s['radius'], 16)); return Size(r * sx.abs(), r * sy.abs()); }
    return Size(numOf(s['w'], 32) / 2 * sx.abs(), numOf(s['h'], 32) / 2 * sy.abs());
  }
  bool get round => shape?['type'] == 'circle';
}

/// What a component does each frame and when something touches its object.
abstract class Component {
  /// The tag it cares about touching ("player", "bullet"…), or null.
  String? get wants => null;
  void start(GameObject e, PocketGame g) {}
  void update(GameObject e, double dt, PocketGame g) {}
  void touch(GameObject e, GameObject other, PocketGame g) {}
}

// ---------------------------------------------------------------------------------------------------------------
// The game: its objects, variables, time and rules
// ---------------------------------------------------------------------------------------------------------------

class Particle { Particle(this.p, this.v, this.color, this.size); Offset p, v; final Color color; final double size; double life = 0.6; }
class Tap { Tap(this.screen, this.world); final Offset screen, world; }

class PocketGame extends ChangeNotifier {
  PocketGame(this.json) {
    final s = (json['settings'] as Map?)?.cast<String, dynamic>() ?? {};
    settings = s;
    final view = (json['view'] as Map?)?.cast<String, dynamic>() ?? {};
    viewW = numOf(view['width'], 400); viewH = numOf(view['height'], 700);
    background = colorOf(json['background']) ?? const Color(0xFF101830);
  }
  final Map<String, dynamic> json;
  late final Map<String, dynamic> settings;
  late final double viewW, viewH;
  late final Color background;
  /// title, play, over or win.
  String state = 'title';
  final Map<String, Object?> vars = {};
  List<GameObject> objects = [];
  final Map<String, Map<String, dynamic>> templates = {};
  final Set<String> missing = {};
  final List<Particle> particles = [];
  final List<(String, double)> messages = [];
  double time = 0, shake = 0;
  /// The camera: what the middle of the screen looks at, and how far in it's zoomed (a Camera component moves it).
  late double camX = viewW / 2, camY = viewH / 2, camZoom = 1;
  bool newBest = false;
  SharedPreferences? prefs;
  // input
  Size screen = Size.zero;
  final Set<LogicalKeyboardKey> keys = {};
  final List<Tap> taps = [];
  Offset? finger;
  Offset dragDelta = Offset.zero;

  String get saveKey => '${settings['saveBest'] ?? ''}'.isNotEmpty ? '${settings['saveBest']}' : '${json['name'] ?? 'game'}';
  double get zoom => (screen.isEmpty ? 1 : math.min(screen.width / viewW, screen.height / viewH)) * camZoom;
  /// How big the HUD is on this screen (the engine's "scale with screen size").
  double get uiK => screen.isEmpty ? 1 : math.exp(0.5 * math.log(screen.width / viewW) + 0.5 * math.log(screen.height / viewH)).clamp(0.6, 2.5).toDouble();
  Offset toWorld(Offset s) => Offset((s.dx - screen.width / 2) / zoom + camX, (s.dy - screen.height / 2) / zoom + camY);
  Rect get viewBounds { final hw = screen.width / 2 / zoom, hh = screen.height / 2 / zoom; return Rect.fromLTRB(camX - hw, camY - hh, camX + hw, camY + hh); }

  Future<void> load() async {
    try { prefs = await SharedPreferences.getInstance(); } catch (_) {}
    reset();
    if ('${settings['title'] ?? ''}'.isEmpty) start(); // (no title screen: straight in)
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
    templates.clear(); missing.clear(); particles.clear(); messages.clear();
    objects = [];
    for (final raw in (json['entities'] as List? ?? const [])) {
      final j = (raw as Map).cast<String, dynamic>();
      if (j['template'] == true) { templates['${j['name']}'] = j; continue; }
      objects.add(GameObject(j, this));
    }
    for (final t in templates.values) { GameObject(t, this); } // (notes their missing components too)
    time = 0; shake = 0; newBest = false;
    camX = viewW / 2; camY = viewH / 2; camZoom = 1;
  }

  void start() {
    reset();
    state = 'play';
    for (final o in [...objects]) { for (final c in o.parts) { c.start(o, this); } }
    notifyListeners();
  }

  /// A copy of a template object ("Rock", "Bullet"…) at a spot.
  GameObject? spawn(String name, double x, double y, [double rz = 0]) {
    final t = templates[name];
    if (t == null) return null;
    final o = GameObject(t, this, x: x, y: y, rz: rz == 0 ? null : rz);
    objects.add(o);
    for (final c in o.parts) { c.start(o, this); }
    return o;
  }

  double numVar(String k) => numOf(vars[k]);
  void setVar(String k, Object? v) { vars[k] = v; }
  void addVar(String k, double by) => vars[k] = numVar(k) + by;

  /// '{score} points' → '12 points' (an object's own values first: an upgrade's {cost}).
  String fill(String t, [GameObject? o]) => t.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) {
        final k = m[1]!, v = o?.data[k] ?? vars[k];
        if (v is num) return formatNumber(v.toDouble());
        return v == null ? '' : '$v';
      });

  void message(String text, [double seconds = 2]) => messages.add((text, seconds));
  void burst(double x, double y, Color color, int count, [double size = 1]) {
    for (var i = 0; i < count; i++) {
      final a = _rng.nextDouble() * math.pi * 2, sp = (60 + _rng.nextDouble() * 160) * size;
      particles.add(Particle(Offset(x, y), Offset(math.cos(a) * sp, math.sin(a) * sp), color, (2 + _rng.nextDouble() * 3) * size));
    }
  }
  void buzz([bool hard = false]) { hard ? HapticFeedback.heavyImpact() : HapticFeedback.selectionClick(); }

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
    buzz(true);
    notifyListeners();
  }

  /// The player hit something: lose a life, go back to the start, or end the game (the engine's respawnOrEnd).
  void hurt(GameObject player, String action) {
    if (action == 'respawn' || (action == 'damage' && numVar('lives') > 1)) {
      if (action == 'damage') addVar('lives', -1);
      buzz(true); shake = 10;
      burst(player.x, player.y, colorOf(player.shape?['fill']) ?? Colors.white, 14);
      if (action == 'respawn') { player.x = player.home.dx; player.y = player.home.dy; }
      player.invuln = 1.2;
      return;
    }
    if (action == 'damage') setVar('lives', 0);
    shake = 18;
    burst(player.x, player.y, colorOf(player.shape?['fill']) ?? Colors.white, 40, 1.4);
    player.visible = false; player.destroy();
    gameOver();
  }

  /// Is a point (a tap) on this object?
  bool hits(GameObject o, Tap t) {
    final p = o.ui ? uiCentre(o) : Offset(o.x, o.y), at = o.ui ? t.screen : t.world, h = o.half * (o.ui ? uiK : 1), pad = o.ui ? 4.0 : 6.0;
    if (o.round) return (at - p).distance <= h.width + pad;
    return (at.dx - p.dx).abs() <= h.width + pad && (at.dy - p.dy).abs() <= h.height + pad;
  }
  /// Where a HUD object sits on the screen: its anchor (a corner, an edge or the middle) plus its offset.
  Offset uiCentre(GameObject o) {
    final a = o.anchor, pad = MediaQueryData.fromView(WidgetsBinding.instance.platformDispatcher.views.first).padding;
    final ax = a.contains('left') ? pad.left : a.contains('right') ? screen.width - pad.right : screen.width / 2;
    final ay = a.startsWith('top') ? pad.top : a.startsWith('bottom') ? screen.height - pad.bottom : screen.height / 2;
    return Offset(ax + o.x * uiK, ay + o.y * uiK);
  }

  /// Do two objects touch? (circles and boxes; a little slack so a bounce still counts as a hit)
  static bool overlap(GameObject a, GameObject b, [double slack = 1.5]) {
    final ha = a.half, hb = b.half;
    if (a.round && b.round) return (Offset(a.x, a.y) - Offset(b.x, b.y)).distance <= ha.width + hb.width + slack;
    if (a.round || b.round) {
      final c = a.round ? a : b, r = a.round ? b : a, hr = r.half, rad = c.half.width;
      final nx = c.x.clamp(r.x - hr.width, r.x + hr.width), ny = c.y.clamp(r.y - hr.height, r.y + hr.height);
      return (Offset(c.x, c.y) - Offset(nx, ny)).distance <= rad + slack;
    }
    return (a.x - b.x).abs() <= ha.width + hb.width + slack && (a.y - b.y).abs() <= ha.height + hb.height + slack;
  }

  /// One step of the game.
  void step(double dt) {
    for (final m in [...messages]) { final i = messages.indexOf(m); messages[i] = (m.$1, m.$2 - dt); }
    messages.removeWhere((m) => m.$2 <= 0);
    for (final p in particles) { p.p += p.v * dt; p.v *= math.pow(0.05, dt).toDouble(); p.life -= dt; }
    particles.removeWhere((p) => p.life <= 0);
    shake = math.max(0, shake - dt * 40);
    if (state != 'play') { taps.clear(); dragDelta = Offset.zero; notifyListeners(); return; }
    time += dt;
    for (final o in [...objects]) {
      if (o.dead) continue;
      if (o.invuln > 0) o.invuln -= dt;
      for (final c in o.parts) { c.update(o, dt, this); }
    }
    // touches: each component that cares about a tag hears the objects with it that touch its object
    for (final o in [...objects]) {
      if (o.dead) continue;
      for (final c in o.parts) {
        final tag = c.wants;
        if (tag == null) continue;
        for (final other in [...objects]) {
          if (other == o || other.dead || o.dead || !other.has(tag) || !overlap(o, other)) continue;
          c.touch(o, other, this);
        }
      }
    }
    for (final o in objects) { o.part<Bounce>()?.collide(o, this); } // (balls bounce off solid objects: paddles, bricks, walls)
    objects.removeWhere((o) => o.dead);
    if (numOf(settings['winScore']) > 0 && numVar('score') >= numOf(settings['winScore'])) win();
    if (numOf(settings['timeLimit']) > 0 && state == 'play') {
      vars['time'] = math.max(0.0, numVar('time') - dt);
      if (numVar('time') <= 0) { message("Time's up!", 3); gameOver(); }
    }
    if (settings['saveProgress'] == true && (time * 2).floor() != ((time - dt) * 2).floor()) prefs?.setString('pocket.save.$saveKey', jsonEncode(vars));
    taps.clear(); dragDelta = Offset.zero;
    notifyListeners();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Components (the same names and settings as in Pocket Engine)
// ---------------------------------------------------------------------------------------------------------------

/// The component for a type, with its settings (and the engine's defaults); null: no native version yet.
Component? makeComponent(String type, Map<String, dynamic> p) => switch (type) {
      'move' => Move(p),
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
      _ => null,
    };

/// Move: arrow keys / WASD, and dragging on the screen (the object follows the finger's movement).
class Move extends Component {
  Move(this.p);
  final Map<String, dynamic> p;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    final speed = numOf(p['speed'], 260), axes = '${p['axes'] ?? 'all'}', control = '${p['control'] ?? 'both'}';
    var ax = 0.0, ay = 0.0;
    if (control != 'drag') {
      final k = g.keys;
      if (k.contains(LogicalKeyboardKey.arrowLeft) || k.contains(LogicalKeyboardKey.keyA)) ax -= 1;
      if (k.contains(LogicalKeyboardKey.arrowRight) || k.contains(LogicalKeyboardKey.keyD)) ax += 1;
      if (k.contains(LogicalKeyboardKey.arrowUp) || k.contains(LogicalKeyboardKey.keyW)) ay -= 1;
      if (k.contains(LogicalKeyboardKey.arrowDown) || k.contains(LogicalKeyboardKey.keyS)) ay += 1;
    }
    if (axes == 'vertical') ax = 0;
    if (axes == 'horizontal') ay = 0;
    final l = math.sqrt(ax * ax + ay * ay);
    if (l > 0) { e.x += ax / l * speed * dt; e.y += ay / l * speed * dt; }
    if (control == 'drag' || control == 'both') { // the finger's movement, a little faster (the engine's drag speed 1.2)
      final d = g.dragDelta / g.zoom * 1.2;
      e.x += axes == 'vertical' ? 0 : d.dx; e.y += axes == 'horizontal' ? 0 : d.dy;
    }
    if (p['keepInView'] != false) {
      final v = g.viewBounds, h = e.half;
      e.x = e.x.clamp(v.left + h.width, math.max(v.left + h.width, v.right - h.width)).toDouble();
      e.y = e.y.clamp(v.top + h.height, math.max(v.top + h.height, v.bottom - h.height)).toDouble();
    }
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
    if (c != null) { c.data['spawned'] = true; c.data['speedMul'] = math.min(3.0, mul); alive.add(c); }
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
  void update(GameObject e, double dt, PocketGame g) { e.x += v.dx * dt; e.y += v.dy * dt; }
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
    if (other.dead || g.state != 'play' || other.invuln > 0) return;
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
    g.buzz();
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
    for (final t in g.taps) {
      if (e.dead || !g.hits(e, t)) continue;
      final bonus = '${p['bonusVar'] ?? ''}'.isEmpty ? 0.0 : g.numVar('${p['bonusVar']}');
      g.addVar('${p['var'] ?? 'score'}', numOf(p['points'], 10) + bonus);
      g.buzz();
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
    for (final t in g.taps) {
      if (!g.hits(e, t)) continue;
      final cost = numOf(e.data['cost']), costVar = '${p['costVar'] ?? 'score'}', have = g.numVar(costVar);
      if (have < cost) { g.buzz(); g.message('Need ${formatNumber(cost - have)} more', 1); continue; }
      g.addVar(costVar, -cost);
      g.addVar('${p['addVar'] ?? 'perSecond'}', numOf(p['amount'], 1));
      e.data['owned'] = numOf(e.data['owned']) + 1;
      e.data['cost'] = (cost * numOf(p['growth'], 1.15)).ceilToDouble();
      e.data['pop'] = 0.18;
      g.buzz();
    }
  }
}

/// Shooter: fires copies of a template (automatically, or on a tap).
class Shooter extends Component {
  Shooter(this.p);
  final Map<String, dynamic> p;
  double t = 0;
  @override
  void update(GameObject e, double dt, PocketGame g) {
    t -= dt;
    if (t > 0) return;
    final trigger = '${p['trigger'] ?? 'auto'}';
    if (trigger == 'tap' && g.taps.isEmpty) return;
    if (trigger == 'action button' && !g.keys.contains(LogicalKeyboardKey.space) && g.finger == null) return;
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
    if (hp > 0) { g.buzz(); return; }
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
      if (o == e || !o.solid || !PocketGame.overlap(e, o, 0)) continue;
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

/// Camera: fixed, or following its target (follow, side scroller, top down) smoothly, with an offset and a zoom.
class CameraRig extends Component {
  CameraRig(this.p);
  final Map<String, dynamic> p;
  @override
  void start(GameObject e, PocketGame g) { g.camZoom = numOf(p['zoom'], 1).clamp(0.1, 10).toDouble(); _aim(e, g, 1); }
  @override
  void update(GameObject e, double dt, PocketGame g) => _aim(e, g, 1 - math.exp(-numOf(p['smooth'], 6) * dt));
  void _aim(GameObject e, PocketGame g, double k) {
    final mode = '${p['mode'] ?? 'follow'}';
    if (mode == 'fixed') return;
    final tag = '${p['target'] ?? 'player'}';
    GameObject? t;
    for (final o in g.objects) { if (!o.dead && (o.has(tag) || o.name == tag)) { t = o; break; } }
    if (t == null) return;
    final wantX = t.x + numOf(p['ox']), wantY = mode == 'side scroller' ? g.viewH / 2 + numOf(p['oy']) : t.y + numOf(p['oy']);
    g.camX += (wantX - g.camX) * k; g.camY += (wantY - g.camY) * k;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// On screen: the game view (drawn every frame), touch and keys, and the title / game-over cards
// ---------------------------------------------------------------------------------------------------------------

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

  @override
  Widget build(BuildContext context) {
    return Focus(
      autofocus: true,
      onKeyEvent: (_, ev) {
        if (ev is KeyDownEvent) { g.keys.add(ev.logicalKey); } else if (ev is KeyUpEvent) { g.keys.remove(ev.logicalKey); }
        if (ev is KeyDownEvent && (ev.logicalKey == LogicalKeyboardKey.enter || ev.logicalKey == LogicalKeyboardKey.space) && g.state != 'play') g.start();
        return KeyEventResult.handled;
      },
      child: LayoutBuilder(builder: (context, box) {
        g.screen = Size(box.maxWidth, box.maxHeight);
        return Listener(
          onPointerDown: (e) { g.finger = e.localPosition; if (g.state == 'play') g.taps.add(Tap(e.localPosition, g.toWorld(e.localPosition))); },
          onPointerMove: (e) { g.dragDelta += e.localPosition - (g.finger ?? e.localPosition); g.finger = e.localPosition; },
          onPointerUp: (_) => g.finger = null,
          onPointerCancel: (_) => g.finger = null,
          child: ListenableBuilder(
            listenable: g,
            builder: (context, _) => Stack(fit: StackFit.expand, children: [
              CustomPaint(painter: GamePainter(g)),
              for (final (i, m) in g.messages.indexed)
                Positioned(left: 0, right: 0, top: box.maxHeight * 0.32 + i * 44, child: Center(child: _Pill(m.$1))),
              if (g.state == 'title') _Card(title: '${g.settings['title']}', sub: '${g.settings['subtitle'] ?? ''}', button: 'Play', onTap: g.start),
              if (g.state == 'over' || g.state == 'win')
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

/// Draws the game: the background, the objects in layer order (shapes with their glow, text), particles, then the HUD.
class GamePainter extends CustomPainter {
  GamePainter(this.g);
  final PocketGame g;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = g.background);
    final z = g.zoom;
    canvas.save();
    final sh = g.shake > 0 ? Offset((_rng.nextDouble() - 0.5) * g.shake, (_rng.nextDouble() - 0.5) * g.shake) : Offset.zero;
    canvas.translate(size.width / 2 + sh.dx, size.height / 2 + sh.dy);
    canvas.scale(z);
    canvas.translate(-g.camX, -g.camY);
    final world = g.objects.where((o) => !o.ui && o.visible && !o.dead).toList()..sort((a, b) => a.layer.compareTo(b.layer));
    for (final o in world) {
      if (o.invuln > 0 && (o.invuln * 10).floor().isOdd) continue; // (blinks while it can't be hurt)
      _drawObject(canvas, o, Offset(o.x, o.y), 1);
    }
    for (final p in g.particles) { canvas.drawCircle(p.p, p.size * (p.life / 0.6).clamp(0.2, 1.0), Paint()..color = p.color.withValues(alpha: (p.life / 0.6).clamp(0.0, 1.0))); }
    canvas.restore();
    final hud = g.objects.where((o) => o.ui && o.visible && !o.dead).toList()..sort((a, b) => a.layer.compareTo(b.layer));
    for (final o in hud) { _drawObject(canvas, o, g.uiCentre(o), g.uiK); }
  }

  void _drawObject(Canvas canvas, GameObject o, Offset at, double k) {
    final pop = numOf(o.data['pop']);
    if (pop > 0) o.data['pop'] = math.max(0.0, pop - 1 / 60);
    final bump = 1 + pop * 1.2;
    canvas.save();
    canvas.translate(at.dx, at.dy);
    canvas.rotate(o.rz * math.pi / 180);
    canvas.scale(o.sx * k * bump, o.sy * k * bump);
    final s = o.shape;
    if (s != null) _drawShape(canvas, s, numOf(o.data['flash']) > 0);
    if (numOf(o.data['flash']) > 0) o.data['flash'] = numOf(o.data['flash']) - 1 / 60;
    final t = o.text;
    if (t != null && '${t['value'] ?? ''}'.isNotEmpty) {
      final align = '${t['align'] ?? 'center'}';
      final tp = TextPainter(
        text: TextSpan(text: g.fill('${t['value']}', o), style: TextStyle(color: colorOf(t['color']) ?? Colors.white, fontSize: numOf(t['size'], 16), fontWeight: FontWeight.values[((numOf(t['weight'], 800) ~/ 100) - 1).clamp(0, 8)])),
        textDirection: TextDirection.ltr, textAlign: TextAlign.center,
      )..layout();
      final dx = s == null ? (align == 'left' ? 0.0 : align == 'right' ? -tp.width : -tp.width / 2) : -tp.width / 2; // (text on a shape sits in its middle)
      tp.paint(canvas, Offset(dx, -tp.height / 2));
    }
    canvas.restore();
  }

  void _drawShape(Canvas canvas, Map<String, dynamic> s, bool flash) {
    final type = '${s['type'] ?? 'rect'}', w = numOf(s['w'], 32), h = numOf(s['h'], 32), r = numOf(s['r'], numOf(s['radius'], 16));
    final path = Path();
    switch (type) {
      case 'circle': path.addOval(Rect.fromCircle(center: Offset.zero, radius: r));
      case 'star':
        for (var i = 0; i < 10; i++) {
          final a = -math.pi / 2 + i * math.pi / 5, rr = i.isEven ? 1.0 : 0.45;
          final pt = Offset(math.cos(a) * w / 2 * rr, math.sin(a) * h / 2 * rr);
          i == 0 ? path.moveTo(pt.dx, pt.dy) : path.lineTo(pt.dx, pt.dy);
        }
        path.close();
      case 'triangle': path..moveTo(0, -h / 2)..lineTo(w / 2, h / 2)..lineTo(-w / 2, h / 2)..close();
      case 'ellipse': path.addOval(Rect.fromCenter(center: Offset.zero, width: w, height: h));
      case 'diamond': path..moveTo(0, -h / 2)..lineTo(w / 2, 0)..lineTo(0, h / 2)..lineTo(-w / 2, 0)..close();
      default: path.addRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: w, height: h), Radius.circular(numOf(s['radius']).clamp(0, math.min(w, h) / 2).toDouble())));
    }
    final fill = flash ? Colors.white : colorOf(s['fill']), stroke = colorOf(s['stroke']), glow = numOf(s['glow']);
    if (glow > 0 && (fill ?? stroke) != null) canvas.drawPath(path, Paint()..color = (fill ?? stroke)!.withValues(alpha: 0.7)..maskFilter = MaskFilter.blur(BlurStyle.normal, glow / 2));
    if (fill != null) canvas.drawPath(path, Paint()..color = fill);
    if (stroke != null) canvas.drawPath(path, Paint()..color = stroke..style = PaintingStyle.stroke..strokeWidth = numOf(s['lineWidth'], 2));
    if (s['emoji'] != null) {
      final tp = TextPainter(text: TextSpan(text: '${s['emoji']}', style: TextStyle(fontSize: math.min(w, h) * 0.8)), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(-tp.width / 2, -tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(GamePainter old) => true;
}
