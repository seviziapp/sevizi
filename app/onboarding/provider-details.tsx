import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { Building2, User, Phone, Mail, ArrowRight, Check, Crown, Gift } from 'lucide-react-native';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { saveProviderDetails, createProSubscriptionInvoice } from '../../src/lib/api';
import { CATEGORIES, type ServiceCategory, type ProviderTier } from '../../src/lib/types';
import { getProFeatures, PRO_MONTHLY_FEE, GALLERY_CAP_FREE, freeTierCommissionLabel } from '../../src/lib/pricing';

import { tr, locale } from '../../src/i18n';
function getFreeFeatures(): string[] {
  return [
    tr('1 service proposé'),
    freeTierCommissionLabel(),
    tr('Classement normal dans les recherches'),
    tr("Jusqu'à {n} photos dans la galerie", { n: GALLERY_CAP_FREE }),
  ];
}

export default function ProviderDetails() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('plomberie');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [tier, setTier] = useState<ProviderTier>('free');
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
    if (!valid) { setError(tr('Remplissez les champs obligatoires.')); return; }
    setError('');
    setLoading(true);
    try {
      await saveProviderDetails({
        companyName: companyName.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
        category, phone: phone.trim(), email: email.trim(), bio: bio.trim() || undefined, tier,
        referralCode: referralCode.trim() || undefined,
      });

      if (tier === 'pro') {
        // The account is created as Free — Pro only activates once PayDunya
        // confirms payment (see src/lib/api.ts createProSubscriptionInvoice).
        const returnUrl = Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/provider/upgrade?payment=return`
          : ExpoLinking.createURL('/provider/upgrade', { queryParams: { payment: 'return' } });
        const cancelUrl = Platform.OS === 'web' && typeof window !== 'undefined'
          ? `${window.location.origin}/provider/dashboard`
          : ExpoLinking.createURL('/provider/dashboard');
        try {
          const { invoiceUrl } = await createProSubscriptionInvoice(returnUrl, cancelUrl);
          router.replace('/provider/dashboard');
          if (Platform.OS === 'web') window.location.href = invoiceUrl;
          else await Linking.openURL(invoiceUrl);
          return;
        } catch {
          // Payment couldn't start — land them on the dashboard as Free;
          // they can retry from Profil > Passer à Sèvizi Pro any time.
        }
      }
      router.replace('/provider/dashboard');
    } catch (e: any) {
      setError(e.message ?? tr('Une erreur est survenue.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo size={48} />
          <Text style={[text.h1, { color: colors.encre, marginTop: spacing.lg }]}>{tr('Votre activité')}</Text>
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            {tr('Créez votre profil prestataire. La vérification est facultative — vous pouvez commencer à recevoir des demandes dès maintenant.')}</Text>

          <Field icon={<Building2 size={18} color={colors.textMuted} />} placeholder={tr("Nom de l'entreprise")} value={companyName} onChangeText={setCompanyName} />
          <Field icon={<User size={18} color={colors.textMuted} />} placeholder={tr('Prénom')} value={firstName} onChangeText={setFirstName} />
          <Field icon={<User size={18} color={colors.textMuted} />} placeholder={tr('Nom')} value={lastName} onChangeText={setLastName} />

          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>{tr('CATÉGORIE DE SERVICE')}</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => {
              const active = c.key === category;
              return (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, active && styles.chipActive]}>
                  <CategoryIcon category={c.key} size={14} color={active ? colors.white : colors.vert} />
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: spacing.md }} />
          <Field icon={<Phone size={18} color={colors.textMuted} />} placeholder={tr('Numéro de téléphone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field icon={<Mail size={18} color={colors.textMuted} />} placeholder={tr('Adresse e-mail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <View style={styles.textareaWrap}>
            <TextInput
              style={styles.textarea}
              placeholder={tr('Décrivez vos services (facultatif)…')}
              placeholderTextColor={colors.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: spacing.md }} />
          <Field
            icon={<Gift size={18} color={colors.textMuted} />}
            placeholder={tr('Code de parrainage (facultatif)')}
            value={referralCode}
            onChangeText={t => setReferralCode(t.toUpperCase())}
            autoCapitalize="characters"
          />

          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm }]}>{tr('CHOISISSEZ VOTRE FORMULE')}</Text>
          <View style={styles.tierRow}>
            <Pressable style={[styles.tierCard, tier === 'free' && styles.tierCardActive]} onPress={() => setTier('free')}>
              <View style={styles.tierHead}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('Gratuit')}</Text>
                {tier === 'free' && <Check size={16} color={colors.vert} />}
              </View>
              {getFreeFeatures().map((f, i) => (
                <Text key={i} style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>· {f}</Text>
              ))}
            </Pressable>
            <Pressable style={[styles.tierCard, styles.tierCardPro, tier === 'pro' && styles.tierCardActive]} onPress={() => setTier('pro')}>
              <View style={styles.tierHead}>
                <View style={styles.proLabel}>
                  <Crown size={13} color={colors.encre} fill={colors.soleil} />
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('Pro')}</Text>
                </View>
                {tier === 'pro' && <Check size={16} color={colors.vert} />}
              </View>
              <Text style={[text.small, { color: colors.vertDark, marginBottom: 2 }]}>
                {PRO_MONTHLY_FEE.toLocaleString(locale())} {tr('F/mois')}</Text>
              {getProFeatures().map((f, i) => (
                <Text key={i} style={[text.small, { color: colors.encre, marginTop: 4 }]}>· {f}</Text>
              ))}
            </Pressable>
          </View>
          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {tr('Vous pourrez changer de formule à tout moment depuis votre profil.')}</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={{ height: spacing.lg }} />
          <Button
            label={tier === 'pro' ? tr('Continuer — Pro {v0} F/mois', { v0: PRO_MONTHLY_FEE.toLocaleString(locale()) }) : tr('Continuer — Gratuit')}
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
  tierRow: { flexDirection: 'row', gap: spacing.md },
  tierCard: { flex: 1, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  tierCardPro: { borderColor: colors.soleil },
  tierCardActive: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  tierHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
