import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Users, Briefcase, CheckCircle, Clock, ShieldCheck,
  AlertTriangle, TrendingUp, MapPin, Wallet,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { fetchAdminStats } from '../../src/lib/api';
import type { AdminStats } from '../../src/lib/types';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchAdminStats().then(setStats).catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Logo size={36} />
            <View>
              <Text style={[text.label, { color: colors.textMuted }]}>BACK-OFFICE</Text>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Sèvizi Admin</Text>
            </View>
          </View>
          <Pressable style={styles.exitBtn} onPress={() => router.replace('/client/home')}>
            <Text style={[text.small, { color: colors.textMuted }]}>Quitter</Text>
          </Pressable>
        </View>

        {/* Alert row */}
        {stats && (stats.pendingVerifications > 0 || stats.openDisputes > 0 || stats.pendingWithdrawals > 0) && (
          <View style={styles.alertsRow}>
            {stats.pendingVerifications > 0 && (
              <Pressable style={[styles.alertCard, { borderColor: colors.soleil }]} onPress={() => router.push('/admin/verification')}>
                <ShieldCheck size={16} color={colors.soleil} />
                <Text style={[text.small, { color: colors.encre }]}>{stats.pendingVerifications} vérifications en attente</Text>
              </Pressable>
            )}
            {stats.openDisputes > 0 && (
              <Pressable style={[styles.alertCard, { borderColor: colors.terre }]} onPress={() => router.push('/admin/disputes')}>
                <AlertTriangle size={16} color={colors.terre} />
                <Text style={[text.small, { color: colors.encre }]}>{stats.openDisputes} litiges ouverts</Text>
              </Pressable>
            )}
            {stats.pendingWithdrawals > 0 && (
              <Pressable style={[styles.alertCard, { borderColor: colors.vert }]} onPress={() => router.push('/admin/withdrawals')}>
                <Wallet size={16} color={colors.vert} />
                <Text style={[text.small, { color: colors.encre }]}>{stats.pendingWithdrawals} demande{stats.pendingWithdrawals > 1 ? 's' : ''} de retrait</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* KPI grid */}
        {stats && (
          <View style={styles.kpiGrid}>
            <KPI icon={<Users size={20} color={colors.vert} />} value={stats.totalUsers.toLocaleString('fr-FR')} label="Utilisateurs" />
            <KPI icon={<Briefcase size={20} color={colors.vert} />} value={String(stats.totalProviders)} label="Prestataires" />
            <KPI icon={<Clock size={20} color={colors.soleil} />} value={String(stats.openRequests)} label="Demandes ouvertes" />
            <KPI icon={<CheckCircle size={20} color={colors.vert} />} value={String(stats.completedToday)} label="Terminées auj." />
            <KPI icon={<TrendingUp size={20} color={colors.vert} />} value={`${stats.responseRate}%`} label="Taux de réponse" />
            <KPI icon={<AlertTriangle size={20} color={stats.openDisputes > 0 ? colors.terre : colors.textMuted} />} value={String(stats.openDisputes)} label="Litiges" />
          </View>
        )}

        {/* Response rate bar */}
        {stats && (
          <View style={[styles.rateCard, shadow.card]}>
            <Text style={[text.label, { color: colors.textMuted }]}>TAUX DE RÉPONSE GLOBAL</Text>
            <Text style={[text.data, { color: colors.encre, fontSize: 28, marginTop: 4 }]}>{stats.responseRate}%</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${stats.responseRate}%` }]} />
            </View>
            <Text style={[text.small, { color: colors.textMuted }]}>Objectif : 90%</Text>
          </View>
        )}

        {/* Activity by zone — populated once real requests arrive */}
        <Text style={[text.h3, { color: colors.encre }]}>Activité par zone — Lomé</Text>
        {stats && stats.openRequests === 0 ? (
          <View style={[styles.zoneRow, shadow.card]}>
            <MapPin size={16} color={colors.border} />
            <Text style={[text.small, { color: colors.textMuted }]}>
              Aucune demande pour l'instant.
            </Text>
          </View>
        ) : null}

        {/* Quick links */}
        <View style={styles.quickLinks}>
          {[
            { label: 'File de vérification', route: '/admin/verification', count: stats?.pendingVerifications },
            { label: 'Litiges actifs', route: '/admin/disputes', count: stats?.openDisputes },
            { label: 'Demandes de retrait', route: '/admin/withdrawals', count: stats?.pendingWithdrawals },
            { label: 'Gestion utilisateurs', route: '/admin/users', count: null },
          ].map(l => (
            <Pressable key={l.label} style={styles.quickLink} onPress={() => router.push(l.route as any)}>
              <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{l.label}</Text>
              {l.count != null && l.count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={[text.label, { color: colors.white }]}>{l.count}</Text>
                </View>
              )}
              <Text style={[text.small, { color: colors.vert }]}>→</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={[styles.kpi, shadow.card]}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text style={[text.data, { color: colors.encre, fontSize: 22, marginTop: spacing.sm }]}>{value}</Text>
      <Text style={[text.label, { color: colors.textMuted, marginTop: 2 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exitBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  alertsRow: { gap: spacing.sm },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.md, borderWidth: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { flex: 1, minWidth: '29%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  kpiIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  rateCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.vert },
  zoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  zoneTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  zoneBar: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden', marginBottom: 4 },
  zoneBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.vert },
  quickLinks: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  quickLink: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  countBadge: { backgroundColor: colors.terre, borderRadius: radii.pill, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: spacing.sm },
});
