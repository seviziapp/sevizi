import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Platform, Linking, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Share2, Link2, Check, Lock, Mail, Printer, Receipt } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../../src/theme/tokens';
import { Button } from '../../../src/components/Button';
import {
  fetchSevigoInvoice, createSevigoInvoicePayment, updateSevigoInvoiceStatus,
  createSevigoGenerationFeePayment, fetchSevigoBusinessProfile,
} from '../../../src/lib/sevigo/api';
import { computeLineTotal } from '../../../src/lib/sevigo/types';
import type { SevigoInvoice, SevigoInvoiceStatus, SevigoBusinessProfile } from '../../../src/lib/sevigo/types';
import { reportError } from '../../../src/lib/reportError';
import { DocumentActions } from '../../../src/components/DocumentActions';
import { invoiceToDocument } from '../../../src/lib/sevigo/document';

import { tr, locale } from '../../../src/i18n';
const STATUS_LABEL: Record<SevigoInvoiceStatus, { label: string; color: string }> = {
  pending_fee: { get label() { return tr('Verrouillée'); }, color: colors.terre },
  draft: { get label() { return tr('Brouillon'); }, color: colors.textMuted },
  sent: { get label() { return tr('Envoyée'); }, color: colors.soleil },
  paid: { get label() { return tr('Payée'); }, color: colors.vert },
  overdue: { get label() { return tr('En retard'); }, color: colors.terre },
  cancelled: { get label() { return tr('Annulée'); }, color: colors.textMuted },
};

function buildRedirectUrl(kind: 'payment' | 'feepayment', status: 'return' | 'cancel', invoiceId: string): string {
  const query = `${kind}=${status}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sevigo/invoice/${invoiceId}?${query}`;
  }
  return ExpoLinking.createURL(`/sevigo/invoice/${invoiceId}`, { queryParams: { [kind]: status } });
}

export default function InvoiceDetail() {
  const router = useRouter();
  const { id, payment: paymentParam, feepayment: feePaymentParam } = useLocalSearchParams<{ id: string; payment?: string; feepayment?: string }>();
  const [invoice, setInvoice] = useState<SevigoInvoice | null>(null);
  const [biz, setBiz] = useState<SevigoBusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingLink, setRequestingLink] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function load() {
    if (!id) return;
    Promise.all([fetchSevigoInvoice(id), fetchSevigoBusinessProfile()])
      .then(([inv, b]) => { setInvoice(inv); setBiz(b); })
      .catch(reportError)
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);

  // Coming back from PayDunya — either the client's invoice-total payment
  // (`payment`) or the business owner's generation-fee payment
  // (`feepayment`). Poll until the corresponding status changes.
  useEffect(() => {
    const kind = paymentParam === 'return' ? 'payment' : feePaymentParam === 'return' ? 'feepayment' : null;
    if (!kind || !id) return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const fresh = await fetchSevigoInvoice(id).catch(() => null);
      const done = kind === 'payment' ? fresh?.status === 'paid' : (fresh && fresh.status !== 'pending_fee');
      if (fresh && done) {
        setInvoice(fresh);
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (attempts >= 10) {
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam, feePaymentParam, id]);

  async function unlockWithFee() {
    if (!invoice) return;
    setUnlocking(true);
    try {
      const result = await createSevigoGenerationFeePayment(
        invoice.id, buildRedirectUrl('feepayment', 'return', invoice.id), buildRedirectUrl('feepayment', 'cancel', invoice.id),
      );
      // Referral credit fully covered the fee — reload to show the now-unlocked invoice.
      if ('confirmed' in result) {
        const fresh = await fetchSevigoInvoice(invoice.id);
        if (fresh) setInvoice(fresh);
        return;
      }
      if (Platform.OS === 'web') { window.location.href = result.invoiceUrl; return; }
      await Linking.openURL(result.invoiceUrl);
    } catch {
      // button just resets — user can retry
    } finally {
      setUnlocking(false);
    }
  }

  async function requestPaymentLink() {
    if (!invoice) return;
    setRequestingLink(true);
    try {
      const { invoiceUrl } = await createSevigoInvoicePayment(
        invoice.id, buildRedirectUrl('payment', 'return', invoice.id), buildRedirectUrl('payment', 'cancel', invoice.id),
      );
      if (Platform.OS === 'web') { window.location.href = invoiceUrl; return; }
      await Linking.openURL(invoiceUrl);
    } catch {
      // swallow — button resets
    } finally {
      setRequestingLink(false);
    }
  }

  async function markPaidManually() {
    if (!invoice) return;
    await updateSevigoInvoiceStatus(invoice.id, 'paid').catch(reportError);
    load();
  }

  // Emailing a draft invoice marks it as sent (same as before).
  async function markSentIfDraft() {
    if (invoice?.status === 'draft') { await updateSevigoInvoiceStatus(invoice.id, 'sent').catch(reportError); load(); }
  }

  async function share() {
    if (!invoice) return;
    const lines = invoice.items.map(it => `${it.description} × ${it.quantity} — ${computeLineTotal(it).toLocaleString(locale())} F`);
    await Share.share({
      message: tr('Facture {number} — {clientName}\n\n{v2}\n\nTotal : {v3} F', { number: invoice.number, clientName: invoice.clientName, v2: lines.join('\n'), v3: invoice.total.toLocaleString(locale()) }),
    }).catch(reportError);
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
        <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 60 }]}>{tr('Facture introuvable.')}</Text>
      </SafeAreaView>
    );
  }

  const st = STATUS_LABEL[invoice.status];
  const locked = invoice.status === 'pending_fee';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>{invoice.number}</Text>
        {locked ? <View style={{ width: 40 }} /> : (
          <Pressable style={[styles.back, shadow.sm]} onPress={share}>
            <Share2 size={18} color={colors.encre} />
          </Pressable>
        )}
      </View>

      {verifying ? (
        <View style={styles.verifying}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.md }]}>{tr('Vérification du paiement…')}</Text>
        </View>
      ) : locked ? (
        <View style={styles.lockedWrap}>
          <View style={styles.lockIcon}>
            <Lock size={28} color={colors.terre} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>{tr('Facture verrouillée')}</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            {tr('Payez les frais de génération (')}{(invoice.generationFee ?? 0).toLocaleString(locale())} {tr('F) pour débloquer, imprimer, envoyer par e-mail ou demander le paiement au client.')}</Text>
          <Button
            label={unlocking ? tr('Redirection…') : tr('Payer {v0} F et débloquer', { v0: (invoice.generationFee ?? 0).toLocaleString(locale()) })}
            onPress={unlockWithFee}
            loading={unlocking}
            style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
          />
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

            <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>{tr('ARTICLES')}</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {invoice.items.map(it => (
                <View key={it.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.body, { color: colors.encre }]}>{it.description}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>
                      {it.quantity} {tr('×')} {it.unitPrice.toLocaleString(locale())} {tr('F')}{it.discountPct ? ` · -${it.discountPct}%` : ''}
                    </Text>
                  </View>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{computeLineTotal(it).toLocaleString(locale())} {tr('F')}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={[text.small, { color: colors.textMuted }]}>{tr('Sous-total')}</Text>
              <Text style={[text.body, { color: colors.encre }]}>{invoice.subtotal.toLocaleString(locale())} {tr('F')}</Text>
            </View>
            {!!invoice.discountPct && (
              <View style={styles.totalRow}>
                <Text style={[text.small, { color: colors.textMuted }]}>{tr('Réduction (')}{invoice.discountPct}%)</Text>
                <Text style={[text.small, { color: colors.terre }]}>-{Math.round(invoice.subtotal * invoice.discountPct / 100).toLocaleString(locale())} {tr('F')}</Text>
              </View>
            )}
            {!!invoice.discountFlat && (
              <View style={styles.totalRow}>
                <Text style={[text.small, { color: colors.textMuted }]}>{tr('Réduction')}</Text>
                <Text style={[text.small, { color: colors.terre }]}>-{invoice.discountFlat.toLocaleString(locale())} {tr('F')}</Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={[text.h3, { color: colors.encre }]}>{tr('Total')}</Text>
              <Text style={[text.h2, { color: colors.vert }]}>{invoice.total.toLocaleString(locale())} {tr('F')}</Text>
            </View>
          </View>

          <DocumentActions doc={invoiceToDocument(invoice, biz)} onEmailed={markSentIfDraft} />

          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <View style={{ gap: spacing.md }}>
              <Button
                label={requestingLink ? tr('Génération du lien…') : tr('Demander le paiement (PayDunya)')}
                icon={<Link2 size={18} color={colors.white} />}
                onPress={requestPaymentLink}
                loading={requestingLink}
              />
              <Button label={tr('Marquer comme payée (espèces)')} variant="ghost" icon={<Check size={18} color={colors.encre} />} onPress={markPaidManually} />
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
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.xl, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', marginBottom: spacing.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  verifying: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.sm },
  lockIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8E2DA', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  rowActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  outlineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  outlineBtnFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, marginBottom: spacing.sm },
});
