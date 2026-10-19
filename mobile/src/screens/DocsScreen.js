// A guide, inside the app, with a Back bar.
import React, { useEffect } from 'react';
import { BackHandler, Text, View } from 'react-native';
import WebFrame from '../WebFrame';
import { Icon } from '../icons';
import { Tap } from '../ui';

export default function DocsScreen({ T, uri, title, onBack }) {
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; }); return () => sub.remove(); }, [onBack]);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 52, borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.card }}>
        <Tap label="Back" onPress={onBack} style={{ padding: 8 }}><Icon name="back" color={T.accent} size={22} /></Tap>
        <Text numberOfLines={1} style={{ color: T.text, fontWeight: '800', fontSize: 17, flex: 1 }}>{title}</Text>
      </View>
      <WebFrame uri={uri} hooks={false} />
    </View>
  );
}
