import { LanguageSwitch } from '../../src/components/LanguageSwitch';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, FileText, ChevronRight, Settings, TrendingUp, Wallet, Store, Package, Receipt, Lock, Users, BarChart3 } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow, gradients } from '../../src/theme/tokens';
import { SevigoLogoFull } from '../../src/components/SevigoLogo';
import { fetchSevigoInvoices, fetchSevigoUsage, fetchSevigoWalletBalance } from '../../src/lib/sevigo/api';
import { planById } from '../../src/lib/sevigo/types';
import type { SevigoInvoice, SevigoUsage } from '../../src/lib/sevigo/types';
import { reportError } from '../../src/lib/reportError';

import { tr, locale } from '../../src/i18n';
const STATUS_LABEL: Record<SevigoInvoice['status'], { label: string; color: string }> = {
  pending_fee: { get label() { return tr('Verrouillée'); }, color: colors.terre },
  draft: { get label() { return tr('Brouillon'); }, color: colors.textMuted },
  sent: { get label() { return tr('Envoyée'); }, color: colors.soleil },
  paid: { get label() { return tr('Payée'); }, color: colors.vert },
  overdue: { get label() { return tr('En retard'); }, color: colors.terre },
  cancelled: { get label() { return tr('Annulée'); }, color: colors.textMuted },
};

export default function SevigoDashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SevigoInvoice[]>([]);
  const [usage, setUsage] = useState<SevigoUsage | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([fetchSevigoInvoices(), fetchSevigoUsage(), fetchSevigoWalletBalance()])
      .then(([inv, u, w]) => { setInvoices(inv); setUsage(u); setWalletBalance(w.balance); })
      .catch(reportError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const plan = planById(usage?.planId ?? 'payg');
  const paidThisCycle = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.total, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'flex-end' }}><LanguageSwitch compact /></View>
        <View style={styles.header}>
          <SevigoLogoFull height={30} />
          <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.push('/sevigo/business-profile')}>
            <Settings size={18} color={colors.encre} />
          </Pressable>
        </View>

        {/* Plan / usage */}
        <Pressable style={[styles.planWrap, shadow.card]} onPress={() => router.push('/sevigo/plan')}>
          <LinearGradient colors={gradients.forest} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.planBanner}>
            <View style={{ flex: 1 }}>
              <Text style={[text.label, { color: colors.vert }]}>{tr('FORMULE ACTUELLE')}</Text>
              <Text style={[text.h3, { color: colors.creme, marginTop: 4 }]}>{plan.label}</Text>
              <Text style={[text.small, { color: colors.textMutedDark, marginTop: 2 }]}>
                {plan.includedInvoices === null ? tr('Factures illimitées') : plan.includedInvoices === 0 ? tr('{v0} F / facture', { v0: plan.extraInvoiceFee.toLocaleString(locale()) }) : tr('{v0} / {includedInvoices} factures ce mois-ci', { v0: usage?.invoicesThisCycle ?? 0, includedInvoices: plan.includedInvoices })}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.vert} />
          </LinearGradient>
        </Pressable>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <Pressable style={[styles.statCard, shadow.card]} onPress={() => router.push('/sevigo/wallet')}>
            <Wallet size={16} color={colors.vert} />
            <Text style={[text.data, { color: colors.encre, fontSize: 18, marginTop: spacing.sm }]}>
              {walletBalance.toLocaleString(locale())} {tr('F')}</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>{tr('PORTEFEUILLE')}</Text>
          </Pressable>
          <View style={[styles.statCard, shadow.card]}>
            <TrendingUp size={16} color={colors.vert} />
            <Text style={[text.data, { color: colors.encre, fontSize: 18, marginTop: spacing.sm }]}>
              {paidThisCycle.toLocaleString(locale())} {tr('F')}</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>{tr('ENCAISSÉ')}</Text>
          </View>
          <View style={[styles.statCard, shadow.card]}>
            <FileText size={16} color={colors.terre} />
            <Text style={[text.data, { color: colors.encre, fontSize: 18, marginTop: spacing.sm }]}>
              {outstanding.toLocaleString(locale())} {tr('F')}</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>{tr('EN ATTENTE')}</Text>
          </View>
        </View>

        {/* New invoice CTA */}
        <Pressable style={[styles.cta, shadow.glow]} onPress={() => router.push('/sevigo/new-invoice')}>
          <Plus size={20} color={colors.white} />
          <Text style={[text.bodyMd, { color: colors.white }]}>{tr('Nouvelle facture')}</Text>
        </Pressable>

        {/* Saved clients — every plan */}
        <Pressable style={[styles.posCard, shadow.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}
          onPress={() => router.push('/sevigo/clients' as any)}>
          <Users size={18} color={colors.vert} />
          <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{tr('Mes clients')}</Text>
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>

        {/* Reports — every paid plan */}
        <Pressable style={[styles.posCard, shadow.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}
          onPress={() => router.push((plan.hasReports ? '/sevigo/reports' : '/sevigo/plan') as any)}>
          <BarChart3 size={18} color={colors.vert} />
          <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{tr('Rapports & analyses')}</Text>
          {!plan.hasReports && (
            <View style={styles.lockPill}><Lock size={11} color={colors.terre} /><Text style={[text.label, { color: colors.terre, fontSize: 10 }]}>{tr('STARTER+')}</Text></View>
          )}
          <ChevronRight size={16} color={colors.textMuted} />
        </Pressable>

        {/* POS & inventory — Unlimited plan. Separate from invoices. */}
        <View style={[styles.posCard, shadow.card]}>
          <View style={styles.posHead}>
            <Store size={18} color={colors.vert} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{tr('Caisse & stock')}</Text>
            {usage?.planId !== 'unlimited' && (
              <View style={styles.lockPill}><Lock size={11} color={colors.terre} /><Text style={[text.label, { color: colors.terre, fontSize: 10 }]}>{tr('UNLIMITED')}</Text></View>
            )}
          </View>
          {[
            { label: tr('Vendre (caisse)'), icon: <Store size={18} color={colors.encre} />, route: '/sevigo/pos' },
            { label: tr('Produits & stock'), icon: <Package size={18} color={colors.encre} />, route: '/sevigo/products' },
            { label: tr('Historique des ventes'), icon: <Receipt size={18} color={colors.encre} />, route: '/sevigo/sales' },
          ].map(r => (
            <Pressable key={r.route} style={styles.posRow}
              onPress={() => router.push((usage?.planId === 'unlimited' ? r.route : '/sevigo/plan') as any)}>
              {r.icon}
              <Text style={[text.body, { color: colors.encre, flex: 1 }]}>{r.label}</Text>
              <ChevronRight size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        {/* Recent invoices */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>{tr('Factures récentes')}</Text>
          <Pressable onPress={() => router.push('/sevigo/invoices')}>
            <Text style={[text.small, { color: colors.vert }]}>{tr('Tout voir')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.lg }} />
        ) : invoices.length === 0 ? (
          <View style={styles.empty}>
            <FileText size={36} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {tr("Aucune facture pour l'instant. Créez la première en un instant.")}</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {invoices.slice(0, 5).map(inv => {
              const st = STATUS_LABEL[inv.status];
              return (
                <Pressable
                  key={inv.id}
                  style={[styles.invRow, shadow.sm]}
                  onPress={() => router.push({ pathname: '/sevigo/invoice/[id]', params: { id: inv.id } })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{inv.clientName}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>{inv.number}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={[text.data, { color: colors.encre }]}>{inv.total.toLocaleString(locale())} {tr('F')}</Text>
                    <View style={[styles.statusPill, { backgroundColor: st.color + '1A' }]}>
                      <Text style={[text.label, { color: st.color, fontSize: 10 }]}>{st.label.toUpperCase()}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  posCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  posHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  posRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBE9E3', borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  planWrap: { borderRadius: radii.xl, overflow: 'hidden' },
  planBanner: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: radii.md, backgroundColor: colors.vert },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
});
