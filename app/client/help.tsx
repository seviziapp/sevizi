import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

const FAQ = [
  { q: 'Comment publier une demande ?', a: 'Depuis l\'accueil, appuyez sur « Demander » ou « Nouvelle demande », choisissez une catégorie, décrivez votre besoin et posez votre position sur la carte. Les prestataires proches vous enverront des offres.' },
  { q: 'Comment accepter une offre ?', a: 'Ouvrez « Mes demandes », sélectionnez votre demande pour voir les offres reçues, comparez les prix et appuyez sur « Accepter ». La mission démarre alors avec le prestataire choisi.' },
  { q: 'Comment fonctionne le paiement ?', a: 'Vous choisissez votre moyen de paiement (espèces, Flooz ou Mixx by Yas) au moment d\'accepter l\'offre. Le paiement en espèces se règle directement au prestataire à la fin de la mission.' },
  { q: 'Comment devenir prestataire ?', a: 'Dans votre profil, appuyez sur « Devenir prestataire » et renseignez le nom de votre entreprise, votre catégorie et vos coordonnées. La vérification est facultative mais recommandée.' },
  { q: 'Que faire en cas de problème pendant une mission ?', a: 'Sur l\'écran de suivi de la mission, appuyez sur « Signaler un problème ». Notre équipe support examinera votre signalement et interviendra pour trouver une solution.' },
  { q: 'Comment être vérifié ?', a: 'Dans « Sécurité & confiance » (clients) ou « Vérifier mon entreprise » (prestataires), envoyez les documents demandés. Un badge vérifié apparaîtra une fois validé par notre équipe.' },
];

export default function Help() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Aide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, shadow.card]}>
          <View style={styles.heroIcon}><HelpCircle size={26} color={colors.vert} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>Comment pouvons-nous aider ?</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>Consultez les questions fréquentes ou contactez le support.</Text>
          </View>
        </View>

        <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>QUESTIONS FRÉQUENTES</Text>
        <View style={styles.faqList}>
          {FAQ.map((item, i) => {
            const expanded = open === i;
            return (
              <View key={i} style={[styles.faqItem, i > 0 && styles.faqBorder]}>
                <Pressable style={styles.faqQ} onPress={() => setOpen(expanded ? null : i)}>
                  <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{item.q}</Text>
                  <ChevronDown size={18} color={colors.textMuted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
                </Pressable>
                {expanded && <Text style={[text.small, { color: colors.textMuted, paddingBottom: spacing.md }]}>{item.a}</Text>}
              </View>
            );
          })}
        </View>

        <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>CONTACTER LE SUPPORT</Text>
        <View style={[styles.contactList, shadow.card]}>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@sevizi.app')}>
            <Mail size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Email</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>support@sevizi.app</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.contactRow, styles.faqBorder]} onPress={() => Linking.openURL('tel:+22890000000')}>
            <Phone size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Téléphone</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>+228 90 00 00 00</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.contactRow, styles.faqBorder]} onPress={() => Linking.openURL('https://wa.me/22890000000')}>
            <MessageCircle size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>WhatsApp</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>Discuter avec le support</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  heroIcon: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  faqList: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  faqItem: { paddingVertical: spacing.xs },
  faqBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  contactList: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginTop: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
