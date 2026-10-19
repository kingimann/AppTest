// Pocket Engine for iPhone and Android (Expo / React Native). Native screens: Home, Projects, Learn, Settings.
// The editor itself is Pocket Engine's own, full screen in the app (src/screens/EditorScreen.js); your projects stay in its
// storage on this phone, which the app reads and changes through a hidden page (src/bridge.js → editor/bridge.html).
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Text, TextInput, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bridge, onBridgeReady, request, resetBridge } from './src/bridge';
import { DARK, LIGHT } from './src/theme';
import { loadPrefs, onPrefs, prefs, site } from './src/prefs';
import { Icon } from './src/icons';
import { Button, Tap, confirmThen, say } from './src/ui';
import { pickText, shareText } from './src/files';
import HomeScreen from './src/screens/HomeScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import LearnScreen from './src/screens/LearnScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import EditorScreen from './src/screens/EditorScreen';
import DocsScreen from './src/screens/DocsScreen';
import NativeEditor from './src/editor/NativeEditor';

const TABS = [['home', 'Home', 'home'], ['projects', 'Projects', 'folder'], ['learn', 'Learn', 'book'], ['settings', 'Settings', 'gear']];

function TabBar({ T, tab, setTab }) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(10, inset.bottom), flexDirection: 'row', backgroundColor: T.card, borderRadius: 26, padding: 6, elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
      {TABS.map(([k, label, icon]) => (
        <Tap key={k} label={label} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 20, backgroundColor: tab === k ? T.accent + '33' : 'transparent' }}>
          <Icon name={icon} color={tab === k ? T.accent : T.sub} size={22} />
          <Text style={{ color: tab === k ? T.accent : T.sub, fontSize: 11, fontWeight: '700' }}>{label}</Text>
        </Tap>
      ))}
    </View>
  );
}

/** ⋯ on a project: open, rename, duplicate, export, delete. */
function ProjectSheet({ T, p, onClose, onOpen, onFull, onChanged }) {
  const [name, setName] = useState(p?.name || ''), [renaming, setRenaming] = useState(false);
  useEffect(() => { setName(p?.name || ''); setRenaming(false); }, [p]);
  if (!p) return null;
  const run = async (fn) => { try { await fn(); } catch (e) { say('Something went wrong', String(e.message || e)); } };
  const row = (icon, label, fn, danger) => (
    <Tap key={label} label={label} onPress={fn} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 6 }}>
      <Icon name={icon} color={danger ? T.danger : T.text} size={22} /><Text style={{ color: danger ? T.danger : T.text, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Tap>
  );
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Tap label="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Tap onPress={() => {}} style={{ backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 36, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 19, fontWeight: '900', marginBottom: 6 }}>{p.name}</Text>
          {renaming ? (
            <View style={{ gap: 10, paddingVertical: 8 }}>
              <TextInput autoFocus value={name} onChangeText={setName} selectTextOnFocus style={{ color: T.text, backgroundColor: T.card2, borderRadius: 12, padding: 12, fontSize: 16 }} />
              <Button T={T} label="Rename" onPress={() => run(async () => { await request('rename', { project: p.id, name }); onClose(); onChanged(); })} />
            </View>
          ) : (
            <>
              {row('play', 'Open', () => { onClose(); onOpen(p); })}
              {row('code', 'Open in the full editor', () => { onClose(); onFull(p); })}
              {row('edit', 'Rename', () => setRenaming(true))}
              {row('copy', 'Duplicate', () => run(async () => { await request('duplicate', { project: p.id }); onClose(); onChanged(); }))}
              {row('share', 'Export (.json)', () => run(async () => { const r = await request('export', { project: p.id }); await shareText((r.name || 'project').replace(/[^\w\- ]+/g, '') + '.json', r.json); }))}
              {row('trash', 'Delete', () => confirmThen(`Delete “${p.name}”?`, 'This can’t be undone.', 'Delete', () => run(async () => { await request('delete', { project: p.id }); onClose(); onChanged(); })), true)}
            </>
          )}
        </Tap>
      </Tap>
    </Modal>
  );
}

function Main() {
  const scheme = useColorScheme(), [, redraw] = useState(0);
  useEffect(() => onPrefs(() => redraw((n) => n + 1)), []);
  const T = prefs.theme === 'light' || (prefs.theme === 'system' && scheme === 'light') ? LIGHT : DARK;
  const [tab, setTab] = useState('home'), [screen, setScreen] = useState(null), [sheet, setSheet] = useState(null), [bridgeV, setBridgeV] = useState(0);
  const [projects, setProjects] = useState([]), [templates, setTemplates] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const [p, t] = await Promise.all([request('list'), templates.length ? templates : request('templates')]); setProjects(p); setTemplates(t); setError(''); }
    catch (e) { setError(String(e.message || e)); }
    setLoading(false);
  }, [templates]);
  useEffect(() => onBridgeReady(() => { refresh(); }), [bridgeV]); // eslint-disable-line react-hooks/exhaustive-deps
  const editor = (q) => setScreen({ type: 'editor', uri: `${site()}/editor/?app=1&${q}` });
  const full = (id) => editor('project=' + encodeURIComponent(id)); // the full (web) editor: every tool
  const classic = prefs.editor === 'full';
  const open = (p) => (classic ? full(p.id) : setScreen({ type: 'native', open: { project: p.id }, key: Date.now() }));
  const create = (t) => { const name = t.key.startsWith('empty') ? (t.kind === 'app' ? 'My App' : 'New Game') : undefined;
    if (classic) editor('template=' + encodeURIComponent(t.key) + (name ? '&name=' + encodeURIComponent(name) : '')); else setScreen({ type: 'native', open: { template: t.key, name }, key: Date.now() }); };
  const back = () => { setScreen(null); refresh(); };
  const doImport = async () => { try { const text = await pickText(); if (!text) return; const r = await request('import', { text }); await refresh(); if (r.backup) say('Backup restored', `${r.backup.added} added, ${r.backup.updated} updated`); else if (r.id) open({ id: r.id }); } catch (e) { say('Could not import', String(e.message || e)); } };
  const doBackup = async () => { try { const text = await request('backup'); await shareText(`pocket-engine-backup-${new Date().toISOString().slice(0, 10)}.json`, text); } catch (e) { say('Could not back up', String(e.message || e)); } };
  const props = { T, projects, templates, loading, error, onOpen: open, onNew: create, onMore: setSheet, onRetry: () => { resetBridge(); setBridgeV((v) => v + 1); } };
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style={T.dark ? 'light' : 'dark'} />
      <Bridge version={bridgeV} />
      {screen?.type === 'native' ? <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: T.card }}><NativeEditor key={screen.key} T={T} open={screen.open} onHome={back} onFullEditor={full} /></SafeAreaView>
        : screen?.type === 'editor' ? <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#0e1014' }}><EditorScreen T={T} uri={screen.uri} onHome={back} /></SafeAreaView>
        : screen?.type === 'docs' ? <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: T.card }}><DocsScreen T={T} uri={screen.uri} title={screen.title} onBack={() => setScreen(null)} /></SafeAreaView>
        : (
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            {tab === 'home' ? <HomeScreen {...props} onAll={() => setTab('projects')} />
              : tab === 'projects' ? <ProjectsScreen {...props} onImport={doImport} onBackup={doBackup} onRefresh={refresh} />
              : tab === 'learn' ? <LearnScreen T={T} onGuide={(id, title) => setScreen({ type: 'docs', title, uri: `${site()}/docs/#/guide/${id}` })} />
              : <SettingsScreen T={T} onSiteChanged={() => { resetBridge(); setTemplates([]); setBridgeV((v) => v + 1); }} />}
            <TabBar T={T} tab={tab} setTab={setTab} />
          </SafeAreaView>
        )}
      <ProjectSheet T={T} p={sheet} onClose={() => setSheet(null)} onOpen={open} onFull={(p) => full(p.id)} onChanged={refresh} />
    </View>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { loadPrefs().then(() => { // (the web version: ?site= opens another copy of the editor)
    if (Platform.OS === 'web') { const s = new URLSearchParams(window.location.search).get('site'); if (s) prefs.site = s; }
    setReady(true); }); }, []);
  return <SafeAreaProvider>{ready ? <Main /> : <View style={{ flex: 1, backgroundColor: DARK.bg }} />}</SafeAreaProvider>;
}
