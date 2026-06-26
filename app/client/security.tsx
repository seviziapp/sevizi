import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, ShieldCheck, Trash2, ChevronRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';

export default function Security() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  async function sendPasswordReset() {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error.message);
    } else {
      Alert.alert('Email envoyé', `Un lien de réinitialisation a été envoyé à ${email}.`);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Sécurité & confiance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Verified badge */}
        <View style={[styles.verifiedCard, shadow.card]}>
          <ShieldCheck size={28} color={colors.vert} />
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Compte vérifié</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>
              Votre identité a été vérifiée via votre adresse email.
            </Text>
          </View>
        </View>

        {/* Email */}
        <View>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>MON COMPTE</Text>
          <View style={[styles.list, shadow.card]}>
            <View style={styles.row}>
              <Mail size={20} color={colors.encre} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>Adresse email</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{email || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Password reset */}
        <View>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>MOT DE PASSE</Text>
          <View style={[styles.list, shadow.card]}>
            <Pressable style={styles.row} onPress={sendPasswordReset} disabled={loading}>
              <Lock size={20} color={colors.encre} />
              <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>
                {loading ? 'Envoi en cours…' : 'Changer le mot de passe'}
              </Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Un lien de réinitialisation sera envoyé à votre email.
          </Text>
        </View>

        {/* Danger zone */}
        <View>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>ZONE SENSIBLE</Text>
          <View style={[styles.list, shadow.card]}>
            <Pressable
              style={styles.row}
              onPress={() => Alert.alert(
                'Supprimer le compte',
                'Cette action est irréversible. Contactez le support pour supprimer votre compte.',
                [{ text: 'OK' }]
              )}
            >
              <Trash2 size={20} color={colors.terre} />
              <Text style={[text.bodyMd, { color: colors.terre, flex: 1 }]}>Supprimer mon compte</Text>
              <ChevronRight size={18} color={colors.terre} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  verifiedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.vert },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
