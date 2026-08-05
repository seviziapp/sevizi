import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import Constants from 'expo-constants';
import { colors, radii } from '../theme/tokens';
import type { GeoPoint } from '../lib/types';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  emoji?: string;
  urgent?: boolean;
  onPress?: () => void;
};

// react-native-maps' native MapView requires a Google Maps API key configured
// in app.json (android.config.googleMaps.apiKey / ios.config.googleMapsApiKey)
// — without one, initializing the native map view can crash the app outright
// on Android rather than just failing to load tiles. Only load the native
// module when a key is actually present; otherwise fall back to the same
// plain placeholder used on web, so a missing key degrades gracefully
// instead of crashing every screen that renders a map.
let MapView: any, Marker: any;
const androidMapsKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
const iosMapsKey = Constants.expoConfig?.ios?.config?.googleMapsApiKey;
const hasNativeMapsKey = Platform.OS === 'android' ? !!androidMapsKey : Platform.OS === 'ios' ? !!iosMapsKey : false;
if (Platform.OS !== 'web' && hasNativeMapsKey) {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

export function MarkersMap({ center, markers, height = 300, fill }: {
  center: GeoPoint; markers: MapMarker[]; height?: number; fill?: boolean;
}) {
  const sizeStyle = fill ? StyleSheet.absoluteFill : { height };
  if (!MapView) {
    return <View style={[styles.fallback, sizeStyle]} />;
  }
  return (
    <View style={[styles.wrap, sizeStyle]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            onPress={m.onPress}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: radii.lg },
  fallback: { width: '100%', backgroundColor: '#DDEEE6', borderRadius: radii.lg },
});
