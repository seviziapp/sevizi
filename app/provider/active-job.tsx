import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, Navigation, CheckCircle, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import type { JobStatus } from '../../src/lib/types';

const STEPS: { key: JobStatus; label: string; action: string; emoji: string }[] = [
  { key: 'accepte',  label: 'Mission acceptée',   action: 'Démarrer le trajet',     emoji: '✅' },
  { key: 'en_route', label: 'En route',            action: 'Je suis arrivé',          emoji: '🚗' },
  { key: 'arrive',   label: 'Arrivé chez le client', action: 'Démarrer la mission',  emoji: '📍' },
  { key: 'en_cours', label: 'Mission en cours',    action: 'Mission terminée',        emoji: '🔧' },
  { key: 'termine',  label: 'Mission terminée',    action: '',                        emoji: '🏁' },
];

const JOB = {
  clientName: 'Ama Doe',
  phone: '+228 90 12 34 56',
  locationLabel: 'Bè-Kpota, Lomé',
  description: 'Fuite sous l\'évier de la cuisine.',
  price: 4500,
  payment: 'cash' as const,
};

export default function ActiveJob() {
  const router = useRouter();
  const [statusIdx, setStatusIdx] = useState(0);

  const current = STEPS[statusIdx];
  const isDone = statusIdx === STEPS.length - 1;

  function advance() {
    if (!isDone) setStatusIdx(i => i + 1);
  }

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
        {/* Status hero */}
        <View style={[styles.statusCard, isDone && styles.statusCardDone]}>
          <Text style={{ fontSize: 40 }}>{current.emoji}</Text>
          <Text style={[text.h2, { color: isDone ? colors.creme : colors.encre }]}>{current.label}</Text>
          <Text style={[text.small, { color: isDone ? colors.textMutedDark : colors.textMuted }]}>
            {JOB.clientName} · {JOB.locationLabel}
          </Text>
        </View>

        {/* Client info */}
        <View style={[styles.clientCard, shadow.card]}>
          <View style={styles.clientAvatar}>
            <Text style={[text.h2, { color: colors.creme }]}>A</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{JOB.clientName}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>{JOB.description}</Text>
          </View>
          <View style={styles.contactBtns}>
            <Pressable style={styles.contactBtn}>
              <Phone size={18} color={colors.vert} />
            </Pressable>
            <Pressable style={styles.contactBtn}>
              <Navigation size={18} color={colors.vert} />
            </Pressable>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={[text.body, { color: colors.textMuted }]}>Montant convenu</Text>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>{JOB.price.toLocaleString('fr-FR')} F</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>Paiement en espèces</Text>
          </View>
        </View>

        {/* Timeline */}
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

        {/* CTA */}
        {!isDone ? (
          <Pressable style={styles.advanceBtn} onPress={advance}>
            <Text style={[text.bodyMd, { color: colors.white }]}>{current.action}</Text>
            <ChevronRight size={18} color={colors.white} />
          </Pressable>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.doneCard}>
              <Text style={{ fontSize: 32 }}>🎉</Text>
              <Text style={[text.h3, { color: colors.encre }]}>Mission accomplie !</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>
                Le client va vous évaluer sous peu.
              </Text>
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
  doneCard: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  backHomeBtn: { height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
});
