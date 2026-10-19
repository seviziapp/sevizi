import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, Mail, Phone, MessageCircle, HelpCircle } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';

import { tr } from '../../src/i18n';
const FAQ = [
  { get q() { return tr('Comment publier une demande ?'); }, get a() { return tr("Depuis l'accueil, appuyez sur « Demander » ou « Nouvelle demande », choisissez une catégorie, décrivez votre besoin et posez votre position sur la carte. Les prestataires proches vous enverront des offres."); } },
  { get q() { return tr('Comment accepter une offre ?'); }, get a() { return tr('Ouvrez « Mes demandes », sélectionnez votre demande pour voir les offres reçues, comparez les prix et appuyez sur « Accepter ». La mission démarre alors avec le prestataire choisi.'); } },
  { get q() { return tr('Comment fonctionne le paiement ?'); }, get a() { return tr("Vous choisissez votre moyen de paiement (espèces, Flooz ou Mixx by Yas) au moment d'accepter l'offre. Le paiement en espèces se règle directement au prestataire à la fin de la mission."); } },
  { get q() { return tr('Comment devenir prestataire ?'); }, get a() { return tr('Dans votre profil, appuyez sur « Devenir prestataire » et renseignez le nom de votre entreprise, votre catégorie et vos coordonnées. La vérification est facultative mais recommandée.'); } },
  { get q() { return tr('Que faire en cas de problème pendant une mission ?'); }, get a() { return tr("Sur l'écran de suivi de la mission, appuyez sur « Signaler un problème ». Notre équipe support examinera votre signalement et interviendra pour trouver une solution."); } },
  { get q() { return tr('Comment être vérifié ?'); }, get a() { return tr('Dans « Sécurité & confiance » (clients) ou « Vérifier mon entreprise » (prestataires), envoyez les documents demandés. Un badge vérifié apparaîtra une fois validé par notre équipe.'); } },
];

export default function Help() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>{tr('Aide')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><HelpCircle size={26} color={colors.vert} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('Comment pouvons-nous aider ?')}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>{tr('Consultez les questions fréquentes ou contactez le support.')}</Text>
          </View>
        </View>

        <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>{tr('QUESTIONS FRÉQUENTES')}</Text>
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

        <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>{tr('CONTACTER LE SUPPORT')}</Text>
        <View style={styles.contactList}>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@sevizi.app')}>
            <Mail size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('Email')}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{tr('support@sevizi.app')}</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.contactRow, styles.faqBorder]} onPress={() => Linking.openURL('tel:+22890000000')}>
            <Phone size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('Téléphone')}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>+228 90 00 00 00</Text>
            </View>
          </Pressable>
          <Pressable style={[styles.contactRow, styles.faqBorder]} onPress={() => Linking.openURL('https://wa.me/22890000000')}>
            <MessageCircle size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{tr('WhatsApp')}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{tr('Discuter avec le support')}</Text>
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
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', ...shadow.sm },
  heroIcon: { width: 48, height: 48, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  faqList: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  faqItem: { paddingVertical: spacing.xs },
  faqBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  contactList: { backgroundColor: colors.white, borderRadius: radii.xl, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', overflow: 'hidden', marginTop: spacing.sm, ...shadow.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
