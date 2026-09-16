import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Share2, Link2, Check } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../../src/theme/tokens';
import { Button } from '../../../src/components/Button';
import { fetchSevigoInvoice, createSevigoInvoicePayment, updateSevigoInvoiceStatus } from '../../../src/lib/sevigo/api';
import { computeLineTotal } from '../../../src/lib/sevigo/types';
import type { SevigoInvoice, SevigoInvoiceStatus } from '../../../src/lib/sevigo/types';

const STATUS_LABEL: Record<SevigoInvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: colors.textMuted },
  sent: { label: 'Envoyée', color: colors.soleil },
  paid: { label: 'Payée', color: colors.vert },
  overdue: { label: 'En retard', color: colors.terre },
  cancelled: { label: 'Annulée', color: colors.textMuted },
};

function buildRedirectUrl(status: 'return' | 'cancel', invoiceId: string): string {
  const query = `payment=${status}&invoiceId=${invoiceId}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sevigo/invoice/${invoiceId}?${query}`;
  }
  return ExpoLinking.createURL(`/sevigo/invoice/${invoiceId}`, { queryParams: { payment: status } });
}

export default function InvoiceDetail() {
  const router = useRouter();
  const { id, payment: paymentParam } = useLocalSearchParams<{ id: string; payment?: string }>();
  const [invoice, setInvoice] = useState<SevigoInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingLink, setRequestingLink] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    if (!id) return;
    fetchSevigoInvoice(id).then(setInvoice).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  // Coming back from PayDunya's checkout — poll for confirmation.
  useEffect(() => {
    if (paymentParam !== 'return' || !id) return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const fresh = await fetchSevigoInvoice(id).catch(() => null);
      if (fresh?.status === 'paid') {
        setInvoice(fresh);
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (attempts >= 10) {
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam, id]);

  async function requestPaymentLink() {
    if (!invoice) return;
    setRequestingLink(true);
    try {
      const { invoiceUrl } = await createSevigoInvoicePayment(
        invoice.id, buildRedirectUrl('return', invoice.id), buildRedirectUrl('cancel', invoice.id),
      );
      if (Platform.OS === 'web') { window.location.href = invoiceUrl; return; }
      await Linking.openURL(invoiceUrl);
    } catch (e) {
      // swallow — button just resets, no server-side to retry against yet
      // (edge function not deployed) until the migration/functions are live
    } finally {
      setRequestingLink(false);
    }
  }

  async function markPaidManually() {
    if (!invoice) return;
    await updateSevigoInvoiceStatus(invoice.id, 'paid').catch(() => {});
    load();
  }

  async function share() {
    if (!invoice) return;
    const lines = invoice.items.map(it => `${it.description} × ${it.quantity} — ${computeLineTotal(it).toLocaleString('fr-FR')} F`);
    await Share.share({
      message: `Facture ${invoice.number} — ${invoice.clientName}\n\n${lines.join('\n')}\n\nTotal : ${invoice.total.toLocaleString('fr-FR')} F`,
    }).catch(() => {});
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={colors.vert} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (!invoice) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
            <ArrowLeft size={22} color={colors.encre} />
          </Pressable>
          <View style={{ width: 40 }} />
        </View>
        <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 60 }]}>Facture introuvable.</Text>
      </SafeAreaView>
    );
  }

  const st = STATUS_LABEL[invoice.status];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>{invoice.number}</Text>
        <Pressable style={[styles.back, shadow.sm]} onPress={share}>
          <Share2 size={18} color={colors.encre} />
        </Pressable>
      </View>

      {verifying ? (
        <View style={styles.verifying}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.md }]}>Vérification du paiement…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, shadow.card, TEMPLATE_ACCENT[invoice.template]]}>
            <View style={styles.cardHead}>
              <View>
                <Text style={[text.h3, { color: colors.encre }]}>{invoice.clientName}</Text>
                {!!invoice.clientEmail && <Text style={[text.small, { color: colors.textMuted }]}>{invoice.clientEmail}</Text>}
                {!!invoice.clientContact && <Text style={[text.small, { color: colors.textMuted }]}>{invoice.clientContact}</Text>}
              </View>
              <View style={[styles.statusPill, { backgroundColor: st.color + '1A' }]}>
                <Text style={[text.label, { color: st.color }]}>{st.label.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>ARTICLES</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {invoice.items.map(it => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.body, { color: colors.encre }]}>{it.description}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>
                      {it.quantity} × {it.unitPrice.toLocaleString('fr-FR')} F{it.discountPct ? ` · -${it.discountPct}%` : ''}
                    </Text>
                  </View>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{computeLineTotal(it).toLocaleString('fr-FR')} F</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={[text.small, { color: colors.textMuted }]}>Sous-total</Text>
              <Text style={[text.body, { color: colors.encre }]}>{invoice.subtotal.toLocaleString('fr-FR')} F</Text>
            </View>
            {!!invoice.discountPct && (
              <View style={styles.totalRow}>
                <Text style={[text.small, { color: colors.textMuted }]}>Réduction ({invoice.discountPct}%)</Text>
                <Text style={[text.small, { color: colors.terre }]}>-{Math.round(invoice.subtotal * invoice.discountPct / 100).toLocaleString('fr-FR')} F</Text>
              </View>
            )}
            {!!invoice.discountFlat && (
              <View style={styles.totalRow}>
                <Text style={[text.small, { color: colors.textMuted }]}>Réduction</Text>
                <Text style={[text.small, { color: colors.terre }]}>-{invoice.discountFlat.toLocaleString('fr-FR')} F</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={[text.h3, { color: colors.encre }]}>Total</Text>
              <Text style={[text.h2, { color: colors.vert }]}>{invoice.total.toLocaleString('fr-FR')} F</Text>
            </View>
          </View>

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <View style={{ gap: spacing.md }}>
              <Button
                label={requestingLink ? 'Génération du lien…' : 'Demander le paiement (PayDunya)'}
                icon={<Link2 size={18} color={colors.white} />}
                onPress={requestPaymentLink}
                loading={requestingLink}
              />
              <Button label="Marquer comme payée (espèces)" variant="ghost" icon={<Check size={18} color={colors.encre} />} onPress={markPaidManually} />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const TEMPLATE_ACCENT: Record<SevigoInvoice['template'], any> = {
  classic: { borderTopWidth: 4, borderTopColor: colors.encre },
  modern: { borderTopWidth: 4, borderTopColor: colors.vert },
  minimal: { borderTopWidth: 1, borderTopColor: colors.border },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xl, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  verifying: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
