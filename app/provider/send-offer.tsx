import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, Send, Clock } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { sendOffer } from '../../src/lib/api';
import { computeCommission, formatCommissionPct } from '../../src/lib/pricing';
import { CATEGORIES } from '../../src/lib/types';

const ETA_CHIPS = ['Sous 30 min', 'Sous 1h', 'Sous 2h', 'Aujourd\'hui', 'Demain matin'];

export default function SendOffer() {
  const router = useRouter();
  const { requestId, description, category } = useLocalSearchParams<{
    requestId?: string; description?: string; category?: string;
  }>();
  const [price, setPrice] = useState('');
  const [eta, setEta] = useState('Sous 2h');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cat = CATEGORIES.find(c => c.key === category);

  async function submit() {
    if (!price) return;
    setError('');
    setLoading(true);
    try {
      await sendOffer({ requestId: requestId ?? 'r1', price: parseInt(price, 10), availability: eta, message: note || undefined });
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

          {/* Price */}
          <View style={styles.field}>
            <Text style={[text.label, { color: colors.textMuted }]}>VOTRE PRIX (FCFA)</Text>
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

          {/* ETA chips */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Clock size={14} color={colors.textMuted} />
              <Text style={[text.label, { color: colors.textMuted }]}>DISPONIBILITÉ</Text>
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
              <Text style={[text.label, { color: colors.textMuted }]}>APERÇU DE VOTRE OFFRE</Text>
              <View style={styles.previewCard}>
                <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>
                  {parseInt(price || '0', 10).toLocaleString('fr-FR')} F
                </Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{eta}</Text>
                {note ? <Text style={[text.small, { color: colors.textMuted, fontStyle: 'italic' }]}>« {note} »</Text> : null}
                <View style={styles.commissionRow}>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    Commission Sèvizi ({formatCommissionPct()})
                  </Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    − {computeCommission(parseInt(price || '0', 10)).commission.toLocaleString('fr-FR')} F
                  </Text>
                </View>
                <View style={styles.commissionRow}>
                  <Text style={[text.small, { color: colors.encre, fontFamily: text.bodyMd.fontFamily }]}>Vous recevrez</Text>
                  <Text style={[text.small, { color: colors.vertDark, fontFamily: text.bodyMd.fontFamily }]}>
                    {computeCommission(parseInt(price || '0', 10)).net.toLocaleString('fr-FR')} F
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button
            label="Envoyer l'offre Express"
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
