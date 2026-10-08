// Sèvizi — shown to a new person who picks "Je cherche un service" while the
// marketplace is open to providers only. Collects a waitlist entry instead of
// turning them away.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CalendarClock, Wrench, CheckCircle2 } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';
import { alert } from '../../src/lib/alert';
import { fetchClientAccessStatus, formatOpeningDate, joinClientWaitlist } from '../../src/lib/api';

export default function ClientClosedScreen() {
  const router = useRouter();
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'joined' | 'already'>(null);

  useEffect(() => { fetchClientAccessStatus().then(s => setOpensAt(s.opensAt)); }, []);

  async function submit() {
    if (!phone.trim() && !email.trim()) { alert('Contact manquant', 'Indiquez un numéro de téléphone ou une adresse e-mail.'); return; }
    setBusy(true);
    try { setDone(await joinClientWaitlist(phone, email, service)); }
    catch (e: any) { alert('Erreur', e.message ?? "Impossible de vous inscrire pour l'instant."); }
    finally { setBusy(false); }
  }

  const date = formatOpeningDate(opensAt);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Logo size={48} />

          <View style={styles.badge}>
            <CalendarClock size={18} color={colors.vert} />
            <Text style={[text.bodyMd, { color: colors.vertDark }]}>Ouverture aux clients le {date}</Text>
          </View>

          <Text style={[text.h1, { color: colors.encre }]}>On prépare le terrain</Text>
          <Text style={[text.body, { color: colors.textMuted }]}>
            Pour l'instant, Sèvizi accueille les prestataires : nous voulons que, le jour où vous demandez un service,
            plusieurs artisans de confiance vous répondent vite. Laissez-nous votre contact, nous vous prévenons dès l'ouverture.
          </Text>

          {done ? (
            <View style={styles.doneCard}>
              <CheckCircle2 size={28} color={colors.vert} />
              <Text style={[text.h3, { color: colors.encre }]}>
                {done === 'already' ? 'Vous êtes déjà sur la liste' : 'Vous êtes sur la liste'}
              </Text>
              <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
                Nous vous écrirons le {date}. Merci de votre patience !
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <TextInput style={styles.input} placeholder="Téléphone (ex. 90 12 34 56)" keyboardType="phone-pad"
                value={phone} onChangeText={setPhone} placeholderTextColor={colors.textMuted} />
              <TextInput style={styles.input} placeholder="E-mail (facultatif)" keyboardType="email-address" autoCapitalize="none"
                value={email} onChangeText={setEmail} placeholderTextColor={colors.textMuted} />
              <TextInput style={styles.input} placeholder="Quel service cherchez-vous ? (facultatif)"
                value={service} onChangeText={setService} maxLength={200} placeholderTextColor={colors.textMuted} />
              <Button label="Me prévenir à l'ouverture" onPress={submit} loading={busy} />
            </View>
          )}

          <Pressable style={styles.providerLink} onPress={() => router.replace('/onboarding/role' as any)}>
            <Wrench size={16} color={colors.vert} />
            <Text style={[text.bodyMd, { color: colors.vert }]}>Je suis prestataire : m'inscrire maintenant</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill },
  input: { height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, color: colors.encre, fontSize: 16 },
  doneCard: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl },
  providerLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
});
