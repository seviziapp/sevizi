import React, { useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import {
  useFonts,
  HankenGrotesk_300Light,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync();

const MOBILE_MAX = 480;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_300Light,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  const onReady = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 768;

  if (!fontsLoaded) return null;

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.creme },
        animation: 'slide_from_right',
      }}
    />
  );

  if (isWide) {
    return (
      <View style={styles.webOuter} onLayout={onReady}>
        <StatusBar style="dark" />
        {/* Decorative brand background */}
        <View style={styles.webBg} />
        {/* Centered phone-width card */}
        <View style={[styles.webCard, { maxWidth: MOBILE_MAX }]}>
          {stack}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.creme }} onLayout={onReady}>
      <StatusBar style="dark" />
      {stack}
    </View>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: colors.encre,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.encre,
  },
  webCard: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.creme,
    overflow: 'hidden',
    // subtle shadow to lift card off dark bg
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 8 },
  },
});
