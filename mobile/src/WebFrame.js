// A web page inside the app (the editor, the docs, the hidden storage bridge): react-native-webview on the phone.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';

/** Downloads (exports, backups) go to the app as files, and vibration to the phone's haptics. */
const HOOKS = `(function () {
  var send = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && /^(blob:|data:)/.test(this.href)) {
      var name = this.download;
      fetch(this.href).then(function (r) { return r.blob(); }).then(function (b) {
        var fr = new FileReader(); fr.onload = function () { send({ type: 'file', name: name, mime: b.type || 'application/octet-stream', data: String(fr.result).split(',')[1] || '' }); }; fr.readAsDataURL(b);
      });
      return;
    }
    return click.call(this);
  };
  if (!navigator.vibrate) navigator.vibrate = function () { send({ type: 'haptic' }); return true; };
})(); true;`;

const WebFrame = forwardRef(function WebFrame({ uri, onMessage, style, hooks = true }, ref) {
  const view = useRef(null);
  useImperativeHandle(ref, () => ({
    /** Calls the page's window.pocketBridge with a message. */
    send: (m) => view.current?.injectJavaScript(`window.pocketBridge && window.pocketBridge(${JSON.stringify(JSON.stringify(m))}); true;`),
    /** Calls the Scene page's window.pocketScene. */
    sendScene: (m) => view.current?.injectJavaScript(`window.pocketScene && window.pocketScene(${JSON.stringify(JSON.stringify(m))}); true;`),
    reload: () => view.current?.reload(),
  }));
  return (
    <WebView ref={view} source={{ uri }} style={[{ flex: 1, backgroundColor: '#0e1014' }, style]} originWhitelist={['*']}
      javaScriptEnabled domStorageEnabled allowFileAccess allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false}
      setSupportMultipleWindows={false} allowsBackForwardNavigationGestures={false} bounces={false} overScrollMode="never"
      injectedJavaScriptBeforeContentLoaded={hooks ? HOOKS : undefined}
      onMessage={(e) => { let m; try { m = JSON.parse(e.nativeEvent.data); } catch { return; } onMessage?.(m); }} />
  );
});
export default WebFrame;
