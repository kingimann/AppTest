// Offline support: serve files from the network when online (always revalidated, so an update never mixes old and new files), from the cache when offline.
const CACHE = 'pocket-v133';
const CORE = ['./', './index.html', './play.html', './icon.svg', './manifest.webmanifest', './update.js', './engine/pocket.js',
  './editor/', './editor/index.html', './editor/editor.css', './editor/editor.js', './editor/icons.js', './editor/navstyles.js', './editor/nodes.js', './editor/modeler.js', './editor/sprite2d.js', './editor/meshops.js', './editor/timeline.js', './editor/logic.js', './editor/items.js', './editor/story.js', './editor/data.js',
  './editor/library.js', './editor/storage.js', './editor/cloud.js', './editor/cloud-config.js', './editor/loading.js', './editor/stores.js', './editor/expo.js', './editor/native.js', './editor/storekit.js', './docs/', './docs/index.html', './docs/docs.css', './docs/docs.js', './docs/guide/getting-started.md', './docs/guide/accounts.md', './docs/guide/plugins-mods.md', './docs/guide/editor.md', './docs/guide/concepts.md', './docs/guide/objects.md', './docs/guide/physics.md', './docs/guide/triggers.md', './docs/guide/visual-scripting.md', './docs/guide/ui.md', './docs/guide/gameplay.md', './docs/guide/quests-dialogue.md', './docs/guide/apps.md', './docs/guide/camera-lighting.md', './docs/guide/animation-audio.md', './docs/guide/saving-online.md', './docs/guide/scripting.md', './docs/guide/engine-api.md', './docs/guide/custom-components.md', './docs/guide/publishing.md', './docs/guide/troubleshooting.md',
  './examples/templates.js', './examples/neon-dodge/', './examples/neon-dodge/main.js'];

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
// Phone Notifications (browser): tapping one brings the game forward and tells it which one (the message "notification opened ID")
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const key = (e.notification.data && e.notification.data.key) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((w) => 'focus' in w);
    if (c) { c.postMessage({ pocketNotify: key }); return c.focus(); }
    return self.clients.openWindow('./?notification=' + encodeURIComponent(key));
  }));
});
