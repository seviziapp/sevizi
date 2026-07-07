import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { createJobPaymentInvoice, fetchJobPaymentStatus } from '../../src/lib/api';
import { formatCommissionPct } from '../../src/lib/pricing';

function buildRedirectUrl(jobId: string, status: 'return' | 'cancel'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/client/payment?jobId=${jobId}&payment=${status}`;
  }
  return ExpoLinking.createURL('/client/payment', { queryParams: { jobId, payment: status } });
}

export default function Payment() {
  const router = useRouter();
  const { amount, providerName, jobId, payment: paymentParam } = useLocalSearchParams<{
    amount?: string; providerName?: string; jobId?: string; payment?: string;
  }>();
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const amountNum = parseInt(amount ?? '0', 10);

  useEffect(() => {
    if (paymentParam !== 'return' || !jobId) return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const status = await fetchJobPaymentStatus(jobId);
      if (status === 'paid') {
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
        router.replace('/client/job-status');
      } else if (status === 'failed' || attempts >= 10) {
        setVerifying(false);
        if (status === 'failed') setError("Le paiement n'a pas abouti. Vous pouvez réessayer ci-dessous.");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam, jobId, router]);

  async function pay() {
    if (!jobId) return;
    setError('');
    setStartingCheckout(true);
    try {
      const { invoiceUrl } = await createJobPaymentInvoice(
        jobId, buildRedirectUrl(jobId, 'return'), buildRedirectUrl(jobId, 'cancel'),
      );
      if (Platform.OS === 'web') {
        window.location.href = invoiceUrl;
      } else {
        await Linking.openURL(invoiceUrl);
      }
    } catch (e: any) {
      setError(e.message ?? 'Échec du démarrage du paiement.');
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      {verifying ? (
        <View style={styles.verifyingWrap}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center', marginTop: spacing.md }]}>
            Vérification du paiement…
          </Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            PayDunya confirme votre paiement — cela prend quelques secondes.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={[styles.summary, shadow.card]}>
            <Text style={[text.label, { color: colors.textMuted }]}>MONTANT À RÉGLER</Text>
            <Text style={[text.display, { color: colors.encre, fontSize: 40 }]}>
              {amountNum.toLocaleString('fr-FR')} F
            </Text>
            <Text style={[text.small, { color: colors.textMuted }]}>
              {providerName ?? 'Prestataire'}
            </Text>
            <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
              Ce prix inclut les frais de service Sèvizi (jusqu'à {formatCommissionPct()}, prélevés sur le prestataire).
            </Text>
          </View>

          <View style={styles.noteRow}>
            <ShieldCheck size={14} color={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted, flex: 1 }]}>
              Paiement sécurisé via PayDunya — mobile money (Flooz, T-Money) ou carte bancaire.
            </Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      )}

      {!verifying && (
        <View style={styles.footer}>
          <Button
            label={`Payer ${amountNum.toLocaleString('fr-FR')} F`}
            onPress={pay}
            loading={startingCheckout}
            disabled={!jobId}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  summary: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg },
  error: { color: colors.terre, fontSize: 14, textAlign: 'center' },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
  verifyingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
});
