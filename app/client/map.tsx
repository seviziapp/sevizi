import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, SlidersHorizontal, Navigation, Wrench, Star, Send } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyProviders, LOME } from '../../src/lib/api';
import type { Provider } from '../../src/lib/types';

// react-native-maps is native-only; on web we render a styled placeholder grid
// so the screen still composes. The real device build shows live pins.
let MapView: any, Marker: any;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

export default function MapScreen() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    fetchNearbyProviders('plomberie').then(setProviders).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Map layer */}
      <View style={styles.mapLayer}>
        {Platform.OS !== 'web' && MapView ? (
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: LOME.lat, longitude: LOME.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          >
            {providers.map((p) => (
              <Marker key={p.id} coordinate={{ latitude: p.location.lat, longitude: p.location.lng }} title={p.name}>
                <View style={styles.marker}><Wrench size={14} color={colors.white} /></View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.gridFallback}>
            {providers.map((p, i) => (
              <View key={p.id} style={[styles.marker, { position: 'absolute', top: 120 + i * 90, left: 60 + i * 80 }]}>
                <Wrench size={14} color={colors.white} />
              </View>
            ))}
            <View style={styles.userDot} />
          </View>
        )}

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
            <Pressable key={p.id} style={[styles.row, i === 0 && styles.rowActive]} onPress={() => router.push('/client/offers')}>
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
