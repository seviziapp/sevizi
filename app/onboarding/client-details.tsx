import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User, Phone, Mail, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { saveClientDetails } from '../../src/lib/api';

export default function ClientDetails() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
      const full = user?.user_metadata?.full_name as string | undefined;
      if (full) {
        const [f, ...rest] = full.split(' ');
        setFirstName(f); setLastName(rest.join(' '));
      }
    });
  }, []);

  const valid = firstName.trim() && lastName.trim() && phone.trim().length >= 8 && email.trim();

  async function submit() {
    if (!valid) { setError('Remplissez tous les champs.'); return; }
    setError('');
    setLoading(true);
    try {
      await saveClientDetails({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), email: email.trim() });
      router.replace('/client/home');
    } catch (e: any) {
      setError(e.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo size={48} />
          <Text style={[text.h1, { color: colors.encre, marginTop: spacing.lg }]}>Vos informations</Text>
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            Quelques détails pour créer votre profil. Vous pourrez vous faire vérifier plus tard.
          </Text>

          <Field icon={<User size={18} color={colors.textMuted} />} placeholder="Prénom" value={firstName} onChangeText={setFirstName} />
          <Field icon={<User size={18} color={colors.textMuted} />} placeholder="Nom" value={lastName} onChangeText={setLastName} />
          <Field icon={<Phone size={18} color={colors.textMuted} />} placeholder="Numéro de téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field icon={<Mail size={18} color={colors.textMuted} />} placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: spacing.lg }} />
          <Button
            label="Continuer"
            icon={<ArrowRight size={20} color={colors.white} />}
            onPress={submit}
            loading={loading}
            disabled={!valid}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ icon, ...props }: { icon: React.ReactNode } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.inputWrap}>
      {icon}
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, flexGrow: 1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  input: { flex: 1, color: colors.encre, fontSize: 16, fontFamily: 'HankenGrotesk_400Regular', outlineStyle: 'none' } as any,
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.xs },
});
