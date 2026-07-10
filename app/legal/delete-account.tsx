import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, LogIn, Check, X } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { deleteMyAccount } from '../../src/lib/api';

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {ok ? <Check size={16} color={colors.vert} /> : <X size={16} color={colors.terre} />}
      <Text style={[text.body, { color: colors.encre, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export default function DeleteAccount() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }) => setEmail(user?.email ?? null))
      .catch(() => setEmail(null))
      .finally(() => setChecking(false));
  }, []);

  function confirmDelete() {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est immédiate et irréversible. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ],
    );
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      setDone(true);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Échec de la suppression du compte.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Supprimer mon compte</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.label, { color: colors.textMuted }]}>SÈVIZI — DERNIÈRE MISE À JOUR : JUILLET 2026</Text>

        <Text style={[text.body, { color: colors.encre }]}>
          Vous pouvez demander la suppression définitive de votre compte Sèvizi et des données associées
          à tout moment, directement depuis cette page ou depuis l'application (Profil → Sécurité &
          confiance).
        </Text>

        <View style={[styles.card, shadow.card]}>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            CE QUI EST SUPPRIMÉ IMMÉDIATEMENT
          </Text>
          <Row ok>Votre profil (nom, e-mail, téléphone, position)</Row>
          <Row ok>Votre fiche prestataire et votre galerie de travaux, le cas échéant</Row>
          <Row ok>Vos messages, favoris et notifications</Row>
          <Row ok>Vos documents de vérification (pièce d'identité, licence)</Row>
        </View>

        <View style={[styles.card, shadow.card]}>
          <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            CE QUI EST CONSERVÉ (ANONYMISÉ)
          </Text>
          <Row ok={false}>
            L'historique des missions et paiements déjà effectués, sans lien avec votre identité — pour
            préserver l'historique de revenus et d'avis de l'autre partie, et nos obligations comptables
          </Row>
          <Row ok={false}>
            Les avis que vous avez laissés restent visibles (auteur anonymisé) — ils font partie de la
            note publique d'un prestataire
          </Row>
        </View>

        {checking ? (
          <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.lg }} />
        ) : done ? (
          <View style={styles.doneBox}>
            <Check size={20} color={colors.vert} />
            <Text style={[text.body, { color: colors.vertDark, flex: 1 }]}>
              Votre compte a été supprimé.
            </Text>
          </View>
        ) : email ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Text style={[text.small, { color: colors.textMuted }]}>
              Connecté en tant que {email}.
            </Text>
            <Button
              label="Supprimer définitivement mon compte"
              icon={<Trash2 size={18} color={colors.white} />}
              onPress={confirmDelete}
              loading={deleting}
            />
          </View>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Text style={[text.small, { color: colors.textMuted }]}>
              Connectez-vous pour supprimer votre compte directement depuis cette page.
            </Text>
            <Button
              label="Se connecter"
              icon={<LogIn size={18} color={colors.white} />}
              onPress={() => router.push('/onboarding/auth')}
            />
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Vous ne pouvez pas vous connecter ? Écrivez à{' '}
              <Text style={{ color: colors.vert }}>support@sevizi.app</Text> avec l'adresse e-mail de
              votre compte pour demander la suppression.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  doneBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#F2FBF6', borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.lg },
});
