import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Building2, User, Phone, Mail, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { saveProviderDetails } from '../../src/lib/api';
import { CATEGORIES, type ServiceCategory } from '../../src/lib/types';

export default function ProviderDetails() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('plomberie');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
      const full = user?.user_metadata?.full_name as string | undefined;
      if (full) { const [f, ...rest] = full.split(' '); setFirstName(f); setLastName(rest.join(' ')); }
    });
  }, []);

  const valid = companyName.trim() && firstName.trim() && lastName.trim() && phone.trim().length >= 8 && email.trim();

  async function submit() {
    if (!valid) { setError('Remplissez les champs obligatoires.'); return; }
    setError('');
    setLoading(true);
    try {
      await saveProviderDetails({
        companyName: companyName.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
        category, phone: phone.trim(), email: email.trim(), bio: bio.trim() || undefined,
      });
      router.replace('/provider/dashboard');
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
          <Text style={[text.h1, { color: colors.encre, marginTop: spacing.lg }]}>Votre activité</Text>
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            Créez votre profil prestataire. La vérification est facultative — vous pouvez commencer à recevoir des demandes dès maintenant.
          </Text>

          <Field icon={<Building2 size={18} color={colors.textMuted} />} placeholder="Nom de l'entreprise" value={companyName} onChangeText={setCompanyName} />
          <Field icon={<User size={18} color={colors.textMuted} />} placeholder="Prénom" value={firstName} onChangeText={setFirstName} />
          <Field icon={<User size={18} color={colors.textMuted} />} placeholder="Nom" value={lastName} onChangeText={setLastName} />

          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>CATÉGORIE DE SERVICE</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => {
              const active = c.key === category;
              return (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: spacing.md }} />
          <Field icon={<Phone size={18} color={colors.textMuted} />} placeholder="Numéro de téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field icon={<Mail size={18} color={colors.textMuted} />} placeholder="Adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.textareaWrap}>
            <TextInput
              style={styles.textarea}
              placeholder="Décrivez vos services (facultatif)…"
              placeholderTextColor={colors.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              textAlignVertical="top"
            />
          </View>

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
      <TextInput style={styles.input} placeholderTextColor={colors.textMuted} autoCorrect={false} {...props} />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, height: 38, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  textareaWrap: { marginTop: 0 },
  textarea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.lg, minHeight: 90,
    fontSize: 16, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.xs },
});
