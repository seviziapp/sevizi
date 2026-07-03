import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Navigation, ChevronRight, Crosshair } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyRequests, resolveMyLocation, LOME } from '../../src/lib/api';
import { getCurrentPosition } from '../../src/lib/geolocation';
import { MarkersMap, type MapMarker } from '../../src/components/MarkersMap';
import { CATEGORIES, type ServiceRequest, type ServiceCategory, type GeoPoint } from '../../src/lib/types';

const TOP_CATS = CATEGORIES.slice(0, 5);

export default function ProviderMap() {
  const router = useRouter();
  const [center, setCenter] = useState<GeoPoint>(LOME);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<ServiceCategory | null>(null);

  const load = useCallback(async (anchor: GeoPoint, cat: ServiceCategory | null) => {
    setLoading(true);
    try {
      setRequests(await fetchNearbyRequests(cat ?? undefined, anchor, 30));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Tracks the latest resolved center without re-triggering the filter effect
  // below whenever it changes (only `filter` should do that).
  const centerRef = useRef(center);
  const readyRef = useRef(false);

  // Resolve the provider's real location once on mount (GPS -> saved address ->
  // Lomé) so "demandes proches" actually reflects where they are.
  useEffect(() => {
    (async () => {
      const point = await resolveMyLocation();
      centerRef.current = point;
      setCenter(point);
      readyRef.current = true;
      load(point, filter);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Refetch when the category filter changes — but not on the initial mount,
  // which is already handled by the location-resolution effect above (running
  // this unconditionally on mount would fire a wasted fetch centered on the
  // default Lomé point before GPS has resolved).
  useEffect(() => {
    if (!readyRef.current) return;
    load(centerRef.current, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function recenter() {
    setLocating(true);
    const point = await getCurrentPosition();
    setLocating(false);
    if (!point) return;
    centerRef.current = point;
    setCenter(point);
    load(point, filter);
  }

  const sorted = useMemo(
    () => [...requests].sort((a, b) => (a.urgent === b.urgent ? (a.distanceKm ?? 0) - (b.distanceKm ?? 0) : a.urgent ? -1 : 1)),
    [requests]
  );

  const cat = selected ? CATEGORIES.find(c => c.key === selected.category) : null;

  const markers: MapMarker[] = sorted
    .filter(r => r.location && Number.isFinite(r.location.lat))
    .map(r => ({
      id: r.id, lat: r.location.lat, lng: r.location.lng,
      emoji: CATEGORIES.find(c => c.key === r.category)?.emoji, urgent: r.urgent,
      onPress: () => setSelected(r),
    }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.mapLayer}>
        <MarkersMap center={center} markers={markers} fill />
        <View style={styles.topOverlay}>
          <Text style={[text.bodyMd, { color: colors.encre }]}>
            {loading ? 'Recherche…' : `${requests.length} demande${requests.length > 1 ? 's' : ''} dans votre zone`}
          </Text>
        </View>
        <Pressable style={styles.locateBtn} onPress={recenter} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={colors.vert} /> : <Crosshair size={18} color={colors.encre} />}
        </Pressable>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, !filter && styles.chipActive]} onPress={() => setFilter(null)}>
            <Text style={[text.small, { color: !filter ? colors.white : colors.encre }]}>Toutes</Text>
          </Pressable>
          {TOP_CATS.map(c => (
            <Pressable key={c.key} style={[styles.chip, filter === c.key && styles.chipActive]} onPress={() => setFilter(c.key)}>
              <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
              <Text style={[text.small, { color: filter === c.key ? colors.white : colors.encre }]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Bottom sheet: selected request or list */}
      <View style={[styles.sheet, shadow.card]}>
        <View style={styles.handle} />
        {selected ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.selectedHead}>
              <View style={styles.catIcon}>
                <Text style={{ fontSize: 22 }}>{cat?.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.h3, { color: colors.encre }]}>{cat?.label}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{selected.description}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={styles.closeBtn}>
                <Text style={[text.label, { color: colors.textMuted }]}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.selectedMeta}>
              <Navigation size={13} color={colors.textMuted} />
              <Text style={[text.small, { color: colors.textMuted }]}>
                {selected.locationLabel}{selected.distanceKm != null ? ` · ${selected.distanceKm.toFixed(1)} km` : ''}
              </Text>
              {selected.urgent && <View style={styles.urgentBadge}><Text style={[text.label, { color: colors.terre }]}>⚡ URGENT</Text></View>}
            </View>
            <Pressable
              style={styles.offerBtn}
              onPress={() => router.push({ pathname: '/provider/send-offer', params: { requestId: selected.id, description: selected.description, category: selected.category } })}
            >
              <Text style={[text.bodyMd, { color: colors.white }]}>Faire une offre Express</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.lg }} />
        ) : sorted.length === 0 ? (
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg }]}>
            Aucune demande dans votre zone pour l'instant.
          </Text>
        ) : (
          <>
            <Text style={[text.h3, { color: colors.encre, marginBottom: spacing.md }]}>Demandes proches</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              {sorted.map((r, i) => {
                const c = CATEGORIES.find(cc => cc.key === r.category);
                return (
                  <Pressable key={r.id} style={[styles.row, i === 0 && styles.rowFirst]} onPress={() => setSelected(r)}>
                    <Text style={{ fontSize: 18 }}>{c?.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyMd, { color: colors.encre }]}>{c?.label}</Text>
                      {r.distanceKm != null && (
                        <Text style={[text.label, { color: colors.textMuted }]}>{r.distanceKm.toFixed(1)} km</Text>
                      )}
                    </View>
                    {r.urgent && <View style={styles.urgentBadge}><Text style={[text.label, { color: colors.terre }]}>URGENT</Text></View>}
                    <ChevronRight size={16} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  mapLayer: { flex: 1 },
  topOverlay: { position: 'absolute', top: spacing.lg, alignSelf: 'center', backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, ...shadow.card },
  locateBtn: { position: 'absolute', top: spacing.lg, right: spacing.lg, width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  chipsScroll: { position: 'absolute', bottom: spacing.lg, left: 0, right: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, height: 34, borderRadius: radii.pill, backgroundColor: colors.white, ...shadow.card },
  chipActive: { backgroundColor: colors.encre },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, maxHeight: 340 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  selectedHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  catIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selectedMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  urgentBadge: { backgroundColor: '#F8E2DA', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  offerBtn: { backgroundColor: colors.vert, borderRadius: radii.md, height: 52, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  rowFirst: { borderTopWidth: 0 },
});
