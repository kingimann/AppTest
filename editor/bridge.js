// The Pocket Engine phone app (React Native, mobile/) keeps this page open in a hidden web view, on the editor's own site,
// so it sees the same saved projects as the editor. Messages in: { id, op, ...args }; out: { re: id, ok, data | error }.
// It also says { type: 'ready' } once storage is open.
import { initStorage, allProjects, saveProject, deleteProject, makeBackup, restoreBackup } from './storage.js';
import { templates } from '../examples/templates.js';

const post = (m) => {
  const s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else if (window.parent !== window) window.parent.postMessage(s, '*'); // (the app's web version: an iframe)
};
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/** Read the projects again (the editor may have saved or deleted some since). */
const fresh = async () => { const c = allProjects(); for (const k of Object.keys(c)) delete c[k]; await initStorage(); return allProjects(); };
const kindOf = (json) => (json?.settings?.app ? 'app' : json?.mode === '3d' ? '3d' : '2d');
const summary = (all) => Object.entries(all).filter(([, r]) => r?.json).map(([id, r]) => ({
  id, name: r.name || r.json.name || 'Untitled', updated: r.updated || 0, kind: kindOf(r.json), objects: (r.json.entities || []).length,
  pages: (r.json.entities || []).filter((e) => (e.behaviors || []).some((b) => b.type === 'uiShowIf')).length, levels: 1 + (r.json.levels || []).length,
})).sort((a, b) => b.updated - a.updated);

const ops = {
  async list() { return summary(await fresh()); },
  templates() { return Object.entries(templates).map(([key, g]) => ({ key, name: g.name, kind: kindOf(g) })); },
  async rename({ project, name }) { const all = await fresh(), r = all[project]; if (!r) throw new Error('no such project'); const n = String(name).trim() || r.name; await saveProject(project, { ...r, name: n, json: { ...r.json, name: n }, updated: Date.now() }); return summary(allProjects()); },
  async duplicate({ project }) { const all = await fresh(), r = all[project]; if (!r) throw new Error('no such project'); const json = JSON.parse(JSON.stringify(r.json)), name = (r.name || 'Untitled') + ' (copy)'; json.name = name; const id = uid(); await saveProject(id, { name, updated: Date.now(), json }); return id; },
  async delete({ project }) { await fresh(); await deleteProject(project); return summary(allProjects()); },
  async export({ project }) { const r = (await fresh())[project]; if (!r) throw new Error('no such project'); return { name: r.name || 'project', json: JSON.stringify(r.json, null, 1) }; },
  async import({ text }) {
    const data = JSON.parse(text);
    if (data.pocketBackup) { await fresh(); return { backup: await restoreBackup(data) }; }
    if (!Array.isArray(data.entities)) throw new Error('not a Pocket project or backup');
    const id = uid(), name = data.name || 'Imported'; await saveProject(id, { name, updated: Date.now(), json: data }); return { id };
  },
  async backup() { await fresh(); return JSON.stringify(makeBackup()); },
  // the native editor: read a whole project, save it, or start one from a template
  async get({ project }) { const r = (await fresh())[project]; if (!r) throw new Error('no such project'); return { id: project, name: r.name || r.json.name, json: r.json }; },
  async save({ project, name, json }) { const all = allProjects(), r = all[project] || {}; await saveProject(project, { ...r, name: name || json.name || r.name || 'Untitled', updated: Date.now(), json }); return true; },
  async create({ template, name }) {
    const t = templates[template]; if (!t) throw new Error('no such template');
    const json = JSON.parse(JSON.stringify(t)), id = uid(); json.name = name || json.name;
    for (const lv of [json, ...(json.levels || [])]) for (const e of lv.entities || []) e.id ||= 'e' + Math.random().toString(36).slice(2, 9);
    await saveProject(id, { name: json.name, updated: Date.now(), json }); return { id, name: json.name, json };
  },
};

async function handle(raw) {
  let m; try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  if (!m || !m.op || !ops[m.op]) return;
  try { post({ re: m.id, ok: true, data: await ops[m.op](m) }); } catch (err) { post({ re: m.id, ok: false, error: String(err?.message || err) }); }
}
window.pocketBridge = handle; // (react-native-webview: injectJavaScript calls this)
window.addEventListener('message', (e) => handle(e.data)); // (the app's web version)
document.addEventListener('message', (e) => handle(e.data)); // (Android's web view)
initStorage().then(() => post({ type: 'ready' }), () => post({ type: 'ready' }));
