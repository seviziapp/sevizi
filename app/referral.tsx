// Sèvizi — affiliate/referral program. Reachable from both client and
// provider profile settings (the 300F credit works the same for both
// roles). Top-level file, not under client/ or provider/, since it's
// role-agnostic — same reasoning as app/admin-change-password.tsx.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Gift, Copy, Share2, Users, Wallet, Check } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../src/theme/tokens';
import { Button } from '../src/components/Button';
import {
  fetchReferralOverview, chooseReferralCode, fetchReferralCreditHistory,
  ReferralOverview, ReferralCreditEntry,
} from '../src/lib/api';

const KIND_LABEL: Record<string, string> = {
  bonus_referrer: 'Filleul inscrit',
  bonus_referee: 'Bonus de bienvenue',
  spend_pro: 'Sèvizi Pro',
  spend_sevigo_plan: 'Formule Sèvi Go',
  spend_sevigo_fee: 'Frais Sèvi Go',
};

export default function ReferralScreen() {
  const router = useRouter();
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [history, setHistory] = useState<ReferralCreditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchReferralOverview(), fetchReferralCreditHistory()])
      .then(([o, h]) => { setOverview(o); setHistory(h); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function submitCode() {
    setError('');
    if (!codeInput.trim()) return;
    setSaving(true);
    try {
      await chooseReferralCode(codeInput);
      setCodeInput('');
      load();
    } catch (e: any) {
      setError(e.message ?? 'Échec de la création du code.');
    } finally {
      setSaving(false);
    }
  }

  async function copyCode() {
    if (!overview?.code) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(overview.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      await Share.share({ message: overview.code });
    }
  }

  async function shareCode() {
    if (!overview?.code) return;
    await Share.share({
      message: `Rejoins Sèvizi avec mon code de parrainage "${overview.code}" — on reçoit chacun 300 F à utiliser sur Sèvizi Pro ou Sèvi Go ! sevizi.app`,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Parrainage</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, shadow.card]}>
            <View style={styles.iconWrap}>
              <Gift size={24} color={colors.vert} />
            </View>
            <Text style={[text.bodyMd, { color: colors.encre, textAlign: 'center' }]}>
              300 F pour vous, 300 F pour votre filleul
            </Text>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs }]}>
              Dès qu'une personne s'inscrit avec votre code, vous recevez tous les deux 300 F à utiliser sur l'abonnement Sèvizi Pro ou une formule Sèvi Go. Ce crédit n'est pas retirable et ne peut pas servir à payer un prestataire.
            </Text>
          </View>

          {overview?.code ? (
            <View style={[styles.card, shadow.card]}>
              <Text style={[text.label, { color: colors.textMuted }]}>VOTRE CODE</Text>
              <Text style={[text.h1, { color: colors.vert, letterSpacing: 2, marginTop: spacing.xs }]}>{overview.code}</Text>
              <View style={styles.shareRow}>
                <Pressable style={styles.shareBtn} onPress={copyCode}>
                  {copied ? <Check size={16} color={colors.vert} /> : <Copy size={16} color={colors.encre} />}
                  <Text style={[text.small, { color: colors.encre }]}>{copied ? 'Copié' : 'Copier'}</Text>
                </Pressable>
                <Pressable style={[styles.shareBtn, styles.shareBtnPrimary]} onPress={shareCode}>
                  <Share2 size={16} color={colors.white} />
                  <Text style={[text.small, { color: colors.white }]}>Partager</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.card, shadow.card]}>
              <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>CHOISISSEZ VOTRE CODE</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. : WEAREAURUM"
                placeholderTextColor={colors.textMuted}
                value={codeInput}
                onChangeText={t => setCodeInput(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={20}
              />
              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.xs }]}>
                3 à 20 caractères : lettres, chiffres et tirets.
              </Text>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={{ height: spacing.md }} />
              <Button label="Confirmer mon code" onPress={submitCode} loading={saving} disabled={!codeInput.trim()} />
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={[styles.statCard, shadow.card]}>
              <Wallet size={18} color={colors.vert} />
              <Text style={[text.h3, { color: colors.encre, marginTop: spacing.xs }]}>{(overview?.balance ?? 0).toLocaleString('fr-FR')} F</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>Crédit disponible</Text>
            </View>
            <View style={[styles.statCard, shadow.card]}>
              <Users size={18} color={colors.vert} />
              <Text style={[text.h3, { color: colors.encre, marginTop: spacing.xs }]}>{overview?.referredCount ?? 0}</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>Filleuls inscrits</Text>
            </View>
          </View>

          {history.length > 0 && (
            <View style={[styles.card, shadow.card]}>
              <Text style={[text.bodyMd, { color: colors.encre, marginBottom: spacing.sm }]}>Historique</Text>
              {history.map(h => (
                <View key={h.id} style={styles.historyRow}>
                  <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{KIND_LABEL[h.kind] ?? h.note ?? h.kind}</Text>
                  <Text style={[text.small, { color: h.amount >= 0 ? colors.vert : colors.terre }]}>
                    {h.amount >= 0 ? '+' : ''}{h.amount.toLocaleString('fr-FR')} F
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  iconWrap: {
    width: 48, height: 48, borderRadius: radii.lg, backgroundColor: '#F2FBF6',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  shareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, alignSelf: 'stretch' },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  shareBtnPrimary: { backgroundColor: colors.vert, borderColor: colors.vert },
  input: {
    height: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre,
    alignSelf: 'stretch', textAlign: 'center', letterSpacing: 1,
  },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)', alignSelf: 'stretch' },
});
