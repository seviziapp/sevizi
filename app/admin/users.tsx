import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users, ShieldCheck, User } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

const MOCK_USERS = [
  { id: 'u1', name: 'Ama Doe', phone: '+228 90 12 34 56', role: 'client', requests: 5, joined: '2025-03-10' },
  { id: 'u2', name: 'Kossi Plomberie', phone: '+228 91 23 45 67', role: 'prestataire', missions: 214, joined: '2024-11-02' },
  { id: 'u3', name: 'Kosi Atta', phone: '+228 92 34 56 78', role: 'client', requests: 2, joined: '2026-01-15' },
  { id: 'u4', name: 'Salon Afi', phone: '+228 93 45 67 89', role: 'prestataire', missions: 380, joined: '2024-08-20' },
  { id: 'u5', name: 'Yawa Nkrumah', phone: '+228 94 56 78 90', role: 'client', requests: 8, joined: '2025-07-05' },
  { id: 'u6', name: 'Transport Koffi', phone: '+228 95 67 89 01', role: 'prestataire', missions: 175, joined: '2025-02-18' },
];

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'client' | 'prestataire'>('all');

  const filtered = MOCK_USERS.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    const matchRole = filter === 'all' || u.role === filter;
    return matchSearch && matchRole;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Users size={24} color={colors.encre} />
        <Text style={[text.h2, { color: colors.encre }]}>Utilisateurs</Text>
        <View style={styles.totalBadge}>
          <Text style={[text.label, { color: colors.encre }]}>{MOCK_USERS.length}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom ou téléphone…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Role filter */}
      <View style={styles.filterRow}>
        {(['all', 'client', 'prestataire'] as const).map(f => (
          <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[text.small, { color: filter === f ? colors.white : colors.encre }]}>
              {f === 'all' ? 'Tous' : f === 'client' ? 'Clients' : 'Prestataires'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filtered.map(u => (
          <View key={u.id} style={[styles.card, shadow.card]}>
            <View style={[styles.avatar, u.role === 'prestataire' && styles.avatarProvider]}>
              {u.role === 'prestataire'
                ? <ShieldCheck size={20} color={colors.white} />
                : <User size={20} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{u.name}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{u.phone}</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>
                {u.role === 'client'
                  ? `${(u as any).requests ?? 0} demandes`
                  : `${(u as any).missions ?? 0} missions`}
              </Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={[text.label, { color: u.role === 'prestataire' ? colors.vert : colors.textMuted }]}>
                {u.role === 'client' ? 'CLIENT' : 'PREST.'}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  totalBadge: { backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, height: 34, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  filterActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  avatarProvider: { backgroundColor: colors.vert },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm, backgroundColor: colors.surface },
});
