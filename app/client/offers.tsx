import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wrench, Star, ShieldCheck, Clock, Hourglass, Crown } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchOffers, fetchRequest, acceptOffer } from '../../src/lib/api';
import type { Offer, ServiceRequest } from '../../src/lib/types';

export default function Offers() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  const rid = requestId ?? '';

  async function load() {
    const [req, offs] = await Promise.all([
      rid ? fetchRequest(rid) : Promise.resolve(null),
      rid ? fetchOffers(rid) : Promise.resolve([]),
    ]);
    setRequest(req);
    setOffers(offs);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // poll while waiting so new offers appear without leaving the screen
    const t = setInterval(() => { fetchOffers(rid).then(setOffers).catch(() => {}); }, 12000);
    return () => clearInterval(t);
  }, [rid]);

  // cheapest offer gets the "best price" tag
  const cheapestId = offers.length
    ? offers.reduce((min, o) => (o.price < min.price ? o : min), offers[0]).id
    : null;

  async function accept(o: Offer) {
    setAccepting(o.id);
    try {
      const { jobId } = await acceptOffer(o.id);
      router.push({ pathname: '/client/payment', params: { jobId, amount: String(o.price), providerName: o.provider.name } });
    } catch (e) {
      setAccepting(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/client/home')} style={styles.back}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Offres reçues</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.notice}>
        <View style={styles.noticeDot} />
        <Text style={[text.small, { color: colors.vertDark }]} numberOfLines={1}>
          {loading ? 'Chargement…'
            : `${offers.length} ${offers.length > 1 ? 'prestataires ont répondu' : 'prestataire a répondu'}${request ? ` · ${request.description}` : ''}`}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
      ) : offers.length === 0 ? (
        <View style={styles.empty}>
          <Hourglass size={44} color={colors.border} />
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center' }]}>En attente d'offres…</Text>
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
            Votre demande est visible par les prestataires proches.{'\n'}Vous serez notifié dès qu'une offre arrive.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {offers.map((o) => (
            <OfferCard
              key={o.id}
              offer={o}
              best={o.id === cheapestId}
              accepting={accepting === o.id}
              disabled={!!accepting && accepting !== o.id}
              onAccept={() => accept(o)}
              onProfile={() => router.push({ pathname: '/shared/provider-profile', params: { id: o.provider.id } })}
              onMessage={() => router.push({ pathname: '/shared/thread', params: { requestId: rid, otherName: o.provider.name } })}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OfferCard({ offer, best, accepting, disabled, onAccept, onMessage, onProfile }: {
  offer: Offer; best: boolean; accepting: boolean; disabled: boolean; onAccept: () => void; onMessage: () => void; onProfile: () => void;
}) {
  return (
    <View style={[styles.card, best && styles.cardFeatured, shadow.card]}>
      {best && (
        <View style={styles.bestTag}>
          <Text style={[text.label, { color: colors.encre }]}>MEILLEUR PRIX</Text>
        </View>
      )}
      <View style={styles.cardTop}>
        <Pressable style={styles.iconWrap} onPress={onProfile}>
          <Wrench size={20} color={colors.vert} strokeWidth={2.2} />
        </Pressable>
        <Pressable style={{ flex: 1 }} onPress={onProfile}>
          <View style={styles.nameRow}>
            <Text style={[text.h3, { color: colors.encre }]} numberOfLines={1}>{offer.provider.name}</Text>
            {offer.provider.verified && <ShieldCheck size={15} color={colors.vert} fill={colors.surface} />}
            {offer.provider.tier === 'pro' && <Crown size={14} color={colors.soleil} fill={colors.soleil} />}
          </View>
          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <Star size={13} color={colors.soleil} fill={colors.soleil} />
              <Text style={[text.label, { color: colors.textMuted }]}>{offer.provider.rating.toFixed(1)}</Text>
            </View>
            {offer.availability ? (
              <View style={styles.meta}>
                <Clock size={13} color={colors.textMuted} />
                <Text style={[text.label, { color: colors.textMuted }]}>{offer.availability}</Text>
              </View>
            ) : null}
            <Text style={[text.label, { color: colors.vert }]}>Voir le profil ›</Text>
          </View>
        </Pressable>
        <Text style={[text.data, { color: colors.encre, fontSize: 18 }]}>
          {offer.price.toLocaleString('fr-FR')} F
        </Text>
      </View>

      {offer.message && (
        <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
          « {offer.message} »
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Message" variant="ghost" full={false} style={{ flex: 1 }} onPress={onMessage} disabled={disabled} />
        <Button label="Accepter" full={false} style={{ flex: 1 }} onPress={onAccept} loading={accepting} disabled={disabled} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.md },
  noticeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.vert },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl, marginTop: -spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardFeatured: { borderColor: colors.vert, borderWidth: 2 },
  bestTag: { alignSelf: 'flex-end', backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.sm, marginBottom: spacing.sm },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
