// The editor, full screen: Pocket Engine's own editor in the app. Its Home (and the phone's Back) come back to the app's Home;
// what it downloads (exports, backups) opens the share sheet; vibration becomes haptics.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import WebFrame from '../WebFrame';
import { prefs } from '../prefs';
import { shareFile } from '../files';
import { say } from '../ui';

export default function EditorScreen({ T, uri, onHome }) {
  const ref = useRef(null), [ready, setReady] = useState(false), home = useRef(onHome);
  home.current = onHome;
  useEffect(() => { const t = setTimeout(() => setReady(true), 2500); return () => clearTimeout(t); }, []);
  useEffect(() => { // Android's Back: the editor saves and hands over to Home
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { ref.current?.send?.({ type: 'home' }); setTimeout(() => home.current(), 1500); return true; });
    return () => sub.remove();
  }, []);
  const onMessage = (m) => {
    if (m.type === 'home') return home.current(m.project);
    if (m.type === 'haptic' && prefs.haptics) return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (m.type === 'file') return shareFile(m.name, m.data, m.mime).catch((e) => say('Could not save the file', String(e.message || e)));
  };
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <WebFrame ref={ref} uri={uri} onMessage={onMessage} />
      {!ready ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}><ActivityIndicator color={T.accent} size="large" /></View> : null}
    </View>
  );
}
