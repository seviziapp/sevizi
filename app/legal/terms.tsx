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

export default function TermsOfService() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Conditions d'utilisation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.label, { color: colors.textMuted }]}>DERNIÈRE MISE À JOUR : JUILLET 2026</Text>

        <Section title="1. Acceptation">
          En créant un compte sur Sèvizi, vous acceptez les présentes conditions d'utilisation. Si vous
          n'êtes pas d'accord, veuillez ne pas utiliser l'application.
        </Section>

        <Section title="2. Notre rôle">
          Sèvizi est une plateforme de mise en relation entre des clients ayant besoin d'un service et des
          prestataires indépendants (plomberie, électricité, coiffure, etc.). Les prestataires ne sont pas
          des employés de Sèvizi ; ce sont des professionnels indépendants responsables de la qualité de
          leur travail.
        </Section>

        <Section title="3. Votre compte">
          Vous êtes responsable de l'exactitude des informations fournies (nom, téléphone, e-mail) et de
          la confidentialité de votre mot de passe. Un compte peut être suspendu en cas de comportement
          frauduleux, abusif ou contraire à ces conditions.
        </Section>

        <Section title="4. Demandes, offres et missions">
          Un client publie une demande, des prestataires proches peuvent y répondre par une offre de prix.
          L'acceptation d'une offre crée une mission entre les deux parties. Le prix convenu et les
          modalités de paiement sont définis entre le client et le prestataire.
        </Section>

        <Section title="5. Paiement">
          Le paiement d'une mission se fait directement entre le client et le prestataire, en espèces ou
          via mobile money (Flooz, Mixx by Yas). Sèvizi n'est pas partie prenante de la transaction
          financière et ne peut être tenu responsable des litiges de paiement entre les parties.
        </Section>

        <Section title="6. Vérification">
          La vérification d'identité (client) ou d'entreprise (prestataire) est facultative. Le badge
          vérifié indique que des documents ont été examinés par notre équipe, sans garantir la qualité du
          service rendu.
        </Section>

        <Section title="7. Signalement et litiges">
          En cas de problème pendant une mission, chaque partie peut utiliser la fonction « Signaler un
          problème » pour porter l'incident à l'attention de notre équipe, qui examinera la situation et
          proposera une résolution.
        </Section>

        <Section title="8. Comportement interdit">
          Il est interdit d'utiliser Sèvizi pour publier de fausses demandes ou offres, harceler un autre
          utilisateur, contourner la plateforme de façon frauduleuse, ou publier du contenu illégal ou
          inapproprié.
        </Section>

        <Section title="9. Limitation de responsabilité">
          Sèvizi met en relation les utilisateurs mais ne garantit pas la disponibilité, la qualité ou le
          résultat d'un service rendu par un prestataire indépendant.
        </Section>

        <Section title="10. Modification des conditions">
          Ces conditions peuvent être mises à jour ; nous vous informerons des changements importants dans
          l'application.
        </Section>

        <Section title="11. Nous contacter">
          Pour toute question : support@sevizi.app
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
