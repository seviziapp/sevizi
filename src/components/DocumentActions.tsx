// Sèvi Go — print / send actions for an invoice or a till receipt. Same bar on
// the invoice screen, right after a sale, and in the sales history:
//   A4 page · 80 mm receipt · USB thermal (only accounts with the flag) ·
//   e-mail to the client · share / copy.
// A4 and 80 mm open the browser's print dialog, so they work with any printer
// installed on the computer; they're web-only. E-mail and share work on
// every platform.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Platform, Share } from 'react-native';
import { FileText, Receipt, Printer, Mail, Share2, Copy } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../theme/tokens';
import {
  documentHtml, documentText, documentMailto, openMailto, printHtmlDocument, SevigoDocument,
} from '../lib/sevigo/document';
import { printDocument, getPaperCols, setPaperCols, PaperCols } from '../lib/escpos';
import { fetchThermalAccess } from '../lib/sevigo/thermal';
import { reportError } from '../lib/reportError';

export function DocumentActions({ doc, onEmailed }: { doc: SevigoDocument; onEmailed?: () => void }) {
  const isWeb = Platform.OS === 'web';
  const [thermal, setThermal] = useState(false);
  const [cols, setCols] = useState<PaperCols>(48);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState(doc.client?.email ?? '');

  useEffect(() => {
    fetchThermalAccess().then(ok => { setThermal(ok); if (ok) setCols(getPaperCols()); }).catch(reportError);
  }, []);
  useEffect(() => { setEmail(doc.client?.email ?? ''); setMsg(null); }, [doc.number, doc.client?.email]);

  function printWeb(format: 'a4' | 'receipt') {
    setMsg(null);
    if (!printHtmlDocument(documentHtml(doc, format))) {
      setMsg({ ok: false, t: "Le navigateur a bloqué la fenêtre d'impression. Autorisez les pop-ups pour ce site." });
    }
  }

  async function printUsb() {
    setMsg(null); setBusy(true);
    try { setPaperCols(cols); await printDocument(doc); setMsg({ ok: true, t: "Ticket envoyé à l'imprimante." }); }
    catch (e: any) { setMsg({ ok: false, t: e?.message ?? "Échec de l'impression." }); }
    finally { setBusy(false); }
  }

  function sendEmail() {
    const to = email.trim();
    if (!to.includes('@')) { setEmailOpen(true); setMsg({ ok: false, t: "Saisissez l'adresse e-mail du client." }); return; }
    openMailto(documentMailto(doc, to));
    setEmailOpen(false); setMsg({ ok: true, t: 'Votre application e-mail va s’ouvrir avec le message prêt à envoyer.' });
    onEmailed?.();
  }

  async function shareOrCopy() {
    if (isWeb && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(documentText(doc)); setMsg({ ok: true, t: 'Copié dans le presse-papiers.' });
    } else { await Share.share({ message: documentText(doc) }); }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {isWeb && <Btn icon={<FileText size={16} color={colors.encre} />} label="Imprimer A4" onPress={() => printWeb('a4')} />}
        {isWeb && <Btn icon={<Receipt size={16} color={colors.encre} />} label="Ticket 80 mm" onPress={() => printWeb('receipt')} />}
        {thermal && (
          <Btn primary busy={busy} icon={<Printer size={16} color={colors.vert} />} label="Imprimante thermique (USB)" onPress={printUsb} />
        )}
        <Btn icon={<Mail size={16} color={colors.encre} />} label="E-mail au client" onPress={() => (emailOpen ? sendEmail() : (doc.client?.email ? sendEmail() : setEmailOpen(true)))} />
        <Btn icon={isWeb ? <Copy size={16} color={colors.encre} /> : <Share2 size={16} color={colors.encre} />} label={isWeb ? 'Copier' : 'Partager'} onPress={shareOrCopy} />
      </View>

      {thermal && (
        <View style={styles.paperRow}>
          <Text style={[text.label, { color: colors.textMuted }]}>PAPIER THERMIQUE</Text>
          {([32, 48] as PaperCols[]).map(c => (
            <Pressable key={c} style={[styles.chip, cols === c && styles.chipOn]} onPress={() => setCols(c)}>
              <Text style={[text.label, { color: cols === c ? colors.white : colors.encre }]}>{c === 32 ? '58 mm' : '80 mm'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {emailOpen && (
        <View style={styles.emailRow}>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-mail du client" placeholderTextColor={colors.textMuted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Pressable style={styles.sendBtn} onPress={sendEmail}><Text style={[text.small, { color: colors.white }]}>Envoyer</Text></Pressable>
        </View>
      )}

      {!!msg && <Text style={[text.small, { color: msg.ok ? colors.vert : colors.terre, textAlign: 'center' }]}>{msg.t}</Text>}
    </View>
  );
}

function Btn({ icon, label, onPress, primary, busy }: { icon: React.ReactNode; label: string; onPress: () => void; primary?: boolean; busy?: boolean }) {
  return (
    <Pressable style={[styles.btn, primary && styles.btnPrimary]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={colors.vert} /> : icon}
      <Text style={[text.small, { color: primary ? colors.vert : colors.encre }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  btn: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.sm },
  btnPrimary: { flexBasis: '100%', borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  paperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 30, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.encre, borderColor: colors.encre },
  emailRow: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, height: 44, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre },
  sendBtn: { height: 44, paddingHorizontal: spacing.lg, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
});
