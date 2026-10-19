// Sèvizi / Sèvi Go — choose a new password. Opened from the link in the
// "Mot de passe oublié" e-mail: Supabase turns the link into a short-lived
// recovery session, which this screen uses to set the new password.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { LogoFull } from '../../src/components/Logo';
import { SevigoLogoFull } from '../../src/components/SevigoLogo';
import { isSevigoBrand } from '../../src/lib/brand';
import { supabase } from '../../src/lib/supabase';

import { tr } from '../../src/i18n';
const MIN_LEN = 8;

export default function ResetPassword() {
  const router = useRouter();
  const go = isSevigoBrand();
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The recovery session arrives a moment after the page opens (Supabase reads
  // it from the link), so wait for it before deciding the link is invalid.
  useEffect(() => {
    let alive = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) setState(s => (s === 'done' ? s : 'ready'));
    });
    supabase.auth.getSession().then(({ data }) => { if (alive && data.session) setState(s => (s === 'done' ? s : 'ready')); });
    const t = setTimeout(() => { if (alive) setState(s => (s === 'checking' ? 'invalid' : s)); }, 4000);
    return () => { alive = false; clearTimeout(t); sub.subscription.unsubscribe(); };
  }, []);

  async function submit() {
    setError('');
    if (password.length < MIN_LEN) { setError(tr('Choisissez au moins {MIN_LEN} caractères.', { MIN_LEN: MIN_LEN })); return; }
    if (password !== confirm) { setError(tr('Les deux mots de passe ne sont pas identiques.')); return; }
    setSaving(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setState('done');
    } catch (e: any) {
      setError(e.message ?? tr('Impossible de changer le mot de passe.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoRow}>{go ? <SevigoLogoFull height={48} /> : <LogoFull height={52} />}</View>

          {state === 'checking' && <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.xl }} />}

          {state === 'invalid' && (
            <View style={{ gap: spacing.md }}>
              <Text style={[text.h2, { color: colors.encre }]}>{tr('Lien expiré ou invalide')}</Text>
              <Text style={[text.body, { color: colors.textMuted }]}>
                {tr("Ce lien ne fonctionne plus (il est valable peu de temps et une seule fois). Demandez-en un nouveau depuis l'écran de connexion.")}</Text>
              <Pressable style={styles.btn} onPress={() => router.replace('/onboarding/auth' as any)}>
                <Text style={[text.bodyMd, { color: colors.creme }]}>{tr('Retour à la connexion')}</Text>
              </Pressable>
            </View>
          )}

          {state === 'ready' && (
            <View>
              <Text style={[text.h2, { color: colors.encre, marginBottom: spacing.sm }]}>{tr('Nouveau mot de passe')}</Text>
              <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.xl }]}>
                {tr("Choisissez un mot de passe d'au moins")} {MIN_LEN} {tr('caractères.')}</Text>
              <View style={styles.inputWrap}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput style={styles.input} placeholder={tr('Nouveau mot de passe')} placeholderTextColor={colors.textMuted}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" />
                <Pressable onPress={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                </Pressable>
              </View>
              <View style={styles.inputWrap}>
                <Lock size={18} color={colors.textMuted} />
                <TextInput style={styles.input} placeholder={tr('Confirmez le mot de passe')} placeholderTextColor={colors.textMuted}
                  value={confirm} onChangeText={setConfirm} secureTextEntry={!showPw} autoCapitalize="none" />
              </View>
              {!!error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable style={[styles.btn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.creme} /> : <Text style={[text.bodyMd, { color: colors.creme }]}>{tr('Changer le mot de passe')}</Text>}
              </Pressable>
            </View>
          )}

          {state === 'done' && (
            <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl }}>
              <CheckCircle2 size={44} color={colors.vert} />
              <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>{tr('Mot de passe changé')}</Text>
              <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>{tr('Vous êtes connecté. Vous pouvez continuer.')}</Text>
              <Pressable style={[styles.btn, { alignSelf: 'stretch' }]} onPress={() => router.replace('/' as any)}>
                <Text style={[text.bodyMd, { color: colors.creme }]}>{tr('Continuer')}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl, marginTop: spacing.xl },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 52, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  input: { flex: 1, color: colors.encre, fontSize: 16, fontFamily: 'HankenGrotesk_400Regular' },
  errorText: { color: colors.terre, fontSize: 14, marginBottom: spacing.md },
  btn: { height: 52, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
});
