// Sèvi Go POS — sales history, today's takings, and voiding a sale made by
// mistake (which puts the stock back). Unlimited plan.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Banknote, Smartphone, Receipt, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { PosGate } from '../../src/components/PosGate';
import { alert } from '../../src/lib/alert';
import { fetchSales, voidSale, SevigoSale } from '../../src/lib/sevigo/pos';
import { reportError } from '../../src/lib/reportError';

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function SalesScreen() {
  return <PosGate title="Ventes"><Sales /></PosGate>;
}

function Sales() {
  const router = useRouter();
  const [sales, setSales] = useState<SevigoSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchSales().then(setSales).catch(reportError).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const today = sales.filter(s => s.status === 'completed' && sameDay(new Date(s.createdAt), now));
  const todayTotal = today.reduce((t, s) => t + s.total, 0);
  const todayCash = today.filter(s => s.paymentMethod === 'cash').reduce((t, s) => t + s.total, 0);

  function confirmVoid(s: SevigoSale) {
    alert('Annuler cette vente', `${s.number} (${money(s.total)}) sera annulée et les produits remis en stock.`, [
      { text: 'Garder', style: 'cancel' },
      { text: 'Annuler la vente', style: 'destructive', onPress: async () => {
        try { await voidSale(s.id); load(); } catch (e: any) { alert('Erreur', e.message); }
      } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Ventes</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.summary, shadow.card]}>
            <Text style={[text.label, { color: colors.textMuted }]}>AUJOURD'HUI</Text>
            <Text style={[text.data, { color: colors.encre, fontSize: 30, marginTop: 2 }]}>{money(todayTotal)}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>
              {today.length} vente{today.length > 1 ? 's' : ''} · dont {money(todayCash)} en espèces
            </Text>
          </View>

          {sales.length === 0 ? (
            <View style={styles.empty}>
              <Receipt size={40} color={colors.border} />
              <Text style={[text.small, { color: colors.textMuted }]}>Aucune vente pour l'instant.</Text>
            </View>
          ) : sales.map(s => {
            const voided = s.status === 'voided';
            const isOpen = open === s.id;
            return (
              <View key={s.id} style={[styles.card, shadow.card, voided && { opacity: 0.55 }]}>
                <Pressable style={styles.row} onPress={() => setOpen(isOpen ? null : s.id)}>
                  {s.paymentMethod === 'cash' ? <Banknote size={20} color={colors.vert} /> : <Smartphone size={20} color={colors.vert} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]}>{s.number}{voided ? ' · ANNULÉE' : ''}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>
                      {new Date(s.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[text.bodyMd, { color: colors.encre, textDecorationLine: voided ? 'line-through' : 'none' }]}>{money(s.total)}</Text>
                  {isOpen ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
                </Pressable>
                {isOpen && (
                  <View style={styles.detail}>
                    {(s.items ?? []).map((i, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{i.qty} × {i.name}</Text>
                        <Text style={[text.small, { color: colors.encre }]}>{money(i.lineTotal)}</Text>
                      </View>
                    ))}
                    {!voided && (
                      <Pressable style={styles.voidBtn} onPress={() => confirmVoid(s)}>
                        <Text style={[text.small, { color: colors.terre }]}>Annuler cette vente</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  summary: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detail: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
  itemRow: { flexDirection: 'row', paddingVertical: 3 },
  voidBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
});
