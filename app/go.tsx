// Sèvi Go — public landing page, shown on go.sevizi.app (web) to signed-out
// visitors. Same app and backend as Sèvizi; this is only a different front
// door aimed at shop owners and small businesses. See app/index.tsx and
// src/lib/brand.ts for the host-based routing.
//
// Copy: C:\Users\Jose\Desktop\sevizi-founder\founder\landing-page.md.
// Deliberately NOT on the page until they are real: customer testimonials, a
// count of businesses, and a measured "time to make an invoice".
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { FileText, Users, CreditCard, BarChart3, Store, Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../src/theme/tokens';
import { SevigoLogoFull } from '../src/components/SevigoLogo';
import { StaggerIn } from '../src/components/StaggerIn';
import { SEVIGO_PLANS } from '../src/lib/sevigo/types';

const CTA = 'Créer ma première facture';

// Pain points: [lead-in, bold key phrase, rest]
const PROBLEMS: [string, string, string][] = [
  ['', 'Mes factures sont dans un cahier.', " Un client demande une copie, je ne retrouve rien, et je perds du temps devant lui."],
  ['', "Je ne sais plus qui me doit de l'argent.", ' Les impayés se mélangent, et je relance quand je m\'en souviens.'],
  ['', 'Mon stock ne correspond jamais à mes ventes.', ' Je compte à la fin du mois et il manque toujours quelque chose.'],
];

const BENEFITS = [
  { Icon: FileText, title: 'Une facture qui fait sérieux', body: 'Votre logo, votre nom, un numéro qui suit tout seul. Imprimez en A4 ou en ticket 80 mm, ou envoyez par e-mail.' },
  { Icon: Users, title: 'Vos clients enregistrés', body: 'Chaque client est gardé dans votre liste. À la facture suivante, vous le choisissez au lieu de tout retaper. Jusqu\'à 2 000 clients.' },
  { Icon: CreditCard, title: 'Vous voyez qui a payé', body: 'Votre client règle en ligne par mobile money ou carte, et la facture passe en « Payée ». Les retards ressortent d\'un coup d\'œil, sans cahier.' },
];

const MORE = [
  { Icon: BarChart3, title: 'Rapports clairs', body: "Chiffre d'affaires, factures impayées, meilleurs clients : vos chiffres du mois sans calculatrice.", note: 'À partir de Starter' },
  { Icon: Store, title: 'Caisse et stock', body: 'Listez vos produits, vendez au comptoir : le stock baisse à chaque vente et chaque vente a son reçu.', note: 'Formule Unlimited' },
];

const STEPS = [
  { title: 'Créez votre compte', body: 'Avec Google ou votre e-mail, en moins d\'une minute.' },
  { title: 'Ajoutez votre logo et votre nom', body: 'Ils apparaîtront sur chaque facture.' },
  { title: 'Faites votre première facture', body: 'Choisissez le client, ajoutez les lignes, envoyez.' },
  { title: 'Suivez ce qui est payé', body: 'Vos factures et vos rapports se mettent à jour tout seuls.' },
];

const FAQ = [
  { q: 'Est-ce vraiment gratuit pour commencer ?', a: "Oui. Vous créez votre compte sans carte bancaire, et les 3 premières factures de chaque mois sont offertes. Vous ne payez qu'au-delà, ou si vous choisissez une formule." },
  { q: 'Comment mes clients me paient-ils ?', a: "Par mobile money (T-Money, Flooz) ou par carte, depuis un lien de paiement. Sèvi Go prélève une commission sur ces paiements en ligne, de 10 % à 5 % selon votre formule. Un paiement en espèces reste possible : vous marquez la facture payée vous-même." },
  { q: 'Mes données sont-elles protégées ?', a: 'Vos factures et la liste de vos clients sont accessibles depuis votre compte, protégé par votre connexion (e-mail ou Google).' },
  { q: "Et si j'ai un grand stock à gérer ?", a: 'La formule Unlimited ajoute la caisse : vous listez vos produits, vous vendez au comptoir, et le stock baisse à chaque vente. Chaque vente a son reçu.' },
  { q: 'Puis-je arrêter quand je veux ?', a: "Oui. Vous pouvez repasser en Pay As You Go à tout moment. Une formule payée reste valable jusqu'à sa date de fin, puis votre compte revient automatiquement à la formule gratuite." },
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const signup = () => router.push('/onboarding/auth?mode=signup' as any);
  const login = () => router.push('/onboarding/auth' as any);
  const row = wide ? { flexDirection: 'row' as const, flexWrap: 'wrap' as const } : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Head>
        <title>Sèvi Go : factures et caisse pour commerçants à Lomé</title>
        <meta name="description" content="Faites vos factures avec votre logo, gardez vos clients et encaissez par mobile money. Sèvi Go est gratuit pour commencer, sans carte bancaire." />
        <meta name="keywords" content="facture en ligne Lomé, logiciel de caisse Togo, facturation mobile money" />
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

          {/* 1. Hero */}
          <View style={[styles.hero, wide && { paddingTop: spacing.xxxl * 1.5 }]}>
            <StaggerIn index={1}>
              <Text style={[styles.headline, wide && { fontSize: 52, lineHeight: 56 }]}>
                Vos factures et votre caisse,{wide ? '\n' : ' '}depuis votre téléphone
              </Text>
            </StaggerIn>
            <StaggerIn index={2}>
              <Text style={[text.body, styles.sub, wide && { fontSize: 19, lineHeight: 28 }]}>
                Sèvi Go aide les commerçants et artisans de Lomé à faire des factures propres, garder leurs clients et encaisser par mobile money.
              </Text>
            </StaggerIn>
            <StaggerIn index={3}>
              <View style={styles.ctaRow}>
                <Pressable style={styles.cta} onPress={signup}>
                  <Text style={[text.bodyMd, { color: colors.white }]}>{CTA}</Text>
                  <ArrowRight size={18} color={colors.white} />
                </Pressable>
                <Text style={[text.small, { color: colors.textMuted }]}>3 factures offertes chaque mois, sans carte bancaire.</Text>
              </View>
            </StaggerIn>
          </View>

          {/* 2. Problem */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Facturer à la main, ça vous coûte des ventes</Text>
            <View style={[styles.gap, row]}>
              {PROBLEMS.map(([lead, key, rest], i) => (
                <StaggerIn key={key} index={4 + i} style={wide ? { flexBasis: '31%', flexGrow: 1 } : undefined}>
                  <View style={[styles.problem, wide && { height: '100%' }]}>
                    <Text style={[text.body, { color: colors.encre }]}>
                      {lead}<Text style={{ fontFamily: 'HankenGrotesk_700Bold' }}>{key}</Text>{rest}
                    </Text>
                  </View>
                </StaggerIn>
              ))}
            </View>
          </View>

          {/* 3. Solution */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Tout est au même endroit, sur votre téléphone</Text>
            <View style={[styles.gap, row]}>
              {BENEFITS.map((f, i) => (
                <StaggerIn key={f.title} index={7 + i} style={wide ? { flexBasis: '31%', flexGrow: 1 } : undefined}>
                  <View style={[styles.card, shadow.card, wide && { height: '100%' }]}>
                    <View style={styles.iconWrap}><f.Icon size={22} color={colors.vert} /></View>
                    <Text style={[text.h3, { color: colors.encre }]}>{f.title}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>{f.body}</Text>
                  </View>
                </StaggerIn>
              ))}
            </View>
            <View style={[styles.gap, wide && { flexDirection: 'row' }]}>
              {MORE.map(f => (
                <View key={f.title} style={[styles.card, shadow.card, wide && { flex: 1 }]}>
                  <View style={styles.iconWrap}><f.Icon size={22} color={colors.vert} /></View>
                  <Text style={[text.h3, { color: colors.encre }]}>{f.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{f.body}</Text>
                  <Text style={[text.label, { color: colors.vert }]}>{f.note.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 4. How it works */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Prêt en cinq minutes</Text>
            <View style={[styles.gap, wide && { flexDirection: 'row' }]}>
              {STEPS.map((s, i) => (
                <View key={s.title} style={[styles.step, wide && { flex: 1 }]}>
                  <View style={styles.stepNum}><Text style={[text.h3, { color: colors.white }]}>{i + 1}</Text></View>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{s.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{s.body}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 5. Pricing */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Commencez gratuitement. Passez à une formule quand vous grandissez.</Text>
            <Text style={[text.body, { color: colors.textMuted }]}>
              Paiement annuel : 2 mois offerts. À partir de 4 factures par mois, Starter coûte moins cher que de payer chaque facture.
            </Text>
            <View style={[styles.plans, wide && { flexDirection: 'row' }]}>
              {SEVIGO_PLANS.map(p => (
                <View key={p.id} style={[styles.plan, shadow.card, p.id === 'growth' && styles.planHot, wide && { flex: 1 }]}>
                  <Text style={[text.h3, { color: colors.encre }]}>{p.label}</Text>
                  <Text style={[text.h2, { color: colors.vert }]}>
                    {p.monthlyFee === 0 ? '0 F' : `${p.monthlyFee.toLocaleString('fr-FR')} F`}
                    <Text style={[text.small, { color: colors.textMuted }]}> / mois</Text>
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

          {/* 6. FAQ */}
          <View style={styles.section}>
            <Text style={[text.h2, { color: colors.encre }]}>Vos questions</Text>
            <View style={styles.faq}>
              {FAQ.map((item, i) => {
                const open = openFaq === i;
                return (
                  <View key={item.q} style={[styles.faqItem, i > 0 && styles.faqDivider]}>
                    <Pressable style={styles.faqQ} onPress={() => setOpenFaq(open ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                      <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{item.q}</Text>
                      {open ? <ChevronUp size={18} color={colors.vert} /> : <ChevronDown size={18} color={colors.textMuted} />}
                    </Pressable>
                    {open && <Text style={[text.body, { color: colors.textMuted, paddingBottom: spacing.md }]}>{item.a}</Text>}
                  </View>
                );
              })}
            </View>
          </View>

          {/* 7. Closing CTA */}
          <View style={styles.closing}>
            <Text style={[text.h1, { color: colors.creme, textAlign: 'center' }]}>Chaque facture perdue est de l'argent qui ne revient pas</Text>
            <Pressable style={styles.cta} onPress={signup}>
              <Text style={[text.bodyMd, { color: colors.white }]}>{CTA}</Text>
              <ArrowRight size={18} color={colors.white} />
            </Pressable>
            <Text style={[text.small, { color: colors.textMutedDark }]}>Sans carte bancaire. 3 factures offertes chaque mois.</Text>
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
  container: { width: '100%', maxWidth: 1040, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg },
  hero: { gap: spacing.lg, paddingTop: spacing.xl },
  headline: { fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 34, lineHeight: 38, color: colors.encre },
  sub: { color: colors.textMuted, maxWidth: 640 },
  ctaRow: { gap: spacing.sm, alignItems: 'flex-start' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.vert, paddingHorizontal: spacing.xl, height: 52, borderRadius: radii.md },
  section: { gap: spacing.md },
  gap: { gap: spacing.md },
  problem: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderLeftWidth: 4, borderLeftColor: colors.terre },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  step: { gap: spacing.xs },
  stepNum: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  plans: { gap: spacing.md, marginTop: spacing.sm },
  plan: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: 2, borderWidth: 1, borderColor: colors.border },
  planHot: { borderColor: colors.vert, borderWidth: 1.5 },
  featRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  faq: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  faqItem: {},
  faqDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  closing: { backgroundColor: colors.encre, borderRadius: radii.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.lg },
  footer: { gap: spacing.sm },
});
