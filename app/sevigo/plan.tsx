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
import type { SevigoPlanId, SevigoUsage } from '../../src/lib/sevigo/types';
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
  const [usage, setUsage] = useState<SevigoUsage | null>(null);
  const currentPlan: SevigoPlanId = usage?.planId ?? 'payg';
  const setCurrentPlan = (planId: SevigoPlanId) => setUsage(u => ({ ...(u ?? { cycleStart: '', invoicesThisCycle: 0, expiresAt: null, source: 'paid' as const }), planId }));
  const startExpiry = useRef<string | null | undefined>(undefined);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<SevigoPlanId | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    fetchSevigoUsage().then(setUsage).catch(reportError).finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Coming back from PayDunya's checkout after paying a plan's monthly fee —
  // poll for the webhook to confirm and actually switch the plan.
  useEffect(() => {
    if (paymentParam !== 'return') return;
    setVerifying(true);
    let attempts = 0;
    startExpiry.current = usage?.expiresAt ?? null;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const u = await fetchSevigoUsage().catch(() => null);
      // Done once a paid plan is active and, for a renewal, its end date moved.
      if (u && u.planId !== 'payg' && (u.expiresAt !== startExpiry.current || startExpiry.current === null)) {
        setUsage(u);
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
    if (planId === currentPlan && !(planId !== 'payg' && usage?.expiresAt)) return;
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
      const result = await createSevigoPlanPayment(planId, buildRedirectUrl('return'), buildRedirectUrl('cancel'), cycle);
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

        {usage && usage.planId !== 'payg' && (
          <View style={styles.statusBanner}>
            <Text style={[text.bodyMd, { color: colors.vertDark }]}>
              {usage.source === 'granted' ? 'Formule offerte' : 'Formule active'}
            </Text>
            <Text style={[text.small, { color: colors.vertDark }]}>
              {usage.expiresAt
                ? `${usage.source === 'granted' ? 'Offerte jusqu\u2019au' : 'Valable jusqu\u2019au'} ${new Date(usage.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                : 'Sans date de fin'}
            </Text>
          </View>
        )}

        <View style={styles.cycleRow}>
          {(['monthly', 'annual'] as const).map(c => (
            <Pressable key={c} onPress={() => setCycle(c)} style={[styles.cycleChip, cycle === c && styles.cycleChipOn]}>
              <Text style={[text.small, { color: cycle === c ? colors.white : colors.encre }]}>
                {c === 'monthly' ? 'Mensuel' : 'Annuel · 2 mois offerts'}
              </Text>
            </Pressable>
          ))}
        </View>

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
                      <Text style={[text.bodyMd, { color: colors.vert, marginTop: 2 }]}>{cycle === 'annual' && plan.annualFee > 0 ? `${plan.annualFee.toLocaleString('fr-FR')} F / an` : plan.priceLabel}</Text>
                      {cycle === 'annual' && plan.annualFee > 0 && (
                        <Text style={[text.small, { color: colors.textMuted }]}>
                          soit {Math.round(plan.annualFee / 12).toLocaleString('fr-FR')} F / mois · 2 mois offerts
                        </Text>
                      )}
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
                    {plan.hasPos && <Feature icon={<Store size={14} color={colors.textMuted} />} text="Caisse (POS) & gestion de stock" />}
                  </View>

                  <Button
                    label={active ? (plan.id !== 'payg' && usage?.expiresAt ? (cycle === 'annual' ? 'Renouveler 1 an' : 'Renouveler 30 jours') : 'Formule actuelle') : switching === plan.id ? (plan.id === 'payg' ? 'Changement…' : 'Redirection…') : 'Choisir cette formule'}
                    variant={active && !(plan.id !== 'payg' && usage?.expiresAt) ? 'ghost' : 'primary'}
                    onPress={() => choose(plan.id)}
                    disabled={(active && !(plan.id !== 'payg' && !!usage?.expiresAt)) || !!switching}
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
  cycleRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  cycleChip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  cycleChipOn: { backgroundColor: colors.vert, borderColor: colors.vert },
  statusBanner: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, gap: 2 },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  cardActive: { borderColor: colors.vert, borderWidth: 1.5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
});
