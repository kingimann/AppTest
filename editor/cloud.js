// Accounts and cloud sync. A profile always lives on the device; with a Supabase project
// (cloud-config.js, or Account › Connect a server) people can sign in and their projects sync between devices.
// Talks to Supabase's REST APIs directly (Auth and PostgREST), so there is no library to load.
import { CLOUD } from './cloud-config.js';

const K = { cfg: 'pocket.cloud.config', session: 'pocket.cloud.session', profile: 'pocket.profile', synced: 'pocket.cloud.synced', dirty: 'pocket.cloud.dirty', gone: 'pocket.cloud.deleted', last: 'pocket.cloud.lastSync' };
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};
export const AVATAR_COLORS = ['#4f8cff', '#7b4fd6', '#e0457b', '#f08a24', '#2bb673', '#13a3b5', '#5c6b7a'];

// ---- configuration: cloud-config.js for everyone, or a server connected on this device (for trying it out) ----
export function config() {
  const own = ls.get(K.cfg, null);
  const c = own?.url ? own : CLOUD;
  return { url: String(c.url || '').trim().replace(/\/+$/, ''), anonKey: String(c.anonKey || '').trim(), local: !!own?.url };
}
export const configured = () => { const c = config(); return !!(c.url && c.anonKey); };
export function connectServer(url, anonKey) { ls.set(K.cfg, { url, anonKey }); }
export function disconnectServer() { ls.del(K.cfg); }
/** Checks a Supabase URL and key, and returns the sign-in methods it has turned on (google, github, apple…). */
export async function testServer(url = config().url, anonKey = config().anonKey) {
  const r = await fetch(String(url).replace(/\/+$/, '') + '/auth/v1/settings', { headers: { apikey: anonKey } });
  if (!r.ok) throw new Error(r.status === 401 ? 'The key was not accepted' : `The server answered ${r.status}`);
  const j = await r.json();
  return { providers: Object.entries(j.external || {}).filter(([k, on]) => on && !['email', 'phone', 'anonymous_users'].includes(k)).map(([k]) => k), email: j.external?.email !== false, confirm: !j.mailer_autoconfirm };
}

// ---- the profile: a name and a colour, on the device (and in the account when signed in) ----
export function profile() {
  const p = ls.get(K.profile, {}), u = user();
  return { name: p.name || u?.user_metadata?.name || (u?.email ? u.email.split('@')[0] : ''), color: p.color || u?.user_metadata?.color || AVATAR_COLORS[0], email: u?.email || '' };
}
export function setProfile(p) {
  ls.set(K.profile, { ...ls.get(K.profile, {}), ...p });
  emit();
  if (user()) call('/auth/v1/user', { method: 'PUT', body: { data: { name: profile().name, color: profile().color } } }).then((u) => { if (u?.id) saveSession({ ...session(), user: u }); }).catch(() => {});
}
export const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '';

// ---- the session ----
const session = () => ls.get(K.session, null);
function saveSession(s) { if (s) ls.set(K.session, s); else ls.del(K.session); emit(); }
export const user = () => (configured() ? session()?.user || null : null);
export const signedIn = () => !!user();

let listeners = [], status = { busy: false, text: '', error: '' };
export function onChange(fn) { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn); }; }
function emit() { for (const f of listeners) { try { f(); } catch { /* a listener's problem is its own */ } } }
function setStatus(s) { status = { ...status, ...s }; emit(); }
export const syncStatus = () => ({ ...status, last: ls.get(K.last, 0), count: Object.keys(ls.get(K.synced, {})).length });

async function call(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const c = config(); if (!c.url) throw new Error('No server');
  if (auth && path.startsWith('/rest/')) await fresh();
  const s = session(), h = { apikey: c.anonKey, 'Content-Type': 'application/json', ...headers };
  if (auth && s?.access_token) h.Authorization = 'Bearer ' + s.access_token;
  const r = await fetch(c.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) {
    if (r.status === 401 && auth && s && path.startsWith('/rest/')) saveSession(null); // the sign-in ran out: sign in again
    throw new Error(j?.msg || j?.error_description || j?.message || j?.error || `Error ${r.status}`);
  }
  return j;
}
/** Swap an old access token for a new one before it runs out. */
async function fresh() {
  const s = session(); if (!s?.refresh_token || (s.expires_at || 0) - Date.now() / 1000 > 60) return;
  try { const j = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token }, auth: false }); took(j); }
  catch { saveSession(null); }
}
function took(j) { if (!j?.access_token) return false; saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.round(Date.now() / 1000) + (j.expires_in || 3600), user: j.user }); return true; }

export async function signUp(email, password, name) {
  const j = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data: { name, color: profile().color } }, auth: false });
  if (name) ls.set(K.profile, { ...ls.get(K.profile, {}), name });
  return took(j) ? 'signed in' : 'confirm'; // projects with email confirmation send a link first
}
export async function signIn(email, password) { return took(await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false })); }
export async function resetPassword(email) { await call('/auth/v1/recover', { method: 'POST', body: { email }, auth: false }); }
/** Google, GitHub, Apple…: goes to the provider and comes back signed in (see takeRedirect). */
export function signInWith(provider) { const c = config(); location.href = `${c.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(location.origin + location.pathname)}`; }
/** Coming back from a provider or an email link: the tokens are in the address (#access_token=…). */
export async function takeRedirect() {
  if (!configured() || !/access_token=/.test(location.hash)) return false;
  const q = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  saveSession({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_at: +q.get('expires_at') || Math.round(Date.now() / 1000) + (+q.get('expires_in') || 3600), user: null });
  try { const u = await call('/auth/v1/user'); saveSession({ ...session(), user: u }); return true; } catch { saveSession(null); return false; }
}
export async function signOut() {
  try { await call('/auth/v1/logout', { method: 'POST' }); } catch { /* signed out on this device either way */ }
  saveSession(null); ls.del(K.synced); ls.del(K.dirty); ls.del(K.gone); ls.del(K.last);
}

// ---- syncing projects ----
// io = { all() → {id: rec}, save(id, rec), remove(id), thumb(id), setThumb(id, src), changedOpen(id, rec) }
let io = null, timer = 0, applying = false, again = false;
export function attach(x) { io = x; }
const kindOf = (j) => (j?.settings?.app ? 'app' : j?.mode === '3d' ? '3d' : '2d');
/** A project was saved on this device: send it up soon (a few seconds after the last change). */
export function saved(id) {
  if (applying || !signedIn()) return;
  const d = ls.get(K.dirty, {}); d[id] = 1; ls.set(K.dirty, d);
  clearTimeout(timer); timer = setTimeout(() => syncAll(), 4000); // a full sync (one small list request), so a change made on another device meanwhile isn't overwritten
}
export function removed(id) {
  if (applying || !signedIn()) return;
  const g = ls.get(K.gone, {}); g[id] = Date.now(); ls.set(K.gone, g);
  const d = ls.get(K.dirty, {}); delete d[id]; ls.set(K.dirty, d);
  clearTimeout(timer); timer = setTimeout(() => syncAll(), 1500);
}
async function push(id, rec) {
  const u = user(); if (!u || !rec) return;
  await call('/rest/v1/projects?on_conflict=user_id,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: [{ user_id: u.id, id, name: rec.name || '', kind: kindOf(rec.json), updated: rec.updated || Date.now(), deleted: false, data: rec.json, thumb: io?.thumb(id) || null }] });
  const sy = ls.get(K.synced, {}); sy[id] = rec.updated || 0; ls.set(K.synced, sy);
}
async function pushGone() {
  if (!signedIn() || !io) return;
  const g = ls.get(K.gone, {});
  for (const [id, t] of Object.entries(g)) {
    await call(`/rest/v1/projects?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { deleted: true, data: null, thumb: null, updated: t } });
    const gg = ls.get(K.gone, {}); delete gg[id]; ls.set(K.gone, gg); const sy = ls.get(K.synced, {}); delete sy[id]; ls.set(K.synced, sy);
  }
  ls.set(K.last, Date.now()); emit();
}
/**
 * Two-way sync. Newer wins; when both sides changed since the last sync, the other device's version is kept
 * as a copy ("… (other device)") so nothing is lost. Returns { down, up, copies, removed }.
 */
export async function syncAll() {
  if (!signedIn() || !io) return null;
  if (status.busy) { again = true; return null; } // a change during a sync: sync once more after it
  setStatus({ busy: true, text: 'Syncing…', error: '' });
  const n = { down: 0, up: 0, copies: 0, removed: 0 };
  try {
    await pushGone();
    const remote = await call('/rest/v1/projects?select=id,name,updated,deleted') || [], sy = ls.get(K.synced, {}), all = io.all(), seen = new Set();
    const fetchOne = async (id) => (await call(`/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=data,thumb,name,updated`))?.[0];
    const take = async (id, r, as = id) => {
      const row = await fetchOne(id); if (!row?.data) return false;
      applying = true; try { io.save(as, { name: row.name, updated: +row.updated, json: row.data }); if (row.thumb) io.setThumb(as, row.thumb); } finally { applying = false; }
      if (as === id) {
        sy[id] = +row.updated; applying = true;
        try { io.changedOpen?.(id, { name: row.name, updated: +row.updated, json: row.data }); const now = io.all()[id]; if (now && now.updated !== +row.updated) io.save(id, { ...now, updated: +row.updated }); } // reopening saves it: keep the synced time
        finally { applying = false; }
      }
      return true;
    };
    for (const r of remote) {
      seen.add(r.id); const l = all[r.id], base = sy[r.id] || 0, ru = +r.updated || 0;
      if (r.deleted) {
        if (l && l.updated <= Math.max(base, ru)) { applying = true; try { io.remove(r.id); } finally { applying = false; } n.removed++; delete sy[r.id]; }
        else if (l) { await push(r.id, l); n.up++; } // changed here after it was deleted elsewhere: keep it
        continue;
      }
      if (!l) { if (await take(r.id, r)) n.down++; continue; }
      if (ru === l.updated) { sy[r.id] = ru; continue; }
      const lc = l.updated !== base, rc = ru !== base; // changed since the last sync (on this device / elsewhere)
      if (base && lc && rc) { // both changed: keep the other device's version as a copy
        const cid = r.id + '_' + Date.now().toString(36);
        if (await take(r.id, r, cid)) { const c = io.all()[cid]; applying = true; try { io.save(cid, { ...c, name: (c.name || 'Project') + ' (other device)', json: { ...c.json, name: (c.name || 'Project') + ' (other device)' } }); } finally { applying = false; } n.copies++; }
        await push(r.id, l); n.up++; continue;
      }
      if (base ? rc : ru > l.updated) { if (await take(r.id, r)) n.down++; } else { await push(r.id, l); n.up++; }
    }
    for (const [id, rec] of Object.entries(io.all())) if (!seen.has(id)) { await push(id, rec); n.up++; }
    ls.set(K.synced, { ...ls.get(K.synced, {}), ...sy }); ls.set(K.last, Date.now()); ls.del(K.dirty);
    setStatus({ busy: false, text: '', error: '' });
    if (again) { again = false; setTimeout(() => syncAll(), 300); }
    return n;
  } catch (e) { applying = false; setStatus({ busy: false, text: '', error: e.message || 'Sync failed' }); return null; }
}
