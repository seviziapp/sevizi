import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  MapPin, Bell, ShieldCheck, HelpCircle, LogOut, ChevronRight,
  Heart, Briefcase, Star, Settings,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

export default function Profile() {
  const router = useRouter();

  const sections = [
    {
      title: 'Mon compte',
      items: [
        { icon: <MapPin size={20} color={colors.encre} />, label: 'Mon adresse', value: 'Bè-Kpota, Lomé', onPress: () => router.push('/onboarding/location') },
        { icon: <Bell size={20} color={colors.encre} />, label: 'Notifications', onPress: () => router.push('/client/notifications') },
        { icon: <Heart size={20} color={colors.encre} />, label: 'Mes favoris', onPress: () => router.push('/client/favorites') },
      ],
    },
    {
      title: 'Mes missions',
      items: [
        { icon: <Briefcase size={20} color={colors.encre} />, label: 'Mission en cours', onPress: () => router.push('/client/job-status') },
        { icon: <Star size={20} color={colors.encre} />, label: 'Mes avis laissés' },
      ],
    },
    {
      title: 'Paramètres',
      items: [
        { icon: <ShieldCheck size={20} color={colors.encre} />, label: 'Sécurité & confiance' },
        { icon: <Settings size={20} color={colors.encre} />, label: 'Devenir prestataire', onPress: () => router.push('/provider/dashboard') },
        { icon: <HelpCircle size={20} color={colors.encre} />, label: 'Aide' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Text style={[text.h2, { color: colors.creme }]}>A</Text>
          </View>
          <Text style={[text.h2, { color: colors.encre }]}>Ama Doe</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>+228 90 12 34 56</Text>
          <View style={styles.roleBadge}>
            <Text style={[text.label, { color: colors.vert }]}>CLIENT</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, shadow.card]}>
          <View style={styles.stat}>
            <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>7</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>DEMANDES</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>5</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>TERMINÉES</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>2</Text>
            <Text style={[text.label, { color: colors.textMuted }]}>FAVORIS</Text>
          </View>
        </View>

        {/* Menu sections */}
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

        {/* Admin shortcut */}
        <Pressable style={styles.adminBtn} onPress={() => router.push('/admin/dashboard')}>
          <Text style={[text.small, { color: colors.textMuted }]}>Mode Admin (dev)</Text>
        </Pressable>

        <Pressable style={styles.logout} onPress={() => router.replace('/onboarding/phone')}>
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
  roleBadge: { backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDiv: { width: 1, backgroundColor: colors.border },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  adminBtn: { alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.terre },
});
