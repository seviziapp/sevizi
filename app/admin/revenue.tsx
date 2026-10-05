// Sèvizi — super-admin revenue dashboard & reports. Registered with
// href:null on app/admin/_layout.tsx and linked from the admin dashboard.
// Every figure comes from the admin_revenue_report() RPC, which itself
// refuses non-super-admins — the screen check below is only for a clean UX.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Download, TrendingUp, TrendingDown } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchMyProfile, fetchRevenueReport, REVENUE_STREAMS, RevenueReport, RevenueStream } from '../../src/lib/api';
import { reportError } from '../../src/lib/reportError';
import { alert } from '../../src/lib/alert';

type PeriodId = '7d' | '30d' | 'month' | '90d' | 'year' | 'all';
const PERIODS: { id: PeriodId; label: string }[] = [
  { id: '7d', label: '7 jours' },
  { id: '30d', label: '30 jours' },
  { id: 'month', label: 'Ce mois' },
  { id: '90d', label: '90 jours' },
  { id: 'year', label: 'Cette année' },
  { id: 'all', label: 'Tout' },
];

const STREAM_COLOR: Record<RevenueStream, string> = {
  pro: colors.vert,
  sevigo_plan: colors.encre,
  sevigo_fee: colors.soleil,
  sevigo_comm: colors.terre,
  job_comm: colors.vertDark,
};

// Calendar-aware window for the chosen period, plus the equal-length window
// just before it (for the "vs période précédente" comparison).
function windowFor(id: PeriodId): { from: Date; to: Date; prevFrom: Date | null } {
  const now = new Date();
  const to = new Date(now.getTime() + 60_000);
  const day = 86_400_000;
  let from: Date;
  if (id === '7d') from = new Date(now.getTime() - 7 * day);
  else if (id === '30d') from = new Date(now.getTime() - 30 * day);
  else if (id === '90d') from = new Date(now.getTime() - 90 * day);
  else if (id === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (id === 'year') from = new Date(now.getFullYear(), 0, 1);
  else return { from: new Date('2024-01-01T00:00:00Z'), to, prevFrom: null };
  const span = to.getTime() - from.getTime();
  return { from, to, prevFrom: new Date(from.getTime() - span) };
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const streamLabel = (s: RevenueStream) => REVENUE_STREAMS.find(x => x.id === s)?.label ?? s;

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(r: RevenueReport): string {
  const lines = ['Date;Source;Client / prestataire;Montant (F)'];
  for (const t of r.transactions) {
    lines.push([new Date(t.at).toLocaleString('fr-FR'), streamLabel(t.stream), t.who, t.amount].map(csvCell).join(';'));
  }
  lines.push('');
  lines.push(['Total', '', '', r.total].map(csvCell).join(';'));
  for (const s of r.streams) lines.push([streamLabel(s.stream), `${s.count} paiement(s)`, '', s.amount].map(csvCell).join(';'));
  return lines.join('\n');
}

export default function AdminRevenueScreen() {
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [period, setPeriod] = useState<PeriodId>('30d');
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchMyProfile().then(p => setAccess(p?.isSuperAdmin ? 'ok' : 'denied')).catch(() => setAccess('denied'));
  }, []);

  const load = useCallback(() => {
    if (access !== 'ok') return;
    setLoading(true);
    setError('');
    const w = windowFor(period);
    Promise.all([
      fetchRevenueReport(w.from, w.to),
      w.prevFrom ? fetchRevenueReport(w.prevFrom, w.from).then(r => r.total) : Promise.resolve(null),
    ])
      .then(([r, prev]) => { setReport(r); setPrevTotal(prev); })
      .catch(e => { reportError(e); setError(e.message ?? 'Impossible de charger les revenus.'); })
      .finally(() => setLoading(false));
  }, [access, period]);
  useEffect(load, [load]);

  const maxBar = useMemo(() => Math.max(1, ...(report?.series ?? []).map(s => s.total)), [report]);
  const streamMax = useMemo(() => Math.max(1, ...(report?.streams ?? []).map(s => s.amount)), [report]);

  async function exportCsv() {
    if (!report) return;
    const csv = buildCsv(report);
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sevizi-revenus-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csv, title: 'Revenus Sèvizi' });
      }
    } catch (e: any) { alert('Export impossible', e.message ?? ''); }
  }

  if (access === 'checking') {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={colors.vert} style={{ marginTop: 80 }} /></SafeAreaView>;
  }
  if (access === 'denied') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable style={styles.iconBtn} onPress={() => router.back()}><ArrowLeft size={20} color={colors.encre} /></Pressable>
        </View>
        <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', padding: spacing.xl }]}>Réservé aux super admins.</Text>
      </SafeAreaView>
    );
  }

  const delta = report && prevTotal != null && prevTotal > 0 ? Math.round(((report.total - prevTotal) / prevTotal) * 100) : null;
  const txs = report ? (showAll ? report.transactions : report.transactions.slice(0, 15)) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><ArrowLeft size={20} color={colors.encre} /></Pressable>
        <Text style={[text.h3, { color: colors.encre }]}>Revenus</Text>
        <Pressable style={styles.iconBtn} onPress={exportCsv} disabled={!report}><Download size={18} color={colors.encre} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {PERIODS.map(p => (
            <Pressable key={p.id} onPress={() => setPeriod(p.id)} style={[styles.chip, period === p.id && styles.chipOn]}>
              <Text style={[text.small, { color: period === p.id ? colors.white : colors.encre }]}>{p.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <Text style={[text.body, { color: colors.terre }]}>{error}</Text>
        ) : loading && !report ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.xl }} />
        ) : report ? (
          <>
            {/* Total */}
            <View style={[styles.hero, shadow.card, loading && { opacity: 0.6 }]}>
              <Text style={[text.label, { color: colors.textMutedDark }]}>REVENUS SÈVIZI</Text>
              <Text style={[text.h1, { color: colors.textOnDark, marginTop: 4 }]}>{fmt(report.total)}</Text>
              {delta != null && (
                <View style={styles.deltaRow}>
                  {delta >= 0 ? <TrendingUp size={14} color={colors.vert} /> : <TrendingDown size={14} color={colors.soleil} />}
                  <Text style={[text.small, { color: colors.textMutedDark }]}>
                    {delta >= 0 ? '+' : ''}{delta}% vs période précédente ({fmt(prevTotal ?? 0)})
                  </Text>
                </View>
              )}
              <Text style={[text.small, { color: colors.textMutedDark, marginTop: spacing.xs }]}>
                Argent réellement encaissé via PayDunya, hors montants reversés aux prestataires.
              </Text>
            </View>

            {/* Chart */}
            <View style={[styles.card, shadow.card]}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>
                {report.unit === 'day' ? 'Par jour' : 'Par mois'}
              </Text>
              <View style={styles.chart}>
                {report.series.map(s => (
                  <View key={s.bucket} style={styles.barCol}>
                    <View style={[styles.bar, { height: Math.max(s.total > 0 ? 4 : 1, (s.total / maxBar) * 110), backgroundColor: s.total > 0 ? colors.vert : colors.border }]} />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[text.small, { color: colors.textMuted }]}>{report.series[0]?.bucket}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>pic : {fmt(maxBar === 1 ? 0 : maxBar)}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{report.series[report.series.length - 1]?.bucket}</Text>
              </View>
            </View>

            {/* By source */}
            <View style={[styles.card, shadow.card, { gap: spacing.md }]}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Par source</Text>
              {REVENUE_STREAMS.map(def => {
                const s = report.streams.find(x => x.stream === def.id);
                const amt = s?.amount ?? 0;
                return (
                  <View key={def.id} style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={[styles.dot, { backgroundColor: STREAM_COLOR[def.id] }]} />
                      <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{def.label}</Text>
                      <Text style={[text.bodyMd, { color: colors.encre }]}>{fmt(amt)}</Text>
                    </View>
                    <View style={styles.track}><View style={[styles.fill, { width: `${(amt / streamMax) * 100}%`, backgroundColor: STREAM_COLOR[def.id] }]} /></View>
                    <Text style={[text.small, { color: colors.textMuted }]}>
                      {def.hint} · {s?.count ?? 0} paiement{(s?.count ?? 0) > 1 ? 's' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Subscribers */}
            <View style={styles.grid}>
              <Stat label="Sèvi Go payants" value={String(report.active.sevigo_paid)} />
              <Stat label="Sèvi Go offerts" value={String(report.active.sevigo_free)} />
              <Stat label="Récurrent mensuel Sèvi Go" value={fmt(report.active.sevigo_mrr)} />
              <Stat label="Prestataires Pro" value={String(report.active.pro_providers)} />
              <Stat label="Utilisateurs" value={String(report.active.users)} />
              <Stat label="Prestataires" value={String(report.active.providers)} />
            </View>

            {/* Not cash */}
            <View style={[styles.card, shadow.card, { gap: spacing.xs }]}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Hors encaissement</Text>
              <Row label="Payé en crédit de parrainage" value={fmt(report.covered.credit)} />
              <Row label="Remises par codes de réduction" value={fmt(report.covered.discounts)} />
              <Row label="Paiements en attente (48 h)" value={`${report.pending.count} · ${fmt(report.pending.amount)}`} />
            </View>

            {/* Pass-through */}
            <View style={[styles.card, shadow.card, { gap: spacing.xs }]}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Argent reversé aux prestataires</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>Transite par Sèvizi, ce n'est pas un revenu.</Text>
              <Row label="Paiements de missions" value={fmt(report.volume.jobs)} />
              <Row label="Factures Sèvi Go payées en ligne" value={fmt(report.volume.invoices)} />
              <Row label="Acomptes de rendez-vous" value={fmt(report.volume.deposits)} />
            </View>

            {/* Transactions */}
            <View style={[styles.card, shadow.card]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Transactions ({report.transactions.length})</Text>
                <Pressable onPress={exportCsv}><Text style={[text.small, { color: colors.vert }]}>Exporter CSV</Text></Pressable>
              </View>
              {txs.length === 0 && <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>Aucune transaction sur cette période.</Text>}
              {txs.map((t, i) => (
                <View key={i} style={styles.txRow}>
                  <View style={[styles.dot, { backgroundColor: STREAM_COLOR[t.stream] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[text.small, { color: colors.encre }]} numberOfLines={1}>{t.who}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>{streamLabel(t.stream)} · {new Date(t.at).toLocaleDateString('fr-FR')}</Text>
                  </View>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{fmt(t.amount)}</Text>
                </View>
              ))}
              {report.transactions.length > 15 && (
                <Pressable onPress={() => setShowAll(v => !v)} style={{ paddingTop: spacing.md }}>
                  <Text style={[text.small, { color: colors.vert, textAlign: 'center' }]}>{showAll ? 'Voir moins' : 'Voir tout'}</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.stat, shadow.card]}>
      <Text style={[text.h3, { color: colors.encre }]}>{value}</Text>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 }}>
      <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[text.small, { color: colors.encre }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.vert, borderColor: colors.vert },
  hero: { backgroundColor: colors.encre, borderRadius: radii.xl, padding: spacing.xl },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2, marginVertical: spacing.md },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexBasis: '48%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
});
