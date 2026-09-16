import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { FileText, Plus } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchSevigoInvoices } from '../../src/lib/sevigo/api';
import type { SevigoInvoice, SevigoInvoiceStatus } from '../../src/lib/sevigo/types';

const STATUS_LABEL: Record<SevigoInvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: colors.textMuted },
  sent: { label: 'Envoyée', color: colors.soleil },
  paid: { label: 'Payée', color: colors.vert },
  overdue: { label: 'En retard', color: colors.terre },
  cancelled: { label: 'Annulée', color: colors.textMuted },
};

const FILTERS: { key: 'all' | SevigoInvoiceStatus; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'sent', label: 'Envoyées' },
  { key: 'paid', label: 'Payées' },
  { key: 'overdue', label: 'En retard' },
];

export default function SevigoInvoices() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<SevigoInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | SevigoInvoiceStatus>('all');

  const load = useCallback(() => {
    fetchSevigoInvoices().then(setInvoices).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[text.h2, { color: colors.encre }]}>Factures</Text>
        <Pressable style={[styles.addBtn, shadow.sm]} onPress={() => router.push('/sevigo/new-invoice')}>
          <Plus size={20} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {FILTERS.map(f => (
          <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[text.small, { color: filter === f.key ? colors.white : colors.encre }]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <FileText size={44} color={colors.border} />
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>Aucune facture ici.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {filtered.map(inv => {
            const st = STATUS_LABEL[inv.status];
            return (
              <Pressable
                key={inv.id}
                style={[styles.row, shadow.card]}
                onPress={() => router.push({ pathname: '/sevigo/invoice/[id]', params: { id: inv.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{inv.clientName}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    {inv.number} · {new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[text.data, { color: colors.encre }]}>{inv.total.toLocaleString('fr-FR')} F</Text>
                  <View style={[styles.statusPill, { backgroundColor: st.color + '1A' }]}>
                    <Text style={[text.label, { color: st.color, fontSize: 10 }]}>{st.label.toUpperCase()}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  addBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, height: 34, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl, marginTop: -spacing.xxxl },
});
