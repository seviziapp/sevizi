import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Activity, Wrench, Wallet, CalendarClock, Crown } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchAdminActivity } from '../../src/lib/api';
import { timeAgo } from '../../src/lib/format';
import type { AdminActivityItem, AdminActivityKind } from '../../src/lib/types';

const KIND_ICON: Record<AdminActivityKind, React.ComponentType<any>> = {
  service_created: Wrench,
  job_sale: Wallet,
  appointment_sale: CalendarClock,
  pro_sale: Crown,
};

const KIND_COLOR: Record<AdminActivityKind, string> = {
  service_created: colors.encre,
  job_sale: colors.vert,
  appointment_sale: colors.vert,
  pro_sale: colors.soleil,
};

const KIND_LABEL: Record<AdminActivityKind, string> = {
  service_created: 'NOUVEAU SERVICE',
  job_sale: 'VENTE — MISSION',
  appointment_sale: 'VENTE — RENDEZ-VOUS',
  pro_sale: 'VENTE — ABONNEMENT PRO',
};

export default function AdminActivity() {
  const router = useRouter();
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchAdminActivity().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []));

  const sales = items.filter(i => i.kind !== 'service_created');
  const totalSales = sales.reduce((sum, i) => sum + (i.amount ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[text.h2, { color: colors.encre }]}>Activité</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>Nouveaux services et ventes récentes</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryCard, shadow.card]}>
            <Activity size={20} color={colors.vert} />
            <View style={{ flex: 1 }}>
              <Text style={[text.data, { color: colors.encre, fontSize: 20 }]}>{totalSales.toLocaleString('fr-FR')} F</Text>
              <Text style={[text.label, { color: colors.textMuted }]}>TOTAL DES {sales.length} DERNIÈRES VENTES</Text>
            </View>
          </View>

          {items.length === 0 && (
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: 40 }]}>
              Aucune activité pour l'instant.
            </Text>
          )}

          {items.map(item => {
            const Icon = KIND_ICON[item.kind];
            return (
              <View key={item.id} style={[styles.card, shadow.card]}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
                  <Icon size={18} color={KIND_COLOR[item.kind]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.label, { color: colors.textMuted }]}>{KIND_LABEL[item.kind]}</Text>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{item.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{item.subtitle}</Text>
                </View>
                <Text style={[text.small, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
});
