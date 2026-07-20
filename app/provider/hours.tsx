import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchMyAvailability, saveMyAvailability } from '../../src/lib/api';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

type DayRow = { enabled: boolean; startTime: string; endTime: string };

export default function ProviderHours() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<DayRow[]>(
    DAYS.map(() => ({ enabled: false, startTime: '09:00', endTime: '18:00' }))
  );

  useEffect(() => {
    fetchMyAvailability().then(slots => {
      const next = DAYS.map(() => ({ enabled: false, startTime: '09:00', endTime: '18:00' }));
      for (const s of slots) {
        next[s.dayOfWeek] = { enabled: true, startTime: s.startTime, endTime: s.endTime };
      }
      setRows(next);
    }).finally(() => setLoading(false));
  }, []);

  function updateRow(i: number, patch: Partial<DayRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  async function onSave() {
    setSaving(true);
    try {
      const slots = rows
        .map((r, i) => ({ dayOfWeek: i, startTime: r.startTime, endTime: r.endTime, enabled: r.enabled }))
        .filter(r => r.enabled && r.startTime < r.endTime);
      await saveMyAvailability(slots);
      Alert.alert('Enregistré', 'Vos horaires ont été mis à jour.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes horaires</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[text.small, { color: colors.textMuted }]}>
            Activez les jours où vous acceptez des rendez-vous et indiquez vos heures d'ouverture.
          </Text>
          {DAYS.map((day, i) => (
            <View key={day} style={styles.dayCard}>
              <View style={styles.dayHead}>
                <Text style={[text.bodyMd, { color: colors.encre }]}>{day}</Text>
                <Switch
                  value={rows[i].enabled}
                  onValueChange={v => updateRow(i, { enabled: v })}
                  trackColor={{ false: colors.border, true: colors.vert }}
                  thumbColor={colors.white}
                />
              </View>
              {rows[i].enabled && (
                <View style={styles.timeRow}>
                  <TextInput
                    style={styles.timeInput}
                    value={rows[i].startTime}
                    onChangeText={v => updateRow(i, { startTime: v })}
                    placeholder="09:00"
                  />
                  <Text style={[text.body, { color: colors.textMuted }]}>à</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={rows[i].endTime}
                    onChangeText={v => updateRow(i, { endTime: v })}
                    placeholder="18:00"
                  />
                </View>
              )}
            </View>
          ))}
          <Button label={saving ? 'Enregistrement…' : 'Enregistrer les horaires'} onPress={onSave} loading={saving} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  dayCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeInput: { flex: 1, height: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, ...text.body, color: colors.encre, backgroundColor: colors.creme, textAlign: 'center' },
});
