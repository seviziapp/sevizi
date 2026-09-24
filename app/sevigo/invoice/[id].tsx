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

const STATUS_LABEL: Record<SevigoInvoiceStatus, { label: string; color: string }> = {
  pending_fee: { label: 'Verrouillée', color: colors.terre },
  draft: { label: 'Brouillon', color: colors.textMuted },
  sent: { label: 'Envoyée', color: colors.soleil },
  paid: { label: 'Payée', color: colors.vert },
  overdue: { label: 'En retard', color: colors.terre },
  cancelled: { label: 'Annulée', color: colors.textMuted },
};

function buildRedirectUrl(kind: 'payment' | 'feepayment', status: 'return' | 'cancel', invoiceId: string): string {
  const query = `${kind}=${status}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sevigo/invoice/${invoiceId}?${query}`;
  }
  return ExpoLinking.createURL(`/sevigo/invoice/${invoiceId}`, { queryParams: { [kind]: status } });
}

function printHtml(invoice: SevigoInvoice, biz: SevigoBusinessProfile | null, format: 'a4' | 'receipt'): string {
  const accent = biz?.brandColor || '#0FA76A';
  const rows = invoice.items.map(it => `
    <tr>
      <td>${escapeHtml(it.description)}</td>
      <td style="text-align:center">${it.quantity}</td>
      <td style="text-align:right">${it.unitPrice.toLocaleString('fr-FR')} F</td>
      <td style="text-align:right">${computeLineTotal(it).toLocaleString('fr-FR')} F</td>
    </tr>`).join('');
  const receiptRows = invoice.items.map(it => `
    <div class="rrow"><span>${escapeHtml(it.description)} ×${it.quantity}</span><span>${computeLineTotal(it).toLocaleString('fr-FR')} F</span></div>`).join('');

  const page = format === 'a4'
    ? '@page { size: A4; margin: 18mm; }'
    : '@page { size: 80mm auto; margin: 4mm; }';

  const body = format === 'a4' ? `
    <div class="head">
      ${biz?.logoUrl ? `<img src="${biz.logoUrl}" class="logo"/>` : ''}
      <div>
        <div class="biz">${escapeHtml(biz?.businessName || 'Mon entreprise')}</div>
        <div class="muted">${escapeHtml(biz?.contactEmail || '')} ${biz?.contactPhone ? '· ' + escapeHtml(biz.contactPhone) : ''}</div>
        <div class="muted">${escapeHtml(biz?.address || '')}</div>
      </div>
      <div class="invNum" style="color:${accent}">${escapeHtml(invoice.number)}</div>
    </div>
    <div class="client">
      <div class="muted">FACTURÉ À</div>
      <div class="bold">${escapeHtml(invoice.clientName)}</div>
      <div class="muted">${escapeHtml(invoice.clientEmail || '')} ${invoice.clientContact ? '· ' + escapeHtml(invoice.clientContact) : ''}</div>
    </div>
    <table>
      <thead><tr style="color:${accent}"><th>Description</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="trow"><span>Sous-total</span><span>${invoice.subtotal.toLocaleString('fr-FR')} F</span></div>
      ${invoice.discountPct ? `<div class="trow"><span>Réduction (${invoice.discountPct}%)</span><span>-${Math.round(invoice.subtotal * invoice.discountPct / 100).toLocaleString('fr-FR')} F</span></div>` : ''}
      ${invoice.discountFlat ? `<div class="trow"><span>Réduction</span><span>-${invoice.discountFlat.toLocaleString('fr-FR')} F</span></div>` : ''}
      <div class="trow total" style="color:${accent}"><span>Total</span><span>${invoice.total.toLocaleString('fr-FR')} F</span></div>
    </div>
  ` : `
    <div class="rcenter">
      ${biz?.logoUrl ? `<img src="${biz.logoUrl}" class="rlogo"/>` : ''}
      <div class="bold">${escapeHtml(biz?.businessName || 'Mon entreprise')}</div>
      <div class="muted">${escapeHtml(biz?.contactPhone || '')}</div>
    </div>
    <div class="rdash"></div>
    <div class="rrow"><span>Facture</span><span>${escapeHtml(invoice.number)}</span></div>
    <div class="rrow"><span>Client</span><span>${escapeHtml(invoice.clientName)}</span></div>
    <div class="rdash"></div>
    ${receiptRows}
    <div class="rdash"></div>
    <div class="rrow bold"><span>TOTAL</span><span>${invoice.total.toLocaleString('fr-FR')} F</span></div>
    <div class="rcenter muted" style="margin-top:8px">Merci !</div>
  `;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.number)}</title>
  <style>
    ${page}
    body { font-family: -apple-system, Arial, sans-serif; color: #06291F; margin:0; }
    .muted { color: #5B6B63; font-size: 12px; }
    .bold { font-weight: 700; }
    .head { display:flex; align-items:flex-start; gap:12px; border-bottom:2px solid #eee; padding-bottom:14px; margin-bottom:16px; }
    .logo { width:48px; height:48px; object-fit:contain; border-radius:6px; }
    .biz { font-size:18px; font-weight:800; }
    .invNum { margin-left:auto; font-size:16px; font-weight:700; }
    .client { margin-bottom:18px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:6px; border-bottom:1px solid #ddd; }
    td { padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .totals { margin-top:16px; margin-left:auto; width:260px; }
    .trow { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; }
    .total { font-size:20px; font-weight:800; border-top:1px solid #ddd; margin-top:6px; padding-top:8px; }
    .rcenter { text-align:center; }
    .rlogo { width:36px; height:36px; object-fit:contain; margin-bottom:4px; }
    .rdash { border-top:1px dashed #999; margin:8px 0; }
    .rrow { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
    body[data-fmt="receipt"] { width:72mm; margin:0 auto; font-size:12px; }
  </style></head>
  <body data-fmt="${format}">${body}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
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

  async function sendByEmail() {
    if (!invoice || !invoice.clientEmail) return;
    const subject = encodeURIComponent(`Facture ${invoice.number} — ${biz?.businessName || 'Sèvi Go'}`);
    const lines = invoice.items.map(it => `- ${it.description} × ${it.quantity} — ${computeLineTotal(it).toLocaleString('fr-FR')} F`);
    const body = encodeURIComponent(
      `Bonjour ${invoice.clientName},\n\nVoici votre facture ${invoice.number} :\n\n${lines.join('\n')}\n\nTotal : ${invoice.total.toLocaleString('fr-FR')} F\n\nMerci,\n${biz?.businessName || ''}`,
    );
    await Linking.openURL(`mailto:${invoice.clientEmail}?subject=${subject}&body=${body}`).catch(reportError);
    if (invoice.status === 'draft') { await updateSevigoInvoiceStatus(invoice.id, 'sent').catch(reportError); load(); }
  }

  function printFormat(format: 'a4' | 'receipt') {
    if (!invoice || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(printHtml(invoice, biz, format));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  async function share() {
    if (!invoice) return;
    const lines = invoice.items.map(it => `${it.description} × ${it.quantity} — ${computeLineTotal(it).toLocaleString('fr-FR')} F`);
    await Share.share({
      message: `Facture ${invoice.number} — ${invoice.clientName}\n\n${lines.join('\n')}\n\nTotal : ${invoice.total.toLocaleString('fr-FR')} F`,
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
        <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 60 }]}>Facture introuvable.</Text>
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
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.md }]}>Vérification du paiement…</Text>
        </View>
      ) : locked ? (
        <View style={styles.lockedWrap}>
          <View style={styles.lockIcon}>
            <Lock size={28} color={colors.terre} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>Facture verrouillée</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Payez les frais de génération ({(invoice.generationFee ?? 0).toLocaleString('fr-FR')} F) pour débloquer, imprimer, envoyer par e-mail ou demander le paiement au client.
          </Text>
          <Button
            label={unlocking ? 'Redirection…' : `Payer ${(invoice.generationFee ?? 0).toLocaleString('fr-FR')} F et débloquer`}
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

          {Platform.OS === 'web' && (
            <View style={styles.rowActions}>
              <Pressable style={styles.outlineBtn} onPress={() => printFormat('a4')}>
                <Printer size={16} color={colors.encre} />
                <Text style={[text.small, { color: colors.encre }]}>Imprimer (A4)</Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={() => printFormat('receipt')}>
                <Receipt size={16} color={colors.encre} />
                <Text style={[text.small, { color: colors.encre }]}>Imprimer (Reçu)</Text>
              </Pressable>
            </View>
          )}

          {!!invoice.clientEmail && (
            <Pressable style={styles.outlineBtnFull} onPress={sendByEmail}>
              <Mail size={16} color={colors.encre} />
              <Text style={[text.small, { color: colors.encre }]}>Envoyer par e-mail à {invoice.clientEmail}</Text>
            </Pressable>
          )}

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
