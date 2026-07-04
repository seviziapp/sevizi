import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, MapPin, MessageCircle, Navigation, Star, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchCurrentJob, updateJobStatus, submitReview } from '../../src/lib/api';
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
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    fetchCurrentJob({ includeCompleted: true }).then(setJob).catch(() => {});
  }, []);

  async function sendReview() {
    if (!job || !job.provider || rating === 0) return;
    setReviewError('');
    setSubmitting(true);
    try {
      await submitReview({ jobId: job.id, providerId: job.provider.id, rating, comment });
      router.replace('/client/home');
    } catch (e: any) {
      const msg = e?.message ?? '';
      // duplicate review (unique constraint) — treat as already done
      if (/duplicate|unique/i.test(msg)) { router.replace('/client/home'); return; }
      setReviewError(msg || "Impossible d'envoyer l'avis. Réessayez.");
      setSubmitting(false);
    }
  }

  const currentIdx = STEPS.findIndex(s => s.key === (job?.status ?? 'accepte'));

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Text style={{ fontSize: 48 }}>🔍</Text>
          <Text style={[text.body, { color: colors.textMuted }]}>Aucune mission en cours.</Text>
          <Pressable style={styles.backBtn} onPress={() => router.replace('/client/home')}>
            <Text style={[text.bodyMd, { color: colors.vert }]}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const providerName = job.provider?.name ?? 'Prestataire';
  const providerRating = job.provider?.rating ?? 0;

  function navigate() {
    const query = job?.locationLabel?.trim() || `${job?.location.lat},${job?.location.lng}`;
    const encoded = encodeURIComponent(query);
    const url = Platform.OS === 'web'
      ? `https://www.google.com/maps/search/?api=1&query=${encoded}`
      : Platform.OS === 'ios' ? `maps:?q=${encoded}` : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() => {});
  }

  if (showReview) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.reviewScreen}>
          <Text style={{ fontSize: 56 }}>⭐</Text>
          <Text style={[text.h1, { color: colors.encre, textAlign: 'center' }]}>Mission terminée !</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Notez votre expérience avec {providerName}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <Pressable key={i} onPress={() => setRating(i)}>
                <Star size={40} color={colors.soleil} fill={i <= rating ? colors.soleil : 'none'} />
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="Ajoutez un commentaire (facultatif)…"
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
          />
          {!!reviewError && <Text style={styles.reviewError}>{reviewError}</Text>}
          <Pressable
            style={[styles.submitReview, (rating === 0 || submitting) && { opacity: 0.5 }]}
            onPress={sendReview}
            disabled={rating === 0 || submitting}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={[text.bodyMd, { color: colors.white }]}>Envoyer mon avis</Text>}
          </Pressable>
          <Pressable onPress={() => router.replace('/client/home')} disabled={submitting}>
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
            <Text style={[text.h2, { color: colors.creme }]}>{providerName[0]?.toUpperCase() ?? 'P'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{providerName}</Text>
            <View style={styles.metaRow}>
              <Star size={12} color={colors.soleil} fill={colors.soleil} />
              <Text style={[text.label, { color: colors.textMuted }]}>{providerRating.toFixed(1)}</Text>
              {!!job.description && (
                <Text style={[text.label, { color: colors.textMuted }]} numberOfLines={1}>· {job.description}</Text>
              )}
            </View>
          </View>
          <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: '/shared/thread', params: { requestId: job.requestId, otherName: providerName } })}>
            <MessageCircle size={18} color={colors.vert} />
          </Pressable>
        </View>

        <View style={styles.safetyBanner}>
          <ShieldAlert size={14} color={colors.vertDark} />
          <Text style={[text.label, { color: colors.vertDark, flex: 1 }]}>
            Restez sur Sèvizi : ne partagez pas votre numéro ou vos coordonnées personnelles avec le prestataire.
          </Text>
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
          <Pressable style={styles.navBtn} onPress={navigate}>
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

        {/* Signal a problem → admin */}
        <Pressable style={styles.reportBtn} onPress={() => router.push({ pathname: '/shared/report-problem', params: { jobId: job.id } })}>
          <AlertTriangle size={16} color={colors.terre} />
          <Text style={[text.bodyMd, { color: colors.terre }]}>Signaler un problème</Text>
        </Pressable>
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
  safetyBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#F2FBF6', borderRadius: radii.md, padding: spacing.md },
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
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: '#F8C6B6' },
  backBtn: { paddingHorizontal: spacing.xl, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  reviewScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  starsRow: { flexDirection: 'row', gap: spacing.md },
  reviewInput: {
    width: '100%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.lg, minHeight: 88,
    fontSize: 15, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  reviewError: { color: colors.terre, fontSize: 14, textAlign: 'center' },
  submitReview: { backgroundColor: colors.vert, borderRadius: radii.md, height: 52, paddingHorizontal: spacing.xxxl, alignItems: 'center', justifyContent: 'center', minWidth: 220 },
});
