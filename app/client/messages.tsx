import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchThreads } from '../../src/lib/api';

type Thread = {
  id: string;
  name: string;
  lastMsg: string;
  time: string;
  unread: number;
  online: boolean;
  emoji: string;
  status: string | null;
};

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThreads()
      .then((data: any[]) => {
        setThreads(data.map(t => ({
          id: t.id,
          name: t.providerName ?? 'Prestataire',
          lastMsg: t.lastMessage ?? '',
          time: t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '',
          unread: t.unreadCount ?? 0,
          online: false,
          emoji: '💬',
          status: null,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalUnread = threads.reduce((s, t) => s + t.unread, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[text.h2, { color: colors.encre }]}>Messages</Text>
        {totalUnread > 0 && (
          <View style={styles.totalBadge}>
            <Text style={[text.label, { color: colors.white }]}>{totalUnread}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
        ) : threads.length === 0 ? (
          <View style={styles.empty}>
            <MessageCircle size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucune conversation pour l'instant.{'\n'}Acceptez une offre pour commencer à échanger.
            </Text>
          </View>
        ) : (
          threads.map(t => (
            <Pressable
              key={t.id}
              style={[styles.row, shadow.card]}
              onPress={() => router.push({ pathname: '/shared/thread', params: { requestId: t.id, otherName: t.name } })}
            >
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
                </View>
                {t.online && <View style={styles.onlineDot} />}
              </View>

              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.topRow}>
                  <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{t.name}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>{t.time}</Text>
                </View>
                <Text
                  style={[text.small, { color: t.unread > 0 ? colors.encre : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {t.lastMsg || '—'}
                </Text>
              </View>

              {t.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={[text.label, { color: colors.white, fontSize: 10 }]}>{t.unread}</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  totalBadge: { backgroundColor: colors.terre, borderRadius: radii.pill, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.vert, borderWidth: 2, borderColor: colors.white },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxxl * 2 },
});
