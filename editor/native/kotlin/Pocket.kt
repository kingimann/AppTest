@file:OptIn(ExperimentalMaterial3Api::class, kotlin.time.ExperimentalTime::class)

// Pocket runtime for Compose Multiplatform (Android and iOS): the app's state (variables, data collections, the opened
// record, navigation) and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by
// Pocket Engine's native export; the pages in pages/ are yours to change, and so is this file.
package __PACKAGE__

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*

// ---------------------------------------------------------------------------------------------------------------
// The phone: saving, and the Back gesture (Platform.android.kt / Platform.ios.kt)
// ---------------------------------------------------------------------------------------------------------------

/** Saving on the phone (Android: SharedPreferences, iOS: NSUserDefaults). */
expect object Store {
    fun get(key: String): String?
    fun put(key: String, value: String)
}

/** Android's Back button / gesture (nothing on iOS: the page has a back arrow). */
@Composable
expect fun PlatformBack(enabled: Boolean, onBack: () -> Unit)

// ---------------------------------------------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------------------------------------------

data class Field(val key: String, val name: String, val type: String, val options: List<String> = emptyList(), val def: Any? = null)
data class Collection(val name: String, val fields: List<Field>, val sample: List<Map<String, Any?>> = emptyList())
/** A number worked out from a collection (count, sum, average, min, max) and kept in a variable. */
data class Stat(val variable: String, val collection: String, val how: String, val field: String = "", val filter: String = "")
data class NavTab(val label: String, val icon: ImageVector, val page: String, val badge: String = "")

typealias Row = Map<String, Any?>

/** A button on the right of the App Bar: icon (a name, or theme for the dark mode moon / sun), what it does
 *  ("dark mode toggle", "page:friends", or a message), a badge variable, and the pages it shows on (empty = all). */
data class BarAction(val icon: String, val does: String, val badge: String = "", val only: List<String> = emptyList())
/** The App Bar's look, from the project: x (your avatar on the left, the app's name on brand pages), title position, buttons, colours. */
data class BarStyle(val look: String = "standard", val brandPages: List<String> = listOf("home"), val center: Boolean = false, val avatar: Boolean = false, val left: String = "back, else menu", val circles: String = "plain", val actions: List<BarAction> = emptyList(), val bg: String = "@bar", val text: String = "@text", val icon: String = "@text", val border: Boolean = true, val size: Int = 19)
/** The Bottom Nav's style (pill, floating, glass, segmented, dock, minimal…), when names show (always, selected only, never),
 *  the gap around a floating bar, and colours (on: the icon on a solid highlight). */
data class NavStyle(val style: String = "pill", val bar: String = "@bar", val active: String = "@accent", val idle: String = "@sub", val labels: String = "always", val margin: Int = 14, val on: String = "#ffffff") {
    val floating get() = style in listOf("floating", "glass", "segmented", "dock")
    val pill get() = style in listOf("pill", "floating", "glass", "bubble", "classic")
    val solid get() = style in listOf("segmented", "chips")
}

/** A row of the Side Menu: a page, a message, a switch for a variable (toggle), a section title or a line. */
data class MenuItem(val kind: String, val label: String, val icon: String = "", val to: String = "", val badge: String = "")
/** The Side Menu: its header (the signed-in person, or a title, subtitle and picture), rows, footer and colours. */
data class SideMenuStyle(
    val side: String = "left", val title: String = "", val subtitle: String = "", val avatar: String = "", val header: String = "simple", val social: Boolean = false, val profilePage: String = "profile",
    val items: List<MenuItem> = emptyList(), val footer: List<MenuItem> = emptyList(), val footerText: String = "",
    val bg: String = "#151826", val text: String = "#e8eaf2", val accent: String = "#4fa3ff", val badge: String = "#ff3b5c", val width: Int = 290,
)

/** The app's colours (@tokens) for light or dark. */
class Palette(val c: Map<String, Color>) {
    fun resolve(v: String?): Color? {
        if (v.isNullOrEmpty()) return null
        val t = v.removePrefix("@")
        c[t]?.let { return it }
        val h = v.removePrefix("#")
        if (h.length == 6) h.toLongOrNull(16)?.let { return Color(0xFF000000 or it) }
        Regex("^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)$").find(v)?.let { m -> // rgba(255,255,255,0.1)
            val (r, g, b) = m.destructured
            return Color(r.toInt(), g.toInt(), b.toInt(), ((m.groupValues[4].toFloatOrNull() ?: 1f) * 255).toInt().coerceIn(0, 255))
        }
        return null
    }
    val bg get() = c.getValue("bg")
    val card get() = c.getValue("card")
    val text get() = c.getValue("text")
    val sub get() = c.getValue("sub")
    val line get() = c.getValue("line")
    val field get() = c.getValue("field")
    val accent get() = c.getValue("accent")
    val onAccent get() = c.getValue("onAccent")
    val danger get() = c.getValue("danger")
}

fun show(v: Any?): String = when (v) {
    null -> ""
    is Boolean -> if (v) "yes" else "no"
    is Double -> if (v == kotlin.math.floor(v) && kotlin.math.abs(v) < 1e15) v.toLong().toString() else v.toString()
    is Float -> show(v.toDouble())
    else -> v.toString()
}
fun num(v: Any?): Double? = when (v) { is Number -> v.toDouble(); is Boolean -> if (v) 1.0 else 0.0; else -> v?.toString()?.toDoubleOrNull() }
fun isOn(v: Any?): Boolean = v == true || v == 1.0 || v == "yes" || v == "true"
fun nowMs(): Double = kotlin.time.Clock.System.now().toEpochMilliseconds().toDouble()

/** A day as yyyy-mm-dd from milliseconds since 1970 (UTC). */
fun dayOf(ms: Long): String {
    val z = ms / 86_400_000L + 719_468L
    val era = (if (z >= 0) z else z - 146_096) / 146_097
    val doe = z - era * 146_097
    val yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365
    val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
    val mp = (5 * doy + 2) / 153
    val d = doy - (153 * mp + 2) / 5 + 1
    val m = if (mp < 10) mp + 3 else mp - 9
    val y = yoe + era * 400 + (if (m <= 2) 1 else 0)
    return "$y-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
}

private fun toJson(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is Boolean -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v.toDouble())
    is Map<*, *> -> JsonObject(v.entries.associate { it.key.toString() to toJson(it.value) })
    is List<*> -> JsonArray(v.map { toJson(it) })
    else -> JsonPrimitive(v.toString())
}
private fun fromJson(e: JsonElement): Any? = when (e) {
    is JsonNull -> null
    is JsonPrimitive -> if (e.isString) e.content else e.booleanOrNull ?: e.doubleOrNull ?: e.content
    is JsonObject -> e.mapValues { fromJson(it.value) }
    is JsonArray -> e.map { fromJson(it) }
}

// ---------------------------------------------------------------------------------------------------------------
// The app's state
// ---------------------------------------------------------------------------------------------------------------

lateinit var app: AppState
/** Has the app been set up yet (App.kt does it once)? */
fun appReady(): Boolean = ::app.isInitialized

class AppState(
    val name: String, val home: String, val light: Palette, val dark: Palette, vars: Map<String, Any?>,
    val tabs: List<NavTab>, val collections: List<Collection>, val stats: List<Stat>, val themeSetting: String = "follow the phone",
    val bar: BarStyle = BarStyle(), val nav: NavStyle = NavStyle(), val menu: SideMenuStyle? = null,
    /** Pop-up notifications ("notify Title|text|icon"); null: the app has none. */
    val notify: NotifyStyle? = null,
) {
    /** Is the Side Menu open? (☰ or your avatar on the App Bar opens it.) */
    var menuOpen by mutableStateOf(false)
    val menuOn get() = menu != null && bar.left != "none" && bar.left != "back"
    val vars = mutableStateMapOf<String, Any?>()
    val data = mutableStateMapOf<String, List<Row>>()
    var tab by mutableStateOf(0)
    val stacks = List(maxOf(1, tabs.size)) { mutableStateListOf<String>() }
    var openCollection by mutableStateOf<String?>(null)
    var openId by mutableStateOf<String?>(null)

    init {
        this.vars.putAll(vars)
        load()
    }

    /** Load what was saved on the phone (or the sample records the first time). */
    private fun load() {
        val saved = Store.get("pocket.data")?.let { runCatching { fromJson(Json.parseToJsonElement(it)) as? Map<*, *> }.getOrNull() }
        for (c in collections) {
            @Suppress("UNCHECKED_CAST")
            val rows = (saved?.get(c.name) as? List<*>)?.mapNotNull { it as? Map<String, Any?> }
            data[c.name] = rows ?: c.sample.mapIndexed { i, r -> blank(c.name) + r + mapOf("_id" to "s$i", "_at" to (r["_at"] ?: i.toDouble())) } // (later rows count as newer)
        }
        Store.get("pocket.vars")?.let { s -> runCatching { (fromJson(Json.parseToJsonElement(s)) as? Map<*, *>)?.forEach { (k, v) -> vars[k.toString()] = v } } }
        work()
    }

    private fun changed() {
        work()
        Store.put("pocket.data", toJson(data.toMap()).toString())
        Store.put("pocket.vars", toJson(vars.toMap()).toString())
    }

    /** Stats are worked out again whenever the data changes. */
    /** Stats, {posts_count}-style counts and the social counts ({unread}, {notifications_unread}, {friend_requests}). */
    private fun work() {
        val me = show(vars["playerHandle"]).ifEmpty { show(vars["playerName"]).ifEmpty { "You" }.lowercase().replace(Regex("\\s+"), "") }
        for (c in collections) vars[c.name.trim().lowercase().replace(Regex("[^a-z0-9]+"), "_") + "_count"] = rows(c.name).size.toDouble()
        if (def("Notifications") != null) vars["notifications_unread"] = rows("Notifications").count { show(it["to"]) == me && !isOn(it["read"]) }.toDouble()
        if (def("Friends") != null) vars["friend_requests"] = rows("Friends").count { show(it["status"]) != "accepted" && show(it["to"]) == me }.toDouble()
        if (def("Messages") != null && stats.none { it.variable == "unread" }) {
            val read = rows("Reads").filter { show(it["handle"]) == me }.associate { show(it["chat"]) to (num(it["at"]) ?: 0.0) }
            vars["unread"] = rows("Messages").count { show(it["handle"]) != me && (num(it["_at"]) ?: 0.0) > (read[show(it["chat"])] ?: 0.0) }.toDouble()
        }
        for (s in stats) vars[s.variable] = stat(s.collection, s.how, s.field, s.filter)
    }

    /** A new record's values: each field's default (dates: today). */
    fun blank(name: String): Row = (def(name)?.fields ?: emptyList()).associate { f ->
        val d = f.def
        f.key to (if (d != null && d != "") when {
            f.type == "yes/no" -> isOn(d)
            f.type in listOf("number", "money", "rating") -> num(d) ?: 0.0
            d == "today" && f.type == "date" -> dayOf(nowMs().toLong())
            else -> d
        } else when (f.type) {
            "yes/no" -> false
            "date" -> dayOf(nowMs().toLong())
            "choice" -> f.options.firstOrNull() ?: ""
            "number", "money", "rating" -> 0.0
            else -> ""
        })
    }

    /** How a value reads: dates as Today / Tomorrow / 3 Mar, money with $, yes/no as ✓. */
    fun text(collection: String?, key: String, v: Any?): String {
        if (v == null || v == "") return ""
        val f = def(collection ?: "")?.fields?.firstOrNull { it.key == key }
        return when (f?.type) {
            "money" -> { val n = num(v) ?: 0.0; (if (n < 0) "−" else "") + "$" + (kotlin.math.round(kotlin.math.abs(n) * 100) / 100).let { if (it == kotlin.math.floor(it)) it.toLong().toString() else it.toString() } }
            "yes/no" -> if (isOn(v)) "✓" else ""
            "date" -> {
                val k = show(v).take(10)
                val today = nowMs().toLong()
                val months = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
                when (k) {
                    dayOf(today) -> "Today"
                    dayOf(today - 86_400_000L) -> "Yesterday"
                    dayOf(today + 86_400_000L) -> "Tomorrow"
                    else -> { val p = k.split("-"); if (p.size == 3) "${p[2].toIntOrNull() ?: p[2]} ${months.getOrElse((p[1].toIntOrNull() ?: 1) - 1) { "" }}" + if (p[0] != dayOf(today).take(4)) " ${p[0]}" else "" else show(v) }
                }
            }
            else -> show(v)
        }
    }

    // ---- variables and text ----
    fun get(k: String): Any? = vars[k]
    fun set(k: String, v: Any?) { vars[k] = v; changed() }
    fun add(k: String, by: Double) = set(k, (num(vars[k]) ?: 0.0) + by)

    /** "{score} points" → "12 points"; {record_title} is the opened record's title; with a row, {title} is the row's. */
    fun fill(t: String, row: Row? = null, collection: String? = null): String = Regex("\\{(\\w+)\\}").replace(t) { m ->
        val k = m.groupValues[1]
        when {
            row != null && row.containsKey(k) -> if (collection == null) show(row[k]) else text(collection, k, row[k])
            k.startsWith("record_") -> text(openCollection, k.removePrefix("record_"), opened?.get(k.removePrefix("record_")))
            else -> show(vars[k])
        }
    }

    // ---- data ----
    fun def(name: String) = collections.firstOrNull { it.name == name }
    fun rows(name: String): List<Row> = data[name] ?: emptyList()
    val opened: Row? get() { val c = openCollection ?: return null; val id = openId ?: return null; return rows(c).firstOrNull { it["_id"] == id } }

    /** Rows that pass the filter ("done = no", "amount > 10 and kind = Food"), match the search, in order. */
    fun query(name: String, filter: String = "", search: String = "", sort: String = "newest first"): List<Row> {
        val fields = def(name)?.fields ?: emptyList()
        var list = rows(name).filter { passes(it, fill(filter)) }
        val q = search.trim().lowercase()
        if (q.isNotEmpty()) list = list.filter { r -> fields.any { it.type in listOf("text", "long text", "choice", "icon") && show(r[it.key]).lowercase().contains(q) } }
        val s = sort.lowercase()
        fun at(r: Row) = num(r["_at"]) ?: 0.0
        return when {
            s == "newest first" -> list.sortedByDescending { at(it) }
            s == "oldest first" -> list.sortedBy { at(it) }
            else -> {
                val m = Regex("^(.+?)(?:\\s+\\((a-z|z-a|low-high|high-low)\\))?$").find(s)
                val key = m?.groupValues?.get(1)?.trim()?.replace(Regex("[^a-z0-9]+"), "_") ?: return list
                val desc = m.groupValues[2] in listOf("z-a", "high-low")
                val cmp = Comparator<Row> { a, b -> val x = num(a[key]); val y = num(b[key]); if (x != null && y != null) x.compareTo(y) else show(a[key]).compareTo(show(b[key])) }
                list.sortedWith(if (desc) cmp.reversed() else cmp)
            }
        }
    }

    private fun passes(r: Row, filter: String): Boolean {
        if (filter.isBlank()) return true
        for (part in filter.split(Regex("\\s+and\\s+", RegexOption.IGNORE_CASE))) {
            val m = Regex("^\\s*(\\w[\\w ]*?)\\s*(!=|≠|>=|≥|<=|≤|=|>|<)\\s*(.*?)\\s*$").find(part) ?: continue
            val (rawKey, op, raw) = m.destructured
            val v = r[rawKey.lowercase().replace(' ', '_')]
            if (raw.lowercase() == "yes" || raw.lowercase() == "no") {
                if ((op == "=") != (isOn(v) == (raw.lowercase() == "yes"))) return false
                continue
            }
            val want = raw.toDoubleOrNull(); val a = num(v)
            if (want != null && a != null) {
                val ok = when (op) { "=" -> a == want; "!=", "≠" -> a != want; ">" -> a > want; "<" -> a < want; ">=", "≥" -> a >= want; else -> a <= want }
                if (!ok) return false
                continue
            }
            val same = show(v).lowercase() == raw.lowercase()
            if ((op == "=" && !same) || ((op == "!=" || op == "≠") && same)) return false
        }
        return true
    }

    fun stat(name: String, how: String, field: String = "", filter: String = ""): Double {
        val list = query(name, filter, sort = "oldest first")
        if (how == "count") return list.size.toDouble()
        val nums = list.map { num(it[field]) ?: 0.0 }
        if (nums.isEmpty()) return 0.0
        return when (how) {
            "sum" -> kotlin.math.round(nums.sum() * 100) / 100
            "average" -> kotlin.math.round(nums.average() * 100) / 100
            "min" -> nums.min()
            else -> nums.max()
        }
    }

    fun addRecord(name: String, values: Row): String {
        val id = "r${nowMs().toLong()}${(0..999).random()}"
        data[name] = rows(name) + (blank(name) + values + mapOf("_id" to id, "_at" to nowMs()))
        changed()
        return id
    }
    fun updateRecord(name: String, id: String, values: Row) { data[name] = rows(name).map { if (it["_id"] == id) it + values else it }; changed() }
    fun deleteRecord(name: String, id: String) { data[name] = rows(name).filter { it["_id"] != id }; changed() }
    fun open(name: String, id: String) { openCollection = name; openId = id }

    // ---- navigation ----
    val stack get() = stacks[tab.coerceIn(0, stacks.size - 1)]
    /** A page with a tab switches to that tab; any other page opens on top (Back returns). */
    fun go(page: String) {
        val i = tabs.indexOfFirst { it.page == page }
        if (i >= 0) { tab = i; stacks[i].clear(); return }
        if (page == home && tabs.isEmpty()) { stack.clear(); return }
        stack.add(page)
    }
    fun back() { if (stack.isNotEmpty()) stack.removeAt(stack.size - 1) }

    // ---- messages ----
    private val listeners = mutableListOf<(String) -> Unit>()
    /** The pop-up notifications on screen now. */
    val toasts = mutableStateListOf<Toast>()
    /** Hear the app's messages (a popup's "popup", a timer's "timer pause"…); call what it returns to stop. */
    fun listen(f: (String) -> Unit): () -> Unit { listeners.add(f); return { listeners.remove(f) } }
    /** Send a message (a button's "message" action, an App Bar button…) to everything listening. */
    fun send(message: String) {
        val m = fill(message).trim()
        if (m.isEmpty()) return
        listeners.toList().forEach { it(m) }
        val n = notify ?: return
        if (m == n.listen || m.startsWith(n.listen + " ")) {
            val parts = m.removePrefix(n.listen).trim().split("|").map { it.trim() }
            toasts.add(Toast(parts[0], parts.getOrElse(1) { "" }, parts.getOrElse(2) { "" }.ifEmpty { if (n.look == "achievement") "🏆" else "" }))
            while (toasts.size > n.max) toasts.removeAt(0)
        }
    }

    /** What a button does (the same words as the button's Action in Pocket Engine). */
    fun run(action: String, value: Any? = "", amount: Double = 1.0) {
        val v = show(value)
        when (action) {
            "message" -> send(v)
            "go to page" -> go(v)
            "go back" -> back()
            "set variable" -> set(v, amount)
            "add to variable" -> add(v, amount)
            "new record" -> { openId = null; go(v) }
            "edit opened record" -> go(v)
            "delete opened record" -> { val c = openCollection; val id = openId; if (c != null && id != null) { deleteRecord(c, id); openId = null }; back() }
            else -> println("TODO: the \"$action\" action ($v) has no native version yet")
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// The app shell: tabs (a Bottom Nav) and the pages
// ---------------------------------------------------------------------------------------------------------------

val LocalPalette = staticCompositionLocalOf<Palette> { error("No palette") }

@Composable
fun PocketApp(pages: Map<String, @Composable () -> Unit>) {
    val d = app.get("darkMode")
    val dark = if (d is Boolean) d else when (app.themeSetting) { "dark" -> true; "light" -> false; else -> isSystemInDarkTheme() }
    val p = if (dark) app.dark else app.light
    val scheme = (if (dark) darkColorScheme() else lightColorScheme()).copy(primary = p.accent, onPrimary = p.onAccent, background = p.bg, surface = p.card, onSurface = p.text, onBackground = p.text, error = p.danger, surfaceVariant = p.field, onSurfaceVariant = p.sub, secondaryContainer = p.accent.copy(alpha = 0.18f))
    CompositionLocalProvider(LocalPalette provides p) {
        MaterialTheme(colorScheme = scheme) {
            val stack = app.stack
            PlatformBack(enabled = stack.isNotEmpty()) { app.back() }
            val page = stack.lastOrNull() ?: if (app.tabs.isEmpty()) app.home else app.tabs[app.tab].page
            Box(Modifier.fillMaxSize()) {
            Scaffold(
                containerColor = p.bg,
                bottomBar = {
                    // the project's Bottom Nav: its style, when names show, and colours; floating styles sit inset with round ends
                    val n0 = app.nav
                    val on = p.resolve(n0.active) ?: p.accent
                    val off = p.resolve(n0.idle) ?: p.sub
                    val onSolid = p.resolve(n0.on) ?: Color.White
                    val shape = RoundedCornerShape(26.dp)
                    if (app.tabs.isNotEmpty() && stack.isEmpty()) Box(if (n0.floating) Modifier.navigationBarsPadding().padding(start = n0.margin.dp, end = n0.margin.dp, bottom = maxOf(8, n0.margin).dp).shadow(14.dp, shape).clip(shape) else Modifier) {
                        NavigationBar(containerColor = (p.resolve(n0.bar) ?: p.card).copy(alpha = if (n0.style == "glass") 0.72f else 1f), windowInsets = if (n0.floating) WindowInsets(0) else NavigationBarDefaults.windowInsets) {
                            app.tabs.forEachIndexed { i, t ->
                                val n = if (t.badge.isEmpty()) 0 else (num(app.get(t.badge)) ?: 0.0).toInt()
                                val sel = app.tab == i
                                val showLabel = n0.labels == "always" || (n0.labels == "selected only" && sel)
                                NavigationBarItem(
                                    selected = sel, onClick = { app.go(t.page) },
                                    label = if (showLabel) ({ Text(t.label) }) else null, alwaysShowLabel = n0.labels == "always",
                                    icon = { BadgedBox(badge = { if (n > 0) Badge { Text(n.toString()) } }) { Icon(t.icon, contentDescription = t.label, modifier = Modifier.size(if (n0.labels == "never") 28.dp else 24.dp)) } },
                                    colors = NavigationBarItemDefaults.colors(selectedIconColor = if (n0.solid) onSolid else on, unselectedIconColor = off, selectedTextColor = on, unselectedTextColor = off,
                                        indicatorColor = if (n0.solid) on else if (n0.pill) on.copy(alpha = 0.22f) else Color.Transparent),
                                )
                            }
                        }
                    }
                },
            ) { pad -> Box(Modifier.padding(pad)) { (pages[page] ?: { Text("No page $page") })() } }
            if (app.menuOpen && app.menu != null) PocketDrawer(page)
            if (app.notify != null) ToastLayer() // (pop-up notifications over every page)
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------------

/** A page: its title (with a back arrow on pages opened on top), then what's on it (a list or form fills the rest). */
@Composable
fun PocketPage(title: String, page: String = "", scroll: Boolean = true, appBar: Boolean = true, fab: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    Scaffold(
        containerColor = p.bg,
        topBar = { if (appBar) PocketBar(title, page) },
        floatingActionButton = { if (fab != null) FloatingActionButton(onClick = fab, containerColor = p.accent, contentColor = p.onAccent, shape = CircleShape) { Icon(Icons.Filled.Add, contentDescription = "Add") } },
    ) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

/** The project's App Bar: its look (x: your avatar on the left and the app's name on the home page), title position, buttons with badges, colours. */
@Composable
fun PocketBar(title: String, page: String) {
    val p = LocalPalette.current
    val b = app.bar
    val back = app.stack.isNotEmpty()
    val brand = b.look != "standard" && !back && (b.brandPages.isEmpty() || page in b.brandPages)
    val ic = p.resolve(b.icon) ?: p.text
    val dark = p === app.dark
    val colors = TopAppBarDefaults.topAppBarColors(containerColor = p.resolve(b.bg) ?: p.card, titleContentColor = p.resolve(b.text) ?: p.text, navigationIconContentColor = ic, actionIconContentColor = ic)
    val titleText: @Composable () -> Unit = { Text(if (brand) app.name else app.fill(title), fontWeight = if (brand) FontWeight.Black else FontWeight.ExtraBold, fontSize = (if (brand) 22 else b.size).sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    val nav: @Composable () -> Unit = {
        if (back) IconButton(onClick = { app.back() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
        else if (b.avatar) Box(Modifier.padding(start = 12.dp).clickable { if (app.menuOn) app.menuOpen = true }) { Avatar(barName.ifEmpty { "?" }, "?", 34) } // (opens the Side Menu)
        else if (app.menuOn) IconButton(onClick = { app.menuOpen = true }) { Icon(PocketIcons.nav("menu"), contentDescription = "Menu", tint = ic) }
    }
    val actions: @Composable RowScope.() -> Unit = {
        for (a in b.actions.reversed()) { // (the first sits at the right edge)
            if (a.only.isNotEmpty() && page !in a.only) continue
            val n = if (a.badge.isEmpty()) 0 else (num(app.get(a.badge)) ?: 0.0).toInt()
            IconButton(modifier = when (b.circles) { // the buttons sit in a filled circle, a ring, or nothing
                "circles" -> Modifier.padding(horizontal = 2.dp).background(if (dark) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.06f), CircleShape)
                "outlined circles" -> Modifier.padding(horizontal = 2.dp).border(1.4.dp, ic.copy(alpha = 0.35f), CircleShape)
                else -> Modifier
            }, onClick = {
                when {
                    "dark mode" in a.does -> app.set("darkMode", !dark)
                    a.does.startsWith("page:") -> app.go(a.does.removePrefix("page:"))
                    else -> app.send(a.does)
                }
            }) { BadgedBox(badge = { if (n > 0) Badge { Text(n.toString()) } }) { Icon(PocketIcons.nav(if (a.icon == "theme") (if (dark) "sun" else "moon") else a.icon), contentDescription = a.icon, tint = ic, modifier = Modifier.size(if (b.circles == "plain") 24.dp else 20.dp)) } }
        }
    }
    Column {
        if (b.center) CenterAlignedTopAppBar(title = titleText, navigationIcon = nav, actions = actions, colors = colors)
        else TopAppBar(title = titleText, navigationIcon = nav, actions = actions, colors = colors)
        if (b.border) HorizontalDivider(color = p.line)
    }
}

/** The Side Menu over the app: a header, rows that open pages, send messages or switch a variable, and a footer. Tap outside to close. */
@Composable
fun PocketDrawer(page: String) {
    val m = app.menu ?: return
    val p = LocalPalette.current
    val bg = p.resolve(m.bg) ?: p.card
    val fg = p.resolve(m.text) ?: p.text
    val acc = p.resolve(m.accent) ?: p.accent
    val close = { app.menuOpen = false }
    @Composable
    fun row(it: MenuItem) {
        when (it.kind) {
            "line" -> HorizontalDivider(Modifier.padding(horizontal = 8.dp, vertical = 6.dp), color = fg.copy(alpha = 0.2f))
            "section" -> Text(it.label.uppercase(), Modifier.padding(start = 12.dp, top = 14.dp, bottom = 4.dp), color = fg.copy(alpha = 0.55f), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            else -> {
                val n = if (it.badge.isEmpty()) 0 else (num(app.get(it.badge)) ?: 0.0).toInt()
                val on = it.kind == "page" && it.to == page
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(14.dp)).background(if (on) acc.copy(alpha = 0.18f) else Color.Transparent)
                        .clickable {
                            when (it.kind) {
                                "toggle" -> app.set(it.to, !isOn(app.get(it.to)))
                                "page" -> { close(); app.go(it.to) }
                                else -> { close(); app.send(it.to.removePrefix("msg:")) }
                            }
                        }.padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (it.icon.isNotEmpty()) Icon(PocketIcons.nav(it.icon), contentDescription = null, tint = if (on) acc else fg, modifier = Modifier.size(22.dp))
                    Text(app.fill(it.label), Modifier.weight(1f), color = if (on) acc else fg, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (it.kind == "toggle") Switch(checked = isOn(app.get(it.to)), onCheckedChange = { v -> app.set(it.to, v) }, colors = SwitchDefaults.colors(checkedTrackColor = acc))
                    else if (n > 0) Badge(containerColor = p.resolve(m.badge) ?: p.danger) { Text(if (n > 99) "99+" else n.toString()) }
                }
            }
        }
    }
    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.45f)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { close() }, contentAlignment = if (m.side == "right") Alignment.CenterEnd else Alignment.CenterStart) {
        Column(
            Modifier.fillMaxHeight().widthIn(max = m.width.dp).fillMaxWidth(0.82f).background(bg).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                .statusBarsPadding().navigationBarsPadding().padding(horizontal = 8.dp, vertical = 8.dp).verticalScroll(rememberScrollState()),
        ) {
            Box(Modifier.fillMaxWidth()) { IconButton(onClick = close, modifier = Modifier.align(Alignment.CenterEnd)) { Icon(Icons.Filled.Close, contentDescription = "Close menu", tint = fg.copy(alpha = 0.7f)) } }
            if (m.header != "none") {
                if (m.social) Column(Modifier.fillMaxWidth().clickable { close(); app.go(m.profilePage) }.padding(start = 10.dp, bottom = 14.dp)) {
                    Avatar(meName, me, 52); Spacer(Modifier.height(8.dp))
                    Text(meName, color = fg, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold); Text("@$me", color = fg.copy(alpha = 0.65f))
                } else Column(Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(RoundedCornerShape(16.dp)).background(if (m.header == "banner") acc else Color.Transparent).padding(12.dp)) {
                    val tc = if (m.header == "banner") Color.White else fg
                    if (m.avatar.isNotEmpty()) { if (PocketIcons.art.containsKey(m.avatar)) Icon(PocketIcons.nav(m.avatar), contentDescription = null, tint = tc, modifier = Modifier.size(34.dp)) else Text(m.avatar, fontSize = 34.sp) }
                    Text(app.fill(m.title), color = tc, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                    if (m.subtitle.isNotEmpty()) Text(app.fill(m.subtitle), color = tc.copy(alpha = 0.65f))
                }
            }
            for (it in m.items) row(it)
            if (m.footer.isNotEmpty()) { HorizontalDivider(Modifier.padding(vertical = 6.dp), color = fg.copy(alpha = 0.2f)); for (it in m.footer) row(it) }
            if (m.footerText.isNotEmpty()) Text(app.fill(m.footerText), Modifier.padding(start = 12.dp, top = 8.dp), color = fg.copy(alpha = 0.5f), fontSize = 12.sp)
        }
    }
}

/** Runs edge to edge on a page (a feed), out of the page's side margins. */
fun Modifier.bleed(by: Dp = 16.dp) = layout { m, c ->
    val px = by.roundToPx()
    val pl = m.measure(c.copy(minWidth = (c.minWidth + 2 * px).coerceAtLeast(0), maxWidth = if (c.hasBoundedWidth) c.maxWidth + 2 * px else c.maxWidth))
    layout(if (c.hasBoundedWidth) c.maxWidth else pl.width, pl.height) { pl.place(-px, 0) }
}

/** Text with {variables} filled in. */
@Composable
fun PText(text: String, size: Int = 16, weight: Int = 600, color: String? = null, align: String = "left") {
    val p = LocalPalette.current
    Text(app.fill(text), Modifier.fillMaxWidth(), fontSize = size.sp, lineHeight = (size * 1.2).sp, fontWeight = FontWeight(weight.coerceIn(100, 900)), color = p.resolve(color) ?: p.text,
        textAlign = when (align) { "center" -> TextAlign.Center; "right" -> TextAlign.End; else -> TextAlign.Start })
}

enum class Look { Filled, Outlined, Danger, Plain }

/** A button in the project's look: filled, outlined or plain (a link), with its own colours, height and corners. */
@Composable
fun PButton(label: String, look: Look = Look.Filled, bg: String? = null, fg: String? = null, stroke: String? = null, height: Int = 52, radius: Int = 16, size: Int = 17, onClick: () -> Unit) {
    val p = LocalPalette.current
    val m = Modifier.fillMaxWidth().heightIn(min = height.dp)
    val shape = RoundedCornerShape(radius.dp)
    val f = p.resolve(fg)
    val pad = PaddingValues(horizontal = 8.dp)
    // the words shrink to fit rather than being cut short
    val text: @Composable () -> Unit = { androidx.compose.foundation.text.BasicText(app.fill(label), style = androidx.compose.ui.text.TextStyle(fontWeight = FontWeight.ExtraBold, color = LocalContentColor.current), maxLines = 1, autoSize = androidx.compose.foundation.text.TextAutoSize.StepBased(minFontSize = 10.sp, maxFontSize = size.sp)) }
    when (look) {
        Look.Filled -> Button(onClick, m, shape = shape, contentPadding = pad, colors = ButtonDefaults.buttonColors(containerColor = p.resolve(bg) ?: p.accent, contentColor = f ?: p.onAccent)) { text() }
        Look.Danger -> OutlinedButton(onClick, m, shape = shape, contentPadding = pad, colors = ButtonDefaults.outlinedButtonColors(contentColor = f ?: p.danger, containerColor = p.resolve(bg) ?: p.card), border = androidx.compose.foundation.BorderStroke(2.dp, p.resolve(stroke) ?: p.danger)) { text() }
        Look.Outlined -> OutlinedButton(onClick, m, shape = shape, contentPadding = pad, colors = ButtonDefaults.outlinedButtonColors(contentColor = f ?: p.accent, containerColor = p.resolve(bg) ?: Color.Transparent), border = androidx.compose.foundation.BorderStroke(2.dp, p.resolve(stroke) ?: f ?: p.accent)) { text() }
        Look.Plain -> TextButton(onClick, m, contentPadding = PaddingValues(horizontal = 4.dp), colors = ButtonDefaults.textButtonColors(contentColor = f ?: p.accent)) { text() }
    }
}

/** Where a thing sits in a card (PBox): the anchor (0, ½ or 1 of the width / height), the offset from it, its size and how its text lines up,
 *  all in the design's sizes (the card scales them to the phone's width). */
class Pin(val fx: Float = 0.5f, val fy: Float = 0.5f, val x: Float = 0f, val y: Float = 0f, val w: Float = 0f, val h: Float = 0f, val align: String = "center", val m: Float = -1f, val wrap: Float = 0f, val cell: Int = -1, val cells: Int = 0, val content: @Composable () -> Unit)

/** A card, badge, picture box or tappable row: its size, colours, corners, its own centred text, and the things in it where the design puts them. */
@Composable
fun PBox(w: Int = 368, h: Int = 48, radius: Int = 0, fill: String = "", stroke: String = "", strokeW: Int = 0, shadow: Boolean = false, text: String = "", textSize: Int = 16, textWeight: Int = 600, textColor: String = "", row: Int? = null, onTap: (() -> Unit)? = null, pins: List<Pin> = emptyList()) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(radius.dp)
    var mod = Modifier.fillMaxWidth().height(h.dp)
    if (shadow) mod = mod.shadow(4.dp, shape, clip = false)
    mod = mod.clip(shape).background(p.resolve(fill) ?: Color.Transparent, shape)
    if (stroke.isNotEmpty()) mod = mod.border((if (strokeW > 0) strokeW else 1).dp, p.resolve(stroke) ?: p.line, shape)
    if (onTap != null) mod = mod.clickable { onTap() }
    Layout(
        modifier = mod,
        content = {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { if (text.isNotEmpty()) Text(app.fill(text), fontSize = textSize.sp, fontWeight = FontWeight(textWeight.coerceIn(100, 900)), color = p.resolve(textColor) ?: p.text, textAlign = TextAlign.Center) }
            for (q in pins) Box(contentAlignment = when (q.align) { "left" -> Alignment.CenterStart; "right" -> Alignment.CenterEnd; else -> Alignment.Center }) { q.content() }
        },
    ) { ms, c ->
        val width = c.maxWidth.toFloat()
        val dens = density
        val dw = (if (w > 0) w else 368) * dens
        val s = width / dw
        val hp = h * dens
        val bg = ms[0].measure(Constraints.fixed(c.maxWidth, (hp).toInt()))
        val placed = pins.mapIndexed { i, q ->
            val px = q.fx * width + q.x * dens * s
            val top = q.fy * hp + q.y * dens
            var left: Float
            var wd: Float
            if (q.cells > 0 && row != null) { val g = row * dens * s; val cw = (width - g * (q.cells - 1)) / q.cells; left = q.cell * (cw + g) + q.m * dens * s; wd = cw - 2 * q.m * dens * s }
            else if (q.m >= 0) { left = q.m * dens * s; wd = width - 2 * q.m * dens * s }
            else if (q.w > 0) { wd = q.w * dens * s; left = px - wd / 2 }
            else if (q.align == "left") { wd = (if (q.wrap > 0) q.wrap * dens * s else width).coerceAtMost(width - px - 2); left = px }
            else if (q.align == "right") { wd = (if (q.wrap > 0) q.wrap * dens * s else width).coerceAtMost(px - 2); left = px - wd }
            else { val half = minOf(px, width - px) - 2; wd = if (q.wrap > 0 && q.wrap * dens * s < 2 * half) q.wrap * dens * s else 2 * half; left = px - wd / 2 }
            val wi = wd.coerceAtLeast(0f).toInt()
            val pl = ms[i + 1].measure(if (q.h > 0) Constraints.fixed(wi, (q.h * dens).toInt()) else Constraints(minWidth = wi, maxWidth = wi))
            Triple(pl, left.toInt(), (top - pl.height / 2f).toInt())
        }
        layout(c.maxWidth, hp.toInt()) {
            bg.place(0, 0)
            for ((pl, x, y) in placed) pl.place(x, y)
        }
    }
}

/** A thing narrower than the page on its own line: left, centred or right, as in the design. */
@Composable
fun Place(fx: Float = 0.5f, width: Int, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = when { fx < 0.25f -> Alignment.CenterStart; fx > 0.75f -> Alignment.CenterEnd; else -> Alignment.Center }) {
        Box(Modifier.widthIn(max = width.dp).fillMaxWidth()) { content() }
    }
}

/** Room between things. */
@Composable
fun PSpace(h: Int) { Spacer(Modifier.height(maxOf(0, h - 12).dp)) }

/** A bar that fills from a variable (XP, health…). */
@Composable
fun PBar(variable: String, max: Double = 100.0, height: Int = 12, fill: String = "@accent", bg: String = "@line", radius: Int = 6) {
    val p = LocalPalette.current
    val v = ((num(app.get(variable)) ?: 0.0) / (if (max == 0.0) 1.0 else max)).coerceIn(0.0, 1.0).toFloat()
    Box(Modifier.fillMaxWidth().height(height.dp).clip(RoundedCornerShape(radius.dp)).background(p.resolve(bg) ?: p.line)) {
        Box(Modifier.fillMaxWidth(v).fillMaxHeight().background(p.resolve(fill) ?: p.accent))
    }
}

/** A slider for a number variable. */
@Composable
fun PSlider(variable: String, min: Double = 0.0, max: Double = 100.0, step: Double = 1.0) {
    val v = (num(app.get(variable)) ?: min).coerceIn(min, max).toFloat()
    val steps = if (step > 0) (((max - min) / step).toInt() - 1).coerceIn(0, 200) else 0
    Slider(value = v, onValueChange = { app.set(variable, it.toDouble()) }, valueRange = min.toFloat()..max.toFloat(), steps = if (steps > 60) 0 else steps)
}

/** Segmented tabs: pick one (keeps its text, or its position 1, 2, 3…). */
@Composable
fun Segmented(variable: String, options: List<String>, index: Boolean = false) {
    val p = LocalPalette.current
    val cur = show(app.get(variable))
    Row(Modifier.fillMaxWidth().background(p.field, RoundedCornerShape(12.dp)).padding(3.dp)) {
        options.forEachIndexed { i, o ->
            val on = if (index) cur == (i + 1).toString() else cur == o
            Box(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (on) p.accent else Color.Transparent).clickable { app.set(variable, if (index) (i + 1).toDouble() else o) }.padding(vertical = 9.dp), contentAlignment = Alignment.Center) {
                Text(o, fontWeight = FontWeight.Bold, color = if (on) p.onAccent else p.sub, maxLines = 1)
            }
        }
    }
}

/** Chips: pick one. */
@Composable
fun Chips(variable: String, options: List<String>) {
    val cur = show(app.get(variable))
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (o in options) FilterChip(selected = cur == o, onClick = { app.set(variable, o) }, label = { Text(o) })
    }
}

/** A drop-down list: label to value. */
@Composable
fun PDropdown(variable: String, options: List<Pair<String, String>>, placeholder: String = "Choose…") {
    val p = LocalPalette.current
    var open by remember { mutableStateOf(false) }
    val cur = show(app.get(variable))
    Box(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().background(p.field, RoundedCornerShape(12.dp)).clickable { open = true }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(options.firstOrNull { it.second == cur }?.first ?: placeholder, Modifier.weight(1f), color = if (cur.isEmpty()) p.sub else p.text)
            Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = p.sub)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            for ((label, value) in options) DropdownMenuItem(text = { Text(label) }, onClick = { app.set(variable, value); open = false })
        }
    }
}

/** − number + */
@Composable
fun PStepper(variable: String, min: Double = 0.0, max: Double = 10.0, step: Double = 1.0) {
    val p = LocalPalette.current
    val v = num(app.get(variable)) ?: min
    Row(verticalAlignment = Alignment.CenterVertically) {
        FilledIconButton(onClick = { app.set(variable, (v - step).coerceIn(min, max)) }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = p.accent, contentColor = p.onAccent)) { Text("−", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold) }
        Text(show(v), Modifier.width(48.dp), textAlign = TextAlign.Center, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = p.text)
        FilledIconButton(onClick = { app.set(variable, (v + step).coerceIn(min, max)) }, colors = IconButtonDefaults.filledIconButtonColors(containerColor = p.accent, contentColor = p.onAccent)) { Text("+", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold) }
    }
}

/** Tap a star. */
@Composable
fun PRating(variable: String, max: Int = 5) {
    val p = LocalPalette.current
    val v = num(app.get(variable)) ?: 0.0
    Row { for (i in 0 until max) Text("★", Modifier.clickable { app.set(variable, (i + 1).toDouble()) }, fontSize = 30.sp, color = if (i < v) Color(0xFFF5B301) else p.line) }
}

/** A thin line, with a word in the middle. */
@Composable
fun PDivider(label: String = "") {
    val p = LocalPalette.current
    if (label.isEmpty()) { HorizontalDivider(color = p.line); return }
    Row(verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(Modifier.weight(1f), color = p.line)
        Text(app.fill(label), Modifier.padding(horizontal = 10.dp), color = p.sub, fontSize = 13.sp)
        HorizontalDivider(Modifier.weight(1f), color = p.line)
    }
}

/** A notice: info, success, warning or error. */
@Composable
fun PBanner(tone: String = "info", title: String = "", text: String = "", icon: String = "") {
    val p = LocalPalette.current
    val (bg, fg) = when (tone) { "warning" -> Color(0xFFFFF4D6) to Color(0xFF7A5200); "error" -> Color(0xFFFFE1E1) to Color(0xFF8A1C1C); "success" -> Color(0xFFDDF6E8) to Color(0xFF145C34); else -> p.accent.copy(alpha = 0.14f) to p.text }
    Row(Modifier.fillMaxWidth().background(bg, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
        if (icon.isNotEmpty()) Text(icon, Modifier.padding(end = 10.dp), fontSize = 18.sp)
        Column {
            if (title.isNotEmpty()) Text(app.fill(title), fontWeight = FontWeight.ExtraBold, color = fg)
            if (text.isNotEmpty()) Text(app.fill(text), color = fg)
        }
    }
}

/** Level badge, XP bar and xp / needed (each level needs base × growth^(level − 1)). */
@Composable
fun XpBar(xpVar: String = "xp", levelVar: String = "playerLevel", base: Double = 100.0, growth: Double = 1.4) {
    val p = LocalPalette.current
    val lv = maxOf(1, (num(app.get(levelVar)) ?: 1.0).toInt())
    val xp = num(app.get(xpVar)) ?: 0.0
    var need = base
    repeat(lv - 1) { need *= growth }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(30.dp).background(p.accent, CircleShape), contentAlignment = Alignment.Center) { Text("$lv", color = p.onAccent, fontWeight = FontWeight.ExtraBold) }
        Spacer(Modifier.width(10.dp))
        LinearProgressIndicator(progress = { (xp / need).coerceIn(0.0, 1.0).toFloat() }, modifier = Modifier.weight(1f).height(12.dp).clip(RoundedCornerShape(6.dp)), color = p.accent, trackColor = p.line)
        Spacer(Modifier.width(10.dp))
        Text("${show(xp)} / ${kotlin.math.round(need).toLong()}", color = p.sub, fontWeight = FontWeight.Bold)
    }
}

/** Numbered steps (the one in the variable is lit). */
@Composable
fun PSteps(variable: String, steps: List<String>) {
    val p = LocalPalette.current
    val cur = maxOf(1.0, num(app.get(variable)) ?: 1.0)
    Row(Modifier.fillMaxWidth()) {
        steps.forEachIndexed { i, t ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(28.dp).background(if (i + 1 <= cur) p.accent else p.line, CircleShape), contentAlignment = Alignment.Center) { Text(if (i + 1 < cur) "✓" else "${i + 1}", color = if (i + 1 <= cur) p.onAccent else p.sub, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp) }
                Text(t, color = if (i + 1.0 == cur) p.text else p.sub, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            }
        }
    }
}

/** Loading. */
@Composable
fun PSpinner() { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }

/** Your picture: an emoji, or the initials of {playerName}. */
@Composable
fun PAvatar(emoji: String = "", size: Int = 64) { Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { Avatar(meName, me, size, emoji.ifEmpty { null }) } }

/** A card with things side by side (a settings row, a summary). */
@Composable
fun PCard(content: @Composable RowScope.() -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), content = content)
}

/** A text box that edits a variable (search boxes too). */
@Composable
fun VarField(variable: String, placeholder: String = "", keyboard: String = "text", outlined: Boolean = false) {
    val p = LocalPalette.current
    if (outlined) { // a white box with a thin line (the project's input has a stroke)
        OutlinedTextField(
            value = show(app.get(variable)),
            onValueChange = { app.set(variable, if (keyboard == "number") it.toDoubleOrNull() ?: 0.0 else it) },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(placeholder) },
            singleLine = true,
            leadingIcon = if (keyboard == "search") ({ Icon(Icons.Filled.Search, contentDescription = null, tint = p.sub) }) else null,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = p.card, focusedContainerColor = p.card, unfocusedBorderColor = p.line, focusedBorderColor = p.accent),
        )
        return
    }
    TextField(
        value = show(app.get(variable)),
        onValueChange = { app.set(variable, if (keyboard == "number") it.toDoubleOrNull() ?: 0.0 else it) },
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text(placeholder) },
        singleLine = true,
        leadingIcon = if (keyboard == "search") ({ Icon(Icons.Filled.Search, contentDescription = null) }) else null,
        visualTransformation = if (keyboard == "password") PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = when (keyboard) { "number" -> KeyboardType.Decimal; "email" -> KeyboardType.Email; "password" -> KeyboardType.Password; else -> KeyboardType.Text }),
        shape = RoundedCornerShape(12.dp),
        colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
    )
}

/** A switch for a yes/no variable (darkMode switches the app's look). */
@Composable
fun VarSwitch(variable: String, label: String = "") {
    val on = app.get(variable)?.let { isOn(it) } ?: (variable == "darkMode" && isSystemInDarkTheme())
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (label.isNotEmpty()) Text(app.fill(label), Modifier.weight(1f), color = LocalPalette.current.text) else Spacer(Modifier.weight(1f))
        Switch(checked = on, onCheckedChange = { app.set(variable, it) })
    }
}

/** The records of a collection, the way the app draws them: a round tick, the title (struck through when done), the line under it; tap to open, swipe left to delete. */
@Composable
fun RecordList(collection: String, modifier: Modifier = Modifier, title: String = "{title}", subtitle: String = "", right: String = "", icon: String = "", check: String = "", search: String = "", filter: String = "", sort: String = "newest first", openPage: String = "", empty: String = "Nothing here yet", swipeDelete: Boolean = true, rowH: Int = 64, gap: Int = 8, radius: Int = 14, doneLook: Boolean = true) {
    val p = LocalPalette.current
    val rows = app.query(collection, filter, if (search.isEmpty()) "" else show(app.get(search)), sort)
    if (rows.isEmpty()) {
        Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(empty, color = p.sub, textAlign = TextAlign.Center) }
        return
    }
    val shape = RoundedCornerShape(radius.dp)
    LazyColumn(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(gap.dp), contentPadding = PaddingValues(bottom = 96.dp)) {
        items(rows, key = { show(it["_id"]) }) { r ->
            val id = show(r["_id"])
            val done = check.isNotEmpty() && isOn(r[check])
            val row: @Composable () -> Unit = {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = rowH.dp).background(p.card, shape).clip(shape).clickable(enabled = openPage.isNotEmpty()) { app.open(collection, id); app.go(openPage) }.padding(horizontal = 14.dp, vertical = 10.dp).alpha(if (done && doneLook) 0.55f else 1f),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (check.isNotEmpty()) Box(
                        Modifier.padding(end = 14.dp).size(28.dp).clip(CircleShape).background(if (done) p.accent else Color.Transparent).border(2.dp, if (done) p.accent else p.sub, CircleShape).clickable { app.updateRecord(collection, id, mapOf(check to !done)) },
                        contentAlignment = Alignment.Center,
                    ) { if (done) Icon(Icons.Filled.Check, contentDescription = "Done", tint = Color.White, modifier = Modifier.size(18.dp)) }
                    else if (icon.isNotEmpty()) Text(app.fill(icon, r, collection), fontSize = 26.sp, modifier = Modifier.padding(end = 14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(app.fill(title, r, collection), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = p.text, textDecoration = if (done) TextDecoration.LineThrough else null, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (subtitle.isNotEmpty()) Text(app.fill(subtitle, r, collection), color = p.sub, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                    }
                    if (right.isNotEmpty()) Text(app.fill(right, r, collection), color = p.sub, fontWeight = FontWeight.Bold)
                }
            }
            if (!swipeDelete) row()
            else {
                val state = rememberSwipeToDismissBoxState(confirmValueChange = { if (it == SwipeToDismissBoxValue.EndToStart) { app.deleteRecord(collection, id); true } else false })
                SwipeToDismissBox(state, enableDismissFromStartToEnd = false, backgroundContent = {
                    Box(Modifier.fillMaxSize().background(p.danger, shape).padding(end = 24.dp), contentAlignment = Alignment.CenterEnd) { Text("Delete", color = Color.White, fontWeight = FontWeight.ExtraBold) }
                }) { row() }
            }
        }
    }
}

enum class FormMode { Auto, NewRecord, EditOpened }

/** A form for a record: adds a new one, or changes the opened one. */
@Composable
fun RecordForm(collection: String, modifier: Modifier = Modifier, fields: List<String> = emptyList(), mode: FormMode = FormMode.Auto, saveLabel: String = "Save", after: String = "go back", page: String = "") {
    val p = LocalPalette.current
    val all = app.def(collection)?.fields ?: emptyList()
    val shown = if (fields.isEmpty()) all else fields.mapNotNull { k -> all.firstOrNull { it.key == k } }
    val editing = remember { mode == FormMode.EditOpened || (mode == FormMode.Auto && app.opened != null && app.openCollection == collection) }
    val values = remember {
        val o = if (editing) app.opened else null
        mutableStateMapOf<String, Any?>().apply {
            for (f in shown) put(f.key, o?.get(f.key) ?: if (f.def == "today") dayOf(nowMs().toLong()) else f.def ?: if (f.type == "yes/no") false else null)
        }
    }
    var picking by remember { mutableStateOf<String?>(null) }
    fun save() {
        val out = shown.associate { f -> f.key to (values[f.key].let { v -> if (f.type in listOf("number", "money")) num(v) ?: 0.0 else v }) }
        val id = app.openId
        if (editing && id != null) app.updateRecord(collection, id, out) else app.addRecord(collection, out)
        when (after) { "clear the form" -> shown.forEach { values[it.key] = null }; "go to page" -> app.go(page); "stay" -> {}; else -> app.back() }
    }
    Column(modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (f in shown) {
            Text(f.name, color = p.sub, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, top = 6.dp))
            when (f.type) {
                "yes/no" -> Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(f.name, Modifier.weight(1f), color = p.text); Switch(checked = isOn(values[f.key]), onCheckedChange = { values[f.key] = it })
                }
                "choice" -> Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (o in f.options) FilterChip(selected = values[f.key] == o, onClick = { values[f.key] = o }, label = { Text(o) })
                }
                "date" -> Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(12.dp)).clickable { picking = f.key }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.DateRange, contentDescription = null, tint = p.sub); Spacer(Modifier.width(12.dp))
                    Text(show(values[f.key]).ifEmpty { "Pick a date" }, color = p.text)
                }
                else -> TextField(
                    value = show(values[f.key]), onValueChange = { values[f.key] = it }, modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text(f.name) }, singleLine = f.type != "long text", minLines = if (f.type == "long text") 4 else 1,
                    prefix = if (f.type == "money") ({ Text("$") }) else null,
                    keyboardOptions = KeyboardOptions(keyboardType = if (f.type in listOf("number", "money")) KeyboardType.Decimal else KeyboardType.Text),
                    shape = RoundedCornerShape(12.dp), colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        PButton(saveLabel) { save() }
        Spacer(Modifier.height(32.dp))
    }
    picking?.let { key ->
        val state = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { picking = null },
            confirmButton = { TextButton(onClick = { state.selectedDateMillis?.let { values[key] = dayOf(it) }; picking = null }) { Text("OK") } },
            dismissButton = { TextButton(onClick = { picking = null }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
}

/** A plain list of lines. */
@Composable
fun StaticList(items: List<String>) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { for (t in items) Text(app.fill(t), color = p.text) }
}

/** A Pocket component with no native version yet: shows where it goes. */
@Composable
fun TodoBox(name: String, type: String) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().border(2.dp, p.line, RoundedCornerShape(16.dp)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Filled.Build, contentDescription = null, tint = p.sub)
        Text(name, fontWeight = FontWeight.ExtraBold, color = p.text)
        Text("$type: to build natively", color = p.sub)
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Social building blocks: a feed, a composer, stories, messages, profiles, a marketplace, notifications…
// They read and change the same data collections as the app (Posts, Messages, Stories, Listings, Profiles…).
// ---------------------------------------------------------------------------------------------------------------

/** You: {playerName} and {playerHandle}; no name yet → “You”, @you (the same as the editor). */
val meName: String get() = show(app.get("playerName")).ifEmpty { "You" }
/** The name on the App Bar's avatar: “Me” until there is a playerName variable, then the name (blank shows “?”). */
val barName: String get() = if (app.vars.containsKey("playerName")) show(app.get("playerName")) else "Me"
val me: String get() = show(app.get("playerHandle")).ifEmpty { meName.lowercase().replace(Regex("\\s+"), "") }
fun Row.s(k: String): String = show(this[k])
// the engine's avatar colours and initials (Maya Chen → MC)
private val avatarColors = listOf(0xFFEF5350, 0xFFEC407A, 0xFFAB47BC, 0xFF7E57C2, 0xFF5C6BC0, 0xFF42A5F5, 0xFF26A69A, 0xFF66BB6A, 0xFFFFA726, 0xFF8D6E63)
fun avatarColor(s: String): Color {
    var n = 0L
    for (c in s.ifEmpty { "?" }) n = (n * 31 + c.code) and 0xFFFFFFFFL
    return Color(avatarColors[(n % avatarColors.size).toInt()])
}
fun initials(s: String): String = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.take(1).uppercase() }.ifEmpty { "?" }
fun mediaList(m: Any?): List<String> = show(m).split("|").map { it.trim() }.filter { it.isNotEmpty() }
fun firstMedia(m: Any?): String = mediaList(m).firstOrNull() ?: ""
fun isUrl(s: String): Boolean = s.startsWith("http:") || s.startsWith("https:")
fun hexColor(v: String): Color? = if (Regex("^#[0-9a-fA-F]{6}$").matches(v)) Color(0xFF000000 or v.drop(1).toLong(16)) else null
fun colorOf(r: Row, seed: String): Color = hexColor(r.s("color")) ?: avatarColor(seed)
/** 1284 → 1.3K, 48200 → 48K. */
fun compactNum(v: Any?): String {
    val n = num(v) ?: 0.0
    fun one(x: Double) = (kotlin.math.round(x * 10) / 10).let { if (it == kotlin.math.floor(it)) it.toLong().toString() else it.toString() }
    return when { n < 1000 -> kotlin.math.round(n).toLong().toString(); n < 10_000 -> one(n / 1000) + "K"; n < 1e6 -> kotlin.math.round(n / 1000).toLong().toString() + "K"; else -> one(n / 1e6) + "M" }
}
/** 9m, 2h, 3d, then the date. */
fun ago(at: Any?): String {
    val t = num(at) ?: 0.0
    if (t < 1e11) return ""
    val s = (nowMs() - t) / 1000
    return when {
        s < 60 -> "now"; s < 3600 -> "${(s / 60).toInt()}m"; s < 86400 -> "${(s / 3600).toInt()}h"; s < 604800 -> "${(s / 86400).toInt()}d"
        else -> dayOf(t.toLong()).split("-").let { p -> listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec").getOrElse((p[1].toIntOrNull() ?: 1) - 1) { "" } + " " + (p[2].toIntOrNull() ?: 1) }
    }
}
/** The colours of a CSS gradient ("linear-gradient(135deg,#f58529,#dd2a7b)"). */
fun gradientColors(bg: Any?): List<Color> = Regex("#[0-9a-fA-F]{6}").findAll(show(bg)).mapNotNull { hexColor(it.value) }.toList()

/** Line icons drawn from SVG paths (the same shapes as the editor's preview), so no icon library is needed. */
object PocketIcons {
    private val paths = mapOf(
        "comment" to "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z", "repost" to "M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4",
        "heart" to "M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z", "views" to "M5 20V10M10 20V4M15 20v-7M20 20v-4", "bookmark" to "M6 3h12v18l-6-4-6 4z",
        "share" to "M12 3v13M7 8l5-5 5 5M5 14v6h14v-6", "more" to "M5 12h.01M12 12h.01M19 12h.01", "moon" to "M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z",
        "sun" to "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
        "users" to "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21a8 8 0 0 1 16 0M17 3.5a4 4 0 0 1 0 7.5M23 21a7 7 0 0 0-4-6.3", "bell" to "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 4h4",
        "info" to "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01", "search" to "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17l-5-5", "settings" to "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
        "user" to "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0", "chat" to "M4 5h16v11H8l-4 4z", "home" to "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
        "plus" to "M12 5v14M5 12h14", "circle" to "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
    )
    private val alias = mapOf("friends" to "users", "profile" to "user", "explore" to "search", "gear" to "settings", "add" to "plus")
    private val cache = mutableMapOf<String, ImageVector>()
    /** The editor's own line icons (64 × 64 SVG path data: stroked, then filled), for the App Bar and Bottom Nav. Set by App.kt. */
    val art = mutableMapOf<String, List<String>>()
    /** An App Bar / Bottom Nav icon: the editor's line icon when there is one. */
    fun nav(name: String): ImageVector = art[name]?.let { a -> cache.getOrPut("art:$name") {
        val v = ImageVector.Builder(name, 24.dp, 24.dp, 64f, 64f).addPath(pathData = addPathNodes(a[0]), fill = null, stroke = SolidColor(Color.Black), strokeLineWidth = 5f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)
        if (a.size > 1 && a[1].isNotEmpty()) v.addPath(pathData = addPathNodes(a[1]), fill = SolidColor(Color.Black))
        v.build()
    } } ?: get(name)
    /** filled: heart and bookmark when they're on. */
    fun get(name: String, filled: Boolean = false): ImageVector = cache.getOrPut("$name$filled") {
        val d = paths[alias[name] ?: name] ?: paths.getValue("circle")
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).addPath(
            pathData = addPathNodes(d), fill = if (filled) SolidColor(Color.Black) else null, stroke = SolidColor(Color.Black),
            strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
        ).build()
    }
}

/** Opens a person's profile page (it shows {profile} and {profile_name}). */
fun openProfile(page: String, handle: String, name: String) {
    if (page.isEmpty()) return
    app.vars["profile"] = handle
    app.vars["profile_name"] = name
    app.go(page)
}

@Composable
fun Avatar(name: String, seed: String, size: Int = 40, label: String? = null) {
    Box(Modifier.size(size.dp).background(avatarColor(name.ifEmpty { seed }), CircleShape), contentAlignment = Alignment.Center) {
        Text(label ?: initials(name.ifEmpty { seed }), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = (size * (if (label == null) 0.38 else 0.5)).sp)
    }
}

/** A picture: an emoji on a colour (a photo link shows 🖼️: add an image library such as Coil to load it). */
@Composable
fun Tile(media: String, color: Color, height: Dp, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(height).background(color), contentAlignment = Alignment.Center) {
        Text(if (isUrl(media)) "🖼️" else media, fontSize = (minOf(height.value, 150f) * 0.42f).sp)
    }
}

/** A post's first picture (rounded). */
@Composable
fun Media(r: Row, height: Int = 200, radius: Int = 12) {
    val m = firstMedia(r["media"])
    if (m.isEmpty()) return
    Tile(m, colorOf(r, r.s("handle") + m), height.dp, Modifier.clip(RoundedCornerShape(radius.dp)))
}

/** 1 to 4 pictures, laid out like the app's feed: one big, two side by side, one big and two stacked, two by two. */
@Composable
fun MediaGrid(r: Row, height: Int = 220) {
    val p = LocalPalette.current
    val l = mediaList(r["media"]).take(4)
    if (l.isEmpty()) return
    val bg = colorOf(r, r.s("handle") + l[0])
    val h = height.dp
    val half = (height / 2 - 1).dp
    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.fillMaxWidth().clip(shape).border(1.dp, p.line, shape)) {
        when (l.size) {
            1 -> Tile(l[0], bg, h)
            else -> Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                @Composable fun RowScope.col(a: String, b: String) = Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) { Tile(a, bg, half); Tile(b, bg, half) }
                when (l.size) {
                    2 -> { Tile(l[0], bg, h, Modifier.weight(1f)); Tile(l[1], bg, h, Modifier.weight(1f)) }
                    3 -> { Tile(l[0], bg, h, Modifier.weight(1f)); col(l[1], l[2]) }
                    else -> { col(l[0], l[2]); col(l[1], l[3]) }
                }
            }
        }
    }
}

@Composable
private fun Empty(text: String) {
    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(text, color = LocalPalette.current.sub, textAlign = TextAlign.Center) }
}

/** A tab on top of a feed: its name and which posts it shows (following, saved, media, replies, posts, likes, or a filter). */
data class FeedTab(val label: String, val only: String = "", val look: String = "")

/** Posts, newest first, the way the app draws them (X style): avatar, name ✓ @handle · 9m, text with #tags, pictures, and
 *  comment / repost / like / views / save / share. Tap the author for their profile. look: timeline, reels or grid. */
@Composable
fun SocialFeed(collection: String = "Posts", look: String = "timeline", filter: String = "", search: String = "", columns: Int = 3, profilePage: String = "", empty: String = "No posts yet", tabs: List<FeedTab> = emptyList(), actions: List<String> = listOf("comment", "repost", "like", "share")) {
    val p = LocalPalette.current
    var tab by remember { mutableStateOf(0) }
    val t = tabs.getOrNull(tab.coerceIn(0, maxOf(0, tabs.size - 1)))
    val test: ((Row) -> Boolean)? = when (t?.only?.trim()?.lowercase() ?: "") {
        "" -> { _ -> true }
        "following" -> { val f = app.rows("Follows").filter { it.s("follower") == me }.map { it.s("followee") }.toSet(); { r -> r.s("handle") in f || isOn(r["following"]) } }
        "saved" -> { r -> isOn(r["saved"]) }
        "media" -> { r -> firstMedia(r["media"]).isNotEmpty() }
        "replies" -> { r -> r.s("reply_to").isNotEmpty() }
        "posts" -> { r -> r.s("reply_to").isEmpty() }
        "likes" -> { r -> isOn(r["liked"]) }
        else -> null // a filter: for the query
    }
    val rows = app.query(collection, listOf(filter, if (t != null && test == null) t.only else "").filter { it.isNotEmpty() }.joinToString(" and "), if (search.isEmpty()) "" else show(app.get(search))).filter(test ?: { true })
    val shown = t?.look?.ifEmpty { null } ?: look
    fun toggle(r: Row, flag: String, count: String? = null) {
        val now = !isOn(r[flag])
        val change = mutableMapOf<String, Any?>(flag to now)
        if (count != null) change[count] = maxOf(0.0, (num(r[count]) ?: 0.0) + if (now) 1.0 else -1.0)
        app.updateRecord(collection, r.s("_id"), change)
    }
    Column(Modifier.bleed()) {
        if (tabs.size > 1) {
            Row(Modifier.fillMaxWidth()) {
                tabs.forEachIndexed { i, tb ->
                    Column(Modifier.weight(1f).clickable { tab = i }.padding(top = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(tb.label, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = if (i == tab) p.text else p.sub)
                        Spacer(Modifier.height(10.dp))
                        Box(Modifier.width(48.dp).height(4.dp).background(if (i == tab) p.accent else Color.Transparent, RoundedCornerShape(2.dp)))
                    }
                }
            }
            HorizontalDivider(color = p.line)
        }
        if (rows.isEmpty()) { Empty(empty); return@Column }
        when (shown) {
            "grid" -> Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (line in rows.chunked(columns)) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    for (r in line) Box(Modifier.weight(1f).clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }) {
                        if (firstMedia(r["media"]).isEmpty()) Text(r.s("text"), maxLines = 4, fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth().height(120.dp).background(avatarColor(r.s("author"))).padding(6.dp)) else Media(r, 120, 6)
                    }
                    repeat(columns - line.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            else -> for (r in rows) {
                @Composable
                fun RowScope.action(name: String, count: String, lit: Boolean, color: Color, grow: Boolean = true, onClick: (() -> Unit)?) {
                    Row(Modifier.then(if (grow) Modifier.weight(1f) else Modifier).clickable(enabled = onClick != null) { onClick?.invoke() }.padding(vertical = 8.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(PocketIcons.get(name, filled = lit && name in listOf("heart", "bookmark")), contentDescription = name, tint = if (lit) color else p.sub, modifier = Modifier.size(19.dp))
                        if (count.isNotEmpty()) Text(count, fontSize = 13.5.sp, color = if (lit) color else p.sub, maxLines = 1, modifier = Modifier.padding(start = 4.dp))
                    }
                }
                val acts: @Composable () -> Unit = {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        for (a in actions) when (a) {
                            "comment" -> action("comment", compactNum(r["comments"]), false, p.accent, onClick = null)
                            "repost" -> action("repost", compactNum(r["reposts"]), isOn(r["reposted"]), Color(0xFF00BA7C)) { toggle(r, "reposted", "reposts") }
                            "like" -> action("heart", compactNum(r["likes"]), isOn(r["liked"]), Color(0xFFF91880)) { toggle(r, "liked", "likes") }
                            "views" -> action("views", compactNum(r["views"]), false, p.accent, onClick = null)
                            "save" -> action("bookmark", "", isOn(r["saved"]), p.accent, grow = false) { toggle(r, "saved") }
                            "share" -> action("share", "", false, p.accent, grow = false, onClick = null)
                        }
                    }
                }
                if (shown == "reels") {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 5.dp).fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }, verticalAlignment = Alignment.CenterVertically) {
                            Avatar(r.s("author"), r.s("handle")); Spacer(Modifier.width(10.dp))
                            Column { Text(r.s("author"), fontWeight = FontWeight.ExtraBold, color = p.text); Text("@${r.s("handle")}", color = p.sub) }
                        }
                        if (firstMedia(r["media"]).isNotEmpty()) Media(r, 380) else Text(r.s("text"), color = p.text, fontSize = 16.sp)
                        acts()
                    }
                    continue
                }
                val grad = if (firstMedia(r["media"]).isEmpty()) gradientColors(r["background"]) else emptyList()
                val sub = listOf("@${r.s("handle")}", ago(r["_at"]), if (r.s("location").isEmpty()) "" else "📍 ${r.s("location")}").filter { it.isNotEmpty() }.joinToString(" · ")
                Column(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth().padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 2.dp)) {
                        Box(Modifier.clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }) { Avatar(r.s("author"), r.s("handle"), 46) }
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(Modifier.clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }, verticalAlignment = Alignment.CenterVertically) {
                                Text(r.s("author"), fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = p.text, maxLines = 1)
                                if (isOn(r["verified"])) Box(Modifier.padding(start = 3.dp).size(17.dp).background(p.accent, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Filled.Check, contentDescription = "Verified", tint = Color.White, modifier = Modifier.size(12.dp)) }
                                Text(" $sub", color = p.sub, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                Icon(PocketIcons.get("more"), contentDescription = "More", tint = p.sub, modifier = Modifier.size(20.dp))
                            }
                            if (grad.isNotEmpty()) Box(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(16.dp)).background(androidx.compose.ui.graphics.Brush.linearGradient(if (grad.size > 1) grad else listOf(grad[0], grad[0]))).padding(18.dp), contentAlignment = Alignment.Center) {
                                Text(r.s("text"), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
                            }
                            else if (r.s("text").isNotEmpty()) Text(buildAnnotatedString {
                                var at = 0
                                for (m in Regex("[#@]\\w+").findAll(r.s("text"))) {
                                    append(r.s("text").substring(at, m.range.first))
                                    withStyle(SpanStyle(color = p.accent)) { append(m.value) }
                                    at = m.range.last + 1
                                }
                                append(r.s("text").substring(at))
                            }, color = p.text, fontSize = 16.sp)
                            if (r.s("poll").isNotEmpty()) for (o in r.s("poll").split("|")) Box(Modifier.fillMaxWidth().border(1.dp, p.accent, RoundedCornerShape(999.dp)).padding(vertical = 7.dp), contentAlignment = Alignment.Center) { Text(o.trim(), color = p.accent, fontWeight = FontWeight.Bold) }
                            if (r.s("link").isNotEmpty()) Column(Modifier.fillMaxWidth().border(1.dp, p.line, RoundedCornerShape(14.dp)).padding(10.dp)) {
                                Text(r.s("link_title").ifEmpty { r.s("link") }, fontWeight = FontWeight.Bold, color = p.text)
                                Text(r.s("link").removePrefix("https://").removePrefix("http://").substringBefore("/"), color = p.sub)
                            }
                            if (firstMedia(r["media"]).isNotEmpty()) Box(Modifier.padding(top = 4.dp)) { MediaGrid(r) }
                            acts()
                        }
                    }
                    HorizontalDivider(color = p.line)
                }
            }
        }
    }
}

@Composable
private fun SendBox(placeholder: String, button: String, card: Boolean = true, avatar: Boolean = false, onSend: (String) -> Unit) {
    val p = LocalPalette.current
    var text by remember { mutableStateOf("") }
    Row(Modifier.fillMaxWidth().then(if (card) Modifier.background(p.card, RoundedCornerShape(16.dp)).padding(8.dp) else Modifier), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (avatar) Avatar(meName, me)
        TextField(text, { text = it }, Modifier.weight(1f), placeholder = { Text(placeholder) }, singleLine = true, shape = RoundedCornerShape(if (card) 12.dp else 999.dp), colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent))
        Button({ if (text.isNotBlank()) { onSend(text.trim()); text = "" } }, colors = ButtonDefaults.buttonColors(containerColor = p.accent, contentColor = p.onAccent)) { Text(button, fontWeight = FontWeight.ExtraBold) }
    }
}

/** A box to write a post: Post adds it to the top of the feed. */
@Composable
fun Composer(collection: String = "Posts", placeholder: String = "What’s happening?") =
    SendBox(placeholder, "Post", card = false, avatar = true) { app.addRecord(collection, mapOf("author" to meName, "handle" to me, "text" to it)) }

/** Story circles, one per person (newest first), "Your story" first; tap one to see it. */
@Composable
fun Stories(collection: String = "Stories", yours: Boolean = true) {
    val p = LocalPalette.current
    var open by remember { mutableStateOf<Row?>(null) }
    val rows = app.query(collection).filter { it.s("handle") != me }.distinctBy { it.s("handle").ifEmpty { it.s("author") } }
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        if (yours) Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.padding(3.dp)) {
                Avatar(meName, me, 62)
                Box(Modifier.align(Alignment.BottomEnd).size(22.dp).background(p.bg, CircleShape).padding(2.dp).background(p.accent, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Filled.Add, contentDescription = "Add a story", tint = Color.White, modifier = Modifier.size(14.dp)) }
            }
            Text("Your story", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = p.text, modifier = Modifier.padding(top = 4.dp))
        }
        for (r in rows) Column(Modifier.clickable { open = r }, horizontalAlignment = Alignment.CenterHorizontally) {
            val m = firstMedia(r["media"])
            Box(Modifier.size(68.dp).background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6))), CircleShape).padding(3.dp).background(p.bg, CircleShape).padding(2.dp), contentAlignment = Alignment.Center) {
                if (m.isEmpty() || isUrl(m)) Avatar(r.s("author"), r.s("handle"), 58)
                else Box(Modifier.size(58.dp).background(colorOf(r, r.s("author")), CircleShape), contentAlignment = Alignment.Center) { Text(m, fontSize = 27.sp) }
            }
            Text(r.s("author").substringBefore(" "), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = p.text, modifier = Modifier.padding(top = 4.dp))
        }
    }
    open?.let { r ->
        AlertDialog(
            onDismissRequest = { open = null }, containerColor = colorOf(r, r.s("author")),
            confirmButton = { TextButton({ open = null }) { Text("Close", color = Color.White) } },
            title = { Text(r.s("author"), color = Color.White, fontWeight = FontWeight.ExtraBold) },
            text = { Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { Text(firstMedia(r["media"]), fontSize = 96.sp); Text(r.s("text"), color = Color.White, textAlign = TextAlign.Center) } },
        )
    }
}

/** The name to show for a chat: the other person in it. */
fun chatName(collection: String, id: String): String =
    app.rows(collection).firstOrNull { it.s("chat") == id && it.s("handle") != me }?.s("author")
        ?: id.removePrefix("dm-").split("-").filter { it != me }.joinToString(", ").ifEmpty { id }

/** Conversations, latest first: tap one to open it on the chat page. */
@Composable
fun Inbox(collection: String = "Messages", openPage: String = "chat") {
    val p = LocalPalette.current
    val latest = app.query(collection).filter { it.s("chat").isNotEmpty() }.distinctBy { it.s("chat") }
    if (latest.isEmpty()) { Empty("No messages yet"); return }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (r in latest) {
            val name = chatName(collection, r.s("chat"))
            Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).clickable { app.vars["chat"] = r.s("chat"); app.vars["chatTitle"] = name; app.go(openPage) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(name, name, 46)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.Bold, color = p.text)
                    Text((if (r.s("handle") == me) "You: " else "") + r.s("text"), color = p.sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

/** The messages of the open chat ({chat}), and a box to send one. */
@Composable
fun Chat(collection: String = "Messages") {
    val p = LocalPalette.current
    val id = show(app.get("chat"))
    val rows = app.query(collection, sort = "oldest first").filter { it.s("chat") == id }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (rows.isEmpty()) Empty("Say hello 👋")
        for (r in rows) {
            val mine = r.s("handle") == me
            Box(Modifier.fillMaxWidth(), contentAlignment = if (mine) Alignment.CenterEnd else Alignment.CenterStart) {
                Text(r.s("text"), color = if (mine) p.onAccent else p.text, fontSize = 16.sp, modifier = Modifier.widthIn(max = 280.dp).background(if (mine) p.accent else p.card, RoundedCornerShape(18.dp)).padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        Spacer(Modifier.height(4.dp))
        SendBox("Message", "Send") { if (id.isNotEmpty()) app.addRecord(collection, mapOf("chat" to id, "author" to meName, "handle" to me, "text" to it)) }
    }
}

/** A profile header: cover, picture, name, @handle, bio and counts. */
@Composable
fun ProfileHeader(name: String = "{playerName}", handle: String = "{playerHandle}", bio: String = "", stats: List<Pair<String, String>> = emptyList(), cover: String = "@accent") {
    val p = LocalPalette.current
    val n = app.fill(name)
    val h = app.fill(handle)
    val own = mapOf("points" to (num(app.get("points")) ?: 0.0))
    Column(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(bottom = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(80.dp).background(p.resolve(cover) ?: p.accent, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))
        Box(Modifier.offset(y = (-38).dp).border(3.dp, p.card, CircleShape)) { Avatar(n, h, 76) }
        Column(Modifier.offset(y = (-30).dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(n, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = p.text)
            Text("@$h", color = p.sub)
            if (bio.isNotEmpty()) Text(app.fill(bio), color = p.text, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp, start = 12.dp, end = 12.dp))
            if (stats.isNotEmpty()) Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                for ((label, value) in stats) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(app.fill(value, own), fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = p.text)
                    Text(label, color = p.sub, fontSize = 12.sp)
                }
            }
        }
    }
}

fun price(r: Row): String = if (r.s("price").toDoubleOrNull() != null) "$" + r.s("price") else r.s("price")

/** Things for sale in a grid: tap one for its details and to message the seller. */
@Composable
fun Marketplace(collection: String = "Listings", chatPage: String = "") {
    val p = LocalPalette.current
    var open by remember { mutableStateOf<Row?>(null) }
    val rows = app.query(collection)
    if (rows.isEmpty()) { Empty("Nothing for sale yet"); return }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (line in rows.chunked(2)) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (r in line) Column(Modifier.weight(1f).background(p.card, RoundedCornerShape(14.dp)).clickable { open = r }.padding(6.dp)) {
                Media(r, 120)
                Text(price(r) + if (isOn(r["sold"])) " · Sold" else "", fontWeight = FontWeight.ExtraBold, color = p.text)
                Text(r.s("title"), maxLines = 1, overflow = TextOverflow.Ellipsis, color = p.text)
                Text(r.s("location"), maxLines = 1, overflow = TextOverflow.Ellipsis, color = p.sub, fontSize = 12.sp)
            }
            if (line.size == 1) Spacer(Modifier.weight(1f))
        }
    }
    open?.let { r ->
        AlertDialog(
            onDismissRequest = { open = null },
            title = { Text(r.s("title"), fontWeight = FontWeight.ExtraBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Media(r, 140)
                    Text(price(r), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                    Text(listOf(r.s("condition"), r.s("location"), if (r.s("seller").isEmpty()) "" else "Seller: ${r.s("seller")}").filter { it.isNotEmpty() }.joinToString(" · "), color = p.sub)
                    if (r.s("description").isNotEmpty()) Text(r.s("description"))
                }
            },
            confirmButton = {
                if (chatPage.isNotEmpty() && r.s("handle") != me) TextButton({
                    open = null
                    app.vars["chat"] = "dm-" + listOf(me, r.s("handle")).sorted().joinToString("-")
                    app.vars["chatTitle"] = r.s("seller").ifEmpty { r.s("handle") }
                    app.go(chatPage)
                }) { Text("Message seller") }
            },
            dismissButton = { TextButton({ open = null }) { Text("Close") } },
        )
    }
}

/** Likes, comments, follows and reposts for me, newest first. */
@Composable
fun Activity(collection: String = "Notifications", profilePage: String = "") {
    val p = LocalPalette.current
    val icons = mapOf("like" to "❤️", "comment" to "💬", "follow" to "👤", "repost" to "🔁", "mention" to "@")
    val rows = app.query(collection).filter { it.s("to").isEmpty() || it.s("to") == me }
    if (rows.isEmpty()) { Empty("No notifications yet"); return }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (r in rows) Row(
            Modifier.fillMaxWidth().background(if (isOn(r["read"])) p.card else p.accent.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
                .clickable { app.updateRecord(collection, r.s("_id"), mapOf("read" to true)); openProfile(profilePage, r.s("from"), r.s("from_name")) }.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(icons[r.s("type")] ?: "🔔", fontSize = 24.sp)
            Spacer(Modifier.width(12.dp))
            Text(r.s("from_name").ifEmpty { r.s("from") } + " " + r.s("text"), color = p.text)
        }
    }
}

/** People (Profiles), A to Z: tap one for their profile. */
@Composable
fun People(collection: String = "Profiles", profilePage: String = "") {
    val p = LocalPalette.current
    val rows = app.query(collection, sort = "name (a-z)").filter { it.s("handle") != me }
    if (rows.isEmpty()) { Empty("No one here yet"); return }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (r in rows) Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).clickable { openProfile(profilePage, r.s("handle"), r.s("name")) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar(r.s("name"), r.s("handle"), 46)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(r.s("name") + if (isOn(r["verified"])) " ✓" else "", fontWeight = FontWeight.Bold, color = p.text)
                Text("@${r.s("handle")}" + if (r.s("bio").isEmpty()) "" else " · ${r.s("bio")}", color = p.sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Milestones worked out from my posts, the likes on them and my followers. */
@Composable
fun Achievements() {
    val p = LocalPalette.current
    val mine = app.rows("Posts").filter { it.s("handle") == me }
    val likes = mine.sumOf { num(it["likes"]) ?: 0.0 }
    val followers = num(app.get("followers")) ?: 0.0
    val list = listOf(Triple("✍️", "First post", mine.size.toDouble() to 1.0), Triple("📚", "10 posts", mine.size.toDouble() to 10.0), Triple("❤️", "First like", likes to 1.0), Triple("🔥", "100 likes", likes to 100.0), Triple("⭐", "1,000 followers", followers to 1000.0))
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((ic, label, progress) in list) {
            val (have, need) = progress
            Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (have >= need) ic else "🔒", fontSize = 24.sp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(label, fontWeight = FontWeight.Bold, color = if (have >= need) p.text else p.sub)
                    Text(if (have >= need) "Unlocked" else "${show(minOf(have, need))} / ${show(need)}", color = p.sub, fontSize = 14.sp)
                }
            }
        }
    }
}

/** The most used #hashtags; tap one to search for it. */
@Composable
fun Trending(collection: String = "Posts", searchVar: String = "") {
    val counts = app.rows(collection).flatMap { r -> Regex("#\\w+").findAll(r.s("text")).map { it.value }.toList() }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.take(8)
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((tag, n) in counts) AssistChip(onClick = { if (searchVar.isNotEmpty()) app.set(searchVar, tag) }, label = { Text("$tag · $n") })
    }
}

// ---------------------------------------------------------------------------------------------------------------
// More components: charts, carousels, swipe pages, timers, keypads, popups, notifications…
// ---------------------------------------------------------------------------------------------------------------

/** Hear the app's messages while this is on screen. */
@Composable
fun OnMessage(f: (String) -> Unit) {
    val latest by rememberUpdatedState(f)
    DisposableEffect(Unit) { val off = app.listen { latest(it) }; onDispose { off() } }
}

/** How pop-up notifications look and where they show. */
class NotifyStyle(val listen: String = "notify", val position: String = "top", val look: String = "card", val seconds: Double = 3.0, val max: Int = 3, val bg: String = "#1e2235", val text: String = "#ffffff", val accent: String = "#ffd23d")

class Toast(val title: String, val text: String, val icon: String)

/** The notifications on screen, stacked at the top (or bottom, or centre). */
@Composable
fun ToastLayer() {
    val n = app.notify ?: return
    val p = LocalPalette.current
    val bg = p.resolve(n.bg) ?: p.card; val fg = p.resolve(n.text) ?: p.text; val ac = p.resolve(n.accent) ?: p.accent
    val pill = n.look == "pill"; val banner = n.look == "banner"
    Box(Modifier.fillMaxSize().safeDrawingPadding().padding(horizontal = if (banner) 0.dp else 12.dp, vertical = 8.dp), contentAlignment = when (n.position) { "bottom" -> Alignment.BottomCenter; "center" -> Alignment.Center; "top right" -> Alignment.TopEnd; else -> Alignment.TopCenter }) {
        Column(Modifier.padding(bottom = if (n.position == "bottom") 88.dp else 0.dp), verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            for (t in app.toasts.toList()) key(t) {
                LaunchedEffect(t) { delay((n.seconds * 1000).toLong()); app.toasts.remove(t) }
                var shown by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { shown = true }
                val k by animateFloatAsState(if (shown) 1f else 0f, tween(260))
                val shape = RoundedCornerShape(if (banner) 0.dp else if (pill) 30.dp else 16.dp)
                Row(
                    Modifier.then(if (banner) Modifier.fillMaxWidth() else Modifier.widthIn(max = 420.dp)).alpha(k).offset(y = ((1 - k) * (if (n.position == "bottom") 24 else -24)).dp)
                        .shadow(10.dp, shape).clip(shape).background(bg).then(if (n.look == "achievement") Modifier.border(2.dp, ac, shape) else Modifier)
                        .clickable { app.toasts.remove(t) }.padding(horizontal = if (pill) 18.dp else 14.dp, vertical = if (pill) 10.dp else 12.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (t.icon.isNotEmpty()) Text(t.icon, fontSize = if (pill) 18.sp else 24.sp)
                    Column {
                        if (t.title.isNotEmpty()) Text(t.title, color = if (n.look == "achievement") ac else fg, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                        if (t.text.isNotEmpty() && !pill) Text(t.text, color = fg.copy(alpha = 0.8f), fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

private fun num1(v: Double): String = if (v == kotlin.math.floor(v)) v.toLong().toString() else (kotlin.math.round(v * 10) / 10).toString()
private val MORE = listOf(Color(0xFFFF6B8B), Color(0xFFFFC94D), Color(0xFF3CCF7A), Color(0xFF8E6BF2), Color(0xFF22B8C9), Color(0xFFFF9F43), Color(0xFFE0559B))

/** A bar, column, line, area, pie, donut or radar chart: from label | value lines ({variables} work), or a variable tracked over time. */
@Composable
fun PChart(data: List<Pair<String, String>>, chart: String = "columns", track: String = "", every: Double = 1.0, points: Int = 30, title: String = "", max: Double = 0.0, values: Boolean = true, labels: Boolean = true, grid: Boolean = true, color: String = "@accent", text: String = "", bg: String = "", height: Int = 200) {
    val p = LocalPalette.current
    val fg = p.resolve(text) ?: p.text; val col = p.resolve(color) ?: p.accent; val line = p.line
    val history = remember { mutableStateListOf<Double>() }
    if (track.isNotEmpty()) LaunchedEffect(track) {
        while (true) { history.add(num(app.get(track)) ?: 0.0); while (history.size > points) history.removeAt(0); delay((every * 1000).toLong().coerceIn(100, 3_600_000)) }
    }
    val items = if (track.isNotEmpty()) history.map { "" to it } else data.map { app.fill(it.first) to (app.fill(it.second).trim().toDoubleOrNull() ?: 0.0) }
    val kind = if (track.isNotEmpty() && chart !in listOf("line", "area", "columns", "bars")) "line" else chart
    val tm = rememberTextMeasurer()
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(p.resolve(bg) ?: Color.Transparent).padding(12.dp)) {
        if (title.isNotEmpty()) Text(app.fill(title), color = fg, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
        Canvas(Modifier.fillMaxWidth().height((height - if (title.isEmpty()) 24 else 52).dp)) { drawChart(tm, kind, items, max, col, fg, line, values, labels, grid) }
    }
}

private fun DrawScope.label(tm: TextMeasurer, s: String, at: Offset, color: Color, size: Float = 11f, bold: Boolean = false, align: Float = 0.5f) {
    if (s.isEmpty()) return
    val r = tm.measure(s, TextStyle(fontSize = size.sp, color = color, fontWeight = if (bold) FontWeight.ExtraBold else FontWeight.SemiBold), maxLines = 1)
    drawText(r, topLeft = Offset(at.x - r.size.width * align, at.y - r.size.height / 2f))
}

private fun DrawScope.drawChart(tm: TextMeasurer, kind: String, items: List<Pair<String, Double>>, max: Double, color: Color, text: Color, line: Color, values: Boolean, labels: Boolean, grid: Boolean) {
    if (items.isEmpty()) return
    val n = items.size; val w = size.width; val h0 = size.height
    val top = items.maxOf { it.second }; val hi = if (max > 0) max else if (top <= 0) 1.0 else top * 1.12
    val sub = text.copy(alpha = 0.75f)
    fun slice(i: Int) = if (i == 0) color else MORE[(i - 1) % MORE.size]
    if (kind == "pie" || kind == "donut") {
        val total = items.sumOf { maxOf(0.0, it.second) }; if (total <= 0) return
        val r = minOf(w, h0) / 2f - 4f; val c = Offset(w / 2f, h0 / 2f)
        var a = -90f
        items.forEachIndexed { i, (name, v) ->
            val sw = (maxOf(0.0, v) / total * 360).toFloat()
            if (kind == "donut") { val rr = r * 0.78f; drawArc(slice(i), a + 1f, maxOf(0f, sw - 2f), false, Offset(c.x - rr, c.y - rr), Size(rr * 2, rr * 2), style = Stroke(r * 0.42f)) }
            else drawArc(slice(i), a, sw, true, Offset(c.x - r, c.y - r), Size(r * 2, r * 2))
            if (labels && sw > 23f) { val m = (a + sw / 2) * kotlin.math.PI / 180; val k = if (kind == "donut") 0.78f else 0.62f; label(tm, name, Offset(c.x + kotlin.math.cos(m).toFloat() * r * k, c.y + kotlin.math.sin(m).toFloat() * r * k), Color.White, bold = true) }
            a += sw
        }
        if (kind == "donut" && values) label(tm, num1(total), c, text, 20f, true)
        return
    }
    if (kind == "radar") {
        val r = minOf(w, h0) / 2f - if (labels) 18f else 4f; val c = Offset(w / 2f, h0 / 2f)
        fun at(i: Int, k: Float): Offset { val a = -kotlin.math.PI / 2 + i * kotlin.math.PI * 2 / n; return Offset(c.x + kotlin.math.cos(a).toFloat() * r * k, c.y + kotlin.math.sin(a).toFloat() * r * k) }
        fun poly(pts: List<Offset>) = Path().apply { pts.forEachIndexed { i, o -> if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }; close() }
        for (k in listOf(0.33f, 0.66f, 1f)) if (grid || k == 1f) drawPath(poly((0 until n).map { at(it, k) }), line, style = Stroke(1f))
        for (i in 0 until n) { drawLine(line, c, at(i, 1f)); if (labels) label(tm, items[i].first, at(i, 1.18f), sub) }
        val shape = poly(items.mapIndexed { i, it -> at(i, (it.second / hi).coerceIn(0.0, 1.0).toFloat()) })
        drawPath(shape, color.copy(alpha = 0.3f)); drawPath(shape, color, style = Stroke(2.5f))
        return
    }
    if (kind == "bars") {
        val lw = if (labels && items.any { it.first.isNotEmpty() }) 52f else 0f; val vw = if (values) 34f else 0f; val row = h0 / n
        items.forEachIndexed { i, (name, v) ->
            val y = row * i + row * 0.2f; val bh = row * 0.6f; val bw = (w - lw - vw) * (v / hi).coerceIn(0.0, 1.0).toFloat()
            drawRoundRect(color, Offset(lw, y), Size(bw, bh), CornerRadius(bh / 3))
            if (lw > 0) label(tm, name, Offset(lw - 6f, y + bh / 2), sub, align = 1f)
            if (values) label(tm, num1(v), Offset(lw + bw + 6f, y + bh / 2), text, bold = true, align = 0f)
        }
        return
    }
    val lb = if (labels && items.any { it.first.isNotEmpty() }) 18f else 2f; val tp = if (values) 16f else 4f; val h = h0 - lb - tp; val slot = w / n
    if (grid) for (i in 0..3) { val y = tp + h * i / 3; drawLine(line, Offset(0f, y), Offset(w, y)) }
    fun yOf(v: Double) = tp + h * (1 - (v / hi).coerceIn(0.0, 1.0).toFloat())
    if (kind == "line" || kind == "area") {
        val pts = items.mapIndexed { i, it -> Offset(if (n == 1) w / 2 else i * w / (n - 1), yOf(it.second)) }
        val path = Path().apply { pts.forEachIndexed { i, o -> if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) } }
        if (kind == "area") drawPath(Path().apply { addPath(path); lineTo(pts.last().x, tp + h); lineTo(pts.first().x, tp + h); close() }, color.copy(alpha = 0.25f))
        drawPath(path, color, style = Stroke(3f))
        pts.forEachIndexed { i, o ->
            if (n <= 14) { drawCircle(color, 3.5f, o); if (values) label(tm, num1(items[i].second), Offset(o.x, o.y - 11f), text, bold = true) }
            if (lb > 2f) label(tm, items[i].first, Offset(o.x.coerceIn(14f, w - 14f), h0 - 8f), sub)
        }
        return
    }
    items.forEachIndexed { i, (name, v) -> // columns
        val x = slot * i + slot * 0.2f; val bw = slot * 0.6f; val y = yOf(v)
        drawRoundRect(color, Offset(x, y), Size(bw, tp + h - y), CornerRadius(6f))
        if (values) label(tm, num1(v), Offset(x + bw / 2, y - 8f), text, bold = true)
        if (lb > 2f) label(tm, name, Offset(x + bw / 2, h0 - 8f), sub)
    }
}

/** One card in a carousel: its name, icon (an emoji), the value it picks, the variable that unlocks it, a line about it. */
class CarouselItem(val name: String, val icon: String, val value: String, val lock: String = "", val desc: String = "")

/** Swipe through cards; the one in the middle is picked into a variable (locked cards wait for their variable). */
@Composable
fun Carousel(variable: String, items: List<CarouselItem>, cardWidth: Float = 0.55f, arrows: Boolean = true, dots: Boolean = true, loop: Boolean = false, message: String = "", card: String = "@card", text: String = "", accent: String = "@accent", height: Int = 220) {
    val n = items.size; if (n == 0) return
    val p = LocalPalette.current
    val fg = p.resolve(text) ?: p.text; val ac = p.resolve(accent) ?: p.accent
    val start = maxOf(0, items.indexOfFirst { it.value == show(app.get(variable)) })
    val state = rememberPagerState(initialPage = if (loop) n * 500 + start else start) { if (loop) n * 1000 else n }
    val scope = rememberCoroutineScope()
    fun locked(x: CarouselItem) = x.lock.isNotEmpty() && !isOn(app.get(x.lock))
    LaunchedEffect(state.currentPage) {
        val x = items[state.currentPage % n]
        if (!locked(x) && show(app.get(variable)) != x.value) { app.set(variable, x.value); if (message.isNotEmpty()) app.send(message) }
    }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(Modifier.fillMaxWidth().height((height - if (dots) 22 else 0).dp), contentAlignment = Alignment.Center) {
            val side = maxWidth * (1 - cardWidth) / 2
            HorizontalPager(state, contentPadding = PaddingValues(horizontal = side), modifier = Modifier.fillMaxSize()) { page ->
                val x = items[page % n]; val on = page == state.currentPage; val lock = locked(x)
                val k by animateFloatAsState(if (on) 1f else 0.86f)
                Column(
                    Modifier.fillMaxSize().scale(k).padding(horizontal = 6.dp).clip(RoundedCornerShape(20.dp)).background(p.resolve(card) ?: p.card).border(2.5.dp, if (on) ac else Color.Transparent, RoundedCornerShape(20.dp)).padding(14.dp).alpha(if (lock) 0.5f else 1f),
                    verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(if (lock) "🔒" else x.icon, fontSize = 46.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(x.name, color = fg, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (x.desc.isNotEmpty()) Text(app.fill(x.desc), color = fg.copy(alpha = 0.7f), fontSize = 13.sp, maxLines = 2, textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis)
                }
            }
            if (arrows) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                IconButton(onClick = { scope.launch { state.animateScrollToPage(state.currentPage - 1) } }) { Text("‹", color = fg, fontSize = 30.sp) }
                IconButton(onClick = { scope.launch { state.animateScrollToPage(state.currentPage + 1) } }) { Text("›", color = fg, fontSize = 30.sp) }
            }
        }
        if (dots) Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (i in 0 until n) { val on = state.currentPage % n == i; Box(Modifier.size(width = if (on) 18.dp else 7.dp, height = 7.dp).clip(CircleShape).background(if (on) ac else p.line)) }
        }
    }
}

/** Swipe left and right between pages (onboarding, a tour); the page number goes into a variable, and "slide next" / "slide prev" / "slide 2" move it. */
@Composable
fun Pager(variable: String, dots: Boolean = true, dotColor: String = "@accent", loop: Boolean = false, auto: Double = 0.0, message: String = "slide", height: Int = 320, pages: List<@Composable () -> Unit>) {
    val n = pages.size; if (n == 0) return
    val p = LocalPalette.current
    val dot = p.resolve(dotColor) ?: p.accent
    val state = rememberPagerState(initialPage = ((num(app.get(variable)) ?: 1.0).toInt() - 1).coerceIn(0, n - 1)) { n }
    val scope = rememberCoroutineScope()
    fun go(i: Int) { val j = if (loop) ((i % n) + n) % n else i.coerceIn(0, n - 1); scope.launch { state.animateScrollToPage(j) } }
    OnMessage { m ->
        when {
            m == "$message next" -> go(state.currentPage + 1)
            m == "$message prev" || m == "$message back" -> go(state.currentPage - 1)
            m.startsWith("$message ") && m.removePrefix("$message ").toIntOrNull() != null -> go(m.removePrefix("$message ").toInt() - 1)
        }
    }
    if (auto > 0) LaunchedEffect(auto) { while (true) { delay((auto * 1000).toLong()); go(state.currentPage + 1) } }
    LaunchedEffect(state.currentPage) { if ((num(app.get(variable)) ?: 0.0).toInt() != state.currentPage + 1) app.set(variable, (state.currentPage + 1).toDouble()) }
    val want = (num(app.get(variable)) ?: 1.0).toInt() - 1 // (the variable changed somewhere else: follow it)
    LaunchedEffect(want) { if (want in 0 until n && want != state.currentPage) state.animateScrollToPage(want) }
    Column(Modifier.fillMaxWidth().height(height.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        HorizontalPager(state, Modifier.fillMaxWidth().weight(1f)) { page -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { pages[page]() } }
        if (dots) Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (i in 0 until n) { val on = state.currentPage == i; Box(Modifier.size(width = if (on) 18.dp else 7.dp, height = 7.dp).clip(CircleShape).background(if (on) dot else dot.copy(alpha = 0.3f))) }
        }
    }
}

/** A grid of square pictures from a collection's media field (or emojis); tap one to open it. */
@Composable
fun PhotoGrid(collection: String = "Posts", field: String = "media", filter: String = "", columns: Int = 3, gap: Int = 2, radius: Int = 0, openPage: String = "", message: String = "") {
    val p = LocalPalette.current
    val rows = app.query(collection, filter = filter).filter { mediaList(it[field]).isNotEmpty() }
    if (rows.isEmpty()) { Text("No pictures yet", color = p.sub, modifier = Modifier.fillMaxWidth().padding(24.dp), textAlign = TextAlign.Center); return }
    val cols = maxOf(1, columns)
    Column(verticalArrangement = Arrangement.spacedBy(gap.dp)) {
        for (chunk in rows.chunked(cols)) Row(horizontalArrangement = Arrangement.spacedBy(gap.dp)) {
            for (r in chunk) BoxWithConstraints(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(radius.dp)).clickable {
                app.open(collection, r.s("_id")); if (openPage.isNotEmpty()) app.go(openPage); if (message.isNotEmpty()) app.send(message)
            }) { Tile(mediaList(r[field]).first(), colorOf(r, r.s("_id")), maxWidth) }
            repeat(cols - chunk.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** A heart (or thumbs-up, or star) that turns a variable on or off, with a count next to it. */
@Composable
fun LikeButton(variable: String, countVar: String = "likes", icon: String = "heart", message: String = "", on: String = "#f91880", off: String = "@sub", text: String = "@sub") {
    val p = LocalPalette.current
    val liked = isOn(app.get(variable)); val c = if (liked) p.resolve(on) ?: p.accent else p.resolve(off) ?: p.sub
    val k by animateFloatAsState(if (liked) 1f else 0.9f, androidx.compose.animation.core.spring(dampingRatio = 0.35f))
    val ic = when (icon) { "thumbs up" -> Icons.Filled.ThumbUp; "star" -> Icons.Filled.Star; else -> if (liked) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder }
    Row(Modifier.clip(RoundedCornerShape(20.dp)).clickable {
        app.set(variable, !liked); if (countVar.isNotEmpty()) app.add(countVar, if (liked) -1.0 else 1.0); if (message.isNotEmpty()) app.send(message)
    }.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(ic, contentDescription = "Like", tint = c, modifier = Modifier.size(26.dp).scale(k * if (liked) 1.08f else 1f))
        if (countVar.isNotEmpty()) Text(compactNum(app.get(countVar)), color = if (liked) c else p.resolve(text) ?: p.sub, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 6.dp))
    }
}

/** Text that scrolls across (several messages separated by |, with {variables}). */
@Composable
fun Ticker(text: String, speed: Double = 60.0, direction: String = "left", gap: Int = 60, size: Int = 15, bg: String = "", color: String = "", accent: String = "#ffd23d", height: Int = 36) {
    val p = LocalPalette.current
    val fg = p.resolve(color) ?: p.text; val ac = p.resolve(accent) ?: p.accent
    val parts = text.split("|").map { app.fill(it.trim()) }.filter { it.isNotEmpty() }
    val line = buildAnnotatedString { parts.forEachIndexed { i, t -> if (i > 0) withStyle(SpanStyle(color = ac)) { append("   ●   ") }; append(t) } }
    val tm = rememberTextMeasurer()
    val style = TextStyle(fontSize = size.sp, color = fg, fontWeight = FontWeight.Bold)
    val w = tm.measure(line, style, maxLines = 1).size.width + gap * 2f // (in pixels; gap in dp ≈ 2 px)
    val t = rememberInfiniteTransition()
    val k by t.animateFloat(0f, 1f, infiniteRepeatable(tween((w / 2 / maxOf(10.0, speed) * 1000).toInt(), easing = androidx.compose.animation.core.LinearEasing), RepeatMode.Restart))
    Box(Modifier.fillMaxWidth().height(height.dp).background(p.resolve(bg) ?: Color.Transparent).clipToBounds(), contentAlignment = Alignment.CenterStart) {
        Row(Modifier.wrapContentWidth(Alignment.Start, unbounded = true).offset { IntOffset((if (direction == "right") -w + k * w else -k * w).toInt(), 0) }) {
            repeat(4) { Text(line, style = style, maxLines = 1, softWrap = false, modifier = Modifier.padding(end = gap.dp)) }
        }
    }
}

/** A countdown (or count-up) as a ring, bar, big digits or a pill: red near the end, then a message. "timer start / pause / reset / restart / add 5" control it. */
@Composable
fun PTimer(seconds: Double = 30.0, countUp: Boolean = false, look: String = "ring", format: String = "seconds", autoStart: Boolean = true, message: String = "timer", endMessage: String = "", endAction: String = "nothing else", warnAt: Double = 5.0, variable: String = "", color: String = "@accent", warn: String = "#ff4d5e", track: String = "@line", text: String = "", size: Int = 120) {
    val p = LocalPalette.current
    var t by remember { mutableStateOf(0.0) }
    var running by remember { mutableStateOf(autoStart) }
    var done by remember { mutableStateOf(false) }
    OnMessage { m ->
        if (m.startsWith(message)) {
            val rest = m.removePrefix(message).trim()
            when {
                rest == "start" || rest == "resume" || rest.isEmpty() -> running = true
                rest == "pause" || rest == "stop" -> running = false
                rest == "reset" -> { t = 0.0; done = false }
                rest == "restart" -> { t = 0.0; done = false; running = true }
                Regex("^add\\s+-?\\d").containsMatchIn(rest) -> t = maxOf(0.0, t - (rest.split(Regex("\\s+"))[1].toDoubleOrNull() ?: 0.0) * if (countUp) -1 else 1)
            }
        }
    }
    LaunchedEffect(Unit) {
        var shown = -1
        while (true) {
            delay(100)
            if (!running || done) continue
            t = minOf(seconds, t + 0.1)
            if (t >= seconds) { done = true; if (endMessage.isNotEmpty()) app.send(endMessage); if (endAction == "restart timer") { t = 0.0; done = false } }
            val left = if (countUp) kotlin.math.floor(t).toInt() else kotlin.math.ceil(seconds - t).toInt()
            if (variable.isNotEmpty() && left != shown) { shown = left; app.set(variable, left.toDouble()) }
        }
    }
    val s = if (seconds <= 0) 1.0 else seconds; val left = if (countUp) t else s - t
    val warnOn = !countUp && left <= warnAt && !done && running
    val c = if (warnOn) p.resolve(warn) ?: p.danger else p.resolve(color) ?: p.accent
    val whole = if (countUp) kotlin.math.floor(left).toInt() else kotlin.math.ceil(left).toInt()
    val label = when (format) { "m:ss" -> "${whole / 60}:${(whole % 60).toString().padStart(2, '0')}"; "seconds.tenths" -> (kotlin.math.round(left * 10) / 10).toString(); else -> whole.toString() }
    val frac = (left / s).coerceIn(0.0, 1.0).toFloat(); val fg = p.resolve(text) ?: p.text; val tr = p.resolve(track) ?: p.line
    val pulse by animateFloatAsState(if (warnOn && (t * 2).toInt() % 2 == 0) 1.06f else 1f, tween(200))
    @Composable fun digits() = Text(label, color = if (warnOn) c else fg, fontWeight = FontWeight.Black, fontSize = (size * if (look == "digits") 0.45f else 0.26f).sp)
    Box(Modifier.fillMaxWidth().scale(pulse), contentAlignment = Alignment.Center) {
        when (look) {
            "bar" -> Column(horizontalAlignment = Alignment.CenterHorizontally) { digits(); Spacer(Modifier.height(6.dp)); LinearProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(6.dp)), color = c, trackColor = tr) }
            "digits" -> digits()
            "pill" -> Row(Modifier.clip(RoundedCornerShape(30.dp)).background(c.copy(alpha = 0.16f)).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) { Text("⏱", fontSize = 18.sp); Spacer(Modifier.width(6.dp)); digits() }
            else -> Box(Modifier.size(size.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxSize(), color = c, trackColor = tr, strokeWidth = (size * 0.08f).dp, strokeCap = StrokeCap.Round); digits() }
        }
    }
}

/** Grey shapes that shimmer while content loads; gone when its variable turns on. */
@Composable
fun Skeleton(layout: String = "avatar + lines", lines: Int = 3, doneVar: String = "", radius: Int = 8) {
    if (doneVar.isNotEmpty() && isOn(app.get(doneVar))) return
    val p = LocalPalette.current
    val k by rememberInfiniteTransition().animateFloat(0f, 1f, infiniteRepeatable(tween(1100), RepeatMode.Reverse))
    val col = lerp(p.text.copy(alpha = 0.07f), p.text.copy(alpha = 0.15f), k)
    @Composable fun bar(f: Float) = Box(Modifier.fillMaxWidth(f).padding(vertical = 5.dp).height(12.dp).clip(RoundedCornerShape(radius.dp)).background(col))
    @Composable fun rows(n: Int) = Column(Modifier.fillMaxWidth()) { for (i in 0 until n) bar(if (i == n - 1 && n > 1) 0.6f else 1f) }
    @Composable fun dot(d: Int) = Box(Modifier.size(d.dp).clip(CircleShape).background(col))
    when (layout) {
        "text lines" -> rows(lines)
        "card" -> Column { Box(Modifier.fillMaxWidth().height(140.dp).clip(RoundedCornerShape((radius * 1.5f).dp)).background(col)); Spacer(Modifier.height(8.dp)); rows(maxOf(1, lines - 1)) }
        "list rows" -> Column { repeat(lines) { Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) { dot(40); Spacer(Modifier.width(12.dp)); rows(2) } } }
        "picture" -> Box(Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape((radius * 1.5f).dp)).background(col))
        else -> Row { dot(48); Spacer(Modifier.width(12.dp)); rows(lines) }
    }
}

/** Colour swatches: tap one to pick it into a variable. */
@Composable
fun ColorSwatches(variable: String, colors: List<String>, columns: Int = 5, shape: String = "circle", gap: Int = 10, ring: String = "@text", message: String = "") {
    val p = LocalPalette.current
    val cur = show(app.get(variable)).lowercase(); val cols = maxOf(1, columns)
    val sh = if (shape == "circle") CircleShape else RoundedCornerShape(if (shape == "rounded") 12.dp else 3.dp)
    Column(verticalArrangement = Arrangement.spacedBy(gap.dp)) {
        for (chunk in colors.chunked(cols)) Row(horizontalArrangement = Arrangement.spacedBy(gap.dp)) {
            for (c in chunk) {
                val on = c.lowercase() == cur; val fill = p.resolve(c) ?: p.line
                Box(Modifier.weight(1f).aspectRatio(1f).clip(sh).background(fill).border(if (on) 3.5.dp else 1.dp, if (on) p.resolve(ring) ?: p.text else p.line, sh).clickable { app.set(variable, c); if (message.isNotEmpty()) app.send(message) }, contentAlignment = Alignment.Center) {
                    if (on) Icon(Icons.Filled.Check, contentDescription = c, tint = if (fill.luminance() > 0.5f) Color.Black.copy(alpha = 0.8f) else Color.White)
                }
            }
            repeat(cols - chunk.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** A number pad for a code, a PIN or an answer: ✓ checks it against the answer and sends the right / wrong message. */
@Composable
fun Keypad(variable: String, maxLength: Int = 4, mask: Boolean = false, answer: String = "", rightMessage: String = "", wrongMessage: String = "", enterMessage: String = "", autoEnter: Boolean = true, display: Boolean = true, keyStyle: String = "round", keyColor: String = "@field", text: String = "", accent: String = "@good", displayBg: String = "") {
    val p = LocalPalette.current
    val cur = show(app.get(variable)); val fg = p.resolve(text) ?: p.text; val ac = p.resolve(accent) ?: p.accent
    fun enter(v: String) {
        if (enterMessage.isNotEmpty()) app.send(enterMessage)
        if (answer.isEmpty()) return
        if (v == answer) { if (rightMessage.isNotEmpty()) app.send(rightMessage) } else { if (wrongMessage.isNotEmpty()) app.send(wrongMessage); app.set(variable, "") }
    }
    fun press(k: String) {
        when (k) {
            "⌫" -> if (cur.isNotEmpty()) app.set(variable, cur.dropLast(1))
            "✓" -> enter(cur)
            else -> if (cur.length < maxLength) { val next = cur + k; app.set(variable, next); if (autoEnter && next.length == maxLength) enter(next) }
        }
    }
    val sh = if (keyStyle == "round") CircleShape else RoundedCornerShape(if (keyStyle == "flat") 6.dp else 16.dp)
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(Modifier.widthIn(max = 300.dp)) {
            if (display) Text((0 until maxLength).joinToString("  ") { if (it < cur.length) (if (mask) "•" else cur[it].toString()) else "–" },
                Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(RoundedCornerShape(14.dp)).background(p.resolve(displayBg) ?: p.field).padding(vertical = 14.dp),
                color = fg, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center)
            for (r in listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf("⌫", "0", "✓"))) Row {
                for (k in r) Box(Modifier.weight(1f).padding(6.dp).aspectRatio(if (keyStyle == "round") 1f else 1.5f).clip(sh)
                    .background(if (k == "✓") ac else if (keyStyle == "flat") Color.Transparent else p.resolve(keyColor) ?: p.field).clickable { press(k) }, contentAlignment = Alignment.Center) {
                    Text(k, color = if (k == "✓") Color.White else fg, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** ‹ Easy › : pick one of several options with arrows; the choice goes into a variable. */
@Composable
fun Selector(variable: String, options: List<String>, wrap: Boolean = true) {
    val n = options.size; if (n == 0) return
    val p = LocalPalette.current
    val i = maxOf(0, options.indexOf(show(app.get(variable))))
    fun pick(d: Int) = app.set(variable, options[if (wrap) (i + d + n) % n else (i + d).coerceIn(0, n - 1)])
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(p.field), verticalAlignment = Alignment.CenterVertically) {
        IconButton(onClick = { pick(-1) }, enabled = wrap || i > 0) { Text("‹", fontSize = 28.sp, color = p.text) }
        Text(options[i], Modifier.weight(1f), color = p.text, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, textAlign = TextAlign.Center)
        IconButton(onClick = { pick(1) }, enabled = wrap || i < n - 1) { Text("›", fontSize = 28.sp, color = p.text) }
    }
}

/** A popup (a dialog) or a bottom sheet with things inside: opens on a message and closes on another (or after a few seconds). */
@Composable
fun PPopup(mode: String = "popup", openOn: String = "popup", closeOn: String = "close", startOpen: Boolean = false, autoClose: Double = 0.0, tapCloses: Boolean = false, dim: Boolean = true, handle: Boolean = true, content: @Composable () -> Unit) {
    var open by remember { mutableStateOf(startOpen) }
    OnMessage { m -> if (m == openOn) open = true else if (m == closeOn) open = false }
    if (autoClose > 0) LaunchedEffect(open) { if (open) { delay((autoClose * 1000).toLong()); open = false } }
    if (!open) return
    if (mode == "sheet") {
        ModalBottomSheet(onDismissRequest = { open = false }, dragHandle = if (handle) ({ BottomSheetDefaults.DragHandle() }) else null, scrimColor = if (dim) BottomSheetDefaults.ScrimColor else Color.Transparent) {
            Box(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 24.dp)) { content() }
        }
    } else {
        Dialog(onDismissRequest = { if (tapCloses) open = false }, properties = DialogProperties(dismissOnClickOutside = tapCloses, usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxWidth().padding(20.dp)) { content() }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Game-style parts that work in apps too: a shop, a daily reward calendar, a prize wheel, a skill button,
// a radial menu, a level map and a quest log (all kept in the app's variables, so games share them).
// ---------------------------------------------------------------------------------------------------------------

/** An icon from the project: an emoji (drawn as text) or one of the editor's icon names. */
@Composable
fun GameIcon(icon: String, size: Int = 28, color: Color = Color.White) {
    val emoji = icon.isNotEmpty() && icon.any { it.code > 0x2000 || it.isSurrogate() }
    if (emoji) Text(icon, fontSize = (size * 0.9).sp, lineHeight = (size * 0.95).sp)
    else Icon(PocketIcons.nav(icon.ifEmpty { "star" }), null, Modifier.size(size.dp), tint = color)
}

/** 15300 → 15.3K (as the engine shows prices and amounts). */
fun gameNum(v: Double): String {
    val a = kotlin.math.abs(v)
    if (a < 10000) return if (v == kotlin.math.round(v)) kotlin.math.round(v).toLong().toString() else ((v * 10).toLong() / 10.0).toString()
    for ((n, u) in listOf(1e9 to "B", 1e6 to "M", 1e3 to "K")) if (a >= n) return ((v / n * 10).toLong() / 10.0).toString().removeSuffix(".0") + u
    return v.toString()
}

data class ShopItem(val name: String, val icon: String, val price: Double, val id: String, val note: String = "")

/** Shop: buy items with a currency variable (coins, gems). Bought ones stay owned (owned_ID) and can be equipped (equipVar);
 *  ids starting with item: are given each time (a give message for the game's inventory). */
@Composable
fun PShop(items: List<ShopItem>, currency: String = "coins", currencyIcon: String = "🪙", equipVar: String = "outfit", layout: String = "grid", columns: Int = 2, confirm: Boolean = true, message: String = "bought", card: String = "@card", text: String = "", accent: String = "@good", owned: String = "@accent") {
    val p = LocalPalette.current
    var armed by remember { mutableStateOf(-1) }
    LaunchedEffect(armed) { if (armed >= 0) { delay(2200); armed = -1 } }
    val fg = p.resolve(text) ?: p.text; val cash = num(app.get(currency)) ?: 0.0; val grid = layout != "list"
    fun tap(it: ShopItem, i: Int) {
        val item = it.id.startsWith("item:")
        if (!item && app.get("owned_${it.id}") == true) { if (equipVar.isNotEmpty()) app.set(equipVar, it.id); return }
        if (cash < it.price) { app.send("not enough"); return }
        if (confirm && armed != i) { armed = i; return }
        armed = -1
        app.set(currency, cash - it.price)
        if (item) app.send("give ${it.id.removePrefix("item:").trim()}|1") else { app.set("owned_${it.id}", true); if (equipVar.isNotEmpty()) app.set(equipVar, it.id) }
        if (message.isNotEmpty()) app.send(message)
    }
    @Composable fun Card(i: Int, mod: Modifier) {
        val it = items[i]; val item = it.id.startsWith("item:"); val has = !item && app.get("owned_${it.id}") == true
        val eq = has && equipVar.isNotEmpty() && show(app.get(equipVar)) == it.id; val can = cash >= it.price; val isArmed = armed == i
        val label = when { eq -> "✓ Equipped"; has -> if (equipVar.isNotEmpty()) "Equip" else "✓ Owned"; isArmed -> "Buy?"; else -> "$currencyIcon ${gameNum(it.price)}".trim() }
        val ownC = p.resolve(owned) ?: p.accent
        val btn = when { has -> ownC.copy(alpha = if (eq) 0.35f else 0.9f); isArmed -> Color(0xFFFF9F43); can -> p.resolve(accent) ?: Color(0xFF3CCF7A); else -> fg.copy(alpha = 0.12f) }
        val button = @Composable { Box(Modifier.height(32.dp).clip(RoundedCornerShape(16.dp)).background(btn).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Text(label, fontSize = 13.5.sp, fontWeight = FontWeight.Black, color = if (has || can || isArmed) Color.White else fg.copy(alpha = 0.5f)) } }
        val shape = RoundedCornerShape(16.dp)
        Box(mod.clip(shape).background(p.resolve(card) ?: p.card).then(if (eq) Modifier.border(2.5.dp, ownC, shape) else Modifier).clickable { tap(it, i) }.padding(10.dp)) {
            if (grid) Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                GameIcon(it.icon, 40, fg); Spacer(Modifier.height(6.dp))
                Text(it.name, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = fg, maxLines = 1)
                if (it.note.isNotEmpty()) Text(it.note, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = fg.copy(alpha = 0.6f), maxLines = 1)
                Spacer(Modifier.height(8.dp)); button()
            } else Row(Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width(48.dp), contentAlignment = Alignment.Center) { GameIcon(it.icon, 32, fg) }
                Column(Modifier.weight(1f)) {
                    Text(it.name, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold, color = fg)
                    if (it.note.isNotEmpty()) Text(it.note, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = fg.copy(alpha = 0.6f))
                }
                button()
            }
        }
    }
    if (!grid) Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { for (i in items.indices) Card(i, Modifier.fillMaxWidth().height(72.dp)) }
    else BoxWithConstraints(Modifier.fillMaxWidth()) {
        val cols = maxOf(1, columns); val cw = (maxWidth - 10.dp * (cols - 1)) / cols
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (r in items.indices.chunked(cols)) Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { for (i in r) Card(i, Modifier.width(cw).height(minOf(cw * 1.2f, 190.dp))) }
        }
    }
}

data class Reward(val label: String, val icon: String, val v: String, val amount: Double)

/** Daily Reward: a calendar of rewards, one claim a day; the streak grows when you come back (and resets if you miss a day). Kept on the phone. */
@Composable
fun DailyReward(rewards: List<Reward>, resetIfMissed: Boolean = true, columns: Int = 4, message: String = "daily claimed", card: String = "@card", text: String = "", accent: String = "#ffd23d", claimed: String = "@good") {
    val p = LocalPalette.current
    fun day(off: Int = 0) = dayOf(nowMs().toLong() + off * 86_400_000L)
    var streak by remember { mutableStateOf(0) }
    var last by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        Store.get("pocket.daily")?.split("|")?.let { s -> streak = s.getOrNull(0)?.toIntOrNull() ?: 0; last = s.getOrNull(1) ?: "" }
        if (resetIfMissed && last.isNotEmpty() && last != day() && last != day(-1)) streak = 0
        if (streak >= rewards.size && last != day()) streak = 0
    }
    val can = last != day()
    val fg = p.resolve(text) ?: p.text; val ac = p.resolve(accent) ?: Color(0xFFFFD23D); val cl = p.resolve(claimed) ?: Color(0xFF3CCF7A)
    fun claim() {
        if (!can || streak >= rewards.size) return
        val r = rewards[streak]
        if (r.v.startsWith("item:")) app.send("give ${r.v.removePrefix("item:").trim()}|${show(r.amount)}") else app.set(r.v, (num(app.get(r.v)) ?: 0.0) + r.amount)
        streak++; last = day(); Store.put("pocket.daily", "$streak|$last"); app.send(message)
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val cols = maxOf(1, columns); val cw = (maxWidth - 8.dp * (cols - 1)) / cols
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (row in rewards.indices.chunked(cols)) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (i in row) {
                        val r = rewards[i]; val done = i < streak; val today = i == streak && can; val shape = RoundedCornerShape(14.dp)
                        Box(Modifier.width(cw).height(cw * 1.1f).clip(shape).background(if (done) cl.copy(alpha = 0.18f) else p.resolve(card) ?: p.card)
                            .then(if (today) Modifier.border(3.dp, ac, shape) else Modifier).clickable(enabled = today) { claim() }) {
                            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.SpaceEvenly) {
                                Text(r.label, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = fg.copy(alpha = 0.75f))
                                Box(Modifier.alpha(if (done) 0.5f else 1f)) { GameIcon(r.icon, (cw.value * 0.34f).toInt(), fg) }
                                Text(if (today) "CLAIM" else (if (r.v.startsWith("item:")) "×" else "+") + gameNum(r.amount), fontSize = 12.5.sp, fontWeight = FontWeight.Black, color = if (today) ac else fg)
                            }
                            if (done) Box(Modifier.align(Alignment.TopEnd).padding(5.dp).size(18.dp).clip(CircleShape).background(cl), contentAlignment = Alignment.Center) { Text("✓", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Black) }
                        }
                    }
                }
            }
        }
        if (!can) Text("Come back tomorrow!", Modifier.padding(top = 8.dp), fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold, color = fg.copy(alpha = 0.7f))
    }
}

data class WheelSeg(val label: String, val color: String, val amount: Double, val w: Double = 1.0)

/** Prize Wheel: spins when tapped (or on a message) and lands on a prize (by weight): adds it to a variable and sends a message. */
@Composable
fun PrizeWheel(segments: List<WheelSeg>, variable: String = "coins", resultVar: String = "prize", spinOn: String = "tapped", message: String = "spin", doneMessage: String = "prize won", duration: Double = 4.0, spinsVar: String = "", text: String = "#ffffff", rim: String = "#ffd23d", size: Int = 280) {
    val p = LocalPalette.current
    val angle = remember { androidx.compose.animation.core.Animatable(0f) }
    val scope = rememberCoroutineScope()
    var win by remember { mutableStateOf(-1) }
    val measurer = rememberTextMeasurer()
    fun spin() {
        if (angle.isRunning || segments.isEmpty()) return
        if (spinsVar.isNotEmpty()) { if ((num(app.get(spinsVar)) ?: 0.0) <= 0) return; app.set(spinsVar, (num(app.get(spinsVar)) ?: 0.0) - 1) }
        val total = segments.sumOf { it.w }.takeIf { it > 0 } ?: 1.0
        var r = kotlin.random.Random.nextDouble() * total; var w = segments.size - 1
        for (i in segments.indices) { r -= segments[i].w; if (r < 0) { w = i; break } }
        val seg = (kotlin.math.PI * 2 / segments.size).toFloat(); val land = -(w + 0.5f) * seg + (kotlin.random.Random.nextFloat() - 0.5f) * seg * 0.7f
        val from = angle.value % (kotlin.math.PI * 2).toFloat(); val twoPi = (kotlin.math.PI * 2).toFloat()
        val to = from - (((from - land) % twoPi) + twoPi) % twoPi - twoPi * (5 + duration.toInt())
        win = -1
        scope.launch {
            angle.snapTo(from)
            angle.animateTo(to, tween((duration * 1000).toInt(), easing = androidx.compose.animation.core.CubicBezierEasing(0.25f, 1f, 0.5f, 1f)))
            win = w
            val s = segments[w]
            if (variable.isNotEmpty() && s.amount != 0.0) app.set(variable, (num(app.get(variable)) ?: 0.0) + s.amount)
            if (resultVar.isNotEmpty()) app.set(resultVar, s.label)
            app.send(doneMessage)
        }
    }
    OnMessage { m -> if (m == message) spin() }
    val tc = p.resolve(text) ?: Color.White; val rc = p.resolve(rim) ?: Color(0xFFFFD23D)
    Canvas(Modifier.size(size.dp).then(if (spinOn != "message only") Modifier.clickable { spin() } else Modifier)) {
        val c = center; val R = minOf(this.size.width, this.size.height) / 2 - 10.dp.toPx(); val n = maxOf(1, segments.size); val seg = 360f / n
        drawCircle(rc, R + 8.dp.toPx(), c)
        val a = angle.value * 180f / kotlin.math.PI.toFloat()
        segments.forEachIndexed { i, s ->
            val a0 = -90f + i * seg + a
            drawArc(Color(("FF" + s.color.removePrefix("#").padEnd(6, '0').take(6)).toLong(16)), a0, seg, true, Offset(c.x - R, c.y - R), Size(R * 2, R * 2))
            if (i == win) drawArc(Color(0x55FFFFFF), a0, seg, true, Offset(c.x - R, c.y - R), Size(R * 2, R * 2))
            val am = (a0 + seg / 2) * kotlin.math.PI.toFloat() / 180f
            val layout = measurer.measure(s.label, TextStyle(color = tc, fontSize = (R * 0.13f / density).sp, fontWeight = FontWeight.Black))
            drawText(layout, topLeft = Offset(c.x + kotlin.math.cos(am) * R * 0.64f - layout.size.width / 2, c.y + kotlin.math.sin(am) * R * 0.64f - layout.size.height / 2))
        }
        drawCircle(rc, R * 0.14f, c)
        drawPath(Path().apply { moveTo(c.x - 12.dp.toPx(), c.y - R - 12.dp.toPx()); lineTo(c.x + 12.dp.toPx(), c.y - R - 12.dp.toPx()); lineTo(c.x, c.y - R + 10.dp.toPx()); close() }, Color.White)
    }
}

/** Skill Button: tap to use (sends a message), then it cools down with a sweeping shadow; charges and a cost are optional. */
@Composable
fun SkillButton(icon: String = "⚡", label: String = "", message: String = "skill", cooldown: Double = 3.0, charges: Int = 1, costVar: String = "", cost: Double = 10.0, shape: String = "circle", showTime: Boolean = true, bg: String = "@card", ring: String = "#7fd3ff", size: Int = 72) {
    val p = LocalPalette.current
    var left by remember { mutableStateOf(charges) }
    var cd by remember { mutableStateOf(0.0) }
    LaunchedEffect(left) { while (left < charges && cooldown > 0) { delay(50); cd += 0.05; if (cd >= cooldown) { cd = 0.0; left++ } } }
    val afford = costVar.isEmpty() || (num(app.get(costVar)) ?: 0.0) >= cost
    val ready = left > 0 && afford; val f = if (left == 0 && cooldown > 0) (1 - cd / cooldown).toFloat() else 0f
    val sh = if (shape == "rounded square") RoundedCornerShape((size * 0.25f).dp) else CircleShape
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(size.dp).clip(sh).background(p.resolve(bg) ?: p.card).then(if (ready) Modifier.border(2.5.dp, p.resolve(ring) ?: Color(0xFF7FD3FF), sh) else Modifier)
            .clickable { if (left > 0 && afford) { if (left == charges) cd = 0.0; left--; if (costVar.isNotEmpty()) app.set(costVar, (num(app.get(costVar)) ?: 0.0) - cost); app.send(message) } }, contentAlignment = Alignment.Center) {
            GameIcon(icon, (size * 0.5f).toInt(), p.text)
            if (f > 0) Canvas(Modifier.fillMaxSize()) { drawArc(Color(0x8C000000), -90f, f * 360f, true, Offset(-this.size.width / 2, -this.size.height / 2), Size(this.size.width * 2, this.size.height * 2)) }
            if (f > 0 && showTime) Text("${kotlin.math.ceil(cooldown - cd).toInt()}", color = Color.White, fontWeight = FontWeight.Black, fontSize = (size * 0.32f).sp)
            if (charges > 1) Box(Modifier.align(Alignment.BottomEnd).size(20.dp).clip(CircleShape).background(p.accent), contentAlignment = Alignment.Center) { Text("$left", fontSize = 11.sp, color = Color.White, fontWeight = FontWeight.Black) }
            if (!afford) Box(Modifier.fillMaxSize().background(Color(0x59283CA0)))
        }
        if (label.isNotEmpty()) Text(label, Modifier.padding(top = 4.dp), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = p.text)
    }
}

data class RadialItem(val label: String, val icon: String, val msg: String)

/** Radial Menu: a round button that opens a wheel of choices around it; tap a choice to send its message. */
@Composable
fun RadialMenu(items: List<RadialItem>, icon: String = "😀", open: String = "hold and slide", radius: Int = 110, dim: Double = 0.35, labels: Boolean = true, accent: String = "@accent", bg: String = "@card", size: Int = 64) {
    val p = LocalPalette.current
    var shown by remember { mutableStateOf(false) }
    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.size(size.dp).clip(CircleShape).background(p.resolve(bg) ?: p.card).clickable { shown = true }, contentAlignment = Alignment.Center) { GameIcon(icon, (size * 0.5f).toInt(), p.text) }
        if (shown) Dialog(onDismissRequest = { shown = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = dim.toFloat())).clickable { shown = false }, contentAlignment = Alignment.Center) {
                val n = maxOf(1, items.size)
                items.forEachIndexed { i, it ->
                    val a = -kotlin.math.PI / 2 + i * kotlin.math.PI * 2 / n
                    Box(Modifier.offset((kotlin.math.cos(a) * radius).dp, (kotlin.math.sin(a) * radius).dp).size(64.dp).clip(CircleShape).background(p.resolve(bg) ?: p.card)
                        .clickable { shown = false; app.send(it.msg) }, contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) { GameIcon(it.icon, 26, p.text); if (labels) Text(it.label, fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = p.text, maxLines = 1) }
                    }
                }
                Box(Modifier.size(size.dp).clip(CircleShape).background(p.resolve(accent) ?: p.accent), contentAlignment = Alignment.Center) { GameIcon(icon, (size * 0.5f).toInt(), Color.White) }
            }
        }
    }
}

/** Level Map: a path of level buttons with stars (stars_1, stars_2…) and locks (unlocked); tap an open level to play it (or send a message / set a variable). */
@Composable
fun LevelMap(count: Int = 12, unlockedVar: String = "unlocked", allOpen: Boolean = false, starsVar: String = "stars_", layout: String = "winding path", action: String = "plays that level", message: String = "level", spacing: Int = 92, accent: String = "#ffd23d", node: String = "@accent", text: String = "", height: Int = 480) {
    val p = LocalPalette.current
    val open = if (allOpen) Int.MAX_VALUE else maxOf(1, (num(app.get(unlockedVar)) ?: 1.0).toInt())
    val fg = p.resolve(text) ?: p.text; val ac = p.resolve(accent) ?: Color(0xFFFFD23D)
    fun go(n: Int) = when (action) { "sends a message" -> { app.send("$message $n"); app.send(message) }; "sets a variable" -> app.set(message, n.toDouble()); else -> { app.set("level", n.toDouble()); app.send("play level $n"); app.send("play game") } }
    @Composable fun Dot(i: Int) {
        val n = i + 1; val locked = n > open; val cur = n == open; val stars = (num(app.get("$starsVar$n")) ?: 0.0).toInt().coerceIn(0, 3)
        Column(Modifier.width(76.dp).clickable(enabled = !locked) { go(n) }, horizontalAlignment = Alignment.CenterHorizontally) {
            val d = if (cur) 60.dp else 52.dp
            Box(Modifier.size(d).clip(CircleShape).background(if (locked) fg.copy(alpha = 0.15f) else p.resolve(node) ?: p.accent).then(if (cur) Modifier.border(3.dp, ac, CircleShape) else Modifier), contentAlignment = Alignment.Center) {
                if (locked) Icon(Icons.Filled.Lock, null, tint = fg.copy(alpha = 0.6f)) else Text("$n", color = Color.White, fontWeight = FontWeight.Black, fontSize = 20.sp)
            }
            if (!locked) Row { for (s in 0 until 3) Icon(Icons.Filled.Star, null, Modifier.size(14.dp), tint = if (s < stars) ac else fg.copy(alpha = 0.2f)) }
        }
    }
    if (layout == "grid") Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        for (r in (0 until count).chunked(4)) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { for (i in r) Dot(i) }
    } else LazyColumn(Modifier.fillMaxWidth().height(height.dp), reverseLayout = true) {
        items((0 until count).toList()) { i ->
            Box(Modifier.fillMaxWidth().height(spacing.dp), contentAlignment = androidx.compose.ui.BiasAlignment(if (layout == "straight up") 0f else (kotlin.math.sin(i * 1.1) * 0.6).toFloat(), 0f)) { Dot(i) }
        }
    }
}

data class QuestGoal(val text: String, val v: String, val target: Double, val reward: String = "")

/** Quest Log: goals with progress bars; each follows a variable up to a target, ticks off when done (quest_done_N) and gives its reward ("gems 5"). */
@Composable
fun QuestLog(quests: List<QuestGoal>, title: String = "Quests", doneMessage: String = "quest done", hideDone: Boolean = true, text: String = "", accent: String = "@accent", done: String = "@good", bg: String = "") {
    val p = LocalPalette.current
    val fg = p.resolve(text) ?: p.text; val ac = p.resolve(accent) ?: p.accent; val dn = p.resolve(done) ?: Color(0xFF3CCF7A)
    SideEffect {
        quests.forEachIndexed { i, q ->
            if (app.get("quest_done_$i") != true && (num(app.get(q.v)) ?: 0.0) >= q.target) {
                app.set("quest_done_$i", true)
                val r = q.reward.split(Regex("\\s+")); if (r.size >= 2) app.set(r[0], (num(app.get(r[0])) ?: 0.0) + (r[1].toDoubleOrNull() ?: 0.0))
                app.send(doneMessage)
            }
        }
    }
    val order = quests.indices.sortedBy { if (hideDone && app.get("quest_done_$it") == true) 1 else 0 }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(p.resolve(bg) ?: Color.Transparent).padding(12.dp)) {
        if (title.isNotEmpty()) Text(title, Modifier.padding(bottom = 8.dp), fontSize = 17.sp, fontWeight = FontWeight.Black, color = fg)
        for (i in order) {
            val q = quests[i]; val ok = app.get("quest_done_$i") == true; val have = num(app.get(q.v)) ?: 0.0; val f = (have / q.target).coerceIn(0.0, 1.0).toFloat()
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(24.dp).clip(CircleShape).background(if (ok) dn else fg.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) { if (ok) Text("✓", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black) }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(q.text, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = if (ok) fg.copy(alpha = 0.5f) else fg, textDecoration = if (ok) androidx.compose.ui.text.style.TextDecoration.LineThrough else null)
                    Spacer(Modifier.height(5.dp))
                    LinearProgressIndicator(progress = { if (ok) 1f else f }, Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)), color = if (ok) dn else ac, trackColor = fg.copy(alpha = 0.1f))
                }
                Spacer(Modifier.width(12.dp))
                Text(if (ok) "✓" else "${gameNum(minOf(have, q.target))}/${gameNum(q.target)}", fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = fg.copy(alpha = 0.7f))
                if (q.reward.isNotEmpty()) Text("+${q.reward}", Modifier.padding(start = 8.dp), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = ac)
            }
        }
    }
}
