// Pocket game runtime for Compose Multiplatform (Android and iOS): plays a Pocket Engine 2D game natively, with no web
// view. The game itself is GAME_JSON (GameData.kt, exactly as Pocket Engine saved it); this file reads it and runs it with
// the engine's rules: shapes and text drawn on a Compose canvas, the HUD, touch and keys, score, lives, best score, the
// title and game-over screens, and the components (Move, Spawner, Velocity, Hazard, Collectible, Tap Target, Shooter…).
// Made by Pocket Engine's native export; it's a readable file: change anything you like.
package __PACKAGE__

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import kotlin.math.*
import kotlin.random.Random

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

typealias JsonMap = Map<String, Any?>

fun numOf(v: Any?, d: Double = 0.0): Double = when (v) { is Number -> v.toDouble(); is Boolean -> if (v) 1.0 else 0.0; else -> v?.toString()?.toDoubleOrNull() ?: d }

/** A number, or a random number in a [min, max] range (the engine's "range" settings). */
fun pick(v: Any?, d: Double = 0.0): Double = when {
    v is List<*> && v.size >= 2 -> { val a = numOf(v[0]); val b = numOf(v[1]); a + Random.nextDouble() * (b - a) }
    v is List<*> && v.isNotEmpty() -> numOf(v[0], d)
    else -> numOf(v, d)
}

/** '#ff8800', '#f80', '#ff880080' or 'rgba(255,136,0,0.5)' → a colour. */
fun parseColor(v: Any?): Color? {
    val s = v?.toString()?.trim() ?: return null
    if (s.isEmpty() || s == "none" || s == "transparent") return null
    if (s.startsWith("#")) {
        var h = s.drop(1)
        if (h.length == 3) h = h.map { "$it$it" }.joinToString("")
        if (h.length == 6) return h.toLongOrNull(16)?.let { Color(0xFF000000 or it) }
        if (h.length == 8) return (h.drop(6) + h.take(6)).toLongOrNull(16)?.let { Color(it) }
        return null
    }
    val m = Regex("rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)").find(s) ?: return null
    val (r, g, b) = m.destructured
    return Color(r.toFloat().roundToInt(), g.toFloat().roundToInt(), b.toFloat().roundToInt(), ((m.groupValues[4].toFloatOrNull() ?: 1f) * 255).roundToInt().coerceIn(0, 255))
}

/** 12.7 → "12", 15300 → "15.3K" (the engine's formatNumber). */
fun formatNumber(v: Double): String {
    val a = abs(v)
    if (a < 10000) return floor(v).toLong().toString()
    for ((n, u) in listOf(1e12 to "T", 1e9 to "B", 1e6 to "M", 1e3 to "K")) {
        if (a >= n) { val k = floor(v / n * 10) / 10; return (if (k == floor(k)) k.toLong().toString() else k.toString()) + u }
    }
    return floor(v).toLong().toString()
}

private fun jsonToKotlin(e: JsonElement): Any? = when (e) {
    is JsonNull -> null
    is JsonPrimitive -> e.booleanOrNull ?: e.doubleOrNull ?: e.content
    is JsonArray -> e.map { jsonToKotlin(it) }
    is JsonObject -> e.mapValues { jsonToKotlin(it.value) }
}
@Suppress("UNCHECKED_CAST")
private fun Any?.asMap(): JsonMap? = this as? JsonMap

// ---------------------------------------------------------------------------------------------------------------
// Objects in the game
// ---------------------------------------------------------------------------------------------------------------

/** One object: where it is, how it looks (shape, text), its tags and its components. */
class GameObject(val json: JsonMap, game: PocketGame, x: Double? = null, y: Double? = null, rz: Double? = null) {
    val name = json["name"]?.toString() ?: ""
    val tags = (json["tags"] as? List<*>)?.map { it.toString() }?.toSet() ?: emptySet()
    var x = x ?: numOf(json["x"]); var y = y ?: numOf(json["y"])
    var rz = rz ?: numOf(json["rz"])
    var sx = numOf(json["sx"], 1.0); var sy = numOf(json["sy"], 1.0)
    val layer = numOf(json["layer"]).toInt()
    var visible = json["visible"] != false
    val ui = json["ui"] == true
    val anchor = json["anchor"]?.toString() ?: "top-left"
    val shape = json["shape"].asMap()
    val text = json["text"].asMap()
    val solid = json["body"].asMap()?.let { (it["type"] == "static" || it["type"] == "kinematic") && it["sensor"] != true } ?: false
    val home = Offset(this.x.toFloat(), this.y.toFloat())
    val parts = mutableListOf<Component>()
    val data = mutableMapOf<String, Any?>()
    var dead = false
    var invuln = 0.0

    init {
        for (b in (json["behaviors"] as? List<*>).orEmpty()) {
            val p = b.asMap() ?: continue
            val type = p["type"]?.toString() ?: ""
            val made = makeComponent(type, p["params"].asMap() ?: p)
            if (made != null) parts.add(made) else game.missing.add(type)
        }
    }
    fun has(tag: String) = tag in tags
    fun destroy() { dead = true }
    inline fun <reified T : Component> part(): T? = parts.firstOrNull { it is T } as? T

    /** Half its width and height (a circle: its radius both ways), scaled. */
    val half: Size get() {
        val s = shape
        if (s == null) { val t = text ?: return Size.Zero; val sz = numOf(t["size"], 16.0); return Size((t["value"].toString().length * sz * 0.3).toFloat(), (sz * 0.6).toFloat()) }
        if (s["type"] == "circle") { val r = numOf(s["r"], numOf(s["radius"], 16.0)); return Size((r * abs(sx)).toFloat(), (r * abs(sy)).toFloat()) }
        return Size((numOf(s["w"], 32.0) / 2 * abs(sx)).toFloat(), (numOf(s["h"], 32.0) / 2 * abs(sy)).toFloat())
    }
    val round get() = shape?.get("type") == "circle"
}

/** What a component does each frame and when something touches its object. */
abstract class Component(val p: JsonMap) {
    /** The tag it cares about touching ("player", "bullet"…), or null. */
    open val wants: String? get() = null
    open fun start(e: GameObject, g: PocketGame) {}
    open fun update(e: GameObject, dt: Double, g: PocketGame) {}
    open fun touch(e: GameObject, other: GameObject, g: PocketGame) {}
    fun s(k: String, d: String) = p[k]?.toString() ?: d
    fun n(k: String, d: Double) = numOf(p[k], d)
}

// ---------------------------------------------------------------------------------------------------------------
// The game: its objects, variables, time and rules
// ---------------------------------------------------------------------------------------------------------------

class Particle(var p: Offset, var v: Offset, val color: Color, val size: Float) { var life = 0.6f }
class Tap(val screen: Offset, val world: Offset)

class PocketGame(source: String) {
    @Suppress("UNCHECKED_CAST")
    val json: JsonMap = jsonToKotlin(Json.parseToJsonElement(source)) as JsonMap
    val settings: JsonMap = json["settings"].asMap() ?: emptyMap()
    val viewW = numOf(json["view"].asMap()?.get("width"), 400.0)
    val viewH = numOf(json["view"].asMap()?.get("height"), 700.0)
    val background = parseColor(json["background"]) ?: Color(0xFF101830)
    /** title, play, over or win. */
    var state by mutableStateOf("title")
    var frame by mutableStateOf(0L) // (drawing reads it, so every step redraws)
    val vars = mutableMapOf<String, Any?>()
    var objects = mutableListOf<GameObject>()
    val templates = mutableMapOf<String, JsonMap>()
    val missing = mutableSetOf<String>()
    val particles = mutableListOf<Particle>()
    val messages = mutableListOf<Pair<String, Double>>()
    var time = 0.0; var shake = 0.0
    /** The camera: what the middle of the screen looks at, and how far in it's zoomed (a Camera component moves it). */
    var camX = viewW / 2; var camY = viewH / 2; var camZoom = 1.0
    var newBest = false
    var haptic: (Boolean) -> Unit = {}
    // input
    var screen = Size.Zero
    var safeTop = 0f; var safeBottom = 0f
    val keys = mutableSetOf<Key>()
    val taps = mutableListOf<Tap>()
    var finger: Offset? = null
    var dragDelta = Offset.Zero

    val saveKey get() = settings["saveBest"]?.toString()?.takeIf { it.isNotEmpty() } ?: (json["name"]?.toString() ?: "game")
    val zoom get() = (if (screen.width <= 0f) 1.0 else min(screen.width / viewW, screen.height / viewH)) * camZoom
    /** How big the HUD is on this screen (the engine's "scale with screen size"). */
    val uiK get() = if (screen.width <= 0f) 1.0 else exp(0.5 * ln(screen.width / viewW) + 0.5 * ln(screen.height / viewH)).coerceIn(0.6, 2.5)
    fun toWorld(s: Offset) = Offset(((s.x - screen.width / 2) / zoom + camX).toFloat(), ((s.y - screen.height / 2) / zoom + camY).toFloat())
    val viewBounds: Rect get() { val hw = screen.width / 2 / zoom; val hh = screen.height / 2 / zoom; return Rect((camX - hw).toFloat(), (camY - hh).toFloat(), (camX + hw).toFloat(), (camY + hh).toFloat()) }

    init { reset(); if (settings["title"]?.toString().isNullOrEmpty()) start() } // (no title screen: straight in)

    /** Everything back to how the game starts. */
    fun reset() {
        vars.clear(); vars.putAll(json["vars"].asMap() ?: emptyMap())
        if (!settings["saveBest"]?.toString().isNullOrEmpty()) vars["best"] = Store.get("pocket.best.$saveKey")?.toDoubleOrNull() ?: 0.0
        if (numOf(settings["timeLimit"]) > 0) vars["time"] = numOf(settings["timeLimit"])
        if (settings["saveProgress"] == true) Store.get("pocket.save.$saveKey")?.let { s -> runCatching { (jsonToKotlin(Json.parseToJsonElement(s)) as? JsonMap)?.let { vars.putAll(it) } } }
        templates.clear(); missing.clear(); particles.clear(); messages.clear()
        objects = mutableListOf()
        for (raw in (json["entities"] as? List<*>).orEmpty()) {
            val j = raw.asMap() ?: continue
            if (j["template"] == true) { templates[j["name"].toString()] = j; continue }
            objects.add(GameObject(j, this))
        }
        templates.values.forEach { GameObject(it, this) } // (notes their missing components too)
        time = 0.0; shake = 0.0; newBest = false
        camX = viewW / 2; camY = viewH / 2; camZoom = 1.0
    }

    fun start() {
        reset()
        state = "play"
        objects.toList().forEach { o -> o.parts.forEach { it.start(o, this) } }
    }

    /** A copy of a template object ("Rock", "Bullet"…) at a spot. */
    fun spawn(name: String, x: Double, y: Double, rz: Double = 0.0): GameObject? {
        val t = templates[name] ?: return null
        val o = GameObject(t, this, x, y, if (rz == 0.0) null else rz)
        objects.add(o)
        o.parts.forEach { it.start(o, this) }
        return o
    }

    fun numVar(k: String) = numOf(vars[k])
    fun addVar(k: String, by: Double) { vars[k] = numVar(k) + by }

    /** '{score} points' → '12 points' (an object's own values first: an upgrade's {cost}). */
    fun fill(t: String, o: GameObject? = null): String = Regex("\\{(\\w+)\\}").replace(t) { m ->
        val k = m.groupValues[1]; val v = o?.data?.get(k) ?: vars[k]
        if (v is Number) formatNumber(v.toDouble()) else v?.toString() ?: ""
    }

    fun message(text: String, seconds: Double = 2.0) { messages.add(text to seconds) }
    fun burst(x: Double, y: Double, color: Color, count: Int, size: Double = 1.0) {
        repeat(count) {
            val a = Random.nextDouble() * PI * 2; val sp = (60 + Random.nextDouble() * 160) * size
            particles.add(Particle(Offset(x.toFloat(), y.toFloat()), Offset((cos(a) * sp).toFloat(), (sin(a) * sp).toFloat()), color, ((2 + Random.nextDouble() * 3) * size).toFloat()))
        }
    }

    fun gameOver() = end("over")
    fun win() = end("win")
    private fun end(how: String) {
        if (state != "play") return
        state = how
        if (!settings["saveBest"]?.toString().isNullOrEmpty() && numVar("score") > numVar("best")) {
            vars["best"] = floor(numVar("score")); newBest = true
            Store.put("pocket.best.$saveKey", numVar("best").toString())
        }
        if (settings["saveProgress"] == true) Store.put("pocket.save.$saveKey", "{}")
        haptic(true)
    }

    /** The player hit something: lose a life, go back to the start, or end the game (the engine's respawnOrEnd). */
    fun hurt(player: GameObject, action: String) {
        val col = parseColor(player.shape?.get("fill")) ?: Color.White
        if (action == "respawn" || (action == "damage" && numVar("lives") > 1)) {
            if (action == "damage") addVar("lives", -1.0)
            haptic(true); shake = 10.0
            burst(player.x, player.y, col, 14)
            if (action == "respawn") { player.x = player.home.x.toDouble(); player.y = player.home.y.toDouble() }
            player.invuln = 1.2
            return
        }
        if (action == "damage") vars["lives"] = 0.0
        shake = 18.0
        burst(player.x, player.y, col, 40, 1.4)
        player.visible = false; player.destroy()
        gameOver()
    }

    /** Where a HUD object sits on the screen: its anchor (a corner, an edge or the middle) plus its offset. */
    fun uiCentre(o: GameObject): Offset {
        val a = o.anchor
        val ax = if ("left" in a) 0f else if ("right" in a) screen.width else screen.width / 2
        val ay = if (a.startsWith("top")) safeTop else if (a.startsWith("bottom")) screen.height - safeBottom else screen.height / 2
        return Offset((ax + o.x * uiK).toFloat(), (ay + o.y * uiK).toFloat())
    }
    /** Is a point (a tap) on this object? */
    fun hits(o: GameObject, t: Tap): Boolean {
        val c = if (o.ui) uiCentre(o) else Offset(o.x.toFloat(), o.y.toFloat())
        val at = if (o.ui) t.screen else t.world
        val k = if (o.ui) uiK.toFloat() else 1f; val h = o.half; val pad = if (o.ui) 4f else 6f
        if (o.round) return (at - c).getDistance() <= h.width * k + pad
        return abs(at.x - c.x) <= h.width * k + pad && abs(at.y - c.y) <= h.height * k + pad
    }

    companion object {
        /** Do two objects touch? (circles and boxes; a little slack so a bounce still counts as a hit) */
        fun overlap(a: GameObject, b: GameObject, slack: Double = 1.5): Boolean {
            val ha = a.half; val hb = b.half
            if (a.round && b.round) return hypot(a.x - b.x, a.y - b.y) <= ha.width + hb.width + slack
            if (a.round || b.round) {
                val c = if (a.round) a else b; val r = if (a.round) b else a; val hr = r.half; val rad = c.half.width
                val nx = c.x.coerceIn(r.x - hr.width, r.x + hr.width); val ny = c.y.coerceIn(r.y - hr.height, r.y + hr.height)
                return hypot(c.x - nx, c.y - ny) <= rad + slack
            }
            return abs(a.x - b.x) <= ha.width + hb.width + slack && abs(a.y - b.y) <= ha.height + hb.height + slack
        }
    }

    /** One step of the game. */
    fun step(dt: Double) {
        for (i in messages.indices) messages[i] = messages[i].first to messages[i].second - dt
        messages.removeAll { it.second <= 0 }
        val drag = 0.05.pow(dt).toFloat()
        for (p in particles) { p.p += p.v * dt.toFloat(); p.v *= drag; p.life -= dt.toFloat() }
        particles.removeAll { it.life <= 0 }
        shake = max(0.0, shake - dt * 40)
        if (state != "play") { taps.clear(); dragDelta = Offset.Zero; frame++; return }
        time += dt
        for (o in objects.toList()) {
            if (o.dead) continue
            if (o.invuln > 0) o.invuln -= dt
            o.parts.forEach { it.update(o, dt, this) }
        }
        // touches: each component that cares about a tag hears the objects with it that touch its object
        for (o in objects.toList()) {
            if (o.dead) continue
            for (c in o.parts) {
                val tag = c.wants ?: continue
                for (other in objects.toList()) {
                    if (other === o || other.dead || o.dead || !other.has(tag) || !overlap(o, other)) continue
                    c.touch(o, other, this)
                }
            }
        }
        objects.forEach { o -> o.part<Bounce>()?.collide(o, this) } // (balls bounce off solid objects: paddles, bricks)
        objects.removeAll { it.dead }
        if (numOf(settings["winScore"]) > 0 && numVar("score") >= numOf(settings["winScore"])) win()
        if (numOf(settings["timeLimit"]) > 0 && state == "play") {
            vars["time"] = max(0.0, numVar("time") - dt)
            if (numVar("time") <= 0) { message("Time's up!", 3.0); gameOver() }
        }
        if (settings["saveProgress"] == true && floor(time * 2) != floor((time - dt) * 2)) Store.put("pocket.save.$saveKey", JsonObject(vars.mapValues { (_, v) -> if (v is Number) JsonPrimitive(v) else JsonPrimitive(v?.toString()) }).toString())
        taps.clear(); dragDelta = Offset.Zero
        frame++
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Components (the same names and settings as in Pocket Engine)
// ---------------------------------------------------------------------------------------------------------------

/** The component for a type, with its settings; null: no native version yet. */
fun makeComponent(type: String, p: JsonMap): Component? = when (type) {
    "move" -> Move(p); "timeScore" -> TimeScore(p); "spawner" -> Spawner(p); "velocity" -> Velocity(p); "rotate" -> Rotate(p)
    "hazard" -> Hazard(p); "destroyOffscreen" -> DestroyOffscreen(p); "collectible" -> Collectible(p); "tappable" -> Tappable(p)
    "pulse" -> Pulse(p); "lifetime" -> Lifetime(p); "income" -> Income(p); "upgrade" -> Upgrade(p); "shooter" -> Shooter(p)
    "projectile" -> Projectile(p); "destructible" -> Destructible(p); "bounce" -> Bounce(p); "camera" -> CameraRig(p)
    else -> null
}

/** Move: arrow keys / WASD, and dragging on the screen (the object follows the finger's movement). */
class Move(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val speed = n("speed", 260.0); val axes = s("axes", "all"); val control = s("control", "both")
        var ax = 0.0; var ay = 0.0
        if (control != "drag") {
            if (Key.DirectionLeft in g.keys || Key.A in g.keys) ax -= 1.0
            if (Key.DirectionRight in g.keys || Key.D in g.keys) ax += 1.0
            if (Key.DirectionUp in g.keys || Key.W in g.keys) ay -= 1.0
            if (Key.DirectionDown in g.keys || Key.S in g.keys) ay += 1.0
        }
        if (axes == "vertical") ax = 0.0
        if (axes == "horizontal") ay = 0.0
        val l = hypot(ax, ay)
        if (l > 0) { e.x += ax / l * speed * dt; e.y += ay / l * speed * dt }
        if (control == "drag" || control == "both") { // the finger's movement, a little faster (the engine's drag speed 1.2)
            val d = g.dragDelta / g.zoom.toFloat() * 1.2f
            if (axes != "vertical") e.x += d.x
            if (axes != "horizontal") e.y += d.y
        }
        if (p["keepInView"] != false) {
            val v = g.viewBounds; val h = e.half
            e.x = e.x.coerceIn((v.left + h.width).toDouble(), max(v.left + h.width, v.right - h.width).toDouble())
            e.y = e.y.coerceIn((v.top + h.height).toDouble(), max(v.top + h.height, v.bottom - h.height).toDouble())
        }
    }
}

/** Score over time: points every second while playing. */
class TimeScore(p: JsonMap) : Component(p) { override fun update(e: GameObject, dt: Double, g: PocketGame) = g.addVar("score", n("rate", 10.0) * dt) }

/** Spawner: copies of a template object every so often, at random spots in a range; faster as time goes on (ramp). */
class Spawner(p: JsonMap) : Component(p) {
    private var t = 0.5
    private val alive = mutableListOf<GameObject>()
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val mul = 1 + n("ramp", 0.1) * (g.time / 10)
        t -= dt * mul
        if (t > 0) return
        t = max(0.05, pick(p["every"], 1.0))
        alive.removeAll { it.dead }
        if (alive.size >= n("max", 60.0)) return
        val rel = p["relative"] == true; val snap = n("snap", 0.0)
        fun sn(v: Double) = if (snap > 0) (v / snap).roundToInt() * snap else v
        val x = (if (rel) e.x else 0.0) + sn(pick(p["x"] ?: listOf(20.0, 380.0)))
        val y = (if (rel) e.y else 0.0) + pick(p["y"] ?: -40.0)
        val clear = n("clear", 0.0)
        if (clear > 0 && g.objects.any { !it.dead && it.data["spawned"] == true && abs(it.x - x) < clear && abs(it.y - y) < clear }) return
        val c = g.spawn(s("template", ""), x, y) ?: return
        c.data["spawned"] = true; c.data["speedMul"] = min(3.0, mul); alive.add(c)
    }
}

/** Velocity: a steady speed (a range gives each copy its own). */
class Velocity(p: JsonMap) : Component(p) {
    private var vx = 0.0; private var vy = 0.0
    override fun start(e: GameObject, g: PocketGame) { val m = numOf(e.data["speedMul"], 1.0); vx = pick(p["vx"]) * m; vy = pick(p["vy"] ?: 200.0) * m }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { e.x += vx * dt; e.y += vy * dt }
}

/** Rotate: spins. */
class Rotate(p: JsonMap) : Component(p) { override fun update(e: GameObject, dt: Double, g: PocketGame) { if (s("axis", "z") == "z") e.rz += n("speed", 90.0) * dt } }

/** Hazard: hurts the player on touch (game over, lose a life, or back to the start). */
class Hazard(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (other.dead || g.state != "play" || other.invuln > 0) return
        if (p["destroySelf"] == true) e.destroy()
        g.hurt(other, s("action", "gameover"))
    }
}

/** Destroy off-screen: removed once it leaves the view. */
class DestroyOffscreen(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val v = g.viewBounds; val m = n("margin", 120.0)
        if (e.x < v.left - m || e.x > v.right + m || e.y < v.top - m * 4 || e.y > v.bottom + m) e.destroy()
    }
}

/** Collectible: adds to the score when the player touches it. */
class Collectible(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (e.dead) return
        g.addVar(s("var", "score"), n("score", 10.0))
        g.haptic(false)
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFFD23D), 14, 0.8)
        e.destroy()
    }
}

/** Tap Target: tap it to score (it pops, or bounces when it stays). */
class Tappable(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        for (t in g.taps) {
            if (e.dead || !g.hits(e, t)) continue
            val bonus = s("bonusVar", "").let { if (it.isEmpty()) 0.0 else g.numVar(it) }
            g.addVar(s("var", "score"), n("points", 10.0) + bonus)
            g.haptic(false)
            if (!e.ui) g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFFD23D), 14, 0.8)
            if (p["destroy"] != false) e.destroy() else e.data["pop"] = 0.2
        }
    }
}

/** Pulse: grows and shrinks. */
class Pulse(p: JsonMap) : Component(p) {
    private var t = 0.0; private var bx = 1.0; private var by = 1.0
    override fun start(e: GameObject, g: PocketGame) { bx = e.sx; by = e.sy }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        t += dt
        val k = 1 + sin(t / max(0.1, n("period", 0.8)) * PI * 2) * n("amount", 0.15)
        e.sx = bx * k; e.sy = by * k
    }
}

/** Lifetime: removed after some seconds. */
class Lifetime(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) { t += dt; if (t > n("seconds", 3.0)) e.destroy() }
}

/** Income: adds one variable to another every second (idle "per second" earnings). */
class Income(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) { val r = g.numVar(s("rateVar", "perSecond")); if (r != 0.0) g.addVar(s("var", "score"), r * dt) }
}

/** Upgrade Button: tap to buy; spends a variable to raise another; the price grows. Its text can show {cost}. */
class Upgrade(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { e.data["cost"] = n("cost", 10.0); e.data["owned"] = 0.0 }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        for (t in g.taps) {
            if (!g.hits(e, t)) continue
            val cost = numOf(e.data["cost"]); val costVar = s("costVar", "score"); val have = g.numVar(costVar)
            if (have < cost) { g.haptic(false); g.message("Need ${formatNumber(cost - have)} more", 1.0); continue }
            g.addVar(costVar, -cost)
            g.addVar(s("addVar", "perSecond"), n("amount", 1.0))
            e.data["owned"] = numOf(e.data["owned"]) + 1
            e.data["cost"] = ceil(cost * n("growth", 1.15))
            e.data["pop"] = 0.18
            g.haptic(false)
        }
    }
}

/** Shooter: fires copies of a template (automatically, or on a tap). */
class Shooter(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        t -= dt
        if (t > 0) return
        val trigger = s("trigger", "auto")
        if (trigger == "tap" && g.taps.isEmpty()) return
        if (trigger == "action button" && Key.Spacebar !in g.keys && g.finger == null) return
        t = n("every", 0.25)
        g.spawn(s("template", ""), e.x, e.y, e.rz)
    }
}

/** Projectile: flies straight the way it faces, for a while. */
class Projectile(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val a = e.rz * PI / 180; val sp = n("speed", 650.0)
        e.x += sin(a) * sp * dt; e.y -= cos(a) * sp * dt
        t += dt; if (t > n("life", 2.0)) e.destroy()
    }
}

/** Breakable: takes hits from objects with a tag (bullets, a ball) and breaks when its hits run out. */
class Destructible(p: JsonMap) : Component(p) {
    private var hp = 3.0
    override val wants get() = s("hitBy", "bullet")
    override fun start(e: GameObject, g: PocketGame) { hp = n("hp", 3.0) }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (e.dead || numOf(e.data["hitT"]) > g.time) return
        if (p["removeHitter"] != false) other.destroy()
        hp--; e.data["hitT"] = g.time + 0.15; e.data["flash"] = 0.12
        if (hp > 0) { g.haptic(false); return }
        g.addVar("score", n("points", 10.0))
        g.shake = max(g.shake, 6.0)
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFF8A3D), 26, 1.1)
        e.destroy()
    }
}

/** Bouncing Ball: a steady speed, bouncing off the screen edges and solid objects (paddles, bricks); off the bottom loses a life. */
class Bounce(p: JsonMap) : Component(p) {
    private var vx = 0.0; private var vy = 0.0; private var hx = 0.0; private var hy = 0.0
    private val speed get() = n("speed", 340.0)
    private fun launch() { val a = -0.6 + Random.nextDouble() * 1.2; vx = sin(a) * speed; vy = -cos(a) * speed }
    override fun start(e: GameObject, g: PocketGame) { hx = e.x; hy = e.y; launch() }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        e.x += vx * dt; e.y += vy * dt
        val vb = g.viewBounds; val r = e.half.width
        if (e.x < vb.left + r) { e.x = (vb.left + r).toDouble(); vx = abs(vx) }
        if (e.x > vb.right - r) { e.x = (vb.right - r).toDouble(); vx = -abs(vx) }
        if (e.y < vb.top + r) { e.y = (vb.top + r).toDouble(); vy = abs(vy) }
        if (e.y > vb.bottom - r) {
            if (s("bottom", "lose a life") == "bounce") { e.y = (vb.bottom - r).toDouble(); vy = -abs(vy) }
            else {
                val lives = if (g.vars.containsKey("lives")) g.numVar("lives") else 1.0
                g.haptic(true)
                if (lives <= 1) { g.vars["lives"] = 0.0; g.gameOver(); return }
                g.addVar("lives", -1.0); e.x = hx; e.y = hy; launch(); return
            }
        }
    }
    /** Push out of solid objects it overlaps and turn around (along the shallower side). */
    fun collide(e: GameObject, g: PocketGame) {
        val r = e.half.width
        for (o in g.objects) {
            if (o === e || !o.solid || !PocketGame.overlap(e, o, 0.0)) continue
            val h = o.half; val dx = e.x - o.x; val dy = e.y - o.y; val px = h.width + r - abs(dx); val py = h.height + r - abs(dy)
            if (px < py) { e.x += if (dx < 0) -px else px; vx = if (dx < 0) -abs(vx) else abs(vx) }
            else {
                e.y += if (dy < 0) -py else py; vy = if (dy < 0) -abs(vy) else abs(vy)
                if (o.part<Move>() != null) vx = (dx / (h.width + r)).coerceIn(-1.0, 1.0) * speed * 0.75 // (a paddle: where it hits steers the ball)
            }
        }
        if (abs(vy) < speed * 0.3) vy = (if (vy < 0) -1 else 1) * speed * 0.3 // never stuck going flat
        val l = hypot(vx, vy); if (l > 0) { vx = vx / l * speed; vy = vy / l * speed }
    }
}

/** Camera: fixed, or following its target (follow, side scroller, top down) smoothly, with an offset and a zoom. */
class CameraRig(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { g.camZoom = n("zoom", 1.0).coerceIn(0.1, 10.0); aim(g, 1.0) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) = aim(g, 1 - exp(-n("smooth", 6.0) * dt))
    private fun aim(g: PocketGame, k: Double) {
        val mode = s("mode", "follow")
        if (mode == "fixed") return
        val tag = s("target", "player")
        val t = g.objects.firstOrNull { !it.dead && (it.has(tag) || it.name == tag) } ?: return
        val wantX = t.x + n("ox", 0.0); val wantY = if (mode == "side scroller") g.viewH / 2 + n("oy", 0.0) else t.y + n("oy", 0.0)
        g.camX += (wantX - g.camX) * k; g.camY += (wantY - g.camY) * k
    }
}

// ---------------------------------------------------------------------------------------------------------------
// On screen: the game view (drawn every frame), touch and keys, and the title / game-over cards
// ---------------------------------------------------------------------------------------------------------------

@Composable
fun PocketGameView(game: PocketGame) {
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    val focus = remember { FocusRequester() }
    val measurer = rememberTextMeasurer()
    game.haptic = { hard -> haptics.performHapticFeedback(if (hard) HapticFeedbackType.LongPress else HapticFeedbackType.TextHandleMove) }
    LaunchedEffect(Unit) {
        focus.requestFocus()
        var last = 0L
        while (true) withFrameNanos { now -> if (last != 0L) game.step(((now - last) / 1e9).coerceIn(0.0, 1.0 / 30)); last = now }
    }
    val insets = WindowInsets.safeDrawing
    game.safeTop = insets.getTop(density).toFloat(); game.safeBottom = insets.getBottom(density).toFloat()
    Box(
        Modifier.fillMaxSize().background(game.background)
            .onSizeChanged { game.screen = Size(it.width.toFloat(), it.height.toFloat()) }
            .focusRequester(focus).focusable()
            .onKeyEvent { ev ->
                if (ev.type == KeyEventType.KeyDown) { game.keys.add(ev.key); if ((ev.key == Key.Enter || ev.key == Key.Spacebar) && game.state != "play") game.start() }
                else if (ev.type == KeyEventType.KeyUp) game.keys.remove(ev.key)
                true
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val ev = awaitPointerEvent()
                        val c = ev.changes.firstOrNull() ?: continue
                        when (ev.type) {
                            PointerEventType.Press -> { game.finger = c.position; if (game.state == "play") game.taps.add(Tap(c.position, game.toWorld(c.position))) }
                            PointerEventType.Move -> { game.dragDelta += c.position - (game.finger ?: c.position); game.finger = c.position }
                            PointerEventType.Release -> game.finger = null
                            else -> {}
                        }
                    }
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            game.frame // (redraw every step)
            drawGame(game, measurer)
        }
        Column(Modifier.align(Alignment.TopCenter).padding(top = with(density) { (game.screen.height * 0.32f).toDp() }), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            game.frame
            for ((m, _) in game.messages) Text(m, Modifier.background(Color(0xCC000000), RoundedCornerShape(24.dp)).padding(horizontal = 18.dp, vertical = 10.dp), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
        }
        when (game.state) {
            "title" -> GameCard(game.settings["title"]?.toString() ?: "", game.settings["subtitle"]?.toString() ?: "", "Play") { game.start() }
            "over", "win" -> GameCard(
                if (game.state == "win") "YOU WIN!" else "GAME OVER",
                "${formatNumber(game.numVar("score"))} points" + if (game.vars.containsKey("best")) (if (game.newBest) " · new best!" else " · best ${formatNumber(game.numVar("best"))}") else "",
                "Play again",
            ) { game.start() }
        }
    }
}

/** The title and game-over screens: a big title, a line under it and a button. */
@Composable
private fun GameCard(title: String, sub: String, button: String, onTap: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Color(0x8C000000)).clickable(remember { MutableInteractionSource() }, indication = null) { onTap() }.padding(28.dp),
        verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, color = Color.White, fontSize = 40.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
        if (sub.isNotEmpty()) Text(sub, Modifier.padding(top = 10.dp), color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        Spacer(Modifier.height(36.dp))
        Text("▶  $button", Modifier.background(Color(0xFFFFD23D), RoundedCornerShape(18.dp)).padding(horizontal = 44.dp, vertical = 16.dp), color = Color(0xFF1B1B1B), fontSize = 20.sp, fontWeight = FontWeight.Black)
        Spacer(Modifier.height(12.dp))
        Text("or tap anywhere", color = Color.White.copy(alpha = 0.6f), fontSize = 13.sp)
    }
}

/** Draws the game: the objects in layer order (shapes with their glow, text), particles, then the HUD. */
private fun DrawScope.drawGame(g: PocketGame, measurer: androidx.compose.ui.text.TextMeasurer) {
    val z = g.zoom.toFloat()
    val sh = if (g.shake > 0) Offset(((Random.nextDouble() - 0.5) * g.shake).toFloat(), ((Random.nextDouble() - 0.5) * g.shake).toFloat()) else Offset.Zero
    translate(size.width / 2 + sh.x, size.height / 2 + sh.y) {
        scale(z, z, pivot = Offset.Zero) {
            translate(-g.camX.toFloat(), -g.camY.toFloat()) {
                for (o in g.objects.filter { !it.ui && it.visible && !it.dead }.sortedBy { it.layer }) {
                    if (o.invuln > 0 && floor(o.invuln * 10).toInt() % 2 == 1) continue // (blinks while it can't be hurt)
                    drawObject(g, o, Offset(o.x.toFloat(), o.y.toFloat()), 1f, measurer)
                }
                for (p in g.particles) { val k = (p.life / 0.6f).coerceIn(0f, 1f); drawCircle(p.color.copy(alpha = k), p.size * k.coerceAtLeast(0.2f), p.p) }
            }
        }
    }
    for (o in g.objects.filter { it.ui && it.visible && !it.dead }.sortedBy { it.layer }) drawObject(g, o, g.uiCentre(o), g.uiK.toFloat(), measurer)
}

private fun DrawScope.drawObject(g: PocketGame, o: GameObject, at: Offset, k: Float, measurer: androidx.compose.ui.text.TextMeasurer) {
    val pop = numOf(o.data["pop"]); if (pop > 0) o.data["pop"] = max(0.0, pop - 1 / 60.0)
    val flash = numOf(o.data["flash"]); if (flash > 0) o.data["flash"] = flash - 1 / 60.0
    val bump = (1 + pop * 1.2).toFloat()
    translate(at.x, at.y) {
        rotate(o.rz.toFloat(), pivot = Offset.Zero) {
            scale((o.sx * k * bump).toFloat(), (o.sy * k * bump).toFloat(), pivot = Offset.Zero) {
                o.shape?.let { drawShape(it, flash > 0) }
                val t = o.text
                if (t != null && t["value"]?.toString()?.isNotEmpty() == true) {
                    val r = measurer.measure(g.fill(t["value"].toString(), o), TextStyle(color = parseColor(t["color"]) ?: Color.White, fontSize = (numOf(t["size"], 16.0) / density).sp, fontWeight = FontWeight((numOf(t["weight"], 800.0).toInt() / 100 * 100).coerceIn(100, 900))))
                    val align = t["align"]?.toString() ?: "center"
                    val dx = if (o.shape != null) -r.size.width / 2f else when (align) { "left" -> 0f; "right" -> -r.size.width.toFloat(); else -> -r.size.width / 2f }
                    drawText(r, topLeft = Offset(dx, -r.size.height / 2f))
                }
            }
        }
    }
}

private fun DrawScope.drawShape(s: JsonMap, flash: Boolean) {
    val type = s["type"]?.toString() ?: "rect"
    val w = numOf(s["w"], 32.0).toFloat(); val h = numOf(s["h"], 32.0).toFloat(); val r = numOf(s["r"], numOf(s["radius"], 16.0)).toFloat()
    val path = Path()
    when (type) {
        "circle" -> path.addOval(Rect(Offset.Zero, r))
        "star" -> { for (i in 0 until 10) { val a = -PI / 2 + i * PI / 5; val rr = if (i % 2 == 0) 1f else 0.45f; val x = (cos(a) * w / 2 * rr).toFloat(); val y = (sin(a) * h / 2 * rr).toFloat(); if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }; path.close() }
        "triangle" -> { path.moveTo(0f, -h / 2); path.lineTo(w / 2, h / 2); path.lineTo(-w / 2, h / 2); path.close() }
        "ellipse" -> path.addOval(Rect(Offset(-w / 2, -h / 2), Size(w, h)))
        "diamond" -> { path.moveTo(0f, -h / 2); path.lineTo(w / 2, 0f); path.lineTo(0f, h / 2); path.lineTo(-w / 2, 0f); path.close() }
        else -> { val cr = numOf(s["radius"]).toFloat().coerceIn(0f, min(w, h) / 2); path.addRoundRect(RoundRect(Rect(Offset(-w / 2, -h / 2), Size(w, h)), CornerRadius(cr))) }
    }
    val fill = if (flash) Color.White else parseColor(s["fill"]); val stroke = parseColor(s["stroke"]); val glow = numOf(s["glow"]).toFloat()
    val glowCol = fill ?: stroke
    if (glow > 0 && glowCol != null) for (i in 3 downTo 1) { // (a soft glow: a few faint, bigger copies)
        val gk = 1 + glow / max(w, max(h, r * 2)) * i * 0.5f
        scale(gk, gk, pivot = Offset.Zero) { drawPath(path, glowCol.copy(alpha = 0.12f)) }
    }
    if (fill != null) drawPath(path, fill)
    if (stroke != null) drawPath(path, stroke, style = Stroke(numOf(s["lineWidth"], 2.0).toFloat()))
}
