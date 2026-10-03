// Sèvi Go POS — the till (Unlimited plan). Tap products to build a cart,
// pick how the customer paid, and "Encaisser". Prices and stock are decided
// server-side by sevigo_create_sale; the client sends only ids and quantities.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, Plus, Minus, Package, Banknote, Smartphone, CheckCircle, Receipt, User, ChevronDown } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { PosGate } from '../../src/components/PosGate';
import { fetchProducts, createSale, isLowStock, SevigoProduct } from '../../src/lib/sevigo/pos';
import { fetchSevigoBusinessProfile } from '../../src/lib/sevigo/api';
import { reportError } from '../../src/lib/reportError';
import { ClientPicker } from '../../src/components/ClientPicker';
import { fetchClients, SevigoClient } from '../../src/lib/sevigo/clients';
import { SevigoDocument } from '../../src/lib/sevigo/document';
import { DocumentActions } from '../../src/components/DocumentActions';
import type { SevigoBusinessProfile } from '../../src/lib/sevigo/types';

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;

export default function PosScreen() {
  return <PosGate title="Caisse"><Pos /></PosGate>;
}

function Pos() {
  const router = useRouter();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const [products, setProducts] = useState<SevigoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'cash' | 'mobile'>('cash');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<SevigoDocument | null>(null);
  const [doneMethod, setDoneMethod] = useState<'cash' | 'mobile'>('cash');
  const [client, setClient] = useState<SevigoClient | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [biz, setBiz] = useState<SevigoBusinessProfile | null>(null);

  React.useEffect(() => {
    if (clientId) fetchClients().then(cs => setClient(cs.find(c => c.id === clientId) ?? null)).catch(reportError);
  }, [clientId]);

  const load = useCallback(() => {
    fetchProducts().then(setProducts).catch(reportError).finally(() => setLoading(false));
    fetchSevigoBusinessProfile().then(setBiz).catch(reportError);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: byId.get(id), qty }))
    .filter((l): l is { p: SevigoProduct; qty: number } => !!l.p && l.qty > 0);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const shown = products.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  function add(p: SevigoProduct, delta: number) {
    setError('');
    setCart(c => {
      const next = Math.max(0, Math.min((c[p.id] ?? 0) + delta, p.stock));
      const copy = { ...c };
      if (next === 0) delete copy[p.id]; else copy[p.id] = next;
      return copy;
    });
  }

  async function checkout() {
    if (!lines.length) return;
    setError('');
    setPaying(true);
    try {
      const sale = await createSale(lines.map(l => ({ productId: l.p.id, qty: l.qty })), method, client?.id);
      setDone({
        kind: 'sale', number: sale.number, date: new Date(),
        business: {
          name: biz?.businessName || 'Ma boutique', logoUrl: biz?.logoUrl, email: biz?.contactEmail,
          phone: biz?.contactPhone, address: biz?.address, accent: biz?.brandColor || undefined,
        },
        client: client ? { name: client.name, email: client.email, phone: client.phone } : undefined,
        lines: lines.map(l => ({ description: l.p.name, qty: l.qty, unitPrice: l.p.price, total: l.p.price * l.qty })),
        subtotal: sale.total, adjustments: [], total: sale.total,
        paymentLabel: method === 'cash' ? 'Espèces' : 'Mobile money',
      });
      setDoneMethod(method);
      setCart({});
      load(); // refresh stock
    } catch (e: any) {
      setError(e.message ?? "Échec de l'encaissement.");
      load(); // stock may have changed
    } finally { setPaying(false); }
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <CheckCircle size={64} color={colors.vert} />
          <Text style={[text.h2, { color: colors.encre, marginTop: spacing.md }]}>Vente enregistrée</Text>
          <Text style={[text.data, { color: colors.vert, fontSize: 34, marginTop: spacing.xs }]}>{money(done.total)}</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{done.number} · {done.paymentLabel}{done.client ? ` · ${done.client.name}` : ''}</Text>
          <View style={[styles.card, shadow.card, { alignSelf: 'stretch', marginTop: spacing.xl }]}>
            {done.lines.map((l, i) => (
              <View key={i} style={styles.sumRow}>
                <Text style={[text.small, { color: colors.encre, flex: 1 }]}>{l.qty} × {l.description}</Text>
                <Text style={[text.small, { color: colors.encre }]}>{money(l.total)}</Text>
              </View>
            ))}
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
            <DocumentActions doc={done} />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
            <Button label="Nouvelle vente" onPress={() => setDone(null)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Caisse</Text>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.push('/sevigo/sales' as any)}>
          <Receipt size={20} color={colors.encre} />
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Rechercher un produit…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>

      <ScrollView contentContainerStyle={[styles.grid, lines.length > 0 && { paddingBottom: 300 }]} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator color={colors.vert} style={{ marginTop: 40 }} /> : shown.length === 0 ? (
          <View style={styles.empty}>
            <Package size={40} color={colors.border} />
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              {products.length === 0 ? 'Ajoutez d’abord vos produits pour vendre.' : 'Aucun résultat.'}
            </Text>
            {products.length === 0 && <Button label="Ajouter des produits" onPress={() => router.push('/sevigo/products' as any)} />}
          </View>
        ) : shown.map(p => {
          const inCart = cart[p.id] ?? 0;
          const out = p.stock === 0;
          return (
            <Pressable key={p.id} disabled={out || inCart >= p.stock} onPress={() => add(p, 1)}
              style={[styles.tile, shadow.card, (out) && { opacity: 0.45 }, inCart > 0 && styles.tileActive]}>
              {p.photoUrl ? <Image source={{ uri: p.photoUrl }} style={styles.tileImg} /> : <View style={[styles.tileImg, styles.tileImgEmpty]}><Package size={22} color={colors.textMuted} /></View>}
              <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{p.name}</Text>
              <Text style={[text.small, { color: colors.vert }]}>{money(p.price)}</Text>
              <Text style={[text.label, { color: out || isLowStock(p) ? colors.terre : colors.textMuted }]}>{out ? 'ÉPUISÉ' : `Stock : ${p.stock}`}</Text>
              {inCart > 0 && <View style={styles.badge}><Text style={[text.label, { color: colors.white }]}>{inCart}</Text></View>}
            </Pressable>
          );
        })}
      </ScrollView>

      {lines.length > 0 && (
        <View style={[styles.cartBar, shadow.card]}>
          <ScrollView style={{ maxHeight: 120 }} showsVerticalScrollIndicator={false}>
            {lines.map(l => (
              <View key={l.p.id} style={styles.cartLine}>
                <Text style={[text.small, { color: colors.encre, flex: 1 }]} numberOfLines={1}>{l.p.name}</Text>
                <Pressable style={styles.stepBtn} onPress={() => add(l.p, -1)}><Minus size={14} color={colors.encre} /></Pressable>
                <Text style={[text.bodyMd, { color: colors.encre, minWidth: 28, textAlign: 'center' }]}>{l.qty}</Text>
                <Pressable style={styles.stepBtn} onPress={() => add(l.p, 1)}><Plus size={14} color={colors.encre} /></Pressable>
                <Text style={[text.small, { color: colors.encre, minWidth: 78, textAlign: 'right' }]}>{money(l.p.price * l.qty)}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={styles.clientRow} onPress={() => setPickerOpen(true)}>
            <User size={16} color={colors.textMuted} />
            <Text style={[text.small, { color: client ? colors.encre : colors.textMuted, flex: 1 }]} numberOfLines={1}>{client ? client.name : 'Client de passage'}</Text>
            <ChevronDown size={16} color={colors.textMuted} />
          </Pressable>
          <View style={styles.methodRow}>
            <Pressable style={[styles.method, method === 'cash' && styles.methodOn]} onPress={() => setMethod('cash')}>
              <Banknote size={16} color={method === 'cash' ? colors.white : colors.encre} />
              <Text style={[text.small, { color: method === 'cash' ? colors.white : colors.encre }]}>Espèces</Text>
            </Pressable>
            <Pressable style={[styles.method, method === 'mobile' && styles.methodOn]} onPress={() => setMethod('mobile')}>
              <Smartphone size={16} color={method === 'mobile' ? colors.white : colors.encre} />
              <Text style={[text.small, { color: method === 'mobile' ? colors.white : colors.encre }]}>Mobile money</Text>
            </Pressable>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button label={`Encaisser ${money(total)} · ${itemCount} article${itemCount > 1 ? 's' : ''}`} onPress={checkout} loading={paying} />
        </View>
      )}
      <ClientPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={c => { setClient(c); setPickerOpen(false); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, height: 42, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md },
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  tile: { width: '47%', flexGrow: 1, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1.5, borderColor: colors.border, gap: 2 },
  tileActive: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  tileImg: { width: '100%', height: 84, borderRadius: radii.md, marginBottom: 4 },
  tileImgEmpty: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl, width: '100%' },
  cartBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  stepBtn: { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  methodOn: { backgroundColor: colors.vert, borderColor: colors.vert },
  error: { color: colors.terre, fontSize: 14 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sumRow: { flexDirection: 'row', paddingVertical: 4 },
  doneActions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.md },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});
