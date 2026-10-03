// Sèvi Go — pick a saved client (or add one on the spot) for a till sale or an
// invoice. Unlimited plan; the database enforces that, this is just the UI.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, UserPlus, User } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../theme/tokens';
import { Button } from './Button';
import { fetchClients, saveClient, SevigoClient } from '../lib/sevigo/clients';
import { reportError } from '../lib/reportError';

export function ClientPicker({ visible, onClose, onSelect }: {
  visible: boolean; onClose: () => void; onSelect: (c: SevigoClient | null) => void;
}) {
  const [clients, setClients] = useState<SevigoClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetchClients().then(setClients).catch(reportError).finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (visible) { load(); setSearch(''); setAdding(false); setError(''); } }, [visible, load]);

  const q = search.trim().toLowerCase();
  const shown = clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));

  async function addClient() {
    if (!name.trim()) { setError('Nom requis.'); return; }
    setSaving(true); setError('');
    try {
      const c = await saveClient({ name, phone });
      setName(''); setPhone('');
      onSelect(c);
    } catch (e: any) { setError(e.message ?? "Impossible d'enregistrer le client."); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[text.h2, { color: colors.encre }]}>Choisir un client</Text>
          <Pressable onPress={onClose} style={styles.close}><X size={22} color={colors.encre} /></Pressable>
        </View>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Nom ou téléphone…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.row} onPress={() => onSelect(null)}>
            <User size={18} color={colors.textMuted} />
            <Text style={[text.body, { color: colors.textMuted, flex: 1 }]}>Client de passage (non enregistré)</Text>
          </Pressable>
          {adding ? (
            <View style={styles.addBox}>
              <TextInput style={styles.input} placeholder="Nom du client" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Téléphone (facultatif)" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              {!!error && <Text style={{ color: colors.terre, fontSize: 14 }}>{error}</Text>}
              <Button label="Enregistrer et choisir" onPress={addClient} loading={saving} />
            </View>
          ) : (
            <Pressable style={[styles.row, styles.rowAdd]} onPress={() => setAdding(true)}>
              <UserPlus size={18} color={colors.vert} />
              <Text style={[text.bodyMd, { color: colors.vert, flex: 1 }]}>Nouveau client</Text>
            </Pressable>
          )}
          {loading ? <ActivityIndicator color={colors.vert} style={{ marginTop: 24 }} /> : shown.map(c => (
            <Pressable key={c.id} style={styles.row} onPress={() => onSelect(c)}>
              <View style={styles.avatar}><Text style={[text.bodyMd, { color: colors.white }]}>{c.name[0]?.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{c.name}</Text>
                {!!c.phone && <Text style={[text.small, { color: colors.textMuted }]}>{c.phone}</Text>}
              </View>
            </Pressable>
          ))}
          {!loading && clients.length === 0 && !adding && (
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg }]}>Aucun client enregistré pour l'instant.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  close: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, height: 48 },
  searchInput: { flex: 1, ...text.body, color: colors.encre },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowAdd: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  avatar: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  addBox: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.vert },
  input: { height: 46, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.encre, backgroundColor: colors.white },
});
