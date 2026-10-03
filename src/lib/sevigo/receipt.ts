// Sèvi Go — one description of a till receipt, rendered two ways: plain text
// (copy / share) and ESC/POS bytes for a thermal printer (see escpos.ts).
export type ReceiptSale = {
  businessName?: string;
  number: string;
  date: Date;
  lines: { name: string; qty: number; total: number }[];
  total: number;
  method: 'cash' | 'mobile';
  clientName?: string;
};

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;

export function receiptText(r: ReceiptSale): string {
  return [
    r.businessName || 'Reçu',
    `Vente ${r.number} — ${r.date.toLocaleString('fr-FR')}`,
    ...(r.clientName ? [`Client : ${r.clientName}`] : []),
    '',
    ...r.lines.map(l => `${l.qty} × ${l.name} — ${money(l.total)}`),
    '',
    `TOTAL : ${money(r.total)}`,
    `Paiement : ${r.method === 'cash' ? 'Espèces' : 'Mobile money'}`,
    'Merci !',
  ].join('\n');
}
