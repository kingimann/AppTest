// Update checker for the editor, home page and player.
// A phone keeps a web app (above all one added to the home screen) open for days without reloading it,
// so a new release would never load. This watches the published version, which is the service worker's
// cache name, so every release bump in sw.js counts. It checks when the app is opened, when it comes back
// to the front, when the phone goes online, and every 10 minutes. When the version changes it shows a bar:
// tap Update to save, clear the cached files, re-download them and reload.
(function () {
  if (!location.protocol.startsWith('http') || !window.fetch) return;
  var base = new URL('./', document.currentScript ? document.currentScript.src : location.href);
  var FILES = ['index.html', 'play.html', 'engine/pocket.js', 'examples/templates.js', 'editor/', 'editor/index.html', 'editor/editor.css', 'editor/editor.js',
    'editor/icons.js', 'editor/nodes.js', 'editor/modeler.js', 'editor/meshops.js', 'editor/timeline.js', 'editor/logic.js', 'editor/library.js'];
  var running = null, latest = null, bar = null, busy = false, dismissed = null;

  function read() {
    return fetch(new URL('sw.js', base), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (t) { var m = t && t.match(/CACHE\s*=\s*['"]([^'"]+)['"]/); return m ? m[1] : null; })
      .catch(function () { return null; });
  }
  // the version these files came from: the cache that served them when the app started offline, else what the network says now
  function startVersion() {
    if (navigator.onLine !== false) return read();
    return (window.caches ? caches.keys() : Promise.resolve([])).then(function (k) { return k.filter(function (n) { return /^pocket-/.test(n); }).sort().pop() || null; }).catch(function () { return null; });
  }

  function check(manual) {
    if (busy) return Promise.resolve(null);
    busy = true;
    return read().then(function (v) {
      busy = false;
      if (!v) { if (manual) say('Could not check for updates. Are you online?'); return null; }
      latest = v;
      if (!running) running = v;
      if (v !== running) { if (manual || dismissed !== v) show(); }
      else if (manual) say('You have the latest version (' + label(v) + ').');
      return v;
    });
  }
  function label(v) { var m = v && v.match(/(\d+)$/); return m ? 'v' + m[1] : v || '?'; }

  function apply() {
    if (bar) bar.querySelector('b').textContent = 'Updating…';
    try { window.pocketBeforeUpdate && window.pocketBeforeUpdate(); } catch (e) {} // the editor saves your project
    var sw = navigator.serviceWorker ? navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }).catch(function () {}) : Promise.resolve();
    sw.then(function () { return window.caches ? caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }) : null; })
      .catch(function () {})
      .then(function () { return Promise.all(FILES.map(function (f) { return fetch(new URL(f, base), { cache: 'reload' }).catch(function () {}); })); })
      .then(function () { location.reload(); });
  }

  function css(el, s) { el.style.cssText = s; return el; }
  function show() {
    if (bar) return;
    bar = css(document.createElement('div'), 'position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 10px);transform:translateX(-50%);z-index:2147483000;' +
      'display:flex;align-items:center;gap:10px;padding:8px 8px 8px 16px;max-width:calc(100% - 24px);box-sizing:border-box;border-radius:14px;' +
      'background:#1d2b3f;color:#fff;box-shadow:0 6px 24px rgba(0,0,0,.45);font:15px -apple-system,system-ui,sans-serif');
    var t = document.createElement('b'); t.textContent = 'A new version is ready'; t.style.cssText = 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    var go = css(document.createElement('button'), 'height:38px;padding:0 16px;border:0;border-radius:10px;background:#3a8dff;color:#fff;font:600 15px -apple-system,system-ui,sans-serif');
    go.textContent = 'Update'; go.onclick = apply;
    var x = css(document.createElement('button'), 'width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:#9fb0c6;font:20px sans-serif');
    x.textContent = '×'; x.setAttribute('aria-label', 'Later'); x.onclick = function () { dismissed = latest; bar.remove(); bar = null; };
    bar.append(t, go, x); document.body.appendChild(bar);
  }
  function say(msg) {
    var d = css(document.createElement('div'), 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom, 0px) + 90px);transform:translateX(-50%);z-index:2147483000;' +
      'padding:10px 16px;border-radius:12px;background:rgba(20,20,20,.92);color:#fff;font:15px -apple-system,system-ui,sans-serif;max-width:80%;text-align:center');
    d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }

  window.pocketUpdate = { check: function () { return check(true); }, apply: apply, get version() { return label(running); }, get available() { return !!(latest && running && latest !== running); } };
  startVersion().then(function (v) { running = running || v; if (v) check(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  addEventListener('online', function () { check(); });
  addEventListener('focus', function () { check(); });
  setInterval(function () { if (!document.hidden) check(); }, 10 * 60 * 1000);
  // a new service worker taking over also means new files are live
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', function () { check(); });
})();
