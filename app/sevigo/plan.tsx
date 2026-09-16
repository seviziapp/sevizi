import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, FileText, BarChart3, Store } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { alert } from '../../src/lib/alert';
import { fetchSevigoUsage, setSevigoPlan } from '../../src/lib/sevigo/api';
import { SEVIGO_PLANS } from '../../src/lib/sevigo/types';
import type { SevigoPlanId } from '../../src/lib/sevigo/types';

export default function SevigoPlanScreen() {
  const [currentPlan, setCurrentPlan] = useState<SevigoPlanId>('payg');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<SevigoPlanId | null>(null);

  useEffect(() => {
    fetchSevigoUsage().then(u => setCurrentPlan(u.planId)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function choose(planId: SevigoPlanId) {
    if (planId === currentPlan) return;
    setSwitching(planId);
    try {
      await setSevigoPlan(planId);
      setCurrentPlan(planId);
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
          Changez à tout moment. La commission PayDunya s'applique à chaque paiement encaissé via facture.
        </Text>

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
                      text={`Commission PayDunya : ${Math.round(plan.paydunyaFeePct * 100)}%`}
                    />
                    {plan.hasReports && <Feature icon={<BarChart3 size={14} color={colors.textMuted} />} text="Rapports & analyses" />}
                    {plan.hasPos && <Feature icon={<Store size={14} color={colors.textMuted} />} text="POS & inventaire complet" />}
                  </View>

                  <Button
                    label={active ? 'Formule actuelle' : switching === plan.id ? 'Changement…' : 'Choisir cette formule'}
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
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  cardActive: { borderColor: colors.vert, borderWidth: 1.5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.pill },
});
