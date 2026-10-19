// Projects: every game and app on this phone. Tap to open; ⋯ to rename, duplicate, export or delete; import from Files.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '../icons';
import { Button, H1, Sub } from '../ui';
import { ProjectRow } from './HomeScreen';

export default function ProjectsScreen({ T, projects, loading, onOpen, onMore, onImport, onBackup, onRefresh }) {
  const [q, setQ] = useState(''), [kind, setKind] = useState('all');
  const list = projects.filter((p) => (kind === 'all' || p.kind === kind) && p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const chip = (k, label) => (
    <Text key={k} onPress={() => setKind(k)} style={{ color: kind === k ? '#fff' : T.text, backgroundColor: kind === k ? T.accent : T.card, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, fontWeight: '700', overflow: 'hidden' }}>{label}</Text>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={T.sub} />} keyboardShouldPersistTaps="handled">
      <H1 T={T}>Projects</H1>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 14, paddingHorizontal: 12 }}>
        <Icon name="search" color={T.sub} size={18} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search your projects" placeholderTextColor={T.sub} style={{ flex: 1, minWidth: 0, color: T.text, paddingVertical: 12, fontSize: 15 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{chip('all', 'All')}{chip('2d', '2D')}{chip('3d', '3D')}{chip('app', 'Apps')}</View>
      {list.map((p) => <ProjectRow key={p.id} T={T} p={p} onOpen={onOpen} onMore={onMore} />)}
      {!list.length && !loading ? <Sub T={T} style={{ textAlign: 'center', paddingVertical: 30 }}>{projects.length ? 'Nothing matches.' : 'No projects yet: start one from Home.'}</Sub> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <View style={{ flex: 1 }}><Button T={T} icon="upload" label="Import" kind="ghost" small onPress={onImport} /></View>
        <View style={{ flex: 1 }}><Button T={T} icon="download" label="Back up all" kind="ghost" small onPress={onBackup} /></View>
      </View>
      <Sub T={T} style={{ fontSize: 12, textAlign: 'center' }}>{projects.length} project{projects.length === 1 ? '' : 's'} on this phone. A backup file brings them all back on another phone.</Sub>
    </ScrollView>
  );
}
