// View as Code: a Visual Script written out as readable code (read-only), in JavaScript, Dart (Flutter), Kotlin or Swift.
// Events become on(...) handlers, Functions become async functions, If / loops become if / for / while,
// and every other node becomes a call named after it. Dart, Kotlin and Swift use app.get / app.set / app.add, the same
// API as the native exports' runtime. Each line remembers its node, so tapping a line finds it.

const ident = (s, fb = 'value') => { const t = String(s ?? '').trim().replace(/[^A-Za-z0-9_$]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^[^A-Za-z_$]+/, ''); return t || fb; };
const LOOP_VARS = ['i', 'j', 'k', 'm', 'n'];
/** (a + b) → a + b where the brackets wrap the whole thing (an if, a return, the right of =). */
const bare = (x) => { if (x[0] !== '(' || x[x.length - 1] !== ')') return x; let d = 0; for (let i = 0; i < x.length; i++) { if (x[i] === '(') d++; else if (x[i] === ')') d--; if (d === 0 && i < x.length - 1) return x; } return x.slice(1, -1); };
const isNum = (v) => typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v));
const keyName = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : ident(k, 'option'));
const KW_KOTLIN = new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' '));
const KW_DART = new Set('assert break case catch class const continue default do else enum extends false final finally for if in is new null rethrow return super switch this throw true try var void while with'.split(' '));
const kName = (k) => { const n = keyName(k); return KW_KOTLIN.has(n) ? '`' + n + '`' : n; };
const dName = (k) => { const n = keyName(k); return KW_DART.has(n) ? n + '_' : n; };

/** How each language writes the same things. */
const LANGS = {
  js: {
    label: 'JavaScript', q: (s) => JSON.stringify(String(s)), end: ';', aw: 'await ', eq: '===', ne: '!==',
    get: (k) => `vars.${ident(k)}`, set: (k, v) => `vars.${ident(k)} = ${v};`, add: (k, v) => `vars.${ident(k)} += ${v};`,
    pow: (a, b) => `(${a} ** ${b})`, mm: (f, a, b) => `Math.${f}(${a}, ${b})`, join: (xs, sep) => `[${xs.join(', ')}].join(${sep})`,
    named: (ps) => `{ ${ps.map(([k, v]) => `${keyName(k)}: ${v}`).join(', ')} }`,
    wait: (s) => `await wait(${s});`, ifH: (c) => `if (${c}) {`, whileH: (c) => `while (${c}) {`,
    forN: (v, n) => `for (let ${v} = 1; ${v} <= ${n}; ${v}++) {`, forR: (v, a, b, s) => `for (let ${v} = ${a}; ${v} <= ${b}; ${v} += ${s}) {`,
    fn: (name) => `async function ${name}(a, b, c) {`, on: (ev, opts) => `on(${JSON.stringify(ev)}, ${opts ? opts + ', ' : ''}async () => {`, onEnd: '});',
    swH: (x) => `switch (${x}) {`, swCase: (os) => os.map((o) => `case ${JSON.stringify(o)}:`), swBreak: 'break;', swEnd: [], banner: '// vars.x = a game variable',
  },
  dart: {
    label: 'Dart (Flutter)', q: (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'", end: ';', aw: 'await ', eq: '==', ne: '!=',
    get: (k) => `app.get('${k}')`, set: (k, v) => `app.set('${k}', ${v});`, add: (k, v) => `app.add('${k}', ${v});`,
    pow: (a, b) => `pow(${a}, ${b})`, mm: (f, a, b) => `${f}(${a}, ${b})`, join: (xs, sep) => `[${xs.join(', ')}].join(${sep})`,
    named: (ps) => ps.map(([k, v]) => `${dName(k)}: ${v}`).join(', '),
    wait: (s) => `await wait(${s});`, ifH: (c) => `if (${c}) {`, whileH: (c) => `while (${c}) {`,
    forN: (v, n) => `for (var ${v} = 1; ${v} <= ${n}; ${v}++) {`, forR: (v, a, b, s) => `for (var ${v} = ${a}; ${v} <= ${b}; ${v} += ${s}) {`,
    fn: (name) => `Future<num> ${name}(num a, num b, num c) async {`, on: (ev, opts) => `on('${ev}', ${opts ? opts + ', ' : ''}() async {`, onEnd: '});',
    swH: (x) => `switch (${x}) {`, swCase: (os) => os.map((o) => `case '${o}':`), swBreak: null, swEnd: [], banner: "// app.get / app.set / app.add: game variables (the same API as the Flutter export's lib/pocket.dart)",
  },
  kotlin: {
    label: 'Kotlin', q: (s) => JSON.stringify(String(s)).replace(/\$/g, '\\$'), end: '', aw: '', eq: '==', ne: '!=',
    get: (k) => `app.get("${k}")`, set: (k, v) => `app.set("${k}", ${v})`, add: (k, v) => `app.add("${k}", ${v})`,
    pow: (a, b) => `${a}.pow(${b})`, mm: (f, a, b) => `${f}Of(${a}, ${b})`, join: (xs, sep) => `listOf(${xs.join(', ')}).joinToString(${sep})`,
    named: (ps) => ps.map(([k, v]) => `${kName(k)} = ${v}`).join(', '),
    wait: (s) => `delay((${s} * 1000).toLong())`, ifH: (c) => `if (${c}) {`, whileH: (c) => `while (${c}) {`,
    forN: (v, n) => `for (${v} in 1..${n}) {`, forR: (v, a, b, s) => `for (${v} in ${a}..${b} step ${s}) {`,
    fn: (name) => `suspend fun ${name}(a: Double, b: Double, c: Double): Double {`, on: (ev, opts) => `on("${ev}"${opts ? ', ' + opts : ''}) {`, onEnd: '}',
    swH: (x) => `when (${x}) {`, swCase: (os) => [`${os.map((o) => JSON.stringify(o)).join(', ')} -> {`], swBreak: null, swEnd: ['}'], banner: '// app.get / app.set / app.add: game variables (the same API as the Kotlin export\'s Pocket.kt)',
  },
  swift: {
    label: 'Swift', q: (s) => JSON.stringify(String(s)), end: '', aw: 'await ', eq: '==', ne: '!=',
    get: (k) => `app.get("${k}")`, set: (k, v) => `app.set("${k}", ${v})`, add: (k, v) => `app.add("${k}", ${v})`,
    pow: (a, b) => `pow(${a}, ${b})`, mm: (f, a, b) => `${f}(${a}, ${b})`, join: (xs, sep) => `[${xs.join(', ')}].joined(separator: ${sep})`,
    named: (ps) => ps.map(([k, v]) => `${keyName(k)}: ${v}`).join(', '),
    wait: (s) => `try await Task.sleep(for: .seconds(${s}))`, ifH: (c) => `if ${c} {`, whileH: (c) => `while ${c} {`,
    forN: (v, n) => `for ${v} in 1...${n} {`, forR: (v, a, b, s) => `for ${v} in stride(from: ${a}, through: ${b}, by: ${s}) {`,
    fn: (name) => `func ${name}(_ a: Double, _ b: Double, _ c: Double) async -> Double {`, on: (ev, opts) => `on("${ev}"${opts ? ', ' + opts : ''}) {`, onEnd: '}',
    swH: (x) => `switch ${x} {`, swCase: (os) => [`case ${os.map((o) => JSON.stringify(o)).join(', ')}:`], swBreak: null, swEnd: ['default: break'], banner: '// app.get / app.set / app.add: game variables (the same API as the SwiftUI export\'s Pocket.swift)',
  },
};
export const CODE_LANGS = Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [k, v.label]));

/** g: { nodes, links }, types: NODE_TYPES, lang: js | dart | kotlin | swift. Returns [{ text, id }] lines (id = the node a line came from). */
export function graphToCode(g, types, lang = 'js') {
  const L = LANGS[lang] || LANGS.js, E_ = L.end;
  const lit = (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : v == null || v === '' ? L.q('') : isNum(v) ? String(v) : L.q(v));
  const OPS = { '+': '+', '−': '-', '-': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '%': '%', '≥': '>=', '≤': '<=', '=': L.eq, '>': '>', '<': '<', '≠': L.ne };
  const nodes = g?.nodes || [], links = g?.links || [], byId = new Map(nodes.map((n) => [n.id, n]));
  const def = (n) => types[n.type] || { label: n.type, cat: 'Actions' };
  const P = (n, k) => { const v = n.params?.[k]; if (v != null && v !== '') return v; const d = def(n), s = [...(d.params || []), ...(d.inputs || [])].find((q) => q.key === k); return s?.default ?? ''; };
  const out = [], lines = (text, id, ind) => out.push({ text: '  '.repeat(ind) + text, id });
  const execNext = (n, port) => links.filter((l) => l.from.node === n.id && l.from.port === port).map((l) => byId.get(l.to.node)).filter(Boolean);
  const valueIn = (n, key) => { const l = links.find((q) => q.to.node === n.id && q.to.port === key); return l ? byId.get(l.from.node) : null; };
  const isEvent = (d) => !d.exec && !d.value && !d.comment && (d.outs || []).length > 0;
  const settings = (n) => (def(n).params || []).map((p) => [p.key, n.params?.[p.key] ?? p.default]).filter(([, v]) => v !== '' && v != null && typeof v !== 'object').map(([k, v]) => [k, lit(v)]);

  /** A value: what is wired in, or what is typed. */
  function expr(n, key, ctx, depth = 0) {
    const src = valueIn(n, key);
    if (!src) { const spec = (def(n).inputs || []).find((i) => i.key === key); const v = n.params?.[key] ?? spec?.default; return spec?.type === 'number' && v !== '' && v != null && !isNaN(+v) ? String(+v) : lit(v); }
    return value(src, ctx, depth + 1);
  }
  function value(n, ctx, depth = 0) {
    if (depth > 12) return '…';
    const E = (k) => expr(n, k, ctx, depth);
    switch (n.type) {
      case 'number': return String(+P(n, 'value') || 0);
      case 'getVar': return L.get(ident(P(n, 'name')));
      case 'math': { const op = P(n, 'op'); return op === '^' ? L.pow(E('a'), E('b')) : OPS[op] ? `(${E('a')} ${OPS[op]} ${E('b')})` : /^(min|max)$/.test(op) ? L.mm(op, E('a'), E('b')) : `${ident(op, 'op')}(${E('a')}, ${E('b')})`; }
      case 'compare': return `(${E('a')} ${OPS[P(n, 'op')] || L.eq} ${E('b')})`;
      case 'and': return `(${E('a')} && ${E('b')})`;
      case 'or': return `(${E('a')} || ${E('b')})`;
      case 'not': return `!${E('a')}`;
      case 'funcArg': return P(n, 'which') || 'a';
      case 'loopIndex': return ctx.loops.length ? ctx.loops[ctx.loops.length - 1] : 'i';
      case 'random': return `random(${lit(P(n, 'min'))}, ${lit(P(n, 'max'))})`;
      case 'callFunc': return `${L.aw}${ident(P(n, 'name'), 'fn')}(${E('a')}, ${E('b')}, ${E('c')})`;
      case 'formula': { const ins = { a: E('a'), b: E('b'), c: E('c'), d: E('d') }; return `(${String(P(n, 'expr') || '0').replace(/\b([a-d])\b/g, (m, c) => ins[c])})`; }
      case 'textJoin': return L.join(['a', 'b', 'c'].map(E), lit(P(n, 'sep')));
    }
    return call(n, ctx, depth);
  }
  /** Any other node: name(inputs…, settings). */
  function call(n, ctx, depth = 0) {
    const d = def(n), args = (d.inputs || []).map((i) => expr(n, i.key, ctx, depth)), ps = settings(n);
    if (ps.length) args.push(L.named(ps));
    return `${ident(n.type, 'node')}(${args.join(', ')})`;
  }

  /** The steps from an exec port onward. */
  function chain(list, ind, ctx) { for (const n of list) step(n, ind, ctx); }
  function step(n, ind, ctx) {
    if (ctx.path.has(n.id)) { lines(`// ↻ back to "${def(n).label}" (above)`, n.id, ind); return; }
    if (out.length > 4000) return;
    const path = new Set(ctx.path).add(n.id), c = { ...ctx, path }, d = def(n), id = n.id;
    const next = (port, i = ind, cc = c) => chain(execNext(n, port), i, cc);
    if (n.off) { lines(`// (turned off) ${d.label}`, id, ind); for (const o of d.outs || []) next(o); return; }
    switch (n.type) {
      case 'setVar': lines(L.set(ident(P(n, 'name')), bare(expr(n, 'value', c))), id, ind); return next('then');
      case 'addVar': lines(L.add(ident(P(n, 'name')), bare(expr(n, 'amount', c))), id, ind); return next('then');
      case 'wait': lines(L.wait(expr(n, 'seconds', c)), id, ind); return next('then');
      case 'funcReturn': lines(`return ${bare(expr(n, 'value', c))}${E_}`, id, ind); return;
      case 'breakLoop': lines('break' + E_, id, ind); return;
      case 'continueLoop': lines('continue' + E_, id, ind); return;
      case 'runFunc': { const f = `${L.aw}${ident(P(n, 'name'), 'fn')}(${['a', 'b', 'c'].map((k) => expr(n, k, c)).join(', ')})`, st = P(n, 'store'); lines(st ? L.set(ident(st), f) : f + E_, id, ind); return next('then'); }
      case 'branch': {
        lines(L.ifH(bare(expr(n, 'condition', c))), id, ind); next('true', ind + 1);
        if (execNext(n, 'false').length) { lines('} else {', id, ind); next('false', ind + 1); }
        lines('}', id, ind); return;
      }
      case 'sequence': for (const o of d.outs) next(o); return;
      case 'loop': case 'forRange': case 'whileLoop': case 'repeatUntil': {
        const v = LOOP_VARS[Math.min(c.loops.length, LOOP_VARS.length - 1)], inner = { ...c, loops: [...c.loops, v] };
        const head = n.type === 'loop' ? L.forN(v, expr(n, 'count', c))
          : n.type === 'forRange' ? L.forR(v, expr(n, 'from', c), expr(n, 'to', c), expr(n, 'step', c))
          : n.type === 'whileLoop' ? L.whileH(bare(expr(n, 'condition', c))) : L.whileH(`!${expr(n, 'stop when', c)}`);
        lines(head, id, ind); next('each', ind + 1, inner); lines('}', id, ind); return next('done');
      }
    }
    const outs = d.outs || [];
    if (outs.length <= 1) { lines(`${d.value ? '' : L.aw}${call(n, c)}${E_}`, id, ind); if (outs[0]) next(outs[0]); return; }
    // several ways out: a switch on which one it took
    const wired = outs.filter((o) => execNext(n, o).length);
    if (!wired.length) { lines(`${L.aw}${call(n, c)}${E_}`, id, ind); return; }
    lines(L.swH(`${L.aw}${call(n, c)}`), id, ind);
    const groups = new Map(); for (const o of wired) { const key = execNext(n, o).map((q) => q.id).join(','); groups.set(key, [...(groups.get(key) || []), o]); } // ways that lead to the same steps share them
    for (const os of groups.values()) {
      for (const t of L.swCase(os)) lines(t, id, ind + 1);
      next(os[0], ind + 2);
      if (L.swBreak) lines(L.swBreak, id, ind + 2);
      if (lang === 'kotlin') lines('}', id, ind + 1);
    }
    if (lang === 'swift') lines('default: break', id, ind + 1);
    lines('}', id, ind);
  }

  for (const t of ['// Read-only: change the nodes to change it.', L.banner]) lines(t, null, 0);
  for (const n of nodes) if (def(n).comment) { lines('', null, 0); for (const t of String(P(n, 'text')).split('\n')) lines(`// ${t}`, n.id, 0); }
  const ctx0 = { path: new Set(), loops: [] };
  for (const n of nodes) {
    const d = def(n); if (!isEvent(d)) continue;
    lines('', null, 0);
    if (n.type === 'funcDef') { lines(`${L.fn(ident(P(n, 'name'), 'myFunction'))}${n.off ? ' // (turned off)' : ''}`, n.id, 0); chain(execNext(n, 'then'), 1, ctx0); lines('}', n.id, 0); continue; }
    const ps = settings(n), opts = ps.length ? L.named(ps) : '';
    const ports = (d.outs || []).filter((o) => execNext(n, o).length);
    if (ports.length <= 1 && (d.outs || []).length <= 1) { lines(`${L.on(n.type, opts)}${n.off ? ' // (turned off)' : ''}`, n.id, 0); chain(execNext(n, (d.outs || [])[0]), 1, ctx0); lines(L.onEnd, n.id, 0); continue; }
    for (const o of ports) { lines(L.on(n.type + ':' + o, opts), n.id, 0); chain(execNext(n, o), 1, ctx0); lines(L.onEnd, n.id, 0); }
    if (!ports.length) { lines(L.on(n.type, opts), n.id, 0); lines(L.onEnd, n.id, 0); }
  }
  // steps nothing leads to: they never run
  const reached = new Set(out.map((l) => l.id).filter(Boolean)), hasIn = (n) => links.some((l) => l.to.node === n.id && byId.has(l.from.node) && !def(byId.get(l.from.node)).value);
  const loose = nodes.filter((n) => { const d = def(n); return d.exec && !reached.has(n.id) && !hasIn(n); });
  if (loose.length) { lines('', null, 0); lines('// Not joined to an event, so these never run:', null, 0); for (const n of loose) step(n, 0, ctx0); }
  if (!nodes.length) { lines('', null, 0); lines('// (no nodes yet)', null, 0); }
  return out;
}
