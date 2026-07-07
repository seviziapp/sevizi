import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Wallet, Clock, Check, X } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchWalletBalance, requestWithdrawal, fetchMyWithdrawalRequests } from '../../src/lib/api';
import type { WithdrawalRequest } from '../../src/lib/types';

export default function Withdraw() {
  const router = useRouter();
  const { method: methodParam } = useLocalSearchParams<{ method?: string }>();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [method, setMethod] = useState<'flooz' | 'mixx'>(methodParam === 'mixx' ? 'mixx' : 'flooz');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    Promise.all([fetchWalletBalance(), fetchMyWithdrawalRequests()])
      .then(([bal, reqs]) => { setBalance(bal); setAmount(bal > 0 ? String(bal) : ''); setRequests(reqs); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const amountNum = parseInt(amount || '0', 10);
  const valid = amountNum > 0 && amountNum <= balance && phone.trim().length >= 8;

  async function submit() {
    if (!valid) return;
    setError('');
    setSubmitting(true);
    try {
      await requestWithdrawal({ amount: amountNum, method, phone: phone.trim() });
      setSuccess(true);
      setBalance(b => b - amountNum);
      fetchMyWithdrawalRequests().then(setRequests).catch(() => {});
    } catch (e: any) {
      setError(e.message ?? 'Échec de la demande de retrait.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Demande de retrait</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.balanceCard}>
            <Wallet size={22} color={colors.vert} />
            <Text style={[text.label, { color: colors.textMuted }]}>SOLDE DISPONIBLE</Text>
            <Text style={[text.display, { color: colors.encre, fontSize: 32 }]}>{balance.toLocaleString('fr-FR')} F</Text>
          </View>

          {success ? (
            <View style={styles.successBox}>
              <Check size={20} color={colors.vert} />
              <Text style={[text.body, { color: colors.vertDark, flex: 1 }]}>
                Demande envoyée. Notre équipe vous enverra votre retrait sous peu et vous serez notifié.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[text.label, { color: colors.textMuted }]}>MOYEN DE RETRAIT</Text>
              <View style={styles.methodRow}>
                <Pressable style={[styles.methodBtn, method === 'flooz' && styles.methodBtnActive]} onPress={() => setMethod('flooz')}>
                  <Text style={[text.bodyMd, { color: method === 'flooz' ? colors.white : colors.encre }]}>Flooz</Text>
                </Pressable>
                <Pressable style={[styles.methodBtn, method === 'mixx' && styles.methodBtnActive]} onPress={() => setMethod('mixx')}>
                  <Text style={[text.bodyMd, { color: method === 'mixx' ? colors.white : colors.encre }]}>Mixx by Yas</Text>
                </Pressable>
              </View>

              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>MONTANT (FCFA)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              {amountNum > balance && (
                <Text style={styles.error}>Le montant dépasse votre solde disponible.</Text>
              )}

              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
                NUMÉRO {method === 'flooz' ? 'MOOV' : 'YAS'}
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholder="9X XX XX XX"
                placeholderTextColor={colors.textMuted}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={{ height: spacing.lg }} />
              <Button label="Demander le retrait" onPress={submit} loading={submitting} disabled={!valid} />
            </>
          )}

          {requests.length > 0 && (
            <>
              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.xl }]}>HISTORIQUE</Text>
              <View style={{ gap: spacing.sm }}>
                {requests.map(r => (
                  <View key={r.id} style={[styles.reqCard, shadow.card]}>
                    <View style={styles.reqIcon}>
                      {r.status === 'sent'
                        ? <Check size={16} color={colors.vert} />
                        : r.status === 'rejected'
                        ? <X size={16} color={colors.terre} />
                        : <Clock size={16} color={colors.soleil} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyMd, { color: colors.encre }]}>{r.amount.toLocaleString('fr-FR')} F · {r.method === 'flooz' ? 'Flooz' : 'Mixx'}</Text>
                      <Text style={[text.small, { color: colors.textMuted }]}>{r.phone}</Text>
                    </View>
                    <Text style={[text.label, { color: r.status === 'sent' ? colors.vert : r.status === 'rejected' ? colors.terre : colors.soleil }]}>
                      {r.status === 'sent' ? 'ENVOYÉ' : r.status === 'rejected' ? 'REFUSÉ' : 'EN ATTENTE'}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  balanceCard: { alignItems: 'center', gap: 4, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#F2FBF6', borderRadius: radii.md, padding: spacing.lg },
  methodRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  methodBtn: { flex: 1, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  methodBtnActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, height: 52, marginTop: spacing.sm,
    fontSize: 16, fontFamily: 'HankenGrotesk_400Regular', color: colors.encre, outlineStyle: 'none',
  } as any,
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
  reqCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  reqIcon: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
