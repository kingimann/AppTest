// The hidden page on the editor's site (editor/bridge.html) that reads and changes your saved projects:
// they live in the editor's own storage, so the app asks the page. request('list') → Promise of the answer.
import React, { useCallback, useRef } from 'react';
import { View } from 'react-native';
import WebFrame from './WebFrame';
import { site } from './prefs';

let frame = null, ready = false, n = 0;
const waiting = new Map(), queue = [], readyListeners = new Set();
export const onBridgeReady = (f) => { readyListeners.add(f); if (ready) f(); return () => readyListeners.delete(f); };
export function request(op, args = {}) {
  return new Promise((ok, no) => {
    const id = ++n, m = { id, op, ...args };
    const t = setTimeout(() => { waiting.delete(id); no(new Error('The editor site did not answer: check your connection')); }, 20000);
    waiting.set(id, { ok: (d) => { clearTimeout(t); ok(d); }, no: (e) => { clearTimeout(t); no(e); } });
    if (ready && frame) frame.send(m); else queue.push(m);
  });
}

/** Mount once (hidden) at the top of the app. */
export function Bridge({ version = 0 }) {
  const ref = useRef(null);
  const onMessage = useCallback((m) => {
    if (m.type === 'ready') { ready = true; frame = ref.current; while (queue.length) frame.send(queue.shift()); readyListeners.forEach((f) => f()); return; }
    const w = waiting.get(m.re); if (!w) return; waiting.delete(m.re);
    if (m.ok) w.ok(m.data); else w.no(new Error(m.error || 'Something went wrong'));
  }, []);
  return (
    <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }} pointerEvents="none">
      <WebFrame key={version} ref={(r) => { ref.current = r; if (r && ready) frame = r; }} uri={`${site()}/editor/bridge.html`} onMessage={onMessage} hooks={false} />
    </View>
  );
}
/** After the editor site changes: start again. */
export const resetBridge = () => { ready = false; frame = null; };
