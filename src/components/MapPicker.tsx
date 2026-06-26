import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';
import type { GeoPoint } from '../lib/types';

// Native: react-native-maps placeholder (full implementation goes here for native builds)
interface Props {
  value: GeoPoint;
  onChange: (point: GeoPoint, label: string) => void;
  height?: number;
}

export function MapPicker({ height = 260 }: Props) {
  return <View style={[styles.box, { height }]} />;
}

const styles = StyleSheet.create({
  box: { borderRadius: radii.md, backgroundColor: colors.surface },
});
