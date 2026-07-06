import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Check, Crown, ShieldCheck, Clock } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchMyProviderProfile, createProSubscriptionInvoice, fetchLatestProPayment } from '../../src/lib/api';
import { PRO_FEATURES, PRO_MONTHLY_FEE, GALLERY_CAP_FREE, COMMISSION_RATE, COMMISSION_RATE_PRO } from '../../src/lib/pricing';

const FREE_FEATURES = [
  '1 service proposé',
  `Commission standard (${Math.round(COMMISSION_RATE * 100)}%)`,
  'Classement normal dans les recherches',
  `Jusqu'à ${GALLERY_CAP_FREE} photos dans la galerie`,
];

function buildRedirectUrl(status: 'return' | 'cancel'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/provider/upgrade?payment=${status}`;
  }
  return ExpoLinking.createURL('/provider/upgrade', { queryParams: { payment: status } });
}

export default function UpgradeToPro() {
  const router = useRouter();
  const { payment: paymentParam } = useLocalSearchParams<{ payment?: string }>();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);
  // Set right after returning from PayDunya's checkout page — the webhook
  // that actually grants Pro runs async, so we poll briefly instead of
  // assuming success/failure immediately.
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    return fetchMyProviderProfile().then(p => setIsPro(p?.tier === 'pro')).catch(() => {});
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Re-check whenever the screen regains focus (e.g. coming back from the
  // browser tab / app after paying) so a completed payment shows up without
  // a manual reload.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (paymentParam !== 'return') return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const [profile, payment] = await Promise.all([fetchMyProviderProfile(), fetchLatestProPayment()]);
      if (profile?.tier === 'pro') {
        setIsPro(true);
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (payment?.status === 'failed' || payment?.status === 'cancelled' || attempts >= 10) {
        setVerifying(false);
        if (payment?.status === 'failed' || payment?.status === 'cancelled') {
          setError("Le paiement n'a pas abouti. Vous pouvez réessayer ci-dessous.");
        }
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam]);

  async function startCheckout() {
    setError('');
    setStartingCheckout(true);
    try {
      const { invoiceUrl } = await createProSubscriptionInvoice(buildRedirectUrl('return'), buildRedirectUrl('cancel'));
      if (Platform.OS === 'web') {
        window.location.href = invoiceUrl;
      } else {
        await Linking.openURL(invoiceUrl);
      }
    } catch (e: any) {
      setError(e.message ?? "Échec du démarrage du paiement.");
    } finally {
      setStartingCheckout(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Sèvizi Pro</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : isPro ? (
        <View style={styles.activeWrap}>
          <View style={styles.activeIcon}>
            <Crown size={36} color={colors.soleil} fill={colors.soleil} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>Vous êtes Pro 🎉</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Commission réduite, placement prioritaire et badge vérifié sont déjà actifs sur votre profil.
          </Text>
        </View>
      ) : verifying ? (
        <View style={styles.activeWrap}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center', marginTop: spacing.md }]}>
            Vérification du paiement…
          </Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            PayDunya confirme votre paiement — cela prend quelques secondes.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Crown size={32} color={colors.soleil} fill={colors.soleil} />
            <Text style={[text.display, { color: colors.encre, fontSize: 28, textAlign: 'center' }]}>
              Passez plus de missions, gardez plus d'argent
            </Text>
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {PRO_MONTHLY_FEE.toLocaleString('fr-FR')} F / mois — la commission réduite ({Math.round(COMMISSION_RATE_PRO * 100)}% au lieu de {Math.round(COMMISSION_RATE * 100)}%) suffit à couvrir l'abonnement dès votre premier gros contrat du mois.
            </Text>
          </View>

          <View style={styles.compareRow}>
            <View style={[styles.planCard, shadow.card]}>
              <Text style={[text.h3, { color: colors.encre }]}>Gratuit</Text>
              <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.sm }]}>Votre plan actuel</Text>
              {FREE_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={[text.small, { color: colors.textMuted }]}>· {f}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.planCard, styles.planCardPro, shadow.card]}>
              <View style={styles.proBadge}>
                <Crown size={12} color={colors.encre} fill={colors.soleil} />
                <Text style={[text.label, { color: colors.encre }]}>PRO</Text>
              </View>
              <Text style={[text.h3, { color: colors.encre }]}>{PRO_MONTHLY_FEE.toLocaleString('fr-FR')} F/mois</Text>
              <Text style={[text.small, { color: colors.vertDark, marginBottom: spacing.sm }]}>Résiliable à tout moment</Text>
              {PRO_FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Check size={14} color={colors.vert} />
                  <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.noteRow}>
              <ShieldCheck size={14} color={colors.textMuted} />
              <Text style={[text.label, { color: colors.textMuted, flex: 1 }]}>
                Paiement sécurisé via PayDunya — mobile money (Flooz, T-Money) ou carte. Votre badge vérifié est activé automatiquement dès la confirmation.
              </Text>
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={`Passer à Pro — ${PRO_MONTHLY_FEE.toLocaleString('fr-FR')} F/mois`}
            onPress={startCheckout}
            loading={startingCheckout}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  hero: { alignItems: 'center', gap: spacing.sm },
  compareRow: { flexDirection: 'row', gap: spacing.md },
  planCard: { flex: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  planCardPro: { borderColor: colors.vert, borderWidth: 2 },
  proBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm, marginBottom: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.xs },
  section: { gap: spacing.sm },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.terre, fontSize: 14 },
  activeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  activeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
