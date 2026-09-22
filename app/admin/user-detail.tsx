// Sèvizi — admin's read-only detail view for a single user, reached by
// tapping a row in Utilisateurs. Flat file + `?id=` param (not a nested
// dynamic route) to match this layout's existing convention: every
// non-tab-bar screen here is a plain file registered with href:null on
// app/admin/_layout.tsx's <Tabs>.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, User, ShieldCheck, Phone, Mail, MapPin, Calendar,
  Briefcase, Star, Clock, Trash2, ClipboardList,
} from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchAdminUserDetail, adminDeleteUser, AdminUserDetail } from '../../src/lib/api';
import { CATEGORIES } from '../../src/lib/types';
import { alert } from '../../src/lib/alert';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ouverte: { label: 'Ouverte', color: colors.soleil },
  en_cours: { label: 'En cours', color: colors.vert },
  terminee: { label: 'Terminée', color: colors.vert },
  annulee: { label: 'Annulée', color: colors.textMuted },
};

const VERIF_LABEL: Record<string, { label: string; color: string }> = {
  none: { label: 'Non vérifié', color: colors.textMuted },
  pending: { label: 'Vérification en attente', color: colors.soleil },
  approved: { label: 'Vérifié', color: colors.vert },
  rejected: { label: 'Vérification rejetée', color: colors.terre },
};

function callPhone(phone: string) {
  if (!phone) return;
  const url = `tel:${phone}`;
  if (Platform.OS === 'web') window.open(url, '_self');
  else Linking.openURL(url);
}

function mailTo(email: string) {
  if (!email) return;
  const url = `mailto:${email}`;
  if (Platform.OS === 'web') window.open(url, '_self');
  else Linking.openURL(url);
}

export default function AdminUserDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchAdminUserDetail(id).then(setDetail).finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete() {
    if (!detail) return;
    alert(
      'Supprimer ce compte',
      `${detail.fullName} perdra définitivement l'accès à son compte, son profil et ses documents. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: doDelete },
      ],
    );
  }

  async function doDelete() {
    if (!detail) return;
    setDeleting(true);
    try {
      await adminDeleteUser(detail.id);
      router.back();
    } catch (e: any) {
      alert('Erreur', e.message ?? 'Échec de la suppression.');
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.iconBtn, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Détails utilisateur</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : !detail ? (
        <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
          Utilisateur introuvable.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={[styles.card, shadow.card]}>
            <View style={styles.profileTop}>
              <View style={[styles.avatar, detail.role === 'prestataire' && styles.avatarProvider]}>
                <Text style={[text.h2, { color: colors.white }]}>{(detail.fullName || '?')[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.h3, { color: colors.encre }]}>{detail.fullName}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.roleBadge}>
                    <Text style={[text.label, { color: colors.encre }]}>
                      {detail.role === 'prestataire' ? 'PRESTATAIRE' : 'CLIENT'}
                    </Text>
                  </View>
                  {detail.verified && (
                    <View style={[styles.roleBadge, { backgroundColor: '#F2FBF6' }]}>
                      <ShieldCheck size={12} color={colors.vert} />
                      <Text style={[text.label, { color: colors.vert }]}>VÉRIFIÉ</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.infoList}>
              <Pressable style={styles.infoRow} onPress={() => callPhone(detail.phone)} disabled={!detail.phone}>
                <Phone size={16} color={colors.textMuted} />
                <Text style={[text.small, { color: detail.phone ? colors.vert : colors.textMuted }]}>
                  {detail.phone || 'Aucun téléphone'}
                </Text>
              </Pressable>
              <Pressable style={styles.infoRow} onPress={() => mailTo(detail.email)} disabled={!detail.email}>
                <Mail size={16} color={colors.textMuted} />
                <Text style={[text.small, { color: detail.email ? colors.vert : colors.textMuted }]}>
                  {detail.email || 'Aucun email'}
                </Text>
              </Pressable>
              {!!detail.locationLabel && (
                <View style={styles.infoRow}>
                  <MapPin size={16} color={colors.textMuted} />
                  <Text style={[text.small, { color: colors.encre }]}>{detail.locationLabel}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Calendar size={16} color={colors.textMuted} />
                <Text style={[text.small, { color: colors.encre }]}>
                  Inscrit le {new Date(detail.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <ShieldCheck size={16} color={colors.textMuted} />
                <Text style={[text.small, { color: VERIF_LABEL[detail.verificationStatus].color }]}>
                  {VERIF_LABEL[detail.verificationStatus].label}
                </Text>
              </View>
            </View>
          </View>

          {/* Provider business card */}
          {detail.provider && (
            <View style={[styles.card, shadow.card]}>
              <View style={styles.sectionHead}>
                <Briefcase size={18} color={colors.vert} />
                <Text style={[text.bodyMd, { color: colors.encre, flex: 1 }]}>{detail.provider.name}</Text>
                <View style={[styles.roleBadge, detail.provider.tier === 'pro' && { backgroundColor: '#FFF8E6' }]}>
                  <Text style={[text.label, { color: detail.provider.tier === 'pro' ? colors.soleil : colors.textMuted }]}>
                    {detail.provider.tier === 'pro' ? 'PRO' : 'GRATUIT'}
                  </Text>
                </View>
              </View>
              <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>
                {CATEGORIES.find(c => c.key === detail.provider!.category)?.label ?? detail.provider.category}
                {detail.provider.categories.length > 0 && ` + ${detail.provider.categories.length} autre${detail.provider.categories.length > 1 ? 's' : ''}`}
              </Text>
              {!!detail.provider.bio && (
                <Text style={[text.small, { color: colors.encre, marginTop: spacing.sm }]}>{detail.provider.bio}</Text>
              )}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Star size={14} color={colors.soleil} />
                  <Text style={[text.small, { color: colors.encre }]}>{detail.provider.rating.toFixed(1)} ({detail.provider.reviews})</Text>
                </View>
                <View style={styles.statItem}>
                  <ClipboardList size={14} color={colors.textMuted} />
                  <Text style={[text.small, { color: colors.encre }]}>{detail.provider.missions} missions</Text>
                </View>
                <View style={styles.statItem}>
                  <Clock size={14} color={colors.textMuted} />
                  <Text style={[text.small, { color: colors.encre }]}>{detail.provider.responseRate}% réponse</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.dot, { backgroundColor: detail.provider.online ? colors.vert : colors.border }]} />
                <Text style={[text.label, { color: colors.textMuted }]}>{detail.provider.online ? 'En ligne' : 'Hors ligne'}</Text>
                {detail.provider.verified && (
                  <Text style={[text.label, { color: colors.vert, marginLeft: spacing.md }]}>· Prestataire vérifié</Text>
                )}
              </View>
            </View>
          )}

          {/* Recent requests (as client) */}
          {detail.recentRequests.length > 0 && (
            <View style={[styles.card, shadow.card]}>
              <View style={styles.sectionHead}>
                <ClipboardList size={18} color={colors.encre} />
                <Text style={[text.bodyMd, { color: colors.encre }]}>Demandes récentes</Text>
              </View>
              {detail.recentRequests.map(r => {
                const cat = CATEGORIES.find(c => c.key === r.category);
                const st = STATUS_LABEL[r.status] ?? { label: r.status, color: colors.textMuted };
                return (
                  <View key={r.id} style={styles.reqRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.small, { color: colors.encre }]} numberOfLines={1}>{r.description}</Text>
                      <Text style={[text.label, { color: colors.textMuted }]}>
                        {cat?.label ?? r.category} · {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <Text style={[text.label, { color: st.color }]}>{st.label.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Danger zone */}
          <Pressable style={styles.deleteBtn} onPress={confirmDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator size="small" color={colors.terre} /> : <Trash2 size={18} color={colors.terre} />}
            <Text style={[text.bodyMd, { color: colors.terre }]}>
              {deleting ? 'Suppression en cours…' : 'Supprimer ce compte'}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: radii.lg, backgroundColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  avatarProvider: { backgroundColor: colors.vert },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm, backgroundColor: colors.surface },
  infoList: { marginTop: spacing.lg, gap: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)', paddingTop: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(6,41,31,0.05)' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: colors.terre, marginTop: spacing.md,
  },
});
