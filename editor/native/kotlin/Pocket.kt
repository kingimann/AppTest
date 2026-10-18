@file:OptIn(ExperimentalMaterial3Api::class, kotlin.time.ExperimentalTime::class)

// Pocket runtime for Compose Multiplatform (Android and iOS): the app's state (variables, data collections, the opened
// record, navigation) and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by
// Pocket Engine's native export; the pages in pages/ are yours to change, and so is this file.
package __PACKAGE__

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
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

/** The app's colours (@tokens) for light or dark. */
class Palette(val c: Map<String, Color>) {
    fun resolve(v: String?): Color? {
        if (v.isNullOrEmpty()) return null
        val t = v.removePrefix("@")
        c[t]?.let { return it }
        val h = v.removePrefix("#")
        return if (h.length == 6) h.toLongOrNull(16)?.let { Color(0xFF000000 or it) } else null
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
) {
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
        val now = nowMs()
        for (c in collections) {
            @Suppress("UNCHECKED_CAST")
            val rows = (saved?.get(c.name) as? List<*>)?.mapNotNull { it as? Map<String, Any?> }
            data[c.name] = rows ?: c.sample.mapIndexed { i, r -> r + mapOf("_id" to "s$i", "_at" to now - i * 1000) }
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
    private fun work() { for (s in stats) vars[s.variable] = stat(s.collection, s.how, s.field, s.filter) }

    // ---- variables and text ----
    fun get(k: String): Any? = vars[k]
    fun set(k: String, v: Any?) { vars[k] = v; changed() }
    fun add(k: String, by: Double) = set(k, (num(vars[k]) ?: 0.0) + by)

    /** "{score} points" → "12 points"; {record_title} is the opened record's title; with a row, {title} is the row's. */
    fun fill(t: String, row: Row? = null): String = Regex("\\{(\\w+)\\}").replace(t) { m ->
        val k = m.groupValues[1]
        when {
            row != null && row.containsKey(k) -> show(row[k])
            k.startsWith("record_") -> show(opened?.get(k.removePrefix("record_")))
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
        data[name] = rows(name) + (values + mapOf("_id" to id, "_at" to nowMs()))
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

    /** What a button does (the same words as the button's Action in Pocket Engine). */
    fun run(action: String, value: Any? = "", amount: Double = 1.0) {
        val v = show(value)
        when (action) {
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
            Scaffold(
                containerColor = p.bg,
                bottomBar = {
                    if (app.tabs.isNotEmpty() && stack.isEmpty()) NavigationBar(containerColor = p.card) {
                        app.tabs.forEachIndexed { i, t ->
                            val n = if (t.badge.isEmpty()) 0 else (num(app.get(t.badge)) ?: 0.0).toInt()
                            NavigationBarItem(
                                selected = app.tab == i, onClick = { app.go(t.page) }, label = { Text(t.label) },
                                icon = { BadgedBox(badge = { if (n > 0) Badge { Text(n.toString()) } }) { Icon(t.icon, contentDescription = t.label) } },
                            )
                        }
                    }
                },
            ) { pad -> Box(Modifier.padding(pad)) { (pages[page] ?: { Text("No page $page") })() } }
        }
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------------------------

/** A page: its title (with a back arrow on pages opened on top), then what's on it (a list or form fills the rest). */
@Composable
fun PocketPage(title: String, scroll: Boolean = true, appBar: Boolean = true, fab: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    Scaffold(
        containerColor = p.bg,
        topBar = {
            if (appBar) TopAppBar(
                title = { Text(app.fill(title), fontWeight = FontWeight.ExtraBold) },
                navigationIcon = { if (app.stack.isNotEmpty()) IconButton(onClick = { app.back() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = p.card, titleContentColor = p.text, navigationIconContentColor = p.text),
            )
        },
        floatingActionButton = { if (fab != null) FloatingActionButton(onClick = fab, containerColor = p.accent, contentColor = p.onAccent, shape = CircleShape) { Icon(Icons.Filled.Add, contentDescription = "Add") } },
    ) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier).padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

/** Text with {variables} filled in. */
@Composable
fun PText(text: String, size: Int = 16, weight: Int = 600, color: String? = null) {
    val p = LocalPalette.current
    Text(app.fill(text), fontSize = size.sp, fontWeight = FontWeight(weight.coerceIn(100, 900)), color = p.resolve(color) ?: p.text)
}

enum class Look { Filled, Outlined, Danger, Plain }

@Composable
fun PButton(label: String, look: Look = Look.Filled, onClick: () -> Unit) {
    val p = LocalPalette.current
    val m = Modifier.fillMaxWidth().height(52.dp)
    val shape = RoundedCornerShape(16.dp)
    val text: @Composable () -> Unit = { Text(app.fill(label), fontSize = 17.sp, fontWeight = FontWeight.ExtraBold) }
    when (look) {
        Look.Filled -> Button(onClick, m, shape = shape, colors = ButtonDefaults.buttonColors(containerColor = p.accent, contentColor = p.onAccent)) { text() }
        Look.Danger -> OutlinedButton(onClick, m, shape = shape, colors = ButtonDefaults.outlinedButtonColors(contentColor = p.danger, containerColor = p.card), border = androidx.compose.foundation.BorderStroke(2.dp, p.danger)) { text() }
        Look.Outlined -> OutlinedButton(onClick, m, shape = shape, colors = ButtonDefaults.outlinedButtonColors(contentColor = p.accent), border = androidx.compose.foundation.BorderStroke(2.dp, p.accent)) { text() }
        Look.Plain -> TextButton(onClick, m) { text() }
    }
}

/** A card with things side by side (a settings row, a summary). */
@Composable
fun PCard(content: @Composable RowScope.() -> Unit) {
    val p = LocalPalette.current
    Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp), content = content)
}

/** A text box that edits a variable (search boxes too). */
@Composable
fun VarField(variable: String, placeholder: String = "", keyboard: String = "text") {
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

/** The records of a collection: tap one to open it, tick its checkbox, delete it. */
@Composable
fun RecordList(collection: String, modifier: Modifier = Modifier, title: String = "{title}", subtitle: String = "", icon: String = "", check: String = "", search: String = "", filter: String = "", sort: String = "newest first", openPage: String = "", empty: String = "Nothing here yet") {
    val p = LocalPalette.current
    val rows = app.query(collection, filter, if (search.isEmpty()) "" else show(app.get(search)), sort)
    if (rows.isEmpty()) {
        Box(modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(empty, color = p.sub, textAlign = TextAlign.Center) }
        return
    }
    LazyColumn(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 96.dp)) {
        items(rows, key = { show(it["_id"]) }) { r ->
            val id = show(r["_id"])
            val done = check.isNotEmpty() && isOn(r[check])
            Row(
                Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).clickable(enabled = openPage.isNotEmpty()) { app.open(collection, id); app.go(openPage) }.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (check.isNotEmpty()) Checkbox(checked = done, onCheckedChange = { app.updateRecord(collection, id, mapOf(check to it)) })
                else if (icon.isNotEmpty()) Text(app.fill(icon, r), fontSize = 26.sp, modifier = Modifier.padding(end = 12.dp))
                Column(Modifier.weight(1f)) {
                    Text(app.fill(title, r), fontWeight = FontWeight.Bold, color = if (done) p.sub else p.text, textDecoration = if (done) TextDecoration.LineThrough else null, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (subtitle.isNotEmpty()) Text(app.fill(subtitle, r), color = p.sub, maxLines = 2, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                }
                IconButton(onClick = { app.deleteRecord(collection, id) }) { Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = p.sub) }
                if (openPage.isNotEmpty()) Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = p.sub)
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
