import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, Search, Navigation, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { saveMyAddress } from '../../src/lib/api';
import { getCurrentPosition } from '../../src/lib/geolocation';
import type { GeoPoint } from '../../src/lib/types';

// Approximate centers for each quartier — good enough for "nearby" matching
// when a user picks a named area instead of sharing live GPS.
const QUARTIER_COORDS: Record<string, GeoPoint> = {
  'Bè-Kpota': { lat: 6.1719, lng: 1.2310 },
  'Tokoin': { lat: 6.1740, lng: 1.2260 },
  'Adidogomé': { lat: 6.1850, lng: 1.1850 },
  'Hédzranawoé': { lat: 6.1600, lng: 1.2450 },
  'Baguida': { lat: 6.1300, lng: 1.3450 },
  'Agoè-Nyivé': { lat: 6.2200, lng: 1.1900 },
  'Kodjoviakopé': { lat: 6.1280, lng: 1.2200 },
  'Nyékonakpoè': { lat: 6.1250, lng: 1.2150 },
  'Ambassade': { lat: 6.1500, lng: 1.2150 },
  'Djidjolé': { lat: 6.1950, lng: 1.2100 },
};
const QUARTIERS = Object.keys(QUARTIER_COORDS);

export default function LocationScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [gpsPoint, setGpsPoint] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = QUARTIERS.filter(q => q.toLowerCase().includes(search.toLowerCase()));

  async function useGPS() {
    setError('');
    setLocating(true);
    const point = await getCurrentPosition();
    setLocating(false);
    if (!point) {
      setError('Localisation indisponible. Autorisez l\'accès à votre position ou choisissez un quartier.');
      return;
    }
    setGpsPoint(point);
    setSelected('Ma position GPS');
    setSearch('');
  }

  async function confirm() {
    if (!selected) return;
    const label = selected === 'Ma position GPS' ? 'Ma position GPS' : `${selected}, Lomé`;
    const point = selected === 'Ma position GPS' ? gpsPoint ?? undefined : QUARTIER_COORDS[selected];
    setSaving(true);
    try { await saveMyAddress(label, point); } catch {}
    setSaving(false);
    router.replace('/client/home');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <MapPin size={32} color={colors.vert} />
        </View>

        <Text style={[text.h1, { color: colors.encre }]}>Votre quartier</Text>
        <Text style={[text.body, { color: colors.textMuted }]}>
          Pour trouver des prestataires proches, indiquez votre zone dans Lomé.
        </Text>

        <View style={styles.searchBox}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un quartier…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {/* GPS option */}
        <Pressable style={styles.gpsRow} onPress={useGPS} disabled={locating}>
          <View style={[styles.gpsIcon, selected === 'Ma position GPS' && { backgroundColor: colors.surface }]}>
            {locating ? <ActivityIndicator size="small" color={colors.vert} /> : <Navigation size={18} color={colors.vert} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Utiliser ma position GPS</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>Localisation précise en temps réel</Text>
          </View>
          {selected === 'Ma position GPS' && !locating && (
            <View style={styles.check}><Text style={[text.label, { color: colors.vert }]}>✓</Text></View>
          )}
        </Pressable>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {filtered.map((q, i) => (
              <Pressable
                key={q}
                style={[styles.item, i < filtered.length - 1 && styles.itemBorder, selected === q && styles.itemActive]}
                onPress={() => { setSelected(q); setError(''); }}
              >
                <MapPin size={16} color={selected === q ? colors.vert : colors.textMuted} />
                <Text style={[text.body, { color: colors.encre, flex: 1 }]}>{q}, Lomé</Text>
                {selected === q && <Text style={[text.label, { color: colors.vert }]}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <Button
          label="Confirmer"
          icon={<ArrowRight size={20} color={colors.white} />}
          onPress={confirm}
          loading={saving}
          disabled={!selected}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  iconWrap: { width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 52,
  },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  gpsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  gpsIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.terre, fontSize: 13 },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemActive: { backgroundColor: '#F2FBF6' },
});
