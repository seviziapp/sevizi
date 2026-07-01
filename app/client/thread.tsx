import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wrench, MapPin, Navigation, Send } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { LOME, fetchMessages, sendMessage, resolveActiveThread } from '../../src/lib/api';

type Bubble = { id: string; me: boolean; text?: string; map?: boolean; time: string };

export default function Thread() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string; providerName?: string }>();
  const [requestId, setRequestId] = useState<string | undefined>(params.requestId);
  const [otherName, setOtherName] = useState<string>(params.providerName ?? 'Prestataire');
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  function toBubbles(data: { id: string; fromMe: boolean; text: string; createdAt: string }[]): Bubble[] {
    return data.map(m => ({
      id: m.id, me: m.fromMe, text: m.text,
      time: new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If we weren't given a request id, fall back to the active mission thread.
      let rid = params.requestId;
      if (!rid) {
        const active = await resolveActiveThread().catch(() => null);
        if (active) { rid = active.requestId; if (!params.providerName) setOtherName(active.otherName); }
      }
      if (cancelled) return;
      setRequestId(rid);
      if (rid) {
        try { setMsgs(toBubbles(await fetchMessages(rid))); } catch {}
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [params.requestId]);

  // poll for new incoming messages
  useEffect(() => {
    if (!requestId) return;
    const t = setInterval(() => { fetchMessages(requestId).then(d => setMsgs(toBubbles(d))).catch(() => {}); }, 8000);
    return () => clearInterval(t);
  }, [requestId]);

  async function send() {
    if (!draft.trim() || !requestId || sending) return;
    const body = draft.trim();
    setDraft('');
    setSending(true);
    const tempId = String(Date.now());
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMsgs(prev => [...prev, { id: tempId, me: true, text: body, time: now }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      await sendMessage(requestId, body);
      setMsgs(toBubbles(await fetchMessages(requestId)));
    } catch {
      setMsgs(prev => prev.filter(m => m.id !== tempId));
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  function shareLocation() {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setMsgs(prev => [...prev, { id: String(Date.now()), me: true, map: true, time: now }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <View style={styles.avatar}><Wrench size={18} color={colors.vert} /></View>
        <View>
          <Text style={[text.bodyMd, { color: colors.encre }]}>{otherName}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
        ) : !requestId ? (
          <View style={styles.empty}>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              La messagerie s'ouvre une fois une mission en cours.{'\n'}Acceptez une offre pour discuter avec le prestataire.
            </Text>
          </View>
        ) : msgs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucun message. Commencez la conversation !
            </Text>
          </View>
        ) : (
          msgs.map(m => (
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
          ))
        )}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.composer}>
          <Pressable style={styles.locBtn} onPress={shareLocation}>
            <MapPin size={20} color={colors.vert} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder={requestId ? 'Message…' : 'Aucune conversation active'}
            placeholderTextColor={colors.textMuted}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            editable={!!requestId}
          />
          <Pressable style={[styles.sendBtn, (!requestId || sending) && { opacity: 0.5 }]} onPress={send} disabled={!requestId || sending}>
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
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingVertical: spacing.lg },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl },
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
