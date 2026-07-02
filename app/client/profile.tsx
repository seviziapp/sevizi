import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MapPin, Bell, ShieldCheck, HelpCircle, LogOut, ChevronRight,
  Heart, Briefcase, Star, Settings, ClipboardList,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';
import { fetchMyProfile } from '../../src/lib/api';

export default function Profile() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullName: string; firstName: string; phone: string; role: string; verified: boolean } | null>(null);

  useEffect(() => {
    fetchMyProfile().then(p => { if (p) setProfile(p); }).catch(() => {});
  }, []);

  const displayName = profile?.firstName || profile?.fullName?.split(' ')[0] || 'Utilisateur';
  const displayPhone = profile?.phone ?? '';
  const initial = displayName[0]?.toUpperCase() ?? 'U';

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/onboarding/auth');
  }

  const sections = [
    {
      title: 'Mon compte',
      items: [
        { icon: <MapPin size={20} color={colors.encre} />, label: 'Mon adresse', onPress: () => router.push('/onboarding/location') },
        { icon: <Bell size={20} color={colors.encre} />, label: 'Notifications', onPress: () => router.push('/client/notifications') },
        { icon: <Heart size={20} color={colors.encre} />, label: 'Mes favoris', onPress: () => router.push('/client/favorites') },
      ],
    },
    {
      title: 'Mes missions',
      items: [
        { icon: <ClipboardList size={20} color={colors.encre} />, label: 'Mes demandes', onPress: () => router.push('/client/requests') },
        { icon: <Briefcase size={20} color={colors.encre} />, label: 'Mission en cours', onPress: () => router.push('/client/job-status') },
        { icon: <Star size={20} color={colors.encre} />, label: 'Mes avis laissés', onPress: () => router.push('/client/my-reviews') },
      ],
    },
    {
      title: 'Paramètres',
      items: [
        { icon: <ShieldCheck size={20} color={colors.encre} />, label: 'Sécurité & confiance', onPress: () => router.push('/client/security') },
        { icon: <Settings size={20} color={colors.encre} />, label: 'Devenir prestataire', onPress: () => router.push('/provider/dashboard') },
        { icon: <HelpCircle size={20} color={colors.encre} />, label: 'Aide', onPress: () => {} },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={[text.h2, { color: colors.creme }]}>{initial}</Text>
          </View>
          <Text style={[text.h2, { color: colors.encre }]}>{displayName}</Text>
          {!!displayPhone && <Text style={[text.small, { color: colors.textMuted }]}>{displayPhone}</Text>}
          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Text style={[text.label, { color: colors.vert }]}>{(profile?.role ?? 'client').toUpperCase()}</Text>
            </View>
            {profile?.verified && (
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={12} color={colors.vert} />
                <Text style={[text.label, { color: colors.vert }]}>VÉRIFIÉ</Text>
              </View>
            )}
          </View>
        </View>

        {sections.map(section => (
          <View key={section.title}>
            <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>{section.title.toUpperCase()}</Text>
            <View style={styles.list}>
              {section.items.map((it, i) => (
                <Pressable
                  key={i}
                  style={[styles.item, i < section.items.length - 1 && styles.itemBorder]}
                  onPress={it.onPress}
                >
                  {it.icon}
                  <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{it.label}</Text>
                  {(it as any).value && <Text style={[text.small, { color: colors.textMuted }]}>{(it as any).value}</Text>}
                  <ChevronRight size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable style={styles.logout} onPress={logout}>
          <LogOut size={20} color={colors.terre} />
          <Text style={[text.bodyMd, { color: colors.terre }]}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  head: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  roleBadge: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2FBF6', borderWidth: 1, borderColor: colors.vert, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.terre },
});
