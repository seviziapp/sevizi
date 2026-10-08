// Sèvizi — admin view of the client waitlist (people who asked to be told
// when Sèvizi opens to clients). Registered with href:null on
// app/admin/_layout.tsx and linked from the admin dashboard.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Platform, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Download, Phone, Mail, Trash2 } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { fetchWaitlist, deleteWaitlistEntry, WaitlistEntry } from '../../src/lib/api';
import { timeAgo } from '../../src/lib/format';
import { alert } from '../../src/lib/alert';
import { reportError } from '../../src/lib/reportError';

function csvCell(v: string | null) {
  const s = v ?? '';
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminWaitlistScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetchWaitlist().then(setEntries).catch(e => { reportError(e); setError(e.message ?? 'Chargement impossible.'); });
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function exportCsv() {
    if (!entries?.length) return;
    const csv = ['Date;Téléphone;E-mail;Service recherché', ...entries.map(e =>
      [new Date(e.createdAt).toLocaleString('fr-FR'), e.phone, e.email, e.service].map(csvCell).join(';'))].join('\n');
    try {
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `sevizi-liste-attente-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csv, title: "Liste d'attente Sèvizi" });
      }
    } catch (e: any) { alert('Export impossible', e.message ?? ''); }
  }

  async function remove(id: string) {
    try { await deleteWaitlistEntry(id); setEntries(es => (es ?? []).filter(e => e.id !== id)); }
    catch (e: any) { alert('Erreur', e.message ?? 'Suppression impossible.'); }
  }

  function open(url: string) {
    if (Platform.OS === 'web') window.open(url, '_self'); else Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><ArrowLeft size={20} color={colors.encre} /></Pressable>
        <Text style={[text.h3, { color: colors.encre }]}>Liste d'attente clients</Text>
        <Pressable style={styles.iconBtn} onPress={exportCsv} disabled={!entries?.length}><Download size={18} color={colors.encre} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? <Text style={[text.body, { color: colors.terre }]}>{error}</Text>
          : !entries ? <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.xl }} />
          : (
            <>
              <View style={[styles.hero, shadow.card]}>
                <Text style={[text.label, { color: colors.textMutedDark }]}>PERSONNES EN ATTENTE</Text>
                <Text style={[text.h1, { color: colors.textOnDark }]}>{entries.length}</Text>
              </View>
              {entries.length === 0 && (
                <Text style={[text.body, { color: colors.textMuted }]}>Personne pour l'instant. Les inscriptions apparaissent ici.</Text>
              )}
              {entries.map(e => (
                <View key={e.id} style={[styles.card, shadow.card]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    {e.phone && (
                      <Pressable style={styles.row} onPress={() => open(`tel:+228${e.phone}`)}>
                        <Phone size={14} color={colors.vert} /><Text style={[text.bodyMd, { color: colors.encre }]}>{e.phone}</Text>
                      </Pressable>
                    )}
                    {e.email && (
                      <Pressable style={styles.row} onPress={() => open(`mailto:${e.email}`)}>
                        <Mail size={14} color={colors.vert} /><Text style={[text.small, { color: colors.encre }]}>{e.email}</Text>
                      </Pressable>
                    )}
                    {e.service ? <Text style={[text.small, { color: colors.textMuted }]}>Cherche : {e.service}</Text> : null}
                    <Text style={[text.small, { color: colors.textMuted }]}>{timeAgo(e.createdAt)}</Text>
                  </View>
                  <Pressable onPress={() => remove(e.id)} hitSlop={8}><Trash2 size={18} color={colors.terre} /></Pressable>
                </View>
              ))}
            </>
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  hero: { backgroundColor: colors.encre, borderRadius: radii.xl, padding: spacing.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
