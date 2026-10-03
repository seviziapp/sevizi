// Sèvi Go — print a till receipt straight to a USB thermal printer (Munbyn
// and other ESC/POS models) with WebUSB: no driver, no print dialog.
//
// Limits to know:
//  - WebUSB exists only in Chromium browsers (Chrome / Edge, on desktop,
//    ChromeOS and Android) on https, and must be started by a tap/click. It
//    does NOT exist inside the installed React Native Android app, so the
//    button is hidden there (isUsbPrintingSupported() is false).
//  - On Windows the printer must use the WinUSB driver (e.g. via Zadig) —
//    the vendor driver holds the device and Chrome can't claim it. ChromeOS,
//    Linux, macOS and Android need nothing.
import type { ReceiptSale } from './sevigo/receipt';

const ESC = 0x1b;
const GS = 0x1d;
const PAPER_KEY = 'sevigo_paper_cols';

export type PaperCols = 32 | 48; // 58 mm | 80 mm

export function isUsbPrintingSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
    && typeof window !== 'undefined' && window.isSecureContext;
}

export function getPaperCols(): PaperCols {
  try { return window.localStorage.getItem(PAPER_KEY) === '32' ? 32 : 48; } catch { return 48; }
}
export function setPaperCols(cols: PaperCols): void {
  try { window.localStorage.setItem(PAPER_KEY, String(cols)); } catch { /* storage unavailable */ }
}

// Printers use a single-byte code page, not UTF-8: drop accents and map the
// few typographic characters so French text prints cleanly everywhere.
function toPrinterAscii(s: string): string {
  return s
    .replace(/[œŒ]/g, m => (m === 'œ' ? 'oe' : 'OE'))
    .replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, '-').replace(/×/g, 'x')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e\n]/g, '?');
}

const fmt = (n: number) => `${n.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F`;

function row(left: string, right: string, cols: number): string {
  const space = cols - right.length;
  const l = left.length > space - 1 ? left.slice(0, Math.max(0, space - 1)) : left;
  return l + ' '.repeat(Math.max(1, cols - l.length - right.length)) + right;
}

function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > cols) { if (line) out.push(line); line = word.slice(0, cols); }
    else line = (line + ' ' + word).trim();
  }
  if (line) out.push(line);
  return out;
}

export function buildReceiptBytes(r: ReceiptSale, cols: PaperCols = getPaperCols()): Uint8Array {
  const bytes: number[] = [];
  const text = (s: string) => { for (const ch of toPrinterAscii(s)) bytes.push(ch.charCodeAt(0)); };
  const line = (s = '') => { text(s); bytes.push(0x0a); };
  const cmd = (...b: number[]) => bytes.push(...b);
  const rule = '-'.repeat(cols);

  cmd(ESC, 0x40);                       // initialise
  cmd(ESC, 0x61, 0x01);                 // centre
  cmd(ESC, 0x45, 0x01);                 // bold
  for (const l of wrap(r.businessName || 'Recu', cols)) line(l);
  cmd(ESC, 0x45, 0x00);
  line(`Vente ${r.number}`);
  line(r.date.toLocaleString('fr-FR'));
  if (r.clientName) line(`Client: ${r.clientName}`);
  cmd(ESC, 0x61, 0x00);                 // left
  line(rule);
  for (const l of r.lines) {
    const left = `${l.qty} x ${l.name}`;
    const price = fmt(l.total);
    if (left.length + price.length + 1 <= cols) line(row(left, price, cols));
    else { for (const w of wrap(left, cols)) line(w); line(row('', price, cols)); }
  }
  line(rule);
  cmd(ESC, 0x45, 0x01); cmd(GS, 0x21, 0x01); // bold + double height
  line(row('TOTAL', fmt(r.total), cols));
  cmd(GS, 0x21, 0x00); cmd(ESC, 0x45, 0x00);
  line(`Paiement: ${r.method === 'cash' ? 'Especes' : 'Mobile money'}`);
  cmd(ESC, 0x61, 0x01);
  line();
  line('Merci !');
  cmd(ESC, 0x64, 0x04);                 // feed 4 lines
  cmd(GS, 0x56, 0x00);                  // cut (ignored by printers without a cutter)
  return new Uint8Array(bytes);
}

function isPrinterLike(dev: any): boolean {
  return (dev.configurations ?? []).some((c: any) => c.interfaces.some((i: any) =>
    i.alternates.some((a: any) => a.interfaceClass === 7)));
}

export async function printEscPos(data: Uint8Array): Promise<void> {
  const usb = (navigator as any).usb;
  if (!isUsbPrintingSupported()) {
    throw new Error("L'impression USB n'est disponible que dans Chrome sur sevizi.app (pas dans l'application Android).");
  }
  try {
    // A printer already authorised earlier is reused; otherwise Chrome shows
    // its device picker once and remembers the choice.
    const granted: any[] = await usb.getDevices();
    const dev = granted.find(isPrinterLike) ?? granted[0] ?? await usb.requestDevice({ filters: [] });

    await dev.open();
    try {
      if (!dev.configuration) await dev.selectConfiguration(1);
      let iface: any, alt: any, ep: any;
      for (const i of dev.configuration.interfaces) {
        for (const a of i.alternates) {
          const out = a.endpoints.find((e: any) => e.direction === 'out');
          // Prefer the printer-class interface when there are several.
          if (out && (!ep || a.interfaceClass === 7)) { iface = i; alt = a; ep = out; }
        }
      }
      if (!ep) throw new Error("Cette imprimante n'a pas de sortie USB utilisable.");
      await dev.claimInterface(iface.interfaceNumber);
      if (alt.alternateSetting !== 0) await dev.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
      for (let i = 0; i < data.length; i += 4096) {
        await dev.transferOut(ep.endpointNumber, data.slice(i, i + 4096));
      }
      await dev.releaseInterface(iface.interfaceNumber).catch(() => {});
    } finally {
      await dev.close().catch(() => {});
    }
  } catch (e: any) {
    if (e?.name === 'NotFoundError') throw new Error('Aucune imprimante sélectionnée.');
    if (e?.name === 'SecurityError' || e?.name === 'NetworkError' || /claim|access denied/i.test(e?.message ?? '')) {
      throw new Error("Impossible d'accéder à l'imprimante. Débranchez-la puis rebranchez-la, fermez les autres programmes qui l'utilisent. Sous Windows, elle doit utiliser le pilote WinUSB.");
    }
    throw e;
  }
}

export async function printReceipt(r: ReceiptSale): Promise<void> {
  await printEscPos(buildReceiptBytes(r));
}
