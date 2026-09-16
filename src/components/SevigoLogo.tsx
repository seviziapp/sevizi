// Sèvi Go brand mark — recreated as vector primitives (not the raw exported
// SVG, which embeds a large C2PA metadata block and hardcoded text-as-SVG
// that doesn't carry the app's actual font across native/web). Colors are
// themeable so the mark reads correctly on both light and dark surfaces.
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors, typography } from '../theme/tokens';

const MARK_ASPECT = 226 / 190;

export function SevigoMark({
  size = 40,
  pinColor = colors.vert,
  boltColor = colors.creme,
}: {
  size?: number;
  pinColor?: string;
  boltColor?: string;
}) {
  return (
    <Svg width={size} height={size * MARK_ASPECT} viewBox="0 0 190 226">
      <G transform="translate(10,10)">
        <Path d="M75 181 L22.1 128 A75 75 0 1 1 127.9 128 Z" fill={pinColor} />
        <G transform="translate(75,72) scale(0.62) translate(-76,-90)">
          <Path d="M82 12 L34 100 H70 L58 168 L118 78 H80 Z" fill={boltColor} />
        </G>
      </G>
    </Svg>
  );
}

// tone 'dark' = wordmark for light backgrounds ("Sèvi" in encre).
// tone 'light' = wordmark for dark backgrounds ("Sèvi" in creme).
export function SevigoLogoFull({
  height = 32,
  tone = 'dark',
}: {
  height?: number;
  tone?: 'dark' | 'light';
}) {
  const seviColor = tone === 'light' ? colors.creme : colors.encre;
  const boltColor = tone === 'light' ? colors.creme : colors.encre;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.22 }}>
      <SevigoMark size={height} boltColor={boltColor} />
      <Text style={{ fontFamily: typography.display, fontSize: height * 0.62, color: seviColor }}>
        Sèvi<Text style={{ color: colors.soleil }}>Go</Text>
      </Text>
    </View>
  );
}
