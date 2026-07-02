import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { LogoFull } from '../../src/components/Logo';
import { supabase } from '../../src/lib/supabase';

export default function Auth() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedTC, setAgreedTC] = useState(false);

  async function handleEmail() {
    setError('');
    if (!email || !password) { setError('Remplissez tous les champs.'); return; }
    if (mode === 'signup' && !agreedTC) { setError('Veuillez accepter les conditions d\'utilisation.'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        // If Supabase requires email confirmation, signUp returns no session.
        // Don't drop the user into the app with no session (it would fail with
        // "Non connecté"); ask them to confirm, then log in.
        if (!data.session) {
          setMode('login');
          setError('Compte créé ✅ Vérifiez votre e-mail pour confirmer, puis connectez-vous.');
          setLoading(false);
          return;
        }
      }
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      // Land on the app root so the index router decides where to go based on
      // the account's real data (dashboard / home / finish onboarding / role).
      // Redirecting straight to /onboarding/role sent EVERY Google login — even
      // already-registered users — back to the welcome screen.
      const redirectTo = Platform.OS === 'web'
        ? window.location.origin + '/'
        : 'sevizi://';
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (e) throw e;
    } catch (e: any) {
      setError(e.message ?? 'Connexion Google échouée.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoRow}>
            <LogoFull height={52} />
          </View>

          <Text style={[text.h2, { color: colors.encre, marginBottom: spacing.sm }]}>
            {mode === 'login' ? 'Bon retour 👋' : 'Créer un compte'}
          </Text>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.xl }]}>
            {mode === 'login'
              ? 'Connectez-vous pour continuer.'
              : 'Rejoignez Sèvizi en quelques secondes.'}
          </Text>

          {/* Google button */}
          <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
            <Text style={styles.googleG}>G</Text>
            <Text style={[text.bodyMd, { color: colors.encre }]}>
              Continuer avec Google
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={[text.label, { color: colors.textMuted, paddingHorizontal: spacing.md }]}>OU</Text>
            <View style={styles.line} />
          </View>

          {/* Email */}
          <View style={styles.inputWrap}>
            <Mail size={18} color={colors.textMuted} />
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
          </View>

          {/* Password */}
          <View style={styles.inputWrap}>
            <Lock size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
            />
            <Pressable onPress={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
            </Pressable>
          </View>

          {/* Terms & conditions — signup only */}
          {mode === 'signup' && (
            <Pressable style={styles.tcRow} onPress={() => setAgreedTC(v => !v)}>
              <View style={[styles.checkbox, agreedTC && styles.checkboxOn]}>
                {agreedTC && <Check size={14} color={colors.white} strokeWidth={3} />}
              </View>
              <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>
                J'accepte les <Text style={{ color: colors.vert }}>conditions d'utilisation</Text> et la politique de confidentialité de Sèvizi.
              </Text>
            </Pressable>
          )}

          {/* Error */}
          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Submit */}
          <Pressable style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleEmail} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.creme} />
              : <Text style={[text.bodyMd, { color: colors.creme }]}>
                  {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                </Text>
            }
          </Pressable>

          {/* Toggle mode */}
          <Pressable style={styles.toggleRow} onPress={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}>
            <Text style={[text.small, { color: colors.textMuted }]}>
              {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            </Text>
            <Text style={[text.small, { color: colors.vert, fontWeight: '600' }]}>
              {mode === 'login' ? 'S\'inscrire' : 'Se connecter'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl, marginTop: spacing.xl },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md,
    height: 52, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, marginBottom: spacing.lg,
  },
  googleG: { fontSize: 18, fontWeight: '700', color: '#4285F4' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  input: { flex: 1, color: colors.encre, fontSize: 16, fontFamily: 'HankenGrotesk_400Regular' },
  errorText: { color: colors.terre, fontSize: 14, marginBottom: spacing.md },
  tcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.vert, borderColor: colors.vert },
  submitBtn: {
    height: 52, borderRadius: radii.md, backgroundColor: colors.vert,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
