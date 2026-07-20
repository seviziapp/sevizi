import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tag, Plus, Trash2, Pencil, X } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchDiscountCodes, saveDiscountCode, deleteDiscountCode } from '../../src/lib/api';
import type { DiscountCode } from '../../src/lib/types';

const APPLIES_TO_LABEL: Record<DiscountCode['appliesTo'], string> = {
  commission: 'Commission',
  membership: 'Abonnement Pro',
  both: 'Les deux',
};

export default function AdminDiscounts() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);

  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'percent' | 'flat'>('percent');
  const [appliesTo, setAppliesTo] = useState<DiscountCode['appliesTo']>('both');
  const [value, setValue] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetchDiscountCodes().then(setCodes).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openNew() {
    setEditing(null);
    setCode(''); setLabel(''); setKind('percent'); setAppliesTo('both');
    setValue(''); setDurationDays(''); setMaxRedemptions(''); setExpiresAt(''); setActive(true);
    setShowForm(true);
  }

  function openEdit(c: DiscountCode) {
    setEditing(c);
    setCode(c.code); setLabel(c.label ?? ''); setKind(c.kind); setAppliesTo(c.appliesTo);
    setValue(String(c.value)); setDurationDays(c.durationDays != null ? String(c.durationDays) : '');
    setMaxRedemptions(c.maxRedemptions != null ? String(c.maxRedemptions) : '');
    setExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : ''); setActive(c.active);
    setShowForm(true);
  }

  async function onSave() {
    if (!code.trim() || !value) {
      Alert.alert('Champs requis', 'Renseignez le code et la valeur de la réduction.');
      return;
    }
    if (kind === 'flat' && appliesTo !== 'membership') {
      Alert.alert('Combinaison invalide', "Un code à montant fixe ne peut s'appliquer qu'à l'abonnement Pro (pas de montant fixe sur un taux de commission).");
      return;
    }
    setSaving(true);
    try {
      await saveDiscountCode({
        id: editing?.id, code: code.trim(), label: label.trim() || undefined, kind, appliesTo,
        value: parseInt(value, 10) || 0,
        durationDays: durationDays ? parseInt(durationDays, 10) : null,
        maxRedemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59Z`).toISOString() : null,
        active,
      });
      setShowForm(false);
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  function onDelete(c: DiscountCode) {
    Alert.alert('Supprimer ce code ?', c.code, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteDiscountCode(c.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Tag size={24} color={colors.vert} />
        <Text style={[text.h2, { color: colors.encre, flex: 1 }]}>Codes de réduction</Text>
        <Pressable style={styles.addBtn} onPress={openNew}>
          <Plus size={20} color={colors.white} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {codes.length === 0 && (
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
              Aucun code pour l'instant. Créez-en un pour offrir une réduction sur la commission ou l'abonnement Sèvizi Pro.
            </Text>
          )}
          {codes.map(c => (
            <View key={c.id} style={[styles.card, shadow.card, !c.active && styles.cardInactive]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.data, { color: colors.encre, fontSize: 16 }]}>{c.code}</Text>
                  {!!c.label && <Text style={[text.small, { color: colors.textMuted }]}>{c.label}</Text>}
                </View>
                <View style={[styles.statusPill, c.active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[text.label, { color: c.active ? colors.vert : colors.textMuted }]}>
                    {c.active ? 'ACTIF' : 'INACTIF'}
                  </Text>
                </View>
              </View>
              <Text style={[text.small, { color: colors.encre }]}>
                {c.kind === 'percent' ? `${c.value}%` : `${c.value.toLocaleString('fr-FR')} F`} de réduction · {APPLIES_TO_LABEL[c.appliesTo]}
              </Text>
              <Text style={[text.small, { color: colors.textMuted }]}>
                {c.redemptionCount} utilisé{c.redemptionCount > 1 ? 's' : ''}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''}
                {c.durationDays != null ? ` · valable ${c.durationDays}j après réduction` : ''}
                {c.expiresAt ? ` · expire le ${new Date(c.expiresAt).toLocaleDateString('fr-FR')}` : ''}
              </Text>
              <View style={styles.cardActions}>
                <Pressable style={styles.iconBtn} onPress={() => openEdit(c)}>
                  <Pencil size={16} color={colors.encre} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => onDelete(c)}>
                  <Trash2 size={16} color={colors.terre} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {showForm && (
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modal, shadow.card]} contentContainerStyle={{ padding: spacing.xl }}>
            <View style={styles.modalHead}>
              <Text style={[text.h3, { color: colors.encre }]}>{editing ? 'Modifier le code' : 'Nouveau code'}</Text>
              <Pressable onPress={() => setShowForm(false)}><X size={22} color={colors.encre} /></Pressable>
            </View>

            <Text style={[text.label, { color: colors.textMuted }]}>CODE</Text>
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="LANCEMENT2027" autoCapitalize="characters" placeholderTextColor={colors.textMuted} />

            <Text style={[text.label, { color: colors.textMuted }]}>DESCRIPTION (OPTIONNEL)</Text>
            <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Promo lancement" placeholderTextColor={colors.textMuted} />

            <Text style={[text.label, { color: colors.textMuted }]}>S'APPLIQUE À</Text>
            <View style={styles.chipRow}>
              {(['commission', 'membership', 'both'] as const).map(a => (
                <Pressable key={a} style={[styles.chip, appliesTo === a && styles.chipActive]} onPress={() => setAppliesTo(a)}>
                  <Text style={[text.small, { color: appliesTo === a ? colors.white : colors.encre }]}>{APPLIES_TO_LABEL[a]}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[text.label, { color: colors.textMuted }]}>TYPE</Text>
            <View style={styles.chipRow}>
              <Pressable style={[styles.chip, kind === 'percent' && styles.chipActive]} onPress={() => setKind('percent')}>
                <Text style={[text.small, { color: kind === 'percent' ? colors.white : colors.encre }]}>Pourcentage</Text>
              </Pressable>
              <Pressable style={[styles.chip, kind === 'flat' && styles.chipActive]} onPress={() => setKind('flat')}>
                <Text style={[text.small, { color: kind === 'flat' ? colors.white : colors.encre }]}>Montant fixe (F)</Text>
              </Pressable>
            </View>

            <Text style={[text.label, { color: colors.textMuted }]}>VALEUR {kind === 'percent' ? '(%)' : '(FCFA)'}</Text>
            <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="number-pad" placeholder={kind === 'percent' ? '50' : '2500'} placeholderTextColor={colors.textMuted} />

            <Text style={[text.label, { color: colors.textMuted }]}>DURÉE DE LA RÉDUCTION COMMISSION (JOURS, OPTIONNEL)</Text>
            <TextInput style={styles.input} value={durationDays} onChangeText={setDurationDays} keyboardType="number-pad" placeholder="Laisser vide = permanent" placeholderTextColor={colors.textMuted} />

            <Text style={[text.label, { color: colors.textMuted }]}>LIMITE D'UTILISATIONS (OPTIONNEL)</Text>
            <TextInput style={styles.input} value={maxRedemptions} onChangeText={setMaxRedemptions} keyboardType="number-pad" placeholder="Laisser vide = illimité" placeholderTextColor={colors.textMuted} />

            <Text style={[text.label, { color: colors.textMuted }]}>DATE D'EXPIRATION DU CODE (OPTIONNEL, AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={expiresAt} onChangeText={setExpiresAt} placeholder="2027-01-04" placeholderTextColor={colors.textMuted} />

            <View style={styles.activeRow}>
              <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>Actif</Text>
              <Switch value={active} onValueChange={setActive} trackColor={{ false: colors.border, true: colors.vert }} thumbColor={colors.white} />
            </View>

            <Button label={saving ? 'Enregistrement…' : 'Enregistrer'} onPress={onSave} loading={saving} style={{ marginTop: spacing.md }} />
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  addBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: 6, borderWidth: 1, borderColor: colors.border },
  cardInactive: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill },
  statusActive: { backgroundColor: colors.surface },
  statusInactive: { backgroundColor: colors.creme },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  iconBtn: { width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(6,41,31,0.4)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: { width: '100%', maxWidth: 460, maxHeight: '90%', backgroundColor: colors.white, borderRadius: radii.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  input: { height: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.lg, ...text.body, color: colors.encre, marginTop: spacing.xs, marginBottom: spacing.md, backgroundColor: colors.creme },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  activeRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
