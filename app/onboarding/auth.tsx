import { t } from '../../src/i18n';
import { LanguageSwitch } from '../../src/components/LanguageSwitch';
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StaggerIn } from '../../src/components/StaggerIn';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { getQueryParams } from 'expo-auth-session/build/QueryParams';
import { Mail, Lock, Eye, EyeOff, Check } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { LogoFull } from '../../src/components/Logo';
import { SevigoLogoFull } from '../../src/components/SevigoLogo';
import { isSevigoApp, isSevigoBrand } from '../../src/lib/brand';
import { supabase } from '../../src/lib/supabase';

// Required so the in-app browser tab used for OAuth closes itself and hands
// control back to the app once Google redirects to our `sevizi://` scheme.
WebBrowser.maybeCompleteAuthSession();

export default function Auth() {
  const router = useRouter();
  // ?mode=signup opens straight on "Créer un compte" (used by the Sèvi Go landing page).
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'login' | 'signup'>(modeParam === 'signup' ? 'signup' : 'login');
  const go = isSevigoBrand(); // go.sevizi.app and the Sèvi Go Android app present everything as Sèvi Go
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [agreedTC, setAgreedTC] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const [resending, setResending] = useState(false);

  async function handleEmail() {
    setError('');
    setInfo('');
    setPendingConfirmEmail('');
    if (!email || !password) { setError(t('Remplissez tous les champs.')); return; }
    if (mode === 'signup' && !agreedTC) { setError(t("Veuillez accepter les conditions d'utilisation.")); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) {
          // Supabase's own message for this case ("Email not confirmed") is in
          // English regardless of app locale — offer a resend instead of just
          // surfacing the raw error.
          if (e.message?.toLowerCase().includes('email not confirmed') || (e as any).code === 'email_not_confirmed') {
            setPendingConfirmEmail(email);
            setError(t('Confirmez votre e-mail avant de vous connecter.'));
            setLoading(false);
            return;
          }
          throw e;
        }
      } else {
        const { data, error: e } = await supabase.auth.signUp({
          email, password,
          // Bring people back to the site they signed up on (go.sevizi.app vs sevizi.app).
          // `brand` lets the confirmation email greet a Sèvi Go signup as Sèvi Go.
          options: {
            ...(Platform.OS === 'web' ? { emailRedirectTo: window.location.origin + '/' } : {}),
            ...(go ? { data: { brand: 'sevigo' } } : {}),
          },
        });
        if (e) throw e;
        // For an address that already has an account, Supabase answers "success" with
        // an empty identities list and sends NO e-mail (so it can't be probed). Say so
        // plainly instead of promising an e-mail that will never come.
        if (data.user && (data.user.identities?.length ?? 1) === 0) {
          setMode('login');
          setError(t('Un compte existe déjà avec cette adresse. Connectez-vous, ou touchez « Mot de passe oublié ? » pour choisir un nouveau mot de passe.'));
          setLoading(false);
          return;
        }
        // If Supabase requires email confirmation, signUp returns no session.
        // Don't drop the user into the app with no session (it would fail with
        // "Non connecté"); ask them to confirm, then log in.
        if (!data.session) {
          setMode('login');
          setPendingConfirmEmail(email);
          setInfo(t('Compte créé. Vérifiez votre e-mail pour confirmer, puis connectez-vous.'));
          setLoading(false);
          return;
        }
      }
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? t('Une erreur est survenue.'));
    } finally {
      setLoading(false);
    }
  }

  // "Mot de passe oublié": e-mails a link that opens the reset-password screen.
  // The wording never says whether the address has an account (no account enumeration).
  async function forgotPassword() {
    setError(''); setInfo(''); setPendingConfirmEmail('');
    const addr = email.trim();
    if (!addr) { setError(t("Entrez d'abord votre adresse e-mail dans le champ ci-dessus.")); return; }
    setLoading(true);
    try {
      // The link opens in the browser: on the web, back on the same site; in an Android app, on that app's site.
      const base = Platform.OS === 'web' ? window.location.origin : (isSevigoApp() ? 'https://go.sevizi.app' : 'https://sevizi.app');
      const { error: e } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: base + '/onboarding/reset-password' });
      if (e) throw e;
      setInfo(t("Si un compte existe pour cette adresse, un e-mail vient d'être envoyé avec un lien pour choisir un nouveau mot de passe. Pensez à regarder dans les courriers indésirables."));
    } catch (e: any) {
      const m = String(e?.message ?? '');
      setError(/second|rate|too many/i.test(m) ? t('Patientez une minute avant de redemander un e-mail.') : (m || t("Envoi impossible pour l'instant.")));
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingConfirmEmail) return;
    setResending(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.resend({ type: 'signup', email: pendingConfirmEmail });
      if (e) throw e;
      setInfo(t('E-mail de confirmation renvoyé à {email}.', { email: pendingConfirmEmail }));
    } catch (e: any) {
      setError(e.message ?? t("Échec de l'envoi."));
    } finally {
      setResending(false);
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
      if (Platform.OS === 'web') {
        const { error: e } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/' },
        });
        if (e) throw e;
        // On web, Supabase redirects the whole page to Google — execution
        // stops here, so `loading` is intentionally left true.
        return;
      }

      // On native, signInWithOAuth only returns a URL — it doesn't open a
      // browser or handle the redirect on its own. We have to drive both:
      // open Google's consent screen ourselves, wait for it to redirect back
      // to our `sevizi://` scheme, then hand the returned tokens to Supabase.
      // Each Android app has its own link scheme (Sèvizi: sevizi://, Sèvi Go: sevigo://).
      const redirectTo = AuthSession.makeRedirectUri({ scheme: isSevigoApp() ? 'sevigo' : 'sevizi' });
      const { data, error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (e) throw e;
      if (!data?.url) throw new Error(t('Connexion Google échouée.'));

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        // User closed the browser / cancelled — not an error to surface.
        setLoading(false);
        return;
      }

      const { params, errorCode } = getQueryParams(result.url);
      if (errorCode) throw new Error(errorCode);
      if (!params.access_token || !params.refresh_token) {
        throw new Error(t('Connexion Google échouée.'));
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? t('Connexion Google échouée.'));
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'flex-end', marginBottom: spacing.sm }}><LanguageSwitch compact /></View>
          {/* Logo */}
          <StaggerIn index={0}>
            <View style={styles.logoRow}>
              {go ? <SevigoLogoFull height={48} /> : <LogoFull height={52} />}
            </View>
          </StaggerIn>

          <StaggerIn index={1}>
          <Text style={[text.h2, { color: colors.encre, marginBottom: spacing.sm }]}>
            {mode === 'login' ? t('Bon retour') : t('Créer un compte')}
          </Text>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.xl }]}>
            {mode === 'login'
              ? (go ? t('Connectez-vous à votre compte Sèvi Go.') : t('Connectez-vous pour continuer.'))
              : (go ? t('Rejoignez Sèvi Go : votre première facture en quelques minutes.') : t('Rejoignez Sèvizi en quelques secondes.'))}
          </Text>
          </StaggerIn>

          {/* Google button */}
          <StaggerIn index={2}>
          <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
            <Text style={styles.googleG}>G</Text>
            <Text style={[text.bodyMd, { color: colors.encre }]}>
              {t('Continuer avec Google')}
            </Text>
          </Pressable>
          </StaggerIn>

          <StaggerIn index={3}>
          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={[text.label, { color: colors.textMuted, paddingHorizontal: spacing.md }]}>{t('OU')}</Text>
            <View style={styles.line} />
          </View>

          {/* Email */}
          <View style={styles.inputWrap}>
            <Mail size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder={t('Adresse e-mail')}
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
              placeholder={t('Mot de passe')}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
            />
            <Pressable onPress={() => setShowPw(v => !v)}>
              {showPw ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
            </Pressable>
          </View>

          {/* Forgot password — login only */}
          {mode === 'login' && (
            <Pressable onPress={forgotPassword} disabled={loading} style={{ alignSelf: 'flex-end', marginBottom: spacing.md }} hitSlop={8}>
              <Text style={[text.small, { color: colors.vert, fontWeight: '600' }]}>{t('Mot de passe oublié ?')}</Text>
            </Pressable>
          )}

          {/* Terms & conditions — signup only */}
          {mode === 'signup' && (
            <Pressable style={styles.tcRow} onPress={() => setAgreedTC(v => !v)}>
              <View style={[styles.checkbox, agreedTC && styles.checkboxOn]}>
                {agreedTC && <Check size={14} color={colors.white} strokeWidth={3} />}
              </View>
              <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>
                {t("J'accepte les")}{' '}
                <Text
                  style={{ color: colors.vert }}
                  onPress={(e: any) => { e.stopPropagation?.(); router.push('/legal/terms'); }}
                >
                  {t("conditions d'utilisation")}
                </Text>{' '}
                {t('et la')}{' '}
                <Text
                  style={{ color: colors.vert }}
                  onPress={(e: any) => { e.stopPropagation?.(); router.push('/legal/privacy'); }}
                >
                  {t('politique de confidentialité')}
                </Text>{' '}
                {t('de')} {go ? 'Sèvi Go' : 'Sèvizi'}.
              </Text>
            </Pressable>
          )}

          </StaggerIn>

          {/* Info / error */}
          {!!info && <Text style={styles.infoText}>{info}</Text>}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          {!!pendingConfirmEmail && (
            <Pressable onPress={resendConfirmation} disabled={resending} style={{ marginBottom: spacing.md }}>
              <Text style={[text.small, { color: colors.vert, fontWeight: '600' }]}>
                {resending ? t('Envoi…') : t("Renvoyer l'e-mail de confirmation")}
              </Text>
            </Pressable>
          )}

          {/* Submit */}
          <StaggerIn index={4}>
          <Pressable style={[styles.submitBtn, loading && { opacity: 0.6 }]} onPress={handleEmail} disabled={loading}>
            {loading
              ? <ActivityIndicator color={colors.creme} />
              : <Text style={[text.bodyMd, { color: colors.creme }]}>
                  {mode === 'login' ? t('Se connecter') : t('Créer mon compte')}
                </Text>
            }
          </Pressable>
          </StaggerIn>

          {/* Toggle mode */}
          <StaggerIn index={5}>
          <Pressable style={styles.toggleRow} onPress={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); setPendingConfirmEmail(''); }}>
            <Text style={[text.small, { color: colors.textMuted }]}>
              {mode === 'login' ? t('Pas encore de compte ?') + ' ' : t('Déjà un compte ?') + ' '}
            </Text>
            <Text style={[text.small, { color: colors.vert, fontWeight: '600' }]}>
              {mode === 'login' ? t("S'inscrire") : t('Se connecter')}
            </Text>
          </Pressable>
          </StaggerIn>
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
  infoText: { color: colors.vertDark, fontSize: 14, marginBottom: spacing.md },
  tcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.vert, borderColor: colors.vert },
  submitBtn: {
    height: 52, borderRadius: radii.md, backgroundColor: colors.vert,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing.lg,
  },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
