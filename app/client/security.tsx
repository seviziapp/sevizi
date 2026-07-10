import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Lock, ShieldCheck, ShieldAlert, Clock, Upload, Check, ChevronRight, Trash2 } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';
import { pickFile } from '../../src/lib/pickFile';
import { uploadDocument, submitClientVerification, fetchMyVerificationStatus, fetchMyProfile, deleteMyAccount } from '../../src/lib/api';

export default function Security() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [idDoc, setIdDoc] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchMyProfile(), fetchMyVerificationStatus()])
      .then(([p, s]) => { if (p) { setEmail(p.email); setVerified(p.verified); } setStatus(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function uploadId() {
    setError('');
    const file = await pickFile();
    if (!file) { setError('Sélection de fichier indisponible sur cet appareil.'); return; }
    setUploading(true);
    try {
      const url = await uploadDocument(file.blob, 'id-docs', file.name);
      setIdDoc({ name: file.name, url });
    } catch (e: any) {
      setError(e.message ?? 'Échec du téléversement.');
    } finally {
      setUploading(false);
    }
  }

  async function submitId() {
    if (!idDoc) { setError('Téléversez d\'abord votre pièce d\'identité.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await submitClientVerification(idDoc.url);
      setStatus('pending');
    } catch (e: any) {
      setError(e.message ?? 'Échec de l\'envoi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    if (!email) return;
    setResetting(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email);
    setResetting(false);
    Alert.alert(e ? 'Erreur' : 'Email envoyé', e ? e.message : `Un lien de réinitialisation a été envoyé à ${email}.`);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Votre profil, vos messages, vos favoris et vos documents de vérification seront définitivement supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDeleteAccount },
      ],
    );
  }

  async function doDeleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      router.replace('/onboarding/auth');
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('Erreur', e.message ?? 'Échec de la suppression du compte.');
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

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Verification status */}
          {verified || status === 'approved' ? (
            <View style={[styles.statusCard, { borderColor: colors.vert }]}>
              <ShieldCheck size={28} color={colors.vert} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>Identité vérifiée</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>Votre compte affiche le badge vérifié.</Text>
              </View>
            </View>
          ) : status === 'pending' ? (
            <View style={[styles.statusCard, { borderColor: colors.soleil }]}>
              <Clock size={28} color={colors.soleil} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>Vérification en cours</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>Nous examinons votre pièce d'identité. Vous pouvez continuer à utiliser Sèvizi.</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.statusCard, { borderColor: colors.border }]}>
              <ShieldAlert size={28} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>Compte non vérifié</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>
                  {status === 'rejected'
                    ? 'Votre pièce n\'a pas pu être validée. Réessayez ci-dessous.'
                    : 'Faites-vous vérifier en envoyant votre pièce d\'identité (facultatif).'}
                </Text>
              </View>
            </View>
          )}

          {/* ID submission */}
          {!verified && status !== 'pending' && status !== 'approved' && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>PIÈCE D'IDENTITÉ</Text>
              <Pressable style={[styles.uploadRow, idDoc && styles.uploadDone]} onPress={uploadId} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color={colors.vert} />
                  : idDoc ? <Check size={20} color={colors.vert} />
                  : <Upload size={20} color={colors.textMuted} />}
                <Text style={[text.small, { color: idDoc ? colors.vert : colors.encre, flex: 1 }]} numberOfLines={1}>
                  {idDoc?.name ?? 'Téléverser une pièce d\'identité (CNI, passeport)'}
                </Text>
              </Pressable>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={{ height: spacing.md }} />
              <Button label="Envoyer pour vérification" onPress={submitId} loading={submitting} disabled={!idDoc} />
            </View>
          )}

          {/* Account */}
          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>MON COMPTE</Text>
          <View style={[styles.list, shadow.card]}>
            <View style={styles.row}>
              <Mail size={20} color={colors.encre} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>Adresse email</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{email || '—'}</Text>
              </View>
            </View>
            <Pressable style={[styles.row, styles.rowBorder]} onPress={sendPasswordReset} disabled={resetting}>
              <Lock size={20} color={colors.encre} />
              <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>
                {resetting ? 'Envoi en cours…' : 'Changer le mot de passe'}
              </Text>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Danger */}
          <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>ZONE SENSIBLE</Text>
          <View style={[styles.list, shadow.card]}>
            <Pressable style={styles.row} onPress={confirmDeleteAccount} disabled={deleting}>
              {deleting ? <ActivityIndicator size="small" color={colors.terre} /> : <Trash2 size={20} color={colors.terre} />}
              <Text style={[text.bodyMd, { color: colors.terre, flex: 1 }]}>
                {deleting ? 'Suppression en cours…' : 'Supprimer mon compte'}
              </Text>
              <ChevronRight size={18} color={colors.terre} />
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1.5 },
  uploadRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 52, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.lg,
  },
  uploadDone: { borderStyle: 'solid', borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  list: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
});
