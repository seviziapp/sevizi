// Sèvi Go — one description of a printable document (an invoice or a till
// receipt), rendered every way a seller needs it: A4 page, 80 mm receipt,
// plain text / e-mail, and (see ../escpos.ts) a USB thermal printer. Every
// rendering carries the Sèvi Go logo, the business name, the client name and
// the usual receipt layout (items, totals, payment).
import { Linking, Platform } from 'react-native';
import { computeLineTotal } from './types';
import type { SevigoBusinessProfile, SevigoInvoice } from './types';

export type SevigoDocument = {
  kind: 'invoice' | 'sale';
  number: string;
  date: Date;
  business: { name: string; logoUrl?: string | null; email?: string; phone?: string; address?: string; accent?: string };
  client?: { name: string; email?: string; phone?: string };
  lines: { description: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  adjustments: { label: string; amount: number }[]; // discounts are negative
  total: number;
  paymentLabel?: string;
};

const fr = (n: number) => `${n.toLocaleString('fr-FR')} F`;
export const documentTitle = (d: SevigoDocument) => (d.kind === 'invoice' ? 'FACTURE' : 'REÇU');

export function invoiceToDocument(inv: SevigoInvoice, biz: SevigoBusinessProfile | null): SevigoDocument {
  const adjustments: SevigoDocument['adjustments'] = [];
  if (inv.discountPct) adjustments.push({ label: `Réduction (${inv.discountPct}%)`, amount: -Math.round(inv.subtotal * inv.discountPct / 100) });
  if (inv.discountFlat) adjustments.push({ label: 'Réduction', amount: -inv.discountFlat });
  const status: Record<string, string> = { paid: 'Payée', sent: 'En attente de paiement', overdue: 'En retard', draft: 'À régler' };
  return {
    kind: 'invoice', number: inv.number, date: new Date(inv.createdAt),
    business: {
      name: biz?.businessName || 'Mon entreprise', logoUrl: biz?.logoUrl, email: biz?.contactEmail,
      phone: biz?.contactPhone, address: biz?.address, accent: biz?.brandColor || undefined,
    },
    client: { name: inv.clientName, email: inv.clientEmail, phone: inv.clientContact },
    lines: inv.items.map(it => ({ description: it.description, qty: it.quantity, unitPrice: it.unitPrice, total: computeLineTotal(it) })),
    subtotal: inv.subtotal, adjustments, total: inv.total, paymentLabel: status[inv.status],
  };
}

export function documentText(d: SevigoDocument): string {
  return [
    d.business.name,
    `${d.kind === 'invoice' ? 'Facture' : 'Reçu'} ${d.number} — ${d.date.toLocaleDateString('fr-FR')}`,
    ...(d.client ? [`Client : ${d.client.name}`] : []),
    '',
    ...d.lines.map(l => `${l.qty} × ${l.description} — ${fr(l.total)}`),
    '',
    ...d.adjustments.map(a => `${a.label} : ${fr(a.amount)}`),
    `TOTAL : ${fr(d.total)}`,
    ...(d.paymentLabel ? [`Paiement : ${d.paymentLabel}`] : []),
    '',
    'Merci !',
    'Document généré avec Sèvi Go — sevizi.app',
  ].join('\n');
}

// mailto: link with the document in the body; opens the seller's mail app.
export function documentMailto(d: SevigoDocument, to?: string): string {
  const subject = `${d.kind === 'invoice' ? 'Facture' : 'Reçu'} ${d.number} — ${d.business.name}`;
  return `mailto:${encodeURIComponent(to ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(documentText(d))}`;
}
export function openMailto(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_self');
  else Linking.openURL(url);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// The Sèvi Go pin + bolt mark and wordmark, inline so a print window needs no
// network or font to show it. Same geometry as components/SevigoLogo.tsx.
function logoSvg(size: number): string {
  return `<svg width="${size}" height="${Math.round(size * 226 / 190)}" viewBox="0 0 190 226" xmlns="http://www.w3.org/2000/svg"><g transform="translate(10,10)"><path d="M75 181 L22.1 128 A75 75 0 1 1 127.9 128 Z" fill="#0FA76A"/><g transform="translate(75,72) scale(0.62) translate(-76,-90)"><path d="M82 12 L34 100 H70 L58 168 L118 78 H80 Z" fill="#FBF7EE"/></g></g></svg>`;
}
const wordmark = (px: number) => `<span class="sg" style="font-size:${px}px">Sèvi<span style="color:#E8A900">Go</span></span>`;
const lockup = (markPx: number, textPx: number) =>
  `<span class="lockup">${logoSvg(markPx)}${wordmark(textPx)}</span>`;

export function documentHtml(d: SevigoDocument, format: 'a4' | 'receipt'): string {
  const accent = d.business.accent || '#0FA76A';
  const title = documentTitle(d);
  const date = d.date.toLocaleDateString('fr-FR');
  const adj = d.adjustments.map(a => ({ ...a, txt: `-${fr(Math.abs(a.amount))}` }));
  const page = format === 'a4' ? '@page { size: A4; margin: 16mm; }' : '@page { size: 80mm auto; margin: 3mm; }';

  const a4 = `
    <div class="top">
      ${lockup(44, 26)}
      <div class="topRight"><div class="docTitle" style="color:${accent}">${title}</div><div class="bold">${esc(d.number)}</div><div class="muted">${date}</div></div>
    </div>
    <div class="rule" style="background:${accent}"></div>
    <div class="two">
      <div>
        <div class="label">${d.kind === 'invoice' ? 'ÉMETTEUR' : 'VENDEUR'}</div>
        <div class="bizRow">
          ${d.business.logoUrl ? `<img src="${esc(d.business.logoUrl)}" class="blogo"/>` : ''}
          <div>
            <div class="biz">${esc(d.business.name)}</div>
            ${d.business.email ? `<div class="muted">${esc(d.business.email)}</div>` : ''}
            ${d.business.phone ? `<div class="muted">${esc(d.business.phone)}</div>` : ''}
            ${d.business.address ? `<div class="muted">${esc(d.business.address)}</div>` : ''}
          </div>
        </div>
      </div>
      <div>
        <div class="label">${d.kind === 'invoice' ? 'FACTURÉ À' : 'CLIENT'}</div>
        <div class="biz">${esc(d.client?.name || 'Client de passage')}</div>
        ${d.client?.email ? `<div class="muted">${esc(d.client.email)}</div>` : ''}
        ${d.client?.phone ? `<div class="muted">${esc(d.client.phone)}</div>` : ''}
      </div>
    </div>
    <table>
      <thead><tr style="color:${accent}"><th>Description</th><th class="c">Qté</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead>
      <tbody>${d.lines.map(l => `<tr><td>${esc(l.description)}</td><td class="c">${l.qty}</td><td class="r">${fr(l.unitPrice)}</td><td class="r">${fr(l.total)}</td></tr>`).join('')}</tbody>
    </table>
    <div class="totals">
      <div class="trow"><span>Sous-total</span><span>${fr(d.subtotal)}</span></div>
      ${adj.map(a => `<div class="trow"><span>${esc(a.label)}</span><span>${a.txt}</span></div>`).join('')}
      <div class="trow grand" style="color:${accent}"><span>Total</span><span>${fr(d.total)}</span></div>
      ${d.paymentLabel ? `<div class="trow"><span>Paiement</span><span>${esc(d.paymentLabel)}</span></div>` : ''}
    </div>
    <div class="foot">${lockup(18, 14)}<span class="muted">Document généré avec Sèvi Go · sevizi.app</span></div>
  `;

  const receipt = `
    <div class="center">${lockup(34, 20)}</div>
    <div class="dash"></div>
    <div class="center">
      ${d.business.logoUrl ? `<img src="${esc(d.business.logoUrl)}" class="rlogo"/>` : ''}
      <div class="bold big">${esc(d.business.name)}</div>
      ${d.business.phone ? `<div class="muted">${esc(d.business.phone)}</div>` : ''}
      ${d.business.address ? `<div class="muted">${esc(d.business.address)}</div>` : ''}
    </div>
    <div class="dash"></div>
    <div class="rrow"><span class="bold">${title} ${esc(d.number)}</span><span>${date}</span></div>
    <div class="rrow"><span>Client</span><span class="bold">${esc(d.client?.name || 'Client de passage')}</span></div>
    <div class="dash"></div>
    ${d.lines.map(l => `<div class="rrow"><span>${esc(l.description)}${l.qty > 1 ? ` ×${l.qty}` : ''}</span><span>${fr(l.total)}</span></div>${l.qty > 1 ? `<div class="muted sub">${l.qty} × ${fr(l.unitPrice)}</div>` : ''}`).join('')}
    <div class="dash"></div>
    ${adj.length ? `<div class="rrow"><span>Sous-total</span><span>${fr(d.subtotal)}</span></div>${adj.map(a => `<div class="rrow"><span>${esc(a.label)}</span><span>${a.txt}</span></div>`).join('')}` : ''}
    <div class="rrow bold grandR"><span>TOTAL</span><span>${fr(d.total)}</span></div>
    ${d.paymentLabel ? `<div class="rrow"><span>Paiement</span><span>${esc(d.paymentLabel)}</span></div>` : ''}
    <div class="dash"></div>
    <div class="center bold">Merci !</div>
    <div class="center muted" style="margin-top:4px">Généré avec Sèvi Go · sevizi.app</div>
  `;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(d.number)}</title>
  <style>
    ${page}
    body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; color:#06291F; margin:0; }
    .lockup { display:inline-flex; align-items:center; gap:8px; }
    .sg { font-weight:800; letter-spacing:-0.5px; }
    .muted { color:#5B6B63; font-size:12px; }
    .bold { font-weight:700; }
    .top { display:flex; justify-content:space-between; align-items:center; }
    .topRight { text-align:right; }
    .docTitle { font-size:22px; font-weight:800; letter-spacing:1px; }
    .rule { height:3px; border-radius:2px; margin:12px 0 18px; }
    .two { display:flex; justify-content:space-between; gap:24px; margin-bottom:22px; }
    .two > div { flex:1; }
    .label { font-size:10px; letter-spacing:1px; color:#5B6B63; margin-bottom:6px; }
    .bizRow { display:flex; gap:10px; align-items:flex-start; }
    .blogo { width:44px; height:44px; object-fit:contain; border-radius:6px; }
    .biz { font-size:16px; font-weight:800; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; padding-bottom:6px; border-bottom:1px solid #ddd; }
    td { padding:9px 0; border-bottom:1px solid #f0f0f0; }
    .c { text-align:center; } .r { text-align:right; }
    .totals { margin-top:16px; margin-left:auto; width:280px; }
    .trow { display:flex; justify-content:space-between; padding:4px 0; font-size:13px; }
    .grand { font-size:20px; font-weight:800; border-top:1px solid #ddd; margin-top:6px; padding-top:8px; }
    .foot { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:40px; padding-top:14px; border-top:1px solid #eee; }
    body[data-fmt="receipt"] { width:72mm; margin:0 auto; font-size:12px; }
    .center { text-align:center; }
    .big { font-size:14px; }
    .rlogo { width:34px; height:34px; object-fit:contain; margin-bottom:3px; }
    .dash { border-top:1px dashed #999; margin:8px 0; }
    .rrow { display:flex; justify-content:space-between; gap:8px; font-size:12px; padding:2px 0; }
    .sub { padding-left:6px; font-size:11px; }
    .grandR { font-size:15px; }
  </style></head>
  <body data-fmt="${format}">${format === 'a4' ? a4 : receipt}</body></html>`;
}

// Opens the document in a print-ready window (web). Returns false if the
// browser blocked the pop-up.
export function printHtmlDocument(html: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
  return true;
}
