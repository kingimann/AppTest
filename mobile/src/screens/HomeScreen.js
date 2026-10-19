// Home: carry on with your last project, start a new game or app from a template, and your recent projects.
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon } from '../icons';
import { Button, Card, H1, H2, Sub, Tap } from '../ui';
import { KIND, ago } from '../theme';

const greet = () => { const h = new Date().getHours(); return h < 5 ? 'Up late? Let’s make something.' : h < 12 ? 'Good morning! Let’s make something.' : h < 18 ? 'Good afternoon! Let’s make something.' : 'Good evening! Let’s make something.'; };

export function ProjectRow({ T, p, onOpen, onMore }) {
  const [label, color] = KIND[p.kind] || KIND['2d'];
  return (
    <Tap label={p.name} onPress={() => onOpen(p)} onLongPress={onMore ? () => onMore(p) : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 12 }}>
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + '33', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={p.kind === 'app' ? 'grid' : p.kind === '3d' ? 'gem' : 'gamepad'} color={color} size={26} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: T.text, fontWeight: '800', fontSize: 16 }}>{p.name}</Text>
        <Text numberOfLines={1} style={{ color: T.sub, fontSize: 13 }}>{label} · {p.kind === 'app' ? `${p.pages} page${p.pages === 1 ? '' : 's'}` : `${p.objects} objects`} · {ago(p.updated)}</Text>
      </View>
      {onMore ? <Tap label="More" onPress={() => onMore(p)} style={{ padding: 8 }}><Icon name="more" color={T.sub} size={22} /></Tap> : <Icon name="next" color={T.sub} size={18} />}
    </Tap>
  );
}

function TemplateCard({ T, t, onPick }) {
  const [label, color] = KIND[t.kind] || KIND['2d'];
  return (
    <Tap label={t.name} onPress={() => onPick(t)} style={{ width: 140, backgroundColor: T.card, borderRadius: 16, padding: 12, gap: 8 }}>
      <View style={{ height: 70, borderRadius: 12, backgroundColor: color + '2a', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={t.kind === 'app' ? 'grid' : t.kind === '3d' ? 'gem' : t.key.startsWith('empty') ? 'plus' : 'gamepad'} color={color} size={30} />
      </View>
      <Text numberOfLines={1} style={{ color: T.text, fontWeight: '800' }}>{t.name}</Text>
      <Text style={{ color: T.sub, fontSize: 12 }}>{label}</Text>
    </Tap>
  );
}

export default function HomeScreen({ T, projects, templates, loading, error, onOpen, onNew, onMore, onAll, onRetry }) {
  const last = projects[0];
  const groups = [['Games in 2D', templates.filter((t) => t.kind === '2d')], ['Games in 3D', templates.filter((t) => t.kind === '3d')], ['Apps', templates.filter((t) => t.kind === 'app')]];
  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: 110 }}>
      <View style={{ gap: 4, marginTop: 6 }}>
        <H1 T={T}>Pocket Engine</H1>
        <Sub T={T}>{greet()}</Sub>
      </View>
      {error ? <Card T={T} style={{ gap: 10 }}><Text style={{ color: T.danger, fontWeight: '800' }}>Can’t reach the editor</Text><Sub T={T}>{error}</Sub><Button T={T} icon="refresh" label="Try again" small onPress={onRetry} /></Card> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Button T={T} icon="gamepad" label="New game" onPress={() => onNew(templates.find((t) => t.key === 'empty-2d') || { key: 'empty-2d', name: 'New Game' })} /></View>
        <View style={{ flex: 1 }}><Button T={T} icon="grid" label="New app" kind="ghost" onPress={() => onNew(templates.find((t) => t.key === 'app-blank') || { key: 'app-blank', name: 'My App' })} /></View>
      </View>
      {last ? (
        <>
          <H2 T={T}>Carry on</H2>
          <Tap label={'Open ' + last.name} onPress={() => onOpen(last)} style={{ backgroundColor: T.accent, borderRadius: 20, padding: 18, gap: 6 }}>
            <Text style={{ color: '#ffffffcc', fontSize: 13, fontWeight: '700' }}>{(KIND[last.kind] || KIND['2d'])[0]} · {ago(last.updated)}</Text>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{last.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}><Icon name="play" color="#fff" size={16} /><Text style={{ color: '#fff', fontWeight: '800' }}>Open in the editor</Text></View>
          </Tap>
        </>
      ) : null}
      {groups.map(([title, list]) => list.length ? (
        <View key={title} style={{ gap: 10 }}>
          <H2 T={T}>{title}</H2>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>{list.map((t) => <TemplateCard key={t.key} T={T} t={t} onPick={onNew} />)}</ScrollView>
        </View>
      ) : null)}
      {projects.length > 1 ? (
        <>
          <H2 T={T} right={<Tap label="All projects" onPress={onAll}><Text style={{ color: T.accent, fontWeight: '800' }}>See all</Text></Tap>}>Recent</H2>
          {projects.slice(1, 5).map((p) => <ProjectRow key={p.id} T={T} p={p} onOpen={onOpen} onMore={onMore} />)}
        </>
      ) : null}
      {loading && !projects.length ? <Sub T={T} style={{ textAlign: 'center' }}>Loading your projects…</Sub> : null}
    </ScrollView>
  );
}
