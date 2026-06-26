import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Phone, Navigation, Star, CheckCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchCurrentJob, updateJobStatus } from '../../src/lib/api';
import type { Job, JobStatus } from '../../src/lib/types';
import { LOME } from '../../src/lib/api';

const STEPS: { key: JobStatus; label: string; desc: string; emoji: string }[] = [
  { key: 'accepte',  label: 'Accepté',     desc: 'Le prestataire a accepté votre demande',  emoji: '✅' },
  { key: 'en_route', label: 'En route',    desc: 'Le prestataire est en chemin vers vous',   emoji: '🚗' },
  { key: 'arrive',   label: 'Arrivé',      desc: 'Le prestataire est arrivé à votre adresse', emoji: '📍' },
  { key: 'en_cours', label: 'En cours',    desc: 'La mission est en cours de réalisation',   emoji: '🔧' },
  { key: 'termine',  label: 'Terminé',     desc: 'Mission accomplie !',                      emoji: '🏁' },
];

export default function JobStatus() {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    fetchCurrentJob().then(setJob).catch(() => {});
  }, []);

  const currentIdx = STEPS.findIndex(s => s.key === (job?.status ?? 'accepte'));

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>🔍</Text>
          <Text style={[text.body, { color: colors.textMuted }]}>Aucune mission en cours.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={[text.bodyMd, { color: colors.vert }]}>Retour</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (showReview) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.reviewScreen}>
          <Text style={{ fontSize: 56 }}>⭐</Text>
          <Text style={[text.h1, { color: colors.encre, textAlign: 'center' }]}>Mission terminée !</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Notez votre expérience avec {job.provider.name}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <Pressable key={i} onPress={() => setRating(i)}>
                <Star size={40} color={colors.soleil} fill={i <= rating ? colors.soleil : 'none'} />
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.submitReview} onPress={() => router.replace('/client/home')}>
            <Text style={[text.bodyMd, { color: colors.white }]}>Envoyer mon avis</Text>
          </Pressable>
          <Pressable onPress={() => router.replace('/client/home')}>
            <Text style={[text.small, { color: colors.textMuted }]}>Passer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Suivi de mission</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Provider card */}
        <View style={[styles.providerCard, shadow.card]}>
          <View style={styles.providerAvatar}>
            <Text style={[text.h2, { color: colors.creme }]}>K</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{job.provider.name}</Text>
            <View style={styles.metaRow}>
              <Star size={12} color={colors.soleil} fill={colors.soleil} />
              <Text style={[text.label, { color: colors.textMuted }]}>{job.provider.rating.toFixed(1)}</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>· {job.provider.distanceKm.toFixed(1)} km</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn}>
              <Phone size={18} color={colors.vert} />
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Navigation size={18} color={colors.vert} />
            </Pressable>
          </View>
        </View>

        {/* Price & payment */}
        <View style={styles.priceRow}>
          <Text style={[text.body, { color: colors.textMuted }]}>Montant convenu</Text>
          <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>{job.price.toLocaleString('fr-FR')} F CFA</Text>
        </View>

        {/* Map placeholder */}
        <View style={styles.miniMap}>
          <MapPin size={28} color={colors.white} fill={colors.vert} />
          <View style={styles.mapCoord}>
            <Navigation size={12} color={colors.creme} />
            <Text style={[text.label, { color: colors.creme }]}>
              {LOME.lat.toFixed(4)}° N · {LOME.lng.toFixed(4)}° E
            </Text>
          </View>
          <Pressable style={styles.navBtn}>
            <Navigation size={16} color={colors.white} />
            <Text style={[text.small, { color: colors.white }]}>Naviguer</Text>
          </Pressable>
        </View>

        {/* Steps timeline */}
        <View style={{ gap: 0 }}>
          {STEPS.map((step, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const future = i > currentIdx;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepDot, done && styles.stepDone, active && styles.stepActive, future && styles.stepFuture]}>
                    {done ? <CheckCircle size={16} color={colors.white} /> : <Text style={{ fontSize: 14 }}>{step.emoji}</Text>}
                  </View>
                  {i < STEPS.length - 1 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
                </View>
                <View style={[styles.stepContent, active && styles.stepContentActive]}>
                  <Text style={[text.bodyMd, { color: future ? colors.textMuted : colors.encre }]}>{step.label}</Text>
                  {active && <Text style={[text.small, { color: colors.textMuted }]}>{step.desc}</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* Action buttons */}
        {job.status === 'termine' ? (
          <Pressable style={styles.reviewBtn} onPress={() => setShowReview(true)}>
            <Star size={18} color={colors.white} />
            <Text style={[text.bodyMd, { color: colors.white }]}>Laisser un avis</Text>
          </Pressable>
        ) : (
          <View style={styles.bottomNote}>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Le prestataire mettra à jour le statut en temps réel.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  providerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  providerAvatar: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  miniMap: { height: 160, borderRadius: radii.lg, backgroundColor: '#DDEEE6', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  mapCoord: { position: 'absolute', bottom: spacing.md, left: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.encre, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.sm },
  navBtn: { position: 'absolute', bottom: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.vert, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.md },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepLeft: { alignItems: 'center', width: 36 },
  stepDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.vert, borderColor: colors.vert },
  stepActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  stepFuture: { backgroundColor: colors.white },
  stepLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  stepLineDone: { backgroundColor: colors.vert },
  stepContent: { flex: 1, paddingBottom: spacing.xl, paddingTop: spacing.sm },
  stepContentActive: { backgroundColor: '#F2FBF6', borderRadius: radii.md, padding: spacing.md, marginLeft: -spacing.sm },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.vert, borderRadius: radii.md, height: 52 },
  bottomNote: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md },
  backBtn: { paddingHorizontal: spacing.xl, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  reviewScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  starsRow: { flexDirection: 'row', gap: spacing.md },
  submitReview: { backgroundColor: colors.vert, borderRadius: radii.md, height: 52, paddingHorizontal: spacing.xxxl, alignItems: 'center', justifyContent: 'center' },
});
