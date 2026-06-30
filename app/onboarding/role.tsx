import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Wrench, Check, ArrowRight } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { Button } from '../../src/components/Button';
import { supabase } from '../../src/lib/supabase';

type Role = 'client' | 'prestataire';

export default function RoleScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('client');
  const [loading, setLoading] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Logo size={56} />

        <View style={{ marginTop: spacing.xxl }}>
          <Text style={[text.h1, { color: colors.encre }]}>Bienvenue sur{'\n'}Sèvizi</Text>
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
            Pour commencer, dites-nous ce que vous venez faire.
          </Text>
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          <RoleCard
            active={role === 'client'}
            onPress={() => setRole('client')}
            icon={<Search size={22} color={colors.vert} />}
            title="Je cherche un service"
            subtitle="Trouver un prestataire près de moi"
          />
          <RoleCard
            active={role === 'prestataire'}
            onPress={() => setRole('prestataire')}
            icon={<Wrench size={22} color={colors.vert} />}
            title="Je propose mes services"
            subtitle="Recevoir des demandes & répondre"
          />
        </View>

        <View style={{ flex: 1 }} />

        <Button
          label="Continuer"
          loading={loading}
          icon={<ArrowRight size={20} color={colors.white} />}
          onPress={async () => {
            setLoading(true);
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase.from('profiles').upsert({
                  id: user.id,
                  role,
                  email: user.email ?? null,
                  onboarded: false,
                });
              }
            } catch {}
            setLoading(false);
            router.replace(role === 'client' ? '/onboarding/client-details' : '/onboarding/provider-details');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function RoleCard({ active, onPress, icon, title, subtitle }: {
  active: boolean; onPress: () => void; icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.roleCard, active && styles.roleCardActive]}
    >
      <View style={[styles.roleIcon, active && { backgroundColor: colors.surface }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[text.h3, { color: colors.encre }]}>{title}</Text>
        <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
      </View>
      <View style={[styles.check, active && styles.checkActive]}>
        {active && <Check size={14} color={colors.white} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  container: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radii.lg,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white,
  },
  roleCardActive: { borderColor: colors.vert, backgroundColor: '#F2FBF6' },
  roleIcon: {
    width: 44, height: 44, borderRadius: radii.md,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  check: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.vert, borderColor: colors.vert },
});
