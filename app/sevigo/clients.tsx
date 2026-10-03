// Sèvi Go — client file (Unlimited plan): save clients once, then sell to them
// and invoice them again later, with their full purchase history.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Search, X, Users, Phone, Mail, MapPin, Store, FileText, Trash2, Pencil } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchSevigoUsage } from '../../src/lib/sevigo/api';
import { alert } from '../../src/lib/alert';
import { fetchClients, saveClient, deleteClient, fetchClientHistory, SevigoClient, ClientPurchase } from '../../src/lib/sevigo/clients';
import { reportError } from '../../src/lib/reportError';

const money = (n: number) => `${n.toLocaleString('fr-FR')} F`;
type Draft = { id?: string; name: string; phone: string; email: string; address: string; notes: string };
const EMPTY: Draft = { name: '', phone: '', email: '', address: '', notes: '' };

export default function Clients() {
  const router = useRouter();
  // The till is an Unlimited feature; the client list itself is for every plan.
  const [hasPos, setHasPos] = useState(false);
  React.useEffect(() => { fetchSevigoUsage().then(u => setHasPos(u.planId === 'unlimited')).catch(reportError); }, []);
  const [clients, setClients] = useState<SevigoClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<ClientPurchase[] | null>(null);

  const load = useCallback(() => {
    fetchClients().then(setClients).catch(reportError).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function toggle(c: SevigoClient) {
    if (openId === c.id) { setOpenId(null); return; }
    setOpenId(c.id); setHistory(null);
    setHistory(await fetchClientHistory(c.id).catch(e => { reportError(e); return []; }));
  }

  async function submit() {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Nom requis.'); return; }
    setSaving(true); setError('');
    try { await saveClient(draft); setDraft(null); load(); }
    catch (e: any) { setError(e.message ?? "Échec de l'enregistrement."); }
    finally { setSaving(false); }
  }

  function confirmDelete(c: SevigoClient) {
    alert('Supprimer ce client', `« ${c.name} » sera retiré de votre fichier. Ses ventes et factures passées sont conservées.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await deleteClient(c.id); setOpenId(null); load(); } catch (e: any) { alert('Erreur', e.message); }
      } },
    ]);
  }

  const call = (p: string) => { const u = `tel:${p}`; if (Platform.OS === 'web') window.open(u, '_self'); else Linking.openURL(u); };
  const mail = (m: string) => { const u = `mailto:${m}`; if (Platform.OS === 'web') window.open(u, '_self'); else Linking.openURL(u); };

  const q = search.trim().toLowerCase();
  const shown = clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}><ArrowLeft size={22} color={colors.encre} /></Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Clients</Text>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => { setError(''); setDraft({ ...EMPTY }); }}><Plus size={22} color={colors.encre} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {draft && (
          <View style={[styles.card, shadow.card, { gap: spacing.sm }]}>
            <View style={styles.rowBetween}>
              <Text style={[text.bodyMd, { color: colors.encre }]}>{draft.id ? 'Modifier le client' : 'Nouveau client'}</Text>
              <Pressable onPress={() => setDraft(null)}><X size={20} color={colors.textMuted} /></Pressable>
            </View>
            <TextInput style={styles.input} placeholder="Nom *" placeholderTextColor={colors.textMuted} value={draft.name} onChangeText={t => setDraft({ ...draft, name: t })} maxLength={80} />
            <TextInput style={styles.input} placeholder="Téléphone" placeholderTextColor={colors.textMuted} value={draft.phone} onChangeText={t => setDraft({ ...draft, phone: t })} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted} value={draft.email} onChangeText={t => setDraft({ ...draft, email: t })} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Adresse" placeholderTextColor={colors.textMuted} value={draft.address} onChangeText={t => setDraft({ ...draft, address: t })} />
            <TextInput style={[styles.input, { height: 76, paddingTop: 12 }]} placeholder="Notes (préférences, remarques…)" placeholderTextColor={colors.textMuted} value={draft.notes} onChangeText={t => setDraft({ ...draft, notes: t })} multiline textAlignVertical="top" maxLength={500} />
            {!!error && <Text style={{ color: colors.terre, fontSize: 14 }}>{error}</Text>}
            <Button label="Enregistrer" onPress={submit} loading={saving} />
          </View>
        )}

        <View style={styles.searchBox}>
          <Search size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Rechercher un client…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>

        {loading ? <ActivityIndicator color={colors.vert} style={{ marginTop: 30 }} /> : shown.length === 0 ? (
          <View style={styles.empty}>
            <Users size={40} color={colors.border} />
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>
              {clients.length === 0 ? 'Aucun client. Touchez + pour enregistrer le premier.' : 'Aucun résultat.'}
            </Text>
          </View>
        ) : shown.map(c => {
          const open = openId === c.id;
          const spent = (history ?? []).filter(h => h.counted).reduce((s, h) => s + h.total, 0);
          return (
            <View key={c.id} style={[styles.card, shadow.card]}>
              <Pressable style={styles.row} onPress={() => toggle(c)}>
                <View style={styles.avatar}><Text style={[text.bodyMd, { color: colors.white }]}>{c.name[0]?.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{c.name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{c.phone || c.email || 'Pas de contact'}</Text>
                </View>
              </Pressable>

              {open && (
                <View style={styles.detail}>
                  <View style={styles.actions}>
                    {!!c.phone && <Chip icon={<Phone size={14} color={colors.vert} />} label="Appeler" onPress={() => call(c.phone!)} />}
                    {!!c.email && <Chip icon={<Mail size={14} color={colors.vert} />} label="Email" onPress={() => mail(c.email!)} />}
                    {hasPos && <Chip icon={<Store size={14} color={colors.vert} />} label="Vendre" onPress={() => router.push({ pathname: '/sevigo/pos', params: { clientId: c.id } } as any)} />}
                    <Chip icon={<FileText size={14} color={colors.vert} />} label="Facturer" onPress={() => router.push({ pathname: '/sevigo/new-invoice', params: { clientId: c.id } } as any)} />
                  </View>
                  {!!c.address && <Line icon={<MapPin size={14} color={colors.textMuted} />} t={c.address} />}
                  {!!c.notes && <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>{c.notes}</Text>}

                  <View style={styles.totalBox}>
                    <Text style={[text.label, { color: colors.textMuted }]}>TOTAL DÉPENSÉ</Text>
                    <Text style={[text.data, { color: colors.encre, fontSize: 22 }]}>{history ? money(spent) : '…'}</Text>
                    <Text style={[text.label, { color: colors.textMuted }]}>Ventes terminées + factures payées</Text>
                  </View>

                  {history === null ? <ActivityIndicator color={colors.vert} /> : history.length === 0 ? (
                    <Text style={[text.small, { color: colors.textMuted }]}>Aucun achat enregistré pour ce client.</Text>
                  ) : history.slice(0, 10).map(h => (
                    <Pressable key={h.kind + h.id} style={styles.histRow}
                      onPress={() => h.kind === 'invoice' && router.push({ pathname: '/sevigo/invoice/[id]', params: { id: h.id } })}>
                      <Text style={[text.small, { color: colors.encre, flex: 1 }]}>
                        {h.kind === 'sale' ? 'Vente' : 'Facture'} {h.label} · {new Date(h.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                      <Text style={[text.small, { color: h.counted ? colors.vert : colors.textMuted }]}>{money(h.total)}</Text>
                    </Pressable>
                  ))}

                  <View style={styles.footerActions}>
                    <Pressable style={styles.linkBtn} onPress={() => { setError(''); setDraft({ id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', notes: c.notes ?? '' }); }}>
                      <Pencil size={14} color={colors.encre} /><Text style={[text.small, { color: colors.encre }]}>Modifier</Text>
                    </Pressable>
                    <Pressable style={styles.linkBtn} onPress={() => confirmDelete(c)}>
                      <Trash2 size={14} color={colors.terre} /><Text style={[text.small, { color: colors.terre }]}>Supprimer</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>{icon}<Text style={[text.small, { color: colors.vert }]}>{label}</Text></Pressable>
  );
}
function Line({ icon, t }: { icon: React.ReactNode; t: string }) {
  return <View style={styles.line}>{icon}<Text style={[text.small, { color: colors.encre, flex: 1 }]}>{t}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { minHeight: 46, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  detail: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)', gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2FBF6', borderWidth: 1, borderColor: colors.vert, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 7 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalBox: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.sm, gap: 2 },
  histRow: { flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
  footerActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
});
