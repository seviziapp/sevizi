import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, MessageSquare } from 'lucide-react-native';
import { colors, text, radii, spacing, shadow } from '../../src/theme/tokens';
import { supabase } from '../../src/lib/supabase';

type MyReview = {
  id: string;
  providerName: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export default function MyReviews() {
  const router = useRouter();
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, provider:providers(name)')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setReviews(data.map((r: any) => ({
          id: r.id,
          providerName: r.provider?.name ?? 'Prestataire',
          rating: r.rating,
          comment: r.comment ?? '',
          createdAt: r.created_at,
        })));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.encre} />
        </Pressable>
        <Text style={[text.h2, { color: colors.encre }]}>Mes avis laissés</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.vert} style={{ marginTop: 60 }} />
      ) : reviews.length === 0 ? (
        <View style={styles.empty}>
          <MessageSquare size={48} color={colors.border} />
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
            Vous n'avez encore laissé aucun avis.{'\n'}Après chaque mission, vous pouvez évaluer votre prestataire.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {reviews.map(r => (
            <View key={r.id} style={[styles.card, shadow.card]}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Text style={[text.bodyMd, { color: colors.creme }]}>{r.providerName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyMd, { color: colors.encre }]}>{r.providerName}</Text>
                  <Text style={[text.label, { color: colors.textMuted }]}>
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.stars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} color={colors.soleil} fill={i < r.rating ? colors.soleil : 'none'} />
                  ))}
                </View>
              </View>
              {!!r.comment && (
                <Text style={[text.body, { color: colors.encre, marginTop: spacing.sm }]}>{r.comment}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  back: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl * 2 },
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.vert, alignItems: 'center', justifyContent: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
});
