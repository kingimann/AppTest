// The Inspector's rows: a label and a control for numbers, text, yes / no, choices, colours and code.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Tap } from '../ui';

export function Row({ T, label, children, wide }) {
  return (
    <View style={{ flexDirection: wide ? 'column' : 'row', alignItems: wide ? 'stretch' : 'center', gap: wide ? 6 : 10, paddingVertical: 6 }}>
      <Text numberOfLines={wide ? 2 : 1} style={{ color: T.sub, fontSize: 13, fontWeight: '600', width: wide ? undefined : 118 }}>{label}</Text>
      <View style={{ flex: wide ? undefined : 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
const box = (T) => ({ color: T.text, backgroundColor: T.card2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, minWidth: 0 });

/** Text that's saved when you finish typing (not on every letter). */
export function TextField({ T, value, onChange, multiline, placeholder, mono }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  return <TextInput value={String(v)} onChangeText={setV} onEndEditing={() => v !== (value ?? '') && onChange(v)} onBlur={() => v !== (value ?? '') && onChange(v)} multiline={multiline} placeholder={placeholder} placeholderTextColor={T.sub}
    autoCapitalize="none" autoCorrect={false} style={[box(T), multiline && { minHeight: 90, textAlignVertical: 'top' }, mono && { fontFamily: 'Menlo', fontSize: 12.5 }]} />;
}

/** A number: type it, or nudge it with − / +. */
export function NumberField({ T, value, onChange, step = 1 }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => setV(value == null ? '' : String(value)), [value]);
  const commit = (s) => { const n = parseFloat(s); if (!isNaN(n) && n !== value) onChange(Math.round(n * 1000) / 1000); else setV(value == null ? '' : String(value)); };
  const nudge = (d) => onChange(Math.round(((+value || 0) + d) * 1000) / 1000);
  const btn = (t, d) => <Tap label={d < 0 ? 'Less' : 'More'} onPress={() => nudge(d)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.card2, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: T.text, fontSize: 18, fontWeight: '800' }}>{t}</Text></Tap>;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {btn('−', -step)}
      <TextInput value={v} onChangeText={setV} onEndEditing={() => commit(v)} onBlur={() => commit(v)} keyboardType="numbers-and-punctuation" selectTextOnFocus style={[box(T), { flex: 1, textAlign: 'center' }]} />
      {btn('+', step)}
    </View>
  );
}

export function BoolField({ T, value, onChange }) {
  return <View style={{ alignItems: 'flex-end' }}><Switch value={!!value} onValueChange={onChange} trackColor={{ true: T.accent, false: T.line }} /></View>;
}

/** A choice from a list (a sheet with the options). */
export function SelectField({ T, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tap label={String(value ?? '')} onPress={() => setOpen(true)} style={[box(T), { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text numberOfLines={1} style={{ color: T.text, fontSize: 14, flex: 1 }}>{String(value ?? '—')}</Text><Text style={{ color: T.sub }}>▾</Text>
      </Tap>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: T.card, borderRadius: 18, maxHeight: '70%', overflow: 'hidden' }}>
            <ScrollView>{options.map((o) => (
              <Tap key={String(o)} label={String(o)} onPress={() => { setOpen(false); onChange(o); }} style={{ paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: o === value ? T.accent + '22' : 'transparent' }}>
                <Text style={{ color: o === value ? T.accent : T.text, fontSize: 15, fontWeight: o === value ? '800' : '500' }}>{String(o)}</Text>
              </Tap>))}</ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const SWATCHES = ['#ffffff', '#000000', '#e8453c', '#f7a02c', '#f5e14b', '#8bd347', '#26a69a', '#4fc3f7', '#4c8bd6', '#7e57c2', '#ec407a', '#8d6e63', '#9e9e9e', '#12141f', '@accent', '@text', '@card', '@bg'];
/** A colour: a swatch, the hex code, and ready colours (and the app's theme colours, @accent…). */
export function ColorField({ T, value, onChange }) {
  const [open, setOpen] = useState(false), shown = /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : /^rgba?\(/.test(String(value || '')) ? value : T.card2;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Tap label="Pick a colour" onPress={() => setOpen(true)} style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: shown, borderWidth: 1, borderColor: T.line }} />
        <View style={{ flex: 1 }}><TextField T={T} value={value ?? ''} onChange={onChange} placeholder="#rrggbb" /></View>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: T.card, borderRadius: 18, padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {SWATCHES.map((c) => (
              <Tap key={c} label={c} onPress={() => { setOpen(false); onChange(c); }} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.startsWith('@') ? T.card2 : c, borderWidth: 2, borderColor: c === value ? T.accent : T.line, alignItems: 'center', justifyContent: 'center' }}>
                {c.startsWith('@') ? <Text style={{ color: T.text, fontSize: 11, fontWeight: '700' }}>{c}</Text> : null}
              </Tap>))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** One component setting, by its type (number, text, bool, select, color, code…). */
export function ParamField({ T, p, value, onChange }) {
  const v = value === undefined ? p.default : value;
  if (p.type === 'bool') return <Row T={T} label={p.label}><BoolField T={T} value={v} onChange={onChange} /></Row>;
  if ((p.type === 'number' || p.type === 'range')) return <Row T={T} label={p.label}><NumberField T={T} value={v} onChange={onChange} step={p.step || (Math.abs(+v || 0) >= 20 ? 10 : 1)} /></Row>;
  if (p.type === 'select' && p.options?.length) return <Row T={T} label={p.label}><SelectField T={T} value={v} options={p.options} onChange={onChange} /></Row>;
  if (p.type === 'color') return <Row T={T} label={p.label}><ColorField T={T} value={v} onChange={onChange} /></Row>;
  if (p.type === 'code' || p.type === 'json') return <Row T={T} label={p.label} wide><TextField T={T} value={typeof v === 'string' ? v : JSON.stringify(v ?? '', null, 1)} onChange={(t) => { if (p.type === 'json') { try { onChange(JSON.parse(t)); } catch { onChange(t); } } else onChange(t); }} multiline mono /></Row>;
  if (p.type === 'text' || p.type === 'template' || p.type === 'image' || p.type === 'choice') return <Row T={T} label={p.label}><TextField T={T} value={v} onChange={onChange} /></Row>;
  return <Row T={T} label={p.label}><Text style={{ color: T.sub, fontSize: 13 }}>Edit in the full editor ({p.type})</Text></Row>;
}
