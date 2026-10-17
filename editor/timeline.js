// Animation timeline: record keyframe clips for the Animator component.
// Pose the object in the Scene (gizmos or Inspector) and tap ◆ Key — or leave Auto Key on and every change becomes a key.
// Tracks store offsets from the object's rest pose (positions/rotations add, scale/opacity multiply), so clips work anywhere.
import { sampleTrack, ANIM_PROPS, ANIM_MULT, EASES } from '../engine/pocket.js';
import { icon } from './icons.js';

const LABEL = { x: 'Move X', y: 'Move Y', z: 'Move Z', rx: 'Turn X', ry: 'Turn Y', rz: 'Turn Z', sx: 'Scale X', sy: 'Scale Y', sz: 'Scale Z', alpha: 'Opacity' };
const DEF = (k) => (ANIM_MULT.has(k) ? 1 : 0);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** opts: { get(): entity json, behavior, threeD, h, popMenu, toast, buzz, parent, onPose(), onChange(), onClose() } */
export function openTimeline(opts) {
  const { h, popMenu, toast, buzz = () => {} } = opts, b = opts.behavior;
  b.clips ||= [];
  if (!b.clips.length) b.clips.push({ name: 'Clip 1', length: 1, loop: 'loop', tracks: {} });
  let clip = b.clips.find((c) => c.name === b.autoplay) || b.clips[0];
  let t = 0, playing = false, autoKey = true, selKey = null, raf = 0, last = 0, lastPose = null;
  const props = opts.threeD ? ANIM_PROPS : ['x', 'y', 'rz', 'sx', 'sy', 'alpha'];
  const j0 = opts.get(), base = Object.fromEntries(ANIM_PROPS.map((k) => [k, j0[k] ?? DEF(k)])), had = Object.fromEntries(ANIM_PROPS.map((k) => [k, k in j0]));

  // ---------- pose ----------
  const poseAt = (time) => Object.fromEntries(ANIM_PROPS.map((k) => {
    const tr = clip.tracks?.[k], v = tr?.length ? sampleTrack(tr, time) : DEF(k);
    return [k, ANIM_MULT.has(k) ? base[k] * v : base[k] + v];
  }));
  function applyPose() {
    const j = opts.get(); if (!j) return;
    lastPose = Object.fromEntries(Object.entries(poseAt(t)).map(([k, v]) => [k, r3(v)]));
    for (const k of ANIM_PROPS) j[k] = lastPose[k];
    opts.onPose();
  }
  /** Keys for properties the user changed (or all animated ones). */
  function keyNow(only) {
    const j = opts.get(); if (!j) return 0;
    let n = 0;
    for (const k of props) {
      const cur = j[k] ?? DEF(k), animated = clip.tracks?.[k]?.length;
      const changed = Math.abs(cur - (lastPose?.[k] ?? base[k])) > 1e-4;
      if (only ? !changed : !(animated || Math.abs(cur - base[k]) > 1e-4)) continue;
      const v = ANIM_MULT.has(k) ? (base[k] ? cur / base[k] : 1) : cur - base[k];
      const tr = (clip.tracks ||= {})[k] ||= (t > 0 ? [[0, DEF(k), 'inOutSine']] : []);
      const at = tr.findIndex((q) => Math.abs(q[0] - t) < 0.02);
      if (at >= 0) tr[at][1] = r3(v); else { tr.push([r3(t), r3(v), 'inOutSine']); tr.sort((a, c) => a[0] - c[0]); }
      n++;
    }
    if (n) { lastPose = Object.fromEntries(ANIM_PROPS.map((k) => [k, j[k] ?? DEF(k)])); opts.onChange(); }
    return n;
  }

  // ---------- DOM ----------
  const lane = h('div', { class: 'tl-lanes' });
  const timeLbl = h('span', { class: 'tl-time' });
  const keyBar = h('div', { class: 'tl-key' });
  const head = h('div', { class: 'tl-row' });
  const transport = h('div', { class: 'tl-row' });
  const root = h('div', { class: 'tl' }, head, transport, lane, keyBar);
  opts.parent.append(root);

  const laneX = (time) => (time / (clip.length || 1)) * 100;
  function renderHead() {
    head.replaceChildren(
      h('button', { class: 'ne-btn done', onclick: () => close() }, icon('check'), 'Done'),
      h('button', { class: 'tl-clip', onclick: (e) => clipMenu(e.currentTarget) }, h('b', {}, clip.name), icon('chevron')),
      h('label', { class: 'tl-f' }, 'Length', h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: clip.length, onchange: (e) => { clip.length = Math.max(0.1, parseFloat(e.target.value) || 1); t = Math.min(t, clip.length); opts.onChange(); render(); } })),
      h('select', { class: 'tl-loop', onchange: (e) => { clip.loop = e.target.value; opts.onChange(); } }, ['loop', 'ping-pong', 'once'].map((v) => h('option', { value: v, selected: clip.loop === v }, v))));
  }
  function renderTransport() {
    transport.replaceChildren(
      h('button', { class: 'ne-btn', title: 'Start', onclick: () => { t = 0; stop(); applyPose(); render(); } }, icon('left')),
      h('button', { class: 'ne-btn tl-play', onclick: () => (playing ? stop() : play()) }, icon(playing ? 'pause' : 'play')),
      h('button', { class: 'ne-btn tl-addkey', onclick: () => { const n = keyNow(false); buzz(8); toast(n ? `Key at ${t.toFixed(2)}s` : 'Move, turn or scale the object first, then tap Key'); render(); } }, '◆ Key'),
      h('button', { class: 'mo-tog' + (autoKey ? ' on' : ''), title: 'Auto Key: every change you make becomes a key', onclick: () => { autoKey = !autoKey; renderTransport(); } }, '● Auto'),
      timeLbl);
    timeLbl.textContent = `${t.toFixed(2)}s`;
  }
  function renderLanes() {
    const used = props.filter((k) => clip.tracks?.[k]?.length);
    const ruler = h('div', { class: 'tl-ruler' }, h('span', { class: 'tl-name' }, 'Time'), h('div', { class: 'tl-track' },
      Array.from({ length: Math.floor((clip.length || 1) * 4) + 1 }, (_, i) => h('i', { class: 'tick' + (i % 4 ? '' : ' big'), style: `left:${laneX(i / 4)}%` }, i % 4 ? '' : `${i / 4}s`)),
      h('div', { class: 'tl-head', style: `left:${laneX(t)}%` })));
    scrub(ruler.lastChild);
    const rows = used.map((k) => {
      const track = h('div', { class: 'tl-track' }, h('div', { class: 'tl-head', style: `left:${laneX(t)}%` }),
        clip.tracks[k].map((key, idx) => h('button', { class: 'tl-dia' + (selKey && selKey.k === k && selKey.i === idx ? ' sel' : ''), style: `left:${laneX(key[0])}%`, title: `${key[0]}s`,
          onclick: (e) => { e.stopPropagation(); selKey = { k, i: idx }; t = key[0]; stop(); applyPose(); render(); } })));
      scrub(track);
      return h('div', { class: 'tl-lane' }, h('span', { class: 'tl-name' }, LABEL[k]), track);
    });
    lane.replaceChildren(ruler, ...rows, used.length ? '' : h('p', { class: 'tl-empty' }, 'No keys yet. Move the scrubber, pose the object in the Scene (drag, rotate or scale it), then tap ◆ Key. With Auto on, every change is keyed for you.'),
      h('div', { class: 'tl-addtrack' }, h('button', { class: 'btn', onclick: (e) => popMenu(e.currentTarget, props.filter((k) => !clip.tracks?.[k]?.length).map((k) => ({ label: LABEL[k], fn: () => { (clip.tracks ||= {})[k] = [[0, DEF(k), 'inOutSine'], [clip.length, DEF(k)]]; opts.onChange(); render(); } }))) }, icon('plus'), 'Add Track')));
  }
  function renderKey() {
    const k = selKey && clip.tracks?.[selKey.k]?.[selKey.i];
    if (!k) { keyBar.replaceChildren(); return; }
    const tr = clip.tracks[selKey.k];
    keyBar.replaceChildren(
      h('span', { class: 'tl-kname' }, `◆ ${LABEL[selKey.k]}`),
      h('label', { class: 'tl-f' }, 'Time', h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: k[0], onchange: (e) => { k[0] = Math.max(0, Math.min(clip.length, parseFloat(e.target.value) || 0)); tr.sort((a, c) => a[0] - c[0]); selKey.i = tr.indexOf(k); opts.onChange(); render(); } })),
      h('label', { class: 'tl-f' }, 'Value', h('input', { type: 'number', inputMode: 'decimal', step: 'any', value: k[1], onchange: (e) => { k[1] = parseFloat(e.target.value) || 0; opts.onChange(); applyPose(); render(); } })),
      h('select', { onchange: (e) => { k[2] = e.target.value; opts.onChange(); } }, EASES.map((v) => h('option', { value: v, selected: (k[2] || 'linear') === v }, v))),
      h('button', { class: 'ne-btn', title: 'Delete key', onclick: () => { tr.splice(selKey.i, 1); if (!tr.length) delete clip.tracks[selKey.k]; selKey = null; opts.onChange(); applyPose(); render(); } }, icon('trash')));
  }
  function render() { renderHead(); renderTransport(); renderLanes(); renderKey(); }

  function scrub(track) {
    const at = (e) => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(clip.length, ((e.clientX - r.left) / r.width) * clip.length)); };
    let down = false;
    track.addEventListener('pointerdown', (e) => { if (e.target.closest('.tl-dia')) return; down = true; track.setPointerCapture(e.pointerId); stop(); t = Math.round(at(e) * 20) / 20; applyPose(); updateHeads(); });
    track.addEventListener('pointermove', (e) => { if (!down) return; t = Math.round(at(e) * 20) / 20; applyPose(); updateHeads(); });
    track.addEventListener('pointerup', () => { down = false; render(); });
    track.addEventListener('pointercancel', () => { down = false; });
  }
  const updateHeads = () => { for (const el of root.querySelectorAll('.tl-head')) el.style.left = laneX(t) + '%'; timeLbl.textContent = `${t.toFixed(2)}s`; };

  function clipMenu(anchor) {
    popMenu(anchor, [
      { cap: 'Clips' }, ...b.clips.map((c) => ({ icon: c === clip ? 'right' : 'play', label: c.name, fn: () => { clip = c; t = 0; selKey = null; applyPose(); render(); } })),
      '-',
      { icon: 'plus', label: 'New Clip', fn: () => { const n = prompt('Clip name', `Clip ${b.clips.length + 1}`); if (!n) return; clip = { name: n, length: 1, loop: 'loop', tracks: {} }; b.clips.push(clip); t = 0; opts.onChange(); applyPose(); render(); } },
      { icon: 'copy', label: 'Duplicate Clip', fn: () => { clip = { ...JSON.parse(JSON.stringify(clip)), name: clip.name + ' copy' }; b.clips.push(clip); opts.onChange(); render(); } },
      { icon: 'edit', label: 'Rename…', fn: () => { const n = prompt('Clip name', clip.name); if (!n) return; if (b.autoplay === clip.name) b.autoplay = n; clip.name = n; opts.onChange(); render(); } },
      { icon: 'play', label: 'Play This on Start', fn: () => { b.autoplay = clip.name; opts.onChange(); toast(`“${clip.name}” plays when the game starts`); } },
      b.clips.length > 1 && { icon: 'trash', label: 'Delete Clip', fn: () => { b.clips.splice(b.clips.indexOf(clip), 1); clip = b.clips[0]; opts.onChange(); applyPose(); render(); } },
    ]);
  }

  // ---------- play / auto key loop ----------
  function play() { playing = true; last = performance.now(); renderTransport(); }
  function stop() { if (!playing) return; playing = false; renderTransport(); }
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (playing) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += dt;
      if (t > clip.length) t = clip.loop === 'once' ? (stop(), clip.length) : 0;
      applyPose(); updateHeads(); window.engine?.wake?.(); // (the Scene keeps drawing while the clip plays)
      return;
    }
    const j = opts.get(); if (!j || !lastPose) return;
    if (autoKey && props.some((k) => Math.abs((j[k] ?? DEF(k)) - lastPose[k]) > 1e-4)) { if (keyNow(true)) renderLanes(); }
  }
  raf = requestAnimationFrame(tick);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true; cancelAnimationFrame(raf);
    const j = opts.get();
    if (j) for (const k of ANIM_PROPS) { if (had[k]) j[k] = base[k]; else delete j[k]; } // back to the rest pose
    root.remove(); opts.onClose?.();
  }
  applyPose(); render();
  return { close };
}
