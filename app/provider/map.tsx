import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Navigation, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchNearbyRequests, LOME } from '../../src/lib/api';
import { MarkersMap, type MapMarker } from '../../src/components/MarkersMap';
import { CATEGORIES, type ServiceRequest } from '../../src/lib/types';

export default function ProviderMap() {
  const router = useRouter();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [selected, setSelected] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    fetchNearbyRequests().then(setRequests).catch(() => {});
  }, []);

  const cat = selected ? CATEGORIES.find(c => c.key === selected.category) : null;

  const markers: MapMarker[] = requests
    .filter(r => r.location && Number.isFinite(r.location.lat))
    .map(r => ({
      id: r.id, lat: r.location.lat, lng: r.location.lng,
      emoji: CATEGORIES.find(c => c.key === r.category)?.emoji, urgent: r.urgent,
      onPress: () => setSelected(r),
    }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.mapLayer}>
        <MarkersMap center={LOME} markers={markers} fill />
        <View style={styles.topOverlay}>
          <Text style={[text.bodyMd, { color: colors.encre }]}>
            {requests.length} demande{requests.length > 1 ? 's' : ''} dans votre zone
          </Text>
        </View>
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
              <Text style={[text.small, { color: colors.textMuted }]}>{selected.locationLabel}</Text>
              {selected.urgent && <View style={styles.urgentBadge}><Text style={[text.label, { color: colors.terre }]}>⚡ URGENT</Text></View>}
            </View>
            <Pressable
              style={styles.offerBtn}
              onPress={() => router.push({ pathname: '/provider/send-offer', params: { requestId: selected.id, description: selected.description, category: selected.category } })}
            >
              <Text style={[text.bodyMd, { color: colors.white }]}>Faire une offre Express</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[text.h3, { color: colors.encre, marginBottom: spacing.md }]}>Demandes proches</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
              {requests.map((r, i) => {
                const c = CATEGORIES.find(cat => cat.key === r.category);
                return (
                  <Pressable key={r.id} style={[styles.row, i === 0 && styles.rowFirst]} onPress={() => setSelected(r)}>
                    <Text style={{ fontSize: 18 }}>{c?.emoji}</Text>
                    <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{c?.label}</Text>
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
  gridFallback: { flex: 1, backgroundColor: '#DDEEE6' },
  pin: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.encre, alignItems: 'center', justifyContent: 'center' },
  pinUrgent: { borderColor: colors.terre, backgroundColor: '#F8E2DA' },
  providerDot: { position: 'absolute', top: 280, left: 160, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.vert, borderWidth: 3, borderColor: colors.white },
  providerDotRing: { position: 'absolute', top: 273, left: 153, width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.vert, opacity: 0.3 },
  topOverlay: { position: 'absolute', top: spacing.lg, alignSelf: 'center', backgroundColor: colors.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, ...shadow.card },
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
