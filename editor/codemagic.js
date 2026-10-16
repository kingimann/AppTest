// Build on Codemagic from the editor, with each person's own accounts.
//  · GitHub: sign in with GitHub (through the editor's Supabase sign-in, asking for the "repo" permission), or a token.
//    The game's app project goes into a private repository in their account (one commit per send).
//  · Codemagic: their own API token (Codemagic › Settings › Integrations › Codemagic API). The repository is added to
//    their Codemagic with a read-only deploy key made in the browser, then builds start and are watched from here.
// Both APIs answer browsers directly (CORS), so there is no server in between. Tokens stay on this device.

const K = { gh: 'pocket.github.token', ghUser: 'pocket.github.user', cm: 'pocket.codemagic.token' };
const ls = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

// ---- GitHub ----
export const githubToken = () => ls.get(K.gh);
export const githubLogin = () => ls.get(K.ghUser);
export function setGithubToken(t) { ls.set(K.gh, String(t || '').trim()); if (!t) ls.set(K.ghUser, ''); }
async function gh(path, { method = 'GET', body } = {}) {
  const r = await fetch('https://api.github.com' + path, { method, headers: { Authorization: 'Bearer ' + githubToken(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) { const e = new Error(r.status === 401 ? 'GitHub didn’t accept the sign-in: connect GitHub again' : (j?.message || `GitHub answered ${r.status}`) + (j?.errors?.[0]?.message ? ': ' + j.errors[0].message : '')); e.status = r.status; throw e; }
  return j;
}
/** Who the GitHub token belongs to (and remembers the name). */
export async function githubMe() { const u = await gh('/user'); ls.set(K.ghUser, u.login); return u; }
/** The game's repository: made (private, with a first commit) if it isn't there yet. */
export async function ensureRepo(name, description = '') {
  const owner = githubLogin() || (await githubMe()).login;
  try { return await gh(`/repos/${owner}/${name}`); } catch (e) { if (e.status !== 404) throw e; }
  return gh('/user/repos', { method: 'POST', body: { name, description, private: true, auto_init: true } });
}
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
/** Puts these files ({ name, data: string | Uint8Array, exec }) in the repository as one commit on its default branch. */
export async function pushFiles(repo, files, message, onStep = () => {}) {
  const full = repo.full_name, branch = repo.default_branch || 'main';
  const ref = await gh(`/repos/${full}/git/ref/heads/${branch}`), parent = await gh(`/repos/${full}/git/commits/${ref.object.sha}`);
  const enc = new TextEncoder(), tree = [];
  let n = 0;
  for (const f of files) {
    onStep(`Sending ${++n} of ${files.length} files…`);
    const bytes = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const blob = await gh(`/repos/${full}/git/blobs`, { method: 'POST', body: { content: b64(bytes), encoding: 'base64' } });
    tree.push({ path: f.name, mode: f.exec ? '100755' : '100644', type: 'blob', sha: blob.sha });
  }
  const t = await gh(`/repos/${full}/git/trees`, { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
  if (t.sha === parent.tree.sha) return { sha: parent.sha, branch, same: true }; // nothing changed
  const c = await gh(`/repos/${full}/git/commits`, { method: 'POST', body: { message, tree: t.sha, parents: [parent.sha] } });
  await gh(`/repos/${full}/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: c.sha } });
  return { sha: c.sha, branch };
}
/** A read-only deploy key on the repository, so Codemagic can fetch it. Returns the private key (PEM). */
export async function addDeployKey(repo) {
  const { pub, pem } = await makeSSHKey();
  await gh(`/repos/${repo.full_name}/keys`, { method: 'POST', body: { title: 'Codemagic (Pocket Engine)', key: pub, read_only: true } });
  return pem;
}
/** An RSA key pair made in the browser: the public half in OpenSSH form, the private half as PEM. */
async function makeSSHKey() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey), raw = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (ch) => ch.charCodeAt(0));
  const mpint = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.subarray(i); return b[0] & 0x80 ? Uint8Array.from([0, ...b]) : b; };
  const part = (b) => { const o = new Uint8Array(4 + b.length); new DataView(o.buffer).setUint32(0, b.length); o.set(b, 4); return o; };
  const blob = [part(new TextEncoder().encode('ssh-rsa')), part(mpint(raw(jwk.e))), part(mpint(raw(jwk.n)))], all = new Uint8Array(blob.reduce((n, q) => n + q.length, 0)); let at = 0; for (const q of blob) { all.set(q, at); at += q.length; }
  const pk8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)), body = b64(pk8).match(/.{1,64}/g).join('\n');
  return { pub: 'ssh-rsa ' + b64(all) + ' pocket-engine', pem: `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n` };
}

// ---- Codemagic ----
export const codemagicToken = () => ls.get(K.cm);
export function setCodemagicToken(t) { ls.set(K.cm, String(t || '').trim()); }
async function cm(path, { method = 'GET', body } = {}) {
  const r = await fetch('https://api.codemagic.io' + path, { method, headers: { 'x-auth-token': codemagicToken(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { j = txt; }
  if (!r.ok) { const e = new Error(r.status === 401 || r.status === 403 ? 'Codemagic didn’t accept the token: connect Codemagic again' : (j?.error || j?.message || (typeof j === 'string' && j) || `Codemagic answered ${r.status}`)); e.status = r.status; throw e; }
  return j;
}
/** Checks the token (it can list your apps). */
export async function codemagicCheck() { const j = await cm('/apps'); return (j?.applications || []).length; }
/** The Codemagic app for this repository: found by its address, or added (with a deploy key for the private repository). */
export async function ensureApp(repo, makeKey) {
  const ssh = repo.ssh_url, https = repo.clone_url, j = await cm('/apps');
  const norm = (u) => String(u || '').toLowerCase().replace(/\.git$/, '').replace(/^git@github\.com:/, 'github.com/').replace(/^https?:\/\//, '');
  const found = (j?.applications || []).find((a) => [ssh, https].some((u) => norm(a.repository?.htmlUrl || a.repository?.url || a.repositoryUrl) === norm(u)));
  if (found) return { id: found._id, name: found.appName };
  const key = await makeKey();
  const a = await cm('/apps/new', { method: 'POST', body: { repositoryUrl: ssh, sshKey: { data: btoa(key), passphrase: null } } });
  return { id: a._id, name: a.appName };
}
/** Starts a workflow from codemagic.yaml (ios-release / android-release) on a branch. */
export async function startBuild(appId, workflowId, branch = 'main') { const j = await cm('/builds', { method: 'POST', body: { appId, workflowId, branch } }); return j.buildId; }
export async function getBuild(id) { const j = await cm('/builds/' + id); return j.build || j; }
export async function recentBuilds(appId, n = 6) { const j = await cm(`/builds?appId=${encodeURIComponent(appId)}`); return (j.builds || []).slice(0, n); }
export async function cancelBuild(id) { await cm(`/builds/${id}/cancel`, { method: 'POST' }); }
/** A link anyone can open for a finished build's file (for a day). */
export async function publicLink(art) {
  const sec = String(art.url || '').replace(/^https:\/\/api\.codemagic\.io\/artifacts\//, '');
  const j = await cm(`/artifacts/${sec}/public-url`, { method: 'POST', body: { expiresAt: Math.round(Date.now() / 1000) + 86400 } });
  return j.url;
}
/** Plain words for a build's status. */
export const statusText = (s) => ({ queued: 'Waiting for a machine', preparing: 'Getting ready', fetching: 'Getting the code', building: 'Building', testing: 'Testing', publishing: 'Sending to the store', finishing: 'Finishing', finished: 'Done', failed: 'Failed', canceled: 'Cancelled', timeout: 'Took too long', skipped: 'Skipped', warning: 'Done (with warnings)' })[s] || s || '…';
export const isOver = (s) => ['finished', 'failed', 'canceled', 'timeout', 'skipped', 'warning'].includes(s);
