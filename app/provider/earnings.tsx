import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Wallet, TrendingUp, Crown, Lock, Repeat, Tag } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { computeCommission, formatCommissionPct, type CommissionDiscount } from '../../src/lib/pricing';
import { fetchWalletBalance, redeemCommissionDiscountCode } from '../../src/lib/api';
import { CATEGORIES } from '../../src/lib/types';

type Transaction = {
  id: string;
  client: string;
  service: string;
  category?: string;
  amount: number; // gross price the client paid
  date: string;
  method: string;
};

export default function Earnings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [grossMonth, setGrossMonth] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [discount, setDiscount] = useState<CommissionDiscount | undefined>(undefined);
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const tier = isPro ? 'pro' : 'free';
  const { commission: commissionMonth, net: netMonth } = computeCommission(grossMonth, tier, discount);

  async function applyPromoCode() {
    if (!promoCode.trim()) return;
    setApplyingPromo(true);
    try {
      const result = await redeemCommissionDiscountCode(promoCode);
      setDiscount({ pct: result.pct, until: result.durationDays != null ? new Date(Date.now() + result.durationDays * 86400000).toISOString() : null });
      setPromoCode('');
      Alert.alert('Code appliqué', `Réduction de ${result.pct}% sur votre commission${result.durationDays ? ` pendant ${result.durationDays} jours` : ''}.`);
    } catch (e: any) {
      Alert.alert('Code invalide', e.message ?? "Ce code n'a pas pu être appliqué.");
    } finally {
      setApplyingPromo(false);
    }
  }

  useEffect(() => {
    fetchWalletBalance().then(setWalletBalance).catch(() => {});
    loadEarnings();
  }, []);

  async function loadEarnings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: provider } = await supabase
        .from('providers')
        .select('id, category, tier, commission_discount_pct, commission_discount_until')
        .eq('user_id', user.id)
        .single();
      if (!provider) return;
      setIsPro(provider.tier === 'pro');
      if (provider.commission_discount_pct > 0) {
        setDiscount({ pct: provider.commission_discount_pct, until: provider.commission_discount_until });
      }

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
            category: cat?.label ?? 'Service',
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

  // Advanced analytics — Pro perk.
  const catCounts = new Map<string, number>();
  transactions.forEach(t => catCounts.set(t.category ?? 'Service', (catCounts.get(t.category ?? 'Service') ?? 0) + 1));
  const bestCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const clientCounts = new Map<string, number>();
  transactions.forEach(t => clientCounts.set(t.client, (clientCounts.get(t.client) ?? 0) + 1));
  const repeatClients = [...clientCounts.values()].filter(n => n > 1).length;
  const repeatRate = transactions.length ? Math.round((repeatClients / clientCounts.size) * 100) : 0;

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
          <Text style={[text.label, { color: colors.textMutedDark }]}>SOLDE DISPONIBLE</Text>
          <Text style={[text.display, { color: colors.creme, fontSize: 36, marginTop: 4 }]}>
            {walletBalance.toLocaleString('fr-FR')} F
          </Text>
          <View style={styles.breakdownRow}>
            <Text style={[text.small, { color: colors.textMutedDark }]}>
              Ce mois — brut : {grossMonth.toLocaleString('fr-FR')} F
            </Text>
            <Text style={[text.small, { color: colors.textMutedDark }]}>
              Commission Sèvizi ({formatCommissionPct(tier, discount)}) : −{commissionMonth.toLocaleString('fr-FR')} F
            </Text>
          </View>

          <View style={styles.withdrawRow}>
            <Pressable style={styles.withdrawBtn} onPress={() => router.push({ pathname: '/provider/withdraw', params: { method: 'flooz' } })}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Retrait Flooz</Text>
            </Pressable>
            <Pressable style={[styles.withdrawBtn, { backgroundColor: colors.vert }]} onPress={() => router.push({ pathname: '/provider/withdraw', params: { method: 'mixx' } })}>
              <Text style={[text.bodyMd, { color: colors.white }]}>Retrait Mixx</Text>
            </Pressable>
          </View>
        </View>

        {/* Discount code */}
        {discount && discount.pct > 0 && (!discount.until || new Date(discount.until).getTime() > Date.now()) ? (
          <View style={styles.promoActiveRow}>
            <Tag size={16} color={colors.vert} />
            <Text style={[text.small, { color: colors.vertDark, flex: 1 }]}>
              Réduction de {discount.pct}% active sur votre commission{discount.until ? ` jusqu'au ${new Date(discount.until).toLocaleDateString('fr-FR')}` : ''}.
            </Text>
          </View>
        ) : (
          <View style={styles.promoRow}>
            <Tag size={16} color={colors.textMuted} />
            <TextInput
              style={styles.promoInput}
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Code promo commission"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <Pressable style={styles.promoBtn} onPress={applyPromoCode} disabled={applyingPromo}>
              <Text style={[text.small, { color: colors.white }]}>{applyingPromo ? '…' : 'Appliquer'}</Text>
            </Pressable>
          </View>
        )}

        {/* Advanced analytics — Pro perk */}
        {isPro ? (
          transactions.length > 0 && (
            <View style={styles.analyticsCard}>
              <View style={styles.analyticsHead}>
                <Crown size={14} color={colors.soleil} fill={colors.soleil} />
                <Text style={[text.label, { color: colors.encre }]}>STATISTIQUES AVANCÉES</Text>
              </View>
              <View style={styles.analyticsRow}>
                <TrendingUp size={16} color={colors.vert} />
                <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
                  Meilleure catégorie : <Text style={{ fontFamily: text.bodyMd.fontFamily }}>{bestCategory}</Text>
                </Text>
              </View>
              <View style={styles.analyticsRow}>
                <Repeat size={16} color={colors.vert} />
                <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
                  Taux de clients fidèles : <Text style={{ fontFamily: text.bodyMd.fontFamily }}>{repeatRate}%</Text>
                </Text>
              </View>
            </View>
          )
        ) : (
          <Pressable style={styles.analyticsLocked} onPress={() => router.push('/provider/upgrade')}>
            <Lock size={16} color={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>
              Passez à Sèvizi Pro pour voir vos tendances hebdomadaires, votre meilleure catégorie et votre taux de clients fidèles.
            </Text>
          </Pressable>
        )}

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
                  <Text style={[text.data, { color: colors.encre }]}>+{computeCommission(t.amount, tier, discount).net.toLocaleString('fr-FR')} F</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    {t.amount.toLocaleString('fr-FR')} F − {formatCommissionPct(tier, discount)}
                  </Text>
                  <View style={styles.methodBadge}>
                    <Text style={[text.label, { color: t.method === 'cash' ? colors.textMuted : colors.vert }]}>
                      {t.method === 'cash' ? 'Espèces' : t.method === 'flooz' ? 'Flooz' : t.method === 'mixx' ? 'Mixx' : 'PayDunya'}
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
  analyticsCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  analyticsHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  analyticsLocked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border },
  promoInput: { flex: 1, height: 36, ...text.small, color: colors.encre },
  promoBtn: { paddingHorizontal: spacing.md, height: 36, borderRadius: radii.sm, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  promoActiveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg },
});
