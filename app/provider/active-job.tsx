import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, Navigation, CheckCircle, ChevronRight, Briefcase } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchCurrentJob, updateJobStatus } from '../../src/lib/api';
import type { Job, JobStatus } from '../../src/lib/types';

const STEPS: { key: JobStatus; label: string; action: string; emoji: string }[] = [
  { key: 'accepte',  label: 'Mission acceptée',      action: 'Démarrer le trajet',  emoji: '✅' },
  { key: 'en_route', label: 'En route',               action: 'Je suis arrivé',      emoji: '🚗' },
  { key: 'arrive',   label: 'Arrivé chez le client',  action: 'Démarrer la mission', emoji: '📍' },
  { key: 'en_cours', label: 'Mission en cours',        action: 'Mission terminée',    emoji: '🔧' },
  { key: 'termine',  label: 'Mission terminée',        action: '',                    emoji: '🏁' },
];

export default function ActiveJob() {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusIdx, setStatusIdx] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCurrentJob()
      .then(j => {
        if (j) {
          setJob(j);
          const idx = STEPS.findIndex(s => s.key === j.status);
          setStatusIdx(idx >= 0 ? idx : 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const current = STEPS[statusIdx];
  const isDone = statusIdx === STEPS.length - 1;

  async function advance() {
    if (isDone || advancing || !job) return;
    const nextStep = STEPS[statusIdx + 1];
    setError('');
    setAdvancing(true);
    try {
      await updateJobStatus(job.id, nextStep.key);
      setStatusIdx(i => i + 1);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible de mettre à jour le statut. Réessayez.');
    } finally {
      setAdvancing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.vert} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyWrap}>
          <Briefcase size={48} color={colors.border} />
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center' }]}>Aucune mission active</Text>
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
            Envoyez des offres sur les demandes proches. Quand un client accepte, la mission apparaît ici.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace('/provider/requests')}>
            <Text style={[text.bodyMd, { color: colors.white }]}>Voir les demandes</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function callClient() {
    if (job?.clientPhone) Linking.openURL(`tel:${job.clientPhone}`);
  }

  function navigate() {
    if (!job) return;
    const query = job.locationLabel?.trim() || `${job.location.lat},${job.location.lng}`;
    const encoded = encodeURIComponent(query);
    const url = Platform.OS === 'web'
      ? `https://www.google.com/maps/search/?api=1&query=${encoded}`
      : Platform.OS === 'ios' ? `maps:?q=${encoded}` : `geo:0,0?q=${encoded}`;
    Linking.openURL(url).catch(() => {});
  }

  const clientName = (job?.clientName ?? 'Client').split(' ')[0] || 'Client';
  const locationLabel = job?.locationLabel ?? '';
  const description = job?.description ?? '';
  const price = job?.price ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mission active</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.statusCard, isDone && styles.statusCardDone]}>
          <Text style={{ fontSize: 40 }}>{current.emoji}</Text>
          <Text style={[text.h2, { color: isDone ? colors.creme : colors.encre }]}>{current.label}</Text>
          <Text style={[text.small, { color: isDone ? colors.textMutedDark : colors.textMuted }]}>
            {clientName}{locationLabel ? ` · ${locationLabel}` : ''}
          </Text>
        </View>

        <View style={[styles.clientCard, shadow.card]}>
          <View style={styles.clientAvatar}>
            <Text style={[text.h2, { color: colors.creme }]}>{clientName[0]?.toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{clientName}</Text>
            {!!description && <Text style={[text.small, { color: colors.textMuted }]}>{description}</Text>}
          </View>
          <View style={styles.contactBtns}>
            <Pressable style={styles.contactBtn} onPress={callClient}>
              <Phone size={18} color={colors.vert} />
            </Pressable>
            <Pressable style={styles.contactBtn} onPress={navigate}>
              <Navigation size={18} color={colors.vert} />
            </Pressable>
          </View>
        </View>

        {price > 0 && (
          <View style={styles.priceRow}>
            <Text style={[text.body, { color: colors.textMuted }]}>Montant convenu</Text>
            <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>{price.toLocaleString('fr-FR')} F</Text>
          </View>
        )}

        <View style={{ gap: 0 }}>
          {STEPS.map((step, i) => {
            const done = i < statusIdx;
            const active = i === statusIdx;
            return (
              <View key={step.key} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                    {done
                      ? <CheckCircle size={14} color={colors.white} />
                      : <Text style={{ fontSize: 12 }}>{step.emoji}</Text>}
                  </View>
                  {i < STEPS.length - 1 && <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <Text style={[
                  text.body,
                  { color: i > statusIdx ? colors.textMuted : colors.encre, paddingBottom: spacing.xl, paddingTop: 6 },
                  active && { fontFamily: text.bodyMd.fontFamily },
                ]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!isDone ? (
          <Pressable style={[styles.advanceBtn, advancing && { opacity: 0.6 }]} onPress={advance} disabled={advancing}>
            <Text style={[text.bodyMd, { color: colors.white }]}>{advancing ? 'Mise à jour…' : current.action}</Text>
            <ChevronRight size={18} color={colors.white} />
          </Pressable>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.doneCard}>
              <Text style={{ fontSize: 32 }}>🎉</Text>
              <Text style={[text.h3, { color: colors.encre }]}>Mission accomplie !</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>Le client va vous évaluer sous peu.</Text>
            </View>
            <Pressable style={styles.backHomeBtn} onPress={() => router.replace('/provider/dashboard')}>
              <Text style={[text.bodyMd, { color: colors.vert }]}>Retour au tableau de bord</Text>
            </Pressable>
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
  statusCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  statusCardDone: { backgroundColor: colors.vert },
  clientCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  clientAvatar: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.encre, alignItems: 'center', justifyContent: 'center' },
  contactBtns: { flexDirection: 'row', gap: spacing.sm },
  contactBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepLeft: { alignItems: 'center', width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.vert, borderColor: colors.vert },
  dotActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4 },
  lineDone: { backgroundColor: colors.vert },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.vert, borderRadius: radii.lg, height: 56 },
  errorText: { color: colors.terre, fontSize: 14, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
  emptyBtn: { backgroundColor: colors.vert, borderRadius: radii.md, height: 48, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  doneCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  backHomeBtn: { height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
});
