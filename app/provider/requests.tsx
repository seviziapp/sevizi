import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, Clock, ChevronRight, SlidersHorizontal } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyRequests } from '../../src/lib/api';
import { CATEGORIES, type ServiceRequest, type ServiceCategory } from '../../src/lib/types';

export default function ProviderRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<ServiceCategory | null>(null);

  useEffect(() => {
    fetchNearbyRequests(filter ?? undefined).then(setRequests).catch(() => {});
  }, [filter]);

  const topCats = CATEGORIES.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[text.h2, { color: colors.encre }]}>Demandes proches</Text>
        <Pressable style={styles.filterBtn}>
          <SlidersHorizontal size={20} color={colors.encre} />
        </Pressable>
      </View>

      {/* Category filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable style={[styles.chip, !filter && styles.chipActive]} onPress={() => setFilter(null)}>
          <Text style={[text.small, { color: !filter ? colors.white : colors.encre }]}>Toutes</Text>
        </Pressable>
        {topCats.map(c => (
          <Pressable key={c.key} style={[styles.chip, filter === c.key && styles.chipActive]} onPress={() => setFilter(c.key)}>
            <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
            <Text style={[text.small, { color: filter === c.key ? colors.white : colors.encre }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {requests.length === 0 && (
          <View style={styles.empty}>
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucune demande dans votre zone pour l'instant.
            </Text>
          </View>
        )}
        {requests.map(r => (
          <RequestCard
            key={r.id}
            req={r}
            onPress={() => router.push({ pathname: '/provider/send-offer', params: { requestId: r.id, description: r.description, category: r.category } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RequestCard({ req, onPress }: { req: ServiceRequest; onPress: () => void }) {
  const cat = CATEGORIES.find(c => c.key === req.category);
  const mins = Math.round((Date.now() - new Date(req.createdAt).getTime()) / 60000);
  const offersCount = req.offersCount ?? 0;

  return (
    <Pressable style={[styles.card, shadow.card, req.urgent && styles.cardUrgent]} onPress={onPress}>
      <View style={styles.cardTop}>
        <View style={styles.catIcon}>
          <Text style={{ fontSize: 22 }}>{cat?.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{cat?.label}</Text>
            {req.urgent && (
              <View style={styles.urgentBadge}>
                <Text style={[text.label, { color: colors.terre }]}>⚡ URGENT</Text>
              </View>
            )}
          </View>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
            {req.description}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <MapPin size={13} color={colors.textMuted} />
          <Text style={[text.label, { color: colors.textMuted }]}>{req.locationLabel}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={13} color={colors.textMuted} />
          <Text style={[text.label, { color: colors.textMuted }]}>Il y a {mins} min</Text>
        </View>
        <View style={[styles.offersTag, offersCount === 0 && styles.offersTagNew]}>
          <Text style={[text.label, { color: offersCount === 0 ? colors.vert : colors.textMuted }]}>
            {offersCount === 0 ? '✦ Nouveau' : `${offersCount} offre${offersCount > 1 ? 's' : ''}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  filterBtn: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingTop: 0, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardUrgent: { borderColor: colors.terre },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  catIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  urgentBadge: { backgroundColor: '#F8E2DA', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offersTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: colors.surface },
  offersTagNew: { backgroundColor: '#F2FBF6' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl },
});
