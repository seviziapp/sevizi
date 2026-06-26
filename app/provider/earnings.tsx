import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, TrendingUp, Wallet, Phone } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
const VALUES = [78000, 95000, 112000, 88000, 140000, 127500];
const MAX = Math.max(...VALUES);

const TRANSACTIONS = [
  { id: 't1', client: 'Ama Doe', service: 'Plomberie · Fuite cuisine', amount: 4500, date: 'Aujourd\'hui', method: 'cash' },
  { id: 't2', client: 'Kosi Atta', service: 'Plomberie · Installation robinet', amount: 8000, date: 'Hier', method: 'flooz' },
  { id: 't3', client: 'Yawa Nkrumah', service: 'Plomberie · Tuyau', amount: 6200, date: '20 jun', method: 'cash' },
  { id: 't4', client: 'Adjo M.', service: 'Plomberie · Vidange', amount: 3500, date: '18 jun', method: 'mixx' },
];

export default function Earnings() {
  const router = useRouter();
  const [period, setPeriod] = useState<'month' | 'week'>('month');

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
          <Text style={[text.label, { color: colors.textMutedDark }]}>SOLDE CE MOIS</Text>
          <Text style={[text.display, { color: colors.creme, fontSize: 36, marginTop: 4 }]}>
            127 500 F
          </Text>
          <Text style={[text.small, { color: colors.textMutedDark }]}>+14% vs mois dernier</Text>

          <View style={styles.withdrawRow}>
            <Pressable style={styles.withdrawBtn}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Retrait Flooz</Text>
            </Pressable>
            <Pressable style={[styles.withdrawBtn, { backgroundColor: colors.vert }]}>
              <Text style={[text.bodyMd, { color: colors.white }]}>Retrait Mixx</Text>
            </Pressable>
          </View>
        </View>

        {/* Period toggle */}
        <View style={styles.toggleRow}>
          {(['month', 'week'] as const).map(p => (
            <Pressable key={p} style={[styles.toggleBtn, period === p && styles.toggleActive]} onPress={() => setPeriod(p)}>
              <Text style={[text.small, { color: period === p ? colors.white : colors.encre }]}>
                {p === 'month' ? 'Mensuel' : 'Hebdo'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Chart */}
        <View style={[styles.chartCard, shadow.card]}>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.md }]}>REVENUS MENSUELS (FCFA)</Text>
          <View style={styles.chart}>
            {VALUES.map((v, i) => (
              <View key={i} style={styles.bar}>
                <View style={[styles.barFill, { height: `${(v / MAX) * 100}%`, backgroundColor: i === VALUES.length - 1 ? colors.vert : colors.surface }]} />
                <Text style={[text.label, { color: colors.textMuted, fontSize: 10 }]}>{MONTHS[i]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transactions */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>Transactions récentes</Text>
        </View>
        <View style={{ gap: spacing.md }}>
          {TRANSACTIONS.map(t => (
            <View key={t.id} style={[styles.txCard, shadow.card]}>
              <View style={styles.txLeft}>
                <Text style={{ fontSize: 22 }}>🔧</Text>
                <View>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{t.client}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{t.service}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>{t.date}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[text.data, { color: colors.encre }]}>+{t.amount.toLocaleString('fr-FR')} F</Text>
                <View style={styles.methodBadge}>
                  <Phone size={11} color={t.method === 'cash' ? colors.textMuted : colors.vert} />
                  <Text style={[text.label, { color: t.method === 'cash' ? colors.textMuted : colors.vert }]}>
                    {t.method === 'cash' ? 'Espèces' : t.method === 'flooz' ? 'Flooz' : 'Mixx'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
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
  balanceIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.encreSoft, alignItems: 'center', justifyContent: 'center' },
  withdrawRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  withdrawBtn: { flex: 1, height: 44, borderRadius: radii.md, backgroundColor: colors.creme, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.md, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: colors.encre },
  chartCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  bar: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  txLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  methodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
});
