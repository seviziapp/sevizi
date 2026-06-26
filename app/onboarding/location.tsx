import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, Search, Navigation, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';

const QUARTIERS = [
  'Bè-Kpota', 'Tokoin', 'Adidogomé', 'Hédzranawoé', 'Baguida',
  'Agoè-Nyivé', 'Kodjoviakopé', 'Nyékonakpoè', 'Ambassade', 'Djidjolé',
];

export default function LocationScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');

  const filtered = QUARTIERS.filter(q => q.toLowerCase().includes(search.toLowerCase()));

  function confirm() {
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
        <Pressable style={styles.gpsRow} onPress={() => { setSelected('Ma position GPS'); setSearch(''); }}>
          <View style={[styles.gpsIcon, selected === 'Ma position GPS' && { backgroundColor: colors.surface }]}>
            <Navigation size={18} color={colors.vert} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Utiliser ma position GPS</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>Localisation précise en temps réel</Text>
          </View>
          {selected === 'Ma position GPS' && (
            <View style={styles.check}><Text style={[text.label, { color: colors.vert }]}>✓</Text></View>
          )}
        </Pressable>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {filtered.map((q, i) => (
              <Pressable
                key={q}
                style={[styles.item, i < filtered.length - 1 && styles.itemBorder, selected === q && styles.itemActive]}
                onPress={() => setSelected(q)}
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
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemActive: { backgroundColor: '#F2FBF6' },
});
