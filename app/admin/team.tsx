// Sèvizi — super-admin-only screen: create new admin logins (always a
// fresh, separate auth account — never a promoted client/prestataire, see
// migration_admin_hierarchy.sql), and manage the existing roster (promote /
// demote / revoke). A plain admin who navigates here directly is bounced —
// this is deliberately stricter than the app/admin/_layout.tsx gate, which
// only checks is_admin.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Users, Shield, ShieldCheck, Plus, X, Copy, Trash2 } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { alert } from '../../src/lib/alert';
import { fetchMyProfile, fetchAdminTeam, createAdmin, promoteToSuperAdmin, demoteFromSuperAdmin, revokeAdmin, AdminTeamMember } from '../../src/lib/api';

function genTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function AdminTeam() {
  const router = useRouter();
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [team, setTeam] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [tempPw, setTempPw] = useState(genTempPassword());
  const [error, setError] = useState('');
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const profile = await fetchMyProfile().catch(() => null);
    if (!profile?.isSuperAdmin) { setAccess('denied'); return; }
    setAccess('ok');
    setLoading(true);
    fetchAdminTeam().then(setTeam).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function submitCreate() {
    setError('');
    if (!email.includes('@')) { setError('Email invalide.'); return; }
    if (!fullName.trim()) { setError('Nom requis.'); return; }
    if (tempPw.length < 8) { setError('Mot de passe temporaire : 8 caractères minimum.'); return; }
    setCreating(true);
    try {
      await createAdmin({ email: email.trim(), fullName: fullName.trim(), temporaryPassword: tempPw });
      setLastCreated({ email: email.trim(), password: tempPw });
      setEmail(''); setFullName(''); setTempPw(genTempPassword());
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message ?? 'Échec de la création.');
    } finally {
      setCreating(false);
    }
  }

  function confirmRevoke(m: AdminTeamMember) {
    alert(
      'Révoquer cet accès',
      `${m.fullName} (${m.email}) perdra immédiatement l'accès au back-office. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Révoquer', style: 'destructive', onPress: () => doRevoke(m.id) },
      ],
    );
  }

  async function doRevoke(id: string) {
    try {
      await revokeAdmin(id);
      load();
    } catch (e: any) {
      alert('Erreur', e.message ?? 'Échec de la révocation.');
    }
  }

  async function toggleSuperAdmin(m: AdminTeamMember) {
    try {
      if (m.isSuperAdmin) await demoteFromSuperAdmin(m.id);
      else await promoteToSuperAdmin(m.id);
      load();
    } catch (e: any) {
      alert('Erreur', e.message ?? 'Échec de la mise à jour.');
    }
  }

  if (access === 'checking') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }
  if (access === 'denied') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.encre} />
          </Pressable>
          <Text style={[text.h2, { color: colors.encre }]}>Équipe admin</Text>
          <View style={{ width: 40 }} />
        </View>
        <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
          Réservé aux super admins.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Équipe admin</Text>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => setShowForm(v => !v)}>
          {showForm ? <X size={20} color={colors.encre} /> : <Plus size={20} color={colors.encre} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {lastCreated && (
          <View style={[styles.card, { borderColor: colors.vert, backgroundColor: '#F2FBF6' }]}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Compte créé</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>
              Partagez ces identifiants à {lastCreated.email} hors ligne (Signal, en personne…). Ils devront choisir un nouveau mot de passe à la première connexion.
            </Text>
            <View style={styles.credRow}>
              <Text style={[text.small, { color: colors.encre }]}>Email : {lastCreated.email}</Text>
            </View>
            <View style={styles.credRow}>
              <Text style={[text.small, { color: colors.encre }]}>Mot de passe : {lastCreated.password}</Text>
            </View>
            <Pressable onPress={() => setLastCreated(null)} style={{ marginTop: spacing.sm }}>
              <Text style={[text.label, { color: colors.vert }]}>OK, compris</Text>
            </Pressable>
          </View>
        )}

        {showForm && (
          <View style={[styles.card, shadow.card]}>
            <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>NOUVEL ADMIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom complet"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
            <View style={{ height: spacing.sm }} />
            <TextInput
              style={styles.input}
              placeholder="Adresse e-mail"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ height: spacing.sm }} />
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Mot de passe temporaire"
                placeholderTextColor={colors.textMuted}
                value={tempPw}
                onChangeText={setTempPw}
                autoCapitalize="none"
              />
              <Pressable style={styles.pwRegen} onPress={() => setTempPw(genTempPassword())}>
                <Copy size={16} color={colors.encre} />
              </Pressable>
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={{ height: spacing.md }} />
            <Button label="Créer le compte" onPress={submitCreate} loading={creating} />
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} />
        ) : team.length === 0 ? (
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>Aucun admin.</Text>
        ) : (
          team.map(m => (
            <View key={m.id} style={[styles.card, shadow.card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
              <View style={[styles.avatar, m.isSuperAdmin && styles.avatarSuper]}>
                {m.isSuperAdmin ? <ShieldCheck size={20} color={colors.white} /> : <Shield size={20} color={colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{m.fullName}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{m.email}</Text>
                <Text style={[text.label, { color: m.isSuperAdmin ? colors.vert : colors.textMuted }]}>
                  {m.isSuperAdmin ? 'SUPER ADMIN' : 'ADMIN'}{m.forcePasswordChange ? ' · en attente de connexion' : ''}
                </Text>
              </View>
              <Pressable style={styles.iconBtn} onPress={() => toggleSuperAdmin(m)}>
                <Text style={[text.label, { color: colors.vert }]}>{m.isSuperAdmin ? 'Rétrograder' : 'Promouvoir'}</Text>
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => confirmRevoke(m)}>
                <Trash2 size={18} color={colors.terre} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  input: {
    height: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pwRegen: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
  credRow: { marginTop: spacing.xs },
  avatar: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  avatarSuper: { backgroundColor: colors.vert },
  iconBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
});
