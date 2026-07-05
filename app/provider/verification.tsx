import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck, Upload, FileText, Clock, Check, Crown } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { pickFile } from '../../src/lib/pickFile';
import { uploadDocument, submitProviderVerification, fetchMyVerificationStatus, fetchMyProviderProfile } from '../../src/lib/api';

export default function ProviderVerification() {
  const router = useRouter();
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState('');
  const [tradeDoc, setTradeDoc] = useState<{ name: string; url: string } | null>(null);
  const [idDoc, setIdDoc] = useState<{ name: string; url: string } | null>(null);
  const [uploading, setUploading] = useState<'trade' | 'id' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetchMyVerificationStatus(), fetchMyProviderProfile()])
      .then(([s, p]) => { setStatus(s); setAlreadyVerified(!!p?.verified); setIsPro(p?.tier === 'pro'); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function upload(which: 'trade' | 'id') {
    setError('');
    const file = await pickFile();
    if (!file) { setError('Sélection de fichier indisponible sur cet appareil.'); return; }
    setUploading(which);
    try {
      const url = await uploadDocument(file.blob, which === 'trade' ? 'trade-docs' : 'id-docs', file.name);
      if (which === 'trade') setTradeDoc({ name: file.name, url });
      else setIdDoc({ name: file.name, url });
    } catch (e: any) {
      setError(e.message ?? 'Échec du téléversement.');
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    if (!companyInfo.trim() && !tradeDoc) { setError('Ajoutez vos informations d\'entreprise ou un document.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await submitProviderVerification({
        companyInfo: companyInfo.trim(),
        tradeDocUrl: tradeDoc?.url,
        idDocUrl: idDoc?.url,
      });
      setStatus('pending');
    } catch (e: any) {
      setError(e.message ?? 'Échec de l\'envoi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Vérification</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {alreadyVerified ? (
            <StatusCard color={colors.vert} icon={<ShieldCheck size={28} color={colors.vert} />}
              title="Entreprise vérifiée" body="Votre profil affiche le badge vérifié auprès des clients." />
          ) : status === 'pending' ? (
            <StatusCard color={colors.soleil} icon={<Clock size={28} color={colors.soleil} />}
              title="Vérification en cours" body="Notre équipe examine vos documents. Vous pouvez continuer à utiliser Sèvizi entre-temps." />
          ) : status === 'rejected' ? (
            <StatusCard color={colors.terre} icon={<FileText size={28} color={colors.terre} />}
              title="Demande refusée" body="Vos documents n'ont pas pu être validés. Vous pouvez soumettre à nouveau ci-dessous." />
          ) : (
            <StatusCard color={colors.encre} icon={<ShieldCheck size={28} color={colors.vert} />}
              title="Devenez prestataire vérifié" body="Le badge vérifié rassure les clients et augmente vos chances d'être choisi. Facultatif." />
          )}

          {!alreadyVerified && !isPro && status !== 'pending' && (
            <Pressable style={styles.upsell} onPress={() => router.push('/provider/upgrade')}>
              <Crown size={14} color={colors.soleil} fill={colors.soleil} />
              <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
                Passez à Sèvizi Pro pour un badge vérifié immédiat, sans attendre l'examen des documents.
              </Text>
            </Pressable>
          )}

          {!alreadyVerified && status !== 'pending' && (
            <>
              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>INFORMATIONS DE L'ENTREPRISE</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Numéro de registre du commerce, adresse, années d'activité…"
                placeholderTextColor={colors.textMuted}
                value={companyInfo}
                onChangeText={setCompanyInfo}
                multiline
                textAlignVertical="top"
              />

              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>LICENCE / DOCUMENT DE MÉTIER</Text>
              <UploadRow label={tradeDoc?.name ?? 'Téléverser la licence du propriétaire'} done={!!tradeDoc} busy={uploading === 'trade'} onPress={() => upload('trade')} />

              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>PIÈCE D'IDENTITÉ (FACULTATIF)</Text>
              <UploadRow label={idDoc?.name ?? 'Téléverser une pièce d\'identité'} done={!!idDoc} busy={uploading === 'id'} onPress={() => upload('id')} />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={{ height: spacing.xl }} />
              <Button label="Envoyer pour vérification" onPress={submit} loading={submitting} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatusCard({ color, icon, title, body }: { color: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={[styles.statusCard, { borderColor: color }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyMd, { color: colors.encre }]}>{title}</Text>
        <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{body}</Text>
      </View>
    </View>
  );
}

function UploadRow({ label, done, busy, onPress }: { label: string; done: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.uploadRow, done && styles.uploadDone]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={colors.vert} />
        : done ? <Check size={20} color={colors.vert} />
        : <Upload size={20} color={colors.textMuted} />}
      <Text style={[text.small, { color: done ? colors.vert : colors.encre, flex: 1 }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1.5, ...shadow.card },
  textarea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.lg, minHeight: 90, marginTop: spacing.sm,
    fontSize: 15, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  uploadRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm,
    height: 52, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.lg,
  },
  uploadDone: { borderStyle: 'solid', borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.md },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FCEFC7', borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
});
