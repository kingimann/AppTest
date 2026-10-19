// The native editor's panels: Hierarchy (the level's objects), Inspector (the selected object's settings and components),
// Add (ready-made objects) and Console (messages from the game).
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '../icons';
import { Tap } from '../ui';
import { BoolField, ColorField, NumberField, ParamField, Row, SelectField, TextField } from './fields';

const SHAPES = ['rect', 'capsule', 'circle', 'ellipse', 'squircle', 'cut', 'slanted', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'bubble', 'ticket', 'tag', 'ribbon', 'chevron', 'bookmark', 'shield', 'wave', 'ring', 'star', 'burst', 'scallop', 'heart', 'blob', 'cloud', 'drop', 'leaf', 'bolt', 'moon', 'cross', 'arrow', 'emoji'];
const GEOMETRIES = ['box', 'sphere', 'cylinder', 'cone', 'plane', 'capsule', 'pyramid', 'wedge', 'prism', 'gem', 'dome', 'torus'];
const iconOf = (e) => (e.ui ? 'grid' : e.mesh || e.model ? 'gem' : e.text ? 'edit' : (e.behaviors || []).some((b) => b.type === 'camera') ? 'search' : e.sun || e.globalLight ? 'sun' : 'layers');

const Section = ({ T, title, right, children }) => (
  <View style={{ backgroundColor: T.card, borderRadius: 16, padding: 12, gap: 2 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
      <Text style={{ color: T.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{title}</Text>{right}
    </View>
    {children}
  </View>
);
const Small = ({ T, icon, label, a11y, onPress, danger }) => (
  <Tap label={a11y || label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: T.card2 }}>
    {icon ? <Icon name={icon} color={danger ? T.danger : T.text} size={15} /> : null}<Text style={{ color: danger ? T.danger : T.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
  </Tap>
);

// ---------- Hierarchy ----------
export function Hierarchy({ T, level, sel, onSelect, onToggle, onMore }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const E = level?.entities || [], kids = new Map();
    for (const e of E) { const k = e.parent || ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(e); }
    const out = [], walk = (pid, d) => { for (const e of kids.get(pid) || []) { out.push({ e, d }); walk(e.id, d + 1); } };
    walk('', 0); for (const e of E) if (e.parent && !E.some((x) => x.id === e.parent)) out.push({ e, d: 0 }); // (a lost parent: show it anyway)
    return out;
  }, [level]);
  const shown = q.trim() ? rows.filter(({ e }) => (e.name || '').toLowerCase().includes(q.trim().toLowerCase())) : rows;
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 10 }}>
        <Icon name="search" color={T.sub} size={16} />
        <TextInput value={q} onChangeText={setQ} placeholder={`Search ${rows.length} objects`} placeholderTextColor={T.sub} style={{ flex: 1, minWidth: 0, color: T.text, paddingVertical: 9 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {shown.map(({ e, d }) => (
          <Tap key={e.id} label={e.name} onPress={() => onSelect(e.id)} onLongPress={() => onMore(e.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingRight: 6, paddingLeft: 8 + d * 18, borderRadius: 10, backgroundColor: e.id === sel ? T.accent + '33' : 'transparent' }}>
            <Icon name={iconOf(e)} color={e.id === sel ? T.accent : T.sub} size={17} />
            <Text numberOfLines={1} style={{ flex: 1, color: e.visible === false ? T.sub : T.text, fontSize: 15, fontWeight: e.id === sel ? '800' : '500' }}>{e.name || 'Object'}</Text>
            {e.ui ? <Text style={{ color: T.sub, fontSize: 11, fontWeight: '700' }}>UI</Text> : null}
            <Tap label={e.visible === false ? 'Show' : 'Hide'} onPress={() => onToggle(e.id)} style={{ padding: 4 }}><Text style={{ color: e.visible === false ? T.sub : T.text, fontSize: 13 }}>{e.visible === false ? '◌' : '●'}</Text></Tap>
          </Tap>
        ))}
        {!shown.length ? <Text style={{ color: T.sub, textAlign: 'center', padding: 20 }}>{rows.length ? 'Nothing matches.' : 'No objects yet: tap Add.'}</Text> : null}
      </ScrollView>
    </View>
  );
}

// ---------- Inspector ----------
function AddComponent({ T, schemas, open, onClose, onAdd }) {
  const [q, setQ] = useState(''), [cat, setCat] = useState(null);
  const all = Object.entries(schemas?.behaviors || {}).map(([type, s]) => ({ type, ...s }));
  const cats = [...new Set(all.map((c) => c.category))].sort((a, b) => ((schemas?.categories || []).indexOf(a) + 1 || 99) - ((schemas?.categories || []).indexOf(b) + 1 || 99));
  const list = q.trim() ? all.filter((c) => (c.label + ' ' + c.description).toLowerCase().includes(q.trim().toLowerCase())) : cat ? all.filter((c) => c.category === cat) : [];
  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: T.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, height: '82%', padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {cat && !q ? <Tap label="Back" onPress={() => setCat(null)} style={{ padding: 6 }}><Icon name="back" color={T.accent} size={20} /></Tap> : null}
            <Text style={{ color: T.text, fontSize: 18, fontWeight: '900', flex: 1 }}>{cat && !q ? cat : 'Add Component'}</Text>
            <Tap label="Close" onPress={onClose} style={{ padding: 6 }}><Icon name="close" color={T.sub} size={20} /></Tap>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 10 }}>
            <Icon name="search" color={T.sub} size={16} />
            <TextInput value={q} onChangeText={setQ} placeholder={`Search ${all.length} components`} placeholderTextColor={T.sub} style={{ flex: 1, minWidth: 0, color: T.text, paddingVertical: 10 }} />
          </View>
          <ScrollView contentContainerStyle={{ gap: 6, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {!q && !cat ? cats.map((c) => (
              <Tap key={c} label={c} onPress={() => setCat(c)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 12, padding: 14 }}>
                <Text style={{ color: T.text, fontWeight: '700', flex: 1 }}>{c}</Text><Text style={{ color: T.sub }}>{all.filter((x) => x.category === c).length}  ›</Text>
              </Tap>))
              : list.map((c) => (
                <Tap key={c.type} label={c.label} onPress={() => { onAdd(c); onClose(); setQ(''); setCat(null); }} style={{ backgroundColor: T.card, borderRadius: 12, padding: 12, gap: 2 }}>
                  <Text style={{ color: T.text, fontWeight: '800' }}>{c.label}</Text>
                  <Text numberOfLines={2} style={{ color: T.sub, fontSize: 13 }}>{c.description}</Text>
                </Tap>))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ComponentCard({ T, b, i, schema, onSet, onRemove }) {
  const [open, setOpen] = useState(i < 2);
  const params = schema?.params || [], groups = [...new Set(params.map((p) => p.group || ''))];
  return (
    <View style={{ backgroundColor: T.card, borderRadius: 16, overflow: 'hidden' }}>
      <Tap label={schema?.label || b.type} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
        <Text style={{ color: T.sub, fontSize: 12 }}>{open ? '▾' : '▸'}</Text>
        <Text style={{ color: T.text, fontWeight: '800', fontSize: 15, flex: 1 }}>{schema?.label || b.type}</Text>
        <Tap label="Remove component" onPress={onRemove} style={{ padding: 4 }}><Icon name="trash" color={T.sub} size={17} /></Tap>
      </Tap>
      {open ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
          {!schema ? <Text style={{ color: T.sub }}>Unknown component “{b.type}”.</Text> : null}
          {groups.map((g) => (
            <View key={g || '_'}>
              {g ? <Text style={{ color: T.accent, fontSize: 12, fontWeight: '800', marginTop: 8, textTransform: 'uppercase' }}>{g}</Text> : null}
              {params.filter((p) => (p.group || '') === g).map((p) => <ParamField key={p.key} T={T} p={p} value={(b.params || b)[p.key]} onChange={(v) => onSet(p.key, v)} />)}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Inspector({ T, game, level, e, three, schemas, onChange, onGame, onDuplicate, onDelete, onFrame }) {
  const [adding, setAdding] = useState(false);
  if (!e) { // nothing selected: the project and the level
    return (
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Section T={T} title="Project">
          <Row T={T} label="Name"><TextField T={T} value={game?.name} onChange={(v) => onGame((g) => { g.name = v; })} /></Row>
          <Row T={T} label="Background"><ColorField T={T} value={level?.background} onChange={(v) => onGame((g, lv) => { lv.background = v; })} /></Row>
          {!three ? <Row T={T} label="Screen width"><NumberField T={T} value={level?.view?.width ?? 400} step={10} onChange={(v) => onGame((g, lv) => { lv.view = { ...(lv.view || { height: 700 }), width: v }; })} /></Row> : null}
          {!three ? <Row T={T} label="Screen height"><NumberField T={T} value={level?.view?.height ?? 700} step={10} onChange={(v) => onGame((g, lv) => { lv.view = { ...(lv.view || { width: 400 }), height: v }; })} /></Row> : null}
        </Section>
        <Text style={{ color: T.sub, textAlign: 'center', padding: 10 }}>Tap an object in the scene or the Hierarchy to edit it.</Text>
      </ScrollView>
    );
  }
  const set = (fn) => onChange(e.id, fn);
  const num = (label, k, step = three ? 0.5 : 10, def = 0) => <Row key={k} T={T} label={label}><NumberField T={T} value={e[k] ?? def} step={step} onChange={(v) => set((x) => { x[k] = v; })} /></Row>;
  const sh = e.shape, m = e.mesh, tx = e.text;
  return (
    <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={{ backgroundColor: T.card, borderRadius: 16, padding: 12, gap: 8 }}>
        <TextField T={T} value={e.name} onChange={(v) => set((x) => { x.name = v; })} />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Small T={T} icon="search" label="Find" onPress={onFrame} />
          <Small T={T} icon="copy" label="Duplicate" onPress={onDuplicate} />
          <Small T={T} icon="trash" label="Delete" danger onPress={onDelete} />
        </View>
        <Row T={T} label="Visible"><BoolField T={T} value={e.visible !== false} onChange={(v) => set((x) => { if (v) delete x.visible; else x.visible = false; })} /></Row>
        <Row T={T} label="Tags"><TextField T={T} value={(e.tags || []).join(', ')} placeholder="player, enemy" onChange={(v) => set((x) => { x.tags = v.split(',').map((t) => t.trim()).filter(Boolean); })} /></Row>
      </View>
      <Section T={T} title={e.ui ? 'Rect (screen)' : 'Transform'}>
        {num('X', 'x')}{num('Y', 'y')}{three && !e.ui ? num('Z', 'z') : null}
        {three && !e.ui ? <>{num('Rotation X', 'rx', 15)}{num('Rotation Y', 'ry', 15)}{num('Rotation Z', 'rz', 15)}</> : num('Rotation', 'rz', 15)}
        {num('Scale X', 'sx', 0.1, 1)}{num('Scale Y', 'sy', 0.1, 1)}{three && !e.ui ? num('Scale Z', 'sz', 0.1, 1) : null}
        {e.ui ? <Row T={T} label="Anchor"><SelectField T={T} value={e.anchor || 'center'} options={['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']} onChange={(v) => set((x) => { x.anchor = v; })} /></Row> : null}
      </Section>
      {sh ? (
        <Section T={T} title="Shape">
          <Row T={T} label="Type"><SelectField T={T} value={sh.type} options={SHAPES} onChange={(v) => set((x) => { x.shape.type = v; if (v === 'circle' && !x.shape.r) x.shape.r = Math.round((x.shape.w || 40) / 2); })} /></Row>
          {sh.type === 'emoji' ? <Row T={T} label="Emoji"><TextField T={T} value={sh.emoji} onChange={(v) => set((x) => { x.shape.emoji = v; })} /></Row> : null}
          {sh.type === 'circle' ? <Row T={T} label="Radius"><NumberField T={T} value={sh.r ?? 20} step={2} onChange={(v) => set((x) => { x.shape.r = v; })} /></Row>
            : <><Row T={T} label="Width"><NumberField T={T} value={sh.w ?? 40} step={5} onChange={(v) => set((x) => { x.shape.w = v; })} /></Row><Row T={T} label="Height"><NumberField T={T} value={sh.h ?? 40} step={5} onChange={(v) => set((x) => { x.shape.h = v; })} /></Row></>}
          {sh.type === 'rect' ? <Row T={T} label="Corners"><NumberField T={T} value={sh.radius ?? 0} step={2} onChange={(v) => set((x) => { x.shape.radius = v; })} /></Row> : null}
          <Row T={T} label="Fill"><ColorField T={T} value={sh.fill} onChange={(v) => set((x) => { x.shape.fill = v; })} /></Row>
          <Row T={T} label="Outline"><ColorField T={T} value={sh.stroke} onChange={(v) => set((x) => { x.shape.stroke = v; x.shape.lineWidth ||= 2; })} /></Row>
        </Section>
      ) : null}
      {m ? (
        <Section T={T} title="Mesh">
          <Row T={T} label="Shape"><SelectField T={T} value={m.geometry} options={GEOMETRIES} onChange={(v) => set((x) => { x.mesh.geometry = v; })} /></Row>
          <Row T={T} label="Colour"><ColorField T={T} value={m.color} onChange={(v) => set((x) => { x.mesh.color = v; })} /></Row>
          {['w', 'h', 'd'].map((k) => <Row key={k} T={T} label={{ w: 'Width', h: 'Height', d: 'Depth' }[k]}><NumberField T={T} value={m[k] ?? 1} step={0.5} onChange={(v) => set((x) => { x.mesh[k] = v; })} /></Row>)}
        </Section>
      ) : null}
      {tx ? (
        <Section T={T} title="Text">
          <Row T={T} label="Text" wide><TextField T={T} value={tx.value} multiline onChange={(v) => set((x) => { x.text.value = v; })} /></Row>
          <Row T={T} label="Size"><NumberField T={T} value={tx.size ?? 16} step={2} onChange={(v) => set((x) => { x.text.size = v; })} /></Row>
          <Row T={T} label="Colour"><ColorField T={T} value={tx.color} onChange={(v) => set((x) => { x.text.color = v; })} /></Row>
          <Row T={T} label="Align"><SelectField T={T} value={tx.align || 'center'} options={['left', 'center', 'right']} onChange={(v) => set((x) => { x.text.align = v; })} /></Row>
        </Section>
      ) : null}
      {!e.ui ? (
        <Section T={T} title="Physics" right={e.body ? <Small T={T} label="Remove" onPress={() => set((x) => { delete x.body; })} /> : <Small T={T} icon="plus" label="Add" a11y="Add physics" onPress={() => set((x) => { x.body = { type: 'dynamic' }; })} />}>
          {e.body ? <Row T={T} label="Body"><SelectField T={T} value={e.body.type || 'dynamic'} options={['dynamic', 'static', 'kinematic']} onChange={(v) => set((x) => { x.body.type = v; })} /></Row> : <Text style={{ color: T.sub, fontSize: 13 }}>No physics: it doesn't fall or collide.</Text>}
        </Section>
      ) : null}
      {(e.behaviors || []).map((b, i) => (
        <ComponentCard key={i + b.type} T={T} b={b} i={i} schema={schemas?.behaviors?.[b.type]}
          onSet={(k, v) => set((x) => { const t = x.behaviors[i]; if (t.params) t.params[k] = v; else t[k] = v; })}
          onRemove={() => set((x) => { x.behaviors.splice(i, 1); })} />
      ))}
      <Tap label="Add Component" onPress={() => setAdding(true)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.accent, borderRadius: 16, padding: 14 }}>
        <Icon name="plus" color={T.accent} size={18} /><Text style={{ color: T.accent, fontWeight: '800' }}>Add Component</Text>
      </Tap>
      <AddComponent T={T} schemas={schemas} open={adding} onClose={() => setAdding(false)}
        onAdd={(c) => set((x) => { const b = { type: c.type }; for (const p of c.params) if (p.default !== undefined) b[p.key] = p.default; (x.behaviors ||= []).push(b); })} />
    </ScrollView>
  );
}

// ---------- Add ----------
export function AddPanel({ T, presets, onAdd }) {
  const [q, setQ] = useState(''), [tab, setTab] = useState('prefabs');
  const src = tab === 'prefabs' ? presets?.prefabs || [] : presets?.objects || [];
  const list = src.filter((p) => !q.trim() || (p.label + ' ' + (p.desc || '') + ' ' + (p.group || '')).toLowerCase().includes(q.trim().toLowerCase()));
  const groups = [...new Set(list.map((p) => p.group || 'Objects'))];
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flexDirection: 'row', backgroundColor: T.card, borderRadius: 12, padding: 3 }}>
        {[['prefabs', 'Ready-made'], ['objects', 'Shapes & more']].map(([k, l]) => (
          <Tap key={k} label={l} onPress={() => setTab(k)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: tab === k ? T.accent : 'transparent' }}><Text style={{ color: tab === k ? '#fff' : T.text, fontWeight: '700' }}>{l}</Text></Tap>))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: T.card, borderRadius: 12, paddingHorizontal: 10 }}>
        <Icon name="search" color={T.sub} size={16} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={T.sub} style={{ flex: 1, minWidth: 0, color: T.text, paddingVertical: 9 }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {groups.map((g) => (
          <View key={g} style={{ gap: 6 }}>
            {tab === 'prefabs' ? <Text style={{ color: T.sub, fontSize: 12, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' }}>{g}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {list.filter((p) => (p.group || 'Objects') === g).map((p, i) => (
                <Tap key={p.label + i} label={'Add ' + p.label} onPress={() => onAdd(p)} style={{ width: '48.5%', backgroundColor: T.card, borderRadius: 12, padding: 10, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: T.text, fontWeight: '800' }}>{p.label}</Text>
                  {p.desc ? <Text numberOfLines={2} style={{ color: T.sub, fontSize: 12 }}>{p.desc}</Text> : null}
                </Tap>))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------- Console ----------
export function ConsolePanel({ T, logs, onClear }) {
  const C = { error: T.danger, warn: '#f5b301', info: T.text, log: T.text };
  return (
    <View style={{ flex: 1, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: T.sub, fontSize: 13 }}>{logs.length} message{logs.length === 1 ? '' : 's'}</Text>
        <Small T={T} icon="trash" label="Clear" onPress={onClear} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4, paddingBottom: 30 }}>
        {logs.map((l, i) => (
          <View key={i} style={{ backgroundColor: T.card, borderRadius: 10, padding: 9, borderLeftWidth: 3, borderLeftColor: C[l.level] || T.line }}>
            <Text style={{ color: C[l.level] || T.text, fontSize: 13 }}>{l.text}</Text>
            {l.source ? <Text style={{ color: T.sub, fontSize: 11 }}>{l.source}</Text> : null}
          </View>))}
        {!logs.length ? <Text style={{ color: T.sub, textAlign: 'center', padding: 20 }}>Messages from your game (and errors) show here when you press Play.</Text> : null}
      </ScrollView>
    </View>
  );
}
