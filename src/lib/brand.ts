// Which product is this? Sèvi Go is presented as its own product in two places:
//   - the web front door go.sevizi.app (same app and backend as Sèvizi), and
//   - the separate Sèvi Go Android app (APP_VARIANT=sevigo, see app.config.js),
//     which sets extra.appVariant = 'sevigo' at build time.
// Everything that shows a brand name or logo, or decides where to land, asks here.
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function isSevigoHost(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && /^go\./i.test(window.location.hostname);
}

export function isSevigoApp(): boolean {
  return (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant === 'sevigo';
}

/** True on go.sevizi.app and inside the Sèvi Go Android app. */
export function isSevigoBrand(): boolean {
  return isSevigoHost() || isSevigoApp();
}

export const BRAND_NAME = () => (isSevigoBrand() ? 'Sèvi Go' : 'Sèvizi');

/** Legal entity that publishes the apps — must match the developer name shown on Google Play. */
export const DEVELOPER_NAME = 'We Are Aurum';
export const SUPPORT_EMAIL = 'support@sevizi.app';
