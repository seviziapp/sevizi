import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, text, radii, spacing } from '../theme/tokens';

type Tone = 'dispo' | 'attente' | 'urgent' | 'neutral' | 'data';

const TONES: Record<Tone, { bg: string; fg: string; dot?: string }> = {
  dispo: { bg: colors.surface, fg: colors.vertDark, dot: colors.vert },
  attente: { bg: '#FDF3D6', fg: '#8A6D08' },
  urgent: { bg: '#F8E2DA', fg: colors.terre },
  neutral: { bg: colors.surface, fg: colors.encre },
  data: { bg: colors.encre, fg: colors.creme },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {t.dot && <View style={[styles.dot, { backgroundColor: t.dot }]} />}
      <Text
        style={[
          tone === 'data' ? text.label : text.small,
          { color: t.fg, fontFamily: tone === 'data' ? text.label.fontFamily : text.small.fontFamily },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
