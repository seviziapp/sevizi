import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, ChevronRight, Inbox, Plus } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchMyRequestsWithOffers } from '../../src/lib/api';
import { CATEGORIES, type ServiceRequest } from '../../src/lib/types';

type Req = ServiceRequest & { offersCount: number };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ouverte:  { label: 'Ouverte',     color: colors.vert },
  en_cours: { label: 'En cours',    color: colors.soleil },
  terminee: { label: 'Terminée',    color: colors.textMuted },
  annulee:  { label: 'Annulée',     color: colors.terre },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function MyRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRequests(await fetchMyRequestsWithOffers()); } catch {} finally { setLoading(false); }
  }, []);

  // refresh every time the screen comes into focus (e.g. after posting a request)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.replace('/client/home')}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes demandes</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : requests.length === 0 ? (
        <View style={styles.empty}>
          <Inbox size={48} color={colors.border} />
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Vous n'avez pas encore publié de demande.
          </Text>
          <Pressable style={styles.cta} onPress={() => router.push('/client/new-request')}>
            <Plus size={18} color={colors.white} />
            <Text style={[text.bodyMd, { color: colors.white }]}>Nouvelle demande</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.vert} />}
        >
          {requests.map(r => {
            const cat = CATEGORIES.find(c => c.key === r.category);
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.ouverte;
            return (
              <Pressable
                key={r.id}
                style={[styles.card, shadow.card]}
                onPress={() => r.status === 'ouverte'
                  ? router.push({ pathname: '/client/offers', params: { requestId: r.id } })
                  : router.push('/client/job-status')}
              >
                <View style={styles.catIcon}><Text style={{ fontSize: 22 }}>{cat?.emoji ?? '🔧'}</Text></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{r.description}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    {cat?.label} · {timeAgo(r.createdAt)}
                  </Text>
                  <View style={styles.badges}>
                    <View style={[styles.statusBadge, { borderColor: st.color }]}>
                      <Text style={[text.label, { color: st.color }]}>{st.label.toUpperCase()}</Text>
                    </View>
                    {r.status === 'ouverte' && (
                      <View style={[styles.offersBadge, r.offersCount > 0 && styles.offersBadgeActive]}>
                        <Text style={[text.label, { color: r.offersCount > 0 ? colors.white : colors.textMuted }]}>
                          {r.offersCount} offre{r.offersCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xxl },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.vert, paddingHorizontal: spacing.xl, height: 48, borderRadius: radii.md },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  catIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  statusBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  offersBadge: { backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  offersBadgeActive: { backgroundColor: colors.vert },
});
