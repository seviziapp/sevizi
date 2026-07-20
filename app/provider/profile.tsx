import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Star, ShieldCheck, Briefcase, Clock, TrendingUp,
  ChevronRight, Bell, LogOut, Settings, Camera, Check, LayoutDashboard, Crown, Trash2, CalendarDays, ListChecks, CalendarClock,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchMyProviderProfile, fetchProviderReviews, fetchMyProfile, deleteMyAccount, toggleBookable } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { CATEGORIES } from '../../src/lib/types';
import type { Provider, Review } from '../../src/lib/types';

export default function ProviderProfile() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifs, setNotifs] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bookable, setBookable] = useState(false);
  const [savingBookable, setSavingBookable] = useState(false);

  useEffect(() => {
    fetchMyProviderProfile()
      .then(p => {
        if (p) {
          setProvider(p);
          setBookable(!!p.bookable);
          fetchProviderReviews(p.id).then(setReviews).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchMyProfile().then(p => { if (p) setIsAdmin(p.isAdmin); }).catch(() => {});
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/onboarding/auth');
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Votre profil, votre galerie, vos messages et vos documents de vérification seront définitivement supprimés. Votre historique de missions terminées reste visible pour vos clients (anonymisé).',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  }

  async function doDeleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      router.replace('/onboarding/auth');
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('Erreur', e.message ?? 'Échec de la suppression du compte.');
    }
  }

  async function onToggleBookable(next: boolean) {
    setBookable(next);
    setSavingBookable(true);
    try {
      await toggleBookable(next);
    } catch (e: any) {
      setBookable(!next);
      Alert.alert('Erreur', e.message ?? "Échec de l'enregistrement.");
    } finally {
      setSavingBookable(false);
    }
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
          <View style={styles.nameRow}>
            <Text style={[text.h2, { color: colors.encre }]}>{provider?.name ?? '—'}</Text>
            {provider?.verified && <ShieldCheck size={20} color={colors.vert} fill={colors.surface} />}
            {provider?.tier === 'pro' && <Crown size={18} color={colors.soleil} fill={colors.soleil} />}
          </View>
          <Text style={[text.body, { color: colors.textMuted }]}>
            {[cat?.label, ...(provider?.categories ?? []).map(c => CATEGORIES.find(x => x.key === c)?.label)].filter(Boolean).join(' · ')} · Lomé
          </Text>
          <View style={styles.badgeRow}>
            {provider?.verified && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color={colors.vert} />
                <Text style={[text.label, { color: colors.vert }]}>PROFIL VÉRIFIÉ</Text>
              </View>
            )}
            {provider?.tier === 'pro' && (
              <View style={styles.proBadge}>
                <Crown size={14} color={colors.encre} fill={colors.soleil} />
                <Text style={[text.label, { color: colors.encre }]}>SÈVIZI PRO</Text>
              </View>
            )}
          </View>
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
            <Pressable onPress={() => router.push('/provider/edit-profile')}>
              <Text style={[text.small, { color: colors.vert }]}>Ajouter</Text>
            </Pressable>
          </View>
          <View style={styles.gallery}>
            {(provider?.gallery ?? []).slice(0, 5).map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.galleryItem} resizeMode="cover" />
            ))}
            <Pressable style={[styles.galleryItem, styles.galleryAdd]} onPress={() => router.push('/provider/edit-profile')}>
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
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/upgrade')}>
            <Crown size={20} color={provider?.tier === 'pro' ? colors.soleil : colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>
              {provider?.tier === 'pro' ? 'Abonnement Sèvizi Pro actif' : 'Passer à Sèvizi Pro'}
            </Text>
            {provider?.tier === 'pro'
              ? <Check size={18} color={colors.vert} />
              : <ChevronRight size={18} color={colors.textMuted} />}
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingBorder]} disabled={savingBookable} onPress={() => onToggleBookable(!bookable)}>
            <CalendarDays size={20} color={colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Rendez-vous en ligne</Text>
            <Switch value={bookable} onValueChange={onToggleBookable} disabled={savingBookable} trackColor={{ false: colors.border, true: colors.vert }} thumbColor={colors.white} />
          </Pressable>
          {bookable && (
            <>
              <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/services')}>
                <ListChecks size={20} color={colors.encre} />
                <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Mes services & tarifs</Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/hours')}>
                <Clock size={20} color={colors.encre} />
                <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Mes horaires</Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
              <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/agenda')}>
                <CalendarClock size={20} color={colors.encre} />
                <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Mon agenda</Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </Pressable>
            </>
          )}
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/verification')}>
            <ShieldCheck size={20} color={provider?.verified ? colors.vert : colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>
              {provider?.verified ? 'Entreprise vérifiée' : 'Vérifier mon entreprise'}
            </Text>
            {provider?.verified
              ? <Check size={18} color={colors.vert} />
              : <ChevronRight size={18} color={colors.textMuted} />}
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/provider/edit-profile')}>
            <Settings size={20} color={colors.encre} />
            <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Modifier mon profil</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </Pressable>
          {isAdmin && (
            <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={() => router.push('/admin/dashboard')}>
              <LayoutDashboard size={20} color={colors.encre} />
              <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Espace admin</Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={logout}>
            <LogOut size={20} color={colors.terre} />
            <Text style={[text.bodyMd, { color: colors.terre, flex: 1 }]}>Se déconnecter</Text>
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingBorder]} onPress={confirmDeleteAccount} disabled={deleting}>
            {deleting ? <ActivityIndicator size="small" color={colors.terre} /> : <Trash2 size={20} color={colors.terre} />}
            <Text style={[text.bodyMd, { color: colors.terre, flex: 1 }]}>
              {deleting ? 'Suppression en cours…' : 'Supprimer mon compte'}
            </Text>
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.encre, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FCEFC7', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill },
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
