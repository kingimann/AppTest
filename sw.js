// Offline support: serve files from the network when online (always revalidated, so an update never mixes old and new files), from the cache when offline.
const CACHE = 'pocket-v41';
const CORE = ['./', './index.html', './play.html', './icon.svg', './manifest.webmanifest', './update.js', './engine/pocket.js',
  './editor/', './editor/index.html', './editor/editor.css', './editor/editor.js', './editor/icons.js', './editor/nodes.js', './editor/modeler.js', './editor/meshops.js', './editor/timeline.js', './editor/logic.js',
  './editor/library.js', './editor/storage.js', './editor/loading.js', './examples/templates.js', './examples/neon-dodge/', './examples/neon-dodge/main.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./editor/index.html'))));
});
