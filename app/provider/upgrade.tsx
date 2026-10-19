import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Check, Crown, ShieldCheck, Clock } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchMyProviderProfile, createProSubscriptionInvoice, fetchLatestProPayment } from '../../src/lib/api';
import { getProFeatures, PRO_MONTHLY_FEE, GALLERY_CAP_FREE, COMMISSION_RATE, COMMISSION_RATE_PRO, COMMISSION_RATE_INTRO, COMMISSION_RATE_PRO_INTRO, isCommissionIntroPeriod, pctLabel, freeTierCommissionLabel, isCommissionFreePeriod } from '../../src/lib/pricing';
import { reportError } from '../../src/lib/reportError';

import { tr, locale } from '../../src/i18n';
function getFreeFeatures(): string[] {
  return [
    tr('1 service proposé'),
    freeTierCommissionLabel(),
    tr('Classement normal dans les recherches'),
    tr("Jusqu'à {n} photos dans la galerie", { n: GALLERY_CAP_FREE }),
  ];
}

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
  const [discountCode, setDiscountCode] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(() => {
    return fetchMyProviderProfile().then(p => setIsPro(p?.tier === 'pro')).catch(reportError);
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
          setError(tr("Le paiement n'a pas abouti. Vous pouvez réessayer ci-dessous."));
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
      const result: any = await createProSubscriptionInvoice(buildRedirectUrl('return'), buildRedirectUrl('cancel'), discountCode);
      // A 100%-off code skips PayDunya entirely and grants Pro immediately
      // (see paydunya-create-invoice) — no invoiceUrl to redirect to.
      if (result.confirmed) {
        setIsPro(true);
        return;
      }
      if (Platform.OS === 'web') {
        window.location.href = result.invoiceUrl;
      } else {
        await Linking.openURL(result.invoiceUrl);
      }
    } catch (e: any) {
      setError(e.message ?? tr('Échec du démarrage du paiement.'));
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
        <Text style={[text.h2, { color: colors.encre }]}>{tr('Sèvizi Pro')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : isPro ? (
        <View style={styles.activeWrap}>
          <View style={styles.activeIcon}>
            <Crown size={36} color={colors.soleil} fill={colors.soleil} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>{tr('Vous êtes Pro')}</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            {tr('Commission réduite, placement prioritaire et badge vérifié sont déjà actifs sur votre profil.')}</Text>
        </View>
      ) : verifying ? (
        <View style={styles.activeWrap}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center', marginTop: spacing.md }]}>
            {tr('Vérification du paiement…')}</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            {tr('PayDunya confirme votre paiement — cela prend quelques secondes.')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Crown size={32} color={colors.soleil} fill={colors.soleil} />
            <Text style={[text.display, { color: colors.encre, fontSize: 28, textAlign: 'center' }]}>
              {tr("Passez plus de missions, gardez plus d'argent")}</Text>
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              {isCommissionFreePeriod() ? tr('{v0} F / mois — la commission est à 0% pour tout le monde en ce moment, alors profitez-en pour construire votre visibilité avec le placement prioritaire.', { v0: PRO_MONTHLY_FEE.toLocaleString(locale()) }) : tr("{v0} F / mois — la commission réduite ({COMMISSION_RATE_PRO} au lieu de {COMMISSION_RATE}) vous fait économiser dès que vos missions payées dans l'application dépassent {v3} F par mois.", { v0: PRO_MONTHLY_FEE.toLocaleString(locale()), COMMISSION_RATE_PRO: pctLabel(isCommissionIntroPeriod() ? COMMISSION_RATE_PRO_INTRO : COMMISSION_RATE_PRO), COMMISSION_RATE: pctLabel(isCommissionIntroPeriod() ? COMMISSION_RATE_INTRO : COMMISSION_RATE), v3: (Math.round(PRO_MONTHLY_FEE / ((isCommissionIntroPeriod() ? COMMISSION_RATE_INTRO - COMMISSION_RATE_PRO_INTRO : COMMISSION_RATE - COMMISSION_RATE_PRO)) / 1000) * 1000).toLocaleString(locale()) })}
            </Text>
          </View>

          <View style={styles.compareRow}>
            <View style={[styles.planCard, shadow.card]}>
              <Text style={[text.h3, { color: colors.encre }]}>{tr('Gratuit')}</Text>
              <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.sm }]}>{tr('Votre plan actuel')}</Text>
              {getFreeFeatures().map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={[text.small, { color: colors.textMuted }]}>· {f}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.planCard, styles.planCardPro, shadow.card]}>
              <View style={styles.proBadge}>
                <Crown size={12} color={colors.encre} fill={colors.soleil} />
                <Text style={[text.label, { color: colors.encre }]}>{tr('PRO')}</Text>
              </View>
              <Text style={[text.h3, { color: colors.encre }]}>{PRO_MONTHLY_FEE.toLocaleString(locale())} {tr('F/mois')}</Text>
              <Text style={[text.small, { color: colors.vertDark, marginBottom: spacing.sm }]}>{tr('Résiliable à tout moment')}</Text>
              {getProFeatures().map((f, i) => (
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
                {tr('Paiement sécurisé via PayDunya — mobile money (Flooz, T-Money) ou carte. Votre badge vérifié est activé automatiquement dès la confirmation.')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[text.label, { color: colors.textMuted }]}>{tr('CODE PROMO (OPTIONNEL)')}</Text>
            <TextInput
              style={styles.promoInput}
              value={discountCode}
              onChangeText={setDiscountCode}
              placeholder={tr('Ex. LANCEMENT2027')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={tr('Passer à Pro — {v0} F/mois', { v0: PRO_MONTHLY_FEE.toLocaleString(locale()) })}
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
  promoInput: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, ...text.body, color: colors.encre, marginTop: spacing.xs, backgroundColor: colors.white } as any,
  activeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  activeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
