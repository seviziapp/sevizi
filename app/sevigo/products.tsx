// Sèvi Go POS — product catalogue and stock (Unlimited plan).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Minus, Search, Package, AlertTriangle, Camera, X, Archive } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { PosGate } from '../../src/components/PosGate';
import { alert } from '../../src/lib/alert';
import { pickFile } from '../../src/lib/pickFile';
import { uploadDocument } from '../../src/lib/api';
import { fetchProducts, saveProduct, adjustStock, archiveProduct, isLowStock, SevigoProduct } from '../../src/lib/sevigo/pos';
import { reportError } from '../../src/lib/reportError';

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;
const toInt = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;

type Draft = { id?: string; name: string; price: string; stock: string; threshold: string; photoUrl?: string };
const EMPTY: Draft = { name: '', price: '', stock: '', threshold: '5' };

export default function ProductsScreen() {
  return <PosGate title="Produits & stock"><Products /></PosGate>;
}

function Products() {
  const router = useRouter();
  const [products, setProducts] = useState<SevigoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchProducts().then(setProducts).catch(reportError).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lowCount = products.filter(isLowStock).length;
  const shown = products.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function bump(p: SevigoProduct, delta: number) {
    const next = Math.max(0, p.stock + delta);
    setProducts(list => list.map(x => x.id === p.id ? { ...x, stock: next } : x)); // optimistic
    try { await adjustStock(p.id, next); } catch (e: any) { alert('Erreur', e.message); load(); }
  }

  async function pickPhoto() {
    const file = await pickFile();
    if (!file || !draft) return;
    setUploading(true);
    try {
      const url = await uploadDocument(file.blob, 'products', file.name);
      setDraft(d => d && { ...d, photoUrl: url });
    } catch (e: any) { setError(e.message ?? "Échec de l'envoi de la photo."); }
    finally { setUploading(false); }
  }

  async function submit() {
    if (!draft) return;
    setError('');
    if (!draft.name.trim()) { setError('Nom requis.'); return; }
    setSaving(true);
    try {
      await saveProduct({
        id: draft.id, name: draft.name, price: toInt(draft.price), stock: toInt(draft.stock),
        lowStockThreshold: toInt(draft.threshold), photoUrl: draft.photoUrl,
      });
      setDraft(null);
      load();
    } catch (e: any) { setError(e.message ?? "Échec de l'enregistrement."); }
    finally { setSaving(false); }
  }

  function confirmArchive(p: SevigoProduct) {
    alert('Archiver ce produit', `« ${p.name} » ne sera plus proposé à la caisse. Les ventes passées sont conservées.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Archiver', style: 'destructive', onPress: async () => {
        try { await archiveProduct(p.id); setDraft(null); load(); } catch (e: any) { alert('Erreur', e.message); }
      } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Produits & stock</Text>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => { setError(''); setDraft({ ...EMPTY }); }}>
          <Plus size={22} color={colors.encre} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {draft && (
            <View style={[styles.card, shadow.card]}>
              <View style={styles.rowBetween}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{draft.id ? 'Modifier le produit' : 'Nouveau produit'}</Text>
                <Pressable onPress={() => setDraft(null)}><X size={20} color={colors.textMuted} /></Pressable>
              </View>
              <Pressable style={styles.photoBox} onPress={pickPhoto} disabled={uploading}>
                {uploading ? <ActivityIndicator color={colors.vert} />
                  : draft.photoUrl ? <Image source={{ uri: draft.photoUrl }} style={styles.photoImg} />
                  : <><Camera size={20} color={colors.textMuted} /><Text style={[text.small, { color: colors.textMuted }]}>Photo (facultatif)</Text></>}
              </Pressable>
              <Label>NOM</Label>
              <TextInput style={styles.input} value={draft.name} onChangeText={t => setDraft({ ...draft, name: t })} placeholder="Ex. : Savon au karité" placeholderTextColor={colors.textMuted} maxLength={80} />
              <View style={styles.twoCols}>
                <View style={{ flex: 1 }}>
                  <Label>PRIX (F)</Label>
                  <TextInput style={styles.input} value={draft.price} onChangeText={t => setDraft({ ...draft, price: t })} keyboardType="number-pad" placeholder="1500" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Label>STOCK</Label>
                  <TextInput style={styles.input} value={draft.stock} onChangeText={t => setDraft({ ...draft, stock: t })} keyboardType="number-pad" placeholder="20" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
              <Label>ALERTE STOCK BAS (À PARTIR DE)</Label>
              <TextInput style={styles.input} value={draft.threshold} onChangeText={t => setDraft({ ...draft, threshold: t })} keyboardType="number-pad" placeholderTextColor={colors.textMuted} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <View style={{ height: spacing.md }} />
              <Button label="Enregistrer" onPress={submit} loading={saving} />
              {!!draft.id && (
                <Pressable style={styles.archiveBtn} onPress={() => confirmArchive(products.find(p => p.id === draft.id)!)}>
                  <Archive size={16} color={colors.terre} />
                  <Text style={[text.small, { color: colors.terre }]}>Archiver ce produit</Text>
                </Pressable>
              )}
            </View>
          )}

          {lowCount > 0 && (
            <View style={styles.lowBanner}>
              <AlertTriangle size={16} color={colors.terre} />
              <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{lowCount} produit{lowCount > 1 ? 's' : ''} en stock bas ou épuisé{lowCount > 1 ? 's' : ''}.</Text>
            </View>
          )}

          <View style={styles.searchBox}>
            <Search size={18} color={colors.textMuted} />
            <TextInput style={styles.searchInput} placeholder="Rechercher un produit…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
          </View>

          {loading ? <ActivityIndicator color={colors.vert} style={{ marginTop: 30 }} /> : shown.length === 0 ? (
            <View style={styles.empty}>
              <Package size={40} color={colors.border} />
              <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
                {products.length === 0 ? 'Aucun produit. Touchez + pour ajouter le premier.' : 'Aucun résultat.'}
              </Text>
            </View>
          ) : shown.map(p => {
            const low = isLowStock(p);
            return (
              <View key={p.id} style={[styles.card, shadow.card, styles.productRow]}>
                <Pressable style={styles.productMain} onPress={() => { setError(''); setDraft({ id: p.id, name: p.name, price: String(p.price), stock: String(p.stock), threshold: String(p.lowStockThreshold), photoUrl: p.photoUrl }); }}>
                  {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbEmpty]}><Package size={20} color={colors.textMuted} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>{money(p.price)}</Text>
                    {low && <Text style={[text.label, { color: colors.terre }]}>{p.stock === 0 ? 'ÉPUISÉ' : 'STOCK BAS'}</Text>}
                  </View>
                </Pressable>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => bump(p, -1)}><Minus size={16} color={colors.encre} /></Pressable>
                  <Text style={[text.bodyMd, { color: low ? colors.terre : colors.encre, minWidth: 34, textAlign: 'center' }]}>{p.stock}</Text>
                  <Pressable style={styles.stepBtn} onPress={() => bump(p, 1)}><Plus size={16} color={colors.encre} /></Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.md, marginBottom: 6 }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { height: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre },
  twoCols: { flexDirection: 'row', gap: spacing.md },
  photoBox: { height: 96, borderRadius: radii.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md, paddingVertical: spacing.sm },
  lowBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#FBE9E3', borderRadius: radii.md, padding: spacing.md },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  productMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48, height: 48, borderRadius: radii.md },
  thumbEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
