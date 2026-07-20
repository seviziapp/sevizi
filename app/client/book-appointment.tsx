import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ExpoLinking from 'expo-linking';
import { ArrowLeft, Clock, Check } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { fetchProviderServices, fetchAvailableSlots, createAppointmentInvoice, fetchAppointmentDepositStatus } from '../../src/lib/api';
import type { ProviderService } from '../../src/lib/types';

function nextDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function buildRedirectUrl(status: 'return' | 'cancel', appointmentId?: string): string {
  const query = appointmentId ? `payment=${status}&appointmentId=${appointmentId}` : `payment=${status}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/client/book-appointment?${query}`;
  }
  return ExpoLinking.createURL('/client/book-appointment', { queryParams: appointmentId ? { payment: status, appointmentId } : { payment: status } });
}

export default function BookAppointment() {
  const router = useRouter();
  const { providerId, providerName, payment: paymentParam, appointmentId: apptParam } = useLocalSearchParams<{
    providerId?: string; providerName?: string; payment?: string; appointmentId?: string;
  }>();

  const [services, setServices] = useState<ProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ProviderService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(nextDays(1)[0]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const days = useMemo(() => nextDays(14), []);

  useEffect(() => {
    if (!providerId) return;
    fetchProviderServices(providerId).then(setServices).finally(() => setLoading(false));
  }, [providerId]);

  useEffect(() => {
    if (!providerId || !selectedService) { setSlots([]); return; }
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetchAvailableSlots(providerId, selectedService, toDateKey(selectedDate))
      .then(setSlots)
      .finally(() => setLoadingSlots(false));
  }, [providerId, selectedService, selectedDate]);

  // Coming back from PayDunya's checkout — poll for deposit confirmation.
  useEffect(() => {
    if (paymentParam !== 'return' || !apptParam) return;
    setVerifying(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts += 1;
      const status = await fetchAppointmentDepositStatus(apptParam);
      if (status === 'paid') {
        setConfirmed(true);
        setVerifying(false);
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (status === 'failed' || attempts >= 10) {
        setVerifying(false);
        if (status === 'failed') setError("Le paiement de l'acompte n'a pas abouti. Choisissez à nouveau un créneau.");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [paymentParam, apptParam]);

  async function onConfirm() {
    if (!selectedService || !selectedSlot) return;
    setError('');
    setBooking(true);
    try {
      const result = await createAppointmentInvoice({
        serviceId: selectedService.id,
        startsAt: selectedSlot,
        returnUrl: buildRedirectUrl('return', undefined),
        cancelUrl: buildRedirectUrl('cancel'),
      });
      if (result.confirmed) {
        setConfirmed(true);
        return;
      }
      if (result.invoiceUrl) {
        router.setParams({ appointmentId: result.appointmentId } as any);
        if (Platform.OS === 'web') {
          window.location.href = result.invoiceUrl;
        } else {
          await Linking.openURL(result.invoiceUrl);
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Échec de la réservation.');
    } finally {
      setBooking(false);
    }
  }

  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.confirmedWrap}>
          <View style={styles.confirmedIcon}>
            <Check size={36} color={colors.white} />
          </View>
          <Text style={[text.h2, { color: colors.encre, textAlign: 'center' }]}>Rendez-vous confirmé !</Text>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Vous recevrez une notification de rappel avant votre rendez-vous.
          </Text>
          <Button label="Voir mes rendez-vous" onPress={() => router.replace('/client/appointments')} style={{ marginTop: spacing.lg }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]} numberOfLines={1}>{providerName ?? 'Rendez-vous'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : verifying ? (
        <View style={styles.confirmedWrap}>
          <ActivityIndicator color={colors.vert} />
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.md }]}>Vérification du paiement de l'acompte…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[text.label, { color: colors.textMuted }]}>1. CHOISISSEZ UN SERVICE</Text>
          <View style={{ gap: spacing.sm }}>
            {services.map(s => (
              <Pressable
                key={s.id}
                style={[styles.serviceCard, selectedService?.id === s.id && styles.serviceCardActive]}
                onPress={() => setSelectedService(s)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{s.name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{s.durationMinutes} min · {s.price.toLocaleString()} F{s.depositAmount > 0 ? ` · Acompte ${s.depositAmount.toLocaleString()} F` : ''}</Text>
                </View>
                {selectedService?.id === s.id && <Check size={18} color={colors.vert} />}
              </Pressable>
            ))}
            {services.length === 0 && (
              <Text style={[text.body, { color: colors.textMuted }]}>Ce prestataire n'a pas encore de services en ligne.</Text>
            )}
          </View>

          {selectedService && (
            <>
              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>2. CHOISISSEZ UNE DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {days.map(d => {
                  const active = toDateKey(d) === toDateKey(selectedDate);
                  return (
                    <Pressable key={toDateKey(d)} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDate(d)}>
                      <Text style={[text.small, { color: active ? colors.white : colors.textMuted }]}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</Text>
                      <Text style={[text.bodyMd, { color: active ? colors.white : colors.encre }]}>{d.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>3. CHOISISSEZ UN CRÉNEAU</Text>
              {loadingSlots ? (
                <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.md }} />
              ) : slots.length === 0 ? (
                <Text style={[text.body, { color: colors.textMuted }]}>Aucun créneau disponible ce jour-là.</Text>
              ) : (
                <View style={styles.slotGrid}>
                  {slots.map(iso => {
                    const active = selectedSlot === iso;
                    return (
                      <Pressable key={iso} style={[styles.slot, active && styles.slotActive]} onPress={() => setSelectedSlot(iso)}>
                        <Clock size={13} color={active ? colors.white : colors.vert} />
                        <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>
                          {new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {!!error && <Text style={[text.small, { color: colors.terre, marginTop: spacing.md }]}>{error}</Text>}

          {selectedService && selectedSlot && (
            <Button
              label={booking ? 'Réservation…' : selectedService.depositAmount > 0
                ? `Confirmer et payer l'acompte (${selectedService.depositAmount.toLocaleString()} F)`
                : 'Confirmer le rendez-vous'}
              onPress={onConfirm}
              loading={booking}
              style={{ marginTop: spacing.xl }}
            />
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
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.sm },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  serviceCardActive: { borderColor: colors.vert, backgroundColor: colors.surface },
  dayChip: { width: 56, height: 64, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayChipActive: { backgroundColor: colors.vert, borderColor: colors.vert },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  slotActive: { backgroundColor: colors.vert, borderColor: colors.vert },
  confirmedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  confirmedIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
});
