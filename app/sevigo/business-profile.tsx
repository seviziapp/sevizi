import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchSevigoBusinessProfile, saveSevigoBusinessProfile } from '../../src/lib/sevigo/api';
import { uploadDocument } from '../../src/lib/api';
import { pickFile } from '../../src/lib/pickFile';

export default function SevigoBusinessProfile() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSevigoBusinessProfile()
      .then(p => {
        if (p) {
          setBusinessName(p.businessName);
          setLogoUrl(p.logoUrl ?? null);
          setContactEmail(p.contactEmail ?? '');
          setContactPhone(p.contactPhone ?? '');
          setAddress(p.address ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function pickLogo() {
    const file = await pickFile();
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadDocument(file.blob, 'sevigo-logos', file.name);
      setLogoUrl(url);
    } catch (e: any) {
      setError(e.message ?? "Échec du téléversement.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!businessName.trim()) { setError("Indiquez le nom de l'entreprise."); return; }
    setError('');
    setSaving(true);
    try {
      await saveSevigoBusinessProfile({
        businessName: businessName.trim(), logoUrl,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        address: address.trim() || undefined,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Profil entreprise</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[text.small, { color: colors.textMuted }]}>
            Ces informations préremplissent vos factures Sèvi Go.
          </Text>

          <Pressable style={styles.logoPicker} onPress={pickLogo} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.vert} />
            ) : logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <>
                <Camera size={22} color={colors.textMuted} />
                <Text style={[text.small, { color: colors.textMuted }]}>Logo</Text>
              </>
            )}
          </Pressable>

          <Field label="Nom de l'entreprise">
            <TextInput style={styles.input} placeholder="Ex : Kossi Plomberie" placeholderTextColor={colors.textMuted} value={businessName} onChangeText={setBusinessName} />
          </Field>
          <Field label="Email de contact">
            <TextInput style={styles.input} placeholder="contact@entreprise.tg" placeholderTextColor={colors.textMuted} value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
          </Field>
          <Field label="Téléphone">
            <TextInput style={styles.input} placeholder="+228 90 00 00 00" placeholderTextColor={colors.textMuted} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
          </Field>
          <Field label="Adresse">
            <TextInput style={styles.input} placeholder="Quartier, ville" placeholderTextColor={colors.textMuted} value={address} onChangeText={setAddress} />
          </Field>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button label="Enregistrer" onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  logoPicker: { width: 88, height: 88, borderRadius: radii.xl, backgroundColor: colors.white, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 4 },
  logoImg: { width: '100%', height: '100%', borderRadius: radii.xl },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', borderRadius: radii.lg, paddingHorizontal: spacing.lg, height: 48, ...text.body, color: colors.encre, ...shadow.sm },
  error: { color: colors.terre, fontSize: 14, textAlign: 'center' },
});
