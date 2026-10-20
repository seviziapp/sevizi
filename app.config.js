// Sèvizi ships as two Android apps from one codebase:
//   - Sèvizi   (default)         package com.weareaurum.sevizi
//   - Sèvi Go  (APP_VARIANT=sevigo, EAS profile "sevigo")  package com.weareaurum.sevigo
//
// app.json stays the single static source for Sèvizi (EAS auto-increments its
// android.versionCode there). This file only overrides what differs for Sèvi Go:
// name, package, URL scheme, icons, splash, permissions, and the runtime flag
// extra.appVariant that src/lib/brand.ts reads.

// Bump on every Sèvi Go build uploaded to Google Play (Sèvi Go is not
// auto-incremented, so it never touches Sèvizi's counter in app.json).
const SEVIGO_VERSION_CODE = 2;

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'sevigo') {
    return { ...config, extra: { ...config.extra, appVariant: 'sevizi' } };
  }

  return {
    ...config,
    name: 'Sèvi Go',
    scheme: 'sevigo',
    icon: './assets/sevigo/icon.png',
    splash: { image: './assets/sevigo/splash.png', backgroundColor: '#06291F', resizeMode: 'contain' },
    web: { ...config.web, favicon: './assets/sevigo/icon.png' },
    // Sèvi Go has no iOS app yet.
    ios: undefined,
    android: {
      package: 'com.weareaurum.sevigo',
      versionCode: SEVIGO_VERSION_CODE,
      adaptiveIcon: { foregroundImage: './assets/sevigo/adaptive-foreground.png', backgroundColor: '#FBF7EE' },
      // Sèvi Go never uses the device location: keep Google Play's permission review clean.
      blockedPermissions: ['android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'],
    },
    plugins: (config.plugins || []).filter(p => (Array.isArray(p) ? p[0] : p) !== 'expo-location').map(p =>
      Array.isArray(p) && p[0] === 'expo-image-picker'
        ? ['expo-image-picker', { photosPermission: "Sèvi Go a besoin d'accéder à vos photos pour ajouter votre logo à vos factures." }]
        : p),
    extra: { ...config.extra, appVariant: 'sevigo', hasAndroidGoogleMapsKey: false },
  };
};
