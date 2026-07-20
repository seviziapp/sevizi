import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, Calendar as CalendarIcon } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchMyAppointments, cancelAppointment } from '../../src/lib/api';
import type { Appointment } from '../../src/lib/types';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABEL: Record<Appointment['status'], string> = {
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show: 'Absence',
};

export default function ClientAppointments() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetchMyAppointments().then(setAppointments).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const upcoming = appointments.filter(a => a.status === 'confirmed' && new Date(a.startsAt).getTime() > Date.now());
  const past = appointments.filter(a => !upcoming.includes(a));

  function onCancel(a: Appointment) {
    Alert.alert('Annuler ce rendez-vous ?', `${a.serviceName} — ${fmtDate(a.startsAt)} à ${fmtTime(a.startsAt)}`, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: async () => { await cancelAppointment(a.id); load(); } },
    ]);
  }

  function Card({ a }: { a: Appointment }) {
    return (
      <View style={[styles.card, shadow.card]}>
        <View style={styles.cardHead}>
          <Text style={[text.bodyMd, { color: colors.encre }]}>{a.serviceName}</Text>
          <View style={[styles.statusPill, a.status === 'confirmed' && styles.statusPillActive]}>
            <Text style={[text.small, { color: a.status === 'confirmed' ? colors.vert : colors.textMuted }]}>{STATUS_LABEL[a.status]}</Text>
          </View>
        </View>
        <Text style={[text.small, { color: colors.textMuted }]}>{a.providerName ?? 'Prestataire'}</Text>
        <View style={styles.metaRow}>
          <CalendarIcon size={13} color={colors.textMuted} />
          <Text style={[text.small, { color: colors.textMuted }]}>{fmtDate(a.startsAt)}</Text>
          <Clock size={13} color={colors.textMuted} style={{ marginLeft: spacing.sm }} />
          <Text style={[text.small, { color: colors.textMuted }]}>{fmtTime(a.startsAt)} · {a.durationMinutes} min</Text>
        </View>
        <Text style={[text.small, { color: colors.encre, marginTop: 2 }]}>{a.price.toLocaleString()} F</Text>
        {a.status === 'confirmed' && new Date(a.startsAt).getTime() > Date.now() && (
          <Pressable style={styles.cancelBtn} onPress={() => onCancel(a)}>
            <Text style={[text.small, { color: colors.terre }]}>Annuler</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes rendez-vous</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[text.label, { color: colors.textMuted }]}>À VENIR</Text>
          {upcoming.length === 0 ? (
            <Text style={[text.body, { color: colors.textMuted }]}>Aucun rendez-vous à venir.</Text>
          ) : (
            <View style={{ gap: spacing.md }}>{upcoming.map(a => <Card key={a.id} a={a} />)}</View>
          )}

          {past.length > 0 && (
            <>
              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>HISTORIQUE</Text>
              <View style={{ gap: spacing.md }}>{past.map(a => <Card key={a.id} a={a} />)}</View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.sm, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.creme },
  statusPillActive: { backgroundColor: colors.surface },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cancelBtn: { alignSelf: 'flex-start', marginTop: spacing.sm },
});
