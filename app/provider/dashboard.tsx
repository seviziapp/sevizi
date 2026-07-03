import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Bell, TrendingUp, Star, Briefcase, Zap, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { fetchProviderStats, fetchNearbyRequests, toggleOnline, fetchMyProviderProfile, fetchCurrentJob, fetchNotifications, resolveMyLocation, LOME } from '../../src/lib/api';
import type { ProviderStats, ServiceRequest, GeoPoint } from '../../src/lib/types';
import { CATEGORIES } from '../../src/lib/types';

export default function ProviderDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [online, setOnline] = useState(true);
  const [providerName, setProviderName] = useState('');
  const [activeJob, setActiveJob] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  // Resolved once (GPS -> saved address -> Lomé) and reused by the polling
  // refresh below, so we don't re-request location permission every 20s.
  const centerRef = useRef<GeoPoint>(LOME);

  const refreshLive = useCallback(() => {
    fetchNearbyRequests(undefined, centerRef.current).then(r => setRequests(r.slice(0, 3))).catch(() => {});
    fetchCurrentJob().then(setActiveJob).catch(() => {});
    fetchNotifications().then(ns => setUnread(ns.filter(n => !n.read).length)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProviderStats().then(setStats).catch(() => {});
    fetchMyProviderProfile().then(p => { if (p) { setProviderName(p.name); setOnline(p.online); } }).catch(() => {});
    resolveMyLocation().then(pt => { centerRef.current = pt; }).catch(() => {}).finally(refreshLive);
    const t = setInterval(refreshLive, 20000);
    return () => clearInterval(t);
  }, [refreshLive]);

  useFocusEffect(useCallback(() => { refreshLive(); }, [refreshLive]));

  async function handleToggle(v: boolean) {
    setOnline(v);
    await toggleOnline(v).catch(() => {});
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Logo size={36} />
            <View>
              <Text style={[text.small, { color: colors.textMuted }]}>Bienvenue,</Text>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{providerName || 'Mon tableau de bord'}</Text>
            </View>
          </View>
          <Pressable style={styles.bell} onPress={() => router.push('/client/notifications' as any)}>
            <Bell size={20} color={colors.encre} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={[text.label, { color: colors.white, fontSize: 9 }]}>{unread}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Online toggle */}
        <View style={[styles.toggleCard, online ? styles.toggleOnline : styles.toggleOffline]}>
          <View>
            <Text style={[text.h3, { color: online ? colors.encre : colors.textMuted }]}>
              {online ? 'Disponible' : 'Hors ligne'}
            </Text>
            <Text style={[text.small, { color: online ? colors.vertDark : colors.textMuted }]}>
              {online ? 'Vous recevez des demandes à proximité' : 'Activez pour recevoir des demandes'}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.vert }}
            thumbColor={colors.white}
          />
        </View>

        {/* Stats grid */}
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard icon={<Briefcase size={20} color={colors.vert} />} value={String(stats.openRequests)} label="Demandes ouvertes" />
            <StatCard icon={<Zap size={20} color={colors.soleil} />} value={String(stats.sentOffers)} label="Offres envoyées" />
            <StatCard icon={<Star size={20} color={colors.soleil} />} value={stats.rating.toFixed(1)} label="Note moyenne" />
            <StatCard icon={<TrendingUp size={20} color={colors.vert} />} value={`${stats.responseRate}%`} label="Taux de réponse" />
          </View>
        )}

        {/* Earnings banner */}
        {stats && (
          <View style={styles.earningsBanner}>
            <View>
              <Text style={[text.small, { color: colors.textMutedDark }]}>Revenus ce mois</Text>
              <Text style={[text.data, { color: colors.creme, fontSize: 24, marginTop: 2 }]}>
                {stats.earnings.toLocaleString('fr-FR')} F
              </Text>
            </View>
            <Pressable style={styles.walletBtn} onPress={() => router.push('/provider/earnings')}>
              <Text style={[text.small, { color: colors.vert }]}>Voir le détail</Text>
              <ChevronRight size={16} color={colors.vert} />
            </Pressable>
          </View>
        )}

        {/* Active job banner — only shown when there's an active job */}
        {activeJob && (
          <Pressable style={styles.activeJobBanner} onPress={() => router.push('/provider/active-job')}>
            <View style={styles.activeJobDot} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.creme }]}>Mission en cours</Text>
              <Text style={[text.small, { color: colors.textMutedDark }]}>
                {activeJob.clientName || 'Client'} · {activeJob.status === 'en_route' ? 'En route 🚗' : activeJob.status === 'arrive' ? 'Arrivé 📍' : 'En cours 🔧'}
              </Text>
            </View>
            <Text style={[text.small, { color: colors.vert }]}>Gérer →</Text>
          </Pressable>
        )}

        {/* Nearby requests */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>Demandes proches</Text>
          <Pressable onPress={() => router.push('/provider/requests')}>
            <Text style={[text.small, { color: colors.vert }]}>Tout voir</Text>
          </Pressable>
        </View>
        <View style={{ gap: spacing.md }}>
          {requests.map(r => (
            <RequestRow key={r.id} req={r} onPress={() => router.push({ pathname: '/provider/send-offer', params: { requestId: r.id } })} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={[styles.statCard, shadow.card]}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={[text.data, { color: colors.encre, fontSize: 22, marginTop: spacing.sm }]}>{value}</Text>
      <Text style={[text.label, { color: colors.textMuted, marginTop: 2 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function RequestRow({ req, onPress }: { req: ServiceRequest; onPress: () => void }) {
  const cat = CATEGORIES.find(c => c.key === req.category);
  const mins = Math.round((Date.now() - new Date(req.createdAt).getTime()) / 60000);
  return (
    <Pressable style={[styles.reqRow, shadow.card]} onPress={onPress}>
      <View style={styles.catEmoji}>
        <Text style={{ fontSize: 20 }}>{cat?.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.reqTop}>
          <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{req.description}</Text>
          {req.urgent && (
            <View style={styles.urgentTag}><Text style={[text.label, { color: colors.terre }]}>URGENT</Text></View>
          )}
        </View>
        <Text style={[text.small, { color: colors.textMuted }]}>{req.locationLabel} · {mins}min</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bell: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, backgroundColor: colors.terre, alignItems: 'center', justifyContent: 'center' },
  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1 },
  toggleOnline: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  toggleOffline: { borderColor: colors.border, backgroundColor: colors.white },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: { flex: 1, minWidth: '44%', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  earningsBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.encre, borderRadius: radii.lg, padding: spacing.lg },
  walletBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeJobBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.encre, borderRadius: radii.lg, padding: spacing.md },
  activeJobDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.vert },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  catEmoji: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  urgentTag: { backgroundColor: '#F8E2DA', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
});
