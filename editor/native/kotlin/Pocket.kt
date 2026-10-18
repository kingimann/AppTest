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

// ---------------------------------------------------------------------------------------------------------------
// Social building blocks: a feed, a composer, stories, messages, profiles, a marketplace, notifications…
// They read and change the same data collections as the app (Posts, Messages, Stories, Listings, Profiles…).
// ---------------------------------------------------------------------------------------------------------------

val me: String get() = show(app.get("playerHandle")).ifEmpty { "me" }
val meName: String get() = show(app.get("playerName")).ifEmpty { "Me" }
fun Row.s(k: String): String = show(this[k])
private val avatarColors = listOf(0xFFEF4444, 0xFFF59E0B, 0xFF10B981, 0xFF3B82F6, 0xFF8B5CF6, 0xFFEC4899, 0xFF14B8A6, 0xFFF97316)
fun avatarColor(s: String): Color = Color(avatarColors[s.sumOf { it.code } % avatarColors.size])
fun firstMedia(m: Any?): String = show(m).split("|").first().trim()
fun isUrl(s: String): Boolean = s.startsWith("http:") || s.startsWith("https:")
fun colorOf(r: Row, seed: String): Color = app.light.resolve(r.s("color").takeIf { it.startsWith("#") }) ?: avatarColor(seed)

/** Opens a person's profile page (it shows {profile} and {profile_name}). */
fun openProfile(page: String, handle: String, name: String) {
    if (page.isEmpty()) return
    app.vars["profile"] = handle
    app.vars["profile_name"] = name
    app.go(page)
}

@Composable
fun Avatar(name: String, seed: String, size: Int = 40, label: String? = null) {
    Box(Modifier.size(size.dp).background(avatarColor(seed.ifEmpty { name }), CircleShape), contentAlignment = Alignment.Center) {
        Text(label ?: name.trim().take(1).uppercase().ifEmpty { "?" }, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = (size * 0.42).sp)
    }
}

/** A post's picture: an emoji on the post's colour (a photo link shows 🖼️: add an image library such as Coil to load it). */
@Composable
fun Media(r: Row, height: Int = 200, radius: Int = 12) {
    val m = firstMedia(r["media"])
    if (m.isEmpty()) return
    Box(Modifier.fillMaxWidth().height(height.dp).background(colorOf(r, r.s("handle") + m), RoundedCornerShape(radius.dp)), contentAlignment = Alignment.Center) {
        Text(if (isUrl(m)) "🖼️" else m, fontSize = (height * 0.4).sp)
    }
}

@Composable
private fun Empty(text: String) {
    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { Text(text, color = LocalPalette.current.sub, textAlign = TextAlign.Center) }
}

/** Posts, newest first: like, repost, save; tap the author for their profile. look: timeline, reels or grid. */
@Composable
fun SocialFeed(collection: String = "Posts", look: String = "timeline", filter: String = "", search: String = "", columns: Int = 3, profilePage: String = "", empty: String = "No posts yet") {
    val p = LocalPalette.current
    val rows = app.query(collection, filter, if (search.isEmpty()) "" else show(app.get(search)))
    if (rows.isEmpty()) { Empty(empty); return }
    fun toggle(r: Row, flag: String, count: String? = null) {
        val now = !isOn(r[flag])
        val change = mutableMapOf<String, Any?>(flag to now)
        if (count != null) change[count] = maxOf(0.0, (num(r[count]) ?: 0.0) + if (now) 1.0 else -1.0)
        app.updateRecord(collection, r.s("_id"), change)
    }
    if (look == "grid") {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (line in rows.chunked(columns)) Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (r in line) Box(Modifier.weight(1f).clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }) {
                    if (firstMedia(r["media"]).isEmpty()) Text(r.s("text"), maxLines = 4, fontSize = 11.sp, color = p.text, modifier = Modifier.fillMaxWidth().height(120.dp).background(p.field).padding(6.dp)) else Media(r, 120, 6)
                }
                repeat(columns - line.size) { Spacer(Modifier.weight(1f)) }
            }
        }
        return
    }
    @Composable
    fun RowScope.action(label: String, lit: Boolean, color: Color, onClick: () -> Unit) =
        TextButton(onClick, Modifier.weight(1f), contentPadding = PaddingValues(horizontal = 4.dp)) { Text(label, color = if (lit) color else p.sub, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (r in rows) Column(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.clickable { openProfile(profilePage, r.s("handle"), r.s("author")) }, verticalAlignment = Alignment.CenterVertically) {
                Avatar(r.s("author"), r.s("handle"))
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(r.s("author") + if (isOn(r["verified"])) " ✓" else "", fontWeight = FontWeight.ExtraBold, color = p.text)
                    Text("@${r.s("handle")}" + if (r.s("location").isEmpty()) "" else " · ${r.s("location")}", color = p.sub, fontSize = 14.sp)
                }
            }
            if (r.s("text").isNotEmpty()) Text(r.s("text"), color = p.text, fontSize = 16.sp)
            Media(r, if (look == "reels") 380 else 200)
            Row(Modifier.fillMaxWidth()) {
                action("💬 ${show(num(r["comments"]) ?: 0.0)}", false, p.accent) {}
                action("🔁 ${show(num(r["reposts"]) ?: 0.0)}", isOn(r["reposted"]), Color(0xFF10B981)) { toggle(r, "reposted", "reposts") }
                action("${if (isOn(r["liked"])) "❤️" else "🤍"} ${show(num(r["likes"]) ?: 0.0)}", isOn(r["liked"]), p.danger) { toggle(r, "liked", "likes") }
                action(if (isOn(r["saved"])) "🔖 Saved" else "🔖", isOn(r["saved"]), p.accent) { toggle(r, "saved") }
            }
        }
    }
}

@Composable
private fun SendBox(placeholder: String, button: String, onSend: (String) -> Unit) {
    val p = LocalPalette.current
    var text by remember { mutableStateOf("") }
    Row(Modifier.fillMaxWidth().background(p.card, RoundedCornerShape(16.dp)).padding(8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextField(text, { text = it }, Modifier.weight(1f), placeholder = { Text(placeholder) }, singleLine = true, shape = RoundedCornerShape(12.dp), colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent))
        Button({ if (text.isNotBlank()) { onSend(text.trim()); text = "" } }, colors = ButtonDefaults.buttonColors(containerColor = p.accent, contentColor = p.onAccent)) { Text(button) }
    }
}

/** A box to write a post: Post adds it to the top of the feed. */
@Composable
fun Composer(collection: String = "Posts", placeholder: String = "What’s happening?") =
    SendBox(placeholder, "Post") { app.addRecord(collection, mapOf("author" to meName, "handle" to me, "text" to it, "likes" to 0.0, "comments" to 0.0, "reposts" to 0.0, "liked" to false, "reposted" to false, "saved" to false)) }

/** Story circles; tap one to see it. */
@Composable
fun Stories(collection: String = "Stories") {
    val p = LocalPalette.current
    var open by remember { mutableStateOf<Row?>(null) }
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        for (r in app.query(collection)) Column(Modifier.clickable { open = r }, horizontalAlignment = Alignment.CenterHorizontally) {
            val m = firstMedia(r["media"])
            Box(Modifier.size(62.dp).border(3.dp, p.accent, CircleShape).padding(5.dp)) { Avatar(r.s("author"), r.s("handle"), 52, if (m.isEmpty() || isUrl(m)) null else m) }
            Text(r.s("author").substringBefore(" "), fontSize = 11.sp, color = p.text)
        }
    }
    open?.let { r ->
        AlertDialog(
            onDismissRequest = { open = null }, containerColor = colorOf(r, r.s("handle")),
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
    val own = mapOf("posts_count" to app.rows("Posts").count { it.s("handle") == h }.toDouble(), "points" to (num(app.get("points")) ?: 0.0))
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
