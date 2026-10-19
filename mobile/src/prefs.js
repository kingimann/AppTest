// The app's settings (kept on the phone): where the editor lives, the look, and haptics.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_SITE = 'https://kingimann.github.io/AppTest';
export const prefs = { site: DEFAULT_SITE, theme: 'dark', haptics: true };
const KEY = 'pocket.app.prefs';
const listeners = new Set();
export const onPrefs = (f) => { listeners.add(f); return () => listeners.delete(f); };
export async function loadPrefs() { try { Object.assign(prefs, JSON.parse((await AsyncStorage.getItem(KEY)) || '{}')); } catch { /* first run */ } return prefs; }
export function setPref(k, v) { prefs[k] = v; AsyncStorage.setItem(KEY, JSON.stringify(prefs)).catch(() => {}); listeners.forEach((f) => f()); }
/** The editor site without a trailing slash. */
export const site = () => String(prefs.site || DEFAULT_SITE).trim().replace(/\/+$/, '');
