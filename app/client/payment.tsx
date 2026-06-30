import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Phone, Banknote } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { setJobPaymentMethod } from '../../src/lib/api';
import type { PaymentMethod } from '../../src/lib/types';

const METHODS: { key: PaymentMethod; label: string; subtitle: string; emoji: string; color: string }[] = [
  { key: 'cash',  label: 'Espèces',      subtitle: 'Paiement à la fin de la mission', emoji: '💵', color: '#10B981' },
  { key: 'flooz', label: 'Flooz',        subtitle: '',                                emoji: '📱', color: '#F97316' },
  { key: 'mixx',  label: 'Mixx by Yas',  subtitle: '',                                emoji: '📲', color: '#3B82F6' },
];

export default function Payment() {
  const router = useRouter();
  const { amount, providerName, jobId } = useLocalSearchParams<{ amount?: string; providerName?: string; jobId?: string }>();
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const amountNum = parseInt(amount ?? '0', 10);

  async function confirm() {
    setLoading(true);
    try {
      if (jobId) await setJobPaymentMethod(jobId, method);
    } catch {}
    setLoading(false);
    router.replace('/client/job-status');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Paiement</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={[styles.summary, shadow.card]}>
          <Text style={[text.label, { color: colors.textMuted }]}>MONTANT À RÉGLER</Text>
          <Text style={[text.display, { color: colors.encre, fontSize: 40 }]}>
            {amountNum.toLocaleString('fr-FR')} F
          </Text>
          <Text style={[text.small, { color: colors.textMuted }]}>
            {providerName ?? 'Prestataire'}
          </Text>
        </View>

        {/* Payment methods */}
        <Text style={[text.label, { color: colors.textMuted }]}>CHOISIR UN MOYEN DE PAIEMENT</Text>
        <View style={{ gap: spacing.md }}>
          {METHODS.map(m => (
            <Pressable
              key={m.key}
              style={[styles.methodCard, method === m.key && styles.methodCardActive]}
              onPress={() => setMethod(m.key)}
            >
              <View style={[styles.methodIcon, { backgroundColor: m.color + '20' }]}>
                <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{m.label}</Text>
                {!!m.subtitle && <Text style={[text.small, { color: colors.textMuted }]}>{m.subtitle}</Text>}
              </View>
              <View style={[styles.radio, method === m.key && styles.radioActive]}>
                {method === m.key && <Check size={12} color={colors.white} strokeWidth={3} />}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Mobile money phone input */}
        {(method === 'flooz' || method === 'mixx') && (
          <View style={styles.field}>
            <Text style={[text.label, { color: colors.textMuted }]}>NUMÉRO {method === 'flooz' ? 'MOOV' : 'YAS'}</Text>
            <View style={styles.phoneInput}>
              <Phone size={16} color={colors.textMuted} />
              <TextInput
                style={styles.phoneField}
                placeholder="9X XX XX XX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        )}

        {/* Cash info */}
        {method === 'cash' && (
          <View style={styles.cashInfo}>
            <Banknote size={18} color={colors.vertDark} />
            <Text style={[text.small, { color: colors.vertDark, flex: 1 }]}>
              Le paiement en espèces se fait directement au prestataire à la fin de la mission.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={method === 'cash' ? 'Confirmer la mission' : `Payer via ${METHODS.find(m => m.key === method)?.label}`}
          onPress={confirm}
          loading={loading}
          disabled={method !== 'cash' && phone.length < 8}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  summary: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.border },
  methodCardActive: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  methodIcon: { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.vert, borderColor: colors.vert },
  field: { gap: spacing.sm },
  phoneInput: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 52 },
  phoneField: { flex: 1, ...text.body, color: colors.encre },
  cashInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.lg },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
});
