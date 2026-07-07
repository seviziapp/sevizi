import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, CheckCircle, Clock, Phone } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchWithdrawalRequests, markWithdrawalSent } from '../../src/lib/api';
import type { WithdrawalRequest } from '../../src/lib/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function Withdrawals() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    fetchWithdrawalRequests().then(setRequests).catch(() => {});
  }, []);

  async function send(id: string) {
    setSending(id);
    try {
      await markWithdrawalSent(id);
      setRequests(rs => rs.map(r => r.id === id ? { ...r, status: 'sent' } : r));
    } finally {
      setSending(null);
    }
  }

  const pending = requests.filter(r => r.status === 'pending');
  const resolved = requests.filter(r => r.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Wallet size={24} color={colors.vert} />
        <Text style={[text.h2, { color: colors.encre }]}>Retraits</Text>
        {pending.length > 0 && (
          <View style={styles.badge}>
            <Text style={[text.label, { color: colors.white }]}>{pending.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && (
          <View style={styles.empty}>
            <CheckCircle size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>Aucune demande en attente.</Text>
          </View>
        )}

        {pending.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted }]}>EN ATTENTE ({pending.length})</Text>
            {pending.map(r => (
              <WithdrawalCard key={r.id} req={r} onSend={() => send(r.id)} sending={sending === r.id} />
            ))}
          </>
        )}

        {resolved.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted, marginTop: spacing.lg }]}>HISTORIQUE</Text>
            {resolved.map(r => <WithdrawalCard key={r.id} req={r} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function WithdrawalCard({ req, onSend, sending }: { req: WithdrawalRequest; onSend?: () => void; sending?: boolean }) {
  const isPending = req.status === 'pending';
  return (
    <View style={[styles.card, shadow.card, isPending && styles.cardPending]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, isPending ? styles.iconPending : styles.iconDone]}>
          {isPending ? <Clock size={20} color={colors.soleil} /> : <CheckCircle size={20} color={colors.vert} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyMd, { color: colors.encre }]}>{req.providerName}</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{timeAgo(req.requestedAt)}</Text>
        </View>
        <Text style={[text.data, { color: colors.encre, fontSize: 18 }]}>{req.amount.toLocaleString('fr-FR')} F</Text>
      </View>

      <View style={styles.methodRow}>
        <View style={styles.methodTag}>
          <Text style={[text.label, { color: colors.encre }]}>{req.method === 'flooz' ? 'FLOOZ' : 'MIXX'}</Text>
        </View>
        <View style={styles.phoneRow}>
          <Phone size={13} color={colors.textMuted} />
          <Text style={[text.small, { color: colors.textMuted }]}>{req.phone}</Text>
        </View>
      </View>

      {isPending && onSend && (
        <Pressable style={styles.sendBtn} onPress={onSend} disabled={sending}>
          <Text style={[text.bodyMd, { color: colors.white }]}>{sending ? 'Envoi…' : 'Marquer comme envoyé'}</Text>
        </Pressable>
      )}
      {!isPending && (
        <Text style={[text.label, { color: req.status === 'sent' ? colors.vert : colors.terre }]}>
          {req.status === 'sent' ? 'ENVOYÉ' : 'REFUSÉ'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  badge: { backgroundColor: colors.soleil, borderRadius: radii.pill, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardPending: { borderColor: '#FCEFC7' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  iconPending: { backgroundColor: '#FCEFC7' },
  iconDone: { backgroundColor: colors.surface },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  methodTag: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sendBtn: { height: 44, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
});
