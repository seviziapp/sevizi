import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

const THREADS = [
  {
    id: 't1',
    name: 'Kossi Plomberie',
    lastMsg: 'Je suis en route, 10 min.',
    time: '10:04',
    unread: 1,
    online: true,
    emoji: '🔧',
    status: 'En route',
  },
  {
    id: 't2',
    name: 'Salon Afi',
    lastMsg: 'D\'accord, je confirme pour demain à 9h.',
    time: 'Hier',
    unread: 0,
    online: true,
    emoji: '✂️',
    status: null,
  },
  {
    id: 't3',
    name: 'Élec Express',
    lastMsg: 'Mission terminée. Merci pour votre confiance !',
    time: 'Lun',
    unread: 0,
    online: false,
    emoji: '⚡',
    status: 'Terminée',
  },
  {
    id: 't4',
    name: 'Transport Koffi',
    lastMsg: 'Envoyez-moi l\'adresse exacte svp.',
    time: 'Dim',
    unread: 2,
    online: false,
    emoji: '🚗',
    status: null,
  },
];

export default function Messages() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[text.h2, { color: colors.encre }]}>Messages</Text>
        {THREADS.some(t => t.unread > 0) && (
          <View style={styles.totalBadge}>
            <Text style={[text.label, { color: colors.white }]}>
              {THREADS.reduce((s, t) => s + t.unread, 0)}
            </Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {THREADS.length === 0 && (
          <View style={styles.empty}>
            <MessageCircle size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucune conversation pour l'instant.{'\n'}Acceptez une offre pour commencer à échanger.
            </Text>
          </View>
        )}
        {THREADS.map((t, i) => (
          <Pressable
            key={t.id}
            style={[styles.row, shadow.card]}
            onPress={() => router.push({ pathname: '/client/thread', params: { providerName: t.name } })}
          >
            {/* Avatar */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
              </View>
              {t.online && <View style={styles.onlineDot} />}
            </View>

            {/* Content */}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.topRow}>
                <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{t.name}</Text>
                <Text style={[text.label, { color: colors.textMuted }]}>{t.time}</Text>
              </View>
              <Text
                style={[text.small, { color: t.unread > 0 ? colors.encre : colors.textMuted }]}
                numberOfLines={1}
              >
                {t.lastMsg}
              </Text>
              {t.status && (
                <View style={[styles.statusPill, t.status === 'En route' && styles.statusActive]}>
                  <Text style={[text.label, { color: t.status === 'En route' ? colors.vert : colors.textMuted }]}>
                    {t.status === 'En route' ? '🚗 ' : '🏁 '}{t.status}
                  </Text>
                </View>
              )}
            </View>

            {/* Unread badge */}
            {t.unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={[text.label, { color: colors.white, fontSize: 10 }]}>{t.unread}</Text>
              </View>
            )}
          </Pressable>
        ))}
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
  statusPill: { alignSelf: 'flex-start', backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.pill },
  statusActive: { backgroundColor: '#F2FBF6' },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: spacing.lg, paddingTop: spacing.xxxl * 2 },
});
