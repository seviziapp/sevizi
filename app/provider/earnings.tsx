import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet, TrendingUp } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { computeCommission, formatCommissionPct } from '../../src/lib/pricing';
import { CATEGORIES } from '../../src/lib/types';

type Transaction = {
  id: string;
  client: string;
  service: string;
  amount: number; // gross price the client paid
  date: string;
  method: string;
};

export default function Earnings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [grossMonth, setGrossMonth] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { commission: commissionMonth, net: netMonth } = computeCommission(grossMonth);

  useEffect(() => {
    loadEarnings();
  }, []);

  async function loadEarnings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: provider } = await supabase
        .from('providers')
        .select('id, category')
        .eq('user_id', user.id)
        .single();
      if (!provider) return;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, price, accepted_at, payment_method, client_name, requests(description, category)')
        .eq('provider_id', provider.id)
        .eq('status', 'termine')
        .order('accepted_at', { ascending: false })
        .limit(20);

      if (jobs) {
        const txs: Transaction[] = jobs.map((j: any) => {
          const cat = CATEGORIES.find(c => c.key === j.requests?.category);
          const dateStr = new Date(j.accepted_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
          return {
            id: j.id,
            client: j.client_name || 'Client',
            service: `${cat?.label ?? 'Service'} · ${(j.requests?.description ?? '').slice(0, 30)}`,
            amount: j.price,
            date: dateStr,
            method: j.payment_method ?? 'cash',
          };
        });
        setTransactions(txs);

        const monthTotal = jobs
          .filter((j: any) => new Date(j.accepted_at) >= startOfMonth)
          .reduce((sum: number, j: any) => sum + (j.price ?? 0), 0);
        setGrossMonth(monthTotal);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Revenus & Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <Wallet size={24} color={colors.vert} />
          </View>
          <Text style={[text.label, { color: colors.textMutedDark }]}>SOLDE CE MOIS (NET)</Text>
          <Text style={[text.display, { color: colors.creme, fontSize: 36, marginTop: 4 }]}>
            {netMonth.toLocaleString('fr-FR')} F
          </Text>
          <View style={styles.breakdownRow}>
            <Text style={[text.small, { color: colors.textMutedDark }]}>
              Brut : {grossMonth.toLocaleString('fr-FR')} F
            </Text>
            <Text style={[text.small, { color: colors.textMutedDark }]}>
              Commission Sèvizi ({formatCommissionPct()}) : −{commissionMonth.toLocaleString('fr-FR')} F
            </Text>
          </View>

          <View style={styles.withdrawRow}>
            <Pressable style={styles.withdrawBtn}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Retrait Flooz</Text>
            </Pressable>
            <Pressable style={[styles.withdrawBtn, { backgroundColor: colors.vert }]}>
              <Text style={[text.bodyMd, { color: colors.white }]}>Retrait Mixx</Text>
            </Pressable>
          </View>
        </View>

        {/* Transactions */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>Transactions récentes</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: 24 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.empty}>
            <TrendingUp size={40} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucune transaction pour l'instant.{'\n'}Vos revenus apparaîtront ici après chaque mission.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {transactions.map(t => (
              <View key={t.id} style={[styles.txCard, shadow.card]}>
                <View style={styles.txLeft}>
                  <Text style={{ fontSize: 22 }}>🔧</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]}>{t.client}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{t.service}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>{t.date}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[text.data, { color: colors.encre }]}>+{computeCommission(t.amount).net.toLocaleString('fr-FR')} F</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    {t.amount.toLocaleString('fr-FR')} F − {formatCommissionPct()}
                  </Text>
                  <View style={styles.methodBadge}>
                    <Text style={[text.label, { color: t.method === 'cash' ? colors.textMuted : colors.vert }]}>
                      {t.method === 'cash' ? 'Espèces' : t.method === 'flooz' ? 'Flooz' : 'Mixx'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
  balanceCard: { backgroundColor: colors.encre, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm },
  balanceIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  breakdownRow: { gap: 2, marginTop: 2 },
  withdrawRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  withdrawBtn: { flex: 1, height: 44, borderRadius: radii.md, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxxl },
  txCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  txLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  methodBadge: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
});
