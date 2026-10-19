// A web page inside the app's web version: an iframe (the same messages as the phone's web view).
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const WebFrame = forwardRef(function WebFrame({ uri, onMessage, style }, ref) {
  const frame = useRef(null);
  useImperativeHandle(ref, () => ({
    send: (m) => frame.current?.contentWindow?.postMessage(JSON.stringify(m), '*'),
    reload: () => { if (frame.current) frame.current.src = uri; },
  }));
  useEffect(() => {
    const f = (e) => { if (e.source !== frame.current?.contentWindow) return; let m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; } onMessage?.(m); };
    window.addEventListener('message', f); return () => window.removeEventListener('message', f);
  }, [onMessage]);
  return <iframe ref={frame} src={uri} title="Pocket Engine" style={{ flex: 1, border: 0, width: '100%', height: '100%', background: '#0e1014', ...(style && !Array.isArray(style) ? style : {}) }} allow="autoplay; fullscreen; clipboard-write" />;
});
export default WebFrame;
