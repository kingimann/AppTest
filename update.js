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
    'editor/icons.js', 'editor/storage.js', 'editor/loading.js', 'editor/nodes.js', 'editor/modeler.js', 'editor/sprite2d.js', 'editor/meshops.js', 'editor/timeline.js', 'editor/logic.js', 'editor/items.js', 'editor/story.js', 'editor/library.js', 'editor/stores.js', 'editor/expo.js',
    'docs/', 'docs/index.html', 'docs/docs.css', 'docs/docs.js', 'docs/guide/getting-started.md', 'docs/guide/editor.md', 'docs/guide/concepts.md', 'docs/guide/objects.md', 'docs/guide/physics.md', 'docs/guide/triggers.md', 'docs/guide/visual-scripting.md', 'docs/guide/ui.md', 'docs/guide/gameplay.md', 'docs/guide/quests-dialogue.md', 'docs/guide/camera-lighting.md', 'docs/guide/animation-audio.md', 'docs/guide/saving-online.md', 'docs/guide/scripting.md', 'docs/guide/engine-api.md', 'docs/guide/custom-components.md', 'docs/guide/publishing.md', 'docs/guide/troubleshooting.md'];
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

  // ---- pull down to refresh ----
  // On a page or panel marked data-pull-refresh (the home page, the editor's home screen): drag down from the top
  // and let go past the line. If a new version is out it installs it, otherwise it saves and reloads.
  var ptr = null;
  function refreshNow() {
    if (bar) return apply();
    read().then(function (v) {
      if (v && running && v !== running) { latest = v; if (ptr) ptr.lab.textContent = 'Installing the new version…'; apply(); return; }
      try { window.pocketBeforeUpdate && window.pocketBeforeUpdate(); } catch (e) {}
      location.reload();
    });
  }
  function pullUI() {
    if (ptr) return ptr;
    var el = css(document.createElement('div'), 'position:fixed;left:50%;top:env(safe-area-inset-top, 0px);z-index:2147483001;height:36px;padding:0 14px 0 10px;border-radius:18px;' +
      'background:#1d2b3f;color:#cfe3ff;box-shadow:0 4px 16px rgba(0,0,0,.45);display:flex;align-items:center;gap:8px;white-space:nowrap;pointer-events:none;opacity:0;' +
      'font:600 14px -apple-system,system-ui,sans-serif;transform:translate(-50%,-60px)');
    el.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9fd0ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg><span></span>';
    document.documentElement.appendChild(el); // outside the body, which slides down while pulling
    ptr = { el: el, svg: el.firstChild, lab: el.lastChild };
    if (!document.getElementById('pk-ptr-css')) { var st = document.createElement('style'); st.id = 'pk-ptr-css'; st.textContent = '@keyframes pk-ptr-spin{to{transform:rotate(360deg)}}'; document.head.appendChild(st); }
    return ptr;
  }
  var LINE = 72, MAX = 120;
  function scrollerOf(t, root) { // the nearest scrolled box between the finger and the page: only pull when it's at the top
    for (var n = t; n && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollTop !== 0) return n; // (iOS: negative while bouncing at the top)
      if (n === root) break;
    }
    return (root === document.body && (document.scrollingElement || document.documentElement).scrollTop > 0) ? document.scrollingElement : null;
  }
  function attach(root) {
    if (!root || root._pkPull) return; root._pkPull = true;
    var y0 = 0, x0 = 0, d = 0, on = false, busyPull = false;
    var clean = 0;
    var shift = function (px, anim) { // slide what's inside down (not the panel itself, so nothing behind it shows)
      clearTimeout(clean);
      for (var c = root.firstElementChild; c; c = c.nextElementSibling) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE' || getComputedStyle(c).position === 'fixed') continue;
        c.style.transition = anim ? 'transform .25s' : 'none'; c.style.transform = px ? 'translateY(' + px + 'px)' : 'translateY(0)';
      }
      // back at rest: remove the transforms completely. Left on, iOS keeps every section as its own layer and can
      // fail to repaint them while the page scrolls (big blank blocks over the content)
      if (!px) clean = setTimeout(function () {
        for (var c = root.firstElementChild; c; c = c.nextElementSibling) { c.style.transition = ''; c.style.transform = ''; }
      }, anim ? 300 : 0);
    };
    var place = function (px, anim) { var u = pullUI(); u.el.style.transition = anim ? 'transform .25s, opacity .25s' : 'none'; u.el.style.transform = 'translate(-50%,' + px + 'px)'; };
    root.addEventListener('touchstart', function (e) {
      if (busyPull || e.touches.length !== 1 || root.hidden || scrollerOf(e.target, root)) { on = false; return; }
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], canvas')) { on = false; return; }
      on = true; d = 0; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (!on) return;
      var dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (d === 0 && (dy <= 0 || Math.abs(dx) > Math.abs(dy))) { on = false; return; } // scrolling up or swiping sideways
      if (scrollerOf(e.target, root)) { on = false; hide(); return; }
      e.preventDefault();
      d = Math.max(0, Math.min(MAX, dy * 0.55));
      var u = pullUI(), k = Math.min(1, d / LINE);
      shift(d); place(d - 44);
      u.el.style.opacity = String(Math.min(1, k * 1.6));
      u.svg.style.transform = 'rotate(' + Math.round(k * 300) + 'deg)';
      u.svg.style.opacity = k >= 1 ? '1' : '0.6';
      u.lab.textContent = k >= 1 ? 'Release to refresh' : 'Pull down to refresh';
    }, { passive: false });
    function hide() {
      shift(0, true);
      if (!ptr) return;
      place(-60, true); ptr.el.style.opacity = '0';
    }
    root.addEventListener('touchend', function () {
      if (!on) return; on = false;
      if (d < LINE) { hide(); return; }
      busyPull = true;
      var u = pullUI();
      shift(56, true); place(12, true);
      u.svg.style.opacity = '1'; u.svg.style.animation = 'pk-ptr-spin .7s linear infinite';
      u.lab.textContent = 'Refreshing…';
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) {}
      setTimeout(refreshNow, 250);
    });
    root.addEventListener('touchcancel', function () { on = false; hide(); });
  }
  function attachAll() { document.querySelectorAll('[data-pull-refresh]').forEach(attach); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachAll); else attachAll();

  window.pocketUpdate = { check: function () { return check(true); }, apply: apply, get version() { return label(running); }, get available() { return !!(latest && running && latest !== running); }, pullToRefresh: attach, refresh: refreshNow };
  startVersion().then(function (v) { running = running || v; if (v) check(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  addEventListener('online', function () { check(); });
  addEventListener('focus', function () { check(); });
  setInterval(function () { if (!document.hidden) check(); }, 10 * 60 * 1000);
  // a new service worker taking over also means new files are live
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', function () { check(); });
})();
