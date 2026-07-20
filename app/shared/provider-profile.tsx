import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, Star, ShieldCheck, MapPin, MessageCircle,
  Heart, Briefcase, Clock, TrendingUp, Crown,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchProvider, fetchProviderReviews, fetchProviderCompletedCount, addFavorite, removeFavorite, isFavorite } from '../../src/lib/api';
import { Image } from 'react-native';
import { CATEGORIES, type Provider, type Review } from '../../src/lib/types';

export default function ProviderProfileView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [completed, setCompleted] = useState(0);
  const [faved, setFaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchProvider(id).then(setProvider).catch(() => {});
    fetchProviderReviews(id).then(setReviews).catch(() => {});
    fetchProviderCompletedCount(id).then(setCompleted).catch(() => {});
    isFavorite(id).then(setFaved).catch(() => {});
  }, [id]);

  async function toggleFav() {
    if (!provider) return;
    const next = !faved;
    setFaved(next);
    try {
      if (next) await addFavorite(provider.id);
      else await removeFavorite(provider.id);
    } catch { setFaved(!next); }
  }

  if (!provider) return null;

  const cat = CATEGORIES.find(c => c.key === provider.category);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]} numberOfLines={1}>{provider.name}</Text>
        <Pressable style={styles.heartBtn} onPress={toggleFav}>
          <Heart size={20} color={faved ? colors.terre : colors.textMuted} fill={faved ? colors.terre : 'none'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={[text.display, { color: colors.creme }]}>{provider.name[0]}</Text>
          </View>
          <View style={styles.nameRow}>
            <Text style={[text.h2, { color: colors.encre }]}>{provider.name}</Text>
            {provider.verified && <ShieldCheck size={20} color={colors.vert} fill={colors.surface} />}
            {provider.tier === 'pro' && <Crown size={18} color={colors.soleil} fill={colors.soleil} />}
          </View>
          <View style={styles.catRow}>
            <Text style={{ fontSize: 18 }}>{cat?.emoji}</Text>
            <Text style={[text.body, { color: colors.textMuted }]}>
              {[cat?.label, ...(provider.categories ?? []).map(c => CATEGORIES.find(x => x.key === c)?.label)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.badgeRow}>
            {provider.verified && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color={colors.vert} />
                <Text style={[text.label, { color: colors.vert }]}>PRESTATAIRE VÉRIFIÉ</Text>
              </View>
            )}
            {provider.tier === 'pro' && (
              <View style={styles.proBadge}>
                <Crown size={14} color={colors.encre} fill={colors.soleil} />
                <Text style={[text.label, { color: colors.encre }]}>SÈVIZI PRO</Text>
              </View>
            )}
          </View>
          <View style={[styles.onlineRow, provider.online && styles.onlineRowActive]}>
            <View style={[styles.onlineDot, provider.online && styles.onlineDotActive]} />
            <Text style={[text.small, { color: provider.online ? colors.vert : colors.textMuted }]}>
              {provider.online ? 'Disponible maintenant' : 'Hors ligne'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, shadow.card]}>
          <Stat value={provider.rating.toFixed(1)} label="Note" icon={<Star size={14} color={colors.soleil} fill={colors.soleil} />} />
          <View style={styles.div} />
          <Stat value={String(provider.reviews)} label="Avis" icon={<Star size={14} color={colors.soleil} />} />
          <View style={styles.div} />
          <Stat value={String(completed || provider.missions || 0)} label="Missions" icon={<Briefcase size={14} color={colors.vert} />} />
          <View style={styles.div} />
          <Stat value={`${provider.yearsActive ?? 1} ans`} label="Exp." icon={<Clock size={14} color={colors.vert} />} />
        </View>

        {/* Response rate */}
        {!!provider.responseRate && (
          <View style={styles.responseRow}>
            <TrendingUp size={16} color={colors.vert} />
            <Text style={[text.small, { color: colors.vertDark }]}>
              Taux de réponse : <Text style={{ fontFamily: text.bodyMd.fontFamily }}>{provider.responseRate}%</Text>
            </Text>
          </View>
        )}

        {/* Bio */}
        {provider.bio && (
          <View style={styles.section}>
            <Text style={[text.label, { color: colors.textMuted }]}>À PROPOS</Text>
            <Text style={[text.body, { color: colors.encre, marginTop: spacing.sm }]}>{provider.bio}</Text>
          </View>
        )}

        {/* Gallery */}
        {provider.gallery && provider.gallery.length > 0 && (
          <View style={styles.section}>
            <Text style={[text.label, { color: colors.textMuted }]}>GALERIE</Text>
            <View style={styles.gallery}>
              {provider.gallery.slice(0, 6).map((url, i) => (
                <Image key={i} source={{ uri: url }} style={styles.galleryItem} resizeMode="cover" />
              ))}
            </View>
          </View>
        )}

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={[text.label, { color: colors.textMuted }]}>AVIS ({provider.reviews})</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {reviews.map(rv => (
              <View key={rv.id} style={[styles.reviewCard, shadow.card]}>
                <View style={styles.reviewHead}>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{rv.authorName}</Text>
                  <View style={styles.stars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={11} color={colors.soleil} fill={i < rv.rating ? colors.soleil : 'none'} />
                    ))}
                  </View>
                </View>
                <Text style={[text.small, { color: colors.textMuted }]}>{rv.comment}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* CTA footer — no direct call button: all contact stays in-app via
          messaging, never a raw phone number. */}
      <View style={styles.footer}>
        <Pressable style={styles.messageBtn} onPress={() => router.push({ pathname: '/shared/thread', params: { otherName: provider.name } })}>
          <MessageCircle size={20} color={colors.encre} />
        </Pressable>
        {provider.bookable ? (
          <Button
            label="Prendre rendez-vous"
            onPress={() => router.push({
              pathname: '/client/book-appointment',
              params: { providerId: provider.id, providerName: provider.name },
            })}
            full={false}
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            label="Demander ce prestataire"
            onPress={() => router.push({
              pathname: '/client/new-request',
              params: {
                providerId: provider.id,
                providerName: provider.name,
                category: provider.category,
                categories: (provider.categories ?? []).join(','),
              },
            })}
            full={false}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={[text.data, { color: colors.encre, fontSize: 16 }]}>{value}</Text>
      <Text style={[text.label, { color: colors.textMuted, fontSize: 10 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  heartBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 120 },
  hero: { alignItems: 'center', gap: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FCEFC7', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  onlineRowActive: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  onlineDotActive: { backgroundColor: colors.vert },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  div: { width: 1, backgroundColor: colors.border },
  responseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radii.md },
  section: { gap: spacing.sm },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  galleryItem: { width: '31%', aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.surface },
  reviewCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  messageBtn: { width: 52, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
