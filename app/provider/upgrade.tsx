import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Crown, ShieldCheck } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchMyProviderProfile, upgradeToPro } from '../../src/lib/api';
import { PRO_FEATURES, PRO_MONTHLY_FEE, GALLERY_CAP_FREE, COMMISSION_RATE, COMMISSION_RATE_PRO } from '../../src/lib/pricing';

const FREE_FEATURES = [
  '1 service proposé',
  `Commission standard (${Math.round(COMMISSION_RATE * 100)}%)`,
  'Classement normal dans les recherches',
  `Jusqu'à ${GALLERY_CAP_FREE} photos dans la galerie`,
];

export default function UpgradeToPro() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [method, setMethod] = useState<'flooz' | 'mixx'>('flooz');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyProviderProfile()
      .then(p => setIsPro(p?.tier === 'pro'))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function upgrade() {
    setError('');
    setUpgrading(true);
    try {
      await upgradeToPro();
      setIsPro(true);
    } catch (e: any) {
      setError(e.message ?? "Échec de l'abonnement.");
    } finally {
      setUpgrading(false);
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
            <Text style={[text.label, { color: colors.textMuted }]}>MOYEN DE PAIEMENT DE L'ABONNEMENT</Text>
            <View style={styles.methodRow}>
              <Pressable style={[styles.methodBtn, method === 'flooz' && styles.methodBtnActive]} onPress={() => setMethod('flooz')}>
                <Text style={[text.bodyMd, { color: method === 'flooz' ? colors.white : colors.encre }]}>Flooz</Text>
              </Pressable>
              <Pressable style={[styles.methodBtn, method === 'mixx' && styles.methodBtnActive]} onPress={() => setMethod('mixx')}>
                <Text style={[text.bodyMd, { color: method === 'mixx' ? colors.white : colors.encre }]}>Mixx by Yas</Text>
              </Pressable>
            </View>
            <View style={styles.noteRow}>
              <ShieldCheck size={14} color={colors.textMuted} />
              <Text style={[text.label, { color: colors.textMuted, flex: 1 }]}>
                Votre badge vérifié est activé automatiquement avec Sèvizi Pro.
              </Text>
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Button label={`Passer à Pro — ${PRO_MONTHLY_FEE.toLocaleString('fr-FR')} F/mois`} onPress={upgrade} loading={upgrading} />
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
  methodRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  methodBtn: { flex: 1, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  methodBtnActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  error: { color: colors.terre, fontSize: 14 },
  activeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  activeIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
