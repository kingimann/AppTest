// Project storage for the editor.
//  · IndexedDB: room for hundreds of MB (localStorage holds ~5 MB for everything), one record per project,
//    so one big game can't stop the others from saving.
//  · Restore points: the last few versions of each project, taken every few minutes while you work.
//  · A rescue copy of the open project in localStorage, written instantly when the app goes to the background
//    (IndexedDB writes are asynchronous and a phone can freeze the page before one finishes).
//  · Backups: every game (and saved scripts) in one file, and restoring from it.
// If IndexedDB isn't available (some private modes), everything falls back to localStorage like before.

const DB_NAME = 'pocket-editor', DB_VERSION = 1;
const LS_PROJECTS = 'pocket.editor.projects', LS_RESCUE = 'pocket.editor.rescue', LS_BACKUP = 'pocket.editor.lastBackup';
const SNAP_EVERY = 3 * 60 * 1000, SNAP_KEEP = 12;

let db = null, cache = {}, lastSnap = {}, writeErr = null;
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
const req = (r) => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const done = (tx) => new Promise((ok, no) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => no(tx.error || new Error('write failed')); });

function openDB() {
  return new Promise((ok, no) => {
    if (!window.indexedDB) return no(new Error('no IndexedDB'));
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects');
      if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots', { autoIncrement: true }).createIndex('project', 'project');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
    r.onblocked = () => no(new Error('blocked'));
    setTimeout(() => no(new Error('timed out')), 4000); // a stuck open (seen on some iOS versions) must not stop the editor
  });
}

/** Open storage, load every project, and move old localStorage projects across (once). */
export async function initStorage() {
  try {
    db = await openDB();
    const tx = db.transaction('projects'), st = tx.objectStore('projects');
    const [keys, vals] = await Promise.all([req(st.getAllKeys()), req(st.getAll())]);
    keys.forEach((k, i) => { cache[k] = vals[i]; });
    // migrate: projects saved by older versions live in localStorage
    let old = {}; try { old = JSON.parse(ls.get(LS_PROJECTS, '{}')) || {}; } catch { old = {}; }
    const moving = Object.entries(old).filter(([id, p]) => p?.json && (!cache[id] || (p.updated || 0) > (cache[id].updated || 0)));
    if (moving.length) {
      const w = db.transaction('projects', 'readwrite');
      for (const [id, p] of moving) { cache[id] = p; w.objectStore('projects').put(p, id); }
      await done(w);
    }
    // only free the old copy once every project is safely in IndexedDB
    if (Object.keys(old).length) {
      const check = await req(db.transaction('projects').objectStore('projects').getAllKeys());
      if (Object.keys(old).every((id) => check.includes(id))) ls.del(LS_PROJECTS);
    }
  } catch (err) {
    db = null; // fall back to localStorage
    try { cache = JSON.parse(ls.get(LS_PROJECTS, '{}')) || {}; } catch { cache = {}; }
  }
  // the rescue copy wins when it is newer than what made it to the database
  try {
    const r = JSON.parse(ls.get(LS_RESCUE, 'null'));
    if (r?.id && r.rec?.json && (!cache[r.id] || r.rec.updated > (cache[r.id].updated || 0))) { cache[r.id] = r.rec; writeProject(r.id, r.rec); }
  } catch { /* no rescue copy */ }
  return { indexedDB: !!db, count: Object.keys(cache).length };
}

export const usingIndexedDB = () => !!db;
/** Every project: { id: { name, updated, json } } (in memory, so reads are instant). */
export const allProjects = () => cache;
export const lastWriteError = () => writeErr;

function writeProject(id, rec) {
  if (!db) { // localStorage fallback: the whole set in one key, like before
    const ok = ls.set(LS_PROJECTS, JSON.stringify(cache));
    writeErr = ok ? null : 'full';
    return Promise.resolve(ok);
  }
  try {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(rec, id);
    return done(tx).then(() => { writeErr = null; return true; }, (e) => { writeErr = e?.name === 'QuotaExceededError' ? 'full' : 'error'; return false; });
  } catch (e) { writeErr = 'error'; return Promise.resolve(false); }
}

/** Save a project. Also takes a restore point every few minutes. */
export function saveProject(id, rec) {
  cache[id] = rec;
  const p = writeProject(id, rec);
  if (db && Date.now() - (lastSnap[id] || 0) > SNAP_EVERY) { lastSnap[id] = Date.now(); snapshot(id, rec, 'auto'); }
  return p;
}
/** Instant, synchronous safety copy of the open project (when the app is about to be hidden or closed). */
export function rescueCopy(id, rec) {
  if (!id || !rec) return;
  const s = JSON.stringify({ id, rec });
  if (s.length < 2_500_000) ls.set(LS_RESCUE, s); else ls.del(LS_RESCUE);
}
export function deleteProject(id) {
  delete cache[id];
  if (!db) return writeProject(id);
  const tx = db.transaction(['projects', 'snapshots'], 'readwrite');
  tx.objectStore('projects').delete(id);
  const idx = tx.objectStore('snapshots').index('project');
  idx.openCursor(IDBKeyRange.only(id)).onsuccess = (ev) => { const c = ev.target.result; if (c) { c.delete(); c.continue(); } };
  try { const r = JSON.parse(ls.get(LS_RESCUE, 'null')); if (r?.id === id) ls.del(LS_RESCUE); } catch { /* ignore */ }
  return done(tx).catch(() => {});
}

// ---- restore points ----
export async function snapshot(id, rec, reason = 'auto') {
  if (!db || !rec?.json) return;
  try {
    const tx = db.transaction('snapshots', 'readwrite'), st = tx.objectStore('snapshots');
    st.add({ project: id, time: Date.now(), reason, name: rec.name, json: rec.json });
    await done(tx);
    // keep only the newest few for this project
    const list = await listSnapshots(id);
    if (list.length > SNAP_KEEP) {
      const t2 = db.transaction('snapshots', 'readwrite');
      for (const s of list.slice(SNAP_KEEP)) t2.objectStore('snapshots').delete(s.key);
      await done(t2);
    }
  } catch { /* a restore point is a nice-to-have; never block saving */ }
}
/** Restore points for a project, newest first: [{ key, time, reason, name, json }] */
export async function listSnapshots(id) {
  if (!db) return [];
  const out = [];
  await new Promise((ok) => {
    const r = db.transaction('snapshots').objectStore('snapshots').index('project').openCursor(IDBKeyRange.only(id));
    r.onsuccess = (ev) => { const c = ev.target.result; if (c) { out.push({ key: c.primaryKey, ...c.value }); c.continue(); } else ok(); };
    r.onerror = () => ok();
  });
  return out.sort((a, b) => b.time - a.time);
}

// ---- keeping the data ----
/** Ask the browser not to clear our storage when space runs low (Chrome / Android grant it; Safari decides itself). */
export async function askPersist() {
  try { if (navigator.storage?.persisted && await navigator.storage.persisted()) return true; return !!(await navigator.storage?.persist?.()); } catch { return false; }
}
export async function isPersisted() { try { return !!(await navigator.storage?.persisted?.()); } catch { return false; } }
/** { used, quota } in bytes, when the browser says. */
export async function storageUse() { try { const e = await navigator.storage?.estimate?.(); return e ? { used: e.usage || 0, quota: e.quota || 0 } : null; } catch { return null; } }

// ---- backups ----
const EXTRA_KEYS = ['pocket.scriptLibrary']; // saved reusable scripts travel with the backup
export function makeBackup() {
  const extra = {};
  for (const k of EXTRA_KEYS) { const v = ls.get(k); if (v != null) extra[k] = v; }
  return { pocketBackup: 1, created: Date.now(), projects: cache, extra };
}
export const lastBackup = () => +ls.get(LS_BACKUP, '0') || 0;
export const markBackedUp = () => ls.set(LS_BACKUP, String(Date.now()));
/** Restore a backup file: adds missing games and replaces older copies; a newer local copy is kept. */
export async function restoreBackup(data) {
  if (!data || data.pocketBackup !== 1 || typeof data.projects !== 'object') throw new Error('not a Pocket backup');
  let added = 0, updated = 0, kept = 0;
  for (const [id, rec] of Object.entries(data.projects)) {
    if (!rec?.json || !Array.isArray(rec.json.entities)) continue;
    const mine = cache[id];
    if (!mine) added++;
    else if ((rec.updated || 0) > (mine.updated || 0)) { updated++; await snapshot(id, mine, 'before restore'); }
    else { kept++; continue; }
    cache[id] = rec; await writeProject(id, rec);
  }
  for (const [k, v] of Object.entries(data.extra || {})) if (EXTRA_KEYS.includes(k) && typeof v === 'string' && !ls.get(k)) ls.set(k, v);
  return { added, updated, kept };
}
