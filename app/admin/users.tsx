import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users, ShieldCheck, User } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'client' | 'prestataire'>('all');

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setUsers((data ?? []) as UserRow[]); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const name = u.full_name ?? '';
    const phone = u.phone ?? '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || phone.includes(search);
    const matchRole = filter === 'all' || u.role === filter;
    return matchSearch && matchRole;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Users size={24} color={colors.encre} />
        <Text style={[text.h2, { color: colors.encre }]}>Utilisateurs</Text>
        <View style={styles.totalBadge}>
          <Text style={[text.label, { color: colors.encre }]}>{users.length}</Text>
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

      <View style={styles.filterRow}>
        {(['all', 'client', 'prestataire'] as const).map(f => (
          <Pressable key={f} style={[styles.filterChip, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[text.small, { color: filter === f ? colors.white : colors.encre }]}>
              {f === 'all' ? 'Tous' : f === 'client' ? 'Clients' : 'Prestataires'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {filtered.length === 0 && (
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>Aucun utilisateur trouvé.</Text>
          )}
          {filtered.map(u => (
            <View key={u.id} style={[styles.card, shadow.card]}>
              <View style={[styles.avatar, u.role === 'prestataire' && styles.avatarProvider]}>
                {u.role === 'prestataire'
                  ? <ShieldCheck size={20} color={colors.white} />
                  : <User size={20} color={colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{u.full_name || 'Sans nom'}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{u.phone || u.id.slice(0, 8)}</Text>
                <Text style={[text.label, { color: colors.textMuted }]}>
                  Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}
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
      )}
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
