// Small building blocks for the app's screens.
import React from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { prefs } from './prefs';
import { Icon } from './icons';

export const tick = () => { if (prefs.haptics) Haptics.selectionAsync().catch(() => {}); };
/** A tappable thing that gives a small tap of haptics. */
export function Tap({ onPress, onLongPress, style, children, label, disabled }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={(e) => { tick(); onPress?.(e); }} onLongPress={onLongPress ? (e) => { if (prefs.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onLongPress(e); } : undefined}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }, typeof style === 'function' ? style({ pressed }) : style]}>
      {children}
    </Pressable>
  );
}
export function Button({ T, icon, label, onPress, kind = 'primary', small }) {
  const bg = kind === 'primary' ? T.accent : kind === 'danger' ? T.danger : T.card2, fg = kind === 'ghost' ? T.text : '#fff';
  return (
    <Tap label={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: bg, borderRadius: 14, paddingVertical: small ? 9 : 13, paddingHorizontal: small ? 12 : 16 }}>
      {icon ? <Icon name={icon} color={fg} size={small ? 18 : 20} /> : null}
      <Text style={{ color: fg, fontWeight: '800', fontSize: small ? 14 : 15 }}>{label}</Text>
    </Tap>
  );
}
export const H1 = ({ T, children }) => <Text style={{ color: T.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 }}>{children}</Text>;
export const H2 = ({ T, children, right }) => <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}><Text style={{ color: T.text, fontSize: 19, fontWeight: '800' }}>{children}</Text>{right}</View>;
export const Sub = ({ T, children, style }) => <Text style={[{ color: T.sub, fontSize: 14, lineHeight: 20 }, style]}>{children}</Text>;
export const Card = ({ T, children, style }) => <View style={[{ backgroundColor: T.card, borderRadius: 18, padding: 14 }, style]}>{children}</View>;

/** Asks before something that can't be undone (a dialog on the phone, the browser's confirm on the web). */
export function confirmThen(title, text, label, fn) {
  if (Platform.OS === 'web') { if (window.confirm(`${title}\n${text}`)) fn(); return; }
  Alert.alert(title, text, [{ text: 'Cancel', style: 'cancel' }, { text: label, style: 'destructive', onPress: fn }]);
}
/** A message (a dialog on the phone, an alert on the web). */
export const say = (title, text = '') => (Platform.OS === 'web' ? window.alert(`${title}${text ? '\n' + text : ''}`) : Alert.alert(title, text));
