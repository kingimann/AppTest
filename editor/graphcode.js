// View as Code: a Visual Script written out as readable JavaScript-style code (read-only).
// Events become on(...) handlers, Functions become async functions, If / loops become if / for / while,
// and every other node becomes a call named after it. Each line remembers its node, so tapping a line finds it.

const ident = (s, fb = 'value') => { const t = String(s ?? '').trim().replace(/[^A-Za-z0-9_$]+(.)?/g, (m, c) => (c ? c.toUpperCase() : '')).replace(/^[^A-Za-z_$]+/, ''); return t || fb; };
const lit = (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : v == null || v === '' ? "''" : /^-?\d+(\.\d+)?$/.test(String(v)) ? String(v) : JSON.stringify(String(v)));
const OPS = { '+': '+', '−': '-', '-': '-', '×': '*', '*': '*', '÷': '/', '/': '/', '%': '%', '^': '**', '≥': '>=', '≤': '<=', '=': '===', '>': '>', '<': '<', '≠': '!==' };
const LOOP_VARS = ['i', 'j', 'k', 'm', 'n'];
/** (a + b) → a + b where the brackets wrap the whole thing (an if, a return, the right of =). */
const bare = (x) => { if (x[0] !== '(' || x[x.length - 1] !== ')') return x; let d = 0; for (let i = 0; i < x.length; i++) { if (x[i] === '(') d++; else if (x[i] === ')') d--; if (d === 0 && i < x.length - 1) return x; } return x.slice(1, -1); };

/** g: { nodes, links }, types: NODE_TYPES. Returns [{ text, id }] lines (id = the node a line came from). */
export function graphToCode(g, types) {
  const nodes = g?.nodes || [], links = g?.links || [], byId = new Map(nodes.map((n) => [n.id, n]));
  const def = (n) => types[n.type] || { label: n.type, cat: 'Actions' };
  const P = (n, k) => { const v = n.params?.[k]; if (v != null && v !== '') return v; const d = def(n), s = [...(d.params || []), ...(d.inputs || [])].find((q) => q.key === k); return s?.default ?? ''; };
  const out = [], lines = (text, id, ind) => out.push({ text: '  '.repeat(ind) + text, id });
  const execNext = (n, port) => links.filter((l) => l.from.node === n.id && l.from.port === port).map((l) => byId.get(l.to.node)).filter(Boolean);
  const valueIn = (n, key) => { const l = links.find((q) => q.to.node === n.id && q.to.port === key); return l ? byId.get(l.from.node) : null; };
  const isEvent = (d) => !d.exec && !d.value && !d.comment && (d.outs || []).length > 0;

  /** A value: what is wired in, or what is typed. */
  function expr(n, key, ctx, depth = 0) {
    const src = valueIn(n, key);
    if (!src) { const spec = (def(n).inputs || []).find((i) => i.key === key); const v = n.params?.[key] ?? spec?.default; return spec?.type === 'number' && v !== '' && v != null && !isNaN(+v) ? String(+v) : lit(v); }
    return value(src, ctx, depth + 1);
  }
  function value(n, ctx, depth = 0) {
    if (depth > 12) return '…';
    const d = def(n), E = (k) => expr(n, k, ctx, depth);
    switch (n.type) {
      case 'number': return String(+P(n, 'value') || 0);
      case 'getVar': return `vars.${ident(P(n, 'name'))}`;
      case 'math': { const op = P(n, 'op'); return OPS[op] ? `(${E('a')} ${OPS[op]} ${E('b')})` : `Math.${ident(op, 'op')}(${E('a')}, ${E('b')})`; }
      case 'compare': return `(${E('a')} ${OPS[P(n, 'op')] || '==='} ${E('b')})`;
      case 'and': return `(${E('a')} && ${E('b')})`;
      case 'or': return `(${E('a')} || ${E('b')})`;
      case 'not': return `!${E('a')}`;
      case 'funcArg': return P(n, 'which') || 'a';
      case 'loopIndex': return ctx.loops.length ? ctx.loops[ctx.loops.length - 1] : 'i';
      case 'random': return `random(${lit(P(n, 'min'))}, ${lit(P(n, 'max'))})`;
      case 'callFunc': return `${ident(P(n, 'name'), 'fn')}(${E('a')}, ${E('b')}, ${E('c')})`;
      case 'formula': { const ins = { a: E('a'), b: E('b'), c: E('c'), d: E('d') }; return `(${String(P(n, 'expr') || '0').replace(/\b([a-d])\b/g, (m, c) => ins[c])})`; }
      case 'textJoin': return `[${['a', 'b', 'c'].map(E).join(', ')}].join(${lit(P(n, 'sep'))})`;
    }
    return call(n, ctx, depth);
  }
  /** Any other node: name(inputs…, { settings }). */
  function call(n, ctx, depth = 0) {
    const d = def(n), args = (d.inputs || []).map((i) => expr(n, i.key, ctx, depth));
    const ps = (d.params || []).map((p) => [p.key, n.params?.[p.key] ?? p.default]).filter(([, v]) => v !== '' && v != null && typeof v !== 'object');
    if (ps.length) args.push(`{ ${ps.map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${lit(v)}`).join(', ')} }`);
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
      case 'setVar': lines(`vars.${ident(P(n, 'name'))} = ${bare(expr(n, 'value', c))};`, id, ind); return next('then');
      case 'addVar': lines(`vars.${ident(P(n, 'name'))} += ${bare(expr(n, 'amount', c))};`, id, ind); return next('then');
      case 'wait': lines(`await wait(${expr(n, 'seconds', c)});`, id, ind); return next('then');
      case 'funcReturn': lines(`return ${bare(expr(n, 'value', c))};`, id, ind); return;
      case 'breakLoop': lines('break;', id, ind); return;
      case 'continueLoop': lines('continue;', id, ind); return;
      case 'runFunc': { const f = `await ${ident(P(n, 'name'), 'fn')}(${['a', 'b', 'c'].map((k) => expr(n, k, c)).join(', ')})`, st = P(n, 'store'); lines(st ? `vars.${ident(st)} = ${f};` : `${f};`, id, ind); return next('then'); }
      case 'branch': {
        lines(`if (${bare(expr(n, 'condition', c))}) {`, id, ind); next('true', ind + 1);
        if (execNext(n, 'false').length) { lines('} else {', id, ind); next('false', ind + 1); }
        lines('}', id, ind); return;
      }
      case 'sequence': for (const o of d.outs) next(o); return;
      case 'loop': case 'forRange': case 'whileLoop': case 'repeatUntil': {
        const v = LOOP_VARS[Math.min(c.loops.length, LOOP_VARS.length - 1)], inner = { ...c, loops: [...c.loops, v] };
        const head = n.type === 'loop' ? `for (let ${v} = 1; ${v} <= ${expr(n, 'count', c)}; ${v}++) {`
          : n.type === 'forRange' ? `for (let ${v} = ${expr(n, 'from', c)}; ${v} <= ${expr(n, 'to', c)}; ${v} += ${expr(n, 'step', c)}) {`
          : n.type === 'whileLoop' ? `while (${bare(expr(n, 'condition', c))}) {` : `while (!${expr(n, 'stop when', c)}) {`;
        lines(head, id, ind); next('each', ind + 1, inner); lines('}', id, ind); return next('done');
      }
    }
    const outs = d.outs || [];
    if (outs.length <= 1) { lines(`${d.value ? '' : 'await '}${call(n, c)};`, id, ind); if (outs[0]) next(outs[0]); return; }
    // several ways out: a switch on which one it took
    const wired = outs.filter((o) => execNext(n, o).length);
    if (!wired.length) { lines(`await ${call(n, c)};`, id, ind); return; }
    lines(`switch (await ${call(n, c)}) {`, id, ind);
    const groups = new Map(); for (const o of wired) { const key = execNext(n, o).map((q) => q.id).join(','); groups.set(key, [...(groups.get(key) || []), o]); } // ways that lead to the same steps share them
    for (const os of groups.values()) { for (const o of os) lines(`case ${JSON.stringify(o)}:`, id, ind + 1); next(os[0], ind + 2); lines('break;', id, ind + 2); }
    lines('}', id, ind);
  }

  const banner = ['// Read-only: change the nodes to change it.', '// vars.x = a game variable'];
  for (const t of banner) lines(t, null, 0);
  for (const n of nodes) if (def(n).comment) { lines('', null, 0); for (const t of String(P(n, 'text')).split('\n')) lines(`// ${t}`, n.id, 0); }
  const ctx0 = { path: new Set(), loops: [] };
  for (const n of nodes) {
    const d = def(n); if (!isEvent(d)) continue;
    lines('', null, 0);
    if (n.type === 'funcDef') { lines(`async function ${ident(P(n, 'name'), 'myFunction')}(a, b, c) {${n.off ? ' // (turned off)' : ''}`, n.id, 0); chain(execNext(n, 'then'), 1, ctx0); lines('}', n.id, 0); continue; }
    const ps = (d.params || []).map((p) => [p.key, n.params?.[p.key] ?? p.default]).filter(([, v]) => v !== '' && v != null && typeof v !== 'object');
    const opts = ps.length ? `{ ${ps.map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${lit(v)}`).join(', ')} }, ` : '';
    const ports = (d.outs || []).filter((o) => execNext(n, o).length);
    if (ports.length <= 1 && (d.outs || []).length <= 1) { lines(`on(${JSON.stringify(n.type)}, ${opts}async () => {${n.off ? ' // (turned off)' : ''}`, n.id, 0); chain(execNext(n, (d.outs || [])[0]), 1, ctx0); lines('});', n.id, 0); continue; }
    for (const o of ports) { lines(`on(${JSON.stringify(n.type + ':' + o)}, ${opts}async () => {`, n.id, 0); chain(execNext(n, o), 1, ctx0); lines('});', n.id, 0); }
    if (!ports.length) lines(`on(${JSON.stringify(n.type)}, ${opts}async () => {});`, n.id, 0);
  }
  // steps nothing leads to: they never run
  const reached = new Set(out.map((l) => l.id).filter(Boolean)), hasIn = (n) => links.some((l) => l.to.node === n.id && byId.has(l.from.node) && !def(byId.get(l.from.node)).value);
  const loose = nodes.filter((n) => { const d = def(n); return d.exec && !reached.has(n.id) && !hasIn(n); });
  if (loose.length) { lines('', null, 0); lines('// Not joined to an event, so these never run:', null, 0); for (const n of loose) step(n, 0, ctx0); }
  if (!nodes.length) { lines('', null, 0); lines('// (no nodes yet)', null, 0); }
  return out;
}
