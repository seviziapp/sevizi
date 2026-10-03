// Sèvi Go — reports & analytics (Starter and above). Invoice analytics for
// every paid plan; the till section (sales, payment split, best sellers,
// stock alerts) appears for Unlimited. Aggregated server-side by
// sevigo_report(), which also refuses unpaid plans.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Lock, TrendingUp, Clock, AlertTriangle, Banknote, Smartphone, Package } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchReport, SevigoReport } from '../../src/lib/sevigo/reports';
import { reportError } from '../../src/lib/reportError';

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;
const PERIODS = [{ days: 7, label: '7 jours' }, { days: 30, label: '30 jours' }, { days: 90, label: '90 jours' }];

export default function ReportsScreen() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<SevigoReport | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'locked' | 'error'>('loading');

  const load = useCallback((d: number) => {
    setState('loading');
    fetchReport(d)
      .then(r => { setReport(r); setState('ok'); })
      .catch(e => {
        if (/réservés aux formules payantes/i.test(e.message)) setState('locked');
        else { reportError(e); setState('error'); }
      });
  }, []);
  useFocusEffect(useCallback(() => { load(days); }, [load, days]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}><ArrowLeft size={22} color={colors.encre} /></Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Rapports</Text>
        <View style={{ width: 40 }} />
      </View>

      {state === 'locked' ? (
        <View style={styles.center}>
          <View style={styles.lockIcon}><Lock size={28} color={colors.vert} /></View>
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center' }]}>Réservé aux formules payantes</Text>
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.sm }]}>
            Les rapports et analyses sont inclus dès la formule Starter.
          </Text>
          <Button label="Voir les formules" onPress={() => router.push('/sevigo/plan')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <Pressable key={p.days} style={[styles.period, days === p.days && styles.periodOn]} onPress={() => setDays(p.days)}>
                <Text style={[text.small, { color: days === p.days ? colors.white : colors.encre }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {state === 'loading' ? <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
            : state === 'error' || !report ? (
              <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>Impossible de charger les rapports. Réessayez.</Text>
            ) : (
              <>
                <Text style={[text.label, { color: colors.textMuted }]}>FACTURES</Text>
                <View style={styles.kpiGrid}>
                  <Kpi icon={<TrendingUp size={16} color={colors.vert} />} value={money(report.invoices.paid_total)} label="Encaissé" sub={`${report.invoices.paid_count} facture${report.invoices.paid_count > 1 ? 's' : ''} payée${report.invoices.paid_count > 1 ? 's' : ''}`} />
                  <Kpi icon={<Clock size={16} color={colors.soleil} />} value={money(report.invoices.outstanding_total)} label="En attente" sub={`${report.invoices.outstanding_count} à encaisser`} />
                  <Kpi icon={<TrendingUp size={16} color={colors.encre} />} value={money(report.invoices.invoiced_total)} label="Facturé" sub={`${report.invoices.invoiced_count} émise${report.invoices.invoiced_count > 1 ? 's' : ''}`} />
                  <Kpi icon={<AlertTriangle size={16} color={report.invoices.overdue_count ? colors.terre : colors.textMuted} />} value={String(report.invoices.overdue_count)} label="En retard" sub="à relancer" />
                </View>

                <Card title="Facturé et encaissé par jour">
                  <Bars data={report.invoices.series.map(s => ({ day: s.day, a: s.invoiced, b: s.paid }))} aColor={colors.border} bColor={colors.vert} />
                  <Legend items={[['Facturé', colors.border], ['Encaissé', colors.vert]]} />
                </Card>

                <Card title="Meilleurs clients (factures)">
                  {report.invoices.top_clients.length === 0 ? <Empty /> : report.invoices.top_clients.map((c, i) => (
                    <Rank key={i} i={i + 1} name={c.name} right={money(c.total)} sub={`${c.count} facture${c.count > 1 ? 's' : ''}`} />
                  ))}
                </Card>

                {report.pos && (
                  <>
                    <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.sm }]}>CAISSE</Text>
                    <View style={styles.kpiGrid}>
                      <Kpi icon={<TrendingUp size={16} color={colors.vert} />} value={money(report.pos.sales_total)} label="Ventes" sub={`${report.pos.sales_count} vente${report.pos.sales_count > 1 ? 's' : ''}`} />
                      <Kpi icon={<TrendingUp size={16} color={colors.encre} />} value={money(report.pos.sales_count ? Math.round(report.pos.sales_total / report.pos.sales_count) : 0)} label="Panier moyen" sub="par vente" />
                      <Kpi icon={<Banknote size={16} color={colors.vert} />} value={money(report.pos.cash_total)} label="Espèces" sub="" />
                      <Kpi icon={<Smartphone size={16} color={colors.vert} />} value={money(report.pos.mobile_total)} label="Mobile money" sub="" />
                    </View>

                    <Card title="Ventes par jour">
                      <Bars data={report.pos.series.map(s => ({ day: s.day, a: s.total, b: 0 }))} aColor={colors.vert} bColor={colors.vert} />
                    </Card>

                    <Card title="Produits les plus vendus">
                      {report.pos.top_products.length === 0 ? <Empty /> : report.pos.top_products.map((p, i) => (
                        <Rank key={i} i={i + 1} name={p.name} right={money(p.revenue)} sub={`${p.qty} vendu${p.qty > 1 ? 's' : ''}`} />
                      ))}
                    </Card>

                    {(report.pos.low_stock_count > 0 || report.pos.voided_count > 0) && (
                      <Card title="À surveiller">
                        {report.pos.low_stock_count > 0 && (
                          <Pressable style={styles.watch} onPress={() => router.push('/sevigo/products' as any)}>
                            <Package size={16} color={colors.terre} />
                            <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{report.pos.low_stock_count} produit{report.pos.low_stock_count > 1 ? 's' : ''} en stock bas ou épuisé{report.pos.low_stock_count > 1 ? 's' : ''}</Text>
                          </Pressable>
                        )}
                        {report.pos.voided_count > 0 && (
                          <View style={styles.watch}>
                            <AlertTriangle size={16} color={colors.soleil} />
                            <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{report.pos.voided_count} vente{report.pos.voided_count > 1 ? 's' : ''} annulée{report.pos.voided_count > 1 ? 's' : ''} sur la période</Text>
                          </View>
                        )}
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Kpi({ icon, value, label, sub }: { icon: React.ReactNode; value: string; label: string; sub: string }) {
  return (
    <View style={[styles.kpi, shadow.card]}>
      {icon}
      <Text style={[text.data, { color: colors.encre, fontSize: 17, marginTop: spacing.xs }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[text.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      {!!sub && <Text style={[text.label, { color: colors.textMuted, opacity: 0.8 }]}>{sub}</Text>}
    </View>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={[styles.card, shadow.card]}><Text style={[text.bodyMd, { color: colors.encre, marginBottom: spacing.sm }]}>{title}</Text>{children}</View>;
}
function Empty() { return <Text style={[text.small, { color: colors.textMuted }]}>Rien sur cette période.</Text>; }
function Rank({ i, name, right, sub }: { i: number; name: string; right: string; sub: string }) {
  return (
    <View style={styles.rank}>
      <Text style={[text.bodyMd, { color: colors.vert, width: 22 }]}>{i}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[text.small, { color: colors.encre }]} numberOfLines={1}>{name}</Text>
        <Text style={[text.label, { color: colors.textMuted }]}>{sub}</Text>
      </View>
      <Text style={[text.bodyMd, { color: colors.encre }]}>{right}</Text>
    </View>
  );
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
      {items.map(([l, c]) => <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} /><Text style={[text.label, { color: colors.textMuted }]}>{l}</Text></View>)}
    </View>
  );
}

// Two series per day drawn as paired bars; with `b` all zero it is a single
// series. Heights are relative to the largest value in the window.
function Bars({ data, aColor, bColor }: { data: { day: string; a: number; b: number }[]; aColor: string; bColor: string }) {
  const max = Math.max(1, ...data.flatMap(d => [d.a, d.b]));
  const dual = data.some(d => d.b > 0);
  if (data.every(d => d.a === 0 && d.b === 0)) return <Empty />;
  return (
    <View>
      <View style={styles.bars}>
        {data.map(d => (
          <View key={d.day} style={styles.barCol}>
            <View style={styles.barPair}>
              <View style={[styles.bar, { height: `${Math.max(2, (d.a / max) * 100)}%`, backgroundColor: aColor }]} />
              {dual && <View style={[styles.bar, { height: `${Math.max(2, (d.b / max) * 100)}%`, backgroundColor: bColor }]} />}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[text.label, { color: colors.textMuted }]}>{new Date(data[0].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</Text>
        <Text style={[text.label, { color: colors.textMuted }]}>max {money(max)}</Text>
        <Text style={[text.label, { color: colors.textMuted }]}>{new Date(data[data.length - 1].day).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  lockIcon: { width: 64, height: 64, borderRadius: radii.xl, backgroundColor: '#F2FBF6', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  period: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  periodOn: { backgroundColor: colors.encre, borderColor: colors.encre },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { width: '47%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  rank: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
  watch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barPair: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
