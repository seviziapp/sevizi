import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';

const CODE_LENGTH = 6;

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function handleDigit(val: string, idx: number) {
    const d = [...digits];
    d[idx] = val.slice(-1);
    setDigits(d);
    if (val && idx < CODE_LENGTH - 1) refs.current[idx + 1]?.focus();
  }

  function handleKey(e: any, idx: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }

  const code = digits.join('');
  const filled = code.length === CODE_LENGTH;

  async function verify() {
    if (!phone) { setError('Numéro manquant, revenez en arrière.'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: e } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (e) throw e;
      // Let the index router decide where a session should land (role picker,
      // finish onboarding, or straight to home/dashboard for a returning user).
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Code invalide ou expiré. Réessayez.');
      setLoading(false);
    }
  }

  async function resend() {
    if (!phone || countdown > 0) return;
    setResending(true);
    setError('');
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone });
      if (e) throw e;
      setCountdown(30);
      setDigits(Array(CODE_LENGTH).fill(''));
      refs.current[0]?.focus();
    } catch (e: any) {
      setError(e.message ?? "Impossible de renvoyer le code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.encre} />
          </Pressable>

          <View style={styles.iconWrap}>
            <ShieldCheck size={32} color={colors.vert} />
          </View>

          <Text style={[text.h1, { color: colors.encre }]}>Code de{'\n'}vérification</Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            Entrez le code à 6 chiffres envoyé au{'\n'}
            <Text style={{ color: colors.encre, fontFamily: text.bodyMd.fontFamily }}>{phone ?? '+228 ••••••'}</Text>
          </Text>

          {/* OTP boxes */}
          <View style={styles.boxes}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={el => { refs.current[i] = el; }}
                style={[styles.box, d && styles.boxFilled]}
                value={d}
                onChangeText={v => handleDigit(v, i)}
                onKeyPress={e => handleKey(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {countdown > 0 ? (
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Renvoyer dans <Text style={{ color: colors.encre }}>{countdown}s</Text>
            </Text>
          ) : (
            <Pressable onPress={resend} style={{ alignSelf: 'center' }} disabled={resending}>
              <Text style={[text.small, { color: colors.vert }]}>
                {resending ? 'Envoi…' : 'Renvoyer le code'}
              </Text>
            </Pressable>
          )}

          <View style={{ flex: 1 }} />
          <Button label="Vérifier" onPress={verify} loading={loading} disabled={!filled} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  iconWrap: { width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  boxes: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 48, height: 56, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, textAlign: 'center',
    ...text.h2, color: colors.encre,
  },
  boxFilled: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  errorText: { color: colors.terre, fontSize: 14, textAlign: 'center' },
});
