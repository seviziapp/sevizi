import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, Linking, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Plus, Trash2, Check, Camera } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import {
  fetchSevigoBusinessProfile, saveSevigoBusinessProfile,
  createSevigoInvoicePayment, createSevigoInvoice, createSevigoGenerationFeePayment,
} from '../../src/lib/sevigo/api';
import { uploadDocument } from '../../src/lib/api';
import { pickFile } from '../../src/lib/pickFile';
import { computeInvoiceTotals } from '../../src/lib/sevigo/types';
import type { SevigoInvoiceTemplate, SevigoLineItem } from '../../src/lib/sevigo/types';
import { reportError } from '../../src/lib/reportError';

type DraftLine = { id: string; description: string; quantity: string; unitPrice: string };

const BRAND_COLORS = ['#0FA76A', '#06291F', '#CE5A37', '#FCC419', '#2D7FF9', '#7C4DFF'];

const TEMPLATES: { key: SevigoInvoiceTemplate; label: string }[] = [
  { key: 'classic', label: 'Classique' },
  { key: 'modern', label: 'Moderne' },
  { key: 'minimal', label: 'Minimal' },
];

function newLine(): DraftLine {
  return { id: `l${Date.now()}${Math.random()}`, description: '', quantity: '1', unitPrice: '' };
}

function buildRedirectUrl(status: 'return' | 'cancel', invoiceId: string): string {
  const query = `feepayment=${status}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/sevigo/invoice/${invoiceId}?${query}`;
  }
  return ExpoLinking.createURL(`/sevigo/invoice/${invoiceId}`, { queryParams: { feepayment: status } });
}

export default function NewInvoice() {
  const router = useRouter();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [discountPct, setDiscountPct] = useState('');
  const [discountFlat, setDiscountFlat] = useState('');
  const [template, setTemplate] = useState<SevigoInvoiceTemplate>('classic');
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState(colors.vert);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSevigoBusinessProfile().then(p => {
      if (p) {
        setBusinessName(p.businessName);
        setLogoUrl(p.logoUrl ?? null);
        if (p.brandColor) setBrandColor(p.brandColor);
      }
    }).catch(reportError);
  }, []);

  const items: SevigoLineItem[] = useMemo(() => lines
    .filter(l => l.description.trim())
    .map(l => ({
      id: l.id,
      description: l.description,
      quantity: parseFloat(l.quantity) || 0,
      unitPrice: parseInt(l.unitPrice, 10) || 0,
    })), [lines]);

  const totals = computeInvoiceTotals(items, parseFloat(discountPct) || undefined, parseInt(discountFlat, 10) || undefined);

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  }
  function removeLine(id: string) {
    setLines(ls => ls.length > 1 ? ls.filter(l => l.id !== id) : ls);
  }

  // Logo/color are saved to the business profile immediately (single brand
  // identity reused across every future invoice), so picking them here is
  // just editing that profile inline instead of a separate screen.
  async function pickLogo() {
    const file = await pickFile();
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadDocument(file.blob, 'sevigo-logos', file.name);
      setLogoUrl(url);
      await saveSevigoBusinessProfile({ businessName: businessName || 'Mon entreprise', logoUrl: url, brandColor });
    } catch (e: any) {
      setError(e.message ?? "Échec du téléversement du logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function pickColor(c: string) {
    setBrandColor(c);
    saveSevigoBusinessProfile({ businessName: businessName || 'Mon entreprise', logoUrl, brandColor: c }).catch(reportError);
  }

  function validate(): string {
    if (!clientName.trim()) return 'Indiquez le nom du client.';
    if (items.length === 0) return 'Ajoutez au moins un article.';
    return '';
  }

  async function createInvoice() {
    const v = validate();
    if (v) { setError(v); return; }
    setError('');
    setCreating(true);
    try {
      const invoice = await createSevigoInvoice({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientContact: clientContact.trim() || undefined,
        items: items.map(({ id, ...rest }) => rest),
        discountPct: parseFloat(discountPct) || undefined,
        discountFlat: parseInt(discountFlat, 10) || undefined,
        template,
      });

      if (invoice.status === 'pending_fee') {
        // A generation fee applies (pay-as-you-go, or plan quota exceeded) —
        // the invoice stays locked until this is paid, so nothing exists yet
        // to print/email/screenshot.
        const result = await createSevigoGenerationFeePayment(
          invoice.id, buildRedirectUrl('return', invoice.id), buildRedirectUrl('cancel', invoice.id),
        );
        // Referral credit fully covered the fee — already unlocked server-side.
        if ('confirmed' in result) {
          router.replace({ pathname: '/sevigo/invoice/[id]', params: { id: invoice.id } });
          return;
        }
        if (Platform.OS === 'web') {
          window.location.href = result.invoiceUrl;
          return;
        }
        await Linking.openURL(result.invoiceUrl);
        router.replace({ pathname: '/sevigo/invoice/[id]', params: { id: invoice.id } });
        return;
      }

      router.replace({ pathname: '/sevigo/invoice/[id]', params: { id: invoice.id } });
    } catch (e: any) {
      setError(e.message ?? "Échec de la création de la facture.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Nouvelle facture</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Field label="Client">
            <TextInput style={styles.input} placeholder="Nom du client / entreprise" placeholderTextColor={colors.textMuted} value={clientName} onChangeText={setClientName} />
            <TextInput style={styles.input} placeholder="Email (facultatif)" placeholderTextColor={colors.textMuted} value={clientEmail} onChangeText={setClientEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Téléphone (facultatif)" placeholderTextColor={colors.textMuted} value={clientContact} onChangeText={setClientContact} keyboardType="phone-pad" />
          </Field>

          <Field label="Articles">
            <View style={{ gap: spacing.sm }}>
              {lines.map(l => (
                <View key={l.id} style={[styles.lineCard, shadow.sm]}>
                  <TextInput
                    style={styles.lineDesc}
                    placeholder="Description"
                    placeholderTextColor={colors.textMuted}
                    value={l.description}
                    onChangeText={t => updateLine(l.id, { description: t })}
                  />
                  <View style={styles.lineRow}>
                    <TextInput
                      style={styles.lineQty}
                      placeholder="Qté"
                      placeholderTextColor={colors.textMuted}
                      value={l.quantity}
                      onChangeText={t => updateLine(l.id, { quantity: t })}
                      keyboardType="numeric"
                    />
                    <Text style={[text.small, { color: colors.textMuted }]}>×</Text>
                    <TextInput
                      style={styles.linePrice}
                      placeholder="Prix unitaire"
                      placeholderTextColor={colors.textMuted}
                      value={l.unitPrice}
                      onChangeText={t => updateLine(l.id, { unitPrice: t })}
                      keyboardType="numeric"
                    />
                    <Pressable onPress={() => removeLine(l.id)} hitSlop={8} disabled={lines.length === 1}>
                      <Trash2 size={17} color={lines.length === 1 ? colors.border : colors.terre} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
            <Pressable style={styles.addLine} onPress={() => setLines(ls => [...ls, newLine()])}>
              <Plus size={16} color={colors.vert} />
              <Text style={[text.small, { color: colors.vert }]}>Ajouter un article</Text>
            </Pressable>
          </Field>

          <Field label="Réduction (facultatif)">
            <View style={styles.discountRow}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="% sur le total" placeholderTextColor={colors.textMuted} value={discountPct} onChangeText={setDiscountPct} keyboardType="numeric" />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Montant fixe (F)" placeholderTextColor={colors.textMuted} value={discountFlat} onChangeText={setDiscountFlat} keyboardType="numeric" />
            </View>
          </Field>

          <Field label="Personnaliser">
            <View style={styles.customizeRow}>
              <Pressable style={styles.logoPicker} onPress={pickLogo} disabled={uploadingLogo}>
                {logoUrl
                  ? <Image source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain" />
                  : <Camera size={20} color={colors.textMuted} />}
              </Pressable>
              <View style={styles.colorSwatches}>
                {BRAND_COLORS.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.swatch, { backgroundColor: c }, brandColor === c && styles.swatchActive]}
                    onPress={() => pickColor(c)}
                  >
                    {brandColor === c && <Check size={14} color={colors.white} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </Field>

          <Field label="Modèle">
            <View style={styles.templateRow}>
              {TEMPLATES.map(t => (
                <Pressable key={t.key} style={styles.templatePreviewWrap} onPress={() => setTemplate(t.key)}>
                  <TemplatePreview kind={t.key} color={brandColor} logoUrl={logoUrl} selected={template === t.key} />
                  <Text style={[text.small, { color: template === t.key ? colors.encre : colors.textMuted, marginTop: 6, textAlign: 'center' }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <View style={[styles.totalsCard, shadow.card]}>
            <View style={styles.totalRow}>
              <Text style={[text.small, { color: colors.textMuted }]}>Sous-total</Text>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{totals.subtotal.toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[text.h3, { color: colors.encre }]}>Total</Text>
              <Text style={[text.h3, { color: colors.vert }]}>{totals.total.toLocaleString('fr-FR')} F</Text>
            </View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button label={creating ? 'Création…' : 'Créer la facture'} onPress={createInvoice} loading={creating} />
      </View>
    </SafeAreaView>
  );
}

function TemplatePreview({ kind, color, logoUrl, selected }: {
  kind: SevigoInvoiceTemplate; color: string; logoUrl: string | null; selected: boolean;
}) {
  return (
    <View style={[styles.preview, selected && { borderColor: color, borderWidth: 2 }]}>
      {kind === 'classic' && (
        <>
          <View style={[styles.previewHeaderBar, { backgroundColor: colors.encre }]}>
            <PreviewLogo logoUrl={logoUrl} tint={colors.creme} />
          </View>
          <View style={styles.previewLines}>
            <View style={[styles.previewLine, { width: '70%' }]} />
            <View style={[styles.previewLine, { width: '50%' }]} />
            <View style={[styles.previewLine, { width: '60%', backgroundColor: color }]} />
          </View>
        </>
      )}
      {kind === 'modern' && (
        <>
          <View style={[styles.previewHeaderBar, { backgroundColor: color, borderRadius: 8 }]}>
            <PreviewLogo logoUrl={logoUrl} tint={colors.white} />
          </View>
          <View style={styles.previewLines}>
            <View style={[styles.previewLine, { width: '80%' }]} />
            <View style={[styles.previewLine, { width: '55%' }]} />
            <View style={[styles.previewLine, { width: '40%', backgroundColor: color }]} />
          </View>
        </>
      )}
      {kind === 'minimal' && (
        <>
          <View style={styles.previewMinimalHead}>
            <PreviewLogo logoUrl={logoUrl} tint={color} small />
            <View style={[styles.previewMinimalLine, { backgroundColor: color }]} />
          </View>
          <View style={styles.previewLines}>
            <View style={[styles.previewLine, { width: '90%', backgroundColor: '#EEE' }]} />
            <View style={[styles.previewLine, { width: '65%', backgroundColor: '#EEE' }]} />
          </View>
        </>
      )}
    </View>
  );
}

function PreviewLogo({ logoUrl, tint, small }: { logoUrl: string | null; tint: string; small?: boolean }) {
  const size = small ? 14 : 18;
  if (logoUrl) return <Image source={{ uri: logoUrl }} style={{ width: size, height: size, borderRadius: 3 }} resizeMode="cover" />;
  return <View style={{ width: size, height: size, borderRadius: 3, backgroundColor: tint, opacity: 0.85 }} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xl },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)', borderRadius: radii.lg, paddingHorizontal: spacing.lg, height: 48, ...text.body, color: colors.encre, ...shadow.sm },
  lineCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: 'rgba(6,41,31,0.05)' },
  lineDesc: { ...text.body, color: colors.encre, height: 24 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lineQty: { width: 50, height: 36, backgroundColor: colors.surface, borderRadius: radii.sm, textAlign: 'center', color: colors.encre, ...text.small },
  linePrice: { flex: 1, height: 36, backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: spacing.md, color: colors.encre, ...text.small },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center', height: 40, marginTop: spacing.sm },
  discountRow: { flexDirection: 'row', gap: spacing.md },
  customizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logoPicker: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImg: { width: '100%', height: '100%' },
  colorSwatches: { flexDirection: 'row', gap: spacing.sm, flex: 1, flexWrap: 'wrap' },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: colors.encre },
  templateRow: { flexDirection: 'row', gap: spacing.md },
  templatePreviewWrap: { flex: 1 },
  preview: { height: 100, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(6,41,31,0.08)', padding: spacing.sm, gap: spacing.sm, overflow: 'hidden' },
  previewHeaderBar: { height: 22, borderRadius: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  previewLines: { gap: 5, paddingTop: 2 },
  previewLine: { height: 5, borderRadius: 2, backgroundColor: '#E7E2D6' },
  previewMinimalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewMinimalLine: { flex: 1, height: 2, borderRadius: 1 },
  totalsCard: { backgroundColor: colors.white, borderRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colors.terre, fontSize: 14, textAlign: 'center' },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
});
