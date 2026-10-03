// Sèvi Go POS screens are an Unlimited-plan feature. This wraps them: it
// checks the plan, shows an upgrade prompt otherwise. It's only the friendly
// layer — the database enforces the same rule (sevigo_has_pos), so a hacked
// client can't sell or add products without the plan.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../theme/tokens';
import { Button } from './Button';
import { fetchSevigoUsage } from '../lib/sevigo/api';
import { reportError } from '../lib/reportError';

export function PosGate({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'locked'>('loading');

  useEffect(() => {
    fetchSevigoUsage()
      .then(u => setState(u.planId === 'unlimited' ? 'ok' : 'locked'))
      .catch(e => { reportError(e); setState('locked'); });
  }, []);

  if (state === 'ok') return <>{children}</>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={[styles.back, shadow.sm]} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      {state === 'loading' ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : (
        <View style={styles.locked}>
          <View style={styles.lockIcon}><Lock size={28} color={colors.vert} /></View>
          <Text style={[text.h3, { color: colors.encre, textAlign: 'center' }]}>Réservé à la formule Unlimited</Text>
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            La caisse (POS) et la gestion de stock sont incluses dans Sèvi Go Unlimited.
          </Text>
          <Button label="Voir les formules" onPress={() => router.push('/sevigo/plan')} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  locked: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  lockIcon: { width: 64, height: 64, borderRadius: radii.xl, backgroundColor: '#F2FBF6', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.lg },
});
