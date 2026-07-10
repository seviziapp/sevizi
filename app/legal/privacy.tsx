import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[text.h3, { color: colors.encre }]}>{title}</Text>
      <Text style={[text.body, { color: colors.textMuted }]}>{children}</Text>
    </View>
  );
}

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Confidentialité</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.label, { color: colors.textMuted }]}>DERNIÈRE MISE À JOUR : JUILLET 2026</Text>

        <Section title="1. Qui nous sommes">
          Sèvizi est une plateforme qui met en relation des clients avec des prestataires de services
          indépendants à Lomé et ses environs. Cette politique explique quelles données nous collectons
          et comment nous les utilisons.
        </Section>

        <Section title="2. Données que nous collectons">
          Nom, prénom, numéro de téléphone et adresse e-mail lors de l'inscription ; votre position
          approximative ou précise (GPS) pour vous mettre en relation avec des prestataires proches ;
          les messages échangés avec un prestataire ou un client dans le cadre d'une mission ; les photos
          que vous choisissez de partager (galerie de travaux d'un prestataire, pièce d'identité ou
          documents envoyés pour une vérification) ; et les avis et notes laissés après une mission.
        </Section>

        <Section title="3. Comment nous utilisons ces données">
          Ces informations servent uniquement à faire fonctionner le service : afficher les prestataires
          ou demandes proches de vous, permettre la mise en relation et la messagerie, traiter les
          demandes de vérification, et améliorer la fiabilité de la plateforme (notes, avis, taux de
          réponse). Nous ne vendons pas vos données à des tiers. Pour que toute communication reste sur
          Sèvizi (voir nos conditions d'utilisation), les messages peuvent être analysés automatiquement
          afin de masquer les numéros de téléphone ou adresses e-mail qui y seraient partagés.
        </Section>

        <Section title="4. Partage des données">
          Votre prénom (ou nom d'entreprise pour un prestataire) est visible par l'autre partie d'une
          mission en cours, afin de permettre les échanges via la messagerie intégrée. Votre numéro de
          téléphone n'est jamais communiqué à l'autre partie — toute communication doit passer par Sèvizi.
          Nos données sont hébergées chez Supabase (base de données et authentification) dans le cadre
          normal du fonctionnement du service.
        </Section>

        <Section title="5. Paiements">
          Le règlement d'une mission se fait par mobile money ou carte bancaire, via un paiement sécurisé
          traité par PayDunya, notre prestataire de paiement. Sèvizi ne stocke pas vos coordonnées
          bancaires ; elles sont saisies directement sur la page de paiement sécurisée de PayDunya.
        </Section>

        <Section title="6. Conservation et suppression">
          Vos données sont conservées tant que votre compte est actif. Vous pouvez supprimer votre compte
          à tout moment depuis Profil → Sécurité & confiance (ou l'écran équivalent côté prestataire) : cette
          action est immédiate et irréversible. Votre profil, votre galerie, vos messages, vos favoris et vos
          documents de vérification sont définitivement supprimés. Les missions et paiements déjà effectués
          sont conservés sous forme anonymisée (sans lien avec votre identité) afin de préserver l'historique
          de revenus et d'avis de l'autre partie, et pour nos obligations comptables.
        </Section>

        <Section title="7. Vos droits">
          Vous pouvez à tout moment consulter, corriger ou supprimer vos informations personnelles depuis
          votre profil, ou en contactant notre support.
        </Section>

        <Section title="8. Nous contacter">
          Pour toute question sur cette politique de confidentialité : support@sevizi.app
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
});
