import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Clock, Phone, CheckCircle, XCircle, Inbox } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { alert } from '../../src/lib/alert';
import { fetchOpenRequestsAdmin, adminCloseRequest } from '../../src/lib/api';
import { CATEGORIES } from '../../src/lib/types';
import type { AdminOpenRequest } from '../../src/lib/types';
import { reportError } from '../../src/lib/reportError';

const HOUR = 3600000;

function ageHours(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / HOUR;
}

function timeAgo(iso: string): string {
  const h = ageHours(iso);
  if (h < 1) return `Il y a ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `Il y a ${Math.round(h)}h`;
  return `Il y a ${Math.round(h / 24)}j`;
}

// Staleness tier drives sort order and the visual urgency cue — the whole
// point of this screen is surfacing what's been sitting longest first.
function urgencyColor(h: number): string {
  if (h >= 24) return colors.terre;
  if (h >= 2) return colors.soleil;
  return colors.vert;
}

export default function AdminOpenRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<AdminOpenRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchOpenRequestsAdmin().then(setRequests).catch(reportError).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function call(phone: string | null) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(reportError);
  }

  function close(r: AdminOpenRequest, status: 'annulee' | 'terminee') {
    const verb = status === 'terminee' ? 'marquer comme terminée' : 'annuler';
    alert(
      `Confirmer`,
      `${verb === 'annuler' ? 'Annuler' : 'Marquer comme terminée'} la demande de ${r.clientName} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui', style: status === 'annulee' ? 'destructive' : 'default', onPress: async () => {
            setBusyId(r.id);
            try {
              await adminCloseRequest(r.id, status);
              setRequests(rs => rs.filter(x => x.id !== r.id));
            } catch {
              // leave it in the list — admin can retry
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  }

  const stale = requests.filter(r => ageHours(r.createdAt) >= 24).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Demandes ouvertes</Text>
        {requests.length > 0 && (
          <View style={styles.badge}>
            <Text style={[text.label, { color: colors.white }]}>{requests.length}</Text>
          </View>
        )}
        {requests.length === 0 && <View style={{ width: 40 }} />}
      </View>

      {stale > 0 && (
        <View style={styles.staleBanner}>
          <Clock size={14} color={colors.terre} />
          <Text style={[text.small, { color: colors.terre, flex: 1 }]}>
            {stale} demande{stale > 1 ? 's' : ''} ouverte{stale > 1 ? 's' : ''} depuis plus de 24h — à appeler en priorité.
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : requests.length === 0 ? (
        <View style={styles.empty}>
          <CheckCircle size={48} color={colors.border} />
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Aucune demande ouverte. Tout est traité.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {requests.map(r => {
            const cat = CATEGORIES.find(c => c.key === r.category);
            const h = ageHours(r.createdAt);
            const urgency = urgencyColor(h);
            const busy = busyId === r.id;
            return (
              <View key={r.id} style={[styles.card, shadow.card, { borderLeftColor: urgency, borderLeftWidth: 3 }]}>
                <View style={styles.cardTop}>
                  <View style={styles.catIcon}>
                    <CategoryIcon category={r.category} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[text.bodyMd, { color: colors.encre }]} numberOfLines={1}>{r.clientName}</Text>
                      {r.urgent && (
                        <View style={styles.urgentTag}>
                          <Text style={[text.label, { color: colors.terre, fontSize: 10 }]}>URGENT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{r.description}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Clock size={12} color={urgency} />
                  <Text style={[text.label, { color: urgency }]}>{timeAgo(r.createdAt)}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>· {cat?.label}</Text>
                  {!!r.locationLabel && <Text style={[text.label, { color: colors.textMuted }]} numberOfLines={1}>· {r.locationLabel}</Text>}
                </View>

                <View style={[styles.offersTag, r.offersCount === 0 && styles.offersTagNone]}>
                  <Text style={[text.label, { color: r.offersCount === 0 ? colors.terre : colors.vert }]}>
                    {r.offersCount === 0 ? 'AUCUNE OFFRE REÇUE' : `${r.offersCount} offre${r.offersCount > 1 ? 's' : ''} reçue${r.offersCount > 1 ? 's' : ''}`}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.callBtn, !r.clientPhone && styles.actionDisabled]}
                    onPress={() => call(r.clientPhone)}
                    disabled={!r.clientPhone || busy}
                  >
                    <Phone size={15} color={colors.white} />
                    <Text style={[text.small, { color: colors.white }]}>{r.clientPhone ?? 'Pas de numéro'}</Text>
                  </Pressable>
                  <Pressable style={styles.doneBtn} onPress={() => close(r, 'terminee')} disabled={busy}>
                    <CheckCircle size={15} color={colors.vert} />
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => close(r, 'annulee')} disabled={busy}>
                    <XCircle size={15} color={colors.terre} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.terre, borderRadius: radii.pill, minWidth: 26, height: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  staleBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, backgroundColor: '#F8E2DA', borderRadius: radii.md, padding: spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl, marginTop: -spacing.xxxl },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  catIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  urgentTag: { backgroundColor: '#F8E2DA', borderRadius: radii.sm, paddingHorizontal: 6, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  offersTag: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  offersTagNone: { backgroundColor: '#F8E2DA' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 40, borderRadius: radii.md, backgroundColor: colors.vert },
  actionDisabled: { backgroundColor: colors.border },
  doneBtn: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: colors.terre, alignItems: 'center', justifyContent: 'center' },
});
