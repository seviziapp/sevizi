// Sèvizi — mandatory password change for a freshly created admin account
// still on the temporary password a super admin set for them. Deliberately
// OUTSIDE app/admin/_layout.tsx (which redirects here whenever
// force_password_change is true) — nesting it under that same gated layout
// would redirect this screen to itself.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../src/theme/tokens';
import { Button } from '../src/components/Button';
import { supabase } from '../src/lib/supabase';
import { fetchMyProfile } from '../src/lib/api';

export default function AdminChangePassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (password.length < 8) { setError('8 caractères minimum.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;
      // Allowed self-update: the DB trigger only lets this flag go true→false
      // when the row's own owner makes the change (see
      // migration_admin_hierarchy.sql → lock_admin_flags).
      const profile = await fetchMyProfile();
      if (profile) {
        await supabase.from('profiles').update({ force_password_change: false }).eq('id', profile.id);
      }
      router.replace('/admin/dashboard');
    } catch (e: any) {
      setError(e.message ?? 'Échec du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={32} color={colors.vert} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>Choisissez votre mot de passe</Text>
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl }]}>
            Votre compte administrateur a été créé avec un mot de passe temporaire. Choisissez-en un nouveau avant de continuer.
          </Text>

          <View style={styles.inputWrap}>
            <Lock size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
            </Pressable>
          </View>

          <View style={{ height: spacing.md }} />

          <View style={styles.inputWrap}>
            <Lock size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor={colors.textMuted}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: spacing.xl }} />
          {loading ? <ActivityIndicator color={colors.vert} /> : (
            <Button label="Continuer" onPress={submit} disabled={!password || !confirm} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 64, height: 64, borderRadius: radii.xl, backgroundColor: '#F2FBF6',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 52, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, fontSize: 15, color: colors.encre },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.md, textAlign: 'center' },
});
