// Pocket runtime for SwiftUI: the app's state (variables, data collections, the opened record, navigation)
// and the building blocks the pages use (PocketPage, RecordList, RecordForm, PButton…). Made by Pocket Engine's
// native export; the pages in App/Pages/ are yours to change, and so is this file.
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
    @Published var vars: [String: Val] = [:]
    @Published var data: [String: [Row]] = [:]
    @Published var tab = 0
    @Published var paths: [[String]] = [[]]
    @Published var openCollection: String? = nil
    @Published var openId: String? = nil

    init(name: String, home: String, themeSetting: String = "follow the phone", light: Palette, dark: Palette, vars: [String: Val], tabs: [NavTab], collections: [Collection], stats: [Stat]) {
        self.name = name; self.home = home; self.themeSetting = themeSetting; self.light = light; self.dark = dark
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
        let d = UserDefaults.standard, now = Date().timeIntervalSince1970 * 1000
        if let raw = d.data(forKey: "pocket.data"), let saved = try? JSONDecoder().decode([String: [Row]].self, from: raw) { data = saved }
        for c in collections where data[c.name] == nil {
            data[c.name] = c.sample.enumerated().map { i, r in r.merging(["_id": .s("s\(i)"), "_at": .n(now - Double(i) * 1000)]) { a, _ in a } }
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
    private func work() { for s in stats { vars[s.variable] = .n(stat(s.collection, s.how, field: s.field, filter: s.filter)) } }

    // MARK: variables and text
    func get(_ k: String) -> Val? { vars[k] }
    func set(_ k: String, _ v: Val) { vars[k] = v; changed() }
    func add(_ k: String, _ by: Double) { set(k, .n((vars[k]?.number ?? 0) + by)) }
    /// "{score} points" → "12 points"; {record_title} is the opened record's title; with a row, {title} is the row's.
    func fill(_ t: String, _ row: Row? = nil) -> String {
        var out = "", key = "", inside = false
        for ch in t {
            if ch == "{" { if inside { out += "{" + key }; inside = true; key = ""; continue }
            if ch == "}" && inside {
                inside = false
                if let row, let v = row[key] { out += v.text }
                else if key.hasPrefix("record_") { out += opened?[String(key.dropFirst(7))]?.text ?? "" }
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
        data[name, default: []].append(values.merging(["_id": .s(id), "_at": .n(Date().timeIntervalSince1970 * 1000)]) { _, b in b })
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

    /// What a button does (the same words as the button's Action in Pocket Engine).
    func run(_ action: String, _ value: Val = .s(""), _ amount: Double = 1) {
        let v = value.text
        switch action {
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
        Group {
            if app.tabs.isEmpty {
                NavigationStack(path: $app.paths[0]) {
                    page(app.home).navigationDestination(for: String.self) { page($0) }
                }
            } else {
                TabView(selection: $app.tab) {
                    ForEach(app.tabs.indices, id: \.self) { i in
                        let t = app.tabs[i]
                        NavigationStack(path: $app.paths[i]) {
                            page(t.page).navigationDestination(for: String.self) { page($0) }
                        }
                        .tabItem { Label(t.label, systemImage: t.icon) }
                        .badge(t.badge.isEmpty ? 0 : Int(app.get(t.badge)?.number ?? 0))
                        .tag(i)
                    }
                }
            }
        }
        .tint(app.light.accent)
        .preferredColorScheme(app.colorScheme)
    }
}

// MARK: - Building blocks

/// A page: its title in the navigation bar, then what's on it (a list or form fills the rest).
struct PocketPage<Content: View>: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let title: String
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

/// Text with {variables} filled in.
struct PText: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let text: String
    var size: CGFloat = 16
    var weight: Int = 600
    var color: String? = nil
    init(_ text: String, size: CGFloat = 16, weight: Int = 600, color: String? = nil) { self.text = text; self.size = size; self.weight = weight; self.color = color }
    var body: some View {
        let p = app.palette(scheme)
        let w: Font.Weight = weight >= 900 ? .black : weight >= 800 ? .heavy : weight >= 700 ? .bold : weight >= 600 ? .semibold : weight >= 500 ? .medium : .regular
        Text(app.fill(text)).font(.system(size: size, weight: w)).foregroundColor(p.resolve(color) ?? p.text).frame(maxWidth: .infinity, alignment: .leading)
    }
}

enum Look { case filled, outlined, danger, plain }

struct PButton: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let label: String
    var look: Look = .filled
    let action: () -> Void
    init(_ label: String, look: Look = .filled, action: @escaping () -> Void) { self.label = label; self.look = look; self.action = action }
    var body: some View {
        let p = app.palette(scheme)
        Button(action: action) {
            Text(app.fill(label)).font(.system(size: 17, weight: .heavy)).frame(maxWidth: .infinity, minHeight: 52)
                .foregroundColor(look == .filled ? p.onAccent : look == .danger ? p.danger : p.accent)
                .background(RoundedRectangle(cornerRadius: 16).fill(look == .filled ? p.accent : look == .plain ? Color.clear : p.card))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(look == .danger ? p.danger : look == .outlined ? p.accent : Color.clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
    }
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
    let variable: String
    var placeholder = ""
    var keyboard = "text"
    init(_ variable: String, placeholder: String = "", keyboard: String = "text") { self.variable = variable; self.placeholder = placeholder; self.keyboard = keyboard }
    var body: some View {
        let text = Binding<String>(get: { app.get(variable)?.text ?? "" }, set: { app.set(variable, keyboard == "number" ? .n(Double($0) ?? 0) : .s($0)) })
        HStack {
            if keyboard == "search" { Image(systemName: "magnifyingglass").foregroundColor(.secondary) }
            if keyboard == "password" { SecureField(placeholder, text: text) } else { TextField(placeholder, text: text).keyboardType(keyboard == "number" ? .decimalPad : keyboard == "email" ? .emailAddress : .default) }
        }
        .padding(12).background(RoundedRectangle(cornerRadius: 12).fill(Color(.secondarySystemBackground)))
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

/// The records of a collection: tap one to open it, tick its checkbox, swipe to delete.
struct RecordList: View {
    @EnvironmentObject var app: AppState
    @Environment(\.colorScheme) var scheme
    let collection: String
    var title = "{title}", subtitle = "", icon = "", check = "", search = "", filter = "", sort = "newest first", openPage = "", empty = "Nothing here yet"

    var body: some View {
        let p = app.palette(scheme)
        let rows = app.query(collection, filter: filter, search: search.isEmpty ? "" : (app.get(search)?.text ?? ""), sort: sort)
        if rows.isEmpty {
            Text(empty).foregroundColor(p.sub).multilineTextAlignment(.center).frame(maxWidth: .infinity, maxHeight: .infinity).padding(32)
        } else {
            List {
                ForEach(rows, id: \.self) { r in
                    let id = r["_id"]?.text ?? "", done = !check.isEmpty && (r[check]?.isOn ?? false)
                    HStack(spacing: 12) {
                        if !check.isEmpty {
                            Button { app.updateRecord(collection, id, [check: .b(!done)]) } label: {
                                Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.title2).foregroundColor(done ? p.accent : p.sub)
                            }.buttonStyle(.plain)
                        } else if !icon.isEmpty { Text(app.fill(icon, r)).font(.title) }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.fill(title, r)).font(.body.bold()).foregroundColor(done ? p.sub : p.text).strikethrough(done).lineLimit(1)
                            if !subtitle.isEmpty { Text(app.fill(subtitle, r)).font(.subheadline).foregroundColor(p.sub).lineLimit(2) }
                        }
                        Spacer()
                        if !openPage.isEmpty { Image(systemName: "chevron.right").foregroundColor(p.sub) }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { if !openPage.isEmpty { app.open(collection, id); app.go(openPage) } }
                    .listRowBackground(p.card)
                }
                .onDelete { idx in for i in idx { app.deleteRecord(collection, rows[i]["_id"]?.text ?? "") } }
            }
            .listStyle(.insetGrouped)
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
