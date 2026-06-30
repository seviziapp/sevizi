import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, ShieldCheck, Clock, FileText } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchVerificationQueue, approveVerification, rejectVerification } from '../../src/lib/api';
import { CATEGORIES, type VerificationRequest } from '../../src/lib/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export default function Verification() {
  const [items, setItems] = useState<VerificationRequest[]>([]);

  useEffect(() => {
    fetchVerificationQueue().then(setItems).catch(() => {});
  }, []);

  async function approve(id: string) {
    await approveVerification(id);
    setItems(i => i.map(x => x.id === id ? { ...x, status: 'approved' } : x));
  }

  async function reject(id: string) {
    await rejectVerification(id);
    setItems(i => i.map(x => x.id === id ? { ...x, status: 'rejected' } : x));
  }

  const pending = items.filter(i => i.status === 'pending');
  const done = items.filter(i => i.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ShieldCheck size={24} color={colors.vert} />
        <Text style={[text.h2, { color: colors.encre }]}>Vérifications</Text>
        <View style={styles.countBadge}>
          <Text style={[text.label, { color: colors.white }]}>{pending.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && (
          <View style={styles.empty}>
            <ShieldCheck size={48} color={colors.border} />
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Aucune vérification en attente.
            </Text>
          </View>
        )}

        {pending.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted }]}>EN ATTENTE ({pending.length})</Text>
            {pending.map(item => (
              <VerifCard key={item.id} item={item} onApprove={() => approve(item.id)} onReject={() => reject(item.id)} />
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <Text style={[text.label, { color: colors.textMuted }]}>TRAITÉS</Text>
            {done.map(item => (
              <VerifCard key={item.id} item={item} readonly />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function openDoc(url?: string) {
  if (!url) return;
  if (Platform.OS === 'web') window.open(url, '_blank');
  else Linking.openURL(url);
}

function VerifCard({ item, onApprove, onReject, readonly }: {
  item: VerificationRequest; onApprove?: () => void; onReject?: () => void; readonly?: boolean;
}) {
  const cat = item.category ? CATEGORIES.find(c => c.key === item.category) : null;
  const statusColor = item.status === 'approved' ? colors.vert : item.status === 'rejected' ? colors.terre : colors.soleil;
  const statusLabel = item.status === 'approved' ? 'Approuvé' : item.status === 'rejected' ? 'Rejeté' : 'En attente';
  const isProvider = item.type === 'provider';

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, !isProvider && { backgroundColor: colors.soleil }]}>
          <Text style={[text.h3, { color: colors.creme }]}>{(item.displayName || '?')[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyMd, { color: colors.encre }]}>{item.displayName}</Text>
          <View style={styles.catRow}>
            <View style={styles.typeBadge}>
              <Text style={[text.label, { color: colors.encre }]}>{isProvider ? 'PRESTATAIRE' : 'CLIENT'}</Text>
            </View>
            {cat && <Text style={[text.small, { color: colors.textMuted }]}>{cat.emoji} {cat.label}</Text>}
          </View>
          <View style={styles.metaRow}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={[text.label, { color: colors.textMuted }]}>{timeAgo(item.submittedAt)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { borderColor: statusColor }]}>
          <Text style={[text.label, { color: statusColor }]}>{statusLabel.toUpperCase()}</Text>
        </View>
      </View>

      {/* Company info text (provider) */}
      {!!item.companyInfo && (
        <View style={styles.infoBox}>
          <Text style={[text.small, { color: colors.encre }]}>{item.companyInfo}</Text>
        </View>
      )}

      {/* Document links */}
      <View style={styles.docRow}>
        {item.idDocUrl && (
          <Pressable style={styles.docChip} onPress={() => openDoc(item.idDocUrl)}>
            <FileText size={14} color={colors.vert} />
            <Text style={[text.label, { color: colors.vert }]}>Pièce d'identité</Text>
          </Pressable>
        )}
        {item.tradeDocUrl && (
          <Pressable style={styles.docChip} onPress={() => openDoc(item.tradeDocUrl)}>
            <FileText size={14} color={colors.vert} />
            <Text style={[text.label, { color: colors.vert }]}>Licence / métier</Text>
          </Pressable>
        )}
        {!item.idDocUrl && !item.tradeDocUrl && (
          <Text style={[text.label, { color: colors.textMuted }]}>Aucun document joint</Text>
        )}
      </View>

      {!readonly && (
        <View style={styles.actions}>
          <Pressable style={styles.rejectBtn} onPress={onReject}>
            <X size={18} color={colors.terre} />
            <Text style={[text.bodyMd, { color: colors.terre }]}>Rejeter</Text>
          </Pressable>
          <Pressable style={styles.approveBtn} onPress={onApprove}>
            <Check size={18} color={colors.white} />
            <Text style={[text.bodyMd, { color: colors.white }]}>Approuver</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md },
  countBadge: { backgroundColor: colors.terre, borderRadius: radii.pill, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  typeBadge: { backgroundColor: colors.surface, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  statusBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  infoBox: { backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md },
  docRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F2FBF6', borderWidth: 1, borderColor: colors.vert, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  actions: { flexDirection: 'row', gap: spacing.md },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.terre },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radii.md, backgroundColor: colors.vert },
});
