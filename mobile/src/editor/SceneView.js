// The Scene view: Pocket Engine drawing the level (editor/scene.html in a web view). The native editor talks to it:
// call('load' | 'select' | 'play' | 'stop' | 'schemas' | 'presets' …) → Promise; onEvent gets tap, moved, log, played, stopped.
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import WebFrame from '../WebFrame';
import { site } from '../prefs';

const SceneView = forwardRef(function SceneView({ onEvent, onReady }, ref) {
  const frame = useRef(null), waiting = useRef(new Map()), queue = useRef([]), ready = useRef(false), n = useRef(0);
  const send = (m) => { if (ready.current && frame.current) frame.current.sendScene(m); else queue.current.push(m); };
  useImperativeHandle(ref, () => ({
    call: (op, args = {}) => new Promise((ok, no) => { const id = ++n.current; waiting.current.set(id, { ok, no }); send({ id, op, ...args }); setTimeout(() => { if (waiting.current.delete(id)) no(new Error('The scene did not answer')); }, 20000); }),
    tell: (op, args = {}) => send({ op, ...args }),
  }));
  const onMessage = useCallback((m) => {
    if (m.type === 'ready') { ready.current = true; const q = queue.current.splice(0); q.forEach((x) => frame.current.sendScene(x)); onReady?.(); return; }
    if (m.re != null) { const w = waiting.current.get(m.re); if (!w) return; waiting.current.delete(m.re); if (m.ok) w.ok(m.data); else w.no(new Error(m.error || 'Something went wrong')); return; }
    onEvent?.(m);
  }, [onEvent, onReady]);
  return <WebFrame ref={frame} uri={`${site()}/editor/scene.html`} onMessage={onMessage} />;
});
export default SceneView;
