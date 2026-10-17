// Starter games in Pocket's scene JSON format. The editor uses these as templates,
// and play.html?game=<key> plays them directly.

const hud = (extra = []) => [
  { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
  ...extra,
];

/** A squad battle on a grid: your four units (select one or several, tap to move, tap enemies to attack) against the computer's. */
function squadGame(turnBased) {
  const map = ['##########', '#....e...#', '#.e..#..e#', '#..###...#', '#......e.#', '#..#..##.#', '#..#.....#', '#.....#..#', '#.##..#..#', '#........#', '#..S.A...#', '#.K..S...#', '##########'];
  const out = [], at = (c, r) => ({ x: 20 + c * 40, y: 130 + r * 40 });
  const unit = (id, name, emoji, x, y, o) => ({ id, name, layer: 3, x, y, shape: { type: 'emoji', emoji, w: 34, h: 34 }, behaviors: [{ type: 'gridUnit', tile: 40, ...o }] });
  let n = 0;
  map.forEach((row, r) => [...row].forEach((ch, c) => {
    const { x, y } = at(c, r), id = `t${r}_${c}`;
    if (ch === '#') out.push({ id, name: 'Wall', x, y, shape: { type: 'rect', w: 40, h: 40, fill: '#3e4a3a', stroke: '#2a3328', lineWidth: 2 }, body: { type: 'static' } });
    else out.push({ id: id + 'f', name: 'Grass', layer: -1, x, y, shape: { type: 'rect', w: 40, h: 40, fill: (r + c) % 2 ? '#2f4a2c' : '#2b4428' } });
    if (ch === 'S') out.push(unit('s' + n++, 'Soldier', '🗡️', x, y, { hp: 6, damage: 2, moves: 4 }));
    if (ch === 'A') out.push(unit('a' + n++, 'Archer', '🏹', x, y, { hp: 4, damage: 2, range: 3, moves: 3 }));
    if (ch === 'K') out.push(unit('k' + n++, 'Knight', '🛡️', x, y, { hp: 10, damage: 3, moves: 3 }));
    if (ch === 'e') out.push(unit('e' + n++, n % 2 ? 'Goblin Archer' : 'Goblin', n % 2 ? '🧝' : '👺', x, y, n % 2 ? { team: 'enemy', hp: 3, damage: 1, range: 3, moves: 3, sight: 7, shot: 'magic bolt', points: 20 } : { team: 'enemy', hp: 4, damage: 2, moves: 4, sight: 7, points: 20 }));
  }));
  const btn = (id, name, label, x, msg, fill) => ({ id, name, ui: true, anchor: 'bottom', x, y: -46, shape: { type: 'rect', w: 160, h: 52, radius: 14, fill }, text: { value: label, size: 18, color: '#ffffff', weight: '800' }, behaviors: [{ type: 'button', action: 'send message', value: msg, amount: 1, sound: 'click' }] });
  out.push(
    { id: 'cmd', name: 'Unit Commander', x: -100, y: -100, behaviors: [{ type: 'squadControl' }] },
    { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 26, align: 'left' } },
    { id: 'hud-units', name: 'Units Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '⚔️ {unitsLeft}  vs  👺 {enemiesLeft}', size: 18, align: 'right', color: '#ffe082' } },
    { id: 'hud-sel', name: 'Selected Text', ui: true, anchor: 'top', x: 0, y: 84, text: { value: turnBased ? 'Turn {turn} · {turnText} · selected {selectedUnits}' : 'Selected {selectedUnits}', size: 15, color: '#b2dfdb', weight: '600' } },
    btn('b-all', 'Select All Button', 'Select all', turnBased ? -90 : 0, 'select all', '#2e6b8f'),
  );
  if (turnBased) out.push(btn('b-end', 'End Turn Button', 'End turn ⏭', 90, 'end turn', '#8f4a2e'));
  return {
    version: 1, name: turnBased ? 'Squad Tactics' : 'Squad Battle', mode: '2d', background: '#1b2619', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: turnBased ? 'SQUAD TACTICS' : 'SQUAD BATTLE', subtitle: turnBased ? 'Tap your units (or drag a box), tap a tile to move, tap a goblin to attack. Each unit moves and attacks once per turn.' : 'Select units, send them anywhere, tap goblins to attack. They fight on their own too!', turnBased, turnDelay: 0.2, orientation: 'portrait', pauseButton: true },
    vars: { score: 0 },
    entities: out,
  };
}

// ---- apps: pages shown by the `page` variable, an app bar, data lists and forms ----
const INK = '@text', MUTED = '@sub'; // theme colours: they follow light / dark mode
const app = {
  bar: (titles, accent, actions = 'theme | dark mode toggle') => ({ id: 'appbar', name: 'App Bar', ui: true, anchor: 'top', x: 0, y: 28, stretch: 'width', margin: 0, layer: 5, shape: { type: 'rect', w: 400, h: 56, radius: 0, fill: '' },
    behaviors: [{ type: 'uiAppBar', title: '', var: 'page', titles, left: 'back', actions, style: 'solid', bg: '@bar', text: INK, iconColor: '@accent', accent: '@accent', borderColor: '@line', shadow: 'once scrolled' }] }),
  page: (id, value, home, kids, o = {}) => [{ id, name: value[0].toUpperCase() + value.slice(1) + ' Page', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, layer: 0, shape: { type: 'rect', w: 400, h: 700, radius: 0, fill: '@bg' },
    behaviors: [{ type: 'uiShowIf', var: 'page', op: '=', value, whenUnset: !!home, anim: o.anim || 'push (iOS, follows navigation)', stagger: o.stagger || 'rise one after another', ...(o.stack ? { stack: true, stackGap: 0, stackTop: 0 } : {}) }] }, ...kids.map((k) => ({ ...k, parent: k.parent || id }))],
  text: (id, name, value, y, o = {}) => ({ id, name, ui: true, anchor: 'top-left', x: 20, y, text: { value, size: o.size || 16, color: o.color || INK, weight: o.weight || '600', align: 'left', wrap: o.wrap ?? 360 } }),
  button: (id, name, label, action, value, o) => ({ id, name, ui: true, anchor: o.anchor || 'bottom', x: o.x || 0, y: o.y, shape: { type: o.r ? 'circle' : 'rect', w: o.w || 360, h: o.h || 52, r: o.r, radius: 16, fill: o.fill, stroke: o.stroke, lineWidth: o.stroke ? 2 : 0, ...(o.stroke ? {} : { shadow: '@shadow', shadowBlur: 12, shadowY: 4 }) },
    text: { value: label, size: o.size || 17, color: o.color || '@onAccent', weight: '800' }, behaviors: [{ type: 'button', action, value, amount: 1, sound: 'click', feel: 'spring', ripple: true }] }),
  search: (id, v, hint, coll) => ({ id, name: 'Search', ui: true, anchor: 'top', x: 0, y: 32, stretch: 'width', margin: 16, shape: { type: 'rect', w: 368, h: 44, radius: 12, fill: '@card', stroke: '@line', lineWidth: 1 },
    text: { value: '', size: 16, color: INK, weight: '600', align: 'left', inset: 42 }, behaviors: [{ type: 'uiInput', var: v, kind: 'search', placeholder: hint, maxLength: 40, style: 'right in the bar', placeholderColor: '@sub', focusColor: '@accent', live: true, message: '', ...(coll ? { suggestFrom: 'a data collection', suggestCollection: coll, suggestField: 'title', cancelButton: true } : {}) }] }),
  list: (id, o) => ({ id, name: o.name || 'List', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 12, marginTop: o.top ?? 64, marginBottom: o.bottom ?? 8, shape: { type: 'rect', w: 380, h: 500, radius: 0, fill: '' },
    behaviors: [{ type: 'uiDataList', bg: '', row: '@card', text: INK, sub: MUTED, danger: '@danger', ...o.list, accent: '@accent' }] }),
  form: (id, o) => ({ id, name: id === 'form-edit' ? 'Edit Form' : 'Add Form', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 8, marginTop: 12, shape: { type: 'rect', w: 380, h: 600, radius: 0, fill: '' },
    behaviors: [{ type: 'uiForm', field: '@card', text: INK, label: MUTED, danger: '@danger', ...o, accent: '@accent' }] }),
  fab: (id, page) => ({ id, name: 'Add Button', ui: true, anchor: 'bottom-right', x: -46, y: -50, layer: 4, shape: { type: 'circle', r: 30, fill: '@accent', shadow: '@shadow', shadowBlur: 16, shadowY: 6 }, text: { value: '+', size: 34, color: '@onAccent', weight: '700' },
    behaviors: [{ type: 'button', action: 'new record', value: page, amount: 1, sound: 'click', feel: 'jelly', ripple: true, pressScale: 0.88 }] }),
};
const appSettings = (title, accent) => ({ app: true, orientation: 'portrait', title: '', subtitle: '', appName: title, appTheme: 'follow the phone', appAccent: accent });

function todoApp() {
  const A = '#3a7bfd';
  return {
    version: 1, name: 'To-Do List', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0, settings: appSettings('To-Do List', A), vars: { page: 'home', search: '' },
    collections: [{ name: 'Tasks', fields: [{ name: 'Title', type: 'text' }, { name: 'Notes', type: 'long text' }, { name: 'Due', type: 'date', default: 'today' }, { name: 'Priority', type: 'choice', options: 'Low, Medium, High', default: 'Medium' }, { name: 'Done', type: 'yes/no' }],
      rows: [{ title: 'Try the To-Do app', notes: 'Tap the circle to tick a task off, tap a task to see it, swipe left to delete.', priority: 'High', done: false }, { title: 'Add your own task with +', notes: '', priority: 'Medium', done: false }, { title: 'Open Pocket Engine', notes: '', priority: 'Low', done: true }] }],
    entities: [
      app.bar('home = My Tasks\nadd = New task\ndetail = Task\nedit = Edit task', A),
      { id: 'logic', name: 'App Logic', x: -100, y: -100, behaviors: [{ type: 'dataStat', collection: 'Tasks', how: 'count', filter: 'done = no', var: 'left' }, { type: 'dataStat', collection: 'Tasks', how: 'count', filter: 'done = yes', var: 'finished' }] },
      ...app.page('p-home', 'home', true, [
        app.search('search', 'search', 'Search tasks', 'Tasks'),
        { ...app.text('summary', 'Summary', '{left} to do · {finished} done', 74, { size: 14, color: MUTED, weight: '700' }) },
        app.list('list', { top: 92, bottom: 8, list: { collection: 'Tasks', title: '{title}', subtitle: '{priority} · {due}', check: 'done', search: 'search', sort: 'newest first', openPage: 'detail', empty: 'No tasks. Tap + to add one.' } }),
        app.fab('add-btn', 'add'),
      ]),
      ...app.page('p-add', 'add', false, [app.form('form-add', { collection: 'Tasks', fields: 'Title, Notes, Due, Priority', mode: 'always adds a new record', saveLabel: 'Add task' })]),
      ...app.page('p-detail', 'detail', false, [
        app.text('d-title', 'Task Title', '{record_title}', 40, { size: 26, weight: '900' }),
        app.text('d-meta', 'Task Info', '{record_priority} priority · due {record_due} · done: {record_done}', 82, { size: 14, color: MUTED, weight: '700' }),
        app.text('d-notes', 'Task Notes', '{record_notes}', 120, { size: 16 }),
        app.button('d-edit', 'Edit Button', 'Edit', 'edit opened record', 'edit', { y: -110, fill: '@accent' }),
        app.button('d-del', 'Delete Button', 'Delete', 'delete opened record', '', { y: -46, fill: '@card', stroke: '@danger', color: '@danger' }),
      ]),
      ...app.page('p-edit', 'edit', false, [app.form('form-edit', { collection: 'Tasks', mode: 'always changes the opened record', saveLabel: 'Save' })]),
    ],
  };
}

function notesApp() {
  const A = '#f59e0b';
  return {
    version: 1, name: 'Notes', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0, settings: appSettings('Notes', A), vars: { page: 'home', search: '' },
    collections: [{ name: 'Notes', fields: [{ name: 'Title', type: 'text' }, { name: 'Body', type: 'long text' }, { name: 'Mood', type: 'choice', options: '🙂, 😐, 🙁, 🤩', default: '🙂' }, { name: 'Pinned', type: 'yes/no' }],
      rows: [{ title: 'Welcome to Notes', body: 'Write anything here. Notes are saved on your phone and stay there when you close the app.', mood: '🤩', pinned: true }, { title: 'Ideas', body: 'A game about a cat who runs a café.', mood: '🙂' }] }],
    entities: [
      app.bar('home = Notes\nadd = New note\ndetail = Note\nedit = Edit note', A),
      ...app.page('p-home', 'home', true, [
        app.search('search', 'search', 'Search notes', 'Notes'),
        app.list('list', { top: 64, list: { collection: 'Notes', title: '{title}', subtitle: '{body}', icon: '{mood}', sort: 'newest first', search: 'search', openPage: 'detail', empty: 'No notes yet. Tap + to write one.', rowH: 74 } }),
        app.fab('add-btn', 'add'),
      ]),
      ...app.page('p-add', 'add', false, [app.form('form-add', { collection: 'Notes', fields: 'Title, Body, Mood', mode: 'always adds a new record', saveLabel: 'Save note' })]),
      ...app.page('p-detail', 'detail', false, [
        app.text('d-title', 'Note Title', '{record_mood} {record_title}', 40, { size: 26, weight: '900' }),
        app.text('d-body', 'Note Body', '{record_body}', 90, { size: 17 }),
        app.button('d-edit', 'Edit Button', 'Edit', 'edit opened record', 'edit', { y: -110, fill: '@accent' }),
        app.button('d-del', 'Delete Button', 'Delete', 'delete opened record', '', { y: -46, fill: '@card', stroke: '@danger', color: '@danger' }),
      ]),
      ...app.page('p-edit', 'edit', false, [app.form('form-edit', { collection: 'Notes', mode: 'always changes the opened record' })]),
    ],
  };
}

function expensesApp() {
  const A = '#10b981';
  const day = (n) => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  return {
    version: 1, name: 'Expense Tracker', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0, settings: appSettings('Expense Tracker', A), vars: { page: 'home' },
    collections: [{ name: 'Expenses', currency: '$', fields: [{ name: 'Title', type: 'text' }, { name: 'Amount', type: 'money' }, { name: 'Category', type: 'choice', options: 'Food, Transport, Shopping, Bills, Fun, Other', default: 'Food' }, { name: 'Date', type: 'date', default: 'today' }],
      rows: [{ title: 'Groceries', amount: 42.5, category: 'Food', date: day(0) }, { title: 'Bus pass', amount: 20, category: 'Transport', date: day(1) }, { title: 'Cinema', amount: 12, category: 'Fun', date: day(2) }] }],
    entities: [
      app.bar('home = Expenses\nadd = New expense\ndetail = Expense\nedit = Edit expense', A),
      { id: 'logic', name: 'App Logic', x: -100, y: -100, behaviors: [{ type: 'dataStat', collection: 'Expenses', how: 'sum', field: 'amount', var: 'total', format: 'money' }, { type: 'dataStat', collection: 'Expenses', how: 'count', var: 'howMany' }] },
      ...app.page('p-home', 'home', true, [
        { id: 'card', name: 'Total Card', ui: true, anchor: 'top', x: 0, y: 64, stretch: 'width', margin: 16, shape: { type: 'rect', w: 368, h: 100, radius: 18, fill: '#10b981', fill2: '#0e9f6e', gradDir: 'diagonal', shadow: 'rgba(16,185,129,0.35)', shadowBlur: 18, shadowY: 6 } },
        { id: 'card-l', name: 'Total Label', parent: 'card', ui: true, anchor: 'top-left', x: 20, y: 26, text: { value: 'Spent so far ({howMany})', size: 14, color: 'rgba(255,255,255,0.85)', weight: '700', align: 'left' } },
        { id: 'card-v', name: 'Total', parent: 'card', ui: true, anchor: 'top-left', x: 20, y: 62, text: { value: '{total_text}', size: 34, color: '#ffffff', weight: '900', align: 'left' } },
        app.list('list', { top: 126, list: { collection: 'Expenses', title: '{title}', subtitle: '{category} · {date}', right: '{amount}', sort: 'date (high-low)', groupBy: 'date', openPage: 'detail', empty: 'No expenses yet. Tap + to add one.' } }),
        app.fab('add-btn', 'add'),
      ]),
      ...app.page('p-add', 'add', false, [app.form('form-add', { collection: 'Expenses', mode: 'always adds a new record', saveLabel: 'Add expense' })]),
      ...app.page('p-detail', 'detail', false, [
        app.text('d-amt', 'Amount', '{record_amount}', 44, { size: 36, weight: '900' }),
        app.text('d-title', 'What', '{record_title}', 92, { size: 20, weight: '800' }),
        app.text('d-meta', 'Info', '{record_category} · {record_date}', 124, { size: 15, color: MUTED, weight: '700' }),
        app.button('d-edit', 'Edit Button', 'Edit', 'edit opened record', 'edit', { y: -110, fill: '@accent' }),
        app.button('d-del', 'Delete Button', 'Delete', 'delete opened record', '', { y: -46, fill: '@card', stroke: '@danger', color: '@danger' }),
      ]),
      ...app.page('p-edit', 'edit', false, [app.form('form-edit', { collection: 'Expenses', mode: 'always changes the opened record' })]),
    ],
  };
}

function blankApp() {
  const A = '#6366f1';
  return {
    version: 1, name: 'My App', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0, settings: appSettings('My App', A), vars: { page: 'home' },
    entities: [
      app.bar('home = Home\nexplore = Explore\nprofile = Profile', A),
      ...app.page('p-home', 'home', true, [app.text('h1', 'Home Title', 'Welcome!', 40, { size: 28, weight: '900' }), app.text('h2', 'Home Text', 'This is your app’s home page. Add lists, forms, buttons and pages from + Add → UI & Menus → App.', 86, { color: MUTED })]),
      ...app.page('p-explore', 'explore', false, [app.text('e1', 'Explore Title', 'Explore', 40, { size: 28, weight: '900' })]),
      ...app.page('p-profile', 'profile', false, [app.text('pr1', 'Profile Title', 'Profile', 40, { size: 28, weight: '900' }),
        { id: 'dm-row', name: 'Dark Mode Row', ui: true, anchor: 'top', x: 0, y: 120, stretch: 'width', margin: 16, shape: { type: 'rect', w: 368, h: 60, radius: 16, fill: '@card', shadow: '@shadow', shadowBlur: 10, shadowY: 2 } },
        { id: 'dm-label', name: 'Dark Mode Label', parent: 'dm-row', ui: true, anchor: 'left', x: 20, y: 0, text: { value: '🌙  Dark mode', size: 17, color: INK, weight: '700', align: 'left' } },
        { id: 'dm-switch', name: 'Dark Mode Switch', parent: 'dm-row', ui: true, anchor: 'right', x: -44, y: 0, shape: { type: 'rect', w: 52, h: 30, radius: 15, fill: '#9aa1ad' }, behaviors: [{ type: 'uiToggle', var: 'darkMode', start: false, onText: '', offText: '', onColor: '@accent', offColor: '#9aa1ad', style: 'switch', message: '' }] }]),
      { id: 'nav', name: 'Bottom Nav', ui: true, anchor: 'bottom', x: 0, y: -38, stretch: 'width', margin: 0, layer: 5, shape: { type: 'rect', w: 400, h: 76, radius: 0, fill: '' },
        behaviors: [{ type: 'uiBottomNav', tabs: 'Home | home | home\nExplore | search | explore\nProfile | user | profile', var: 'page', start: 1, style: 'pill', barColor: '@bar', activeColor: '@accent', idleColor: '@sub', otherPage: 'keep the last tab lit' }] },
    ],
  };
}

/** A social app: a timeline with stories and a post box, a photo feed, a friends feed of cards, and a profile with a photo grid. */
/** The App Bar with ☰ (opens the Side Menu) on pages with nowhere to go back to. */
const menuBar = (bar) => ({ ...bar, behaviors: [{ ...bar.behaviors[0], left: 'back, else menu', look: 'x', brandPages: 'home', iconColor: INK }] });
function socialApp() {
  const A = '#1d9bf0', t = Date.now(), H = 3600e3;
  const feed = (id, look, top, o = {}) => ({ id, name: 'Feed', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, marginTop: top, marginBottom: 0, shape: { type: 'rect', w: 400, h: 500, radius: 0, fill: '' },
    behaviors: [{ type: 'uiFeed', collection: 'Posts', look, ...o, card: '@card', text: INK, sub: MUTED, line: '@line', accent: '@accent' }] });
  return {
    version: 1, name: 'Social', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0, settings: appSettings('Social', A),
    vars: { page: 'home', playerName: 'Alex Rivera', playerHandle: 'alex', followers: 1280, following: 0, chat: '', chatTitle: 'Chat', unread: 0, q: '', profile: '', profile_name: '', openPost: '' },
    collections: [{ name: 'Posts', fields: [{ name: 'Author', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Text', type: 'long text' }, { name: 'Media', type: 'text' }, { name: 'Color', type: 'text' },
      { name: 'Likes', type: 'number' }, { name: 'Liked', type: 'yes/no' }, { name: 'Comments', type: 'number' }, { name: 'Reposts', type: 'number' }, { name: 'Reposted', type: 'yes/no' }, { name: 'Saved', type: 'yes/no' }, { name: 'Verified', type: 'yes/no' },
      { name: 'Location', type: 'text' }, { name: 'Poll', type: 'text' }, { name: 'Votes', type: 'text' }, { name: 'Voted', type: 'number' }, { name: 'Reaction', type: 'text' }, { name: 'Following', type: 'yes/no' },
      { name: 'Live', type: 'yes/no' }, { name: 'Reposted By', type: 'text' }, { name: 'Reposters', type: 'text' }, { name: 'Audience', type: 'text' }, { name: 'Reply Setting', type: 'text' }, { name: 'Background', type: 'text' }, { name: 'Top Comment', type: 'text' }, { name: 'Link', type: 'text' }, { name: 'Link Title', type: 'text' }, { name: 'Link Image', type: 'text' }, { name: 'Quote', type: 'text' }, { name: 'Reply To', type: 'text' }],
    rows: [
      { author: 'Maya Chen', handle: 'maya', text: 'Sunrise hike, worth the 5am alarm. #sunrise #hiking', media: '🏔️ | 🌄 | 🌲', color: '#4f7cff', likes: 1284, comments: 48, reposts: 120, verified: true, following: true, views: 48200, location: 'Banff', top_comment: 'Leo Park: Unreal colours!', _at: t - 0.15 * H },
      { author: 'Leo Park', handle: 'leop', text: 'Shipped the new update! Dark mode, faster sync and a lot fewer bugs. Tell me what you think 👇', views: 21300, likes: 312, liked: true, comments: 27, reposts: 41, following: true, poll: 'Dark mode | Faster sync | Fewer bugs', votes: '64, 21, 33', _at: t - 2.5 * H },
      { author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Homemade pasta night 🍝 #pastanight', media: '🍝', color: '#ff7a45', views: 9400, likes: 958, comments: 63, reposts: 12, following: true, reposters: 'maya', _at: t - 26 * H },
      { author: 'Amir Haddad', handle: 'amir', text: 'Practising a new song for Friday. Who is coming? 🎸 #music', media: '🎸', color: '#10b981', views: 30100, likes: 141, comments: 19, reposts: 3, live: true, following: false, _at: t - 40 * H },
      { author: 'Pocket News', handle: 'pocketnews', text: 'Scientists spot a new comet that will be visible without a telescope next month. #comet #space', views: 12800, likes: 5420, comments: 410, reposts: 1900, verified: true, following: true, link: 'https://example.com/comet', link_title: 'A new comet is coming', link_image: '☄️', _at: t - 72 * H },
      { author: 'Leo Park', handle: 'leop', text: 'Also: the app is now 30% smaller to download 📦', views: 4600, likes: 88, comments: 4, reposts: 6, following: true, reply_to: 's1', _at: t - 2.45 * H },
      { author: 'Leo Park', handle: 'leop', text: 'Full list of changes on the blog 👇 #indiedev', views: 512000, likes: 51, comments: 2, reposts: 3, following: true, reply_to: 's5', link: 'https://example.com/changelog', link_title: 'What’s new in 2.0', link_image: '📝', _at: t - 2.4 * H },
      { author: 'Ava Brooks', handle: 'avab', text: 'Adding this to my list of places to see 😍 #hiking', views: 3100, likes: 64, comments: 5, reposts: 2, following: false, quote: 's0', _at: t - 30 * H },
      { author: 'Alex Rivera', handle: 'alex', text: 'Just joined! Say hi 👋 #newhere', views: 2200, likes: 3, comments: 1, reposts: 0, following: true, _at: t - 5 * H },
      { author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Good morning everyone! What are you up to this weekend? ☀️', background: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)', views: 3400, likes: 210, comments: 14, reposts: 5, following: true, _at: t - 1.2 * H },
    ] },
    { name: 'Messages', fields: [{ name: 'Chat', type: 'text' }, { name: 'Author', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Text', type: 'long text' }, { name: 'Media', type: 'text' }, { name: 'Reaction', type: 'text' },
      { name: 'Reply To', type: 'text' }, { name: 'Reply Text', type: 'text' }, { name: 'Reply Author', type: 'text' }, { name: 'Edited', type: 'yes/no' }, { name: 'Deleted', type: 'yes/no' }, { name: 'System', type: 'yes/no' }, { name: 'Members', type: 'text' }, { name: 'Title', type: 'text' }],
      rows: [
        { chat: 'dm-alex-maya', author: 'Maya Chen', handle: 'maya', text: 'Are you coming hiking on Saturday? 🏔️', _at: t - 0.85 * H },
        { chat: 'dm-alex-maya', author: 'Alex Rivera', handle: 'alex', text: 'Yes! What time?', _at: t - 0.8 * H },
        { chat: 'dm-alex-maya', author: 'Maya Chen', handle: 'maya', text: 'Meet at 7 by the lake', _at: t - 0.78 * H },
        { chat: 'dm-alex-maya', author: 'Maya Chen', handle: 'maya', text: 'Bring snacks 😄', reaction: '❤️', _at: t - 0.77 * H },
        { chat: 'dm-alex-leop', author: 'Leo Park', handle: 'leop', text: 'Did you try the new update? #indiedev', _at: t - 26 * H },
        { chat: 'dm-alex-sofiaruiz', author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Welcome to the app! Message me if you need anything 🎉', _at: t - 50 * H },
        { id: 'g0', chat: 'g-weekend', author: 'Maya Chen', handle: 'maya', text: 'Maya created the group “Weekend hike 🏔️”', system: true, members: 'maya,alex,leop,sofiaruiz', title: 'Weekend hike 🏔️', _at: t - 30 * H },
        { id: 'g1', chat: 'g-weekend', author: 'Leo Park', handle: 'leop', text: 'I’m in! 🙌', _at: t - 29.5 * H },
        { id: 'g2', chat: 'g-weekend', author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Can I bring my dog? 🐶', _at: t - 1.6 * H },
        { id: 'g3', chat: 'g-weekend', author: 'Maya Chen', handle: 'maya', text: 'Of course! The more the merrier', reply_to: 'g2', reply_text: 'Can I bring my dog? 🐶', reply_author: 'Sofia Ruiz', _at: t - 1.5 * H },
      ] },
    { name: 'Stories', fields: [{ name: 'Author', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Media', type: 'text' }, { name: 'Color', type: 'text' }, { name: 'Text', type: 'text' }, { name: 'Liked By', type: 'text' }],
      rows: [
        { author: 'Maya Chen', handle: 'maya', media: '🏔️', color: '#4f7cff', text: 'Made it to the top!', _at: t - 3 * H },
        { author: 'Maya Chen', handle: 'maya', media: '🌄', color: '#f59e0b', text: 'Worth the 5am alarm', _at: t - 2.8 * H },
        { author: 'Leo Park', handle: 'leop', media: '🚀', color: '#7b2ff7', text: 'Launch day! 2.0 is out', _at: t - 5 * H },
        { author: 'Sofia Ruiz', handle: 'sofiaruiz', media: '🍝', color: '#ff7a45', text: 'Pasta night round two', _at: t - 8 * H },
        { author: 'Sofia Ruiz', handle: 'sofiaruiz', media: '', color: '#e11d48', text: 'Who wants the recipe? Reply 👇', _at: t - 7.5 * H },
        { author: 'Amir Haddad', handle: 'amir', media: '🎸', color: '#10b981', text: 'New song on Friday', _at: t - 12 * H },
        { author: 'Pocket News', handle: 'pocketnews', media: '☄️', color: '#111827', text: 'Comet watch: look north-east after sunset', _at: t - 1 * H },
      ] },
    { name: 'StoryViews', fields: [{ name: 'Story', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Name', type: 'text' }], rows: [] },
    { name: 'Listings', fields: [{ name: 'Title', type: 'text' }, { name: 'Price', type: 'number' }, { name: 'Category', type: 'text' }, { name: 'Condition', type: 'text' }, { name: 'Location', type: 'text' }, { name: 'Description', type: 'long text' }, { name: 'Media', type: 'text' }, { name: 'Color', type: 'text' }, { name: 'Seller', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Sold', type: 'yes/no' }],
      rows: [
        { title: 'Road bike, 54 cm', price: 320, category: 'Sports', condition: 'Used – good', location: 'Lisbon', description: 'Aluminium frame, Shimano gears, new tyres last month. Great for commuting.', media: '🚲', color: '#10b981', seller: 'Maya Chen', handle: 'maya', _at: t - 3 * H },
        { title: 'iPhone 13, 128 GB', price: 410, category: 'Electronics', condition: 'Used – like new', location: 'Porto', description: 'Always in a case, battery 91%. Comes with the box and cable.', media: '📱', color: '#4f7cff', seller: 'Leo Park', handle: 'leop', _at: t - 7 * H },
        { title: 'Mid-century armchair', price: 140, category: 'Home & Garden', condition: 'Used – good', location: 'Lisbon', description: 'Solid wood, original fabric. Pick up only.', media: '🛋️', color: '#f59e0b', seller: 'Sofia Ruiz', handle: 'sofiaruiz', _at: t - 20 * H },
        { title: 'Acoustic guitar + case', price: 95, category: 'Hobbies', condition: 'Used – fair', location: 'Braga', description: 'Plays well, a few scratches. Strings changed in May.', media: '🎸', color: '#ef4444', seller: 'Amir Haddad', handle: 'amir', _at: t - 30 * H },
        { title: 'Board games bundle', price: 0, category: 'Free', condition: 'Used – good', location: 'Lisbon', description: 'Catan, Ticket to Ride and Codenames. Free to a good home!', media: '🎲', color: '#7c3aed', seller: 'Ava Brooks', handle: 'avab', _at: t - 2 * H },
        { title: 'Denim jacket (M)', price: 25, category: 'Clothing', condition: 'Used – like new', location: 'Coimbra', description: 'Worn twice. Smoke-free home.', media: '🧥', color: '#0ea5e9', seller: 'Jon Doe', handle: 'jondoe', _at: t - 50 * H },
      ] },
    { name: 'Profiles', fields: [{ name: 'Handle', type: 'text' }, { name: 'Name', type: 'text' }, { name: 'Bio', type: 'long text' }, { name: 'Avatar', type: 'text' }, { name: 'Cover', type: 'text' }, { name: 'Location', type: 'text' }, { name: 'Website', type: 'text' }, { name: 'Pronouns', type: 'text' }, { name: 'Joined', type: 'number' }, { name: 'Verified', type: 'yes/no' }],
      rows: [
        { handle: 'alex', name: 'Alex Rivera', bio: 'Making things with Pocket Engine ✨', cover: '#1d9bf0', location: 'Lisbon', pronouns: 'he/him', joined: t - 40 * 86400e3 },
        { handle: 'maya', name: 'Maya Chen', bio: 'Photographer 📷 Chasing sunrises and good coffee. Prints in the link 👇', cover: 'linear-gradient(135deg,#4f7cff,#22d3ee)', location: 'Banff, Canada', website: 'https://mayachen.photo', pronouns: 'she/her', joined: t - 900 * 86400e3, verified: true },
        { handle: 'leop', name: 'Leo Park', bio: 'Indie dev. Building apps people like to use. 2.0 is out now 🚀', cover: '#7c3aed', location: 'Seoul', website: 'https://leopark.dev', joined: t - 620 * 86400e3 },
        { handle: 'sofiaruiz', name: 'Sofia Ruiz', bio: 'Home cook 🍝 Recipes, kitchen fails and Sunday pasta.', cover: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)', location: 'Madrid', pronouns: 'she/her', joined: t - 410 * 86400e3 },
        { handle: 'amir', name: 'Amir Haddad', bio: 'Guitarist 🎸 New song every Friday.', cover: '#10b981', location: 'Beirut', joined: t - 300 * 86400e3 },
        { handle: 'pocketnews', name: 'Pocket News', bio: 'The news that matters, in your pocket. Science, tech and space.', cover: '#111827', website: 'https://example.com', joined: t - 1500 * 86400e3, verified: true },
        { handle: 'avab', name: 'Ava Brooks', bio: 'Artist ✏️ Live sketching most evenings.', cover: '#c2185b', location: 'London', pronouns: 'they/them', joined: t - 200 * 86400e3 },
      ] },
    { name: 'Points', fields: [{ name: 'Handle', type: 'text' }, { name: 'Name', type: 'text' }, { name: 'Points', type: 'number' }, { name: 'Streak', type: 'number' }, { name: 'Achievements', type: 'text' }], rows: [] },
    { name: 'Bookmarks', fields: [{ name: 'Handle', type: 'text' }, { name: 'Kind', type: 'text' }, { name: 'Ref', type: 'text' }, { name: 'Post', type: 'text' }, { name: 'Author', type: 'text' }, { name: 'Author Handle', type: 'text' }, { name: 'Text', type: 'text' }, { name: 'Media', type: 'text' }, { name: 'Post Author', type: 'text' }], rows: [] },
    { name: 'Reads', fields: [{ name: 'Chat', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'At', type: 'number' }],
      rows: [{ chat: 'dm-alex-maya', handle: 'maya', at: t - 0.76 * H }, { chat: 'dm-alex-leop', handle: 'leop', at: t - 25 * H }] },
    { name: 'Follows', fields: [{ name: 'Follower', type: 'text' }, { name: 'Followee', type: 'text' }, { name: 'Follower Name', type: 'text' }, { name: 'Followee Name', type: 'text' }],
      rows: [['alex', 'maya', 'Alex Rivera', 'Maya Chen'], ['alex', 'leop', 'Alex Rivera', 'Leo Park'], ['alex', 'sofiaruiz', 'Alex Rivera', 'Sofia Ruiz'], ['alex', 'pocketnews', 'Alex Rivera', 'Pocket News'], ['maya', 'alex', 'Maya Chen', 'Alex Rivera'], ['leop', 'alex', 'Leo Park', 'Alex Rivera'], ['amir', 'alex', 'Amir Haddad', 'Alex Rivera'], ['maya', 'leop', 'Maya Chen', 'Leo Park'], ['sofiaruiz', 'maya', 'Sofia Ruiz', 'Maya Chen']].map(([follower, followee, follower_name, followee_name]) => ({ follower, followee, follower_name, followee_name })) },
    { name: 'Friends', fields: [{ name: 'From', type: 'text' }, { name: 'To', type: 'text' }, { name: 'From Name', type: 'text' }, { name: 'To Name', type: 'text' }, { name: 'Status', type: 'text' }],
      rows: [{ from: 'maya', to: 'alex', from_name: 'Maya Chen', to_name: 'Alex Rivera', status: 'accepted', _at: t - 200 * H }, { from: 'leop', to: 'alex', from_name: 'Leo Park', to_name: 'Alex Rivera', status: 'pending', _at: t - 1.2 * H }] },
    { name: 'Notifications', fields: [{ name: 'To', type: 'text' }, { name: 'From', type: 'text' }, { name: 'From Name', type: 'text' }, { name: 'Type', type: 'text' }, { name: 'Post', type: 'text' }, { name: 'Text', type: 'text' }, { name: 'Read', type: 'yes/no' }],
      rows: [
        { to: 'alex', from: 'maya', from_name: 'Maya Chen', type: 'like', post: 's8', text: 'Just joined! Say hi 👋', read: false, _at: t - 0.3 * H },
        { to: 'alex', from: 'sofiaruiz', from_name: 'Sofia Ruiz', type: 'comment', post: 's8', text: 'Welcome Alex! 🎉', read: false, _at: t - 0.6 * H },
        { to: 'alex', from: 'leop', from_name: 'Leo Park', type: 'friend_request', post: '', text: '', read: false, _at: t - 1.2 * H },
        { to: 'alex', from: 'amir', from_name: 'Amir Haddad', type: 'follow', post: '', text: '', read: false, _at: t - 3 * H },
        { to: 'alex', from: 'leop', from_name: 'Leo Park', type: 'like', post: 's8', text: 'Just joined! Say hi 👋', read: true, _at: t - 4 * H },
      ] },
    { name: 'Comments', fields: [{ name: 'Post', type: 'text' }, { name: 'Author', type: 'text' }, { name: 'Handle', type: 'text' }, { name: 'Text', type: 'long text' }, { name: 'Likes', type: 'number' }, { name: 'Liked', type: 'yes/no' }, { name: 'Parent', type: 'text' }, { name: 'Pinned', type: 'yes/no' }, { name: 'Liked By', type: 'text' }, { name: 'Media', type: 'text' }], rows: [{ post: 's8', author: 'Sofia Ruiz', handle: 'sofiaruiz', text: 'Welcome Alex! 🎉', likes: 2, _at: t - 0.6 * H }] }],
    entities: [
      menuBar(app.bar('home = Home\nreels = Reels\nexplore = Explore\nnotifications = Notifications\nfriends = Friends\nuser = {profile_name}\ninbox = Messages\nchat = {chatTitle}\nprofile = Profile\nsaved = Saved\nmarketplace = Marketplace\nachievements = Achievements', A, 'bell | page:notifications | notifications_unread\nusers | page:friends | friend_requests\ntheme | dark mode toggle')),
      ...app.page('p-home', 'home', true, [
        { id: 'stories', name: 'Stories', ui: true, anchor: 'top', x: 0, y: 46, stretch: 'width', margin: 0, shape: { type: 'rect', w: 400, h: 92, radius: 0, fill: '' }, behaviors: [{ type: 'uiStories', collection: 'Stories', text: INK }] },
        { id: 'composer', name: 'New Post Box', ui: true, anchor: 'top', x: 0, y: 124, stretch: 'width', margin: 6, shape: { type: 'rect', w: 388, h: 56, radius: 0, fill: '' }, behaviors: [{ type: 'uiComposer', audience: true, replyControl: true, backgrounds: true, field: '@field', text: MUTED, accent: '@accent' }] },
        feed('feed-home', 'timeline', 156, { tabs: 'For you |\nFollowing | following', tabStyle: 'underline', profilePage: 'user', myProfilePage: 'profile', savedPage: 'saved', actions: 'comment, repost, like, views, save, share' }),
      ]),
      ...app.page('p-reels', 'reels', false, [feed('feed-reels', 'reels', 0, { profilePage: 'user', myProfilePage: 'profile' })]),
      ...app.page('p-explore', 'explore', false, [
        { id: 'explore-search', name: 'Search Bar', ui: true, anchor: 'top', x: 0, y: 26, stretch: 'width', margin: 12, shape: { type: 'rect', w: 376, h: 44, radius: 22, fill: '' }, behaviors: [{ type: 'uiSearchBar', var: 'q', placeholder: 'Search posts, #tags, @people', collection: 'Posts', text: INK, sub: MUTED }] },
        feed('feed-explore', 'grid', 60, { searchVar: 'q', gridColumns: 3 }),
      ]),
      ...app.page('p-notifications', 'notifications', false, [{ id: 'activity', name: 'Notifications', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiActivity', openPage: 'home', profilePage: 'user', text: INK, sub: MUTED }] }]),
      ...app.page('p-marketplace', 'marketplace', false, [{ id: 'market', name: 'Marketplace', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiMarketplace', collection: 'Listings', chatPage: 'chat', text: INK, sub: MUTED }] }]),
      ...app.page('p-achievements', 'achievements', false, [{ id: 'trophies', name: 'Achievements', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiAchievements', text: INK, sub: MUTED }] }]),
      ...app.page('p-saved', 'saved', false, [{ id: 'saved-list', name: 'Saved', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiBookmarks', openPage: 'home', text: INK, sub: MUTED }] }]),
      ...app.page('p-friends', 'friends', false, [{ id: 'friends-list', name: 'Friends', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiFriends', profilePage: 'user', text: INK, sub: MUTED }] }]),
      ...app.page('p-user', 'user', false, [
        { id: 'user-head', name: 'Person Header', ui: true, anchor: 'top', x: 0, y: 150, stretch: 'width', margin: 0, shape: { type: 'rect', w: 400, h: 300, radius: 0, fill: '' },
          behaviors: [{ type: 'uiProfile', social: true, look: 'x', name: '{profile_name}', handle: '{profile}', bio: '', verified: false, own: false, listPage: 'friends', cover: A, text: INK, sub: MUTED, accent: '@accent', bg: '@bg' }] },
        feed('feed-user', 'timeline', 300, { filter: 'handle = {profile}', profilePage: '', empty: 'Nothing here yet', tabs: 'Posts | posts\nReplies | replies\nMedia | media | grid', tabStyle: 'underline', tabHeight: 42 }),
      ], { stack: true }),
      ...app.page('p-inbox', 'inbox', false, [{ id: 'inbox', name: 'Inbox', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiInbox', collection: 'Messages', openPage: 'chat', text: INK, sub: MUTED }] }]),
      ...app.page('p-chat', 'chat', false, [{ id: 'chat-view', name: 'Chat', ui: true, anchor: 'center', x: 0, y: 0, stretch: 'both', margin: 0, shape: { type: 'rect', w: 400, h: 600, radius: 0, fill: '' }, behaviors: [{ type: 'uiChat', collection: 'Messages', text: INK, sub: MUTED }] }]),
      ...app.page('p-profile', 'profile', false, [
        { id: 'profile-head', name: 'Profile Header', ui: true, anchor: 'top', x: 0, y: 150, stretch: 'width', margin: 0, shape: { type: 'rect', w: 400, h: 300, radius: 0, fill: '' },
          behaviors: [{ type: 'uiProfile', social: true, look: 'x', listPage: 'friends', name: '{playerName}', handle: '{playerHandle}', bio: 'Making things with Pocket Engine ✨', verified: false, own: true, message: 'edit profile', stats: 'Posts | {posts_count}\nFollowers | {followers}\nScore | {points}', cover: A, text: INK, sub: MUTED, accent: '@accent', bg: '@bg' }] },
        feed('feed-me', 'timeline', 300, { filter: 'handle = {playerHandle}', profilePage: 'user', myProfilePage: '', empty: 'Nothing here yet', tabs: 'Posts | posts\nReplies | replies\nMedia | media | grid\nLikes | likes', tabStyle: 'underline', tabHeight: 42 }),
      ], { stack: true }),
      { id: 'side', name: 'Side Menu', ui: true, anchor: 'center', x: 0, y: 0, layer: 6, shape: { type: 'rect', w: 10, h: 10, radius: 0, fill: '' },
        behaviors: [{ type: 'uiSideBar', social: true, profilePage: 'profile', countsPage: 'friends', counts: 'following, followers and friends', sync: 'the Bottom Nav tabs', header: 'simple', title: '', avatar: '', style: 'rounded', bg: '@card', text: INK, accent: '@accent', iconColor: '', badgeColor: '#f91880',
          items: 'Notifications | bell | notifications | notifications_unread\nFriends | users | friends | friend_requests\nSaved | bookmark | saved\nMarketplace | shop | marketplace\nAchievements | trophy | achievements\n-\nPost | edit | button:msg:compose\n-\n# Settings\nSettings and privacy | settings | msg:settings\nDark mode | moon | toggle:darkMode', footer: 'Help | info | msg:help' }] },
      { id: 'nav', name: 'Bottom Nav', ui: true, anchor: 'bottom', x: 0, y: -38, stretch: 'width', margin: 0, layer: 5, shape: { type: 'rect', w: 400, h: 76, radius: 0, fill: '' },
        behaviors: [{ type: 'uiBottomNav', tabs: 'Home | home | home\nExplore | search | explore\nReels | video | reels\nMessages | chat | inbox | unread\nProfile | user | profile', var: 'page', start: 1, style: 'minimal', barColor: '@bar', activeColor: '@text', idleColor: '@sub', otherPage: 'keep the last tab lit' }] },
    ],
  };
}

export const templates = {
  'sky-dodge': {
    version: 1, name: 'Sky Dodge', mode: '2d', background: '#101830', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'SKY DODGE', subtitle: 'Drag to move. Avoid the red, grab the stars.', saveBest: 'sky-dodge' },
    vars: { score: 0 },
    entities: [
      { id: 'player', name: 'Player', tags: ['player'], x: 200, y: 580, shape: { type: 'circle', r: 16, fill: '#33f0ff', glow: 16 },
        behaviors: [{ type: 'move', control: 'both', speed: 320 }, { type: 'timeScore', rate: 10 }] },
      { id: 'rock-spawner', name: 'Rock Spawner', x: 60, y: 40, behaviors: [{ type: 'spawner', template: 'Rock', every: [0.35, 0.8], x: [20, 380], y: -40, ramp: 0.15 }] },
      { id: 'star-spawner', name: 'Star Spawner', x: 340, y: 40, behaviors: [{ type: 'spawner', template: 'Star', every: [1.5, 3], x: [30, 370], y: -30, ramp: 0 }] },
      { id: 'rock', name: 'Rock', template: true, x: 120, y: 200, shape: { type: 'rect', w: 44, h: 44, radius: 8, fill: '#ff4d6d' },
        behaviors: [{ type: 'velocity', vy: [180, 280] }, { type: 'rotate', speed: 120 }, { type: 'hazard' }, { type: 'destroyOffscreen' }] },
      { id: 'star', name: 'Star', template: true, x: 280, y: 200, shape: { type: 'star', w: 32, h: 32, fill: '#ffd23d', glow: 10 },
        behaviors: [{ type: 'velocity', vy: 160 }, { type: 'rotate', speed: 180 }, { type: 'collectible', score: 25 }, { type: 'destroyOffscreen' }] },
      ...hud([{ id: 'hud-best', name: 'Best Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: 'BEST {best}', size: 15, align: 'right', color: '#9aa0c8' } }]),
    ],
  },

  'jump-quest': {
    version: 1, name: 'Jump Quest', levelName: 'Green Hills', mode: '2d', background: '#1d2b53', view: { width: 400, height: 700 }, gravity: 1600,
    settings: { title: 'JUMP QUEST', subtitle: 'Reach the green flag', joystick: true, jumpButton: true },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'player', name: 'Player', tags: ['player'], x: 60, y: 540, layer: 2, shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffd23d' },
        behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'damage' }, { type: 'cameraFollow', axes: 'x', smooth: 6 }] },
      ...[[300, 640, 600], [880, 640, 360], [1480, 640, 560]].map(([x, y, w], i) => ({
        id: 'ground' + i, name: 'Ground', x, y, shape: { type: 'rect', w, h: 60, fill: '#3a8a4f' }, body: { type: 'static' } })),
      ...[[520, 500, 140], [760, 410, 140], [1340, 470, 120]].map(([x, y, w], i) => ({
        id: 'plat' + i, name: 'Platform', x, y, shape: { type: 'rect', w, h: 20, radius: 6, fill: '#8a6a4f' }, body: { type: 'static' } })),
      { id: 'mover', name: 'Moving Platform', x: 1110, y: 520, shape: { type: 'rect', w: 120, h: 20, radius: 6, fill: '#c38b5f' }, body: { type: 'kinematic' },
        behaviors: [{ type: 'patrol', dx: 120, duration: 2.2 }] },
      ...[[520, 450], [760, 360], [900, 590], [1110, 470], [1340, 420], [1500, 590]].map(([x, y], i) => ({
        id: 'coin' + i, name: 'Coin', x, y, shape: { type: 'circle', r: 11, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] })),
      { id: 'spike', name: 'Spikes', x: 960, y: 598, shape: { type: 'triangle', w: 44, h: 24, fill: '#ff4d6d' }, behaviors: [{ type: 'hazard', action: 'damage' }] },
      { id: 'enemy', name: 'Enemy', x: 1450, y: 590, shape: { type: 'rect', w: 34, h: 34, radius: 10, fill: '#ff4d6d' },
        behaviors: [{ type: 'patrol', dx: 140, duration: 1.6 }, { type: 'hazard', action: 'damage' }] },
      { id: 'spring', name: 'Spring', x: 1250, y: 600, shape: { type: 'rect', w: 40, h: 20, radius: 4, fill: '#33f0ff' }, body: { type: 'static' }, behaviors: [{ type: 'spring', power: 950 }] },
      { id: 'goal', name: 'Goal Flag', x: 1700, y: 560, shape: { type: 'rect', w: 16, h: 100, fill: '#5dff8a' }, behaviors: [{ type: 'goal' }] },
      ...hud([{ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } }]),
    ],
    levels: [{
      levelName: 'The Locked Door', mode: '2d', background: '#2b1d43', view: { width: 400, height: 700 }, gravity: 1600,
      settings: { joystick: true, jumpButton: true }, vars: { keys: 0 },
      entities: [
        { id: 'l2-player', name: 'Player', tags: ['player'], x: 60, y: 540, layer: 2, shape: { type: 'rect', w: 30, h: 40, radius: 6, fill: '#ffd23d' },
          behaviors: [{ type: 'platformer', speed: 240, jump: 680, onFall: 'damage' }, { type: 'cameraFollow', axes: 'x', smooth: 6 }] },
        ...[[300, 640, 600], [1060, 640, 720]].map(([x, y, w], i) => ({
          id: 'l2-ground' + i, name: 'Ground', x, y, shape: { type: 'rect', w, h: 60, fill: '#5b4a8a' }, body: { type: 'static' } })),
        ...[[620, 520, 140], [840, 430, 140]].map(([x, y, w], i) => ({
          id: 'l2-plat' + i, name: 'Platform', x, y, shape: { type: 'rect', w, h: 20, radius: 6, fill: '#8a6a4f' }, body: { type: 'static' } })),
        { id: 'l2-sign', name: 'Sign', x: 170, y: 588, shape: { type: 'rect', w: 34, h: 44, radius: 4, fill: '#c38b5f' },
          behaviors: [{ type: 'message', text: 'Grab the key to open the door. Watch out for the ghost!', seconds: 3.5, once: true }] },
        { id: 'l2-key', name: 'Key', x: 840, y: 380, shape: { type: 'star', w: 32, h: 32, fill: '#ffd23d', glow: 12 },
          behaviors: [{ type: 'float', amount: 8, period: 1.4 }, { type: 'collectible', score: 1, var: 'keys', sound: 'power' }] },
        { id: 'l2-door', name: 'Door', x: 1180, y: 560, shape: { type: 'rect', w: 30, h: 100, radius: 4, fill: '#a0522d', stroke: '#ffd23d', lineWidth: 3 }, body: { type: 'static' },
          behaviors: [{ type: 'unlock', var: 'keys', amount: 1, text: 'The door is open!' }] },
        { id: 'l2-ghost', name: 'Ghost', x: 1000, y: 520, shape: { type: 'circle', r: 16, fill: '#ff4d6d', glow: 10 },
          behaviors: [{ type: 'chase', speed: 85, range: 260 }, { type: 'hazard', action: 'damage' }, { type: 'float', amount: 6, period: 1 }] },
        ...[[620, 470], [700, 590], [1300, 590], [1360, 590]].map(([x, y], i) => ({
          id: 'l2-coin' + i, name: 'Coin', x, y, shape: { type: 'circle', r: 11, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] })),
        { id: 'l2-goal', name: 'Goal Flag', x: 1380, y: 560, shape: { type: 'rect', w: 16, h: 100, fill: '#5dff8a' }, behaviors: [{ type: 'goal' }] },
        { id: 'l2-hud', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
        { id: 'l2-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
        { id: 'l2-keys', name: 'Keys Text', ui: true, anchor: 'top-left', x: 20, y: 70, text: { value: 'Keys {keys}', size: 16, align: 'left', color: '#ffd23d' } },
      ],
    }],
  },

  'gem-garden': {
    version: 1, name: 'Gem Garden', mode: '3d', background: '#8fc4ef', gravity: -25,
    settings: { title: 'GEM GARDEN', subtitle: 'Collect every gem. Avoid the red cubes.', joystick: true, winScore: 80 },
    vars: { score: 0, lives: 3 },
    camera: { position: { x: 0, y: 9, z: 11 }, target: { x: 0, y: 0, z: 0 }, fov: 55 },
    fog: { near: 25, far: 70 },
    entities: [
      { id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 24, h: 1, d: 24, color: '#6cc46c' }, body: { type: 'static' } },
      ...[[0, -12.5, 25, 1], [0, 12.5, 25, 1], [-12.5, 0, 1, 24], [12.5, 0, 1, 24]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 0.5, z, mesh: { geometry: 'box', w, h: 1.2, d, color: '#c9a77a' }, body: { type: 'static' } })),
      ...[[-5, -4], [5, 3], [-3, 6], [6, -6]].map(([x, z], i) => ({
        id: 'pillar' + i, name: 'Pillar', x, y: 1, z, mesh: { geometry: 'cylinder', r: 0.8, h: 2, color: '#e8e0d0' }, body: { type: 'static' } })),
      { id: 'player', name: 'Player', tags: ['player'], x: 0, y: 0.6, z: 0, mesh: { geometry: 'sphere', r: 0.6, color: '#3a7bff' },
        behaviors: [{ type: 'move', speed: 7, control: 'joystick' }, { type: 'cameraFollow', oy: 9, oz: 10, smooth: 5 }] },
      ...[[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -9], [0, 9], [-9, 0], [9, 0]].map(([x, z], i) => ({
        id: 'gem' + i, name: 'Gem', x, y: 0.9, z, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.6, h: 0.6, d: 0.6, color: '#ffd23d', emissive: 0.5 },
        behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'collectible', score: 10 }] })),
      ...[[[-6, 0], 0, 8], [[2, -9], 6, 0], [[9, 4], 0, -8]].map(([[x, z], dx, dz], i) => ({
        id: 'enemy' + i, name: 'Enemy', x, y: 0.5, z, mesh: { geometry: 'box', w: 1, h: 1, d: 1, color: '#ff4d6d' },
        behaviors: [{ type: 'patrol', dx, dz, duration: 2.5 + i * 0.4 }, { type: 'hazard', action: 'damage' }, { type: 'rotate', axis: 'y', speed: 90 }] })),
      ...hud([{ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } }]),
    ],
  },

  'tap-frenzy': {
    version: 1, name: 'Tap Frenzy', mode: '2d', background: '#16233b', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TAP FRENZY', subtitle: 'Pop the bubbles, avoid the bombs. 30 seconds!', saveBest: 'tap-frenzy', timeLimit: 30, orientation: 'portrait' },
    vars: { score: 0 },
    entities: [
      { id: 'bubble-spawner', name: 'Bubble Spawner', x: 60, y: 120, behaviors: [{ type: 'spawner', template: 'Bubble', every: [0.35, 0.7], x: [50, 350], y: [160, 640], ramp: 0.2, max: 12 }] },
      { id: 'bomb-spawner', name: 'Bomb Spawner', x: 340, y: 120, behaviors: [{ type: 'spawner', template: 'Bomb', every: [1.2, 2.2], x: [50, 350], y: [160, 640], ramp: 0.1, max: 4 }] },
      { id: 'bubble', name: 'Bubble', template: true, x: 120, y: 300, shape: { type: 'circle', r: 30, fill: 'rgba(80,200,255,0.35)', stroke: '#7fdcff', lineWidth: 3, glow: 10 },
        behaviors: [{ type: 'tappable', points: 10, destroy: true, sound: 'coin' }, { type: 'pulse', amount: 0.08, period: 0.9 }, { type: 'lifetime', seconds: 1.8 }] },
      { id: 'bomb', name: 'Bomb', template: true, x: 280, y: 300, shape: { type: 'circle', r: 26, fill: '#222', stroke: '#ff4d6d', lineWidth: 4 },
        behaviors: [{ type: 'tappable', points: -30, destroy: true, sound: 'hit' }, { type: 'pulse', amount: 0.15, period: 0.4 }, { type: 'lifetime', seconds: 1.6 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-time', name: 'Timer Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '{time}s', size: 24, align: 'right', color: '#ffd23d' } },
    ],
  },

  'fps-arena': {
    version: 1, name: 'Target Range', mode: '3d', background: '#9ec9ef', gravity: -25,
    settings: { title: 'TARGET RANGE', subtitle: 'Joystick to walk, drag to aim, hold FIRE to shoot', joystick: true, actionButton: true, jumpButton: true, winScore: 80, orientation: 'landscape' },
    vars: { score: 0, lives: 3 }, fog: { near: 30, far: 80 },
    camera: { position: { x: 0, y: 1.6, z: 8 }, target: { x: 0, y: 1.6, z: 0 }, fov: 70 },
    entities: [
      { id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 40, h: 1, d: 40, color: '#7a9e6a' }, body: { type: 'static' } },
      ...[[0, -20, 41, 1], [0, 20, 41, 1], [-20, 0, 1, 40], [20, 0, 1, 40]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 1.5, z, mesh: { geometry: 'box', w, h: 3, d, color: '#c9b79c' }, body: { type: 'static' } })),
      ...[[-4, 2], [3, -1], [-7, -6], [6, -8], [0, -4]].map(([x, z], i) => ({
        id: 'crate' + i, name: 'Crate', x, y: 0.75, z, mesh: { geometry: 'box', w: 1.5, h: 1.5, d: 1.5, color: '#b58a5a' }, body: { type: 'static' } })),
      { id: 'player', name: 'Player', tags: ['player'], x: 0, y: 1, z: 8, mesh: { geometry: 'box', w: 0.8, h: 1.8, d: 0.8, color: '#4f8ef7' },
        behaviors: [{ type: 'firstPerson', speed: 6, look: 0.25, eye: 0.6, jump: 9 }, { type: 'shooter', template: 'Bullet', every: 0.18, trigger: 'action button' }] },
      { id: 'bullet', name: 'Bullet', template: true, tags: ['bullet'], x: 2, y: 1, z: 6, mesh: { geometry: 'sphere', r: 0.15, color: '#fff59d', emissive: 1 },
        behaviors: [{ type: 'projectile', speed: 30, life: 1.5 }] },
      ...[[-6, 2, -12], [-2, 3, -15], [3, 1.6, -13], [8, 2.4, -14], [-10, 1.8, -8], [11, 2.2, -4], [-12, 2.6, 4], [12, 1.8, 6]].map(([x, y, z], i) => ({
        id: 'target' + i, name: 'Target', x, y, z, mesh: { geometry: 'box', w: 1.2, h: 1.2, d: 0.4, color: '#e53935', emissive: 0.15 },
        behaviors: [{ type: 'destructible', hp: 1, hitBy: 'bullet', points: 10, removeHitter: true }, { type: 'float', amount: 0.3, period: 2 + i * 0.2 }] })),
      ...[[-14, -14], [14, -14]].map(([x, z], i) => ({
        id: 'drone' + i, name: 'Drone', x, y: 0.6, z, mesh: { geometry: 'sphere', r: 0.6, color: '#8e24aa' },
        behaviors: [{ type: 'chase', speed: 2.2, range: 14 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destructible', hp: 3, hitBy: 'bullet', points: 0 }] })),
      { id: 'crosshair', name: 'Crosshair', ui: true, anchor: 'center', x: 0, y: 0, text: { value: '+', size: 34, color: '#ffffff' } },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } },
    ],
  },

  'tps-adventure': {
    version: 1, name: 'Sky Islands', mode: '3d', background: '#a8d8f0', gravity: -25,
    settings: { title: 'SKY ISLANDS', subtitle: 'Joystick to run, drag to look around, JUMP between islands', joystick: true, jumpButton: true },
    vars: { score: 0, lives: 3 }, fog: { near: 35, far: 95 },
    entities: [
      ...[[0, -0.5, 0, 9, 9, '#6cc46c'], [0, 0.5, -11, 5, 5, '#78c878'], [7, 1.5, -18, 5, 5, '#6cc46c'], [0, 2.5, -26, 6, 6, '#78c878'], [-8, 3.5, -33, 5, 5, '#6cc46c'], [0, 4.5, -42, 9, 9, '#8bd38b']].map(([x, y, z, w, d, color], i) => ({
        id: 'island' + i, name: i === 5 ? 'Goal Island' : 'Island', x, y, z, mesh: { geometry: 'box', w, h: 1, d, color }, body: { type: 'static' } })),
      { id: 'player', name: 'Hero', tags: ['player'], x: 0, y: 1, z: 2, mesh: { geometry: 'cylinder', r: 0.4, h: 1.4, color: '#ff8a3d' },
        behaviors: [{ type: 'thirdPerson', speed: 6, jump: 10, distance: 7, height: 25, look: 0.3 }] },
      ...[[0, 1.6, -11], [7, 2.6, -18], [0, 3.6, -26], [-8, 4.6, -33], [2, 5.6, -42], [-2, 5.6, -42]].map(([x, y, z], i) => ({
        id: 'gem' + i, name: 'Gem', x, y, z, rx: 45, rz: 45, mesh: { geometry: 'box', w: 0.5, h: 0.5, d: 0.5, color: '#4dd0e1', emissive: 0.5 },
        behaviors: [{ type: 'rotate', axis: 'y', speed: 120 }, { type: 'float', amount: 0.2, period: 1.5 }, { type: 'collectible', score: 10 }] })),
      { id: 'cp', name: 'Checkpoint', x: 0, y: 3.75, z: -24, mesh: { geometry: 'cylinder', r: 0.15, h: 1.5, color: '#90a4ae' }, behaviors: [{ type: 'checkpoint', text: 'Checkpoint!' }] },
      { id: 'enemy', name: 'Spiky', x: -8, y: 4.5, z: -33, mesh: { geometry: 'cone', r: 0.5, h: 1, color: '#e53935' },
        behaviors: [{ type: 'patrol', dx: 3, dy: 0, dz: 0, duration: 2 }, { type: 'hazard', action: 'damage' }] },
      { id: 'goal', name: 'Goal', x: 0, y: 6, z: -44, mesh: { geometry: 'cylinder', r: 0.7, h: 2, color: '#ffd23d', emissive: 0.5, opacity: 0.8 }, behaviors: [{ type: 'goal' }, { type: 'rotate', axis: 'y', speed: 60 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff3d6d' } },
    ],
  },

  'racer': {
    version: 1, name: 'Desert Rally', mode: '3d', background: '#f2d3a0', gravity: -25,
    settings: { title: 'DESERT RALLY', subtitle: 'Push the joystick up to drive. Grab every flag before time runs out!', joystick: true, timeLimit: 60, winScore: 120, orientation: 'landscape' },
    vars: { score: 0 }, fog: { near: 40, far: 120 },
    entities: [
      { id: 'ground', name: 'Desert', locked: true, y: -0.5, mesh: { geometry: 'box', w: 120, h: 1, d: 120, color: '#d9b27a' }, body: { type: 'static' } },
      ...[[0, -60, 121, 1], [0, 60, 121, 1], [-60, 0, 1, 120], [60, 0, 1, 120]].map(([x, z, w, d], i) => ({
        id: 'wall' + i, name: 'Wall', locked: true, x, y: 1, z, mesh: { geometry: 'box', w, h: 2, d, color: '#b08860' }, body: { type: 'static' } })),
      { id: 'car', name: 'Car', tags: ['player'], x: 0, y: 0.5, z: 30, ry: 90, mesh: { geometry: 'box', w: 1.4, h: 0.8, d: 2.4, color: '#e53935' },
        behaviors: [{ type: 'car', maxSpeed: 18, accel: 12, turn: 110, autoGas: false, chaseCam: true }] },
      ...Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return {
        id: 'flag' + i, name: 'Flag', x: Math.round(Math.sin(a) * 30 * 10) / 10, y: 1.5, z: Math.round(Math.cos(a) * 30 * 10) / 10,
        mesh: { geometry: 'cylinder', r: 0.5, h: 3, color: '#ffd23d', emissive: 0.5 }, behaviors: [{ type: 'collectible', score: 10 }, { type: 'pulse', amount: 0.1, period: 1 }] }; }),
      ...[[8, 12], [-10, 6], [15, -12], [-18, -20], [0, -5], [22, 18], [-25, 25], [5, -28]].map(([x, z], i) => ({
        id: 'rock' + i, name: 'Rock', x, y: 0.8, z, mesh: { geometry: 'cone', r: 1.2, h: 1.6, color: '#8d6e63' }, body: { type: 'static' } })),
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-time', name: 'Timer Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '{time}s', size: 26, align: 'right', color: '#5d4037' } },
    ],
  },

  'idle-clicker': {
    version: 1, name: 'Cookie Tap', mode: '2d', background: '#3b2a20', view: { width: 400, height: 700 }, gravity: 0,
    settings: { orientation: 'portrait', pauseButton: false, muteButton: false, saveProgress: true },
    vars: { score: 0, perSecond: 0, perTap: 0 },
    entities: [
      { id: 'bank', name: 'Bank', x: 40, y: 40, behaviors: [{ type: 'income', var: 'score', rateVar: 'perSecond' }] },
      { id: 'cookie', name: 'Cookie', x: 200, y: 280, shape: { type: 'circle', r: 95, fill: '#c68642', stroke: '#8d5524', lineWidth: 8 },
        behaviors: [{ type: 'tappable', points: 1, var: 'score', bonusVar: 'perTap', destroy: false, sound: 'click' }, { type: 'pulse', amount: 0.03, period: 1.2 }] },
      ...[[170, 245], [230, 300], [185, 330], [235, 240], [150, 300]].map(([x, y], i) => ({
        id: 'chip' + i, name: 'Chip', x, y, layer: 1, shape: { type: 'circle', r: 9, fill: '#4e342e' } })),
      { id: 'hud-score', name: 'Cookies', ui: true, anchor: 'top', x: 0, y: 56, text: { value: '{score}', size: 46, color: '#ffe0b2' } },
      { id: 'hud-rate', name: 'Rate', ui: true, anchor: 'top', x: 0, y: 100, text: { value: 'cookies · {perSecond} per second', size: 16, color: '#d7ccc8', weight: '600' } },
      { id: 'up1', name: 'Auto Baker', ui: true, anchor: 'bottom', x: 0, y: -250, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#5d4037' },
        text: { value: 'Auto Baker  +1/s  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 15, costVar: 'score', addVar: 'perSecond', amount: 1, growth: 1.15 }] },
      { id: 'up2', name: 'Strong Fingers', ui: true, anchor: 'bottom', x: 0, y: -175, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#5d4037' },
        text: { value: 'Strong Fingers  +1/tap  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 25, costVar: 'score', addVar: 'perTap', amount: 1, growth: 1.3 }] },
      { id: 'up3', name: 'Bakery', ui: true, anchor: 'bottom', x: 0, y: -100, shape: { type: 'rect', w: 340, h: 62, radius: 14, fill: '#6d4c41' },
        text: { value: 'Bakery  +8/s  ·  {cost}', size: 18, color: '#fff3e0', weight: '700' }, behaviors: [{ type: 'upgrade', cost: 200, costVar: 'score', addVar: 'perSecond', amount: 8, growth: 1.2 }] },
    ],
  },

  'space-shooter': {
    version: 1, name: 'Star Defender', mode: '2d', background: '#0a0f24', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'STAR DEFENDER', subtitle: 'Drag to move. Your ship fires on its own.', saveBest: 'star-defender', orientation: 'portrait' },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'ship', name: 'Ship', tags: ['player'], x: 200, y: 600, layer: 3, shape: { type: 'triangle', w: 40, h: 46, fill: '#4fc3f7', glow: 12 },
        behaviors: [{ type: 'move', control: 'drag', speed: 300, axes: 'all', keepInView: true }, { type: 'shooter', template: 'Bullet', every: 0.22, trigger: 'auto' }] },
      { id: 'bullet', name: 'Bullet', template: true, tags: ['bullet'], x: 60, y: 520, shape: { type: 'rect', w: 5, h: 16, radius: 2, fill: '#fff59d' },
        behaviors: [{ type: 'projectile', speed: 700, life: 1.2 }] },
      { id: 'alien', name: 'Alien', template: true, x: 120, y: 160, shape: { type: 'rect', w: 38, h: 30, radius: 9, fill: '#ab47bc' },
        behaviors: [{ type: 'velocity', vy: [90, 160] }, { type: 'destructible', hp: 1, hitBy: 'bullet', points: 10 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destroyOffscreen' }] },
      { id: 'boss', name: 'Big Alien', template: true, x: 280, y: 160, shape: { type: 'rect', w: 70, h: 50, radius: 14, fill: '#e53935', glow: 8 },
        behaviors: [{ type: 'velocity', vy: 55 }, { type: 'destructible', hp: 6, hitBy: 'bullet', points: 60 }, { type: 'hazard', action: 'damage', destroySelf: true }, { type: 'destroyOffscreen' }] },
      { id: 'star', name: 'Star Dust', template: true, layer: -5, x: 200, y: 100, shape: { type: 'rect', w: 2, h: 6, fill: 'rgba(255,255,255,0.6)' },
        behaviors: [{ type: 'velocity', vy: [180, 320] }, { type: 'destroyOffscreen' }] },
      { id: 'sp1', name: 'Alien Spawner', x: 60, y: 40, behaviors: [{ type: 'spawner', template: 'Alien', every: [0.6, 1.2], x: [30, 370], y: -40, ramp: 0.15, max: 30 }] },
      { id: 'sp2', name: 'Boss Spawner', x: 200, y: 40, behaviors: [{ type: 'spawner', template: 'Big Alien', every: [6, 9], x: [60, 340], y: -60, ramp: 0.05, max: 3 }] },
      { id: 'sp3', name: 'Star Spawner', x: 340, y: 40, behaviors: [{ type: 'spawner', template: 'Star Dust', every: [0.05, 0.15], x: [0, 400], y: -10, ramp: 0, max: 80 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
    ],
  },

  'lane-runner': {
    version: 1, name: 'Lane Rush', mode: '3d', background: '#7ec8e3', gravity: -25,
    settings: { title: 'LANE RUSH', subtitle: 'Swipe left/right to dodge, swipe up to jump', saveBest: 'lane-rush', orientation: 'portrait' },
    vars: { score: 0 }, fog: { near: 25, far: 70 },
    camera: { position: { x: 0, y: 5, z: 8 }, target: { x: 0, y: 0.5, z: -4 }, fov: 60 },
    entities: [
      { id: 'road', name: 'Road', locked: true, y: -0.5, z: -80, mesh: { geometry: 'box', w: 9, h: 1, d: 200, color: '#5d6d7e' }, body: { type: 'static' } },
      ...[-1.25, 1.25].map((x, i) => ({ id: 'stripe' + i, name: 'Lane Line', locked: true, x, y: 0.01, z: -80, mesh: { geometry: 'plane', w: 0.12, d: 200, color: '#ecf0f1' } })),
      { id: 'runner', name: 'Runner', tags: ['player'], x: 0, y: 0.5, z: 0, mesh: { geometry: 'box', w: 0.8, h: 1, d: 0.8, color: '#ffca28' },
        behaviors: [{ type: 'swipeMove', distance: 2.5, lanes: 3, jump: 9 }, { type: 'timeScore', rate: 10 }] },
      { id: 'block', name: 'Barrier', template: true, x: -3, y: 0.6, z: -10, mesh: { geometry: 'box', w: 1.8, h: 1.2, d: 0.8, color: '#e53935' },
        behaviors: [{ type: 'velocity', vz: 16 }, { type: 'hazard', action: 'gameover' }, { type: 'destroyOffscreen', margin: 80 }] },
      { id: 'coin', name: 'Coin', template: true, x: 3, y: 0.8, z: -10, rx: 90, mesh: { geometry: 'cylinder', r: 0.35, h: 0.1, color: '#ffd23d', emissive: 0.6 },
        behaviors: [{ type: 'velocity', vz: 16 }, { type: 'collectible', score: 25 }, { type: 'destroyOffscreen', margin: 80 }] },
      { id: 'sp1', name: 'Barrier Spawner', x: -3, y: 2, z: -20, behaviors: [{ type: 'spawner', template: 'Barrier', every: [0.55, 1.1], x: [-2.5, 2.5], y: 0.6, z: -60, ramp: 0.12, max: 40, snap: 2.5, clear: 2 }] },
      { id: 'sp2', name: 'Coin Spawner', x: 3, y: 2, z: -20, behaviors: [{ type: 'spawner', template: 'Coin', every: [0.35, 0.8], x: [-2.5, 2.5], y: 0.8, z: -60, ramp: 0.12, max: 40, snap: 2.5, clear: 2 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-best', name: 'Best Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: 'BEST {best}', size: 15, align: 'right', color: '#1b4f72' } },
    ],
  },

  'breakout': {
    version: 1, name: 'Brick Breaker', mode: '2d', background: '#14142b', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'BRICK BREAKER', subtitle: 'Drag to move the paddle. Break every brick!', orientation: 'portrait', winScore: 350, saveBest: 'brick-breaker' },
    vars: { score: 0, lives: 3 },
    entities: [
      { id: 'paddle', name: 'Paddle', tags: ['player'], x: 200, y: 630, shape: { type: 'rect', w: 90, h: 16, radius: 8, fill: '#4fc3f7', glow: 10 }, body: { type: 'kinematic' },
        behaviors: [{ type: 'move', control: 'drag', speed: 0, axes: 'horizontal', keepInView: true }] },
      { id: 'ball', name: 'Ball', tags: ['ball'], x: 200, y: 560, shape: { type: 'circle', r: 9, fill: '#ffffff', glow: 8 },
        behaviors: [{ type: 'bounce', speed: 360, bottom: 'lose a life' }] },
      ...Array.from({ length: 35 }, (_, i) => {
        const row = Math.floor(i / 7), col = i % 7;
        return { id: 'brick' + i, name: 'Brick', x: 44 + col * 52, y: 130 + row * 28, shape: { type: 'rect', w: 46, h: 20, radius: 4, fill: ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5'][row] },
          body: { type: 'static' }, behaviors: [{ type: 'destructible', hp: 1, hitBy: 'ball', points: 10, removeHitter: false }] };
      }),
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } },
    ],
  },

  'rpg-battle': {
    version: 1, name: 'Slime Battle', mode: '2d', background: '#1e2a38', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'SLIME BATTLE', subtitle: 'A turn-based fight. Pick an action each turn.', turnBased: true, turnDelay: 1, orientation: 'portrait', pauseButton: false, messageTop: true },
    vars: { hp: 60, mp: 12, enemyHp: 90, score: 0 },
    entities: [
      { id: 'floor', name: 'Floor', x: 200, y: 360, shape: { type: 'rect', w: 400, h: 120, fill: '#2c3e50' } },
      { id: 'slime', name: 'Slime', x: 200, y: 270, shape: { type: 'circle', r: 70, fill: '#66bb6a', stroke: '#2e7d32', lineWidth: 6 },
        behaviors: [{ type: 'turnOpponent', var: 'hp', amount: [-12, -6], text: 'The slime bounces on you for {n}!' }, { type: 'pulse', amount: 0.04, period: 1.4 }] },
      ...[[175, 255], [225, 255]].map(([x, y], i) => ({ id: 'eye' + i, name: 'Eye', x, y, layer: 1, shape: { type: 'circle', r: 9, fill: '#1b1b1b' } })),
      { id: 'enemy-hp', name: 'Enemy HP', ui: true, anchor: 'top', x: 0, y: 104, text: { value: 'Slime  HP {enemyHp}', size: 22, color: '#a5d6a7' } },
      { id: 'turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 72, text: { value: '{turnText}', size: 18, color: '#ffd23d', weight: '700' } },
      { id: 'hp', name: 'Player HP', ui: true, anchor: 'bottom-left', x: 24, y: -300, text: { value: 'HP {hp}', size: 22, align: 'left', color: '#ef9a9a' } },
      { id: 'mp', name: 'Player MP', ui: true, anchor: 'bottom-right', x: -24, y: -300, text: { value: 'MP {mp}', size: 22, align: 'right', color: '#90caf9' } },
      ...[
        ['Attack', 'enemyHp', [-14, -8], 0, '', 0, 'You strike for {n}!', 'hit', '#455a64', -230],
        ['Fireball  (4 MP)', 'enemyHp', [-26, -18], 0, 'mp', 4, 'Fireball! {n} damage!', 'power', '#bf360c', -160],
        ['Heal  (3 MP)', 'hp', [14, 22], 60, 'mp', 3, 'You heal {n} HP.', 'coin', '#2e7d32', -90],
      ].map(([label, v, amount, max, costVar, cost, text, sound, fill, y], i) => ({
        id: 'act' + i, name: label.split(' ')[0] + ' Button', ui: true, anchor: 'bottom', x: 0, y,
        shape: { type: 'rect', w: 330, h: 58, radius: 14, fill }, text: { value: label, size: 20, color: '#ffffff' },
        behaviors: [{ type: 'turnAction', var: v, amount, max, costVar, cost, text, sound }] })),
      { id: 'win', name: 'Win Check', x: 30, y: 30, behaviors: [{ type: 'condition', var: 'enemyHp', op: '<=', target: 0, action: 'win', value: '', amount: 1, sound: 'none' }] },
      { id: 'lose', name: 'Lose Check', x: 370, y: 30, behaviors: [{ type: 'condition', var: 'hp', op: '<=', target: 0, action: 'game over', value: '', amount: 1, sound: 'none' }] },
    ],
  },

  'dungeon': {
    version: 1, name: 'Tiny Dungeon', mode: '2d', background: '#120f1a', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TINY DUNGEON', subtitle: 'Turn-based: swipe or tap to step. Bump monsters to fight. Reach the stairs!', turnBased: true, turnDelay: 0.15, orientation: 'portrait' },
    vars: { score: 0, lives: 3 },
    entities: (() => {
      const map = ['#########', '#P..#..c#', '#.#.#.#.#', '#.#...#.#', '#.##E##.#', '#c......#', '###.#.###', '#...#..E#', '#.#c#.#.#', '#.#.....#', '#E..##.c#', '#..#...G#', '#########'];
      const out = [], at = (c, r) => ({ x: 40 + c * 40, y: 130 + r * 40 });
      map.forEach((row, r) => [...row].forEach((ch, c) => {
        const { x, y } = at(c, r), id = `t${r}_${c}`;
        if (ch === '#') out.push({ id, name: 'Wall', x, y, shape: { type: 'rect', w: 40, h: 40, fill: '#4a3f5c', stroke: '#2b2438', lineWidth: 2 }, body: { type: 'static' } });
        else out.push({ id: id + 'f', name: 'Floor', layer: -1, x, y, shape: { type: 'rect', w: 40, h: 40, fill: (r + c) % 2 ? '#211b2d' : '#1c1726' } });
        if (ch === 'P') out.push({ id: 'hero', name: 'Hero', tags: ['player'], layer: 3, x, y, shape: { type: 'circle', r: 15, fill: '#4fc3f7' }, behaviors: [{ type: 'gridMove', tile: 40, tapToMove: true, damage: 1 }] });
        if (ch === 'E') out.push({ id: id + 'e', name: 'Goblin', layer: 2, x, y, shape: { type: 'rect', w: 28, h: 28, radius: 8, fill: '#e53935' }, behaviors: [{ type: 'gridEnemy', tile: 40, hp: 2, points: 25, sight: 5 }] });
        if (ch === 'c') out.push({ id: id + 'c', name: 'Gold', layer: 1, x, y, shape: { type: 'star', w: 22, h: 22, fill: '#ffd23d' }, behaviors: [{ type: 'collectible', score: 10 }] });
        if (ch === 'G') out.push({ id: 'stairs', name: 'Stairs', layer: 1, x, y, shape: { type: 'rect', w: 30, h: 30, radius: 4, fill: '#66bb6a' }, behaviors: [{ type: 'goal' }] });
      }));
      out.push({ id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 28, align: 'left' } });
      out.push({ id: 'hud-lives', name: 'Lives Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '♥ {lives}', size: 24, align: 'right', color: '#ff5d8f' } });
      out.push({ id: 'hud-turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 80, text: { value: 'Turn {turn} · {turnText}', size: 15, color: '#b39ddb', weight: '600' } });
      return out;
    })(),
  },

  'app-todo': todoApp(),
  'app-notes': notesApp(),
  'app-expenses': expensesApp(),
  'app-blank': blankApp(),
  'app-social': socialApp(),
  'squad-tactics': squadGame(true),
  'squad-rts': squadGame(false),

  'tic-tac-toe': {
    version: 1, name: 'Tic-Tac-Toe', mode: '2d', background: '#1b2433', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'TIC-TAC-TOE', subtitle: 'Three in a row beats the computer', turnBased: true, orientation: 'portrait', pauseButton: false },
    vars: { score: 0 },
    entities: [
      ...Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3), c = i % 3;
        return { id: 'cell' + i, name: `Cell ${r + 1}-${c + 1}`, x: 90 + c * 110, y: 240 + r * 110, shape: { type: 'rect', w: 100, h: 100, radius: 14, fill: '#2a3550' },
          behaviors: [{ type: 'boardCell', row: r, col: c, line: 3, vsComputer: true }] };
      }),
      { id: 'hud-turn', name: 'Turn Text', ui: true, anchor: 'top', x: 0, y: 96, text: { value: '{turnText}', size: 22, color: '#ffd23d' } },
    ],
  },

  'online-rush': {
    version: 1, name: 'Online Coin Rush', mode: '2d', background: '#0f2027', view: { width: 400, height: 700 }, gravity: 0,
    settings: { title: 'COIN RUSH ONLINE', subtitle: 'Grab more coins than everyone else in 60 seconds!', joystick: true, timeLimit: 60, saveBest: 'online-rush', orientation: 'portrait',
      playfab: { titleId: '', autoLogin: true }, photon: { appId: '', autoJoin: true, maxPlayers: 6, region: 'eu', appVersion: '1.0' } },
    vars: { score: 0, netState: 'offline', netPlayers: 0 },
    entities: [
      ...[[200, 104, 400, 16], [200, 696, 400, 16], [8, 400, 16, 600], [392, 400, 16, 600]].map(([x, y, w, h], i) => ({ id: 'wall' + i, name: 'Wall', x, y, shape: { type: 'rect', w, h, fill: '#1f4450' }, body: { type: 'static' } })),
      { id: 'player', name: 'Player', tags: ['player'], x: 200, y: 400, layer: 2, shape: { type: 'circle', r: 16, fill: '#33f0ff', glow: 14 }, body: { type: 'dynamic', gravityScale: 0 },
        behaviors: [{ type: 'move', control: 'joystick', speed: 260 }, { type: 'netSync', rate: 15, solid: false }] },
      { id: 'coin-spawner', name: 'Coin Spawner', x: 200, y: 120, behaviors: [{ type: 'spawner', template: 'Coin', every: [0.5, 1.1], x: [40, 360], y: [140, 660], ramp: 0, max: 12, clear: 34, online: 'room host spawns for everyone' }] },
      { id: 'coin', name: 'Coin', template: true, x: 120, y: 300, shape: { type: 'circle', r: 11, fill: '#ffd23d', stroke: '#fff3b0', lineWidth: 3 }, behaviors: [{ type: 'collectible', score: 10 }] },
      { id: 'hud-score', name: 'Score Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: '{score}', size: 30, align: 'left' } },
      { id: 'hud-time', name: 'Time Text', ui: true, anchor: 'top-right', x: -20, y: 34, text: { value: '{time}s', size: 24, align: 'right', color: '#9fe8ff' } },
      { id: 'hud-net', name: 'Online Status', ui: true, anchor: 'top', x: 0, y: 72, text: { value: '● {netPlayers} in room', size: 14, color: '#7dffb0', weight: '700' },
        behaviors: [{ type: 'uiShowIf', var: 'netState', op: '=', value: 'room', whenUnset: false, anim: 'fade' }] },
      { id: 'hud-solo', name: 'Solo Hint', ui: true, anchor: 'top', x: 0, y: 72, text: { value: 'Solo · add a Photon App ID (Game Settings › Online) to play with friends', size: 12, color: 'rgba(255,255,255,0.6)', wrap: 340 },
        behaviors: [{ type: 'uiShowIf', var: 'netState', op: '≠', value: 'room', whenUnset: true, anim: 'fade' }] },
      { id: 'over', name: 'Results', ui: true, anchor: 'center', x: 0, y: 0, showWhen: 'over', shape: { type: 'rect', w: 320, h: 470, radius: 24, fill: '#162b33', stroke: 'rgba(255,255,255,0.15)', lineWidth: 2 } },
      { id: 'over-title', name: 'Results Title', parent: 'over', ui: true, anchor: 'top', x: 0, y: 40, text: { value: 'TIME!  {score} coins', size: 24, color: '#ffd23d', weight: '900' } },
      { id: 'over-board', name: 'Leaderboard Rows', parent: 'over', ui: true, anchor: 'left', x: 30, y: -10, text: { value: '', size: 17, color: '#ffffff', align: 'left', weight: '700', lineHeight: 1.55 },
        behaviors: [{ type: 'pfLeaderboard', stat: 'coins', count: 8, around: false, refreshOn: 'leaderboard', format: '{rank}. {name}  {value}' }] },
      { id: 'over-again', name: 'Play Again', parent: 'over', ui: true, anchor: 'bottom', x: 0, y: -40, shape: { type: 'rect', w: 200, h: 52, radius: 16, fill: '#2e8b57' }, text: { value: 'Play again', size: 18, color: '#ffffff', weight: '800' },
        behaviors: [{ type: 'button', action: 'restart game', value: '', amount: 1, sound: 'click' }] },
      { id: 'logic', name: 'Online Logic', x: 0, y: 0, behaviors: [{ type: 'graph', graph: {
        nodes: [{ id: 'g', type: 'onGameOver', x: 20, y: 40, params: {} }, { id: 'p', type: 'pfSubmit', x: 320, y: 30, params: { stat: 'coins' } }, { id: 'v', type: 'getVar', x: 20, y: 200, params: { name: 'score' } }],
        links: [{ from: { node: 'g', port: 'then' }, to: { node: 'p', port: 'in' } }, { from: { node: 'v', port: 'value' }, to: { node: 'p', port: 'value' } }] } }] },
    ],
  },

  'voxel-world': {
    version: 1, name: 'Block Craft', mode: '3d', background: '#8fd0ff', gravity: -25,
    settings: { title: 'BLOCK CRAFT', subtitle: 'Left thumb: walk. Right thumb: drag to look, hold on a block to mine it, tap to place. Pick blocks in the hotbar.', joystick: true, jumpButton: true, pauseButton: true, orientation: 'landscape' },
    vars: { score: 0, blocks: 0 }, fog: { near: 22, far: 52 }, light: { dir: { x: -0.5, y: -1, z: -0.3 }, color: '#ffffff', ambient: 0.5 },
    camera: { position: { x: 0, y: 14, z: 14 }, target: { x: 0, y: 4, z: 0 }, fov: 70 },
    entities: [
      { id: 'world', name: 'World', voxels: { size: 1, gen: { type: 'hills', w: 48, d: 48, h: 7, seed: 7, trees: true }, edits: {} } },
      { id: 'player', name: 'Player', tags: ['player'], x: 0.5, y: 14, z: 0.5, mesh: { geometry: 'box', w: 0.6, h: 1.7, d: 0.6, color: '#4f8ef7' },
        behaviors: [{ type: 'firstPerson', speed: 4.3, look: 0.3, eye: 0.65, jump: 8.5, autoJump: true }, { type: 'voxelBuilder', reach: 5, controls: 'hold to mine', aim: 'finger', hotbar: '1,2,3,4,5,6,8,9,12', inventory: 'creative', mineSpeed: 1 }] },
      { id: 'hud', name: 'Blocks Text', ui: true, anchor: 'top-left', x: 20, y: 34, text: { value: 'Mined {blocks}', size: 20, align: 'left' } },
    ],
  },

  'empty-2d': {
    version: 1, name: 'Empty 2D', mode: '2d', background: '#0b0b1a', view: { width: 400, height: 700 }, gravity: 1600,
    settings: {}, vars: { score: 0 }, entities: [],
  },
  'empty-3d': {
    version: 1, name: 'Empty 3D', mode: '3d', background: '#8fc4ef', gravity: -25,
    settings: {}, vars: { score: 0 },
    camera: { position: { x: 0, y: 8, z: 12 }, target: { x: 0, y: 0, z: 0 }, fov: 60 },
    entities: [{ id: 'ground', name: 'Ground', locked: true, y: -0.5, mesh: { geometry: 'box', w: 20, h: 1, d: 20, color: '#6cc46c' }, body: { type: 'static' } }],
  },
};

/** Game types for the editor's "New Game" screen. */
export const templateInfo = [
  { key: 'jump-quest', title: 'Platformer', blurb: 'Run & jump, 2 levels', icon: 'jumper', color: '#2d3f6b' },
  { key: 'tps-adventure', title: 'Third Person', blurb: '3D adventure, follow camera', icon: 'player', color: '#3c6e8f' },
  { key: 'fps-arena', title: 'First Person', blurb: '3D shooter, look & aim', icon: 'crosshair', color: '#4a5a3a' },
  { key: 'gem-garden', title: 'Top Down 3D', blurb: 'Joystick, collect, avoid', icon: 'cube', color: '#3f6d4a' },
  { key: 'sky-dodge', title: 'Top Down 2D', blurb: 'Dodge and collect', icon: 'star', color: '#22314f' },
  { key: 'space-shooter', title: 'Space Shooter', blurb: 'Waves of enemies', icon: 'bolt', color: '#141b3a' },
  { key: 'racer', title: 'Racing', blurb: 'Drive, beat the clock', icon: 'car', color: '#8a6a3a' },
  { key: 'lane-runner', title: 'Endless Runner', blurb: 'Swipe between lanes', icon: 'arrow', color: '#2f6f8f' },
  { key: 'idle-clicker', title: 'Clicker / Idle', blurb: 'Tap, earn, upgrade (saves progress)', icon: 'hand', color: '#5d4037' },
  { key: 'online-rush', title: 'Online Coin Rush', blurb: 'Multiplayer + leaderboard (Photon, PlayFab)', icon: 'globe', color: '#0e5a5a' },
  { key: 'voxel-world', title: 'Voxel Sandbox', blurb: 'Minecraft-style mine & build', icon: 'cube', color: '#4e7d3a' },
  { key: 'rpg-battle', title: 'Turn-Based RPG', blurb: 'Pick attacks, heals and spells', icon: 'bolt', color: '#2e4057' },
  { key: 'dungeon', title: 'Dungeon Crawler', blurb: 'Turn-based grid adventure', icon: 'door', color: '#3b2f4f' },
  { key: 'squad-tactics', title: 'Squad Tactics', blurb: 'Command a squad, turn by turn', icon: 'flag', color: '#2b4428' },
  { key: 'squad-rts', title: 'Squad Battle', blurb: 'Select and move units in real time', icon: 'player', color: '#3a4a2a' },
  { key: 'tic-tac-toe', title: 'Board Game', blurb: 'Tic-tac-toe vs the computer', icon: 'grid', color: '#2a3550' },
  { key: 'breakout', title: 'Breakout', blurb: 'Bounce the ball, break bricks', icon: 'square', color: '#2a2450' },
  { key: 'tap-frenzy', title: 'Tap Arcade', blurb: 'Quick tap reflex game', icon: 'circle', color: '#16233b' },
  { key: 'empty-2d', title: 'Blank 2D', blurb: 'Start from nothing', icon: 'grid', color: '#2b2b2b' },
  { key: 'app-blank', title: 'Blank App', blurb: 'App bar, tabs and pages', icon: 'phone', color: '#6366f1', kind: 'app' },
  { key: 'app-todo', title: 'To-Do List', blurb: 'Tasks you tick off, saved on the phone', icon: 'check', color: '#3a7bfd', kind: 'app' },
  { key: 'app-notes', title: 'Notes', blurb: 'Write, search and edit notes', icon: 'edit', color: '#f59e0b', kind: 'app' },
  { key: 'app-social', title: 'Social', blurb: 'Feed, stories, likes and a profile', icon: 'heart', color: '#1d9bf0', kind: 'app' },
  { key: 'app-expenses', title: 'Expense Tracker', blurb: 'Spending with a running total', icon: 'coin', color: '#10b981', kind: 'app' },
  { key: 'empty-3d', title: 'Blank 3D', blurb: 'Just a floor', icon: 'cube', color: '#2f3a44' },
];

/** An app with games inside: three mini games (levels 2–4), a Play button for each, best scores and a list of every play. */
function arcadeApp() {
  const A = '#8b5cf6', games = [['tap-frenzy', 'Tap Frenzy', '👆'], ['sky-dodge', 'Sky Dodge', '🚀'], ['breakout', 'Breakout', '🧱']];
  const levels = games.map(([key, title], gi) => {
    const lv = JSON.parse(JSON.stringify(templates[key])); delete lv.name; delete lv.version; delete lv.levels;
    lv.levelName = title; const ids = {};
    for (const e of lv.entities) { const n = `g${gi}-` + e.id; ids[e.id] = n; e.id = n; }
    for (const e of lv.entities) if (e.parent && ids[e.parent]) e.parent = ids[e.parent];
    return lv;
  });
  const card = (gi, [key, title, emoji]) => {
    const y = 40 + gi * 116, k = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return [
      { id: 'card' + gi, name: title + ' Card', parent: 'p-home', ui: true, anchor: 'top', x: 0, y: y + 50, stretch: 'width', margin: 16, shape: { type: 'rect', w: 368, h: 100, radius: 18, fill: '@card', shadow: '@shadow', shadowBlur: 14, shadowY: 4 },
        behaviors: [{ type: 'button', action: 'play game', value: title, amount: 1, sound: 'click', feel: 'spring', pressScale: 0.96 }] },
      { id: 'card' + gi + 'e', name: title + ' Icon', parent: 'card' + gi, ui: true, anchor: 'left', x: 46, y: 0, text: { value: emoji, size: 40 } },
      { id: 'card' + gi + 't', name: title + ' Name', parent: 'card' + gi, ui: true, anchor: 'left', x: 90, y: -14, text: { value: title, size: 20, color: INK, weight: '800', align: 'left' } },
      { id: 'card' + gi + 'b', name: title + ' Best', parent: 'card' + gi, ui: true, anchor: 'left', x: 90, y: 16, text: { value: 'Best: {best_' + k + '}', size: 14, color: MUTED, weight: '700', align: 'left' } },
      { id: 'card' + gi + 'p', name: title + ' Play', parent: 'card' + gi, ui: true, anchor: 'right', x: -50, y: 0, shape: { type: 'rect', w: 76, h: 40, radius: 20, fill: '@accent' }, text: { value: '▶ Play', size: 15, color: '@onAccent', weight: '800' } },
    ];
  };
  return {
    version: 1, name: 'Arcade', mode: '2d', background: '@bg', view: { width: 400, height: 700 }, gravity: 0,
    settings: { ...appSettings('Arcade', A), recordPlays: 'Scores' }, vars: { page: 'home', lastGame: '—', lastScore: 0 },
    collections: [{ name: 'Scores', fields: [{ name: 'Game', type: 'text' }, { name: 'Score', type: 'number' }, { name: 'Result', type: 'choice', options: 'won, lost, quit' }, { name: 'Date', type: 'date', default: 'today' }], rows: [] }],
    entities: [
      app.bar('home = Arcade\nscores = My Scores', A),
      { id: 'logic', name: 'App Logic', x: -100, y: -100, behaviors: games.map(([, title]) => ({ type: 'dataStat', collection: 'Scores', how: 'max', field: 'score', filter: `game = ${title}`, var: 'best_' + title.toLowerCase().replace(/[^a-z0-9]+/g, '_') })) },
      ...app.page('p-home', 'home', true, [{ ...app.text('last', 'Last Game Text', 'Last game: {lastGame} · {lastScore} points', 20, { size: 14, color: MUTED, weight: '700' }), behaviors: [{ type: 'uiShowIf', var: 'gamesPlayed', op: '>', value: '0', whenUnset: false, anim: 'fade' }] },
        { ...app.text('hello', 'Hello Text', 'Pick a game and beat your best!', 20, { size: 14, color: MUTED, weight: '700' }), behaviors: [{ type: 'uiShowIf', var: 'gamesPlayed', op: '≤', value: '0', whenUnset: true, anim: 'fade' }] }]),
      ...games.flatMap((g, gi) => card(gi, g)),
      ...app.page('p-scores', 'scores', false, [app.list('list', { top: 8, bottom: 90, list: { collection: 'Scores', title: '{game}', subtitle: '{result} · {date}', right: '{score}', sort: 'score (high-low)', empty: 'Play a game: every score lands here.' } })]),
      { id: 'nav', name: 'Bottom Nav', ui: true, anchor: 'bottom', x: 0, y: -38, stretch: 'width', margin: 0, layer: 5, shape: { type: 'rect', w: 400, h: 76, radius: 0, fill: '' },
        behaviors: [{ type: 'uiBottomNav', tabs: 'Games | play | home\nScores | trophy | scores', var: 'page', start: 1, style: 'pill', barColor: '@bar', activeColor: '@accent', idleColor: '@sub', otherPage: 'keep the last tab lit' }] },
    ],
    levels,
  };
}
templates['app-arcade'] = arcadeApp();
templateInfo.splice(templateInfo.findIndex((t) => t.key === 'app-expenses') + 1, 0, { key: 'app-arcade', title: 'Arcade', blurb: 'An app with 3 games inside and a score list', icon: 'gamepad', color: '#8b5cf6', kind: 'app' });

