// Learn: the guides (opened in the app).
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon } from '../icons';
import { H1, H2, Sub, Tap } from '../ui';

export const GUIDES = [
  { sec: 'Start here', items: [['getting-started', 'Getting started', 'Make and play your first game in ten minutes'], ['editor', 'The editor', 'Scene, Hierarchy, Inspector, Project, Scripts and Console'], ['concepts', 'Core concepts', 'Objects, components, tags, variables, messages, levels']] },
  { sec: 'Building games', items: [['objects', 'Objects and the game file', 'Everything an object can have'], ['physics', 'Physics and collisions', 'Rigidbodies, colliders, layers, triggers and raycasts'], ['triggers', 'Triggers and state machines', 'ON → IF → DO logic without code'], ['visual-scripting', 'Visual scripting', 'The Node Editor: events, flow, values, functions'], ['ui', 'UI, screens and navigation', 'HUD, menus, pages, anchors, the safe area and themes'], ['gameplay', 'Gameplay systems', 'Movement, health, inventory, crafting, AI, turn-based'], ['quests-dialogue', 'Quests and dialogue', 'NPCs, dialogue with choices, quests and rewards'], ['apps', 'Making apps', 'App mode, pages, data, lists and forms'], ['camera-lighting', 'Cameras, lighting and effects', 'Virtual cameras, lights, post-processing'], ['animation-audio', 'Animation and audio', 'Tweens, the Animator, sprite sheets, sounds'], ['saving-online', 'Saving, online and the phone', 'Save files, PlayFab, Photon, notifications']] },
  { sec: 'Code', items: [['scripting', 'Scripting with JavaScript', 'Custom Script components and helpers'], ['engine-api', 'Using the engine from code', 'Engine, Scene, Entity, input, audio, events'], ['custom-components', 'Writing your own components', 'registerBehavior: params, hooks, drawing UI'], ['plugins-mods', 'Plugins and mods', 'Plugins and mods players add to your game']] },
  { sec: 'Ship it', items: [['publishing', 'Publishing your game', 'A link, a web app, or the App Store and Google Play'], ['accounts', 'Accounts and cloud sync', 'Your profile, signing in, syncing between devices'], ['troubleshooting', 'Troubleshooting and FAQ', 'When something doesn’t work the way you expect']] },
];

export default function LearnScreen({ T, onGuide }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, gap: 10, paddingBottom: 110 }}>
      <H1 T={T}>Learn</H1>
      <Sub T={T}>Step-by-step guides to everything in Pocket Engine.</Sub>
      {GUIDES.map((g) => (
        <View key={g.sec} style={{ gap: 8 }}>
          <H2 T={T}>{g.sec}</H2>
          {g.items.map(([id, title, sub]) => (
            <Tap key={id} label={title} onPress={() => onGuide(id, title)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 16, padding: 14 }}>
              <Icon name="book" color={T.accent} size={22} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: T.text, fontWeight: '800', fontSize: 15 }}>{title}</Text><Text numberOfLines={1} style={{ color: T.sub, fontSize: 13 }}>{sub}</Text></View>
              <Icon name="next" color={T.sub} size={16} />
            </Tap>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
