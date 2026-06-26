import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Navigation, MapPin } from 'lucide-react-native';
import { colors, text, radii, spacing } from '../theme/tokens';
import type { GeoPoint } from '../lib/types';

// Leaflet CSS injected once
function injectLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

interface Props {
  value: GeoPoint;
  onChange: (point: GeoPoint, label: string) => void;
  height?: number;
}

export function MapPicker({ value, onChange, height = 260 }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locating, setLocating] = useState(false);
  const [label, setLabel] = useState('Bè-Kpota, Lomé');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    injectLeafletCSS();

    // Dynamically load leaflet
    import('leaflet').then((L) => {
      const Leaflet = (L as any).default ?? L;
      if (mapRef.current || !containerRef.current) return;

      const map = Leaflet.map(containerRef.current, { zoomControl: true }).setView(
        [value.lat, value.lng], 15
      );

      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const pinIcon = Leaflet.divIcon({
        html: `<div style="width:32px;height:32px;border-radius:50%;background:${colors.vert};display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
               </div>`,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = Leaflet.marker([value.lat, value.lng], { icon: pinIcon, draggable: true }).addTo(map);
      markerRef.current = marker;
      mapRef.current = map;

      async function reverseGeocode(lat: number, lng: number) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`
          );
          const data = await res.json();
          return data.display_name?.split(',').slice(0, 2).join(',') ?? `${lat.toFixed(4)}°N`;
        } catch {
          return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
        }
      }

      marker.on('dragend', async () => {
        const { lat, lng } = marker.getLatLng();
        const lbl = await reverseGeocode(lat, lng);
        setLabel(lbl);
        onChange({ lat, lng }, lbl);
      });

      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        const lbl = await reverseGeocode(lat, lng);
        setLabel(lbl);
        onChange({ lat, lng }, lbl);
      });
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  function useGPS() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        if (mapRef.current) mapRef.current.setView([lat, lng], 16);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`
          );
          const data = await res.json();
          const lbl = data.display_name?.split(',').slice(0, 2).join(',') ?? `${lat.toFixed(4)}°N`;
          setLabel(lbl);
          onChange({ lat, lng }, lbl);
        } catch {
          onChange({ lat, lng }, `${lat.toFixed(4)}°N`);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Map container */}
      <View style={[styles.mapBox, { height }]}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.coordRow}>
          <MapPin size={14} color={colors.vert} />
          <Text style={[text.small, { color: colors.encre, flex: 1 }]} numberOfLines={1}>{label}</Text>
        </View>
        <Pressable style={styles.gpsBtn} onPress={useGPS} disabled={locating}>
          {locating
            ? <ActivityIndicator size="small" color={colors.vert} />
            : <><Navigation size={14} color={colors.vert} /><Text style={[text.small, { color: colors.vert }]}>Ma position</Text></>
          }
        </Pressable>
      </View>
      <Text style={[text.label, { color: colors.textMuted, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }]}>
        CLIQUEZ SUR LA CARTE OU FAITES GLISSER LE MARQUEUR
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  mapBox: { width: '100%' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.md },
  coordRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, height: 36, borderRadius: radii.md, borderWidth: 1, borderColor: colors.vert, backgroundColor: colors.surface },
});
