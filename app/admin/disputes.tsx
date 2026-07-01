import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchDisputes, resolveDispute } from '../../src/lib/api';
import type { Dispute } from '../../src/lib/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function Disputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    fetchDisputes().then(setDisputes).catch(() => {});
  }, []);

  async function resolve(id: string) {
    await resolveDispute(id);
    setDisputes(d => d.map(x => x.id === id ? { ...x, status: 'resolu' } : x));
  }

  const open = disputes.filter(d => d.status === 'ouvert');
  const resolved = disputes.filter(d => d.status === 'resolu');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AlertTriangle size={24} color={colors.terre} />
        <Text style={[text.h2, { color: colors.encre }]}>Litiges</Text>
        {open.length > 0 && (
          <View style={styles.badge}>
            <Text style={[text.label, { color: colors.white }]}>{open.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {open.length === 0 && (
          <View style={styles.empty}>
            <CheckCircle size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>Aucun litige ouvert.</Text>
          </View>
        )}

        {open.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted }]}>OUVERTS ({open.length})</Text>
            {open.map(d => <DisputeCard key={d.id} dispute={d} onResolve={() => resolve(d.id)} />)}
          </>
        )}

        {resolved.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted }]}>RÉSOLUS ({resolved.length})</Text>
            {resolved.map(d => <DisputeCard key={d.id} dispute={d} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DisputeCard({ dispute, onResolve }: { dispute: Dispute; onResolve?: () => void }) {
  const isOpen = dispute.status === 'ouvert';
  return (
    <View style={[styles.card, shadow.card, isOpen && styles.cardOpen]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, isOpen ? styles.iconOpen : styles.iconDone]}>
          {isOpen
            ? <AlertTriangle size={20} color={colors.terre} />
            : <CheckCircle size={20} color={colors.vert} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.parties}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{dispute.clientName}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}> vs </Text>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{dispute.providerName}</Text>
          </View>
          <View style={styles.timeMeta}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>{timeAgo(dispute.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusDone]}>
          <Text style={[text.label, { color: isOpen ? colors.terre : colors.vert }]}>
            {isOpen ? 'OUVERT' : 'RÉSOLU'}
          </Text>
        </View>
      </View>

      {!!dispute.reporterName && (
        <View style={styles.reporterRow}>
          <Text style={[text.label, { color: colors.terre }]}>
            Signalé par {dispute.reporterName}{dispute.reporterRole ? ` · ${dispute.reporterRole === 'prestataire' ? 'Prestataire' : 'Client'}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.reasonBox}>
        <Text style={[text.small, { color: colors.textMuted }]}>Motif :</Text>
        <Text style={[text.body, { color: colors.encre }]}>{dispute.reason}</Text>
      </View>

      {isOpen && onResolve && (
        <View style={styles.actions}>
          <Pressable style={styles.viewBtn}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Voir le fil</Text>
          </Pressable>
          <Pressable style={styles.resolveBtn} onPress={onResolve}>
            <CheckCircle size={16} color={colors.white} />
            <Text style={[text.bodyMd, { color: colors.white }]}>Résoudre</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  badge: { backgroundColor: colors.terre, borderRadius: radii.pill, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardOpen: { borderColor: '#F8C6B6' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  iconOpen: { backgroundColor: '#F8E2DA' },
  iconDone: { backgroundColor: colors.surface },
  parties: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  timeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  statusOpen: { borderColor: colors.terre, backgroundColor: '#F8E2DA' },
  statusDone: { borderColor: colors.vert, backgroundColor: colors.surface },
  reporterRow: { alignSelf: 'flex-start', backgroundColor: '#F8E2DA', borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  reasonBox: { backgroundColor: colors.creme, borderRadius: radii.sm, padding: spacing.md, gap: 4 },
  actions: { flexDirection: 'row', gap: spacing.md },
  viewBtn: { flex: 1, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radii.md, backgroundColor: colors.vert },
});
