import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';
import type { GeoPoint } from '../lib/types';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  urgent?: boolean;
  onPress?: () => void;
};

function injectLeafletCSS() {
  if (typeof document === 'undefined' || document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

export function MarkersMap({ center, markers, height = 300, fill }: {
  center: GeoPoint; markers: MapMarker[]; height?: number; fill?: boolean;
}) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // init map once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectLeafletCSS();
    import('leaflet').then((mod) => {
      const L = (mod as any).default ?? mod;
      LRef.current = L;
      if (mapRef.current || !containerRef.current) return;
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
        .setView([center.lat, center.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      // "you are here" dot
      L.circleMarker([center.lat, center.lng], {
        radius: 7, color: '#2D7FF9', fillColor: '#2D7FF9', fillOpacity: 1, weight: 3,
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      renderMarkers();
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-render markers when they change
  useEffect(() => { renderMarkers(); }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  function renderMarkers() {
    const L = LRef.current;
    if (!L || !layerRef.current) return;
    layerRef.current.clearLayers();
    markers.forEach((m) => {
      const bg = m.urgent ? colors.terre : colors.vert;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;border-radius:50%;background:${bg};border:3px solid ${colors.white};box-shadow:0 2px 8px rgba(6,41,31,.35);cursor:pointer"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(layerRef.current);
      if (m.onPress) marker.on('click', m.onPress);
    });
  }

  return (
    <View style={[styles.wrap, fill ? StyleSheet.absoluteFill : { height }]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: radii.lg, backgroundColor: '#DDEEE6' },
});
