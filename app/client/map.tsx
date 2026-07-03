import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Navigation, Wrench, Star, ShieldCheck, Crosshair } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyProviders, resolveMyLocation, LOME } from '../../src/lib/api';
import { getCurrentPosition } from '../../src/lib/geolocation';
import { MarkersMap, type MapMarker } from '../../src/components/MarkersMap';
import { CATEGORIES, type Provider, type GeoPoint } from '../../src/lib/types';

type DistanceFilter = 'all' | 'near' | 'top';

export default function MapScreen() {
  const router = useRouter();
  const [center, setCenter] = useState<GeoPoint>(LOME);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('all');

  const load = useCallback(async (anchor: GeoPoint) => {
    setLoading(true);
    try {
      setProviders(await fetchNearbyProviders(undefined, anchor, 25));
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve the user's real location once on mount (GPS -> saved address -> Lomé)
  // instead of always centering on a fixed point.
  useEffect(() => {
    (async () => {
      const point = await resolveMyLocation();
      setCenter(point);
      load(point);
    })();
  }, [load]);

  async function recenter() {
    setLocating(true);
    const point = await getCurrentPosition();
    setLocating(false);
    if (!point) return;
    setCenter(point);
    load(point);
  }

  const filtered = useMemo(() => {
    let list = providers;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (CATEGORIES.find(c => c.key === p.category)?.label.toLowerCase().includes(q) ?? false)
      );
    }
    if (distanceFilter === 'near') list = list.filter(p => p.distanceKm <= 2);
    if (distanceFilter === 'top') list = list.filter(p => p.rating >= 4);
    return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [providers, search, distanceFilter]);

  const markers: MapMarker[] = filtered
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
        <MarkersMap center={center} markers={markers} fill />

        {/* Search bar over map */}
        <View style={styles.searchBar}>
          <View style={styles.searchInput}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchField}
              placeholder="Rechercher un prestataire ou une catégorie…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <Pressable style={styles.filterBtn} onPress={recenter} disabled={locating}>
            {locating ? <ActivityIndicator size="small" color={colors.vert} /> : <Crosshair size={18} color={colors.encre} />}
          </Pressable>
        </View>

        {/* Filter chips */}
        <View style={styles.filterChips}>
          {([
            { key: 'all', label: 'Tous' },
            { key: 'near', label: '< 2 km' },
            { key: 'top', label: '4★+' },
          ] as { key: DistanceFilter; label: string }[]).map((f) => (
            <Pressable
              key={f.key}
              style={[styles.fchip, distanceFilter === f.key && styles.fchipActive]}
              onPress={() => setDistanceFilter(f.key)}
            >
              <Text style={[text.label, { color: distanceFilter === f.key ? colors.white : colors.encre }]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.sheet, shadow.card]}>
        <View style={styles.handle} />
        <View style={styles.sheetHead}>
          <Text style={[text.h3, { color: colors.encre }]}>
            {loading ? 'Recherche…' : `${filtered.length} prestataire${filtered.length > 1 ? 's' : ''} autour`}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.lg }} />
        ) : filtered.length === 0 ? (
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg }]}>
            Aucun prestataire trouvé dans cette zone.
          </Text>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            {filtered.map((p, i) => (
              <Pressable key={p.id} style={[styles.row, i === 0 && styles.rowActive]} onPress={() => router.push({ pathname: '/shared/provider-profile', params: { id: p.id } })}>
                <View style={styles.iconWrap}><Wrench size={18} color={colors.vert} /></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{p.name}</Text>
                    {p.verified && <ShieldCheck size={14} color={colors.vert} />}
                  </View>
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
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  mapLayer: { flex: 1 },
  searchBar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48, ...shadow.card },
  searchField: { flex: 1, ...text.body, color: colors.encre },
  filterBtn: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  filterChips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fchip: { paddingHorizontal: spacing.md, height: 32, borderRadius: radii.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  fchipActive: { backgroundColor: colors.encre },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: 340 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  rowActive: { borderColor: colors.vert, borderWidth: 2 },
  iconWrap: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  navBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
