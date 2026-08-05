import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, text, spacing } from '../../src/theme/tokens';
import { Logo } from '../../src/components/Logo';
import { fetchProviderByUsername } from '../../src/lib/api';

// Public landing page for a Sèvizi Pro provider's shareable booking link
// (sevizi.app/b/<username>). No login required to land here — it just
// resolves the username and forwards straight into the booking flow (or the
// public profile, for a provider who isn't set up for online booking), the
// same way tapping their card in-app would. Downstream screens already
// handle an unauthenticated visitor gracefully (e.g. book-appointment shows
// a clear "sign in" error only once they try to actually confirm).
export default function BookingLink() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) { setNotFound(true); return; }
    fetchProviderByUsername(username).then(provider => {
      if (!provider) { setNotFound(true); return; }
      if (provider.bookable) {
        router.replace({ pathname: '/client/book-appointment', params: { providerId: provider.id, providerName: provider.name } });
      } else {
        router.replace({ pathname: '/shared/provider-profile', params: { id: provider.id } });
      }
    }).catch(() => setNotFound(true));
  }, [username]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        {notFound ? (
          <>
            <Text style={[text.h3, { color: colors.encre, textAlign: 'center' }]}>Lien introuvable</Text>
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>
              Ce lien de réservation n'existe pas ou n'est plus actif.
            </Text>
          </>
        ) : (
          <>
            <Logo size={48} />
            <ActivityIndicator color={colors.vert} style={{ marginTop: spacing.lg }} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.creme },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl },
});
