import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wrench, MapPin, Navigation, Send } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { LOME } from '../../src/lib/api';

type Bubble = { id: string; me: boolean; text?: string; map?: boolean; time: string };

const SEED: Bubble[] = [
  { id: '1', me: false, text: 'Bonjour ! Je suis en route. Vous confirmez l\u2019emplacement exact ?', time: '10:02' },
  { id: '2', me: true, text: 'Oui, je vous partage le point.', time: '10:03' },
  { id: '3', me: true, map: true, time: '10:03' },
  { id: '4', me: false, text: 'Parfait, je vous trouve. À tout de suite 👍', time: '10:04' },
];

export default function Thread() {
  const router = useRouter();
  const { providerName } = useLocalSearchParams<{ providerName?: string }>();
  const [msgs, setMsgs] = useState<Bubble[]>(SEED);
  const [draft, setDraft] = useState('');

  function send() {
    if (!draft.trim()) return;
    setMsgs([...msgs, { id: String(Date.now()), me: true, text: draft, time: '10:05' }]);
    setDraft('');
  }

  function shareLocation() {
    setMsgs([...msgs, { id: String(Date.now()), me: true, map: true, time: '10:05' }]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <View style={styles.avatar}><Wrench size={18} color={colors.vert} /></View>
        <View>
          <Text style={[text.bodyMd, { color: colors.encre }]}>{providerName ?? 'Kossi Plomberie'}</Text>
          <View style={styles.online}>
            <View style={styles.onlineDot} />
            <Text style={[text.label, { color: colors.vert }]}>en ligne</Text>
          </View>
        </View>
      </View>

      <View style={styles.statusPill}>
        <Text style={[text.label, { color: colors.textMuted }]}>OFFRE ACCEPTÉE · 4 500 F</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {msgs.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.me ? styles.rowMe : styles.rowThem]}>
            <View style={[styles.bubble, m.me ? styles.bubbleMe : styles.bubbleThem]}>
              {m.map ? (
                <View style={styles.miniMap}>
                  <MapPin size={22} color={colors.white} fill={colors.vert} />
                  <View style={styles.miniCoord}>
                    <Navigation size={10} color={colors.creme} />
                    <Text style={[text.label, { color: colors.creme, fontSize: 10 }]}>
                      {LOME.lat.toFixed(4)}° N
                    </Text>
                  </View>
                </View>
              ) : (
                <Text style={[text.body, { color: m.me ? colors.white : colors.encre }]}>{m.text}</Text>
              )}
              <Text style={[text.label, { color: m.me ? '#BFE6D4' : colors.textMuted, marginTop: 4, fontSize: 10 }]}>
                {m.time}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <Pressable style={styles.locBtn} onPress={shareLocation}>
            <MapPin size={20} color={colors.vert} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
          />
          <Pressable style={styles.sendBtn} onPress={send}>
            <Send size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  online: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.vert },
  statusPill: { alignSelf: 'center', backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radii.pill, marginVertical: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  bubbleRow: { flexDirection: 'row' },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', padding: spacing.md, borderRadius: radii.lg },
  bubbleMe: { backgroundColor: colors.vert, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  miniMap: { width: 160, height: 100, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  miniCoord: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.encre, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.sm },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
  locBtn: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, height: 44, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingHorizontal: spacing.lg, ...text.body, color: colors.encre },
  sendBtn: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
});
