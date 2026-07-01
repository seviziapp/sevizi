import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { fetchNotifications, markAllNotificationsRead } from '../../src/lib/api';
import type { Notification } from '../../src/lib/types';

const ICONS: Record<string, string> = {
  offer: '💬',
  accepted: '✅',
  arrived: '📍',
  completed: '🏁',
  review: '⭐',
  system: '🔔',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

export default function Notifications() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    // Viewing the inbox marks everything read so the bell badge clears.
    fetchNotifications().then(ns => {
      setNotifs(ns);
      if (ns.some(n => !n.read)) markAllNotificationsRead().catch(() => {});
    }).catch(() => {});
    const t = setInterval(() => { fetchNotifications().then(setNotifs).catch(() => {}); }, 15000);
    return () => clearInterval(t);
  }, []);

  async function readAll() {
    await markAllNotificationsRead();
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  }

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <Pressable style={styles.readAll} onPress={readAll}>
            <CheckCheck size={18} color={colors.vert} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBanner}>
          <Bell size={14} color={colors.vertDark} />
          <Text style={[text.small, { color: colors.vertDark }]}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {notifs.length === 0 && (
          <View style={styles.empty}>
            <Bell size={40} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>Aucune notification pour l'instant.</Text>
          </View>
        )}
        {notifs.map(n => (
          <Pressable
            key={n.id}
            style={[styles.card, !n.read && styles.cardUnread]}
            onPress={() => n.actionRoute && router.push(n.actionRoute as any)}
          >
            <View style={styles.iconCircle}>
              <Text style={{ fontSize: 22 }}>{ICONS[n.type] ?? '🔔'}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{n.title}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{n.body}</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>{timeAgo(n.createdAt)}</Text>
            </View>
            {!n.read && <View style={styles.dot} />}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  readAll: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  unreadBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardUnread: { borderColor: colors.vert, backgroundColor: '#F9FEFC' },
  iconCircle: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.vert, marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
});
