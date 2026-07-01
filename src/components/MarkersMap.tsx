import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

// Native: use react-native-maps (loaded lazily so web never bundles it).
let MapView: any, Marker: any;
if (Platform.OS !== 'web') {
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
