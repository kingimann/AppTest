// Settings: the look, haptics, where the editor lives, and about.
import React, { useState } from 'react';
import { Linking, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, H1, H2, Sub, Tap } from '../ui';
import { DEFAULT_SITE, prefs, setPref } from '../prefs';

export default function SettingsScreen({ T, onSiteChanged }) {
  const [site, setSite] = useState(prefs.site), [, redraw] = useState(0);
  const set = (k, v) => { setPref(k, v); redraw((n) => n + 1); };
  const opt = (k, v, label) => (
    <Tap key={v} label={label} onPress={() => set(k, v)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: prefs[k] === v ? T.accent : 'transparent' }}>
      <Text style={{ color: prefs[k] === v ? '#fff' : T.text, fontWeight: '700' }}>{label}</Text>
    </Tap>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
      <H1 T={T}>Settings</H1>
      <H2 T={T}>Look</H2>
      <Card T={T} style={{ flexDirection: 'row', padding: 4 }}>{opt('theme', 'dark', 'Dark')}{opt('theme', 'light', 'Light')}{opt('theme', 'system', 'Phone')}</Card>
      <Card T={T} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><Text style={{ color: T.text, fontWeight: '700', fontSize: 15 }}>Haptics</Text><Sub T={T}>A small tap when you press things</Sub></View>
        <Switch value={!!prefs.haptics} onValueChange={(v) => set('haptics', v)} trackColor={{ true: T.accent, false: T.line }} />
      </Card>
      <H2 T={T}>Editor</H2>
      <Card T={T} style={{ gap: 8 }}>
        <Text style={{ color: T.text, fontWeight: '700', fontSize: 15 }}>Editor address</Text>
        <Sub T={T}>The app opens Pocket Engine's editor from here (your games are saved on this phone). Change it only if you host your own copy.</Sub>
        <TextInput value={site} onChangeText={setSite} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder={DEFAULT_SITE} placeholderTextColor={T.sub}
          style={{ color: T.text, backgroundColor: T.card2, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12, fontSize: 14 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button T={T} label="Save" small onPress={() => { set('site', site.trim() || DEFAULT_SITE); onSiteChanged(); }} /></View>
          <View style={{ flex: 1 }}><Button T={T} label="Default" small kind="ghost" onPress={() => { setSite(DEFAULT_SITE); set('site', DEFAULT_SITE); onSiteChanged(); }} /></View>
        </View>
      </Card>
      <Button T={T} icon="link" label="Open Pocket Engine on the web" kind="ghost" onPress={() => Linking.openURL(prefs.site || DEFAULT_SITE)} />
      <H2 T={T}>About</H2>
      <Card T={T} style={{ gap: 4 }}>
        <Text style={{ color: T.text, fontWeight: '800' }}>Pocket Engine 1.0</Text>
        <Sub T={T}>Make games and apps on your phone. The Home, Projects, Learn and Settings screens are native React Native; the editor is Pocket Engine's own, inside the app, with exports going to your phone's share sheet.</Sub>
      </Card>
    </ScrollView>
  );
}
