import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, User, Check, X as XIcon } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchProviderAppointments, markAppointmentStatus, cancelAppointment } from '../../src/lib/api';
import type { Appointment } from '../../src/lib/types';

function fmtDay(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ProviderAgenda() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetchProviderAppointments().then(setAppointments).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const groups = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = new Date(a.startsAt).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const days = Array.from(groups.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  async function onComplete(a: Appointment) {
    await markAppointmentStatus(a.id, 'completed');
    load();
  }
  async function onNoShow(a: Appointment) {
    await markAppointmentStatus(a.id, 'no_show');
    load();
  }
  function onCancel(a: Appointment) {
    Alert.alert('Annuler ce rendez-vous ?', a.clientName ?? '', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: async () => { await cancelAppointment(a.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mon agenda</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {days.length === 0 && (
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
              Aucun rendez-vous à venir.
            </Text>
          )}
          {days.map(([key, items]) => (
            <View key={key} style={{ gap: spacing.sm }}>
              <Text style={[text.label, { color: colors.textMuted }]}>{fmtDay(new Date(key)).toUpperCase()}</Text>
              {items.map(a => (
                <View key={a.id} style={[styles.card, shadow.card]}>
                  <View style={styles.timeCol}>
                    <Clock size={14} color={colors.vert} />
                    <Text style={[text.data, { color: colors.encre }]}>{fmtTime(a.startsAt)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyMd, { color: colors.encre }]}>{a.serviceName}</Text>
                    <View style={styles.metaRow}>
                      <User size={12} color={colors.textMuted} />
                      <Text style={[text.small, { color: colors.textMuted }]}>{a.clientName ?? 'Client'} · {a.durationMinutes} min · {a.price.toLocaleString()} F</Text>
                    </View>
                    {a.status === 'confirmed' && (
                      <View style={styles.actionsRow}>
                        <Pressable style={[styles.pill, { backgroundColor: colors.surface }]} onPress={() => onComplete(a)}>
                          <Check size={13} color={colors.vert} />
                          <Text style={[text.small, { color: colors.vert }]}>Terminé</Text>
                        </Pressable>
                        <Pressable style={[styles.pill, { backgroundColor: '#FCEFC7' }]} onPress={() => onNoShow(a)}>
                          <Text style={[text.small, { color: colors.encre }]}>Absent</Text>
                        </Pressable>
                        <Pressable style={styles.pill} onPress={() => onCancel(a)}>
                          <XIcon size={13} color={colors.terre} />
                          <Text style={[text.small, { color: colors.terre }]}>Annuler</Text>
                        </Pressable>
                      </View>
                    )}
                    {a.status !== 'confirmed' && (
                      <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>
                        {a.status === 'completed' ? 'Terminé' : a.status === 'no_show' ? 'Client absent' : 'Annulé'}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  timeCol: { alignItems: 'center', gap: 4, width: 56 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
});
