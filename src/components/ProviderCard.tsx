import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Wrench, Star, MapPin, ShieldCheck, Heart } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../theme/tokens';
import { Provider } from '../lib/types';
import { isFavorite, addFavorite, removeFavorite } from '../lib/api';

export function ProviderCard({
  provider, price, subtitle, onPress, highlighted, showFavorite = true, onFavoriteChange,
}: {
  provider: Provider;
  price?: number;
  subtitle?: string;
  onPress?: () => void;
  highlighted?: boolean;
  showFavorite?: boolean;
  onFavoriteChange?: (faved: boolean) => void;
}) {
  const [faved, setFaved] = useState(false);

  useEffect(() => {
    if (showFavorite) isFavorite(provider.id).then(setFaved).catch(() => {});
  }, [provider.id, showFavorite]);

  async function toggleFav(e?: any) {
    e?.stopPropagation?.();
    const next = !faved;
    setFaved(next);
    onFavoriteChange?.(next);
    try {
      if (next) await addFavorite(provider.id);
      else await removeFavorite(provider.id);
    } catch {
      setFaved(!next);
    }
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, highlighted && styles.highlighted, shadow.card]}
    >
      <View style={styles.iconWrap}>
        <Wrench size={20} color={colors.vert} strokeWidth={2.2} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            <Text style={[text.h3, { color: colors.encre }]} numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.verified && <ShieldCheck size={15} color={colors.vert} fill={colors.surface} />}
          </View>
          {price != null && (
            <Text style={[text.data, { color: colors.encre }]}>
              {price.toLocaleString('fr-FR')} F
            </Text>
          )}
        </View>

        {subtitle && (
          <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <MapPin size={13} color={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>
              {provider.distanceKm.toFixed(1)} km
            </Text>
          </View>
          <View style={styles.meta}>
            <Star size={13} color={colors.soleil} fill={colors.soleil} />
            <Text style={[text.label, { color: colors.textMuted }]}>
              {provider.rating.toFixed(1)}
            </Text>
          </View>
          {provider.verified && (
            <View style={styles.meta}>
              <ShieldCheck size={13} color={colors.vert} />
              <Text style={[text.label, { color: colors.vert }]}>Vérifié</Text>
            </View>
          )}
        </View>
      </View>

      {showFavorite && (
        <Pressable style={styles.favBtn} onPress={toggleFav} hitSlop={8}>
          <Heart size={20} color={faved ? colors.terre : colors.textMuted} fill={faved ? colors.terre : 'none'} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlighted: { borderColor: colors.vert, borderWidth: 2 },
  iconWrap: {
    width: 44, height: 44, borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  favBtn: { alignSelf: 'flex-start', width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
