import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Star, ShieldCheck, Briefcase, Clock, TrendingUp,
  ChevronRight, Bell, LogOut, Settings, Camera,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchMyProviderProfile, fetchProviderReviews } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { CATEGORIES } from '../../src/lib/types';
import type { Provider, Review } from '../../src/lib/types';

export default function ProviderProfile() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifs, setNotifs] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyProviderProfile()
      .then(p => {
        if (p) {
          setProvider(p);
          fetchProviderReviews(p.id).then(setReviews).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/onboarding/auth');
  }

  const cat = provider ? CATEGORIES.find(c => c.key === provider.category) : null;
  const initial = provider?.name?.[0]?.toUpperCase() ?? '?';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.vert} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={[text.display, { color: colors.creme }]}>{initial}</Text>
            </View>
            <Pressable style={styles.cameraBtn}>
              <Camera size={14} color={colors.white} />
            </Pressable>
          </View>
          <Text style={[text.h2, { color: colors.encre }]}>{provider?.name ?? '—'}</Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            {cat?.label ?? '—'} · Lomé
          </Text>
          {provider?.verified && (
            <View style={styles.verifiedBadge}>
              <ShieldCheck size={14} color={colors.vert} />
              <Text style={[text.label, { color: colors.vert }]}>PROFIL VÉRIFIÉ</Text>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Stat value={provider ? provider.rating.toFixed(1) : '—'} label="Note" icon={<Star size={16} color={colors.soleil} fill={colors.soleil} />} />
          <View style={styles.statDiv} />
          <Stat value={provider ? String(provider.missions ?? 0) : '—'} label="Missions" icon={<Briefcase size={16} color={colors.vert} />} />
          <View style={styles.statDiv} />
          <Stat value={provider ? `${provider.yearsActive ?? 0} ans` : '—'} label="Expérience" icon={<Clock size={16} color={colors.vert} />} />
          <View style={styles.statDiv} />
          <Stat value={provider ? `${provider.responseRate ?? 0}%` : '—'} label="Réponse" icon={<TrendingUp size={16} color={colors.vert} />} />
        </View>

        {/* Bio */}
        {provider?.bio ? (
          <View style={styles.section}>
            <Text style={[text.label, { color: colors.textMuted }]}>À PROPOS</Text>
            <Text style={[text.body, { color: colors.encre, marginTop: spacing.sm }]}>{provider.bio}</Text>
          </View>
        ) : null}

        {/* Gallery placeholder */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[text.label, { color: colors.textMuted }]}>GALERIE DE TRAVAUX</Text>
            <Pressable><Text style={[text.small, { color: colors.vert }]}>Ajouter</Text></Pressable>
          </View>
          <View style={styles.gallery}>
            <Pressable style={[styles.galleryItem, styles.galleryAdd]}>
              <Text style={[text.display, { color: colors.textMuted, fontSize: 28 }]}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[text.label, { color: colors.textMuted }]}>AVIS ({provider?.reviews ?? 0})</Text>
          </View>
          {reviews.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Aucun avis pour l'instant.
            </Text>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
              {reviews.slice(0, 3).map(rv => (
                <View key={rv.id} style={[styles.reviewCard, shadow.card]}>
                  <View style={styles.reviewHead}>
                    <Text style={[text.bodyMd, { color: colors.encre }]}>{rv.authorName}</Text>
                    <View style={styles.stars}>
                      {Array.from({ length: rv.rating }).map((_, i) => (
                        <Star key={i} size={12} color={colors.soleil} fill={colors.soleil} />
                      ))}
                    </View>
                  </View>
                  <Text style={[text.small, { color: colors.textMuted }]}>{rv.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Settings */}
        <View style={styles.settingsList}>
          <Pressable style={styles.settingRow}>
            <Bell size={20} color={colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Notifications</Text>
            <Switch value={notifs} onValueChange={setNotifs} trackColor={{ false: colors.border, true: colors.vert }} thumbColor={colors.white} />
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingBorder]}>
            <Settings size={20} color={colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Paramètres du profil</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={logout}>
            <LogOut size={20} color={colors.terre} />
            <Text style={[text.bodyMd, { color: colors.terre, flex: 1 }]}>Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={[text.data, { color: colors.encre, fontSize: 18 }]}>{value}</Text>
      <Text style={[text.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.encre, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDiv: { width: 1, backgroundColor: colors.border },
  stars: { flexDirection: 'row', gap: 2 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gallery: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  galleryItem: { flex: 1, aspectRatio: 1, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  galleryAdd: { borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.white },
  reviewCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.xs },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsList: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  settingBorder: { borderTopWidth: 1, borderTopColor: colors.border },
});
