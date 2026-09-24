import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { Check, FileText, BarChart3, Store } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { alert } from '../../src/lib/alert';
import { fetchSevigoUsage, setSevigoPlan, createSevigoPlanPayment } from '../../src/lib/sevigo/api';
import { SEVIGO_PLANS } from '../../src/lib/sevigo/types';
import type { SevigoPlanId } from '../../src/lib/sevigo/types';
import { reportError } from '../../src/lib/reportError';

function buildRedirectUrl(status: 'return' | 'cancel'): string {
  const query = `payment=${status}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sevigo/plan?${query}`;
  }
  return ExpoLinking.createURL('/sevigo/plan', { queryParams: { payment: status } });
}

export default function SevigoPlanScreen() {
  const { payment: paymentParam } = useLocalSearchParams<{ payment?: string }>();
  const [currentPlan, setCurrentPlan] = useState<SevigoPlanId>('payg');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<SevigoPlanId | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    fetchSevigoUsage().then(u => setCurrentPlan(u.planId)).catch(reportError).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Coming back from PayDunya's checkout after paying a plan's monthly fee —
  // poll for the webhook to confirm and actually switch the plan.
  useEffect(() => {
    if (paymentParam !== 'return') return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const u = await fetchSevigoUsage().catch(() => null);
      if (u && u.planId !== 'payg') {
        setCurrentPlan(u.planId);
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (attempts >= 10) {
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam]);

  async function choose(planId: SevigoPlanId) {
    if (planId === currentPlan) return;
    setSwitching(planId);
    try {
      if (planId === 'payg') {
        // Free — applies instantly, no payment needed.
        await setSevigoPlan('payg');
        setCurrentPlan('payg');
        return;
      }
      // Paid plan — must pay the monthly fee first; the plan only actually
      // changes once sevigo-plan-payment-webhook confirms it.
      const result = await createSevigoPlanPayment(planId, buildRedirectUrl('return'), buildRedirectUrl('cancel'));
      // Referral credit fully covered the fee — no PayDunya round-trip
      // needed, the plan already switched server-side.
      if ('confirmed' in result) {
        setCurrentPlan(planId);
        return;
      }
      if (Platform.OS === 'web') {
        window.location.href = result.invoiceUrl;
        return;
      }
      await Linking.openURL(result.invoiceUrl);
    } catch (e: any) {
      alert('Erreur', e.message ?? "Échec du changement de formule.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.h2, { color: colors.encre }]}>Choisissez votre formule</Text>
        <Text style={[text.body, { color: colors.textMuted }]}>
          Passez à une formule payante à tout moment — l'abonnement est réglé et prend effet dès confirmation du paiement.
        </Text>

        {verifying && (
          <View style={styles.verifyingBanner}>
            <ActivityIndicator size="small" color={colors.vert} />
            <Text style={[text.small, { color: colors.vertDark }]}>Vérification du paiement…</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            {SEVIGO_PLANS.map(plan => {
              const active = plan.id === currentPlan;
              return (
                <View key={plan.id} style={[styles.card, shadow.card, active && styles.cardActive]}>
                  <View style={styles.cardHead}>
                    <View>
                      <Text style={[text.h3, { color: colors.encre }]}>{plan.label}</Text>
                      <Text style={[text.bodyMd, { color: colors.vert, marginTop: 2 }]}>{plan.priceLabel}</Text>
                    </View>
                    {active && (
                      <View style={styles.activeTag}>
                        <Check size={13} color={colors.vert} />
                        <Text style={[text.label, { color: colors.vert }]}>ACTUELLE</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
                    <Feature
                      icon={<FileText size={14} color={colors.textMuted} />}
                      text={
                        plan.includedInvoices === null
                          ? 'Factures illimitées'
                          : plan.includedInvoices === 0
                            ? `${plan.extraInvoiceFee.toLocaleString('fr-FR')} F par facture`
                            : `${plan.includedInvoices} factures incluses, puis ${plan.extraInvoiceFee.toLocaleString('fr-FR')} F/facture`
                      }
                    />
                    <Feature
                      icon={<BarChart3 size={14} color={colors.textMuted} />}
                      text={`Commission : ${Math.round(plan.paydunyaFeePct * 100)}%`}
                    />
                    {plan.hasReports && <Feature icon={<BarChart3 size={14} color={colors.textMuted} />} text="Rapports & analyses" />}
                    {plan.hasPos && <Feature icon={<Store size={14} color={colors.textMuted} />} text="POS & inventaire complet" />}
                  </View>

                  <Button
                    label={active ? 'Formule actuelle' : switching === plan.id ? (plan.id === 'payg' ? 'Changement…' : 'Redirection…') : 'Choisir cette formule'}
                    variant={active ? 'ghost' : 'primary'}
                    onPress={() => choose(plan.id)}
                    disabled={active || !!switching}
                    loading={switching === plan.id}
                    style={{ marginTop: spacing.lg }}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, text: label }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      {icon}
      <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  verifyingBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  cardActive: { borderColor: colors.vert, borderWidth: 1.5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
});
