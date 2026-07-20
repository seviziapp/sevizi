import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Pencil, X } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchMyServices, saveService, deleteService } from '../../src/lib/api';
import type { ProviderService } from '../../src/lib/types';

export default function ProviderServices() {
  const router = useRouter();
  const [services, setServices] = useState<ProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProviderService | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetchMyServices().then(s => setServices(s.filter(x => x.active))).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openNew() {
    setEditing(null);
    setName(''); setDuration('30'); setPrice(''); setDeposit('');
    setShowForm(true);
  }

  function openEdit(s: ProviderService) {
    setEditing(s);
    setName(s.name); setDuration(String(s.durationMinutes)); setPrice(String(s.price)); setDeposit(String(s.depositAmount));
    setShowForm(true);
  }

  async function onSave() {
    if (!name.trim() || !duration || !price) {
      Alert.alert('Champs requis', 'Renseignez le nom, la durée et le prix.');
      return;
    }
    setSaving(true);
    try {
      await saveService({
        id: editing?.id,
        name: name.trim(),
        durationMinutes: parseInt(duration, 10) || 30,
        price: parseInt(price, 10) || 0,
        depositAmount: parseInt(deposit || '0', 10) || 0,
      });
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  function onDelete(s: ProviderService) {
    Alert.alert('Supprimer ce service ?', s.name, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteService(s.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes services & tarifs</Text>
        <Pressable style={styles.back} onPress={openNew}>
          <Plus size={22} color={colors.vert} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {services.length === 0 && (
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
              Aucun service pour l'instant. Ajoutez votre premier service (ex : "Coupe homme", 30 min, 2500 F).
            </Text>
          )}
          {services.map(s => (
            <View key={s.id} style={[styles.card, shadow.card]}>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{s.name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>
                  {s.durationMinutes} min · {s.price.toLocaleString()} F{s.depositAmount > 0 ? ` · Acompte ${s.depositAmount.toLocaleString()} F` : ''}
                </Text>
              </View>
              <Pressable style={styles.iconBtn} onPress={() => openEdit(s)}>
                <Pencil size={18} color={colors.encre} />
              </Pressable>
              <Pressable style={styles.iconBtn} onPress={() => onDelete(s)}>
                <Trash2 size={18} color={colors.terre} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {showForm && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, shadow.card]}>
            <View style={styles.modalHead}>
              <Text style={[text.h3, { color: colors.encre }]}>{editing ? 'Modifier le service' : 'Nouveau service'}</Text>
              <Pressable onPress={() => setShowForm(false)}><X size={22} color={colors.encre} /></Pressable>
            </View>
            <Text style={[text.label, { color: colors.textMuted }]}>NOM DU SERVICE</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Coupe homme" placeholderTextColor={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>DURÉE (MINUTES)</Text>
            <TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="30" placeholderTextColor={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>PRIX (FCFA)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="2500" placeholderTextColor={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>ACOMPTE À LA RÉSERVATION (FCFA, OPTIONNEL)</Text>
            <TextInput style={styles.input} value={deposit} onChangeText={setDeposit} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Un acompte réduit les rendez-vous manqués — le client le paie en ligne pour confirmer, et il est déduit du prix final.
            </Text>
            <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={onSave} loading={saving} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  iconBtn: { width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,41,31,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.xl },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  input: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, ...text.body, color: colors.encre, marginTop: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.creme },
});
