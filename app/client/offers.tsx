import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wrench, Star, MapPin, ShieldCheck } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchOffers, acceptOffer } from '../../src/lib/api';
import type { Offer } from '../../src/lib/types';

export default function Offers() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    fetchOffers(requestId ?? 'r1').then(setOffers).catch(() => {});
  }, [requestId]);

  async function accept(o: Offer) {
    await acceptOffer(o.id);
    router.push({ pathname: '/client/payment', params: { amount: String(o.price), providerName: o.provider.name } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/client/home')} style={styles.back}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Offres reçues</Text>
      </View>

      <View style={styles.notice}>
        <View style={styles.noticeDot} />
        <Text style={[text.small, { color: colors.vertDark }]}>
          {offers.length} prestataires ont répondu · fuite cuisine
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {offers.map((o) => (
          <OfferCard key={o.id} offer={o} onAccept={() => accept(o)}
            onMessage={() => router.push({ pathname: '/client/thread', params: { providerName: o.provider.name } })} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function OfferCard({ offer, onAccept, onMessage }: { offer: Offer; onAccept: () => void; onMessage: () => void }) {
  const featured = offer.bestPrice;
  return (
    <View style={[styles.card, featured && styles.cardFeatured, shadow.card]}>
      {featured && (
        <View style={styles.bestTag}>
          <Text style={[text.label, { color: colors.encre }]}>MEILLEUR PRIX</Text>
        </View>
      )}
      <View style={styles.cardTop}>
        <View style={styles.iconWrap}>
          <Wrench size={20} color={colors.vert} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.h3, { color: colors.encre }]}>{offer.provider.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <MapPin size={13} color={colors.textMuted} />
              <Text style={[text.label, { color: colors.textMuted }]}>{offer.provider.distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.meta}>
              <Star size={13} color={colors.soleil} fill={colors.soleil} />
              <Text style={[text.label, { color: colors.textMuted }]}>{offer.provider.rating.toFixed(1)}</Text>
            </View>
            {offer.provider.verified && (
              <View style={styles.meta}>
                <ShieldCheck size={13} color={colors.vert} />
                <Text style={[text.label, { color: colors.vert }]}>Vérifié</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={[text.data, { color: colors.encre, fontSize: 18 }]}>
          {offer.price.toLocaleString('fr-FR')} F
        </Text>
      </View>

      {offer.message && (
        <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
          « {offer.message} »
        </Text>
      )}

      {featured && (
        <View style={styles.actions}>
          <Button label="Message" variant="ghost" full={false} style={{ flex: 1 }} onPress={onMessage} />
          <Button label="Accepter" full={false} style={{ flex: 1 }} onPress={onAccept} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: {
    width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.md,
  },
  noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.vert },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardFeatured: { borderColor: colors.vert, borderWidth: 2 },
  bestTag: { alignSelf: 'flex-end', backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.sm, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
