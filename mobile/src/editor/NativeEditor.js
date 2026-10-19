// The native editor (React Native): a top bar (Home, name, undo / redo, Play), the Scene view (Pocket Engine drawing the level),
// and a panel with the Hierarchy, Inspector, Add and Console. Edits are saved as you go; undo and redo keep the last 60 steps.
// What isn't native yet (node scripts, triggers, data, build settings…) is one tap away: ⋯ › Open in the full editor.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import SceneView from './SceneView';
import { AddPanel, ConsolePanel, Hierarchy, Inspector } from './Panels';
import { request } from '../bridge';
import { Icon } from '../icons';
import { Tap, confirmThen, say } from '../ui';

const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const levelOf = (g, i) => (i > 0 ? g.levels?.[i - 1] || g : g);
const TABS = [['hierarchy', 'Hierarchy', 'layers'], ['inspector', 'Inspector', 'sliders'], ['add', 'Add', 'plus'], ['console', 'Console', 'code']];

export default function NativeEditor({ T, open, onHome, onFullEditor }) {
  const scene = useRef(null), [game, setGame] = useState(null), [projectId, setProjectId] = useState(open.project || null), [level, setLevel] = useState(0);
  const [sel, setSel] = useState(null), [tab, setTab] = useState('hierarchy'), [size, setSize] = useState('half'), [playing, setPlaying] = useState(false);
  const [schemas, setSchemas] = useState(null), [presets, setPresets] = useState(null), [logs, setLogs] = useState([]), [menu, setMenu] = useState(false), [objMenu, setObjMenu] = useState(null);
  const [saved, setSaved] = useState(true), [sceneReady, setSceneReady] = useState(false), [error, setError] = useState('');
  const hist = useRef({ back: [], fwd: [] }), saveT = useRef(null), latest = useRef(null), loadedFor = useRef(null);
  const { height } = useWindowDimensions();
  latest.current = game;

  // ---------- open the project (or make one from a template) ----------
  useEffect(() => {
    (open.project ? request('get', { project: open.project }) : request('create', { template: open.template, name: open.name }))
      .then((r) => { setProjectId(r.id); setGame(r.json); }).catch((e) => setError(String(e.message || e)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const lv = game ? levelOf(game, level) : null, three = lv?.mode === '3d';
  useEffect(() => { // the scene shows it (once ready); component settings and ready-made objects come from the engine
    if (!sceneReady || !game) return;
    const key = `${projectId}:${level}`;
    if (loadedFor.current !== key) { loadedFor.current = key; scene.current.call('load', { game, level }).catch(() => {}); }
    if (!schemas) scene.current.call('schemas').then(setSchemas).catch(() => {});
  }, [sceneReady, game, level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sceneReady && lv) scene.current.call('presets', { three }).then(setPresets).catch(() => {}); }, [sceneReady, three, !!lv]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sceneReady) scene.current.tell('select', { id: sel }); }, [sel, sceneReady]);

  // ---------- saving ----------
  const save = useCallback(async (g = latest.current) => { if (!g || !projectId) return; clearTimeout(saveT.current); try { await request('save', { project: projectId, json: g }); setSaved(true); } catch (e) { setSaved(false); } }, [projectId]);
  const later = () => { setSaved(false); clearTimeout(saveT.current); saveT.current = setTimeout(() => save(), 800); };
  const home = useCallback(async () => { if (playing) await scene.current?.call('stop').catch(() => {}); await save(); onHome(); }, [playing, save, onHome]);
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (playing) { stop(); return true; } home(); return true; }); return () => sub.remove(); });

  // ---------- editing: every change makes a new copy (undo keeps the old one), shows it, and saves soon ----------
  const commit = (g, { reload = true } = {}) => {
    const h = hist.current; h.back.push(JSON.stringify(latest.current)); if (h.back.length > 60) h.back.shift(); h.fwd = [];
    setGame(g); latest.current = g; if (reload) scene.current?.tell('load', { game: g, level, keepView: true }); later();
  };
  const editGame = (fn) => { const g = clone(latest.current); fn(g, levelOf(g, level)); commit(g); };
  const editEnt = (id, fn) => editGame((g, l) => { const e = l.entities.find((x) => x.id === id); if (e) fn(e); });
  const undoRedo = (dir) => {
    const h = hist.current, from = dir < 0 ? h.back : h.fwd, to = dir < 0 ? h.fwd : h.back; if (!from.length) return;
    to.push(JSON.stringify(latest.current)); const g = JSON.parse(from.pop()); setGame(g); latest.current = g;
    scene.current?.tell('load', { game: g, level, keepView: true }); later();
    if (sel && !levelOf(g, level).entities.some((e) => e.id === sel)) setSel(null);
  };
  const addPreset = (p) => {
    const e = clone(p.props || {}); e.id = uid(); e.name ||= p.label;
    if (!e.ui) { if (three) { e.x ??= 0; e.z ??= 0; } else { const v = lv.view || { width: 400, height: 700 }; if (e.x == null) e.x = v.width / 2; if (e.y == null || e.y < 2) e.y = v.height / 2; } }
    editGame((g, l) => { l.entities.push(e); }); setSel(e.id); setTab('inspector');
  };
  const duplicate = (id) => { const nid = uid(); editGame((g, l) => { const i = l.entities.findIndex((x) => x.id === id); if (i < 0) return; const c = clone(l.entities[i]); c.id = nid; c.name = (c.name || 'Object') + ' copy'; c.x = (c.x || 0) + (three ? 1 : 20); c.y = (c.y || 0) + (three ? 0 : 20); l.entities.splice(i + 1, 0, c); }); setSel(nid); };
  const remove = (id) => { const name = lv.entities.find((x) => x.id === id)?.name || 'this object';
    confirmThen(`Delete ${name}?`, 'Undo brings it back.', 'Delete', () => { editGame((g, l) => { const gone = new Set([id]); let grew = true; while (grew) { grew = false; for (const x of l.entities) if (x.parent && gone.has(x.parent) && !gone.has(x.id)) { gone.add(x.id); grew = true; } } l.entities = l.entities.filter((x) => !gone.has(x.id)); }); setSel(null); }); };
  const reorder = (id, d) => editGame((g, l) => { const i = l.entities.findIndex((x) => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= l.entities.length) return; const [x] = l.entities.splice(i, 1); l.entities.splice(j, 0, x); });

  // ---------- the scene's events ----------
  const onEvent = useCallback((m) => {
    if (m.type === 'tap') { setSel(m.id); if (m.id) setTab((t) => (t === 'add' || t === 'console' ? 'inspector' : t)); }
    else if (m.type === 'moved') { const g = clone(latest.current), e = levelOf(g, level).entities.find((x) => x.id === m.id); if (!e) return; e.x = m.x; e.y = m.y; if (m.z != null && levelOf(g, level).mode === '3d') e.z = m.z; commit(g, { reload: false }); }
    else if (m.type === 'log') setLogs((L) => [...L.slice(-199), m]);
    else if (m.type === 'played') setPlaying(true);
    else if (m.type === 'stopped') setPlaying(false);
  }, [level]); // eslint-disable-line react-hooks/exhaustive-deps
  const play = async () => { await save(); setLogs([]); setSize('peek'); scene.current?.call('play').catch((e) => say('Could not play', String(e.message || e))); };
  const stop = () => { scene.current?.call('stop').catch(() => {}); setSize('half'); };

  if (error) return <View style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}><Text style={{ color: T.danger, fontWeight: '800' }}>Could not open the project</Text><Text style={{ color: T.sub, textAlign: 'center' }}>{error}</Text><Tap label="Home" onPress={onHome}><Text style={{ color: T.accent, fontWeight: '800' }}>Back to Home</Text></Tap></View>;
  const e = sel && lv ? lv.entities.find((x) => x.id === sel) : null;
  const panelH = size === 'peek' ? 0 : size === 'tall' ? height * 0.66 : height * 0.42;
  const bar = (icon, label, fn, on = true, accent) => <Tap label={label} onPress={fn} disabled={!on} style={{ padding: 8, borderRadius: 10, backgroundColor: accent ? T.accent : 'transparent' }}><Icon name={icon} color={accent ? '#fff' : on ? T.text : T.sub} size={20} /></Tap>;
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* top bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 52, backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line }}>
        {bar('home', 'Home', home)}
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontWeight: '800', fontSize: 16 }}>{game?.name || 'Loading…'}</Text>
          <Text style={{ color: T.sub, fontSize: 11 }}>{playing ? 'Playing' : saved ? 'Saved' : 'Saving…'}{game?.levels?.length ? ` · Level ${level + 1}` : ''}</Text>
        </View>
        {!playing ? <>{bar('undo', 'Undo', () => undoRedo(-1), hist.current.back.length > 0)}{bar('repeat', 'Redo', () => undoRedo(1), hist.current.fwd.length > 0)}</> : null}
        <Tap label={playing ? 'Stop' : 'Play'} onPress={playing ? stop : play} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: playing ? T.danger : T.accent }}>
          <Icon name={playing ? 'close' : 'play'} color="#fff" size={16} /><Text style={{ color: '#fff', fontWeight: '800' }}>{playing ? 'Stop' : 'Play'}</Text>
        </Tap>
        {bar('more', 'More', () => setMenu(true))}
      </View>
      {/* the scene */}
      <View style={{ flex: 1 }}>
        <SceneView ref={scene} onEvent={onEvent} onReady={() => setSceneReady(true)} />
        {!game || !sceneReady ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}><ActivityIndicator color={T.accent} size="large" /></View> : null}
      </View>
      {/* the panel */}
      <View style={{ backgroundColor: T.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, marginTop: -14 }}>
        <Pressable accessibilityLabel="Resize the panel" onPress={() => setSize(size === 'peek' ? 'half' : size === 'half' ? 'tall' : 'peek')} style={{ alignItems: 'center', paddingVertical: 8 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: T.line }} />
        </Pressable>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, gap: 4 }}>
          {TABS.map(([k, label, icon]) => (
            <Tap key={k} label={label} onPress={() => { setTab(k); if (size === 'peek') setSize('half'); }} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 12, backgroundColor: tab === k && size !== 'peek' ? T.accent + '33' : 'transparent' }}>
              <Icon name={icon} color={tab === k && size !== 'peek' ? T.accent : T.sub} size={20} />
              <Text style={{ color: tab === k && size !== 'peek' ? T.accent : T.sub, fontSize: 11, fontWeight: '700' }}>{label}{k === 'console' && logs.some((l) => l.level === 'error') ? ' •' : ''}</Text>
            </Tap>))}
        </View>
        <View style={{ height: panelH, paddingHorizontal: 12, paddingTop: size === 'peek' ? 0 : 10 }}>
          {size === 'peek' || !lv ? null
            : tab === 'hierarchy' ? <Hierarchy T={T} level={lv} sel={sel} onSelect={(id) => setSel(id)} onToggle={(id) => editEnt(id, (x) => { if (x.visible === false) delete x.visible; else x.visible = false; })} onMore={setObjMenu} />
            : tab === 'inspector' ? <Inspector T={T} game={game} level={lv} e={e} three={three} schemas={schemas} onChange={editEnt} onGame={editGame}
                onDuplicate={() => duplicate(sel)} onDelete={() => remove(sel)} onFrame={() => scene.current?.tell('frame', { id: sel })} />
            : tab === 'add' ? <AddPanel T={T} presets={presets} onAdd={addPreset} />
            : <ConsolePanel T={T} logs={logs} onClear={() => setLogs([])} />}
        </View>
      </View>
      {/* ⋯ */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable onPress={() => setMenu(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, gap: 4 }}>
            <Text style={{ color: T.text, fontWeight: '900', fontSize: 18, marginBottom: 6 }}>{game?.name}</Text>
            {(game?.levels?.length ? [game, ...game.levels] : []).map((l, i) => (
              <Tap key={i} label={'Level ' + (i + 1)} onPress={() => { setMenu(false); setSel(null); setLevel(i); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                <Icon name="layers" color={i === level ? T.accent : T.text} size={20} /><Text style={{ color: i === level ? T.accent : T.text, fontSize: 16, fontWeight: '700' }}>Level {i + 1}{l.levelName || l.name ? ` · ${l.levelName || l.name}` : ''}</Text>
              </Tap>))}
            <Tap label="Reset the view" onPress={() => { setMenu(false); scene.current?.tell('resetView'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}><Icon name="refresh" color={T.text} size={20} /><Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Reset the view</Text></Tap>
            <Tap label="Open in the full editor" onPress={async () => { setMenu(false); await save(); onFullEditor(projectId); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <Icon name="code" color={T.text} size={20} /><View><Text style={{ color: T.text, fontSize: 16, fontWeight: '700' }}>Open in the full editor</Text><Text style={{ color: T.sub, fontSize: 12 }}>Scripts, triggers, data, animation, build settings…</Text></View>
            </Tap>
          </View>
        </Pressable>
      </Modal>
      {/* long-press on an object */}
      <Modal visible={!!objMenu} transparent animationType="fade" onRequestClose={() => setObjMenu(null)}>
        <Pressable onPress={() => setObjMenu(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: T.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34 }}>
            {[['sliders', 'Inspect', () => { setSel(objMenu); setTab('inspector'); }], ['copy', 'Duplicate', () => duplicate(objMenu)], ['back', 'Move up', () => reorder(objMenu, -1)], ['next', 'Move down', () => reorder(objMenu, 1)], ['trash', 'Delete', () => remove(objMenu)]].map(([icon, label, fn]) => (
              <Tap key={label} label={label} onPress={() => { const id = objMenu; setObjMenu(null); fn(id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
                <Icon name={icon} color={label === 'Delete' ? T.danger : T.text} size={20} /><Text style={{ color: label === 'Delete' ? T.danger : T.text, fontSize: 16, fontWeight: '700' }}>{label}</Text>
              </Tap>))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
