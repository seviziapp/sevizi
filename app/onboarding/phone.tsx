import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Phone, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';

const COUNTRY_CODES = [
  { flag: '🇹🇬', code: '+228', country: 'Togo' },
  { flag: '🇧🇯', code: '+229', country: 'Bénin' },
  { flag: '🇬🇭', code: '+233', country: 'Ghana' },
];

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [countryIdx, setCountryIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const country = COUNTRY_CODES[countryIdx];

  async function sendOTP() {
    if (phone.length < 8) return;
    setLoading(true);
    // In production: call Supabase signInWithOtp({ phone: country.code + phone })
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    router.push({ pathname: '/onboarding/otp', params: { phone: country.code + phone } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Logo size={52} />

          <View style={{ marginTop: spacing.xxl }}>
            <Text style={[text.h1, { color: colors.encre }]}>Votre numéro{'\n'}de téléphone</Text>
            <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Nous vous envoyons un code par SMS pour vérifier votre identité.
            </Text>
          </View>

          <View style={styles.field}>
            {/* Country selector */}
            <Pressable
              style={styles.countryBtn}
              onPress={() => setCountryIdx((countryIdx + 1) % COUNTRY_CODES.length)}
            >
              <Text style={{ fontSize: 22 }}>{country.flag}</Text>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{country.code}</Text>
            </Pressable>

            <View style={styles.divider} />

            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="90 12 34 56"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={12}
              autoFocus
            />
          </View>

          <Text style={[text.small, { color: colors.textMuted }]}>
            En continuant, vous acceptez nos{' '}
            <Text style={{ color: colors.vert }}>Conditions d'utilisation</Text>.
          </Text>

          <View style={{ flex: 1 }} />

          <Button
            label="Recevoir le code"
            icon={<ArrowRight size={20} color={colors.white} />}
            onPress={sendOTP}
            loading={loading}
            disabled={phone.length < 8}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radii.md, height: 60, overflow: 'hidden',
  },
  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, height: '100%',
  },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
  input: {
    flex: 1, paddingHorizontal: spacing.md,
    ...text.h3, color: colors.encre, letterSpacing: 2,
  },
});
