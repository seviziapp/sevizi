import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { GeoPoint } from './types';

// Get the device's current GPS position. Resolves to null (never throws) on
// denied permission, no support, or timeout — callers fall back to a saved
// address or a default city center.
export async function getCurrentPosition(timeoutMs = 8000): Promise<GeoPoint | null> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => { clearTimeout(timer); resolve({ lat: coords.latitude, lng: coords.longitude }); },
        () => { clearTimeout(timer); resolve(null); },
        { enableHighAccuracy: true, timeout: timeoutMs }
      );
    });
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
