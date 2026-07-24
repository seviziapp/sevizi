import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Send, Clock, Crown, Lock, MapPin } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { sendOffer, fetchMyProviderProfile, fetchOfferStatsForRequest } from '../../src/lib/api';
import { computeCommission, formatCommissionPct } from '../../src/lib/pricing';
import { CATEGORIES } from '../../src/lib/types';

const ETA_CHIPS = ['Sous 30 min', 'Sous 1h', 'Sous 2h', 'Aujourd\'hui', 'Demain matin'];

export default function SendOffer() {
  const router = useRouter();
  const { requestId, description, category } = useLocalSearchParams<{
    requestId?: string; description?: string; category?: string;
  }>();
  const [price, setPrice] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [visitRequired, setVisitRequired] = useState(false);
  const [eta, setEta] = useState('Sous 2h');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [bidStats, setBidStats] = useState<{ count: number; min: number; max: number; avg: number } | null>(null);

  const cat = CATEGORIES.find(c => c.key === category);

  useEffect(() => {
    fetchMyProviderProfile().then(p => setIsPro(p?.tier === 'pro')).catch(() => {});
    if (requestId) fetchOfferStatsForRequest(requestId).then(setBidStats).catch(() => {});
  }, [requestId]);

  async function submit() {
    if (!price) return;
    setError('');
    setLoading(true);
    try {
      await sendOffer({
        requestId: requestId ?? 'r1', price: parseInt(price, 10), availability: eta, message: note || undefined,
        visitRequired, priceMax: priceMax ? parseInt(priceMax, 10) : undefined,
      });
      router.back();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg === 'Non connecté') { router.replace('/onboarding/auth'); return; }
      setError(msg === 'Profil prestataire introuvable'
        ? 'Complétez votre profil prestataire avant d\'envoyer une offre.'
        : (msg || "Impossible d'envoyer l'offre. Réessayez."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.close} onPress={() => router.back()}>
          <X size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Envoyer une offre</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Request summary */}
          <View style={[styles.requestBox, shadow.card]}>
            <Text style={{ fontSize: 28 }}>{cat?.emoji ?? '🔧'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{cat?.label}</Text>
              <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>
                {description ?? 'Fuite sous l\'évier de la cuisine.'}
              </Text>
            </View>
          </View>

          {/* Other bids on this request — Pro perk */}
          {isPro ? (
            bidStats && (
              <View style={styles.bidsBox}>
                <Crown size={14} color={colors.soleil} fill={colors.soleil} />
                <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
                  {bidStats.count} autre{bidStats.count > 1 ? 's' : ''} offre{bidStats.count > 1 ? 's' : ''} déjà envoyée{bidStats.count > 1 ? 's' : ''} · min {bidStats.min.toLocaleString('fr-FR')} F · moy {bidStats.avg.toLocaleString('fr-FR')} F · max {bidStats.max.toLocaleString('fr-FR')} F
                </Text>
              </View>
            )
          ) : (
            <Pressable style={styles.bidsBoxLocked} onPress={() => router.push('/provider/upgrade')}>
              <Lock size={14} color={colors.textMuted} />
              <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>
                Passez à Sèvizi Pro pour voir les offres des autres prestataires sur cette demande.
              </Text>
            </Pressable>
          )}

          {/* Site visit toggle — some trades can't give a firm price sight-unseen */}
          <Pressable style={styles.visitToggle} onPress={() => setVisitRequired(v => !v)}>
            <View style={[styles.checkbox, visitRequired && styles.checkboxActive]}>
              {visitRequired && <MapPin size={12} color={colors.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>Visite sur place nécessaire</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>
                Je ne peux pas donner de prix ferme sans voir le chantier — j'envoie une estimation.
              </Text>
            </View>
          </Pressable>

          {/* Price */}
          <View style={styles.field}>
            <Text style={[text.label, { color: colors.textMuted }]}>
              {visitRequired ? 'ESTIMATION — À PARTIR DE (FCFA)' : 'VOTRE PRIX (FCFA)'}
            </Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={price}
                onChangeText={setPrice}
                autoFocus
              />
              <Text style={[text.h3, { color: colors.textMuted }]}>F CFA</Text>
            </View>
          </View>

          {visitRequired && (
            <View style={styles.field}>
              <Text style={[text.label, { color: colors.textMuted }]}>JUSQU'À (FCFA, OPTIONNEL)</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={priceMax}
                  onChangeText={setPriceMax}
                />
                <Text style={[text.h3, { color: colors.textMuted }]}>F CFA</Text>
              </View>
            </View>
          )}

          {/* ETA chips */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={[text.label, { color: colors.textMuted }]}>
                {visitRequired ? 'DISPONIBILITÉ POUR LA VISITE' : 'DISPONIBILITÉ'}
              </Text>
            </View>
            <View style={styles.chips}>
              {ETA_CHIPS.map(chip => (
                <Pressable
                  key={chip}
                  style={[styles.chip, eta === chip && styles.chipActive]}
                  onPress={() => setEta(chip)}
                >
                  <Text style={[text.small, { color: eta === chip ? colors.white : colors.encre }]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Optional note */}
          <View style={styles.field}>
            <Text style={[text.label, { color: colors.textMuted }]}>NOTE (OPTIONNEL)</Text>
            <TextInput
              style={styles.textarea}
              placeholder="Présentez-vous brièvement ou précisez votre offre…"
              placeholderTextColor={colors.textMuted}
              multiline
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />
          </View>

          {/* Preview */}
          {price ? (
            <View style={styles.preview}>
              <Text style={[text.label, { color: colors.textMuted }]}>
                {visitRequired ? 'APERÇU DE VOTRE ESTIMATION' : 'APERÇU DE VOTRE OFFRE'}
              </Text>
              <View style={styles.previewCard}>
                <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>
                  {visitRequired
                    ? `À partir de ${parseInt(price || '0', 10).toLocaleString('fr-FR')} F${priceMax ? ` – ${parseInt(priceMax, 10).toLocaleString('fr-FR')} F` : ''}`
                    : `${parseInt(price || '0', 10).toLocaleString('fr-FR')} F`}
                </Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{eta}</Text>
                {note ? <Text style={[text.small, { color: colors.textMuted, fontStyle: 'italic' }]}>« {note} »</Text> : null}
                {visitRequired ? (
                  <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
                    Le client devra d'abord accepter une visite avant tout paiement — la commission ne s'applique qu'au devis ferme envoyé ensuite.
                  </Text>
                ) : (
                  <>
                    <View style={styles.commissionRow}>
                      <Text style={[text.label, { color: colors.textMuted }]}>
                        Commission Sèvizi ({formatCommissionPct(isPro ? 'pro' : 'free')})
                      </Text>
                      <Text style={[text.label, { color: colors.textMuted }]}>
                        − {computeCommission(parseInt(price || '0', 10), isPro ? 'pro' : 'free').commission.toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                    <View style={styles.commissionRow}>
                      <Text style={[text.small, { color: colors.encre, fontFamily: text.bodyMd.fontFamily }]}>Vous recevrez</Text>
                      <Text style={[text.small, { color: colors.vertDark, fontFamily: text.bodyMd.fontFamily }]}>
                        {computeCommission(parseInt(price || '0', 10), isPro ? 'pro' : 'free').net.toLocaleString('fr-FR')} F
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            label={visitRequired ? "Envoyer l'estimation" : "Envoyer l'offre Express"}
            icon={<Send size={18} color={colors.white} />}
            onPress={submit}
            loading={loading}
            disabled={!price}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  requestBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  bidsBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FCEFC7', borderRadius: radii.md, padding: spacing.md },
  bidsBoxLocked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md },
  visitToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.lg },
  checkbox: { width: 22, height: 22, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.vert, borderColor: colors.vert },
  field: { gap: spacing.sm },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 64 },
  priceInput: { flex: 1, ...text.display, color: colors.encre, fontSize: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  textarea: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.lg, minHeight: 80, ...text.body, color: colors.encre },
  preview: { gap: spacing.sm },
  previewCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme, gap: spacing.sm },
  error: { color: colors.terre, fontSize: 14, textAlign: 'center' },
});
