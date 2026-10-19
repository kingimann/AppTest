// Pocket game runtime for Compose Multiplatform (Android and iOS): plays a Pocket Engine 2D game natively, with no web
// view. The game itself is GAME_JSON (GameData.kt, exactly as Pocket Engine saved it); this file reads it and runs it with
// the engine's rules: shapes, emoji and text drawn on a Compose canvas, objects inside objects, physics (gravity, solid
// ground, moving platforms), the HUD, touch (joystick, jump / fire buttons, swipes, drags) and keys, score, lives, best
// score, the title and game-over screens, and the components (Move, Platformer, Spawner, Health, Damage Dealer, Trigger…).
// Made by Pocket Engine's native export; it's a readable file: change anything you like.
package __PACKAGE__

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.StrokeCap
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import kotlin.math.*
import kotlin.random.Random

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

typealias JsonMap = Map<String, Any?>
typealias MMap = MutableMap<String, Any?>

fun numOf(v: Any?, d: Double = 0.0): Double = when (v) { is Number -> v.toDouble(); is Boolean -> if (v) 1.0 else 0.0; else -> v?.toString()?.toDoubleOrNull() ?: d }
fun onOf(v: Any?, d: Boolean = false): Boolean = if (v == null) d else v == true || v == 1.0 || v == 1 || v == "yes" || v == "true"
fun strOf(v: Any?, d: String = ""): String { val s = v?.toString() ?: return d; return if (s.isEmpty()) d else if (v is Double && v == floor(v) && abs(v) < 1e15) v.toLong().toString() else s }
fun rand(a: Double, b: Double) = a + Random.nextDouble() * (b - a)
const val DEG = PI / 180

/** A number, or a random number in a [min, max] range (the engine's "range" settings). */
fun pick(v: Any?, d: Double = 0.0): Double = when {
    v is List<*> && v.size >= 2 -> { val a = numOf(v[0]); val b = numOf(v[1]); a + Random.nextDouble() * (b - a) }
    v is List<*> && v.isNotEmpty() -> numOf(v[0], d)
    else -> numOf(v, d)
}

/** "enemy, hazard" → ["enemy", "hazard"]. */
fun tagList(v: Any?): List<String> = (v?.toString() ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }

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

/** Between two colours (k: 0 → a, 1 → b). */
fun mixColor(a: Color, b: Color, k: Double): Color { val t = k.coerceIn(0.0, 1.0).toFloat(); return Color(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t, a.alpha + (b.alpha - a.alpha) * t) }

/** 12.7 → "12", 15300 → "15.3K" (the engine's formatNumber). */
fun formatNumber(v: Double): String {
    val a = abs(v)
    if (a < 10000) return floor(v).toLong().toString()
    for ((n, u) in listOf(1e12 to "T", 1e9 to "B", 1e6 to "M", 1e3 to "K")) {
        if (a >= n) { val k = floor(v / n * 10) / 10; return (if (k == floor(k)) k.toLong().toString() else k.toString()) + u }
    }
    return floor(v).toLong().toString()
}

/** The engine's easing curves by name (linear, inOutSine, outBack, outBounce…). */
fun ease(name: String, t0: Double): Double {
    val t = t0.coerceIn(0.0, 1.0)
    return when (name) {
        "linear" -> t
        "inQuad" -> t * t
        "outQuad" -> 1 - (1 - t) * (1 - t)
        "inOutQuad" -> if (t < 0.5) 2 * t * t else 1 - (-2 * t + 2).pow(2) / 2
        "inCubic" -> t * t * t
        "outCubic" -> 1 - (1 - t).pow(3)
        "inOutCubic" -> if (t < 0.5) 4 * t * t * t else 1 - (-2 * t + 2).pow(3) / 2
        "inSine" -> 1 - cos(t * PI / 2)
        "outSine" -> sin(t * PI / 2)
        "inOutSine" -> -(cos(PI * t) - 1) / 2
        "inBack" -> 2.70158 * t * t * t - 1.70158 * t * t
        "outBack" -> 1 + 2.70158 * (t - 1).pow(3) + 1.70158 * (t - 1).pow(2)
        "inOutBack" -> { val c = 1.70158 * 1.525; if (t < 0.5) ((2 * t).pow(2) * ((c + 1) * 2 * t - c)) / 2 else ((2 * t - 2).pow(2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2 }
        "outElastic" -> if (t == 0.0 || t == 1.0) t else 2.0.pow(-10 * t) * sin((t * 10 - 0.75) * (2 * PI / 3)) + 1
        "inElastic" -> if (t == 0.0 || t == 1.0) t else -(2.0.pow(10 * t - 10)) * sin((t * 10 - 10.75) * (2 * PI / 3))
        "outBounce" -> bounceEase(t)
        "inBounce" -> 1 - bounceEase(1 - t)
        "inOutBounce" -> if (t < 0.5) (1 - bounceEase(1 - 2 * t)) / 2 else (1 + bounceEase(2 * t - 1)) / 2
        "outExpo" -> if (t == 1.0) 1.0 else 1 - 2.0.pow(-10 * t)
        "inExpo" -> if (t == 0.0) 0.0 else 2.0.pow(10 * t - 10)
        else -> -(cos(PI * t) - 1) / 2
    }
}
private fun bounceEase(t0: Double): Double {
    val n = 7.5625; val d = 2.75; var t = t0
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75 }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375 }
    t -= 2.625 / d; return n * t * t + 0.984375
}

private fun jsonToKotlin(e: JsonElement): Any? = when (e) {
    is JsonNull -> null
    is JsonPrimitive -> if (e.isString) e.content else e.booleanOrNull ?: e.doubleOrNull ?: e.content
    is JsonArray -> e.map { jsonToKotlin(it) }
    is JsonObject -> e.mapValues { jsonToKotlin(it.value) }
}
/** A Kotlin value (maps, lists, numbers, text) as JSON. */
fun toJsonValue(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is Map<*, *> -> JsonObject(v.entries.associate { it.key.toString() to toJsonValue(it.value) })
    is List<*> -> JsonArray(v.map { toJsonValue(it) })
    is Offset -> JsonArray(listOf(JsonPrimitive(v.x), JsonPrimitive(v.y)))
    else -> JsonPrimitive(v.toString())
}
fun parseJson(s: String): Any? = runCatching { jsonToKotlin(Json.parseToJsonElement(s)) }.getOrNull()
@Suppress("UNCHECKED_CAST")
fun Any?.asMap(): JsonMap? = this as? JsonMap
/** What's kept on the phone (empty means nothing). */
fun stored(k: String): String? = runCatching { Store.get(k) }.getOrNull()?.takeIf { it.isNotEmpty() }
fun store(k: String, v: String) { runCatching { Store.put(k, v) } }

/** Half a width and height. */
data class Half(val w: Double, val h: Double) { companion object { val Zero = Half(0.0, 0.0) } }
/** A rectangle in the world. */
data class Bounds(val left: Double, val top: Double, val right: Double, val bottom: Double) { val width get() = right - left; val height get() = bottom - top }

// ---------------------------------------------------------------------------------------------------------------
// Objects in the game
// ---------------------------------------------------------------------------------------------------------------

/** A physics body: dynamic ones fall and are pushed out of solid ones; static and kinematic ones are the ground,
 *  walls and moving platforms; sensors only notice touches. */
class Body(j: JsonMap) {
    var type = strOf(j["type"], "dynamic")
    var sensor = onOf(j["sensor"]); var oneWay = onOf(j["oneWay"])
    var gravityScale = numOf(j["gravityScale"], 1.0); var bounce = numOf(j["bounce"]); var friction = numOf(j["friction"]); var drag = numOf(j["drag"])
    var maxFall = numOf(j["maxFall"]); var maxSpeed = numOf(j["maxSpeed"])
    var vx = numOf(j["vx"]); var vy = numOf(j["vy"])
    var lockX = onOf(j["lockX"]); var lockY = onOf(j["lockY"])
    var shape = strOf(j["shape"], "auto"); var w = numOf(j["w"]); var h = numOf(j["h"]); var r = numOf(j["r"]); var ox = numOf(j["ox"]); var oy = numOf(j["oy"])
    var ignore = tagList(j["ignore"])
    var grounded = false; var wasGrounded = false
    /** How hard it landed this frame (speed), 0 if it didn't. */
    var landed = 0.0
    /** A force zone's push this frame. */
    var fx = 0.0; var fy = 0.0
    /** How far a platform moved since the last step (riders go with it). */
    var dx = 0.0; var dy = 0.0; var px = Double.NaN; var py = Double.NaN
    var groundedOn: GameObject? = null
    val solid get() = !sensor && (type == "static" || type == "kinematic")
    val isDynamic get() = type == "dynamic"
}

/** One object: where it is, how it looks (shape, text), its tags, its body and its components. */
class GameObject(val json: JsonMap, game: PocketGame, x: Double? = null, y: Double? = null, rz: Double? = null, var parent: GameObject? = null) {
    companion object { private var uids = 0 }
    val uid = ++uids
    val id = strOf(json["id"], "o$uid")
    val name = json["name"]?.toString() ?: ""
    val tags = (json["tags"] as? List<*>)?.map { it.toString() }?.toMutableSet() ?: mutableSetOf()
    var x = x ?: numOf(json["x"]); var y = y ?: numOf(json["y"])
    var rz = rz ?: numOf(json["rz"])
    var sx = numOf(json["sx"], 1.0); var sy = numOf(json["sy"], 1.0)
    var alpha = numOf(json["alpha"], 1.0)
    val layer = numOf(json["layer"]).toInt()
    var visible = json["visible"] != false
    val ui = json["ui"] == true
    val anchor = json["anchor"]?.toString() ?: "top-left"
    val showWhen = strOf(json["showWhen"], "always")
    val stretch = strOf(json["stretch"])
    val margin = numOf(json["margin"])
    val shape: MMap? = json["shape"].asMap()?.toMutableMap() // (components change colours; the template keeps its own)
    val text: MMap? = json["text"].asMap()?.toMutableMap()
    val sprite = json["sprite"].asMap()
    val bar = json["bar"].asMap()
    var body: Body? = json["body"].asMap()?.let { Body(it) }
    var home = Offset(this.x.toFloat(), this.y.toFloat())
    /** Its place inside its parent (children follow their parent). */
    var lx = this.x; var ly = this.y; var lrz = this.rz
    var lastWorld: Pair<Double, Double>? = null
    val parts = mutableListOf<Component>()
    val data = mutableMapOf<String, Any?>()
    var dead = false
    var invuln = 0.0
    /** Bars drawn over it (health, hunger…): 0–1 and a colour. */
    val bars = mutableMapOf<String, Pair<Double, Color>>()

    init {
        for (raw in (json["behaviors"] as? List<*>).orEmpty()) {
            val p = raw.asMap() ?: continue
            val type = p["type"]?.toString() ?: ""
            val made = makeComponent(type, if (p.containsKey("params")) p["params"].asMap() ?: p else p)
            if (made != null) { made.type = type; parts.add(made) } else game.missing.add(type)
        }
    }
    fun has(tag: String) = tag in tags || name == tag
    fun destroy() { dead = true }
    inline fun <reified T : Component> part(): T? = parts.firstOrNull { it is T } as? T
    fun partNamed(type: String) = parts.firstOrNull { it.type == type }
    val shown: Boolean get() = visible && (parent?.shown ?: true)

    /** A body (as a component needs one): keeps what it has, or makes one. */
    fun ensureBody(type: String, gravityScale: Double? = null, sensor: Boolean = false): Body {
        val b = body ?: Body(mapOf("type" to type, "sensor" to sensor)).also { body = it }
        if (gravityScale != null && b.isDynamic) b.gravityScale = gravityScale
        return b
    }

    /** Half its width and height (a circle: its radius both ways), scaled. */
    val half: Half get() {
        val b = body
        if (b != null && b.shape != "auto") {
            if (b.shape == "circle") { val r = (if (b.r > 0) b.r else 10.0) * max(abs(sx), abs(sy)); return Half(r, r) }
            if (b.w > 0 || b.h > 0) return Half(b.w / 2 * abs(sx), b.h / 2 * abs(sy))
        }
        val s = shape
        if (s == null) {
            val sp = sprite
            if (sp != null) return Half(numOf(sp["w"], 64.0) / 2 * abs(sx), numOf(sp["h"], 64.0) / 2 * abs(sy))
            val t = text
            if (t != null) { val sz = numOf(t["size"], 16.0); return Half(t["value"].toString().length * sz * 0.3 * abs(sx), sz * 0.6 * abs(sy)) }
            val br = bar
            if (br != null) return Half(numOf(br["w"], 200.0) / 2 * abs(sx), numOf(br["h"], 12.0) / 2 * abs(sy))
            return Half.Zero
        }
        if (s["type"] == "circle" || s["type"] == "ring") { val r = numOf(s["r"], numOf(s["radius"], 16.0)); return Half(r * abs(sx), r * abs(sy)) }
        return Half(numOf(s["w"], 32.0) / 2 * abs(sx), numOf(s["h"], 32.0) / 2 * abs(sy))
    }
    val round: Boolean get() { val b = body; if (b != null && b.shape != "auto") return b.shape == "circle"; return shape?.get("type") == "circle" || shape?.get("type") == "ring" }

    fun getField(k: String): Double = when (k) { "x" -> x; "y" -> y; "rz", "angle" -> rz; "sx" -> sx; "sy" -> sy; "alpha" -> alpha; else -> numOf(data[k]) }
    fun setField(k: String, v: Double) { when (k) { "x" -> x = v; "y" -> y = v; "rz", "angle" -> rz = v; "sx" -> sx = v; "sy" -> sy = v; "alpha" -> alpha = v; else -> data[k] = v } }
}

/** What a component does each frame and when something touches its object. */
abstract class Component(val p: JsonMap) {
    /** Its type name in Pocket Engine ("platformer", "health"…). */
    var type = ""
    /** The tag it cares about touching ("player", "bullet"…), or null. */
    open val wants: String? get() = null
    /** Does it care about touching this object? (wants a tag by default) */
    open fun cares(other: GameObject): Boolean { val w = wants; return w != null && other.has(w) }
    /** Hears touches with what it cares about (a tag it wants, or its own test). */
    open val listens: Boolean get() = wants != null
    /** Keeps working on the title and end screens (buttons). */
    open val always: Boolean get() = false
    open fun start(e: GameObject, g: PocketGame) {}
    open fun update(e: GameObject, dt: Double, g: PocketGame) {}
    /** Something it cares about started touching it. */
    open fun touch(e: GameObject, other: GameObject, g: PocketGame) {}
    /** Its object is being removed. */
    open fun gone(e: GameObject, g: PocketGame) {}
    fun s(k: String, d: String = "") = strOf(p[k], d)
    fun n(k: String, d: Double = 0.0) = numOf(p[k], d)
    fun on(k: String, d: Boolean = false) = onOf(p[k], d)
}
/** A component that decides for itself what it touches (more than one tag, or anything). */
abstract class Toucher(p: JsonMap) : Component(p) { override val listens get() = true }

// ---------------------------------------------------------------------------------------------------------------
// The game: its objects, variables, time and rules
// ---------------------------------------------------------------------------------------------------------------

class Particle(var x: Double, var y: Double, var vx: Double, var vy: Double, val color: Color, val size: Double, var life: Double = 0.6, val gravity: Double = 0.0,
               val shrink: Boolean = true, val grow: Boolean = false, val round: Boolean = true, val alpha: Double = 1.0, val stretch: Double = 0.0) { val full = life }
class Tap(val screen: Offset, val world: Offset, val id: Long = 0)
/** A finger on the screen: where it started and is now, and what it's doing (the joystick, a button, or free). */
class Pointer(val id: Long, val start: Offset, var at: Offset, val t0: Double) { var role = "free" }
/** "+10" floating up from a point on the screen. */
class FloatText(var at: Offset, val text: String, val color: Color, val size: Double) { var life = 1.0 }
/** A value easing to another over time (the engine's tweens: punch, squash, fades, moves). */
class Tween(val o: GameObject, val field: String, val from: Double, val to: Double, val seconds: Double, val curve: String, var delay: Double = 0.0, val yoyo: Boolean = false, val done: (() -> Unit)? = null) { var t = 0.0 }
/** A touch button on the screen: jump, fire, or a D-pad arrow. */
class TouchButton(val action: String, val label: String, var at: Offset, val r: Float) { var finger: Long? = null }

class PocketGame(source: String) {
    val json: JsonMap = (parseJson(source) as? JsonMap) ?: emptyMap()
    val settings: MMap = (json["settings"].asMap() ?: emptyMap()).toMutableMap()
    val viewW = numOf(json["view"].asMap()?.get("width"), 400.0)
    val viewH = numOf(json["view"].asMap()?.get("height"), 700.0)
    val baseBackground = parseColor(json["background"]) ?: Color(0xFF101830)
    var background = baseBackground
    /** title, play, over or win. */
    var state by mutableStateOf("title")
    var paused by mutableStateOf(false)
    var frame by mutableStateOf(0L) // (drawing reads it, so every step redraws)
    val vars = mutableMapOf<String, Any?>()
    var objects = mutableListOf<GameObject>()
    private val born = mutableListOf<GameObject>()
    val templates = mutableMapOf<String, JsonMap>()
    /** Children of templates (they spawn with their template), by the template's id. */
    val templateKids = mutableMapOf<String, MutableList<JsonMap>>()
    val missing = mutableSetOf<String>()
    val particles = mutableListOf<Particle>()
    val floats = mutableListOf<FloatText>()
    val tweens = mutableListOf<Tween>()
    val messages = mutableListOf<Pair<String, Double>>()
    val listeners = mutableListOf<(String) -> Unit>()
    private val later = mutableListOf<Pair<Double, () -> Unit>>()
    private val contacts = mutableSetOf<String>()
    /** Things drawn over the game by components (a pull line, a hold ring…), in screen pixels. */
    val overlays = mutableListOf<DrawScope.() -> Unit>()
    /** Things drawn in the world by components (a rope), in world units. */
    val worldOverlays = mutableListOf<DrawScope.() -> Unit>()
    var time = 0.0; var shake = 0.0; var gravity = 0.0; var darkness = 0.0
    /** The camera: what the middle of the screen looks at, and how far in it's zoomed (a Camera component moves it). */
    var camX = viewW / 2; var camY = viewH / 2; var camZoom = 1.0
    /** The camera object driving the view (several cameras: the one switched to). */
    var activeCamera: GameObject? = null
    var newBest = false
    var haptic: (Boolean) -> Unit = {}
    // input
    var screen = Size.Zero
    var safeLeft = 0f; var safeTop = 0f; var safeRight = 0f; var safeBottom = 0f
    val keys = mutableSetOf<Key>()
    private val keysBefore = mutableSetOf<Key>()
    val taps = mutableListOf<Tap>()
    val pointers = mutableMapOf<Long, Pointer>()
    val downs = mutableListOf<Pointer>(); val ups = mutableListOf<Pointer>()
    val pressed = mutableSetOf<String>()
    val buttons = mutableListOf<TouchButton>()
    var stick: Pointer? = null
    var finger: Offset? = null
    var dragDelta = Offset.Zero
    /** UI objects a touch presses (buttons): those touches never steer the joystick or jump. */
    val tapTargets = mutableSetOf<GameObject>()
    /** Directions and buttons held by HUD Touch Buttons. */
    val virtualHeld = mutableSetOf<String>()
    /** Panels components show over the game (a dialogue box, a shop…), drawn after the canvas. */
    val panels = mutableListOf<@Composable () -> Unit>()
    /** Game-wide systems components share (the inventory, quests, turns…), by name. */
    val systems = mutableMapOf<String, Any?>()
    /** Things to do when the game resets (systems clear their state). */
    val onReset = mutableListOf<() -> Unit>()
    /** A native widget for a HUD object (set by the export when it has one). */
    var hudWidget: ((GameObject) -> (@Composable () -> Unit)?)? = null
    val gameData: JsonMap get() = json

    val saveKey get() = settings["saveBest"]?.toString()?.takeIf { it.isNotEmpty() } ?: (json["name"]?.toString() ?: "game")
    val zoom get() = (if (screen.width <= 0f) 1.0 else min(screen.width / viewW, screen.height / viewH)) * camZoom
    /** How big the HUD is on this screen (the engine's "scale with screen size"). */
    val uiK get() = if (screen.width <= 0f) 1.0 else exp(0.5 * ln(screen.width / viewW) + 0.5 * ln(screen.height / viewH)).coerceIn(0.6, 2.5)
    fun toWorld(s: Offset) = Offset(((s.x - screen.width / 2) / zoom + camX).toFloat(), ((s.y - screen.height / 2) / zoom + camY).toFloat())
    fun toScreen(x: Double, y: Double) = Offset(((x - camX) * zoom + screen.width / 2).toFloat(), ((y - camY) * zoom + screen.height / 2).toFloat())
    val viewBounds: Bounds get() { val hw = screen.width / 2 / zoom; val hh = screen.height / 2 / zoom; return Bounds(camX - hw, camY - hh, camX + hw, camY + hh) }

    init { reset(); if (settings["title"]?.toString().isNullOrEmpty() && objects.none { it.ui && it.showWhen == "title" }) start() } // (no title screen: straight in)

    /** Everything back to how the game starts. */
    fun reset() {
        vars.clear(); vars.putAll(json["vars"].asMap() ?: emptyMap())
        if (!settings["saveBest"]?.toString().isNullOrEmpty()) vars["best"] = stored("pocket.best.$saveKey")?.toDoubleOrNull() ?: 0.0
        if (numOf(settings["timeLimit"]) > 0) vars["time"] = numOf(settings["timeLimit"])
        if (settings["saveProgress"] == true) stored("pocket.save.$saveKey")?.let { s -> (parseJson(s) as? JsonMap)?.let { vars.putAll(it) } }
        templates.clear(); templateKids.clear(); missing.clear(); particles.clear(); floats.clear(); tweens.clear(); messages.clear()
        listeners.clear(); later.clear(); contacts.clear(); tapTargets.clear(); born.clear(); overlays.clear(); worldOverlays.clear(); virtualHeld.clear(); activeCamera = null; panels.clear(); systems.clear(); onReset.toList().forEach { it() }
        objects = mutableListOf()
        gravity = numOf(json["gravity"])
        background = baseBackground; darkness = 0.0; paused = false
        val all = (json["entities"] as? List<*>).orEmpty().mapNotNull { it.asMap() }
        val tplIds = all.filter { it["template"] == true }.map { strOf(it["id"]) }.toSet()
        val byId = all.associateBy { strOf(it["id"]) }
        fun inTemplate(j: JsonMap): Boolean {
            var q = j; var n = 0
            while (q["parent"] != null && n++ < 50) { if (strOf(q["parent"]) in tplIds) return true; q = byId[strOf(q["parent"])] ?: return false }
            return false
        }
        for (j in all) {
            if (j["template"] != true && inTemplate(j)) { templateKids.getOrPut(strOf(j["parent"])) { mutableListOf() }.add(j); continue }
            if (j["template"] == true) { templates[j["name"].toString()] = j; continue }
            objects.add(GameObject(j, this))
        }
        val ids = objects.associateBy { it.id }
        for (o in objects) { val pid = o.json["parent"]; if (pid != null) o.parent = ids[strOf(pid)] }
        templates.values.forEach { GameObject(it, this) } // (notes their missing components too)
        templateKids.values.forEach { k -> k.forEach { GameObject(it, this) } }
        time = 0.0; shake = 0.0; newBest = false
        camX = viewW / 2; camY = viewH / 2; camZoom = 1.0
        syncHierarchy()
        layoutButtons()
    }

    fun start() {
        reset()
        state = "play"
        for (o in objects.toList()) o.parts.forEach { it.start(o, this) }
        addBorn()
        layoutButtons()
        frame++
    }

    /** A copy of a template object ("Rock", "Bullet"…) at a spot, with what's inside it. */
    fun spawn(name: String, x: Double, y: Double, rz: Double = 0.0): GameObject? {
        val t = templates[name] ?: return null
        val o = GameObject(t, this, x, y, if (rz == 0.0) null else rz)
        o.data["spawned"] = true
        born.add(o)
        fun kids(srcId: String, parent: GameObject) {
            for (k in templateKids[srcId].orEmpty()) { val c = GameObject(k, this, parent = parent); born.add(c); kids(strOf(k["id"]), c) }
        }
        kids(strOf(t["id"]), o)
        return o
    }
    private fun addBorn() {
        while (born.isNotEmpty()) {
            val list = born.toList(); born.clear()
            objects.addAll(list)
            syncHierarchy(list)
            for (o in list) o.parts.forEach { it.start(o, this) }
        }
    }

    /** An object by its name (or id), or the first with that tag. */
    fun find(name: String): GameObject? {
        if (name.isEmpty()) return null
        return objects.firstOrNull { !it.dead && (it.name == name || it.id == name) } ?: objects.firstOrNull { !it.dead && name in it.tags }
    }
    /** Every object with a tag (or name). */
    fun findAll(tag: String) = objects.filter { !it.dead && it.has(tag) }

    fun numVar(k: String) = numOf(vars[k])
    fun setVar(k: String, v: Any?) { vars[k] = v }
    fun addVar(k: String, by: Double) { vars[k] = numVar(k) + by }

    /** '{score} points' → '12 points' (an object's own values first: an upgrade's {cost}). */
    fun fill(t: String, o: GameObject? = null): String = Regex("\\{(\\w+)\\}").replace(t) { m ->
        val k = m.groupValues[1]; val v = o?.data?.get(k) ?: vars[k]
        if (v is Number) formatNumber(v.toDouble()) else v?.toString() ?: ""
    }

    fun message(text: String, seconds: Double = 2.0) { messages.add(fill(text) to seconds) }
    /** Messages between components ("open shop", "boss-down"): anything listening hears it. */
    fun send(m: String) { if (m.isEmpty()) return; listeners.toList().forEach { it(m) } }
    fun on(l: (String) -> Unit) { listeners.add(l) }
    /** Do something a little later (seconds of game time). */
    fun after(seconds: Double, f: () -> Unit) { later.add((time + seconds) to f) }
    fun burst(x: Double, y: Double, color: Color, count: Int, size: Double = 1.0) {
        repeat(count) {
            val a = Random.nextDouble() * PI * 2; val sp = (60 + Random.nextDouble() * 160) * size
            particles.add(Particle(x, y, cos(a) * sp, sin(a) * sp, color, (2 + Random.nextDouble() * 3) * size))
        }
    }
    /** "+10" floating up from a point on the screen. */
    fun popText(screenAt: Offset, text: String, color: Color, size: Double = 24.0) { floats.add(FloatText(screenAt, text, color, size)) }
    /** "+10" over an object. */
    fun popOver(o: GameObject, text: String, color: Color, size: Double = 22.0) = popText(if (o.ui) uiRect(o).center else toScreen(o.x, o.y - o.half.h), text, color, size)
    fun buzz(hard: Boolean = false) = haptic(hard)
    /** The engine's sounds (coin, jump, hit, power, win, lose, click): a tap of the phone's haptics. */
    fun sfx(name: String) { if (name.isEmpty() || name == "none") return; haptic(name == "hit" || name == "lose") }

    /** Ease a value of an object to another (moves, fades, squashes). */
    fun tween(o: GameObject, field: String, to: Double, seconds: Double, curve: String = "outQuad", delay: Double = 0.0, yoyo: Boolean = false, done: (() -> Unit)? = null): Tween {
        val t = Tween(o, field, o.getField(field), to, max(0.001, seconds), curve, delay, yoyo, done)
        tweens.add(t)
        return t
    }
    fun killTweens(o: GameObject, field: String? = null) { tweens.removeAll { it.o === o && (field == null || it.field == field) } }
    /** Squash it a little and spring back (a press). */
    fun squash(o: GameObject, k: Double = 0.9) {
        val bx = numOf(o.data["baseSx"], o.sx); val by = numOf(o.data["baseSy"], o.sy)
        o.data["baseSx"] = bx; o.data["baseSy"] = by
        killTweens(o, "sx"); killTweens(o, "sy")
        o.sx = bx * k; o.sy = by * k
        tween(o, "sx", bx, 0.3, "outBack"); tween(o, "sy", by, 0.3, "outBack")
    }

    fun gameOver() = end("over")
    fun win() = end("win")
    private fun end(how: String) {
        if (state != "play") return
        state = how
        if (!settings["saveBest"]?.toString().isNullOrEmpty() && numVar("score") > numVar("best")) {
            vars["best"] = floor(numVar("score")); newBest = true
            store("pocket.best.$saveKey", numVar("best").toString())
        }
        if (settings["saveProgress"] == true) store("pocket.save.$saveKey", "")
        sfx(if (how == "win") "win" else "lose")
        buzz(true)
        send(if (how == "win") "won" else "game over")
        frame++
    }

    /** The player hit something: lose a life, go back to the start (or the last checkpoint), or end the game (the engine's respawnOrEnd). */
    fun hurt(player: GameObject, action: String) {
        val col = parseColor(player.shape?.get("fill")) ?: Color.White
        if (action == "respawn" || (action == "damage" && numVar("lives") > 1)) {
            if (action == "damage") addVar("lives", -1.0)
            sfx("hit"); buzz(true); shake = 10.0
            burst(player.x, player.y, col, 14)
            if (action == "respawn" || player.data["respawnOnHit"] == true) {
                val sp = player.data["respawn"] as? Offset ?: player.home
                player.x = sp.x.toDouble(); player.y = sp.y.toDouble()
                player.body?.let { it.vx = 0.0; it.vy = 0.0 }
            }
            player.invuln = 1.2
            return
        }
        if (action == "damage") setVar("lives", 0.0)
        sfx("hit"); shake = 18.0
        burst(player.x, player.y, col, 40, 1.4)
        player.visible = false; player.destroy()
        gameOver()
    }

    // ---- saving (the Save game / Load game actions, Save Point, Save Manager) ----
    /** Variables and where everything is, in a save slot on the phone. */
    fun saveGame(slot: Any? = 1, positions: Boolean = true): Boolean {
        val d = mutableMapOf<String, Any?>("vars" to vars)
        if (positions) d["objects"] = objects.filter { !it.ui && !it.dead }.associate { it.id to listOf(it.x, it.y, if (it.visible) 1.0 else 0.0) }
        val alive = objects.map { it.id }.toSet()
        d["removed"] = (json["entities"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.filter { it["template"] != true && strOf(it["id"]) !in alive }.map { strOf(it["id"]) }
        store("pocket.slot.$saveKey.${strOf(slot)}", toJsonValue(d).toString())
        return true
    }
    fun loadGame(slot: Any? = 1): Boolean {
        val d = stored("pocket.slot.$saveKey.${strOf(slot)}")?.let { parseJson(it) } as? JsonMap ?: return false
        d["vars"].asMap()?.let { vars.putAll(it) }
        val pos = d["objects"].asMap() ?: emptyMap()
        val removed = (d["removed"] as? List<*>).orEmpty().map { it.toString() }.toSet()
        for (o in objects) {
            if (o.id in removed) { o.destroy(); continue }
            val p = pos[o.id] as? List<*> ?: continue
            if (p.size >= 2) { o.x = numOf(p[0]); o.y = numOf(p[1]); if (p.size > 2) o.visible = numOf(p[2]) > 0; o.body?.let { it.vx = 0.0; it.vy = 0.0 } }
        }
        return true
    }
    fun hasSave(slot: Any? = 1) = stored("pocket.slot.$saveKey.${strOf(slot)}") != null
    fun deleteSave(slot: Any? = 1) = store("pocket.slot.$saveKey.${strOf(slot)}", "")

    /** Do one of the engine's actions (Trigger, Timer, Condition, Button, Rules: "add score", "spawn template", "win"…). */
    fun runAction(e: GameObject, p: JsonMap, other: GameObject? = null) {
        val v = strOf(p["value"]); val action = strOf(p["action"], "message"); val amount = p["amount"] ?: 1.0
        fun obj(n: String) = if (n.isEmpty()) e else find(n)
        fun nums(a: Any?) = a.toString().split(",").map { it.trim().toDoubleOrNull() ?: 0.0 }
        when (action) {
            "set variable" -> setVar(v.ifEmpty { "score" }, if (amount is Number) amount.toDouble() else amount.toString().toDoubleOrNull() ?: amount)
            "add score" -> addVar("score", numOf(amount, 1.0))
            "add to variable" -> addVar(v.ifEmpty { "score" }, numOf(amount, 1.0))
            "hide object" -> obj(v)?.visible = false
            "show object" -> find(v)?.visible = true
            "toggle object" -> obj(v)?.let { it.visible = !it.visible }
            "destroy other" -> if (other != null) { burst(other.x, other.y, Color.White, 12); other.destroy() }
            "destroy object" -> (if (v.isEmpty()) e else find(v))?.let { burst(it.x, it.y, Color.White, 16); it.destroy() }
            "spawn template" -> if (v.isNotEmpty()) spawn(v, e.x, e.y)
            "play sound" -> { sfx(if (strOf(p["sound"]).isNotEmpty() && p["sound"] != "none") p["sound"].toString() else v.ifEmpty { "click" }); return }
            "vibrate" -> buzz(true)
            "camera shake" -> shake = max(shake, if (numOf(amount) * 4 > 0) numOf(amount) * 4 else 10.0)
            "jump" -> { val t = obj(v) ?: e; val a = numOf(amount, 1.0); t.body?.let { it.vy = -(if (a > 50) a else a * 60) } }
            "move by" -> { val t = obj(v) ?: e; val d = nums(amount); t.x += d.getOrElse(0) { 0.0 }; t.y += d.getOrElse(1) { 0.0 } }
            "push" -> { val t = (if (v.isNotEmpty()) obj(v) else other) ?: e; val b = t.ensureBody("dynamic"); val d = nums(amount); b.vx += d.getOrElse(0) { 0.0 }; b.vy += d.getOrElse(1) { 0.0 } }
            "set gravity" -> gravity = numOf(amount)
            "win", "next level" -> win()
            "game over" -> gameOver()
            "message" -> message(v.ifEmpty { "…" }, 2.5)
            "start game" -> if (state != "play") start()
            "restart game" -> { start(); return }
            "pause game" -> paused = !paused
            "resume game" -> paused = false
            "save game" -> if (saveGame(numOf(amount, 1.0).toInt())) message(if (v.isNotEmpty() && v != "Hello!") v else "Game saved", 1.5)
            "load game" -> { if (!loadGame(numOf(amount, 1.0).toInt())) message("No saved game yet", 1.5); return }
            "continue from newest save" -> { if (!loadGame(1)) message("No saved game yet", 1.5); return }
            "delete save" -> { deleteSave(numOf(amount, 1.0).toInt()); message("Save deleted", 1.5) }
            "send message", "send network message" -> send(v)
            "show notification", "phone notification" -> { val parts = v.split("|"); message(if (parts.size > 1) "${parts[0].trim()}: ${parts[1].trim()}" else v, 2.5) }
            "switch camera" -> send("camera:$v")
            "play animation" -> send("play:${e.id}:$v")
            "go to page" -> { val kv = v.split("="); if (kv.size > 1) setVar(kv[0].trim(), kv[1].trim()) else setVar("page", v.trim().ifEmpty { "home" }) }
            else -> send(action) // (sign-in, purchases and the online actions are in the web build; here they're a message other parts can hear)
        }
        val snd = strOf(p["sound"])
        if (snd.isNotEmpty() && snd != "none") sfx(snd)
    }

    // ---- where things are on the screen ----
    /** The rectangle of a HUD object on the screen: its anchor (in its parent's box, or the screen's safe area) plus its offset. */
    fun uiRect(o: GameObject): Rect {
        val k = uiK
        val par = o.parent
        val area = if (par != null && par.ui) uiRect(par) else Rect(safeLeft, safeTop, screen.width - safeRight, screen.height - safeBottom)
        val a = o.anchor
        val fx = if ("left" in a) 0.0 else if ("right" in a) 1.0 else 0.5; val fy = if (a.startsWith("top")) 0.0 else if (a.startsWith("bottom")) 1.0 else 0.5
        var h = o.half
        val wide = o.stretch == "width" || o.stretch == "both"
        if (wide) h = Half(max(1.0, area.width / k - o.margin * 2) / 2, if (o.stretch == "both") max(1.0, area.height / k - o.margin * 2) / 2 else h.h)
        val cx = if (wide) area.center.x + o.x * k else area.left + fx * area.width + o.x * k
        val cy = if (o.stretch == "both") area.center.y + o.y * k else area.top + fy * area.height + o.y * k
        return Rect(Offset(cx.toFloat(), cy.toFloat()) - Offset((h.w * k).toFloat(), (h.h * k).toFloat()), Size((h.w * 2 * k).toFloat(), (h.h * 2 * k).toFloat()))
    }
    fun uiCentre(o: GameObject) = uiRect(o).center
    /** Where an object is on the screen (HUD or world). */
    fun screenOf(o: GameObject) = if (o.ui) uiRect(o).center else toScreen(o.x, o.y)

    /** Is a point (a tap) on this object? */
    fun hits(o: GameObject, t: Tap) = hitsAt(o, t.screen)
    fun hitsAt(o: GameObject, screenAt: Offset): Boolean {
        if (!o.shown || o.dead || (o.ui && !onScreen(o))) return false
        if (o.ui) { val r = uiRect(o).inflate(4f); return if (o.round) (screenAt - r.center).getDistance() <= r.width / 2 else r.contains(screenAt) }
        val at = toWorld(screenAt); val h = o.half; val pad = 6.0
        if (o.round) return hypot(at.x - o.x, at.y - o.y) <= h.w + pad
        return abs(at.x - o.x) <= h.w + pad && abs(at.y - o.y) <= h.h + pad
    }
    /** The taps this frame that landed on an object. */
    fun tapsOn(o: GameObject) = taps.filter { hits(o, it) }
    /** The first new finger this frame on an object. */
    fun downOn(o: GameObject) = downs.firstOrNull { hitsAt(o, it.at) }

    companion object {
        /** Do two objects touch? (circles and boxes; a little slack so a bounce still counts as a hit) */
        fun overlap(a: GameObject, b: GameObject, slack: Double = 1.5): Boolean {
            val ha = a.half; val hb = b.half
            val ax = a.x + (a.body?.ox ?: 0.0); val ay = a.y + (a.body?.oy ?: 0.0); val bx = b.x + (b.body?.ox ?: 0.0); val by = b.y + (b.body?.oy ?: 0.0)
            if (a.round && b.round) return hypot(ax - bx, ay - by) <= ha.w + hb.w + slack
            if (a.round || b.round) {
                val cx = if (a.round) ax else bx; val cy = if (a.round) ay else by; val rx = if (a.round) bx else ax; val ry = if (a.round) by else ay
                val hr = if (a.round) hb else ha; val rad = if (a.round) ha.w else hb.w
                val nx = cx.coerceIn(rx - hr.w, rx + hr.w); val ny = cy.coerceIn(ry - hr.h, ry + hr.h)
                return hypot(cx - nx, cy - ny) <= rad + slack
            }
            return abs(ax - bx) <= ha.w + hb.w + slack && abs(ay - by) <= ha.h + hb.h + slack
        }
        /** How far b is pushed into a (which way, how deep): null if they don't overlap. */
        fun manifold(a: GameObject, b: GameObject): Triple<Double, Double, Double>? {
            val ha = a.half; val hb = b.half
            val ax = a.x + (a.body?.ox ?: 0.0); val ay = a.y + (a.body?.oy ?: 0.0); val bx = b.x + (b.body?.ox ?: 0.0); val by = b.y + (b.body?.oy ?: 0.0)
            if (a.round && b.round) {
                val dx = bx - ax; val dy = by - ay; val d = hypot(dx, dy); val r = ha.w + hb.w
                if (d >= r) return null
                return if (d < 1e-6) Triple(0.0, 1.0, r) else Triple(dx / d, dy / d, r - d)
            }
            if (a.round || b.round) {
                val cx = if (a.round) ax else bx; val cy = if (a.round) ay else by; val rcx = if (a.round) bx else ax; val rcy = if (a.round) by else ay
                val hr = if (a.round) hb else ha; val rad = if (a.round) ha.w else hb.w
                val nx = cx.coerceIn(rcx - hr.w, rcx + hr.w); val ny = cy.coerceIn(rcy - hr.h, rcy + hr.h)
                val dx = cx - nx; val dy = cy - ny; val d = hypot(dx, dy)
                if (d >= rad) return null
                val n1: Double; val n2: Double; val depth: Double
                if (d < 1e-6) { // the centre is inside the box: out along the shallow side
                    val px = hr.w - abs(cx - rcx); val py = hr.h - abs(cy - rcy)
                    if (px < py) { n1 = if (cx < rcx) -1.0 else 1.0; n2 = 0.0; depth = px + rad } else { n1 = 0.0; n2 = if (cy < rcy) -1.0 else 1.0; depth = py + rad }
                } else { n1 = dx / d; n2 = dy / d; depth = rad - d }
                return if (a.round) Triple(-n1, -n2, depth) else Triple(n1, n2, depth) // (from the box to the circle, turned to point from a to b)
            }
            val dx = bx - ax; val dy = by - ay; val px = ha.w + hb.w - abs(dx); val py = ha.h + hb.h - abs(dy)
            if (px <= 0 || py <= 0) return null
            return if (px < py) Triple(if (dx < 0) -1.0 else 1.0, 0.0, px) else Triple(0.0, if (dy < 0) -1.0 else 1.0, py)
        }
    }
    /** Everything touching an object right now (that passes a test). */
    fun touching(e: GameObject, test: (GameObject) -> Boolean) = objects.filter { it !== e && !it.dead && !it.ui && test(it) && overlap(e, it) }

    /** Physics: gravity and speed move dynamic bodies, then they're pushed out of solid ones (landing on the ground, riding platforms). */
    private fun physics(dt: Double) {
        val list = objects.filter { it.body != null && !it.dead && !it.ui }
        for (e in list) {
            val b = e.body!!
            if (!b.isDynamic) { b.dx = if (b.px.isNaN()) 0.0 else e.x - b.px; b.dy = if (b.py.isNaN()) 0.0 else e.y - b.py; continue }
            b.vy += gravity * b.gravityScale * dt
            b.vx += b.fx * dt; b.vy += b.fy * dt; b.fx = 0.0; b.fy = 0.0
            if (b.drag > 0) { val k = max(0.0, 1 - b.drag * dt); b.vx *= k; if (gravity == 0.0 || b.gravityScale == 0.0) b.vy *= k }
            if (b.maxFall > 0 && gravity != 0.0 && b.vy * sign(gravity) > b.maxFall) b.vy = b.maxFall * sign(gravity)
            if (b.maxSpeed > 0) { val v = hypot(b.vx, b.vy); if (v > b.maxSpeed) { b.vx *= b.maxSpeed / v; b.vy *= b.maxSpeed / v } }
            if (b.lockX) b.vx = 0.0
            if (b.lockY) b.vy = 0.0
            e.x += b.vx * dt; e.y += b.vy * dt
            b.wasGrounded = b.grounded; b.grounded = false; b.groundedOn = null; b.landed = 0.0
        }
        val gd = if (gravity == 0.0) 0.0 else sign(gravity)
        for (i in list.indices) for (j in i + 1 until list.size) {
            val a = list[i]; val c = list[j]; val ba = a.body!!; val bc = c.body!!
            if (a.dead || c.dead || ba.sensor || bc.sensor) continue
            if (!ba.isDynamic && !bc.isDynamic) continue
            if (ba.ignore.any { c.has(it) } || bc.ignore.any { a.has(it) }) continue
            val (nx, ny, depth) = manifold(a, c) ?: continue
            // one-way platforms: only solid for something landing on top while falling
            if (ba.oneWay || bc.oneWay) {
                val dynA = ba.isDynamic && !bc.isDynamic
                val dyn = if (dynA) a else if (bc.isDynamic && !ba.isDynamic) c else null ?: continue
                val n = if (dynA) ny else -ny
                if (!(gd != 0.0 && n * gd > 0.5) || dyn.body!!.vy * gd < -0.01 || depth > max(dyn.half.h * 0.5, 0.0001)) continue
            }
            val share = if (ba.isDynamic && bc.isDynamic) 0.5 else 1.0
            if (ba.isDynamic) {
                a.x -= nx * depth * share; a.y -= ny * depth * share
                val vn = ba.vx * nx + ba.vy * ny
                if (vn > 0) { val k = vn * (1 + max(ba.bounce, bc.bounce * 0.5)); ba.vx -= nx * k; ba.vy -= ny * k }
                if (gd != 0.0 && ny * gd > 0.5) {
                    if (!ba.wasGrounded && vn > abs(gravity) * 0.02) ba.landed = max(ba.landed, vn)
                    ba.grounded = true; ba.groundedOn = c
                    if (!bc.isDynamic) { a.x += bc.dx; if (bc.dy * gd < 0) a.y += bc.dy } // ride moving platforms
                    val fr = max(ba.friction, bc.friction); if (fr > 0) ba.vx *= max(0.0, 1 - fr * dt * 10)
                }
            }
            if (bc.isDynamic) {
                c.x += nx * depth * share; c.y += ny * depth * share
                val vn = bc.vx * nx + bc.vy * ny
                if (vn < 0) { val k = vn * (1 + max(bc.bounce, ba.bounce * 0.5)); bc.vx -= nx * k; bc.vy -= ny * k }
                if (gd != 0.0 && ny * gd < -0.5) {
                    if (!bc.wasGrounded && -vn > abs(gravity) * 0.02) bc.landed = max(bc.landed, -vn)
                    bc.grounded = true; bc.groundedOn = a
                    if (!ba.isDynamic) { c.x += ba.dx; if (ba.dy * gd < 0) c.y += ba.dy }
                    val fr = max(ba.friction, bc.friction); if (fr > 0) bc.vx *= max(0.0, 1 - fr * dt * 10)
                }
            }
        }
        for (e in list) { val b = e.body!!; if (!b.isDynamic) { b.px = e.x; b.py = e.y } }
    }

    /** Children follow their parents (position, turn and size); moves made to a child are kept as its new place in the parent. */
    private fun syncHierarchy(only: List<GameObject>? = null) {
        fun depth(e: GameObject): Int { var n = 0; var q = e.parent; while (q != null && n < 50) { n++; q = q.parent }; return n }
        val list = (only ?: objects).filter { it.parent != null }.sortedBy { depth(it) }
        for (e in list) {
            val p = e.parent!!
            if (e.dead) continue
            if (p.dead) { e.destroy(); continue }
            if (e.ui) continue // (HUD children are laid out in their parent's box)
            val lw = e.lastWorld
            if (lw != null && (e.x != lw.first || e.y != lw.second)) { // a component moved it: fold that into its place in the parent
                val a = -p.rz * DEG; val dx = e.x - lw.first; val dy = e.y - lw.second
                e.lx += (dx * cos(a) - dy * sin(a)) / (if (p.sx == 0.0) 1.0 else p.sx)
                e.ly += (dx * sin(a) + dy * cos(a)) / (if (p.sy == 0.0) 1.0 else p.sy)
            }
            val a = p.rz * DEG; val ox = e.lx * p.sx; val oy = e.ly * p.sy
            e.x = p.x + ox * cos(a) - oy * sin(a)
            e.y = p.y + ox * sin(a) + oy * cos(a)
            e.rz = p.rz + e.lrz
            e.lastWorld = e.x to e.y
        }
    }

    // ---- input ----
    /** Joystick, D-pad / arrow buttons and the arrow keys (or WASD) as one direction (x right, y down), at most 1 long. */
    fun axis(): Offset {
        var x = 0.0; var y = 0.0
        stick?.let { st ->
            val r = 50.0 * uiK; val dx = (st.at.x - st.start.x) / r; val dy = (st.at.y - st.start.y) / r; val l = hypot(dx, dy)
            if (l > 0.12) { val m = min(1.0, (l - 0.12) / 0.88); x += dx / l * m; y += dy / l * m }
            val dir = strOf(settings["joystickDirections"], "all")
            if (dir == "horizontal") y = 0.0
            if (dir == "vertical") x = 0.0
        }
        for (a in virtualHeld) { when (a) { "dleft" -> x -= 1; "dright" -> x += 1; "dup" -> y -= 1; "ddown" -> y += 1 } }
        for (b in buttons) { if (b.finger == null) continue; when (b.action) { "dleft" -> x -= 1; "dright" -> x += 1; "dup" -> y -= 1; "ddown" -> y += 1 } }
        fun k(a: Key, b: Key) = a in keys || b in keys
        if (k(Key.DirectionRight, Key.D)) x += 1
        if (k(Key.DirectionLeft, Key.A)) x -= 1
        if (k(Key.DirectionDown, Key.S)) y += 1
        if (k(Key.DirectionUp, Key.W)) y -= 1
        val l = hypot(x, y)
        return if (l > 1) Offset((x / l).toFloat(), (y / l).toFloat()) else Offset(x.toFloat(), y.toFloat())
    }
    fun isDown(action: String): Boolean {
        if (action in virtualHeld) return true
        if (buttons.any { it.action == action && it.finger != null }) return true
        if (action == "jump") return Key.Spacebar in keys || Key.DirectionUp in keys || Key.W in keys
        if (action == "action") return Key.X in keys || Key.F in keys || Key.Enter in keys
        return false
    }
    fun hasButton(action: String) = buttons.any { it.action == action } || objects.any { o -> !o.dead && o.part<TouchKey>()?.let { strOf(it.p["action"], "jump") == (if (action == "action") "fire" else action) } == true }
    /** The screen a HUD object belongs to: its own "Show when", or its nearest parent's (title, play, over, win, paused, always). */
    fun screenOfUi(o: GameObject): String { var q: GameObject? = o; while (q != null) { if (q.showWhen != "always") return q.showWhen; q = q.parent }; return "always" }
    /** Is it on the screen being shown now? */
    fun onScreen(o: GameObject): Boolean {
        if (!o.ui) return state == "play" || state == "title"
        val w = screenOfUi(o)
        if (w == "always") return true
        if (paused) return w == "paused"
        return w == state || (w == "over" && state == "win" && objects.none { it.ui && it.showWhen == "win" })
    }
    /** Can one object see another (no solid object in between)? */
    fun canSee(a: GameObject, b: GameObject): Boolean {
        for (o in objects) {
            if (o === a || o === b || o.dead || o.body?.solid != true) continue
            val h = o.half
            for (i in 1 until 12) { val k = i / 12.0; val px = a.x + (b.x - a.x) * k; val py = a.y + (b.y - a.y) * k; if (abs(px - o.x) <= h.w && abs(py - o.y) <= h.h) return false }
        }
        return true
    }
    /** The engine's on-screen controls: a joystick on one side, jump / fire buttons on the other (or a D-pad / arrows). */
    fun wantJoystick() { if (settings["joystick"] != true) { settings["joystick"] = true; layoutButtons() } }
    fun wantButton(action: String) { val k = if (action == "jump") "jumpButton" else "actionButton"; if (settings[k] != true) { settings[k] = true; layoutButtons() } }
    fun layoutButtons() {
        buttons.clear()
        if (screen.width <= 0f) return
        val r = min(44f, screen.width * 0.11f); val m = 24f; val bottom = screen.height - safeBottom - m - r
        fun bx(off: Float) = screen.width - safeRight - m - r - off
        val jump = settings["jumpButton"] == true
        if (jump) buttons.add(TouchButton("jump", strOf(settings["jumpLabel"], "JUMP"), Offset(bx(0f), bottom), r))
        if (settings["actionButton"] == true) buttons.add(TouchButton("action", strOf(settings["actionLabel"], "FIRE"), Offset(bx(if (jump) r * 2.4f else 0f), bottom - (if (jump) r * 0.9f else 0f)), r))
        val c = settings["controls"]
        fun dx(off: Float) = safeLeft + m + off
        if (c == "arrows") {
            buttons.add(TouchButton("dleft", "◀", Offset(dx(r), bottom), r))
            buttons.add(TouchButton("dright", "▶", Offset(dx(r * 3.4f), bottom), r))
        } else if (c == "dpad") {
            val cx = dx(r * 2.2f); val cy = bottom - r * 1.1f; val dr = r * 0.78f
            buttons.add(TouchButton("dup", "▲", Offset(cx, cy - dr * 1.9f), dr))
            buttons.add(TouchButton("ddown", "▼", Offset(cx, cy + dr * 1.9f), dr))
            buttons.add(TouchButton("dleft", "◀", Offset(cx - dr * 1.9f, cy), dr))
            buttons.add(TouchButton("dright", "▶", Offset(cx + dr * 1.9f, cy), dr))
        }
    }
    private var laidOutFor = Size.Zero

    fun pointerDown(id: Long, at: Offset) {
        val p = Pointer(id, at, at, time)
        pointers[id] = p; downs.add(p)
        finger = at
        if (state != "play" || paused) { taps.add(Tap(at, toWorld(at), id)); return }
        for (b in buttons) {
            if (b.finger == null && (at - b.at).getDistance() <= b.r * 1.25f) { b.finger = id; p.role = "button"; pressed.add(b.action); if (b.action == "jump") pressed.add("btn:jump"); buzz(); return }
        }
        if (tapTargets.any { !it.dead && it.ui && hitsAt(it, at) }) { p.role = "ui"; taps.add(Tap(at, toWorld(at), id)); return }
        val zone = strOf(settings["joystickZone"], "left half")
        if (settings["joystick"] == true && stick == null && (zone == "anywhere" || at.x < screen.width / 2)) { p.role = "stick"; stick = p; return }
        taps.add(Tap(at, toWorld(at), id))
        pressed.add("tap")
        if (!hasButton("jump")) pressed.add("jump") // (no jump button: a tap jumps)
    }
    fun pointerMove(id: Long, at: Offset) {
        val p = pointers[id] ?: return
        if (p.role == "free") dragDelta += at - p.at
        p.at = at; finger = at
    }
    fun pointerUp(id: Long) {
        val p = pointers.remove(id) ?: return
        ups.add(p)
        if (stick === p) stick = null
        for (b in buttons) if (b.finger == id) b.finger = null
        if (pointers.isEmpty()) finger = null
        val d = p.at - p.start
        if (p.role == "free" && time - p.t0 < 0.6 && d.getDistance() > 40) { // a swipe
            pressed.add(if (abs(d.x) > abs(d.y)) (if (d.x < 0) "swipe:left" else "swipe:right") else (if (d.y < 0) "swipe:up" else "swipe:down"))
        }
    }

    /** One step of the game. */
    fun step(dt: Double) {
        if (screen != laidOutFor) { laidOutFor = screen; layoutButtons() }
        for (k in keys) {
            if (k in keysBefore) continue
            if (k == Key.Spacebar || k == Key.DirectionUp || k == Key.W) pressed.add("jump")
            if (k == Key.X || k == Key.F) pressed.add("action")
            if (k == Key.DirectionLeft || k == Key.A) pressed.add("swipe:left")
            if (k == Key.DirectionRight || k == Key.D) pressed.add("swipe:right")
            if (k == Key.DirectionUp || k == Key.W) pressed.add("swipe:up")
            if (k == Key.DirectionDown || k == Key.S) pressed.add("swipe:down")
        }
        keysBefore.clear(); keysBefore.addAll(keys)
        for (i in messages.indices) messages[i] = messages[i].first to messages[i].second - dt
        messages.removeAll { it.second <= 0 }
        val fade = 0.05.pow(dt)
        for (p in particles) { p.vy += p.gravity * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.gravity == 0.0 && p.full < 1) { p.vx *= fade; p.vy *= fade }; p.life -= dt }
        particles.removeAll { it.life <= 0 }
        for (f in floats) { f.at = f.at + Offset(0f, (-50 * dt).toFloat()); f.life -= dt }
        floats.removeAll { it.life <= 0 }
        shake = max(0.0, shake - dt * 40)
        if (state != "play" || paused) { // the title and end screens (and paused): only buttons work
            for (o in objects.toList()) { if (o.dead || !o.shown) continue; o.parts.forEach { if (it.always) it.update(o, dt, this) } }
            endFrame(); return
        }
        time += dt
        for (l in later.toList()) if (l.first <= time) { later.remove(l); l.second() }
        stepTweens(dt)
        for (o in objects.toList()) {
            if (o.dead) continue
            if (o.invuln > 0) o.invuln -= dt
            for (c in o.parts) { if (o.dead || state != "play") break; c.update(o, dt, this) }
        }
        addBorn()
        physics(dt)
        syncHierarchy()
        // touches: each component that cares about something hears it when it starts touching its object
        val now = mutableSetOf<String>()
        for (o in objects.toList()) {
            if (o.dead || o.ui) continue
            for ((ci, c) in o.parts.withIndex()) {
                if (!c.listens) continue
                for (other in objects.toList()) {
                    if (other === o || other.dead || o.dead || other.ui || !c.cares(other) || !overlap(o, other)) continue
                    val key = "${o.uid}:$ci:${other.uid}"
                    now.add(key)
                    if (key !in contacts) c.touch(o, other, this)
                }
            }
        }
        contacts.clear(); contacts.addAll(now)
        objects.forEach { o -> o.part<Bounce>()?.collide(o, this) } // (balls bounce off solid objects: paddles, bricks, walls)
        for (o in objects.toList()) if (o.dead) o.parts.forEach { it.gone(o, this) }
        for (o in objects) if (!o.dead && o.parent?.dead == true) o.destroy()
        objects.removeAll { it.dead }
        addBorn()
        tapTargets.removeAll { it.dead }
        if (numOf(settings["winScore"]) > 0 && numVar("score") >= numOf(settings["winScore"])) win()
        if (numOf(settings["timeLimit"]) > 0 && state == "play") {
            vars["time"] = max(0.0, numVar("time") - dt)
            if (numVar("time") <= 0) { message("Time's up!", 3.0); gameOver() }
        }
        if (settings["saveProgress"] == true && floor(time * 2) != floor((time - dt) * 2)) store("pocket.save.$saveKey", toJsonValue(vars).toString())
        endFrame()
    }
    private fun endFrame() { taps.clear(); downs.clear(); ups.clear(); pressed.clear(); dragDelta = Offset.Zero; frame++ }
    private fun stepTweens(dt: Double) {
        for (t in tweens.toList()) {
            if (t.o.dead) { tweens.remove(t); continue }
            if (t.delay > 0) { t.delay -= dt; continue }
            t.t += dt
            var k = (t.t / t.seconds).coerceIn(0.0, 1.0)
            if (t.yoyo) k = if (k < 0.5) k * 2 else (1 - k) * 2
            t.o.setField(t.field, t.from + (t.to - t.from) * ease(t.curve, k))
            if (t.t >= t.seconds) { tweens.remove(t); t.done?.invoke() }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Components (the same names and settings as in Pocket Engine)
// ---------------------------------------------------------------------------------------------------------------

/** The component for a type, with its settings (and the engine's defaults); null: no native version yet. */
fun makeComponent(type: String, p: JsonMap): Component? = when (type) {
    "move" -> Move(p); "platformer" -> Platformer(p); "controller2d" -> Controller2D(p); "timeScore" -> TimeScore(p); "spawner" -> Spawner(p)
    "velocity" -> Velocity(p); "rotate" -> Rotate(p); "hazard" -> Hazard(p); "destroyOffscreen" -> DestroyOffscreen(p); "collectible" -> Collectible(p)
    "tappable" -> Tappable(p); "pulse" -> Pulse(p); "lifetime" -> Lifetime(p); "income" -> Income(p); "upgrade" -> Upgrade(p); "shooter" -> Shooter(p)
    "projectile" -> Projectile(p); "destructible" -> Destructible(p); "bounce" -> Bounce(p); "camera" -> CameraRig(p); "cameraFollow" -> CameraFollow(p)
    "cameraImpulse" -> CameraImpulse(p); "cameraControls" -> CameraControls(p); "patrol" -> Patrol(p); "goal" -> Goal(p); "spring" -> Spring(p)
    "wrap" -> Wrap(p); "chase" -> Chase(p); "float" -> FloatUpDown(p); "message" -> MessageZone(p); "teleport" -> Teleport(p); "unlock" -> Unlock(p)
    "sound" -> SoundZone(p); "draggable" -> Draggable(p); "swipeMove" -> SwipeLanes(p); "orbit" -> Orbit(p); "checkpoint" -> Checkpoint(p)
    "follow" -> Follow(p); "wander" -> Wander(p); "path" -> PathMove(p); "turret" -> Turret(p); "dropItem" -> DropItem(p); "emitter" -> Emitter(p)
    "particles" -> Particles(p); "blink" -> Blink(p); "forceZone" -> ForceZone(p); "touchButton" -> TouchKey(p); "button" -> ButtonPart(p)
    "clickPopup" -> ClickPopup(p); "comboClicker" -> ComboClicker(p); "longPress" -> LongPress(p); "doubleTap" -> DoubleTap(p); "tapToggle" -> TapToggle(p)
    "pressFeedback" -> PressFeedback(p); "tapToSpawn" -> TapToSpawn(p); "dragLaunch" -> DragLaunch(p); "trigger" -> TriggerZone(p); "timer" -> TimerPart(p)
    "condition" -> Condition(p); "waveSpawner" -> WaveSpawner(p); "dayNight" -> DayNight(p); "typewriter" -> Typewriter(p); "health" -> Health(p)
    "damager" -> Damager(p); "hunger" -> Need(p, "hunger", Color(0xFFFFA63D)); "thirst" -> Need(p, "thirst", Color(0xFF4DB8FF)); "car" -> Car(p)
    "savePoint" -> SavePoint(p); "autoSave" -> AutoSave(p); "saveManager" -> SaveManager(p); "joint" -> Joint(p); "navigator" -> Navigator(p)
    "enemyAI" -> EnemyAI(p); "loader" -> Loader(p)
    else -> null
}

/** Its speed, slowed by status effects (Health's freeze / slow) and hunger. */
fun slowed(e: GameObject, speed: Double) = speed * numOf(e.data["slow"], 1.0)

/** Faces the way it moves: emoji flip, sprites and shapes mirror. */
fun faceX(e: GameObject, vx: Double) {
    if (abs(vx) < 1e-3) return
    if (e.shape?.get("type") == "emoji") e.data["flipX"] = vx > 0 else if (e.sprite != null) e.sx = abs(e.sx) * (if (vx < 0) -1 else 1)
}
private fun keepIn(e: GameObject, g: PocketGame) {
    val v = g.viewBounds; val h = e.half
    e.x = e.x.coerceIn(v.left + h.w, max(v.left + h.w, v.right - h.w))
    e.y = e.y.coerceIn(v.top + h.h, max(v.top + h.h, v.bottom - h.h))
}
private fun dist(ax: Double, ay: Double, bx: Double, by: Double) = hypot(bx - ax, by - ay)

/** Move: arrow keys / WASD, the joystick, and dragging on the screen (the object follows the finger's movement). */
class Move(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val speed = slowed(e, n("speed", 260.0)); val axes = s("axes", "all"); val control = s("control", "both")
        var a = if (control == "drag") Offset.Zero else g.axis()
        if (axes == "vertical") a = Offset(0f, a.y)
        if (axes == "horizontal") a = Offset(a.x, 0f)
        val b = e.body
        if (b != null && b.isDynamic && g.gravity != 0.0 && b.gravityScale != 0.0) b.vx = a.x * speed // (with gravity: left and right only)
        else { e.x += a.x * speed * dt; e.y += a.y * speed * dt }
        if (control == "drag" || control == "both") { // the finger's movement, a little faster (the engine's drag speed 1.2)
            val k = n("dragSpeed", 1.2) / g.zoom
            if (axes != "vertical") e.x += g.dragDelta.x * k
            if (axes != "horizontal") e.y += g.dragDelta.y * k
        }
        if (s("face2D") == "flip") faceX(e, a.x.toDouble())
        if (s("face2D") == "rotate" && a.getDistance() > 0.1f) e.rz = atan2(a.y.toDouble(), a.x.toDouble()) / DEG + 90
        if (p["keepInView"] != false) keepIn(e, g)
    }
}

/** Platformer: run and jump with gravity (the joystick or arrows, and the jump button, a tap or space). */
class Platformer(p: JsonMap) : Component(p) {
    private var coyote = 0.0; private var jumps = 0; private var rising = false
    override fun start(e: GameObject, g: PocketGame) {
        e.ensureBody("dynamic")
        if (g.gravity == 0.0) g.gravity = 1600.0
        if (g.settings["controls"] == null) g.wantJoystick()
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val a = g.axis(); val b = e.ensureBody("dynamic"); val speed = slowed(e, n("speed", 240.0)); val accel = n("accel")
        val ctl = if (b.grounded) 1.0 else n("airControl", 1.0).coerceIn(0.0, 1.0)
        val want = a.x * speed
        b.vx = if (accel > 0) b.vx + (want - b.vx).coerceIn(-accel * ctl * dt, accel * ctl * dt) else b.vx + (want - b.vx) * ctl
        if (b.grounded) { coyote = 0.12; jumps = 0 } else coyote -= dt
        if ("jump" in g.pressed && (coyote > 0 || (on("doubleJump") && jumps < 2))) {
            b.vy = -n("jump", 620.0); coyote = 0.0; jumps = if (jumps == 0) 1 else jumps + 1; rising = true
            g.sfx("jump")
        }
        if (rising && p["variableJump"] != false && g.hasButton("jump") && !g.isDown("jump") && b.vy < 0) { b.vy *= 0.5; rising = false } // let go early: a short hop
        if (b.vy >= 0) rising = false
        if (p["faceDirection"] != false) faceX(e, a.x.toDouble())
        if (e.y > g.viewH + 600) g.hurt(e, s("onFall", "respawn"))
    }
}

/** Character Controller 2D: one of many ways to move (top-down, side to side, platformer, runner, flappy, car, spaceship, tank, tap to move, follow the finger). */
class Controller2D(p: JsonMap) : Component(p) {
    private val mode = s("mode", "topdown8")
    private val inner: Component? = when (mode) {
        "topdown8" -> Move(mapOf("speed" to (p["speed"] ?: 240.0), "control" to "both", "axes" to "all", "keepInView" to (p["keepInView"] ?: true)))
        "sideToSide" -> Move(mapOf("speed" to (p["speed"] ?: 240.0), "control" to "both", "axes" to "horizontal", "keepInView" to (p["keepInView"] ?: true)))
        "platformer" -> Platformer(mapOf("speed" to (p["speed"] ?: 240.0), "jump" to (p["jump"] ?: 620.0), "onFall" to (p["onFall"] ?: "respawn")))
        "grid" -> GridStep(mapOf("tile" to (p["tile"] ?: 40.0)))
        else -> null
    }
    private var heading = 0.0; private var speed = 0.0; private var target: Offset? = null
    override fun start(e: GameObject, g: PocketGame) {
        inner?.let { if (mode != "grid") g.wantJoystick(); if (mode == "platformer") g.wantButton("jump"); it.start(e, g); return }
        val gravity = mode == "runner" || mode == "flappy"
        val b = e.ensureBody("dynamic")
        b.gravityScale = if (gravity) 1.0 else 0.0
        if (gravity && g.gravity == 0.0) g.gravity = 1600.0
        heading = e.rz * DEG
        if (e.data["respawn"] == null) e.data["respawn"] = Offset(e.x.toFloat(), e.y.toFloat())
        if (mode in listOf("topdown4", "car", "spaceship", "tank")) g.wantJoystick()
        if (mode == "runner") g.wantButton("jump")
    }
    private fun keep(e: GameObject, g: PocketGame) { if (p["keepInView"] != false) keepIn(e, g) }
    private fun face(e: GameObject, vx: Double, vy: Double) { if (on("faceMove") && hypot(vx, vy) > 5) e.rz = atan2(vy, vx) / DEG }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        inner?.let { it.update(e, dt, g); return }
        val a = g.axis(); val ax = a.x.toDouble(); val ay = a.y.toDouble(); val b = e.ensureBody("dynamic"); val sp = slowed(e, n("speed", 240.0)); val damp = max(0.0, 1 - n("friction", 2.0) * dt)
        val turn = n("turn", 200.0) * DEG; val accel = n("accel", 600.0)
        val jumpNow = "tap" in g.pressed || "btn:jump" in g.pressed || "jump" in g.pressed
        when (mode) {
            "topdown4" -> {
                var x = ax; var y = ay
                if (abs(x) > abs(y)) y = 0.0 else x = 0.0
                b.vx = sign(x) * (if (abs(x) > 0.3) sp else 0.0); b.vy = sign(y) * (if (abs(y) > 0.3) sp else 0.0)
                face(e, b.vx, b.vy); keep(e, g)
            }
            "runner" -> {
                b.vx = sp
                if ((jumpNow || "swipe:up" in g.pressed) && b.grounded) { b.vy = -n("jump", 620.0); g.sfx("jump") }
                if (e.y > g.viewBounds.bottom + 300) g.hurt(e, s("onFall", "respawn"))
            }
            "flappy" -> {
                if (jumpNow) { b.vy = -n("jump", 620.0) * 0.6; g.sfx("jump") }
                e.rz = (b.vy / 12).coerceIn(-30.0, 70.0)
                if (p["keepInView"] != false && e.y < g.viewBounds.top) { e.y = g.viewBounds.top; b.vy = 0.0 }
                if (e.y > g.viewBounds.bottom + 300) g.hurt(e, s("onFall", "respawn"))
            }
            "car" -> {
                val thr = if (on("autoDrive")) 1.0 else max(0.0, -ay) + (if (ay > 0.3) -0.5 else 0.0)
                speed = (speed * damp + thr * accel * dt).coerceIn(-sp * 0.4, sp)
                heading += ax * turn * dt * (abs(speed) / (sp * 0.3)).coerceIn(0.0, 1.0) * (if (speed == 0.0) 1.0 else sign(speed))
                b.vx = cos(heading) * speed; b.vy = sin(heading) * speed; e.rz = heading / DEG
            }
            "spaceship" -> {
                heading += ax * turn * dt
                val thrust = max(0.0, -ay) + (if (g.pointers.values.any { it.role == "free" }) 1.0 else 0.0)
                b.vx = b.vx * damp + cos(heading) * thrust * accel * dt; b.vy = b.vy * damp + sin(heading) * thrust * accel * dt
                val v = hypot(b.vx, b.vy)
                if (v > sp) { b.vx *= sp / v; b.vy *= sp / v }
                e.rz = heading / DEG
                if (p["keepInView"] != false) { val vb = g.viewBounds; if (e.x < vb.left) e.x = vb.right else if (e.x > vb.right) e.x = vb.left; if (e.y < vb.top) e.y = vb.bottom else if (e.y > vb.bottom) e.y = vb.top }
            }
            "tank" -> { heading += ax * turn * dt; val fwd = -ay * sp; b.vx = cos(heading) * fwd; b.vy = sin(heading) * fwd; e.rz = heading / DEG }
            "tapToMove" -> {
                val t = g.taps.firstOrNull()?.world ?: g.pointers.values.firstOrNull { it.role == "free" }?.let { g.toWorld(it.at) }
                if (t != null) target = t
                target?.let { tg ->
                    val dx = tg.x - e.x; val dy = tg.y - e.y; val d = hypot(dx, dy)
                    if (d < 4) { b.vx = 0.0; b.vy = 0.0; target = null } else { val v = min(sp, d / max(dt, 1e-3)); b.vx = dx / d * v; b.vy = dy / d * v; face(e, dx, dy) }
                }
            }
            "followFinger" -> {
                val f = g.pointers.values.firstOrNull { it.role == "free" }
                if (f != null) { val w = g.toWorld(f.at); val k = min(1.0, dt * (sp / 20)); b.vx = (w.x - e.x) * k / max(dt, 1e-3); b.vy = (w.y - e.y) * k / max(dt, 1e-3) } else { b.vx = 0.0; b.vy = 0.0 }
                keep(e, g)
            }
        }
    }
}

/** Grid steps: moves one tile at a time (arrow keys, joystick, or swipes). */
class GridStep(p: JsonMap) : Component(p) {
    private var t = 0.0; private var to: Pair<Double, Double>? = null; private var from = 0.0 to 0.0
    override fun start(e: GameObject, g: PocketGame) { val s = n("tile", 40.0); e.x = (e.x / s).roundToInt() * s; e.y = (e.y / s).roundToInt() * s }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val s = n("tile", 40.0); val step = n("stepTime", 0.14)
        to?.let { dest ->
            t += dt
            val k = (t / step).coerceIn(0.0, 1.0)
            e.x = from.first + (dest.first - from.first) * k; e.y = from.second + (dest.second - from.second) * k
            if (k >= 1) to = null
            return
        }
        var ax = g.axis().x.toDouble(); var ay = g.axis().y.toDouble()
        if ("swipe:left" in g.pressed) { ax = -1.0; ay = 0.0 }
        if ("swipe:right" in g.pressed) { ax = 1.0; ay = 0.0 }
        if ("swipe:up" in g.pressed) { ax = 0.0; ay = -1.0 }
        if ("swipe:down" in g.pressed) { ax = 0.0; ay = 1.0 }
        if (hypot(ax, ay) < 0.4) return
        val dx = if (abs(ax) > abs(ay)) sign(ax) else 0.0; val dy = if (dx == 0.0) sign(ay) else 0.0
        val nx = e.x + dx * s; val ny = e.y + dy * s
        if (g.objects.any { it !== e && !it.dead && it.body?.solid == true && abs(it.x - nx) < s * 0.5 + it.half.w - 2 && abs(it.y - ny) < s * 0.5 + it.half.h - 2 }) return // a wall
        from = e.x to e.y; to = nx to ny; t = 0.0
        faceX(e, dx)
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
        val rel = p["relative"] == true; val snap = n("snap")
        fun sn(v: Double) = if (snap > 0) (v / snap).roundToInt() * snap else v
        val x = (if (rel) e.x else 0.0) + sn(pick(p["x"] ?: listOf(20.0, 380.0)))
        val y = (if (rel) e.y else 0.0) + pick(p["y"] ?: -40.0)
        val clear = n("clear")
        if (clear > 0 && g.objects.any { !it.dead && it.data["spawned"] == true && abs(it.x - x) < clear && abs(it.y - y) < clear }) return
        val c = g.spawn(s("template"), x, y) ?: return
        c.data["speedMul"] = min(3.0, mul); alive.add(c)
    }
}

/** Velocity: a steady speed (a range gives each copy its own). */
class Velocity(p: JsonMap) : Component(p) {
    private var vx = 0.0; private var vy = 0.0
    override fun start(e: GameObject, g: PocketGame) { val m = numOf(e.data["speedMul"], 1.0); vx = pick(p["vx"]) * m; vy = pick(p["vy"] ?: 200.0) * m }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val b = e.body
        if (b != null && b.isDynamic) { b.vx = vx; if (g.gravity == 0.0 || b.gravityScale == 0.0) b.vy = vy; return }
        e.x += vx * dt; e.y += vy * dt
    }
}

/** Rotate: spins. */
class Rotate(p: JsonMap) : Component(p) { override fun update(e: GameObject, dt: Double, g: PocketGame) { if (s("axis", "z") == "z") e.rz += n("speed", 90.0) * dt } }

/** Hazard: hurts the player on touch (game over, lose a life, or back to the start). */
class Hazard(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (other.dead || g.state != "play" || other.invuln > 0 || e.data["blinkOff"] == true) return
        val hb = other.part<Health>()
        if (hb != null) { hb.damage(other, g, 1.0, from = e); if (p["destroySelf"] == true) e.destroy(); return }
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
        g.sfx(s("sound", "coin"))
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFFD23D), 14, 0.8)
        e.destroy()
    }
}

/** Tap Target: tap it to score (it pops, or bounces when it stays). */
class Tappable(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        for (t in g.taps) {
            if (e.dead || !g.hits(e, t)) continue
            val bonus = if (s("bonusVar").isEmpty()) 0.0 else g.numVar(s("bonusVar"))
            g.addVar(s("var", "score"), n("points", 10.0) + bonus)
            g.sfx(s("sound", "coin"))
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
        if (e.ui) g.tapTargets.add(e)
        for (t in g.taps) {
            if (!g.hits(e, t)) continue
            val cost = numOf(e.data["cost"]); val costVar = s("costVar", "score"); val have = g.numVar(costVar)
            if (have < cost) { g.buzz(); g.message("Need ${formatNumber(cost - have)} more", 1.0); continue }
            g.addVar(costVar, -cost)
            g.addVar(s("addVar", "perSecond"), n("amount", 1.0))
            e.data["owned"] = numOf(e.data["owned"]) + 1
            e.data["cost"] = ceil(cost * n("growth", 1.15))
            e.data["pop"] = 0.18
            g.sfx("power")
        }
    }
}

/** Shooter: fires copies of a template (automatically, on a tap, or with the fire button). */
class Shooter(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun start(e: GameObject, g: PocketGame) { if (s("trigger") == "action button") g.wantButton("action") }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        t -= dt
        if (t > 0) return
        val trigger = s("trigger", "auto")
        if (trigger == "tap" && g.taps.isEmpty()) return
        if (trigger == "action button" && !g.isDown("action")) return
        t = n("every", 0.25)
        g.spawn(s("template"), e.x, e.y, e.rz)
    }
}

/** Projectile: flies straight the way it faces, for a while. */
class Projectile(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val a = e.rz * DEG; val sp = n("speed", 650.0)
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
        if (hp > 0) { g.sfx("hit"); return }
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
        val vb = g.viewBounds; val r = e.half.w
        if (e.x < vb.left + r) { e.x = vb.left + r; vx = abs(vx) }
        if (e.x > vb.right - r) { e.x = vb.right - r; vx = -abs(vx) }
        if (e.y < vb.top + r) { e.y = vb.top + r; vy = abs(vy) }
        if (e.y > vb.bottom - r) {
            if (s("bottom", "lose a life") == "bounce") { e.y = vb.bottom - r; vy = -abs(vy) }
            else {
                val lives = if (g.vars.containsKey("lives")) g.numVar("lives") else 1.0
                g.buzz(true)
                if (lives <= 1) { g.setVar("lives", 0.0); g.gameOver(); return }
                g.addVar("lives", -1.0); e.x = hx; e.y = hy; launch(); return
            }
        }
    }
    /** Push out of solid objects it overlaps and turn around (along the shallower side). */
    fun collide(e: GameObject, g: PocketGame) {
        val r = e.half.w
        for (o in g.objects) {
            if (o === e || o.dead || o.body?.solid != true || !PocketGame.overlap(e, o, 0.0)) continue
            val h = o.half; val dx = e.x - o.x; val dy = e.y - o.y; val px = h.w + r - abs(dx); val py = h.h + r - abs(dy)
            if (px < py) { e.x += if (dx < 0) -px else px; vx = if (dx < 0) -abs(vx) else abs(vx) }
            else {
                e.y += if (dy < 0) -py else py; vy = if (dy < 0) -abs(vy) else abs(vy)
                if (o.part<Move>() != null) vx = (dx / (h.w + r)).coerceIn(-1.0, 1.0) * speed * 0.75 // (a paddle: where it hits steers the ball)
            }
        }
        if (abs(vy) < speed * 0.3) vy = (if (vy < 0) -1 else 1) * speed * 0.3 // never stuck going flat
        val l = hypot(vx, vy); if (l > 0) { vx = vx / l * speed; vy = vy / l * speed }
    }
}

// ---- cameras ----

/** Camera: fixed, or following its target (follow, side scroller, top down) smoothly, with an offset and a zoom.
 *  Several cameras: the one switched to ("switch camera" action, a Camera Zone or Switcher) drives the view. */
class CameraRig(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) {
        g.on { m -> if (m == "camera:${e.name}" || m == "camera:${e.id}") g.activeCamera = e }
        val cur = g.activeCamera
        if (cur == null || n("priority") > numOf(cur.data["priority"])) g.activeCamera = e
        e.data["priority"] = n("priority")
        if (g.activeCamera === e) { g.camZoom = n("zoom", 1.0).coerceIn(0.1, 10.0); aim(e, g, 1.0) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (g.activeCamera != null && g.activeCamera !== e) return
        val z = numOf(e.data["camZoom"], n("zoom", 1.0)).coerceIn(0.1, 10.0)
        g.camZoom += (z - g.camZoom) * min(1.0, dt * 8)
        aim(e, g, 1 - exp(-n("smooth", 6.0) * dt))
    }
    private fun aim(e: GameObject, g: PocketGame, k: Double) {
        val mode = s("mode", "follow")
        if (mode == "fixed") { g.camX += (e.x - g.camX) * k; g.camY += (e.y - g.camY) * k; return }
        val tag = s("target", "player")
        val t = g.objects.firstOrNull { !it.dead && it.has(tag) } ?: return
        val wantX = t.x + n("ox"); val wantY = if (mode == "side scroller") g.viewH / 2 + n("oy") else t.y + n("oy")
        g.camX += (wantX - g.camX) * k; g.camY += (wantY - g.camY) * k
    }
}

/** Camera follow: the view follows this object smoothly (both ways, or only across / up and down). */
class CameraFollow(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { val ax = s("axes", "both"); if (ax != "y") g.camX = e.x + n("ox"); if (ax != "x") g.camY = e.y + n("oy") }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val ax = s("axes", "both"); val k = 1 - exp(-n("smooth", 6.0) * dt)
        if (ax != "y") g.camX += (e.x + n("ox") - g.camX) * k
        if (ax != "x") g.camY += (e.y + n("oy") - g.camY) * k
    }
}

/** Camera Impulse: shakes the view when it starts, lands, hits something, every few seconds, on a message or when destroyed. */
class CameraImpulse(p: JsonMap) : Toucher(p) {
    private var t = 0.0; private var wasGround = true
    private val whenIt get() = s("when", "it hits something")
    fun fire(e: GameObject, g: PocketGame) {
        val r = n("range"); val d = dist(e.x, e.y, g.camX, g.camY)
        val a = n("strength", 10.0) * (if (r > 0) (1 - d / r).coerceIn(0.0, 1.0) else 1.0)
        if (a <= 0.2) return
        g.shake = max(g.shake, a)
        if (p["vibrate"] != false) g.buzz(a > 12)
    }
    override fun cares(other: GameObject) = whenIt == "it hits something" && other.body != null && other.body?.sensor != true
    override fun start(e: GameObject, g: PocketGame) {
        if (whenIt == "it starts") fire(e, g)
        if (whenIt == "a message arrives") g.on { m -> if (!e.dead && m == s("message", "boom")) fire(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (whenIt == "every few seconds") { t += dt; if (t >= max(0.1, n("every", 3.0))) { t = 0.0; fire(e, g) } }
        val b = e.body
        if (whenIt == "it lands" && b != null) { if (b.landed > 0 || (b.grounded && !wasGround)) { if ((if (b.landed > 0) b.landed else abs(b.vy)) >= n("minSpeed")) fire(e, g) }; wasGround = b.grounded }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { val b = e.body; val sp = if (b == null) 0.0 else hypot(b.vx, b.vy); if (sp >= n("minSpeed")) fire(e, g) }
    override fun gone(e: GameObject, g: PocketGame) { if (whenIt == "it is destroyed") fire(e, g) }
}

/** Camera Controls: drag to pan the view, pinch to zoom, double-tap to go back. */
class CameraControls(p: JsonMap) : Component(p) {
    private var hx = 0.0; private var hy = 0.0; private var vx = 0.0; private var vy = 0.0
    private var lastPinch = 0.0; private var lastTap = -9.0; private var zoom = 1.0
    override fun start(e: GameObject, g: PocketGame) { hx = g.camX; hy = g.camY; zoom = g.camZoom }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val free = g.pointers.values.filter { it.role == "free" }
        val lo = min(n("minZoom", 0.5), n("maxZoom", 3.0)); val hi = max(n("minZoom", 0.5), n("maxZoom", 3.0))
        if (p["zoom"] != false && free.size >= 2) {
            val d = (free[0].at - free[1].at).getDistance().toDouble()
            if (lastPinch > 0) zoom = (zoom * d / lastPinch).coerceIn(lo, hi)
            lastPinch = d; vx = 0.0; vy = 0.0; g.camZoom = zoom; return
        }
        lastPinch = 0.0
        if (p["reset"] != false) for (tp in g.taps) { if (g.time - lastTap < 0.35) { g.camX = hx; g.camY = hy; zoom = 1.0; g.camZoom = 1.0; vx = 0.0; vy = 0.0; lastTap = -9.0 } else lastTap = g.time }
        if (p["pan"] != false && free.size == 1) { vx = -g.dragDelta.x / g.zoom / max(dt, 1e-3); vy = -g.dragDelta.y / g.zoom / max(dt, 1e-3); g.camX += vx * dt; g.camY += vy * dt }
        else if (p["glide"] != false && (vx != 0.0 || vy != 0.0)) { val k = exp(-5 * dt); vx *= k; vy *= k; if (hypot(vx, vy) < 2) { vx = 0.0; vy = 0.0 }; g.camX += vx * dt; g.camY += vy * dt }
        val l = n("limit")
        if (l > 0) { g.camX = g.camX.coerceIn(hx - l, hx + l); g.camY = g.camY.coerceIn(hy - l, hy + l) }
        g.camZoom = zoom
    }
}

// ---- movement ----

/** Patrol: back and forth by an amount, easing at the ends. */
class Patrol(p: JsonMap) : Component(p) {
    private var t = 0.0; private var ox = 0.0; private var oy = 0.0
    override fun start(e: GameObject, g: PocketGame) { ox = e.x; oy = e.y }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        t += dt
        val k = 0.5 - 0.5 * cos(t / max(0.1, n("duration", 2.0)) * PI)
        e.x = ox + n("dx", 120.0) * k; e.y = oy + n("dy") * k
    }
}

/** Goal: the player touching it wins the level. */
class Goal(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { g.burst(e.x, e.y, Color(0xFF5DFF8A), 40, 1.2); g.win() }
}

/** Spring: bounces the player up. */
class Spring(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { val b = other.body ?: return; b.vy = -n("power", 900.0); g.sfx("jump"); e.data["pop"] = 0.2 }
}

/** Screen wrap: leaving one edge brings it back on the other. */
class Wrap(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val v = g.viewBounds
        if (e.x < v.left) e.x += v.width else if (e.x > v.right) e.x -= v.width
        if (e.y < v.top) e.y += v.height else if (e.y > v.bottom) e.y -= v.height
    }
}

/** Chase: moves toward the nearest object with a tag, when it's in range. */
class Chase(p: JsonMap) : Component(p) {
    private var target: GameObject? = null
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (target?.dead != false) target = g.findAll(s("tag", "player")).firstOrNull { it !== e }
        val t = target ?: return
        val dx = t.x - e.x; val dy = t.y - e.y; val d = hypot(dx, dy); val range = n("range", 320.0)
        if (d < 1e-3 || (range > 0 && d > range)) return
        val k = min(d, slowed(e, n("speed", 110.0)) * dt) / d
        e.x += dx * k; e.y += dy * k
        faceX(e, dx)
    }
}

/** Float: bobs up and down. */
class FloatUpDown(p: JsonMap) : Component(p) {
    private var t = Random.nextDouble() * 10; private var base = 0.0
    override fun start(e: GameObject, g: PocketGame) { base = e.y }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { t += dt; e.y = base - sin(t / max(0.1, n("period", 1.6)) * PI * 2) * n("amount", 8.0) }
}

/** Message: shows a message when the player touches it (once, or every time). */
class MessageZone(p: JsonMap) : Component(p) {
    private var shown = false
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (p["once"] != false && shown) return
        shown = true; g.message(s("text", "Hello there!"), n("seconds", 3.0)); g.sfx("click")
    }
}

/** Teleport: sends the player to another object. */
class Teleport(p: JsonMap) : Component(p) {
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (numOf(other.data["tpUntil"]) > g.time) return
        val dest = g.find(s("target")) ?: return
        if (dest === e) return
        val purple = Color(0xFFA77BFF)
        g.burst(other.x, other.y, purple, 16)
        other.x = dest.x; other.y = dest.y; other.body?.let { it.vx = 0.0; it.vy = 0.0 }
        other.data["tpUntil"] = g.time + 0.8
        g.burst(dest.x, dest.y, purple, 16)
        g.sfx("power")
    }
}

/** Unlock: disappears (a door, a gate) once a variable reaches an amount. */
class Unlock(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (g.numVar(s("var", "keys")) < n("amount", 1.0)) return
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color.White, 30, 1.2)
        if (s("text").isNotEmpty()) g.message(s("text"), 2.0)
        g.sfx("power")
        e.destroy()
    }
}

/** Sound: plays a sound when it starts or when touched. */
class SoundZone(p: JsonMap) : Component(p) {
    override val wants get() = if (s("when", "touched") == "touched") s("tag", "player") else null
    override fun start(e: GameObject, g: PocketGame) { if (p["when"] == "start") g.sfx(s("sound", "power")) }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) = g.sfx(s("sound", "power"))
}

/** Draggable: pick it up with a finger and put it down (snapping to a grid). */
class Draggable(p: JsonMap) : Component(p) {
    private var grab: Long? = null; private var ox = 0.0; private var oy = 0.0; private var bx = 1.0; private var by = 1.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (grab == null) {
            val d = g.downOn(e) ?: return
            val w = g.toWorld(d.at)
            grab = d.id; ox = e.x - w.x; oy = e.y - w.y; bx = e.sx; by = e.sy
            d.role = "drag"
            if (p["lift"] != false) { e.sx *= 1.12; e.sy *= 1.12 }
            g.buzz()
        }
        val ptr = g.pointers[grab]
        if (ptr == null) {
            val s = n("snap")
            if (s > 0) { e.x = (e.x / s).roundToInt() * s; e.y = (e.y / s).roundToInt() * s }
            e.sx = bx; e.sy = by; grab = null
            return
        }
        val w = g.toWorld(ptr.at)
        e.x = w.x + ox; e.y = w.y + oy
        e.body?.let { it.vx = 0.0; it.vy = 0.0 }
    }
}

/** Swipe Lanes: swipe left and right to change lanes (and up to jump). */
class SwipeLanes(p: JsonMap) : Component(p) {
    private var lane = 0; private var home = 0.0
    override fun start(e: GameObject, g: PocketGame) {
        home = e.x
        val b = e.ensureBody("dynamic"); val jump = n("jump")
        if (jump <= 0) b.gravityScale = 0.0
        if (jump > 0 && g.gravity == 0.0) g.gravity = 1600.0
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val mx = floor((n("lanes", 3.0) - 1) / 2).toInt()
        if ("swipe:left" in g.pressed) lane = max(-mx, lane - 1)
        if ("swipe:right" in g.pressed) lane = min(mx, lane + 1)
        val jump = n("jump"); val b = e.body
        if (jump > 0 && b != null && b.grounded && "swipe:up" in g.pressed) { b.vy = -jump; g.sfx("jump") }
        e.x += (home + lane * n("distance", 110.0) - e.x) * min(1.0, dt * 14)
    }
}

/** Orbit: circles around where it started. */
class Orbit(p: JsonMap) : Component(p) {
    private var cx = 0.0; private var cy = 0.0; private var a = 0.0
    override fun start(e: GameObject, g: PocketGame) { cx = e.x; cy = e.y }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        a += n("speed", 90.0) * dt * DEG
        e.x = cx + cos(a) * n("radius", 80.0); e.y = cy + sin(a) * n("radius", 80.0)
    }
}

/** Checkpoint: the player comes back here after a fall or a hit. */
class Checkpoint(p: JsonMap) : Component(p) {
    private var hit = false
    override val wants get() = s("tag", "player")
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (hit) return
        hit = true
        other.data["respawn"] = Offset(e.x.toFloat(), (e.y - 20).toFloat()); other.data["respawnOnHit"] = true
        e.shape?.set("fill", "#5dff8a")
        if (s("text").isNotEmpty()) g.message(s("text"), 1.5)
        g.sfx("power")
        g.burst(e.x, e.y, Color(0xFF5DFF8A), 18)
    }
}

/** Follow: keeps near another object (a pet, a sidekick). */
class Follow(p: JsonMap) : Component(p) {
    private var t: GameObject? = null
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (t?.dead != false) t = g.find(s("target", "player"))
        val o = t ?: return
        if (o === e) return
        val dx = o.x - e.x; val dy = o.y - e.y; val d = hypot(dx, dy); val dd = n("distance", 60.0)
        if (d <= dd) return
        val k = min(d - dd, slowed(e, n("speed", 200.0)) * dt) / d
        e.x += dx * k; e.y += dy * k
        faceX(e, dx)
    }
}

/** Wander: walks about at random near where it started. */
class Wander(p: JsonMap) : Component(p) {
    private var hx = 0.0; private var hy = 0.0; private var dir: Double? = null; private var t = 0.0; private var started = false
    override fun start(e: GameObject, g: PocketGame) { hx = e.x; hy = e.y }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        t -= dt
        if (t <= 0) {
            t = rand(1.0, 3.0)
            val away = dist(e.x, e.y, hx, hy) > n("radius", 120.0)
            dir = if (Random.nextDouble() < 0.25 && !away && started) null else if (away) atan2(hy - e.y, hx - e.x) else rand(0.0, PI * 2)
            started = true
        }
        val d = dir ?: return
        val sp = slowed(e, n("speed", 60.0))
        e.x += cos(d) * sp * dt; e.y += sin(d) * sp * dt
        faceX(e, cos(d))
    }
}

/** Path: walks through points ("0,0; 150,0; 150,-100"), looping or back and forth. */
class PathMove(p: JsonMap) : Component(p) {
    private var pts = listOf<Pair<Double, Double>>(); private var i = 1; private var step = 1; private var hx = 0.0; private var hy = 0.0
    override fun start(e: GameObject, g: PocketGame) {
        hx = e.x; hy = e.y
        pts = s("points", "0,0; 150,0; 150,-100; 0,-100").split(";").map { it.split(",") }.filter { it.size >= 2 }.map { numOf(it[0].trim()) to numOf(it[1].trim()) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (pts.size < 2) return
        val tx = hx + pts[i].first; val ty = hy + pts[i].second; val dx = tx - e.x; val dy = ty - e.y; val d = hypot(dx, dy); val mv = slowed(e, n("speed", 120.0)) * dt
        if (d <= mv) {
            e.x = tx; e.y = ty
            if (p["loop"] != false) i = (i + 1) % pts.size else { if (i + step < 0 || i + step >= pts.size) step = -step; i += step }
            return
        }
        e.x += dx / d * mv; e.y += dy / d * mv
        faceX(e, dx)
    }
}

/** Turret: turns toward the nearest target in range and fires a template at it. */
class Turret(p: JsonMap) : Component(p) {
    private var t = 1.0; private var target: GameObject? = null
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (target?.dead != false) target = g.findAll(s("tag", "player")).firstOrNull { it !== e }
        val o = target ?: return
        val dx = o.x - e.x; val dy = o.y - e.y
        if (hypot(dx, dy) > n("range", 300.0)) return
        e.rz = atan2(dx, -dy) / DEG
        t -= dt
        if (t > 0 || s("template").isEmpty()) return
        t = n("every", 1.2)
        g.spawn(s("template"), e.x + sin(e.rz * DEG) * 24, e.y - cos(e.rz * DEG) * 24, e.rz)
    }
}

/** Drop Item: leaves a template behind when it's destroyed (loot, coins), by chance. */
class DropItem(p: JsonMap) : Component(p) {
    override fun gone(e: GameObject, g: PocketGame) { if (s("template").isNotEmpty() && g.state == "play" && Random.nextDouble() < n("chance", 1.0)) g.spawn(s("template"), e.x, e.y) }
}

/** Particle Emitter: a steady stream of sparks. */
class Emitter(p: JsonMap) : Component(p) {
    private var acc = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        acc += n("rate", 20.0) * dt
        val k = floor(acc).toInt()
        if (k > 0) { acc -= k; g.burst(e.x, e.y, parseColor(p["color"]) ?: Color(0xFFFFB74D), k, n("spread", 0.5)) }
    }
}

/** Particle System: fire, smoke, rain, snow, sparkles, confetti, magic or bubbles. */
class Particles(p: JsonMap) : Component(p) {
    companion object {
        val presets: Map<String, Map<String, Any>> = mapOf(
            "fire" to mapOf("rate" to 40, "colors" to listOf("#ffd54f", "#ff9800", "#f44336"), "speed" to 60, "spread" to 0.6, "dir" to -90, "life" to 0.8, "size" to 7, "gravity" to -120, "shrink" to true),
            "smoke" to mapOf("rate" to 12, "colors" to listOf("#9e9e9e", "#757575"), "speed" to 30, "spread" to 0.5, "dir" to -90, "life" to 2, "size" to 14, "gravity" to -30, "grow" to true, "alpha" to 0.5),
            "rain" to mapOf("rate" to 120, "colors" to listOf("#90caf9"), "speed" to 700, "spread" to 0.05, "dir" to 95, "life" to 1.2, "size" to 3, "gravity" to 0, "area" to true, "stretch" to 4),
            "snow" to mapOf("rate" to 40, "colors" to listOf("#ffffff"), "speed" to 60, "spread" to 0.6, "dir" to 90, "life" to 6, "size" to 5, "gravity" to 10, "area" to true),
            "sparkle" to mapOf("rate" to 18, "colors" to listOf("#ffffff", "#fff59d", "#80deea"), "speed" to 40, "spread" to 3.2, "dir" to 0, "life" to 0.7, "size" to 4, "gravity" to 0, "shrink" to true),
            "confetti" to mapOf("rate" to 60, "colors" to listOf("#e53935", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"), "speed" to 300, "spread" to 0.8, "dir" to -90, "life" to 2.5, "size" to 7, "gravity" to 500, "square" to true),
            "magic" to mapOf("rate" to 30, "colors" to listOf("#ce93d8", "#80cbc4", "#fff59d"), "speed" to 50, "spread" to 3.2, "dir" to -90, "life" to 1.2, "size" to 5, "gravity" to -60, "shrink" to true),
            "bubbles" to mapOf("rate" to 8, "colors" to listOf("#b3e5fc"), "speed" to 50, "spread" to 0.4, "dir" to -90, "life" to 3, "size" to 10, "gravity" to -40, "alpha" to 0.6),
        )
    }
    private var acc = 0.0; private var playing = p["playing"] != false
    override fun start(e: GameObject, g: PocketGame) = g.on { m -> if (m == "particles-on" || m == "${e.name}-on") playing = true; if (m == "particles-off" || m == "${e.name}-off") playing = false }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!playing || !e.shown) return
        val P = presets[s("preset", "fire")] ?: presets.getValue("fire")
        val rate = if (n("rate") > 0) n("rate") else numOf(P["rate"]); val size = if (n("size") > 0) n("size") else numOf(P["size"])
        val colors = (P["colors"] as List<*>).map { it.toString() }; val vb = g.viewBounds
        acc += rate * dt
        while (acc >= 1 && g.particles.size < 1500) {
            acc--
            val sp0 = numOf(P["spread"]); val a = numOf(P["dir"]) * DEG + rand(-sp0, sp0); val sp = numOf(P["speed"]) * rand(0.6, 1.2)
            val area = P["area"] == true
            val x = if (area) rand(vb.left - 40, vb.right + 40) else e.x; val y = if (area) vb.top - 10 else e.y
            val life = numOf(P["life"]) * rand(0.8, 1.2)
            g.particles.add(Particle(x, y, cos(a) * sp, sin(a) * sp, parseColor(p["color"]) ?: parseColor(colors[Random.nextInt(colors.size)])!!, size * rand(0.7, 1.3),
                life, numOf(P["gravity"]), P["shrink"] == true, P["grow"] == true, P["square"] != true, numOf(P["alpha"], 1.0), numOf(P["stretch"])))
        }
    }
}

/** Blink: on and off (a hazard that's only dangerous while showing). */
class Blink(p: JsonMap) : Component(p) {
    private var t = 0.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val on = n("on", 0.6); val off = n("off", 0.6)
        t = (t + dt) % max(0.01, on + off)
        e.visible = t < on
        e.data["blinkOff"] = p["solid"] != false && !e.visible
    }
}

/** Force Zone: pushes things inside it one way (wind, a conveyor, a fan), or toward / away from its centre. */
class ForceZone(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { if (on("hidden")) e.visible = false }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val tag = s("tag"); val mode = s("mode", "direction"); val st = n("strength", 1800.0)
        val fx = n("fx"); val fy = n("fy", -1.0); val l = if (hypot(fx, fy) == 0.0) 1.0 else hypot(fx, fy)
        for (o in g.objects) {
            val b = o.body ?: continue
            if (o === e || o.dead || !b.isDynamic || (tag.isNotEmpty() && !o.has(tag)) || !PocketGame.overlap(e, o)) continue
            val ux: Double; val uy: Double
            if (mode == "direction") { ux = fx / l; uy = fy / l }
            else { val dx = e.x - o.x; val dy = e.y - o.y; val d = max(1.0, hypot(dx, dy)); val sg = if (mode == "pull to center") 1 else -1; ux = sg * dx / d; uy = sg * dy / d }
            b.fx += ux * st; b.fy += uy * st
        }
    }
}

// ---- touch and buttons ----

/** Touch Button: a HUD object that works as the jump / fire button or a direction (or sends a message while pressed). */
class TouchKey(p: JsonMap) : Component(p) {
    private var was = false
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        g.tapTargets.add(e)
        val act = mapOf("jump" to "jump", "fire" to "action", "left" to "dleft", "right" to "dright", "up" to "dup", "down" to "ddown", "message" to "msg")
        val a = act[s("action", "jump")] ?: "jump"
        val held = e.shown && g.pointers.values.any { g.hitsAt(e, it.at) }
        if (held) g.virtualHeld.add(a) else g.virtualHeld.remove(a)
        e.alpha = if (held) 1.0 else 0.75
        if (held && !was) { g.pressed.add(a); if (a == "jump") g.pressed.add("btn:jump"); g.squash(e, 0.9); if (a == "msg") g.send(s("message", "boost")) }
        was = held
    }
    override fun gone(e: GameObject, g: PocketGame) = g.virtualHeld.clear()
}

/** Button: does an action on a tap (or on press, while held, on a long press); can cost a variable, need one, cool down or work once. */
class ButtonPart(p: JsonMap) : Component(p) {
    private var held: Long? = null; private var heldT = 0.0; private var nextRep = 0.0; private var cdUntil = -1.0
    private var longDone = false; private var used = false; private var base: Pair<Double, Double>? = null
    override val always get() = true
    private val gated get() = s("enableVar").isNotEmpty() || s("costVar").isNotEmpty() || on("once") || n("cooldown") > 0
    fun allowed(g: PocketGame): Boolean {
        if (on("once") && used) return false
        val ev = s("enableVar")
        if (ev.isNotEmpty()) {
            val a = g.numVar(ev); val b = n("enableValue", 1.0)
            val ok = when (s("enableOp", "≥")) { ">" -> a > b; "=" -> a == b; "≠" -> a != b; "<" -> a < b; "≤" -> a <= b; else -> a >= b }
            if (!ok) return false
        }
        val cv = s("costVar")
        if (cv.isNotEmpty() && g.numVar(cv) < n("cost", 10.0)) return false
        return true
    }
    fun fire(e: GameObject, g: PocketGame) {
        if (g.time < cdUntil && g.state == "play") return
        if (!allowed(g)) { g.sfx("hit"); g.tween(e, "x", e.x + 8, 0.3, "outElastic", yoyo = true); if (s("denied").isNotEmpty()) g.message(s("denied"), 1.3); return }
        val cv = s("costVar")
        if (cv.isNotEmpty()) g.addVar(cv, -n("cost", 10.0))
        if (p["haptic"] != false) g.buzz()
        if (p["action"] != "play sound" && s("sound", "none") == "none") g.sfx("click")
        g.runAction(e, p)
        if (s("also").isNotEmpty()) g.send(s("also"))
        used = true
        if (n("cooldown") > 0) cdUntil = g.time + n("cooldown")
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!g.onScreen(e)) { held = null; return }
        g.tapTargets.add(e)
        val b = base ?: (e.sx to e.sy).also { base = it }
        val mode = s("when", "on tap")
        if (held == null) {
            for (d in g.downs) {
                if (!g.hitsAt(e, d.at)) continue
                held = d.id; heldT = 0.0; nextRep = 0.0; longDone = false
                if (mode == "on press") fire(e, g)
                break
            }
        }
        val ptr = held?.let { g.pointers[it] }
        if (ptr != null) {
            heldT += dt
            if (mode == "while held (repeats)" && heldT >= nextRep) { fire(e, g); nextRep = heldT + max(0.05, n("repeat", 0.15)) + (if (nextRep == 0.0) 0.25 else 0.0) }
            if (mode == "on long press" && !longDone && heldT >= n("holdTime", 0.6)) { longDone = true; fire(e, g) }
        } else held = null
        if (mode == "on tap") for (t in g.taps) if (g.hits(e, t)) { fire(e, g); break }
        // pressed in while the finger is on it
        val down = ptr != null && g.hitsAt(e, ptr.at); val k = if (down) n("pressScale", 0.92) else 1.0; val a = min(1.0, dt * 25)
        if (s("feel", "spring") != "none") { e.sx += (b.first * k - e.sx) * a; e.sy += (b.second * k - e.sy) * a }
        if (s("pressColor").isNotEmpty() && e.shape != null) { if (!e.data.containsKey("fill0")) e.data["fill0"] = e.shape["fill"]; e.shape["fill"] = if (down) p["pressColor"] else e.data["fill0"] }
        if (gated) e.alpha = if (!allowed(g) || g.time < cdUntil) n("disabledAlpha", 0.45) else 1.0
        e.data["cooldown"] = if (cdUntil > g.time) (cdUntil - g.time) / max(0.01, n("cooldown", 1.0)) else 0.0
    }
}

/** Click Popup: "+1" floats up where you tap it. */
class ClickPopup(p: JsonMap) : Component(p) {
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        for (t in g.tapsOn(e)) g.popText(t.screen - Offset(0f, 20f), g.fill(s("text", "+1")), parseColor(p["color"]) ?: Color(0xFFFFD23D), n("size", 26.0))
    }
}

/** Combo Clicker: quick taps build a combo that multiplies the points; sometimes a critical hit. */
class ComboClicker(p: JsonMap) : Component(p) {
    private var combo = 0; private var last = -99.0
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        val window = n("window", 0.6)
        if (combo > 0 && g.time - last > window) { combo = 0; g.setVar("combo", 0.0) }
        for (t in g.tapsOn(e)) {
            combo = if (g.time - last <= window) min(n("maxCombo", 50.0).toInt(), combo + 1) else 1; last = g.time
            val crit = Random.nextDouble() * 100 < n("critChance", 10.0); val mult = (1 + (combo - 1) * n("comboStep", 0.25)) * (if (crit) n("critMult", 3.0) else 1.0)
            val bv = s("bonusVar"); val pts = max(0.0, ((n("points", 1.0) + (if (bv.isEmpty()) 0.0 else g.numVar(bv))) * mult * 100).roundToInt() / 100.0)
            g.addVar(s("var", "score"), pts); g.setVar("combo", combo.toDouble())
            g.sfx(if (crit) "power" else s("sound", "click")); g.buzz(crit)
            if (p["popup"] != false) g.popText(t.screen - Offset(0f, 20f), (if (crit) "CRIT +" else "+") + formatNumber(pts), if (crit) Color(0xFFFF5D8F) else Color(0xFFFFD23D), if (crit) 34.0 else 24 + min(10.0, combo / 3.0))
            g.squash(e, if (crit) 0.8 else 0.9)
            if (crit) g.burst(e.x, e.y, Color(0xFFFF5D8F), 14, 0.8)
        }
    }
}

/** Long Press: hold a finger on it for a moment (a ring fills) to do an action. */
class LongPress(p: JsonMap) : Component(p) {
    private var held: Long? = null; private var t = 0.0; private var fired = false; private var hooked = false
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        if (!hooked) {
            hooked = true
            g.overlays.add {
                if (held == null || fired || e.dead) return@add
                val at = g.screenOf(e); val k = min(1.0, t / n("seconds", 0.8)).toFloat()
                drawCircle(Color(0x59000000), 34f, at, style = Stroke(6f))
                drawArc(Color(0xFFFFD23D), -90f, 360f * k, false, topLeft = at - Offset(34f, 34f), size = Size(68f, 68f), style = Stroke(6f))
            }
        }
        if (held == null) { val d = g.downOn(e); if (d != null) { held = d.id; t = 0.0; fired = false }; return }
        val ptr = g.pointers[held]
        if (ptr == null || !g.hitsAt(e, ptr.at)) { held = null; return }
        t += dt
        if (!fired && t >= n("seconds", 0.8)) { fired = true; g.buzz(true); g.squash(e, 0.85); g.runAction(e, p) }
    }
}

/** Double Tap: two quick taps do an action. */
class DoubleTap(p: JsonMap) : Component(p) {
    private var last = -99.0
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        for (t in g.tapsOn(e)) { if (g.time - last <= n("gap", 0.35)) { last = -99.0; g.squash(e, 0.85); g.buzz(); g.runAction(e, p) } else last = g.time }
    }
}

/** Tap Toggle: tap to switch on and off (a variable, its colour, and showing another object). */
class TapToggle(p: JsonMap) : Component(p) {
    private var isOn = false
    private fun apply(e: GameObject, g: PocketGame) {
        g.setVar(s("var", "switch"), if (isOn) 1.0 else 0.0)
        e.shape?.set("fill", if (isOn) s("onColor", "#66bb6a") else s("offColor", "#78909c"))
        val o = s("object")
        if (o.isNotEmpty()) g.find(o)?.visible = isOn
    }
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) { isOn = on("startOn"); apply(e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        for (t in g.tapsOn(e)) {
            isOn = !isOn; apply(e, g); g.squash(e); g.sfx("click")
            if (s("message").isNotEmpty()) g.send("${s("message")} ${if (isOn) "on" else "off"}")
        }
    }
}

/** Press Feedback: squashes while pressed, springs back on release (a click, a buzz, sparkles). */
class PressFeedback(p: JsonMap) : Component(p) {
    private var held: Long? = null; private var base = 1.0
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (held == null) {
            val d = g.downOn(e)
            if (d == null) { base = e.sx; return }
            held = d.id; g.killTweens(e); e.sx = base * n("squash", 0.88); e.sy = e.sx
            g.sfx(s("sound", "click"))
            if (p["haptic"] != false) g.buzz()
            if (on("sparkles")) g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color.White, 10, 0.6)
        } else if (!g.pointers.containsKey(held)) { held = null; g.tween(e, "sx", base, 0.22, "outBack"); g.tween(e, "sy", base, 0.22, "outBack") }
    }
}

/** Tap to Spawn: taps (on empty space, or anywhere) make copies of a template; can cost a variable. */
class TapToSpawn(p: JsonMap) : Component(p) {
    private var last = -99.0; private val made = mutableListOf<GameObject>()
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val tpl = s("template")
        if (tpl.isEmpty()) return
        for (t in g.taps) {
            if (g.time - last < n("cooldown", 0.2)) continue
            if (s("where", "empty") == "empty" && g.objects.any { it !== e && it.shown && !it.dead && (it.shape != null || it.sprite != null || it.ui) && g.hits(it, t) }) continue
            made.removeAll { it.dead }
            if (n("max", 20.0) > 0 && made.size >= n("max", 20.0)) { g.message("Too many!", 0.8); continue }
            val cost = n("cost"); val cv = s("costVar", "score")
            if (cost > 0) { if (g.numVar(cv) < cost) { g.message("Need ${formatNumber(cost)} $cv", 1.0); continue }; g.addVar(cv, -cost) }
            val c = g.spawn(tpl, t.world.x.toDouble(), t.world.y.toDouble())
            if (c != null) { made.add(c); last = g.time; g.buzz() }
        }
    }
}

/** Drag to Launch: pull back from it and let go to fling it (slingshot). */
class DragLaunch(p: JsonMap) : Component(p) {
    private var held: Long? = null; private var used = 0
    private fun pull(e: GameObject, g: PocketGame, at: Offset): Offset { val c = g.screenOf(e); var d = c - at; val l = d.getDistance(); val m = n("maxPull", 140.0).toFloat(); if (l > m) d = d / l * m; return d }
    override fun start(e: GameObject, g: PocketGame) {
        e.ensureBody("dynamic")
        g.overlays.add {
            val ptr = held?.let { g.pointers[it] }
            if (ptr == null || e.dead) return@add
            val at = g.screenOf(e); val d = pull(e, g, ptr.at); val tip = at + d * 1.6f
            drawLine(Color(0xD9FFFFFF), at, tip, 3f, StrokeCap.Round)
            drawLine(Color(0x59FFFFFF), at, at - d, 3f)
            drawCircle(Color(0xFFFFD23D), 6f, tip)
        }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val b = e.ensureBody("dynamic")
        if (held == null) {
            if (n("shots") > 0 && used >= n("shots")) return
            if (p["whileStill"] != false && hypot(b.vx, b.vy) > 20) return
            val d = g.downOn(e)
            if (d != null) { held = d.id; d.role = "drag" }
            return
        }
        if (g.pointers.containsKey(held)) return
        val up = g.ups.firstOrNull { it.id == held }
        held = null
        if (up == null) return
        val d = pull(e, g, up.at)
        if (d.getDistance() < 12) return
        val k = n("power", 6.0) / g.zoom
        b.vx = d.x * k; b.vy = d.y * k
        used++
        val sv = s("shotsVar", "shots")
        if (sv.isNotEmpty()) g.addVar(sv, 1.0)
        g.sfx("jump"); g.buzz()
    }
}

// ---- logic ----

/** Trigger Zone: does an action when something with a tag enters it (once, or every time). */
class TriggerZone(p: JsonMap) : Component(p) {
    private var done = false
    override val wants get() = s("tag", "player")
    override fun start(e: GameObject, g: PocketGame) { if (p["hidden"] != false) e.visible = false }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { if (p["once"] != false && done) return; done = true; g.runAction(e, p, other) }
}

/** Timer: does an action after some seconds (once, or over and over). */
class TimerPart(p: JsonMap) : Component(p) {
    private var t = 0.0; private var done = false
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (done) return
        t += dt
        if (t < n("seconds", 5.0)) return
        g.runAction(e, p)
        if (on("repeat")) t = 0.0 else done = true
    }
}

/** Condition: does an action once a variable reaches a value (hp ≤ 0 → game over). */
class Condition(p: JsonMap) : Component(p) {
    private var done = false
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (done) return
        val v = g.numVar(s("var", "hp")); val t = n("target"); val op = s("op", "<=")
        if (if (op == "<=") v <= t else if (op == ">=") v >= t else v == t) { done = true; g.runAction(e, p) }
    }
}

/** Wave Spawner: waves of enemies with breaks in between; when they're all beaten it wins, loops or sends a message. */
class WaveSpawner(p: JsonMap) : Component(p) {
    private var w = -1; private var left = 0; private var t = 1.0; private var phase = "break"
    private val spawned = mutableListOf<GameObject>()
    private val waves get() = p["waves"] as? List<*> ?: emptyList<Any?>()
    override fun start(e: GameObject, g: PocketGame) { t = 1.0; g.setVar("wave", 0.0) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        spawned.removeAll { it.dead }
        t -= dt
        if (phase == "break" && t <= 0) {
            w++
            if (w >= waves.size) {
                val whenDone = s("whenDone", "win")
                if (whenDone == "loop waves" && waves.isNotEmpty()) w = 0 else { phase = "done"; if (whenDone == "win") g.win() else if (whenDone == "send message") g.send(s("message", "waves-done")); return }
            }
            phase = "spawn"; left = numOf(waves[w].asMap()?.get("count"), 1.0).toInt(); t = 0.0; g.setVar("wave", (w + 1).toDouble()); g.message("Wave ${w + 1}", 1.5); g.send("wave-${w + 1}")
        } else if (phase == "spawn" && t <= 0 && left > 0) {
            val W = waves[w].asMap() ?: emptyMap()
            val q = g.spawn(W["template"].toString(), e.x + rand(-0.5, 0.5) * n("area", 300.0), e.y + rand(-0.5, 0.5) * n("areaH"))
            if (q != null) spawned.add(q)
            left--; t = numOf(W["every"], 1.0)
        } else if (phase == "spawn" && left <= 0 && spawned.isEmpty()) { phase = "break"; t = n("pause", 3.0) }
    }
}

/** Day / Night Cycle: the sky colour changes through the day and the world gets darker at night; {hour} counts the hours. */
class DayNight(p: JsonMap) : Component(p) {
    private var hour = 0.0
    override fun start(e: GameObject, g: PocketGame) { hour = n("start", 8.0) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        hour = (hour + dt * 24 / max(1.0, n("dayLength", 60.0))) % 24
        val sun = sin((hour - 6) / 24 * PI * 2); val day = (sun * 1.6 + 0.3).coerceIn(0.0, 1.0)
        g.background = mixColor(parseColor(p["nightColor"]) ?: Color(0xFF0B1030), parseColor(p["dayColor"]) ?: Color(0xFF87B8E8), day)
        g.darkness = (1 - day) * n("maxDark", 0.8)
        val hr = floor(hour)
        if (g.vars["hour"] != hr) g.setVar("hour", hr)
    }
}

/** Typewriter Text: its text appears letter by letter (when the game starts, or on a message). */
class Typewriter(p: JsonMap) : Component(p) {
    private var full = ""; private var k = 0.0; private var running = false
    override fun start(e: GameObject, g: PocketGame) {
        full = strOf(e.text?.get("value"))
        e.text?.set("value", "")
        running = s("startOn", "start") == "start"
        g.on { m -> if (m == s("message", "story")) { k = 0.0; running = true } }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val t = e.text ?: return
        if (!running) return
        val before = floor(k).toInt()
        k = min(full.length.toDouble(), k + dt * n("speed", 30.0))
        if (p["sound"] != false && floor(k).toInt() > before && floor(k).toInt() % 3 == 0) g.buzz()
        t["value"] = full.substring(0, floor(k).toInt())
        if (k >= full.length) running = false
    }
}

// ---- health and damage ----

/** Health & Damage: hit points; hurt by touching things with tags (or by a Damage Dealer), invulnerable for a moment,
 *  knocked back, armour and shields, regeneration, poison / burn / freeze effects; when it runs out: destroy, respawn, lose a life, game over. */
class Health(p: JsonMap) : Toucher(p) {
    var hp = 1.0; var max = 1.0; var shield = 0.0; var shieldMax = 0.0; private var since = 99.0
    var dead = false
    private var home = Offset.Zero
    private val tags = tagList(p["hurtBy"] ?: "enemy, hazard"); private val healTags = tagList(p["healTags"])
    /** Status effects: name → (damage per second, seconds left). */
    val effects = mutableMapOf<String, Pair<Double, Double>>()
    private var tick = 0.0
    private val resist: Map<String, Double> = s("resist").split(",").map { it.trim() }.filter { it.contains(" ") }.associate { part ->
        val bits = part.split(Regex("\\s+")); bits[0].lowercase() to numOf(bits.last().replace("%", "")) / (if ("%" in part) 100.0 else 1.0)
    }
    fun hurtsMe(o: GameObject) = tags.any { o.has(it) } && o.part<Damager>() == null
    override fun cares(other: GameObject) = tags.any { other.has(it) } || healTags.any { other.has(it) }
    fun sync(e: GameObject, g: PocketGame) {
        val sv = s("syncVar")
        if (sv.isNotEmpty()) g.setVar(sv, ceil(hp))
        e.data["hp"] = hp; e.data["hpMax"] = max
        val k = if (max > 0) hp / max else 0.0; val show = s("showBar", "never")
        if (!dead && (show == "always" || (show == "when hurt" && hp < max))) e.bars["health"] = k to (if (k > 0.5) Color(0xFF5DFF8A) else if (k > 0.25) Color(0xFFFFD23D) else Color(0xFFFF4D4D)) else e.bars.remove("health")
    }
    override fun start(e: GameObject, g: PocketGame) {
        max = max(1.0, n("hp", 3.0)); hp = max; shield = n("shield"); shieldMax = shield
        home = Offset(e.x.toFloat(), e.y.toFloat()); sync(e, g)
    }
    fun heal(e: GameObject, g: PocketGame, amount: Double): Double {
        val was = hp; hp = min(max, hp + max(0.0, amount))
        if (hp > 0) dead = false
        sync(e, g)
        if (hp > was && on("numbers")) g.popOver(e, "+${(hp - was).roundToInt()}", Color(0xFF5DFF8A), 18.0)
        return hp - was
    }
    /** Hurt it; returns the damage done. */
    fun damage(e: GameObject, g: PocketGame, amount: Double, from: GameObject? = null, type: String = "", crit: Boolean = false, pierce: Boolean = false, dot: Boolean = false, knockback: Double? = null, ignoreInvuln: Boolean = false): Double {
        if (e.dead || dead || hp <= 0 || on("god")) return 0.0
        if (!dot && !ignoreInvuln && e.invuln > 0) return 0.0
        var d = amount
        if (type.isNotEmpty()) resist[type]?.let { d *= it }
        if (!pierce) d = d * (1 - n("defense").coerceIn(0.0, 100.0) / 100) - (if (dot) 0.0 else n("armor") + numOf(e.data["equipArmor"]))
        if (d <= 0.001) { if (on("numbers") && !dot) g.popOver(e, "Blocked", Color(0xFF9FB3C8), 18.0); return 0.0 }
        d = (d * 100).roundToInt() / 100.0
        val total = d
        if (shield > 0) { val soak = min(shield, d); shield -= soak; d -= soak }
        hp = max(0.0, hp - d); since = 0.0
        if (!dot) e.invuln = n("invuln", 1.0)
        sync(e, g)
        g.send("damage")
        if (!dot) { g.sfx("hit"); g.shake = max(g.shake, 6.0); e.data["flash"] = 0.12 }
        if (on("numbers")) g.popOver(e, (if (crit) "CRIT " else "") + "-${total.roundToInt()}", if (crit) Color(0xFFFF5D8F) else Color(0xFFFF4D4D), if (crit) 30.0 else 22.0)
        val kb = knockback ?: n("knockback", 300.0)
        val b = e.body
        if (from != null && kb != 0.0 && b != null && !dot) { val dx = e.x - from.x; val dy = e.y - from.y; val l = max(1e-6, hypot(dx, dy)); b.vx = dx / l * kb; b.vy = -abs(kb) * 0.6 }
        if (hp <= 0) die(e, g)
        return total
    }
    fun die(e: GameObject, g: PocketGame) {
        if (dead || e.dead) return
        dead = true; hp = 0.0; effects.clear(); sync(e, g)
        g.send(s("message", "died"))
        if (n("points") != 0.0) g.addVar("score", n("points"))
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFF8A3D), 24)
        val onDeath = s("onDeath", "destroy")
        val act = if (onDeath == "lose a life") (if (g.numVar("lives") > 1) "life" else "game over") else onDeath
        if (act == "life") g.addVar("lives", -1.0)
        when (act) {
            "destroy" -> e.destroy()
            "game over" -> { if (onDeath == "lose a life") g.setVar("lives", 0.0); g.gameOver() }
            "respawn", "life" -> { val sp = e.data["respawn"] as? Offset ?: home; e.x = sp.x.toDouble(); e.y = sp.y.toDouble(); e.body?.let { it.vx = 0.0; it.vy = 0.0 }; hp = max; shield = shieldMax; dead = false; e.invuln = max(n("invuln", 1.0), 1.0); sync(e, g) }
        }
    }
    /** Poison, burn, bleed (damage over time), regen (healing), freeze and slow (speed). */
    fun addEffect(e: GameObject, name: String, perSec: Double, seconds: Double) { if (!dead) effects[name] = perSec to seconds }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        since += dt
        var slow = 1.0
        tick += dt
        val ticks = tick >= 0.5
        if (ticks) tick -= 0.5
        for (k in effects.keys.toList()) {
            val (dps, left) = effects[k] ?: continue
            if (k == "freeze") slow = min(slow, 0.0) else if (k == "slow") slow = min(slow, 0.5)
            else if (ticks) { if (k == "regen") heal(e, g, dps * 0.5) else damage(e, g, dps * 0.5, dot = true, pierce = true) }
            if (left - dt <= 0) effects.remove(k) else effects[k] = dps to (left - dt)
            if (dead) break
        }
        if (slow < 1) e.data["slow"] = slow else e.data.remove("slow")
        if (dead) return
        val calm = since >= n("regenDelay")
        if (n("regen") > 0 && calm && hp < max) { hp = min(max, hp + n("regen") * dt); sync(e, g) }
        if (shieldMax > 0 && calm && shield < shieldMax) shield = min(shieldMax, shield + n("shieldRegen", 1.0) * dt)
        val fall = n("fallDamage"); val fs = n("fallSpeed", 900.0); val b = e.body
        if (fall > 0 && b != null && b.landed > fs) damage(e, g, fall * (1 + (b.landed - fs) / fs), ignoreInvuln = true)
        if (p["hurtWhileTouching"] != false && tags.isNotEmpty() && e.invuln <= 0) {
            g.touching(e) { hurtsMe(it) }.firstOrNull()?.let { damage(e, g, n("damage", 1.0), from = it) }
        }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (healTags.any { other.has(it) }) { if (hp < max) { heal(e, g, n("healAmount", 1.0)); other.destroy(); g.sfx("power") }; return }
        if (hurtsMe(other)) damage(e, g, n("damage", 1.0), from = other)
    }
}

/** Damage Dealer: hurts objects with Health (weapons, bullets, spikes, lava, explosions): on touch or over time, crits, area damage, effects. */
class Damager(p: JsonMap) : Toucher(p) {
    private val tags = tagList(p["targets"] ?: "enemy")
    private val last = mutableMapOf<Int, Double>()
    private var tickT = 0.0
    fun targets(o: GameObject) = tags.any { o.has(it) }
    override fun cares(other: GameObject) = targets(other)
    fun hit(e: GameObject, t: GameObject, g: PocketGame, k: Double = 1.0): Double {
        if (g.time - (last[t.uid] ?: -99.0) < n("cooldown", 0.3)) return 0.0
        last[t.uid] = g.time
        val hb = t.part<Health>()
        if (hb == null) { if (on("noHealth")) { g.burst(t.x, t.y, parseColor(t.shape?.get("fill")) ?: Color(0xFFFF8A3D), 16); t.destroy() }; return 0.0 }
        val crit = n("critChance") > 0 && Random.nextDouble() * 100 < n("critChance")
        val owner = if (e.has("player")) e else if (e.parent?.has("player") == true) e.parent else null
        val bonus = if (p["useWeapon"] != false && owner != null) numOf(owner.data["equipDamage"]) else 0.0
        val d = (n("amount", 1.0) + bonus) * k * (if (crit) n("critTimes", 2.0) else 1.0)
        val dtype = s("dtype", "normal")
        val dealt = hb.damage(t, g, d, from = e, type = if (dtype == "normal") "" else dtype, crit = crit, pierce = on("pierce"), knockback = if (n("knockback") != 0.0) n("knockback") else null, ignoreInvuln = s("mode", "when it touches") != "when it touches")
        val fx = s("effect", "nothing")
        if (fx != "nothing") hb.addEffect(t, fx, n("effectDps", 1.0), n("effectTime", 3.0))
        if (dealt > 0 && n("points") != 0.0) g.addVar("score", n("points"))
        return dealt
    }
    fun strike(e: GameObject, t: GameObject, g: PocketGame) {
        val area = n("area")
        if (area > 0) { for (q in g.objects.toList()) if (!q.dead && q !== e && targets(q)) { val d = dist(q.x, q.y, e.x, e.y); if (d <= area) hit(e, q, g, 1 - 0.5 * d / area) } }
        else hit(e, t, g)
        if (on("destroyOnHit")) e.destroy()
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (s("mode", "when it touches") == "when it touches") return
        tickT -= dt
        if (tickT > 0) return
        tickT = max(0.05, n("every", 0.5))
        for (o in g.touching(e) { targets(it) }) { strike(e, o, g); if (e.dead) break }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { if (s("mode", "when it touches") == "when it touches" && !other.dead) strike(e, other, g) }
}

/** Hunger and Thirst: a need that drains over time (faster while moving), is refilled by food / drink, and hurts or slows when empty. */
class Need(p: JsonMap, val key: String, val col: Color) : Toucher(p) {
    private var v = 0.0; private var max = 1.0; private var hurtT = 0.0; private var low = false; private var empty = false
    private val items = tagList(p["items"] ?: (if (key == "thirst") "water" else "food"))
    private val amounts: Map<String, Double> = s("amounts").split(",").map { it.trim() }.filter { it.contains(" ") }.associate { it.substring(0, it.lastIndexOf(' ')).lowercase() to numOf(it.split(" ").last()) }
    override fun cares(other: GameObject) = items.any { other.has(it) }
    private fun sync(e: GameObject, g: PocketGame) {
        val sv = s("syncVar", key)
        if (sv.isNotEmpty()) g.setVar(sv, v.roundToInt().toDouble())
        val k = v / max; val show = s("showBar", "never")
        if (show == "always" || (show == "when low" && k * 100 <= n("lowAt", 25.0))) e.bars[key] = k to col else e.bars.remove(key)
    }
    private fun check(e: GameObject, g: PocketGame) {
        val pc = v / max * 100; val nowLow = pc <= n("lowAt", 25.0) && v > 0; val nowEmpty = v <= 0
        if (nowLow && !low && s("lowMessage").isNotEmpty()) g.send(s("lowMessage"))
        if (nowEmpty && !empty && p["whenEmpty"] == "game over") g.gameOver()
        low = nowLow; empty = nowEmpty
        if (empty && "slows" in s("whenEmpty", "hurts health")) e.data["slow"] = n("slowTo", 0.5).coerceIn(0.0, 1.0) else if (!e.data.containsKey("slowFx")) e.data.remove("slow")
    }
    override fun start(e: GameObject, g: PocketGame) { max = max(1.0, n("max", 100.0)); v = max * n("start", 100.0).coerceIn(0.0, 100.0) / 100; check(e, g); sync(e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val b = e.body; val moving = b != null && hypot(b.vx, b.vy) > 20
        val was = v
        v = max(0.0, v - n("drain", if (key == "thirst") 0.8 else 0.5) * (if (moving) n("moveDrain", 1.5) else 1.0) * dt)
        if (v != was) { check(e, g); if (v.roundToInt() != was.roundToInt() || v == 0.0) sync(e, g) }
        val hb = e.part<Health>()
        if (empty && "hurts" in s("whenEmpty", "hurts health") && hb != null) { hurtT += dt; if (hurtT >= 1) { hurtT -= 1; hb.damage(e, g, n("emptyDamage", 1.0), dot = true, pierce = true) } }
        if (!empty) hurtT = 0.0
        if (n("healAbove") > 0 && hb != null && v / max * 100 >= n("healAbove") && hb.hp < hb.max && hb.hp > 0) hb.heal(e, g, n("healRate", 0.2) * dt)
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (other.dead || v >= max) return
        var worth = amounts[other.name.lowercase()] ?: n("perItem", if (key == "thirst") 30.0 else 25.0)
        for (t in other.tags) amounts[t.lowercase()]?.let { worth = it }
        v = min(max, v + worth); check(e, g); sync(e, g)
        g.sfx(s("sound", "power"))
        if (p["consume"] != false) other.destroy()
    }
}

/** Car: drive with the joystick (up for gas), steer harder the faster it goes. */
class Car(p: JsonMap) : Component(p) {
    private var v = 0.0
    override fun start(e: GameObject, g: PocketGame) { e.ensureBody("dynamic", gravityScale = 0.0); g.wantJoystick() }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val a = g.axis(); val b = e.ensureBody("dynamic", gravityScale = 0.0); val maxV = n("maxSpeed", 320.0)
        val gas = if (on("autoGas")) 1.0 else -a.y.toDouble()
        v += gas * n("accel", 260.0) * dt
        v -= v * min(1.0, (if (gas != 0.0) 0.6 else 1.8) * dt)
        v = v.coerceIn(-maxV * 0.4, maxV)
        val grip = (abs(v) / (maxV * 0.25)).coerceIn(0.0, 1.0) * (if (v == 0.0) 1.0 else sign(v))
        e.rz += a.x * n("turn", 160.0) * grip * dt
        b.vx = sin(e.rz * DEG) * v; b.vy = -cos(e.rz * DEG) * v
    }
}

// ---- saving ----

/** Save Point: touching it saves the game (a slot). */
class SavePoint(p: JsonMap) : Component(p) {
    private var cool = 0.0
    override val wants get() = s("tag", "player")
    override fun update(e: GameObject, dt: Double, g: PocketGame) { cool -= dt }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) {
        if (cool > 0) return
        cool = 2.0
        if (g.saveGame(n("slot", 1.0).toInt())) { if (s("text").isNotEmpty()) g.message(s("text"), 1.5); g.burst(e.x, e.y, Color(0xFF7CF7A0), 14); g.sfx("power") }
    }
}

/** Auto Save: keeps this object's place, look and whether it was removed on the phone (and puts it back next time). */
class AutoSave(p: JsonMap) : Component(p) {
    private var key = ""; private var t = 0.0
    private fun save(e: GameObject) = store(key, toJsonValue(mapOf("x" to e.x, "y" to e.y, "visible" to e.visible, "data" to e.data.filterValues { it is Number || it is String || it is Boolean })).toString())
    override fun start(e: GameObject, g: PocketGame) {
        key = "pocket.obj.${g.saveKey}.${s("file", "save")}.${s("key", e.id)}"
        val o = stored(key)?.let { parseJson(it) }.asMap()
        if (o != null && p["loadOnStart"] != false) {
            if (o["removed"] == true && p["removed"] != false) { e.destroy(); return }
            if (p["transform"] != false) { e.x = numOf(o["x"], e.x); e.y = numOf(o["y"], e.y) }
            if (p["visible"] != false) e.visible = o["visible"] != false
            if (p["data"] != false) o["data"].asMap()?.let { e.data.putAll(it) }
        }
        g.on { m -> if (m == s("message", "save") || (p["onLevelEnd"] != false && (m == "won" || m == "game over"))) save(e) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { if (n("every") > 0) { t += dt; if (t >= n("every")) { t = 0.0; save(e) } } }
    override fun gone(e: GameObject, g: PocketGame) { if (p["removed"] != false && g.state == "play") store(key, "{\"removed\":true}") }
}

/** Save Manager: keeps variables (all, or a list) on the phone and loads them when the game starts. */
class SaveManager(p: JsonMap) : Component(p) {
    private var t = 0.0
    private fun key(g: PocketGame) = "pocket.vars.${g.saveKey}.${s("file", "save")}"
    private fun save(g: PocketGame) {
        val names = tagList(p["vars"])
        store(key(g), toJsonValue(g.vars.filterKeys { (names.isEmpty() && it != "time" && it != "best") || it in names }).toString())
        if (s("savedText").isNotEmpty()) g.message(s("savedText"), 1.2)
    }
    override fun start(e: GameObject, g: PocketGame) {
        if (p["loadOnStart"] != false) stored(key(g))?.let { parseJson(it).asMap() }?.let { g.vars.putAll(it) }
        g.on { m -> if (m == s("message", "save") || (p["onLevelEnd"] != false && (m == "won" || m == "game over"))) save(g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { if (n("every") > 0) { t += dt; if (t >= n("every")) { t = 0.0; save(g) } } }
}

// ---- physics helpers and AI ----

/** Joint: ties this object to another with a rope (up to a length), a stiff rod, or a spring; draws the line. */
class Joint(p: JsonMap) : Component(p) {
    private var len = 0.0
    override fun start(e: GameObject, g: PocketGame) {
        val a = g.find(s("connectTo"))
        e.ensureBody("dynamic")
        len = if (n("length") > 0) n("length") else if (a != null) dist(a.x, a.y, e.x, e.y) else 100.0
        if (p["showLine"] != false) g.worldOverlays.add {
            val o = g.find(s("connectTo"))
            if (o != null && !e.dead) drawLine(parseColor(p["color"]) ?: Color(0xFFD7CCC8), Offset(o.x.toFloat(), o.y.toFloat()), Offset(e.x.toFloat(), e.y.toFloat()), 2f)
        }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val a = g.find(s("connectTo")) ?: return
        if (a === e) return
        val b = e.ensureBody("dynamic"); val dx = e.x - a.x; val dy = e.y - a.y; val d = max(1e-6, hypot(dx, dy)); val nx = dx / d; val ny = dy / d; val kind = s("kind", "rope")
        if (kind == "spring") {
            val f = -(d - len) * n("stiffness", 30.0); val vn = b.vx * nx + b.vy * ny; val damp = n("damping", 2.0)
            b.vx += (f * nx - damp * vn * nx) * dt; b.vy += (f * ny - damp * vn * ny) * dt
        } else if (d > len || kind == "rod") {
            e.x = a.x + nx * len; e.y = a.y + ny * len
            val vn = b.vx * nx + b.vy * ny
            if (vn > 0 || kind == "rod") { b.vx -= vn * nx; b.vy -= vn * ny }
        }
    }
}

/** Pathfinding (Navigator): walks to a target around walls (solid objects), finding the way on a grid. */
class Navigator(p: JsonMap) : Component(p) {
    private var path: List<Pair<Double, Double>>? = null; private var t = 0.0; private var k = 1
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val goal = g.findAll(s("target", "player")).firstOrNull { it !== e } ?: return
        val b = e.body; val d0 = dist(goal.x, goal.y, e.x, e.y); val cell = max(4.0, n("cell", 24.0)); val speed = slowed(e, n("speed", 120.0))
        if (d0 <= n("stop", 30.0)) { path = null; if (b != null && b.isDynamic) { b.vx = 0.0; if (g.gravity == 0.0) b.vy = 0.0 }; return }
        t -= dt
        if (t <= 0 || path == null) { t = n("repath", 0.5); path = findPath(g, e, goal.x to goal.y, cell, max(e.half.w, e.half.h) * 0.9); k = 1 }
        val pts = path
        val wp = if (pts != null && pts.isNotEmpty()) pts[min(k, pts.size - 1)] else goal.x to goal.y
        val dx = wp.first - e.x; val dy = wp.second - e.y; val l = hypot(dx, dy)
        if (l < cell * 0.5 && pts != null && k < pts.size - 1) k++
        val vx = if (l > 0) dx / l * speed else 0.0; val vy = if (l > 0) dy / l * speed else 0.0
        if (b != null && b.isDynamic) { b.vx = vx; if (g.gravity == 0.0) b.vy = vy } else { e.x += vx * dt; e.y += vy * dt }
        faceX(e, vx)
    }
}

/** A* on a grid around the start and goal: solid objects are walls. A list of points (the start first), or null. */
fun findPath(g: PocketGame, self: GameObject, goal: Pair<Double, Double>, cell: Double, radius: Double): List<Pair<Double, Double>>? {
    val walls = g.objects.filter { it !== self && !it.dead && it.body?.solid == true }.map { o -> Bounds(o.x - o.half.w - radius, o.y - o.half.h - radius, o.x + o.half.w + radius, o.y + o.half.h + radius) }
    val sx = self.x; val sy = self.y
    val minX = min(sx, goal.first) - cell * 12; val minY = min(sy, goal.second) - cell * 12
    val w = ceil((abs(sx - goal.first) + cell * 24) / cell).toInt(); val h = ceil((abs(sy - goal.second) + cell * 24) / cell).toInt()
    if (w * h > 40000) return null
    fun cellOf(x: Double, y: Double) = floor((x - minX) / cell).toInt().coerceIn(0, w - 1) to floor((y - minY) / cell).toInt().coerceIn(0, h - 1)
    fun centre(i: Int, j: Int) = (minX + (i + 0.5) * cell) to (minY + (j + 0.5) * cell)
    fun blocked(i: Int, j: Int): Boolean { val (cx, cy) = centre(i, j); return walls.any { cx >= it.left && cx <= it.right && cy >= it.top && cy <= it.bottom } }
    val (si, sj) = cellOf(sx, sy)
    val (gi, gj) = cellOf(goal.first, goal.second)
    val open = mutableSetOf(sj * w + si); val came = mutableMapOf<Int, Int>(); val gs = mutableMapOf(sj * w + si to 0.0)
    fun hh(n: Int) = (abs(n % w - gi) + abs(n / w - gj)).toDouble()
    var guard = 0
    while (open.isNotEmpty() && guard++ < 6000) {
        val cur = open.minBy { gs.getValue(it) + hh(it) }
        if (cur == gj * w + gi) {
            val out = mutableListOf(goal)
            var c = cur
            while (came.containsKey(c)) { c = came.getValue(c); out.add(centre(c % w, c / w)) }
            out[out.size - 1] = sx to sy
            return out.reversed()
        }
        open.remove(cur)
        val ci = cur % w; val cj = cur / w
        for ((di, dj) in listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1, 1 to 1, 1 to -1, -1 to 1, -1 to -1)) {
            val ni = ci + di; val nj = cj + dj
            if (ni < 0 || nj < 0 || ni >= w || nj >= h || blocked(ni, nj)) continue
            if (di != 0 && dj != 0 && (blocked(ci + di, cj) || blocked(ci, cj + dj))) continue // (no cutting corners)
            val nn = nj * w + ni; val cost = gs.getValue(cur) + (if (di != 0 && dj != 0) 1.414 else 1.0)
            if (cost < (gs[nn] ?: Double.POSITIVE_INFINITY)) { gs[nn] = cost; came[nn] = cur; open.add(nn) }
        }
    }
    return null
}

/** Enemy AI: patrols, chases what it sees, attacks in range (hurting its Health), gives up and goes home. */
class EnemyAI(p: JsonMap) : Component(p) {
    private var hx = 0.0; private var hy = 0.0; private var dir = 1.0; private var lost = 0.0; private var cool = 0.0; private var state = "patrol"
    override fun start(e: GameObject, g: PocketGame) { hx = e.x; hy = e.y; e.data["state"] = state }
    private fun moveTo(e: GameObject, g: PocketGame, tx: Double, ty: Double, speed: Double, dt: Double) {
        val b = e.body; val grav = g.gravity != 0.0 && b != null && b.isDynamic && b.gravityScale != 0.0
        val dx = tx - e.x; val dy = if (grav) 0.0 else ty - e.y; val l = hypot(dx, dy)
        if (l < 1e-3) { if (b != null && b.isDynamic) { b.vx = 0.0; if (!grav) b.vy = 0.0 }; return }
        val vx = dx / l * speed; val vy = dy / l * speed
        if (b != null && b.isDynamic) { b.vx = vx; if (!grav) b.vy = vy } else { e.x += vx * dt; e.y += vy * dt }
        faceX(e, vx)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val t = g.findAll(s("target", "player")).firstOrNull { it !== e }
        val d = if (t == null) Double.POSITIVE_INFINITY else dist(t.x, t.y, e.x, e.y)
        val sees = t != null && d <= n("sight", 260.0) && (p["needLineOfSight"] == false || g.canSee(e, t))
        cool -= dt
        if (sees) { lost = 0.0; state = if (d <= n("attackRange", 44.0)) "attack" else "chase" }
        else if (state == "chase" || state == "attack") { lost += dt; if (lost > n("giveUp", 3.0)) state = "return" }
        val sp = slowed(e, n("speed", 60.0))
        if (state == "attack" && t != null) {
            moveTo(e, g, e.x, e.y, 0.0, dt)
            if (cool <= 0) {
                cool = n("attackEvery", 1.0)
                val hb = t.part<Health>()
                if (hb != null) hb.damage(t, g, n("damage", 1.0), from = e) else if (t.invuln <= 0) g.hurt(t, "damage")
                g.squash(e, 1.25)
            }
        } else if (state == "chase" && t != null) moveTo(e, g, t.x, t.y, slowed(e, n("chaseSpeed", 140.0)), dt)
        else if (state == "return") { moveTo(e, g, hx, hy, sp, dt); if (dist(e.x, e.y, hx, hy) < 4 || (g.gravity != 0.0 && abs(e.x - hx) < 4)) state = "patrol" }
        else if (n("patrol", 100.0) > 0) { val tx = hx + dir * n("patrol", 100.0); moveTo(e, g, tx, hy, sp, dt); if (abs(e.x - tx) < 3) dir = -dir }
        else moveTo(e, g, e.x, e.y, 0.0, dt)
        e.data["state"] = state
    }
}

/** Loading Screen: fills a variable 0 → 100 like a real loader (with stalls), shows tips, then hides this screen and does an action. */
class Loader(p: JsonMap) : Component(p) {
    private var t = 0.0; private var shownK = 0.0; private var tipT = 0.0; private var tipI = 0; private var running = false; private var waiting = false
    private val tips get() = s("tips").split("|").map { it.trim() }.filter { it.isNotEmpty() }
    override val always get() = true
    private fun begin(e: GameObject, g: PocketGame) {
        t = 0.0; shownK = 0.0; running = true; waiting = false; e.visible = true
        g.setVar(s("var", "loading"), 0.0)
        val tv = s("tipVar", "tip")
        if (tips.isNotEmpty() && tv.isNotEmpty()) g.setVar(tv, tips[tipI++ % tips.size])
    }
    private fun finish(e: GameObject, g: PocketGame) {
        running = false; waiting = false
        g.setVar(s("var", "loading"), 100.0)
        if (s("action").isNotEmpty()) g.runAction(e, p)
        g.send("loaded")
        if (p["hideSelf"] == false) return
        g.tween(e, "alpha", 0.0, max(0.01, n("fade", 0.4)), done = { e.visible = false; e.alpha = 1.0 })
    }
    override fun start(e: GameObject, g: PocketGame) {
        if (p["startOn"] == "on a message") { e.visible = false; g.on { m -> if (!e.dead && m == s("message", "loading")) begin(e, g) } } else begin(e, g)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!running) return
        val tv = s("tipVar", "tip")
        if (!waiting && tips.size > 1 && tv.isNotEmpty()) { tipT += dt; if (tipT >= n("tipEvery", 3.0)) { tipT = 0.0; g.setVar(tv, tips[tipI++ % tips.size]) } }
        if (waiting) { if (g.taps.isNotEmpty()) finish(e, g); return }
        t += dt
        val f = (t / max(0.1, n("seconds", 2.5))).coerceIn(0.0, 1.0)
        val k = when (s("pace", "realistic")) {
            "steady" -> f; "fast then slow" -> 1 - (1 - f).pow(3); "slow then fast" -> f.pow(2.2); "steps" -> if (f >= 1) 1.0 else floor(f * 5) / 5
            else -> (f + 0.06 * sin(f * 17)).coerceIn(0.0, 1.0)
        }
        shownK = max(shownK, k)
        g.setVar(s("var", "loading"), (shownK * 100).roundToInt().toDouble())
        if (f >= 1) { if (on("tapToContinue")) { waiting = true; if (tv.isNotEmpty()) g.setVar(tv, s("tapText", "Tap to continue")) } else finish(e, g) }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// On screen: the game view (drawn every frame), touch and keys, and the title / pause / game-over cards
// ---------------------------------------------------------------------------------------------------------------

@Composable
fun PocketGameView(game: PocketGame) {
    val haptics = LocalHapticFeedback.current
    val density = LocalDensity.current
    val dir = LocalLayoutDirection.current
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
    game.safeLeft = insets.getLeft(density, dir).toFloat(); game.safeRight = insets.getRight(density, dir).toFloat()
    fun has(screen: String) = game.objects.any { it.ui && !it.dead && it.showWhen == screen }
    Box(
        Modifier.fillMaxSize().background(game.background)
            .onSizeChanged { game.screen = Size(it.width.toFloat(), it.height.toFloat()) }
            .focusRequester(focus).focusable()
            .onKeyEvent { ev ->
                if (ev.type == KeyEventType.KeyDown) {
                    game.keys.add(ev.key)
                    if ((ev.key == Key.Enter || ev.key == Key.Spacebar) && game.state != "play") game.start()
                    if (ev.key == Key.Escape && game.state == "play") game.paused = !game.paused
                } else if (ev.type == KeyEventType.KeyUp) game.keys.remove(ev.key)
                true
            }
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        val ev = awaitPointerEvent()
                        for (c in ev.changes) {
                            val id = c.id.value
                            when {
                                c.pressed && !c.previousPressed -> game.pointerDown(id, c.position)
                                !c.pressed && c.previousPressed -> game.pointerUp(id)
                                c.pressed -> game.pointerMove(id, c.position)
                            }
                        }
                    }
                }
            },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            game.frame // (redraw every step)
            drawGame(game, measurer)
        }
        game.frame
        for (panel in game.panels.toList()) panel()
        Column(Modifier.align(Alignment.TopCenter).padding(top = with(density) { (game.screen.height * 0.32f).toDp() }), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((m, _) in game.messages) Text(m, Modifier.background(Color(0xCC000000), RoundedCornerShape(24.dp)).padding(horizontal = 18.dp, vertical = 10.dp), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
        }
        if (game.state == "play" && !game.paused && game.settings["pauseButton"] == true)
            Box(Modifier.align(Alignment.TopEnd).windowInsetsPadding(WindowInsets.safeDrawing).padding(10.dp).size(42.dp).background(Color(0x66000000), CircleShape).clickable { game.paused = true }, contentAlignment = Alignment.Center) {
                Text("❚❚", color = Color.White, fontWeight = FontWeight.Black, fontSize = 14.sp)
            }
        when {
            game.state == "title" && !has("title") && !game.settings["title"]?.toString().isNullOrEmpty() ->
                GameCard(game.settings["title"].toString(), game.settings["subtitle"]?.toString() ?: "", "Play") { game.start() }
            game.paused && game.state == "play" && !has("paused") -> GameCard("PAUSED", "", "Resume") { game.paused = false }
            (game.state == "over" && !has("over")) || (game.state == "win" && !has("win") && !has("over")) -> GameCard(
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

/** Draws the game: the background, the objects in layer order (shapes, emoji, pictures, text, bars), particles,
 *  darkness at night, then the HUD for the screen being shown, the touch controls and floating text. */
private fun DrawScope.drawGame(g: PocketGame, measurer: TextMeasurer) {
    drawRect(g.background)
    val z = g.zoom.toFloat()
    val sh = if (g.shake > 0) Offset(((Random.nextDouble() - 0.5) * g.shake).toFloat(), ((Random.nextDouble() - 0.5) * g.shake).toFloat()) else Offset.Zero
    val world = g.objects.filter { !it.ui && it.shown && !it.dead }.sortedBy { it.layer }
    translate(size.width / 2 + sh.x, size.height / 2 + sh.y) {
        scale(z, z, pivot = Offset.Zero) {
            translate(-g.camX.toFloat(), -g.camY.toFloat()) {
                for (o in world) {
                    if (o.invuln > 0 && floor(o.invuln * 10).toInt() % 2 == 1) continue // (blinks while it can't be hurt)
                    drawObject(g, o, Offset(o.x.toFloat(), o.y.toFloat()), 1f, o.half, measurer)
                }
                for (f in g.worldOverlays.toList()) f()
                for (p in g.particles) {
                    val k = (p.life / p.full).coerceIn(0.0, 1.0); val r = (p.size * (if (p.shrink) max(0.2, k) else if (p.grow) 1 + (1 - k) * 1.5 else 1.0)).toFloat()
                    val col = p.color.copy(alpha = (p.alpha * (if (p.full >= 1) min(1.0, k * 2) else k)).coerceIn(0.0, 1.0).toFloat())
                    val at = Offset(p.x.toFloat(), p.y.toFloat())
                    if (p.stretch > 0) drawLine(col, at, at - Offset((p.vx * 0.012 * p.stretch).toFloat(), (p.vy * 0.012 * p.stretch).toFloat()), r * 0.6f)
                    else if (p.round) drawCircle(col, r, at) else drawRect(col, at - Offset(r * 0.7f, r * 0.4f), Size(r * 1.4f, r * 0.8f))
                }
                for (o in world) drawBars(o)
            }
        }
    }
    if (g.darkness > 0) drawRect(Color(0f, 0f, 20f / 255f, g.darkness.coerceIn(0.0, 0.95).toFloat()))
    fun depth(o: GameObject): Int { var n = 0; var q = o.parent; while (q != null) { n++; q = q.parent }; return n }
    val hud = g.objects.filter { it.ui && it.shown && !it.dead && g.onScreen(it) }.sortedWith(compareBy({ it.layer }, { depth(it) }))
    val k = g.uiK
    for (o in hud) {
        val r = g.uiRect(o)
        drawObject(g, o, r.center, k.toFloat(), Half(r.width / 2 / k, r.height / 2 / k), measurer)
        val cd = numOf(o.data["cooldown"])
        if (cd > 0) drawArc(Color(0x73000000), -90f, (360 * cd).toFloat(), true, topLeft = r.topLeft, size = r.size)
    }
    if (g.state == "play" && !g.paused) drawControls(g, measurer)
    for (f in g.overlays.toList()) f()
    for (f in g.floats) {
        val t = measurer.measure(f.text, TextStyle(color = f.color.copy(alpha = f.life.coerceIn(0.0, 1.0).toFloat()), fontSize = (f.size / density).sp, fontWeight = FontWeight.Black))
        drawText(t, topLeft = f.at - Offset(t.size.width / 2f, t.size.height / 2f))
    }
}

/** The joystick (where the thumb is) and the jump / fire / arrow buttons. */
private fun DrawScope.drawControls(g: PocketGame, measurer: TextMeasurer) {
    val st = g.stick
    if (st != null) {
        val r = (50.0 * g.uiK).toFloat(); val d = st.at - st.start; val k = if (d.getDistance() > r) d / d.getDistance() * r else d
        drawCircle(Color(0x33FFFFFF), r, st.start)
        drawCircle(Color(0x55FFFFFF), r, st.start, style = Stroke(2f))
        drawCircle(Color(0x88FFFFFF), r * 0.45f, st.start + k)
    } else if (g.settings["joystick"] == true && g.time < 4) {
        drawCircle(Color.White.copy(alpha = (0.12 * (1 - g.time / 4)).toFloat()), (50 * g.uiK).toFloat(), Offset(g.safeLeft + 90f, g.screen.height - g.safeBottom - 110f))
    }
    for (b in g.buttons) {
        drawCircle(if (b.finger != null) Color(0x88FFFFFF) else Color(0x44FFFFFF), b.r, b.at)
        drawCircle(Color(0x66FFFFFF), b.r, b.at, style = Stroke(2f))
        val t = measurer.measure(b.label, TextStyle(color = Color.White, fontSize = ((if (b.label.length > 2) b.r * 0.36f else b.r * 0.6f) / density).sp, fontWeight = FontWeight.Black))
        drawText(t, topLeft = b.at - Offset(t.size.width / 2f, t.size.height / 2f))
    }
}

/** Health / hunger bars over an object. */
private fun DrawScope.drawBars(o: GameObject) {
    if (o.bars.isEmpty()) return
    val h = o.half; val w = max(28.0, h.w * 2).toFloat()
    var y = (o.y - h.h - 10).toFloat()
    for ((k, c) in o.bars.values) {
        val left = o.x.toFloat() - w / 2
        drawRoundRect(Color(0x99000000), Offset(left - 1, y - 1), Size(w + 2, 7f), CornerRadius(3f))
        drawRoundRect(c, Offset(left, y), Size(w * k.coerceIn(0.0, 1.0).toFloat(), 5f), CornerRadius(3f))
        y -= 8
    }
}

private fun DrawScope.drawObject(g: PocketGame, o: GameObject, at: Offset, k: Float, half: Half, measurer: TextMeasurer) {
    val pop = numOf(o.data["pop"]); if (pop > 0) o.data["pop"] = max(0.0, pop - 1 / 60.0)
    val flash = numOf(o.data["flash"]); if (flash > 0) o.data["flash"] = flash - 1 / 60.0
    val bump = (1 + pop * 1.2).toFloat(); val alpha = o.alpha.coerceIn(0.0, 1.0).toFloat()
    if (alpha <= 0f) return
    val w = (half.w * 2).toFloat(); val h = (half.h * 2).toFloat()
    translate(at.x, at.y) {
        rotate(o.rz.toFloat(), pivot = Offset.Zero) {
            scale(sign(o.sx).toFloat().let { if (it == 0f) 1f else it } * k * bump, sign(o.sy).toFloat().let { if (it == 0f) 1f else it } * k * bump, pivot = Offset.Zero) { // (the size is in half: stretched HUD objects fill their row)
                val s = o.shape
                if (s != null) drawShape(o, s, w, h, flash > 0, alpha, measurer)
                val sp = o.sprite
                if (sp != null && s == null && sp["src"]?.toString()?.isNotEmpty() == true) // (pictures: a placeholder box; the web build draws the picture)
                    drawRoundRect(Color.White.copy(alpha = 0.25f * alpha), Offset(-w / 2, -h / 2), Size(w, h), CornerRadius(8f))
                val b = o.bar
                if (b != null) {
                    val v = (g.numVar(strOf(b["var"], "xp")) / max(1e-6, numOf(b["max"], 100.0))).coerceIn(0.0, 1.0).toFloat(); val rad = CornerRadius(numOf(b["radius"], 6.0).toFloat())
                    drawRoundRect((parseColor(b["bg"]) ?: Color(0x33FFFFFF)).let { it.copy(alpha = it.alpha * alpha) }, Offset(-w / 2, -h / 2), Size(w, h), rad)
                    drawRoundRect((parseColor(b["fill"]) ?: Color(0xFF5DFF8A)).let { it.copy(alpha = it.alpha * alpha) }, Offset(-w / 2, -h / 2), Size(w * v, h), rad)
                }
                val t = o.text
                if (t != null && t["value"]?.toString()?.isNotEmpty() == true) {
                    val align = t["align"]?.toString() ?: "center"; val color = parseColor(t["color"]) ?: Color.White
                    val wrap = numOf(t["wrap"])
                    val r = measurer.measure(g.fill(t["value"].toString(), o),
                        TextStyle(color = color.copy(alpha = color.alpha * alpha), fontSize = (numOf(t["size"], 16.0) / density).sp, fontWeight = FontWeight((numOf(t["weight"], 800.0).toInt() / 100 * 100).coerceIn(100, 900)),
                            textAlign = if (align == "left") TextAlign.Left else if (align == "right") TextAlign.Right else TextAlign.Center),
                        constraints = if (wrap > 0) Constraints(maxWidth = wrap.toInt()) else Constraints())
                    val dx = if (s != null) -r.size.width / 2f else when (align) { "left" -> 0f; "right" -> -r.size.width.toFloat(); else -> -r.size.width / 2f } // (text on a shape sits in its middle)
                    scale(if (o.sx < 0) -1f else 1f, 1f, pivot = Offset.Zero) { drawText(r, topLeft = Offset(dx, -r.size.height / 2f)) }
                }
            }
        }
    }
}

private fun DrawScope.drawShape(o: GameObject, s: JsonMap, w: Float, h: Float, flash: Boolean, alpha: Float, measurer: TextMeasurer) {
    val type = s["type"]?.toString() ?: "rect"; val r = min(w, h) / 2
    if (type == "emoji") {
        val t = measurer.measure(strOf(s["emoji"], "⭐"), TextStyle(fontSize = (h * 0.92f / density).sp, color = Color.Black.copy(alpha = alpha)))
        scale(if (o.data["flipX"] == true) -1f else 1f, 1f, pivot = Offset.Zero) { drawText(t, topLeft = Offset(-t.size.width / 2f, -t.size.height / 2f)) }
        return
    }
    val path = Path()
    fun poly(pts: List<Pair<Double, Double>>) { pts.forEachIndexed { i, (px, py) -> val x = (px * w / 2).toFloat(); val y = (py * h / 2).toFloat(); if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }; path.close() }
    when (type) {
        "circle" -> path.addOval(Rect(Offset.Zero, r))
        "ring" -> { path.addOval(Rect(Offset.Zero, r)); path.addOval(Rect(Offset.Zero, r * (1 - numOf(s["thickness"], 0.3)).coerceIn(0.1, 0.95).toFloat())); path.fillType = PathFillType.EvenOdd }
        "star" -> {
            val nPts = numOf(s["points"], 5.0).toInt().coerceIn(3, 12); val inner = numOf(s["inner"], 0.45)
            for (i in 0 until nPts * 2) { val a = -PI / 2 + i * PI / nPts; val rr = if (i % 2 == 0) 1.0 else inner; val x = (cos(a) * w / 2 * rr).toFloat(); val y = (sin(a) * h / 2 * rr).toFloat(); if (i == 0) path.moveTo(x, y) else path.lineTo(x, y) }
            path.close()
        }
        "triangle" -> poly(listOf(0.0 to -1.0, 1.0 to 1.0, -1.0 to 1.0))
        "ellipse" -> path.addOval(Rect(Offset(-w / 2, -h / 2), Size(w, h)))
        "diamond" -> poly(listOf(0.0 to -1.0, 1.0 to 0.0, 0.0 to 1.0, -1.0 to 0.0))
        "hexagon" -> poly((0 until 6).map { cos(it * PI / 3) to sin(it * PI / 3) })
        "pentagon" -> poly((0 until 5).map { cos(-PI / 2 + it * 2 * PI / 5) to sin(-PI / 2 + it * 2 * PI / 5) })
        "cross" -> { val t = 0.34; poly(listOf(-t to -1.0, t to -1.0, t to -t, 1.0 to -t, 1.0 to t, t to t, t to 1.0, -t to 1.0, -t to t, -1.0 to t, -1.0 to -t, -t to -t)) }
        "arrow" -> poly(listOf(-1.0 to -0.35, 0.2 to -0.35, 0.2 to -1.0, 1.0 to 0.0, 0.2 to 1.0, 0.2 to 0.35, -1.0 to 0.35))
        "capsule", "pill" -> path.addRoundRect(RoundRect(Rect(Offset(-w / 2, -h / 2), Size(w, h)), CornerRadius(r)))
        "heart" -> { path.moveTo(0f, h * 0.35f); path.cubicTo(-w * 0.55f, -h * 0.05f, -w * 0.45f, -h * 0.55f, 0f, -h * 0.22f); path.cubicTo(w * 0.45f, -h * 0.55f, w * 0.55f, -h * 0.05f, 0f, h * 0.35f); path.close() }
        "line" -> { drawLine((parseColor(s["stroke"]) ?: parseColor(s["fill"]) ?: Color.White).copy(alpha = alpha), Offset(-w / 2, 0f), Offset(w / 2, 0f), numOf(s["lineWidth"], 3.0).toFloat(), StrokeCap.Round); return }
        "polygon" -> {
            val pts = (s["points"] as? List<*>).orEmpty().map { q -> (q as? List<*>)?.takeIf { it.size >= 2 }?.let { Offset(numOf(it[0]).toFloat(), numOf(it[1]).toFloat()) } ?: Offset.Zero }
            if (pts.isNotEmpty()) { pts.forEachIndexed { i, q -> if (i == 0) path.moveTo(q.x, q.y) else path.lineTo(q.x, q.y) }; path.close() } else path.addRect(Rect(Offset(-w / 2, -h / 2), Size(w, h)))
        }
        else -> { val cr = numOf(s["radius"]).toFloat().coerceIn(0f, min(w, h) / 2); path.addRoundRect(RoundRect(Rect(Offset(-w / 2, -h / 2), Size(w, h)), CornerRadius(cr))) }
    }
    val fill = if (flash) Color.White else parseColor(s["fill"]); val fill2 = parseColor(s["fill2"]); val stroke = parseColor(s["stroke"]); val glow = numOf(s["glow"]).toFloat()
    if (s["shadow"] == true && fill != null) translate(0f, 4f) { drawPath(path, Color.Black.copy(alpha = 0.25f * alpha)) }
    val glowCol = fill ?: stroke
    if (glow > 0 && glowCol != null) for (i in 3 downTo 1) { // (a soft glow: a few faint, bigger copies)
        val gk = 1 + glow / max(w, h) * i * 0.5f
        scale(gk, gk, pivot = Offset.Zero) { drawPath(path, glowCol.copy(alpha = 0.12f * alpha)) }
    }
    if (fill != null) {
        if (fill2 != null && !flash) drawPath(path, Brush.verticalGradient(listOf(fill.copy(alpha = fill.alpha * alpha), fill2.copy(alpha = fill2.alpha * alpha)), -h / 2, h / 2))
        else drawPath(path, fill.copy(alpha = fill.alpha * alpha))
    }
    if (stroke != null) drawPath(path, stroke.copy(alpha = stroke.alpha * alpha), style = Stroke(numOf(s["lineWidth"], 2.0).toFloat()))
    if (s["emoji"] != null) {
        val t = measurer.measure(s["emoji"].toString(), TextStyle(fontSize = (min(w, h) * 0.8f / density).sp))
        drawText(t, topLeft = Offset(-t.size.width / 2f, -t.size.height / 2f))
    }
}
