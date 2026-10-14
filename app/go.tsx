// Sèvi Go — public landing page, shown on go.sevizi.app (web) to signed-out
// visitors. Same app and backend as Sèvizi; this is only a different front
// door aimed at shop owners and small businesses. See app/index.tsx for the
// host-based routing.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { FileText, Users, CreditCard, BarChart3, Store, Check, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../src/theme/tokens';
import { SevigoLogoFull } from '../src/components/SevigoLogo';
import { StaggerIn } from '../src/components/StaggerIn';
import { SEVIGO_PLANS } from '../src/lib/sevigo/types';

const FEATURES = [
  { Icon: FileText, title: 'Factures à votre image', body: 'Votre logo, votre nom, votre numérotation. Imprimez en A4 ou en ticket 80 mm, ou envoyez par e-mail.' },
  { Icon: Users, title: 'Votre fichier clients', body: 'Chaque client est enregistré. À la prochaine facture, vous le choisissez en un geste.' },
  { Icon: CreditCard, title: 'Paiement par mobile money', body: 'Vos clients règlent la facture en ligne (T-Money, Flooz, carte). Vous suivez ce qui est payé et ce qui est en retard.' },
  { Icon: BarChart3, title: 'Rapports clairs', body: "Chiffre d'affaires, factures impayées, meilleurs clients : vos chiffres du mois sans calculatrice.", note: 'À partir de Starter' },
  { Icon: Store, title: 'Caisse et stock', body: "Listez vos produits, vendez au comptoir, le stock se met à jour tout seul et chaque vente a son reçu.", note: 'Formule Unlimited' },
];

function planFeatures(p: (typeof SEVIGO_PLANS)[number]): string[] {
  const out: string[] = [];
  if (p.includedInvoices === null) out.push('Factures illimitées');
  else if (p.id === 'payg') out.push('3 factures offertes par mois, puis 500 F');
  else out.push(`${p.includedInvoices} factures incluses, puis ${p.extraInvoiceFee} F`);
  out.push(`Commission sur paiement en ligne : ${Math.round(p.paydunyaFeePct * 100)}%`);
  if (p.hasReports) out.push('Rapports et analyses');
  if (p.hasPos) out.push('Caisse (POS) et gestion de stock');
  return out;
}

export default function SevigoLanding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const signup = () => router.push('/onboarding/auth?mode=signup' as any);
  const login = () => router.push('/onboarding/auth' as any);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Head>
        <title>Sèvi Go · Factures et caisse pour votre commerce à Lomé</title>
        <meta name="description" content="Sèvi Go : faites vos factures avec votre logo, gardez la liste de vos clients, encaissez par mobile money et tenez votre caisse. Gratuit pour commencer." />
      </Head>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Top bar */}
          <StaggerIn index={0}>
            <View style={styles.topBar}>
              <SevigoLogoFull height={34} />
              <Pressable onPress={login} hitSlop={8}>
                <Text style={[text.bodyMd, { color: colors.vert }]}>Se connecter</Text>
              </Pressable>
            </View>
          </StaggerIn>

          {/* Hero */}
          <View style={[styles.hero, wide && { paddingTop: spacing.xxxl * 1.5 }]}>
            <StaggerIn index={1}>
              <Text style={[styles.headline, wide && { fontSize: 52, lineHeight: 56 }]}>
                Vos factures et votre caisse,{wide ? '\n' : ' '}depuis votre téléphone
              </Text>
            </StaggerIn>
            <StaggerIn index={2}>
              <Text style={[text.body, styles.sub, wide && { fontSize: 19, lineHeight: 28 }]}>
                Sèvi Go aide les commerçants et artisans de Lomé à facturer proprement, suivre leurs clients et encaisser par mobile money.
              </Text>
            </StaggerIn>
            <StaggerIn index={3}>
              <View style={styles.ctaRow}>
                <Pressable style={styles.cta} onPress={signup}>
                  <Text style={[text.bodyMd, { color: colors.white }]}>Commencer gratuitement</Text>
                  <ArrowRight size={18} color={colors.white} />
                </Pressable>
                <Text style={[text.small, { color: colors.textMuted }]}>Sans carte. 3 factures offertes chaque mois.</Text>
              </View>
            </StaggerIn>
          </View>

          {/* Feature cards */}
          <View style={[styles.cards, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
            {FEATURES.map((f, i) => (
              <StaggerIn key={f.title} index={4 + i} style={wide ? { flexBasis: '31%', flexGrow: 1 } : undefined}>
                <View style={[styles.card, shadow.card]}>
                  <View style={styles.iconWrap}><f.Icon size={22} color={colors.vert} /></View>
                  <Text style={[text.h3, { color: colors.encre }]}>{f.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{f.body}</Text>
                  {f.note ? <Text style={[text.label, { color: colors.vert }]}>{f.note.toUpperCase()}</Text> : null}
                </View>
              </StaggerIn>
            ))}
          </View>

          {/* Pricing */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Des prix simples</Text>
            <Text style={[text.body, { color: colors.textMuted }]}>
              Commencez gratuitement. Passez à une formule quand votre activité grandit. Paiement annuel : 2 mois offerts.
            </Text>
            <View style={[styles.plans, wide && { flexDirection: 'row' }]}>
              {SEVIGO_PLANS.map(p => (
                <View key={p.id} style={[styles.plan, shadow.card, p.id === 'growth' && styles.planHot, wide && { flex: 1 }]}>
                  <Text style={[text.h3, { color: colors.encre }]}>{p.label}</Text>
                  <Text style={[text.h2, { color: colors.vert }]}>
                    {p.monthlyFee === 0 ? '0 F' : `${p.monthlyFee.toLocaleString('fr-FR')} F`}
                    <Text style={[text.small, { color: colors.textMuted }]}>{p.monthlyFee === 0 ? ' / mois' : ' / mois'}</Text>
                  </Text>
                  <View style={{ gap: 6, marginTop: spacing.sm }}>
                    {planFeatures(p).map(line => (
                      <View key={line} style={styles.featRow}>
                        <Check size={14} color={colors.vert} />
                        <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{line}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Closing CTA */}
          <View style={styles.closing}>
            <Text style={[text.h1, { color: colors.creme, textAlign: 'center' }]}>Prêt à facturer comme un pro ?</Text>
            <Pressable style={[styles.cta, { backgroundColor: colors.vert }]} onPress={signup}>
              <Text style={[text.bodyMd, { color: colors.white }]}>Créer mon compte</Text>
              <ArrowRight size={18} color={colors.white} />
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              Sèvi Go fait partie de Sèvizi, la plateforme de services de Lomé.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' }}>
              <Pressable onPress={() => router.push('/legal/terms' as any)}><Text style={[text.small, { color: colors.vert }]}>Conditions</Text></Pressable>
              <Pressable onPress={() => router.push('/legal/privacy' as any)}><Text style={[text.small, { color: colors.vert }]}>Confidentialité</Text></Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%', maxWidth: 1040, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg },
  hero: { gap: spacing.lg, paddingTop: spacing.xl },
  headline: { fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 34, lineHeight: 38, color: colors.encre },
  sub: { color: colors.textMuted, maxWidth: 640 },
  ctaRow: { gap: spacing.sm, alignItems: 'flex-start' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.vert, paddingHorizontal: spacing.xl, height: 52, borderRadius: radii.md },
  cards: { gap: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, height: '100%' },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.md },
  plans: { gap: spacing.md, marginTop: spacing.sm },
  plan: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: 2, borderWidth: 1, borderColor: colors.border },
  planHot: { borderColor: colors.vert, borderWidth: 1.5 },
  featRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  closing: { backgroundColor: colors.encre, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.lg },
  footer: { gap: spacing.sm, paddingTop: spacing.md },
});
