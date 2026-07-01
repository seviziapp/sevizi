import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal, Navigation, Wrench, Star, Send } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyProviders, LOME } from '../../src/lib/api';
import { MarkersMap, type MapMarker } from '../../src/components/MarkersMap';
import { CATEGORIES, type Provider } from '../../src/lib/types';

export default function MapScreen() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    fetchNearbyProviders().then(setProviders).catch(() => {});
  }, []);

  const markers: MapMarker[] = providers
    .filter(p => p.location && Number.isFinite(p.location.lat))
    .map(p => ({
      id: p.id, lat: p.location.lat, lng: p.location.lng,
      emoji: CATEGORIES.find(c => c.key === p.category)?.emoji ?? '🔧',
      onPress: () => router.push({ pathname: '/shared/provider-profile', params: { id: p.id } }),
    }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Map layer */}
      <View style={styles.mapLayer}>
        <MarkersMap center={LOME} markers={markers} fill />

        {/* Search bar over map */}
        <View style={styles.searchBar}>
          <View style={styles.searchInput}>
            <Search size={18} color={colors.textMuted} />
            <Text style={[text.body, { color: colors.textMuted }]}>Plombiers proches</Text>
          </View>
          <Pressable style={styles.filterBtn}>
            <SlidersHorizontal size={18} color={colors.encre} />
          </Pressable>
        </View>

        {/* Filter chips */}
        <View style={styles.filterChips}>
          {['Tous', '< 2 km', '4★+'].map((f, i) => (
            <View key={f} style={[styles.fchip, i === 0 && styles.fchipActive]}>
              <Text style={[text.label, { color: i === 0 ? colors.white : colors.encre }]}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.sheet, shadow.card]}>
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Text style={[text.h3, { color: colors.encre }]}>{providers.length} prestataires autour</Text>
          <Pressable><Text style={[text.small, { color: colors.vert }]}>Trier</Text></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          {providers.map((p, i) => (
            <Pressable key={p.id} style={[styles.row, i === 0 && styles.rowActive]} onPress={() => router.push({ pathname: '/shared/provider-profile', params: { id: p.id } })}>
              <View style={styles.iconWrap}><Wrench size={18} color={colors.vert} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{p.name}</Text>
                <View style={styles.metaRow}>
                  <Star size={12} color={colors.soleil} fill={colors.soleil} />
                  <Text style={[text.label, { color: colors.textMuted }]}>{p.rating.toFixed(1)}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>· {p.distanceKm.toFixed(1)} km</Text>
                </View>
              </View>
              <View style={styles.navBtn}><Navigation size={18} color={colors.vert} /></View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  mapLayer: { flex: 1 },
  gridFallback: { flex: 1, backgroundColor: '#DDEFE5' },
  marker: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.encre, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  userDot: { position: 'absolute', top: 280, left: 160, width: 18, height: 18, borderRadius: 9, backgroundColor: '#2D7FF9', borderWidth: 3, borderColor: colors.white },
  searchBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48, ...shadow.card },
  filterBtn: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  filterChips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fchip: { paddingHorizontal: spacing.md, height: 32, borderRadius: radii.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  fchipActive: { backgroundColor: colors.encre },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: 320 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  rowActive: { borderColor: colors.vert, borderWidth: 2 },
  iconWrap: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  navBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
