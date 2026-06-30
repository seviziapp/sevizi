import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Search, Bell, MapPin, ChevronDown, Plus, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { ProviderCard } from '../../src/components/ProviderCard';
import { CATEGORIES } from '../../src/lib/types';
import { fetchNearbyProviders, fetchCurrentJob, fetchMyProfile, fetchNotifications, fetchMyRequestsWithOffers } from '../../src/lib/api';
import type { Provider, Job, ServiceRequest } from '../../src/lib/types';

const VISIBLE_CATS = CATEGORIES.slice(0, 7);
type OpenReq = ServiceRequest & { offersCount: number };

export default function Home() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [userName, setUserName] = useState('');
  const [unread, setUnread] = useState(0);
  const [openRequests, setOpenRequests] = useState<OpenReq[]>([]);

  const refreshLive = useCallback(() => {
    fetchCurrentJob().then(setActiveJob).catch(() => {});
    fetchNotifications().then(ns => setUnread(ns.filter(n => !n.read).length)).catch(() => {});
    fetchMyRequestsWithOffers().then(rs => setOpenRequests(rs.filter(r => r.status === 'ouverte'))).catch(() => {});
  }, []);

  useEffect(() => {
    fetchNearbyProviders().then(setProviders).catch(() => {});
    fetchMyProfile().then(p => { if (p) setUserName(p.fullName.split(' ')[0]); }).catch(() => {});
    refreshLive();
    // poll so new offers / notifications surface without a manual refresh
    const t = setInterval(refreshLive, 20000);
    return () => clearInterval(t);
  }, [refreshLive]);

  // also refresh when returning to the tab (e.g. right after posting a request)
  useFocusEffect(useCallback(() => { refreshLive(); }, [refreshLive]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Logo size={32} />
            <View>
              <Text style={[text.small, { color: colors.textMuted }]}>Bonjour{userName ? `, ${userName}` : ''}</Text>
              <Pressable style={styles.location} onPress={() => router.push('/onboarding/location')}>
                <MapPin size={14} color={colors.vert} />
                <Text style={[text.bodyMd, { color: colors.encre }]}>Bè-Kpota, Lomé</Text>
                <ChevronDown size={14} color={colors.encre} />
              </Pressable>
            </View>
          </View>
          <Pressable style={styles.bell} onPress={() => router.push('/client/notifications')}>
            <Bell size={20} color={colors.encre} />
            {unread > 0 && <View style={styles.bellBadge}><Text style={[text.label, { color: colors.white, fontSize: 9 }]}>{unread}</Text></View>}
          </Pressable>
        </View>

        {/* Search */}
        <Pressable style={styles.search} onPress={() => router.push('/client/categories')}>
          <Search size={18} color={colors.textMuted} />
          <Text style={[text.body, { color: colors.textMuted }]}>Rechercher un service…</Text>
        </Pressable>

        {/* Active job banner — only shown when there's an active job */}
        {activeJob && (
          <Pressable style={styles.jobBanner} onPress={() => router.push('/client/job-status')}>
            <View style={styles.jobDot} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.creme }]}>Mission en cours</Text>
              <Text style={[text.small, { color: colors.textMutedDark }]}>
                {activeJob.provider?.name ?? 'Prestataire'} · {activeJob.status === 'en_route' ? 'En route 🚗' : activeJob.status === 'arrive' ? 'Arrivé 📍' : activeJob.status === 'en_cours' ? 'En cours 🔧' : 'Accepté ✅'}
              </Text>
            </View>
            <Text style={[text.small, { color: colors.vert }]}>Suivre →</Text>
          </Pressable>
        )}

        {/* My open requests — offers currently coming in */}
        {openRequests.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.sectionHead}>
              <Text style={[text.h3, { color: colors.encre }]}>Mes demandes</Text>
              <Pressable onPress={() => router.push('/client/requests')}>
                <Text style={[text.small, { color: colors.vert }]}>Tout voir</Text>
              </Pressable>
            </View>
            {openRequests.slice(0, 3).map(r => {
              const cat = CATEGORIES.find(c => c.key === r.category);
              return (
                <Pressable
                  key={r.id}
                  style={[styles.reqRow, shadow.card]}
                  onPress={() => router.push({ pathname: '/client/offers', params: { requestId: r.id } })}
                >
                  <View style={styles.reqIcon}><Text style={{ fontSize: 20 }}>{cat?.emoji ?? '🔧'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{r.description}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>{cat?.label} · Ouverte</Text>
                  </View>
                  <View style={[styles.offersPill, r.offersCount > 0 && styles.offersPillActive]}>
                    <Text style={[text.label, { color: r.offersCount > 0 ? colors.white : colors.textMuted }]}>
                      {r.offersCount} offre{r.offersCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Categories grid */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>Catégories</Text>
          <Pressable onPress={() => router.push('/client/categories')}><Text style={[text.small, { color: colors.vert }]}>Tout voir</Text></Pressable>
        </View>
        <View style={styles.catGrid}>
          {VISIBLE_CATS.map((c) => (
            <Pressable
              key={c.key}
              style={styles.cat}
              onPress={() => router.push({ pathname: '/client/new-request', params: { category: c.key } })}
            >
              <View style={styles.catIcon}>
                <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
              </View>
              <Text style={[text.label, { color: colors.encre, textAlign: 'center', fontSize: 11 }]} numberOfLines={1}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cat} onPress={() => router.push('/client/categories')}>
            <View style={styles.catIcon}>
              <Text style={{ fontSize: 22 }}>⋯</Text>
            </View>
            <Text style={[text.label, { color: colors.encre, fontSize: 11 }]}>Plus</Text>
          </Pressable>
        </View>

        {/* CTA banner */}
        <Pressable style={styles.banner} onPress={() => router.push('/client/new-request')}>
          <View style={{ flex: 1 }}>
            <Text style={[text.h3, { color: colors.creme }]}>Un besoin précis ?</Text>
            <Text style={[text.small, { color: colors.textMutedDark, marginTop: 2 }]}>
              Publiez-le, recevez des offres en minutes.
            </Text>
          </View>
          <View style={styles.bannerBtn}>
            <Plus size={16} color={colors.white} />
            <Text style={[text.small, { color: colors.white }]}>Demander</Text>
          </View>
        </Pressable>

        {/* Nearby providers */}
        <View style={styles.sectionHead}>
          <Text style={[text.h3, { color: colors.encre }]}>Prestataires proches</Text>
          <Pressable onPress={() => router.push('/client/map')}>
            <Text style={[text.small, { color: colors.vert }]}>Carte →</Text>
          </Pressable>
        </View>
        <View style={{ gap: spacing.md }}>
          {providers.filter(p => p.online).map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              subtitle={CATEGORIES.find(c => c.key === p.category)?.label}
              onPress={() => router.push({ pathname: '/shared/provider-profile', params: { id: p.id } })}
            />
          ))}
          {providers.filter(p => p.online).length === 0 && (
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>
              Aucun prestataire disponible en ce moment.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.terre, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 52 },
  jobBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.encre, borderRadius: radii.lg, padding: spacing.md },
  jobDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.vert },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  reqIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  offersPill: { backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  offersPillActive: { backgroundColor: colors.vert },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cat: { alignItems: 'center', gap: spacing.xs, width: '22%' },
  catIcon: { width: 56, height: 56, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.encre, borderRadius: radii.lg, padding: spacing.lg },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.vert, paddingHorizontal: spacing.lg, height: 40, borderRadius: radii.md, justifyContent: 'center' },
});
