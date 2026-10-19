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
import androidx.compose.ui.draw.alpha
import androidx.compose.material3.Icon
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
import androidx.compose.foundation.border
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset

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
    var anchor = json["anchor"]?.toString() ?: "top-left"
    val showWhen = strOf(json["showWhen"], "always")
    val stretch = strOf(json["stretch"])
    val margin = numOf(json["margin"])
    var shape: MMap? = json["shape"].asMap()?.toMutableMap() // (components change colours; the template keeps its own)
    var text: MMap? = json["text"].asMap()?.toMutableMap()
    var sprite: JsonMap? = json["sprite"].asMap()
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

/** vars: the variables (an app's, when the game shares them with native widgets in its HUD). */
class PocketGame(source: String, vars: MutableMap<String, Any?>? = null) {
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
    val vars: MutableMap<String, Any?> = vars ?: mutableMapOf()
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
    /** The objects (by id) hudWidget draws: the canvas leaves them out. */
    var hudIds: Set<String> = emptySet()
    /** Measures text for components that draw words in overlays (set by the view). */
    var textMeasurer: TextMeasurer? = null
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
        if ((json["items"] as? List<*>).orEmpty().isNotEmpty() || (json["quests"] as? List<*>).orEmpty().isNotEmpty() || (json["dialogues"] as? List<*>).orEmpty().isNotEmpty()) ItemSystems.of(this)
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
    "rules" -> Rules(p); "uiPopup" -> GamePopup(p, false); "uiSheet" -> GamePopup(p, true); "uiPanel" -> GamePanel(p); "uiLayout" -> LayoutGroup(p)
    "uiScroll" -> ScrollBox(p); "uiPopover" -> Popover(p); "uiAppBar" -> GameAppBar(p); "uiBottomNav" -> GameBottomNav(p); "uiSideBar" -> GameSideMenu(p)
    "uiBack" -> BackButtonPart(p); "uiTabIndicator" -> TabIndicator(p)
    "rules" -> Rules(p); "uiPopup" -> GamePopup(p, false); "uiSheet" -> GamePopup(p, true); "uiPanel" -> GamePanel(p); "uiLayout" -> LayoutGroup(p); "uiScroll" -> ScrollBox(p); "uiPopover" -> Popover(p); "uiAppBar" -> GameAppBar(p); "uiBottomNav" -> GameBottomNav(p); "uiSideBar" -> GameSideMenu(p); "uiBack" -> BackButtonPart(p); "uiTabIndicator" -> TabIndicator(p); "uiCrosshair" -> Crosshair(p); "uiOffscreen" -> OffscreenArrows(p); "uiScreenFX" -> ScreenFX(p); "uiSaveSlots" -> SaveSlots(p); "uiTutorial" -> Tutorial(p); "uiShowIf" -> ShowIf(p); "uiAnim" -> UiAnim(p); "uiTooltip" -> HudTooltip(p); "uiNotifications" -> Notifications(p); "navItem" -> NavItem(p); "drawer" -> SideDrawer(p); "dataStat" -> DataStat(p); "netSync" -> NetSync(p); "pfLeaderboard" -> LocalLeaderboard(p); "netRoomList" -> RoomList(p); "netChat" -> ChatBox(p); "tween" -> TweenPart(p); "tweenSequence" -> TweenSequencePart(p); "flipbook" -> Flipbook(p); "animator" -> Animator(p); "spriteSheet" -> SpriteSheet(p); "cameraBrain" -> CameraBrain(p); "cameraSequence" -> CameraSequence(p); "cameraMixer" -> CameraMixer(p); "cameraTargetGroup" -> CameraTargetGroup(p); "cameraZone" -> CameraZone(p); "cameraSwitcher" -> CameraSwitcher(p); "gridMove" -> GridMove(p); "gridEnemy" -> GridEnemy(p); "gridUnit" -> GridUnit(p); "squadControl" -> SquadControl(p); "boardCell" -> BoardCell(p); "turnAction" -> TurnAction(p); "turnOpponent" -> TurnOpponent(p); "inventoryItem" -> InventoryItem(p); "craftingStation" -> CraftingStation(p); "loot" -> Loot(p); "resource" -> ResourceNode(p); "npc" -> Npc(p); "dialogue" -> DialoguePart(p); "uiHotbar" -> InventorySlots(p, true); "uiInventoryGrid" -> InventorySlots(p, false); "uiEquipment" -> EquipmentHud(p); "uiCrafting" -> CraftingHud(p); "uiQuestLog" -> QuestLogHud(p); "uiQuestJournal" -> QuestJournalHud(p); "uiQuestTracker" -> QuestTrackerHud(p); "triggers" -> Triggers(p); "fsm" -> StateMachine(p); "graph" -> VisualScript(p)
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
        val shp = e.shape; if (s("pressColor").isNotEmpty() && shp != null) { if (!e.data.containsKey("fill0")) e.data["fill0"] = shp["fill"]; shp["fill"] = if (down) p["pressColor"] else e.data["fill0"] }
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
    var v = 0.0; var max = 1.0; private var hurtT = 0.0; private var low = false; private var empty = false
    private val items = tagList(p["items"] ?: (if (key == "thirst") "water" else "food"))
    private val amounts: Map<String, Double> = s("amounts").split(",").map { it.trim() }.filter { it.contains(" ") }.associate { it.substring(0, it.lastIndexOf(' ')).lowercase() to numOf(it.split(" ").last()) }
    override fun cares(other: GameObject) = items.any { other.has(it) }
    fun sync(e: GameObject, g: PocketGame) {
        val sv = s("syncVar", key)
        if (sv.isNotEmpty()) g.setVar(sv, v.roundToInt().toDouble())
        val k = v / max; val show = s("showBar", "never")
        if (show == "always" || (show == "when low" && k * 100 <= n("lowAt", 25.0))) e.bars[key] = k to col else e.bars.remove(key)
    }
    fun check(e: GameObject, g: PocketGame) {
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
        game.textMeasurer = measurer
        // HUD objects drawn by native widgets (sliders, toggles, charts, a shop…): each in its place on the screen
        val hw = game.hudWidget
        if (hw != null) for (o in game.objects.filter { it.ui && !it.dead && it.shown && game.onScreen(it) && it.id in game.hudIds }.sortedBy { it.layer }) {
            val w = hw(o) ?: continue
            game.tapTargets.add(o) // (touches on it are for the widget, not the joystick or a jump)
            val r = game.uiRect(o)
            key(o.id) {
                Box(Modifier.offset(with(density) { r.left.toDp() }, with(density) { r.top.toDp() }).width(with(density) { r.width.toDp() }).alpha(o.alpha.coerceIn(0.0, 1.0).toFloat())) { w() }
            }
        }
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
        val dim = numOf(o.data["dimBehind"])
        if (dim > 0 && o.visible) drawRect(Color(0f, 0f, 0f, dim.toFloat())) // (a popup or sheet darkens what's behind it)
        if (o.id in g.hudIds) continue // (a native widget draws it, over the canvas)
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


// makeComponent: "rules" -> Rules(p); "uiPopup" -> GamePopup(p, false); "uiSheet" -> GamePopup(p, true); "uiPanel" -> GamePanel(p); "uiLayout" -> LayoutGroup(p); "uiScroll" -> ScrollBox(p); "uiPopover" -> Popover(p); "uiAppBar" -> GameAppBar(p); "uiBottomNav" -> GameBottomNav(p); "uiSideBar" -> GameSideMenu(p); "uiBack" -> BackButtonPart(p); "uiTabIndicator" -> TabIndicator(p)
// imports: androidx.compose.material3.Icon
// (everything else it uses is already imported by PocketGame.kt; PocketIcons comes from Pocket.kt in the same package)

/** Rules: WHEN something happens (game starts, every few seconds, tapped, touched by a tag, jump / fire button, swipe,
 *  a variable reaches a value, destroyed), IF a variable test passes, DO a list of actions. */
class Rules(p: JsonMap) : Toucher(p) {
    val rules: List<MMap> = (p["rules"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.map { it.toMutableMap().apply { put("_t", 0.0); put("_fired", false); put("_was", false) } }
    override val always get() = true
    fun check(r: JsonMap, g: PocketGame, fallback: String? = null): Boolean {
        val k = strOf(r["ifVar"], fallback ?: "")
        if (k.isEmpty()) return true
        val v = g.numVar(k); val n = numOf(r["ifValue"])
        return when (strOf(r["ifOp"], ">=")) { "<=" -> v <= n; "==" -> v == n; "<" -> v < n; ">" -> v > n; else -> v >= n }
    }
    private fun doAll(r: JsonMap, e: GameObject, g: PocketGame, other: GameObject? = null) {
        for (a in (r["do"] as? List<*>).orEmpty()) a.asMap()?.let { g.runAction(e, mapOf<String, Any?>("sound" to "none") + it, other) }
    }
    fun fire(r: MMap, e: GameObject, g: PocketGame, other: GameObject? = null) {
        if ((onOf(r["once"]) && r["_fired"] == true) || !check(r, g)) return
        r["_fired"] = true
        doAll(r, e, g, other)
    }
    override fun cares(other: GameObject) = rules.any { it["when"] == "touched by tag" && other.has(strOf(it["tag"], "player")) }
    override fun start(e: GameObject, g: PocketGame) { for (r in rules) if (r["when"] == "game starts") fire(r, e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        val playing = g.state == "play" && !g.paused
        for (r in rules) {
            val w = strOf(r["when"])
            if (!playing && !(w == "tapped" && e.ui)) continue
            when (w) {
                "every few seconds" -> { r["_t"] = numOf(r["_t"]) + dt; if (numOf(r["_t"]) >= max(0.05, numOf(r["seconds"], 1.0))) { r["_t"] = 0.0; fire(r, e, g) } }
                "tapped" -> if (e.shown && g.tapsOn(e).isNotEmpty()) fire(r, e, g)
                "jump button" -> if ("jump" in g.pressed) fire(r, e, g)
                "fire button" -> if ("action" in g.pressed) fire(r, e, g)
                "swipe" -> if ("swipe:${strOf(r["dir"], "up")}" in g.pressed) fire(r, e, g)
                "variable reaches" -> {
                    val now = check(r, g, "score")
                    if (now && r["_was"] != true) { r["_was"] = true; doAll(r, e, g) } else if (!now) r["_was"] = false
                }
            }
        }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { for (r in rules) if (r["when"] == "touched by tag" && other.has(strOf(r["tag"], "player"))) fire(r, e, g, other) }
    override fun gone(e: GameObject, g: PocketGame) { for (r in rules) if (r["when"] == "destroyed") fire(r, e, g) }
}

// ---- UI containers and the app's bars in games ----

/** An icon: an emoji as itself, or an icon name as the editor's line icon. */
@Composable
fun barIconOf(icon: String, size: Float, color: Color) {
    if (icon.any { it.code > 0x2000 || it.isSurrogate() }) Text(icon, fontSize = (size * 0.9f).sp)
    else Icon(PocketIcons.nav(icon.ifEmpty { "circle" }), null, Modifier.size(size.dp), tint = color)
}
/** "Label | icon | target" lines. */
fun barLines(v: Any?): List<List<String>> = strOf(v).split("\n").filter { it.isNotBlank() }.map { l -> l.split("|").map { it.trim() } }

/** The page variable's history (Back goes to the page before). */
class PageHistory(val g: PocketGame, val key: String) {
    val stack = mutableListOf<String>()
    var last = strOf(g.vars[key])
    companion object { fun of(g: PocketGame, key: String) = g.systems.getOrPut("pages:$key") { PageHistory(g, key) } as PageHistory }
    fun watch() {
        val now = strOf(g.vars[key])
        if (now != last) {
            if (last.isNotEmpty() && (stack.isEmpty() || stack.last() != now)) stack.add(last)
            if (stack.isNotEmpty() && stack.last() == now) stack.removeAt(stack.size - 1)
            last = now
        }
    }
}

/** Popup and Bottom Sheet: the object (and what's inside it) opens on a message and closes on another, after some seconds,
 *  or with a tap outside; a popup pops in, a sheet slides up; the game behind it darkens. */
class GamePopup(p: JsonMap, val sheet: Boolean) : Component(p) {
    var openedAt = -1.0; var baseY = 0.0; var hooked = false
    override val always get() = true
    fun open(e: GameObject, g: PocketGame) {
        if (e.visible) return
        e.visible = true; openedAt = g.time
        if (sheet) { e.y = baseY + 600; g.tween(e, "y", baseY, 0.35, "outCubic") } else { e.sx = 0.6; e.sy = 0.6; g.tween(e, "sx", 1.0, 0.3, "outBack"); g.tween(e, "sy", 1.0, 0.3, "outBack") }
        g.sfx("click")
    }
    fun close(e: GameObject, g: PocketGame) { if (!e.visible) return; e.visible = false; if (s("message").isNotEmpty()) g.send("${s("message")} closed") }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!hooked) {
            hooked = true; baseY = e.y
            e.visible = on("startOpen")
            val openOn = s("openOn", if (sheet) "open sheet" else "popup"); val closeOn = s("closeOn", if (sheet) "close sheet" else "close")
            g.on { m -> if (!e.dead) { if (m == openOn || m == "${e.name} open") open(e, g) else if (m == closeOn || m == "${e.name} close") close(e, g) } }
        }
        e.data["dimBehind"] = if (e.visible && (if (sheet) p["dim"] != false else p["modal"] != false)) 0.45 else 0.0
        if (!e.visible) return
        g.tapTargets.add(e)
        val auto = n("autoClose")
        if (auto > 0 && openedAt >= 0 && g.time - openedAt >= auto) close(e, g)
        if (sheet || on("tapCloses")) { for (t in g.taps) if (!g.uiRect(e).contains(t.screen) && g.time - openedAt > 0.2) { close(e, g); break } }
    }
}

/** Panel: a window with a title bar (and ✕ to close); opens / closes on messages. */
class GamePanel(p: JsonMap) : Component(p) {
    var hooked = false
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (hooked) {
            if (p["closeButton"] != false && e.visible) {
                val r = g.uiRect(e); val k = g.uiK.toFloat()
                val c = Offset(r.right - 22 * k, r.top + n("headerH", 44.0).toFloat() / 2 * k)
                for (t in g.taps) if ((t.screen - c).getDistance() <= 18 * k) { e.visible = false; if (s("closeMessage").isNotEmpty()) g.send(s("closeMessage")); g.sfx("click") }
            }
            return
        }
        hooked = true
        if (s("openOn").isNotEmpty() || s("closeOn").isNotEmpty()) g.on { m -> if (s("openOn").isNotEmpty() && m == s("openOn")) e.visible = true; if (s("closeOn").isNotEmpty() && m == s("closeOn")) e.visible = false }
        g.overlays.add {
            if (e.dead || !e.shown || !g.onScreen(e)) return@add
            val r = g.uiRect(e); val k = g.uiK.toFloat(); val title = g.fill(s("title"), e); val hh = n("headerH", 44.0).toFloat() * k
            val m = g.textMeasurer
            if (title.isNotEmpty() && m != null) {
                val t = m.measure(title, TextStyle(color = parseColor(p["titleColor"]) ?: Color.White, fontSize = (n("titleSize", 17.0).toFloat() * k / density).sp, fontWeight = FontWeight.ExtraBold), constraints = Constraints(maxWidth = max(1, (r.width - 60 * k).toInt())))
                val x = if (p["titleAlign"] == "center") r.center.x - t.size.width / 2f else r.left + 16 * k
                drawText(t, topLeft = Offset(x, r.top + hh / 2 - t.size.height / 2f))
            }
            if (p["closeButton"] != false) {
                val c = Offset(r.right - 22 * k, r.top + hh / 2); val col = Color(0xCCFFFFFF); val w = 2.2f * k
                drawLine(col, c + Offset(-6 * k, -6 * k), c + Offset(6 * k, 6 * k), w, StrokeCap.Round); drawLine(col, c + Offset(6 * k, -6 * k), c + Offset(-6 * k, 6 * k), w, StrokeCap.Round)
            }
        }
    }
}

/** Layout Group: lays its children out in a column, a row or a grid, with spacing and padding. */
class LayoutGroup(p: JsonMap) : Component(p) {
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val kids = g.objects.filter { it.parent === e && !it.dead && it.visible }.sortedWith(compareBy({ it.layer }, { it.uid }))
        if (kids.isEmpty()) return
        val dir = s("direction", "vertical"); val gap = n("spacing", 12.0); val pad = n("pad", 12.0); val cols = max(1, n("columns", 3.0).toInt())
        val box = e.half
        if (dir == "grid") {
            val cw = (box.w * 2 - pad * 2 - gap * (cols - 1)) / cols
            var y = pad
            for (row in kids.chunked(cols)) {
                val rh = row.maxOf { it.half.h * 2 }
                row.forEachIndexed { j, o -> o.anchor = "top-left"; o.x = pad + j * (cw + gap) + cw / 2; o.y = y + rh / 2 }
                y += rh + gap
            }
            return
        }
        val horiz = dir == "horizontal"
        val total = kids.sumOf { if (horiz) it.half.w * 2 else it.half.h * 2 } + gap * (kids.size - 1)
        val span = if (horiz) box.w * 2 else box.h * 2
        var at = when (s("justify", "center")) { "start" -> pad; "end" -> span - pad - total; else -> (span - total) / 2 }
        for (o in kids) {
            o.anchor = "top-left"
            val w = o.half.w * 2; val h = o.half.h * 2
            if (horiz) { o.x = at + w / 2; o.y = box.h; at += w + gap } else { o.x = box.w; o.y = at + h / 2; at += h + gap }
        }
    }
}

/** Scroll View: drag inside it to scroll what's in it (up and down, or sideways). */
class ScrollBox(p: JsonMap) : Component(p) {
    var off = 0.0; var v = 0.0
    val base = mutableMapOf<Int, Pair<Double, Double>>()
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val kids = g.objects.filter { it.parent === e && !it.dead }
        for (o in kids) base.getOrPut(o.uid) { o.x to o.y }
        if (kids.isEmpty()) return
        val horiz = p["direction"] == "horizontal"; val r = g.uiRect(e); val k = g.uiK
        val ptr = g.pointers.values.firstOrNull { r.contains(it.start) }
        if (ptr != null) {
            g.tapTargets.add(e)
            val d = if (horiz) -g.dragDelta.x / k else -g.dragDelta.y / k
            v = d / max(dt, 1e-3); off += d
        } else { v *= exp(-5 * dt); off += v * dt }
        val extent = kids.maxOf { if (horiz) base[it.uid]!!.first + it.half.w else base[it.uid]!!.second + it.half.h }
        val view = if (horiz) e.half.w * 2 else e.half.h * 2
        off = off.coerceIn(0.0, max(0.0, extent - view / 2 + n("padding", 12.0)))
        for (o in kids) { val b = base[o.uid]!!; if (horiz) o.x = b.first - off else o.y = b.second - off; o.visible = true }
    }
}

/** Popover: a small menu next to it (on a tap or a message): each row sends its message (and can set a variable). */
class Popover(p: JsonMap) : Component(p) {
    var open by mutableStateOf(false)
    var hooked = false
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!hooked) {
            hooked = true
            g.on { m -> if (m == s("message", "more")) open = !open }
            g.panels.add {
                if (!open || e.dead || !e.shown) return@add
                val den = LocalDensity.current.density
                val r = g.uiRect(e); val rows = barLines(p["items"]); val w = (n("width", 200.0) * g.uiK).toFloat()
                val below = r.bottom + rows.size * 46 * den < g.screen.height - 20
                val left = (r.center.x - w / 2).coerceIn(8f, max(8f, g.screen.width - w - 8))
                Box(Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxSize().clickable(remember { MutableInteractionSource() }, indication = null) { open = false })
                    Column(Modifier.offset((left / den).dp, ((if (below) r.bottom + 6 else r.top - 6 - rows.size * 46 * den) / den).dp).width((w / den).dp)
                        .background(Color(0xFF232842), RoundedCornerShape(14.dp))) {
                        for (row in rows) Row(Modifier.fillMaxWidth().height(46.dp).clickable {
                            open = false
                            val pv = s("pickVar"); if (pv.isNotEmpty()) g.setVar(pv, row[0])
                            g.send(if (row.size > 1 && row[1].isNotEmpty()) row[1] else row[0]); g.sfx("click")
                        }.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (row.size > 2) { barIconOf(row[2], 18f, Color.White); Spacer(Modifier.width(10.dp)) }
                            Text(row[0], color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
        g.tapTargets.add(e)
        if (s("opensOn", "tap") == "tap") repeat(g.tapsOn(e).size) { open = !open; g.sfx("click") }
    }
}

/** App Bar in a game: the page's title along the top, ☰ for the side menu, and its buttons (a message or page:name). */
class GameAppBar(p: JsonMap) : Component(p) {
    var hooked = false
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) = hook(e, g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) = hook(e, g)
    private fun hook(e: GameObject, g: PocketGame) {
        if (hooked) return
        hooked = true; e.shape = null; e.text = null
        val key = s("var", "page")
        val titles = s("titles").split("\n").filter { "=" in it }.associate { l -> l.substringBefore("=").trim() to l.substringAfter("=").trim() }
        g.panels.add {
            if (e.dead || !e.shown || !g.onScreen(e)) return@add
            val den = LocalDensity.current.density
            val page = strOf(g.vars[key]); val bg = parseColor(p["bg"]) ?: Color(0xFF12141F); val fg = parseColor(p["text"]) ?: Color.White
            val title = if (s("title").isNotEmpty()) g.fill(s("title")) else titles[page] ?: (if (page.isEmpty()) strOf(g.json["name"], "Game") else page.replaceFirstChar { it.uppercase() })
            val hist = PageHistory.of(g, key).also { it.watch() }
            val left = s("left", "back, else menu"); val canBack = hist.stack.isNotEmpty() && "back" in left
            val acts = barLines(p["actions"] ?: "bell | notifications | unread\nsearch | search")
            Column(Modifier.fillMaxWidth().background(bg).padding(top = (g.safeTop / den).dp)) {
                Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                    when {
                        canBack -> Box(Modifier.size(48.dp).clickable { g.setVar(key, hist.stack.removeAt(hist.stack.size - 1)); hist.last = strOf(g.vars[key]) }, contentAlignment = Alignment.Center) { barIconOf("back", 24f, fg) }
                        "menu" in left -> Box(Modifier.size(48.dp).clickable { g.send(s("menuMessage", "menu")) }, contentAlignment = Alignment.Center) { barIconOf("menu", 24f, fg) }
                        else -> Spacer(Modifier.width(16.dp))
                    }
                    Text(title, Modifier.weight(1f), color = fg, fontSize = n("titleSize", 19.0).sp, fontWeight = FontWeight.ExtraBold, textAlign = if (p["titleAlign"] == "center") TextAlign.Center else TextAlign.Start)
                    for (a in acts.take(4)) Box(Modifier.size(48.dp).clickable {
                        val does = if (a.size > 1) a[1] else a[0]
                        if (does.startsWith("page:")) g.setVar(key, does.removePrefix("page:")) else g.send(does)
                    }, contentAlignment = Alignment.Center) { barIconOf(a[0], 24f, parseColor(p["iconColor"]) ?: fg) }
                }
            }
        }
    }
}

/** Bottom Nav in a game: tabs along the bottom; tapping one sets the page variable. */
class GameBottomNav(p: JsonMap) : Component(p) {
    var hooked = false
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) = hook(e, g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) = hook(e, g)
    private fun target(t: List<String>) = if (t.size > 2) t[2] else t[0].lowercase()
    private fun hook(e: GameObject, g: PocketGame) {
        if (hooked) return
        hooked = true; e.shape = null; e.text = null
        val key = s("var", "page"); val tabs = barLines(p["tabs"] ?: "Home | home | home\nShop | shop | shop\nProfile | user | profile")
        if (strOf(g.vars[key]).isEmpty() && tabs.isNotEmpty()) g.setVar(key, target(tabs[(n("start", 1.0).toInt() - 1).coerceIn(0, tabs.size - 1)]))
        g.panels.add {
            if (e.dead || !e.shown || !g.onScreen(e)) return@add
            val den = LocalDensity.current.density
            val page = strOf(g.vars[key]); val onC = parseColor(p["activeColor"]) ?: Color(0xFF4FA3FF); val offC = parseColor(p["idleColor"]) ?: Color(0xFF8B90A5)
            Box(Modifier.fillMaxSize()) {
                Row(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(parseColor(p["barColor"]) ?: Color(0xFF12141F)).padding(bottom = (g.safeBottom / den).dp).height(62.dp)) {
                    for (t in tabs) {
                        val sel = page == target(t); val c = if (sel) onC else offC
                        Column(Modifier.weight(1f).fillMaxHeight().clickable { g.setVar(key, target(t)); g.sfx("click") }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            barIconOf(if (t.size > 1) t[1] else "circle", 24f, c)
                            if (p["labels"] != "never") Text(t[0], color = c, fontSize = 11.5.sp, fontWeight = if (sel) FontWeight.ExtraBold else FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

/** Side Menu in a game: slides in on its message (☰), with a header and rows that open a page or send a message (msg:name). */
class GameSideMenu(p: JsonMap) : Component(p) {
    var hooked = false
    var open by mutableStateOf(false)
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) = hook(e, g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) = hook(e, g)
    private fun hook(e: GameObject, g: PocketGame) {
        if (hooked) return
        hooked = true; e.shape = null; e.text = null
        val key = s("var", "page"); val msg = s("message", "menu")
        g.on { m -> if (m == msg || m == "$msg open") open = if (m == msg) !open else true; if (m == "$msg close") open = false }
        fun pick(row: List<String>) {
            open = false
            val to = if (row.size > 2) row[2] else row[0].lowercase()
            if (to.startsWith("msg:")) g.send(to.removePrefix("msg:")) else g.setVar(key, to)
            g.sfx("click")
        }
        g.panels.add {
            if (!open || e.dead) return@add
            val den = LocalDensity.current.density
            val bg = parseColor(p["bg"]) ?: Color(0xFF151826); val fg = parseColor(p["text"]) ?: Color(0xFFE8EAF2); val ac = parseColor(p["accent"]) ?: Color(0xFF4FA3FF)
            val right = p["side"] == "right"; val page = strOf(g.vars[key]); val w = min(300f, g.screen.width / den * 0.8f)
            @Composable fun row(r: List<String>) {
                val sel = page == (if (r.size > 2) r[2] else r[0].lowercase())
                Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 2.dp).background(if (sel) ac.copy(alpha = 0.18f) else Color.Transparent, RoundedCornerShape(12.dp))
                    .clickable { pick(r) }.padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    barIconOf(if (r.size > 1) r[1] else "circle", 22f, if (sel) ac else fg); Spacer(Modifier.width(14.dp))
                    Text(r[0], color = if (sel) ac else fg, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }
            Box(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxSize().background(Color(0x80000000)).clickable(remember { MutableInteractionSource() }, indication = null) { open = false })
                Column(Modifier.align(if (right) Alignment.CenterEnd else Alignment.CenterStart).fillMaxHeight().width(w.dp).background(bg)
                    .padding(top = (g.safeTop / den + 16).dp, bottom = (g.safeBottom / den + 12).dp)) {
                    Row(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(48.dp).background(ac.copy(alpha = 0.25f), CircleShape), contentAlignment = Alignment.Center) { barIconOf(s("avatar", "🙂"), 26f, fg) }
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(g.fill(s("title", "My Game")), color = fg, fontSize = 18.sp, fontWeight = FontWeight.Black)
                            if (s("subtitle").isNotEmpty()) Text(g.fill(s("subtitle")), color = fg.copy(alpha = 0.6f), fontSize = 13.sp)
                        }
                    }
                    for (r in barLines(p["items"] ?: "Home | home | home\nShop | shop | shop")) row(r)
                    Spacer(Modifier.weight(1f))
                    for (r in barLines(p["footer"] ?: "Help | info | msg:help")) row(r)
                }
            }
        }
    }
}

/** Back button: goes to the page before (the page variable's history), or a fallback page; hides when there's nowhere to go. */
class BackButtonPart(p: JsonMap) : Component(p) {
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val key = s("var", "page"); val h = PageHistory.of(g, key).also { it.watch() }; val fb = s("fallback")
        if (p["hide"] != false) e.visible = h.stack.isNotEmpty() || fb.isNotEmpty()
        if (e.ui) g.tapTargets.add(e)
        repeat(g.tapsOn(e).size) {
            if (h.stack.isNotEmpty()) { g.setVar(key, h.stack.removeAt(h.stack.size - 1)); h.last = strOf(g.vars[key]) } else if (fb.isNotEmpty()) g.setVar(key, fb)
            g.send("go back"); g.sfx("click")
        }
    }
}

/** Tab Indicator: the Bottom Nav draws its own, so it's nothing to draw here. */
class TabIndicator(p: JsonMap) : Component(p)


// makeComponent: "uiCrosshair" -> Crosshair(p), "uiOffscreen" -> OffscreenArrows(p), "uiScreenFX" -> ScreenFX(p), "uiSaveSlots" -> SaveSlots(p), "uiTutorial" -> Tutorial(p), "uiShowIf" -> ShowIf(p), "uiAnim" -> UiAnim(p), "uiTooltip" -> HudTooltip(p), "uiNotifications" -> Notifications(p), "navItem" -> NavItem(p), "drawer" -> SideDrawer(p), "dataStat" -> DataStat(p), "netSync" -> NetSync(p), "pfLeaderboard" -> LocalLeaderboard(p), "netRoomList" -> RoomList(p), "netChat" -> ChatBox(p),
// imports: androidx.compose.foundation.rememberScrollState, androidx.compose.foundation.verticalScroll, androidx.compose.ui.text.TextLayoutResult, androidx.compose.ui.text.style.TextOverflow, androidx.compose.ui.graphics.drawscope.clipRect, androidx.compose.ui.unit.IntOffset

// ---------------------------------------------------------------------------------------------------------------
// Game HUD: crosshair, off-screen arrows, screen effects, save slots, tutorial, Show If pages, UI animation, tooltips,
// notifications; tabs (Nav Item) and the slide-in Side Bar; Data Summary; and the online parts, played offline
// (a local leaderboard of your best scores, your own chat, an empty room list).
// ---------------------------------------------------------------------------------------------------------------

/** The text measurer HUD drawing uses (kept by a tiny panel, since overlays are plain canvas drawing). */
fun hudMeasurer(g: PocketGame): TextMeasurer? = g.systems["hudMeasurer"] as? TextMeasurer
/** Makes sure HUD drawing can measure text (once per game). */
fun hudNeedText(g: PocketGame) {
    if (g.systems["hudMeasurerPanel"] == true) return
    g.systems["hudMeasurerPanel"] = true
    g.panels.add(0) { val m = rememberTextMeasurer(); g.systems["hudMeasurer"] = m }
}
/** Text laid out for drawing on the HUD canvas (one line, cut with … when wider than maxW; maxLines 0 = as many as it needs). */
fun hudTp(m: TextMeasurer, t: String, size: Double, color: Color, density: Float, weight: FontWeight = FontWeight.Bold, maxW: Double = Double.POSITIVE_INFINITY, maxLines: Int = 1): TextLayoutResult =
    m.measure(t, TextStyle(color = color, fontSize = (size / density).sp, fontWeight = weight), overflow = if (maxLines > 0) TextOverflow.Ellipsis else TextOverflow.Clip,
        maxLines = if (maxLines > 0) maxLines else Int.MAX_VALUE, constraints = if (maxW.isFinite()) Constraints(maxWidth = max(1, maxW.toInt())) else Constraints())
/** Draws text centred on y; align left / center / right of x. */
fun DrawScope.hudText(g: PocketGame, t: String, x: Double, y: Double, size: Double = 14.0, weight: FontWeight = FontWeight.Bold, color: Color = Color.White, align: String = "center", maxW: Double = Double.POSITIVE_INFINITY) {
    val m = hudMeasurer(g) ?: return
    if (t.isEmpty()) return
    val tp = hudTp(m, t, size, color, density, weight, maxW)
    val w = tp.size.width.toDouble(); val h = tp.size.height.toDouble()
    drawText(tp, topLeft = Offset((if (align == "left") x else if (align == "right") x - w else x - w / 2).toFloat(), (y - h / 2).toFloat()))
}
/** A colour setting (or its default). */
fun hudColor(v: Any?, d: String): Color = parseColor(v) ?: parseColor(d) ?: Color.White
/** The component draws the whole look itself: the object's own shape and text go (its size stays, for its box). */
fun hudOwnLook(e: GameObject) {
    e.shape?.let { s -> if (s["type"] == "emoji") s["type"] = "rect"; s["fill"] = null; s["fill2"] = null; s["stroke"] = null; s["glow"] = 0.0; s["emoji"] = null; s["shadow"] = false }
    e.text?.let { it["value"] = "" }
}
/** Is a HUD object showing now (not hidden, not dead, on the screen being shown)? */
fun hudLive(e: GameObject, g: PocketGame) = !e.dead && e.shown && g.onScreen(e)
/** A full-screen panel that draws on a canvas (so it sits over other panels: a tutorial's spotlight, notifications). */
fun hudCanvasPanel(g: PocketGame, show: () -> Boolean, draw: DrawScope.() -> Unit): @Composable () -> Unit = {
    g.frame
    if (show()) Canvas(Modifier.fillMaxSize()) { g.frame; draw() }
}
/** The children of an object (HUD pages, tab groups). */
fun hudKids(g: PocketGame, e: GameObject) = g.objects.filter { it.parent === e && !it.dead }
/** Same value, as text (page = home). */
fun hudSame(a: Any?, b: Any?) = strOf(a) == strOf(b)
private fun Color.a(k: Double) = copy(alpha = (alpha * k).coerceIn(0.0, 1.0).toFloat())
private fun fo(x: Double, y: Double) = Offset(x.toFloat(), y.toFloat())

/** Crosshair: an aiming reticle in many looks; spreads when you fire (a message) or move, and shows a hit marker on a message. */
class Crosshair(p: JsonMap) : Component(p) {
    var spread = 0.0; var hit = 0.0
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) {
        hudOwnLook(e)
        g.on { m -> if (!e.dead) { if (m == s("spreadOn", "fire")) spread = min(1.0, spread + 0.6); if (m == s("hitOn", "hit")) hit = 1.0 } }
        g.overlays.add { draw(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        var mv = 0.0
        if (p["spreadMove"] != false) g.findAll("player").firstOrNull()?.body?.let { b -> mv = hypot(b.vx, b.vy) / 300 }
        spread = max(min(0.6, mv), spread - dt * 3); hit = max(0.0, hit - dt * 3)
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (!hudLive(e, g)) return
        val at = g.uiRect(e).center; val ax = at.x.toDouble(); val ay = at.y.toDouble()
        val sz = n("size", 10.0); val gap = n("gap", 5.0) + spread * 14; val th = n("thickness", 2.0).toFloat(); val col = hudColor(p["color"], "#ffffff"); val look = s("look", "cross + dot")
        val path = Path()
        if (look.startsWith("cross") || look == "T") for ((dx, dy) in listOf(1.0 to 0.0, -1.0 to 0.0, 0.0 to 1.0, 0.0 to -1.0)) {
            if (look == "T" && dy < 0) continue
            path.moveTo((ax + dx * gap).toFloat(), (ay + dy * gap).toFloat()); path.lineTo((ax + dx * (gap + sz)).toFloat(), (ay + dy * (gap + sz)).toFloat())
        }
        if (look.startsWith("circle")) { val r = (gap + sz * 0.8).toFloat(); path.addOval(Rect(at - Offset(r, r), Size(r * 2, r * 2))) }
        if (look == "chevron") { path.moveTo((ax - sz).toFloat(), (ay + gap + sz * 0.6).toFloat()); path.lineTo(ax.toFloat(), (ay + gap).toFloat()); path.lineTo((ax + sz).toFloat(), (ay + gap + sz * 0.6).toFloat()) }
        if (look == "brackets") { val r = gap + sz; for (sx in listOf(-1.0, 1.0)) { path.moveTo((ax + sx * r * 0.6).toFloat(), (ay - r).toFloat()); path.lineTo((ax + sx * r).toFloat(), (ay - r).toFloat()); path.lineTo((ax + sx * r).toFloat(), (ay + r).toFloat()); path.lineTo((ax + sx * r * 0.6).toFloat(), (ay + r).toFloat()) } }
        val outline = p["outline"] != false
        if (outline) drawPath(path, Color(0x99000000), style = Stroke(th + 2, cap = StrokeCap.Round))
        drawPath(path, col, style = Stroke(th, cap = StrokeCap.Round))
        if ("dot" in look) { if (outline) drawCircle(Color(0x99000000), th + 1, at); drawCircle(col, th, at) }
        if (hit > 0) {
            val hc = hudColor(p["hitColor"], "#ff4d5e").a(hit)
            for ((dx, dy) in listOf(1f to 1f, -1f to 1f, 1f to -1f, -1f to -1f)) drawLine(hc, at + Offset(dx * 6, dy * 6), at + Offset(dx * 13, dy * 13), th + 0.5f, StrokeCap.Round)
        }
    }
}

/** Off-screen Arrows: arrows at the screen edge pointing to objects you can't see (with their distance); optional markers over the ones you can. */
class OffscreenArrows(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { hudOwnLook(e); hudNeedText(g); g.overlays.add { draw(e, g) } }
    /** The things it points at: where on the screen, how far from the player, and whether they're off the screen. */
    fun targets(e: GameObject, g: PocketGame): List<Triple<Offset, Double, Boolean>> {
        val tag = s("tag", "enemy"); val me = g.findAll("player").firstOrNull(); val m = n("margin", 28.0); val W = g.screen.width; val H = g.screen.height
        val seen = mutableSetOf<GameObject>()
        val list = (listOf(g.find(tag)) + g.findAll(tag)).filterNotNull().filter { !it.dead && it.visible && it !== e && !it.ui && seen.add(it) }
        val out = list.map { q -> g.toScreen(q.x, q.y) to (if (me == null) 0.0 else hypot(q.x - me.x, q.y - me.y)) }.sortedBy { it.second }
        return out.take(n("max", 5.0).toInt()).map { (sp, d) -> Triple(sp, d, sp.x < m || sp.x > W - m || sp.y < m + g.safeTop || sp.y > H - m - g.safeBottom) }
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (!hudLive(e, g) || g.state != "play") return
        val W = g.screen.width.toDouble(); val H = g.screen.height.toDouble(); val m = n("margin", 28.0); val sz = n("size", 18.0).toFloat(); val col = hudColor(p["color"], "#ff4d5e"); val look = s("look", "arrow"); val me = g.findAll("player").firstOrNull()
        for ((sp, d, off) in targets(e, g)) {
            if (!off) {
                if (on("onScreen")) drawPath(Path().apply { moveTo(sp.x - 7, sp.y - 34); lineTo(sp.x + 7, sp.y - 34); lineTo(sp.x, sp.y - 24); close() }, col)
                continue
            }
            val dx = sp.x - W / 2; val dy = sp.y - H / 2; val a = atan2(dy, dx)
            val kx = (W / 2 - m) / max(1e-6, abs(cos(a))); val ky = (H / 2 - m - max(g.safeTop, g.safeBottom)) / max(1e-6, abs(sin(a))); val k = min(kx, ky)
            val x = W / 2 + cos(a) * k; val y = H / 2 + sin(a) * k
            translate(x.toFloat(), y.toFloat()) {
                when (look) {
                    "dot" -> drawCircle(col.a(0.92), sz * 0.45f, Offset.Zero)
                    "icon" -> {
                        drawCircle(Color(0x80000000), sz * 0.8f, Offset.Zero)
                        hudMeasurer(g)?.let { mm -> val tp = hudTp(mm, s("icon", "❗"), sz * 0.9, col, density); drawText(tp, topLeft = Offset(-tp.size.width / 2f, -tp.size.height / 2f)) }
                        rotate((a * 180 / PI).toFloat(), pivot = Offset.Zero) { drawPath(Path().apply { moveTo(sz * 1.25f, 0f); lineTo(sz * 0.85f, -5f); lineTo(sz * 0.85f, 5f); close() }, col) }
                    }
                    else -> rotate((a * 180 / PI).toFloat(), pivot = Offset.Zero) {
                        val path = if (look == "chevron") Path().apply { moveTo(sz * 0.6f, 0f); lineTo(-sz * 0.4f, -sz * 0.6f); lineTo(-sz * 0.1f, 0f); lineTo(-sz * 0.4f, sz * 0.6f); close() }
                        else Path().apply { moveTo(sz * 0.7f, 0f); lineTo(-sz * 0.5f, -sz * 0.55f); lineTo(-sz * 0.5f, sz * 0.55f); close() }
                        drawPath(path, col.a(0.92))
                        drawPath(path, Color(0x66000000), style = Stroke(2f))
                    }
                }
            }
            if (p["distance"] != false && me != null) hudText(g, "${(d / 10).roundToInt()}m", x - cos(a) * sz * 1.4, y - sin(a) * sz * 1.4, size = 11.0, weight = FontWeight.ExtraBold)
        }
    }
}

/** Screen Effects: a red flash when a variable (health) drops, a pulsing vignette when it's low, a white flash and confetti on messages (and when you win). */
class ScreenFX(p: JsonMap) : Component(p) {
    var hurt = 0.0; var flash = 0.0; var beat = 0.0
    var last: Double? = null
    /** A piece of confetti. */
    class Bit(var x: Double, var y: Double, var vx: Double, var vy: Double, var r: Double, val vr: Double, val w: Double, val col: Color) { var age = 0.0 }
    val bits = mutableListOf<Bit>()
    override val always get() = true
    fun value(g: PocketGame): Double? { val v = g.vars[s("hurtVar", "hp")]; return if (v == null || v.toString().isEmpty()) null else numOf(v) }
    fun confetti(g: PocketGame) {
        val cols = listOf(Color(0xFFE53935), Color(0xFFFDD835), Color(0xFF43A047), Color(0xFF1E88E5), Color(0xFF8E24AA), Color(0xFFFF7043))
        repeat(n("amount", 120.0).toInt()) { bits.add(Bit(rand(0.0, g.screen.width.toDouble()), -20 - rand(0.0, 200.0), rand(-80.0, 80.0), rand(80.0, 260.0), rand(0.0, 6.0), rand(-5.0, 5.0), rand(6.0, 12.0), cols[Random.nextInt(cols.size)])) }
    }
    override fun start(e: GameObject, g: PocketGame) {
        hudOwnLook(e)
        last = value(g)
        g.on { m ->
            if (!e.dead) {
                if (m == s("flashOn", "flash")) flash = 1.0
                if (m == s("confettiOn", "celebrate")) confetti(g)
                if (m == "won" && p["confettiOnWin"] != false) confetti(g)
            }
        }
        g.overlays.add { draw(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val v = value(g); val l = last
        if (v != null && l != null && v < l) { hurt = 1.0; g.buzz() }
        last = v
        hurt = max(0.0, hurt - dt * 2.2); flash = max(0.0, flash - dt * 3); beat += dt
        for (b in bits) { b.age += dt; b.vy += 120 * dt; b.x += (b.vx + sin(b.age * 4 + b.r) * 30) * dt; b.y += b.vy * dt; b.r += b.vr * dt }
        bits.removeAll { it.y > g.screen.height + 30 }
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (e.dead || !e.shown) return
        val v = value(g); val lowAt = n("lowAt", 25.0); val low = lowAt > 0 && v != null && v <= lowAt && v > 0
        val va = max(hurt * 0.75, if (low) 0.25 + sin(beat * 5) * 0.15 else 0.0); val hc = hudColor(p["hurt"], "#ff2a3d")
        if (va > 0.01) drawRect(Brush.radialGradient(0.45f to hc.copy(alpha = 0f), 1f to hc.a(va), center = center, radius = max(1f, hypot(size.width, size.height) / 2)))
        if (flash > 0.01) drawRect(hudColor(p["flashColor"], "#ffffff").a(flash * 0.7))
        for (b in bits) {
            translate(b.x.toFloat(), b.y.toFloat()) {
                rotate((b.r * 180 / PI).toFloat(), pivot = Offset.Zero) {
                    scale(1f, abs(cos(b.age * 6 + b.r)).toFloat().coerceAtLeast(0.02f), pivot = Offset.Zero) { drawRect(b.col, Offset((-b.w / 2).toFloat(), (-b.w * 0.3).toFloat()), Size(b.w.toFloat(), (b.w * 0.6).toFloat())) }
                }
            }
        }
    }
}

/** Save Slots: a card for each save slot (its name, when it was saved, time played); tap to load it or to save there, with a delete button. */
class SaveSlots(p: JsonMap) : Component(p) {
    /** A slot waiting for a second tap ("save" over it / "del"), and a short note on a slot ("Saved ✓"). */
    var pend: Triple<Int, String, Double>? = null
    var flash: Triple<Int, String, Double>? = null
    override val always get() = true
    fun slots(g: PocketGame): List<Int> { val c = (if (n("slots") > 0) n("slots").roundToInt() else numOf(g.settings["saveSlots"], 3.0).roundToInt()).coerceIn(1, 10); return (1..c).toList() }
    fun metaKey(g: PocketGame, k: Int) = "pocket.slotmeta.${g.saveKey}.$k"
    fun meta(g: PocketGame, k: Int): JsonMap? { if (!g.hasSave(k)) return null; return stored(metaKey(g, k))?.let { parseJson(it).asMap() } ?: emptyMap() }
    companion object {
        fun ago(ms: Double): String {
            val d = nowMs() - ms
            return when { d < 60000 -> "just now"; d < 3600000 -> "${(d / 60000).toInt()} min ago"; d < 86400000 -> "${(d / 3600000).toInt()} h ago"; else -> "${(d / 86400000).toInt()} d ago" }
        }
    }
    fun done(g: PocketGame) { if (s("message").isNotEmpty()) g.send(s("message")) }
    fun doSave(g: PocketGame, k: Int) {
        if (g.state != "play") return
        val label = if (s("nameVar").isEmpty()) "" else strOf(g.vars[s("nameVar")])
        if (g.saveGame(k)) {
            store(metaKey(g, k), toJsonValue(mapOf("label" to label, "at" to nowMs(), "played" to g.time)).toString())
            flash = Triple(k, "Saved ✓", 1.4); g.sfx("coin"); done(g)
        }
    }
    fun doLoad(g: PocketGame, k: Int) {
        if (!g.hasSave(k)) { flash = Triple(k, "Empty", 1.0); return }
        if (g.state != "play") g.start()
        if (g.loadGame(k)) done(g)
    }
    fun doDelete(g: PocketGame, k: Int) { g.deleteSave(k); store(metaKey(g, k), ""); flash = Triple(k, "Deleted", 1.2) }
    /** A tap on a slot (act: save / load / del), with the engine's "tap again" for saving over a slot and deleting. */
    fun tap(g: PocketGame, k: Int, act: String) {
        g.sfx("click")
        val pd = pend
        if (act == "del") { if (pd != null && pd.first == k && pd.second == "del") { pend = null; doDelete(g, k) } else pend = Triple(k, "del", 2.5); return }
        if (act == "save") { if (g.hasSave(k) && p["confirm"] != false && !(pd != null && pd.first == k && pd.second == "save")) { pend = Triple(k, "save", 2.5); return }; pend = null; doSave(g, k); return }
        doLoad(g, k)
    }
    override fun start(e: GameObject, g: PocketGame) { hudOwnLook(e); g.tapTargets.add(e); g.panels.add { Ui(e, g) } }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        g.tapTargets.add(e)
        flash?.let { f -> flash = if (f.third - dt <= 0) null else Triple(f.first, f.second, f.third - dt) }
        pend?.let { f -> pend = if (f.third - dt <= 0) null else Triple(f.first, f.second, f.third - dt) }
    }
    @Composable
    private fun Ui(e: GameObject, g: PocketGame) {
        g.frame
        if (!hudLive(e, g)) return
        val d = LocalDensity.current
        val r = g.uiRect(e); val txt = hudColor(p["text"], "#ffffff"); val acc = hudColor(p["accent"], "#4fa3ff"); val dg = hudColor(p["danger"], "#ff5c6c"); val card = hudColor(p["card"], "#232842")
        val mode = s("mode", "loads it"); val both = mode.startsWith("saves or loads"); val saving = mode == "saves there"
        Box(Modifier.offset { IntOffset(r.left.toInt(), r.top.toInt()) }.size(with(d) { r.width.toDp() }, with(d) { r.height.toDp() })
            .background(parseColor(p["bg"] ?: "#181c2c") ?: Color(0xFF181C2C), RoundedCornerShape(20.dp)).padding(start = 12.dp, top = 12.dp, end = 12.dp, bottom = 2.dp)) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                val title = s("title", "Saved games")
                if (title.isNotEmpty()) Text(title, Modifier.padding(start = 6.dp, top = 2.dp, bottom = 12.dp), color = txt, fontSize = 19.sp, fontWeight = FontWeight.Black)
                for (k in slots(g)) {
                    val m = meta(g, k); val exists = m != null; val P = pend?.takeIf { it.first == k }; val F = flash?.takeIf { it.first == k }
                    val name = if (exists && strOf(m?.get("label")).isNotEmpty()) strOf(m?.get("label")) else s("slotName", "Slot {n}").replace("{n}", "$k")
                    val head = if (P != null) (if (P.second == "del") "Tap again to delete" else "Tap again to save over it") else F?.second ?: name
                    val sub = if (exists) listOfNotNull(m?.get("at")?.let { ago(numOf(it)) }, m?.get("played")?.let { "${ceil(numOf(it) / 60).toInt()} min played" }).joinToString(" · ") else if (saving) "Empty: tap to save" else "Empty"
                    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp).background(if (F != null) mixColor(card, acc, 0.25) else card, RoundedCornerShape(16.dp))
                        .clickable { tap(g, k, if (both) (if (exists) "load" else "save") else if (saving) "save" else "load") }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (p["pictures"] != false) Box(Modifier.size(56.dp, 44.dp).background(if (exists) acc.copy(alpha = 0.35f) else Color(0x0FFFFFFF), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                            Text(if (exists) "⤓" else "+", color = txt.copy(alpha = 0.8f), fontSize = 20.sp, fontWeight = FontWeight.Black)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(head, maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (P != null) (if (P.second == "del") dg else acc) else txt, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                            if (sub.isNotEmpty() && P == null && F == null) Text(sub, maxLines = 1, overflow = TextOverflow.Ellipsis, color = txt.copy(alpha = 0.6f), fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                        }
                        if (both) Column {
                            Text("Save", Modifier.padding(vertical = 2.dp).background(acc, RoundedCornerShape(16.dp)).clickable { tap(g, k, "save") }.padding(horizontal = 14.dp, vertical = 6.dp), color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Load", Modifier.padding(vertical = 2.dp).background(txt.copy(alpha = if (exists) 0.14f else 0.06f), RoundedCornerShape(16.dp)).clickable { tap(g, k, "load") }.padding(horizontal = 14.dp, vertical = 6.dp), color = txt.copy(alpha = if (exists) 1f else 0.35f), fontSize = 13.5.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        if (p["allowDelete"] != false && exists) Box(Modifier.padding(start = 6.dp).size(32.dp).background(if (P?.second == "del") dg else dg.copy(alpha = 0.16f), CircleShape).clickable { tap(g, k, "del") }, contentAlignment = Alignment.Center) {
                            Text("✕", color = if (P?.second == "del") Color.White else dg, fontSize = 15.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }
}

/** Tutorial (coach marks): step-by-step tips that point at things (an object, or x%,y% of the screen): the screen darkens except a spotlight, with a bubble, Next and Skip. Can run only the first time. */
class Tutorial(p: JsonMap) : Component(p) {
    var steps = listOf<Triple<String, String, Double>>()
    var idx = -1
    var t = 0.0
    var spot: Pair<Offset, Double>? = null
    var skip: Rect? = null
    var pausedIt = false
    var guard: GameObject? = null
    var key = ""
    override val always get() = true
    val active get() = idx >= 0
    fun begin(e: GameObject, g: PocketGame) {
        if (steps.isEmpty() || active) return
        if (p["once"] != false && stored(key) == "1") return
        idx = 0; t = 0.0; spot = null
        if (p["pause"] != false && g.state == "play" && !g.paused) {
            pausedIt = true; g.paused = true
            // (a hidden "paused" screen object, so the runtime's PAUSED card stays away while the tutorial shows)
            val o = GameObject(mapOf("name" to "Tutorial pause", "ui" to true, "visible" to false, "showWhen" to "paused"), g)
            g.objects.add(o); guard = o
        }
    }
    fun finish(e: GameObject, g: PocketGame) {
        if (!active) return
        idx = -1
        if (pausedIt) { pausedIt = false; g.paused = false; guard?.dead = true; guard = null }
        if (p["once"] != false) store(key, "1")
        g.send(s("doneMessage", "tutorial done"))
    }
    /** Where the spotlight goes for a step (screen pixels) and how big it is. */
    fun where(g: PocketGame, st: Triple<String, String, Double>): Pair<Offset, Double> {
        val m = Regex("^\\s*(-?[\\d.]+)%\\s*,\\s*(-?[\\d.]+)%\\s*$").find(st.second)
        if (m != null) return fo(g.screen.width * m.groupValues[1].toDouble() / 100, g.screen.height * m.groupValues[2].toDouble() / 100) to st.third
        val q = if (st.second.isEmpty()) null else g.find(st.second)
        if (q == null) return fo(g.screen.width / 2.0, g.screen.height / 2.0) to 0.0
        if (q.ui) { val r = g.uiRect(q); return r.center to (if (st.third > 0) st.third else max(r.width, r.height) * 0.6 + 10) }
        return g.toScreen(q.x, q.y) to (if (st.third > 0) st.third else 50.0)
    }
    override fun start(e: GameObject, g: PocketGame) {
        hudOwnLook(e); hudNeedText(g)
        steps = s("steps").split("\n").filter { it.isNotBlank() }.map { l -> val c = l.split("|").map { it.trim() }; Triple(c[0], c.getOrElse(1) { "" }, if (c.size > 2) numOf(c[2], 60.0) else 60.0) }
        key = "pocket.tutorial.${g.saveKey}.${e.name}"
        if (p["startOn"] != "on a message") begin(e, g)
        g.on { m -> if (!e.dead && p["startOn"] == "on a message" && m == s("message", "tutorial")) begin(e, g) }
        g.panels.add(hudCanvasPanel(g, { active }) { draw(e, g) }) // (over other panels)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!active) return
        t += dt
        val w = where(g, steps[idx]); val k = min(1.0, dt * 10); val sp = spot
        spot = if (sp == null) w else (sp.first + (w.first - sp.first) * k.toFloat()) to (sp.second + (w.second - sp.second) * k)
        for (tp in g.taps.toList()) {
            if (t < 0.25) continue
            val sk = skip
            if (sk != null && sk.inflate(12f).contains(tp.screen)) { finish(e, g); g.sfx("click"); g.taps.clear(); return }
            g.sfx("click"); idx++; t = 0.0
            if (idx >= steps.size) { finish(e, g); g.taps.clear(); return }
        }
        g.taps.clear() // (taps go to the tutorial while it shows)
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (!active || e.dead) return
        val st = steps[idx]; val sp = spot ?: where(g, st); val a = min(1.0, t * 4); val W = size.width.toDouble(); val H = size.height.toDouble()
        val dim = Path().apply { fillType = PathFillType.EvenOdd; addRect(Rect(Offset.Zero, size)) }
        val sr = (sp.second * (1 + sin(g.time * 3.3) * 0.03)).toFloat()
        if (sp.second > 0) dim.addOval(Rect(sp.first - Offset(sr, sr), Size(sr * 2, sr * 2)))
        drawPath(dim, Color(0f, 0f, 0f, (n("dim", 0.7) * (if (idx == 0) a else 1.0)).coerceIn(0.0, 1.0).toFloat()))
        if (sp.second > 0) drawCircle(Color.White.copy(alpha = 0.7f), sp.second.toFloat() + 6, sp.first, style = Stroke(2f))
        val mm = hudMeasurer(g) ?: return
        val txt = hudColor(p["text"], "#1d2033"); val bw = min(W - 48, 300.0)
        val body = hudTp(mm, st.first, 15.0, txt, density, maxW = bw - 28, maxLines = 0)
        val bh = body.size.height + 62.0; val below = sp.first.y + sp.second + 20 + bh < H - g.safeBottom - 10
        val by = if (sp.second <= 0) H / 2 - bh / 2 else if (below) sp.first.y + sp.second + 20 else sp.first.y - sp.second - 20 - bh
        val bx = (sp.first.x - bw / 2).coerceIn(16.0, max(16.0, W - bw - 16))
        val bg = hudColor(p["bubble"], "#ffffff")
        drawRoundRect(Color(0x55000000), fo(bx + 2, by + 4), Size(bw.toFloat(), bh.toFloat()), CornerRadius(16f))
        drawRoundRect(bg, fo(bx, by), Size(bw.toFloat(), bh.toFloat()), CornerRadius(16f))
        if (sp.second > 0) {
            val tx = sp.first.x.toDouble().coerceIn(bx + 20, bx + bw - 20)
            drawPath(if (below) Path().apply { moveTo((tx - 10).toFloat(), by.toFloat()); lineTo(tx.toFloat(), (by - 10).toFloat()); lineTo((tx + 10).toFloat(), by.toFloat()); close() }
                else Path().apply { moveTo((tx - 10).toFloat(), (by + bh).toFloat()); lineTo(tx.toFloat(), (by + bh + 10).toFloat()); lineTo((tx + 10).toFloat(), (by + bh).toFloat()); close() }, bg)
        }
        drawText(body, topLeft = fo(bx + 14, by + 14))
        val fy = by + bh - 22; val last = idx >= steps.size - 1
        hudText(g, "${idx + 1} / ${steps.size}", bx + 14, fy, size = 12.0, color = txt.copy(alpha = 0.5f), align = "left")
        drawRoundRect(hudColor(p["accent"], "#4fa3ff"), fo(bx + bw - 92, fy - 14), Size(80f, 28f), CornerRadius(14f))
        hudText(g, if (last) "Got it!" else "Next ›", bx + bw - 52, fy, size = 13.0, weight = FontWeight.Black)
        if (!last) { hudText(g, "Skip", bx + bw - 124, fy, size = 13.0, weight = FontWeight.ExtraBold, color = txt.copy(alpha = 0.55f)); skip = Rect(fo(bx + bw - 144, fy - 11), Size(40f, 22f)) } else skip = null
    }
}

/** Show If (pages): shows this object (and everything inside it) only while a variable matches (page = shop, coins > 0…); fades in, can send messages when it opens and closes. */
class ShowIf(p: JsonMap) : Component(p) {
    var shownNow: Boolean? = null
    var firstDone = false
    override val always get() = true
    fun test(g: PocketGame): Boolean {
        val k = s("var", "page"); val v = g.vars[k]; val want = strOf(p["value"] ?: "home"); val op = s("op", "=")
        if (v == null || v.toString().isEmpty()) return on("whenUnset")
        if (on("whenUnset") && op == "=" && !hudSame(v, want)) { // the first page also shows when no page is for this value
            val any = g.objects.any { o -> !o.dead && o.parts.any { c -> c is ShowIf && strOf(c.p["var"], "page") == k && strOf(c.p["op"], "=") == "=" && hudSame(v, c.p["value"] ?: "home") } }
            if (!any) return true
        }
        val a = strOf(v).toDoubleOrNull(); val b = want.toDoubleOrNull(); val num = want.isNotEmpty() && a != null && b != null
        return when (op) {
            "≠" -> if (num) a != b else !hudSame(v, want)
            ">" -> (a ?: 0.0) > (b ?: 0.0)
            "<" -> (a ?: 0.0) < (b ?: 0.0)
            "≥" -> (a ?: 0.0) >= (b ?: 0.0)
            "≤" -> (a ?: 0.0) <= (b ?: 0.0)
            else -> if (num) a == b else hudSame(v, want)
        }
    }
    override fun start(e: GameObject, g: PocketGame) {
        val sh = test(g); shownNow = sh; e.visible = sh
        if (sh && s("showMessage").isNotEmpty()) g.after(0.0) { g.send(s("showMessage")) }
        if (sh && s("firstMessage").isNotEmpty()) { firstDone = true; g.after(0.0) { g.send(s("firstMessage")) } }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val want = test(g)
        if (want == shownNow) return
        shownNow = want; e.visible = want
        if (want && s("showMessage").isNotEmpty()) g.send(s("showMessage")) else if (!want && s("hideMessage").isNotEmpty()) g.send(s("hideMessage"))
        if (want && s("firstMessage").isNotEmpty() && !firstDone) { firstDone = true; g.send(s("firstMessage")) }
        if (want && s("anim", "fade") != "none") { val a = if (e.alpha <= 0.01) 1.0 else e.alpha; g.killTweens(e, "alpha"); e.alpha = 0.0; g.tween(e, "alpha", a, 0.22) }
    }
}

/** Plays an entrance on an object (pop, fade, zoom, drop, slide, flip, spin, elastic, swing) over some seconds, after a delay. */
fun hudEntrance(g: PocketGame, q: GameObject, anim: String, d: Double, delay: Double = 0.0) {
    val bx = numOf(q.data["animSx"], q.sx); val by = numOf(q.data["animSy"], q.sy); val x0 = numOf(q.data["animX"], q.x); val y0 = numOf(q.data["animY"], q.y); val a0 = numOf(q.data["animA"], if (q.alpha <= 0) 1.0 else q.alpha)
    q.data["animSx"] = bx; q.data["animSy"] = by; q.data["animX"] = x0; q.data["animY"] = y0; q.data["animA"] = a0
    g.killTweens(q)
    fun go() {
        q.visible = true
        q.sx = bx; q.sy = by; q.x = x0; q.y = y0; q.alpha = a0
        val n = anim.lowercase()
        if (n == "none") return
        q.alpha = 0.0; g.tween(q, "alpha", a0, d * (if ("fade" in n) 1.4 else 0.8))
        when {
            "pop" in n || "zoom" in n || "elastic" in n || "bounce in" in n -> {
                val s0 = if ("zoom" in n) 0.3 else 0.6; val curve = if ("elastic" in n) "outElastic" else if ("zoom" in n) "outCubic" else "outBack"; val t = d * (if (curve == "outElastic") 2.5 else 1.4)
                q.sx = bx * s0; q.sy = by * s0; g.tween(q, "sx", bx, t, curve); g.tween(q, "sy", by, t, curve)
            }
            "drop" in n -> { q.y = y0 - 60; g.tween(q, "y", y0, d * 2, "outBounce") }
            "from left" in n -> { q.x = x0 - 80; g.tween(q, "x", x0, d * 1.3, "outCubic") }
            "from right" in n -> { q.x = x0 + 80; g.tween(q, "x", x0, d * 1.3, "outCubic") }
            "bottom" in n || "sheet" in n || "rise" in n || "slide" in n -> { q.y = y0 + 60; g.tween(q, "y", y0, d * 1.3, "outCubic") }
            "top" in n -> { q.y = y0 - 60; g.tween(q, "y", y0, d * 1.3, "outCubic") }
            "flip" in n -> { q.sy = 0.02; g.tween(q, "sy", by, d * 1.4, "outBack") }
            "spin" in n -> { q.rz = -180.0; g.tween(q, "rz", 0.0, d * 1.6, "outBack"); q.sx = bx * 0.4; q.sy = by * 0.4; g.tween(q, "sx", bx, d * 1.6, "outBack"); g.tween(q, "sy", by, d * 1.6, "outBack") }
            "swing" in n -> { q.rz = -25.0; g.tween(q, "rz", 0.0, d * 2.5, "outElastic") }
        }
    }
    if (delay > 0) { q.visible = false; g.after(delay) { go() } } else go()
}

/** UI Animation: an entrance (when the game starts, every time it appears, or on a message; optionally its children one after another) and an idle loop (float, pulse, breathe, wiggle, heartbeat, bounce, spin, glow, attention shake). */
class UiAnim(p: JsonMap) : Component(p) {
    var t = 0.0; var busy = 0.0; var nextAttn = 2.0
    var wasShown = false
    var base: Map<String, Double>? = null
    override val always get() = true
    fun play(e: GameObject, g: PocketGame) {
        val d = max(0.05, n("duration", 0.3)); val delay = n("delay"); val gap = n("gap", 0.08); val stag = on("stagger")
        val list = if (stag) hudKids(g, e) else listOf(e)
        busy = delay + d * 3 + (if (stag) list.size * gap else 0.0); base = null
        if (stag) e.visible = true
        list.forEachIndexed { i, q -> hudEntrance(g, q, s("entrance", "pop"), d, delay + (if (stag) i * gap else 0.0)) }
    }
    override fun start(e: GameObject, g: PocketGame) {
        val playOn = s("playOn", "when the game starts")
        if (playOn == "when the game starts") play(e, g)
        if (playOn == "on a message") g.on { m -> if (!e.dead && m == s("message", "show")) play(e, g) }
        wasShown = e.shown
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val shown = e.shown
        if (p["playOn"] == "every time it appears" && shown && !wasShown) play(e, g)
        wasShown = shown
        if (busy > 0) { busy -= dt; return }
        val idle = s("idle", "none")
        if (idle == "none" || !shown) return
        val b = base ?: mapOf("x" to e.x, "y" to e.y, "sx" to e.sx, "sy" to e.sy, "rz" to e.rz, "glow" to numOf(e.shape?.get("glow"))).also { base = it }
        val sp = n("idleSpeed", 1.0); val A = n("idleAmount", 1.0)
        t += dt * sp
        when (idle) {
            "float" -> e.y = b.getValue("y") + sin(t * 2) * 6 * A
            "pulse" -> { val k = 1 + sin(t * 4) * 0.05 * A; e.sx = b.getValue("sx") * k; e.sy = b.getValue("sy") * k }
            "breathe" -> { val k = 1 + sin(t * 1.6) * 0.03 * A; e.sx = b.getValue("sx") * k; e.sy = b.getValue("sy") * k; e.alpha = 0.85 + sin(t * 1.6) * 0.15 }
            "wiggle" -> e.rz = b.getValue("rz") + sin(t * 9) * 3 * A
            "heartbeat" -> {
                val c = t % 1.2
                val k = 1 + (if (c < 0.12) c / 0.12 else if (c < 0.24) (0.24 - c) / 0.12 else if (c < 0.36) (c - 0.24) / 0.12 * 0.7 else if (c < 0.48) (0.48 - c) / 0.12 * 0.7 else 0.0) * 0.1 * A
                e.sx = b.getValue("sx") * k; e.sy = b.getValue("sy") * k
            }
            "bounce" -> e.y = b.getValue("y") - abs(sin(t * 3)) * 10 * A
            "spin" -> e.rz += 90 * sp * dt
            "glow" -> e.shape?.let { s -> s["glow"] = b.getValue("glow") + (10 + sin(t * 3) * 8) * A; if (s["stroke"] == null) s["stroke"] = s["fill"] }
            "attention shake" -> if (g.time >= nextAttn) { nextAttn = g.time + 3 / sp; val r0 = b.getValue("rz"); e.rz = r0 + 10 * A; g.tween(e, "rz", r0, 0.6, "outElastic") }
        }
    }
}

/** Tooltip: a small bubble of help beside this object (on tap, on long-press, always, the first time, or on a message); hides by itself. */
class HudTooltip(p: JsonMap) : Component(p) {
    var onNow = false
    var k = 0.0; var age = 0.0; var ht = 0.0; var wait = -1.0
    var held: Long? = null
    override val always get() = true
    val showOn get() = s("showOn", "long-press")
    fun show(v: Boolean) { if (v && !onNow) age = 0.0; onNow = v }
    override fun start(e: GameObject, g: PocketGame) {
        hudNeedText(g)
        if (showOn == "always") onNow = true
        if (showOn == "on a message") g.on { m -> if (!e.dead && m == s("message", "tip")) show(true) }
        if (showOn == "first time only") { val key = "pocket.tip.${g.saveKey}.${e.name.ifEmpty { e.id }}"; if (stored(key) == null) { store(key, "1"); wait = 0.6 } }
        g.overlays.add { draw(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        k = (k + (if (onNow) dt else -dt) / 0.15).coerceIn(0.0, 1.0)
        val live = if (e.ui) hudLive(e, g) else e.shown && !e.dead
        if (wait >= 0) { wait -= dt; if (wait < 0 && live) show(true) }
        if (!live) { if (showOn != "always") onNow = false; return }
        val secs = n("seconds", 3.0)
        if (showOn == "long-press") {
            val h = held
            if (h == null) g.downOn(e)?.let { d -> held = d.id; ht = 0.0 }
            else {
                val q = g.pointers[h]
                if (q == null || !g.hitsAt(e, q.at)) { held = null; if (onNow && secs > 0) age = max(age, secs - 0.8) }
                else { ht += dt; if (ht > 0.45 && !onNow) { show(true); g.buzz() } }
            }
        }
        val tapped = g.taps.any { g.hits(e, it) }
        if (showOn == "tap" && tapped) show(!onNow)
        else if (onNow && showOn != "always" && g.taps.isNotEmpty() && !tapped) onNow = false
        if (onNow && showOn != "always" && secs > 0 && held == null) { age += dt; if (age > secs) onNow = false }
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (k <= 0.01 || e.dead) return
        val mm = hudMeasurer(g) ?: return
        val styles = mapOf("dark" to ("#1f2430" to "#ffffff"), "light" to ("#ffffff" to "#1c1f26"), "accent" to ("#3a7bfd" to "#ffffff"), "warning" to ("#ffb020" to "#1c1f26"))
        val style = s("style", "dark"); val sc = styles[style] ?: styles.getValue("dark")
        val bg = if (style == "custom") hudColor(p["bg"], "#1f2430") else hudColor(sc.first, "#1f2430"); val fg = if (style == "custom") hudColor(p["fg"], "#ffffff") else hudColor(sc.second, "#ffffff")
        val r = if (e.ui) g.uiRect(e) else { val c = g.toScreen(e.x, e.y); val hw = (e.half.w * g.zoom).toFloat(); val hh = (e.half.h * g.zoom).toFloat(); Rect(c - Offset(hw, hh), Size(hw * 2, hh * 2)) }
        val title = s("title"); val fs = n("size", 14.0); val maxW = max(60.0, n("width", 220.0))
        val tt = if (title.isEmpty()) null else hudTp(mm, title, fs, fg.a(k), density, FontWeight.Black, maxW)
        val body = hudTp(mm, g.fill(s("text", "Tap to jump")), fs, fg.a(k), density, FontWeight.SemiBold, maxW, 0)
        val w = max(tt?.size?.width ?: 0, body.size.width) + 20f; val h = (if (tt == null) 0f else tt.size.height + 2f) + body.size.height + 16f
        var place = s("place", "auto")
        if (place == "auto") place = if (r.top - h - 12 > g.safeTop) "above" else "below"
        val cx = r.center.x; val W = size.width
        var at = when (place) { "below" -> Offset(cx - w / 2, r.bottom + 10); "left" -> Offset(r.left - w - 10, r.center.y - h / 2); "right" -> Offset(r.right + 10, r.center.y - h / 2); else -> Offset(cx - w / 2, r.top - h - 10) }
        at = Offset(at.x.coerceIn(8f, max(8f, W - w - 8)), at.y)
        val col = bg.a(k)
        drawRoundRect(col, at, Size(w, h), CornerRadius(10f))
        if (p["arrow"] != false) {
            val path = Path()
            when (place) {
                "below" -> { path.moveTo(cx - 7, at.y); path.lineTo(cx, at.y - 7); path.lineTo(cx + 7, at.y) }
                "left" -> { path.moveTo(at.x + w, r.center.y - 7); path.lineTo(at.x + w + 7, r.center.y); path.lineTo(at.x + w, r.center.y + 7) }
                "right" -> { path.moveTo(at.x, r.center.y - 7); path.lineTo(at.x - 7, r.center.y); path.lineTo(at.x, r.center.y + 7) }
                else -> { path.moveTo(cx - 7, at.y + h); path.lineTo(cx, at.y + h + 7); path.lineTo(cx + 7, at.y + h) }
            }
            path.close(); drawPath(path, col)
        }
        var y = at.y + 8
        if (tt != null) { drawText(tt, topLeft = Offset(at.x + 10, y)); y += tt.size.height + 2 }
        drawText(body, topLeft = Offset(at.x + 10, y))
    }
}

/** Notifications: pop-ups that stack and slide away; send "notify Title|text|icon" to show one (card, pill, achievement or banner; top, bottom, top right or centre). */
class Notifications(p: JsonMap) : Component(p) {
    /** One showing: title, text, icon, age. */
    class Note(val title: String, val text: String, val icon: String) { var age = 0.0 }
    val list = mutableListOf<Note>()
    private val rects = mutableListOf<Pair<Rect, Note>>()
    override val always get() = true
    val life get() = n("seconds", 3.0)
    override fun start(e: GameObject, g: PocketGame) {
        hudOwnLook(e); hudNeedText(g)
        val pre = s("listen", "notify")
        g.on { m ->
            if (e.dead || !(m == pre || m.startsWith("$pre "))) return@on
            val parts = g.fill(if (m == pre) "" else m.substring(pre.length + 1)).split("|").map { it.trim() }
            list.add(Note(parts.getOrElse(0) { "" }, parts.getOrElse(1) { "" }, if (parts.size > 2 && parts[2].isNotEmpty()) parts[2] else if (p["look"] == "achievement") "🏆" else ""))
            while (list.size > n("max", 3.0)) list.removeAt(0)
            g.sfx(s("sound", "power")); g.buzz()
        }
        g.panels.add(hudCanvasPanel(g, { list.isNotEmpty() }) { draw(e, g) })
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        for (nt in list) nt.age += dt
        while (list.isNotEmpty() && list.first().age > life + 0.4) list.removeAt(0)
        if (p["tapToClose"] != false) for (t in g.taps) for ((r, nt) in rects) if (r.contains(t.screen) && nt.age < life) nt.age = life
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        rects.clear()
        if (e.dead || list.isEmpty()) return
        val W = size.width.toDouble(); val H = size.height.toDouble(); val look = s("look", "card"); val pos = s("position", "top"); val txt = hudColor(p["text"], "#ffffff"); val acc = hudColor(p["accent"], "#ffd23d")
        val w = if (look == "banner") W else if (look == "pill") min(W - 40, 320.0) else min(W - 24, 380.0)
        val h = if (look == "pill") 44.0 else if (look == "banner") 64.0 + (if (pos.startsWith("top")) g.safeTop.toDouble() else 0.0) else 66.0
        var y = if (pos == "bottom") H - g.safeBottom - 20 - h else if (pos == "center") H * 0.32 else (if (look == "banner") 0.0 else g.safeTop + 14.0)
        for (nt in list.reversed()) {
            val t = nt.age; val inT = (t / 0.3).coerceIn(0.0, 1.0); val outT = ((t - life) / 0.35).coerceIn(0.0, 1.0); val k = ease("outCubic", inT) * (1 - outT)
            val x = if (pos == "top right") W - w - 12 + (1 - k) * (w + 20) else (W - w) / 2; val yy = y + (if (pos == "bottom") 1 else -1) * (1 - k) * (h + 30)
            val rad = CornerRadius(if (look == "banner") 0f else if (look == "pill") (h / 2).toFloat() else 16f)
            drawRoundRect(Color.Black.a(0.25 * k), fo(x, yy + 3), Size(w.toFloat(), h.toFloat()), rad)
            drawRoundRect((if (look == "achievement") Color(0xFF2A2210) else hudColor(p["bg"], "#1e2235")).a(k), fo(x, yy), Size(w.toFloat(), h.toFloat()), rad)
            if (look == "achievement") drawRoundRect(acc.a(k), fo(x, yy), Size(w.toFloat(), h.toFloat()), rad, style = Stroke(2f))
            val ty = yy + h - (if (look == "banner") 32.0 else h / 2); val pill = look == "pill"
            if (nt.icon.isNotEmpty()) {
                val ix = x + (if (pill) 24 else 34)
                drawCircle(acc.a(0.2 * k), if (pill) 16f else 22f, fo(ix, ty))
                hudText(g, nt.icon, ix, ty, size = if (pill) 16.0 else 22.0, color = acc.a(k))
            }
            val tx = x + (if (nt.icon.isNotEmpty()) (if (pill) 48 else 66) else 18); val mw = max(10.0, x + w - tx - 12)
            if (look == "achievement") hudText(g, "ACHIEVEMENT", tx, ty - 17, size = 9.5, weight = FontWeight.Black, color = acc.a(k), align = "left")
            hudText(g, nt.title, tx, if (nt.text.isNotEmpty() && !pill) ty - (if (look == "achievement") 2 else 9) else ty, size = if (pill) 14.0 else 15.0, weight = FontWeight.ExtraBold, color = txt.a(k), align = "left", maxW = mw)
            if (nt.text.isNotEmpty() && !pill) hudText(g, nt.text, tx, ty + (if (look == "achievement") 15 else 11), size = 12.5, weight = FontWeight.SemiBold, color = txt.a(0.72 * k), align = "left", maxW = mw)
            val bx = x + (if (look == "banner") 0 else 14); val bw = (w - (if (look == "banner") 0 else 28)) * (1 - t / life).coerceIn(0.0, 1.0)
            drawRect(acc.a(0.7 * k), fo(bx, yy + h - 3), Size(bw.toFloat(), 2f))
            rects.add(Rect(fo(x, yy), Size(w.toFloat(), h.toFloat())) to nt)
            y += (if (pos == "bottom") -1 else 1) * (h + 8) * k
        }
    }
}

/** Nav Item (tab): tap it to switch pages (sets a variable, e.g. page = home); it lights up while its page shows (what's inside dims when not). */
class NavItem(p: JsonMap) : Component(p) {
    override val always get() = true
    val key get() = s("var", "page")
    override fun start(e: GameObject, g: PocketGame) {
        val v = g.vars[key]
        if (on("startHere") && (v == null || v.toString().isEmpty() || numOf(v, -1.0) == 0.0)) g.setVar(key, strOf(p["page"] ?: "home"))
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (e.ui) g.tapTargets.add(e)
        if (g.tapsOn(e).isNotEmpty()) {
            g.setVar(key, strOf(p["page"] ?: "home"))
            g.sfx("click"); g.squash(e, 0.92)
            if (s("message").isNotEmpty()) g.send(s("message"))
        }
        val isOn = hudSame(g.vars[key], p["page"] ?: "home")
        e.shape?.let { it["fill"] = if (isOn) (p["activeColor"] ?: "#3a6ea5") else (p["idleColor"] ?: "") }
        val a = if (isOn || p["dimIdle"] == false) 1.0 else 0.55
        for (q in hudKids(g, e)) q.alpha = a
        if (e.shape == null && e.text != null) e.alpha = a
    }
}

/** Side Bar (drawer): slides in from a side when a message arrives (e.g. from a ☰ button), dims the game behind it; a tap outside or picking a page closes it. */
class SideDrawer(p: JsonMap) : Component(p) {
    var open = false
    var home: Pair<Double, Double>? = null
    var dim: GameObject? = null
    var lastPage: Any? = null
    var openedAt = -1.0
    override val always get() = true
    fun set(e: GameObject, g: PocketGame, want: Boolean, instant: Boolean = false) {
        open = want
        if (want) openedAt = g.time
        val h = home ?: (e.x to e.y).also { home = it }
        val r = g.uiRect(e); val k = g.uiK; val d = if (instant) 0.001 else n("duration", 0.25)
        val away = when (s("side", "left")) { "right" -> (h.first + r.width / k + 40) to h.second; "bottom" -> h.first to (h.second + r.height / k + 40); "top" -> h.first to (h.second - r.height / k - 40); else -> (h.first - r.width / k - 40) to h.second }
        g.killTweens(e)
        val dm = dim
        if (dm != null) g.killTweens(dm)
        if (want) {
            e.visible = true
            g.tween(e, "x", h.first, d, "outCubic"); g.tween(e, "y", h.second, d, "outCubic")
            if (dm != null) { dm.visible = true; g.tween(dm, "alpha", n("dim", 0.5), d) }
        } else {
            g.tween(e, "x", away.first, d, "inCubic"); g.tween(e, "y", away.second, d, "inCubic", done = { if (!open) e.visible = false })
            if (dm != null) g.tween(dm, "alpha", 0.0, d, done = { if (!open) dm.visible = false })
        }
        if (instant) { e.x = if (want) h.first else away.first; e.y = if (want) h.second else away.second; e.visible = want; if (dm != null) { dm.alpha = if (want) n("dim", 0.5) else 0.0; dm.visible = want } }
    }
    override fun start(e: GameObject, g: PocketGame) {
        if (n("dim", 0.5) > 0) { // the dark layer behind the bar (tap it to close)
            val o = GameObject(mapOf("name" to "${e.name} dim", "ui" to true, "anchor" to "center", "stretch" to "both", "layer" to (e.layer - 1).toDouble(), "alpha" to 0.0, "visible" to false,
                "shape" to mapOf("type" to "rect", "w" to 400.0, "h" to 700.0, "fill" to "#000000")), g)
            g.objects.add(o); dim = o
        }
        set(e, g, on("startOpen"), true)
        lastPage = g.vars[s("var", "page")]
        val msg = s("message", "menu")
        g.on { m ->
            if (!e.dead) {
                if (m == msg) set(e, g, !open) else if (m == "$msg open" || m == "open $msg") set(e, g, true) else if (m == "$msg close" || m == "close $msg") set(e, g, false)
            }
        }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        dim?.let { g.tapTargets.add(it) }
        if (open && g.time > openedAt) for (t in g.taps) if (!g.hitsAt(e, t.screen)) { set(e, g, false); break } // (not the tap that opened it)
        val pv = g.vars[s("var", "page")]
        if (p["closeOnPick"] != false && open && !hudSame(pv, lastPage)) set(e, g, false)
        lastPage = pv
    }
    override fun gone(e: GameObject, g: PocketGame) { dim?.destroy() }
}

private fun hudKey(n: Any?) = strOf(n).trim().lowercase().replace(Regex("[^a-z0-9]+"), "_").trim('_')
/** The field names (and keys) of a data collection, and its starting records (Game Settings › Data). */
fun hudCollection(g: PocketGame, name: String): JsonMap? = (g.gameData["collections"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.firstOrNull { hudKey(it["name"]) == hudKey(name) }
/** A record's value for a field (by name or key; yes/no as 1 / 0). */
fun hudField(r: JsonMap, field: String): Any? {
    val k = hudKey(field)
    for ((key, v) in r) if (hudKey(key) == k) return when (v) { true -> 1.0; false -> 0.0; "yes" -> 1.0; "no" -> 0.0; else -> v }
    return null
}
/** Does a record pass a filter ("done = no", "amount > 10 and category = Food")? */
fun hudMatches(r: JsonMap, filter: String): Boolean {
    for (part in filter.split(Regex("\\s+and\\s+", RegexOption.IGNORE_CASE))) {
        val m = Regex("^\\s*(.+?)\\s*(>=|<=|!=|≠|≥|≤|=|>|<)\\s*(.*?)\\s*$").find(part) ?: continue
        val a = hudField(r, m.groupValues[1]); val b0 = m.groupValues[3]
        val bRaw = if (b0.lowercase() == "yes") "1" else if (b0.lowercase() == "no") "0" else b0
        val an = strOf(a).toDoubleOrNull(); val bn = bRaw.toDoubleOrNull(); val both = an != null && bn != null
        val ok = when (m.groupValues[2]) {
            ">" -> both && an!! > bn!!; "<" -> both && an!! < bn!!; ">=", "≥" -> both && an!! >= bn!!; "<=", "≤" -> both && an!! <= bn!!
            "!=", "≠" -> if (both) an != bn else strOf(a).lowercase() != bRaw.lowercase()
            else -> if (both) an == bn else strOf(a).lowercase() == bRaw.lowercase()
        }
        if (!ok) return false
    }
    return true
}

/** Data Summary: keeps a variable up to date with a count, total, average, smallest or largest value from a data collection (as saved in the game). */
class DataStat(p: JsonMap) : Component(p) {
    var t = 0.0
    override val always get() = true
    fun calc(g: PocketGame): Double {
        val c = hudCollection(g, s("collection", "Expenses"))
        val rows = (c?.get("rows") as? List<*>).orEmpty().mapNotNull { it.asMap() }.filter { hudMatches(it, g.fill(s("filter"))) }
        val how = s("how", "count")
        if (how == "count") return rows.size.toDouble()
        val nums = rows.map { numOf(hudField(it, s("field", "amount"))) }
        if (nums.isEmpty()) return 0.0
        val sum = nums.sum()
        return when (how) { "sum" -> (sum * 100).roundToLong() / 100.0; "average" -> (sum / nums.size * 100).roundToLong() / 100.0; "min" -> nums.min(); else -> nums.max() }
    }
    fun apply(g: PocketGame) {
        val v = calc(g); val k = s("var", "total")
        g.setVar(k, v)
        if (p["format"] == "money") { val c = (v * 100).roundToLong(); g.setVar("${k}_text", "$${c / 100}.${(abs(c) % 100).toString().padStart(2, '0')}") }
    }
    override fun start(e: GameObject, g: PocketGame) = apply(g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) { t += dt; if (t >= 1 || "{" in s("filter")) { t = 0.0; apply(g) } }
}

/** Network Sync (Photon): online, other players see a copy of this object. The native game plays single-player, so it just keeps playing. */
class NetSync(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { if (e.data["netId"] == null) e.data["netId"] = e.id }
}

/** Online Leaderboard: in the native game, a leaderboard of the best scores on this phone (top 10, in the engine's row format), refreshed on its message and after each game. */
class LocalLeaderboard(p: JsonMap) : Component(p) {
    override val always get() = true
    val stat get() = s("stat", "score")
    fun key(g: PocketGame) = "pocket.board.${g.saveKey}.$stat"
    fun rows(g: PocketGame): List<JsonMap> = (stored(key(g))?.let { parseJson(it) } as? List<*>).orEmpty().mapNotNull { it.asMap() }
    /** Adds the current score (the variable named like the statistic, or score). */
    fun record(g: PocketGame) {
        val v = if (g.vars.containsKey(stat)) g.numVar(stat) else g.numVar("score")
        if (v <= 0) return
        val name = strOf(g.vars["playerName"], "You")
        val all = (rows(g) + mapOf("name" to name, "value" to floor(v), "at" to nowMs())).sortedByDescending { numOf(it["value"]) }
        store(key(g), toJsonValue(all.take(50)).toString())
    }
    /** The rows as text, in the engine's format. */
    fun lines(g: PocketGame): String {
        val L = rows(g).take(n("count", 10.0).toInt())
        return if (L.isEmpty()) "No scores yet — be the first!" else L.mapIndexed { i, r -> s("format", "{rank}. {name}  {value}").replace("{rank}", "${i + 1}").replace("{name}", strOf(r["name"])).replace("{value}", formatNumber(numOf(r["value"]))) }.joinToString("\n")
    }
    fun show(e: GameObject, g: PocketGame) {
        val t = e.text
        if (t != null) {
            if (e.shape != null && numOf(t["wrap"]) <= 0) t["wrap"] = max(40.0, e.half.w * 2 - 16) // (rows fit its box)
            t["value"] = lines(g)
        } else e.data["board"] = lines(g) // (no text of its own: drawn by the overlay)
    }
    override fun start(e: GameObject, g: PocketGame) {
        show(e, g)
        if (e.text == null) { hudNeedText(g); g.overlays.add { draw(e, g) } }
        g.on { m ->
            if (!e.dead) {
                if (m == "won" || m == "game over" || m == "submit score online") { record(g); show(e, g) }
                if (m == s("refreshOn", "leaderboard")) show(e, g)
            }
        }
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (!hudLive(e, g)) return
        val mm = hudMeasurer(g) ?: return
        val r = if (e.ui) g.uiRect(e) else { val c = g.toScreen(e.x, e.y); Rect(c, Size(1f, 1f)) }
        val tp = hudTp(mm, strOf(e.data["board"]), 18.0, Color.White, density, maxW = max(40.0, r.width - 16.0), maxLines = 0)
        drawText(tp, topLeft = Offset(r.left + 8, r.center.y - tp.size.height / 2f))
    }
}

/** Room List (Photon): online it lists the open rooms. Played offline there are none: it says so (its empty text) with a row to make one, which sends the engine's "join online room" message. */
class RoomList(p: JsonMap) : Component(p) {
    var make: Rect? = null
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) { hudNeedText(g); g.overlays.add { draw(e, g) } }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!hudLive(e, g)) return
        g.tapTargets.add(e)
        val m = make ?: rowRect(e, g) ?: return
        for (t in g.taps) {
            if (!m.contains(t.screen)) continue
            g.sfx("click"); g.send("join online room")
            if (s("message").isNotEmpty()) g.send(s("message"))
            g.message("Playing offline: online rooms need a connection", 2.0)
        }
    }
    /** Where the "Make a room" row goes (laid out without drawing, so taps work before the first frame too). */
    fun rowRect(e: GameObject, g: PocketGame): Rect? {
        val b = g.uiRect(e); val rh = max(30.0, n("rowH", 56.0)).toFloat(); val y = b.top + min(60f, b.height / 2) + 28
        return if (y + rh <= b.bottom) Rect(Offset(b.left + 4, y), Size(b.width - 8, rh)) else null
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        make = null
        if (!hudLive(e, g)) return
        val b = g.uiRect(e); val sub = hudColor(p["sub"], "rgba(255,255,255,0.6)"); val txt = hudColor(p["text"], "#ffffff")
        clipRect(b.left, b.top, b.right, b.bottom) {
            hudText(g, s("empty", "No open rooms yet. Make one!"), b.center.x.toDouble(), (b.top + min(60f, b.height / 2)).toDouble(), size = 15.0, weight = FontWeight.SemiBold, color = sub, maxW = b.width - 24.0)
            val r = rowRect(e, g)
            if (r != null) {
                drawRoundRect(hudColor(p["row"], "rgba(255,255,255,0.08)"), r.topLeft, r.size, CornerRadius(12f))
                hudText(g, "Make a room", r.left + 14.0, r.center.y.toDouble(), size = 16.0, weight = FontWeight.ExtraBold, color = txt, align = "left")
                drawRoundRect(hudColor(p["accent"], "#3a7bfd"), Offset(r.right - 74, r.center.y - 15), Size(64f, 30f), CornerRadius(15f))
                hudText(g, "Make", r.right - 42.0, r.center.y.toDouble(), size = 14.0, weight = FontWeight.ExtraBold)
                make = r
            }
        }
    }
}

/** Chat Box (Photon): chat bubbles, newest at the bottom. Played offline it shows what you send (the text in its input variable, on its send message). */
class ChatBox(p: JsonMap) : Component(p) {
    val log = mutableListOf<Triple<String, String, Boolean>>()
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) {
        hudNeedText(g)
        g.on { m ->
            if (e.dead || m != s("sendOn", "send chat")) return@on
            val k = s("inputVar", "chatText"); val v = strOf(g.vars[k]).trim()
            if (v.isEmpty()) return@on
            log.add(Triple(strOf(g.vars["playerName"], "You"), v, true))
            g.setVar(k, "")
            g.setVar("netChat", log.map { mapOf("name" to it.first, "text" to it.second) })
        }
        g.overlays.add { draw(e, g) }
    }
    private fun DrawScope.draw(e: GameObject, g: PocketGame) {
        if (!hudLive(e, g)) return
        val mm = hudMeasurer(g) ?: return
        val b = g.uiRect(e); val fs = n("size", 14.0); val pad = 10f; val room = n("bottomSpace").toFloat(); val names = hudColor(p["names"], "rgba(255,255,255,0.6)"); val txt = hudColor(p["text"], "#ffffff")
        clipRect(b.left, b.top, b.right, max(b.top, b.bottom - room)) {
            var y = b.bottom - pad - room
            var i = log.size - 1
            while (i >= 0 && y > b.top) {
                val (name, text, mine) = log[i]
                val tp = hudTp(mm, text, fs, txt, density, FontWeight.SemiBold, b.width * 0.7 - 24.0, 0)
                val w = min(b.width * 0.75f, tp.size.width + 24f); val h = tp.size.height + 14f
                y -= h
                val x = if (mine) b.right - pad - w else b.left + pad
                drawRoundRect(if (mine) hudColor(p["mine"], "#3a7bfd") else hudColor(p["theirs"], "rgba(255,255,255,0.12)"), Offset(x, y), Size(w, h), CornerRadius(14f))
                drawText(tp, topLeft = Offset(x + 12, y + 7))
                if (!mine) { y -= fs.toFloat(); hudText(g, name, x + 4.0, y + fs * 0.45, size = fs * 0.8, color = names, align = "left") }
                y -= 6
                i--
            }
            if (log.isEmpty()) hudText(g, "Say hi 👋", b.center.x.toDouble(), b.center.y.toDouble(), size = fs, weight = FontWeight.SemiBold, color = names)
        }
    }
}


// makeComponent: "tween" -> TweenPart(p); "tweenSequence" -> TweenSequencePart(p); "flipbook" -> Flipbook(p); "animator" -> Animator(p); "spriteSheet" -> SpriteSheet(p); "cameraBrain" -> CameraBrain(p); "cameraSequence" -> CameraSequence(p); "cameraMixer" -> CameraMixer(p); "cameraTargetGroup" -> CameraTargetGroup(p); "cameraZone" -> CameraZone(p); "cameraSwitcher" -> CameraSwitcher(p); "gridMove" -> GridMove(p); "gridEnemy" -> GridEnemy(p); "gridUnit" -> GridUnit(p); "squadControl" -> SquadControl(p); "boardCell" -> BoardCell(p); "turnAction" -> TurnAction(p); "turnOpponent" -> TurnOpponent(p)
// imports: (none beyond PocketGame.kt's own). Core change needed: GameObject's `shape`, `text` and `sprite` become `var` (Flipbook and Board Cell give objects a look).

// ---------------------------------------------------------------------------------------------------------------
// Animation: Tween, Tween Sequence, Sprite Animation (flipbook), Animator (keyframe clips), Sprite Sheet
// ---------------------------------------------------------------------------------------------------------------

/** One tween effect on an object ("move by", "punch scale", "path"…), driven by a progress 0 → 1.
 *  Positions and turns are added as offsets (so other movement still works); sizes, fades and colours are set. */
class FxStep(val e: GameObject, val p: JsonMap, val g: PocketGame) {
    var duration = max(0.01, numOf(p["duration"], 1.0))
    val curve = strOf(p["ease"], "inOutSine")
    val effect = strOf(p["effect"], "move by")
    var x0 = 0.0; var y0 = 0.0; var rz0 = 0.0; var sx0 = 1.0; var sy0 = 1.0; var a0 = 1.0
    private var lx = 0.0; private var ly = 0.0; private var lrz = 0.0
    var c0: Color? = null
    var vis0 = true
    private val shakes = mutableListOf<Pair<Double, Double>>()
    fun A(k: String, d: Double): Double { val v = p[k]; return if (v == null || v.toString().isEmpty() || v.toString().toDoubleOrNull() == null) d else numOf(v) }
    val fromMode get() = p["from"] == true && effect != "move from"
    init {
        rebase()
        if (p["speedBased"] == true && effect in listOf("move by", "move to", "move from", "rotate by", "rotate to")) {
            val dist = if (effect.startsWith("rotate")) (if (effect == "rotate by") abs(A("angle", 360.0)) else abs(A("angle", 0.0) - e.rz))
                else if (effect == "move to") hypot(A("x", 0.0) - e.x, A("y", 0.0) - e.y) else hypot(A("x", 0.0), A("y", 0.0))
            duration = max(0.01, dist / max(0.001, numOf(p["duration"], 1.0)))
        }
    }
    /** Start again from where the object is now (the next loop of an incremental tween, a replay). */
    fun rebase() {
        x0 = e.x; y0 = e.y; rz0 = e.rz; sx0 = e.sx; sy0 = e.sy; a0 = e.alpha; lx = 0.0; ly = 0.0; lrz = 0.0
        c0 = parseColor(if (e.text != null && e.shape == null) e.text?.get("color") else e.shape?.get("fill"))
        vis0 = e.visible
    }
    private fun add(ox: Double, oy: Double, orz: Double) { e.x += ox - lx; e.y += oy - ly; e.rz += orz - lrz; lx = ox; ly = oy; lrz = orz }
    private fun hex(c: Color): String {
        fun h(v: Float) = (v * 255).roundToInt().coerceIn(0, 255).toString(16).padStart(2, '0')
        return "#" + h(c.red) + h(c.green) + h(c.blue)
    }
    /** Show the effect at raw progress t (0 → 1; the ease is applied here). */
    fun at(t0: Double) {
        val t = t0.coerceIn(0.0, 1.0)
        var k = ease(curve, t)
        if (fromMode) k = 1 - k
        val vx = A("x", 0.0); val vy = A("y", -40.0)
        when (effect) {
            "move by" -> add(vx * k, vy * k, 0.0)
            "move from" -> add(vx * (1 - k) - vx, vy * (1 - k) - vy, 0.0)
            "move to" -> add((vx - x0) * k, (vy - y0) * k, 0.0)
            "rotate by" -> add(0.0, 0.0, A("angle", 360.0) * k)
            "rotate to" -> add(0.0, 0.0, (A("angle", 0.0) - rz0) * k)
            "spin" -> add(0.0, 0.0, A("angle", 360.0) * t)
            "scale to" -> { val a = A("amount", 1.0); e.sx = sx0 + (a * sign(sx0) - sx0) * k; e.sy = sy0 + (a * sign(sy0) - sy0) * k }
            "scale by" -> { val a = A("amount", 1.5); e.sx = sx0 * (1 + (a - 1) * k); e.sy = sy0 * (1 + (a - 1) * k) }
            "fade to" -> e.alpha = a0 + (A("amount", 0.0).coerceIn(0.0, 1.0) - a0) * k
            "color to" -> {
                val to = parseColor(p["color"]) ?: Color(0xFFFF5252); val from = c0 ?: Color.White
                val c = hex(mixColor(from, to, k))
                if (e.text != null && e.shape == null) e.text?.set("color", c) else e.shape?.set("fill", c)
            }
            "punch scale", "punch position", "punch rotation" -> {
                val vib = A("vibrato", 8.0); val el = A("elasticity", 0.6); val w = sin(t * vib * PI) * (1 - t).pow(1 + el)
                when (effect) {
                    "punch scale" -> { val a = A("amount", 0.3); e.sx = sx0 * (1 + a * w); e.sy = sy0 * (1 + a * w) }
                    "punch position" -> add(vx * w, vy * w, 0.0)
                    else -> add(0.0, 0.0, A("amount", 30.0) * w)
                }
            }
            "shake position", "shake rotation", "shake scale" -> {
                val vib = max(1.0, A("vibrato", 18.0)); val n = floor(t * vib).toInt()
                while (shakes.size <= n) shakes.add(rand(-1.0, 1.0) to rand(-1.0, 1.0))
                val sx = if (t >= 1) 0.0 else shakes[n].first * (1 - t); val sy = if (t >= 1) 0.0 else shakes[n].second * (1 - t)
                when (effect) {
                    "shake position" -> { val a = A("amount", 10.0); add(sx * a, sy * a, 0.0) }
                    "shake rotation" -> add(0.0, 0.0, sx * A("amount", 15.0))
                    else -> { val a = A("amount", 0.2); e.sx = sx0 * (1 + sx * a); e.sy = sy0 * (1 + sy * a) }
                }
            }
            "path" -> {
                val pts = mutableListOf(0.0 to 0.0)
                for (q in (p["points"] as? List<*>).orEmpty()) { val m = q.asMap() ?: continue; pts.add(numOf(m["x"]) to numOf(m["y"])) }
                if (p["closed"] == true) pts.add(0.0 to 0.0)
                if (pts.size < 2) return
                var total = 0.0
                for (i in 1 until pts.size) total += hypot(pts[i].first - pts[i - 1].first, pts[i].second - pts[i - 1].second)
                var d = total * k
                for (i in 1 until pts.size) {
                    val seg = hypot(pts[i].first - pts[i - 1].first, pts[i].second - pts[i - 1].second)
                    if (d <= seg || i == pts.size - 1) {
                        val f = if (seg == 0.0) 1.0 else (d / seg).coerceIn(0.0, 1.0)
                        val ax = pts[i - 1].first + (pts[i].first - pts[i - 1].first) * f; val ay = pts[i - 1].second + (pts[i].second - pts[i - 1].second) * f
                        val turn = if (p["orient"] == true) atan2(pts[i].second - pts[i - 1].second, pts[i].first - pts[i - 1].first) / DEG + 90 - rz0 else 0.0
                        add(ax, ay, turn)
                        break
                    }
                    d -= seg
                }
            }
            "jump to" -> { val hops = max(1.0, A("jumps", 1.0)); add(vx * k, vy * k - A("height", 80.0) * abs(sin(k * PI * hops)), 0.0) }
            "spiral" -> { val r = A("radius", 120.0) * k; val a = A("turns", 3.0) * PI * 2 * k; add(cos(a) * r, sin(a) * r, 0.0) }
            "look at" -> {
                val t2 = g.findAll(strOf(p["target"], "player")).firstOrNull { it !== e } ?: return
                val want = atan2(t2.x - e.x, -(t2.y - e.y)) / DEG
                var diff = ((want - rz0) % 360 + 360) % 360
                if (diff > 180) diff -= 360
                add(0.0, 0.0, diff * k)
            }
            "blink" -> { val times = max(1.0, A("times", 6.0)); e.visible = if (t >= 1) vis0 else if (floor(t * times * 2).toInt() % 2 == 0) !vis0 else vis0 }
            "type text" -> {
                val full = strOf(p["text"], "Hello there!"); val n = (full.length * k).roundToInt().coerceIn(0, full.length)
                var s = full.substring(0, n)
                if (p["scramble"] == true && n < full.length) s += ('A' + Random.nextInt(26))
                if (e.text == null) e.text = mutableMapOf("size" to 22.0, "color" to "#ffffff")
                e.text?.set("value", s)
            }
            "count up" -> {
                val v = strOf(p["var"]); val to = A("to", 100.0)
                if (v.isNotEmpty()) { val from = numOf(e.data["countFrom"] ?: g.vars[v]); e.data["countFrom"] = from; g.setVar(v, (from + (to - from) * k).roundToInt().toDouble()) }
                else { if (e.text == null) e.text = mutableMapOf("size" to 22.0, "color" to "#ffffff"); val from = A("from", 0.0); e.text?.set("value", "${strOf(p["prefix"])}${(from + (to - from) * k).roundToInt()}${strOf(p["suffix"])}") }
            }
        }
    }
    /** Undo what it added and put set values back (before a sequence restarts). */
    fun undo() { add(0.0, 0.0, 0.0); if ("scale" in effect) { e.sx = sx0; e.sy = sy0 }; if (effect == "fade to") e.alpha = a0; if (effect == "blink") e.visible = vis0 }
}

/** A playing tween: loops (−1 = forever) as yoyo, restart or incremental, a delay, and what to do each loop / at the end. */
class FxPlay(val step: FxStep, val loops: Int = 0, val loopType: String = "yoyo", var delay: Double = 0.0) {
    var t = 0.0; var dir = 1.0; var loop = 0; var done = false
    var onLoop: (() -> Unit)? = null; var onDone: (() -> Unit)? = null
    val keep get() = step.p["_keep"] == true
    /** Each tap of a forward / back tween turns it around. */
    fun flip() { dir = -dir; done = false }
    fun update(dt: Double) {
        if (done) return
        if (delay > 0) { delay -= dt; return }
        val d = step.duration
        t += dt * dir
        if (dir < 0 && t <= 0) { t = 0.0; step.at(0.0); done = true; return }
        if (t < d) { val back = loopType == "yoyo" && loop % 2 == 1; step.at(if (back) 1 - t / d else t / d); return }
        val back = loopType == "yoyo" && loop % 2 == 1
        step.at(if (back) 0.0 else 1.0)
        if (loops == 0 || (loops > 0 && loop + 1 > loops)) { if (dir > 0) { done = true; onDone?.invoke() }; return }
        loop++; t -= d
        onLoop?.invoke()
        if (loopType == "incremental") step.rebase() else if (loopType == "restart") step.at(0.0)
    }
}

/** The tweens playing on the game's objects (driven once a frame by whichever animation component runs first). */
class FxSystem {
    val plays = mutableListOf<FxPlay>()
    private var stamp = -1.0
    companion object { fun of(g: PocketGame) = g.systems.getOrPut("fx") { FxSystem() } as FxSystem }
    fun tick(g: PocketGame, dt: Double) {
        if (stamp == g.time) return
        stamp = g.time
        for (f in plays.toList()) { if (f.step.e.dead) { plays.remove(f); continue }; f.update(dt); if (f.done && f.dir > 0 && !f.keep) plays.remove(f) }
    }
}

/** Whether a component should play now: on start, a tap, touch, a message, or never. */
abstract class PlayOn(p: JsonMap) : Component(p) {
    val playOn get() = s("playOn", "start")
    abstract fun play(e: GameObject, g: PocketGame)
    override val always get() = true
    override val listens get() = playOn == "touched by tag"
    override fun cares(other: GameObject) = other.has(s("tag", "player"))
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) = play(e, g)
    fun startPlayOn(e: GameObject, g: PocketGame) {
        if (playOn == "start") play(e, g)
        if (playOn == "message") g.on { m -> if (m == s("message", "go") && !e.dead) play(e, g) }
    }
    fun updatePlayOn(e: GameObject, dt: Double, g: PocketGame) {
        FxSystem.of(g).tick(g, dt)
        if (playOn.startsWith("tap")) { if (e.ui) g.tapTargets.add(e); if (e.shown && g.tapsOn(e).isNotEmpty()) play(e, g) }
    }
}

/** Tween: animates its object with no code (move, rotate, spin, scale, fade, colour, punch, shake, path, jump, spiral, look at, blink, type text, count up). */
class TweenPart(p: JsonMap) : PlayOn(p) {
    private var fx: FxPlay? = null
    private val toggle get() = playOn == "tap (forward / back)"
    override fun play(e: GameObject, g: PocketGame) {
        val sys = FxSystem.of(g)
        val cur = fx
        if (toggle && cur != null) { cur.flip(); if (cur !in sys.plays) sys.plays.add(cur); return }
        if (cur != null) sys.plays.remove(cur)
        val step = FxStep(e, if (toggle) p + ("_keep" to true) else p, g)
        val f = FxPlay(step, if (toggle) 0 else n("loops", -1.0).toInt(), s("loopType", "yoyo"), n("delay"))
        val loopDo = s("loopDo", "nothing"); val thenDo = s("thenDo", "nothing")
        if (loopDo != "nothing") f.onLoop = { g.runAction(e, mapOf("action" to loopDo, "value" to (p["loopValue"] ?: ""), "amount" to 1.0)) }
        if (thenDo != "nothing") f.onDone = { g.runAction(e, mapOf("action" to thenDo, "value" to (p["thenValue"] ?: ""), "amount" to 1.0)) }
        fx = f
        sys.plays.add(f)
    }
    override fun start(e: GameObject, g: PocketGame) = startPlayOn(e, g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) = updatePlayOn(e, dt, g)
}

/** Tween Sequence: several tween steps one after another ("after"), at the same time ("with") or a pause ("wait"), as one animation. */
class TweenSequencePart(p: JsonMap) : PlayOn(p) {
    private val steps = mutableListOf<Pair<Double, FxStep>>()
    private val begun = mutableSetOf<FxStep>()
    private var t = 0.0; private var length = 0.0; private var delay = 0.0; private var loop = 0
    var playing = false
    private var base: DoubleArray? = null
    override fun play(e: GameObject, g: PocketGame) {
        if (playing && p["restartOnPlay"] != true) return
        base?.let { b -> for (s in steps.reversed()) s.second.undo(); e.x = b[0]; e.y = b[1]; e.rz = b[2]; e.sx = b[3]; e.sy = b[4]; e.alpha = b[5] }
        base = doubleArrayOf(e.x, e.y, e.rz, e.sx, e.sy, e.alpha)
        steps.clear(); begun.clear()
        var at = 0.0; var lastStart = 0.0
        for (raw in (p["steps"] as? List<*>).orEmpty()) {
            val st = raw.asMap() ?: continue
            val d = max(0.0, numOf(st["duration"], 0.2)); val w = strOf(st["with"], "after")
            if (w == "wait") { at += d; continue }
            val start = if (w == "with") lastStart else at
            steps.add(start to FxStep(e, st, g))
            lastStart = start
            at = max(at, start + max(0.01, d))
        }
        length = max(0.01, at); t = 0.0; loop = 0; delay = n("delay"); playing = true
    }
    private fun show(time: Double) {
        for ((start, s) in steps) {
            if (time < start) { if (s in begun) s.at(0.0); continue }
            s.at((time - start) / s.duration)
        }
    }
    override fun start(e: GameObject, g: PocketGame) = startPlayOn(e, g)
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        updatePlayOn(e, dt, g)
        if (!playing) return
        if (delay > 0) { delay -= dt; return }
        val before = t
        t += dt
        val yoyoBack = s("loopType", "restart") == "yoyo" && loop % 2 == 1
        if (!yoyoBack) for ((start, s) in steps) if (s !in begun && start <= t && (start > before || before == 0.0)) { s.rebase(); begun.add(s) } // (steps that start now begin from where the object is)
        show(if (yoyoBack) length - min(t, length) else min(t, length))
        if (t < length) return
        val loops = n("loops").toInt()
        if (loops == 0 || (loops > 0 && loop + 1 > loops)) {
            playing = false
            val then = s("thenDo", "nothing")
            if (then != "nothing") g.runAction(e, mapOf("action" to then, "value" to (p["thenValue"] ?: ""), "amount" to 1.0))
            return
        }
        loop++; t = 0.0
        if (s("loopType", "restart") != "yoyo") { for (st in steps.reversed()) st.second.undo(); begun.clear() }
    }
}

/** Sprite Animation (flipbook): cycles through emoji or picture frames (always, while moving, or on a message), looping, once or back and forth. */
class Flipbook(p: JsonMap) : Component(p) {
    private val frames = s("frames").split(",").map { it.trim() }.filter { it.isNotEmpty() }
    private var t = 0.0
    private var last: Pair<Double, Double>? = null
    private var active = s("when", "always") == "always"
    override val always get() = true
    private fun show(e: GameObject, f: String) {
        if (f.startsWith("art:")) return // (built-in vector art: the object keeps its own look in the native build)
        if (Regex("^(https?:|data:|blob:|\\.?/)").containsMatchIn(f)) { // (pictures are drawn as boxes in Kotlin: keep the size)
            e.sprite = (e.sprite ?: emptyMap()) + mapOf("src" to f, "w" to (e.sprite?.get("w") ?: 56.0), "h" to (e.sprite?.get("h") ?: 56.0))
            if (e.shape?.get("type") == "emoji") e.shape = null
        } else {
            val sh = e.shape ?: mutableMapOf<String, Any?>("type" to "emoji", "w" to 56.0, "h" to 56.0, "fill" to "").also { e.shape = it }
            sh["type"] = "emoji"; sh["emoji"] = f
        }
    }
    override fun start(e: GameObject, g: PocketGame) {
        if (frames.isNotEmpty()) show(e, frames.first())
        if (s("when") == "on message") g.on { m -> if (m == s("message", "go")) { active = true; t = 0.0 } }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (frames.isEmpty()) return
        if (s("when") == "while moving") {
            val l = last; val moved = l != null && hypot(e.x - l.first, e.y - l.second) > 0.01
            last = e.x to e.y
            if (!moved) { show(e, frames.first()); t = 0.0; return }
        } else if (!active) return
        t += dt * n("fps", 6.0)
        val count = frames.size
        var i = floor(t).toInt()
        val mode = s("mode", "loop")
        if (mode == "once") { if (i >= count) { i = count - 1; if (s("when") == "on message") active = false } }
        else if (mode == "ping-pong" && count > 1) { val c = (count - 1) * 2; i %= c; if (i >= count) i = c - i }
        else i %= count
        show(e, frames[i])
    }
}

/** A keyframe track [[time, value, ease?], …] at a time. */
fun sampleTrack(tr: List<*>?, time: Double): Double? {
    if (tr.isNullOrEmpty()) return null
    val first = tr.first() as? List<*> ?: return null
    if (time <= numOf(first[0])) return numOf(first[1])
    for (i in 0 until tr.size - 1) {
        val a = tr[i] as? List<*> ?: continue; val b = tr[i + 1] as? List<*> ?: continue
        if (time < numOf(b[0])) {
            val span = numOf(b[0]) - numOf(a[0]); val k = if (span == 0.0) 1.0 else (time - numOf(a[0])) / span
            return numOf(a[1]) + (numOf(b[1]) - numOf(a[1])) * ease(if (a.size > 2) strOf(a[2], "linear") else "linear", k)
        }
    }
    return numOf((tr.last() as? List<*>)?.getOrNull(1))
}

/** Something that plays named clips (Animator, Sprite Sheet): the "play animation" action and messages pick it. */
interface ClipPlayer {
    fun playClip(name: String, loop: Boolean? = null, auto: Boolean = false): Boolean
    fun listenForClips(e: GameObject, g: PocketGame, has: (String) -> Boolean) {
        g.on { m ->
            if (e.dead) return@on
            if (m.startsWith("play:")) { val rest = m.substring(5); val i = rest.indexOf(':'); if (i > 0 && rest.substring(0, i) == e.id) playClip(rest.substring(i + 1)); return@on }
            if (has(m)) playClip(m)
        }
    }
}

/** Animator: keyframe clips (x, y, turn, size, fade) made in the Animation timeline; plays on start, on a message, or by state (idle / moving / in the air). */
class Animator(p: JsonMap) : Component(p), ClipPlayer {
    private val clips = (p["clips"] as? List<*>).orEmpty().mapNotNull { it.asMap() }
    private var clip: JsonMap? = null
    private var t = 0.0; private var dir = 1.0
    var playing = false; private var manual = false
    private var mode = "once"
    private val last = mutableMapOf<String, Double>()
    private var prev: Pair<Double, Double>? = null
    private var ent: GameObject? = null
    private val props = listOf("x", "y", "rz", "sx", "sy", "alpha"); private val mult = setOf("sx", "sy", "alpha")
    private fun apply(e: GameObject, reset: Boolean = false) {
        val c = clip ?: return
        val tracks = c["tracks"].asMap() ?: return
        for ((key, tr) in tracks) {
            if (key !in props || tr !is List<*> || tr.isEmpty()) continue
            val isMult = key in mult
            val v = if (reset) (if (isMult) 1.0 else 0.0) else sampleTrack(tr, t) ?: continue
            val before = last[key] ?: if (isMult) 1.0 else 0.0
            val cur = e.getField(key)
            e.setField(key, if (isMult) (if (before != 0.0) cur / before * v else v) else cur + v - before)
            last[key] = v
        }
    }
    override fun playClip(name: String, loop: Boolean?, auto: Boolean): Boolean {
        val e = ent
        if (e != null && clip != null) apply(e, reset = true)
        clip = clips.firstOrNull { it["name"] == name }
        t = 0.0; dir = 1.0; playing = clip != null; last.clear()
        mode = if (loop == null) strOf(clip?.get("loop"), "once") else if (loop) "loop" else "once"
        manual = !auto
        return clip != null
    }
    val current get() = if (playing) strOf(clip?.get("name")) else ""
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) {
        ent = e
        if (s("autoplay").isNotEmpty()) playClip(s("autoplay"))
        listenForClips(e, g) { m -> clips.any { it["name"] == m } }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val idle = s("idleClip"); val move = s("moveClip"); val air = s("airClip")
        if ((idle.isNotEmpty() || move.isNotEmpty() || air.isNotEmpty()) && !(manual && playing && mode != "loop")) {
            val pv = prev; val moved = pv != null && hypot(e.x - pv.first, e.y - pv.second) > 0.5 * dt * 30
            prev = e.x to e.y
            val b = e.body; val inAir = b != null && !b.grounded && g.gravity != 0.0 && b.gravityScale != 0.0
            val want = if (inAir && air.isNotEmpty()) air else if (moved && move.isNotEmpty()) move else idle
            if (want.isNotEmpty() && (clip?.get("name") != want || !playing)) playClip(want, auto = true)
        }
        val c = clip
        if (!playing || c == null) return
        val len = max(0.01, numOf(c["length"], 1.0))
        t += dt * n("speed", 1.0) * dir
        if (t >= len || t < 0) {
            when (mode) {
                "loop" -> t = ((t % len) + len) % len
                "ping-pong" -> { dir = -dir; t = t.coerceIn(0.0, len) }
                else -> { t = len; apply(e); playing = false; g.send("animation done: ${c["name"]}"); return }
            }
        }
        apply(e)
    }
}

/** Sprite Sheet Animator: plays frames from a sheet picture by clip ("idle: 0-3, run: 4-7"); switches to run / jump by itself and flips to face the way it goes.
 *  (The Kotlin build draws pictures as boxes: it keeps the frame number in data["frame"] and the facing.) */
class SpriteSheet(p: JsonMap) : Component(p), ClipPlayer {
    private val clips = parse(s("clips", "idle: 0-3"))
    private var cur = ""; private var t = 0.0
    var playing = false; private var once = false; private var manual = false; var flip = false
    var frame = 0
    private var prev: Pair<Double, Double>? = null
    companion object {
        fun parse(text: String): Map<String, Pair<Int, Int>> {
            val out = mutableMapOf<String, Pair<Int, Int>>()
            for (part in text.split(",")) {
                val m = Regex("^\\s*([^:]+?)\\s*:\\s*(\\d+)\\s*(?:-\\s*(\\d+))?\\s*$").find(part) ?: continue
                val a = m.groupValues[2].toInt(); val b = m.groupValues[3].toIntOrNull() ?: a
                out[m.groupValues[1]] = if (a <= b) a to b else b to a
            }
            return out
        }
    }
    override fun playClip(name: String, loop: Boolean?, auto: Boolean): Boolean {
        if (name !in clips) return false
        if (cur != name) t = 0.0
        cur = name; playing = true; once = loop == false; manual = !auto
        return true
    }
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) {
        val size = n("size", 64.0)
        if (e.shape == null) e.sprite = mapOf("src" to s("image", strOf(e.sprite?.get("src"))), "w" to size, "h" to size)
        if (s("autoplay").isNotEmpty()) playClip(s("autoplay"), loop = true, auto = true)
        listenForClips(e, g) { it in clips }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val pv = prev; val dx = if (pv == null) 0.0 else e.x - pv.first; val moved = pv != null && hypot(e.x - pv.first, e.y - pv.second) > 15 * dt
        prev = e.x to e.y
        if (p["flip"] != false && abs(dx) > 0.5 * dt) { flip = dx < 0; faceX(e, dx) }
        if (on("auto") && !(manual && playing && once)) {
            val b = e.body; val inAir = b != null && !b.grounded && g.gravity != 0.0 && b.gravityScale != 0.0
            val run = s("runClip", "run"); val jump = s("jumpClip", "jump")
            val want = if (inAir && jump in clips) jump else if (moved && run in clips) run else s("autoplay")
            if (want.isNotEmpty() && (want != cur || !playing)) playClip(want, loop = true, auto = true)
        }
        val c = clips[cur]
        if (!playing || c == null) return
        val count = c.second - c.first + 1
        t += dt * n("fps", 8.0)
        if (t >= count) { if (once) { t = count - 1e-6; playing = false } else t %= count }
        frame = c.first + floor(t).toInt()
        e.data["frame"] = frame.toDouble()
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Cameras: blends between cameras (Brain), cutscenes (Sequence), mixing two cameras, framing a group, zones, switching
// ---------------------------------------------------------------------------------------------------------------

/** A camera's wish: where the view looks and how far it's zoomed. */
data class CamView(val x: Double, val y: Double, val zoom: Double)

/** Which camera is live and how the view blends to the next one ("Wide Cam", 1.5 s, inOutCubic). */
class CamDirector(g: PocketGame) {
    companion object { fun of(g: PocketGame) = g.systems.getOrPut("camdir") { CamDirector(g) } as CamDirector }
    /** The next switch's blend (a sequence shot, a zone): seconds and ease. */
    var nextBlend: Pair<Double, String?>? = null
    /** Camera Brain rules: from, to, seconds, ease; '*' matches any camera. */
    var rules = listOf<CamRule>()
    var defaultBlend: Double? = null
    var defaultEase = "inOutCubic"
    var to: GameObject? = null
    private var bt = 0.0; private var bdur = 0.0; private var fx = 0.0; private var fy = 0.0; private var fz = 1.0
    private var bease = "inOutCubic"
    private var stamp = -1.0
    private var lastLive: GameObject? = null
    val holder = GameObject(mapOf("name" to "(camera blend)"), g)

    /** The camera object with this name (null / empty: back to priorities). */
    fun live(g: PocketGame, name: String?) {
        val cam = if (name.isNullOrEmpty()) null else g.objects.firstOrNull { !it.dead && it.name == name && (it.part<CameraRig>() != null || it.part<CameraMixer>() != null) } ?: g.find(name)
        var from = if (g.activeCamera === holder) to else g.activeCamera
        if (from === cam && lastLive !== cam) from = lastLive // (the "switch camera" action already made it live: blend from the one before)
        if (cam === from && to == null) return
        val nb = nextBlend; nextBlend = null
        var rule: Pair<Double, String?>? = null
        if (nb == null) {
            val fn = from?.name ?: ""; val tn = cam?.name ?: ""
            rule = rules.firstOrNull { it.from == fn && it.to == tn }?.let { it.seconds to it.ease }
                ?: rules.firstOrNull { it.from == fn && it.to == "*" }?.let { it.seconds to it.ease }
                ?: rules.firstOrNull { it.from == "*" && it.to == tn }?.let { it.seconds to it.ease }
            if (rule == null && defaultBlend != null) rule = defaultBlend!! to defaultEase
        }
        val dur = nb?.first ?: rule?.first ?: -1.0
        if (cam == null) { to = null; g.activeCamera = null; return }
        if (dur <= 0) { to = null; g.activeCamera = cam; if (dur == 0.0) camWant(g, cam)?.let { g.camX = it.x; g.camY = it.y; g.camZoom = it.zoom }; return }
        to = cam; bt = 0.0; bdur = dur; bease = nb?.second ?: rule?.second ?: defaultEase; fx = g.camX; fy = g.camY; fz = g.camZoom
        g.activeCamera = holder // (no camera moves the view while the blend does)
    }
    /** Once a frame: move the view along a blend. */
    fun tick(g: PocketGame, dt: Double) {
        if (stamp == g.time) return
        stamp = g.time
        if (g.activeCamera !== holder && g.activeCamera !== to) lastLive = g.activeCamera
        val c = to ?: return
        if (c.dead) { to = null; g.activeCamera = null; return }
        if (g.activeCamera === c) g.activeCamera = holder // (a camera's own listener made it live first: the blend still runs)
        if (g.activeCamera !== holder) { to = null; return } // (something else took over)
        bt += dt
        val k = ease(bease, bt / bdur)
        camWant(g, c)?.let { g.camX = fx + (it.x - fx) * k; g.camY = fy + (it.y - fy) * k; g.camZoom = fz + (it.zoom - fz) * k }
        if (bt >= bdur) { to = null; g.activeCamera = c }
    }
}
data class CamRule(val from: String, val to: String, val seconds: Double, val ease: String?)

/** Where a camera object wants the view: a fixed camera its own spot, a following one its target (plus offsets), a mixer its blend. */
fun camWant(g: PocketGame, cam: GameObject): CamView? {
    cam.part<CameraMixer>()?.let { return it.want(g, cam) }
    val r = cam.part<CameraRig>() ?: return CamView(cam.x, cam.y, 1.0)
    val p = r.p; val zoom = numOf(cam.data["camZoom"], numOf(p["zoom"], 1.0)).coerceIn(0.1, 10.0); val mode = strOf(p["mode"], "follow")
    if (mode == "fixed") return CamView(cam.x, cam.y, zoom)
    val tag = strOf(p["target"], "player")
    val t = g.objects.firstOrNull { !it.dead && it.has(tag) } ?: return CamView(g.camX, g.camY, zoom)
    return CamView(t.x + numOf(p["ox"]), if (mode == "side scroller") g.viewH / 2 + numOf(p["oy"]) else t.y + numOf(p["oy"]), zoom)
}

/** Camera Brain: custom blends between particular cameras ("Menu Cam > * = 2 inOutSine"), and a default blend. */
class CameraBrain(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) {
        val d = CamDirector.of(g)
        d.rules = s("blends").split("\n").mapNotNull { l ->
            Regex("^\\s*(.+?)\\s*>\\s*(.+?)\\s*=\\s*([\\d.]+)\\s*(\\w+)?\\s*$").find(l)?.let { m -> CamRule(m.groupValues[1], m.groupValues[2], numOf(m.groupValues[3]), m.groupValues[4].ifEmpty { null }) }
        }
        d.defaultBlend = if ((p["defaultBlend"] ?: "").toString().isEmpty()) null else n("defaultBlend")
        d.defaultEase = s("defaultEase", "inOutCubic")
        g.on { m -> if (m.startsWith("camera:") && d.rules.isNotEmpty()) d.live(g, m.substring(7)) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) = CamDirector.of(g).tick(g, dt)
}

/** Camera Sequence: a cutscene of camera shots ("Wide Cam | hold 2 | blend 1"), with letterbox bars; tap to skip. */
class CameraSequence(p: JsonMap) : Component(p) {
    private var i = -1; private var t = 0.0; private var bars = 0.0
    var playing = false
    private var before: GameObject? = null
    private val shots: List<Triple<String, Double, Double>> get() = s("shots").split("\n").mapNotNull { l ->
        val r = l.split("|").map { it.trim() }
        if (r[0].isEmpty()) null else Triple(r[0], max(0.0, numOf(r.getOrNull(1) ?: "2", 2.0)), max(0.0, numOf(r.getOrNull(2) ?: "1", 1.0)))
    }
    private fun go(g: PocketGame, k: Int): Boolean {
        val s = shots
        if (k < 0 || k >= s.size) return false
        i = k; t = 0.0
        val d = CamDirector.of(g)
        d.nextBlend = s[k].third to null
        d.live(g, s[k].first)
        return true
    }
    private fun stop(e: GameObject, g: PocketGame, done: Boolean) {
        if (!playing) return
        playing = false; i = -1
        val d = CamDirector.of(g)
        d.nextBlend = 0.3 to null
        d.live(g, before?.name)
        if (before == null) g.activeCamera = null
        if (done && s("endMessage").isNotEmpty()) g.send(s("endMessage"))
    }
    fun play(e: GameObject, g: PocketGame) {
        if (playing) return
        val d = CamDirector.of(g)
        before = if (g.activeCamera === d.holder) d.to else g.activeCamera
        playing = true
        if (!go(g, 0)) stop(e, g, true)
    }
    override val always get() = true
    override fun start(e: GameObject, g: PocketGame) {
        if (s("start") == "on a message") g.on { m -> if (!e.dead && m == s("message", "cutscene")) play(e, g) } else play(e, g)
        g.overlays.add {
            if (bars <= 0.002 || e.dead) return@add
            val h = (g.screen.height * 0.11 * bars).toFloat()
            drawRect(Color.Black, Offset.Zero, Size(g.screen.width, h))
            drawRect(Color.Black, Offset(0f, g.screen.height - h), Size(g.screen.width, h))
        }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        CamDirector.of(g).tick(g, dt)
        bars += ((if (playing && p["bars"] != false) 1.0 else 0.0) - bars) * min(1.0, dt * 6)
        if (!playing) return
        if (p["skip"] != false && g.taps.isNotEmpty() && t > 0.2) { g.taps.clear(); stop(e, g, true); return }
        t += dt
        val s = shots
        if (i < 0 || i >= s.size) { stop(e, g, true); return }
        if (t >= s[i].third + s[i].second) { if (!go(g, i + 1)) { if (on("loop")) go(g, 0) else stop(e, g, true) } }
    }
    override fun gone(e: GameObject, g: PocketGame) = stop(e, g, false)
}

/** Camera Mixer: a camera that sits between two others (a weight, or a variable): an aim camera halfway to a follow camera… */
class CameraMixer(p: JsonMap) : Component(p) {
    private var st: CamView? = null
    fun want(g: PocketGame, e: GameObject): CamView? {
        val a = g.find(s("camA", "Camera 1")); val b = g.find(s("camB", "Camera 2"))
        val wa = if (a == null || a === e) null else camWant(g, a); val wb = if (b == null || b === e) null else camWant(g, b)
        if (wa == null && wb == null) return null
        val A = wa ?: wb!!; val B = wb ?: wa!!; val v = s("var")
        val w = (if (e.data["camMix"] != null) numOf(e.data["camMix"]) else if (v.isNotEmpty()) g.numVar(v) / max(1e-6, n("max", 1.0)) else n("weight", 0.5)).coerceIn(0.0, 1.0)
        return CamView(A.x + (B.x - A.x) * w, A.y + (B.y - A.y) * w, A.zoom + (B.zoom - A.zoom) * w)
    }
    override fun start(e: GameObject, g: PocketGame) {
        e.data["priority"] = n("priority")
        g.on { m -> if (m == "camera:${e.name}" || m == "camera:${e.id}") g.activeCamera = e }
        val cur = g.activeCamera
        if (cur == null || n("priority") > numOf(cur.data["priority"])) g.activeCamera = e
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (g.activeCamera !== e) { st = null; return }
        val w = want(g, e) ?: return
        val k = if (st == null) 1.0 else 1 - exp(-n("smooth", 8.0) * dt); val s0 = st ?: w
        val s1 = CamView(s0.x + (w.x - s0.x) * k, s0.y + (w.y - s0.y) * k, s0.zoom + (w.zoom - s0.zoom) * k)
        st = s1
        g.camX = s1.x; g.camY = s1.y; g.camZoom = s1.zoom.coerceIn(0.1, 10.0)
    }
}

/** Target Group: a camera aimed at this object frames everything in the group ("player | 1 | 40" lines: tag, weight, radius). */
class CameraTargetGroup(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        var sx = 0.0; var sy = 0.0; var sw = 0.0
        var l = Double.POSITIVE_INFINITY; var t = Double.POSITIVE_INFINITY; var r = Double.NEGATIVE_INFINITY; var b = Double.NEGATIVE_INFINITY
        for (line in s("members").split("\n")) {
            val parts = line.split("|").map { it.trim() }
            if (parts[0].isEmpty()) continue
            val w = if (parts.size > 1) numOf(parts[1], 1.0) else 1.0; val rad = if (parts.size > 2) numOf(parts[2]) else 0.0
            if (w <= 0) continue
            for (q in g.findAll(parts[0])) {
                if (q === e) continue
                sx += q.x * w; sy += q.y * w; sw += w
                l = min(l, q.x - rad); r = max(r, q.x + rad); t = min(t, q.y - rad); b = max(b, q.y + rad)
            }
        }
        if (sw == 0.0) return
        e.x = sx / sw; e.y = sy / sw
        // cameras aimed at the group zoom out to fit everyone (with some room)
        val fit = min(g.viewW / max(1.0, (r - l) + 120), g.viewH / max(1.0, (b - t) + 120)).coerceIn(0.3, 1.5)
        for (o in g.objects) { val rig = o.part<CameraRig>() ?: continue; if (e.has(strOf(rig.p["target"], "player"))) o.data["camZoom"] = min(numOf(rig.p["zoom"], 1.0), fit) }
    }
}

/** Camera Zone: while the player is inside, another camera is live (then back to the one before, or keep it). */
class CameraZone(p: JsonMap) : Component(p) {
    private var inside = false
    private var before: String? = null
    override fun start(e: GameObject, g: PocketGame) { if (p["hide"] != false) e.visible = false }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val d = CamDirector.of(g)
        d.tick(g, dt)
        val h = e.half; val now = g.findAll(s("tag", "player")).any { it !== e && abs(it.x - e.x) <= h.w && abs(it.y - e.y) <= h.h }
        if (now == inside) return
        inside = now
        if ((p["blend"] ?: "").toString().isNotEmpty()) d.nextBlend = n("blend") to null
        val cam = s("camera", "Camera 2")
        if (now) {
            val cur = if (g.activeCamera === d.holder) d.to else g.activeCamera
            before = cur?.name
            d.live(g, cam)
            if (s("message").isNotEmpty()) g.send(s("message"))
        } else if (p["mode"] != "keep this camera") {
            val cur = if (g.activeCamera === d.holder) d.to else g.activeCamera
            if (cur?.name == cam) d.live(g, before)
        }
    }
}

/** Camera Switcher: picks the live camera from a variable ("run = Follow Cam"), or the first camera that can see the target (clear shot). */
class CameraSwitcher(p: JsonMap) : Component(p) {
    private var held = 9.0
    private var cur: String? = "\u0000"
    private fun pick(g: PocketGame): String? {
        val fb = s("fallback").ifEmpty { null }
        if (p["mode"] == "clear shot") {
            val t = g.findAll(s("target", "player")).firstOrNull() ?: return fb
            for (name in tagList(p["cameras"])) { val c = g.find(name); if (c != null && g.canSee(c, t)) return name }
            return fb
        }
        val v = g.vars[s("var", "state")]
        for (l in s("map").split("\n")) {
            val m = Regex("^\\s*([^=]+?)\\s*=\\s*(.+?)\\s*$").find(l) ?: continue
            val key = m.groupValues[1]
            if (key == strOf(v) || (key.toDoubleOrNull() != null && v is Number && key.toDouble() == v.toDouble())) return m.groupValues[2]
        }
        return fb
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val d = CamDirector.of(g)
        d.tick(g, dt)
        held += dt
        val want = pick(g)
        if (want == cur || held < n("hold", 0.5)) return
        cur = want; held = 0.0
        d.live(g, want)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Turn-based games: whose turn it is, the enemy turn, grid movement, grid enemies, squads, boards and battle buttons
// ---------------------------------------------------------------------------------------------------------------

/** A component that acts on the enemy's turn (Turn Enemy, enemy Squad Units, Enemy Turn, the computer on a board). */
interface TurnTaker { fun onTurn(e: GameObject, g: PocketGame) }

/** Whose turn it is: the player moves, then enemies act (after a short delay), then it's the player's turn again. */
class Turns(g: PocketGame) {
    companion object { fun of(g: PocketGame) = g.systems.getOrPut("turns") { Turns(g) } as Turns }
    init { if (g.settings["turnBased"] == true) { if (g.vars["turn"] == null) g.vars["turn"] = 1.0; g.vars["turnText"] = "Your turn" } }
    /** player, enemy, or enemyBusy (enemies still walking). */
    var side = "player"
    private var delay = 0.0; private var holdFor = 0.0; private var stamp = -1.0
    val onPlayerTurn = mutableListOf<() -> Unit>()
    val isPlayerTurn get() = side == "player"
    /** The player finished a move: enemies act next. */
    fun endTurn(g: PocketGame) {
        if (side != "player" || g.state != "play") return
        side = "enemy"
        delay = numOf(g.settings["turnDelay"], 0.3)
        g.setVar("turnText", strOf(g.settings["enemyTurnText"], "Enemy turn"))
    }
    /** Enemy turn: keep it going this long (enemies walking several tiles, one after another). */
    fun holdTurn(sec: Double) { holdFor = max(holdFor, sec) }
    fun playerTurn(g: PocketGame) {
        side = "player"
        g.addVar("turn", 1.0)
        g.setVar("turnText", strOf(g.settings["playerTurnText"], "Your turn"))
        for (f in onPlayerTurn.toList()) f()
    }
    /** Once a frame (whichever turn component runs first). */
    fun tick(g: PocketGame, dt: Double) {
        if (stamp == g.time) return
        stamp = g.time
        if (g.state != "play") return
        if (side == "enemy") {
            delay -= dt
            if (delay > 0) return
            holdFor = 0.0
            for (o in g.objects.toList()) { if (o.dead) continue; for (c in o.parts) if (c is TurnTaker) c.onTurn(o, g) }
            if (g.state == "play") { if (holdFor > 0) { side = "enemyBusy"; delay = holdFor } else playerTurn(g) }
        } else if (side == "enemyBusy") { delay -= dt; if (delay <= 0) playerTurn(g) }
    }
}

fun turnBased(g: PocketGame) = g.settings["turnBased"] == true

/** Is a grid tile blocked? Walls (static bodies, "wall" tags), squad units, turn enemies, "pushable" things, living enemies. */
fun blockerAt(g: PocketGame, x: Double, y: Double, except: GameObject?, skip: ((GameObject) -> Boolean)? = null): GameObject? {
    for (o in g.objects) {
        if (o === except || o.dead || o.ui || (skip?.invoke(o) == true)) continue
        val gu = o.part<GridUnit>()
        if (gu != null) { val h = gu.tile / 2 - 0.01; if (abs(gu.cx - x) < h && abs(gu.cy - y) < h) return o; continue }
        val b = o.body; val hb = o.part<Health>()
        val solid = (b != null && !b.sensor && (b.type == "static" || "wall" in o.tags)) || o.part<GridEnemy>() != null || "pushable" in o.tags || (o.has("enemy") && hb != null && !hb.dead)
        if (!solid) continue
        val h = o.half
        if (abs(o.x - x) < h.w - 0.01 && abs(o.y - y) < h.h - 0.01) return o
    }
    return null
}

/** The grid the walls sit on (so heroes and enemies line up with the level). */
@Suppress("UNCHECKED_CAST")
fun gridOrigin(g: PocketGame, t: Double): Pair<Double, Double> {
    val cache = g.systems.getOrPut("gridOrigin") { mutableMapOf<Double, Pair<Double, Double>>() } as MutableMap<Double, Pair<Double, Double>>
    cache[t]?.let { return it }
    fun m(v: Double) = round(((v % t) + t) % t * 1000) / 1000
    val ref = g.objects.firstOrNull { !it.dead && !it.ui && it.body?.type == "static" && it.body?.sensor == false } ?: g.objects.firstOrNull { !it.dead && it.part<GridMove>() != null }
    val o = if (ref == null) 0.0 to 0.0 else m(ref.x) to m(ref.y)
    cache[t] = o
    return o
}
fun snapToGrid(g: PocketGame, e: GameObject, t: Double) { val o = gridOrigin(g, t); e.x = round((e.x - o.first) / t) * t + o.first; e.y = round((e.y - o.second) / t) * t + o.second }
/** Things on a grid that fight back: Turn Enemies, enemy units, and enemies with Health. */
fun gridFoe(o: GameObject?) = o != null && !o.dead && (o.part<GridEnemy>() != null || o.part<GridUnit>()?.team == "enemy" || (o.has("enemy") && o.part<Health>() != null))

/** A step on a grid. */
data class Cell2(val i: Int, val j: Int)

/** Shortest walk over free tiles: steps [(dx, dy)…], or null. The last tile may hold a foe (to attack it). */
fun gridPath(g: PocketGame, e: GameObject, tx: Double, ty: Double, t: Double, diagonal: Boolean = false, maxCells: Int = 900, foeOk: Boolean = true,
             isFoe: ((GameObject?) -> Boolean)? = null, skip: ((GameObject) -> Boolean)? = null, fromX: Double? = null, fromY: Double? = null): MutableList<Cell2>? {
    val sx = fromX ?: e.x; val sy = fromY ?: e.y; val gx = round((tx - sx) / t).toInt(); val gy = round((ty - sy) / t).toInt()
    if (gx == 0 && gy == 0) return mutableListOf()
    val foe = isFoe ?: ::gridFoe; val R = max(abs(gx), abs(gy)) + 8
    val prev = HashMap<Cell2, Cell2?>(); prev[Cell2(0, 0)] = null
    val q = mutableListOf(Cell2(0, 0))
    val dirs = if (diagonal) DIRS8 else DIRS4
    fun block(i: Int, j: Int) = blockerAt(g, sx + i * t, sy + j * t, e, skip)
    var head = 0
    while (head < q.size && prev.size < maxCells) {
        val c = q[head++]
        if (c.i == gx && c.j == gy) {
            val out = mutableListOf<Cell2>()
            var cur = c
            while (true) { val pv = prev[cur] ?: break; out.add(0, Cell2(cur.i - pv.i, cur.j - pv.j)); cur = pv }
            return out
        }
        for (d in dirs) {
            val ni = c.i + d.i; val nj = c.j + d.j; val k = Cell2(ni, nj)
            if (prev.containsKey(k) || abs(ni) > R || abs(nj) > R) continue
            if (d.i != 0 && d.j != 0 && (block(c.i + d.i, c.j) != null || block(c.i, c.j + d.j) != null)) continue // (no cutting corners)
            val b = block(ni, nj); val goal = ni == gx && nj == gy
            if (b != null && !(goal && foeOk && foe(b))) continue
            prev[k] = c; q.add(k)
        }
    }
    return null
}
val DIRS4 = listOf(Cell2(1, 0), Cell2(-1, 0), Cell2(0, 1), Cell2(0, -1))
val DIRS8 = DIRS4 + listOf(Cell2(1, 1), Cell2(1, -1), Cell2(-1, 1), Cell2(-1, -1))

/** A little nudge toward a direction and back (bumping a wall, attacking). */
fun gridNudge(g: PocketGame, e: GameObject, dx: Int, dy: Int, t: Double) {
    val x0 = e.x; val y0 = e.y; val k = t * 0.25
    g.tween(e, "x", x0 + dx * k, 0.06); g.tween(e, "y", y0 + dy * k, 0.06)
    g.after(0.07) { g.tween(e, "x", x0, 0.07); g.tween(e, "y", y0, 0.07) }
}
/** Hurt whatever is on a grid tile: a Turn Enemy, a unit, or anything with Health. */
fun gridHurt(g: PocketGame, target: GameObject, amount: Double, from: GameObject?): Double {
    target.part<GridEnemy>()?.let { return it.hurt(target, g, amount, from) }
    target.part<GridUnit>()?.let { return it.hurt(target, g, amount, from) }
    return target.part<Health>()?.damage(target, g, amount, from = from, knockback = 0.0) ?: 0.0
}
fun barOver(e: GameObject, show: String, hp: Double, max: Double, full: Color, low: Color) {
    val k = if (max > 0) hp / max else 0.0
    if (show == "always" || (show != "never" && hp < max)) e.bars["health"] = k to (if (k > 0.5) full else if (k > 0.25) Color(0xFFFFD23D) else low) else e.bars.remove("health")
    e.data["hp"] = hp; e.data["hpMax"] = max
}

/** Grid Move: one tile at a time (arrow keys, joystick, swipes, or tap a tile to walk there around walls); bump enemies to attack, push "pushable" things.
 *  In turn-based games each step ends your turn. */
class GridMove(p: JsonMap) : Component(p) {
    private var busy = 0.0; private var held = 0.0
    private var path = mutableListOf<Cell2>()
    private var goal: Pair<Double, Double>? = null
    val tile get() = n("tile", 40.0)
    private fun dirOf(a: Offset): Cell2? {
        val ax = if (abs(a.x) > 0.38f) sign(a.x).toInt() else 0; val ay = if (abs(a.y) > 0.38f) sign(a.y).toInt() else 0
        if (on("diagonal")) return if (ax != 0 || ay != 0) Cell2(ax, ay) else null
        if (ax == 0 && ay == 0) return null
        return if (abs(a.x) > abs(a.y)) Cell2(ax, 0) else Cell2(0, ay)
    }
    private fun face(e: GameObject, dx: Int, dy: Int) {
        val f = s("face", "flip left / right")
        if (f == "turn") e.rz = atan2(dy.toDouble(), dx.toDouble()) / DEG else if (f != "no" && dx != 0) faceX(e, dx.toDouble())
    }
    /** One step: false if a wall stopped it; true if it moved, attacked or pushed. */
    fun step(e: GameObject, g: PocketGame, dx: Int, dy: Int): Boolean {
        val t = tile; val tx = e.x + dx * t; val ty = e.y + dy * t; val st = n("stepTime", 0.14)
        face(e, dx, dy)
        val hit = blockerAt(g, tx, ty, e)
        if (gridFoe(hit)) {
            gridNudge(g, e, dx, dy, t); gridHurt(g, hit!!, n("damage", 1.0) + numOf(e.data["equipDamage"]), e)
            path.clear(); goal = null; busy = max(0.16, st)
            if (turnBased(g)) Turns.of(g).endTurn(g)
            return true
        }
        if (hit != null && "pushable" in hit.tags) {
            val bx = hit.x + dx * t; val by = hit.y + dy * t
            if (blockerAt(g, bx, by, hit) != null) { gridNudge(g, e, dx, dy, t); g.buzz(); path.clear(); goal = null; busy = 0.15; return false }
            g.tween(hit, "x", bx, st); g.tween(hit, "y", by, st)
        } else if (hit != null) { gridNudge(g, e, dx, dy, t); g.buzz(); path.clear(); goal = null; busy = 0.15; return false }
        g.killTweens(e, "x"); g.killTweens(e, "y")
        g.tween(e, "x", tx, st * 0.9); g.tween(e, "y", ty, st * 0.9)
        e.data["gridX"] = tx; e.data["gridY"] = ty
        if (p["sound"] != false) g.sfx("click")
        busy = st
        if (turnBased(g)) Turns.of(g).endTurn(g)
        return true
    }
    override fun start(e: GameObject, g: PocketGame) {
        e.ensureBody("kinematic")
        if (p["snap"] != false) snapToGrid(g, e, tile)
        e.data["gridX"] = e.x; e.data["gridY"] = e.y
        if (turnBased(g)) Turns.of(g)
        if (p["marker"] != false) {
            g.overlays.add {
                val gl = goal ?: return@add
                if (e.dead) return@add
                val q = g.toScreen(gl.first, gl.second); val r = (tile * g.zoom * 0.32).toFloat(); val k = 0.6f + 0.4f * abs(sin(g.time * 6)).toFloat()
                drawCircle(Color.White.copy(alpha = 0.8f * k), r, q, style = Stroke(2.5f))
            }
        }
    }
    private fun tapIgnored(g: PocketGame, t: Tap) = g.objects.any { it.ui && !it.dead && it.shown && it.parts.isNotEmpty() && g.hits(it, t) } || g.tapTargets.any { !it.dead && g.hits(it, t) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (turnBased(g)) Turns.of(g).tick(g, dt)
        busy -= dt
        if (g.state != "play") { path.clear(); goal = null; return }
        var want: Cell2? = null
        for ((d, v) in listOf("left" to Cell2(-1, 0), "right" to Cell2(1, 0), "up" to Cell2(0, -1), "down" to Cell2(0, 1))) if ("swipe:$d" in g.pressed) { want = v; break }
        val a = dirOf(g.axis())
        if (want == null && a != null) { held += dt; if (held == dt) want = a } else if (a == null) held = 0.0
        if (want != null) { path = mutableListOf(want); goal = null }
        else if (p["tapToMove"] != false && g.taps.isNotEmpty()) {
            val t = g.taps.firstOrNull { !tapIgnored(g, it) }
            if (t != null) {
                val w = t.world; val o = gridOrigin(g, tile); val cx = round((w.x - o.first) / tile) * tile + o.first; val cy = round((w.y - o.second) / tile) * tile + o.second
                val fx = numOf(e.data["gridX"], e.x); val fy = numOf(e.data["gridY"], e.y)
                if (p["tapMode"] == "steps toward the tap") {
                    val ox = w.x - fx; val oy = w.y - fy
                    if (hypot(ox, oy) > tile * 0.4) { path = mutableListOf(if (abs(ox) > abs(oy)) Cell2(sign(ox).toInt(), 0) else Cell2(0, sign(oy).toInt())); goal = null }
                } else {
                    val route = gridPath(g, e, cx, cy, tile, diagonal = on("diagonal"), fromX = fx, fromY = fy)
                    if (route != null && route.isNotEmpty()) { path = route; goal = cx to cy } else if (route == null) { g.buzz(); g.message("Can't get there", 0.8) }
                }
            }
        }
        if (busy > 0 || (turnBased(g) && !Turns.of(g).isPlayerTurn)) return
        if (path.isEmpty() && a != null && p["holdRepeat"] != false && held > 0.22) path = mutableListOf(a)
        if (path.isEmpty()) { goal = null; return }
        // (positions come from where the last step ends, not the tween in between)
        e.x = numOf(e.data["gridX"], e.x); e.y = numOf(e.data["gridY"], e.y)
        val d = path.removeAt(0)
        step(e, g, d.i, d.j)
        if (path.isEmpty()) goal = null
    }
}

/** The nearest thing a side goes after: team 'enemy' looks for the player (or player units); team 'player' for foes. */
fun gridTargetFor(g: PocketGame, e: GameObject, team: String = "enemy", maxDist: Double = Double.POSITIVE_INFINITY): GameObject? {
    var best: GameObject? = null; var bd = maxDist
    for (o in g.objects) {
        if (o.dead || o === e || o.ui) continue
        val u = o.part<GridUnit>()
        val ok = if (team == "enemy") (if (u != null) u.team == "player" else o.has("player")) else (if (u != null) u.team == "enemy" else gridFoe(o))
        if (!ok) continue
        val d = hypot(o.x - e.x, o.y - e.y)
        if (d < bd) { bd = d; best = o }
    }
    return best
}

/** Turn Enemy: acts on each enemy turn (or every so often): walks toward the player around walls when it sees them,
 *  wanders or goes home, and attacks when next to them. Bump it to hurt it. */
class GridEnemy(p: JsonMap) : Component(p), TurnTaker {
    var hp = 1.0; var max = 1.0; private var clock = 0.0; private var turns = 0
    private var home = 0.0 to 0.0
    val tile get() = n("tile", 40.0)
    private fun bar(e: GameObject) = barOver(e, s("showBar", "when hurt"), hp, max, Color(0xFF5DFF8A), Color(0xFFFF4D4D))
    fun hurt(e: GameObject, g: PocketGame, dmg: Double, from: GameObject?): Double {
        e.part<Health>()?.let { return it.damage(e, g, dmg, from = from, knockback = 0.0) }
        hp -= dmg; e.invuln = 0.2; g.sfx("hit"); bar(e); e.data["flash"] = 0.12
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFF5555), 12)
        g.popOver(e, "-${dmg.roundToInt()}", Color(0xFFFF6B6B), 20.0)
        if (hp <= 0) { g.addVar("score", n("points", 10.0)); e.destroy() }
        return dmg
    }
    private fun attack(e: GameObject, g: PocketGame, pl: GameObject) {
        g.squash(e, 1.2)
        val dmg = n("attack", 1.0)
        val hb = pl.part<Health>()
        if (pl.part<GridUnit>() != null) gridHurt(g, pl, dmg, e)
        else if (hb != null) hb.damage(pl, g, dmg, from = e, knockback = 0.0)
        else if (pl.invuln <= 0) g.hurt(pl, "damage")
    }
    @Suppress("UNCHECKED_CAST")
    private fun moveTo(e: GameObject, g: PocketGame, dx: Int, dy: Int): Boolean {
        val t = tile; val tx = e.x + dx * t; val ty = e.y + dy * t; val key = "${tx.roundToInt()},${ty.roundToInt()}"
        val res = g.systems.getOrPut("gridRes") { mutableMapOf<String, Any?>("t" to -1.0, "set" to mutableSetOf<String>()) } as MutableMap<String, Any?>
        val taken = res["set"] as MutableSet<String>
        if (res["t"] != g.time) { res["t"] = g.time; taken.clear() }
        if (key in taken || blockerAt(g, tx, ty, e) != null) return false
        val pl = g.findAll("player").firstOrNull()
        if (pl != null && abs(pl.x - tx) < t / 2 && abs(pl.y - ty) < t / 2) return false
        taken.add(key)
        g.tween(e, "x", tx, 0.15); g.tween(e, "y", ty, 0.15)
        if (dx != 0) faceX(e, dx.toDouble())
        return true
    }
    private fun act(e: GameObject, g: PocketGame) {
        val pl = gridTargetFor(g, e, "enemy") ?: return
        if (e.dead) return
        val t = tile; val dx = round((pl.x - e.x) / t).toInt(); val dy = round((pl.y - e.y) / t).toInt(); val d = abs(dx) + abs(dy)
        if (d == 1) { attack(e, g, pl); return }
        val sight = n("sight", 6.0)
        if (sight == 0.0 || d <= sight) {
            val route = gridPath(g, e, pl.x, pl.y, t, maxCells = 400, foeOk = false)
            val first = route?.firstOrNull()
            if (first != null && moveTo(e, g, first.i, first.j)) return
            val tries = if (abs(dx) >= abs(dy)) listOf(sign(dx.toDouble()).toInt() to 0, 0 to sign(dy.toDouble()).toInt()) else listOf(0 to sign(dy.toDouble()).toInt(), sign(dx.toDouble()).toInt() to 0)
            for ((mx, my) in tries) if ((mx != 0 || my != 0) && moveTo(e, g, mx, my)) return
            return
        }
        when (s("mode", "waits")) {
            "wanders" -> for (dd in DIRS4.shuffled()) if (moveTo(e, g, dd.i, dd.j)) return
            "goes back home" -> { val r = gridPath(g, e, home.first, home.second, t, maxCells = 400, foeOk = false); if (!r.isNullOrEmpty()) moveTo(e, g, r[0].i, r[0].j) }
        }
    }
    override fun start(e: GameObject, g: PocketGame) {
        max = max(1.0, n("hp", 1.0)); hp = max
        if (p["snap"] != false) snapToGrid(g, e, tile)
        home = e.x to e.y
        if (e.part<Health>() == null) bar(e)
        val pl = g.findAll("player").firstOrNull()
        if (pl != null && pl.part<Health>() == null && g.vars["lives"] == null) g.setVar("lives", 3.0)
        if (turnBased(g)) Turns.of(g)
    }
    override fun onTurn(e: GameObject, g: PocketGame) { if (++turns % max(1, n("every", 1.0).roundToInt()) != 0) return; act(e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (turnBased(g)) { Turns.of(g).tick(g, dt); return }
        if (g.state != "play") return
        clock += dt
        if (clock >= max(0.15, n("realTime", 0.7)) * max(1, n("every", 1.0).roundToInt())) { clock = 0.0; act(e, g) }
    }
}

// ---- squads: grid units the player selects (one or many) and moves together: tactics and RTS games ----

fun unitOf(o: GameObject?): GridUnit? = if (o == null || o.dead) null else o.part<GridUnit>()
fun squadUnits(g: PocketGame, team: String) = g.objects.filter { !it.dead && unitOf(it)?.team == team }
fun cellOfObj(o: GameObject): Pair<Double, Double> { val u = unitOf(o); return if (u != null) u.cx to u.cy else o.x to o.y }

/** A squad highlight: a tap marker, a hit ring or a shot. */
class SquadFx(val k: String, val t: Double, val x: Double = 0.0, val y: Double = 0.0, val ok: Boolean = true, val e: GameObject? = null,
              val x1: Double = 0.0, val y1: Double = 0.0, val look: String = "", val col: Color = Color.White)
/** A drag in progress: a selection box, a line from a unit, or moving the camera. */
class SelBox(val id: Long, val unit: GameObject? = null, val pan: Boolean = false, var p: Offset? = null) { var a: Offset? = null; var b: Offset? = null }

/** The squad: who's selected, the selection box, effects; one per game (made by the first unit). */
class Squad(val g: PocketGame) {
    companion object { fun of(g: PocketGame) = g.systems.getOrPut("squad") { Squad(g) } as Squad }
    var cfgRaw: JsonMap = emptyMap()
    var sel = linkedSetOf<GameObject>()
    private var box: SelBox? = null
    private var last: Pair<GameObject, Double>? = null
    val fx = mutableListOf<SquadFx>()
    private var stamp = -1.0
    private var ending = false
    private var hadPlayer = 0; private var hadEnemy = 0
    private var sync = ""
    init {
        g.on { m ->
            when (m.trim().lowercase()) {
                "select all" -> select(squadUnits(g, "player").filter { canAct(it) })
                "select none", "deselect" -> select(emptyList())
                "select next" -> { val l = squadUnits(g, "player").filter { canAct(it) }; if (l.isNotEmpty()) { val cur = sel.firstOrNull(); val i = if (cur == null) -1 else l.indexOf(cur); select(listOf(l[(i + 1) % l.size])) } }
                "stop" -> sel.forEach { unitOf(it)?.stop() }
                "end turn" -> if (turnBased(g) && Turns.of(g).isPlayerTurn) endTurn()
            }
        }
        Turns.of(g).onPlayerTurn.add { ending = false; for (e in squadUnits(g, "player")) unitOf(e)?.newTurn(e) }
        g.overlays.add { draw(this) }
    }
    private fun cfgOn(k: String) = cfgRaw[k] != false
    fun canAct(e: GameObject): Boolean { val u = unitOf(e); return u != null && u.team == "player" && (!turnBased(g) || !u.done) }
    fun select(list: List<GameObject>) {
        val before = sel.joinToString(",") { it.uid.toString() }
        sel = list.filter { canAct(it) }.toCollection(linkedSetOf())
        if (sel.joinToString(",") { it.uid.toString() } == before) return
        if (sel.isNotEmpty()) g.buzz()
        g.setVar("selectedUnits", sel.size.toDouble())
    }
    fun endTurn() { sel.clear(); g.setVar("selectedUnits", 0.0); for (e in squadUnits(g, "player")) unitOf(e)?.stop(); Turns.of(g).endTurn(g) }
    /** Send units to a tile, or after a foe. */
    fun order(units: List<GameObject>, to: Pair<Double, Double>? = null, attack: GameObject? = null) {
        val list = units.filter { canAct(it) && !it.dead }
        if (list.isEmpty()) return
        if (attack != null) { for (e in list) unitOf(e)?.order(e, attack = attack); fx.add(SquadFx("hit", g.time, e = attack)); g.sfx("click"); return }
        val where = formation(list, to!!.first, to.second, strOf(cfgRaw["formation"], "group"))
        var n = 0
        for (e in list) { val c = where[e] ?: continue; if (unitOf(e)!!.order(e, to = c)) n++ }
        fx.add(SquadFx("tap", g.time, to.first, to.second, n > 0))
        if (n == 0) { g.message("Can't get there", 0.8); g.buzz() } else g.sfx("click")
    }
    /** Free tiles around a spot for a group, in formation (group, line, column, keep their shape). */
    fun formation(units: List<GameObject>, gx: Double, gy: Double, mode: String): Map<GameObject, Pair<Double, Double>> {
        val t = unitOf(units[0])!!.tile; val count = units.size
        fun free(x: Double, y: Double) = blockerAt(g, x, y, null) { it in units } == null
        val seen = hashSetOf(Cell2(0, 0)); val q = mutableListOf(Cell2(0, 0)); val out = mutableListOf<Triple<Int, Int, Pair<Double, Double>>>()
        var head = 0
        while (head < q.size && out.size < max(count * 4, count + 10) && seen.size < 900) {
            val c = q[head++]
            val x = gx + c.i * t; val y = gy + c.j * t
            if (free(x, y)) out.add(Triple(c.i, c.j, x to y))
            for (d in DIRS8) { val k = Cell2(c.i + d.i, c.j + d.j); if (k !in seen && abs(k.i) < 30 && abs(k.j) < 30) { seen.add(k); q.add(k) } }
        }
        val res = linkedMapOf<GameObject, Pair<Double, Double>>()
        fun dist(a: Pair<Double, Double>, u: GridUnit) = hypot(a.first - u.cx, a.second - u.cy)
        if (mode == "keep their shape") {
            val mx = units.sumOf { unitOf(it)!!.cx } / count; val my = units.sumOf { unitOf(it)!!.cy } / count; val used = mutableSetOf<String>()
            for (e in units) { val u = unitOf(e)!!; val x = gx + round((u.cx - mx) / t) * t; val y = gy + round((u.cy - my) / t) * t; if (free(x, y) && used.add("$x,$y")) res[e] = x to y }
            val rest = out.filter { "${it.third.first},${it.third.second}" !in used }.map { it.third }.toMutableList()
            for (e in units) { if (e in res || rest.isEmpty()) continue; val u = unitOf(e)!!; rest.sortBy { dist(it, u) }; res[e] = rest.removeAt(0) }
            return res
        }
        fun w(c: Triple<Int, Int, Pair<Double, Double>>) = when (mode) { "line" -> abs(c.second) * 4.0 + abs(c.first); "column" -> abs(c.first) * 4.0 + abs(c.second); else -> sqrt((c.first * c.first + c.second * c.second).toDouble()) }
        out.sortBy { w(it) }
        val cells = out.take(count).map { it.third }.toMutableList(); val left = units.toMutableList()
        while (cells.isNotEmpty() && left.isNotEmpty()) { // (the closest pair first: nobody walks across the whole group)
            var bi = 0; var bj = 0; var bd = Double.POSITIVE_INFINITY
            for (i in cells.indices) for (j in left.indices) { val d = dist(cells[i], unitOf(left[j])!!); if (d < bd) { bd = d; bi = i; bj = j } }
            res[left[bj]] = cells[bi]; cells.removeAt(bi); left.removeAt(bj)
        }
        return res
    }
    private fun uiTap(at: Offset) = g.objects.any { it.ui && !it.dead && it.shown && it.parts.isNotEmpty() && g.hitsAt(it, at) } || g.tapTargets.any { !it.dead && unitOf(it) == null && g.hitsAt(it, at) }
    private fun unitAt(at: Offset, team: String) = g.objects.firstOrNull { !it.dead && it.shown && unitOf(it)?.team == team && g.hitsAt(it, at) }
    private fun cellAt(screen: Offset, ref: GameObject): Pair<Double, Double> { val t = unitOf(ref)!!.tile; val w = g.toWorld(screen); val o = gridOrigin(g, t); return round((w.x - o.first) / t) * t + o.first to round((w.y - o.second) / t) * t + o.second }
    private fun foeAt(at: Offset) = g.objects.firstOrNull { !it.dead && !it.ui && gridFoe(it) && g.hitsAt(it, at) }

    /** Once a frame: taps, the selection box, dragging units, ending the turn, winning and losing. */
    fun tick() {
        if (stamp == g.time) return
        stamp = g.time
        val tb = turnBased(g)
        sel.removeAll { !canAct(it) }
        val mine = squadUnits(g, "player"); val foes = g.objects.filter { !it.dead && !it.ui && (unitOf(it)?.team == "enemy" || it.part<GridEnemy>() != null) }
        hadPlayer = max(hadPlayer, mine.size); hadEnemy = max(hadEnemy, foes.size)
        val ready = if (tb) mine.count { !unitOf(it)!!.done } else mine.size
        val sig = "${sel.size},${mine.size},${foes.size},$ready"
        if (sig != sync) { sync = sig; g.setVar("selectedUnits", sel.size.toDouble()); g.setVar("unitsLeft", mine.size.toDouble()); g.setVar("enemiesLeft", foes.size.toDouble()); g.setVar("unitsReady", ready.toDouble()) }
        if (g.state != "play") { box = null; return }
        if (g.time > 0.3) {
            if (cfgOn("winWhenNoEnemies") && hadEnemy > 0 && foes.isEmpty()) { g.win(); return }
            if (cfgOn("loseWhenNoUnits") && hadPlayer > 0 && mine.isEmpty()) { g.gameOver(); return }
        }
        val myTurn = !tb || Turns.of(g).isPlayerTurn
        if (tb && myTurn && cfgOn("autoEndTurn") && !ending && mine.isNotEmpty() && mine.all { unitOf(it)!!.done && !unitOf(it)!!.busy } && mine.any { unitOf(it)!!.acted }) {
            ending = true
            g.after(0.35) { if (Turns.of(g).isPlayerTurn && g.state == "play") endTurn() }
        }
        // dragging: a box over empty ground, a line from a unit (send it there), or moving the camera
        for (ptr in g.pointers.values) {
            if (ptr.role != "free" || (ptr.at - ptr.start).getDistance() < 18) continue
            if (box == null || box!!.id != ptr.id) {
                if (uiTap(ptr.start)) continue
                val u = if (myTurn) unitAt(ptr.start, "player") else null; val drag = strOf(cfgRaw["drag"], "draws a selection box")
                box = when {
                    u != null && canAct(u) -> SelBox(ptr.id, unit = u)
                    drag == "moves the camera" -> SelBox(ptr.id, pan = true, p = ptr.start)
                    drag == "draws a selection box" && myTurn -> SelBox(ptr.id)
                    else -> null
                } ?: continue
            }
            val b = box!!
            if (b.pan) { val pp = b.p!!; g.camX -= (ptr.at.x - pp.x) / g.zoom; g.camY -= (ptr.at.y - pp.y) / g.zoom; b.p = ptr.at }
            b.a = ptr.start; b.b = ptr.at
            break
        }
        box?.let { b ->
            val up = g.ups.firstOrNull { it.id == b.id }
            if (up != null && !b.pan && myTurn) {
                val unit = b.unit
                if (unit != null) {
                    val group = if (unit in sel) sel.toList() else listOf(unit)
                    if (unit !in sel) select(listOf(unit))
                    val foe = foeAt(up.at)
                    if (foe != null) order(group, attack = foe) else order(group, to = cellAt(up.at, unit))
                } else if (b.a != null) {
                    val a = b.a!!; val c = b.b!!; val r = Rect(min(a.x, c.x), min(a.y, c.y), max(a.x, c.x), max(a.y, c.y))
                    select(mine.filter { canAct(it) && r.contains(g.toScreen(it.x, it.y)) })
                }
            }
            if (up != null || !g.pointers.containsKey(b.id)) box = null
        }
        if (!myTurn) return
        // taps: a finger lifted quickly without sliding
        for (up in g.ups) {
            if (up.role != "free" || (up.at - up.start).getDistance() >= 18 || g.time - up.t0 > 0.6 || uiTap(up.at)) continue
            val u = unitAt(up.at, "player")
            if (u != null) {
                val l = last; val dbl = l != null && l.first === u && g.time - l.second < 0.35
                last = u to g.time
                if (dbl) { select(mine.filter { canAct(it) }); last = null; break }
                if (!canAct(u)) { g.message("${u.name} is done this turn", 0.9); g.buzz(); break }
                if (strOf(cfgRaw["tapMode"], "adds to the group") == "picks just that one") select(if (sel.size == 1 && u in sel) emptyList() else listOf(u))
                else { val s2 = sel.toMutableList(); if (!s2.remove(u)) s2.add(u); select(s2) }
                break
            }
            if (sel.isEmpty()) break
            val foe = foeAt(up.at)
            if (foe != null) { order(sel.toList(), attack = foe); break }
            order(sel.toList(), to = cellAt(up.at, sel.first()))
            break
        }
    }
    /** Tiles a unit can walk to this turn (turn-based). */
    fun reach(e: GameObject): List<Pair<Double, Double>> {
        val u = unitOf(e)!!; val t = u.tile; val cells = mutableListOf<Pair<Double, Double>>(); val seen = hashMapOf(Cell2(0, 0) to 0); val q = mutableListOf(Cell2(0, 0))
        var head = 0
        while (head < q.size) {
            val c = q[head++]
            val d = seen[c]!!
            if (d >= u.movesLeft) continue
            for (dd in u.dirs) {
                val k = Cell2(c.i + dd.i, c.j + dd.j)
                if (seen.containsKey(k)) continue
                val x = u.cx + k.i * t; val y = u.cy + k.j * t; val bl = blockerAt(g, x, y, e)
                if (bl != null && unitOf(bl)?.team != u.team) continue
                seen[k] = d + 1; q.add(k)
                if (bl == null) cells.add(x to y)
            }
        }
        return cells
    }
    /** Highlights: reachable tiles, foes in range, paths, the selection, tap markers, shots, the selection box. */
    fun draw(ds: androidx.compose.ui.graphics.drawscope.DrawScope) = with(ds) {
        if (g.state != "play") return@with
        val tb = turnBased(g); val now = g.time; val color = parseColor(cfgRaw["color"]) ?: Color(0xFF4FC3F7); val moveC = parseColor(cfgRaw["moveColor"]) ?: color; val atkC = parseColor(cfgRaw["attackColor"]) ?: Color(0xFFFF5252)
        val z = g.zoom; val list = sel.toList()
        fun ring(e: GameObject, col: Color, k: Double = 1.0) {
            val t = unitOf(e)?.tile ?: 40.0; val at = g.toScreen(e.x, e.y)
            drawCircle(col, (max(10.0, t * 0.45 * z) * k).toFloat(), at, style = Stroke(3f))
        }
        if (cfgOn("showRange") && list.isNotEmpty() && tb && Turns.of(g).isPlayerTurn) {
            val done = mutableSetOf<String>()
            for (e in list) {
                val u = unitOf(e) ?: continue
                if (u.busy || u.attacked) continue
                for (cell in reach(e)) { if (!done.add("${cell.first},${cell.second}")) continue; val h = ((u.tile / 2 - 1) * z).toFloat(); val at = g.toScreen(cell.first, cell.second); drawRect(moveC.copy(alpha = 0.18f), Offset(at.x - h, at.y - h), Size(h * 2, h * 2)) }
            }
        }
        if (list.isNotEmpty()) {
            val pulse = 0.55 + 0.45 * abs(sin(now * 5))
            for (o in g.objects) { if (o.dead || o.ui || !gridFoe(o)) continue; if (list.any { val u = unitOf(it); u != null && !(tb && u.attacked) && u.inRange(o) }) ring(o, atkC.copy(alpha = pulse.toFloat()), 1.05) }
        }
        for (e in squadUnits(g, "player")) {
            val u = unitOf(e) ?: continue
            if (u.path.isEmpty() || !(cfgOn("showPaths") && (e in sel || !tb))) continue
            var x = u.cx; var y = u.cy
            val pts = mutableListOf(g.toScreen(e.x, e.y), g.toScreen(x, y))
            for (d in u.path) { x += d.i * u.tile; y += d.j * u.tile; pts.add(g.toScreen(x, y)) }
            val path = Path().apply { moveTo(pts[0].x, pts[0].y); for (pt in pts.drop(1)) lineTo(pt.x, pt.y) }
            drawPath(path, color.copy(alpha = 0.75f), style = Stroke(3f))
            drawCircle(color.copy(alpha = 0.9f), 5f, pts.last())
        }
        for (e in list) ring(e, color, 1 + 0.06 * sin(now * 6))
        fx.removeAll { now - it.t >= 0.6 }
        for (f in fx) {
            val k = (now - f.t) / 0.6
            when {
                f.k == "tap" -> drawCircle((if (f.ok) color else Color(0xFFFF5252)).copy(alpha = (1 - k).toFloat().coerceIn(0f, 1f)), (8 + k * 22).toFloat(), g.toScreen(f.x, f.y), style = Stroke(3f))
                f.k == "hit" && f.e != null && !f.e.dead -> ring(f.e, atkC.copy(alpha = (1 - k).toFloat().coerceIn(0f, 1f)), 1.4 - k * 0.4)
                f.k == "shot" && k < 0.3 -> {
                    val a = g.toScreen(f.x, f.y); val b2 = g.toScreen(f.x1, f.y1); val m = (k / 0.3).toFloat(); val at = a + (b2 - a) * m
                    drawLine(f.col, at - (b2 - a) * 0.12f, at, strokeWidth = if (f.look == "magic bolt") 5f else 3f)
                }
            }
        }
        val b = box
        if (b != null && !b.pan && b.b != null) {
            val a = b.a!!; val e2 = b.b!!
            if (b.unit != null) { drawLine(color, a, e2, strokeWidth = 3f); drawCircle(color, 12f, e2, style = Stroke(3f)) }
            else { val tl = Offset(min(a.x, e2.x), min(a.y, e2.y)); val sz = Size(abs(a.x - e2.x), abs(a.y - e2.y)); drawRect(color.copy(alpha = 0.15f), tl, sz); drawRect(color, tl, sz, style = Stroke(2f)) }
        }
    }
}

/** Squad Unit: a unit on a grid for tactics and strategy games. Selected units walk to tapped tiles in formation and attack tapped foes;
 *  turn-based: each moves and attacks once per turn; real-time: they fight what comes in range. Enemy units are played by the computer. */
class GridUnit(p: JsonMap) : Component(p), TurnTaker {
    val team = if (p["team"] == "enemy") "enemy" else "player"
    var cx = 0.0; var cy = 0.0; var hp = 1.0; var max = 1.0
    private var stepT = 0.0; private var cool = 0.0; private var wait = 0.0; private var think = 0.0
    var movesLeft = n("moves", 4.0).roundToInt()
    var attacked = false; var acted = false; private var autoT = false
    var path = mutableListOf<Cell2>()
    private var goal: Pair<Double, Double>? = null
    private var target: GameObject? = null; private var ent: GameObject? = null
    private var g0: PocketGame? = null
    val tile get() = n("tile", 40.0)
    private val rng get() = max(1, n("range", 1.0).roundToInt())
    val dirs = if (on("diagonal")) DIRS8 else DIRS4
    private fun isFoe(o: GameObject?): Boolean = o != null && !o.dead && o !== ent && (if (team == "player") gridFoe(o) else (unitOf(o)?.let { it.team == "player" } ?: o.has("player")))
    val busy: Boolean get() { val t = target; val g = g0; return path.isNotEmpty() || stepT > 0.02 || (t != null && !t.dead && !(g != null && turnBased(g) && attacked)) }
    val done: Boolean get() { if (attacked) return true; if (movesLeft > 0) return false; val g = g0 ?: return true; return g.objects.none { isFoe(it) && inRange(it) } }
    fun inRange(o: GameObject?): Boolean {
        if (o == null || o.dead) return false
        val c = cellOfObj(o); val dx = abs(round((c.first - cx) / tile).toInt()); val dy = abs(round((c.second - cy) / tile).toInt())
        if (dx + dy == 0) return false
        val diag = on("diagonal")
        return if (rng <= 1) (if (diag) max(dx, dy) <= 1 else dx + dy <= 1) else (if (diag) max(dx, dy) else dx + dy) <= rng
    }
    private fun myPhase(g: PocketGame) = !turnBased(g) || (if (team == "player") Turns.of(g).isPlayerTurn else !Turns.of(g).isPlayerTurn)
    private fun friendSkip(o: GameObject) = unitOf(o)?.team == team
    private fun plan(e: GameObject, g: PocketGame, strict: Boolean = false): Boolean {
        var route: MutableList<Cell2>? = null
        val t = target; val gl = goal
        if (t != null) {
            val c = cellOfObj(t)
            route = gridPath(g, e, c.first, c.second, tile, diagonal = on("diagonal"), maxCells = 1500, fromX = cx, fromY = cy, skip = if (strict) null else ::friendSkip, foeOk = true, isFoe = { it === t })
            if (!route.isNullOrEmpty()) route.removeAt(route.size - 1) // (stop next to it)
        } else if (gl != null) {
            route = gridPath(g, e, gl.first, gl.second, tile, diagonal = on("diagonal"), maxCells = 1500, fromX = cx, fromY = cy, skip = if (strict) null else ::friendSkip, foeOk = false)
        }
        if (route == null) { path = mutableListOf(); return false }
        if (turnBased(g)) route = route.take(max(0, movesLeft)).toMutableList()
        path = route
        return true
    }
    private fun attack(e: GameObject, g: PocketGame, o: GameObject) {
        val c = cellOfObj(o); val dx = sign(round((c.first - cx) / tile)).toInt(); val dy = sign(round((c.second - cy) / tile)).toInt()
        if (dx != 0) faceX(e, dx.toDouble())
        cool = max(0.2, n("attackEvery", 0.8)); attacked = true; acted = true
        val dmg = max(0.0, n("damage", 1.0)) + numOf(e.data["equipDamage"])
        val hit = { if (!o.dead) gridHurt(g, o, dmg, e) }
        val shot = s("shot", "arrow")
        if (rng > 1 && shot != "nothing") {
            Squad.of(g).fx.add(SquadFx("shot", g.time, e.x, e.y, x1 = o.x, y1 = o.y, look = shot, col = if (shot == "magic bolt") Color(0xFFB388FF) else Color(0xFFFFE082)))
            if (p["sound"] != false) g.sfx("click")
            g.after(0.17) { hit() }
        } else { gridNudge(g, e, dx, dy, tile); hit(); stepT = max(stepT, 0.17) }
    }
    /** Walk to a tile, or go after a foe; false if there's no way. */
    fun order(e: GameObject, to: Pair<Double, Double>? = null, attack: GameObject? = null): Boolean {
        val g = g0 ?: return false
        if (e.dead) return false
        if (turnBased(g) && attacked) return false
        wait = 0.0; autoT = false
        if (attack != null) {
            target = attack; goal = null
            if (inRange(attack)) { path = mutableListOf(); return true }
            if (!plan(e, g) || path.isEmpty()) { if (team == "player") g.message("Can't reach it", 0.8); target = null; return false }
            return true
        }
        target = null; goal = to
        if (to!!.first == cx && to.second == cy) { goal = null; path = mutableListOf(); return true }
        if (!plan(e, g) || path.isEmpty()) { goal = null; return false }
        return true
    }
    fun stop() { path = mutableListOf(); goal = null; target = null }
    fun newTurn(e: GameObject) { movesLeft = n("moves", 4.0).roundToInt(); attacked = false; acted = false; e.alpha = 1.0 }
    private fun bar(e: GameObject) = barOver(e, s("showBar", "always"), hp, max, if (team == "player") Color(0xFF4FC3F7) else Color(0xFFFF7043), if (team == "player") Color(0xFFFFD23D) else Color(0xFFFF4D4D))
    fun hurt(e: GameObject, g: PocketGame, dmg: Double, from: GameObject?): Double {
        e.part<Health>()?.let { return it.damage(e, g, dmg, from = from, knockback = 0.0) }
        hp -= dmg; e.invuln = 0.2; if (p["sound"] != false) g.sfx("hit"); bar(e)
        g.popOver(e, "-${dmg.roundToInt()}", Color(0xFFFF6B6B), 20.0)
        g.squash(e, 1.15)
        if (from != null && !from.dead && target == null && path.isEmpty() && isFoe(from) && p["fight"] != "only does what it’s told" && !turnBased(g)) { target = from; plan(e, g) } // (fight back)
        if (hp <= 0) {
            if (team == "enemy") g.addVar("score", n("points", 10.0))
            g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFFF5555), 16)
            g.send("unit defeated"); e.destroy()
        }
        return dmg
    }
    override fun start(e: GameObject, g: PocketGame) {
        ent = e; g0 = g; max = max(1.0, n("hp", 5.0)); hp = max
        if (p["snap"] != false) snapToGrid(g, e, tile)
        cx = e.x; cy = e.y
        e.tags.add(if (team == "enemy") "enemy" else "ally"); e.tags.add("unit")
        if (e.part<Health>() == null) bar(e)
        Squad.of(g)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        Turns.of(g).tick(g, dt)
        Squad.of(g).tick()
        stepT -= dt; cool -= dt
        if (g.state != "play" || e.dead) return
        val tb = turnBased(g)
        if (tb && team == "player" && Turns.of(g).isPlayerTurn) e.alpha += ((if (done && !busy) 0.5 else 1.0) - e.alpha) * min(1.0, dt * 8) // (finished units fade a little)
        if (!myPhase(g)) return
        if (!tb) { // thinking on its own (real-time)
            think -= dt
            if (think <= 0) {
                think = 0.35 + Random.nextDouble() * 0.2
                val chase = team == "enemy" || p["fight"] == "chases foes it sees"
                val t0 = target
                if ((t0 == null && goal == null && path.isEmpty() && p["fight"] != "only does what it’s told") || (team == "enemy" && goal == null)) {
                    val sight = n("sight", 6.0); val f = gridTargetFor(g, e, if (team == "enemy") "enemy" else "player", if (sight > 0) (sight + 0.5) * tile else Double.POSITIVE_INFINITY)
                    if (f != null && (chase || inRange(f)) && f !== target) { target = f; autoT = !chase; plan(e, g) }
                } else if (t0 != null && !t0.dead && !inRange(t0) && team == "enemy") plan(e, g)
            }
        }
        if (stepT > 0) return
        val k = min(1.0, dt * 14)
        e.x += (cx - e.x) * k; e.y += (cy - e.y) * k // (settle on its tile)
        val t = target
        if (t != null) {
            if (t.dead) { target = null; path = mutableListOf() }
            else if (inRange(t)) {
                path = mutableListOf()
                if (tb) { if (!attacked) attack(e, g, t); target = null } else if (cool <= 0) attack(e, g, t)
                return
            } else if (autoT) { target = null; autoT = false; path = mutableListOf() }
            else if (path.isEmpty()) { if (tb && movesLeft <= 0) { target = null; return }; if (!plan(e, g) || path.isEmpty()) { target = null; return } }
        }
        if (path.isEmpty()) { if (goal != null) goal = null; return }
        val d = path.first()
        val nx = cx + d.i * tile; val ny = cy + d.j * tile
        val b = blockerAt(g, nx, ny, e)
        if (b != null) {
            if (b === target) { path = mutableListOf(); return }
            if (unitOf(b)?.team == team) { wait += dt; if (wait < 0.45) return } // (a friend is in the way: wait a moment)
            wait = 0.0
            if (!plan(e, g, true) || path.isEmpty()) { path = mutableListOf(); goal = null }
            return
        }
        wait = 0.0; path.removeAt(0); cx = nx; cy = ny; movesLeft--; acted = true
        if (d.i != 0) faceX(e, d.i.toDouble())
        val st = max(0.03, n("stepTime", 0.16))
        g.tween(e, "x", nx, st * 0.92); g.tween(e, "y", ny, st * 0.92); stepT = st
        if (path.isEmpty() && target == null && goal != null) goal = null
    }
    /** Enemy units take their turn one after another. */
    override fun onTurn(e: GameObject, g: PocketGame) {
        if (team != "enemy") return
        movesLeft = n("moves", 4.0).roundToInt(); attacked = false
        val list = squadUnits(g, "enemy"); val i = list.indexOf(e); val st = max(0.03, n("stepTime", 0.16))
        Turns.of(g).holdTurn(i * 0.3 + (movesLeft + 1) * st + 0.45)
        g.after(i * 0.3) {
            if (e.dead || g.state != "play") return@after
            val sight = n("sight", 6.0)
            val f = gridTargetFor(g, e, "enemy", if (sight > 0) (sight + 0.5) * tile else Double.POSITIVE_INFINITY) ?: return@after
            target = f
            if (!inRange(f)) plan(e, g)
        }
    }
    override fun gone(e: GameObject, g: PocketGame) { (g.systems["squad"] as? Squad)?.sel?.remove(e) }
}

/** Unit Commander: how the player commands Squad Units (tapping, box select or camera drag, formation, highlights, ending turns, win / lose). */
class SquadControl(p: JsonMap) : Component(p) {
    override fun start(e: GameObject, g: PocketGame) { Squad.of(g).cfgRaw = p }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { Turns.of(g).tick(g, dt); Squad.of(g).tick() }
}

// ---- boards and turn-based battles ----

/** Board Cell: a square of a tic-tac-toe style board: tap to place X; against the computer (it plays O on its turn) or two players. */
class BoardCell(p: JsonMap) : Component(p), TurnTaker {
    companion object {
        fun cells(g: PocketGame) = g.objects.filter { !it.dead && it.part<BoardCell>() != null }
        fun at(g: PocketGame, r: Int, c: Int) = cells(g).firstOrNull { it.data["row"] == r && it.data["col"] == c }
        fun wins(g: PocketGame, cell: GameObject, mark: String): Boolean {
            val r0 = cell.data["row"] as Int; val c0 = cell.data["col"] as Int; val line = cell.data["line"] as Int
            for ((dr, dc) in listOf(0 to 1, 1 to 0, 1 to 1, 1 to -1)) {
                var n = 1
                for (sg in listOf(1, -1)) { var k = 1; while (true) { val o = at(g, r0 + dr * k * sg, c0 + dc * k * sg); if (o != null && o.data["mark"] == mark) { n++; k++ } else break } }
                if (n >= line) return true
            }
            return false
        }
        fun place(g: PocketGame, cell: GameObject, mark: String): Boolean {
            cell.data["mark"] = mark
            val size = min(numOf(cell.shape?.get("w"), 80.0), numOf(cell.shape?.get("h"), 80.0))
            cell.text = mutableMapOf("value" to mark, "size" to size * 0.62, "weight" to "900", "color" to if (mark == "X") "#4fc3f7" else "#ff7043")
            g.sfx(if (mark == "X") "click" else "coin"); g.buzz()
            g.squash(cell, 0.85)
            val col = if (mark == "X") Color(0xFF4FC3F7) else Color(0xFFFF7043)
            if (wins(g, cell, mark)) {
                g.burst(cell.x, cell.y, col, 30)
                if (cell.data["vs"] == true) { if (mark == "X") g.win() else { g.message("The computer wins!", 2.0); g.gameOver() } }
                else { g.message("$mark wins!", 2.5); g.addVar("score", 1.0); g.win() }
                return true
            }
            if (cells(g).all { strOf(it.data["mark"]).isNotEmpty() }) { g.message("It's a draw!", 1.4); g.after(1.5) { g.start() }; return true }
            return false
        }
    }
    override fun start(e: GameObject, g: PocketGame) {
        e.data["row"] = n("row").toInt(); e.data["col"] = n("col").toInt(); e.data["line"] = n("line", 3.0).toInt(); e.data["vs"] = p["vsComputer"] != false; e.data["mark"] = ""
        g.vars["turnText"] = if (p["vsComputer"] != false) "Your turn (X)" else "X to play"
        Turns.of(g)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val t = Turns.of(g)
        t.tick(g, dt)
        if (g.state != "play" || strOf(e.data["mark"]).isNotEmpty() || !t.isPlayerTurn) return
        if (e.ui) g.tapTargets.add(e)
        if (g.tapsOn(e).isEmpty()) return
        val vs = p["vsComputer"] != false; val mark = if (vs) "X" else strOf(g.vars["nextMark"], "X")
        if (place(g, e, mark)) return
        if (vs) { g.settings["enemyTurnText"] = "Computer is thinking…"; g.settings["playerTurnText"] = "Your turn (X)"; g.settings["turnDelay"] = 0.5; t.endTurn(g) }
        else { val next = if (mark == "X") "O" else "X"; g.vars["nextMark"] = next; g.setVar("turnText", "$next to play") }
    }
    override fun onTurn(e: GameObject, g: PocketGame) {
        val all = cells(g)
        if (all.isEmpty() || all.first() !== e || e.data["vs"] != true) return // (one cell plays for the computer)
        val empty = all.filter { strOf(it.data["mark"]).isEmpty() }
        if (empty.isEmpty()) return
        fun tryMark(mark: String) = empty.firstOrNull { c -> c.data["mark"] = mark; val w = wins(g, c, mark); c.data["mark"] = ""; w }
        val mid = floor(sqrt(all.size.toDouble()) / 2).toInt()
        val pick = tryMark("O") ?: tryMark("X") ?: empty.firstOrNull { it.data["row"] == mid && it.data["col"] == mid } ?: empty[Random.nextInt(empty.size)]
        place(g, pick, "O")
    }
}

/** Turn Button: on your turn, tap to change a variable by an amount (a range: an attack, a heal), maybe costing another (mana); then it's the enemy's turn. */
class TurnAction(p: JsonMap) : Component(p) {
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val t = Turns.of(g)
        t.tick(g, dt)
        val cv = s("costVar"); val cost = n("cost")
        val ready = g.state == "play" && t.isPlayerTurn && (cv.isEmpty() || g.numVar(cv) >= cost)
        e.alpha += ((if (ready) 1.0 else 0.45) - e.alpha) * min(1.0, dt * 10)
        if (e.ui) g.tapTargets.add(e)
        if (g.state != "play" || !t.isPlayerTurn || g.tapsOn(e).isEmpty()) return
        if (cv.isNotEmpty() && g.numVar(cv) < cost) { g.message("Not enough $cv", 1.2); g.buzz(true); return }
        if (cv.isNotEmpty()) g.addVar(cv, -cost)
        val amount = pick(p["amount"] ?: listOf(-14.0, -8.0)).roundToInt(); val key = s("var", "enemyHp")
        var v = g.numVar(key) + amount
        if (amount < 0) v = max(0.0, v)
        if (n("max") > 0) v = min(n("max"), v)
        g.setVar(key, v)
        g.message(s("text", "You hit for {n}!").replace("{n}", "${abs(amount)}"), max(0.8, numOf(g.settings["turnDelay"], 0.3) + 0.4))
        g.sfx(s("sound", "hit")); g.buzz()
        g.squash(e, 0.92)
        t.endTurn(g)
    }
}

/** Enemy Turn: on the enemy's turn, changes a variable by an amount (the enemy hits you for 6–12). */
class TurnOpponent(p: JsonMap) : Component(p), TurnTaker {
    override fun start(e: GameObject, g: PocketGame) { Turns.of(g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) = Turns.of(g).tick(g, dt)
    override fun onTurn(e: GameObject, g: PocketGame) {
        val amount = pick(p["amount"] ?: listOf(-12.0, -6.0)).roundToInt(); val k = s("var", "hp")
        g.setVar(k, max(0.0, g.numVar(k) + amount))
        g.message(s("text", "The enemy hits you for {n}!").replace("{n}", "${abs(amount)}"), 1.4)
        g.sfx("hit"); g.buzz(true); g.shake = 8.0
        g.squash(e, 1.15)
    }
}


// makeComponent: "inventoryItem" -> InventoryItem(p), "craftingStation" -> CraftingStation(p), "loot" -> Loot(p), "resource" -> ResourceNode(p), "npc" -> Npc(p), "dialogue" -> DialoguePart(p), "uiHotbar" -> InventorySlots(p, true), "uiInventoryGrid" -> InventorySlots(p, false), "uiEquipment" -> EquipmentHud(p), "uiCrafting" -> CraftingHud(p), "uiQuestLog" -> QuestLogHud(p), "uiQuestJournal" -> QuestJournalHud(p), "uiQuestTracker" -> QuestTrackerHud(p),
// imports: androidx.compose.foundation.border, androidx.compose.ui.draw.clipToBounds, androidx.compose.ui.draw.alpha, androidx.compose.ui.text.style.TextOverflow, androidx.compose.ui.text.style.TextDecoration, androidx.compose.ui.unit.IntOffset, androidx.compose.ui.unit.Density, androidx.compose.ui.draw.scale
// needs in PocketGame.kt: class Need → `var v`, `var max`, `fun sync(...)`, `fun check(...)` not private (items feed hunger and thirst).

// ---------------------------------------------------------------------------------------------------------------
// Items, crafting, quests and dialogue (Game Settings › Items, Recipes, Quests, Dialogues)
// ---------------------------------------------------------------------------------------------------------------

/** Item types and rarity colours (the same as Pocket Engine). */
val itemTypeLabels = mapOf("material" to "Material", "food" to "Food", "drink" to "Drink", "potion" to "Potion", "weapon" to "Weapon", "armor" to "Armour", "tool" to "Tool", "ammo" to "Ammo", "key" to "Key", "quest" to "Quest item", "misc" to "Other")
val rarityColors = mapOf("common" to Color(0xFFB0BEC5), "uncommon" to Color(0xFF66BB6A), "rare" to Color(0xFF42A5F5), "epic" to Color(0xFFAB47BC), "legendary" to Color(0xFFFFA726))
val equipSlots = listOf("hand", "offhand", "head", "body", "legs", "feet", "neck", "ring")
private val consumableTypes = setOf("food", "drink", "potion", "misc")
private val defaultSlot = mapOf("weapon" to "hand", "armor" to "body", "tool" to "hand")
private val IC = RegexOption.IGNORE_CASE
fun rarityOf(d: JsonMap): Color? = rarityColors[d["rarity"]?.toString()]

/** The equipment slot an item goes in ("" if it isn't worn or held). */
fun equipSlotOf(d: JsonMap): String = if (d["slot"] == "none") "" else strOf(d["slot"], defaultSlot[strOf(d["type"], "misc")] ?: "")

data class Ingredient(val name: String, val n: Int, val keep: Boolean)
data class LootRoll(val name: String, val min: Int, val max: Int, val chance: Double)
data class QReward(val kind: String, val name: String, val amount: Double)

/** "Wood 3, Stone x2, 2 Rope, Hammer (keep)" → name, how many, kept? */
fun parseIngredients(t: Any?): List<Ingredient> {
    if (t is List<*>) return t.mapNotNull { q -> q.asMap()?.let { Ingredient(strOf(it["name"]), numOf(it["n"], 1.0).toInt(), it["keep"] == true) } }
    val out = mutableListOf<Ingredient>()
    for (q0 in (t?.toString() ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }) {
        val keep = Regex("\\((keep|tool|not used up)\\)\\s*$", IC).containsMatchIn(q0)
        val q = q0.replace(Regex("\\s*\\((keep|tool|not used up)\\)\\s*$", IC), "")
        Regex("^(\\d+)\\s*[x×]?\\s+(.+)$").find(q)?.let { out.add(Ingredient(it.groupValues[2].trim(), it.groupValues[1].toInt(), keep)); null } ?: run {
            val m = Regex("^(.+?)\\s*[x×]?\\s*(\\d+)$").find(q)
            if (m != null) out.add(Ingredient(m.groupValues[1].trim(), m.groupValues[2].toInt(), keep)) else out.add(Ingredient(q, 1, keep))
        }
    }
    return out
}

/** "Coin 3-6, Apple 1 50%, Gem 5%" → name, min, max, chance. */
fun parseLoot(t: Any?): List<LootRoll> {
    val out = mutableListOf<LootRoll>()
    for (q0 in (t?.toString() ?: "").split(Regex("[,\\n]")).map { it.trim() }.filter { it.isNotEmpty() }) {
        var q = q0; var chance = 100.0; var mn = 1; var mx = 1
        Regex("\\s*@?\\s*(\\d+(?:\\.\\d+)?)\\s*%$").find(q)?.let { chance = it.groupValues[1].toDouble(); q = q.substring(0, it.range.first).trim() }
        Regex("\\s*[x×]?\\s*(\\d+)(?:\\s*-\\s*(\\d+))?$").find(q)?.let { mn = it.groupValues[1].toInt(); mx = it.groups[2]?.value?.toInt() ?: mn; q = q.substring(0, it.range.first).trim() }
        if (q.isNotEmpty()) out.add(LootRoll(q, mn, max(mn, mx), chance))
    }
    return out
}

/** One quest objective: collect Wood 5 (take) · kill slime 3 · talk Guard · reach Castle [60] · craft Axe · use Apple · gather Wood · var coins >= 100 · message x · quest Other · anything else. */
class Objective(val type: String, val target: String, val n: Int, val dist: Double = 0.0, val op: String = "", val value: String = "", val take: Boolean = false, var label: String = "")
data class ObjProgress(val o: Objective, val have: Int, val done: Boolean, val waiting: Boolean)

fun parseObjectives(text: Any?): List<Objective> {
    val out = mutableListOf<Objective>()
    for (raw in (text?.toString() ?: "").split("\n").map { it.trim() }.filter { it.isNotEmpty() && !it.startsWith("//") }) {
        val parts = raw.split("|").map { it.trim() }
        var body = parts[0]
        val label = parts.getOrElse(1) { "" }
        var take = false
        if (Regex("\\(take\\)\\s*$", IC).containsMatchIn(body)) { take = true; body = body.replace(Regex("\\s*\\(take\\)\\s*$", IC), "") }
        val sp = body.indexOf(' ')
        val type = (if (sp < 0) body else body.substring(0, sp)).lowercase()
        val rest = if (sp < 0) "" else body.substring(sp + 1).trim()
        fun nameN(s: String): Pair<String, Int> { val k = Regex("^(.+?)(?:\\s+(\\d+))?$").find(s) ?: return s to 1; return k.groupValues[1].trim() to max(1, k.groups[2]?.value?.toIntOrNull() ?: 1) }
        val varRe = Regex("^(\\S+)\\s*(>=|<=|==|!=|=|>|<|≥|≤)\\s*(.+)$")
        val o: Objective = when {
            type in listOf("collect", "kill", "defeat", "craft", "use", "gather", "message") -> { val (t, n) = nameN(rest); Objective(if (type == "defeat") "kill" else type, t, n, take = take) }
            type == "talk" || type == "reach" || type == "goto" -> { val k = Regex("^(.+?)(?:\\s+(\\d+(?:\\.\\d+)?))?$").find(rest); Objective(if (type == "goto") "reach" else type, k?.groupValues?.get(1)?.trim() ?: rest, 1, dist = k?.groups?.get(2)?.value?.toDouble() ?: 0.0, take = take) }
            type == "var" && varRe.containsMatchIn(rest) -> { val m = varRe.find(rest)!!; Objective("var", m.groupValues[1], 1, op = m.groupValues[2], value = m.groupValues[3].trim(), take = take) }
            type == "quest" -> Objective("quest", rest, 1, take = take)
            else -> { val m = Regex("\\s(\\d+)$").find(body); Objective("custom", body, m?.groupValues?.get(1)?.toInt() ?: 1, take = take) }
        }
        val nn = if (o.n > 1) "${o.n} " else ""
        o.label = label.ifEmpty {
            when (o.type) {
                "collect" -> "Collect ${o.n} ${o.target}"; "kill" -> "Defeat $nn${o.target}"; "talk" -> "Talk to ${o.target}"; "reach" -> "Go to ${o.target}"; "craft" -> "Craft $nn${o.target}"
                "use" -> "Use $nn${o.target}"; "gather" -> "Gather ${o.n} ${o.target}"; "var" -> "${o.target} ${o.op} ${o.value}"; "message" -> o.target; "quest" -> "Finish “${o.target}”"; else -> o.target
            }
        }
        out.add(o)
    }
    return out
}

/** "coins 50, xp 20, item Iron Sword 1, recipe Axe, message party, quest Next" → rewards (kind, name, amount). */
fun parseRewards(text: Any?): List<QReward> {
    val out = mutableListOf<QReward>()
    for (q in (text?.toString() ?: "").split(Regex("[,\\n]")).map { it.trim() }.filter { it.isNotEmpty() }) {
        Regex("^item\\s+(.+?)(?:\\s+(\\d+))?$", IC).find(q)?.let { out.add(QReward("item", it.groupValues[1], it.groups[2]?.value?.toDoubleOrNull() ?: 1.0)); return@let true }
            ?: Regex("^recipe\\s+(.+)$", IC).find(q)?.let { out.add(QReward("recipe", it.groupValues[1], 1.0)); true }
            ?: Regex("^(?:message|send)\\s+(.+)$", IC).find(q)?.let { out.add(QReward("message", it.groupValues[1], 1.0)); true }
            ?: Regex("^quest\\s+(.+)$", IC).find(q)?.let { out.add(QReward("quest", it.groupValues[1], 1.0)); true }
            ?: Regex("^(\\S+)\\s+(-?[\\d.]+)$").find(q)?.takeIf { it.groupValues[2].toDoubleOrNull() != null }?.let { out.add(QReward("var", it.groupValues[1], it.groupValues[2].toDouble())); true }
            ?: Regex("^(.+?)\\s+(\\d+)$").find(q)?.let { out.add(QReward("item", it.groupValues[1], it.groupValues[2].toDouble())); true }
            ?: out.add(QReward("item", q, 1.0))
    }
    return out
}

data class ItemStack(val name: String, val icon: String, val n: Int, val def: JsonMap)
data class Crafting(val result: String, val amount: Int, val started: Double, val seconds: Double)

/** The game's item, crafting, quest and dialogue systems (made the first time a component needs them). */
class ItemSystems(val g: PocketGame) {
    companion object { fun of(g: PocketGame): ItemSystems = g.systems.getOrPut("items") { ItemSystems(g) } as ItemSystems }

    // ---- inventory ----
    val db = mutableMapOf<String, JsonMap>()
    val inv = mutableMapOf<String, Int>()
    val icons = mutableMapOf<String, String>()
    val order = mutableListOf<String>()
    val equipped = mutableMapOf<String, String>()
    val known = mutableSetOf<String>()
    val stations = mutableMapOf<String, Double>()
    var recipes: List<JsonMap> = emptyList()
    var crafting: Crafting? = null
    private var fullMsg = -9.0
    /** The screen's density (the dialogue box is laid out in dp), set by the panel. */
    var dens = 1f

    // ---- quests / dialogue state ----
    var questDefs: List<JsonMap> = emptyList()
    val quests = mutableMapOf<String, MutableMap<String, Any?>>() // lower-case name → state, prog, snap
    var dialogues: List<JsonMap> = emptyList()
    val talked = mutableMapOf<String, Int>()
    var dialog: DialogueState? = null

    init {
        for (d in (g.gameData["items"] as? List<*>).orEmpty()) {
            val m = d.asMap() ?: continue
            val n = strOf(m["name"]).trim()
            if (n.isNotEmpty()) db[n.lowercase()] = m.toMutableMap().also { it["name"] = n }
        }
        recipes = (g.gameData["recipes"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.filter { strOf(it["result"]).isNotEmpty() }
        questDefs = (g.gameData["quests"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.filter { strOf(it["name"]).isNotEmpty() }
        dialogues = (g.gameData["dialogues"] as? List<*>).orEmpty().mapNotNull { it.asMap() }.filter { strOf(it["name"]).isNotEmpty() }
        g.on { m -> questEvent("message", m, 1) }
        registerLogicHooks()
        // a hidden helper object that runs every frame (first, and on paused screens too): dialogue taps, quest checks, deaths
        val t = GameObject(mapOf("name" to "__systems"), g)
        t.parts.add(SystemsTicker(this).also { it.type = "__systems" })
        g.objects.add(0, t)
        sync()
    }

    /** The Items entry for a name (any case), or a plain one. */
    fun def(name: String): JsonMap = db[name.trim().lowercase()] ?: mapOf("name" to name, "icon" to (icons[name] ?: ""), "type" to "misc", "plain" to true)
    fun nameOf(n: String) = strOf(def(n)["name"], n)
    fun iconOf(n: String) = strOf(icons[nameOf(n)], strOf(def(n)["icon"]))
    fun stackOf(n: String) = max(1, numOf(def(n)["stack"], numOf(g.settings["invStack"], 99.0)).roundToInt())
    fun count(name: String) = inv[name] ?: inv[nameOf(name)] ?: 0
    val slotsUsed: Int get() { var n = 0; inv.forEach { (k, v) -> n += ceil(v.toDouble() / stackOf(k)).toInt() }; return n }
    val slotCount: Int get() = max(0, numOf(g.settings["invSlots"]).roundToInt())
    val slotsFree: Double get() = if (slotCount == 0) Double.POSITIVE_INFINITY else max(0, slotCount - slotsUsed).toDouble()
    fun room(name: String): Double {
        if (slotCount == 0) return Double.POSITIVE_INFINITY
        val st = stackOf(name); val have = count(name); val part = if (have % st != 0) st - have % st else 0
        return part + slotsFree * st
    }
    /** Add (or with a negative n, take) items; respects inventory slots and stack sizes. Returns how many changed. */
    fun add(name0: String, n0: Int, icon: String = "", force: Boolean = false): Int {
        if (name0.isEmpty() || n0 == 0) return 0
        val name = nameOf(name0); var n = n0
        if (n > 0 && !force) {
            val r = room(name)
            if (r < n) { if (g.time - fullMsg > 1.5) { fullMsg = g.time; g.message("Inventory full", 1.2) }; if (r <= 0) return 0; n = r.toInt() }
        }
        val before = inv[name] ?: 0; val after = max(0, before + n)
        if (icon.isNotEmpty()) icons[name] = icon
        if (after > 0) { inv[name] = after; if (name !in order) order.add(name) } else { inv.remove(name); order.remove(name) }
        g.setVar("item_$name", after.toDouble())
        sync()
        questCheckAll()
        return after - before
    }
    /** Items as stacks in inventory order (what grids and hotbars show). */
    fun stacks(filter: String = "all"): List<ItemStack> {
        val out = mutableListOf<ItemStack>()
        for (name in order) {
            val v = inv[name] ?: continue
            val d = def(name)
            if (filter != "all" && filter.isNotEmpty() && strOf(d["type"], "misc") != filter) continue
            val st = stackOf(name); var left = v
            val ic = iconOf(name).ifEmpty { name.take(2) }
            while (left > 0) { val k = min(st, left); out.add(ItemStack(name, ic, k, d)); left -= k }
        }
        return out
    }
    fun sync() {
        val s = order.filter { inv[it] != null }.joinToString("  ") { "${iconOf(it).ifEmpty { it }}×${inv[it]}" }
        g.setVar("inventory", s.ifEmpty { "—" })
        g.setVar("slotsFree", if (slotsFree.isFinite()) slotsFree else 999.0)
    }
    fun player(): GameObject? = g.objects.firstOrNull { !it.dead && it.has("player") }

    /** Use an item: eat / drink / heal / cure from its Items entry, or equip it (weapons, armour, tools). */
    fun use(name0: String, user0: GameObject? = null, consume: Boolean? = null): Boolean {
        if (count(name0) <= 0) return false
        val d = def(name0); val name = nameOf(name0)
        val user = user0 ?: player()
        if (equipSlotOf(d).isNotEmpty()) return equip(name, user)
        val hb = user?.part<Health>()
        if (user != null) {
            if (numOf(d["heal"]) > 0 && hb != null) hb.heal(user, g, numOf(d["heal"]))
            for (c in user.parts) {
                if (c is Need && ((c.key == "hunger" && numOf(d["food"]) > 0) || (c.key == "thirst" && numOf(d["drink"]) > 0))) {
                    c.v = min(c.max, c.v + numOf(if (c.key == "hunger") d["food"] else d["drink"])); c.check(user, g); c.sync(user, g)
                }
            }
            if (hb != null) {
                if (numOf(d["shield"]) > 0) { hb.shield += numOf(d["shield"]); hb.shieldMax = max(hb.shieldMax, hb.shield) }
                val cure = strOf(d["cure"], "nothing")
                if (cure != "nothing") { if (cure == "everything") hb.effects.clear() else hb.effects.remove(cure) }
                val fx = strOf(d["effect"], "nothing")
                if (fx != "nothing") hb.effects[fx] = numOf(d["effectPower"], 1.0) to numOf(d["effectTime"], 5.0)
            }
        }
        if (strOf(d["message"]).isNotEmpty()) g.send(strOf(d["message"]))
        g.send("use $name"); g.send("use item")
        val used = consume ?: if (d["plain"] == true) true else (d["consume"] as? Boolean ?: (strOf(d["type"], "misc") in consumableTypes))
        if (used) add(name, -1)
        if (user != null && (numOf(d["heal"]) > 0 || numOf(d["food"]) > 0 || numOf(d["drink"]) > 0)) g.popOver(user, "${strOf(d["icon"])} $name".trim(), rarityOf(d) ?: Color.White, 18.0)
        questEvent("use", name, 1)
        return true
    }
    /** Put an item into its equipment slot (what was there goes back into the inventory). */
    fun equip(name0: String, user: GameObject? = null): Boolean {
        val d = def(name0); val name = nameOf(name0)
        val slot = equipSlotOf(d).ifEmpty { "hand" }
        if (count(name) <= 0) return false
        if (equipped[slot] != null) unequip(slot, user, true)
        add(name, -1); equipped[slot] = name; g.setVar("equip_$slot", name)
        applyEquip(user); g.sfx("click")
        return true
    }
    fun unequip(slot: String, user: GameObject? = null, swapping: Boolean = false): Boolean {
        val name = equipped[slot] ?: return false
        if (!swapping && room(name) < 1) { g.message("Inventory full", 1.2); return false }
        equipped.remove(slot); add(name, 1, force = true); g.setVar("equip_$slot", "")
        applyEquip(user)
        return true
    }
    /** Total of a stat (damage, armor, speed ×) over everything worn. */
    fun equipStat(k: String): Double {
        val list = equipped.values.map { numOf(def(it)[k]) }
        return if (k == "speed") list.fold(1.0) { m, v -> m * (if (v == 0.0) 1.0 else v) } else list.sum()
    }
    fun applyEquip(user0: GameObject? = null) {
        val user = user0 ?: player() ?: return
        user.data["equipDamage"] = equipStat("damage"); user.data["equipArmor"] = equipStat("armor"); user.data["equipSpeed"] = equipStat("speed")
        g.setVar("equipDamage", equipStat("damage")); g.setVar("equipArmor", equipStat("armor"))
    }

    // ---- crafting ----
    @Suppress("UNCHECKED_CAST")
    fun recipeFor(item: Any?): JsonMap? {
        if (item is Map<*, *>) return item as JsonMap
        val k = (item?.toString() ?: "").trim().lowercase()
        return recipes.firstOrNull { it["id"] == item || strOf(it["result"]).lowercase() == k }
    }
    fun knows(r: Any?): Boolean { val q = recipeFor(r) ?: return false; return q["locked"] != true || strOf(q["result"]).lowercase() in known }
    fun learn(item: String): Boolean { val r = recipeFor(item) ?: return false; return known.add(strOf(r["result"]).lowercase()) }
    fun nearStation(name: String): Boolean { if (name.isEmpty()) return true; val t = stations[name.lowercase()] ?: return false; return g.time - t < 0.25 }
    fun craftMissing(item: Any?, times: Int = 1): List<String> {
        val r = recipeFor(item) ?: return listOf("no recipe")
        val miss = mutableListOf<String>()
        if (!knows(r)) miss.add("not learned")
        if (strOf(r["station"]).isNotEmpty() && !nearStation(strOf(r["station"]))) miss.add("needs ${r["station"]}")
        for ((name, n, _) in parseIngredients(r["ingredients"])) { val have = count(name); if (have < n * times) miss.add("${n * times - have} $name") }
        if (crafting != null) miss.add("busy")
        return miss
    }
    fun canCraft(r: Any?, times: Int = 1) = craftMissing(r, times).isEmpty()
    /** Craft a recipe: takes the ingredients and gives the result (after its time, if it has one). */
    fun craft(item: Any?, times: Int = 1): Boolean {
        val r = recipeFor(item)
        if (r == null || !canCraft(r, times)) return false
        for ((name, n, keep) in parseIngredients(r["ingredients"])) if (!keep) add(name, -n * times)
        val amount = max(1, numOf(r["amount"], 1.0).roundToInt()) * times; val result = strOf(r["result"])
        fun done() {
            crafting = null
            val got = add(result, amount)
            if (got < amount) dropNear(result, amount - got)
            g.sfx("power")
            questEvent("craft", result, amount)
            player()?.let { g.popOver(it, "+$amount ${iconOf(result).ifEmpty { result }}", Color(0xFFFFD23D), 20.0) }
        }
        val t = numOf(r["time"]) * times
        if (t > 0) { crafting = Crafting(result, amount, g.time, t); g.after(t) { done() } } else done()
        return true
    }
    /** Drop items on the ground near someone as pick-ups. */
    fun dropNear(name0: String, n: Int, at0: GameObject? = null): GameObject? {
        if (n <= 0) return null
        val d = def(name0); val name = nameOf(name0)
        val at = at0 ?: player()
        val ic = strOf(d["icon"])
        val look: JsonMap = if (ic.isNotEmpty() && !ic.startsWith("art:")) mapOf("type" to "emoji", "emoji" to ic, "w" to 28.0, "h" to 28.0) else mapOf("type" to "circle", "r" to 12.0, "fill" to "#ffd23d")
        val o = GameObject(mapOf("name" to name, "shape" to look, "behaviors" to listOf(mapOf("type" to "inventoryItem", "item" to name, "icon" to ic, "amount" to n.toDouble(), "delay" to 0.8))), g,
            (at?.x ?: 0.0) + rand(-40.0, 40.0), (at?.y ?: 0.0) + rand(-30.0, 10.0))
        g.objects.add(o)
        o.parts.forEach { it.start(o, g) }
        return o
    }
    /** Roll a loot list and hand it out (into the inventory or onto the ground); what came up, as text. */
    fun giveLoot(e: GameObject, list: Any?, into: Boolean): List<String> {
        val got = mutableListOf<String>()
        for ((name, mn, mx, chance) in parseLoot(list)) {
            if (Random.nextDouble() * 100 >= chance) continue
            val n = mn + Random.nextInt(mx - mn + 1)
            if (n <= 0) continue
            if (into) { val k = add(name, n); if (k < n) dropNear(name, n - k, e) }
            else { val step = max(1, ceil(n / 3.0).toInt()); var i = 0; while (i < n) { dropNear(name, min(step, n - i), e); i += step } }
            got.add("${iconOf(name)}$name${if (n > 1) " ×$n" else ""}")
        }
        return got
    }

    // ---- quests ----
    fun questDef(name: String): JsonMap? { val k = name.trim().lowercase(); return questDefs.firstOrNull { strOf(it["name"]).trim().lowercase() == k } }
    fun questRec(name: String): MutableMap<String, Any?>? { val d = questDef(name) ?: return null; return quests[strOf(d["name"]).lowercase()] }
    @Suppress("UNCHECKED_CAST")
    private fun progOf(r: Map<String, Any?>) = r["prog"] as MutableList<Int>
    /** locked · available · active · ready · done · failed · unknown */
    fun questState(name: String): String {
        val d = questDef(name) ?: return "unknown"
        questRec(name)?.let { return it["state"].toString() }
        return if (tagList(d["requires"]).all { questState(it) == "done" }) "available" else "locked"
    }
    /** Objectives with how far along each is. */
    fun questObjectives(name: String): List<ObjProgress> {
        val d = questDef(name) ?: return emptyList()
        val r = questRec(name); val objs = parseObjectives(d["objectives"]); val out = mutableListOf<ObjProgress>()
        var blocked = false
        for ((i, o) in objs.withIndex()) {
            val prog = if (r == null) emptyList() else progOf(r)
            var have = if (r != null && i < prog.size) prog[i] else 0
            when {
                r != null && r["state"] != "active" -> have = o.n
                o.type == "collect" -> have = min(o.n, count(o.target))
                o.type == "var" -> have = if (storyCond("${o.target} ${o.op} ${o.value}", StoryEnv(this))) 1 else 0
                o.type == "quest" -> have = if (questState(o.target) == "done") 1 else 0
            }
            val done = have >= o.n && !blocked
            out.add(ObjProgress(o, min(have, o.n), done, blocked))
            if (d["order"] == "in order" && !done) blocked = true
        }
        return out
    }
    /** Something happened that objectives may count (kill / talk / message / craft / gather / use). */
    fun questEvent(kind: String, key: Any?, n: Int) {
        fun match(o: Objective): Boolean = if (key is GameObject) key.name.lowercase() == o.target.lowercase() || key.has(o.target) else (key?.toString() ?: "").trim().lowercase() == o.target.lowercase()
        for (d in questDefs) {
            val name = strOf(d["name"]); val r = questRec(name)
            if (r == null || r["state"] != "active") continue
            val objs = questObjectives(name); val prog = progOf(r)
            var changed = false
            for (i in 0 until min(objs.size, prog.size)) {
                val (o, _, done, waiting) = objs[i]
                if (o.type == kind && !done && !waiting && match(o)) { prog[i] = min(o.n, prog[i] + n); changed = true }
            }
            if (changed) questCheck(name, true)
        }
    }
    fun questCheckAll() { for (d in questDefs) if (questRec(strOf(d["name"]))?.get("state") == "active") questCheck(strOf(d["name"])) }
    fun questCheck(name: String, progressed: Boolean = false) {
        val d = questDef(name) ?: return; val r = questRec(name) ?: return
        if (r["state"] != "active") return
        val objs = questObjectives(name); val snap = objs.joinToString(",") { it.have.toString() }
        if (snap != r["snap"]) { val first = r["snap"] == null; r["snap"] = snap; if (!first || progressed) g.send("quest updated") }
        if (objs.isEmpty() || !objs.all { it.done }) return
        if (d["turnIn"] == "at giver" && strOf(d["giver"]).isNotEmpty()) { r["state"] = "ready"; syncQuests(); g.message("Quest ready: Return to ${d["giver"]}", 2.0) }
        else completeQuest(name)
    }
    fun syncQuests() {
        val recs = quests.values
        g.setVar("questsDone", recs.count { it["state"] == "done" }.toDouble())
        g.setVar("questsActive", recs.count { it["state"] == "active" || it["state"] == "ready" }.toDouble())
        val tq = strOf(g.vars["trackedQuest"])
        if (tq.isNotEmpty() && questState(tq) !in listOf("active", "ready")) {
            g.setVar("trackedQuest", questDefs.map { strOf(it["name"]) }.firstOrNull { questState(it) in listOf("active", "ready") } ?: "")
        }
    }
    fun startQuest(name: String): Boolean {
        val d = questDef(name) ?: return false
        val st = questState(name)
        if (!(st == "available" || st == "failed" || (d["repeatable"] == true && st == "done"))) return false
        val n = strOf(d["name"])
        quests[n.lowercase()] = mutableMapOf("state" to "active", "prog" to MutableList(parseObjectives(d["objectives"]).size) { 0 }, "t" to g.time)
        val tq = strOf(g.vars["trackedQuest"])
        if (tq.isEmpty() || questState(tq) !in listOf("active", "ready")) g.setVar("trackedQuest", n)
        syncQuests(); g.message("New quest: $n", 2.0); g.sfx("power")
        questCheck(n)
        return true
    }
    /** Finish a quest (hand it in): takes "(take)" items and gives the rewards. */
    fun completeQuest(name: String): Boolean {
        val d = questDef(name) ?: return false
        if (questState(name) !in listOf("active", "ready")) return false
        for (o in parseObjectives(d["objectives"])) if (o.type == "collect" && o.take) add(o.target, -o.n)
        val n = strOf(d["name"])
        quests[n.lowercase()]!!["state"] = "done"
        val rs = parseRewards(d["rewards"])
        for ((kind, rn, amount) in rs) {
            when {
                kind == "item" || (kind == "var" && def(rn)["plain"] != true) -> { val got = add(rn, amount.roundToInt()); if (got < amount) dropNear(rn, amount.roundToInt() - got) }
                kind == "var" -> g.addVar(rn, amount)
                kind == "recipe" -> learn(rn)
                kind == "message" -> g.send(rn)
                kind == "quest" -> g.after(0.8) { startQuest(rn) }
            }
        }
        syncQuests(); g.sfx("win")
        g.message("Quest complete! $n${if (rs.isNotEmpty()) " · ${rewardText(rs)}" else ""}", 2.5)
        questCheckAll()
        return true
    }
    fun rewardText(rs: List<QReward>) = rs.map { (kind, name, n) ->
        val k = if (n == round(n)) n.toLong().toString() else n.toString()
        when (kind) { "var" -> "${if (n > 0) "+" else ""}$k $name"; "item" -> "${iconOf(name)}$name${if (n > 1) " ×$k" else ""}"; "recipe" -> "📜 $name"; "quest" -> "New quest: $name"; else -> "" }
    }.filter { it.isNotEmpty() }.joinToString("  ")
    fun failQuest(name: String): Boolean { val r = questRec(name); if (r == null || r["state"] !in listOf("active", "ready")) return false; r["state"] = "failed"; syncQuests(); g.message("Quest failed: ${questDef(name)!!["name"]}", 2.0); return true }
    fun resetQuest(name: String): Boolean { val d = questDef(name) ?: return false; quests.remove(strOf(d["name"]).lowercase()); syncQuests(); return true }
    /** Move a quest on by hand: the first unfinished custom / message objective, or objective number `which` (1 = first). */
    fun advanceQuest(name: String, n: Int = 1, which: Int = 0): Boolean {
        val r = questRec(name)
        if (r == null || r["state"] != "active") return false
        val objs = questObjectives(name); val prog = progOf(r)
        val i = if (which > 0) which - 1 else objs.indexOfFirst { !it.done && !it.waiting && (it.o.type == "custom" || it.o.type == "message") }
        if (i < 0 || i >= objs.size || i >= prog.size) return false
        prog[i] = min(objs[i].o.n, prog[i] + n); questCheck(name, true)
        return true
    }

    // ---- dialogue ----
    fun dialogueDef(name: String): JsonMap? { val k = name.trim().lowercase(); return dialogues.firstOrNull { strOf(it["name"]).trim().lowercase() == k } }
    private val dialogPanel: @Composable () -> Unit = { DialoguePanel(this) }
    /** Start a conversation from a dialogue's name or a script. */
    fun startDialogue(src: String, npc: GameObject? = null, start: String = "start", pause: Boolean = true, then: String = "", portrait: String = "", inline: Boolean = false, name: String = ""): Boolean {
        if (dialog != null) return false
        val d = dialogueDef(src); val script = if (d != null) strOf(d["script"]) else src
        if (script.isEmpty() || (d == null && !inline && !Regex("\\n|:\\s").containsMatchIn(script) && !Regex("^[*#@?]|->").containsMatchIn(script))) return false
        val nm = if (d != null) strOf(d["name"]) else name
        val key = nm.ifEmpty { npc?.name ?: "dialogue" }.lowercase()
        val run = DialogueRunner(script, StoryEnv(this, npc, (talked[key] ?: 0) == 0), start)
        talked[key] = (talked[key] ?: 0) + 1
        if (npc != null) questEvent("talk", npc, 1)
        if (run.done) { if (then.isNotEmpty()) g.send(then); return true }
        val realPause = g.objects.any { it.ui && !it.dead && it.showWhen == "paused" && it.name != "__dialoguePause" }
        val ds = DialogueState(run, npc, nm, then, portrait.ifEmpty { strOf(d?.get("portrait")) }, pause && !realPause)
        dialog = ds
        if (ds.pause) {
            val hold = GameObject(mapOf("name" to "__dialoguePause", "ui" to true, "showWhen" to "paused", "visible" to false), g) // (keeps the PAUSED card away)
            g.objects.add(hold); ds.hold = hold
            g.paused = true
        }
        g.panels.add(dialogPanel)
        return true
    }
    fun endDialogue() {
        val d = dialog ?: return
        dialog = null
        g.panels.remove(dialogPanel)
        if (d.pause) { g.paused = false; d.hold?.destroy() }
        g.send("dialogue ended")
        if (d.then.isNotEmpty()) g.send(d.then)
    }
    /** Typewriter, tap to finish the line, tap again for the next (or pick a choice). */
    fun stepDialog(dt: Double) {
        val d = dialog ?: return
        val r = d.run; val line = r.line
        if (r.done || line == null) { endDialogue(); return }
        d.chars = min(line.second.length.toDouble(), d.chars + dt * 45)
        layoutDialog(d)
        if (g.taps.isEmpty()) return
        val t = g.taps.first()
        g.taps.clear() // (taps go to the conversation)
        val ch = r.choices
        if (d.chars < line.second.length) d.chars = line.second.length.toDouble()
        else if (ch != null && ch.isNotEmpty()) {
            val k = d.choiceRects.indexOfFirst { it.contains(t.screen) }
            if (k < 0) return
            r.choose(k); d.chars = 0.0
        } else { r.next(); d.chars = 0.0 }
        g.sfx("click")
        if (r.done) endDialogue()
    }
    /** Where the box and choices go on this screen (the panel draws them there; taps are checked against them). */
    fun layoutDialog(d: DialogueState) {
        val line = d.run.line ?: return
        val k = dens.toDouble()
        val w = g.screen.width.toDouble(); val h = g.screen.height.toDouble(); val bw = min(w - 28 * k, 560 * k); val x = (w - bw) / 2
        val pic = if (d.portraitFor(line.first).isNotEmpty()) 64 * k else 0.0
        val perRow = max(4.0, (bw - 40 * k - pic) / (17 * k * 0.52)) // (about how many letters fit on a line)
        val rows = max(1, ceil(line.second.length / perRow).toInt())
        val bh = max(max(if (pic > 0) 100 * k else 0.0, 128 * k), 48 * k + rows * 24 * k); val y = h - g.safeBottom - bh - 20 * k
        d.box = Rect(x.toFloat(), y.toFloat(), (x + bw).toFloat(), (y + bh).toFloat())
        val rects = mutableListOf<Rect>()
        val ch = d.run.choices
        if (ch != null && d.chars >= line.second.length) {
            var cy = y - 12 * k - ch.size * 58 * k
            for (i in ch.indices) { rects.add(Rect((x + 10 * k).toFloat(), cy.toFloat(), (x + bw - 10 * k).toFloat(), (cy + 50 * k).toFloat())); cy += 58 * k }
        }
        d.choiceRects = rects
    }

    // ---- every frame ----
    private val withHealth = mutableMapOf<Int, GameObject>()
    private val counted = mutableSetOf<Int>()
    private var qt = 0
    fun tick(dt: Double) {
        stepDialog(dt)
        if (g.state != "play" || g.paused) return
        // deaths (Health running out) count for "kill" objectives
        fun died(o: GameObject) { if (counted.add(o.uid)) questEvent("kill", o, 1) }
        for (o in withHealth.values.toList()) {
            val gone = o.dead || o !in g.objects
            if (gone && o.part<Health>()?.dead == true) died(o)
            if (gone) withHealth.remove(o.uid)
        }
        for (o in g.objects) {
            val hb = o.part<Health>() ?: continue
            if (hb.dead) died(o) else if (!o.dead) withHealth[o.uid] = o
        }
        if ((qt++) % 6 != 0) return
        for (d in questDefs) {
            val name = strOf(d["name"])
            if (d["autoStart"] == true && questState(name) == "available") startQuest(name)
            val r = questRec(name)
            if (r == null || r["state"] != "active") continue
            val pl = player() ?: continue
            val objs = questObjectives(name); val prog = progOf(r)
            for (i in 0 until min(objs.size, prog.size)) {
                val (o, _, done, waiting) = objs[i]
                if (o.type != "reach" || done || waiting) continue
                val t = g.find(o.target) ?: continue
                val size = max(t.half.w, t.half.h)
                if (hypot(pl.x - t.x, pl.y - t.y) <= (if (o.dist > 0) o.dist else 60.0) + size) { prog[i] = 1; questCheck(name, true) }
            }
        }
    }
}

class SystemsTicker(val s: ItemSystems) : Component(emptyMap()) {
    override val always get() = true
    override fun update(e: GameObject, dt: Double, g: PocketGame) = s.tick(dt)
}

// ---- dialogue scripts ----

/** A step of a dialogue script. */
class DStep(val k: String, val who: String = "", val text: String = "", val cond: String = "", val go: String = "", val cmd: String = "", val once: Boolean = false)
data class DChoice(val text: String, val go: String, val step: Int)

/** A conversation going on: the runner, who it's with, and where its box and choices are on the screen. */
class DialogueState(val run: DialogueRunner, val npc: GameObject?, val name: String, val then: String, val portrait: String, val pause: Boolean) {
    var hold: GameObject? = null
    var chars = 0.0
    var box = Rect.Zero
    var choiceRects: List<Rect> = emptyList()
    /** The face to show for a speaker: the NPC's portrait, or the dialogue's. */
    fun portraitFor(who: String): String {
        if (portrait.isNotEmpty() && !portrait.startsWith("art:")) {
            val n = npc
            val npcWho = (n?.partNamed("npc") as? Npc)?.who(n) ?: ""
            if (n == null || who.isEmpty() || who.lowercase() == n.name.lowercase() || who.lowercase() == npcWho.lowercase()) return portrait
        }
        return ""
    }
}

/** What a dialogue script can read and change: variables (my.x = the NPC's own), items, quests, messages. */
class StoryEnv(val s: ItemSystems, val npc: GameObject? = null, val first: Boolean = false) {
    @Suppress("UNCHECKED_CAST")
    val chosen: MutableSet<Int> get() = npc?.let { it.data.getOrPut("_chosen") { mutableSetOf<Int>() } as MutableSet<Int> } ?: mutableSetOf()
    val g get() = s.g
    fun getVar(k: String): Any? {
        if (k.startsWith("my.")) { val n = k.substring(3); val np = npc?.part<Npc>(); if (n == "friendship" && np != null) return g.numVar(np.friendKey(npc)); return npc?.data?.get(n) }
        return g.vars[k]
    }
    fun setVar(k: String, v: Any?) {
        if (k.startsWith("my.")) { val n = k.substring(3); val np = npc?.part<Npc>(); if (n == "friendship" && np != null) g.setVar(np.friendKey(npc), v) else npc?.data?.set(n, v); return }
        g.setVar(k, v)
    }
    fun itemCount(n: String) = s.count(n)
    fun give(n: String, k: Int) {
        if (k > 0) { val got = s.add(n, k); if (got < k) s.dropNear(n, k - got); if (got > 0) g.message("${s.iconOf(n)} ${s.nameOf(n)}${if (got > 1) " ×$got" else ""}".trim(), 1.2) }
        else s.add(n, k)
    }
    fun questState(n: String) = s.questState(n)
    fun quest(cmd: String, n: String, k: Int) {
        when (cmd) {
            "start" -> s.startQuest(n)
            "complete", "turnin" -> s.completeQuest(n)
            "fail" -> s.failQuest(n)
            "reset" -> s.resetQuest(n)
            "progress" -> s.advanceQuest(n, k)
            "track" -> g.setVar("trackedQuest", strOf(s.questDef(n)?.get("name"), n))
        }
    }
    fun fill(t: String): String = Regex("\\{(\\w+)\\}").replace(t) { m ->
        val k = m.groupValues[1]; val v = if (g.vars.containsKey(k)) g.vars[k] else npc?.data?.get(k)
        if (v is Number) formatNumber(v.toDouble()) else v?.toString() ?: "{$k}"
    }
}

/** Is a dialogue / quest condition true? (has Item [n] · quest Name is active · coins >= 10 · first · chance 30 · not … · and · or) */
fun storyCond(cond: String, env: StoryEnv): Boolean {
    val c = cond.trim()
    if (c.isEmpty()) return true
    if (Regex("\\s(?:or|\\|\\|)\\s", IC).containsMatchIn(c)) return c.split(Regex("\\s+(?:or|\\|\\|)\\s+", IC)).any { storyCond(it, env) }
    if (Regex("\\s(?:and|&&)\\s", IC).containsMatchIn(c)) return c.split(Regex("\\s+(?:and|&&)\\s+", IC)).all { storyCond(it, env) }
    Regex("^(?:not|!)\\s*(.+)$", IC).find(c)?.let { return !storyCond(it.groupValues[1], env) }
    Regex("^has\\s+(.+?)(?:\\s+(\\d+))?$", IC).find(c)?.let { return env.itemCount(it.groupValues[1]) >= (it.groups[2]?.value?.toIntOrNull() ?: 1) }
    Regex("^quest\\s+(.+?)\\s+(?:is\\s+)?(locked|available|active|ready|done|failed|started|not started)$", IC).find(c)?.let {
        val st = env.questState(it.groupValues[1]); val w = it.groupValues[2].lowercase()
        return if (w == "started") st in listOf("active", "ready", "done") else if (w == "not started") st in listOf("available", "locked") else st == w
    }
    Regex("^chance\\s+(\\d+(?:\\.\\d+)?)\\s*%?$", IC).find(c)?.let { return Random.nextDouble() * 100 < it.groupValues[1].toDouble() }
    if (Regex("^first(\\s+time)?$", IC).matches(c)) return env.first
    Regex("^(.+?)\\s*(>=|<=|==|!=|≥|≤|≠|=|>|<)\\s*(.+)$").find(c)?.let { m ->
        val a = env.getVar(m.groupValues[1].trim()); val b = m.groupValues[3].trim().replace(Regex("^[\"']|[\"']$"), "")
        val op = mapOf("=" to "==", "≥" to ">=", "≤" to "<=", "≠" to "!=")[m.groupValues[2]] ?: m.groupValues[2]
        val bn = b.toDoubleOrNull(); val an = if (a == null || a.toString().isEmpty()) 0.0 else numOf(a, Double.NaN).takeIf { !it.isNaN() }
        if (b.isNotEmpty() && bn != null && an != null) return when (op) { ">=" -> an >= bn; "<=" -> an <= bn; ">" -> an > bn; "<" -> an < bn; "!=" -> an != bn; else -> an == bn }
        val x = strOf(a)
        return if (op == "!=") x != b else if (op == "==") x == b else false
    }
    val v = env.getVar(c)
    return v != null && v != false && v != 0.0 && v != 0 && v != "0" && v != ""
}

/** Run a dialogue "@command" (set / add / give / take / quest / send / sound / learn / end); "end" finishes the conversation. */
fun storyDo(cmd: String, env: StoryEnv): String? {
    val c = cmd.trim(); val sp = c.indexOf(' ')
    val verb = (if (sp < 0) c else c.substring(0, sp)).lowercase(); val arg = if (sp < 0) "" else c.substring(sp + 1).trim()
    fun value(t: String): Any { val s = t.trim().replace(Regex("^[\"']|[\"']$"), ""); return if (s.isNotEmpty() && s.toDoubleOrNull() != null) s.toDouble() else s }
    when (verb) {
        "set" -> Regex("^(\\S+)\\s*(?:=|to)?\\s*(.*)$", IC).find(arg)?.let { env.setVar(it.groupValues[1], value(it.groupValues[2])) }
        "add" -> Regex("^(\\S+)\\s+(-?[\\d.]+)$").find(arg)?.let { env.setVar(it.groupValues[1], numOf(env.getVar(it.groupValues[1])) + (it.groupValues[2].toDoubleOrNull() ?: 0.0)) }
        "give", "take" -> Regex("^(.+?)(?:\\s+(\\d+))?$").find(arg)?.let { env.give(it.groupValues[1], (it.groups[2]?.value?.toIntOrNull() ?: 1) * (if (verb == "take") -1 else 1)) }
        "quest" -> Regex("^(start|complete|finish|fail|turnin|turn in|reset|progress|track)\\s+(.+?)(?:\\s+(\\d+))?$", IC).find(arg)?.let {
            env.quest(it.groupValues[1].lowercase().replace(Regex("\\s+"), "").replace("finish", "complete"), it.groupValues[2], it.groups[3]?.value?.toIntOrNull() ?: 1)
        }
        "send", "message" -> Regex("^(.+?)(?:\\s+(-?[\\d.]+))?$").find(arg)?.let { env.g.send(it.groupValues[1]) }
        "sound" -> env.g.sfx(arg)
        "learn" -> if (env.s.learn(arg)) env.g.message("📜 New recipe: $arg", 1.4)
        "end", "stop" -> return "end"
    }
    return null
}

/** Plays a dialogue script: `line` is what to show (speaker, text), `choices` the buttons (or null), `done` when it's over. */
class DialogueRunner(script: String, val env: StoryEnv, start: String = "start") {
    val steps = mutableListOf<DStep>()
    val labels = mutableMapOf("start" to 0)
    var chosen: MutableSet<Int>
    var i = 0; var after = 0
    var done = false
    var line: Pair<String, String>? = null; var lastLine: Pair<String, String>? = null
    /** Choice buttons: text, where it goes, the step it is. */
    var choices: List<DChoice>? = null
    /** Is the line showing the last thing before the end? */
    val lastStep: Boolean get() { var j = i; while (j < steps.size && steps[j].k == "do") j++; return j >= steps.size || (steps[j].k == "goto" && Regex("^end$", IC).matches(steps[j].go)) }

    init {
        parse(script)
        chosen = env.chosen
        i = labels[start.lowercase()] ?: 0
        advance()
    }
    private fun parse(src: String) {
        for (raw in src.split("\n")) {
            val l = raw.trim()
            if (l.isEmpty() || l.startsWith("//")) continue
            Regex("^(?:#|==)\\s*(.+?)\\s*=*$").find(l)?.let {
                if (steps.isNotEmpty() && steps.last().k != "goto") steps.add(DStep("goto", go = "END"))
                labels[it.groupValues[1].trim().lowercase()] = steps.size
                return@let true
            }?.let { continue }
            if (l.startsWith("*")) {
                var t = l.substring(1).trim(); var cond = ""; var go = ""; var once = false
                for (k in 0 until 4) {
                    val c = Regex("^\\[if\\s+([^\\]]+)\\]\\s*", IC).find(t)
                    if (c != null) { cond = c.groupValues[1].trim(); t = t.substring(c.range.last + 1); continue }
                    val o = Regex("^\\(once\\)\\s*", IC).find(t)
                    if (o != null) { once = true; t = t.substring(o.range.last + 1); continue }
                    break
                }
                Regex("\\s*->\\s*(.+)$").find(t)?.let { go = it.groupValues[1].trim(); t = t.substring(0, it.range.first).trim() }
                steps.add(DStep("choice", text = t, cond = cond, once = once, go = go))
                continue
            }
            Regex("^->\\s*(.+)$").find(l)?.let { steps.add(DStep("goto", go = it.groupValues[1].trim())); return@let true }?.let { continue }
            Regex("^\\?\\s*(.+?)\\s*->\\s*(.+)$").find(l)?.let { steps.add(DStep("if", cond = it.groupValues[1].trim(), go = it.groupValues[2].trim())); return@let true }?.let { continue }
            if (l.startsWith("@")) { steps.add(DStep("do", cmd = l.substring(1).trim())); continue }
            val m = Regex("^([^:]{1,24}):\\s+(.*)$").find(l)
            steps.add(if (m != null && !Regex("^(https?|note)$", IC).matches(m.groupValues[1].trim())) DStep("say", who = m.groupValues[1].trim(), text = m.groupValues[2]) else DStep("say", text = l))
        }
    }
    fun finish() { done = true; line = null; choices = null }
    fun jump(go: String): Boolean {
        if (go.isEmpty() || go.lowercase() == "end") { finish(); return false }
        val j = labels[go.lowercase()] ?: run { finish(); return false }
        i = j
        return true
    }
    fun readChoices(): List<DChoice>? {
        var j = i
        val list = mutableListOf<DChoice>()
        while (j < steps.size && steps[j].k == "choice") {
            val s = steps[j]
            if (!(s.once && j in chosen) && storyCond(s.cond, env)) list.add(DChoice(env.fill(s.text), s.go, j))
            j++
        }
        after = j
        return if (j > i) list else null
    }
    fun advance() {
        var guard = 0
        line = null; choices = null
        while (!done) {
            if (++guard > 1000) return finish()
            if (i >= steps.size) return finish()
            val s = steps[i]
            if (s.k == "say") {
                i++
                line = s.who to env.fill(s.text); lastLine = line
                val ch = readChoices()
                if (ch != null) { if (ch.isNotEmpty()) choices = ch else i = after }
                return
            }
            if (s.k == "choice") { val ch = readChoices()!!; if (ch.isNotEmpty()) { choices = ch; line = lastLine ?: ("" to ""); return }; i = after; continue }
            i++
            if (s.k == "goto") { if (!jump(s.go)) return; continue }
            if (s.k == "if") { if (storyCond(s.cond, env) && !jump(s.go)) return; continue }
            if (s.k == "do" && storyDo(s.cmd, env) == "end") return finish()
        }
    }
    fun next() { if (done || choices != null) return; advance() }
    fun choose(k: Int) {
        val c = choices ?: return
        if (k < 0 || k >= c.size) return
        chosen.add(c[k].step)
        i = after; choices = null
        if (c[k].go.isNotEmpty() && !jump(c[k].go)) return
        advance()
    }
}

// ---- drawing helpers for panels (screen pixels) ----

/** A Compose box placed at a rectangle in screen pixels. */
@Composable
fun AtRect(r: Rect, content: @Composable BoxScope.() -> Unit) {
    val d = LocalDensity.current
    Box(Modifier.offset { IntOffset(r.left.roundToInt(), r.top.roundToInt()) }.size(with(d) { max(0f, r.width).toDp() }, with(d) { max(0f, r.height).toDp() }), content = content)
}
/** Pixels → text size. */
fun pxSp(px: Double, d: Density) = (px / d.density / d.fontScale).sp
/** Pixels → dp. */
fun pxDp(px: Double, d: Density) = (px / d.density).dp

/** One line of HUD text (screen-pixel size). */
@Composable
fun ItemText(t: String, size: Double, w: FontWeight = FontWeight.Bold, c: Color = Color.White, align: TextAlign = TextAlign.Start, lines: Int = 1, modifier: Modifier = Modifier, strike: Boolean = false) {
    val d = LocalDensity.current
    Text(t, modifier, color = c, fontSize = pxSp(size, d), fontWeight = w, textAlign = align, maxLines = lines, overflow = TextOverflow.Ellipsis, textDecoration = if (strike) TextDecoration.LineThrough else null)
}

/** The conversation box: speaker pill, portrait, typewriter text, ▼ / ✓, and numbered choices above it. */
@Composable
fun DialoguePanel(s: ItemSystems) {
    val d0 = LocalDensity.current
    s.g.frame
    s.dens = d0.density
    val d = s.dialog ?: return
    val line = d.run.line ?: return
    if (d.box == Rect.Zero) return
    val acc = Color(0xFF4FA3FF); val panel = Color(0xFF1E2235)
    val b = d.box; val por = d.portraitFor(line.first); val shown = line.second.take(d.chars.toInt().coerceIn(0, line.second.length))
    val ready = d.chars >= line.second.length; val ch = d.run.choices
    val k = d0.density.toDouble()
    if (ch != null) for (i in d.choiceRects.indices) {
        if (i >= ch.size) break
        AtRect(d.choiceRects[i]) {
            Row(Modifier.fillMaxSize().background(panel.copy(alpha = 0.96f), RoundedCornerShape(25.dp)).border(1.5.dp, acc.copy(alpha = 0.55f), RoundedCornerShape(25.dp)), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.width(13.dp))
                Box(Modifier.size(24.dp).background(acc, CircleShape), contentAlignment = Alignment.Center) { Text("${i + 1}", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black) }
                Spacer(Modifier.width(11.dp))
                Text(ch[i].text, Modifier.weight(1f), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
    AtRect(b) {
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(mixColor(panel, Color.White, 0.06).copy(alpha = 0.97f), panel.copy(alpha = 0.97f))), RoundedCornerShape(18.dp))
            .border(1.5.dp, acc.copy(alpha = 0.5f), RoundedCornerShape(18.dp)).padding(start = if (por.isNotEmpty()) 84.dp else 20.dp, top = 28.dp, end = 20.dp, bottom = 12.dp)) {
            Text(shown, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp)
        }
        if (por.isNotEmpty()) Box(Modifier.padding(start = 14.dp, top = 26.dp).size(56.dp).background(Color(0x14FFFFFF), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Text(por, fontSize = 38.sp) }
        if (ready && ch.isNullOrEmpty()) Text(if (d.run.lastStep) "✓" else "▼", Modifier.align(Alignment.BottomEnd).padding(end = 16.dp, bottom = 8.dp), color = acc, fontSize = 16.sp, fontWeight = FontWeight.Black)
    }
    if (line.first.isNotEmpty()) AtRect(Rect(b.left + (16 * k).toFloat(), b.top - (15 * k).toFloat(), b.right, b.top + (15 * k).toFloat())) {
        Box(Modifier.height(30.dp).background(acc, RoundedCornerShape(15.dp)).padding(horizontal = 14.dp), contentAlignment = Alignment.Center) { Text(line.first, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold) }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// World components: pick-ups, crafting stations, chests, resources, NPCs and dialogue
// ---------------------------------------------------------------------------------------------------------------

/** The nearest object with a tag. */
fun nearestTagged(g: PocketGame, e: GameObject, tag: String): GameObject? = g.objects.filter { it !== e && !it.dead && it.has(tag) }.minByOrNull { hypot(it.x - e.x, it.y - e.y) }
fun distTo(a: GameObject?, b: GameObject) = if (a == null) Double.POSITIVE_INFINITY else hypot(a.x - b.x, a.y - b.y)

/** A label over an object in the world (screen pixels): a pill with text, centred on a point. */
@Composable
fun PillAt(at: Offset, text: String, bg: Color = Color(0x99000000), fg: Color = Color.White, size: Int = 13) {
    val d = LocalDensity.current
    Box(Modifier.offset { IntOffset((at.x - 200 * d.density).roundToInt(), (at.y - 14 * d.density).roundToInt()) }.width(400.dp).height(28.dp), contentAlignment = Alignment.Center) {
        Text(text, Modifier.background(bg, RoundedCornerShape(14.dp)).padding(horizontal = 9.dp, vertical = 4.dp), color = fg, fontSize = size.sp, fontWeight = FontWeight.ExtraBold)
    }
}

/** Inventory Item: picked up into the inventory on touch or tap ({inventory} shows it), maybe pulled in like a magnet. */
class InventoryItem(p: JsonMap) : Component(p) {
    private var age = 0.0; private var n = 0
    private val tag get() = s("tag", "player")
    private val pickup get() = s("pickup", "on touch")
    override val wants: String? get() = if (pickup != "on tap") tag else null
    private fun take(e: GameObject, g: PocketGame) {
        if (e.dead || age < n("delay")) return
        val sy = ItemSystems.of(g); val item = s("item", "Key"); val d = sy.def(item); val icon = s("icon", strOf(d["icon"]))
        val got = sy.add(item, n, icon)
        if (got <= 0) return
        g.sfx("power")
        g.burst(e.x, e.y, rarityOf(d) ?: Color(0xFFFFF59D), 12)
        if (p["note"] != false) g.message("$icon ${strOf(d["name"], item)}${if (got > 1) " ×$got" else ""}".trim(), 1.2)
        n -= got
        if (n <= 0) e.destroy()
    }
    override fun start(e: GameObject, g: PocketGame) {
        ItemSystems.of(g)
        val a = n("amount", 1.0).roundToInt(); val b = n("amountMax").roundToInt()
        n = if (b > a) a + Random.nextInt(b - a + 1) else a
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        age += dt
        if (pickup != "on touch") { if (e.ui) g.tapTargets.add(e); if (g.tapsOn(e).isNotEmpty()) take(e, g) }
        val mag = n("magnet")
        if (mag > 0 && age >= n("delay")) {
            nearestTagged(g, e, tag)?.let { pl -> val d = distTo(pl, e); if (d < mag && d > 1e-3) { val k = min(1.0, dt * 8); e.x += (pl.x - e.x) * k; e.y += (pl.y - e.y) * k } }
        }
        if (pickup != "on tap" && age >= n("delay") && g.touching(e) { it.has(tag) }.isNotEmpty()) take(e, g)
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) = take(e, g)
}

/** Crafting Station: recipes that need it (Workbench, Furnace…) can be made while the player is close; tap it to open crafting. */
class CraftingStation(p: JsonMap) : Component(p) {
    private var near = false
    private val station get() = s("station", "Workbench")
    override fun start(e: GameObject, g: PocketGame) {
        ItemSystems.of(g)
        if (p["hint"] != false) g.panels.add { g.frame; if (near && !e.dead && e.shown) PillAt(g.toScreen(e.x, e.y - e.half.h) - Offset(0f, 22f * LocalDensity.current.density), "🔨 $station") }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val sy = ItemSystems.of(g); val pl = nearestTagged(g, e, s("tag", "player")); val now = distTo(pl, e) <= n("range", 100.0)
        if (now) sy.stations[station.lowercase()] = g.time
        if (now != near) { near = now; if (now) g.setVar("station", station) else if (g.vars["station"] == station) g.setVar("station", "") }
        if (g.tapsOn(e).isNotEmpty()) { g.setVar("station", station); g.send(s("message", "open crafting")) }
    }
}

/** Loot / Chest: gives (or drops) items with chances when tapped, touched, destroyed or on a message. */
class Loot(p: JsonMap) : Component(p) {
    private var opened = false
    private val whenS get() = s("when", "tapped")
    private val into get() = s("into", "straight into the inventory") != "onto the ground"
    override val wants: String? get() = if (whenS == "touched by tag") s("tag", "player") else null
    fun open(e: GameObject, g: PocketGame) {
        if (opened && p["once"] != false) return
        opened = true
        val got = ItemSystems.of(g).giveLoot(e, p["loot"] ?: "Coin 3-6\nApple 1 50%\nGem 1 10%", into)
        g.sfx("power"); g.burst(e.x, e.y, Color(0xFFFFD23D), 18)
        if (got.isNotEmpty() && into) g.message(got.joinToString("  "), 1.6) else if (got.isEmpty() && whenS != "destroyed") g.message("Empty", 1.0)
        e.shape?.let { sh -> if (s("openIcon").isNotEmpty() && sh["type"] == "emoji") sh["emoji"] = p["openIcon"] }
        if (on("destroyAfter") && whenS != "destroyed") e.destroy()
    }
    override fun start(e: GameObject, g: PocketGame) {
        ItemSystems.of(g)
        if (whenS == "message") g.on { m -> if (m == s("message", "open chest") && !e.dead) open(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (whenS != "tapped") return
        if (g.tapsOn(e).isNotEmpty()) {
            val reach = n("reach")
            if (reach > 0 && distTo(nearestTagged(g, e, s("tag", "player")), e) > reach) { g.message("Too far away", 1.0); return }
            open(e, g)
        }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) = open(e, g)
    override fun gone(e: GameObject, g: PocketGame) { if (whenS == "destroyed" && g.state == "play") open(e, g) }
}

/** Resource: trees, rocks and ore the player gathers items from by tapping or touching (maybe needing a tool); grows back. */
class ResourceNode(p: JsonMap) : Component(p) {
    private var left = 0; private var cool = 0.0; private var regrow = 0.0; private var regrowing = false
    private val gather get() = s("gather", "tapping")
    private val tag get() = s("tag", "player")
    private fun hit(e: GameObject, g: PocketGame) {
        if (regrowing || cool > 0) return
        cool = n("cooldown", 0.3)
        val sy = ItemSystems.of(g); val reach = n("reach", 120.0)
        if (reach > 0 && distTo(nearestTagged(g, e, tag), e) > reach) { g.message("Get closer", 0.8); return }
        val tool = s("tool")
        if (tool.isNotEmpty() && sy.count(tool) <= 0 && sy.equipped.values.none { it.lowercase() == tool.lowercase() }) { g.message("Needs ${if (Regex("^[aeiou]", IC).containsMatchIn(tool)) "an" else "a"} $tool", 1.2); return }
        left--
        g.squash(e, 0.92); g.sfx("hit")
        g.burst(e.x, e.y, parseColor(e.shape?.get("fill")) ?: Color(0xFFA1887F), 8)
        val item = s("item", "Wood"); val cnt = max(1, n("amount", 1.0).roundToInt())
        if (s("into") == "onto the ground") sy.dropNear(item, cnt, e)
        else { val k = sy.add(item, cnt); if (k < cnt) sy.dropNear(item, cnt - k, e) else g.popOver(e, "+$cnt ${sy.iconOf(item).ifEmpty { item }}", Color.White, 18.0) }
        sy.questEvent("gather", item, cnt)
        if (left > 0) return
        if (s("bonus").isNotEmpty()) sy.giveLoot(e, p["bonus"], s("into") != "onto the ground")
        if (n("respawn", 20.0) > 0) { regrowing = true; regrow = n("respawn", 20.0); e.visible = false } else e.destroy()
    }
    override fun start(e: GameObject, g: PocketGame) { ItemSystems.of(g); left = max(1, n("hits", 3.0).roundToInt()) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        cool -= dt
        if (regrowing) { regrow -= dt; if (regrow <= 0) { regrowing = false; left = max(1, n("hits", 3.0).roundToInt()); e.visible = true; g.squash(e, 0.5) }; return }
        if (gather != "touching") { if (e.ui) g.tapTargets.add(e); if (g.tapsOn(e).isNotEmpty()) hit(e, g) }
        if (gather != "tapping" && g.touching(e) { it.has(tag) }.isNotEmpty()) hit(e, g)
    }
}

/** Dialogue: a conversation box (speaker names, typewriter text, choices); starts on touch, tap, a message or the game starting. */
class DialoguePart(p: JsonMap) : Component(p) {
    private var done = false
    private val trigger get() = s("trigger", "touched by tag")
    override val wants: String? get() = if (trigger == "touched by tag") s("tag", "player") else null
    fun open(e: GameObject, g: PocketGame) {
        val sy = ItemSystems.of(g)
        if ((done && p["once"] != false) || sy.dialog != null) return
        val dlg = s("dialogue")
        val ok = if (dlg.isNotEmpty()) sy.startDialogue(dlg, e, pause = p["pause"] != false, then = s("then"), portrait = s("portrait"))
        else sy.startDialogue(s("lines", "Guard: Halt! Who goes there?\nYou: Just a traveler.\nGuard: Fine. Watch out for slimes!"), e, pause = p["pause"] != false, then = s("then"), portrait = s("portrait"), inline = true, name = e.name)
        if (ok) done = true
    }
    override fun start(e: GameObject, g: PocketGame) {
        ItemSystems.of(g)
        if (trigger == "game starts") g.after(0.01) { open(e, g) }
        if (trigger == "message") g.on { m -> if (m == s("message", "talk") && !e.dead) open(e, g) }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (trigger != "tapped") return
        if (e.ui) g.tapTargets.add(e)
        if (g.tapsOn(e).isNotEmpty()) open(e, g)
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) = open(e, g)
}

/** NPC: someone to talk to. Starts a dialogue, hands in finished quests, offers its quests (! and ? markers), sells and buys,
 *  likes gifts, says things in a bubble, and stands still, wanders, walks a route or follows the player. */
class Npc(p: JsonMap) : Toucher(p) {
    private var near = false; private var walking = false
    private var cool = 0.0; private var barkT = 0.0; private var barkCool = 0.0; private var pauseT = 0.0; private var barkAt = 0.0
    private var routeI = 0; private var lastBark = -1
    private var home = Offset.Zero
    private var dest: Offset? = null
    private var route = listOf<Offset>()
    private var bark: String? = null
    private val tag get() = s("tag", "player")
    private val startMode get() = s("start", "tapped when close")
    private val range get() = n("range", 100.0)
    fun who(e: GameObject) = s("talkName", e.name.ifEmpty { "NPC" }).trim()
    fun friendKey(e: GameObject) = "friend_${who(e).replace(Regex("\\W+"), "_")}"
    override fun cares(other: GameObject) = startMode == "touched by tag" && other.has(tag)
    fun gives(sy: ItemSystems, e: GameObject) = sy.questDefs.filter { strOf(it["giver"]).trim().lowercase() == who(e).lowercase() }
    fun marker(sy: ItemSystems, e: GameObject): String {
        val gv = gives(sy, e)
        if (gv.any { sy.questState(strOf(it["name"])) == "ready" }) return "?"
        if (gv.any { sy.questState(strOf(it["name"])) == "available" }) return "!"
        return ""
    }
    private fun rows(t: Any?) = (t?.toString() ?: "").split("\n").map { l -> l.split("|").map { it.trim() } }.filter { it[0].isNotEmpty() }
    private fun priceOf(sy: ItemSystems, r: List<String>) = r.getOrNull(1)?.toDoubleOrNull() ?: max(1.0, numOf(sy.def(r[0])["value"], 10.0))
    private fun fmt(v: Double) = if (v == round(v)) v.toLong().toString() else v.toString()
    private val likes get() = tagList(p["likes"])
    /** Shop, sell and gift sections, plus a menu leading to them. */
    fun extras(sy: ItemSystems, e: GameObject, shop: Boolean = false, sell: Boolean = false, gift: Boolean = false, menuHave: Boolean = false): Pair<String, Boolean> {
        val nm = who(e); val cur = s("currency", "coins").trim(); val L = mutableListOf<String>(); val menu = mutableListOf<String>()
        val sells = rows(p["sells"]); val buys = rows(p["buys"])
        if (sells.isNotEmpty() && !shop) {
            menu.add("* Buy -> shop")
            L.addAll(listOf("# shop", "$nm: Take a look!"))
            for ((i, r) in sells.withIndex()) {
                val pr = fmt(priceOf(sy, r)); val k = r.getOrNull(2)?.toIntOrNull() ?: 1
                L.add("* [if $cur >= $pr] ${r[0]}${if (k > 1) " ×$k" else ""} — $pr $cur -> buy$i")
                L.add("* [if $cur < $pr] ${r[0]} — $pr $cur (not enough) -> broke")
            }
            L.add("* Back -> menu")
            for ((i, r) in sells.withIndex()) {
                val k = max(1, r.getOrNull(2)?.toIntOrNull() ?: 1)
                L.addAll(listOf("# buy$i", "@add $cur -${fmt(priceOf(sy, r))}", "@give ${r[0]} $k", "@sound coin", "$nm: Thank you!", "-> shop"))
            }
            L.addAll(listOf("# broke", "$nm: You don’t have enough $cur for that.", "-> shop"))
        }
        if (buys.isNotEmpty() && !sell) {
            menu.add("* Sell -> sell")
            L.addAll(listOf("# sell", "$nm: What have you got for me?"))
            for ((i, r) in buys.withIndex()) L.add("* [if has ${r[0]}] ${r[0]} — ${fmt(priceOf(sy, r))} $cur -> sold$i")
            L.add("* Back -> menu")
            for ((i, r) in buys.withIndex()) L.addAll(listOf("# sold$i", "@take ${r[0]} 1", "@add $cur ${fmt(priceOf(sy, r))}", "@sound coin", "$nm: Pleasure doing business.", "-> sell"))
        }
        val lk = likes
        if (lk.isNotEmpty() && !gift) {
            menu.add("* Give a gift -> gift")
            L.addAll(listOf("# gift", "$nm: Oh? What is it?"))
            for ((i, x) in lk.withIndex()) L.add("* [if has $x] $x -> gave$i")
            L.add("* Never mind -> menu")
            for ((i, x) in lk.withIndex()) L.addAll(listOf("# gave$i", "@take $x 1", "@add my.friendship 1", "@sound power", "$nm: ${s("giftReply", "Thank you!")}", "-> menu"))
        }
        if (menu.isNotEmpty() && !menuHave) { L.add("# menu"); L.addAll(menu); L.add("* Bye -> END") }
        return L.joinToString("\n") to menu.isNotEmpty()
    }
    /** A dialogue made up on the spot: thanks for finished quests, offers the next one, then the shop / gift menu. */
    fun autoScript(sy: ItemSystems, e: GameObject, handed: List<JsonMap>): String {
        val nm = who(e); val L = mutableListOf<String>()
        val (xt, xm) = extras(sy, e)
        val next = if (xm) "menu" else "END"
        for (q in handed) L.add("$nm: ${strOf(q["thanks"], "You did it! Thank you.")}")
        val gv = gives(sy, e)
        val avail = gv.firstOrNull { sy.questState(strOf(it["name"])) == "available" }
        val active = gv.firstOrNull { sy.questState(strOf(it["name"])) in listOf("active", "ready") }
        val lines = s("lines").trim()
        when {
            avail != null -> L.addAll(listOf("$nm: ${strOf(avail["offer"], strOf(avail["desc"], "I need your help with something."))}", "* Accept -> accept", "* Not now -> $next", "# accept", "@quest start ${avail["name"]}", "$nm: ${strOf(avail["accepted"], "Thank you! Come back when it’s done.")}"))
            active != null -> L.add("$nm: ${strOf(active["reminder"], "How is “${active["name"]}” going?")}")
            lines.isNotEmpty() && handed.isEmpty() -> L.add(lines)
            handed.isEmpty() -> L.add("$nm: ${s("greeting", "Hello there!")}")
        }
        if (xm && !(lines.isNotEmpty() && Regex("^\\s*\\*", RegexOption.MULTILINE).containsMatchIn(lines) && avail == null && active == null && handed.isEmpty())) L.add("-> menu")
        return L.joinToString("\n") + (if (xt.isNotEmpty()) "\n$xt" else "")
    }
    fun talk(e: GameObject, g: PocketGame) {
        val sy = ItemSystems.of(g)
        if (sy.dialog != null || g.state != "play") return
        val handed = mutableListOf<JsonMap>()
        if (p["turnIn"] != false) for (q in gives(sy, e)) if (sy.questState(strOf(q["name"])) == "ready" && sy.completeQuest(strOf(q["name"]))) handed.add(q)
        val pause = p["pause"] != false; val then = s("then"); val portrait = s("portrait")
        val dlg = s("dialogue"); val def = if (dlg.isNotEmpty()) sy.dialogueDef(dlg) else null
        if (def != null) {
            val script = strOf(def["script"])
            fun has(label: String) = Regex("^\\s*(?:#|==)\\s*$label\\s*=*\\s*$", setOf(RegexOption.MULTILINE, IC)).containsMatchIn(script)
            val (xt, _) = extras(sy, e, has("shop"), has("sell"), has("gift"), has("menu"))
            sy.startDialogue(script + (if (xt.isNotEmpty()) "\n$xt" else ""), e, pause = pause, then = then, portrait = portrait.ifEmpty { strOf(def["portrait"]) }, inline = true, name = strOf(def["name"]))
        } else if (dlg.isEmpty()) {
            sy.startDialogue(autoScript(sy, e, handed), e, pause = pause, then = then, portrait = portrait, inline = true, name = who(e))
        }
        bark = null; cool = 0.4
    }
    private fun say(g: PocketGame, text: String) { bark = g.fill(text); barkT = 2.8; barkAt = g.time }
    private fun face(e: GameObject, dx: Double) { if (abs(dx) < 0.5) return; if (e.shape?.get("type") == "emoji") e.data["flipX"] = dx > 0 else e.sx = abs(e.sx) * (if (dx < 0) -1 else 1) }
    /** Walk toward a point; true once there. */
    private fun walkTo(e: GameObject, tx: Double, ty: Double, dt: Double, stopAt: Double = 0.0): Boolean {
        val dx = tx - e.x; val dy = ty - e.y; val d = hypot(dx, dy)
        if (d <= stopAt + 2) return true
        val step = min(d - stopAt, n("speed", 60.0) * dt)
        e.x += dx / d * step; e.y += dy / d * step
        face(e, dx); walking = true
        return false
    }
    override fun start(e: GameObject, g: PocketGame) {
        val sy = ItemSystems.of(g)
        home = Offset(e.x.toFloat(), e.y.toFloat())
        if (startMode == "message") g.on { m -> if (m == s("message", "talk") && !e.dead) talk(e, g) }
        if (likes.isNotEmpty() && g.vars[friendKey(e)] == null) g.vars[friendKey(e)] = 0.0
        val rt = mutableListOf<Offset>()
        for (q in s("route").split(Regex("[\\n;]")).map { it.trim() }.filter { it.isNotEmpty() }) {
            val m = Regex("^(-?[\\d.]+)\\s*,\\s*(-?[\\d.]+)$").find(q)
            if (m != null) { rt.add(home + Offset(m.groupValues[1].toFloat(), m.groupValues[2].toFloat())); continue }
            g.find(q)?.let { rt.add(Offset(it.x.toFloat(), it.y.toFloat())) }
        }
        route = rt
        // markers, the 💬 bubble, the name tag and what it says, over its head
        g.panels.add {
            g.frame
            val den = LocalDensity.current.density
            if (e.dead || !e.shown || g.state != "play") return@add
            val mk = if (p["markers"] != false) marker(sy, e) else ""
            val bub = p["bubble"] != false && near && sy.dialog == null && bark == null
            val tagOn = on("nameTag")
            if (mk.isEmpty() && !bub && bark == null && !tagOn) return@add
            val q = g.toScreen(e.x, e.y - e.half.h)
            var y = q.y - 22 * den + (sin(g.time * 4) * 3 * den).toFloat()
            if (tagOn) {
                val f = if (likes.isNotEmpty()) min(5, g.numVar(friendKey(e)).toInt()) else 0
                PillAt(Offset(q.x, q.y - 12 * den), who(e) + (if (f > 0) "  ${"♥".repeat(f)}" else ""), size = 12)
                y -= 16 * den
            }
            if (mk.isNotEmpty()) AtRect(Rect(q.x - 13 * den, y - 13 * den, q.x + 13 * den, y + 13 * den)) {
                Box(Modifier.fillMaxSize().background(Color(0xFFFFD23D), CircleShape).border(3.dp, Color(0x8C000000), CircleShape), contentAlignment = Alignment.Center) { Text(mk, color = Color(0xFF1B1B1B), fontSize = 18.sp, fontWeight = FontWeight.Black) }
            }
            if (bub) { val bx = q.x + (if (mk.isNotEmpty()) 26 * den else 0f); AtRect(Rect(bx - 16 * den, y - 13 * den, bx + 16 * den, y + 13 * den)) { Box(Modifier.fillMaxSize().background(Color(0xF2FFFFFF), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("💬", fontSize = 14.sp) } } }
            val bk = bark
            if (bk != null && sy.dialog == null) {
                val a = min(1.0, min(barkT * 3, (g.time - barkAt) * 6)).coerceIn(0.0, 1.0).toFloat()
                val by = y - (if (mk.isNotEmpty()) 20 * den else 4 * den)
                Box(Modifier.offset { IntOffset((q.x - 100 * den).roundToInt(), (by - 60 * den).roundToInt()) }.width(200.dp).height(60.dp), contentAlignment = Alignment.BottomCenter) {
                    Text(bk, Modifier.widthIn(max = 190.dp).background(Color.White.copy(alpha = 0.96f * a), RoundedCornerShape(10.dp)).padding(horizontal = 10.dp, vertical = 6.dp), color = Color(0xFF1B1B1B).copy(alpha = a), fontSize = 13.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                }
            }
        }
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val sy = ItemSystems.of(g)
        cool -= dt; barkT -= dt; barkCool -= dt; pauseT -= dt; walking = false
        if (bark != null && barkT <= 0) bark = null
        val pl = nearestTagged(g, e, tag); val d = distTo(pl, e); val was = near
        near = d <= range
        val talking = sy.dialog?.npc === e
        // chatter
        val barks = s("barks").split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        if (barks.isNotEmpty() && sy.dialog == null && barkCool <= 0) {
            val every = p["barkWhen"] == "every few seconds"
            if (if (every) d < range * 4 else near && !was) {
                var i = Random.nextInt(barks.size)
                if (barks.size > 1 && i == lastBark) i = (i + 1) % barks.size
                lastBark = i; say(g, barks[i])
                barkCool = if (every) max(2.0, n("barkEvery", 8.0)) else 6.0
            }
        }
        // moving
        val mode = s("moveMode", "stands still")
        if (!talking && sy.dialog == null && mode != "stands still" && !(near && p["stopNear"] != false && mode != "follows the player") && pauseT <= 0) {
            if (mode == "follows the player" && pl != null) {
                val f = n("followDist", 70.0)
                if (distTo(pl, e) > f * 1.15) walkTo(e, pl.x, pl.y, dt, f)
            } else if (mode == "wanders around") {
                if (dest == null) { val r = n("wander", 120.0); val a = Random.nextDouble() * PI * 2; val k = sqrt(Random.nextDouble()) * r; dest = home + Offset((cos(a) * k).toFloat(), (sin(a) * k).toFloat()) }
                val de = dest!!
                if (walkTo(e, de.x.toDouble(), de.y.toDouble(), dt)) { dest = null; pauseT = n("waitAt", 1.5) * (0.5 + Random.nextDouble()) }
            } else if (mode == "patrols a route" && route.isNotEmpty()) {
                val t = route[routeI % route.size]
                if (walkTo(e, t.x.toDouble(), t.y.toDouble(), dt)) { routeI = (routeI + 1) % route.size; pauseT = n("waitAt", 1.5) }
            }
        }
        if (e.shape?.get("type") == "emoji") e.rz = if (walking) sin(g.time * 14) * 6 else e.rz * 0.8 // a little waddle
        if (p["facePlayer"] != false && pl != null && (near || talking) && !walking) face(e, pl.x - e.x)
        if (sy.dialog != null || cool > 0) return
        if (startMode == "player comes close" && near && !was) talk(e, g)
        if (startMode.startsWith("tapped") && g.tapsOn(e).isNotEmpty()) { if (startMode == "tapped when close" && !near) g.message("Get closer to talk", 1.0) else talk(e, g) }
    }
    override fun touch(e: GameObject, other: GameObject, g: PocketGame) { if (cool <= 0) talk(e, g) }
}

// ---------------------------------------------------------------------------------------------------------------
// HUD: hotbar, inventory grid, equipment, crafting, quest log / journal / tracker (native views over the game)
// ---------------------------------------------------------------------------------------------------------------

/** A HUD component drawn as Compose views in its object's box (its own shape and text aren't drawn on the canvas). */
abstract class HudPart(p: JsonMap) : Component(p) {
    override val always get() = true
    private var hooked = false
    /** Draw it (r: its box on the screen, k: the HUD scale; sizes are screen pixels). */
    @Composable abstract fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double)
    fun hook(e: GameObject, g: PocketGame) {
        if (hooked) return
        hooked = true
        e.shape?.let { sh -> val keep = mapOf("type" to (if (sh["type"] == "circle") "circle" else "rect"), "w" to sh["w"], "h" to sh["h"], "r" to sh["r"]); sh.clear(); sh.putAll(keep) } // (keeps its size, draws nothing)
        e.text?.clear()
        g.panels.add {
            g.frame
            if (!e.dead && e.shown && g.onScreen(e) && e in g.objects) { val r = g.uiRect(e); AtRect(r) { Draw(e, g, r, g.uiK) } }
        }
    }
    override fun start(e: GameObject, g: PocketGame) { ItemSystems.of(g); hook(e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) { ItemSystems.of(g); hook(e, g); if (e.ui) g.tapTargets.add(e) }
    /** Taps this frame inside a rectangle (screen pixels). */
    fun tapsIn(g: PocketGame, r: Rect) = g.taps.filter { r.contains(it.screen) }
}

/** A box at a rectangle given relative to its HUD's top-left (screen pixels). */
@Composable
fun BoxScope.Sub(r: Rect, content: @Composable BoxScope.() -> Unit) {
    val d = LocalDensity.current
    Box(Modifier.offset { IntOffset(r.left.roundToInt(), r.top.roundToInt()) }.size(with(d) { max(0f, r.width).toDp() }, with(d) { max(0f, r.height).toDp() }), content = content)
}
fun Rect.shiftBy(o: Offset) = Rect(left - o.x, top - o.y, right - o.x, bottom - o.y)

/** Inventory Grid and Hotbar: slots showing the inventory (stacks, rarity frames). Tap to pick, tap again to use / equip / drop. */
class InventorySlots(p: JsonMap, val hotbar: Boolean) : HudPart(p) {
    private val pop = mutableMapOf<Int, Double>()
    private val v get() = s("var", if (hotbar) "heldItem" else "selectedItem")
    private val count get() = max(1, n("slots", if (hotbar) 6.0 else 12.0).roundToInt())
    private val digits = listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine)
    /** The slots' rectangles on the screen, and the info line below them. */
    fun geo(b: Rect, k: Double): Pair<List<Rect>, Rect> {
        val cols = max(1, if (hotbar) count else n("columns", 4.0).roundToInt()); val rows = ceil(count.toDouble() / cols).toInt()
        val gap = (if (hotbar) 6 else 8) * k; val ih = if (p["info"] == true) 40 * k else 0.0
        val sz = max(4.0, min((b.width - gap * (cols - 1)) / cols, (b.height - ih - gap * (rows - 1)) / rows))
        val ox = b.center.x - (cols * sz + (cols - 1) * gap) / 2; val oy = b.top + (b.height - ih - (rows * sz + (rows - 1) * gap)) / 2
        val rects = (0 until count).map { i -> val x = ox + (i % cols) * (sz + gap); val y = oy + (i / cols) * (sz + gap); Rect(x.toFloat(), y.toFloat(), (x + sz).toFloat(), (y + sz).toFloat()) }
        val iy = oy + rows * (sz + gap)
        return rects to Rect(b.left, iy.toFloat(), b.right, (iy + ih).toFloat())
    }
    private fun act(g: PocketGame, sy: ItemSystems, name: String) {
        val how = s("onUse", "use or equip")
        if (how == "select only") return
        if (how == "drop") { if (sy.add(name, -1) != 0) sy.dropNear(name, 1) } else sy.use(name, sy.player(), if (p["consume"] == false) false else null)
        if (sy.count(name) <= 0) g.setVar(v, "")
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        for (k in pop.keys.toList()) { val x = pop[k]!! - dt * 4; if (x <= 0) pop.remove(k) else pop[k] = x }
        val sy = ItemSystems.of(g); val list = sy.stacks(s("filter", "all"))
        val (rects, _) = geo(g.uiRect(e), g.uiK)
        if (hotbar && p["keys"] != false) {
            for (i in 0 until min(digits.size, count)) {
                val down = digits[i] in g.keys; val was = e.data["key$i"] == true
                e.data["key$i"] = down
                if (down && !was) { g.setVar(v, if (i < list.size) list[i].name else ""); pop[i] = 1.0 }
            }
        }
        for (t in g.taps) {
            val i = rects.indexOfFirst { it.contains(t.screen) }
            if (i < 0) continue
            g.sfx("click"); pop[i] = 1.0
            if (i >= list.size) { g.setVar(v, ""); continue }
            val name = list[i].name
            if (strOf(g.vars[v]) == name && p["useOnSecondTap"] != false) act(g, sy, name) else g.setVar(v, name)
        }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val sy = ItemSystems.of(g); val list = sy.stacks(s("filter", "all"))
        val (rects, info) = geo(r, k)
        val txt = parseColor(p["text"]) ?: Color.White; val acc = parseColor(p["accent"]) ?: Color(0xFFFFD23D); val slotC = parseColor(p["slot"]) ?: Color(0x14FFFFFF); val border = parseColor(p["border"]) ?: Color(0x26FFFFFF)
        Box(Modifier.fillMaxSize()) {
            for (i in rects.indices) {
                val rr = rects[i].shiftBy(r.topLeft); val it = list.getOrNull(i); val on = it != null && strOf(g.vars[v]) == it.name
                val rc = if (it != null && p["rarity"] != false && strOf(it.def["rarity"], "common") != "common") rarityOf(it.def) else null
                val sc = (1 + sin((pop[i] ?: 0.0) * PI) * 0.08).toFloat(); val sz = rr.width.toDouble()
                val shape = RoundedCornerShape(pxDp(10 * k, den))
                Sub(rr) {
                    Box(Modifier.fillMaxSize().graphicsLayerScale(sc).background(rc?.copy(alpha = 0.18f) ?: slotC, shape).border(if (on) 3.dp else if (rc != null) 2.dp else 1.5.dp, if (on) acc else rc ?: border, shape)) {
                        if (hotbar && p["numbers"] != false) ItemText("${i + 1}", 9 * k, FontWeight.ExtraBold, txt.copy(alpha = 0.5f), modifier = Modifier.padding(start = pxDp(5 * k, den), top = pxDp(3 * k, den)))
                        if (it != null) Text(it.icon, Modifier.align(Alignment.Center).padding(bottom = if (p["labels"] == true) pxDp(12 * k, den) else 0.dp), fontSize = pxSp(sz * 0.42, den))
                        if (it != null && it.n > 1) ItemText("${it.n}", max(10.0, sz * 0.2), FontWeight.Black, txt, modifier = Modifier.align(Alignment.BottomEnd).padding(end = pxDp(5 * k, den), bottom = pxDp(2 * k, den)))
                        if (it != null && p["labels"] == true) ItemText(it.name, 9.5 * k, c = txt.copy(alpha = 0.8f), align = TextAlign.Center, modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(bottom = pxDp(3 * k, den)))
                    }
                }
            }
            if (p["info"] == true) {
                val pick = list.firstOrNull { it.name == strOf(g.vars[v]) }
                Sub(info.shiftBy(r.topLeft)) {
                    if (pick != null) {
                        val d = pick.def; val type = strOf(d["type"], "misc")
                        val bits = listOf(strOf(d["desc"]), if (numOf(d["heal"]) > 0) "+${strOf(d["heal"])} health" else "", if (numOf(d["food"]) > 0) "+${strOf(d["food"])} food" else "", if (numOf(d["drink"]) > 0) "+${strOf(d["drink"])} drink" else "",
                            if (numOf(d["damage"]) > 0) "⚔ ${strOf(d["damage"])}" else "", if (numOf(d["armor"]) > 0) "🛡 ${strOf(d["armor"])}" else "").filter { it.isNotEmpty() }.joinToString(" · ")
                        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                            ItemText("${pick.name}${if (type != "misc") " · ${itemTypeLabels[type] ?: type}" else ""}", 13 * k, FontWeight.ExtraBold, if (strOf(d["rarity"], "common") != "common") rarityOf(d) ?: txt else txt, TextAlign.Center)
                            if (bits.isNotEmpty()) ItemText(bits, 11 * k, FontWeight.SemiBold, txt.copy(alpha = 0.75f), TextAlign.Center)
                        }
                    } else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { ItemText(if (sy.slotCount > 0) "${sy.slotsUsed} / ${sy.slotCount} slots" else "Tap an item", 12 * k, c = txt.copy(alpha = 0.6f)) }
                }
            }
        }
    }
}
/** Scales a view (a slot's little pop). */
fun Modifier.graphicsLayerScale(s: Float) = this.then(if (s == 1f) Modifier else Modifier.scale(s))

/** Equipment: the player's slots (hand, head, body…) with what's worn and the total damage, armour and speed. Tap one to take it off. */
class EquipmentHud(p: JsonMap) : HudPart(p) {
    private val slotIcons = mapOf("hand" to "✋", "offhand" to "🤚", "head" to "⛑️", "body" to "👕", "legs" to "👖", "feet" to "👢", "neck" to "📿", "ring" to "💍")
    private val slots get() = tagList(p["slots"] ?: "hand, offhand, head, body, legs, feet").map { it.lowercase() }
    private fun geo(b: Rect, k: Double): Pair<List<Rect>, Double> {
        val S = slots; val cols = max(1, n("columns", 3.0).roundToInt()); val rows = max(1, ceil(S.size.toDouble() / cols).toInt()); val sh = if (p["stats"] != false) 26 * k else 0.0; val gap = 8 * k
        val sz = max(4.0, min((b.width - gap * (cols - 1)) / cols, (b.height - sh - gap * (rows - 1)) / rows - 12 * k))
        val ox = b.center.x - (cols * sz + (cols - 1) * gap) / 2; val oy = b.top + 4 * k
        return S.indices.map { i -> val x = ox + (i % cols) * (sz + gap); val y = oy + (i / cols) * (sz + 12 * k + gap); Rect(x.toFloat(), y.toFloat(), (x + sz).toFloat(), (y + sz + 12 * k).toFloat()) } to oy + rows * (sz + 12 * k + gap)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        val sy = ItemSystems.of(g); val (rects, _) = geo(g.uiRect(e), g.uiK); val S = slots
        for (t in g.taps) for (i in rects.indices) if (rects[i].contains(t.screen) && sy.equipped[S[i]] != null) { g.sfx("click"); sy.unequip(S[i]) }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val sy = ItemSystems.of(g); val (rects, statsY) = geo(r, k); val S = slots; val txt = parseColor(p["text"]) ?: Color.White
        Box(Modifier.fillMaxSize()) {
            for (i in S.indices) {
                val rr = rects[i].shiftBy(r.topLeft); val name = sy.equipped[S[i]]; val d = name?.let { sy.def(it) }; val sz = rr.width.toDouble()
                val rc = if (d != null && strOf(d["rarity"], "common") != "common") rarityOf(d) else null
                val shape = RoundedCornerShape(pxDp(10 * k, den))
                Sub(rr) {
                    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(pxDp(sz, den)).background(rc?.copy(alpha = 0.18f) ?: parseColor(p["slot"]) ?: Color(0x14FFFFFF), shape).border(if (rc != null) 2.dp else 1.5.dp, rc ?: parseColor(p["border"]) ?: Color(0x2EFFFFFF), shape), contentAlignment = Alignment.Center) {
                            Text(if (name != null) sy.iconOf(name).ifEmpty { name.take(2) } else slotIcons[S[i]] ?: "▫️", Modifier.alpha(if (name != null) 1f else 0.3f), fontSize = pxSp(sz * (if (name != null) 0.45 else 0.32), den))
                        }
                        ItemText(name ?: S[i], 10 * k, c = txt.copy(alpha = if (name != null) 0.9f else 0.5f), align = TextAlign.Center)
                    }
                }
            }
            if (p["stats"] != false) {
                val sp = sy.equipStat("speed")
                ItemText("⚔ ${formatNumber(sy.equipStat("damage"))}   🛡 ${formatNumber(sy.equipStat("armor"))}${if (sp != 1.0) "   👟 ×${round(sp * 100) / 100}" else ""}", 13 * k, FontWeight.ExtraBold, txt, TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().offset { IntOffset(0, (statsY - r.top).roundToInt()) })
            }
        }
    }
}

/** Crafting: the recipes with what each needs (green when you have it); tap one to make it. Drag to scroll. */
class CraftingHud(p: JsonMap) : HudPart(p) {
    private var scroll = 0.0; private var drag: Long? = null; private var dragY0 = 0.0; private var scroll0 = 0.0
    private val flash = mutableMapOf<Int, Double>()
    private fun rows(sy: ItemSystems): List<JsonMap> {
        var R = sy.recipes
        val cat = s("category"); val st = s("station")
        if (cat.isNotEmpty()) R = R.filter { strOf(it["category"]).lowercase() == cat.lowercase() }
        if (st.isNotEmpty()) R = R.filter { strOf(it["station"]).lowercase() == st.lowercase() }
        if (p["locked"] != true) R = R.filter { sy.knows(it) }
        if (p["show"] == "ones I can make") R = R.filter { sy.canCraft(it) }
        if (p["show"] == "ones for nearby stations") R = R.filter { strOf(it["station"]).isEmpty() || sy.nearStation(strOf(it["station"])) }
        return R
    }
    private fun geo(b: Rect, k: Double): Triple<Double, Double, Double> { val head = if (s("title", "Crafting").isNotEmpty()) 40 * k else 8 * k; return Triple(b.top + head, b.height - head - 8 * k, max(44.0, n("rowH", 62.0)) * k) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        for (i in flash.keys.toList()) { val v = flash[i]!!; val nn = if (v > 0) v - dt else v + dt; if (abs(nn) < 0.02 || (v > 0) != (nn > 0)) flash.remove(i) else flash[i] = nn }
        val sy = ItemSystems.of(g); val b = g.uiRect(e); val k = g.uiK
        val (top, h, rh) = geo(b, k)
        val R = rows(sy); val list = Rect(b.left, top.toFloat(), b.right, (top + h).toFloat())
        val maxS = max(0.0, R.size * (rh + 6 * k) - h)
        for (d in g.downs) if (list.contains(d.at)) { drag = d.id; dragY0 = d.at.y.toDouble(); scroll0 = scroll }
        drag?.let { id -> val q = g.pointers[id]; if (q != null) scroll = (scroll0 - (q.at.y - dragY0)).coerceIn(0.0, maxS) else drag = null }
        scroll = scroll.coerceIn(0.0, maxS)
        for (t in tapsIn(g, list)) {
            val i = floor((t.screen.y - top + scroll) / (rh + 6 * k)).toInt()
            if (i < 0 || i >= R.size) continue
            g.sfx("click")
            if (sy.craft(R[i])) flash[i] = 0.5 else { flash[i] = -0.5; val m = sy.craftMissing(R[i]); g.message(if (m.isNotEmpty()) "Need ${m.joinToString(", ")}" else "Can’t craft", 1.4) }
        }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val sy = ItemSystems.of(g); val (top, h, rh) = geo(r, k)
        val R = rows(sy); val txt = parseColor(p["text"]) ?: Color.White
        val have = parseColor(p["have"]) ?: Color(0xFF5DFF8A); val need = parseColor(p["need"]) ?: Color(0xFFFF6B6B); val acc = parseColor(p["accent"]) ?: Color(0xFF4FA3FF)
        val title = s("title", "Crafting"); val c = sy.crafting
        Box(Modifier.fillMaxSize().background(parseColor(p["bg"]) ?: Color(0xEB141828), RoundedCornerShape(pxDp(16 * k, den)))) {
            if (title.isNotEmpty()) ItemText(title, 17 * k, FontWeight.Black, txt, modifier = Modifier.padding(start = pxDp(16 * k, den), top = pxDp(10 * k, den)))
            if (title.isNotEmpty() && c != null) Box(Modifier.align(Alignment.TopEnd).padding(end = pxDp(14 * k, den), top = pxDp(15 * k, den)).width(pxDp(90 * k, den)).height(pxDp(12 * k, den)).background(Color(0x1FFFFFFF), RoundedCornerShape(pxDp(6 * k, den)))) {
                Box(Modifier.fillMaxHeight().fillMaxWidth(((g.time - c.started) / c.seconds).coerceIn(0.0, 1.0).toFloat()).background(acc, RoundedCornerShape(pxDp(6 * k, den))))
            }
            Box(Modifier.fillMaxWidth().offset { IntOffset(0, (top - r.top).roundToInt()) }.height(pxDp(max(0.0, h), den)).clipToBounds()) {
                if (R.isEmpty()) ItemText("Nothing to craft yet", 13 * k, c = txt.copy(alpha = 0.6f), align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = pxDp(20 * k, den)))
                for ((i, rec) in R.withIndex()) {
                    Box(Modifier.offset { IntOffset((8 * k).roundToInt(), (i * (rh + 6 * k) - scroll).roundToInt()) }.width(pxDp(r.width - 16 * k, den)).height(pxDp(rh, den))) { RecipeRow(sy, rec, i, rh, k, txt, have, need, acc) }
                }
            }
        }
    }
    @Composable private fun RecipeRow(sy: ItemSystems, r: JsonMap, i: Int, rh: Double, k: Double, txt: Color, have: Color, need: Color, acc: Color) {
        val den = LocalDensity.current
        val result = strOf(r["result"]); val known = sy.knows(r); val d = sy.def(result); val ok = sy.canCraft(r); val fl = flash[i] ?: 0.0; val st = strOf(r["station"])
        val far = st.isNotEmpty() && !sy.nearStation(st); val amount = numOf(r["amount"], 1.0)
        Row(Modifier.fillMaxSize().background(if (fl > 0) have.copy(alpha = 0.25f) else if (fl < 0) need.copy(alpha = 0.2f) else parseColor(p["row"]) ?: Color(0x0FFFFFFF), RoundedCornerShape(pxDp(12 * k, den))).padding(horizontal = pxDp(8 * k, den)), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(pxDp(rh * 0.62, den)), contentAlignment = Alignment.Center) { Text(if (known) strOf(d["icon"]).ifEmpty { result.take(2) } else "❔", fontSize = pxSp(rh * 0.4, den)) }
            Spacer(Modifier.width(pxDp(8 * k, den)))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
                ItemText(if (known) "$result${if (amount > 1) " ×${amount.toInt()}" else ""}" else "???", 14 * k, FontWeight.ExtraBold, if (strOf(d["rarity"], "common") != "common") rarityOf(d) ?: txt else txt)
                Spacer(Modifier.height(pxDp(4 * k, den)))
                Row(Modifier.height(pxDp(18 * k, den)).clipToBounds()) {
                    for ((name, nn, _) in parseIngredients(r["ingredients"])) {
                        val c = if (sy.count(name) >= nn) have else need
                        Box(Modifier.padding(end = pxDp(5 * k, den)).background(c.copy(alpha = 0.18f), RoundedCornerShape(pxDp(9 * k, den))).padding(horizontal = pxDp(6 * k, den)), contentAlignment = Alignment.Center) {
                            ItemText("${sy.iconOf(name).ifEmpty { name }} ${sy.count(name)}/$nn", 11 * k, c = c)
                        }
                    }
                }
            }
            Box(Modifier.width(pxDp(62 * k, den)).height(pxDp(30 * k, den)).background(if (ok) acc else Color(0x1FFFFFFF), RoundedCornerShape(pxDp(15 * k, den))), contentAlignment = Alignment.Center) {
                ItemText(if (far) "📍$st" else if (numOf(r["time"]) > 0) "⏱ ${formatNumber(numOf(r["time"]))}s" else "Make", (if (far) 9 else 12) * k, FontWeight.ExtraBold, if (ok) Color.White else txt.copy(alpha = 0.5f), TextAlign.Center)
            }
        }
    }
}

data class GoalRow(val i: Int, val text: String, val v: String, val target: Double, val rv: String, val ra: Double)

/** Quest Log: goals with progress bars, each following a variable up to a target; ticks off when done and can give a reward. */
class QuestLogHud(p: JsonMap) : HudPart(p) {
    private val flash = mutableMapOf<Int, Double>()
    private val goals: List<GoalRow> get() {
        val out = mutableListOf<GoalRow>()
        for (l in s("quests", "Collect 50 coins | coins | 50 | gems 5\nDefeat 10 enemies | kills | 10 | coins 100\nReach level 3 | playerLevel | 3 | gems 10\nJump 25 times | jumps | 25 | coins 30").split("\n")) {
            val c = l.split("|").map { it.trim() }
            if (c[0].isEmpty()) continue
            val rw = if (c.size > 3) c[3].split(Regex("\\s+")).filter { it.isNotEmpty() } else emptyList()
            out.add(GoalRow(out.size, c[0], c.getOrElse(1) { "" }, max(1.0, numOf(c.getOrElse(2) { "1" }, 1.0)), if (rw.size >= 2) rw[0] else "", if (rw.size >= 2) numOf(rw[1]) else 0.0))
        }
        return out
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        for (i in flash.keys.toList()) { val nn = flash[i]!! - dt; if (nn <= 0) flash.remove(i) else flash[i] = nn }
        for ((i, text, v, target, rv, ra) in goals) {
            val key = "quest_done_$i"
            if (g.vars[key] != true && g.numVar(v) >= target) {
                g.setVar(key, true); flash[i] = 1.5
                if (rv.isNotEmpty()) g.addVar(rv, ra)
                g.send(s("doneMessage", "quest done")); g.sfx("win")
                g.message("✓ $text", 1.6)
            }
        }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val txt = parseColor(p["text"]) ?: Color.White; val acc = parseColor(p["accent"]) ?: Color(0xFF4FA3FF); val dn = parseColor(p["done"]) ?: Color(0xFF3CCF7A)
        val Q = goals; val title = s("title", "Quests")
        val list = if (p["hideDone"] != false) Q.sortedBy { if (g.vars["quest_done_${it.i}"] == true) 1 else 0 } else Q
        val headH = if (title.isNotEmpty()) 34 * k else 0.0; val rh = min(58 * k, (r.height - 14 * k - headH - 6 * k) / max(1, list.size))
        Column(Modifier.fillMaxSize().background(parseColor(p["bg"] ?: "#181c2c") ?: Color.Transparent, RoundedCornerShape(pxDp(18 * k, den))).padding(top = pxDp(14 * k, den)).clipToBounds()) {
            if (title.isNotEmpty()) Row(Modifier.height(pxDp(headH, den)).fillMaxWidth().padding(horizontal = pxDp(16 * k, den))) {
                ItemText(title, 18 * k, FontWeight.Black, txt, modifier = Modifier.weight(1f))
                ItemText("${Q.count { g.vars["quest_done_${it.i}"] == true }}/${Q.size}", 13 * k, FontWeight.ExtraBold, txt.copy(alpha = 0.6f))
            }
            for ((i, text, v, target, rv, ra) in list) {
                val done = g.vars["quest_done_$i"] == true; val have = g.numVar(v); val f = (have / target).coerceIn(0.0, 1.0); val fl = flash[i] ?: 0.0
                Row(Modifier.height(pxDp(rh, den)).fillMaxWidth().padding(horizontal = pxDp(8 * k, den)).background(if (fl > 0) dn.copy(alpha = (fl * 0.25).toFloat()) else Color.Transparent, RoundedCornerShape(pxDp(10 * k, den))).padding(horizontal = pxDp(8 * k, den)), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(pxDp(22 * k, den)).background(if (done) dn else Color(0x1AFFFFFF), CircleShape), contentAlignment = Alignment.Center) { if (done) ItemText("✓", 14 * k, FontWeight.Black) }
                    Spacer(Modifier.width(pxDp(10 * k, den)))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            ItemText(text, 14 * k, c = if (done) txt.copy(alpha = 0.5f) else txt, modifier = Modifier.weight(1f), strike = done)
                            if (rv.isNotEmpty()) ItemText("+${formatNumber(ra)} $rv", 11 * k, FontWeight.ExtraBold, if (done) dn.copy(alpha = 0.8f) else Color(0xFFFFD23D))
                        }
                        Spacer(Modifier.height(pxDp(5 * k, den)))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.weight(1f).height(pxDp(6 * k, den)).background(Color(0x1AFFFFFF), RoundedCornerShape(pxDp(3 * k, den)))) {
                                Box(Modifier.fillMaxHeight().fillMaxWidth(max(0.02, f).toFloat()).background(if (done) dn else acc, RoundedCornerShape(pxDp(3 * k, den))))
                            }
                            Spacer(Modifier.width(pxDp(8 * k, den)))
                            ItemText("${formatNumber(min(have, target))}/${formatNumber(target)}", 11 * k, FontWeight.ExtraBold, txt.copy(alpha = 0.7f))
                        }
                    }
                }
            }
        }
    }
}

/** A quest as the HUD shows it. */
class QuestView(s: ItemSystems, d: JsonMap) {
    val name = strOf(d["name"]); val icon = strOf(d["icon"], "📜"); val state = s.questState(name); val desc = strOf(d["desc"]); val giver = strOf(d["giver"])
    val rewards = s.rewardText(parseRewards(d["rewards"])); val objs = s.questObjectives(name)
}

/** Quest Tracker: the tracked quest (or every active one) with its objectives ticking off; tap to send a message. */
class QuestTrackerHud(p: JsonMap) : HudPart(p) {
    private var flash = 0.0; private var last = ""
    private fun list(sy: ItemSystems, g: PocketGame): List<QuestView> {
        if (p["show"] == "all active quests") return sy.questDefs.filter { sy.questState(strOf(it["name"])) in listOf("active", "ready") }.take(max(1, n("max", 2.0).roundToInt())).map { QuestView(sy, it) }
        val t = strOf(g.vars["trackedQuest"]); val d = if (t.isEmpty()) null else sy.questDef(t)
        return if (d != null && sy.questState(t) in listOf("active", "ready")) listOf(QuestView(sy, d)) else emptyList()
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        flash = max(0.0, flash - dt)
        val key = list(ItemSystems.of(g), g).joinToString("|") { q -> "${q.name}${q.state}${q.objs.joinToString(",") { it.have.toString() }}" }
        if (key != last && last.isNotEmpty()) flash = 1.0
        last = key
        if (tapsIn(g, g.uiRect(e)).isNotEmpty()) { g.sfx("click"); if (s("message", "open quests").isNotEmpty()) g.send(s("message", "open quests")) }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val Q = list(ItemSystems.of(g), g); val right = p["align"] == "right"; val txt = parseColor(p["text"]) ?: Color.White; val tc = parseColor(p["title"]) ?: Color(0xFFFFD23D); val dn = parseColor(p["done"]) ?: Color(0xFF5DFF8A)
        val bg = parseColor(p["bg"]) ?: Color(0x73000000); val al = if (right) TextAlign.End else TextAlign.Start
        val shape = RoundedCornerShape(pxDp(if (Q.isEmpty()) 10 * k else 12 * k, den))
        if (Q.isEmpty()) {
            if (s("empty").isEmpty()) return
            Box(Modifier.fillMaxWidth().height(pxDp(34 * k, den)).background(bg, shape).padding(horizontal = pxDp(12 * k, den)), contentAlignment = if (right) Alignment.CenterEnd else Alignment.CenterStart) { ItemText(s("empty"), 13 * k, c = txt.copy(alpha = 0.7f), align = al) }
            return
        }
        Column(Modifier.fillMaxWidth().background(bg, shape).then(if (flash > 0) Modifier.border(2.dp, tc.copy(alpha = flash.toFloat()), shape) else Modifier).padding(pxDp(12 * k, den), pxDp(8 * k, den)), horizontalAlignment = if (right) Alignment.End else Alignment.Start) {
            for (q in Q) {
                ItemText("${q.icon} ${q.name}", 14 * k, FontWeight.Black, tc, al)
                Spacer(Modifier.height(pxDp(3 * k, den)))
                if (q.state == "ready") ItemText("✔ Return to ${q.giver.ifEmpty { "the quest giver" }}", 12.5 * k, FontWeight.ExtraBold, dn, al)
                for ((o, have, done, waiting) in q.objs) if (!(p["hideDone"] == true && done)) ItemText("${if (done) "✓" else "○"} ${o.label}${if (o.n > 1) "  $have/${o.n}" else ""}", 12.5 * k, FontWeight.Bold, if (done) dn else txt.copy(alpha = if (waiting) 0.45f else 0.9f), al)
                Spacer(Modifier.height(pxDp(6 * k, den)))
            }
        }
    }
}

/** Quest Journal: every quest you've started (and optionally ones you can start); tap one for its details, rewards and Track. */
class QuestJournalHud(p: JsonMap) : HudPart(p) {
    private var open: String? = null
    private var scroll = 0.0; private var dragY0 = 0.0; private var scroll0 = 0.0; private var drag: Long? = null
    private val order = mapOf("ready" to 0, "active" to 1, "available" to 2, "done" to 3, "failed" to 4)
    private val chip = mapOf("active" to "Active", "ready" to "Hand in", "available" to "New", "done" to "Done", "failed" to "Failed")
    private fun list(sy: ItemSystems): List<QuestView> {
        val out = mutableListOf<QuestView>()
        for (q in sy.questDefs) {
            val st = sy.questState(strOf(q["name"]))
            if (st in listOf("active", "ready") || (p["showDone"] != false && st in listOf("done", "failed")) || (p["showAvailable"] == true && st == "available" && q["hidden"] != true)) out.add(QuestView(sy, q))
        }
        return out.sortedBy { order[it.state] ?: 9 }
    }
    private fun detailH(q: QuestView, k: Double) = (30 + (if (q.desc.isNotEmpty()) 36 else 0) + q.objs.size * 20 + (if (q.rewards.isNotEmpty()) 22 else 0) + 38) * k
    private fun geo(b: Rect, k: Double): Triple<Double, Double, Double> { val head = if (s("title", "Quests").isNotEmpty()) 42 * k else 8 * k; return Triple(b.top + head, b.height - head - 8 * k, max(40.0, n("rowH", 54.0)) * k) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        super.update(e, dt, g)
        val sy = ItemSystems.of(g); val b = g.uiRect(e); val k = g.uiK
        val (top, h, rh) = geo(b, k)
        val L = list(sy); val area = Rect(b.left, top.toFloat(), b.right, (top + h).toFloat())
        var total = 0.0
        for (q in L) total += rh + 6 * k + (if (open == q.name) detailH(q, k) else 0.0)
        val maxS = max(0.0, total - h)
        for (d in g.downs) if (area.contains(d.at)) { drag = d.id; dragY0 = d.at.y.toDouble(); scroll0 = scroll }
        drag?.let { id -> val q = g.pointers[id]; if (q != null) scroll = (scroll0 - (q.at.y - dragY0)).coerceIn(0.0, maxS) else drag = null }
        scroll = scroll.coerceIn(0.0, maxS)
        for (t in tapsIn(g, area)) {
            var y = top - scroll
            for (q in L) {
                val hh = rh + (if (open == q.name) detailH(q, k) else 0.0)
                if (t.screen.y >= y && t.screen.y < y + hh) {
                    g.sfx("click")
                    val onButton = open == q.name && t.screen.y > y + hh - 40 * k
                    if (onButton && q.state in listOf("active", "ready")) g.setVar("trackedQuest", q.name)
                    else if (onButton && q.state == "available") sy.startQuest(q.name)
                    else open = if (open == q.name) null else q.name
                    break
                }
                y += hh + 6 * k
            }
        }
    }
    @Composable override fun Draw(e: GameObject, g: PocketGame, r: Rect, k: Double) {
        val den = LocalDensity.current
        val sy = ItemSystems.of(g); val (top, h, rh) = geo(r, k)
        val L = list(sy); val txt = parseColor(p["text"]) ?: Color.White; val acc = parseColor(p["accent"]) ?: Color(0xFFFFD23D); val dn = parseColor(p["done"]) ?: Color(0xFF5DFF8A)
        val title = s("title", "Quests")
        Box(Modifier.fillMaxSize().background(parseColor(p["bg"]) ?: Color(0xF0141828), RoundedCornerShape(pxDp(16 * k, den)))) {
            if (title.isNotEmpty()) ItemText(title, 17 * k, FontWeight.Black, txt, modifier = Modifier.padding(start = pxDp(16 * k, den), top = pxDp(11 * k, den)))
            Box(Modifier.fillMaxWidth().offset { IntOffset(0, (top - r.top).roundToInt()) }.height(pxDp(max(0.0, h), den)).clipToBounds()) {
                if (L.isEmpty()) ItemText("No quests yet", 13 * k, c = txt.copy(alpha = 0.6f), align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = pxDp(20 * k, den)))
                var y = -scroll
                for (q in L) {
                    val isOpen = open == q.name; val hh = rh + (if (isOpen) detailH(q, k) else 0.0); val tracked = strOf(g.vars["trackedQuest"]) == q.name
                    val cc = if (q.state == "ready" || q.state == "done") dn else if (q.state == "failed") Color(0xFFFF6B6B) else acc; val dnN = q.objs.count { it.done }
                    val btn = if (q.state in listOf("active", "ready")) (if (tracked) "★ Tracked" else "Track") else if (q.state == "available") "Start quest" else ""
                    val shape = RoundedCornerShape(pxDp(12 * k, den)); val yy = y
                    Column(Modifier.offset { IntOffset((8 * k).roundToInt(), yy.roundToInt()) }.width(pxDp(r.width - 16 * k, den)).height(pxDp(hh, den)).background(parseColor(p["row"]) ?: Color(0x0FFFFFFF), shape).then(if (tracked) Modifier.border(2.dp, acc, shape) else Modifier)) {
                        Row(Modifier.height(pxDp(rh, den)).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.width(pxDp(46 * k, den)), contentAlignment = Alignment.Center) { Text(q.icon, fontSize = pxSp(rh * 0.38, den)) }
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
                                ItemText(q.name, 15 * k, FontWeight.ExtraBold, if (q.state == "done") txt.copy(alpha = 0.6f) else txt)
                                if (q.objs.isNotEmpty() && q.state != "done") ItemText("$dnN / ${q.objs.size} done", 11.5 * k, c = txt.copy(alpha = 0.6f))
                            }
                            Box(Modifier.padding(end = pxDp(10 * k, den)).height(pxDp(22 * k, den)).background(cc.copy(alpha = 0.2f), RoundedCornerShape(pxDp(11 * k, den))).padding(horizontal = pxDp(8 * k, den)), contentAlignment = Alignment.Center) { ItemText(chip[q.state] ?: q.state, 11 * k, FontWeight.ExtraBold, cc) }
                        }
                        if (isOpen) Column(Modifier.weight(1f).padding(horizontal = pxDp(14 * k, den))) {
                            Box(Modifier.height(pxDp(22 * k, den))) { if (q.giver.isNotEmpty()) ItemText("From ${q.giver}", 12 * k, c = txt.copy(alpha = 0.6f)) }
                            if (q.desc.isNotEmpty()) Box(Modifier.height(pxDp(36 * k, den))) { ItemText(q.desc, 13 * k, FontWeight.SemiBold, txt.copy(alpha = 0.85f), lines = 2) }
                            for ((o, have, done, _) in q.objs) Box(Modifier.height(pxDp(20 * k, den))) { ItemText("${if (done) "✓" else "○"} ${o.label}${if (o.n > 1) "  $have/${o.n}" else ""}", 13 * k, c = if (done) dn else txt) }
                            if (q.rewards.isNotEmpty()) Box(Modifier.height(pxDp(22 * k, den))) { ItemText("Rewards: ${q.rewards}", 12.5 * k, c = acc) }
                            Spacer(Modifier.weight(1f))
                            if (btn.isNotEmpty()) Box(Modifier.padding(bottom = pxDp(10 * k, den)).width(pxDp(120 * k, den)).height(pxDp(28 * k, den)).background(acc.copy(alpha = 0.22f), RoundedCornerShape(pxDp(14 * k, den))), contentAlignment = Alignment.Center) { ItemText(btn, 12.5 * k, FontWeight.ExtraBold, acc) }
                        }
                    }
                    y += hh + 6 * k
                }
            }
        }
    }
}


// makeComponent: "triggers" -> Triggers(p), "fsm" -> StateMachine(p), "graph" -> VisualScript(p),
// imports: (all already in PocketGame.kt) androidx.compose.ui.geometry.Offset, androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.drawscope.DrawScope, androidx.compose.ui.input.key.Key, kotlin.math.*, kotlin.random.Random
// ---------------------------------------------------------------------------------------------------------------
// Logic: Triggers, State Machine and Visual Script, with Pocket Engine's shared logic library (events, conditions,
// instructions). Other systems (inventory, quests, dialogue…) can add instructions and conditions of their own:
//   g.systems["actions"]    : MutableMap<String, (LogicCtx, Map<String, Any?>) -> Any?>  (return like an instruction)
//   g.systems["conditions"] : MutableMap<String, (LogicCtx, Map<String, Any?>) -> Boolean>
// Sign-in, cloud data, purchases, online play and phone permissions are in the web build; here those instructions send
// their name as a message (g.send) so the rest of the game can react.
// ---------------------------------------------------------------------------------------------------------------

/** JS-style values: true counts as 1, text is read as a number. */
fun lnum(v: Any?): Double = when (v) { is Boolean -> if (v) 1.0 else 0.0; is Number -> v.toDouble(); null -> 0.0; else -> v.toString().trim().toDoubleOrNull() ?: 0.0 }
/** Is it "true"? (0, empty text, false and nothing are not) */
fun ltruthy(v: Any?): Boolean = when (v) { null -> false; is Boolean -> v; is Number -> v.toDouble() != 0.0 && !v.toDouble().isNaN(); is String -> v.isNotEmpty(); else -> true }
/** A value as text: 3.0 → "3", lists as "a, b". */
fun ltext(v: Any?): String = when (v) {
    null -> ""
    is Number -> { val r = (v.toDouble() * 10000).roundToLong() / 10000.0; if (r == floor(r) && abs(r) < 1e15) r.toLong().toString() else r.toString() }
    is List<*> -> v.joinToString(", ") { ltext(it) }
    else -> v.toString()
}
fun lsame(a: Any?, b: Any?) = ltext(a) == ltext(b)
/** "12" → 12, "sword" stays text. */
fun lval(v: Any?): Any { val t = ltext(v); val n = t.trim().toDoubleOrNull(); return if (t.trim().isNotEmpty() && n != null) n else t }
fun lcmp(a: Double, op: String, b: Double): Boolean = when (op) { "=", "==" -> a == b; "≠", "!=" -> a != b; ">" -> a > b; "<" -> a < b; "≥", ">=" -> a >= b; "≤", "<=" -> a <= b; else -> false }
/** A list kept in a game variable. */
fun lvarList(g: PocketGame, name: String): List<Any?> { val v = g.vars[name]; return if (v is List<*>) v.toList() else if (v == null || v == "" || v == 0.0) emptyList() else listOf(v) }
/** A dictionary kept in a game variable. */
fun lvarMap(g: PocketGame, name: String): Map<String, Any?> { val v = g.vars[name]; return if (v is Map<*, *>) v.entries.associate { it.key.toString() to it.value } else emptyMap() }
/** An object by name, else the nearest with that tag (never e itself). */
fun lnearest(g: PocketGame, e: GameObject, key: String): GameObject? {
    if (key.isEmpty()) return null
    g.objects.firstOrNull { !it.dead && it !== e && (it.name == key || it.id == key) }?.let { return it }
    var best: GameObject? = null; var bd = Double.POSITIVE_INFINITY
    for (o in g.objects) { if (o === e || o.dead || !o.has(key)) continue; val d = ldist(o, e); if (d < bd) { bd = d; best = o } }
    return best
}
fun ldist(a: GameObject, b: GameObject) = hypot(a.x - b.x, a.y - b.y)

private val keyNames: Map<Key, String> by lazy {
    mapOf(Key.Spacebar to "space", Key.Enter to "enter", Key.Escape to "escape", Key.Tab to "tab", Key.Backspace to "backspace",
        Key.DirectionUp to "arrowup", Key.DirectionDown to "arrowdown", Key.DirectionLeft to "arrowleft", Key.DirectionRight to "arrowright",
        Key.ShiftLeft to "shift", Key.ShiftRight to "shift", Key.CtrlLeft to "control", Key.CtrlRight to "control",
        Key.A to "a", Key.B to "b", Key.C to "c", Key.D to "d", Key.E to "e", Key.F to "f", Key.G to "g", Key.H to "h", Key.I to "i", Key.J to "j", Key.K to "k", Key.L to "l", Key.M to "m",
        Key.N to "n", Key.O to "o", Key.P to "p", Key.Q to "q", Key.R to "r", Key.S to "s", Key.T to "t", Key.U to "u", Key.V to "v", Key.W to "w", Key.X to "x", Key.Y to "y", Key.Z to "z",
        Key.Zero to "0", Key.One to "1", Key.Two to "2", Key.Three to "3", Key.Four to "4", Key.Five to "5", Key.Six to "6", Key.Seven to "7", Key.Eight to "8", Key.Nine to "9")
}
/** A keyboard key by the engine's name: space, a, arrowup, enter… */
fun lkeyName(k: Key): String = keyNames[k] ?: k.toString().lowercase().replace(" ", "")
fun lkeyWant(v: Any?): String { val s = ltext(v).trim().lowercase(); return if (s == " ") "space" else s.replace(" ", "") }
/** Put inputs into steps: "@amount" becomes the value; "{@amount}" inside text is replaced. */
fun lbind(v: Any?, args: Map<String, Any?>): Any? = when (v) {
    is String -> {
        val m = Regex("^@(\\w+)$").find(v)
        if (m != null && args.containsKey(m.groupValues[1])) args[m.groupValues[1]]
        else if (v.contains("{@")) Regex("\\{@(\\w+)\\}").replace(v) { a -> if (args.containsKey(a.groupValues[1])) ltext(args[a.groupValues[1]]) else a.value } else v
    }
    is List<*> -> v.map { lbind(it, args) }
    is Map<*, *> -> v.entries.associate { it.key.toString() to lbind(it.value, args) }
    else -> v
}
/** The local hour, minute… (UTC on this runtime: phones without a time-zone library). */
private fun lclock(): IntArray { val ms = nowMs().toLong(); val s = ms / 1000; val d = dayOf(ms).split("-").map { it.toIntOrNull() ?: 0 }; val days = ms / 86_400_000L
    return intArrayOf(((s / 3600) % 24).toInt(), ((s / 60) % 60).toInt(), (s % 60).toInt(), (((days + 4) % 7 + 7) % 7).toInt(), d.getOrElse(2) { 1 }, d.getOrElse(1) { 1 }, d.getOrElse(0) { 1970 }) }

/** Logic happenings shared between objects (Run trigger, custom events, state changes, object variables). */
class LogicBus {
    val subs = mutableListOf<(String, List<Any?>) -> Unit>()
    fun emit(type: String, args: List<Any?> = emptyList()) { subs.toList().forEach { it(type, args) } }
    companion object { fun of(g: PocketGame): LogicBus = g.systems.getOrPut("logicBus") { LogicBus() } as LogicBus }
}

/** What an instruction returns to its list: wait until this is true. */
class LUntil(val test: () -> Boolean)
/** What an instruction returns to its list: go to step i. */
class LGoto(val i: Int)

/** One run of an instruction list: who runs it, who else is involved, the value that came with the event. */
class LogicCtx(val g: PocketGame, val e: GameObject, var other: GameObject? = null, var eventValue: Any? = null, var afterDeath: Boolean = false) {
    var cancelled = false; var done = false
    var at = 0; var depth = 0
    val reps = mutableMapOf<Int, Int>()
    fun sub() = LogicCtx(g, e, other, eventValue, afterDeath).also { it.depth = depth + 1 }
}

/** A setting with the library's default. */
fun logicWith(lib: String, it: Map<*, *>): MutableMap<String, Any?> {
    val p = it.entries.associate { e -> e.key.toString() to e.value }.toMutableMap()
    logicDefaults[lib]?.get(it["type"].toString())?.forEach { (k, v) -> if (!p.containsKey(k)) p[k] = v }
    return p
}

/** Run an instruction list in order; a wait pauses it (game time); c.cancelled stops it. */
fun runInstructions(list: List<*>?, c: LogicCtx, done: (() -> Unit)? = null) {
    val steps = list ?: emptyList<Any?>()
    var i = 0
    lateinit var next: () -> Unit
    next = next@{
        while (i < steps.size) {
            if (c.cancelled || (c.e.dead && !c.afterDeath)) return@next
            val it = steps[i++]
            if (it !is Map<*, *> || it["off"] == true) continue
            c.at = i - 1
            var r: Any? = null
            try { r = logicAction(c, logicWith("ac", it)) } catch (err: Throwable) { println("Pocket: ${it["type"]} failed: $err") }
            if (r == "stop") break
            if (r is LGoto) { i = r.i; continue }
            if (r is Number && r.toDouble() > 0) { c.g.after(r.toDouble(), next); return@next }
            if (r is LUntil) {
                val u = r
                lateinit var poll: () -> Unit
                poll = { if (!c.cancelled) { if (u.test()) next() else c.g.after(0.05, poll) } }
                c.g.after(0.05, poll)
                return@next
            }
        }
        c.done = true
        done?.invoke()
    }
    next()
}

/** Do all the conditions pass (or any of them)? Each can be flipped with "not". */
fun logicConditionsPass(list: List<*>?, c: LogicCtx, any: Boolean = false): Boolean {
    val l = list ?: emptyList<Any?>()
    if (any && l.isNotEmpty()) return l.any { logicConditionsPass(listOf(it), c) }
    for (cd in l) {
        if (cd !is Map<*, *>) continue
        val ok = logicCondition(c, logicWith("cd", cd))
        if (ok == (cd["not"] == true)) return false
    }
    return true
}

private fun ltarget(c: LogicCtx, name: Any?): GameObject? {
    val n = ltext(name)
    if (n.isEmpty() || n == "self" || n == "this") return c.e
    if (n == "other") return c.other
    return c.g.find(n)
}

@Suppress("UNCHECKED_CAST")
private fun extCondition(g: PocketGame, type: String): ((LogicCtx, Map<String, Any?>) -> Boolean)? = (g.systems["conditions"] as? Map<String, Any?>)?.get(type) as? (LogicCtx, Map<String, Any?>) -> Boolean
@Suppress("UNCHECKED_CAST")
private fun extAction(g: PocketGame, type: String): ((LogicCtx, Map<String, Any?>) -> Any?)? = (g.systems["actions"] as? Map<String, Any?>)?.get(type) as? (LogicCtx, Map<String, Any?>) -> Any?

/** One condition of the logic library. */
fun logicCondition(c: LogicCtx, p: Map<String, Any?>): Boolean {
    val g = c.g; val e = c.e; val type = p["type"].toString()
    extCondition(g, type)?.let { return it(c, p) }
    fun v(k: String) = lnum(p[k])
    fun s(k: String) = ltext(p[k])
    return when (type) {
        "variable" -> lcmp(g.numVar(s("name")), s("op"), v("value"))
        "chance" -> Random.nextDouble() * 100 < v("percent")
        "touching" -> g.touching(e) { it.has(s("tag")) }.isNotEmpty()
        "grounded" -> e.body?.grounded ?: false
        "near" -> { val t = g.findAll(s("tag")).firstOrNull { it !== e }; val d = if (t == null) Double.POSITIVE_INFINITY else ldist(t, e); if (s("op") == ">") d > v("value") else d < v("value") }
        "canSee" -> { val t = g.findAll(s("tag")).firstOrNull { it !== e }; t != null && g.canSee(e, t) }
        "exists" -> g.find(s("object")) != null
        "visible" -> (if (s("object").isEmpty()) e else g.find(s("object")))?.visible ?: false
        "state" -> (e.data["state"]?.toString() ?: "") == s("state")
        "anySave" -> g.hasSave(1) || g.hasSave(2) || g.hasSave(3)
        "hasSave" -> g.hasSave(if (v("slot") <= 0) 1 else v("slot").toInt())
        "hasItem" -> { val need = if (v("count") <= 0) 1.0 else v("count"); g.numVar("item_${s("item")}") >= need || lvarList(g, "inventory").count { lsame(it, s("item")) } >= need }
        "playing" -> g.state == "play" && !g.paused
        "compareVars" -> lcmp(g.numVar(s("a")), s("op"), g.numVar(s("b")))
        "myVar" -> lcmp(lnum(e.data[s("name")]), s("op"), v("value"))
        "textVar" -> { val a = ltext(g.vars[s("name")]).lowercase(); val t = s("text").lowercase(); when (s("op")) { "contains" -> a.contains(t); "starts with" -> a.startsWith(t); "is empty" -> a.isBlank(); else -> a == t } }
        "health" -> { val hp = lnum(e.data["hp"]); val mx = lnum(e.data["hpMax"]); val value = if (onOf(p["percent"])) hp / (if (mx == 0.0) 1.0 else mx) * 100 else hp; lcmp(value, s("op"), v("value")) }
        "need" -> { val cur = e.data[s("need")] ?: return false; val mx = lnum(e.data["${s("need")}Max"]); lcmp(if (onOf(p["percent"], true)) lnum(cur) / (if (mx == 0.0) 100.0 else mx) * 100 else lnum(cur), s("op"), v("value")) }
        "hasStatus" -> if (s("effect") == "any") (e.data["status"]?.toString() ?: "").isNotEmpty() else (e.data["status"]?.toString() ?: "").split(",").contains(s("effect"))
        "shieldUp" -> lcmp(lnum(e.data["hpShield"]), s("op"), v("value"))
        "tagCount" -> lcmp(g.findAll(s("tag")).size.toDouble(), s("op"), v("value"))
        "moving" -> { val b = e.body; b != null && hypot(b.vx, b.vy) > v("speed") }
        "level" -> lcmp(if (g.numVar("level") == 0.0) 1.0 else g.numVar("level"), s("op"), v("value"))
        "timeIn" -> lcmp(g.time, s("op"), v("value"))
        "portrait" -> g.screen.height >= g.screen.width
        "listHas" -> lvarList(g, s("list")).any { lsame(it, lval(s("value"))) }
        "listCount" -> lcmp(lvarList(g, s("list")).size.toDouble(), s("op"), v("value"))
        "dictHas" -> lvarMap(g, s("dict")).containsKey(s("key"))
        "pageIs" -> lsame(g.vars["page"], s("page"))
        "keyHeld" -> g.keys.any { lkeyName(it) == lkeyWant(p["key"]) }
        "screenHeld" -> g.pointers.values.any { it.role == "free" }
        "online" -> true
        "hour" -> lcmp(lclock()[0].toDouble(), s("op"), v("value"))
        "objVar" -> { val t = ltarget(c, p["object"]); t != null && lcmp(lnum(t.data[s("name")]), s("op"), v("value")) }
        "eventValue" -> {
            val ev = c.eventValue; val a = ltext(ev).toDoubleOrNull(); val b = s("value").trim().toDoubleOrNull()
            if (a != null && b != null && s("value").trim().isNotEmpty()) lcmp(a, s("op"), b) else (s("op") == "≠") != lsame(ev, p["value"])
        }
        "isPlayerTurn" -> g.vars["playerTurn"] != false && g.vars["playerTurn"] != 0.0
        "unitCount" -> { val k = when (s("which")) { "yours" -> "unitsLeft"; "enemy" -> "enemiesLeft"; "ready this turn" -> "unitsReady"; else -> "selectedUnits" }; lcmp(g.numVar(k), s("op"), v("value")) }
        "funcResult" -> {
            val t = if (s("on") == "other") c.other else if (s("on") == "this object") e else lnearest(g, e, s("object"))
            val r = t?.part<VisualScript>()?.callFn(s("name"), mapOf("a" to 0.0, "b" to 0.0, "c" to 0.0), e, null)
            lcmp(r?.second ?: 0.0, s("op"), v("value"))
        }
        "custom" -> {
            val def = (g.json["customConditions"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().firstOrNull { it["id"] == p["ref"] }
            if (def == null || c.depth > 12) false
            else logicConditionsPass(lbind(def["conditions"] ?: emptyList<Any?>(), customArgs(def, p)) as? List<*>, c.sub())
        }
        else -> false // (signed in, data counts, quests, permissions…: the web build)
    }
}

private fun customArgs(def: Map<*, *>, p: Map<String, Any?>): Map<String, Any?> =
    (def["params"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().associate { q ->
        val v = p[q["key"].toString()] ?: q["default"] ?: ""
        q["key"].toString() to (if (q["type"] == "number" && v.toString().toDoubleOrNull() != null) v.toString().toDouble() else v)
    }

private fun hexOf(c: Color): String { val r = (c.red * 255).roundToInt(); val gg = (c.green * 255).roundToInt(); val b = (c.blue * 255).roundToInt(); return "#" + ((r shl 16) or (gg shl 8) or b).toString(16).padStart(6, '0') }

/** Colour of an object (its shape fill, or its text) eased to another over some seconds. */
fun lfadeColor(g: PocketGame, t: GameObject, color: String, seconds: Double) {
    val key = if (t.shape != null) "fill" else "color"
    val map = t.shape ?: t.text ?: return // (an object with neither has no colour to change)
    val from = parseColor(map[key]) ?: Color.White; val to = parseColor(color) ?: Color.White
    if (seconds <= 0.01) { map[key] = color; return }
    val t0 = g.time
    lateinit var tick: () -> Unit
    tick = {
        if (!t.dead) {
            val k = ((g.time - t0) / seconds).coerceIn(0.0, 1.0)
            map[key] = hexOf(mixColor(from, to, k))
            if (k < 1) g.after(1.0 / 60, tick) else map[key] = color
        }
    }
    tick()
}

/** A colour covering the screen: fades in, holds, fades out (screen fades). */
fun lscreenFade(g: PocketGame, color: Color, a: Double, hold: Double, b: Double) {
    val t0 = g.time
    lateinit var draw: DrawScope.() -> Unit
    draw = {
        val t = g.time - t0
        val k = if (t < a) t / a else if (t < a + hold) 1.0 else 1 - (t - a - hold) / b
        if (t > a + hold + b) g.after(0.0) { g.overlays.remove(draw) }
        else if (k > 0) drawRect(color.copy(alpha = k.coerceIn(0.0, 1.0).toFloat()), size = size)
    }
    g.overlays.add(draw)
}

/** "Punch": out by an amount and back (scale, position or rotation). */
fun lpunch(g: PocketGame, t: GameObject, what: String, a: Double, d: Double) {
    when (what) {
        "scale" -> { g.tween(t, "sx", t.sx * (1 + a), d, "outQuad", yoyo = true); g.tween(t, "sy", t.sy * (1 + a), d, "outQuad", yoyo = true) }
        "rotation" -> g.tween(t, "rz", t.rz + a * 90, d, "outQuad", yoyo = true)
        else -> g.tween(t, "y", t.y - a * 60, d, "outQuad", yoyo = true)
    }
}

/** Instructions that only the web build can do (sign-in, cloud data, purchases, online, phone permissions…): here they send their name as a message. */
private val webOnlyActions = setOf(
    "supaSignIn", "supaSignUp", "supaSignOut", "supaReset", "supaSaveProfile", "supaLoadProfile", "buyProduct", "restorePurchases", "supaRpc", "supaEdge", "supaRefresh",
    "dataAdd", "dataSet", "dataDelete", "dataOpen", "dataClear", "dataToVar", "playGame", "backToApp", "openMods", "askPermission", "phoneNotify", "notify", "openUrl",
    "copyText", "shareText", "askText", "music", "goLevel", "loadNewest", "deleteAllSaves", "squadSelect", "squadMove", "squadStop", "endTurn", "questStart", "questComplete",
    "questFail", "questAdvance", "questReset", "startDialogue", "useItemFx", "equipItem", "craftItem", "learnRecipe", "dropItem", "lootRoll", "invManage", "npcSay", "cure",
    "statusFx", "healthSet", "eat", "setImage", "playAnim", "slowMo", "log",
)

/** One instruction of the logic library. Returns null (go on), "stop", seconds to wait, LUntil (wait until) or LGoto. */
fun logicAction(c: LogicCtx, p: Map<String, Any?>): Any? {
    val g = c.g; val e = c.e; val type = p["type"].toString()
    extAction(g, type)?.let { return it(c, p) }
    fun v(k: String) = lnum(p[k])
    fun s(k: String) = ltext(p[k])
    fun filled(k: String) = g.fill(s(k), e)
    fun wait() = onOf(p["wait"])
    fun op(cur: Double, value: Double) = when (s("op")) { "set" -> value; "subtract" -> cur - value; "multiply" -> cur * value; else -> cur + value }
    when (type) {
        // variables
        "setVar" -> { val k = s("name").ifEmpty { "score" }; g.setVar(k, op(g.numVar(k), v("value"))) }
        "toggleVar" -> g.setVar(s("name"), if (g.numVar(s("name")) != 0.0) 0.0 else 1.0)
        "randomVar" -> { val a = v("min"); val b = v("max"); val whole = onOf(p["whole"], true); val r = a + Random.nextDouble() * (b - a + (if (whole) 1 else 0)); g.setVar(s("name"), if (whole) floor(r) else (r * 100).roundToLong() / 100.0) }
        "textVar" -> g.setVar(s("name"), g.fill(s("text")))
        "myVar" -> {
            val t = ltarget(c, p["object"]) ?: return null
            t.data[s("name")] = op(lnum(t.data[s("name")]), v("value"))
            LogicBus.of(g).emit("myvar", listOf(t, s("name"), t.data[s("name")]))
        }
        "saveKey" -> store("pocket.var.${g.saveKey}.${s("file")}.${s("name")}", toJsonValue(g.vars[s("name")] ?: 0.0).toString())
        "loadKey" -> stored("pocket.var.${g.saveKey}.${s("file")}.${s("name")}")?.let { g.setVar(s("name"), parseJson(it)) }
        "giveItem" -> {
            val item = s("item"); val n = v("amount")
            g.addVar("item_$item", n)
            val inv = lvarList(g, "inventory").toMutableList()
            if (n > 0) repeat(n.roundToInt()) { inv.add(item) } else repeat((-n).roundToInt()) { inv.remove(item) }
            g.setVar("inventory", inv)
        }
        // objects
        "showHide" -> ltarget(c, p["object"])?.let { it.visible = if (s("mode") == "show") true else if (s("mode") == "hide") false else !it.visible }
        "destroy" -> ltarget(c, p["object"])?.let { if (onOf(p["burst"], true)) g.burst(it.x, it.y, Color.White, 14); it.destroy() }
        "destroyTag" -> for (t in g.findAll(s("tag"))) { if (onOf(p["burst"], true)) g.burst(t.x, t.y, Color(0xFFFFD23F), 10); t.destroy() }
        "spawn" -> { val t = (if (s("at") == "other") c.other else null) ?: e; if (s("template").isNotEmpty()) g.spawn(s("template"), t.x + v("ox"), t.y + v("oy")) }
        "setText" -> ltarget(c, p["object"])?.text?.let { it["value"] = s("text") }
        "setColor" -> ltarget(c, p["object"])?.let { lfadeColor(g, it, s("color"), v("seconds")) }
        "teleport" -> g.find(s("to"))?.let { e.x = it.x; e.y = it.y }
        "tagAdd" -> {
            val t = ltarget(c, p["object"]) ?: return null
            if (s("tag").isEmpty()) return null
            val has = s("tag") in t.tags; val on = if (s("mode") == "toggle") !has else s("mode") != "remove"
            if (on) t.tags.add(s("tag")) else t.tags.remove(s("tag"))
        }
        "damage" -> {
            val t = ltarget(c, p["object"] ?: "other") ?: return null
            val hb = t.part<Health>() ?: return null
            val n = v("amount")
            if (n < 0) hb.heal(t, g, -n) else hb.damage(t, g, n, from = e, type = if (s("dtype") == "normal") "" else s("dtype"), pierce = onOf(p["pierce"]))
        }
        "invulnerable" -> ltarget(c, p["object"])?.invuln = v("seconds")
        // motion
        "moveBy" -> {
            val d = v("seconds")
            if (d <= 0) { e.x += v("x"); e.y += v("y"); return null }
            g.tween(e, "x", e.x + v("x"), d, s("ease")); g.tween(e, "y", e.y + v("y"), d, s("ease"))
            return if (wait()) d else null
        }
        "rotateBy" -> { val d = v("seconds"); if (d <= 0) { e.rz += v("degrees"); return null }; g.tween(e, "rz", e.rz + v("degrees"), d, s("ease")); return if (wait()) d else null }
        "scaleTo" -> { val d = max(0.01, v("seconds")); val k = if (v("scale") == 0.0) 1.0 else v("scale"); g.tween(e, "sx", k * sign(e.sx).let { if (it == 0.0) 1.0 else it }, d, s("ease")); g.tween(e, "sy", k, d, s("ease")); return if (wait()) d else null }
        "fade" -> { val d = max(0.01, v("seconds")); g.tween(e, "alpha", v("alpha").coerceIn(0.0, 1.0), d); return if (wait()) d else null }
        "punch" -> lpunch(g, e, s("what"), if (v("amount") == 0.0) 0.3 else v("amount"), if (v("seconds") == 0.0) 0.4 else v("seconds"))
        "setPos" -> {
            val t = ltarget(c, p["object"]) ?: return null
            if (onOf(p["relative"])) { t.x += v("x"); t.y += v("y") } else { t.x = v("x"); t.y = v("y") }
            t.body?.let { it.vx = 0.0; it.vy = 0.0 }
        }
        "glideTo" -> {
            val t = g.find(s("to")) ?: lnearest(g, e, s("to")) ?: return null
            val d = max(0.01, v("seconds"))
            g.tween(e, "x", t.x, d, s("ease")); g.tween(e, "y", t.y, d, s("ease"))
            return if (onOf(p["wait"], true)) d else null
        }
        "face" -> (g.find(s("tag")) ?: lnearest(g, e, s("tag")))?.let { e.rz = atan2(it.y - e.y, it.x - e.x) / DEG }
        // physics
        "push" -> { val t = (if (s("who") == "other") c.other else e) ?: return null; val b = t.ensureBody("dynamic"); b.vx += v("x"); b.vy += v("y") }
        "setVelocity" -> { val b = e.ensureBody("dynamic"); b.vx = v("x"); b.vy = v("y") }
        "jump" -> e.body?.let { it.vy = -v("power"); g.sfx("jump") }
        "setGravity" -> g.gravity = v("y")
        "pushToward" -> {
            val t = g.find(s("tag")) ?: lnearest(g, e, s("tag")) ?: return null
            val b = e.ensureBody("dynamic"); val dx = t.x - e.x; val dy = t.y - e.y; val l = max(1e-6, hypot(dx, dy)); val k = v("power") * (if (onOf(p["away"])) -1 else 1)
            b.vx += dx / l * k; b.vy += dy / l * k
        }
        "stopMove" -> ltarget(c, p["object"])?.let { t -> t.body?.let { it.vx = 0.0; it.vy = 0.0 }; g.killTweens(t) }
        // flow
        "wait" -> return max(0.0, v("seconds"))
        "waitRandom" -> return max(0.0, v("min") + Random.nextDouble() * max(0.0, v("max") - v("min")))
        "waitUntil" -> return LUntil { lcmp(g.numVar(s("name")), s("op"), v("value")) }
        "onlyIf" -> return if (lcmp(g.numVar(s("name")), s("op"), v("value"))) null else "stop"
        "repeat" -> {
            val n = (c.reps[c.at] ?: 0) + 1
            c.reps[c.at] = n
            if (n <= v("times").roundToInt().coerceIn(0, 1000)) return LGoto(0)
            c.reps[c.at] = 0
        }
        "stop" -> return "stop"
        "runTrigger" -> LogicBus.of(g).emit("runTrigger", listOf(s("name")))
        "sendMessage" -> g.send(s("message"))
        "setState" -> e.part<StateMachine>()?.goTo(e, g, s("state"))
        "callEvent" -> {
            val on = s("on"); val tag = s("object"); val named = if (on == "object named") g.find(tag) else null
            val who: (GameObject) -> Boolean = when (on) { "other" -> { q -> q === c.other }; "all with tag", "first with tag" -> { q -> q.has(tag) }; "everything" -> { _ -> true }; "object named" -> { q -> q === named }; else -> { q -> q === e } }
            LogicBus.of(g).emit("graphCall", listOf(s("name"), who, e, lval(p["value"])))
        }
        "runFunction" -> {
            val on = s("on"); val tag = s("object")
            val targets: List<GameObject> = when (on) { "other" -> listOfNotNull(c.other); "all with tag" -> g.findAll(tag); "first with tag" -> g.findAll(tag).take(1); "object named" -> listOfNotNull(g.find(tag)); "everything" -> g.objects.toList(); else -> listOf(e) }
            for (t in targets) { val r = t.part<VisualScript>()?.callFn(s("name"), mapOf("a" to v("a"), "b" to v("b"), "c" to 0.0), e, null); if (r != null && r.first && s("store").isNotEmpty()) g.setVar(s("store"), r.second) }
        }
        "custom" -> {
            val def = (g.json["customActions"] as? List<*>).orEmpty().filterIsInstance<Map<*, *>>().firstOrNull { it["id"] == p["ref"] }
            if (def == null || c.depth > 12) return null
            val sub = c.sub()
            var fin = false
            runInstructions(lbind(def["actions"] ?: emptyList<Any?>(), customArgs(def, p)) as? List<*>, sub) { fin = true }
            return if (fin || p["wait"] == false) null else LUntil { fin }
        }
        // camera
        "switchCamera", "camLive" -> g.send("camera:${s("camera")}")
        "camFollow" -> g.systems["camFollow"] = s("tag").ifEmpty { null }
        "camZoom" -> {
            val cam = if (s("camera").isNotEmpty()) g.find(s("camera")) else g.activeCamera; val z = v("zoom")
            if (cam != null) { if (z == 0.0) cam.data.remove("camZoom") else cam.data["camZoom"] = z } else g.camZoom = if (z == 0.0) 1.0 else z
        }
        "screenFade" -> {
            val a = max(0.01, v("out")); val h = max(0.0, v("hold")); val b = max(0.01, v("in"))
            lscreenFade(g, parseColor(p["color"]) ?: Color.Black, a, h, b)
            return if (onOf(p["wait"], true)) a + h else null
        }
        "shake" -> g.shake = max(g.shake, if (v("strength") == 0.0) 10.0 else v("strength"))
        // game
        "message" -> g.message(s("text"), if (v("seconds") == 0.0) 2.0 else v("seconds"))
        "snackbar" -> g.message(s("text"), if (v("seconds") == 0.0) 4.0 else v("seconds"))
        "toast" -> g.popText(g.screenOf(e), filled("text"), parseColor(p["color"]) ?: Color.White, 26.0)
        "talk" -> { g.message((if (s("who").isEmpty()) "" else "${s("who")}: ") + s("text"), 3.0); return if (onOf(p["wait"], true)) 3.0 else null }
        "sound" -> g.sfx(s("sound"))
        "vibrate", "haptic" -> g.buzz(s("style") == "heavy" || s("style") == "error")
        "save" -> if (g.saveGame(if (v("slot") <= 0) 1 else v("slot").toInt())) g.message("Game saved", 1.2)
        "load" -> g.loadGame(if (v("slot") <= 0) 1 else v("slot").toInt())
        "win", "nextLevel" -> g.win()
        "gameOver" -> g.gameOver()
        "restart" -> { g.start(); return "stop" }
        "pauseGame" -> g.paused = if (s("mode") == "pause") true else if (s("mode") == "resume") false else !g.paused
        "burst" -> { val t = if (s("at") == "other") c.other else e; if (t != null) g.burst(t.x, t.y, parseColor(p["color"]) ?: Color(0xFFFFD23F), v("count").coerceIn(1.0, 200.0).toInt()) }
        "setPage" -> g.setVar("page", s("page"))
        // lists
        "listAdd" -> {
            val a = lvarList(g, s("list")).toMutableList(); val value = lval(g.fill(s("value")))
            if (onOf(p["unique"]) && a.any { lsame(it, value) }) return null
            if (s("where") == "at the start") a.add(0, value) else a.add(value)
            g.setVar(s("list"), a)
        }
        "listRemove" -> {
            val a = lvarList(g, s("list")).toMutableList(); val value = lval(p["value"])
            when (s("mode")) {
                "last" -> if (a.isNotEmpty()) a.removeAt(a.size - 1)
                "first" -> if (a.isNotEmpty()) a.removeAt(0)
                "all of this value" -> a.removeAll { lsame(it, value) }
                else -> { val i = a.indexOfFirst { lsame(it, value) }; if (i >= 0) a.removeAt(i) }
            }
            g.setVar(s("list"), a)
        }
        "listClear" -> {
            val a = lvarList(g, s("list")).toMutableList()
            when (s("do")) {
                "shuffle" -> a.shuffle()
                "sort up" -> a.sortBy { lnum(it) }
                "sort down" -> a.sortByDescending { lnum(it) }
                "reverse" -> a.reverse()
                else -> a.clear()
            }
            g.setVar(s("list"), a)
        }
        "listPick" -> { val a = lvarList(g, s("list")); if (a.isEmpty()) return null; g.setVar(s("into"), if (s("which") == "first") a.first() else if (s("which") == "last") a.last() else a[Random.nextInt(a.size)]) }
        "mapSet" -> { val m = lvarMap(g, s("dict")).toMutableMap(); val value = lval(g.fill(s("value"))); m[s("key")] = if (s("op") == "add") lnum(m[s("key")]) + lnum(value) else value; g.setVar(s("dict"), m) }
        "mapRemove" -> { val m = if (s("key").isEmpty()) mutableMapOf() else lvarMap(g, s("dict")).toMutableMap(); m.remove(s("key")); g.setVar(s("dict"), m) }
        else -> if (type in webOnlyActions) g.send(type)
    }
    return null
}

/** Something that happened to an object this frame (for matching against logic events). */
class LogicEv(val type: String, val other: GameObject? = null, val value: Any? = null, val name: String = "", val item: String = "")
/** A matched event: who else was involved and the value that came with it. */
class LogicHit(val other: GameObject? = null, val value: Any? = null)

/** Watches what happens to an object each frame (taps, touches, messages, keys, buttons, variables, health…) for logic events. */
class LogicWatcher(val e: GameObject, val g: PocketGame, var contacts: Boolean = false) {
    var queue = mutableListOf<LogicEv>(); var now = listOf<LogicEv>()
    val timers = mutableMapOf<String, Double>()
    val edges = mutableMapOf<String, Any?>()
    var first = true
    var age = 0.0; var dt = 0.0; var lastTap = -9.0
    private val vars = mutableMapOf<String, String>()
    private val keysSeen = mutableSetOf<Key>()
    private var touchingNow = setOf<GameObject>()
    private var hpWas: Double? = null
    private var died = false

    init {
        g.on { m ->
            if (!e.dead) {
                queue.add(LogicEv("message", name = m))
                if (m == "won") queue.add(LogicEv("win"))
                if (m == "game over") queue.add(LogicEv("lose"))
            }
        }
        LogicBus.of(g).subs.add { type, a ->
            if (!e.dead) {
                @Suppress("UNCHECKED_CAST")
                when {
                    type == "runTrigger" -> queue.add(LogicEv("called", name = ltext(a[0])))
                    type == "graphCall" && (a[1] as (GameObject) -> Boolean)(e) -> queue.add(LogicEv("called", name = ltext(a[0]), other = a[2] as GameObject?, value = a[3]))
                    type == "state" && a[0] === e -> queue.add(LogicEv("stateEntered", name = ltext(a[1])))
                    type == "animEnd" && a[0] === e -> queue.add(LogicEv("animEnd", name = ltext(a[1])))
                }
            }
        }
        for ((k, v) in g.vars) vars[k] = ltext(v)
    }

    fun push(ev: LogicEv) { queue.add(ev) }

    fun frame(dt: Double) {
        val ev = queue
        queue = mutableListOf()
        this.dt = dt
        age += dt
        if (e.shown && g.tapsOn(e).isNotEmpty()) {
            ev.add(LogicEv("tap"))
            if (g.time - lastTap < 0.35) { ev.add(LogicEv("doubleTap")); lastTap = -9.0 } else lastTap = g.time
        }
        for (k in g.keys) if (k !in keysSeen) ev.add(LogicEv("key", name = lkeyName(k)))
        keysSeen.clear(); keysSeen.addAll(g.keys)
        if ("jump" in g.pressed) ev.add(LogicEv("button", name = "jump"))
        if ("action" in g.pressed) ev.add(LogicEv("button", name = "fire"))
        for (d in listOf("up", "down", "left", "right")) if ("swipe:$d" in g.pressed) ev.add(LogicEv("swipe", name = d))
        if (first) { ev.add(LogicEv("start")); first = false }
        // variables that changed
        for ((k, v) in g.vars.entries.toList()) {
            val t = ltext(v)
            if (vars[k] != t) { ev.add(LogicEv("varChanged", name = k)); if (k == "page") ev.add(LogicEv("pageChanged", name = t)); vars[k] = t }
        }
        // health: damage, healing, death
        val hp = e.data["hp"]
        if (hp is Number) {
            val h = hp.toDouble(); val was = hpWas
            if (was != null && h < was) ev.add(LogicEv("damaged", value = ((was - h) * 100).roundToLong() / 100.0, name = "normal"))
            if (was != null && h > was) ev.add(LogicEv("healed", value = ((h - was) * 100).roundToLong() / 100.0))
            hpWas = h
        }
        val dead = e.part<Health>()?.dead ?: false
        if (dead && !died) ev.add(LogicEv("died"))
        died = dead
        // touches that started and ended
        if (contacts && !e.ui) {
            val cur = g.objects.filter { it !== e && !it.dead && !it.ui && PocketGame.overlap(e, it) }.toSet()
            for (o in cur) if (o !in touchingNow) ev.add(LogicEv("touch", other = o))
            for (o in touchingNow) if (o !in cur) ev.add(LogicEv("touchEnd", other = o))
            touchingNow = cur
        }
        now = ev
    }

    private fun evOk(type: String, p: Map<String, Any?>, q: LogicEv): Boolean = when (type) {
        "touch", "touchEnd" -> q.other?.has(ltext(p["tag"])) ?: false
        "button" -> q.name == ltext(p["button"])
        "swipe" -> q.name == ltext(p["dir"])
        "message" -> q.name == ltext(p["message"])
        "animEnd" -> ltext(p["clip"]).isEmpty() || q.name == ltext(p["clip"])
        "varChanged" -> ltext(p["name"]).isEmpty() || q.name == ltext(p["name"])
        "called" -> q.name == ltext(p["name"])
        "key" -> q.name == lkeyWant(p["key"])
        "pageChanged" -> ltext(p["page"]).isEmpty() || q.name == ltext(p["page"])
        "stateEntered" -> ltext(p["state"]).isEmpty() || q.name == ltext(p["state"])
        "damaged" -> ltext(p["dtype"]).isEmpty() || p["dtype"] == "any" || q.name == p["dtype"]
        else -> true
    }

    /** Did this event happen? key: the listener's own timer / edge state; stateTime / finished: for state machines. */
    fun match(x: Map<*, *>, key: String, stateTime: Double = 0.0, finished: Boolean = false): LogicHit? {
        val p = logicWith("ev", x); val type = "${x["type"]}"
        when (type) {
            "every" -> {
                val t = (timers[key] ?: 0.0) + dt
                if (t >= max(0.05, if (lnum(p["seconds"]) == 0.0) 1.0 else lnum(p["seconds"]))) { timers[key] = 0.0; return LogicHit() }
                timers[key] = t; return null
            }
            "variable" -> { val on = lcmp(g.numVar(ltext(p["name"])), ltext(p["op"]), lnum(p["value"])); val was = edges[key] == true; edges[key] = on; return if (on && !was) LogicHit() else null }
            "always" -> return LogicHit()
            "delay" -> { if (edges[key] == true || age < lnum(p["seconds"])) return null; edges[key] = true; return LogicHit() }
            "random" -> return if (Random.nextDouble() < dt / max(0.1, if (lnum(p["seconds"]) == 0.0) 3.0 else lnum(p["seconds"]))) LogicHit() else null
            "landed" -> {
                val b = e.body; val gr = b?.grounded ?: false; val was = edges[key]
                edges[key] = gr
                return if ((b?.landed ?: 0.0) > 0 || (gr && was == false)) LogicHit(value = (b?.landed ?: 0.0).roundToInt()) else null
            }
            "near", "sees" -> {
                val t = lnearest(g, e, ltext(p["tag"]))
                val on = t != null && (if (type == "near") ldist(t, e) < (if (lnum(p["distance"]) == 0.0) 120.0 else lnum(p["distance"])) else g.canSee(e, t))
                val was = edges[key] == true; edges[key] = on
                return if (on && !was) LogicHit(other = t) else null
            }
            "longPress" -> {
                val secs = if (lnum(p["seconds"]) == 0.0) 0.6 else lnum(p["seconds"])
                val held = g.pointers.values.firstOrNull { it.role != "stick" && it.role != "button" && g.time - it.t0 >= secs && g.hitsAt(e, it.at) }
                if (held == null) { edges.remove(key); return null }
                if (edges[key] == held.id) return null
                edges[key] = held.id; return LogicHit()
            }
            "after" -> return if (stateTime >= lnum(p["seconds"])) LogicHit() else null
            "finished" -> return if (finished) LogicHit() else null
            else -> {
                val hit = now.firstOrNull { it.type == type && evOk(type, p, it) }
                return if (hit == null) null else LogicHit(hit.other, hit.value)
            }
        }
    }

    /** Every match this frame (two messages in one frame run a trigger twice); timed and edge events give at most one. */
    fun matchAll(x: Map<*, *>, key: String, stateTime: Double = 0.0, finished: Boolean = false): List<LogicHit> {
        val type = "${x["type"]}"
        if (type in edgeTypes) { val m = match(x, key, stateTime, finished); return if (m == null) emptyList() else listOf(m) }
        val p = logicWith("ev", x)
        return now.filter { it.type == type && evOk(type, p, it) }.map { LogicHit(it.other, it.value) }
    }
    fun resetTimers() { timers.clear() }
    companion object { private val edgeTypes = setOf("every", "variable", "always", "after", "finished", "delay", "random", "landed", "near", "sees", "longPress") }
}

private fun lusesTouch(events: Iterable<Any?>) = events.any { it is Map<*, *> && (it["type"] == "touch" || it["type"] == "touchEnd") }
private fun lusesTap(events: Iterable<Any?>) = events.any { it is Map<*, *> && (it["type"] == "tap" || it["type"] == "doubleTap" || it["type"] == "longPress") }
@Suppress("UNCHECKED_CAST")
private fun lmapOf(v: Any?): Map<String, Any?>? = (v as? Map<*, *>)?.entries?.associate { it.key.toString() to it.value }

/** Triggers (Game Creator style): On [event] → If [conditions] → Do [instructions, one after another, with waits].
 *  Each trigger can run once or up to a number of times, have a cooldown, a delay, a chance, "any" conditions and an Else list. */
class Triggers(p: JsonMap) : Component(p) {
    private data class St(val runs: Int = 0, val last: Double = -1e9, val run: LogicCtx? = null)
    val list: List<Map<String, Any?>> = (p["triggers"] as? List<*> ?: emptyList<Any?>()).mapNotNull { lmapOf(it) }
    private val st = MutableList(list.size) { St() }
    var w: LogicWatcher? = null
    override val always: Boolean get() = true
    private val events get() = list.map { it["event"] }
    private fun watch(e: GameObject, g: PocketGame) {
        if (w == null) w = LogicWatcher(e, g, contacts = lusesTouch(events))
        if (lusesTap(events) && e.ui) g.tapTargets.add(e)
    }
    override fun start(e: GameObject, g: PocketGame) = watch(e, g)
    fun fire(i: Int, e: GameObject, g: PocketGame, other: GameObject? = null, value: Any? = null) {
        val t = list[i]; val s = st[i]
        val mx = if (t["once"] == true) 1 else lnum(t["maxRuns"]).roundToInt()
        if (mx > 0 && s.runs >= mx) return
        if (lnum(t["cooldown"]) > 0 && g.time - s.last < lnum(t["cooldown"])) return
        val ch = t["chance"]
        if (ch != null && "$ch" != "" && lnum(ch) < 100 && Random.nextDouble() * 100 >= lnum(ch)) return
        val c = LogicCtx(g, e, other = other, eventValue = value, afterDeath = e.dead)
        val ok = logicConditionsPass(t["conditions"] as? List<*>, c, any = t["match"] == "any")
        var steps: Any? = if (ok) t["actions"] else t["elseActions"]
        if (steps is List<*> && steps.toString().contains("@event")) steps = lbind(steps, mapOf("event" to (value ?: "")))
        if (!ok && (steps !is List<*> || steps.isEmpty())) return
        val running = s.run
        if (running != null && !running.done) { if (t["overlap"] == "skip") return; if (t["overlap"] == "restart") running.cancelled = true }
        st[i] = St(if (ok) s.runs + 1 else s.runs, if (ok) g.time else s.last, c)
        val go = { if (!(c.cancelled || (e.dead && !c.afterDeath))) runInstructions(steps as? List<*>, c) }
        if (lnum(t["delay"]) > 0) g.after(lnum(t["delay"]), go) else go()
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        watch(e, g)
        val w = this.w!!
        w.frame(dt)
        for (i in list.indices) {
            val t = list[i]; val ev = t["event"]
            if (t["off"] == true || ev !is Map<*, *>) continue
            if (g.state != "play" && ev["type"] !in alwaysTypes) continue
            for (hit in w.matchAll(ev, "$i")) fire(i, e, g, hit.other, hit.value)
        }
    }
    override fun gone(e: GameObject, g: PocketGame) {
        for (i in list.indices) if (list[i]["off"] != true && (list[i]["event"] as? Map<*, *>)?.get("type") == "destroyed") fire(i, e, g)
    }
    companion object { private val alwaysTypes = setOf("tap", "message", "called", "win", "lose", "varChanged", "pageChanged", "inventory") }
}

/** State Machine (PlayMaker style): the object is always in one state (Idle, Chase, Attack…). Each state runs actions when it
 *  starts (and every frame, and when it ends), and moves to another state when an event happens (After N seconds, When done…). */
class StateMachine(p: JsonMap) : Component(p) {
    val fsm: Map<String, Any?> = lmapOf(p["fsm"]) ?: mapOf("states" to emptyList<Any?>())
    val states = linkedMapOf<String, Map<String, Any?>>()
    var cur: Map<String, Any?>? = null
    var t = 0.0
    var finished = false
    var run: LogicCtx? = null
    var w: LogicWatcher? = null
    val state: String? get() = cur?.get("name") as? String
    init { for (s in fsm["states"] as? List<*> ?: emptyList<Any?>()) lmapOf(s)?.let { states["${it["id"]}"] = it } }
    private val allTransitions: List<Any?> get() = states.values.flatMap { it["transitions"] as? List<*> ?: emptyList<Any?>() } + (fsm["any"] as? List<*> ?: emptyList<Any?>())

    fun enter(id: String, e: GameObject, g: PocketGame) {
        run?.cancelled = true
        val was = cur
        if (was != null) runInstructions(was["exit"] as? List<*>, LogicCtx(g, e))
        cur = states[id]; t = 0.0; finished = false; w?.resetTimers()
        e.data["state"] = cur?.get("name") ?: ""
        val now = cur ?: return
        val c = LogicCtx(g, e); run = c
        runInstructions(now["enter"] as? List<*>, c) { finished = true }
        LogicBus.of(g).emit("state", listOf(e, now["name"]))
    }
    fun goTo(e: GameObject, g: PocketGame, name: String) {
        val s = states.values.firstOrNull { it["name"] == name || "${it["id"]}" == name }
        if (s != null) enter("${s["id"]}", e, g)
    }
    override fun start(e: GameObject, g: PocketGame) {
        val evs = allTransitions.map { (it as? Map<*, *>)?.get("event") }
        w = LogicWatcher(e, g, contacts = lusesTouch(evs))
        if (lusesTap(evs) && e.ui) g.tapTargets.add(e)
        val first = (fsm["states"] as? List<*>)?.firstOrNull { it is Map<*, *> } as? Map<*, *>
        enter("${fsm["start"] ?: first?.get("id")}", e, g)
    }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        val s = cur ?: return; val w = this.w ?: return
        w.frame(dt)
        t += dt
        val stay = (s["stay"] as? List<*> ?: emptyList<Any?>()).filter { it is Map<*, *> && it["type"] != "wait" }
        if (stay.isNotEmpty()) runInstructions(stay, LogicCtx(g, e))
        val trs = mutableListOf<Pair<Map<*, *>, String>>()
        (s["transitions"] as? List<*>)?.forEachIndexed { i, tr -> if (tr is Map<*, *>) trs.add(tr to "${s["id"]}:$i") }
        (fsm["any"] as? List<*>)?.forEachIndexed { i, tr -> if (tr is Map<*, *>) trs.add(tr to "any:$i") }
        for ((tr, key) in trs) {
            val to = "${tr["to"]}"
            if (!states.containsKey(to) || (key.startsWith("any") && to == "${s["id"]}")) continue
            val ev = tr["event"] as? Map<*, *> ?: continue
            val hit = w.match(ev, key, stateTime = t, finished = finished)
            if (hit == null || !logicConditionsPass(tr["conditions"] as? List<*>, LogicCtx(g, e, other = hit.other))) continue
            if ((tr["actions"] as? List<*>)?.isNotEmpty() == true) runInstructions(tr["actions"] as? List<*>, LogicCtx(g, e, other = hit.other))
            enter(to, e, g)
            break
        }
    }
    override fun gone(e: GameObject, g: PocketGame) { run?.cancelled = true }
}

// ---- Visual Script (node graphs) ----
// Native node families: events (start, every frame, every N seconds, tap, double tap, long press, touch / stops touching,
// trigger and collision enter / stay / exit, buttons, swipes, keys, screen touch, finger down / drag, messages, variables,
// my variables, damage / death / healing, win / game over / game state / pause, custom events, state entered, landed / left
// ground, near / far / sight, movement / falling / speed, shown / hidden, objects spawned / destroyed / none left, timers,
// first play / new day / welcome back, Triggers events as nodes); flow (branch, sequence, loops, waits, once, flip-flop,
// cooldown, gates, functions with inputs and return values, delegates, message bindings); maths and logic; variables, object
// variables, text and lists / dictionaries; objects; motion and tweens; physics; camera; game flow.
// Nodes for sign-in, cloud data, purchases, online play, social, phone permissions and web pages pass straight through
// (their "then"), sending their name as a message, as do any node types this runtime doesn't know.

class GRet { var v = 0.0; var done = false; var late: (() -> Unit)? = null }
class GFlow { var n = 0; var check: (() -> Unit)? = null }
class GLoop { var stop = false }
/** Where a ray hit: how far, the point and the surface's normal (and what it hit). */
data class GHit(val dist: Double, val px: Double, val py: Double, val nx: Double, val ny: Double, val o: GameObject? = null)
/** What a running chain of nodes knows: the other object, the event's value, the loop it's in, the function it runs for. */
class GCtx(var other: GameObject? = null, var eventValue: Any? = null, var dt: Double = 1.0 / 60, var steps: Int = 0, var index: Any? = null, var item: Any? = null,
           var key: Any? = null, var args: Map<String, Double>? = null, var ret: GRet? = null, var flow: GFlow? = null, var loop: GLoop? = null,
           var callDepth: Int = 0, var impact: Double = 0.0, var hit: GHit? = null) {
    fun clone() = GCtx(other, eventValue, dt, steps, index, item, key, args, ret, flow, loop, callDepth, impact, hit)
    fun fresh() = clone().also { it.steps = 0 }
}

fun gfield(o: GameObject, a: String): Double = when (a) {
    "x" -> o.x; "y" -> o.y; "rz", "rotation", "angle" -> o.rz; "sx", "scale" -> o.sx; "sy" -> o.sy; "alpha", "opacity" -> o.alpha
    "width" -> o.half.w * 2; "height" -> o.half.h * 2; else -> 0.0
}

/** Formula node: a tiny, safe maths language. Numbers, a b c d, game variables by name, pi, e, time; + − × ÷ % ^,
 *  comparisons (1 / 0), parentheses and functions (sin cos tan in degrees, abs, floor, round, sqrt, min, max, clamp, lerp, random…). */
fun gformula(src: String, env: (String) -> Double): Double {
    val toks = Regex("\\d*\\.?\\d+(?:e[+-]?\\d+)?|[A-Za-z_][A-Za-z0-9_]*|<=|>=|==|!=|[-+*/%^(),<>×÷−]").findAll(src).map { it.value }.toList()
    var i = 0
    fun peek() = if (i < toks.size) toks[i] else null
    fun next() = if (i < toks.size) toks[i++] else null
    lateinit var cmp: () -> Double
    fun atom(): Double {
        val t = next() ?: throw IllegalArgumentException("unfinished")
        if (t == "(") { val a = cmp(); next(); return a }
        t.toDoubleOrNull()?.let { return it }
        if (peek() == "(") {
            next()
            val args = mutableListOf<Double>()
            if (peek() != ")") { args.add(cmp()); while (peek() == ",") { next(); args.add(cmp()) } }
            next()
            val a0 = args.getOrElse(0) { 0.0 }; val a1 = args.getOrElse(1) { 0.0 }; val a2 = args.getOrElse(2) { 0.0 }
            return when (t.lowercase()) {
                "sin" -> sin(a0 * DEG); "cos" -> cos(a0 * DEG); "tan" -> tan(a0 * DEG)
                "asin" -> asin(a0) / DEG; "acos" -> acos(a0) / DEG; "atan" -> atan(a0) / DEG; "atan2" -> atan2(a0, a1) / DEG
                "abs" -> abs(a0); "floor" -> floor(a0); "ceil" -> ceil(a0); "round" -> round(a0); "sqrt" -> sqrt(max(0.0, a0))
                "pow" -> a0.pow(a1); "sign" -> sign(a0); "log" -> ln(a0); "exp" -> exp(a0)
                "min" -> args.minOrNull() ?: 0.0; "max" -> args.maxOrNull() ?: 0.0
                "clamp" -> a0.coerceIn(min(a1, a2), max(a1, a2))
                "lerp" -> a0 + (a1 - a0) * a2; "mod" -> if (a1 == 0.0) 0.0 else ((a0 % a1) + a1) % a1
                "random" -> (if (args.isEmpty()) 0.0 else a0) + Random.nextDouble() * ((if (args.size > 1) a1 else 1.0) - (if (args.isEmpty()) 0.0 else a0))
                else -> throw IllegalArgumentException("unknown function $t")
            }
        }
        val k = t.lowercase()
        if (k == "pi") return PI
        if (k == "e") return E
        return env(t)
    }
    fun unary(): Double { if (peek() == "-" || peek() == "−") { next(); return -unary() }; if (peek() == "+") { next(); return unary() }; return atom() }
    fun pw(): Double { val a = unary(); if (peek() != "^") return a; next(); return a.pow(pw()) }
    fun mul(): Double {
        var a = pw()
        while (peek() in listOf("*", "/", "%", "×", "÷")) {
            val o = next(); val b = pw()
            a = if (o == "%") (if (b == 0.0) 0.0 else ((a % b) + b) % b) else if (o == "/" || o == "÷") (if (b == 0.0) 0.0 else a / b) else a * b
        }
        return a
    }
    fun add(): Double { var a = mul(); while (peek() == "+" || peek() == "-" || peek() == "−") { val o = next(); val b = mul(); a = if (o == "+") a + b else a - b }; return a }
    cmp = {
        var a = add()
        while (peek() in listOf("<", ">", "<=", ">=", "==", "!=")) { val o = next()!!; val b = add(); a = if (lcmp(a, o, b)) 1.0 else 0.0 }
        a
    }
    return try { val r = cmp(); if (r.isFinite()) r else 0.0 } catch (_: Throwable) { 0.0 }
}

/** A named timer (Start Timer / Timer Control nodes). */
data class GTimer(val t: Double, val total: Double, val down: Boolean, val running: Boolean)
data class GBinding(val message: String, val func: String)
data class GPress(val t: Double, val at: Offset, val done: Boolean)

/** One visual script: its nodes and links, its state, and how it runs (events start chains of nodes along their "then" links). */
class GraphRun(graph: Map<*, *>) {
    val nodes = mutableListOf<Map<String, Any?>>()
    val byId = mutableMapOf<String, Map<String, Any?>>()
    val outs = mutableMapOf<String, MutableList<String>>()
    val ins = mutableMapOf<String, String>()
    val linkedPorts = mutableMapOf<String, MutableSet<String>>()
    val state = mutableMapOf<String, Any?>()
    val timers = mutableMapOf<String, Double>()
    val repeats = mutableMapOf<String, MutableSet<Any>>()
    val frameQueue = mutableListOf<Pair<Int, () -> Unit>>()
    val bindings = mutableMapOf<String, GBinding>()
    val press = mutableMapOf<Long, GPress>()
    lateinit var g: PocketGame
    lateinit var e: GameObject
    var lw: LogicWatcher? = null
    var leNodes = listOf<Map<String, Any?>>()
    internal val contacts = mutableSetOf<Int>()
    internal val contactObj = mutableMapOf<Int, GameObject>()
    internal var alive = setOf<Int>()
    internal var varsSeen = mutableMapOf<String, String>()
    internal var hpWas: Double? = null
    internal var died = false; internal var pausedWas = false; internal var first = true
    internal var gameStateWas = ""
    var wasGround: Boolean? = null; var wasOn: Boolean? = null
    var lastTapT = -9.0

    init {
        for (n in graph["nodes"] as? List<*> ?: emptyList<Any?>()) { val m = lmapOf(n) ?: continue; nodes.add(m); byId["${m["id"]}"] = m }
        for (l in graph["links"] as? List<*> ?: emptyList<Any?>()) {
            if (l !is Map<*, *>) continue
            val f = l["from"] as? Map<*, *> ?: continue; val t = l["to"] as? Map<*, *> ?: continue
            outs.getOrPut("${f["node"]}|${f["port"]}") { mutableListOf() }.add("${t["node"]}")
            ins["${t["node"]}|${t["port"]}"] = "${f["node"]}"
            linkedPorts.getOrPut("${f["node"]}") { mutableSetOf() }.add("${f["port"]}")
        }
    }

    fun ty(n: Map<*, *>) = "${n["type"]}"
    fun has(types: List<String>) = nodes.any { it["type"] in types && it["off"] != true }
    fun nodesOf(type: String) = nodes.filter { it["type"] == type && it["off"] != true }
    fun param(n: Map<*, *>, k: String): Any? {
        val pr = n["params"]
        if (pr is Map<*, *> && pr[k] != null) return pr[k]
        return graphDefaults[ty(n)]?.get(k)
    }
    fun ps(n: Map<*, *>, k: String) = ltext(param(n, k))
    fun pn(n: Map<*, *>, k: String) = lnum(param(n, k))
    fun input(n: Map<*, *>, k: String, ctx: GCtx, depth: Int = 0): Any? {
        val from = ins["${n["id"]}|$k"]
        return if (from != null && depth < 50) value(byId[from], ctx, depth + 1) else param(n, k)
    }
    fun inum(n: Map<*, *>, k: String, ctx: GCtx) = lnum(input(n, k, ctx))
    fun tagOk(o: GameObject, tag: String) = tag.isEmpty() || o.has(tag)
    fun setMy(who: GameObject?, k: String, v: Any?) { if (who == null) return; val old = who.data[k]; who.data[k] = v; if (!lsame(old, v)) LogicBus.of(g).emit("myvar", listOf(who, k, v)) }
    fun who(n: Map<*, *>, ctx: GCtx, key: String = "target"): GameObject? = if (ps(n, key) == "other") ctx.other else e

    fun follow(n: Map<*, *>, port: String, ctx: GCtx) { for (id in outs["${n["id"]}|$port"]?.toList() ?: emptyList()) run(byId[id], ctx) }
    /** Something in a loop's pass carries on later (a Wait): the loop holds on until it's done. Returns the release. */
    fun hold(ctx: GCtx): () -> Unit { val f = ctx.flow; if (f != null) f.n++; return { if (f != null) { f.n--; f.check?.invoke() } } }
    /** A loop's passes one after another; a pass with a Wait finishes before the next starts; "done" after the last. */
    fun seq(n: Map<*, *>, ctx: GCtx, count: Int, pass: (Int) -> Map<String, Any?>?, after: (() -> Unit)? = null) {
        val outer = ctx.flow; val loop = GLoop()
        var i = 0
        var held = false
        lateinit var next: () -> Unit
        next = next@{
            while (i < count && !loop.stop && !e.dead) {
                val extra = pass(i++) ?: break
                val f = GFlow()
                val c = ctx.clone().also { it.loop = loop; it.flow = f }
                if (extra.containsKey("index")) c.index = extra["index"]
                if (extra.containsKey("item")) c.item = extra["item"]
                if (extra.containsKey("key")) c.key = extra["key"]
                if (extra.containsKey("other")) { c.other = extra["other"] as GameObject?; c.steps = 0 }
                follow(n, "each", c)
                if (f.n > 0) {
                    if (!held && outer != null) { outer.n++; held = true }
                    f.check = { if (f.n == 0) { f.check = null; next() } }
                    return@next
                }
            }
            if (!e.dead) { if (after != null) after() else follow(n, "done", ctx) }
            if (held && outer != null) { held = false; outer.n--; outer.check?.invoke() }
        }
        next()
    }
    /** Run this script's Function (inputs a–c). onDone(value, late): a Function that Waits before Return Value calls it later. */
    fun callFunction(ctx: GCtx, name: String, args: Map<String, Double>, onDone: ((Double, Boolean) -> Unit)? = null): Double {
        val depth = ctx.callDepth + 1
        if (depth > 20) { onDone?.invoke(0.0, false); return 0.0 }
        val ret = GRet(); val f = GFlow()
        for (fn in nodes.toList()) {
            if (fn["type"] == "funcDef" && ps(fn, "name") == name) {
                follow(fn, "then", GCtx(other = ctx.other, dt = ctx.dt, args = args, ret = ret, callDepth = depth, flow = f))
                if (ret.done) break
            }
        }
        if (onDone != null) {
            if (ret.done || f.n <= 0) onDone(ret.v, false)
            else {
                var fin = false
                val end = { if (!fin) { fin = true; f.check = null; ret.late = null; onDone(ret.v, true) } }
                f.check = { if (f.n <= 0) end() }
                ret.late = end
            }
        }
        return ret.v
    }
    fun hasFunction(name: String) = nodes.any { it["type"] == "funcDef" && ps(it, "name") == name }

    /** Where a ray from this object hits a solid object (or one with a tag). */
    fun ray(n: Map<*, *>, ctx: GCtx): GHit? {
        val dir = ps(n, "dir")
        val flip = if (e.data["flipX"] == true || e.sx < 0) -1.0 else 1.0
        var dx: Double; var dy: Double
        when (dir) {
            "toward tag" -> { val t = lnearest(g, e, ps(n, "toward")) ?: return null; dx = t.x - e.x; dy = t.y - e.y }
            "custom" -> { dx = inum(n, "dx", ctx); dy = inum(n, "dy", ctx) }
            "up" -> { dx = 0.0; dy = -1.0 }
            "down", "ahead & down" -> { dx = 0.0; dy = 1.0 }
            "left" -> { dx = -1.0; dy = 0.0 }
            "right" -> { dx = 1.0; dy = 0.0 }
            else -> { dx = cos(e.rz * DEG) * flip; dy = sin(e.rz * DEG) * flip }
        }
        val l = hypot(dx, dy)
        if (l == 0.0) return null
        dx /= l; dy /= l
        var ox = e.x; val oy = e.y
        if (dir == "ahead & down") ox = e.x + flip * (e.half.w + 6)
        val mx = if (inum(n, "distance", ctx) > 0) inum(n, "distance", ctx) else if (dir == "ahead & down") e.half.h + 24 else 400.0
        val tag = ps(n, "tag"); val triggers = onOf(param(n, "triggers"))
        var best: GHit? = null
        for (q in g.objects) {
            if (q === e || q.dead || q.ui) continue
            if (tag.isNotEmpty()) { if (!q.has(tag)) continue } else if (!(q.body?.solid ?: false) && !(triggers && q.body != null)) continue
            // slab test
            var t0 = 0.0; var t1 = mx
            var nx = 0.0; var ny = 0.0
            var ok = true
            for (ax in 0..1) {
                val oo = if (ax == 0) ox else oy; val dd = if (ax == 0) dx else dy
                val lo = if (ax == 0) q.x - q.half.w else q.y - q.half.h; val hi = if (ax == 0) q.x + q.half.w else q.y + q.half.h
                if (abs(dd) < 1e-9) { if (oo < lo || oo > hi) { ok = false; break }; continue }
                var a = (lo - oo) / dd; var b = (hi - oo) / dd
                var na = -1.0
                if (a > b) { val tmp = a; a = b; b = tmp; na = 1.0 }
                if (a > t0) { t0 = a; if (ax == 0) { nx = na; ny = 0.0 } else { nx = 0.0; ny = na } }
                t1 = min(t1, b)
                if (t0 > t1) { ok = false; break }
            }
            val bb = best
            if (!ok || (bb != null && t0 >= bb.dist)) continue
            best = GHit(t0, ox + dx * t0, oy + dy * t0, nx, ny, q)
        }
        return best
    }

    // ---- values ----
    fun value(n: Map<*, *>?, ctx: GCtx, depth: Int = 0): Any? {
        if (n == null) return 0.0
        val t = ty(n)
        if (t.startsWith("lc_")) {
            val it = mutableMapOf<String, Any?>("type" to t.substring(3)); lmapOf(n["params"])?.let { m -> it.putAll(m) }
            return logicConditionsPass(listOf(it), LogicCtx(g, e, other = ctx.other, eventValue = ctx.eventValue))
        }
        fun i(k: String) = input(n, k, ctx, depth)
        fun I(k: String) = lnum(i(k))
        fun P(k: String) = ps(n, k)
        fun pn2(k: String) = pn(n, k)
        fun bodySpeed(b: Body?) = if (b == null) 0.0 else sqrt(b.vx * b.vx + b.vy * b.vy)
        val abcd = mapOf("a" to { I("a") }, "b" to { I("b") }, "c" to { I("c") })
        fun abc() = abcd.mapValues { it.value() }
        when (t) {
            "number" -> return pn2("value")
            "getVar" -> return g.numVar(P("name"))
            "random" -> { val a = pn2("min"); val b = pn2("max"); return if (a == round(a) && b == round(b)) min(b, floor(rand(a, b + 1))) else rand(a, b) }
            "math" -> {
                val a = I("a"); val b = I("b")
                return when (P("op")) { "+" -> a + b; "−", "-" -> a - b; "×", "*" -> a * b; "÷", "/" -> if (b == 0.0) 0.0 else a / b; "min" -> min(a, b); "max" -> max(a, b); "mod" -> if (b == 0.0) 0.0 else ((a % b) + b) % b; "power" -> a.pow(b); else -> 0.0 }
            }
            "compare" -> return lcmp(I("a"), P("op"), I("b"))
            "and" -> return ltruthy(i("a")) && ltruthy(i("b"))
            "or" -> return ltruthy(i("a")) || ltruthy(i("b"))
            "not" -> return !ltruthy(i("a"))
            "position" -> return gfield(e, P("axis"))
            "distance" -> { val o = g.findAll(P("tag")).firstOrNull(); return if (o == null) Double.POSITIVE_INFINITY else ldist(o, e) }
            "time" -> return g.time
            "deltaTime" -> return ctx.dt
            "hasSave" -> return g.hasSave(if (pn2("slot") <= 0) 1 else pn2("slot").toInt())
            "grounded" -> return e.body?.grounded ?: false
            "velocity" -> { val b = e.body ?: return 0.0; return when (P("axis")) { "speed" -> bodySpeed(b); "y" -> b.vy; "x" -> b.vx; else -> 0.0 } }
            "touching" -> return g.touching(e) { it.has(P("tag")) }.isNotEmpty()
            "canSee" -> { val o = g.findAll(P("tag")).firstOrNull { it !== e }; return o != null && g.canSee(e, o) && (pn2("range") <= 0 || ldist(o, e) <= pn2("range")) }
            "math1" -> {
                val a = I("a")
                return when (P("op")) {
                    "abs" -> abs(a); "round" -> round(a); "floor" -> floor(a); "ceil" -> ceil(a); "sqrt" -> sqrt(max(0.0, a)); "negate" -> -a
                    "sin" -> sin(a * DEG); "cos" -> cos(a * DEG); "tan" -> tan(a * DEG); "square" -> a * a; "cube root" -> (if (a < 0) -1.0 else 1.0) * abs(a).pow(1.0 / 3)
                    "reciprocal" -> if (a == 0.0) 0.0 else 1 / a; "fraction" -> a - floor(a); "log" -> if (a > 0) ln(a) else 0.0; "exp" -> exp(a); else -> a
                }
            }
            "clamp" -> { val lo = min(I("min"), I("max")); val hi = max(I("min"), I("max")); return I("value").coerceIn(lo, hi) }
            "lerp" -> return I("a") + (I("b") - I("a")) * I("t")
            "loopIndex" -> return lnum(ctx.index)
            "angleTo" -> { val o = lnearest(g, e, P("tag")) ?: return 0.0; return atan2(o.y - e.y, o.x - e.x) / DEG }
            "countTag" -> return g.findAll(P("tag")).size.toDouble()
            "exists" -> return g.find(P("object")) != null
            "health" -> return e.part<Health>()?.hp ?: lnum(e.data["hp"])
            "healthOf" -> {
                val o = if (P("object").isEmpty()) e else (g.find(P("object")) ?: e); val d = o.data
                fun pc(a: Any?, b: Any?) = if (lnum(b) == 0.0) 0.0 else lnum(a) / lnum(b) * 100
                return when (P("what")) { "max health" -> lnum(d["hpMax"]); "health %" -> pc(d["hp"], d["hpMax"]); "shield" -> lnum(d["hpShield"]); "hunger" -> lnum(d["hunger"]); "hunger %" -> pc(d["hunger"], d["hungerMax"]); "thirst" -> lnum(d["thirst"]); "thirst %" -> pc(d["thirst"], d["thirstMax"]); else -> lnum(d["hp"]) }
            }
            "itemCount" -> return g.numVar("item_${P("item")}")
            "hasItem" -> return g.numVar("item_${P("item")}") >= max(1.0, I("count"))
            "joystick" -> { val a = g.axis(); return if (P("axis") == "y") a.y.toDouble() else a.x.toDouble() }
            "screen" -> return if (P("what") == "height") g.screen.height.toDouble() else g.screen.width.toDouble()
            "isMoving" -> { val b = e.body; if (b != null) return bodySpeed(b) > 10; val m = state["_moved"]; return m is Double && g.time - m < 0.1 }
            "isTweening" -> return g.tweens.any { it.o === e }
            "choose" -> return if (ltruthy(i("condition"))) I("yes") else I("no")
            "wave" -> {
                val tt = g.time * I("speed"); val k = I("size"); val f = tt - floor(tt)
                return k * (if (P("shape") == "square") (if (f < 0.5) 1.0 else -1.0) else if (P("shape") == "triangle") 1 - 4 * abs(f - 0.5) else sin(tt * PI * 2))
            }
            "remap" -> { val a = I("fromMin"); val b = I("fromMax"); val k = if (b == a) 0.0 else (I("value") - a) / (b - a); return I("toMin") + (I("toMax") - I("toMin")) * k }
            "objPos" -> { val o = g.find(P("object")) ?: lnearest(g, e, P("object")) ?: (if (e.has(P("object"))) e else null); return if (o == null) 0.0 else gfield(o, P("axis")) }
            "isHolding" -> return g.pointers.isNotEmpty()
            "touchPos" -> {
                val pt = g.pointers.values.firstOrNull()?.at ?: g.taps.firstOrNull()?.screen ?: g.ups.firstOrNull()?.at
                if (pt != null) state["_finger"] = g.toWorld(pt)
                val f = state["_finger"] as? Offset ?: return 0.0
                return if (P("axis") == "y") f.y.toDouble() else f.x.toDouble()
            }
            "coinFlip" -> return Random.nextBoolean()
            "level" -> return if (g.numVar("level") == 0.0) 1.0 else g.numVar("level")
            "impactSpeed" -> return ctx.impact
            "inTrigger", "isColliding" -> {
                val wantSensor = t == "inTrigger"
                return g.objects.any { o -> o !== e && !o.dead && !o.ui && tagOk(o, P("tag")) && PocketGame.overlap(e, o) && isSensor(o) == wantSensor }
            }
            "rayHits" -> return ray(n, ctx) != null
            "hitInfo" -> {
                val h = ctx.hit ?: return 0.0
                val w = P("what")
                if (w == "distance") return h.dist
                val parts = w.split(" ")
                val pt = parts[0] == "point"
                return if (parts.size > 1 && parts[1] == "y") (if (pt) h.py else h.ny) else if (parts.size > 1 && parts[1] == "x") (if (pt) h.px else h.nx) else 0.0
            }
            "countRadius" -> { val r = if (I("radius") > 0) I("radius") else 150.0; return g.objects.count { q -> q !== e && !q.dead && !q.ui && tagOk(q, P("tag")) && ldist(q, e) <= r }.toDouble() }
            "onScreen" -> { val v = g.viewBounds; return e.x >= v.left - 10 && e.x <= v.right + 10 && e.y >= v.top - 10 && e.y <= v.bottom + 10 }
            "otherInfo" -> {
                val o = ctx.other ?: return 0.0
                return when (val w = P("what")) {
                    "speed" -> bodySpeed(o.body)
                    "distance" -> ldist(o, e); "angle" -> atan2(o.y - e.y, o.x - e.x) / DEG; "health" -> o.part<Health>()?.hp ?: lnum(o.data["hp"])
                    else -> gfield(o, w)
                }
            }
            "otherHasTag" -> return ctx.other?.has(P("tag")) ?: false
            "hasOther" -> return ctx.other != null && !ctx.other!!.dead
            "pageIs" -> return lsame(g.vars[P("var").ifEmpty { "page" }], P("page"))
            "curPage" -> return ltext(g.vars[P("var").ifEmpty { "page" }])
            "getMyVar" -> return lnum(e.data[P("name")])
            "textIs" -> {
                val a = ltext(g.vars[P("name")]).lowercase(); val b = P("text").lowercase()
                return when (P("op")) { "contains" -> a.contains(b); "starts with" -> a.startsWith(b); "is empty" -> a.isBlank(); else -> a == b }
            }
            "listGet" -> { val a = lvarList(g, P("name")); val k = I("position").roundToInt() - 1; return if (k >= 0 && k < a.size) lnum(a[k]) else 0.0 }
            "listLen" -> return lvarList(g, P("name")).size.toDouble()
            "listHas" -> { val v = I("value"); return lvarList(g, P("name")).any { lnum(it) == v } }
            "listFind" -> { val v = I("value"); return (lvarList(g, P("name")).indexOfFirst { lnum(it) == v } + 1).toDouble() }
            "listRandom" -> { val a = lvarList(g, P("name")); return if (a.isEmpty()) 0.0 else lnum(a.random()) }
            "listStat" -> {
                val a = lvarList(g, P("name")).map { lnum(it) }; if (a.isEmpty()) return 0.0
                val sum = a.sum()
                return when (P("op")) { "min" -> a.min(); "max" -> a.max(); "average" -> sum / a.size; else -> sum }
            }
            "loopItem" -> return lnum(ctx.item)
            "loopItemText" -> return ltext(ctx.item)
            "loopKey" -> return ltext(ctx.key)
            "funcArg" -> return ctx.args?.get(P("which").ifEmpty { "a" }) ?: 0.0
            "callFunc" -> return callFunction(ctx, P("name"), abc())
            "callerIs" -> return ctx.other?.has(P("tag")) ?: false
            "getOtherVar" -> return lnum(ctx.other?.data?.get(P("name")))
            "varAt" -> { val o = g.find(P("object")) ?: lnearest(g, e, P("object")); return lnum(o?.data?.get(P("name"))) }
            "getObjVar" -> return lnum(named(P("object"), ctx)?.data?.get(P("name")))
            "getObjText" -> return ltext(named(P("object"), ctx)?.data?.get(P("name")))
            "eventValue" -> return lnum(ctx.eventValue)
            "eventText" -> return ltext(ctx.eventValue)
            "directionTo" -> {
                val o = lnearest(g, e, P("tag")) ?: return 0.0
                val dx = o.x - e.x; val dy = o.y - e.y; val l = max(1e-9, sqrt(dx * dx + dy * dy))
                return when (P("axis")) { "y" -> dy / l; "x" -> dx / l; else -> 0.0 }
            }
            "distBetween" -> { val a = g.find(P("a")); val b = g.find(P("b")); return if (a != null && b != null) ldist(a, b) else 0.0 }
            "snapTo" -> { val st = abs(I("step")); return if (st == 0.0) I("value") else round(I("value") / st) * st }
            "pingPong" -> { val l = if (abs(I("length")) == 0.0) 1.0 else abs(I("length")); val tt = ((I("value") % (2 * l)) + 2 * l) % (2 * l); return if (tt <= l) tt else 2 * l - tt }
            "sign" -> return sign(I("value"))
            "smooth" -> {
                val key = "sm:${n["id"]}"; val target = I("target"); val cur = if (state.containsKey(key)) lnum(state[key]) else target
                val k = min(1.0, ctx.dt * (if (I("speed") == 0.0) 5.0 else I("speed")))
                val v = cur + (target - cur) * k; state[key] = v; return v
            }
            "chanceOf" -> return Random.nextDouble() * 100 < I("percent")
            "fingers" -> return g.pointers.size.toDouble()
            "isPaused" -> return g.paused
            "childCount" -> return g.objects.count { it.parent === e && !it.dead }.toDouble()
            "formula" -> {
                val env = mapOf("a" to I("a"), "b" to I("b"), "c" to I("c"), "d" to I("d"))
                return gformula(P("expr").ifEmpty { "0" }) { k -> env[k] ?: (if (k.lowercase() == "time") g.time else g.numVar(k)) }
            }
            "randomRange" -> { val a = I("min"); val b = I("max"); return if (onOf(param(n, "whole"))) floor(rand(min(a, b), max(a, b) + 1)) else rand(a, b) }
            "randomPick" -> { val c = pn2("count").roundToInt().coerceIn(2, 4); return I("abcd"[Random.nextInt(c)].toString()) }
            "noise" -> { val sc = if (I("scale") == 0.0) 1.0 else I("scale"); val x = (if (P("by") == "input value") I("value") else g.time + I("value")) * sc; return noise1(x) }
            "invLerp" -> { val a = I("a"); val b = I("b"); return if (b == a) 0.0 else (I("value") - a) / (b - a) }
            "moveTowards" -> { val c = I("current"); val tg = I("target"); val st = abs(I("step")); return if (abs(tg - c) <= st) tg else c + sign(tg - c) * st }
            "angleDiff" -> return ((((I("b") - I("a")) % 360) + 540) % 360) - 180
            "wrap" -> { val lo = I("min"); val hi = I("max"); val r = hi - lo; return if (r == 0.0) lo else lo + (((I("value") - lo) % r) + r) % r }
            "roundTo" -> { val k = 10.0.pow(I("decimals").roundToInt().coerceIn(0, 8)); return round(I("value") * k) / k }
            "percent" -> return if (I("total") == 0.0) 0.0 else I("part") / I("total") * 100
            "easeVal" -> return ease(P("ease"), I("t").coerceIn(0.0, 1.0))
            "vecLength" -> return sqrt(I("x") * I("x") + I("y") * I("y") + I("z") * I("z"))
            "distPoints" -> return hypot(I("x2") - I("x1"), I("y2") - I("y1"))
            "anglePoints" -> return atan2(I("y2") - I("y1"), I("x2") - I("x1")) / DEG
            "minMax3" -> {
                val c = pn2("count").roundToInt().coerceIn(2, 4); val vals = "abcd".substring(0, c).map { I(it.toString()) }
                return when (P("op")) { "min" -> vals.min(); "average" -> vals.sum() / vals.size; "sum" -> vals.sum(); else -> vals.max() }
            }
            "between" -> { val v = I("value"); val a = I("min"); val b = I("max"); return v >= min(a, b) && v <= max(a, b) }
            "isEven" -> return I("value").roundToLong() % 2 == 0L
            "isUnlocked" -> return stored("pocket.ach.${g.saveKey}.${P("name")}") == "1"
            "gameValue" -> { val w = P("what"); return when (w) { "time left" -> g.numVar("time"); "level" -> if (g.numVar("level") == 0.0) 1.0 else g.numVar("level"); "levels" -> 1.0; else -> g.numVar(w) } }
            "gameStateIs" -> { val st = P("state"); return if (st == "paused") g.paused else !g.paused && g.state == (when (st) { "playing" -> "play"; "title" -> "title"; "game over" -> "over"; "won" -> "win"; else -> st }) }
            "callFuncOn" -> { val o = whoOf(P("on"), P("object"), ctx).firstOrNull(); return o?.part<VisualScript>()?.callFn(P("name"), abc(), e, null)?.second ?: 0.0 }
            "objHasFunc" -> return named(P("object"), ctx)?.part<VisualScript>()?.hasFn(P("name")) ?: false
            "liveCamera" -> return g.activeCamera?.name ?: ""
            "camIsLive" -> return g.activeCamera?.name == P("camera")
            "camValue" -> return when (P("what")) { "zoom" -> g.camZoom; "y" -> g.camY; else -> g.camX }
            "arrGetText" -> { val a = lvarList(g, P("name")); val k = I("position").roundToInt(); val idx = if (k < 0) a.size + k else k - 1; return if (idx >= 0 && idx < a.size) ltext(a[idx]) else "" }
            "arrJoin" -> return lvarList(g, P("name")).joinToString(if (param(n, "sep") == null) ", " else ltext(param(n, "sep"))) { ltext(it) }
            "arrCount" -> { val v = lval(i("value")); return lvarList(g, P("name")).count { lsame(it, v) }.toDouble() }
            "arrIndexOfMax" -> {
                val a = lvarList(g, P("name")).map { lnum(it) }; if (a.isEmpty()) return 0.0
                var b = 0
                for (k in 1 until a.size) if (if (P("which") == "smallest") a[k] < a[b] else a[k] > a[b]) b = k
                return (b + 1).toDouble()
            }
            "mapGet" -> return ltext(lvarMap(g, P("name"))[ltext(i("key"))])
            "mapGetNum" -> return lnum(lvarMap(g, P("name"))[ltext(i("key"))])
            "mapHas" -> return lvarMap(g, P("name")).containsKey(ltext(i("key")))
            "mapSize" -> return lvarMap(g, P("name")).size.toDouble()
            "callDelegateV" -> { val f = ltext(g.vars[P("var")]); return if (f.isEmpty()) 0.0 else callFunction(ctx, f, abc()) }
            "hasFunction" -> return hasFunction(P("func"))
            "textJoin" -> return listOf(i("a"), i("b"), i("c")).map { ltext(it) }.filter { it.isNotEmpty() }.joinToString(if (param(n, "sep") == null) "" else ltext(param(n, "sep")))
            "textFill" -> {
                val a = I("a"); val b = I("b")
                return Regex("\\{(\\w+)\\}").replace(P("text")) { m -> val k = m.groupValues[1]; val v: Any? = if (k == "a") a else if (k == "b") b else e.data[k] ?: g.vars[k]; if (v is Number) formatNumber(v.toDouble()) else ltext(v) }
            }
            "numText" -> return numText(I("value"), P("format"))
            "textLen" -> return ltext(i("text")).length.toDouble()
            "textCase" -> {
                val s = ltext(i("text"))
                return when (P("to")) {
                    "lower" -> s.lowercase(); "Title Case" -> Regex("(^|\\s)\\S").replace(s.lowercase()) { it.value.uppercase() }
                    "reversed" -> s.reversed(); "trimmed" -> s.trim(); else -> s.uppercase()
                }
            }
            "textReplace" -> { val f = ltext(i("find")); return if (f.isEmpty()) ltext(i("text")) else ltext(i("text")).replace(f, ltext(i("with"))) }
            "textPart" -> { val s = ltext(i("text")); val a = max(0, I("start").roundToInt() - 1); return if (a >= s.length) "" else s.substring(a, min(s.length, a + max(0, I("length").roundToInt()))) }
            "textCheck" -> {
                val a = ltext(i("text")); val b = ltext(i("other"))
                return when (P("op")) {
                    "equals" -> a == b; "equals (any case)" -> a.lowercase() == b.lowercase(); "contains" -> a.lowercase().contains(b.lowercase())
                    "starts with" -> a.lowercase().startsWith(b.lowercase()); "ends with" -> a.lowercase().endsWith(b.lowercase()); "is empty" -> a.isBlank(); "is a number" -> a.trim().toDoubleOrNull() != null; else -> false
                }
            }
            "textNum" -> return ltext(i("text")).replace(Regex("[, ]"), "").toDoubleOrNull() ?: 0.0
            "getText" -> return ltext(g.vars[P("name")])
            "randomWord" -> { val w = words(P("words")); return if (w.isEmpty()) "" else w.random() }
            "wordAt" -> { val w = words(P("words")); if (w.isEmpty()) return ""; val k = ((I("position").roundToInt() - 1) % w.size + w.size) % w.size; return w[k] }
            "timerValue" -> {
                val tm = namedTimers[P("name").ifEmpty { "timer" }] ?: return 0.0
                return when (P("what")) { "whole seconds" -> if (tm.down) ceil(tm.t) else floor(tm.t); "fraction done (0–1)" -> if (tm.down) (if (tm.total == 0.0) 1.0 else 1 - tm.t / tm.total) else 0.0; "is running" -> tm.running; else -> tm.t }
            }
            "clock" -> {
                val d = lclock()
                return when (P("part")) { "minute" -> d[1]; "second" -> d[2]; "weekday (0 = Sun)" -> d[3]; "day of month" -> d[4]; "month" -> d[5]; "year" -> d[6]; else -> d[0] }.toDouble()
            }
            "keyHeld" -> return g.keys.any { lkeyName(it) == lkeyWant(param(n, "key")) }
            "keyAxis" -> {
                fun k(names: List<String>) = g.keys.any { lkeyName(it) in names }
                return if (P("axis") == "up / down") (if (k(listOf("arrowdown", "s"))) 1.0 else 0.0) - (if (k(listOf("arrowup", "w"))) 1.0 else 0.0)
                else (if (k(listOf("arrowright", "d"))) 1.0 else 0.0) - (if (k(listOf("arrowleft", "a"))) 1.0 else 0.0)
            }
            "dragAmount" -> { val d = g.dragDelta; return when (P("axis")) { "y" -> d.y.toDouble(); "distance" -> d.getDistance().toDouble(); else -> d.x.toDouble() } }
            "pinchAmount" -> {
                val ps2 = g.pointers.values.toList(); val key = "pinch:${n["id"]}"
                if (ps2.size < 2) { state.remove(key); return 1.0 }
                val d = (ps2[0].at - ps2[1].at).getDistance().toDouble()
                if (!state.containsKey(key)) state[key] = if (d == 0.0) 1.0 else d
                return d / lnum(state[key])
            }
            "deviceIs" -> return if (P("is") == "landscape") g.screen.width > g.screen.height else P("is") == "touch screen"
            "popupOpen" -> return g.panels.isNotEmpty()
            "safeArea" -> return when (P("side")) { "bottom" -> g.safeBottom; "left" -> g.safeLeft; "right" -> g.safeRight; else -> g.safeTop }.toDouble()
            "isDarkMode" -> return g.vars["darkMode"] == true
            "animPlaying" -> return "${e.data["clip"] ?: ""}".isNotEmpty() && (P("clip").isEmpty() || e.data["clip"] == P("clip"))
            "spriteFrame" -> return lnum(e.data["frame"])
            else -> return 0.0
        }
    }

    internal fun isSensor(o: GameObject) = (e.body?.sensor ?: true) || (o.body?.sensor ?: true) || e.body == null || o.body == null
    internal fun named(k: String, ctx: GCtx): GameObject? = if (k.isEmpty() || k == "self") e else if (k == "other") ctx.other else g.find(k)
    internal fun whoOf(on: String, name: String, ctx: GCtx): List<GameObject> = when (on) {
        "other" -> listOfNotNull(ctx.other)
        "all with tag" -> g.findAll(name)
        "first with tag" -> g.findAll(name).take(1)
        "object named" -> listOfNotNull(g.find(name))
        "everything" -> g.objects.toList()
        else -> listOf(e)
    }

    /** Named timers (Start Timer / Timer Control nodes), shared by every script and ticked once a frame. */
    @Suppress("UNCHECKED_CAST")
    internal val namedTimers: MutableMap<String, GTimer> get() = g.systems.getOrPut("namedTimers") { mutableMapOf<String, GTimer>() } as MutableMap<String, GTimer>
    internal fun tickTimers(dt: Double) {
        if (g.systems["timersT"] == g.time) return
        g.systems["timersT"] = g.time
        val tm = namedTimers
        for (k in tm.keys.toList()) {
            val t = tm[k]!!
            if (!t.running) continue
            if (t.down) {
                val left = max(0.0, t.t - dt)
                tm[k] = GTimer(left, t.total, true, left > 0)
                if (lnum(g.vars[k]) != ceil(left) || g.vars[k] == null) g.setVar(k, ceil(left))
                if (left <= 0) LogicBus.of(g).emit("timerDone", listOf(k))
            } else {
                tm[k] = GTimer(t.t + dt, t.total, false, true)
                g.setVar(k, floor(t.t + dt))
            }
        }
    }

    companion object {
        internal fun words(s: String) = s.split(Regex("[|\\n,]")).map { it.trim() }.filter { it.isNotEmpty() }
        internal fun noise1(x: Double): Double {
            fun h(n: Double): Double { val v = sin(n * 127.1 + 311.7) * 43758.5453; return (v - floor(v)) * 2 - 1 }
            val i = floor(x); val f = x - i; val u = f * f * (3 - 2 * f)
            return h(i) * (1 - u) + h(i + 1) * u
        }
        internal fun numText(v: Double, f: String): String {
            if (f.startsWith("ordinal")) { val n = v.roundToLong(); val t = abs(n) % 100; val u = abs(n) % 10; return "$n" + (if (t in 11..13) "th" else if (u == 1L) "st" else if (u == 2L) "nd" else if (u == 3L) "rd" else "th") }
            if (f.startsWith("short")) return formatNumber(v)
            if (f.startsWith("time")) { val s = abs(v.roundToLong()); return "${s / 60}:${(s % 60).toString().padStart(2, '0')}" }
            if (f.startsWith("percent")) return "${v.roundToLong()}%"
            if (f.startsWith("2 decimals")) { val r = (abs(v) * 100).roundToLong(); return (if (v < 0 && r != 0L) "-" else "") + "${r / 100}." + (r % 100).toString().padStart(2, '0') }
            if (f.startsWith("whole")) return "${v.roundToLong()}"
            val s = ltext(v); val parts = s.split(".")
            val whole = Regex("(\\d)(?=(\\d{3})+$)").replace(parts[0]) { "${it.groupValues[1]}," }
            return if (parts.size > 1) "$whole.${parts[1]}" else whole
        }
    }
}

/** Graph nodes that only the web build can run (sign-in, cloud, purchases, online, social, web pages): they send their name and go on. */
private fun graphWebOnly(t: String) = t.startsWith("supa") || t.startsWith("soc") || t.startsWith("net") || t.startsWith("pf") || t.startsWith("es") || t.startsWith("cloud") || t in graphWebOnlySet
private val graphWebOnlySet = setOf("buyProduct", "restorePurchases", "exportSlot", "importSlot", "phoneNotify", "phoneCancel", "phoneAsk", "notify", "askPermission", "openSettings", "share", "copyText", "openLink", "openPhoneApp",
    "playGameN", "backToAppN", "goToLevel", "restartLevel", "playMusic", "stopMusic", "setVolume", "muteSound", "playNote", "takePhoto", "setLight", "fadeLight", "lightEffect", "setSun", "lightingPreset",
    "appBadge", "fullScreen", "keepScreenOn", "navBars", "menuOpen", "calibrateTilt", "hitStop", "gameSpeed", "slowMo", "setObjLayer", "forEachInLayer", "uiShow", "openPopup", "closeTop", "uiEnable",
    "setImage", "setBadge", "uiTheme", "uiOrder", "uiSize", "scrollTo", "goPageWith", "forEachRecord", "findRecord", "setRecordField", "toggleField", "updateRecords", "deleteRecords", "recordsToArray",
    "setDarkMode", "showLoading", "toggleComp", "playAnim", "stopAnim", "animSpeed", "setFrame", "squadSelect", "squadMove", "squadStop", "endTurn", "giveItem", "useItem", "runMyAction", "camLens", "camDutch", "camNoise")

// ---- running nodes ----
fun GraphRun.run(n: Map<*, *>?, ctx: GCtx) {
    if (n == null || ++ctx.steps > 300) return
    val t = ty(n)
    if (n["off"] == true) { val ports = linkedPorts["${n["id"]}"] ?: emptySet<String>(); follow(n, if ("then" in ports || ports.isEmpty()) "then" else ports.first(), ctx); return }
    if (t.startsWith("la_")) { // a Triggers instruction as a node
        val it = mutableMapOf<String, Any?>("type" to t.substring(3)); lmapOf(n["params"])?.let { m -> it.putAll(m) }
        val later = ctx.fresh()
        var sync = true; var doneNow = false
        runInstructions(listOf(it), LogicCtx(g, e, other = ctx.other, eventValue = ctx.eventValue)) { if (sync) doneNow = true else if (!e.dead) follow(n, "then", later) }
        sync = false
        if (doneNow) follow(n, "then", ctx)
        return
    }
    if (exec(n, t, ctx)) follow(n, "then", ctx)
}

/** One node's work; true: carry on along "then". */
private fun GraphRun.exec(n: Map<*, *>, t: String, ctx: GCtx): Boolean {
    fun I(k: String) = inum(n, k, ctx)
    fun iv(k: String) = input(n, k, ctx)
    fun P(k: String) = ps(n, k)
    fun pn2(k: String) = pn(n, k)
    fun tw(o: GameObject, f: String, to: Double, secs: Double, curve: String, done: (() -> Unit)? = null) { g.tween(o, f, to, max(0.01, secs), curve = curve.ifEmpty { "outQuad" }, done = done) }
    val finishedLater = { follow(n, "finished", ctx.fresh()) }
    fun abc() = mapOf("a" to I("a"), "b" to I("b"), "c" to I("c"))
    fun target() = if (P("target") == "other") ctx.other else e
    val id = "${n["id"]}"
    fun slot() = if (pn2("slot") <= 0) 1 else pn2("slot").toInt()
    when (t) {
        "branch" -> { follow(n, if (ltruthy(iv("condition"))) "true" else "false", ctx); return false }
        "wait" -> { val rel = hold(ctx); g.after(max(0.0, I("seconds"))) { if (!e.dead) follow(n, "then", ctx.fresh()); rel() }; return false }
        "chance" -> { follow(n, if (Random.nextDouble() * 100 < I("percent")) "yes" else "no", ctx); return false }
        "once" -> { if (state[id] == true) return false; state[id] = true }
        "sequence" -> { for (port in listOf("first", "second", "third")) follow(n, port, ctx); return false }
        "loop" -> { val c = floor(I("count")).toInt().coerceIn(0, 100); seq(n, ctx, c, { i -> mapOf("index" to i.toDouble()) }); return false }
        "flipFlop" -> { val a = state[id] != true; state[id] = a; follow(n, if (a) "A" else "B", ctx); return false }
        "cooldown" -> {
            val last = state[id]
            if (last is Double && g.time - last < I("seconds")) { follow(n, "blocked", ctx); return false }
            state[id] = g.time; follow(n, "then", ctx); return false
        }
        "countTo" -> {
            val c = lnum(state[id]) + 1; val need = max(1.0, round(I("times")))
            if (c >= need) { state[id] = if (P("after") == "stay done") need else 0.0; follow(n, "reached", ctx); return false }
            state[id] = c; follow(n, "not yet", ctx); return false
        }
        "randomBranch" -> { val ports = listOf("1", "2", "3").filter { (linkedPorts[id] ?: emptySet<String>()).contains(it) }; if (ports.isNotEmpty()) follow(n, ports.random(), ctx); return false }
        "switchNum" -> { val v = I("value").roundToInt(); follow(n, if (v in 0..3) "$v" else "other", ctx); return false }
        "compareBranch" -> { follow(n, if (lcmp(I("a"), P("op"), I("b"))) "yes" else "no", ctx); return false }
        "setPosition" -> { val o = target(); if (o != null) { o.x = I("x"); o.y = I("y"); o.body?.let { it.vx = 0.0; it.vy = 0.0 } } }
        "moveToward" -> {
            val o = lnearest(g, e, P("tag")) ?: return true
            val dx = o.x - e.x; val dy = o.y - e.y; val d = sqrt(dx * dx + dy * dy); val step = I("speed") * ctx.dt
            if (d <= step || d < 1e-6) { e.x = o.x; e.y = o.y; follow(n, "arrived", ctx); return true }
            e.x += dx / d * step; e.y += dy / d * step
        }
        "lookAt" -> { val o = lnearest(g, e, P("tag")); if (o != null) e.rz = atan2(o.y - e.y, o.x - e.x) / DEG }
        "rotateBy" -> e.rz += I("degrees")
        "setScale" -> { val k = I("scale"); e.sx = k; e.sy = k }
        "teleport" -> { val o = g.find(P("object")); if (o != null && o !== e) { e.x = o.x; e.y = o.y; e.body?.let { it.vx = 0.0; it.vy = 0.0 } } }
        "setText", "showText" -> { val k = P("object"); val o = if (k.isEmpty()) e else g.find(k); o?.text?.set("value", if (t == "showText") ltext(iv("text")) else P("text")) }
        "setColor" -> { val o = target(); if (o != null) { if (o.shape != null) o.shape!!["fill"] = P("color") else o.text?.set("color", P("color")) } }
        "particles" -> g.burst(e.x, e.y, parseColor(P("color")) ?: Color(0xFFFFD54F), I("count").coerceIn(1.0, 200.0).toInt())
        "spawnAt" -> { val k = P("at"); val at = (if (k.isEmpty()) null else g.find(k) ?: lnearest(g, e, k)) ?: e; if (P("template").isNotEmpty()) g.spawn(P("template"), at.x, at.y) }
        "destroyTag" -> for (o in g.findAll(P("tag"))) { g.burst(o.x, o.y, Color.White, 8); o.destroy() }
        "tagOp" -> if (P("tag").isNotEmpty()) { if (P("mode") == "remove") e.tags.remove(P("tag")) else e.tags.add(P("tag")) }
        "damage" -> { val o = if (P("target") == "self") e else ctx.other; val hb = o?.part<Health>(); if (o != null && hb != null) hb.damage(o, g, I("amount"), from = e) }
        "heal" -> { val o = target(); val hb = o?.part<Health>(); if (o != null && hb != null) hb.heal(o, g, I("amount")) }
        "setVar" -> g.setVar(P("name").ifEmpty { "score" }, I("value"))
        "addVar" -> g.addVar(P("name").ifEmpty { "score" }, I("amount"))
        "message" -> g.message(P("text"), if (pn2("seconds") == 0.0) 2.0 else pn2("seconds"))
        "log", "logValue" -> println("Pocket: " + (if (t == "log") g.fill(P("text")) else "${P("label").ifEmpty { "value" }} = ${ltext(iv("value"))}"))
        "sound" -> g.sfx(P("sound"))
        "spawn" -> if (P("template").isNotEmpty()) g.spawn(P("template"), e.x, e.y)
        "destroy" -> { val o = target(); if (o != null) { g.burst(o.x, o.y, Color.White, 12); o.destroy() } }
        "moveBy" -> { e.x += I("x"); e.y += I("y") }
        "setVelocity" -> { val b = e.ensureBody("dynamic"); b.vx = I("x"); b.vy = I("y") }
        "jump" -> { e.body?.let { it.vy = -I("power") }; g.sfx("jump") }
        "showHide" -> { val k = P("object"); val o = if (k.isEmpty()) e else g.find(k); if (o != null) o.visible = if (P("mode") == "show") true else if (P("mode") == "hide") false else !o.visible }
        "vibrate" -> g.buzz(true)
        "haptic", "vibratePattern" -> g.buzz(P("style") == "heavy" || P("style") == "error")
        "shake", "impulse" -> g.shake = max(g.shake, if (I("strength") == 0.0) 10.0 else I("strength"))
        "win", "nextLevel" -> { g.win(); return false }
        "gameOver" -> { g.gameOver(); return false }
        "restart" -> { g.start(); return false }
        "saveGame" -> if (g.saveGame(slot()) && P("text").isNotEmpty()) g.message(P("text"), 1.5)
        "loadGame" -> { follow(n, if (g.loadGame(slot())) "then" else "no save", ctx); return false }
        "deleteSave" -> g.deleteSave(slot())
        "push" -> { val o = target(); if (o != null) { val b = o.ensureBody("dynamic"); b.vx += I("x"); b.vy += I("y") } }
        "setGravity" -> g.gravity = I("y")
        "switchCamera", "camLive" -> g.send("camera:${P("camera")}")
        "zoomCamera", "camZoomTo" -> { val z = max(0.05, if (I("zoom") == 0.0) 1.0 else I("zoom")); val cam = g.activeCamera; if (cam != null) cam.data["camZoom"] = z else g.camZoom = z }
        "tweenTo" -> {
            val prop = P("prop"); val v = I("value"); val secs = if (I("seconds") == 0.0) 0.5 else I("seconds"); val by = P("mode") == "by" && prop != "scale"
            if (prop == "scale") { tw(e, "sx", v, secs, P("ease")); tw(e, "sy", v, secs, P("ease"), finishedLater) }
            else { val f = if (prop == "ry") "rz" else if (prop == "z") "y" else prop; tw(e, f, if (by) e.getField(f) + v else v, secs, P("ease"), finishedLater) }
        }
        "punch" -> { val o = target(); if (o != null) lpunch(g, o, P("what"), if (I("amount") == 0.0) 0.3 else I("amount"), if (I("seconds") == 0.0) 0.4 else I("seconds")) }
        "killTweens" -> g.killTweens(e)
        "tweenMove" -> {
            val m = P("mode"); val x = I("x"); val y = I("y"); val secs = I("seconds")
            if (m == "from") { val tx = e.x; val ty2 = e.y; e.x = x; e.y = y; tw(e, "x", tx, secs, P("ease")); tw(e, "y", ty2, secs, P("ease"), finishedLater) }
            else { tw(e, "x", if (m == "to") x else e.x + x, secs, P("ease")); tw(e, "y", if (m == "to") y else e.y + y, secs, P("ease"), finishedLater) }
        }
        "tweenToObj" -> { val o = g.find(P("object")) ?: lnearest(g, e, P("object")); if (o != null) { tw(e, "x", o.x, I("seconds"), P("ease")); tw(e, "y", o.y, I("seconds"), P("ease"), finishedLater) } }
        "spin" -> {
            val forever = P("repeat") == "forever"; val secs = I("seconds"); val deg2 = I("degrees")
            lateinit var go: () -> Unit
            go = { if (!e.dead) tw(e, "rz", e.rz + deg2, secs, if (forever) "linear" else P("ease"), if (forever) go else finishedLater) }
            go()
        }
        "pulse" -> {
            val k = if (I("amount") == 0.0) 1.0 else I("amount"); val secs = I("seconds"); val forever = P("repeat") == "forever"; val bx = e.sx; val by = e.sy
            lateinit var go: () -> Unit
            go = { if (!e.dead) { g.tween(e, "sx", bx * k, max(0.01, secs), curve = "inOutSine", yoyo = true); g.tween(e, "sy", by * k, max(0.01, secs), curve = "inOutSine", yoyo = true, done = if (forever) go else null) } }
            go()
        }
        "tweenVar" -> {
            val k = P("name").ifEmpty { "score" }; val from = g.numVar(k); val to = I("to"); val secs = max(0.01, I("seconds")); val t0 = g.time
            lateinit var tick: () -> Unit
            tick = { val f = ((g.time - t0) / secs).coerceIn(0.0, 1.0); g.setVar(k, from + (to - from) * ease(P("ease").ifEmpty { "outQuad" }, f)); if (f < 1) g.after(1.0 / 60, tick) else finishedLater() }
            tick()
        }
        "typeText" -> {
            val o = (if (P("object").isEmpty()) e else g.find(P("object"))) ?: return true
            val full = g.fill(P("text")); val secs = max(0.01, I("seconds")); val t0 = g.time
            val txt = o.text
            lateinit var tick: () -> Unit
            tick = { val f = ((g.time - t0) / secs).coerceIn(0.0, 1.0); txt?.set("value", full.substring(0, floor(full.length * f).toInt())); if (f < 1) g.after(1.0 / 60, tick) else finishedLater() }
            tick()
        }
        "fadeTo" -> tw(e, "alpha", I("alpha").coerceIn(0.0, 1.0), if (I("seconds") == 0.0) 0.5 else I("seconds"), "outQuad", finishedLater)
        "delayedCall" -> g.after(max(0.0, I("seconds"))) { if (!e.dead) follow(n, "later", ctx.fresh()) }
        "popText" -> g.popText(g.screenOf(e), g.fill(P("text")), parseColor(P("color")) ?: Color(0xFFFFD23D), if (pn2("size") == 0.0) 26.0 else pn2("size"))
        "flashScreen" -> lscreenFade(g, parseColor(P("color")) ?: Color.White, 0.01, 0.0, max(0.01, I("seconds")))
        "randomVar" -> { val a = I("min").roundToInt(); val b = I("max").roundToInt(); g.setVar(P("name").ifEmpty { "roll" }, (min(a, b) + Random.nextInt(abs(b - a) + 1)).toDouble()) }
        "waitUntil" -> {
            val start = g.time; val limit = pn2("timeout"); val c2 = ctx.fresh(); val rel = hold(ctx)
            lateinit var check: () -> Unit
            check = {
                if (e.dead) rel()
                else if (ltruthy(input(n, "condition", c2))) { follow(n, "then", c2.fresh()); rel() }
                else if (limit > 0 && g.time - start >= limit) rel()
                else g.after(0.0, check)
            }
            check(); return false
        }
        "randomWait" -> { val a = I("min"); val b = I("max"); val rel = hold(ctx); g.after(max(0.0, rand(min(a, b), max(a, b)))) { if (!e.dead) follow(n, "then", ctx.fresh()); rel() }; return false }
        "flipX" -> {
            val m = P("mode")
            if (e.shape?.get("type") == "emoji") e.data["flipX"] = if (m == "face right") true else if (m == "face left") false else e.data["flipX"] != true
            else if (m == "toggle") e.sx = -e.sx else e.sx = abs(e.sx) * (if (m == "face left") -1 else 1)
        }
        "blink" -> {
            val end = g.time + max(0.05, I("seconds")); val bid = lnum(e.data["_blink"]) + 1
            e.data["_blink"] = bid
            lateinit var tick: () -> Unit
            tick = { if (!e.dead && e.data["_blink"] == bid) { if (g.time >= end) e.visible = true else { e.visible = !e.visible; g.after(0.1, tick) } } }
            tick()
        }
        "toggleVar" -> { val k = P("name").ifEmpty { "on" }; g.setVar(k, if (g.numVar(k) != 0.0) 0.0 else 1.0) }
        "setBackground" -> g.background = parseColor(P("color")) ?: g.background
        "setAlpha" -> e.alpha = I("alpha").coerceIn(0.0, 1.0)
        "stopMoving" -> target()?.body?.let { it.vx = 0.0; it.vy = 0.0 }
        "gravityScale" -> e.ensureBody("dynamic").gravityScale = I("scale")
        "sendMessage", "sendValue" -> g.send(P("message"))
        "addForce" -> {
            val o = target() ?: return true
            val b = o.ensureBody("dynamic"); val k = if (P("mode") == "force (every frame)") ctx.dt else 1.0
            b.vx += I("x") * k; b.vy += I("y") * k
        }
        "explosion" -> {
            val r = if (I("radius") > 0) I("radius") else 300.0; val f = if (I("force") > 0) I("force") else 900.0
            for (q in g.objects) {
                val b = q.body
                if (q === e || q.dead || q.ui || b == null || !b.isDynamic || !tagOk(q, P("tag"))) continue
                val dx = q.x - e.x; val dy = q.y - e.y; val d = sqrt(dx * dx + dy * dy)
                if (d > r) continue
                val k = f * (1 - d / r) / (if (d == 0.0) 1.0 else d)
                b.vx += dx * k; b.vy += (if (dy == 0.0) -0.3 * d else dy) * k
            }
            g.shake = max(g.shake, min(20.0, f / 80))
        }
        "setBodyType" -> { val o = target(); if (o != null) { val b = o.ensureBody(P("type")); b.type = P("type"); if (!b.isDynamic) { b.vx = 0.0; b.vy = 0.0 } } }
        "setTrigger" -> { val o = target(); if (o != null) { val b = o.ensureBody("kinematic"); b.sensor = if (P("mode") == "toggle") !b.sensor else P("mode") == "trigger" } }
        "physMaterial" -> { val b = e.ensureBody("dynamic"); b.bounce = max(0.0, I("bounce")); b.friction = max(0.0, I("friction")) }
        "setMyVar" -> setMy(e, P("name").ifEmpty { "hp" }, I("value"))
        "addMyVar" -> { val k = P("name").ifEmpty { "hp" }; setMy(e, k, lnum(e.data[k]) + I("amount")) }
        "setOtherVar" -> setMy(ctx.other, P("name").ifEmpty { "hp" }, I("value"))
        "callEvent" -> {
            val on = P("on"); val name = P("name"); val raw = iv("value"); val v: Any = if (raw is Number) raw else lval(raw ?: 0.0); val tag = P("tag"); val nm = if (on == "object named") g.find(tag) else null
            val other = ctx.other
            val whoT: (GameObject) -> Boolean = when (on) { "other" -> { q -> q === other }; "all with tag" -> { q -> q.has(tag) }; "everything" -> { _ -> true }; "object named" -> { q -> q === nm }; else -> { q -> q === e } }
            LogicBus.of(g).emit("graphCall", listOf(name, whoT, e, v))
        }
        "changeVar", "clampVar" -> {
            val k = P("name").ifEmpty { "score" }; val sc = P("scope"); val w = if (sc == "this object") e else if (sc == "other") ctx.other else null
            if (sc == "other" && w == null) return true
            val cur = lnum(if (w != null) w.data[k] else g.vars[k]); val v = I("value")
            val nv = if (t == "clampVar") cur.coerceIn(min(I("min"), I("max")), max(I("min"), I("max")))
            else when (P("op")) { "set" -> v; "subtract" -> cur - v; "multiply" -> cur * v; "divide" -> if (v == 0.0) cur else cur / v; "min" -> min(cur, v); "max" -> max(cur, v); "power" -> cur.pow(v); "mod" -> if (v == 0.0) cur else ((cur % v) + v) % v; else -> cur + v }
            if (w != null) setMy(w, k, nv) else g.setVar(k, nv)
        }
        "copyVar" -> { val v = g.vars[P("from")]; g.setVar(P("to").ifEmpty { "copy" }, if (v is List<*>) v.toMutableList() else v ?: 0.0) }
        "toggleMyVar" -> { val k = P("name").ifEmpty { "on" }; setMy(e, k, if (lnum(e.data[k]) != 0.0) 0.0 else 1.0) }
        "resetVars" -> {
            val start = lmapOf(g.json["vars"]) ?: emptyMap(); val names = P("names").split(",").map { it.trim() }.filter { it.isNotEmpty() }
            val skip = Regex("^(time|best|level|net|pf|online|item_|inventory)")
            for (k in names.ifEmpty { g.vars.keys.filter { !skip.containsMatchIn(it) } }) {
                val s0 = start[k]
                g.setVar(k, if (s0 is List<*>) s0.toMutableList() else s0 ?: (if (g.vars[k] is List<*>) mutableListOf<Any?>() else 0.0))
            }
        }
        "setTextVar" -> g.setVar(P("name").ifEmpty { "text" }, g.fill(P("text"), e))
        "setTextTo" -> g.setVar(P("name").ifEmpty { "text" }, ltext(iv("text")))
        "clearVars" -> for (k in P("names").split(",").map { it.trim() }.filter { it.isNotEmpty() }) g.setVar(k, if (g.vars[k] is List<*>) mutableListOf<Any?>() else "")
        "runFuncOn" -> {
            var found = false
            val store = P("store")
            for (o in whoOf(P("on"), P("object"), ctx)) {
                val r = o.part<VisualScript>()?.callFn(P("name"), abc(), e, if (store.isEmpty()) null else { v -> g.setVar(store, v) })
                if (r != null && r.first) { found = true; if (store.isNotEmpty()) g.setVar(store, r.second) }
            }
            follow(n, if (found) "then" else "not found", ctx); return false
        }
        "setObjVar" -> {
            val o = named(P("object"), ctx)
            if (o == null) { follow(n, "not found", ctx); return false }
            val k = P("name").ifEmpty { "value" }; val raw = iv("value"); val v: Any = if (raw is Number) raw else lval(raw); val cur = lnum(o.data[k])
            setMy(o, k, when (P("op")) { "add" -> cur + lnum(v); "subtract" -> cur - lnum(v); "multiply" -> cur * lnum(v); else -> v })
        }
        "runTriggerN" -> LogicBus.of(g).emit("runTrigger", listOf(P("name")))
        "camFocus", "camToObject", "camMoveTo" -> {
            var x = I("x"); var y = I("y")
            if (t != "camMoveTo") { val o = g.find(P("object")) ?: lnearest(g, e, P("object")) ?: return true; x = o.x; y = o.y }
            g.systems["camFollow"] = null
            val cx = g.camX; val cy = g.camY; val secs = max(0.001, I("seconds")); val t0 = g.time
            lateinit var tick: () -> Unit
            tick = {
                val f = ease("inOutCubic", ((g.time - t0) / secs).coerceIn(0.0, 1.0)); g.camX = cx + (x - cx) * f; g.camY = cy + (y - cy) * f
                if (g.time - t0 < secs) g.after(1.0 / 60, tick) else if (!e.dead) follow(n, if (t == "camFocus") "back" else "arrived", ctx.fresh())
            }
            tick()
        }
        "zoomPunch" -> {
            val z = g.camZoom; val a = if (I("amount") == 0.0) 0.12 else I("amount"); val secs = max(0.05, if (I("seconds") == 0.0) 0.25 else I("seconds")); val t0 = g.time
            lateinit var tick: () -> Unit
            tick = { val k = (g.time - t0) / secs; if (k >= 1) g.camZoom = z else { g.camZoom = z * (1 + sin(PI * k) * a); g.after(1.0 / 60, tick) } }
            tick()
        }
        "setDarkness" -> g.darkness = I("darkness").coerceIn(0.0, 1.0)
        "saveVar" -> { val k = P("name").ifEmpty { "coins" }; store("pocket.var.${g.saveKey}.$k", toJsonValue(g.vars[k] ?: 0.0).toString()) }
        "loadVar" -> {
            val k = P("name").ifEmpty { "coins" }; val raw = stored("pocket.var.${g.saveKey}.$k")
            if (raw == null) { follow(n, "not saved yet", ctx); return false }
            g.setVar(k, parseJson(raw)); follow(n, "loaded", ctx); return false
        }
        "deleteSavedVar" -> store("pocket.var.${g.saveKey}.${P("name").ifEmpty { "coins" }}", "")
        "listAdd", "arrAdd" -> { val a = lvarList(g, P("name")).toMutableList(); val v: Any = if (t == "listAdd") I("value") else lval(iv("value")); if (P("where") == "at the start") a.add(0, v) else a.add(v); g.setVar(P("name"), a) }
        "listRemove" -> {
            val a = lvarList(g, P("name")).toMutableList(); val m = P("mode"); val v = I("n")
            val k = when (m) { "last" -> a.size - 1; "first" -> 0; "at position" -> v.roundToInt() - 1; else -> a.indexOfFirst { lnum(it) == v } }
            if (k < 0 || k >= a.size) { follow(n, "nothing removed", ctx); return false }
            a.removeAt(k); g.setVar(P("name"), a)
        }
        "listSet" -> { val a = lvarList(g, P("name")).toMutableList(); val k = I("position").roundToInt() - 1; if (k in 0 until 1000) { while (a.size <= k) a.add(0.0); a[k] = I("value"); g.setVar(P("name"), a) } }
        "listClear" -> g.setVar(P("name"), mutableListOf<Any?>())
        "listOrder" -> {
            val a = lvarList(g, P("name")).toMutableList(); val m = P("mode")
            if (m == "shuffle") a.shuffle() else if (m == "reverse") a.reverse() else if (m == "sort big → small") a.sortByDescending { lnum(it) } else a.sortBy { lnum(it) }
            g.setVar(P("name"), a)
        }
        "listFill" -> { val a0 = I("from").roundToInt(); val b0 = I("to").roundToInt(); val st = if (b0 >= a0) 1 else -1; val a = mutableListOf<Any?>(); var k = a0; while (if (st > 0) k <= b0 else k >= b0) { a.add(k.toDouble()); if (a.size >= 1000) break; k += st }; g.setVar(P("name"), a) }
        "forEachList" -> { val a = lvarList(g, P("name")).take(1000); seq(n, ctx, a.size, { i -> mapOf("index" to (i + 1).toDouble(), "item" to a[i]) }); return false }
        "funcReturn" -> { val r = ctx.ret; if (r != null && !r.done) { r.v = I("value"); r.done = true; r.late?.invoke() }; return false }
        "runFunc" -> {
            var rel: (() -> Unit)? = null
            var sync: Any = true
            val store = P("store")
            callFunction(ctx, P("name"), abc()) { v, late ->
                if (store.isNotEmpty()) g.setVar(store, v)
                if (late || sync != true) { if (!e.dead) follow(n, "then", ctx.fresh()); rel?.invoke() } else sync = "now"
            }
            if (sync == "now") return true
            sync = false; rel = hold(ctx); return false
        }
        "callLater" -> {
            val name = P("name"); val v = I("value"); val all = P("on") == "everything"
            g.after(max(0.0, I("seconds"))) { if (!e.dead || all) LogicBus.of(g).emit("graphCall", listOf(name, if (all) { _: GameObject -> true } else { q: GameObject -> q === e }, e, v)) }
        }
        "forRange" -> {
            val a = I("from"); val b = I("to"); val st = (if (I("step") == 0.0) 1.0 else abs(I("step"))) * (if (b >= a) 1 else -1)
            val cnt = min(1000, floor((b - a) / st + 1e-9).toInt() + 1)
            seq(n, ctx, max(0, cnt), { k -> mapOf("index" to a + k * st) }); return false
        }
        "repeatEvery" -> {
            val secs = max(0.02, if (I("seconds") == 0.0) 0.5 else I("seconds")); val times = floor(I("times")).toInt(); val rid = P("id"); val token = Any()
            repeats.getOrPut(rid) { mutableSetOf() }.add(token)
            var k = 0
            val later = ctx.fresh()
            lateinit var tick: () -> Unit
            tick = tick@{
                if (e.dead || repeats[rid]?.contains(token) != true) return@tick
                follow(n, "each", later.fresh().also { it.index = k.toDouble() })
                k++
                if (times > 0 && k >= times) { repeats[rid]?.remove(token); follow(n, "done", later.fresh()); return@tick }
                g.after(secs, tick)
            }
            tick(); return false
        }
        "stopRepeat" -> { val rid = P("id"); if (rid.isNotEmpty()) repeats.remove(rid) else repeats.clear() }
        "cycle" -> { val c = pn2("count").roundToInt().coerceIn(2, 4); val k = lnum(state[id]).toInt(); state[id] = ((k + 1) % c).toDouble(); follow(n, "${k + 1}", ctx); return false }
        "weighted" -> {
            val ports = listOf("A", "B", "C"); val w = ports.map { max(0.0, I(it)) }; val tot = w.sum()
            if (tot <= 0) return false
            var r = Random.nextDouble() * tot
            for (k in ports.indices) { r -= w[k]; if (r < 0) { follow(n, ports[k], ctx); return false } }
            follow(n, "C", ctx); return false
        }
        "gate" -> { val key = "gate:${P("name")}"; if (!state.containsKey(key)) state[key] = param(n, "startOpen") != false; follow(n, if (state[key] == true) "open" else "closed", ctx); return false }
        "setGate" -> {
            val key = "gate:${P("name")}"; val gn = nodes.firstOrNull { it["type"] == "gate" && ps(it, "name") == P("name") }
            val cur = if (state.containsKey(key)) state[key] == true else (gn == null || param(gn, "startOpen") != false)
            state[key] = if (P("mode") == "open") true else if (P("mode") == "close") false else !cur
        }
        "waitFrames" -> { frameQueue.add(max(1, I("frames").roundToInt()) to { if (!e.dead) follow(n, "then", ctx.fresh()) }); return false }
        "spawnLaunch" -> {
            val c = g.spawn(P("template"), e.x, e.y) ?: return true
            val sp = I("speed"); val dir = P("dir")
            var d: Pair<Double, Double>? = when (dir) { "up" -> 0.0 to -1.0; "down" -> 0.0 to 1.0; "left" -> -1.0 to 0.0; "right" -> 1.0 to 0.0; "random" -> { val a = rand(0.0, PI * 2); cos(a) to sin(a) }; else -> null }
            if (dir == "toward tag") { val o = lnearest(g, e, P("tag")); if (o != null) d = (o.x - e.x) to (o.y - e.y) }
            if (dir == "toward finger") { val f = g.pointers.values.firstOrNull()?.at ?: g.taps.firstOrNull()?.screen; if (f != null) { val w = g.toWorld(f); d = (w.x - e.x) to (w.y - e.y) } }
            val fk = if (e.data["flipX"] == true || e.sx < 0) -1.0 else 1.0
            val dd = d ?: ((cos(e.rz * DEG) * fk) to (sin(e.rz * DEG) * fk))
            val l = hypot(dd.first, dd.second).let { if (it == 0.0) 1.0 else it }; val b = c.ensureBody("dynamic", gravityScale = 0.0)
            b.vx = dd.first / l * sp; b.vy = dd.second / l * sp
            c.rz = atan2(dd.second, dd.first) / DEG
            follow(n, "then", ctx.clone().also { it.other = c }); return false
        }
        "moveToFinger" -> {
            val f = g.pointers.values.firstOrNull { it.role == "free" }?.at ?: g.taps.firstOrNull()?.screen ?: return true
            val w = g.toWorld(f); val sp = I("speed")
            if (sp == 0.0) { e.x = w.x.toDouble(); e.y = w.y.toDouble() } else { val dx = w.x - e.x; val dy = w.y - e.y; val d = sqrt(dx * dx + dy * dy); val st = min(d, sp * ctx.dt); if (d > 0) { e.x += dx / d * st; e.y += dy / d * st } }
        }
        "lookAtFinger" -> { val f = g.pointers.values.firstOrNull()?.at ?: g.taps.firstOrNull()?.screen; if (f != null) { val w = g.toWorld(f); e.rz = atan2(w.y - e.y, w.x - e.x) / DEG } }
        "celebrate" -> { g.send("celebrate"); g.burst(e.x, e.y, Color(0xFFFFD23D), 40, 1.4) }
        "pauseGame" -> g.paused = if (P("mode") == "pause") true else if (P("mode") == "resume") false else !g.paused
        "addScore" -> { val a = I("amount"); g.addVar("score", a); if (param(n, "pop") != false && a != 0.0) g.popText(g.screenOf(e), (if (a > 0) "+" else "") + formatNumber(a), Color(0xFFFFD23D), 26.0) }
        "loseLife" -> {
            val left = max(0.0, g.numVar("lives") - 1); g.setVar("lives", left); g.buzz(true)
            if (left <= 0) { follow(n, "no lives left", ctx); if (param(n, "end") != false) g.gameOver(); return false }
        }
        "gainLife" -> { val mx = pn2("max"); val v = g.numVar("lives") + (if (I("amount") == 0.0) 1.0 else I("amount")); g.setVar("lives", if (mx > 0) min(mx, v) else v) }
        "checkBest" -> {
            val sc = floor(g.numVar("score")); val best = g.numVar("best")
            if (sc > best) { g.setVar("best", sc); store("pocket.best.${g.saveKey}", sc.toString()); g.newBest = true; follow(n, "new best", ctx); return false }
            follow(n, "not", ctx); return false
        }
        "addTime" -> g.setVar("time", max(0.0, (if (P("mode") == "set") 0.0 else g.numVar("time")) + I("seconds")))
        "setCheckpoint" -> { val pl = g.findAll("player").firstOrNull(); if (pl != null) { val at = if (P("at") == "this object") e else pl; pl.data["respawn"] = Offset(at.x.toFloat(), at.y.toFloat()); pl.data["respawnOnHit"] = true } }
        "respawn" -> { val pl = g.findAll("player").firstOrNull(); if (pl != null) g.hurt(pl, "respawn") }
        "combo" -> {
            val w = max(0.1, if (pn2("window") == 0.0) 1.5 else pn2("window")); val now = g.time; val last = g.systems["comboT"]
            g.setVar("combo", (if (last is Double && now - last <= w) g.numVar("combo") else 0.0) + 1)
            g.systems["comboT"] = now
            g.after(w + 0.01) { if (g.systems["comboT"] == now) g.setVar("combo", 0.0) }
        }
        "unlock" -> {
            val nm = P("name").ifEmpty { "Achievement" }; val key = "pocket.ach.${g.saveKey}.$nm"
            if (stored(key) == "1") { follow(n, "already", ctx); return false }
            store(key, "1"); g.setVar("ach_${nm.replace(Regex("\\W+"), "_")}", 1.0)
            if (param(n, "show") != false) { g.message("🏆 $nm", 2.0); g.sfx("win") }
            follow(n, "first time", ctx); return false
        }
        "whileLoop", "repeatUntil" -> {
            val mx = pn2("max").roundToInt().coerceIn(1, 10000); val until = t == "repeatUntil"
            seq(n, ctx, mx, { i -> val c = ltruthy(input(n, if (until) "stop when" else "condition", ctx)); if (if (until) c else !c) null else mapOf("index" to i.toDouble()) }); return false
        }
        "breakLoop" -> { ctx.loop?.stop = true; return false }
        "continueLoop" -> return false
        "switchText" -> { val s = ltext(iv("text")).trim().lowercase(); val cs = P("cases").split(",").map { it.trim().lowercase() }.take(5); val k = cs.indexOf(s); follow(n, if (k >= 0) "case ${k + 1}" else "other", ctx); return false }
        "arrInsert" -> { val a = lvarList(g, P("name")).toMutableList(); val k = (I("position").roundToInt() - 1).coerceIn(0, a.size); a.add(k, lval(iv("value"))); g.setVar(P("name"), a) }
        "arrSplit" -> { val sep = if (param(n, "sep") == null) "," else ltext(param(n, "sep")); g.setVar(P("name"), (if (sep.isEmpty()) ltext(iv("text")).map { it.toString() } else ltext(iv("text")).split(sep)).map { it.trim() }.filter { it.isNotEmpty() }.map { lval(it) }.toMutableList()) }
        "arrSlice" -> { val a = lvarList(g, P("name")); val f = max(1, I("from").roundToInt()); val to = if (iv("to position") == null) a.size else I("to position").roundToInt(); g.setVar(P("to").ifEmpty { "part" }, a.subList(min(a.size, f - 1), min(a.size, max(f - 1, to))).toMutableList()) }
        "arrConcat" -> g.setVar(P("to").ifEmpty { "all" }, (lvarList(g, P("a")) + lvarList(g, P("b"))).toMutableList())
        "arrUnique" -> { val out = mutableListOf<Any?>(); for (v in lvarList(g, P("name"))) if (out.none { lsame(it, v) }) out.add(v); g.setVar(P("name"), out) }
        "arrFilter" -> {
            val v = lval(iv("value")); val op = P("op")
            fun test(x: Any?): Boolean {
                val a = ltext(x).toDoubleOrNull(); val b = ltext(v).toDoubleOrNull(); val numeric = a != null && b != null
                return when (op) { "=" -> lsame(x, v); "≠" -> !lsame(x, v); ">" -> numeric && a!! > b!!; "<" -> numeric && a!! < b!!; "≥" -> numeric && a!! >= b!!; "≤" -> numeric && a!! <= b!!; "contains" -> ltext(x).lowercase().contains(ltext(v).lowercase()); else -> true }
            }
            g.setVar(P("to").ifEmpty { P("name") }, lvarList(g, P("name")).filter { test(it) }.toMutableList())
        }
        "arrMap" -> {
            val v = iv("value"); val op = P("op")
            fun f(x: Any?): Any? = when (op) { "add" -> lnum(x) + lnum(v); "multiply" -> lnum(x) * lnum(v); "round" -> round(lnum(x)); "abs" -> abs(lnum(x)); "UPPER" -> ltext(x).uppercase(); "lower" -> ltext(x).lowercase(); else -> x }
            g.setVar(P("name"), lvarList(g, P("name")).map { f(it) }.toMutableList())
        }
        "arrSwap" -> { val a = lvarList(g, P("name")).toMutableList(); val i = I("a").roundToInt() - 1; val j = I("b").roundToInt() - 1; if (i >= 0 && j >= 0 && i < a.size && j < a.size) { val tmp = a[i]; a[i] = a[j]; a[j] = tmp; g.setVar(P("name"), a) } }
        "mapSet" -> { val m = lvarMap(g, P("name")).toMutableMap(); m[ltext(iv("key"))] = lval(iv("value")); g.setVar(P("name"), m) }
        "mapAdd" -> { val m = lvarMap(g, P("name")).toMutableMap(); val k = ltext(iv("key")); m[k] = lnum(m[k]) + I("amount"); g.setVar(P("name"), m) }
        "mapRemove" -> { val m = lvarMap(g, P("name")).toMutableMap(); m.remove(ltext(iv("key"))); g.setVar(P("name"), m) }
        "mapClear" -> g.setVar(P("name"), mutableMapOf<String, Any?>())
        "mapKeys" -> g.setVar(P("to").ifEmpty { "keys" }, lvarMap(g, P("name")).keys.toMutableList<Any?>())
        "mapForEach" -> { val m = lvarMap(g, P("name")).entries.take(1000); seq(n, ctx, m.size, { i -> mapOf("index" to (i + 1).toDouble(), "key" to m[i].key, "item" to m[i].value) }); return false }
        "waitEvent" -> {
            val later = ctx.fresh(); val name = P("message"); val to = pn2("timeout")
            var done = false
            g.on { m -> if (!done && !e.dead && m == name) { done = true; follow(n, "then", later.fresh()) } }
            if (to > 0) g.after(to) { if (!done && !e.dead) { done = true; follow(n, "timed out", later.fresh()) } }
            return false
        }
        "setDelegate" -> g.setVar(P("var"), P("func"))
        "callDelegate" -> {
            val f = ltext(g.vars[P("var")])
            if (f.isEmpty()) { follow(n, "empty", ctx); return false }
            val v = callFunction(ctx, f, abc())
            if (P("store").isNotEmpty()) g.setVar(P("store"), v)
        }
        "bindMessage" -> { val key = "${P("message")}|${P("func")}"; if (P("mode") == "stop listening") bindings.remove(key) else bindings[key] = GBinding(P("message"), P("func")) }
        "everyNth" -> { val c = lnum(state[id]) + 1; state[id] = c; follow(n, if (c % max(1, pn2("n").roundToInt()) == 0.0) "then" else "skip", ctx); return false }
        "firstTimeEver" -> {
            val key = "pocket.first.${g.saveKey}.${P("key").ifEmpty { "x" }}"; val seen = stored(key) != null
            if (!seen) store(key, "1")
            follow(n, if (seen) "seen before" else "first time", ctx); return false
        }
        "timerStart" -> {
            val k = P("name").ifEmpty { "timer" }; val secs = max(0.0, I("seconds")); val down = P("mode") != "count up (stopwatch)"
            namedTimers[k] = GTimer(if (down) secs else 0.0, secs, down, true)
            g.setVar(k, if (down) ceil(secs) else 0.0)
        }
        "timerControl" -> {
            val k = P("name").ifEmpty { "timer" }; val tm = namedTimers[k] ?: return true
            when (P("do")) {
                "pause" -> namedTimers[k] = tm.copy(running = false)
                "resume" -> namedTimers[k] = tm.copy(running = if (tm.down) tm.t > 0 else true)
                "stop" -> { namedTimers.remove(k); g.setVar(k, 0.0) }
                else -> { val nt = max(0.0, tm.t + I("seconds")); namedTimers[k] = tm.copy(t = nt, total = if (tm.down) max(tm.total, nt) else tm.total); if (tm.down) g.setVar(k, ceil(nt)) }
            }
        }
        "dailyCheck" -> {
            val key = "pocket.daily.${g.saveKey}.${P("key").ifEmpty { "daily" }}"; val sv = P("streak").ifEmpty { "streak" }
            val ms = nowMs().toLong(); val today = dayOf(ms); val yest = dayOf(ms - 86_400_000L)
            val rec = lmapOf(parseJson(stored(key) ?: "{}")) ?: emptyMap()
            if (rec["day"] == today) { g.setVar(sv, rec["streak"] ?: 1.0); follow(n, "same day", ctx); return false }
            val streak = if (rec["day"] == yest) lnum(rec["streak"]) + 1 else 1.0
            store(key, toJsonValue(mapOf("day" to today, "streak" to streak)).toString())
            g.setVar(sv, streak); follow(n, "new day", ctx); return false
        }
        "stampTime" -> store("pocket.time.${g.saveKey}.${P("key").ifEmpty { "lastPlayed" }}", "${nowMs().toLong()}")
        "chase", "flee", "keepDistance" -> {
            val o = lnearest(g, e, P("tag")) ?: return true
            val sp = (if (I("speed") == 0.0) 140.0 else I("speed")) * ctx.dt; val dx = o.x - e.x; val dy = o.y - e.y; val d = max(1e-6, sqrt(dx * dx + dy * dy))
            val dir: Int
            if (t == "chase") { val stop = if (I("stopAt") == 0.0) 36.0 else I("stopAt"); if (d <= stop) { follow(n, "caught", ctx); return true }; dir = 1 }
            else if (t == "flee") { val safe = if (I("safeDistance") == 0.0) 260.0 else I("safeDistance"); if (d >= safe) { follow(n, "safe", ctx); return true }; dir = -1 }
            else { val want = if (I("distance") == 0.0) 150.0 else I("distance"); dir = if (abs(d - want) < 3) 0 else if (d > want) 1 else -1 }
            val step = min(sp, if (t == "chase") d else Double.POSITIVE_INFINITY)
            e.x += dx / d * step * dir; e.y += dy / d * step * dir
        }
        "wander" -> {
            val sp = (if (I("speed") == 0.0) 60.0 else I("speed")) * ctx.dt; val r = if (I("radius") == 0.0) 150.0 else I("radius")
            @Suppress("UNCHECKED_CAST") val home = state.getOrPut("home:$id") { e.x to e.y } as Pair<Double, Double>
            fun pick(): Pair<Double, Double> { val a = rand(0.0, PI * 2); val rr = sqrt(Random.nextDouble()) * r; return (home.first + cos(a) * rr) to (home.second + sin(a) * rr) }
            @Suppress("UNCHECKED_CAST") val goal = state.getOrPut("goal:$id") { pick() } as Pair<Double, Double>
            val dx = goal.first - e.x; val dy = goal.second - e.y; val d = sqrt(dx * dx + dy * dy)
            if (d <= sp) { e.x = goal.first; e.y = goal.second; state["goal:$id"] = pick() } else { e.x += dx / d * sp; e.y += dy / d * sp }
        }
        "orbit" -> {
            val o = lnearest(g, e, P("tag")) ?: return true
            val r = if (I("radius") == 0.0) 100.0 else I("radius")
            var a = state["ang:$id"] as? Double ?: atan2(e.y - o.y, e.x - o.x)
            a += I("degreesPerSecond") * DEG * ctx.dt; state["ang:$id"] = a
            e.x = o.x + cos(a) * r; e.y = o.y + sin(a) * r
        }
        "patrol" -> {
            val vert = P("axis") == "up / down"; val f = if (vert) "y" else "x"; val dd = if (I("distance") == 0.0) 140.0 else I("distance"); val sp = (if (I("speed") == 0.0) 80.0 else I("speed")) * ctx.dt
            val o = state.getOrPut("o:$id") { e.getField(f) } as Double
            var dir = lnum(state["d:$id"] ?: 1.0)
            e.setField(f, e.getField(f) + sp * dir)
            if ((dir > 0 && e.getField(f) >= o + dd) || (dir < 0 && e.getField(f) <= o)) { e.setField(f, if (dir > 0) o + dd else o); dir = -dir; state["d:$id"] = dir; follow(n, "turned", ctx) }
        }
        "toast" -> g.message(g.fill(P("text"), e), max(0.3, if (I("seconds") == 0.0) 2.0 else I("seconds")))
        "alert", "confirm" -> { g.message(g.fill(P("title"), e) + (if (P("text").isEmpty()) "" else " — ${g.fill(P("text"), e)}"), 2.5); follow(n, if (t == "alert") "closed" else "yes", ctx.fresh()); return false }
        "askText" -> { follow(n, "cancelled", ctx); return false }
        "raycast" -> {
            val h = ray(n, ctx)
            if (h != null) { val c = ctx.clone().also { it.hit = h }; if (h.o != null) c.other = h.o; follow(n, "hit", c) } else follow(n, "miss", ctx)
            return false
        }
        "overlap", "forEachTag" -> {
            val r = if (t == "overlap") (if (I("radius") > 0) I("radius") else 150.0) else Double.POSITIVE_INFINITY; val tag = P("tag")
            val l = g.objects.filter { q -> q !== e && !q.dead && !q.ui && (if (t == "overlap") tagOk(q, tag) else tag.isNotEmpty() && q.has(tag)) && ldist(q, e) <= r }.sortedBy { ldist(it, e) }.take(100)
            seq(n, ctx, l.size, { i -> mapOf("other" to l[i], "index" to i.toDouble()) }, if (t == "forEachTag") null else { { if (l.isNotEmpty()) follow(n, "found", ctx.clone().also { it.other = l.first() }) else follow(n, "none", ctx) } })
            return false
        }
        "pickNearest" -> { val o = lnearest(g, e, P("tag")); val mx = if (I("maxDistance") > 0) I("maxDistance") else Double.POSITIVE_INFINITY; if (o != null && ldist(o, e) <= mx) follow(n, "found", ctx.clone().also { it.other = o }) else follow(n, "none", ctx); return false }
        "pickObject" -> { val k = P("object"); val o = g.find(k) ?: lnearest(g, e, k); if (o != null) follow(n, "found", ctx.clone().also { it.other = o }) else follow(n, "none", ctx); return false }
        "lineOfSight" -> { val o = lnearest(g, e, P("tag")); if (o != null && g.canSee(e, o) && (pn2("range") <= 0 || ldist(o, e) <= pn2("range"))) follow(n, "visible", ctx.clone().also { it.other = o }) else follow(n, "blocked", ctx.clone().also { it.other = o ?: ctx.other }); return false }
        "goToPage" -> g.setVar(P("var").ifEmpty { "page" }, P("page"))
        "goBack" -> { follow(n, "nowhere to go", ctx); return false }
        else -> if (graphWebOnly(t)) g.send(t)
    }
    return true
}

// ---- events ----
fun GraphRun.fire(type: String, filter: ((Map<String, Any?>) -> Boolean)? = null, other: GameObject? = null, dt: Double = 1.0 / 60, eventValue: Any? = null, impact: Double = 0.0) {
    if (e.dead && type != "destroyed") return
    for (n in nodes.toList()) {
        if (n["type"] == type && n["off"] != true && (filter == null || filter(n))) follow(n, "then", GCtx(other = other, dt = dt, eventValue = eventValue, impact = impact))
    }
}
fun GraphRun.leEvent(n: Map<*, *>): Map<String, Any?> { val m = mutableMapOf<String, Any?>("type" to ty(n).substring(3)); lmapOf(n["params"])?.let { m.putAll(it) }; return m }
private fun GraphRun.edge(n: Map<*, *>, key: String, now: Any?): Boolean { val k = "${n["id"]}:$key"; val was = state[k]; state[k] = now; return was == true }
private fun GraphRun.was(n: Map<*, *>, key: String, now: Any?): Any? { val k = "${n["id"]}:$key"; val was = state[k]; state[k] = now; return was }
private val touchTypes = listOf("touch", "touchEnd", "triggerEnter", "triggerExit", "triggerStay", "collisionEnter", "collisionExit", "collisionStay")

fun GraphRun.startGraph(e: GameObject, g: PocketGame) {
    this.e = e; this.g = g
    leNodes = nodes.filter { ty(it).startsWith("le_") && it["off"] != true }
    val touchEvents = has(touchTypes)
    if (leNodes.isNotEmpty()) lw = LogicWatcher(e, g, contacts = lusesTouch(leNodes.map { leEvent(it) }))
    if (has(listOf("tap", "onDoubleTap", "onLongPress", "onDragThis", "le_tap", "le_doubleTap", "le_longPress")) && e.ui) g.tapTargets.add(e)
    if (touchEvents && e.body == null && has(listOf("collisionEnter", "collisionExit", "collisionStay"))) e.ensureBody("kinematic")
    varsSeen = g.vars.entries.associate { it.key to ltext(it.value) }.toMutableMap()
    alive = g.objects.map { it.uid }.toSet()
    for (n in nodesOf("onVarReaches")) state["${n["id"]}:vr"] = lcmp(g.numVar(ps(n, "name")), ps(n, "op"), pn(n, "value"))
    for (n in nodesOf("whenMyVarReaches")) state["${n["id"]}:mr"] = lcmp(lnum(e.data[ps(n, "name")]), ps(n, "op"), pn(n, "value"))
    for (n in nodesOf("onFellFar")) state["${n["id"]}:y0"] = e.y
    g.on { m ->
        if (!e.dead) {
            fire("onMessage", filter = { n -> ps(n, "message") == m })
            fire("onAnyMessage", eventValue = m)
            if (m == "won") { fire("onWin"); for (n in nodesOf("onGameState")) follow(n, "won", GCtx()) }
            if (m == "game over") { fire("onGameOver"); for (n in nodesOf("onGameState")) follow(n, "game over", GCtx()) }
            for (b in bindings.values.toList()) if (b.message == m) callFunction(GCtx(), b.func, mapOf("a" to 0.0, "b" to 0.0, "c" to 0.0))
        }
    }
    LogicBus.of(g).subs.add { type, a ->
        if (!e.dead) {
            @Suppress("UNCHECKED_CAST")
            if (type == "graphCall" && (a[1] as (GameObject) -> Boolean)(e)) fire("customEvent", filter = { n -> ps(n, "name") == ltext(a[0]) }, other = a[2] as GameObject?, eventValue = a[3])
            if (type == "runTrigger") fire("customEvent", filter = { n -> ps(n, "name") == ltext(a[0]) })
            if (type == "state" && a[0] === e) fire("stateEntered", filter = { n -> ps(n, "state").isEmpty() || ps(n, "state") == ltext(a[1]) })
            if (type == "animEnd" && a[0] === e) fire("animEnd", filter = { n -> ps(n, "clip").isEmpty() || ps(n, "clip") == ltext(a[1]) })
            if (type == "timerDone") fire("onTimerDone", filter = { n -> ps(n, "name").isEmpty() || ps(n, "name") == ltext(a[0]) })
            if (type == "myvar" && a[0] === e) {
                val k = ltext(a[1])
                fire("onMyVarChanged", filter = { n -> ps(n, "name").isEmpty() || ps(n, "name") == k })
                for (n in nodesOf("whenMyVarReaches")) {
                    if (ps(n, "name") != k) continue
                    val on = lcmp(lnum(a[2]), ps(n, "op"), pn(n, "value"))
                    if (on && state["${n["id"]}:mr"] != true) follow(n, "then", GCtx())
                    state["${n["id"]}:mr"] = on
                }
            }
        }
    }
    // once per app session: first time ever, new day, welcome back
    val nowL = nowMs().toLong()
    for (n in nodesOf("onFirstPlay")) { val k = "pocket.ev.${g.saveKey}.first"; if (stored(k) == null) { store(k, "1"); g.after(0.0) { follow(n, "then", GCtx()) } } }
    for (n in nodesOf("onNewDay")) { val k = "pocket.ev.${g.saveKey}.day"; val today = dayOf(nowL); if (stored(k) != today) { store(k, today); g.after(0.0) { follow(n, "then", GCtx()) } } }
    for (n in nodesOf("onWelcomeBack")) {
        val k = "pocket.ev.${g.saveKey}.lastSeen"; val last = stored(k)?.toLongOrNull() ?: 0L; val away = if (last == 0L) 0.0 else (nowL - last) / 3_600_000.0
        if (last > 0 && away >= pn(n, "hours")) g.after(0.0) { follow(n, "then", GCtx(eventValue = (away * 10).roundToLong() / 10.0)) }
    }
    if (has(listOf("onWelcomeBack"))) store("pocket.ev.${g.saveKey}.lastSeen", "$nowL")
    if (e.data["spawned"] == true) for (n in nodesOf("onSpawnedSelf")) g.after(0.0) { if (!e.dead) follow(n, "then", GCtx()) }
    fire("start")
}

private fun GraphRun.onScreenNow(): Boolean { val v = g.viewBounds; return e.x >= v.left - 10 && e.x <= v.right + 10 && e.y >= v.top - 10 && e.y <= v.bottom + 10 }

fun GraphRun.updateGraph(dt: Double) {
    val playing = g.state == "play" && !g.paused
    tickTimers(dt)
    val lw = this.lw
    if (lw != null) {
        lw.frame(dt)
        for (n in leNodes) {
            val ev = leEvent(n)
            for (hit in lw.matchAll(ev, "${n["id"]}")) if (playing || ev["type"] in listOf("tap", "message", "called")) follow(n, "then", GCtx(other = hit.other, eventValue = hit.value, dt = dt))
        }
    }
    if (e.shown && has(listOf("tap")) && g.tapsOn(e).isNotEmpty() && (playing || e.ui)) fire("tap")
    // game state and pause (also on the title and end screens)
    if (has(listOf("onGameState"))) {
        val st = g.state; val was = gameStateWas
        if (was.isNotEmpty() && was != st) { val port = if (st == "title") "title screen" else if (st == "play") "playing" else null; if (port != null) for (n in nodesOf("onGameState")) follow(n, port, GCtx()) }
        gameStateWas = st
    }
    if (g.paused != pausedWas) { for (n in nodesOf("onPauseChange")) follow(n, if (g.paused) "paused" else "resumed", GCtx()); pausedWas = g.paused }
    // variables, pages, health
    if (has(listOf("varChanged", "onVarReaches", "onPage"))) {
        for ((k, v) in g.vars.entries.toList()) {
            val tx = ltext(v)
            if (varsSeen[k] == tx) continue
            varsSeen[k] = tx
            fire("varChanged", filter = { n -> ps(n, "name") == k })
            fire("onPage", filter = { n -> ps(n, "var").ifEmpty { "page" } == k && (ps(n, "page").isEmpty() || lsame(v, ps(n, "page"))) })
            for (n in nodesOf("onVarReaches")) {
                if (ps(n, "name") != k) continue
                val on = lcmp(lnum(v), ps(n, "op"), pn(n, "value"))
                if (on && state["${n["id"]}:vr"] != true) follow(n, "then", GCtx())
                state["${n["id"]}:vr"] = on
            }
        }
    }
    val hp = e.data["hp"]
    if (hp is Number) {
        val h = hp.toDouble(); val was = hpWas
        if (was != null && h < was) fire("damaged", filter = { n -> ps(n, "dtype").isEmpty() || ps(n, "dtype") == "any" || ps(n, "dtype") == "normal" }, eventValue = ((was - h) * 100).roundToLong() / 100.0)
        hpWas = h
    }
    val dead = e.part<Health>()?.dead ?: false
    if (dead && !died) fire("death")
    died = dead
    // objects appearing and disappearing
    if (has(listOf("onAnySpawned", "onAnyDestroyed"))) {
        val now = g.objects.filter { !it.dead }.map { it.uid }.toSet()
        for (o in g.objects.toList()) if (o.uid !in alive && !o.dead && o !== e) fire("onAnySpawned", filter = { n -> ps(n, "tag").isEmpty() || o.has(ps(n, "tag")) }, other = o, eventValue = o.name)
        if (alive != now) for (o in g.objects.filter { it.dead && it.uid in alive && it !== e }) fire("onAnyDestroyed", filter = { n -> ps(n, "tag").isEmpty() || o.has(ps(n, "tag")) }, other = o, eventValue = o.name)
        alive = now
    }
    pollMore(dt, playing)
    if (!playing) return
    first = false
    fire("update", dt = dt)
    if (g.pointers.isNotEmpty()) fire("holding", dt = dt)
    if (g.ups.isNotEmpty()) fire("released")
    for (i in frameQueue.indices.reversed()) { val (left, fn) = frameQueue[i]; if (left <= 1) { frameQueue.removeAt(i); fn() } else frameQueue[i] = (left - 1) to fn }
    if (has(listOf("onLongPress", "onDoubleTap")) && e.shown) {
        for (d in g.downs) if (g.hitsAt(e, d.at)) press[d.id] = GPress(g.time, d.at, false)
        for (pid in press.keys.toList()) {
            val q = press[pid]!!; val ptr = g.pointers[pid]
            if (ptr == null || (ptr.at - q.at).getDistance() > 14) { press.remove(pid); continue }
            for (n in nodesOf("onLongPress")) if (!q.done && g.time - q.t >= max(0.1, pn(n, "seconds"))) { press[pid] = q.copy(done = true); follow(n, "then", GCtx()) }
        }
        if (has(listOf("onDoubleTap")) && g.tapsOn(e).isNotEmpty()) { if (g.time - lastTapT < 0.35) { lastTapT = -9.0; fire("onDoubleTap") } else lastTapT = g.time }
    }
    // touches: enter / stay / exit
    if (has(touchTypes) && !e.ui) {
        val cur = linkedMapOf<Int, GameObject>(); for (o in g.objects) if (o !== e && !o.dead && !o.ui && PocketGame.overlap(e, o)) cur[o.uid] = o
        for (o in cur.values) {
            val sensor = isSensor(o)
            if (o.uid !in contacts) {
                fire("touch", filter = { n -> o.has(ps(n, "tag")) }, other = o)
                if (sensor) fire("triggerEnter", filter = { n -> tagOk(o, ps(n, "tag")) }, other = o)
                else {
                    val va = e.body; val vb = o.body; val rv = hypot((va?.vx ?: 0.0) - (vb?.vx ?: 0.0), (va?.vy ?: 0.0) - (vb?.vy ?: 0.0))
                    fire("collisionEnter", filter = { n -> tagOk(o, ps(n, "tag")) && rv >= pn(n, "minSpeed") }, other = o, impact = rv)
                }
            } else fire(if (sensor) "triggerStay" else "collisionStay", filter = { n -> tagOk(o, ps(n, "tag")) }, other = o, dt = dt)
        }
        for (uid in contacts.toList()) {
            if (cur.containsKey(uid)) continue
            val o = contactObj[uid] ?: continue
            fire("touchEnd", filter = { n -> o.has(ps(n, "tag")) }, other = o)
            fire(if (isSensor(o)) "triggerExit" else "collisionExit", filter = { n -> tagOk(o, ps(n, "tag")) }, other = o)
        }
        contacts.clear(); contacts.addAll(cur.keys)
        contactObj.clear(); contactObj.putAll(cur)
    }
    val b = e.body
    if (b != null && has(listOf("landed", "leftGround"))) {
        val gr = b.grounded
        if (b.landed > 0 || (wasGround == false && gr)) fire("landed", eventValue = b.landed.roundToInt().toDouble())
        else if (wasGround == true && !gr) fire("leftGround")
        wasGround = gr
    }
    if (has(listOf("screenEnter", "screenExit"))) { val on = onScreenNow(); if (wasOn != null && on != wasOn) fire(if (on) "screenEnter" else "screenExit"); wasOn = on }
    for (n in nodesOf("objectNear")) {
        val o = lnearest(g, e, ps(n, "tag")); val r = if (pn(n, "range") > 0) pn(n, "range") else 150.0; val isNear = o != null && ldist(o, e) <= r
        if (isNear != (state["${n["id"]}:near"] == true)) { follow(n, if (isNear) "near" else "left", GCtx(other = o ?: state["${n["id"]}:o"] as GameObject?, dt = dt)); state["${n["id"]}:near"] = isNear; if (o != null) state["${n["id"]}:o"] = o }
    }
    if (has(listOf("isMoving"))) { @Suppress("UNCHECKED_CAST") val m = state["_pos"] as Pair<Double, Double>?; if (m != null && hypot(e.x - m.first, e.y - m.second) > 10 * dt) state["_moved"] = g.time; state["_pos"] = e.x to e.y }
    if (has(listOf("onUiTap")) && g.taps.isNotEmpty()) {
        for (n in nodesOf("onUiTap")) {
            val k = ps(n, "object"); val list = if (k.isEmpty()) emptyList() else g.objects.filter { !it.dead && (it.name == k || it.id == k || it.has(k)) }
            val hit = list.firstOrNull { it.shown && g.tapsOn(it).isNotEmpty() }
            if (hit != null) follow(n, "then", GCtx(other = hit))
        }
    }
    for (n in nodesOf("onKey")) {
        val want = lkeyWant(param(n, "key")); val w = ps(n, "when")
        val ok = if (w == "held") g.keys.any { lkeyName(it) == want } else if (w == "released") want in keysUp else want in keysDown
        if (ok) follow(n, "then", GCtx(dt = dt))
    }
    if (g.downs.isNotEmpty()) {
        for (n in nodesOf("onScreenTouch")) {
            val w = ps(n, "where"); val W = g.screen.width; val H = g.screen.height
            if (g.downs.any { d -> when (w) { "left half" -> d.at.x < W / 2; "right half" -> d.at.x >= W / 2; "top half" -> d.at.y < H / 2; "bottom half" -> d.at.y >= H / 2; else -> true } }) follow(n, "then", GCtx())
        }
    }
    for (n in nodes.toList()) {
        if (n["off"] == true) continue
        val t = n["type"]
        if (t == "every") {
            val tt = (timers["${n["id"]}"] ?: 0.0) + dt
            if (tt >= max(0.05, if (pn(n, "seconds") == 0.0) 1.0 else pn(n, "seconds"))) { timers["${n["id"]}"] = 0.0; follow(n, "then", GCtx(dt = dt)) } else timers["${n["id"]}"] = tt
        } else if (t == "button" && (if (ps(n, "button") == "fire") "action" else "jump") in g.pressed) follow(n, "then", GCtx())
        else if (t == "swipe" && "swipe:${ps(n, "dir")}" in g.pressed) follow(n, "then", GCtx())
    }
}

@Suppress("UNCHECKED_CAST")
private val GraphRun.keysDown: Set<String> get() = state["_kd"] as Set<String>? ?: emptySet()
@Suppress("UNCHECKED_CAST")
private val GraphRun.keysUp: Set<String> get() = state["_ku"] as Set<String>? ?: emptySet()

/** Per-frame checks for the "more events" family (finger, drag, keys, joystick, idle, movement, sight, health…). */
private fun GraphRun.pollMore(dt: Double, playing: Boolean) {
    val names = g.keys.map { lkeyName(it) }.toSet()
    @Suppress("UNCHECKED_CAST") val before = state["_kn"] as Set<String>? ?: emptySet()
    state["_kd"] = names - before; state["_ku"] = before - names; state["_kn"] = names
    if (!playing && !e.ui) return
    val b = e.body; val speed = if (b == null) 0.0 else sqrt(b.vx * b.vx + b.vy * b.vy)
    for (n in nodes.toList()) {
        if (n["off"] == true) continue
        fun p(k: String) = ps(n, k)
        fun q(k: String) = pn(n, k)
        val id = "${n["id"]}"
        when (ty(n)) {
            "onFingerDown" -> for (d in g.downs) if (p("where") == "anywhere" || g.hitsAt(e, d.at)) follow(n, "then", GCtx(eventValue = "${d.at.x.roundToInt()},${d.at.y.roundToInt()}"))
            "onDragThis" -> {
                val did = state["$id:drag"]
                if (did == null) { val d = g.downOn(e); if (d != null) { state["$id:drag"] = d.id; d.role = "drag"; follow(n, "start", GCtx()) } }
                else if (g.pointers.containsKey(did)) { val ptr = g.pointers[did]!!; follow(n, "dragging", GCtx(eventValue = (ptr.at - ptr.start).getDistance().roundToInt().toDouble(), dt = dt)) }
                else { state.remove("$id:drag"); follow(n, "dropped", GCtx()) }
            }
            "onKeyUp" -> if (lkeyWant(param(n, "key")) in keysUp) follow(n, "then", GCtx())
            "onAnyKey" -> for (k in keysDown) follow(n, "then", GCtx(eventValue = k))
            "onJoystick" -> { val on = g.stick != null; val was = was(n, "stick", on); if (on && was != true) follow(n, "pushed", GCtx()) else if (!on && was == true) follow(n, "released", GCtx()) }
            "onIdle" -> {
                val busy = g.pointers.isNotEmpty() || g.keys.isNotEmpty()
                if (busy) { state["$id:idle"] = 0.0; state.remove("$id:idf") }
                else {
                    val t2 = lnum(state["$id:idle"]) + dt; state["$id:idle"] = t2
                    if (t2 >= (if (q("seconds") == 0.0) 5.0 else q("seconds")) && state["$id:idf"] != true) { state["$id:idf"] = true; follow(n, "then", GCtx()) }
                }
            }
            "onMovement" -> { val m = speed > (if (q("speed") == 0.0) 10.0 else q("speed")); val was = was(n, "mv", m); if (was != null) { if (m && was != true) follow(n, "starts moving", GCtx()) else if (!m && was == true) follow(n, "stops", GCtx()) } }
            "onFalling" -> { val f = b != null && !b.grounded && b.vy > (if (q("speed") == 0.0) 60.0 else q("speed")); if (!edge(n, "fall", f) && f) follow(n, "then", GCtx()) }
            "onFellFar" -> { val y0 = lnum(state["$id:y0"] ?: e.y); val far = e.y - y0 > (if (q("distance") == 0.0) 800.0 else q("distance")); if (!edge(n, "far", far) && far) follow(n, "then", GCtx()) }
            "onSpeedAbove" -> { val f = speed > (if (q("speed") == 0.0) 400.0 else q("speed")); if (!edge(n, "spd", f) && f) follow(n, "then", GCtx(eventValue = speed.roundToInt().toDouble())) }
            "onObjectFar" -> { val o = lnearest(g, e, p("tag")); val far = o == null || ldist(o, e) > (if (q("distance") == 0.0) 200.0 else q("distance")); val was = was(n, "far", far); if (far && was == false) follow(n, "then", GCtx(other = o)) }
            "onSight" -> { val o = lnearest(g, e, p("tag")); val see = o != null && g.canSee(e, o); val was = was(n, "see", see); if (see && was != true) follow(n, "sees", GCtx(other = o)) else if (!see && was == true) follow(n, "loses sight", GCtx(other = o)) }
            "onHealed" -> { val hp = e.data["hp"]; if (hp is Number) { val h = hp.toDouble(); val was = was(n, "hp", h); if (was is Double && h > was) follow(n, "then", GCtx(eventValue = h - was)) } }
            "onHealthLow" -> { val mx = lnum(e.data["hpMax"]); if (mx != 0.0) { val low = lnum(e.data["hp"]) / mx * 100 <= (if (q("percent") == 0.0) 30.0 else q("percent")); if (!edge(n, "low", low) && low) follow(n, "then", GCtx()) } }
            "onNoneLeft" -> { val cnt = g.findAll(p("tag")).size; val was = was(n, "cnt", cnt); if (cnt == 0 && was is Int && was > 0) follow(n, "then", GCtx()) }
            "onShownHidden" -> { val vis = e.visible; val was = was(n, "vis", vis); if (was != null && vis != was) follow(n, if (vis) "shown" else "hidden", GCtx()) }
            "onTimeReaches" -> if (g.time >= q("seconds") && state["$id:t"] != true) { state["$id:t"] = true; follow(n, "then", GCtx()) }
            "onClock" -> {
                val d = lclock(); val hm = "${d[0].toString().padStart(2, '0')}:${d[1].toString().padStart(2, '0')}"; val want = p("time").trim().padStart(5, '0'); val key = "${d[6]}${d[5]}${d[4]}$hm"
                if (hm == want && state["$id:clk"] != key) { state["$id:clk"] = key; follow(n, "then", GCtx()) }
            }
            "onSpriteFrame" -> { val f = lnum(e.data["frame"]).toInt(); val was = was(n, "fr", f); if (f == q("frame").toInt() && was != f) follow(n, "then", GCtx()) }
        }
    }
}

/** Visual Script: node-based logic (events → actions, values, flow), made in the Node Editor. Several scripts in one component run side by side. */
class VisualScript(p: JsonMap) : Component(p) {
    val runs = mutableListOf<GraphRun>()
    private var started = false
    init {
        if (p["mainOff"] != true && p["graph"] is Map<*, *>) runs.add(GraphRun(p["graph"] as Map<*, *>))
        for (q in p["scripts"] as? List<*> ?: emptyList<Any?>()) if (q is Map<*, *> && q["graph"] is Map<*, *> && q["off"] != true) runs.add(GraphRun(q["graph"] as Map<*, *>))
    }
    override val always: Boolean get() = true
    override fun start(e: GameObject, g: PocketGame) { started = true; for (r in runs) r.startGraph(e, g) }
    override fun update(e: GameObject, dt: Double, g: PocketGame) {
        if (!started) { // the title screen: buttons still work, without the On Start events
            started = true
            for (r in runs) { r.e = e; r.g = g; r.leNodes = emptyList() }
        }
        for (r in runs) r.updateGraph(dt)
    }
    override fun gone(e: GameObject, g: PocketGame) { if (!started) return; for (r in runs) r.fire("destroyed") }
    fun hasFn(name: String) = runs.any { it.hasFunction(name) }
    /** Run one of this object's script Functions: (found, value). onLate: a Function that Waits gives its value later. */
    fun callFn(name: String, args: Map<String, Double>, from: GameObject?, onLate: ((Double) -> Unit)?): Pair<Boolean, Double> {
        for (r in runs) {
            if (!r.hasFunction(name)) continue
            var now: Double? = null
            val v = r.callFunction(GCtx(other = from), name, args) { x, late -> if (late) onLate?.invoke(x) else now = x }
            return true to (now ?: v)
        }
        return false to 0.0
    }
}

/** The logic library's defaults (Pocket Engine's LOGIC_EVENTS / LOGIC_CONDITIONS / LOGIC_ACTIONS settings), so a saved trigger that leaves one out works the same. */
val logicDefaults: Map<String, Map<String, Map<String, Any?>>> = mapOf(
    "ev" to mapOf(
        "every" to mapOf("seconds" to 1.0),
        "touch" to mapOf("tag" to "player"),
        "touchEnd" to mapOf("tag" to "player"),
        "button" to mapOf("button" to "jump"),
        "swipe" to mapOf("dir" to "up"),
        "message" to mapOf("message" to "go"),
        "variable" to mapOf("name" to "score", "op" to "≥", "value" to 10.0),
        "animEnd" to mapOf("clip" to ""),
        "longPress" to mapOf("seconds" to 0.6),
        "key" to mapOf("key" to "space"),
        "varChanged" to mapOf("name" to "score"),
        "delay" to mapOf("seconds" to 2.0),
        "random" to mapOf("seconds" to 3.0),
        "near" to mapOf("tag" to "player", "distance" to 120.0),
        "sees" to mapOf("tag" to "player"),
        "damaged" to mapOf("dtype" to "any"),
        "statusGot" to mapOf("effect" to "any"),
        "needLow" to mapOf("need" to "any"),
        "needEmpty" to mapOf("need" to "any"),
        "crafted" to mapOf("item" to ""),
        "itemUsed" to mapOf("item" to ""),
        "equipped" to mapOf("mode" to "puts on", "item" to ""),
        "recipeLearned" to mapOf("item" to ""),
        "gathered" to mapOf("item" to ""),
        "questStarted" to mapOf("quest" to ""),
        "questUpdated" to mapOf("quest" to ""),
        "questReady" to mapOf("quest" to ""),
        "questCompleted" to mapOf("quest" to ""),
        "questFailed" to mapOf("quest" to ""),
        "dialogueStarted" to mapOf("dialogue" to ""),
        "dialogueEnded" to mapOf("dialogue" to ""),
        "dialogueChoice" to mapOf("choice" to ""),
        "gameFinished" to mapOf("game" to "", "result" to "any"),
        "recordAdded" to mapOf("collection" to ""),
        "recordChanged" to mapOf("collection" to ""),
        "recordDeleted" to mapOf("collection" to ""),
        "recordOpened" to mapOf("collection" to ""),
        "unitArrived" to mapOf("unit" to ""),
        "unitDefeated" to mapOf("team" to "any"),
        "ate" to mapOf("need" to "any"),
        "called" to mapOf("name" to "Open door"),
        "pageChanged" to mapOf("page" to ""),
        "stateEntered" to mapOf("state" to ""),
        "inventory" to mapOf("item" to ""),
        "permission" to mapOf("kind" to "any", "answer" to "any"),
        "online" to mapOf("mode" to "is lost"),
        "orientation" to mapOf("to" to "any"),
        "menu" to mapOf("mode" to "opens"),
        "after" to mapOf("seconds" to 1.0),
    ),
    "cd" to mapOf(
        "variable" to mapOf("name" to "score", "op" to "≥", "value" to 10.0),
        "chance" to mapOf("percent" to 50.0),
        "touching" to mapOf("tag" to "player"),
        "near" to mapOf("tag" to "player", "op" to "<", "value" to 150.0),
        "canSee" to mapOf("tag" to "player"),
        "exists" to mapOf("object" to ""),
        "visible" to mapOf("object" to ""),
        "state" to mapOf("state" to "Idle"),
        "modActive" to mapOf("mod" to ""),
        "hasSave" to mapOf("slot" to 1.0),
        "hasItem" to mapOf("item" to "Key", "count" to 1.0),
        "dataCount" to mapOf("collection" to "Tasks", "filter" to "", "op" to "≥", "value" to 1.0),
        "unitCount" to mapOf("which" to "selected", "op" to "≥", "value" to 1.0),
        "questIs" to mapOf("quest" to "The Lost Ring", "state" to "active"),
        "storyCheck" to mapOf("check" to "has Key and coins >= 10"),
        "canCraft" to mapOf("item" to "Wooden Sword", "times" to 1.0),
        "isEquipped" to mapOf("item" to "", "slot" to "any"),
        "invSpace" to mapOf("op" to "≥", "value" to 1.0),
        "hasItemType" to mapOf("type" to "food", "count" to 1.0),
        "knowsRecipe" to mapOf("item" to "Iron Sword"),
        "compareVars" to mapOf("a" to "score", "op" to "≥", "b" to "best"),
        "myVar" to mapOf("name" to "hp", "op" to "≤", "value" to 0.0),
        "textVar" to mapOf("name" to "playerName", "op" to "equals", "text" to "Hero"),
        "health" to mapOf("op" to "≤", "value" to 1.0, "percent" to false),
        "need" to mapOf("need" to "hunger", "op" to "≤", "value" to 25.0, "percent" to true),
        "hasStatus" to mapOf("effect" to "poison"),
        "shieldUp" to mapOf("op" to ">", "value" to 0.0),
        "tagCount" to mapOf("tag" to "enemy", "op" to "=", "value" to 0.0),
        "moving" to mapOf("speed" to 10.0),
        "level" to mapOf("op" to "=", "value" to 1.0),
        "timeIn" to mapOf("op" to "≥", "value" to 10.0),
        "listHas" to mapOf("list" to "inventory", "value" to "sword"),
        "listCount" to mapOf("list" to "inventory", "op" to "≥", "value" to 3.0),
        "dictHas" to mapOf("dict" to "stats", "key" to "hp"),
        "pageIs" to mapOf("page" to "home"),
        "keyHeld" to mapOf("key" to "space"),
        "hour" to mapOf("op" to "≥", "value" to 18.0),
        "permission" to mapOf("kind" to "location"),
        "objVar" to mapOf("object" to "Door", "name" to "open", "op" to "=", "value" to 1.0),
        "funcResult" to mapOf("name" to "canAfford", "on" to "this object", "object" to "", "a" to 0.0, "op" to "≠", "value" to 0.0),
        "eventValue" to mapOf("op" to "=", "value" to "1"),
        "savedKey" to mapOf("key" to "coins", "file" to "save"),
    ),
    "ac" to mapOf(
        "setVar" to mapOf("name" to "score", "op" to "add", "value" to 1.0),
        "showHide" to mapOf("object" to "", "mode" to "hide"),
        "destroy" to mapOf("object" to "self", "burst" to true),
        "spawn" to mapOf("template" to "", "ox" to 0.0, "oy" to 0.0, "at" to "this"),
        "setText" to mapOf("object" to "", "text" to "Hello {score}"),
        "setColor" to mapOf("object" to "", "color" to "#ff5252", "seconds" to 0.3),
        "teleport" to mapOf("to" to ""),
        "toggleVar" to mapOf("name" to "open"),
        "randomVar" to mapOf("name" to "roll", "min" to 1.0, "max" to 6.0, "whole" to true),
        "textVar" to mapOf("name" to "playerName", "text" to "Hero {level}"),
        "myVar" to mapOf("name" to "hp", "op" to "add", "value" to 1.0, "object" to ""),
        "saveKey" to mapOf("name" to "coins", "file" to "save"),
        "loadKey" to mapOf("name" to "coins", "file" to "save"),
        "giveItem" to mapOf("item" to "Key", "amount" to 1.0, "icon" to ""),
        "snackbar" to mapOf("text" to "Saved", "action" to "", "message" to "", "seconds" to 4.0),
        "playGame" to mapOf("level" to "2"),
        "supaSignIn" to mapOf("email" to "{email}", "password" to "{password}"),
        "supaSignUp" to mapOf("email" to "{email}", "password" to "{password}", "name" to "{name}"),
        "supaReset" to mapOf("email" to "{email}"),
        "supaLoadProfile" to mapOf("who" to "{username}"),
        "buyProduct" to mapOf("product" to "coins_100"),
        "supaRpc" to mapOf("fn" to "get_top_scores", "args" to "", "into" to "supaResult"),
        "supaEdge" to mapOf("fn" to "hello", "args" to "", "into" to "supaResult"),
        "supaRefresh" to mapOf("collection" to ""),
        "dataAdd" to mapOf("collection" to "Tasks", "values" to "title = New task, done = no", "open" to false),
        "dataSet" to mapOf("field" to "done", "value" to "yes"),
        "dataOpen" to mapOf("collection" to "Tasks", "filter" to "", "page" to ""),
        "dataClear" to mapOf("collection" to "Tasks", "how" to "delete every record"),
        "dataToVar" to mapOf("collection" to "Expenses", "how" to "sum", "field" to "amount", "filter" to "", "var" to "total"),
        "npcSay" to mapOf("npc" to "Villager", "text" to "Nice day!"),
        "squadSelect" to mapOf("which" to "all yours", "tag" to "archer"),
        "squadMove" to mapOf("who" to "selected", "tag" to "archer", "to" to "an object", "object" to "Flag", "x" to 0.0, "y" to 0.0),
        "questStart" to mapOf("quest" to "The Lost Ring"),
        "questComplete" to mapOf("quest" to "The Lost Ring"),
        "questFail" to mapOf("quest" to "The Lost Ring"),
        "questAdvance" to mapOf("quest" to "The Lost Ring", "amount" to 1.0, "objective" to 0.0),
        "questReset" to mapOf("quest" to "The Lost Ring"),
        "questTrack" to mapOf("quest" to "The Lost Ring"),
        "startDialogue" to mapOf("dialogue" to "Elder", "section" to "", "wait" to true),
        "useItemFx" to mapOf("item" to "Apple"),
        "equipItem" to mapOf("mode" to "equip", "item" to "Iron Sword", "slot" to "hand"),
        "craftItem" to mapOf("item" to "Wooden Sword", "times" to 1.0),
        "learnRecipe" to mapOf("item" to "Iron Sword"),
        "dropItem" to mapOf("item" to "Wood", "amount" to 1.0),
        "lootRoll" to mapOf("loot" to "Coin 3-6, Gem 1 10%", "into" to "inventory"),
        "invManage" to mapOf("what" to "sort by type", "amount" to 20.0),
        "damage" to mapOf("object" to "other", "amount" to 1.0, "dtype" to "normal", "pierce" to false),
        "statusFx" to mapOf("object" to "self", "effect" to "poison", "perSecond" to 1.0, "seconds" to 3.0),
        "cure" to mapOf("object" to "self", "effect" to "any"),
        "healthSet" to mapOf("object" to "self", "what" to "refill health", "amount" to 5.0),
        "invulnerable" to mapOf("object" to "self", "seconds" to 3.0),
        "eat" to mapOf("object" to "self", "need" to "hunger", "mode" to "add", "amount" to 25.0),
        "talk" to mapOf("who" to "Guide", "text" to "Hello there!", "wait" to true),
        "moveBy" to mapOf("x" to 0.0, "y" to -40.0, "z" to 0.0, "seconds" to 0.3, "ease" to "outQuad", "wait" to false),
        "rotateBy" to mapOf("degrees" to 90.0, "seconds" to 0.3, "ease" to "outQuad", "wait" to false),
        "scaleTo" to mapOf("scale" to 1.5, "seconds" to 0.3, "ease" to "outBack", "wait" to false),
        "fade" to mapOf("alpha" to 0.0, "seconds" to 0.5, "wait" to false),
        "punch" to mapOf("what" to "scale", "amount" to 0.3, "seconds" to 0.4),
        "playAnim" to mapOf("clip" to "Bounce"),
        "push" to mapOf("who" to "self", "x" to 0.0, "y" to -500.0, "z" to 0.0),
        "setVelocity" to mapOf("x" to 0.0, "y" to 0.0, "z" to 0.0),
        "jump" to mapOf("power" to 600.0),
        "setGravity" to mapOf("y" to 1600.0, "x" to 0.0),
        "wait" to mapOf("seconds" to 1.0),
        "waitRandom" to mapOf("min" to 0.5, "max" to 2.0),
        "waitUntil" to mapOf("name" to "score", "op" to "≥", "value" to 10.0),
        "onlyIf" to mapOf("name" to "score", "op" to "≥", "value" to 10.0),
        "repeat" to mapOf("times" to 2.0),
        "runTrigger" to mapOf("name" to "Open door"),
        "sendMessage" to mapOf("message" to "go"),
        "setState" to mapOf("state" to "Idle"),
        "message" to mapOf("text" to "Hello! {score}", "seconds" to 2.0),
        "log" to mapOf("text" to "score is {score}"),
        "sound" to mapOf("sound" to "coin"),
        "shake" to mapOf("strength" to 12.0),
        "switchCamera" to mapOf("camera" to "Camera"),
        "save" to mapOf("slot" to 1.0),
        "load" to mapOf("slot" to 1.0),
        "askPermission" to mapOf("kind" to "location", "why" to ""),
        "phoneNotify" to mapOf("title" to "Come back!", "text" to "", "minutes" to 0.0, "id" to ""),
        "notify" to mapOf("type" to "default", "title" to "Well done!", "text" to "", "icon" to ""),
        "listAdd" to mapOf("list" to "inventory", "value" to "sword", "where" to "at the end", "unique" to false),
        "listRemove" to mapOf("list" to "inventory", "mode" to "this value", "value" to "sword"),
        "listClear" to mapOf("list" to "inventory", "do" to "clear"),
        "listPick" to mapOf("list" to "prizes", "which" to "random", "into" to "prize"),
        "mapSet" to mapOf("dict" to "stats", "key" to "hp", "value" to "100", "op" to "set"),
        "mapRemove" to mapOf("dict" to "stats", "key" to "hp"),
        "setPos" to mapOf("x" to 0.0, "y" to 0.0, "z" to 0.0, "relative" to false, "object" to ""),
        "glideTo" to mapOf("to" to "player", "seconds" to 0.6, "ease" to "inOutQuad", "wait" to true),
        "face" to mapOf("tag" to "player"),
        "pushToward" to mapOf("tag" to "player", "power" to 500.0, "away" to false),
        "stopMove" to mapOf("object" to ""),
        "tagAdd" to mapOf("tag" to "collected", "mode" to "add", "object" to ""),
        "destroyTag" to mapOf("tag" to "enemy", "burst" to true),
        "setImage" to mapOf("image" to "art:star", "object" to ""),
        "camLive" to mapOf("camera" to "Camera 2", "seconds" to -1.0),
        "camFollow" to mapOf("tag" to "player", "camera" to ""),
        "camZoom" to mapOf("zoom" to 1.5, "camera" to ""),
        "screenFade" to mapOf("color" to "#000000", "out" to 0.4, "hold" to 0.3, "in" to 0.4, "wait" to true),
        "slowMo" to mapOf("speed" to 0.3, "seconds" to 1.5),
        "pauseGame" to mapOf("mode" to "pause"),
        "haptic" to mapOf("style" to "medium"),
        "openUrl" to mapOf("url" to "https://"),
        "copyText" to mapOf("text" to "My score: {score}"),
        "shareText" to mapOf("text" to "I scored {score}!"),
        "askText" to mapOf("question" to "What's your name?", "name" to "playerName", "max" to 16.0),
        "setPage" to mapOf("page" to "shop"),
        "callEvent" to mapOf("name" to "explode", "on" to "everything", "object" to "", "value" to ""),
        "runFunction" to mapOf("name" to "double", "on" to "this object", "object" to "", "a" to 0.0, "b" to 0.0, "store" to ""),
        "goLevel" to mapOf("level" to 1.0),
        "music" to mapOf("sound" to "", "volume" to 0.6),
        "burst" to mapOf("color" to "#ffd23f", "count" to 16.0, "at" to "this"),
        "toast" to mapOf("text" to "+1", "color" to "#ffffff"),
    ),
)

/** Node settings' defaults (Pocket Engine's NODE_TYPES), for the node types this runtime runs. */
private fun graphDefaults0(): Map<String, Map<String, Any?>> = mapOf(
    "every" to mapOf("seconds" to 1.0),
    "touch" to mapOf("tag" to "player"),
    "button" to mapOf("button" to "jump"),
    "swipe" to mapOf("dir" to "up"),
    "onMessage" to mapOf("message" to "go"),
    "touchEnd" to mapOf("tag" to "player"),
    "varChanged" to mapOf("name" to "score"),
    "damaged" to mapOf("dtype" to "any"),
    "stateEntered" to mapOf("state" to "Idle"),
    "animEnd" to mapOf("clip" to ""),
    "branch" to mapOf("condition" to true),
    "wait" to mapOf("seconds" to 1.0),
    "chance" to mapOf("percent" to 50.0),
    "loop" to mapOf("count" to 3.0),
    "cooldown" to mapOf("seconds" to 1.0),
    "countTo" to mapOf("after" to "start over", "times" to 3.0),
    "switchNum" to mapOf("value" to 0.0),
    "compareBranch" to mapOf("op" to "≥", "a" to 0.0, "b" to 0.0),
    "setVar" to mapOf("name" to "score", "value" to 0.0),
    "addVar" to mapOf("name" to "score", "amount" to 1.0),
    "message" to mapOf("text" to "Hello! Score: {score}", "seconds" to 2.0),
    "log" to mapOf("text" to "score is {score}", "level" to "log"),
    "logValue" to mapOf("label" to "speed", "level" to "log", "value" to ""),
    "sound" to mapOf("sound" to "coin"),
    "spawn" to mapOf("template" to ""),
    "destroy" to mapOf("target" to "self"),
    "moveBy" to mapOf("x" to 0.0, "y" to 0.0, "z" to 0.0),
    "setVelocity" to mapOf("x" to 0.0, "y" to 0.0, "z" to 0.0),
    "jump" to mapOf("power" to 600.0),
    "showHide" to mapOf("object" to "", "mode" to "toggle"),
    "shake" to mapOf("strength" to 10.0),
    "saveGame" to mapOf("slot" to 1.0, "text" to "Game saved", "name" to ""),
    "loadGame" to mapOf("slot" to 1.0),
    "deleteSave" to mapOf("slot" to 1.0),
    "push" to mapOf("target" to "self", "x" to 0.0, "y" to -400.0, "z" to 0.0),
    "setGravity" to mapOf("y" to 1600.0, "x" to 0.0),
    "switchCamera" to mapOf("camera" to "Camera"),
    "zoomCamera" to mapOf("seconds" to 0.5, "zoom" to 1.5),
    "setLight" to mapOf("object" to "", "mode" to "toggle", "intensity" to 1.0),
    "tweenTo" to mapOf("prop" to "y", "mode" to "by", "ease" to "outQuad", "value" to -40.0, "seconds" to 0.5),
    "punch" to mapOf("what" to "scale", "target" to "self", "amount" to 0.3, "seconds" to 0.4),
    "killTweens" to mapOf("id" to "", "mode" to "stop"),
    "tweenMove" to mapOf("mode" to "to", "ease" to "outQuad", "id" to "", "x" to 200.0, "y" to 300.0, "z" to 0.0, "seconds" to 0.6),
    "tweenToObj" to mapOf("object" to "Goal", "ease" to "outQuad", "seconds" to 0.6),
    "spin" to mapOf("repeat" to "once", "ease" to "outQuad", "degrees" to 360.0, "seconds" to 1.0),
    "pulse" to mapOf("repeat" to "forever", "id" to "pulse", "amount" to 1.15, "seconds" to 0.4),
    "tweenVar" to mapOf("name" to "score", "ease" to "outQuad", "to" to 100.0, "seconds" to 1.0),
    "typeText" to mapOf("object" to "", "text" to "Hello there!", "scramble" to false, "seconds" to 1.0),
    "delayedCall" to mapOf("id" to "", "seconds" to 1.0),
    "playAnim" to mapOf("clip" to "Bounce", "loop" to "clip setting"),
    "animSpeed" to mapOf("speed" to 2.0),
    "setFrame" to mapOf("frame" to 0.0),
    "flipX" to mapOf("mode" to "toggle"),
    "fadeTo" to mapOf("alpha" to 0.0, "seconds" to 0.5),
    "blink" to mapOf("seconds" to 1.0),
    "sendMessage" to mapOf("message" to "go"),
    "impulse" to mapOf("strength" to 12.0),
    "toggleVar" to mapOf("name" to "on"),
    "setBackground" to mapOf("color" to "#20304a"),
    "setAlpha" to mapOf("alpha" to 0.5),
)
private fun graphDefaults1(): Map<String, Map<String, Any?>> = mapOf(
    "stopMoving" to mapOf("target" to "self"),
    "gravityScale" to mapOf("scale" to 0.0),
    "popText" to mapOf("text" to "+1", "color" to "#ffd23d", "size" to 26.0),
    "flashScreen" to mapOf("color" to "#ffffff", "seconds" to 0.3),
    "randomVar" to mapOf("name" to "roll", "min" to 1.0, "max" to 6.0),
    "goToLevel" to mapOf("level" to 1.0),
    "toggleComp" to mapOf("component" to "patrol", "mode" to "off", "object" to ""),
    "waitUntil" to mapOf("timeout" to 0.0, "condition" to false),
    "randomWait" to mapOf("min" to 0.5, "max" to 2.0),
    "setPosition" to mapOf("target" to "self", "x" to 0.0, "y" to 0.0, "z" to 0.0),
    "moveToward" to mapOf("tag" to "player", "speed" to 120.0),
    "lookAt" to mapOf("tag" to "player"),
    "rotateBy" to mapOf("degrees" to 15.0),
    "setScale" to mapOf("scale" to 1.0),
    "teleport" to mapOf("object" to ""),
    "setText" to mapOf("object" to "", "text" to "Score: {score}"),
    "setColor" to mapOf("color" to "#ff5252", "target" to "self"),
    "particles" to mapOf("color" to "#ffd54f", "count" to 20.0),
    "spawnAt" to mapOf("template" to "", "at" to "player"),
    "destroyTag" to mapOf("tag" to "enemy"),
    "tagOp" to mapOf("tag" to "marked", "mode" to "add"),
    "slowMo" to mapOf("speed" to 0.3, "seconds" to 1.0),
    "damage" to mapOf("target" to "other", "amount" to 1.0),
    "heal" to mapOf("target" to "self", "amount" to 1.0),
    "giveItem" to mapOf("item" to "key", "count" to 1.0),
    "number" to mapOf("value" to 1.0),
    "getVar" to mapOf("name" to "score"),
    "random" to mapOf("min" to 0.0, "max" to 10.0),
    "math" to mapOf("op" to "+", "a" to 0.0, "b" to 0.0),
    "compare" to mapOf("op" to "≥", "a" to 0.0, "b" to 0.0),
    "and" to mapOf("a" to true, "b" to true),
    "or" to mapOf("a" to false, "b" to false),
    "not" to mapOf("a" to false),
    "position" to mapOf("axis" to "x"),
    "distance" to mapOf("tag" to "player"),
    "hasSave" to mapOf("slot" to 1.0),
    "velocity" to mapOf("axis" to "x"),
    "touching" to mapOf("tag" to "player"),
    "canSee" to mapOf("tag" to "player", "range" to 0.0),
    "math1" to mapOf("op" to "abs", "a" to 0.0),
    "clamp" to mapOf("value" to 0.0, "min" to 0.0, "max" to 10.0),
    "lerp" to mapOf("a" to 0.0, "b" to 10.0, "t" to 0.5),
    "angleTo" to mapOf("tag" to "player"),
    "countTag" to mapOf("tag" to "enemy"),
    "exists" to mapOf("object" to "Boss"),
    "healthOf" to mapOf("object" to "", "what" to "health"),
    "itemCount" to mapOf("item" to "key"),
    "joystick" to mapOf("axis" to "x"),
    "screen" to mapOf("what" to "width"),
    "isTweening" to mapOf("id" to ""),
    "choose" to mapOf("condition" to true, "yes" to 1.0, "no" to 0.0),
    "wave" to mapOf("shape" to "sine", "size" to 1.0, "speed" to 1.0),
    "remap" to mapOf("value" to 0.5, "fromMin" to 0.0, "fromMax" to 1.0, "toMin" to 0.0, "toMax" to 100.0),
    "objPos" to mapOf("object" to "Player", "axis" to "x"),
    "touchPos" to mapOf("axis" to "x"),
    "setMyVar" to mapOf("name" to "hp", "value" to 0.0),
    "addMyVar" to mapOf("name" to "hp", "amount" to 1.0),
    "getMyVar" to mapOf("name" to "hp"),
    "setOtherVar" to mapOf("name" to "hp", "value" to 0.0),
    "getOtherVar" to mapOf("name" to "hp"),
)
private fun graphDefaults2(): Map<String, Map<String, Any?>> = mapOf(
    "varAt" to mapOf("object" to "Player", "name" to "hp"),
    "onVarReaches" to mapOf("name" to "score", "op" to "≥", "value" to 100.0),
    "customEvent" to mapOf("name" to "explode"),
    "callEvent" to mapOf("name" to "explode", "on" to "this object", "tag" to "enemy", "value" to 0.0),
    "forRange" to mapOf("from" to 1.0, "to" to 5.0, "step" to 1.0),
    "repeatEvery" to mapOf("id" to "", "seconds" to 0.5, "times" to 5.0),
    "stopRepeat" to mapOf("id" to ""),
    "cycle" to mapOf("count" to 3.0),
    "weighted" to mapOf("A" to 60.0, "B" to 30.0, "C" to 10.0),
    "gate" to mapOf("name" to "door", "startOpen" to true),
    "setGate" to mapOf("name" to "door", "mode" to "close"),
    "waitFrames" to mapOf("frames" to 1.0),
    "onLongPress" to mapOf("seconds" to 0.5),
    "spawnLaunch" to mapOf("template" to "", "dir" to "facing", "tag" to "enemy", "speed" to 500.0),
    "moveToFinger" to mapOf("speed" to 0.0),
    "phoneNotify" to mapOf("title" to "Come back!", "text" to "Your energy is full", "when" to "now", "amount" to 1.0, "unit" to "hours", "time" to "19:00", "every" to "day", "id" to ""),
    "phoneCancel" to mapOf("id" to ""),
    "notify" to mapOf("type" to "default", "title" to "Well done!", "text" to "", "icon" to "", "buttons" to ""),
    "pauseGame" to mapOf("mode" to "toggle"),
    "directionTo" to mapOf("tag" to "player", "axis" to "x"),
    "distBetween" to mapOf("a" to "Player", "b" to "Goal"),
    "snapTo" to mapOf("value" to 0.0, "step" to 32.0),
    "pingPong" to mapOf("value" to 0.0, "length" to 1.0),
    "sign" to mapOf("value" to 0.0),
    "smooth" to mapOf("target" to 0.0, "speed" to 5.0),
    "chanceOf" to mapOf("percent" to 25.0),
    "formula" to mapOf("expr" to "a * 2 + b", "a" to 0.0, "b" to 0.0, "c" to 0.0, "d" to 0.0),
    "randomRange" to mapOf("whole" to false, "min" to 0.0, "max" to 1.0),
    "randomPick" to mapOf("count" to 4.0, "a" to 0.0, "b" to 0.0, "c" to 0.0, "d" to 0.0),
    "noise" to mapOf("by" to "game time", "value" to 0.0, "scale" to 1.0),
    "invLerp" to mapOf("a" to 0.0, "b" to 100.0, "value" to 50.0),
    "moveTowards" to mapOf("current" to 0.0, "target" to 10.0, "step" to 1.0),
    "angleDiff" to mapOf("a" to 0.0, "b" to 90.0),
    "wrap" to mapOf("value" to 0.0, "min" to 0.0, "max" to 360.0),
    "roundTo" to mapOf("value" to 0.0, "decimals" to 1.0),
    "percent" to mapOf("part" to 25.0, "total" to 100.0),
    "easeVal" to mapOf("ease" to "outQuad", "t" to 0.5),
    "vecLength" to mapOf("x" to 3.0, "y" to 4.0, "z" to 0.0),
    "distPoints" to mapOf("x1" to 0.0, "y1" to 0.0, "x2" to 3.0, "y2" to 4.0),
    "anglePoints" to mapOf("x1" to 0.0, "y1" to 0.0, "x2" to 1.0, "y2" to 1.0),
    "minMax3" to mapOf("op" to "max", "count" to 3.0, "a" to 0.0, "b" to 0.0, "c" to 0.0, "d" to 0.0),
    "between" to mapOf("value" to 5.0, "min" to 0.0, "max" to 10.0),
    "isEven" to mapOf("value" to 2.0),
    "addScore" to mapOf("pop" to true, "amount" to 10.0),
    "loseLife" to mapOf("end" to true),
    "gainLife" to mapOf("max" to 0.0, "amount" to 1.0),
    "addTime" to mapOf("mode" to "add", "seconds" to 5.0),
    "setCheckpoint" to mapOf("at" to "this object"),
    "useItem" to mapOf("item" to "key", "count" to 1.0),
    "hasItem" to mapOf("item" to "key", "count" to 1.0),
    "combo" to mapOf("window" to 1.5),
    "unlock" to mapOf("name" to "First Win", "show" to true),
    "isUnlocked" to mapOf("name" to "First Win"),
    "hitStop" to mapOf("seconds" to 0.08),
    "gameSpeed" to mapOf("speed" to 1.0),
    "gameValue" to mapOf("what" to "score"),
    "gameStateIs" to mapOf("state" to "playing"),
    "changeVar" to mapOf("name" to "score", "op" to "add", "scope" to "game", "value" to 0.0),
    "clampVar" to mapOf("name" to "hp", "scope" to "game", "min" to 0.0, "max" to 100.0),
    "copyVar" to mapOf("from" to "score", "to" to "lastScore"),
)
private fun graphDefaults3(): Map<String, Map<String, Any?>> = mapOf(
    "toggleMyVar" to mapOf("name" to "open"),
    "resetVars" to mapOf("names" to "score, combo"),
    "setTextVar" to mapOf("name" to "playerName", "text" to "Hero {level}"),
    "textIs" to mapOf("name" to "playerName", "op" to "equals", "text" to "Hero"),
    "saveVar" to mapOf("name" to "coins"),
    "loadVar" to mapOf("name" to "coins"),
    "deleteSavedVar" to mapOf("name" to "coins"),
    "onMyVarChanged" to mapOf("name" to "hp"),
    "whenMyVarReaches" to mapOf("name" to "hp", "op" to "≤", "value" to 0.0),
    "listAdd" to mapOf("name" to "list", "where" to "at the end", "value" to 0.0),
    "listRemove" to mapOf("name" to "list", "mode" to "last", "n" to 1.0),
    "listSet" to mapOf("name" to "list", "position" to 1.0, "value" to 0.0),
    "listClear" to mapOf("name" to "list"),
    "listOrder" to mapOf("name" to "list", "mode" to "shuffle"),
    "listFill" to mapOf("name" to "list", "from" to 1.0, "to" to 10.0),
    "forEachList" to mapOf("name" to "list"),
    "listGet" to mapOf("name" to "list", "position" to 1.0),
    "listLen" to mapOf("name" to "list"),
    "listHas" to mapOf("name" to "list", "value" to 0.0),
    "listFind" to mapOf("name" to "list", "value" to 0.0),
    "listRandom" to mapOf("name" to "list"),
    "listStat" to mapOf("name" to "list", "op" to "sum"),
    "funcDef" to mapOf("name" to "double"),
    "funcArg" to mapOf("which" to "a"),
    "funcReturn" to mapOf("value" to 0.0),
    "callFunc" to mapOf("name" to "double", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "runFunc" to mapOf("name" to "double", "store" to "", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "callLater" to mapOf("name" to "explode", "on" to "this object", "seconds" to 1.0, "value" to 0.0),
    "callerIs" to mapOf("tag" to "player"),
    "callFuncOn" to mapOf("name" to "double", "on" to "object named", "object" to "Game Manager", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "runFuncOn" to mapOf("name" to "double", "on" to "object named", "object" to "Game Manager", "store" to "", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "objHasFunc" to mapOf("name" to "double", "object" to "Game Manager"),
    "getObjVar" to mapOf("object" to "Door", "name" to "open"),
    "getObjText" to mapOf("object" to "Door", "name" to "label"),
    "setObjVar" to mapOf("object" to "Door", "name" to "open", "op" to "set", "value" to "1"),
    "runTriggerN" to mapOf("name" to "Open door"),
    "runMyAction" to mapOf("name" to "Reward", "a" to "", "b" to "", "c" to ""),
    "goToPage" to mapOf("page" to "shop", "var" to "page", "history" to "open (Back returns)"),
    "goBack" to mapOf("var" to ""),
    "onPage" to mapOf("page" to "shop", "var" to "page"),
    "pageIs" to mapOf("page" to "home", "var" to "page"),
    "triggerEnter" to mapOf("tag" to ""),
    "triggerExit" to mapOf("tag" to ""),
    "triggerStay" to mapOf("tag" to ""),
    "collisionEnter" to mapOf("tag" to "", "minSpeed" to 0.0),
    "collisionExit" to mapOf("tag" to ""),
    "collisionStay" to mapOf("tag" to ""),
    "addForce" to mapOf("mode" to "force (every frame)", "target" to "self", "x" to 0.0, "y" to 0.0, "z" to 0.0),
    "explosion" to mapOf("tag" to "", "force" to 0.0, "radius" to 0.0),
    "setBodyType" to mapOf("type" to "dynamic", "target" to "self"),
    "setTrigger" to mapOf("mode" to "trigger", "target" to "self"),
    "physMaterial" to mapOf("bounce" to 0.5, "friction" to 0.2, "mass" to 1.0),
    "inTrigger" to mapOf("tag" to ""),
    "isColliding" to mapOf("tag" to ""),
    "raycast" to mapOf("dir" to "forward", "tag" to "", "toward" to "player", "triggers" to false, "debug" to false, "distance" to 0.0, "dx" to 1.0, "dy" to 0.0, "dz" to 0.0),
    "rayHits" to mapOf("dir" to "ahead & down", "tag" to "", "toward" to "player", "distance" to 0.0),
    "hitInfo" to mapOf("what" to "distance"),
    "overlap" to mapOf("tag" to "enemy", "radius" to 0.0),
    "countRadius" to mapOf("tag" to "enemy", "radius" to 0.0),
    "forEachTag" to mapOf("tag" to "enemy"),
)
private fun graphDefaults4(): Map<String, Map<String, Any?>> = mapOf(
    "pickNearest" to mapOf("tag" to "enemy", "maxDistance" to 0.0),
    "pickObject" to mapOf("object" to "Player"),
    "lineOfSight" to mapOf("tag" to "player", "range" to 0.0),
    "objectNear" to mapOf("tag" to "player", "range" to 0.0),
    "otherInfo" to mapOf("what" to "x"),
    "otherHasTag" to mapOf("tag" to "enemy"),
    "animPlaying" to mapOf("clip" to ""),
    "textJoin" to mapOf("sep" to "", "a" to "Score: ", "b" to "", "c" to ""),
    "textFill" to mapOf("text" to "Hi {playerName}! {a} coins", "a" to 0.0, "b" to 0.0),
    "numText" to mapOf("format" to "normal (1,234)", "value" to 1234.0),
    "textLen" to mapOf("text" to "hello"),
    "textCase" to mapOf("to" to "UPPER", "text" to "hello world"),
    "textReplace" to mapOf("text" to "I like cats", "find" to "cats", "with" to "dogs"),
    "textPart" to mapOf("text" to "Pocket", "start" to 1.0, "length" to 3.0),
    "textCheck" to mapOf("op" to "starts with", "text" to "Hello", "other" to "he"),
    "textNum" to mapOf("text" to "42"),
    "getText" to mapOf("name" to "playerName"),
    "setTextTo" to mapOf("name" to "playerName", "text" to "Hero"),
    "showText" to mapOf("object" to "", "text" to "Hello"),
    "randomWord" to mapOf("words" to "red | green | blue"),
    "wordAt" to mapOf("words" to "Mon | Tue | Wed | Thu | Fri | Sat | Sun", "position" to 1.0),
    "timerStart" to mapOf("name" to "timer", "mode" to "count down", "seconds" to 30.0),
    "timerControl" to mapOf("name" to "timer", "do" to "pause", "seconds" to 5.0),
    "timerValue" to mapOf("name" to "timer", "what" to "seconds"),
    "onTimerDone" to mapOf("name" to "timer"),
    "clock" to mapOf("part" to "hour"),
    "dailyCheck" to mapOf("key" to "daily", "streak" to "streak"),
    "stampTime" to mapOf("key" to "lastPlayed"),
    "onKey" to mapOf("key" to "Space", "when" to "pressed"),
    "keyHeld" to mapOf("key" to "Space"),
    "keyAxis" to mapOf("axis" to "left / right"),
    "onScreenTouch" to mapOf("where" to "anywhere"),
    "dragAmount" to mapOf("axis" to "x"),
    "askPermission" to mapOf("kind" to "location", "title" to "", "why" to "", "soft" to true),
    "camLive" to mapOf("camera" to "Camera 2", "seconds" to -1.0, "ease" to "inOutCubic"),
    "camNoise" to mapOf("camera" to "Camera", "amount" to 4.0),
    "camDutch" to mapOf("camera" to "Camera", "degrees" to 12.0),
    "camLens" to mapOf("camera" to "Camera", "what" to "zoom (2D)", "value" to 1.5),
    "camFocus" to mapOf("object" to "Chest", "zoom" to 1.6, "seconds" to 1.5),
    "zoomPunch" to mapOf("amount" to 0.12, "seconds" to 0.25),
    "takePhoto" to mapOf("then" to "share", "var" to "photo", "text" to "Look at this!"),
    "fadeLight" to mapOf("object" to "", "color" to "#ffd9a0", "keepColor" to true, "brightness" to 1.0, "range" to 0.0, "seconds" to 1.0),
    "lightEffect" to mapOf("object" to "", "effect" to "pulse", "speed" to 1.0),
    "setDarkness" to mapOf("color" to "#0a0a1e", "darkness" to 0.7, "seconds" to 1.0),
    "setSun" to mapOf("color" to "#ffffff", "brightness" to 1.0, "ambient" to 0.45, "seconds" to 1.0),
    "lightingPreset" to mapOf("preset" to "Night", "seconds" to 2.0),
    "camIsLive" to mapOf("camera" to "Camera"),
    "camMoveTo" to mapOf("x" to 200.0, "y" to 350.0, "seconds" to 0.6),
    "camToObject" to mapOf("object" to "Player", "seconds" to 0.6),
    "camZoomTo" to mapOf("zoom" to 1.5, "seconds" to 0.5),
    "camValue" to mapOf("what" to "x"),
    "playMusic" to mapOf("sound" to "", "loop" to "loop", "volume" to 0.6),
    "stopMusic" to mapOf("fade" to 0.5),
    "setVolume" to mapOf("volume" to 1.0),
    "muteSound" to mapOf("mode" to "toggle"),
    "playNote" to mapOf("wave" to "triangle", "note" to 60.0, "seconds" to 0.25),
    "chase" to mapOf("tag" to "player", "speed" to 0.0, "stopAt" to 0.0),
    "flee" to mapOf("tag" to "player", "speed" to 0.0, "safeDistance" to 0.0),
    "wander" to mapOf("speed" to 0.0, "radius" to 0.0),
    "orbit" to mapOf("tag" to "player", "radius" to 0.0, "degreesPerSecond" to 90.0),
)
private fun graphDefaults5(): Map<String, Map<String, Any?>> = mapOf(
    "keepDistance" to mapOf("tag" to "player", "distance" to 0.0, "speed" to 0.0),
    "patrol" to mapOf("axis" to "left / right", "distance" to 0.0, "speed" to 0.0),
    "share" to mapOf("text" to "I scored {score}!"),
    "copyText" to mapOf("text" to "{score}"),
    "openLink" to mapOf("url" to "https://"),
    "deviceIs" to mapOf("is" to "portrait"),
    "setObjLayer" to mapOf("target" to "self", "object" to "", "layer" to "Enemy"),
    "forEachInLayer" to mapOf("layer" to "Enemy"),
    "onUiTap" to mapOf("object" to "Play Button"),
    "uiShow" to mapOf("object" to "Panel", "mode" to "show", "anim" to "pop", "seconds" to 0.25),
    "openPopup" to mapOf("object" to "Popup", "mode" to "open"),
    "toast" to mapOf("text" to "Saved!", "where" to "bottom", "color" to "#1f2433", "seconds" to 2.0),
    "alert" to mapOf("title" to "Level complete!", "text" to "You scored {score}.", "ok" to "OK", "pause" to true),
    "confirm" to mapOf("title" to "Restart?", "text" to "Your progress on this level will be lost.", "yes" to "Yes", "no" to "No", "pause" to true),
    "askText" to mapOf("question" to "What's your name?", "name" to "playerName", "placeholder" to "Hero", "max" to 16.0),
    "uiEnable" to mapOf("object" to "Shop Button", "mode" to "disable"),
    "setImage" to mapOf("object" to "", "image" to "art:star"),
    "setBadge" to mapOf("object" to "Shop Button", "color" to "#ff3b30", "number" to 3.0),
    "uiTheme" to mapOf("theme" to "Neon"),
    "uiOrder" to mapOf("object" to "", "mode" to "to front"),
    "uiSize" to mapOf("object" to "", "width" to 200.0, "height" to 60.0, "seconds" to 0.0),
    "scrollTo" to mapOf("object" to "Scroll View", "where" to "top", "fraction" to 0.5),
    "safeArea" to mapOf("side" to "top"),
    "whileLoop" to mapOf("max" to 1000.0, "condition" to false),
    "repeatUntil" to mapOf("max" to 1000.0, "stop when" to false),
    "switchText" to mapOf("cases" to "home, shop, map", "text" to "shop"),
    "arrAdd" to mapOf("name" to "items", "where" to "at the end", "value" to "sword"),
    "arrInsert" to mapOf("name" to "items", "position" to 1.0, "value" to "shield"),
    "arrGetText" to mapOf("name" to "items", "position" to 1.0),
    "arrJoin" to mapOf("name" to "items", "sep" to ", "),
    "arrSplit" to mapOf("name" to "items", "sep" to ",", "text" to "a, b, c"),
    "arrCount" to mapOf("name" to "items", "value" to "sword"),
    "arrSlice" to mapOf("name" to "items", "to" to "part", "from" to 1.0, "to position" to 3.0),
    "arrConcat" to mapOf("a" to "items", "b" to "more", "to" to "all"),
    "arrUnique" to mapOf("name" to "items"),
    "arrFilter" to mapOf("name" to "items", "op" to ">", "to" to "", "value" to "10"),
    "arrMap" to mapOf("name" to "items", "op" to "add", "value" to "1"),
    "arrSwap" to mapOf("name" to "items", "a" to 1.0, "b" to 2.0),
    "arrIndexOfMax" to mapOf("name" to "items", "which" to "biggest"),
    "mapSet" to mapOf("name" to "stats", "key" to "hp", "value" to "100"),
    "mapGet" to mapOf("name" to "stats", "key" to "hp"),
    "mapGetNum" to mapOf("name" to "stats", "key" to "hp"),
    "mapAdd" to mapOf("name" to "stats", "key" to "xp", "amount" to 1.0),
    "mapHas" to mapOf("name" to "stats", "key" to "hp"),
    "mapRemove" to mapOf("name" to "stats", "key" to "hp"),
    "mapClear" to mapOf("name" to "stats"),
    "mapSize" to mapOf("name" to "stats"),
    "mapKeys" to mapOf("name" to "stats", "to" to "keys"),
    "mapForEach" to mapOf("name" to "stats"),
    "sendValue" to mapOf("message" to "hit", "value" to "10"),
    "waitEvent" to mapOf("message" to "ready", "timeout" to 0.0),
    "setDelegate" to mapOf("var" to "onHit", "func" to "double"),
    "callDelegate" to mapOf("var" to "onHit", "store" to "", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "callDelegateV" to mapOf("var" to "onHit", "a" to 0.0, "b" to 0.0, "c" to 0.0),
    "bindMessage" to mapOf("message" to "hit", "func" to "double", "mode" to "start listening"),
    "hasFunction" to mapOf("func" to "double"),
    "onFingerDown" to mapOf("where" to "on this object"),
    "onKeyUp" to mapOf("key" to "space"),
    "onIdle" to mapOf("seconds" to 5.0),
    "onMovement" to mapOf("speed" to 10.0),
)
private fun graphDefaults6(): Map<String, Map<String, Any?>> = mapOf(
    "onFalling" to mapOf("speed" to 60.0),
    "onFellFar" to mapOf("distance" to 800.0),
    "onSpeedAbove" to mapOf("speed" to 400.0),
    "onObjectFar" to mapOf("tag" to "player", "distance" to 200.0),
    "onSight" to mapOf("tag" to "player"),
    "onHealthLow" to mapOf("percent" to 30.0),
    "onAnySpawned" to mapOf("tag" to ""),
    "onAnyDestroyed" to mapOf("tag" to "enemy"),
    "onNoneLeft" to mapOf("tag" to "enemy"),
    "onSpriteFrame" to mapOf("frame" to 0.0),
    "buyProduct" to mapOf("product" to "coins_100"),
    "exportSlot" to mapOf("slot" to "1", "var" to "saveCode", "copy" to true),
    "importSlot" to mapOf("slot" to "1", "var" to "saveCode"),
    "onTimeReaches" to mapOf("seconds" to 30.0),
    "onClock" to mapOf("time" to "18:00"),
    "onWelcomeBack" to mapOf("hours" to 1.0),
    "menuOpen" to mapOf("menu" to "menu", "mode" to "toggle"),
    "navBars" to mapOf("mode" to "hide"),
    "haptic" to mapOf("style" to "medium"),
    "vibratePattern" to mapOf("pattern" to "80, 60, 80, 60, 200"),
    "appBadge" to mapOf("count" to 1.0),
    "fullScreen" to mapOf("mode" to "toggle"),
    "keepScreenOn" to mapOf("mode" to "on"),
    "everyNth" to mapOf("n" to 3.0),
    "firstTimeEver" to mapOf("key" to "tutorial"),
    "le_longPress" to mapOf("seconds" to 0.6),
    "playGameN" to mapOf("game" to "2"),
    "curPage" to mapOf("var" to "page"),
    "goPageWith" to mapOf("page" to "details", "name" to "selected", "var" to "page", "value" to ""),
    "forEachRecord" to mapOf("collection" to "Tasks", "filter" to "", "sort" to "newest first", "max" to 100.0),
    "findRecord" to mapOf("collection" to "Tasks", "field" to "title", "op" to "is", "page" to "", "value" to "Milk"),
    "setRecordField" to mapOf("field" to "done", "value" to "yes"),
    "toggleField" to mapOf("field" to "done"),
    "updateRecords" to mapOf("collection" to "Tasks", "filter" to "done = yes", "field" to "archived", "value" to "yes"),
    "deleteRecords" to mapOf("collection" to "Tasks", "filter" to "done = yes"),
    "recordsToArray" to mapOf("collection" to "Tasks", "field" to "title", "filter" to "", "sort" to "newest first", "name" to "titles"),
    "clearVars" to mapOf("names" to "title, amount, note"),
    "setDarkMode" to mapOf("mode" to "toggle"),
    "showLoading" to mapOf("mode" to "show", "text" to "Loading…"),
    "openPhoneApp" to mapOf("app" to "email", "to" to "hello@example.com", "subject" to "", "body" to ""),
)
val graphDefaults: Map<String, Map<String, Any?>> by lazy { graphDefaults0() + graphDefaults1() + graphDefaults2() + graphDefaults3() + graphDefaults4() + graphDefaults5() + graphDefaults6() }


// The logic system's item, quest and dialogue instructions and conditions (Triggers, State Machine, Visual Script), from the
// Dart ItemSystems constructor. Compiles once both the logic port (LogicCtx, g.systems["actions"] / ["conditions"]) and the items
// port (ItemSystems with add, dropNear, use, craft, learn, startQuest…) are merged; call registerLogicHooks() at the end of
// ItemSystems' init (right after it hooks `g.on { questEvent("message", it, 1) }`).
// imports: (none beyond PocketGame.kt's)

@Suppress("UNCHECKED_CAST")
fun ItemSystems.registerLogicHooks() {
    fun ps(p: Map<String, Any?>, k: String) = g.fill(strOf(p[k]))
    val acts = g.systems.getOrPut("actions") { mutableMapOf<String, (LogicCtx, Map<String, Any?>) -> Any?>() } as MutableMap<String, (LogicCtx, Map<String, Any?>) -> Any?>
    acts["giveItem"] = { _, p -> add(ps(p, "item"), numOf(p["amount"], 1.0).roundToInt(), icon = strOf(p["icon"])); null }
    acts["dropItem"] = { c, p -> dropNear(ps(p, "item"), numOf(p["amount"], 1.0).roundToInt(), c.e); null }
    acts["useItemFx"] = { c, p -> use(ps(p, "item"), c.e); null }
    acts["craftItem"] = { _, p -> craft(ps(p, "item"), numOf(p["times"], 1.0).roundToInt()); null }
    acts["learnRecipe"] = { _, p -> learn(ps(p, "item")); null }
    acts["questStart"] = { _, p -> startQuest(ps(p, "quest")); null }
    acts["questComplete"] = { _, p -> completeQuest(ps(p, "quest")); null }
    acts["questFail"] = { _, p -> failQuest(ps(p, "quest")); null }
    acts["questReset"] = { _, p -> resetQuest(ps(p, "quest")); null }
    acts["questAdvance"] = { _, p -> advanceQuest(ps(p, "quest"), numOf(p["amount"], 1.0).roundToInt(), numOf(p["objective"]).roundToInt()); null }
    acts["startDialogue"] = { _, p -> startDialogue(ps(p, "dialogue"), start = strOf(p["section"], "start")); null }
    val conds = g.systems.getOrPut("conditions") { mutableMapOf<String, (LogicCtx, Map<String, Any?>) -> Boolean>() } as MutableMap<String, (LogicCtx, Map<String, Any?>) -> Boolean>
    conds["hasItem"] = { _, p -> count(ps(p, "item")) >= max(1.0, numOf(p["count"], 1.0)) }
    conds["canCraft"] = { _, p -> canCraft(ps(p, "item"), numOf(p["times"], 1.0).roundToInt()) }
    conds["knowsRecipe"] = { _, p -> knows(ps(p, "item")) }
    conds["questIs"] = { _, p ->
        val st = questState(ps(p, "quest")); val want = strOf(p["state"], "active")
        when (want) { "started" -> st != "available" && st != "locked"; "not started" -> st == "available" || st == "locked"; else -> st == want }
    }
}
