import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Search, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { CATEGORIES } from '../../src/lib/types';

export default function Categories() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = CATEGORIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[text.h2, { color: colors.encre }]}>Toutes les catégories</Text>
        <Pressable style={styles.close} onPress={() => router.back()}>
          <X size={20} color={colors.encre} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher une catégorie…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {filtered.map(c => (
            <Pressable
              key={c.key}
              style={[styles.card, shadow.card]}
              onPress={() => router.push({ pathname: '/client/new-request', params: { category: c.key } })}
            >
              <Text style={{ fontSize: 32 }}>{c.emoji}</Text>
              <Text style={[text.small, { color: colors.encre, textAlign: 'center' }]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  close: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  scroll: { padding: spacing.xl, paddingTop: 0, paddingBottom: spacing.xxxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: { flexBasis: 100, flexGrow: 1, maxWidth: 180, height: 120, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
});
