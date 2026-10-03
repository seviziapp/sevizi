// Sèvi Go — print an invoice or till receipt straight to a USB thermal
// printer (Munbyn and other ESC/POS models) with WebUSB: no driver, no print
// dialog. Reserved for accounts with profiles.thermal_printer switched on by
// an admin (see sevigo/thermal.ts) — currently Onimy Cosmetics.
//
// Limits to know:
//  - WebUSB exists only in Chromium browsers (Chrome / Edge, on desktop,
//    ChromeOS and Android) on https, and must be started by a tap/click. It
//    does NOT exist inside the installed React Native Android app, so the
//    button is hidden there (isUsbPrintingSupported() is false).
//  - On Windows the printer must use the WinUSB driver (e.g. via Zadig) —
//    the vendor driver holds the device and Chrome can't claim it. ChromeOS,
//    Linux, macOS and Android need nothing.
import { documentTitle } from './sevigo/document';
import type { SevigoDocument } from './sevigo/document';

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

// The Sèvi Go pin-and-bolt mark as a 1-bit bitmap (GS v 0 raster command),
// drawn on a canvas from the same geometry as components/SevigoLogo.tsx.
// Black pin with a white bolt reads well on thermal paper. Returns null where
// there is no canvas (then the ticket falls back to the "SEVI GO" text line).
export function sevigoLogoRaster(widthDots = 120): number[] | null {
  if (typeof document === 'undefined') return null;
  const w = widthDots - (widthDots % 8);
  const s = w / 190;
  const h = Math.ceil(226 * s);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.scale(s, s); ctx.translate(10, 10);
  ctx.fillStyle = '#000';
  ctx.fill(new Path2D('M75 181 L22.1 128 A75 75 0 1 1 127.9 128 Z'));
  ctx.save();
  ctx.translate(75, 72); ctx.scale(0.62, 0.62); ctx.translate(-76, -90);
  ctx.fillStyle = '#fff';
  ctx.fill(new Path2D('M82 12 L34 100 H70 L58 168 L118 78 H80 Z'));
  ctx.restore();

  const px = ctx.getImageData(0, 0, w, h).data;
  const bpr = w / 8;
  const data = new Array<number>(bpr * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4] < 128) data[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return [GS, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, h & 0xff, h >> 8, ...data];
}

export function buildDocumentBytes(d: SevigoDocument, cols: PaperCols = getPaperCols(), logo: number[] | null = null): Uint8Array {
  const bytes: number[] = [];
  const text = (s: string) => { for (const ch of toPrinterAscii(s)) bytes.push(ch.charCodeAt(0)); };
  const line = (s = '') => { text(s); bytes.push(0x0a); };
  const cmd = (...b: number[]) => bytes.push(...b);
  const rule = '-'.repeat(cols);

  cmd(ESC, 0x40);                       // initialise
  cmd(ESC, 0x61, 0x01);                 // centre
  if (logo) { bytes.push(...logo); line(); }
  cmd(ESC, 0x45, 0x01); cmd(GS, 0x21, 0x11); // bold + double size
  line('Sevi Go');
  cmd(GS, 0x21, 0x00); cmd(ESC, 0x45, 0x00);
  line(rule);
  cmd(ESC, 0x45, 0x01);
  for (const l of wrap(d.business.name, cols)) line(l);
  cmd(ESC, 0x45, 0x00);
  if (d.business.phone) line(d.business.phone);
  if (d.business.address) for (const l of wrap(d.business.address, cols)) line(l);
  line(rule);
  cmd(ESC, 0x61, 0x00);                 // left
  line(row(`${documentTitle(d).replace('REÇU', 'RECU')} ${d.number}`, d.date.toLocaleDateString('fr-FR'), cols));
  line(row('Client', d.client?.name || 'Client de passage', cols));
  line(rule);
  for (const l of d.lines) {
    const left = l.qty > 1 ? `${l.qty} x ${l.description}` : l.description;
    const price = fmt(l.total);
    if (left.length + price.length + 1 <= cols) line(row(left, price, cols));
    else { for (const w of wrap(left, cols)) line(w); line(row('', price, cols)); }
    if (l.qty > 1) line(`  ${l.qty} x ${fmt(l.unitPrice)}`);
  }
  line(rule);
  if (d.adjustments.length) {
    line(row('Sous-total', fmt(d.subtotal), cols));
    for (const a of d.adjustments) line(row(a.label, `-${fmt(Math.abs(a.amount))}`, cols));
  }
  cmd(ESC, 0x45, 0x01); cmd(GS, 0x21, 0x01); // bold + double height
  line(row('TOTAL', fmt(d.total), cols));
  cmd(GS, 0x21, 0x00); cmd(ESC, 0x45, 0x00);
  if (d.paymentLabel) line(row('Paiement', d.paymentLabel, cols));
  cmd(ESC, 0x61, 0x01);
  line();
  cmd(ESC, 0x45, 0x01); line('Merci !'); cmd(ESC, 0x45, 0x00);
  line('Genere avec Sevi Go - sevizi.app');
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

export async function printDocument(d: SevigoDocument): Promise<void> {
  await printEscPos(buildDocumentBytes(d, getPaperCols(), sevigoLogoRaster()));
}
