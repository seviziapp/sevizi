import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { reportDispute } from '../../src/lib/api';

const QUICK_REASONS = [
  'Le prestataire ne s\'est pas présenté',
  'Travail non conforme à l\'accord',
  'Problème de paiement',
  'Comportement inapproprié',
  'Prix différent du devis',
  'Autre problème',
];

export default function ReportProblem() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reason = [selected, details.trim()].filter(Boolean).join(' — ');
  const valid = !!jobId && (!!selected || details.trim().length > 3);

  async function submit() {
    if (!valid) { setError('Choisissez un motif ou décrivez le problème.'); return; }
    setError('');
    setLoading(true);
    try {
      await reportDispute(jobId!, reason);
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? 'Impossible d\'envoyer le signalement. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}><CheckCircle size={44} color={colors.vert} /></View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>Signalement envoyé</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Notre équipe support a bien reçu votre signalement et va intervenir pour trouver une solution.
          </Text>
          <Button label="Retour" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Signaler un problème</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.banner, shadow.card]}>
            <AlertTriangle size={22} color={colors.terre} />
            <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
              Décrivez le problème rencontré pendant la mission. Le support Sèvizi examinera votre signalement et interviendra.
            </Text>
          </View>

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>MOTIF</Text>
          <View style={styles.chips}>
            {QUICK_REASONS.map(r => {
              const active = selected === r;
              return (
                <Pressable key={r} onPress={() => setSelected(active ? null : r)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>DÉTAILS (FACULTATIF)</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Expliquez ce qui s'est passé…"
            placeholderTextColor={colors.textMuted}
            value={details}
            onChangeText={setDetails}
            multiline
            textAlignVertical="top"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Envoyer le signalement" onPress={submit} loading={loading} disabled={!valid} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#FBEDE7', borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: '#F8C6B6' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.terre, borderColor: colors.terre },
  textarea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.lg, minHeight: 110, marginTop: spacing.sm,
    fontSize: 15, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.md },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
