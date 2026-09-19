// Sèvizi — admin sends a one-off notification to all clients, all
// providers, or everyone. Delivered through the existing notifications
// table/screen (type 'system') via the admin_broadcast_notification RPC,
// which itself checks is_admin() and always excludes admin accounts from
// the recipient list.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Megaphone, Users, Briefcase, Globe, Send } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { alert } from '../../src/lib/alert';
import { broadcastNotification, BroadcastAudience } from '../../src/lib/api';

const AUDIENCES: { key: BroadcastAudience; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'Tout le monde', icon: Globe },
  { key: 'client', label: 'Clients', icon: Users },
  { key: 'prestataire', label: 'Prestataires', icon: Briefcase },
];

export default function AdminBroadcast() {
  const router = useRouter();
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  function confirmSend() {
    setError('');
    if (!title.trim() || !body.trim()) { setError('Titre et message requis.'); return; }
    const audienceLabel = AUDIENCES.find(a => a.key === audience)!.label;
    alert(
      'Envoyer la notification',
      `Envoyer à : ${audienceLabel}\n\n"${title.trim()}"\n${body.trim()}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: doSend },
      ],
    );
  }

  async function doSend() {
    setSending(true);
    try {
      const count = await broadcastNotification({ audience, title: title.trim(), body: body.trim() });
      alert('Envoyé', `Notification envoyée à ${count} compte${count > 1 ? 's' : ''}.`);
      setTitle(''); setBody('');
    } catch (e: any) {
      setError(e.message ?? 'Échec de l\'envoi.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Diffuser un message</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Megaphone size={28} color={colors.vert} />
        </View>
        <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl }]}>
          Envoie une notification dans l'app à l'audience choisie. Utilise ceci avec parcimonie.
        </Text>

        <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>DESTINATAIRES</Text>
        <View style={styles.audienceRow}>
          {AUDIENCES.map(a => {
            const Icon = a.icon;
            const active = audience === a.key;
            return (
              <Pressable
                key={a.key}
                style={[styles.audienceChip, active && styles.audienceChipActive]}
                onPress={() => setAudience(a.key)}
              >
                <Icon size={18} color={active ? colors.white : colors.encre} />
                <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: spacing.lg }} />

        <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>TITRE</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex. : Maintenance prévue ce soir"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <View style={{ height: spacing.lg }} />

        <Text style={[text.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>MESSAGE</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Détails du message…"
          placeholderTextColor={colors.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={5}
          maxLength={400}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={{ height: spacing.xl }} />
        {sending ? <ActivityIndicator color={colors.vert} /> : (
          <Button label="Envoyer" onPress={confirmSend} disabled={!title.trim() || !body.trim()} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  iconWrap: {
    width: 64, height: 64, borderRadius: radii.xl, backgroundColor: '#F2FBF6',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.md,
  },
  audienceRow: { flexDirection: 'row', gap: spacing.sm },
  audienceChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  audienceChipActive: { backgroundColor: colors.vert, borderColor: colors.vert },
  input: {
    minHeight: 48, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 15, color: colors.encre,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  error: { color: colors.terre, fontSize: 14, marginTop: spacing.sm },
});
