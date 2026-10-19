// Pocket runtime for React Native (Expo): the app's state and its building blocks. Made by Pocket Engine's native export.
// App.js gives setupApp() the app (pages, tabs, data, App Bar, Bottom Nav, Side Menu); pages/ has one component per page.
// The rules are the same as the Flutter, Kotlin and SwiftUI runtimes (and the editor's native preview), so it looks and acts
// the same: pages and tabs, back, Data Lists, Forms, stats, {variables}, the social feed, chat, profiles and the Side Menu.
// It's a readable file: change anything you like.
import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, BackHandler, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView,
  StyleSheet, Switch, Text, TextInput, View, useColorScheme,
} from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ---------------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------------

/** A value as text: yes / no for true / false, whole numbers without .0. */
export const show = (v) => (v == null ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)) : String(v));
export const num = (v) => (typeof v === 'number' ? v : typeof v === 'boolean' ? +v : v == null || v === '' || isNaN(+v) ? null : +v);
export const isOn = (v) => v === true || v === 1 || v === 'yes' || v === 'true' || v === 'on';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const keyOf = (n) => String(n ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';

// ---------------------------------------------------------------------------------------------------------------
// The app's state: variables, data collections (saved on the phone), tabs and the pages opened on each
// ---------------------------------------------------------------------------------------------------------------

/** The app (set up once by App.js). */
export let app = null;

export function setupApp(model) {
  if (app) return app;
  const A = { model, vars: { ...model.vars }, data: {}, tab: 0, stacks: model.tabs.length ? model.tabs.map(() => []) : [[]], openCollection: null, openId: null, menuOpen: false, note: '' };
  const listeners = new Set();
  A.subscribe = (f) => { listeners.add(f); return () => listeners.delete(f); };
  let saveT = null;
  A.changed = () => { listeners.forEach((f) => f()); clearTimeout(saveT); saveT = setTimeout(() => A.save(), 400); };
  A.def = (name) => model.collections.find((c) => c.name === name);
  A.rows = (name) => A.data[name] || [];
  // starting rows: missing fields get their defaults; later rows count as newer (the same as the engine)
  const fieldDef = (f) => (f.def !== '' && f.def != null ? (f.type === 'yes/no' ? isOn(f.def) : ['number', 'money', 'rating'].includes(f.type) ? +f.def || 0 : f.def === 'today' && f.type === 'date' ? today() : f.def)
    : f.type === 'yes/no' ? false : f.type === 'date' ? today() : f.type === 'choice' ? f.options[0] || '' : ['number', 'money', 'rating'].includes(f.type) ? 0 : '');
  A.blank = (name) => Object.fromEntries((A.def(name)?.fields || []).map((f) => [f.key, fieldDef(f)]));
  for (const c of model.collections) A.data[c.name] = c.rows.map((r, i) => ({ ...A.blank(c.name), ...r, _id: 's' + i, _at: r._at ?? i }));
  A.opened = () => (A.openCollection && A.openId ? A.rows(A.openCollection).find((r) => r._id === A.openId) || null : null);
  /** How a value reads: dates as Today / Tomorrow / 3 Mar, money with $ (the engine's fieldText). */
  A.text = (coll, k, v) => {
    const f = A.def(coll)?.fields.find((x) => x.key === k); if (v == null || v === '') return '';
    if (f?.type === 'money') { const n = +v || 0; return (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(2).replace(/\.00$/, ''); }
    if (f?.type === 'date') {
      const k0 = String(v).slice(0, 10), d = new Date(k0 + 'T00:00'); if (isNaN(d)) return show(v);
      const day = (n) => { const x = new Date(Date.now() + n * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
      return k0 === day(0) ? 'Today' : k0 === day(-1) ? 'Yesterday' : k0 === day(1) ? 'Tomorrow' : d.toLocaleDateString('en', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
    }
    if (f?.type === 'yes/no') return isOn(v) ? '✓' : '';
    return show(v);
  };
  /** Text with {variables} (and {fields} of a record) filled in. */
  A.fill = (t, row, coll) => String(t ?? '').replace(/\{(\w+)\}/g, (m, k) => (row && k in row ? (coll ? A.text(coll, k, row[k]) : show(row[k]))
    : k.startsWith('record_') ? (A.openCollection ? A.text(A.openCollection, k.slice(7), A.opened()?.[k.slice(7)]) : '') : show(A.vars[k])));
  const passes = (r, filter) => {
    if (!String(filter).trim()) return true;
    for (const part of String(filter).split(/\s+and\s+/i)) {
      const m = /^\s*(\w[\w ]*?)\s*(!=|≠|>=|≥|<=|≤|=|>|<)\s*(.*?)\s*$/.exec(part); if (!m) continue;
      const v = r[m[1].toLowerCase().replace(/ /g, '_')], op = m[2], raw = m[3];
      if (/^(yes|no)$/i.test(raw)) { if ((op === '=') !== (isOn(v) === /^yes$/i.test(raw))) return false; continue; }
      const want = num(raw), a = num(v);
      if (want != null && a != null) { const ok = { '=': a === want, '!=': a !== want, '≠': a !== want, '>': a > want, '<': a < want, '>=': a >= want, '≥': a >= want }[op] ?? a <= want; if (!ok) return false; continue; }
      const same = show(v).toLowerCase() === raw.toLowerCase();
      if ((op === '=' && !same) || ((op === '!=' || op === '≠') && same)) return false;
    }
    return true;
  };
  /** Records that pass a filter (“done = no”), match a search, sorted (newest first, oldest first, a field). */
  A.query = (name, filter = '', search = '', sort = 'newest first') => {
    const fields = A.def(name)?.fields || [], q = String(search).trim().toLowerCase();
    let L = A.rows(name).filter((r) => passes(r, A.fill(filter)));
    if (q) L = L.filter((r) => fields.some((f) => ['text', 'long text', 'choice', 'icon'].includes(f.type) && show(r[f.key]).toLowerCase().includes(q)));
    const s = String(sort).toLowerCase();
    if (s === 'newest first') return L.sort((a, b) => (b._at || 0) - (a._at || 0));
    if (s === 'oldest first') return L.sort((a, b) => (a._at || 0) - (b._at || 0));
    const m = /^(.+?)(?:\s+\((a-z|z-a|low-high|high-low)\))?$/.exec(s), key = m?.[1].trim().replace(/[^a-z0-9]+/g, '_'), dir = /z-a|high-low/.test(m?.[2] || '') ? -1 : 1;
    return key ? L.sort((a, b) => { const x = num(a[key]), y = num(b[key]); return dir * (x != null && y != null ? x - y : show(a[key]).localeCompare(show(b[key]))); }) : L;
  };
  A.stat = (name, how, field, filter) => {
    const L = A.query(name, filter, '', 'oldest first'); if (how === 'count') return L.length;
    const ns = L.map((r) => num(r[field]) ?? 0); if (!ns.length) return 0;
    const sum = ns.reduce((a, b) => a + b, 0);
    return how === 'sum' ? Math.round(sum * 100) / 100 : how === 'average' ? Math.round(sum / ns.length * 100) / 100 : how === 'min' ? Math.min(...ns) : Math.max(...ns);
  };
  /** You: {playerName} and {playerHandle}; no name yet → “You”, @you (the same as the editor). */
  A.meName = () => show(A.vars.playerName) || 'You';
  A.me = () => show(A.vars.playerHandle) || A.meName().toLowerCase().replace(/\s+/g, '');
  /** The name on the App Bar's avatar: “Me” until there is a playerName variable, then the name (blank shows “?”). */
  A.barName = () => ('playerName' in A.vars ? show(A.vars.playerName) : 'Me');
  /** Stats, {posts_count}-style counts, and the social counts the engine keeps ({unread}, {notifications_unread}, {friend_requests}). */
  A.work = () => {
    const me = A.me(), mine = new Set(model.stats.map((s) => s.var));
    for (const c of model.collections) A.vars[keyOf(c.name) + '_count'] = A.rows(c.name).length;
    if (A.def('Notifications')) A.vars.notifications_unread = A.rows('Notifications').filter((r) => show(r.to) === me && !isOn(r.read)).length;
    if (A.def('Friends')) A.vars.friend_requests = A.rows('Friends').filter((r) => show(r.status) !== 'accepted' && show(r.to) === me).length;
    if (A.def('Messages') && !mine.has('unread')) {
      const read = {}; for (const r of A.rows('Reads')) if (show(r.handle) === me) read[r.chat] = +r.at || 0;
      A.vars.unread = A.rows('Messages').filter((r) => show(r.handle) !== me && (r._at || 0) > (read[r.chat] || 0)).length;
    }
    for (const s of model.stats) A.vars[s.var] = A.stat(s.collection, s.how, s.field, s.filter);
  };
  A.set = (k, v) => { A.vars[k] = v; A.work(); A.changed(); };
  A.add = (k, by) => A.set(k, (num(A.vars[k]) ?? 0) + by);
  A.addRecord = (name, values) => { (A.data[name] ||= []).push({ ...A.blank(name), ...values, _id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), _at: Date.now() }); A.work(); A.changed(); };
  A.updateRecord = (name, id, values) => { const r = A.rows(name).find((x) => x._id === id); if (r) Object.assign(r, values); A.work(); A.changed(); };
  A.deleteRecord = (name, id) => { A.data[name] = A.rows(name).filter((x) => x._id !== id); A.work(); A.changed(); };
  // ---- pages: each tab keeps its own stack of opened pages ----
  A.stack = () => A.stacks[Math.min(A.tab, A.stacks.length - 1)];
  A.page = () => { const st = A.stack(); return st.length ? st[st.length - 1].page : model.tabs.length ? model.tabs[A.tab].page : model.home; };
  A.go = (page) => {
    const i = model.tabs.findIndex((t) => t.page === page);
    if (i >= 0) A.tab = i, A.stacks[i] = [];
    else if (page === model.home && !model.tabs.length) A.stacks[0] = [];
    else if (model.pages.some((p) => p.value === page)) A.stack().push({ page, key: Date.now() + Math.random() });
    A.changed();
  };
  A.pickTab = (i) => { A.tab = i; A.changed(); };
  A.back = () => { A.stack().pop(); A.changed(); };
  /** What a button does (the same words as the button's Action in Pocket Engine). */
  A.run = (action, value, amount = 1) => {
    const v = show(value);
    switch (action) {
      case 'go to page': return A.go(v);
      case 'go back': return A.back();
      case 'set variable': return A.set(v, amount);
      case 'add to variable': return A.add(v, +amount || 0);
      case 'new record': A.openId = null; return A.go(v);
      case 'edit opened record': return A.go(v);
      case 'delete opened record': if (A.openCollection && A.openId) { A.deleteRecord(A.openCollection, A.openId); A.openId = null; } return A.back();
      case 'message': return A.send(v);
      default: console.log(`TODO: the "${action}" action (${v}) has no native version yet`);
    }
  };
  // ---- messages: a button's "message" action, App Bar buttons, Side Menu rows → everything listening (popups, timers, swipe pages, notifications) ----
  const hearers = new Set();
  A.toasts = [];
  /** Hear the app's messages; call what it returns to stop. */
  A.listen = (f) => { hearers.add(f); return () => hearers.delete(f); };
  A.send = (message) => {
    const m = A.fill(message).trim(); if (!m) return;
    hearers.forEach((f) => f(m));
    const n = model.notify;
    if (n && (m === n.listen || m.startsWith(n.listen + ' '))) {
      const [title = '', text = '', icon = ''] = m.slice(n.listen.length).trim().split('|').map((t) => t.trim()), t = { title, text, icon: icon || (n.look === 'achievement' ? '🏆' : ''), key: Math.random() };
      A.toasts = [...A.toasts, t].slice(-n.max); A.changed();
      setTimeout(() => { A.toasts = A.toasts.filter((q) => q !== t); A.changed(); }, n.seconds * 1000);
    }
  };
  A.openMenu = (open) => { A.menuOpen = open; A.changed(); };
  A.menuOn = () => !!model.menu && model.bar?.left !== 'none' && model.bar?.left !== 'back';
  // ---- saved on the phone ----
  const KEY = 'pocket.' + keyOf(model.name);
  A.save = () => { AsyncStorage.setItem(KEY, JSON.stringify({ vars: A.vars, data: A.data })).catch(() => {}); };
  A.load = async () => {
    try { const s = JSON.parse(await AsyncStorage.getItem(KEY) || 'null'); if (s) { Object.assign(A.vars, s.vars || {}); for (const [k, v] of Object.entries(s.data || {})) if (A.def(k) && Array.isArray(v)) A.data[k] = v; } } catch { /* nothing saved yet */ }
    A.work(); listeners.forEach((f) => f());
  };
  A.work();
  app = A;
  return A;
}

/** Re-draws a component when the app changes. */
export function useApp() {
  const [, tick] = useReducer((n) => n + 1, 0);
  useEffect(() => app.subscribe(tick), []);
  return app;
}

// ---------------------------------------------------------------------------------------------------------------
// Colours (the app's @tokens) for light and dark
// ---------------------------------------------------------------------------------------------------------------

/** Light or dark: the darkMode variable when it's set, else the theme (light, dark, follow the phone). */
export function usePal() {
  const scheme = useColorScheme(), d = app.vars.darkMode, m = app.model;
  const dark = d !== undefined && d !== '' && d !== null ? [true, 1, '1', 'on', 'yes', 'dark'].includes(d) : m.theme === 'dark' ? true : m.theme === 'light' ? false : scheme === 'dark';
  return { ...(dark ? m.dark : m.light), dark };
}
/** "@accent" → the palette's colour, "#ff0000" → itself. */
export const col = (c, P) => { if (!c) return null; const t = /^@(\w+)$/.exec(c); return t ? P[t[1]] || null : /^#[0-9a-f]{3,8}$/i.test(c) || /^rgba?\(/.test(c) ? c : null; };
const alpha = (hex, a) => { const h = String(hex || '#000000').replace('#', ''); const f = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6); return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`; };

// ---------------------------------------------------------------------------------------------------------------
// Icons: the editor's own line icons (64 × 64, set by App.js) and a few small ones for the feed (24 × 24)
// ---------------------------------------------------------------------------------------------------------------

const SMALL = {
  comment: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z', repost: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  heart: 'M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z', views: 'M5 20V10M10 20V4M15 20v-7M20 20v-4', bookmark: 'M6 3h12v18l-6-4-6 4z',
  share: 'M12 3v13M7 8l5-5 5 5M5 14v6h14v-6', more: 'M5 12h.01M12 12h.01M19 12h.01', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17l-5-5',
  check2: 'M5 12l5 5L20 7', back: 'M15 18l-6-6 6-6', close: 'M6 6l12 12M18 6L6 18', circle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', plus: 'M12 5v14M5 12h14',
};
/** An icon by its Pocket Engine name, in a colour. */
export function Icon({ name, color = '#000', size = 24, filled = false, width }) {
  const art = app?.model.art?.[name];
  if (art) return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d={art[0]} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {art[1] ? <Path d={art[1]} fill={color} /> : null}
    </Svg>
  );
  if (!SMALL[name] && name && !/^[a-z][a-z-]*$/.test(name)) return <Text style={{ fontSize: size * 0.85, color }}>{name}</Text>; // (an emoji)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SMALL[name] || SMALL.circle} fill={filled ? color : 'none'} stroke={color} strokeWidth={width || 2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// the engine's avatar colours and initials (Maya Chen → MC)
const AV = ['#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0', '#42a5f5', '#26a69a', '#66bb6a', '#ffa726', '#8d6e63'];
export const avColor = (s) => { let n = 0; for (const ch of String(s || '?')) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return AV[n % AV.length]; };
const initials = (s) => String(s || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0].toUpperCase()).join('') || '?';
/** A round picture with initials in the person's colour. */
export function Avatar({ name, seed, size = 40, label, ring }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avColor(name || seed), alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...(ring ? { borderWidth: 2, borderColor: ring } : null) }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: Math.round(size * (label ? 0.5 : 0.38)) }}>{label || initials(name || seed)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The app shell: the App Bar, the pages (a stack on each tab), the Bottom Nav and the Side Menu
// ---------------------------------------------------------------------------------------------------------------

const FLOATING = ['floating', 'glass', 'segmented', 'dock'], PILL = ['pill', 'floating', 'glass', 'bubble', 'classic'], SOLID = ['segmented', 'chips'];

export function PocketApp({ pages }) {
  useApp();
  const [ready, setReady] = useState(false);
  useEffect(() => { app.load().then(() => setReady(true)); }, []);
  useEffect(() => { // Android's Back: closes the menu, then the page
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (app.menuOpen) { app.openMenu(false); return true; } if (app.stack().length) { app.back(); return true; } return false; });
    return () => sub.remove();
  }, []);
  const P = usePal();
  if (!ready) return <View style={{ flex: 1, backgroundColor: P.bg }} />;
  const m = app.model, stack = app.stack(), entry = stack[stack.length - 1];
  const pageName = app.page(), Page = pages[pageName] || pages[m.home];
  return (
    <SafeAreaProvider>
      <StatusBar style={P.dark ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: P.bg }}>
        <Page key={entry ? entry.key : 'tab' + app.tab} />
        {m.tabs.length && !stack.length ? <TabBar P={P} /> : null}
        {app.menuOpen && m.menu ? <SideMenu P={P} /> : null}
        {m.notify && app.toasts.length ? <ToastLayer P={P} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

/** A page: the App Bar with its title, then what's on it (a list or form fills the rest). */
export function PocketPage({ title, page, appBar = true, scroll = true, fab, children }) {
  useApp();
  const P = usePal(), inset = useSafeAreaInsets(), m = app.model, tabsShown = m.tabs.length && !app.stack().length;
  const body = React.Children.toArray(children);
  return (
    <View style={{ flex: 1, paddingTop: appBar && m.appBar ? 0 : inset.top }}>
      {appBar && m.appBar ? <AppBar title={title} page={page} P={P} /> : null}
      {scroll
        ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: tabsShown ? 110 : 40, gap: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{body}</ScrollView>
        : <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: tabsShown ? 96 : 12, gap: 12 }}>{body}</KeyboardAvoidingView>}
      {fab ? (
        <Pressable accessibilityLabel="Add" onPress={() => app.run(fab.action, fab.value, fab.amount)} style={[S.fab, { backgroundColor: P.accent, bottom: tabsShown ? 104 : 24 + inset.bottom }]}>
          <Icon name="plus" color={P.onAccent} size={28} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The project's App Bar: its look (x: your avatar and the app's name), title, buttons (plain or in circles) with badges, colours. */
function AppBar({ title, page, P }) {
  const B = app.model.bar, inset = useSafeAreaInsets(), back = app.stack().length > 0;
  const brand = B.look !== 'standard' && !back && (!B.brandPages.length || B.brandPages.includes(page));
  const fg = col(B.text, P) || P.text, ic = col(B.icon, P) || P.text, center = B.align === 'center';
  const acts = B.actions.filter((a) => !a.only.length || a.only.includes(page)).reverse(); // (the first sits at the right edge)
  const tap = (a) => { if (/dark mode/.test(a.does)) app.set('darkMode', !P.dark); else if (a.does.startsWith('page:')) app.go(a.does.slice(5)); else app.send(a.does); };
  const left = back
    ? <Pressable accessibilityLabel="Back" onPress={() => app.back()} style={S.barBtn}><Icon name="back" color={ic} size={26} /></Pressable>
    : B.avatar ? <Pressable accessibilityLabel="Menu" onPress={() => app.menuOn() && app.openMenu(true)} style={{ paddingHorizontal: 4 }}><Avatar name={app.barName() || '?'} size={32} /></Pressable>
    : app.menuOn() ? <Pressable accessibilityLabel="Menu" onPress={() => app.openMenu(true)} style={S.barBtn}><Icon name="menu" color={ic} size={24} /></Pressable> : null;
  const right = acts.map((a, i) => {
    const n = a.badge ? num(app.vars[a.badge]) || 0 : 0, name = a.icon === 'theme' ? (P.dark ? 'sun' : 'moon') : a.icon;
    return (
      <Pressable key={i} accessibilityLabel={a.icon} onPress={() => tap(a)} style={[S.barAct, B.circles === 'circles' && { backgroundColor: P.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }, B.circles === 'outlined circles' && { borderWidth: 1.4, borderColor: alpha(ic, 0.35) }]}>
        <Icon name={name} color={ic} size={B.circles === 'plain' ? 25 : 20} />
        {n > 0 ? <View style={[S.badge, { backgroundColor: P.danger }]}><Text style={S.badgeT}>{n > 99 ? '99+' : n}</Text></View> : null}
      </Pressable>
    );
  });
  const titleEl = <Text numberOfLines={1} style={{ color: fg, fontWeight: brand ? '900' : '800', fontSize: brand ? 22 : B.size, textAlign: center ? 'center' : 'left', paddingLeft: center ? 0 : 6, flexShrink: 1 }}>{brand ? app.model.name : app.fill(title)}</Text>;
  return (
    <View style={{ backgroundColor: col(B.bg, P) || P.card, paddingTop: inset.top, borderBottomWidth: B.border ? StyleSheet.hairlineWidth * 2 : 0, borderBottomColor: P.line }}>
      <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 }}>
        {center
          ? <><View style={{ flex: 1, flexDirection: 'row' }}>{left}</View>{titleEl}<View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 }}>{right}</View></>
          : <>{left}<View style={{ flex: 1 }}>{titleEl}</View><View style={{ flexDirection: 'row', gap: 2 }}>{right}</View></>}
      </View>
    </View>
  );
}

/** The Bottom Nav: its style (pill, floating, glass, segmented, dock, minimal…), when names show, colours and badges. */
function TabBar({ P }) {
  const N = app.model.nav || { style: 'pill', labels: 'always', margin: 14, bar: '@bar', active: '@accent', idle: '@sub', on: '#ffffff' }, inset = useSafeAreaInsets();
  const fl = FLOATING.includes(N.style), on = col(N.active, P) || P.accent, off = col(N.idle, P) || P.sub, onSolid = col(N.on, P) || '#fff', bg = col(N.bar, P) || P.card;
  const tabs = app.model.tabs, small = tabs.length >= 5;
  return (
    <View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, fl
      ? { marginHorizontal: N.margin, marginBottom: Math.max(8, N.margin) + inset.bottom, borderRadius: 26, backgroundColor: N.style === 'glass' ? alpha(bg, 0.72) : bg, paddingVertical: 8, paddingHorizontal: 2, ...S.shadow }
      : { backgroundColor: bg, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: P.line, paddingTop: 6, paddingBottom: 8 + inset.bottom }]}>
      <View style={{ flexDirection: 'row' }}>
        {tabs.map((t, i) => {
          const sel = i === app.tab, n = t.badge ? num(app.vars[t.badge]) || 0 : 0, tint = sel ? (SOLID.includes(N.style) ? onSolid : on) : off;
          const label = N.labels === 'always' || (N.labels === 'selected only' && sel);
          return (
            <Pressable key={t.page} accessibilityLabel={t.label} onPress={() => app.go(t.page)}
              style={[{ flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: SOLID.includes(N.style) ? 6 : 0, borderRadius: 20 }, sel && SOLID.includes(N.style) && { backgroundColor: on }]}>
              <View style={[{ width: '100%', maxWidth: fl ? 64 : 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, sel && PILL.includes(N.style) && { backgroundColor: alpha(on, fl ? 0.22 : 0.2) }]}>
                <Icon name={t.icon} color={tint} size={N.labels === 'never' ? 27 : 24} />
                {n > 0 ? <View style={[S.badge, { backgroundColor: P.danger, top: -2, right: 6 }]}><Text style={S.badgeT}>{n > 99 ? '99+' : n}</Text></View> : null}
              </View>
              {label ? <Text numberOfLines={1} style={{ color: tint, fontSize: small ? 10 : 11, fontWeight: '600', maxWidth: '100%' }}>{t.label}</Text> : null}
              {sel && (N.style === 'dot' || N.style === 'dock') ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on }} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** The Side Menu (opened by the App Bar's ☰ or your avatar): a header, rows that open pages, switch a variable or send a message. */
function SideMenu({ P }) {
  const M = app.model.menu, page = app.page(), inset = useSafeAreaInsets();
  const bg = col(M.bg, P) || P.card, fg = col(M.text, P) || P.text, acc = col(M.accent, P) || P.accent;
  const close = () => app.openMenu(false);
  const lit = (v) => (app.vars[v] != null ? isOn(app.vars[v]) : v === 'darkMode' && P.dark); // (Dark mode follows the app's look until it's set)
  const row = (it, i) => {
    if (it.kind === 'line') return <View key={i} style={{ height: 1, backgroundColor: alpha(fg, 0.2), marginVertical: 6, marginHorizontal: 8 }} />;
    if (it.kind === 'section') return <Text key={i} style={{ color: alpha(fg, 0.55), fontSize: 12, fontWeight: '800', letterSpacing: 0.6, paddingTop: 14, paddingBottom: 4, paddingHorizontal: 12 }}>{it.label.toUpperCase()}</Text>;
    const n = it.badge ? num(app.vars[it.badge]) || 0 : 0, on = it.kind === 'page' && it.page === page, tint = on ? acc : fg;
    return (
      <Pressable key={i} onPress={() => { if (it.kind === 'toggle') return app.set(it.var, !lit(it.var)); close(); if (it.kind === 'page') app.go(it.page); else app.send(String(it.msg).replace(/^msg:/, '')); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 48, paddingHorizontal: 12, borderRadius: 14, backgroundColor: on ? alpha(acc, 0.18) : 'transparent' }}>
        {it.icon ? <Icon name={it.icon} color={tint} size={22} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, color: tint, fontSize: 16, fontWeight: '600' }}>{app.fill(it.label)}</Text>
        {it.kind === 'toggle' ? <Switch value={lit(it.var)} onValueChange={(v) => app.set(it.var, v)} trackColor={{ false: alpha(fg, 0.25), true: acc }} />
          : n > 0 ? <View style={{ backgroundColor: col(M.badge, P) || P.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={S.badgeT}>{n > 99 ? '99+' : n}</Text></View> : null}
      </Pressable>
    );
  };
  const head = M.header === 'none' ? null : M.social ? (
    <Pressable onPress={() => { close(); app.go(M.profilePage); }} style={{ paddingHorizontal: 10, paddingBottom: 14, gap: 4 }}>
      <Avatar name={app.meName()} seed={app.me()} size={52} />
      <Text style={{ color: fg, fontSize: 18, fontWeight: '800' }}>{app.meName()}</Text>
      <Text style={{ color: alpha(fg, 0.65) }}>@{app.me()}</Text>
    </Pressable>
  ) : (
    <View style={{ padding: 14, marginBottom: 6, borderRadius: 16, gap: 4, backgroundColor: M.header === 'banner' ? acc : 'transparent' }}>
      {M.avatar ? (app.model.art?.[M.avatar] ? <Icon name={M.avatar} color={M.header === 'banner' ? '#fff' : fg} size={34} /> : <Text style={{ fontSize: 34 }}>{M.avatar}</Text>) : null}
      <Text style={{ color: M.header === 'banner' ? '#fff' : fg, fontSize: 18, fontWeight: '800' }}>{app.fill(M.title)}</Text>
      {M.subtitle ? <Text style={{ color: alpha(M.header === 'banner' ? '#ffffff' : fg, 0.65) }}>{app.fill(M.subtitle)}</Text> : null}
    </View>
  );
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: M.side === 'right' ? 'row-reverse' : 'row' }]}>
      <View style={{ width: Math.min(M.width, 330), maxWidth: '82%', backgroundColor: bg, paddingTop: inset.top + 8, paddingBottom: inset.bottom + 10, paddingHorizontal: 8, ...S.shadow }}>
        <Pressable accessibilityLabel="Close menu" onPress={close} style={{ alignSelf: 'flex-end', padding: 8 }}><Icon name="close" color={alpha(fg, 0.7)} size={20} /></Pressable>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
          {head}
          {M.items.map(row)}
          {M.footer.length ? <View style={{ borderTopWidth: 1, borderTopColor: alpha(fg, 0.2), marginTop: 6, paddingTop: 6 }}>{M.footer.map(row)}</View> : null}
          {M.footerText ? <Text style={{ color: alpha(fg, 0.5), fontSize: 12, paddingHorizontal: 12, paddingTop: 8 }}>{app.fill(M.footerText)}</Text> : null}
        </ScrollView>
      </View>
      <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close menu" />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Building blocks: text, buttons, cards with things inside, controls
// ---------------------------------------------------------------------------------------------------------------

const fw = (w) => String(Math.min(900, Math.max(100, Math.round((parseInt(w, 10) || 600) / 100) * 100)));

/** Text with {variables} filled in. */
export function PText({ value, size = 16, weight = '600', color, align = 'left' }) {
  useApp(); const P = usePal();
  return <Text style={{ fontSize: Math.round(size), fontWeight: fw(weight), color: col(color, P) || P.text, textAlign: align }}>{app.fill(value)}</Text>;
}

/** A button: filled, outlined or plain (a link), in the project's colours; it does the button's Action. */
export function PButton({ label, action, value, amount = 1, plain, outlined, fill, color, stroke, h = 52, radius = 16, size = 17, inBox }) {
  useApp(); const P = usePal();
  const look = plain ? 'plain' : outlined ? 'outlined' : 'filled', fg = col(color, P) || (look === 'filled' ? P.onAccent : P.accent);
  const bg = look === 'filled' ? col(fill, P) || P.accent : look === 'outlined' && fill ? col(fill, P) || 'transparent' : 'transparent';
  return (
    <Pressable accessibilityRole="button" onPress={() => app.run(action, value, amount)}
      style={({ pressed }) => [{ minHeight: inBox ? 0 : h, height: inBox ? '100%' : undefined, borderRadius: radius, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, opacity: pressed ? 0.75 : 1 },
        look === 'outlined' && { borderWidth: 2, borderColor: col(stroke, P) || fg }]}>
      <Text numberOfLines={2} style={{ color: fg, fontSize: size, fontWeight: '800', textAlign: 'center' }}>{app.fill(label)}</Text>
    </Pressable>
  );
}

/** A card, badge or picture box (or a box you tap), with its own centred text and its children where the design puts them:
 *  pin = where a child sits (fx/fy: a share of the width / height, x/y: pixels from there, w/h, align, m: side margins, a row's cells). */
export function PBox({ w = 368, h, radius = 0, fill, stroke, strokeW = 1, shadow, text, action, row, children, inBox }) {
  useApp(); const P = usePal();
  const [W, setW] = useState(w || 368), DW = w || 368, k = W / DW;
  const kids = React.Children.toArray(children);
  const inner = (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ height: inBox ? '100%' : h, borderRadius: radius, backgroundColor: col(fill, P) || 'transparent', overflow: 'hidden' }, stroke && { borderWidth: strokeW || 1, borderColor: col(stroke, P) || P.line }, shadow && S.cardShadow]}>
      {text ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: text.size, fontWeight: fw(text.weight), color: col(text.color, P) || P.text, textAlign: 'center' }}>{app.fill(text.value)}</Text></View> : null}
      {kids.map((c, i) => {
        const q = c.props.pin || { fx: 0.5, fy: 0.5, x: 0, y: 0, w: 0, h: 0, align: 'center', m: -1, wrap: 0 }, top = q.fy * (inBox ? h : h) + q.y;
        let box; // where it goes across: a row's cell, side margins, its own width, or lined up left / right / centre
        if (q.cells && row != null) { const cw = (DW - row * (q.cells - 1)) / q.cells; box = { left: (q.cell * (cw + row) + q.m) * k, width: (cw - 2 * q.m) * k }; }
        else if (q.m >= 0) box = { left: q.m * k, right: q.m * k };
        else if (q.w) box = { left: (q.fx * DW + q.x - q.w / 2) * k, width: q.w * k };
        else if (q.align === 'left') box = { left: (q.fx * DW + q.x) * k, width: q.wrap ? q.wrap * k : W - (q.fx * DW + q.x) * k - W * 0.03, alignItems: 'flex-start' };
        else if (q.align === 'right') box = { right: W - (q.fx * DW + q.x) * k, width: q.wrap ? q.wrap * k : (q.fx * DW + q.x) * k - W * 0.03, alignItems: 'flex-end' };
        else { const mw = q.wrap ? q.wrap * k : W * 0.94; box = { left: (q.fx * DW + q.x) * k - mw / 2, width: mw, alignItems: 'center' }; }
        const hh = c.type === PSlider ? Math.max(q.h, 24) : q.h;
        return ( // (centred on its spot, the same as the editor)
          <View key={i} pointerEvents="box-none" style={[{ position: 'absolute', top: hh ? top - hh / 2 : top, height: hh || 0, justifyContent: 'center' }, box]}>
            {React.cloneElement(c, { inBox: !!hh && (c.type === PButton || c.type === PBox) })}
          </View>
        );
      })}
    </View>
  );
  return action ? <Pressable onPress={() => app.run(action.action, action.value, action.amount)}>{inner}</Pressable> : inner;
}

/** Something narrower than the page on its own line: left, centred or right, as in the design. */
export function Place({ fx, width, children }) {
  return <View style={{ flexDirection: 'row', justifyContent: fx === 0 ? 'flex-start' : fx === 1 ? 'flex-end' : 'center' }}><View style={{ width, maxWidth: '100%' }}>{children}</View></View>;
}
export const Spacer = () => <View style={{ flex: 1 }} />;
export const PSpace = ({ h }) => <View style={{ height: Math.max(0, h - 12) }} />;

/** A bar that fills with a variable (health, progress…). */
export function PBar({ var: v, max = 100, h = 12, fill, bg, radius = 6 }) {
  useApp(); const P = usePal(), f = Math.max(0, Math.min(1, (num(app.vars[v]) || 0) / (max || 100)));
  return <View style={{ height: h, borderRadius: radius, backgroundColor: col(bg, P) || P.line, overflow: 'hidden' }}><View style={{ width: `${f * 100}%`, height: '100%', borderRadius: radius, backgroundColor: col(fill, P) || P.accent }} /></View>;
}

/** A slider for a number variable. */
export function PSlider({ var: v, min = 0, max = 100, step = 1 }) {
  useApp(); const P = usePal(), [W, setW] = useState(1), val = num(app.vars[v]) ?? min, f = (val - min) / ((max - min) || 1);
  const pick = (x) => { const raw = min + Math.max(0, Math.min(1, x / W)) * (max - min), s = Math.round(raw / step) * step; app.set(v, Math.round(s * 1000) / 1000); };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 32, justifyContent: 'center' }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={(e) => pick(e.nativeEvent.locationX)} onResponderMove={(e) => pick(e.nativeEvent.locationX)}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: P.line }}><View style={{ width: `${f * 100}%`, height: 4, borderRadius: 2, backgroundColor: P.accent }} /></View>
      <View style={{ position: 'absolute', left: f * W - 11, width: 22, height: 22, borderRadius: 11, backgroundColor: P.accent, ...S.cardShadow }} />
    </View>
  );
}

/** Two to five choices side by side; the picked one is filled. */
export function Segmented({ var: v, options, index }) {
  useApp(); const P = usePal(), cur = show(app.vars[v]);
  return (
    <View style={{ flexDirection: 'row', backgroundColor: P.field, borderRadius: 12, padding: 3 }}>
      {options.map((o, i) => { const on = index ? cur === String(i + 1) : cur === o; return (
        <Pressable key={o} onPress={() => app.set(v, index ? i + 1 : o)} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: on ? P.accent : 'transparent', alignItems: 'center' }}>
          <Text style={{ color: on ? P.onAccent : P.sub, fontWeight: '700' }}>{o}</Text>
        </Pressable>); })}
    </View>
  );
}

/** Choices as chips that wrap onto more lines. */
export function Chips({ var: v, options, value, onPick }) {
  useApp(); const P = usePal(), cur = value !== undefined ? show(value) : show(app.vars[v]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => (onPick ? onPick(o) : app.set(v, o))} style={{ borderWidth: 1, borderColor: cur === o ? P.accent : P.line, backgroundColor: cur === o ? alpha(P.accent, 0.22) : P.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
          <Text style={{ color: P.text, fontSize: 14 }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A box that opens a list to pick from. */
export function PDropdown({ var: v, options, placeholder = 'Choose…' }) {
  useApp(); const P = usePal(), [open, setOpen] = useState(false), cur = options.find((o) => String(o.value) === show(app.vars[v]));
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} style={[S.field, { backgroundColor: P.field, justifyContent: 'space-between' }]}>
        <Text style={{ color: cur ? P.text : P.sub, paddingVertical: 13 }}>{cur ? cur.label : placeholder}</Text><Text style={{ color: P.sub }}>▾</Text>
      </Pressable>
      {open ? <View style={{ backgroundColor: P.card, borderRadius: 12, marginTop: 4, ...S.cardShadow }}>{options.map((o) => (
        <Pressable key={String(o.value)} onPress={() => { app.set(v, o.value); setOpen(false); }} style={{ padding: 13 }}><Text style={{ color: P.text, fontWeight: cur === o ? '800' : '500' }}>{o.label}</Text></Pressable>))}</View> : null}
    </View>
  );
}

/** − and + around a number. */
export function PStepper({ var: v, min = 0, max = 10, step = 1 }) {
  useApp(); const P = usePal(), val = num(app.vars[v]) ?? min, set = (d) => app.set(v, Math.max(min, Math.min(max, val + d)));
  const btn = (t, d) => <Pressable accessibilityLabel={d < 0 ? 'Less' : 'More'} onPress={() => set(d)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: P.onAccent, fontSize: 22, fontWeight: '800' }}>{t}</Text></Pressable>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>{btn('−', -step)}<Text style={{ color: P.text, fontSize: 20, fontWeight: '800', minWidth: 30, textAlign: 'center' }}>{show(val)}</Text>{btn('+', step)}</View>;
}

/** Stars to tap. */
export function PRating({ var: v, max = 5 }) {
  useApp(); const P = usePal(), val = num(app.vars[v]) || 0;
  return <View style={{ flexDirection: 'row', gap: 4 }}>{Array.from({ length: max }, (_, i) => <Pressable key={i} accessibilityLabel={`${i + 1} stars`} onPress={() => app.set(v, i + 1)}><Text style={{ fontSize: 30, color: i < val ? '#f5b301' : P.line }}>★</Text></Pressable>)}</View>;
}

/** A line across, with optional words in the middle. */
export function PDivider({ label }) {
  useApp(); const P = usePal(), line = <View style={{ flex: 1, height: 1, backgroundColor: P.line }} />;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>{line}{label ? <Text style={{ color: P.sub, fontSize: 13 }}>{app.fill(label)}</Text> : null}{label ? line : null}</View>;
}

export function PAvatar({ emoji, size = 64 }) { useApp(); return <View style={{ alignItems: 'center' }}><Avatar name={app.meName()} seed={app.me()} size={size} label={emoji || undefined} /></View>; }

/** A coloured note: info, success, warning or error. */
export function PBanner({ tone = 'info', title, text, icon }) {
  useApp(); const P = usePal(), T = { warning: ['#fff4d6', '#7a5200'], error: ['#ffe1e1', '#8a1c1c'], success: ['#ddf6e8', '#145c34'] }[tone] || [alpha(P.accent, 0.14), P.text];
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: T[0] }}>
      {icon ? <Text style={{ fontSize: 18 }}>{icon}</Text> : null}
      <View style={{ flex: 1 }}>{title ? <Text style={{ color: T[1], fontWeight: '800' }}>{app.fill(title)}</Text> : null}{text ? <Text style={{ color: T[1] }}>{app.fill(text)}</Text> : null}</View>
    </View>
  );
}

/** A level and the experience to the next one. */
export function XpBar({ xpVar, levelVar, base = 100, growth = 1.4 }) {
  useApp(); const P = usePal(), lv = Math.max(1, num(app.vars[levelVar]) || 1), need = Math.round(base * Math.pow(growth, lv - 1)), xp = num(app.vars[xpVar]) || 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: P.onAccent, fontWeight: '800' }}>{show(lv)}</Text></View>
      <View style={{ flex: 1, height: 12, borderRadius: 6, backgroundColor: P.line, overflow: 'hidden' }}><View style={{ width: `${Math.min(100, xp / need * 100)}%`, height: '100%', backgroundColor: P.accent }} /></View>
      <Text style={{ color: P.sub, fontWeight: '700' }}>{show(xp)} / {need}</Text>
    </View>
  );
}

/** Numbered steps (Cart, Address, Pay), the current one lit. */
export function PSteps({ var: v, steps }) {
  useApp(); const P = usePal(), cur = Math.max(1, num(app.vars[v]) || 1);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {steps.map((t, i) => { const done = i + 1 < cur, on = i + 1 === cur; return (
        <View key={t} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: done || on ? P.accent : P.line }}><Text style={{ color: done || on ? P.onAccent : P.sub, fontWeight: '800' }}>{done ? '✓' : i + 1}</Text></View>
          <Text style={{ color: on ? P.text : P.sub, fontSize: 12 }}>{t}</Text>
        </View>); })}
    </View>
  );
}
export function PSpinner() { const P = usePal(); return <ActivityIndicator color={P.accent} size="large" />; }

/** A text box for a variable (search boxes get a magnifying glass). */
export function VarField({ var: v, placeholder = '', keyboard = 'text', outlined }) {
  useApp(); const P = usePal();
  return (
    <View style={[S.field, { backgroundColor: outlined ? P.card : P.field }, outlined && { borderWidth: 1, borderColor: P.line }]}>
      {keyboard === 'search' ? <Icon name="search" color={P.sub} size={18} /> : null}
      <TextInput value={show(app.vars[v])} placeholder={placeholder} placeholderTextColor={P.sub} secureTextEntry={keyboard === 'password'} keyboardType={keyboard === 'number' ? 'numeric' : keyboard === 'email' ? 'email-address' : 'default'}
        onChangeText={(t) => app.set(v, keyboard === 'number' ? +t || 0 : t)} style={{ flex: 1, minWidth: 0, color: P.text, paddingVertical: 13, fontSize: 15 }} />
    </View>
  );
}

/** A switch for a yes / no variable (Dark mode follows the app's look until it's set). */
export function VarSwitch({ var: v, label }) {
  useApp(); const P = usePal(), on = app.vars[v] != null ? isOn(app.vars[v]) : v === 'darkMode' && P.dark;
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: P.text, flex: 1 }}>{app.fill(label)}</Text><Switch value={on} onValueChange={(x) => app.set(v, x)} trackColor={{ false: alpha(P.sub, 0.45), true: P.accent }} /></View>;
}

export function StaticList({ items }) { useApp(); const P = usePal(); return <View style={[S.card, { backgroundColor: P.card }]}>{items.map((t, i) => <Text key={i} style={{ color: P.text, paddingVertical: 6 }}>{app.fill(t)}</Text>)}</View>; }
export function PImage({ src, h = 180 }) { return <Image source={{ uri: src }} style={{ width: '100%', height: h, borderRadius: 16 }} resizeMode="cover" />; }
/** A card with things side by side. */
export function PCard({ children }) { const P = usePal(); return <View style={[S.card, { backgroundColor: P.card, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>{React.Children.map(children, (c, i) => <View style={i === 0 ? { flex: 1 } : null}>{c}</View>)}</View>; }
/** Something that has no native version yet: a placeholder (the README lists them). */
export function TodoBox({ name, type }) { const P = usePal(); return <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: P.line, borderRadius: 16, padding: 18, alignItems: 'center', gap: 4 }}><Text style={{ color: P.text, fontWeight: '800' }}>{name}</Text><Text style={{ color: P.sub, fontSize: 12 }}>{type}: TODO</Text></View>; }

// ---------------------------------------------------------------------------------------------------------------
// Data: a list of records (tap to open, tick, swipe left to delete) and a form that adds or changes one
// ---------------------------------------------------------------------------------------------------------------

function SwipeRow({ onDelete, radius, children }) {
  const P = usePal(), x = useRef(new Animated.Value(0)).current, [sw, setSw] = useState(false);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => { if (g.dx < 0) { setSw(true); x.setValue(g.dx); } },
    onPanResponderRelease: (_, g) => { if (g.dx < -90) onDelete(); else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(() => setSw(false)); },
    onPanResponderTerminate: () => { Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(() => setSw(false)); },
  }), [onDelete]);
  return (
    <View style={{ borderRadius: radius, overflow: 'hidden', backgroundColor: sw ? P.danger : 'transparent' }}>
      {sw ? <Text style={{ position: 'absolute', right: 18, top: 0, bottom: 0, textAlignVertical: 'center', color: '#fff', fontWeight: '800', lineHeight: 64 }}>Delete</Text> : null}
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>{children}</Animated.View>
    </View>
  );
}

/** A Data List: records of a collection, with a title / subtitle / icon or tick / right text, search, filter and sort. */
export function RecordList({ collection, title = '{title}', subtitle, icon, check, search, filter = '', sort = 'newest first', openPage, empty = 'Nothing here yet', right, swipeDelete = true, rowH = 64, gap = 8, radius = 14, doneLook = true, fill }) {
  useApp(); const P = usePal();
  const rows = app.query(collection, filter, search ? show(app.vars[search]) : '', sort);
  if (!rows.length) return <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32, flex: fill ? 1 : undefined }}>{empty}</Text>;
  const body = rows.map((r) => {
    const done = check && isOn(r[check]);
    const row = (
      <Pressable key={r._id} onPress={() => { if (!openPage) return; app.openCollection = collection; app.openId = r._id; app.go(openPage); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.card, borderRadius: radius, paddingVertical: 10, paddingHorizontal: 12, minHeight: rowH - 20 }}>
        {check ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} onPress={() => app.updateRecord(collection, r._id, { [check]: !done })}
            style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: done ? P.accent : P.sub, backgroundColor: done ? P.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {done ? <Icon name="check2" color="#fff" size={16} width={3} /> : null}</Pressable>
          : icon ? <Text style={{ fontSize: 24 }}>{app.fill(icon, r, collection)}</Text> : null}
        <View style={{ flex: 1, minWidth: 0, opacity: done && doneLook ? 0.55 : 1 }}>
          <Text numberOfLines={1} style={{ color: P.text, fontWeight: '700', fontSize: 15, textDecorationLine: done && doneLook ? 'line-through' : 'none' }}>{app.fill(title, r, collection)}</Text>
          {subtitle ? <Text numberOfLines={1} style={{ color: P.sub }}>{app.fill(subtitle, r, collection)}</Text> : null}
        </View>
        {right ? <Text style={{ color: P.sub, fontWeight: '700' }}>{app.fill(right, r, collection)}</Text> : null}
      </Pressable>
    );
    return swipeDelete ? <SwipeRow key={r._id} radius={radius} onDelete={() => app.deleteRecord(collection, r._id)}>{row}</SwipeRow> : row;
  });
  return fill ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>{body}</ScrollView> : <View style={{ gap }}>{body}</View>;
}

/** A Record Form: the collection's fields (text, numbers, money, dates, yes / no, choices); Save adds a record or changes the opened one. */
export function RecordForm({ collection, fields = [], mode = 'auto', saveLabel = 'Save', after = 'go back', page, fill }) {
  useApp(); const P = usePal();
  const all = app.def(collection)?.fields || [], shown = fields.length ? fields.map((k) => all.find((f) => f.key === k)).filter(Boolean) : all;
  const [F] = useState(() => {
    const editing = mode === 'edit' || (mode === 'auto' && app.opened() && app.openCollection === collection), o = editing ? app.opened() : null;
    return { editing, values: Object.fromEntries(shown.map((f) => [f.key, o ? o[f.key] : f.def === 'today' ? today() : f.type === 'yes/no' ? isOn(f.def) : f.def ?? ''])) };
  });
  const [, redraw] = useReducer((n) => n + 1, 0);
  const set = (k, v) => { F.values[k] = v; redraw(); };
  const save = () => {
    const out = Object.fromEntries(shown.map((f) => [f.key, ['number', 'money'].includes(f.type) ? num(F.values[f.key]) ?? 0 : F.values[f.key]]));
    if (F.editing && app.openId) app.updateRecord(collection, app.openId, out); else app.addRecord(collection, out);
    if (after === 'clear the form') { for (const f of shown) F.values[f.key] = f.type === 'yes/no' ? false : ''; redraw(); } else if (after === 'go to page') app.go(page); else if (after !== 'stay') app.back();
  };
  const input = (f, extra) => <TextInput value={show(F.values[f.key])} placeholder={f.name} placeholderTextColor={P.sub} onChangeText={(t) => set(f.key, t)} style={[S.input, { backgroundColor: P.field, color: P.text }]} {...extra} />;
  const content = (
    <>
      {shown.map((f) => (
        <View key={f.key} style={{ gap: 6 }}>
          <Text style={{ color: P.sub, fontWeight: '700', fontSize: 13, marginTop: 8, marginLeft: 4 }}>{f.name}</Text>
          {f.type === 'yes/no' ? <View style={[S.card, { backgroundColor: P.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}><Text style={{ color: P.text }}>{f.name}</Text><Switch value={isOn(F.values[f.key])} onValueChange={(v) => set(f.key, v)} trackColor={{ false: alpha(P.sub, 0.45), true: P.accent }} /></View>
            : f.type === 'choice' ? <Chips options={f.options} value={F.values[f.key]} onPick={(o) => set(f.key, o)} />
            : f.type === 'date' ? input(f, { placeholder: 'YYYY-MM-DD' })
            : f.type === 'long text' ? input(f, { multiline: true, style: [S.input, { backgroundColor: P.field, color: P.text, minHeight: 96, textAlignVertical: 'top' }] })
            : input(f, ['number', 'money'].includes(f.type) ? { keyboardType: 'numeric' } : null)}
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={save} style={{ marginTop: 18, minHeight: 50, borderRadius: 16, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: P.onAccent, fontWeight: '800', fontSize: 16 }}>{app.fill(saveLabel)}</Text>
      </Pressable>
    </>
  );
  return fill ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">{content}</ScrollView> : <View style={{ gap: 6 }}>{content}</View>;
}

// ---------------------------------------------------------------------------------------------------------------
// Social: the feed (X style, a grid or reels), composer, stories, inbox and chat, profile, marketplace, activity, people
// ---------------------------------------------------------------------------------------------------------------

const mediaList = (m) => show(m).split('|').map((x) => x.trim()).filter(Boolean);
const firstMedia = (m) => mediaList(m)[0] || '';
const isUrl = (m) => /^(https?:|data:|file:)/.test(m);
const hexOf = (c) => (/^#[0-9a-f]{6}$/i.test(show(c)) ? show(c) : null);
/** 1284 → 1.3K, 48200 → 48K (the engine's short counts). */
const compact = (v) => { const n = num(v) || 0; return n < 1000 ? String(Math.round(n)) : n < 1e4 ? (Math.round(n / 100) / 10 + 'K').replace('.0K', 'K') : n < 1e6 ? Math.round(n / 1000) + 'K' : (Math.round(n / 1e5) / 10 + 'M').replace('.0M', 'M'); };
/** 9m, 2h, 3d, then the date. */
const ago = (at) => { const s0 = (Date.now() - (+at || 0)) / 1000; if (!(+at > 1e11)) return ''; return s0 < 60 ? 'now' : s0 < 3600 ? Math.floor(s0 / 60) + 'm' : s0 < 86400 ? Math.floor(s0 / 3600) + 'h' : s0 < 604800 ? Math.floor(s0 / 86400) + 'd' : new Date(+at).toLocaleDateString('en', { day: 'numeric', month: 'short' }); };
/** Opens a person's profile page (it shows {profile} and {profile_name}). */
export const openProfile = (page, handle, name) => { if (!page) return; app.vars.profile = handle; app.vars.profile_name = name; app.go(page); };
const toggle = (coll, r, flag, count) => { const on = !isOn(r[flag]); app.updateRecord(coll, r._id, count ? { [flag]: on, [count]: Math.max(0, (num(r[count]) || 0) + (on ? 1 : -1)) } : { [flag]: on }); };

function Tile({ m, bg, height, size }) {
  return isUrl(m) ? <Image source={{ uri: m }} style={{ width: '100%', height }} resizeMode="cover" />
    : <View style={{ width: '100%', height, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: size || Math.round(height * 0.4) }}>{m}</Text></View>;
}
/** 1 to 4 pictures, laid out like the engine's feed. */
function MediaGrid({ r, height, P }) {
  const L = mediaList(r.media).slice(0, 4), bg = hexOf(r.color) || avColor(r.handle || L[0]); if (!L.length) return null;
  const cell = (m, hh, k) => <View key={k} style={{ flex: 1 }}><Tile m={m} bg={bg} height={hh} size={Math.round(Math.min(hh, 150) * 0.42)} /></View>;
  const half = height / 2 - 1, colOf = (a, b) => <View style={{ flex: 1, gap: 2 }}>{cell(a, half, 'a')}{cell(b, half, 'b')}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: 2, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: P.line }}>
      {L.length === 1 ? cell(L[0], height) : L.length === 2 ? L.map((m, i) => cell(m, height, i)) : L.length === 3 ? <>{cell(L[0], height, 0)}{colOf(L[1], L[2])}</> : <>{colOf(L[0], L[2])}{colOf(L[1], L[3])}</>}
    </View>
  );
}
/** Text with #hashtags and @mentions in the accent colour. */
function Rich({ text, P }) {
  return <Text style={{ color: P.text, fontSize: 15, lineHeight: 20 }}>{show(text).split(/([#@]\w+)/).map((w, i) => (/^[#@]\w+/.test(w) ? <Text key={i} style={{ color: P.accent }}>{w}</Text> : w))}</Text>;
}
/** A feed tab's "only where…": following, saved, media, replies, posts, likes (or a filter, handled by the query). */
const tabPasses = (only) => {
  const o = String(only || '').trim().toLowerCase(), meH = app.me();
  if (!o) return () => true;
  if (o === 'following') { const f = new Set(app.rows('Follows').filter((r) => show(r.follower) === meH).map((r) => show(r.followee))); return (r) => f.has(show(r.handle)) || isOn(r.following); }
  if (o === 'saved') return (r) => isOn(r.saved);
  if (o === 'media') return (r) => !!firstMedia(r.media);
  if (o === 'replies') return (r) => !!show(r.reply_to);
  if (o === 'posts') return (r) => !show(r.reply_to);
  if (o === 'likes') return (r) => isOn(r.liked);
  return null;
};
const ACT = { comment: ['comment', 'comments'], repost: ['repost', 'reposts', 'reposted', '#00ba7c'], like: ['heart', 'likes', 'liked', '#f91880'], views: ['views', 'views'], save: ['bookmark', '', 'saved', 'accent'], share: ['share', ''] };
function Actions({ collection, actions, r, P }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -6 }}>
      {actions.filter((a) => ACT[a]).map((a) => {
        const [ic, count, flag, tone] = ACT[a], on = flag && isOn(r[flag]), c = on ? (tone === 'accent' ? P.accent : tone) : P.sub, end = a === 'save' || a === 'share';
        return (
          <Pressable key={a} accessibilityLabel={a} onPress={flag ? () => toggle(collection, r, flag, count || undefined) : undefined} style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 6, flexShrink: 0 }, !end && { flex: 1 }]}>
            <Icon name={ic} color={c} size={19} filled={on && (a === 'like' || a === 'save')} />
            {count ? <Text style={{ color: c, fontSize: 13.5 }}>{compact(r[count])}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
function XPost({ x, r, P }) {
  const bgText = !firstMedia(r.media) && (show(r.background).match(/#[0-9a-f]{6}/gi) || [])[0];
  const open = () => openProfile(x.profilePage, r.handle, r.author);
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: P.line }}>
      <Pressable onPress={open}><Avatar name={r.author} seed={r.handle} size={46} /></Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Pressable onPress={open} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: P.text, fontWeight: '800', fontSize: 15 }}>{show(r.author)}</Text>
          {isOn(r.verified) ? <View style={{ width: 17, height: 17, borderRadius: 9, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="check2" color="#fff" size={11} width={3.5} /></View> : null}
          <Text numberOfLines={1} style={{ color: P.sub, flex: 1, fontSize: 15 }}>{['@' + show(r.handle), ago(r._at), r.location && '📍 ' + show(r.location)].filter(Boolean).join(' · ')}</Text>
          <Icon name="more" color={P.sub} size={20} width={3} />
        </Pressable>
        {bgText ? <View style={{ minHeight: 150, borderRadius: 16, backgroundColor: bgText, alignItems: 'center', justifyContent: 'center', padding: 18 }}><Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>{show(r.text)}</Text></View>
          : r.text ? <Rich text={r.text} P={P} /> : null}
        {r.poll ? <View style={{ gap: 6 }}>{show(r.poll).split('|').map((o, i) => <View key={i} style={{ borderWidth: 1, borderColor: P.accent, borderRadius: 999, paddingVertical: 7 }}><Text style={{ color: P.accent, fontWeight: '700', textAlign: 'center' }}>{o.trim()}</Text></View>)}</View> : null}
        {r.link ? <View style={{ borderWidth: 1, borderColor: P.line, borderRadius: 14, padding: 10 }}><Text style={{ color: P.text, fontWeight: '700' }}>{show(r.link_title || r.link)}</Text><Text style={{ color: P.sub }}>{show(r.link).replace(/^https?:\/\//, '').split('/')[0]}</Text></View> : null}
        <MediaGrid r={r} height={220} P={P} />
        <Actions collection={x.collection} actions={x.actions || ['comment', 'repost', 'like', 'share']} r={r} P={P} />
      </View>
    </View>
  );
}
function Reel({ x, r, P }) {
  const m = firstMedia(r.media);
  return (
    <View style={[S.card, { backgroundColor: P.card, gap: 8 }]}>
      <Pressable onPress={() => openProfile(x.profilePage, r.handle, r.author)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={r.author} seed={r.handle} /><View><Text style={{ color: P.text, fontWeight: '800' }}>{show(r.author)}</Text><Text style={{ color: P.sub }}>@{show(r.handle)}</Text></View>
      </Pressable>
      {m ? <View style={{ borderRadius: 12, overflow: 'hidden' }}><Tile m={m} bg={hexOf(r.color) || avColor(r.handle)} height={380} /></View> : r.text ? <Rich text={r.text} P={P} /> : null}
      <Actions collection={x.collection} actions={x.actions || ['comment', 'repost', 'like', 'share']} r={r} P={P} />
    </View>
  );
}

/** The social feed: posts newest first, with its tabs (For you / Following), in a timeline, a grid or reels. */
export function SocialFeed(x) {
  useApp(); const P = usePal(), [tab, setTab] = useState(0);
  const tabs = x.tabs || [], t = tabs.length ? tabs[Math.min(tab, tabs.length - 1)] : null, test = t ? tabPasses(t.only) : null;
  const rows = app.query(x.collection, [x.filter, t && !test ? t.only : ''].filter(Boolean).join(' and '), x.search ? show(app.vars[x.search]) : '', 'newest first').filter(test || (() => true));
  const look = t?.look || x.look || 'timeline', cols = x.columns || 3;
  const body = !rows.length ? <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>{x.empty || 'No posts yet'}</Text>
    : look === 'grid' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4 }}>{rows.map((r) => (
        <Pressable key={r._id} onPress={() => openProfile(x.profilePage, r.handle, r.author)} style={{ width: `${100 / cols - 2}%`, borderRadius: 6, overflow: 'hidden' }}>
          {firstMedia(r.media) ? <Tile m={firstMedia(r.media)} bg={hexOf(r.color) || avColor(r.handle)} height={120} /> : <View style={{ height: 120, backgroundColor: avColor(r.author), padding: 8, justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{show(r.text).slice(0, 60)}</Text></View>}
        </Pressable>))}</View>
    : look === 'reels' ? <View style={{ gap: 10, padding: 10 }}>{rows.map((r) => <Reel key={r._id} x={x} r={r} P={P} />)}</View>
    : <View>{rows.map((r) => <XPost key={r._id} x={x} r={r} P={P} />)}</View>;
  return (
    <View style={{ marginHorizontal: -16 }}>
      {tabs.length > 1 ? <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: P.line }}>{tabs.map((tb, i) => (
        <Pressable key={tb.label} accessibilityLabel={tb.label} onPress={() => setTab(i)} style={{ flex: 1, alignItems: 'center', paddingTop: 14 }}>
          <Text style={{ color: tab === i ? P.text : P.sub, fontWeight: '700', paddingBottom: 11, borderBottomWidth: 4, borderBottomColor: tab === i ? P.accent : 'transparent' }}>{tb.label}</Text>
        </Pressable>))}</View> : null}
      {body}
    </View>
  );
}

/** Writes a post to the top of the feed. */
export function Composer({ collection = 'Posts', placeholder = 'What’s happening?' }) {
  useApp(); const P = usePal(), [draft, setDraft] = useState('');
  const post = () => { const t = draft.trim(); if (!t) return; app.addRecord(collection, { author: app.meName(), handle: app.me(), text: t }); setDraft(''); };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Avatar name={app.meName()} seed={app.me()} size={40} />
      <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={post} placeholder={placeholder} placeholderTextColor={P.sub} style={[S.input, { flex: 1, minWidth: 0, backgroundColor: P.field, color: P.text, paddingVertical: 10 }]} />
      <Pressable onPress={post} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: P.accent, justifyContent: 'center', flexShrink: 0 }}><Text style={{ color: P.onAccent, fontWeight: '800' }}>Post</Text></Pressable>
    </View>
  );
}

/** One bubble per person (newest first), "Your story" first; tap one to see it. */
export function Stories({ collection = 'Stories', yours = true }) {
  useApp(); const P = usePal(), [open, setOpen] = useState(null);
  const by = new Map(); for (const r of app.query(collection)) { const k = show(r.handle) || show(r.author); if (!by.has(k)) by.set(k, r); }
  const ring = (child) => <View style={{ padding: 2, borderRadius: 40, backgroundColor: '#ec4899' }}><View style={{ borderRadius: 34, borderWidth: 2, borderColor: P.bg }}>{child}</View></View>;
  return (
    <View style={{ marginHorizontal: -16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingVertical: 2 }}>
        {yours ? <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={{ padding: 3 }}><Avatar name={app.meName()} seed={app.me()} size={60} /><View style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: P.accent, borderWidth: 2, borderColor: P.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '900', lineHeight: 18 }}>+</Text></View></View>
          <Text style={{ color: P.text, fontSize: 12, fontWeight: '700' }}>Your story</Text></View> : null}
        {[...by.values()].filter((r) => show(r.handle) !== app.me()).map((r) => { const m = firstMedia(r.media); return (
          <Pressable key={r._id} onPress={() => setOpen(r)} style={{ alignItems: 'center', gap: 4 }}>
            {ring(m && !isUrl(m) ? <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: hexOf(r.color) || avColor(r.author), alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28 }}>{m}</Text></View> : <Avatar name={r.author} seed={r.handle} size={60} />)}
            <Text style={{ color: P.text, fontSize: 12, fontWeight: '700' }}>{show(r.author).split(' ')[0]}</Text>
          </Pressable>); })}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        {open ? <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: hexOf(open.color) || avColor(open.handle), padding: 28, paddingTop: 70, justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{show(open.author)}</Text>
          <Text style={{ fontSize: 110 }}>{firstMedia(open.media)}</Text>
          <Text style={{ color: '#fff', fontSize: 17, textAlign: 'center', marginBottom: 40 }}>{show(open.text)}</Text>
        </Pressable> : null}
      </Modal>
    </View>
  );
}

const chats = (coll) => { const by = new Map(); for (const r of app.query(coll, '', '', 'newest first')) if (r.chat && !by.has(r.chat)) by.set(r.chat, r); return [...by.values()]; };
const chatName = (coll, id) => { const me = app.me(), o = app.rows(coll).find((r) => r.chat === id && show(r.handle) !== me); return o ? show(o.author) : show(id).replace(/^dm-/, '').split('-').filter((s) => s !== me).join(', ') || show(id); };
const Row = ({ P, onPress, children, style }) => <Pressable onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.card, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 }, style]}>{children}</Pressable>;
const Lines = ({ P, title, sub }) => <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: P.text, fontWeight: '700' }}>{title}</Text>{sub ? <Text numberOfLines={1} style={{ color: P.sub }}>{sub}</Text> : null}</View>;

/** Your chats, newest first; tap one to open it. */
export function Inbox({ collection = 'Messages', openPage = 'chat' }) {
  useApp(); const P = usePal(), L = chats(collection);
  if (!L.length) return <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>No messages yet</Text>;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>{L.map((r) => { const name = chatName(collection, r.chat); return (
    <Row key={r.chat} P={P} onPress={() => { app.vars.chat = r.chat; app.vars.chatTitle = name; app.go(openPage); }}><Avatar name={name} size={46} /><Lines P={P} title={name} sub={(show(r.handle) === app.me() ? 'You: ' : '') + show(r.text)} /></Row>); })}</ScrollView>;
}

/** The open chat ({chat}): bubbles, yours on the right; type and Send. */
export function Chat({ collection = 'Messages' }) {
  useApp(); const P = usePal(), [draft, setDraft] = useState(''), id = show(app.vars.chat), me = app.me();
  const L = app.query(collection, '', '', 'oldest first').filter((r) => show(r.chat) === id);
  const send = () => { const t = draft.trim(); if (!t || !id) return; app.addRecord(collection, { chat: id, author: app.meName(), handle: me, text: t }); setDraft(''); };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
        {L.length ? L.map((r) => { const mine = show(r.handle) === me; return (
          <View key={r._id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', backgroundColor: mine ? P.accent : P.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }}>
            <Text style={{ color: mine ? P.onAccent : P.text, fontSize: 15 }}>{show(r.text)}</Text></View>); })
          : <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>Say hello 👋</Text>}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={send} placeholder="Message" placeholderTextColor={P.sub} style={[S.input, { flex: 1, minWidth: 0, backgroundColor: P.field, color: P.text, paddingVertical: 10 }]} />
        <Pressable onPress={send} style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: P.accent, justifyContent: 'center', flexShrink: 0 }}><Text style={{ color: P.onAccent, fontWeight: '800' }}>Send</Text></Pressable>
      </View>
    </View>
  );
}

/** A profile header: cover, picture, name, @handle, bio and numbers. */
export function ProfileHeader({ name, handle, bio, stats = [], cover = '@accent' }) {
  useApp(); const P = usePal(), n = app.fill(name), h = app.fill(handle);
  return (
    <View style={{ alignItems: 'center', gap: 4, backgroundColor: P.card, borderRadius: 16, paddingBottom: 14, overflow: 'hidden' }}>
      <View style={{ alignSelf: 'stretch', height: 80, marginBottom: -38, backgroundColor: col(cover, P) || P.accent }} />
      <View style={{ borderWidth: 3, borderColor: P.card, borderRadius: 41 }}><Avatar name={n} seed={h} size={76} /></View>
      <Text style={{ color: P.text, fontSize: 20, fontWeight: '800' }}>{n}</Text>
      <Text style={{ color: P.sub }}>@{h}</Text>
      {bio ? <Text style={{ color: P.text, textAlign: 'center', paddingHorizontal: 16 }}>{app.fill(bio)}</Text> : null}
      {stats.length ? <View style={{ flexDirection: 'row', gap: 22, marginTop: 6 }}>{stats.map((s) => <View key={s.label} style={{ alignItems: 'center' }}><Text style={{ color: P.text, fontWeight: '800' }}>{app.fill(s.value)}</Text><Text style={{ color: P.sub, fontSize: 12 }}>{s.label}</Text></View>)}</View> : null}
    </View>
  );
}

/** Things for sale in two columns; tap one for its details and Message seller. */
export function Marketplace({ collection = 'Listings', chatPage }) {
  useApp(); const P = usePal(), [open, setOpen] = useState(null), L = app.query(collection);
  if (!L.length) return <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>Nothing for sale yet</Text>;
  const price = (r) => (num(r.price) != null ? '$' + show(r.price) : show(r.price));
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 }}>
        {L.map((r) => (
          <Pressable key={r._id} onPress={() => setOpen(r)} style={{ width: '48.5%', backgroundColor: P.card, borderRadius: 14, padding: 6, paddingBottom: 10, gap: 2 }}>
            {firstMedia(r.media) ? <View style={{ borderRadius: 12, overflow: 'hidden' }}><Tile m={firstMedia(r.media)} bg={hexOf(r.color) || avColor(r.title)} height={120} /></View> : null}
            <Text style={{ color: P.text, fontWeight: '800' }}>{price(r)}{isOn(r.sold) ? ' · Sold' : ''}</Text>
            <Text numberOfLines={1} style={{ color: P.text }}>{show(r.title)}</Text>
            <Text numberOfLines={1} style={{ color: P.sub }}>{show(r.location)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        {open ? <Pressable onPress={() => setOpen(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: P.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 34, gap: 8 }}>
            {firstMedia(open.media) ? <View style={{ borderRadius: 12, overflow: 'hidden' }}><Tile m={firstMedia(open.media)} bg={hexOf(open.color) || avColor(open.title)} height={150} /></View> : null}
            <Text style={{ color: P.text, fontWeight: '800', fontSize: 17 }}>{show(open.title)}</Text>
            <Text style={{ color: P.text, fontSize: 22, fontWeight: '800' }}>{price(open)}</Text>
            <Text style={{ color: P.sub }}>{[open.condition, open.location, open.seller && 'Seller: ' + show(open.seller)].filter(Boolean).map(show).join(' · ')}</Text>
            {open.description ? <Text style={{ color: P.text }}>{show(open.description)}</Text> : null}
            {chatPage && show(open.handle) !== app.me() ? <Pressable onPress={() => { app.vars.chat = 'dm-' + [app.me(), show(open.handle)].sort().join('-'); app.vars.chatTitle = show(open.seller || open.handle); setOpen(null); app.go(chatPage); }}
              style={{ minHeight: 50, borderRadius: 16, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: P.onAccent, fontWeight: '800', fontSize: 16 }}>Message seller</Text></Pressable> : null}
          </Pressable>
        </Pressable> : null}
      </Modal>
    </View>
  );
}

const ACT_IC = { like: '❤️', comment: '💬', follow: '👤', repost: '🔁', mention: '@' };
/** Your notifications (likes, comments, follows…), unread ones marked. */
export function Activity({ collection = 'Notifications', profilePage }) {
  useApp(); const P = usePal(), L = app.query(collection, '', '', 'newest first').filter((r) => !r.to || show(r.to) === app.me());
  if (!L.length) return <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>No notifications yet</Text>;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>{L.map((r) => (
    <Row key={r._id} P={P} style={!isOn(r.read) && { borderLeftWidth: 3, borderLeftColor: P.accent }} onPress={() => { app.updateRecord(collection, r._id, { read: true }); if (profilePage) openProfile(profilePage, r.from, r.from_name); }}>
      <Text style={{ fontSize: 24 }}>{ACT_IC[r.type] || '🔔'}</Text>
      <Text style={{ flex: 1, color: P.text }}><Text style={{ fontWeight: '800' }}>{show(r.from_name || r.from)}</Text> {show(r.text)}</Text>
    </Row>))}</ScrollView>;
}

/** People to see (friends, who to follow); tap one for their profile. */
export function People({ collection = 'Profiles', profilePage }) {
  useApp(); const P = usePal(), L = app.query(collection, '', '', 'name (a-z)').filter((r) => show(r.handle) !== app.me());
  if (!L.length) return <Text style={{ color: P.sub, textAlign: 'center', paddingVertical: 32 }}>No one here yet</Text>;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>{L.map((r) => (
    <Row key={r._id} P={P} onPress={() => openProfile(profilePage, r.handle, r.name)}><Avatar name={r.name} seed={r.handle} size={46} /><Lines P={P} title={show(r.name) + (isOn(r.verified) ? ' ✓' : '')} sub={'@' + show(r.handle) + (r.bio ? ' · ' + show(r.bio) : '')} /></Row>))}</ScrollView>;
}

/** Milestones (first post, 100 likes…), unlocked or with how far you are. */
export function Achievements() {
  useApp(); const P = usePal(), me = app.me(), mine = app.rows('Posts').filter((r) => show(r.handle) === me), likes = mine.reduce((a, r) => a + (num(r.likes) || 0), 0), fol = num(app.vars.followers) || 0;
  const M = [['✍️', 'First post', mine.length, 1], ['📚', '10 posts', mine.length, 10], ['❤️', 'First like', likes, 1], ['🔥', '100 likes', likes, 100], ['⭐', '1,000 followers', fol, 1000]];
  return <View style={{ gap: 10 }}>{M.map(([ic, label, have, need]) => (
    <Row key={label} P={P} style={have < need && { opacity: 0.6 }}><Text style={{ fontSize: 24 }}>{have >= need ? ic : '🔒'}</Text><Lines P={P} title={label} sub={have >= need ? 'Unlocked' : `${Math.min(have, need)} / ${need}`} /></Row>))}</View>;
}

/** The most used #hashtags; tap one to search for it. */
export function Trending({ collection = 'Posts', searchVar }) {
  useApp(); const P = usePal(), n = new Map();
  for (const r of app.rows(collection)) for (const t of show(r.text).match(/#\w+/g) || []) n.set(t, (n.get(t) || 0) + 1);
  const T = [...n].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!T.length) return <Text style={{ color: P.sub }}>No hashtags yet</Text>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{T.map(([t, c]) => <Pressable key={t} onPress={() => searchVar && app.set(searchVar, t)} style={{ borderWidth: 1, borderColor: P.line, backgroundColor: P.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}><Text style={{ color: P.text }}>{t} · {c}</Text></Pressable>)}</View>;
}

// ---------------------------------------------------------------------------------------------------------------
// More components: charts, carousels, swipe pages, timers, keypads, popups, notifications…
// ---------------------------------------------------------------------------------------------------------------

/** Hear the app's messages while this is on screen. */
function useMessages(f) {
  const ref = useRef(f); ref.current = f;
  useEffect(() => app.listen((m) => ref.current(m)), []);
}
/** A component's own width (for charts and carousels). */
function useWidth(start = 340) { const [w, setW] = useState(start); return [w, (e) => { const x = e.nativeEvent.layout.width; if (Math.abs(x - w) > 0.5) setW(x); }]; }

/** The notifications on screen, stacked at the top (or bottom, or centre). */
function ToastLayer({ P }) {
  const n = app.model.notify, inset = useSafeAreaInsets(), bg = col(n.bg, P) || P.card, fg = col(n.text, P) || P.text, ac = col(n.accent, P) || P.accent;
  const pill = n.look === 'pill', banner = n.look === 'banner';
  const pos = n.position === 'bottom' ? { bottom: inset.bottom + 96 } : n.position === 'center' ? { top: '40%' } : { top: inset.top + 8 };
  return (
    <View pointerEvents="box-none" style={[{ position: 'absolute', left: banner ? 0 : 12, right: banner ? 0 : 12, gap: 8, alignItems: n.position === 'top right' ? 'flex-end' : 'center' }, pos]}>
      {app.toasts.map((t) => (
        <Pressable key={t.key} onPress={() => { app.toasts = app.toasts.filter((q) => q !== t); app.changed(); }}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: bg, maxWidth: banner ? undefined : 420, alignSelf: banner ? 'stretch' : undefined, borderRadius: banner ? 0 : pill ? 30 : 16, paddingHorizontal: pill ? 18 : 14, paddingVertical: pill ? 10 : 12 }, n.look === 'achievement' && { borderWidth: 2, borderColor: ac }, S.cardShadow]}>
          {t.icon ? <Text style={{ fontSize: pill ? 18 : 24 }}>{t.icon}</Text> : null}
          <View style={{ flexShrink: 1 }}>
            {t.title ? <Text style={{ color: n.look === 'achievement' ? ac : fg, fontWeight: '800', fontSize: 15 }}>{t.title}</Text> : null}
            {t.text && !pill ? <Text style={{ color: fg, opacity: 0.8, fontSize: 13 }}>{t.text}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const MORE = ['#ff6b8b', '#ffc94d', '#3ccf7a', '#8e6bf2', '#22b8c9', '#ff9f43', '#e0559b'];
const n1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/** A bar, column, line, area, pie, donut or radar chart: from label | value lines ({variables} work), or a variable tracked over time. */
export function PChart({ chart = 'columns', data = [], track = '', every = 1, points = 30, title = '', max = 0, values = true, labels = true, grid = true, color = '@accent', text = '', bg = '', h = 200 }) {
  useApp(); const P = usePal(), [W, onLayout] = useWidth(), [hist, setHist] = useState(() => (track ? [num(app.vars[track]) || 0] : []));
  useEffect(() => { if (!track) return undefined; const t = setInterval(() => setHist((L) => [...L, num(app.vars[track]) || 0].slice(-points)), Math.max(100, every * 1000)); return () => clearInterval(t); }, [track, every, points]);
  const fg = col(text, P) || P.text, c = col(color, P) || P.accent, H = Math.max(60, h - (title ? 52 : 24));
  const items = track ? hist.map((v) => ['', v]) : data.map((d) => [app.fill(d.label), num(app.fill(d.value).trim()) ?? 0]);
  const kind = track && !['line', 'area', 'columns', 'bars'].includes(chart) ? 'line' : chart, n = items.length, out = [];
  const top = Math.max(0, ...items.map((i) => i[1])), hi = max > 0 ? max : top <= 0 ? 1 : top * 1.12;
  const txt = (s, x, y, o = {}) => { if (s !== '') out.push(<SvgText key={out.length} fontFamily={Platform.OS === 'web' ? 'system-ui, sans-serif' : undefined} x={x} y={y + 4} textAnchor={o.anchor || 'middle'} fontSize={o.size || 11} fontWeight={o.bold ? '800' : '600'} fill={o.fill || fg} opacity={o.fill ? 1 : 0.75}>{s}</SvgText>); };
  const slice = (i) => (i === 0 ? c : MORE[(i - 1) % MORE.length]);
  if (n && (kind === 'pie' || kind === 'donut')) {
    const total = items.reduce((a, i) => a + Math.max(0, i[1]), 0), r = Math.min(W, H) / 2 - 4, cx = W / 2, cy = H / 2; let a = -Math.PI / 2;
    if (total > 0) items.forEach(([name, v], i) => {
      const sw = Math.max(0, v) / total * Math.PI * 2, rr = kind === 'donut' ? r * 0.78 : r, a2 = a + Math.min(sw, Math.PI * 2 - 0.0001), big = sw > Math.PI ? 1 : 0;
      const p0 = `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`, p1 = `${cx + Math.cos(a2) * rr},${cy + Math.sin(a2) * rr}`;
      out.push(kind === 'donut' ? <Path key={out.length} d={`M${p0} A${rr},${rr} 0 ${big} 1 ${p1}`} fill="none" stroke={slice(i)} strokeWidth={r * 0.42} /> : <Path key={out.length} d={`M${cx},${cy} L${p0} A${rr},${rr} 0 ${big} 1 ${p1} Z`} fill={slice(i)} />);
      if (labels && sw > 0.4) { const m = a + sw / 2, k = kind === 'donut' ? 0.78 : 0.62; txt(name, cx + Math.cos(m) * r * k, cy + Math.sin(m) * r * k, { fill: '#fff', bold: true }); }
      a += sw;
    });
    if (kind === 'donut' && values) txt(n1(total), cx, cy, { size: 20, bold: true, fill: fg });
  } else if (n && kind === 'radar') {
    const r = Math.min(W, H) / 2 - (labels ? 18 : 4), cx = W / 2, cy = H / 2, at = (i, k) => { const a = -Math.PI / 2 + i * Math.PI * 2 / n; return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]; };
    for (const k of [0.33, 0.66, 1]) if (grid || k === 1) out.push(<Polygon key={out.length} points={items.map((_, i) => at(i, k).join(',')).join(' ')} fill="none" stroke={P.line} />);
    items.forEach(([name], i) => { const e = at(i, 1); out.push(<Line key={out.length} x1={cx} y1={cy} x2={e[0]} y2={e[1]} stroke={P.line} />); if (labels) txt(name, ...at(i, 1.18)); });
    out.push(<Polygon key={out.length} points={items.map(([, v], i) => at(i, Math.min(1, Math.max(0, v / hi))).join(',')).join(' ')} fill={c} fillOpacity={0.3} stroke={c} strokeWidth={2.5} />);
  } else if (n && kind === 'bars') {
    const lw = labels && items.some((i) => i[0]) ? 52 : 0, vw = values ? 34 : 0, row = H / n;
    items.forEach(([name, v], i) => { const y = row * i + row * 0.2, bh = row * 0.6, bw = (W - lw - vw) * Math.min(1, Math.max(0, v / hi));
      out.push(<Rect key={out.length} x={lw} y={y} width={bw} height={bh} rx={bh / 3} fill={c} />); if (lw) txt(name, lw - 6, y + bh / 2, { anchor: 'end' }); if (values) txt(n1(v), lw + bw + 6, y + bh / 2, { anchor: 'start', bold: true, fill: fg }); });
  } else if (n) {
    const lb = labels && items.some((i) => i[0]) ? 18 : 2, tp = values ? 16 : 4, h0 = H - lb - tp, slot = W / n, yOf = (v) => tp + h0 * (1 - Math.min(1, Math.max(0, v / hi)));
    if (grid) for (let i = 0; i <= 3; i++) out.push(<Line key={out.length} x1={0} x2={W} y1={tp + h0 * i / 3} y2={tp + h0 * i / 3} stroke={P.line} />);
    if (kind === 'line' || kind === 'area') {
      const pts = items.map(([, v], i) => [n === 1 ? W / 2 : i * W / (n - 1), yOf(v)]);
      if (kind === 'area') out.push(<Polygon key={out.length} points={[...pts, [pts[n - 1][0], tp + h0], [pts[0][0], tp + h0]].map((p) => p.join(',')).join(' ')} fill={c} fillOpacity={0.25} />);
      out.push(<Polyline key={out.length} points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={c} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />);
      pts.forEach((p, i) => { if (n <= 14) { out.push(<Circle key={out.length} cx={p[0]} cy={p[1]} r={3.5} fill={c} />); if (values) txt(n1(items[i][1]), p[0], p[1] - 11, { bold: true, fill: fg }); } if (lb > 2) txt(items[i][0], Math.min(W - 14, Math.max(14, p[0])), H - 8); });
    } else items.forEach(([name, v], i) => { const x = slot * i + slot * 0.2, bw = slot * 0.6, y = yOf(v);
      out.push(<Path key={out.length} d={`M${x},${tp + h0} V${y + 6} Q${x},${y} ${x + 6},${y} H${x + bw - 6} Q${x + bw},${y} ${x + bw},${y + 6} V${tp + h0} Z`} fill={c} />);
      if (values) txt(n1(v), x + bw / 2, y - 8, { bold: true, fill: fg }); if (lb > 2) txt(name, x + bw / 2, H - 8); });
  }
  return (
    <View style={{ borderRadius: 16, padding: 12, gap: 8, backgroundColor: col(bg, P) || 'transparent' }}>
      {title ? <Text style={{ color: fg, fontSize: 16, fontWeight: '800' }}>{app.fill(title)}</Text> : null}
      <View onLayout={onLayout}><Svg width={W} height={H}>{out}</Svg></View>
    </View>
  );
}

/** Swipe through cards; the one in the middle is picked into a variable (locked cards wait for their variable). */
export function Carousel({ var: v, items = [], cardWidth = 0.55, arrows = true, dots = true, message = '', card = '@card', text = '', accent = '@accent', h = 220 }) {
  useApp(); const P = usePal(), [W, onLayout] = useWidth(), ref = useRef(null);
  const [i, setI] = useState(() => Math.max(0, items.findIndex((it) => it.value === show(app.vars[v]))));
  const cw = W * cardWidth, side = (W - cw) / 2, fg = col(text, P) || P.text, ac = col(accent, P) || P.accent;
  const locked = (it) => !!it.lock && !isOn(app.vars[it.lock]);
  const pick = (j) => { j = Math.max(0, Math.min(items.length - 1, j)); setI(j); const it = items[j]; if (it && !locked(it) && show(app.vars[v]) !== it.value) { app.set(v, it.value); if (message) app.send(message); } };
  const go = (j) => { j = Math.max(0, Math.min(items.length - 1, j)); ref.current?.scrollTo({ x: j * cw, animated: true }); pick(j); };
  useEffect(() => { ref.current?.scrollTo({ x: i * cw, animated: false }); }, [cw]);
  return (
    <View style={{ height: h }} onLayout={onLayout}>
      <View style={{ flex: 1 }}>
        <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={cw} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: side }}
          onMomentumScrollEnd={(e) => pick(Math.round(e.nativeEvent.contentOffset.x / cw))}>
          {items.map((it, k) => (
            <Pressable key={k} onPress={() => go(k)} style={{ width: cw, padding: 6, transform: [{ scale: k === i ? 1 : 0.86 }] }}>
              <View style={{ flex: 1, borderRadius: 20, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: col(card, P) || P.card, borderWidth: 2.5, borderColor: k === i ? ac : 'transparent', opacity: locked(it) ? 0.5 : 1 }}>
                <Text style={{ fontSize: 46 }}>{locked(it) ? '🔒' : it.icon}</Text>
                <Text numberOfLines={1} style={{ color: fg, fontSize: 17, fontWeight: '800' }}>{it.name}</Text>
                {it.desc ? <Text numberOfLines={2} style={{ color: fg, opacity: 0.7, fontSize: 13, textAlign: 'center' }}>{app.fill(it.desc)}</Text> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
        {arrows ? <Pressable accessibilityLabel="Previous" onPress={() => go(i - 1)} style={[S.carr, { left: 0 }]}><Text style={{ color: fg, fontSize: 30 }}>‹</Text></Pressable> : null}
        {arrows ? <Pressable accessibilityLabel="Next" onPress={() => go(i + 1)} style={[S.carr, { right: 0 }]}><Text style={{ color: fg, fontSize: 30 }}>›</Text></Pressable> : null}
      </View>
      {dots ? <Dots n={items.length} i={i} on={ac} off={P.line} /> : null}
    </View>
  );
}
const Dots = ({ n, i, on, off }) => <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10 }}>{Array.from({ length: n }, (_, k) => <View key={k} style={{ width: k === i ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: k === i ? on : off }} />)}</View>;

/** Swipe left and right between pages (onboarding, a tour); the page number goes into a variable, and "slide next" / "slide prev" / "slide 2" move it. */
export function Pager({ var: v, dots = true, dotColor = '@accent', loop = false, auto = 0, message = 'slide', h = 320, children }) {
  useApp(); const P = usePal(), [W, onLayout] = useWidth(), ref = useRef(null), pages = React.Children.toArray(children), n = pages.length;
  const cur = Math.max(0, Math.min(n - 1, (num(app.vars[v]) || 1) - 1)), dot = col(dotColor, P) || P.accent;
  const go = (j) => { j = loop ? ((j % n) + n) % n : Math.max(0, Math.min(n - 1, j)); if (j + 1 !== num(app.vars[v])) app.set(v, j + 1); };
  useEffect(() => { ref.current?.scrollTo({ x: cur * W, animated: true }); }, [cur, W]);
  useMessages((m) => { const c = (num(app.vars[v]) || 1) - 1; if (m === message + ' next') go(c + 1); else if (m === message + ' prev' || m === message + ' back') go(c - 1); else if (m.startsWith(message + ' ') && Number.isFinite(+m.slice(message.length + 1))) go(+m.slice(message.length + 1) - 1); });
  useEffect(() => { if (!(auto > 0)) return undefined; const t = setInterval(() => go((num(app.vars[v]) || 1)), auto * 1000); return () => clearInterval(t); }, [auto, n]);
  return (
    <View style={{ height: h }} onLayout={onLayout}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }} onMomentumScrollEnd={(e) => go(Math.round(e.nativeEvent.contentOffset.x / W))}>
        {pages.map((c, k) => <View key={k} style={{ width: W, justifyContent: 'center', paddingHorizontal: 4 }}>{c}</View>)}
      </ScrollView>
      {dots ? <Dots n={n} i={cur} on={dot} off={alpha(dot.startsWith('#') ? dot : '#888888', 0.3)} /> : null}
    </View>
  );
}

/** A grid of square pictures from a collection's media field (or emojis); tap one to open it. */
export function PhotoGrid({ collection = 'Posts', field = 'media', filter = '', columns = 3, gap = 2, radius = 0, openPage = '', message = '' }) {
  useApp(); const P = usePal(), [W, onLayout] = useWidth();
  const rows = app.query(collection, filter, '', 'newest first').filter((r) => mediaList(r[field]).length), cols = Math.max(1, columns), size = (W - gap * (cols - 1)) / cols;
  if (!rows.length) return <Text style={{ color: P.sub, textAlign: 'center', padding: 24 }}>No pictures yet</Text>;
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {rows.map((r) => (
        <Pressable key={r._id} onPress={() => { app.openCollection = collection; app.openId = r._id; if (openPage) app.go(openPage); else app.changed(); if (message) app.send(message); }} style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
          <Tile m={mediaList(r[field])[0]} bg={hexOf(r.color) || avColor(r._id)} height={size} />
        </Pressable>
      ))}
    </View>
  );
}

/** A heart (or thumbs-up, or star) that turns a variable on or off, with a count next to it. */
export function LikeButton({ var: v, countVar = 'likes', icon = 'heart', message = '', on = '#f91880', off = '@sub', text = '@sub' }) {
  useApp(); const P = usePal(), liked = isOn(app.vars[v]), c = liked ? col(on, P) || P.accent : col(off, P) || P.sub, k = useRef(new Animated.Value(1)).current;
  const d = icon === 'thumbs up' ? 'M7 10v10H4V10zm3 10h7.5a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 19 9h-5l.7-3.6a1.6 1.6 0 0 0-3-1L8 10v10' : icon === 'star' ? 'M12 3l2.7 6 6.3.6-4.8 4.2 1.5 6.2L12 17l-5.7 3 1.5-6.2L3 9.6 9.3 9z' : SMALL.heart;
  const tap = () => { app.set(v, !liked); if (countVar) app.add(countVar, liked ? -1 : 1); if (message) app.send(message); if (!liked) { k.setValue(1.5); Animated.spring(k, { toValue: 1, friction: 3, useNativeDriver: true }).start(); } };
  return (
    <Pressable accessibilityLabel="Like" onPress={tap} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 8 }}>
      <Animated.View style={{ transform: [{ scale: k }] }}><Svg width={26} height={26} viewBox="0 0 24 24"><Path d={d} fill={liked ? c : 'none'} stroke={c} strokeWidth={2} strokeLinejoin="round" /></Svg></Animated.View>
      {countVar ? <Text style={{ color: liked ? c : col(text, P) || P.sub, fontWeight: '700' }}>{compact(app.vars[countVar])}</Text> : null}
    </Pressable>
  );
}

/** Text that scrolls across (several messages separated by |, with {variables}). */
export function Ticker({ text = '', speed = 60, direction = 'left', gap = 60, size = 15, bg = '', color = '', accent = '#ffd23d', h = 36 }) {
  useApp(); const P = usePal(), x = useRef(new Animated.Value(0)).current, [w, setW] = useState(0);
  const parts = text.split('|').map((t) => app.fill(t.trim())).filter(Boolean), fg = col(color, P) || P.text, ac = col(accent, P) || P.accent;
  useEffect(() => { if (!w) return undefined; x.setValue(0); const a = Animated.loop(Animated.timing(x, { toValue: 1, duration: w / Math.max(10, speed) * 1000, easing: (t) => t, useNativeDriver: true })); a.start(); return () => a.stop(); }, [w, speed]);
  const line = (k) => <Text key={k} numberOfLines={1} onLayout={k === 0 ? (e) => setW(e.nativeEvent.layout.width) : undefined} style={{ color: fg, fontSize: size, fontWeight: '700', paddingRight: gap }}>{parts.map((t, i) => <Text key={i}>{i ? <Text style={{ color: ac }}>{'   ●   '}</Text> : null}{t}</Text>)}</Text>;
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: direction === 'right' ? [-w, 0] : [0, -w] });
  return (
    <View style={{ height: h, overflow: 'hidden', justifyContent: 'center', backgroundColor: col(bg, P) || 'transparent', marginHorizontal: -16 }}>
      <Animated.View style={{ flexDirection: 'row', width: 100000, transform: [{ translateX: tx }] }}>{[0, 1, 2, 3].map(line)}</Animated.View>
    </View>
  );
}

/** A countdown (or count-up) as a ring, bar, big digits or a pill: red near the end, then a message. "timer start / pause / reset / restart / add 5" control it. */
export function PTimer({ seconds = 30, countUp = false, look = 'ring', format = 'seconds', autoStart = true, message = 'timer', endMessage = '', endAction = 'nothing else', warnAt = 5, var: v = '', color = '@accent', warn = '#ff4d5e', track = '@line', text = '', size = 120 }) {
  const P = usePal(), st = useRef({ t: 0, running: autoStart, done: false, shown: -1 }).current, [, redraw] = useReducer((n) => n + 1, 0);
  useMessages((m) => { if (!m.startsWith(message)) return; const rest = m.slice(message.length).trim();
    if (['start', 'resume', ''].includes(rest)) st.running = true; else if (rest === 'pause' || rest === 'stop') st.running = false; else if (rest === 'reset') { st.t = 0; st.done = false; } else if (rest === 'restart') { st.t = 0; st.done = false; st.running = true; } else if (/^add\s+-?\d/.test(rest)) st.t = Math.max(0, st.t - +rest.split(/\s+/)[1] * (countUp ? -1 : 1));
    redraw(); });
  useEffect(() => { const t = setInterval(() => {
    if (!st.running || st.done) return; st.t = Math.min(seconds, st.t + 0.1);
    if (st.t >= seconds) { st.done = true; if (endMessage) app.send(endMessage); if (endAction === 'restart timer') { st.t = 0; st.done = false; } }
    const left = countUp ? Math.floor(st.t) : Math.ceil(seconds - st.t - 1e-9); if (v && left !== st.shown) { st.shown = left; app.set(v, left); }
    redraw(); }, 100); return () => clearInterval(t); }, []);
  const s = seconds <= 0 ? 1 : seconds, left = countUp ? st.t : s - st.t, whole = countUp ? Math.floor(left) : Math.ceil(left - 1e-9);
  const label = format === 'm:ss' ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : format === 'seconds.tenths' ? left.toFixed(1) : String(whole);
  const warnOn = !countUp && left <= warnAt && !st.done && st.running, c = warnOn ? col(warn, P) || P.danger : col(color, P) || P.accent, frac = Math.min(1, Math.max(0, left / s));
  const scale = warnOn && Math.floor(st.t * 2) % 2 === 0 ? 1.06 : 1, tr = col(track, P) || P.line;
  const digits = <Text style={{ color: warnOn ? c : col(text, P) || P.text, fontWeight: '900', fontSize: size * (look === 'digits' ? 0.45 : 0.26), fontVariant: ['tabular-nums'] }}>{label}</Text>;
  let body;
  if (look === 'bar') body = <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 6 }}>{digits}<View style={{ alignSelf: 'stretch', height: 12, borderRadius: 6, backgroundColor: tr, overflow: 'hidden' }}><View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: c }} /></View></View>;
  else if (look === 'digits') body = digits;
  else if (look === 'pill') body = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30, backgroundColor: alpha(c.startsWith('#') ? c : '#4fa3ff', 0.16) }}><Text style={{ fontSize: 18 }}>⏱</Text>{digits}</View>;
  else { const R = 50 - 4; body = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Circle cx={50} cy={50} r={R} fill="none" stroke={tr} strokeWidth={8} />
        <Circle cx={50} cy={50} r={R} fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${2 * Math.PI * R * frac} 999`} transform="rotate(-90 50 50)" />
      </Svg>{digits}
    </View>); }
  return <View style={{ alignItems: 'center', transform: [{ scale }] }}>{body}</View>;
}

/** Grey shapes that shimmer while content loads; gone when its variable turns on. */
export function Skeleton({ layout = 'avatar + lines', lines = 3, doneVar = '', radius = 8 }) {
  useApp(); const P = usePal(), k = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.loop(Animated.sequence([Animated.timing(k, { toValue: 1, duration: 1100, useNativeDriver: true }), Animated.timing(k, { toValue: 0, duration: 1100, useNativeDriver: true })])); a.start(); return () => a.stop(); }, []);
  if (doneVar && isOn(app.vars[doneVar])) return null;
  const base = alpha(P.text, 0.12), op = k.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] });
  const bar = (w, i) => <View key={i} style={{ width: `${w}%`, height: 12, borderRadius: radius, backgroundColor: base, marginVertical: 5 }} />;
  const rows = (n) => <View style={{ flex: 1 }}>{Array.from({ length: n }, (_, i) => bar(i === n - 1 && n > 1 ? 60 : 100, i))}</View>;
  const dot = (d) => <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: base }} />;
  const block = (hh) => <View style={{ height: hh, borderRadius: radius * 1.5, backgroundColor: base }} />;
  const body = layout === 'text lines' ? rows(lines) : layout === 'card' ? <View style={{ gap: 8 }}>{block(140)}{rows(Math.max(1, lines - 1))}</View>
    : layout === 'list rows' ? <View>{Array.from({ length: lines }, (_, i) => <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 6 }}>{dot(40)}{rows(2)}</View>)}</View>
    : layout === 'picture' ? block(180) : <View style={{ flexDirection: 'row', gap: 12 }}>{dot(48)}{rows(lines)}</View>;
  return <Animated.View style={{ opacity: op }}>{body}</Animated.View>;
}

/** Colour swatches: tap one to pick it into a variable. */
export function ColorSwatches({ var: v, colors = [], columns = 5, shape = 'circle', gap = 10, ring = '@text', message = '' }) {
  useApp(); const P = usePal(), [W, onLayout] = useWidth(), cols = Math.max(1, columns), size = (W - gap * (cols - 1)) / cols, cur = show(app.vars[v]).toLowerCase();
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {colors.map((c) => { const on = c.toLowerCase() === cur; return (
        <Pressable key={c} accessibilityLabel={c} onPress={() => { app.set(v, c); if (message) app.send(message); }}
          style={{ width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : shape === 'rounded' ? 12 : 3, backgroundColor: col(c, P) || c, borderWidth: on ? 3.5 : 1, borderColor: on ? col(ring, P) || P.text : P.line, alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 2 }}>✓</Text> : null}
        </Pressable>); })}
    </View>
  );
}

/** A number pad for a code, a PIN or an answer: ✓ checks it against the answer and sends the right / wrong message. */
export function Keypad({ var: v, maxLength = 4, mask = false, answer = '', rightMessage = '', wrongMessage = '', enterMessage = '', autoEnter = true, display = true, keyStyle = 'round', keyColor = '@field', text = '', accent = '@good', displayBg = '' }) {
  useApp(); const P = usePal(), cur = show(app.vars[v]), fg = col(text, P) || P.text, ac = col(accent, P) || P.accent;
  const enter = (val) => { if (enterMessage) app.send(enterMessage); if (!answer) return; if (val === answer) { if (rightMessage) app.send(rightMessage); } else { if (wrongMessage) app.send(wrongMessage); app.set(v, ''); } };
  const press = (k) => { if (k === '⌫') app.set(v, cur.slice(0, -1)); else if (k === '✓') enter(cur); else if (cur.length < maxLength) { const nx = cur + k; app.set(v, nx); if (autoEnter && nx.length === maxLength) enter(nx); } };
  return (
    <View style={{ alignSelf: 'center', width: '100%', maxWidth: 300, gap: 8 }}>
      {display ? <Text style={{ textAlign: 'center', fontSize: 26, fontWeight: '800', letterSpacing: 2, padding: 14, borderRadius: 14, overflow: 'hidden', color: fg, backgroundColor: col(displayBg, P) || P.field }}>{Array.from({ length: maxLength }, (_, i) => (i < cur.length ? (mask ? '•' : cur[i]) : '–')).join('  ')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => (
          <Pressable key={k} accessibilityLabel={k === '⌫' ? 'Delete' : k === '✓' ? 'Enter' : k} onPress={() => press(k)}
            style={{ width: '30%', aspectRatio: keyStyle === 'round' ? 1 : 1.5, borderRadius: keyStyle === 'round' ? 999 : keyStyle === 'flat' ? 6 : 16, alignItems: 'center', justifyContent: 'center', backgroundColor: k === '✓' ? ac : keyStyle === 'flat' ? 'transparent' : col(keyColor, P) || P.field }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: k === '✓' ? '#fff' : fg }}>{k}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** ‹ Easy › : pick one of several options with arrows; the choice goes into a variable. */
export function Selector({ var: v, options = [], wrap = true }) {
  useApp(); const P = usePal(), n = options.length, i = Math.max(0, options.indexOf(show(app.vars[v])));
  if (!n) return null;
  const pick = (d) => app.set(v, options[wrap ? (i + d + n) % n : Math.max(0, Math.min(n - 1, i + d))]);
  const arrow = (t, d, ok, label) => <Pressable accessibilityLabel={label} disabled={!ok} onPress={() => pick(d)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', opacity: ok ? 1 : 0.3 }}><Text style={{ color: P.text, fontSize: 28 }}>{t}</Text></Pressable>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: P.field, borderRadius: 14 }}>
      {arrow('‹', -1, wrap || i > 0, 'Previous')}<Text style={{ flex: 1, textAlign: 'center', color: P.text, fontSize: 17, fontWeight: '800' }}>{options[i]}</Text>{arrow('›', 1, wrap || i < n - 1, 'Next')}
    </View>
  );
}

/** A popup or a bottom sheet with things inside: opens on a message and closes on another (or after a few seconds). */
export function PPopup({ mode = 'popup', openOn = 'popup', closeOn = 'close', startOpen = false, autoClose = 0, tapCloses = false, dim = true, handle = true, children }) {
  const P = usePal(), [open, setOpen] = useState(!!startOpen), sheet = mode === 'sheet';
  useMessages((m) => { if (m === openOn) setOpen(true); else if (m === closeOn) setOpen(false); });
  useEffect(() => { if (!open || !(autoClose > 0)) return undefined; const t = setTimeout(() => setOpen(false), autoClose * 1000); return () => clearTimeout(t); }, [open]);
  return (
    <Modal visible={open} transparent animationType={sheet ? 'slide' : 'fade'} onRequestClose={() => setOpen(false)}>
      <Pressable onPress={() => { if (tapCloses) setOpen(false); }} style={{ flex: 1, backgroundColor: dim ? 'rgba(0,0,0,0.5)' : 'transparent', justifyContent: sheet ? 'flex-end' : 'center', padding: sheet ? 0 : 20 }}>
        <Pressable onPress={() => {}} style={sheet ? { backgroundColor: P.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 } : null}>
          {sheet && handle ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: P.line, marginTop: 4, marginBottom: 12 }} /> : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const S = StyleSheet.create({
  carr: { position: 'absolute', top: '50%', marginTop: -22, width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  barBtn: { padding: 6 },
  barAct: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 1, borderRadius: 9, paddingHorizontal: 5, minWidth: 18, alignItems: 'center' },
  badgeT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  fab: { position: 'absolute', right: 18, width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 6 } },
  shadow: { elevation: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 11, shadowOffset: { width: 0, height: 6 } },
  cardShadow: { elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  card: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12 },
  input: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 12, fontSize: 15 },
});

// ---------------------------------------------------------------------------------------------------------------
// Game-style parts that work in apps too: a shop, a daily reward calendar, a prize wheel, a skill button,
// a radial menu, a level map and a quest log (all kept in the app's variables).
// ---------------------------------------------------------------------------------------------------------------

/** An icon from the project: an emoji (drawn as text) or one of the editor's icon names. */
function GameIcon({ icon, size = 28, color = '#fff' }) {
  return /[ -￿]|[\ud800-\udfff]/.test(icon || '') ? <Text style={{ fontSize: size * 0.9 }}>{icon}</Text> : <Icon name={icon || 'star'} color={color} size={size} />;
}
/** 15300 → 15.3K (as the engine shows prices and amounts). */
const gameNum = (v) => { const a = Math.abs(v); if (a < 10000) return Number.isInteger(v) ? String(v) : v.toFixed(1); for (const [n, u] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) if (a >= n) return Math.floor(v / n * 10) / 10 + u; return String(v); };
const numOf = (v) => (Number.isFinite(+v) ? +v : 0);

/** Shop: buy items with a currency variable (coins, gems). Bought ones stay owned (owned_ID) and can be equipped (equipVar). */
export function PShop({ items = [], currency = 'coins', currencyIcon = '🪙', equipVar = 'outfit', layout = 'grid', columns = 2, confirm = true, message = 'bought', card = '@card', text = '', accent = '@good', owned = '@accent' }) {
  useApp(); const P = usePal(), fg = col(text, P) || P.text, cash = numOf(app.vars[currency]), grid = layout !== 'list';
  const [armed, setArmed] = useState(-1);
  useEffect(() => { if (armed < 0) return undefined; const t = setTimeout(() => setArmed(-1), 2200); return () => clearTimeout(t); }, [armed]);
  const tap = (it, i) => {
    const item = it.id.startsWith('item:'), has = !item && app.vars['owned_' + it.id] === true;
    if (has) { if (equipVar) app.set(equipVar, it.id); return; }
    if (cash < it.price) { app.send('not enough'); return; }
    if (confirm && armed !== i) { setArmed(i); return; }
    setArmed(-1); app.set(currency, cash - it.price);
    if (item) app.send(`give ${it.id.slice(5).trim()}|1`); else { app.set('owned_' + it.id, true); if (equipVar) app.set(equipVar, it.id); }
    if (message) app.send(message);
  };
  return (
    <View style={{ flexDirection: grid ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
      {items.map((it, i) => {
        const item = it.id.startsWith('item:'), has = !item && app.vars['owned_' + it.id] === true, eq = has && equipVar && show(app.vars[equipVar]) === it.id, can = cash >= it.price, isArmed = armed === i;
        const label = eq ? '✓ Equipped' : has ? (equipVar ? 'Equip' : '✓ Owned') : isArmed ? 'Buy?' : `${currencyIcon} ${gameNum(it.price)}`.trim(), ownC = col(owned, P) || P.accent;
        const btn = has ? ownC : isArmed ? '#ff9f43' : can ? col(accent, P) || '#3ccf7a' : 'rgba(127,127,127,0.18)';
        const button = <View style={{ height: 32, borderRadius: 16, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: btn, opacity: eq ? 0.5 : 1 }}><Text style={{ fontSize: 13.5, fontWeight: '900', color: has || can || isArmed ? '#fff' : fg }}>{label}</Text></View>;
        return (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${it.name}, ${label}`} onPress={() => tap(it, i)}
            style={{ width: grid ? `${100 / Math.max(1, columns) - 3}%` : '100%', minHeight: grid ? 160 : 72, padding: 10, borderRadius: 16, backgroundColor: col(card, P) || P.card, borderWidth: eq ? 2.5 : 0, borderColor: ownC, flexDirection: grid ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <GameIcon icon={it.icon} size={grid ? 40 : 32} color={fg} />
            <View style={{ flex: grid ? 0 : 1, alignItems: grid ? 'center' : 'flex-start' }}>
              <Text numberOfLines={1} style={{ fontSize: grid ? 14 : 15, fontWeight: '800', color: fg }}>{it.name}</Text>
              {it.note ? <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: fg, opacity: 0.6 }}>{it.note}</Text> : null}
            </View>
            {button}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Daily Reward: a calendar of rewards, one claim a day; the streak grows when you come back (and resets if you miss a day). Kept on the phone. */
export function DailyReward({ rewards = [], resetIfMissed = true, columns = 4, message = 'daily claimed', card = '@card', text = '', accent = '#ffd23d', claimed = '@good' }) {
  useApp(); const P = usePal(), fg = col(text, P) || P.text, ac = col(accent, P) || '#ffd23d', cl = col(claimed, P) || '#3ccf7a';
  const day = (off = 0) => { const d = new Date(Date.now() + off * 86400000); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const [st, setSt] = useState({ streak: 0, last: '' });
  useEffect(() => { AsyncStorage.getItem('pocket.daily').then((raw) => { let s = { streak: 0, last: '' }; try { s = { ...s, ...JSON.parse(raw || '{}') }; } catch { /* first time */ }
    if (resetIfMissed && s.last && s.last !== day() && s.last !== day(-1)) s.streak = 0; if (s.streak >= rewards.length && s.last !== day()) s.streak = 0; setSt(s); }).catch(() => {}); }, []);
  const can = st.last !== day();
  const claim = () => {
    if (!can || st.streak >= rewards.length) return;
    const r = rewards[st.streak];
    if (String(r.v).startsWith('item:')) app.send(`give ${r.v.slice(5).trim()}|${r.amount}`); else app.set(r.v, numOf(app.vars[r.v]) + r.amount);
    const s = { streak: st.streak + 1, last: day() }; setSt(s); AsyncStorage.setItem('pocket.daily', JSON.stringify(s)).catch(() => {}); app.send(message);
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rewards.map((r, i) => {
          const done = i < st.streak, today = i === st.streak && can;
          return (
            <Pressable key={i} disabled={!today} onPress={claim} accessibilityLabel={`${r.label}: ${r.amount} ${r.v}${done ? ', claimed' : today ? ', claim' : ''}`}
              style={{ width: `${100 / Math.max(1, columns) - 3}%`, aspectRatio: 0.9, borderRadius: 14, alignItems: 'center', justifyContent: 'space-evenly', backgroundColor: done ? cl + '2e' : col(card, P) || P.card, borderWidth: today ? 3 : 0, borderColor: ac }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: fg, opacity: 0.75 }}>{r.label}</Text>
              <View style={{ opacity: done ? 0.5 : 1 }}><GameIcon icon={r.icon} size={28} color={fg} /></View>
              <Text style={{ fontSize: 12.5, fontWeight: '900', color: today ? ac : fg }}>{today ? 'CLAIM' : (String(r.v).startsWith('item:') ? '×' : '+') + gameNum(r.amount)}</Text>
              {done ? <View style={{ position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: cl, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text></View> : null}
            </Pressable>
          );
        })}
      </View>
      {!can ? <Text style={{ textAlign: 'center', fontSize: 12.5, fontWeight: '800', color: fg, opacity: 0.7 }}>Come back tomorrow!</Text> : null}
    </View>
  );
}

/** Prize Wheel: spins when tapped (or on a message) and lands on a prize (by weight): adds it to a variable and sends a message. */
export function PrizeWheel({ segments = [], var: v = 'coins', resultVar = 'prize', spinOn = 'tapped', message = 'spin', doneMessage = 'prize won', duration = 4, spinsVar = '', text = '#ffffff', rim = '#ffd23d', size = 280 }) {
  useApp(); const P = usePal();
  const rot = useRef(new Animated.Value(0)).current, cur = useRef(0), busy = useRef(false);
  const spin = () => {
    if (busy.current || !segments.length) return;
    if (spinsVar) { if (numOf(app.vars[spinsVar]) <= 0) return; app.set(spinsVar, numOf(app.vars[spinsVar]) - 1); }
    const total = segments.reduce((n, s) => n + s.w, 0) || 1; let r = Math.random() * total, w = segments.findIndex((s) => (r -= s.w) < 0); if (w < 0) w = segments.length - 1;
    const seg = 360 / segments.length, land = -(w + 0.5) * seg + (Math.random() - 0.5) * seg * 0.7, from = cur.current % 360;
    const to = from - (((from - land) % 360) + 360) % 360 - 360 * (5 + Math.floor(duration));
    busy.current = true; rot.setValue(from);
    Animated.timing(rot, { toValue: to, duration: duration * 1000, easing: (t) => 1 - Math.pow(1 - t, 4), useNativeDriver: true }).start(() => {
      busy.current = false; cur.current = to; const s = segments[w];
      if (v && s.amount) app.set(v, numOf(app.vars[v]) + s.amount); if (resultVar) app.set(resultVar, s.label); app.send(doneMessage);
    });
  };
  useMessages((m) => { if (m === message) spin(); });
  const n = Math.max(1, segments.length), R = size / 2 - 10, c = size / 2, seg = (Math.PI * 2) / n;
  const arc = (i) => { const a0 = -Math.PI / 2 + i * seg, a1 = a0 + seg; return `M${c},${c} L${c + Math.cos(a0) * R},${c + Math.sin(a0) * R} A${R},${R} 0 ${seg > Math.PI ? 1 : 0} 1 ${c + Math.cos(a1) * R},${c + Math.sin(a1) * R} Z`; };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Prize wheel, tap to spin" disabled={spinOn === 'message only'} onPress={spin} style={{ width: size, height: size, alignSelf: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: col(rim, P) || '#ffd23d' }} />
      <Animated.View style={{ width: size, height: size, transform: [{ rotate: rot.interpolate({ inputRange: [-36000, 36000], outputRange: ['-36000deg', '36000deg'] }) }] }}>
        <Svg width={size} height={size}>
          {segments.map((s, i) => <Path key={i} d={arc(i)} fill={col(s.color, P) || s.color} />)}
          {segments.map((s, i) => { const am = -Math.PI / 2 + (i + 0.5) * seg; return <SvgText key={'t' + i} x={c + Math.cos(am) * R * 0.64} y={c + Math.sin(am) * R * 0.64 + 5} fill={col(text, P) || '#fff'} fontSize={R * 0.13} fontWeight="900" textAnchor="middle">{s.label}</SvgText>; })}
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', left: c - R * 0.14, top: c - R * 0.14, width: R * 0.28, height: R * 0.28, borderRadius: R, backgroundColor: col(rim, P) || '#ffd23d' }} />
      <Text style={{ position: 'absolute', top: -4, alignSelf: 'center', fontSize: 26, color: '#fff' }}>▼</Text>
    </Pressable>
  );
}

/** Skill Button: tap to use (sends a message), then it cools down with a sweeping shadow; charges and a cost are optional. */
export function SkillButton({ icon = '⚡', label = '', message = 'skill', cooldown = 3, charges = 1, costVar = '', cost = 10, shape = 'circle', showTime = true, bg = '@card', ring = '#7fd3ff', size = 72 }) {
  useApp(); const P = usePal();
  const [left, setLeft] = useState(charges), [cd, setCd] = useState(0);
  useEffect(() => { if (left >= charges || cooldown <= 0) return undefined; const t = setInterval(() => setCd((x) => { const n = x + 0.05; if (n >= cooldown) { setLeft((l) => Math.min(charges, l + 1)); return 0; } return n; }), 50); return () => clearInterval(t); }, [left]);
  const afford = !costVar || numOf(app.vars[costVar]) >= cost, ready = left > 0 && afford, f = left === 0 && cooldown > 0 ? 1 - cd / cooldown : 0, r = shape === 'rounded square' ? size * 0.25 : size / 2;
  const use = () => { if (!ready) return; if (left === charges) setCd(0); setLeft(left - 1); if (costVar) app.set(costVar, numOf(app.vars[costVar]) - cost); app.send(message); };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label || message} onPress={use} style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: size, height: size, borderRadius: r, backgroundColor: col(bg, P) || P.card, borderWidth: ready ? 2.5 : 0, borderColor: col(ring, P) || '#7fd3ff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <GameIcon icon={icon} size={size * 0.5} color={P.text} />
        {f > 0 ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${f * 100}%`, backgroundColor: 'rgba(0,0,0,0.55)' }} /> : null}
        {f > 0 && showTime ? <Text style={{ position: 'absolute', color: '#fff', fontWeight: '900', fontSize: size * 0.32 }}>{Math.ceil(cooldown - cd)}</Text> : null}
        {!afford ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(40,60,160,0.35)' }} /> : null}
      </View>
      {charges > 1 ? <Text style={{ position: 'absolute', right: -4, top: size - 16, minWidth: 20, textAlign: 'center', borderRadius: 10, overflow: 'hidden', backgroundColor: P.accent, color: '#fff', fontSize: 11, fontWeight: '900' }}>{left}</Text> : null}
      {label ? <Text style={{ fontSize: 12, fontWeight: '800', color: P.text }}>{label}</Text> : null}
    </Pressable>
  );
}

/** Radial Menu: a round button that opens a wheel of choices around it; tap a choice to send its message. */
export function RadialMenu({ items = [], icon = '😀', open = 'hold and slide', radius = 110, dim = 0.35, labels = true, accent = '@accent', bg = '@card', size = 64 }) {
  useApp(); const P = usePal(); const [shown, setShown] = useState(false);
  const btn = (on) => <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? col(accent, P) || P.accent : col(bg, P) || P.card }}><GameIcon icon={icon} size={size * 0.5} color={P.text} /></View>;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Open menu" onPress={() => setShown(true)} onLongPress={() => setShown(true)}>{btn(false)}</Pressable>
      <Modal transparent visible={shown} animationType="fade" onRequestClose={() => setShown(false)}>
        <Pressable onPress={() => setShown(false)} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${dim})`, alignItems: 'center', justifyContent: 'center' }}>
          {items.map((it, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2) / Math.max(1, items.length); return (
            <Pressable key={i} accessibilityLabel={it.label} onPress={() => { setShown(false); app.send(it.msg); }}
              style={{ position: 'absolute', transform: [{ translateX: Math.cos(a) * radius }, { translateY: Math.sin(a) * radius }], width: 64, height: 64, borderRadius: 32, backgroundColor: col(bg, P) || P.card, alignItems: 'center', justifyContent: 'center' }}>
              <GameIcon icon={it.icon} size={26} color={P.text} />{labels ? <Text numberOfLines={1} style={{ fontSize: 9.5, fontWeight: '800', color: P.text }}>{it.label}</Text> : null}
            </Pressable>
          ); })}
          {btn(true)}
        </Pressable>
      </Modal>
    </View>
  );
}

/** Level Map: a path of level buttons with stars (stars_1, stars_2…) and locks (unlocked); tap an open level to play it (or send a message / set a variable). */
export function LevelMap({ count = 12, unlockedVar = 'unlocked', allOpen = false, starsVar = 'stars_', layout = 'winding path', action = 'plays that level', message = 'level', spacing = 92, accent = '#ffd23d', node = '@accent', text = '', h = 480 }) {
  useApp(); const P = usePal(), fg = col(text, P) || P.text, ac = col(accent, P) || '#ffd23d', open = allOpen ? Infinity : Math.max(1, numOf(app.vars[unlockedVar]) || 1);
  const go = (n) => { if (action === 'sends a message') { app.send(`${message} ${n}`); app.send(message); } else if (action === 'sets a variable') app.set(message, n); else { app.set('level', n); app.send(`play level ${n}`); app.send('play game'); } };
  const dot = (i) => {
    const n = i + 1, locked = n > open, cur = n === open, stars = Math.max(0, Math.min(3, Math.round(numOf(app.vars[starsVar + n])))), d = cur ? 60 : 52;
    return (
      <Pressable key={i} disabled={locked} onPress={() => go(n)} accessibilityLabel={`Level ${n}${locked ? ', locked' : `, ${stars} stars`}`} style={{ width: 76, alignItems: 'center' }}>
        <View style={{ width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: locked ? 'rgba(127,127,127,0.2)' : col(node, P) || P.accent, borderWidth: cur ? 3 : 0, borderColor: ac }}>
          {locked ? <Text style={{ fontSize: 20 }}>🔒</Text> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>{n}</Text>}
        </View>
        {!locked ? <Text style={{ fontSize: 13, color: ac }}>{'★'.repeat(stars)}<Text style={{ color: fg, opacity: 0.25 }}>{'★'.repeat(3 - stars)}</Text></Text> : null}
      </Pressable>
    );
  };
  if (layout === 'grid') return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>{Array.from({ length: count }, (_, i) => dot(i))}</View>;
  return (
    <ScrollView style={{ height: h }} contentContainerStyle={{ flexDirection: 'column-reverse' }}>
      {Array.from({ length: count }, (_, i) => <View key={i} style={{ height: spacing, justifyContent: 'center', alignItems: 'center', transform: [{ translateX: layout === 'straight up' ? 0 : Math.sin(i * 1.1) * 100 }] }}>{dot(i)}</View>)}
    </ScrollView>
  );
}

/** Quest Log: goals with progress bars; each follows a variable up to a target, ticks off when done (quest_done_N) and gives its reward ("gems 5"). */
export function QuestLog({ quests = [], title = 'Quests', doneMessage = 'quest done', hideDone = true, text = '', accent = '@accent', done = '@good', bg = '' }) {
  useApp(); const P = usePal(), fg = col(text, P) || P.text, ac = col(accent, P) || P.accent, dn = col(done, P) || '#3ccf7a';
  useEffect(() => {
    quests.forEach((q, i) => {
      if (app.vars['quest_done_' + i] === true || numOf(app.vars[q.v]) < q.target) return;
      app.set('quest_done_' + i, true); const r = String(q.reward || '').split(/\s+/); if (r.length >= 2) app.set(r[0], numOf(app.vars[r[0]]) + numOf(r[1])); app.send(doneMessage);
    });
  });
  const order = quests.map((_, i) => i).sort((a, b) => (hideDone ? (app.vars['quest_done_' + a] === true) - (app.vars['quest_done_' + b] === true) : 0));
  return (
    <View style={{ padding: 12, borderRadius: 18, backgroundColor: col(bg, P) || 'transparent', gap: 10 }}>
      {title ? <Text style={{ fontSize: 17, fontWeight: '900', color: fg }}>{title}</Text> : null}
      {order.map((i) => { const q = quests[i], ok = app.vars['quest_done_' + i] === true, have = numOf(app.vars[q.v]), f = Math.max(0, Math.min(1, have / q.target)); return (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: ok ? dn : 'rgba(127,127,127,0.18)', alignItems: 'center', justifyContent: 'center' }}>{ok ? <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text> : null}</View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: fg, opacity: ok ? 0.5 : 1, textDecorationLine: ok ? 'line-through' : 'none' }}>{q.text}</Text>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.18)', overflow: 'hidden' }}><View style={{ width: `${(ok ? 1 : f) * 100}%`, height: 6, backgroundColor: ok ? dn : ac }} /></View>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '800', color: fg, opacity: 0.7 }}>{ok ? '✓' : `${gameNum(Math.min(have, q.target))}/${gameNum(q.target)}`}</Text>
          {q.reward ? <Text style={{ fontSize: 11, fontWeight: '800', color: ac }}>+{q.reward}</Text> : null}
        </View>
      ); })}
    </View>
  );
}
