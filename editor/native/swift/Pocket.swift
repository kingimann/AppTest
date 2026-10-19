// Pocket runtime for SwiftUI: the app's state (variables, data collections, the opened record, navigation)
// and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by Pocket Engine's
// native export; the pages in App/Pages/ are yours to change, and so is this file.
import Combine
import SwiftUI

// MARK: - Values and data definitions

/// A value in a variable or a record: text, a number or yes/no.
enum Val: Codable, Hashable {
    case s(String), n(Double), b(Bool)

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .b(b) }
        else if let n = try? c.decode(Double.self) { self = .n(n) }
        else { self = .s((try? c.decode(String.self)) ?? "") }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self { case .s(let v): try c.encode(v); case .n(let v): try c.encode(v); case .b(let v): try c.encode(v) }
    }
    var text: String {
        switch self {
        case .s(let v): return v
        case .n(let v): return v == v.rounded() && abs(v) < 1e15 ? String(Int(v)) : String(v)
        case .b(let v): return v ? "yes" : "no"
        }
    }
    var number: Double? { switch self { case .n(let v): return v; case .s(let v): return Double(v); case .b(let v): return v ? 1 : 0 } }
    var isOn: Bool { switch self { case .b(let v): return v; case .n(let v): return v != 0; case .s(let v): return v == "yes" || v == "true" } }
}

typealias Row = [String: Val]

struct Field {
    let key: String, name: String, type: String // type: text, long text, number, money, date, choice, yes/no…
    var options: [String] = []
    var def: Val? = nil
}

struct Collection {
    let name: String
    let fields: [Field]
    var sample: [Row] = []
}

/// A number worked out from a collection (count, sum, average, min, max) and kept in a variable.
struct Stat {
    let variable: String, collection: String, how: String
    var field: String = ""
    var filter: String = ""
}

struct NavTab {
    let label: String, icon: String, page: String
    var badge: String = ""
    /// The icon's name in Pocket Engine (drawn with its line icon when artIcons has it; icon is the SF Symbol otherwise).
    var name: String = ""
}

/// A button on the right of the App Bar: icon (a name, or theme for the dark mode moon / sun), what it does
/// ("dark mode toggle", "page:friends", or a message), a badge variable, and the pages it shows on (empty = all).
struct BarAction {
    let icon: String, does: String
    var badge: String = ""
    var only: [String] = []
}

/// The App Bar's look, from the project: x (your avatar on the left, the app's name on brand pages), title position, buttons, colours.
struct BarStyle {
    var look = "standard", brandPages = ["home"], center = false, avatar = false
    /// The left button (back, else menu · menu · back · none); ☰ or your avatar opens the Side Menu.
    var left = "back, else menu"
    /// The buttons sit in a filled circle ("circles"), a ring ("outlined circles") or nothing ("plain").
    var circles = "plain"
    var actions: [BarAction] = []
    var bg = "@bar", text = "@text", icon = "@text", border = true, size: CGFloat = 19
}

/// The Bottom Nav's style (pill, floating, glass, segmented, dock, minimal…), its colours, when names show (always, selected only,
/// never), the gap around a floating bar, and the icon colour on a solid highlight.
struct NavStyle {
    var style = "pill", bar = "@bar", active = "@accent", idle = "@sub", labels = "always"
    var margin: CGFloat = 14
    var on = "#ffffff"
    var floating: Bool { ["floating", "glass", "segmented", "dock"].contains(style) }
    var pill: Bool { ["pill", "floating", "glass", "bubble", "classic"].contains(style) }
    var solid: Bool { ["segmented", "chips"].contains(style) }
}

/// A row of the Side Menu: a page, a message, a switch for a variable (toggle), a section title or a line.
struct MenuItem {
    let kind: String, label: String
    var icon = "", to = "", badge = ""
}

/// The Side Menu: its header (the signed-in person, or a title, subtitle and picture), rows, footer and colours.
struct SideMenuStyle {
    var side = "left", title = "", subtitle = "", avatar = "", header = "simple"
    var social = false
    var profilePage = "profile"
    var items: [MenuItem] = [], footer: [MenuItem] = []
    var footerText = "", bg = "#151826", text = "#e8eaf2", accent = "#4fa3ff", badge = "#ff3b5c"
    var width: CGFloat = 290
}

/// The editor's own line icons (64 × 64 SVG path data: [stroked, filled]), for the App Bar and Bottom Nav. Set by the app.
var artIcons: [String: [String]] = [:]

/// SVG path data → a Path (M L H V C S Q A Z, absolute and relative; arcs are circles, as in the editor's icons).
func svgPath(_ d: String) -> Path {
    var p = Path(), t: [String] = [], cur = ""
    for ch in d {
        if ch.isLetter { if !cur.isEmpty { t.append(cur); cur = "" }; t.append(String(ch)) }
        else if ch == " " || ch == "," { if !cur.isEmpty { t.append(cur); cur = "" } }
        else if ch == "-" || (ch == "." && cur.contains(".")) { if !cur.isEmpty { t.append(cur) }; cur = String(ch) }
        else { cur.append(ch) }
    }
    if !cur.isEmpty { t.append(cur) }
    var i = 0, cmd: Character = "M"
    var x: CGFloat = 0, y: CGFloat = 0, sx: CGFloat = 0, sy: CGFloat = 0, cx: CGFloat = 0, cy: CGFloat = 0 // the pen, where the shape started, the last control point
    func n() -> CGFloat { defer { i += 1 }; return i < t.count ? CGFloat(Double(t[i]) ?? 0) : 0 }
    while i < t.count {
        if let c = t[i].first, c.isLetter { cmd = c; i += 1 }
        let at = i, rel = cmd.isLowercase, ox: CGFloat = rel ? x : 0, oy: CGFloat = rel ? y : 0
        switch cmd.uppercased() {
        case "M": x = ox + n(); y = oy + n(); p.move(to: CGPoint(x: x, y: y)); sx = x; sy = y; cx = x; cy = y; cmd = rel ? "l" : "L"
        case "L": x = ox + n(); y = oy + n(); p.addLine(to: CGPoint(x: x, y: y)); cx = x; cy = y
        case "H": x = ox + n(); p.addLine(to: CGPoint(x: x, y: y)); cx = x; cy = y
        case "V": y = oy + n(); p.addLine(to: CGPoint(x: x, y: y)); cx = x; cy = y
        case "C":
            let x1 = ox + n(), y1 = oy + n(), x2 = ox + n(), y2 = oy + n(); x = ox + n(); y = oy + n()
            p.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: x2, y: y2)); cx = x2; cy = y2
        case "S":
            let x1 = 2 * x - cx, y1 = 2 * y - cy, x2 = ox + n(), y2 = oy + n(); x = ox + n(); y = oy + n()
            p.addCurve(to: CGPoint(x: x, y: y), control1: CGPoint(x: x1, y: y1), control2: CGPoint(x: x2, y: y2)); cx = x2; cy = y2
        case "Q":
            let x1 = ox + n(), y1 = oy + n(); x = ox + n(); y = oy + n()
            p.addQuadCurve(to: CGPoint(x: x, y: y), control: CGPoint(x: x1, y: y1)); cx = x1; cy = y1
        case "A":
            let r = n(); _ = n(); _ = n(); let large = n() != 0, sweep = n() != 0, x0 = x, y0 = y
            x = ox + n(); y = oy + n(); svgArc(&p, x0, y0, x, y, r, large, sweep); cx = x; cy = y
        case "Z": p.closeSubpath(); x = sx; y = sy; cx = x; cy = y
        default: break
        }
        if i == at && i < t.count && !(t[i].first?.isLetter ?? false) { i += 1 } // (a stray number)
    }
    return p
}

/// An SVG arc (a circle's) from one point to another, by its centre.
func svgArc(_ p: inout Path, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ r0: CGFloat, _ large: Bool, _ sweep: Bool) {
    let dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, d2 = dx * dx + dy * dy
    if d2 == 0 { return }
    let r = max(abs(r0), d2.squareRoot()), k = max(0, (r * r - d2) / d2).squareRoot() * (large == sweep ? -1 : 1)
    let ox = k * dy, oy = -k * dx // the centre, from the middle of the chord
    p.addArc(center: CGPoint(x: ox + (x1 + x2) / 2, y: oy + (y1 + y2) / 2), radius: r, startAngle: .radians(Double(atan2(dy - oy, dx - ox))), endAngle: .radians(Double(atan2(-dy - oy, -dx - ox))), clockwise: !sweep) // (SwiftUI's clockwise is the other way round on screen)
}

/// One of the editor's line icons as a shape (64 × 64, scaled to fit).
struct ArtShape: Shape {
    let d: String
    func path(in rect: CGRect) -> Path { svgPath(d).applying(CGAffineTransform(scaleX: rect.width / 64, y: rect.height / 64)) }
}

/// An App Bar / Bottom Nav icon by its Pocket Engine name: the editor's line icon, or an SF Symbol.
struct BarIcon: View {
    let name: String
    var sf = ""
    var size: CGFloat = 24
    var body: some View {
        if let a = artIcons[name] {
            ZStack {
                ArtShape(d: a[0]).stroke(style: StrokeStyle(lineWidth: 5 * size / 64, lineCap: .round, lineJoin: .round))
                if a.count > 1 && !a[1].isEmpty { ArtShape(d: a[1]).fill() }
            }.frame(width: size, height: size)
        } else {
            Image(systemName: sf.isEmpty ? symbol(name) : sf).font(.system(size: size * 0.8))
        }
    }
}

/// Icon names (as in Pocket Engine) → SF Symbols.
func symbol(_ name: String, on: Bool = false) -> String {
    switch name {
    case "home": return on ? "house.fill" : "house"
    case "search", "explore": return "magnifyingglass"
    case "user", "profile": return on ? "person.fill" : "person"
    case "users", "friends": return "person.2"
    case "chat": return on ? "bubble.left.fill" : "bubble.left"
    case "bell": return "bell"
    case "heart": return on ? "heart.fill" : "heart"
    case "video": return on ? "play.rectangle.fill" : "play.rectangle"
    case "info": return "info.circle"
    case "settings", "gear": return "gearshape"
    case "plus", "add": return "plus"
    case "shop": return "bag"
    case "bookmark": return on ? "bookmark.fill" : "bookmark"
    case "trophy": return "trophy"
    case "edit": return "pencil"
    case "moon": return "moon"
    case "sun": return "sun.max"
    case "menu", "list": return "line.3.horizontal"
    case "star": return "star"
    default: return "circle"
    }
}

// MARK: - Colours (the app's @tokens) for light and dark

struct Palette {
    let c: [String: Color]
    func resolve(_ v: String?) -> Color? {
        guard let v, !v.isEmpty else { return nil }
        let t = v.hasPrefix("@") ? String(v.dropFirst()) : v
        if let col = c[t] { return col }
        let h = v.replacingOccurrences(of: "#", with: "")
        if h.count == 6, let n = UInt32(h, radix: 16) { return Color(hex: n) }
        if v.hasPrefix("rgb") { // rgba(255,255,255,0.1)
            let parts = v.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).filter { !$0.isEmpty }.compactMap { Double($0) }
            if parts.count >= 3 { return Color(red: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255).opacity(parts.count > 3 ? parts[3] : 1) }
        }
        return nil
    }
    var bg: Color { c["bg"]! }
    var card: Color { c["card"]! }
    var text: Color { c["text"]! }
    var sub: Color { c["sub"]! }
    var line: Color { c["line"]! }
    var accent: Color { c["accent"]! }
    var onAccent: Color { c["onAccent"]! }
    var danger: Color { c["danger"]! }
}

extension Color {
    init(hex: UInt32) { self.init(red: Double((hex >> 16) & 255) / 255, green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255) }
}

// MARK: - The app's state

@MainActor
final class AppState: ObservableObject {
    let name: String, home: String, themeSetting: String
    let collections: [Collection], stats: [Stat], tabs: [NavTab]
    let light: Palette, dark: Palette
    let bar: BarStyle, nav: NavStyle
    /// The Side Menu (nil: the app has none), and whether it's open.
    let menu: SideMenuStyle?
    /// Pop-up notifications ("notify Title|text|icon"); nil: the app has none.
    let notify: NotifyStyle?
    @Published var menuOpen = false
    var menuOn: Bool { menu != nil && bar.left != "none" && bar.left != "back" }
    /// The page on screen.
    var currentPage: String { paths[min(tab, paths.count - 1)].last ?? (tabs.isEmpty ? home : tabs[tab].page) }
    @Published var vars: [String: Val] = [:]
    @Published var data: [String: [Row]] = [:]
    @Published var tab = 0
    @Published var paths: [[String]] = [[]]
    @Published var openCollection: String? = nil
    @Published var openId: String? = nil

    init(name: String, home: String, themeSetting: String = "follow the phone", light: Palette, dark: Palette, vars: [String: Val], tabs: [NavTab], collections: [Collection], stats: [Stat], bar: BarStyle = BarStyle(), nav: NavStyle = NavStyle(), menu: SideMenuStyle? = nil, notify: NotifyStyle? = nil) {
        self.name = name; self.home = home; self.themeSetting = themeSetting; self.light = light; self.dark = dark; self.bar = bar; self.nav = nav; self.menu = menu; self.notify = notify
        self.tabs = tabs; self.collections = collections; self.stats = stats; self.vars = vars
        paths = Array(repeating: [], count: max(1, tabs.count))
        load()
    }

    var colorScheme: ColorScheme? {
        if let d = vars["darkMode"] { return d.isOn ? .dark : .light }
        return themeSetting == "dark" ? .dark : themeSetting == "light" ? .light : nil
    }
    func palette(_ scheme: ColorScheme) -> Palette { scheme == .dark ? dark : light }

    // MARK: saving on the phone
    private func load() {
        let d = UserDefaults.standard
        if let raw = d.data(forKey: "pocket.data"), let saved = try? JSONDecoder().decode([String: [Row]].self, from: raw) { data = saved }
        for c in collections where data[c.name] == nil {
            data[c.name] = c.sample.enumerated().map { i, r in blank(c.name).merging(r) { _, b in b }.merging(["_id": .s("s\(i)"), "_at": r["_at"] ?? .n(Double(i))]) { _, b in b } } // (later rows count as newer)
        }
        if let raw = d.data(forKey: "pocket.vars"), let saved = try? JSONDecoder().decode([String: Val].self, from: raw) { vars.merge(saved) { _, b in b } }
        work()
    }
    private func changed() {
        work()
        if let raw = try? JSONEncoder().encode(data) { UserDefaults.standard.set(raw, forKey: "pocket.data") }
        if let raw = try? JSONEncoder().encode(vars) { UserDefaults.standard.set(raw, forKey: "pocket.vars") }
    }
    /// Stats are worked out again whenever the data changes.
    /// Stats, {posts_count}-style counts and the social counts ({unread}, {notifications_unread}, {friend_requests}).
    private func work() {
        let me = (vars["playerHandle"]?.text).flatMap { $0.isEmpty ? nil : $0 } ?? ((vars["playerName"]?.text).flatMap { $0.isEmpty ? nil : $0 } ?? "You").lowercased().replacingOccurrences(of: " ", with: "")
        for c in collections {
            let key = c.name.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: "_")
            vars[key + "_count"] = .n(Double(rows(c.name).count))
        }
        if def("Notifications") != nil { vars["notifications_unread"] = .n(Double(rows("Notifications").filter { $0["to"]?.text == me && !($0["read"]?.isOn ?? false) }.count)) }
        if def("Friends") != nil { vars["friend_requests"] = .n(Double(rows("Friends").filter { $0["status"]?.text != "accepted" && $0["to"]?.text == me }.count)) }
        if def("Messages") != nil && !stats.contains(where: { $0.variable == "unread" }) {
            var read: [String: Double] = [:]
            for r in rows("Reads") where r["handle"]?.text == me { read[r["chat"]?.text ?? ""] = r["at"]?.number ?? 0 }
            vars["unread"] = .n(Double(rows("Messages").filter { $0["handle"]?.text != me && ($0["_at"]?.number ?? 0) > (read[$0["chat"]?.text ?? ""] ?? 0) }.count))
        }
        for s in stats { vars[s.variable] = .n(stat(s.collection, s.how, field: s.field, filter: s.filter)) }
    }

    static func day(_ offset: Int = 0) -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date().addingTimeInterval(Double(offset) * 86_400)) }

    /// A new record's values: each field's default (dates: today).
    func blank(_ name: String) -> Row {
        var out: Row = [:]
        for f in def(name)?.fields ?? [] {
            if let d = f.def, d.text != "" {
                out[f.key] = f.type == "yes/no" ? .b(d.isOn) : ["number", "money", "rating"].contains(f.type) ? .n(d.number ?? 0) : d.text == "today" && f.type == "date" ? .s(AppState.day()) : d
            } else {
                out[f.key] = f.type == "yes/no" ? .b(false) : f.type == "date" ? .s(AppState.day()) : f.type == "choice" ? .s(f.options.first ?? "") : ["number", "money", "rating"].contains(f.type) ? .n(0) : .s("")
            }
        }
        return out
    }

    /// How a value reads: dates as Today / Tomorrow / 3 Mar, money with $, yes/no as ✓.
    func text(_ collection: String?, _ key: String, _ v: Val?) -> String {
        guard let v, v.text != "" else { return "" }
        let f = def(collection ?? "")?.fields.first { $0.key == key }
        switch f?.type {
        case "money":
            let n = v.number ?? 0, a = (abs(n) * 100).rounded() / 100
            return (n < 0 ? "−" : "") + "$" + (a == a.rounded() ? String(Int(a)) : String(format: "%.2f", a))
        case "yes/no": return v.isOn ? "✓" : ""
        case "date":
            let k = String(v.text.prefix(10))
            if k == AppState.day() { return "Today" }
            if k == AppState.day(-1) { return "Yesterday" }
            if k == AppState.day(1) { return "Tomorrow" }
            let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
            guard let d = f.date(from: k) else { return v.text }
            let o = DateFormatter(); o.dateFormat = Calendar.current.component(.year, from: d) == Calendar.current.component(.year, from: Date()) ? "d MMM" : "d MMM yyyy"
            return o.string(from: d)
        default: return v.text
        }
    }

    // MARK: variables and text
    func get(_ k: String) -> Val? { vars[k] }
    func set(_ k: String, _ v: Val) { vars[k] = v; changed() }
    func add(_ k: String, _ by: Double) { set(k, .n((vars[k]?.number ?? 0) + by)) }
    /// "{score} points" → "12 points"; {record_title} is the opened record's title; with a row, {title} is the row's.
    func fill(_ t: String, _ row: Row? = nil, _ collection: String? = nil) -> String {
        var out = "", key = "", inside = false
        for ch in t {
            if ch == "{" { if inside { out += "{" + key }; inside = true; key = ""; continue }
            if ch == "}" && inside {
                inside = false
                if let row, let v = row[key] { out += collection == nil ? v.text : text(collection, key, v) }
                else if key.hasPrefix("record_") { out += text(openCollection, String(key.dropFirst(7)), opened?[String(key.dropFirst(7))]) }
                else if key.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }) { out += vars[key]?.text ?? "" }
                else { out += "{" + key + "}" }
                continue
            }
            if inside { key.append(ch) } else { out.append(ch) }
        }
        return inside ? out + "{" + key : out
    }

    // MARK: data
    func def(_ name: String) -> Collection? { collections.first { $0.name == name } }
    func rows(_ name: String) -> [Row] { data[name] ?? [] }
    var opened: Row? { guard let c = openCollection, let id = openId else { return nil }; return rows(c).first { $0["_id"]?.text == id } }

    /// Rows that pass the filter ("done = no", "amount > 10 and kind = Food"), match the search, in order.
    func query(_ name: String, filter: String = "", search: String = "", sort: String = "newest first") -> [Row] {
        let fields = def(name)?.fields ?? []
        var list = rows(name).filter { passes($0, fill(filter)) }
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        if !q.isEmpty { list = list.filter { r in fields.contains { ["text", "long text", "choice", "icon"].contains($0.type) && (r[$0.key]?.text ?? "").lowercased().contains(q) } } }
        let s = sort.lowercased(), at = { (r: Row) in r["_at"]?.number ?? 0 }
        if s == "newest first" { list.sort { at($0) > at($1) } }
        else if s == "oldest first" { list.sort { at($0) < at($1) } }
        else {
            let desc = s.contains("z-a") || s.contains("high-low")
            let key = (s.components(separatedBy: " (").first ?? s).trimmingCharacters(in: .whitespaces).replacingOccurrences(of: " ", with: "_")
            list.sort { a, b in
                if let x = a[key]?.number, let y = b[key]?.number { return desc ? x > y : x < y }
                let x = a[key]?.text ?? "", y = b[key]?.text ?? ""
                return desc ? x > y : x < y
            }
        }
        return list
    }

    private func passes(_ r: Row, _ filter: String) -> Bool {
        let f = filter.trimmingCharacters(in: .whitespaces)
        if f.isEmpty { return true }
        for part in f.components(separatedBy: " and ") {
            guard let op = ["!=", "≠", ">=", "≥", "<=", "≤", "=", ">", "<"].first(where: { part.contains($0) }) else { continue }
            let bits = part.components(separatedBy: op)
            let key = bits[0].trimmingCharacters(in: .whitespaces).lowercased().replacingOccurrences(of: " ", with: "_")
            let raw = bits.dropFirst().joined(separator: op).trimmingCharacters(in: .whitespaces), v = r[key]
            if raw.lowercased() == "yes" || raw.lowercased() == "no" {
                if (op == "=") != ((v?.isOn ?? false) == (raw.lowercased() == "yes")) { return false }
                continue
            }
            if let want = Double(raw), let a = v?.number {
                let ok: Bool
                switch op { case "=": ok = a == want; case "!=", "≠": ok = a != want; case ">": ok = a > want; case "<": ok = a < want; case ">=", "≥": ok = a >= want; default: ok = a <= want }
                if !ok { return false }
                continue
            }
            let same = (v?.text ?? "").lowercased() == raw.lowercased()
            if (op == "=" && !same) || ((op == "!=" || op == "≠") && same) { return false }
        }
        return true
    }

    func stat(_ name: String, _ how: String, field: String = "", filter: String = "") -> Double {
        let list = query(name, filter: filter, sort: "oldest first")
        if how == "count" { return Double(list.count) }
        let nums = list.map { $0[field]?.number ?? 0 }
        guard !nums.isEmpty else { return 0 }
        let sum = nums.reduce(0, +)
        switch how {
        case "sum": return (sum * 100).rounded() / 100
        case "average": return (sum / Double(nums.count) * 100).rounded() / 100
        case "min": return nums.min() ?? 0
        default: return nums.max() ?? 0
        }
    }

    @discardableResult func addRecord(_ name: String, _ values: Row) -> String {
        let id = "r\(Int(Date().timeIntervalSince1970 * 1_000_000))"
        data[name, default: []].append(blank(name).merging(values) { _, b in b }.merging(["_id": .s(id), "_at": .n(Date().timeIntervalSince1970 * 1000)]) { _, b in b })
        changed()
        return id
    }
    func updateRecord(_ name: String, _ id: String, _ values: Row) {
        guard var list = data[name], let i = list.firstIndex(where: { $0["_id"]?.text == id }) else { return }
        list[i].merge(values) { _, b in b }
        data[name] = list
        changed()
    }
    func deleteRecord(_ name: String, _ id: String) { data[name]?.removeAll { $0["_id"]?.text == id }; changed() }
    func open(_ name: String, _ id: String) { openCollection = name; openId = id }

    // MARK: navigation
    /// A page with a tab switches to that tab; any other page opens on top (Back returns).
    func go(_ page: String) {
        if let i = tabs.firstIndex(where: { $0.page == page }) { tab = i; paths[i] = []; return }
        if page == home && tabs.isEmpty { paths[0] = []; return }
        paths[tab].append(page)
    }
    func back() { if !paths[tab].isEmpty { paths[tab].removeLast() } }

    // MARK: messages
    /// The app's messages (a button's "message" action, App Bar buttons, Side Menu rows): popups, timers and swipe pages hear them with .onReceive.
    let messages = PassthroughSubject<String, Never>()
    /// The pop-up notifications on screen now.
    @Published var toasts: [Toast] = []
    func send(_ message: String) {
        let m = fill(message).trimmingCharacters(in: .whitespaces)
        guard !m.isEmpty else { return }
        messages.send(m)
        guard let n = notify, m == n.listen || m.hasPrefix(n.listen + " ") else { return }
        let parts = m.dropFirst(n.listen.count).trimmingCharacters(in: .whitespaces).components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        let icon = parts.count > 2 && !parts[2].isEmpty ? parts[2] : (n.look == "achievement" ? "🏆" : "")
        let t = Toast(title: parts[0], text: parts.count > 1 ? parts[1] : "", icon: icon)
        toasts.append(t)
        if toasts.count > n.max { toasts.removeFirst(toasts.count - n.max) }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(n.seconds * 1_000_000_000))
            self.toasts.removeAll { $0.id == t.id }
        }
    }

    /// What a button does (the same words as the button's Action in Pocket Engine).
    func run(_ action: String, _ value: Val = .s(""), _ amount: Double = 1) {
        let v = value.text
        switch action {
        case "message": send(v)
        case "go to page": go(v)
        case "go back": back()
        case "set variable": set(v, .n(amount))
        case "add to variable": add(v, amount)
        case "new record": openId = nil; go(v)
        case "edit opened record": go(v)
        case "delete opened record":
            if let c = openCollection, let id = openId { deleteRecord(c, id); openId = nil }
            back()
        default: print("TODO: the \"\(action)\" action (\(v)) has no native version yet")
        }
    }
}

// MARK: - The app shell: tabs (a Bottom Nav) and the pages

struct PocketRoot: View {
    @EnvironmentObject var app: AppState
    let pages: [String: () -> AnyView]

    func page(_ name: String) -> AnyView { pages[name]?() ?? AnyView(Text("No page \(name)")) }

    var body: some View {
        ZStack {
        Group {
            if app.tabs.isEmpty {
                NavigationStack(path: $app.paths[0]) {
                    page(app.home).navigationDestination(for: String.self) { page($0) }
                }
            } else if app.nav.floating {
                // floating styles: the pages, with a rounded bar inset from the edges over them
                ZStack(alignment: .bottom) {
                    ForEach(app.tabs.indices, id: \.self) { i in
                        NavigationStack(path: $app.paths[i]) {
                            page(app.tabs[i].page).navigationDestination(for: String.self) { page($0) }
                                .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 76) }
                        }
                        .opacity(app.tab == i ? 1 : 0).allowsHitTesting(app.tab == i)
                    }
                    if app.paths[min(app.tab, app.paths.count - 1)].isEmpty { FloatingTabBar() }
                }
            } else {
                TabView(selection: $app.tab) {
                    ForEach(app.tabs.indices, id: \.self) { i in
                        let t = app.tabs[i]
                        NavigationStack(path: $app.paths[i]) {
                            page(t.page).navigationDestination(for: String.self) { page($0) }
                        }
                        .tabItem { if app.nav.labels == "never" { Image(systemName: t.icon) } else { Label(t.label, systemImage: t.icon) } } // (minimal: icons only)
                        .badge(t.badge.isEmpty ? 0 : Int(app.get(t.badge)?.number ?? 0))
                        .tag(i)
                    }
                }
            }
        }
        if app.menuOpen && app.menu != nil { PocketDrawer().transition(.move(edge: app.menu?.side == "right" ? .trailing : .leading)) }
        if app.notify != nil { ToastLayer() } // (pop-up notifications over every page)
        }
        .animation(.easeOut(duration: 0.25), value: app.menuOpen)
        .tint(app.light.resolve(app.nav.active) ?? app.light.accent)
        .preferredColorScheme(app.colorScheme)
    }
}

/// The Side Menu over the app: a header, rows that open pages, send messages or switch a variable, and a footer. Tap outside to close.
struct PocketDrawer: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    func close() { app.menuOpen = false }
    @ViewBuilder func row(_ it: MenuItem, _ p: Palette, _ fg: Color, _ acc: Color) -> some View {
        if it.kind == "line" { Divider().background(fg.opacity(0.2)).padding(.horizontal, 8).padding(.vertical, 6) }
        else if it.kind == "section" { Text(it.label.uppercased()).font(.system(size: 12, weight: .heavy)).foregroundColor(fg.opacity(0.55)).padding(.leading, 12).padding(.top, 14).padding(.bottom, 4).frame(maxWidth: .infinity, alignment: .leading) }
        else {
            let n = it.badge.isEmpty ? 0 : Int(app.get(it.badge)?.number ?? 0), on = it.kind == "page" && it.to == app.currentPage
            Button {
                if it.kind == "toggle" { app.set(it.to, .b(!(app.get(it.to)?.isOn ?? false))) }
                else if it.kind == "page" { close(); app.go(it.to) }
                else { close(); app.send(it.to.hasPrefix("msg:") ? String(it.to.dropFirst(4)) : it.to) }
            } label: {
                HStack(spacing: 14) {
                    if !it.icon.isEmpty { BarIcon(name: it.icon, size: 22) }
                    Text(app.fill(it.label)).font(.system(size: 16, weight: .semibold)).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                    if it.kind == "toggle" { Toggle("", isOn: Binding(get: { app.get(it.to)?.isOn ?? false }, set: { app.set(it.to, .b($0)) })).labelsHidden().tint(acc) }
                    else if n > 0 { Text(n > 99 ? "99+" : String(n)).font(.system(size: 11, weight: .heavy)).foregroundColor(.white).padding(.horizontal, 7).padding(.vertical, 2).background(Capsule().fill(p.resolve(app.menu?.badge) ?? p.danger)) }
                }
                .foregroundColor(on ? acc : fg).padding(.horizontal, 12).frame(minHeight: 48)
                .background(RoundedRectangle(cornerRadius: 14).fill(on ? acc.opacity(0.18) : Color.clear))
            }
            .buttonStyle(.plain)
        }
    }
    var body: some View {
        let p = app.palette(scheme), m = app.menu ?? SideMenuStyle(), bg = p.resolve(m.bg) ?? p.card, fg = p.resolve(m.text) ?? p.text, acc = p.resolve(m.accent) ?? p.accent
        ZStack(alignment: m.side == "right" ? .trailing : .leading) {
            Color.black.opacity(0.45).ignoresSafeArea().onTapGesture { close() }
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    HStack { Spacer(); Button { close() } label: { Image(systemName: "xmark").foregroundColor(fg.opacity(0.7)).padding(10) } }
                    if m.header != "none" {
                        if m.social {
                            Button { close(); app.go(m.profilePage) } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Avatar(name: app.meName, seed: app.me, size: 52)
                                    Text(app.meName).font(.system(size: 18, weight: .heavy)).foregroundColor(fg)
                                    Text("@\(app.me)").foregroundColor(fg.opacity(0.65))
                                }.padding(.leading, 10).padding(.bottom, 14)
                            }.buttonStyle(.plain)
                        } else {
                            let tc = m.header == "banner" ? Color.white : fg
                            VStack(alignment: .leading, spacing: 4) {
                                if !m.avatar.isEmpty { if artIcons[m.avatar] != nil { BarIcon(name: m.avatar, size: 34).foregroundColor(tc) } else { Text(m.avatar).font(.system(size: 34)) } }
                                Text(app.fill(m.title)).font(.system(size: 18, weight: .heavy)).foregroundColor(tc)
                                if !m.subtitle.isEmpty { Text(app.fill(m.subtitle)).foregroundColor(tc.opacity(0.65)) }
                            }
                            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 16).fill(m.header == "banner" ? acc : Color.clear)).padding(.bottom, 8)
                        }
                    }
                    ForEach(Array(m.items.enumerated()), id: \.offset) { _, it in row(it, p, fg, acc) }
                    if !m.footer.isEmpty {
                        Divider().background(fg.opacity(0.2)).padding(.vertical, 6)
                        ForEach(Array(m.footer.enumerated()), id: \.offset) { _, it in row(it, p, fg, acc) }
                    }
                    if !m.footerText.isEmpty { Text(app.fill(m.footerText)).font(.system(size: 12)).foregroundColor(fg.opacity(0.5)).padding(.leading, 12).padding(.top, 8) }
                }
                .padding(.horizontal, 8)
            }
            .frame(maxWidth: min(m.width, 330), maxHeight: .infinity)
            .background(bg.ignoresSafeArea())
            .shadow(color: .black.opacity(0.3), radius: 15)
        }
    }
}

/// The Bottom Nav's floating styles: a rounded bar inset from the edges, the editor's icons, a highlight on the open tab.
struct FloatingTabBar: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var body: some View {
        let p = app.palette(scheme), n = app.nav, on = p.resolve(n.active) ?? p.accent, off = p.resolve(n.idle) ?? p.sub, onSolid = p.resolve(n.on) ?? Color.white
        HStack(spacing: 0) {
            ForEach(app.tabs.indices, id: \.self) { i in
                let t = app.tabs[i], sel = app.tab == i, badge = t.badge.isEmpty ? 0 : Int(app.get(t.badge)?.number ?? 0), tint = sel ? (n.solid ? onSolid : on) : off
                Button { app.tab = i } label: {
                    VStack(spacing: 3) {
                        BarIcon(name: t.name, sf: t.icon, size: 24).foregroundColor(tint)
                            .frame(width: 62, height: 30)
                            .background(Capsule().fill(sel && n.pill ? on.opacity(0.22) : Color.clear))
                            .overlay(alignment: .topTrailing) {
                                if badge > 0 { Text(badge > 99 ? "99+" : String(badge)).font(.system(size: 10, weight: .heavy)).foregroundColor(.white).padding(.horizontal, 4).background(Capsule().fill(p.danger)).offset(x: -6, y: -2) }
                            }
                        if n.labels == "always" || (n.labels == "selected only" && sel) { Text(t.label).font(.system(size: 11, weight: .semibold)).foregroundColor(tint).lineLimit(1) }
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 6)
                    .background(RoundedRectangle(cornerRadius: 20).fill(sel && n.solid ? on : Color.clear))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 4).padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 26).fill((p.resolve(n.bar) ?? p.card).opacity(n.style == "glass" ? 0.72 : 1)).shadow(color: .black.opacity(0.35), radius: 11, y: 6))
        .padding(.horizontal, n.margin).padding(.bottom, max(0, n.margin - 8)) // (above the home bar)
    }
}

// MARK: - Building blocks

/// A page: its title in the navigation bar, then what's on it (a list or form fills the rest).
struct PocketPage<Content: View>: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let title: String
    var page = ""
    var scroll = true
    var fab: (action: String, value: Val)? = nil
    @ViewBuilder var content: () -> Content

    var body: some View {
        let p = app.palette(scheme)
        Group {
            if scroll {
                ScrollView { VStack(alignment: .leading, spacing: 12) { content() }.padding(16).padding(.bottom, 80) }
            } else {
                VStack(alignment: .leading, spacing: 12) { content() }.padding(.horizontal, 12).padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(p.bg.ignoresSafeArea())
        .navigationTitle(app.fill(title))
        .navigationBarTitleDisplayMode(.inline)
        .modifier(PocketBar(title: title, page: page))
        .overlay(alignment: .bottomTrailing) {
            if let fab {
                Button { app.run(fab.action, fab.value) } label: {
                    Image(systemName: "plus").font(.title2.bold()).foregroundColor(p.onAccent).frame(width: 60, height: 60).background(Circle().fill(p.accent)).shadow(radius: 6, y: 3)
                }
                .padding(20)
            }
        }
    }
}

/// The project's App Bar: its look (x: your avatar on the left and the app's name on the home page), buttons with badges, colours.
struct PocketBar: ViewModifier {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let title: String, page: String
    func body(content: Content) -> some View {
        let p = app.palette(scheme), b = app.bar, back = !(app.paths[min(app.tab, app.paths.count - 1)].isEmpty)
        let brand = b.look != "standard" && !back && (b.brandPages.isEmpty || b.brandPages.contains(page))
        let ic = p.resolve(b.icon) ?? p.text
        let acts = b.actions.reversed().filter { $0.only.isEmpty || $0.only.contains(page) } // (the first sits at the right edge)
        return content
            .toolbarBackground(p.resolve(b.bg) ?? p.card, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                if brand { ToolbarItem(placement: .principal) { Text(app.name).font(.system(size: 22, weight: .black)).foregroundColor(p.resolve(b.text) ?? p.text) } }
                if b.avatar && !back { ToolbarItem(placement: .navigationBarLeading) { Avatar(name: app.barName.isEmpty ? "?" : app.barName, seed: "?", size: 32).onTapGesture { if app.menuOn { app.menuOpen = true } } } } // (opens the Side Menu)
                else if app.menuOn && !back { ToolbarItem(placement: .navigationBarLeading) { Button { app.menuOpen = true } label: { BarIcon(name: "menu", sf: "line.3.horizontal", size: 22).foregroundColor(ic) } } }
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    ForEach(Array(acts.enumerated()), id: \.offset) { _, a in
                        let n = a.badge.isEmpty ? 0 : Int(app.get(a.badge)?.number ?? 0)
                        Button {
                            if a.does.contains("dark mode") { app.set("darkMode", .b(scheme != .dark)) }
                            else if a.does.hasPrefix("page:") { app.go(String(a.does.dropFirst(5))) }
                            else { app.send(a.does) }
                        } label: {
                            BarIcon(name: a.icon == "theme" ? (scheme == .dark ? "sun" : "moon") : a.icon, size: b.circles == "plain" ? 22 : 18).foregroundColor(ic)
                                .frame(width: 34, height: 34)
                                .background(Circle().fill(b.circles == "circles" ? (scheme == .dark ? Color.white.opacity(0.1) : Color.black.opacity(0.06)) : Color.clear)) // circles behind the buttons, or rings
                                .overlay(Circle().stroke(b.circles == "outlined circles" ? ic.opacity(0.35) : Color.clear, lineWidth: 1.4))
                                .overlay(alignment: .topTrailing) {
                                    if n > 0 { Text(n > 99 ? "99+" : String(n)).font(.system(size: 10, weight: .heavy)).foregroundColor(.white).padding(.horizontal, 4).background(Capsule().fill(p.danger)).offset(x: 8, y: -6) }
                                }
                        }
                    }
                }
            }
    }
}

/// Text with {variables} filled in.
struct PText: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let text: String
    var size: CGFloat = 16
    var weight: Int = 600
    var color: String? = nil
    var align = "left"
    init(_ text: String, size: CGFloat = 16, weight: Int = 600, color: String? = nil, align: String = "left") { self.text = text; self.size = size; self.weight = weight; self.color = color; self.align = align }
    var body: some View {
        let p = app.palette(scheme)
        let w: Font.Weight = weight >= 900 ? .black : weight >= 800 ? .heavy : weight >= 700 ? .bold : weight >= 600 ? .semibold : weight >= 500 ? .medium : .regular
        Text(app.fill(text)).font(.system(size: size, weight: w)).foregroundColor(p.resolve(color) ?? p.text)
            .multilineTextAlignment(align == "center" ? .center : align == "right" ? .trailing : .leading)
            .frame(maxWidth: .infinity, alignment: align == "center" ? .center : align == "right" ? .trailing : .leading)
    }
}

enum Look { case filled, outlined, danger, plain }

struct PButton: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let label: String
    var look: Look = .filled
    var bg: String? = nil, fg: String? = nil, stroke: String? = nil
    var height: CGFloat = 52, radius: CGFloat = 16, size: CGFloat = 17
    let action: () -> Void
    init(_ label: String, look: Look = .filled, bg: String? = nil, fg: String? = nil, stroke: String? = nil, height: CGFloat = 52, radius: CGFloat = 16, size: CGFloat = 17, action: @escaping () -> Void) {
        self.label = label; self.look = look; self.bg = bg; self.fg = fg; self.stroke = stroke; self.height = height; self.radius = radius; self.size = size; self.action = action
    }
    var body: some View {
        let p = app.palette(scheme)
        let f = p.resolve(fg) ?? (look == .filled ? p.onAccent : look == .danger ? p.danger : p.accent)
        let fill = look == .filled ? (p.resolve(bg) ?? p.accent) : look == .plain ? Color.clear : (p.resolve(bg) ?? (look == .danger ? p.card : Color.clear))
        let line = look == .danger ? (p.resolve(stroke) ?? p.danger) : look == .outlined ? (p.resolve(stroke) ?? f) : Color.clear
        Button(action: action) {
            Text(app.fill(label)).font(.system(size: size, weight: .heavy)).lineLimit(1).minimumScaleFactor(0.6).padding(.horizontal, look == .plain ? 2 : 8).frame(maxWidth: .infinity, minHeight: height) // (the words shrink to fit rather than being cut short)
                .foregroundColor(f)
                .background(RoundedRectangle(cornerRadius: radius).fill(fill))
                .overlay(RoundedRectangle(cornerRadius: radius).stroke(line, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
}

/// Where a thing sits in a card (PBox): the anchor (0, ½ or 1 of the width / height), the offset from it, its size and how its text lines up,
/// all in the design's sizes (the card scales them to the phone's width).
struct Pin {
    var fx: CGFloat = 0.5, fy: CGFloat = 0.5, x: CGFloat = 0, y: CGFloat = 0, w: CGFloat = 0, h: CGFloat = 0
    var align = "center"
    var m: CGFloat = -1, wrap: CGFloat = 0
    var cell = -1, cells = 0
    let view: AnyView
    init<V: View>(fx: CGFloat = 0.5, fy: CGFloat = 0.5, x: CGFloat = 0, y: CGFloat = 0, w: CGFloat = 0, h: CGFloat = 0, align: String = "center", m: CGFloat = -1, wrap: CGFloat = 0, cell: Int = -1, cells: Int = 0, @ViewBuilder _ content: () -> V) {
        self.fx = fx; self.fy = fy; self.x = x; self.y = y; self.w = w; self.h = h; self.align = align; self.m = m; self.wrap = wrap; self.cell = cell; self.cells = cells; self.view = AnyView(content())
    }
}

/// A card, badge, picture box or tappable row: its size, colours, corners, its own centred text, and the things in it where the design puts them.
struct PBox: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var w: CGFloat = 368, h: CGFloat = 48, radius: CGFloat = 0
    var fill = "", stroke = ""
    var strokeW: CGFloat = 0
    var shadow = false
    var text = ""
    var textSize: CGFloat = 16
    var textWeight = 600
    var textColor = ""
    var row: CGFloat? = nil
    var onTap: (() -> Void)? = nil
    var pins: [Pin] = []

    /// A pin's left edge and width in a card this wide.
    func frame(_ q: Pin, _ width: CGFloat) -> (CGFloat, CGFloat) {
        let s = width / (w > 0 ? w : 368), px = q.fx * width + q.x * s
        if q.cells > 0, let g = row { let cw = (width - g * s * CGFloat(q.cells - 1)) / CGFloat(q.cells); return (CGFloat(q.cell) * (cw + g * s) + q.m * s, cw - 2 * q.m * s) }
        if q.m >= 0 { return (q.m * s, width - 2 * q.m * s) }
        if q.w > 0 { return (px - q.w * s / 2, q.w * s) }
        if q.align == "left" { let wd = min(q.wrap > 0 ? q.wrap * s : width, width - px - 2); return (px, wd) }
        if q.align == "right" { let wd = min(q.wrap > 0 ? q.wrap * s : width, px - 2); return (px - wd, wd) }
        let half = min(px, width - px) - 2, wd = q.wrap > 0 && q.wrap * s < 2 * half ? q.wrap * s : 2 * half
        return (px - wd / 2, wd)
    }

    var body: some View {
        let p = app.palette(scheme)
        let tw: Font.Weight = textWeight >= 800 ? .heavy : textWeight >= 700 ? .bold : textWeight >= 600 ? .semibold : .regular
        GeometryReader { g in
            ZStack(alignment: .topLeading) {
                if !text.isEmpty { Text(app.fill(text)).font(.system(size: textSize, weight: tw)).foregroundColor(p.resolve(textColor) ?? p.text).multilineTextAlignment(.center).frame(width: g.size.width, height: h) }
                ForEach(pins.indices, id: \.self) { i in
                    let q = pins[i], f = frame(q, g.size.width)
                    q.view
                        .frame(width: max(0, f.1), height: q.h > 0 ? q.h : nil, alignment: q.align == "left" ? .leading : q.align == "right" ? .trailing : .center)
                        .position(x: f.0 + max(0, f.1) / 2, y: q.fy * h + q.y)
                }
            }
        }
        .frame(height: h)
        .background(RoundedRectangle(cornerRadius: radius).fill(p.resolve(fill) ?? Color.clear).shadow(color: shadow ? .black.opacity(0.1) : .clear, radius: 6, y: 3))
        .overlay(RoundedRectangle(cornerRadius: radius).stroke(stroke.isEmpty ? Color.clear : (p.resolve(stroke) ?? p.line), lineWidth: strokeW > 0 ? strokeW : 1))
        .clipShape(RoundedRectangle(cornerRadius: radius))
        .contentShape(Rectangle())
        .onTapGesture { onTap?() }
    }
}

/// A thing narrower than the page on its own line: left, centred or right, as in the design.
struct Place<Content: View>: View {
    var fx: CGFloat = 0.5
    let width: CGFloat
    @ViewBuilder var content: () -> Content
    var body: some View {
        HStack(spacing: 0) {
            if fx > 0.25 { Spacer(minLength: 0) }
            content().frame(maxWidth: width)
            if fx < 0.75 { Spacer(minLength: 0) }
        }
    }
}

/// Room between things.
struct PSpace: View {
    let h: CGFloat
    init(_ h: CGFloat) { self.h = h }
    var body: some View { Color.clear.frame(height: max(0, h - 12)) }
}

/// A bar that fills from a variable (XP, health…).
struct PBar: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var max: Double = 100, height: CGFloat = 12
    var fill = "@accent", bg = "@line"
    var radius: CGFloat = 6
    init(_ variable: String, max: Double = 100, height: CGFloat = 12, fill: String = "@accent", bg: String = "@line", radius: CGFloat = 6) { self.variable = variable; self.max = max; self.height = height; self.fill = fill; self.bg = bg; self.radius = radius }
    var body: some View {
        let p = app.palette(scheme), v = Swift.min(1, Swift.max(0, (app.get(variable)?.number ?? 0) / (max == 0 ? 1 : max)))
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Rectangle().fill(p.resolve(bg) ?? p.line)
                Rectangle().fill(p.resolve(fill) ?? p.accent).frame(width: g.size.width * v)
            }
        }
        .frame(height: height).clipShape(RoundedRectangle(cornerRadius: radius))
    }
}

/// A slider for a number variable.
struct PSlider: View {
    @EnvironmentObject var app: AppState
    let variable: String
    var min: Double = 0, max: Double = 100, step: Double = 1
    init(_ variable: String, min: Double = 0, max: Double = 100, step: Double = 1) { self.variable = variable; self.min = min; self.max = max; self.step = step }
    var body: some View {
        Slider(value: Binding(get: { Swift.min(max, Swift.max(min, app.get(variable)?.number ?? min)) }, set: { app.set(variable, .n($0)) }), in: min...max, step: step > 0 ? step : 1)
    }
}

/// Segmented tabs: pick one (keeps its text, or its position 1, 2, 3…).
struct Segmented: View {
    @EnvironmentObject var app: AppState
    let variable: String, options: [String]
    var index = false
    init(_ variable: String, _ options: [String], index: Bool = false) { self.variable = variable; self.options = options; self.index = index }
    var body: some View {
        Picker("", selection: Binding(get: { app.get(variable)?.text ?? "" }, set: { app.set(variable, index ? .n(Double($0) ?? 1) : .s($0)) })) {
            ForEach(options.indices, id: \.self) { i in Text(options[i]).tag(index ? String(i + 1) : options[i]) }
        }
        .pickerStyle(.segmented)
    }
}

/// Chips: pick one.
struct Chips: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String, options: [String]
    init(_ variable: String, _ options: [String]) { self.variable = variable; self.options = options }
    var body: some View {
        let p = app.palette(scheme), cur = app.get(variable)?.text ?? ""
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.self) { o in
                    Button(o) { app.set(variable, .s(o)) }
                        .font(.subheadline.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 8)
                        .foregroundColor(cur == o ? p.onAccent : p.text)
                        .background(Capsule().fill(cur == o ? p.accent : p.card))
                        .overlay(Capsule().stroke(p.line, lineWidth: cur == o ? 0 : 1))
                }
            }
        }
    }
}

/// A drop-down list: label to value.
struct PDropdown: View {
    @EnvironmentObject var app: AppState
    let variable: String
    let options: [(String, String)]
    var placeholder = "Choose…"
    init(_ variable: String, _ options: [(String, String)], placeholder: String = "Choose…") { self.variable = variable; self.options = options; self.placeholder = placeholder }
    var body: some View {
        Picker(placeholder, selection: Binding(get: { app.get(variable)?.text ?? "" }, set: { app.set(variable, .s($0)) })) {
            Text(placeholder).tag("")
            ForEach(options.indices, id: \.self) { i in Text(options[i].0).tag(options[i].1) }
        }
        .pickerStyle(.menu)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// − number +
struct PStepper: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var min: Double = 0, max: Double = 10, step: Double = 1
    init(_ variable: String, min: Double = 0, max: Double = 10, step: Double = 1) { self.variable = variable; self.min = min; self.max = max; self.step = step }
    var body: some View {
        let p = app.palette(scheme), v = app.get(variable)?.number ?? min
        HStack(spacing: 16) {
            Button { app.set(variable, .n(Swift.max(min, v - step))) } label: { Text("−").font(.title2.bold()).frame(width: 40, height: 40).foregroundColor(p.onAccent).background(Circle().fill(p.accent)) }.buttonStyle(.plain)
            Text(Val.n(v).text).font(.title3.bold()).frame(minWidth: 30)
            Button { app.set(variable, .n(Swift.min(max, v + step))) } label: { Text("+").font(.title2.bold()).frame(width: 40, height: 40).foregroundColor(p.onAccent).background(Circle().fill(p.accent)) }.buttonStyle(.plain)
        }
    }
}

/// Tap a star.
struct PRating: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var max = 5
    init(_ variable: String, max: Int = 5) { self.variable = variable; self.max = max }
    var body: some View {
        let p = app.palette(scheme), v = app.get(variable)?.number ?? 0
        HStack(spacing: 4) {
            ForEach(0..<max, id: \.self) { i in
                Button { app.set(variable, .n(Double(i + 1))) } label: { Text("★").font(.system(size: 30)).foregroundColor(Double(i) < v ? Color(hex: 0xF5B301) : p.line) }.buttonStyle(.plain)
            }
        }
    }
}

/// A thin line, with a word in the middle.
struct PDivider: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var label = ""
    init(_ label: String = "") { self.label = label }
    var body: some View {
        let p = app.palette(scheme)
        HStack(spacing: 10) {
            Rectangle().fill(p.line).frame(height: 1)
            if !label.isEmpty { Text(app.fill(label)).font(.footnote).foregroundColor(p.sub); Rectangle().fill(p.line).frame(height: 1) }
        }
    }
}

/// A notice: info, success, warning or error.
struct PBanner: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var tone = "info", title = "", text = "", icon = ""
    var body: some View {
        let p = app.palette(scheme)
        let bg: Color = tone == "warning" ? Color(hex: 0xFFF4D6) : tone == "error" ? Color(hex: 0xFFE1E1) : tone == "success" ? Color(hex: 0xDDF6E8) : p.accent.opacity(0.14)
        let fg: Color = tone == "warning" ? Color(hex: 0x7A5200) : tone == "error" ? Color(hex: 0x8A1C1C) : tone == "success" ? Color(hex: 0x145C34) : p.text
        HStack(alignment: .top, spacing: 10) {
            if !icon.isEmpty { Text(icon) }
            VStack(alignment: .leading, spacing: 2) {
                if !title.isEmpty { Text(app.fill(title)).bold() }
                if !text.isEmpty { Text(app.fill(text)) }
            }
            Spacer(minLength: 0)
        }
        .foregroundColor(fg).padding(.horizontal, 14).padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 14).fill(bg))
    }
}

/// Level badge, XP bar and xp / needed (each level needs base × growth^(level − 1)).
struct XpBar: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var xpVar = "xp", levelVar = "playerLevel"
    var base: Double = 100, growth: Double = 1.4
    var body: some View {
        let p = app.palette(scheme), lv = Swift.max(1, Int(app.get(levelVar)?.number ?? 1)), xp = app.get(xpVar)?.number ?? 0
        let need = base * pow(growth, Double(lv - 1))
        HStack(spacing: 10) {
            Text("\(lv)").bold().foregroundColor(p.onAccent).frame(width: 30, height: 30).background(Circle().fill(p.accent))
            ProgressView(value: Swift.min(1, xp / need)).tint(p.accent)
            Text("\(Val.n(xp).text) / \(Int(need.rounded()))").font(.subheadline.bold()).foregroundColor(p.sub)
        }
    }
}

/// Numbered steps (the one in the variable is lit).
struct PSteps: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String, steps: [String]
    init(_ variable: String, _ steps: [String]) { self.variable = variable; self.steps = steps }
    var body: some View {
        let p = app.palette(scheme), cur = Swift.max(1, Int(app.get(variable)?.number ?? 1))
        HStack {
            ForEach(steps.indices, id: \.self) { i in
                VStack(spacing: 4) {
                    Text(i + 1 < cur ? "✓" : "\(i + 1)").font(.footnote.bold()).foregroundColor(i + 1 <= cur ? p.onAccent : p.sub).frame(width: 28, height: 28).background(Circle().fill(i + 1 <= cur ? p.accent : p.line))
                    Text(steps[i]).font(.caption).foregroundColor(i + 1 == cur ? p.text : p.sub)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

/// Loading.
struct PSpinner: View { var body: some View { ProgressView().frame(maxWidth: .infinity) } }

/// Your picture: an emoji, or the initials of {playerName}.
struct PAvatar: View {
    @EnvironmentObject var app: AppState
    var emoji = ""
    var size: CGFloat = 64
    var body: some View { Avatar(name: app.meName, seed: app.me, size: size, label: emoji.isEmpty ? nil : emoji).frame(maxWidth: .infinity) }
}

/// A card with things side by side (a settings row, a summary).
struct PCard<Content: View>: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    @ViewBuilder var content: () -> Content
    var body: some View {
        HStack(spacing: 12) { content() }.padding(.horizontal, 16).padding(.vertical, 12).background(RoundedRectangle(cornerRadius: 16).fill(app.palette(scheme).card))
    }
}

/// A text box that edits a variable (search boxes too).
struct VarField: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var placeholder = ""
    var keyboard = "text"
    var outlined = false
    init(_ variable: String, placeholder: String = "", keyboard: String = "text", outlined: Bool = false) { self.variable = variable; self.placeholder = placeholder; self.keyboard = keyboard; self.outlined = outlined }
    var body: some View {
        let text = Binding<String>(get: { app.get(variable)?.text ?? "" }, set: { app.set(variable, keyboard == "number" ? .n(Double($0) ?? 0) : .s($0)) })
        HStack {
            if keyboard == "search" { Image(systemName: "magnifyingglass").foregroundColor(.secondary) }
            if keyboard == "password" { SecureField(placeholder, text: text) } else { TextField(placeholder, text: text).keyboardType(keyboard == "number" ? .decimalPad : keyboard == "email" ? .emailAddress : .default) }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(outlined ? app.palette(scheme).card : Color(.secondarySystemBackground)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(outlined ? app.palette(scheme).line : .clear, lineWidth: 1)) // outlined: a white box with a thin line
    }
}

/// A switch for a yes/no variable (darkMode switches the app's look).
struct VarSwitch: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var label = ""
    init(_ variable: String, label: String = "") { self.variable = variable; self.label = label }
    var body: some View {
        let on = Binding<Bool>(get: { app.get(variable)?.isOn ?? (variable == "darkMode" && scheme == .dark) }, set: { app.set(variable, .b($0)) })
        Toggle(app.fill(label), isOn: on)
    }
}

/// The records of a collection, the way the app draws them: a round tick, the title (struck through when done), the line under it; tap to open, swipe left to delete.
struct RecordList: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let collection: String
    var title = "{title}", subtitle = "", right = "", icon = "", check = "", search = "", filter = "", sort = "newest first", openPage = "", empty = "Nothing here yet"
    var swipeDelete = true
    var rowH: CGFloat = 64, gap: CGFloat = 8, radius: CGFloat = 14
    var doneLook = true

    func row(_ r: Row, _ p: Palette) -> some View {
        let id = r["_id"]?.text ?? "", done = !check.isEmpty && (r[check]?.isOn ?? false)
        return HStack(spacing: 14) {
            if !check.isEmpty {
                Button { app.updateRecord(collection, id, [check: .b(!done)]) } label: {
                    ZStack {
                        Circle().fill(done ? p.accent : Color.clear)
                        Circle().stroke(done ? p.accent : p.sub, lineWidth: 2)
                        if done { Image(systemName: "checkmark").font(.system(size: 13, weight: .heavy)).foregroundColor(.white) }
                    }.frame(width: 28, height: 28)
                }.buttonStyle(.plain)
            } else if !icon.isEmpty { Text(app.fill(icon, r, collection)).font(.title) }
            VStack(alignment: .leading, spacing: 2) {
                Text(app.fill(title, r, collection)).font(.system(size: 16, weight: .bold)).foregroundColor(p.text).strikethrough(done).lineLimit(1)
                if !subtitle.isEmpty { Text(app.fill(subtitle, r, collection)).font(.subheadline.weight(.semibold)).foregroundColor(p.sub).lineLimit(2) }
            }
            Spacer()
            if !right.isEmpty { Text(app.fill(right, r, collection)).bold().foregroundColor(p.sub) }
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .frame(minHeight: rowH)
        .opacity(done && doneLook ? 0.55 : 1)
        .background(RoundedRectangle(cornerRadius: radius).fill(p.card))
        .contentShape(Rectangle())
        .onTapGesture { if !openPage.isEmpty { app.open(collection, id); app.go(openPage) } }
    }

    func delete(_ rows: [Row]) -> (IndexSet) -> Void { { idx in for i in idx { app.deleteRecord(collection, rows[i]["_id"]?.text ?? "") } } }

    var body: some View {
        let p = app.palette(scheme)
        let rows = app.query(collection, filter: filter, search: search.isEmpty ? "" : (app.get(search)?.text ?? ""), sort: sort)
        if rows.isEmpty {
            Text(empty).foregroundColor(p.sub).multilineTextAlignment(.center).frame(maxWidth: .infinity, maxHeight: .infinity).padding(32)
        } else {
            List {
                ForEach(rows, id: \.self) { r in
                    row(r, p)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: gap / 2, leading: 0, bottom: gap / 2, trailing: 0))
                }
                .onDelete(perform: swipeDelete ? delete(rows) : nil)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }
}

enum FormMode { case auto, newRecord, editOpened }

/// A form for a record: adds a new one, or changes the opened one.
struct RecordForm: View {
    @EnvironmentObject var app: AppState
    let collection: String
    var fields: [String] = []
    var mode: FormMode = .auto
    var saveLabel = "Save"
    var after = "go back"
    var page = ""
    @State var values: Row = [:]
    @State var texts: [String: String] = [:]
    @State var editing = false
    @State var ready = false

    var shown: [Field] {
        let all = app.def(collection)?.fields ?? []
        return fields.isEmpty ? all : fields.compactMap { k in all.first { $0.key == k } }
    }
    static func today() -> String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date()) }

    var body: some View {
        Form {
            ForEach(shown, id: \.key) { f in
                Section(f.name) { input(f) }
            }
            Section { PButton(saveLabel) { save() }.listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
        }
        .onAppear {
            guard !ready else { return }
            ready = true
            editing = mode == .editOpened || (mode == .auto && app.opened != nil && app.openCollection == collection)
            let o = editing ? app.opened : nil
            for f in shown {
                let v: Val? = o?[f.key] ?? (f.def == .s("today") ? .s(RecordForm.today()) : f.def)
                values[f.key] = v ?? (f.type == "yes/no" ? .b(false) : nil)
                texts[f.key] = v?.text ?? ""
            }
        }
    }

    @ViewBuilder func input(_ f: Field) -> some View {
        switch f.type {
        case "yes/no":
            Toggle(f.name, isOn: Binding(get: { values[f.key]?.isOn ?? false }, set: { values[f.key] = .b($0) }))
        case "choice":
            Picker(f.name, selection: Binding(get: { values[f.key]?.text ?? "" }, set: { values[f.key] = .s($0) })) {
                ForEach(f.options, id: \.self) { Text($0).tag($0) }
            }
        case "date":
            DatePicker(f.name, selection: Binding(get: {
                let fm = DateFormatter(); fm.dateFormat = "yyyy-MM-dd"; return fm.date(from: values[f.key]?.text ?? "") ?? Date()
            }, set: { d in let fm = DateFormatter(); fm.dateFormat = "yyyy-MM-dd"; values[f.key] = .s(fm.string(from: d)) }), displayedComponents: .date)
        case "long text":
            TextEditor(text: Binding(get: { texts[f.key] ?? "" }, set: { texts[f.key] = $0 })).frame(minHeight: 110)
        default:
            TextField(f.name, text: Binding(get: { texts[f.key] ?? "" }, set: { texts[f.key] = $0 })).keyboardType(["number", "money"].contains(f.type) ? .decimalPad : .default)
        }
    }

    func save() {
        for f in shown where !["yes/no", "choice", "date"].contains(f.type) {
            let t = texts[f.key] ?? ""
            values[f.key] = ["number", "money"].contains(f.type) ? .n(Double(t) ?? 0) : .s(t)
        }
        if editing, let id = app.openId { app.updateRecord(collection, id, values) } else { app.addRecord(collection, values) }
        switch after {
        case "clear the form": texts = [:]
        case "go to page": app.go(page)
        case "stay": break
        default: app.back()
        }
    }
}

/// A plain list of lines.
struct StaticList: View {
    @EnvironmentObject var app: AppState
    let items: [String]
    init(_ items: [String]) { self.items = items }
    var body: some View { VStack(alignment: .leading, spacing: 10) { ForEach(items, id: \.self) { Text(app.fill($0)) } } }
}

/// A picture from the web.
struct PImage: View {
    let url: String
    var height: CGFloat = 160
    init(_ url: String, height: CGFloat = 160) { self.url = url; self.height = height }
    var body: some View {
        AsyncImage(url: URL(string: url)) { $0.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.2) }
            .frame(height: height).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

/// A Pocket component with no native version yet: shows where it goes.
struct TodoBox: View {
    let name: String, type: String
    init(_ name: String, _ type: String) { self.name = name; self.type = type }
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "hammer").foregroundColor(.secondary)
            Text(name).bold()
            Text("\(type): to build natively").font(.footnote).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity).padding(20)
        .background(RoundedRectangle(cornerRadius: 16).stroke(Color.secondary.opacity(0.4), lineWidth: 2))
    }
}

// MARK: - Social building blocks
// A feed, a composer, stories, messages, profiles, a marketplace, notifications… They read and change the same
// data collections as the app (Posts, Messages, Stories, Listings, Profiles…).

extension Dictionary where Key == String, Value == Val {
    func s(_ k: String) -> String { self[k]?.text ?? "" }
    func on(_ k: String) -> Bool { self[k]?.isOn ?? false }
    func n(_ k: String) -> Double { self[k]?.number ?? 0 }
}

extension AppState {
    /// You: {playerName} and {playerHandle}; no name yet → “You”, @you (the same as the editor).
    var meName: String { let n = get("playerName")?.text ?? ""; return n.isEmpty ? "You" : n }
    /// The name on the App Bar's avatar: “Me” until there is a playerName variable, then the name (blank shows “?”).
    var barName: String { vars["playerName"] == nil ? "Me" : (get("playerName")?.text ?? "") }
    var me: String { let h = get("playerHandle")?.text ?? ""; return h.isEmpty ? meName.lowercased().replacingOccurrences(of: " ", with: "") : h }
    /// Opens a person's profile page (it shows {profile} and {profile_name}).
    func openProfile(_ page: String, _ handle: String, _ name: String) {
        guard !page.isEmpty else { return }
        vars["profile"] = .s(handle)
        vars["profile_name"] = .s(name)
        go(page)
    }
    /// The latest message of each chat, newest first.
    func latestChats(_ collection: String) -> [Row] {
        var seen = Set<String>(), out: [Row] = []
        for r in query(collection) where !r.s("chat").isEmpty && !seen.contains(r.s("chat")) { seen.insert(r.s("chat")); out.append(r) }
        return out
    }
    /// The name to show for a chat: the other person in it.
    func chatName(_ collection: String, _ id: String) -> String {
        if let r = rows(collection).first(where: { $0.s("chat") == id && $0.s("handle") != me }) { return r.s("author") }
        let who = id.replacingOccurrences(of: "dm-", with: "").split(separator: "-").map(String.init).filter { $0 != me }.joined(separator: ", ")
        return who.isEmpty ? id : who
    }
}

// the engine's avatar colours and initials (Maya Chen → MC)
private let avatarColors: [UInt32] = [0xEF5350, 0xEC407A, 0xAB47BC, 0x7E57C2, 0x5C6BC0, 0x42A5F5, 0x26A69A, 0x66BB6A, 0xFFA726, 0x8D6E63]
func avatarColor(_ s: String) -> Color {
    var n: UInt32 = 0
    for c in (s.isEmpty ? "?" : s).utf16 { n = n &* 31 &+ UInt32(c) }
    return Color(hex: avatarColors[Int(n % UInt32(avatarColors.count))])
}
func initials(_ s: String) -> String {
    let w = s.split(whereSeparator: { $0 == " " || $0 == "\n" }).prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
    return w.isEmpty ? "?" : w
}
func mediaList(_ m: String) -> [String] { m.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
func firstMedia(_ m: String) -> String { mediaList(m).first ?? "" }
func isUrl(_ s: String) -> Bool { s.hasPrefix("http:") || s.hasPrefix("https:") }
func hexColor(_ v: String) -> Color? { v.count == 7 && v.hasPrefix("#") ? UInt32(v.dropFirst(), radix: 16).map { Color(hex: $0) } : nil }
func colorOf(_ r: Row, _ seed: String, _ p: Palette) -> Color { hexColor(r.s("color")) ?? avatarColor(seed) }
/// 1284 → 1.3K, 48200 → 48K.
func compactNum(_ n: Double) -> String {
    func one(_ x: Double) -> String { let r = (x * 10).rounded() / 10; return r == r.rounded() ? String(Int(r)) : String(r) }
    return n < 1000 ? String(Int(n.rounded())) : n < 10_000 ? one(n / 1000) + "K" : n < 1e6 ? String(Int((n / 1000).rounded())) + "K" : one(n / 1e6) + "M"
}
/// 9m, 2h, 3d, then the date.
func ago(_ at: Double) -> String {
    guard at > 1e11 else { return "" }
    let s = Date().timeIntervalSince1970 - at / 1000
    if s < 60 { return "now" }
    if s < 3600 { return "\(Int(s / 60))m" }
    if s < 86400 { return "\(Int(s / 3600))h" }
    if s < 604_800 { return "\(Int(s / 86400))d" }
    let f = DateFormatter(); f.dateFormat = "MMM d"; return f.string(from: Date(timeIntervalSince1970: at / 1000))
}
/// The colours of a CSS gradient ("linear-gradient(135deg,#f58529,#dd2a7b)").
func gradientColors(_ bg: String) -> [Color] {
    var out: [Color] = [], rest = Substring(bg)
    while let i = rest.firstIndex(of: "#") {
        let hex = String(rest[i...].prefix(7))
        if let c = hexColor(hex) { out.append(c) }
        rest = rest[rest.index(after: i)...]
    }
    return out
}
/// Text with #hashtags and @mentions in the accent colour.
func richText(_ s: String, _ accent: Color, _ ink: Color) -> Text {
    var out = Text(""), word = "", tag = false
    func flush() { if !word.isEmpty { out = out + Text(word).foregroundColor(tag ? accent : ink); word = "" } }
    for ch in s {
        if ch == "#" || ch == "@" { flush(); tag = true }
        else if tag && !(ch.isLetter || ch.isNumber || ch == "_") { flush(); tag = false }
        word.append(ch)
    }
    flush()
    return out
}

struct Avatar: View {
    let name: String, seed: String
    var size: CGFloat = 40
    var label: String? = nil
    var body: some View {
        Text(label ?? initials(name.isEmpty ? seed : name))
            .font(.system(size: size * (label == nil ? 0.38 : 0.5), weight: .heavy)).foregroundColor(.white)
            .frame(width: size, height: size).background(Circle().fill(avatarColor(name.isEmpty ? seed : name)))
    }
}

/// A picture: a photo from the web, or an emoji on a colour.
struct Tile: View {
    let media: String, color: Color
    var height: CGFloat = 200
    var body: some View {
        if isUrl(media) {
            AsyncImage(url: URL(string: media)) { $0.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.2) }
                .frame(maxWidth: .infinity).frame(height: height).clipped()
        } else {
            Text(media).font(.system(size: min(height, 150) * 0.42)).frame(maxWidth: .infinity).frame(height: height).background(color)
        }
    }
}

/// A post's first picture (rounded).
struct Media: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let row: Row
    var height: CGFloat = 200
    var radius: CGFloat = 12
    var body: some View {
        let m = firstMedia(row.s("media"))
        if !m.isEmpty { Tile(media: m, color: colorOf(row, row.s("handle") + m, app.palette(scheme)), height: height).clipShape(RoundedRectangle(cornerRadius: radius)) }
    }
}

/// 1 to 4 pictures, laid out like the app's feed: one big, two side by side, one big and two stacked, two by two.
struct MediaGrid: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let row: Row
    var height: CGFloat = 220
    var body: some View {
        let p = app.palette(scheme), l = Array(mediaList(row.s("media")).prefix(4))
        if !l.isEmpty {
            let bg = colorOf(row, row.s("handle") + l[0], p), half = height / 2 - 1
            Group {
                if l.count == 1 { Tile(media: l[0], color: bg, height: height) }
                else if l.count == 2 { HStack(spacing: 2) { Tile(media: l[0], color: bg, height: height); Tile(media: l[1], color: bg, height: height) } }
                else if l.count == 3 { HStack(spacing: 2) { Tile(media: l[0], color: bg, height: height); VStack(spacing: 2) { Tile(media: l[1], color: bg, height: half); Tile(media: l[2], color: bg, height: half) } } }
                else { HStack(spacing: 2) { VStack(spacing: 2) { Tile(media: l[0], color: bg, height: half); Tile(media: l[2], color: bg, height: half) }; VStack(spacing: 2) { Tile(media: l[1], color: bg, height: half); Tile(media: l[3], color: bg, height: half) } } }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(p.line, lineWidth: 1))
        }
    }
}

struct EmptyNote: View {
    let text: String
    var body: some View { Text(text).foregroundColor(.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(32) }
}

/// A tab on top of a feed: its name and which posts it shows (following, saved, media, replies, posts, likes, or a filter).
struct FeedTab {
    let label: String
    var only = "", look = ""
    init(_ label: String, _ only: String = "", _ look: String = "") { self.label = label; self.only = only; self.look = look }
}

/// Posts, newest first, the way the app draws them (X style): avatar, name ✓ @handle · 9m, text with #tags, pictures, and
/// comment / repost / like / views / save / share. Tap the author for their profile. look: timeline, reels or grid.
struct SocialFeed: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Posts", look = "timeline", filter = "", search = ""
    var columns = 3
    var profilePage = "", empty = "No posts yet"
    var tabs: [FeedTab] = []
    var actions = ["comment", "repost", "like", "share"]
    @State var tab = 0

    func toggle(_ r: Row, _ flag: String, _ count: String? = nil) {
        let now = !r.on(flag)
        var change: Row = [flag: .b(now)]
        if let count { change[count] = .n(max(0, r.n(count) + (now ? 1 : -1))) }
        app.updateRecord(collection, r.s("_id"), change)
    }

    /// A tab's test, or nil when "only" is a filter for the query.
    func test(_ only: String) -> ((Row) -> Bool)? {
        let me = app.me
        switch only.trimmingCharacters(in: .whitespaces).lowercased() {
        case "": return { _ in true }
        case "following":
            let f = Set(app.rows("Follows").filter { $0.s("follower") == me }.map { $0.s("followee") })
            return { f.contains($0.s("handle")) || $0.on("following") }
        case "saved": return { $0.on("saved") }
        case "media": return { !firstMedia($0.s("media")).isEmpty }
        case "replies": return { !$0.s("reply_to").isEmpty }
        case "posts": return { $0.s("reply_to").isEmpty }
        case "likes": return { $0.on("liked") }
        default: return nil
        }
    }

    func action(_ icon: String, _ count: String, _ lit: Bool, _ color: Color, grow: Bool = true, _ tap: (() -> Void)? = nil) -> some View {
        let p = app.palette(scheme)
        return Button { tap?() } label: {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.system(size: 16))
                if !count.isEmpty { Text(count).font(.system(size: 13.5)).lineLimit(1) }
            }
            .foregroundColor(lit ? color : p.sub)
            .padding(.vertical, 8)
            .frame(maxWidth: grow ? CGFloat.infinity : nil, alignment: .leading)
        }
        .buttonStyle(.plain)
    }

    func buttons(_ r: Row) -> some View {
        let p = app.palette(scheme)
        return HStack(spacing: 10) {
            ForEach(actions, id: \.self) { a in
                switch a {
                case "comment": action("bubble.left", compactNum(r.n("comments")), false, p.accent)
                case "repost": action("arrow.2.squarepath", compactNum(r.n("reposts")), r.on("reposted"), Color(hex: 0x00BA7C)) { toggle(r, "reposted", "reposts") }
                case "like": action(r.on("liked") ? "heart.fill" : "heart", compactNum(r.n("likes")), r.on("liked"), Color(hex: 0xF91880)) { toggle(r, "liked", "likes") }
                case "views": action("chart.bar", compactNum(r.n("views")), false, p.accent)
                case "save": action(r.on("saved") ? "bookmark.fill" : "bookmark", "", r.on("saved"), p.accent, grow: false) { toggle(r, "saved") }
                case "share": action("square.and.arrow.up", "", false, p.accent, grow: false)
                default: EmptyView()
                }
            }
        }
    }

    func post(_ r: Row) -> some View {
        let p = app.palette(scheme)
        let grad = firstMedia(r.s("media")).isEmpty ? gradientColors(r.s("background")) : []
        let sub = ["@" + r.s("handle"), ago(r.n("_at")), r.s("location").isEmpty ? "" : "📍 " + r.s("location")].filter { !$0.isEmpty }.joined(separator: " · ")
        return VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Button { app.openProfile(profilePage, r.s("handle"), r.s("author")) } label: { Avatar(name: r.s("author"), seed: r.s("handle"), size: 46) }.buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 4) {
                        Text(r.s("author")).font(.system(size: 16, weight: .heavy)).foregroundColor(p.text).lineLimit(1).layoutPriority(1)
                        if r.on("verified") { Image(systemName: "checkmark.seal.fill").font(.system(size: 15)).foregroundColor(p.accent) }
                        Text(sub).foregroundColor(p.sub).lineLimit(1)
                        Spacer(minLength: 0)
                        Image(systemName: "ellipsis").foregroundColor(p.sub)
                    }
                    .onTapGesture { app.openProfile(profilePage, r.s("handle"), r.s("author")) }
                    if !grad.isEmpty {
                        Text(r.s("text")).font(.system(size: 22, weight: .heavy)).foregroundColor(.white).multilineTextAlignment(.center).padding(18)
                            .frame(maxWidth: .infinity, minHeight: 150)
                            .background(LinearGradient(colors: grad.count > 1 ? grad : [grad[0], grad[0]], startPoint: .topLeading, endPoint: .bottomTrailing))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    } else if !r.s("text").isEmpty {
                        richText(r.s("text"), p.accent, p.text).font(.system(size: 16))
                    }
                    if !r.s("poll").isEmpty {
                        ForEach(r.s("poll").components(separatedBy: "|"), id: \.self) { o in
                            Text(o.trimmingCharacters(in: .whitespaces)).bold().foregroundColor(p.accent).frame(maxWidth: .infinity).padding(.vertical, 7).overlay(Capsule().stroke(p.accent, lineWidth: 1))
                        }
                    }
                    if !r.s("link").isEmpty {
                        VStack(alignment: .leading) {
                            Text(r.s("link_title").isEmpty ? r.s("link") : r.s("link_title")).bold().foregroundColor(p.text)
                            Text(URL(string: r.s("link"))?.host ?? "").foregroundColor(p.sub)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(10).overlay(RoundedRectangle(cornerRadius: 14).stroke(p.line, lineWidth: 1))
                    }
                    if !firstMedia(r.s("media")).isEmpty { MediaGrid(row: r) }
                    buttons(r)
                }
            }
            .padding(.horizontal, 14).padding(.top, 12)
            Divider().overlay(p.line)
        }
    }

    func reel(_ r: Row) -> some View {
        let p = app.palette(scheme)
        return VStack(alignment: .leading, spacing: 8) {
            Button { app.openProfile(profilePage, r.s("handle"), r.s("author")) } label: {
                HStack(spacing: 10) {
                    Avatar(name: r.s("author"), seed: r.s("handle"))
                    VStack(alignment: .leading) { Text(r.s("author")).bold().foregroundColor(p.text); Text("@" + r.s("handle")).foregroundColor(p.sub) }
                    Spacer()
                }
            }.buttonStyle(.plain)
            if firstMedia(r.s("media")).isEmpty { Text(r.s("text")).foregroundColor(p.text) } else { Media(row: r, height: 380) }
            buttons(r)
        }
        .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(p.card)).padding(.horizontal, 16)
    }

    var body: some View {
        let p = app.palette(scheme)
        let t: FeedTab? = tabs.isEmpty ? nil : tabs[min(max(tab, 0), tabs.count - 1)]
        let pass = t.flatMap { test($0.only) }
        let filters = [filter, t != nil && pass == nil ? t!.only : ""].filter { !$0.isEmpty }.joined(separator: " and ")
        let rows = app.query(collection, filter: filters, search: search.isEmpty ? "" : (app.get(search)?.text ?? "")).filter { pass?($0) ?? true }
        let shown = (t?.look.isEmpty ?? true) ? look : t!.look
        VStack(spacing: 0) {
            if tabs.count > 1 {
                HStack(spacing: 0) {
                    ForEach(tabs.indices, id: \.self) { i in
                        Button { tab = i } label: {
                            VStack(spacing: 10) {
                                Text(tabs[i].label).font(.system(size: 15, weight: .bold)).foregroundColor(i == tab ? p.text : p.sub)
                                Capsule().fill(i == tab ? p.accent : Color.clear).frame(width: 48, height: 4)
                            }
                            .padding(.top, 14).frame(maxWidth: .infinity)
                        }.buttonStyle(.plain)
                    }
                }
                Divider().overlay(p.line)
            }
            if rows.isEmpty {
                EmptyNote(text: empty)
            } else if shown == "grid" {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: max(1, columns)), spacing: 4) {
                    ForEach(rows, id: \.self) { r in
                        Button { app.openProfile(profilePage, r.s("handle"), r.s("author")) } label: {
                            if firstMedia(r.s("media")).isEmpty { Text(r.s("text")).font(.caption.bold()).foregroundColor(.white).lineLimit(4).padding(6).frame(maxWidth: .infinity, minHeight: 120).background(avatarColor(r.s("author"))) }
                            else { Media(row: r, height: 120, radius: 6) }
                        }.buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            } else if shown == "reels" {
                VStack(spacing: 10) { ForEach(rows, id: \.self) { reel($0) } }
            } else {
                VStack(spacing: 0) { ForEach(rows, id: \.self) { post($0) } }
            }
        }
        .padding(.horizontal, -16) // edge to edge, out of the page's side margins
    }
}

/// A text box with a button (the composer and the chat).
struct SendBox: View {
    @Environment(\.colorScheme) var scheme
    @EnvironmentObject var app: AppState
    let placeholder: String, button: String
    var card = true, avatar = false
    let send: (String) -> Void
    @State var text = ""
    var body: some View {
        let p = app.palette(scheme)
        HStack(spacing: 10) {
            if avatar { Avatar(name: app.meName, seed: app.me) }
            TextField(placeholder, text: $text).padding(10).background(RoundedRectangle(cornerRadius: card ? 12 : 22).fill(Color(.secondarySystemBackground))).onSubmit(go)
            Button(button, action: go).font(.body.weight(.heavy)).padding(.horizontal, 16).padding(.vertical, 10).foregroundColor(p.onAccent).background(Capsule().fill(p.accent))
        }
        .padding(card ? 8 : 0).background(RoundedRectangle(cornerRadius: 16).fill(card ? p.card : Color.clear))
    }
    func go() {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        send(t)
        text = ""
    }
}

/// A box to write a post: Post adds it to the top of the feed.
struct Composer: View {
    @EnvironmentObject var app: AppState
    var collection = "Posts", placeholder = "What’s happening?"
    var body: some View {
        SendBox(placeholder: placeholder, button: "Post", card: false, avatar: true) { t in
            app.addRecord(collection, ["author": .s(app.meName), "handle": .s(app.me), "text": .s(t)])
        }
    }
}

/// Story circles, one per person (newest first), "Your story" first; tap one to see it.
struct Stories: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Stories"
    var yours = true
    @State var open: Row? = nil
    /// One story per person (their newest), not mine.
    func people() -> [Row] {
        var seen = Set<String>(), out: [Row] = []
        for r in app.query(collection) where r.s("handle") != app.me {
            let k = r.s("handle").isEmpty ? r.s("author") : r.s("handle")
            if !seen.contains(k) { seen.insert(k); out.append(r) }
        }
        return out
    }
    var body: some View {
        let p = app.palette(scheme), me = app.me, rows = people()
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 14) {
                if yours {
                    VStack(spacing: 4) {
                        Avatar(name: app.meName, seed: me, size: 62).padding(3)
                            .overlay(alignment: .bottomTrailing) { Image(systemName: "plus").font(.system(size: 11, weight: .heavy)).foregroundColor(.white).frame(width: 22, height: 22).background(Circle().fill(p.accent)).overlay(Circle().stroke(p.bg, lineWidth: 2)) }
                        Text("Your story").font(.system(size: 12, weight: .bold)).foregroundColor(p.text)
                    }
                }
                ForEach(rows, id: \.self) { r in
                    let m = firstMedia(r.s("media"))
                    Button { open = r } label: {
                        VStack(spacing: 4) {
                            Group {
                                if m.isEmpty || isUrl(m) { Avatar(name: r.s("author"), seed: r.s("handle"), size: 58) }
                                else { Text(m).font(.system(size: 27)).frame(width: 58, height: 58).background(Circle().fill(colorOf(r, r.s("author"), p))) }
                            }
                            .padding(2).background(Circle().fill(p.bg)).padding(3)
                            .background(Circle().fill(LinearGradient(colors: [.orange, .pink, .purple], startPoint: .bottomLeading, endPoint: .topTrailing)))
                            Text(r.s("author").components(separatedBy: " ").first ?? "").font(.system(size: 12, weight: .bold)).foregroundColor(p.text)
                        }
                    }.buttonStyle(.plain)
                }
            }.padding(.vertical, 2)
        }
        .sheet(isPresented: Binding(get: { open != nil }, set: { if !$0 { open = nil } })) {
            if let r = open {
                VStack(spacing: 20) {
                    Text(r.s("author")).font(.title3.bold())
                    Spacer()
                    Text(firstMedia(r.s("media"))).font(.system(size: 110))
                    Spacer()
                    Text(r.s("text")).multilineTextAlignment(.center)
                }
                .foregroundColor(.white).padding(24).frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(colorOf(r, r.s("author"), p).ignoresSafeArea())
                .onTapGesture { open = nil }
            }
        }
    }
}

/// Conversations, latest first: tap one to open it on the chat page.
struct Inbox: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Messages", openPage = "chat"
    var body: some View {
        let p = app.palette(scheme)
        let latest = app.latestChats(collection)
        if latest.isEmpty {
            EmptyNote(text: "No messages yet")
        } else {
            VStack(spacing: 8) {
                ForEach(latest, id: \.self) { r in
                    let name = app.chatName(collection, r.s("chat"))
                    Button { app.vars["chat"] = .s(r.s("chat")); app.vars["chatTitle"] = .s(name); app.go(openPage) } label: {
                        HStack(spacing: 12) {
                            Avatar(name: name, seed: name, size: 46)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(name).bold().foregroundColor(p.text)
                                Text((r.s("handle") == app.me ? "You: " : "") + r.s("text")).foregroundColor(p.sub).lineLimit(1)
                            }
                            Spacer()
                        }
                        .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(p.card))
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}

/// The messages of the open chat ({chat}), and a box to send one.
struct Chat: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Messages"
    var body: some View {
        let p = app.palette(scheme), id = app.get("chat")?.text ?? ""
        let rows = app.query(collection, sort: "oldest first").filter { $0.s("chat") == id }
        VStack(spacing: 6) {
            if rows.isEmpty { EmptyNote(text: "Say hello 👋") }
            ForEach(rows, id: \.self) { r in
                let mine = r.s("handle") == app.me
                HStack {
                    if mine { Spacer(minLength: 60) }
                    Text(r.s("text")).padding(.horizontal, 12).padding(.vertical, 8).foregroundColor(mine ? p.onAccent : p.text)
                        .background(RoundedRectangle(cornerRadius: 18).fill(mine ? p.accent : p.card))
                    if !mine { Spacer(minLength: 60) }
                }
            }
            SendBox(placeholder: "Message", button: "Send") { t in
                if !id.isEmpty { app.addRecord(collection, ["chat": .s(id), "author": .s(app.meName), "handle": .s(app.me), "text": .s(t)]) }
            }
            .padding(.top, 4)
        }
    }
}

/// A profile header: cover, picture, name, @handle, bio and counts.
struct ProfileHeader: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var name = "{playerName}", handle = "{playerHandle}", bio = ""
    var stats: [(String, String)] = []
    var cover = "@accent"
    var body: some View {
        let p = app.palette(scheme), n = app.fill(name), h = app.fill(handle)
        let own: Row = ["points": .n(app.get("points")?.number ?? 0)]
        VStack(spacing: 4) {
            Rectangle().fill(p.resolve(cover) ?? p.accent).frame(height: 80)
            Avatar(name: n, seed: h, size: 76).overlay(Circle().stroke(p.card, lineWidth: 3)).padding(.top, -38)
            Text(n).font(.title2.bold()).foregroundColor(p.text)
            Text("@" + h).foregroundColor(p.sub)
            if !bio.isEmpty { Text(app.fill(bio)).multilineTextAlignment(.center).foregroundColor(p.text).padding(.horizontal, 12) }
            if !stats.isEmpty {
                HStack(spacing: 24) {
                    ForEach(Array(stats.enumerated()), id: \.offset) { _, s in
                        VStack { Text(app.fill(s.1, own)).bold().foregroundColor(p.text); Text(s.0).font(.caption).foregroundColor(p.sub) }
                    }
                }.padding(.top, 6)
            }
        }
        .padding(.bottom, 14).frame(maxWidth: .infinity)
        .background(p.card).clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

/// Things for sale in a grid: tap one for its details and to message the seller.
struct Marketplace: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Listings", chatPage = ""
    @State var open: Row? = nil
    static func price(_ r: Row) -> String { Double(r.s("price")) != nil ? "$" + r.s("price") : r.s("price") }
    var body: some View {
        let p = app.palette(scheme), rows = app.query(collection)
        if rows.isEmpty {
            EmptyNote(text: "Nothing for sale yet")
        } else {
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(rows, id: \.self) { r in
                    Button { open = r } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Media(row: r, height: 120)
                            Text(Marketplace.price(r) + (r.on("sold") ? " · Sold" : "")).bold().foregroundColor(p.text)
                            Text(r.s("title")).lineLimit(1).foregroundColor(p.text)
                            Text(r.s("location")).font(.caption).lineLimit(1).foregroundColor(p.sub)
                        }
                        .padding(6).background(RoundedRectangle(cornerRadius: 14).fill(p.card))
                    }.buttonStyle(.plain)
                }
            }
            .sheet(isPresented: Binding(get: { open != nil }, set: { if !$0 { open = nil } })) {
                if let r = open { details(r).presentationDetents([.medium, .large]) }
            }
        }
    }
    func details(_ r: Row) -> some View {
        let info = [r.s("condition"), r.s("location"), r.s("seller").isEmpty ? "" : "Seller: " + r.s("seller")].filter { !$0.isEmpty }.joined(separator: " · ")
        return VStack(alignment: .leading, spacing: 8) {
            Media(row: r, height: 150)
            Text(r.s("title")).font(.title3.bold())
            Text(Marketplace.price(r)).font(.title.bold())
            Text(info).foregroundColor(.secondary)
            if !r.s("description").isEmpty { Text(r.s("description")) }
            Spacer()
            if !chatPage.isEmpty && r.s("handle") != app.me {
                PButton("Message seller") {
                    open = nil
                    app.vars["chat"] = .s("dm-" + [app.me, r.s("handle")].sorted().joined(separator: "-"))
                    app.vars["chatTitle"] = .s(r.s("seller").isEmpty ? r.s("handle") : r.s("seller"))
                    app.go(chatPage)
                }
            }
        }
        .padding(20)
    }
}

/// Likes, comments, follows and reposts for me, newest first.
struct Activity: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Notifications", profilePage = ""
    static let icons = ["like": "❤️", "comment": "💬", "follow": "👤", "repost": "🔁", "mention": "@"]
    var body: some View {
        let p = app.palette(scheme), me = app.me
        let rows = app.query(collection).filter { $0.s("to").isEmpty || $0.s("to") == me }
        if rows.isEmpty {
            EmptyNote(text: "No notifications yet")
        } else {
            VStack(spacing: 8) {
                ForEach(rows, id: \.self) { r in
                    Button { app.updateRecord(collection, r.s("_id"), ["read": .b(true)]); app.openProfile(profilePage, r.s("from"), r.s("from_name")) } label: {
                        HStack(spacing: 12) {
                            Text(Activity.icons[r.s("type")] ?? "🔔").font(.title2)
                            Text(r.s("from_name").isEmpty ? r.s("from") : r.s("from_name")).bold().foregroundColor(p.text) + Text(" " + r.s("text")).foregroundColor(p.text)
                            Spacer()
                        }
                        .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(r.on("read") ? p.card : p.accent.opacity(0.12)))
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}

/// People (Profiles), A to Z: tap one for their profile.
struct People: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Profiles", profilePage = ""
    var body: some View {
        let p = app.palette(scheme), me = app.me
        let rows = app.query(collection, sort: "name (a-z)").filter { $0.s("handle") != me }
        if rows.isEmpty {
            EmptyNote(text: "No one here yet")
        } else {
            VStack(spacing: 8) {
                ForEach(rows, id: \.self) { r in
                    Button { app.openProfile(profilePage, r.s("handle"), r.s("name")) } label: {
                        HStack(spacing: 12) {
                            Avatar(name: r.s("name"), seed: r.s("handle"), size: 46)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.s("name") + (r.on("verified") ? " ✓" : "")).bold().foregroundColor(p.text)
                                Text("@" + r.s("handle") + (r.s("bio").isEmpty ? "" : " · " + r.s("bio"))).foregroundColor(p.sub).lineLimit(1)
                            }
                            Spacer()
                        }
                        .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(p.card))
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}

/// Milestones worked out from my posts, the likes on them and my followers.
struct Achievements: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var body: some View {
        let p = app.palette(scheme), me = app.me
        let mine = app.rows("Posts").filter { $0.s("handle") == me }
        let likes = mine.reduce(0.0) { $0 + $1.n("likes") }, followers = app.get("followers")?.number ?? 0, posts = Double(mine.count)
        let list: [(String, String, Double, Double)] = [("✍️", "First post", posts, 1), ("📚", "10 posts", posts, 10), ("❤️", "First like", likes, 1), ("🔥", "100 likes", likes, 100), ("⭐", "1,000 followers", followers, 1000)]
        VStack(spacing: 8) {
            ForEach(list.indices, id: \.self) { i in
                let m = list[i], done = m.2 >= m.3
                HStack(spacing: 12) {
                    Text(done ? m.0 : "🔒").font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(m.1).bold().foregroundColor(done ? p.text : p.sub)
                        Text(done ? "Unlocked" : Val.n(min(m.2, m.3)).text + " / " + Val.n(m.3).text).font(.subheadline).foregroundColor(p.sub)
                    }
                    Spacer()
                }
                .padding(12).background(RoundedRectangle(cornerRadius: 16).fill(p.card))
            }
        }
    }
}

/// The most used #hashtags; tap one to search for it.
struct Trending: View {
    @EnvironmentObject var app: AppState
    var collection = "Posts", searchVar = ""
    var body: some View {
        var counts: [String: Int] = [:]
        for r in app.rows(collection) {
            for word in r.s("text").split(whereSeparator: { $0 == " " || $0 == "\n" }) where word.hasPrefix("#") && word.count > 1 { counts[String(word), default: 0] += 1 }
        }
        let top = counts.keys.sorted { (counts[$0] ?? 0) > (counts[$1] ?? 0) }.prefix(8)
        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(top), id: \.self) { tag in
                    Button("\(tag) · \(counts[tag] ?? 0)") { if !searchVar.isEmpty { app.set(searchVar, .s(tag)) } }.buttonStyle(.bordered)
                }
            }
        }
    }
}

// MARK: - More components: charts, carousels, swipe pages, timers, keypads, popups, notifications…

/// How pop-up notifications look and where they show.
struct NotifyStyle {
    var listen = "notify", position = "top", look = "card"
    var seconds: Double = 3
    var max = 3
    var bg = "#1e2235", text = "#ffffff", accent = "#ffd23d"
}

struct Toast: Identifiable, Equatable {
    let id = UUID()
    let title: String, text: String, icon: String
}

/// The notifications on screen, stacked at the top (or bottom, or centre).
struct ToastLayer: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var body: some View {
        let p = app.palette(scheme), n = app.notify ?? NotifyStyle()
        let bg = p.resolve(n.bg) ?? p.card, fg = p.resolve(n.text) ?? p.text, ac = p.resolve(n.accent) ?? p.accent
        let pill = n.look == "pill", banner = n.look == "banner"
        VStack(spacing: 8) {
            if n.position == "bottom" || n.position == "center" { Spacer() }
            ForEach(app.toasts) { t in
                HStack(spacing: 10) {
                    if !t.icon.isEmpty { Text(t.icon).font(.system(size: pill ? 18 : 24)) }
                    VStack(alignment: .leading, spacing: 2) {
                        if !t.title.isEmpty { Text(t.title).font(.system(size: 15, weight: .heavy)).foregroundColor(n.look == "achievement" ? ac : fg) }
                        if !t.text.isEmpty && !pill { Text(t.text).font(.system(size: 13)).foregroundColor(fg.opacity(0.8)) }
                    }
                }
                .padding(.horizontal, pill ? 18 : 14).padding(.vertical, pill ? 10 : 12)
                .frame(maxWidth: banner ? .infinity : nil)
                .background(RoundedRectangle(cornerRadius: banner ? 0 : pill ? 30 : 16).fill(bg).shadow(color: .black.opacity(0.2), radius: 9, y: 5))
                .overlay(RoundedRectangle(cornerRadius: pill ? 30 : 16).stroke(n.look == "achievement" ? ac : .clear, lineWidth: 2))
                .onTapGesture { app.toasts.removeAll { $0.id == t.id } }
                .transition(.move(edge: n.position == "bottom" ? .bottom : .top).combined(with: .opacity))
            }
            if n.position != "bottom" { Spacer() }
        }
        .padding(.horizontal, banner ? 0 : 12).padding(.top, 8).padding(.bottom, n.position == "bottom" ? 96 : 0)
        .frame(maxWidth: .infinity, alignment: n.position == "top right" ? .trailing : .center)
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: app.toasts)
    }
}

private let moreColors: [UInt32] = [0xFF6B8B, 0xFFC94D, 0x3CCF7A, 0x8E6BF2, 0x22B8C9, 0xFF9F43, 0xE0559B]
private func num1(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v) }

/// A bar, column, line, area, pie, donut or radar chart: from label | value lines ({variables} work), or a variable tracked over time.
struct PChart: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let data: [(String, String)]
    var chart = "columns", track = ""
    var every: Double = 1
    var points = 30
    var title = ""
    var max: Double = 0
    var values = true, labels = true, grid = true
    var color = "@accent", text = "", bg = ""
    var height: CGFloat = 200
    @State private var history: [Double] = []
    init(data: [(String, String)], chart: String = "columns", track: String = "", every: Double = 1, points: Int = 30, title: String = "", max: Double = 0, values: Bool = true, labels: Bool = true, grid: Bool = true, color: String = "@accent", text: String = "", bg: String = "", height: CGFloat = 200) {
        self.data = data; self.chart = chart; self.track = track; self.every = every; self.points = points; self.title = title; self.max = max
        self.values = values; self.labels = labels; self.grid = grid; self.color = color; self.text = text; self.bg = bg; self.height = height
    }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(text) ?? p.text, c = p.resolve(color) ?? p.accent
        let items: [(String, Double)] = track.isEmpty ? data.map { (app.fill($0.0), Double(app.fill($0.1).trimmingCharacters(in: .whitespaces)) ?? 0) } : history.map { ("", $0) }
        let kind = !track.isEmpty && !["line", "area", "columns", "bars"].contains(chart) ? "line" : chart
        VStack(alignment: .leading, spacing: 8) {
            if !title.isEmpty { Text(app.fill(title)).font(.system(size: 16, weight: .heavy)).foregroundColor(fg) }
            Canvas { ctx, size in draw(&ctx, size, kind, items, c, fg, p.line) }
                .frame(height: Swift.max(60, height - (title.isEmpty ? 24 : 52)))
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 16).fill(p.resolve(bg) ?? .clear))
        .task(id: track) {
            guard !track.isEmpty else { return }
            while !Task.isCancelled {
                history.append(app.get(track)?.number ?? 0)
                if history.count > points { history.removeFirst(history.count - points) }
                try? await Task.sleep(nanoseconds: UInt64(Swift.max(0.1, every) * 1_000_000_000))
            }
        }
    }
    private func label(_ ctx: inout GraphicsContext, _ s: String, _ at: CGPoint, _ col: Color, size: CGFloat = 11, bold: Bool = false, anchor: UnitPoint = .center) {
        guard !s.isEmpty else { return }
        ctx.draw(Text(s).font(.system(size: size, weight: bold ? .heavy : .semibold)).foregroundColor(col), at: at, anchor: anchor)
    }
    private func draw(_ ctx: inout GraphicsContext, _ size: CGSize, _ kind: String, _ items: [(String, Double)], _ c: Color, _ fg: Color, _ line: Color) {
        guard !items.isEmpty else { return }
        let n = items.count, W = size.width, H = size.height, sub = fg.opacity(0.75)
        let top = items.map { $0.1 }.reduce(0, Swift.max), hi = max > 0 ? max : (top <= 0 ? 1 : top * 1.12)
        func slice(_ i: Int) -> Color { i == 0 ? c : Color(hex: moreColors[(i - 1) % moreColors.count]) }
        func frac(_ v: Double) -> CGFloat { CGFloat(Swift.min(1, Swift.max(0, v / hi))) }
        if kind == "pie" || kind == "donut" {
            let total = items.reduce(0) { $0 + Swift.max(0, $1.1) }
            guard total > 0 else { return }
            let r = Swift.min(W, H) / 2 - 4, ctr = CGPoint(x: W / 2, y: H / 2)
            var a = -Double.pi / 2
            for (i, it) in items.enumerated() {
                let sw = Swift.max(0, it.1) / total * Double.pi * 2
                if kind == "donut" {
                    let arc = Path { $0.addArc(center: ctr, radius: r * 0.78, startAngle: .radians(a + 0.02), endAngle: .radians(a + Swift.max(0.02, sw - 0.02)), clockwise: false) }
                    ctx.stroke(arc, with: .color(slice(i)), lineWidth: r * 0.42)
                } else {
                    let wedge = Path { $0.move(to: ctr); $0.addArc(center: ctr, radius: r, startAngle: .radians(a), endAngle: .radians(a + sw), clockwise: false); $0.closeSubpath() }
                    ctx.fill(wedge, with: .color(slice(i)))
                }
                if labels && sw > 0.4 {
                    let m = a + sw / 2, k: CGFloat = kind == "donut" ? 0.78 : 0.62
                    label(&ctx, it.0, CGPoint(x: ctr.x + CGFloat(cos(m)) * r * k, y: ctr.y + CGFloat(sin(m)) * r * k), .white, bold: true)
                }
                a += sw
            }
            if kind == "donut" && values { label(&ctx, num1(total), ctr, fg, size: 20, bold: true) }
            return
        }
        if kind == "radar" {
            let r = Swift.min(W, H) / 2 - (labels ? 18 : 4), ctr = CGPoint(x: W / 2, y: H / 2)
            func at(_ i: Int, _ k: CGFloat) -> CGPoint { let a = -Double.pi / 2 + Double(i) * Double.pi * 2 / Double(n); return CGPoint(x: ctr.x + CGFloat(cos(a)) * r * k, y: ctr.y + CGFloat(sin(a)) * r * k) }
            for k in [0.33, 0.66, 1.0] as [CGFloat] where grid || k == 1 { ctx.stroke(Path { $0.addLines((0..<n).map { at($0, k) }); $0.closeSubpath() }, with: .color(line)) }
            for i in 0..<n { ctx.stroke(Path { $0.move(to: ctr); $0.addLine(to: at(i, 1)) }, with: .color(line)); if labels { label(&ctx, items[i].0, at(i, 1.18), sub) } }
            let shape = Path { $0.addLines(items.enumerated().map { at($0.offset, frac($0.element.1)) }); $0.closeSubpath() }
            ctx.fill(shape, with: .color(c.opacity(0.3))); ctx.stroke(shape, with: .color(c), lineWidth: 2.5)
            return
        }
        if kind == "bars" {
            let lw: CGFloat = labels && items.contains { !$0.0.isEmpty } ? 52 : 0, vw: CGFloat = values ? 34 : 0, row = H / CGFloat(n)
            for (i, it) in items.enumerated() {
                let y = row * CGFloat(i) + row * 0.2, bh = row * 0.6, bw = (W - lw - vw) * frac(it.1)
                ctx.fill(Path(roundedRect: CGRect(x: lw, y: y, width: bw, height: bh), cornerRadius: bh / 3), with: .color(c))
                if lw > 0 { label(&ctx, it.0, CGPoint(x: lw - 6, y: y + bh / 2), sub, anchor: .trailing) }
                if values { label(&ctx, num1(it.1), CGPoint(x: lw + bw + 6, y: y + bh / 2), fg, bold: true, anchor: .leading) }
            }
            return
        }
        let lb: CGFloat = labels && items.contains { !$0.0.isEmpty } ? 18 : 2, tp: CGFloat = values ? 16 : 4, h = H - lb - tp, slot = W / CGFloat(n)
        func yOf(_ v: Double) -> CGFloat { tp + h * (1 - frac(v)) }
        if grid { for i in 0...3 { let y = tp + h * CGFloat(i) / 3; ctx.stroke(Path { $0.move(to: CGPoint(x: 0, y: y)); $0.addLine(to: CGPoint(x: W, y: y)) }, with: .color(line)) } }
        if kind == "line" || kind == "area" {
            let pts = items.enumerated().map { CGPoint(x: n == 1 ? W / 2 : CGFloat($0.offset) * W / CGFloat(n - 1), y: yOf($0.element.1)) }
            if kind == "area" { ctx.fill(Path { $0.addLines(pts + [CGPoint(x: pts[n - 1].x, y: tp + h), CGPoint(x: pts[0].x, y: tp + h)]); $0.closeSubpath() }, with: .color(c.opacity(0.25))) }
            ctx.stroke(Path { $0.addLines(pts) }, with: .color(c), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            for (i, pt) in pts.enumerated() {
                if n <= 14 { ctx.fill(Path(ellipseIn: CGRect(x: pt.x - 3.5, y: pt.y - 3.5, width: 7, height: 7)), with: .color(c)); if values { label(&ctx, num1(items[i].1), CGPoint(x: pt.x, y: pt.y - 11), fg, bold: true) } }
                if lb > 2 { label(&ctx, items[i].0, CGPoint(x: Swift.min(W - 14, Swift.max(14, pt.x)), y: H - 8), sub) }
            }
            return
        }
        for (i, it) in items.enumerated() { // columns
            let x = slot * CGFloat(i) + slot * 0.2, bw = slot * 0.6, y = yOf(it.1)
            let bh = tp + h - y // (round top corners: a rounded bar, its bottom half squared off; iOS 16)
            ctx.fill(Path(roundedRect: CGRect(x: x, y: y, width: bw, height: bh), cornerRadius: Swift.min(6, bh / 2)), with: .color(c))
            ctx.fill(Path(CGRect(x: x, y: y + bh / 2, width: bw, height: bh / 2)), with: .color(c))
            if values { label(&ctx, num1(it.1), CGPoint(x: x + bw / 2, y: y - 8), fg, bold: true) }
            if lb > 2 { label(&ctx, it.0, CGPoint(x: x + bw / 2, y: H - 8), sub) }
        }
    }
}

/// One card in a carousel: its name, icon (an emoji), the value it picks, the variable that unlocks it, a line about it.
struct CarouselItem {
    let name: String, icon: String, value: String
    var lock = "", desc = ""
    init(_ name: String, _ icon: String, _ value: String, lock: String = "", desc: String = "") { self.name = name; self.icon = icon; self.value = value; self.lock = lock; self.desc = desc }
}

/// Swipe through cards; the one in the middle is picked into a variable (locked cards wait for their variable).
struct Carousel: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    let items: [CarouselItem]
    var cardWidth: CGFloat = 0.55
    var arrows = true, dots = true, loop = false
    var message = "", card = "@card", text = "", accent = "@accent"
    var height: CGFloat = 220
    @State private var i = -1
    init(_ variable: String, _ items: [CarouselItem], cardWidth: CGFloat = 0.55, arrows: Bool = true, dots: Bool = true, loop: Bool = false, message: String = "", card: String = "@card", text: String = "", accent: String = "@accent", height: CGFloat = 220) {
        self.variable = variable; self.items = items; self.cardWidth = cardWidth; self.arrows = arrows; self.dots = dots; self.loop = loop; self.message = message; self.card = card; self.text = text; self.accent = accent; self.height = height
    }
    func locked(_ x: CarouselItem) -> Bool { !x.lock.isEmpty && !(app.get(x.lock)?.isOn ?? false) }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? p.accent
        let cur = i >= 0 ? i : Swift.max(0, items.firstIndex { $0.value == app.get(variable)?.text } ?? 0)
        let sel = Binding<Int>(get: { cur }, set: { j in
            i = j
            if items.indices.contains(j), !locked(items[j]), app.get(variable)?.text != items[j].value { app.set(variable, .s(items[j].value)); if !message.isEmpty { app.send(message) } }
        })
        VStack(spacing: 10) {
            GeometryReader { g in
                let side = g.size.width * (1 - cardWidth) / 2
                ZStack {
                    TabView(selection: sel) {
                        ForEach(items.indices, id: \.self) { k in
                            let x = items[k]
                            VStack(spacing: 4) {
                                Text(locked(x) ? "🔒" : x.icon).font(.system(size: 46))
                                Text(x.name).font(.system(size: 17, weight: .heavy)).foregroundColor(fg).lineLimit(1)
                                if !x.desc.isEmpty { Text(app.fill(x.desc)).font(.system(size: 13)).foregroundColor(fg.opacity(0.7)).multilineTextAlignment(.center).lineLimit(2) }
                            }
                            .padding(14).frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(RoundedRectangle(cornerRadius: 20).fill(p.resolve(card) ?? p.card))
                            .overlay(RoundedRectangle(cornerRadius: 20).stroke(k == cur ? ac : .clear, lineWidth: 2.5))
                            .opacity(locked(x) ? 0.5 : 1)
                            .padding(.horizontal, side).padding(.vertical, 4)
                            .tag(k)
                        }
                    }
                    .tabViewStyle(.page(indexDisplayMode: .never))
                    if arrows {
                        HStack {
                            Button { withAnimation { sel.wrappedValue = loop ? (cur - 1 + items.count) % items.count : Swift.max(0, cur - 1) } } label: { Text("‹").font(.system(size: 30)).foregroundColor(fg).frame(width: 40, height: 44) }
                            Spacer()
                            Button { withAnimation { sel.wrappedValue = loop ? (cur + 1) % items.count : Swift.min(items.count - 1, cur + 1) } } label: { Text("›").font(.system(size: 30)).foregroundColor(fg).frame(width: 40, height: 44) }
                        }.buttonStyle(.plain)
                    }
                }
            }
            .frame(height: height - (dots ? 22 : 0))
            if dots { PageDots(count: items.count, index: cur, on: ac, off: p.line) }
        }
    }
}

struct PageDots: View {
    let count: Int, index: Int, on: Color, off: Color
    var body: some View {
        HStack(spacing: 6) { ForEach(0..<count, id: \.self) { k in Capsule().fill(k == index ? on : off).frame(width: k == index ? 18 : 7, height: 7) } }
            .animation(.easeOut(duration: 0.2), value: index)
    }
}

/// Swipe left and right between pages (onboarding, a tour); the page number goes into a variable, and "slide next" / "slide prev" / "slide 2" move it.
struct Pager: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var dots = true
    var dotColor = "@accent"
    var loop = false
    var auto: Double = 0
    var message = "slide"
    var height: CGFloat = 320
    let pages: [AnyView]
    init(_ variable: String, dots: Bool = true, dotColor: String = "@accent", loop: Bool = false, auto: Double = 0, message: String = "slide", height: CGFloat = 320, pages: [AnyView]) {
        self.variable = variable; self.dots = dots; self.dotColor = dotColor; self.loop = loop; self.auto = auto; self.message = message; self.height = height; self.pages = pages
    }
    var current: Int { Swift.min(pages.count - 1, Swift.max(0, Int(app.get(variable)?.number ?? 1) - 1)) }
    func go(_ j: Int) {
        let n = pages.count
        guard n > 0 else { return }
        let k = loop ? ((j % n) + n) % n : Swift.min(n - 1, Swift.max(0, j))
        withAnimation { app.set(variable, .n(Double(k + 1))) }
    }
    var body: some View {
        let p = app.palette(scheme), dot = p.resolve(dotColor) ?? p.accent
        let sel = Binding<Int>(get: { current }, set: { go($0) })
        VStack(spacing: 8) {
            TabView(selection: sel) {
                ForEach(pages.indices, id: \.self) { k in pages[k].frame(maxWidth: .infinity, maxHeight: .infinity).tag(k) }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            if dots { PageDots(count: pages.count, index: current, on: dot, off: dot.opacity(0.3)) }
        }
        .frame(height: height)
        .onReceive(app.messages) { m in
            if m == message + " next" { go(current + 1) }
            else if m == message + " prev" || m == message + " back" { go(current - 1) }
            else if m.hasPrefix(message + " "), let k = Int(m.dropFirst(message.count + 1)) { go(k - 1) }
        }
        .task(id: auto) {
            guard auto > 0 else { return }
            while !Task.isCancelled { try? await Task.sleep(nanoseconds: UInt64(auto * 1_000_000_000)); if !Task.isCancelled { go(current + 1) } }
        }
    }
}

/// A grid of square pictures from a collection's media field (or emojis); tap one to open it.
struct PhotoGrid: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var collection = "Posts", field = "media", filter = ""
    var columns = 3
    var gap: CGFloat = 2, radius: CGFloat = 0
    var openPage = "", message = ""
    init(collection: String = "Posts", field: String = "media", filter: String = "", columns: Int = 3, gap: CGFloat = 2, radius: CGFloat = 0, openPage: String = "", message: String = "") {
        self.collection = collection; self.field = field; self.filter = filter; self.columns = columns; self.gap = gap; self.radius = radius; self.openPage = openPage; self.message = message
    }
    var body: some View {
        let p = app.palette(scheme), rows = app.query(collection, filter: filter).filter { !mediaList($0.s(field)).isEmpty }
        if rows.isEmpty { Text("No pictures yet").foregroundColor(p.sub).frame(maxWidth: .infinity).padding(24) }
        else {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: Swift.max(1, columns)), spacing: gap) {
                ForEach(rows.indices, id: \.self) { k in
                    let r = rows[k]
                    Color.clear.aspectRatio(1, contentMode: .fit)
                        .overlay(GeometryReader { g in Tile(media: mediaList(r.s(field))[0], color: colorOf(r, r.s("_id"), p), height: g.size.width) })
                        .clipShape(RoundedRectangle(cornerRadius: radius))
                        .contentShape(Rectangle())
                        .onTapGesture { app.open(collection, r.s("_id")); if !openPage.isEmpty { app.go(openPage) }; if !message.isEmpty { app.send(message) } }
                }
            }
        }
    }
}

/// A heart (or thumbs-up, or star) that turns a variable on or off, with a count next to it.
struct LikeButton: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var countVar = "likes", icon = "heart", message = ""
    var on = "#f91880", off = "@sub", text = "@sub"
    init(_ variable: String, countVar: String = "likes", icon: String = "heart", message: String = "", on: String = "#f91880", off: String = "@sub", text: String = "@sub") {
        self.variable = variable; self.countVar = countVar; self.icon = icon; self.message = message; self.on = on; self.off = off; self.text = text
    }
    var body: some View {
        let p = app.palette(scheme), liked = app.get(variable)?.isOn ?? false, c = liked ? (p.resolve(on) ?? p.accent) : (p.resolve(off) ?? p.sub)
        let name = icon == "thumbs up" ? "hand.thumbsup" : icon == "star" ? "star" : "heart"
        Button {
            app.set(variable, .b(!liked))
            if !countVar.isEmpty { app.add(countVar, liked ? -1 : 1) }
            if !message.isEmpty { app.send(message) }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: liked ? name + ".fill" : name).font(.system(size: 22)).foregroundColor(c).scaleEffect(liked ? 1.1 : 1)
                    .animation(.spring(response: 0.3, dampingFraction: 0.4), value: liked)
                if !countVar.isEmpty { Text(compactNum(app.get(countVar)?.number ?? 0)).font(.system(size: 15, weight: .bold)).foregroundColor(liked ? c : (p.resolve(text) ?? p.sub)) }
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Text that scrolls across (several messages separated by |, with {variables}).
struct Ticker: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let text: String
    var speed: Double = 60
    var direction = "left"
    var gap: CGFloat = 60, size: CGFloat = 15
    var bg = "", color = "", accent = "#ffd23d"
    var height: CGFloat = 36
    init(_ text: String, speed: Double = 60, direction: String = "left", gap: CGFloat = 60, size: CGFloat = 15, bg: String = "", color: String = "", accent: String = "#ffd23d", height: CGFloat = 36) {
        self.text = text; self.speed = speed; self.direction = direction; self.gap = gap; self.size = size; self.bg = bg; self.color = color; self.accent = accent; self.height = height
    }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(color) ?? p.text, ac = p.resolve(accent) ?? p.accent
        let parts = text.components(separatedBy: "|").map { app.fill($0.trimmingCharacters(in: .whitespaces)) }.filter { !$0.isEmpty }
        let line = parts.enumerated().reduce(Text("")) { t, e in e.offset == 0 ? t + Text(e.element) : t + Text("   ●   ").foregroundColor(ac) + Text(e.element) }
        let w = CGFloat(parts.joined(separator: "   ●   ").count) * size * 0.55 + gap // (about how wide the line is)
        TimelineView(.animation) { tl in
            let t = CGFloat(tl.date.timeIntervalSinceReferenceDate * speed).truncatingRemainder(dividingBy: w)
            HStack(spacing: 0) { ForEach(0..<4, id: \.self) { _ in line.font(.system(size: size, weight: .bold)).foregroundColor(fg).lineLimit(1).fixedSize().frame(width: w, alignment: .leading) } }
                .offset(x: direction == "right" ? t - w : -t)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(height: height).clipped()
        .background(p.resolve(bg) ?? .clear)
        .padding(.horizontal, -16)
    }
}

/// A countdown (or count-up) as a ring, bar, big digits or a pill: red near the end, then a message. "timer start / pause / reset / restart / add 5" control it.
struct PTimer: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var seconds: Double = 30
    var countUp = false
    var look = "ring", format = "seconds"
    var autoStart = true
    var message = "timer", endMessage = "", endAction = "nothing else"
    var warnAt: Double = 5
    var variable = "", color = "@accent", warn = "#ff4d5e", track = "@line", text = ""
    var size: CGFloat = 120
    init(seconds: Double = 30, countUp: Bool = false, look: String = "ring", format: String = "seconds", autoStart: Bool = true, message: String = "timer", endMessage: String = "", endAction: String = "nothing else", warnAt: Double = 5, variable: String = "", color: String = "@accent", warn: String = "#ff4d5e", track: String = "@line", text: String = "", size: CGFloat = 120) {
        self.seconds = seconds; self.countUp = countUp; self.look = look; self.format = format; self.autoStart = autoStart; self.message = message; self.endMessage = endMessage; self.endAction = endAction
        self.warnAt = warnAt; self.variable = variable; self.color = color; self.warn = warn; self.track = track; self.text = text; self.size = size
    }
    @State private var t: Double = 0
    @State private var running: Bool? = nil
    @State private var done = false
    @State private var shown = -1
    private let tick = Timer.publish(every: 0.1, on: .main, in: .common).autoconnect()
    var body: some View {
        let p = app.palette(scheme), s = seconds <= 0 ? 1 : seconds, left = countUp ? t : s - t, isRunning = running ?? autoStart
        let whole = countUp ? Int(left.rounded(.down)) : Int((left - 1e-9).rounded(.up))
        let label = format == "m:ss" ? "\(whole / 60):" + String(format: "%02d", whole % 60) : format == "seconds.tenths" ? String(format: "%.1f", left) : String(whole)
        let warnOn = !countUp && left <= warnAt && !done && isRunning
        let c = warnOn ? (p.resolve(warn) ?? p.danger) : (p.resolve(color) ?? p.accent), frac = CGFloat(Swift.min(1, Swift.max(0, left / s))), tr = p.resolve(track) ?? p.line
        let digits = Text(label).font(.system(size: size * (look == "digits" ? 0.45 : 0.26), weight: .black).monospacedDigit()).foregroundColor(warnOn ? c : (p.resolve(text) ?? p.text))
        Group {
            switch look {
            case "bar": VStack(spacing: 6) { digits; ProgressView(value: Double(frac)).tint(c).scaleEffect(x: 1, y: 3) }
            case "digits": digits
            case "pill": HStack(spacing: 6) { Text("⏱"); digits }.padding(.horizontal, 16).padding(.vertical, 8).background(Capsule().fill(c.opacity(0.16)))
            default:
                ZStack {
                    Circle().stroke(tr, lineWidth: size * 0.08)
                    Circle().trim(from: 0, to: frac).stroke(c, style: StrokeStyle(lineWidth: size * 0.08, lineCap: .round)).rotationEffect(.degrees(-90))
                    digits
                }.frame(width: size, height: size).padding(size * 0.04)
            }
        }
        .scaleEffect(warnOn && Int(t * 2) % 2 == 0 ? 1.06 : 1)
        .animation(.easeInOut(duration: 0.2), value: warnOn && Int(t * 2) % 2 == 0)
        .frame(maxWidth: .infinity)
        .onReceive(tick) { _ in
            guard isRunning, !done else { return }
            t = Swift.min(seconds, t + 0.1)
            if t >= seconds { done = true; if !endMessage.isEmpty { app.send(endMessage) }; if endAction == "restart timer" { t = 0; done = false } }
            let now = countUp ? Int(t.rounded(.down)) : Int((seconds - t - 1e-9).rounded(.up))
            if !variable.isEmpty && now != shown { shown = now; app.set(variable, .n(Double(now))) }
        }
        .onReceive(app.messages) { m in
            guard m.hasPrefix(message) else { return }
            let rest = m.dropFirst(message.count).trimmingCharacters(in: .whitespaces)
            if rest == "start" || rest == "resume" || rest.isEmpty { running = true }
            else if rest == "pause" || rest == "stop" { running = false }
            else if rest == "reset" { t = 0; done = false }
            else if rest == "restart" { t = 0; done = false; running = true }
            else if rest.hasPrefix("add "), let by = Double(rest.dropFirst(4).trimmingCharacters(in: .whitespaces)) { t = Swift.max(0, t - by * (countUp ? -1 : 1)) }
        }
    }
}

/// Grey shapes that shimmer while content loads; gone when its variable turns on.
struct Skeleton: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var layout = "avatar + lines"
    var lines = 3
    var doneVar = ""
    var radius: CGFloat = 8
    @State private var shine = false
    init(layout: String = "avatar + lines", lines: Int = 3, doneVar: String = "", radius: CGFloat = 8) { self.layout = layout; self.lines = lines; self.doneVar = doneVar; self.radius = radius }
    var body: some View {
        if !doneVar.isEmpty && (app.get(doneVar)?.isOn ?? false) { EmptyView() }
        else {
            let p = app.palette(scheme), col = p.text.opacity(shine ? 0.15 : 0.07)
            Group {
                switch layout {
                case "text lines": bars(lines, col)
                case "card": VStack(spacing: 8) { RoundedRectangle(cornerRadius: radius * 1.5).fill(col).frame(height: 140); bars(Swift.max(1, lines - 1), col) }
                case "list rows": VStack(spacing: 12) { ForEach(0..<lines, id: \.self) { _ in HStack(spacing: 12) { Circle().fill(col).frame(width: 40, height: 40); bars(2, col) } } }
                case "picture": RoundedRectangle(cornerRadius: radius * 1.5).fill(col).frame(height: 180)
                default: HStack(alignment: .top, spacing: 12) { Circle().fill(col).frame(width: 48, height: 48); bars(lines, col) }
                }
            }
            .onAppear { withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { shine = true } }
        }
    }
    func bars(_ n: Int, _ col: Color) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(0..<n, id: \.self) { i in
                GeometryReader { g in RoundedRectangle(cornerRadius: radius).fill(col).frame(width: g.size.width * (i == n - 1 && n > 1 ? 0.6 : 1)) }.frame(height: 12)
            }
        }
    }
}

/// Colour swatches: tap one to pick it into a variable.
struct ColorSwatches: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    let colors: [String]
    var columns = 5
    var shape = "circle"
    var gap: CGFloat = 10
    var ring = "@text", message = ""
    init(_ variable: String, _ colors: [String], columns: Int = 5, shape: String = "circle", gap: CGFloat = 10, ring: String = "@text", message: String = "") {
        self.variable = variable; self.colors = colors; self.columns = columns; self.shape = shape; self.gap = gap; self.ring = ring; self.message = message
    }
    var body: some View {
        let p = app.palette(scheme), cur = (app.get(variable)?.text ?? "").lowercased(), r: CGFloat = shape == "circle" ? 999 : shape == "rounded" ? 12 : 3
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: gap), count: Swift.max(1, columns)), spacing: gap) {
            ForEach(colors, id: \.self) { c in
                let on = c.lowercased() == cur
                RoundedRectangle(cornerRadius: r).fill(p.resolve(c) ?? p.line).aspectRatio(1, contentMode: .fit)
                    .overlay(RoundedRectangle(cornerRadius: r).stroke(on ? (p.resolve(ring) ?? p.text) : p.line, lineWidth: on ? 3.5 : 1))
                    .overlay(on ? Image(systemName: "checkmark").font(.system(size: 16, weight: .heavy)).foregroundColor(.white).shadow(radius: 2) : nil)
                    .onTapGesture { app.set(variable, .s(c)); if !message.isEmpty { app.send(message) } }
            }
        }
    }
}

/// A number pad for a code, a PIN or an answer: ✓ checks it against the answer and sends the right / wrong message.
struct Keypad: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    var maxLength = 4
    var mask = false
    var answer = "", rightMessage = "", wrongMessage = "", enterMessage = ""
    var autoEnter = true, display = true
    var keyStyle = "round", keyColor = "@field", text = "", accent = "@good", displayBg = ""
    init(_ variable: String, maxLength: Int = 4, mask: Bool = false, answer: String = "", rightMessage: String = "", wrongMessage: String = "", enterMessage: String = "", autoEnter: Bool = true, display: Bool = true, keyStyle: String = "round", keyColor: String = "@field", text: String = "", accent: String = "@good", displayBg: String = "") {
        self.variable = variable; self.maxLength = maxLength; self.mask = mask; self.answer = answer; self.rightMessage = rightMessage; self.wrongMessage = wrongMessage; self.enterMessage = enterMessage
        self.autoEnter = autoEnter; self.display = display; self.keyStyle = keyStyle; self.keyColor = keyColor; self.text = text; self.accent = accent; self.displayBg = displayBg
    }
    func enter(_ v: String) {
        if !enterMessage.isEmpty { app.send(enterMessage) }
        guard !answer.isEmpty else { return }
        if v == answer { if !rightMessage.isEmpty { app.send(rightMessage) } }
        else { if !wrongMessage.isEmpty { app.send(wrongMessage) }; app.set(variable, .s("")) }
    }
    func press(_ k: String) {
        let cur = app.get(variable)?.text ?? ""
        if k == "⌫" { if !cur.isEmpty { app.set(variable, .s(String(cur.dropLast()))) } }
        else if k == "✓" { enter(cur) }
        else if cur.count < maxLength { let next = cur + k; app.set(variable, .s(next)); if autoEnter && next.count == maxLength { enter(next) } }
    }
    var body: some View {
        let p = app.palette(scheme), cur = Array(app.get(variable)?.text ?? ""), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? p.accent
        let r: CGFloat = keyStyle == "round" ? 999 : keyStyle == "flat" ? 6 : 16
        VStack(spacing: 12) {
            if display {
                Text((0..<maxLength).map { $0 < cur.count ? (mask ? "•" : String(cur[$0])) : "–" }.joined(separator: "  "))
                    .font(.system(size: 26, weight: .heavy)).foregroundColor(fg).frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(RoundedRectangle(cornerRadius: 14).fill(p.resolve(displayBg) ?? p.resolve("@field") ?? p.card))
            }
            ForEach([["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["⌫", "0", "✓"]], id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { k in
                        Button { press(k) } label: {
                            Text(k).font(.system(size: 24, weight: .bold)).foregroundColor(k == "✓" ? .white : fg)
                                .frame(maxWidth: .infinity).aspectRatio(keyStyle == "round" ? 1 : 1.5, contentMode: .fit)
                                .background(RoundedRectangle(cornerRadius: r).fill(k == "✓" ? ac : keyStyle == "flat" ? .clear : (p.resolve(keyColor) ?? p.card)))
                        }.buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: 300).frame(maxWidth: .infinity)
    }
}

/// ‹ Easy › : pick one of several options with arrows; the choice goes into a variable.
struct Selector: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let variable: String
    let options: [String]
    var wrap = true
    init(_ variable: String, _ options: [String], wrap: Bool = true) { self.variable = variable; self.options = options; self.wrap = wrap }
    var body: some View {
        let p = app.palette(scheme), n = options.count, i = Swift.max(0, options.firstIndex(of: app.get(variable)?.text ?? "") ?? 0)
        HStack {
            Button { app.set(variable, .s(options[wrap ? (i - 1 + n) % n : Swift.max(0, i - 1)])) } label: { Text("‹").font(.system(size: 28)).frame(width: 48, height: 48) }.disabled(!wrap && i == 0)
            Text(n > 0 ? options[i] : "").font(.system(size: 17, weight: .heavy)).foregroundColor(p.text).frame(maxWidth: .infinity)
            Button { app.set(variable, .s(options[wrap ? (i + 1) % n : Swift.min(n - 1, i + 1)])) } label: { Text("›").font(.system(size: 28)).frame(width: 48, height: 48) }.disabled(!wrap && i == n - 1)
        }
        .buttonStyle(.plain).foregroundColor(p.text)
        .background(RoundedRectangle(cornerRadius: 14).fill(p.resolve("@field") ?? p.card))
        .disabled(n == 0)
    }
}

/// A popup or a bottom sheet with things inside: opens on a message and closes on another (or after a few seconds).
struct PPopup<Content: View>: View {
    @EnvironmentObject var app: AppState
    var mode = "popup", openOn = "popup", closeOn = "close"
    var startOpen = false
    var autoClose: Double = 0
    var tapCloses = false, dim = true, handle = true
    let content: Content
    @State private var open: Bool? = nil
    init(mode: String = "popup", openOn: String = "popup", closeOn: String = "close", startOpen: Bool = false, autoClose: Double = 0, tapCloses: Bool = false, dim: Bool = true, handle: Bool = true, @ViewBuilder content: () -> Content) {
        self.mode = mode; self.openOn = openOn; self.closeOn = closeOn; self.startOpen = startOpen; self.autoClose = autoClose; self.tapCloses = tapCloses; self.dim = dim; self.handle = handle; self.content = content()
    }
    var body: some View {
        let shown = Binding<Bool>(get: { open ?? startOpen }, set: { open = $0 })
        Color.clear.frame(height: 0)
            .onReceive(app.messages) { m in if m == openOn { open = true } else if m == closeOn { open = false } }
            .task(id: shown.wrappedValue) {
                guard shown.wrappedValue, autoClose > 0 else { return }
                try? await Task.sleep(nanoseconds: UInt64(autoClose * 1_000_000_000))
                if !Task.isCancelled { open = false }
            }
            .sheet(isPresented: Binding(get: { mode == "sheet" && shown.wrappedValue }, set: { shown.wrappedValue = $0 })) {
                content.padding(16).environmentObject(app)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(handle ? .visible : .hidden)
            }
            .fullScreenCover(isPresented: Binding(get: { mode != "sheet" && shown.wrappedValue }, set: { shown.wrappedValue = $0 })) {
                ZStack {
                    Color.black.opacity(dim ? 0.5 : 0.001).ignoresSafeArea().onTapGesture { if tapCloses { open = false } }
                    content.padding(20).environmentObject(app)
                }
                .modifier(ClearCover())
            }
    }
}

/// A full-screen cover you can see the app through (iOS 16.4 and newer).
struct ClearCover: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.4, *) { content.presentationBackground(.clear) } else { content }
    }
}

// MARK: - Game-style parts that work in apps too: a shop, a daily reward calendar, a prize wheel, a skill button,
// a radial menu, a level map and a quest log (all kept in the app's variables).

/// An icon from the project: an emoji (drawn as text) or one of the editor's icon names.
struct GameIcon: View {
    let icon: String
    var size: CGFloat = 28
    var color: Color = .white
    var body: some View {
        if icon.unicodeScalars.contains(where: { $0.value > 0x2000 }) { Text(icon).font(.system(size: size * 0.9)) }
        else { BarIcon(name: icon.isEmpty ? "star" : icon, size: size).foregroundColor(color) }
    }
}

/// 15300 → 15.3K (as the engine shows prices and amounts).
func gameNum(_ v: Double) -> String {
    let a = abs(v)
    if a < 10000 { return v == v.rounded() ? String(Int(v)) : String(format: "%.1f", v) }
    for (n, u) in [(1e9, "B"), (1e6, "M"), (1e3, "K")] where a >= n { return String(format: "%g", (v / n * 10).rounded(.down) / 10) + u }
    return String(v)
}

struct ShopItem: Hashable { let name, icon: String; let price: Double; let id: String; var note = "" }

/// Shop: buy items with a currency variable (coins, gems). Bought ones stay owned (owned_ID) and can be equipped (equipVar).
struct PShop: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let items: [ShopItem]
    var currency = "coins", currencyIcon = "🪙", equipVar = "outfit", layout = "grid"
    var columns = 2
    var confirm = true
    var message = "bought", card = "@card", text = "", accent = "@good", owned = "@accent"
    @State private var armed = -1
    init(_ items: [ShopItem], currency: String = "coins", currencyIcon: String = "🪙", equipVar: String = "outfit", layout: String = "grid", columns: Int = 2, confirm: Bool = true, message: String = "bought", card: String = "@card", text: String = "", accent: String = "@good", owned: String = "@accent") {
        self.items = items; self.currency = currency; self.currencyIcon = currencyIcon; self.equipVar = equipVar; self.layout = layout; self.columns = columns; self.confirm = confirm; self.message = message; self.card = card; self.text = text; self.accent = accent; self.owned = owned
    }
    func isOwned(_ it: ShopItem) -> Bool { !it.id.hasPrefix("item:") && app.get("owned_\(it.id)") == .b(true) }
    func tap(_ it: ShopItem, _ i: Int) {
        if isOwned(it) { if !equipVar.isEmpty { app.set(equipVar, .s(it.id)) }; return }
        let cash = app.get(currency)?.number ?? 0
        if cash < it.price { app.send("not enough"); return }
        if confirm && armed != i { armed = i; DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { if armed == i { armed = -1 } }; return }
        armed = -1
        app.set(currency, .n(cash - it.price))
        if it.id.hasPrefix("item:") { app.send("give \(it.id.dropFirst(5).trimmingCharacters(in: .whitespaces))|1") }
        else { app.set("owned_\(it.id)", .b(true)); if !equipVar.isEmpty { app.set(equipVar, .s(it.id)) } }
        if !message.isEmpty { app.send(message) }
    }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(text) ?? p.text, cash = app.get(currency)?.number ?? 0, grid = layout != "list"
        let cols = Array(repeating: GridItem(.flexible(), spacing: 10), count: grid ? max(1, columns) : 1)
        LazyVGrid(columns: cols, spacing: 10) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                let has = isOwned(it), eq = has && !equipVar.isEmpty && app.get(equipVar)?.text == it.id, can = cash >= it.price, isArmed = armed == i
                let label = eq ? "✓ Equipped" : has ? (equipVar.isEmpty ? "✓ Owned" : "Equip") : isArmed ? "Buy?" : "\(currencyIcon) \(gameNum(it.price))"
                let ownC = p.resolve(owned) ?? p.accent
                let btn: Color = has ? ownC.opacity(eq ? 0.35 : 0.9) : isArmed ? Color(red: 1, green: 0.62, blue: 0.26) : can ? (p.resolve(accent) ?? .green) : fg.opacity(0.12)
                let button = Text(label).font(.system(size: 13.5, weight: .black)).foregroundColor(has || can || isArmed ? .white : fg.opacity(0.5)).padding(.horizontal, 12).frame(height: 32).background(Capsule().fill(btn))
                Button { tap(it, i) } label: {
                    Group {
                        if grid {
                            VStack(spacing: 4) {
                                GameIcon(icon: it.icon, size: 40, color: fg)
                                Text(it.name).font(.system(size: 14, weight: .heavy)).foregroundColor(fg).lineLimit(1)
                                if !it.note.isEmpty { Text(it.note).font(.system(size: 11, weight: .semibold)).foregroundColor(fg.opacity(0.6)).lineLimit(1) }
                                button.padding(.top, 4)
                            }.frame(maxWidth: .infinity, minHeight: 150)
                        } else {
                            HStack {
                                GameIcon(icon: it.icon, size: 32, color: fg).frame(width: 48)
                                VStack(alignment: .leading) {
                                    Text(it.name).font(.system(size: 15, weight: .heavy)).foregroundColor(fg)
                                    if !it.note.isEmpty { Text(it.note).font(.system(size: 11.5, weight: .semibold)).foregroundColor(fg.opacity(0.6)) }
                                }
                                Spacer()
                                button
                            }.frame(height: 52)
                        }
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 16).fill(p.resolve(card) ?? p.card))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(eq ? ownC : .clear, lineWidth: 2.5))
                }.buttonStyle(.plain).accessibilityLabel("\(it.name), \(label)")
            }
        }
    }
}

struct Reward: Hashable { let label, icon, v: String; let amount: Double }

/// Daily Reward: a calendar of rewards, one claim a day; the streak grows when you come back (and resets if you miss a day). Kept on the phone.
struct DailyReward: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let rewards: [Reward]
    var resetIfMissed = true
    var columns = 4
    var message = "daily claimed", card = "@card", text = "", accent = "#ffd23d", claimed = "@good"
    @State private var streak = 0
    @State private var last = ""
    init(_ rewards: [Reward], resetIfMissed: Bool = true, columns: Int = 4, message: String = "daily claimed", card: String = "@card", text: String = "", accent: String = "#ffd23d", claimed: String = "@good") {
        self.rewards = rewards; self.resetIfMissed = resetIfMissed; self.columns = columns; self.message = message; self.card = card; self.text = text; self.accent = accent; self.claimed = claimed
    }
    static func day(_ off: Int = 0) -> String { let f = DateFormatter(); f.dateFormat = "yyyy-M-d"; return f.string(from: Date().addingTimeInterval(Double(off) * 86400)) }
    var canClaim: Bool { last != DailyReward.day() }
    func load() {
        let s = (UserDefaults.standard.string(forKey: "pocket.daily") ?? "").split(separator: "|").map(String.init)
        streak = Int(s.first ?? "") ?? 0; last = s.count > 1 ? s[1] : ""
        if resetIfMissed && !last.isEmpty && last != DailyReward.day() && last != DailyReward.day(-1) { streak = 0 }
        if streak >= rewards.count && last != DailyReward.day() { streak = 0 }
    }
    func claim() {
        guard canClaim, streak < rewards.count else { return }
        let r = rewards[streak]
        if r.v.hasPrefix("item:") { app.send("give \(r.v.dropFirst(5))|\(gameNum(r.amount))") } else { app.set(r.v, .n((app.get(r.v)?.number ?? 0) + r.amount)) }
        streak += 1; last = DailyReward.day()
        UserDefaults.standard.set("\(streak)|\(last)", forKey: "pocket.daily")
        app.send(message)
    }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? .yellow, cl = p.resolve(claimed) ?? .green
        VStack(spacing: 8) {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: max(1, columns)), spacing: 8) {
                ForEach(Array(rewards.enumerated()), id: \.offset) { i, r in
                    let done = i < streak, today = i == streak && canClaim
                    Button { if today { claim() } } label: {
                        VStack(spacing: 6) {
                            Text(r.label).font(.system(size: 11, weight: .heavy)).foregroundColor(fg.opacity(0.75))
                            GameIcon(icon: r.icon, size: 30, color: fg).opacity(done ? 0.5 : 1)
                            Text(today ? "CLAIM" : (r.v.hasPrefix("item:") ? "×" : "+") + gameNum(r.amount)).font(.system(size: 12.5, weight: .black)).foregroundColor(today ? ac : fg)
                        }
                        .frame(maxWidth: .infinity, minHeight: 86)
                        .background(RoundedRectangle(cornerRadius: 14).fill(done ? cl.opacity(0.18) : (p.resolve(card) ?? p.card)))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(today ? ac : .clear, lineWidth: 3))
                        .overlay(alignment: .topTrailing) { if done { Image(systemName: "checkmark.circle.fill").foregroundColor(cl).padding(5) } }
                    }.buttonStyle(.plain).disabled(!today)
                }
            }
            if !canClaim { Text("Come back tomorrow!").font(.system(size: 12.5, weight: .heavy)).foregroundColor(fg.opacity(0.7)) }
        }.onAppear(perform: load)
    }
}

struct WheelSeg: Hashable { let label, color: String; let amount: Double; var w = 1.0 }

/// Prize Wheel: spins when tapped (or on a message) and lands on a prize (by weight): adds it to a variable and sends a message.
struct PrizeWheel: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let segments: [WheelSeg]
    var variable = "coins", resultVar = "prize", spinOn = "tapped", message = "spin", doneMessage = "prize won"
    var duration = 4.0
    var spinsVar = "", text = "#ffffff", rim = "#ffd23d"
    var size: CGFloat = 280
    @State private var angle = 0.0
    @State private var spinning = false
    @State private var win = -1
    init(_ segments: [WheelSeg], variable: String = "coins", resultVar: String = "prize", spinOn: String = "tapped", message: String = "spin", doneMessage: String = "prize won", duration: Double = 4, spinsVar: String = "", text: String = "#ffffff", rim: String = "#ffd23d", size: CGFloat = 280) {
        self.segments = segments; self.variable = variable; self.resultVar = resultVar; self.spinOn = spinOn; self.message = message; self.doneMessage = doneMessage; self.duration = duration; self.spinsVar = spinsVar; self.text = text; self.rim = rim; self.size = size
    }
    func spin() {
        guard !spinning, !segments.isEmpty else { return }
        if !spinsVar.isEmpty { let n = app.get(spinsVar)?.number ?? 0; if n <= 0 { return }; app.set(spinsVar, .n(n - 1)) }
        let total = max(segments.reduce(0) { $0 + $1.w }, 1e-9)
        var r = Double.random(in: 0..<total), w = segments.count - 1
        for (i, s) in segments.enumerated() { r -= s.w; if r < 0 { w = i; break } }
        let seg = 360.0 / Double(segments.count), land = -(Double(w) + 0.5) * seg + Double.random(in: -0.35...0.35) * seg
        let from = angle.truncatingRemainder(dividingBy: 360)
        let to = from - ((from - land).truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360) - 360 * Double(5 + Int(duration))
        spinning = true; win = -1; angle = from
        withAnimation(.timingCurve(0.25, 1, 0.5, 1, duration: duration)) { angle = to }
        DispatchQueue.main.asyncAfter(deadline: .now() + duration) {
            spinning = false; win = w
            let s = segments[w]
            if !variable.isEmpty && s.amount != 0 { app.set(variable, .n((app.get(variable)?.number ?? 0) + s.amount)) }
            if !resultVar.isEmpty { app.set(resultVar, .s(s.label)) }
            app.send(doneMessage)
        }
    }
    var body: some View {
        let p = app.palette(scheme), n = max(1, segments.count), seg = 360.0 / Double(n)
        ZStack {
            Circle().fill(p.resolve(rim) ?? .yellow)
            ZStack {
                ForEach(Array(segments.enumerated()), id: \.offset) { i, s in
                    Path { path in
                        let c = CGPoint(x: size / 2, y: size / 2), R = size / 2 - 10
                        path.move(to: c); path.addArc(center: c, radius: R, startAngle: .degrees(-90 + Double(i) * seg), endAngle: .degrees(-90 + Double(i + 1) * seg), clockwise: false); path.closeSubpath()
                    }.fill(p.resolve(s.color) ?? .blue).overlay(i == win ? Color.white.opacity(0.0) : Color.clear)
                    Text(s.label).font(.system(size: size * 0.06, weight: .black)).foregroundColor(p.resolve(text) ?? .white)
                        .offset(y: -(size / 2 - 10) * 0.64).rotationEffect(.degrees(-90 + (Double(i) + 0.5) * seg + 90))
                }
            }.rotationEffect(.degrees(angle))
            Circle().fill(p.resolve(rim) ?? .yellow).frame(width: size * 0.14, height: size * 0.14)
            Image(systemName: "arrowtriangle.down.fill").font(.system(size: 26)).foregroundColor(.white).offset(y: -size / 2 + 4)
        }
        .frame(width: size, height: size)
        .contentShape(Circle())
        .onTapGesture { if spinOn != "message only" { spin() } }
        .onReceive(app.messages) { m in if m == message { spin() } }
        .accessibilityLabel("Prize wheel, tap to spin").accessibilityAddTraits(.isButton)
    }
}

/// Skill Button: tap to use (sends a message), then it cools down with a sweeping shadow; charges and a cost are optional.
struct SkillButton: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var icon = "⚡", label = "", message = "skill"
    var cooldown = 3.0
    var charges = 1
    var costVar = ""
    var cost = 10.0
    var shape = "circle"
    var showTime = true
    var bg = "@card", ring = "#7fd3ff"
    var size: CGFloat = 72
    @State private var left = -1
    @State private var cd = 0.0
    let tick = Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()
    init(icon: String = "⚡", label: String = "", message: String = "skill", cooldown: Double = 3, charges: Int = 1, costVar: String = "", cost: Double = 10, shape: String = "circle", showTime: Bool = true, bg: String = "@card", ring: String = "#7fd3ff", size: CGFloat = 72) {
        self.icon = icon; self.label = label; self.message = message; self.cooldown = cooldown; self.charges = charges; self.costVar = costVar; self.cost = cost; self.shape = shape; self.showTime = showTime; self.bg = bg; self.ring = ring; self.size = size
    }
    var afford: Bool { costVar.isEmpty || (app.get(costVar)?.number ?? 0) >= cost }
    var body: some View {
        let p = app.palette(scheme), have = left < 0 ? charges : left, ready = have > 0 && afford, f = have == 0 && cooldown > 0 ? 1 - cd / cooldown : 0
        VStack(spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: shape == "rounded square" ? size * 0.25 : size / 2).fill(p.resolve(bg) ?? p.card)
                if ready { RoundedRectangle(cornerRadius: shape == "rounded square" ? size * 0.25 : size / 2).stroke(p.resolve(ring) ?? .cyan, lineWidth: 2.5) }
                GameIcon(icon: icon, size: size * 0.5, color: p.text)
                if f > 0 {
                    Path { path in let c = CGPoint(x: size / 2, y: size / 2); path.move(to: c); path.addArc(center: c, radius: size, startAngle: .degrees(-90), endAngle: .degrees(-90 + 360 * f), clockwise: false); path.closeSubpath() }
                        .fill(Color.black.opacity(0.55)).clipShape(RoundedRectangle(cornerRadius: shape == "rounded square" ? size * 0.25 : size / 2))
                    if showTime { Text("\(Int((cooldown - cd).rounded(.up)))").font(.system(size: size * 0.32, weight: .black)).foregroundColor(.white) }
                }
                if charges > 1 { Text("\(have)").font(.system(size: 11, weight: .black)).foregroundColor(.white).frame(width: 20, height: 20).background(Circle().fill(p.accent)).offset(x: size * 0.36, y: size * 0.36) }
            }
            .frame(width: size, height: size)
            .onTapGesture {
                guard have > 0 && afford else { return }
                if have == charges { cd = 0 }
                left = have - 1
                if !costVar.isEmpty { app.set(costVar, .n((app.get(costVar)?.number ?? 0) - cost)) }
                app.send(message)
            }
            .onReceive(tick) { _ in
                guard left >= 0 && left < charges && cooldown > 0 else { return }
                cd += 0.05; if cd >= cooldown { cd = 0; left += 1 }
            }
            if !label.isEmpty { Text(label).font(.system(size: 12, weight: .heavy)).foregroundColor(p.text) }
        }.accessibilityElement(children: .combine).accessibilityLabel(label.isEmpty ? message : label).accessibilityAddTraits(.isButton)
    }
}

struct RadialItem: Hashable { let label, icon, msg: String }

/// Radial Menu: a round button that opens a wheel of choices around it; tap a choice to send its message.
struct RadialMenu: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let items: [RadialItem]
    var icon = "😀", open = "hold and slide"
    var radius: CGFloat = 110
    var dim = 0.35
    var labels = true
    var accent = "@accent", bg = "@card"
    var size: CGFloat = 64
    @State private var shown = false
    init(_ items: [RadialItem], icon: String = "😀", open: String = "hold and slide", radius: CGFloat = 110, dim: Double = 0.35, labels: Bool = true, accent: String = "@accent", bg: String = "@card", size: CGFloat = 64) {
        self.items = items; self.icon = icon; self.open = open; self.radius = radius; self.dim = dim; self.labels = labels; self.accent = accent; self.bg = bg; self.size = size
    }
    var body: some View {
        let p = app.palette(scheme)
        ZStack {
            if shown {
                Color.black.opacity(dim).frame(width: 4000, height: 4000).onTapGesture { shown = false }
                ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                    let a = -Double.pi / 2 + Double(i) * 2 * Double.pi / Double(max(1, items.count))
                    Button { shown = false; app.send(it.msg) } label: {
                        VStack(spacing: 1) { GameIcon(icon: it.icon, size: 26, color: p.text); if labels { Text(it.label).font(.system(size: 9.5, weight: .heavy)).foregroundColor(p.text).lineLimit(1) } }
                            .frame(width: 64, height: 64).background(Circle().fill(p.resolve(bg) ?? p.card))
                    }.buttonStyle(.plain).offset(x: CGFloat(cos(a)) * radius, y: CGFloat(sin(a)) * radius)
                }
            }
            Button { shown.toggle() } label: {
                GameIcon(icon: icon, size: size * 0.5, color: p.text).frame(width: size, height: size).background(Circle().fill(shown ? (p.resolve(accent) ?? p.accent) : (p.resolve(bg) ?? p.card)))
            }.buttonStyle(.plain).accessibilityLabel("Open menu")
        }.zIndex(shown ? 10 : 0)
    }
}

/// Level Map: a path of level buttons with stars (stars_1, stars_2…) and locks (unlocked); tap an open level to play it (or send a message / set a variable).
struct LevelMap: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    var count = 12
    var unlockedVar = "unlocked"
    var allOpen = false
    var starsVar = "stars_", layout = "winding path", action = "plays that level", message = "level"
    var spacing: CGFloat = 92
    var accent = "#ffd23d", node = "@accent", text = ""
    var height: CGFloat = 480
    func go(_ n: Int) {
        switch action {
        case "sends a message": app.send("\(message) \(n)"); app.send(message)
        case "sets a variable": app.set(message, .n(Double(n)))
        default: app.set("level", .n(Double(n))); app.send("play level \(n)"); app.send("play game")
        }
    }
    func dot(_ i: Int, _ p: Palette) -> some View {
        let n = i + 1, open = allOpen ? Int.max : max(1, Int(app.get(unlockedVar)?.number ?? 1)), locked = n > open, cur = n == open
        let stars = min(3, max(0, Int((app.get("\(starsVar)\(n)")?.number ?? 0).rounded()))), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? .yellow
        return Button { if !locked { go(n) } } label: {
            VStack(spacing: 2) {
                ZStack {
                    Circle().fill(locked ? fg.opacity(0.15) : (p.resolve(node) ?? p.accent))
                    if cur { Circle().stroke(ac, lineWidth: 3) }
                    if locked { Image(systemName: "lock.fill").foregroundColor(fg.opacity(0.6)) } else { Text("\(n)").font(.system(size: 20, weight: .black)).foregroundColor(.white) }
                }.frame(width: cur ? 60 : 52, height: cur ? 60 : 52)
                if !locked { HStack(spacing: 1) { ForEach(0..<3, id: \.self) { s in Image(systemName: "star.fill").font(.system(size: 11)).foregroundColor(s < stars ? ac : fg.opacity(0.2)) } } }
            }.frame(width: 76)
        }.buttonStyle(.plain).disabled(locked).accessibilityLabel("Level \(n)\(locked ? ", locked" : ", \(stars) stars")")
    }
    var body: some View {
        let p = app.palette(scheme)
        if layout == "grid" {
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 6) { ForEach(0..<count, id: \.self) { i in dot(i, p) } }
        } else {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach((0..<count).reversed(), id: \.self) { i in
                        GeometryReader { g in dot(i, p).position(x: g.size.width / 2 + (layout == "straight up" ? 0 : CGFloat(sin(Double(i) * 1.1)) * g.size.width * 0.3), y: spacing / 2) }.frame(height: spacing)
                    }
                }
            }.frame(height: height)
        }
    }
}

struct QuestGoal: Hashable { let text, v: String; let target: Double; var reward = "" }

/// Quest Log: goals with progress bars; each follows a variable up to a target, ticks off when done (quest_done_N) and gives its reward ("gems 5").
struct QuestLog: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let quests: [QuestGoal]
    var title = "Quests", doneMessage = "quest done"
    var hideDone = true
    var text = "", accent = "@accent", done = "@good", bg = ""
    init(_ quests: [QuestGoal], title: String = "Quests", doneMessage: String = "quest done", hideDone: Bool = true, text: String = "", accent: String = "@accent", done: String = "@good", bg: String = "") {
        self.quests = quests; self.title = title; self.doneMessage = doneMessage; self.hideDone = hideDone; self.text = text; self.accent = accent; self.done = done; self.bg = bg
    }
    func check() {
        for (i, q) in quests.enumerated() where app.get("quest_done_\(i)") != .b(true) && (app.get(q.v)?.number ?? 0) >= q.target {
            app.set("quest_done_\(i)", .b(true))
            let r = q.reward.split(separator: " ").map(String.init)
            if r.count >= 2 { app.set(r[0], .n((app.get(r[0])?.number ?? 0) + (Double(r[1]) ?? 0))) }
            app.send(doneMessage)
        }
    }
    var body: some View {
        let p = app.palette(scheme), fg = p.resolve(text) ?? p.text, ac = p.resolve(accent) ?? p.accent, dn = p.resolve(done) ?? .green
        let order = quests.indices.sorted { (hideDone && app.get("quest_done_\($0)") == .b(true) ? 1 : 0) < (hideDone && app.get("quest_done_\($1)") == .b(true) ? 1 : 0) }
        VStack(alignment: .leading, spacing: 10) {
            if !title.isEmpty { Text(title).font(.system(size: 17, weight: .black)).foregroundColor(fg) }
            ForEach(order, id: \.self) { i in
                let q = quests[i], ok = app.get("quest_done_\(i)") == .b(true), have = app.get(q.v)?.number ?? 0
                HStack(spacing: 12) {
                    Image(systemName: ok ? "checkmark.circle.fill" : "circle").foregroundColor(ok ? dn : fg.opacity(0.3))
                    VStack(alignment: .leading, spacing: 5) {
                        Text(q.text).font(.system(size: 14, weight: .bold)).foregroundColor(ok ? fg.opacity(0.5) : fg).strikethrough(ok)
                        ProgressView(value: ok ? 1 : min(1, have / q.target)).tint(ok ? dn : ac)
                    }
                    Text(ok ? "✓" : "\(gameNum(min(have, q.target)))/\(gameNum(q.target))").font(.system(size: 12, weight: .heavy)).foregroundColor(fg.opacity(0.7))
                    if !q.reward.isEmpty { Text("+\(q.reward)").font(.system(size: 11, weight: .heavy)).foregroundColor(ac) }
                }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 18).fill(p.resolve(bg) ?? .clear))
        .onAppear(perform: check)
        .onChange(of: app.vars) { _ in check() }
    }
}
