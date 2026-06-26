import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Heart, RotateCcw } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchFavorites } from '../../src/lib/api';
import { ProviderCard } from '../../src/components/ProviderCard';
import { CATEGORIES, type Provider } from '../../src/lib/types';

export default function Favorites() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Provider[]>([]);

  useEffect(() => {
    fetchFavorites().then(setFavorites).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes favoris</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {favorites.length === 0 && (
          <View style={styles.empty}>
            <Heart size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Vous n'avez pas encore de prestataires favoris.
            </Text>
          </View>
        )}
        {favorites.map(p => (
          <View key={p.id} style={styles.cardWrap}>
            <ProviderCard
              provider={p}
              subtitle={CATEGORIES.find(c => c.key === p.category)?.label}
              onPress={() => router.push({ pathname: '/shared/provider-profile', params: { id: p.id } })}
            />
            {/* Rebook button */}
            <Pressable
              style={styles.rebookBtn}
              onPress={() => router.push({ pathname: '/client/new-request' })}
            >
              <RotateCcw size={16} color={colors.vert} />
              <Text style={[text.small, { color: colors.vert }]}>Recontacter</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  cardWrap: { gap: spacing.sm },
  rebookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert },
});
