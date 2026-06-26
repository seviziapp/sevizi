import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Camera, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Button } from '../../src/components/Button';
import { CATEGORIES, ServiceCategory } from '../../src/lib/types';
import { createRequest, LOME } from '../../src/lib/api';
import { MapPicker } from '../../src/components/MapPicker';
import type { GeoPoint } from '../../src/lib/types';

export default function NewRequest() {
  const router = useRouter();
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('plomberie');
  const [urgent, setUrgent] = useState(true);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<GeoPoint>(LOME);
  const [locationLabel, setLocationLabel] = useState('Bè-Kpota, Lomé');

  async function publish() {
    if (!desc.trim()) return;
    setLoading(true);
    try {
      const req = await createRequest({
        description: desc,
        category,
        urgent,
        location,
        locationLabel,
      });
      router.replace({ pathname: '/client/offers', params: { requestId: req.id } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <X size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Nouvelle demande</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Field label="Que se passe-t-il ?">
          <TextInput
            style={styles.textarea}
            placeholder="Fuite sous l'évier de la cuisine, besoin d'un plombier aujourd'hui…"
            placeholderTextColor={colors.textMuted}
            multiline
            value={desc}
            onChangeText={setDesc}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Catégorie">
          <View style={styles.chips}>
            {CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCategory(c.key)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[text.small, { color: active ? colors.white : colors.encre }]}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Où ? — posez le point exact">
          <MapPicker
            value={location}
            onChange={(pt, lbl) => { setLocation(pt); setLocationLabel(lbl); }}
            height={260}
          />
        </Field>

        <View style={styles.attachRow}>
          <Pressable style={styles.attach}>
            <Camera size={18} color={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted }]}>Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.attach, urgent && styles.urgentActive]}
            onPress={() => setUrgent(!urgent)}
          >
            <Text style={[text.small, { color: urgent ? colors.terre : colors.textMuted }]}>
              Urgent
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Publier ma demande"
          icon={<ArrowRight size={20} color={colors.white} />}
          onPress={publish}
          loading={loading}
          disabled={!desc.trim()}
        />
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[text.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  close: {
    width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  textarea: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, padding: spacing.lg, minHeight: 96,
    ...text.body, color: colors.encre,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, height: 38, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.encre, borderColor: colors.encre },
  attachRow: { flexDirection: 'row', gap: spacing.md },
  attach: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, height: 44, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
  },
  urgentActive: { borderColor: colors.terre, backgroundColor: '#F8E2DA' },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.creme },
});
